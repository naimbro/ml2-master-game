import { describe, it, expect } from 'vitest';
import { easeOutCubic, countUpValue } from './countUp';

describe('easeOutCubic', () => {
  it('anchors both ends', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('front-loads the movement', () => {
    // a los 25% del tiempo ya recorrio mas de la mitad del camino
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.5);
  });
});

describe('countUpValue', () => {
  it('starts at `from`', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 0, durationMs: 760 })).toBe(10);
  });

  it('lands exactly on `to` when the time is up', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 760, durationMs: 760 })).toBe(90);
  });

  it('never overshoots past the end', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 5000, durationMs: 760 })).toBe(90);
  });

  it('counts down as happily as it counts up', () => {
    expect(countUpValue({ from: 90, to: 10, elapsedMs: 760, durationMs: 760 })).toBe(10);
  });

  it('rounds to whole numbers by default', () => {
    expect(Number.isInteger(countUpValue({ from: 0, to: 100, elapsedMs: 300, durationMs: 760 }))).toBe(true);
  });

  it('keeps one decimal for averages when asked', () => {
    // el promedio del ranking se muestra con un decimal
    const v = countUpValue({ from: 0, to: 82.7, elapsedMs: 760, durationMs: 760, decimals: 1 });
    expect(v).toBe(82.7);
  });

  it('treats a zero-length run as already finished', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 0, durationMs: 0 })).toBe(90);
  });
});
