# Clase 3 — Dominios, preguntas y fuentes de datos

**Curso:** `dataviz_2026` · **Fecha:** lunes 17-08-2026, 10:00–12:40 · **33 alumnos**

Estado: **`knowledge_base.md` listo.** Faltan `config.json`, `scenarios.json`,
`rubric.json` y `respuestas_sinteticas.md`.

---

## Qué pasó en la clase

Tres bloques. El juego cierra el tercero, ~20 min.

| Bloque | Qué vieron |
|---|---|
| A (~55 min) | Cuaderno de Colab en R sobre las **33 respuestas de su propia encuesta**: cruzar dos variables, y chocar contra el límite de una base de 33 casos |
| B (~65 min) | La **Encuesta CEP** proyectada por el profesor (los alumnos sólo miran), y después el **catálogo de fuentes** para elegir la de su dominio |
| C (~20 min) | Este juego |

El arco de la clase es uno solo: **describimos → cruzamos → la base se acabó →
hay que buscar datos de otro → y la fuente más prestigiosa del país no tiene el
tema de 17 de los 33.**

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
| `cuando_la_base_se_acaba` | El muro: n chico, celdas de 1 caso, porcentajes sin n |
| `tamano_de_muestra` | *(alias de la anterior; misma sección)* |
| `limpiar_es_decidir` | El `"3 horas"`, las tres capas de la comuna, la columna de dominios sucia |
| `audiencia_y_sprint1` | Audiencia identificable, la ficha de fuente, el pronóstico del curso |

---

## De dónde salió todo esto

El material fuente vive en el **otro repo**, `naimbro.github.io`:

- `materiales/2026_descripcion_visualizacion_datos/briefing_clase03.md` — el
  briefing completo de la clase, con 15 semillas de escenarios ya escritas en su
  sección 9 y criterios sugeridos para los jueces en la 10. **Empezar por ahí
  para escribir `scenarios.json`.**
- `materiales/2026_descripcion_visualizacion_datos/clase03_cuando_tus_datos_se_acaban.ipynb`
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
  funciones.** Esta clase es conceptualmente pesada y sintácticamente liviana.
  Lo evaluable es el criterio sobre fuentes y preguntas.
- Las dos únicas funciones nuevas de la clase fueron `tolower()` y `trimws()`.
  Se pueden mencionar, **nunca pedir de memoria**: lo evaluable es entender que
  `"Las condes"`, `"las condes"` y `"las condes "` son la misma comuna para una
  persona y tres categorías distintas para R.
- **El mejor material para rondas abiertas** es la ausencia como información: un
  grupo de deporte descubriendo que la CEP nunca preguntó por su tema, o uno de
  IA descubriendo que Chile tiene cero modelos. La respuesta excelente trata la
  ausencia como hallazgo publicable; la mediocre la trata como obstáculo; la
  mala supone que el dato "debe existir en alguna parte".
- **Buen material para alternativas:** el `CHI.csv` que es China; el 2020 que no
  existe en la CEP; Ñuble que no existe antes de 2018; el 100% que son 6
  personas; el `"3 horas"` que deja `NA` toda la columna; los dos Estados Unidos
  de la base de Epoch.
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
