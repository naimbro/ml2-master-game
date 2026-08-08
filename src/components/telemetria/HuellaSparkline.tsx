import { puntosHuella } from '../../lib/telemetriaDerived';
import type { TelemetriaCaptura } from '../../lib/telemetriaDerived';

/**
 * Como crecio el texto durante la ronda, en 52x20 px.
 *
 * Una rampa diagonal = fue tecleando. Un acantilado vertical = entro un bloque
 * de golpe. Un acantilado seguido de rampa = pego y despues lo trabajo.
 *
 * Sin color, sin escala de calor, sin etiqueta. La forma se lee sola, y no
 * envejece: si manana cambiamos de opinion sobre que significa cada forma, el
 * dibujo sigue siendo correcto.
 */
export default function HuellaSparkline({
  telemetria,
  duracionMs,
  ancho = 52,
  alto = 20,
}: {
  telemetria: TelemetriaCaptura;
  duracionMs: number;
  ancho?: number;
  alto?: number;
}) {
  return (
    <svg width={ancho} height={alto} className="block text-ink" aria-hidden="true">
      <polyline
        points={`2,${alto - 2} ${ancho - 2},${alto - 2}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1}
      />
      <polyline
        points={puntosHuella(telemetria, duracionMs, ancho, alto)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
