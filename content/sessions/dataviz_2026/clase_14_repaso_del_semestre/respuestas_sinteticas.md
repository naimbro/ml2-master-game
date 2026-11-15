# Respuestas sintéticas — clase 14, repaso del semestre

Para la **corrida en seco**: se juega la sesión con una sala de prueba y en cada
ronda abierta se manda a propósito una de estas respuestas. Así se calibra la
rúbrica con los jueces desplegados, sin pedir ninguna clave de API (ver
CLAUDE.md).

Al lado de cada una va el puntaje que la rúbrica **predice** con la fórmula del
juez especialista (0,75 · exactitud + 0,15 · completitud + 0,10 · claridad) y las
penalizaciones apagadas. **Son predicciones, no mediciones**: lo que hay que
mirar al jugar es si el ORDEN sale como está acá.

Para cubrir las cinco de una ronda hacen falta cinco cuentas, o cinco
corridas. Si hay una sola cuenta, mandar la **engañosa** y la **de al lado**:
la primera prueba que la rúbrica no premia vocabulario, la segunda que no
enumera.

Todo el código de abajo se corrió en el R del teléfono (webR, R 4.6.0,
ggplot2 4.0.3, dplyr 1.2.1) el 15-nov-2026, salvo la prosa.

## R3 · El filtro que miente

**Buena (100)**, la del cuaderno 5:
```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  filter(minutos_num > 60) %>%
  count(minutos_num)
```

**De al lado (100)**: convierte adentro del filtro y cuenta directo. Da 14.
```r
curso %>% filter(as.numeric(minutos_viaje) > 60) %>% nrow()
```

**Cercana (70)**: convierte bien pero filtra `>= 60`. Da 18.
```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  filter(minutos_num >= 60) %>%
  nrow()
```

**Con un error (55)**: crea la columna y no la usa. Corre y sigue dando diez.
```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  filter(minutos_viaje > 60) %>%
  count(minutos_viaje)
```

**Engañosa (28)**: el diagnóstico correcto, sin una línea de código.
> minutos_viaje es texto porque alguien puso 10 min, entonces R compara letra por letra y 130 queda antes que 60. Hay que pasarla a número primero.

## R5 · La etapa 3

**Buena (100)**:
```r
ggplot(delinc, aes(x = anio, y = porcentaje)) +
  geom_line() +
  scale_y_continuous(limits = c(0, 40)) +
  geom_hline(yintercept = 19, linetype = "dashed")
```

**De al lado (100)**: por etapas, como la clase 13, con `ylim()`.
```r
p <- ggplot(delinc, aes(x = anio, y = porcentaje)) + ylim(0, 40)
p <- p + geom_line()
p <- p + geom_hline(yintercept = 19, linetype = 2)
p
```

**Detalle (85)**: los tres rasgos, la referencia continua.
```r
ggplot(delinc, aes(x = anio, y = porcentaje)) +
  geom_line() +
  scale_y_continuous(limits = c(0, 40)) +
  geom_hline(yintercept = 19)
```

**Cercana (70)**: sin el eje fijo (el eje va de ~12 a ~32).
```r
ggplot(delinc, aes(x = anio, y = porcentaje)) +
  geom_line() +
  geom_hline(yintercept = 19, linetype = "dashed")
```

**Con un error (55)**: no corre (*`mapping` must be created by `aes()`*).
```r
ggplot(delinc, aes(x = anio, y = porcentaje)) +
  geom_line() +
  scale_y_continuous(limits = c(0, 40)) +
  geom_hline(19, linetype = "dashed")
```

**Engañosa (40)**: `problemas` en vez de `delinc`, y sin referencia.
```r
ggplot(problemas, aes(x = anio, y = porcentaje)) +
  geom_line() +
  scale_y_continuous(limits = c(0, 40))
```

## R6 · El título que falta

| Pred. | Respuesta |
|---|---|
| 100 | En 1994 empataban en 19%; hoy, 31% contra 3% |
| 100 | DE AL LADO: Salud y Educación son los únicos que no se movieron en 30 años |
| 85 | DETALLE: La delincuencia se duplicó desde 1994 |
| 70 | DIFUSA: Lo que preocupa a los chilenos cambió mucho |
| 55 | SÓLO EL TEMA: Principales problemas del país, 1994 y 2026 |
| 40 | ENGAÑOSA: La pobreza se disparó desde 1994 |

## R7 · La lámina del carrusel

**Buena (100)**:
```r
top5 <- problemas %>%
  filter(anio == 2026) %>%
  slice_max(porcentaje, n = 5)

ggplot(top5, aes(x = porcentaje,
                 y = reorder(problema, porcentaje))) +
  geom_col() +
  geom_text(aes(label = paste0(round(porcentaje), "%")), nudge_x = 2)
```

**De al lado (100)**: la forma de la clase 9 y todo en una cadena.
```r
problemas %>%
  filter(anio == 2026) %>%
  arrange(desc(porcentaje)) %>%
  head(5) %>%
  ggplot(aes(x = porcentaje, y = reorder(problema, porcentaje))) +
  geom_col() +
  geom_text(aes(label = porcentaje))
```

**Detalle (85)**: `n` sin nombrar (R lo pide, pero la intención es clara).
```r
top5 <- problemas %>%
  filter(anio == 2026) %>%
  slice_max(porcentaje, 5)

ggplot(top5, aes(x = porcentaje, y = reorder(problema, porcentaje))) +
  geom_col() +
  geom_text(aes(label = paste0(round(porcentaje), "%")))
```

**Completa con un error (55)**: las dos piezas; `label` fuera de `aes()` (no corre).
```r
top5 <- problemas %>%
  filter(anio == 2026) %>%
  slice_max(porcentaje, n = 5)

ggplot(top5, aes(x = porcentaje, y = reorder(problema, porcentaje))) +
  geom_col() +
  geom_text(label = porcentaje)
```

**Media respuesta (46)**: `top5` impecable, sin el número en las barras.
```r
top5 <- problemas %>%
  filter(anio == 2026) %>%
  slice_max(porcentaje, n = 5)

ggplot(top5, aes(x = porcentaje, y = reorder(problema, porcentaje))) +
  geom_col()
```

**Engañosa (55)**: sin el `filter()` del año (años mezclados, Pensiones 2019 arriba).
```r
top5 <- problemas %>%
  slice_max(porcentaje, n = 5)

ggplot(top5, aes(x = porcentaje, y = reorder(problema, porcentaje))) +
  geom_col() +
  geom_text(aes(label = paste0(round(porcentaje), "%")))
```

## El orden que hay que defender

- R7: completa-con-un-error (55) **por encima** de la media respuesta (46).
- R6: el difuso (70) > sólo el tema (55) > el falso (40).
- En las cuatro: la de al lado junto a la buena.

Si alguno sale dado vuelta con los jueces de verdad, se arregla en el ancla de
nivel, no subiendo una penalización.
