# BT-Rescore Analysis Tool — Design

**Date:** 2026-07-04
**Status:** Approved (design), pending implementation plan
**Scope:** Retrospective A/B analysis only. No change to live gameplay.

## Problem

The current judging system scores each student response *in isolation* on a 0–100
scale (three judges, weighted average → `finalScore`), then ranks students by
sorting those absolute scores. The professor suspects this ranking is unreliable
and wants to know whether a **Bradley–Terry (BT)** pairwise-comparison ranking
would order students meaningfully differently.

Goal: an internal evaluation tool. If the current ranking correlates strongly
with a BT ranking, the current system is kept. If they diverge, that's evidence
the averaging is distorting the ranking.

## Key methodological decision

Pairwise outcomes are **derived from existing stored judge scores — no new LLM
calls.** The naive version ("A beats B if A's *final* score is higher") is a
monotonic transform of the current ranking and would trivially correlate ~1.0,
revealing nothing. The informative version uses **per-judge votes**:

- Each response stores three individual judge scores in
  `evaluation.evaluations[]` (fields: `judgeId`, `judgeName`, `score`).
- For each pair (A, B) and each judge *k*: A wins if `score_k(A) > score_k(B)`,
  loses if lower, **½–½ on a tie**. Votes are weighted by each judge's configured
  weight from `sessionConfig.judges`.

This diverges from the current weighted-average because BT is **scale-invariant
per judge** — it uses only each judge's *ordering*, so a judge who compresses
everyone into 70–90 no longer silently loses influence. It also weights
consistency of wins rather than magnitude of score gaps.

## Data model (existing, read-only)

- `games/{gameCode}` — has `sessionConfig` (incl. `judges: [{judgeId, weight}]`),
  `scenarios[]`, `players` map.
- `games/{gameCode}/submissions/{id}` — `playerId`, `playerName`, `round`,
  `response`, `evaluated`, `evaluation: { finalScore, evaluations: [{judgeId,
  judgeName, score, ...}], ... }`.
- A scenario is **ranked** when `scenario.ranked !== false`. Skip
  `scenario.type === 'multiple_choice'` and non-ranked scenarios.

The tool never writes to Firestore.

## Bradley–Terry fit

For each ranked round, over the set of players who submitted:

1. Accumulate weighted pairwise win counts `w_ij` (wins of i over j) and pair
   comparison counts `n_ij = w_ij + w_ji` from per-judge votes (ties add 0.5 to
   each side; each judge's contribution scaled by its weight).
2. Fit strengths `π_i` via the standard **MM (minorization-maximization)
   iteration**:
   `π_i ← W_i / Σ_{j≠i} n_ij / (π_i + π_j)`, where `W_i = Σ_j w_ij`.
   Normalize each pass (geometric mean of π = 1). Iterate to convergence
   (tolerance on max log-strength change, capped iterations).
3. **Regularization / prior:** add a small pseudo-count of ties against an
   average phantom opponent so a player who sweeps or loses every comparison
   still gets a finite strength (avoids π → 0 or ∞ under perfect separation).
4. Rank by π (descending). Report `θ_i = log π_i` for readability.

Pure TypeScript, no numerical dependencies.

## Overall (cross-round) ranking

- **Current cumulative:** sum of LLM `finalScore` across ranked rounds (mirrors
  the live leaderboard).
- **BT cumulative:** sum of per-round BT points across ranked rounds. Per-round
  BT points are derived from that round's ranking (e.g. rank-based or normalized
  strength — implementation detail fixed in the plan), so the aggregate mirrors
  the "sum of round results" structure of the current leaderboard.
- Pooled single-fit-across-all-rounds is explicitly **out of scope** for v1
  (noted as a possible later addition).

## Outputs

Primary: a self-contained **HTML report** `bt-report-<GAMECODE>.html`, plus a
printed console summary.

- **Per ranked round:** table `player | LLM score | LLM rank | BT strength (θ) |
  BT rank | Δrank`, sorted, biggest movers highlighted; **Spearman ρ** and
  **Kendall τ** between the two rankings; and a **judge-disagreement rate** (how
  often the three judges disagree on pairwise orderings) — this shows whether BT
  *could* diverge at all.
- **Overall:** current cumulative leaderboard vs BT cumulative leaderboard, with
  ρ / τ.
- **Headline verdict:** one line, `overall LLM-vs-BT ρ = 0.xx`, directly
  answering "if they correlate, keep the current system."

## Components

- `scripts/lib/bradley-terry.ts` — pure functions: build pairwise counts from
  per-judge scores, MM fit, Spearman ρ, Kendall τ, judge-disagreement rate.
  No Firestore, no I/O → unit-testable in isolation.
- `scripts/lib/report.ts` — renders the HTML report from computed results.
- `scripts/bt-rescore.ts` — entry point: init `firebase-admin` with ADC +
  projectId `ml2-master-game`, load game + submissions, orchestrate per-round and
  overall analysis, write report + console summary. Lists available games when no
  code is passed.

## Tech / setup

- Run with `npx tsx scripts/bt-rescore.ts <GAMECODE>`.
- Add `firebase-admin` and `tsx` as **root devDependencies** (root currently only
  has the client `firebase` SDK).
- Auth via existing Application Default Credentials
  (`~/.config/gcloud/application_default_credentials.json`).

## Testing

- Unit tests for `bradley-terry.ts`: known small cases (transitive triple →
  correct order; all-agree judges → BT order matches average order; a
  scale-compression case where BT and average diverge; tie handling; perfect
  separation stays finite; ρ/τ against hand-computed values).
- Manual end-to-end run against one real past game, eyeballing the HTML report.

## Explicitly out of scope (v1)

- Any change to live judging / cloud functions.
- New LLM pairwise-comparison calls.
- Pooled cross-round single BT fit.
- The multi-teacher / registration work (that's change #2, a separate cycle).
