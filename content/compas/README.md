# `content/compas/` — instrumentos de posicionamiento

Un **compás** no es una sesión de juego. Es un instrumento de opinión que se
aplica varias veces a lo largo de un semestre para medir dónde está parado el
curso y cómo se mueve.

## Por qué vive acá y no en `content/sessions/`

Se intentó primero como una sesión normal y no cabe, por una razón dura:
`scripts/validate-content.cjs` exige `correctOptionIndex` en rango para toda
pregunta de alternativas (línea 243). **Un ítem del compás no tiene respuesta
correcta**, así que escribirlo como `multiple_choice` obliga a inventarle una — y
una respuesta correcta falsa no es un detalle cosmético: `src/lib/mcScoring.ts`
la puntúa, `Results.tsx` la muestra en el leaderboard y el alumno la ve.

Lo mismo con los jueces: una ronda abierta se evalúa, y acá no hay nada que
evaluar. `rubric.json` y `knowledge_base.md` no tendrían contenido honesto.

Así que el compás es **contenido hermano**, no una sesión más. Comparte la
plomería del motor —código de sala, login, sincronización, el anfitrión marcando
el ritmo, la agregación en vivo— y no comparte las pantallas de resultado.

## La regla que no se negocia

**El compás no puntúa, no rankea y no alimenta la nota.** En el momento en que un
alumno sospecha que alguna alternativa suma, deja de responder lo que piensa y
empieza a responder lo que cree que el profesor quiere oír. La medición de fin de
semestre queda arruinada y nadie se entera, porque el instrumento sigue
entregando números con la misma cara de siempre.

## Los archivos

```
content/compas/<courseId>/
    instrumento_v<n>.json    # ejes, ítems, opciones con su vector y su ancla
    arquetipos_v<n>.json     # las celdas de la grilla, con lectura y punto ciego
```

**El instrumento es fijo entre aplicaciones.** Si se cambia un ítem, sube la
versión y las mediciones anteriores dejan de ser comparables con las nuevas. Esa
es la razón de que el número de versión esté en el nombre del archivo y no
sólo adentro.

### `instrumento_v1.json`

- `axes.x` / `axes.y` — los dos ejes, con sus etiquetas de extremo.
- `items[]` — cada ítem con cinco opciones. Cada opción carga:
  - `vector` — `{magnitud, direccion}` en −10..10.
  - `anchor` — **el texto del programa que defiende esa posición**. Es la columna
    que hay que auditar: si una opción no resiste su ancla, se cae la opción. Dos
    anclas están marcadas `ANCLA DEBIL` a propósito, para que se vean.
- `aplicaciones[]` — cuándo se aplica. Son tres y el instrumento no cambia entre
  ellas.

### `arquetipos_v1.json`

- `cortes` — **provisorios**. La posición es el promedio de diez ítems, así que
  casi nadie llega a los extremos: con tercios iguales los arquetipos de esquina
  quedan vacíos. Se recalibran con terciles empíricos de la primera aplicación
  real. Es el mismo problema que `timeLimitSeconds` en las sesiones normales —
  se escribe a ojo y ningún chequeo previo puede saber si estuvo bien.
- `desempate` — El Vigilante y La Oligarquía ocupan la **misma celda**: los dos
  creen que la IA importa mucho y que erosiona la democracia, y lo que los separa
  es quién es el villano, que es un tercer eje fuera del plano. El ítem
  `c09_timon` los desempata.
- `arquetipos[]` — cada uno con `desc`, `lectura` y `puntoCiego`. El punto ciego
  es la objeción más fuerte contra la propia posición, y es lo que hace que el
  debate posterior funcione: cada grupo llega sabiendo por dónde lo van a atacar.

## Lo que todavía no existe

Estos archivos son contenido. Falta el código que los lee:

- un tipo de ronda `compas` que no pase por `correctOptionIndex` ni por los jueces;
- pantallas **hermanas** de `Results.tsx` y `End.tsx`, no banderas dentro de
  ellas — las dos superan las 700 líneas y están construidas alrededor de un
  leaderboard que acá no aplica;
- persistencia de la posición por alumno y por aplicación, que es lo que permite
  comparar Semana 3 contra Semana 15;
- registro en `src/lib/courses.ts`, como cualquier contenido nuevo.
