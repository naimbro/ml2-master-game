import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Gamepad2,
  BookOpen,
  ChevronRight,
  LogOut,
  GraduationCap,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useProfessor } from '../../hooks/useProfessor';
import { COURSES, getSessionsForCourse, type Course } from '../../lib/courses';
import { fetchMyCourses } from '../../lib/dynamicCourses';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { access } = useProfessor();
  const navigate = useNavigate();
  const [myCourses, setMyCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchMyCourses(user.uid).then(setMyCourses).catch((err) => {
      console.error('Error loading courses:', err);
    });
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Hardcoded catalog courses are only shown to the admin (they belong to Naim)
  const builtinCourses = access === 'admin' ? COURSES : [];

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <Gamepad2 className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-bold gradient-text">Aula Maestra</span>
            </Link>
            <span className="text-white/30">|</span>
            <span className="text-white/70">Panel del Profesor</span>
          </div>

          <div className="flex items-center gap-4">
            {access === 'admin' && (
              <Link
                to="/professor/admin"
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            Mis Cursos
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {builtinCourses.map((course) => {
              const sessionCount = getSessionsForCourse(course.id).length;
              return (
                <Link
                  key={course.id}
                  to={`/professor/courses/${course.id}/create`}
                  className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group"
                >
                  <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{course.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{course.tagline}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">
                      {sessionCount} {sessionCount === 1 ? 'sesion' : 'sesiones'}
                    </span>
                    <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                      Crear juego
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}

            {myCourses.map((course) => (
              <Link
                key={course.id}
                to={`/professor/courses/${course.id}`}
                className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group"
              >
                <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">{course.name}</h3>
                <p className="text-white/60 text-sm mb-4">{course.tagline}</p>
                <div className="flex items-center justify-end text-sm">
                  <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                    Gestionar
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}

            {/* Create course card */}
            <Link
              to="/professor/courses/new"
              className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-center min-h-[220px]"
            >
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-1">Crear curso</h3>
              <p className="text-white/60 text-sm">
                Genera sesiones con el asistente IA
              </p>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
