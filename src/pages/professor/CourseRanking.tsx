import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Lock } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { getCourse } from '../../lib/courses';
import { fetchCourse } from '../../lib/dynamicCourses';
import TrajectoryChart from '../../components/TrajectoryChart';
import TopSixList from '../../components/TopSixList';
import type { CourseStandings } from '../../types/standings';

export default function CourseRanking() {
  const { courseId } = useParams<{ courseId: string }>();
  const [standings, setStandings] = useState<CourseStandings | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Distingue "todavia no llego el primer snapshot" de "el curso no tiene
  // tabla": sin esto, un curso con historial real muestra un instante el
  // mensaje de "Todavia no hay tabla", que es falso.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    // Los cursos del repo no tienen documento en Firestore; los dinamicos si.
    // CourseHome.tsx solo sabe resolver los dinamicos — por eso esta pantalla
    // repite el mismo patron que CreateGame.tsx.
    const builtin = getCourse(courseId);
    if (builtin) setCourseName(builtin.name);
    else fetchCourse(courseId).then((c) => setCourseName(c?.name ?? courseId)).catch(() => setCourseName(courseId));

    return onSnapshot(doc(db, 'standings', courseId), (snap) => {
      setStandings(snap.exists() ? (snap.data() as CourseStandings) : null);
      setLoading(false);
    });
  }, [courseId]);

  const call = async (payload: Record<string, unknown>) => {
    if (!courseId) return;
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'recomputeCourseStandings');
      await fn({ courseId, ...payload });
    } catch (err) {
      console.error(err);
      setError('No se pudo recalcular. Revisa la consola.');
    } finally {
      setBusy(false);
    }
  };

  const closeSemester = () => {
    if (!window.confirm(
      'Esto aplica el descarte de las 2 peores clases a TODOS los alumnos del curso, ' +
      'de una vez y sin poder elegir a quien.\n\n' +
      'Hazlo solo cuando el semestre ya terminó. Apretar "Recalcular" despues NO lo deshace: ' +
      'una vez cerrado, el semestre queda cerrado hasta que uses "Reabrir el semestre" aca mismo.'
    )) return;
    call({ final: true });
  };

  const reopenSemester = () => {
    if (!window.confirm(
      'Esto reabre el semestre: la tabla vuelve a sumar todas las clases de todos los ' +
      'alumnos, sin descartar ninguna.\n\n' +
      'Hazlo solo si cerraste por error o falta agregar clases. Vas a tener que volver a ' +
      'cerrar cuando el semestre termine de verdad.'
    )) return;
    call({ final: false });
  };

  const excluded = standings?.excludedGameCodes ?? [];
  const singleClass = (standings?.gamesCounted.length ?? 0) <= 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main p-4">
      <div className="max-w-5xl mx-auto py-6 space-y-6">
        <Link to="/professor" className="inline-flex items-center gap-2 text-muted hover:underline">
          <ArrowLeft className="w-4 h-4" /> Volver al panel
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black">Tabla acumulada</h1>
            <p className="text-muted text-sm">{courseName || courseId}</p>
          </div>
          <button
            onClick={() => call({})}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 font-bold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Recalcular
          </button>
        </div>

        {error && <p className="text-orange-ink font-semibold">{error}</p>}

        {!standings ? (
          <div className="dramatic-card p-6 text-muted">
            Todavía no hay tabla para este curso. Apreta &quot;Recalcular&quot; después de la primera clase.
          </div>
        ) : (
          <>
            <div className="dramatic-card p-6">
              <h2 className="font-black mb-1">Los seis de arriba</h2>
              <p className="text-muted text-sm mb-4">
                {singleClass
                  ? 'Proyectable. Quien no está entre los seis no aparece. Desde la clase 2 esto se convierte en el gráfico de trayectorias.'
                  : 'Proyectable. Quien no está entre los seis no aparece. Cada línea es el puesto en esta tabla después de cada clase, no el puesto que sacó dentro de ese juego.'}
              </p>
              {/* Con una sola clase no hay trayectoria: el grafico colapsa a una
                  columna y los empatados quedan en el mismo pixel. Ahi va la lista. */}
              {singleClass ? (
                <TopSixList rows={standings.top.slice(0, 6)} />
              ) : (
                <TrajectoryChart
                  entries={standings.top.slice(0, 6).map((r) => ({
                    name: r.name,
                    // El puesto en la TABLA del curso despues de cada clase, no
                    // el que sacaron dentro de cada juego. Toda esta pantalla
                    // promete el acumulado; el eje tiene que decir lo mismo.
                    // Las tablas escritas antes del 2026-08-11 no traen el
                    // campo: hasta el proximo "Recalcular" se sigue viendo el
                    // grafico viejo, que es preferible a una figura vacia.
                    positionsByGame: r.cumulativePositionsByGame ?? r.positionsByGame,
                  }))}
                  gameCount={standings.gamesCounted.length}
                />
              )}
            </div>

            <div className="dramatic-card p-6">
              <h2 className="font-black mb-1">Juegos que cuentan</h2>
              <p className="text-muted text-sm mb-4">
                Una clase, un juego: de cada sesión cuenta el que tuvo más alumnos. Los de prueba
                quedan afuera solos.
              </p>
              <div className="space-y-2">
                {standings.gamesCounted.map((g) => (
                  <div key={g.gameCode} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-2">
                    <span className="font-mono font-bold">{g.gameCode}</span>
                    <span className="flex-1 truncate text-sm text-muted">{g.sessionTitle}</span>
                    {g.playedCount !== undefined && (
                      <span className="text-sm text-muted tabular-nums shrink-0">
                        {g.playedCount} {g.playedCount === 1 ? 'alumno' : 'alumnos'}
                      </span>
                    )}
                    <button
                      onClick={() => call({ exclude: { gameCode: g.gameCode, excluded: true } })}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-2 text-sm font-bold disabled:opacity-50"
                    >
                      No contar
                    </button>
                  </div>
                ))}
              </div>

              {(standings.gamesShadowed?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-muted mb-1">
                    Fuera por tener menos alumnos
                  </div>
                  <p className="text-muted text-xs mb-2">
                    Su clase ya tiene un juego oficial. Para que cuente uno de estos, aprieta
                    &quot;No contar&quot; en el oficial de esa clase y este toma su lugar.
                  </p>
                  <div className="space-y-2">
                    {standings.gamesShadowed!.map((g) => (
                      <div
                        key={g.gameCode}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-2 opacity-70"
                      >
                        <span className="font-mono font-bold">{g.gameCode}</span>
                        <span className="flex-1 truncate text-sm text-muted">{g.sessionTitle}</span>
                        {g.playedCount !== undefined && (
                          <span className="text-sm text-muted tabular-nums shrink-0">
                            {g.playedCount} {g.playedCount === 1 ? 'alumno' : 'alumnos'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {excluded.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-black uppercase tracking-wider text-muted mb-2">
                    Excluidos
                  </div>
                  <div className="space-y-2">
                    {excluded.map((code) => (
                      <div key={code} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-2 opacity-70">
                        <span className="font-mono font-bold">{code}</span>
                        <span className="flex-1" />
                        <button
                          onClick={() => call({ exclude: { gameCode: code, excluded: false } })}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-2 text-sm font-bold disabled:opacity-50"
                        >
                          Volver a contar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border-2 border-kahoot-orange/40 bg-kahoot-orange/15 p-6">
              <h2 className="font-black mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Cierre del semestre
              </h2>
              <p className="text-sm mb-1">
                Aplica el descarte de las 2 peores clases a <strong>todos</strong> los alumnos del curso
                a la vez. Apriétalo <strong>solo cuando el semestre ya terminó</strong>: mientras el
                curso sigue en marcha, la tabla tiene que sumar todo, o un alumno podría subir de puesto
                justo en la semana que le fue mal.
              </p>
              <p className="text-sm font-bold mb-1">
                Estado actual: {standings.finalized ? 'cerrado, con el descarte aplicado' : 'abierto, sin descarte'}.
              </p>
              <p className="text-muted text-xs mb-4">
                {standings.finalized
                  ? 'El botón "Recalcular" de arriba NO deshace el cierre: solo actualiza los puntajes manteniendo el descarte. Para volver a abrirlo, usa el botón de aquí abajo.'
                  : 'Mientras esté abierto, "Recalcular" arriba solo actualiza los puntajes: no aplica descarte ni cierra nada.'}
              </p>
              {standings.finalized ? (
                <button
                  onClick={reopenSemester}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-2 font-bold disabled:opacity-50 border-2 border-line"
                >
                  Reabrir el semestre
                </button>
              ) : (
                <button
                  onClick={closeSemester}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-2 font-bold disabled:opacity-50 border-2 border-line"
                >
                  Aplicar descarte y cerrar el semestre
                </button>
              )}
            </div>

            <p className="text-muted text-sm">
              La tabla completa con los {standings.playerCount} alumnos no vive en la app. Para verla:
              <code className="mx-1 px-2 py-0.5 rounded bg-surface-2">npx tsx scripts/course-standings.ts {courseId}</code>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
