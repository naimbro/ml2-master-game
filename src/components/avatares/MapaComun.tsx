import type { Mapa } from '../../lib/avatares/analitica/mapa';
import type { ResultadoCN } from '../../lib/avatares/analitica/puentes';
import type { Fuente } from '../../lib/avatares/contrato';
import { COLOR_FUENTE, NOMBRE_FUENTE, coma } from './colores';

/**
 * Un solo plano: personas (puntos) y propuestas (rombos numerados, ubicados por
 * sus cargas). Es la pantalla de Evans y Weyl: gente y propuestas en el mismo
 * espacio. Las propuestas casi siempre cargan hacia el mismo lado del eje, asi
 * que el texto va en una leyenda numerada al costado y no encima del plano,
 * donde se encimaba. Sin nombres: cada uno reconoce su punto, nadie el de otro.
 */
export default function MapaComun({ mapa, cn, textos, fuentes }: {
  mapa: Mapa; cn: ResultadoCN; textos: Record<string, string>; fuentes: Fuente[];
}) {
  const W = 900, H = 600, pad = 40;
  const visibles = mapa.puntos.filter((p) => fuentes.includes(p.fuente));
  const ext = Math.max(1e-6, ...visibles.map((p) => Math.abs(p.x)), ...visibles.map((p) => Math.abs(p.y)));
  const sx = (x: number) => W / 2 + (x / ext) * (W / 2 - pad);
  const sy = (y: number) => H / 2 - (y / ext) * (H / 2 - pad);
  const escalaCarga = ext * 0.85;
  const intercepto = (id: string) => cn.propuestas[id]?.intercepto ?? 0;
  // Numeracion por puntaje puente: 1 = la mas puente.
  const orden = [...mapa.cargas].sort((a, b) => intercepto(b.propuesta) - intercepto(a.propuesta));
  const numero = new Map(orden.map((c, i) => [c.propuesta, i + 1]));
  return (
    <figure className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="max-h-[70vh] w-full border-2 border-ink bg-surface"
        role="img"
        aria-label="Mapa común de personas y propuestas"
      >
        <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} stroke="#E6E5E0" strokeWidth={2} />
        <line y1={pad} y2={H - pad} x1={W / 2} x2={W / 2} stroke="#E6E5E0" strokeWidth={2} />
        {visibles.map((p) => (
          <circle
            key={p.personaId}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={p.fuente === 'humano' ? 8 : 6}
            fill={COLOR_FUENTE[p.fuente]}
            fillOpacity={p.fuente === 'humano' ? 0.85 : 0.5}
          />
        ))}
        {(() => {
          // Los bots identicos caen en un solo punto (Evans y Weyl): se marca con un anillo y cuantos son.
          const bots = visibles.filter((p) => p.fuente === 'bot');
          if (!bots.length) return null;
          const x = sx(bots[0].x), y = sy(bots[0].y);
          return (
            <g>
              <circle cx={x} cy={y} r={18} fill="none" stroke="#767980" strokeWidth={3} />
              <text x={x + 24} y={y + 6} fontSize={18} fontWeight={700} fill="#3A3D45" fontFamily="Outfit, system-ui, sans-serif">
                ×{bots.length}
              </text>
            </g>
          );
        })()}
        {mapa.cargas.map((c) => {
          const x = sx(c.x * escalaCarga), y = sy(c.y * escalaCarga);
          return (
            <g key={c.propuesta}>
              <rect
                x={x - 11} y={y - 11} width={22} height={22}
                transform={`rotate(45 ${x} ${y})`}
                fill="#F5A524" stroke="#101114" strokeWidth={1.5}
                fillOpacity={Math.min(1, 0.35 + Math.max(0, intercepto(c.propuesta)))}
              />
              <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#101114" fontFamily="Outfit, system-ui, sans-serif">
                {numero.get(c.propuesta)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="space-y-3 text-sm text-ink-soft">
        <div className="space-y-1">
          {fuentes.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_FUENTE[f] }} /> {NOMBRE_FUENTE[f]}
            </div>
          ))}
        </div>
        <ol className="space-y-0.5">
          {orden.map((c) => (
            <li key={c.propuesta} className="flex gap-2">
              <span className="w-5 text-right font-bold tabular-nums text-ink">{numero.get(c.propuesta)}</span>
              <span className="flex-1">{textos[c.propuesta]}</span>
              <span className="tabular-nums text-muted">{coma(intercepto(c.propuesta))}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted">◆ Propuestas por puntaje puente (Community Notes): 1 = la más transversal; más llena = más puente.</p>
        {mapa.degenerado && <p className="font-semibold text-ink">Pocos datos: el mapa es orientativo.</p>}
      </figcaption>
    </figure>
  );
}
