"use strict";
/**
 * Split a judge's prompt template at the student's answer.
 *
 * Everything the template puts BEFORE `{{studentResponse}}` — persona, knowledge
 * base, rubric, scenario, ideal answer — is byte-identical for every student in a
 * round. That is ~5.000 tokens we were re-billing once per student per judge.
 * Handing it to the provider as a separate, marked block lets the first submission
 * of the round write a cache entry and every later one read it.
 *
 * The invariant this file exists to protect: `prefix + suffix` must equal exactly
 * the single string the old code produced. If it ever stops being true, every judge
 * silently starts grading against a subtly different prompt — which is the kind of
 * bug that passes every test and only shows up as scores that feel "off".
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STUDENT_RESPONSE_MARKER = void 0;
exports.splitPrompt = splitPrompt;
exports.STUDENT_RESPONSE_MARKER = '{{studentResponse}}';
/**
 * @param template  the raw `promptTemplate` from config/judges
 * @param fill      applies every placeholder EXCEPT `{{studentResponse}}`. Called
 *                  once per half; a placeholder missing from a half is a no-op, so
 *                  each slot is filled in whichever half actually contains it.
 *                  (Verified: none of the seeded templates repeats a placeholder,
 *                  which is what makes per-half filling equivalent to filling once.)
 * @param studentResponse  the answer being graded
 */
function splitPrompt(template, fill, studentResponse) {
    const at = template.indexOf(exports.STUDENT_RESPONSE_MARKER);
    // No marker: degrade to "nothing is cacheable" rather than to a wrong prompt.
    // This matches the old behavior exactly, including the fact that such a template
    // never received the student's answer at all.
    if (at === -1)
        return { prefix: '', suffix: fill(template) };
    return {
        prefix: fill(template.slice(0, at)),
        suffix: studentResponse + fill(template.slice(at + exports.STUDENT_RESPONSE_MARKER.length)),
    };
}
//# sourceMappingURL=promptSplit.js.map