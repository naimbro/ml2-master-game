// Hermano de /preview-compas: toda la cadena con datos sinteticos, sin login. Es
// el ensayo de Naim y el respaldo visual si algo falla en clase.
import { useMemo, useState } from 'react';
import PanelResultados from '../../components/avatares/PanelResultados';
import { ARCHIVO } from '../../components/avatares/colores';
import { instrumentoDe } from '../../lib/avatares/instrumentos';
import { sintetizar } from '../../lib/avatares/sinteticos';

export default function AvataresPreview() {
  const [semilla, setSemilla] = useState(1);
  const matriz = useMemo(() => sintetizar(instrumentoDe('ayd14_vina_v1')!, { semilla, n: 28, replicas: 3 }).matriz, [semilla]);
  return (
    <main className="bg-gradient-main min-h-screen">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-baseline gap-4">
          <h1 className="text-2xl uppercase leading-none sm:text-3xl" style={ARCHIVO}>Avatares · vista previa</h1>
          <span className="text-ink-soft">datos sintéticos</span>
          <button className="border-2 border-ink bg-surface px-3 py-1 font-semibold" onClick={() => setSemilla(semilla + 1)}>Otra sala</button>
        </header>
        <PanelResultados matriz={matriz} />
      </div>
    </main>
  );
}
