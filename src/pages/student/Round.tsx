import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Send, AlertCircle, StopCircle, Info, MessageSquare, Code, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import VueltaAlJuego from '../../components/VueltaAlJuego';
import { useAuth } from '../../hooks/useAuth';
import { useTypingTelemetry } from '../../hooks/useTypingTelemetry';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { playCountdownTick, playCriticalTick, playSubmitSuccess, playScoreReveal, playGoodScore, playBadScore, playDrumRoll, startBackgroundMusic, stopBackgroundMusic, getMuted, getCurrentMusicStyle } from '../../lib/sounds';
import { confettiBurst, confettiCannons, confettiPop } from '../../lib/confetti';
import MusicSelector from '../../components/MusicSelector';
import MediaBlock from '../../components/MediaBlock';
import WaitingForRound from '../../components/WaitingForRound';
import NoCopy from '../../components/NoCopy';
import MCReparto from '../../components/MCReparto';
import { MC_KEY_COLORS } from '../../lib/mcOptionColors';
import { resolveMediaSrc } from '../../lib/media';
import { scoreMCQuestion, scoreMCBlock, MC_SCORING_LEGEND } from '../../lib/mcScoring';
import { mcTimeline, mcGateSeconds, mcAnswerRevealed, mcBeatSeconds } from '../../lib/mcTiming';
import { mcStatsKey } from '../../lib/mcStats';
import { modelLabel } from '../../lib/modelLabel';
import { RichText } from '../../components/RichText';
import type { MCResponse } from '../../types/game';

/**
 * Cuanto dura `playDrumRoll`. Vive aca y no en sounds.ts porque lo unico que se
 * necesita es AGENDARLO, y exportar la duracion desde el modulo de sonido
 * invitaria a que alguien la cambie creyendo que altera el sonido.
 */
const DRUM_ROLL_MS = 1500;

// On a light ground the four Kahoot fills would be four shouting rectangles, so
// the tile itself is a white card with an ink border and a hard bottom shadow,
// and the position colour moves to the key badge. Colour-coding survives;
// the text stays ink-on-white and readable.
// Text colour travels with the fill: white is unreadable on the amber badge
// (2.0:1), so that one carries ink instead.
const MC_TILE_BASE =
  'bg-surface border-2 border-ink shadow-[0_3px_0_#101114] hover:bg-surface-2 active:translate-y-[3px] active:shadow-none';


export default function Round() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, error, submitAnswer, submitMCBlock, submissions, isHost, currentPlayer, markAnswered, answeredByQuestion } = useGame(gameCode);

  // Profesor que dirige sin jugar (`hostPlays: false` al crear el juego). Sigue
  // viendo la ronda entera porque ESTA pantalla es la que se proyecta al curso;
  // lo que no hace es contestar, enviar ni contar para los cortes anticipados.
  const isSpectator = isHost && !currentPlayer;

  const [response, setResponse] = useState('');
  const [endingRound, setEndingRound] = useState(false);

  // Manual end round (host only)
  const handleEndRound = async () => {
    if (!gameCode || !isHost || endingRound) return;

    const confirm = window.confirm(
      '¿Estas seguro de terminar la ronda ahora? Se evaluaran las respuestas enviadas.'
    );

    if (confirm) {
      setEndingRound(true);
      try {
        await updateDoc(doc(db, 'games', gameCode), {
          status: 'round_end',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error ending round:', err);
        setEndingRound(false);
      }
    }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [screenFlash, setScreenFlash] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({});
  const prevEvaluated = useRef(false);

  // MC block state.
  //
  // The gate, the current question and its clock are NOT stored here — they are
  // derived from the shared `game.roundStartTime` via mcTimeline(), so the
  // projector and every phone show the same question at the same instant. The
  // only local state is what THIS player picked.
  const [mcAnswers, setMcAnswers] = useState<Record<number, MCResponse>>({});
  const [mcBlockDone, setMcBlockDone] = useState(false);
  const [mcBlockScore, setMcBlockScore] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Which question index we have already played the reveal for (once each).
  const mcRevealedRef = useRef<number>(-1);
  // Latest ordered responses, readable from effects declared above the memo.
  const mcResponsesRef = useRef<MCResponse[]>([]);
  /**
   * Cerrojo SINCRONO contra la doble submission de un bloque MC.
   *
   * Hay dos caminos que envian el bloque —el timeline llegando a 'done' y el
   * host cerrando la ronda (game.status === 'round_end')— y llegan casi juntos
   * por diseno: useGame cierra la ronda justo cuando el timeline termina. Los dos
   * miraban `hasSubmitted`, que es ESTADO: no cambia hasta el siguiente render,
   * asi que ambos leian `false` y escribian. Se vio en produccion: dos
   * submissions identicas de la ronda 2, 2 ms aparte (juego YBWGQP, 2026-07-30),
   * y el jugador aparecia dos veces en la tabla de esa ronda.
   *
   * No duplica puntaje —processRoundEnd indexa las actualizaciones por playerId,
   * asi que la clave repetida se sobrescribe— pero si duplica la fila.
   *
   * Un ref se actualiza en el acto, asi que el segundo camino ve el cerrojo ya
   * puesto. No hace falta resetearlo entre rondas: el componente se remonta
   * porque el flujo pasa por la pantalla de resultados.
   */
  const submittedRef = useRef(false);

  // Check if current user has already submitted
  useEffect(() => {
    if (user && submissions) {
      const userSubmission = submissions.find(s => s.playerId === user.uid);
      if (userSubmission) {
        setHasSubmitted(true);
      }
    }
  }, [user, submissions]);

  // Navigate based on game status
  useEffect(() => {
    if (game?.status === 'round_end') {
      // Auto-submit incomplete MC block before navigating away.
      // Score over the block's TOTAL questions: averaging over answered ones
      // would let abandoning a block outscore completing it.
      const pending = mcResponsesRef.current;
      if (currentScenarioRef.current?.type === 'multiple_choice' && !submittedRef.current && pending.length > 0) {
        submittedRef.current = true;
        const totalQuestions = currentScenarioRef.current.mcQuestions?.length ?? pending.length;
        submitMCBlock(pending, scoreMCBlock(pending, totalQuestions));
      }
      navigate(`/game/${gameCode}/results`);
    } else if (game?.status === 'finished') {
      navigate(`/game/${gameCode}/end`);
    } else if (game?.status === 'waiting') {
      navigate(`/game/${gameCode}/lobby`);
    }
  }, [game?.status, gameCode, navigate]);

  // Timer + countdown sounds
  useEffect(() => {
    if (!game?.roundEndTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const endTime = game.roundEndTime!.toMillis();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [game?.roundEndTime]);

  // Countdown tick sounds (last 10 seconds)
  useEffect(() => {
    if (timeLeft > 0 && timeLeft <= 10 && !hasSubmitted) {
      if (timeLeft <= 3) {
        playCriticalTick();
      } else {
        playCountdownTick(timeLeft);
      }
    }
  }, [timeLeft, hasSubmitted]);

  // Background music (host only — projected screen with speakers)
  useEffect(() => {
    if (!isHost || game?.status !== 'active') return;
    if (getMuted()) return;
    startBackgroundMusic(getCurrentMusicStyle());
    return () => { stopBackgroundMusic(); };
  }, [isHost, game?.status]);

  // Sound + confetti when evaluation arrives
  useEffect(() => {
    if (!hasSubmitted) return;
    const userSub = submissions.find(s => s.playerId === user?.uid);
    if (userSub?.evaluated && !prevEvaluated.current) {
      prevEvaluated.current = true;
      const score = userSub.evaluation?.finalScore || 0;
      playScoreReveal();
      if (score >= 90) {
        setTimeout(() => { playGoodScore(); confettiCannons(); }, 600);
      } else if (score >= 75) {
        setTimeout(() => { playGoodScore(); confettiBurst(); }, 600);
      } else if (score < 50) {
        setTimeout(() => playBadScore(), 600);
      }
    }
  }, [submissions, hasSubmitted, user?.uid]);

  // MC: start question timer when question changes
  const currentScenarioRef = useRef(game?.scenarios?.[game?.currentRound ? game.currentRound - 1 : 0]);
  currentScenarioRef.current = game?.scenarios?.[game?.currentRound ? game.currentRound - 1 : 0];
  const isMC = currentScenarioRef.current?.type === 'multiple_choice';
  const mcQuestions = currentScenarioRef.current?.mcQuestions;

  // Como se escribe la respuesta abierta. Apagado en las rondas de seleccion
  // multiple (no hay textarea) y para el profesor que dirige sin jugar.
  const telemetria = useTypingTelemetry({
    enabled: !isMC && !isSpectator,
    round: game?.currentRound ?? 0,
    scenarioId: currentScenarioRef.current?.id ?? '',
    roundStartMs: game?.roundStartTime?.toMillis() ?? null,
  });

  // MC: the only clock left. Everything visible is a pure function of the
  // shared round start and this tick, so no screen can drift from another.
  useEffect(() => {
    if (!isMC || hasSubmitted || mcBlockDone) return;
    const tick = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(tick);
  }, [isMC, hasSubmitted, mcBlockDone]);

  const mcGate = mcGateSeconds(currentScenarioRef.current?.media);
  const timeline = useMemo(
    () =>
      isMC && mcQuestions
        ? mcTimeline({
            roundStartMs: game?.roundStartTime?.toMillis() ?? 0,
            nowMs,
            gateSeconds: mcGate,
            questions: mcQuestions,
            // Cuando ya respondieron todos, el host estampa el instante y la
            // pregunta se corta aqui tambien: si no, el alumno seguiria viendo
            // correr un reloj que el profesor ya cerro.
            allAnsweredAtMs: game?.mcAllAnsweredAt?.toMillis() ?? null,
          })
        : null,
    [isMC, mcQuestions, game?.roundStartTime, game?.mcAllAnsweredAt, nowMs, mcGate],
  );

  const mcCurrentQ = timeline?.questionIndex ?? 0;
  // The reveal is shared: everyone sees the right answer when the question
  // closes, not when they personally clicked. Answering early locks your tile
  // and nothing else — otherwise a fast player would be a round ahead.
  const mcRevealed = timeline?.phase === 'feedback';
  /**
   * Segundo compas de la revelacion: la correcta ya encendida.
   *
   * `mcRevealed` abre el reparto de votos con las casillas todavia en neutro;
   * esto abre el verde tres segundos despues (ver `mcAnswerRevealed`). Sale del
   * mismo reloj compartido, asi que el proyector y todos los telefonos pasan de
   * un compas al otro en el mismo instante.
   *
   * Sale de `mcQuestions` y no de `currentScenario`: este ultimo se declara mas
   * abajo en el componente, y leerlo aca reventaria por zona muerta temporal
   * justo en la ronda de alternativas.
   */
  const mcAnswerShown =
    mcRevealed &&
    mcAnswerRevealed(mcQuestions?.[mcCurrentQ]?.explanation, timeline?.secondsLeft ?? 0);
  const mcSelectedOption = mcAnswers[mcCurrentQ]?.selectedOptionId ?? null;
  const mcAnswered = mcAnswers[mcCurrentQ] !== undefined;
  const mcLocked = isSpectator || mcRevealed || mcAnswered || timeline?.phase !== 'question';
  const mcQuestionTimeLeft = timeline?.phase === 'question' ? timeline.secondsLeft : 0;

  /**
   * Cuantos han contestado, ahora mismo.
   *
   * En una ronda abierta es `submissions`, que se escribe al enviar. En un
   * bloque de alternativas NO se puede usar: la submission de un bloque se
   * escribe una sola vez, cuando la timeline llega a 'done', asi que el
   * contador marcaba 0/37 durante todo el bloque y saltaba a 37/37 al final —
   * que es exactamente lo que se vio en XNTUHB. El dato vive en la
   * subcoleccion `answers`, un doc por jugador y pregunta escrito en el clic,
   * la misma fuente que usa el corte anticipado del anfitrion.
   *
   * Se cuenta la pregunta en curso, no el bloque entero: es lo que importa
   * mientras corre el reloj, y coincide con el criterio del corte. Ya cerrado
   * el bloque ('done') vuelve a mandar `submissions`, que ahi si esta escrita.
   * Se descarta a quien no este en `players` (el profesor que dirige sin jugar
   * no cuenta) y se deduplica por si un doc se reescribio.
   */
  const answeredNow = useMemo(() => {
    if (!isMC || !timeline || timeline.phase === 'done') return submissions.length;
    const players = game?.players || {};
    const ids = answeredByQuestion[mcCurrentQ] || [];
    return new Set(ids.filter((id: string) => id in players)).size;
  }, [isMC, timeline, submissions.length, answeredByQuestion, mcCurrentQ, game?.players]);

  /**
   * El recuento de la pregunta que se esta revelando, si el anfitrion alcanzo a
   * publicarlo. Llega por el doc del juego, ya agregado: los datos crudos viven
   * en `choices` y solo el anfitrion puede leerlos (ver src/lib/mcStats.ts).
   *
   * Puede no estar: un juego viejo no lo tiene, y en uno nuevo la escritura
   * llega uno o dos snapshots despues del inicio de la revelacion. Cuando falta,
   * la pantalla se ve exactamente como antes.
   */
  const mcStats = useMemo(() => {
    if (!isMC || !game?.currentRound) return undefined;
    return game.mcStats?.[mcStatsKey(game.currentRound, mcCurrentQ)];
  }, [isMC, game?.mcStats, game?.currentRound, mcCurrentQ]);

  // Ordered, gap-free list for scoring and for the block summary.
  const mcResponses = useMemo(
    () =>
      Array.from({ length: mcQuestions?.length ?? 0 }, (_, i) => mcAnswers[i]).filter(
        (r): r is MCResponse => r !== undefined,
      ),
    [mcAnswers, mcQuestions],
  );
  mcResponsesRef.current = mcResponses;

  const handleMCSelect = useCallback((optionId: string) => {
    if (!mcQuestions || !timeline || timeline.phase !== 'question') return;
    const qi = timeline.questionIndex;
    const q = mcQuestions[qi];
    if (!q || mcAnswers[qi] !== undefined) return;

    // Elapsed is measured against the SHARED question start, so two players who
    // answer at the same wall-clock instant get the same speed bonus regardless
    // of when their page loaded.
    const responseTimeMs = Math.max(0, Date.now() - timeline.questionStartMs);
    const correct = q.options.findIndex(o => o.id === optionId) === q.correctOptionIndex;

    const mcResponse: MCResponse = {
      questionIndex: qi,
      selectedOptionId: optionId,
      responseTimeMs,
      correct,
      pointsAwarded: scoreMCQuestion({
        correct,
        answered: true,
        elapsedMs: responseTimeMs,
        timeLimitSeconds: q.timeLimitSeconds,
      }),
    };

    setMcAnswers(prev => (prev[qi] !== undefined ? prev : { ...prev, [qi]: mcResponse }));
    // "Locked in" — deliberately NOT a right/wrong sound. That comes at the reveal.
    playSubmitSuccess();

    // Avisa que este jugador ya contesto ESTA pregunta, para que el host pueda
    // cortarla cuando ya contestaron todos. Va por separado de la submission a
    // proposito: la submission se escribe recien en 'done', o sea siempre despues
    // del instante en que habria que cortar. Solo dice quien, que ronda y que
    // pregunta — la respuesta y el puntaje siguen viajando en /submissions.
    markAnswered(qi, { optionId, correct });
  }, [mcQuestions, timeline, mcAnswers, markAnswered]);

  // MC: a question the timeline has already closed and we never answered is
  // recorded as a no-answer, so the block score always divides by every
  // question (abandoning a block must never beat completing it).
  useEffect(() => {
    if (!isMC || !mcQuestions || !timeline || hasSubmitted || mcBlockDone) return;
    const closed =
      timeline.phase === 'done' ? mcQuestions.length
        : timeline.phase === 'feedback' ? timeline.questionIndex + 1
          : timeline.questionIndex;
    if (closed <= 0) return;

    setMcAnswers(prev => {
      let changed = false;
      const next = { ...prev };
      for (let i = 0; i < closed; i++) {
        if (next[i] === undefined) {
          next[i] = {
            questionIndex: i,
            selectedOptionId: null,
            responseTimeMs: 0,
            correct: false,
            pointsAwarded: scoreMCQuestion({
              correct: false, answered: false, elapsedMs: 0,
              timeLimitSeconds: mcQuestions[i]?.timeLimitSeconds ?? 20,
            }),
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [isMC, mcQuestions, timeline, hasSubmitted, mcBlockDone]);

  /**
   * El suspenso del PRIMER compas: un redoble que resuelve justo con el verde.
   *
   * Hasta el 2026-08-15 el grafico crecia en silencio y el unico sonido llegaba
   * con la respuesta ya revelada, asi que la pausa de tres segundos que existe
   * para generar expectativa no sonaba a nada. Naim lo pidio despues de jugar
   * S6ELE2: "la revelacion tendria que venir precedida de algun audio".
   *
   * Se agenda al FINAL del compas y no al principio: el redoble dura 1,5 s y el
   * compas 3, asi que arrancandolo de inmediato quedaba un segundo y medio de
   * silencio muerto justo antes del golpe. Empezando en `compas - 1,5 s` el
   * crescendo cae encima del verde, que es como suena en un concurso.
   *
   * `mcBeatSeconds` viene de mcTiming y no de una constante local a proposito:
   * el compas se recorta cuando la explicacion es corta, y una copia de la regla
   * aca se habria desincronizado en silencio.
   *
   * Suena en TODAS las pantallas, incluida la del anfitrion que solo dirige: el
   * suspenso es de la sala, no del jugador. Lo que no suena antes de tiempo es
   * el acierto o el error, que va en el segundo compas.
   */
  const mcSuspensoRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isMC || !mcRevealed || mcAnswerShown || mcBlockDone) return;
    if (mcSuspensoRef.current === mcCurrentQ) return;
    mcSuspensoRef.current = mcCurrentQ;

    const beatMs = mcBeatSeconds(mcQuestions?.[mcCurrentQ]?.explanation) * 1000;
    const espera = Math.max(0, beatMs - DRUM_ROLL_MS);
    const id = setTimeout(playDrumRoll, espera);
    return () => clearTimeout(id);
  }, [isMC, mcRevealed, mcAnswerShown, mcBlockDone, mcCurrentQ, mcQuestions]);

  // MC: right/wrong reveal, once per question. Suena en el SEGUNDO compas, con
  // el verde: el aplauso durante el grafico delataria la respuesta a la sala.
  useEffect(() => {
    if (!isMC || !mcAnswerShown || hasSubmitted || mcBlockDone) return;
    if (mcRevealedRef.current === mcCurrentQ) return;
    mcRevealedRef.current = mcCurrentQ;
    if (mcAnswers[mcCurrentQ]?.correct) {
      playGoodScore();
      confettiPop();
    } else {
      playBadScore();
    }
  }, [isMC, mcAnswerShown, mcCurrentQ, mcAnswers, hasSubmitted, mcBlockDone]);

  // MC: block finished — score over the block's TOTAL questions and submit once.
  // El anfitrion que solo dirige no envia bloque: una submission suya con 0 se
  // contaria como jugador en el ranking y en el podio.
  useEffect(() => {
    if (isSpectator) return;
    if (!isMC || !mcQuestions || submittedRef.current || mcBlockDone) return;
    if (timeline?.phase !== 'done') return;

    submittedRef.current = true;
    const responses = mcResponsesRef.current;
    const blockScore = scoreMCBlock(responses, mcQuestions.length);
    setMcBlockScore(blockScore);
    setMcBlockDone(true);
    setHasSubmitted(true);
    submitMCBlock(responses, blockScore);

    if (blockScore >= 80) {
      playGoodScore();
      confettiBurst();
    }
  }, [isSpectator, isMC, mcQuestions, timeline?.phase, hasSubmitted, mcBlockDone, submitMCBlock]);

  const handleSubmit = useCallback(async () => {
    if (!response.trim() || submittedRef.current || isSubmitting) return;

    submittedRef.current = true;
    setIsSubmitting(true);
    try {
      await submitAnswer(response.trim(), telemetria.snapshot());
      setHasSubmitted(true);
      playSubmitSuccess();
      confettiPop();
      // Screen flash
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 300);
    } catch (err) {
      console.error('Submit error:', err);
      // Se libera el cerrojo: si la escritura fallo, no hay nada enviado y el
      // alumno tiene que poder reintentar antes de que se acabe el tiempo.
      submittedRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [response, isSubmitting, submitAnswer, telemetria]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && response.trim() && !hasSubmitted) {
      handleSubmit();
    }
  }, [timeLeft, response, hasSubmitted, handleSubmit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kahoot-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink-soft font-semibold">Cargando ronda...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-kahoot-red mx-auto mb-4" />
          <p className="text-red-700 mb-4 font-semibold">{error || 'Error al cargar el juego'}</p>
        </div>
      </div>
    );
  }

  const currentScenario = game.scenarios?.[game.currentRound - 1];
  const isNonRanked = currentScenario?.ranked === false;
  const isCodeAnswer = currentScenario?.answerFormat === 'code';
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 60;
  const totalTime = currentScenario?.durationSeconds || game.roundDurationSeconds || 300;
  const timeProgress = ((totalTime - timeLeft) / totalTime) * 100;

  // Picture-answer questions need a wider grid so three portraits sit side by
  // side on a laptop/projector while still stacking on a phone.
  const mcCurrentOptions = currentScenario?.mcQuestions?.[mcCurrentQ]?.options ?? [];
  const mcHasOptionImages = mcCurrentOptions.some((o) => Boolean(o.imageSrc));
  const mcOptionGridClass =
    mcHasOptionImages && mcCurrentOptions.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className="min-h-screen bg-gradient-main relative">
      {/* Screen flash on submit */}
      {screenFlash && (
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-kahoot-green/30 z-50 pointer-events-none"
        />
      )}
      {/* Header with Timer */}
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm border-b-2 border-line p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="text-muted text-xs font-bold uppercase tracking-wider">Ronda</span>
              <p className="text-xl font-black">
                {game.currentRound} <span className="text-faint font-bold">/ {game.totalRounds}</span>
              </p>
            </div>

            {/* Dramatic Timer */}
            <motion.div
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-lg ${
                isLowTime
                  ? 'bg-kahoot-red/30 text-kahoot-red border-2 border-kahoot-red/50'
                  : 'bg-surface-2 text-ink border-2 border-line'
              }`}
              animate={isLowTime ? { scale: [1, 1.05, 1] } : {}}
              transition={isLowTime ? { repeat: Infinity, duration: 0.8 } : {}}
            >
              <Clock className="w-5 h-5" />
              <span className="font-mono tabular-nums">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </motion.div>

            <div className="text-right">
              <span className="text-muted text-xs font-bold uppercase tracking-wider">Respuestas</span>
              <p className="text-xl font-black text-kahoot-green">
                {answeredNow} <span className="text-faint font-bold">/ {Object.keys(game.players || {}).length}</span>
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isLowTime ? 'bg-kahoot-red' : 'bg-kahoot-green'}`}
              initial={{ width: 0 }}
              animate={{ width: `${timeProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className="mt-3 flex justify-end gap-2">
              <MusicSelector />
              <button
                onClick={handleEndRound}
                disabled={endingRound}
                className="flex items-center gap-2 px-4 py-2 bg-kahoot-red/80 hover:bg-kahoot-red text-ink rounded-lg font-bold text-sm transition-all disabled:opacity-50"
              >
                {endingRound ? (
                  <>
                    <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                    Terminando...
                  </>
                ) : (
                  <>
                    <StopCircle className="w-4 h-4" />
                    Terminar Ronda
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Non-ranked banner */}
      {isNonRanked && (
        <div className="bg-kahoot-orange/15 border-b-2 border-kahoot-orange/30">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <Info className="w-5 h-5 text-orange-ink shrink-0" />
            <p className="text-orange-800 text-sm font-semibold">
              No afecta ranking. Esto se usa para sugerir equipos y temas. Se honesto/a.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {currentScenario ? (
          currentScenario.type === 'multiple_choice' && currentScenario.mcQuestions ? (
            /* ============ MC BLOCK UI ============ */
            <motion.div
              key={game.currentRound}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* MC Title */}
              <div className="card-play p-6 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-kahoot-yellow/25 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider">
                    Kahoot
                  </span>
                  <Zap className="w-4 h-4 text-amber-ink" />
                </div>
                <h2 className="text-2xl font-black">{currentScenario.title}</h2>
                <p className="text-muted text-sm font-semibold mt-1">
                  {currentScenario.mcQuestions.length} preguntas — {currentScenario.mcQuestions[0]?.timeLimitSeconds}s cada una
                </p>
              </div>

              {hasSubmitted && !mcBlockDone ? (
                /* Already submitted this block in an earlier page load (e.g. the
                   player refreshed their phone). Never re-show the questions. */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-play p-8 text-center"
                >
                  <CheckCircle className="w-14 h-14 text-kahoot-green mx-auto mb-4" />
                  <h3 className="text-2xl font-black mb-2">Bloque completado</h3>
                  <p className="text-ink-soft font-semibold">
                    Ya enviaste tus respuestas de esta ronda.
                  </p>
                  <div className="mt-6">
                    <WaitingForRound
                      answered={answeredNow}
                      total={Object.keys(game.players || {}).length}
                    />
                  </div>
                </motion.div>
              ) : timeline?.phase === 'gate' && !mcBlockDone ? (
                /* ============ SHARED START GATE ============
                   No button, on any screen. The countdown runs off the shared
                   roundStartTime, so the professor's projector and every phone
                   reach question 1 at the same instant. The host controls when
                   the round starts; nobody starts their own copy. */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-play p-6 sm:p-8 text-center"
                >
                  <MediaBlock media={currentScenario.media} className="mb-6" />

                  <p className="text-ink-soft font-semibold mb-2">
                    {currentScenario.mcQuestions.length === 1
                      ? `1 pregunta · ${currentScenario.mcQuestions[0]?.timeLimitSeconds}s`
                      : `${currentScenario.mcQuestions.length} preguntas · ${currentScenario.mcQuestions[0]?.timeLimitSeconds}s cada una`}
                  </p>
                  <p className="text-faint text-xs font-medium mb-6 max-w-md mx-auto leading-relaxed">
                    {MC_SCORING_LEGEND}
                  </p>

                  <motion.div
                    key={timeline.secondsLeft}
                    initial={{ scale: 0.6, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="text-7xl sm:text-8xl font-black text-kahoot-green tabular-nums"
                  >
                    {timeline.secondsLeft}
                  </motion.div>
                  <p className="text-faint text-sm font-semibold mt-3">
                    Empieza para todos a la vez
                  </p>
                </motion.div>
              ) : mcBlockDone ? (
                /* MC Block Summary */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-play p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.3 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className={`text-6xl font-black mb-2 ${
                      mcBlockScore >= 80 ? 'text-kahoot-green' : mcBlockScore >= 40 ? 'text-amber-ink' : 'text-kahoot-red'
                    }`}
                  >
                    {mcBlockScore}
                  </motion.div>
                  <p className="text-muted text-sm font-bold mb-1">Puntaje del Bloque</p>
                  <p className="text-faint text-xs font-medium mb-6 max-w-md mx-auto leading-relaxed">
                    {MC_SCORING_LEGEND}
                  </p>

                  <div className="space-y-3 max-w-md mx-auto">
                    {mcResponses.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl">
                        {r.correct ? (
                          <CheckCircle className="w-6 h-6 text-kahoot-green shrink-0" />
                        ) : (
                          <XCircle className="w-6 h-6 text-kahoot-red shrink-0" />
                        )}
                        <span className="text-sm text-ink-soft font-medium flex-1 text-left">
                          P{i + 1}: {currentScenario.mcQuestions![i]?.question?.slice(0, 60)}...
                        </span>
                        <span className="font-mono font-bold text-sm">
                          {r.pointsAwarded}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-line">
                    <WaitingForRound
                      answered={answeredNow}
                      total={Object.keys(game.players || {}).length}
                    />
                  </div>
                </motion.div>
              ) : (
                /* MC Question in progress */
                <motion.div
                  key={mcCurrentQ}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Question counter + timer */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted text-sm font-bold">
                      Pregunta {mcCurrentQ + 1} / {currentScenario.mcQuestions.length}
                    </span>
                    <motion.div
                      className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-lg sm:text-xl ${
                        mcQuestionTimeLeft <= 5
                          ? 'bg-kahoot-red/30 text-kahoot-red border-2 border-kahoot-red/50'
                          : 'bg-surface-2 text-ink border-2 border-line'
                      }`}
                      animate={mcQuestionTimeLeft <= 5 ? { scale: [1, 1.08, 1] } : {}}
                      transition={mcQuestionTimeLeft <= 5 ? { repeat: Infinity, duration: 0.6 } : {}}
                    >
                      <Clock className="w-4 h-4" />
                      <span className="font-mono tabular-nums">{mcQuestionTimeLeft}s</span>
                    </motion.div>
                  </div>

                  {/* Question text + optional media — one card, so image and
                      question read as a single unit on a projected screen */}
                  <NoCopy className="card-play p-5 sm:p-6">
                    <p className="text-xl sm:text-2xl font-black text-ink leading-snug">
                      {/* Por RichText como el enunciado de las rondas abiertas.
                          Hoy ningun contenido usa markdown aca, pero los
                          profesores escriben sesiones desde la UI y el modo de
                          falla es silencioso y proyectado: asteriscos literales
                          delante del curso. */}
                      <RichText text={currentScenario.mcQuestions[mcCurrentQ]?.question} />
                    </p>
                    <MediaBlock
                      media={currentScenario.mcQuestions[mcCurrentQ]?.media}
                      className="mt-4"
                    />
                  </NoCopy>

                  {/* Timer progress bar */}
                  <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${mcQuestionTimeLeft <= 5 ? 'bg-kahoot-red' : 'bg-kahoot-green'}`}
                      style={{
                        width: `${(mcQuestionTimeLeft / (currentScenario.mcQuestions[mcCurrentQ]?.timeLimitSeconds || 25)) * 100}%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  {/* LA REVELACION ENTERA, en columnas, EN LUGAR de las
                      casillas.

                      Reemplaza y no se suma porque en 390 px no cabe todo: el
                      intento anterior fue una barrita al pie de cada casilla y
                      no daba el efecto de sala, porque competia con el texto de
                      su propia casilla en vez de leerse de una.

                      Hasta el 2026-08-15 esto corria SOLO en el primer compas y
                      el segundo remontaba las casillas, o sea que el grafico se
                      iba justo cuando la pregunta se resolvia. Ahora se queda en
                      los dos y la correcta se enciende encima, como en Kahoot:
                      `revealed` es lo que lo dispara, y MCReparto se encarga de
                      que la alternativa que eligio el jugador siga visible
                      aunque su columna se atenue.

                      Si el anfitrion nunca publico el recuento, esta rama no
                      corre y la revelacion cae a las casillas de siempre, con la
                      correcta en verde. Nunca queda un hueco. */}
                  {mcRevealed && mcStats && mcStats.total > 0 ? (
                    <MCReparto
                      options={currentScenario.mcQuestions[mcCurrentQ]?.options ?? []}
                      byOption={mcStats.byOption}
                      total={mcStats.total}
                      selectedOptionId={mcSelectedOption}
                      revealed={mcAnswerShown}
                      correctOptionId={
                        currentScenario.mcQuestions[mcCurrentQ]?.options[
                          currentScenario.mcQuestions[mcCurrentQ].correctOptionIndex
                        ]?.id
                      }
                    />
                  ) : (
                  /* Option buttons */
                  <NoCopy className={`grid ${mcOptionGridClass} gap-3`}>
                    {currentScenario.mcQuestions[mcCurrentQ]?.options.map((opt, i) => {
                      const correctIdx = currentScenario.mcQuestions![mcCurrentQ]?.correctOptionIndex;
                      const isCorrectOption = i === correctIdx;
                      const isSelected = mcSelectedOption === opt.id;
                      // El color sale en el SEGUNDO compas. En el primero las
                      // casillas siguen en neutro (y normalmente ni se ven: esta
                      // el grafico de columnas en su lugar).
                      const showResult = mcAnswerShown;

                      // Cuantos eligieron ESTA alternativa. En el segundo compas
                      // la ficha conserva el recuento que el grafico acaba de
                      // mostrar, para que el dato no se evapore mientras se lee
                      // la explicacion.
                      const nEsta = mcRevealed ? mcStats?.byOption?.[opt.id] : undefined;

                      // Green means correct and nothing else in this palette.
                      let btnClass = MC_TILE_BASE;
                      let textClass = 'text-ink';
                      if (showResult) {
                        if (isCorrectOption) {
                          // mc-correct: one decisive pulse + glow, readable from
                          // the back of a room. Disabled under reduced-motion.
                          btnClass = 'bg-kahoot-green border-2 border-kahoot-green-dark mc-correct';
                          textClass = 'text-onaccent';
                        } else if (isSelected) {
                          btnClass = 'bg-kahoot-red border-2 border-red-700 shadow-[0_3px_0_#B3272B] mc-wrong';
                          textClass = 'text-onaccent';
                        } else {
                          btnClass = 'bg-surface-2 border-2 border-line opacity-60';
                          textClass = 'text-muted';
                        }
                      } else if (mcRevealed) {
                        // Primer compas: se cerro la pregunta y esta creciendo el
                        // reparto de votos. Todas las casillas van en neutro y a
                        // opacidad plena — la barra tiene que leerse en las
                        // cuatro, y cualquier atenuacion aca ya insinuaria una
                        // respuesta. Solo se marca la propia, que el jugador ya
                        // sabe cual es.
                        btnClass = isSelected
                          ? 'bg-surface border-2 border-kahoot-blue shadow-[0_3px_0_#1368CE] ring-2 ring-kahoot-blue/30'
                          : 'bg-surface border-2 border-line';
                        textClass = 'text-ink';
                      } else if (mcAnswered) {
                        // Answered, reveal not due yet: confirm the pick without
                        // leaking whether it was right — the reveal is shared.
                        btnClass = isSelected
                          ? 'bg-surface border-2 border-kahoot-blue shadow-[0_3px_0_#1368CE] ring-2 ring-kahoot-blue/30'
                          : 'bg-surface-2 border-2 border-line opacity-50';
                        textClass = isSelected ? 'text-ink' : 'text-muted';
                      }

                      return (
                        <motion.button
                          key={opt.id}
                          onClick={() => !mcLocked && handleMCSelect(opt.id)}
                          disabled={mcLocked}
                          whileHover={!mcLocked ? { scale: 1.02 } : {}}
                          whileTap={!mcLocked ? { scale: 0.98 } : {}}
                          className={`${btnClass} ${textClass} relative overflow-hidden p-4 sm:p-5 rounded-xl text-left transition-all font-bold text-base sm:text-lg leading-snug min-h-[76px] sm:min-h-[84px] flex ${
                            opt.imageSrc ? 'flex-col items-stretch gap-3' : 'items-center gap-3'
                          }`}
                        >
                          {opt.imageSrc && (
                            <span className="block">
                              <img
                                src={resolveMediaSrc(opt.imageSrc)}
                                alt={opt.imageAlt || opt.text}
                                loading="lazy"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                className="w-full h-36 sm:h-44 object-cover rounded-lg bg-surface-3"
                              />
                              {opt.imageCredit && (
                                <span className="block text-[9px] font-medium text-muted mt-1 leading-tight">
                                  {opt.imageCredit}
                                </span>
                              )}
                            </span>
                          )}
                          <span className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                                showResult ? 'bg-ink/20 text-ink' : MC_KEY_COLORS[i % MC_KEY_COLORS.length]
                              }`}
                            >
                              {opt.id}
                            </span>
                            <span className="flex-1"><RichText text={opt.text} /></span>
                            {nEsta !== undefined && (
                              <span
                                className="shrink-0 tabular-nums text-sm font-black px-2 py-0.5 rounded-full bg-ink/15"
                                aria-label={`${nEsta} ${nEsta === 1 ? 'persona eligió' : 'personas eligieron'} esta alternativa`}
                              >
                                {nEsta}
                              </span>
                            )}
                            {showResult && isCorrectOption && (
                              <CheckCircle className="w-6 h-6 text-onaccent shrink-0" />
                            )}
                            {showResult && isSelected && !isCorrectOption && (
                              <XCircle className="w-6 h-6 text-onaccent shrink-0" />
                            )}
                          </span>
                        </motion.button>
                      );
                    })}
                  </NoCopy>
                  )}

                  {/* Cuantos acertaron. El numero que el profesor mira para
                      decidir si sigue o vuelve atras, y por eso se dice en
                      palabras y no solo en barras. Aparece cuando el anfitrion
                      publico el recuento; si no llego, no hay hueco. */}
                  {mcAnswerShown && mcStats && mcStats.total > 0 && (() => {
                    const idCorrecta = currentScenario.mcQuestions?.[mcCurrentQ]
                      ?.options[currentScenario.mcQuestions[mcCurrentQ].correctOptionIndex]?.id;
                    const aciertos = idCorrecta ? mcStats.byOption[idCorrecta] ?? 0 : 0;
                    const pct = Math.round((aciertos / mcStats.total) * 100);
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-4 flex items-baseline justify-center gap-2 text-center"
                      >
                        <span className="font-display text-2xl text-kahoot-green tabular-nums">
                          {aciertos} de {mcStats.total}
                        </span>
                        <span className="text-muted font-bold text-sm">
                          la tuvieron bien ({pct}%)
                        </span>
                      </motion.div>
                    );
                  })()}

                  {/* Answered, waiting for the shared reveal */}
                  {mcAnswered && !mcRevealed && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-3"
                    >
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 rounded-full">
                        <CheckCircle className="w-5 h-5 text-kahoot-blue" />
                        <span className="text-ink-soft text-sm font-bold">
                          Respuesta enviada. La respuesta correcta se revela para todos al cerrar la pregunta.
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {/* Shared reveal, once the question closes for everyone.
                      Va en el segundo compas: decirle "Correcto" a alguien ya es
                      revelar cual era la correcta. */}
                  {mcAnswerShown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-3"
                    >
                      {mcAnswers[mcCurrentQ]?.correct ? (
                        <p className="text-kahoot-green font-black text-lg sm:text-2xl">
                          Correcto! +{mcAnswers[mcCurrentQ]?.pointsAwarded} pts
                        </p>
                      ) : (
                        <p className="text-kahoot-red font-black text-lg sm:text-2xl">
                          {mcAnswers[mcCurrentQ]?.selectedOptionId == null
                            ? 'Tiempo agotado! +0 pts'
                            : `Incorrecto +${mcAnswers[mcCurrentQ]?.pointsAwarded ?? 0} pts`}
                        </p>
                      )}
                      {currentScenario.mcQuestions[mcCurrentQ]?.explanation && (
                        <p className="text-ink-soft text-sm font-medium mt-2 max-w-xl mx-auto leading-relaxed">
                          <RichText text={currentScenario.mcQuestions[mcCurrentQ]?.explanation} />
                        </p>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* ============ OPEN ROUND UI (existing) ============ */
            <motion.div
              key={game.currentRound}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Scenario Card */}
              <NoCopy className="card-play p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  {currentScenario.category && (
                    <span className="px-3 py-1 bg-kahoot-blue/25 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">
                      {currentScenario.category}
                    </span>
                  )}
                  {currentScenario.difficulty && (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        currentScenario.difficulty === 'easy'
                          ? 'bg-kahoot-green/25 text-emerald-700'
                          : currentScenario.difficulty === 'medium'
                          ? 'bg-kahoot-orange/25 text-orange-800'
                          : 'bg-kahoot-red/25 text-red-700'
                      }`}
                    >
                      {currentScenario.difficulty === 'easy'
                        ? 'Facil'
                        : currentScenario.difficulty === 'medium'
                        ? 'Medio'
                        : 'Dificil'}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black mb-4">{currentScenario.title}</h2>

                <div className="mb-6">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-2">
                    Contexto
                  </h3>
                  <p className="text-ink-soft leading-relaxed whitespace-pre-wrap font-medium">
                    <RichText text={currentScenario.context ?? currentScenario.prompt} />
                  </p>
                  <MediaBlock media={currentScenario.media} className="mt-4" />
                </div>

                {currentScenario.question && (
                  <div className="p-5 bg-kahoot-blue/15 border-2 border-kahoot-blue/30 rounded-xl">
                    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">
                      Pregunta
                    </h3>
                    <p className="text-ink leading-relaxed font-semibold">
                      <RichText text={currentScenario.question} />
                    </p>
                  </div>
                )}
              </NoCopy>

              {/* Response Area */}
              {hasSubmitted ? (
                (() => {
                  const userSub = submissions.find(s => s.playerId === user?.uid);
                  const evaluation = userSub?.evaluation;
                  const evaluated = userSub?.evaluated;

                  return evaluated && evaluation ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="card-play p-6"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black">Tu Resultado</h3>
                        {isNonRanked && (
                          <span className="px-3 py-1 bg-kahoot-orange/25 text-orange-800 rounded-full text-xs font-bold uppercase tracking-wider">
                            Diagnostica
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-6 mb-6">
                        <div className="text-center">
                          <motion.div
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                            className={`text-5xl font-black ${
                              evaluation.finalScore >= 80
                                ? 'text-kahoot-green'
                                : evaluation.finalScore >= 60
                                ? 'text-amber-ink'
                                : 'text-kahoot-red'
                            }`}
                          >
                            {evaluation.finalScore}
                          </motion.div>
                          <p className="text-muted text-sm font-bold">Puntaje</p>
                        </div>

                        <div className="flex-1 space-y-2">
                          {evaluation.evaluations?.map((ev: { judgeName: string; judgeAvatar?: string; score: number; feedback: string; strengths: string[]; improvements: string[] }, i: number) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-sm text-ink-soft w-32 truncate font-semibold">
                                {ev.judgeAvatar ? `${ev.judgeAvatar} ` : ''}{ev.judgeName}
                              </span>
                              <div className="flex-1 h-3 bg-surface-2 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${ev.score}%` }}
                                  transition={{ duration: 0.6, delay: 0.3 + i * 0.15, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${
                                    i === 0 ? 'bg-kahoot-red' : i === 1 ? 'bg-kahoot-blue' : 'bg-kahoot-green'
                                  }`}
                                />
                              </div>
                              <span className="text-sm font-mono font-bold w-10 text-right">
                                {ev.score}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Student's submitted response */}
                      {userSub?.response && (
                        <div className="mb-4 p-4 bg-surface-2 rounded-xl">
                          <p className="text-sm text-muted mb-2 font-bold uppercase tracking-wider text-xs">Tu respuesta:</p>
                          <p className="text-ink-soft text-sm whitespace-pre-wrap font-medium">{userSub.response}</p>
                        </div>
                      )}

                      {/* Reference Answer */}
                      {currentScenario?.referenceAnswer && (
                        <details className="mb-4 p-4 bg-surface-2 rounded-xl">
                          <summary className="text-muted font-bold uppercase tracking-wider text-xs cursor-pointer hover:text-ink-soft">
                            Ver respuesta de referencia
                          </summary>
                          <p className="text-ink-soft text-sm whitespace-pre-wrap font-medium mt-2">
                            {currentScenario.referenceAnswer}
                          </p>
                        </details>
                      )}

                      {evaluation.evaluations?.map((ev: { judgeName: string; judgeAvatar?: string; score: number; feedback: string; strengths: string[]; improvements: string[]; promptUsed?: string; model?: string }, i: number) => (
                        <div key={i} className="mb-4 p-4 bg-surface-2 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className={`w-4 h-4 ${
                              i === 0 ? 'text-kahoot-red' : i === 1 ? 'text-kahoot-blue' : 'text-kahoot-green'
                            }`} />
                            <span className="font-bold">{ev.judgeAvatar ? `${ev.judgeAvatar} ` : ''}{ev.judgeName}</span>
                            {/* Que modelo escribio este feedback. Ver Results.tsx. */}
                            {modelLabel(ev.model) && (
                              <span className="text-xs text-ink-soft font-normal">({modelLabel(ev.model)})</span>
                            )}
                          </div>
                          <p className="text-ink-soft text-sm mb-3 font-medium">{ev.feedback}</p>

                          {ev.strengths?.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs text-kahoot-green font-bold uppercase tracking-wider">Fortalezas:</span>
                              <ul className="text-xs text-muted ml-4 mt-1 font-medium">
                                {ev.strengths.map((s: string, j: number) => (
                                  <li key={j}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ev.improvements?.length > 0 && (
                            <div>
                              <span className="text-xs text-orange-ink font-bold uppercase tracking-wider">Areas de mejora:</span>
                              <ul className="text-xs text-muted ml-4 mt-1 font-medium">
                                {ev.improvements.map((s: string, j: number) => (
                                  <li key={j}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ev.promptUsed && (
                            <div className="mt-3 pt-3 border-t border-line">
                              <button
                                onClick={() => setExpandedPrompts(prev => ({ ...prev, [i]: !prev[i] }))}
                                className="flex items-center gap-1.5 text-xs text-faint hover:text-ink-soft transition-colors font-semibold"
                              >
                                <Code className="w-3 h-3" />
                                {expandedPrompts[i] ? 'Ocultar Prompt' : 'Ver Prompt'}
                              </button>
                              {expandedPrompts[i] && (
                                <pre className="mt-2 p-3 bg-surface-3 rounded-lg text-[10px] text-muted overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                                  {ev.promptUsed}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="mt-4 pt-4 border-t border-line text-center">
                        <WaitingForRound
                          answered={answeredNow}
                          total={Object.keys(game.players || {}).length}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="card-play p-8 text-center"
                    >
                      <div className="w-16 h-16 border-4 border-kahoot-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <h3 className="text-2xl font-black mb-2">Respuesta Enviada</h3>
                      <p className="text-ink-soft font-semibold">
                        3 jueces AI estan evaluando tu respuesta...
                      </p>
                      <div className="mt-4 p-4 bg-surface-2 rounded-xl text-left">
                        <p className="text-sm text-muted mb-2 font-bold uppercase tracking-wider text-xs">Tu respuesta:</p>
                        <p className="text-ink-soft text-sm whitespace-pre-wrap font-medium">
                          {response || userSub?.response}
                        </p>
                      </div>
                    </motion.div>
                  );
                })()
              ) : isSpectator ? (
                /* Dirigiendo sin jugar: la pregunta y el contexto de arriba siguen
                   proyectandose; lo unico que se reemplaza es el formulario. */
                <div className="dramatic-card p-6">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">
                    Estas dirigiendo
                  </p>
                  <p className="text-ink-soft font-semibold">
                    No entraste como jugador en este juego, asi que no contestas esta
                    ronda ni apareces en el podio.
                  </p>
                  <p className="text-muted text-sm font-medium mt-2">
                    La ronda se cierra sola apenas respondan los {Object.keys(game.players || {}).length}{' '}
                    jugadores, o cuando venza el reloj. Para jugar tu tambien, crea el
                    juego eligiendo &laquo;Tambien juego&raquo;.
                  </p>
                </div>
              ) : (
                <div className="card-play p-6">
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-3">
                    {isCodeAnswer ? 'Tu Codigo' : 'Tu Respuesta'}
                  </label>
                  <textarea
                    value={response}
                    onChange={(e) => {
                      setResponse(e.target.value);
                      telemetria.noteChange(e.target.value);
                    }}
                    onPaste={telemetria.onPaste}
                    ref={telemetria.refTextarea}
                    placeholder={isCodeAnswer ? 'Escribe tu codigo aqui...' : 'Escribe tu respuesta aqui...'}
                    rows={8}
                    // En rondas de codigo el teclado del telefono es el enemigo: sin esto
                    // `count(curso, dominio)` se envia como `Count(Curso, dominio)`.
                    autoCapitalize={isCodeAnswer ? 'off' : undefined}
                    autoCorrect={isCodeAnswer ? 'off' : undefined}
                    autoComplete={isCodeAnswer ? 'off' : undefined}
                    spellCheck={isCodeAnswer ? false : undefined}
                    className={`input-field resize-none mb-4 ${isCodeAnswer ? 'font-mono text-[15px] leading-relaxed' : ''}`}
                    disabled={isSubmitting}
                  />

                  <div className="flex justify-between items-center">
                    <span className="text-muted text-sm font-semibold">
                      {response.length} caracteres
                    </span>

                    <button
                      onClick={handleSubmit}
                      disabled={!response.trim() || isSubmitting}
                      className="primary-button flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar Respuesta
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-orange-ink mx-auto mb-4" />
            <p className="text-ink-soft font-semibold">No hay escenario disponible</p>
          </div>
        )}
      </main>

      {gameCode && <VueltaAlJuego gameCode={gameCode} proyectada={isHost} />}
    </div>
  );
}
