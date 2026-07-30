/**
 * Aritmetica del ranking acumulado por curso. Funciones puras: no tocan Firestore
 * ni saben que es un juego. Las importa la Cloud Function recomputeCourseStandings
 * y tambien scripts/course-standings.ts, para que la tabla que ve el alumno y la
 * que ve el profesor no puedan discrepar.
 *
 * Diseno: docs/superpowers/specs/2026-07-30-leaderboard-acumulado-design.md
 */

/** Puntos de las diez primeras posiciones. Fija: no depende de cuantos jugaron. */
export const POINTS_TABLE = [30, 25, 21, 18, 16, 15, 14, 13, 12, 11];

/** Piso para cualquiera que jugo, por mal que le haya ido. */
export const POINTS_FLOOR = 3;

export function pointsForPosition(position: number): number {
  if (!Number.isInteger(position) || position < 1) {
    throw new Error(`Posicion invalida: ${position}`);
  }
  if (position <= POINTS_TABLE.length) return POINTS_TABLE[position - 1];
  const last = POINTS_TABLE[POINTS_TABLE.length - 1];
  return Math.max(POINTS_FLOOR, last - (position - POINTS_TABLE.length));
}

/** Un jugador tal como lo entrega un documento de juego, ya normalizado. */
export interface GamePlayerInput {
  uid: string;
  name: string;
  photoURL?: string;
  totalScore: number;
  /** false = entro al lobby y no envio nada. No cuenta como que jugo. */
  answered: boolean;
}

export interface GameRankRow {
  uid: string;
  position: number;
  points: number;
}

/**
 * Posiciones de UN juego. Ranking de competencia estandar: dos empatados en el
 * 2do quedan ambos 2dos con 25 puntos y el siguiente es 4to. Infla un poco el
 * total repartido; es el costo de que la tabla se lea como la gente espera.
 */
export function rankGame(players: GamePlayerInput[]): GameRankRow[] {
  const played = players.filter((pl) => pl.answered);
  const sorted = [...played].sort(
    (a, b) => b.totalScore - a.totalScore || a.uid.localeCompare(b.uid)
  );

  const rows: GameRankRow[] = [];
  let position = 0;
  let previousScore: number | null = null;

  sorted.forEach((pl, index) => {
    if (previousScore === null || pl.totalScore !== previousScore) {
      position = index + 1;
      previousScore = pl.totalScore;
    }
    rows.push({ uid: pl.uid, position, points: pointsForPosition(position) });
  });

  return rows;
}
