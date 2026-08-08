# Respuestas sintéticas — clase_02_primeros_pasos_r

Las tres respuestas por ronda abierta que pide el skill `autor-de-rubricas`, con
el puntaje esperado. **Escritas como las escribiría un alumno de primer año en
tres líneas desde el teléfono**, no como las escribiría un ayudante.

> ⚠️ Los puntajes de abajo salieron de aplicar a mano las anclas de `rubric.json`
> y la `weightFormula` de cada juez. **NO son la salida de los jueces reales**
> (gpt-5, gemini-2.5-pro, claude-sonnet-5): eso sigue sin medirse. Sirven para
> ver si la rúbrica separa, no para saber qué va a puntuar el panel.

Objetivo del skill: buena 75-90, mediana 50-65, engañosa 35-55.

---

## R4 · La comuna promedio

**Buena.** "Le diría que comuna no es un número, es texto, así que un promedio
ahí no significa nada. Lo que sí se puede reportar es cuánta gente vive en cada
comuna y cuál es la más frecuente. Yo pondría eso, diciendo sobre cuántas
respuestas está calculado."

**Mediana.** "Creo que no se puede porque las comunas no son números. Habría que
buscar otra forma."

**Engañosa.** "Hay que tener cuidado con esa variable y revisarla bien antes de
calcular el promedio, porque puede dar un resultado que no represente al curso."

## R8 · Describe el gráfico

**Buena.** "Casi todos usan iPhone: 360 de 458, contra 92 de Android, y las
otras dos casi no aparecen. Pero esto es sólo de estudiantes UAI que quisieron
contestar en 2022-2023, así que no se puede decir que los jóvenes chilenos usen
iPhone."

**Mediana.** "El gráfico muestra que la mayoría usa iOS, después Android, y
HarmonyOS y Otro casi nada."

**Engañosa.** "Este gráfico refleja claramente la preferencia de los jóvenes por
Apple, ya que la gran mayoría usa iPhone frente a Android."

---

## Lo que la corrida a mano encontró

**1. La mediana se iba a 75, cuando el `judgeFocus` dice que no debe pasar de
60.** El techo de "respondió sólo la mitad de la pregunta" vivía en el
`judgeFocus` y en `partial_credit`, que son prosa: mordían una dimensión y las
otras dos seguían dando 80, así que el ponderado flotaba hacia arriba. Se agregó
la penalización ejecutable `media_pregunta`, que aplica techo 60 sobre **dos**
dimensiones a la vez. La causalidad sin diseño salió de las penalizaciones
ejecutables y quedó en `globalPenalties` (se le sigue mostrando al juez), porque
en estas dos rondas medio-responder es mucho más probable que afirmar una causa.

**2. Las dos respuestas buenas llegan a 100.** El techo es alcanzable con tres
líneas, que es exactamente lo que la rúbrica promete, así que no se tocó. La
consecuencia es que el tope de las dos rondas abiertas va a empatar. Eso lo
resuelve la recalibración pareada —los duelos—, que sí corre sobre rondas
abiertas; no lo resuelve la rúbrica.

La engañosa funciona en las dos rondas sin cambios: cae a 37-38 en R4 (la
penalización `respuesta_intercambiable`) y a 48-56 en R8 (`amplia_el_sujeto`).
