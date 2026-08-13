import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Compass,
  Gamepad2,
  BookOpen,
  FileText,
  LogOut,
  GraduationCap,
  Plus,
  ShieldCheck,
  Users,
  Trash2,
  Trophy,
  GripVertical,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useProfessor } from '../../hooks/useProfessor';
import { usePendingProfessorCount } from '../../hooks/usePendingProfessors';
import { useCardReorder } from '../../hooks/useCardReorder';
import { COURSES, getSessionsForCourse, type Course } from '../../lib/courses';
import { COMPASES } from '../../lib/compasContent';
import { fetchMyCourses, deleteCourse } from '../../lib/dynamicCourses';
import { applyCourseOrder } from '../../lib/courseOrder';
import { fetchProfessorPrefs, saveCourseOrder } from '../../lib/professorPrefs';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { access } = useProfessor();
  const pendingCount = usePendingProfessorCount();
  const navigate = useNavigate();
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [courseOrder, setCourseOrder] = useState<string[] | undefined>(undefined);

  // Firestore no borra en cascada, asi que deleteCourse() barre primero las
  // sesiones. La confirmacion nombra el curso porque no hay papelera ni deshacer.
  const removeCourse = async (course: Course) => {
    if (!window.confirm(
      `Eliminar el curso "${course.name}"?\n\nSe borran tambien todas sus sesiones y los jueces personalizados. No se puede deshacer.\n\nLos juegos ya jugados siguen funcionando: cada partida guarda su propia copia.`
    )) return;
    setDeleting(course.id);
    try {
      await deleteCourse(course.id);
      setMyCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch (err) {
      console.error('Error deleting course:', err);
      window.alert('No se pudo eliminar el curso. Intenta de nuevo.');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchMyCourses(user.uid).then(setMyCourses).catch((err) => {
      console.error('Error loading courses:', err);
    });
    fetchProfessorPrefs(user.uid).then((p) => setCourseOrder(p.courseOrder)).catch((err) => {
      // Sin preferencias se muestra el orden por defecto. Es una preferencia de
      // presentacion: no vale la pena bloquear el panel por ella.
      console.error('Error loading professor prefs:', err);
    });
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Hardcoded catalog courses are only shown to the admin (they belong to Naim)
  const builtinCourses = access === 'admin' ? COURSES : [];
  const compasDisponibles = Object.keys(COMPASES);

  // Las dos procedencias se ordenan JUNTAS. Ordenarlas por separado no serviria
  // de nada: los del catalogo quedarian siempre antes que los propios, que es
  // justo lo que hay que poder cambiar.
  const cards = applyCourseOrder(
    [
      ...builtinCourses.map((course) => ({ id: course.id, course, builtin: true })),
      ...myCourses.map((course) => ({ id: course.id, course, builtin: false })),
    ],
    courseOrder,
  );

  const persistOrder = (next: string[], committed: boolean) => {
    setCourseOrder(next);
    if (!committed || !user) return;
    saveCourseOrder(user.uid, next).catch((err) => {
      // El orden ya se movio en pantalla. Revertirlo aca seria peor: la tarjeta
      // saltaria sola de vuelta sin explicacion.
      console.error('Error saving course order:', err);
    });
  };

  const { dragId, overId, handleProps } = useCardReorder(cards.map((c) => c.id), persistOrder);

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
          {/* El compas no es una sesion y no aparece en la lista de sesiones de
              ningun curso: se abre por su cuenta. Sin este enlace la pantalla
              existe pero no hay como llegar a ella. */}
          {compasDisponibles.length > 0 && (
            <Link
              to="/professor/compas/nuevo"
              className="mb-6 flex items-center justify-between gap-3 rounded-xl border-2 border-line bg-surface-2 px-4 py-3 hover:bg-surface-3"
            >
              <span>
                <span className="block font-bold">Abrir un compas</span>
                <span className="text-muted text-sm">
                  Instrumento de posicionamiento, sin puntaje ni ranking
                </span>
              </span>
              <Compass className="w-5 h-5 shrink-0 text-cyan-400" />
            </Link>
          )}

          {compasDisponibles.map((cid) => (
            <Link
              key={cid}
              to={`/professor/compas/${cid}/comparacion`}
              className="mb-6 flex items-center justify-between gap-3 rounded-xl border-2 border-line bg-surface-2 px-4 py-3 hover:bg-surface-3"
            >
              <span>
                <span className="block font-bold">Como se movio el curso</span>
                <span className="text-muted text-sm">
                  Comparar dos aplicaciones del compas — {cid}
                </span>
              </span>
              <Trophy className="w-5 h-5 shrink-0 text-cyan-400" />
            </Link>
          ))}

          <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            Mis Cursos
          </h2>
          {cards.length > 1 && (
            <p className="text-muted text-sm mb-4 flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5 shrink-0" />
              Arrastra desde el asa para cambiar el orden. Se guarda solo.
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            {cards.map(({ id, course, builtin }) => {
              const sessionCount = builtin ? getSessionsForCourse(id).length : null;
              return (
                <div
                  key={id}
                  data-course-id={id}
                  className={`relative transition-opacity ${dragId === id ? 'opacity-40' : ''}`}
                >
                  {/* El asa. Es un boton para que llegue por tabulacion: con el
                      foco puesto, las flechas mueven la tarjeta, que es la unica
                      forma de reordenar sin mouse ni pantalla tactil. Con una
                      sola tarjeta no hay nada que ordenar y no aparece. */}
                  {cards.length > 1 && (
                    <button
                      {...handleProps(id, `Reordenar ${course.name}. Usa las flechas para moverlo.`)}
                      title="Arrastra para reordenar"
                      className="absolute top-3 right-3 z-10 p-2 rounded-lg text-faint hover:text-ink hover:bg-surface-2 transition-colors touch-none"
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                  )}

                  {!builtin && (
                    <button
                      onClick={() => removeCourse(course)}
                      disabled={deleting !== null}
                      title="Eliminar curso"
                      aria-label={`Eliminar el curso ${course.name}`}
                      className="absolute top-3 right-12 z-10 p-2 rounded-lg text-muted hover:text-kahoot-red hover:bg-surface-2 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* UNA sola forma de tarjeta para los dos tipos de curso.
                      Antes eran dos: la de un curso del repo era un div con
                      botones y la de uno creado desde la UI era un link entero a
                      `CourseHome`. Cada tipo llegaba a una pagina distinta y no
                      a la del otro — asi es como la lista de juegos jugados
                      nacio inalcanzable para los seis cursos reales.

                      El nombre del curso lleva a `CourseHome`, que ahora
                      resuelve los dos. Los atajos siguen en la tarjeta para no
                      cobrarle un click de mas a "Crear juego", que es lo que el
                      profesor viene a apretar. Van como links sueltos y no
                      envolviendo la tarjeta: un <a> dentro de otro <a> no es
                      HTML valido y el lector de pantalla anuncia cualquier
                      cosa. */}
                  <div className={`dramatic-card p-6 ${overId === id ? 'ring-2 ring-kahoot-orange' : ''}`}>
                    <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4`}>
                      <BookOpen className="w-7 h-7 text-onaccent" />
                    </div>
                    <Link to={`/professor/courses/${id}`} className="group block">
                      <h3 className="text-xl font-bold mb-1 group-hover:underline">{course.name}</h3>
                      <p className="text-muted text-sm mb-1">{course.tagline}</p>
                    </Link>
                    <p className="text-muted text-sm mb-4">
                      {sessionCount !== null
                        ? `${sessionCount} ${sessionCount === 1 ? 'sesion' : 'sesiones'}`
                        : 'Creado desde la app'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/professor/courses/${id}/create`}
                        className="flex-1 min-w-[110px] py-2 text-center bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors font-semibold text-sm"
                      >
                        Crear juego
                      </Link>
                      <Link
                        to={`/professor/courses/${id}`}
                        className="flex items-center gap-1 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        Sesiones
                      </Link>
                      <Link
                        to={`/professor/courses/${id}/judges`}
                        className="flex items-center gap-1 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm"
                      >
                        <Users className="w-4 h-4" />
                        Jueces
                      </Link>
                      <Link
                        to={`/professor/courses/${id}/tabla`}
                        className="flex items-center gap-1 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm"
                      >
                        <Trophy className="w-4 h-4" />
                        Tabla
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

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
