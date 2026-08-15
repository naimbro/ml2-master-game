# Clase 3 — Dominios, preguntas y fuentes de datos

<!-- section: _always -->

## Quiénes son estos estudiantes y qué estándar corresponde

Descripción y Visualización de Datos, doble título Sociología – Ingeniería
Comercial, Universidad Adolfo Ibáñez. Clase 3 de 15, lunes 17 de agosto de 2026.
**Son 33 estudiantes de primer año.**

Llevan **exactamente una clase programando en su vida** (la clase 2, hace una
semana). Vienen de ciencias sociales y negocios, no de ingeniería.

**Esta clase es conceptualmente pesada y sintácticamente liviana.** Casi no
introduce funciones nuevas. Lo evaluable es **el criterio sobre fuentes y
preguntas**: si una pregunta se puede responder con los datos que existen, qué
mide realmente una fuente, quién decidió qué se mide, y qué queda fuera.

**Ninguna respuesta debe requerir escribir código ni recordar nombres de
funciones.** Un razonamiento correcto dicho sin una sola palabra técnica vale
100. Decir "hay que fijarse a cuánta gente le preguntaron" vale exactamente lo
mismo que decir "hay que reportar el n".

Las respuestas se escriben en dos minutos y medio desde un teléfono. Tres líneas
bien puestas valen 100. **Escribir más no sube el puntaje**: premia densidad, no
extensión.

Si un estudiante objeta el enunciado —dice que la premisa le suena falsa o que
falta información— eso **no se penaliza nunca**. Si tiene razón, el problema es
del enunciado.

## Lo que está fuera de alcance

No han visto `dplyr` ni el pipe (`%>%`) —eso es clase 5— ni `ggplot2` —clase 8—.
Y **no van a ver inferencia estadística en ningún momento del curso**: nada de
tests de hipótesis, valores-p, intervalos de confianza, regresión, márgenes de
error ni representatividad muestral formal. El curso es descriptivo.

Si una respuesta invoca un test estadístico o un margen de error, no está siendo
sofisticada: está fuera de lo que se enseñó, y no suma.

*(La base CEP que vieron incluye una columna `ponderador`. En clase se mencionó
que existe y para qué sirve, pero no se usó. No se evalúa.)*

<!-- section: de_tema_a_pregunta -->

## Un tema no es una pregunta

El corazón de la clase. **"Vivienda" es un tema. No es una pregunta.**

Una pregunta descriptiva de este curso cumple cuatro condiciones:

1. **Se responde con datos que existen** — no con datos que uno desearía que
   existieran.
2. **Nombra la unidad de observación, el período y el territorio**: ¿personas o
   comunas? ¿qué años? ¿todo Chile o la Región Metropolitana?
3. **No pregunta por causas.** El curso es descriptivo.
4. **Se puede contestar con una tabla o un gráfico.**

Los pares que se mostraron en clase, tal cual:

| No sirve | Sirve |
|---|---|
| ¿Por qué aumentó la delincuencia en Chile? | ¿Cómo cambió entre 1994 y 2026 la proporción de personas que menciona la delincuencia como principal problema del país? |
| ¿La educación en Chile es mala? | ¿Cómo se distribuyó la matrícula escolar por tipo de dependencia en cada región entre 2015 y 2025? |
| ¿La IA va a quitar empleos? | ¿Cuántos modelos relevantes de IA se publicaron por año y por país entre 2010 y 2026? |
| ¿A los chilenos les gusta el deporte? | ¿Contra qué selecciones y en qué ciudades ha jugado Chile sus partidos internacionales desde 1990? |

El punto que se subrayó: **la columna de la izquierda no está mal por ser
ambiciosa. Está mal porque ninguna base de datos disponible puede responderla.**

**Formular la pregunta y buscar la fuente no son dos pasos: son el mismo paso,
hecho de ida y vuelta.** Se propone una pregunta, se mira si hay datos, y la
pregunta se ajusta. Eso no es rendirse: es cómo se trabaja.

<!-- section: evaluar_una_fuente, cobertura -->

## Las cuatro preguntas que se le hacen a una fuente

Nunca se elige una fuente porque exista, ni porque sea oficial. Se elige después
de responder cuatro preguntas, y **son las mismas para cualquier base de datos
del mundo**:

1. **Cobertura** — ¿a quiénes incluye y **a quiénes deja fuera**?
2. **Granularidad** — ¿cuál es la unidad de observación: persona, hogar, comuna,
   región, país, partido, modelo?
3. **Periodicidad** — ¿cada cuánto se levanta, y **falta algún período**?
4. **Sesgos y límites** — ¿quién la produce, para qué, y **qué decidió no
   medir**?

Ejemplos concretos que se dieron de cada una:

- **Cobertura:** la CEP sólo entrevista a personas de 18 años o más. Los
  adolescentes **no existen** en esa fuente, así que ninguna pregunta sobre
  adolescentes se puede responder con ella. La ENPCCL de cultura sólo cubre
  **zonas urbanas**: el Chile rural no está.
- **Granularidad:** si la pregunta es por comuna y la base sólo llega a región,
  la pregunta **no se puede responder**. La CEP no tiene comuna.
- **Periodicidad:** la CEP dice ser periódica y aun así **no existe 2020**.
  Tener periodicidad declarada no garantiza que el dato exista todos los años.
- **Sesgos y límites:** la CEP mide **opiniones**, no hechos. Dice cuánta gente
  *cree* que la delincuencia es el principal problema, no cuántos delitos hubo.
  Son dos preguntas distintas y se responden con fuentes distintas.

### Tres trampas que la clase vio con nombre y apellido

1. **`CHI.csv` es China, no Chile.** En el sitio football-data.co.uk existe un
   archivo llamado `CHI.csv`; al abrirlo, la primera columna dice `China`. Chile
   no está en ese sitio. **Nunca uses un archivo por su nombre sin abrirlo y
   mirar qué trae adentro.**
2. **"Oficial" no significa "usable".** El Ministerio del Deporte y CENIA
   publican resultados sólo en PDF. La información existe y es pública, pero no
   se puede analizar.
3. **Formato no es disponibilidad.** CASEN y ENPCCL publican sólo en formatos de
   software estadístico (`.dta`, `.sav`, `.RData`), no en CSV. El dato es
   público, pero para leerlo hay que saber cómo.

<!-- section: lo_que_no_se_mide -->

## Lo que no se mide no existe: la idea central de la clase

> **Toda base de datos es el resultado de que alguien decidió qué valía la pena
> contar. Lo que no se mide, no aparece; y lo que no aparece, tiende a no
> discutirse.**

De ahí se sigue lo que más importa evaluar en esta sesión:

> **Que tu tema no esté en una fuente no es una falla tuya. Es un dato sobre la
> fuente**, y merece decirse en voz alta en la plataforma del grupo.

### El caso concreto: la CEP no pregunta por deporte, cultura ni IA

La variable de problemas del país de la Encuesta CEP tiene **27 alternativas
sustantivas**, y entre ellas **no está el deporte, no está la cultura y no está
la inteligencia artificial**. En **32 años** nunca fueron una alternativa.
Alguien decidió alrededor de 1994 qué contaba como "problema del país", y esa
decisión sigue mandando en 2026.

Eso deja fuera de la fuente más citada del país a **17 de los 33 alumnos del
curso** — los que eligieron deporte (7), IA (6) y cultura (4).

### El mismo fenómeno, visto desde el otro lado: Chile no está en la base de IA

En la base de modelos de Epoch AI, de los **1.046 modelos** de
`notable_ai_models.csv`, los atribuidos a **Chile son cero**. Estados Unidos
tiene 442, China 113, Reino Unido 55, Canadá 28, Corea 19.

Es la misma lección invertida: allá faltaba el tema, acá falta el país. Un grupo
que quiera hablar de IA en Chile va a tener que explicar por qué su país no
aparece en el mapa — **y eso es un hallazgo, no un fracaso**.

**Una respuesta excelente en esta sesión reconoce la ausencia como información y
propone decirla, en vez de tratarla como un obstáculo que invalida el proyecto o
de fingir que el dato debe existir en alguna parte.**

<!-- section: la_encuesta_cep -->

## La Encuesta CEP (la fuente que se miró en conjunto)

La Encuesta CEP (Centro de Estudios Públicos) es la encuesta de opinión pública
más antigua y citada de Chile. Su **base consolidada** junta todas las encuestas
en un solo archivo, con nombres de variables y escalas armonizadas para poder
comparar a través del tiempo.

Cifras exactas de la base que se proyectó en clase:

- Va desde la **encuesta N°29 (noviembre-diciembre 1994)** hasta la **N°96
  (abril-mayo 2026)**.
- **96.122 personas encuestadas** en total.
- El archivo original tiene **más de 4.600 columnas**; la versión del curso
  tiene **25**.
- **32 años de datos, pero falta 2020**: ese año no se hizo la encuesta.
- El tamaño de la muestra **cambia todos los años**: desde **1.402 casos (2018)**
  hasta **4.560 (2012)**.
- Sólo entrevista a **personas de 18 años o más** (en la base hay edades de 18 a
  99).
- Tiene **región (16), zona urbana o rural y grupo socioeconómico. No tiene
  comuna.**
- **Ñuble aparece recién desde 2018**, porque la región no existía antes. *La
  geografía de una base de datos tiene fecha de nacimiento.*

### La variable central

> *"A continuación le mostraré una serie de problemas que tiene nuestro país.
> ¿Cuáles son los tres problemas a los que debería dedicar mayor esfuerzo en
> solucionar?"*

Está en las 32 encuestas. Sus 29 categorías (27 problemas más "No sabe" y "No
contesta") son: Pensiones, Corrupción, Delincuencia, Derechos humanos,
Educación, Empleo, Pobreza, Protección del medio ambiente, Narcotráfico, Salud,
Sueldos, Transporte público, Vivienda, Inmigración, Reformas constitucionales,
Desigualdad, Alzas de precios, Protestas y desórdenes callejeros, Terrorismo,
Infraestructura, Sistema judicial, Sistema electoral binominal, Energía,
Violencia con fines políticos, Pandemia por Covid-19, Violencia, La Constitución.

### Las series que se mostraron (% de menciones como primer problema)

| Año | Delincuencia | Educación | Empleo | Salud | Vivienda |
|---|---|---|---|---|---|
| 1994 | 19,0 | 7,8 | 10,9 | 13,4 | 4,8 |
| 2001 | 12,6 | 6,3 | **26,5** | 9,8 | 4,4 |
| 2011 | 23,2 | **16,5** | 6,4 | 11,1 | 4,1 |
| 2019 | 14,0 | 7,8 | 3,8 | 10,8 | **1,5** |
| 2024 | 30,9 | 6,3 | **2,2** | 7,7 | 2,3 |
| 2026 | **31,4** | 7,9 | 4,7 | 13,2 | 2,9 |

Tres movimientos que se comentaron:

- **Educación salta de 10,0% (2010) a 16,5% (2011)** y después baja; para 2023
  había caído a 4,8%.
- **Empleo se desploma de 26,5% (2001) a 2,2% (2024).**
- **Delincuencia sube de 19,0% (1994) a 31,8% (2025)**, su máximo histórico.

**Advertencia sobre estas series, importante para juzgar:** el curso es
descriptivo. Que Educación salte en 2011 **describe un cambio en lo que la gente
menciona**; atribuirlo al movimiento estudiantil como hecho probado por este
dato es sobre-afirmar. Se puede ofrecer como hipótesis, marcada como tal. Y una
caída en las menciones **no significa que el problema se haya resuelto**: puede
haber sido desplazado por otro que subió, porque cada persona nombra sólo tres.

<!-- section: el_catalogo_de_fuentes -->

## El catálogo de fuentes que recibieron

Los dominios que eligió el curso, y con qué se puede trabajar cada uno:

| Dominio | Alumnos | Fuente principal |
|---|---|---|
| Deporte | 7 | footballcsv (partidos internacionales) |
| Salud | 7 | DEIS/Minsal, ENS, CASEN |
| Inteligencia artificial | 6 | Epoch AI |
| Educación | 4 | Mineduc Datos Abiertos |
| Cultura | 4 | ENPCCL 2024 |
| Vivienda | 2 | CASEN, Censo |
| Medio ambiente | 1 | SINCA |
| Política | 1 | CEP, Servel |
| Transporte | 1 | CEP, CASEN |

Datos verificados de cada fuente:

- **Epoch AI** — modelos de machine learning de **1950 a 2026**.
  `notable_ai_models.csv` trae **1.046 modelos y 47 columnas**;
  `all_ai_models.csv`, **3.574 y 57**. Una fila por modelo. CSV que se carga
  directo por URL. Dominios más frecuentes: lenguaje (393), visión (201), juegos
  (47), biología (42). **Chile: cero modelos.** Y **la base viene sucia**: 78 de
  los 1.046 registros tienen el país escrito dos veces en la misma celda
  (`"United States of America,United States of America"`), así que contar
  modelos por país sin mirar la columna produce **dos Estados Unidos distintos**
  en la misma tabla.
- **footballcsv** — todos los partidos entre selecciones nacionales desde
  **1872**, un CSV por año, columnas `Date`, `Team 1`, `Score`, `Team 2`,
  `Tournament`, `City`. Una fila por partido. En 2015 aparecen **34 partidos de
  Chile**. Sólo fútbol y sólo selecciones: no tiene ligas chilenas, ni otros
  deportes, ni asistencia de público.
- **Mineduc Datos Abiertos** — matrícula, asistencia, rendimiento,
  establecimientos, docentes. **Llega hasta el estudiante y el establecimiento**,
  la granularidad más fina del catálogo. CSV, series anuales largas.
- **ENPCCL 2024** (cultura) — participación cultural y comportamiento lector.
  **Personas de 15 años y más, sólo zonas urbanas.** En `.RData`, `.dta` y
  `.sav`; **no publica CSV**.
- **CASEN 2024** — ingresos, pobreza, vivienda, salud, educación, trabajo.
  Personas y hogares, con base separada de comunas. Stata, R y SPSS; **sin CSV**.
- **DEIS (Minsal)** — defunciones, egresos hospitalarios. Causas codificadas en
  CIE-10, que hay que traducir. Son datos sobre muertes de personas reales: la
  ética de datos aplica con fuerza.
- **ENS (Minsal)** — actividad física y sedentarismo con microdato, pero **el
  último disponible es 2016-2017**. Es el puente entre deporte y salud.
- **SINCA** (medio ambiente) — MP10, MP2,5, ozono, NO2, SO2 y CO, en las 16
  regiones, con registros horarios. **Sólo donde hay estación de monitoreo**: las
  comunas sin estación no tienen dato. Los datos recientes son preliminares.
- **Servel** — elecciones y plebiscitos desde **1989**, hasta nivel de **mesa de
  votación**. Cada elección viene en su propio archivo y con su propio formato.
- **ENAFyD (Ministerio del Deporte)** — **sólo informe en PDF, sin base de
  datos.** El ejemplo del curso de que "el dato existe" y "el dato está
  disponible" son cosas distintas.
- **ILIA (CENIA)** — índice de IA de 19 países latinoamericanos. **Sólo PDF y un
  visualizador**, sin datos crudos.

**Aviso que se les dio explícitamente:** deporte e IA, que suman 13 alumnos, son
los dominios peor cubiertos por la estadística pública chilena. No los deja
fuera del curso: los obliga a trabajar con fuentes internacionales o a construir
su propio dato, **y a explicar esa decisión**.

<!-- section: cuando_la_base_se_acaba, tamano_de_muestra -->

## Cuando la base se acaba: el muro del cuaderno

En el cuaderno de la clase, los estudiantes cruzaron dos variables de su propia
encuesta (**33 respuestas**) y se toparon con el límite.

Los datos exactos que vieron en pantalla:

- **Medio de transporte:** micro o bus 15, auto 12, metro 6.
- **Sistema operativo del celular:** iOS 27, Android 5, **Otro 1**.
- Cruzando ambos, con porcentajes por fila: de quienes llegan en **metro, el
  100% usa iPhone** — y ese 100% son **6 personas**.
- Con porcentajes por columna, la categoría `Otro` da **100% "micro o bus"** — y
  ese 100% es **una sola persona**.

El titular que se les mostró como ejemplo de algo perfecto y vacío:

> *"El 100% de quienes usan otro sistema operativo llega a la universidad en
> micro."*

**Con una sola persona en la categoría, el resultado sólo podía ser 0% o 100%.**
El número parece contundente justamente porque está calculado sobre casi nada.

De ahí las dos reglas de la sesión:

- **Un porcentaje nunca se publica sin decir sobre cuántos casos está
  calculado.**
- **Los conteos absolutos se comparan mal entre grupos de distinto tamaño.** Por
  eso la CEP se lee en porcentajes: comparar cuántas personas mencionaron Salud
  en 2012 (4.560 encuestados) con 2018 (1.402) usando conteos absolutos engaña.

Y la conclusión que abre la segunda mitad de la clase:

> **Esto no se arregla escribiendo mejor código. No hay función que invente los
> datos que no tienes. La base se acabó.** Para responder preguntas sobre un
> tema de verdad hay que salir a buscar datos levantados por alguien más, sobre
> miles de personas en vez de 33.

<!-- section: limpiar_es_decidir -->

## Limpiar es decidir, y son capas

Esto viene de la clase 2 y reaparece acá sobre los datos del propio curso.

### Una persona puede arruinar una columna entera

En la encuesta del curso, **una sola persona escribió `"3 horas"`** en vez de
`3` en las horas de sueño. Eso convierte **toda la columna en texto**, y el
promedio por grupo devuelve `NA` en los tres grupos — **con advertencia pero sin
error**. Una persona de 33 arruina el cálculo para las 33. Lo mismo pasa en los
minutos de viaje (alguien puso `"10 min"`) y en las horas de redes (`"5 horas"`).

**Que el código corra no significa que el resultado sirva.**

### Limpiar no es un paso: son capas

La columna de comuna del curso está sucia en tres capas, y cada arreglo destapa
la siguiente:

1. **Mayúsculas:** `Las condes` y `las condes` son la misma comuna, y se cuentan
   aparte. Igual `ñuñoa`/`Ñuñoa` y `providencia`/`Providencia`.
2. **Espacios invisibles al final:** cuatro respuestas terminan en espacio, así
   que **siguen contándose aparte incluso después de pasar todo a minúscula**.
3. **Tildes y eñes:** quedan `ñuñoa` vs `nunoa`, y `peñalolen` vs `peñalolén`.
   **Peñalolén aparece escrita de cuatro formas distintas.**

> **En algún momento hay que decidir dónde parar y dejarlo escrito**, para que
> otra persona pueda repetir exactamente lo que se hizo y llegar al mismo
> número.

### La misma enfermedad en la variable que decide sus grupos

La columna donde cada uno eligió el dominio de su proyecto tiene **10
categorías**, pero el curso no eligió 10 temas: alguien escribió `politica` en
minúscula y sin tilde (que R cuenta aparte de `Política`), alguien escribió
`Medioambiente` en una palabra, y alguien no eligió del menú y escribió
`tecnologia y salud`.

**Ninguna de las tres las resuelve R sola. Son decisiones, y se documentan.**

<!-- section: audiencia_y_sprint1 -->

## Audiencia, y qué entrega el Sprint 1

Esta clase **inicia el Sprint 1**, que se entrega el lunes 31 de agosto de 2026:
dominio, pregunta descriptiva, fuentes y audiencia.

**Definir la audiencia es parte de definir la pregunta.** Una pregunta sin
destinatario no tiene con qué medir si la respuesta sirvió.

Decir que la audiencia son "las personas interesadas en el tema" **no sirve**:
no es identificable, no se le puede preguntar nada y no permite decidir qué
mostrar primero. El curso exige una audiencia **específica e identificable**,
justificar por qué necesita esa información, y probar la comprensión de la
plataforma con **al menos un usuario potencial real**.

La ficha que cada grupo llenó en el taller pide: dominio, fuente elegida con su
institución y enlace, cobertura (incluyendo **a quiénes deja fuera**),
granularidad, periodicidad, sesgos y límites, tres preguntas candidatas, la
pregunta elegida con unidad/período/territorio explícitos, y la audiencia.

### El pronóstico del curso, para cerrar

Antes del taller, en la encuesta de la clase 2, los estudiantes respondieron qué
tan de acuerdo estaban con *"Los datos públicos en Chile son fáciles de
encontrar"*: **21 de 33 dijeron que estaban de acuerdo o muy de acuerdo** (20 y
1), 10 quedaron neutros y sólo 2 en desacuerdo.

Casi dos tercios del curso creía que iba a ser fácil, **antes** de ver el
Ministerio del Deporte publicando sólo PDF, la CASEN sin CSV y a Chile con cero
modelos de IA.
