"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSwissComparisons = runSwissComparisons;
exports.buildComparePrompt = buildComparePrompt;
const recalibration_1 = require("./lib/recalibration");
/**
 * Run the Swiss band-B schedule with `concurrency` parallel comparisons.
 *
 * Every pair is judged TWICE, once in each presentation order (LCES eq. 1,
 * Shibata & Miyamura 2025). A verdict that survives the swap is about the
 * answers; one that flips is about the position, and counts as a tie.
 *
 * Measured on 1455 pairs drawn from this very schedule (scripts/bt-calibrate.ts
 * caches both orders): 31.8% ± 1.2pp of verdicts flip. That is far above the
 * 13.5% we first measured on index-adjacent pairs, because the Swiss band pairs
 * answers that are CLOSE — deliberately — and closeness is exactly where the
 * model stops being able to tell them apart. If anything 31.8% understates it:
 * the sweep samples bands 1..5 and production uses 1..4, and the wider bands
 * flip less.
 *
 * The previous hash-picked presentation order is gone: it spread the bias evenly
 * instead of favouring the top or the bottom of the table, but it turned that bias
 * into per-duel noise rather than removing it.
 *
 * Returns DuelResults (indices into `players`, winner 0=i / 1=j / -1=tie).
 */
async function runSwissComparisons(players, contextPrompt, B, compare, concurrency, onDuel) {
    const order = (0, recalibration_1.sortByProvisional)(players);
    const pairs = (0, recalibration_1.swissPairs)(order, B);
    const out = new Array(pairs.length);
    let ti = 0;
    async function worker() {
        while (ti < pairs.length) {
            const idx = ti++;
            const [i, j] = pairs[idx];
            const a = players[i], b = players[j];
            // Las dos llamadas van en paralelo: mantiene ~`concurrency` duelos en vuelo
            // y deja el wall-clock donde estaba.
            const [fwd, rev] = await Promise.all([
                compare(a.response, b.response),
                compare(b.response, a.response),
            ]);
            // fwd: 'A' => gana a (mostrado primero).  rev: 'A' => gana b (mostrado primero).
            const fwdWinner = fwd === 'A' ? 0 : fwd === 'B' ? 1 : -1;
            const revWinner = rev === 'A' ? 1 : rev === 'B' ? 0 : -1;
            // Sólo cuenta si los dos órdenes deciden Y coinciden. Si se contradicen, o si
            // alguno responde empate (incluido el 'tie' que index.ts devuelve cuando la
            // llamada falla), el par es empate: no reordenamos con datos que no aguantan.
            const winner = fwdWinner !== -1 && fwdWinner === revWinner ? fwdWinner : -1;
            out[idx] = { i, j, winner };
            if (onDuel)
                await onDuel({ seq: idx, i, j, winner });
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, pairs.length || 1) }, worker));
    // contextPrompt is used by the real comparator (built in index.ts); kept in the
    // signature so the caller passes it through to `compare` via closure.
    void contextPrompt;
    return out;
}
/** Build the system prompt for a round's head-to-head comparisons. */
function buildComparePrompt(context) {
    return `Eres un evaluador experto y consistente. Tarea y criterios:\n\n${context}\n\nSe te muestran dos respuestas (A y B). Elige la MEJOR segun los criterios; no empates salvo que sean indistinguibles. Responde SOLO JSON: {"winner":"A"} o {"winner":"B"}.`;
}
//# sourceMappingURL=pairwise.js.map