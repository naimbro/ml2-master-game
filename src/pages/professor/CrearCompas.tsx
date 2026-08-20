import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../hooks/useAuth';
import { useProfessor } from '../../hooks/useProfessor';
import { crearCompasRun } from '../../hooks/useCompasRun';
import { COMPASES } from '../../lib/compasContent';
import { currentCompasUrl } from '../../lib/joinUrl';

// El codigo de sala usa el mismo alfabeto que el del juego: sin I, O, 0 ni 1,
// que son los que se dictan mal en voz alta y se tipean peor desde la ultima
// fila.
function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

/**
 * Abrir una sala de compás. Pantalla de autoría, así que sigue el registro de
 * `/professor` y no lleva la capa lúdica de las pantallas de alumno.
 */
export default function CrearCompas() {
  const { user } = useAuth();
  const { access, loading } = useProfessor();
  const navigate = useNavigate();

  const compases = Object.values(COMPASES);
  const [compasId, setCompasId] = useState(compases[0]?.compasId ?? '');
  const [aplicacion, setAplicacion] = useState(1);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<string | null>(null);

  if (loading) return <div className="p-8 text-ink-soft">Cargando…</div>;
  if (access !== 'admin' && access !== 'approved') return <Navigate to="/professor" replace />;

  const pack = COMPASES[compasId];

  const crear = async () => {
    if (!user || !pack) return;
    setCreando(true);
    setError(null);
    try {
      const code = generarCodigo();
      await crearCompasRun({
        code,
        compasId,
        aplicacion,
        hostId: user.uid,
        hostName: user.displayName || 'Profesor',
      });
      setCreada(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la sala');
    } finally {
      setCreando(false);
    }
  };

  if (creada) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-2 text-2xl uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          Sala abierta
        </h1>
        <p className="mb-5 text-ink-soft">Los alumnos entran a este código o escanean el QR.</p>

        <div className="mb-6 border-2 border-ink bg-surface p-6 text-center shadow-[4px_4px_0_#101114]">
          <p className="mb-4 text-5xl tracking-widest text-ink" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            {creada}
          </p>
          <div className="inline-block border-2 border-line bg-white p-3">
            <QRCodeSVG value={currentCompasUrl(creada)} size={160} level="M" marginSize={0} />
          </div>
          <p className="mt-3 break-all text-xs text-muted">{currentCompasUrl(creada)}</p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/compas/${creada}/sala`)}
          className="w-full border-2 border-ink bg-kahoot-orange px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114]"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          Ir a la sala
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-2 text-2xl uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Abrir un compás
      </h1>
      <p className="mb-6 text-ink-soft">
        El compás no puntúa, no rankea y no entra en la nota. Un curso puede tener{' '}
        <b>más de un compás</b> —el de semestre, que se repite igual para poder compararlo, y los de
        una clase, que miden otra cosa y se aplican una sola vez— así que hay dos cosas que elegir
        bien: cuál compás y cuál aplicación.
      </p>

      <label className="mb-1 block text-[12px] uppercase text-faint" htmlFor="compas" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Qué compás
      </label>
      <select
        id="compas"
        value={compasId}
        onChange={(e) => {
          setCompasId(e.target.value);
          setAplicacion(1);
        }}
        className="mb-2 w-full border-2 border-ink bg-surface px-3 py-3 text-ink"
      >
        {compases.map((p) => (
          <option key={p.compasId} value={p.compasId}>
            {p.curso} — {p.nombre}
          </option>
        ))}
      </select>
      {pack && (
        <p className="mb-5 text-[13px] text-muted">
          Las posiciones se guardan en <code>compas/{pack.courseId}/{pack.instrumento.instrumentId}_a{aplicacion}</code>
          {compases.filter((p) => p.courseId === pack.courseId).length > 1 &&
            ' — separado de los otros compases de este mismo curso.'}
        </p>
      )}

      <fieldset className="mb-6">
        <legend className="mb-2 text-[12px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          Aplicación
        </legend>
        <div className="flex flex-col gap-2">
          {pack?.instrumento.aplicaciones.map((a) => (
            <label
              key={a.n}
              className={`flex cursor-pointer gap-3 border-2 border-ink p-3 ${
                aplicacion === a.n ? 'bg-kahoot-orange' : 'bg-surface'
              }`}
            >
              <input
                type="radio"
                name="aplicacion"
                className="mt-1"
                checked={aplicacion === a.n}
                onChange={() => setAplicacion(a.n)}
              />
              <span className="text-[14px] text-ink">
                <b>
                  {a.n}. Semana {a.semana}
                </b>{' '}
                — {a.hito} · {a.fecha}
                <span className="block text-ink-soft">{a.proposito}</span>
                {a.nota && <span className="mt-1 block text-[12.5px] text-muted">{a.nota}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mb-4 text-[13px] text-muted">
        {pack?.instrumento.items.length} ítems ·{' '}
        {(pack?.instrumento.aplicaciones.length ?? 0) > 1
          ? `la posición de cada alumno queda guardada bajo la aplicación ${aplicacion}, que es lo que después permite compararla con las otras.`
          : 'aplicación única: este compás no se repite y no se compara con nada. Su producto es lo que se hace con él ese mismo día.'}
      </p>

      {error && <p className="mb-4 border-l-4 border-kahoot-red bg-surface p-3 text-[14px] text-ink">{error}</p>}

      <button
        type="button"
        onClick={crear}
        disabled={creando || !pack}
        className="w-full border-2 border-ink bg-kahoot-orange px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40"
        style={{ fontFamily: "'Archivo Black', sans-serif" }}
      >
        {creando ? 'Abriendo…' : 'Abrir sala'}
      </button>
    </div>
  );
}
