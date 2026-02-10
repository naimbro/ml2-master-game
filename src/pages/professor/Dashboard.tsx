import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Gamepad2,
  Plus,
  Users,
  BookOpen,
  BarChart3,
  Clock,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

interface RecentGame {
  gameCode: string;
  sessionTitle: string;
  status: string;
  playerCount: number;
  createdAt: Date;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRecentGames = async () => {
      try {
        const gamesRef = collection(db, 'games');
        const q = query(
          gamesRef,
          where('hostId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );

        const snapshot = await getDocs(q);
        const games = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            gameCode: doc.id,
            sessionTitle: data.sessionConfig?.title || 'Sin titulo',
            status: data.status,
            playerCount: data.playerCount || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
          };
        });

        setRecentGames(games);
      } catch (err) {
        console.error('Error fetching games:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentGames();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
            Esperando
          </span>
        );
      case 'active':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
            En curso
          </span>
        );
      case 'finished':
        return (
          <span className="px-2 py-1 bg-white/20 text-white/60 rounded text-xs">
            Finalizado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <Gamepad2 className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-bold gradient-text">ML2 Master</span>
            </Link>
            <span className="text-white/30">|</span>
            <span className="text-white/70">Panel del Profesor</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-white/70 text-sm hidden sm:block">
              {user?.displayName || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-3 gap-6 mb-8"
        >
          <Link
            to="/professor/create"
            className="dramatic-card p-6 hover:scale-105 transition-transform cursor-pointer group"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Crear Juego</h3>
            <p className="text-white/60 text-sm">
              Inicia una nueva sesion de juego para tu clase
            </p>
          </Link>

          <div className="dramatic-card p-6 opacity-70 cursor-not-allowed">
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-7 h-7 text-white/50" />
            </div>
            <h3 className="text-xl font-bold mb-2">Analiticas</h3>
            <p className="text-white/60 text-sm">
              Reportes de clase (proximamente)
            </p>
          </div>

          <div className="dramatic-card p-6 opacity-70 cursor-not-allowed">
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-white/50" />
            </div>
            <h3 className="text-xl font-bold mb-2">Estudiantes</h3>
            <p className="text-white/60 text-sm">
              Gestion de matricula (proximamente)
            </p>
          </div>
        </motion.div>

        {/* Recent Games */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="dramatic-card p-6"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Juegos Recientes
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-white/50 text-sm">Cargando...</p>
            </div>
          ) : recentGames.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">No has creado ningun juego todavia</p>
              <Link
                to="/professor/create"
                className="text-cyan-400 hover:underline text-sm mt-2 inline-block"
              >
                Crear tu primer juego
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentGames.map((game) => (
                <div
                  key={game.gameCode}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-cyan-400 text-sm">
                        {game.gameCode}
                      </span>
                      {getStatusBadge(game.status)}
                    </div>
                    <p className="font-medium truncate">{game.sessionTitle}</p>
                    <div className="flex items-center gap-4 text-sm text-white/50 mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {game.playerCount} jugadores
                      </span>
                      <span>
                        {game.createdAt.toLocaleDateString('es-CL', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {game.status === 'waiting' && (
                    <Link
                      to={`/game/${game.gameCode}/lobby`}
                      className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                    >
                      Ir al lobby
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}

                  {game.status === 'active' && (
                    <Link
                      to={`/game/${game.gameCode}/round`}
                      className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-1"
                    >
                      Ver juego
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}

                  {game.status === 'finished' && (
                    <Link
                      to={`/game/${game.gameCode}/end`}
                      className="px-4 py-2 bg-white/10 text-white/70 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-1"
                    >
                      Ver resultados
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
