import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Star, Home, Download, FileText, FileJson } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import VueltaAlJuego from '../../components/VueltaAlJuego';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { buildTranscriptPdf } from '../../lib/transcriptPdf';
import { summarizeRoundScores } from '../../lib/diagnosticTotals';
import {
  collectPlayerRoundScores,
  type RoundDocInput,
  type SubmissionInput,
} from '../../lib/finalScores';
import { playPodiumFanfare, playLeaderboardTick, playDrumRoll, playApplause } from '../../lib/sounds';
import { confettiPodium, confettiStars, confettiSmallBurst, confettiBurst } from '../../lib/confetti';
import SupportLink from '../../components/SupportLink';
import CourseStandingsCard from '../../components/CourseStandingsCard';
import GameFeedback from '../../components/GameFeedback';
import { useMyGameFeedback } from '../../hooks/useGameFeedback';

interface PlayerFinalScore {
  playerId: string;
  playerName: string;
  totalScore: number;
  averageScore: number;
  /** Indexado por ronda-1. `null` = no jugo esa ronda (distinto de sacar 0). */
  roundScores: Array<number | null>;
  rank: number;
}

// Podium colors matching Kahoot's energetic palette
const PODIUM_STYLES = {
  1: { bg: 'from-yellow-400 to-yellow-600', text: 'text-black', border: 'border-yellow-300', shadow: 'shadow-yellow-500/40', h: 'h-48' },
  2: { bg: 'from-gray-300 to-gray-500', text: 'text-black', border: 'border-gray-200', shadow: 'shadow-gray-400/30', h: 'h-36' },
  3: { bg: 'from-amber-500 to-amber-700', text: 'text-black', border: 'border-amber-400', shadow: 'shadow-amber-500/30', h: 'h-28' },
};

export default function End() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const { user } = useAuth();
  const { game, loading, error, isHost } = useGame(gameCode);
  const [finalRankings, setFinalRankings] = useState<PlayerFinalScore[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const celebrationPlayed = useRef(false);
  const rankingsCalculated = useRef(false);
  // revealStage: 0=suspense → 1=3rd → 2=2nd → 3=1st → 4=done (show everything)
  const [revealStage, setRevealStage] = useState(0);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  // El feedback va ANTES del podio. Mientras esta compuerta esta cerrada no
  // empieza la revelacion: si no, los temporizadores del podio corren detras del
  // formulario y el alumno vuelve a una ceremonia que ya termino sin el.
  const { answered: feedbackAnswered, saving: feedbackSaving, save: saveFeedback } =
    useMyGameFeedback(gameCode);
  const [feedbackSkipped, setFeedbackSkipped] = useState(false);
  const feedbackGateOpen = isHost || feedbackSkipped || feedbackAnswered === true;

  // Un juego sin ninguna ronda rankeada no es una competencia: no hay podio ni
  // posicion que mostrar, solo el propio desempeno y el feedback. Sin esto, el
  // diagnostico de la primera clase cierra con tres nombres empatados en 0 en un
  // orden arbitrario, y con un "y el primer lugar es..." que no premia nada.
  const diagnosticOnly =
    Array.isArray(game?.scenarios) &&
    game.scenarios.length > 0 &&
    game.scenarios.every((s: { ranked?: boolean }) => s.ranked === false);

  // Calculate final rankings (run once)
  useEffect(() => {
    if (!gameCode || !game || rankingsCalculated.current) return;
    rankingsCalculated.current = true;

    const calculateFinalRankings = async () => {
      try {
        // El puntaje que manda es el del doc de la ronda, no el de la submission:
        // los duelos recalibran ahi y NO reescriben el finalScore del juez. Ver
        // src/lib/finalScores.ts. Las submissions siguen leyendose como respaldo
        // para juegos viejos, que no tienen subcoleccion `rounds`.
        const [roundsSnapshot, submissionsSnapshot] = await Promise.all([
          getDocs(collection(db, 'games', gameCode, 'rounds')),
          getDocs(collection(db, 'games', gameCode, 'submissions')),
        ]);

        const roundDocs: RoundDocInput[] = roundsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return { round: Number(data.round), rankings: data.rankings };
        });
        const submissionRows: SubmissionInput[] = submissionsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            playerId: data.playerId,
            playerName: data.playerName,
            round: Number(data.round),
            finalScore: data.evaluation?.finalScore,
          };
        });

        const totalRounds = game?.totalRounds || game?.scenarios?.length || 0;

        const rankings: PlayerFinalScore[] = collectPlayerRoundScores(
          totalRounds, roundDocs, submissionRows,
        )
          .map((player) => {
            // Las rondas a las que el alumno no llego se sacan antes de resumir:
            // si entraran como 0 le bajarian el promedio por una ronda que no
            // jugo. Un 0 de verdad (respuesta vacia, evaluada) si entra.
            const played = player.scores
              .map((score, idx) => ({ score, ranked: game?.scenarios?.[idx]?.ranked !== false }))
              .filter((r) => r.score !== null)
              .map((r) => ({ score: r.score as number, ranked: r.ranked }));
            const summary = summarizeRoundScores(played);
            return {
              playerId: player.playerId,
              playerName: player.playerName,
              roundScores: player.scores,
              totalScore: summary.total,
              averageScore: summary.average,
              rank: 0,
            };
          })
          // Mismo desempate que rankGame() en functions/src/lib/standings.ts: sin
          // el, dos empatados salen en un orden aca y en el otro en la tabla del
          // curso, y parece que una de las dos pantallas miente.
          .sort((a, b) => b.totalScore - a.totalScore || a.playerId.localeCompare(b.playerId));

        let currentRank = 1;
        rankings.forEach((player, index) => {
          if (index > 0 && player.totalScore < rankings[index - 1].totalScore) {
            currentRank = index + 1;
          }
          player.rank = currentRank;
        });

        setFinalRankings(rankings);
      } catch (err) {
        console.error('Error calculating rankings:', err);
      } finally {
        setLoadingRankings(false);
      }
    };

    calculateFinalRankings();
  }, [gameCode, game]);

  // Staged podium reveal — adapts to player count, with suspense announcements
  // No cleanup — timers must survive dependency ref changes from Firestore updates
  useEffect(() => {
    if (feedbackGateOpen && finalRankings.length > 0 && !loadingRankings && !celebrationPlayed.current) {
      celebrationPlayed.current = true;

      // Un juego diagnostico no tiene primer lugar, asi que no hay ceremonia:
      // el redoble y el "y el primer lugar es..." estarian anunciando un podio
      // que esta oculto. Se muestra todo de inmediato, con un festejo breve
      // porque igual terminaron.
      if (diagnosticOnly) {
        setRevealStage(4);
        confettiSmallBurst();
        return;
      }

      const numPodium = Math.min(finalRankings.length, 3);

      // Drum roll to build tension
      setTimeout(() => { playDrumRoll(); }, 500);

      let t = 3000; // current timeline position

      if (numPodium >= 3) {
        // Announce 3rd
        setTimeout(() => { setAnnouncement('En tercer lugar...'); }, t);
        t += 2500;
        // Reveal 3rd
        setTimeout(() => {
          setAnnouncement(null);
          setRevealStage(1);
          playApplause(1);
          confettiSmallBurst();
        }, t);
        t += 3500;
      }

      if (numPodium >= 2) {
        // Announce 2nd
        setTimeout(() => { setAnnouncement('En segundo lugar...'); }, t);
        t += 2500;
        // Reveal 2nd
        setTimeout(() => {
          setAnnouncement(null);
          setRevealStage(2);
          playApplause(2);
          confettiBurst();
        }, t);
        t += 3500;
      }

      // Announce 1st
      setTimeout(() => { setAnnouncement('Y el primer lugar es...'); playDrumRoll(); }, t);
      t += 3000;
      // Reveal 1st
      setTimeout(() => {
        setAnnouncement(null);
        setRevealStage(3);
        playPodiumFanfare();
        confettiPodium();
        confettiStars();
      }, t);
      t += 2000;

      // Show everything else
      setTimeout(() => { setRevealStage(4); }, t);
    }
  }, [finalRankings, loadingRankings, diagnosticOnly, feedbackGateOpen]);

  const handleDownloadReport = async () => {
    if (!gameCode || !user || !userRanking) return;

    setReportLoading(true);
    try {
      const generateReport = httpsCallable(functions, 'generateStudentReport');
      const result = await generateReport({ gameCode, playerId: user.uid });
      const reportData = result.data as {
        success: boolean;
        report: {
          sessionTitle: string;
          averageScore: number;
          roundDetails: Array<{
            round: number;
            scenario: string;
            type: 'multiple_choice' | 'open';
            context: string;
            question: string;
            response: string;
            mcQuestions: Array<{
              question: string;
              options: Array<{ id: string; text: string }>;
              correctOptionIndex: number;
              explanation: string;
            }>;
            mcResponses: Array<{
              questionIndex: number;
              selectedOptionId: string | null;
              correct: boolean;
              pointsAwarded: number;
            }>;
            evaluation?: {
              finalScore: number;
              evaluations: Array<{
                judgeName: string;
                feedback: string;
                strengths: string[];
                improvements: string[];
                /** Modelo que respaldo al juez; el PDF lo muestra junto al nombre. */
                model?: string;
              }>;
            };
          }>;
        };
      };

      if (!reportData.success) {
        throw new Error('Failed to generate report');
      }

      const report = reportData.report;

      const doc = buildTranscriptPdf({
        sessionTitle: report.sessionTitle,
        studentName: user.displayName || user.email || "Estudiante",
        gameCode,
        totalScore: userRanking.totalScore,
        dateLabel: new Date().toLocaleDateString("es-CL"),
        rounds: report.roundDetails,
      });
      doc.save(`transcripcion_${(user.displayName || "estudiante").replace(/\s+/g, "_")}.pdf`);

    } catch (err) {
      console.error('Report error:', err);
      alert('Error al generar el reporte. Por favor intenta de nuevo.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportSignals = async () => {
    if (!gameCode) return;

    setSignalsLoading(true);
    try {
      const exportFn = httpsCallable(functions, 'exportSignalsSummary');
      const result = await exportFn({ gameCode });
      const data = result.data as { success: boolean; export: Record<string, unknown> };

      if (!data.success) {
        throw new Error('Failed to export signals');
      }

      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `senales_${gameCode}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export signals error:', err);
      alert('Error al exportar senales. Intenta de nuevo.');
    } finally {
      setSignalsLoading(false);
    }
  };

  if (loading || loadingRankings) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kahoot-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink-soft font-bold">Calculando resultados finales...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 font-semibold">{error || 'Error al cargar resultados'}</p>
          <Link to="/" className="text-kahoot-green hover:underline mt-4 inline-block font-bold">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // El feedback tapa el podio hasta que se conteste o se salte. Al anfitrion no,
  // porque su pantalla es la que se proyecta al curso.
  if (!isHost && feedbackAnswered === false && !feedbackSkipped) {
    return (
      <GameFeedback
        saving={feedbackSaving}
        onSubmit={(rating, comment) => { void saveFeedback(rating, comment); }}
        onSkip={() => setFeedbackSkipped(true)}
      />
    );
  }

  const userRanking = finalRankings.find((r) => r.playerId === user?.uid);
  const topThree = finalRankings.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-black">{game.sessionConfig?.title || 'Sesion'}</h1>
          <p className="text-muted font-bold uppercase tracking-wider text-sm">Resultados Finales</p>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Suspense Announcement */}
        <AnimatePresence>
          {announcement && (
            <motion.div
              key="announcement"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4 }}
              className="text-center py-8"
            >
              <p className="text-3xl md:text-4xl font-black text-ink-soft animate-pulse">
                {announcement}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Podium — staged reveal. Se omite entero en un juego diagnostico. */}
        {!diagnosticOnly && (
        <div className="flex justify-center items-end gap-3 md:gap-5 h-72 mb-8">
          <AnimatePresence>
            {/* Second Place — revealStage >= 2 */}
            {topThree[1] && revealStage >= 2 && (
              <motion.div
                key="podium-2"
                initial={{ opacity: 0, y: 60, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 150 }}
                className="flex flex-col items-center"
              >
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br ${PODIUM_STYLES[2].bg} flex items-center justify-center mb-2 border-4 ${PODIUM_STYLES[2].border} shadow-lg ${PODIUM_STYLES[2].shadow}`}>
                  <span className={`text-2xl font-black ${PODIUM_STYLES[2].text}`}>2</span>
                </div>
                <p className="font-bold text-center text-sm mb-2 max-w-24 truncate">
                  {topThree[1].playerName}
                </p>
                <div className={`w-24 md:w-28 ${PODIUM_STYLES[2].h} bg-gradient-to-t ${PODIUM_STYLES[2].bg} rounded-t-xl flex items-center justify-center shadow-lg podium-grow`}>
                  <span className={`text-2xl font-black ${PODIUM_STYLES[2].text}`}>{topThree[1].totalScore}</span>
                </div>
              </motion.div>
            )}

            {/* First Place — revealStage >= 3 */}
            {topThree[0] && revealStage >= 3 && (
              <motion.div
                key="podium-1"
                initial={{ opacity: 0, y: 60, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 150 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Trophy className="w-10 h-10 text-yellow-400 mb-2" />
                </motion.div>
                <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${PODIUM_STYLES[1].bg} flex items-center justify-center mb-2 border-4 ${PODIUM_STYLES[1].border} shadow-xl ${PODIUM_STYLES[1].shadow}`}>
                  <span className={`text-3xl font-black ${PODIUM_STYLES[1].text}`}>1</span>
                </div>
                <p className="font-black text-center mb-2 max-w-28 truncate text-lg">
                  {topThree[0].playerName}
                </p>
                <div className={`w-28 md:w-32 ${PODIUM_STYLES[1].h} bg-gradient-to-t ${PODIUM_STYLES[1].bg} rounded-t-xl flex items-center justify-center shadow-xl podium-grow`}>
                  <span className={`text-3xl font-black ${PODIUM_STYLES[1].text}`}>{topThree[0].totalScore}</span>
                </div>
              </motion.div>
            )}

            {/* Third Place — revealStage >= 1 */}
            {topThree[2] && revealStage >= 1 && (
              <motion.div
                key="podium-3"
                initial={{ opacity: 0, y: 60, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 150 }}
                className="flex flex-col items-center"
              >
                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${PODIUM_STYLES[3].bg} flex items-center justify-center mb-2 border-4 ${PODIUM_STYLES[3].border} shadow-lg ${PODIUM_STYLES[3].shadow}`}>
                  <span className={`text-xl font-black ${PODIUM_STYLES[3].text}`}>3</span>
                </div>
                <p className="font-bold text-center text-sm mb-2 max-w-20 truncate">
                  {topThree[2].playerName}
                </p>
                <div className={`w-20 md:w-24 ${PODIUM_STYLES[3].h} bg-gradient-to-t ${PODIUM_STYLES[3].bg} rounded-t-xl flex items-center justify-center shadow-lg podium-grow`}>
                  <span className={`text-xl font-black ${PODIUM_STYLES[3].text}`}>{topThree[2].totalScore}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* User's Result — appears after full podium reveal. En un juego
            diagnostico no hay podio que revelar, asi que no espera el reveal. */}
        {(diagnosticOnly || revealStage >= 4) && userRanking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="card-play p-6"
          >
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-ink" />
              Tu Resultado Final
            </h2>

            <div className={`grid ${diagnosticOnly ? 'grid-cols-2' : 'grid-cols-3'} gap-4 text-center mb-6`}>
              {!diagnosticOnly && (
                <div className="p-4 bg-surface-2 rounded-xl">
                  <motion.p
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1, type: 'spring' }}
                    className="text-3xl font-black text-kahoot-green"
                  >
                    #{userRanking.rank}
                  </motion.p>
                  <p className="text-sm text-muted font-bold">Posicion</p>
                </div>
              )}
              <div className="p-4 bg-surface-2 rounded-xl">
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.1, type: 'spring' }}
                  className="text-3xl font-black"
                >
                  {userRanking.totalScore}
                </motion.p>
                <p className="text-sm text-muted font-bold">Puntaje Total</p>
              </div>
              <div className="p-4 bg-surface-2 rounded-xl">
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2, type: 'spring' }}
                  className="text-3xl font-black"
                >
                  {userRanking.averageScore}
                </motion.p>
                <p className="text-sm text-muted font-bold">Promedio</p>
              </div>
            </div>

            {diagnosticOnly && (
              <p className="text-sm text-muted font-medium mb-6">
                Este juego fue un diagnostico: ninguna ronda cuenta para el ranking del curso.
                Tu puntaje es para que veas como se evalua aca.
              </p>
            )}

            <div className="mb-6">
              <p className="text-xs text-muted mb-2 font-bold uppercase tracking-wider">Puntaje por ronda:</p>
              <div className="flex gap-2">
                {userRanking.roundScores.map((score, i) => {
                  const isRoundRanked = game?.scenarios?.[i]?.ranked !== false;
                  return (
                    <div
                      key={i}
                      className={`flex-1 p-2 rounded-xl text-center ${
                        // Sin puntaje = no jugo esa ronda. Va en gris, no en rojo:
                        // el rojo dice "te fue mal", y aca no hubo nada que evaluar.
                        score === null
                          ? 'border-2 border-line bg-surface-2 text-faint'
                          : !isRoundRanked
                          ? 'border-2 border-dashed border-line bg-surface-2 text-muted'
                          : score >= 80
                          ? 'bg-kahoot-green/20 text-kahoot-green border-2 border-kahoot-green/30'
                          : score >= 60
                          ? 'bg-kahoot-yellow/20 text-amber-ink border-2 border-kahoot-yellow/30'
                          : 'bg-kahoot-red/20 text-kahoot-red border-2 border-kahoot-red/30'
                      }`}
                    >
                      <p className="text-[10px] text-muted font-bold">R{i + 1}{!isRoundRanked ? '*' : ''}</p>
                      <p className="font-black">{score || '-'}</p>
                    </div>
                  );
                })}
              </div>
              {game?.scenarios?.some((s: { ranked?: boolean }) => s.ranked === false) && (
                <p className="text-xs text-faint mt-2 font-medium">* Ronda diagnostica (no afecta ranking)</p>
              )}
            </div>

            <button
              onClick={handleDownloadReport}
              disabled={reportLoading}
              className="w-full p-4 bg-kahoot-blue hover:bg-kahoot-blue/90 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-lg shadow-kahoot-blue/20"
            >
              {reportLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                  Generando reporte...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Descargar Reporte PDF
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Full Rankings — appears after full podium reveal */}
        {revealStage >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-play p-6"
          >
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Medal className="w-5 h-5 text-purple-400" />
              Ranking Completo
            </h2>

            <div className="space-y-2">
              {finalRankings.map((player, index) => (
                <motion.div
                  key={player.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.04 }}
                  onAnimationStart={() => setTimeout(() => playLeaderboardTick(index), (0.3 + index * 0.04) * 1000)}
                  className={`flex items-center gap-4 p-3 rounded-xl ${
                    player.playerId === user?.uid
                      ? 'bg-kahoot-green/15 border-2 border-kahoot-green/30'
                      : 'bg-surface-2'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                      player.rank === 1
                        ? 'bg-yellow-500 text-black'
                        : player.rank === 2
                        ? 'bg-gray-400 text-black'
                        : player.rank === 3
                        ? 'bg-amber-600 text-black'
                        : 'bg-surface-3'
                    }`}
                  >
                    {player.rank}
                  </div>

                  <span className="flex-1 min-w-0 font-bold truncate">
                    {player.playerName}
                    {player.playerId === user?.uid && (
                      <span className="text-kahoot-green text-sm ml-2 font-bold">(Tú)</span>
                    )}
                  </span>

                  <div className="flex gap-1">
                    {player.roundScores.map((score, i) => {
                      const isRoundRanked = game?.scenarios?.[i]?.ranked !== false;
                      return (
                        <span
                          key={i}
                          className={`text-xs w-8 text-center font-semibold ${
                            !isRoundRanked ? 'text-faint italic' : 'text-muted'
                          }`}
                        >
                          {score || '-'}{!isRoundRanked ? '*' : ''}
                        </span>
                      );
                    })}
                  </div>

                  <span className="font-mono font-black text-lg w-12 text-right">
                    {player.totalScore}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Acumulado del curso — despues del podio de la clase. Nunca al
            anfitrion: esta pantalla es la que el profesor proyecta al curso
            entero, y ahi no corresponde mostrar SU posicion acumulada. */}
        {revealStage >= 4 && !isHost && (
          <CourseStandingsCard courseId={game?.courseId} gameCode={gameCode} />
        )}

        {/* El feedback del juego NO se muestra en ninguna pantalla, y menos en
            esta, que es la que el profesor proyecta al curso: verlo ahi, con
            nombre y delante de todos, cambia lo que la gente se atreve a
            escribir. Se procesa despues, fuera de la app, con
            scripts/game-feedback.ts */}

        {/* Professor Class Report Button */}
        {revealStage >= 4 && isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card-play p-6"
          >
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Panel del Profesor
            </h2>
            <p className="text-muted text-sm mb-4 font-medium">
              Como profesor, puedes ver el reporte completo de la clase con estadisticas detalladas de todos los estudiantes.
            </p>
            <div className="space-y-3">
              <Link
                to={`/professor/report/${gameCode}`}
                className="w-full p-4 bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-lg shadow-purple-600/20"
              >
                <FileText className="w-5 h-5" />
                Ver Reporte de Clase
              </Link>
              <button
                onClick={handleExportSignals}
                disabled={signalsLoading}
                className="w-full p-4 bg-kahoot-orange hover:bg-kahoot-orange/90 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-lg shadow-kahoot-orange/20"
              >
                {signalsLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <FileJson className="w-5 h-5" />
                    Exportar Resumen de Senales (JSON)
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Return Home Button */}
        {revealStage >= 4 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center pb-8 space-y-6"
          >
            <SupportLink variant="card" />
            <Link to="/" className="primary-button inline-flex items-center gap-2">
              <Home className="w-5 h-5" />
              Volver al Inicio
            </Link>
          </motion.div>
        )}
      </main>

      {gameCode && <VueltaAlJuego gameCode={gameCode} proyectada={isHost} />}
    </div>
  );
}
