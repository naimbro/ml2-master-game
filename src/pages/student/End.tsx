import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Medal, Star, Home, Download, FileText } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import jsPDF from 'jspdf';

interface PlayerFinalScore {
  playerId: string;
  playerName: string;
  totalScore: number;
  roundScores: number[];
  rank: number;
}

export default function End() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const { user } = useAuth();
  const { game, loading, error, isHost } = useGame(gameCode);
  const [finalRankings, setFinalRankings] = useState<PlayerFinalScore[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  // Calculate final rankings
  useEffect(() => {
    if (!gameCode || !game) return;

    const calculateFinalRankings = async () => {
      try {
        // Get all submissions
        const submissionsRef = collection(db, 'games', gameCode, 'submissions');
        const submissionsSnapshot = await getDocs(submissionsRef);

        // Group by player
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

        // Calculate totals and sort
        const rankings: PlayerFinalScore[] = Object.entries(playerScores)
          .map(([playerId, data]) => ({
            playerId,
            playerName: data.name,
            roundScores: data.scores,
            totalScore: data.scores.reduce((a, b) => a + (b || 0), 0),
            rank: 0,
          }))
          .sort((a, b) => b.totalScore - a.totalScore);

        // Assign ranks (handling ties)
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

  const handleDownloadReport = async () => {
    if (!gameCode || !user || !userRanking) return;

    setReportLoading(true);
    try {
      // Call Cloud Function to get report data
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

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Title
      doc.setFontSize(20);
      doc.setTextColor(75, 0, 130);
      doc.text('Reporte de Desempeno', margin, y);
      y += 10;

      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text(report.sessionTitle || 'ML2 Master Game', margin, y);
      y += 15;

      // Player Info
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

      // Round Scores
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

      // Strong Concepts
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
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, margin + 5, y);
            y += 5;
          });
        });
        y += 8;
      }

      // Areas for Improvement
      if (report.summary.improvements.length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(14);
        doc.setTextColor(220, 20, 60);
        doc.text('Areas de Mejora:', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        report.summary.improvements.slice(0, 5).forEach((improvement) => {
          const lines = doc.splitTextToSize(`* ${improvement}`, pageWidth - 2 * margin);
          lines.forEach((line: string) => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, margin + 5, y);
            y += 5;
          });
        });
        y += 8;
      }

      // Concepts Identified
      if (report.summary.conceptsIdentified.length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(14);
        doc.setTextColor(128, 0, 128);
        doc.text('Conceptos Evaluados:', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const conceptsText = report.summary.conceptsIdentified.join(', ');
        const lines = doc.splitTextToSize(conceptsText, pageWidth - 2 * margin);
        lines.forEach((line: string) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin + 5, y);
          y += 5;
        });
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, margin, 285);

      // Save
      const fileName = `reporte_${(user.displayName || 'estudiante').replace(/\s+/g, '_')}_ML2.pdf`;
      doc.save(fileName);

    } catch (err) {
      console.error('Report error:', err);
      alert('Error al generar el reporte. Por favor intenta de nuevo.');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading || loadingRankings) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Calculando resultados finales...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400">{error || 'Error al cargar resultados'}</p>
          <Link to="/" className="text-cyan-400 hover:underline mt-4 inline-block">
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
        <h1 className="text-2xl font-bold">{game.sessionConfig?.title || 'Sesion'}</h1>
        <p className="text-white/50">Resultados Finales</p>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Podium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center items-end gap-4 h-64 mb-8"
        >
          {/* Second Place */}
          {topThree[1] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mb-2 border-4 border-gray-300">
                <span className="text-2xl font-bold">2</span>
              </div>
              <p className="font-medium text-center text-sm mb-2 max-w-24 truncate">
                {topThree[1].playerName}
              </p>
              <div className="w-24 h-32 bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-lg flex items-center justify-center">
                <span className="text-2xl font-bold">{topThree[1].totalScore}</span>
              </div>
            </motion.div>
          )}

          {/* First Place */}
          {topThree[0] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <Trophy className="w-10 h-10 text-yellow-400 mb-2" />
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mb-2 border-4 border-yellow-300 shadow-lg shadow-yellow-500/30">
                <span className="text-3xl font-bold text-black">1</span>
              </div>
              <p className="font-bold text-center mb-2 max-w-28 truncate">
                {topThree[0].playerName}
              </p>
              <div className="w-28 h-44 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t-lg flex items-center justify-center shadow-lg">
                <span className="text-3xl font-bold text-black">{topThree[0].totalScore}</span>
              </div>
            </motion.div>
          )}

          {/* Third Place */}
          {topThree[2] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="w-18 h-18 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center mb-2 border-4 border-amber-500 w-16 h-16">
                <span className="text-xl font-bold">3</span>
              </div>
              <p className="font-medium text-center text-sm mb-2 max-w-20 truncate">
                {topThree[2].playerName}
              </p>
              <div className="w-20 h-24 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t-lg flex items-center justify-center">
                <span className="text-xl font-bold">{topThree[2].totalScore}</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* User's Result */}
        {userRanking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-cyan-400" />
              Tu Resultado Final
            </h2>

            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-3xl font-bold text-cyan-400">#{userRanking.rank}</p>
                <p className="text-sm text-white/50">Posicion</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-3xl font-bold">{userRanking.totalScore}</p>
                <p className="text-sm text-white/50">Puntaje Total</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-3xl font-bold">
                  {Math.round(userRanking.totalScore / (userRanking.roundScores.length || 1))}
                </p>
                <p className="text-sm text-white/50">Promedio</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-white/50 mb-2">Puntaje por ronda:</p>
              <div className="flex gap-2">
                {userRanking.roundScores.map((score, i) => (
                  <div
                    key={i}
                    className={`flex-1 p-2 rounded text-center ${
                      score >= 80
                        ? 'bg-green-500/20 text-green-400'
                        : score >= 60
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    <p className="text-xs text-white/50">R{i + 1}</p>
                    <p className="font-bold">{score || '-'}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadReport}
              disabled={reportLoading}
              className="w-full p-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
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

        {/* Full Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="dramatic-card p-6"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Medal className="w-5 h-5 text-purple-400" />
            Ranking Completo
          </h2>

          <div className="space-y-2">
            {finalRankings.map((player) => (
              <div
                key={player.playerId}
                className={`flex items-center gap-4 p-3 rounded-lg ${
                  player.playerId === user?.uid
                    ? 'bg-cyan-500/20 border border-cyan-500/30'
                    : 'bg-white/5'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
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

                <span className="flex-1 font-medium truncate">
                  {player.playerName}
                  {player.playerId === user?.uid && (
                    <span className="text-cyan-400 text-sm ml-2">(Tu)</span>
                  )}
                </span>

                <div className="flex gap-1">
                  {player.roundScores.map((score, i) => (
                    <span
                      key={i}
                      className="text-xs text-white/50 w-8 text-center"
                    >
                      {score || '-'}
                    </span>
                  ))}
                </div>

                <span className="font-mono font-bold text-lg w-12 text-right">
                  {player.totalScore}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Professor Class Report Button */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Panel del Profesor
            </h2>
            <p className="text-white/60 text-sm mb-4">
              Como profesor, puedes ver el reporte completo de la clase con estadisticas detalladas de todos los estudiantes.
            </p>
            <Link
              to={`/professor/report/${gameCode}`}
              className="w-full p-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <FileText className="w-5 h-5" />
              Ver Reporte de Clase
            </Link>
          </motion.div>
        )}

        {/* Return Home Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center pb-8"
        >
          <Link to="/" className="primary-button inline-flex items-center gap-2">
            <Home className="w-5 h-5" />
            Volver al Inicio
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
