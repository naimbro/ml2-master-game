import { formatoReloj, posicionNube } from '../../lib/telemetriaDerived';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';

const ANCHO = 380;
const ALTO = 215;
const MARGEN_IZQ = 42;
const MARGEN_ABAJO = 37;
const MARGEN_ARRIBA = 14;
const MARGEN_DER = 12;

/**
 * Una respuesta por punto: x = cuanto tardo en escribir la primera letra,
 * y = que proporcion del texto llego de una vez.
 *
 * El eje vertical NO dice "pego". Dice cuanto texto entro de un golpe, que es
 * lo que efectivamente se midio: en Android no dispara ningun evento de pegado
 * —ni `paste` ni `insertFromPaste`— y una respuesta traida entera desde otra
 * app se dibujaba abajo del todo, entre las tecleadas. Dictar y el teclado
 * deslizante insertan palabras sueltas, asi que se quedan abajo solos, sin que
 * haya que fijar ningun umbral.
 *
 * Dos decisiones que NO se pueden cambiar sin rediscutir el diseno:
 *
 * 1. TODOS los puntos van del mismo color. Pintar de otro color a los de arriba
 *    a la derecha seria aplicar un umbral, o sea clasificar. La nube deja ver
 *    donde esta la masa; no dibuja la frontera por ti.
 * 2. NO se muestran nombres. El nombre aparece solo al hacer clic, que es un
 *    gesto deliberado de ir a buscarlo.
 */
export default function NubeEscritura({
  puntos,
  duracionMaxMs,
  onSeleccion,
}: {
  puntos: Array<{ telemetria: TelemetriaDoc; nombre: string }>;
  duracionMaxMs: number;
  onSeleccion: (t: TelemetriaDoc, nombre: string) => void;
}) {
  const anchoTrazo = ANCHO - MARGEN_IZQ - MARGEN_DER;
  const altoTrazo = ALTO - MARGEN_ARRIBA - MARGEN_ABAJO;

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full text-ink" role="img"
         aria-label={`Nube de ${puntos.length} respuestas`}>
      {/* ejes */}
      <line x1={MARGEN_IZQ} y1={ALTO - MARGEN_ABAJO} x2={ANCHO - MARGEN_DER} y2={ALTO - MARGEN_ABAJO}
            stroke="currentColor" strokeOpacity={0.3} />
      <line x1={MARGEN_IZQ} y1={MARGEN_ARRIBA} x2={MARGEN_IZQ} y2={ALTO - MARGEN_ABAJO}
            stroke="currentColor" strokeOpacity={0.3} />

      <text x={ANCHO / 2} y={ALTO - 6} textAnchor="middle" fontSize={10}
            fill="currentColor" opacity={0.65}>
        tiempo hasta la primera tecla
      </text>
      <text x={12} y={ALTO / 2} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.65}
            transform={`rotate(-90 12 ${ALTO / 2})`}>
        % que llegó de una vez
      </text>

      <text x={MARGEN_IZQ} y={ALTO - MARGEN_ABAJO + 12} textAnchor="middle" fontSize={8.5}
            fill="currentColor" opacity={0.45}>0</text>
      <text x={ANCHO - MARGEN_DER} y={ALTO - MARGEN_ABAJO + 12} textAnchor="middle" fontSize={8.5}
            fill="currentColor" opacity={0.45}>{formatoReloj(duracionMaxMs)}</text>
      <text x={MARGEN_IZQ - 6} y={ALTO - MARGEN_ABAJO + 3} textAnchor="end" fontSize={8.5}
            fill="currentColor" opacity={0.45}>0</text>
      <text x={MARGEN_IZQ - 6} y={MARGEN_ARRIBA + 4} textAnchor="end" fontSize={8.5}
            fill="currentColor" opacity={0.45}>100</text>

      {puntos.map(({ telemetria, nombre }) => {
        const { x, y } = posicionNube(telemetria, duracionMaxMs, anchoTrazo, altoTrazo);
        return (
          <circle
            key={`${telemetria.playerId}_${telemetria.round}`}
            cx={MARGEN_IZQ + x}
            cy={MARGEN_ARRIBA + y}
            r={4}
            fill="currentColor"
            fillOpacity={0.45}
            className="cursor-pointer"
            onClick={() => onSeleccion(telemetria, nombre)}
          >
            <title>Ronda {telemetria.round}</title>
          </circle>
        );
      })}
    </svg>
  );
}
