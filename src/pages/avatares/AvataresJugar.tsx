import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAvataresRun } from '../../hooks/useAvataresRun';
import { guardarPlanilla, guardarVoto, inscribirse, type DocHumano, type DocPlanilla } from '../../lib/avatares/sala';
import type { Planilla } from '../../lib/avatares/planilla';
import MiAvatar from '../../components/avatares/MiAvatar';

/**
 * El telefono del alumno. Recargar a mitad de camino no pierde nada: la
 * planilla y los votos propios se leen de vuelta de Firestore (el alumno puede
 * leer los suyos). Lo que voto su avatar aparece solo en resultados, despues de
 * su propia encuesta (MiAvatar; el servidor lo vuelve a exigir).
 */
export default function AvataresJugar() {
  const { code = '' } = useParams<{ code: string }>();
  const { user } = useAuth();
  const { run, loading, error } = useAvataresRun(code);
  const [campos, setCampos] = useState<Planilla>({});
  const [enviada, setEnviada] = useState(false);
  const [votos, setVotos] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const runCode = run?.code;
  const uid = user?.uid;

  useEffect(() => {
    if (!runCode || !uid) return;
    inscribirse(runCode, uid).catch(() => {});
    getDoc(doc(db, 'avataresRuns', runCode, 'planillas', uid)).then((s) => {
      if (s.exists()) { setCampos((s.data() as DocPlanilla).campos ?? {}); setEnviada(true); }
    }).catch(() => {});
    getDoc(doc(db, 'avataresRuns', runCode, 'humanos', uid)).then((s) => {
      if (s.exists()) setVotos((s.data() as DocHumano).votos ?? {});
    }).catch(() => {});
  }, [runCode, uid]);

  if (loading) return <p className="p-6">Cargando…</p>;
  if (error || !run || !user) return <p className="p-6">{error ?? 'Sala no encontrada'}</p>;
  const inst = run.instrumento;

  if (run.fase === 'lobby') return <p className="p-6 text-lg">Listo. Espera a que empiece la actividad.</p>;

  if (run.fase === 'planilla') {
    if (enviada) {
      return (
        <main className="space-y-4 p-6">
          <p className="text-lg">Planilla enviada. Tu avatar se está armando. Espera la encuesta.</p>
          <button className="rounded border px-3 py-2" onClick={() => setEnviada(false)}>Corregir mi planilla</button>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <h1 className="text-xl font-bold">Tu planilla</h1>
        {inst.planilla.map((c) => (
          <label key={c.id} className="block space-y-1">
            <span className="font-medium">{c.etiqueta}</span>
            {c.ayuda && <span className="block text-sm text-gray-500">{c.ayuda}</span>}
            {c.tipo === 'opcion' ? (
              <select className="w-full rounded border p-2" value={campos[c.id] ?? ''} onChange={(e) => setCampos({ ...campos, [c.id]: e.target.value })}>
                <option value="">—</option>
                {(c.opciones ?? []).map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : c.tipo === 'escala' ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCampos({ ...campos, [c.id]: String(n) })}
                    className={`h-10 w-10 rounded border ${campos[c.id] === String(n) ? 'bg-black text-white' : ''}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <input className="w-full rounded border p-2" value={campos[c.id] ?? ''} onChange={(e) => setCampos({ ...campos, [c.id]: e.target.value })} />
            )}
          </label>
        ))}
        <button
          className="w-full rounded bg-black py-3 text-white disabled:opacity-50"
          disabled={guardando}
          onClick={async () => {
            setGuardando(true);
            try { await guardarPlanilla(run.code, inst, user.uid, campos); setEnviada(true); } finally { setGuardando(false); }
          }}
        >
          Enviar planilla
        </button>
      </main>
    );
  }

  if (run.fase === 'encuesta') {
    const hechas = Object.keys(votos).length;
    return (
      <main className="mx-auto max-w-xl space-y-6 p-4">
        <h1 className="text-xl font-bold">Ahora tú ({hechas}/{inst.propuestas.length})</h1>
        {inst.propuestas.map((p) => (
          <section key={p.id} className="space-y-2">
            <p className="font-medium">{p.texto}</p>
            <div className="grid grid-cols-5 gap-1">
              {inst.escala.etiquetas.map((et, i) => (
                <button
                  key={et}
                  title={et}
                  onClick={async () => {
                    const nuevos = { ...votos, [p.id]: i + 1 };
                    setVotos(nuevos);
                    await guardarVoto(run.code, user.uid, p.id, i + 1, Object.keys(nuevos).length);
                  }}
                  className={`rounded border py-2 text-xs ${votos[p.id] === i + 1 ? 'bg-black text-white' : ''}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </section>
        ))}
        <p className="text-sm text-gray-500">1 = {inst.escala.etiquetas[0]} · 5 = {inst.escala.etiquetas[4]}</p>
      </main>
    );
  }

  if (run.fase === 'resultados') return <MiAvatar code={run.code} propuestas={inst.propuestas} etiquetas={inst.escala.etiquetas} />;

  return <p className="p-6 text-lg">Mira el proyector.</p>;
}
