# Clase 2 — Primeros pasos en R y en Colab

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología - Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 2 de 15, lunes 10 de agosto de 2026.

**Son estudiantes de primer año y esta es la primera clase de su vida en que
programan.** Ninguno había usado Google Colab antes de hoy. No saben qué es una
variable, una función ni un archivo `.csv`. Vienen de ciencias sociales y
negocios, no de ingeniería.

Lo evaluable acá es **el criterio**, no la sintaxis: qué preguntarle a unos
datos, qué se puede y qué no se puede concluir, y cómo comunicarlo. Nadie tiene
que recordar cómo se escribe una función. **No penalices que no usen vocabulario
técnico** ni que escriban "el `$`" en vez de "el operador de selección de
columna". Penaliza que afirmen cosas que el dato no sostiene.

Las respuestas se escriben en dos minutos y medio desde un teléfono. Tres líneas
bien puestas valen 100. Escribir más no sube el puntaje.

El material de la clase fueron tres cuadernos de Colab en R: el 1 sobre la
herramienta, el 2 sobre las respuestas del propio curso a una encuesta que
contestaron ese mismo día, y el 3 sobre una encuesta grande de estudiantes UAI.
**Es posible que la clase no alcance a llegar al cuaderno 3**, así que ninguna
pregunta exige haberlo visto.

## Lo que está fuera de alcance en esta clase

No han visto `dplyr` ni el pipe (`%>%`), no han visto `ggplot2`, y **no van a ver
inferencia estadística en ningún momento del curso**: nada de tests de hipótesis,
valores-p, intervalos de confianza ni regresión. El curso es descriptivo.

Si una respuesta invoca un test estadístico, no está siendo sofisticada: está
fuera de lo que se enseñó. Tampoco se espera que instalen paquetes: todo es R
base.

<!-- section: colab_como_herramienta -->

## Google Colab: qué es y dónde corre

Colab es una herramienta gratuita de Google para escribir y ejecutar código
**desde el navegador**. Tres hechos que el cuaderno 1 subraya:

- **No se instala nada.** El código no corre en el computador del estudiante:
  corre en un computador de Google al que se conecta por internet. Un Chromebook
  viejo y un notebook caro funcionan igual.
- **Se guarda en Google Drive**, como un documento cualquiera, y se comparte con
  un link igual que un Google Doc.
- **Mezcla texto y código.** Un cuaderno no es sólo un programa: es un documento
  donde conviven la explicación, el código, los resultados y los gráficos.

Sobre esto último el cuaderno es explícito: *"En este curso no basta con que el
código funcione: tiene que quedar claro **por qué** hiciste lo que hiciste."*

### El cuaderno es del profesor hasta que haces tu copia

El cuaderno que se abre desde el link de la clase es **del profesor**. Se puede
ejecutar, pero lo que el estudiante escriba ahí **no se guarda en ninguna parte**.
El primer movimiento de toda clase es **Archivo → Guardar una copia en Drive**,
que abre una pestaña nueva con una copia propia en la carpeta *Colab Notebooks*.

### Celdas

Un cuaderno está hecho de celdas y hay sólo dos tipos: **de texto** (explicaciones
en Markdown, para humanos) y **de código** (instrucciones que el computador
ejecuta, con fondo gris y un ▶ a la izquierda).

Se ejecutan de tres formas: el botón ▶, **Shift + Enter** (ejecuta y salta a la
siguiente) o **Ctrl + Enter** (ejecuta y se queda ahí).

### R y Python

Colab sirve para varios lenguajes y viene en Python por defecto. **Un cuaderno usa
un solo lenguaje a la vez.** Se cambia en:

> **Entorno de ejecución → Cambiar tipo de entorno de ejecución**

Cambiar de lenguaje **reinicia el cuaderno y borra todo lo calculado**; el texto y
el código escrito no se pierden, pero hay que volver a ejecutar todo.

Para saber en cuál se está, se ejecuta `R.version.string`: si responde algo como
`'R version 4.4.1'` está en R; si aparece un error rojo con `NameError` o
`SyntaxError`, está en Python.

El curso usa R porque nació dentro de la estadística y las ciencias sociales:
leer una base, describirla y graficarla requiere menos código y menos conceptos
previos.

<!-- section: entorno_de_ejecucion -->

## El entorno de ejecución, la memoria y el orden

El **entorno de ejecución** es el computador de Google que quedó prestado. Tres
cosas que hay que saber:

1. **Tiene memoria.** Lo que se calcula en una celda queda disponible para las
   siguientes.
2. **El orden importa**, y es el orden en que **el estudiante ejecuta**, no el
   orden en que las celdas están escritas en la página.
3. **Se desconecta solo** después de un rato de inactividad. Cuando eso pasa se
   pierde **lo calculado**, no lo escrito, y hay que volver a ejecutar.

### `object 'x' not found` no significa que el código esté malo

Este es el error más importante de la clase, y el cuaderno lo dice con estas
palabras: si se ejecuta `mi_numero * 3` en un cuaderno recién abierto, sale
`object 'mi_numero' not found`, **"que no significa que el código esté malo, sino
que ese objeto todavía no existe en la memoria"**.

Es el error que van a tener todos esta semana, y confundirlo con "el código está
malo" lleva a borrar código que estaba perfecto.

### El botón que arregla el 90% de los problemas

> **Entorno de ejecución → Reiniciar y ejecutar todo**

Borra la memoria y vuelve a ejecutar el cuaderno completo de arriba hacia abajo,
en orden. Es el equivalente a apagar y prender.

<!-- section: objetos_y_tipos_en_r -->

## Objetos, nombres y tipos en R

- `<-` significa *"guarda esto adentro de"*. A lo guardado se le llama **objeto**:
  `mi_edad <- 19`.
- Reglas de los nombres: sin espacios (se usa `guion_bajo`), no empiezan con
  número, y **R distingue mayúsculas de minúsculas** (`Edad` ≠ `edad`).
- Una **función** es una orden con nombre que recibe lo que necesita entre
  paréntesis: `mean(algo)`.
- **Los números van pelados; el texto siempre entre comillas.** El ejemplo exacto
  del cuaderno es `altura <- 1.72` (número, sin comillas) y `comuna <- "Ñuñoa"`
  (texto, con comillas). `class()` dice de qué tipo es cada uno.

Sobre los errores rojos, el cuaderno es explícito: hay que leerlos, casi siempre
dicen qué pasó, y copiarlos y preguntarle a una IA *"¿qué significa este error en
R?"* es **uso legítimo de IA en este curso: entender, no reemplazar tu
pensamiento**.

<!-- section: la_base_de_datos -->

## Del formulario a una base de datos

La cadena que el curso repite en el proyecto:

```
Google Form  →  Planilla de respuestas  →  R / Colab
                (una fila por persona,      (describir,
                 una columna por pregunta)   graficar)
```

Para que R pueda leer la planilla hay que compartirla como **"cualquier persona
con el enlace → Lector"** y transformar el link en uno de descarga en formato CSV
(`.../export?format=csv`). **CSV** es *comma-separated values*: un archivo de
texto con las columnas separadas por comas.

Se carga con `read.csv()`. El objeto que resulta es un **data frame**: una tabla
con **filas (personas)** y **columnas (variables)**. Es lo mismo que una planilla
de Excel, pero manipulable con código —y por lo tanto reproducible, auditable y
reutilizable. Es *la* estructura de todo el semestre.

- `nrow()` devuelve cuántas filas hay, es decir **cuántas personas respondieron**.
- `ncol()` devuelve cuántas columnas hay, es decir **cuántas preguntas tenía el
  formulario**.
- `head()` muestra las primeras filas; `str()` da la radiografía completa.
- `names()` sirve para renombrar las columnas, que vienen con la pregunta
  completa del formulario y son ilegibles. Los nombres nuevos se asignan **en el
  orden en que están las columnas** y tiene que haber exactamente uno por columna.
- `$` es la regla de oro: `base$columna` se lee *"la columna `columna` de la base
  `base`"*.

<!-- section: tipos_de_variable -->

## El tipo de variable define qué pregunta tiene sentido hacerle

`str()` pone una etiqueta al lado de cada variable:

- `int` o `num` → **numérica**: tiene sentido preguntarle un **promedio**.
- `chr` → **texto**, categórica: tiene sentido preguntarle **cuántos hay de cada
  tipo**.

El cuaderno lo dice así: *"Esa distinción no es un detalle técnico: **define qué
preguntas puedes hacerle a cada variable**. Preguntar el promedio de las comunas
no significa nada."*

Para una variable numérica: `mean()` (promedio), `median()` (el valor del medio),
`sd()` (dispersión), `summary()` (todo de una vez: mínimo, cuartiles, mediana,
media y máximo) y `round()` para los decimales. Reportar `38.4` minutos informa;
reportar `38.42105263157895` sólo hace ruido.

Para una variable categórica: `table()` cuenta cuántos hay de cada categoría.

**La moda** —el valor más frecuente— es lo que corresponde reportar de una
variable de texto. R no trae una función para eso, pero se arma a partir de la
tabla de frecuencias: `names(which.max(table(x)))`. Ese es el reemplazo correcto
cuando alguien pide "el promedio" de algo que no es numérico.

Cuidado con el caso inverso: que algo sea un número no lo convierte en numérico.
Una columna con el código de la sección se lee como número, pero "la sección
promedio" no significa nada.

<!-- section: frecuencias_y_porcentajes -->

## Conteos y porcentajes

`table()` entrega **conteos absolutos**. El cuaderno advierte que *"los conteos
absolutos se comparan mal. Casi siempre queremos porcentajes"*, y para eso está
`prop.table()`, que convierte la tabla en proporciones.

La razón es la que importa: **el mismo conteo sobre grupos de distinto tamaño
significa cosas distintas.** Diez personas de un grupo de 40 son el 25%; diez
personas de un grupo de 25 son el 40%. Comparar los dos "diez" como si fueran lo
mismo es uno de los errores más frecuentes en visualización de datos, y casi
siempre hay que normalizar por el tamaño del grupo antes de comparar.

De ahí también sale la regla de reportar el `n`: un porcentaje sin el tamaño del
grupo sobre el que se calculó puede mentir sin decir nada falso.

<!-- section: describir_una_muestra -->

## Describir una muestra sin sobre-afirmar

Describir empieza por decir **a quién describen los datos**. La encuesta grande
del cuaderno 3 tiene **458 respuestas de estudiantes UAI de los campus de
Santiago y Viña, recogidas en 2022 y 2023**, y sólo de quienes quisieron
responder.

Eso acota lo que se puede afirmar. Un resultado de esa base describe a esos 458
estudiantes; no describe a los estudiantes chilenos, ni a los jóvenes en general,
ni al curso de este año. Ampliar el sujeto de la frase es la forma más común de
sobre-afirmar, y es la que este curso persigue desde la primera semana.

Las tres preguntas que el curso enseña a hacerle a cualquier base:

1. **¿De dónde vienen estos datos y quién quedó fuera?**
2. **¿Qué mide realmente cada variable?** (una estatura declarada no es una
   estatura medida)
3. **¿Qué tuve que decidir para poder calcular algo?**

### Correlación no es causalidad

Aunque una nube de puntos se vea inclinada, eso no prueba que una cosa cause la
otra: podría ser al revés, o podría haber un tercer factor detrás de ambas. El
cuaderno lo dice como advertencia de todo el semestre: *"este curso es de
descripción: mostramos patrones con honestidad y dejamos explícitos los límites
de lo que podemos afirmar"*.

### Un gráfico debe poder leerse solo

Título, ejes con nombre y unidades. Un histograma cuyo título es el nombre de una
variable interna y cuyo eje X no dice unidades **funciona** pero no comunica. El
color codifica información, no decora.

### El dato concreto del gráfico de esta clase

Sistema operativo del celular, en esa misma encuesta de 458 estudiantes UAI de
2022-2023: **iOS (Apple) 360, Android 92, HarmonyOS (Huawei) 5, Otro 1**. En
porcentajes, iOS es el 78,6%. El cuaderno lo presenta como *"un dato con el que
siempre se sorprende el curso"*.

Es una barra que aplasta a las demás, así que leer **qué** muestra es fácil. Lo
que separa una descripción buena de una mediocre es lo otro: que quede claro que
esto describe a estudiantes de una universidad, de dos campus, que quisieron
contestar una encuesta hace tres o cuatro años, y no a "los jóvenes", "los
chilenos" ni "la gente".
