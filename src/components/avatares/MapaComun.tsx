import type { Mapa } from '../../lib/avatares/analitica/mapa';
import type { ResultadoCN } from '../../lib/avatares/analitica/puentes';
import type { Fuente } from '../../lib/avatares/contrato';
import { COLOR_FUENTE, NOMBRE_FUENTE } from './colores';

/**
 * Un solo plano: personas (puntos) y propuestas (rombos, ubicadas por sus
 * cargas). Es la pantalla de Evans y Weyl: gente y propuestas en el mismo
 * espacio. Sin nombres: cada uno reconoce su punto, nadie el de otro.
 */
export default function MapaComun({ mapa, cn, textos, fuentes }: {
  mapa: Mapa; cn: ResultadoCN; textos: Record<string, string>; fuentes: Fuente[];
}) {
  const W = 960, H = 600, pad = 48;
  const visibles = mapa.puntos.filter((p) => fuentes.includes(p.fuente));
  const ext = Math.max(1e-6, ...visibles.map((p) => Math.abs(p.x)), ...visibles.map((p) => Math.abs(p.y)));
  const sx = (x: number) => W / 2 + (x / ext) * (W / 2 - pad);
  const sy = (y: number) => H / 2 - (y / ext) * (H / 2 - pad);
  const escalaCarga = ext * 0.85;
  const intercepto = (id: string) => cn.propuestas[id]?.intercepto ?? 0;
  return (
    <figure className="space-y-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full border-2 border-ink bg-surface" role="img" aria-label="Mapa común de personas y propuestas">
        <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} stroke="#E6E5E0" strokeWidth={2} />
        <line y1={pad} y2={H - pad} x1={W / 2} x2={W / 2} stroke="#E6E5E0" strokeWidth={2} />
        {visibles.map((p) => (
          <circle
            key={p.personaId}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={p.fuente === 'humano' ? 8 : 6}
            fill={COLOR_FUENTE[p.fuente]}
            fillOpacity={p.fuente === 'humano' ? 0.85 : 0.55}
          />
        ))}
        {mapa.cargas.map((c) => {
          const x = sx(c.x * escalaCarga), y = sy(c.y * escalaCarga);
          const izquierda = x > W * 0.7;
          return (
            <g key={c.propuesta}>
              <rect
                x={x - 7} y={y - 7} width={14} height={14}
                transform={`rotate(45 ${x} ${y})`}
                fill="#F5A524" stroke="#101114" strokeWidth={1.5}
                fillOpacity={Math.min(1, 0.35 + Math.max(0, intercepto(c.propuesta)))}
              />
              <text
                x={izquierda ? x - 12 : x + 12} y={y + 5}
                textAnchor={izquierda ? 'end' : 'start'}
                fontSize={16} fill="#3A3D45" fontFamily="Outfit, system-ui, sans-serif"
              >
                {textos[c.propuesta]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
        {fuentes.map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_FUENTE[f] }} /> {NOMBRE_FUENTE[f]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rotate-45 border border-ink bg-[#F5A524]" /> Propuestas (más llena = más puente)
        </span>
        {mapa.degenerado && <span className="font-semibold text-ink">Pocos datos: el mapa es orientativo.</span>}
      </figcaption>
    </figure>
  );
}
