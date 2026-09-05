# La respuesta ideal en el generador de sesiones

**Fecha:** 2026-09-05
**Estado:** aprobado, sin implementar

## El problema

El asistente que genera una sesión desde el panel del profesor
(`generateSessionDraft`) escribe el caso de cada ronda, un `judgeFocus` de una
línea, la rúbrica de tres dimensiones con sus seis niveles, y la knowledge base.
**No escribe ninguna respuesta ideal.**

Toda sesión escrita a mano sí la lleva, y lleva además una guía de evaluación por
pregunta: `content/sessions/mgt300_2026/clase_05_repaso_unidad_1/scenarios.json`,
`content/sessions/dataviz_2026/clase_05_arreglar_y_crear/scenarios.json` y
`content/sessions/ai_democracy_2026/clase_03_backlash/scenarios.json` las tienen
todas, en todas sus rondas.

El campo no hay que inventarlo: los jueces ya lo leen. `functions/src/index.ts:374`
llena el slot `{{evaluationGuide}}` con `scenario.evaluationGuide` y, si no hay,
cae a `scenario.idealAnswer`.

O sea: una sesión generada con el asistente llega a los jueces con la escala
—cómo se califica cualquier respuesta— pero sin nada contra qué medir *esta*
pregunta. Es exactamente el escenario donde los tres jueces se dispersan y todo
el curso termina en un puntaje del medio.

**No es una alternativa a la rúbrica: es la otra mitad.** La rúbrica dice cómo se
califica; la respuesta ideal dice qué contesta bien esta pregunta. Se descartó
explícitamente ofrecer «rúbrica *o* respuesta ideal» como opción: el motor de
puntaje necesita las dimensiones (el puntaje sale de `dimensionScores`, no del
texto del juez), y sesiones con criterios de formas distintas no se pueden
comparar entre clases del mismo curso.

## Qué se construye

### 1. El asistente escribe dos campos por ronda

En `buildGenerationPrompt` (`functions/src/lib/sessionDraft.ts`), cada escenario
del JSON pedido suma:

- `idealAnswer`: **texto corrido**, 3-5 frases, lo que contestaría un alumno de
  80 puntos. Calibra largo y tono.
- `evaluationGuide`: `must_hit` (2-3 ítems) y `fatal_errors` (2-3 ítems).

Los dos, no uno. En el prompt del juez la guía **manda sobre** la respuesta
ideal (`index.ts:374`): si el asistente escribiera sólo la prosa ocuparía ese
lugar y el juez perdería el detalle; si escribiera sólo la lista, se quedaría
sin referencia de cuánto se espera que el alumno escriba.

`partial_credit` y `nice_to_have` **no** los genera el asistente. Existen en las
sesiones escritas a mano y ahí se quedan: salen de conocer al curso, no del tema.

### 2. Se da vuelta el orden de generación

Hoy el JSON que se le pide al modelo va `config` → `scenarios` → `rubric` →
`knowledgeBase`, y el modelo escribe en ese orden. La respuesta ideal se
escribiría **antes** de existir el material del que tiene que salir.

El orden pasa a ser `knowledgeBase` → `config` → `scenarios` → `rubric`, con una
regla dura nueva en el prompt: la respuesta ideal y los errores fatales sólo
pueden usar hechos que estén en la knowledge base.

Es la regla del proyecto —cada pregunta sale de una slide concreta y el juego no
afirma ningún hecho que no esté ahí, tampoco en un distractor— puesta a
funcionar sin que nadie la vigile. Importa más acá que en una sesión escrita a
mano: un juez anclado a una respuesta ideal inventada castiga al alumno que sí
leyó el material.

### 3. Validación: sin los campos, la generación se rechaza

`validateGeneratedDraft` exige, en cada escenario, un `idealAnswer` no vacío y un
`evaluationGuide` con al menos un `must_hit` y un `fatal_errors`. Ya existe el
reintento con el error de vuelta al modelo (`index.ts:2009-2036`); esto se cuelga
de ahí.

Sin esta validación el modelo va a saltarse los campos apenas ande apretado de
espacio, la sesión va a salir al aire igual, y sólo se va a notar en los puntajes
—semanas después, si es que. Es la misma falla silenciosa que ya cubren el
verificador del prompt y el validador de contenido.

Por lo mismo sube `max_tokens` de 8000 a 12000 en la llamada de
`generateSessionDraft`: son hasta 6 rondas con dos campos más cada una, y el
techo de salida de gpt-4o es 16384.

### 4. Los dos campos quedan editables

En `SessionEditor.tsx`, debajo de «Foco de los jueces en esta ronda»
(línea ~687): un textarea para la respuesta ideal y una lista editable para
`must_hit` y `fatal_errors`, con un aviso de que la respuesta ideal la escribió
la IA y hay que leerla.

Es la única parte del borrador que un profesor puede evaluar de una mirada: si
la respuesta ideal está mal, la sesión está mal. Las descripciones de niveles de
la rúbrica, en cambio, se leen todas parecidas.

`addRound` (línea ~242) crea las rondas nuevas con los dos campos vacíos, igual
que hoy hace con `judgeFocus`.

### 5. El tipo se amplía

`IdealAnswer` está declarado como objeto (`keyPoints`, `expectedConcepts`,
`commonMistakes`) en `src/types/game.ts:298`, pero **todas** las sesiones reales
lo usan como texto corrido. El tipo pasa a `IdealAnswer | string`.

Es deuda que ya existe y que este cambio destapa. Ojo con el motivo: **hoy nada
falla**, porque `src/lib/courses.ts:117` carga los escenarios como `AnyJson` y el
tipo nunca llega a chequearse contra el contenido. El problema es que el tipo
miente sobre lo que hay en producción, y este cambio agrega una pantalla que lee
ese campo.

## Qué NO se toca

- La rúbrica: sigue igual, la sigue escribiendo el asistente, sigue siendo lo que
  puntúa.
- Las sesiones que ya existen: nada se migra.
- `referenceAnswer`: tiene su slot en el prompt del juez y ninguna sesión lo usa.
  No se le agrega ni se le quita nada.
- El modelo de la generación (`gpt-4o`): fuera de alcance de este cambio.

## Pruebas

`functions/src/lib/sessionDraft.test.ts` ya cubre `validateGeneratedDraft` con
esta forma; se le agregan los casos de los campos nuevos:

- Un borrador sin `idealAnswer` en un escenario se rechaza.
- Un borrador con `evaluationGuide` vacío se rechaza.
- Un borrador completo pasa.
- El prompt generado nombra la knowledge base antes que los escenarios.

Lo que ninguna prueba puede decir es si la respuesta ideal que escribió el modelo
es **correcta**. Eso se ve generando una sesión de verdad y leyéndola — vale acá
lo mismo que en la calibración de rúbricas.

## Despliegue

Dos cosas por separado:

- La function `generateSessionDraft`, por el camino de `/tmp` del `CLAUDE.md`.
- El frontend, que sale solo con el push a `main`.
