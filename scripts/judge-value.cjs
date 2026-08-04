#!/usr/bin/env node
/**
 * ¿Cuánto aporta cada juez, y cuánto aportan los duelos?
 *
 *   node scripts/judge-value.cjs <gameCode>
 *
 * Contesta la pregunta de "si saco esto, ¿qué pierdo?" con los datos de una
 * partida ya jugada, en vez de estimarlo:
 *
 *  - DUELOS: cada `rounds/round_N` guarda `provRank` (el orden que dejaron los
 *    jueces) y `rank` (el orden después de la recalibración pareada). Comparar
 *    los dos es medir exactamente lo que los duelos movieron.
 *  - JUECES: cada submission guarda los tres puntajes por separado, así que se
 *    puede recalcular el ranking sacando a uno y ver cuánto cambia el resultado.
 *
 * LÍMITE IMPORTANTE, y hay que decirlo cada vez: esto mide INFLUENCIA, no
 * ACIERTO. Que sacar un juez casi no mueva el ranking significa que ese juez
 * aporta poca señal propia — NO significa que el ranking resultante sea igual
 * de correcto. Para saber si es mejor o peor hace falta un set etiquetado por
 * un humano, que es justamente lo que está pendiente desde julio de 2026.
 */
const admin = require('firebase-admin');

const gameCode = process.argv[2];
if (!gameCode) {
  console.error('uso: node scripts/judge-value.cjs <gameCode>');
  process.exit(1);
}

admin.initializeApp({ projectId: 'ml2-master-game' });
const db = admin.firestore();

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Spearman = Pearson sobre rangos. Empates promediados. */
function spearman(a, b) {
  const n = a.length;
  if (n < 2) return NaN;
  const rank = (xs) => {
    const idx = xs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a), rb = rank(b);
  const m = (xs) => xs.reduce((s, x) => s + x, 0) / n;
  const ma = m(ra), mb = m(rb);
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  return cov / Math.sqrt(va * vb);
}

/** Posiciones 1..n a partir de puntajes, mayor primero, empate = mismo puesto. */
function toRanks(entries) {
  const sorted = [...entries].sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
  const pos = new Map();
  let p = 1;
  sorted.forEach((e, i) => {
    if (i > 0 && e.score < sorted[i - 1].score) p = i + 1;
    pos.set(e.id, p);
  });
  return pos;
}

(async () => {
  const g = db.collection('games').doc(gameCode);
  const gd = (await g.get()).data();
  if (!gd) { console.error(`no existe el juego ${gameCode}`); process.exit(1); }

  const weights = {};
  for (const j of gd.sessionConfig?.judges || []) weights[j.judgeId] = Number(j.weight) || 0;

  const subs = (await g.collection('submissions').get()).docs.map((d) => d.data());
  const roundDocs = (await g.collection('rounds').get()).docs;

  console.log(`\n${gameCode} — ${gd.courseId}/${gd.sessionId}`);
  console.log(`pesos del panel: ${Object.entries(weights).map(([k, v]) => `${k}=${v}`).join('  ')}`);

  // ---------------------------------------------------------------- DUELOS
  console.log('\n=== QUÉ MUEVEN LOS DUELOS (provRank -> rank, medido) ===');
  console.log('ronda | n  | Spearman | cambian puesto | |Δ| medio | top-5 que cambia | nuevo 1º');
  let totMoved = 0, totN = 0;
  for (const doc of roundDocs.sort((a, b) => a.id.localeCompare(b.id))) {
    const rd = doc.data();
    const rows = (rd.rankings || []).filter((r) => num(r.provRank) !== null && num(r.rank) !== null);
    if (rows.length < 2) continue;
    const prov = rows.map((r) => -num(r.provRank));
    const fin = rows.map((r) => -num(r.rank));
    const rho = spearman(prov, fin);
    const moved = rows.filter((r) => num(r.provRank) !== num(r.rank)).length;
    const meanAbs = rows.reduce((s, r) => s + Math.abs(num(r.provRank) - num(r.rank)), 0) / rows.length;
    const top5antes = new Set(rows.filter((r) => num(r.provRank) <= 5).map((r) => r.playerId));
    const top5despues = rows.filter((r) => num(r.rank) <= 5).map((r) => r.playerId);
    const entran = top5despues.filter((p) => !top5antes.has(p)).length;
    const primeroAntes = rows.find((r) => num(r.provRank) === 1);
    const primeroDespues = rows.find((r) => num(r.rank) === 1);
    const cambioPrimero = primeroAntes && primeroDespues && primeroAntes.playerId !== primeroDespues.playerId;
    totMoved += moved; totN += rows.length;
    console.log(
      `  ${doc.id.replace('round_', 'R')}  | ${String(rows.length).padStart(2)} |   ${rho.toFixed(3)}  |` +
      `      ${String(moved).padStart(2)} (${String(Math.round((100 * moved) / rows.length)).padStart(3)}%) |` +
      `   ${meanAbs.toFixed(2)}    |        ${entran}         | ${cambioPrimero ? 'SÍ' : 'no'}`
    );
  }
  if (totN) console.log(`  en total, ${totMoved} de ${totN} posiciones cambiaron (${Math.round((100 * totMoved) / totN)}%)`);

  // ---------------------------------------------------------------- JUECES
  console.log('\n=== QUÉ APORTA CADA JUEZ (sacarlo y recalcular) ===');

  const porRonda = new Map();
  for (const s of subs) {
    if (!s.evaluation || !Array.isArray(s.evaluation.evaluations)) continue;
    const byJudge = {};
    for (const e of s.evaluation.evaluations) {
      const sc = num(e.score);
      if (sc !== null && !e.failed) byJudge[e.judgeId] = sc;
    }
    if (Object.keys(byJudge).length === 0) continue;
    if (!porRonda.has(s.round)) porRonda.set(s.round, []);
    porRonda.get(s.round).push({ id: s.playerId, byJudge });
  }

  const judgeIds = Object.keys(weights);
  const modelOf = {};
  for (const s of subs) for (const e of s.evaluation?.evaluations || []) modelOf[e.judgeId] = `${e.provider}/${e.model}`;

  const panel = (byJudge, excluir) => {
    let acc = 0, w = 0;
    for (const jid of judgeIds) {
      if (jid === excluir) continue;
      const sc = byJudge[jid];
      if (sc === undefined) continue;
      acc += sc * (weights[jid] || 0);
      w += weights[jid] || 0;
    }
    return w > 0 ? acc / w : null;
  };

  console.log('juez                  modelo                  Spearman  cambian  |Δ| medio  desacuerdo');
  console.log('(al SACARLO)                                  vs panel  puesto              con los otros 2');
  for (const jid of judgeIds) {
    let rhoAcc = 0, rondas = 0, movedAcc = 0, nAcc = 0, absAcc = 0, disagreeAcc = 0, disagreeN = 0;
    for (const [, filas] of porRonda) {
      const full = filas.map((f) => ({ id: f.id, score: panel(f.byJudge, null) })).filter((x) => x.score !== null);
      const sin = filas.map((f) => ({ id: f.id, score: panel(f.byJudge, jid) })).filter((x) => x.score !== null);
      if (full.length < 3 || sin.length !== full.length) continue;
      const rf = toRanks(full), rs = toRanks(sin);
      const ids = full.map((x) => x.id);
      rhoAcc += spearman(ids.map((i) => -rf.get(i)), ids.map((i) => -rs.get(i)));
      rondas++;
      for (const i of ids) {
        nAcc++;
        const d = Math.abs(rf.get(i) - rs.get(i));
        if (d !== 0) movedAcc++;
        absAcc += d;
      }
      for (const f of filas) {
        const mio = f.byJudge[jid];
        const otros = judgeIds.filter((j) => j !== jid).map((j) => f.byJudge[j]).filter((v) => v !== undefined);
        if (mio === undefined || otros.length === 0) continue;
        disagreeAcc += Math.abs(mio - otros.reduce((a, b) => a + b, 0) / otros.length);
        disagreeN++;
      }
    }
    if (!rondas) continue;
    console.log(
      `${jid.padEnd(22)}${(modelOf[jid] || '?').padEnd(24)}` +
      `${(rhoAcc / rondas).toFixed(3)}     ${String(Math.round((100 * movedAcc) / nAcc)).padStart(3)}%     ` +
      `${(absAcc / nAcc).toFixed(2)}       ${(disagreeAcc / disagreeN).toFixed(1)} pts`
    );
  }

  console.log('\nOJO: esto mide INFLUENCIA, no ACIERTO. Un juez que casi no mueve el ranking');
  console.log('aporta poca señal propia, pero eso NO dice si el ranking sin él es mejor o');
  console.log('peor. Para eso hace falta un set etiquetado a mano.');
  process.exit(0);
})().catch((e) => { console.error('error:', e.message); process.exit(1); });
