// Static registry of compass content, mirroring how `courses.ts` registers
// sessions: hand-written imports, caught by `npm run build` when a path rots.
//
// Kept separate from `courses.ts` on purpose. A compass is not a session, and
// folding it into `COURSES`/`SESSIONS` would put it in the professor's
// create-a-game list, where picking it would build a game the engine cannot
// score.

import instrumentoAyD from '../../content/compas/ai_democracy_2026/instrumento_v3.json';
import arquetiposAyD from '../../content/compas/ai_democracy_2026/arquetipos_v3.json';

import type { CompasArquetipos, CompasInstrument } from '../types/compas';

export interface CompasPack {
  instrumento: CompasInstrument;
  arquetipos: CompasArquetipos;
}

/** Every compass in the repo, by courseId. */
export const COMPASES: Record<string, CompasPack> = {
  ai_democracy_2026: {
    instrumento: instrumentoAyD as CompasInstrument,
    arquetipos: arquetiposAyD as CompasArquetipos,
  },
};

export function compasDe(courseId: string | undefined): CompasPack | null {
  if (!courseId) return null;
  return COMPASES[courseId] ?? null;
}

/**
 * Firestore path for one student's position in one application.
 *
 * Positions live OUTSIDE `games/{code}` because the whole point is comparing
 * week 3 against week 15 — two different game codes, months apart. Hanging them
 * off a game document would scope them to the session that produced them and
 * make the comparison impossible to query.
 */
export function posicionPath(courseId: string, instrumentId: string, aplicacion: number): string {
  return `compas/${courseId}/${instrumentId}_a${aplicacion}`;
}
