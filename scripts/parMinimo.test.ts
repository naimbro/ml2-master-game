import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { esParMinimo, MC_PAR_MINIMO_MIN_SECONDS } = require('./validate-content.cjs') as {
  esParMinimo: (a: string, b: string) => boolean;
  MC_PAR_MINIMO_MIN_SECONDS: number;
};

/**
 * El detector de pares minimos que `validate-content.cjs` usa para fallar el
 * build. Es una heuristica sobre texto en castellano, o sea que se rompe en
 * silencio: si deja de cazar el caso de XNTUHB, el validador sigue diciendo que
 * todo esta bien y la proxima pregunta imposible pasa igual.
 */
describe('esParMinimo', () => {
  it('caza el par minimo real que rompio dataviz clase 2', () => {
    // 25 s para distinguir estas dos: 89% del reloj usado, 43% de acierto.
    expect(esParMinimo(
      'Cuántas personas respondieron, y cuántas preguntas tenía el formulario',
      'Cuántas preguntas tenía el formulario, y cuántas personas respondieron',
    )).toBe(true);
  });

  it('caza el par de una sola palabra cambiada', () => {
    // No son las mismas palabras exactas, asi que la igualdad de multiconjunto
    // no alcanza: entra por el umbral de vocabulario compartido.
    expect(esParMinimo(
      'En la sección 2 el Metro se usa mucho más que en la sección 1',
      'En la sección 2 el Metro se usa mucho menos que en la sección 1',
    )).toBe(true);
  });

  it('ignora tildes, mayusculas y puntuacion', () => {
    expect(esParMinimo('Cuántas filas, y cuántas columnas.', '¿CUANTAS COLUMNAS Y CUANTAS FILAS?')).toBe(true);
  });

  it('no marca alternativas normales que hablan del mismo tema', () => {
    // Las dos reales de la ronda 7 de XNTUHB: comparten "porque", "las",
    // "comillas", "R"... y no son un par minimo.
    expect(esParMinimo(
      'Porque los números van pelados y el texto siempre va entre comillas',
      'Porque las comillas marcan lo que R tiene que mostrar en pantalla',
    )).toBe(false);
  });

  it('no marca alternativas cortas', () => {
    // "Si, tiene razon" / "No, no tiene razon" comparten casi todo el
    // vocabulario y no cuestan nada de leer. Bajo 5 palabras no se evalua.
    expect(esParMinimo('Sí, tiene razón', 'No, no tiene razón')).toBe(false);
  });

  it('no marca dos alternativas identicas', () => {
    // Duplicar una alternativa es un error distinto; marcarlo como par minimo
    // mandaria a subir el reloj en vez de a arreglar la pregunta.
    const t = 'Cuántas personas respondieron el formulario completo';
    expect(esParMinimo(t, t)).toBe(false);
  });

  it('el minimo de reloj es el que dice el skill', () => {
    expect(MC_PAR_MINIMO_MIN_SECONDS).toBe(40);
  });
});
