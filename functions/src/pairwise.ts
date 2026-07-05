import { sortByProvisional, swissPairs, type DuelResult } from './lib/recalibration';

export interface PairwisePlayer {
  id: string;
  prov: number;
  response: string;
}

/** Verdict for one head-to-head: 'A' (first) wins, 'B' (second) wins, or 'tie'. */
export type Comparator = (a: string, b: string) => Promise<'A' | 'B' | 'tie'>;

export interface StreamDuel { seq: number; i: number; j: number; winner: 0 | 1 | -1; }
export type OnDuel = (d: StreamDuel) => void | Promise<void>;

const djb2 = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
};

/**
 * Run the Swiss band-B schedule with `concurrency` parallel comparisons.
 * Presentation order per pair is deterministic (hash) to cancel position bias.
 * Returns DuelResults (indices into `players`, winner 0=i / 1=j / -1=tie).
 */
export async function runSwissComparisons(
  players: PairwisePlayer[],
  contextPrompt: string,
  B: number,
  compare: Comparator,
  concurrency: number,
  onDuel?: OnDuel,
): Promise<DuelResult[]> {
  const order = sortByProvisional(players);
  const pairs = swissPairs(order, B);
  const out: DuelResult[] = new Array(pairs.length);
  let ti = 0;
  async function worker() {
    while (ti < pairs.length) {
      const idx = ti++;
      const [i, j] = pairs[idx];
      const a = players[i], b = players[j];
      const firstIsI = djb2(`${a.id}|${b.id}`) % 2 === 0;
      const first = firstIsI ? a : b;
      const second = firstIsI ? b : a;
      const verdict = await compare(first.response, second.response);
      let winner: 0 | 1 | -1 = -1;
      if (verdict === 'A') winner = first.id === a.id ? 0 : 1;
      else if (verdict === 'B') winner = second.id === a.id ? 0 : 1;
      out[idx] = { i, j, winner };
      if (onDuel) await onDuel({ seq: idx, i, j, winner });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pairs.length || 1) }, worker));
  // contextPrompt is used by the real comparator (built in index.ts); kept in the
  // signature so the caller passes it through to `compare` via closure.
  void contextPrompt;
  return out;
}

/** Build the system prompt for a round's head-to-head comparisons. */
export function buildComparePrompt(context: string): string {
  return `Eres un evaluador experto y consistente. Tarea y criterios:\n\n${context}\n\nSe te muestran dos respuestas (A y B). Elige la MEJOR segun los criterios; no empates salvo que sean indistinguibles. Responde SOLO JSON: {"winner":"A"} o {"winner":"B"}.`;
}
