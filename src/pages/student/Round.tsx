import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Send, AlertCircle, StopCircle, Info, MessageSquare, Code, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { playCountdownTick, playCriticalTick, playSubmitSuccess, playScoreReveal, playGoodScore, playBadScore, startBackgroundMusic, stopBackgroundMusic, getMuted, getCurrentMusicStyle } from '../../lib/sounds';
import { confettiBurst, confettiCannons, confettiPop } from '../../lib/confetti';
import MusicSelector from '../../components/MusicSelector';
import MediaBlock from '../../components/MediaBlock';
import WaitingForRound from '../../components/WaitingForRound';
import { resolveMediaSrc } from '../../lib/media';
import { scoreMCQuestion, scoreMCBlock, MC_SCORING_LEGEND } from '../../lib/mcScoring';
import { mcTimeline, mcGateSeconds } from '../../lib/mcTiming';
import type { MCResponse } from '../../types/game';

// On a light ground the four Kahoot fills would be four shouting rectangles, so
// the tile itself is a white card with an ink border and a hard bottom shadow,
// and the position colour moves to the key badge. Colour-coding survives;
// the text stays ink-on-white and readable.
// Text colour travels with the fill: white is unreadable on the amber badge
// (2.0:1), so that one carries ink instead.
const MC_KEY_COLORS = [
  'bg-kahoot-red text-onaccent',
  'bg-kahoot-blue text-onaccent',
  'bg-kahoot-yellow text-ink',
  'bg-kahoot-green text-onaccent',
];
const MC_TILE_BASE =
  'bg-surface border-2 border-ink shadow-[0_3px_0_#101114] hover:bg-surface-2 active:translate-y-[3px] active:shadow-none';


export default function Round() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, error, submitAnswer, submitMCBlock, submissions, isHost } = useGame(gameCode);

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
      if (currentScenarioRef.current?.type === 'multiple_choice' && !hasSubmitted && pending.length > 0) {
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
  const mcSelectedOption = mcAnswers[mcCurrentQ]?.selectedOptionId ?? null;
  const mcAnswered = mcAnswers[mcCurrentQ] !== undefined;
  const mcLocked = mcRevealed || mcAnswered || timeline?.phase !== 'question';
  const mcQuestionTimeLeft = timeline?.phase === 'question' ? timeline.secondsLeft : 0;

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
  }, [mcQuestions, timeline, mcAnswers]);

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

  // MC: right/wrong reveal, once per question, when the shared clock closes it.
  useEffect(() => {
    if (!isMC || !mcRevealed || hasSubmitted || mcBlockDone) return;
    if (mcRevealedRef.current === mcCurrentQ) return;
    mcRevealedRef.current = mcCurrentQ;
    if (mcAnswers[mcCurrentQ]?.correct) {
      playGoodScore();
      confettiPop();
    } else {
      playBadScore();
    }
  }, [isMC, mcRevealed, mcCurrentQ, mcAnswers, hasSubmitted, mcBlockDone]);

  // MC: block finished — score over the block's TOTAL questions and submit once.
  useEffect(() => {
    if (!isMC || !mcQuestions || hasSubmitted || mcBlockDone) return;
    if (timeline?.phase !== 'done') return;

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
  }, [isMC, mcQuestions, timeline?.phase, hasSubmitted, mcBlockDone, submitMCBlock]);

  const handleSubmit = useCallback(async () => {
    if (!response.trim() || hasSubmitted || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitAnswer(response.trim());
      setHasSubmitted(true);
      playSubmitSuccess();
      confettiPop();
      // Screen flash
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 300);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [response, hasSubmitted, isSubmitting, submitAnswer]);

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
                {submissions.length} <span className="text-faint font-bold">/ {Object.keys(game.players || {}).length}</span>
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
                      answered={submissions.length}
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
                      answered={submissions.length}
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
                  <div className="card-play p-5 sm:p-6">
                    <p className="text-xl sm:text-2xl font-black text-ink leading-snug">
                      {currentScenario.mcQuestions[mcCurrentQ]?.question}
                    </p>
                    <MediaBlock
                      media={currentScenario.mcQuestions[mcCurrentQ]?.media}
                      className="mt-4"
                    />
                  </div>

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

                  {/* Option buttons */}
                  <div className={`grid ${mcOptionGridClass} gap-3`}>
                    {currentScenario.mcQuestions[mcCurrentQ]?.options.map((opt, i) => {
                      const correctIdx = currentScenario.mcQuestions![mcCurrentQ]?.correctOptionIndex;
                      const isCorrectOption = i === correctIdx;
                      const isSelected = mcSelectedOption === opt.id;
                      const showResult = mcRevealed;

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
                          className={`${btnClass} ${textClass} p-4 sm:p-5 rounded-xl text-left transition-all font-bold text-base sm:text-lg leading-snug min-h-[76px] sm:min-h-[84px] flex ${
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
                            <span className="flex-1">{opt.text}</span>
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
                  </div>

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

                  {/* Shared reveal, once the question closes for everyone */}
                  {mcRevealed && (
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
                          {currentScenario.mcQuestions[mcCurrentQ]?.explanation}
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
              <div className="card-play p-6 mb-6">
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
                    {currentScenario.context ?? currentScenario.prompt}
                  </p>
                  <MediaBlock media={currentScenario.media} className="mt-4" />
                </div>

                {currentScenario.question && (
                  <div className="p-5 bg-kahoot-blue/15 border-2 border-kahoot-blue/30 rounded-xl">
                    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">
                      Pregunta
                    </h3>
                    <p className="text-ink leading-relaxed font-semibold">
                      {currentScenario.question}
                    </p>
                  </div>
                )}
              </div>

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

                      {evaluation.evaluations?.map((ev: { judgeName: string; judgeAvatar?: string; score: number; feedback: string; strengths: string[]; improvements: string[]; promptUsed?: string }, i: number) => (
                        <div key={i} className="mb-4 p-4 bg-surface-2 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className={`w-4 h-4 ${
                              i === 0 ? 'text-kahoot-red' : i === 1 ? 'text-kahoot-blue' : 'text-kahoot-green'
                            }`} />
                            <span className="font-bold">{ev.judgeAvatar ? `${ev.judgeAvatar} ` : ''}{ev.judgeName}</span>
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
                          answered={submissions.length}
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
              ) : (
                <div className="card-play p-6">
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-3">
                    Tu Respuesta
                  </label>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Escribe tu respuesta aqui..."
                    rows={8}
                    className="input-field resize-none mb-4"
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
    </div>
  );
}
