import { describe, it, expect } from 'vitest';
import {
  spearmanRho,
  kendallTau,
  judgeDisagreementRate,
  ranksDescending,
  linearMatchMoments,
} from './stats';
import type { PlayerResponse } from './bradley-terry';

describe('spearmanRho', () => {
  it('is 1 for identical orderings', () => {
    const a = { x: 3, y: 2, z: 1 };
    const b = { x: 30, y: 20, z: 10 };
    expect(spearmanRho(a, b)).toBeCloseTo(1, 9);
  });
  it('is -1 for reversed orderings', () => {
    const a = { x: 3, y: 2, z: 1 };
    const b = { x: 10, y: 20, z: 30 };
    expect(spearmanRho(a, b)).toBeCloseTo(-1, 9);
  });
});

describe('kendallTau', () => {
  it('is 1 for identical orderings', () => {
    expect(kendallTau({ x: 3, y: 2, z: 1 }, { x: 9, y: 5, z: 1 })).toBeCloseTo(1, 9);
  });
  it('is -1 for reversed orderings', () => {
    expect(kendallTau({ x: 3, y: 2, z: 1 }, { x: 1, y: 5, z: 9 })).toBeCloseTo(-1, 9);
  });
  it('handles a single swap (4 items, one discordant pair)', () => {
    // ranking a: A>B>C>D ; b swaps B and C -> A>C>B>D
    // 6 pairs, 1 discordant (B,C) -> tau = (5-1)/6
    const a = { A: 4, B: 3, C: 2, D: 1 };
    const b = { A: 4, B: 2, C: 3, D: 1 };
    expect(kendallTau(a, b)).toBeCloseTo(4 / 6, 9);
  });
});

describe('ranksDescending', () => {
  it('assigns 1 to the highest value and ties share a rank', () => {
    const r = ranksDescending({ a: 10, b: 10, c: 5 });
    expect(r.a).toBe(1);
    expect(r.b).toBe(1);
    expect(r.c).toBe(3);
  });
});

describe('linearMatchMoments', () => {
  it('maps values to the reference mean and sd', () => {
    const out = linearMatchMoments([1, 2, 3], [10, 20, 30]);
    expect(out[0]).toBeCloseTo(10, 6);
    expect(out[1]).toBeCloseTo(20, 6);
    expect(out[2]).toBeCloseTo(30, 6);
  });
  it('returns the reference mean when input has zero variance', () => {
    expect(linearMatchMoments([5, 5, 5], [2, 4, 6])).toEqual([4, 4, 4]);
  });
});

describe('judgeDisagreementRate', () => {
  it('is 0 when all judges agree on every pair', () => {
    const players: PlayerResponse[] = [
      { playerId: 'A', playerName: 'A', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 9 }, { judgeId: 'j2', score: 8 }] },
      { playerId: 'B', playerName: 'B', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 1 }, { judgeId: 'j2', score: 2 }] },
    ];
    expect(judgeDisagreementRate(players)).toBe(0);
  });
  it('is 1 when the two judges always disagree', () => {
    const players: PlayerResponse[] = [
      { playerId: 'A', playerName: 'A', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 9 }, { judgeId: 'j2', score: 1 }] },
      { playerId: 'B', playerName: 'B', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 1 }, { judgeId: 'j2', score: 9 }] },
    ];
    expect(judgeDisagreementRate(players)).toBe(1);
  });
});
