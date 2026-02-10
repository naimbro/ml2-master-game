import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Play, Clock, BookOpen } from 'lucide-react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';

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
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Cargando juego...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Juego no encontrado'}</p>
          <Link to="/" className="text-cyan-400 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const players = Object.values(game.players || {});

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <Link
          to="/"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Salir
        </Link>

        <div className="text-center">
          <p className="text-white/50 text-xs">Codigo del juego</p>
          <p className="text-2xl font-mono font-bold tracking-wider text-cyan-400">
            {gameCode}
          </p>
        </div>

        <div className="w-20"></div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Session Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="dramatic-card p-6 mb-8"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {game.sessionConfig?.title || 'Sesion'}
              </h1>
              <p className="text-white/60 text-sm mb-3">
                {game.sessionConfig?.description || ''}
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 text-white/70">
                  <Clock className="w-4 h-4" />
                  {game.totalRounds} rondas x {Math.floor((game.roundDurationSeconds || 300) / 60)} min
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <Users className="w-4 h-4" />
                  {players.length} jugadores
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Players Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Jugadores ({players.length})
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`dramatic-card p-4 text-center ${
                  player.id === user?.uid ? 'ring-2 ring-cyan-400' : ''
                }`}
              >
                {player.photoURL ? (
                  <img
                    src={player.photoURL}
                    alt={player.name}
                    className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-white/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 mx-auto mb-2 flex items-center justify-center text-xl font-bold">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="font-medium text-sm truncate">{player.name}</p>
                {player.id === user?.uid && (
                  <span className="text-xs text-cyan-400">(Tu)</span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Host Controls or Waiting Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          {isHost ? (
            <div>
              <button
                onClick={startGame}
                disabled={players.length < 1}
                className="primary-button px-8 py-4 text-lg flex items-center gap-3 mx-auto"
              >
                <Play className="w-5 h-5" />
                Comenzar Juego
              </button>
              {players.length < 2 && (
                <p className="text-white/50 text-sm mt-3">
                  Esperando mas jugadores...
                </p>
              )}
            </div>
          ) : (
            <div className="dramatic-card p-6 inline-block">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-white/70">
                  Esperando que el profesor inicie el juego...
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
