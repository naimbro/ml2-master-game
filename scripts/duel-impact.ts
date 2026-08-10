/**
 * ¿Que cambian los duelos, de verdad?
 *
 * Responde la pregunta que se repite cada vez que se mira la cuenta: si los
 * duelos cuestan plata y tiempo, ¿mueven algo que importe? Compara el ranking
 * de un juego con y sin ellos, y lo lleva hasta donde se nota — el podio y los
 * PUNTOS que cada alumno se lleva a la tabla del curso.
 *
 * No gasta un peso ni llama a ningun modelo: los dos puntajes ya estan
 * guardados en `rounds/round_N.rankings[]`, `score` (despues de los duelos) y
 * `provScore` (lo que dijeron los jueces antes). Una ronda sin `provScore` es
 * una ronda que nunca se recalibro, y ahi los dos escenarios coinciden.
 *
 * Uso:  npx tsx scripts/duel-impact.ts
 *
 * Medido el 2026-08-11 sobre los dos unicos juegos con curso completo:
 *   XNTUHB (37 alumnos)  podio distinto · 11 de 37 cambian de puntos
 *   MTF4MX (33 alumnos)  GANADOR distinto · 13 de 33 cambian de puntos
 * Y eso con UNA sola ronda recalibrada por juego. Conclusion: se quedan.
 */
import admin from 'firebase-admin';
import { pointsForPosition } from '../functions/src/lib/standings';
admin.initializeApp({ projectId: 'ml2-master-game' });
const db = admin.firestore();

function rank(totals: Map<string, number>): Map<string, number> {
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const out = new Map<string, number>();
  let pos = 0, prev: number | null = null;
  sorted.forEach(([uid, v], i) => {
    if (prev === null || v !== prev) { pos = i + 1; prev = v; }
    out.set(uid, pos);
  });
  return out;
}

(async () => {
  for (const code of ['XNTUHB', 'MTF4MX']) {
    const rs = await db.collection('games').doc(code).collection('rounds').get();
    const subs = await db.collection('games').doc(code).collection('submissions').select('playerId').get();
    const answered = new Set(subs.docs.map((d) => d.data().playerId as string));

    const withDuels = new Map<string, number>();
    const noDuels = new Map<string, number>();
    const names = new Map<string, string>();
    const recalRounds: number[] = [];

    for (const doc of rs.docs) {
      const d = doc.data();
      const n = Number(d.round);
      let isRecal = false;
      for (const r of d.rankings || []) {
        const id = r.playerId; if (!id) continue;
        names.set(id, r.playerName || id);
        const s = Number(r.score);
        const p = r.provScore !== undefined ? Number(r.provScore) : s;
        if (r.provScore !== undefined) isRecal = true;
        if (Number.isFinite(s)) withDuels.set(id, (withDuels.get(id) || 0) + s);
        if (Number.isFinite(p)) noDuels.set(id, (noDuels.get(id) || 0) + p);
      }
      if (isRecal) recalRounds.push(n);
    }

    for (const id of [...withDuels.keys()]) if (!answered.has(id)) { withDuels.delete(id); noDuels.delete(id); }

    const rA = rank(withDuels), rB = rank(noDuels);
    const ids = [...withDuels.keys()];

    console.log(`\n${'='.repeat(78)}\n${code} — ${ids.length} alumnos · ${rs.size} rondas · recalibradas: ${recalRounds.sort((a,b)=>a-b).join(', ') || 'ninguna'}`);

    const podA = ids.filter((i) => rA.get(i)! <= 3).sort((a, b) => rA.get(a)! - rA.get(b)!);
    const podB = ids.filter((i) => rB.get(i)! <= 3).sort((a, b) => rB.get(a)! - rB.get(b)!);
    console.log(`\n  PODIO con duelos:  ${podA.map((i) => `${rA.get(i)}º ${names.get(i)} (${withDuels.get(i)})`).join(' | ')}`);
    console.log(`  PODIO sin duelos:  ${podB.map((i) => `${rB.get(i)}º ${names.get(i)} (${noDuels.get(i)})`).join(' | ')}`);
    console.log(`  ¿Mismo podio? ${JSON.stringify(podA.map((i)=>names.get(i))) === JSON.stringify(podB.map((i)=>names.get(i))) ? 'SÍ' : '*** NO ***'}`);

    let movedPos = 0, movedPts = 0, ptsDelta = 0;
    const rows = ids.map((i) => {
      const pa = rA.get(i)!, pb = rB.get(i)!;
      const ptA = pointsForPosition(pa), ptB = pointsForPosition(pb);
      if (pa !== pb) movedPos++;
      if (ptA !== ptB) { movedPts++; ptsDelta += Math.abs(ptA - ptB); }
      return { n: names.get(i)!, pa, pb, ptA, ptB, d: ptA - ptB };
    }).sort((a, b) => a.pa - b.pa);

    console.log(`\n  Puestos del juego que cambian: ${movedPos}/${ids.length}`);
    console.log(`  Alumnos cuyos PUNTOS al curso cambian: ${movedPts}/${ids.length}  (|Δ| total = ${ptsDelta} pts)`);
    const ch = rows.filter((r) => r.d !== 0);
    if (ch.length) {
      console.log('\n  Quiénes y cuánto:');
      ch.forEach((r) => console.log(`    ${r.n.padEnd(24)} ${r.pb}º→${r.pa}º   ${r.ptB}→${r.ptA} pts  (${r.d > 0 ? '+' : ''}${r.d})`));
    }
  }
  process.exit(0);
})();
