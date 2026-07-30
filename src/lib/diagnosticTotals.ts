// Qué rondas cuentan para el puntaje que ve el estudiante al final.
//
// La regla normal es "solo las rondas rankeadas", y está bien mientras el juego
// tenga alguna. Un juego enteramente diagnóstico —la clase 1 de dataviz_2026 son
// cinco rondas con `ranked: false`— no tiene ninguna, y con la regla normal
// todos terminan con total 0, promedio 0 y un podio de ceros en orden
// arbitrario. Eso no es un ranking suprimido, es un ranking roto.
//
// Así que: si hay rondas rankeadas, se cuentan esas. Si no hay ninguna, se
// cuentan todas y se marca `diagnosticOnly` para que la pantalla no muestre
// podio ni posición — el número informa, no compite.
//
// Puro y sin React a propósito: esto vivía dentro de un `.map` de JSX, donde
// dividía por `roundScores.length` en vez de por las rondas contadas.

export interface RoundScoreInput {
  /** finalScore de la submission de esa ronda; undefined si no hubo submission. */
  score: number | undefined;
  ranked: boolean;
}

export interface RoundScoreSummary {
  total: number;
  /** Entero. 0 cuando no hay ninguna ronda que contar. */
  average: number;
  countedRounds: number;
  /** True cuando el juego no tenía ninguna ronda rankeada. */
  diagnosticOnly: boolean;
}

export function summarizeRoundScores(rounds: RoundScoreInput[]): RoundScoreSummary {
  const hasRanked = rounds.some((r) => r.ranked);
  const counted = hasRanked ? rounds.filter((r) => r.ranked) : rounds;

  const total = counted.reduce((sum, r) => {
    const n = Number(r.score);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  return {
    total,
    average: counted.length > 0 ? Math.round(total / counted.length) : 0,
    countedRounds: counted.length,
    diagnosticOnly: rounds.length > 0 && !hasRanked,
  };
}
