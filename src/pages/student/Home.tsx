import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, BookOpen, Trophy, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function Home() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleJoinGame = () => {
    navigate('/join');
  };

  const handleProfessorDashboard = () => {
    navigate('/professor');
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-8 h-8 text-cyan-400" />
          <span className="text-xl font-bold gradient-text">ML2 Master</span>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border-2 border-cyan-400"
                />
              ) : (
                <User className="w-8 h-8 text-white/70" />
              )}
              <span className="text-white/70 text-sm hidden sm:block">
                {user.displayName || user.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        ) : null}
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="gradient-text">ML2 Master Game</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Machine Learning II: IA Generativa y Procesos Publicos
          </p>
          <p className="text-white/50 mt-2">
            Pon a prueba tus conocimientos en escenarios reales del sector publico
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          <div className="dramatic-card p-6 text-center">
            <BookOpen className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Escenarios Reales</h3>
            <p className="text-white/60 text-sm">
              Casos del sector publico chileno para aplicar conceptos de IA
            </p>
          </div>

          <div className="dramatic-card p-6 text-center">
            <Gamepad2 className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Competencia en Vivo</h3>
            <p className="text-white/60 text-sm">
              Compite con tus companeros en tiempo real
            </p>
          </div>

          <div className="dramatic-card p-6 text-center">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feedback AI</h3>
            <p className="text-white/60 text-sm">
              3 jueces AI evaluan tus respuestas con retroalimentacion detallada
            </p>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          {!user ? (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="primary-button text-lg px-8 py-4 flex items-center gap-3 mx-auto"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Iniciar sesion con Google
                </>
              )}
            </button>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleJoinGame}
                className="primary-button text-lg px-8 py-4 flex items-center gap-3 mx-auto"
              >
                <Gamepad2 className="w-5 h-5" />
                Unirse a un Juego
              </button>

              <button
                onClick={handleProfessorDashboard}
                className="text-white/70 hover:text-white transition-colors underline"
              >
                Panel del Profesor
              </button>
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 text-center text-white/40 text-sm">
        Universidad Adolfo Ibanez - Machine Learning II
      </footer>
    </div>
  );
}
