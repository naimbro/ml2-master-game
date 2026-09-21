# Clase 7 — `mutate()`, agrupar y resumir

Control de código del lunes 21 de septiembre de 2026, al cierre de la clase
(arranca cerca de las 12:10, después de la presentación del Sprint 2). **Seis
rondas abiertas, todas de código, ~27 min de pared.** Nunca jugado.

Cubre el material de las clases 6 y 7, que **nunca se había preguntado**: la
clase 6 no jugó (el segundo bloque fueron las exposiciones de «la sala es una
redacción») y la clase 5 tampoco (no hay ningún juego suyo en Firestore, así que
sus rondas siguen sin quemar y la R3 se recicló como semilla de la R6 de hoy).

## De dónde sale cada ronda

| # | Ronda | Reloj | Pide | Ancla |
|---|-------|-------|------|-------|
| 1 | La columna que no venía | 120 s | 2 líneas de R | Cuaderno 7, A1 (forma 2) y ejercicio 3: `mutate(mujer = sexo == "Mujer")` |
| 2 | El promedio que salió NA | 120 s | castellano + 1 línea de R | Cuaderno 7, A2 («sin el `na.rm = TRUE` el promedio sale NA»); cuaderno 6, Parte 2 |
| 3 | La receta completa | 180 s | 4 líneas de R + castellano | Cuaderno 7, A4 (1999, 63,4%); cuaderno 6, control 1 (no hay 2020) |
| 4 | El grupo sin nombre | 120 s | castellano + 1 línea de R | Cuaderno 7, ejercicio 5 (`gse` vacío, 5 personas); cuaderno 6, control 3 y el `!= ""` del control 2 |
| 5 | El año que dio cero | 120 s | castellano + 1 línea de R | Cuaderno 7, ejercicio 6 (2005, 0,0%, `filter(anio == 2005) %>% count(chile_hoy)`); cuaderno 6, control 2 |
| 6 | Limpiar y comparar | 180 s | 3 líneas de R + 1 línea de R | Cuaderno 7, Parte C, ejercicios 9 y 10; cuaderno 5 (`10 min`, `as.numeric()`) |

Presupuesto: 840 s de relojes + 2 min por ronda de overhead medido = **26 min**.
Con la banda medida de 1,7× a 2,4× la suma de relojes: 23,8 a 33,6 min. Si el
día se porta como el peor de los siete juegos medidos, se pasa de las 12:40 y se
cae la R6 — por eso la R3 va al medio.

Las cifras se recalcularon contra los dos CSV el 20 de septiembre, no se
copiaron del prompt: 58,9% mujeres; 4.562 edades vacías; 46,7 de promedio; 1999
con 63,4% y 2010 con 27,1%; 32 años sin 2020; 2005 con `chile_hoy` vacío en las
4.515 personas; Auto 12 / Metro 6 / Micro o bus 15 con promedios 40,5 / 83,3 /
77,0 y porcentajes largos 9,1 / 50,0 / 66,7; `gse` vacío en 5 personas con 40,0
de edad promedio.

## Las decisiones que no son obvias

**Nueve semillas para seis lugares.** Naim propuso 1 → 4 → 3 → 5 → 7 → 9 (con la
numeración de su prompt). La 7 (`ifelse()`) se sacó esa misma noche porque
`ifelse()` no se pasa en clase aunque esté en el cuaderno; entró en su lugar el
grupo sin nombre del ejercicio 5, que cubre la idea «siempre `n()`» que la
sesión no tenía. Se cambió la 5 (`group_by()` solo) por la 8 (el año que
dio cero): después de escribir la receta completa en la R3, `summarise(personas =
n())` es una línea que acaban de teclear y el porqué está textual en el cuaderno.
La 8 exige juicio, sigue pidiendo una línea de R, y calza con el bloque del Sprint
2 que viene justo antes. La 6 (nueve personas del segmento E) quedó fuera porque
fue el encargo que un grupo expuso frente al curso en la clase 6. La 2 (un número
para toda la base) está contenida en la 1 y la 3.

**Todas piden DOS cosas, numeradas (1) y (2)**, igual que la clase 5. Las
semillas de Naim para la 1, la 3 y la 7 eran de una sola pieza; se les agregó la
segunda para mantener la forma: en la R1 la cuenta, en la R3 cuántas filas
devuelve (que es la idea de «una fila por grupo» que perdimos al sacar la semilla
5).

**La R2 dice que `edad` es numérica.** Sin eso, «la columna es texto» sería un
diagnóstico defendible (el `mean()` de texto también devuelve NA), y la rúbrica
estaría castigando una objeción razonable al enunciado. Con eso escrito, quien lo
dice está contradiciendo el enunciado.

**La R2 antes de la R6 regala el `na.rm = TRUE`.** Se dejó igual: la R6 cobra
además `as.numeric()`, el `group_by()` y el orden, y la ronda que enseña va antes
y la que se puede caer va al final.

**El lente es «¿corre y contesta bien?».** Hoy no hubo función nueva: fue repaso.
Cualquier escritura que produzca la tabla correcta vale 100 aunque no sea la del
cuaderno, y las rúbricas lo dicen con ejemplos marcados como no exhaustivos y
cerrando por el otro lado con qué NO cuenta. Lo que sí se cobra: el orden, los
nombres y valores tal cual, el `n()` con paréntesis, `==`, `|`, y el `na.rm =
TRUE` donde la columna tiene NA.

**La rúbrica hereda los tres techos de la clase 5** (entrega incompleta, código
que corre y contesta mal, código que no corre). El segundo tiene hoy más casos
que nunca y son justo las lecciones del cuaderno; están enumerados en la
penalización. La calibración de las cuatro respuestas sintéticas por ronda está
en el `_doc` de `rubric.json`.

## Después de jugar

```bash
npx tsx scripts/mc-clock.ts <CODIGO>        # ¿alcanzó el reloj? (>60% de la mediana = corto)
node scripts/judge-levels.cjs               # desnivel entre jueces
npx tsx scripts/game-feedback.ts dataviz_2026
```

Ninguna de estas seis rúbricas ha corregido una respuesta real, y la de la clase
5 tampoco. Los puntajes del `_doc` son predicciones.
