export interface RoundRow {
  playerName: string;
  llmScore: number;
  llmRank: number;
  theta: number;
  btRank: number;
  deltaRank: number; // llmRank - btRank ; positive = BT ranks the player higher
}

export interface RoundAnalysis {
  round: number;
  scenarioTitle: string;
  rows: RoundRow[];
  spearman: number;
  kendall: number;
  disagreement: number;
}

export interface OverallRow {
  playerName: string;
  llmTotal: number;
  llmRank: number;
  btPoints: number;
  btRank: number;
  deltaRank: number;
}

export interface OverallAnalysis {
  rows: OverallRow[];
  spearman: number;
  kendall: number;
}

export interface GameReport {
  gameCode: string;
  rounds: RoundAnalysis[];
  overall: OverallAnalysis;
}

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function deltaCell(d: number): string {
  if (d === 0) return '<td class="delta zero">0</td>';
  const cls = d > 0 ? 'up' : 'down';
  const arrow = d > 0 ? '▲' : '▼';
  return `<td class="delta ${cls}">${arrow} ${Math.abs(d)}</td>`;
}

function roundTable(r: RoundAnalysis): string {
  const rows = r.rows
    .map(
      (row) => `<tr>
      <td>${esc(row.playerName)}</td>
      <td>${fmt(row.llmScore, 0)}</td><td>${row.llmRank}</td>
      <td>${fmt(row.theta, 2)}</td><td>${row.btRank}</td>
      ${deltaCell(row.deltaRank)}
    </tr>`,
    )
    .join('\n');
  return `<section>
    <h2>Round ${r.round} — ${esc(r.scenarioTitle)}</h2>
    <p class="stats">Spearman &rho; = <b>${fmt(r.spearman)}</b> ·
       Kendall &tau; = <b>${fmt(r.kendall)}</b> ·
       judge disagreement = <b>${fmt(r.disagreement * 100, 0)}%</b></p>
    <table>
      <thead><tr><th>Player</th><th>LLM score</th><th>LLM rank</th>
        <th>BT &theta;</th><th>BT rank</th><th>&Delta;rank</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function overallTable(o: OverallAnalysis): string {
  const rows = o.rows
    .map(
      (row) => `<tr>
      <td>${esc(row.playerName)}</td>
      <td>${fmt(row.llmTotal, 0)}</td><td>${row.llmRank}</td>
      <td>${fmt(row.btPoints, 0)}</td><td>${row.btRank}</td>
      ${deltaCell(row.deltaRank)}
    </tr>`,
    )
    .join('\n');
  return `<section>
    <h2>Overall (cumulative across ranked rounds)</h2>
    <table>
      <thead><tr><th>Player</th><th>LLM total</th><th>LLM rank</th>
        <th>BT points</th><th>BT rank</th><th>&Delta;rank</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export function renderHtml(report: GameReport): string {
  const verdict = `Overall LLM-vs-BT agreement: Spearman &rho; = <b>${fmt(
    report.overall.spearman,
  )}</b>, Kendall &tau; = <b>${fmt(report.overall.kendall)}</b>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BT rescore — ${esc(report.gameCode)}</title>
<style>
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; max-width: 900px;
    margin: 2rem auto; padding: 0 1rem; color: #1a1a2e; }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.1rem; margin-top: 2rem; }
  .verdict { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px;
    padding: .75rem 1rem; font-size: 1.05rem; }
  .stats { color: #475569; }
  table { border-collapse: collapse; width: 100%; margin-top: .5rem; }
  th, td { padding: .4rem .6rem; text-align: right; border-bottom: 1px solid #e2e8f0; }
  th:first-child, td:first-child { text-align: left; }
  thead th { border-bottom: 2px solid #cbd5e1; }
  .delta.up { color: #059669; } .delta.down { color: #dc2626; }
  .delta.zero { color: #94a3b8; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    .verdict { background: #1e293b; border-color: #334155; }
    th, td { border-color: #334155; } .stats { color: #94a3b8; }
  }
</style></head><body>
<h1>Bradley–Terry rescore — game ${esc(report.gameCode)}</h1>
<p class="verdict">${verdict}</p>
${overallTable(report.overall)}
${report.rounds.map(roundTable).join('\n')}
<p class="stats">&Delta;rank &gt; 0 means Bradley–Terry ranks the student higher than the
current LLM average. Judge disagreement near 0 means the judges rarely disagree, so BT
has little room to diverge from the average.</p>
</body></html>`;
}

export function renderConsole(report: GameReport): string {
  const lines: string[] = [];
  lines.push(`\nBradley–Terry rescore — game ${report.gameCode}`);
  lines.push(
    `VERDICT  overall  rho=${fmt(report.overall.spearman)}  tau=${fmt(report.overall.kendall)}\n`,
  );
  lines.push('Overall (cumulative):');
  lines.push('  player           LLM#  BT#  Δ');
  for (const r of report.overall.rows) {
    const d = r.deltaRank === 0 ? '0' : (r.deltaRank > 0 ? `+${r.deltaRank}` : `${r.deltaRank}`);
    lines.push(`  ${r.playerName.padEnd(15)} ${String(r.llmRank).padStart(3)} ${String(r.btRank).padStart(4)}  ${d}`);
  }
  for (const round of report.rounds) {
    lines.push(`\nRound ${round.round} — ${round.scenarioTitle}`);
    lines.push(`  rho=${fmt(round.spearman)} tau=${fmt(round.kendall)} disagreement=${fmt(round.disagreement * 100, 0)}%`);
  }
  return lines.join('\n');
}
