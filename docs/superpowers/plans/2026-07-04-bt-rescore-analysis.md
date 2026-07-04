# BT-Rescore Analysis Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local, read-only Node script that rescores a past game with Bradley–Terry (from the per-judge scores already in Firestore) and emits an HTML + console report comparing the current LLM weighted-average ranking against the BT ranking, per round and overall.

**Architecture:** Three pure, unit-tested library modules (`bradley-terry.ts` = pairwise counts + MM fit; `stats.ts` = rank correlations, disagreement rate, helpers; `report.ts` = HTML/console rendering) plus a thin Firestore-facing entry point (`bt-rescore.ts`). The entry point loads a game via `firebase-admin` (ADC creds), feeds plain data structures into the pure modules, and writes the report. Nothing is written back to Firestore.

**Tech Stack:** TypeScript, Node via `tsx`, `firebase-admin` (Application Default Credentials, project `ml2-master-game`), `vitest` for tests. No numerical dependencies — BT and stats are hand-implemented.

---

## File Structure

- Create: `scripts/lib/bradley-terry.ts` — types (`JudgeScore`, `PlayerResponse`, `JudgeWeights`), `buildPairwiseCounts`, `fitBradleyTerry`.
- Create: `scripts/lib/bradley-terry.test.ts` — unit tests for the above.
- Create: `scripts/lib/stats.ts` — `spearmanRho`, `kendallTau`, `judgeDisagreementRate`, `ranksDescending`, `linearMatchMoments`.
- Create: `scripts/lib/stats.test.ts` — unit tests for the above.
- Create: `scripts/lib/report.ts` — `RoundAnalysis`, `OverallAnalysis`, `GameReport` types, `renderHtml`, `renderConsole`.
- Create: `scripts/lib/report.test.ts` — smoke tests for rendering.
- Create: `scripts/bt-rescore.ts` — entry point: firebase-admin init, game listing, load + orchestrate, write report.
- Modify: `package.json` — add devDeps + `test` and `bt-rescore` scripts.

**Data shapes in Firestore (existing, read-only):**
- `games/{gameCode}`: `sessionConfig.judges: [{judgeId, weight}]`, `scenarios: [{ title?, id?, type?, ranked? }]`, `players: { [id]: { totalScore } }`.
- `games/{gameCode}/submissions/{id}`: `playerId`, `playerName`, `round` (1-based), `response`, `evaluated`, `evaluation: { finalScore, evaluations: [{ judgeId, judgeName, score }] }`.
- A scenario is **ranked** when `ranked !== false`; skip `type === 'multiple_choice'`.

---

## Task 1: Project setup (deps + scripts)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D firebase-admin tsx vitest
```
Expected: installs succeed; `firebase-admin`, `tsx`, `vitest` appear under `devDependencies`.

- [ ] **Step 2: Add npm scripts**

Edit `package.json` `"scripts"` block to add two entries (keep existing ones):
```json
    "test": "vitest run",
    "bt-rescore": "tsx scripts/bt-rescore.ts"
```

- [ ] **Step 3: Verify vitest runs with no tests yet**

Run: `npm test`
Expected: vitest reports "No test files found" (exit 0 or a benign no-tests message). This confirms the toolchain works before we write code.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add firebase-admin, tsx, vitest for BT-rescore tool"
```

---

## Task 2: Bradley–Terry core (`bradley-terry.ts`)

**Files:**
- Create: `scripts/lib/bradley-terry.ts`
- Test: `scripts/lib/bradley-terry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/bradley-terry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fitBradleyTerry, buildPairwiseCounts, type PlayerResponse } from './bradley-terry';

const W = { j1: 1, j2: 1, j3: 1 };

function p(id: string, scores: Record<string, number>, llm = 0): PlayerResponse {
  return {
    playerId: id,
    playerName: id,
    llmScore: llm,
    judgeScores: Object.entries(scores).map(([judgeId, score]) => ({ judgeId, score })),
  };
}

describe('fitBradleyTerry', () => {
  it('ranks a transitive triple in order when all judges agree', () => {
    const players = [
      p('A', { j1: 90, j2: 90, j3: 90 }),
      p('B', { j1: 50, j2: 50, j3: 50 }),
      p('C', { j1: 10, j2: 10, j3: 10 }),
    ];
    const r = fitBradleyTerry(players, W);
    expect(r.ranking).toEqual(['A', 'B', 'C']);
    expect(r.strength['A']).toBeGreaterThan(r.strength['B']);
    expect(r.strength['B']).toBeGreaterThan(r.strength['C']);
  });

  it('diverges from the LLM average when a judge uses an extreme scale', () => {
    // LLM avg: A=(100+40+40)/3=60 > B=(0+50+50)/3=33.3  -> LLM says A>B
    // Pairwise votes: j1 A>B, j2 B>A, j3 B>A -> BT says B>A
    const players = [
      p('A', { j1: 100, j2: 40, j3: 40 }, 60),
      p('B', { j1: 0, j2: 50, j3: 50 }, 33.3),
    ];
    const r = fitBradleyTerry(players, W);
    expect(r.ranking).toEqual(['B', 'A']);
    expect(r.strength['B']).toBeGreaterThan(r.strength['A']);
  });

  it('gives finite, ordered strengths under perfect separation (prior)', () => {
    const players = [
      p('A', { j1: 90, j2: 90, j3: 90 }),
      p('B', { j1: 10, j2: 10, j3: 10 }),
    ];
    const r = fitBradleyTerry(players, W);
    expect(Number.isFinite(r.strength['A'])).toBe(true);
    expect(Number.isFinite(r.strength['B'])).toBe(true);
    expect(r.strength['A']).toBeGreaterThan(r.strength['B']);
  });

  it('assigns near-equal strength to identical responses', () => {
    const players = [
      p('A', { j1: 55, j2: 55, j3: 55 }),
      p('B', { j1: 55, j2: 55, j3: 55 }),
    ];
    const r = fitBradleyTerry(players, W);
    expect(Math.abs(r.strength['A'] - r.strength['B'])).toBeLessThan(1e-6);
  });

  it('respects judge weights (heavier judge decides)', () => {
    // j1 (weight 5) says A>B; j2,j3 (weight 1) say B>A -> weighted 5 vs 2 -> A wins
    const players = [
      p('A', { j1: 90, j2: 40, j3: 40 }),
      p('B', { j1: 10, j2: 60, j3: 60 }),
    ];
    const r = fitBradleyTerry(players, { j1: 5, j2: 1, j3: 1 });
    expect(r.ranking).toEqual(['A', 'B']);
  });
});

describe('buildPairwiseCounts', () => {
  it('counts ties as half a win each direction', () => {
    const players = [
      p('A', { j1: 50 }),
      p('B', { j1: 50 }),
    ];
    const { ids, wins } = buildPairwiseCounts(players, { j1: 1 }, 0);
    const i = ids.indexOf('A'); const j = ids.indexOf('B');
    expect(wins[i][j]).toBeCloseTo(0.5, 9);
    expect(wins[j][i]).toBeCloseTo(0.5, 9);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/lib/bradley-terry.test.ts`
Expected: FAIL — cannot resolve `./bradley-terry` / exports not defined.

- [ ] **Step 3: Implement `bradley-terry.ts`**

Create `scripts/lib/bradley-terry.ts`:
```ts
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
 * Fit Bradley–Terry strengths via the standard MM (minorization-maximization)
 * iteration:  pi_i <- W_i / sum_{j != i} n_ij / (pi_i + pi_j),
 * renormalized each pass to geometric mean 1.
 */
export function fitBradleyTerry(
  players: PlayerResponse[],
  weights: JudgeWeights,
  opts: { prior?: number; maxIter?: number; tol?: number } = {},
): BTResult {
  const { prior = 0.5, maxIter = 1000, tol = 1e-10 } = opts;
  const { ids, wins } = buildPairwiseCounts(players, weights, prior);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/lib/bradley-terry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/bradley-terry.ts scripts/lib/bradley-terry.test.ts
git commit -m "feat: Bradley-Terry MM fit from per-judge scores"
```

---

## Task 3: Stats helpers (`stats.ts`)

**Files:**
- Create: `scripts/lib/stats.ts`
- Test: `scripts/lib/stats.test.ts`

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  spearmanRho,
  kendallTau,
  judgeDisagreementRate,
  ranksDescending,
  linearMatchMoments,
} from './stats';
import type { PlayerResponse } from './bradley-terry';

describe('spearmanRho', () => {
  it('is 1 for identical orderings', () => {
    const a = { x: 3, y: 2, z: 1 };
    const b = { x: 30, y: 20, z: 10 };
    expect(spearmanRho(a, b)).toBeCloseTo(1, 9);
  });
  it('is -1 for reversed orderings', () => {
    const a = { x: 3, y: 2, z: 1 };
    const b = { x: 10, y: 20, z: 30 };
    expect(spearmanRho(a, b)).toBeCloseTo(-1, 9);
  });
});

describe('kendallTau', () => {
  it('is 1 for identical orderings', () => {
    expect(kendallTau({ x: 3, y: 2, z: 1 }, { x: 9, y: 5, z: 1 })).toBeCloseTo(1, 9);
  });
  it('is -1 for reversed orderings', () => {
    expect(kendallTau({ x: 3, y: 2, z: 1 }, { x: 1, y: 5, z: 9 })).toBeCloseTo(-1, 9);
  });
  it('handles a single swap (4 items, one discordant pair)', () => {
    // ranking a: A>B>C>D ; b swaps B and C -> A>C>B>D
    // 6 pairs, 1 discordant (B,C) -> tau = (5-1)/6
    const a = { A: 4, B: 3, C: 2, D: 1 };
    const b = { A: 4, B: 2, C: 3, D: 1 };
    expect(kendallTau(a, b)).toBeCloseTo(4 / 6, 9);
  });
});

describe('ranksDescending', () => {
  it('assigns 1 to the highest value and ties share a rank', () => {
    const r = ranksDescending({ a: 10, b: 10, c: 5 });
    expect(r.a).toBe(1);
    expect(r.b).toBe(1);
    expect(r.c).toBe(3);
  });
});

describe('linearMatchMoments', () => {
  it('maps values to the reference mean and sd', () => {
    const out = linearMatchMoments([1, 2, 3], [10, 20, 30]);
    // mean 20, and monotonic-preserving
    expect(out[0]).toBeCloseTo(10, 6);
    expect(out[1]).toBeCloseTo(20, 6);
    expect(out[2]).toBeCloseTo(30, 6);
  });
  it('returns the reference mean when input has zero variance', () => {
    expect(linearMatchMoments([5, 5, 5], [2, 4, 6])).toEqual([4, 4, 4]);
  });
});

describe('judgeDisagreementRate', () => {
  it('is 0 when all judges agree on every pair', () => {
    const players: PlayerResponse[] = [
      { playerId: 'A', playerName: 'A', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 9 }, { judgeId: 'j2', score: 8 }] },
      { playerId: 'B', playerName: 'B', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 1 }, { judgeId: 'j2', score: 2 }] },
    ];
    expect(judgeDisagreementRate(players)).toBe(0);
  });
  it('is 1 when the two judges always disagree', () => {
    const players: PlayerResponse[] = [
      { playerId: 'A', playerName: 'A', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 9 }, { judgeId: 'j2', score: 1 }] },
      { playerId: 'B', playerName: 'B', llmScore: 0, judgeScores: [{ judgeId: 'j1', score: 1 }, { judgeId: 'j2', score: 9 }] },
    ];
    expect(judgeDisagreementRate(players)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/lib/stats.test.ts`
Expected: FAIL — module `./stats` not found.

- [ ] **Step 3: Implement `stats.ts`**

Create `scripts/lib/stats.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/lib/stats.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/stats.ts scripts/lib/stats.test.ts
git commit -m "feat: rank-correlation and judge-disagreement stats helpers"
```

---

## Task 4: Report rendering (`report.ts`)

**Files:**
- Create: `scripts/lib/report.ts`
- Test: `scripts/lib/report.test.ts`

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/report.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderHtml, renderConsole, type GameReport } from './report';

const report: GameReport = {
  gameCode: 'ABCD',
  rounds: [
    {
      round: 1,
      scenarioTitle: 'De tema a decision',
      rows: [
        { playerName: 'Ana', llmScore: 82, llmRank: 1, theta: 0.9, btRank: 1, deltaRank: 0 },
        { playerName: 'Bruno', llmScore: 79, llmRank: 2, theta: -0.4, btRank: 3, deltaRank: -1 },
        { playerName: 'Cata', llmScore: 70, llmRank: 3, theta: 0.1, btRank: 2, deltaRank: 1 },
      ],
      spearman: 0.5,
      kendall: 0.33,
      disagreement: 0.25,
    },
  ],
  overall: {
    rows: [
      { playerName: 'Ana', llmTotal: 82, llmRank: 1, btPoints: 80, btRank: 1, deltaRank: 0 },
      { playerName: 'Bruno', llmTotal: 79, llmRank: 2, btPoints: 60, btRank: 3, deltaRank: -1 },
      { playerName: 'Cata', llmTotal: 70, llmRank: 3, btPoints: 70, btRank: 2, deltaRank: 1 },
    ],
    spearman: 0.5,
    kendall: 0.33,
  },
};

describe('renderHtml', () => {
  it('produces a self-contained document with player names and the verdict', () => {
    const html = renderHtml(report);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('ABCD');
    expect(html).toContain('Ana');
    expect(html).toContain('De tema a decision');
    expect(html).toContain('0.50'); // overall spearman, formatted
    expect(html).not.toContain('undefined');
  });
});

describe('renderConsole', () => {
  it('includes the overall verdict line', () => {
    const out = renderConsole(report);
    expect(out).toContain('rho');
    expect(out).toContain('0.50');
    expect(out).toContain('Ana');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/lib/report.test.ts`
Expected: FAIL — module `./report` not found.

- [ ] **Step 3: Implement `report.ts`**

Create `scripts/lib/report.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/lib/report.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/report.ts scripts/lib/report.test.ts
git commit -m "feat: HTML + console rendering for BT-rescore report"
```

---

## Task 5: Entry point (`bt-rescore.ts`)

**Files:**
- Create: `scripts/bt-rescore.ts`

This task has no unit test (it is thin Firestore I/O + orchestration over already-tested pure modules); it is verified by the manual run in Task 6.

- [ ] **Step 1: Implement `bt-rescore.ts`**

Create `scripts/bt-rescore.ts`:
```ts
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';
import { fitBradleyTerry, type PlayerResponse, type JudgeWeights } from './lib/bradley-terry';
import {
  spearmanRho,
  kendallTau,
  judgeDisagreementRate,
  ranksDescending,
  linearMatchMoments,
} from './lib/stats';
import {
  renderHtml,
  renderConsole,
  type GameReport,
  type RoundAnalysis,
  type RoundRow,
  type OverallRow,
} from './lib/report';

const PROJECT_ID = 'ml2-master-game';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function listGames(): Promise<void> {
  const snap = await db.collection('games').limit(50).get();
  if (snap.empty) {
    console.log('No games found.');
    return;
  }
  console.log('Available games (pass a code as the argument):\n');
  for (const doc of snap.docs) {
    const d = doc.data();
    const players = d.players ? Object.keys(d.players).length : 0;
    const title = d.sessionConfig?.title || d.sessionId || '';
    console.log(`  ${doc.id.padEnd(10)} players=${String(players).padStart(2)}  ${title}`);
  }
}

interface Submission {
  playerId: string;
  playerName: string;
  round: number;
  evaluated?: boolean;
  evaluation?: {
    finalScore: number;
    evaluations: { judgeId: string; judgeName?: string; score: number }[];
  };
}

function toPlayerResponses(subs: Submission[]): PlayerResponse[] {
  return subs
    .filter((s) => s.evaluation && Array.isArray(s.evaluation.evaluations))
    .map((s) => ({
      playerId: s.playerId,
      playerName: s.playerName,
      llmScore: s.evaluation!.finalScore,
      judgeScores: s.evaluation!.evaluations.map((e) => ({ judgeId: e.judgeId, score: e.score })),
    }));
}

function analyzeRound(
  round: number,
  scenarioTitle: string,
  players: PlayerResponse[],
  weights: JudgeWeights,
): RoundAnalysis | null {
  if (players.length < 2) return null;

  const bt = fitBradleyTerry(players, weights);
  const llmScoreMap: Record<string, number> = {};
  for (const p of players) llmScoreMap[p.playerId] = p.llmScore;

  const llmRank = ranksDescending(llmScoreMap);
  const btRank = ranksDescending(bt.strength);

  const rows: RoundRow[] = players
    .map((p) => ({
      playerName: p.playerName,
      llmScore: p.llmScore,
      llmRank: llmRank[p.playerId],
      theta: bt.logStrength[p.playerId],
      btRank: btRank[p.playerId],
      deltaRank: llmRank[p.playerId] - btRank[p.playerId],
    }))
    .sort((a, b) => a.llmRank - b.llmRank);

  return {
    round,
    scenarioTitle,
    rows,
    spearman: spearmanRho(llmScoreMap, bt.strength),
    kendall: kendallTau(llmScoreMap, bt.strength),
    disagreement: judgeDisagreementRate(players),
  };
}

async function run(gameCode: string): Promise<void> {
  const gameDoc = await db.collection('games').doc(gameCode).get();
  if (!gameDoc.exists) {
    console.error(`Game "${gameCode}" not found.`);
    process.exitCode = 1;
    return;
  }
  const game = gameDoc.data()!;
  const scenarios: any[] = game.scenarios || [];

  const weights: JudgeWeights = {};
  const judgeList: { judgeId: string; weight: number }[] = game.sessionConfig?.judges || [];
  for (const j of judgeList) weights[j.judgeId] = j.weight;

  const subsSnap = await db.collection('games').doc(gameCode).collection('submissions').get();
  const allSubs = subsSnap.docs.map((d) => d.data() as Submission);

  // Accumulators for the overall (cumulative) comparison.
  const llmTotal: Record<string, number> = {};
  const btPointsTotal: Record<string, number> = {};
  const nameById: Record<string, string> = {};

  const rounds: RoundAnalysis[] = [];

  for (let idx = 0; idx < scenarios.length; idx++) {
    const scenario = scenarios[idx];
    const round = idx + 1;
    if (scenario?.ranked === false) continue;
    if (scenario?.type === 'multiple_choice') continue;

    const players = toPlayerResponses(allSubs.filter((s) => s.round === round));
    const analysis = analyzeRound(
      round,
      scenario?.title || scenario?.id || `Round ${round}`,
      players,
      weights,
    );
    if (!analysis) continue;
    rounds.push(analysis);

    // Cumulative: LLM total = sum of finalScore; BT points = log-strengths
    // rescaled to this round's LLM score moments so they aggregate on the same scale.
    const bt = fitBradleyTerry(players, weights);
    const thetas = players.map((p) => bt.logStrength[p.playerId]);
    const llmScores = players.map((p) => p.llmScore);
    const btPoints = linearMatchMoments(thetas, llmScores);
    players.forEach((p, i) => {
      nameById[p.playerId] = p.playerName;
      llmTotal[p.playerId] = (llmTotal[p.playerId] || 0) + p.llmScore;
      btPointsTotal[p.playerId] = (btPointsTotal[p.playerId] || 0) + btPoints[i];
    });
  }

  const llmOverallRank = ranksDescending(llmTotal);
  const btOverallRank = ranksDescending(btPointsTotal);
  const overallRows: OverallRow[] = Object.keys(llmTotal)
    .map((id) => ({
      playerName: nameById[id],
      llmTotal: llmTotal[id],
      llmRank: llmOverallRank[id],
      btPoints: btPointsTotal[id],
      btRank: btOverallRank[id],
      deltaRank: llmOverallRank[id] - btOverallRank[id],
    }))
    .sort((a, b) => a.llmRank - b.llmRank);

  const report: GameReport = {
    gameCode,
    rounds,
    overall: {
      rows: overallRows,
      spearman: spearmanRho(llmTotal, btPointsTotal),
      kendall: kendallTau(llmTotal, btPointsTotal),
    },
  };

  const outPath = `bt-report-${gameCode}.html`;
  writeFileSync(outPath, renderHtml(report));
  console.log(renderConsole(report));
  console.log(`\nHTML report written to ${outPath}`);
}

const arg = process.argv[2];
(arg ? run(arg) : listGames())
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 2: Verify it type-checks and the no-arg path runs**

Run: `npx tsx scripts/bt-rescore.ts`
Expected: connects with ADC and prints "Available games..." with a list of game codes (or "No games found."). If it errors on credentials, ensure `gcloud auth application-default login` has been run.

- [ ] **Step 3: Commit**

```bash
git add scripts/bt-rescore.ts
git commit -m "feat: bt-rescore entry point (Firestore load + orchestration)"
```

---

## Task 6: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: List games and pick one with several players**

Run: `npm run bt-rescore`
Expected: a list of game codes; choose one with `players >= 3` for a meaningful comparison.

- [ ] **Step 2: Run the rescore on that game**

Run: `npm run bt-rescore -- <GAMECODE>`
Expected: console summary prints the verdict line (`rho=...`), an overall table, and a per-round breakdown; `bt-report-<GAMECODE>.html` is written.

- [ ] **Step 3: Eyeball the HTML report**

Open `bt-report-<GAMECODE>.html` in a browser. Confirm:
  - Overall and per-round tables render with real player names.
  - Δrank arrows point sensibly (a student BT ranks higher shows ▲).
  - Judge-disagreement % is between 0 and 100.
  - No `undefined`/`NaN` in cells (n/a is acceptable where a round had <2 players).

- [ ] **Step 4: Sanity-check the headline**

Read the verdict line. If Spearman ρ is very high (≈0.9+) with low judge disagreement, that is the "keep the current system" outcome. If ρ is low with high disagreement, BT is meaningfully re-ordering students — worth a closer look. Note the number for the follow-up decision.

- [ ] **Step 5: Add the report artifact to gitignore (do not commit game data)**

Append to `.gitignore`:
```
bt-report-*.html
```
Then:
```bash
git add .gitignore
git commit -m "chore: ignore generated bt-report html artifacts"
```

---

## Notes for the implementer

- **Do not** modify `functions/` or any live-game code — this tool is read-only and offline.
- The pure modules (`bradley-terry.ts`, `stats.ts`, `report.ts`) must not import `firebase-admin`; only `bt-rescore.ts` touches Firestore. This keeps the math unit-testable.
- If `npm test` is run at the end, all three test files should pass together: `npm test` → 17 tests passing.
