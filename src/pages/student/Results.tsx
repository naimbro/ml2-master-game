import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, ArrowRight, MessageSquare, Info, Code } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { playScoreReveal, playGoodScore, playBadScore, playLeaderboardTick } from '../../lib/sounds';
import { confettiBurst, confettiCannons } from '../../lib/confetti';

interface JudgeEvaluation {
  judgeName: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  promptUsed?: string;
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

  const handleEndGame = async () => {
    if (!window.confirm('Terminar el juego ahora? Se mostrara el podio final con los resultados hasta esta ronda.')) return;
    await endGame();
  };

  if (loading || isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-kahoot-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/80 text-lg font-bold">
            {isProcessing ? 'Evaluando respuestas con IA...' : 'Cargando resultados...'}
          </p>
          <p className="text-white/50 text-sm mt-2 font-medium">
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
          <p className="text-red-400 font-semibold">{error || 'Error al cargar resultados'}</p>
        </div>
      </div>
    );
  }

  // Find current user's submission and evaluation
  const userSubmission = submissions.find(s => s.playerId === user?.uid);
  const userEvaluation = userSubmission?.evaluation;
  const userRank = roundResults?.rankings.find(r => r.playerId === user?.uid);
  const isRankedRound = game?.scenarios?.[game.currentRound - 1]?.ranked !== false;

  // Judge bar colors (Kahoot answer colors)
  const JUDGE_COLORS = ['bg-kahoot-red', 'bg-kahoot-blue', 'bg-kahoot-green'];

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 border-b-2 border-white/10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Resultados Ronda</span>
            <p className="text-xl font-black">
              {game.currentRound} <span className="text-white/40 font-bold">/ {game.totalRounds}</span>
            </p>
          </div>

          <div className="text-2xl font-black tracking-wider text-white/60">
            {gameCode}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* User Score Card */}
        {userEvaluation && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="dramatic-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">Tu Resultado</h2>
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
                        ? 'text-gray-300'
                        : userRank.rank === 3
                        ? 'text-amber-600'
                        : 'text-white/50'
                    }`}
                  />
                  <span className="text-lg font-black">#{userRank.rank}</span>
                </motion.div>
              )}
              {!isRankedRound && (
                <span className="px-3 py-1 bg-kahoot-orange/25 text-orange-200 rounded-full text-xs font-bold uppercase tracking-wider">
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
                    userEvaluation.finalScore >= 80
                      ? 'text-kahoot-green'
                      : userEvaluation.finalScore >= 60
                      ? 'text-kahoot-yellow'
                      : 'text-kahoot-red'
                  }`}
                >
                  {userEvaluation.finalScore}
                </motion.div>
                <p className="text-white/50 text-sm font-bold">Puntaje</p>
              </div>

              <div className="flex-1 space-y-3">
                {userEvaluation.evaluations?.map((evaluation: JudgeEvaluation, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-white/70 w-32 truncate font-semibold">
                      {evaluation.judgeName}
                    </span>
                    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
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
              <div className="mb-4 p-4 bg-white/5 rounded-xl">
                <p className="text-sm text-white/50 mb-2 font-bold uppercase tracking-wider text-xs">Tu respuesta:</p>
                <p className="text-white/80 text-sm whitespace-pre-wrap font-medium">{userSubmission.response}</p>
              </div>
            )}

            {/* Feedback */}
            {userEvaluation.evaluations?.map((evaluation: JudgeEvaluation, i: number) => (
              <div key={i} className="mb-4 p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className={`w-4 h-4 ${
                    i === 0 ? 'text-kahoot-red' : i === 1 ? 'text-kahoot-blue' : 'text-kahoot-green'
                  }`} />
                  <span className="font-bold">{evaluation.judgeName}</span>
                </div>
                <p className="text-white/80 text-sm mb-3 font-medium">{evaluation.feedback}</p>

                {evaluation.strengths?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-kahoot-green font-bold uppercase tracking-wider">Fortalezas:</span>
                    <ul className="text-xs text-white/60 ml-4 mt-1 font-medium">
                      {evaluation.strengths.map((s: string, j: number) => (
                        <li key={j}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.improvements?.length > 0 && (
                  <div>
                    <span className="text-xs text-kahoot-orange font-bold uppercase tracking-wider">Areas de mejora:</span>
                    <ul className="text-xs text-white/60 ml-4 mt-1 font-medium">
                      {evaluation.improvements.map((s: string, j: number) => (
                        <li key={j}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prompt viewer (host only) */}
                {evaluation.promptUsed && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => setExpandedPrompts(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors font-semibold"
                    >
                      <Code className="w-3 h-3" />
                      {expandedPrompts[i] ? 'Ocultar Prompt' : 'Ver Prompt'}
                    </button>
                    {expandedPrompts[i] && (
                      <pre className="mt-2 p-3 bg-black/30 rounded-lg text-[10px] text-white/50 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                        {evaluation.promptUsed}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* Cumulative Leaderboard (ranked rounds only) */}
        {roundResults && game.players && isRankedRound && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="dramatic-card p-6"
          >
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-kahoot-green" />
              Ranking Acumulado
            </h2>

            {/* Column Headers */}
            <div className="flex items-center gap-4 px-3 py-2 text-[10px] text-white/50 uppercase tracking-widest font-bold border-b border-white/10 mb-2">
              <div className="w-8"></div>
              <span className="flex-1">Jugador</span>
              <span className="w-20 text-right">Esta Ronda</span>
              <span className="w-20 text-right">Promedio</span>
            </div>

            <div className="space-y-2">
              {(() => {
                const cumulativeRankings = Object.entries(game.players)
                  .map(([playerId, player]) => {
                    const roundScore = roundResults.rankings.find(r => r.playerId === playerId)?.score || 0;
                    const totalScore = player.totalScore || 0;
                    const rankedRoundsPlayed = game.scenarios
                      ?.slice(0, game.currentRound)
                      .filter((s: { ranked?: boolean }) => s.ranked !== false).length || 1;
                    const avgScore = rankedRoundsPlayed > 0 ? totalScore / rankedRoundsPlayed : 0;
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
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.06 }}
                    onAnimationStart={() => setTimeout(() => playLeaderboardTick(index), (0.3 + index * 0.06) * 1000)}
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

                    <span className={`w-20 text-right font-mono font-bold text-sm ${
                      player.roundScore >= 80 ? 'text-kahoot-green' :
                      player.roundScore >= 60 ? 'text-kahoot-yellow' : 'text-kahoot-red'
                    }`}>
                      +{player.roundScore}
                    </span>

                    <span className="w-20 text-right font-mono font-black text-lg">
                      {player.avgScore}
                    </span>
                  </motion.div>
                ));
              })()}
            </div>
          </motion.div>
        )}

        {/* Diagnostic message for non-ranked rounds */}
        {roundResults && !isRankedRound && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="dramatic-card p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <Info className="w-5 h-5 text-kahoot-orange" />
              <h2 className="text-lg font-black text-orange-200">Ronda Diagnostica</h2>
            </div>
            <p className="text-white/60 text-sm font-medium">
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
                className="px-6 py-5 text-lg font-bold rounded-xl bg-red-600/20 text-red-300 border-2 border-red-500/30 hover:bg-red-600/40 hover:border-red-500/50 transition-all"
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
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 rounded-full">
              <div className="w-2 h-2 bg-kahoot-green rounded-full animate-pulse" />
              <span className="text-white/70 font-semibold">
                Esperando la siguiente ronda...
              </span>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
