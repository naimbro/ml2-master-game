# Clase 4 — Filtrar, elegir y crear

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 4 de 15, lunes 24 de agosto de 2026.
**Son 33 estudiantes de primer año.**

Llevan **tres clases programando en su vida**: la 2 (hace dos semanas), la 3
(hace una semana) y la de hoy. Vienen de ciencias sociales y negocios, no de
ingeniería. Antes de la clase 2, ninguno había programado nunca.

La clase de hoy tuvo dos mitades y el juego evalúa las dos, con estándares
distintos.

**La ronda de código** (R2) pide escribir una cadena de `dplyr` como las del
cuaderno de hoy. Ahí lo evaluable es **que el código corra y responda la
pregunta**: la función correcta en cada paso y el nombre de la columna escrito
tal cual está en los datos. Se pidió *sólo código*, así que una respuesta sin una
palabra de prosa es exactamente lo que se pidió. Existe más de una forma correcta
de escribir cada línea, y todas valen igual.

**La ronda de lectura** (R4) no requiere escribir código ni recordar el nombre de
ninguna función. Ahí lo evaluable es **el diagnóstico**: entender por qué un
filtro devolvió un número equivocado, y por qué eso es peligroso. Un razonamiento
correcto dicho sin una sola palabra técnica vale 100: decir "esa columna no la
está leyendo como número, la está leyendo como palabra" vale exactamente lo mismo
que decir "la variable es de tipo carácter".

Las respuestas se escriben en dos minutos y medio desde un teléfono. Tres o
cuatro líneas bien puestas valen 100. **Escribir más no sube el puntaje**: premia
densidad, no extensión.

Si un estudiante objeta el enunciado —dice que la premisa le suena falsa o que
falta información— eso **no se penaliza nunca**. Si tiene razón, el problema es
del enunciado.

## Lo que está fuera de alcance

**De `dplyr` han visto exactamente esto y nada más:** `library()`, `read.csv()`,
`count()` (con una columna, con dos, y con `sort = TRUE`), `select()` —las tres
de la clase 3— y, desde hoy, `filter()`, `mutate()` y el pipe `%>%`. De R base
traen `nrow()`, `ncol()`, `names()`, `head()`, `str()`, `summary()`, `mean()`,
`median()`, `sd()`, `table()`, `sort()`, `c()`, `as.numeric()`, `hist()`,
`barplot()` y `boxplot()`.

**No han visto** `group_by()` ni `summarise()` —eso es la clase 6, el 7 de
septiembre—, ni `ggplot2` —clase 8—, ni `if_else()`, `case_when()` o `ifelse()`
—clase 5, el 31 de agosto—, ni `arrange()` ni `desc()`, que no se enseñaron en
ninguna clase.

**Tampoco se enseñó todavía cómo arreglar una columna sucia.** Convertir
`minutos_viaje` a número es exactamente lo que hace la clase siguiente. Hoy la
trampa sólo se **diagnostica**. Una respuesta que además propone la solución no
está mal —suma como iniciativa— pero **no proponerla no es una falta**, y no se
puede exigir.

Y **no van a ver inferencia estadística en ningún momento del curso**: nada de
tests de hipótesis, valores-p, intervalos de confianza, regresión, márgenes de
error ni representatividad muestral formal. El curso es descriptivo. Si una
respuesta invoca cualquiera de esas cosas, no está siendo sofisticada: está fuera
de lo que se enseñó, y no suma.

**Regla de arbitraje.** Si un estudiante responde con algo correcto que no se
enseñó —`subset()`, `require()`, `|>`, `curso[curso$dominio == "Deporte", ]`—
**vale igual**. No confundas "no está en el cuaderno" con "está mal".

## La base con la que trabajaron toda la clase

`encuesta_curso.csv`: **33 filas y 16 columnas**. Son las respuestas de ellos
mismos, recogidas en la clase 2. Las 16 columnas, con el nombre exacto:

`edad`, `estatura`, `hermanos`, `comuna`, `minutos_viaje`, `transporte`,
`horas_sueno`, `horas_redes`, `sistema_operativo`, `tazas_cafe`, `experiencia`,
`dominio`, `op_grafico_miente`, `op_interes_programar`, `op_datos_chile`,
`op_hablar_publico`.

Los conteos que se vieron en pantalla hoy, todos verificados contra el archivo:

| Columna | Reparto |
|---|---|
| `transporte` | Micro o bus 15 · Auto 12 · **Metro 6** |
| `sistema_operativo` | iOS (Apple) 27 · Android 5 · Otro 1 |
| `dominio` | Deporte 7 · Inteligencia artificial 6 · Salud 6 · Educación 4 · Cultura 4 · Vivienda 2 · Medioambiente 1 · politica 1 · Transporte 1 · tecnologia y salud 1 |
| `edad > 19` | 8 personas |
| `hermanos > 1` | 18 personas |
| `tazas_cafe >= 2` | 7 personas |
| `hermanos + 1 >= 4` | 10 personas |

<!-- section: las_tres_funciones -->

## Las tres funciones de hoy, y qué hace cada una

La tabla que abre el cuaderno, textual:

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

Ejemplos exactos que se proyectaron:

```r
filter(curso, transporte == "Metro")        # 6 personas
select(curso, edad, comuna, dominio)        # tres columnas, en ese orden
head(select(curso, -estatura))              # todas MENOS estatura
mutate(tazas_semana = tazas_cafe * 7)       # columna nueva al final
```

`select()` fue **repaso**: ya lo habían visto al final de la clase 3. `filter()`,
`mutate()` y `%>%` son las tres cosas nuevas de hoy, y son las únicas tres.

<!-- section: escribir_el_filtro -->

## Cómo se escribe un `filter()`, y las tres formas de romperlo

El cuaderno marca esto como **"el detalle que más errores causa en todo el
curso"**:

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

**`filter()` no toca la tabla original.** Devuelve una tabla nueva. En clase se
comprobó: `metro <- filter(curso, transporte == "Metro")` deja `nrow(metro)` en 6
y `nrow(curso)` en 33.

<!-- section: el_pipe -->

## El pipe `%>%`: encadenar sin inventar nombres

La pregunta que lo motivó en clase: *"¿de qué comunas vienen los que llegan en
metro, y cuánto se demoran?"*. Son dos pasos. Se pueden hacer guardando
resultados intermedios:

```r
paso_1 <- filter(curso, transporte == "Metro")
paso_2 <- select(paso_1, comuna, minutos_viaje)
```

Funciona, pero obliga a inventar dos nombres que no le importan a nadie. Con el
pipe:

```r
curso %>%
  filter(transporte == "Metro") %>%
  select(comuna, minutos_viaje)
```

**La regla, textual del cuaderno:**

> `%>%` agarra lo que hay a su izquierda y se lo entrega como **primer
> argumento** a la función de su derecha. Por eso adentro de `filter()` ya no
> escribes `curso`: el pipe se lo pasó.

**Cómo se lee**, también textual: *"toma `curso`, **y luego** quédate con los que
van en metro, **y luego** muéstrame comuna y minutos de viaje."* El cuaderno
insiste en que si la cadena no se puede leer en voz alta, probablemente está mal
armada.

Dos reglas prácticas que se dijeron: el `%>%` va **al final de la línea, nunca al
principio de la siguiente**, y el atajo de teclado es **`Ctrl` + `Shift` + `M`**.

**El error propio del pipe**, y el que hay que cazar: volver a escribir la base
adentro de la función después de habérsela pasado —`curso %>% filter(curso,
dominio == "Deporte")`—. Es la señal de que el pipe se copió sin entenderlo.

**Más de una forma es correcta.** La versión sin pipe, con objetos intermedios, y
la versión anidada `select(filter(curso, ...), ...)` responden exactamente lo
mismo y valen igual. Escribirlo todo en una sola línea también.

<!-- section: mutate_y_count -->

## `mutate()`, y el par que resuelve el proyecto

La forma es siempre la misma:

```
mutate(nombre_nuevo = fórmula)
```

A la izquierda del `=`, el nombre que **el estudiante** elige: uno solo, sin
comillas, sin espacios. A la derecha, el cálculo. La columna nueva queda **al
final** de la tabla.

Acá el `=` sí va solo, y no se contradice con la regla del `filter()`: en
`mutate()` se está *guardando* una columna, no *preguntando* por un valor. Es
literalmente la distinción que el cuaderno enseña.

La fórmula no tiene por qué ser aritmética. También puede ser **una pregunta**, y
entonces la columna se llena de `TRUE` y `FALSE`:

```r
curso %>%
  mutate(es_apple = sistema_operativo == "iOS (Apple)") %>%
  count(es_apple)
```

Salida verificada: **27 `TRUE`, 6 `FALSE`.** El cuaderno lo remata así:

> Ése es el par que más van a usar en el proyecto: **`mutate()` para definir el
> grupo, `count()` para medirlo.**

**La receta completa**, las tres encadenadas, tal como se proyectó:

```r
curso %>%
  mutate(personas_casa = hermanos + 1) %>%
  filter(personas_casa >= 4) %>%
  select(comuna, personas_casa, dominio) %>%
  head()
```

Diez personas. Cuatro líneas que se leen como cuatro instrucciones en orden:
**toma, agrega, filtra, muestra.**

**Ojo con guardar.** Todo lo anterior se muestra en pantalla y se pierde. Para
conservar una columna nueva hay que escribir `curso <- curso %>% mutate(...)`.

<!-- section: un_filtro_puede_mentir -->

## El filtro que mintió sin avisar

Es la idea que la clase más quiere que quede.

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
viajan de todo el curso**.

### Por qué

Alguien escribió `10 min` en esa columna. Un solo valor con letras basta:
`minutos_viaje` deja de ser un número y pasa a ser **texto**. Y R, al comparar
texto, **no mide: deletrea**. Compara `"130"` con `"60"` letra por letra, ve que
`1` viene antes que `6`, y concluye que 130 es menor que 60.

Por eso sobrevivieron justo los que empiezan con 7, 8 y 9, y quedaron fuera los
que empiezan con 1.

### Lo peligroso, que es la mitad que casi nadie entrega

Textual del cuaderno:

> Lo peligroso no es el resultado: es que **no hubo ningún error ni ninguna
> advertencia**. La respuesta salió limpia, con cara de correcta.

Un error que rompe el código se arregla, porque avisa. Éste no avisa: entrega un
número plausible, bien formateado, que se copia al informe y nadie vuelve a
mirar. Y el sesgo no es aleatorio —se comió exactamente los casos extremos, que
suelen ser los que importan.

### Qué NO se puede exigir en esta ronda

Cómo arreglarlo. Convertir la columna a número es **la clase siguiente** (31 de
agosto), y el cuaderno lo anuncia expresamente como el gancho para la próxima.
Hoy la trampa sólo se diagnostica.

### Las otras columnas con la misma enfermedad

`estatura` (alguien escribió `1,60` con coma), `horas_sueno` (`3 horas`) y
`horas_redes` (`5 horas`). Las columnas que sí son números de verdad son `edad`,
`hermanos` y `tazas_cafe`.

<!-- section: audiencia_y_sprint1 -->

## El demo del Sprint 1: cuatro decisiones en cuatro minutos

Hoy el profesor presentó en sala un ejemplo completo del Sprint 1 —que los
estudiantes entregan el **31 de agosto**— en formato Pecha Kucha: 12 láminas de
20 segundos, sin control remoto. Título: **«¿La IA nivela o separa?»**.

### Decisión 2 · La audiencia: «tiene que tener puerta»

La frase de la lámina 05, textual:

> «Las personas interesadas en el tema» **no es una audiencia**. Una audiencia es
> alguien a quien uno podría ir a buscar **esta misma semana**.

La del demo: la **Comisión de uso de IA en el pregrado de la UAI**, y se nombraron
las tres cosas que la hacen una audiencia y no un tema:

| | |
|---|---|
| **Quiénes** | Dirección de pregrado y coordinaciones de carrera, hoy redactando la norma |
| **Dónde** | Campus Peñalolén. Se les puede pedir reunión |
| **Cuándo** | La norma se discute este semestre |

Y para qué le sirve: hoy escriben la norma con **anécdotas**; con esta tabla la
escriben con un **denominador**. De ahí sale la regla que cierra la lámina 06:
*"si esa comisión no entendería uno de mis gráficos, ese gráfico está mal, aunque
sea correcto."*

### Decisión 1 · La pregunta, y sus cuatro requisitos

*"«IA y desigualdad» es un tema. Esto es una pregunta:* entre 2023 y 2026, ¿en
qué **proporción** de los experimentos la brecha se cierra y en qué proporción se
abre?*"* — y se responde **contando filas**.

Los cuatro chequeos: unidad de observación (**el experimento, no la persona**),
período (2023–2026), territorio (global) y **el verbo prohibido** (*"no pregunto
por qué separa; pregunto en cuántos casos separa"*).

### Decisión 3 · La fuente, y sus límites

`experimentos_ia_desempeno.csv`: **7 experimentos, 13 columnas, una fila por
estudio**, construida a mano leyendo los papers. Tres límites declarados:

- **Sin periodicidad**: es un corte al 21 de agosto de 2026.
- **n = 7**, y *"los resultados nulos casi no se publican"*.
- **No son comparables**: un estudio mide utilidades y otro mide notas.

De ahí la frase que cierra la lámina 08: *"Puedo contar **direcciones**; no puedo
promediar magnitudes. Por eso mi pregunta dice «en qué proporción» y no «cuánto».
**La pregunta se ajustó a la fuente, no al revés**."*

### Decisión 4 · Los datos, en cuatro líneas

```r
library(dplyr)
exp <- read.csv("experimentos_ia_desempeno.csv")

exp %>%
  count(ambito, efecto_promedio_signo, sort = TRUE)
```

Salida: trabajo/positivo 3 · aprendizaje/negativo 2 · aprendizaje/positivo 1 ·
trabajo/nulo 1. *"Todo esto salió de la clase 3."* Es el mismo pipe del cuaderno
de hoy, proyectado en el demo.

### El bloque de evidencia: ¿la IA nos está haciendo peores?

Antes del demo se vieron dos experimentos. **Kenia**: 640 emprendedores con un
asistente GPT-4 por WhatsApp; efecto promedio cero, escondiendo **+15% a los que
ya iban bien y −8% a los que iban mal**. **China**: 26.811 estudiantes, 30 meses;
tareas +18%, tiempo −30%, prueba de libro cerrado −20%, y la pérdida es **mayor
entre los de alto rendimiento**.

El dato que la clase señaló como decisivo: *"quien usó la IA y se demoró lo mismo
que antes, casi no perdió nada"*. Y en Turquía, el tutor **con barandas** —el que
pregunta en vez de responder— no produjo daño en la prueba, mientras el grupo sin
barandas quedó 17% abajo.

El cierre, lámina 12: **«La IA no separa a los buenos de los malos. Separa a los
que la usan como andamio de los que la usan como muleta.»**
