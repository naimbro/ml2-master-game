import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { INSTRUMENTOS } from '../../lib/avatares/instrumentos';
import { crearSala, type ModeloAvatar } from '../../lib/avatares/sala';

// 2026-11-09: los avatares pasan a los modelos de punta de cada proveedor (marcados
// por defecto). Los de la primera version quedan disponibles, sin marcar, para
// comparar «¿el modelo mas grande te conoce mejor?» en la misma sala.
const MODELOS: (ModeloAvatar & { etiqueta: string; porDefecto: boolean })[] = [
  { provider: 'openai', model: 'gpt-6-astra', etiqueta: 'OpenAI · gpt-6-astra', porDefecto: true },
  { provider: 'anthropic', model: 'claude-opus-5-5', etiqueta: 'Anthropic · claude-opus-5-5', porDefecto: true },
  { provider: 'gemini', model: 'gemini-3.1-pro-preview', etiqueta: 'Google · gemini-3.1-pro-preview', porDefecto: true },
  { provider: 'openai', model: 'gpt-5', etiqueta: 'OpenAI · gpt-5', porDefecto: false },
  { provider: 'anthropic', model: 'claude-sonnet-5', etiqueta: 'Anthropic · claude-sonnet-5', porDefecto: false },
  { provider: 'gemini', model: 'gemini-2.5-pro', etiqueta: 'Google · gemini-2.5-pro', porDefecto: false },
];

export default function CrearAvatares() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [instrumentoId, setInstrumentoId] = useState(Object.keys(INSTRUMENTOS)[0]);
  const [elegidos, setElegidos] = useState<string[]>(MODELOS.filter((m) => m.porDefecto).map((m) => m.model));
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  async function crear() {
    if (!user) return;
    setCreando(true);
    try {
      const modelos = MODELOS.filter((m) => elegidos.includes(m.model)).map(({ provider, model }) => ({ provider, model }));
      const code = await crearSala(user.uid, instrumentoId, modelos);
      navigate(`/avatares/${code}/sala`);
    } catch (e) {
      setError((e as Error).message);
      setCreando(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Nueva sala de avatares</h1>
      <label className="block space-y-1">
        <span className="font-medium">Instrumento</span>
        <select className="w-full rounded border p-2" value={instrumentoId} onChange={(e) => setInstrumentoId(e.target.value)}>
          {Object.values(INSTRUMENTOS).map((p) => <option key={p.instrumentoId} value={p.instrumentoId}>{p.nombre}</option>)}
        </select>
      </label>
      <fieldset className="space-y-2">
        <legend className="font-medium">Modelos que hacen de avatar</legend>
        {MODELOS.map((m) => (
          <label key={m.model} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={elegidos.includes(m.model)}
              onChange={(e) => setElegidos(e.target.checked ? [...elegidos, m.model] : elegidos.filter((x) => x !== m.model))}
            />
            {m.etiqueta}
          </label>
        ))}
      </fieldset>
      {error && <p className="text-red-600">{error}</p>}
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={creando || !elegidos.length} onClick={crear}>
        Crear sala
      </button>
    </main>
  );
}
