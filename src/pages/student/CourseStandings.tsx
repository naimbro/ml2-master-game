import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCourseStandings } from '../../hooks/useCourseStandings';
import { getCourse } from '../../lib/courses';
import StandingsTable from '../../components/StandingsTable';

export default function CourseStandings() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { standings, mine, loading } = useCourseStandings(courseId);
  const course = courseId ? getCourse(courseId) : undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main p-4">
      <div className="max-w-xl mx-auto py-6 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-muted hover:underline">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div>
          <h1 className="text-2xl font-black">Cómo va el curso</h1>
          <p className="text-muted text-sm">
            {course?.name ?? courseId}
            {standings && ` · ${standings.gamesCounted.length} ${
              standings.gamesCounted.length === 1 ? 'clase jugada' : 'clases jugadas'
            }`}
          </p>
        </div>

        {!standings ? (
          <div className="card-play p-6 text-center text-muted">
            Todavía no hay ninguna clase jugada en este curso.
          </div>
        ) : (
          <>
            <div className="card-play p-5">
              <StandingsTable standings={standings} mine={mine} myUid={user?.uid} />
            </div>

            {mine && (
              <div className="card-play p-5">
                <h2 className="font-black mb-3">Tu recorrido</h2>
                <div className="flex flex-wrap gap-2">
                  {mine.positionsByGame.map((pos, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-xl bg-surface-2 text-center min-w-[68px]"
                    >
                      <div className="text-[10px] font-bold uppercase text-muted">
                        Clase {i + 1}
                      </div>
                      <div className="font-black tabular-nums">
                        {pos === null ? '—' : `${pos}º`}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-muted text-xs mt-3">
                  Al cerrar el semestre se descartan tus 2 peores clases.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
