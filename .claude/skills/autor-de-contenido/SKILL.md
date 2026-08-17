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

De ahí sale la tabla, y es más apretada de lo que parece:

| rondas | presupuesto de relojes | lo que cabe |
|---|---|---|
| 5 | 10 min | 3 MC (45 s) + 3 abiertas (150 s) |
| 6 | 8 min | 4 MC + 2 abiertas |
| 7 | 6 min | 5 MC + **una sola** abierta |

**Una abierta de 150 s cuesta casi el doble que una MC de 45 s**, así que la
decisión real no es cuántas rondas sino **cuántas abiertas caben**. Decidirlo con
Naim acá, antes de escribir nada: es más barato descartar una ronda en una tabla
que descubrir en la clase que nunca se jugó.

Dataviz clase 3 se escribió estimando «~18 min» sumando los relojes y el
`bufferSeconds`. Eran ~27 min de pared, se cortó en R5 de 7, y con R7 se perdió
la única ronda de criterio sobre fuentes de toda la sesión.

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
npx tsx scripts/mc-clock.ts <CODIGO>              # ¿alcanzó el tiempo?
npx tsx scripts/game-feedback.ts <courseId>       # qué dijeron los alumnos
```

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
