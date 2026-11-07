import { useMemo, useState } from 'react';
import type { Matriz } from '../../lib/avatares/contrato';
import { inundar } from '../../lib/avatares/analitica/puentes';
import { calcularVista } from '../../lib/avatares/vista';
import BarrasCorrelacion from './BarrasCorrelacion';
import MapaComun from './MapaComun';
import TablaPuente from './TablaPuente';
import { ARCHIVO, coma } from './colores';

type Pestana = 'correlacion' | 'mapa' | 'puente' | 'bots';
const PESTANAS: [Pestana, string][] = [
  ['correlacion', 'Avatar vs. tú'], ['mapa', 'Mapa'], ['puente', 'Mayoría vs. puente'], ['bots', 'Bots'],
];

/** Lo que se proyecta al final. Nunca nombres: solo puntos, propuestas y conteos. */
export default function PanelResultados({ matriz }: { matriz: Matriz }) {
  const [pestana, setPestana] = useState<Pestana>('correlacion');
  const [bots, setBots] = useState(0);
  const vista = useMemo(() => calcularVista(matriz), [matriz]);
  // Los bots copian al humano en el extremo del primer eje (determinista).
  const copiado = useMemo(() => {
    const pts = vista.mapa.puntos.filter((p) => p.fuente === 'humano');
    if (!pts.length) return undefined;
    return pts.reduce((b, p) => (Math.abs(p.x) > Math.abs(b.x) ? p : b), pts[0]).personaId;
  }, [vista]);
  const conBots = useMemo(() => {
    if (!copiado) return null;
    const humanos = matriz.personas.filter((p) => p.fuente === 'humano');
    const ids = new Set(humanos.map((h) => h.id));
    const soloHumanos = { ...matriz, personas: humanos, votos: matriz.votos.filter((v) => ids.has(v.persona)) };
    return calcularVista(inundar(soloHumanos, copiado, bots), true);
  }, [matriz, copiado, bots]);
  const camaras = Object.keys(vista.porCamara);

  if (!camaras.length) return <p className="text-lg text-ink-soft">Todavía no hay votos.</p>;

  return (
    <section className="space-y-5">
      <nav className="flex flex-wrap gap-2" aria-label="Resultados">
        {PESTANAS.map(([k, t]) => (
          <button
            key={k}
            onClick={() => setPestana(k)}
            aria-pressed={pestana === k}
            className={`border-2 border-ink px-4 py-2 font-semibold ${pestana === k ? 'bg-[#FF5A1F] text-ink' : 'bg-surface text-ink'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {pestana === 'correlacion' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {Object.entries(vista.correlaciones).map(([k, c]) => (
            <BarrasCorrelacion key={k} titulo={vista.porCamara[k].etiqueta} corr={c} textos={vista.textos} />
          ))}
          {!Object.keys(vista.correlaciones).length && <p className="text-lg text-ink-soft">Todavía no hay avatares.</p>}
        </div>
      )}

      {pestana === 'mapa' && (
        <div className="space-y-3">
          <MapaComun mapa={vista.mapa} cn={vista.cn} textos={vista.textos} fuentes={['humano', 'avatar', 'avatar_red']} />
          <p className="text-sm text-ink-soft">
            Dispersión media ·{' '}
            {camaras.map((k) => `${vista.porCamara[k].etiqueta}: ${coma(vista.porCamara[k].dispersionMedia)}`).join(' · ')}
          </p>
        </div>
      )}

      {pestana === 'puente' && (
        <div className="grid gap-5 xl:grid-cols-2">
          {camaras.map((k) => <TablaPuente key={k} vista={vista} camara={k} />)}
        </div>
      )}

      {pestana === 'bots' && conBots && (
        <div className="space-y-4">
          <label className="flex flex-wrap items-center gap-3">
            <span className="text-lg uppercase" style={ARCHIVO}>Copias idénticas de una persona: {bots}</span>
            <input type="range" min={0} max={40} value={bots} onChange={(e) => setBots(Number(e.target.value))} className="w-64 accent-[#FF5A1F]" />
          </label>
          <div className="grid gap-5 xl:grid-cols-2">
            <MapaComun mapa={conBots.mapa} cn={conBots.cn} textos={conBots.textos} fuentes={['humano', 'bot']} />
            <TablaPuente vista={conBots} camara="humano" />
          </div>
        </div>
      )}
    </section>
  );
}
