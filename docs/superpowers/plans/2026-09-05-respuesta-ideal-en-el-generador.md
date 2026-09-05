# Respuesta ideal en el generador de sesiones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el asistente que genera sesiones desde el panel del profesor escriba, por cada ronda, una respuesta ideal en prosa y una guía corta de evaluación — y que el profesor pueda corregirlas antes de publicar.

**Architecture:** Tres cambios en la Cloud Function `generateSessionDraft` (el prompt pide los campos nuevos con el material de clase primero; el validador rechaza el borrador que no los trae; sube el techo de tokens) más dos en el frontend (el tipo acepta la forma real del campo; la pantalla de edición los muestra). Nada se migra: las sesiones que ya existen siguen igual.

**Tech Stack:** TypeScript, Vitest (dos suites separadas: `functions/` y raíz), React + Tailwind, Firebase Cloud Functions (`gpt-4o` vía OpenAI SDK).

**Spec:** `docs/superpowers/specs/2026-09-05-respuesta-ideal-en-el-generador-design.md`

---

## Antes de empezar: dos trampas del entorno

1. **Node.** El node por defecto de WSL es v18 y las herramientas del repo necesitan 20+.
   Ejecuta esto **una vez por shell**, antes de cualquier comando de este plan:

```bash
export PATH=$HOME/.nvm/versions/node/v20.19.5/bin:$PATH
node -v   # debe imprimir v20.x
```

2. **El árbol está sucio.** El repo tiene trabajo sin commitear de otras sesiones y
   parte de eso no compila. **Nunca uses `git add -A` ni `git commit -a`.** Cada commit
   de este plan nombra sus archivos uno por uno, y así están escritos abajo.

## Mapa de archivos

| Archivo | Qué le pasa |
|---|---|
| `functions/src/lib/sessionDraft.ts` | El validador exige los campos nuevos; el prompt los pide y pone el material de clase primero. Es un módulo de funciones puras, sin imports de firebase ni de openai — por eso se puede testear solo. |
| `functions/src/lib/sessionDraft.test.ts` | Los tests de lo anterior. |
| `functions/src/index.ts` | Una línea: el techo de tokens de la llamada al modelo. |
| `src/types/game.ts` | `idealAnswer` pasa a aceptar texto además de objeto. |
| `src/types/game.test.ts` | **Nuevo.** Chequeo de tipos de lo anterior. |
| `src/pages/professor/SessionEditor.tsx` | Un componente nuevo a nivel de módulo (`GuiaDeEvaluacionEditor`), los dos campos en el bloque de rondas abiertas, y los valores por defecto de una ronda nueva. |

---

## Task 1: El tipo `idealAnswer` acepta la forma real

**Por qué:** `IdealAnswer` está declarado como objeto (`keyPoints`, `expectedConcepts`,
`commonMistakes`), pero **todas** las sesiones reales lo escriben como texto corrido —
mira `content/sessions/mgt300_2026/clase_05_repaso_unidad_1/scenarios.json`.

Hoy nada falla, porque `src/lib/courses.ts:117` carga los escenarios como `AnyJson` y
el tipo nunca se chequea contra el contenido. Se arregla igual: la Task 4 agrega una
pantalla que lee ese campo, y el tipo tiene que decir la verdad sobre lo que va a
encontrarse ahí.

**Files:**
- Create: `src/types/game.test.ts`
- Modify: `src/types/game.ts:269`

- [ ] **Step 1: Escribe el test que falla**

Este test no comprueba nada en tiempo de ejecución: el chequeo es que **compile**.
Un objeto tipado como `Scenario` con `idealAnswer` de texto es exactamente lo que
hay en el repo, y hoy el tipo lo rechaza.

Crea `src/types/game.test.ts`:

```typescript
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
```

- [ ] **Step 2: Córrelo y verifica que falla**

```bash
npx tsc -b
```

Esperado: FALLA con un error del estilo
`src/types/game.test.ts(...): error TS2322: Type 'string' is not assignable to type 'IdealAnswer'.`

- [ ] **Step 3: Amplía el tipo**

En `src/types/game.ts`, línea 269, cambia:

```typescript
  idealAnswer?: IdealAnswer;
```

por:

```typescript
  /**
   * Dos formas, las dos vivas. El objeto es la original; el texto corrido es lo
   * que usan todas las sesiones escritas desde 2026 y lo que genera el asistente
   * (`functions/src/lib/sessionDraft.ts`). El prompt del juez le pasa un
   * `JSON.stringify` encima, asi que las dos llegan legibles.
   */
  idealAnswer?: IdealAnswer | string;
```

- [ ] **Step 4: Verifica que pasa**

```bash
npx tsc -b && npx vitest run src/types/game.test.ts
```

Esperado: `tsc` sin salida, y vitest con `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts src/types/game.test.ts
git commit -m "types: la respuesta ideal tambien es texto corrido"
```

---

## Task 2: El borrador sin respuesta ideal se rechaza

**Por qué:** `validateGeneratedDraft` corre sobre lo que devuelve el modelo, y si falla,
`generateSessionDraft` le manda el error de vuelta y reintenta una vez
(`functions/src/index.ts:2010`). Sin esta validación, gpt-4o se va a saltar los campos
apenas ande apretado de espacio, la sesión va a salir al aire igual, y sólo se va a
notar en los puntajes semanas después.

El piso son 80 caracteres de respuesta ideal y **un** ítem en cada lista. Es a
propósito bajo: el objetivo es pillar el campo ausente o un `"N/A"`, no discutirle el
conteo al modelo y quemar el reintento.

**Files:**
- Modify: `functions/src/lib/sessionDraft.ts:43-50` (el bucle `for (const s of scenarios)`)
- Test: `functions/src/lib/sessionDraft.test.ts`

- [ ] **Step 1: Escribe los tests que fallan**

Primero, en `functions/src/lib/sessionDraft.test.ts`, el helper `validDraft()` tiene que
producir escenarios completos, o **todos** los tests que ya existen se van a caer con el
error nuevo. Reemplaza el bloque `scenarios: [...]` (líneas ~39-43) por:

```typescript
    scenarios: [
      { id: 'r1', title: 'Ronda 1', prompt: 'p1', judgeFocus: 'f1', ...guiaValida() },
      { id: 'r2', title: 'Ronda 2', prompt: 'p2', judgeFocus: 'f2', ...guiaValida() },
      { id: 'r3', title: 'Ronda 3', prompt: 'p3', judgeFocus: 'f3', ...guiaValida() },
    ],
```

y agrega este helper justo antes de `function validDraft()`:

```typescript
function guiaValida() {
  return {
    idealAnswer: 'Una respuesta de ochenta puntos toma posicion, la justifica con un dato del material y nombra la restriccion que la vuelve dificil.',
    evaluationGuide: {
      must_hit: ['Toma una posicion explicita', 'La justifica con algo del material'],
      fatal_errors: ['Enumera consideraciones sin elegir', 'Inventa una cifra'],
    },
  };
}
```

Después, dentro del `describe('validateGeneratedDraft', ...)`, agrega estos cuatro tests:

```typescript
  it('rechaza un escenario sin idealAnswer', () => {
    const d = validDraft();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (d.scenarios[1] as any).idealAnswer;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/idealAnswer/i);
  });
  it('rechaza un idealAnswer de relleno', () => {
    const d = validDraft();
    d.scenarios[0].idealAnswer = 'N/A';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/idealAnswer/i);
  });
  it('rechaza un escenario sin evaluationGuide', () => {
    const d = validDraft();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (d.scenarios[2] as any).evaluationGuide;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/evaluationGuide/i);
  });
  it('rechaza listas vacias en evaluationGuide', () => {
    const sinMustHit = validDraft();
    sinMustHit.scenarios[0].evaluationGuide.must_hit = [];
    expect(validateGeneratedDraft(sinMustHit, validInput)).toMatch(/must_hit/i);

    const sinFatales = validDraft();
    sinFatales.scenarios[0].evaluationGuide.fatal_errors = ['   '];
    expect(validateGeneratedDraft(sinFatales, validInput)).toMatch(/fatal_errors/i);
  });
```

- [ ] **Step 2: Córrelos y verifica que fallan**

```bash
cd functions && npx vitest run src/lib/sessionDraft.test.ts
```

Esperado: los cuatro tests nuevos FALLAN (`validateGeneratedDraft` devuelve `null`,
`expected null to match /idealAnswer/i`). Los que ya existían siguen pasando, porque el
helper ahora trae los campos.

- [ ] **Step 3: Escribe la validación**

En `functions/src/lib/sessionDraft.ts`, agrega este helper justo encima de
`export function validateGeneratedDraft`:

```typescript
const esTextoUtil = (x: unknown): boolean => typeof x === 'string' && x.trim().length > 0;
```

y reemplaza el bucle de escenarios:

```typescript
  for (const s of scenarios) {
    if (!s?.id || !s?.title || !s?.prompt) return 'Cada escenario necesita id, title y prompt';
  }
```

por:

```typescript
  for (const s of scenarios) {
    if (!s?.id || !s?.title || !s?.prompt) return 'Cada escenario necesita id, title y prompt';

    // La respuesta ideal y la guia son la mitad que ancla al juez a ESTA pregunta;
    // la rubrica solo trae la escala. Sin ellas la sesion se publica igual y el
    // sintoma aparece semanas despues, en puntajes que no separan a nadie.
    // El piso es bajo a proposito: pilla el campo ausente y el "N/A", nada mas.
    if (!esTextoUtil(s.idealAnswer) || s.idealAnswer.trim().length < 80) {
      return `El escenario '${s.id}' necesita idealAnswer: 3-5 frases con lo que contestaria un alumno de 80 puntos`;
    }
    const guia = s.evaluationGuide;
    if (!guia || typeof guia !== 'object') {
      return `El escenario '${s.id}' necesita evaluationGuide con must_hit y fatal_errors`;
    }
    if (!Array.isArray(guia.must_hit) || !guia.must_hit.some(esTextoUtil)) {
      return `El escenario '${s.id}' necesita al menos un must_hit en evaluationGuide`;
    }
    if (!Array.isArray(guia.fatal_errors) || !guia.fatal_errors.some(esTextoUtil)) {
      return `El escenario '${s.id}' necesita al menos un fatal_errors en evaluationGuide`;
    }
  }
```

- [ ] **Step 4: Verifica que pasan**

```bash
cd functions && npx vitest run src/lib/sessionDraft.test.ts
```

Esperado: PASS, todos.

- [ ] **Step 5: Commit**

```bash
git add functions/src/lib/sessionDraft.ts functions/src/lib/sessionDraft.test.ts
git commit -m "feat(generador): rechaza el borrador sin respuesta ideal ni guia"
```

---

## Task 3: El prompt pide el material primero, y los dos campos

**Por qué:** hoy el JSON que se le pide al modelo va `config` → `scenarios` → `rubric` →
`knowledgeBase`, y el modelo escribe en ese orden. La respuesta ideal se escribiría
**antes** de existir el material del que tiene que salir. Dado vuelta el orden, la regla
del proyecto —el juego no afirma ningún hecho que no esté en el material— queda
funcionando sola. Importa más acá que en una sesión escrita a mano: un juez anclado a
una respuesta ideal inventada castiga al alumno que sí leyó.

**Files:**
- Modify: `functions/src/lib/sessionDraft.ts` (`buildGenerationPrompt`)
- Modify: `functions/src/index.ts:2014`
- Test: `functions/src/lib/sessionDraft.test.ts`

- [ ] **Step 1: Escribe los tests que fallan**

Dentro del `describe('buildGenerationPrompt', ...)` de
`functions/src/lib/sessionDraft.test.ts`, agrega:

```typescript
  it('pide la knowledge base ANTES que los escenarios', () => {
    // El modelo escribe el JSON en el orden en que se le pide. Si los escenarios
    // vinieran primero, la respuesta ideal se escribiria antes de existir el
    // material del que tiene que salir.
    const prompt = buildGenerationPrompt(validInput);
    expect(prompt.indexOf('"knowledgeBase"')).toBeGreaterThan(-1);
    expect(prompt.indexOf('"knowledgeBase"')).toBeLessThan(prompt.indexOf('"scenarios"'));
  });

  it('pide respuesta ideal y guia de evaluacion en cada escenario', () => {
    const prompt = buildGenerationPrompt(validInput);
    expect(prompt).toContain('"idealAnswer"');
    expect(prompt).toContain('"must_hit"');
    expect(prompt).toContain('"fatal_errors"');
  });

  it('prohibe inventar hechos fuera de la knowledge base', () => {
    const prompt = buildGenerationPrompt(validInput);
    expect(prompt).toMatch(/solo pueden usar hechos que esten en/i);
  });
```

- [ ] **Step 2: Córrelos y verifica que fallan**

```bash
cd functions && npx vitest run src/lib/sessionDraft.test.ts
```

Esperado: los tres nuevos FALLAN (`"knowledgeBase"` aparece después de `"scenarios"`;
`"idealAnswer"` no aparece).

- [ ] **Step 3: Reescribe el prompt**

En `functions/src/lib/sessionDraft.ts`, dentro de `buildGenerationPrompt`, reemplaza el
`return` completo — desde la línea `return \`Eres un diseñador instruccional...` hasta el
backtick de cierre y la llave que cierra la función — por esto. La constante
`dimensionExample` de más arriba no se toca. Fíjate en los tres cambios: `knowledgeBase`
sube al primer lugar de las claves, los escenarios ganan `idealAnswer` y
`evaluationGuide`, y hay un principio 6 y una regla dura nuevos:

```typescript
  return `Eres un diseñador instruccional experto en juegos educativos competitivos con evaluación por IA.

Diseña una sesión de juego para la plataforma ML2. Los estudiantes responden por escrito, bajo presión de tiempo, a escenarios desafiantes; tres jueces IA evalúan cada respuesta con una rúbrica.

DATOS DE LA SESIÓN:
- Título: ${input.title}
- Tema: ${input.topicDescription}
- Audiencia: ${input.audience}
- Número de rondas: ${input.roundCount}
- Minutos por ronda: ${input.roundMinutes}
- Idioma de todo el contenido: ${input.language}

PRINCIPIOS DE DISEÑO (síguelos estrictamente):
1. Cada escenario plantea un caso concreto con tensión real y pide una decisión o análisis específico, NO una pregunta de definición.
2. Los escenarios exigen tomar posición: elegir UNA opción y justificarla vale más que enumerar consideraciones.
3. La rúbrica premia especificidad, realismo y estructura; penaliza respuestas genéricas, listas sin posición y soluciones mágicas.
4. La knowledge base entrega el contexto mínimo que un estudiante necesita para responder bien (conceptos clave, datos del caso, definiciones) en 800-1500 palabras, formato markdown.
5. La dificultad crece levemente entre rondas.
6. Escribes la knowledge base PRIMERO y todo lo demás sale de ella. La respuesta ideal de cada ronda es lo que un alumno que leyó ese material podría efectivamente contestar.

RESPONDE SOLO CON UN JSON VÁLIDO con esta estructura EXACTA, y en ESTE ORDEN de claves:
{
  "knowledgeBase": "# Título\\n\\nContenido markdown de 800-1500 palabras...",
  "config": {
    "title": "${input.title}",
    "description": "Descripción de 1-2 líneas de la sesión",
    "roundCount": ${input.roundCount},
    "roundDurationSeconds": ${input.roundMinutes * 60},
    "bufferSeconds": 60,
    "conceptTags": ["3 a 6 tags en snake_case de los conceptos de la sesión"],
    "judges": [
      { "judgeId": "generic_specialist", "weight": 0.35 },
      { "judgeId": "generic_praxis", "weight": 0.35 },
      { "judgeId": "generic_teacher", "weight": 0.30 }
    ],
    "judgeConfig": {
      "generic_specialist": { "sessionLens": "Instrucción de 2-4 frases que le dice a este juez qué premiar y qué penalizar EN ESTA SESIÓN, adaptada al tema", "weightFormula": "score = <pesos> usando los ids de las dimensiones de la rúbrica, ej: score = 0.40 * dim_a + 0.35 * dim_b + 0.25 * dim_c" },
      "generic_praxis": { "sessionLens": "...", "weightFormula": "..." },
      "generic_teacher": { "sessionLens": "...", "weightFormula": "..." }
    }
  },
  "scenarios": [
    {
      "id": "r1_identificador",
      "title": "Título corto de la ronda",
      "prompt": "El escenario completo que ve el estudiante: contexto del caso (3-6 frases) + tarea específica con instrucciones de formato si aplica",
      "judgeFocus": "1-2 frases: qué deben priorizar los jueces al evaluar esta ronda",
      "idealAnswer": "3-5 frases EN PROSA con lo que contestaría un alumno de 80 puntos a ESTA ronda. Escríbela como la escribiría el alumno, no como una lista de requisitos: es la calibración de largo y de tono para los jueces.",
      "evaluationGuide": {
        "must_hit": ["2-3 cosas que una buena respuesta no puede dejar de decir"],
        "fatal_errors": ["2-3 errores que hunden la respuesta aunque esté bien escrita"]
      },
      "ranked": true
    }
  ],
  "rubric": {
    "globalInstructions": "Instrucciones globales para los jueces: qué premiar, qué penalizar, en 3-6 frases",
    "scoring": {
      "scaleLevels": [100, 80, 60, 40, 20, 0],
      "instructions": "Evalúa SOLO lo que está escrito."
    },
    "dimensions": [
      ${dimensionExample}
    ]
  }
}

REGLAS DURAS:
- Exactamente ${input.roundCount} escenarios.
- Exactamente 3 dimensiones en la rúbrica, con pesos que suman 1.0.
- Los weightFormula usan los MISMOS ids de las dimensiones.
- judges usa SOLO los judgeIds generic_specialist (rigor conceptual), generic_praxis
  (aplicabilidad y restricciones reales) y generic_teacher (comprension y claridad).
  Los sessionLens deben respetar ese reparto de lentes, no repetirse entre si.
- La respuesta ideal y los errores fatales SOLO pueden usar hechos que esten en la
  knowledgeBase que escribiste. Si un hecho no esta ahi, no lo menciones: cambia la
  respuesta ideal, no agregues el hecho. Nada de cifras, estudios ni porcentajes
  inventados.
- Todo el texto en ${input.language}.`;
}
```

- [ ] **Step 4: Verifica que pasan**

```bash
cd functions && npx vitest run src/lib/sessionDraft.test.ts
```

Esperado: PASS, todos.

- [ ] **Step 5: Sube el techo de tokens**

Son hasta 6 rondas con dos campos más cada una. En `functions/src/index.ts`, línea 2014:

```typescript
        max_tokens: 8000,
```

pasa a:

```typescript
        // 12000 y no 8000 desde que cada ronda trae ademas su respuesta ideal y su
        // guia de evaluacion. El techo de salida de gpt-4o es 16384.
        max_tokens: 12000,
```

- [ ] **Step 6: Verifica que la function compila**

```bash
cd functions && npm run build
```

Esperado: `tsc` sin errores. Deja `functions/lib/` actualizado, que **se commitea**
(el deploy lo necesita).

- [ ] **Step 7: Commit**

```bash
git add functions/src/lib/sessionDraft.ts functions/src/lib/sessionDraft.test.ts functions/src/index.ts functions/lib
git commit -m "feat(generador): la knowledge base primero, y respuesta ideal por ronda"
```

---

## Task 4: Los dos campos, editables en la pantalla de la sesión

**Por qué:** la respuesta ideal es la única parte del borrador que un profesor puede
evaluar de una mirada — si está mal, la sesión está mal. Las descripciones de niveles de
la rúbrica, en cambio, se leen todas parecidas. Hoy en esa pantalla sólo se puede tocar
el foco de los jueces.

**Nota sobre tests:** esta pantalla no tiene pruebas y no se le agregan acá; el repo
prueba lógica pura en `src/lib/*.ts`, no componentes de página. La verificación es
`tsc` + `eslint` + `npm run build` + mirarla corriendo (Step 5).

**Files:**
- Modify: `src/pages/professor/SessionEditor.tsx` (componente nuevo a nivel de módulo, `addRound` ~línea 242, bloque de ronda abierta ~línea 686)

- [ ] **Step 1: Agrega el componente `GuiaDeEvaluacionEditor`**

Va **a nivel de módulo**, no dentro de `SessionEditor`. El archivo ya explica por qué
en el comentario de `MediaEditor` (línea 35): un componente declarado durante el render
es un tipo nuevo en cada tecleo, React lo remonta y el input pierde el foco letra a
letra.

Pégalo justo después de la función `MediaEditor` (antes de `export default function SessionEditor`):

```tsx
/**
 * Las dos listas de la guia de evaluacion que genera el asistente. Las sesiones
 * escritas a mano llevan ademas `partial_credit` y `nice_to_have`: este editor no
 * los muestra pero los deja pasar intactos (el spread de `guia`), asi que abrir
 * una de esas sesiones aca no le borra nada.
 */
function GuiaDeEvaluacionEditor({
  guia,
  onChange,
}: {
  guia: AnyJson;
  onChange: (next: AnyJson) => void;
}) {
  const listas = [
    { key: 'must_hit', label: 'No puede faltar', hint: 'Lo que una buena respuesta tiene que decir.' },
    { key: 'fatal_errors', label: 'Errores que la hunden', hint: 'Lo que la deja abajo aunque este bien escrita.' },
  ];

  const items = (key: string): string[] => (Array.isArray(guia?.[key]) ? guia[key] : []);
  const escribir = (key: string, next: string[]) => onChange({ ...(guia ?? {}), [key]: next });

  return (
    <div className="space-y-4">
      {listas.map(({ key, label, hint }) => (
        <div key={key}>
          <label className="block text-sm text-ink-soft mb-1">{label}</label>
          <p className="text-xs text-faint mb-2">{hint}</p>
          <div className="space-y-2">
            {items(key).map((item, j) => (
              <div key={j} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => escribir(key, items(key).map((v, k) => (k === j ? e.target.value : v)))}
                  className={SMALL_INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => escribir(key, items(key).filter((_, k) => k !== j))}
                  className="text-faint hover:text-rose-400 transition-colors shrink-0"
                  aria-label={`Eliminar item de ${label}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => escribir(key, [...items(key), ''])}
            className="mt-2 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-700 font-semibold"
          >
            <Plus className="w-3 h-3" /> Añadir
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Muestra los dos campos en las rondas abiertas**

En `SessionEditor.tsx`, busca el bloque del foco de los jueces (~línea 686):

```tsx
                      <div>
                        <label className="block text-sm text-ink-soft mb-1">
                          Foco de los jueces en esta ronda
                        </label>
                        <textarea
                          value={scenario.judgeFocus || ''} rows={2}
                          onChange={(e) => updateScenario(i, 'judgeFocus', e.target.value)}
                          className={`${INPUT_CLASS} resize-none`}
                        />
                      </div>
```

Inmediatamente **después** de ese `</div>` de cierre (sigue estando dentro del `<>` de
la rama de ronda abierta), agrega:

```tsx
                      <div>
                        <label className="block text-sm text-ink-soft mb-1">
                          Respuesta ideal
                        </label>
                        <p className="text-xs text-faint mb-2">
                          Lo que contestaría un alumno de 80 puntos. Los jueces calibran
                          contra esto: si la escribió el asistente, léela antes de
                          publicar — una respuesta ideal inventada castiga al alumno que
                          sí estudió.
                        </p>
                        <textarea
                          value={typeof scenario.idealAnswer === 'string' ? scenario.idealAnswer : ''}
                          rows={4}
                          onChange={(e) => updateScenario(i, 'idealAnswer', e.target.value)}
                          className={`${INPUT_CLASS} resize-y`}
                        />
                      </div>

                      <GuiaDeEvaluacionEditor
                        guia={scenario.evaluationGuide}
                        onChange={(next) => updateScenario(i, 'evaluationGuide', next)}
                      />
```

El `typeof ... === 'string'` no es defensivo por si acaso: las sesiones viejas de
`ml2-2025` guardan ahí un objeto, y sin ese guardia React recibiría un objeto como
`value` de un textarea.

- [ ] **Step 3: Las rondas nuevas nacen con los campos**

En `addRound` (~línea 242), dentro del objeto que se agrega a `scenarios`, después de
`judgeFocus: '',` agrega:

```tsx
                idealAnswer: '',
                evaluationGuide: { must_hit: [], fatal_errors: [] },
```

- [ ] **Step 4: Verifica que compila y pasa el linter**

```bash
npx tsc -b && npx eslint src/pages/professor/SessionEditor.tsx
```

Esperado: las dos sin salida.

- [ ] **Step 5: Míralo corriendo**

```bash
npm run dev
```

Abre `/professor`, entra a un curso, abre una sesión con rondas abiertas y comprueba:
los dos campos aparecen bajo el foco de los jueces; escribir en la respuesta ideal no
pierde el foco entre letra y letra; «Añadir» agrega una línea; la X la borra; «Guardar»
no da error. En una sesión de `ml2-2025` (respuesta ideal en objeto) el textarea sale
vacío y la pantalla no se cae.

- [ ] **Step 6: Commit**

```bash
git add src/pages/professor/SessionEditor.tsx
git commit -m "feat(editor): respuesta ideal y guia de evaluacion por ronda"
```

---

## Task 5: Verificación completa y despliegue

- [ ] **Step 1: Las dos suites de tests**

```bash
npx vitest run
cd functions && npx vitest run
```

Esperado: las dos en verde. Antes de este plan la raíz iba en 651 tests; deberían ser
653 (los dos de `game.test.ts`).

- [ ] **Step 2: Build limpio**

```bash
npx tsc -b && npm run build && npx eslint .
```

Esperado: los tres sin errores.

> Si `npm run build` falla en un archivo que este plan no tocó, es trabajo sin
> commitear de otra sesión — no lo arregles acá. Construye el commit en un worktree
> aparte: `git worktree add /tmp/x HEAD` + symlink a `node_modules`, que es lo que hace CI.

- [ ] **Step 3: Despliega la function**

`firebase deploy` **siempre** falla desde `/mnt/c` (I/O de NTFS contra el timeout de 10 s
del CLI). Va por `/tmp`, con el procedimiento del `CLAUDE.md`:

```bash
rm -rf /tmp/functions-deploy
mkdir -p /tmp/functions-deploy/functions
cp firebase.json /tmp/functions-deploy/
echo '{"projects":{"default":"ml2-master-game"}}' > /tmp/functions-deploy/.firebaserc
cp functions/package.json functions/package-lock.json functions/tsconfig.json /tmp/functions-deploy/functions/
cp -r functions/src /tmp/functions-deploy/functions/src
cp -r functions/lib /tmp/functions-deploy/functions/lib
cd /tmp/functions-deploy/functions && npm ci
cd /tmp/functions-deploy && npx firebase deploy --only functions:generateSessionDraft
```

Esperado: `Deploy complete!`.

- [ ] **Step 4: Genera una sesión de verdad y léela**

Esto es lo único que puede decir si el cambio sirvió, y ninguna prueba lo reemplaza.
En `/professor`, crea una sesión con el asistente sobre un tema que conozcas, ábrela en
el editor y contesta tres preguntas:

1. ¿Cada ronda trae respuesta ideal y las dos listas?
2. ¿La respuesta ideal es **contestable** con lo que dice la knowledge base que generó,
   o menciona hechos que no están ahí?
3. ¿Se parece a lo que tú habrías escrito, o hay que reescribirla entera?

Si la 2 falla seguido, el problema es la regla dura del prompt (Task 3, Step 3) y hay
que endurecerla, no agregar validación.

- [ ] **Step 5: El frontend sale con el push**

```bash
git push
```

GitHub Actions despliega a Pages solo al llegar a `main`.

---

## Qué queda explícitamente fuera

- La rúbrica: sigue igual, la sigue escribiendo el asistente, sigue siendo lo que puntúa.
- Las sesiones que ya existen: nada se migra. `scripts/validate-content.cjs:375` sólo
  advierte cuando falta la respuesta ideal, y corre sobre `content/`, no sobre los
  borradores de Firestore.
- `referenceAnswer`: tiene su slot en el prompt del juez y ninguna sesión lo usa. Ni se
  le agrega ni se le quita nada.
- El modelo de la generación (`gpt-4o`): fuera de alcance.
- `partial_credit` y `nice_to_have`: existen en las sesiones escritas a mano y el
  asistente no los genera. Salen de conocer al curso, no del tema.
