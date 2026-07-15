"use strict";
/**
 * Score arithmetic.
 *
 * Everything in this file used to be done by gpt-4o inside its own JSON output:
 * the weighted sum of dimension scores, and the hard ceilings from the rubric's
 * global penalties. That asked the model to notice a violation, recall a rule,
 * and do three-term arithmetic mid-generation — before it had written a single
 * word of analysis, since `score` was the first key it emitted.
 *
 * The split now is: the judge makes JUDGMENTS (which anchor does each dimension
 * hit; which penalties does this answer trigger). This module does ARITHMETIC.
 * A score is therefore reproducible from the judge's JSON, and explainable to a
 * student line by line.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANCHORS = void 0;
exports.snapToAnchor = snapToAnchor;
exports.parseWeightFormula = parseWeightFormula;
exports.resolveDimensionWeights = resolveDimensionWeights;
exports.loadPenalties = loadPenalties;
exports.slugifyPenalty = slugifyPenalty;
exports.computeJudgeScore = computeJudgeScore;
const parse_1 = require("./parse");
/** The six rubric anchors. Every rubric defines prose for exactly these levels. */
exports.ANCHORS = [0, 20, 40, 60, 80, 100];
/** Snap a number to the nearest of the six rubric anchors. */
function snapToAnchor(n) {
    return exports.ANCHORS.reduce((best, a) => (Math.abs(a - n) < Math.abs(best - n) ? a : best), exports.ANCHORS[0]);
}
/**
 * Parse `"score = 0.55 * process_structuring + 0.20 * institutional_realism"`
 * into `{process_structuring: 0.55, institutional_realism: 0.20}`.
 *
 * These formula strings already exist in every session's `judgeConfig`, where
 * they were being handed to the LLM as prose to evaluate. They are perfectly
 * regular, so we can execute them instead of asking a language model to.
 *
 * Returns null if nothing parses, so callers can fall back to rubric weights.
 */
function parseWeightFormula(formula) {
    if (!formula)
        return null;
    const weights = {};
    const term = /(\d*\.?\d+)\s*\*\s*([A-Za-z_][A-Za-z0-9_]*)/g;
    let match;
    while ((match = term.exec(formula)) !== null) {
        weights[match[2]] = parseFloat(match[1]);
    }
    return Object.keys(weights).length > 0 ? weights : null;
}
/**
 * Decide the dimension weights for one judge on one session.
 *
 * Precedence: the session's per-judge formula, then the rubric's own per-dimension
 * weights, then a uniform split. Weights are renormalized to sum to 1 over the
 * dimensions the rubric actually declares — a formula naming a stale dimension id
 * (these have drifted before; see base_rubric.json `_id_mapping_note`) contributes
 * nothing rather than silently rescaling everyone else.
 */
function resolveDimensionWeights(weightFormula, rubricDimensions) {
    const ids = rubricDimensions.map((d) => d.id);
    const parsed = parseWeightFormula(weightFormula);
    const source = {};
    for (const id of ids) {
        if (parsed && typeof parsed[id] === 'number') {
            source[id] = parsed[id];
        }
        else if (!parsed) {
            const dim = rubricDimensions.find((d) => d.id === id);
            source[id] = typeof (dim === null || dim === void 0 ? void 0 : dim.weight) === 'number' ? dim.weight : 1 / ids.length;
        }
    }
    // A formula that named only stale ids leaves `source` empty — fall back rather
    // than divide by zero.
    const total = Object.values(source).reduce((a, b) => a + b, 0);
    if (total <= 0) {
        const uniform = {};
        for (const id of ids)
            uniform[id] = 1 / ids.length;
        return uniform;
    }
    const normalized = {};
    for (const id of Object.keys(source))
        normalized[id] = source[id] / total;
    return normalized;
}
/**
 * Read penalty definitions from a rubric.
 *
 * Two formats are supported. `penalties` is the structured form: ids and machine-
 * applicable effects. `globalPenalties` / `hardPenalties` are the legacy prose
 * arrays ("Solucionismo tecnologico: ... no puede superar 60 en ..."), where the
 * effect lives inside a Spanish sentence. Legacy penalties are loaded so the judge
 * can still be shown them and can still report triggering them — but with no
 * `effect`, they are advisory and never move the score. That is a deliberate
 * downgrade: prose whose cap we cannot execute should not be silently trusted to
 * an LLM's arithmetic either.
 *
 * Ids for legacy entries come from the text before the first colon, which every
 * existing penalty string has ("Falsa precision: si el estudiante inventa ...").
 */
function loadPenalties(rubric) {
    const structured = rubric.penalties;
    if (Array.isArray(structured) && structured.length > 0) {
        return structured;
    }
    const legacy = [
        ...(rubric.globalPenalties || []),
        ...(rubric.hardPenalties || []),
    ];
    const defs = [];
    for (const entry of legacy) {
        // Prose form: "Falsa precision: si inventa cifras..." — the ceiling is buried in
        // a Spanish sentence, so it stays advisory and the judge self-enforces it.
        if (typeof entry === 'string' && entry.trim() !== '') {
            defs.push({ id: slugifyPenalty(entry), description: entry });
            continue;
        }
        // Object form, used by the ml2 RAG sessions: {condition, cap, dimension}.
        // This one IS machine-applicable, so it gets a real effect.
        if (entry && typeof entry === 'object') {
            const e = entry;
            const condition = typeof e.condition === 'string' ? e.condition : '';
            const cap = (0, parse_1.coerceScore)(e.cap);
            const dimension = typeof e.dimension === 'string' ? e.dimension : '';
            if (condition && dimension && Number.isFinite(cap)) {
                defs.push({
                    id: slugifyPenalty(condition),
                    description: condition,
                    effect: { type: 'cap', value: cap, dimensions: [dimension] },
                });
            }
            else if (condition) {
                defs.push({ id: slugifyPenalty(condition), description: condition });
            }
        }
    }
    return defs;
}
/** "Falsa precision: si inventa cifras..." -> "falsa_precision" */
function slugifyPenalty(text) {
    const head = text.split(':')[0];
    return head
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
}
/**
 * Turn one judge's raw JSON into a score.
 *
 * `dimensionScores` are coerced (gpt-4o sometimes quotes them), clamped, and
 * snapped to the six anchors — the judge is asked to pick an anchor, so anything
 * off-anchor is drift we correct rather than honour.
 *
 * Caps are applied before deductions, so a capped dimension can still be deducted
 * below the cap. A dimension missing from the judge's output is treated as missing,
 * not as zero: it drops out and the remaining weights renormalize, exactly as a
 * failed judge drops out of the panel mean.
 */
function computeJudgeScore(rawScores, penaltiesReported, weights, penaltyDefs) {
    const rawDimensionScores = {};
    for (const id of Object.keys(weights)) {
        const value = (0, parse_1.coerceScore)(rawScores === null || rawScores === void 0 ? void 0 : rawScores[id]);
        if (Number.isFinite(value)) {
            rawDimensionScores[id] = snapToAnchor(Math.max(0, Math.min(100, value)));
        }
    }
    if (Object.keys(rawDimensionScores).length === 0) {
        return {
            score: 0,
            rawDimensionScores: {},
            dimensionScores: {},
            appliedPenalties: [],
            unknownPenalties: [],
            failed: true,
        };
    }
    const dimensionScores = { ...rawDimensionScores };
    const appliedPenalties = [];
    const unknownPenalties = [];
    const reported = Array.isArray(penaltiesReported)
        ? penaltiesReported.filter((p) => typeof p === 'string')
        : [];
    const byId = new Map(penaltyDefs.map((p) => [p.id, p]));
    const triggered = [];
    for (const id of reported) {
        const def = byId.get(id);
        if (def)
            triggered.push(def);
        else
            unknownPenalties.push(id);
    }
    const applyEffect = (kind) => {
        for (const def of triggered) {
            if (!def.effect || def.effect.type !== kind)
                continue;
            for (const dim of def.effect.dimensions) {
                if (!(dim in dimensionScores))
                    continue;
                const from = dimensionScores[dim];
                const to = kind === 'cap'
                    ? Math.min(from, def.effect.value)
                    : Math.max(0, from - def.effect.value);
                if (to !== from) {
                    dimensionScores[dim] = to;
                    appliedPenalties.push({ id: def.id, dimension: dim, type: kind, from, to });
                }
            }
        }
    };
    applyEffect('cap');
    applyEffect('deduct');
    let weighted = 0;
    let totalWeight = 0;
    for (const [id, weight] of Object.entries(weights)) {
        if (!(id in dimensionScores))
            continue;
        weighted += dimensionScores[id] * weight;
        totalWeight += weight;
    }
    return {
        score: totalWeight > 0 ? Math.round(weighted / totalWeight) : 0,
        rawDimensionScores,
        dimensionScores,
        appliedPenalties,
        unknownPenalties,
        failed: false,
    };
}
//# sourceMappingURL=scoring.js.map