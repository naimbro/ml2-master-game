// Timing for multiple-choice blocks.
//
// A scenario's `durationSeconds` drives the ROUND timer, which the host uses to
// auto-end the round (useGame.ts). The per-question MC timers are independent
// local intervals. If durationSeconds is too small the host guillotines the
// block mid-question, so it is derived rather than hand-typed.

/**
 * Seconds the MC block intro stays up before starting itself. Gives latecomers
 * time to orient and lets an audio clue play before any clock runs.
 * Must match the gate in Round.tsx (imported from here).
 */
export const MC_GATE_SECONDS = 12;

/** Post-answer feedback pause per question, rounded up from the 2.5s in Round.tsx. */
export const MC_FEEDBACK_SECONDS = 5;

/** Extra headroom so a slow phone or a late joiner never gets cut off. */
export const MC_SLACK_SECONDS = 15;

export const MC_DEFAULT_TIME_LIMIT = 20;

/**
 * Should the current MC question be auto-recorded as timed out?
 *
 * The countdown state starts at 0, so "secondsLeft === 0" alone is also true in
 * the render *before* the timer effect has loaded the real limit. Reading only
 * that flag made every question 0 of every block instantly time out — the whole
 * round in a single-question block.
 *
 * `armedQuestion` is set by the timer effect when it actually starts a
 * question's clock, so the timeout can never fire for a question whose clock
 * was never armed, regardless of the order React happens to run effects in.
 */
export function isQuestionTimedOut({
  armedQuestion,
  currentQuestion,
  secondsLeft,
}: {
  armedQuestion: number | null;
  currentQuestion: number;
  secondsLeft: number;
}): boolean {
  if (armedQuestion === null) return false;
  if (armedQuestion !== currentQuestion) return false;
  return secondsLeft <= 0;
}

/**
 * Round duration for an MC block:
 *   gate + sum(question limits) + feedback per question + slack
 *
 * e.g. 2 questions x 20s -> 12 + 40 + 10 + 15 = 77
 *      2 questions x 25s -> 12 + 50 + 10 + 15 = 87
 *      1 question  x 25s -> 12 + 25 +  5 + 15 = 57
 */
export function derivedMCRoundDuration(
  mcQuestions: Array<{ timeLimitSeconds?: number }> | undefined,
): number {
  const questions = mcQuestions ?? [];
  if (questions.length === 0) return MC_GATE_SECONDS + MC_SLACK_SECONDS;

  const limits = questions.reduce((sum, q) => {
    const limit = Number(q?.timeLimitSeconds);
    return sum + (Number.isFinite(limit) && limit > 0 ? limit : MC_DEFAULT_TIME_LIMIT);
  }, 0);

  return (
    MC_GATE_SECONDS +
    limits +
    MC_FEEDBACK_SECONDS * questions.length +
    MC_SLACK_SECONDS
  );
}
