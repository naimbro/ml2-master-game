# Esquema de una sesión y sus trampas

Referencia de los archivos que escribe `autor-de-contenido`. Todo lo de acá está
verificado contra el repo; lo que falla, falla **en silencio**.

## Dónde vive cada cosa

```
content/courses/<courseId>/config.json        # metadatos del curso + lista de sessions
content/courses/<courseId>/judge_overrides.json
content/sessions/<courseId>/_shared/base_rubric.json   # opcional, anclas del curso
content/sessions/<courseId>/<sessionId>/
    config.json          # metadatos, jueces, judgeConfig
    scenarios.json       # las rondas — ARRAY PLANO en la raíz
    rubric.json          # dimensiones + penalties, UNA por sesión
    knowledge_base.md    # el material que leen los jueces
```

Un curso nuevo necesita además una entrada en `COURSES` y una por sesión en
`SESSIONS` en `src/lib/courses.ts`, con cuatro imports estáticos escritos a mano
(config, scenarios, rubric, knowledge_base con `?raw`). Es boilerplate y es
exactamente lo que se rompe sin avisar: `npm run build` es el que lo caza.

## `scenarios.json`

**Array plano en la raíz.** No `{sessionId, scenarios: []}` — el validador acepta
las dos formas, pero `courses.ts` hace `scenarios.length` y la envuelta deja
`rounds` en `undefined` sin error.

### Ronda abierta

```json
{
  "id": "mgt_c01_r2_algo",
  "order": 1,
  "title": "...",
  "category": "Lectura",
  "difficulty": "medium",
  "ranked": true,
  "durationSeconds": 180,
  "conceptTags": ["nombre_de_seccion_del_kb"],
  "judgeFocus": "...",
  "context": "...",
  "question": "...",
  "evaluationGuide": { "must_hit": [], "fatal_errors": [], "partial_credit": {}, "nice_to_have": [] },
  "idealAnswer": "..."
}
```

`judgeFocus`, `evaluationGuide` e `idealAnswer` los escribe el skill
**`autor-de-rubricas`**, no este.

### Ronda de opción múltiple

```json
{
  "type": "multiple_choice",
  "ranked": true,
  "durationSeconds": 62,
  "media": [{ "kind": "image", "src": "media/curso/x.png", "alt": "...", "credit": "..." }],
  "mcQuestions": [{
    "question": "...",
    "options": [{ "id": "A", "text": "..." }],
    "correctOptionIndex": 2,
    "timeLimitSeconds": 30,
    "explanation": "..."
  }]
}
```

- **UNA pregunta por escenario, no un bloque de tres.** Un escenario es una
  ronda, y `Results.tsx` muestra el leaderboard acumulado **al final de cada
  ronda**. Tres preguntas en un `mcQuestions` son una sola ronda: el ranking se
  actualiza una vez cada tres preguntas y se pierde el latido de Kahoot. Nueve
  preguntas se escriben como **nueve escenarios de una pregunta**, igual que
  `mundial_2026/kahoot_only`. Cuesta ~2 minutos de reloj (cada ronda paga su
  portada de 5 s y su holgura de 15 s) y ese es el precio del leaderboard por
  pregunta. Salió de la clase 1 de MGT300, que se jugó con bloques de tres.
- Se puntúa **en el cliente** (`src/lib/mcScoring.ts`), en la escala 0-100 de los
  jueces: correcta `70 + 30×velocidad`, contestada mal 20, sin contestar 0.
  **No pasa por los jueces ni por la recalibración pareada.**
- `durationSeconds` es **derivado**, nunca escrito a mano: `src/lib/mcTiming.ts`.
  El validador falla el build si no alcanza para el bloque.
- `correctOptionIndex` es base 0. Contarlo dos veces.
- **El reloj va por tipo de pregunta, no uniforme.** `timeLimitSeconds` es por
  pregunta justamente para esto. **20 s** para reconocer algo del texto (una
  cifra, un término, una cita); **30 s** cuando hay que discriminar entre cuatro
  explicaciones plausibles. En MGT300 clase 1 se usaron 30 s para las nueve y los
  alumnos pidieron acortarlas — con razón: **solo 1 a 3 personas de 42 dejaron
  cada pregunta sin responder**, así que el reloj sobraba en las fáciles.
- **La carga de lectura NO predice la dificultad — no perseguirla.** Medido en
  MGT300 clase 1: la pregunta de mayor carga (455 caracteres, 15,2 por segundo
  de reloj) sacó **88%** de acierto, y las dos que se cayeron a 43-45% tenían
  menos carga. Lo que las hundió fue conceptual: eran las dos únicas que pedían
  **clasificar o explicar un mecanismo** en vez de reconocer. Escribir preguntas
  más cortas no las habría arreglado. Una o dos de mecanismo por juego está bien
  y son las que enseñan; tres o más convierten el juego en una prueba.
- **Repartir las correctas entre A/B/C/D.** No hay barajado en runtime:
  `Round.tsx` renderiza `options` en orden. La clase 1 de MGT300 salió con
  A5/B4/C0/D0 y se sacaba 9 de 9 marcando siempre A o B. Al reordenar, ojo con
  las `explanation` que nombran letras ("B suena bien y es lo contrario"): hay
  que reescribirlas junto con el reorden o quedan apuntando a la alternativa
  equivocada, proyectada delante del curso.
- `explanation` se proyecta: es el momento de enseñar, no un pie de página.

## `media`

- Ruta **sin slash inicial** (`media/x.png`). Un `/media/x.png` 404ea **solo en
  producción**.
- `alt` obligatorio. Audio en `.mp3`: iOS Safari no reproduce Ogg.
- Los archivos van bajo `public/`.

## `config.json` de la sesión

- `judges[]` con `judgeId` y `weight`.
- `judgeConfig.<judgeId>.sessionLens` — la obsesión del juez en esta sesión.
- `judgeConfig.<judgeId>.weightFormula` — **obligatoria para los `generic_*`**.
  `defaultFormulas` en `functions/src/index.ts` solo conoce los tres judgeIds
  históricos; sin fórmula explícita los tres genéricos caen a los pesos de la
  rúbrica y dejan de distinguirse.
- Los jueces base viven en **Firestore `config/judges`**, no en
  `content/courses/*/judges.json`. Si un `judgeId` no está en ese doc,
  `activeJudges` queda vacío y las rondas abiertas **no se evalúan, en silencio**.
- `draft: true` deja la sesión fuera de la UI del profesor: sirve para dejar una
  carpeta a medio escribir sin que aparezca.

## `knowledge_base.md`

Es lo que el juez lee para poder juzgar. Los `conceptTags` de cada escenario
seleccionan secciones de este archivo: **si un tag no calza con ninguna sección,
el juez evalúa sin material y no da error**. `verify-session-prompt.cjs` caza
justo eso.

Sin resumen fiel del texto en el KB, no se puede juzgar fidelidad a un texto.

## Fuentes y licencias

El repo es público y se publica en GitHub Pages. **Nada con paywall se
commitea.** Material licenciado va a un directorio local en `.gitignore`; al KB
llegan solo extractos destilados. Lo que no se puede licenciar se recrea, no se
copia.

## Verificación

```bash
node scripts/validate-content.cjs <courseId>
node scripts/verify-session-prompt.cjs <courseId> <sessionId>
npm run build
```

`validate-content.cjs` sin argumentos valida todos los packs y la salida es
larga: pasarle el pack, o un `tail` esconde justo el que estás tocando.
