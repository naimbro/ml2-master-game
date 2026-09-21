# Diagnóstico de clase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el reloj de una ronda abierta se calcule a partir del largo del enunciado y de lo que exige la respuesta, que el profesor pueda agregar 30 s en vivo dejando registro, y que después de cada clase una medición escriba en el repo lo que hay que cambiar en la siguiente.

**Architecture:** Cuatro piezas independientes. (1) `src/lib/abiertaTiming.ts`, funciones puras, gemelo de `mcTiming.ts`; su espejo en `validate-content.cjs` falla el build. (2) Un botón en los controles de anfitrión que empuja `roundEndTime` y anota en `game.roundExtensions`. (3) `scripts/diagnostico.ts`, que lee Firestore y mide. (4) El skill `diagnostico-de-clase` y una sección de redacción en `autor-de-contenido`, que son texto.

**Tech Stack:** TypeScript + React + Vite, vitest, Firestore (firebase-admin desde scripts vía ADC), CommonJS para `scripts/validate-content.cjs`.

**Spec:** `docs/superpowers/specs/2026-09-21-diagnostico-de-clase-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/abiertaTiming.ts` (nuevo) | Funciones puras: palabras, costo de lectura, costo de escritura, reloj derivado. Sin React, sin Firestore. |
| `src/lib/abiertaTiming.test.ts` (nuevo) | Tests, anclados en las mediciones reales de `9XR4Z6`. |
| `scripts/validate-content.cjs` (modificar) | Espejo CommonJS del cálculo + el chequeo que falla el build. |
| `scripts/abiertaTiming.test.ts` (nuevo) | Que el espejo y el original no se separen. |
| `src/types/game.ts` (modificar) | `roundExtensions` en `Game`; el comentario de `difficulty`. |
| `src/hooks/useGame.ts` (modificar) | `extendRound()`. |
| `src/pages/student/Round.tsx` (modificar) | El botón +30 s; sacar la insignia de dificultad. |
| `content/sessions/{dataviz_2026,mgt300_2026,ai_democracy_2026}/*/scenarios.json` | Reetiquetado + relojes. |
| `scripts/diagnostico.ts` (nuevo) | El medidor. Absorbe `scripts/mc-clock.ts`. |
| `.claude/skills/diagnostico-de-clase/SKILL.md` (nuevo) | El skill que corre el medidor y escribe la ficha. |
| `.claude/skills/autor-de-contenido/SKILL.md` (modificar) | Sección de redacción + leer las fichas. |
| `.claude/skills/autor-de-rubricas/SKILL.md` (modificar) | Leer las fichas. |
| `package.json` (modificar) | `prebuild` y `npm run diagnostico`. |

**Orden que no se negocia:** el validador se engancha al build (Tarea 8) **después** de migrar el contenido (Tarea 7). Al revés deja `main` en rojo y el deploy de GitHub Pages cae con él.

**Antes de empezar:** el repo tiene trabajo sin commitear de otras sesiones y algo de eso no compila. Construí los commits en un worktree aparte, como dice `CLAUDE.md`:

```bash
git worktree add /tmp/diag HEAD
ln -s /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-master-game/node_modules /tmp/diag/node_modules
```

---

### Task 1: `abiertaTiming.ts` — el costo de lectura

**Files:**
- Create: `src/lib/abiertaTiming.ts`
- Test: `src/lib/abiertaTiming.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npx vitest run src/lib/abiertaTiming.test.ts
```
Esperado: FAIL — `Failed to resolve import "./abiertaTiming"`.

- [ ] **Step 3: Escribir la implementación mínima**

```ts
// src/lib/abiertaTiming.ts
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npx vitest run src/lib/abiertaTiming.test.ts
```
Esperado: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/abiertaTiming.ts src/lib/abiertaTiming.test.ts
git commit -m "feat(reloj): el costo de lectura de un enunciado, medido en 35 rondas"
```

---

### Task 2: El costo de escritura y el reloj derivado

**Files:**
- Modify: `src/lib/abiertaTiming.ts`
- Modify: `src/lib/abiertaTiming.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `src/lib/abiertaTiming.test.ts`:

```ts
import { costoDeEscritura, relojDerivadoAbierta } from './abiertaTiming';

describe('costoDeEscritura', () => {
  it('una línea de código son 70 s, medidos en la R1 de 9XR4Z6', () => {
    // 72 s de escritura mediana, y sólo el 9% seguía escribiendo al final.
    expect(costoDeEscritura('code', 'medium')).toBe(70);
  });

  it('una cadena de dos o tres pasos son 120 s', () => {
    // R3 y R6 de 9XR4Z6: ~120 s de escritura, 33% y 14% colgando.
    expect(costoDeEscritura('code', 'hard')).toBe(120);
  });

  it('la prosa cuesta más que el código a igual etiqueta', () => {
    expect(costoDeEscritura('prose', 'medium')).toBeGreaterThan(
      costoDeEscritura('code', 'medium'),
    );
  });

  it('sin etiqueta asume medium, que es lo que escribe el scaffold', () => {
    expect(costoDeEscritura('prose', undefined)).toBe(costoDeEscritura('prose', 'medium'));
  });
});

describe('relojDerivadoAbierta', () => {
  it('le habría dado 180 s a la R4 de 9XR4Z6 en vez de 120', () => {
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(179).trim(),
      answerFormat: 'code',
      difficulty: 'hard',
    });
    // 58 s de lectura + 120 de escritura = 178, redondeado a 180.
    expect(reloj).toBe(180);
  });

  it('deja pasar la R1 de 9XR4Z6, que alcanzó de sobra', () => {
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(83).trim(),
      answerFormat: 'code',
      difficulty: 'medium',
    });
    // 34 + 70 = 104 -> 105, y la ronda tenía 120.
    expect(reloj).toBe(105);
    expect(reloj).toBeLessThanOrEqual(120);
  });

  it('redondea hacia arriba al múltiplo de 15, nunca hacia abajo', () => {
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(10).trim(),
      difficulty: 'easy',
    });
    // 16 + 90 = 106 -> 120
    expect(reloj % 15).toBe(0);
    expect(reloj).toBe(120);
  });

  it('sin answerFormat asume prosa, que es el default del schema', () => {
    const palabras = 'x '.repeat(50).trim();
    expect(relojDerivadoAbierta({ context: palabras, difficulty: 'medium' })).toBe(
      relojDerivadoAbierta({ context: palabras, answerFormat: 'prose', difficulty: 'medium' }),
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npx vitest run src/lib/abiertaTiming.test.ts
```
Esperado: FAIL — `costoDeEscritura is not a function`.

- [ ] **Step 3: Escribir la implementación**

Agregar al final de `src/lib/abiertaTiming.ts`:

```ts
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
 * línea (9% colgando al final), ~120 s para una cadena de dos o tres pasos
 * (14-33% colgando).
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

/** Lo que escribe el scaffold cuando nadie eligió. */
export const DIFICULTAD_POR_DEFECTO: Dificultad = 'medium';

export function costoDeEscritura(
  formato: FormatoDeRespuesta,
  dificultad: Dificultad | undefined,
): number {
  return ESCRITURA_SEGUNDOS[formato][dificultad ?? DIFICULTAD_POR_DEFECTO];
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
  const formato = sc.answerFormat ?? 'prose';
  const crudo = costoDeLectura(palabrasDelEnunciado(sc), formato) + costoDeEscritura(formato, sc.difficulty);
  return Math.ceil(crudo / RELOJ_ESCALON_SEGUNDOS) * RELOJ_ESCALON_SEGUNDOS;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npx vitest run src/lib/abiertaTiming.test.ts
```
Esperado: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/abiertaTiming.ts src/lib/abiertaTiming.test.ts
git commit -m "feat(reloj): el reloj derivado de una ronda abierta"
```

---

### Task 3: El espejo en el validador

`validate-content.cjs` es CommonJS y no puede importar el módulo TS. El repo ya
resuelve esto duplicando y avisándolo en un comentario (ver `mcFeedbackSeconds`,
línea 248). Seguimos ese patrón, pero con un test que ata las dos copias.

**Files:**
- Modify: `scripts/validate-content.cjs`
- Create: `scripts/abiertaTiming.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// scripts/abiertaTiming.test.ts
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { relojDerivadoAbierta } from '../src/lib/abiertaTiming';

const require = createRequire(import.meta.url);
const { relojDerivadoAbiertaCJS } = require('./validate-content.cjs') as {
  relojDerivadoAbiertaCJS: (sc: unknown) => number;
};

/**
 * El validador es CommonJS y no puede importar src/lib/abiertaTiming.ts, así que
 * el cálculo está escrito dos veces. Este test es lo único que impide que se
 * separen: si alguien ajusta la recta en un lado, acá se cae. Sin esto la
 * divergencia es SILENCIOSA — el build seguiría verde midiendo otra cosa.
 */
describe('el espejo del reloj en validate-content.cjs', () => {
  const casos = [
    { context: 'x '.repeat(179).trim(), answerFormat: 'code', difficulty: 'hard' },
    { context: 'x '.repeat(83).trim(), answerFormat: 'code', difficulty: 'medium' },
    { context: 'x '.repeat(236).trim(), difficulty: 'hard' },
    { question: 'x '.repeat(10).trim(), difficulty: 'easy' },
    { prompt: 'x '.repeat(120).trim(), answerFormat: 'prose', difficulty: 'medium' },
    {},
  ];

  for (const [i, caso] of casos.entries()) {
    it(`da el mismo número que src/lib/abiertaTiming.ts (caso ${i})`, () => {
      expect(relojDerivadoAbiertaCJS(caso)).toBe(relojDerivadoAbierta(caso as never));
    });
  }
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npx vitest run scripts/abiertaTiming.test.ts
```
Esperado: FAIL — `relojDerivadoAbiertaCJS is not a function`.

- [ ] **Step 3: Escribir el espejo**

En `scripts/validate-content.cjs`, antes de `function validateMCQuestions`:

```js
// ---------------------------------------------------------------------------
// ESPEJO de src/lib/abiertaTiming.ts. Si se cambia allá, cambiar acá.
// `scripts/abiertaTiming.test.ts` falla si las dos copias se separan, que es la
// única defensa: una divergencia acá no da error, da un build verde midiendo
// otra cosa.
// ---------------------------------------------------------------------------
const LECTURA_PISO_SEGUNDOS = 13;
const LECTURA_SEGUNDOS_POR_PALABRA = { prose: 0.32, code: 0.25 };
const ESCRITURA_SEGUNDOS = {
  code: { easy: 45, medium: 70, hard: 120 },
  prose: { easy: 90, medium: 150, hard: 210 },
};
const RELOJ_ESCALON_SEGUNDOS = 15;

function palabrasDelEnunciadoCJS(sc) {
  const texto = [sc.context, sc.question, sc.prompt].filter(Boolean).join(' ');
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function relojDerivadoAbiertaCJS(sc) {
  const formato = sc.answerFormat === 'code' ? 'code' : 'prose';
  const lectura = Math.round(
    LECTURA_PISO_SEGUNDOS + LECTURA_SEGUNDOS_POR_PALABRA[formato] * palabrasDelEnunciadoCJS(sc),
  );
  const escritura = ESCRITURA_SEGUNDOS[formato][sc.difficulty || 'medium'];
  return Math.ceil((lectura + escritura) / RELOJ_ESCALON_SEGUNDOS) * RELOJ_ESCALON_SEGUNDOS;
}
```

Y exportarlas. Buscar el `module.exports` del final del archivo y agregar las dos
claves a lo que ya exporta:

```js
module.exports.relojDerivadoAbiertaCJS = relojDerivadoAbiertaCJS;
module.exports.palabrasDelEnunciadoCJS = palabrasDelEnunciadoCJS;
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npx vitest run scripts/abiertaTiming.test.ts
```
Esperado: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-content.cjs scripts/abiertaTiming.test.ts
git commit -m "feat(validador): espejo del reloj derivado, atado por un test"
```

---

### Task 4: El chequeo que falla el build

Error en los cursos que se están dictando, advertencia en los retirados.

**Files:**
- Modify: `scripts/validate-content.cjs`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `scripts/abiertaTiming.test.ts`:

```ts
const { CURSOS_VIVOS, relojEsErrorEn } = require('./validate-content.cjs') as {
  CURSOS_VIVOS: string[];
  relojEsErrorEn: (curso: string) => boolean;
};

describe('a quién le falla el reloj corto', () => {
  it('los tres cursos que se dictan en 2026-2 fallan', () => {
    expect(relojEsErrorEn('dataviz_2026')).toBe(true);
    expect(relojEsErrorEn('mgt300_2026')).toBe(true);
    expect(relojEsErrorEn('ai_democracy_2026')).toBe(true);
  });

  it('un curso retirado sólo avisa: su reloj ya no le puede hacer daño a nadie', () => {
    expect(relojEsErrorEn('ml2-2025')).toBe(false);
    expect(relojEsErrorEn('temas_emergentes_2026')).toBe(false);
    expect(relojEsErrorEn('mundial_2026')).toBe(false);
  });

  it('un curso nuevo falla por defecto, que es el lado seguro', () => {
    expect(relojEsErrorEn('curso_que_no_existe_todavia')).toBe(true);
  });

  it('CURSOS_VIVOS es la lista, no una heurística sobre el nombre', () => {
    expect(CURSOS_VIVOS).toContain('dataviz_2026');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npx vitest run scripts/abiertaTiming.test.ts
```
Esperado: FAIL — `relojEsErrorEn is not a function`.

- [ ] **Step 3: Escribir el chequeo**

En `scripts/validate-content.cjs`, junto al espejo de la Tarea 3:

```js
/**
 * Los cursos que se están dictando. Un reloj corto acá le cuesta respuestas a
 * un curso de verdad la semana que viene; en un curso retirado no se lo cobra
 * nadie, y reetiquetar 37 escenarios de clases que no se van a volver a dictar
 * es trabajo de juicio sin destinatario.
 *
 * Un curso que no esté en esta lista falla, que es el lado seguro: lo que se
 * olvida es sacar un curso de acá, no meterlo.
 */
const CURSOS_VIVOS = ['dataviz_2026', 'mgt300_2026', 'ai_democracy_2026'];
const CURSOS_RETIRADOS = ['ml2-2025', 'temas_emergentes_2026', 'mundial_2026'];

function relojEsErrorEn(curso) {
  return !CURSOS_RETIRADOS.includes(curso);
}

function validateRelojAbierto(scope, sc, curso) {
  if (sc.type === 'multiple_choice') return;
  if (sc.durationSeconds === undefined) return; // ya lo reporta el chequeo de siempre

  const pide = relojDerivadoAbiertaCJS(sc);
  if (Number(sc.durationSeconds) >= pide) return;

  const palabras = palabrasDelEnunciadoCJS(sc);
  const mensaje =
    `durationSeconds=${sc.durationSeconds} no alcanza: ${palabras} palabras de enunciado ` +
    `y una respuesta '${sc.difficulty || 'medium'}' piden ${pide}s. ` +
    `Cortá el enunciado o subí el reloj — y si sube el reloj, revisá que el juego siga ` +
    `cabiendo en 20 min de pared (suma de relojes + 2 min por ronda).`;

  if (relojEsErrorEn(curso)) err(scope, mensaje);
  else warn(scope, mensaje);
}
```

Exportar las tres:

```js
module.exports.CURSOS_VIVOS = CURSOS_VIVOS;
module.exports.relojEsErrorEn = relojEsErrorEn;
```

- [ ] **Step 4: Llamarlo desde donde se validan los escenarios**

Buscar dónde el archivo recorre los escenarios de una sesión (el mismo lugar
desde el que sale `validateMCQuestions(scope, sc)`) y agregar la llamada al lado,
pasándole el id del pack que ese bucle ya tiene a mano:

```js
validateRelojAbierto(scope, sc, pack);
```

Verificar el nombre real de la variable del pack antes de escribirlo:

```bash
grep -n "validateMCQuestions(" scripts/validate-content.cjs
```

- [ ] **Step 5: Correr el validador y ver la lista**

```bash
node scripts/validate-content.cjs 2>&1 | grep -E "no alcanza|Resultado"
```
Esperado: errores en dataviz/mgt300/ai_democracy y advertencias en los retirados.
**Guardar esta salida**: es la lista de trabajo de la Tarea 7.

- [ ] **Step 6: Correr los tests**

```bash
npx vitest run scripts/abiertaTiming.test.ts
```
Esperado: PASS, 10 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate-content.cjs scripts/abiertaTiming.test.ts
git commit -m "feat(validador): rechazar rondas abiertas con el reloj corto"
```

---

### Task 5: Sacar la insignia de dificultad

`difficulty` ya no describe la dificultad conceptual sino el largo de la
respuesta. Mostrarla diría algo falso, y además desanima a quien iba a intentarlo.

**Files:**
- Modify: `src/pages/student/Round.tsx:1034-1047`
- Modify: `src/types/game.ts:253`

- [ ] **Step 1: Borrar el bloque de la insignia**

En `src/pages/student/Round.tsx`, borrar entero el bloque `{currentScenario.difficulty && (...)}`
que va desde `{currentScenario.difficulty && (` hasta su `)}`. La insignia de
`category`, justo encima, se queda.

- [ ] **Step 2: Cambiar el comentario del tipo**

En `src/types/game.ts`, reemplazar la línea:

```ts
  difficulty?: 'easy' | 'medium' | 'hard';
```

por:

```ts
  /**
   * CUÁNTO SE TARDA EN TECLEAR LA RESPUESTA, no qué tan difícil es el concepto.
   * Es lo único de la dificultad que consume reloj: una pregunta conceptualmente
   * durísima de respuesta corta necesita poco tiempo. Alimenta
   * `relojDerivadoAbierta()` y el validador falla si el reloj no alcanza.
   *
   * NO se le muestra al alumno desde 2026-09-21: con este significado, un
   * cartel de "difícil" desanima a quien iba a intentarlo y además miente.
   */
  difficulty?: 'easy' | 'medium' | 'hard';
```

- [ ] **Step 3: Verificar que compila y que no quedó nada colgando**

```bash
npx tsc -b && npx eslint src/pages/student/Round.tsx src/types/game.ts
grep -n "difficulty" src/pages/student/Round.tsx
```
Esperado: `tsc` y `eslint` sin salida, y el `grep` sin resultados. Si `tsc` se
queja de un import de icono que quedó sin uso, borrar ese import.

- [ ] **Step 4: Correr la suite completa**

```bash
npx vitest run
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/student/Round.tsx src/types/game.ts
git commit -m "feat(ronda): la insignia de dificultad sale de la pantalla del alumno"
```

---

### Task 6: El botón +30 s

**Files:**
- Modify: `src/types/game.ts` (interface `Game`)
- Modify: `src/hooks/useGame.ts`
- Modify: `src/pages/student/Round.tsx:583-604`

- [ ] **Step 1: Agregar el campo al tipo**

En `src/types/game.ts`, dentro de `interface Game`, debajo de `mcAllAnsweredAt`:

```ts
  /**
   * Segundos que el anfitrión agregó a mano, por ronda: `{ "4": 60 }`.
   *
   * Existe para que `scripts/diagnostico.ts` no mida mal. Sin este registro,
   * una ronda extendida se ve como un curso entero entregando al 150% de su
   * reloj, y el diagnóstico concluiría exactamente lo contrario de lo que pasó.
   * Y de paso es la señal más fuerte que hay para la próxima edición de esa
   * clase: "en R4 tuviste que apretar +30 dos veces".
   *
   * Sólo rondas abiertas: las MC derivan todo de `roundStartTime` y empujar el
   * fin las desincroniza en vez de alargarlas.
   */
  roundExtensions?: Record<string, number>;
```

- [ ] **Step 2: Escribir el test que falla**

```ts
// src/lib/abiertaTiming.test.ts — agregar al final
import { relojEfectivoDeRonda, EXTENSION_SEGUNDOS } from './abiertaTiming';

describe('relojEfectivoDeRonda', () => {
  it('sin extensiones es el reloj escrito', () => {
    expect(relojEfectivoDeRonda(120, undefined, 4)).toBe(120);
  });

  it('suma los segundos que el profe agregó en esa ronda', () => {
    expect(relojEfectivoDeRonda(120, { '4': 60 }, 4)).toBe(180);
  });

  it('no mezcla la extensión de otra ronda', () => {
    expect(relojEfectivoDeRonda(120, { '3': 60 }, 4)).toBe(120);
  });

  it('un apretón son 30 s', () => {
    expect(EXTENSION_SEGUNDOS).toBe(30);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
npx vitest run src/lib/abiertaTiming.test.ts
```
Esperado: FAIL — `relojEfectivoDeRonda is not a function`.

- [ ] **Step 4: Implementar**

Al final de `src/lib/abiertaTiming.ts`:

```ts
/** Cuánto agrega un apretón del botón del anfitrión. */
export const EXTENSION_SEGUNDOS = 30;

/**
 * El reloj que la ronda tuvo DE VERDAD: el escrito más lo que el anfitrión
 * agregó en vivo. Es lo que `scripts/diagnostico.ts` tiene que usar como
 * denominador; contra el escrito, una ronda extendida se ve como un curso
 * entregando al 150% de su tiempo.
 */
export function relojEfectivoDeRonda(
  durationSeconds: number,
  roundExtensions: Record<string, number> | undefined,
  round: number,
): number {
  return durationSeconds + (roundExtensions?.[String(round)] ?? 0);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
npx vitest run src/lib/abiertaTiming.test.ts
```
Esperado: PASS, 19 tests.

- [ ] **Step 6: Escribir `extendRound` en el hook**

En `src/hooks/useGame.ts`, junto a las demás acciones de anfitrión (después de
`startGame`, que termina cerca de la línea 347):

```ts
  /**
   * Le agrega 30 s a la ronda que está corriendo. Apretable cuantas veces haga
   * falta.
   *
   * Empujar `roundEndTime` alcanza porque ese campo es lo que miran las dos
   * puntas: el reloj del alumno (Round.tsx) y el auto-cierre del anfitrión más
   * abajo en este archivo. `roundExtensions` no cambia nada en vivo: existe
   * para que el diagnóstico sepa después que esta ronda duró más.
   *
   * No se ofrece en rondas MC — ahí el bloque se deriva de `roundStartTime` y
   * empujar el fin lo desincroniza en vez de alargarlo.
   */
  const extendRound = useCallback(async () => {
    if (!gameCode || !isHost || !game?.roundEndTime) return;

    const ronda = String(game.currentRound);
    const yaAgregado = game.roundExtensions?.[ronda] ?? 0;
    const fin = game.roundEndTime.toMillis() + EXTENSION_SEGUNDOS * 1000;

    await updateDoc(doc(db, 'games', gameCode), {
      roundEndTime: Timestamp.fromMillis(fin),
      [`roundExtensions.${ronda}`]: yaAgregado + EXTENSION_SEGUNDOS,
      updatedAt: serverTimestamp(),
    });
  }, [gameCode, isHost, game?.roundEndTime, game?.currentRound, game?.roundExtensions]);
```

Agregar `import { EXTENSION_SEGUNDOS } from '../lib/abiertaTiming';` arriba, y
`extendRound` al objeto que el hook retorna.

- [ ] **Step 7: El botón**

En `src/pages/student/Round.tsx`, dentro del bloque `{isHost && (...)}` de los
controles (línea ~584), **antes** del botón de Terminar Ronda:

```tsx
              {!isMC && (
                <button
                  onClick={() => extendRound()}
                  title="Le agrega 30 s a esta ronda. Apretalo ANTES de que el reloj llegue a cero: al llegar a cero cada teléfono envía solo."
                  className="flex items-center gap-2 px-4 py-2 bg-kahoot-green/80 hover:bg-kahoot-green text-ink rounded-lg font-bold text-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  +30 s
                </button>
              )}
```

Agregar `extendRound` a lo que se saca de `useGame(gameCode)` en la línea 48, y
`Plus` al import de `lucide-react`.

- [ ] **Step 8: Verificar**

```bash
npx tsc -b && npx eslint src/hooks/useGame.ts src/pages/student/Round.tsx && npx vitest run
```
Esperado: las tres sin errores.

- [ ] **Step 9: Commit**

```bash
git add src/types/game.ts src/hooks/useGame.ts src/pages/student/Round.tsx src/lib/abiertaTiming.ts src/lib/abiertaTiming.test.ts
git commit -m "feat(ronda): botón de +30 s para el anfitrión, con registro"
```

---

### Task 7: Reetiquetar los cursos vivos

Los 51 escenarios abiertos de `dataviz_2026`, `mgt300_2026` y `ai_democracy_2026`
tienen una etiqueta escrita con el sentido viejo. Hay que revisarlas con el sentido
nuevo y ajustar los relojes que queden cortos.

**Files:**
- Modify: `content/sessions/dataviz_2026/*/scenarios.json`
- Modify: `content/sessions/mgt300_2026/*/scenarios.json`
- Modify: `content/sessions/ai_democracy_2026/*/scenarios.json`

- [ ] **Step 1: Sacar la lista de trabajo**

```bash
node scripts/validate-content.cjs dataviz_2026 2>&1 | grep "no alcanza"
node scripts/validate-content.cjs mgt300_2026 2>&1 | grep "no alcanza"
node scripts/validate-content.cjs ai_democracy_2026 2>&1 | grep "no alcanza"
```

- [ ] **Step 2: Etiquetar de a una sesión, leyendo `idealAnswer`**

Para cada escenario abierto, la etiqueta sale de **lo que la respuesta ideal
obliga a teclear**, no de qué tan difícil es el concepto:

| | `easy` | `medium` | `hard` |
|---|---|---|---|
| `answerFormat: 'code'` | un nombre de función | una línea | dos o tres pasos encadenados |
| prosa | una frase | un párrafo | argumento con evidencia |

Regla de desempate, tomada de lo medido: la R4 de la clase 7 —`group_by()` +
`summarise()` + la columna nueva— es `hard`, aunque cada paso por separado sea
elemental. Encadenar cuesta.

- [ ] **Step 3: Arreglar cada reloj que siga corto**

Con la etiqueta puesta, el validador dice cuánto pide cada ronda. Para cada una,
en este orden:

1. **Primero cortar el enunciado.** A 0,32 s por palabra, sacar 30 palabras son
   10 s de reloj. Es lo único que mejora el juego en vez de alargarlo.
2. **Después subir `durationSeconds`** al número que pide el validador.
3. **Si el juego ya no cabe, sacar una ronda.** El presupuesto es
   `suma de relojes + 2 min × nº de rondas ≤ 20 min`. Un juego que no cabe no se
   acorta solo: se corta a la mitad y se pierden las últimas rondas enteras.

- [ ] **Step 4: Verificar que los tres cursos vivos quedan limpios**

```bash
node scripts/validate-content.cjs 2>&1 | tail -3
```
Esperado: `0 errores`. Las advertencias de los cursos retirados se quedan.

- [ ] **Step 5: Verificar el presupuesto de pared de cada sesión tocada**

```bash
node -e "
const fs=require('fs');const f=process.argv[1];
const sc=JSON.parse(fs.readFileSync(f,'utf8'));
const arr=Array.isArray(sc)?sc:sc.scenarios;
const suma=arr.reduce((a,s)=>a+Number(s.durationSeconds||0),0);
console.log(f, arr.length,'rondas', (suma/60).toFixed(1),'min de relojes, pared estimada', ((suma+120*arr.length)/60).toFixed(1),'min');
" content/sessions/dataviz_2026/clase_07_mutate_agrupar_resumir/scenarios.json
```
Esperado: pared estimada ≤ 20 min. Si no, sacar una ronda (paso 3.3).

- [ ] **Step 6: Commit, una sesión por commit**

```bash
git add content/sessions/dataviz_2026/clase_07_mutate_agrupar_resumir/scenarios.json
git commit -m "fix(dataviz c07): las etiquetas de dificultad dicen cuánto se teclea, y el reloj sale de ahí"
```

---

### Task 8: Enganchar el validador al build

Sólo ahora: antes de la Tarea 7 esto deja `main` en rojo y el deploy cae con él.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verificar que el árbol está limpio**

```bash
node scripts/validate-content.cjs > /dev/null 2>&1; echo "EXIT=$?"
```
Esperado: `EXIT=0`. Si no, volver a la Tarea 7 — no seguir.

- [ ] **Step 2: Agregar el prebuild**

En `package.json`, dentro de `"scripts"`:

```json
    "prebuild": "node scripts/validate-content.cjs",
    "diagnostico": "tsx scripts/diagnostico.ts",
```

`npm` corre `prebuild` solo antes de `build`, así que queda cubierto el `npm run
build` local y el `run: npm run build` de `.github/workflows/deploy.yml:34`.

- [ ] **Step 3: Verificar que el build corre el validador**

```bash
npm run build 2>&1 | head -20
```
Esperado: la salida del validador antes de la de `tsc`/`vite`.

- [ ] **Step 4: Verificar que un reloj corto REALMENTE rompe el build**

Romperlo a propósito y confirmar que el deploy se habría caído:

```bash
node -e "
const f='content/sessions/dataviz_2026/clase_07_mutate_agrupar_resumir/scenarios.json';
const fs=require('fs');const j=JSON.parse(fs.readFileSync(f,'utf8'));
const arr=Array.isArray(j)?j:j.scenarios; arr[0].durationSeconds=15;
fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');"
npm run build > /dev/null 2>&1; echo "EXIT=$? (tiene que ser distinto de 0)"
git checkout content/sessions/dataviz_2026/clase_07_mutate_agrupar_resumir/scenarios.json
```
Esperado: `EXIT` distinto de 0, y el `git checkout` deja el archivo como estaba.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "build: el validador de contenido corre antes de cada build"
```

---

### Task 9: `scripts/diagnostico.ts`

**Files:**
- Create: `scripts/diagnostico.ts`
- Delete: `scripts/mc-clock.ts` (absorbido)

- [ ] **Step 1: Leer el que ya existe, que es el 80% del trabajo**

```bash
sed -n '1,200p' scripts/mc-clock.ts
```
`diagnostico.ts` nace de una copia: mismo `admin.initializeApp({ projectId })`,
mismo `db.settings({ preferRest: true })` —sin eso los scripts de análisis mueren
mudos en el primer `.get()` de una subcolección—, mismo recorrido de `games`.

- [ ] **Step 2: Escribir el script**

```ts
/**
 * Qué pasó en un juego, y qué hay que cambiarle al SIGUIENTE.
 *
 * Reemplaza a mc-clock.ts (que sólo medía las rondas de alternativas) y agrega
 * lo que faltaba: las abiertas. Ver
 * docs/superpowers/specs/2026-09-21-diagnostico-de-clase-design.md
 *
 * Uso:
 *   npm run diagnostico 9XR4Z6      # un juego
 *   npm run diagnostico -- --calibrar   # reajusta la recta con TODOS los juegos
 */
import admin from 'firebase-admin';
import {
  palabrasDelEnunciado, costoDeLectura, relojDerivadoAbierta, relojEfectivoDeRonda,
} from '../src/lib/abiertaTiming';

const PROJECT_ID = 'ml2-master-game';
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
db.settings({ preferRest: true });

/** Debajo de esto un juego es una prueba del profesor, no una clase. */
const MIN_JUGADORES = 10;
/** La ventana en la que "seguía escribiendo" significa que no alcanzó. */
const VENTANA_FINAL_MS = 20_000;
```

El corazón, que es la parte fácil de escribir mal:

```ts
interface FilaAbierta {
  ronda: number; palabras: number;
  lecturaPredicha: number; lecturaReal: number; residual: number;
  escritura: number; colgando: number | null;
  relojEscrito: number; relojEfectivo: number; relojQuePedia: number;
  n: number;
}

const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function medirRondaAbierta(sc: any, ronda: number, ts: any[], game: any): FilaAbierta | null {
  const utiles = ts.filter((t) => t.largoFinal > 0 && t.msPrimeraTecla != null);
  if (utiles.length < 5) return null; // con menos de cinco, la mediana es ruido

  const formato = sc.answerFormat === 'code' ? 'code' : 'prose';
  const palabras = palabrasDelEnunciado(sc);
  const lecturaPredicha = costoDeLectura(palabras, formato);
  const lecturaReal = Math.round(mediana(utiles.map((t) => t.msPrimeraTecla / 1000)));

  const escrituras: number[] = [];
  let colgaron = 0;
  for (const t of utiles) {
    const h: number[] = t.huella || [];
    const iv: number = t.huellaIntervaloMs || 1000;

    // Cuándo alcanzó el 95% de lo que terminó escribiendo: el "ya está".
    const i95 = h.findIndex((v) => v >= 0.95 * t.largoFinal);
    if (i95 >= 0) escrituras.push(((i95 + 1) * iv - t.msPrimeraTecla) / 1000);

    // ¿Seguía creciendo el texto en los últimos 20 s antes de enviar?
    const nUlt = Math.min(h.length, Math.floor(t.msEnvio / iv));
    const atras = Math.max(1, Math.round(VENTANA_FINAL_MS / iv));
    const fin = h[Math.max(0, nUlt - 1)] ?? t.largoFinal;
    const antes = h[Math.max(0, nUlt - 1 - atras)] ?? 0;
    if (fin - antes > 20) colgaron++;
  }

  const relojEscrito = Number(sc.durationSeconds ?? game.roundDurationSeconds ?? 0);
  return {
    ronda, palabras, lecturaPredicha, lecturaReal,
    residual: lecturaReal - lecturaPredicha,
    escritura: escrituras.length ? Math.round(mediana(escrituras)) : 0,
    // En prosa este número es 76-100% en los cinco cursos: la gente escribe
    // hasta la chicharra por definición. Reportarlo sería una falsa alarma
    // permanente, así que en prosa no existe.
    colgando: formato === 'code' ? Math.round((100 * colgaron) / utiles.length) : null,
    relojEscrito,
    relojEfectivo: relojEfectivoDeRonda(relojEscrito, game.roundExtensions, ronda),
    relojQuePedia: relojDerivadoAbierta(sc),
    n: utiles.length,
  };
}
```

Lo que cada columna significa al imprimirla:

- `palabras` = `palabrasDelEnunciado(sc)`
- `lecturaPredicha` = `costoDeLectura(palabras, formato)`
- `lecturaReal` = mediana de `msPrimeraTecla / 1000`
- **`residual` = `lecturaReal - lecturaPredicha`**. Es el detector de redacción:
  positivo grande significa que la pregunta cuesta más de lo que su largo explica.
- `escritura` = mediana de `(indiceDelPrimer 95% del largoFinal en huella) × huellaIntervaloMs - msPrimeraTecla`, en segundos
- **`colgando`** = fracción con `huella[final] - huella[final - 20 s] > 20`, y
  **se imprime sólo si `answerFormat === 'code'`**. En prosa ese número es 76-100%
  en los cinco cursos: la gente escribe hasta la chicharra por definición, y
  reportarlo sería una falsa alarma permanente.
- `relojEfectivo` = `relojEfectivoDeRonda(sc.durationSeconds, game.roundExtensions, ronda)`,
  y se imprime `+30 s × n` cuando hubo extensiones.
- `relojQuePedia` = `relojDerivadoAbierta(sc)`, para contrastar con lo que se dio.

Por escenario MC, lo que ya hacía `mc-clock.ts`: mediana del % del límite
consumido, umbral 60%, respuestas perdidas y % de acierto.

Del juego entero: pared (`finishedAt - startedAt`) contra
`suma de relojes + 2 min × rondas`, nota media de `feedback` y los comentarios
completos.

`--calibrar` recorre todos los juegos con ≥ `MIN_JUGADORES` y telemetría, ajusta
`lectura ~ a + b × palabras` por mínimos cuadrados e **imprime** `a`, `b`, n y
RMSE. No escribe `abiertaTiming.ts`: cambiar esa recta mueve el piso de todas las
sesiones del repo a la vez y es un commit deliberado.

- [ ] **Step 3: Correr contra el juego que originó todo esto**

```bash
npm run diagnostico 9XR4Z6
```
Esperado, contra lo ya medido a mano — si no da esto, el script está mal:
R1 lectura 31 s, R2 37 s, R3 40 s, R4 54 s, R5 44 s, R6 41 s; colgando 9%, 57%,
33%, 55%, 62%, 14%; pared 26,9 min contra un presupuesto de 20.

- [ ] **Step 4: Verificar la calibración**

```bash
npm run diagnostico -- --calibrar
```
Esperado: `b` cerca de 0,32 y n cerca de 35. Si `b` se movió mucho, **no** tocar
`abiertaTiming.ts` en esta tarea: anotarlo y decidirlo aparte.

- [ ] **Step 5: Borrar `mc-clock.ts` y arreglar lo que lo nombra**

```bash
git rm scripts/mc-clock.ts
grep -rn "mc-clock" --include=*.md --include=*.ts --include=*.json . | grep -v node_modules
```
Actualizar cada mención a `npm run diagnostico`. El archivo de memoria
`reloj_alternativas_se_mide.md` lo nombra: dejarlo para la Tarea 12.

- [ ] **Step 6: Commit**

```bash
git add scripts/diagnostico.ts package.json
git commit -m "feat(diagnostico): medir el reloj de las abiertas, absorbiendo mc-clock"
```

---

### Task 10: El skill `diagnostico-de-clase`

**Files:**
- Create: `.claude/skills/diagnostico-de-clase/SKILL.md`

- [ ] **Step 1: Leer los tres skills que ya existen**

```bash
head -30 .claude/skills/autor-de-contenido/SKILL.md
```
El frontmatter (`name`, `description`) y el tono salen de ahí: los tres están
escritos en castellano, entrevistan a Naim y explican *por qué* existe cada regla.

- [ ] **Step 2: Escribir el skill**

`description`: cuándo se invoca — «después de jugar un juego con un curso»,
«los alumnos dijeron que faltó tiempo», «cómo salió el juego de la clase X»,
«qué le cambio al juego de la próxima clase».

El cuerpo, en este orden:

1. **Correr `npm run diagnostico <CÓDIGO>`.** Si no se sabe el código, listar los
   juegos recientes con ≥ 10 jugadores.
2. **Leer los comentarios completos**, no el promedio. Quince comentarios se leen
   en un minuto y el promedio esconde justo lo que sirve: en `9XR4Z6` la nota era
   4,50 y los quince decían «tiempo».
3. **Un veredicto por ronda**, con estas reglas de lectura:
   - `residual > +15 s` → **el enunciado confunde**. Reescribirlo, no alargar el reloj.
   - `colgando > 40%` **en código** → el reloj no alcanzó. Subir `difficulty` o cortar palabras.
   - `colgando` en prosa → **no se reporta**. Es 76-100% siempre.
   - extensiones registradas → el reloj escrito estaba mal por esa cantidad, y
     no es una opinión.
   - pared > 20 min → sobran rondas, y las últimas no se jugaron.
4. **Escribir la ficha** en `content/sessions/<curso>/<clase>/diagnostico.md`:
   código del juego, fecha, jugadores, nota, la tabla por ronda, los comentarios
   agrupados por tema, y **una lista de qué cambiar**. La ficha describe lo que
   pasó; **no se rediseña el juego que ya se jugó**.
5. **La regla que manda:** el destinatario de la ficha es el *próximo* juego de
   ese curso, y quien la lee es `autor-de-contenido`.

- [ ] **Step 3: Probarlo sobre el juego de hoy**

Invocar el skill sobre `9XR4Z6` y verificar que la ficha que escribe dice lo que
ya sabemos: que R2, R4 y R5 no alcanzaron, que ningún enunciado confundía, y que
el problema es que estaban largos.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/diagnostico-de-clase/SKILL.md content/sessions/dataviz_2026/clase_07_mutate_agrupar_resumir/diagnostico.md
git commit -m "feat(skills): diagnostico-de-clase, y la ficha de la clase 7"
```

---

### Task 11: La sección de redacción y el enganche entre skills

**Files:**
- Modify: `.claude/skills/autor-de-contenido/SKILL.md`
- Modify: `.claude/skills/autor-de-rubricas/SKILL.md`
- Modify: `.claude/skills/autor-de-contenido/esquema.md`

- [ ] **Step 1: Leer el paso 8, donde ya vive la regla del reloj MC**

```bash
grep -n "reloj\|timeLimitSeconds\|par mínimo\|par minimo" .claude/skills/autor-de-contenido/SKILL.md
```

- [ ] **Step 2: Escribir la sección de redacción en `SKILL.md`**

Al lado de la regla del reloj de las MC, con el dato que la sostiene:

> **El enunciado se cobra a 0,32 s por palabra, medido en 35 rondas.** Un
> enunciado de 180 palabras son 60 s de reloj que se van antes de que nadie
> escriba un carácter. Techo: **90 palabras** en una ronda abierta.
>
> - Una sola pregunta por enunciado.
> - Los datos en lista o tabla, nunca en prosa corrida.
> - El verbo de la tarea solo y en la última línea.
> - Nada de contexto narrativo que no se use para responder.
>
> El techo no tiene regla propia en el validador y no hace falta: más palabras es
> más reloj derivado, más reloj no cabe en los 20 min de pared, y el juego pierde
> una ronda. La regla dura ya está en `relojDerivadoAbierta()`.

- [ ] **Step 3: Documentar `difficulty` en `esquema.md`**

Con la tabla de la Tarea 7 y la frase que evita el malentendido: **no es qué tan
difícil es el concepto, es cuánto se tarda en teclear la respuesta.**

- [ ] **Step 4: Enganchar las fichas en los dos skills**

Al principio de `autor-de-contenido/SKILL.md` y de `autor-de-rubricas/SKILL.md`:

> **Antes de escribir nada, leer las fichas de diagnóstico de las clases
> anteriores de este curso** (`content/sessions/<curso>/*/diagnostico.md`). Ahí
> está lo que ya se midió con este curso: cuánto tardan en leer, qué relojes no
> alcanzaron, qué enunciados confundieron. Es el único lugar donde el aprendizaje
> de una clase llega a la siguiente.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/autor-de-contenido/SKILL.md .claude/skills/autor-de-contenido/esquema.md .claude/skills/autor-de-rubricas/SKILL.md
git commit -m "docs(skills): redacción con presupuesto de palabras, y las fichas como entrada"
```

---

### Task 12: Cerrar

- [ ] **Step 1: La suite entera, en el worktree limpio**

```bash
npx vitest run && npx tsc -b && npx eslint . && npm run build
```
Esperado: los cuatro en verde. `npm run build` ahora corre el validador primero.

- [ ] **Step 2: Actualizar la memoria**

Dos archivos en
`/home/naimbrok/.claude/projects/-mnt-c-Users-naim-bro-k-claude-projects-games-ml2-master-game/memory/`:

- `reloj_alternativas_se_mide.md`: `mc-clock.ts` ya no existe; ahora es
  `npm run diagnostico`.
- Uno nuevo, `reloj_abiertas_se_calcula.md`, tipo `feedback`: la recta, el
  hallazgo de que en prosa el «colgando» es 76-100% siempre, y que `difficulty`
  cambió de significado. Enlazar `[[reloj_alternativas_se_mide]]`,
  `[[duracion_juego_15_20_min]]` y `[[feedback_juego_mgt300_clase01]]`.

Agregar la línea nueva a `MEMORY.md`.

- [ ] **Step 3: Probarlo jugando, que es lo único que cierra esto**

Lo que ningún test cubre y hay que mirar en la próxima clase:

1. Apretar **+30 s** en una ronda abierta y ver que el reloj sube en el teléfono
   de un alumno, no sólo en el proyector.
2. Apretarlo **dos veces** y confirmar que `game.roundExtensions` queda en 60.
3. Correr `npm run diagnostico` sobre ese juego y verificar que el denominador
   incluyó los 30 s. Si el diagnóstico reporta a todo el curso entregando por
   encima del 100% de su reloj, el registro no se escribió.
4. Que en una ronda MC el botón **no aparezca**.

---

## Lo que este plan NO hace

- **No rediseña juegos ya jugados.** Decisión explícita de Naim: el aprendizaje
  va al siguiente juego.
- **No reetiqueta los 37 escenarios de los cursos retirados.** Ahí el validador
  avisa y no falla.
- **No recalibra sola la recta.** `--calibrar` imprime; la persona commitea.
- **No toca `firestore.rules`.** El doc del juego ya es
  `allow update: if isAuthenticated()`.
