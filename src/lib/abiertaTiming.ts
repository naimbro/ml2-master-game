// El reloj de una ronda ABIERTA. Gemelo de mcTiming.ts, y por la misma razón:
// escrito a ojo, el reloj de una abierta se equivoca en una dirección sola.
//
// Dataviz clase 7 (9XR4Z6, 21-sep-2026) sacó 4,50/7 — la nota más baja del año —
// y los quince comentarios hablaban de tiempo. Medidas las 36 rondas abiertas
// con telemetría del repo, la mediana del curso tarda en escribir su primer
// carácter lo que el enunciado mide — pero hay DOS ajustes distintos acá
// abajo, y conviene no mezclarlos:
//
//   con las 36 rondas:     a = 7,7 s   b = 0,391 s/palabra
//                           RMSE 12,4 s   corr = 0,91
//
// Ese 0,91 lo decide un solo punto: NPX5EE R1, 421 palabras, 2,4 veces más
// largo que el siguiente enunciado del repo (179). Sacándolo queda el ajuste
// que el código usa de verdad:
//
//   sin ese punto (n = 35): a = 13,3 s   b = 0,319 s/palabra
//                           RMSE 11,9 s   corr = 0,77 pooled
//                           (corr = 0,90 mirando sólo las rondas de prosa,
//                            n = 27 — código tiene su propia recta, más plana)
//
//   lectura ≈ 13 s + 0,32 s × palabra      (n = 35, RMSE 12 s)
//
// `npm run diagnostico -- --calibrar` reproduce los dos ajustes y excluye el
// mismo punto por la misma razón (`PALABRAS_FUERA_DE_RANGO` en
// `scripts/diagnostico.ts`).
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

/**
 * Cómo se escribe la respuesta. Espejo de `Scenario.answerFormat`.
 *
 * Los valores válidos, como VALORES y no sólo como tipo.
 *
 * El orden importa: van de menos a más tecleo, que es lo que la etiqueta
 * significa.
 *
 * Existen en runtime porque `scripts/validate-content.cjs` necesita avisar
 * cuando el contenido trae una etiqueta que no está en la lista, y un tipo de
 * TypeScript no se puede consultar desde ahí. Con el tipo derivado de esta
 * constante, agregar un valor es un solo cambio y el test del espejo obliga a
 * que el validador lo aprenda en la misma sentada.
 */
export const FORMATO_VALORES = ['prose', 'code'] as const;
export type FormatoDeRespuesta = (typeof FORMATO_VALORES)[number];

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
 *
 * Los valores válidos, como VALORES y no sólo como tipo.
 *
 * El orden importa: van de menos a más tecleo, que es lo que la etiqueta
 * significa.
 *
 * Existen en runtime porque `scripts/validate-content.cjs` necesita avisar
 * cuando el contenido trae una etiqueta que no está en la lista, y un tipo de
 * TypeScript no se puede consultar desde ahí. Con el tipo derivado de esta
 * constante, agregar un valor es un solo cambio y el test del espejo obliga a
 * que el validador lo aprenda en la misma sentada.
 */
export const DIFICULTAD_VALORES = ['easy', 'medium', 'hard'] as const;
export type Dificultad = (typeof DIFICULTAD_VALORES)[number];

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

/**
 * El margen en el que apretar el botón ya no es seguro.
 *
 * No sale del reloj sino de las dos cosas que el botón no controla: la latencia
 * del `updateDoc` en el wifi de una sala, y el desfase de reloj entre teléfonos
 * —cada uno compara `roundEndTime` contra su propio `Date.now()`—. Por debajo
 * de estos 15 s ya no se puede garantizar que el nuevo `roundEndTime` llegue a
 * cada teléfono antes de que el suyo marque cero, y el que marque cero envía
 * solo y queda bloqueado: no pierde la respuesta, pierde los 30 s.
 */
export const EXTENSION_MARGEN_SEGUNDOS = 15;

/**
 * En qué estado está el botón «+30 s» del anfitrión.
 *
 * - `ok`: queda margen, la extensión va a llegar a todos los teléfonos.
 * - `sobre_la_hora`: se puede apretar, pero hay teléfonos a punto de enviar
 *   solos y esos no van a poder seguir escribiendo.
 * - `tarde`: el reloj llegó a cero, los teléfonos ya enviaron y extender no le
 *   devuelve tiempo a nadie. El botón se deshabilita.
 */
export type EstadoBotonExtender = 'ok' | 'sobre_la_hora' | 'tarde';

/**
 * Decide el estado del botón a partir del `timeLeft` que la pantalla ya calcula.
 * Vive acá, y no como comparaciones en el JSX, para que el umbral sea un número
 * con nombre y con test.
 */
export function estadoDelBotonExtender(timeLeft: number): EstadoBotonExtender {
  if (timeLeft <= 0) return 'tarde';
  if (timeLeft <= EXTENSION_MARGEN_SEGUNDOS) return 'sobre_la_hora';
  return 'ok';
}
