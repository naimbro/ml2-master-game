# Clase 10 — Tres variables y un titular

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 10 de 15, lunes 19 de octubre de
2026. Estudiantes de primer año, de ciencias sociales y negocios.

Es su **tercera clase con `ggplot2`** (la librería se estrenó en la clase 8) y
**la primera con una tercera variable**: `color =` dentro de `aes()` y
`facet_wrap()`. El juego cierra la clase, después de las exposiciones del
ejercicio de redacción, y es corto: **dos rondas**.

**R1 pide UNA sola cosa en código** (el gráfico con una línea de color por
problema): ahí no existe la media respuesta. **R2 pide DOS casos numerados (1) y
(2) en castellano**, y en cada uno la elección (`color =` o `facet_wrap()`) y el
porqué en una línea. En R2 **media respuesta no puede pasar de 40 en Exactitud**.

**El estándar de R1 es «¿corre y dibuja lo que se pidió?»**: lo evaluable es si
el código, pegado en un Colab que ya tiene `cuatro` y `ggplot2` cargados, dibuja
cuatro líneas de cuatro colores. **El estándar de R2 es «¿usa el criterio de la
clase?»** (lámina 6, abajo), sin vocabulario técnico.

La respuesta se escribe en dos minutos desde un teléfono. **Escribir más no sube
el puntaje.** No se cobra indentación, tipo de comillas, saltos de línea,
`theme_minimal()`, `labs()`, ni un paréntesis de cierre que falta cuando la
intención es inequívoca.

Si un estudiante objeta el enunciado, eso **no se penaliza nunca**. Si tiene
razón, el problema es del enunciado.

## Lo que este curso ha visto, y nada más

**De `dplyr`** (clases 2 a 7): `library()`, `read.csv()`, `count()`, `select()`,
`filter()` (hoy con `%in%`), `mutate()`, el pipe `%>%`, `group_by()`,
`summarise()`, `arrange()`.

**De `ggplot2`**, clases 8 a 10: `ggplot()`, `aes()` con `x`, `y` y `color`,
`geom_bar()`, `geom_col()`, `geom_histogram()`, `geom_point()`, `geom_line()`,
`labs()` con `title`, `x`, `y` y `caption`. **Hoy, en el deck:** el color fijo
fuera de `aes()` (`geom_line(color = "#C4878C")`, lámina 3), `color = problema`
dentro de `aes()` (lámina 4), `facet_wrap(~ problema, ncol = 2)` (lámina 5),
`group = problema` y `geom_line(data = ...)` para destacar dos líneas sobre el
resto en gris (lámina 8). Todo eso SÍ se mostró: no es «algo que no se ha
visto».

**No entraron hoy** y ninguna ronda los pide: `ifelse()`, `facet_grid()`,
`scale_color_manual()`, `theme()`, `fill =`. **Si un estudiante usa cualquiera
de ellos y el gráfico corre y dibuja lo pedido, es igual de legítimo y vale lo
mismo.** La lista dice lo que no se exige, no lo que está prohibido.

Y **no van a ver inferencia estadística en ningún momento del curso**: nada de
tests, valores-p, intervalos de confianza ni regresión. Invocarlos no suma.

**Regla de arbitraje, y manda sobre cualquier lista.** Si un estudiante responde
con algo correcto que no se enseñó —`colour =`, el `aes()` adentro de la
geometría, `data =` y `mapping =` explícitos, el pipe que entra al `ggplot()`—
**vale igual**. La pregunta es siempre si corre y dibuja lo pedido.

## Los datos: la serie CEP de problemas, por año

`cep_problemas_por_anio.csv`, la serie que conocen desde la clase 6. Tres
columnas: `anio`, `problema`, `porcentaje` (el % que nombra ese problema como
primer problema). En el código del deck la tabla se llama `problemas`. Va de
1994 a 2026, **sin 2020** (así lo dice el `caption` de las láminas: «Fuente: CEP
1994-2026, sin 2020»).

<!-- section: color_tercera_variable -->

## `color =`: la tercera variable en el mismo plano (láminas 3 y 4)

**Lámina 3 · Dos variables, lo que ya sabían.** Una serie, un eje x, un eje y:

```r
delinc <- problemas %>%
  filter(problema == "Delincuencia, asaltos y robos")

ggplot(delinc, aes(x = anio, y = porcentaje)) +
  geom_line(color = "#C4878C") +
  geom_point(color = "#C4878C") +
  labs(
    title = "La delincuencia, de 19% a 31%",
    x = NULL,
    y = "% que la nombra primer problema",
    caption = "Fuente: CEP 1994-2026, sin 2020")
```

Ahí el `color` va **fuera** de `aes()` y es un **color fijo**: pinta todo del
mismo rosa.

**Lámina 4 · `color =`.** Bajada de la lámina: *«Para comparar pocos grupos:
¿quién va arriba?»*

```r
cuatro <- problemas %>%
  filter(problema %in% c(
    "Delincuencia, asaltos y robos",
    "Salud", "Pobreza", "Empleo"))

ggplot(cuatro, aes(x = anio, y = porcentaje,
                   color = problema)) +
  geom_line() +
  labs(
    title = "La pobreza bajó; la delincuencia subió",
    x = NULL, y = "% primer problema",
    caption = "Fuente: CEP 1994-2026, sin 2020")
```

**La columna va DENTRO de `aes()`**: así `ggplot2` dibuja una línea por cada
valor de `problema`, cada una de un color, y arma la leyenda solo. `cuatro`
tiene **128 filas: 32 años por cada uno de los 4 problemas**.

Los números que la lámina 4 muestra en sus extremos:

| Año | Delincuencia | Pobreza | Salud | Empleo |
|---|---|---|---|---|
| 1994 | 19,00 | 18,80 | 13,44 | 10,90 |
| 2026 | 31,45 | 3,27 | 13,17 | 4,71 |

### Qué pasa con cada escritura de la R1 (verificado en R 4.3.3 con ggplot2 3.5.2, 19-oct-2026)

Esto no está entero en el deck: se corrió para saber qué hace cada variante, y
sirve para juzgar.

| Código | Qué pasa |
|---|---|
| `ggplot(cuatro, aes(x = anio, y = porcentaje, color = problema)) + geom_line()` | **Corre**: 4 líneas, 4 colores, con leyenda |
| `aes(..., colour = problema)` | Corre y dibuja lo mismo |
| `ggplot(cuatro, aes(x = anio, y = porcentaje)) + geom_line(aes(color = problema))` | Corre y dibuja lo mismo |
| `cuatro %>% ggplot(aes(x = anio, y = porcentaje, color = problema)) + geom_line()` | Corre y dibuja lo mismo: el pipe entra al `ggplot()` |
| `ggplot(cuatro, aes(x = anio, y = porcentaje)) + geom_line()` (sin `color`) | **Corre y contesta mal**: UNA sola línea que salta entre los cuatro problemas de cada año |
| `aes(..., color = "problema")` (con comillas) | **Corre y contesta mal**: la misma línea única en zigzag, de un solo color |
| `geom_line(color = problema)` (fuera de `aes()`) | **No corre**: *objeto 'problema' no encontrado* |
| `ggplot(...) %>% geom_line()` | **No corre**: *`mapping` must be created by `aes()`. Did you use `%>%` or `\|>` instead of `+`?* |
| `+ geom_line` (sin paréntesis) | **No corre**: *Did you forget to add parentheses, as in `geom_line()`?* |
| `aes(..., color = Problema)` | **No corre**: *objeto 'Problema' no encontrado* |
| `aes(..., group = problema)` o `aes(..., linetype = problema)` sin `color` | Corre: 4 líneas, **todas del mismo color**. Cerca, pero no lo pedido |
| `aes(..., fill = problema)` + `geom_line()` | Corre: 4 líneas del mismo color (una línea no tiene relleno) |
| `+ facet_wrap(~ problema)` sin `color` | Corre: 4 paneles, una línea en cada uno, sin colores. Cerca, pero no lo pedido |

<!-- section: color_o_facetas -->

## `facet_wrap()`: un panel por grupo (lámina 5)

Bajada de la lámina: *«Para muchos grupos, o cuando importa la forma de cada
uno.»*

```r
ocho <- problemas %>%
  filter(problema %in% c(
    "Delincuencia, asaltos y robos",
    "Salud", "Pobreza", "Empleo",
    "Educación", "Sueldos",
    "Corrupción", "Vivienda"))

ggplot(ocho, aes(x = anio, y = porcentaje)) +
  geom_line(color = "#C4878C") +
  facet_wrap(~ problema, ncol = 2) +
  labs(
    title = "Sólo la delincuencia subió con fuerza",
    x = NULL, y = "% primer problema",
    caption = "Fuente: CEP 1994-2026, sin 2020")
```

`facet_wrap()` lleva la columna **con `~`**: `facet_wrap(problema)` sin la `~`
no corre (*objeto 'problema' no encontrado*, verificado en R).

## Color o facetas: el criterio (lámina 6)

Textual de la lámina:

- **`color =`**: dos a cuatro grupos que se comparan en el mismo eje. Se ve
  quién va arriba y dónde se cruzan.
- **`facet_wrap()`**: muchos grupos, o cuando importa la forma de cada uno.
  Todos los paneles comparten el eje.
- **La prueba**: si para leer el gráfico hay que ir y volver a la leyenda,
  pasen a facetas.

Es el criterio contra el que se juzga la R2. Para los dos casos de la ronda:

- **(1) Delincuencia y pobreza en el mismo eje, ¿quién va arriba y dónde se
  cruzan?** → `color =`: son dos grupos, la pregunta es una comparación en el
  mismo eje, y el cruce sólo se ve si las dos líneas están en el mismo plano.
  En 1994 estaban casi empatadas (19,00 contra 18,80), y la lámina 8 lo dice en
  su título.
- **(2) Cómo se movió cada uno de ocho problemas** → `facet_wrap()`: son muchos
  grupos, y con ocho colores hay que ir y volver a la leyenda; en paneles se ve
  la forma de cada uno, con el mismo eje en todos. Es justo el gráfico de la
  lámina 5.

**Paráfrasis fieles del criterio**, que valen lo mismo que el texto de la
lámina: «son pocos y en un mismo gráfico se ve cuál va arriba»; «para ver el
cruce tienen que estar juntas»; «con ocho líneas se enreda»; «ocho colores no se
distinguen y hay que mirar la leyenda todo el rato»; «un panel por problema y se
ve la forma de cada uno». **No hace falta nombrar la función exacta**: «facetas»,
«paneles» o «un gráfico por problema» valen igual que `facet_wrap()`.

**Lo que no es el criterio:** «se ve más bonito», «queda más ordenado», o «es
más claro» sin decir por qué. La elección puede estar bien, pero esa razón no es
la de la clase.

## Del gráfico al titular (láminas 7 y 8)

**Lámina 7 · Lexis.** Un gráfico de *The Economist* (17-jun-2026) con tres
variables: año en x, edad en y, y el cambio en la mortalidad en el color. Naim
lo abrió en vivo. Ninguna ronda lo pregunta, y nada del artículo fuera de la
lámina es material de la clase.

**Lámina 8 · El color dice el titular; el resto, en gris.** Bajada: *«Primero
la frase; después, el gráfico que la muestra.»* Las cuatro líneas de `cuatro` en
gris y, encima, pobreza en negro y delincuencia en rosa:

```r
ggplot(cuatro, aes(x = anio, y = porcentaje,
                   group = problema)) +
  geom_line(color = "#B5B0AA") +
  geom_line(data = pobreza,
            color = "#2C2C2C", linewidth = 1) +
  geom_line(data = delinc,
            color = "#C4878C", linewidth = 1) +
  labs(
    title = "En 1994 empataban; hoy, 31% contra 3%",
    x = NULL, y = "% primer problema",
    caption = "Rosa: delincuencia · negro: pobreza")
```

Si en la R2 alguien propone, para el caso (1), destacar las dos líneas en color
y el resto en gris, **está usando la lámina 8**: es color en el mismo eje, y
vale.

## Lo que viene

El **Sprint 3 (prototipo visual)** se presenta el **lunes 26 de octubre de
2026**, en clase; el enlace al Colab se entrega antes del **domingo 25 de
octubre de 2026, 23:59**. El ejercicio de hoy (láminas 9 a 13) fue un gráfico
con tres variables del proyecto de cada grupo, con titular: es el borrador de
esa entrega.
