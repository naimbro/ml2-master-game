# Doble orden en los duelos de recalibración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un veredicto de duelo sólo cuente si sobrevive a invertir el orden de presentación, para que el ~21% de duelos que hoy decide la posición y no la calidad deje de reordenar alumnos al azar.

**Architecture:** `runSwissComparisons` pasa de una llamada por par a dos en paralelo (los dos órdenes); si los veredictos se contradicen, el par es empate (`winner: -1`), que la infraestructura ya soporta de punta a punta. El reveal aprende a dibujar ese empate, porque hoy lo pinta como dos paneles apagados sin texto. Y las constantes `RECAL_B` / `RECAL_W_ANCHOR`, calibradas cuando no había empates, se re-verifican con el script offline que ya existe.

**Tech Stack:** TypeScript, Firebase Cloud Functions (`functions/`), React + Vite (`src/`), vitest, `tsx` para los scripts de análisis.

**Spec:** `docs/superpowers/specs/2026-07-27-doble-orden-duelos-design.md`

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `functions/src/pairwise.ts` | Modificar: agenda de duelos y traducción de veredictos → `DuelResult`. Se le borra el hash `djb2`. | 1 |
| `functions/src/pairwise.test.ts` | Modificar: tests nuevos para la regla de los dos órdenes. Los 3 existentes no se tocan. | 1 |
| `src/pages/student/RecalibrationReveal.tsx` | Modificar: dibujar el empate (markup + CSS + tiempo en pantalla). | 2 |
| `src/pages/RevealPreview.tsx` | Modificar: datos sintéticos con empates, para poder mirar el resultado sin clase en vivo. | 2 |
| `scripts/bt-calibrate.ts` | Modificar: doble orden en `duelsForRound`, para que el barrido mida el régimen nuevo. | 3 |
| `functions/src/index.ts` | **No se toca.** `RECAL_B` / `RECAL_W_ANCHOR` sólo si la tarea 3 dice que hace falta. | 3 |

`functions/` y `src/` tienen suites de vitest separadas (`cd functions && npm test` vs `npm test` en la raíz).

---

## Task 1: `pairwise.ts` pregunta en los dos órdenes

**Files:**
- Modify: `functions/src/pairwise.ts:15-19` (borrar `djb2`), `:21-25` (comentario), `:38-53` (el worker)
- Test: `functions/src/pairwise.test.ts`

- [ ] **Step 1: Escribir el test que falla**

El test que importa es un comparador con **puro sesgo de posición**: elige siempre a quien se muestra primero, sin mirar el texto. Hoy produce ganadores; con el cambio debe producir puros empates. Eso codifica exactamente la propiedad que estamos comprando.

Agregar al final de `functions/src/pairwise.test.ts`:

```ts
describe('runSwissComparisons: regla de los dos órdenes (LCES ec. 1)', () => {
  it('cuenta empate cuando el veredicto se da vuelta al invertir el orden', async () => {
    // Sesgo de posición puro: gana siempre quien va primero, diga lo que diga el texto.
    const compare = async () => 'A' as const;
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4);
    expect(duels.length).toBe(5);
    expect(duels.every((d) => d.winner === -1)).toBe(true);
  });

  it('cuenta empate cuando el modelo prefiere siempre la segunda respuesta', async () => {
    const compare = async () => 'B' as const;
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4);
    expect(duels.every((d) => d.winner === -1)).toBe(true);
  });

  it('conserva al ganador cuando el veredicto sobrevive al swap', async () => {
    // Depende del contenido, no de la posición: gana la respuesta alfabéticamente menor.
    const compare = async (x: string, y: string) => (x < y ? 'A' : 'B') as 'A' | 'B';
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4);
    // swissPairs emite [mejor-provisional, peor-provisional] = [i, j], y acá el orden
    // provisional (80/76/72/68) coincide con el alfabético ('a'<'b'<'c'<'d'), así que
    // gana siempre i.
    expect(duels.every((d) => d.winner === 0)).toBe(true);
  });

  it('consulta al comparador dos veces por par y dispara onDuel una sola vez', async () => {
    let calls = 0;
    const compare = async (x: string, y: string) => { calls++; return (x < y ? 'A' : 'B') as 'A' | 'B'; };
    const seen: number[] = [];
    const duels = await runSwissComparisons(players, 'ctx', 2, compare, 4, (d) => { seen.push(d.seq); });
    expect(duels.length).toBe(5);
    expect(calls).toBe(10);   // 5 pares × 2 órdenes
    expect(seen.length).toBe(5);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que los nuevos fallan**

```bash
cd functions && npx vitest run src/pairwise.test.ts
```

Esperado: los 3 tests viejos PASAN. De los 4 nuevos fallan al menos 3 — el de `'A'` siempre y el de `'B'` siempre devuelven ganadores en vez de empates, y el de conteo reporta `calls` = 5 en vez de 10. (El de "conserva al ganador" puede pasar ya, porque hoy también gana `i`; se queda igual como red de seguridad.)

- [ ] **Step 3: Borrar el hash y corregir el comentario**

En `functions/src/pairwise.ts`, borrar el helper `djb2` completo (líneas 15-19):

```ts
const djb2 = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
};
```

Y reemplazar el bloque de comentario de `runSwissComparisons` (líneas 21-25) por:

```ts
/**
 * Run the Swiss band-B schedule with `concurrency` parallel comparisons.
 *
 * Every pair is judged TWICE, once in each presentation order (LCES eq. 1,
 * Shibata & Miyamura 2025). A verdict that survives the swap is about the
 * answers; one that flips is about the position, and counts as a tie. We
 * measured 13.5% of verdicts flipping on our own cached duels, rising to 27.9%
 * among pairs less than 5 points apart — which is most of what the Swiss band
 * schedules, so the expected rate in production is ~21%.
 *
 * The previous hash-picked presentation order is gone: it spread the bias evenly
 * instead of favouring the top or the bottom of the table, but it turned that bias
 * into per-duel noise rather than removing it.
 *
 * Returns DuelResults (indices into `players`, winner 0=i / 1=j / -1=tie).
 */
```

- [ ] **Step 4: Reemplazar el cuerpo del worker**

En `functions/src/pairwise.ts`, reemplazar el `async function worker()` completo (líneas 38-53) por:

```ts
  async function worker() {
    while (ti < pairs.length) {
      const idx = ti++;
      const [i, j] = pairs[idx];
      const a = players[i], b = players[j];
      // Las dos llamadas van en paralelo: mantiene ~`concurrency` duelos en vuelo
      // y deja el wall-clock donde estaba.
      const [fwd, rev] = await Promise.all([
        compare(a.response, b.response),
        compare(b.response, a.response),
      ]);
      // fwd: 'A' => gana a (mostrado primero).  rev: 'A' => gana b (mostrado primero).
      const fwdWinner: 0 | 1 | -1 = fwd === 'A' ? 0 : fwd === 'B' ? 1 : -1;
      const revWinner: 0 | 1 | -1 = rev === 'A' ? 1 : rev === 'B' ? 0 : -1;
      // Sólo cuenta si los dos órdenes deciden Y coinciden. Si se contradicen, o si
      // alguno responde empate (incluido el 'tie' que index.ts devuelve cuando la
      // llamada falla), el par es empate: no reordenamos con datos que no aguantan.
      const winner: 0 | 1 | -1 = fwdWinner !== -1 && fwdWinner === revWinner ? fwdWinner : -1;
      out[idx] = { i, j, winner };
      if (onDuel) await onDuel({ seq: idx, i, j, winner });
    }
  }
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
cd functions && npx vitest run src/pairwise.test.ts
```

Esperado: PASS, 7 tests (3 viejos + 4 nuevos). **Si tuviste que editar alguno de los 3 viejos, algo se rompió** — su comparador mira el contenido y es consistente al invertir, así que debe seguir dando los mismos ganadores.

- [ ] **Step 6: Correr la suite completa de functions y compilar**

```bash
cd functions && npm test && npm run build
```

Esperado: todos los tests pasan y `tsc` no reporta errores. El build importa porque `functions/lib/` está commiteado y es lo que se despliega.

- [ ] **Step 7: Commit**

```bash
git add functions/src/pairwise.ts functions/src/pairwise.test.ts functions/lib/
git commit -m "fix(duelos): un veredicto solo cuenta si sobrevive a invertir el orden

Mediamos 13,5% de veredictos que se dan vuelta al invertir el orden de
presentacion (200 pares, gpt-4o, scripts/bt-order-flip.ts), y 27,9% entre
respuestas separadas por menos de 5 puntos. Como el schedule Swiss empareja
por cercania de puntaje a proposito, la tasa esperada en produccion es ~21%:
uno de cada cinco duelos lo decidia la posicion y no la calidad.

Cada par se juzga ahora en los dos ordenes; si se contradicen, empate.
El hash djb2 se borra: repartia el sesgo en vez de eliminarlo.

Paper: Shibata & Miyamura (2025), LCES, EMNLP 2025 main, ec. 1.
Spec: docs/superpowers/specs/2026-07-27-doble-orden-duelos-design.md"
```

---

## Task 2: el reveal aprende a dibujar un empate

Hoy `RecalibrationReveal.tsx:135` sólo pinta el cartel del ganador (`verdict && winnerSide !== 'tie'`), y en `:114/:120` cada panel recibe `win` o `lose` — si nadie ganó, **los dos quedan en `lose`** (`.rr-panel.lose` los manda a `grayscale(.85) brightness(.5)`). Un empate se ve como dos contendientes apagados, sin texto, 160 ms, y corta al siguiente. Con la tarea 1 eso sería 1 de cada 5 tarjetas.

**Hay una decisión de producto acá que no es del implementador:** un empate puede leerse como *"ninguno de los dos convenció"* o como *"quedaron iguales, los dos bien"*. Cambia el tono de lo que ve el curso. Por eso las dos variantes se construyen primero y se miran antes de elegir.

**Files:**
- Modify: `src/pages/student/RecalibrationReveal.tsx:16` y `:31-59` (tiempos), `:107-137` (`Duel`), CSS al final del archivo
- Modify: `src/pages/RevealPreview.tsx:10-35` (datos sintéticos con empates)

- [ ] **Step 1: Meter empates en los datos sintéticos del preview**

En `src/pages/RevealPreview.tsx`, cambiar la firma del helper `D` para que acepte `'tie'` y agregar duelos empatados. Reemplazar el parámetro `winner` y el array `DUELS`:

```ts
const D = (
  seq: number,
  a: [string, number, number],
  b: [string, number, number],
  winner: 'a' | 'b' | 'tie',
  isUpset: boolean,
  isClimax = false,
): RoundDuel => ({
  seq,
  a: { name: a[0], provRank: a[1], provScore: a[2] },
  b: { name: b[0], provRank: b[1], provScore: b[2] },
  winner,
  isUpset,
  isClimax,
});

// ~1 de cada 5 empatado, que es la tasa que produce el doble orden en produccion.
const DUELS: RoundDuel[] = [
  D(0, ['Constanza Arcos', 6, 71], ['Ángelo Dossi', 7, 70], 'b', true),
  D(1, ['Javiera Piñol', 4, 74], ['Fabián Águila', 5, 73], 'a', false),
  D(2, ['Natalia Rosales', 2, 76], ['Maximiliano Sotomayor', 3, 75], 'tie', false),
  D(3, ['Ángelo Dossi', 7, 70], ['Matías Almarza', 8, 68], 'a', false),
  D(4, ['Fabián Águila', 5, 73], ['Constanza Arcos', 6, 71], 'b', true),
  D(5, ['Javiera Piñol', 4, 74], ['Natalia Rosales', 2, 76], 'a', true),
  D(6, ['Ángelo Dossi', 7, 70], ['Fabián Águila', 5, 73], 'tie', false),
  D(7, ['Maximiliano Sotomayor', 3, 75], ['Javiera Piñol', 4, 74], 'a', false),
  D(8, ['Joaco Morales', 1, 78], ['Natalia Rosales', 2, 76], 'a', false),
  D(9, ['Joaco Morales', 1, 78], ['Maximiliano Sotomayor', 3, 75], 'b', true, true),
];
```

- [ ] **Step 2: Agregar el prop de variante, sólo para poder comparar**

Es temporal: se borra en el Step 6, cuando Naim elija. En `src/pages/student/RecalibrationReveal.tsx`, agregar a `Props` (después de `onDone`):

```ts
  /** TEMPORAL: sólo para comparar las dos lecturas del empate en /preview-reveal. */
  tieVariant?: 'neutral' | 'ambos';
```

Y en la firma del componente (`:16`):

```ts
export default function RecalibrationReveal({ duels, duelTotal, finalReady, finalRankings, onDone, tieVariant = 'neutral' }: Props) {
```

Pasarlo a `Duel` en `:98`:

```tsx
          <Duel d={current} verdict={verdict} climax={stage === 'climax'} tieVariant={tieVariant} />
```

En `src/pages/RevealPreview.tsx`, leerlo de la URL. Agregar justo antes del `return`:

```ts
  const tieVariant = new URLSearchParams(window.location.search).get('tie') === 'ambos' ? 'ambos' : 'neutral';
```

y pasarlo al componente:

```tsx
        tieVariant={tieVariant}
```

- [ ] **Step 3: Dibujar el empate en `Duel`**

Reemplazar la función `Duel` completa (`:107-137`) por:

```tsx
function Duel({ d, verdict, climax, tieVariant }: { d: RoundDuel; verdict: boolean; climax: boolean; tieVariant: 'neutral' | 'ambos' }) {
  const winnerSide = d.winner;
  const isTie = winnerSide === 'tie';
  const gap = Math.abs(d.a.provScore - d.b.provScore);
  // Con veredicto: el ganador queda 'win' y el perdedor 'lose'. En un empate no hay
  // perdedor, asi que los dos van a un estado propio ('tie'), nunca a 'lose'.
  const panel = (side: 'a' | 'b') => {
    if (!verdict) return '';
    if (isTie) return `tie ${tieVariant}`;
    return winnerSide === side ? 'win' : 'lose';
  };
  return (
    <div className={`rr-duel ${climax ? 'rr-climax' : ''}`}>
      {climax && <div className="rr-climax-tag">◆ El duelo de la ronda ◆</div>}
      <div className={`rr-panel a ${panel('a')}`}>
        <div className="rr-side">Contendiente A</div>
        <div className="rr-seed">SEED #{d.a.provRank}</div>
        <div className="rr-name">{d.a.name}</div>
        <div className="rr-sc">provisional <b>{d.a.provScore}</b></div>
      </div>
      <div className={`rr-panel b ${panel('b')}`}>
        <div className="rr-side">Contendiente B</div>
        <div className="rr-seed">SEED #{d.b.provRank}</div>
        <div className="rr-name">{d.b.name}</div>
        <div className="rr-sc">provisional <b>{d.b.provScore}</b></div>
      </div>
      {!verdict && <div className="rr-vs">VS</div>}
      {!verdict && <div className="rr-gap">{gap <= 1 ? `Empate técnico · Δ${gap}` : `Rivales parejos · Δ${gap}`}</div>}
      {verdict && !isTie && (
        <div className={`rr-verdict ${winnerSide}`}>
          <span className="rr-g">Gana {(winnerSide === 'a' ? d.a.name : d.b.name).split(' ')[0]}</span>
          {d.isUpset && <span className="rr-up">◆ Sorpresa ◆</span>}
        </div>
      )}
      {verdict && isTie && (
        <div className="rr-verdict tie">
          <span className="rr-g">Empate</span>
          <span className="rr-up">{tieVariant === 'ambos' ? 'los dos se sostienen' : 'ninguno se impuso'}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Agregar el CSS de las dos variantes**

En el bloque `RR_CSS`, justo después de la regla `.rr-panel.lose` (`:204`), agregar:

```css
.rr-panel.tie.neutral{filter:saturate(.65) brightness(.84)}
.rr-panel.tie.ambos.a{background:linear-gradient(100deg,rgba(56,225,255,.10),#0e1017);box-shadow:inset 8px 0 0 -2px #38e1ff}
.rr-panel.tie.ambos.b{background:linear-gradient(260deg,rgba(255,90,60,.10),#0e1017);box-shadow:inset -8px 0 0 -2px #FF5A1F}
```

Y después de la regla `.rr-verdict.a{...}.rr-verdict.b{...}` (`:209`), agregar:

```css
.rr-verdict.tie{border-color:#ffc24b;color:#ffc24b}
```

- [ ] **Step 5: Darle tiempo en pantalla y mirar las dos variantes**

Un empate a 160 ms es un parpadeo. En el driver del montaje (`:46-55`), reemplazar los dos `setTimeout` por:

```ts
      const isTie = d.winner === 'tie';
      const hold = d.isUpset ? 1200 : isTie ? 420 : 260;
      const after = d.isUpset ? 620 : isTie ? 380 : 160;
      t = setTimeout(() => {
        if (cancelled) return;
        setVerdict(true);
        t = setTimeout(() => {
          if (cancelled) return;
          cursorRef.current = c + 1;
          setCursor(c + 1);
          playNext();
        }, after);
      }, hold);
```

Un empate pasa a durar ~800 ms contra los ~420 ms de un duelo normal. Con ~16 empates en una ronda de 75 duelos el montaje crece ~6 s (de ~40 s a ~46 s), y el LLM sigue teniendo holgura de sobra.

Arrancar el dev server y mirar las dos:

```bash
npm run dev
```

Abrir `http://localhost:5173/preview-reveal` (variante fría) y `http://localhost:5173/preview-reveal?tie=ambos` (variante cálida).

**Nota de WSL:** si el server sirve módulos viejos sin decir nada, es el problema conocido de inotify sobre `/mnt/c` — reiniciar el server.

**Parar acá y mostrarle las dos a Naim.** Esta decisión es suya, no del implementador.

- [ ] **Step 6: Dejar sólo la variante elegida**

Una vez elegida, borrar el prop temporal `tieVariant` de `Props`, de la firma del componente, de la llamada a `Duel` y de la firma de `Duel`; borrar la lectura del query param en `RevealPreview.tsx`; hardcodear la clase y el texto de la variante ganadora; y borrar del CSS las reglas de la variante perdedora.

Los empates de `DUELS` en `RevealPreview.tsx` **se quedan** — el preview tiene que seguir mostrando el caso que ahora ocurre 1 de cada 5 veces.

- [ ] **Step 7: Correr los tests del frontend y compilar**

```bash
npm test && npm run build
```

Esperado: los tests pasan (ninguno cubre este componente, así que no deberían moverse) y `tsc` + `vite build` no reportan errores. El build es la verificación real acá: confirma que no quedó ninguna referencia al prop borrado.

- [ ] **Step 8: Commit**

```bash
git add src/pages/student/RecalibrationReveal.tsx src/pages/RevealPreview.tsx
git commit -m "fix(reveal): dibujar el empate en vez de apagar los dos paneles

El componente solo pintaba el cartel del ganador, y cuando no habia ganador
los dos paneles caian en .lose (grayscale + brightness .5): un empate se veia
como dos contendientes apagados, sin texto, 160ms. Hoy no se nota porque el
unico empate posible es un error de API; con el doble orden es 1 de cada 5
tarjetas, en un proyector, frente al curso.

Ahora el empate tiene estado propio, cartel y ~800ms en pantalla.
/preview-reveal incluye empates para poder mirarlo sin clase en vivo."
```

---

## Task 3: re-verificar `RECAL_B` y `RECAL_W_ANCHOR`

`functions/src/index.ts:815-816` dicen "(calibrated)", y se calibraron con una tasa de empate de ~0%. Con ~21% de empates esas constantes describen un régimen que ya no existe. `bt-calibrate.ts` barre `B` × `w_anchor` y reporta *cuánta gente se mueve* (`avgMove`, `pctMoved`) contra *cuánto de ese movimiento se reproduce en una mitad de los datos* (`stability`): drama contra señal.

**Predicción del spec, que este paso pone a prueba:** `avgMove` baja y `stability` sube. Si se cumple, no hay nada que cambiar.

**Files:**
- Modify: `scripts/bt-calibrate.ts:119-146` (`duelsForRound`)
- Modify (condicional): `functions/src/index.ts:815-816`

- [ ] **Step 1: Extraer un helper de llamada-con-caché**

En `scripts/bt-calibrate.ts`, agregar justo antes de `duelsForRound`:

```ts
/** Una comparación en UN orden, cacheada por `${ronda}|${idPrimero}|${idSegundo}`. */
async function compareCached(
  code: string, key: string, system: string, first: string, second: string,
  cache: Map<string, 'A' | 'B' | 'tie'>,
): Promise<'A' | 'B' | 'tie'> {
  const hit = cache.get(key);
  if (hit !== undefined) { cacheHits++; return hit; }
  if (runningCost >= HARD_CAP_USD) return 'tie';
  const w = await callLLM(system, first, second); callCount++;
  appendCache(code, key, w); cache.set(key, w);
  return w;
}
```

- [ ] **Step 2: Reemplazar el cuerpo del worker por el doble orden**

En `duelsForRound`, reemplazar el `async function worker()` completo por:

```ts
  async function worker() {
    while (ti < pairs.length) {
      const idx = ti++; const { a, b, d } = pairs[idx];
      const pa = rd.players[a], pb = rd.players[b];
      // Los dos ordenes (LCES ec. 1). El caché ya trae pagado uno de los dos de
      // corridas anteriores, sea cual sea: sólo se paga el que falte.
      const [fwd, rev] = await Promise.all([
        compareCached(code, `${rd.round}|${pa.id}|${pb.id}`, system, pa.response, pb.response, cache),
        compareCached(code, `${rd.round}|${pb.id}|${pa.id}`, system, pb.response, pa.response, cache),
      ]);
      const fwdWin = fwd === 'A' ? pa.id : fwd === 'B' ? pb.id : '';
      const revWin = rev === 'A' ? pb.id : rev === 'B' ? pa.id : '';
      const winId = fwdWin && fwdWin === revWin ? fwdWin : '';
      out[idx] = { i: a, j: b, d, winId };
    }
  }
```

`winId: ''` ya significa empate río abajo (`recalibrate` hace `if (dl.d > B || !dl.winId) continue;`), así que no hay que tocar nada más del script.

- [ ] **Step 3: Correr el barrido**

```bash
npx tsx scripts/bt-calibrate.ts
```

La corrida vieja fueron 1.375 llamadas y $2,92 (está en `bt-calibration.json`). El caché cubre un orden de cada par, así que se paga el otro: ~1.375 llamadas nuevas ≈ **$2,9**, bajo el tope de $8 del script. Tarda un rato.

Esperado: la tabla del barrido `B` × `w_anchor` con `avgMove`, `pctMoved`, `stability` y `rhoVsProv` por celda.

- [ ] **Step 4: Comparar contra el régimen viejo y decidir**

Ojo: `WANCHOR_GRID` es `[1.0, 0.5, 0.25, 0.1]` y **0,35 no está en la grilla** — el valor de producción salió interpolando entre 0,5 y 0,25. Hay que mirar esas dos celdas vecinas, no una sola.

La línea base, de la corrida vieja (`bt-calibration.json`, 1.375 llamadas, sin doble orden):

```
B  w      avgMove  pctMoved  stability  rhoVsProv
4  1        1.339     0.720      0.981      0.965
4  0.5      2.047     0.788      0.957      0.913   <- vecina de produccion
4  0.25     3.044     0.847      0.884      0.805   <- vecina de produccion
4  0.1      4.608     0.912      0.673      0.550
5  1        1.457     0.764      0.981      0.959
5  0.5      2.147     0.802      0.947      0.904
5  0.25     3.139     0.853      0.872      0.789
5  0.1      4.490     0.903      0.669      0.577
```

Comparar celda contra celda:

- Si `stability` subió y `pctMoved` sigue en un rango parecido → **no hay nada que cambiar, la tarea termina acá** y este commit no existe.
- Si `pctMoved` cayó mucho (el reveal se vuelve plano), subir `RECAL_B` a la celda que recupere el drama **sin** perder la estabilidad ganada. Subir B agrega duelos de mayor distancia, que es justo donde el flip es bajo (6%): se compra señal, no ruido. Ojo con el costo: B=5 son `5n−15` duelos en vez de `4n−10`, o sea ~20% más llamadas.
- Bajar `w_anchor` es la otra palanca (le da más peso relativo a los duelos frescos), pero mueve el sistema hacia confiar menos en los provisionales — decisión más grande, conviene consultarla antes.

- [ ] **Step 5: Commit del script (siempre) y de las constantes (sólo si cambiaron)**

```bash
git add scripts/bt-calibrate.ts
git commit -m "chore(calibracion): doble orden en bt-calibrate, para medir el regimen nuevo

El barrido de B x w_anchor tiene que ver los mismos empates que produce
produccion; si no, calibra un regimen que ya no existe."
```

Si hubo que mover las constantes, va en un commit aparte:

```bash
git add functions/src/index.ts functions/lib/
git commit -m "tune(recal): ajustar RECAL_B tras el doble orden

Con ~21% de empates los duelos frescos aportan menos masa direccional y el
reveal movia a menos gente. <pegar acá los numeros de avgMove/pctMoved/stability
antes y despues>"
```

---

## Task 4: verificar jugando, y desplegar

Los tests cubren la lógica de `pairwise.ts`, pero **la clase de bug que motivó la tarea 2 pasa todos los tests**. Esto no se da por bueno hasta verlo correr.

**No desplegar sin que Naim lo pida.** Los pasos van acá para que estén escritos, no para ejecutarlos solos.

- [ ] **Step 1: Desplegar functions desde el filesystem nativo de WSL**

`firebase deploy --only functions` **siempre** falla desde `/mnt/c/` (I/O a NTFS demora ~26 s en cargar los módulos contra un timeout de 10 s del CLI). Los pasos completos están en `CLAUDE.md`. Lo esencial:

```bash
rm -rf /tmp/functions-deploy && mkdir -p /tmp/functions-deploy/functions
cp firebase.json /tmp/functions-deploy/
echo '{"projects":{"default":"ml2-master-game"}}' > /tmp/functions-deploy/.firebaserc
cp functions/package.json functions/package-lock.json functions/tsconfig.json /tmp/functions-deploy/functions/
cp -r functions/src /tmp/functions-deploy/functions/src
cp -r functions/lib /tmp/functions-deploy/functions/lib
cd /tmp/functions-deploy/functions && npm ci
cd /tmp/functions-deploy && npx firebase deploy --only functions
```

Copiar **todo** `functions/src`, no sólo `index.ts`: el hook `predeploy` corre `tsc` y `index.ts` importa varios `./lib/*.ts`.

El frontend se despliega solo al pushear a `main` (GitHub Actions).

- [ ] **Step 2: Jugar una partida de prueba**

Crear un juego con al menos una ronda ranked y dos cuentas, responder, y **mirar el reveal completo** hasta el leaderboard. Confirmar que los empates se ven como empates y no como dos paneles apagados.

- [ ] **Step 3: Leer los duelos en Firestore**

Con ADC configurado, leer `games/{code}/rounds/round_N/duels/` y contar los `winner: 'tie'`. Esperado: en el orden del 20%, no 0% (el doble orden no está corriendo) ni 80% (algo se rompió y todo empata).

- [ ] **Step 4: Anotar el resultado en el registro**

Actualizar la línea de "Doble orden en los duelos" en la sección **Pendiente / propuesto** de `docs/evaluacion_llm_literatura.md`: moverla a **Hecho**, con la tasa de empate real observada en vivo y si hubo que mover `RECAL_B`.

```bash
git add docs/evaluacion_llm_literatura.md
git commit -m "docs: resultado en vivo del doble orden en los duelos"
```

---

## Notas para quien ejecute

- **`functions/lib/` está commiteado** y es lo que se despliega. Cualquier commit que toque `functions/src/` tiene que incluir el `npm run build` correspondiente.
- **Dos suites de tests separadas:** `cd functions && npm test` y `npm test` en la raíz. La tarea 1 sólo mueve la primera, la tarea 2 sólo la segunda.
- **El comparador de producción se traga los errores.** `index.ts:921-937` atrapa cualquier fallo y devuelve `'tie'`. Con dos llamadas hay el doble de chances de que una falle, y eso es deliberado: un fallo se vuelve empate, que no reordena a nadie con datos malos. **No** "arreglarlo" distinguiendo error de empate — eso obliga a cambiar el tipo `Comparator` y a tocar `index.ts`, y quedó explícitamente fuera de alcance en el spec.
- **`duelTotal` no cambia.** Sigue siendo `4n−10` (un `DuelResult` por par, no por llamada). Si el contador del reveal empieza a mostrar el doble, `onDuel` se está disparando por llamada y el Step 4 de la tarea 1 quedó mal.
- **Lo que NO está en este plan, a propósito:** permitir empates explícitos en `buildComparePrompt`, y RankNet. Los dos fueron evaluados y descartados; las razones están en el spec y en `docs/evaluacion_llm_literatura.md`.
