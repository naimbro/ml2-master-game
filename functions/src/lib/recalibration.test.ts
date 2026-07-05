import { describe, it, expect } from 'vitest';
import { sortByProvisional, swissPairs, recalibrateScores, type RecalPlayer, type DuelResult } from './recalibration';
import { pickClimax } from './recalibration';

const P = (id: string, prov: number): RecalPlayer => ({ id, prov });

describe('sortByProvisional', () => {
  it('orders indices by provisional score desc, tie-break by id', () => {
    const players = [P('b', 70), P('a', 70), P('c', 90)];
    expect(sortByProvisional(players)).toEqual([2, 1, 0]); // c(90), a(70), b(70)
  });
});

describe('swissPairs', () => {
  it('pairs only neighbors within band B, no wraparound', () => {
    const order = [0, 1, 2, 3, 4];
    const pairs = swissPairs(order, 2);
    expect(pairs).toEqual([
      [0,1],[1,2],[2,3],[3,4], // d=1
      [0,2],[1,3],[2,4],       // d=2
    ]);
    expect(pairs).not.toContainEqual([0,4]);
  });
});

describe('recalibrateScores', () => {
  const players = [P('A',80), P('B',75), P('C',70), P('D',65)];
  it('keeps provisional order when anchor dominates and duels agree', () => {
    const duels: DuelResult[] = [{i:0,j:1,winner:0},{i:1,j:2,winner:0},{i:2,j:3,winner:0}];
    const r = recalibrateScores(players, duels, 2.0);
    expect(r['A']).toBeGreaterThan(r['B']);
    expect(r['B']).toBeGreaterThan(r['C']);
    expect(r['C']).toBeGreaterThan(r['D']);
  });
  it('overturns a close pair when fresh duels contradict the anchor (pairwise-dominant)', () => {
    const duels: DuelResult[] = [{i:0,j:1,winner:1},{i:1,j:2,winner:1},{i:2,j:3,winner:0}];
    const r = recalibrateScores(players, duels, 0.35);
    expect(r['B']).toBeGreaterThan(r['A']);
    expect(r['C']).toBeGreaterThan(r['B']);
  });
  it('preserves the provisional score scale (same mean & sd)', () => {
    const duels: DuelResult[] = [{i:0,j:1,winner:1},{i:2,j:3,winner:1}];
    const r = recalibrateScores(players, duels, 0.35);
    const outs = players.map(p => r[p.id]);
    const provs = players.map(p => p.prov);
    const mean = (a:number[]) => a.reduce((s,v)=>s+v,0)/a.length;
    const sd = (a:number[]) => { const m=mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/a.length); };
    expect(mean(outs)).toBeCloseTo(mean(provs), 6);
    expect(sd(outs)).toBeCloseTo(sd(provs), 6);
  });
  it('splits ties half/half', () => {
    const even = [P('A',70), P('B',70)];
    const duels: DuelResult[] = [{i:0,j:1,winner:-1}];
    const r = recalibrateScores(even, duels, 0.35);
    expect(Math.abs(r['A'] - r['B'])).toBeLessThan(1e-6);
  });
});

describe('pickClimax', () => {
  const provRank = [1, 2, 3, 4]; // provRank[playerIndex]; higher = worse
  it('returns null when there are no upsets', () => {
    const duels = [{ i: 0, j: 1, winner: 0 as const }, { i: 2, j: 3, winner: 0 as const }];
    expect(pickClimax(duels, provRank)).toBeNull();
  });
  it('picks the biggest giant-killing upset', () => {
    const duels = [
      { i: 0, j: 1, winner: 1 as const }, // rank2 beats rank1, gap1
      { i: 0, j: 3, winner: 1 as const }, // rank4 beats rank1, gap3 -> climax (index 1)
    ];
    expect(pickClimax(duels, provRank)).toBe(1);
  });
  it('ignores ties', () => {
    const duels = [{ i: 0, j: 3, winner: -1 as const }];
    expect(pickClimax(duels, provRank)).toBeNull();
  });
});
