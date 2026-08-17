import type { CompasAxis } from '../../types/compas';

/**
 * Where a dot goes. NOT `CompasVector`: an option's vector may declare only one
 * axis --conditional items do-- but a point that gets drawn always has both.
 */
export interface PuntoXY {
  magnitud: number;
  direccion: number;
}

export interface PuntoCompas {
  id: string;
  pos: PuntoXY;
  /** Where this point sat in the previous round. Draws the trail. */
  previa?: PuntoXY | null;
  /** The viewer's own point. Orange, on top, and the only one that stands out. */
  esMio?: boolean;
  /**
   * Fill for the dot. Used to paint debate fields and, in a run, the third
   * axis; falls back to ink. Null on purpose when a student has not answered
   * anything on the agency axis — the room should be able to see that.
   */
  color?: string | null;
}

interface Props {
  puntos: PuntoCompas[];
  ejeX: CompasAxis;
  ejeY: CompasAxis;
  /** 'proyector' carries the axis wording; 'mini' fits inside a phone card. */
  modo?: 'proyector' | 'mini';
  /**
   * Puts an arrowhead on the trail. For a run the trail is just "it moved a
   * bit"; for a March-vs-November comparison the direction IS the finding, and
   * a plain segment leaves the reader guessing which end is now.
   */
  flechas?: boolean;
  className?: string;
}

/**
 * The class cloud on the two axes.
 *
 * Trails, not just animation: each point drags where it came from. The movement
 * has to survive a student who was looking at their phone when the room's cloud
 * shifted, and an animation that already played cannot be re-read.
 *
 * No names anywhere. This is projected in front of the class, and a student's
 * opinions are not a thing to put on a wall with a label on it — each one
 * recognises their own point and nobody else's.
 */
export default function CompasPlano({ puntos, ejeX, ejeY, modo = 'proyector', flechas = false, className }: Props) {
  const proy = modo === 'proyector';
  const W = 720;
  const H = proy ? 560 : 300;
  const M = proy ? { t: 46, r: 150, b: 52, l: 64 } : { t: 16, r: 16, b: 16, l: 16 };
  const PW = W - M.l - M.r;
  const PH = H - M.t - M.b;

  const rango = (eje: CompasAxis) => Math.max(1, eje.max - eje.min);
  const sx = (v: number) => M.l + ((v - ejeX.min) / rango(ejeX)) * PW;
  const sy = (v: number) => M.t + ((ejeY.max - v) / rango(ejeY)) * PH; // up = fortalece
  const r = proy ? 7 : 4.5;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`block h-auto w-full bg-paper ${className ?? ''}`}
      role="img"
      aria-label={`Posiciones del curso en ${ejeX.label} por ${ejeY.label}`}
    >
      {flechas && (
        <defs>
          <marker id="compas-punta" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="#101114" opacity="0.55" />
          </marker>
          <marker id="compas-punta-mia" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="#FF5A1F" />
          </marker>
        </defs>
      )}

      {[1, 2, 3].map((i) => (
        <g key={i} stroke="#E6E5E0" strokeWidth={1}>
          <line x1={M.l} y1={M.t + (i * PH) / 4} x2={M.l + PW} y2={M.t + (i * PH) / 4} />
          <line x1={M.l + (i * PW) / 4} y1={M.t} x2={M.l + (i * PW) / 4} y2={M.t + PH} />
        </g>
      ))}

      <line x1={M.l} y1={sy(0)} x2={M.l + PW} y2={sy(0)} stroke="#101114" strokeWidth={1.5} />
      <line x1={sx(0)} y1={M.t} x2={sx(0)} y2={M.t + PH} stroke="#101114" strokeWidth={1.5} />

      {proy && (
        <g>
          <text x={M.l} y={M.t - 24} className="fill-ink text-[12px] uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            {ejeY.label} ↑
          </text>
          <text x={M.l} y={M.t - 8} className="fill-muted text-[12px]">{ejeY.maxLabel}</text>
          <text x={M.l} y={M.t + PH + 34} className="fill-muted text-[12px]">{ejeY.minLabel}</text>
          <text x={M.l} y={M.t + PH + 18} className="fill-muted text-[12px]">{ejeX.minLabel}</text>
          <text x={M.l + PW} y={M.t + PH + 18} textAnchor="end" className="fill-muted text-[12px]">
            {ejeX.maxLabel}
          </text>
          <text
            x={M.l + PW}
            y={M.t + PH + 34}
            textAnchor="end"
            className="fill-ink text-[12px] uppercase"
            style={{ fontFamily: "'Archivo Black', sans-serif" }}
          >
            {ejeX.label} →
          </text>
        </g>
      )}

      {/* Trails first, so no line crosses over a point. */}
      {puntos.map((p) =>
        p.previa ? (
          <g key={`t-${p.id}`}>
            <line
              x1={sx(p.previa.magnitud)}
              y1={sy(p.previa.direccion)}
              x2={sx(p.pos.magnitud)}
              y2={sy(p.pos.direccion)}
              stroke={p.esMio ? '#FF5A1F' : '#101114'}
              strokeWidth={p.esMio ? 2.2 : 1.4}
              opacity={p.esMio ? 0.75 : flechas ? 0.5 : 0.28}
              markerEnd={
                flechas ? `url(#${p.esMio ? 'compas-punta-mia' : 'compas-punta'})` : undefined
              }
            />
            <circle
              cx={sx(p.previa.magnitud)}
              cy={sy(p.previa.direccion)}
              r={r * 0.7}
              fill="none"
              stroke={p.esMio ? '#FF5A1F' : '#101114'}
              strokeWidth={1.4}
              opacity={p.esMio ? 0.5 : 0.22}
            />
          </g>
        ) : null,
      )}

      {[...puntos].sort((a, b) => Number(a.esMio) - Number(b.esMio)).map((p) => (
        <circle
          key={p.id}
          cx={sx(p.pos.magnitud)}
          cy={sy(p.pos.direccion)}
          r={p.esMio ? r + 1 : r}
          fill={p.esMio ? '#FF5A1F' : (p.color ?? '#101114')}
          stroke={p.esMio ? '#101114' : '#FAFAF8'}
          strokeWidth={p.esMio ? 2 : 1.5}
          className="[transition:cx_900ms_cubic-bezier(.22,.8,.28,1),cy_900ms_cubic-bezier(.22,.8,.28,1)] motion-reduce:transition-none"
        />
      ))}
    </svg>
  );
}
