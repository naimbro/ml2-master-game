/**
 * Racha de rondas consecutivas puntuando bien. Es DECORACION: no entra en ningun
 * calculo de puntaje.
 *
 * Vive en el cliente porque `Player` (src/types/game.ts) solo guarda `totalScore` y
 * `currentRoundScore` — no hay historial por ronda en el doc del juego. Mostrarla en la
 * tabla proyectada exigiria escribir `players.{id}.roundScores[]` en `processRoundEnd` y
 * desplegar funciones; por eso la racha se muestra solo en la pantalla del propio jugador.
 */

export const RACHA_THRESHOLD = 70;

export interface RachaState {
  count: number;
  best: number;
  /** Ultima ronda ya contabilizada. Hace `applyRound` idempotente. */
  lastRound: number;
}

export const EMPTY_RACHA: RachaState = { count: 0, best: 0, lastRound: 0 };

export function applyRound(prev: RachaState, round: number, roundScore: number): RachaState {
  // Firestore reemite el doc en cada update; sin esta guarda la misma ronda
  // incrementaria la racha varias veces.
  if (round <= prev.lastRound) return prev;

  const count = roundScore >= RACHA_THRESHOLD ? prev.count + 1 : 0;
  return { count, best: Math.max(prev.best, count), lastRound: round };
}

export function rachaStorageKey(gameCode: string, playerId: string): string {
  return `racha:${gameCode}:${playerId}`;
}

type ReadableStore = { getItem: (key: string) => string | null };
type WritableStore = { setItem: (key: string, value: string) => void };

function isRachaState(v: unknown): v is RachaState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.count === 'number' && typeof o.best === 'number' && typeof o.lastRound === 'number';
}

export function readRacha(store: ReadableStore, key: string): RachaState {
  try {
    const raw = store.getItem(key);
    if (!raw) return EMPTY_RACHA;
    const parsed: unknown = JSON.parse(raw);
    return isRachaState(parsed) ? parsed : EMPTY_RACHA;
  } catch {
    // Safari en modo privado y algunas politicas de empresa lanzan al tocar
    // localStorage. Una racha perdida no puede romper la pantalla de resultados.
    return EMPTY_RACHA;
  }
}

export function writeRacha(store: WritableStore, key: string, state: RachaState): void {
  try {
    store.setItem(key, JSON.stringify(state));
  } catch {
    // Idem: se pierde la racha, no pasa nada mas.
  }
}
