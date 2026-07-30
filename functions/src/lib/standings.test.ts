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

import { rankGame, type GamePlayerInput } from './standings';

const p = (uid: string, totalScore: number, answered = true): GamePlayerInput =>
  ({ uid, name: uid.toUpperCase(), totalScore, answered });

describe('rankGame', () => {
  it('ordena por puntaje descendente y asigna puntos', () => {
    const rows = rankGame([p('ana', 180), p('beto', 220), p('caro', 140)]);
    expect(rows).toEqual([
      { uid: 'beto', position: 1, points: 30 },
      { uid: 'ana', position: 2, points: 25 },
      { uid: 'caro', position: 3, points: 21 },
    ]);
  });

  it('empata con ranking de competencia: 1, 2, 2, 4', () => {
    const rows = rankGame([p('ana', 200), p('beto', 150), p('caro', 150), p('dani', 100)]);
    expect(rows.map((r) => [r.uid, r.position, r.points])).toEqual([
      ['ana', 1, 30],
      ['beto', 2, 25],
      ['caro', 2, 25],
      ['dani', 4, 18],
    ]);
  });

  it('deja fuera a quien no envio ninguna respuesta', () => {
    const rows = rankGame([p('ana', 200), p('fantasma', 0, false), p('beto', 100)]);
    expect(rows.map((r) => r.uid)).toEqual(['ana', 'beto']);
  });

  it('incluye a quien jugo y saco cero, con los puntos de piso si va ultimo', () => {
    const players = [p('ana', 200), ...Array.from({ length: 20 }, (_, i) => p(`x${i}`, 100 - i)), p('cero', 0)];
    const rows = rankGame(players);
    const last = rows[rows.length - 1];
    expect(last.uid).toBe('cero');
    expect(last.position).toBe(22);
    expect(last.points).toBe(POINTS_FLOOR);
  });

  it('desempata el orden de salida por uid, para que el resultado sea estable', () => {
    const rows = rankGame([p('zeta', 100), p('alfa', 100)]);
    expect(rows.map((r) => r.uid)).toEqual(['alfa', 'zeta']);
  });

  it('devuelve vacio si nadie jugo', () => {
    expect(rankGame([p('a', 0, false)])).toEqual([]);
  });
});
