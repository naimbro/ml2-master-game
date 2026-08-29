# Clase 5 — Arreglar y crear columnas

Control de código del lunes 31 de agosto de 2026, después del bloque de
presentaciones del Sprint 1. **4 rondas abiertas, ~18 min de pared.** Nunca
jugado.

No es un cierre lúdico: es la medición de si `dplyr` quedó. **Las cuatro rondas
son de texto libre y ninguna es de alternativas** — es el primer juego
enteramente abierto de este curso, y es una decisión de Naim: quiere medir lo
que escriben, no lo que reconocen.

## De dónde sale cada ronda

| # | Ronda | Reloj | Pide | Ancla |
|---|-------|-------|------|-------|
| 1 | Filas por un lado, columnas por el otro | 140 s | castellano | Cuaderno 5, ejercicio 1 (Android + `select`); Android = 5 se proyectó en la clase 4 |
| 2 | Metro y micro a la vez | 140 s | castellano + 1 línea de R | Cuaderno 5, Parte 4 (`&` y `|`) y cuaderno 4, celda 6 (`==` y las mayúsculas) |
| 3 | Diez, y eran catorce | 180 s | castellano + 3 líneas de R | Cuaderno 5, celdas 11-20 completas |
| 4 | El aviso rojo | 140 s | castellano | Cuaderno 5, celdas 17-18: *«no es un error, es R avisando»* |

Presupuesto: 600 s de relojes + 2 min por ronda de overhead medido = **18 min**.
Arrancando 11:50, termina cerca de 12:08.

Las cifras se recalcularon contra `datos/encuesta_curso.csv`, no se copiaron del
briefing: 5 personas con Android; 6 en metro y 15 en micro (21 en transporte
público, 12 en auto); 10 filas con el filtro sucio y 14 con la columna
convertida; 1 `NA`.

## Las decisiones que no son obvias

**Todas abiertas, y por eso son cuatro y no cinco.** Una ronda abierta cuesta el
triple de reloj que una de alternativas y además espera a los jueces, que es la
parte del juego que nadie presupuesta. Cinco abiertas no caben en el bloque: se
irían a 25 min y el juego se cortaría solo, perdiendo el final. La versión
anterior tenía 4 de alternativas + 1 abierta; al pasarlas todas a texto libre,
**la de `=` contra `==` y la de `&` contra `|` se fundieron en una sola** (R2),
porque abiertas las dos son «escribe la línea del filtro» y la de metro-o-micro
ya contiene el `==` con las comillas exactas que la otra probaba por separado.

**Las cuatro piden DOS cosas, numeradas (1) y (2).** Es la forma de la sesión y
es lo que hace que una sola rúbrica las cubra. También es de dónde va a salir el
error más común: media respuesta impecable, que tiene techo de 40 en exactitud.

**R3 va al MEDIO, no al final.** R4 toca `as.numeric()`, así que jugarla antes le
regalaría el diagnóstico. Y si el bloque se estira, lo que se cae es R4 y no la
ronda que importa. Es el mismo razonamiento por el que en la clase 4 R2 iba antes
que R3.

**El arreglo ahora se exige, y eso invierte el lente del juez.** El `sessionLens`
de la clase 4 decía textualmente *«no exijas que sepa arreglarlo —convertir la
columna a número es la clase siguiente y no se ha enseñado—»*. Esa clase
siguiente es ésta. La rúbrica y el `judgeFocus` lo dicen ahora al revés, en
mayúsculas, porque un juez que arrastre el criterio viejo castiga exactamente la
mitad que la clase enseñó hoy.

**La media respuesta cambió de lado.** En la clase 4 la mitad que faltaba era el
peligro. Hoy el diagnóstico lo acaban de leer resuelto en el cuaderno y la mitad
que se va a caer es el código. El techo de 40 es el mismo; lo que cambia es cuál
mitad va a faltar, y está escrito en el nivel 40 y en los `judgeFocus`.

**Cero imágenes, a propósito.** Las cuatro rondas son código. En R3 cualquier
imagen le soplaría el diagnóstico al curso.

## La rúbrica

Hereda las tres dimensiones de la clase 4 (`exactitud` 0,60 · `completitud` 0,25
· `claridad` 0,15) y con ellas los dos arreglos que salieron de jugar la clase 3:
el doble cobro y la media respuesta. Los niveles hablan de «la parte en
castellano» y «la parte de código» porque las cuatro rondas son híbridas en ese
sentido, aunque sólo R2 y R3 pidan R.

Los tres techos duros: `entrega_incompleta` (vale para las cuatro rondas),
`codigo_que_corre_y_contesta_mal` (sólo R2 y R3: el `as.numeric()` que falta, el
`&` que sigue ahí) y `codigo_que_no_corre` (sólo R2 y R3).

Calibración con las **penalizaciones apagadas**, que es como hay que calibrar, y
con la fórmula del especialista. Los dos pares que importan valen para las cuatro
rondas:

- **La completa-con-un-error por encima de la media-respuesta-impecable** (55 >
  49). Es el orden que la clase 3 tuvo dado vuelta, porque la respuesta
  incompleta gana gratis las dimensiones de forma.
- **La de al lado junto a la de 100** (95 ≈ 100). R2 es donde de verdad se pone a
  prueba: `filter(transporte != "Auto")` llega a las mismas 21 personas por un
  camino que el cuaderno no mostró, y si la rúbrica la castiga es porque está
  enumerando en vez de dar criterio.

## Estado

Verde en un worktree limpio sobre `origin/main` (que es lo que hace CI):
`tsc -b`, `npm run build`, los tests de vitest, `validate-content.cjs
dataviz_2026` y `verify-session-prompt.cjs`.

`RichTextContenido.test.tsx` recoge esta sesión sola, sin tocar nada: su glob es
`content/sessions/*/*/scenarios.json`. Los enunciados de R1, R2 y R4 llevan
bloques de código con cercas, así que ése es el test que importa acá.

**Sin jugar, y sin mirar en un teléfono de verdad.** Y ahora hay dos cosas que
ningún chequeo puede decir, no una:

1. **Si los relojes alcanzan.** 140 s para dos líneas —y en R2 para una línea de
   R además— nunca se ha probado en este curso. Todo lo que se sabe de relojes
   abiertos viene de rondas de 180 s.
2. **Qué puntaje va a poner el panel.** Las rúbricas de R1, R2 y R4 son nuevas y
   **nunca han corregido una respuesta real**; los puntajes del `_doc` son
   predicciones, no mediciones.

Y una tercera que sí se puede anticipar: **las cuatro rondas esperan a los
jueces**, no una. La cola medida es de 73 a 108 s por ronda. Si el panel se
demora, la ronda que se cae es R4.

Después de jugar:

```bash
npx tsx scripts/game-feedback.ts dataviz_2026   # qué dijo el curso
node scripts/judge-levels.cjs <CODIGO>          # ¿quedaron parejos los jueces?
npx tsx scripts/bt-rescore.ts <CODIGO>          # ¿el ranking de los jueces se sostiene?
```
