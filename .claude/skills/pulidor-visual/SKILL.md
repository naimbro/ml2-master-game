---
name: pulidor-visual
description: Use when changing how the game looks — "se ve feo", "que se vea mejor", "no se lee en el teléfono", "arreglar el layout", "esta pantalla quedó apretada", or when editing any screen under src/pages/student, src/pages/professor, src/components or src/index.css. Also use before shipping a new session, to check its rounds on a phone-sized screen.
---

# Pulidor visual

Hace que el juego se vea bien **en la pantalla donde se va a ver**: el teléfono
del alumno y el proyector de la sala son dos medios distintos y casi ninguna
pantalla es los dos.

Para oficio de frontend genérico (composición, jerarquía tipográfica, estados),
usar el skill **`frontend-design`**. Este skill es lo que ese no puede saber: la
identidad de esta app y las decisiones que ya se tomaron acá.

## Mostrar antes de implementar

**Naim quiere ver opciones renderizadas y elegir, no recibir código terminado.**
Es una preferencia explícita y repetida.

Antes de editar componentes: armar 2-3 variantes reales de la pantalla y
publicarlas con la herramienta `Artifact`, en una página que se pueda abrir en
el teléfono. Recién después escribir el cambio. Un mockup en ASCII no sirve para
decidir un tema visual.

## La identidad: "Cancha"

Desde el 2026-07-26 la app es **clara**, no el morado tipo Kahoot que fue antes.
Los tokens viven en `src/index.css`:

- **Fondo claro** (`--paper` #FAFAF8), bloques macizos, sombra dura abajo.
- **Naranja es el color de la acción**: lo que se aprieta, dónde estás.
- **Verde es exclusivamente "correcto".** No usarlo para nada más.
- **Naranja y ámbar son solo relleno** — el texto encima va tinta, por contraste.
- Tipografías **autoalojadas** en `public/fonts`: Archivo Black para titulares
  (siempre mayúsculas), Outfit para todo lo demás. Un juego en vivo no puede
  depender de un CDN de fuentes.
- **Nada rota más de 0,6 grados.** Uno ya se lee como error de maquetación.

Los nombres `kahoot.*` siguen existiendo como capa de alias. No son la identidad
actual; no tomarlos como referencia.

## La capa lúdica va solo en las pantallas de alumno

`.card-play`, `.sticker` y `.tape` son **solo** para superficies de juego:
`src/pages/student/` (Home, JoinGame, Lobby, Round, Results, End).

Las pantallas de autoría y de profesor (`src/pages/professor/`) siguen con
`.dramatic-card`. Fichas rotadas y washi tape en un editor de sesiones son
ruido, no juego.

## Dos medios, dos criterios

**El teléfono del alumno.** Es donde se juega. Un gráfico de dos paneles es
ilegible ahí — fue una de las cuatro críticas que hundieron un juego a 3,0/7.
Toda imagen de una ronda se mira a ancho de teléfono antes de darla por buena.

**El proyector.** La pantalla del anfitrión **se proyecta delante del curso**.
De ahí sale una regla que no es estética: nada privado aparece en una pantalla
proyectada. El feedback de los alumnos, con nombres, vive en el reporte de
clase, una página a la que se entra a propósito. El criterio no es ocultar, es
el lugar.

La trama de puntos del fondo está al 5% justamente por esto: se nota a treinta
centímetros y desaparece proyectada.

## Verificar mirando, no con tests

No hay tests de componentes en el repo y hay una clase entera de fallas que pasa
todos los chequeos automáticos. Levantar la app y mirar la pantalla — el skill
**`run`** sirve para eso.

**Trampa de este repo:** el proyecto vive en `/mnt/c/` y WSL rompe inotify, así
que Vite necesita polling. Un servidor de desarrollo viejo **sigue sirviendo los
módulos anteriores sin decir nada en el log**: si un cambio "no se ve", primero
reiniciar el servidor, después dudar del CSS.

Accesibilidad mínima: el foco de teclado tiene que quedar visible en toda
superficie interactiva, y `alt` en toda imagen — ya está resuelto en
`src/index.css` y se rompe fácil al agregar componentes.
