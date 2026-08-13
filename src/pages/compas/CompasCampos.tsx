import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CompasPlano, { type PuntoCompas } from '../../components/compas/CompasPlano';
import { useCompasRun } from '../../hooks/useCompasRun';
import { arquetipoDe, posicionDe, timonDe } from '../../lib/compas';
import { armarCampos, mezclar, type Miembro } from '../../lib/compasCampos';

const PALETA = ['#101114', '#FF5A1F', '#2563EB', '#B3272B', '#7C3AED', '#F5A524'];

/**
 * Debate fields, built from what the class actually answered.
 *
 * Host-only, and that is not a permissions detail: names live here. The
 * durable position documents carry a uid and no name on purpose, because any
 * authenticated student can read them and a public who-thinks-what table is
 * exactly what this instrument should never produce. Names and positions meet
 * on this screen and nowhere else.
 */
export default function CompasCampos() {
  const { code } = useParams<{ code: string }>();
  const { run, pack, loading, error, isHost, respuestas } = useCompasRun(code);
  const [k, setK] = useState(4);
  const [pesoTimon, setPesoTimon] = useState(0);
  const [modo, setModo] = useState<'homogeneos' | 'mezclados'>('homogeneos');
  const [mostrarNombres, setMostrarNombres] = useState(false);

  const miembros: Miembro[] = useMemo(() => {
    if (!pack || !run) return [];
    const items = pack.instrumento.items;
    return respuestas
      .map((r): Miembro | null => {
        const pos = posicionDe(r.answers ?? {}, items);
        if (!pos) return null;
        return {
          id: r.playerId,
          nombre: r.nombre || 'Sin nombre',
          magnitud: pos.magnitud,
          direccion: pos.direccion,
          timon: timonDe(r.answers ?? {}, items),
        };
      })
      .filter((x): x is Miembro => x !== null);
  }, [pack, run, respuestas]);

  const campos = useMemo(
    () => armarCampos(miembros, k, { pesoTimon }),
    [miembros, k, pesoTimon],
  );
  const grupos = useMemo(() => mezclar(campos, k), [campos, k]);

  if (loading) return <div className="p-8 text-ink-soft">Cargando…</div>;
  if (error || !run || !pack) return <div className="p-8 text-ink-soft">{error ?? 'No existe ese compás'}</div>;
  if (!isHost) return <div className="p-8 text-ink-soft">Esta pantalla es del anfitrión.</div>;

  const campoDe = new Map<string, number>();
  campos.forEach((c) => c.miembros.forEach((m) => campoDe.set(m.id, c.n)));

  const puntos: PuntoCompas[] = miembros.map((m) => ({
    id: m.id,
    pos: { magnitud: m.magnitud, direccion: m.direccion },
    color: PALETA[((campoDe.get(m.id) ?? 1) - 1) % PALETA.length],
  }));

  const arquetipoDelCampo = (n: number) => {
    const c = campos.find((x) => x.n === n);
    if (!c) return null;
    return arquetipoDe(
      { magnitud: c.centroide.magnitud, direccion: c.centroide.direccion, respondidas: 1, total: 1 },
      c.miembros.map((m) => m.timon).find(Boolean) ?? null,
      pack.arquetipos,
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-3xl uppercase leading-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Campos para el debate
      </h1>
      <p className="mb-5 max-w-[68ch] text-ink-soft">
        {miembros.length} alumnos con posición en la sala <b>{run.code}</b>. Los campos salen de
        dónde quedaron en el plano, con tamaños parejos: un debate con un grupo de siete contra uno
        de dos no es un debate.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-5 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
        <label className="block">
          <span className="mb-1 block text-[12px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            Cuántos campos
          </span>
          <select
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="border-2 border-ink bg-surface px-3 py-2 text-ink"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            Modo
          </span>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as 'homogeneos' | 'mezclados')}
            className="border-2 border-ink bg-surface px-3 py-2 text-ink"
          >
            <option value="homogeneos">Homogéneos — cada campo defiende su posición</option>
            <option value="mezclados">Mezclados — uno de cada campo, para deliberar</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-[14px] text-ink">
          <input
            type="checkbox"
            checked={pesoTimon > 0}
            onChange={(e) => setPesoTimon(e.target.checked ? 6 : 0)}
          />
          Que pese el timón
        </label>

        <label className="flex items-center gap-2 text-[14px] text-ink">
          <input
            type="checkbox"
            checked={mostrarNombres}
            onChange={(e) => setMostrarNombres(e.target.checked)}
          />
          Mostrar nombres
        </label>
      </div>

      {!mostrarNombres && (
        <p className="mb-4 border-l-4 border-kahoot-yellow bg-surface p-3 text-[13.5px] text-ink-soft">
          Los nombres están ocultos porque esta pantalla se puede estar proyectando. Enciéndelos
          cuando estés mirando tu propia pantalla para leer los grupos en voz alta.
        </p>
      )}

      <div className="mb-6 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
        <CompasPlano
          puntos={puntos}
          ejeX={pack.instrumento.axes.x}
          ejeY={pack.instrumento.axes.y}
        />
      </div>

      {miembros.length === 0 ? (
        <p className="text-ink-soft">Todavía nadie ha respondido nada en esta sala.</p>
      ) : modo === 'homogeneos' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {campos.map((c) => {
            const arq = arquetipoDelCampo(c.n);
            return (
              <div key={c.n} className="border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 border-2 border-ink"
                    style={{ background: PALETA[(c.n - 1) % PALETA.length] }}
                  />
                  <h2 className="text-[16px] uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                    Campo {c.n} · {c.miembros.length} personas
                  </h2>
                </div>
                <p className="mb-2 text-[12.5px] tabular-nums text-faint">
                  centro en {c.centroide.magnitud.toFixed(1)} / {c.centroide.direccion.toFixed(1)}
                  {arq && <> · más cerca de {arq.name}</>}
                </p>
                {arq && (
                  <p className="mb-3 border-l-[3px] border-kahoot-orange py-1 pl-3 text-[13.5px] text-ink-soft">
                    <b className="block text-[10.5px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                      Por dónde los van a atacar
                    </b>
                    {arq.puntoCiego}
                  </p>
                )}
                <p className="text-[14px] text-ink-soft">
                  {mostrarNombres
                    ? c.miembros.map((m) => m.nombre).join(' · ')
                    : `${c.miembros.length} alumnos`}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {grupos.map((g) => (
            <div key={g.n} className="border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
              <h2 className="mb-2 text-[16px] uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                Grupo {g.n} · {g.miembros.length} personas
              </h2>
              <ul className="text-[14px] text-ink-soft">
                {g.miembros.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 border border-ink"
                      style={{ background: PALETA[(campoDe.get(m.id)! - 1) % PALETA.length] }}
                    />
                    {mostrarNombres ? m.nombre : `campo ${m.campo}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-[13.5px] text-muted">
        {modo === 'homogeneos'
          ? 'Cada campo prepara el caso más fuerte de su posición y debate contra los otros. El punto ciego les dice de antemano por dónde los van a atacar, que es lo que evita que el debate sea un intercambio de consignas.'
          : 'Cada grupo junta posiciones distintas para deliberar. Si vuelves a aplicar el compás después de esta sesión, la comparación mide si deliberar movió a alguien — que es el experimento del que trata la unidad de democracia deliberativa.'}
      </p>
    </div>
  );
}
