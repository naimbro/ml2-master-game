# Respuestas sintéticas — clase_03_dominios_preguntas_fuentes

Las cuatro respuestas por ronda abierta que pide el skill `autor-de-rubricas`,
con el puntaje esperado. **Escritas como las escribiría un alumno de primer año
en dos minutos y medio desde el teléfono**, no como las escribiría un ayudante.

> ⚠️ Reescrito el **17-ago-2026**, cuando R4 y R5 pasaron a ser rondas de código
> y las dimensiones cambiaron de `rigor_descriptivo / criterio_de_fuentes /
> claridad` a `exactitud / completitud / claridad`. Los puntajes viejos de la R5
> conceptual («La CEP no tiene tu tema») ya no aplican: esa ronda salió.

> ⚠️ Los puntajes de abajo salieron de aplicar a mano las anclas de `rubric.json`
> y la `weightFormula` de cada juez. **NO son la salida de los jueces reales**
> (gpt-5, gemini-2.5-pro, claude-sonnet-5): eso sigue sin medirse. Sirven para
> ver si la rúbrica separa, no para saber qué va a puntuar el panel.

Objetivo del skill: buena 75-90, mediana 50-65, engañosa 35-55, y **la de al
lado igual que la buena** — ésa es la que prueba si hay criterio o sólo una
lista.

Pesos por juez (`exactitud` / `completitud` / `claridad`):
especialista **0,75 / 0,15 / 0,10** · praxis **0,60 / 0,10 / 0,30** ·
profesor **0,60 / 0,30 / 0,10**.

---

## R4 · Las tres líneas del principio

**Buena.** Correcta con una arruga: un argumento que nadie pidió y otro nombre
de objeto, usado igual en las dos líneas.

```r
library(dplyr)
datos <- read.csv("...")
count(datos, transporte, sort = TRUE)
```

→ exactitud 80 · completitud 100 · claridad 100 = **85 / 88 / 88**

**Mediana.** Las tres líneas están y la estructura es perfecta, pero la columna
va con mayúscula: `Transporte` no existe en esta base y la línea no corre.

```r
library(dplyr)
curso <- read.csv("...")
count(curso, Transporte)
```

→ exactitud 40 (techo de `codigo_que_no_corre`) · completitud 100 ·
claridad 100 = **55 / 64 / 64**

**Engañosa.** Tres líneas, se ven bien, y ninguna guarda nada: `read.csv()` sin
asignar, y `count()` sin decir sobre qué base.

```r
library(dplyr)
read.csv("...")
count(transporte)
```

→ exactitud 20 · completitud 100 · claridad 80 = **38 / 46 / 50**

Es la que importa acá: **tiene la forma exacta de la respuesta correcta y no
corre ninguna de las tres líneas.** Si algún juez la sube de 60, está puntuando
la silueta y no el código.

**La de al lado.** Correcta, y ninguna de las tres líneas está escrita como el
cuaderno las mostró: `require()`, `=` en vez de `<-`, y el pipe.

```r
require(dplyr)
datos = read.csv("...")
datos |> count(transporte)
```

→ exactitud 100 · completitud 100 · claridad 100 = **100 / 100 / 100**

**Tiene que empatar o ganarle a la buena.** Si algún juez la baja porque «no es
como se enseñó», la rúbrica se cerró: el `judgeFocus` y la penalización
`codigo_que_no_corre` dicen las dos, explícitamente, que una escritura que
funciona vale igual aunque el cuaderno no la haya mostrado.

---

## R5 · Dos columnas, y de mayor a menor

**Buena.** Las dos líneas, canónicas.

```r
count(curso, transporte, sistema_operativo)
count(curso, comuna, sort = TRUE)
```

→ exactitud 100 · completitud 100 · claridad 100 = **100 / 100 / 100**

**Mediana.** Entrega sólo una de las dos, perfecta.

```r
count(curso, transporte, sistema_operativo)
```

→ exactitud 100 con techo 60 por `entrega_incompleta` · completitud 40 ·
claridad 100 = **61 / 70 / 58**

**Engañosa.** Tres líneas ordenadas, la de ordenar impecable, y el cruce
contestado como dos conteos sueltos. Responde otra pregunta.

```r
count(curso, transporte)
count(curso, sistema_operativo)
count(curso, comuna, sort = TRUE)
```

→ exactitud 40 · completitud 60 · claridad 100 = **49 / 60 / 54**

Ésta es **la respuesta que más va a aparecer**, y la que decide si la ronda
enseña algo: entrega *más* líneas que la buena y aun así no cuenta el cruce.
Está nombrada palabra por palabra en el `judgeFocus` y en `fatal_errors`.

**La de al lado.** Correcta por dos caminos que el cuaderno no mostró: el pipe
y `arrange(desc(n))` en vez de `sort = TRUE`.

```r
curso %>% count(transporte, sistema_operativo)
count(curso, comuna) %>% arrange(desc(n))
```

→ exactitud 100 · completitud 100 · claridad 100 = **100 / 100 / 100**

---

## R7 · El titular del empleo

La ronda no cambió; cambiaron las dimensiones bajo las que se puntúa, así que
los números están recalculados. `criterio_de_fuentes` desapareció como dimensión
propia y su contenido vive ahora dentro de `exactitud` y, sobre todo, dentro del
`judgeFocus` de esta ronda — que manda sobre la rúbrica.

**Buena.** «El dato muestra que cada vez menos gente menciona el empleo como
principal problema del país. No muestra que les importe menos el trabajo: es una
encuesta de opinión sobre el país, no sobre la vida de cada uno.»
→ exactitud 100 · completitud 100 · claridad 100 = **100 / 100 / 100**

**Mediana.** «Muestra que el empleo bajó mucho como problema, de 26,5% a 2,2%.
Es una caída muy grande en poco más de veinte años.»
→ exactitud 80 con techo 60 por `entrega_incompleta` · completitud 40 ·
claridad 80 = **59 / 64 / 56**

**Engañosa.** «Efectivamente el trabajo dejó de ser una prioridad para los
chilenos, probablemente porque mejoró la economía y hay menos desempleo que en
2001.»
→ exactitud 20 · completitud 80 · claridad 80 = **35 / 44 / 44**

**La de al lado.** «Lo que dice es qué problema del país nombra la gente, y el
empleo pasó a nombrarse mucho menos. Para saber si a la gente le dejó de importar
el trabajo habría que mirar otra cosa, porque la CEP mide opiniones sobre el país
y no lo que pasa con el empleo.»
→ exactitud 100 · completitud 100 · claridad 100 = **100 / 100 / 100**

**La de al lado, segunda (la que nace del gráfico).** «Bajó de 26,5% a 2,2%,
pero en el gráfico se ve que en 2025 y 2026 vuelve a subir, así que ni siquiera
es una caída que siga. Y lo que muestra es qué nombran como problema del país,
no cuánto les importa su trabajo.»
→ exactitud 100 · completitud 100 · claridad 100 = **100 / 100 / 100**

Usa un hecho que **sólo está en el dibujo**. Si algún juez la castiga por «no
estar en el material», el problema es que el `judgeFocus` no dijo con suficiente
claridad que el estudiante tiene la serie completa a la vista.

---

## Lo que la corrida a mano encontró

**1. Con las dimensiones de la versión anterior, un código que no corre sacaba
78-88.** Es el hallazgo que obligó a rebalancear todo. Una respuesta de código
ordenada saca 100 en `completitud` y 100 en `claridad` casi gratis: las tres
líneas están y se leen bien, aunque ninguna corra. Con la primera repartición
—`exactitud` 0,45— el piso de una respuesta equivocada quedaba en 55 puntos
antes de mirar el código.

El álgebra es simple y conviene dejarla escrita: si `exactitud` cae a 40 y las
otras dos quedan en 100, el puntaje es `100 − 60 × peso_exactitud`. **Para que
un código que no corre no pase de 65, ningún juez puede pesar `exactitud` bajo
0,59.** Por eso los tres la pesan 0,60 o más, y por eso `claridad` bajó a 0,15
en la rúbrica: en una sesión donde dos de tres rondas juzgadas son de código,
premiar que se vea ordenado es premiar la silueta.

**2. Las dos penalizaciones sostienen rondas distintas.** `entrega_incompleta`
sostiene la R5 y la R7: sin ella, media respuesta perfecta flotaba sobre 80.
`codigo_que_no_corre` sostiene la R4: sin ella, la columna con mayúscula sacaba
lo mismo que la respuesta correcta, que es exactamente la lección que la clase
enseñó y la que el juego dejaría de enseñar.

**3. `codigo_que_no_corre` está escrita al revés de como uno la escribiría.**
Más de la mitad de su texto dice qué **no** cae adentro —el pipe, `require()`,
`arrange(desc(n))`, `sort = T`, un paréntesis que falta— porque el riesgo real
no es que el juez perdone un error, es que castigue una escritura correcta que
el cuaderno no mostró. Es la corrección del hallazgo de la clase 2, donde una
lista cerrada de cuatro límites castigó un quinto verdadero y los tres jueces se
abrieron en 46 / 80 / 94.

**4. El praxis y el profesor empatan cuando `completitud` y `claridad` empatan.**
En la mediana de R4 los dos dan 64, y en la engañosa de R7 los dos dan 44. No es
un error de reparto: es aritmética inevitable cuando dos dimensiones con pesos
espejados toman el mismo valor. Donde importa sí se abren — en la mediana de R5
dan 70 y 58, y en la engañosa de R5, 60 y 54.

**5. Las tres rondas pueden empatar arriba en 100, y nada lo deshace.** Los
duelos se sacaron el 15-ago, así que el puntaje que manda es el del panel. En
las rondas de código esto es más agudo que en las de prosa: **la respuesta
correcta es una sola y varias personas la van a escribir bien.** Si el podio de
un curso de 33 queda con seis personas empatadas en el primer lugar, no es un
descuido de la rúbrica — es lo que pasa cuando se pregunta algo que tiene
respuesta correcta. La palanca, si molesta, es el reloj: el desempate natural de
una ronda de código es quién la escribió antes, y hoy el motor no lo usa.

**Nada de esto está verificado contra jueces reales.** Los puntajes de arriba son
predicciones hechas a mano. La única forma de confirmarlos es jugar las rondas
mandando a propósito estas respuestas — en particular **las «de al lado» de R4 y
R5**, que son las que dicen si los jueces aceptan una escritura correcta que el
cuaderno no mostró, y **la engañosa de R5**, que es la que más se va a repetir.
