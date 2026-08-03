import type { PublicStandingsRow } from '../types/standings';

interface Props {
  rows: PublicStandingsRow[];
}

/**
 * Los primeros del curso como lista, para cuando todavia no hay trayectoria que
 * dibujar.
 *
 * Con una sola clase jugada el grafico de trayectorias no grafica nada: todas
 * las columnas colapsan a un punto y lo unico que queda es el orden. Peor aun,
 * dos empatados caen en el mismo pixel — el 2026-08-03 se proyecto "Ivan W" y
 * "Benicio Arraga" impresos uno encima del otro. Con una clase esto es una
 * lista, y a partir de la segunda vuelve el grafico.
 *
 * Los empates se dicen en vez de esconderse: dos quintos son dos quintos, y el
 * numero repetido sin explicacion se lee como un error.
 */
export default function TopSixList({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-muted text-sm">Todavía no hay clases jugadas.</p>;
  }

  const shared = new Set(
    rows.map((r) => r.position).filter((p, i, all) => all.indexOf(p) !== i)
  );

  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const tied = shared.has(row.position);
        return (
          <li
            key={row.uid}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl bg-surface-2 ${
              tied ? 'border-l-4 border-kahoot-orange' : ''
            }`}
          >
            <span
              /* Los tres rellenos del podio son fill-only y llevan texto tinta,
                 igual que los dorsales del leaderboard en Results.tsx. */
              className={`w-10 h-10 shrink-0 sticker flex items-center justify-center font-black text-lg text-ink tabular-nums ${
                row.position === 1
                  ? 'bg-kahoot-yellow'
                  : row.position === 2
                  ? 'bg-surface-3'
                  : row.position === 3
                  ? 'bg-kahoot-orange'
                  : 'bg-surface'
              }`}
            >
              {row.position}
            </span>

            <span className="flex-1 min-w-0 font-bold text-lg truncate">
              {row.name}
              {tied && (
                <span className="ml-2 text-[11px] font-black uppercase tracking-wider text-orange-ink">
                  empate
                </span>
              )}
            </span>

            <span className="font-black text-lg tabular-nums shrink-0">
              {row.points}
              <span className="text-muted text-sm font-bold ml-1">pts</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
