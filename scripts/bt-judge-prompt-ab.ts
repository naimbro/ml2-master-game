/**
 * Offline A/B for the two anti-noise judge clauses (STRICT_ANCHOR + ANTI_EXPANSION,
 * see functions/src/lib/judgePromptClauses.ts), motivated by RuVerBench / Peng et
 * al. 2026 ("Can LLM-as-a-Judge Reliably Verify Rubrics in Agentic Scenarios?").
 *
 * We have NO human gold labels for student responses, so this does not measure
 * accuracy. It measures the *deterministic directional shift* the clauses cause on
 * REAL submissions: production judges run at temperature 0, so BASELINE vs TREATMENT
 * is a clean one-call-each comparison. The hypotheses under test:
 *   - PARTIAL SATISFACTION fix  → partial/weak answers should move DOWN (fewer easy 100s).
 *   - REQUIREMENT EXPANSION fix → answers penalized for un-asked-for things move UP.
 *
 * Optional --votes K --temp T runs a self-consistency study (paper's majority-voting
 * question) if you ever consider stochastic judging.
 *
 * Reuses bt-calibrate.ts plumbing (env key, Firestore read, OpenAI, cache, cost cap)
 * and imports the EXACT production clause text so the two never drift.
 *
 * Read-only on Firestore. DRY by default (prints plan + a sample prompt + cost
 * estimate). Pass --run to actually spend.
 *
 * Usage:
 *   npx tsx scripts/bt-judge-prompt-ab.ts [GAME ...] [--n 40] [--run]
 *                                         [--votes 1] [--temp 0] [--cap 3]
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { coerceScore } from './lib/parse';
import { strictJudgingClauses } from '../functions/src/lib/judgePromptClauses';

const PROJECT_ID = 'ml2-master-game';
const ENV_PATH = '/mnt/c/Users/naim.bro.k/Documents/Datos/papers/2026_faction_detection/.env';
const MODEL = 'gpt-4o';
const CACHE_DIR = 'scripts/.cache';
const DEFAULT_GAMES = ['5XBB57', 'L844V5', 'YZP5MK', 'LUUWFL', '7WZUXF', 'ABNVDL'];
const CONCURRENCY = 8;
const P_IN = 2.5e-6, P_CACHED = 1.25e-6, P_OUT = 1.0e-5;
const ANCHORS = [0, 20, 40, 60, 80, 100];

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name: string, def: number) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? Number(argv[i + 1]) : def; };
const RUN = argv.includes('--run');
const N = flag('n', 40);
const VOTES = Math.max(1, flag('votes', 1));
const TEMP = flag('temp', 0);
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
const sd = (xs: number[]) => { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };
const snap = (n: number) => ANCHORS.reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p), 100);

// ---------- Firestore ----------
interface Sub { playerId: string; playerName: string; round: number; response?: string;
  submittedAt?: { toMillis?: () => number }; evaluation?: { finalScore: number | string }; }
function dedupeLatest(subs: Sub[]): Sub[] {
  const best = new Map<string, Sub>();
  for (const s of subs) { const k = `${s.playerId}__${s.round}`; const c = best.get(k);
    if (!c || (s.submittedAt?.toMillis?.() ?? 0) >= (c.submittedAt?.toMillis?.() ?? 0)) best.set(k, s); }
  return [...best.values()];
}
interface Dim { id: string; name: string; description: string; levels: Record<string, string>; }
interface Item { code: string; round: number; playerId: string; playerName: string; response: string; context: string; dims: Dim[]; }

function rubricDims(rubric: any): Dim[] {
  return ((rubric?.dimensions || []) as any[]).map((d) => ({
    id: d.id, name: d.name || d.id, description: d.description || '',
    levels: Object.fromEntries(ANCHORS.map((a) => [String(a), d[`level_${a}`] || ''])),
  }));
}
async function loadGame(code: string): Promise<Item[]> {
  const g = (await db.collection('games').doc(code).get()).data();
  if (!g) { console.error(`Game ${code} not found`); return []; }
  const scenarios: any[] = g.scenarios || [];
  const dims = rubricDims(g.sessionConfig?.rubric);
  if (!dims.length) return [];
  const subs = dedupeLatest((await db.collection('games').doc(code).collection('submissions').get()).docs.map((d) => d.data() as Sub));
  const items: Item[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i]; const round = i + 1;
    if (sc?.ranked === false || sc?.type === 'multiple_choice') continue;
    const context = [`TAREA: ${sc.title || ''}`, sc.context ? `CONTEXTO: ${sc.context}` : '',
      sc.question ? `PREGUNTA: ${typeof sc.question === 'string' ? sc.question : JSON.stringify(sc.question)}` : ''].filter(Boolean).join('\n\n');
    for (const s of subs) {
      if (s.round !== round || !s.evaluation || typeof s.response !== 'string' || !s.response.trim()) continue;
      if (!Number.isFinite(coerceScore(s.evaluation.finalScore))) continue;
      items.push({ code, round, playerId: s.playerId, playerName: s.playerName, response: s.response.trim(), context, dims });
    }
  }
  return items;
}

// ---------- prompt (baseline vs treatment differ ONLY by the clause block) ----------
function rubricText(dims: Dim[]): string {
  return dims.map((d) => `- ${d.id} (${d.name}): ${d.description}\n`
    + ANCHORS.map((a) => `    nivel ${a}: ${d.levels[String(a)]}`).filter((l) => !l.endsWith(': ')).join('\n')).join('\n\n');
}
function systemPrompt(it: Item, treatment: boolean): string {
  const jsonShape = dimsJson(it.dims);
  return `Eres un evaluador experto y consistente. Evalua la respuesta del estudiante contra la rubrica.\n\n`
    + `${it.context}\n\nRUBRICA (elige, por dimension, EL NIVEL cuyo texto mejor describe la respuesta):\n${rubricText(it.dims)}`
    + (treatment ? strictJudgingClauses() : '')
    + `\n\nResponde SOLO JSON: {"dimensionScores":{${jsonShape}}} usando exactamente uno de 0,20,40,60,80,100 por dimension.`;
}
const dimsJson = (dims: Dim[]) => dims.map((d) => `"${d.id}":<0|20|40|60|80|100>`).join(',');

// ---------- LLM ----------
let runningCost = 0, callCount = 0, cacheHits = 0;
function loadCache(): Map<string, Record<string, number>> {
  const c = new Map<string, Record<string, number>>(); const p = `${CACHE_DIR}/judge-ab.jsonl`;
  if (existsSync(p)) for (const l of readFileSync(p, 'utf8').split('\n')) { if (!l.trim()) continue; try { const o = JSON.parse(l); c.set(o.key, o.scores); } catch { /**/ } }
  return c;
}
const appendCache = (key: string, scores: Record<string, number>) => appendFileSync(`${CACHE_DIR}/judge-ab.jsonl`, JSON.stringify({ key, scores }) + '\n');

async function scoreOnce(it: Item, treatment: boolean, vote: number, cache: Map<string, Record<string, number>>): Promise<Record<string, number> | null> {
  const key = `${MODEL}|t${TEMP}|${treatment ? 'T' : 'B'}|v${vote}|${it.code}|${it.round}|${it.playerId}`;
  const cached = cache.get(key);
  if (cached) { cacheHits++; return cached; }
  if (runningCost >= CAP) return null;
  const body: any = { model: MODEL, max_tokens: 300, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: systemPrompt(it, treatment) }, { role: 'user', content: `RESPUESTA DEL ESTUDIANTE:\n${it.response}` }] };
  if (TEMP > 0) body.temperature = TEMP; else body.temperature = 0;
  for (let att = 0; att < 4; att++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` }, body: JSON.stringify(body) });
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * (att + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: any = await res.json(); const u = j.usage || {};
      const cd = u.prompt_tokens_details?.cached_tokens || 0;
      runningCost += (u.prompt_tokens - cd) * P_IN + cd * P_CACHED + (u.completion_tokens || 0) * P_OUT;
      callCount++;
      const parsed = JSON.parse(j.choices[0].message.content).dimensionScores || {};
      const scores: Record<string, number> = {};
      for (const d of it.dims) { const v = coerceScore(parsed[d.id]); if (Number.isFinite(v)) scores[d.id] = snap(v); }
      if (Object.keys(scores).length !== it.dims.length) return null;
      appendCache(key, scores); cache.set(key, scores);
      return scores;
    } catch (e) { if (att === 3) { console.error('  call failed:', (e as Error).message); return null; } await sleep(800 * (att + 1)); }
  }
  return null;
}
const meanScore = (s: Record<string, number>) => mean(Object.values(s));

// ---------- sampling (deterministic: hash-ordered, no Math.random) ----------
function sample(items: Item[], n: number): Item[] {
  return [...items].sort((a, b) => djb2(`${a.code}|${a.round}|${a.playerId}`) - djb2(`${b.code}|${b.round}|${b.playerId}`)).slice(0, n);
}

// ---------- main ----------
async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const all: Item[] = [];
  for (const code of games) all.push(...await loadGame(code));
  const items = sample(all, N);
  const plannedCalls = items.length * 2 * VOTES; // baseline + treatment, × votes

  console.log(`\n===== JUDGE PROMPT A/B (strict-anchor + anti-expansion clauses) =====`);
  console.log(`games: ${games.join(', ')}   ranked submissions found: ${all.length}   sampled: ${items.length}`);
  console.log(`votes/cond: ${VOTES}   temperature: ${TEMP}   model: ${MODEL}   cost cap: $${CAP}`);
  console.log(`planned NEW LLM calls (before cache): ${plannedCalls}   rough est: $${(plannedCalls * 0.004).toFixed(2)} (~$0.004/call)`);

  if (!RUN) {
    console.log(`\n--- SAMPLE TREATMENT PROMPT (item 0) ---\n`);
    if (items[0]) console.log(systemPrompt(items[0], true).slice(0, 1600) + '\n...[truncated]');
    console.log(`\nDRY RUN. Re-run with --run to execute. Cache: ${CACHE_DIR}/judge-ab.jsonl (reused across runs).`);
    process.exit(0);
  }

  const cache = loadCache();
  interface Row { it: Item; base: number; treat: number; baseVar: number; treatVar: number; delta: number; anchorMoves: { up: number; down: number }; }
  const rows: Row[] = [];
  let ti = 0;
  async function worker() {
    while (ti < items.length) {
      const it = items[ti++];
      const bScores: Record<string, number>[] = [], tScores: Record<string, number>[] = [];
      for (let v = 0; v < VOTES; v++) { const b = await scoreOnce(it, false, v, cache); if (b) bScores.push(b); }
      for (let v = 0; v < VOTES; v++) { const t = await scoreOnce(it, true, v, cache); if (t) tScores.push(t); }
      if (!bScores.length || !tScores.length) continue;
      const bMeans = bScores.map(meanScore), tMeans = tScores.map(meanScore);
      const base = mean(bMeans), treat = mean(tMeans);
      // anchor-level moves (compare first vote of each condition, deterministic at temp 0)
      let up = 0, down = 0;
      for (const d of it.dims) { const bv = bScores[0][d.id], tv = tScores[0][d.id]; if (tv > bv) up++; else if (tv < bv) down++; }
      rows.push({ it, base, treat, baseVar: sd(bMeans), treatVar: sd(tMeans), delta: treat - base, anchorMoves: { up, down } });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // ---------- report ----------
  const deltas = rows.map((r) => r.delta);
  const down = rows.filter((r) => r.delta < -0.5), up = rows.filter((r) => r.delta > 0.5), flat = rows.filter((r) => Math.abs(r.delta) <= 0.5);
  console.log(`\n----- RESULTS (${rows.length} responses scored) -----`);
  console.log(`LLM calls: ${callCount}   cache hits: ${cacheHits}   spend: $${runningCost.toFixed(2)}`);
  console.log(`\nmean score  BASELINE ${mean(rows.map((r) => r.base)).toFixed(1)}   TREATMENT ${mean(rows.map((r) => r.treat)).toFixed(1)}   mean Δ ${mean(deltas).toFixed(2)}`);
  console.log(`shift direction:  DOWN ${down.length}  (avg ${mean(down.map((r) => r.delta)).toFixed(1)})   `
    + `UP ${up.length}  (avg +${mean(up.map((r) => r.delta)).toFixed(1)})   UNCHANGED ${flat.length}`);
  if (VOTES > 1) console.log(`self-consistency SD (avg over responses):  baseline ${mean(rows.map((r) => r.baseVar)).toFixed(2)}   treatment ${mean(rows.map((r) => r.treatVar)).toFixed(2)}`);
  const anchUp = rows.reduce((a, r) => a + r.anchorMoves.up, 0), anchDown = rows.reduce((a, r) => a + r.anchorMoves.down, 0);
  console.log(`per-dimension anchor moves:  up ${anchUp}   down ${anchDown}`);

  // where does the drop concentrate? (partial-satisfaction hypothesis: high baseline → drops)
  const hi = rows.filter((r) => r.base >= 80), lo = rows.filter((r) => r.base < 60);
  console.log(`\nΔ by baseline band:  high(≥80) n=${hi.length} meanΔ ${mean(hi.map((r) => r.delta)).toFixed(2)}   `
    + `low(<60) n=${lo.length} meanΔ ${mean(lo.map((r) => r.delta)).toFixed(2)}`);

  const topDrop = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 3);
  const topRise = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 3);
  const show = (r: Row) => `  [${r.it.code} R${r.it.round} ${r.it.playerName}] ${r.base.toFixed(0)}→${r.treat.toFixed(0)} (Δ${r.delta > 0 ? '+' : ''}${r.delta.toFixed(0)}): ${r.it.response.replace(/\s+/g, ' ').slice(0, 140)}`;
  console.log(`\nLARGEST DROPS (candidate partial-satisfaction catches):`); topDrop.forEach((r) => console.log(show(r)));
  console.log(`\nLARGEST RISES (candidate requirement-expansion fixes):`); topRise.forEach((r) => console.log(show(r)));
  console.log(`\nInterpretation: clauses working as intended ⇒ high-band meanΔ < 0 (partials pulled down) and`);
  console.log(`some low/mid rises (un-asked-for penalties removed). A large indiscriminate drop everywhere = too strict.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
