"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conTimeout = conTimeout;
exports.correrAvatares = correrAvatares;
// Orquestacion de los avatares (spec 2026-11-07, M2), separada del callable para
// poder probarla. Cola de concurrencia constante (no olas: una ola espera a su
// llamada mas lenta), timeout por llamada, un reintento, y salto de las personas
// que ya quedaron completas en una corrida anterior.
const avatares_1 = require("./avatares");
function conTimeout(p, ms) {
    let t;
    const vence = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`timeout tras ${ms} ms`)), ms); });
    return Promise.race([p, vence]).finally(() => clearTimeout(t));
}
async function correrAvatares(opts) {
    const { tareas, ids, llamar, guardar, concurrencia = 8, timeoutMs = 60000, avisar = () => { } } = opts;
    const pendientes = tareas.filter((t) => !t.yaCompleto);
    const saltados = tareas.length - pendientes.length;
    const fallos = [];
    let n = 0;
    let siguiente = 0;
    async function una(t) {
        const id = (0, avatares_1.idAvatarFn)(t.model, t.ref);
        let votos = {};
        for (let intento = 0; intento < 2 && Object.keys(votos).length < ids.length; intento++) {
            try {
                const raw = await conTimeout(llamar(t), timeoutMs);
                votos = { ...votos, ...(0, avatares_1.normalizarVotos)(raw, ids).votos };
            }
            catch (e) {
                avisar('avatar fallo', { model: t.model, ref: t.ref, error: e.message });
            }
        }
        const faltantes = ids.filter((k) => !(k in votos));
        try {
            await guardar(id, { id, ref: t.ref, fuente: 'avatar', via: 'app', modelo: t.model, condicion: avatares_1.PROMPT_VERSION, votos, faltantes });
        }
        catch (e) {
            avisar('avatar no guardado', { id, error: e.message });
            fallos.push(id);
            return;
        }
        if (faltantes.length === ids.length)
            fallos.push(id);
        else
            n += 1;
    }
    async function trabajador() {
        while (siguiente < pendientes.length) {
            const t = pendientes[siguiente++];
            await una(t);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrencia, pendientes.length) }, trabajador));
    fallos.sort();
    return { n, fallos, saltados };
}
//# sourceMappingURL=avataresRun.js.map