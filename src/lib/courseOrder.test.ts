import { describe, it, expect } from 'vitest';
import { applyCourseOrder, moveCourse, nudgeCourse } from './courseOrder';

const c = (id: string) => ({ id });
const ids = <T extends { id: string }>(list: T[]) => list.map((x) => x.id);

describe('applyCourseOrder', () => {
  it('sin orden guardado deja la lista como venia', () => {
    const list = [c('a'), c('b'), c('c')];
    expect(ids(applyCourseOrder(list, undefined))).toEqual(['a', 'b', 'c']);
    expect(ids(applyCourseOrder(list, []))).toEqual(['a', 'b', 'c']);
    expect(ids(applyCourseOrder(list, null))).toEqual(['a', 'b', 'c']);
  });

  it('no muta la lista que recibe', () => {
    const list = [c('a'), c('b')];
    applyCourseOrder(list, ['b', 'a']);
    expect(ids(list)).toEqual(['a', 'b']);
  });

  it('aplica el orden guardado', () => {
    const list = [c('a'), c('b'), c('c')];
    expect(ids(applyCourseOrder(list, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
  });

  it('manda al final los cursos que no estan en el orden, sin alterar su orden relativo', () => {
    // 'nuevo1' y 'nuevo2' son cursos creados despues de la ultima vez que se ordeno.
    const list = [c('nuevo1'), c('a'), c('nuevo2'), c('b')];
    expect(ids(applyCourseOrder(list, ['b', 'a']))).toEqual(['b', 'a', 'nuevo1', 'nuevo2']);
  });

  it('ignora ids guardados de cursos que ya no existen', () => {
    const list = [c('a'), c('b')];
    expect(ids(applyCourseOrder(list, ['borrado', 'b', 'otro-borrado', 'a']))).toEqual(['b', 'a']);
  });

  it('un id repetido en el documento no mueve el curso dos veces', () => {
    const list = [c('a'), c('b'), c('c')];
    expect(ids(applyCourseOrder(list, ['c', 'a', 'c', 'b']))).toEqual(['c', 'a', 'b']);
  });

  it('conserva el resto de los campos del curso', () => {
    const list = [{ id: 'a', name: 'Uno' }, { id: 'b', name: 'Dos' }];
    expect(applyCourseOrder(list, ['b', 'a'])[0]).toEqual({ id: 'b', name: 'Dos' });
  });
});

describe('moveCourse', () => {
  it('mueve hacia adelante corriendo el resto', () => {
    expect(moveCourse(['a', 'b', 'c', 'd'], 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
  });

  it('mueve hacia atras corriendo el resto', () => {
    expect(moveCourse(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('soltar sobre si mismo no cambia nada', () => {
    const list = ['a', 'b', 'c'];
    expect(moveCourse(list, 'b', 'b')).toBe(list);
  });

  it('un id desconocido no cambia nada', () => {
    const list = ['a', 'b'];
    expect(moveCourse(list, 'z', 'a')).toBe(list);
    expect(moveCourse(list, 'a', 'z')).toBe(list);
  });

  it('no muta la lista que recibe', () => {
    const list = ['a', 'b', 'c'];
    moveCourse(list, 'c', 'a');
    expect(list).toEqual(['a', 'b', 'c']);
  });
});

describe('nudgeCourse', () => {
  it('mueve un lugar hacia adelante', () => {
    expect(nudgeCourse(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
  });

  it('mueve un lugar hacia atras', () => {
    expect(nudgeCourse(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('en los extremos no hace nada', () => {
    const list = ['a', 'b', 'c'];
    expect(nudgeCourse(list, 'a', -1)).toBe(list);
    expect(nudgeCourse(list, 'c', 1)).toBe(list);
  });

  it('un id desconocido no cambia nada', () => {
    const list = ['a', 'b'];
    expect(nudgeCourse(list, 'z', 1)).toBe(list);
  });
});
