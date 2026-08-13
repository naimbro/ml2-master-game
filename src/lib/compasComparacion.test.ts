import { describe, it, expect } from 'vitest';
import {
  emparejar,
  centroide,
  resumenComparacion,
  repartoArquetipos,
  cambiaronDeArquetipo,
  type PosicionGuardada,
} from './compasComparacion';
import type { Arquetipo } from '../types/compas';

function pos(
  playerId: string,
  magnitud: number,
  direccion: number,
  arquetipoId: string | null = null,
): PosicionGuardada {
  return { playerId, magnitud, direccion, respondidas: 10, total: 10, arquetipoId };
}

describe('emparejar', () => {
  it('solo compara a quien estuvo en las dos aplicaciones', () => {
    const antes = [pos('a', 0, 0), pos('b', 1, 1), pos('c', 2, 2)];
    const despues = [pos('a', 3, 4), pos('b', 1, 1), pos('d', 9, 9)];
    const r = emparejar(antes, despues);
    expect(r.pares.map((p) => p.playerId)).toEqual(['a', 'b']);
    expect(r.soloAntes).toBe(1); // c falto a la segunda
    expect(r.soloDespues).toBe(1); // d no estuvo en la primera
  });

  it('cuenta a los que faltan en vez de esconderlos', () => {
    // El sesgo que este conteo existe para hacer visible: si los cuatro que se
    // fueron eran los mas pesimistas, el curso "se mueve" hacia arriba sin que
    // nadie haya cambiado de opinion.
    const antes = [pos('a', 0, -9), pos('b', 0, -8), pos('c', 0, 5)];
    const despues = [pos('c', 0, 5)];
    const r = emparejar(antes, despues);
    expect(r.pares).toHaveLength(1);
    expect(r.soloAntes).toBe(2);
  });

  it('calcula el movimiento de cada par', () => {
    const r = emparejar([pos('a', 0, 0)], [pos('a', 3, 4)]);
    expect(r.pares[0].mov).toEqual({ dMagnitud: 3, dDireccion: 4, distancia: 5 });
  });

  it('sobrevive a listas vacias', () => {
    expect(emparejar([], [])).toEqual({ pares: [], soloAntes: 0, soloDespues: 0 });
  });
});

describe('centroide', () => {
  it('promedia las dos coordenadas', () => {
    expect(centroide([{ magnitud: 0, direccion: 0 }, { magnitud: 4, direccion: 8 }])).toEqual({
      magnitud: 2,
      direccion: 4,
    });
  });

  it('es null con el conjunto vacio', () => {
    expect(centroide([])).toBeNull();
  });

  it('descarta coordenadas no finitas', () => {
    expect(centroide([{ magnitud: 2, direccion: 2 }, { magnitud: NaN, direccion: 0 }])).toEqual({
      magnitud: 2,
      direccion: 2,
    });
  });
});

describe('resumenComparacion', () => {
  const pares = emparejar(
    [pos('a', 0, 0), pos('b', 0, 0), pos('c', 0, 0)],
    [pos('a', 4, 0), pos('b', 0, 0), pos('c', 0, 0.5)],
  ).pares;

  it('mide el desplazamiento del centro de masa', () => {
    const r = resumenComparacion(pares);
    expect(r.n).toBe(3);
    expect(r.centroideAntes).toEqual({ magnitud: 0, direccion: 0 });
    expect(r.desplazamientoMedio!.dMagnitud).toBeCloseTo(4 / 3);
  });

  it('no cuenta como movimiento un cambio menor al umbral', () => {
    // 'c' se movio 0,5 en una escala de 20: eso es contestar un item distinto
    // de diez, no cambiar de opinion.
    const r = resumenComparacion(pares);
    expect(r.seMovieron).toBe(1);
    expect(r.sinCambio).toBe(2);
  });

  it('el umbral se puede ajustar', () => {
    expect(resumenComparacion(pares, 0.1).seMovieron).toBe(2);
    expect(resumenComparacion(pares, 10).seMovieron).toBe(0);
  });

  it('sin pares no inventa un desplazamiento', () => {
    const r = resumenComparacion([]);
    expect(r.n).toBe(0);
    expect(r.desplazamientoMedio).toBeNull();
  });
});

const arquetipos = [
  { id: 'x', name: 'X' },
  { id: 'y', name: 'Y' },
] as Arquetipo[];

describe('repartoArquetipos', () => {
  it('las dos columnas suman siempre lo mismo', () => {
    const pares = emparejar(
      [pos('a', 0, 0, 'x'), pos('b', 0, 0, 'x'), pos('c', 0, 0, 'y')],
      [pos('a', 0, 0, 'y'), pos('b', 0, 0, 'x'), pos('c', 0, 0, 'y')],
    ).pares;
    const filas = repartoArquetipos(pares, arquetipos);
    const sumaAntes = filas.reduce((s, f) => s + f.antes, 0);
    const sumaDespues = filas.reduce((s, f) => s + f.despues, 0);
    expect(sumaAntes).toBe(3);
    expect(sumaDespues).toBe(3);
    expect(filas.find((f) => f.id === 'x')).toEqual({ id: 'x', name: 'X', antes: 2, despues: 1 });
  });

  it('lista todos los arquetipos, tambien los que quedaron vacios', () => {
    const filas = repartoArquetipos([], arquetipos);
    expect(filas.map((f) => f.id)).toEqual(['x', 'y']);
    expect(filas.every((f) => f.antes === 0 && f.despues === 0)).toBe(true);
  });
});

describe('cambiaronDeArquetipo', () => {
  it('devuelve solo a los que terminaron en otra parte', () => {
    const pares = emparejar(
      [pos('a', 0, 0, 'x'), pos('b', 0, 0, 'x'), pos('c', 0, 0, null)],
      [pos('a', 0, 0, 'y'), pos('b', 0, 0, 'x'), pos('c', 0, 0, 'y')],
    ).pares;
    expect(cambiaronDeArquetipo(pares).map((p) => p.playerId)).toEqual(['a']);
  });
});
