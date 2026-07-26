import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Play, Pencil, FileText, Users } from 'lucide-react';
import type { Course } from '../../lib/courses';
import { fetchCourse, fetchSessions, type SessionWithStatus } from '../../lib/dynamicCourses';

export default function CourseHome() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<SessionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    Promise.all([fetchCourse(courseId), fetchSessions(courseId)])
      .then(([c, s]) => { setCourse(c); setSessions(s); })
      .catch((err) => console.error('Error loading course:', err))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!course || !courseId) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-ink-soft mb-4">Curso no encontrado</p>
          <Link to="/professor" className="text-cyan-400 hover:underline">Volver al panel</Link>
        </div>
      </div>
    );
  }

  const readyCount = sessions.filter((s) => s.status === 'ready').length;

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to="/professor" className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-2">
            {course.name}
          </p>
          <h1 className="text-3xl font-bold mb-2">Sesiones del curso</h1>
          <p className="text-muted mb-8">{course.tagline}</p>

          <div className="space-y-4 mb-8">
            {sessions.map((session) => (
              <div key={session.id} className="dramatic-card p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold truncate">{session.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      session.status === 'ready'
                        ? 'bg-emerald-500/20 text-emerald-700'
                        : 'bg-amber-500/20 text-amber-700'
                    }`}>
                      {session.status === 'ready' ? 'Publicada' : 'Borrador'}
                    </span>
                  </div>
                  <p className="text-muted text-sm truncate">
                    {session.rounds} rondas · {session.duration} min por ronda
                  </p>
                </div>
                <Link
                  to={`/professor/courses/${courseId}/sessions/${session.id}/edit`}
                  className="flex items-center gap-1 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </Link>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="dramatic-card p-8 text-center text-muted">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Aún no hay sesiones. Crea la primera con el asistente IA.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Link
              to={`/professor/courses/${courseId}/sessions/new`}
              className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
            >
              <Plus className="w-5 h-5" />
              Nueva sesión con asistente IA
            </Link>
            <Link
              to={`/professor/courses/${courseId}/judges`}
              className="w-full py-4 text-lg flex items-center justify-center gap-3 bg-surface-2 hover:bg-surface-3 rounded-xl transition-colors font-semibold"
            >
              <Users className="w-5 h-5" />
              Jueces del curso
            </Link>
            {readyCount > 0 && (
              <Link
                to={`/professor/courses/${courseId}/create`}
                className="w-full py-4 text-lg flex items-center justify-center gap-3 bg-surface-2 hover:bg-surface-3 rounded-xl transition-colors font-semibold"
              >
                <Play className="w-5 h-5" />
                Crear juego
              </Link>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
