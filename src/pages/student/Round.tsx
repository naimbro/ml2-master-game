import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { MCResponse } from '../../types/game';

// Kahoot-style colors for MC options
const MC_COLORS = [
  { bg: 'bg-red-600', hover: 'hover:bg-red-500', border: 'border-red-400', selected: 'bg-red-500 ring-4 ring-red-300' },
  { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', border: 'border-blue-400', selected: 'bg-blue-500 ring-4 ring-blue-300' },
  { bg: 'bg-yellow-600', hover: 'hover:bg-yellow-500', border: 'border-yellow-400', selected: 'bg-yellow-500 ring-4 ring-yellow-300' },
  { bg: 'bg-green-600', hover: 'hover:bg-green-500', border: 'border-green-400', selected: 'bg-green-500 ring-4 ring-green-300' },
];

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

  // MC block state
  const [mcCurrentQ, setMcCurrentQ] = useState(0);
  const [mcResponses, setMcResponses] = useState<MCResponse[]>([]);
  const [mcQuestionStart, setMcQuestionStart] = useState<number>(0);
  const [mcQuestionTimeLeft, setMcQuestionTimeLeft] = useState(0);
  const [mcSelectedOption, setMcSelectedOption] = useState<string | null>(null);
  const [mcShowFeedback, setMcShowFeedback] = useState(false);
  const [mcBlockDone, setMcBlockDone] = useState(false);
  const [mcBlockScore, setMcBlockScore] = useState(0);
  const mcTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // Auto-submit incomplete MC block before navigating away
      if (currentScenarioRef.current?.type === 'multiple_choice' && !hasSubmitted && mcResponses.length > 0) {
        const totalPoints = mcResponses.reduce((sum, r) => sum + r.pointsAwarded, 0);
        const blockScore = Math.round(totalPoints / mcResponses.length);
        submitMCBlock(mcResponses, blockScore);
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

  useEffect(() => {
    if (!isMC || !mcQuestions || hasSubmitted || mcBlockDone) return;
    if (mcCurrentQ >= mcQuestions.length) return;

    const timeLimit = mcQuestions[mcCurrentQ].timeLimitSeconds;
    setMcQuestionTimeLeft(timeLimit);
    setMcQuestionStart(Date.now());
    setMcSelectedOption(null);
    setMcShowFeedback(false);

    mcTimerRef.current = setInterval(() => {
      setMcQuestionTimeLeft(prev => {
        if (prev <= 1) {
          if (mcTimerRef.current) clearInterval(mcTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (mcTimerRef.current) clearInterval(mcTimerRef.current);
    };
  }, [isMC, mcCurrentQ, hasSubmitted, mcBlockDone]);

  // MC: auto-timeout when question timer hits 0
  useEffect(() => {
    if (!isMC || !mcQuestions || mcShowFeedback || mcSelectedOption !== null) return;
    if (mcQuestionTimeLeft === 0 && mcCurrentQ < mcQuestions.length && !mcBlockDone && !hasSubmitted) {
      handleMCSelect(null);
    }
  }, [mcQuestionTimeLeft, isMC, mcShowFeedback, mcSelectedOption, mcBlockDone, hasSubmitted]);

  const handleMCSelect = useCallback((optionId: string | null) => {
    if (!mcQuestions || mcShowFeedback || mcBlockDone || hasSubmitted) return;
    if (mcTimerRef.current) clearInterval(mcTimerRef.current);

    const q = mcQuestions[mcCurrentQ];
    const responseTimeMs = Date.now() - mcQuestionStart;
    const correct = optionId !== null && q.options.findIndex(o => o.id === optionId) === q.correctOptionIndex;

    let pointsAwarded = 0;
    if (correct) {
      const speedBonus = Math.floor(20 * Math.max(0, 1 - (responseTimeMs / 1000) / q.timeLimitSeconds));
      pointsAwarded = 80 + speedBonus;
    }

    const mcResponse: MCResponse = {
      questionIndex: mcCurrentQ,
      selectedOptionId: optionId,
      responseTimeMs,
      correct,
      pointsAwarded,
    };

    setMcSelectedOption(optionId);
    setMcShowFeedback(true);

    if (correct) {
      playSubmitSuccess();
      confettiPop();
    } else {
      playBadScore();
    }

    const newResponses = [...mcResponses, mcResponse];
    setMcResponses(newResponses);

    // After 2.5s pause, go to next question or finish
    setTimeout(() => {
      if (mcCurrentQ + 1 < mcQuestions.length) {
        setMcCurrentQ(mcCurrentQ + 1);
      } else {
        // Block done — calculate score and submit
        const totalPoints = newResponses.reduce((sum, r) => sum + r.pointsAwarded, 0);
        const blockScore = Math.round(totalPoints / newResponses.length);
        setMcBlockScore(blockScore);
        setMcBlockDone(true);
        submitMCBlock(newResponses, blockScore);
        setHasSubmitted(true);

        if (blockScore >= 80) {
          playGoodScore();
          confettiBurst();
        }
      }
    }, 2500);
  }, [mcQuestions, mcCurrentQ, mcQuestionStart, mcShowFeedback, mcBlockDone, hasSubmitted, mcResponses, submitMCBlock]);

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
          <p className="text-white/70 font-semibold">Cargando ronda...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-kahoot-red mx-auto mb-4" />
          <p className="text-red-300 mb-4 font-semibold">{error || 'Error al cargar el juego'}</p>
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
      <header className="sticky top-0 z-10 bg-[#2D1065]/90 backdrop-blur-sm border-b-2 border-white/10 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Ronda</span>
              <p className="text-xl font-black">
                {game.currentRound} <span className="text-white/40 font-bold">/ {game.totalRounds}</span>
              </p>
            </div>

            {/* Dramatic Timer */}
            <motion.div
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-lg ${
                isLowTime
                  ? 'bg-kahoot-red/30 text-kahoot-red border-2 border-kahoot-red/50'
                  : 'bg-white/10 text-white border-2 border-white/15'
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
              <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Respuestas</span>
              <p className="text-xl font-black text-kahoot-green">
                {submissions.length} <span className="text-white/40 font-bold">/ {Object.keys(game.players || {}).length}</span>
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
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
                className="flex items-center gap-2 px-4 py-2 bg-kahoot-red/80 hover:bg-kahoot-red text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50"
              >
                {endingRound ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            <Info className="w-5 h-5 text-kahoot-orange shrink-0" />
            <p className="text-orange-200 text-sm font-semibold">
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
              <div className="dramatic-card p-6 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-kahoot-yellow/25 text-yellow-200 rounded-full text-xs font-bold uppercase tracking-wider">
                    Kahoot
                  </span>
                  <Zap className="w-4 h-4 text-kahoot-yellow" />
                </div>
                <h2 className="text-2xl font-black">{currentScenario.title}</h2>
                <p className="text-white/50 text-sm font-semibold mt-1">
                  {currentScenario.mcQuestions.length} preguntas — {currentScenario.mcQuestions[0]?.timeLimitSeconds}s cada una
                </p>
              </div>

              {mcBlockDone ? (
                /* MC Block Summary */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="dramatic-card p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.3 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className={`text-6xl font-black mb-2 ${
                      mcBlockScore >= 80 ? 'text-kahoot-green' : mcBlockScore >= 40 ? 'text-kahoot-yellow' : 'text-kahoot-red'
                    }`}
                  >
                    {mcBlockScore}
                  </motion.div>
                  <p className="text-white/50 text-sm font-bold mb-6">Puntaje del Bloque</p>

                  <div className="space-y-3 max-w-md mx-auto">
                    {mcResponses.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                        {r.correct ? (
                          <CheckCircle className="w-6 h-6 text-kahoot-green shrink-0" />
                        ) : (
                          <XCircle className="w-6 h-6 text-kahoot-red shrink-0" />
                        )}
                        <span className="text-sm text-white/80 font-medium flex-1 text-left">
                          P{i + 1}: {currentScenario.mcQuestions![i]?.question?.slice(0, 60)}...
                        </span>
                        <span className="font-mono font-bold text-sm">
                          {r.pointsAwarded}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                      <div className="w-2 h-2 bg-kahoot-green rounded-full animate-pulse" />
                      <span className="text-white/70 text-sm font-semibold">
                        Esperando a que termine la ronda...
                      </span>
                    </div>
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
                    <span className="text-white/50 text-sm font-bold">
                      Pregunta {mcCurrentQ + 1} / {currentScenario.mcQuestions.length}
                    </span>
                    <motion.div
                      className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-lg ${
                        mcQuestionTimeLeft <= 5
                          ? 'bg-kahoot-red/30 text-kahoot-red border-2 border-kahoot-red/50'
                          : 'bg-white/10 text-white border-2 border-white/15'
                      }`}
                      animate={mcQuestionTimeLeft <= 5 ? { scale: [1, 1.08, 1] } : {}}
                      transition={mcQuestionTimeLeft <= 5 ? { repeat: Infinity, duration: 0.6 } : {}}
                    >
                      <Clock className="w-4 h-4" />
                      <span className="font-mono tabular-nums">{mcQuestionTimeLeft}s</span>
                    </motion.div>
                  </div>

                  {/* Question text */}
                  <div className="dramatic-card p-6">
                    <p className="text-xl font-black text-white leading-relaxed">
                      {currentScenario.mcQuestions[mcCurrentQ]?.question}
                    </p>
                  </div>

                  {/* Timer progress bar */}
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${mcQuestionTimeLeft <= 5 ? 'bg-kahoot-red' : 'bg-kahoot-green'}`}
                      style={{
                        width: `${(mcQuestionTimeLeft / (currentScenario.mcQuestions[mcCurrentQ]?.timeLimitSeconds || 25)) * 100}%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  {/* Option buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentScenario.mcQuestions[mcCurrentQ]?.options.map((opt, i) => {
                      const correctIdx = currentScenario.mcQuestions![mcCurrentQ]?.correctOptionIndex;
                      const isCorrectOption = i === correctIdx;
                      const isSelected = mcSelectedOption === opt.id;
                      const showResult = mcShowFeedback;

                      let btnClass = `${MC_COLORS[i].bg} ${MC_COLORS[i].hover}`;
                      if (showResult) {
                        if (isCorrectOption) {
                          btnClass = 'bg-green-500 ring-4 ring-green-300';
                        } else if (isSelected && !isCorrectOption) {
                          btnClass = 'bg-red-800 ring-4 ring-red-500 opacity-70';
                        } else {
                          btnClass = `${MC_COLORS[i].bg} opacity-40`;
                        }
                      }

                      return (
                        <motion.button
                          key={opt.id}
                          onClick={() => !mcShowFeedback && handleMCSelect(opt.id)}
                          disabled={mcShowFeedback}
                          whileHover={!mcShowFeedback ? { scale: 1.02 } : {}}
                          whileTap={!mcShowFeedback ? { scale: 0.98 } : {}}
                          className={`${btnClass} p-5 rounded-xl text-left transition-all font-bold text-white text-base leading-snug min-h-[80px] flex items-center gap-3`}
                        >
                          <span className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center text-sm font-black shrink-0">
                            {opt.id}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {showResult && isCorrectOption && (
                            <CheckCircle className="w-6 h-6 text-white shrink-0" />
                          )}
                          {showResult && isSelected && !isCorrectOption && (
                            <XCircle className="w-6 h-6 text-white shrink-0" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Feedback after selection */}
                  {mcShowFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-3"
                    >
                      {mcResponses[mcResponses.length - 1]?.correct ? (
                        <p className="text-kahoot-green font-black text-lg">
                          Correcto! +{mcResponses[mcResponses.length - 1]?.pointsAwarded} pts
                        </p>
                      ) : (
                        <p className="text-kahoot-red font-black text-lg">
                          {mcSelectedOption === null ? 'Tiempo agotado!' : 'Incorrecto'}
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
              <div className="dramatic-card p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  {currentScenario.category && (
                    <span className="px-3 py-1 bg-kahoot-blue/25 text-blue-200 rounded-full text-xs font-bold uppercase tracking-wider">
                      {currentScenario.category}
                    </span>
                  )}
                  {currentScenario.difficulty && (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        currentScenario.difficulty === 'easy'
                          ? 'bg-kahoot-green/25 text-green-200'
                          : currentScenario.difficulty === 'medium'
                          ? 'bg-kahoot-orange/25 text-orange-200'
                          : 'bg-kahoot-red/25 text-red-200'
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
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                    Contexto
                  </h3>
                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap font-medium">
                    {currentScenario.context ?? currentScenario.prompt}
                  </p>
                </div>

                {currentScenario.question && (
                  <div className="p-5 bg-kahoot-blue/15 border-2 border-kahoot-blue/30 rounded-xl">
                    <h3 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2">
                      Pregunta
                    </h3>
                    <p className="text-white leading-relaxed font-semibold">
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
                      className="dramatic-card p-6"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black">Tu Resultado</h3>
                        {isNonRanked && (
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
                            className={`text-5xl font-black ${
                              evaluation.finalScore >= 80
                                ? 'text-kahoot-green'
                                : evaluation.finalScore >= 60
                                ? 'text-kahoot-yellow'
                                : 'text-kahoot-red'
                            }`}
                          >
                            {evaluation.finalScore}
                          </motion.div>
                          <p className="text-white/50 text-sm font-bold">Puntaje</p>
                        </div>

                        <div className="flex-1 space-y-2">
                          {evaluation.evaluations?.map((ev: { judgeName: string; judgeAvatar?: string; score: number; feedback: string; strengths: string[]; improvements: string[] }, i: number) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-sm text-white/70 w-32 truncate font-semibold">
                                {ev.judgeAvatar ? `${ev.judgeAvatar} ` : ''}{ev.judgeName}
                              </span>
                              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
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
                        <div className="mb-4 p-4 bg-white/5 rounded-xl">
                          <p className="text-sm text-white/50 mb-2 font-bold uppercase tracking-wider text-xs">Tu respuesta:</p>
                          <p className="text-white/80 text-sm whitespace-pre-wrap font-medium">{userSub.response}</p>
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

                      {evaluation.evaluations?.map((ev: { judgeName: string; judgeAvatar?: string; score: number; feedback: string; strengths: string[]; improvements: string[]; promptUsed?: string }, i: number) => (
                        <div key={i} className="mb-4 p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className={`w-4 h-4 ${
                              i === 0 ? 'text-kahoot-red' : i === 1 ? 'text-kahoot-blue' : 'text-kahoot-green'
                            }`} />
                            <span className="font-bold">{ev.judgeAvatar ? `${ev.judgeAvatar} ` : ''}{ev.judgeName}</span>
                          </div>
                          <p className="text-white/80 text-sm mb-3 font-medium">{ev.feedback}</p>

                          {ev.strengths?.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs text-kahoot-green font-bold uppercase tracking-wider">Fortalezas:</span>
                              <ul className="text-xs text-white/60 ml-4 mt-1 font-medium">
                                {ev.strengths.map((s: string, j: number) => (
                                  <li key={j}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ev.improvements?.length > 0 && (
                            <div>
                              <span className="text-xs text-kahoot-orange font-bold uppercase tracking-wider">Areas de mejora:</span>
                              <ul className="text-xs text-white/60 ml-4 mt-1 font-medium">
                                {ev.improvements.map((s: string, j: number) => (
                                  <li key={j}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ev.promptUsed && (
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
                                  {ev.promptUsed}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="mt-4 pt-4 border-t border-white/10 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                          <div className="w-2 h-2 bg-kahoot-green rounded-full animate-pulse" />
                          <span className="text-white/70 text-sm font-semibold">
                            Esperando a que termine la ronda...
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="dramatic-card p-8 text-center"
                    >
                      <div className="w-16 h-16 border-4 border-kahoot-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <h3 className="text-2xl font-black mb-2">Respuesta Enviada</h3>
                      <p className="text-white/70 font-semibold">
                        3 jueces AI estan evaluando tu respuesta...
                      </p>
                      <div className="mt-4 p-4 bg-white/5 rounded-xl text-left">
                        <p className="text-sm text-white/50 mb-2 font-bold uppercase tracking-wider text-xs">Tu respuesta:</p>
                        <p className="text-white/80 text-sm whitespace-pre-wrap font-medium">
                          {response || userSub?.response}
                        </p>
                      </div>
                    </motion.div>
                  );
                })()
              ) : (
                <div className="dramatic-card p-6">
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-3">
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
                    <span className="text-white/50 text-sm font-semibold">
                      {response.length} caracteres
                    </span>

                    <button
                      onClick={handleSubmit}
                      disabled={!response.trim() || isSubmitting}
                      className="primary-button flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            <AlertCircle className="w-16 h-16 text-kahoot-orange mx-auto mb-4" />
            <p className="text-white/70 font-semibold">No hay escenario disponible</p>
          </div>
        )}
      </main>
    </div>
  );
}
