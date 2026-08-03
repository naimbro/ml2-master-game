/**
 * ¿Cuántas comparaciones por alumno necesita el Bradley-Terry anclado?
 *
 * La pregunta no es cuántos duelos en total: el schedule Swiss ya es lineal en
 * el número de alumnos (`B·n - B(B+1)/2` pares), así que las comparaciones por
 * alumno son `2B - B(B+1)/n`, o sea ~2B y casi constantes en n. Subir o bajar B
 * es LA decisión, y el total de duelos es su consecuencia.
 *
 * La teoría (Negahban–Oh–Shah 2012; Hajek–Oh–Xu 2014) dice que recuperar un
 * orden completo desde cero pide Θ(log n) comparaciones por ítem, y en la
 * práctica 10-15. Nosotros no partimos de cero: `w_anchor` mete pseudo-votos
 * sobre TODOS los pares, así que los duelos solo tienen que mover gente dentro
 * de ±B posiciones. Cuánto alcanza con ese ancla es una pregunta empírica, y
 * este script la contesta con los duelos que ya pagamos.
 *
 * Método: para cada ancho de banda B se ajusta el BT anclado y se mide
 *   - estabilidad split-half: se parten los duelos en dos mitades por hash del
 *     par, se ajusta cada una y se correlaciona (Spearman). Alto = el
 *     movimiento es señal; bajo = es ruido de muestreo.
 *   - acuerdo con la referencia: correlación contra el ajuste que usa TODO el
 *     pool (B=5, ~10 comparaciones por alumno). Es la curva de convergencia.
 *   - cuánta gente se mueve respecto del puntaje de los jueces. Sin movimiento
 *     no hay recalibración que mostrar.
 *
 * SOLO lee del caché `scripts/.cache/calib-*.jsonl` (2.910 veredictos reales de
 * gpt-4o, los dos órdenes) y de Firestore. NO llama a ninguna API: correrlo no
 * cuesta nada. Si falta un par en el caché se reporta la cobertura y se sigue.
 *
 * Uso:  npx tsx scripts/bt-comparisons-per-student.ts [GAME ...]
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { fitBradleyTerryFromWins } from './lib/bradley-terry';
import { spearmanRho, ranksDescending, linearMatchMoments } from './lib/stats';
import { coerceScore } from './lib/parse';

const PROJECT_ID = 'ml2-master-game';
const BMAX = 5;
const B_GRID = [1, 2, 3, 4, 5];
const W_ANCHOR = 0.35; // el de producción (RECAL_W_ANCHOR)
const CACHE_DIR = 'scripts/.cache';
const DEFAULT_GAMES = ['5XBB57', 'L844V5', 'YZP5MK', 'LUUWFL', '7WZUXF', 'ABNVDL'];

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const djb2 = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
};
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : ' n/a');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

// ---------------------------------------------------------------- Firestore
interface Player { id: string; response: string; prov: number }
interface RoundData { code: string; round: number; title: string; players: Player[] }

async function loadGame(code: string): Promise<RoundData[]> {
  const g = (await db.collection('games').doc(code).get()).data();
  if (!g) { console.error(`Juego ${code} no encontrado`); return []; }
  const scenarios: any[] = g.scenarios || [];
  const subsSnap = await db.collection('games').doc(code).collection('submissions').get();
  const subs = subsSnap.docs.map((d) => d.data() as any);

  const rounds: RoundData[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i];
    const round = i + 1;
    if (sc?.ranked === false || sc?.type === 'multiple_choice') continue;
    const players: Player[] = subs
      .filter((s) => s.round === round && s.evaluation && typeof s.response === 'string'
        && s.response.trim() && Number.isFinite(coerceScore(s.evaluation.finalScore)))
      .map((s) => ({ id: s.playerId, response: s.response.trim(), prov: coerceScore(s.evaluation.finalScore) }));
    if (players.length < 6) continue; // con menos de 6 la banda B=5 no tiene de dónde sacar
    rounds.push({ code, round, title: sc.title || `R${round}`, players });
  }
  return rounds;
}

// ---------------------------------------------------------------- caché
function loadCache(code: string): Map<string, 'A' | 'B' | 'tie'> {
  const out = new Map<string, 'A' | 'B' | 'tie'>();
  const path = `${CACHE_DIR}/calib-${code}.jsonl`;
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); out.set(o.key, o.winner); } catch { /* linea rota */ }
  }
  return out;
}

// ---------------------------------------------------------------- duelos
/** `winner`: índice en `players`, o -1 si es empate (incluye los dos órdenes en desacuerdo). */
interface Duel { i: number; j: number; d: number; winner: number; key: string }

/** Los pares del schedule Swiss hasta BMAX, resueltos con doble orden desde el caché. */
function duelsFromCache(rd: RoundData, cache: Map<string, 'A' | 'B' | 'tie'>) {
  const order = rd.players
    .map((p, idx) => idx)
    .sort((a, b) => rd.players[b].prov - rd.players[a].prov || (rd.players[a].id < rd.players[b].id ? -1 : 1));
  const n = order.length;

  const duels: Duel[] = [];
  let wanted = 0, missing = 0;
  for (let d = 1; d <= Math.min(BMAX, n - 1); d++) {
    for (let k = 0; k + d < n; k++) {
      const i = order[k], j = order[k + d];
      const a = rd.players[i], b = rd.players[j];
      wanted++;
      const fwd = cache.get(`${rd.round}|${a.id}|${b.id}`);
      const rev = cache.get(`${rd.round}|${b.id}|${a.id}`);
      if (fwd === undefined || rev === undefined) { missing++; continue; }
      // Regla LCES, la misma de producción: solo cuenta si los dos órdenes
      // deciden Y coinciden. Si se contradicen, el par es empate.
      const fwdWin = fwd === 'A' ? i : fwd === 'B' ? j : -1;
      const revWin = rev === 'A' ? j : rev === 'B' ? i : -1;
      const winner = fwdWin !== -1 && fwdWin === revWin ? fwdWin : -1;
      duels.push({ i, j, d, winner, key: `${rd.round}|${a.id}|${b.id}` });
    }
  }
  return { duels, wanted, missing };
}

// ---------------------------------------------------------------- ajuste
/** BT anclado, igual que functions/src/lib/recalibration.ts. `half` filtra por hash del par. */
function recalibrate(rd: RoundData, duels: Duel[], B: number, half?: 0 | 1): Record<string, number> {
  const ids = rd.players.map((p) => p.id);
  const n = ids.length;
  const wins: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (const dl of duels) {
    if (dl.d > B) continue;
    if (half !== undefined && (djb2(dl.key) % 2) !== half) continue;
    if (dl.winner === -1) { wins[dl.i][dl.j] += 0.5; wins[dl.j][dl.i] += 0.5; }
    else { const lose = dl.winner === dl.i ? dl.j : dl.i; wins[dl.winner][lose] += 1; }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = rd.players[i].prov - rd.players[j].prov;
      if (diff > 0) wins[i][j] += W_ANCHOR;
      else if (diff < 0) wins[j][i] += W_ANCHOR;
      else { wins[i][j] += W_ANCHOR / 2; wins[j][i] += W_ANCHOR / 2; }
    }
  }

  const bt = fitBradleyTerryFromWins(ids, wins);
  const rescaled = linearMatchMoments(ids.map((id) => bt.logStrength[id]), rd.players.map((p) => p.prov));
  const out: Record<string, number> = {};
  ids.forEach((id, i) => (out[id] = rescaled[i]));
  return out;
}

const rhoBetween = (a: Record<string, number>, b: Record<string, number>, ids: string[]) =>
  spearmanRho(ids.map((id) => a[id]), ids.map((id) => b[id]));

// ---------------------------------------------------------------- main
async function main() {
  const codes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_GAMES;

  const rounds: { rd: RoundData; duels: Duel[] }[] = [];
  let wantedAll = 0, missingAll = 0;
  for (const code of codes) {
    const cache = loadCache(code);
    for (const rd of await loadGame(code)) {
      const { duels, wanted, missing } = duelsFromCache(rd, cache);
      wantedAll += wanted; missingAll += missing;
      if (duels.length >= 10) rounds.push({ rd, duels });
    }
  }

  if (rounds.length === 0) {
    console.log('No hay rondas con duelos cacheados. Corre antes scripts/bt-calibrate.ts.');
    return;
  }

  const ns = rounds.map((r) => r.rd.players.length);
  console.log(`\nRondas: ${rounds.length} de ${codes.length} juegos · alumnos por ronda: ${Math.min(...ns)}-${Math.max(...ns)} (mediana ${ns.sort((a, b) => a - b)[ns.length >> 1]})`);
  console.log(`Pares del caché: ${wantedAll - missingAll} de ${wantedAll} (${fmt(100 * (1 - missingAll / wantedAll), 1)} % de cobertura), doble orden.`);
  console.log(`w_anchor = ${W_ANCHOR} (el de producción). Referencia = ajuste con TODO el pool (B=${BMAX}).\n`);

  const reference = rounds.map(({ rd, duels }) => recalibrate(rd, duels, BMAX));

  const header = 'banda  comp/alumno  decisivas  empates   estab. split-half   ρ vs referencia   se mueve   |Δpos|';
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const B of B_GRID) {
    const perStudent: number[] = [], decisive: number[] = [], tieRate: number[] = [];
    const split: number[] = [], vsRef: number[] = [], moved: number[] = [], drift: number[] = [];

    rounds.forEach(({ rd, duels }, k) => {
      const ids = rd.players.map((p) => p.id);
      const n = ids.length;
      const used = duels.filter((d) => d.d <= B);
      if (used.length < 3) return;

      const decided = used.filter((d) => d.winner !== -1).length;
      perStudent.push((2 * used.length) / n);
      decisive.push((2 * decided) / n);
      tieRate.push(1 - decided / used.length);

      const full = recalibrate(rd, used, B);
      const h0 = recalibrate(rd, used, B, 0);
      const h1 = recalibrate(rd, used, B, 1);
      split.push(rhoBetween(h0, h1, ids));
      vsRef.push(rhoBetween(full, reference[k], ids));

      const provRank = ranksDescending(Object.fromEntries(rd.players.map((p) => [p.id, p.prov])));
      const newRank = ranksDescending(full);
      moved.push(ids.filter((id) => provRank[id] !== newRank[id]).length / n);
      drift.push(mean(ids.map((id) => Math.abs(provRank[id] - newRank[id]))));
    });

    console.log(
      `  B=${B}` +
      `${fmt(mean(perStudent), 1).padStart(11)}` +
      `${fmt(mean(decisive), 1).padStart(11)}` +
      `${(fmt(100 * mean(tieRate), 0) + ' %').padStart(9)}` +
      `${fmt(mean(split), 3).padStart(19)}` +
      `${fmt(mean(vsRef), 3).padStart(18)}` +
      `${(fmt(100 * mean(moved), 0) + ' %').padStart(11)}` +
      `${fmt(mean(drift), 2).padStart(9)}`,
    );
  }

  console.log(`
Cómo leerla:
  comp/alumno       2B - B(B+1)/n. Es la magnitud que la teoría acota.
  decisivas         las que no terminaron en empate. Son las que de verdad reordenan.
  estab. split-half ρ entre dos mitades independientes de los mismos duelos. Es la
                    pregunta "si corriera la ronda de nuevo, ¿saldría el mismo orden?".
  ρ vs referencia   acuerdo con el ajuste que usa todo el pool. Es la curva de
                    convergencia: cuando se aplana, más comparaciones no compran nada.
  se mueve / |Δpos| cuánta gente cambia de puesto respecto del puntaje de los jueces.
                    Sin movimiento no hay nada que revelar en pantalla.
`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
