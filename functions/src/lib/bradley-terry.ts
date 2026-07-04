export interface JudgeScore {
  judgeId: string;
  score: number;
}

export interface PlayerResponse {
  playerId: string;
  playerName: string;
  llmScore: number;
  judgeScores: JudgeScore[];
}

export type JudgeWeights = Record<string, number>;

export interface PairwiseCounts {
  ids: string[];
  wins: number[][]; // wins[i][j] = weighted wins of i over j
}

/**
 * Build a weighted pairwise-win matrix from per-judge scores.
 * For each response pair and each judge present in both, the higher score wins
 * (weighted by that judge's weight); equal scores split 0.5/0.5.
 * `prior` adds symmetric virtual ties to every pair to keep the comparison
 * graph connected and BT strengths finite under perfect separation.
 */
export function buildPairwiseCounts(
  players: PlayerResponse[],
  weights: JudgeWeights,
  prior = 0.5,
): PairwiseCounts {
  const ids = players.map((p) => p.playerId);
  const n = ids.length;
  const wins: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      wins[i][j] += prior / 2;
      wins[j][i] += prior / 2;

      const bScore: Record<string, number> = {};
      for (const js of players[j].judgeScores) bScore[js.judgeId] = js.score;

      for (const js of players[i].judgeScores) {
        if (!(js.judgeId in bScore)) continue;
        const w = weights[js.judgeId] ?? 1;
        const diff = js.score - bScore[js.judgeId];
        if (diff > 0) wins[i][j] += w;
        else if (diff < 0) wins[j][i] += w;
        else {
          wins[i][j] += w / 2;
          wins[j][i] += w / 2;
        }
      }
    }
  }
  return { ids, wins };
}

export interface BTResult {
  ids: string[];
  strength: Record<string, number>;    // pi_i, normalized so geometric mean = 1
  logStrength: Record<string, number>; // theta_i = ln(pi_i)
  ranking: string[];                   // ids sorted by strength, best first
}

/**
 * MM (minorization-maximization) core:  pi_i <- W_i / sum_{j != i} n_ij / (pi_i + pi_j),
 * renormalized each pass to geometric mean 1. `wins` must already include any prior.
 */
function runMM(
  ids: string[],
  wins: number[][],
  maxIter: number,
  tol: number,
): BTResult {
  const n = ids.length;
  if (n === 0) return { ids, strength: {}, logStrength: {}, ranking: [] };

  const W = new Array(n).fill(0);
  const nij: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      W[i] += wins[i][j];
      nij[i][j] = wins[i][j] + wins[j][i];
    }
  }

  let pi = new Array(n).fill(1);
  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let denom = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        denom += nij[i][j] / (pi[i] + pi[j]);
      }
      next[i] = denom > 0 ? W[i] / denom : pi[i];
    }
    let logSum = 0;
    for (let i = 0; i < n; i++) logSum += Math.log(next[i]);
    const gm = Math.exp(logSum / n);
    for (let i = 0; i < n; i++) next[i] /= gm;

    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(Math.log(next[i]) - Math.log(pi[i])));
    }
    pi = next;
    if (maxDelta < tol) break;
  }

  const strength: Record<string, number> = {};
  const logStrength: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    strength[ids[i]] = pi[i];
    logStrength[ids[i]] = Math.log(pi[i]);
  }
  const ranking = [...ids].sort((a, b) => strength[b] - strength[a]);
  return { ids, strength, logStrength, ranking };
}

/**
 * Fit Bradley–Terry strengths from per-judge scores (derives pairwise votes, then MM).
 */
export function fitBradleyTerry(
  players: PlayerResponse[],
  weights: JudgeWeights,
  opts: { prior?: number; maxIter?: number; tol?: number } = {},
): BTResult {
  const { prior = 0.5, maxIter = 1000, tol = 1e-10 } = opts;
  const { ids, wins } = buildPairwiseCounts(players, weights, prior);
  return runMM(ids, wins, maxIter, tol);
}

/**
 * Fit Bradley–Terry strengths from a raw pairwise-win matrix (e.g. from fresh
 * LLM head-to-head comparisons). `winsRaw[i][j]` = observed wins of i over j
 * (ties may be split 0.5/0.5). A symmetric `prior` of virtual ties is added to
 * every pair to keep the comparison graph connected and strengths finite.
 */
export function fitBradleyTerryFromWins(
  ids: string[],
  winsRaw: number[][],
  opts: { prior?: number; maxIter?: number; tol?: number } = {},
): BTResult {
  const { prior = 0.5, maxIter = 1000, tol = 1e-10 } = opts;
  const n = ids.length;
  const wins: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => winsRaw[i][j]),
  );
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      wins[i][j] += prior / 2;
      wins[j][i] += prior / 2;
    }
  }
  return runMM(ids, wins, maxIter, tol);
}
