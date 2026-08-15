import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, ArrowRight, MessageSquare, Info, Code, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import VueltaAlJuego from '../../components/VueltaAlJuego';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { playScoreReveal, playGoodScore, playBadScore, playDrumRoll, playTensionSweep, playRankReveal } from '../../lib/sounds';
import { confettiBurst, confettiCannons } from '../../lib/confetti';
import { MC_SCORING_LEGEND } from '../../lib/mcScoring';
import { modelLabel } from '../../lib/modelLabel';
import { useCountUp } from '../../hooks/useCountUp';
import { applyRound, rachaStorageKey, readRacha, writeRacha, EMPTY_RACHA } from '../../lib/racha';

interface JudgeEvaluation {
  judgeName: string;
  judgeAvatar?: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  promptUsed?: string;
  /** Modelo que respaldo a este juez. Ausente en evaluaciones previas a 2026-07-15. */
  model?: string;
}

/* Los hooks no se pueden llamar dentro del .map() de las filas, asi que cada numero
   que cuenta vive en su propio componente. Ambos se montan recien cuando la fila ya
   esta revelada, o sea que el conteo arranca justo cuando se ve. */

/** Promedio acumulado, contando desde el de la ronda anterior. */
function AvgCounter({ from, to }: { from: number; to: number }) {
  const value = useCountUp(from, to, { decimals: 1 });
  return <>{value}</>;
}

/** Puntaje de la ronda, contando desde cero. */
function RoundCounter({ to }: { to: number }) {
  const value = useCountUp(0, to);
  return <>+{value}</>;
}

export default function Results() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, error, roundResults, isHost, nextRound, endGame, submissions } = useGame(gameCode);
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setEvaluationComplete] = useState(false);
  const scoreSoundPlayed = useRef(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({});
  // Leaderboard phases: show → swap (names move) → reveal (details cascade) → done
  const [lbPhase, setLbPhase] = useState<'show' | 'swap' | 'reveal' | 'done'>('show');
  const [revealedCount, setRevealedCount] = useState(0);
  /** Que corrida de la animacion ya se lanzo: `${ronda}:${fase}`. */
  const leaderboardRunRef = useRef<string | null>(null);
  const leaderboardTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Navigate based on game status
  useEffect(() => {
    if (game?.status === 'active') {
      navigate(`/game/${gameCode}/round`);
    } else if (game?.status === 'finished') {
      navigate(`/game/${gameCode}/end`);
    }
  }, [game?.status, gameCode, navigate]);

  // Play score reveal sound + confetti when evaluation appears
  useEffect(() => {
    const userSub = submissions.find(s => s.playerId === user?.uid);
    if (userSub?.evaluation && !scoreSoundPlayed.current && !isProcessing) {
      scoreSoundPlayed.current = true;
      playScoreReveal();
      const score = userSub.evaluation.finalScore;
      // Delay celebration sounds to play after reveal drumroll
      setTimeout(() => {
        if (score >= 90) {
          playGoodScore();
          confettiCannons();
        } else if (score >= 80) {
          playGoodScore();
          confettiBurst();
        } else if (score < 50) {
          playBadScore();
        }
      }, 600);
    }
  }, [submissions, user?.uid, isProcessing]);

  // Process round if host and not yet processed
  useEffect(() => {
    if (isHost && game?.status === 'round_end' && !roundResults && !isProcessing) {
      processRound();
    }
  }, [isHost, game?.status, roundResults, isProcessing]);

  /**
   * El rezagado: quien envio despues de que el anfitrion cerro la tabla.
   *
   * `processRoundEnd` arma la tabla con las submissions que ve en ese
   * instante, y el anfitrion la dispara apenas el juego pasa a `round_end` —
   * o sea, milisegundos despues de su propia submission. Al alumno cuya
   * escritura llega 0,6 s mas tarde no lo esperaba nadie: en el juego PEB9FL
   * quedo fuera de 5 de 6 rondas de alternativas, y como el acumulado se
   * arrastra desde la tabla, perdio tambien todo lo que venia despues. En
   * MGT300 clase 1, con 42 alumnos, le paso a uno en la ronda 2.
   *
   * Asi que el anfitrion sigue mirando: si aparece una submission YA EVALUADA
   * que la tabla no tiene, vuelve a llamar y la funcion la mete. Se exige que
   * este evaluada a proposito — llamar con una submission a medio evaluar
   * mandaria a los jueces a puntuarla por segunda vez.
   */
  const amendedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !roundResults || isProcessing) return;
    // Una ronda que ya paso por duelos no se enmienda: sus puntajes salen de
    // comparar unas respuestas con otras y no se mezclan con uno crudo.
    if (roundResults.recalibratedAt) return;

    const enTabla = new Set(roundResults.rankings.map(r => r.playerId));
    const rezagados = submissions
      .filter(s => s.evaluation && !enTabla.has(s.playerId))
      .map(s => s.playerId)
      .sort();
    if (rezagados.length === 0) return;

    // Una sola llamada por conjunto de rezagados, o el snapshot que llega
    // despues de enmendar vuelve a dispararla.
    const intento = `${roundResults.round}:${rezagados.join(',')}`;
    if (amendedForRef.current === intento) return;
    amendedForRef.current = intento;

    console.warn(`Ronda ${roundResults.round}: ${rezagados.length} submission(es) fuera de la tabla; reprocesando.`);
    const processRoundEnd = httpsCallable(functions, 'processRoundEnd');
    processRoundEnd({ gameCode, round: roundResults.round })
      .catch(err => console.error('No se pudo enmendar la tabla:', err));
  }, [isHost, roundResults, submissions, isProcessing, gameCode]);

  const processRound = async () => {
    if (!gameCode || !game) return;

    setIsProcessing(true);
    try {
      const processRoundEnd = httpsCallable(functions, 'processRoundEnd');
      await processRoundEnd({ gameCode, round: game.currentRound });
      setEvaluationComplete(true);

      // Ultima ronda: derecho al podio.
      //
      // Entre el 2026-08-03 y el 2026-08-15 esto tenia una excepcion: si la
      // ultima ronda iba a pasar por duelos se quedaba en la tabla, porque si
      // no la ronda que decide al ganador era la unica que se quedaba con el
      // puntaje crudo de los jueces. Sin duelos ya no hay dos puntajes, asi que
      // la excepcion perdio su motivo y vuelve el comportamiento simple.
      if (game.currentRound >= game.totalRounds) {
        await endGame();
        // Keep isProcessing=true to show spinner until navigation fires
        return;
      }
    } catch (err) {
      console.error('Process round error:', err);
    }
    setIsProcessing(false);
  };

  const handleNextRound = async () => {
    await nextRound();
  };

  const handleEndGame = async () => {
    if (!window.confirm('Terminar el juego ahora? Se mostrara el podio final con los resultados hasta esta ronda.')) return;
    await endGame();
  };

  // Compute values needed by hooks (must be before early returns)
  const currentScenario = game?.scenarios?.[game?.currentRound ? game.currentRound - 1 : 0];
  const isRankedRound = currentScenario?.ranked !== false;
  const isMCRound = currentScenario?.type === 'multiple_choice';

  // Cumulative leaderboard rankings
  // Uses totalScore from round doc (race-condition-proof) with game doc fallback
  const { cumulativeRankings, rankedRoundsPlayed } = useMemo(() => {
    if (!roundResults || !game?.players || !isRankedRound) {
      return { cumulativeRankings: [] as Array<{ playerId: string; playerName: string; roundScore: number; totalScore: number; avgScore: number; prevAvg: number; rank: number }>, rankedRoundsPlayed: 0 };
    }

    const played = game.scenarios
      ?.slice(0, game.currentRound)
      .filter((s: { ranked?: boolean }) => s.ranked !== false).length || 1;

    const rankings = Object.entries(game.players)
      .map(([playerId, player]) => {
        const roundRanking = roundResults.rankings.find((r: { playerId: string }) => r.playerId === playerId);
        const roundScore = roundRanking?.score || 0;
        // Prefer totalScore from round doc (written atomically with rankings)
        // Fall back to game doc's player.totalScore for backward compat
        const totalScore = roundRanking?.totalScore ?? (player.totalScore || 0);
        const avgScore = played > 0 ? totalScore / played : 0;
        const prevTotal = totalScore - roundScore;
        const prevAvg = played > 1 ? prevTotal / (played - 1) : 0;
        return { playerId, playerName: player.name, roundScore, totalScore, avgScore: Math.round(avgScore * 10) / 10, prevAvg, rank: 0 };
      })
      // Mismo desempate que End.tsx y que rankGame() en functions: sin el, dos
      // empatados salen en un orden en esta pantalla y en otro en el podio, y
      // parece que una de las dos miente. Ademas el orden no era estable entre
      // renders, asi que podian intercambiarse solos.
      .sort((a, b) => b.avgScore - a.avgScore || a.playerId.localeCompare(b.playerId));

    // Posicion compartida para los empatados: 1, 2, 2, 4 — no 1, 2, 3, 4. Un
    // alumno de MGT300 lo reporto como "cuando dos personas tienen el mismo
    // puntaje la jerarquizacion es extraña", y tenia razon: el puntaje que ve
    // es el redondeado a un decimal, asi que dos iguales en pantalla salian en
    // puestos distintos sin ninguna razon visible.
    let posicion = 1;
    rankings.forEach((p, i) => {
      if (i > 0 && p.avgScore < rankings[i - 1].avgScore) posicion = i + 1;
      p.rank = posicion;
    });

    return { cumulativeRankings: rankings, rankedRoundsPlayed: played };
  }, [roundResults, game?.players, game?.currentRound, game?.scenarios, isRankedRound]);

  // Initial display order before reveal animation
  const initialRankings = useMemo(() => {
    if (cumulativeRankings.length === 0) return cumulativeRankings;

    if (rankedRoundsPlayed <= 1) {
      // First ranked round: deterministic shuffle based on player IDs
      return [...cumulativeRankings].sort((a, b) => {
        const hashA = a.playerId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
        const hashB = b.playerId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
        return hashA - hashB;
      });
    }
    // Subsequent rounds: previous rank order
    return [...cumulativeRankings].sort((a, b) => b.prevAvg - a.prevAvg);
  }, [cumulativeRankings, rankedRoundsPlayed]);

  // Ronda y fase, arriba de todo lo que las usa: la animacion del leaderboard se
  // reinicia con ellas, asi que tienen que estar declaradas antes de ese efecto.
  const currentRound = game?.currentRound;
  const roundPhase = (roundResults as { phase?: string } | null)?.phase;

  // Leaderboard: animated top 10 + user position, full list after.
  //
  // Corre UNA vez por (ronda, fase). La fase es lo que hace que la tabla se
  // revele dos veces en una ronda con duelos: primero con el orden provisional
  // de los jueces y despues con el recalibrado, que es el momento en que las
  // posiciones se dan vuelta. 'recalibrating' se cuenta como provisional para no
  // relanzar la animacion en medio del montaje.
  //
  // Antes esto eran dos efectos: uno corria la animacion detras de un ref-guard y
  // otro, declarado DESPUES, bajaba ese guard al detectar el cambio de fase. Como
  // React ejecuta los efectos en orden de declaracion, en el render del cambio de
  // fase el primero ya habia pasado de largo, y el reinicio solo ocurria si mas
  // tarde llegaba OTRO snapshot que recalculara `cumulativeRankings` — el de
  // `players.totalScore`, que recalibrateRound escribe justo despues. Cuando las
  // dos escrituras llegaban en el mismo tick, React las juntaba en un solo render
  // y la tabla se quedaba pegada en "Ranking anterior" para siempre. Eso es lo que
  // le paso a la pantalla proyectada el 2026-08-03 y a nadie mas.
  const TOP_N = 10;

  useEffect(() => {
    if (cumulativeRankings.length === 0) return;
    const runKey = `${currentRound}:${roundPhase === 'final' ? 'final' : 'prov'}`;
    if (leaderboardRunRef.current === runKey) return;
    leaderboardRunRef.current = runKey;

    // Los timers de la corrida anterior se cancelan a mano: si quedaran vivos,
    // la cascada provisional seguiria escribiendo `revealedCount` encima de la
    // recalibrada. No se usa el return del efecto para esto porque el efecto se
    // re-evalua en cada snapshot y se cancelaria a si mismo.
    leaderboardTimersRef.current.forEach(clearTimeout);
    leaderboardTimersRef.current = [];
    const at = (fn: () => void, ms: number) => {
      leaderboardTimersRef.current.push(setTimeout(fn, ms));
    };

    setLbPhase('show');
    setRevealedCount(0);

    const showN = Math.min(cumulativeRankings.length, TOP_N);

    // Phase 1 "show": previous order visible (2s)
    at(() => playDrumRoll(), 500);

    // Phase 2 "swap": names MOVE — slow spring for maximum suspense
    at(() => {
      setLbPhase('swap');
      playTensionSweep();
    }, 2200);

    // Phase 3 "reveal": cascade top N from bottom (after tween + pause)
    let t = 6500; // 2.2s show + 3s tween + 1.3s pause to absorb
    at(() => setLbPhase('reveal'), t);
    for (let step = 1; step <= showN; step++) {
      const rank = showN - step + 1;
      const isPodium = rank <= 3;
      at(() => {
        setRevealedCount(step);
        playRankReveal(rank, showN);
      }, t);
      t += isPodium ? 800 : 200;
      if (rank === 2) t += 500;
    }

    // Phase 4 "done"
    at(() => setLbPhase('done'), t + 300);
  }, [cumulativeRankings, currentRound, roundPhase]);

  // Aca vivia el disparo de la recalibracion pareada — los duelos. Se saco el
  // 2026-08-15 por decision de Naim: el anfitrion ya no llama a
  // `recalibrateRound`, y `processRoundEnd` cierra la ronda en 'final' de una.
  //
  // La funcion sigue desplegada y sin llamar, a proposito: volver a encenderlos
  // es restituir este efecto, y no un redespliegue del backend.

  const numPlayers = cumulativeRankings.length;
  const hasPrevData = rankedRoundsPlayed > 1;
  const topN = Math.min(numPlayers, TOP_N);

  // Top N for animated leaderboard — always in FINAL order, use y-offset for initial positions
  const ROW_H = 64; // row height (p-4 = 32px padding + ~24px text + space-y-2 = 8px gap)
  const topRankings = cumulativeRankings.slice(0, topN);
  const topInitial = initialRankings.filter(p =>
    topRankings.some(t => t.playerId === p.playerId)
  );
  const isDetailRevealed = (rank: number) => revealedCount > 0 && rank > topN - revealedCount;
  const lastRevealedRank = topN > 0 ? topN - revealedCount + 1 : 0;
  const allRevealed = lbPhase === 'done';
  const userInTop = topRankings.some(p => p.playerId === user?.uid);
  const userRankingEntry = cumulativeRankings.find(p => p.playerId === user?.uid);

  // Racha del propio jugador. Es DECORACION: no entra en ningun calculo de puntaje.
  // Se persiste en localStorage porque el doc del juego no guarda historial por ronda
  // (Player solo tiene totalScore / currentRoundScore) — ver src/lib/racha.ts.
  // Tiene que quedar ANTES de los early returns: es un hook.
  const [racha, setRacha] = useState(EMPTY_RACHA);
  const myRoundScore = roundResults?.rankings.find(r => r.playerId === user?.uid)?.score;
  useEffect(() => {
    if (!gameCode || !user?.uid || myRoundScore === undefined || !currentRound) return;
    const key = rachaStorageKey(gameCode, user.uid);
    // Number(): los puntajes viajan como string mas seguido de lo que uno quisiera.
    const next = applyRound(readRacha(window.localStorage, key), currentRound, Number(myRoundScore));
    writeRacha(window.localStorage, key, next);
    setRacha(next);
  }, [gameCode, user?.uid, myRoundScore, currentRound]);

  if (loading || isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-kahoot-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          {/* Las rondas Kahoot se puntuan en el cliente (mcScoring.ts) y no pasan
              por los jueces: anunciarlos aqui seria mentir sobre lo que ocurre. */}
          <p className="text-ink-soft text-lg font-bold">
            {!isProcessing ? 'Cargando resultados...'
              : isMCRound ? 'Contando los puntos...'
              : 'Evaluando respuestas con IA...'}
          </p>
          <p className="text-muted text-sm mt-2 font-medium">
            {isMCRound
              ? 'Armando la tabla de posiciones'
              : '3 jueces AI estan analizando cada respuesta'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 font-semibold">{error || 'Error al cargar resultados'}</p>
        </div>
      </div>
    );
  }

  // Find current user's submission and evaluation
  const userSubmission = submissions.find(s => s.playerId === user?.uid);
  const userEvaluation = userSubmission?.evaluation;
  const userRank = roundResults?.rankings.find(r => r.playerId === user?.uid);
  // El numero grande sale del doc de la ronda, igual que la posicion que va al
  // lado: despues de los duelos ese doc trae el puntaje recalibrado y la
  // submission sigue con el del juez. Mostrar los dos juntos hacia que el alumno
  // viera "73" arriba de un "#2" que valia 89. Las barras de cada juez si siguen
  // siendo lo que voto cada juez. Ver src/lib/finalScores.ts.
  const userScore = Number(userRank?.score ?? userEvaluation?.finalScore ?? 0);

  // Judge bar colors (Kahoot answer colors)
  const JUDGE_COLORS = ['bg-kahoot-red', 'bg-kahoot-blue', 'bg-kahoot-green'];

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      {/* Barra de marcador: tinta a sangre, codigo en naranjo. Da estructura de
          competencia sin comprometer la identidad a un deporte concreto.
          Naranjo sobre tinta es texto claro sobre fondo oscuro — el caso inverso
          al que reprueba AA, asi que aqui si funciona como texto. */}
      <header className="bg-ink text-onaccent p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Resultados Ronda</span>
            <p className="text-xl font-black tabular-nums">
              {game.currentRound} <span className="text-white/45 font-bold">/ {game.totalRounds}</span>
            </p>
          </div>

          <div className="text-2xl font-black tracking-[0.2em] text-kahoot-orange tabular-nums">
            {gameCode}
          </div>
        </div>
      </header>

      {/* Aca iban el montaje de duelos y el cartel puente que lo anunciaba.
          Los dos salieron el 2026-08-15 junto con los duelos: ahora la ronda
          llega en 'final' de una y su tabla se anima derecho, como ya hacian
          las de alternativas y las no rankeadas. */}

      {/* Full-Screen Dramatic Leaderboard (ranked rounds only) — shown first for impact */}
      {roundResults && game.players && isRankedRound && (
        <div className="min-h-[80vh] flex flex-col justify-center py-8 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-black mb-2 text-center flex items-center justify-center gap-3">
              <TrendingUp className="w-8 h-8 sm:w-9 sm:h-9 text-kahoot-green" />
              {numPlayers > TOP_N ? `Top ${TOP_N}` : 'Ranking'}
            </h2>
            <p className="text-faint text-sm font-bold text-center mb-8 uppercase tracking-widest">
              {allRevealed ? 'Posiciones actualizadas'
                : lbPhase === 'swap' ? 'Actualizando posiciones...'
                : lbPhase === 'reveal' || revealedCount > 0 ? 'Revelando resultados...'
                : hasPrevData ? 'Ranking anterior' : 'Calculando ranking...'}
            </p>

            {/* Column Headers */}
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 text-[10px] text-muted uppercase tracking-widest font-bold border-b border-line mb-3 max-w-2xl lg:max-w-3xl mx-auto">
              <div className="w-12"></div>
              <span className="flex-1 min-w-0">Jugador</span>
              <span className="w-12 sm:w-16 text-right">Ronda</span>
              <span className="w-12 sm:w-16 text-right">Prom</span>
            </div>

            {/* Animated Top N — explicit y-offset animation (no LayoutGroup) */}
            <div className="space-y-2 max-w-2xl lg:max-w-3xl mx-auto">
              {topRankings.map((player, finalIdx) => {
                // Calculate y-offset to show element at its INITIAL position
                const initialIdx = topInitial.findIndex(p => p.playerId === player.playerId);
                const yOffset = initialIdx >= 0 ? (initialIdx - finalIdx) * ROW_H : 0;
                const isSwapping = lbPhase === 'swap';
                const settled = lbPhase === 'reveal' || lbPhase === 'done';

                const revealed = isDetailRevealed(player.rank) || allRevealed;
                const isSpotlight = player.rank === lastRevealedRank && revealedCount > 0 && !allRevealed;
                const prevRank = hasPrevData
                  ? initialRankings.findIndex(p => p.playerId === player.playerId) + 1
                  : 0;
                const delta = prevRank > 0 ? prevRank - player.rank : 0;
                const showDelta = revealed && delta !== 0;

                const showingPrev = lbPhase === 'show' && hasPrevData;
                const displayRank = revealed ? player.rank : showingPrev ? prevRank : '?';
                const displayAvg = revealed ? player.avgScore : showingPrev ? Math.round(player.prevAvg * 10) / 10 : '?';

                return (
                  <motion.div
                    key={player.playerId}
                    animate={{ y: (isSwapping || settled) ? 0 : yOffset }}
                    transition={isSwapping
                      ? { type: 'tween', duration: 3, ease: [0.25, 0.1, 0.25, 1] }
                      : { duration: 0 }
                    }
                    // Horizontal padding and gaps shrink on phones, but vertical
                    // padding must NOT: ROW_H below is the fixed row height the
                    // swap animation offsets are computed from.
                    className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-4 rounded-xl transition-colors duration-500 ${
                      isSpotlight
                        ? 'bg-kahoot-green/25 border-2 border-kahoot-green/50 shadow-lg shadow-kahoot-green/20'
                        : player.playerId === user?.uid
                        /* Naranjo = donde estas. Verde queda reservado para "correcto". */
                        ? 'bg-kahoot-orange/15 border-2 border-kahoot-orange/40'
                        : 'bg-surface-2 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        /* Dorsal circular. Los cuatro rellenos son fill-only y llevan
                           texto tinta fijo: antes esto usaba bg-yellow-500 / bg-gray-400 /
                           bg-amber-600, tres colores crudos fuera del sistema Cancha. */
                        className={`w-10 h-10 shrink-0 sticker flex items-center justify-center font-black text-lg text-ink transition-colors duration-500 ${
                          !revealed
                            ? showingPrev ? 'bg-surface-3' : 'bg-surface-2'
                            : player.rank === 1
                            ? 'bg-kahoot-yellow'
                            : player.rank === 2
                            ? 'bg-surface-3'
                            : player.rank === 3
                            ? 'bg-kahoot-orange'
                            : 'bg-surface-2'
                        }`}
                      >
                        {revealed ? (
                          <motion.span
                            initial={{ rotateX: 90, opacity: 0 }}
                            animate={{ rotateX: 0, opacity: 1 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                          >
                            {displayRank}
                          </motion.span>
                        ) : (
                          <span className={showingPrev ? 'text-muted' : ''}>
                            {displayRank}
                          </span>
                        )}
                      </div>
                      <AnimatePresence>
                        {showDelta && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
                            className={`text-xs font-black ${delta > 0 ? 'text-kahoot-green' : 'text-kahoot-red'}`}
                          >
                            {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Names ALWAYS fully visible — watching them move is the drama.
                        min-w-0 is required: a flex-1 child defaults to min-width:auto,
                        so `truncate` cannot shrink it and long names overflow the row. */}
                    <span className="flex-1 min-w-0 font-bold text-lg sm:text-xl truncate">
                      {player.playerName}
                      {player.playerId === user?.uid && (
                        <span className="tape text-sm ml-2">Tu</span>
                      )}
                    </span>

                    <span className={`w-12 sm:w-16 text-right font-mono tabular-nums font-bold transition-all duration-300 ${
                      revealed
                        ? player.roundScore >= 80 ? 'text-kahoot-green' :
                          player.roundScore >= 60 ? 'text-amber-ink' : 'text-kahoot-red'
                        : 'text-faint'
                    }`}>
                      {revealed ? (
                        <motion.span
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <RoundCounter to={player.roundScore} />
                        </motion.span>
                      ) : '...'}
                    </span>

                    <span
                      className={`w-12 sm:w-16 text-right font-mono tabular-nums font-black text-xl sm:text-2xl transition-all duration-500 ${
                        revealed ? 'opacity-100' : showingPrev ? 'opacity-50' : 'opacity-20'
                      }`}
                    >
                      {revealed ? (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                          <AvgCounter
                            from={Math.round(player.prevAvg * 10) / 10}
                            to={player.avgScore}
                          />
                        </motion.span>
                      ) : displayAvg}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* User position card if outside top N */}
            {allRevealed && !userInTop && userRankingEntry && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-2xl mx-auto mt-4"
              >
                <div className="text-center text-faint text-xs font-bold my-1">· · ·</div>
                <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-4 rounded-xl bg-kahoot-orange/15 border-2 border-kahoot-orange/40">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-surface-3 flex items-center justify-center font-black text-lg">
                    {userRankingEntry.rank}
                  </div>
                  <span className="flex-1 min-w-0 font-bold text-lg sm:text-xl truncate">
                    {userRankingEntry.playerName}
                    <span className="tape text-sm ml-2">Tu</span>
                  </span>
                  <span className={`w-16 text-right font-mono font-bold ${
                    userRankingEntry.roundScore >= 80 ? 'text-kahoot-green' :
                    userRankingEntry.roundScore >= 60 ? 'text-amber-ink' : 'text-kahoot-red'
                  }`}>
                    +{userRankingEntry.roundScore}
                  </span>
                  <span className="w-16 text-right font-mono font-black text-xl">
                    {userRankingEntry.avgScore}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* MC Round Results (simplified) */}
        {isMCRound && userSubmission && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="card-play p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-ink" />
                <h2 className="text-xl font-black">Resultado Kahoot</h2>
              </div>
              {userRank && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <Trophy
                    className={`w-6 h-6 ${
                      userRank.rank === 1 ? 'text-yellow-400'
                        : userRank.rank === 2 ? 'text-muted'
                        : userRank.rank === 3 ? 'text-amber-600'
                        : 'text-muted'
                    }`}
                  />
                  <span className="text-lg font-black">#{userRank.rank}</span>
                </motion.div>
              )}
            </div>

            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className={`text-6xl font-black ${
                  (userSubmission.mcBlockScore || 0) >= 80 ? 'text-kahoot-green'
                    : (userSubmission.mcBlockScore || 0) >= 40 ? 'text-amber-ink'
                    : 'text-kahoot-red'
                }`}
              >
                {userSubmission.mcBlockScore || 0}
              </motion.div>
              <p className="text-muted text-sm font-bold">Puntaje del Bloque</p>
            </div>

            {userSubmission.mcResponses && currentScenario?.mcQuestions && (
              <div className="space-y-3 max-w-md mx-auto">
                {userSubmission.mcResponses.map((r: { questionIndex: number; correct: boolean; pointsAwarded: number; selectedOptionId: string | null }, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl">
                    {r.correct ? (
                      <CheckCircle className="w-6 h-6 text-kahoot-green shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-kahoot-red shrink-0" />
                    )}
                    <span className="text-sm text-ink-soft font-medium flex-1 text-left">
                      {currentScenario.mcQuestions![i]?.question?.slice(0, 80)}...
                    </span>
                    <span className="font-mono font-bold text-sm">
                      {r.pointsAwarded}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-faint text-xs font-medium mt-6 max-w-md mx-auto leading-relaxed">
              {MC_SCORING_LEGEND}
            </p>
          </motion.div>
        )}

        {/* User Score Card (open rounds only) */}
        {!isMCRound && userEvaluation && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="card-play p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-black">Tu Resultado</h2>
                {/* Se muestra desde 2: una sola ronda buena no es una racha. */}
                {racha.count >= 2 && (
                  <span className="inline-flex items-center gap-2 bg-ink text-onaccent px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                    Racha
                    <b className="font-display text-kahoot-orange text-sm">x{racha.count}</b>
                  </span>
                )}
              </div>
              {isRankedRound && userRank && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <Trophy
                    className={`w-6 h-6 ${
                      userRank.rank === 1
                        ? 'text-yellow-400'
                        : userRank.rank === 2
                        ? 'text-muted'
                        : userRank.rank === 3
                        ? 'text-amber-600'
                        : 'text-muted'
                    }`}
                  />
                  <span className="text-lg font-black">#{userRank.rank}</span>
                </motion.div>
              )}
              {!isRankedRound && (
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
                  className={`text-6xl font-black ${
                    userScore >= 80
                      ? 'text-kahoot-green'
                      : userScore >= 60
                      ? 'text-amber-ink'
                      : 'text-kahoot-red'
                  }`}
                >
                  {userScore}
                </motion.div>
                <p className="text-muted text-sm font-bold">Puntaje</p>
              </div>

              <div className="flex-1 space-y-3">
                {userEvaluation.evaluations?.map((evaluation: JudgeEvaluation, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-ink-soft w-32 truncate font-semibold">
                      {evaluation.judgeAvatar ? `${evaluation.judgeAvatar} ` : ''}{evaluation.judgeName}
                    </span>
                    <div className="flex-1 h-3 bg-surface-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${evaluation.score}%` }}
                        transition={{ duration: 0.7, delay: 0.4 + i * 0.15, ease: 'easeOut' }}
                        className={`h-full rounded-full ${JUDGE_COLORS[i]}`}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold w-10 text-right">
                      {evaluation.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Student's submitted response */}
            {userSubmission?.response && (
              <div className="mb-4 p-4 bg-surface-2 rounded-xl">
                <p className="text-sm text-muted mb-2 font-bold uppercase tracking-wider text-xs">Tu respuesta:</p>
                <p className="text-ink-soft text-sm whitespace-pre-wrap font-medium">{userSubmission.response}</p>
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

            {/* Feedback */}
            {userEvaluation.evaluations?.map((evaluation: JudgeEvaluation, i: number) => (
              <div key={i} className="mb-4 p-4 bg-surface-2 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className={`w-4 h-4 ${
                    i === 0 ? 'text-kahoot-red' : i === 1 ? 'text-kahoot-blue' : 'text-kahoot-green'
                  }`} />
                  <span className="font-bold">{evaluation.judgeAvatar ? `${evaluation.judgeAvatar} ` : ''}{evaluation.judgeName}</span>
                  {/* Que modelo escribio este feedback. El panel son tres modelos distintos
                      a proposito, y el alumno tiene derecho a saber cual le habla. */}
                  {modelLabel(evaluation.model) && (
                    <span className="text-xs text-ink-soft font-normal">({modelLabel(evaluation.model)})</span>
                  )}
                </div>
                <p className="text-ink-soft text-sm mb-3 font-medium">{evaluation.feedback}</p>

                {evaluation.strengths?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-kahoot-green font-bold uppercase tracking-wider">Fortalezas:</span>
                    <ul className="text-xs text-muted ml-4 mt-1 font-medium">
                      {evaluation.strengths.map((s: string, j: number) => (
                        <li key={j}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.improvements?.length > 0 && (
                  <div>
                    <span className="text-xs text-orange-ink font-bold uppercase tracking-wider">Areas de mejora:</span>
                    <ul className="text-xs text-muted ml-4 mt-1 font-medium">
                      {evaluation.improvements.map((s: string, j: number) => (
                        <li key={j}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prompt viewer (host only) */}
                {evaluation.promptUsed && (
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
                        {evaluation.promptUsed}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* Diagnostic message for non-ranked rounds */}
        {roundResults && !isRankedRound && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-play p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <Info className="w-5 h-5 text-orange-ink" />
              <h2 className="text-lg font-black text-orange-800">Ronda Diagnostica</h2>
            </div>
            <p className="text-muted text-sm font-medium">
              Esta ronda no afecta el ranking. Tu respuesta se usa para sugerir equipos y temas de proyecto.
              El feedback de los jueces es informativo para que conozcas como se evalua en el curso.
            </p>
          </motion.div>
        )}

        {/* Next Round Button (Host only) */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center gap-4"
          >
            <button onClick={handleNextRound} className="primary-button px-10 py-5 text-lg">
              {game.currentRound < game.totalRounds ? (
                <>
                  Siguiente Ronda
                  <ArrowRight className="w-5 h-5 ml-2 inline" />
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5 mr-2 inline" />
                  Ver Resultados Finales
                </>
              )}
            </button>
            {game.currentRound < game.totalRounds && (
              <button
                onClick={handleEndGame}
                className="px-6 py-5 text-lg font-bold rounded-xl bg-red-600/20 text-red-700 border-2 border-red-500/30 hover:bg-red-600/40 hover:border-red-500/50 transition-all"
              >
                Terminar Juego
              </button>
            )}
          </motion.div>
        )}

        {/* Waiting message for non-hosts */}
        {!isHost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-surface-2 rounded-full">
              <div className="w-2 h-2 bg-kahoot-green rounded-full animate-pulse" />
              <span className="text-ink-soft font-semibold">
                Esperando la siguiente ronda...
              </span>
            </div>
          </motion.div>
        )}
      </main>

      {gameCode && <VueltaAlJuego gameCode={gameCode} proyectada={isHost} />}
    </div>
  );
}
