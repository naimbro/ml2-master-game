// src/lib/abiertaTiming.test.ts
import { describe, it, expect } from 'vitest';
import { palabrasDelEnunciado, costoDeLectura } from './abiertaTiming';

describe('palabrasDelEnunciado', () => {
  it('suma context y question, que es como viaja un escenario', () => {
    expect(palabrasDelEnunciado({
      context: 'Tenés una tabla de ventas por región.',
      question: '¿Qué línea agrega la columna?',
    })).toBe(12);
  });

  it('usa prompt cuando el escenario viene del generador y no trae context', () => {
    expect(palabrasDelEnunciado({ prompt: 'una dos tres' })).toBe(3);
  });

  it('un escenario vacío no rompe', () => {
    expect(palabrasDelEnunciado({})).toBe(0);
  });
});

describe('costoDeLectura', () => {
  // La recta sale de 35 rondas con telemetría: 13 s + 0,32 s por palabra.
  it('cobra 13 s de piso más un tercio de segundo por palabra en prosa', () => {
    expect(costoDeLectura(100, 'prose')).toBe(45);
  });

  it('cobra menos por palabra cuando la respuesta es código', () => {
    // Un bloque de código cuenta muchas "palabras" pero se escanea.
    expect(costoDeLectura(100, 'code')).toBe(38);
  });

  it('reproduce la R4 de 9XR4Z6, que costó 54 s medidos', () => {
    // 179 palabras, answerFormat code -> 13 + 0,25*179 = 57,75 -> 58
    expect(costoDeLectura(179, 'code')).toBe(58);
  });

  it('un enunciado vacío sigue costando el piso', () => {
    expect(costoDeLectura(0, 'prose')).toBe(13);
  });
});
