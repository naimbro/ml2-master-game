import { useParams } from 'react-router-dom';
import CompasPlano, { type PuntoCompas } from '../../components/compas/CompasPlano';
import { useCompasRun } from '../../hooks/useCompasRun';

/**
 * The host screen. This is what the projector shows, so two rules hold:
 * no names anywhere on the cloud, and nothing that reveals what any one person
 * answered. Each student recognises their own point; nobody recognises anyone
 * else's.
 */
export default function CompasSala() {
  const { code } = useParams<{ code: string }>();
  const {
    run,
    pack,
    loading,
    error,
    isHost,
    avanzar,
    retroceder,
    cerrar,
    posicionesDelCurso,
    posicionesPrevias,
  } = useCompasRun(code);

  if (loading) return <div className="p-8 text-ink-soft">Cargando…</div>;
  if (error || !run || !pack) return <div className="p-8 text-ink-soft">{error ?? 'No existe ese compás'}</div>;
  if (!isHost) return <div className="p-8 text-ink-soft">Esta pantalla es del anfitrión.</div>;

  const { instrumento } = pack;
  const item = run.itemIndex > 0 ? instrumento.items[run.itemIndex - 1] : null;
  const previas = posicionesPrevias();
  const puntos: PuntoCompas[] = posicionesDelCurso().map((p) => ({
    id: p.id,
    pos: { magnitud: p.pos.magnitud, direccion: p.pos.direccion },
    previa: previas[p.id]
      ? { magnitud: previas[p.id].magnitud, direccion: previas[p.id].direccion }
      : null,
  }));

  const inscritos = Object.keys(run.participantes ?? {}).length;
  const respondieron = Object.values(run.participantes ?? {}).filter(
    (p) => p.respondidas >= run.itemIndex,
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-4">
        <h1 className="text-3xl uppercase leading-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          {instrumento.title}
        </h1>
        <span className="border-2 border-ink bg-kahoot-yellow px-3 py-1 text-2xl tracking-widest text-ink" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          {run.code}
        </span>
        <span className="tabular-nums text-ink-soft">
          {run.itemIndex === 0
            ? `${inscritos} conectados`
            : `${respondieron} de ${inscritos} han respondido · ítem ${run.itemIndex} de ${run.totalItems}`}
        </span>
      </div>

      {item && (
        <p className="mb-4 border-l-4 border-ink bg-surface px-4 py-3 text-xl text-ink">{item.question}</p>
      )}
      {run.itemIndex === 0 && (
        <p className="mb-4 text-ink-soft">
          Entren en <b>/compas/{run.code}</b>. No hay respuestas correctas y esto no lleva nota.
        </p>
      )}

      <div className="mb-5 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
        <CompasPlano puntos={puntos} ejeX={instrumento.axes.x} ejeY={instrumento.axes.y} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={avanzar}
          disabled={run.itemIndex >= run.totalItems}
          className="border-2 border-ink bg-kahoot-orange px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          {run.itemIndex === 0 ? 'Empezar' : 'Siguiente ítem'}
        </button>
        <button
          type="button"
          onClick={retroceder}
          disabled={run.itemIndex <= 1}
          className="border-2 border-ink bg-surface px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          Volver
        </button>
        <a
          href={`${import.meta.env.BASE_URL || '/'}compas/${run.code}/campos`}
          className="border-2 border-ink bg-surface px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114]"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          Armar campos
        </a>
        <button
          type="button"
          onClick={cerrar}
          disabled={run.status === 'finished'}
          className="border-2 border-ink bg-surface px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          {run.status === 'finished' ? 'Cerrado' : 'Cerrar y repartir arquetipos'}
        </button>
      </div>
    </div>
  );
}
