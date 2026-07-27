# Cancha Lúdica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que las pantallas de juego se sientan lúdicas — material de juego de mesa (B), números que cuentan y racha en el cierre de ronda (C), y marcador + dorsal de competencia (A) — sin cambiar un solo color de la paleta Cancha.

**Architecture:** Tres capas independientes. (1) CSS puro en `src/index.css`: una clase `.card-play` nueva que reemplaza a `.dramatic-card` **solo en superficies de juego**, más `.sticker`, `.tape`, `.tilt-*` y la trama de medios tonos. (2) Dos módulos de lógica pura con tests (`src/lib/countUp.ts`, `src/lib/racha.ts`) consumidos por un hook y por `Results.tsx`. (3) Ediciones puntuales en `Results.tsx` y `Round.tsx`. Las pantallas del profesor no se tocan.

**Tech Stack:** React 19, TypeScript, Tailwind 3.4, framer-motion 12, vitest.

**Spec:** `docs/superpowers/specs/2026-07-27-cancha-ludica-design.md`

**Nota sobre TDD:** las Tareas 1 y 2 son lógica pura y van con test primero. Las Tareas 3-8 son visuales: no existe test automático que detecte que una rotación se ve mal en un proyector, y este proyecto ya tiene documentado que esa clase de bug pasa todos los checks. Su verificación es `npm run build` + jugar una partida real con dos pantallas (Tarea 9).

---

### Task 1: `countUp` — lógica de interpolación

**Files:**
- Create: `src/lib/countUp.ts`
- Test: `src/lib/countUp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/countUp.test.ts
import { describe, it, expect } from 'vitest';
import { easeOutCubic, countUpValue } from './countUp';

describe('easeOutCubic', () => {
  it('anchors both ends', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('front-loads the movement', () => {
    // a los 25% del tiempo ya recorrió más de la mitad del camino
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.5);
  });
});

describe('countUpValue', () => {
  it('starts at `from`', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 0, durationMs: 760 })).toBe(10);
  });

  it('lands exactly on `to` when the time is up', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 760, durationMs: 760 })).toBe(90);
  });

  it('never overshoots past the end', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 5000, durationMs: 760 })).toBe(90);
  });

  it('counts down as happily as it counts up', () => {
    expect(countUpValue({ from: 90, to: 10, elapsedMs: 760, durationMs: 760 })).toBe(10);
  });

  it('rounds to whole numbers by default', () => {
    expect(Number.isInteger(countUpValue({ from: 0, to: 100, elapsedMs: 300, durationMs: 760 }))).toBe(true);
  });

  it('keeps one decimal for averages when asked', () => {
    // el promedio del ranking se muestra con un decimal
    const v = countUpValue({ from: 0, to: 82.7, elapsedMs: 760, durationMs: 760, decimals: 1 });
    expect(v).toBe(82.7);
  });

  it('treats a zero-length run as already finished', () => {
    expect(countUpValue({ from: 10, to: 90, elapsedMs: 0, durationMs: 0 })).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/countUp.test.ts`
Expected: FAIL — `Failed to resolve import "./countUp"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/countUp.ts

/** Duración estándar de un conteo en el cierre de ronda. */
export const COUNT_UP_MS = 760;

/**
 * Rápido al principio, suave al final: el número salta y después se asienta.
 * Un easing lineal se lee como una barra de carga, no como un puntaje subiendo.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface CountUpArgs {
  from: number;
  to: number;
  elapsedMs: number;
  durationMs: number;
  /** Decimales a conservar. El promedio del ranking usa 1; los puntajes, 0. */
  decimals?: number;
}

/**
 * Valor del conteo en un instante dado. Función pura del tiempo transcurrido:
 * el hook sólo le pasa el reloj, así que se puede testear sin rAF ni Date.now.
 */
export function countUpValue({ from, to, elapsedMs, durationMs, decimals = 0 }: CountUpArgs): number {
  const t = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / durationMs));
  const raw = from + (to - from) * easeOutCubic(t);
  const factor = Math.pow(10, decimals);
  return Math.round(raw * factor) / factor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/countUp.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/countUp.ts src/lib/countUp.test.ts
git commit -m "feat(ui): interpolacion pura para los conteos del cierre de ronda"
```

---

### Task 2: `racha` — estado y persistencia

**Files:**
- Create: `src/lib/racha.ts`
- Test: `src/lib/racha.test.ts`

El `store` se inyecta en vez de tocar `localStorage` directo: así los tests corren sin
jsdom y el módulo no depende del entorno.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/racha.test.ts
import { describe, it, expect } from 'vitest';
import {
  RACHA_THRESHOLD,
  EMPTY_RACHA,
  applyRound,
  rachaStorageKey,
  readRacha,
  writeRacha,
  type RachaState,
} from './racha';

function fakeStore(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    data,
  };
}

describe('applyRound', () => {
  it('empieza la racha con una ronda buena', () => {
    expect(applyRound(EMPTY_RACHA, 1, RACHA_THRESHOLD)).toEqual({ count: 1, best: 1, lastRound: 1 });
  });

  it('no cuenta una ronda bajo el umbral', () => {
    expect(applyRound(EMPTY_RACHA, 1, RACHA_THRESHOLD - 1)).toEqual({ count: 0, best: 0, lastRound: 1 });
  });

  it('acumula rondas buenas consecutivas', () => {
    const a = applyRound(EMPTY_RACHA, 1, 80);
    const b = applyRound(a, 2, 75);
    expect(b).toEqual({ count: 2, best: 2, lastRound: 2 });
  });

  it('corta la racha con una ronda mala pero recuerda la mejor', () => {
    const a = applyRound(EMPTY_RACHA, 1, 80);
    const b = applyRound(a, 2, 90);
    const c = applyRound(b, 3, 40);
    expect(c).toEqual({ count: 0, best: 2, lastRound: 3 });
  });

  it('es idempotente: la misma ronda dos veces no cuenta dos veces', () => {
    // Results.tsx re-renderiza con cada update de Firestore; sin esto la racha se dispara.
    const a = applyRound(EMPTY_RACHA, 1, 80);
    expect(applyRound(a, 1, 80)).toEqual(a);
  });

  it('ignora una ronda anterior que llegue fuera de orden', () => {
    const a = applyRound(EMPTY_RACHA, 3, 80);
    expect(applyRound(a, 2, 80)).toEqual(a);
  });
});

describe('rachaStorageKey', () => {
  it('separa por juego y por jugador', () => {
    expect(rachaStorageKey('4R7K', 'uid-1')).toBe('racha:4R7K:uid-1');
    expect(rachaStorageKey('4R7K', 'uid-1')).not.toBe(rachaStorageKey('4R7K', 'uid-2'));
  });
});

describe('readRacha / writeRacha', () => {
  it('devuelve la racha vacia cuando no hay nada guardado', () => {
    expect(readRacha(fakeStore(), 'racha:X:y')).toEqual(EMPTY_RACHA);
  });

  it('devuelve la racha vacia cuando lo guardado es basura', () => {
    expect(readRacha(fakeStore({ 'racha:X:y': 'no-json' }), 'racha:X:y')).toEqual(EMPTY_RACHA);
  });

  it('devuelve la racha vacia cuando el JSON no tiene la forma esperada', () => {
    expect(readRacha(fakeStore({ 'racha:X:y': '{"count":"dos"}' }), 'racha:X:y')).toEqual(EMPTY_RACHA);
  });

  it('sobrevive una ida y vuelta', () => {
    const store = fakeStore();
    const state: RachaState = { count: 3, best: 4, lastRound: 5 };
    writeRacha(store, 'racha:X:y', state);
    expect(readRacha(store, 'racha:X:y')).toEqual(state);
  });

  it('no explota si el navegador niega el almacenamiento', () => {
    const hostile = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    expect(readRacha(hostile, 'k')).toEqual(EMPTY_RACHA);
    expect(() => writeRacha(hostile, 'k', EMPTY_RACHA)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/racha.test.ts`
Expected: FAIL — `Failed to resolve import "./racha"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/racha.ts

/**
 * Racha de rondas consecutivas puntuando bien. Es DECORACIÓN: no entra en ningún
 * cálculo de puntaje.
 *
 * Vive en el cliente porque `Player` (src/types/game.ts) sólo guarda `totalScore` y
 * `currentRoundScore` — no hay historial por ronda en el doc del juego. Mostrarla en la
 * tabla proyectada exigiría escribir `players.{id}.roundScores[]` en `processRoundEnd` y
 * desplegar funciones; por eso la racha se muestra sólo en la pantalla del propio jugador.
 */

export const RACHA_THRESHOLD = 70;

export interface RachaState {
  count: number;
  best: number;
  /** Última ronda ya contabilizada. Hace `applyRound` idempotente. */
  lastRound: number;
}

export const EMPTY_RACHA: RachaState = { count: 0, best: 0, lastRound: 0 };

export function applyRound(prev: RachaState, round: number, roundScore: number): RachaState {
  // Firestore reemite el doc en cada update; sin esta guarda la misma ronda
  // incrementaría la racha varias veces.
  if (round <= prev.lastRound) return prev;

  const count = roundScore >= RACHA_THRESHOLD ? prev.count + 1 : 0;
  return { count, best: Math.max(prev.best, count), lastRound: round };
}

export function rachaStorageKey(gameCode: string, playerId: string): string {
  return `racha:${gameCode}:${playerId}`;
}

type ReadableStore = { getItem: (key: string) => string | null };
type WritableStore = { setItem: (key: string, value: string) => void };

function isRachaState(v: unknown): v is RachaState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.count === 'number' && typeof o.best === 'number' && typeof o.lastRound === 'number';
}

export function readRacha(store: ReadableStore, key: string): RachaState {
  try {
    const raw = store.getItem(key);
    if (!raw) return EMPTY_RACHA;
    const parsed: unknown = JSON.parse(raw);
    return isRachaState(parsed) ? parsed : EMPTY_RACHA;
  } catch {
    // Safari en modo privado y algunas políticas de empresa lanzan al tocar
    // localStorage. Una racha perdida no puede romper la pantalla de resultados.
    return EMPTY_RACHA;
  }
}

export function writeRacha(store: WritableStore, key: string, state: RachaState): void {
  try {
    store.setItem(key, JSON.stringify(state));
  } catch {
    // Ídem: se pierde la racha, no pasa nada más.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/racha.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/racha.ts src/lib/racha.test.ts
git commit -m "feat(ui): racha local del jugador, con guarda de idempotencia"
```

---

### Task 3: `useCountUp` — el hook

**Files:**
- Create: `src/hooks/useCountUp.ts`

Sin test propio: la lógica ya está cubierta en la Tarea 1 y lo único que agrega el hook es
`requestAnimationFrame`, que no se testea con provecho. Se verifica visualmente.

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useCountUp.ts
import { useEffect, useRef, useState } from 'react';
import { COUNT_UP_MS, countUpValue } from '../lib/countUp';

interface Options {
  durationMs?: number;
  decimals?: number;
  /** Mientras sea false el valor se queda en `from`: deja armar el conteo y dispararlo después. */
  active?: boolean;
}

/**
 * Cuenta de `from` a `to` cuando `active` pasa a true.
 * Bajo prefers-reduced-motion devuelve `to` de inmediato, sin animar.
 */
export function useCountUp(
  from: number,
  to: number,
  { durationMs = COUNT_UP_MS, decimals = 0, active = true }: Options = {},
): number {
  const [value, setValue] = useState(active ? from : from);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!active) { setValue(from); return; }

    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === to) { setValue(to); return; }

    const start = performance.now();
    const tick = (now: number) => {
      const elapsedMs = now - start;
      setValue(countUpValue({ from, to, elapsedMs, durationMs, decimals }));
      if (elapsedMs < durationMs) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [from, to, durationMs, decimals, active]);

  return value;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: sin salida (éxito)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCountUp.ts
git commit -m "feat(ui): hook useCountUp con respeto por reduced-motion"
```

---

### Task 4: La capa de material en CSS (B)

**Files:**
- Modify: `src/index.css`

Todo lo visual de B vive acá. Ningún componente cambia todavía.

- [ ] **Step 1: Añadir los tokens**

En el bloque `:root` de `src/index.css`, justo después de `--shadow-hard: 0 3px 0;`:

```css
  /* Sobreimpresión risográfica: la sombra dura se desplaza también en X y va a color. */
  --shadow-print: 4px 4px 0;
  --tilt-a: -0.6deg;
  --tilt-b:  0.5deg;
```

- [ ] **Step 2: Añadir la trama de medios tonos**

Reemplazar la utilidad `.bg-gradient-main` existente en el bloque `@layer utilities`:

```css
  /* Used on every page as the full-screen ground. Kept as a utility name so
     the restyle is a CSS change, not 36 component edits.
     La trama al 5% se nota a treinta centímetros y desaparece proyectada:
     cariño en el teléfono, limpieza en la sala. */
  .bg-gradient-main {
    background:
      radial-gradient(circle at 1px 1px, rgba(16, 17, 20, .05) 1px, transparent 1.6px) 0 0 / 7px 7px,
      var(--paper);
  }
```

- [ ] **Step 3: Añadir las clases nuevas**

Dentro de `@layer components`, inmediatamente después de la regla `.dramatic-card`
(que NO se modifica — la usan las pantallas del profesor):

```css
  /* ── Capa "papel y sticker" ─────────────────────────────────────────────
     Sólo para superficies de juego (home, join, lobby, round, results, end).
     Las pantallas de autoría siguen usando .dramatic-card: fichas rotadas en
     un editor de sesiones son ruido, no juego. */
  .card-play {
    @apply bg-surface rounded-2xl;
    border: 2.5px solid var(--ink);
    box-shadow: var(--shadow-print) var(--orange);
  }

  /* Calcomanía troquelada. Define SÓLO la forma: el relleno lo pone quien la
     usa, porque el dorsal del podio cambia de color por puesto. */
  .sticker {
    border-radius: 50%;
    box-shadow: 0 0 0 3px var(--surface), 2px 3px 5px rgba(16, 17, 20, .30);
    transform: rotate(-7deg);
  }

  /* Washi tape. Sin radio y con giro: se lee como un trozo de cinta pegado.
     Ámbar es fill-only, así que lleva texto tinta. */
  .tape {
    background: var(--amber);
    color: var(--ink);
    padding: 0 .4em;
    transform: rotate(-2deg);
    display: inline-block;
    font-weight: 800;
  }

  /* Nada rota más de 0,6°: un grado ya se lee como error de maquetación. */
  .tilt-a { transform: rotate(var(--tilt-a)); }
  .tilt-b { transform: rotate(var(--tilt-b)); }
```

- [ ] **Step 4: Engrosar los botones**

Reemplazar la regla `.primary-button` existente (mantiene fondo naranjo y texto tinta):

```css
  .primary-button {
    @apply text-ink px-6 py-3 rounded-xl font-bold text-base uppercase tracking-wide;
    @apply transition-all duration-150;
    @apply disabled:opacity-40 disabled:cursor-not-allowed;
    background: var(--orange);
    border: 2.5px solid var(--ink);
    box-shadow: var(--shadow-print) var(--ink);
  }
  .primary-button:hover:not(:disabled) { filter: brightness(1.05); }
  .primary-button:active:not(:disabled) {
    transform: translate(4px, 4px);
    box-shadow: 0 0 0 var(--ink);
  }
```

- [ ] **Step 5: Apagar todo bajo reduced-motion**

En el bloque `@media (prefers-reduced-motion: reduce)` al final del archivo, añadir
las clases nuevas a la lista que ya neutraliza `transform`:

```css
  .primary-button:active:not(:disabled),
  .secondary-button:active:not(:disabled),
  .danger-button:active:not(:disabled) {
    transform: none;
  }
  /* Las rotaciones de B son estáticas, no animaciones — hay que apagarlas
     explícitamente, `animation: none` no las alcanza. */
  .sticker,
  .tape,
  .tilt-a,
  .tilt-b {
    transform: none;
  }
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build exitoso

- [ ] **Step 7: Commit**

```bash
git add src/index.css
git commit -m "feat(ui): capa 'papel y sticker' — card-play, sticker, tape, trama"
```

---

### Task 5: Aplicar `.card-play` a las superficies de juego

**Files:**
- Modify: `src/pages/student/Home.tsx` (1), `JoinGame.tsx`, `Lobby.tsx`, `Round.tsx` (9), `Results.tsx` (3), `End.tsx` (3)

**No tocar:** nada bajo `src/pages/professor/`, ni `src/components/SupportLink.tsx`
(aparece en el footer de pantallas de ambos mundos).

- [ ] **Step 1: Reemplazar en los seis archivos**

```bash
sed -i 's/dramatic-card/card-play/g' \
  src/pages/student/Home.tsx \
  src/pages/student/JoinGame.tsx \
  src/pages/student/Lobby.tsx \
  src/pages/student/Round.tsx \
  src/pages/student/Results.tsx \
  src/pages/student/End.tsx
```

- [ ] **Step 2: Confirmar que las pantallas del profesor quedaron intactas**

Run: `grep -rc "dramatic-card" src/pages/professor src/components | grep -v ':0'`
Expected: los 8 archivos de profesor + `SupportLink.tsx`, con sus conteos originales
(ClassReport 8, Dashboard 3, CourseHome 2, CourseJudges 2, CreateGame 2, SessionEditor 2,
AdminPanel 1, RequestAccess 1, SupportLink 1)

Run: `grep -rc "dramatic-card" src/pages/student`
Expected: `0` en todos

- [ ] **Step 3: Añadir las rotaciones a las fichas del lobby**

En `src/pages/student/Lobby.tsx`, en el `className` de la tarjeta de jugador
(la `motion.div` que hoy dice `` className={`relative rounded-2xl p-4 text-center bg-gradient-to-br ...`} ``),
añadir la alternancia por índice justo después de `text-center`:

```tsx
              className={`relative rounded-2xl p-4 text-center ${
                index % 2 === 0 ? 'tilt-a' : 'tilt-b'
              } bg-gradient-to-br ${
```

- [ ] **Step 4: Verify the build**

Run: `npm run build && npm run lint`
Expected: ambos limpios

- [ ] **Step 5: Commit**

```bash
git add src/pages/student
git commit -m "feat(ui): las pantallas de juego pasan a card-play; fichas del lobby con giro"
```

---

### Task 6: Marcador y dorsal (A) en `Results.tsx`

**Files:**
- Modify: `src/pages/student/Results.tsx:291-304` (marcador), `:384-395` (dorsal), `:431-433` (tape)

- [ ] **Step 1: Barra de marcador**

Reemplazar el `<header>` actual (líneas 291-304):

```tsx
      {/* Barra de marcador: tinta a sangre, código en naranjo. Da estructura de
          competencia sin comprometer la identidad a un deporte concreto. */}
      <header className="bg-ink text-onaccent p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Resultados Ronda</span>
            <p className="text-xl font-black tabular-nums">
              {game.currentRound} <span className="text-white/45 font-bold">/ {game.totalRounds}</span>
            </p>
          </div>

          <div className="text-2xl font-black tracking-[0.2em] text-kahoot-orange tabular-nums">
            {gameCode}
          </div>
        </div>
      </header>
```

Naranjo sobre tinta es texto claro sobre fondo oscuro — el caso inverso al que reprueba
AA, así que aquí sí se puede usar como texto.

- [ ] **Step 2: Dorsal circular**

Reemplazar el `div` del badge de puesto (líneas 384-395). Esto además saca del podio
`bg-yellow-500`, `bg-gray-400` y `bg-amber-600`, tres colores crudos de Tailwind que no
pertenecen al sistema Cancha:

```tsx
                      <div
                        className={`w-10 h-10 sticker flex items-center justify-center font-black text-lg text-ink transition-colors duration-500 ${
                          !revealed
                            ? showingPrev ? 'bg-surface-3' : 'bg-surface-2'
                            : player.rank === 1
                            ? 'bg-kahoot-yellow'
                            : player.rank === 2
                            ? 'bg-surface-3'
                            : player.rank === 3
                            ? 'bg-kahoot-orange'
                            : 'bg-surface-2'
                        }`}
                      >
```

Los cuatro rellenos son fill-only y llevan texto tinta (`text-ink`), fijo en la clase.

- [ ] **Step 3: Washi tape para "(Tú)"**

Reemplazar la línea 432 — hoy usa verde, y verde está reservado para "correcto":

```tsx
                        <span className="tape text-sm ml-2">Tú</span>
```

Hacer el mismo reemplazo en la tarjeta de posición del usuario fuera del top N
(línea ~488, `<span className="text-kahoot-green text-sm ml-2 font-bold">(Tu)</span>`).

- [ ] **Step 4: Verify the build**

Run: `npm run build && npm run lint`
Expected: ambos limpios

- [ ] **Step 5: Commit**

```bash
git add src/pages/student/Results.tsx
git commit -m "feat(ui): marcador de tinta y dorsal circular; saca los Tailwind crudos del podio"
```

---

### Task 7: Los números cuentan y aparece la racha (C)

**Files:**
- Modify: `src/pages/student/Results.tsx` — imports, `:436-451` (roundScore), `:453-467` (avgScore), tarjeta "Tu Resultado"

- [ ] **Step 1: Imports**

Añadir junto a los imports existentes de `Results.tsx`:

```tsx
import { useCountUp } from '../../hooks/useCountUp';
import { applyRound, rachaStorageKey, readRacha, writeRacha, EMPTY_RACHA } from '../../lib/racha';
```

- [ ] **Step 2: Extraer la fila a un componente con conteo**

Los hooks no se pueden llamar dentro del `.map()` de las filas, así que el número que
cuenta va en su propio componente. Añadir en `Results.tsx`, antes de `export default function Results()`:

```tsx
/** Promedio acumulado que cuenta desde el de la ronda anterior. Un número que sube es un número que se mira. */
function AvgCounter({ from, to, active }: { from: number; to: number; active: boolean }) {
  const value = useCountUp(from, to, { decimals: 1, active });
  return <>{value}</>;
}

/** Puntaje de la ronda, contando desde cero. */
function RoundCounter({ to, active }: { to: number; active: boolean }) {
  const value = useCountUp(0, to, { active });
  return <>+{value}</>;
}
```

- [ ] **Step 3: Usarlos en la fila**

En el bloque del `roundScore` (líneas 442-450), reemplazar `+{player.roundScore}` dentro
del `motion.span`:

```tsx
                          <RoundCounter to={player.roundScore} active={revealed} />
```

En el bloque del `avgScore` (líneas 458-466), reemplazar `{player.avgScore}` dentro del
`motion.span`:

```tsx
                          <AvgCounter
                            from={Math.round(player.prevAvg * 10) / 10}
                            to={player.avgScore}
                            active={revealed}
                          />
```

`prevAvg` ya se calcula en la línea 133; se redondea a un decimal para que el conteo
empiece en el mismo formato en que termina y el ancho no salte.

- [ ] **Step 4: Calcular la racha**

Añadir dentro de `Results.tsx`, después de la definición de `userRank`:

```tsx
  // Racha del propio jugador. Decoración: no entra en ningún cálculo de puntaje.
  // Se persiste en localStorage porque el doc del juego no guarda historial por ronda.
  const [racha, setRacha] = useState(EMPTY_RACHA);
  useEffect(() => {
    if (!gameCode || !user?.uid || !userRank || !game?.currentRound) return;
    const key = rachaStorageKey(gameCode, user.uid);
    const next = applyRound(readRacha(window.localStorage, key), game.currentRound, userRank.score);
    writeRacha(window.localStorage, key, next);
    setRacha(next);
  }, [gameCode, user?.uid, userRank, game?.currentRound]);
```

- [ ] **Step 5: Mostrarla en "Tu Resultado"**

En la cabecera de la tarjeta "Tu Resultado" (`<h2 className="text-xl font-black">Tu Resultado</h2>`,
línea ~592), añadir el indicador inmediatamente después del `</h2>`:

```tsx
              {racha.count >= 2 && (
                <span className="ml-3 inline-flex items-center gap-2 bg-ink text-onaccent px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                  Racha <b className="font-display text-kahoot-orange text-sm">×{racha.count}</b>
                </span>
              )}
```

Se muestra desde 2: una sola ronda buena no es una racha.

- [ ] **Step 6: Verify build, lint and tests**

Run: `npm run build && npm run lint && npm test`
Expected: los tres limpios

- [ ] **Step 7: Commit**

```bash
git add src/pages/student/Results.tsx
git commit -m "feat(ui): los puntajes cuentan al revelarse y aparece la racha del jugador"
```

---

### Task 8: Las esperas se llenan (C.3)

**Files:**
- Create: `src/components/WaitingForRound.tsx`
- Modify: `src/pages/student/Round.tsx:507-513`, `:590-596`, `:969-975`

Los tres puntos de espera son hoy el mismo bloque copiado tres veces. Se extraen a un
componente y de paso muestran el dato que genera presión.

- [ ] **Step 1: Crear el componente**

```tsx
// src/components/WaitingForRound.tsx

/**
 * El estado donde el alumno pasa más minutos de la clase. Antes era un punto gris que
 * pulsaba; ahora dice cuánta gente falta, que es el dato que hace mirar la pantalla.
 */
export default function WaitingForRound({ answered, total }: { answered: number; total: number }) {
  const complete = total > 0 && answered >= total;
  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-surface-2 rounded-full border-2 border-line">
      <div className={`w-2 h-2 rounded-full ${complete ? 'bg-kahoot-green' : 'bg-kahoot-orange animate-pulse'}`} />
      <span className="text-ink-soft text-sm font-semibold">
        {total > 0 ? (
          <>
            <b className="font-black tabular-nums">{answered}</b>
            <span className="text-faint"> de </span>
            <b className="font-black tabular-nums">{total}</b>
            {complete ? ' ya respondieron — cerrando la ronda' : ' ya respondieron'}
          </>
        ) : (
          'Esperando a que termine la ronda...'
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Importar en `Round.tsx`**

```tsx
import WaitingForRound from '../../components/WaitingForRound';
```

- [ ] **Step 3: Reemplazar los tres bloques**

Cada uno de los tres bloques con esta forma exacta:

```tsx
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 rounded-full">
                      <div className="w-2 h-2 bg-kahoot-green rounded-full animate-pulse" />
                      <span className="text-ink-soft text-sm font-semibold">
                        Esperando a que termine la ronda...
                      </span>
                    </div>
```

pasa a:

```tsx
                    <WaitingForRound
                      answered={submissions.length}
                      total={Object.keys(game.players || {}).length}
                    />
```

`submissions` y `game` ya están en el scope del componente (líneas 38 y 417 los usan).

- [ ] **Step 4: Confirmar que no quedó ninguno**

Run: `grep -c "Esperando a que termine la ronda" src/pages/student/Round.tsx`
Expected: `0`

- [ ] **Step 5: Verify build, lint and tests**

Run: `npm run build && npm run lint && npm test`
Expected: los tres limpios

- [ ] **Step 6: Commit**

```bash
git add src/components/WaitingForRound.tsx src/pages/student/Round.tsx
git commit -m "feat(ui): las esperas muestran cuanta gente falta, no un punto gris"
```

---

### Task 9: Verificación visual

**Files:** ninguno — esto es mirar.

No hay test automático que detecte que una rotación se ve mal proyectada. Este proyecto
ya tiene documentado que toda esta clase de bug pasa cada check automático.

- [ ] **Step 1: Levantar el dev server**

Run: `npm run dev`
Nota: el proyecto vive en `/mnt/c`, donde inotify no funciona — el `vite.config.ts` ya
tiene polling activado. Si los cambios no aparecen, el server está viejo: reinícialo.

- [ ] **Step 2: Jugar una partida real de `mundial_2026` con dos pantallas**

Proyector (o segunda ventana) + teléfono. Recorrer: home → join → lobby → una ronda MC →
resultados → podio.

- [ ] **Step 3: Checklist en el proyector**

- [ ] ¿La trama de puntos se nota desde lejos? No debería.
- [ ] ¿Alguna rotación se lee como error de maquetación? No debería.
- [ ] ¿El marcador de tinta se lee desde el fondo de la sala?
- [ ] ¿Los dorsales del podio se distinguen entre sí?

- [ ] **Step 4: Checklist en el teléfono**

- [ ] ¿Los promedios cuentan al revelarse, y terminan en el valor correcto?
- [ ] ¿El ancho de los números salta mientras cuentan? No debería (`tabular-nums`).
- [ ] ¿La espera muestra "N de M ya respondieron" y el punto se pone verde al completarse?
- [ ] Tras dos rondas ≥70: ¿aparece "Racha ×2"? ¿Sobrevive un refresh?
- [ ] Tras una ronda <70: ¿desaparece?

- [ ] **Step 5: Reduced motion**

En DevTools → Rendering → Emulate CSS `prefers-reduced-motion: reduce`, recargar y
comprobar: nada rota, los números salen en su valor final, la pulsación del botón no
desplaza.

- [ ] **Step 6: Contraste**

Con el picker de DevTools, verificar ≥4.5:1 en los pares nuevos:
- naranjo `#FF5A1F` sobre tinta `#101114` (código del marcador)
- tinta sobre ámbar `#F5A524` (dorsal 1º y washi tape)
- tinta sobre naranjo `#FF5A1F` (dorsal 3º)

---

## Self-Review

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| B.1 `.card-play` | 4 (clase), 5 (aplicación) |
| B.2 tokens | 4 |
| B.3 trama | 4 |
| B.4 rotaciones | 4 (clases), 5 (lobby) |
| B.5 `.sticker` | 4 (clase), 6 (dorsal) |
| B.6 `.tape` | 4 (clase), 6 (uso) |
| B.7 botones | 4 |
| C.1 conteo | 1, 3, 7 |
| C.2 racha | 2, 7 |
| C.3 esperas | 8 |
| C.4 descartado | — (nada que hacer) |
| A.1 marcador | 6 |
| A.2 dorsal | 6 |
| Restricción 1 (fill-only) | 4, 6 — texto tinta fijo en `.tape` y en el dorsal |
| Restricción 2 (verde=correcto) | 6 — saca el verde de "(Tú)" |
| Restricción 3 (reduced-motion) | 4 paso 5, verificado en 9 paso 5 |
| Restricción 4 (proyector) | 9 paso 3 |
| Restricción 5 (Reveal oscuro) | — (no se toca `RecalibrationReveal.tsx`) |
| Verificación | 9 |

Sin huecos.

**Consistencia de tipos:** `RachaState {count,best,lastRound}` y `EMPTY_RACHA` se definen
en la Tarea 2 y se usan con esos mismos nombres en la 7. `countUpValue` recibe un objeto
`CountUpArgs` en la Tarea 1 y así lo llama `useCountUp` en la 3. `useCountUp(from, to, opts)`
se define en la 3 y se llama igual en la 7.
