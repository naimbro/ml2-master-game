"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JUDGE_OVERRIDE_FIELDS = void 0;
exports.applyJudgeOverrides = applyJudgeOverrides;
// Per-course judge persona overrides, layered over the seeded config/judges baseline.
//
// The whitelist below is the safety boundary: only these four persona fields can be
// overridden from the frontend. provider/model/promptTemplate are never copied, so a
// hand-edited or hostile override doc can neither change which model runs nor alter the
// prompt template the scoring JSON contract depends on.
exports.JUDGE_OVERRIDE_FIELDS = ['name', 'avatar', 'personality', 'evaluationStyle'];
function applyJudgeOverrides(judges, overrides) {
    if (!overrides)
        return judges;
    return judges.map((judge) => {
        const ov = overrides[judge.judgeId];
        if (!ov || typeof ov !== 'object')
            return judge;
        const source = ov;
        const picked = {};
        for (const field of exports.JUDGE_OVERRIDE_FIELDS) {
            const value = source[field];
            if (typeof value === 'string' && value.trim() !== '') {
                picked[field] = value;
            }
        }
        return { ...judge, ...picked };
    });
}
//# sourceMappingURL=judgeOverrides.js.map