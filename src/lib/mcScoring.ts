// Multiple-choice scoring — pure, deterministic, unit-tested.
//
// MC rounds must land on the SAME 0-100 ruler the LLM judges use. Judges never
// emit a number: they pick one of six written anchors per rubric dimension
// (see functions/src/lib/scoring.ts ANCHORS = [0,20,40,60,80,100]). MC mirrors
// that vocabulary:
//
//   correct           -> 70 + 30 * speedFactor   (70..100)
//   answered, wrong   -> 20                      ("intento y fallo" anchor)
//   no answer/timeout -> 0                       ("nada" anchor)
//
// Correctness is worth 70, speed at most 30, so a slow-but-right answer always
// beats a fast-but-wrong one and speed can never dominate the leaderboard.
//
// No Date.now() in here — elapsed time is a parameter, so every case is
// reproducible in tests.

import type { MCResponse } from '../types/game';

export const MC_CORRECT_BASE = 70;
export const MC_SPEED_BONUS_MAX = 30;
export const MC_WRONG_POINTS = 20;
export const MC_NO_ANSWER_POINTS = 0;

/** Human-readable legend shown to players so the scoring is never a black box. */
export const MC_SCORING_LEGEND =
  'Correcta 70-100 segun rapidez · Incorrecta 20 · Sin responder 0 · ' +
  'Las rondas abiertas usan la misma escala 0-100';

export interface ScoreMCQuestionInput {
  /** Did the player pick the right option? Ignored when `answered` is false. */
  correct: boolean;
  /** False when the question timed out with no selection. */
  answered: boolean;
  /** Milliseconds between the question appearing and the player answering. */
  elapsedMs: number;
  /** The question's own time limit, in seconds. */
  timeLimitSeconds: number;
}

/**
 * Fraction of the time limit still unspent, clamped to [0, 1].
 * 1.0 = instant answer, 0.0 = answered at (or after) the buzzer.
 */
export function speedFactor(elapsedMs: number, timeLimitSeconds: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(timeLimitSeconds) || timeLimitSeconds <= 0) {
    return 0;
  }
  const elapsedSeconds = Math.max(0, elapsedMs) / 1000;
  return Math.min(1, Math.max(0, 1 - elapsedSeconds / timeLimitSeconds));
}

/** Points for a single MC question. Always an integer in [0, 100]. */
export function scoreMCQuestion({
  correct,
  answered,
  elapsedMs,
  timeLimitSeconds,
}: ScoreMCQuestionInput): number {
  if (!answered) return MC_NO_ANSWER_POINTS;
  if (!correct) return MC_WRONG_POINTS;
  const bonus = Math.round(MC_SPEED_BONUS_MAX * speedFactor(elapsedMs, timeLimitSeconds));
  return MC_CORRECT_BASE + bonus;
}

/**
 * Block score = mean over the block's TOTAL questions, not just the answered
 * ones. Dividing by answered questions let a player who abandoned a block after
 * one lucky answer outscore a player who completed it.
 *
 * Always an integer in [0, 100]; 0 for an empty or malformed block.
 */
export function scoreMCBlock(responses: MCResponse[], totalQuestions: number): number {
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) return 0;
  if (!responses || responses.length === 0) return 0;

  const total = responses.reduce((sum, r) => {
    const points = Number(r?.pointsAwarded);
    return sum + (Number.isFinite(points) ? points : 0);
  }, 0);

  const mean = total / totalQuestions;
  return Math.max(0, Math.min(100, Math.round(mean)));
}
