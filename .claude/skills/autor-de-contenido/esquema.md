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
- **El `context` del escenario NO se muestra en una ronda de alternativas.**
  `Round.tsx` lo renderiza en un solo lugar (la rama de rondas abiertas, junto al
  `question`); la rama MC dibuja la portada, el enunciado y las opciones, y nunca
  el contexto. Escribirlo no da error, no rompe ningún validador y se pierde
  entero — así que **todo lo que la pregunta necesita va DENTRO del `question`**,
  aunque quede largo. La carga de lectura no es el problema (ver más abajo);
  el enunciado que depende de un texto invisible sí.
- **La imagen de una MC va en dos lugares distintos y no dan lo mismo.** En el
  escenario (`scenario.media`) se muestra **solo en la portada**, antes de que
  aparezca la pregunta, y sube la portada de 5 s a 12 s. En la pregunta
  (`mcQuestions[i].media`) se muestra **junto al enunciado, mientras corre el
  reloj**, y deja la portada en 5 s. Si la imagen es el clima de la pregunta,
  va en la pregunta.
- **El reloj va por tipo de pregunta, no uniforme.** `timeLimitSeconds` es por
  pregunta justamente para esto. Tres tramos, y el tercero salió caro:

  | Qué pide la pregunta | Reloj |
  |---|---|
  | Reconocer algo del texto (una cifra, un término, una cita) | **20 s** |
  | Discriminar entre cuatro explicaciones plausibles | **30 s** |
  | Distinguir un **par mínimo** (ver abajo) o hacer una cuenta | **40 s** |

  En MGT300 clase 1 se usaron 30 s para las nueve y los alumnos pidieron
  acortarlas — con razón: solo 1 a 3 personas de 42 dejaron cada pregunta sin
  responder. **Esa conclusión no se puede generalizar y se generalizó:** dataviz
  clase 2 salió con relojes de 20 a 30 s y perdió **27 respuestas de 222**.

- **El par mínimo: dos alternativas hechas de las mismas palabras.** Es la
  trampa que ningún conteo de caracteres detecta. En dataviz clase 2:

  > **A** ✔ «Cuántas personas respondieron, y cuántas preguntas tenía el formulario»
  > **B** «Cuántas preguntas tenía el formulario, y cuántas personas respondieron»

  Con 25 s la mediana del curso consumió el **89% del reloj**, 16 de los 28 que
  contestaron apretaron en los últimos 3 segundos, 8 no alcanzaron, y el acierto
  se hundió al **43%** — indistinguible de tirar una moneda entre A y B.

  **Un par mínimo no es un defecto: es la pregunta que mejor separa a quien
  entendió de quien reconoció.** Lo que no puede es correr contra un reloj corto,
  porque obliga a releer las dos alternativas enteras y compararlas término a
  término. `scripts/validate-content.cjs` **falla el build** si un par mínimo
  lleva menos de 40 s.

- **La carga de lectura NO predice la dificultad — no perseguirla.** Medido dos
  veces, en cursos distintos, y las dos veces igual. En MGT300 clase 1 la
  pregunta de mayor carga (455 caracteres) sacó **88%** de acierto y las dos que
  se cayeron a 43-45% tenían menos carga. En dataviz clase 2 la pregunta con más
  caracteres por segundo de reloj (R1, 18,4) fue **la más fácil del juego**: 97%
  de acierto usando la mitad del reloj; la que se cayó al 43% tenía *menos*
  carga. Escribir preguntas más cortas no arregla nada, y peor: indexar el reloj
  al largo le habría dado más tiempo justo a la que no lo necesitaba.

  Lo que las hunde es conceptual — pedir **clasificar o explicar un mecanismo**
  en vez de reconocer. Una o dos de mecanismo por juego está bien y son las que
  enseñan; tres o más convierten el juego en una prueba.

- **Después de jugar, medir el reloj. Esto no es opcional.** El reloj se escribe
  a ojo y no hay forma de saber si estuvo bien hasta que treinta personas lo
  corran. Correr **`npx tsx scripts/mc-clock.ts <CODIGO>`** después de cada clase.

  **El número que manda es qué fracción del límite consumió la mediana del
  curso. Sobre el 60%, el reloj quedó corto.** El corte se ve limpio en dataviz
  clase 2 — las tres rondas bajo el umbral perdieron 2, 3 y 3 respuestas; las
  tres sobre el umbral perdieron 5, 6 y 8:

  | | R2 | R3 | R1 | R7 | R6 | R5 |
  |---|---|---|---|---|---|---|
  | % del reloj usado | 45% | 50% | 52% | 63% | 69% | **89%** |
  | respuestas perdidas | 3 | 2 | 3 | 6 | 5 | **8** |
  | acierto | 88% | 94% | 97% | 83% | 74% | **43%** |

  Subir el reloj **no alarga la clase**: el corte anticipado ya cierra la
  pregunta cuando contestaron todos. Sólo deja de castigar al que lee despacio.
  Después de editar `timeLimitSeconds`, correr
  `node scripts/recompute-mc-durations.cjs --write`.
- **Repartir las correctas entre A/B/C/D.** No hay barajado en runtime:
  `Round.tsx` renderiza `options` en orden. La clase 1 de MGT300 salió con
  A5/B4/C0/D0 y se sacaba 9 de 9 marcando siempre A o B. Al reordenar, ojo con
  las `explanation` que nombran letras ("B suena bien y es lo contrario"): hay
  que reescribirlas junto con el reorden o quedan apuntando a la alternativa
  equivocada, proyectada delante del curso.
- **La correcta tampoco puede ser la más larga.** Hermana del punto anterior y
  más difícil de ver: la alternativa correcta tiende a salir larga porque uno la
  escribe explicando, y las incorrectas salen cortas porque uno las despacha. En
  dataviz clase 2 quedó **la más larga en 5 de 6 rondas** — se sacaba 5 de 6
  marcando la más larga sin saber nada de la materia. Se arregla acortando la
  correcta y engordando un distractor, no al revés. Empatar largos está bien: lo
  que delata es que haya *una* más larga identificable. El chequeo, por ronda:

  ```js
  const L = q.options.map(o => o.text.length);
  L[q.correctOptionIndex] === Math.max(...L)   // si es true en varias rondas, hay que rebalancear
  ```

  De paso, comparar el largo máximo contra lo ya jugado: **104 caracteres** es la
  opción más larga que se ha proyectado (MGT300 clase 1). Por encima de eso no
  hay antecedente de que se lea en un teléfono.
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
