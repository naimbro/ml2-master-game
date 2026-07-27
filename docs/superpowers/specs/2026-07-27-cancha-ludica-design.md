# Cancha, pero jugable — pase lúdico sobre la identidad clara

**Fecha:** 2026-07-27
**Estado:** diseño aprobado, pendiente plan de implementación
**Mockups:** https://claude.ai/code/artifact/a6433f2f-b2e0-4777-857c-d5d06fe1858b

## Contexto

Desde el 2026-07-26 la app usa la identidad "Cancha": fondo claro `#FAFAF8`, tinta para
la estructura, naranjo como color de acción, verde reservado para "correcto". La paleta
funciona. El problema es otro: **se lee institucional**. Todo es la misma tarjeta blanca
con borde gris, el color solo aparece cuando el sistema necesita informar algo, y la
metáfora que le da nombre a la identidad no está dibujada en ninguna parte.

Se presentaron tres direcciones (A dibujo / B material / C tiempo). Naim aprobó la
combinación **B completo + C en el cierre de ronda + solo el marcador y el dorsal de A**.

No se toca ningún token de color existente. No se renombra ninguna clase `kahoot.*`.

## Alcance

**Sí** — superficies de juego, las que ve el curso:
`Home`, `JoinGame`, `Lobby`, `Round`, `Results`, `End`, `RecalibrationReveal` (solo su acento).

**No** — superficies de autoría y administración:
`Dashboard`, `CreateGame`, `SessionEditor`, `SessionBuilder`, `CourseForm`, `CourseJudges`,
`ClassReport`, `AdminPanel`, `RequestAccess`.

Esto es una decisión, no un olvido: fichas rotadas y sombras de sobreimpresión en un
formulario de edición de sesión son ruido. Las pantallas del profesor se quedan con el
Cancha actual, limpio. La consecuencia práctica es que **B no puede vivir en
`.dramatic-card`**, que se usa en ambos mundos — necesita una clase propia (§B.1).

## B · Papel y sticker (completo)

El vocabulario de un buen juego de mesa aplicado sobre el mismo papel: contorno grueso,
sombra dura a color, trama de medios tonos, calcomanías troqueladas y piezas apenas
torcidas. Es una capa de material: no mueve ni un dato de sitio.

### B.1 · Una clase nueva, no una modificación de `.dramatic-card`

`.dramatic-card` se queda exactamente como está (la usan las pantallas del profesor).
Se agrega en `src/index.css`, capa `components`:

```css
.card-play {
  @apply bg-surface rounded-2xl;
  border: 2.5px solid var(--ink);
  box-shadow: 4px 4px 0 var(--orange);
}
```

Las superficies de juego cambian `dramatic-card` → `card-play`. Es un reemplazo textual
acotado a los archivos de §Alcance.

### B.2 · Tokens nuevos

Solo tres, todos derivados de los que ya existen:

```css
--shadow-print: 4px 4px 0;   /* sobreimpresión risográfica */
--tilt-a: -0.6deg;
--tilt-b:  0.5deg;
```

Cero colores nuevos.

### B.3 · Trama de medios tonos

`.bg-gradient-main` gana una capa de puntos sobre el papel plano:

```css
.bg-gradient-main {
  background:
    radial-gradient(circle at 1px 1px, rgba(16,17,20,.05) 1px, transparent 1.6px) 0 0/7px 7px,
    var(--paper);
}
```

Al 5% sobre `#FAFAF8` la trama se nota a treinta centímetros y desaparece proyectada.
Ese es exactamente el efecto buscado: cariño en el teléfono, limpieza en la sala.

### B.4 · Rotaciones mínimas

Utilidades `.tilt-a` / `.tilt-b` (±0,6°), aplicadas a filas de tabla alternas, fichas de
jugador del lobby y la tarjeta de pregunta. **Se apagan bajo `prefers-reduced-motion`**
junto con el resto del bloque que ya existe al final de `index.css`.

Nada rota más de 0,6°. Un grado ya se lee como error de maquetación.

### B.5 · Calcomanía troquelada

Clase `.sticker` para los badges de puesto y las llaves A/B/C/D de las preguntas:
círculo, anillo blanco de troquel, sombra suave, rotado -7°.

`.sticker` define **solo la forma** — círculo, anillo, sombra, giro. El relleno lo pone
quien la usa, porque el dorsal del podio varía por puesto (§A.2):

```css
.sticker {
  border-radius: 50%;
  color: var(--ink);           /* los rellenos de acento son fill-only: nunca texto blanco */
  box-shadow: 0 0 0 3px var(--surface), 2px 3px 5px rgba(16,17,20,.3);
  transform: rotate(-7deg);
}
```

El relleno por defecto en las llaves A/B/C/D sigue siendo `MC_KEY_COLORS`, que ya existe
en `Round.tsx:24`; lo único que cambia es la forma.

### B.6 · Washi tape

Clase `.tape` para el marcador "(Tú)": fondo ámbar `#F5A524`, texto tinta, rotado -2°,
sin borde redondeado. Reemplaza el `text-kahoot-green (Tu)` actual de `Results.tsx:432`
— que además hoy usa verde, y verde está reservado para "correcto".

### B.7 · Botones y campos

`.primary-button` mantiene el fondo naranjo y el texto tinta, pero el borde pasa a tinta
2,5px y la sombra dura sube de 3px a 4px con desplazamiento en X. Misma física de
pulsación que ya tiene (`translateY(3px)` + sombra a cero).

## C · Arcade, solo en el cierre de ronda

**Corrección importante respecto del pitch:** buena parte de lo que ofrecí en la dirección
C ya existe y funciona.

Ya está construido en `src/pages/student/Results.tsx`:
- La tabla **ya se reordena a la vista** — máquina de estados `show → swap → reveal → done`,
  tween explícito de 3s con offsets calculados sobre `ROW_H` (líneas 343-371).
- El confetti ya existe (`src/lib/confetti.ts`: `confettiBurst`, `confettiCannons`).
- El diseño sonoro del cierre ya existe (`playDrumRoll`, `playTensionSweep`, `playRankReveal`).

Lo que **falta de verdad** son tres cosas:

### C.1 · Los números cuentan

Hoy `avgScore` aparece de golpe con un spring (`Results.tsx:458-466`). El dato para
contar ya está calculado: `prevAvg` (línea 133). Se agrega `src/hooks/useCountUp.ts`:

- interpola `prevAvg → avgScore` en 760 ms con `easeOutCubic` sobre `requestAnimationFrame`
- bajo `prefers-reduced-motion` devuelve el valor final de inmediato, sin animar
- el `roundScore` cuenta desde 0

Los números ya llevan `font-mono tabular-nums`, así que no van a saltar de ancho.

### C.2 · Racha

**Restricción real:** `Player` (`src/types/game.ts:9-18`) tiene `totalScore` y
`currentRoundScore`, pero **no** un arreglo de puntajes por ronda. `LeaderboardEntry.roundScores`
es otro tipo y se calcula en el servidor. O sea: una racha compartida, visible en la tabla
proyectada, **exige tocar `processRoundEnd` y desplegar funciones** — que en este proyecto
es el paso caro (ver `CLAUDE.md`).

**Decisión:** la racha es solo del jugador, en su propia pantalla, calculada en el cliente
y persistida en `localStorage` con clave `racha:{gameCode}:{uid}`.

- Se incrementa cuando el `roundScore` de la ronda es ≥ 70; se apaga si no.
- Se muestra en la tarjeta "Tu Resultado", no en la tabla proyectada.
- Es decoración: **no entra en ningún cálculo de puntaje**, así que que sea local y
  no autoritativa no rompe nada.

Si más adelante se quiere en la pantalla proyectada, la ruta es agregar
`players.{id}.roundScores[]` en `processRoundEnd` — queda anotado, fuera de este alcance.

### C.3 · Las esperas se llenan

El estado donde el alumno pasa más minutos es hoy un punto gris que pulsa
(`Round.tsx`, «Esperando a que termine la ronda…»). Se reemplaza por, en este orden de
prioridad:

1. **"N de M ya respondieron"** — dato que ya está en el juego, y es el que genera presión.
2. Los tres jueces trabajando, cuando la ronda es evaluada (usa los avatares que ya existen).

### C.4 · Descartado: "puntos en juego"

Lo pitcheé y lo retiro. El puntaje es un promedio 0-100 evaluado por jueces, no una
acumulación con apuesta variable: el "en juego" sería siempre 100. Sería un adorno que
miente sobre la mecánica.

## A · Solo el marcador y el dorsal

Nada de líneas de cancha, círculo central ni reloj de estadio. Dos elementos:

### A.1 · Barra de marcador

La cabecera de `Results.tsx` (líneas 291-304) pasa de `border-b-2 border-line` sobre papel
a una barra de tinta a sangre completa: ronda en blanco, código de juego en naranjo,
números tabulares. Da estructura de competencia sin comprometer la identidad a un deporte.

### A.2 · Dorsal circular

El badge de puesto pasa de cuadrado `rounded-xl` a círculo con anillo de tinta.

Esto además **arregla un problema de paleta que existe hoy**: `Results.tsx:388-394` usa
`bg-yellow-500`, `bg-gray-400` y `bg-amber-600` — tres colores crudos de Tailwind que no
están en el sistema Cancha. El podio pasa a:

| Puesto | Fondo | Texto |
|---|---|---|
| 1 | `--amber` `#F5A524` | tinta |
| 2 | `--surface-3` `#E8E7E2` | tinta |
| 3 | `--orange` `#FF5A1F` | tinta |
| resto | transparente, anillo de tinta | tinta |

El dorsal usa `.sticker` de §B.5, así que A.2 y B se resuelven con la misma clase.

## Restricciones duras

No son recomendaciones: si alguna se rompe, el cambio está mal.

1. **Naranjo `#FF5A1F` y ámbar `#F5A524` son fill-only.** Blanco encima da 3,1:1 y 2,0:1 —
   ambos reprueban AA. Siempre llevan texto tinta. Para acento *como texto* existen
   `text-orange-ink` y `text-amber-ink`.
2. **Verde `#0B7A46` significa "correcto" y nada más.** §B.6 lo saca del marcador "(Tú)".
3. **Todo lo que rota o se mueve se apaga bajo `prefers-reduced-motion`**, incluidas las
   rotaciones estáticas de §B.4.
4. **Legibilidad en proyector manda.** Si la trama o una rotación se nota desde el fondo
   de la sala, está mal calibrada.
5. **`RecalibrationReveal` se queda oscuro.** Es un corte a pantalla completa a propósito.

## Archivos que se tocan

| Archivo | Qué |
|---|---|
| `src/index.css` | `.card-play`, `.sticker`, `.tape`, `.tilt-*`, trama, `--shadow-print`, botones, bloque reduced-motion |
| `tailwind.config.js` | nada de colores; a lo sumo exponer `--shadow-print` |
| `src/hooks/useCountUp.ts` | **nuevo** — §C.1 |
| `src/pages/student/Results.tsx` | marcador (A.1), dorsal (A.2), conteo (C.1), racha (C.2), `.tape` (B.6) |
| `src/pages/student/Round.tsx` | `.card-play`, llaves `.sticker`, esperas (C.3) |
| `src/pages/student/Lobby.tsx` | `.card-play`, fichas con `.tilt-*` |
| `src/pages/student/Home.tsx`, `JoinGame.tsx`, `End.tsx` | `.card-play`, botones |

## Verificación

Los tests automáticos no sirven para esto — un pase visual pasa `tsc` y `vitest` sin
mirar nada. La verificación es jugar:

1. `npm run build` compila y `npm run lint` limpio.
2. Un juego real de `mundial_2026` **con dos pantallas** (proyector + teléfono), que es
   como se encontraron los últimos bugs de verdad.
3. Revisar en el proyector: ¿la trama se nota? ¿alguna rotación se lee como error?
4. Chequear contraste de cada par fondo/texto nuevo contra AA.
5. Con `prefers-reduced-motion` activo: nada rota, nada cuenta, los valores salen finales.

## Ruta de revert

Un solo commit, `git revert` y vuelve el Cancha actual.

⚠️ **Precondición:** el árbol de trabajo tiene sin commitear el cambio de timeline
compartida de MC (`Round.tsx`, `mcTiming.ts`, `useGame.ts`, `functions/src/index.ts`,
contenido de `mundial_2026`). Ese trabajo debe estar commiteado **antes** de empezar,
o el pase visual queda mezclado con él y la promesa de "un commit de revert" deja de ser
cierta.
