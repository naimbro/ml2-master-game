import { describe, it, expect } from 'vitest';
import { pointsForPosition, POINTS_TABLE, POINTS_FLOOR } from './standings';

describe('pointsForPosition', () => {
  it('reparte la tabla fija en las diez primeras posiciones', () => {
    expect(POINTS_TABLE).toEqual([30, 25, 21, 18, 16, 15, 14, 13, 12, 11]);
    expect(pointsForPosition(1)).toBe(30);
    expect(pointsForPosition(2)).toBe(25);
    expect(pointsForPosition(10)).toBe(11);
  });

  it('baja de uno en uno despues de la decima', () => {
    expect(pointsForPosition(11)).toBe(10);
    expect(pointsForPosition(12)).toBe(9);
    expect(pointsForPosition(17)).toBe(4);
  });

  it('nunca baja del piso de 3 para quien jugo', () => {
    expect(POINTS_FLOOR).toBe(3);
    expect(pointsForPosition(18)).toBe(3);
    expect(pointsForPosition(26)).toBe(3);
    expect(pointsForPosition(200)).toBe(3);
  });

  it('rechaza posiciones invalidas', () => {
    expect(() => pointsForPosition(0)).toThrow();
    expect(() => pointsForPosition(-1)).toThrow();
    expect(() => pointsForPosition(1.5)).toThrow();
  });
});
