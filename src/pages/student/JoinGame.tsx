import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Gamepad2, Users } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useGame } from '../../hooks/useGame';

export default function JoinGame() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState(user?.displayName || '');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const { joinGame } = useGame(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = gameCode.toUpperCase().trim();
    if (!code || code.length !== 6) {
      setError('Ingresa un codigo de 6 caracteres');
      return;
    }

    if (!playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }

    setIsJoining(true);

    try {
      // Check if game exists
      const gameRef = doc(db, 'games', code);
      const gameDoc = await getDoc(gameRef);

      if (!gameDoc.exists()) {
        setError('Juego no encontrado. Verifica el codigo.');
        setIsJoining(false);
        return;
      }

      const gameData = gameDoc.data();

      if (gameData.status !== 'waiting') {
        setError('Este juego ya ha comenzado o terminado.');
        setIsJoining(false);
        return;
      }

      // Join the game
      await joinGame(code, playerName.trim());

      // Navigate to lobby
      navigate(`/game/${code}/lobby`);
    } catch (err) {
      console.error('Error joining game:', err);
      setError('Error al unirse al juego. Intenta de nuevo.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Unirse al Juego</h1>
            <p className="text-white/60">
              Ingresa el codigo de 6 letras que aparece en pantalla
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Game Code Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Codigo del Juego
              </label>
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                placeholder="ABCDEF"
                maxLength={6}
                className="input-field text-center text-2xl tracking-[0.3em] uppercase font-mono"
                autoFocus
              />
            </div>

            {/* Player Name Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Tu Nombre
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Maria Garcia"
                maxLength={30}
                className="input-field"
              />
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isJoining}
              className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
            >
              {isJoining ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uniendose...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Unirse al Juego
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
