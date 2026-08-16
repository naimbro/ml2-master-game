// Compass math — pure, deterministic, unit-tested.
//
// There is no score anywhere in this file, and that is the point. A compass
// measures where someone stands, not how well they did. If a number from here
// ever reaches the leaderboard, students start answering what they think scores
// instead of what they think, and the end-of-semester measurement is quietly
// worthless.
//
// No Date.now() and no randomness: every case is reproducible in tests.

import type {
  Arquetipo,
  Banda,
  BandaAgencia,
  CompasAnswers,
  CompasArquetipos,
  CompasCortesEje,
  CompasItem,
  CompasMovimiento,
  CompasPosicion,
  Timon,
} from '../types/compas';

/**
 * Average of the vectors the student picked.
 *
 * The mean is over ANSWERED items, not over all of them — the opposite of
 * `scoreMCBlock`, and deliberately so. There, skipping had to cost something or
 * abandoning a block paid off. Here a skip means "I don't have an opinion on
 * this", and pulling that student toward the origin would invent a moderate
 * they never claimed to be.
 *
 * Returns null when nothing was answered: there is no position to report, and a
 * silent (0,0) would place them dead center — the most misleading spot on the
 * plane.
 */
export function posicionDe(answers: CompasAnswers, items: CompasItem[]): CompasPosicion | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  let sumM = 0;
  let sumD = 0;
  let respondidas = 0;
  let sumA = 0;
  let agenciaRespondidas = 0;

  for (const item of items) {
    const optionId = answers?.[item.id];
    if (!optionId) continue;
    const option = item.options?.find((o) => o.id === optionId);
    if (!option) continue; // unknown id (stale answer after an item was edited)

    const m = Number(option.vector?.magnitud);
    const d = Number(option.vector?.direccion);
    if (!Number.isFinite(m) || !Number.isFinite(d)) continue;

    sumM += m;
    sumD += d;
    respondidas += 1;

    // Averaged over its OWN denominator, not over `respondidas`. Only six of the
    // twelve items say anything about who acts; dividing by all of them would
    // drag every student toward "in dispute" in proportion to how many
    // unrelated items they happened to answer.
    const a = Number(option.agencia);
    if (Number.isFinite(a)) {
      sumA += a;
      agenciaRespondidas += 1;
    }
  }

  if (respondidas === 0) return null;

  return {
    magnitud: sumM / respondidas,
    direccion: sumD / respondidas,
    respondidas,
    total: items.length,
    agencia: agenciaRespondidas > 0 ? sumA / agenciaRespondidas : null,
    agenciaRespondidas,
  };
}

/**
 * Where a value falls among the agency bands.
 *
 * Bands tile the axis `[min, max]` with touching edges, like `bandaDe`. The
 * comparison is on the upper edge so a value sitting exactly on a boundary
 * lands in the lower band and never in both. Returns null for a student who
 * answered nothing on this axis — there is no band to give them, and the
 * middle one would invent a position they never took.
 */
export function bandaAgenciaDe(
  valor: number | null | undefined,
  bandas: BandaAgencia[] | undefined,
): BandaAgencia | null {
  if (!Number.isFinite(valor as number) || !bandas?.length) return null;
  const v = valor as number;
  for (const b of bandas) {
    const [lo, hi] = b.rango ?? [];
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    if (v >= lo && v <= hi) return b;
  }
  return v < bandas[0].rango[0] ? bandas[0] : bandas[bandas.length - 1];
}

/**
 * Dot colour for the third axis, light (humans) to dark (machines).
 *
 * One hue on purpose. The axis is a magnitude along a single direction, and a
 * categorical palette here would read as five unrelated groups instead of one
 * ordered scale. Points with no agency answer come back null and the caller
 * paints them in the default ink — the room should be able to see who has not
 * expressed anything on this axis yet.
 */
export const RAMPA_AGENCIA = ['#B5D4F4', '#85B7EB', '#378ADD', '#185FA5', '#0C447C'] as const;

export function colorAgencia(
  valor: number | null | undefined,
  bandas: BandaAgencia[] | undefined,
): string | null {
  const b = bandaAgenciaDe(valor, bandas);
  if (!b || !bandas?.length) return null;
  const i = bandas.findIndex((x) => x.id === b.id);
  if (i < 0) return null;
  return RAMPA_AGENCIA[Math.min(RAMPA_AGENCIA.length - 1, i)];
}

/**
 * Which band a value falls in.
 *
 * The JSON writes bands as ranges whose edges touch (`bajo: [-10,-2.5]`,
 * `medio: [-2.5, 2.5]`). Only the upper edges are read, and the comparison is
 * strict on the low side so a value sitting exactly on an edge lands in the
 * HIGHER band and never in both.
 */
export function bandaDe(valor: number, cortes: CompasCortesEje): Banda {
  const topeBajo = Number(cortes?.bajo?.[1]);
  const topeMedio = Number(cortes?.medio?.[1]);
  if (!Number.isFinite(valor) || !Number.isFinite(topeBajo) || !Number.isFinite(topeMedio)) {
    return 'medio';
  }
  if (valor < topeBajo) return 'bajo';
  if (valor <= topeMedio) return 'medio';
  return 'alto';
}

/** What the student answered on the tiebreak item, or null if they skipped it. */
export function timonDe(answers: CompasAnswers, items: CompasItem[]): Timon | null {
  const item = items?.find((i) => i.esItemDeTimon);
  if (!item) return null;
  const optionId = answers?.[item.id];
  if (!optionId) return null;
  return item.options?.find((o) => o.id === optionId)?.timon ?? null;
}

/**
 * The archetype for a position.
 *
 * Two archetypes share the cell (magnitud alta, dirección baja): El Vigilante
 * and La Oligarquía both think AI matters a lot and erodes democracy, and what
 * separates them is who the villain is — the State or the companies. That is a
 * third axis, not visible on the plane, so the tiebreak item decides. A student
 * who skipped that item falls to `desempate.porDefecto`.
 */
export function arquetipoDe(
  posicion: CompasPosicion | null,
  timon: Timon | null,
  doc: CompasArquetipos,
): Arquetipo | null {
  if (!posicion || !doc?.arquetipos?.length) return null;

  const bandaM = bandaDe(posicion.magnitud, doc.cortes?.magnitud);
  const bandaD = bandaDe(posicion.direccion, doc.cortes?.direccion);

  const enCelda = doc.arquetipos.filter(
    (a) => a.celda?.magnitud === bandaM && a.celda?.direccion === bandaD,
  );
  if (enCelda.length === 0) return null;
  if (enCelda.length === 1) return enCelda[0];

  // Shared cell: the tiebreak item decides.
  const porId = (id: string) => enCelda.find((a) => a.id === id) ?? null;

  if (timon) {
    const regla = doc.desempate?.reglas?.find((r) => r.timon?.includes(timon));
    const elegido = regla ? porId(regla.arquetipo) : null;
    if (elegido) return elegido;
  }

  return porId(doc.desempate?.porDefecto) ?? enCelda[0];
}

/**
 * Movement between two applications of the SAME instrument version. Comparing
 * across versions is meaningless — if an item changed, so did the ruler.
 */
export function movimiento(desde: CompasPosicion, hasta: CompasPosicion): CompasMovimiento | null {
  if (!desde || !hasta) return null;
  const dMagnitud = hasta.magnitud - desde.magnitud;
  const dDireccion = hasta.direccion - desde.direccion;
  if (!Number.isFinite(dMagnitud) || !Number.isFinite(dDireccion)) return null;
  return {
    dMagnitud,
    dDireccion,
    distancia: Math.hypot(dMagnitud, dDireccion),
  };
}

/**
 * Empirical terciles of one axis, to replace the provisional cuts once a real
 * cohort has answered.
 *
 * The cuts shipped in `arquetipos_v1.json` are round numbers written by hand,
 * and a position is the mean of ten items — so almost nobody reaches the
 * extremes and the corner archetypes come out empty. Same lesson as
 * `timeLimitSeconds`: it can only be settled by thirty people actually running
 * it. Returns null below 12 positions, where terciles are noise.
 */
export function tercilesDe(valores: number[]): [number, number] | null {
  const limpios = (valores ?? []).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (limpios.length < 12) return null;
  const en = (frac: number) => limpios[Math.min(limpios.length - 1, Math.floor(limpios.length * frac))];
  return [en(1 / 3), en(2 / 3)];
}

/** One person's answers, as they travel in `compasRuns/{code}/respuestas`. */
export interface RespuestasDe {
  playerId: string;
  answers: CompasAnswers;
}

/**
 * Everyone's position after the first `hasta` items.
 *
 * Slicing the items rather than the answers is deliberate: a student who
 * answered item 4 while the room was still on item 3 (they can, the phone shows
 * whatever the host put up) must not be plotted ahead of the room. The cloud
 * shows where the class is on the item being discussed, not where each phone
 * happens to have got to.
 */
export function posicionesDeCohorte(
  respuestas: RespuestasDe[],
  items: CompasItem[],
  hasta: number,
): Array<{ id: string; pos: CompasPosicion }> {
  if (!Array.isArray(respuestas) || hasta <= 0) return [];
  const visibles = items.slice(0, hasta);
  const out: Array<{ id: string; pos: CompasPosicion }> = [];
  for (const r of respuestas) {
    const pos = posicionDe(r?.answers ?? {}, visibles);
    if (pos) out.push({ id: r.playerId, pos });
  }
  return out;
}

/**
 * The same cloud one item back — what the trails are drawn from. Empty before
 * item 2, where there is no previous position and a trail would be a line from
 * nowhere.
 */
export function posicionesPreviasDeCohorte(
  respuestas: RespuestasDe[],
  items: CompasItem[],
  hasta: number,
): Record<string, CompasPosicion> {
  const out: Record<string, CompasPosicion> = {};
  if (hasta < 2) return out;
  for (const { id, pos } of posicionesDeCohorte(respuestas, items, hasta - 1)) {
    out[id] = pos;
  }
  return out;
}

/**
 * Cuantos respondieron EL ITEM QUE ESTA EN PANTALLA.
 *
 * Antes la sala contaba `participante.respondidas >= itemIndex`, o sea una
 * CUENTA contra un INDICE. Eso solo da la respuesta correcta si nadie se salta
 * nada: quien dejo pasar el item 2 y contesto el 3 llega al item 3 con
 * respondidas = 2 y queda marcado como atrasado por el resto de la sesion, sin
 * forma de recuperarse. En este instrumento saltarse un item es una respuesta
 * legitima —"no tengo opinion sobre esto"— asi que el contador castigaba
 * justamente lo que el diseno permite a proposito.
 *
 * Se cuenta sobre `respuestas`, que es lo que el anfitrion ya tiene a la vista.
 * El numero manda al profesor a cortar el item, asi que tiene que decir "cuantos
 * ya opinaron de ESTO", no "cuantos llevan al menos N respuestas".
 */
export function cuantosRespondieron(
  respuestas: RespuestasDe[],
  itemId: string | null | undefined,
): number {
  if (!itemId || !Array.isArray(respuestas)) return 0;
  return respuestas.filter((r) => !!r?.answers?.[itemId]).length;
}
