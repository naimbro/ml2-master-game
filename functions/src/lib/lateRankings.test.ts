import { describe, it, expect } from 'vitest';
import {
  rankScores,
  missingFromRankings,
  mergeLateScores,
  type RankingRow,
  type PlayerScore,
} from './lateRankings';

const row = (r: Partial<RankingRow> & { playerId: string; score: number; totalScore: number }): RankingRow => ({
  playerName: r.playerId,
  rank: 0,
  ...r,
});

describe('rankScores', () => {
  it('ordena de mayor a menor y numera desde 1', () => {
    const out = rankScores([
      { playerId: 'b', playerName: 'B', score: 70 },
      { playerId: 'a', playerName: 'A', score: 90 },
    ]);
    expect(out.map((r) => [r.playerId, r.rank])).toEqual([['a', 1], ['b', 2]]);
  });

  it('empata en el mismo lugar y salta el siguiente', () => {
    const out = rankScores([
      { playerId: 'a', playerName: 'A', score: 90 },
      { playerId: 'b', playerName: 'B', score: 90 },
      { playerId: 'c', playerName: 'C', score: 50 },
    ]);
    expect(out.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe('missingFromRankings', () => {
  const scores: PlayerScore[] = [
    { playerId: 'a', playerName: 'A', score: 90 },
    { playerId: 'b', playerName: 'B', score: 70 },
  ];

  it('devuelve al jugador que envio pero no quedo en la tabla', () => {
    const existing = [row({ playerId: 'a', score: 90, totalScore: 90, rank: 1 })];
    expect(missingFromRankings(existing, scores).map((s) => s.playerId)).toEqual(['b']);
  });

  it('devuelve vacio cuando la tabla ya los tiene a todos', () => {
    const existing = [
      row({ playerId: 'a', score: 90, totalScore: 90, rank: 1 }),
      row({ playerId: 'b', score: 70, totalScore: 70, rank: 2 }),
    ];
    expect(missingFromRankings(existing, scores)).toEqual([]);
  });

  it('no duplica a quien mando dos submissions de la misma ronda', () => {
    const dobles: PlayerScore[] = [
      { playerId: 'b', playerName: 'B', score: 70 },
      { playerId: 'b', playerName: 'B', score: 70 },
    ];
    expect(missingFromRankings([], dobles).map((s) => s.playerId)).toEqual(['b']);
  });
});

describe('mergeLateScores', () => {
  // La tabla que quedo escrita cuando el rezagado no alcanzo a entrar.
  const existing = [
    row({ playerId: 'a', playerName: 'A', score: 90, totalScore: 190, rank: 1 }),
    row({ playerId: 'c', playerName: 'C', score: 50, totalScore: 150, rank: 2 }),
  ];

  it('inserta al rezagado en su lugar y renumera a los demas', () => {
    const out = mergeLateScores(existing, [
      { playerId: 'b', playerName: 'B', score: 70, prevTotal: 100 },
    ], true);

    expect(out.map((r) => [r.playerId, r.rank, r.totalScore])).toEqual([
      ['a', 1, 190],
      ['b', 2, 170],
      ['c', 3, 150],
    ]);
  });

  it('NO vuelve a sumarle la ronda a quien ya estaba', () => {
    // Esta es la regla que impide el doble conteo: el acumulado de los que ya
    // figuraban ya incluye esta ronda, asi que se copia tal cual.
    const out = mergeLateScores(existing, [
      { playerId: 'b', playerName: 'B', score: 70, prevTotal: 100 },
    ], true);
    expect(out.find((r) => r.playerId === 'a')!.totalScore).toBe(190);
    expect(out.find((r) => r.playerId === 'c')!.totalScore).toBe(150);
  });

  it('en una ronda no rankeada el rezagado entra sin sumar puntaje', () => {
    const out = mergeLateScores(existing, [
      { playerId: 'b', playerName: 'B', score: 70, prevTotal: 100 },
    ], false);
    expect(out.find((r) => r.playerId === 'b')!.totalScore).toBe(100);
  });

  it('empata con quien ya estaba y comparten lugar', () => {
    const out = mergeLateScores(existing, [
      { playerId: 'b', playerName: 'B', score: 90, prevTotal: 100 },
    ], true);
    expect(out.map((r) => [r.playerId, r.rank])).toEqual([['a', 1], ['b', 1], ['c', 3]]);
  });

  it('conserva provScore y provRank de las filas ya escritas', () => {
    const recalibrada = [
      row({ playerId: 'a', score: 88, totalScore: 188, rank: 1, provScore: 90, provRank: 1 }),
    ];
    const out = mergeLateScores(recalibrada, [
      { playerId: 'b', playerName: 'B', score: 70, prevTotal: 100 },
    ], true);
    expect(out[0].provScore).toBe(90);
    expect(out[0].provRank).toBe(1);
    expect(out[1].provScore).toBeUndefined();
  });

  it('sin rezagados devuelve la misma tabla', () => {
    expect(mergeLateScores(existing, [], true)).toEqual(existing);
  });

  it('arma la tabla desde cero cuando no habia nada escrito', () => {
    const out = mergeLateScores([], [
      { playerId: 'b', playerName: 'B', score: 70, prevTotal: 100 },
      { playerId: 'a', playerName: 'A', score: 90, prevTotal: 100 },
    ], true);
    expect(out.map((r) => [r.playerId, r.rank, r.totalScore])).toEqual([
      ['a', 1, 190],
      ['b', 2, 170],
    ]);
  });
});
