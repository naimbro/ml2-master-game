import { describe, it, expect } from 'vitest';
import {
  RACHA_THRESHOLD,
  EMPTY_RACHA,
  applyRound,
  rachaStorageKey,
  readRacha,
  writeRacha,
  type RachaState,
} from './racha';

function fakeStore(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    data,
  };
}

describe('applyRound', () => {
  it('empieza la racha con una ronda buena', () => {
    expect(applyRound(EMPTY_RACHA, 1, RACHA_THRESHOLD)).toEqual({ count: 1, best: 1, lastRound: 1 });
  });

  it('no cuenta una ronda bajo el umbral', () => {
    expect(applyRound(EMPTY_RACHA, 1, RACHA_THRESHOLD - 1)).toEqual({ count: 0, best: 0, lastRound: 1 });
  });

  it('acumula rondas buenas consecutivas', () => {
    const a = applyRound(EMPTY_RACHA, 1, 80);
    const b = applyRound(a, 2, 75);
    expect(b).toEqual({ count: 2, best: 2, lastRound: 2 });
  });

  it('corta la racha con una ronda mala pero recuerda la mejor', () => {
    const a = applyRound(EMPTY_RACHA, 1, 80);
    const b = applyRound(a, 2, 90);
    const c = applyRound(b, 3, 40);
    expect(c).toEqual({ count: 0, best: 2, lastRound: 3 });
  });

  it('es idempotente: la misma ronda dos veces no cuenta dos veces', () => {
    // Results.tsx re-renderiza con cada update de Firestore; sin esto la racha se dispara.
    const a = applyRound(EMPTY_RACHA, 1, 80);
    expect(applyRound(a, 1, 80)).toEqual(a);
  });

  it('ignora una ronda anterior que llegue fuera de orden', () => {
    const a = applyRound(EMPTY_RACHA, 3, 80);
    expect(applyRound(a, 2, 80)).toEqual(a);
  });
});

describe('rachaStorageKey', () => {
  it('separa por juego y por jugador', () => {
    expect(rachaStorageKey('4R7K', 'uid-1')).toBe('racha:4R7K:uid-1');
    expect(rachaStorageKey('4R7K', 'uid-1')).not.toBe(rachaStorageKey('4R7K', 'uid-2'));
  });
});

describe('readRacha / writeRacha', () => {
  it('devuelve la racha vacia cuando no hay nada guardado', () => {
    expect(readRacha(fakeStore(), 'racha:X:y')).toEqual(EMPTY_RACHA);
  });

  it('devuelve la racha vacia cuando lo guardado es basura', () => {
    expect(readRacha(fakeStore({ 'racha:X:y': 'no-json' }), 'racha:X:y')).toEqual(EMPTY_RACHA);
  });

  it('devuelve la racha vacia cuando el JSON no tiene la forma esperada', () => {
    expect(readRacha(fakeStore({ 'racha:X:y': '{"count":"dos"}' }), 'racha:X:y')).toEqual(EMPTY_RACHA);
  });

  it('sobrevive una ida y vuelta', () => {
    const store = fakeStore();
    const state: RachaState = { count: 3, best: 4, lastRound: 5 };
    writeRacha(store, 'racha:X:y', state);
    expect(readRacha(store, 'racha:X:y')).toEqual(state);
  });

  it('no explota si el navegador niega el almacenamiento', () => {
    const hostile = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    expect(readRacha(hostile, 'k')).toEqual(EMPTY_RACHA);
    expect(() => writeRacha(hostile, 'k', EMPTY_RACHA)).not.toThrow();
  });
});
