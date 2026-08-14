import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Zap } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useGame } from '../../hooks/useGame';

export default function JoinGame() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // El QR de la sala apunta a /join?code=ABC123. Se sanea igual que lo tipeado a mano:
  // el parametro viene de una URL, o sea de cualquier parte.
  const [gameCode, setGameCode] = useState(
    () => (searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
  );
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
        // Puede ser un compas. Comparten el espacio de codigos de 6 caracteres y
        // el alumno no tiene como saber cual de los dos le tocó — desde su lado
        // los dos son "el codigo que salio en la pantalla". Antes esta casilla
        // miraba solo en `games/` y le decia que el codigo estaba malo, que era
        // falso: el codigo estaba bien y la unica entrada era el QR.
        //
        // Se despacha y ya. La pantalla del compas sigue siendo hermana y no un
        // modo de esta: aca no se dibuja nada del compas, ni se inscribe a
        // nadie. El nombre lo pide `CompasJugar`, que ademas no tiene sala de
        // espera que mostrar.
        const compasDoc = await getDoc(doc(db, 'compasRuns', code));
        if (compasDoc.exists()) {
          navigate(`/compas/${code}`);
          return;
        }

        setError('No encontramos ese codigo. Revisa que este bien copiado.');
        setIsJoining(false);
        return;
      }

      const gameData = gameDoc.data();

      // Check if player is already registered (reconnection case)
      const isReconnecting = user?.uid && gameData.players?.[user.uid];

      if (isReconnecting) {
        // Player already in game — navigate to correct page based on status
        const status = gameData.status;
        if (status === 'waiting') {
          navigate(`/game/${code}/lobby`);
        } else if (status === 'active') {
          navigate(`/game/${code}/round`);
        } else if (status === 'round_end') {
          navigate(`/game/${code}/results`);
        } else if (status === 'finished') {
          navigate(`/game/${code}/end`);
        } else {
          navigate(`/game/${code}/lobby`);
        }
        return;
      }

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
          className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors w-fit font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 bg-kahoot-green rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-kahoot-green/30"
            >
              <Zap className="w-10 h-10 text-onaccent" />
            </motion.div>
            <h1 className="text-3xl font-black mb-2">Unirse al Juego</h1>
            <p className="text-muted font-medium">
              Ingresa el codigo de 6 letras que aparece en pantalla
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Game Code Input */}
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-2 uppercase tracking-wider">
                Codigo del Juego
              </label>
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                placeholder="ABCDEF"
                maxLength={6}
                className="input-field text-center text-3xl tracking-[0.4em] uppercase font-black py-5"
                autoFocus
              />
            </div>

            {/* Player Name Input */}
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-2 uppercase tracking-wider">
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
                className="p-3 bg-kahoot-red/20 border-2 border-kahoot-red/40 rounded-xl text-red-700 text-sm text-center font-semibold"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isJoining}
              className="primary-button w-full py-5 text-lg flex items-center justify-center gap-3"
            >
              {isJoining ? (
                <>
                  <div className="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin" />
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
