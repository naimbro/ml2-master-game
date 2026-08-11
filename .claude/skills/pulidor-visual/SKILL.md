---
name: pulidor-visual
description: Use when changing how the game looks — "se ve feo", "que se vea mejor", "no se lee en el teléfono", "arreglar el layout", "esta pantalla quedó apretada", or when editing any screen under src/pages/student, src/pages/professor, src/components or src/index.css. Also use before shipping a new session, to check its rounds on a phone-sized screen, and to decide which of its questions deserve una imagen and to go find one.
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

## Ponerle imágenes a una sesión

Va en **dos pasadas**, y la primera es barata a propósito: buscar imágenes para
seis rondas es caro, y la mayoría de las rondas no las necesita.

### Pasada 1 — cuáles rondas la merecen, y ofrecerle el número a Naim

Recorrer los escenarios y clasificar cada uno en una de tres:

| Clase | Qué es | Qué hacer |
|---|---|---|
| **La imagen ES la pregunta** | Sin ella la pregunta no existe: un gráfico que hay que leer, una foto que hay que comparar, un audio que hay que oír | Imagen obligatoria |
| **La imagen ancla a una persona, un lugar o un objeto** | La ronda nombra a alguien y verle la cara lo fija: Foucault, Maradona, una portada, un afiche | Imagen si aparece una legítima; si no, no pasa nada |
| **La imagen sería decoración** | Un concepto abstracto —autoexplotación, potencia negativa, incentivos— donde cualquier foto es una metáfora que el autor eligió | **No poner ninguna** |

La tercera fila es la que hay que defender. Una foto de alguien cansado frente a
un notebook no aporta evidencia: aporta la interpretación de quien la eligió, y
en una pregunta abierta eso le sopla la respuesta al curso.

**Entregarle a Naim una tabla con las rondas, su clase, y qué imagen se buscaría
para cada una — y un número recomendado.** Dos o tres imágenes en un juego de
seis rondas es lo normal. Seis de seis significa que se pusieron por poner.

Recién con su visto bueno se sale a buscar.

### La regla dura, que acá también manda

**Una imagen no puede introducir un hecho que la clase no vio.** Vale para las
imágenes igual que para los distractores. Un retrato de un autor identifica a una
persona que el material ya nombra: eso está bien. Un gráfico, un mapa o una
tabla que el curso nunca proyectó es un hecho nuevo, y ahí se cambia la pregunta,
no se agrega la imagen.

### Pasada 2 — buscar, y verificar la licencia una por una

**Este repo es público y se publica en GitHub Pages.** Una imagen mal licenciada
no es un detalle: queda publicada con el nombre de Naim encima.

Buscar en Wikimedia Commons, en los archivos nacionales y en las colecciones
abiertas de museos. Y después, **por cada archivo, abrir su ficha y leer la
etiqueta de licencia**. Trampas verificadas, todas encontradas en una sola
búsqueda de una foto de Foucault en agosto de 2026:

- **El listado de la categoría no dice la licencia.** Hay que abrir
  `commons.wikimedia.org/wiki/File:<nombre>` y leer el tag: `PD-old`,
  `PD-US-expired`, `PD-Brazil-Gov`, `CC0`, `CC-BY-SA`…
- **«Own work» sobre una persona muerta hace décadas es sospechoso.** Había un
  retrato de Foucault subido como obra propia en 2013, con Foucault muerto en
  1984. Descartado.
- **El nombre del archivo no garantiza el sujeto.** Otro resultado era un
  medallón del siglo XVIII de un Michel Foucault distinto.
- **Mirar las dimensiones antes de celebrar.** 207 px de ancho se ve blando
  proyectado; por debajo de ~450 px de ancho, buscar otra.
- **Descargar con un `User-Agent` propio.** Wikimedia rechaza el de curl por
  defecto.

Anotar en el commit de dónde salió y con qué licencia. Cuesta una línea y es lo
único que hace auditable la decisión seis meses después.

### Cómo se escribe en el contenido

Las trampas de mecánica están en `esquema.md` de `autor-de-contenido`; lo que
importa repetir acá:

- El archivo va bajo **`public/media/<curso>/`** y el `src` se escribe **sin
  slash inicial** (`media/mgt300/foucault-1968.jpg`). Con slash, 404ea **sólo en
  producción**. `validate-content.cjs` verifica que el archivo exista.
- **`alt` obligatorio**, y `credit` con fuente, fecha y licencia — se muestra bajo
  la imagen.
- Después de agregarla, **`npm run build` y confirmar que quedó en `dist/media/`**.
  Ese es el error que no aparece en `npm run dev`.

### Y después, mirarla a ancho de teléfono

Con la imagen puesta, publicar la ronda renderizada a **390 px** con `Artifact` y
mirarla ahí antes de darla por buena. Una foto que se ve bien en el monitor puede
comerse la pantalla del teléfono y empujar la pregunta bajo el pliegue.

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
