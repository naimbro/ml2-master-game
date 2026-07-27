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

describe('runSwissComparisons: regla de los dos órdenes (LCES ec. 1)', () => {
  it('cuenta empate cuando el veredicto se da vuelta al invertir el orden', async () => {
    // Sesgo de posición puro: gana siempre quien va primero, diga lo que diga el texto.
    const compare = async () => 'A' as const;
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4);
    expect(duels.length).toBe(5);
    expect(duels.every((d) => d.winner === -1)).toBe(true);
  });

  it('cuenta empate cuando el modelo prefiere siempre la segunda respuesta', async () => {
    const compare = async () => 'B' as const;
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4);
    expect(duels.every((d) => d.winner === -1)).toBe(true);
  });

  it('conserva al ganador cuando el veredicto sobrevive al swap', async () => {
    // Depende del contenido, no de la posición: gana la respuesta alfabéticamente menor.
    const compare = async (x: string, y: string) => (x < y ? 'A' : 'B') as 'A' | 'B';
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4);
    // swissPairs emite [mejor-provisional, peor-provisional] = [i, j], y acá el orden
    // provisional (80/76/72/68) coincide con el alfabético ('a'<'b'<'c'<'d'), así que
    // gana siempre i.
    expect(duels.every((d) => d.winner === 0)).toBe(true);
  });

  it('consulta al comparador dos veces por par y dispara onDuel una sola vez', async () => {
    let calls = 0;
    const compare = async (x: string, y: string) => { calls++; return (x < y ? 'A' : 'B') as 'A' | 'B'; };
    const seen: number[] = [];
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4, (d) => { seen.push(d.seq); });
    expect(duels.length).toBe(5);
    expect(calls).toBe(10);   // 5 pares × 2 órdenes
    expect(seen.length).toBe(5);
  });
});

describe('runSwissComparisons onDuel', () => {
  it('fires onDuel once per resolved duel with seq and winner', async () => {
    const compare = async (a: string, b: string) => (a < b ? 'A' : 'B') as 'A' | 'B';
    const seen: number[] = [];
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4, (d) => { seen.push(d.seq); });
    expect(seen.sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4]);
    expect(seen.length).toBe(duels.length);
  });
});
