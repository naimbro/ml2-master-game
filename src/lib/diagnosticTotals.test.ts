import { describe, it, expect } from 'vitest';
import { summarizeRoundScores } from './diagnosticTotals';

describe('summarizeRoundScores', () => {
  it('cuenta solo las rondas rankeadas cuando hay al menos una', () => {
    const r = summarizeRoundScores([
      { score: 80, ranked: true },
      { score: 60, ranked: true },
      { score: 90, ranked: false },
    ]);
    expect(r).toEqual({ total: 140, average: 70, countedRounds: 2, diagnosticOnly: false });
  });

  it('divide el promedio por las rondas contadas, no por todas', () => {
    // Antes esto daba 47 (140/3) en la pantalla final.
    const r = summarizeRoundScores([
      { score: 80, ranked: true },
      { score: 60, ranked: true },
      { score: 0, ranked: false },
    ]);
    expect(r.average).toBe(70);
  });

  it('cuenta todas las rondas cuando ninguna es rankeada', () => {
    const r = summarizeRoundScores([
      { score: 90, ranked: false },
      { score: 70, ranked: false },
      { score: 50, ranked: false },
    ]);
    expect(r).toEqual({ total: 210, average: 70, countedRounds: 3, diagnosticOnly: true });
  });

  it('trata una ronda sin puntaje como 0 pero la cuenta', () => {
    const r = summarizeRoundScores([
      { score: 80, ranked: false },
      { score: undefined, ranked: false },
    ]);
    expect(r).toEqual({ total: 80, average: 40, countedRounds: 2, diagnosticOnly: true });
  });

  it('no divide por cero con una lista vacia', () => {
    expect(summarizeRoundScores([])).toEqual({
      total: 0,
      average: 0,
      countedRounds: 0,
      diagnosticOnly: false,
    });
  });

  it('ignora puntajes no numericos en vez de propagar NaN', () => {
    const r = summarizeRoundScores([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { score: 'ochenta' as any, ranked: false },
      { score: 60, ranked: false },
    ]);
    expect(r.total).toBe(60);
    expect(Number.isNaN(r.average)).toBe(false);
  });

  // El caso real de la clase 1 de dataviz: cinco rondas, ninguna rankeada.
  it('el Juego 1 de dataviz no queda en cero', () => {
    const r = summarizeRoundScores([
      { score: 100, ranked: false },
      { score: 70, ranked: false },
      { score: 85, ranked: false },
      { score: 62, ranked: false },
      { score: 20, ranked: false },
    ]);
    expect(r.total).toBe(337);
    expect(r.average).toBe(67);
    expect(r.diagnosticOnly).toBe(true);
  });
});
