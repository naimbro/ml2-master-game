# Diagnóstico — dataviz clase 7 (mutate / group_by / summarise)

**Juego `9XR4Z6` · 21-sep-2026 · 24 jugadores · 6 rondas abiertas de código R ·
nota 4,50/7** (12 notas sobre 15 respuestas de feedback).
Las seis rondas se jugaron: 6 escenarios escritos, 6 rondas en Firestore.

La nota más baja del año. Las anteriores del repo van de 5,79 a 6,4.

## La tabla

```
ronda  fmt   pal   pred   real  resid  tecleo  colg   reloj  ofrec  cierre   pedía    n
  R1   code    83    34s    31s    -3s     72s    9%    120s   120s    120s     90s   22
  R2   code    85    34s    37s    +3s     65s   57%    120s   120s    120s    105s   21
  R3   code   162    54s    40s   -14s    121s   33%    180s   180s    180s    180s   21
  R4   code   179    58s    54s    -4s     51s   55%    120s   120s    120s    135s   20
  R5   code   118    43s    44s    +1s     64s   62%    120s   120s    120s    120s   21
  R6   code   127    45s    41s    -4s    119s   14%    180s   180s    180s    165s   21
```

Presupuesto: **26,0 min** de diseño (14 min de relojes + 2 min × 6 rondas)
contra un techo de 20. Pared medida: 26,9 min, aproximada — falta `startedAt` y
sale de `createdAt`, que es cuándo se creó la sala.

## Qué pasó

**El reloj no alcanzó en R2, R4 y R5**: 57%, 55% y 62% del curso seguía
escribiendo en los últimos 20 segundos. R1 y R6 alcanzaron cómodas (9% y 14%) y
R3 quedó al borde (33%).

**Ningún enunciado confundía.** Los seis residuales están entre −14 y +3 s: cada
pregunta costó exactamente lo que su largo predice, y cuatro de las seis costaron
*menos*. Las preguntas de hoy no estaban mal redactadas — **estaban largas**, que
es un defecto distinto y con otra cura. R4 tenía **179 palabras** y la mediana del
curso pasó **54 de sus 120 segundos leyendo**, antes de teclear un carácter.

**Las tres rondas que no alcanzaron son exactamente las tres etiquetadas
`difficulty: medium`**, y las tres tenían 120 s. Las `hard` (R3, R6, con 180 s) y
la `easy` (R1) alcanzaron. En este curso, los 70 s de tecleo que `medium`
presupone no pagan una cadena de dplyr.

**Y dos de esas tres habrían pasado el validador de hoy.** R5 tenía 120 s escritos
contra 120 que pide `relojDerivadoAbierta()` —clavado— y aun así el 62% seguía
escribiendo. Sólo R4 estaba formalmente corta (120 escritos contra 135). *`pedía`
≤ `reloj` no es un certificado de que el reloj alcanzó.*

**El presupuesto ya no cabía antes de jugar**: 26,0 min contra 20, y sobraba una
ronda entera. No se cortó ninguna —las seis se jugaron—, así que el desborde no
se pagó perdiendo la última ronda: se pagó en el reloj de todas.

El anfitrión **no extendió ninguna ronda** (`roundExtensions` vacío) y ninguna
cerró antes: los seis `cierre` son iguales al reloj ofrecido.

## Los comentarios

15 respuestas, 14 con texto. **Las 14 hablan de tiempo.**

- **Faltó tiempo, sin más (14 de 14).** «Tiempo» · «Falta de tiempo en el juego»
  · «más tiempo». Uno lo cuantificó: *«Quizás un poco más de tiempo, a todas las
  preguntas 37 segundos más»* (L L, 7/7).
- **La lectura se comió el reloj (3).** *«muy poco tiempo contando la lectura del
  ejercicio»* (Amelia, 4/7) · *«Poco tiempo para responder y mucho contexto que
  leer, pero fuera de eso, preguntas bien desarrolladas»* (diego, 5/7).
- **El tecleo se comió el reloj (2).** *«Falto mas tiempo para escribir los
  códigos»* (Florencia, 5/7) · *«al ser tan especifica la respuesta, uno no logra
  teclear tan rapido»* (lucca, 6/7).
- **La redacción (1).** *«La redacción de las preguntas no es la mejor, demora
  mucho tiempo entender la pregunta»* (Ana, 3/7). **La medición no la respalda**:
  los seis residuales son planos o negativos. Lo que costó entender fue el largo,
  no las palabras.
- **Todas de desarrollo (1).** *«solo habían preguntas de desarrollo y el tiempo
  era muy poco»* (Fabiana, 2/7). Es un comentario de una persona sobre una
  decisión deliberada del curso; queda anotado, no concluido.

Nadie objetó el contenido ni dijo que algo no estuviera en la clase.

## Qué cambiar en el juego siguiente de dataviz

1. **Cuatro rondas, no seis.** Con abiertas de código de 150-180 s el techo de
   20 min son cuatro (12 min de relojes + 8 de overhead). Seis daban 26,0.
2. **Techo de 100 palabras por enunciado.** Tres de seis lo pasaron (127, 162,
   179). A 0,25 s/palabra, 179 palabras son 45 s de reloj gastados antes de
   escribir.
3. **No etiquetar `medium` una respuesta que es una cadena de dplyr.** Tres de
   tres `medium` se quedaron cortas; las `hard` alcanzaron. Si la respuesta
   encadena dos o más verbos, es `hard` desde el principio.
4. **No mirar sólo `pedía`.** Pasar el piso del validador no impidió que R5 se
   quedara corta. El número que manda después de jugar es `colg`.
5. **Repetir el diagnóstico con el próximo juego de este curso**, para ver si el
   tecleo de `medium` es de esta clase o del curso entero.
