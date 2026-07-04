import { fitBradleyTerryFromWins } from './bradley-terry';
import { linearMatchMoments } from './stats';

export interface RecalPlayer {
  id: string;
  prov: number; // provisional score (independent finalScore)
}

/** winner: 0 => i wins, 1 => j wins, -1 => tie. i and j index into the players array. */
export interface DuelResult {
  i: number;
  j: number;
  winner: 0 | 1 | -1;
}

/** Original indices ordered by provisional score desc; tie-break by id (deterministic). */
export function sortByProvisional(players: RecalPlayer[]): number[] {
  return players
    .map((p, idx) => idx)
    .sort((a, b) => players[b].prov - players[a].prov || (players[a].id < players[b].id ? -1 : 1));
}

/**
 * Swiss / score-adjacency band pairs over an already-sorted index order.
 * For each gap d = 1..B, pair (order[k], order[k+d]) — no wraparound, so the top
 * and bottom are never paired directly. Returns pairs of ORIGINAL indices.
 */
export function swissPairs(order: number[], B: number): [number, number][] {
  const n = order.length;
  const pairs: [number, number][] = [];
  for (let d = 1; d <= Math.min(B, n - 1); d++) {
    for (let k = 0; k + d < n; k++) pairs.push([order[k], order[k + d]]);
  }
  return pairs;
}

/**
 * Anchored Bradley–Terry recalibration.
 * Win matrix = fresh pairwise duels (full weight) + w_anchor · provisional-derived
 * votes over ALL pairs (supplies long-range order the band omits). Fit, then map
 * the log-strengths back onto the provisional score scale (same mean & sd) so only
 * the ordering changes. Returns recalibrated score per player id.
 */
export function recalibrateScores(
  players: RecalPlayer[],
  duels: DuelResult[],
  wAnchor: number,
): Record<string, number> {
  const ids = players.map((p) => p.id);
  const n = ids.length;
  const wins: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (const d of duels) {
    if (d.winner === 0) wins[d.i][d.j] += 1;
    else if (d.winner === 1) wins[d.j][d.i] += 1;
    else { wins[d.i][d.j] += 0.5; wins[d.j][d.i] += 0.5; }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = players[i].prov - players[j].prov;
      if (diff > 0) wins[i][j] += wAnchor;
      else if (diff < 0) wins[j][i] += wAnchor;
      else { wins[i][j] += wAnchor / 2; wins[j][i] += wAnchor / 2; }
    }
  }

  const bt = fitBradleyTerryFromWins(ids, wins);
  const thetas = ids.map((id) => bt.logStrength[id]);
  const provs = players.map((p) => p.prov);
  const rescaled = linearMatchMoments(thetas, provs);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => (out[id] = rescaled[i]));
  return out;
}
