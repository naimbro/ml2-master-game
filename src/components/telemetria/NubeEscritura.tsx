import { formatoReloj, posicionNube, clasificarPunto } from '../../lib/telemetriaDerived';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';

const ANCHO = 380;
const ALTO = 215;
const MARGEN_IZQ = 42;
const MARGEN_ABAJO = 37;
const MARGEN_ARRIBA = 14;
const MARGEN_DER = 12;

const COLOR: Record<ReturnType<typeof clasificarPunto>, string> = {
  sospechoso: 'var(--wrong)',
  'no-sospechoso': 'var(--blue)',
  'sin-medicion': 'var(--faint)',
};

/**
 * Una respuesta por punto: x = cuanto tardo en escribir la primera letra,
 * y = que proporcion del texto llego de una vez.
 *
 * El eje vertical NO dice "pego". Dice cuanto texto entro de un golpe, que es
 * lo que efectivamente se midio: en Android no dispara ningun evento de pegado
 * —ni `paste` ni `insertFromPaste`— y una respuesta traida entera desde otra
 * app se dibujaba abajo del todo, entre las tecleadas.
 *
 * **Los puntos van de color desde el 2026-08-10.** Antes iban todos iguales, a
 * proposito, para que el panel describiera sin clasificar; Naim pidio el rojo y
 * el azul. El umbral vive en `clasificarPunto`, con el porque escrito al lado.
 * Lo unico que este componente decide es que el gris de `sin-medicion` sea gris
 * y no azul: son las respuestas que el navegador no entrego medidas, y decir
 * "no sospechoso" de algo que nadie midio es la unica forma en que este panel
 * puede mentir de verdad.
 *
 * La decision que sigue en pie: NO se muestran nombres. El nombre aparece solo
 * al hacer clic, que es un gesto deliberado de ir a buscarlo.
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
        const estado = clasificarPunto(telemetria);
        const color = COLOR[estado];
        return (
          <circle
            key={`${telemetria.playerId}_${telemetria.round}`}
            cx={MARGEN_IZQ + x}
            cy={MARGEN_ARRIBA + y}
            r={4.2}
            fill={color}
            fillOpacity={0.6}
            // El borde, y no solo el relleno, porque dos puntos superpuestos de
            // colores distintos se leen como uno solo de un tercer color.
            stroke={color}
            strokeOpacity={0.9}
            className="cursor-pointer"
            onClick={() => onSeleccion(telemetria, nombre)}
          >
            {/* Una sola cadena: React no acepta varios hijos en un <title>, y el
                navegador convierte todos los nodos a un texto plano igual. */}
            <title>
              {`Ronda ${telemetria.round}${estado === 'sin-medicion' ? ' · sin medición' : ''}`}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
