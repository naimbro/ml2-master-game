"use strict";
/**
 * Aritmetica del ranking acumulado por curso. Funciones puras: no tocan Firestore
 * ni saben que es un juego. Las importa la Cloud Function recomputeCourseStandings
 * y tambien scripts/course-standings.ts, para que la tabla que ve el alumno y la
 * que ve el profesor no puedan discrepar.
 *
 * Diseno: docs/superpowers/specs/2026-07-30-leaderboard-acumulado-design.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POINTS_FLOOR = exports.POINTS_TABLE = void 0;
exports.pointsForPosition = pointsForPosition;
exports.rankGame = rankGame;
exports.accumulate = accumulate;
/** Puntos de las diez primeras posiciones. Fija: no depende de cuantos jugaron. */
exports.POINTS_TABLE = [30, 25, 21, 18, 16, 15, 14, 13, 12, 11];
/** Piso para cualquiera que jugo, por mal que le haya ido. */
exports.POINTS_FLOOR = 3;
function pointsForPosition(position) {
    if (!Number.isInteger(position) || position < 1) {
        throw new Error(`Posicion invalida: ${position}`);
    }
    if (position <= exports.POINTS_TABLE.length)
        return exports.POINTS_TABLE[position - 1];
    const last = exports.POINTS_TABLE[exports.POINTS_TABLE.length - 1];
    return Math.max(exports.POINTS_FLOOR, last - (position - exports.POINTS_TABLE.length));
}
/**
 * Posiciones de UN juego. Ranking de competencia estandar: dos empatados en el
 * 2do quedan ambos 2dos con 25 puntos y el siguiente es 4to. Infla un poco el
 * total repartido; es el costo de que la tabla se lea como la gente espera.
 */
function rankGame(players) {
    const played = players.filter((pl) => pl.answered);
    const sorted = [...played].sort((a, b) => b.totalScore - a.totalScore || a.uid.localeCompare(b.uid));
    const rows = [];
    let position = 0;
    let previousScore = null;
    sorted.forEach((pl, index) => {
        if (previousScore === null || pl.totalScore !== previousScore) {
            position = index + 1;
            previousScore = pl.totalScore;
        }
        rows.push({ uid: pl.uid, position, points: pointsForPosition(position) });
    });
    return rows;
}
function byTotalDescending(a, b) {
    return b.points - a.points || a.uid.localeCompare(b.uid);
}
/** Ranking de competencia estandar sobre totales ya calculados. */
function positionsFromTotals(totals) {
    const sorted = [...totals].sort(byTotalDescending);
    const out = new Map();
    let position = 0;
    let previous = null;
    sorted.forEach((row, index) => {
        if (previous === null || row.points !== previous) {
            position = index + 1;
            previous = row.points;
        }
        out.set(row.uid, position);
    });
    return out;
}
function sumSlots(slots, dropWorst) {
    const values = slots.map((v) => v !== null && v !== void 0 ? v : 0);
    if (dropWorst > 0) {
        values.sort((a, b) => a - b);
        values.splice(0, Math.min(dropWorst, values.length));
    }
    return values.reduce((acc, v) => acc + v, 0);
}
function accumulate(games, options = {}) {
    var _a;
    const dropWorst = (_a = options.dropWorst) !== null && _a !== void 0 ? _a : 0;
    const ordered = [...games].sort((a, b) => a.finishedAtMs - b.finishedAtMs);
    if (ordered.length === 0)
        return [];
    const perGame = ordered.map((g) => ({ ranks: rankGame(g.players), game: g }));
    // Participantes = quienes respondieron en al menos un juego. Entrar al lobby y
    // no contestar nunca no te pone en la tabla ni engorda el "de N".
    const played = new Set(perGame.flatMap(({ ranks }) => ranks.map((r) => r.uid)));
    // Identidad y nombre: gana el nombre del juego mas reciente en que aparece.
    const names = new Map();
    for (const { game: g } of perGame) {
        for (const pl of g.players) {
            if (!played.has(pl.uid))
                continue;
            names.set(pl.uid, { name: pl.name, photoURL: pl.photoURL });
        }
    }
    const uids = [...names.keys()];
    const slotsOf = (uid, upTo) => perGame.slice(0, upTo).map(({ ranks }) => { var _a; return (_a = ranks.find((r) => r.uid === uid)) !== null && _a !== void 0 ? _a : null; });
    const totals = uids.map((uid) => ({
        uid,
        points: sumSlots(slotsOf(uid, perGame.length).map((r) => (r ? r.points : null)), dropWorst),
    }));
    const totalPoints = new Map(totals.map((t) => [t.uid, t.points]));
    const positions = positionsFromTotals(totals);
    // La posicion anterior se calcula SIN descarte: es "como iba la semana pasada".
    const previousPositions = perGame.length > 1
        ? positionsFromTotals(uids.map((uid) => ({
            uid,
            points: sumSlots(slotsOf(uid, perGame.length - 1).map((r) => (r ? r.points : null)), 0),
        })))
        : new Map();
    const playedBefore = new Set(perGame.slice(0, -1).flatMap(({ ranks }) => ranks.map((r) => r.uid)));
    const entries = uids.map((uid) => {
        var _a;
        const slots = slotsOf(uid, perGame.length);
        const meta = names.get(uid);
        const entry = {
            uid,
            name: meta.name,
            points: totalPoints.get(uid),
            position: positions.get(uid),
            previousPosition: playedBefore.has(uid) ? (_a = previousPositions.get(uid)) !== null && _a !== void 0 ? _a : null : null,
            pointsByGame: slots.map((r) => (r ? r.points : null)),
            positionsByGame: slots.map((r) => (r ? r.position : null)),
            gamesPlayed: slots.filter(Boolean).length,
        };
        if (meta.photoURL)
            entry.photoURL = meta.photoURL;
        return entry;
    });
    return entries.sort((a, b) => a.position - b.position || a.uid.localeCompare(b.uid));
}
//# sourceMappingURL=standings.js.map