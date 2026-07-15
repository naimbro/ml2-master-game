// Per-course judge persona overrides, layered over the seeded config/judges baseline.
//
// The whitelist below is the safety boundary: only these four persona fields can be
// overridden from the frontend. provider/model/promptTemplate are never copied, so a
// hand-edited or hostile override doc can neither change which model runs nor alter the
// prompt template the scoring JSON contract depends on.
export const JUDGE_OVERRIDE_FIELDS = ['name', 'avatar', 'personality', 'evaluationStyle'] as const;
export type JudgeOverrideField = (typeof JUDGE_OVERRIDE_FIELDS)[number];

export type JudgeOverride = Partial<Record<JudgeOverrideField, string>>;
/** Keyed by judgeId. May also contain metadata keys (updatedAt/updatedBy) — ignored. */
export type JudgeOverrides = Record<string, unknown>;

export function applyJudgeOverrides<T extends { judgeId: string }>(
  judges: T[],
  overrides: JudgeOverrides | null | undefined,
): T[] {
  if (!overrides) return judges;
  return judges.map((judge) => {
    const ov = overrides[judge.judgeId];
    if (!ov || typeof ov !== 'object') return judge;
    const source = ov as Record<string, unknown>;
    const picked: JudgeOverride = {};
    for (const field of JUDGE_OVERRIDE_FIELDS) {
      const value = source[field];
      if (typeof value === 'string' && value.trim() !== '') {
        picked[field] = value;
      }
    }
    return { ...judge, ...picked };
  });
}
