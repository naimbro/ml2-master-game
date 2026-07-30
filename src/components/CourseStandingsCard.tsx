import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { useCourseStandings } from '../hooks/useCourseStandings';

/** Cuanto esperamos el recalculo antes de rendirnos y avisar. */
const STANDINGS_TIMEOUT_MS = 10_000;

interface Props {
  courseId: string | undefined;
  /**
   * Si viene, la tarjeta espera a que el acumulado incluya este juego antes de
   * mostrar numeros: mas vale un esqueleto que mostrar la tabla vieja y
   * corregirla en la cara del alumno. Si a los 10 segundos el recalculo no
   * llego, se rinde y avisa en vez de esqueletar para siempre.
   */
  gameCode?: string;
}

function MovementLabel({ from, to }: { from: number | null; to: number }) {
  if (from === null) {
    return <span className="text-muted text-sm font-semibold">Tu primera clase del curso</span>;
  }
  const delta = from - to;
  if (delta === 0) {
    return (
      <span className="text-muted text-sm font-semibold inline-flex items-center gap-1">
        <Minus className="w-4 h-4" /> Mantuviste tu puesto
      </span>
    );
  }
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  const color = delta > 0 ? 'text-emerald-700' : 'text-orange-ink';
  const verb = delta > 0 ? 'Subiste' : 'Bajaste';
  const n = Math.abs(delta);
  return (
    <span className={`${color} text-sm font-bold inline-flex items-center gap-1`}>
      <Icon className="w-4 h-4" /> {verb} {n} {n === 1 ? 'puesto' : 'puestos'}
    </span>
  );
}

export default function CourseStandingsCard({ courseId, gameCode }: Props) {
  const { standings, mine, loading } = useCourseStandings(courseId);
  const [timedOut, setTimedOut] = useState(false);

  const includesThisGame =
    !gameCode || Boolean(standings?.gamesCounted?.some((g) => g.gameCode === gameCode));
  // El backend escribe el documento del curso ANTES que el de cada alumno, así
  // que ver el juego en gamesCounted no basta: hay que confirmar que lo mío
  // también se actualizó, o la tarjeta muestra la posición de la clase pasada
  // y se corrige sola un instante después.
  const mineIsCurrent =
    Boolean(mine) && mine!.positionsByGame.length === standings?.gamesCounted.length;
  const ready = !loading && standings && mine && mineIsCurrent && includesThisGame;

  useEffect(() => {
    if (!courseId || ready) return;
    const timer = setTimeout(() => setTimedOut(true), STANDINGS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [courseId, gameCode, ready]);

  if (!courseId) return null;

  if (!ready) {
    if (timedOut) {
      return (
        <div className="card-play p-6">
          <h2 className="text-xl font-black mb-4">Cómo vas en el curso</h2>
          <p className="text-muted text-sm">
            Todavía no podemos mostrarte cómo vas en el curso. Va a aparecer actualizado en la
            próxima clase.
          </p>
        </div>
      );
    }
    return (
      <div className="card-play p-6">
        <h2 className="text-xl font-black mb-4">Cómo vas en el curso</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-surface-2 rounded-xl" />
          <div className="h-4 bg-surface-2 rounded w-1/2" />
          <div className="h-4 bg-surface-2 rounded w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-play p-6"
    >
      <h2 className="text-xl font-black mb-1">Cómo vas en el curso</h2>
      <p className="text-muted text-sm mb-4">
        {standings.gamesCounted.length}{' '}
        {standings.gamesCounted.length === 1 ? 'clase jugada' : 'clases jugadas'}
      </p>

      <div className="rounded-2xl border-2 border-kahoot-orange/40 bg-kahoot-orange/15 p-5 text-center mb-5">
        <div className="text-5xl font-black leading-none">
          {mine.position}º <span className="text-lg font-bold text-muted">de {mine.playerCount}</span>
        </div>
        <div className="mt-2">
          <MovementLabel from={mine.previousPosition} to={mine.position} />
        </div>
        <div className="text-muted text-sm mt-1 font-semibold">{mine.points} puntos</div>
      </div>

      <div className="text-[11px] font-black uppercase tracking-wider text-muted mb-2">
        Punteros del curso
      </div>
      <div className="space-y-1">
        {standings.top.slice(0, 3).map((row) => (
          <div key={row.uid} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2">
            <span className="w-5 text-right font-black tabular-nums">{row.position}</span>
            <span className="flex-1 truncate font-semibold">{row.name}</span>
            <span className="font-black tabular-nums">{row.points}</span>
          </div>
        ))}
      </div>

      <Link
        to={`/curso/${courseId}/tabla`}
        className="mt-4 w-full py-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors font-bold flex items-center justify-center gap-1"
      >
        Ver la tabla completa <ChevronRight className="w-4 h-4" />
      </Link>

      <p className="text-muted text-xs mt-3">
        Al cerrar el semestre se descartan tus 2 peores clases.
      </p>
    </motion.div>
  );
}
