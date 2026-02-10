import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, ArrowRight, MessageSquare } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

interface JudgeEvaluation {
  judgeName: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export default function Results() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, error, roundResults, isHost, nextRound, submissions } = useGame(gameCode);
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setEvaluationComplete] = useState(false);

  // Navigate based on game status
  useEffect(() => {
    if (game?.status === 'active') {
      navigate(`/game/${gameCode}/round`);
    } else if (game?.status === 'finished') {
      navigate(`/game/${gameCode}/end`);
    }
  }, [game?.status, gameCode, navigate]);

  // Process round if host and not yet processed
  useEffect(() => {
    if (isHost && game?.status === 'round_end' && !roundResults && !isProcessing) {
      processRound();
    }
  }, [isHost, game?.status, roundResults, isProcessing]);

  const processRound = async () => {
    if (!gameCode || !game) return;

    setIsProcessing(true);
    try {
      const processRoundEnd = httpsCallable(functions, 'processRoundEnd');
      await processRoundEnd({ gameCode, round: game.currentRound });
      setEvaluationComplete(true);
    } catch (err) {
      console.error('Process round error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextRound = async () => {
    await nextRound();
  };

  if (loading || isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70 text-lg">
            {isProcessing ? 'Evaluando respuestas con IA...' : 'Cargando resultados...'}
          </p>
          <p className="text-white/50 text-sm mt-2">
            3 jueces AI estan analizando cada respuesta
          </p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400">{error || 'Error al cargar resultados'}</p>
        </div>
      </div>
    );
  }

  // Find current user's submission and evaluation
  const userSubmission = submissions.find(s => s.playerId === user?.uid);
  const userEvaluation = userSubmission?.evaluation;
  const userRank = roundResults?.rankings.find(r => r.playerId === user?.uid);

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <span className="text-white/50 text-sm">Resultados Ronda</span>
            <p className="text-xl font-bold">
              {game.currentRound} / {game.totalRounds}
            </p>
          </div>

          <div className="text-2xl font-mono font-bold text-cyan-400">
            {gameCode}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* User Score Card */}
        {userEvaluation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="dramatic-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Tu Resultado</h2>
              {userRank && (
                <div className="flex items-center gap-2">
                  <Trophy
                    className={`w-6 h-6 ${
                      userRank.rank === 1
                        ? 'text-yellow-400'
                        : userRank.rank === 2
                        ? 'text-gray-300'
                        : userRank.rank === 3
                        ? 'text-amber-600'
                        : 'text-white/50'
                    }`}
                  />
                  <span className="text-lg font-bold">#{userRank.rank}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div className="text-center">
                <div
                  className={`text-5xl font-bold ${
                    userEvaluation.finalScore >= 80
                      ? 'text-green-400'
                      : userEvaluation.finalScore >= 60
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {userEvaluation.finalScore}
                </div>
                <p className="text-white/50 text-sm">Puntaje</p>
              </div>

              <div className="flex-1 space-y-2">
                {userEvaluation.evaluations?.map((evaluation: JudgeEvaluation, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-white/70 w-32 truncate">
                      {evaluation.judgeName}
                    </span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${evaluation.score}%` }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      />
                    </div>
                    <span className="text-sm font-mono w-10 text-right">
                      {evaluation.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback */}
            {userEvaluation.evaluations?.map((evaluation: JudgeEvaluation, i: number) => (
              <div key={i} className="mb-4 p-4 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">{evaluation.judgeName}</span>
                </div>
                <p className="text-white/80 text-sm mb-3">{evaluation.feedback}</p>

                {evaluation.strengths?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-green-400 font-medium">Fortalezas:</span>
                    <ul className="text-xs text-white/60 ml-4 mt-1">
                      {evaluation.strengths.map((s: string, j: number) => (
                        <li key={j}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.improvements?.length > 0 && (
                  <div>
                    <span className="text-xs text-yellow-400 font-medium">Areas de mejora:</span>
                    <ul className="text-xs text-white/60 ml-4 mt-1">
                      {evaluation.improvements.map((s: string, j: number) => (
                        <li key={j}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* Cumulative Leaderboard */}
        {roundResults && game.players && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Ranking Acumulado
            </h2>

            {/* Column Headers */}
            <div className="flex items-center gap-4 px-3 py-2 text-xs text-white/50 uppercase tracking-wide border-b border-white/10 mb-2">
              <div className="w-8"></div>
              <span className="flex-1">Jugador</span>
              <span className="w-20 text-right">Esta Ronda</span>
              <span className="w-20 text-right">Promedio</span>
            </div>

            <div className="space-y-2">
              {(() => {
                // Calculate cumulative rankings
                const cumulativeRankings = Object.entries(game.players)
                  .map(([playerId, player]) => {
                    const roundScore = roundResults.rankings.find(r => r.playerId === playerId)?.score || 0;
                    const totalScore = player.totalScore || 0;
                    const avgScore = game.currentRound > 0 ? totalScore / game.currentRound : 0;
                    return {
                      playerId,
                      playerName: player.name,
                      roundScore,
                      totalScore,
                      avgScore: Math.round(avgScore * 10) / 10,
                    };
                  })
                  .sort((a, b) => b.avgScore - a.avgScore)
                  .map((player, index) => ({ ...player, rank: index + 1 }));

                return cumulativeRankings.map((player, index) => (
                  <motion.div
                    key={player.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
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

                    <span className="flex-1 font-medium">
                      {player.playerName}
                      {player.playerId === user?.uid && (
                        <span className="text-cyan-400 text-sm ml-2">(Tú)</span>
                      )}
                    </span>

                    <span className={`w-20 text-right font-mono text-sm ${
                      player.roundScore >= 80 ? 'text-green-400' :
                      player.roundScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      +{player.roundScore}
                    </span>

                    <span className="w-20 text-right font-mono font-bold text-lg">
                      {player.avgScore}
                    </span>
                  </motion.div>
                ));
              })()}
            </div>
          </motion.div>
        )}

        {/* Next Round Button (Host only) */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <button onClick={handleNextRound} className="primary-button px-8 py-4 text-lg">
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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/70">
                Esperando la siguiente ronda...
              </span>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
