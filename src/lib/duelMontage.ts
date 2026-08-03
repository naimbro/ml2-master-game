/**
 * Cuantos duelos se MUESTRAN, y por cuanto rato.
 *
 * Los duelos que se CORREN no se tocan aca: el schedule Swiss con B=4 genera
 * `4n - 10` pares (118 con 33 alumnos), cada uno juzgado en los dos ordenes, y
 * los 118 alimentan el ajuste Bradley-Terry. Bajar ese numero seria un error
 * estadistico: por alumno son `2B - B(B+1)/n` ≈ 7,4 comparaciones, y como el
 * 38 % termina en empate, las decisivas quedan en ~4,6. Ya esta al limite.
 *
 * Lo que estaba mal era el montaje. Nacio para tapar la espera del LLM y
 * reproducia TODOS los duelos a 420 ms cada uno. Medido en el juego MTF4MX del
 * 2026-08-03: el backend tardo 15,5 s y el montaje 101,7 s. Siete veces mas
 * largo que la espera que lo justificaba, y cada tarjeta demasiado corta para
 * leer dos nombres. Los dos sintomas eran el mismo numero mal puesto.
 *
 * Ahora el montaje tiene un presupuesto de tiempo fijo y muestra una MUESTRA:
 * los duelos se parten en ventanas consecutivas y de cada ventana sale una
 * tarjeta. Asi el montaje recorre la tabla de arriba a abajo en vez de quedarse
 * en los primeros duelos, dura lo mismo con 20 alumnos que con 80, y cada
 * tarjeta se alcanza a ver.
 */
import type { RoundDuel } from '../types/game';

/** Presupuesto del overlay completo, de punta a punta. */
export const MONTAGE_BUDGET_MS = 30_000;

/** El duelo del climax y la tabla final salen del presupuesto antes del montaje. */
export const CLIMAX_MS = 2_600;
export const BOARD_MS = 3_200;

/**
 * Cuanto vive una tarjeta. `hold` es hasta que cae el sello y `after` lo que
 * queda despues. Un duelo normal necesita ~900 ms para leer los dos nombres y
 * ~400 ms para absorber el veredicto; antes eran 260 + 160.
 */
export const DUEL_HOLD_MS = 900;
export const DUEL_AFTER_MS = 400;
/** La sorpresa es el momento que la gente mira: se le da camara lenta. */
export const UPSET_HOLD_MS = 1_500;
export const UPSET_AFTER_MS = 800;

/** Cuanto ocupa una tarjeta en el presupuesto. */
export function duelDurationMs(duel: Pick<RoundDuel, 'isUpset'>): number {
  return duel.isUpset ? UPSET_HOLD_MS + UPSET_AFTER_MS : DUEL_HOLD_MS + DUEL_AFTER_MS;
}

/**
 * Que proporcion de las tarjetas puede ser sorpresa.
 *
 * Hace falta un tope por dos razones. La cara: una sorpresa cuesta casi el doble
 * de tiempo, y sin cuota el montaje se pasa del presupuesto — con los duelos
 * reales de MTF4MX daba 38 s en vez de 30, porque 13 de las 15 ventanas tenian
 * al menos una sorpresa (con 21 % de sorpresas y ventanas de 8, la probabilidad
 * de que una ventana traiga alguna es 1 - 0,79^8 = 85 %).
 *
 * La otra razon es que un montaje donde casi todos los duelos son sorpresa dice
 * algo falso sobre la ronda. Un tercio da el ritmo correcto: duelos parejos con
 * sorpresas cada tanto, que es lo que de verdad paso.
 */
const UPSET_SHARE = 1 / 3;

/** Promedio esperado de una tarjeta con esa mezcla, para repartir las ventanas. */
const AVG_DUEL_MS =
  UPSET_SHARE * (UPSET_HOLD_MS + UPSET_AFTER_MS) +
  (1 - UPSET_SHARE) * (DUEL_HOLD_MS + DUEL_AFTER_MS);

/** Con muy pocos duelos igual hay que mostrar algo, aunque sobre presupuesto. */
const MIN_SLOTS = 6;

export interface MontagePlan {
  /** Cuantas tarjetas caben en el presupuesto. */
  slots: number;
  /** Cuantos duelos cubre cada ventana. */
  stride: number;
  /** Cuantas ventanas salen de verdad; es el largo final del montaje. */
  windows: number;
}

export function planMontage(
  duelTotal: number,
  budgetMs: number = MONTAGE_BUDGET_MS,
): MontagePlan {
  const total = Math.max(0, Math.floor(duelTotal));
  if (total === 0) return { slots: 0, stride: 1, windows: 0 };

  const montageBudget = Math.max(0, budgetMs - CLIMAX_MS - BOARD_MS);
  const affordable = Math.floor(montageBudget / AVG_DUEL_MS);
  const slots = Math.min(total, Math.max(MIN_SLOTS, affordable));
  const stride = Math.max(1, Math.ceil(total / slots));
  // Con `stride` redondeado hacia arriba suelen sobrar ventanas: 118/16 -> 8, y
  // 118 duelos en ventanas de 8 son 15, no 16. El largo real es este.
  return { slots, stride, windows: Math.ceil(total / stride) };
}

/**
 * Cual de los duelos de una ventana merece la tarjeta.
 *
 * Con cuota disponible gana la sorpresa, que es lo que la gente vino a ver. Sin
 * cuota, o entre iguales, gana el duelo mas parejo: dos respuestas separadas por
 * un punto es donde el panel de jueces de verdad no sabia cual era mejor, y
 * donde el duelo aporta algo. El `seq` desempata para que la eleccion no dependa
 * del orden de llegada.
 *
 * Si la ventana es toda sorpresas y la cuota ya se acabo, igual sale una: mejor
 * pasarse unos segundos que dejar un hueco en el recorrido de la tabla.
 */
function bestOfWindow(window: RoundDuel[], upsetAllowed: boolean): RoundDuel {
  const tightest = (a: RoundDuel, b: RoundDuel) => {
    const ga = Math.abs(a.a.provScore - a.b.provScore);
    const gb = Math.abs(b.a.provScore - b.b.provScore);
    if (ga !== gb) return ga < gb ? a : b;
    return a.seq < b.seq ? a : b;
  };
  if (!upsetAllowed) {
    const calmos = window.filter((d) => !d.isUpset);
    if (calmos.length > 0) return calmos.reduce(tightest);
    return window.reduce(tightest);
  }
  return window.reduce((best, d) => {
    if (d.isUpset !== best.isUpset) return d.isUpset ? d : best;
    return tightest(best, d);
  });
}

/**
 * Las tarjetas que ya se pueden mostrar, dado lo que llego hasta ahora.
 *
 * Una ventana entrega su tarjeta recien cuando esta completa, para que la
 * eleccion sea definitiva. Eso hace que el resultado sea estable por prefijo: la
 * tarjeta `k` nunca cambia una vez emitida, que es lo que le permite al
 * reproductor avanzar con un cursor sin reiniciarse.
 *
 * Se indexa por `seq` y no por posicion en el arreglo: los duelos se resuelven
 * con 10 comparaciones en vuelo, asi que llegan con huecos. Cortar por
 * `duels.length` mostraria el duelo de la ventana equivocada.
 *
 * `allDuelsIn` es el escape para cuando el torneo ya termino: una escritura de
 * duelo perdida (el `onDuel` esta envuelto en try/catch justamente para que un
 * fallo cosmetico no aborte el torneo) dejaria un hueco permanente y el montaje
 * se quedaria esperando esa ventana para siempre.
 */
export function selectMontageDuels(
  duels: RoundDuel[],
  duelTotal: number,
  plan: MontagePlan,
  allDuelsIn = false,
): RoundDuel[] {
  if (duels.length === 0 || plan.windows === 0) return [];

  // `duelTotal` viene del doc de la ronda y podria no haber llegado todavia.
  const total = duelTotal > 0 ? duelTotal : duels.length;
  const bySeq = new Map<number, RoundDuel>();
  for (const d of duels) bySeq.set(d.seq, d);

  // La cuota se gasta en orden de ventana, asi que las sorpresas caen sobre todo
  // en la parte alta de la tabla, que es donde el reordenamiento importa mas.
  const upsetQuota = Math.max(1, Math.round(plan.windows * UPSET_SHARE));
  let upsetsUsed = 0;

  const out: RoundDuel[] = [];
  for (let w = 0; w < plan.windows; w++) {
    const start = w * plan.stride;
    const end = Math.min(start + plan.stride, total);
    const window: RoundDuel[] = [];
    let complete = true;
    for (let seq = start; seq < end; seq++) {
      const duel = bySeq.get(seq);
      if (duel) window.push(duel);
      else complete = false;
    }
    if (!complete && !allDuelsIn) break;
    if (window.length === 0) continue;
    const pick = bestOfWindow(window, upsetsUsed < upsetQuota);
    if (pick.isUpset) upsetsUsed++;
    out.push(pick);
  }
  return out;
}
