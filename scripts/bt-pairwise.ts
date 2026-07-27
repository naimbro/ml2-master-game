/**
 * Fresh LLM pairwise-comparison Bradley–Terry.
 *
 * For each ranked round of a game, samples a set of student-answer pairs, asks
 * gpt-4o (the model the games use) which answer is better head-to-head, fits a
 * new Bradley–Terry ranking from those wins, and compares it against the current
 * weighted-average LLM ranking. Read-only on Firestore. LLM results are cached to
 * scripts/.cache so re-runs are free and the run resumes if the budget stops it.
 *
 * Usage: npx tsx scripts/bt-pairwise.ts [GAME ...]   (defaults to the 6 canonical games)
 * Env:   OPENAI_API_KEY is read from the faction_detection .env (see ENV_PATH).
 */
import admin from 'firebase-admin';
import { writeFileSync, mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { fitBradleyTerryFromWins, fitBradleyTerry, type PlayerResponse, type JudgeWeights } from './lib/bradley-terry';
import { spearmanRho, kendallTau, ranksDescending, linearMatchMoments } from './lib/stats';
import { coerceScore } from './lib/parse';

const PROJECT_ID = 'ml2-master-game';
const ENV_PATH = '/mnt/c/Users/naim.bro.k/Documents/Datos/papers/2026_faction_detection/.env';
const MODEL = 'gpt-4o';
const K = 12;                // target comparisons per student per round
const CONCURRENCY = 8;
const HARD_CAP_USD = 9.0;    // stop scheduling new calls past this actual spend
const CACHE_DIR = 'scripts/.cache';
const DEFAULT_GAMES = ['5XBB57', 'L844V5', 'YZP5MK', 'LUUWFL', '7WZUXF', 'ABNVDL'];
// gpt-4o pricing (USD per token)
const P_IN = 2.5e-6, P_CACHED = 1.25e-6, P_OUT = 1.0e-5;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

function readApiKey(): string {
  const txt = readFileSync(ENV_PATH, 'utf8');
  const m = txt.match(/^OPENAI_API_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error('OPENAI_API_KEY not found in env file');
  return m[1].trim().replace(/^["']|["']$/g, '');
}
const API_KEY = readApiKey();

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// ---------- Firestore loading ----------
interface Sub {
  playerId: string; playerName: string; round: number; response?: string;
  submittedAt?: { toMillis?: () => number };
  evaluation?: { finalScore: number | string; evaluations: { judgeId: string; score: number | string }[] };
}
function dedupeLatest(subs: Sub[]): Sub[] {
  const best = new Map<string, Sub>();
  for (const s of subs) {
    const key = `${s.playerId}__${s.round}`;
    const cur = best.get(key);
    if (!cur) { best.set(key, s); continue; }
    if ((s.submittedAt?.toMillis?.() ?? 0) >= (cur.submittedAt?.toMillis?.() ?? 0)) best.set(key, s);
  }
  return [...best.values()];
}

interface RoundData {
  round: number; title: string; context: string;
  players: { id: string; name: string; response: string; finalScore: number }[];
  derived: PlayerResponse[];   // for the per-judge-derived BT
  weights: JudgeWeights;
}

function compactRubric(rubric: any): string {
  const dims = (rubric?.dimensions || []) as any[];
  if (!dims.length) return '';
  return dims.map((d) => `- ${d.name || d.id}: ${d.description || ''}`).join('\n');
}

async function loadGame(code: string): Promise<{ rounds: RoundData[] } | null> {
  const gameDoc = await db.collection('games').doc(code).get();
  if (!gameDoc.exists) { console.error(`Game ${code} not found`); return null; }
  const game = gameDoc.data()!;
  const scenarios: any[] = game.scenarios || [];
  const weights: JudgeWeights = {};
  (game.sessionConfig?.judges || []).forEach((j: any) => (weights[j.judgeId] = j.weight));
  const rubricText = compactRubric(game.sessionConfig?.rubric);

  const subsSnap = await db.collection('games').doc(code).collection('submissions').get();
  const allSubs = dedupeLatest(subsSnap.docs.map((d) => d.data() as Sub));

  const rounds: RoundData[] = [];
  for (let idx = 0; idx < scenarios.length; idx++) {
    const sc = scenarios[idx];
    const round = idx + 1;
    if (sc?.ranked === false || sc?.type === 'multiple_choice') continue;
    const roundSubs = allSubs.filter((s) => s.round === round);

    const players = roundSubs
      .filter((s) => s.evaluation && typeof s.response === 'string' && s.response.trim().length > 0
        && Number.isFinite(coerceScore(s.evaluation.finalScore)))
      .map((s) => ({ id: s.playerId, name: s.playerName, response: s.response!.trim(), finalScore: coerceScore(s.evaluation!.finalScore) }));
    if (players.length < 2) continue;

    const derived: PlayerResponse[] = players.map((p) => {
      const sub = roundSubs.find((s) => s.playerId === p.id)!;
      return {
        playerId: p.id, playerName: p.name, llmScore: p.finalScore,
        judgeScores: (sub.evaluation!.evaluations || [])
          .map((e) => ({ judgeId: e.judgeId, score: coerceScore(e.score) }))
          .filter((e) => Number.isFinite(e.score)),
      };
    });

    const idealAnswer = sc.idealAnswer ? JSON.stringify(sc.idealAnswer).slice(0, 1200) : '';
    const context = [
      `TAREA: ${sc.title || ''}`,
      sc.context ? `CONTEXTO: ${sc.context}` : '',
      sc.question ? `PREGUNTA: ${typeof sc.question === 'string' ? sc.question : JSON.stringify(sc.question)}` : '',
      rubricText ? `CRITERIOS DE EVALUACION:\n${rubricText}` : '',
      idealAnswer ? `RESPUESTA DE REFERENCIA (nivel esperado): ${idealAnswer}` : '',
    ].filter(Boolean).join('\n\n');

    rounds.push({ round, title: sc.title || `Round ${round}`, context, players, derived, weights });
  }
  return { rounds };
}

// ---------- LLM comparison ----------
interface CallResult { winner: 'A' | 'B' | 'tie'; cost: number; }
let runningCost = 0;
let callCount = 0;
let cachedHits = 0;

function systemPrompt(context: string): string {
  return `Eres un evaluador experto y consistente. A continuacion, la tarea que respondieron dos estudiantes y los criterios de evaluacion.\n\n${context}\n\nSe te mostraran dos respuestas de estudiantes, A y B. Decide cual respuesta es MEJOR segun los criterios. Debes elegir una; no empates salvo que sean verdaderamente indistinguibles. Responde SOLO con JSON valido: {"winner":"A"} o {"winner":"B"}.`;
}

async function callLLM(system: string, a: string, b: string): Promise<CallResult> {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `RESPUESTA A:\n${a}\n\nRESPUESTA B:\n${b}` },
    ],
    temperature: 0,
    max_tokens: 20,
    response_format: { type: 'json_object' },
  };
  let lastErr: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const j: any = await res.json();
      const u = j.usage || {};
      const cached = u.prompt_tokens_details?.cached_tokens || 0;
      const cost = (u.prompt_tokens - cached) * P_IN + cached * P_CACHED + (u.completion_tokens || 0) * P_OUT;
      let winner: 'A' | 'B' | 'tie' = 'tie';
      try {
        const parsed = JSON.parse(j.choices[0].message.content);
        if (parsed.winner === 'A' || parsed.winner === 'B') winner = parsed.winner;
      } catch { /* leave tie */ }
      return { winner, cost };
    } catch (e) { lastErr = e; await sleep(800 * (attempt + 1)); }
  }
  throw lastErr;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- comparison schedule (deterministic circulant graph) ----------
function schedulePairs(ids: string[]): [number, number][] {
  const n = ids.length;
  const m = Math.max(1, Math.min(Math.floor(K / 2), Math.floor((n - 1) / 2)));
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  for (let d = 1; d <= m; d++) {
    for (let i = 0; i < n; i++) {
      const j = (i + d) % n;
      const lo = Math.min(i, j), hi = Math.max(i, j);
      const key = `${lo}-${hi}`;
      if (lo === hi || seen.has(key)) continue;
      seen.add(key);
      pairs.push([lo, hi]);
    }
  }
  return pairs;
}

// ---------- cache ----------
type Cache = Map<string, 'A' | 'B' | 'tie'>;
function loadCache(code: string): Cache {
  const c: Cache = new Map();
  const path = `${CACHE_DIR}/pairwise-${code}.jsonl`;
  if (!existsSync(path)) return c;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); c.set(o.key, o.winner); } catch { /* skip */ }
  }
  return c;
}
function appendCache(code: string, key: string, winner: string) {
  appendFileSync(`${CACHE_DIR}/pairwise-${code}.jsonl`, JSON.stringify({ key, winner }) + '\n');
}

// ---------- per-round run ----------
interface RoundResult {
  round: number; title: string; nPlayers: number; nComparisons: number;
  rows: { name: string; cur: number; curRank: number; btRank: number; derRank: number; delta: number }[];
  rhoVsCurrent: number; tauVsCurrent: number;
  rhoDerivedVsCurrent: number;
  firstWinRate: number; // position-bias diagnostic
  btPoints: Record<string, number>;
}

async function runRound(code: string, rd: RoundData, cache: Cache): Promise<RoundResult> {
  const ids = rd.players.map((p) => p.id);
  const n = ids.length;
  const system = systemPrompt(rd.context);
  const pairs = schedulePairs(ids);
  const wins: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  let firstWins = 0, decided = 0, nComparisons = 0;

  // build task list, honoring cache & budget
  const tasks = pairs.map(([i, j]) => ({ i, j }));
  let ti = 0;
  async function worker() {
    while (ti < tasks.length) {
      const t = tasks[ti++];
      const a = rd.players[t.i], b = rd.players[t.j];
      // deterministic presentation order per pair
      const order = djb2(`${rd.round}|${a.id}|${b.id}`) % 2; // 0: (a,b) 1:(b,a)
      const first = order === 0 ? a : b;
      const second = order === 0 ? b : a;
      const key = `${rd.round}|${first.id}|${second.id}`;
      let winner = cache.get(key);
      if (winner === undefined) {
        if (runningCost >= HARD_CAP_USD) return; // budget stop
        const r = await callLLM(system, first.response, second.response);
        runningCost += r.cost; callCount++;
        winner = r.winner;
        appendCache(code, key, winner);
      } else { cachedHits++; }
      nComparisons++;
      // map winner (A=first, B=second) back to player indices
      if (winner === 'A' || winner === 'B') {
        decided++;
        if (winner === 'A') firstWins++;
        const winId = winner === 'A' ? first.id : second.id;
        const loseId = winner === 'A' ? second.id : first.id;
        wins[ids.indexOf(winId)][ids.indexOf(loseId)] += 1;
      } else {
        wins[t.i][t.j] += 0.5; wins[t.j][t.i] += 0.5;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const bt = fitBradleyTerryFromWins(ids, wins);
  const der = fitBradleyTerry(rd.derived, rd.weights);
  const cur: Record<string, number> = {};
  rd.players.forEach((p) => (cur[p.id] = p.finalScore));
  const curRank = ranksDescending(cur), btRank = ranksDescending(bt.strength), derRank = ranksDescending(der.strength);

  const rows = rd.players
    .map((p) => ({
      name: p.name, cur: p.finalScore, curRank: curRank[p.id],
      btRank: btRank[p.id], derRank: derRank[p.id], delta: curRank[p.id] - btRank[p.id],
    }))
    .sort((x, y) => x.curRank - y.curRank);

  // BT points on the current-score scale, for cumulative aggregation
  const thetas = ids.map((id) => bt.logStrength[id]);
  const curScores = ids.map((id) => cur[id]);
  const pts = linearMatchMoments(thetas, curScores);
  const btPoints: Record<string, number> = {};
  ids.forEach((id, i) => (btPoints[id] = pts[i]));

  return {
    round: rd.round, title: rd.title, nPlayers: n, nComparisons,
    rows, rhoVsCurrent: spearmanRho(cur, bt.strength), tauVsCurrent: kendallTau(cur, bt.strength),
    rhoDerivedVsCurrent: spearmanRho(cur, der.strength),
    firstWinRate: decided ? firstWins / decided : NaN, btPoints,
  };
}

// ---------- main ----------
async function main() {
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_GAMES;
  mkdirSync(CACHE_DIR, { recursive: true });

  const report: any = { games: [] };
  for (const code of codes) {
    const g = await loadGame(code);
    if (!g) continue;
    const cache = loadCache(code);
    const roundResults: RoundResult[] = [];
    for (const rd of g.rounds) {
      if (runningCost >= HARD_CAP_USD) { console.log(`\n!! Budget cap ${HARD_CAP_USD} reached — stopping.`); break; }
      process.stdout.write(`  ${code} R${rd.round} (${rd.players.length} players)… `);
      const rr = await runRound(code, rd, cache);
      console.log(`ρ=${fmt(rr.rhoVsCurrent)} τ=${fmt(rr.tauVsCurrent)}  (${rr.nComparisons} comps, posBias firstWin=${fmt(rr.firstWinRate)})  spend=$${runningCost.toFixed(2)}`);
      roundResults.push(rr);
    }
    // cumulative
    const curTotal: Record<string, number> = {}, btTotal: Record<string, number> = {}, nameById: Record<string, string> = {};
    for (const rr of roundResults) for (const row of rr.rows) { /* names set below */ }
    for (const rd of g.rounds) for (const p of rd.players) nameById[p.id] = p.name;
    for (const rr of roundResults) {
      for (const id of Object.keys(rr.btPoints)) btTotal[id] = (btTotal[id] || 0) + rr.btPoints[id];
    }
    for (const rd of g.rounds) for (const p of rd.players) curTotal[p.id] = (curTotal[p.id] || 0) + p.finalScore;
    // only keep players present in btTotal (rounds actually run)
    for (const id of Object.keys(curTotal)) if (!(id in btTotal)) delete curTotal[id];
    report.games.push({ code, roundResults, curTotal, btTotal, nameById,
      overallRho: spearmanRho(curTotal, btTotal), overallTau: kendallTau(curTotal, btTotal) });
  }

  writeReport(report);
  console.log(`\n===== DONE =====`);
  console.log(`LLM calls: ${callCount}  cache hits: ${cachedHits}  total spend: $${runningCost.toFixed(2)}`);
  for (const g of report.games) console.log(`  ${g.code}: overall pairwise-BT vs current  ρ=${fmt(g.overallRho)} τ=${fmt(g.overallTau)}`);
  console.log(`\nHTML report: bt-pairwise-report.html`);
}

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');

function writeReport(report: any) {
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const games = report.games.map((g: any) => {
    const overallRows = Object.keys(g.btTotal)
      .map((id) => ({ id, name: g.nameById[id], cur: g.curTotal[id], bt: g.btTotal[id] }))
      .sort((a, b) => b.cur - a.cur);
    const curR = ranksDescending(Object.fromEntries(overallRows.map((r) => [r.id, r.cur])));
    const btR = ranksDescending(Object.fromEntries(overallRows.map((r) => [r.id, r.bt])));
    const oRows = overallRows.map((r) => {
      const d = curR[r.id] - btR[r.id];
      const dc = d === 0 ? '<td>0</td>' : `<td style="color:${d > 0 ? '#059669' : '#dc2626'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}</td>`;
      return `<tr><td>${esc(r.name)}</td><td>${Math.round(r.cur)}</td><td>${curR[r.id]}</td><td>${btR[r.id]}</td>${dc}</tr>`;
    }).join('');
    const rounds = g.roundResults.map((rr: any) => {
      const rows = rr.rows.map((row: any) => {
        const d = row.delta;
        const dc = d === 0 ? '<td>0</td>' : `<td style="color:${d > 0 ? '#059669' : '#dc2626'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}</td>`;
        return `<tr><td>${esc(row.name)}</td><td>${Math.round(row.cur)}</td><td>${row.curRank}</td><td>${row.btRank}</td>${dc}<td>${row.derRank}</td></tr>`;
      }).join('');
      return `<section><h3>Round ${rr.round} — ${esc(rr.title)}</h3>
      <p class=s>pairwise-BT vs current: Spearman ρ=<b>${fmt(rr.rhoVsCurrent)}</b>, Kendall τ=<b>${fmt(rr.tauVsCurrent)}</b> ·
      ${rr.nComparisons} comparisons · position-bias (first-answer win rate)=${fmt(rr.firstWinRate)} ·
      derived-BT vs current ρ=${fmt(rr.rhoDerivedVsCurrent)}</p>
      <table><thead><tr><th>Player</th><th>Current score</th><th>Current rank</th><th>Pairwise-BT rank</th><th>Δrank</th><th>Derived-BT rank</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }).join('');
    return `<section><h2>Game ${esc(g.code)}</h2>
      <p class=v>Overall (cumulative): fresh pairwise-BT vs current ranking — Spearman ρ=<b>${fmt(g.overallRho)}</b>, Kendall τ=<b>${fmt(g.overallTau)}</b></p>
      <table><thead><tr><th>Player</th><th>Current total</th><th>Current rank</th><th>Pairwise-BT rank</th><th>Δrank</th></tr></thead><tbody>${oRows}</tbody></table>
      ${rounds}</section>`;
  }).join('');
  const html = `<!doctype html><html lang=es><head><meta charset=utf-8><meta name=viewport content="width=device-width, initial-scale=1">
  <title>Pairwise-BT vs current ranking</title><style>
  body{font:15px/1.5 system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#1a1a2e}
  h2{margin-top:2.5rem;border-top:2px solid #cbd5e1;padding-top:1rem}h3{font-size:1rem;margin-top:1.5rem}
  .v{background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:.6rem .9rem;font-size:1.05rem}
  .s{color:#475569}table{border-collapse:collapse;width:100%;margin-top:.4rem}
  th,td{padding:.35rem .6rem;text-align:right;border-bottom:1px solid #e2e8f0}th:first-child,td:first-child{text-align:left}
  @media(prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}.v{background:#1e293b;border-color:#334155}th,td{border-color:#334155}.s{color:#94a3b8}}
  </style></head><body>
  <h1>Fresh LLM pairwise Bradley–Terry vs current ranking</h1>
  <p class=s>Model: ${MODEL} · ${K} comparisons/student/round · total LLM calls: ${callCount} · spend: $${runningCost.toFixed(2)}.
  "Current rank" = the game's weighted-average LLM score. "Pairwise-BT" = a new ranking from fresh head-to-head LLM judgments.
  "Derived-BT" = BT from the stored per-judge scores (the earlier method). Δrank&gt;0 means pairwise-BT ranks the student higher than the current system.</p>
  ${games}</body></html>`;
  writeFileSync('bt-pairwise-report.html', html);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
