import type { correlacionPorPropuesta } from '../../lib/avatares/analitica/basico';
import { ARCHIVO, coma } from './colores';

type Corr = ReturnType<typeof correlacionPorPropuesta>;

/** Correlacion avatar-humano por propuesta, como la lamina de Viña. */
export default function BarrasCorrelacion({ titulo, corr, textos }: { titulo: string; corr: Corr; textos: Record<string, string> }) {
  const filas = Object.entries(corr.porPropuesta).sort((a, b) => (b[1].r ?? -2) - (a[1].r ?? -2));
  return (
    <section className="dramatic-card space-y-2 p-4">
      <h3 className="text-lg uppercase leading-tight" style={ARCHIVO}>
        {titulo} · promedio {corr.promedio === null ? '—' : coma(corr.promedio)}
      </h3>
      {filas.map(([id, { r, n }]) => (
        <div key={id} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-2 text-sm sm:text-base">
          <span className="truncate">{textos[id]}</span>
          <div className="h-3 bg-surface-2">
            <div className="h-3 bg-[#2563EB]" style={{ width: `${Math.max(0, r ?? 0) * 100}%` }} />
          </div>
          <span className="text-right tabular-nums">
            {r === null ? '—' : coma(r)} <small className="text-muted">n={n}</small>
          </span>
        </div>
      ))}
      {corr.refsSinPareja > 0 && (
        <p className="text-xs text-muted">{corr.refsSinPareja} sin pareja (no completaron las dos partes).</p>
      )}
    </section>
  );
}
