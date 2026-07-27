/**
 * Offline calibration for the dramatic per-round recalibration (see
 * docs/superpowers/specs/2026-07-04-dramatic-recalibration-design.md).
 *
 * Uses the Swiss / score-adjacency schedule + the anchored BT fit, and sweeps
 * band width B and anchor weight w_anchor (λ = 1/w_anchor) over the canonical
 * games to find the setting that is dramatic (students move) yet stable
 * (movement reproduces on a split-half, i.e. it is signal not sampling noise).
 *
 * Fresh gpt-4o comparisons are cached to scripts/.cache/calib-<game>.jsonl.
 * Read-only on Firestore. Usage: npx tsx scripts/bt-calibrate.ts [GAME ...]
 */
import admin from 'firebase-admin';
import { writeFileSync, mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { fitBradleyTerryFromWins } from './lib/bradley-terry';
import { spearmanRho, ranksDescending, linearMatchMoments } from './lib/stats';
import { coerceScore } from './lib/parse';

const PROJECT_ID = 'ml2-master-game';
const ENV_PATH = '/mnt/c/Users/naim.bro.k/Documents/Datos/papers/2026_faction_detection/.env';
const MODEL = 'gpt-4o';
const BMAX = 5;              // widest band we sample (subset for smaller B)
const B_GRID = [3, 4, 5];
const WANCHOR_GRID = [1.0, 0.5, 0.25, 0.1]; // λ = 1/w_anchor  → {1,2,4,10}
const CONCURRENCY = 8;
const HARD_CAP_USD = 8.0;
const CACHE_DIR = 'scripts/.cache';
const DEFAULT_GAMES = ['5XBB57', 'L844V5', 'YZP5MK', 'LUUWFL', '7WZUXF', 'ABNVDL'];
const P_IN = 2.5e-6, P_CACHED = 1.25e-6, P_OUT = 1.0e-5;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const API_KEY = (() => {
  const m = readFileSync(ENV_PATH, 'utf8').match(/^OPENAI_API_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error('OPENAI_API_KEY not found');
  return m[1].trim().replace(/^["']|["']$/g, '');
})();

const djb2 = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');

// ---------- Firestore ----------
interface Sub { playerId: string; playerName: string; round: number; response?: string;
  submittedAt?: { toMillis?: () => number };
  evaluation?: { finalScore: number | string }; }
function dedupeLatest(subs: Sub[]): Sub[] {
  const best = new Map<string, Sub>();
  for (const s of subs) { const k = `${s.playerId}__${s.round}`; const c = best.get(k);
    if (!c || (s.submittedAt?.toMillis?.() ?? 0) >= (c.submittedAt?.toMillis?.() ?? 0)) best.set(k, s); }
  return [...best.values()];
}
interface Player { id: string; name: string; response: string; prov: number; }
interface RoundData { round: number; title: string; context: string; players: Player[]; }

function compactRubric(r: any): string {
  const d = (r?.dimensions || []) as any[];
  return d.length ? d.map((x) => `- ${x.name || x.id}: ${x.description || ''}`).join('\n') : '';
}
async function loadGame(code: string): Promise<RoundData[]> {
  const g = (await db.collection('games').doc(code).get()).data();
  if (!g) { console.error(`Game ${code} not found`); return []; }
  const scenarios: any[] = g.scenarios || [];
  const rubric = compactRubric(g.sessionConfig?.rubric);
  const subs = dedupeLatest((await db.collection('games').doc(code).collection('submissions').get()).docs.map((d) => d.data() as Sub));
  const rounds: RoundData[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i]; const round = i + 1;
    if (sc?.ranked === false || sc?.type === 'multiple_choice') continue;
    const players = subs.filter((s) => s.round === round && s.evaluation && typeof s.response === 'string'
      && s.response.trim() && Number.isFinite(coerceScore(s.evaluation.finalScore)))
      .map((s) => ({ id: s.playerId, name: s.playerName, response: s.response!.trim(), prov: coerceScore(s.evaluation!.finalScore) }));
    if (players.length < 4) continue;
    const ideal = sc.idealAnswer ? JSON.stringify(sc.idealAnswer).slice(0, 1200) : '';
    const context = [`TAREA: ${sc.title || ''}`, sc.context ? `CONTEXTO: ${sc.context}` : '',
      sc.question ? `PREGUNTA: ${typeof sc.question === 'string' ? sc.question : JSON.stringify(sc.question)}` : '',
      rubric ? `CRITERIOS:\n${rubric}` : '', ideal ? `REFERENCIA: ${ideal}` : ''].filter(Boolean).join('\n\n');
    rounds.push({ round, title: sc.title || `R${round}`, context, players });
  }
  return rounds;
}

// ---------- LLM ----------
let runningCost = 0, callCount = 0, cacheHits = 0;
async function callLLM(system: string, a: string, b: string): Promise<'A' | 'B' | 'tie'> {
  const body = { model: MODEL, temperature: 0, max_tokens: 20, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: `RESPUESTA A:\n${a}\n\nRESPUESTA B:\n${b}` }] };
  let lastErr: any;
  for (let att = 0; att < 4; att++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` }, body: JSON.stringify(body) });
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * (att + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: any = await res.json(); const u = j.usage || {};
      const cached = u.prompt_tokens_details?.cached_tokens || 0;
      runningCost += (u.prompt_tokens - cached) * P_IN + cached * P_CACHED + (u.completion_tokens || 0) * P_OUT;
      try { const w = JSON.parse(j.choices[0].message.content).winner; if (w === 'A' || w === 'B') return w; } catch { /* tie */ }
      return 'tie';
    } catch (e) { lastErr = e; await sleep(800 * (att + 1)); }
  }
  throw lastErr;
}
function systemPrompt(ctx: string): string {
  return `Eres un evaluador experto y consistente. Tarea y criterios:\n\n${ctx}\n\nSe te muestran dos respuestas (A y B). Elige la MEJOR segun los criterios; no empates salvo que sean indistinguibles. Responde SOLO JSON: {"winner":"A"} o {"winner":"B"}.`;
}

// ---------- cache ----------
function loadCache(code: string): Map<string, 'A' | 'B' | 'tie'> {
  const c = new Map<string, 'A' | 'B' | 'tie'>(); const p = `${CACHE_DIR}/calib-${code}.jsonl`;
  if (existsSync(p)) for (const l of readFileSync(p, 'utf8').split('\n')) { if (!l.trim()) continue; try { const o = JSON.parse(l); c.set(o.key, o.winner); } catch { /**/ } }
  return c;
}
const appendCache = (code: string, key: string, winner: string) => appendFileSync(`${CACHE_DIR}/calib-${code}.jsonl`, JSON.stringify({ key, winner }) + '\n');

// ---------- Swiss band schedule + comparisons ----------
interface Duel { i: number; j: number; d: number; winId: string; } // i,j = index into round.players; d = sorted-rank gap
async function duelsForRound(code: string, rd: RoundData, cache: Map<string, 'A' | 'B' | 'tie'>): Promise<Duel[]> {
  const sorted = [...rd.players].map((p, idx) => ({ p, idx })).sort((x, y) => y.p.prov - x.p.prov || (x.p.id < y.p.id ? -1 : 1));
  const n = sorted.length;
  const pairs: { a: number; b: number; d: number }[] = []; // a,b = original indices
  for (let d = 1; d <= Math.min(BMAX, n - 1); d++)
    for (let k = 0; k + d < n; k++) pairs.push({ a: sorted[k].idx, b: sorted[k + d].idx, d });
  const system = systemPrompt(rd.context);
  const out: Duel[] = new Array(pairs.length);
  let ti = 0;
  async function worker() {
    while (ti < pairs.length) {
      const idx = ti++; const { a, b, d } = pairs[idx];
      const pa = rd.players[a], pb = rd.players[b];
      const order = djb2(`${rd.round}|${pa.id}|${pb.id}`) % 2;      // deterministic presentation order
      const first = order === 0 ? pa : pb, second = order === 0 ? pb : pa;
      const key = `${rd.round}|${first.id}|${second.id}`;
      let w = cache.get(key);
      if (w === undefined) {
        if (runningCost >= HARD_CAP_USD) { out[idx] = { i: a, j: b, d, winId: '' }; continue; }
        w = await callLLM(system, first.response, second.response); callCount++;
        appendCache(code, key, w); cache.set(key, w);
      } else cacheHits++;
      const winId = w === 'A' ? first.id : w === 'B' ? second.id : '';
      out[idx] = { i: a, j: b, d, winId };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out.filter((x) => x.winId !== '' || x.d >= 0); // keep all resolved; ties handled downstream
}

// ---------- anchored BT recalibration ----------
function recalibrate(rd: RoundData, duels: Duel[], B: number, wAnchor: number, half?: 0 | 1): Record<string, number> {
  const ids = rd.players.map((p) => p.id);
  const n = ids.length;
  const wins: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  // fresh pairwise (band ≤ B), optional split-half filter
  for (const dl of duels) {
    if (dl.d > B || !dl.winId) continue;
    if (half !== undefined && (djb2(`${rd.round}|${ids[dl.i]}|${ids[dl.j]}`) % 2) !== half) continue;
    const wi = ids.indexOf(dl.winId), li = wi === dl.i ? dl.j : dl.i;
    wins[wi][li] += 1;
  }
  // anchor: derived from provisional scores over ALL pairs
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const di = rd.players[i].prov - rd.players[j].prov;
    if (di > 0) wins[i][j] += wAnchor; else if (di < 0) wins[j][i] += wAnchor;
    else { wins[i][j] += wAnchor / 2; wins[j][i] += wAnchor / 2; }
  }
  const bt = fitBradleyTerryFromWins(ids, wins);
  // moment-match θ to provisional score scale → recalibrated score
  const thetas = ids.map((id) => bt.logStrength[id]);
  const provs = rd.players.map((p) => p.prov);
  const rescaled = linearMatchMoments(thetas, provs);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => (out[id] = rescaled[i]));
  return out;
}

// ---------- main ----------
async function main() {
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_GAMES;
  mkdirSync(CACHE_DIR, { recursive: true });

  // gather duels for every round once (at BMAX)
  const allRounds: { code: string; rd: RoundData; duels: Duel[] }[] = [];
  for (const code of codes) {
    const rounds = await loadGame(code);
    const cache = loadCache(code);
    for (const rd of rounds) {
      if (runningCost >= HARD_CAP_USD) { console.log(`\n!! budget cap reached at $${runningCost.toFixed(2)}`); break; }
      process.stdout.write(`  comparing ${code} R${rd.round} (${rd.players.length}p)… `);
      const duels = await duelsForRound(code, rd, cache);
      console.log(`${duels.length} duels · spend $${runningCost.toFixed(2)}`);
      allRounds.push({ code, rd, duels });
    }
  }

  // sweep (B, w_anchor)
  interface Cell { B: number; w: number; lambda: number; avgMove: number; maxMove: number; pctMoved: number; stability: number; rhoVsProv: number; }
  const cells: Cell[] = [];
  for (const B of B_GRID) for (const w of WANCHOR_GRID) {
    let sumMove = 0, cnt = 0, maxMove = 0, moved = 0, total = 0, stabSum = 0, stabN = 0, rhoSum = 0, rhoN = 0;
    for (const { rd, duels } of allRounds) {
      const prov: Record<string, number> = {}; rd.players.forEach((p) => (prov[p.id] = p.prov));
      const recal = recalibrate(rd, duels, B, w);
      const provRank = ranksDescending(prov), recalRank = ranksDescending(recal);
      for (const id of Object.keys(prov)) { const mv = Math.abs(provRank[id] - recalRank[id]); sumMove += mv; cnt++; total++; if (mv > 0) moved++; if (mv > maxMove) maxMove = mv; }
      const rho = spearmanRho(prov, recal); if (Number.isFinite(rho)) { rhoSum += rho; rhoN++; }
      // split-half stability
      const hA = recalibrate(rd, duels, B, w, 0), hB = recalibrate(rd, duels, B, w, 1);
      const s = spearmanRho(hA, hB); if (Number.isFinite(s)) { stabSum += s; stabN++; }
    }
    cells.push({ B, w, lambda: 1 / w, avgMove: sumMove / cnt, maxMove, pctMoved: moved / total, stability: stabSum / stabN, rhoVsProv: rhoSum / rhoN });
  }

  // report
  console.log(`\n===== CALIBRATION (Swiss band + anchored BT) =====`);
  console.log(`LLM calls: ${callCount}  cache hits: ${cacheHits}  spend: $${runningCost.toFixed(2)}  rounds: ${allRounds.length}\n`);
  console.log('  B   w_anchor  λ     avg|Δrank|  max|Δrank|  %moved   stability(split-half ρ)   recalVsProv ρ');
  for (const c of cells)
    console.log(`  ${c.B}   ${c.w.toFixed(2).padStart(5)}   ${String(c.lambda).padStart(4)}   ${fmt(c.avgMove).padStart(8)}    ${String(c.maxMove).padStart(6)}    ${(c.pctMoved * 100).toFixed(0).padStart(4)}%        ${fmt(c.stability).padStart(6)}                  ${fmt(c.rhoVsProv)}`);

  writeFileSync('bt-calibration.json', JSON.stringify({ generatedFrom: codes, rounds: allRounds.length, callCount, spend: runningCost, cells }, null, 2));
  console.log(`\nWrote bt-calibration.json. Aim: high drama (avg|Δrank| up, %moved up) with high stability (split-half ρ ≳ 0.9).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
