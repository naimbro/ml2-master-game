import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Play, Clock, Zap } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';

// Kahoot-inspired player card colors
const PLAYER_COLORS = [
  'from-kahoot-red to-pink-600',
  'from-kahoot-blue to-blue-600',
  'from-kahoot-green to-emerald-600',
  'from-kahoot-orange to-amber-600',
  'from-purple-500 to-violet-600',
  'from-cyan-500 to-teal-600',
  'from-rose-500 to-red-600',
  'from-indigo-500 to-blue-700',
];

export default function Lobby() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, error, isHost, startGame } = useGame(gameCode);

  // Navigate when game starts
  useEffect(() => {
    if (game?.status === 'active') {
      navigate(`/game/${gameCode}/round`);
    }
  }, [game?.status, gameCode, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kahoot-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70 font-semibold">Cargando juego...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4 font-semibold">{error || 'Juego no encontrado'}</p>
          <Link to="/" className="text-kahoot-green hover:underline font-bold">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const players = Object.values(game.players || {});

  return (
    <div className="min-h-screen bg-gradient-main relative overflow-hidden">
      {/* Header */}
      <header className="relative z-10 p-4 flex justify-between items-center">
        <Link
          to="/"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Salir
        </Link>

        <div className="flex items-center gap-2 text-white/60 font-semibold text-sm">
          <Clock className="w-4 h-4" />
          {game.totalRounds} rondas x {Math.floor((game.roundDurationSeconds || 300) / 60)} min
        </div>
      </header>

      {/* Big Game Code - Kahoot style */}
      <div className="relative z-10 text-center py-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150 }}
        >
          <p className="text-white/50 text-sm font-bold uppercase tracking-widest mb-2">
            Codigo del Juego
          </p>
          <div className="inline-block bg-white/10 rounded-2xl px-10 py-4 border-2 border-white/20">
            <p className="text-5xl md:text-7xl font-black tracking-[0.2em] text-white">
              {gameCode}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Session Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-6"
      >
        <h1 className="text-xl font-bold text-white/80">
          {game.sessionConfig?.title || 'Sesion'}
        </h1>
      </motion.div>

      {/* Player Count */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center mb-6"
      >
        <div className="inline-flex items-center gap-3 bg-white/10 rounded-full px-6 py-3 border border-white/15">
          <Users className="w-5 h-5 text-kahoot-green" />
          <span className="font-bold text-lg">
            <motion.span
              key={players.length}
              initial={{ scale: 1.5, color: '#66BF39' }}
              animate={{ scale: 1, color: '#FFFFFF' }}
              transition={{ duration: 0.3 }}
              className="inline-block"
            >
              {players.length}
            </motion.span>
            {' '}jugador{players.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </motion.div>

      {/* Players Grid */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: index * 0.05,
              }}
              className={`relative rounded-2xl p-4 text-center bg-gradient-to-br ${
                PLAYER_COLORS[index % PLAYER_COLORS.length]
              } shadow-lg ${
                player.id === user?.uid ? 'ring-3 ring-white ring-offset-2 ring-offset-[#46178F]' : ''
              }`}
            >
              {player.photoURL ? (
                <img
                  src={player.photoURL}
                  alt={player.name}
                  className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-white/40"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 mx-auto mb-2 flex items-center justify-center text-xl font-black">
                  {player.name.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="font-bold text-sm truncate">{player.name}</p>
              {player.id === user?.uid && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Tu</span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Host Controls or Waiting Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          {isHost ? (
            <div>
              <button
                onClick={startGame}
                disabled={players.length < 1}
                className="primary-button px-10 py-5 text-xl flex items-center gap-3 mx-auto"
              >
                <Play className="w-6 h-6" />
                Comenzar Juego
              </button>
              {players.length < 2 && (
                <p className="text-white/50 text-sm mt-4 font-medium">
                  Esperando mas jugadores...
                </p>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-3 bg-white/10 rounded-2xl px-8 py-5 border border-white/15">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Zap className="w-5 h-5 text-kahoot-green" />
              </motion.div>
              <p className="text-white/80 font-semibold">
                Esperando que el profesor inicie el juego...
              </p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
