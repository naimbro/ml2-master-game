---
name: autor-de-rubricas
description: Use when writing or fixing how a game round gets scored — "escribir la rúbrica", "los jueces puntúan mal", "todos sacan el mismo puntaje", "el puntaje quedó muy alto/bajo", "los jueces no se ponen de acuerdo", "castigaron una respuesta que estaba correcta", "ajustar las anclas", or when touching judgeFocus, evaluationGuide, idealAnswer, rubric.json dimensions, penalties, sessionLens or weightFormula. Use right after the questions of a session are chosen, and before playing it.
---

# Autor de rúbricas

Escribe **una rúbrica por pregunta** sobre preguntas ya elegidas, y prueba cada
una contra respuestas sintéticas antes de guardarla.

## Corre después, nunca antes

Su insumo obligatorio es la pregunta final y el ancla de material de la que
salió. Criterios escritos sobre una pregunta que todavía se puede caer son
criterios que no la van a calzar. Las preguntas las escribe el skill
**`autor-de-contenido`**; este empieza cuando Naim ya eligió.

## Dónde vive "una rúbrica por pregunta"

El motor tiene **un solo juego de dimensiones por sesión**. Lo que sí es por
pregunta son tres campos del escenario:

| Campo | Qué es |
|---|---|
| `judgeFocus` | Qué mira el juez en **esta** pregunta. Manda sobre las instrucciones generales de la rúbrica si hay tensión. |
| `evaluationGuide` | `must_hit`, `fatal_errors`, `partial_credit`, `nice_to_have` |
| `idealAnswer` | La respuesta de 100, escrita como la escribiría un alumno |

Y a nivel de sesión, en `rubric.json`: `dimensions` (con `weight` y anclas
`level_100` … `level_0`), `penalties` y `globalInstructions`.

Si hay `_shared/base_rubric.json` en el curso, las anclas salen de ahí. **Pero
si ninguna ronda juzgada mide lo que describen las dimensiones del curso, se
escribe una rúbrica propia y se anota el porqué en un campo `_doc`** — pasó en
dataviz clase 1, donde las dimensiones del curso describían lectura de gráficos
y las dos rondas juzgadas eran comprensión lectora.

## Las tres respuestas sintéticas, y una cuarta

Para cada pregunta, escribir tres respuestas y **predecir el puntaje de cada
juez antes de guardar**:

- **Buena** — espera 75-90. Cumple casi todos los `must_hit`, sin errores
  fatales.
- **Mediana** — espera 50-65. Algo correcto, algo vago.
- **Engañosa** — espera 35-55. **La que importa.** Vocabulario correcto, lógica
  equivocada; o tan genérica que suena bien y no dice nada.

Y una cuarta, **obligatoria si la pregunta admite más de una respuesta
correcta**:

- **La de al lado** — espera lo mismo que la buena. Una respuesta correcta que
  **no es la que tenías en la cabeza**: otro límite igual de válido, otra métrica
  que también sirve, otra lectura que el dato sostiene. Es la única de las cuatro
  que prueba si escribiste un criterio o sólo enumeraste tu propia respuesta.

Señales de que la rúbrica está mal calibrada:

| Señal | Qué significa |
|---|---|
| La buena baja de 70 | Rúbrica demasiado dura |
| La engañosa sube de 65 | No discrimina: premia el vocabulario |
| **La de al lado baja de 60** | **La rúbrica enumera en vez de dar criterio** |
| Una penalización se dispara en la buena | Penalización mal escrita |
| Dos jueces dan casi lo mismo | Un juez sobra en esta ronda |

Una rúbrica no se prueba con una respuesta brillante ni con una pésima. Se
prueba en la zona gris, y en el borde: la respuesta correcta que no esperabas.

## Reglas duras

- **Nunca penalizar que objeten el enunciado.** Si un alumno escribe "esa
  premisa suena falsa", el problema es el enunciado, no la respuesta. Ya se
  castigó a alguien por notar una premisa inventada, y esa es la falla que
  hundió un juego a 3,0/7.
- **Toda lista de ejemplos la lee el juez como lista cerrada.** Aunque la
  escribas como ejemplos, si enumeras las respuestas aceptables el juez castiga
  la correcta que quedó fuera. En dataviz clase 2 el `judgeFocus` decía
  "cualquiera de esas *cuatro* versiones del límite cuenta": un alumno nombró una
  quinta verdadera y los tres jueces se abrieron en 46 / 80 / 94, con el más duro
  argumentando al revés para justificarse. Escribe siempre **el criterio primero
  y los ejemplos después**, marcados como no exhaustivos, y cierra por el otro
  lado diciendo qué NO cuenta. Un `judgeFocus` que enumera y un
  `evaluationGuide` cuyo `nice_to_have` acepta un caso más ya se están
  contradiciendo: los dos se editan juntos.
- **El largo pedido va en tres lugares**: el enunciado, el `globalInstructions`
  de la rúbrica y el `judgeFocus`. Si sale de uno, los jueces empiezan a esperar
  párrafos donde se pidieron cuatro líneas.
- **Decir explícitamente qué NO exigir.** Los alumnos escriben desde el teléfono
  en tres minutos: nada de ortografía perfecta, estructura, introducción ni
  vocabulario académico. Y si es la primera clase, no han leído nada del curso.
- **Máximo 3 penalizaciones duras**, cada una verificable leyendo el texto. Una
  penalización que exige saber algo que no está escrito no es verificable.
- **Dimensiones ortogonales**: si una respuesta no puede sacar alto en A y bajo
  en B, sobra una.
- **`weightFormula` explícita por juez**, obligatoria para los `generic_*`: sin
  ella caen a los pesos de la rúbrica y los tres jueces quedan idénticos.
- **`sessionLens` coherente**: distinto por juez, con vocabulario de esta sesión,
  y **que no afirme cosas falsas sobre la ronda** — hubo un `sessionLens` que
  decía que la ronda no entraba al ranking cuando sí entraba.
- **Los jueces hablan chileno neutro**: sin voseo argentino y sin chilenismo
  caricaturizado.

## Verificar

```bash
node scripts/verify-session-prompt.cjs <courseId> <sessionId>
node scripts/validate-content.cjs <courseId>
```

`verify-session-prompt.cjs` caza cuatro fallas silenciosas: `conceptTags`
huérfanos, `signalSchema` ausente, `weightFormula` faltante y perfiles de peso
repetidos. **Ninguna de las dos verifica si la rúbrica puntúa bien** — eso solo
lo dice una respuesta real. Decir cuáles rúbricas nunca han corregido nada.

Para calibrar contra partidas ya jugadas: `scripts/bt-rescore.ts` compara el
ranking de los jueces con Bradley-Terry.
