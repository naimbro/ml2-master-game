// El reloj de una ronda ABIERTA. Gemelo de mcTiming.ts, y por la misma razón:
// escrito a ojo, el reloj de una abierta se equivoca en una dirección sola.
//
// Dataviz clase 7 (9XR4Z6, 21-sep-2026) sacó 4,50/7 — la nota más baja del año —
// y los quince comentarios hablaban de tiempo. Medidas las 36 rondas abiertas
// con telemetría del repo, la mediana del curso tarda en escribir su primer
// carácter lo que el enunciado mide:
//
//   corr(palabras del enunciado, segundos hasta la 1ª tecla) = 0,91
//   lectura ≈ 13 s + 0,32 s × palabra      (n = 35, RMSE 12 s)
//
// La R4 de ese juego tenía 179 palabras: 54 segundos leyendo, de un reloj de
// 120. Quedaban 66 para escribir un group_by + summarise completo.
//
// Ver docs/superpowers/specs/2026-09-21-diagnostico-de-clase-design.md

/** Cómo se escribe la respuesta. Espejo de `Scenario.answerFormat`. */
export type FormatoDeRespuesta = 'prose' | 'code';

/**
 * El piso de la recta: abrir la pantalla, ubicarse, leer el título. No baja de
 * acá ni con un enunciado de tres palabras.
 */
export const LECTURA_PISO_SEGUNDOS = 13;

/**
 * Segundos por palabra. El código se lee más rápido a igual número de palabras
 * porque un bloque de código se escanea en vez de leerse: `group_by(anio)`
 * cuenta como palabra y cuesta una mirada.
 */
export const LECTURA_SEGUNDOS_POR_PALABRA: Record<FormatoDeRespuesta, number> = {
  prose: 0.32,
  code: 0.25,
};

/** Los campos de un escenario que el alumno tiene que leer antes de responder. */
export interface EnunciadoLike {
  context?: string;
  question?: string;
  /** Los escenarios que genera el asistente traen todo el caso acá. */
  prompt?: string;
}

export function palabrasDelEnunciado(sc: EnunciadoLike): number {
  const texto = [sc.context, sc.question, sc.prompt].filter(Boolean).join(' ');
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function costoDeLectura(palabras: number, formato: FormatoDeRespuesta): number {
  return Math.round(LECTURA_PISO_SEGUNDOS + LECTURA_SEGUNDOS_POR_PALABRA[formato] * palabras);
}
