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

/**
 * Run the Swiss band-B schedule with `concurrency` parallel comparisons.
 *
 * Every pair is judged TWICE, once in each presentation order (LCES eq. 1,
 * Shibata & Miyamura 2025). A verdict that survives the swap is about the
 * answers; one that flips is about the position, and counts as a tie. We
 * measured 13.5% of verdicts flipping on our own cached duels, rising to 27.9%
 * among pairs less than 5 points apart — which is most of what the Swiss band
 * schedules, so the expected rate in production is ~21%.
 *
 * The previous hash-picked presentation order is gone: it spread the bias evenly
 * instead of favouring the top or the bottom of the table, but it turned that bias
 * into per-duel noise rather than removing it.
 *
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
      // Las dos llamadas van en paralelo: mantiene ~`concurrency` duelos en vuelo
      // y deja el wall-clock donde estaba.
      const [fwd, rev] = await Promise.all([
        compare(a.response, b.response),
        compare(b.response, a.response),
      ]);
      // fwd: 'A' => gana a (mostrado primero).  rev: 'A' => gana b (mostrado primero).
      const fwdWinner: 0 | 1 | -1 = fwd === 'A' ? 0 : fwd === 'B' ? 1 : -1;
      const revWinner: 0 | 1 | -1 = rev === 'A' ? 1 : rev === 'B' ? 0 : -1;
      // Sólo cuenta si los dos órdenes deciden Y coinciden. Si se contradicen, o si
      // alguno responde empate (incluido el 'tie' que index.ts devuelve cuando la
      // llamada falla), el par es empate: no reordenamos con datos que no aguantan.
      const winner: 0 | 1 | -1 = fwdWinner !== -1 && fwdWinner === revWinner ? fwdWinner : -1;
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
