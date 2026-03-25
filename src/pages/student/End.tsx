import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Star, Home, Download, FileText, FileJson } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import jsPDF from 'jspdf';
import { playPodiumFanfare, playLeaderboardTick, playDrumRoll, playApplause } from '../../lib/sounds';
import { confettiPodium, confettiStars, confettiSmallBurst, confettiBurst } from '../../lib/confetti';

interface PlayerFinalScore {
  playerId: string;
  playerName: string;
  totalScore: number;
  roundScores: number[];
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
  // revealStage: 0=suspense → 1=3rd → 2=2nd → 3=1st → 4=done (show everything)
  const [revealStage, setRevealStage] = useState(0);

  // Calculate final rankings
  useEffect(() => {
    if (!gameCode || !game) return;

    const calculateFinalRankings = async () => {
      try {
        const submissionsRef = collection(db, 'games', gameCode, 'submissions');
        const submissionsSnapshot = await getDocs(submissionsRef);

        const playerScores: Record<string, { name: string; scores: number[] }> = {};

        submissionsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.evaluation?.finalScore !== undefined) {
            if (!playerScores[data.playerId]) {
              playerScores[data.playerId] = {
                name: data.playerName,
                scores: [],
              };
            }
            playerScores[data.playerId].scores[data.round - 1] = data.evaluation.finalScore;
          }
        });

        const rankings: PlayerFinalScore[] = Object.entries(playerScores)
          .map(([playerId, data]) => {
            const rankedTotal = data.scores.reduce((sum, score, idx) => {
              const isRanked = game?.scenarios?.[idx]?.ranked !== false;
              return sum + (isRanked ? (score || 0) : 0);
            }, 0);
            return {
              playerId,
              playerName: data.name,
              roundScores: data.scores,
              totalScore: rankedTotal,
              rank: 0,
            };
          })
          .sort((a, b) => b.totalScore - a.totalScore);

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

  // Staged podium reveal — adapts to player count
  useEffect(() => {
    if (finalRankings.length > 0 && !loadingRankings && !celebrationPlayed.current) {
      celebrationPlayed.current = true;
      const numPodium = Math.min(finalRankings.length, 3);
      const timers: ReturnType<typeof setTimeout>[] = [];

      // Drum roll
      timers.push(setTimeout(() => { playDrumRoll(); }, 500));

      if (numPodium >= 3) {
        // 3rd place
        timers.push(setTimeout(() => {
          setRevealStage(1);
          playApplause(1);
          confettiSmallBurst();
        }, 2000));
      }

      if (numPodium >= 2) {
        // 2nd place
        const t2nd = numPodium >= 3 ? 4000 : 2000;
        timers.push(setTimeout(() => {
          setRevealStage(2);
          playApplause(2);
          confettiBurst();
        }, t2nd));
      }

      // 1st place
      const t1st = numPodium >= 3 ? 6000 : numPodium >= 2 ? 4000 : 2000;
      timers.push(setTimeout(() => {
        setRevealStage(3);
        playPodiumFanfare();
        confettiPodium();
        confettiStars();
      }, t1st));

      // Show everything else
      timers.push(setTimeout(() => { setRevealStage(4); }, t1st + 1500));

      return () => { timers.forEach(clearTimeout); };
    }
  }, [finalRankings, loadingRankings]);

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
            evaluation?: {
              finalScore: number;
              evaluations: Array<{
                judgeName: string;
                feedback: string;
                strengths: string[];
                improvements: string[];
              }>;
            };
          }>;
          summary: {
            strengths: string[];
            improvements: string[];
            conceptsIdentified: string[];
          };
        };
      };

      if (!reportData.success) {
        throw new Error('Failed to generate report');
      }

      const report = reportData.report;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      doc.setFontSize(20);
      doc.setTextColor(70, 23, 143);
      doc.text('Reporte de Desempeno', margin, y);
      y += 10;

      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text(report.sessionTitle || 'ML2 Master Game', margin, y);
      y += 15;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Estudiante: ${user.displayName || user.email}`, margin, y);
      y += 8;
      doc.text(`Posicion Final: #${userRanking.rank} de ${finalRankings.length}`, margin, y);
      y += 8;
      doc.text(`Puntaje Total: ${userRanking.totalScore}`, margin, y);
      y += 8;
      doc.text(`Promedio: ${report.averageScore}`, margin, y);
      y += 15;

      doc.setFontSize(14);
      doc.setTextColor(0, 102, 204);
      doc.text('Puntajes por Ronda:', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      userRanking.roundScores.forEach((score, i) => {
        doc.text(`Ronda ${i + 1}: ${score || 0} puntos`, margin + 5, y);
        y += 6;
      });
      y += 10;

      if (report.summary.strengths.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(34, 139, 34);
        doc.text('Fortalezas Identificadas:', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        report.summary.strengths.slice(0, 5).forEach((strength) => {
          const lines = doc.splitTextToSize(`* ${strength}`, pageWidth - 2 * margin);
          lines.forEach((line: string) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(line, margin + 5, y);
            y += 5;
          });
        });
        y += 8;
      }

      if (report.summary.improvements.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setTextColor(220, 20, 60);
        doc.text('Areas de Mejora:', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        report.summary.improvements.slice(0, 5).forEach((improvement) => {
          const lines = doc.splitTextToSize(`* ${improvement}`, pageWidth - 2 * margin);
          lines.forEach((line: string) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(line, margin + 5, y);
            y += 5;
          });
        });
        y += 8;
      }

      if (report.summary.conceptsIdentified.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setTextColor(128, 0, 128);
        doc.text('Conceptos Evaluados:', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const conceptsText = report.summary.conceptsIdentified.join(', ');
        const lines = doc.splitTextToSize(conceptsText, pageWidth - 2 * margin);
        lines.forEach((line: string) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(line, margin + 5, y);
          y += 5;
        });
      }

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, margin, 285);

      const fileName = `reporte_${(user.displayName || 'estudiante').replace(/\s+/g, '_')}_ML2.pdf`;
      doc.save(fileName);

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
          <p className="text-white/70 font-bold">Calculando resultados finales...</p>
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
          <p className="text-white/50 font-bold uppercase tracking-wider text-sm">Resultados Finales</p>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Podium — staged reveal */}
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

        {/* User's Result — appears after full podium reveal */}
        {revealStage >= 4 && userRanking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-kahoot-yellow" />
              Tu Resultado Final
            </h2>

            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div className="p-4 bg-white/5 rounded-xl">
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1, type: 'spring' }}
                  className="text-3xl font-black text-kahoot-green"
                >
                  #{userRanking.rank}
                </motion.p>
                <p className="text-sm text-white/50 font-bold">Posicion</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.1, type: 'spring' }}
                  className="text-3xl font-black"
                >
                  {userRanking.totalScore}
                </motion.p>
                <p className="text-sm text-white/50 font-bold">Puntaje Total</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl">
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.2, type: 'spring' }}
                  className="text-3xl font-black"
                >
                  {Math.round(userRanking.totalScore / (userRanking.roundScores.length || 1))}
                </motion.p>
                <p className="text-sm text-white/50 font-bold">Promedio</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs text-white/50 mb-2 font-bold uppercase tracking-wider">Puntaje por ronda:</p>
              <div className="flex gap-2">
                {userRanking.roundScores.map((score, i) => {
                  const isRoundRanked = game?.scenarios?.[i]?.ranked !== false;
                  return (
                    <div
                      key={i}
                      className={`flex-1 p-2 rounded-xl text-center ${
                        !isRoundRanked
                          ? 'border-2 border-dashed border-white/20 bg-white/5 text-white/50'
                          : score >= 80
                          ? 'bg-kahoot-green/20 text-kahoot-green border-2 border-kahoot-green/30'
                          : score >= 60
                          ? 'bg-kahoot-yellow/20 text-kahoot-yellow border-2 border-kahoot-yellow/30'
                          : 'bg-kahoot-red/20 text-kahoot-red border-2 border-kahoot-red/30'
                      }`}
                    >
                      <p className="text-[10px] text-white/50 font-bold">R{i + 1}{!isRoundRanked ? '*' : ''}</p>
                      <p className="font-black">{score || '-'}</p>
                    </div>
                  );
                })}
              </div>
              {game?.scenarios?.some((s: { ranked?: boolean }) => s.ranked === false) && (
                <p className="text-xs text-white/40 mt-2 font-medium">* Ronda diagnostica (no afecta ranking)</p>
              )}
            </div>

            <button
              onClick={handleDownloadReport}
              disabled={reportLoading}
              className="w-full p-4 bg-kahoot-blue hover:bg-kahoot-blue/90 rounded-xl transition-colors flex items-center justify-center gap-2 font-bold shadow-lg shadow-kahoot-blue/20"
            >
              {reportLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            className="dramatic-card p-6"
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
                      : 'bg-white/5'
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
                        : 'bg-white/20'
                    }`}
                  >
                    {player.rank}
                  </div>

                  <span className="flex-1 font-bold truncate">
                    {player.playerName}
                    {player.playerId === user?.uid && (
                      <span className="text-kahoot-green text-sm ml-2 font-bold">(Tu)</span>
                    )}
                  </span>

                  <div className="flex gap-1">
                    {player.roundScores.map((score, i) => {
                      const isRoundRanked = game?.scenarios?.[i]?.ranked !== false;
                      return (
                        <span
                          key={i}
                          className={`text-xs w-8 text-center font-semibold ${
                            !isRoundRanked ? 'text-white/30 italic' : 'text-white/50'
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

        {/* Professor Class Report Button */}
        {revealStage >= 4 && isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Panel del Profesor
            </h2>
            <p className="text-white/60 text-sm mb-4 font-medium">
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
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            className="text-center pb-8"
          >
            <Link to="/" className="primary-button inline-flex items-center gap-2">
              <Home className="w-5 h-5" />
              Volver al Inicio
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
