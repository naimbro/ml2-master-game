/**
 * De donde sale el puntaje de una ronda, cuando hay dos copias guardadas.
 *
 * Cada respuesta abierta se puntua dos veces: primero los jueces, que escriben
 * `submissions/*.evaluation.finalScore`, y despues los duelos, que escriben el
 * puntaje recalibrado en `rounds/round_N.rankings[].score`. `recalibrateRound`
 * NO reescribe la submission — el finalScore del juez queda ahi como registro de
 * lo que dijo el panel, y esta bien que asi sea.
 *
 * El problema es que hasta el 2026-08-03 el podio final y los reportes sumaban
 * la submission, o sea el puntaje ANTES de los duelos, mientras la tabla
 * acumulada del curso sumaba `players[].totalScore`, que es el de DESPUES. En
 * el juego MTF4MX (33 alumnos, clase 1 de dataviz) eso dio dos rankings
 * distintos: el podio corono a amalia urrutia y la tabla a Lucas.
 *
 * Regla, desde ahora y en todas partes: **manda el doc de la ronda**. La
 * submission es el respaldo, para juegos viejos que no tienen `rounds/` o para
 * una ronda que nunca se proceso.
 *
 * Este archivo esta duplicado en `src/lib/finalScores.ts` y en
 * `functions/src/lib/finalScores.ts`, con contenido IDENTICO: el frontend y las
 * Cloud Functions son paquetes distintos y no comparten codigo. Mantenerlos byte
 * a byte iguales es mas barato que razonar sobre dos versiones.
 */

/** Igual que functions/src/lib/parse.ts: los puntajes viajan como string mas seguido de lo que uno quisiera. */
export function coerceScore(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return NaN;
    return Number(t);
  }
  return NaN;
}

/** Una fila de `rounds/round_N.rankings`. */
export interface RankingRowInput {
  playerId: string;
  playerName?: string;
  score?: unknown;
}

/** Un doc de `games/{code}/rounds/round_N`. `round` es 1-based. */
export interface RoundDocInput {
  round: number;
  rankings?: RankingRowInput[];
}

/** Una submission, usada solo como respaldo. `round` es 1-based. */
export interface SubmissionInput {
  playerId: string;
  playerName?: string;
  round: number;
  finalScore?: unknown;
}

export interface PlayerRoundScores {
  playerId: string;
  playerName: string;
  /**
   * Denso e indexado por ronda-1. `null` = no hay puntaje de ese alumno en esa
   * ronda, que no es lo mismo que un cero: quien falto a la ronda no debe
   * arrastrar un 0 al promedio. Quien entrego una respuesta vacia y saco 0 si
   * lleva 0, porque ese cero es un puntaje real.
   */
  scores: Array<number | null>;
}

/**
 * Cruza los docs de ronda con las submissions y devuelve, por alumno, el
 * puntaje autoritativo de cada ronda. Aparecen todos los que tengan al menos un
 * puntaje en alguna de las dos fuentes.
 *
 * `totalRounds` fija el largo de `scores` para que el llamador pueda indexar por
 * ronda sin chequear el largo. Si un doc trae una ronda mas alta que
 * `totalRounds` (juego acortado a mano), el arreglo crece hasta cubrirla.
 */
export function collectPlayerRoundScores(
  totalRounds: number,
  rounds: RoundDocInput[],
  submissions: SubmissionInput[] = [],
): PlayerRoundScores[] {
  const maxRound = Math.max(
    totalRounds,
    ...rounds.map((r) => r.round),
    ...submissions.map((s) => s.round),
    0,
  );

  const scores = new Map<string, Array<number | null>>();
  // El nombre lo gana la ronda mas alta en que aparece: si alguien se cambio el
  // nombre a mitad de juego, el podio muestra el ultimo.
  const names = new Map<string, { round: number; name: string }>();

  const slot = (playerId: string) => {
    let row = scores.get(playerId);
    if (!row) {
      row = new Array<number | null>(maxRound).fill(null);
      scores.set(playerId, row);
    }
    return row;
  };

  const noteName = (playerId: string, round: number, name: string | undefined) => {
    if (!name) return;
    const current = names.get(playerId);
    if (!current || round >= current.round) names.set(playerId, { round, name });
  };

  // Respaldo primero, para que el doc de la ronda lo pise.
  for (const s of submissions) {
    if (!s.playerId || !Number.isInteger(s.round) || s.round < 1) continue;
    const value = coerceScore(s.finalScore);
    noteName(s.playerId, s.round, s.playerName);
    if (!Number.isFinite(value)) continue;
    slot(s.playerId)[s.round - 1] = value;
  }

  for (const doc of rounds) {
    if (!Number.isInteger(doc.round) || doc.round < 1) continue;
    for (const row of doc.rankings ?? []) {
      if (!row?.playerId) continue;
      const value = coerceScore(row.score);
      noteName(row.playerId, doc.round, row.playerName);
      if (!Number.isFinite(value)) continue;
      slot(row.playerId)[doc.round - 1] = value;
    }
  }

  return [...scores.entries()]
    .filter(([, row]) => row.some((v) => v !== null))
    .map(([playerId, row]) => ({
      playerId,
      playerName: names.get(playerId)?.name || 'Anonimo',
      scores: row,
    }));
}

/**
 * Indice `${ronda}:${playerId}` -> puntaje autoritativo, para el codigo que ya
 * itera submissions y solo necesita reemplazar el finalScore del juez.
 * `roundScoreKey` es la unica forma valida de armar la clave.
 */
export function roundScoreKey(round: number, playerId: string): string {
  return `${round}:${playerId}`;
}

export function buildRoundScoreIndex(rounds: RoundDocInput[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const doc of rounds) {
    if (!Number.isInteger(doc.round) || doc.round < 1) continue;
    for (const row of doc.rankings ?? []) {
      if (!row?.playerId) continue;
      const value = coerceScore(row.score);
      if (!Number.isFinite(value)) continue;
      index.set(roundScoreKey(doc.round, row.playerId), value);
    }
  }
  return index;
}
