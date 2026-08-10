import { describe, it, expect } from 'vitest';
import { filasDeJuegos } from './juegosJugados';
import type { CourseStandings } from '../types/standings';

const juego = (gameCode: string, sessionId: string, finishedAtMs: number, playedCount?: number) => ({
  gameCode, sessionId, sessionTitle: `Título de ${sessionId}`, finishedAtMs, playedCount,
});

const tabla = (parcial: Partial<CourseStandings>): CourseStandings => ({
  courseId: 'c', updatedAt: null as never, playerCount: 0, finalized: false,
  excludedGameCodes: [], gamesCounted: [], top: [], ...parcial,
});

describe('filasDeJuegos', () => {
  it('junta los oficiales y las pruebas, del mas nuevo al mas viejo', () => {
    const filas = filasDeJuegos(tabla({
      gamesCounted: [juego('AAA', 's1', 1000), juego('CCC', 's2', 3000)],
      gamesShadowed: [juego('BBB', 's2', 2000)],
    }));
    expect(filas.map((f) => f.gameCode)).toEqual(['CCC', 'BBB', 'AAA']);
  });

  it('marca cual cuenta para la tabla y cual no', () => {
    const filas = filasDeJuegos(tabla({
      gamesCounted: [juego('AAA', 's1', 2000)],
      gamesShadowed: [juego('BBB', 's1', 1000)],
    }));
    expect(filas.find((f) => f.gameCode === 'AAA')!.etiqueta).toBe('oficial');
    expect(filas.find((f) => f.gameCode === 'BBB')!.etiqueta).toBe('prueba');
  });

  it('incluye los excluidos a mano, aunque de ellos solo se sepa el codigo', () => {
    const filas = filasDeJuegos(tabla({
      gamesCounted: [juego('AAA', 's1', 2000)],
      excludedGameCodes: ['ZZZ'],
    }));
    const excluido = filas.find((f) => f.gameCode === 'ZZZ')!;
    expect(excluido.etiqueta).toBe('excluido');
    expect(excluido.sessionTitle).toBeNull();
    expect(excluido.finishedAtMs).toBeNull();
  });

  it('los excluidos van al final, porque no tienen fecha con que ordenarse', () => {
    const filas = filasDeJuegos(tabla({
      gamesCounted: [juego('AAA', 's1', 2000)],
      excludedGameCodes: ['ZZZ'],
    }));
    expect(filas.map((f) => f.gameCode)).toEqual(['AAA', 'ZZZ']);
  });

  it('un juego excluido no aparece ademas como oficial ni como prueba', () => {
    // `recomputeCourseStandings` ya filtra los excluidos antes de elegir, asi
    // que esto no deberia pasar; si pasara, la fila duplicada seria peor que
    // cualquier etiqueta equivocada.
    const filas = filasDeJuegos(tabla({
      gamesCounted: [juego('AAA', 's1', 2000)],
      gamesShadowed: [juego('ZZZ', 's1', 1000)],
      excludedGameCodes: ['ZZZ'],
    }));
    expect(filas.filter((f) => f.gameCode === 'ZZZ')).toHaveLength(1);
    expect(filas.find((f) => f.gameCode === 'ZZZ')!.etiqueta).toBe('excluido');
  });

  it('aguanta una tabla vieja sin gamesShadowed', () => {
    const filas = filasDeJuegos(tabla({ gamesCounted: [juego('AAA', 's1', 1000)] }));
    expect(filas).toHaveLength(1);
  });

  it('sin tabla del curso no hay filas', () => {
    expect(filasDeJuegos(null)).toEqual([]);
  });

  it('conserva cuantos jugaron cuando la tabla lo trae', () => {
    const filas = filasDeJuegos(tabla({ gamesCounted: [juego('AAA', 's1', 1000, 37)] }));
    expect(filas[0].playedCount).toBe(37);
  });
});
