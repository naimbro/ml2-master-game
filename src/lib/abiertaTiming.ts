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
// El módulo devuelve el reloj COMPLETO de la ronda —lectura + escritura—,
// servido en escalones de 15 s (nunca hacia abajo: ver RELOJ_ESCALON_SEGUNDOS).
// `difficulty` cambió de significado: ya no dice qué tan difícil es el
// concepto, dice cuánto se tarda en TECLEAR la respuesta. `scripts/
// validate-content.cjs` espeja este cálculo número por número y falla el
// build si el `durationSeconds` de una ronda abierta queda corto.
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
  /**
   * Alternativa a `context`, no un campo extra: la pantalla del alumno
   * (`Round.tsx`) muestra `context ?? prompt`, nunca los dos a la vez. Los
   * escenarios que genera el asistente traen todo el caso acá, sin `context`.
   */
  prompt?: string;
}

export function palabrasDelEnunciado(sc: EnunciadoLike): number {
  // context y prompt son alternativas, no se cobran los dos: la pantalla del
  // alumno renderiza `context ?? prompt`, nunca ambos.
  const texto = [sc.context ?? sc.prompt, sc.question].filter(Boolean).join(' ');
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** Espera `formato` ya normalizado (ver `formatoDe`), no el valor crudo del JSON. */
export function costoDeLectura(palabras: number, formato: FormatoDeRespuesta): number {
  return Math.round(LECTURA_PISO_SEGUNDOS + LECTURA_SEGUNDOS_POR_PALABRA[formato] * palabras);
}

/**
 * Espejo de `Scenario.difficulty`. Desde 2026-09-21 la etiqueta NO significa
 * "qué tan difícil es el concepto": significa CUÁNTO SE TARDA EN TECLEAR LA
 * RESPUESTA, que es lo único de la dificultad que consume reloj. Una pregunta
 * conceptualmente durísima de respuesta corta necesita poco tiempo.
 */
export type Dificultad = 'easy' | 'medium' | 'hard';

/**
 * Segundos de tecleo, por formato y etiqueta.
 *
 * Los de código están MEDIDOS en 9XR4Z6: 72 s de escritura mediana para una
 * línea (9% seguía escribiendo al final), ~120 s para una cadena de dos o tres
 * pasos (14-33% colgando).
 *
 * Los de prosa son una DECISIÓN y no una medición, y conviene no olvidarlo:
 * toda ronda de prosa del repo está censurada por el reloj —entre el 76% y el
 * 100% del curso sigue escribiendo cuando suena la chicharra, en los cinco
 * cursos—, así que nunca observamos cuánto habrían escrito. La pregunta que lo
 * resolvería es a partir de qué largo de respuesta el puntaje deja de subir, y
 * la puede contestar `scripts/diagnostico.ts` cuando haya datos.
 */
export const ESCRITURA_SEGUNDOS: Record<FormatoDeRespuesta, Record<Dificultad, number>> = {
  code: { easy: 45, medium: 70, hard: 120 },
  prose: { easy: 90, medium: 150, hard: 210 },
};

/** Lo que asume el cálculo cuando el escenario no eligió. */
export const DIFICULTAD_POR_DEFECTO: Dificultad = 'medium';
export const FORMATO_POR_DEFECTO: FormatoDeRespuesta = 'prose';

/**
 * Los dos normalizadores existen porque `answerFormat` y `difficulty` llegan de
 * archivos JSON de contenido, que TypeScript no verifica en runtime. Sin ellos,
 * un `answerFormat: "Code"` indexa el Record con una clave que no está, el
 * reloj sale NaN, y el validador falla con un mensaje incomprensible en vez de
 * decir cuántos segundos faltan.
 *
 * `formatoDe` tiene que normalizar IGUAL que el espejo de validate-content.cjs
 * (`sc.answerFormat === 'code' ? 'code' : 'prose'`): hay un test que compara
 * las dos implementaciones número por número.
 */
export function formatoDe(sc: { answerFormat?: string }): FormatoDeRespuesta {
  return sc.answerFormat === 'code' ? 'code' : FORMATO_POR_DEFECTO;
}

export function dificultadDe(difficulty: string | undefined): Dificultad {
  return difficulty === 'easy' || difficulty === 'hard' ? difficulty : DIFICULTAD_POR_DEFECTO;
}

/**
 * Espera `formato` y `dificultad` ya normalizados (ver `formatoDe` /
 * `dificultadDe`), no el valor crudo del JSON: un valor no normalizado indexa
 * el Record con una clave que no existe y tira TypeError, en vez de caer al
 * default como hacen los normalizadores.
 */
export function costoDeEscritura(
  formato: FormatoDeRespuesta,
  dificultad: Dificultad | undefined,
): number {
  return ESCRITURA_SEGUNDOS[formato][dificultadDe(dificultad)];
}

/** El reloj se sirve en múltiplos de esto: un 178 en pantalla no dice nada. */
export const RELOJ_ESCALON_SEGUNDOS = 15;

export interface EscenarioAbiertoLike extends EnunciadoLike {
  answerFormat?: FormatoDeRespuesta;
  difficulty?: Dificultad;
}

/**
 * El piso del reloj de una ronda abierta. `validate-content.cjs` rechaza una
 * sesión cuyo `durationSeconds` quede por debajo.
 *
 * Efecto secundario deliberado: un enunciado largo encarece su propia ronda, y
 * como el presupuesto de pared no se mueve (15-20 min por juego), la verborrea
 * se paga sacando una ronda.
 */
export function relojDerivadoAbierta(sc: EscenarioAbiertoLike): number {
  const formato = formatoDe(sc);
  const crudo =
    costoDeLectura(palabrasDelEnunciado(sc), formato) + costoDeEscritura(formato, sc.difficulty);
  return Math.ceil(crudo / RELOJ_ESCALON_SEGUNDOS) * RELOJ_ESCALON_SEGUNDOS;
}

/** Cuánto agrega un apretón del botón del anfitrión. */
export const EXTENSION_SEGUNDOS = 30;

/**
 * El reloj que la ronda tuvo DE VERDAD: el escrito más lo que el anfitrión
 * agregó en vivo. Es lo que el diagnóstico tiene que usar como denominador;
 * contra el escrito, una ronda extendida se ve como un curso entregando al
 * 150% de su tiempo.
 */
export function relojEfectivoDeRonda(
  durationSeconds: number,
  roundExtensions: Record<string, number> | undefined,
  round: number,
): number {
  return durationSeconds + (roundExtensions?.[String(round)] ?? 0);
}
