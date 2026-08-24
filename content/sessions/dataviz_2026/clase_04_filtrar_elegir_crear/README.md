# Clase 4 — Filtrar, elegir y crear

Juego de cierre del lunes 24 de agosto de 2026. **5 rondas, ~19 min de pared.**
Nunca jugado.

## De dónde sale cada ronda

Todo el contenido está anclado en material que el curso proyectó ese día. Las
cifras están recalculadas contra los CSV reales, no copiadas del briefing.

| # | Ronda | Tipo | Reloj | Ancla |
|---|---|---|---|---|
| 1 | Cuál de las tres | MC | 40 s | Cuaderno, tabla de portada: `filter()` filas · `select()` columnas · `mutate()` agrega |
| 2 | Una sola cadena | abierta `code` | 150 s | Cuaderno, partes 2-4 y ejercicio 6 |
| 3 | Dos iguales, no uno | MC | 50 s | Cuaderno, celda 6: *«el detalle que más errores causa en todo el curso»* |
| 4 | Diez, y eran catorce | abierta | 165 s | Cuaderno, sección «Una trampa» |
| 5 | Una audiencia con puerta | MC | 50 s | Demo del Sprint 1, lámina 05 |

Presupuesto: 556 s de relojes + 2 min por ronda de overhead medido = **19,3 min**.
No cabía subir las abiertas a 180 s.

## Las decisiones que no son obvias

**R2 va ANTES que R3.** Las dos son la misma línea de `dplyr`. La revelación de
R3 muestra `filter(curso, transporte == "Metro")` escrito bien, así que jugarla
primero convertiría R2 en copiar. En este orden, R3 funciona como la corrección
de lo que acaban de escribir.

**No hay ronda de la trampa en alternativas.** El briefing proponía A4 (la trampa
como MC) *y* O3 (la trampa como abierta). Son la misma pregunta: la que fuera
primero regalaba la otra. Se quedó la abierta, porque la mitad que importa —que
**el error no dio ningún aviso**— no cabe en un distractor.

**Cero imágenes, a propósito.** Las cinco rondas son código o concepto. En R4
cualquier imagen le soplaría el diagnóstico al curso.

**`glimpse()` no aparece en ninguna parte**: está en el cuaderno de la clase 3
pero no se alcanzó a ver en sala.

**Nada de la clase 4 vieja.** El syllabus cambió el mismo 24 de agosto: `class()`,
los cuatro tipos de variable y «qué es un data frame» dejaron de ser tema y no
entran. Tampoco entra `as.numeric()` como *solución* a la trampa — eso es la
clase 5. Hoy la trampa sólo se diagnostica, y la rúbrica lo dice explícitamente.

## La rúbrica, y el error de calibración que corrige

Hereda las tres dimensiones de la clase 3 (`exactitud` 0,60 · `completitud` 0,25
· `claridad` 0,15, duales entre código y lectura) y se aparta en dos puntos, los
dos por lo que se midió jugando esa clase:

1. **El doble cobro.** En la clase 3, `codigo_que_no_corre` topaba exactitud *y*
   claridad. Un error se pagaba dos veces. Acá toca una sola dimensión, y
   `claridad` dice explícitamente que no mide corrección.
2. **La media respuesta.** En la clase 3, una línea de tres correcta sacó **61** y
   tres líneas con un error sacaron **52**. Indefendible: premia no arriesgarse.
   El arreglo está en el ancla de `exactitud` —media respuesta no pasa de 40—, no
   en una penalización, porque las penalizaciones se gatillan entre el 0% y el 4%
   de las veces.

Con las **penalizaciones apagadas**, que es como hay que calibrar:

| Puntaje | Respuesta |
|---|---|
| 100 | la cadena completa y correcta |
| 96 | correcta pero anidada, sin pipe (*la de al lado*) |
| 71 | corre y responde de más |
| 61 | completa **con un error** que no corre |
| 49 | **media respuesta impecable** |
| 33 | vocabulario correcto, diagnóstico equivocado |

El par que importa es 61 > 49, y va en ese orden.

Pesos por juez, todos con `exactitud` ≥ 0,59 para que una respuesta equivocada
pero bien escrita no pase de 65: 0,75 / 0,60 / 0,60.

## Lo que se cambió en la app para esta sesión

`RichText` no entendía backticks ni bloques de código, y el texto de las
alternativas ni siquiera pasaba por él. Con R3 —cuatro líneas de R que sólo se
diferencian en `=` contra `==`— eso convertía la ronda en un ejercicio de vista.
Ahora entiende `` `código` `` y la cerca de tres backticks, y las alternativas se
renderizan con él. Detalle en el encabezado de `src/components/RichText.tsx`.

## Estado

Verde: 664 tests de vitest, `tsc -b`, eslint, `validate-content.cjs` y
`verify-session-prompt.cjs`. Las clases nuevas sobreviven la purga de Tailwind
(verificado en `dist/`).

**Sin jugar, y sin mirar en un teléfono de verdad** — no hay navegador headless
en el repo. Lo que ningún chequeo puede decir: si los relojes alcanzan. Después
de jugar:

```bash
npx tsx scripts/mc-clock.ts <CODIGO>          # ¿alcanzó el tiempo de las MC?
npx tsx scripts/game-feedback.ts dataviz_2026 # qué dijo el curso
node scripts/judge-levels.cjs <CODIGO>        # ¿quedaron parejos los jueces?
```

Si la mediana consumió más del 60% del límite en alguna MC, el reloj quedó corto.
