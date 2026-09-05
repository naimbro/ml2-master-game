import { describe, it, expect } from 'vitest';
import type { Scenario } from './game';

// Este archivo es un chequeo de TIPOS, no de comportamiento: lo que se verifica
// es que `tsc` acepte las dos formas de `idealAnswer` que existen de verdad en
// `content/sessions/`. Las aserciones de abajo son sólo para que vitest tenga
// algo que correr.

describe('Scenario.idealAnswer', () => {
  it('acepta la respuesta ideal escrita como texto corrido', () => {
    // La forma que usan TODAS las sesiones escritas a mano y la que va a generar
    // el asistente.
    const escenario: Scenario = {
      id: 'r1',
      order: 1,
      title: 'Ronda 1',
      context: '',
      question: '',
      conceptTags: [],
      idealAnswer: 'La disciplinaria funciona prohibiendo, así que produce desviados.',
    };
    expect(typeof escenario.idealAnswer).toBe('string');
  });

  it('sigue aceptando la forma estructurada antigua', () => {
    const escenario: Scenario = {
      id: 'r2',
      order: 2,
      title: 'Ronda 2',
      context: '',
      question: '',
      conceptTags: [],
      idealAnswer: {
        keyPoints: ['punto'],
        expectedConcepts: ['concepto'],
        commonMistakes: ['error'],
      },
    };
    expect(typeof escenario.idealAnswer).toBe('object');
  });
});
