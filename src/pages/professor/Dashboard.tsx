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
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useProfessor } from '../../hooks/useProfessor';
import { usePendingProfessorCount } from '../../hooks/usePendingProfessors';
import { COURSES, getSessionsForCourse, type Course } from '../../lib/courses';
import { fetchMyCourses } from '../../lib/dynamicCourses';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { access } = useProfessor();
  const pendingCount = usePendingProfessorCount();
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
      <header className="p-4 border-b border-line">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <Gamepad2 className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-bold gradient-text">ML2</span>
            </Link>
            <span className="text-faint">|</span>
            <span className="text-ink-soft">Panel del Profesor</span>
          </div>

          <div className="flex items-center gap-4">
            {access === 'admin' && (
              <Link
                to="/professor/admin"
                className="relative flex items-center gap-2 px-3 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
                title={pendingCount > 0
                  ? `${pendingCount} solicitud${pendingCount === 1 ? '' : 'es'} de acceso esperando`
                  : 'Administrar profesores'}
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Admin</span>
                {/* Nadie recibe un correo cuando llega una solicitud, asi que este
                    numero es el unico aviso que existe. Va sobre el icono para que
                    se vea tambien en movil, donde la palabra "Admin" esta oculta. */}
                {pendingCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] px-1 flex items-center justify-center rounded-full bg-kahoot-red text-white text-[0.65rem] font-bold leading-none shadow"
                    aria-label={`${pendingCount} solicitudes pendientes`}
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>
            )}
            <span className="text-ink-soft text-sm hidden sm:block">
              {user?.displayName || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
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
                <div key={course.id} className="dramatic-card p-6 group">
                  <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4`}>
                    <BookOpen className="w-7 h-7 text-onaccent" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{course.name}</h3>
                  <p className="text-muted text-sm mb-4">{course.tagline}</p>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-muted">
                      {sessionCount} {sessionCount === 1 ? 'sesion' : 'sesiones'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/professor/courses/${course.id}/create`}
                      className="flex-1 py-2 text-center bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors font-semibold text-sm"
                    >
                      Crear juego
                    </Link>
                    <Link
                      to={`/professor/courses/${course.id}/judges`}
                      className="flex items-center gap-1 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm"
                    >
                      <Users className="w-4 h-4" />
                      Jueces
                    </Link>
                  </div>
                </div>
              );
            })}

            {myCourses.map((course) => (
              <Link
                key={course.id}
                to={`/professor/courses/${course.id}`}
                className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group"
              >
                <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <BookOpen className="w-7 h-7 text-onaccent" />
                </div>
                <h3 className="text-xl font-bold mb-1">{course.name}</h3>
                <p className="text-muted text-sm mb-4">{course.tagline}</p>
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
              className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group border-2 border-dashed border-line flex flex-col items-center justify-center text-center min-h-[220px]"
            >
              <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-1">Crear curso</h3>
              <p className="text-muted text-sm">
                Genera sesiones con el asistente IA
              </p>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
