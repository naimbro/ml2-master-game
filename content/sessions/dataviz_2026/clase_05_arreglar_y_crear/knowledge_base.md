# Clase 5 — Arreglar y crear columnas

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 5 de 15, lunes 31 de agosto de 2026.
**Son 33 estudiantes de primer año.**

Llevan **cuatro clases programando en su vida**: la 2, la 3, la 4 y la de hoy.
Vienen de ciencias sociales y negocios, no de ingeniería. Antes de la clase 2,
ninguno había programado nunca.

**El juego se juega cansados y a última hora.** Antes de esto, los diez grupos
del curso presentaron el Sprint 1 —cuatro minutos cada uno— y el profesor hizo la
síntesis. El juego arranca cerca de las 11:50 y dura veinte minutos. No es una
prueba: es el control de si `dplyr` quedó.

Esta sesión tiene **una sola ronda juzgada** (R3) y las otras cuatro son de
alternativas, que se puntúan solas y no pasan por ti.

**La ronda juzgada pide dos cosas de naturaleza distinta y las dos cuentan:**

1. **Un diagnóstico en castellano**, de una o dos líneas. Ahí no se evalúa
   vocabulario técnico: un razonamiento correcto dicho sin una sola palabra
   técnica vale 100. Decir "esa columna no la está leyendo como número, la está
   leyendo como palabra" vale exactamente lo mismo que decir "la variable es de
   tipo carácter".
2. **Una cadena de R que corra.** Ahí lo evaluable es que el código, pegado en un
   Colab que ya tiene `curso` cargado, corra y devuelva catorce. Se pidió *sólo
   el código*, así que una respuesta sin una palabra de prosa alrededor del
   código es exactamente lo que se pidió.

La respuesta se escribe en tres minutos desde un teléfono. Dos líneas de
castellano y tres de R valen 100. **Escribir más no sube el puntaje**: premia
densidad, no extensión.

Si un estudiante objeta el enunciado —dice que la premisa le suena falsa o que
falta información— eso **no se penaliza nunca**. Si tiene razón, el problema es
del enunciado.

## Lo que está fuera de alcance

**De `dplyr` han visto exactamente esto y nada más:** `library()`, `read.csv()`,
`count()` (con una columna, con dos, y con `sort = TRUE`), `select()`,
`filter()`, `mutate()` y el pipe `%>%`. Desde hoy, además: `class()`,
`as.numeric()` dentro de un `mutate()`, `ifelse()` dentro de un `mutate()`, y los
operadores `&` y `|` dentro de un `filter()`. De R base traen `nrow()`, `ncol()`,
`names()`, `head()`, `str()`, `summary()`, `mean()`, `median()`, `sd()`,
`table()`, `sort()`, `c()`, `hist()`, `barplot()` y `boxplot()`.

**No han visto** `group_by()` ni `summarise()` —eso es la clase 6, el 7 de
septiembre—, ni `ggplot2` —clase 8—, ni `if_else()` ni `case_when()` (la versión
que se enseñó es `ifelse()`, la de R base), ni `arrange()` ni `desc()`, que no se
enseñaron en ninguna clase. Tampoco `is.na()`, `na.rm`, `filter(!is.na(...))` ni
ninguna forma explícita de tratar los `NA`: hoy el `NA` se **entiende**, no se
maneja.

Y **no van a ver inferencia estadística en ningún momento del curso**: nada de
tests de hipótesis, valores-p, intervalos de confianza, regresión, márgenes de
error ni representatividad muestral formal. El curso es descriptivo. Si una
respuesta invoca cualquiera de esas cosas, no está siendo sofisticada: está fuera
de lo que se enseñó, y no suma.

**Regla de arbitraje.** Si un estudiante responde con algo correcto que no se
enseñó —`subset()`, `require()`, `|>`, `curso$minutos_viaje <- as.numeric(...)`,
`transform()`— **vale igual**. No confundas "no está en el cuaderno" con "está
mal".

## La base con la que trabajaron toda la clase

`encuesta_curso.csv`: **33 filas y 16 columnas**. Son las respuestas de ellos
mismos, recogidas en la clase 2. Las 16 columnas, con el nombre exacto:

`edad`, `estatura`, `hermanos`, `comuna`, `minutos_viaje`, `transporte`,
`horas_sueno`, `horas_redes`, `sistema_operativo`, `tazas_cafe`, `experiencia`,
`dominio`, `op_grafico_miente`, `op_interes_programar`, `op_datos_chile`,
`op_hablar_publico`.

Los conteos que se han visto en pantalla, todos verificados contra el archivo:

| Columna | Reparto |
|---|---|
| `transporte` | Micro o bus 15 · Auto 12 · **Metro 6** |
| `sistema_operativo` | iOS (Apple) 27 · **Android 5** · Otro 1 |
| `dominio` | Deporte 7 · Inteligencia artificial 6 · Salud 6 · Educación 4 · Cultura 4 · Vivienda 2 · Medioambiente 1 · politica 1 · Transporte 1 · tecnologia y salud 1 |
| `edad > 19` | 8 personas |
| `hermanos > 1` | 18 personas |
| `tazas_cafe >= 2` | 7 personas |
| `hermanos + 1 >= 4` | 10 personas |

**Cuáles columnas son números de verdad y cuáles no.** `edad`, `hermanos` y
`tazas_cafe` son numéricas. `minutos_viaje`, `horas_sueno` (`"3 horas"`),
`horas_redes` (`"5 horas"`) y `estatura` (mezcla `173`, `1.58` y `1,60`) son
**texto**, porque en cada una hay al menos una respuesta escrita con letras o con
coma.

<!-- section: las_tres_funciones -->

## Las tres funciones, y qué hace cada una

La tabla con la que abrió la clase 4, y que hoy se repasó en la Parte 1:

| | Qué hace |
|---|---|
| `filter()` | se queda con algunas **filas** |
| `select()` | se queda con algunas **columnas** |
| `mutate()` | **agrega** una columna nueva |

Y una cuarta cosa, que el cuaderno describe como *"no una función sino un
pegamento"*: el operador `%>%`, que encadena las tres.

**Las dos direcciones de recortar.** `filter()` y `select()` hacen lo mismo en
ejes distintos: uno corta a lo alto (filas, personas), el otro a lo ancho
(columnas, variables). Confundirlos es confundir "quiénes" con "qué se sabe de
ellos". `mutate()` es la única de las tres que **no saca nada**: agrega.

El ejercicio 1 del cuaderno de hoy, textual:

> **1.** Con pipe: quédate con quienes usan Android y muestra `comuna` y
> `dominio`. *(`curso`, luego `filter()` con `sistema_operativo == "Android"`,
> luego `select()`)*

```r
curso %>%
  filter(sistema_operativo == "Android") %>%
  select(comuna, dominio)
```

Son 5 personas con Android, y de ellas quedan 2 columnas. **Las dos cosas pasan
en la misma cadena**: el filtro decide cuántas filas, el select decide cuántas
columnas, y ninguno de los dos toca lo que hace el otro.

**La regla del pipe**, textual del cuaderno 4:

> `%>%` agarra lo que hay a su izquierda y se lo entrega como **primer
> argumento** a la función de su derecha. Por eso adentro de `filter()` ya no
> escribes `curso`: el pipe se lo pasó.

**El error propio del pipe**, y el que hay que cazar: volver a escribir la base
adentro de la función después de habérsela pasado —`curso %>% filter(curso,
dominio == "Deporte")`—. Es la señal de que el pipe se copió sin entenderlo.

<!-- section: escribir_el_filtro -->

## Cómo se escribe un `filter()`, y las tres formas de romperlo

El cuaderno de la clase 4 marca esto como **"el detalle que más errores causa en
todo el curso"**:

> **`==` son DOS iguales.** Uno solo (`=`) significa *"guarda esto acá"*. Dos
> significan *"¿es igual a?"*. Son cosas distintas y R no perdona la confusión.

Y sobre el texto que se busca:

> El texto va **entre comillas** y tiene que estar escrito exactamente como
> aparece en la base: `"Metro"` con mayúscula funciona, `"metro"` no.

Las tres formas de romper la misma línea, todas vistas en clase:

| Lo que escribe | Qué pasa |
|---|---|
| `filter(curso, transporte = "Metro")` | Un solo `=`. `dplyr` lo lee como un argumento con nombre y responde *"We detected a named input"*. No corre. |
| `filter(curso, transporte == "metro")` | Corre y devuelve **cero filas**: en la base el valor está escrito `Metro`. |
| `filter(curso, Transporte == "Metro")` | `Transporte` con mayúscula **no es una columna de esta base**. No corre. |
| `filter(curso, transporte == "Metro")` | Correcto: **6 personas**. |

La lección de las mayúsculas no es nueva: es la misma que la clase 3 vio al
encontrar `Las condes` y `las condes` contadas como dos comunas distintas.

Los operadores que se pueden usar adentro de `filter()`, tal como se listaron:

| Operador | Significa | Ejemplo del cuaderno |
|---|---|---|
| `==` | es igual a | `transporte == "Metro"` |
| `!=` | es distinto de | `transporte != "Auto"` |
| `>` `<` | mayor / menor que | `edad > 19` |
| `>=` `<=` | mayor o igual / menor o igual | `tazas_cafe >= 2` |

**`filter()` no toca la tabla original.** Devuelve una tabla nueva.

<!-- section: la_columna_que_mentia -->

## La columna que mentía, y cómo se arregla

Es la idea que atraviesa las dos clases. La clase 4 cerró con el crimen; la clase
5 abre resolviéndolo.

### El crimen

La pregunta era razonable: *"¿cuántas personas se demoran más de una hora en
llegar?"*. El código se escribe solo:

```r
curso %>%
  filter(minutos_viaje > 60) %>%
  count(minutos_viaje)
```

**Devuelve 10 personas**, y los valores que sobrevivieron son 70 (×4), 80, 85 y
90 (×4).

**Y está mal.** En el curso hay **14** personas que se demoran más de una hora.
Las que faltan pusieron **100, 130, 150 y 180** minutos: son justo **las que más
viajan de todo el curso**. R no dio ningún error ni ninguna advertencia.

### Por qué

Alguien escribió `10 min` en esa columna. Un solo valor con letras basta:
`minutos_viaje` deja de ser un número y pasa a ser **texto**. Y R, al comparar
texto, **no mide: deletrea**. Compara `"130"` con `"60"` letra por letra, ve que
`1` viene antes que `6` en el abecedario, y concluye que 130 es menor que 60.
El cuaderno lo compara con una guía de teléfonos.

Por eso sobrevivieron justo los que empiezan con 7, 8 y 9, y quedaron fuera los
que empiezan con 1.

**La tabla ya lo estaba avisando.** Al correr `curso %>% count(minutos_viaje)`,
los valores salen en este orden: `10`, `10 min`, `100`, `130`, `15`… Textual del
cuaderno: *"ése es orden de diccionario, no de números. La tabla te estaba
avisando."*

### El arreglo, que es la materia de hoy

Cabe en una línea. `as.numeric()` convierte texto en número, y va **adentro de un
`mutate()`** porque lo que se quiere es una columna nueva:

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  filter(minutos_num > 60) %>%
  count(minutos_num)
```

**Catorce**, no diez. Misma pregunta, mismo curso, mismo día. Lo único que cambió
fue una línea de limpieza.

**La regla del día**, textual:

> Antes de comparar una columna con `>`, `<` o `>=`, pregúntale `class()`. Si
> dice `"character"`, arréglala con `mutate()` antes de filtrar.

**Más de una escritura es correcta.** El nombre de la columna nueva lo elige el
estudiante: `minutos_num`, `min_num`, `viaje` o cualquier otro vale igual, y
**tiene que ser el mismo** el que después aparece en el `filter()`. También vale
sobrescribir la columna original —`mutate(minutos_viaje = as.numeric(minutos_viaje))`—,
hacerlo en dos pasos guardados en objetos intermedios, o usar `curso$minutos_viaje
<- as.numeric(curso$minutos_viaje)` sin pipe. Todas devuelven catorce.

**`count()` no es obligatorio para responder.** Cualquier cierre que muestre el
resultado —`count()`, `nrow()`, o dejar la tabla filtrada a la vista— responde la
pregunta. Lo que no puede faltar es el `mutate()` con `as.numeric()`: sin él la
respuesta sigue siendo diez.

<!-- section: class_y_as_numeric -->

## `class()`, `as.numeric()` y por qué el `NA` es una buena noticia

### `class()`: preguntarle a una columna de qué tipo es

```r
class(curso$minutos_viaje)
```

Devuelve `"character"`. **Texto**, aunque se vea como un número. Es la función
que el cuaderno pide "tener siempre a mano": una línea, antes de comparar nada.

Las respuestas posibles que este curso ha visto son `"character"` y `"numeric"`.
`edad`, `hermanos` y `tazas_cafe` responden `"numeric"`; `minutos_viaje`,
`horas_sueno`, `horas_redes` y `estatura` responden `"character"`.

### `as.numeric()`: qué pasa exactamente al correrlo

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  count(minutos_num)
```

Pasan dos cosas, y el cuaderno pide mirar las dos:

1. **Aparece un aviso en rojo**: *NAs introduced by coercion*, "se introdujeron
   NA por coerción". **No es un error.** R no se detiene: la columna nueva se
   crea igual.
2. **En la tabla hay una fila `NA`, con 1 caso.** Ése es el `"10 min"`. `NA`
   significa **"no sé"**, y es la respuesta honesta: R prefiere decir que no sabe
   antes que inventar un número.

### La idea que el cuaderno remarca

Textual, en recuadro:

> Compara las dos conductas. Como texto, `"10 min"` se comparaba en silencio y
> arrastraba a otros cuatro valores al error. Como `NA`, se declara. **Ese es el
> negocio de limpiar datos: cambiar errores silenciosos por errores visibles.**

Un error que rompe el código se arregla, porque avisa. El de la clase 4 no
avisaba: entregaba un número plausible, bien formateado, que se copia al informe
y nadie vuelve a mirar. Y el sesgo no era aleatorio — se comió exactamente los
casos extremos, que suelen ser los que importan.

### Las otras columnas con la misma enfermedad

`horas_sueno` (alguien escribió `3 horas`), `horas_redes` (`5 horas`) y
`estatura`, que está peor: mezcla centímetros (`173`), metros con punto (`1.58`)
y metros con coma (`1,60`). Con `as.numeric()`, `estatura` deja dos `NA` —los dos
valores con coma— y varias personas "midiendo 1,76". Arreglarla del todo era el
desafío opcional del cuaderno, con `ifelse()` para decidir a quién multiplicar
por 100.

<!-- section: dos_condiciones -->

## `ifelse()`, `&` y `|`: clasificar y pedir dos cosas a la vez

### `ifelse()`: de un número a una categoría

Casi ninguna audiencia quiere saber que alguien viaja 87 minutos. Quiere saber
cuántos tienen un viaje *largo*:

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje),
         viaje = ifelse(minutos_num > 60, "Largo", "Corto")) %>%
  count(viaje)
```

Salida verificada: **18 Corto, 14 Largo y 1 `NA`** —el viejo conocido—.

La forma es siempre la misma, y se lee de izquierda a derecha:

```
ifelse( la pregunta , qué poner si es TRUE , qué poner si es FALSE )
```

Dos detalles que el cuaderno hace notar sobre ese mismo código:

- **Un solo `mutate()` puede crear varias columnas**, separadas por coma.
- La segunda usa `minutos_num`, que **acababa de nacer en la línea anterior**.
  `mutate()` trabaja de arriba hacia abajo, así que eso está permitido.

### `&` y `|` dentro de un `filter()`

| Signo | Significa | Se cumple cuando |
|---|---|---|
| `&` | **y** | las dos condiciones son verdaderas |
| `\|` | **o** | basta con que una lo sea |

*"¿Cuántos vienen en micro y además se demoran más de una hora?"*

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  filter(transporte == "Micro o bus" & minutos_num > 60) %>%
  nrow()
```

**Diez personas** del curso pasan más de una hora arriba de una micro. Textual
del cuaderno: *"ése es el tipo de frase que sirve en una plataforma de datos: no
es un promedio, es un grupo concreto y contable."*

El ejercicio 7 pide lo mismo con `|`: cuántas personas usan **metro o micro**, es
decir transporte público. Son **21**.

**El error que esta ronda caza:** pedir `transporte == "Metro" & transporte ==
"Micro o bus"`. Nadie viaja en metro y en micro en el mismo viaje, así que esa
línea devuelve **cero filas y ningún error** — la misma familia de mentira
silenciosa de toda la clase. Y `filter(transporte == "Metro" | "Micro o bus")`
tampoco sirve: cada lado del `|` tiene que ser una comparación completa.

La tabla de cierre del cuaderno trae la forma escrita:
`filter(dominio == "Salud" | dominio == "Educación")`.

### La receta completa

Todo junto, respondiendo una pregunta de principio a fin:

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje),
         viaje = ifelse(minutos_num > 60, "Largo", "Corto")) %>%
  filter(transporte == "Metro" | transporte == "Micro o bus") %>%
  filter(viaje == "Largo") %>%
  count(dominio, sort = TRUE)
```

Cinco líneas que se leen como cinco instrucciones en orden: **toma, arregla,
clasifica, recorta, cuenta.** El cuaderno la presenta así: *"esa cadena, con otra
base y otros nombres de columna, es el motor del Sprint 2."*
