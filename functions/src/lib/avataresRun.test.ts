import { describe, expect, it } from 'vitest';
import { conTimeout, correrAvatares, type TareaAvatar } from './avataresRun';

const ids = ['p1', 'p2'];
const tarea = (ref: string, yaCompleto = false): TareaAvatar => ({ ref, texto: 't', provider: 'openai', model: 'm', yaCompleto });

describe('conTimeout', () => {
  it('rechaza si la promesa no termina a tiempo', async () => {
    await expect(conTimeout(new Promise(() => {}), 20)).rejects.toThrow(/timeout/);
  });
  it('deja pasar la que termina', async () => {
    await expect(conTimeout(Promise.resolve(3), 50)).resolves.toBe(3);
  });
});

describe('correrAvatares', () => {
  it('salta las personas que ya estan completas (re-correr no repite trabajo)', async () => {
    const llamadas: string[] = [];
    const r = await correrAvatares({
      tareas: [tarea('r1', true), tarea('r2')], ids,
      llamar: async (t) => { llamadas.push(t.ref); return { p1: 4, p2: 2 }; },
      guardar: async () => {},
    });
    expect(llamadas).toEqual(['r2']);
    expect(r).toEqual({ n: 1, fallos: [], saltados: 1 });
  });
  it('una llamada colgada vence por timeout, se reintenta una vez y queda como fallo sin colgar la corrida', async () => {
    let intentos = 0;
    const guardados: Record<string, unknown> = {};
    const r = await correrAvatares({
      tareas: [tarea('r1'), tarea('r2')], ids, timeoutMs: 30,
      llamar: async (t) => { if (t.ref === 'r1') { intentos++; return new Promise(() => {}); } return { p1: 5, p2: 5 }; },
      guardar: async (id, doc) => { guardados[id] = doc; },
    });
    expect(intentos).toBe(2);
    expect(r.n).toBe(1);
    expect(r.fallos).toEqual(['a_m_r1']);
    expect((guardados.a_m_r1 as { faltantes: string[] }).faltantes).toEqual(ids);
  });
  it('respeta el tope de concurrencia con una cola constante', async () => {
    let enVuelo = 0, maximo = 0;
    await correrAvatares({
      tareas: Array.from({ length: 10 }, (_, i) => tarea(`r${i}`)), ids, concurrencia: 3,
      llamar: async () => {
        enVuelo++; maximo = Math.max(maximo, enVuelo);
        await new Promise((res) => setTimeout(res, 5));
        enVuelo--;
        return { p1: 3, p2: 3 };
      },
      guardar: async () => {},
    });
    expect(maximo).toBe(3);
  });
  it('si guardar falla para una persona, las demas siguen y esa cuenta como fallo', async () => {
    const r = await correrAvatares({
      tareas: [tarea('r1'), tarea('r2')], ids,
      llamar: async () => ({ p1: 1, p2: 1 }),
      guardar: async (id) => { if (id === 'a_m_r1') throw new Error('firestore'); },
    });
    expect(r.n).toBe(1);
    expect(r.fallos).toEqual(['a_m_r1']);
  });
});
