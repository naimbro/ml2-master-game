import type { PlayerResponse } from './bradley-terry';

function averageRanks(values: number[]): number[] {
  const idx = values.map((v, i) => [v, i] as [number, number]);
  idx.sort((a, b) => a[0] - b[0]);
  const ranks = new Array(values.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // 1-based average rank across the tie group
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

/** Spearman rank correlation over the ids present in both maps. */
export function spearmanRho(a: Record<string, number>, b: Record<string, number>): number {
  const ids = Object.keys(a).filter((id) => id in b);
  if (ids.length < 2) return NaN;
  const av = ids.map((id) => a[id]);
  const bv = ids.map((id) => b[id]);
  return pearson(averageRanks(av), averageRanks(bv));
}

/** Kendall tau-b over the ids present in both maps (tie-corrected). */
export function kendallTau(a: Record<string, number>, b: Record<string, number>): number {
  const ids = Object.keys(a).filter((id) => id in b);
  const n = ids.length;
  if (n < 2) return NaN;
  let concordant = 0, discordant = 0, tiesA = 0, tiesB = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const da = a[ids[i]] - a[ids[j]];
      const db = b[ids[i]] - b[ids[j]];
      if (da === 0) tiesA++;
      if (db === 0) tiesB++;
      if (da !== 0 && db !== 0) {
        if (Math.sign(da) === Math.sign(db)) concordant++;
        else discordant++;
      }
    }
  }
  const n0 = (n * (n - 1)) / 2;
  const denom = Math.sqrt((n0 - tiesA) * (n0 - tiesB));
  if (denom === 0) return 0;
  return (concordant - discordant) / denom;
}

/** Map ids to 1-based ranks by descending value; equal values share a rank. */
export function ranksDescending(values: Record<string, number>): Record<string, number> {
  const ids = Object.keys(values);
  const sorted = [...ids].sort((a, b) => values[b] - values[a]);
  const rank: Record<string, number> = {};
  let cur = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && values[sorted[i]] < values[sorted[i - 1]]) cur = i + 1;
    rank[sorted[i]] = cur;
  }
  return rank;
}

/**
 * Linearly rescale `x` so it has the same mean and standard deviation as `ref`,
 * preserving x's ordering. Used to turn BT log-strengths into per-round "points"
 * directly comparable to that round's LLM score scale. Zero-variance x -> ref mean.
 */
export function linearMatchMoments(x: number[], ref: number[]): number[] {
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a: number[]) => {
    const m = mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
  };
  const mx = mean(x), sx = sd(x), mr = mean(ref), sr = sd(ref);
  if (sx === 0) return x.map(() => mr);
  return x.map((v) => mr + ((v - mx) / sx) * sr);
}

/**
 * Fraction of (response-pair, judge-pair) comparisons where two judges disagree
 * on the ordering. Ties (a judge scoring the pair equal) are excluded from the
 * denominator. 0 = judges always agree (BT can't diverge from the average);
 * higher = more room for BT to differ.
 */
export function judgeDisagreementRate(players: PlayerResponse[]): number {
  const n = players.length;
  let total = 0, disagree = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const bScore: Record<string, number> = {};
      for (const js of players[j].judgeScores) bScore[js.judgeId] = js.score;
      const signs: number[] = [];
      for (const js of players[i].judgeScores) {
        if (!(js.judgeId in bScore)) continue;
        const d = js.score - bScore[js.judgeId];
        if (d !== 0) signs.push(Math.sign(d));
      }
      for (let k = 0; k < signs.length; k++) {
        for (let l = k + 1; l < signs.length; l++) {
          total++;
          if (signs[k] !== signs[l]) disagree++;
        }
      }
    }
  }
  return total > 0 ? disagree / total : 0;
}
