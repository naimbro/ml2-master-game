import { hechosDetalle, puntosHuella } from '../../lib/telemetriaDerived';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';

/**
 * Los hechos de una respuesta, y la huella en grande.
 *
 * El parrafo del pie NO es decorativo: es la regla del diseno puesta en la
 * pantalla donde se toman las decisiones. No se saca.
 */
export default function DetalleRespuesta({
  telemetria,
  nombre,
  duracionMs,
}: {
  telemetria: TelemetriaDoc;
  nombre: string;
  duracionMs: number;
}) {
  const hechos = hechosDetalle(telemetria, duracionMs);

  return (
    <div className="mt-4 rounded-lg border border-ink/20 bg-surface-2 p-4">
      <h3 className="font-bold text-sm mb-3">
        {nombre} · Ronda {telemetria.round}
      </h3>

      <dl className="space-y-1">
        {hechos.map((hecho) => (
          <div key={hecho.etiqueta} className="flex gap-3 text-xs">
            <dt className="w-44 shrink-0 font-semibold text-muted">{hecho.etiqueta}</dt>
            <dd>{hecho.valor}</dd>
          </div>
        ))}
      </dl>

      <svg viewBox="0 0 320 46" className="w-full mt-3 text-ink" aria-hidden="true">
        <polyline points="4,44 316,44" fill="none" stroke="currentColor" strokeOpacity={0.25} />
        <polyline
          points={puntosHuella(telemetria, duracionMs, 320, 46)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>

      <p className="text-xs text-muted mt-3">
        <strong>Nada de esto dice «copió».</strong> Dice qué pasó. Puede ser un texto redactado
        en el bloc de notas, y esta pantalla no puede saberlo.
      </p>
    </div>
  );
}
