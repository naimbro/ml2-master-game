import { describe, it, expect } from 'vitest';
import { fitBradleyTerry, buildPairwiseCounts, type PlayerResponse } from './bradley-terry';

const W = { j1: 1, j2: 1, j3: 1 };

function p(id: string, scores: Record<string, number>, llm = 0): PlayerResponse {
  return {
    playerId: id,
    playerName: id,
    llmScore: llm,
    judgeScores: Object.entries(scores).map(([judgeId, score]) => ({ judgeId, score })),
  };
}

describe('fitBradleyTerry', () => {
  it('ranks a transitive triple in order when all judges agree', () => {
    const players = [
      p('A', { j1: 90, j2: 90, j3: 90 }),
      p('B', { j1: 50, j2: 50, j3: 50 }),
      p('C', { j1: 10, j2: 10, j3: 10 }),
    ];
    const r = fitBradleyTerry(players, W);
    expect(r.ranking).toEqual(['A', 'B', 'C']);
    expect(r.strength['A']).toBeGreaterThan(r.strength['B']);
    expect(r.strength['B']).toBeGreaterThan(r.strength['C']);
  });

  it('diverges from the LLM average when a judge uses an extreme scale', () => {
    // LLM avg: A=(100+40+40)/3=60 > B=(0+50+50)/3=33.3  -> LLM says A>B
    // Pairwise votes: j1 A>B, j2 B>A, j3 B>A -> BT says B>A
    const players = [
      p('A', { j1: 100, j2: 40, j3: 40 }, 60),
      p('B', { j1: 0, j2: 50, j3: 50 }, 33.3),
    ];
    const r = fitBradleyTerry(players, W);
    expect(r.ranking).toEqual(['B', 'A']);
    expect(r.strength['B']).toBeGreaterThan(r.strength['A']);
  });

  it('gives finite, ordered strengths under perfect separation (prior)', () => {
    const players = [
      p('A', { j1: 90, j2: 90, j3: 90 }),
      p('B', { j1: 10, j2: 10, j3: 10 }),
    ];
    const r = fitBradleyTerry(players, W);
    expect(Number.isFinite(r.strength['A'])).toBe(true);
    expect(Number.isFinite(r.strength['B'])).toBe(true);
    expect(r.strength['A']).toBeGreaterThan(r.strength['B']);
  });

  it('assigns near-equal strength to identical responses', () => {
    const players = [
      p('A', { j1: 55, j2: 55, j3: 55 }),
      p('B', { j1: 55, j2: 55, j3: 55 }),
    ];
    const r = fitBradleyTerry(players, W);
    expect(Math.abs(r.strength['A'] - r.strength['B'])).toBeLessThan(1e-6);
  });

  it('respects judge weights (heavier judge decides)', () => {
    // j1 (weight 5) says A>B; j2,j3 (weight 1) say B>A -> weighted 5 vs 2 -> A wins
    const players = [
      p('A', { j1: 90, j2: 40, j3: 40 }),
      p('B', { j1: 10, j2: 60, j3: 60 }),
    ];
    const r = fitBradleyTerry(players, { j1: 5, j2: 1, j3: 1 });
    expect(r.ranking).toEqual(['A', 'B']);
  });
});

describe('buildPairwiseCounts', () => {
  it('counts ties as half a win each direction', () => {
    const players = [
      p('A', { j1: 50 }),
      p('B', { j1: 50 }),
    ];
    const { ids, wins } = buildPairwiseCounts(players, { j1: 1 }, 0);
    const i = ids.indexOf('A'); const j = ids.indexOf('B');
    expect(wins[i][j]).toBeCloseTo(0.5, 9);
    expect(wins[j][i]).toBeCloseTo(0.5, 9);
  });
});
