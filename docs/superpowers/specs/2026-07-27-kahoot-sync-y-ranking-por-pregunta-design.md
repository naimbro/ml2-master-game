# Kahoot: ranking por pregunta y arranque sincronizado

**Fecha:** 2026-07-27
**Estado:** implementado, pendiente de verificación jugando

## Problema

Reportado tras jugar `mundial_2026 / final_2026` con dos pantallas (profesor + alumno en incógnito):

1. Las dos primeras preguntas Kahoot se encadenan sin ranking entre medio.
2. En la última pregunta (Pelé/Maradona/Messi) el alumno tenía su propio botón
   "Empezar"; el juego no iba sincronizado entre pantallas.

Ambos síntomas tienen **una sola causa**: el avance de preguntas MC era local de cada
cliente, mientras todo el resto del juego se coordina por el doc del juego.

- `status`, `currentRound`, `roundStartTime`, `roundEndTime` los escribe el host y todos los
  clientes los leen.
- Pero dentro de una ronda MC, `Round.tsx` corría su propio `Date.now()`, sus propios
  `setInterval` y un gate local con botón "Empezar". Cada pantalla arrancaba su bloque cuando
  esa persona apretaba, y derivaba desde ahí.
- El leaderboard (`Results.tsx`) sólo aparece con `status === 'round_end'`, o sea **una vez por
  escenario** — y los escenarios de Mundial traían 2 preguntas cada uno.

## Diseño

### 1. Una pregunta = una ronda (contenido)

Cada escenario MC con N preguntas se parte en N escenarios de una pregunta. El ranking entre
preguntas sale de la maquinaria de rondas que ya existe, y el host ya controla el avance.

- `kahoot_only`: 5 → 9 rondas. `final_2026`: 5 → 7 rondas.
- La media de escenario (el himno, el diagrama táctico) queda en la ronda de **su** pregunta —
  la primera del bloque original. La media de pregunta viaja con su pregunta.
- `roundCount` y `durationSeconds` recalculados; `courses.ts` deriva `rounds` de
  `scenarios.length`, así que no necesita cambios.

### 2. Línea de tiempo compartida (`src/lib/mcTiming.ts`)

```ts
mcTimeline({ roundStartMs, nowMs, gateSeconds, questions })
  -> { phase: 'gate' | 'question' | 'feedback' | 'done', questionIndex, secondsLeft, questionStartMs }
```

Función pura. Todas las pantallas la calculan desde `game.roundStartTime`, que ya es compartido.
Desaparecen `mcStarted`, `mcGateLeft`, `mcQuestionStart`, `mcArmedQ`, `mcQuestionTimeLeft`,
`mcTimerRef` y el botón "Empezar". El único estado local que queda en `Round.tsx` es qué eligió
*este* jugador (`mcAnswers`, indexado por pregunta).

Consecuencia buscada: **el reveal es compartido**. Antes, quien respondía veía al instante si
acertó; ahora responder bloquea tu tile ("Respuesta enviada") y la respuesta correcta se revela
para todos cuando la pregunta cierra. Un jugador rápido ya no va una fase adelante del resto.

`isQuestionTimedOut` se elimina: la regresión que cubría (la pregunta 0 se marcaba agotada al
instante, juego F35LUA) es estructuralmente imposible ahora, porque en `t=0` la fase es `gate`.
El test equivalente vive en `mcTiming.test.ts`.

### 3. Gate según media

- Sin media: **5s**. Con media: **12s** (el clip de audio tiene que alcanzar a sonar).
- Con 9 rondas, un gate fijo de 12s serían 108s de pantalla muerta; con esta regla son 59s.
- `derivedMCRoundDuration(mcQuestions, media)` y el validador de contenido usan la misma fórmula.

### 4. Cierre anticipado de rondas MC (`useGame.ts`)

El host cierra la ronda cuando se cumplen **las dos**:

- la línea de tiempo dice `done` — o sea la respuesta correcta ya se mostró; nunca se corta el
  reveal; y
- todos los jugadores enviaron. Cada cliente envía al llegar a `done` aunque no haya respondido,
  así que en la práctica es "todos los que siguen conectados".

Un jugador desconectado deja el timer de ronda como respaldo. Sólo aplica a rondas MC: en las
abiertas el tiempo de pensar es el punto.

Sin esto, una pregunta de 20s dejaba ~25s de "esperando a que termine la ronda" en cada una de
las 9 rondas.

## Límite conocido

`roundStartTime` lo escribe el host con `Timestamp.now()` (reloj del host), y cada cliente lo
compara con su propio `Date.now()`. Un desfase de reloj entre dispositivos corre la línea de
tiempo de ese cliente. El timer de ronda ya tenía exactamente el mismo comportamiento, así que
no es una regresión, pero en una pregunta de 20s se nota más que en una ronda de 300s. Los
relojes de navegador suelen ir sincronizados por NTP dentro de 1-2s.

## Tests

`src/lib/mcTiming.test.ts` (16): fases y bordes de la línea de tiempo, la regresión de la
pregunta 0, límites por pregunta, bloque multi-pregunta, `roundStartMs` ausente, coherencia
entre dos pantallas desfasadas 400ms, y que `derivedMCRoundDuration` siempre cubre la línea
de tiempo completa.
