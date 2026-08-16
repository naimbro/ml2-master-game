import { RAMPA_AGENCIA } from '../../lib/compas';
import type { BandaAgencia, CompasAxis } from '../../types/compas';

export interface PuntoAgencia {
  id: string;
  /** null when this student has not answered anything on the third axis yet. */
  agencia: number | null;
  esMio?: boolean;
}

interface Props {
  puntos: PuntoAgencia[];
  eje: CompasAxis;
  bandas: BandaAgencia[];
  /** Draws the five-stop key. Off inside a phone card, where there is no room. */
  conLeyenda?: boolean;
}

/**
 * The class on the third axis, and nothing else.
 *
 * The colour of the dots on the plane already carries this, so why draw it
 * twice? Because on the plane it reads as decoration of the position, and it is
 * not: it is its own question, with its own poles and its own disagreement. A
 * class can be spread across the whole plane and unanimous here, or piled into
 * one archetype and split down the middle here, and neither of those is visible
 * from the cloud.
 *
 * It also carries the movement the plane cannot show. If the cloud keeps its
 * shape and this strip slides right between week 3 and week 15, the course kept
 * its political diagnosis and changed its mind about who is driving.
 *
 * Vertical jitter is cosmetic — it exists so twenty-five dots at the same value
 * do not stack into one. Only the horizontal position means anything.
 */
export default function TiraAgencia({ puntos, eje, bandas, conLeyenda = true }: Props) {
  const W = 720;
  const H = conLeyenda ? 108 : 62;
  const M = { t: 10, r: 22, b: conLeyenda ? 40 : 12, l: 22 };
  const PW = W - M.l - M.r;
  const PH = H - M.t - M.b;

  const rango = Math.max(1, eje.max - eje.min);
  const sx = (v: number) => M.l + ((v - eje.min) / rango) * PW;

  // Sin opinión en este eje: aparte y en gris, no en el medio. Poner en "en
  // disputa" a quien no dijo nada es exactamente la mentira que evita
  // `posicionDe` al devolver null.
  const conValor = puntos.filter((p) => Number.isFinite(p.agencia as number));
  const sinValor = puntos.length - conValor.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full bg-paper"
      role="img"
      aria-label={`El curso en el eje ${eje.label}, de ${eje.minLabel} a ${eje.maxLabel}`}
    >
      {bandas.map((b, i) => {
        const [lo, hi] = b.rango;
        return (
          <rect
            key={b.id}
            x={sx(lo)}
            y={M.t}
            width={Math.max(0, sx(hi) - sx(lo))}
            height={PH}
            fill={RAMPA_AGENCIA[Math.min(RAMPA_AGENCIA.length - 1, i)]}
            opacity={0.16}
          />
        );
      })}

      <line x1={M.l} y1={M.t + PH} x2={M.l + PW} y2={M.t + PH} stroke="#101114" strokeWidth={1.5} />

      {conValor.map((p, i) => {
        const v = p.agencia as number;
        const idx = Math.max(
          0,
          bandas.findIndex((b) => v >= b.rango[0] && v <= b.rango[1]),
        );
        return (
          <circle
            key={p.id}
            cx={sx(v)}
            cy={M.t + 12 + ((i * 7) % Math.max(1, PH - 24))}
            r={p.esMio ? 7 : 6}
            fill={p.esMio ? '#FF5A1F' : RAMPA_AGENCIA[Math.min(RAMPA_AGENCIA.length - 1, idx)]}
            stroke={p.esMio ? '#101114' : '#FAFAF8'}
            strokeWidth={p.esMio ? 2 : 1.5}
            className="[transition:cx_900ms_cubic-bezier(.22,.8,.28,1)] motion-reduce:transition-none"
          />
        );
      })}

      {conLeyenda && (
        <g>
          <text x={M.l} y={H - 22} className="fill-muted text-[12px]">
            {eje.minLabel}
          </text>
          <text x={M.l + PW} y={H - 22} textAnchor="end" className="fill-muted text-[12px]">
            {eje.maxLabel}
          </text>
          <text
            x={M.l + PW / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-ink text-[11px] uppercase"
            style={{ fontFamily: "'Archivo Black', sans-serif" }}
          >
            {eje.pregunta}
          </text>
          {sinValor > 0 && (
            <text x={M.l} y={H - 6} className="fill-faint text-[11px]">
              {sinValor} sin opinión en este eje todavía
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
