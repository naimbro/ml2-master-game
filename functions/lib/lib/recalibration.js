"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortByProvisional = sortByProvisional;
exports.swissPairs = swissPairs;
exports.recalibrateScores = recalibrateScores;
exports.pickClimax = pickClimax;
const bradley_terry_1 = require("./bradley-terry");
const stats_1 = require("./stats");
/** Original indices ordered by provisional score desc; tie-break by id (deterministic). */
function sortByProvisional(players) {
    return players
        .map((p, idx) => idx)
        .sort((a, b) => players[b].prov - players[a].prov || (players[a].id < players[b].id ? -1 : 1));
}
/**
 * Swiss / score-adjacency band pairs over an already-sorted index order.
 * For each gap d = 1..B, pair (order[k], order[k+d]) — no wraparound, so the top
 * and bottom are never paired directly. Returns pairs of ORIGINAL indices.
 */
function swissPairs(order, B) {
    const n = order.length;
    const pairs = [];
    for (let d = 1; d <= Math.min(B, n - 1); d++) {
        for (let k = 0; k + d < n; k++)
            pairs.push([order[k], order[k + d]]);
    }
    return pairs;
}
/**
 * Anchored Bradley–Terry recalibration.
 * Win matrix = fresh pairwise duels (full weight) + w_anchor · provisional-derived
 * votes over ALL pairs (supplies long-range order the band omits). Fit, then map
 * the log-strengths back onto the provisional score scale (same mean & sd) so only
 * the ordering changes. Returns recalibrated score per player id.
 *
 * The result is clamped to [0, 100]. Matching the moments of a distribution that
 * already hugs an end of the scale pushes players past it — game UVMJW3 round 5 had
 * provisionals [8, 0, 0] and shipped a final score of -2 to a student. When the clamp
 * bites, the mean/sd match is given up: a score outside the scale is simply invalid,
 * and the ordering (the only thing recalibration is meant to change) survives because
 * clamping is monotonic.
 */
function recalibrateScores(players, duels, wAnchor) {
    const ids = players.map((p) => p.id);
    const n = ids.length;
    const wins = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const d of duels) {
        if (d.winner === 0)
            wins[d.i][d.j] += 1;
        else if (d.winner === 1)
            wins[d.j][d.i] += 1;
        else {
            wins[d.i][d.j] += 0.5;
            wins[d.j][d.i] += 0.5;
        }
    }
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const diff = players[i].prov - players[j].prov;
            if (diff > 0)
                wins[i][j] += wAnchor;
            else if (diff < 0)
                wins[j][i] += wAnchor;
            else {
                wins[i][j] += wAnchor / 2;
                wins[j][i] += wAnchor / 2;
            }
        }
    }
    const bt = (0, bradley_terry_1.fitBradleyTerryFromWins)(ids, wins);
    const thetas = ids.map((id) => bt.logStrength[id]);
    const provs = players.map((p) => p.prov);
    const rescaled = (0, stats_1.linearMatchMoments)(thetas, provs);
    const out = {};
    ids.forEach((id, i) => (out[id] = Math.min(100, Math.max(0, rescaled[i]))));
    return out;
}
/**
 * Pick the most dramatic upset: among duels where the winner had the WORSE
 * (higher) provisional rank, the one with the largest rank gap (biggest
 * giant-killing), tie-broken by the lower (better) loser rank. `provRank[k]` is
 * the provisional rank of player index k. Returns the duel's array index, or null.
 */
function pickClimax(duels, provRank) {
    let best = -1, bestGap = 0, bestLoserRank = Infinity;
    duels.forEach((d, idx) => {
        if (d.winner === -1)
            return;
        const winIdx = d.winner === 0 ? d.i : d.j;
        const loseIdx = d.winner === 0 ? d.j : d.i;
        const gap = provRank[winIdx] - provRank[loseIdx];
        if (gap <= 0)
            return;
        if (gap > bestGap || (gap === bestGap && provRank[loseIdx] < bestLoserRank)) {
            best = idx;
            bestGap = gap;
            bestLoserRank = provRank[loseIdx];
        }
    });
    return best === -1 ? null : best;
}
//# sourceMappingURL=recalibration.js.map