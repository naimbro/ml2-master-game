import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAvataresRun } from '../../hooks/useAvataresRun';
import { aMatriz, cambiarFase, type Fase } from '../../lib/avatares/sala';
import PanelResultados from '../../components/avatares/PanelResultados';
import { currentAvataresUrl } from '../../lib/joinUrl';

const FASES: Fase[] = ['lobby', 'planilla', 'encuesta', 'resultados'];
const NOMBRE: Record<Fase, string> = { lobby: 'Entrada', planilla: 'Planilla', encuesta: 'Encuesta', resultados: 'Resultados' };

/** La pantalla del proyector. Nunca muestra nombres. */
export default function AvataresSala() {
  const { code = '' } = useParams<{ code: string }>();
  const { run, loading, error, isHost, planillas, humanos, personas } = useAvataresRun(code);
  const [errorAvatares, setErrorAvatares] = useState<string | null>(null);
  // La analitica es cara (factorizacion por camara): se recalcula solo cuando cambian los datos.
  const instrumento = run?.instrumento;
  const matriz = useMemo(() => (instrumento ? aMatriz(instrumento, humanos, personas) : null), [instrumento, humanos, personas]);
  if (loading) return <p className="p-6">Cargando…</p>;
  if (error || !run) return <p className="p-6">{error ?? 'Sala no encontrada'}</p>;
  if (!isHost) return <p className="p-6">Esta pantalla es del anfitrión.</p>;
  const url = currentAvataresUrl(run.code);
  const inscritos = Object.keys(run.participantes ?? {}).length;
  const conPlanilla = planillas.length;
  const completos = humanos.filter((h) => Object.keys(h.votos ?? {}).length === run.instrumento.propuestas.length).length;
  const i = FASES.indexOf(run.fase);

  async function generarAvatares() {
    setErrorAvatares(null);
    try {
      await httpsCallable(functions, 'votarComoAvatares', { timeout: 540_000 })({ code: run!.code });
    } catch (e) {
      setErrorAvatares((e as Error).message);
    }
  }

  return (
    <main className="min-h-screen space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <QRCodeSVG value={url} size={run.fase === 'lobby' ? 320 : 120} level="M" marginSize={0} />
          <div>
            <p className="font-mono text-3xl">{run.code}</p>
            <p className="text-sm">{url}</p>
          </div>
        </div>
        <nav className="flex gap-2">
          {i > 0 && (
            <button className="rounded border px-3 py-2" onClick={() => cambiarFase(run.code, FASES[i - 1])}>← {NOMBRE[FASES[i - 1]]}</button>
          )}
          {i < FASES.length - 1 && (
            <button className="rounded bg-black px-3 py-2 text-white" onClick={() => cambiarFase(run.code, FASES[i + 1])}>{NOMBRE[FASES[i + 1]]} →</button>
          )}
        </nav>
      </header>
      <section className="grid grid-cols-4 gap-4 text-center">
        <div><p className="text-4xl font-bold">{inscritos}</p><p>en la sala</p></div>
        <div><p className="text-4xl font-bold">{conPlanilla}</p><p>planillas</p></div>
        <div><p className="text-4xl font-bold">{completos}</p><p>encuestas completas</p></div>
        <div><p className="text-4xl font-bold">{personas.filter((p) => p.fuente === 'avatar').length}</p><p>avatares</p></div>
      </section>
      <section className="flex flex-wrap items-center gap-4">
        <button
          className="rounded border px-3 py-2 disabled:opacity-50"
          disabled={!planillas.length || run.avatares?.estado === 'corriendo'}
          onClick={generarAvatares}
        >
          Generar avatares ({planillas.length} planillas × {run.modelos.length} modelos)
        </button>
        {run.avatares && <span>Avatares: {run.avatares.estado} · {run.avatares.n} listos · {run.avatares.fallos.length} fallos</span>}
        {errorAvatares && <span className="text-red-600">{errorAvatares}</span>}
      </section>
      {run.fase === 'resultados' && matriz && <PanelResultados matriz={matriz} />}
    </main>
  );
}
