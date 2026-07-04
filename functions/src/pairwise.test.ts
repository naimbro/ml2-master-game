import { describe, it, expect } from 'vitest';
import { runSwissComparisons, type PairwisePlayer } from './pairwise';

const players: PairwisePlayer[] = [
  { id: 'A', prov: 80, response: 'a' },
  { id: 'B', prov: 76, response: 'b' },
  { id: 'C', prov: 72, response: 'c' },
  { id: 'D', prov: 68, response: 'd' },
];

describe('runSwissComparisons', () => {
  it('schedules band-B duels and records winners via the injected comparator', async () => {
    const compare = async (a: string, b: string) => (a < b ? 'A' : 'B') as 'A' | 'B';
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4);
    // B=2 over 4 players -> gaps 1 (3 pairs) + 2 (2 pairs) = 5 duels
    expect(duels.length).toBe(5);
    for (const d of duels) {
      expect([0, 1]).toContain(d.winner);
      expect(d.i).toBeGreaterThanOrEqual(0);
      expect(d.j).toBeLessThan(players.length);
    }
  });

  it('marks a tie when the comparator returns tie', async () => {
    const compare = async () => 'tie' as const;
    const duels = await runSwissComparisons(players, 'ctx', 1, compare, 4);
    expect(duels.every((d) => d.winner === -1)).toBe(true);
  });
});
