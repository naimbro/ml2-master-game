# Respuestas sintéticas — clase_03_dominios_preguntas_fuentes

Las cuatro respuestas por ronda abierta que pide el skill `autor-de-rubricas`,
con el puntaje esperado. **Escritas como las escribiría un alumno de primer año
en tres líneas desde el teléfono**, no como las escribiría un ayudante.

> ⚠️ Los puntajes de abajo salieron de aplicar a mano las anclas de `rubric.json`
> y la `weightFormula` de cada juez. **NO son la salida de los jueces reales**
> (gpt-5, gemini-2.5-pro, claude-sonnet-5): eso sigue sin medirse. Sirven para
> ver si la rúbrica separa, no para saber qué va a puntuar el panel.

Objetivo del skill: buena 75-90, mediana 50-65, engañosa 35-55, y **la de al
lado igual que la buena** — ésa es la que prueba si hay criterio o sólo una
lista.

Pesos por juez en esta sesión (`rigor` / `fuentes` / `claridad`):
especialista **0,30 / 0,50 / 0,20** · praxis **0,20 / 0,30 / 0,50** ·
profesor **0,50 / 0,30 / 0,20**.

---

## R5 · La CEP no tiene tu tema

**Buena.** «Le diría que no es que el tema no sirva, es que la CEP no pregunta
por cultura y nunca lo hizo. Mejor buscamos una encuesta que sí sea de cultura,
en vez de cambiarnos de dominio.»
→ rigor 80 · fuentes 80 · claridad 100 = **84 / 90 / 84**

**Mediana.** «La CEP no tiene cultura porque es una encuesta más general, de
problemas del país. Habría que ver qué otras opciones hay.»
→ rigor 60 · fuentes 60 · claridad 80 = **64 / 70 / 64**

**Engañosa.** «Yo creo que hay que evaluar bien la cobertura y los sesgos de la
fuente antes de descartarla, y ver si la periodicidad nos sirve. Con eso
decidimos si nos cambiamos o no.»
→ rigor 40 · fuentes 40 · claridad 50 (cae `respuesta_intercambiable`) =
**42 / 45 / 42**

Es la que importa: **usa las cuatro palabras de la clase y no aplica ninguna.**
Si algún juez la sube de 65, la rúbrica está premiando el vocabulario.

**La de al lado.** «La CEP mide qué problemas del país le preocupan a la gente, y
lo nuestro no es un problema del país, es participación cultural: esa encuesta
simplemente no fue hecha para eso. Buscamos una que sí lo sea.»
→ rigor 100 · fuentes 100 · claridad 100 = **100 / 100 / 100**

**Es correcta y no usa el marco que yo tenía en la cabeza.** No dice en ninguna
parte que «la ausencia es un hallazgo»: reencuadra el problema como herramienta
equivocada, que es igual de cierto sobre la CEP. Por eso el `judgeFocus` da el
criterio primero y marca los ejemplos como no exhaustivos. **Si un juez la manda
bajo 60, la lista se cerró de nuevo** — que es exactamente lo que pasó en la R8
de la clase 2.

## R7 · El titular del empleo

Desde el 15-ago la ronda **lleva el gráfico de la serie completa** al frente
(`c03_cep_empleo.png`), el mismo que se proyectó en clase. Eso agregó rutas
correctas que antes no existían —el rebote de 2025-2026, el pico de 2001, el
corte de 2020— y mató una que sí estaba en el `judgeFocus` viejo: «con dos años
sueltos no se sabe cómo fue el camino». Ahora se sabe, así que dejó de contar.

**Buena.** «El dato muestra que cada vez menos gente menciona el empleo como
principal problema del país. No muestra que les importe menos el trabajo: es una
encuesta de opinión sobre el país, no sobre la vida de cada uno.»
→ rigor 100 · fuentes 80 · claridad 100 = **90 / 94 / 94**

**Mediana.** «Muestra que el empleo bajó mucho como problema, de 26,5% a 2,2%.
Es una caída muy grande en poco más de veinte años.»
→ rigor 80 con techo 60 por `media_pregunta` · fuentes 40 · claridad 80 =
**54 / 64 / 58**

**Engañosa.** «Efectivamente el trabajo dejó de ser una prioridad para los
chilenos, probablemente porque mejoró la economía y hay menos desempleo que en
2001.»
→ rigor 20 · fuentes 20 · claridad 80 = **32 / 50 / 32**

**La de al lado.** «Lo que dice es qué problema del país nombra la gente, y el
empleo pasó a nombrarse mucho menos. Para saber si a la gente le dejó de importar
el trabajo habría que mirar otra cosa, porque la CEP mide opiniones sobre el país
y no lo que pasa con el empleo.»
→ rigor 100 · fuentes 100 · claridad 100 = **100 / 100 / 100**

Llega por una ruta distinta a la de la respuesta ideal: **no usa el mecanismo de
«cada persona nombra sólo tres problemas»**, que es el argumento más bonito de
esta ronda, y aun así es enteramente correcta. Tiene que puntuar igual o más que
la buena.

**La de al lado, segunda (la que nace del gráfico).** «Bajó de 26,5% a 2,2%,
pero en el gráfico se ve que en 2025 y 2026 vuelve a subir, así que ni siquiera
es una caída que siga. Y lo que muestra es qué nombran como problema del país,
no cuánto les importa su trabajo.»
→ rigor 100 · fuentes 80 · claridad 100 = **90 / 94 / 94**

Ésta **no se podía escribir antes de que la ronda tuviera el gráfico**, y es la
que confirma que la imagen sirve para algo más que decorar: usa un hecho que
sólo está en el dibujo. Si algún juez la castiga por «no estar en el material»,
el problema es que el `judgeFocus` no dijo con suficiente claridad que el
estudiante tiene la serie completa a la vista.

---

## Lo que la corrida a mano encontró

**1. Los pesos por juez estaban mal repartidos y dos jueces eran el mismo.** La
primera versión daba al especialista `0,50 rigor / 0,30 fuentes` y al profesor
`0,40 / 0,30`: los dos separados por diez puntos movidos entre rigor y claridad.
En las cuatro respuestas de R5 quedaban a 2 puntos o menos uno del otro — un juez
sobraba, y `verify-session-prompt.cjs` no lo habría pillado porque las fórmulas
eran literalmente distintas. Se reasignaron según la lente que cada uno declara:
el especialista mira **la fuente** (0,50 ahí), el praxis mira **si se entiende**
(0,50 en claridad), y el profesor mira **si entendió la idea** (0,50 en rigor).
Ahora la engañosa de R7 se abre 32 / 50 / 32, que es justo lo que debe pasar: al
lector de a pie una respuesta clara y equivocada le suena mejor que a los otros
dos.

**2. `media_pregunta` es la penalización que sostiene la R7.** Sin ella la
mediana —que lee bien y no dice nada de lo que no se puede concluir— flotaba a
70-75, cuando el `judgeFocus` promete que no pasa de 60. Con el techo sobre dos
dimensiones a la vez cae a 54-64. Es la misma penalización que la clase 2 tuvo
que agregar por el mismo motivo, y por eso viene copiada tal cual.

**3. Las dos respuestas «de al lado» llegan a 100 y eso es a propósito.** Las dos
rondas admiten más de una respuesta correcta, y el `judgeFocus` de las dos está
escrito criterio-primero con los ejemplos marcados como no exhaustivos y con una
línea explícita de qué **no** cuenta. Es la corrección del hallazgo 3 de la clase
2, donde una lista cerrada de cuatro límites castigó un quinto límite verdadero y
los tres jueces se abrieron en 46 / 80 / 94.

**4. El tope de las dos rondas abiertas va a empatar.** Una respuesta de tres
líneas puede llegar a 100 en las dos, que es exactamente lo que la rúbrica
promete. Eso lo resuelve la recalibración pareada —los duelos—, que sí corre
sobre rondas abiertas; no lo resuelve la rúbrica.

**Nada de esto está verificado contra jueces reales.** Los doce puntajes de
arriba son predicciones hechas a mano. La única forma de confirmarlos es jugar
las rondas 5 y 7 mandando a propósito estas respuestas — en particular **las dos
«de al lado»**, que son las que dicen si la lista quedó abierta.
