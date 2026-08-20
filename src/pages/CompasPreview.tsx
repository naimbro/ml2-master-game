import { useMemo, useState } from 'react';
import CompasPlano, { type PuntoCompas } from '../components/compas/CompasPlano';
import TiraAgencia, { type PuntoAgencia } from '../components/compas/TiraAgencia';
import TarjetaArquetipo from '../components/compas/TarjetaArquetipo';
import { compasDe } from '../lib/compasContent';
import { arquetipoDe, bandaAgenciaDe, colorAgencia, posicionDe, timonDe } from '../lib/compas';
import { armarCampos } from '../lib/compasCampos';
import type { CompasAnswers } from '../types/compas';

// El hermano de MCRepartoPreview, para el momento del compas que es imposible
// de mirar sin treinta personas en la sala: la nube del curso moviendose ronda
// a ronda, y la tarjeta que le llega al alumno al final.
//
// El contenido NO es inventado: son los diez items reales de
// content/compas/ai_democracy_2026. Lo simulado es el curso — 28 alumnos con
// una posicion latente y ruido — porque es lo unico que no se puede tener sin
// una clase en vivo.

// Qué compás se mira. Por defecto el de semestre de IA y Democracia, que es el
// que existía cuando se escribió esta pantalla; `?compas=ayd_s3_backlash_v1`
// mira cualquier otro del registro. Sin esto, un instrumento nuevo no se puede
// ver hasta tener la sala montada y un curso adentro, que es exactamente cuando
// ya es tarde para arreglarlo.
const COMPAS_POR_DEFECTO = 'ayd_semestral_v3';
const N = 28;
const YO = 6;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function CompasPreview() {
  const params = new URLSearchParams(window.location.search);
  // `?curso=` sigue funcionando: es lo que decian los enlaces de antes de que
  // un curso pudiera tener varios compases, y romperlos no le sirve a nadie.
  const compasId = params.get('compas') ?? params.get('curso') ?? COMPAS_POR_DEFECTO;
  const pack = compasDe(compasId);
  const [ronda, setRonda] = useState(0);

  // Un curso falso pero estable: la misma semilla en cada render, para que
  // comparar dos rondas sea comparar el movimiento y no dos sorteos distintos.
  const cohorte = useMemo(() => {
    if (!pack) return [];
    const rnd = mulberry32(20260813);
    const centros = [
      [-4, -1],
      [5, -5],
      [4, 5],
      [1, 1],
      [-2, 4],
    ];
    return Array.from({ length: N }, (_, i) => {
      const c = centros[i % centros.length];
      const lx = c[0] + (rnd() - 0.5) * 7;
      const ly = c[1] + (rnd() - 0.5) * 7;
      const picks: string[] = pack.instrumento.items.map((item) => {
        let mejor = item.options[0];
        let dm = Infinity;
        for (const o of item.options) {
          // Un item condicional declara un solo eje. Se mide la distancia sobre
          // los ejes que la opcion efectivamente declara, o el simulado nunca
          // elegiria esas opciones.
          const ex = o.vector.magnitud === undefined ? 0 : o.vector.magnitud - lx;
          const ey = o.vector.direccion === undefined ? 0 : o.vector.direccion - ly;
          const d = Math.hypot(ex, ey) + (rnd() - 0.5) * 6;
          if (d < dm) {
            dm = d;
            mejor = o;
          }
        }
        return mejor.id;
      });
      // Desorden visual fijo: con pocas rondas muchos comparten el mismo
      // promedio exacto y los puntos se apilan hasta desaparecer.
      return { picks, jx: (rnd() - 0.5) * 0.9, jy: (rnd() - 0.5) * 0.9 };
    });
  }, [pack]);

  if (!pack) return <div className="p-8">No existe el compás {compasId}.</div>;
  const { instrumento, arquetipos } = pack;
  const total = instrumento.items.length;

  const respuestasHasta = (i: number, hasta: number): CompasAnswers => {
    const a: CompasAnswers = {};
    for (let k = 0; k < hasta; k++) a[instrumento.items[k].id] = cohorte[i].picks[k];
    return a;
  };

  const posEn = (i: number, hasta: number) => {
    const p = posicionDe(respuestasHasta(i, hasta), instrumento.items);
    if (!p) return null;
    return { ...p, magnitud: p.magnitud + cohorte[i].jx, direccion: p.direccion + cohorte[i].jy };
  };

  const bandasAgencia = arquetipos.bandasAgencia?.bandas;

  // `posEn` viene en null mientras al alumno le falte una de las dos
  // coordenadas, que con proposiciones de un solo eje pasa en la ronda 1. Antes
  // habia un `!` aqui y la pantalla se caia entera con «Cannot read properties
  // of null».
  const puntos: PuntoCompas[] = ronda === 0
    ? []
    : cohorte.flatMap((_, i) => {
        const ahora = posEn(i, ronda);
        if (!ahora) return [];
        const antes = ronda > 1 ? posEn(i, ronda - 1) : null;
        return [{
          id: String(i),
          esMio: i === YO,
          pos: { magnitud: ahora.magnitud, direccion: ahora.direccion },
          previa: antes ? { magnitud: antes.magnitud, direccion: antes.direccion } : null,
          color: colorAgencia(ahora.agencia, bandasAgencia),
        }];
      });

  const puntosAgencia: PuntoAgencia[] =
    ronda === 0
      ? []
      : cohorte.flatMap((_, i) => {
          const pos = posEn(i, ronda);
          return pos ? [{ id: String(i), agencia: pos.agencia, esMio: i === YO }] : [];
        });

  const misRespuestas = ronda > 0 ? respuestasHasta(YO, ronda) : {};
  const miPos = ronda > 0 ? posEn(YO, ronda) : null;
  const miArquetipo = miPos
    ? arquetipoDe(miPos, timonDe(misRespuestas, instrumento.items), arquetipos)
    : null;

  const item = ronda > 0 ? instrumento.items[ronda - 1] : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="mb-2 text-3xl uppercase leading-none" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Compás — vista previa
      </h1>
      <p className="mb-1 max-w-[64ch] text-ink-soft">
        Los {instrumento.items.length} ítems reales de <code>content/compas/{pack.courseId}</code> ({pack.nombre}), con un curso de 28 alumnos
        simulado. Sin puntaje y sin ranking: el compás mide dónde está parado alguien, no qué tan
        bien lo hizo.
      </p>
      <p className="mb-5 max-w-[68ch] text-[13.5px] text-faint">
        El punto naranjo es «tu punto», el mismo alumno de la tarjeta de abajo.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-4 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
        <button
          type="button"
          onClick={() => setRonda((r) => Math.min(total, r + 1))}
          disabled={ronda >= total}
          className="border-2 border-ink bg-kahoot-orange px-4 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          {ronda >= total ? 'Se acabaron los ítems' : 'Siguiente ítem'}
        </button>
        <button
          type="button"
          onClick={() => setRonda(0)}
          className="border-2 border-ink bg-surface px-4 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          Reiniciar
        </button>
        <span className="tabular-nums text-ink-soft">
          {ronda === 0 ? 'Nadie ha respondido todavía' : `Ítem ${ronda} de ${total}`}
        </span>
      </div>

      {item && (
        <p className="mb-4 border border-dashed border-line bg-paper p-3 text-[15px] text-ink-soft">
          <span className="mb-1 block text-[11px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            Ítem {ronda}
          </span>
          {item.question}
        </p>
      )}

      <div className="mb-4 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
        <CompasPlano puntos={puntos} ejeX={instrumento.axes.x} ejeY={instrumento.axes.y} />
      </div>

      {instrumento.ejeAgencia && bandasAgencia && (
        <>
          <p className="mb-2 max-w-[68ch] text-[13.5px] text-faint">
            El color de cada punto es el tercer eje. La nube puede quedarse quieta y cambiar de
            color: eso sería el curso manteniendo su diagnóstico político y cambiando de idea sobre
            quién conduce.
          </p>
          <div className="mb-8 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
            <TiraAgencia
              puntos={puntosAgencia}
              eje={instrumento.ejeAgencia}
              bandas={bandasAgencia}
            />
          </div>
        </>
      )}

      {ronda >= 4 && (
        <>
          <h2 className="mb-2 text-xl uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            Comparación entre dos aplicaciones
          </h2>
          <p className="mb-3 max-w-[68ch] text-[13.5px] text-faint">
            Simulada tomando el ítem 3 como «antes» y el actual como «después»; en el curso real son
            la Semana 3 y la Semana 15. Cada flecha sale de donde estaba el alumno y apunta a donde
            está. La punta importa: sin ella no se sabe cuál extremo es el ahora.
          </p>
          <div className="mb-8 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
            <CompasPlano
              flechas
              ejeX={instrumento.axes.x}
              ejeY={instrumento.axes.y}
              puntos={cohorte.map((_, i) => {
                const antes = posEn(i, 3)!;
                const ahora = posEn(i, ronda)!;
                return {
                  id: `c${i}`,
                  esMio: i === YO,
                  pos: { magnitud: ahora.magnitud, direccion: ahora.direccion },
                  previa: { magnitud: antes.magnitud, direccion: antes.direccion },
                };
              })}
            />
          </div>
        </>
      )}

      {ronda >= 4 && (
        <>
          <h2 className="mb-2 text-xl uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            Campos para el debate
          </h2>
          <p className="mb-3 max-w-[68ch] text-[13.5px] text-faint">
            Cuatro campos de tamaño parejo sobre las posiciones de este momento. En la sala real los
            nombres van sólo a tu pantalla; acá no hay nombres que mostrar.
          </p>
          <div className="mb-8 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
            <CompasPlano
              ejeX={instrumento.axes.x}
              ejeY={instrumento.axes.y}
              puntos={(() => {
                const paleta = ['#101114', '#FF5A1F', '#2563EB', '#B3272B'];
                const ms = cohorte.map((_, i) => {
                  const p = posEn(i, ronda)!;
                  return { id: `c${i}`, nombre: `A${i}`, magnitud: p.magnitud, direccion: p.direccion };
                });
                const campos = armarCampos(ms, 4);
                const deQuien = new Map<string, number>();
                campos.forEach((c) => c.miembros.forEach((m) => deQuien.set(m.id, c.n)));
                return ms.map((m) => ({
                  id: m.id,
                  pos: { magnitud: m.magnitud, direccion: m.direccion },
                  color: paleta[((deQuien.get(m.id) ?? 1) - 1) % paleta.length],
                }));
              })()}
            />
          </div>
        </>
      )}

      <h2 className="mb-3 text-xl uppercase" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        En el teléfono del alumno
      </h2>
      <div className="max-w-[390px]">
        {miPos && miArquetipo ? (
          <TarjetaArquetipo
            arquetipo={miArquetipo}
            posicion={miPos}
            ejeX={instrumento.axes.x}
            ejeY={instrumento.axes.y}
            banda={bandaAgenciaDe(miPos.agencia, bandasAgencia)}
            bandas={bandasAgencia}
          />
        ) : (
          <p className="text-faint">La tarjeta aparece cuando termine el primer ítem.</p>
        )}
      </div>
    </div>
  );
}
