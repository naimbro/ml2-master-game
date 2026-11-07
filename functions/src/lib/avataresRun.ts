// Orquestacion de los avatares (spec 2026-11-07, M2), separada del callable para
// poder probarla. Cola de concurrencia constante (no olas: una ola espera a su
// llamada mas lenta), timeout por llamada, un reintento, y salto de las personas
// que ya quedaron completas en una corrida anterior.
import { idAvatarFn, normalizarVotos, PROMPT_VERSION } from './avatares';
import type { JudgeProvider } from './judgeModels';

export interface TareaAvatar {
  ref: string;
  texto: string;
  provider: JudgeProvider;
  model: string;
  /** La persona ya existe sin faltantes: no se vuelve a llamar al modelo. */
  yaCompleto: boolean;
}

export interface DocAvatar {
  id: string; ref: string; fuente: 'avatar'; via: 'app'; modelo: string; condicion: string;
  votos: Record<string, number>; faltantes: string[];
}

export function conTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const vence = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`timeout tras ${ms} ms`)), ms); });
  return Promise.race([p, vence]).finally(() => clearTimeout(t));
}

export async function correrAvatares(opts: {
  tareas: TareaAvatar[];
  ids: string[];
  llamar: (t: TareaAvatar) => Promise<Record<string, unknown>>;
  guardar: (id: string, doc: DocAvatar) => Promise<void>;
  concurrencia?: number;
  timeoutMs?: number;
  avisar?: (msg: string, extra: Record<string, unknown>) => void;
}): Promise<{ n: number; fallos: string[]; saltados: number }> {
  const { tareas, ids, llamar, guardar, concurrencia = 8, timeoutMs = 60_000, avisar = () => {} } = opts;
  const pendientes = tareas.filter((t) => !t.yaCompleto);
  const saltados = tareas.length - pendientes.length;
  const fallos: string[] = [];
  let n = 0;
  let siguiente = 0;

  async function una(t: TareaAvatar) {
    const id = idAvatarFn(t.model, t.ref);
    let votos: Record<string, number> = {};
    for (let intento = 0; intento < 2 && Object.keys(votos).length < ids.length; intento++) {
      try {
        const raw = await conTimeout(llamar(t), timeoutMs);
        votos = { ...votos, ...normalizarVotos(raw, ids).votos };
      } catch (e) {
        avisar('avatar fallo', { model: t.model, ref: t.ref, error: (e as Error).message });
      }
    }
    const faltantes = ids.filter((k) => !(k in votos));
    try {
      await guardar(id, { id, ref: t.ref, fuente: 'avatar', via: 'app', modelo: t.model, condicion: PROMPT_VERSION, votos, faltantes });
    } catch (e) {
      avisar('avatar no guardado', { id, error: (e as Error).message });
      fallos.push(id);
      return;
    }
    if (faltantes.length === ids.length) fallos.push(id);
    else n += 1;
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
