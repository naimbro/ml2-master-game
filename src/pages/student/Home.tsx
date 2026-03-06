import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, LogOut, User, Zap, Brain, Trophy } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { initAudio, playClick } from '../../lib/sounds';

export default function Home() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    initAudio(); // Initialize audio on first user interaction
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
    playClick();
    navigate('/join');
  };

  const handleProfessorDashboard = () => {
    navigate('/professor');
  };

  return (
    <div className="min-h-screen bg-gradient-main relative overflow-hidden kahoot-shapes">
      {/* Floating decorative shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[15%] right-[12%] w-16 h-16 bg-kahoot-blue/10 rounded-xl rotate-12 animate-float" />
        <div className="absolute bottom-[25%] left-[8%] w-20 h-20 bg-kahoot-orange/10 rotate-45 rounded-lg animate-float-delayed" />
        <div className="absolute top-[60%] right-[25%] w-12 h-12 bg-kahoot-yellow/10 rounded-full animate-float-slow" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-kahoot-green rounded-lg flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">ML2 Master</span>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border-2 border-white/30"
                />
              ) : (
                <User className="w-8 h-8 text-white/70" />
              )}
              <span className="text-white/70 text-sm hidden sm:block font-medium">
                {user.displayName || user.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        ) : null}
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
            className="inline-block mb-6"
          >
            <div className="w-24 h-24 bg-kahoot-green rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-kahoot-green/30 rotate-3">
              <Zap className="w-14 h-14 text-white" />
            </div>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            ML2 Master
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto font-semibold">
            IA Generativa y Procesos Publicos
          </p>
          <p className="text-white/50 mt-3 font-medium">
            Pon a prueba tus conocimientos en escenarios reales del sector publico
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-5 mb-12"
        >
          {[
            {
              icon: Brain,
              title: 'Escenarios Reales',
              desc: 'Casos del sector publico chileno para aplicar conceptos de IA',
              color: 'bg-kahoot-blue',
              shadow: 'shadow-kahoot-blue/20',
            },
            {
              icon: Zap,
              title: 'Competencia en Vivo',
              desc: 'Compite con tus companeros en tiempo real',
              color: 'bg-kahoot-orange',
              shadow: 'shadow-kahoot-orange/20',
            },
            {
              icon: Trophy,
              title: 'Feedback AI',
              desc: '3 jueces AI evaluan tus respuestas con retroalimentacion detallada',
              color: 'bg-kahoot-green',
              shadow: 'shadow-kahoot-green/20',
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="dramatic-card p-6 text-center hover:scale-[1.02] transition-transform"
            >
              <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${feature.shadow}`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-white/60 text-sm font-medium">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center"
        >
          {!user ? (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="primary-button text-lg px-10 py-5 flex items-center gap-3 mx-auto"
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
                className="primary-button text-xl px-12 py-5 flex items-center gap-3 mx-auto"
              >
                <Zap className="w-6 h-6" />
                Unirse a un Juego
              </button>

              <button
                onClick={handleProfessorDashboard}
                className="text-white/60 hover:text-white transition-colors font-semibold text-sm"
              >
                Panel del Profesor
              </button>
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 text-center text-white/30 text-sm font-medium">
        <a href="https://naimbro.github.io/" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">Naim Bro</a> — Escuela de Gobierno, Universidad Adolfo Ibanez
      </footer>
    </div>
  );
}
