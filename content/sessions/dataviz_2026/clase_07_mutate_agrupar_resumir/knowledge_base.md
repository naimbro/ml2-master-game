# Clase 7 — `mutate()`, agrupar y resumir, hasta que salgan solos

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 7 de 15, lunes 21 de septiembre de
2026. **Son 33 estudiantes de primer año.**

Llevan **seis clases programando en su vida**: de la 2 a la de hoy. Vienen de
ciencias sociales y negocios, no de ingeniería. Antes de la clase 2 ninguno había
programado nunca.

**El cuaderno de hoy fue puro repaso, y por eso el estándar es «¿corre y
contesta bien?».** No hubo ninguna función nueva: `mutate()`, `group_by()`,
`summarise()` y `arrange()` se enseñaron en la clase 6 (7 de septiembre) y hoy se
repitieron durante cincuenta minutos, primero con el profesor corriéndolas en
pantalla y después con ellos escribiéndolas sobre la misma base. El juego cierra
la clase, cerca de las 12:10, después de una presentación de veinte minutos sobre
el Sprint 2.

**Las seis rondas de esta sesión son abiertas, las seis piden escribir R, y las
seis piden DOS COSAS numeradas (1) y (2).** En R1 y R6 las dos son código; en R2,
R3, R4 y R5 una es código y la otra es una línea de castellano. Las dos partes se
califican, y **media respuesta no puede pasar de 40 en Exactitud** por muy
impecable que esté la mitad que llegó.

**Cuando se pidió código**, lo evaluable es si eso, pegado en un Colab que ya
tiene `cep` (o `curso`) cargada, **corre y contesta lo que se preguntó**. El
enunciado dice «sólo el código, sin explicarlo»: un bloque de R sin una palabra
de prosa alrededor es exactamente lo que se pidió.

**Cuando se pidió castellano**, no se necesita vocabulario técnico: «el promedio
de algo que incluye un no sé es no sé» vale exactamente lo mismo que «`mean()`
propaga los valores perdidos».

La respuesta se escribe en dos o tres minutos desde un teléfono. **Escribir más
no sube el puntaje**: premia densidad, no extensión. Y no se cobra indentación,
tipo de comillas, saltos de línea, ni un paréntesis de cierre que falta cuando la
intención es inequívoca.

Si un estudiante objeta el enunciado —dice que la premisa le suena falsa o que
falta información— eso **no se penaliza nunca**. Si tiene razón, el problema es
del enunciado.

## Lo que este curso ha visto, y nada más

**De `dplyr`:** `library()`, `read.csv()`, `count()` (con una columna, con dos,
y con `sort = TRUE`), `select()`, `filter()`, `mutate()`, el pipe `%>%`, y desde
la clase 6: `group_by()`, `summarise()`, `n()`, `arrange()` y `desc()`. De R
base: `nrow()`, `ncol()`, `names()`, `head()`, `class()`, `as.numeric()`,
`mean()` con `na.rm = TRUE`, `sum()`, `is.na()` y `!`, los
operadores `==`, `!=`, `>`, `<`, `>=`, `<=`, `&` y `|`.

**No han visto** `ggplot2` (es la clase siguiente), `case_when()`, ni `if_else()`.
**`ifelse()` aparece en el cuaderno de hoy pero NO se pasa en clase**: ninguna
ronda lo pregunta, no se exige, y si alguien lo usa y corre, vale igual. Tampoco
han visto
`filter(!is.na(...))` como técnica enseñada, `n_distinct()`, `mutate(across())`,
`pivot_*`, ni `left_join()`. Y **no van a ver inferencia estadística en ningún
momento del curso**: nada de tests, valores-p, intervalos de confianza, márgenes
de error, regresión ni representatividad muestral formal. Si una respuesta invoca
cualquiera de esas cosas, no está siendo sofisticada: está fuera de lo que se
enseñó, y no suma.

**Regla de arbitraje, y manda sobre cualquier lista.** Si un estudiante responde
con algo correcto que no se enseñó —`|>`, `%in%`, `n = n()`,
`sum(x) / n()` en vez de `mean(x)`, `na.rm = T`, `count()` donde cabe, la
comparación metida directamente adentro del `mean()` sin pasar por `mutate()`,
sobrescribir la columna original, guardar pasos en objetos intermedios— **vale
igual**. No confundas «no está en el cuaderno» con «está mal». La pregunta es
siempre si corre y contesta bien.

## Las dos bases

### `cep`: la CEP consolidada

`cep_consolidada_1994_2026.csv`: **96.122 filas** (personas encuestadas) entre
1994 y 2026. Se carga con `read.csv()` y queda como `cep`. Sus columnas, con el
nombre exacto:

`encuesta`, `anio`, `mes`, `sexo`, `edad`, `edad_tramo`, `anios_escolaridad`,
`gse`, `zona`, `region`, `problema_1`, `problema_2`, `problema_3`,
`sit_econ_pais`, `sit_econ_pais_futuro`, `sit_econ_propia`,
`sit_econ_propia_futuro`, `chile_hoy`, `aprueba_presidente`,
`posicion_politica`, `partido`, `religion`, `asiste_iglesia`, `personas_hogar`,
`ponderador`.

Los valores que importan para esta sesión, escritos tal cual están en la base:

| Columna | Valores | Cuántos |
|---|---|---|
| `sexo` | `"Mujer"` · `"Hombre"` | 56.595 · 39.527 (no hay vacíos) |
| `edad` | numérica | **4.562 personas sin edad (`NA`)**, casi la mitad de las encuestas de 1996 a 1998 |
| `sit_econ_pais` | `"Ni buena, ni mala"` · `"Mala"` · `"Buena"` · `"Muy mala"` · `"Muy buena"` · `"No sabe"` · `"No contesta"` | 42.478 · 30.664 · 12.151 · 9.634 · 700 · 329 · 166 (no hay vacíos) |
| `chile_hoy` | `"Estancado"` · `"Progresando"` · `"En decadencia"` · **vacío `""`** · `"No sabe"` · `"No contesta"` | 45.777 · 28.110 · 15.405 · **4.515** · 1.889 · 426 |
| `gse` | `"D"` · `"C3"` · `"C2"` · `"E"` · `"ABC1"` · vacío `""` | 39.902 · 38.998 · 10.028 · 3.674 · 3.515 · **5** |
| `anio` | 1994 a 2026, **sin 2020** | 32 años distintos |

R distingue mayúsculas: `Sexo`, `"mujer"`, `Sit_econ_pais` o `"muy mala"` no
existen en esta base. Con un nombre de columna equivocado la cadena no corre;
con un valor equivocado corre y devuelve cero o `FALSE` para todo el mundo.

### `curso`: la encuesta del propio curso

`encuesta_curso.csv`: **33 filas y 16 columnas**, las respuestas de ellos
mismos, recogidas en la clase 2. Columnas: `edad`, `estatura`, `hermanos`,
`comuna`, `minutos_viaje`, `transporte`, `horas_sueno`, `horas_redes`,
`sistema_operativo`, `tazas_cafe`, `experiencia`, `dominio`,
`op_grafico_miente`, `op_interes_programar`, `op_datos_chile`,
`op_hablar_publico`.

`transporte`: `"Micro o bus"` 15 · `"Auto"` 12 · `"Metro"` 6.
`minutos_viaje` es **texto** (`class()` devuelve `"character"`) porque una
persona escribió `10 min`; sus valores son 10, 10 min, 15, 30 (×4), 40 (×5),
50 (×3), 60 (×4), 70 (×4), 80, 85, 90 (×4), 100, 130, 150 y 180.

<!-- section: mutate_tres_formas -->

## `mutate()`: una columna que no venía en el archivo (Parte A1 del cuaderno 7)

Textual del cuaderno de hoy:

> `mutate()` no cambia las filas: la tabla sigue teniendo 96.122 personas. Lo
> que hace es **agregar una columna al final**, y hay tres formas de llenarla.

**Forma 1: comparar un número.**

```r
cep %>%
  mutate(mayor_60 = edad >= 60) %>%
  count(mayor_60)
```

Tres filas: 67.457 `FALSE`, 24.103 `TRUE` y **4.562 `NA`**. Textual: *«Esas
4.562 personas no tienen edad en la base, y R no inventa: si no sabe la edad,
tampoco sabe si es mayor de 60.»*

**Forma 2: comparar un texto.** Dos valores de la misma columna se juntan con
`|`, que significa **o**:

```r
cep %>%
  mutate(econ_mala = sit_econ_pais == "Mala" | sit_econ_pais == "Muy mala") %>%
  count(econ_mala)
```

40.298 `TRUE` y 55.824 `FALSE`, y esta vez **no hay fila `NA`**: todo el mundo
contestó algo en esa columna. Cada lado del `|` es una comparación completa:
`sit_econ_pais == "Mala" | "Muy mala"` no sirve. Y con `&` en vez de `|` la
columna sale `FALSE` para todos, porque nadie contestó las dos cosas a la vez:
corre sin error y contesta mal.

**Forma 3 (`ifelse()`) no se pasa en clase**: está en el cuaderno como
lectura, pero ninguna ronda la pregunta ni la exige.

> Distintas formas, una sola idea: **`mutate(nombre_nuevo = cálculo)`**.

**Un solo `mutate()` puede crear dos columnas**, separadas por coma, y la
segunda puede usar la primera, porque `mutate()` trabaja de arriba hacia abajo.

**El ejercicio 3 del cuaderno**, que se hizo en sala: *«¿qué porcentaje de las
personas encuestadas son mujeres? Necesitas un `mutate()` que compare `sexo` con
`"Mujer"`…»*. La línea es `mutate(mujer = sexo == "Mujer")`, y `count(mujer)`
devuelve dos filas: `TRUE` 56.595 y `FALSE` 39.527, sin `NA`.

**Los errores que esta forma produce, todos vistos en clase:**

| Lo que escribe | Qué pasa |
|---|---|
| `mutate(mujer = sexo = "Mujer")` | Un solo `=` donde iba `==`. No corre. |
| `mutate(mujer = sexo == "mujer")` | Corre, y `mujer` sale `FALSE` para las 96.122 personas: el valor está escrito `Mujer`. |
| `mutate(mujer = Sexo == "Mujer")` | `Sexo` con mayúscula no es una columna de esta base. No corre. |
| `mutate(mujer = sexo == Mujer)` | Sin comillas, R busca un objeto llamado `Mujer`. No corre. |
| `filter(mujer == TRUE)` antes del `mutate()` que crea `mujer` | La columna todavía no existe cuando el filtro la busca. No corre. |

`mutate(mujer = sexo == "Mujer")` y `mutate(mujer = (sexo == "Mujer"))` son lo
mismo. 

<!-- section: summarise_y_na -->

## `summarise()`, `n()`, `mean()` y el `NA` (Parte A2 del cuaderno 7 y Parte 2 del cuaderno 6)

Textual del cuaderno de hoy:

> `summarise()` hace lo contrario de `mutate()`: **aplasta la tabla** en una
> sola fila. Adentro se escribe `nombre = cálculo`, separados por coma, y cada
> cálculo convierte una columna entera en un solo número.

```r
cep %>%
  mutate(econ_mala = sit_econ_pais == "Mala" | sit_econ_pais == "Muy mala") %>%
  summarise(personas = n(),
            edad_promedio = mean(edad, na.rm = TRUE),
            pct_econ_mala = mean(econ_mala) * 100)
```

Una fila, tres números: **96.122 personas, 46,7 años de edad promedio, 41,9% ve
mal la economía.** Y las tres cosas que el cuaderno pide mirar, textual:

> - `n()` cuenta las filas. Va sin nada adentro del paréntesis.
> - `mean(edad, na.rm = TRUE)`: sin el `na.rm = TRUE` el promedio sale `NA`,
>   porque hay 4.562 edades que faltan y el promedio de algo que incluye un «no
>   sé» es «no sé». `econ_mala` no lo necesita, porque no tiene `NA`.
> - **`mean(econ_mala) * 100` es un porcentaje.** R trata `TRUE` como 1 y
>   `FALSE` como 0, así que el promedio de una columna de `TRUE`/`FALSE` es la
>   proporción. Ésa es la receta de todo el cuaderno.

### El promedio que salió `NA`

`cep %>% summarise(edad_promedio = mean(edad))` devuelve **`NA`**, sin error ni
advertencia. `edad` **es numérica**: no es el problema de la columna de texto de
la clase 5. El problema es que 4.562 personas no tienen edad, y `mean()` no se
salta los `NA` a menos que se le pida. La clase 6 lo había visto ya con los
siete experimentos: *«No es un error de R: es R siendo honesto. […] el promedio
de algo que incluye un «no sé» es, correctamente, «no sé». Para pedirle que lo
ignore hay que decírselo explícitamente:»*

```r
cep %>%
  summarise(edad_promedio = mean(edad, na.rm = TRUE))
```

**46,7.** El `na.rm = TRUE` va **adentro del `mean()`**, no adentro del
`summarise()` ni suelto en la cadena. `na.rm = T` funciona igual. Y otras
escrituras que también devuelven 46,7 valen igual: `filter(!is.na(edad))` antes
del `summarise()`, o `mean(edad[!is.na(edad)])`.

**Diagnósticos equivocados, que usan vocabulario correcto para algo que no
pasó:** que la columna es texto (el enunciado dice que `class()` devuelve
`"numeric"`); que `summarise()` está mal escrito; que hay que usar `count()`;
que R dio un error (no lo dio: devolvió `NA` en silencio). Y **«hay que sacar
los NA» dicho sin escribir la línea** es media respuesta: el arreglo tiene que
estar escrito.

### `n()` cuenta filas, no datos válidos

Textual del cuaderno 6: *«la tabla dice `estudios = 7`, pero el promedio se
calculó con 6. `n()` cuenta filas, no cuenta datos válidos.»* Los casos que sí
tienen dato se cuentan con `sum(!is.na(columna))`.

### El ejercicio 3 completo

```r
cep %>%
  mutate(mujer = sexo == "Mujer") %>%
  summarise(personas = n(),
            pct_mujeres = mean(mujer) * 100)
```

**96.122 y 58,9%.** `mean(sexo == "Mujer") * 100` directo adentro del
`summarise()`, sin `mutate()`, da lo mismo y vale igual. `mean(sexo)` no: el
promedio de una columna de texto no existe. `n` sin paréntesis no corre.

<!-- section: group_by_y_receta -->

## `group_by()` y la receta completa (Partes A3 y A4 del cuaderno 7)

Textual:

> `group_by()` **no hace nada solo**: es una instrucción para el `summarise()`
> que viene después. Le dice «esto, pero una vez por cada grupo».

```r
cep %>%
  mutate(econ_mala = sit_econ_pais == "Mala" | sit_econ_pais == "Muy mala") %>%
  group_by(sexo) %>%
  summarise(personas = n(),
            edad_promedio = mean(edad, na.rm = TRUE),
            pct_econ_mala = mean(econ_mala) * 100)
```

**Mujeres 45,5%, hombres 36,9%** (56.595 y 39.527 personas). Textual: *«Ocho
puntos y medio de diferencia que el 41,9% de recién escondía por completo.
Misma base, mismas funciones, una línea de diferencia.»* La tabla sale como
`# A tibble`: `group_by()` devuelve un formato distinto, que imprime más
ordenado y sólo las diez primeras filas.

**Una fila por grupo.** `summarise()` después de `group_by()` devuelve
exactamente **tantas filas como valores distintos tenga la columna del
`group_by()`**, y los `NA` cuentan como un grupo más: agrupando por una
columna calculada desde `edad` aparece una fila `NA` con 4.562 personas y
`edad_promedio` en `NaN`.
Textual: *«No es un error, es la base diciéndote que ese grupo existe. En un
indicador publicado esa fila se filtra o se declara; nunca se ignora.»*

### La receta completa

La pregunta: **¿en qué año Chile vio peor su economía?**

```r
cep %>%
  mutate(econ_mala = sit_econ_pais == "Mala" | sit_econ_pais == "Muy mala") %>%
  group_by(anio) %>%
  summarise(personas = n(),
            pct_econ_mala = mean(econ_mala) * 100) %>%
  arrange(desc(pct_econ_mala))
```

**1999 con 63,4%** (3.009 personas) —la crisis asiática— y pegado, **2022 con
63,3%** (2.796). Después 2023 con 61,7% y 2001 con 60,1%. Al otro extremo, 2010
con 27,1%. Textual: *«Treinta y dos años de ánimo económico en una tabla que se
lee en diez segundos.»*

**La tabla tiene 32 filas: una por año**, porque `anio` tiene 32 valores
distintos. De 1994 a 2026 son 33 años, pero **no hay encuesta 2020**: la CEP no
salió a terreno en pandemia (control 1 de la clase 6). Nadie tiene
`sit_econ_pais` vacío, así que no aparece ninguna fila `NA`.

| Línea | Qué hace |
|---|---|
| `mutate()` | crea la columna `TRUE`/`FALSE` que te interesa |
| `group_by()` | parte la tabla en grupos |
| `summarise()` | cuenta cuántos son (`n()`) y promedia los `TRUE` |
| `arrange(desc())` | ordena de mayor a menor |

**Sobre el orden.** Textual del cuaderno 6: *«`count()` tenía su `sort = TRUE`,
pero `summarise()` no trae nada parecido, así que se ordena aparte con
`arrange()`, y `desc()` lo hace de mayor a menor.»* `arrange()` sin `desc()`
ordena de menor a mayor. `arrange(-pct_econ_mala)` también ordena de mayor a
menor y vale igual.

**Los errores de esta receta, y qué hace cada uno:**

| Lo que escribe | Qué pasa |
|---|---|
| `&` en vez de `\|` en el `mutate()` | Corre. `econ_mala` sale `FALSE` para todos y el porcentaje da 0,0% en los 32 años. Contesta mal. |
| `group_by(anio)` DESPUÉS del `summarise()` | No corre: después de `summarise()` la columna `anio` ya no existe. Y si va sin `group_by()`, devuelve una sola fila (41,9%) en vez de 32. |
| `summarise()` sin `n()` | Corre, pero falta la columna `personas` que se pidió. Incompleto, no incorrecto. |
| `personas = n` sin paréntesis | No corre. |
| `sort = TRUE` adentro del `summarise()` | Corre, crea una columna que se llama `sort`, y no ordena nada. Contesta mal. |
| `arrange(pct_econ_mala)` sin `desc()` | Corre y ordena de menor a mayor: 2010 primero. Contesta al revés de lo pedido. |
| `mean(sit_econ_pais == "Mala" \| "Muy mala")` | El segundo valor sin repetir la columna. No corre: cada lado del `\|` tiene que ser una comparación completa. |
| `"Muy Mala"`, `"mala"`, `Sit_econ_pais` | Valor o columna con otra mayúscula: el valor corre y da `FALSE` para esos casos; la columna no corre. |

**Escrituras que también devuelven la misma tabla y valen 100:** la comparación
directa adentro del `summarise()` sin `mutate()`
(`pct_econ_mala = mean(sit_econ_pais == "Mala" | sit_econ_pais == "Muy mala") * 100`),
`%in% c("Mala", "Muy mala")`, `|>` en vez de `%>%`, `n = n()` en vez de
`personas = n()`, `sum(econ_mala) / n() * 100`, o `count(anio, econ_mala)`
seguido de una cuenta a mano (más largo, pero llega).

<!-- section: los_tres_controles -->

## Los controles antes de publicar (Parte 6 del cuaderno 6, ejercicios 6 y 8 del cuaderno 7)

Textual del cuaderno 6: *«`summarise()` nunca te va a avisar que la tabla que
produjo no significa nada. Estos tres controles son los que hay que correr
**antes** de publicar cualquier comparación.»*

**Control 1 — ¿Están todos los grupos?** `cep %>% count(anio)`: después de 2019
viene **2021**. *«No hay encuesta 2020: la CEP no salió a terreno en pandemia.»*

**Control 2 — ¿La columna estuvo siempre?** `posicion_politica` está
completamente vacía desde 2021; se ve con
`summarise(personas = n(), con_posicion = sum(posicion_politica != ""))` por
año. Textual: *«cualquier análisis político con los datos recientes es
imposible, y hay que decirlo, no rodearlo.»* El ejercicio 8 de hoy hace lo mismo
con `sum(!is.na(anios_escolaridad))`: esa columna está **vacía desde 2021**.

**Control 3 — ¿Cuántos son en cada grupo?** El segmento **E tiene 9 personas**
en 2026 (C3 tiene 791). Textual: *«Un promedio sin `n()` es una opinión con
decimales.»* En la serie completa E tiene 3.674.

### El grupo sin nombre (ejercicio 5 del cuaderno 7)

Textual del enunciado: *«Agrupa por `gse` (nivel socioeconómico) y pide dos
cosas: `personas` con `n()` y `edad_promedio` con `mean()`. […] Mira la primera
fila de la tabla con atención: hay un grupo que no tiene nombre. ¿Cuántas
personas tiene?»*

```r
cep %>%
  group_by(gse) %>%
  summarise(personas = n(),
            edad_promedio = mean(edad, na.rm = TRUE))
```

| gse | personas | edad_promedio |
|---|---|---|
| `""` (vacío) | **5** | 40,0 |
| ABC1 | 3.515 | 45,4 |
| C2 | 10.028 | 46,6 |
| C3 | 38.998 | 46,7 |
| D | 39.902 | 46,8 |
| E | 3.674 | 47,2 |

La primera fila **no es un nivel socioeconómico**: son cinco personas (dos
encuestas, 2005 y 2024) a las que les falta el dato, y `group_by()` las trata
como un grupo más porque para R `""` es un valor como cualquier otro. Es la
misma lección que la fila `NA` de la Parte A del cuaderno: *«en un indicador
publicado esa fila se filtra o se declara; nunca se ignora»*. Y es el control 3
en su forma más pura: cinco personas no sostienen ningún titular, por muy
prolija que se vea la fila.

**Cómo se saca.** Esas celdas son **texto vacío, no `NA`**: `is.na(gse)` no las
encuentra. La forma que la clase 6 usó para lo mismo con `posicion_politica` es
`!= ""`:

```r
cep %>%
  filter(gse != "") %>%
  group_by(gse) %>%
  summarise(personas = n(),
            edad_promedio = mean(edad, na.rm = TRUE))
```

También sirven `filter(gse %in% c("ABC1", "C2", "C3", "D", "E"))`, la lista de
los cinco con `|`, o `filter(!(gse == ""))`. **No sirve** `filter(!is.na(gse))`:
corre sin error y no saca nada. Y `filter(gse == "")` hace lo contrario: se
queda sólo con los cinco.

**Las dos salidas correctas** son sacar la fila con el filtro o dejarla y
declararla en una nota («5 casos sin GSE excluidos»). Lo que no corresponde es
tratarla como un grupo real: «el grupo más joven de la CEP tiene 40 años» es un
titular sobre cinco personas sin dato.

### El año que dio cero (ejercicio 6 del cuaderno 7)

Textual del enunciado del cuaderno:

> Calcula el porcentaje que dice **`"Progresando"`** por año y ordénalo **de
> menor a mayor** con `arrange()` sin `desc()`. El peor año va a salir con
> **0,0%**. Antes de creerle, corre esto y decide si ese cero se publica:

```r
cep %>%
  filter(anio == 2005) %>%
  count(chile_hoy)
```

Devuelve **una sola fila: `""` (vacío), 4.515 personas.** En 2005 **nadie tiene
dato en `chile_hoy`**: la pregunta no se hizo ese año, o no se armonizó en esta
base. El 0,0% no dice que nadie creyera que Chile progresaba: dice que
`chile_hoy == "Progresando"` fue `FALSE` para 4.515 celdas vacías. **Es el
control 2 de la clase 6, otra vez**: la columna no estuvo siempre. El mejor año
de verdad es 2004 con 52,8%, y los años siguientes en la tabla ascendente son
2022 con 11,4% y 2023 con 11,9%.

Lo que se publica no es «2005, nadie creía»: es que **2005 no tiene dato y se
saca de la serie o se declara**.

**Qué cuenta como comprobarlo.** Cualquier línea que mire qué hay adentro de
`chile_hoy` en 2005 sirve: `filter(anio == 2005) %>% count(chile_hoy)` (la del
cuaderno), `count(anio, chile_hoy)`, o el control 2 aplicado a esa columna —
`group_by(anio) %>% summarise(con_dato = sum(chile_hoy != ""))`—. Lo que **no**
cuenta como comprobarlo: volver a correr la misma receta; correr sólo
`count(anio)`, que dice cuántas personas hay en 2005 (4.515, que ya está en la
tabla) pero no qué contestaron; ni decir «habría que revisar los datos» sin
escribir ninguna línea.

**Diagnósticos que van bajo:** creerle al cero y publicarlo; decir que en 2005
la CEP no hizo encuesta (sí la hizo: 4.515 personas); decir que es un error de R
o del código, cuando el código está bien y el problema está en la base; y
atribuirlo a que `arrange()` ordenó mal.

<!-- section: limpiar_y_comparar -->

## Limpiar y comparar en la misma cadena (Parte C del cuaderno 7)

Textual:

> Volvemos a la encuesta del curso, que es chica y sucia: exactamente lo que se
> van a encontrar en la base de su proyecto. En la clase 5 descubrimos que
> `minutos_viaje` es texto porque alguien escribió `10 min`.

`class(curso$minutos_viaje)` devuelve `"character"`. Comparar o promediar esa
columna sin convertirla es el error de la clase 5: el filtro que devolvía diez
cuando eran catorce. El arreglo es `as.numeric()` **adentro de un `mutate()`**, y
la conversión deja el `10 min` como `NA` con un aviso en rojo (*NAs introduced
by coercion*) que **no es un error**: el código sigue corriendo.

### Ejercicio 9: los minutos promedio por transporte

Textual del enunciado: *«Son tres líneas después de `curso`: un `mutate()` con
`as.numeric()`, un `group_by(transporte)` y un `summarise()` con `n()` y
`mean()`. Córrelo primero **sin** `na.rm = TRUE` y mira qué grupo sale `NA`.
Después agrégalo.»*

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje)) %>%
  group_by(transporte) %>%
  summarise(personas = n(),
            minutos_promedio = mean(minutos_num, na.rm = TRUE))
```

| transporte | personas | minutos_promedio |
|---|---|---|
| Auto | 12 | 40,5 |
| Metro | 6 | 83,3 |
| Micro o bus | 15 | 77,0 |

**Sin `na.rm = TRUE`, el grupo Auto sale `NA`**: ahí está la persona del
`10 min`, que `as.numeric()` convirtió en `NA`, y el promedio de un grupo que
incluye un `NA` es `NA`. Los otros dos grupos salen igual. Es **código que corre
y contesta mal**: la forma está entera y la tabla se ve prolija, pero uno de los
tres números que se pidieron no está.

**Sin el `mutate()` con `as.numeric()`**, `mean(minutos_viaje)` está promediando
texto: no devuelve ningún promedio válido. Es la lección de la clase 5 que falta.

### Ejercicio 10: de promedio a porcentaje

Textual: *«¿qué proporción de cada grupo de `transporte` tiene un viaje
**largo**, de más de 60 minutos? El `mutate()` crea dos columnas: la numérica y
la comparación.»*

```r
curso %>%
  mutate(minutos_num = as.numeric(minutos_viaje),
         largo = minutos_num > 60) %>%
  group_by(transporte) %>%
  summarise(personas = n(),
            pct_largo = mean(largo, na.rm = TRUE) * 100)
```

**Auto 9,1% · Metro 50,0% · Micro o bus 66,7%.** La comparación se puede hacer
directo adentro del `summarise()` —`pct_largo = mean(minutos_num > 60,
na.rm = TRUE) * 100`— sin crear `largo` en el `mutate()`, y vale igual. Es la
misma receta del porcentaje de todo el cuaderno: el promedio de una columna de
`TRUE`/`FALSE`, por 100. Sin el `* 100` devuelve la proporción (0,091, 0,5,
0,667): contesta lo mismo en otra unidad, y es un detalle menor, no un error de
fondo. Sin el `na.rm = TRUE`, Auto vuelve a salir `NA`.

**Escrituras que también valen:** sobrescribir la columna
(`mutate(minutos_viaje = as.numeric(minutos_viaje))`), `|>`,
`n = n()`, otro nombre para la columna nueva —con tal de que sea el mismo que
aparece después en el `summarise()`—, o hacerlo en dos pasos guardados en objetos
intermedios. **Errores de fondo:** `Minutos_viaje` o `Transporte` con
mayúscula (no corre), `mean()` sobre `minutos_viaje` sin convertir (la lección de
la clase 5 que falta), `group_by()` después del `summarise()` (no corre), y
`mean(minutos_num)` antes del `mutate()` que crea `minutos_num` (no corre).
