# Telemetría de escritura en rondas abiertas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar cómo se escribió cada respuesta abierta (tiempo a la primera tecla, pegados, salidas de la app, huella del texto) y mostrárselo al profesor en el reporte de clase, sin que nada de eso puntúe, penalice ni bloquee a nadie.

**Architecture:** Una clase pura acumula la contabilidad en el navegador del alumno; un hook delgado le conecta los eventos del textarea y un `setInterval`; `submitAnswer` escribe el resultado como fire-and-forget en una subcolección nueva que sólo lee el anfitrión. El panel es una sección nueva en `ClassReport.tsx` que lee esa subcolección directo de Firestore y dibuja dos vistas: una nube agregada sin nombres y una rejilla de sparklines por alumno.

**Tech Stack:** React 18 + TypeScript + Vite, Firestore (SDK web modular), vitest. Sin Cloud Functions: nada que desplegar en `functions/`.

**Spec:** `docs/superpowers/specs/2026-08-08-telemetria-antitrampa-design.md`

---

## Convención de commits

Todos los commits de este plan llevan el trailer estándar del repo. La primera vez va completo:

```bash
git commit -m "$(cat <<'EOF'
feat(telemetria): mensaje

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01165kqGp6PK73itu7XcQ6z7
EOF
)"
```

En las tareas siguientes se abrevia como `git commit -m "<mensaje>"` — **agrega igual el
trailer**.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/registroEscritura.ts` *(nuevo)* | Clase pura `RegistroEscritura`: toda la contabilidad, con reloj inyectado. Sin React, sin Firestore. |
| `src/lib/registroEscritura.test.ts` *(nuevo)* | Tests de la contabilidad con reloj falso. |
| `src/lib/telemetriaDerived.ts` *(nuevo)* | Tipos compartidos + geometría de la sparkline y de la nube + formato de tiempos + los hechos del cajón de detalle. Puro. |
| `src/lib/telemetriaDerived.test.ts` *(nuevo)* | Tests de la geometría y el formato. |
| `src/hooks/useTypingTelemetry.ts` *(nuevo)* | Cableado: instancia el registro en un ref, conecta `onPaste`, `visibilitychange` y el intervalo. Cero lógica propia. |
| `src/pages/student/Round.tsx` *(modificar)* | Enchufa el hook al textarea y pasa la foto a `submitAnswer`. |
| `src/hooks/useGame.ts` *(modificar)* | `submitAnswer` acepta la telemetría y la escribe fire-and-forget. |
| `firestore.rules` *(modificar)* | Reglas de la subcolección `telemetria`. |
| `src/components/telemetria/HuellaSparkline.tsx` *(nuevo)* | Un SVG chico y tonto: recibe puntos, dibuja. |
| `src/components/telemetria/RejillaHuellas.tsx` *(nuevo)* | Tabla alumno × ronda de sparklines. |
| `src/components/telemetria/NubeEscritura.tsx` *(nuevo)* | Scatter agregado, sin nombres. |
| `src/components/telemetria/DetalleRespuesta.tsx` *(nuevo)* | Cajón de hechos de una respuesta. |
| `src/components/telemetria/SeccionTelemetria.tsx` *(nuevo)* | Carga los datos y compone las tres piezas. Es lo único que importa `ClassReport`. |
| `src/pages/professor/ClassReport.tsx` *(modificar)* | Una línea: renderiza la sección. |

---

### Task 1: Tipos compartidos y formato de tiempo

**Files:**
- Create: `src/lib/telemetriaDerived.ts`
- Test: `src/lib/telemetriaDerived.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `src/lib/telemetriaDerived.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatoReloj, proporcionPegada } from './telemetriaDerived';

describe('formatoReloj', () => {
  it('bajo el minuto muestra solo segundos', () => {
    expect(formatoReloj(0)).toBe('0 s');
    expect(formatoReloj(41_000)).toBe('41 s');
    expect(formatoReloj(59_999)).toBe('59 s');
  });

  it('sobre el minuto muestra minutos y segundos', () => {
    expect(formatoReloj(138_000)).toBe('2 min 18 s');
  });

  it('omite los segundos cuando son cero', () => {
    expect(formatoReloj(180_000)).toBe('3 min');
  });
});

describe('proporcionPegada', () => {
  it('es 0 cuando no hubo ningun pegado', () => {
    expect(proporcionPegada({ charsPegados: 0, largoFinal: 400 })).toBe(0);
  });

  it('es la fraccion del texto final que llego pegada', () => {
    expect(proporcionPegada({ charsPegados: 200, largoFinal: 400 })).toBe(0.5);
  });

  it('no pasa de 1 aunque hayan pegado y despues borrado', () => {
    expect(proporcionPegada({ charsPegados: 900, largoFinal: 400 })).toBe(1);
  });

  it('es 0 con respuesta vacia, sin dividir por cero', () => {
    expect(proporcionPegada({ charsPegados: 0, largoFinal: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/telemetriaDerived.test.ts`
Expected: FAIL — `Failed to resolve import "./telemetriaDerived"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crea `src/lib/telemetriaDerived.ts`:

```ts
/**
 * Telemetria de escritura de las rondas abiertas: tipos compartidos y las
 * funciones puras que el panel del profesor usa para dibujarla.
 *
 * REGLA QUE MANDA SOBRE ESTE ARCHIVO: nada de aca entra en un puntaje, en el
 * ranking ni en la recalibracion por duelos. Es registro descriptivo. Si
 * alguna vez una de estas funciones aparece importada desde el calculo de
 * puntajes, eso es el bug.
 *
 * Ver docs/superpowers/specs/2026-08-08-telemetria-antitrampa-design.md
 */

export interface PegadoEvento {
  /** ms desde que se le abrio la ronda a ese alumno */
  ms: number;
  /** cuantos caracteres traia el portapapeles */
  chars: number;
}

/** Lo que el navegador del alumno junta durante una ronda abierta. */
export interface TelemetriaCaptura {
  scenarioId: string;
  msPrimeraTecla: number | null;
  msEnvio: number;
  /** (momento del montaje) - game.roundStartTime. Negativo si monto antes. */
  roundStartOffsetMs: number;
  pegados: PegadoEvento[];
  /** huella[i] = largo del texto a los (i+1) * huellaIntervaloMs ms */
  huella: number[];
  huellaIntervaloMs: number;
  msFueraDeApp: number;
  salidas: number;
  msFueraAntesDeEscribir: number;
  largoFinal: number;
  charsPegados: number;
  charsEditadosTrasUltimoPegado: number;
}

/** El documento tal como queda en Firestore. */
export interface TelemetriaDoc extends TelemetriaCaptura {
  playerId: string;
  round: number;
  version: number;
}

/** "2 min 18 s", "41 s", "3 min". */
export function formatoReloj(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  if (min === 0) return `${seg} s`;
  if (seg === 0) return `${min} min`;
  return `${min} min ${seg} s`;
}

/**
 * Que fraccion del texto final llego pegada, entre 0 y 1. Se topa en 1 porque
 * alguien puede pegar 900 caracteres y dejar 400: la proporcion no significa
 * nada sobre 1, y un punto fuera del grafico si molesta.
 */
export function proporcionPegada(t: { charsPegados: number; largoFinal: number }): number {
  if (t.largoFinal <= 0) return 0;
  return Math.min(1, t.charsPegados / t.largoFinal);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/telemetriaDerived.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telemetriaDerived.ts src/lib/telemetriaDerived.test.ts
git commit -m "feat(telemetria): tipos y formato de la telemetria de escritura"
```

---

### Task 2: Geometría de la sparkline

**Files:**
- Modify: `src/lib/telemetriaDerived.ts`
- Test: `src/lib/telemetriaDerived.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agrega al final de `src/lib/telemetriaDerived.test.ts`:

```ts
import { posicionNube, puntosHuella } from './telemetriaDerived';

const base = {
  huella: [] as number[],
  huellaIntervaloMs: 2000,
  msEnvio: 10_000,
  largoFinal: 0,
};

/** "12.0,3.5 20.0,1.0" -> [[12,3.5],[20,1]] */
const parse = (s: string) =>
  s.split(' ').filter(Boolean).map((p) => p.split(',').map(Number) as [number, number]);

describe('puntosHuella', () => {
  it('arranca en el origen de abajo a la izquierda', () => {
    const pts = parse(puntosHuella({ ...base, huella: [10, 20], largoFinal: 20 }, 10_000, 100, 20));
    expect(pts[0]).toEqual([2, 18]);
  });

  it('normaliza la altura al largo maximo de esa misma respuesta', () => {
    const corta = parse(puntosHuella({ ...base, huella: [50], msEnvio: 2000, largoFinal: 50 }, 10_000, 100, 20));
    const larga = parse(puntosHuella({ ...base, huella: [5000], msEnvio: 2000, largoFinal: 5000 }, 10_000, 100, 20));
    // misma forma: una sola muestra en el tope, en el mismo sitio
    expect(corta).toEqual(larga);
  });

  it('normaliza el ancho a la duracion de la ronda, no al largo de la huella', () => {
    // envio a la mitad de una ronda de 20 s: la linea termina a la mitad
    // del ancho util (2 .. 98), o sea en x = 50
    const pts = parse(puntosHuella({ ...base, huella: [30], msEnvio: 10_000, largoFinal: 30 }, 20_000, 100, 20));
    expect(pts[pts.length - 1][0]).toBe(50);
  });

  it('cierra en el largo final aunque el envio caiga entre dos muestras', () => {
    const pts = parse(puntosHuella({ ...base, huella: [100], msEnvio: 3000, largoFinal: 400 }, 10_000, 100, 20));
    // el ultimo punto es el mas alto: 400 sobre un maximo de 400
    expect(pts[pts.length - 1][1]).toBe(2);
  });

  it('devuelve el segmento plano cuando el alumno no escribio nada', () => {
    const pts = parse(puntosHuella({ ...base, huella: [0, 0], msEnvio: 6000, largoFinal: 0 }, 10_000, 100, 20));
    expect(pts.every(([, y]) => y === 18)).toBe(true);
  });

  it('no se sale del lienzo si la huella dura mas que la ronda', () => {
    const pts = parse(puntosHuella({ ...base, huella: [10, 20, 30], msEnvio: 30_000, largoFinal: 30 }, 4000, 100, 20));
    expect(Math.max(...pts.map(([x]) => x))).toBe(98);
  });
});

describe('posicionNube', () => {
  it('el que escribio al tiro y no pego cae abajo a la izquierda', () => {
    const p = posicionNube({ msPrimeraTecla: 0, charsPegados: 0, largoFinal: 500 }, 240_000, 100, 100);
    expect(p).toEqual({ x: 2, y: 98 });
  });

  it('el que tardo la ronda entera y pego todo cae arriba a la derecha', () => {
    const p = posicionNube({ msPrimeraTecla: 240_000, charsPegados: 500, largoFinal: 500 }, 240_000, 100, 100);
    expect(p).toEqual({ x: 98, y: 2 });
  });

  it('ubica al final del eje a quien nunca escribio nada', () => {
    const p = posicionNube({ msPrimeraTecla: null, charsPegados: 0, largoFinal: 0 }, 240_000, 100, 100);
    expect(p.x).toBe(98);
    expect(p.y).toBe(98);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/telemetriaDerived.test.ts`
Expected: FAIL — `puntosHuella is not a function`.

- [ ] **Step 3: Escribir la implementación**

Agrega al final de `src/lib/telemetriaDerived.ts`:

```ts
/** Margen interno del sparkline, para que el trazo no se coma el borde. */
const PADDING = 2;

/**
 * Los puntos de la polilinea de una respuesta, listos para el atributo
 * `points` de un <polyline>.
 *
 * Dos normalizaciones, y las dos importan:
 *
 * - La ALTURA se normaliza al largo maximo de esa misma respuesta. Se compara
 *   la forma, no el tamano: una respuesta de 200 caracteres bien escrita y una
 *   de 2000 bien escrita tienen que verse igual, porque la conducta es la
 *   misma.
 * - El ANCHO se normaliza a la duracion de la RONDA, no al largo de la huella.
 *   Quien envio al minuto 2 de 5 muestra una linea que se corta a la mitad, y
 *   eso es informacion: se fue temprano.
 */
export function puntosHuella(
  t: Pick<TelemetriaCaptura, 'huella' | 'huellaIntervaloMs' | 'msEnvio' | 'largoFinal'>,
  duracionMs: number,
  ancho: number,
  alto: number
): string {
  const muestras = [
    { ms: 0, largo: 0 },
    ...t.huella.map((largo, i) => ({ ms: (i + 1) * t.huellaIntervaloMs, largo })),
    { ms: t.msEnvio, largo: t.largoFinal },
  ];

  const maxLargo = Math.max(1, ...muestras.map((m) => m.largo));
  const span = Math.max(1, duracionMs);
  const x0 = PADDING;
  const x1 = ancho - PADDING;
  const yBase = alto - PADDING;
  const yTope = PADDING;

  return muestras
    .map((m) => {
      const x = x0 + Math.min(1, m.ms / span) * (x1 - x0);
      const y = yBase - (m.largo / maxLargo) * (yBase - yTope);
      return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
    })
    .join(' ');
}

/**
 * Donde cae una respuesta en la nube del curso. x = cuanto tardo en escribir la
 * primera letra, y = que proporcion del texto llego pegada.
 *
 * Quien nunca escribio nada se ubica al final del eje: no tuvo primera tecla.
 */
export function posicionNube(
  t: { msPrimeraTecla: number | null; charsPegados: number; largoFinal: number },
  duracionMs: number,
  ancho: number,
  alto: number
): { x: number; y: number } {
  const span = Math.max(1, duracionMs);
  const fx = t.msPrimeraTecla === null ? 1 : Math.min(1, t.msPrimeraTecla / span);
  const fy = proporcionPegada(t);
  return {
    x: PADDING + fx * (ancho - 2 * PADDING),
    y: (alto - PADDING) - fy * (alto - 2 * PADDING),
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/telemetriaDerived.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telemetriaDerived.ts src/lib/telemetriaDerived.test.ts
git commit -m "feat(telemetria): geometria de la huella y de la nube"
```

---

### Task 3: Los hechos del cajón de detalle

**Files:**
- Modify: `src/lib/telemetriaDerived.ts`
- Test: `src/lib/telemetriaDerived.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agrega al final de `src/lib/telemetriaDerived.test.ts`:

```ts
import { hechosDetalle } from './telemetriaDerived';

const captura = {
  scenarioId: 'r3',
  msPrimeraTecla: 138_000,
  msEnvio: 151_000,
  roundStartOffsetMs: 0,
  pegados: [{ ms: 138_000, chars: 782 }],
  huella: [0, 0, 0],
  huellaIntervaloMs: 2000,
  msFueraDeApp: 41_000,
  salidas: 1,
  msFueraAntesDeEscribir: 41_000,
  largoFinal: 782,
  charsPegados: 782,
  charsEditadosTrasUltimoPegado: 0,
};

describe('hechosDetalle', () => {
  it('describe la respuesta como hechos, sin ningun juicio', () => {
    const hechos = hechosDetalle(captura, 240_000);
    expect(hechos).toEqual([
      { etiqueta: 'Primera tecla', valor: 'a los 2 min 18 s de los 4 min de ronda' },
      { etiqueta: 'Fuera de la app', valor: '41 s antes de escribir (1 salida)' },
      { etiqueta: 'Pegados', valor: '1 · de 782 caracteres · a los 2 min 18 s' },
      { etiqueta: 'Editó después de pegar', valor: '0 caracteres' },
      { etiqueta: 'Largo final', valor: '782 caracteres' },
      { etiqueta: 'Envió', valor: 'a los 2 min 31 s' },
    ]);
  });

  it('dice que nunca escribio cuando no hubo primera tecla', () => {
    const hechos = hechosDetalle({ ...captura, msPrimeraTecla: null }, 240_000);
    expect(hechos[0]).toEqual({ etiqueta: 'Primera tecla', valor: 'nunca escribió' });
  });

  it('omite la linea de pegados cuando no hubo ninguno', () => {
    const hechos = hechosDetalle(
      { ...captura, pegados: [], charsPegados: 0, charsEditadosTrasUltimoPegado: 0 },
      240_000
    );
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Pegados');
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Editó después de pegar');
  });

  it('omite la linea de salidas cuando nunca salio de la app', () => {
    const hechos = hechosDetalle({ ...captura, msFueraDeApp: 0, salidas: 0, msFueraAntesDeEscribir: 0 }, 240_000);
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Fuera de la app');
  });

  it('lista varios pegados con sus tiempos', () => {
    const hechos = hechosDetalle(
      { ...captura, pegados: [{ ms: 20_000, chars: 300 }, { ms: 60_000, chars: 482 }] },
      240_000
    );
    expect(hechos.find((h) => h.etiqueta === 'Pegados')?.valor).toBe(
      '2 · de 300 y 482 caracteres · a los 20 s y 1 min'
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/telemetriaDerived.test.ts`
Expected: FAIL — `hechosDetalle is not a function`.

- [ ] **Step 3: Escribir la implementación**

Agrega al final de `src/lib/telemetriaDerived.ts`:

```ts
export interface HechoDetalle {
  etiqueta: string;
  valor: string;
}

/** "300 y 482", "20 s, 1 min y 2 min 10 s" */
function lista(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/**
 * Los hechos de una respuesta, para el cajon de detalle.
 *
 * Devuelve HECHOS, no conclusiones: cuando paso cada cosa y de que tamano fue.
 * En ningun caso emite una etiqueta sobre la persona. Las lineas que no
 * aplican se omiten en vez de mostrarse en cero, para que lo que quede en
 * pantalla sea lo que efectivamente ocurrio.
 */
export function hechosDetalle(t: TelemetriaCaptura, duracionMs: number): HechoDetalle[] {
  const hechos: HechoDetalle[] = [];

  hechos.push({
    etiqueta: 'Primera tecla',
    valor:
      t.msPrimeraTecla === null
        ? 'nunca escribió'
        : `a los ${formatoReloj(t.msPrimeraTecla)} de los ${formatoReloj(duracionMs)} de ronda`,
  });

  if (t.salidas > 0) {
    const cuantas = `${t.salidas} ${t.salidas === 1 ? 'salida' : 'salidas'}`;
    hechos.push({
      etiqueta: 'Fuera de la app',
      valor: t.msFueraAntesDeEscribir > 0
        ? `${formatoReloj(t.msFueraAntesDeEscribir)} antes de escribir (${cuantas})`
        : `${formatoReloj(t.msFueraDeApp)} en total (${cuantas})`,
    });
  }

  if (t.pegados.length > 0) {
    hechos.push({
      etiqueta: 'Pegados',
      valor: `${t.pegados.length} · de ${lista(t.pegados.map((p) => String(p.chars)))} caracteres · a los ${lista(t.pegados.map((p) => formatoReloj(p.ms)))}`,
    });
    hechos.push({
      etiqueta: 'Editó después de pegar',
      valor: `${t.charsEditadosTrasUltimoPegado} caracteres`,
    });
  }

  hechos.push({ etiqueta: 'Largo final', valor: `${t.largoFinal} caracteres` });
  hechos.push({ etiqueta: 'Envió', valor: `a los ${formatoReloj(t.msEnvio)}` });

  return hechos;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/telemetriaDerived.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telemetriaDerived.ts src/lib/telemetriaDerived.test.ts
git commit -m "feat(telemetria): los hechos del cajon de detalle, sin juicios"
```

---

### Task 4: La contabilidad — `RegistroEscritura`

**Files:**
- Create: `src/lib/registroEscritura.ts`
- Test: `src/lib/registroEscritura.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `src/lib/registroEscritura.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RegistroEscritura } from './registroEscritura';

/** Reloj falso: avanza cuando uno lo dice. */
function relojFalso(inicio = 1_000_000) {
  let t = inicio;
  return {
    ahora: () => t,
    avanzar: (ms: number) => { t += ms; },
    inicio,
  };
}

function nuevoRegistro() {
  const reloj = relojFalso();
  const registro = new RegistroEscritura({
    ahora: reloj.ahora,
    scenarioId: 'r3',
    roundStartMs: reloj.inicio,
  });
  return { reloj, registro };
}

describe('RegistroEscritura', () => {
  it('marca la primera tecla cuando aparece el primer caracter', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(5000);
    registro.cambio('H');
    expect(registro.cerrar().msPrimeraTecla).toBe(5000);
  });

  it('no marca primera tecla si el texto sigue vacio', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(5000);
    registro.cambio('');
    expect(registro.cerrar().msPrimeraTecla).toBeNull();
  });

  it('la primera tecla no se mueve con las teclas siguientes', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(5000);
    registro.cambio('H');
    reloj.avanzar(9000);
    registro.cambio('Hola');
    expect(registro.cerrar().msPrimeraTecla).toBe(5000);
  });

  it('la huella guarda un largo por muestra, en orden', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.cambio('abc');
    registro.muestra();
    reloj.avanzar(2000);
    registro.cambio('abcdef');
    registro.muestra();
    expect(registro.cerrar().huella).toEqual([3, 6]);
  });

  it('registra el pegado con el tamano del portapapeles', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(30_000);
    registro.pegado(782);
    registro.cambio('x'.repeat(782));
    const cerrado = registro.cerrar();
    expect(cerrado.pegados).toEqual([{ ms: 30_000, chars: 782 }]);
    expect(cerrado.charsPegados).toBe(782);
  });

  it('el cambio que trae el pegado NO cuenta como edicion posterior', () => {
    const { registro } = nuevoRegistro();
    registro.pegado(500);
    registro.cambio('x'.repeat(500));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(0);
  });

  it('cuenta lo que se edito despues de pegar', () => {
    const { registro } = nuevoRegistro();
    registro.pegado(500);
    registro.cambio('x'.repeat(500));
    registro.cambio('x'.repeat(520));
    registro.cambio('x'.repeat(510));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(30);
  });

  it('la edicion posterior se cuenta desde el ULTIMO pegado', () => {
    const { registro } = nuevoRegistro();
    registro.pegado(100);
    registro.cambio('x'.repeat(100));
    registro.cambio('x'.repeat(180));
    registro.pegado(20);
    registro.cambio('x'.repeat(200));
    registro.cambio('x'.repeat(205));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(5);
  });

  it('lo tecleado antes de cualquier pegado no cuenta como edicion posterior', () => {
    const { registro } = nuevoRegistro();
    registro.cambio('x'.repeat(300));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(0);
  });

  it('suma el tiempo fuera de la app y cuenta las salidas', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.seOculto();
    reloj.avanzar(41_000);
    registro.seMostro();
    reloj.avanzar(1000);
    registro.seOculto();
    reloj.avanzar(9000);
    registro.seMostro();
    const cerrado = registro.cerrar();
    expect(cerrado.msFueraDeApp).toBe(50_000);
    expect(cerrado.salidas).toBe(2);
  });

  it('separa el tiempo fuera ANTES de escribir del de despues', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.seOculto();
    reloj.avanzar(41_000);
    registro.seMostro();
    registro.cambio('ya escribi');
    registro.seOculto();
    reloj.avanzar(9000);
    registro.seMostro();
    const cerrado = registro.cerrar();
    expect(cerrado.msFueraAntesDeEscribir).toBe(41_000);
    expect(cerrado.msFueraDeApp).toBe(50_000);
  });

  it('cierra una salida que seguia abierta al enviar', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.cambio('algo');
    registro.seOculto();
    reloj.avanzar(7000);
    expect(registro.cerrar().msFueraDeApp).toBe(7000);
  });

  it('guarda el desfase respecto del inicio de la ronda del curso', () => {
    const reloj = relojFalso();
    const registro = new RegistroEscritura({
      ahora: reloj.ahora,
      scenarioId: 'r3',
      roundStartMs: reloj.inicio - 12_000,
    });
    expect(registro.cerrar().roundStartOffsetMs).toBe(12_000);
  });

  it('deja el desfase en 0 cuando no se sabe cuando empezo la ronda', () => {
    const reloj = relojFalso();
    const registro = new RegistroEscritura({ ahora: reloj.ahora, scenarioId: 'r3', roundStartMs: null });
    expect(registro.cerrar().roundStartOffsetMs).toBe(0);
  });

  it('topa la huella y los pegados para no escribir un documento gigante', () => {
    const { registro } = nuevoRegistro();
    for (let i = 0; i < 900; i++) registro.muestra();
    for (let i = 0; i < 90; i++) registro.pegado(1);
    const cerrado = registro.cerrar();
    expect(cerrado.huella).toHaveLength(600);
    expect(cerrado.pegados).toHaveLength(40);
    // los pegados que no caben igual suman al total
    expect(cerrado.charsPegados).toBe(90);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/registroEscritura.test.ts`
Expected: FAIL — `Failed to resolve import "./registroEscritura"`.

- [ ] **Step 3: Escribir la implementación**

Crea `src/lib/registroEscritura.ts`:

```ts
import type { PegadoEvento, TelemetriaCaptura } from './telemetriaDerived';

export const HUELLA_INTERVALO_MS = 2000;
/** 600 muestras a 2 s son 20 min de ronda. Mas alla deja de crecer. */
const MAX_MUESTRAS = 600;
/** Un documento con 40 pegados ya conto la historia. */
const MAX_PEGADOS = 40;

interface Opciones {
  ahora: () => number;
  scenarioId: string;
  /** `game.roundStartTime` en ms, o null si todavia no se sabe. */
  roundStartMs: number | null;
}

/**
 * Lleva la cuenta de COMO se escribio una respuesta abierta: cuando aparecio la
 * primera letra, que se pego, cuanto se edito despues y cuanto rato estuvo el
 * alumno fuera de la app.
 *
 * Es una clase pura con el reloj inyectado a proposito: toda la logica que se
 * puede equivocar vive aca y se prueba sin React y sin navegador. El hook que
 * la usa (`useTypingTelemetry`) no tiene ninguna decision propia.
 *
 * NO decide nada sobre la persona. No hay umbrales, no hay banderas, no hay un
 * campo "sospechoso". Devuelve lo que paso.
 *
 * Ver docs/superpowers/specs/2026-08-08-telemetria-antitrampa-design.md
 */
export class RegistroEscritura {
  private readonly ahora: () => number;
  private readonly scenarioId: string;
  private readonly inicio: number;
  private readonly roundStartOffset: number;

  private largo = 0;
  private msPrimeraTecla: number | null = null;
  private pegados: PegadoEvento[] = [];
  private charsPegados = 0;
  private huella: number[] = [];
  private msFueraDeApp = 0;
  private salidas = 0;
  private msFueraAntesDeEscribir = 0;
  private ocultoDesde: number | null = null;
  private huboPegado = false;
  private editadosTrasPegado = 0;
  /**
   * El evento `paste` corre ANTES de que el textarea actualice su value, asi
   * que el `cambio` que viene justo despues es el pegado mismo. Sin esta
   * bandera, cada pegado se contaria ademas como edicion posterior de su propio
   * tamano, que es exactamente al reves de lo que el campo quiere decir.
   */
  private saltarProximoCambio = false;

  constructor(opciones: Opciones) {
    this.ahora = opciones.ahora;
    this.scenarioId = opciones.scenarioId;
    this.inicio = opciones.ahora();
    this.roundStartOffset = opciones.roundStartMs === null ? 0 : this.inicio - opciones.roundStartMs;
  }

  private transcurrido(): number {
    return this.ahora() - this.inicio;
  }

  /** Cada `onChange` del textarea. */
  cambio(valor: string): void {
    const nuevo = valor.length;
    const delta = Math.abs(nuevo - this.largo);

    if (this.msPrimeraTecla === null && nuevo > 0) {
      this.msPrimeraTecla = this.transcurrido();
    }

    if (this.saltarProximoCambio) {
      this.saltarProximoCambio = false;
    } else if (this.huboPegado) {
      this.editadosTrasPegado += delta;
    }

    this.largo = nuevo;
  }

  /** Cada evento `paste`, con el largo real del portapapeles. */
  pegado(chars: number): void {
    if (this.pegados.length < MAX_PEGADOS) {
      this.pegados.push({ ms: this.transcurrido(), chars });
    }
    this.charsPegados += chars;
    this.huboPegado = true;
    // La edicion posterior se cuenta desde el ULTIMO pegado.
    this.editadosTrasPegado = 0;
    this.saltarProximoCambio = true;
  }

  /** Un tic del muestreo periodico. */
  muestra(): void {
    if (this.huella.length < MAX_MUESTRAS) this.huella.push(this.largo);
  }

  seOculto(): void {
    if (this.ocultoDesde !== null) return;
    this.ocultoDesde = this.ahora();
    this.salidas += 1;
  }

  seMostro(): void {
    if (this.ocultoDesde === null) return;
    const fuera = this.ahora() - this.ocultoDesde;
    this.msFueraDeApp += fuera;
    if (this.msPrimeraTecla === null) this.msFueraAntesDeEscribir += fuera;
    this.ocultoDesde = null;
  }

  /** La foto que se escribe en Firestore. Se puede llamar mas de una vez. */
  cerrar(): TelemetriaCaptura {
    // Enviar con la pestana oculta no deberia pasar, pero si pasa el rato de
    // afuera no se puede perder: se cierra la salida en curso.
    this.seMostro();

    return {
      scenarioId: this.scenarioId,
      msPrimeraTecla: this.msPrimeraTecla,
      msEnvio: this.transcurrido(),
      roundStartOffsetMs: this.roundStartOffset,
      pegados: this.pegados.slice(),
      huella: this.huella.slice(),
      huellaIntervaloMs: HUELLA_INTERVALO_MS,
      msFueraDeApp: this.msFueraDeApp,
      salidas: this.salidas,
      msFueraAntesDeEscribir: this.msFueraAntesDeEscribir,
      largoFinal: this.largo,
      charsPegados: this.charsPegados,
      charsEditadosTrasUltimoPegado: this.editadosTrasPegado,
    };
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/registroEscritura.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/registroEscritura.ts src/lib/registroEscritura.test.ts
git commit -m "feat(telemetria): la contabilidad de como se escribio una respuesta"
```

---

### Task 5: El hook de cableado

**Files:**
- Create: `src/hooks/useTypingTelemetry.ts`

No lleva test automático: es cableado con el DOM y el reloj real. Se verifica jugando, en la
Task 8.

- [ ] **Step 1: Escribir el hook**

Crea `src/hooks/useTypingTelemetry.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ClipboardEvent } from 'react';
import { HUELLA_INTERVALO_MS, RegistroEscritura } from '../lib/registroEscritura';
import type { TelemetriaCaptura } from '../lib/telemetriaDerived';

interface Opciones {
  /** false en rondas de seleccion multiple y para el profesor que dirige sin jugar. */
  enabled: boolean;
  round: number;
  scenarioId: string;
  /** `game.roundStartTime` en ms, o null si todavia no llego. */
  roundStartMs: number | null;
}

/**
 * Le conecta al textarea de la respuesta abierta la contabilidad de
 * `RegistroEscritura`: el muestreo periodico, el evento de pegado y las salidas
 * de la app.
 *
 * Todo el estado vive en un `useRef` y no en `useState`, por dos razones que ya
 * nos costaron caro: el callback del `setInterval` captura el estado viejo de
 * React y muestrearia siempre el mismo largo; y un estado que dispara
 * re-render en cada tecla haria re-renderizar la ronda entera mientras el
 * alumno escribe.
 *
 * Este hook NO tiene logica propia. Si aparece un `if` que decide algo sobre la
 * respuesta, va en `RegistroEscritura`, que si tiene tests.
 */
export function useTypingTelemetry({ enabled, round, scenarioId, roundStartMs }: Opciones) {
  const registro = useRef<RegistroEscritura | null>(null);

  useEffect(() => {
    if (!enabled) {
      registro.current = null;
      return;
    }

    registro.current = new RegistroEscritura({
      ahora: () => Date.now(),
      scenarioId,
      roundStartMs,
    });

    const tic = setInterval(() => registro.current?.muestra(), HUELLA_INTERVALO_MS);
    const onVisibilidad = () => {
      if (document.hidden) registro.current?.seOculto();
      else registro.current?.seMostro();
    };
    document.addEventListener('visibilitychange', onVisibilidad);

    return () => {
      clearInterval(tic);
      document.removeEventListener('visibilitychange', onVisibilidad);
    };
    // `roundStartMs` a proposito fuera: llega despues del montaje y reiniciaria
    // el registro a mitad de la ronda, borrando lo que el alumno ya escribio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, round, scenarioId]);

  const noteChange = useCallback((valor: string) => {
    registro.current?.cambio(valor);
  }, []);

  const onPaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    // El largo se toma del portapapeles y no del delta del textarea: si habia
    // texto seleccionado, el delta seria el saldo neto y no lo que entro.
    registro.current?.pegado(e.clipboardData.getData('text').length);
  }, []);

  const snapshot = useCallback((): TelemetriaCaptura | null => {
    return registro.current?.cerrar() ?? null;
  }, []);

  // El objeto se memoiza porque `handleSubmit` lo lleva en sus dependencias, y
  // el efecto de auto-envio por tiempo agotado depende de `handleSubmit`. Un
  // objeto nuevo en cada render volveria a montar ese efecto en cada tecla que
  // escribe el alumno.
  return useMemo(() => ({ noteChange, onPaste, snapshot }), [noteChange, onPaste, snapshot]);
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc -b --noEmit 2>&1 | head -20`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTypingTelemetry.ts
git commit -m "feat(telemetria): hook que conecta el registro al textarea"
```

---

### Task 6: Escribir la telemetría al enviar

**Files:**
- Modify: `src/hooks/useGame.ts:202-224` (`submitAnswer`)
- Modify: `src/pages/student/Round.tsx` (línea ~41 imports, ~354 `handleSubmit`, ~1067 textarea)

- [ ] **Step 1: Cambiar `submitAnswer` en `src/hooks/useGame.ts`**

En el bloque de imports de Firestore de ese archivo asegúrate de que estén `doc` y `setDoc`
(ya se importa `doc`; agrega `setDoc` si falta).

Reemplaza la firma y el cuerpo de `submitAnswer`:

```ts
  const submitAnswer = useCallback(async (
    response: string,
    telemetria?: TelemetriaCaptura | null,
  ) => {
    if (!gameCode || !user || !game) return;

    const submissionsRef = collection(db, 'games', gameCode, 'submissions');

    const submission: Omit<Submission, 'id'> = {
      gameCode,
      playerId: user.uid,
      playerName: currentPlayer?.name || user.displayName || 'Anonimo',
      round: game.currentRound,
      response,
      submittedAt: Timestamp.now(),
      evaluated: false,
    };

    const docRef = await addDoc(submissionsRef, submission);

    // Como se escribio la respuesta. Registro descriptivo del anfitrion: NO
    // puntua, NO penaliza y no se le muestra a ningun alumno.
    //
    // Va DESPUES del addDoc y con catch propio a proposito: si la regla lo
    // rechaza, si se cae la red o si el documento ya existia, el alumno ya
    // mando su respuesta y no se tiene que enterar de nada. La telemetria
    // jamas puede romper ni retrasar el envio.
    if (telemetria) {
      const telemetriaRef = doc(
        db, 'games', gameCode, 'telemetria', `${user.uid}_${game.currentRound}`,
      );
      setDoc(telemetriaRef, {
        ...telemetria,
        playerId: user.uid,
        round: game.currentRound,
        version: 1,
      }).catch((err) => console.warn('telemetria no guardada', err));
    }

    // Fire-and-forget: evaluate immediately, don't block the UI
    const evaluate = httpsCallable(functions, 'evaluateSubmission');
    evaluate({ gameCode, round: game.currentRound, submissionId: docRef.id }).catch(err => {
      console.error('Background evaluation error:', err);
    });
  }, [gameCode, user, game, currentPlayer]);
```

Agrega arriba, con los demás imports de tipos:

```ts
import type { TelemetriaCaptura } from '../lib/telemetriaDerived';
```

- [ ] **Step 2: Enchufar el hook en `src/pages/student/Round.tsx`**

Agrega el import junto a los otros hooks:

```ts
import { useTypingTelemetry } from '../../hooks/useTypingTelemetry';
```

Después de la línea 200 (donde ya existen `currentScenarioRef` e `isMC`), agrega:

```ts
  // Como se escribe la respuesta abierta. Apagado en las rondas de seleccion
  // multiple (no hay textarea) y para el profesor que dirige sin jugar.
  const telemetria = useTypingTelemetry({
    enabled: !isMC && !isSpectator,
    round: game?.currentRound ?? 0,
    scenarioId: currentScenarioRef.current?.id ?? '',
    roundStartMs: game?.roundStartTime?.toMillis() ?? null,
  });
```

En `handleSubmit` (línea ~360), cambia la llamada:

```ts
      await submitAnswer(response.trim(), telemetria.snapshot());
```

y agrega `telemetria` al arreglo de dependencias del `useCallback`:

```ts
  }, [response, isSubmitting, submitAnswer, telemetria]);
```

En el textarea (línea ~1067):

```tsx
                  <textarea
                    value={response}
                    onChange={(e) => {
                      setResponse(e.target.value);
                      telemetria.noteChange(e.target.value);
                    }}
                    onPaste={telemetria.onPaste}
                    placeholder="Escribe tu respuesta aqui..."
                    rows={8}
                    className="input-field resize-none mb-4"
                    disabled={isSubmitting}
                  />
```

- [ ] **Step 3: Verificar que compila y que no se rompió nada**

Run: `npx tsc -b --noEmit && npm run lint && npx vitest run`
Expected: sin errores de tipos, sin errores de lint, todos los tests en verde.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGame.ts src/pages/student/Round.tsx
git commit -m "feat(telemetria): guardar como se escribio cada respuesta abierta"
```

---

### Task 7: Reglas de Firestore

**Files:**
- Modify: `firestore.rules` (dentro de `match /games/{gameCode}`, después del bloque `feedback`)

- [ ] **Step 1: Agregar la regla**

Pega este bloque justo después del `match /feedback/{playerId} { ... }`:

```
      // Como se escribio cada respuesta abierta: tiempo a la primera tecla,
      // pegados, salidas de la app y la huella del texto.
      //
      // Registro privado del anfitrion. NO puntua, NO penaliza y NO se le
      // muestra a ningun alumno — ni siquiera la suya: leerla ensena
      // exactamente que hay que enganar.
      //
      // El id del doc es {uid}_{ronda}, y eso hace el trabajo pesado: un alumno
      // no puede escribir el registro de otro sin que el id lo delate, y no
      // puede reescribir el suyo (crear falla si ya existe, y update esta
      // cerrado). Lo que NINGUNA regla puede impedir es que mande numeros
      // inventados: los produce su propio navegador. Esto mide a la mayoria
      // honesta, no atrapa a quien se lo propone.
      //
      // `matches` en vez de armar el id con string(...data.round): el cast de
      // un numero en las reglas devuelve "3.0" si viajo como double, y la
      // comparacion fallaria en silencio. Los uid de Firebase son
      // alfanumericos, asi que no hay nada que escapar en la expresion.
      match /telemetria/{telemetriaId} {
        allow read: if isAuthenticated() &&
                    get(/databases/$(database)/documents/games/$(gameCode)).data.hostId == request.auth.uid;
        allow create: if isAuthenticated()
                      && request.resource.data.playerId == request.auth.uid
                      && telemetriaId.matches(request.auth.uid + '_[0-9]+');
        allow update, delete: if false;
      }
```

- [ ] **Step 2: Desplegar las reglas**

Las reglas sí se despliegan directo desde el directorio del proyecto — es sólo el deploy de
`functions` el que falla desde `/mnt/c/`.

Run: `npx firebase deploy --only firestore:rules`
Expected: `✔  Deploy complete!`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(telemetria): la telemetria la lee solo el anfitrion del juego"
```

---

### Task 8: Punto de verificación — jugar una ronda

Esta feature pasa todos los chequeos automáticos y falla en el teléfono real. **No sigas al
panel sin hacer esto.**

- [ ] **Step 1: Levantar el dev server**

Run: `npm run dev`

Nota: en `/mnt/c` inotify no funciona; si los cambios no se reflejan, el servidor está sirviendo
módulos viejos sin decir nada. Reinícialo.

- [ ] **Step 2: Jugar una ronda abierta contra ti mismo**

Crea un juego con una sesión que tenga al menos una ronda abierta, entra como jugador y en la
misma ronda:

1. escribe un par de palabras a mano;
2. sal de la pestaña unos 20 segundos y vuelve;
3. pega un bloque de texto desde otra aplicación;
4. edítalo un poco;
5. envía.

- [ ] **Step 3: Leer el documento en la consola de Firestore**

Abre `games/{CODIGO}/telemetria/{tuUid}_1` en la consola de Firebase y confirma, uno por uno:

- `msPrimeraTecla` es del orden de lo que tardaste;
- `pegados` tiene un evento con el largo del bloque que pegaste;
- `charsEditadosTrasUltimoPegado` es mayor que 0 y **no** incluye el tamaño del pegado;
- `msFueraDeApp` es del orden de 20 000 y `salidas` es 1;
- `huella` tiene un entero cada 2 segundos y termina cerca de `largoFinal`.

- [ ] **Step 4: Probar el camino del teléfono**

Entra al mismo juego desde el celular con el QR y repite el paso 2, usando el **«Pegar» del
menú de mantener apretado** (no `Ctrl+V`) y cambiando de app de verdad. Confirma que el
documento del teléfono también trae `pegados` y `salidas`.

Este paso es el que importa: es el camino real, y el escritorio no lo prueba.

- [ ] **Step 5: Probar que un fallo de escritura no rompe el envío**

En `firestore.rules`, cambia temporalmente el `allow create` de `telemetria` a `if false` y
despliega. Juega otra ronda: la respuesta **tiene que enviarse igual**, el alumno no debe ver
ningún error, y en la consola del navegador debe aparecer `telemetria no guardada`.

Devuelve la regla a como estaba y vuelve a desplegar.

- [ ] **Step 6: Probar que otro alumno no la puede leer**

Con una segunda cuenta unida al mismo juego, en la consola del navegador:

```js
// deberia fallar con permission-denied
firebase.firestore().collection('games/CODIGO/telemetria').get()
```

Expected: `FirebaseError: Missing or insufficient permissions.`

---

### Task 9: La sparkline

**Files:**
- Create: `src/components/telemetria/HuellaSparkline.tsx`

- [ ] **Step 1: Escribir el componente**

Crea `src/components/telemetria/HuellaSparkline.tsx`:

```tsx
import { puntosHuella } from '../../lib/telemetriaDerived';
import type { TelemetriaCaptura } from '../../lib/telemetriaDerived';

/**
 * Como crecio el texto durante la ronda, en 52x20 px.
 *
 * Una rampa diagonal = fue tecleando. Un acantilado vertical = entro un bloque
 * de golpe. Un acantilado seguido de rampa = pego y despues lo trabajo.
 *
 * Sin color, sin escala de calor, sin etiqueta. La forma se lee sola, y no
 * envejece: si manana cambiamos de opinion sobre que significa cada forma, el
 * dibujo sigue siendo correcto.
 */
export default function HuellaSparkline({
  telemetria,
  duracionMs,
  ancho = 52,
  alto = 20,
}: {
  telemetria: TelemetriaCaptura;
  duracionMs: number;
  ancho?: number;
  alto?: number;
}) {
  return (
    <svg width={ancho} height={alto} className="block text-ink" aria-hidden="true">
      <polyline
        points={`2,${alto - 2} ${ancho - 2},${alto - 2}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1}
      />
      <polyline
        points={puntosHuella(telemetria, duracionMs, ancho, alto)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/telemetria/HuellaSparkline.tsx
git commit -m "feat(telemetria): sparkline de como crecio el texto"
```

---

### Task 10: La rejilla por alumno

**Files:**
- Create: `src/components/telemetria/RejillaHuellas.tsx`

- [ ] **Step 1: Escribir el componente**

Crea `src/components/telemetria/RejillaHuellas.tsx`:

```tsx
import HuellaSparkline from './HuellaSparkline';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';

export interface FilaAlumno {
  playerId: string;
  nombre: string;
  /** por numero de ronda */
  porRonda: Record<number, TelemetriaDoc>;
}

/**
 * Una fila por alumno, una columna por ronda abierta.
 *
 * NINGUNA fila se destaca y ningun nombre cambia de color. Ordenar "por
 * sospecha" o pintar al que mas pego seria clasificar, que es justo lo que este
 * panel no hace. El orden es alfabetico y punto.
 */
export default function RejillaHuellas({
  filas,
  rondas,
  duracionPorRonda,
  onSeleccion,
  seleccionada,
}: {
  filas: FilaAlumno[];
  rondas: number[];
  duracionPorRonda: Record<number, number>;
  onSeleccion: (t: TelemetriaDoc, nombre: string) => void;
  seleccionada: TelemetriaDoc | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted px-2 py-1">
              Alumno
            </th>
            {rondas.map((r) => (
              <th
                key={r}
                className="text-center text-[10px] font-bold uppercase tracking-widest text-muted px-2 py-1"
              >
                R{r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.playerId} className="border-t border-ink/10">
              <td className="px-2 py-1 font-semibold whitespace-nowrap">{fila.nombre}</td>
              {rondas.map((r) => {
                const t = fila.porRonda[r];
                if (!t) {
                  return (
                    <td key={r} className="px-2 py-1 text-center text-muted/50 text-xs">
                      —
                    </td>
                  );
                }
                const activa = seleccionada?.playerId === t.playerId && seleccionada?.round === r;
                return (
                  <td key={r} className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => onSeleccion(t, fila.nombre)}
                      className={`block mx-auto rounded px-0.5 ${activa ? 'ring-2 ring-ink' : 'hover:bg-surface-2'}`}
                      aria-label={`Ver como escribio ${fila.nombre} la ronda ${r}`}
                    >
                      <HuellaSparkline telemetria={t} duracionMs={duracionPorRonda[r] ?? 300_000} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/telemetria/RejillaHuellas.tsx
git commit -m "feat(telemetria): rejilla de huellas por alumno y ronda"
```

---

### Task 11: La nube del curso

**Files:**
- Create: `src/components/telemetria/NubeEscritura.tsx`

- [ ] **Step 1: Escribir el componente**

Crea `src/components/telemetria/NubeEscritura.tsx`:

```tsx
import { formatoReloj, posicionNube } from '../../lib/telemetriaDerived';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';

const ANCHO = 380;
const ALTO = 215;
const MARGEN_IZQ = 42;
const MARGEN_ABAJO = 37;
const MARGEN_ARRIBA = 14;
const MARGEN_DER = 12;

/**
 * Una respuesta por punto: x = cuanto tardo en escribir la primera letra,
 * y = que proporcion del texto llego pegada.
 *
 * Dos decisiones que NO se pueden cambiar sin rediscutir el diseno:
 *
 * 1. TODOS los puntos van del mismo color. Pintar de otro color a los de arriba
 *    a la derecha seria aplicar un umbral, o sea clasificar. La nube deja ver
 *    donde esta la masa; no dibuja la frontera por ti.
 * 2. NO se muestran nombres. El nombre aparece solo al hacer clic, que es un
 *    gesto deliberado de ir a buscarlo.
 */
export default function NubeEscritura({
  puntos,
  duracionMaxMs,
  onSeleccion,
}: {
  puntos: Array<{ telemetria: TelemetriaDoc; nombre: string }>;
  duracionMaxMs: number;
  onSeleccion: (t: TelemetriaDoc, nombre: string) => void;
}) {
  const anchoTrazo = ANCHO - MARGEN_IZQ - MARGEN_DER;
  const altoTrazo = ALTO - MARGEN_ARRIBA - MARGEN_ABAJO;

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full text-ink" role="img"
         aria-label={`Nube de ${puntos.length} respuestas`}>
      {/* ejes */}
      <line x1={MARGEN_IZQ} y1={ALTO - MARGEN_ABAJO} x2={ANCHO - MARGEN_DER} y2={ALTO - MARGEN_ABAJO}
            stroke="currentColor" strokeOpacity={0.3} />
      <line x1={MARGEN_IZQ} y1={MARGEN_ARRIBA} x2={MARGEN_IZQ} y2={ALTO - MARGEN_ABAJO}
            stroke="currentColor" strokeOpacity={0.3} />

      <text x={ANCHO / 2} y={ALTO - 6} textAnchor="middle" fontSize={10}
            fill="currentColor" opacity={0.65}>
        tiempo hasta la primera tecla
      </text>
      <text x={12} y={ALTO / 2} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.65}
            transform={`rotate(-90 12 ${ALTO / 2})`}>
        % pegado
      </text>

      <text x={MARGEN_IZQ} y={ALTO - MARGEN_ABAJO + 12} textAnchor="middle" fontSize={8.5}
            fill="currentColor" opacity={0.45}>0</text>
      <text x={ANCHO - MARGEN_DER} y={ALTO - MARGEN_ABAJO + 12} textAnchor="middle" fontSize={8.5}
            fill="currentColor" opacity={0.45}>{formatoReloj(duracionMaxMs)}</text>
      <text x={MARGEN_IZQ - 6} y={ALTO - MARGEN_ABAJO + 3} textAnchor="end" fontSize={8.5}
            fill="currentColor" opacity={0.45}>0</text>
      <text x={MARGEN_IZQ - 6} y={MARGEN_ARRIBA + 4} textAnchor="end" fontSize={8.5}
            fill="currentColor" opacity={0.45}>100</text>

      {puntos.map(({ telemetria, nombre }) => {
        const { x, y } = posicionNube(telemetria, duracionMaxMs, anchoTrazo, altoTrazo);
        return (
          <circle
            key={`${telemetria.playerId}_${telemetria.round}`}
            cx={MARGEN_IZQ + x}
            cy={MARGEN_ARRIBA + y}
            r={4}
            fill="currentColor"
            fillOpacity={0.45}
            className="cursor-pointer"
            onClick={() => onSeleccion(telemetria, nombre)}
          >
            <title>Ronda {telemetria.round}</title>
          </circle>
        );
      })}
    </svg>
  );
}
```

Nota sobre el `<title>`: dice sólo la ronda, nunca el nombre. El nombre se revela al hacer
clic, en el cajón de detalle.

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/telemetria/NubeEscritura.tsx
git commit -m "feat(telemetria): nube del curso, sin nombres y de un solo color"
```

---

### Task 12: El cajón de detalle

**Files:**
- Create: `src/components/telemetria/DetalleRespuesta.tsx`

- [ ] **Step 1: Escribir el componente**

Crea `src/components/telemetria/DetalleRespuesta.tsx`:

```tsx
import { hechosDetalle, puntosHuella } from '../../lib/telemetriaDerived';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';

/**
 * Los hechos de una respuesta, y la huella en grande.
 *
 * El parrafo del pie NO es decorativo: es la regla del diseno puesta en la
 * pantalla donde se toman las decisiones. No se saca.
 */
export default function DetalleRespuesta({
  telemetria,
  nombre,
  duracionMs,
}: {
  telemetria: TelemetriaDoc;
  nombre: string;
  duracionMs: number;
}) {
  const hechos = hechosDetalle(telemetria, duracionMs);

  return (
    <div className="mt-4 rounded-lg border border-ink/20 bg-surface-2 p-4">
      <h3 className="font-bold text-sm mb-3">
        {nombre} · Ronda {telemetria.round}
      </h3>

      <dl className="space-y-1">
        {hechos.map((hecho) => (
          <div key={hecho.etiqueta} className="flex gap-3 text-xs">
            <dt className="w-44 shrink-0 font-semibold text-muted">{hecho.etiqueta}</dt>
            <dd>{hecho.valor}</dd>
          </div>
        ))}
      </dl>

      <svg viewBox="0 0 320 46" className="w-full mt-3 text-ink" aria-hidden="true">
        <polyline points="4,44 316,44" fill="none" stroke="currentColor" strokeOpacity={0.25} />
        <polyline
          points={puntosHuella(telemetria, duracionMs, 320, 46)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>

      <p className="text-xs text-muted mt-3">
        <strong>Nada de esto dice «copió».</strong> Dice qué pasó. Puede ser un texto redactado
        en el bloc de notas, y esta pantalla no puede saberlo.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/telemetria/DetalleRespuesta.tsx
git commit -m "feat(telemetria): cajon de detalle de una respuesta"
```

---

### Task 13: La sección que carga y compone

**Files:**
- Create: `src/components/telemetria/SeccionTelemetria.tsx`

- [ ] **Step 1: Escribir el componente**

Crea `src/components/telemetria/SeccionTelemetria.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';
import NubeEscritura from './NubeEscritura';
import RejillaHuellas from './RejillaHuellas';
import type { FilaAlumno } from './RejillaHuellas';
import DetalleRespuesta from './DetalleRespuesta';

interface EscenarioMinimo {
  id?: string;
  type?: string;
  durationSeconds?: number;
}

/**
 * «Como se escribio»: la seccion de telemetria del reporte de clase.
 *
 * Lee dos cosas directo de Firestore y no toca `generateClassReport`: la
 * subcoleccion `telemetria` (que solo el anfitrion puede leer) y el documento
 * del juego, del que saca la duracion de cada ronda.
 *
 * Si no hay telemetria — un juego anterior a esta feature, o una sesion entera
 * de seleccion multiple — no renderiza nada. Nada de estados vacios explicando
 * la ausencia: el profesor no tiene por que enterarse de una feature que ese
 * juego no uso.
 */
export default function SeccionTelemetria({
  gameCode,
  jugadores,
}: {
  gameCode: string;
  /** playerId -> nombre, del reporte que ya cargo la pagina */
  jugadores: Record<string, string>;
}) {
  const [docs, setDocs] = useState<TelemetriaDoc[]>([]);
  const [duracionPorRonda, setDuracionPorRonda] = useState<Record<number, number>>({});
  const [seleccion, setSeleccion] = useState<{ t: TelemetriaDoc; nombre: string } | null>(null);

  useEffect(() => {
    let vivo = true;

    const cargar = async () => {
      try {
        const [snap, juego] = await Promise.all([
          getDocs(collection(db, 'games', gameCode, 'telemetria')),
          getDoc(doc(db, 'games', gameCode)),
        ]);
        if (!vivo) return;

        setDocs(snap.docs.map((d) => d.data() as TelemetriaDoc));

        const datos = juego.data();
        const porDefecto = (datos?.roundDurationSeconds ?? 300) * 1000;
        const escenarios: EscenarioMinimo[] = datos?.scenarios ?? [];
        const duraciones: Record<number, number> = {};
        escenarios.forEach((e, i) => {
          duraciones[i + 1] = (e.durationSeconds ?? 0) * 1000 || porDefecto;
        });
        setDuracionPorRonda(duraciones);
      } catch (err) {
        // Un juego sin telemetria, o reglas que niegan: la seccion no se muestra
        // y el resto del reporte sigue funcionando.
        console.warn('telemetria no disponible', err);
      }
    };

    cargar();
    return () => { vivo = false; };
  }, [gameCode]);

  const rondas = useMemo(
    () => [...new Set(docs.map((d) => d.round))].sort((a, b) => a - b),
    [docs]
  );

  const filas: FilaAlumno[] = useMemo(() => {
    const porAlumno = new Map<string, FilaAlumno>();
    docs.forEach((d) => {
      const nombre = jugadores[d.playerId];
      if (!nombre) return; // no jugo o no fue evaluado: no tiene fila en el reporte
      const fila = porAlumno.get(d.playerId) ?? { playerId: d.playerId, nombre, porRonda: {} };
      fila.porRonda[d.round] = d;
      porAlumno.set(d.playerId, fila);
    });
    return [...porAlumno.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [docs, jugadores]);

  const puntos = useMemo(
    () =>
      docs
        .filter((d) => jugadores[d.playerId])
        .map((d) => ({ telemetria: d, nombre: jugadores[d.playerId] })),
    [docs, jugadores]
  );

  const duracionMax = useMemo(
    () => Math.max(60_000, ...rondas.map((r) => duracionPorRonda[r] ?? 0)),
    [rondas, duracionPorRonda]
  );

  if (docs.length === 0 || filas.length === 0) return null;

  return (
    <div className="dramatic-card p-6 mt-6">
      <h2 className="text-lg font-bold mb-1">Cómo se escribió</h2>
      <p className="text-xs text-muted mb-5">
        Registro descriptivo de las {rondas.length} rondas abiertas. No entra en ningún puntaje
        ni en el ranking.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-semibold text-muted mb-2">
            El curso · 1 punto = 1 respuesta · {puntos.length} respuestas
          </p>
          <NubeEscritura
            puntos={puntos}
            duracionMaxMs={duracionMax}
            onSeleccion={(t, nombre) => setSeleccion({ t, nombre })}
          />
          <p className="text-[11px] text-muted mt-1">
            Sin nombres. Haz clic en un punto para saber de quién es.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-muted mb-2">
            Por alumno · rampa = tecleó · acantilado = pegó
          </p>
          <RejillaHuellas
            filas={filas}
            rondas={rondas}
            duracionPorRonda={duracionPorRonda}
            seleccionada={seleccion?.t ?? null}
            onSeleccion={(t, nombre) => setSeleccion({ t, nombre })}
          />
        </div>
      </div>

      {seleccion && (
        <DetalleRespuesta
          telemetria={seleccion.t}
          nombre={seleccion.nombre}
          duracionMs={duracionPorRonda[seleccion.t.round] ?? duracionMax}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/telemetria/SeccionTelemetria.tsx
git commit -m "feat(telemetria): seccion Como se escribio del reporte de clase"
```

---

### Task 14: Enchufar la sección en el reporte de clase

**Files:**
- Modify: `src/pages/professor/ClassReport.tsx` (imports; después del `</div>` que cierra la
  grilla de «Distribución de Puntajes» + «Promedio por Ronda», línea ~413)

- [ ] **Step 1: Agregar el import**

Junto a los otros imports de componentes:

```ts
import SeccionTelemetria from '../../components/telemetria/SeccionTelemetria';
```

- [ ] **Step 2: Renderizar la sección**

Justo después del `</div>` que cierra la grilla de los dos gráficos (línea ~413, antes del
comentario `{/* Top Improvement Areas */}`):

```tsx
        <SeccionTelemetria
          gameCode={report.gameCode}
          jugadores={Object.fromEntries(report.players.map((p) => [p.playerId, p.name]))}
        />
```

- [ ] **Step 3: Verificar que compila y que la suite sigue verde**

Run: `npx tsc -b --noEmit && npm run lint && npx vitest run`
Expected: sin errores de tipos, sin errores de lint, todos los tests en verde.

- [ ] **Step 4: Commit**

```bash
git add src/pages/professor/ClassReport.tsx
git commit -m "feat(telemetria): mostrar Como se escribio en el reporte de clase"
```

---

### Task 15: Verificación final

Sin esto la feature no está terminada.

- [ ] **Step 1: Suite completa**

Run: `npm run build && npx vitest run`
Expected: build sin errores, todos los tests en verde.

- [ ] **Step 2: Abrir el reporte del juego de la Task 8**

Ve a `/professor/report/{CODIGO}` con la cuenta que creó el juego, y confirma:

- aparece la sección «Cómo se escribió»;
- la nube muestra un punto por respuesta abierta, **todos del mismo color**;
- la rejilla muestra una fila por alumno con una sparkline por ronda, **sin ninguna fila
  destacada**;
- al hacer clic en una sparkline se abre el cajón con los hechos de esa respuesta;
- al hacer clic en un punto de la nube se abre el mismo cajón;
- el párrafo «Nada de esto dice "copió"» está en pantalla.

- [ ] **Step 3: Abrir el reporte de un juego viejo**

Ve a `/professor/report/{CODIGO_ANTIGUO}` de cualquier juego anterior a esta feature.
Expected: la sección **no aparece** y el resto del reporte se ve igual que siempre.

- [ ] **Step 4: Revisar el reporte en pantalla angosta**

Con las herramientas de desarrollo en ancho de teléfono, confirma que la rejilla scrollea
horizontalmente dentro de su contenedor y que la página **no** scrollea de lado.

- [ ] **Step 5: Confirmar que nada de esto toca el puntaje**

Run: `grep -rn "telemetria\|Telemetria\|registroEscritura" src/lib/finalScores.ts src/lib/mcScoring.ts src/lib/diagnosticTotals.ts functions/src/`
Expected: **cero resultados.** Si aparece alguno, la regla del diseño se rompió.

- [ ] **Step 6: Commit final y push**

```bash
git add -A
git commit -m "feat(telemetria): verificacion completa de la telemetria de escritura"
git push
```

El push a `main` dispara el deploy del frontend por GitHub Actions. Las reglas de Firestore ya
se desplegaron en la Task 7.

---

## Fuera de alcance, escrito para que nadie lo agregue de paso

- Nada en `CourseRanking.tsx`.
- Nada acumulado entre sesiones (eso necesita una `collectionGroup` y reglas nuevas; se
  diseña cuando haya tres o cuatro sesiones jugadas).
- Ninguna exportación a CSV ni al PDF del reporte.
- Ningún cambio en `functions/`.
- Ningún cambio en `NoCopy.tsx`.
- Ningún aviso al curso: Naim decidió no anunciarlo. Si algún día esto va a tener
  consecuencias para una persona, hay que anunciarlo **antes**, y eso es una decisión suya, no
  un cambio de código.
