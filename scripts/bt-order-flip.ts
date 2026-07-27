/**
 * ¿Cuánto de nuestros veredictos de duelo lo decide el ORDEN y no la calidad?
 *
 * Motivado por LCES §5.2 (Shibata & Miyamura, EMNLP 2025), que mide entre 10% y 51%
 * de veredictos que se dan vuelta al invertir el orden de presentación, según el
 * modelo. Ese número es de otro dominio, otro prompt y otro idioma. Este script lo
 * mide sobre LO NUESTRO: nuestras respuestas, nuestro prompt, gpt-4o.
 *
 * Cómo: scripts/.cache/pairwise-<game>.jsonl ya tiene ~2.000 comparaciones pagadas,
 * y su clave incluye el orden de presentación (`${round}|${firstId}|${secondId}`).
 * Este script toma una muestra de esas comparaciones, corre SOLO el orden invertido
 * (clave nueva, llamada nueva) y compara. La mitad forward sale gratis del caché.
 *
 * OJO: el prompt debe ser byte a byte el de bt-pairwise.ts, que fue el que produjo
 * los veredictos cacheados. Si se cambia, la comparación deja de ser válida y hay
 * que re-pagar las dos mitades.
 *
 * Regla de consistencia de LCES (ec. 1): un par es consistente sólo si los dos
 * órdenes eligen al MISMO estudiante. Si se contradicen, o si alguno de los dos
 * responde empate, LCES lo cuenta como empate.
 *
 * Read-only en Firestore. DRY por defecto: imprime el plan y el costo estimado.
 * Pasa --run para gastar.
 *
 * Uso:
 *   npx tsx scripts/bt-order-flip.ts [GAME ...] [--n 200] [--run] [--cap 3]
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { coerceScore } from './lib/parse';

const PROJECT_ID = 'ml2-master-game';
const ENV_PATH = '/mnt/c/Users/naim.bro.k/Documents/Datos/papers/2026_faction_detection/.env';
const MODEL = 'gpt-4o';
const CACHE_DIR = 'scripts/.cache';
const DEFAULT_GAMES = ['5XBB57', 'L844V5', 'YZP5MK', 'LUUWFL', '7WZUXF', 'ABNVDL'];
const CONCURRENCY = 8;
const P_IN = 2.5e-6, P_CACHED = 1.25e-6, P_OUT = 1.0e-5;

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name: string, def: number) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? Number(argv[i + 1]) : def; };
const RUN = argv.includes('--run');
const N = flag('n', 200);
const CAP = flag('cap', 3);
const codes = argv.filter((a) => !a.startsWith('--') && !/^\d+(\.\d+)?$/.test(a));
const games = codes.length ? codes : DEFAULT_GAMES;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const API_KEY = (() => {
  const m = readFileSync(ENV_PATH, 'utf8').match(/^OPENAI_API_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error('OPENAI_API_KEY not found');
  return m[1].trim().replace(/^["']|["']$/g, '');
})();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const djb2 = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (k: number, n: number) => (n ? `${((100 * k) / n).toFixed(1)}%` : 'n/a');
/** Error estándar de una proporción, en puntos porcentuales. */
const sePP = (k: number, n: number) => (n ? 100 * Math.sqrt(((k / n) * (1 - k / n)) / n) : NaN);
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

// ---------- Firestore (mismo cargador que bt-pairwise.ts) ----------
interface Sub {
  playerId: string; playerName: string; round: number; response?: string;
  submittedAt?: { toMillis?: () => number };
  evaluation?: { finalScore: number | string };
}
function dedupeLatest(subs: Sub[]): Sub[] {
  const best = new Map<string, Sub>();
  for (const s of subs) {
    const k = `${s.playerId}__${s.round}`; const c = best.get(k);
    if (!c || (s.submittedAt?.toMillis?.() ?? 0) >= (c.submittedAt?.toMillis?.() ?? 0)) best.set(k, s);
  }
  return [...best.values()];
}

interface Player { id: string; name: string; response: string; finalScore: number }
interface RoundData { round: number; title: string; context: string; players: Player[] }

function compactRubric(rubric: any): string {
  const dims = (rubric?.dimensions || []) as any[];
  if (!dims.length) return '';
  return dims.map((d) => `- ${d.name || d.id}: ${d.description || ''}`).join('\n');
}

async function loadGame(code: string): Promise<RoundData[]> {
  const gameDoc = await db.collection('games').doc(code).get();
  if (!gameDoc.exists) { console.error(`Game ${code} not found`); return []; }
  const game = gameDoc.data()!;
  const scenarios: any[] = game.scenarios || [];
  const rubricText = compactRubric(game.sessionConfig?.rubric);
  const subsSnap = await db.collection('games').doc(code).collection('submissions').get();
  const allSubs = dedupeLatest(subsSnap.docs.map((d) => d.data() as Sub));

  const rounds: RoundData[] = [];
  for (let idx = 0; idx < scenarios.length; idx++) {
    const sc = scenarios[idx]; const round = idx + 1;
    if (sc?.ranked === false || sc?.type === 'multiple_choice') continue;
    const roundSubs = allSubs.filter((s) => s.round === round);
    const players: Player[] = roundSubs
      .filter((s) => s.evaluation && typeof s.response === 'string' && s.response.trim().length > 0
        && Number.isFinite(coerceScore(s.evaluation.finalScore)))
      .map((s) => ({ id: s.playerId, name: s.playerName, response: s.response!.trim(), finalScore: coerceScore(s.evaluation!.finalScore) }));
    if (players.length < 2) continue;

    const idealAnswer = sc.idealAnswer ? JSON.stringify(sc.idealAnswer).slice(0, 1200) : '';
    const context = [
      `TAREA: ${sc.title || ''}`,
      sc.context ? `CONTEXTO: ${sc.context}` : '',
      sc.question ? `PREGUNTA: ${typeof sc.question === 'string' ? sc.question : JSON.stringify(sc.question)}` : '',
      rubricText ? `CRITERIOS DE EVALUACION:\n${rubricText}` : '',
      idealAnswer ? `RESPUESTA DE REFERENCIA (nivel esperado): ${idealAnswer}` : '',
    ].filter(Boolean).join('\n\n');
    rounds.push({ round, title: sc.title || `Round ${round}`, context, players });
  }
  return rounds;
}

// ---------- prompt: COPIA EXACTA de bt-pairwise.ts:133 ----------
// No tocar. Los veredictos forward cacheados salieron de este string.
function systemPrompt(context: string): string {
  return `Eres un evaluador experto y consistente. A continuacion, la tarea que respondieron dos estudiantes y los criterios de evaluacion.\n\n${context}\n\nSe te mostraran dos respuestas de estudiantes, A y B. Decide cual respuesta es MEJOR segun los criterios. Debes elegir una; no empates salvo que sean indistinguibles. Responde SOLO con JSON valido: {"winner":"A"} o {"winner":"B"}.`;
}

// ---------- LLM ----------
let runningCost = 0, callCount = 0, cacheHits = 0;
const latencies: number[] = [];

type Verdict = 'A' | 'B' | 'tie';

function loadCache(code: string): Map<string, Verdict> {
  const c = new Map<string, Verdict>(); const p = `${CACHE_DIR}/pairwise-${code}.jsonl`;
  if (!existsSync(p)) return c;
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { const o = JSON.parse(l); c.set(o.key, o.winner); } catch { /* skip */ }
  }
  return c;
}
const appendCache = (code: string, key: string, winner: Verdict) =>
  appendFileSync(`${CACHE_DIR}/pairwise-${code}.jsonl`, JSON.stringify({ key, winner }) + '\n');

async function callLLM(system: string, a: string, b: string): Promise<Verdict> {
  const body = {
    model: MODEL, temperature: 0, max_tokens: 20,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `RESPUESTA A:\n${a}\n\nRESPUESTA B:\n${b}` },
    ],
  };
  for (let att = 0; att < 4; att++) {
    const t0 = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * (att + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: any = await res.json(); const u = j.usage || {};
      const cd = u.prompt_tokens_details?.cached_tokens || 0;
      runningCost += (u.prompt_tokens - cd) * P_IN + cd * P_CACHED + (u.completion_tokens || 0) * P_OUT;
      callCount++;
      latencies.push(Date.now() - t0);
      try {
        const w = JSON.parse(j.choices[0].message.content).winner;
        if (w === 'A' || w === 'B') return w;
      } catch { /* cae a tie */ }
      return 'tie';
    } catch (e) {
      if (att === 3) { console.error('  call failed:', (e as Error).message); return 'tie'; }
      await sleep(800 * (att + 1));
    }
  }
  return 'tie';
}

// ---------- muestra ----------
interface Task {
  code: string; round: number;
  firstId: string; secondId: string;   // orden tal como se preguntó la vez pasada
  fwd: Verdict;                        // veredicto cacheado en ese orden
  first: Player; second: Player;
  context: string;
}

/** Reconstruye los pares ya pagados desde el caché y los cruza con Firestore. */
function tasksForGame(code: string, rounds: RoundData[], cache: Map<string, Verdict>): Task[] {
  const byRound = new Map(rounds.map((r) => [r.round, r]));
  const out: Task[] = [];
  for (const [key, fwd] of cache) {
    const parts = key.split('|');
    if (parts.length !== 3) continue;
    const round = Number(parts[0]);
    const rd = byRound.get(round);
    if (!rd) continue;
    const first = rd.players.find((p) => p.id === parts[1]);
    const second = rd.players.find((p) => p.id === parts[2]);
    if (!first || !second) continue;
    out.push({ code, round, firstId: parts[1], secondId: parts[2], fwd, first, second, context: rd.context });
  }
  return out;
}

/** Orden determinista por hash, y cuota pareja por juego. */
const hashOrder = (ts: Task[]) =>
  [...ts].sort((a, b) => djb2(`${a.code}|${a.round}|${a.firstId}|${a.secondId}`) - djb2(`${b.code}|${b.round}|${b.firstId}|${b.secondId}`));

function sampleEvenly(byGame: Map<string, Task[]>, n: number): Task[] {
  const buckets = [...byGame.values()].map(hashOrder);
  const picked: Task[] = [];
  while (picked.length < n && buckets.some((b) => b.length)) {
    for (const b of buckets) { if (b.length && picked.length < n) picked.push(b.shift()!); }
  }
  return picked;
}

// ---------- main ----------
interface Row extends Task { rev: Verdict }

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const byGame = new Map<string, Task[]>();
  const caches = new Map<string, Map<string, Verdict>>();
  let totalCached = 0;
  for (const code of games) {
    const rounds = await loadGame(code);
    const cache = loadCache(code);
    caches.set(code, cache);
    const ts = tasksForGame(code, rounds, cache);
    totalCached += ts.length;
    if (ts.length) byGame.set(code, ts);
  }

  const items = sampleEvenly(byGame, N);
  // Los que ya tengan el reverso cacheado (de una corrida anterior) no se re-pagan.
  const alreadyReversed = items.filter((t) => caches.get(t.code)!.has(`${t.round}|${t.secondId}|${t.firstId}`)).length;
  const planned = items.length - alreadyReversed;

  console.log(`\n===== INCONSISTENCIA POR ORDEN (LCES §5.2 sobre nuestros duelos) =====`);
  console.log(`juegos: ${games.join(', ')}`);
  console.log(`pares forward ya pagados en caché: ${totalCached}   muestreados: ${items.length}`);
  console.log(`de la muestra, con el reverso ya cacheado: ${alreadyReversed}   llamadas NUEVAS: ${planned}`);
  console.log(`modelo: ${MODEL} (temp 0)   tope de gasto: $${CAP}   est.: ~$${(planned * 0.005).toFixed(2)}`);

  if (!RUN) {
    console.log(`\nDRY RUN. Re-corre con --run para gastar.`);
    console.log(`El prompt es copia exacta de bt-pairwise.ts:133 — si difiere, los veredictos`);
    console.log(`forward cacheados no son comparables y hay que re-pagar las dos mitades.`);
    process.exit(0);
  }

  const rows: Row[] = [];
  let ti = 0;
  async function worker() {
    while (ti < items.length) {
      const t = items[ti++];
      const revKey = `${t.round}|${t.secondId}|${t.firstId}`;
      const cache = caches.get(t.code)!;
      let rev = cache.get(revKey);
      if (rev === undefined) {
        if (runningCost >= CAP) return;
        // orden invertido: el que era B ahora se muestra como A
        rev = await callLLM(systemPrompt(t.context), t.second.response, t.first.response);
        appendCache(t.code, revKey, rev); cache.set(revKey, rev);
      } else { cacheHits++; }
      rows.push({ ...t, rev });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  report(rows);
}

function report(rows: Row[]) {
  const n = rows.length;
  // Ganador por ID en cada orden. En el forward, 'A' = first. En el reverso se
  // presentó (second, first), así que 'A' = second.
  const winners = rows.map((r) => ({
    r,
    fwdWin: r.fwd === 'A' ? r.firstId : r.fwd === 'B' ? r.secondId : null,
    revWin: r.rev === 'A' ? r.secondId : r.rev === 'B' ? r.firstId : null,
  }));

  const bothDecisive = winners.filter((w) => w.fwdWin && w.revWin);
  const anyTie = winners.filter((w) => !w.fwdWin || !w.revWin);
  const flips = bothDecisive.filter((w) => w.fwdWin !== w.revWin);
  const agree = bothDecisive.filter((w) => w.fwdWin === w.revWin);

  // De los flips: ¿ganó siempre el que iba primero, o siempre el que iba segundo?
  const firstAlways = flips.filter((w) => w.r.fwd === 'A' && w.r.rev === 'A').length;
  const secondAlways = flips.filter((w) => w.r.fwd === 'B' && w.r.rev === 'B').length;

  console.log(`\n----- RESULTADOS (${n} pares con los dos órdenes) -----`);
  console.log(`llamadas nuevas: ${callCount}   reversos ya cacheados: ${cacheHits}   gasto: $${runningCost.toFixed(2)}`);
  if (latencies.length) {
    console.log(`latencia por llamada: mediana ${quantile(latencies, 0.5)}ms   p90 ${quantile(latencies, 0.9)}ms   media ${mean(latencies).toFixed(0)}ms`);
  }

  console.log(`\nCONSISTENCIA`);
  console.log(`  los dos órdenes deciden y COINCIDEN : ${agree.length}/${n}  (${pct(agree.length, n)})`);
  console.log(`  los dos deciden y se CONTRADICEN   : ${flips.length}/${n}  (${pct(flips.length, n)} ± ${sePP(flips.length, n).toFixed(1)}pp)`);
  console.log(`  alguno de los dos respondió empate : ${anyTie.length}/${n}  (${pct(anyTie.length, n)})`);
  console.log(`\n  tasa de flip entre pares decididos por ambos: ${pct(flips.length, bothDecisive.length)} ± ${sePP(flips.length, bothDecisive.length).toFixed(1)}pp`);
  console.log(`  → LCES §5.2 reporta 10,4% (ASAP) y 17,0% (TOEFL11) para gpt-4o.`);

  console.log(`\nDE LOS FLIPS, ¿QUÉ POSICIÓN GANÓ?`);
  console.log(`  ganó siempre el PRIMERO  : ${firstAlways}/${flips.length}  (${pct(firstAlways, flips.length)})`);
  console.log(`  ganó siempre el SEGUNDO  : ${secondAlways}/${flips.length}  (${pct(secondAlways, flips.length)})`);
  console.log(`  (un reparto ~50/50 = ruido sin dirección; un sesgo marcado = preferencia posicional sistemática)`);

  // ¿El flip se concentra donde el reordenamiento importa (pares parejos)?
  const gap = (w: typeof winners[number]) => Math.abs(w.r.first.finalScore - w.r.second.finalScore);
  const BANDS: [number, number, string][] = [[0, 5, 'Δ<5'], [5, 15, 'Δ5-15'], [15, 30, 'Δ15-30'], [30, 1e9, 'Δ≥30']];
  console.log(`\nFLIP POR DISTANCIA DE PUNTAJE PROVISIONAL`);
  for (const [lo, hi, label] of BANDS) {
    const band = bothDecisive.filter((w) => gap(w) >= lo && gap(w) < hi);
    const bf = band.filter((w) => w.fwdWin !== w.revWin);
    console.log(`  ${label.padEnd(7)} n=${String(band.length).padStart(3)}   flip ${pct(bf.length, band.length)}`);
  }

  // Bajo la regla de LCES (ec. 1), ¿con cuántos empates queda el BT?
  const lcesTies = flips.length + anyTie.length;
  console.log(`\nSI ADOPTÁRAMOS LA REGLA DE LCES (contradicción o empate ⇒ empate):`);
  console.log(`  empates resultantes: ${lcesTies}/${n}  (${pct(lcesTies, n)})`);
  console.log(`  o sea, ${pct(n - lcesTies, n)} de los duelos seguiría aportando señal direccional al Bradley-Terry.`);
  console.log(`  → correr scripts/bt-calibrate.ts con esa tasa de empate para ver si el drama sobrevive.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
