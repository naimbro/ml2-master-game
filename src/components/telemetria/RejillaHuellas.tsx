import HuellaSparkline from './HuellaSparkline';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';

export interface FilaAlumno {
  playerId: string;
  nombre: string;
  /** por numero de ronda */
  porRonda: Record<number, TelemetriaDoc>;
}

/**
 * Una fila por alumno, una columna por ronda abierta.
 *
 * NINGUNA fila se destaca y ningun nombre cambia de color. Ordenar "por
 * sospecha" o pintar al que mas pego seria clasificar, que es justo lo que este
 * panel no hace. El orden es alfabetico y punto.
 */
export default function RejillaHuellas({
  filas,
  rondas,
  duracionPorRonda,
  onSeleccion,
  seleccionada,
}: {
  filas: FilaAlumno[];
  rondas: number[];
  duracionPorRonda: Record<number, number>;
  onSeleccion: (t: TelemetriaDoc, nombre: string) => void;
  seleccionada: TelemetriaDoc | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted px-2 py-1">
              Alumno
            </th>
            {rondas.map((r) => (
              <th
                key={r}
                className="text-center text-[10px] font-bold uppercase tracking-widest text-muted px-2 py-1"
              >
                R{r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.playerId} className="border-t border-ink/10">
              <td className="px-2 py-1 font-semibold whitespace-nowrap">{fila.nombre}</td>
              {rondas.map((r) => {
                const t = fila.porRonda[r];
                if (!t) {
                  return (
                    <td key={r} className="px-2 py-1 text-center text-muted/50 text-xs">
                      —
                    </td>
                  );
                }
                const activa = seleccionada?.playerId === t.playerId && seleccionada?.round === r;
                return (
                  <td key={r} className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => onSeleccion(t, fila.nombre)}
                      className={`block mx-auto rounded px-0.5 ${activa ? 'ring-2 ring-ink' : 'hover:bg-surface-2'}`}
                      aria-label={`Ver como escribio ${fila.nombre} la ronda ${r}`}
                    >
                      <HuellaSparkline telemetria={t} duracionMs={duracionPorRonda[r] ?? 300_000} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
