import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useProfessor } from '../../hooks/useProfessor';
import CompasPlano, { type PuntoCompas } from '../../components/compas/CompasPlano';
import { compasDe, posicionPath } from '../../lib/compasContent';
import {
  cambiaronDeArquetipo,
  emparejar,
  repartoArquetipos,
  resumenComparacion,
  type PosicionGuardada,
} from '../../lib/compasComparacion';

const f = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

/**
 * The same instrument, twice, months apart.
 *
 * Everything here is paired: only students who answered BOTH applications are
 * plotted or counted. That is the difference between "the course moved" and
 * "the people who kept coming to class were always the ones over there".
 */
export default function CompasComparacion() {
  const { compasId } = useParams<{ compasId: string }>();
  const { access, loading: cargandoAcceso } = useProfessor();
  // Memoizado aunque COMPASES sea estatico: sin esto el linter no puede
  // garantizar que la referencia no cambie entre renders y marca las deps del
  // efecto y del memo de abajo.
  const pack = useMemo(() => compasDe(compasId), [compasId]);

  const aplicaciones = pack?.instrumento.aplicaciones ?? [];
  const [a, setA] = useState(1);
  const [b, setB] = useState(3);
  // Igual que en useCompasRun: la lectura lleva adentro DE QUE par es, y
  // `cargando` se deriva comparando. Escribir estados desde el cuerpo del
  // efecto encadena renders, y ademas dejaba ver un instante los datos del par
  // anterior al cambiar de aplicacion, que en una pantalla de comparacion es
  // exactamente el error que no se puede cometer.
  const [lectura, setLectura] = useState<{
    clave: string;
    antes: PosicionGuardada[];
    despues: PosicionGuardada[];
    error: string | null;
  } | null>(null);

  const clave = `${compasId}:${a}:${b}`;
  const cargando = !!pack && lectura?.clave !== clave;
  const antes = lectura?.clave === clave ? lectura.antes : null;
  const despues = lectura?.clave === clave ? lectura.despues : null;
  const error = lectura?.clave === clave ? lectura.error : null;

  useEffect(() => {
    if (!compasId || !pack) return;
    let vivo = true;
    const leer = async (n: number) => {
      const snap = await getDocs(
        collection(db, posicionPath(pack.courseId, pack.instrumento.instrumentId, n)),
      );
      return snap.docs.map((d) => d.data() as PosicionGuardada);
    };
    Promise.all([leer(a), leer(b)])
      .then(([x, y]) => {
        if (vivo) setLectura({ clave, antes: x, despues: y, error: null });
      })
      .catch((e) => {
        if (!vivo) return;
        setLectura({
          clave,
          antes: [],
          despues: [],
          error: e instanceof Error ? e.message : 'No se pudieron leer las posiciones',
        });
      });
    return () => {
      vivo = false;
    };
  }, [compasId, pack, a, b, clave]);

  const analisis = useMemo(() => {
    if (!antes || !despues || !pack) return null;
    const emp = emparejar(antes, despues);
    return {
      emp,
      resumen: resumenComparacion(emp.pares),
      reparto: repartoArquetipos(emp.pares, pack.arquetipos.arquetipos),
      cambiaron: cambiaronDeArquetipo(emp.pares),
    };
  }, [antes, despues, pack]);

  if (cargandoAcceso) return <div className="p-8 text-ink-soft">Cargando…</div>;
  if (access !== 'admin' && access !== 'approved') return <Navigate to="/professor" replace />;
  if (!pack) return <div className="p-8 text-ink-soft">No existe el compás {compasId}.</div>;
  // Un compas de una clase se aplica una vez y su producto es lo que se hizo
  // con el esa tarde. Sin esta salida la pantalla pedia la aplicacion 3 de un
  // instrumento que solo tiene la 1, leia una coleccion vacia y mostraba un
  // curso de cero alumnos, que se lee como «nadie contesto» y no como «esto no
  // se compara».
  if (aplicaciones.length < 2) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-ink-soft">
        <h1 className="mb-3 text-2xl uppercase text-ink" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
          Nada que comparar
        </h1>
        <p>
          <b>{pack.nombre}</b> tiene una sola aplicación: no es una medición que se repita, así que
          no hay dos momentos que poner uno contra otro.
        </p>
      </div>
    );
  }

  const puntos: PuntoCompas[] =
    analisis?.emp.pares.map((p) => ({
      id: p.playerId,
      pos: { magnitud: p.despues.magnitud, direccion: p.despues.direccion },
      previa: { magnitud: p.antes.magnitud, direccion: p.antes.direccion },
    })) ?? [];

  const etiqueta = (n: number) => {
    const ap = aplicaciones.find((x) => x.n === n);
    return ap ? `Semana ${ap.semana} (${ap.hito})` : `Aplicación ${n}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-3xl uppercase leading-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Cómo se movió el curso
      </h1>
      <p className="mb-5 max-w-[68ch] text-ink-soft">
        {pack.instrumento.title} — {etiqueta(a)} contra {etiqueta(b)}. Cada flecha es un alumno:
        sale de donde estaba y apunta a donde está.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        {[
          { valor: a, set: setA, etiqueta: 'Desde' },
          { valor: b, set: setB, etiqueta: 'Hasta' },
        ].map((sel) => (
          <label key={sel.etiqueta} className="block">
            <span className="mb-1 block text-[12px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              {sel.etiqueta}
            </span>
            <select
              value={sel.valor}
              onChange={(e) => sel.set(Number(e.target.value))}
              className="border-2 border-ink bg-surface px-3 py-2 text-ink"
            >
              {aplicaciones.map((ap) => (
                <option key={ap.n} value={ap.n}>
                  {ap.n}. Semana {ap.semana} — {ap.hito}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {cargando && <p className="text-ink-soft">Leyendo posiciones…</p>}
      {error && <p className="border-l-4 border-kahoot-red bg-surface p-3 text-ink">{error}</p>}

      {analisis && !cargando && (
        <>
          {analisis.emp.pares.length === 0 ? (
            <p className="border-l-4 border-kahoot-yellow bg-surface p-4 text-ink-soft">
              Nadie respondió las dos aplicaciones todavía, así que no hay nada que comparar.
              {antes && despues && (
                <> Hay {antes.length} posiciones en la primera y {despues.length} en la segunda.</>
              )}
            </p>
          ) : (
            <>
              <div className="mb-5 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
                <CompasPlano
                  puntos={puntos}
                  ejeX={pack.instrumento.axes.x}
                  ejeY={pack.instrumento.axes.y}
                  flechas
                />
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <Dato
                  titulo="Comparables"
                  valor={`${analisis.resumen.n}`}
                  pie={`${analisis.emp.soloAntes} solo en la primera · ${analisis.emp.soloDespues} solo en la segunda`}
                />
                <Dato
                  titulo="Se movieron"
                  valor={`${analisis.resumen.seMovieron} de ${analisis.resumen.n}`}
                  pie={`más de ${analisis.resumen.umbral} punto en el plano; ${analisis.resumen.sinCambio} quedaron donde estaban`}
                />
                <Dato
                  titulo="Centro del curso"
                  valor={
                    analisis.resumen.desplazamientoMedio
                      ? `${f(analisis.resumen.desplazamientoMedio.dMagnitud)} / ${f(
                          analisis.resumen.desplazamientoMedio.dDireccion,
                        )}`
                      : '—'
                  }
                  pie="desplazamiento en magnitud / dirección"
                />
              </div>

              <h2 className="mb-2 text-xl uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                Reparto por arquetipo
              </h2>
              <div className="mb-6 overflow-x-auto border-2 border-ink bg-surface shadow-[4px_4px_0_#101114]">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b-2 border-ink text-left">
                      <th className="p-3">Arquetipo</th>
                      <th className="p-3 text-right">{etiqueta(a)}</th>
                      <th className="p-3 text-right">{etiqueta(b)}</th>
                      <th className="p-3 text-right">Cambio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisis.reparto.map((fila) => {
                      const d = fila.despues - fila.antes;
                      return (
                        <tr key={fila.id} className="border-t border-line">
                          <td className="p-3 text-ink">{fila.name}</td>
                          <td className="p-3 text-right tabular-nums text-ink-soft">{fila.antes}</td>
                          <td className="p-3 text-right tabular-nums text-ink-soft">{fila.despues}</td>
                          <td className={`p-3 text-right tabular-nums ${d === 0 ? 'text-faint' : 'text-ink'}`}>
                            {d === 0 ? '—' : d > 0 ? `+${d}` : d}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mb-6 text-[14px] text-ink-soft">
                {analisis.cambiaron.length} de {analisis.resumen.n} terminaron en un arquetipo
                distinto del que empezaron.
              </p>
            </>
          )}

          <div className="border-l-4 border-kahoot-yellow bg-surface p-4 text-[14px] text-ink-soft">
            <b className="block text-ink">Qué NO muestra esto.</b>
            No hay grupo de control: no existe un curso paralelo que no tomó las clases. Si el
            centro se desplazó, esta pantalla no puede decir cuánto de eso fue el curso y cuánto fue
            el semestre — las noticias, una elección, la conversación de sobremesa. La comparación es
            pareada, o sea sólo mira a quienes respondieron las dos veces, y aun así eso controla la
            deserción y nada más. Con {analisis.resumen.n} personas, además, un puñado de cambios
            mueve el promedio: conviene mirar cuántos se movieron antes que cuánto se movió el
            centro.
          </div>
        </>
      )}
    </div>
  );
}

function Dato({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
      <p className="text-[11px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        {titulo}
      </p>
      <p className="my-1 text-2xl tabular-nums text-ink" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        {valor}
      </p>
      <p className="text-[12.5px] text-muted">{pie}</p>
    </div>
  );
}
