---
name: autor-de-contenido
description: Use when writing or changing the game content of a class session in this repo — "hacer el juego de la clase X", "armar la sesión", "escribir preguntas", "agregar una ronda", "cambiar el enunciado", or creating a new session folder for any course (dataviz_2026, mgt300_2026, ai_democracy_2026, temas_emergentes_2026, ml2-2025). Also use when a game needs questions but nobody has said yet what class material they come from.
---

# Autor de contenido

Escribe las preguntas de un juego a partir del material que el curso realmente
proyecta, **en consulta con Naim y ofreciéndole opciones**, nunca una sola
versión ya decidida.

## La regla que manda sobre todas

**Cada pregunta sale de una slide, página o minuto concreto del material que la
clase vio. El juego no afirma ningún hecho que no esté ahí — tampoco en un
distractor de opción múltiple.**

Si una pregunta necesita un hecho que no está en el material, **se cambia la
pregunta, no se agrega el hecho.** Salió de un juego calificado 3,0/7 donde tres
de las cuatro críticas fueron la misma: "no sé de qué material de clases salió
eso".

Corolario: **nunca escribir una rúbrica o un `judgeFocus` que penalice objetar el
enunciado.** Si un alumno dice "esa premisa suena falsa, ¿de dónde salió?", el
problema es el enunciado.

## Lo primero: las fichas de diagnóstico de este curso

**Antes de escribir una sola pregunta, leer las fichas de diagnóstico de las
clases anteriores del curso:** `content/sessions/<curso>/*/diagnostico.md`.

Ahí está lo que ya se midió **con este curso y estos alumnos**: cuánto tardaron
en leer los enunciados, qué relojes no alcanzaron, qué enunciado confundió a
quién, y si el profesor tuvo que apretar «+30 s» en vivo. **Es el único lugar
donde el aprendizaje de una clase llega a la siguiente** — el feedback de los
alumnos se archiva, la telemetría se borra de la cabeza, y sin la ficha la clase
que viene repite el mismo error de reloj con otras palabras.

Las escribe el skill `diagnostico-de-clase` después de cada juego.

**Si la carpeta del curso no tiene ninguna ficha todavía** —hoy no hay ninguna—,
no se sigue a ciegas: correr el diagnóstico sobre el último juego de ese curso
antes de proponer rondas.

```bash
npm run diagnostico <CODIGO>     # el código de 6 letras del último juego del curso
```

Si el curso nunca se ha jugado, decírselo a Naim en una línea y seguir: las
reglas de reloj de este skill son el mejor sustituto que hay, pero son promedios
de cinco cursos y no de éste.

## Flujo

### 1. Leer el syllabus del curso, no solo el repo

Los programas viven **fuera** de este repo, en
`/mnt/c/Users/naim.bro.k/naimbro.github.io/teaching/`. Ahí están las fechas
reales, los bullets de cada clase y las lecturas asignadas. Leerlo antes de
proponer nada.

El juego y el syllabus pueden divergir legítimamente, pero la divergencia se
nombra en voz alta, no se descubre después.

### 2. Despachar un lector por fuente de material

Una clase puede tener deck + lectura + video. Son lecturas independientes:
**un agente `general-purpose` por fuente, todos en el mismo mensaje**, con el
prompt de `lector-de-material.md` (en esta carpeta) y el `fileId` o la ruta.

Devuelven **fichas de anclaje**: citas textuales con número de slide o página.
No resúmenes. Un resumen que dice "el deck habla de identidad algorítmica" es
justo el insumo que produce una pregunta sin material detrás.

Decks de Google Slides se leen con `read_file_content` del conector de Drive.
**Verificar `modifiedTime`**: un deck del año pasado se ve idéntico a uno
actualizado, y el deck también puede cambiar el mismo día de la clase.

### 3. Mostrar las anclas ANTES de escribir preguntas

Tabla a Naim: qué anclas hay, de qué slide, y qué pregunta permitiría cada una.
**Si el material no da para el juego que el syllabus sugiere, decirlo acá** —
es su decisión de contenido, no tuya.

### 4. Entrevistar

Preguntar, no asumir: cuántas rondas, abiertas o de alternativas, si compite o
no, qué error de los alumnos le interesa cazar, y el largo de respuesta.

### 4b. Hacer el presupuesto ANTES de proponer rondas

**Un juego dura entre 15 y 20 minutos de reloj de pared**, de que aparece el
código en pantalla a que se proyecta el podio. No es una preferencia: es el
bloque que tiene la actividad de cierre. **Un juego que no cabe no se acorta
solo — se corta a la mitad, y lo que se pierde es el final**, que es donde suele
estar la ronda que más importa.

El presupuesto **no es la suma de los `durationSeconds`.** Medido sobre siete
juegos con curso completo, el reloj de pared es **1,7 a 2,4 veces** esa suma: la
revelación, la espera de los jueces y el leaderboard entre rondas cuestan
**~2 minutos por ronda** que nadie presupuesta.

La cuenta que sirve:

```
suma_de_relojes + 2 min × nº de rondas ≤ 20 min
```

De ahí sale el techo, y es más bajo de lo que parece: **5 o 6 rondas, y si las
abiertas son de código —150 a 180 s cada una— cuatro.** Con los relojes
derivados (sección 4c) el techo bajó: una abierta ya no cuesta lo que uno
escribe en `durationSeconds`, cuesta lo que su enunciado y su respuesta piden.

| rondas | presupuesto de relojes | lo que cabe con relojes derivados |
|---|---|---|
| 4 | 12 min | 4 abiertas de código (~165 s cada una = 11 min) |
| 5 | 10 min | 2 abiertas de prosa (~195 s) + 3 MC (45 s) = 8,8 min |
| 6 | 8 min | 1 abierta de prosa + 5 MC = 7 min |

Siete rondas sólo cierran si las siete son MC, y ya sin margen: 5,3 min de
relojes más 14 de overhead.

**El desborde no lo causan los relojes: lo causa el número de rondas.** De las
11 sesiones de dataviz y MGT300, **10 no caben en 20 minutos**. La peor tiene 8
rondas: **12,7 min de relojes y 28,7 de pared** — **16 de esos 28 minutos son
overhead**, antes de que nadie escriba una letra. Bajarle los relojes a esa
sesión no la salva; sacarle rondas, sí.

Y eso explica los cortes que ya estaban anotados y que se habían leído como mala
suerte: **MGT300 clase 2 se cortó en R5 de 6, y la clase 5 en R5.** No fue mala
suerte, era aritmética.

**El reloj de una abierta ya no se elige: se deriva** de las palabras del
enunciado y del tecleo que pide la respuesta (`relojDerivadoAbierta()`, sección
4c y la tabla de `difficulty` en `esquema.md`). Lo que sigue siendo decisión de
diseño es **cuánto reloj puede pagar una ronda**, y eso sí depende del tipo de
sesión. Decidido con Naim el 1-sep-2026, después de jugar el repaso de MGT300:

| Tipo de sesión | Presupuesto por abierta | Cuántas caben |
|---|---|---|
| **Actividad de cierre** (el caso normal, 15-20 min) | **150-195 s** | 3 abiertas, o 2 abiertas + 3 MC |
| **Repaso o sesión que ocupa medio bloque** (~35 min, con pausas del profesor entre rondas) | **300 s** | 5 abiertas, y la última igual queda en riesgo |

Los 150 s de una sesión de cierre no son generosos y se sienten cortos —lo dijo
Naim jugando—, pero subirlos ahí **cuesta rondas**: a 300 s sólo entran tres, y
lo que se pierde es la ronda del final. En un repaso ese costo es menor, porque
el bloque es el doble y el profesor ya está parando entre ronda y ronda. **No
heredar el número de la sesión anterior sin mirar de qué tipo es.**

**Y el repaso no es un pase libre.** MGT300 clase 5 son cinco abiertas de 5
minutos: **35 minutos por diseño**, y se cortó en R5. Si el bloque no es de
verdad el doble, la última ronda se pierde igual que en una sesión de cierre.

**Una abierta de prosa cuesta tres o cuatro MC de 45 s**, así que la
decisión real no es cuántas rondas sino **cuántas abiertas caben**. Decidirlo con
Naim acá, antes de escribir nada: es más barato descartar una ronda en una tabla
que descubrir en la clase que nunca se jugó.

Dataviz clase 3 se escribió estimando «~18 min» sumando los relojes y el
`bufferSeconds`. Eran ~27 min de pared, se cortó en R5 de 7, y con R7 se perdió
la única ronda de criterio sobre fuentes de toda la sesión.

### 4c. El enunciado se cobra por palabra

**Un enunciado cuesta 0,32 s por palabra** —0,25 si la respuesta es código— y
eso está medido, no estimado: sale de las 36 rondas abiertas de 16 juegos y 5
cursos. La recta vive en `src/lib/abiertaTiming.ts`:

```
lectura ≈ 13 s + 0,32 s × palabra      (n = 35, RMSE 11,9 s)
                                        corr 0,77 pooled, 0,90 en prosa sola
```

**Cuidado con el 0,91 que anda dando vueltas:** es de OTRO ajuste, el de los 36
puntos, que incluye un enunciado de 421 palabras —2,4 veces el siguiente— y que
por eso infla la correlación. Su pendiente no es 0,32 sino 0,391. Los dos
ajustes están al lado en el encabezado de `abiertaTiming.ts`, y
`npm run diagnostico -- --calibrar` los reproduce.

En plata: **un enunciado de 180 palabras son 60 segundos de reloj que se van
antes de que nadie escriba un carácter.** La R4 de dataviz clase 7 tenía 179
palabras: la mediana del curso pasó **54 de sus 120 segundos leyendo**, y el 55%
seguía escribiendo cuando sonó la chicharra. Ese juego sacó **4,50/7 —la nota
más baja del año— y los quince comentarios de alumnos hablaban de falta de
tiempo.** Dos decían exactamente dónde se iba: «demora mucho tiempo entender la
pregunta y ver qué están preguntando», «muy poco tiempo **contando la lectura**
del ejercicio».

**El techo: 100 palabras** entre `context` y `question`. Por encima, la ronda
cuesta 40 s o más de pura lectura y empieza a competir con las demás por el
presupuesto de pared de la sección 4b. Siete de los 19 escenarios abiertos de
dataviz pasan ese umbral, y las cuatro peores —179, 162, 127 y 126 palabras— son
rondas **que el reloj ya no puede arreglar**: el reloj honesto de una de ellas
son **4,5 minutos para una sola ronda**, casi un cuarto del juego.

**El techo no necesita una regla propia en el validador, y eso es lo elegante:**
más palabras es más reloj derivado, más reloj no cabe en los 20 minutos de
pared, y el juego pierde una ronda. La regla dura ya está en
`relojDerivadoAbierta()`, y `scripts/validate-content.cjs` **falla el build** si
el `durationSeconds` escrito no alcanza para el enunciado que escribiste. Un
enunciado verborrágico no se paga con una advertencia: se paga con la ronda del
final.

Las cuatro reglas de forma que salen de ahí:

- **Una sola pregunta por enunciado.**
- **Los datos en lista o tabla, nunca en prosa corrida.**
- **El verbo de la tarea solo y en la última línea.**
- **Nada de contexto narrativo que no se use para responder.**

#### Tres patrones que cobran reloj sin avisar

Salieron de revisar los 50 escenarios abiertos de los tres cursos vivos. Los
tres se escriben con la mejor intención y los tres se pagan en segundos.

**1. «Dos cosas: …»** — trece de los 19 abiertos de dataviz piden una frase en
castellano **más** una línea de código. Eso convierte cualquier ronda `medium`
en `hard` de hecho: el alumno paga dos tipos de escritura distintos con un solo
reloj, y el reloj se calculó para uno. La regla: **una ronda, un entregable.** Y
si de verdad se piden los dos, se etiqueta `hard` desde el principio y se cuenta
como `hard` en el presupuesto — no se descubre jugando.

**2. La cita textual completa en el `context`** — en MGT300 casi toda ronda abre
con un párrafo de Han, a veces dos: 80 y 90 palabras de cita corrida. El alumno
ya leyó el texto para la clase y lo vuelve a leer completo en pantalla.
**Recortar la cita al fragmento que la pregunta usa de verdad devuelve 20-30 s
por ronda sin tocar lo que se pregunta.** Lo que no se recorta es de qué texto
sale: autor, libro y capítulo siguen yendo escritos (ver Reglas de escritura).

**3. El marco retórico** —«acá va un titular equivocado, refutalo»— cuesta 30-40
palabras de setup y **no hace la respuesta más larga de teclear.** Es estilo de
la casa, no señal de dificultad, y es exactamente lo que hace etiquetar `hard`
donde no corresponde. **La etiqueta se decide mirando el `idealAnswer`, no la
ambición del enunciado.**

#### La excepción honesta: cuando el contexto largo es la evidencia

En AyD (IA y democracia) los enunciados son largos por una buena razón: **cargan
la evidencia que la respuesta tiene que usar** —cifras, la cita del senador, las
tasas de reemplazo—, y una de sus rondas lo dice explícito: «están acá para que
los uses, no tienes que haber leído el artículo». Es una decisión pedagógica
buena, y tiene un precio de reloj que conviene saber: en esas rondas la lectura
se come **entre el 16% y el 28%** del tiempo.

Cuando el contexto largo es evidencia de verdad, la salida **no es recortarlo**
sino **mover lo que se pueda al `knowledge_base.md` o a una imagen, que no se
cobran por palabra**, y presupuestar el resto como lo que es. Lo que no vale es
cobrar 30 s de lectura por un marco retórico y llamarlo evidencia.

### 5. Proponer TRES versiones de cada ronda

Cada una con enunciado, contexto y **el ancla de la que sale**. Distintas de
verdad — distinto ángulo o distinta dificultad, no la misma pregunta
reformulada. Naim elige o mezcla. **Nunca entregar una sola versión.**

### 6. Escribir los archivos

`content/sessions/<curso>/<sesion>/` con `config.json`, `scenarios.json`,
`knowledge_base.md`, `rubric.json`. Esquema exacto y trampas en `esquema.md`.

Las rúbricas por pregunta (`judgeFocus`, `evaluationGuide`, `idealAnswer`) las
escribe el skill **`autor-de-rubricas`**, después de que Naim eligió las
preguntas. No adelantarse: criterios escritos sobre una pregunta que todavía se
puede caer son criterios que no la van a calzar.

### 7. Verificar

```bash
node scripts/validate-content.cjs <courseId>     # estructural
node scripts/verify-session-prompt.cjs <courseId> <sessionId>   # cableado silencioso
npm run build                                     # registro de cursos
```

Los tres pueden pasar sobre un juego que juega mal. **El chequeo que cuenta es
Naim jugándolo en el teléfono.** Decírselo, no darlo por hecho.

### 8. Después de la clase, medir el reloj

```bash
npm run diagnostico <CODIGO>                      # ¿alcanzó el tiempo?
npx tsx scripts/game-feedback.ts <courseId>       # qué dijeron los alumnos
```

Y el diagnóstico de la clase, que es lo que deja el aprendizaje escrito para la
sesión siguiente:

```bash
npm run diagnostico <CODIGO>      # escribe content/sessions/<curso>/<sesion>/diagnostico.md
```

Sin esa ficha, la clase que viene empieza de cero y repite el mismo error de
reloj con otras palabras. Es el insumo de la sección de arriba.

`timeLimitSeconds` se escribe a ojo y **ningún chequeo previo puede saber si
estuvo bien**: hace falta que treinta personas lo corran. Si la mediana del curso
consumió más del 60% del límite, el reloj quedó corto y hay que subirlo antes de
volver a jugar esa sesión. El detalle y los números están en `esquema.md`.

Dataviz clase 2 se jugó sin este paso y perdió **27 respuestas de 222** — una de
cada ocho.

## Reglas de escritura

- **Chileno neutro.** Nada de voseo argentino ("elegí", "decime") ni chilenismo
  caricaturizado. Vale para el contenido y para lo que le escribís a Naim.
- **El largo pedido es corto y va escrito en tres lugares**: el enunciado, el
  `globalInstructions` de la rúbrica y el `judgeFocus`. Si sale de uno, los
  jueces empiezan a esperar ensayos.
- **Ojo con el largo**: en la primera clase con curso completo, el límite de
  cuatro líneas fue el tema dominante del feedback. El enunciado pide un largo,
  la rúbrica castiga el relleno, y el formulario no impide pasarse — el alumno
  no sabe si es regla o sugerencia. Si vas a pedir un largo, decidí con Naim
  cuál de las dos cosas es.
- **No rankear auto-reporte.** Preguntar por el dominio de interés, el rol o una
  preferencia no es competencia: rankearlo incentiva escribir la respuesta que
  puntúa en vez de la verdadera. Si todas las rondas van `ranked: false`, el
  podio muestra ceros.
- **Toda cita lleva escrito de qué texto sale, en el propio enunciado.** No basta
  con «volvemos a la clase 3» ni con ponerlo en `category`: hay que nombrar
  **autor, libro y capítulo** —«Byung-Chul Han, *En el enjambre* (2013), capítulo
  "En el enjambre"»—. El alumno está repasando para una prueba y necesita saber a
  qué texto volver; y el juez, que también lo lee, deja de tratar como material
  ajeno lo que es del propio libro. Salió del feedback de MGT300 clase 5: tres de
  cinco enunciados traían la cita sin decir de dónde.

  **Y el capítulo se verifica, no se recuerda.** El `knowledge_base.md` de la
  sesión trae la ficha bibliográfica exacta; si ahí no está el capítulo, se pone
  sólo autor y libro. Inventar un título de capítulo que suena plausible es
  inventar un hecho, igual que inventar una cifra.
- **El alumno ve la imagen en su teléfono**, no solo proyectada. Un gráfico de
  dos paneles es ilegible ahí.
- El juego es actividad de cierre de clase. **15-20 minutos de pared**, con el
  presupuesto de la sección 4b. No es el abre.
- **No pedir de memoria lo que la clase tuvo escrito al frente.** Vale para el
  código y para cualquier dato que estuviera proyectado: nombres de columnas,
  cifras, rutas, nombres de funciones de arranque. El alumno hizo el ejercicio
  copiando de la pantalla; sin la pantalla está recordando, no razonando. **La
  regla: dale el dato en el enunciado y pídele sólo la parte que carga el
  concepto.**

  Está medido en el mismo juego, con los mismos 29 alumnos y el mismo reloj: la
  ronda que pidió recordar `library(dplyr)` y la línea de carga sacó **mediana
  24 y nadie la respondió bien**; la siguiente, que traía los nombres de columna
  escritos en el enunciado y sólo pedía el cruce, sacó **mediana 43 y dos
  respuestas perfectas**. La diferencia no fue la dificultad: fue qué había que
  recordar.
- **La unidad de la respuesta hay que nombrarla, y en el idioma de la respuesta.**
  «En 3 líneas» sobre una pregunta de código lo leyeron seis alumnos como «en 3
  pasos» y contestaron en castellano numerado («1. cambiar el formato a R»). Si
  la respuesta es código, decir «tres líneas **de R**» y, mejor todavía, mostrar
  la forma vacía.

## Errores que ya se cometieron

| Error | Qué pasó |
|---|---|
| Gráfico propio con fuente citada pero no proyectada | Que la fuente esté en una slide no basta: el alumno tiene que haber visto **ese** gráfico |
| Premisa inventada en el enunciado | La rúbrica castigó al alumno que la objetó |
| Distractor inventado entre tres textuales | Delata la pregunta entera |
| `conceptTag` que no calza una sección del `knowledge_base.md` | Los jueces evalúan **sin material y sin dar error** |
| `scenarios.json` envuelto en `{sessionId, scenarios: []}` | El validador lo acepta y `rounds` queda en `undefined` |
| Sesión nueva sin `weightFormula` para los `generic_*` | Los tres jueces quedan indistinguibles, en silencio |
| Par mínimo (dos alternativas con las mismas palabras) con reloj de 25 s | 89% del reloj consumido, 8 sin responder y 43% de acierto: una moneda al aire. Hoy el validador lo rechaza |
| Acortar el reloj porque "la clase pasada sobraba" | Sobraba en MGT300, faltó en dataviz. El reloj se mide por sesión, no se hereda |
| Estimar la duración sumando los `durationSeconds` | La pared es 1,7-2,4× eso. Se cortó en R5 de 7 y se perdió la ronda que más importaba |
| Pedir que escriban un marcador de posición (`read.csv("...")`) | Nadie escribe los puntos: rellenan las comillas adivinando (`read.csv("curso")`, `read.csv("webc")`). Si el dato no importa, **dáselo escrito**; no le pidas que escriba un hueco |
| Enunciado de 179 palabras en una abierta de 120 s | 54 de los 120 segundos se fueron leyendo y el 55% seguía escribiendo al final. 4,50/7, la nota más baja del año. El techo son **100 palabras** (4c) |
| Pedir «dos cosas: una frase y una línea de código» con reloj de `medium` | Son dos tipos de escritura con un solo reloj. **Una ronda, un entregable** — o `hard` desde el principio |
