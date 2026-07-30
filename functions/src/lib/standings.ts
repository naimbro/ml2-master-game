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

/** Un juego terminado del curso, ya leido de Firestore y normalizado. */
export interface GameResult {
  gameCode: string;
  sessionId: string;
  sessionTitle: string;
  finishedAtMs: number;
  players: GamePlayerInput[];
}

export interface StandingsEntry {
  uid: string;
  name: string;
  photoURL?: string;
  points: number;
  position: number;
  /** Posicion sin contar el ultimo juego. null = no habia con que comparar. */
  previousPosition: number | null;
  /** Alineados con los juegos ordenados por fecha. null = falto a esa clase. */
  pointsByGame: Array<number | null>;
  positionsByGame: Array<number | null>;
  gamesPlayed: number;
}

export interface AccumulateOptions {
  /**
   * Cuantas de las peores casillas se descartan. Solo se usa al cierre del
   * semestre y solo a pedido: durante el curso la tabla suma todo, porque si
   * no un alumno podria SUBIR de puesto en una semana que le fue mal.
   */
  dropWorst?: number;
}

function byTotalDescending(a: { points: number; uid: string }, b: { points: number; uid: string }) {
  return b.points - a.points || a.uid.localeCompare(b.uid);
}

/** Ranking de competencia estandar sobre totales ya calculados. */
function positionsFromTotals(totals: Array<{ uid: string; points: number }>): Map<string, number> {
  const sorted = [...totals].sort(byTotalDescending);
  const out = new Map<string, number>();
  let position = 0;
  let previous: number | null = null;
  sorted.forEach((row, index) => {
    if (previous === null || row.points !== previous) {
      position = index + 1;
      previous = row.points;
    }
    out.set(row.uid, position);
  });
  return out;
}

function sumSlots(slots: Array<number | null>, dropWorst: number): number {
  const values = slots.map((v) => v ?? 0);
  if (dropWorst > 0) {
    values.sort((a, b) => a - b);
    values.splice(0, Math.min(dropWorst, values.length));
  }
  return values.reduce((acc, v) => acc + v, 0);
}

export function accumulate(games: GameResult[], options: AccumulateOptions = {}): StandingsEntry[] {
  const dropWorst = options.dropWorst ?? 0;
  const ordered = [...games].sort((a, b) => a.finishedAtMs - b.finishedAtMs);
  if (ordered.length === 0) return [];

  const perGame = ordered.map((g) => ({ ranks: rankGame(g.players), game: g }));

  // Identidad y nombre: gana el nombre del juego mas reciente en que aparece.
  const names = new Map<string, { name: string; photoURL?: string }>();
  for (const { game: g } of perGame) {
    for (const pl of g.players) names.set(pl.uid, { name: pl.name, photoURL: pl.photoURL });
  }

  const uids = [...names.keys()];
  const slotsOf = (uid: string, upTo: number) =>
    perGame.slice(0, upTo).map(({ ranks }) => ranks.find((r) => r.uid === uid) ?? null);

  const totals = uids.map((uid) => ({
    uid,
    points: sumSlots(slotsOf(uid, perGame.length).map((r) => (r ? r.points : null)), dropWorst),
  }));
  const positions = positionsFromTotals(totals);

  // La posicion anterior se calcula SIN descarte: es "como iba la semana pasada".
  const previousPositions = perGame.length > 1
    ? positionsFromTotals(uids.map((uid) => ({
        uid,
        points: sumSlots(slotsOf(uid, perGame.length - 1).map((r) => (r ? r.points : null)), 0),
      })))
    : new Map<string, number>();
  const playedBefore = new Set(
    perGame.slice(0, -1).flatMap(({ ranks }) => ranks.map((r) => r.uid))
  );

  const entries: StandingsEntry[] = uids.map((uid) => {
    const slots = slotsOf(uid, perGame.length);
    const meta = names.get(uid)!;
    const entry: StandingsEntry = {
      uid,
      name: meta.name,
      points: totals.find((t) => t.uid === uid)!.points,
      position: positions.get(uid)!,
      previousPosition: playedBefore.has(uid) ? previousPositions.get(uid) ?? null : null,
      pointsByGame: slots.map((r) => (r ? r.points : null)),
      positionsByGame: slots.map((r) => (r ? r.position : null)),
      gamesPlayed: slots.filter(Boolean).length,
    };
    if (meta.photoURL) entry.photoURL = meta.photoURL;
    return entry;
  });

  return entries.sort((a, b) => a.position - b.position || a.uid.localeCompare(b.uid));
}
