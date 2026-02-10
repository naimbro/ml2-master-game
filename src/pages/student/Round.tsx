import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Send, CheckCircle, AlertCircle, StopCircle } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Round() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, error, submitAnswer, submissions, isHost } = useGame(gameCode);

  const [response, setResponse] = useState('');
  const [endingRound, setEndingRound] = useState(false);

  // Manual end round (host only)
  const handleEndRound = async () => {
    if (!gameCode || !isHost || endingRound) return;

    const confirm = window.confirm(
      '¿Estás seguro de terminar la ronda ahora? Se evaluarán las respuestas enviadas.'
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
      navigate(`/game/${gameCode}/results`);
    } else if (game?.status === 'finished') {
      navigate(`/game/${gameCode}/end`);
    } else if (game?.status === 'waiting') {
      navigate(`/game/${gameCode}/lobby`);
    }
  }, [game?.status, gameCode, navigate]);

  // Timer
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

  const handleSubmit = useCallback(async () => {
    if (!response.trim() || hasSubmitted || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitAnswer(response.trim());
      setHasSubmitted(true);
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
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Cargando ronda...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Error al cargar el juego'}</p>
        </div>
      </div>
    );
  }

  const currentScenario = game.scenarios?.[game.currentRound - 1];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 60;

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header with Timer */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <span className="text-white/50 text-sm">Ronda</span>
            <p className="text-xl font-bold">
              {game.currentRound} / {game.totalRounds}
            </p>
          </div>

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              isLowTime
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : 'bg-white/10 text-white'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="font-mono text-lg font-bold">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>

          <div className="text-right">
            <span className="text-white/50 text-sm">Respuestas</span>
            <p className="text-xl font-bold text-cyan-400">
              {submissions.length} / {Object.keys(game.players || {}).length}
            </p>
          </div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <div className="max-w-4xl mx-auto mt-3 flex justify-end">
            <button
              onClick={handleEndRound}
              disabled={endingRound}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {endingRound ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Terminando...
                </>
              ) : (
                <>
                  <StopCircle className="w-4 h-4" />
                  Terminar Ronda Ahora
                </>
              )}
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {currentScenario ? (
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
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium">
                    {currentScenario.category}
                  </span>
                )}
                {currentScenario.difficulty && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      currentScenario.difficulty === 'easy'
                        ? 'bg-green-500/20 text-green-300'
                        : currentScenario.difficulty === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-red-500/20 text-red-300'
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

              <h2 className="text-2xl font-bold mb-4">{currentScenario.title}</h2>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-2">
                  Contexto
                </h3>
                <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                  {currentScenario.context}
                </p>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-2">
                  Pregunta
                </h3>
                <p className="text-white leading-relaxed">
                  {currentScenario.question}
                </p>
              </div>
            </div>

            {/* Response Area */}
            {hasSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="dramatic-card p-8 text-center"
              >
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Respuesta Enviada</h3>
                <p className="text-white/60">
                  Esperando a que termine el tiempo o todos respondan...
                </p>
                <div className="mt-4 p-4 bg-white/5 rounded-lg text-left">
                  <p className="text-sm text-white/50 mb-2">Tu respuesta:</p>
                  <p className="text-white/80 text-sm whitespace-pre-wrap">
                    {response || submissions.find(s => s.playerId === user?.uid)?.response}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="dramatic-card p-6">
                <label className="block text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">
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
                  <span className="text-white/50 text-sm">
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
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <p className="text-white/70">No hay escenario disponible</p>
          </div>
        )}
      </main>
    </div>
  );
}
