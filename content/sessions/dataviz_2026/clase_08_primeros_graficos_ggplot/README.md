# Clase 8 — Primeros gráficos con `ggplot2`

Control de código del lunes 28 de septiembre de 2026, al cierre de la clase.
**Cuatro rondas abiertas, todas de código, ~18 min de pared.** Nunca jugado.

Es la primera clase de `ggplot2`: ninguna ronda anterior del curso preguntó por
gráficos. La clase 7 sí se jugó (`9XR4Z6`, 21-sep); su R6 calculaba los minutos
promedio por transporte, y acá esa tabla se entrega hecha (`viajes`) y sólo se
pide dibujarla y terminarla.

## De dónde sale cada ronda

| # | Ronda | Reloj | Palabras | Pide | Ancla |
|---|-------|-------|----------|------|-------|
| 1 | Las tres piezas | 120 s | 41 | 1–2 líneas de R | Cuaderno 8, Parte 1 (celdas 5-13): datos + `aes()` + `geom_bar()`, el `+` y «el error más común de hoy» |
| 2 | ¿`geom_bar()` o `geom_col()`? | 165 s | 71 | castellano + código | Cuaderno 8, Parte 3: la tabla `viajes` y el cuadro `geom_bar()` / `geom_col()` |
| 3 | Terminarlo | 180 s | 99 | `labs()` con título, eje y, fuente | Cuaderno 8, Parte 5: el `labs()` del cuaderno y el control antes de mostrar |
| 4 | El histograma que no corre | 150 s | 64 | castellano + código | Cuaderno 8, Parte 2: `binwidth`, y el `stat_bin()` que falla sobre `horas_redes` |

Presupuesto: **615 s de relojes (10,25 min) + 2 min × 4 rondas = ~18 min**. Los
relojes salen de `relojDerivadoAbierta()`; R1 y R3 llevan 15 s sobre el piso.

## Las decisiones que no son obvias

**Cuatro rondas y no cinco.** Naim propuso 1 → 6 → 7 → 3 → 5 de sus ocho
semillas. Con cinco, la cuenta daba ~23 min: toda ronda con (1) y (2) es `hard`
(120 s de tecleo), y el diagnóstico de la clase 7 ya había medido que la fórmula
de pared acierta (26,0 predichos, 26,9 medidos). Quedaron fuera la 5 (diecisiete
puntos), la 4 (¿qué forma?), la 2 (el `+` que era `%>%`, que ya caza la R1) y
la 8 (color por grupo). **No hay ninguna ronda de puntos**: es el costo de cuatro.

**El orden cambió: la de `geom_col()` va ANTES de Terminarlo.** En el orden
original, Terminarlo mostraba el `ggplot(viajes, ...) + geom_col()` que la ronda
siguiente pedía escribir. Terminarlo quedó tercera de cuatro: si el bloque se
estira, se cae el histograma, no la ronda que importa.

**La R1 pide una sola cosa.** No se le inventó un (2) para mantener la forma: la
habría subido a `hard` (+45 s). La rúbrica lo sabe: el techo de entrega
incompleta no se aplica en la R1.

**El molde de la R1 es `ggplot(...) ...`, sin el `+`**, para no regalar la caza
principal del día.

**La R4 nombra `redes_num` en el enunciado.** Pedirla de memoria es la trampa que
se midió en la clase 4 (mediana 24 cuando había que recordar, 43 cuando el dato
estaba escrito). Lo que se pregunta es cuál usar y por qué.

**Los errores de R que no están en el cuaderno** (el de `geom_bar` sin
paréntesis, el de `stat_count()`, la barra única de 33, las sumas apiladas, el
`%>% labs()` que se come las columnas) se corrieron en R 4.3.3 con ggplot2 3.5.2
el 28-sep y viven **sólo en el knowledge base y en la rúbrica**, nunca en un
enunciado.

**`+` al comienzo de la línea de `labs()`** no corre en Colab, pero se cobra como
detalle (nivel 80): es un salto de línea escrito en un teléfono, y Naim pidió no
cobrar saltos de línea.

## Después de jugar

```bash
npm run diagnostico <CODIGO>
node scripts/judge-levels.cjs
```

Mirar sobre todo la R3 (la única de 99 palabras) y si la R1, `medium` con 120 s,
alcanzó: es la primera `medium` de código desde que la clase 7 midió que las tres
`medium` se quedaron cortas — aunque ésas eran cadenas de dplyr y ésta es una
línea.
