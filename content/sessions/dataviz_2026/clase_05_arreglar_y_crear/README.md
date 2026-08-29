# Clase 5 — Arreglar y crear columnas

Control de código del lunes 31 de agosto de 2026, después del bloque de
presentaciones del Sprint 1. **5 rondas, ~18 min de pared.** Nunca jugado.

No es un cierre lúdico: es la medición de si `dplyr` quedó. Por eso cuatro de las
cinco rondas son alternativas con código proyectado —*¿qué devuelve esto?* y
*¿cuál de estas cuatro líneas lo hace?*— y hay **una sola ronda abierta**.

## De dónde sale cada ronda

| # | Ronda | Tipo | Reloj | Ancla |
|---|-------|------|-------|-------|
| 1 | Filas por un lado, columnas por el otro | MC | 45 s | Cuaderno 5, ejercicio 1 (Android + `select`); Android = 5 se proyectó en la clase 4 |
| 2 | Dos iguales, no uno | MC | 50 s | Cuaderno 4, celda 6: *«el detalle que más errores causa en todo el curso»* |
| 3 | Diez, y eran catorce | abierta `code` | 180 s | Cuaderno 5, celdas 11-20 completas |
| 4 | El aviso rojo | MC | 45 s | Cuaderno 5, celdas 17-18: *«no es un error, es R avisando»* |
| 5 | Metro o micro | MC | 50 s | Cuaderno 5, Parte 4 y tabla de cierre |

Presupuesto: 506 s de relojes derivados + 2 min por ronda de overhead medido =
**18,4 min**. Arrancando 11:50, termina cerca de 12:08.

Las cifras se recalcularon contra `datos/encuesta_curso.csv`, no se copiaron del
briefing: 5 personas con Android; 6 en metro; 10 filas con el filtro sucio y 14
con la columna convertida; 1 `NA`; 18 Corto / 14 Largo; 21 en transporte público.

## Las decisiones que no son obvias

**R3 va al MEDIO, no al final.** R4 y R5 tocan `as.numeric()`, así que jugarlas
antes le regalaría el diagnóstico. Y si el bloque se estira, lo que se cae es R5
y no la ronda que importa. Es el mismo razonamiento por el que en la clase 4 R2
iba antes que R3.

**El arreglo ahora se exige, y eso invierte el lente del juez.** El `sessionLens`
de la clase 4 decía textualmente *«no exijas que sepa arreglarlo —convertir la
columna a número es la clase siguiente y no se ha enseñado—»*. Esa clase
siguiente es ésta. La rúbrica y el `judgeFocus` lo dicen ahora al revés, en
mayúsculas, porque un juez que arrastre el criterio viejo castiga exactamente la
mitad que la clase enseñó hoy.

**La media respuesta cambió de lado.** En la clase 4 la mitad que faltaba era el
peligro. Hoy el diagnóstico lo acaban de leer resuelto en el cuaderno y la mitad
que se va a caer es el código. El techo de 40 es el mismo; lo que cambia es cuál
mitad va a faltar, y está escrito en el nivel 40 y en el `judgeFocus`.

**La ronda de audiencia de la clase 4 se botó.** Era la única sin una línea de R,
y el encargo pedía que el peso estuviera en leer y escribir `dplyr`, no en la
metodología del sprint. El enganche con el proyecto lo hace la receta de la
Parte 5 del cuaderno, que el propio cuaderno llama «el motor del Sprint 2», y que
está en el knowledge base aunque ninguna ronda pregunte por ella.

**Cero imágenes, a propósito.** Las cinco rondas son código. En R3 cualquier
imagen le soplaría el diagnóstico al curso.

**Las correctas están repartidas B · C · — · D · A**, y en ninguna ronda la
correcta es la alternativa más larga: en las tres donde podría serlo, empata con
otra. Se sacaba 5 de 6 marcando la más larga en dataviz clase 2.

## La rúbrica

Hereda las tres dimensiones de la clase 4 (`exactitud` 0,60 · `completitud` 0,25
· `claridad` 0,15) y con ellas los dos arreglos que salieron de jugar la clase 3:
el doble cobro y la media respuesta. Se aparta en que **hay una sola ronda
juzgada y es híbrida** —pide prosa y código en la misma respuesta—, así que los
niveles hablan de «la parte en castellano» y «la parte de código» en vez de R2 y
R4.

Con las **penalizaciones apagadas**, que es como hay que calibrar, y con la
fórmula del especialista:

| Puntaje | Respuesta |
|---|---|
| 100 | diagnóstico + la cadena de tres líneas que devuelve catorce |
| 95 | *la de al lado*: sobrescribe la columna original y cierra con `nrow()` |
| 85 | diagnóstico a medio camino, código impecable |
| 55 | completa **con un error**: el nombre de columna con otra mayúscula |
| 49 | la cadena entera **sin** el `as.numeric()`: corre y sigue devolviendo diez |
| 46 | **media respuesta impecable**: el diagnóstico perfecto y ninguna línea de R |
| 40 | vocabulario correcto, diagnóstico equivocado (lo atribuye a NA) |

Los dos pares que importan: **55 > 46** (la completa con un error por encima de
la media respuesta impecable — el orden que la clase 3 tuvo dado vuelta) y
**95 ≈ 100** (la respuesta correcta que no es la del cuaderno no puede quedar
abajo, o la rúbrica está enumerando en vez de dar criterio).

Pesos por juez con `exactitud` ≥ 0,59 en los tres —0,75 / 0,60 / 0,60— para que
una respuesta equivocada pero bien escrita no pase de 65.

## Estado

Verde en un worktree limpio sobre `HEAD` (que es lo que hace CI): **666 tests de
vitest**, `tsc -b`, `npm run build`, `validate-content.cjs dataviz_2026` y
`verify-session-prompt.cjs`. `npm run lint` da lo mismo con y sin estos cambios
—47 errores, todos previos y ninguno de esta sesión—.

`RichTextContenido.test.tsx` recoge esta sesión sola, sin tocar nada: su glob es
`content/sessions/*/*/scenarios.json`. Las cuatro rondas de alternativas llevan
código con backticks y cercas, así que ése es el test que importa acá.

**Sin jugar, y sin mirar en un teléfono de verdad.** Lo que ningún chequeo puede
decir: si los relojes alcanzan, y qué puntaje va a poner el panel en R3. Después
de jugar:

```bash
npx tsx scripts/mc-clock.ts <CODIGO>          # ¿alcanzó el tiempo de las MC?
npx tsx scripts/game-feedback.ts dataviz_2026 # qué dijo el curso
node scripts/judge-levels.cjs <CODIGO>        # ¿quedaron parejos los jueces?
```

Si la mediana consumió más del 60% del límite en alguna MC, el reloj quedó corto.
Los relojes de R1 y R4 (45 s) son la primera vez que este curso corre una MC de
lectura de código con ese límite: son los dos que más conviene mirar.
