import { describe, expect, it } from 'vitest';
import { acierto, puntos, resumenMiAvatar, type RespuestaMisAvatares } from './miAvatar';

const ids = ['a', 'b', 'c', 'd'];
const mios = { a: 1, b: 2, c: 4, d: 5 };

describe('acierto', () => {
  it('cuenta exactos, a un punto o menos, error medio y correlación de perfil', () => {
    const r = acierto(mios, { a: 1, b: 3, c: 4, d: 2 }, ids);
    expect(r).toMatchObject({ n: 4, exactos: 2, cerca: 3 });
    expect(r.error).toBeCloseTo(1); // (0 + 1 + 0 + 3) / 4
    expect(r.r).not.toBeNull();
  });
  it('un avatar idéntico tiene error 0 y correlación 1', () => {
    const r = acierto(mios, mios, ids);
    expect(r).toMatchObject({ n: 4, exactos: 4, cerca: 4, error: 0 });
    expect(r.r).toBeCloseTo(1);
  });
  it('solo compara lo que el avatar votó', () => {
    expect(acierto(mios, { a: 1, b: 2 }, ids)).toMatchObject({ n: 2, exactos: 2, r: null });
  });
  it('sin nada que comparar: error null, nunca 0', () => {
    expect(acierto(mios, {}, ids)).toMatchObject({ n: 0, error: null, r: null });
  });
  it('un avatar que vota todo igual no tiene correlación (no varía)', () => {
    expect(acierto(mios, { a: 3, b: 3, c: 3, d: 3 }, ids).r).toBeNull();
  });
  it('el promedio del curso (no entero) cuenta como exacto si redondea a tu voto', () => {
    expect(acierto({ a: 4 }, { a: 3.6 }, ['a'])).toMatchObject({ exactos: 1, cerca: 1 });
    expect(acierto({ a: 4 }, { a: 2.8 }, ['a'])).toMatchObject({ exactos: 0, cerca: 0 });
  });
});

describe('resumenMiAvatar', () => {
  const resp: RespuestaMisAvatares = {
    votos: mios,
    avatares: [
      { modelo: 'lejano', votos: { a: 5, b: 5, c: 1, d: 1 }, faltantes: [] },
      { modelo: 'vacio', votos: {}, faltantes: ids },
      { modelo: 'cercano', votos: { a: 1, b: 2, c: 4, d: 4 }, faltantes: [] },
    ],
    curso: { a: 3, b: 3, c: 3, d: 3 },
    nCurso: 7,
    minCurso: 5,
  };
  it('ordena del que más se acerca al que menos, y deja al final al que no votó', () => {
    expect(resumenMiAvatar(resp, ids).modelos.map((m) => m.modelo)).toEqual(['cercano', 'lejano', 'vacio']);
  });
  it('trae la vara del curso cuando existe', () => {
    expect(resumenMiAvatar(resp, ids).curso?.error).toBeCloseTo(1.5);
    expect(resumenMiAvatar({ ...resp, curso: null }, ids).curso).toBeNull();
  });
});

it('puntos usa coma decimal', () => expect(puntos(0.833)).toBe('0,8'));
