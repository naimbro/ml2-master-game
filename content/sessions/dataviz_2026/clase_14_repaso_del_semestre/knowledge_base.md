# Clase 14 — Repaso del semestre

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 14 de 15, lunes 16 de noviembre de
2026. Estudiantes de primer año, de ciencias sociales y negocios, que empezaron
el semestre sin haber programado (en la encuesta del curso, 9 de 33 marcaron
«Ninguna, esta es mi primera vez»).

Es el **último juego del curso**. Repasa lo que más les sirve del semestre, de
mirar una tabla a escribir el número en la barra, que vieron esa misma mañana.
Se juega a las 11:30, después del recreo, **en el teléfono**.

## Cómo son las rondas: editar, no escribir de cero

Las **ocho rondas son de código y todas parten con el código ya escrito en el
cuadro**: es el «código inicial» que cita cada `judgeFocus`. La pregunta pide
**una edición chica**: cambiar una palabra, agregar una línea, arreglar un
error. Lo que el estudiante envía es el cuadro completo, editado.

Por eso:

- **Una respuesta idéntica al código inicial no hizo nada**: vale 0-20, aunque
  el código «se vea bien».
- **No cobres lo que venía escrito.** El estudiante no eligió el nombre `top5`,
  ni el `reorder()`, ni la tabla `cuatro`: venían en el cuadro. Juzga la
  edición pedida y que el resto siga corriendo.
- Si el estudiante reescribió todo a su manera y llega a lo pedido, vale igual.

**El estándar es «¿corre y hace lo que se pidió?»**, juzgado leyendo el texto.
Se escribe en un minuto o dos desde un teléfono: **escribir más no sube el
puntaje**. No se cobra indentación, tipo de comillas, saltos de línea,
comentarios, ni un paréntesis de cierre que falta cuando la intención es
inequívoca.

Si un estudiante objeta el enunciado, eso **no se penaliza nunca**.

## El botón «Probar» y lo que el juez NO ve

Cada ronda tiene un botón «Probar» que ejecuta el código en el teléfono (R 4.6.0
con ggplot2 4.0.3 y dplyr 1.2.1, sobre webR). **En algunos teléfonos R puede no
haber cargado.** El juez **no ve ninguna ejecución**: juzga sólo el texto. No
premies ni castigues que el estudiante haya probado. Todo lo que este material
dice que «corre», «no corre» o «da X» se ejecutó en ese R el 15-nov-2026.

Las tablas que el teléfono deja cargadas, con estos nombres exactos:

- `curso`: la encuesta del curso, 33 filas, tal como viene del CSV. Columnas:
  `edad, estatura, hermanos, comuna, minutos_viaje, transporte, horas_sueno,
  horas_redes, sistema_operativo, tazas_cafe, experiencia, dominio,
  op_grafico_miente, op_interes_programar, op_datos_chile, op_hablar_publico`.
  `minutos_viaje` es TEXTO (`character`) porque alguien escribió `10 min`.
  `transporte` vale `"Auto"` (12), `"Metro"` (6) o `"Micro o bus"` (15).
- `problemas`: la serie de la CEP, columnas `anio`, `problema`, `porcentaje`:
  qué porcentaje nombra cada problema como el principal del país, de 1994 a
  2026, sin 2020.

## Lo que este curso ha visto

**De `dplyr`** (clases 3 a 7): `count()` (con `sort = TRUE`), `select()`,
`filter()` (con `==`, `!=`, `>`, `&`, `|`, `%in%`), `mutate()`, `as.numeric()`,
`class()`, el pipe `%>%`, `group_by()`, `summarise()` con `n()` y `mean()`,
`na.rm = TRUE`, `arrange(desc())`, `head()`, `nrow()`. En la clase 14:
`slice_max()`.

**De `ggplot2`** (clases 8 a 14): `ggplot()`, `aes()` con `x`, `y`, `color` y
`fill`, `geom_bar()`, `geom_col()`, `geom_histogram()`, `geom_point()`,
`geom_line()`, `reorder()`, `labs()`, `facet_wrap()`, `facet_grid()`,
`ggsave()`, `p <-`, `scale_y_continuous(limits = )`, `geom_hline()`,
`annotate()`, `geom_text(aes(label = ))`, `paste0()`, `round()`,
`scale_fill_manual()`.

**Regla de arbitraje, y manda sobre cualquier lista.** Si un estudiante responde
con algo correcto que no se enseñó, **vale igual**. Y **no van a ver inferencia
estadística en ningún momento del curso**: invocarla no suma.

<!-- section: ver_la_tabla -->

## R1 · Ver la tabla (clases 2 y 3)

Lo primero con una base nueva es mirarla. Cuaderno de la clase 2: «Ese objeto
`respuestas` es un **data frame**: una tabla con filas (personas) y columnas
(variables)», y `head()` para ver las primeras filas. Cuaderno de la clase 3:
`glimpse()` «muestra la base de un vistazo».

Verificado: `curso` y `head(curso)` imprimen la tabla; `"curso"` entre comillas
imprime la palabra; `Curso` con mayúscula no corre (*object 'Curso' not found*:
«R distingue mayúsculas de minúsculas», clase 2); `View(curso)` corre y en el
teléfono no muestra nada.

<!-- section: contar -->

## R2 · Contar (clase 3)

Cuaderno de la clase 3: «`count(curso, nombre_de_la_columna)` Eso es todo.»
Devuelve «una fila por cada categoría distinta» y una columna `n` con cuántas
personas hay en cada una. La clase 2 contaba con `table()`.

Verificado: `count(curso, sistema_operativo)` da Android 5, Otro 1, iOS (Apple)
27. `count(curso, sistema operativo)` con espacio no corre.

<!-- section: filtrar -->

## R3 · Filtrar (clase 4)

Cuaderno de la clase 4, la tabla de operadores: `==` «es igual a», `!=` «es
distinto de» (con el ejemplo literal `transporte != "Auto"`). Y la regla: «El
texto que buscas va **entre comillas** y tiene que estar escrito exactamente
como aparece en la base: `"Metro"` con mayúscula funciona, `"metro"` no.» Y la
otra: «**`==` son DOS iguales.**»

Verificado: `filter(transporte != "Auto")`, `filter(transporte %in% c("Metro",
"Micro o bus"))` y la versión con `|` dan 21 personas. `!= "auto"` en minúscula
corre y devuelve las 33 (no filtra nada). `=!` no corre (R avisa que se usó `=`
en vez de `==`).

<!-- section: texto_que_parece_numero -->

## R4 · El filtro que miente (clases 4 y 5)

**El cierre de la clase 4.** `filter(minutos_viaje > 60)` devuelve diez
personas (70, 80, 85 y 90 minutos) «**Y está mal.**» Faltan 100, 130, 150 y
180, porque alguien escribió `10 min` y `minutos_viaje` **es texto**: R, al
comparar texto, «no mide: **deletrea**». Y «**no hubo ningún error ni ninguna
advertencia**».

**El arreglo de la clase 5:** `as.numeric()` dentro de un `mutate()`, antes de
filtrar. «**La regla del día:** antes de comparar una columna con `>`, `<` o
`>=`, pregúntale `class()`. Si dice `"character"`, arréglala con `mutate()`
antes de filtrar.» El aviso *NAs introduced by coercion* «No es un error».

Verificado: el código inicial (con la línea de comentario adentro del pipe) corre
y da diez; agregar `mutate(minutos_viaje = as.numeric(minutos_viaje)) %>%` da
las catorce; crear `minutos_num` y seguir filtrando `minutos_viaje` sigue dando
diez; la línea agregada sin el `%>%` al final no corre (*object 'minutos_viaje'
not found*).

<!-- section: promedio_con_na -->

## R5 · El promedio que no sale (clases 6 y 7)

Cuaderno de la clase 6: el promedio salió `NA` y «No es un error de R: es R
siendo honesto [...] el promedio de algo que incluye un "no sé" es,
correctamente, "no sé"». Se arregla con `mean(..., na.rm = TRUE)`. Cuaderno de
la clase 7, ejercicio 9, literal: los minutos promedio por transporte,
«Córrelo primero **sin** `na.rm = TRUE` y mira qué grupo sale `NA`. Después
agrégalo.»

Verificado: el código inicial da Auto NA, Metro 83,3, Micro o bus 77. Con
`na.rm = TRUE` (o `na.rm = T`) dentro de `mean()`, Auto da 40,5. Con
`filter(!is.na(minutos_num))` antes, lo mismo. Con `na.rm = TRUE` FUERA de
`mean()`, corre, agrega una columna `na.rm` y Auto sigue en NA. `narm = TRUE`
corre y Auto sigue en NA. `na.rm == TRUE` no corre.

<!-- section: piezas_ggplot -->

## R6 · El gráfico que no corre (clase 8)

Cuaderno de la clase 8: «**El error más común de hoy:** dentro de un gráfico las
piezas se **suman** con `+`, no se encadenan con `%>%`. El `%>%` sirve para la
tabla; el `+`, para el dibujo. Si te equivocas, R te lo dice: *Did you use
`%>%` or `|>` instead of `+`?* Y el `+` va **al final** de la línea, nunca al
comienzo de la siguiente.»

Verificado: el código inicial no corre con ese mensaje; con `+` dibuja Auto 12,
Metro 6, Micro o bus 15. El `+` al comienzo de la línea siguiente no corre (*Did
you accidentally put `+` on a new line?*). Sin operador, corre y dibuja sólo los
ejes, sin barras.

<!-- section: tercera_variable_color -->

## R7 · Una línea por problema (clase 10)

Lámina 4 de la clase 10: «`color =` : todos en el mismo plano», con
`ggplot(cuatro, aes(x = anio, y = porcentaje, color = problema)) + geom_line()`.
Cuaderno 10: «**una sola cosa nueva**: `color = problema` dentro de `aes()`.
ggplot dibuja una línea por problema y arma la leyenda solo.» La Prueba 1 del
cuaderno: «saca `color = problema`. ¿Qué pasa con las líneas?».

Verificado: el código inicial (sin `color`) corre y dibuja UNA línea en zigzag
que salta entre los cuatro problemas de cada año. Con `color = problema` dentro
de `aes()` (o dentro de `geom_line(aes(...))`) salen las cuatro líneas de
colores. `geom_line(color = problema)` fuera de `aes()` no corre (*object
'problema' not found*). `color = "problema"` con comillas corre y sigue la línea
única. `group = problema` dibuja cuatro líneas de un mismo color.

<!-- section: numero_en_la_barra -->

## R8 · El número en la barra (clase 14)

Lo vieron esa misma mañana. Cuaderno 14 y lámina 5: «`geom_text()` escribe un
texto en cada fila. Lo que se escribe va en `aes(label = ...)`: aquí, el
porcentaje redondeado con `%` al final. `nudge_x` lo corre un poco a la
derecha». Lámina 5: «En tres segundos nadie lee un eje: el número va en la
barra.»

```r
  geom_col() +
  geom_text(aes(label = paste0(round(porcentaje), "%")), nudge_x = 2)
```

El top 5 de 2026: Delincuencia, asaltos y robos 31,45; Salud 13,17;
Narcotráfico 9,69; Pensiones 7,98; Educación 7,91.

Verificado: con esa capa salen 31%, 13%, 10%, 8% y 8%. `label = porcentaje` sin
redondear y `geom_label()` también escriben el número. `geom_text(label =
porcentaje)` fuera de `aes()` no corre; `geom_text()` sin `label` no corre;
`label = problema` escribe el nombre. Sin el `+`, la capa queda suelta y las
barras salen sin números.
