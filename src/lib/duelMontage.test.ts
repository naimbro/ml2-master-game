import { describe, it, expect } from 'vitest';
import {
  BOARD_MS,
  CLIMAX_MS,
  MONTAGE_BUDGET_MS,
  duelDurationMs,
  planMontage,
  selectMontageDuels,
} from './duelMontage';
import type { RoundDuel } from '../types/game';

function duel(seq: number, opts: Partial<RoundDuel> & { gap?: number } = {}): RoundDuel {
  const gap = opts.gap ?? 10;
  return {
    seq,
    a: { name: `A${seq}`, provRank: seq + 1, provScore: 80 },
    b: { name: `B${seq}`, provRank: seq + 2, provScore: 80 - gap },
    winner: opts.winner ?? 'a',
    isUpset: opts.isUpset ?? false,
    ...(opts.isClimax !== undefined ? { isClimax: opts.isClimax } : {}),
  };
}

const range = (n: number, f: (i: number) => RoundDuel) => Array.from({ length: n }, (_, i) => f(i));

describe('planMontage', () => {
  it('reparte los 118 duelos de una clase de 33 en ventanas que caben en 30 s', () => {
    // 118 = 4n - 10 con n = 33, los duelos reales del juego MTF4MX.
    const plan = planMontage(118);
    expect(plan.stride).toBe(9);
    expect(plan.windows).toBe(14);

    // Con la cuota de un tercio: 5 sorpresas y 9 duelos normales.
    const montage = 5 * duelDurationMs({ isUpset: true }) + 9 * duelDurationMs({ isUpset: false });
    expect(montage + CLIMAX_MS + BOARD_MS).toBeLessThanOrEqual(MONTAGE_BUDGET_MS);
  });

  it('dura mas o menos lo mismo con 20 alumnos que con 80', () => {
    // 4n - 10 duelos. Lo que cambia es el stride, no el largo del montaje.
    const chico = planMontage(4 * 20 - 10);
    const grande = planMontage(4 * 80 - 10);
    expect(Math.abs(chico.windows - grande.windows)).toBeLessThanOrEqual(2);
    expect(grande.stride).toBeGreaterThan(chico.stride);
  });

  it('con pocos duelos los muestra todos', () => {
    const plan = planMontage(9);
    expect(plan.stride).toBe(1);
    expect(plan.windows).toBe(9);
  });

  it('no divide por cero sin duelos', () => {
    expect(planMontage(0)).toEqual({ slots: 0, stride: 1, windows: 0 });
  });

  it('un presupuesto ridiculo igual muestra un minimo de tarjetas', () => {
    const plan = planMontage(100, 1_000);
    expect(plan.windows).toBeGreaterThanOrEqual(6);
  });
});

describe('selectMontageDuels', () => {
  const plan = planMontage(118); // stride 9, 14 ventanas
  const W = plan.stride;

  it('entrega una tarjeta por ventana completa y espera las que faltan', () => {
    const out = selectMontageDuels(range(W, (i) => duel(i)), 118, plan);
    expect(out).toHaveLength(1);
    expect(out[0].seq).toBeLessThan(W);

    expect(selectMontageDuels(range(W - 1, (i) => duel(i)), 118, plan)).toHaveLength(0);
  });

  it('no se salta ventanas cuando los duelos llegan con huecos', () => {
    // Los duelos se resuelven con 10 comparaciones en vuelo: el seq 7 puede
    // llegar despues del 9. Cortar por `duels.length` mostraria el duelo
    // equivocado.
    const conHueco = range(W + 2, (i) => duel(i)).filter((d) => d.seq !== 7);
    expect(selectMontageDuels(conHueco, 118, plan)).toHaveLength(0);
    expect(selectMontageDuels([...conHueco, duel(7)], 118, plan)).toHaveLength(1);
  });

  it('la eleccion de cada ventana no cambia cuando llegan mas duelos', () => {
    const build = (n: number) => range(n, (i) => duel(i, { gap: (i % W) + 1 }));
    const primera = selectMontageDuels(build(W), 118, plan);
    const despues = selectMontageDuels(build(W * 3), 118, plan);
    expect(despues[0]).toEqual(primera[0]);
    expect(despues).toHaveLength(3);
  });

  it('prefiere la sorpresa de la ventana', () => {
    const window = range(W, (i) => duel(i, { gap: 1, isUpset: i === 4 }));
    expect(selectMontageDuels(window, 118, plan)[0].seq).toBe(4);
  });

  it('sin sorpresa, prefiere el duelo mas parejo', () => {
    const window = range(W, (i) => duel(i, { gap: i === 5 ? 0 : 20 }));
    expect(selectMontageDuels(window, 118, plan)[0].seq).toBe(5);
  });

  it('desempata por seq, para que no dependa del orden de llegada', () => {
    const window = range(W, (i) => duel(i, { gap: 4 }));
    expect(selectMontageDuels(window, 118, plan)[0].seq).toBe(0);
    expect(selectMontageDuels([...window].reverse(), 118, plan)[0].seq).toBe(0);
  });

  it('recorre la tabla entera, no solo los primeros duelos', () => {
    const out = selectMontageDuels(range(118, (i) => duel(i)), 118, plan);
    expect(out).toHaveLength(plan.windows);
    // La ultima tarjeta sale de la ultima ventana: el montaje llega al fondo.
    expect(out[out.length - 1].seq).toBeGreaterThanOrEqual((plan.windows - 1) * W);
    expect(out.map((d) => d.seq)).toEqual([...out.map((d) => d.seq)].sort((x, y) => x - y));
  });

  it('respeta la cuota de sorpresas aunque TODOS los duelos lo sean', () => {
    // Sin cuota, con los duelos reales de MTF4MX salian 13 sorpresas de 15 y el
    // montaje se iba a 38 s. La cuota es lo que lo devuelve al presupuesto.
    const out = selectMontageDuels(range(118, (i) => duel(i, { isUpset: true })), 118, plan);
    const upsets = out.filter((d) => d.isUpset).length;
    expect(upsets).toBe(out.length); // no hay otra cosa que mostrar
    // ...pero cuando SI hay alternativa, la cuota manda. Una sorpresa por
    // ventana disponible y aun asi salen 6 de 14, no 14 de 14: 5 por cuota mas
    // la ultima ventana, que contiene un solo duelo y resulta ser sorpresa (la
    // cuota es blanda a proposito, para no dejar huecos en el recorrido).
    const mixto = selectMontageDuels(
      range(118, (i) => duel(i, { isUpset: i % W === 0 })), 118, plan,
    );
    expect(mixto).toHaveLength(plan.windows);
    expect(mixto.filter((d) => d.isUpset).length).toBe(6);
  });

  it('el montaje cabe en el presupuesto con una ronda realista', () => {
    // 21 % de sorpresas, la tasa medida en MTF4MX.
    const out = selectMontageDuels(range(118, (i) => duel(i, { isUpset: i % 5 === 0 })), 118, plan);
    const ms = out.reduce((acc, d) => acc + duelDurationMs(d), 0);
    expect(ms + CLIMAX_MS + BOARD_MS).toBeLessThanOrEqual(MONTAGE_BUDGET_MS);
  });

  it('la ultima ventana puede quedar corta y se muestra igual', () => {
    const p = planMontage(20);
    const out = selectMontageDuels(range(20, (i) => duel(i)), 20, p);
    expect(out).toHaveLength(p.windows);
  });

  it('con el torneo terminado tolera un duelo que nunca se escribio', () => {
    // El onDuel esta envuelto en try/catch: una escritura perdida no aborta el
    // torneo, pero dejaria el montaje esperando esa ventana para siempre.
    const faltaEl3 = range(118, (i) => duel(i)).filter((d) => d.seq !== 3);
    expect(selectMontageDuels(faltaEl3, 118, plan)).toHaveLength(0);
    expect(selectMontageDuels(faltaEl3, 118, plan, true)).toHaveLength(plan.windows);
  });

  it('no explota si duelTotal todavia no llego', () => {
    const out = selectMontageDuels(range(8, (i) => duel(i)), 0, planMontage(8));
    expect(out).toHaveLength(8);
  });
});

describe('duelDurationMs', () => {
  it('una sorpresa dura mas que un duelo normal, y los dos se alcanzan a leer', () => {
    expect(duelDurationMs({ isUpset: false })).toBeGreaterThanOrEqual(1_200);
    expect(duelDurationMs({ isUpset: true })).toBeGreaterThan(duelDurationMs({ isUpset: false }));
  });
});
