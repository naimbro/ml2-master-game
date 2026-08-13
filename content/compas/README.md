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

## Las pantallas

| Ruta | Quién | Qué |
|---|---|---|
| `/professor/compas/nuevo` | profesor | abre una sala y elige cuál de las tres aplicaciones es |
| `/compas/:code` | alumno | responde ítem por ítem; al cerrar recibe su arquetipo |
| `/compas/:code/sala` | anfitrión | lo proyectado: la nube con estelas, y el ritmo |
| `/compas/:code/campos` | anfitrión | grupos de debate a partir de las posiciones |
| `/professor/compas/:courseId/comparacion` | profesor | Semana 3 contra Semana 15 |
| `/preview-compas` | cualquiera | todo lo anterior con un curso simulado, sin login |

## Dónde vive cada dato

- `compasRuns/{code}/respuestas/{uid}` — las respuestas ítem por ítem, **con
  nombre**. La lee sólo el anfitrión.
- `compas/{courseId}/{instrumentId}_a{n}/{uid}` — la posición final, **sin
  nombre**, indexada por aplicación y no por sala. La escribe el anfitrión al
  cerrar (y el alumno la suya, como respaldo).

Que la posición durable no lleve nombre es deliberado: esa colección la puede
leer cualquier alumno autenticado, y una tabla pública de quién piensa qué es
justamente lo que este instrumento no debe producir. Por eso los **campos** se
arman en la pantalla del anfitrión, que es el único lugar donde nombre y
posición se encuentran.

## Los campos

Grupos de debate a partir de las posiciones, con **tamaños parejos**: difieren
en una persona como máximo. No se agrupa por arquetipo —son diez y el curso
tiene menos de treinta— porque saldría un grupo de siete y tres de uno, y en un
debate el grupo chico simplemente deja de hablar.

Dos modos: **homogéneos**, donde cada campo prepara el caso más fuerte de su
posición, y **mezclados**, donde cada grupo junta posiciones distintas para
deliberar. Si se vuelve a aplicar el compás después de una sesión mezclada, la
comparación mide si deliberar movió a alguien.
