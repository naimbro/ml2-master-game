import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  Users,
  Trophy,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import jsPDF from 'jspdf';

interface PlayerReport {
  playerId: string;
  name: string;
  rank: number;
  averageScore: number;
  totalScore: number;
  roundScores: Record<number, number>;
  roundDetails: Array<{
    round: number;
    score: number;
    strengths: string[];
    improvements: string[];
  }>;
}

interface ClassReportData {
  gameCode: string;
  sessionTitle: string;
  totalRounds: number;
  totalPlayers: number;
  classAverage: number;
  distribution: {
    excellent: number;
    good: number;
    average: number;
    needsWork: number;
  };
  roundAverages: Record<number, number>;
  topImprovementAreas: Array<{ area: string; count: number }>;
  players: PlayerReport[];
  scenarios: Array<{ round: number; title: string; category?: string }>;
}

export default function ClassReport() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const { user } = useAuth();
  const [report, setReport] = useState<ClassReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!gameCode || !user) return;

    const fetchReport = async () => {
      try {
        const generateReport = httpsCallable(functions, 'generateClassReport');
        const result = await generateReport({ gameCode });
        const data = result.data as { success: boolean; report: ClassReportData };

        if (data.success) {
          setReport(data.report);
        } else {
          setError('Error al generar el reporte');
        }
      } catch (err) {
        console.error('Error fetching report:', err);
        setError('Error al cargar el reporte. Verifica que seas el profesor del juego.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [gameCode, user]);

  const handleDownloadPdf = async () => {
    if (!report) return;

    setDownloadingPdf(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Title
      doc.setFontSize(18);
      doc.setTextColor(75, 0, 130);
      doc.text('Reporte de Clase', margin, y);
      y += 8;

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(report.sessionTitle, margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.text(`Codigo: ${report.gameCode} | Fecha: ${new Date().toLocaleDateString('es-CL')}`, margin, y);
      y += 12;

      // Summary stats
      doc.setFontSize(14);
      doc.setTextColor(0, 102, 204);
      doc.text('Resumen General', margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Estudiantes: ${report.totalPlayers}`, margin, y);
      y += 5;
      doc.text(`Promedio de Clase: ${report.classAverage}/100`, margin, y);
      y += 5;
      doc.text(`Total Rondas: ${report.totalRounds}`, margin, y);
      y += 10;

      // Distribution
      doc.setFontSize(12);
      doc.setTextColor(0, 102, 204);
      doc.text('Distribucion de Puntajes:', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`  Excelente (90+): ${report.distribution.excellent} estudiantes`, margin, y);
      y += 5;
      doc.text(`  Bueno (75-89): ${report.distribution.good} estudiantes`, margin, y);
      y += 5;
      doc.text(`  Regular (60-74): ${report.distribution.average} estudiantes`, margin, y);
      y += 5;
      doc.text(`  Necesita Mejora (<60): ${report.distribution.needsWork} estudiantes`, margin, y);
      y += 12;

      // Round averages
      doc.setFontSize(12);
      doc.setTextColor(0, 102, 204);
      doc.text('Promedio por Ronda:', margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      Object.entries(report.roundAverages).forEach(([round, avg]) => {
        const scenario = report.scenarios.find(s => s.round === Number(round));
        doc.text(`  Ronda ${round}: ${avg}/100 - ${scenario?.title || ''}`, margin, y);
        y += 5;
      });
      y += 8;

      // Top improvement areas
      if (report.topImprovementAreas.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(220, 20, 60);
        doc.text('Areas de Mejora Comunes:', margin, y);
        y += 6;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        report.topImprovementAreas.slice(0, 5).forEach(({ area, count }) => {
          const lines = doc.splitTextToSize(`  - ${area} (${count} estudiantes)`, pageWidth - 2 * margin);
          lines.forEach((line: string) => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, margin, y);
            y += 5;
          });
        });
        y += 8;
      }

      // Rankings table
      doc.addPage();
      y = 20;
      doc.setFontSize(14);
      doc.setTextColor(0, 102, 204);
      doc.text('Ranking de Estudiantes', margin, y);
      y += 10;

      // Table header
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Pos', margin, y);
      doc.text('Estudiante', margin + 15, y);
      doc.text('Promedio', margin + 80, y);
      doc.text('Puntajes por Ronda', margin + 105, y);
      y += 6;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // Table rows
      doc.setTextColor(0, 0, 0);
      report.players.forEach((player) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.text(`#${player.rank}`, margin, y);
        doc.text(player.name.substring(0, 25), margin + 15, y);
        doc.text(`${player.averageScore}`, margin + 80, y);

        const roundScoresText = Object.entries(player.roundScores)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([r, s]) => `R${r}:${s}`)
          .join(' ');
        doc.text(roundScoresText.substring(0, 40), margin + 105, y);
        y += 6;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `Aula Maestra - Pagina ${i} de ${pageCount}`,
          pageWidth / 2,
          290,
          { align: 'center' }
        );
      }

      // Save
      const fileName = `reporte_clase_${report.gameCode}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (err) {
      console.error('PDF error:', err);
      alert('Error al generar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Generando reporte de clase...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Error al cargar el reporte'}</p>
          <Link to="/professor" className="text-cyan-400 hover:underline">
            Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link
            to="/professor"
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al panel
          </Link>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 rounded-lg transition-colors"
          >
            {downloadingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Descargar PDF
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">{report.sessionTitle}</h1>
          <p className="text-white/60">
            Codigo: <span className="font-mono text-cyan-400">{report.gameCode}</span>
            {' | '}
            {report.totalPlayers} estudiantes | {report.totalRounds} rondas
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-4 gap-4 mb-8"
        >
          <div className="dramatic-card p-6 text-center">
            <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-3xl font-bold">{report.totalPlayers}</p>
            <p className="text-white/50 text-sm">Estudiantes</p>
          </div>

          <div className="dramatic-card p-6 text-center">
            <BarChart3 className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-3xl font-bold">{report.classAverage}</p>
            <p className="text-white/50 text-sm">Promedio Clase</p>
          </div>

          <div className="dramatic-card p-6 text-center">
            <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-3xl font-bold">{report.distribution.excellent + report.distribution.good}</p>
            <p className="text-white/50 text-sm">Sobre 75 pts</p>
          </div>

          <div className="dramatic-card p-6 text-center">
            <TrendingDown className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-3xl font-bold">{report.distribution.needsWork}</p>
            <p className="text-white/50 text-sm">Bajo 60 pts</p>
          </div>
        </motion.div>

        {/* Distribution & Round Averages */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-lg font-bold mb-4">Distribucion de Puntajes</h2>
            <div className="space-y-3">
              {[
                { label: 'Excelente (90+)', count: report.distribution.excellent, color: 'bg-green-500' },
                { label: 'Bueno (75-89)', count: report.distribution.good, color: 'bg-cyan-500' },
                { label: 'Regular (60-74)', count: report.distribution.average, color: 'bg-yellow-500' },
                { label: 'Necesita Mejora (<60)', count: report.distribution.needsWork, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-white/70 w-40">{item.label}</span>
                  <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${report.totalPlayers > 0 ? (item.count / report.totalPlayers) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Round Averages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-lg font-bold mb-4">Promedio por Ronda</h2>
            <div className="space-y-3">
              {report.scenarios.map((scenario) => {
                const avg = report.roundAverages[scenario.round] || 0;
                return (
                  <div key={scenario.round} className="flex items-center gap-3">
                    <span className="text-sm text-white/70 w-8">R{scenario.round}</span>
                    <div className="flex-1">
                      <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${avg >= 75 ? 'bg-green-500' : avg >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${avg}%` }}
                        />
                      </div>
                      <p className="text-xs text-white/50 mt-1 truncate">{scenario.title}</p>
                    </div>
                    <span className="font-mono text-sm w-10 text-right">{avg}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Top Improvement Areas */}
        {report.topImprovementAreas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="dramatic-card p-6 mb-8"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Areas de Mejora Comunes
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {report.topImprovementAreas.map(({ area, count }) => (
                <div key={area} className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg">
                  <span className="text-yellow-400 font-bold">{count}</span>
                  <span className="text-sm text-white/80">{area}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="dramatic-card p-6"
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Ranking de Estudiantes
          </h2>

          {/* Table Header */}
          <div className="hidden md:flex items-center gap-4 px-4 py-2 text-xs text-white/50 uppercase tracking-wide border-b border-white/10 mb-2">
            <div className="w-12">Pos</div>
            <div className="flex-1">Estudiante</div>
            <div className="w-20 text-right">Promedio</div>
            {[...Array(report.totalRounds)].map((_, i) => (
              <div key={i} className="w-12 text-center">R{i + 1}</div>
            ))}
            <div className="w-8"></div>
          </div>

          {/* Players */}
          <div className="space-y-2">
            {report.players.map((player) => (
              <div key={player.playerId}>
                <div
                  className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                    expandedPlayer === player.playerId ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => setExpandedPlayer(expandedPlayer === player.playerId ? null : player.playerId)}
                >
                  {/* Rank */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
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

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{player.name}</p>
                    <p className="text-xs text-white/50 md:hidden">
                      Promedio: {player.averageScore}
                    </p>
                  </div>

                  {/* Average */}
                  <div
                    className={`hidden md:block w-20 text-right font-mono font-bold ${
                      player.averageScore >= 80
                        ? 'text-green-400'
                        : player.averageScore >= 60
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {player.averageScore}
                  </div>

                  {/* Round Scores */}
                  {[...Array(report.totalRounds)].map((_, i) => {
                    const score = player.roundScores[i + 1];
                    return (
                      <div
                        key={i}
                        className={`hidden md:block w-12 text-center font-mono text-sm ${
                          score === undefined
                            ? 'text-white/30'
                            : score >= 80
                            ? 'text-green-400'
                            : score >= 60
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {score ?? '-'}
                      </div>
                    );
                  })}

                  {/* Expand Icon */}
                  <div className="w-8 flex justify-center">
                    {expandedPlayer === player.playerId ? (
                      <ChevronUp className="w-5 h-5 text-white/50" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/50" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedPlayer === player.playerId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-4 pb-4"
                  >
                    <div className="p-4 bg-white/5 rounded-lg mt-2 space-y-4">
                      {player.roundDetails.map((rd) => (
                        <div key={rd.round} className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">
                              Ronda {rd.round}: {report.scenarios[rd.round - 1]?.title}
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                rd.score >= 80 ? 'text-green-400' : rd.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                              }`}
                            >
                              {rd.score} pts
                            </span>
                          </div>

                          {rd.strengths.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-green-400 font-medium mb-1">Fortalezas:</p>
                              <ul className="text-xs text-white/60 ml-4">
                                {rd.strengths.slice(0, 3).map((s, i) => (
                                  <li key={i}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {rd.improvements.length > 0 && (
                            <div>
                              <p className="text-xs text-yellow-400 font-medium mb-1">Areas de mejora:</p>
                              <ul className="text-xs text-white/60 ml-4">
                                {rd.improvements.slice(0, 3).map((s, i) => (
                                  <li key={i}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
