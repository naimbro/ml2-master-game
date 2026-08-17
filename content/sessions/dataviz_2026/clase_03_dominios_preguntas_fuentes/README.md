# Clase 3 — Dominios, preguntas y fuentes de datos

**Curso:** `dataviz_2026` · **Fecha:** lunes 17-08-2026, 10:00–12:40 · **33 alumnos**

Estado: **`knowledge_base.md` listo.** Faltan `config.json`, `scenarios.json`,
`rubric.json` y `respuestas_sinteticas.md`.

---

## Qué pasó en la clase

Tres bloques. El juego cierra el tercero, ~20 min.

| Bloque | Qué vieron |
|---|---|
| A (~55 min) | Cuaderno de Colab en R sobre las **33 respuestas de su propia encuesta**: primeros pasos con `dplyr` y **siete ejercicios repetidos de `count()`** |
| B (~65 min) | La **Encuesta CEP** proyectada por el profesor (los alumnos sólo miran), y después el **catálogo de fuentes** para elegir la de su dominio |
| C (~20 min) | Este juego |

El arco de la clase es uno solo: **contamos → aparecen categorías de 1 persona →
la base de 33 no alcanza → hay que buscar datos de otro → y la fuente más
prestigiosa del país no tiene el tema de 17 de los 33.**

---

## conceptTags propuestos

Los que están marcados en el `knowledge_base.md`. Una sección puede llevar varios
tags separados por coma; `_always` se inyecta en toda evaluación.

| Tag | Qué cubre |
|---|---|
| `de_tema_a_pregunta` | Tema vs. pregunta; las 4 condiciones de una pregunta descriptiva; la tabla no-sirve/sirve |
| `evaluar_una_fuente` | Las 4 preguntas (cobertura, granularidad, periodicidad, sesgos) y las 3 trampas |
| `cobertura` | *(alias de la anterior; misma sección)* |
| `lo_que_no_se_mide` | La ausencia como información: la CEP sin deporte/cultura/IA, Chile sin modelos en Epoch |
| `la_encuesta_cep` | Cifras y series de la CEP |
| `el_catalogo_de_fuentes` | Las 11 fuentes con sus datos verificados |
| `cuando_la_base_se_acaba` | Los conteos reales, las categorías con `n = 1`, no reportar sin decir sobre cuántos |
| `tamano_de_muestra` | *(alias de la anterior; misma sección)* |
| `limpiar_es_decidir` | Datos sucios que se **observan pero no se arreglan**, y la columna de dominios que decide los grupos |
| `audiencia_y_sprint1` | Audiencia identificable, la ficha de fuente, el pronóstico del curso |

---

## De dónde salió todo esto

El material fuente vive en el **otro repo**, `naimbro.github.io`:

- `materiales/2026_descripcion_visualizacion_datos/briefing_clase03.md` — el
  briefing completo de la clase, con 15 semillas de escenarios ya escritas en su
  sección 9 y criterios sugeridos para los jueces en la 10. **Empezar por ahí
  para escribir `scenarios.json`.**
- `materiales/2026_descripcion_visualizacion_datos/clase03_contar_con_dplyr.ipynb`
  — el cuaderno del bloque A.
- `teaching/2026_dvd_clase3_catalogo_fuentes.html` — el catálogo que recibieron
  los alumnos.
- `materiales/2026_descripcion_visualizacion_datos/datos/cep_consolidada_1994_2026.csv`
  — la base CEP que se proyectó.

**Todas las cifras del knowledge base fueron verificadas ejecutando código sobre
los archivos reales**, no copiadas de documentación: las de la CEP corriendo
pandas sobre la base consolidada, las del cuaderno corriendo R contra la planilla
de respuestas en vivo, y las de Epoch AI descargando el CSV.

---

## Notas para escribir los escenarios

- **Ningún escenario debe pedir escribir código ni recordar nombres de
  funciones.** El peso conceptual está en las fuentes; la parte de programación
  fue entrenamiento de dedos. A lo más se puede mostrar una salida de `count()`
  y pedir que digan qué muestra y qué no permite concluir.
- **La clase introdujo `dplyr`, antes de lo que decía el programa original**, pero
  sólo cinco cosas: `library(dplyr)`, `glimpse()`, `count()`, `sort = TRUE` y
  `select()`. **No** vieron el pipe, `filter()`, `mutate()`, `group_by()`,
  `summarise()`, porcentajes, promedios por grupo ni gráficos.
- **Los datos sucios se observaron pero NO se arreglaron.** Vieron que `3` y
  `3 horas` cuentan como categorías distintas, y que `Las condes` y `las condes`
  también. **No preguntar cómo se limpian**: no se enseñó, y el cuaderno dice
  explícitamente que es tema de las próximas clases.
- **El mejor material para rondas abiertas** es la ausencia como información: un
  grupo de deporte descubriendo que la CEP nunca preguntó por su tema, o uno de
  IA descubriendo que Chile tiene cero modelos. La respuesta excelente trata la
  ausencia como hallazgo publicable; la mediocre la trata como obstáculo; la
  mala supone que el dato "debe existir en alguna parte".
- **Buen material para alternativas:** el `CHI.csv` que es China; el 2020 que no
  existe en la CEP; Ñuble que no existe antes de 2018; las categorías con
  `n = 1` del conteo de dominios; el `3` y `3 horas` que cuentan aparte; los dos
  Estados Unidos de la base de Epoch.
- **Cuidado al redactar sobre las series CEP:** el curso es descriptivo. Que
  Educación salte a 16,5% en 2011 describe un cambio en lo que la gente
  menciona; atribuirlo al movimiento estudiantil **como hecho probado por ese
  dato** es sobre-afirmar, y un distractor no debe afirmarlo. Igual: una caída
  en menciones no significa que el problema se resolvió — cada persona nombra
  sólo tres, así que un tema puede bajar porque otro subió.

## Nota sobre la rúbrica

La clase 2 se apartó de `_shared/base_rubric.json` y usó `criterio_de_datos` en
vez de `criterio_visual`, porque ninguna de sus rondas juzgadas pedía construir
un gráfico. **Esta clase tampoco tiene rondas visuales** — no se construyó ni un
solo gráfico en el bloque B —, así que probablemente corresponde la misma
decisión, o una dimensión propia del tipo `criterio_de_fuentes`. Si se aparta del
base, dejar la razón escrita en la clave `_doc`, como se hizo en la clase 2.
