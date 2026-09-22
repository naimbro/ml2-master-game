import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { relojDerivadoAbierta } from '../src/lib/abiertaTiming';

const require = createRequire(import.meta.url);
const { relojDerivadoAbiertaCJS } = require('./validate-content.cjs') as {
  relojDerivadoAbiertaCJS: (sc: unknown) => number;
};

/**
 * El validador es CommonJS y no puede importar src/lib/abiertaTiming.ts, asi que
 * el calculo esta escrito dos veces. Este test es lo unico que impide que se
 * separen: si alguien ajusta la recta en un lado, aca se cae. Sin esto la
 * divergencia es SILENCIOSA — el build seguiria verde midiendo otra cosa.
 */
describe('el espejo del reloj en validate-content.cjs', () => {
  const casos = [
    { context: 'x '.repeat(179).trim(), answerFormat: 'code', difficulty: 'hard' },
    { context: 'x '.repeat(83).trim(), answerFormat: 'code', difficulty: 'medium' },
    { context: 'x '.repeat(236).trim(), difficulty: 'hard' },
    { question: 'x '.repeat(10).trim(), difficulty: 'easy' },
    { prompt: 'x '.repeat(120).trim(), answerFormat: 'prose', difficulty: 'medium' },
    { context: 'x '.repeat(50).trim(), answerFormat: 'CODIGO', difficulty: 'dificil' },
    { context: 'hola', question: 'y chau' },
    {},
  ];

  for (const [i, caso] of casos.entries()) {
    it(`da el mismo numero que src/lib/abiertaTiming.ts (caso ${i})`, () => {
      expect(relojDerivadoAbiertaCJS(caso)).toBe(relojDerivadoAbierta(caso as never));
    });
  }
});
