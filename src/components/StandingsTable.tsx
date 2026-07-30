import type { CourseStandings, MyCourseStanding } from '../types/standings';

interface Props {
  standings: CourseStandings;
  mine: MyCourseStanding | null;
  myUid: string | undefined;
}

function Movement({ from, to }: { from: number | null; to: number }) {
  if (from === null) return <span className="text-muted">–</span>;
  const delta = from - to;
  if (delta === 0) return <span className="text-muted">–</span>;
  return (
    <span className={delta > 0 ? 'text-emerald-700 font-bold' : 'text-orange-ink font-bold'}>
      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
    </span>
  );
}

/**
 * Los diez primeros con nombre, y despues la fila del propio alumno si quedo
 * fuera de esos diez. Nadie puede recorrer el fondo de la lista: el resto del
 * curso no viaja al navegador.
 */
export default function StandingsTable({ standings, mine, myUid }: Props) {
  const inTop = Boolean(myUid && standings.top.some((r) => r.uid === myUid));
  // Con el semestre cerrado la posicion "anterior" siempre se calcula SIN el
  // descarte de las 2 peores clases, asi que la flecha de movimiento compara
  // contra un ranking que nadie jugo: es un artefacto del cierre, no un cambio
  // real. Se oculta para no mentirle al alumno.
  const finalized = standings.finalized;

  return (
    <div>
      <div className="flex items-center gap-3 px-3 pb-2 text-[11px] font-black uppercase tracking-wider text-muted">
        <span className="w-6 text-right">#</span>
        <span className="flex-1">Alumno</span>
        <span className="w-12 text-right">Mov.</span>
        <span className="w-16 text-right">Puntos</span>
      </div>

      <div className="space-y-1">
        {standings.top.map((row) => (
          <div
            key={row.uid}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
              row.uid === myUid
                ? 'border-2 border-kahoot-orange/40 bg-kahoot-orange/15'
                : 'bg-surface-2'
            }`}
          >
            <span className="w-6 text-right font-black tabular-nums">{row.position}</span>
            <span className="flex-1 truncate font-semibold">
              {row.name}
              {row.uid === myUid && ' (tú)'}
            </span>
            <span className="w-12 text-right text-sm">
              {finalized ? <span className="text-muted">–</span> : <Movement from={row.previousPosition} to={row.position} />}
            </span>
            <span className="w-16 text-right font-black tabular-nums">{row.points}</span>
          </div>
        ))}
      </div>

      {!inTop && mine && (
        <>
          <div className="text-center text-muted tracking-[0.3em] py-2">···</div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-kahoot-orange/40 bg-kahoot-orange/15">
            <span className="w-6 text-right font-black tabular-nums">{mine.position}</span>
            <span className="flex-1 truncate font-semibold">Tú</span>
            <span className="w-12 text-right text-sm">
              {finalized ? <span className="text-muted">–</span> : <Movement from={mine.previousPosition} to={mine.position} />}
            </span>
            <span className="w-16 text-right font-black tabular-nums">{mine.points}</span>
          </div>
        </>
      )}
    </div>
  );
}
