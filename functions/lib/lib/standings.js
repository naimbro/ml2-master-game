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
exports.pickOfficialGames = pickOfficialGames;
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
/**
 * Una clase = un juego. De todos los juegos terminados de una misma sesion se
 * cuenta uno solo: el que tiene mas alumnos que respondieron.
 *
 * Existe porque `dataviz_2026` llego a la primera clase con SEIS juegos de
 * `clase_01_diagnostico`, cinco de ellos pruebas de 1 o 2 cuentas, y la tabla
 * los sumaba todos. Depender de que el profesor se acuerde de apretar "No
 * contar" cinco veces es exactamente el paso que se olvida el dia que importa.
 * Una prueba tiene 1 o 2 jugadores y la clase real tiene 33: se separan solas.
 *
 * El desempate va por fecha y despues por codigo, para que dos corridas seguidas
 * del recalculo no elijan juegos distintos.
 *
 * `excludedGameCodes` se aplica ANTES que esto, asi que sigue sirviendo de
 * anulacion manual: excluir el juego que quedo oficial promueve al siguiente.
 */
function pickOfficialGames(games) {
    const answered = (g) => g.players.filter((p) => p.answered).length;
    // Un juego sin sessionId no se puede agrupar con nadie: se agrupa consigo
    // mismo y siempre cuenta, en vez de competir con juegos de otra clase.
    const groups = new Map();
    for (const g of games) {
        const key = g.sessionId || `__sin_sesion__${g.gameCode}`;
        const bucket = groups.get(key);
        if (bucket)
            bucket.push(g);
        else
            groups.set(key, [g]);
    }
    const official = [];
    const discarded = [];
    for (const bucket of groups.values()) {
        const [best, ...rest] = [...bucket].sort((a, b) => answered(b) - answered(a) ||
            b.finishedAtMs - a.finishedAtMs ||
            a.gameCode.localeCompare(b.gameCode));
        official.push(best);
        discarded.push(...rest);
    }
    return {
        official: official.sort((a, b) => a.finishedAtMs - b.finishedAtMs),
        discarded: discarded.sort((a, b) => a.finishedAtMs - b.finishedAtMs),
    };
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
    var _a, _b;
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
    // La tabla del curso congelada despues de cada clase. Se recalcula entera k
    // veces en vez de acumularse de a poco a proposito: las posiciones salen de
    // `positionsFromTotals`, que resuelve los empates con ranking de competencia
    // estandar, y reimplementar eso aca en un acumulador seria la forma de que
    // esta figura y la tabla dejen de coincidir sin que nadie se de cuenta.
    const cumulativeByGame = new Map(uids.map((uid) => [uid, []]));
    for (let k = 1; k <= perGame.length; k++) {
        const hastaAqui = positionsFromTotals(uids.map((uid) => ({
            uid,
            points: sumSlots(slotsOf(uid, k).map((r) => (r ? r.points : null)), 0),
        })));
        // Quien todavia no habia jugado ninguna clase no tiene puesto: la linea
        // arranca en su primera clase en vez de venir arrastrada desde el fondo.
        const yaJugo = new Set(perGame.slice(0, k).flatMap(({ ranks }) => ranks.map((r) => r.uid)));
        for (const uid of uids) {
            cumulativeByGame.get(uid).push(yaJugo.has(uid) ? (_b = hastaAqui.get(uid)) !== null && _b !== void 0 ? _b : null : null);
        }
    }
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
            cumulativePositionsByGame: cumulativeByGame.get(uid),
            gamesPlayed: slots.filter(Boolean).length,
        };
        if (meta.photoURL)
            entry.photoURL = meta.photoURL;
        return entry;
    });
    return entries.sort((a, b) => a.position - b.position || a.uid.localeCompare(b.uid));
}
//# sourceMappingURL=standings.js.map