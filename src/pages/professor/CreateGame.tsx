import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, BookOpen, Clock, Copy, Check } from 'lucide-react';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

// Import session content - in production this would be loaded dynamically
import session1Config from '../../../content/sessions/ml2-2025/session_1_ia_procesos_sector_publico/config.json';
import session1Scenarios from '../../../content/sessions/ml2-2025/session_1_ia_procesos_sector_publico/scenarios.json';

interface SessionOption {
  id: string;
  title: string;
  description: string;
  rounds: number;
  duration: number;
  config: typeof session1Config;
  scenarios: typeof session1Scenarios;
}

// Available sessions - would be dynamically loaded in production
const availableSessions: SessionOption[] = [
  {
    id: 'session_1_ia_procesos_sector_publico',
    title: 'Sesion 1: IA, Procesos y Sector Publico',
    description: '6 rondas: estructuracion de procesos, TRL, limites de IA, feria de familias, preferencias y estilo de trabajo',
    rounds: 6,
    duration: 5,
    config: session1Config,
    scenarios: session1Scenarios as typeof session1Scenarios,
  },
];

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function CreateGame() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState<SessionOption | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdGame, setCreatedGame] = useState<{ code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateGame = async () => {
    if (!selectedSession || !user) return;

    setIsCreating(true);

    try {
      const gameCode = generateGameCode();
      const gameRef = doc(db, 'games', gameCode);

      await setDoc(gameRef, {
        gameCode,
        courseId: 'ml2-2025',
        sessionId: selectedSession.id,
        hostId: user.uid,
        hostName: user.displayName || user.email || 'Profesor',

        status: 'waiting',
        currentRound: 0,
        totalRounds: selectedSession.scenarios.length,
        roundDurationSeconds: selectedSession.config.roundDurationSeconds,

        sessionConfig: selectedSession.config,
        scenarios: selectedSession.scenarios,

        players: {
          [user.uid]: {
            id: user.uid,
            name: user.displayName || user.email || 'Profesor',
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            joinedAt: Timestamp.now(),
            isReady: false,
            totalScore: 0,
          }
        },
        playerCount: 1,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCreatedGame({ code: gameCode });
    } catch (err) {
      console.error('Error creating game:', err);
      alert('Error al crear el juego. Intenta de nuevo.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (createdGame) {
      navigator.clipboard.writeText(createdGame.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoToLobby = () => {
    if (createdGame) {
      navigate(`/game/${createdGame.code}/lobby`);
    }
  };

  // Game created successfully screen
  if (createdGame) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="dramatic-card p-8 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Juego Creado</h1>
          <p className="text-white/60 mb-6">
            Comparte este codigo con tus estudiantes
          </p>

          <div className="bg-white/10 rounded-xl p-6 mb-6">
            <p className="text-5xl font-mono font-bold tracking-widest text-cyan-400 mb-4">
              {createdGame.code}
            </p>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar codigo</span>
                </>
              )}
            </button>
          </div>

          <button onClick={handleGoToLobby} className="primary-button w-full py-4 text-lg">
            Ir al Lobby
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4">
        <Link
          to="/professor"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold mb-2">Crear Nuevo Juego</h1>
          <p className="text-white/60 mb-8">
            Selecciona una sesion para comenzar
          </p>

          {/* Session Selection */}
          <div className="space-y-4 mb-8">
            {availableSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`dramatic-card p-6 cursor-pointer transition-all ${
                  selectedSession?.id === session.id
                    ? 'ring-2 ring-cyan-400 bg-cyan-500/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedSession?.id === session.id
                        ? 'bg-cyan-500'
                        : 'bg-white/10'
                    }`}
                  >
                    <BookOpen className="w-6 h-6" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1">{session.title}</h3>
                    <p className="text-white/60 text-sm mb-3">{session.description}</p>

                    <div className="flex gap-4 text-sm text-white/50">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {session.rounds} rondas
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {session.duration} min/ronda
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedSession?.id === session.id
                        ? 'border-cyan-400 bg-cyan-400'
                        : 'border-white/30'
                    }`}
                  >
                    {selectedSession?.id === session.id && (
                      <Check className="w-4 h-4 text-black" />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Placeholder for more sessions */}
            <div className="dramatic-card p-6 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white/30" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white/50">Mas sesiones proximamente</h3>
                  <p className="text-white/30 text-sm">
                    APIs, Prompting, RAG, y mas...
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateGame}
            disabled={!selectedSession || isCreating}
            className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
          >
            {isCreating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando juego...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Crear Juego
              </>
            )}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
