import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TarjetaArquetipo from '../../components/compas/TarjetaArquetipo';
import { useCompasRun } from '../../hooks/useCompasRun';
import { useAuth } from '../../hooks/useAuth';
import { arquetipoDe, bandaAgenciaDe, posicionDe, timonDe } from '../../lib/compas';

/**
 * The student's phone, start to finish: join, wait, answer the item on the
 * projector, and at the end get their archetype.
 *
 * No score, no rank, no "correct" anywhere. The only feedback while the run is
 * going is that their answer registered.
 */
export default function CompasJugar() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const { run, pack, loading, error, misRespuestas, unirse, responder, guardarPosicion } =
    useCompasRun(code);
  const [nombre, setNombre] = useState('');
  const [guardada, setGuardada] = useState(false);

  const inscrito = !!user && !!run?.participantes?.[user.uid];

  // Persist the final position once the host closes the run. Written from the
  // student's own device because that is who owns the document — see the rules.
  useEffect(() => {
    if (run?.status === 'finished' && inscrito && !guardada) {
      guardarPosicion().then(() => setGuardada(true)).catch(() => setGuardada(false));
    }
  }, [run?.status, inscrito, guardada, guardarPosicion]);

  if (loading) return <div className="p-6 text-ink-soft">Cargando…</div>;
  if (error || !run || !pack) return <div className="p-6 text-ink-soft">{error ?? 'No existe ese compás'}</div>;

  const { instrumento, arquetipos } = pack;

  if (!inscrito) {
    return (
      <div className="mx-auto max-w-[420px] px-5 py-10">
        <h1 className="mb-2 text-2xl uppercase leading-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          {instrumento.title}
        </h1>
        <p className="mb-5 text-ink-soft">
          No hay respuestas correctas y esto no lleva nota. Responde lo que piensas.
        </p>
        <label className="mb-2 block text-[13px] uppercase text-faint" htmlFor="nombre" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          Tu nombre
        </label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mb-4 w-full border-2 border-ink bg-surface px-3 py-3 text-ink"
        />
        <button
          type="button"
          disabled={!nombre.trim()}
          onClick={() => unirse(nombre.trim())}
          className="w-full border-2 border-ink bg-kahoot-orange px-4 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          Entrar
        </button>
      </div>
    );
  }

  if (run.status === 'finished') {
    const pos = posicionDe(misRespuestas, instrumento.items);
    const arq = pos ? arquetipoDe(pos, timonDe(misRespuestas, instrumento.items), arquetipos) : null;
    const bandas = arquetipos.bandasAgencia?.bandas;
    const banda = pos ? bandaAgenciaDe(pos.agencia, bandas) : null;
    return (
      <div className="mx-auto max-w-[420px] px-5 py-8">
        {pos && arq ? (
          <TarjetaArquetipo
            arquetipo={arq}
            posicion={pos}
            ejeX={instrumento.axes.x}
            ejeY={instrumento.axes.y}
            banda={banda}
            bandas={bandas}
          />
        ) : (
          <p className="text-ink-soft">
            No alcanzaste a responder ningún ítem, así que no hay posición que mostrarte.
          </p>
        )}
      </div>
    );
  }

  if (run.itemIndex === 0) {
    return (
      <div className="mx-auto max-w-[420px] px-5 py-10 text-center">
        <p className="text-ink-soft">Estás dentro. Espera a que parta.</p>
      </div>
    );
  }

  const item = instrumento.items[run.itemIndex - 1];
  const elegida = misRespuestas[item.id];

  return (
    <div className="mx-auto max-w-[420px] px-5 py-6">
      <p className="mb-1 text-[11px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Ítem {run.itemIndex} de {run.totalItems}
      </p>
      <h1 className="mb-4 text-[20px] leading-tight text-ink">{item.question}</h1>

      <div className="flex flex-col gap-2">
        {item.options.map((o) => {
          const activa = elegida === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => responder(item.id, o.id)}
              aria-pressed={activa}
              className={`border-2 border-ink px-3 py-3 text-left text-[15px] shadow-[3px_3px_0_#101114] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${
                activa ? 'bg-kahoot-orange text-ink' : 'bg-surface text-ink-soft'
              }`}
            >
              {o.text}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[13px] text-faint">
        {elegida
          ? 'Quedó registrada. Puedes cambiarla mientras el ítem siga en pantalla.'
          : 'Puedes saltarte este ítem: sólo cuenta lo que respondes.'}
      </p>
    </div>
  );
}
