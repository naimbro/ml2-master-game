import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import type { Propuesta } from '../../lib/avatares/contrato';
import { puntos, resumenMiAvatar, type RespuestaMisAvatares } from '../../lib/avatares/miAvatar';
import { modelLabel } from '../../lib/modelLabel';

/**
 * El teléfono del alumno en la fase de resultados: ¿te achuntó tu avatar?
 * Solo sus avatares, nunca los de otro (callable misAvatares). No se proyecta.
 */
type Props = { propuestas: Propuesta[]; etiquetas: string[] };

export default function MiAvatar({ code, propuestas, etiquetas }: Props & { code: string }) {
  const [resp, setResp] = useState<RespuestaMisAvatares | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    httpsCallable<{ code: string }, RespuestaMisAvatares>(functions, 'misAvatares')({ code })
      .then((r) => setResp(r.data))
      .catch((e) => setError((e as Error).message));
  }, [code]);
  if (error) return <p className="p-6 text-lg">{error}</p>;
  if (!resp) return <p className="p-6 text-lg">Buscando a tu avatar…</p>;
  return <VistaMiAvatar resp={resp} propuestas={propuestas} etiquetas={etiquetas} />;
}

/** Solo dibuja; la usa también /preview-mi-avatar con datos sintéticos. */
export function VistaMiAvatar({ resp, propuestas, etiquetas }: Props & { resp: RespuestaMisAvatares }) {
  const ids = propuestas.map((p) => p.id);
  const { modelos, curso } = resumenMiAvatar(resp, ids);
  const conVotos = modelos.filter((m) => m.n > 0);
  if (!conVotos.length) {
    return <p className="p-6 text-lg">Tu avatar todavía no votó. Espera a que el profesor genere los avatares y vuelve a abrir esta página.</p>;
  }
  return (
    <main className="mx-auto max-w-xl space-y-6 p-4">
      <h1 className="text-xl font-bold">¿Te achuntó tu avatar?</h1>

      {conVotos.map((m) => {
        const mejorQueCurso = curso?.error != null && m.error != null ? m.error < curso.error - 1e-9 : null;
        return (
          <section key={m.modelo} className="space-y-2 rounded border p-4">
            <h2 className="font-semibold">{modelLabel(m.modelo)}</h2>
            <p className="text-3xl font-bold tabular-nums">
              {m.exactos} <span className="text-lg font-normal">de {m.n} iguales a ti</span>
            </p>
            <p className="tabular-nums">
              {m.cerca} de {m.n} a un punto o menos · se equivoca en promedio <b>{puntos(m.error!)}</b> puntos
            </p>
            {mejorQueCurso !== null && (
              <p className={mejorQueCurso ? 'font-medium' : 'text-gray-600'}>
                {mejorQueCurso
                  ? `Te conoce mejor que el promedio del curso (que se equivoca ${puntos(curso!.error!)}).`
                  : `No le gana al promedio del curso, que se equivoca ${puntos(curso!.error!)}: adivinar lo que piensa el curso te habría descrito igual o mejor.`}
              </p>
            )}
            {m.faltantes.length > 0 && <p className="text-sm text-gray-500">No votó {m.faltantes.length} de las propuestas.</p>}
          </section>
        );
      })}

      {curso === null && (
        <p className="text-sm text-gray-500">
          El promedio del curso aparece cuando hay al menos {resp.minCurso} compañeros con la encuesta completa (con menos, dejaría ver lo que respondió otro).
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Propuesta por propuesta</h2>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1 pr-2 font-medium">Propuesta</th>
              <th className="px-1 text-center font-medium">Tú</th>
              {conVotos.map((m) => (
                <th key={m.modelo} className="px-1 text-center text-xs font-medium leading-tight">{modelLabel(m.modelo)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {propuestas.map((p) => {
              const tu = resp.votos[p.id];
              return (
                <tr key={p.id} className="border-b">
                  <td className="py-1 pr-2">{p.tema ?? p.texto}</td>
                  <td className="px-1 text-center font-bold">{tu}</td>
                  {conVotos.map((m) => {
                    const v = resp.avatares.find((a) => a.modelo === m.modelo)?.votos[p.id];
                    const igual = v === tu;
                    return (
                      <td key={m.modelo} className={`border-x-2 border-white px-1 text-center ${igual ? 'bg-black text-white' : ''}`}>{v ?? '—'}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-500">
          En negro, donde tu avatar votó igual que tú. 1 = {etiquetas[0]} · 5 = {etiquetas[etiquetas.length - 1]}.
        </p>
      </section>
    </main>
  );
}
