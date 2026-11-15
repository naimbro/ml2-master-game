# Clase 14 — Repaso del semestre

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 14 de 15, lunes 16 de noviembre de
2026. Estudiantes de primer año, de ciencias sociales y negocios, que empezaron
el semestre sin haber programado (en la encuesta del curso, 9 de 33 marcaron
«Ninguna, esta es mi primera vez»).

Es el **último juego del curso** y repasa el semestre entero: de `count()` en la
clase 3 a `slice_max()` y `geom_text()`, que vieron **esta misma mañana** en la
clase 14. El juego **premia a quien aprendió a lo largo del curso**. Se juega a
las 11:30, después del recreo, en el teléfono.

**Tres rondas son de código** (R3, R5 y R7) y piden UNA sola cosa cada una: el
código. Ahí no existe la media respuesta. **R6 pide una sola frase** en
castellano. R1, R2 y R4 son de alternativas y no pasan por los jueces.

**El estándar de las rondas de código es «¿corre y hace lo que se pidió?»**: lo
evaluable es si el código, pegado en un R que ya tiene las tablas y los paquetes
cargados, produce lo que la pregunta pide.

La respuesta se escribe en dos o tres minutos desde un teléfono. **Escribir más
no sube el puntaje.** No se cobra indentación, tipo de comillas, saltos de línea,
`theme_minimal()`, `labs()` de más, ni un paréntesis de cierre que falta cuando la
intención es inequívoca.

Si un estudiante objeta el enunciado, eso **no se penaliza nunca**. Si tiene
razón, el problema es del enunciado.

## El botón «Probar» y lo que el juez NO ve

En las rondas de código el estudiante tiene un botón «Probar» que ejecuta su
código en su teléfono (R 4.6.0 con ggplot2 4.0.3 y dplyr 1.2.1, sobre webR) y le
muestra el gráfico, la tabla o el error. **Puede que en algunos teléfonos R no
haya cargado.** El juez **no ve ninguna ejecución**: juzga sólo el texto que el
estudiante envió.

Por eso: **no premies ni castigues que el estudiante «haya probado»**, y no le
pidas que mencione el resultado de la ejecución. Una respuesta correcta escrita
sin el botón vale exactamente lo mismo que una probada.

Las tablas que el teléfono deja cargadas, con estos nombres exactos:

- `curso`: la encuesta del curso, 33 filas, tal como viene del CSV. Columnas:
  `edad, estatura, hermanos, comuna, minutos_viaje, transporte, horas_sueno,
  horas_redes, sistema_operativo, tazas_cafe, experiencia, dominio,
  op_grafico_miente, op_interes_programar, op_datos_chile, op_hablar_publico`.
  `minutos_viaje` es TEXTO (`character`) porque alguien escribió `10 min`.
- `problemas`: la serie de la CEP, columnas `anio`, `problema`, `porcentaje`.
  Qué porcentaje nombra cada problema como el principal del país, de 1994 a
  2026, sin 2020.
- `delinc`: `problemas` filtrada en `"Delincuencia, asaltos y robos"`.

## Lo que este curso ha visto

**De `dplyr`** (clases 3 a 7): `library()`, `read.csv()`, `count()` (con
`sort = TRUE`), `select()`, `filter()` (con `==`, `!=`, `>`, `&`, `|`, `%in%`),
`mutate()`, `as.numeric()`, `class()`, el pipe `%>%`, `group_by()`,
`summarise()` con `n()` y `mean()`, `arrange(desc())`, `head()`, `na.rm = TRUE`.
En la clase 14: `slice_max()`.

**De `ggplot2`** (clases 8 a 14): `ggplot()`, `aes()` con `x`, `y`, `color` y
`fill`, `geom_bar()`, `geom_col()`, `geom_histogram()`, `geom_point()`,
`geom_line()`, `geom_boxplot()`, `geom_segment()`, `reorder()`, `labs()`,
`theme_minimal()`, `facet_wrap()`, `facet_grid()`, `ggsave()`, el gráfico
guardado en `p <-` y `p + capa`, `scale_y_continuous(limits = )`,
`geom_hline()`, `annotate()`, `geom_text(aes(label = ))`, `paste0()`,
`round()`, `scale_fill_manual()`.

**Regla de arbitraje, y manda sobre cualquier lista.** Si un estudiante responde
con algo correcto que no se enseñó, **vale igual**. La pregunta es siempre si
corre y hace lo pedido. Y **no van a ver inferencia estadística en ningún
momento del curso**: invocarla no suma.

<!-- section: categorias_y_n -->

## R1 (alternativas) · Clase 3: diez categorías que no son diez temas

Cuaderno de la clase 3 («Contar con `dplyr`»), celdas 33–34, sobre
`count(curso, dominio, sort = TRUE)`:

> «**Salen 10 categorías, pero el curso no eligió 10 temas.** Alguien escribió
> `politica` en minúscula, alguien escribió `Medioambiente` en una palabra, y
> alguien no eligió del menú y escribió `tecnologia y salud`. Decidir qué hacer
> con esos tres **no lo puede hacer R sola**: es una decisión de ustedes, y hay
> que dejarla escrita.»

<!-- section: contar_describe_dividir_compara -->

## R2 (alternativas) · Clase 6: contar describe, dividir compara

Cuaderno de la clase 6, celda 1: 1994, 284; 2025, **1.342**; 2026, 461 personas
que nombran la delincuencia.

> «**Es falso, y el error no está en R: está en la pregunta.** En 2025 la CEP
> encuestó a 4.217 personas y en 2026 a 1.466. Estás comparando 1.342 de 4.217
> contra 461 de 1.466, como si fueran lo mismo.» «Contar sirve para describir un
> grupo. **Para comparar dos grupos hay que dividir**.»

Celda 35: «**2025 con 31,8% y 2026 con 31,4%.** No se triplicó ni se desplomó».

<!-- section: texto_que_parece_numero -->

## R3 (código) · Clases 4 y 5: el filtro que miente

**El cierre de la clase 4** (cuaderno 4, celdas 45–47). El código

```r
curso %>%
  filter(minutos_viaje > 60) %>%
  count(minutos_viaje)
```

devuelve **diez personas** (70, 80, 85 y 90 minutos) «**Y está mal.**» Faltan
100, 130, 150 y 180: «Son los que **más** se demoran de todo el curso, y el
filtro los dejó fuera.» La razón: alguien escribió `10 min`, así que
`minutos_viaje` **es texto**, y R, al comparar texto, «no mide: **deletrea**.
Compara `"130"` con `"60"` letra por letra, ve que `1` viene antes que `6`, y
concluye que 130 es menor que 60.» Y lo peligroso: «**no hubo ningún error ni
ninguna advertencia**».

**El arreglo de la clase 5** (cuaderno 5, celdas 14–21): `class()` dice
`"character"`; `as.numeric()` adentro de un `mutate()` crea la columna numérica;
aparece el aviso *NAs introduced by coercion* (es el `10 min`, que queda `NA`, y
«No es un error»); y la misma pregunta da **catorce**:

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  filter(minutos_num > 60) %>%
  count(minutos_num)
```

> «**La regla del día:** antes de comparar una columna con `>`, `<` o `>=`,
> pregúntale `class()`. Si dice `"character"`, arréglala con `mutate()` antes de
> filtrar.»

**Verificado en R 4.6.0 / dplyr 1.2.1 el 15-nov-2026** (el R del teléfono):

- El código original corre sin error y lista 70, 80, 85 y 90 (diez personas).
- La versión del cuaderno 5 lista ocho valores, de 70 a 180, que suman 14, y
  muestra antes el aviso *There was 1 warning in `mutate()`… NAs introduced by
  coercion*. **El aviso no es un error.**
- Dan 14 igual: terminar en `nrow()` en vez de `count()`; `summarise(n())`;
  convertir adentro del filtro, `filter(as.numeric(minutos_viaje) > 60)`;
  sobrescribir la columna con `mutate(minutos_viaje = as.numeric(minutos_viaje))`;
  y `curso$minutos_viaje <- as.numeric(curso$minutos_viaje)` antes del código
  original.
- **Corren y siguen dando diez:** crear `minutos_num` pero seguir filtrando
  `minutos_viaje`; comparar contra `"60"` con comillas.
- `filter(minutos_viaje >= 60)` sin convertir corre y agrega los 60, pero sigue
  dejando fuera a 100, 130, 150 y 180.
- El `mutate(...` sin su paréntesis de cierre no corre (*unexpected end of
  input*): eso es lo que el «Probar» le muestra al estudiante.

<!-- section: elegir_el_grafico -->

## R4 (alternativas) · Clase 9: la torta descartada

Clase 9, «¿Cuál es el mejor gráfico?» (Roberto Velázquez). Regla de la clase:
«**primero la tarea, después el geom**». Lámina 12, «Así se defiende un
gráfico»: tarea ranking, pregunta «¿qué problema preocupa más en 2026?».
Descartado: la torta. Elegido: barras ordenadas.

> «Ocho tajadas: hay que ir y volver a la leyenda, y la torta reparte el 100%
> aunque estos ocho problemas suman 83%.» «Las barras se leen de arriba abajo,
> sin leyenda, y el orden ya es la respuesta.»

<!-- section: grafico_por_etapas -->

## R5 (código) · Clase 13: reproducir la etapa 3

Clase 13, «Al aire»: el gráfico se arma por etapas, una capa por lámina. La
**etapa 3** (lámina 6, cuaderno 13, celdas 3–14) es la línea de la delincuencia
con el eje y fijo de 0 a 40 y una línea horizontal punteada en 19: «Una línea
horizontal le da al que mira un punto de comparación. Aquí, el punto de
partida: 19% en 1994.» El código acumulado de la clase:

```r
p <- ggplot(delinc, aes(x = anio, y = porcentaje)) +
  scale_y_continuous(limits = c(0, 40))
p <- p + geom_line()
p <- p + geom_hline(yintercept = 19, linetype = "dashed")
p
```

En la clase también se decía: «Si el gráfico se guarda en `p`, no se dibuja: se
dibuja cuando escriben `p`.» Y el eje fijo «es para que no salte cuando se suman
capas, y además empieza en cero».

La imagen del enunciado es la de la lámina, sin el panel de código. Tiene el
fondo crema de las láminas, que se suma por fuera del código proyectado: **en el
teléfono sale el fondo gris por defecto, y eso no es un error.**

**Verificado en R 4.6.0 / ggplot2 4.0.3 el 15-nov-2026:**

- Dibujan lo mismo que la imagen: el código en una sola cadena con `+` (sin
  `p`); el de la clase por etapas, terminado en `p`; `ylim(0, 40)` en vez de
  `scale_y_continuous(limits = c(0, 40))`; `linetype = 2` en vez de `"dashed"`.
  Agregar el `ggsave()` de la clase no rompe nada.
- **Corre y dibuja otra cosa:** sin `limits`, el eje va de ~12 a ~32 y la línea
  se ve más dramática (es lo que la clase quería evitar); con
  `limits = c(0, 30)`, se cortan tres años (R avisa *Removed 3 rows*); con
  `problemas` en vez de `delinc`, salen todos los problemas mezclados en una
  línea en zigzag; sin `linetype`, la referencia sale continua.
- **No corre:** `geom_hline(19, ...)` sin `yintercept =` (*`mapping` must be
  created by `aes()`*); `limits = 0, 40` sin `c()` (*`limits` must be a vector
  of length 2*); `linetype = dashed` sin comillas (*object 'dashed' not
  found*); `%>%` en vez de `+` (R pregunta *Did you use `%>%` or `|>` instead
  of `+`?*).
- **Corre y no dibuja nada:** guardar todo en `p <- ...` y no escribir `p` al
  final.

<!-- section: titulo_hallazgo -->

## R6 (prosa) · El título es el hallazgo, todo el semestre

La regla viene de la clase 6 (el titular del editor: «Un titular en una frase,
con un número y una comparación adentro»), del control antes de mostrar de la
clase 8 («**Título**: ¿Dice lo que se ve, con un número o una comparación?»), de
la clase 9 («El título dice el hallazgo, no el tema»), de la clase 10 («Primero
el titular, después el gráfico») y de la regla de la portada de la clase 12
(«title: lo que encontraron, con un número y una comparación»).

El gráfico es la mancuerna de la lámina 10 de la clase 9 («¿Quién se movió
más?»), sin su título. Sus datos, escritos a mano en el código de la clase:

| problema | 1994 (gris) | 2026 (rosa) |
|---|---|---|
| Delincuencia | 19,0 | 31,5 |
| Pobreza | 18,8 | 3,3 |
| Salud | 13,4 | 13,2 |
| Empleo | 10,9 | 4,7 |
| Inflación | 9,6 | 1,4 |
| Educación | 7,8 | 7,9 |
| Sueldos | 6,1 | 2,6 |

Su título original era «Pobreza abajo, delincuencia arriba». Las notas de la
lámina: «En 1994 la pobreza y la delincuencia empataban en 19%; en 2026 son 3
contra 31. Salud y Educación casi no se movieron, y eso también es un
hallazgo.»

<!-- section: carrusel_slice_max_geom_text -->

## R7 (código) · Clase 14: la lámina del carrusel

Lo vieron esta mañana, entre las 10:10 y las 10:25, y lo usaron después en sus
carruseles. Cuaderno 14, celdas 4–10, y láminas 4 y 5:

> «En la clase 9 el ranking se hacía con `arrange(desc(porcentaje)) %>%
> head(8)`. `slice_max()` hace lo mismo en un paso: ordena por la variable y se
> queda con las `n` primeras filas.»

> «`geom_text()` escribe un texto en cada fila. Lo que se escribe va en
> `aes(label = ...)`: aquí, el porcentaje redondeado con `%` al final.
> `nudge_x` lo corre un poco a la derecha». Lámina 5: «En tres segundos nadie
> lee un eje: el número va en la barra.»

```r
top5 <- problemas %>%
  filter(anio == 2026) %>%
  slice_max(porcentaje, n = 5)

ggplot(top5, aes(x = porcentaje,
                 y = reorder(problema, porcentaje))) +
  geom_col() +
  geom_text(aes(label = paste0(round(porcentaje), "%")),
            nudge_x = 2)
```

El top 5 de 2026: Delincuencia, asaltos y robos 31,45; Salud 13,17;
Narcotráfico 9,69; Pensiones 7,98; Educación 7,91. Las etiquetas salen 31%,
13%, 10%, 8% y 8%.

**Verificado en R 4.6.0 / ggplot2 4.0.3 / dplyr 1.2.1 el 15-nov-2026:**

- Dibujan lo pedido: el de arriba; `arrange(desc(porcentaje)) %>% head(5)` en
  vez de `slice_max()` (da las mismas cinco filas); todo en una sola cadena que
  entra con el pipe al `ggplot()`; sin `nudge_x`; `paste()` en vez de
  `paste0()` (sale «31 %»); `label = porcentaje` sin redondear (sale «31.45»:
  el número está, aunque sin `%`).
- **Corre y contesta mal:** sin `filter(anio == 2026)`, `slice_max()` toma los
  cinco porcentajes más altos de toda la serie, mezclando años (Pensiones 2019
  con 36,13 arriba, y la delincuencia de 2025, 2026, 2024 y 2015).
  `slice_min()` da los cinco menos nombrados.
- **No corre:** el gráfico sin armar `top5` (*object 'top5' not found*);
  `geom_text(label = porcentaje)` fuera de `aes()` (*object 'porcentaje' not
  found*); `slice_max(porcentaje, 5)` sin nombrar `n` (*`n` must be explicitly
  named*); `filter(anio = 2026)` con un solo `=` (*We detected a named
  input… Did you mean `anio == 2026`?*).
