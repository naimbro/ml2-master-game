# Clase 8 — Primeros gráficos con `ggplot2`

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 8 de 15, lunes 28 de septiembre de
2026. **Son 33 estudiantes de primer año.**

Llevan **siete clases programando en su vida** (de la 2 a la de hoy), y **hoy fue
su primer día con `ggplot2`**: en las clases 2 a 7 la librería sólo se nombró
como «lo que viene en la clase 8». Vienen de ciencias sociales y negocios, no de
ingeniería.

**El estándar es «¿corre y dibuja lo que se pidió?»**, no elegancia. El juego
cierra la clase, después del bloque de práctica con el cuaderno de hoy.

**Las cuatro rondas son abiertas y las cuatro piden escribir R.** R1 pide UNA sola
cosa (el gráfico de barras). R2, R3 y R4 piden DOS COSAS numeradas (1) y (2), y
en esas tres **media respuesta no puede pasar de 40 en Exactitud**.

**Cuando se pidió código**, lo evaluable es si eso, pegado en un Colab que ya
tiene `curso` (o `viajes`) y `ggplot2` cargados, corre y dibuja lo pedido.
**Cuando se pidió castellano**, no se necesita vocabulario técnico.

La respuesta se escribe en dos o tres minutos desde un teléfono. **Escribir más
no sube el puntaje.** No se cobra indentación, tipo de comillas, saltos de línea,
`theme_minimal()`, ni un paréntesis de cierre que falta cuando la intención es
inequívoca.

Si un estudiante objeta el enunciado, eso **no se penaliza nunca**. Si tiene
razón, el problema es del enunciado.

## Lo que este curso ha visto, y nada más

**De `dplyr`** (clases 2 a 7): `library()`, `read.csv()`, `count()`, `select()`,
`filter()`, `mutate()`, el pipe `%>%`, `group_by()`, `summarise()`, `n()`,
`arrange()`, `desc()`. De R base: `as.numeric()`, `mean()` con `na.rm = TRUE`,
`is.na()`, los operadores de comparación.

**De `ggplot2`, hoy:** `ggplot()`, `aes()` con `x`, `y` y `color`,
`geom_bar()`, `geom_histogram()` con `binwidth`, `geom_col()`, `geom_point()`,
`geom_count()`, `labs()` con `title`, `subtitle`, `x`, `y` y `caption`, y
`theme_minimal()`. Todo eso SÍ se enseñó hoy: no es «algo que no se ha visto».

**No están en el cuaderno** y ninguna ronda los pide: escalas (`scale_...`),
`facet_...`, `geom_jitter()`, `geom_boxplot()`, `geom_line()`, `fill =`,
`ggtitle()`, `xlab()`, `ylab()`, `stat = "identity"`, `ifelse()`. `reorder()`
aparece sólo en un desafío opcional. **Si un estudiante usa cualquiera de ellos y
el gráfico corre y dibuja lo pedido, es igual de legítimo y vale lo mismo.** La
lista dice lo que no se exige, no lo que está prohibido.

Y **no van a ver inferencia estadística en ningún momento del curso**: nada de
tests, valores-p, intervalos de confianza ni regresión. Invocarlos no suma.

**Regla de arbitraje, y manda sobre cualquier lista.** Si un estudiante responde
con algo correcto que no se enseñó —`data =` y `mapping =` explícitos, el
`aes()` adentro de la geometría, el pipe que entra al `ggplot()`
(`curso %>% ggplot(aes(x = transporte)) + geom_bar()` corre), `count()` +
`geom_col()`, `geom_bar(stat = "identity")`, `ggtitle()`/`ylab()`— **vale
igual**. La pregunta es siempre si corre y dibuja lo pedido.

## La base: `curso`, la encuesta del propio curso

`encuesta_curso.csv`: **33 filas**, las respuestas de ellos mismos. Columnas:
`edad`, `estatura`, `hermanos`, `comuna`, `minutos_viaje`, `transporte`,
`horas_sueno`, `horas_redes`, `sistema_operativo`, `tazas_cafe`, `experiencia`,
`dominio`, y cuatro `op_...`.

En la **Parte 0** del cuaderno de hoy la base se limpia y se guarda con
`curso <-`, creando tres columnas numéricas que existen en todas las rondas:

```r
curso <- curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje),
         sueno_num   = as.numeric(horas_sueno),
         redes_num   = as.numeric(horas_redes))
```

El aviso *NAs introduced by coercion* son el `"10 min"`, el `"3 horas"` y el
`"5 horas"`. Las columnas originales (`minutos_viaje`, `horas_sueno`,
`horas_redes`) **siguen siendo texto**.

`transporte`: `"Auto"` 12 · `"Metro"` 6 · `"Micro o bus"` 15.

<!-- section: tres_piezas_y_barras -->

## Las tres piezas y el gráfico de barras (Parte 1 del cuaderno 8)

Textual del cuaderno: *«todo gráfico se escribe con las mismas tres piezas,
siempre en el mismo orden»*:

| Pieza | Responde a | Ejemplo |
|---|---|---|
| `ggplot(curso, ...)` | ¿con **qué datos**? | la base del curso |
| `aes(...)` | ¿qué columna va en **cada eje**? | `aes(x = transporte)` |
| `geom_...()` | ¿con **qué forma** la dibujo? | `geom_bar()` = barras |

Y una cuarta para terminarlo: `labs()`.

Se construye pieza por pieza:

- `ggplot(curso)` → **un rectángulo gris vacío**: sabe qué datos usar, no qué
  dibujar.
- `ggplot(curso, aes(x = transporte))` → **un eje con las tres categorías y sin
  barras**: sabe dónde, no con qué forma.
- `+ geom_bar()` → el primer gráfico: **Auto 12 · Metro 6 · Micro o bus 15**,
  los mismos números que `curso %>% count(transporte)`. Textual: *«`geom_bar()`
  hace el `count()` por ti y lo dibuja.»*

```r
ggplot(curso, aes(x = transporte)) +
  geom_bar()
```

**El error más común de hoy**, textual del cuaderno: *«dentro de un gráfico las
piezas se **suman** con `+`, no se encadenan con `%>%`. El `%>%` sirve para la
tabla; el `+`, para el dibujo. Si te equivocas, R te lo dice: Did you use `%>%`
or `|>` instead of `+`? Y el `+` va **al final** de la línea, nunca al comienzo
de la siguiente.»*

**Barras acostadas** (ejercicio 2): cambiar `x` por `y` dentro de `aes()` —
`aes(y = experiencia)`— cuando las etiquetas son largas y se pisan.

### Qué pasa con cada error de la R1 (verificado en R 4.3.3 con ggplot2 3.5.2)

Esto no está en el cuaderno: se corrió para saber qué hace cada error, y sirve
para juzgar.

| Código | Qué pasa |
|---|---|
| `ggplot(curso, aes(x = transporte)) %>% geom_bar()` | **No corre**: *`mapping` must be created by `aes()`. Did you use `%>%` or `\|>` instead of `+`?* |
| `ggplot(curso, aes(x = transporte)) + geom_bar` | **No corre**: *Can't add `geom_bar` to a ggplot object. Did you forget to add parentheses, as in `geom_bar()`?* |
| `ggplot(curso, aes(x = "transporte")) + geom_bar()` | **Corre y dibuja UNA SOLA BARRA DE 33**: con comillas, `"transporte"` es un valor fijo, no la columna |
| `curso %>% ggplot(aes(x = transporte)) + geom_bar()` | **Corre y dibuja bien**: el pipe entra al `ggplot()` y después las piezas se suman |
| `ggplot(curso) + geom_bar(aes(x = transporte))` | Corre y dibuja bien |
| `ggplot(curso, aes(y = transporte)) + geom_bar()` | Corre: las mismas barras, acostadas |
| `curso %>% count(transporte) %>% ggplot(aes(x = transporte, y = n)) + geom_col()` | Corre y dibuja 12 · 6 · 15 |

<!-- section: geom_col_numero_calculado -->

## Un número por grupo: `geom_col()` (Parte 3 del cuaderno 8)

Textual: *«`geom_bar()` cuenta filas. Pero muchas veces lo que queremos dibujar
**no es un conteo**, sino un número que ya calculamos: un promedio por grupo, por
ejemplo.»*

Primero la tabla, con la receta de la clase 7, guardada como `viajes`:

```r
viajes <- curso %>%
  group_by(transporte) %>%
  summarise(minutos = mean(minutos_num, na.rm = TRUE))
```

| transporte | minutos |
|---|---|
| Auto | 40,5 |
| Metro | 83,3 |
| Micro o bus | 77,0 |

Y el gráfico, con **dos** columnas en `aes()`:

```r
ggplot(viajes, aes(x = transporte, y = minutos)) +
  geom_col()
```

Textual: *«Fíjate que el primer argumento ya no es `curso`, sino `viajes`: **se
grafica la tabla que acabas de hacer**.»*

| | Qué le das | Qué dibuja |
|---|---|---|
| `geom_bar()` | sólo `x` | cuenta las filas de cada categoría |
| `geom_col()` | `x` **y** `y` | la altura que tú calculaste |

Ejercicio 6 del cuaderno: sueño promedio por transporte, Auto 6,73 · Metro 6,17 ·
Micro o bus 6,20.

### Qué pasa con cada error de la R2 (verificado en R 4.3.3 con ggplot2 3.5.2)

| Código | Qué pasa |
|---|---|
| `ggplot(viajes, aes(x = transporte, y = minutos)) + geom_bar()` | **No corre**: *`stat_count()` must only have an x or y aesthetic* |
| `ggplot(curso, aes(x = transporte, y = minutos)) + geom_col()` | **No corre**: *objeto 'minutos' no encontrado* (esa columna sólo existe en `viajes`) |
| `ggplot(curso, aes(x = transporte, y = minutos_num)) + geom_col()` | **Corre pero APILA SUMAS**: 445 · 500 · 1.155 minutos, no promedios |
| `ggplot(viajes, aes(x = transporte), y = minutos) + geom_col()` | **No corre**: a `geom_col()` le falta la `y` |
| `ggplot(viajes, aes(x = transporte, y = minutos)) + geom_bar(stat = "identity")` | **Corre y dibuja lo mismo que `geom_col()`**: es correcto aunque no esté en el cuaderno |
| `geom_bar()` con sólo `x` sobre `viajes` | Corre y dibuja una barra de altura 1 por transporte: `viajes` tiene una fila por grupo |

<!-- section: terminar_con_labs -->

## Terminarlo: títulos, ejes, unidades y fuente (Parte 5 del cuaderno 8)

Textual: *«Todo lo que hiciste hasta acá es un gráfico **de trabajo**: sirve para
que tú mires los datos. Para que lo lea otra persona, que no ve tu código, le
faltan cuatro cosas. Se agregan con `labs()`, sumado con `+` como cualquier
pieza»*:

```r
ggplot(viajes, aes(x = transporte, y = minutos)) +
  geom_col() +
  labs(title    = "En auto se llega en la mitad del tiempo",
       subtitle = "Minutos de viaje, promedio por medio de transporte",
       x        = "Medio de transporte",
       y        = "Minutos (promedio)",
       caption  = "Fuente: encuesta del curso DVD 2026, 33 estudiantes") +
  theme_minimal()
```

*«La última línea, `theme_minimal()`, cambia el **tema**: saca el fondo gris. Es
opcional.»*

**El control antes de mostrar un gráfico**, textual:

| | Pregunta |
|---|---|
| **Título** | ¿Dice lo que se ve, con un número o una comparación? *(Como el titular de la clase 6.)* |
| **Ejes** | ¿Cada eje dice qué mide y **en qué unidad**? |
| **Fuente** | ¿Dice de dónde vienen los datos y cuántas personas son? |

**Hallazgos verdaderos según la tabla** (la lista NO es exhaustiva; vale
cualquier afirmación que la tabla sostenga): el auto es el viaje más corto
(40,5); el metro es el más largo (83,3); en metro se tarda el doble que en auto
(83,3 / 40,5 = 2,06); micro y metro casi duplican al auto; metro y micro pasan la
hora y cuarto. **Falsos**: «en micro se tarda más» (el más largo es el metro),
«en auto se tarda el doble».

La R3 del juego pide título + eje y + fuente. El eje x, el `subtitle` y
`theme_minimal()` **no se pidieron**: suman si están, no restan si faltan.

### Qué pasa con cada error de la R3 (verificado en R 4.3.3 con ggplot2 3.5.2)

| Código | Qué pasa |
|---|---|
| `... + geom_col() %>% labs(title = "...")` | **Corre, pero el gráfico sale con el título y SIN COLUMNAS**: el `%>%` se come la geometría |
| `geom_col()` en una línea y `+ labs(...)` al comienzo de la siguiente | En Colab **no corre** la segunda línea (*argumento no válido para un operador unitario*). El juego lo cobra como detalle porque es un salto de línea escrito en un teléfono |
| `ggtitle("...") + ylab("...")` en vez de `labs()` | Corre y pone lo mismo: correcto |

<!-- section: histograma_y_columna_limpia -->

## Distribución: el histograma, y por qué necesita la columna limpia (Parte 2 del cuaderno 8)

Textual: *«Las barras sirven para **categorías**. Para una columna de
**números**, como las horas en redes sociales, se usa un **histograma**: agrupa
los valores en tramos y cuenta cuántas personas caen en cada uno.»*

```r
ggplot(curso, aes(x = redes_num)) +
  geom_histogram(binwidth = 1)
```

*«`binwidth = 1` es el **ancho de cada tramo**: una hora. Casi todo el curso está
entre 2 y 5 horas diarias, y hay una cola que llega hasta 10.»*

*«Aparece un aviso: Removed 1 row containing non-finite... Es el `NA` del
`"5 horas"`. Como en la clase 5, no es un error: R te avisa que dejó a una
persona fuera del dibujo.»*

**Por qué se limpió en la Parte 0**, textual: *«Prueba el mismo gráfico con
`horas_redes`, la columna original: no corre. R responde `stat_bin()` requires a
continuous x aesthetic: un histograma necesita números, y esa columna es
texto.»*

### Qué pasa con cada error de la R4 (verificado en R 4.3.3 con ggplot2 3.5.2)

| Código | Qué pasa |
|---|---|
| `ggplot(curso, aes(x = horas_redes)) + geom_histogram(binwidth = 1)` | **No corre**: *`stat_bin()` requires a continuous x aesthetic. The x aesthetic is discrete.* |
| `ggplot(curso, aes(x = horas_redes)) + geom_bar()` | **Corre, pero NO es un histograma**: cuenta cada texto como una categoría (diez barras) |
| `ggplot(curso, aes(x = as.numeric(horas_redes))) + geom_histogram(binwidth = 1)` | **Corre y dibuja lo mismo** que con `redes_num`: correcto |
| `ggplot(curso, aes(x = redes_num)) + geom_histogram()` sin `binwidth` | Corre: R avisa que usó 30 tramos y dibuja igual un histograma |
| Agregar `library(ggplot2)`, cambiar el `binwidth` o agregar `na.rm` dejando `horas_redes` | **Sigue sin correr**: la causa es la columna |

## Las tres ideas del cierre del cuaderno

1. **Todo gráfico son tres piezas: datos, `aes()` y `geom`.** Lo demás es
   terminación. Si un gráfico no sale, revisa cuál de las tres falta.
2. **La forma depende de la pregunta.** Categorías: barras. Cómo se reparte un
   número: histograma. Un número por grupo: columnas. Dos números: puntos.
3. **Un gráfico sin título, unidades y fuente no está terminado.** Quien lo lee
   no ve tu código; sólo ve el dibujo.

**Lo que viene:** el Sprint 3 (prototipo visual) se entrega el **lunes 26 de
octubre de 2026**. El ejercicio 9 del cuaderno de hoy —un gráfico terminado con
la base de cada grupo— es su primer borrador.
