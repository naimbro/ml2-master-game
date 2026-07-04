"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceScore = coerceScore;
/**
 * Coerce a Firestore-stored score to a number.
 *
 * Some sessions store judge scores as numeric strings (e.g. "60") because the
 * evaluating model returned them quoted in its JSON; others store real numbers.
 * A plain `Number.isFinite` guard wrongly rejects the string form and would drop
 * those judge votes entirely. This parses numeric strings, passes numbers
 * through, and returns NaN only for genuinely missing / non-numeric values so
 * callers can filter with `Number.isFinite`.
 */
function coerceScore(v) {
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string') {
        const t = v.trim();
        if (t === '')
            return NaN;
        return Number(t);
    }
    return NaN;
}
//# sourceMappingURL=parse.js.map