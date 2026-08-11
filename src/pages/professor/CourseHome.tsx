import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Plus, Play, Pencil, FileText, Users, Trash2, BarChart3, Trophy } from 'lucide-react';
import { getCourse, getSessionsForCourse, type Course } from '../../lib/courses';
import { fetchCourse, fetchSessions, deleteSession, type SessionWithStatus } from '../../lib/dynamicCourses';
import { db } from '../../lib/firebase';
import type { CourseStandings } from '../../types/standings';
import { filasDeJuegos, fechaCorta } from '../../lib/juegosJugados';

/** Un curso acumula pruebas del profesor: se muestran las ultimas y el resto se pide. */
const VISIBLES_POR_DEFECTO = 5;

export default function CourseHome() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<SessionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [standings, setStandings] = useState<CourseStandings | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  // Borrar es irreversible y no hay papelera, asi que la confirmacion nombra la
  // sesion: un "Estas seguro?" generico se acepta sin leer.
  const removeSession = async (sessionId: string, title: string) => {
    if (!courseId) return;
    if (!window.confirm(`Eliminar la sesion "${title}"? No se puede deshacer.\n\nLos juegos ya jugados con ella siguen funcionando: cada partida guarda su propia copia.`)) return;
    setBusy(sessionId);
    try {
      await deleteSession(courseId, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error('Error deleting session:', err);
      window.alert('No se pudo eliminar la sesion. Intenta de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Los cursos viven en dos lados y esta pagina tiene que servir a los dos.
   *
   * Un curso DEL REPO (`src/lib/courses.ts`) no tiene documento en Firestore y
   * sus sesiones son archivos bajo `content/sessions/`: se resuelven en
   * sincrono y son de solo lectura aca — se escriben con Claude Code y los
   * skills de autoria, no desde el navegador. Un curso CREADO DESDE LA UI vive
   * en `courses/{id}` con sus sesiones en una subcoleccion, y esas si se editan
   * y se borran.
   *
   * Hasta el 2026-08-11 esta pagina solo sabia resolver los segundos, y el
   * panel lo tapaba dibujando dos tarjetas distintas: la de un curso del repo
   * no tenia ningun enlace hasta aca. El resultado era que los seis cursos
   * reales no podian llegar a su propia pagina, y todo lo que se agregaba aca
   * —la lista de juegos jugados, por ejemplo— nacia inalcanzable.
   */
  const [esDelRepo, setEsDelRepo] = useState(false);
  useEffect(() => {
    if (!courseId) return;
    const delRepo = getCourse(courseId);
    if (delRepo) {
      setCourse(delRepo);
      // Una sesion del repo esta publicada por definicion: si esta en SESSIONS,
      // se puede jugar. El estado 'draft' solo existe en las de la UI, que
      // pueden quedar a medio escribir por el asistente.
      setSessions(getSessionsForCourse(courseId).map((s) => ({ ...s, status: 'ready' as const })));
      setEsDelRepo(true);
      setLoading(false);
      return;
    }
    setEsDelRepo(false);
    Promise.all([fetchCourse(courseId), fetchSessions(courseId)])
      .then(([c, s]) => { setCourse(c); setSessions(s); })
      .catch((err) => console.error('Error loading course:', err))
      .finally(() => setLoading(false));
  }, [courseId]);

  // La lista de juegos jugados sale de la tabla del curso — ver `juegosJugados.ts`
  // para por que de ahi y no de una consulta a `games`. Carga aparte y con su
  // propio catch: si no hay tabla todavia, o la lectura falla, la pagina de
  // sesiones tiene que seguir funcionando igual.
  useEffect(() => {
    if (!courseId) return;
    getDoc(doc(db, 'standings', courseId))
      .then((snap) => setStandings(snap.exists() ? (snap.data() as CourseStandings) : null))
      .catch((err) => console.error('No se pudo leer la tabla del curso:', err));
  }, [courseId]);

  // Antes de los early returns: los hooks no pueden quedar detras de un return.
  const filas = useMemo(() => filasDeJuegos(standings), [standings]);

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
  const visibles = verTodos ? filas : filas.slice(0, VISIBLES_POR_DEFECTO);

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
                    {esDelRepo ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0 border border-line text-muted"
                        title="Vive en content/sessions/. Se escribe con Claude Code, no desde acá."
                      >
                        Del repo
                      </span>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        session.status === 'ready'
                          ? 'bg-emerald-500/20 text-emerald-700'
                          : 'bg-amber-500/20 text-amber-700'
                      }`}>
                        {session.status === 'ready' ? 'Publicada' : 'Borrador'}
                      </span>
                    )}
                  </div>
                  <p className="text-muted text-sm truncate">
                    {session.rounds} rondas · {session.duration} min por ronda
                  </p>
                </div>
                {/* Editar y eliminar son solo de las sesiones de la UI. Una del
                    repo es un archivo versionado: el editor no sabe escribirla y
                    "eliminar" no tendria a que apuntar. */}
                {!esDelRepo && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/professor/courses/${courseId}/sessions/${session.id}/edit`}
                      className="flex items-center gap-1 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Link>
                    <button
                      onClick={() => removeSession(session.id, session.title)}
                      disabled={busy !== null}
                      title="Eliminar sesión"
                      aria-label={`Eliminar la sesión ${session.title}`}
                      className="p-2 rounded-lg text-muted hover:text-kahoot-red hover:bg-surface-2 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="dramatic-card p-8 text-center text-muted">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                {esDelRepo
                  ? 'Este curso todavía no tiene sesiones escritas en el repo.'
                  : 'Aún no hay sesiones. Crea la primera con el asistente IA.'}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {/* "Crear juego" primero: es lo que el profesor viene a apretar.
                Antes era el tercero porque el primero era escribir una sesion
                nueva, que en un curso del repo ni siquiera existe. */}
            {readyCount > 0 && (
              <Link
                to={`/professor/courses/${courseId}/create`}
                className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5" />
                Crear juego
              </Link>
            )}
            {/* El asistente escribe en `courses/{id}/sessions`. Un curso del
                repo no tiene esa subcoleccion: la sesion quedaria colgando en
                Firestore sin que nada la lea. */}
            {!esDelRepo && (
              <Link
                to={`/professor/courses/${courseId}/sessions/new`}
                className={`w-full py-4 text-lg flex items-center justify-center gap-3 rounded-xl transition-colors font-semibold ${
                  readyCount > 0 ? 'bg-surface-2 hover:bg-surface-3' : 'primary-button'
                }`}
              >
                <Plus className="w-5 h-5" />
                Nueva sesión con asistente IA
              </Link>
            )}
            <Link
              to={`/professor/courses/${courseId}/tabla`}
              className="w-full py-4 text-lg flex items-center justify-center gap-3 bg-surface-2 hover:bg-surface-3 rounded-xl transition-colors font-semibold"
            >
              <Trophy className="w-5 h-5" />
              Tabla acumulada
            </Link>
            <Link
              to={`/professor/courses/${courseId}/judges`}
              className="w-full py-4 text-lg flex items-center justify-center gap-3 bg-surface-2 hover:bg-surface-3 rounded-xl transition-colors font-semibold"
            >
              <Users className="w-5 h-5" />
              Jueces del curso
            </Link>
          </div>

          {/* Juegos ya jugados. Va DESPUES de los botones a proposito: con 15
              juegos en un curso, meter la lista antes empujaría "Crear juego"
              fuera de la pantalla, que es lo que el profesor viene a apretar. */}
          {filas.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-bold mb-1">Juegos jugados</h2>
              <p className="text-muted text-sm mb-4">
                El reporte de cada juego: puntajes, feedback de los jueces y cómo se escribió
                cada respuesta.
              </p>

              <div className="space-y-3">
                {visibles.map((f) => (
                  <div key={f.gameCode} className="dramatic-card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold truncate">
                          {f.sessionTitle ?? 'Juego excluido de la tabla'}
                        </h3>
                        {f.etiqueta === 'oficial' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-ink text-paper font-semibold">
                            Oficial
                          </span>
                        ) : (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full shrink-0 border border-line text-muted"
                            title={f.etiqueta === 'excluido'
                              ? 'Lo sacaste a mano de la tabla del curso'
                              : 'Otro juego de esta misma clase tuvo más alumnos, así que ese es el que cuenta'}
                          >
                            {f.etiqueta === 'excluido' ? 'Excluido' : 'Prueba'}
                          </span>
                        )}
                      </div>
                      <p className="text-muted text-sm truncate">
                        {[
                          fechaCorta(f.finishedAtMs),
                          f.playedCount !== undefined
                            ? `${f.playedCount} ${f.playedCount === 1 ? 'jugó' : 'jugaron'}`
                            : null,
                          f.gameCode,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Link
                      to={`/professor/report/${f.gameCode}`}
                      className="flex items-center gap-1 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm shrink-0"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Ver reporte
                    </Link>
                  </div>
                ))}
              </div>

              {filas.length > VISIBLES_POR_DEFECTO && (
                <button
                  onClick={() => setVerTodos((v) => !v)}
                  className="mt-3 text-sm text-muted hover:text-ink transition-colors"
                >
                  {verTodos
                    ? 'Mostrar solo los últimos'
                    : `Ver los ${filas.length} juegos, incluidas las pruebas`}
                </button>
              )}
            </section>
          )}
        </motion.div>
      </main>
    </div>
  );
}
