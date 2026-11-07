import type { Vista } from '../../lib/avatares/vista';
import { ARCHIVO } from './colores';

/** Lo que aprueba una camara contado por mayoria y contado por puente, lado a lado. */
export default function TablaPuente({ vista, camara }: { vista: Vista; camara: string }) {
  const c = vista.porCamara[camara];
  if (!c) return null;
  const filas = c.rankings.mayoria.length;
  const pct = (id: string) => {
    const t = c.aprobacion[id]?.tasa;
    return Number.isFinite(t) ? `${Math.round(t * 100)}%` : '—';
  };
  return (
    <section className="dramatic-card overflow-x-auto p-4">
      <h3 className="mb-1 text-lg uppercase leading-tight" style={ARCHIVO}>{c.etiqueta}</h3>
      <p className="mb-3 text-sm text-ink-soft">
        {c.rankings.grupos.k > 1 ? `${c.rankings.grupos.k} grupos detectados en los votos` : 'No se distinguen grupos'}
      </p>
      <table className="w-full text-left text-sm sm:text-base">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Por mayoría</th>
            <th className="py-1 pr-2">Por puente · Community Notes</th>
            <th className="py-1">Por puente · Polis</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: filas }, (_, i) => (
            <tr key={i} className="border-t border-line align-top">
              <td className="py-1.5 pr-2 tabular-nums text-muted">{i + 1}</td>
              <td className="py-1.5 pr-2">
                {vista.textos[c.rankings.mayoria[i]]} <span className="tabular-nums text-muted">{pct(c.rankings.mayoria[i])}</span>
              </td>
              <td className="py-1.5 pr-2">{vista.textos[c.rankings.puenteCN[i]]}</td>
              <td className="py-1.5">{vista.textos[c.rankings.puentePolis[i]]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
