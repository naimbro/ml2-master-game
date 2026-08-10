/**
 * El rezagado de la ronda: quien envio su respuesta despues de que el anfitrion
 * ya cerro la tabla.
 *
 * `processRoundEnd` escribe `rounds/round_N` a partir de una foto de las
 * submissions tomada milisegundos despues de que envia el anfitrion, y hasta el
 * 2026-08-10 ese documento no se volvia a tocar nunca. El alumno cuya escritura
 * llegaba 0,6 s mas tarde desaparecia de esa ronda para siempre — y como el
 * acumulado se arrastra desde ahi, perdia tambien todo lo que venia despues. En
 * el juego PEB9FL (2 jugadores) le paso al segundo en 5 de 6 rondas de
 * alternativas: 249 puntos cuando la suma real de sus rondas era 514. En
 * MGT300 clase 1, con 42 alumnos de verdad, le paso a uno en la ronda 2.
 *
 * Las rondas abiertas se salvaban de casualidad: la espera de los jueces es tan
 * larga que para cuando la funcion vuelve a consultar, ya llegaron todos. La
 * carrera se ve solo en las rondas de alternativas, donde el puntaje ya viene
 * calculado del cliente y no hay nada que demore.
 *
 * Este modulo es la aritmetica de meter al rezagado en la tabla ya escrita.
 * REGLA QUE MANDA: a quien ya figuraba no se le toca el acumulado. Su
 * `totalScore` ya incluye esta ronda; volver a sumarsela seria pagarle dos
 * veces. Lo unico que le cambia es el lugar, porque alguien se le metio al
 * lado.
 */

/** Una fila de `rounds/round_N.rankings`. */
export interface RankingRow {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  /** Acumulado del jugador incluyendo esta ronda. */
  totalScore: number;
  /** Solo en rondas recalibradas por duelos. */
  provScore?: number;
  provRank?: number;
}

/** El puntaje de una submission ya evaluada. */
export interface PlayerScore {
  playerId: string;
  playerName: string;
  score: number;
}

/** Un rezagado, con su acumulado hasta la ronda ANTERIOR. */
export interface LateScore extends PlayerScore {
  prevTotal: number;
}

/**
 * Ordena de mayor a menor y numera. Empatados comparten lugar y el siguiente
 * salta (1, 1, 3), que es como venia numerando `processRoundEnd`.
 */
export function rankScores<T extends { score: number }>(scores: T[]): (T & { rank: number })[] {
  const ordenados = [...scores].sort((a, b) => b.score - a.score);
  let lugar = 1;
  return ordenados.map((s, i) => {
    if (i > 0 && s.score < ordenados[i - 1].score) lugar = i + 1;
    return { ...s, rank: lugar };
  });
}

/**
 * Los jugadores con puntaje que la tabla escrita no tiene.
 *
 * Deduplica por jugador: una doble submission de la misma ronda es un bug
 * conocido del cliente (ver el cerrojo de `Round.tsx`), y meterla dos veces
 * aca duplicaria la fila igual que antes.
 */
export function missingFromRankings(existing: RankingRow[], scores: PlayerScore[]): PlayerScore[] {
  const yaEstan = new Set(existing.map((r) => r.playerId));
  const vistos = new Set<string>();
  return scores.filter((s) => {
    if (yaEstan.has(s.playerId) || vistos.has(s.playerId)) return false;
    vistos.add(s.playerId);
    return true;
  });
}

/**
 * Mete a los rezagados en la tabla y renumera todo.
 *
 * A los que ya estaban les copia `score` y `totalScore` intactos (y `provScore`
 * / `provRank` si los traian); solo el rezagado estrena acumulado, sumando esta
 * ronda a lo que traia de las anteriores. En una ronda no rankeada no suma
 * nada, igual que para todos los demas.
 */
export function mergeLateScores(
  existing: RankingRow[],
  late: LateScore[],
  isRanked: boolean
): RankingRow[] {
  if (late.length === 0) return existing;

  const nuevas: RankingRow[] = late.map((s) => ({
    playerId: s.playerId,
    playerName: s.playerName,
    score: s.score,
    rank: 0,
    totalScore: isRanked ? s.prevTotal + s.score : s.prevTotal,
  }));

  return rankScores([...existing, ...nuevas]).map(({ rank, ...fila }) => ({ ...fila, rank }));
}
