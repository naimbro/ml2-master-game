import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, LayoutGroup } from 'framer-motion';
import { Trophy, TrendingUp, ArrowRight, MessageSquare, Info, Code, CheckCircle, XCircle, Zap } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { playScoreReveal, playGoodScore, playBadScore, playDrumRoll, playTensionSweep, playRankReveal } from '../../lib/sounds';
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
  // Leaderboard phases: show → swap (names move) → reveal (details cascade) → done
  const [lbPhase, setLbPhase] = useState<'show' | 'swap' | 'reveal' | 'done'>('show');
  const [revealedCount, setRevealedCount] = useState(0);
  const leaderboardSoundPlayed = useRef(false);

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

      // Last round: skip leaderboard, go straight to podium
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
      .sort((a, b) => b.avgScore - a.avgScore)
      .map((player, index) => ({ ...player, rank: index + 1 }));

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

  // Leaderboard: animated top 10 + user position, full list after
  // No cleanup — timers must survive dependency ref changes from Firestore updates
  const TOP_N = 10;
  useEffect(() => {
    if (cumulativeRankings.length > 0 && !leaderboardSoundPlayed.current) {
      leaderboardSoundPlayed.current = true;
      const showN = Math.min(cumulativeRankings.length, TOP_N);

      // Phase 1 "show": previous order visible (2s)
      setTimeout(() => playDrumRoll(), 500);

      // Phase 2 "swap": names MOVE — slow spring for maximum suspense
      setTimeout(() => {
        setLbPhase('swap');
        playTensionSweep();
      }, 2200);

      // Phase 3 "reveal": cascade top N from bottom (after tween + pause)
      let t = 6500; // 2.2s show + 3s tween + 1.3s pause to absorb
      setTimeout(() => setLbPhase('reveal'), t);
      for (let step = 1; step <= showN; step++) {
        const rank = showN - step + 1;
        const isPodium = rank <= 3;
        setTimeout(() => {
          setRevealedCount(step);
          playRankReveal(rank, showN);
        }, t);
        t += isPodium ? 800 : 200;
        if (rank === 2) t += 500;
      }

      // Phase 4 "done"
      setTimeout(() => setLbPhase('done'), t + 300);
    }
  }, [cumulativeRankings]);

  const numPlayers = cumulativeRankings.length;
  const hasPrevData = rankedRoundsPlayed > 1;
  const topN = Math.min(numPlayers, TOP_N);

  // Top N for animated leaderboard
  const topRankings = cumulativeRankings.slice(0, topN);
  const topInitial = initialRankings.filter(p =>
    topRankings.some(t => t.playerId === p.playerId)
  );
  const displayTop = lbPhase === 'show' ? topInitial : topRankings;
  const isDetailRevealed = (rank: number) => revealedCount > 0 && rank > topN - revealedCount;
  const lastRevealedRank = topN > 0 ? topN - revealedCount + 1 : 0;
  const allRevealed = lbPhase === 'done';
  const userInTop = topRankings.some(p => p.playerId === user?.uid);
  const userRankingEntry = cumulativeRankings.find(p => p.playerId === user?.uid);

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
  const isMCRound = currentScenario?.type === 'multiple_choice';

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

      {/* Full-Screen Dramatic Leaderboard (ranked rounds only) — shown first for impact */}
      {roundResults && game.players && isRankedRound && (
        <div className="min-h-[80vh] flex flex-col justify-center py-8 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-black mb-2 text-center flex items-center justify-center gap-3">
              <TrendingUp className="w-8 h-8 text-kahoot-green" />
              {numPlayers > TOP_N ? `Top ${TOP_N}` : 'Ranking'}
            </h2>
            <p className="text-white/40 text-sm font-bold text-center mb-8 uppercase tracking-widest">
              {allRevealed ? 'Posiciones actualizadas'
                : lbPhase === 'swap' ? 'Actualizando posiciones...'
                : lbPhase === 'reveal' || revealedCount > 0 ? 'Revelando resultados...'
                : hasPrevData ? 'Ranking anterior' : 'Calculando ranking...'}
            </p>

            {/* Column Headers */}
            <div className="flex items-center gap-4 px-4 py-2 text-[10px] text-white/50 uppercase tracking-widest font-bold border-b border-white/10 mb-3 max-w-2xl mx-auto">
              <div className="w-12"></div>
              <span className="flex-1">Jugador</span>
              <span className="w-16 text-right">Ronda</span>
              <span className="w-16 text-right">Prom</span>
            </div>

            {/* Animated Top N */}
            <LayoutGroup>
              <div className="space-y-2 max-w-2xl mx-auto">
                {displayTop.map((player) => {
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
                      layout
                      transition={{ layout: { type: 'tween', duration: 3, ease: [0.4, 0, 0.2, 1] } }}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ${
                        isSpotlight
                          ? 'bg-kahoot-green/25 border-2 border-kahoot-green/50 shadow-lg shadow-kahoot-green/20 scale-[1.02]'
                          : player.playerId === user?.uid
                          ? 'bg-kahoot-green/15 border-2 border-kahoot-green/30'
                          : 'bg-white/5 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <motion.div
                          layout
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors duration-500 ${
                            !revealed
                              ? showingPrev ? 'bg-white/15' : 'bg-white/10'
                              : player.rank === 1
                              ? 'bg-yellow-500 text-black'
                              : player.rank === 2
                              ? 'bg-gray-400 text-black'
                              : player.rank === 3
                              ? 'bg-amber-600 text-black'
                              : 'bg-white/20'
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
                            <span className={showingPrev ? 'text-white/60' : ''}>
                              {displayRank}
                            </span>
                          )}
                        </motion.div>
                        {showDelta && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
                            className={`text-xs font-black ${delta > 0 ? 'text-kahoot-green' : 'text-kahoot-red'}`}
                          >
                            {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                          </motion.span>
                        )}
                      </div>

                      {/* Names ALWAYS fully visible — watching them move is the drama */}
                      <span className="flex-1 font-bold text-lg truncate">
                        {player.playerName}
                        {player.playerId === user?.uid && (
                          <span className="text-kahoot-green text-sm ml-2 font-bold">(Tu)</span>
                        )}
                      </span>

                      <span className={`w-16 text-right font-mono font-bold transition-all duration-300 ${
                        revealed
                          ? player.roundScore >= 80 ? 'text-kahoot-green' :
                            player.roundScore >= 60 ? 'text-kahoot-yellow' : 'text-kahoot-red'
                          : 'text-white/20'
                      }`}>
                        {revealed ? (
                          <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            +{player.roundScore}
                          </motion.span>
                        ) : '...'}
                      </span>

                      <motion.span
                        layout
                        className={`w-16 text-right font-mono font-black text-xl transition-all duration-500 ${
                          revealed ? 'opacity-100' : showingPrev ? 'opacity-50' : 'opacity-20'
                        }`}
                      >
                        {revealed ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          >
                            {player.avgScore}
                          </motion.span>
                        ) : displayAvg}
                      </motion.span>
                    </motion.div>
                  );
                })}
              </div>
            </LayoutGroup>

            {/* User position card if outside top N */}
            {allRevealed && !userInTop && userRankingEntry && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-2xl mx-auto mt-4"
              >
                <div className="text-center text-white/30 text-xs font-bold my-1">· · ·</div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-kahoot-green/15 border-2 border-kahoot-green/30">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">
                    {userRankingEntry.rank}
                  </div>
                  <span className="flex-1 font-bold text-lg truncate">
                    {userRankingEntry.playerName}
                    <span className="text-kahoot-green text-sm ml-2 font-bold">(Tu)</span>
                  </span>
                  <span className={`w-16 text-right font-mono font-bold ${
                    userRankingEntry.roundScore >= 80 ? 'text-kahoot-green' :
                    userRankingEntry.roundScore >= 60 ? 'text-kahoot-yellow' : 'text-kahoot-red'
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
            className="dramatic-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-kahoot-yellow" />
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
                        : userRank.rank === 2 ? 'text-gray-300'
                        : userRank.rank === 3 ? 'text-amber-600'
                        : 'text-white/50'
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
                    : (userSubmission.mcBlockScore || 0) >= 40 ? 'text-kahoot-yellow'
                    : 'text-kahoot-red'
                }`}
              >
                {userSubmission.mcBlockScore || 0}
              </motion.div>
              <p className="text-white/50 text-sm font-bold">Puntaje del Bloque</p>
            </div>

            {userSubmission.mcResponses && currentScenario?.mcQuestions && (
              <div className="space-y-3 max-w-md mx-auto">
                {userSubmission.mcResponses.map((r: { questionIndex: number; correct: boolean; pointsAwarded: number; selectedOptionId: string | null }, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    {r.correct ? (
                      <CheckCircle className="w-6 h-6 text-kahoot-green shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-kahoot-red shrink-0" />
                    )}
                    <span className="text-sm text-white/80 font-medium flex-1 text-left">
                      {currentScenario.mcQuestions![i]?.question?.slice(0, 80)}...
                    </span>
                    <span className="font-mono font-bold text-sm">
                      {r.pointsAwarded}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* User Score Card (open rounds only) */}
        {!isMCRound && userEvaluation && (
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

            {/* Reference Answer */}
            {currentScenario?.referenceAnswer && (
              <details className="mb-4 p-4 bg-white/5 rounded-xl">
                <summary className="text-white/50 font-bold uppercase tracking-wider text-xs cursor-pointer hover:text-white/70">
                  Ver respuesta de referencia
                </summary>
                <p className="text-white/70 text-sm whitespace-pre-wrap font-medium mt-2">
                  {currentScenario.referenceAnswer}
                </p>
              </details>
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
