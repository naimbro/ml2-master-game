// Static registry of compass content, mirroring how `courses.ts` registers
// sessions: hand-written imports, caught by `npm run build` when a path rots.
//
// Kept separate from `courses.ts` on purpose. A compass is not a session, and
// folding it into `COURSES`/`SESSIONS` would put it in the professor's
// create-a-game list, where picking it would build a game the engine cannot
// score.

import instrumentoAyD from '../../content/compas/ai_democracy_2026/instrumento_v3.json';
import arquetiposAyD from '../../content/compas/ai_democracy_2026/arquetipos_v3.json';
import instrumentoMgt from '../../content/compas/mgt300_2026/instrumento_v2.json';
import arquetiposMgt from '../../content/compas/mgt300_2026/arquetipos_v2.json';

import type { CompasArquetipos, CompasInstrument } from '../types/compas';

export interface CompasPack {
  /**
   * Como se llama el ramo, para el desplegable del profesor.
   *
   * Escrito a mano aca y no leido de `courses.ts` a proposito, por la misma
   * razon por la que este registro vive aparte. Se duplica un string y se evita
   * que abrir un compas dependa del modulo de sesiones.
   *
   * Existe porque los dos instrumentos comparten `title` --los dos se llaman
   * «Compas IA y Democracia», y esta bien que asi sea: es el mismo instrumento
   * aplicado a dos cursos--, de modo que el desplegable los mostraba como dos
   * lineas casi identicas separadas solo por el sufijo del courseId. Elegir el
   * equivocado escribe las posiciones en la coleccion del otro curso, y eso no
   * se nota hasta que la comparacion de fin de semestre no cuadra.
   */
  curso: string;
  instrumento: CompasInstrument;
  arquetipos: CompasArquetipos;
}

/** Every compass in the repo, by courseId. */
export const COMPASES: Record<string, CompasPack> = {
  ai_democracy_2026: {
    curso: 'AyD · IA y Democracia',
    instrumento: instrumentoAyD as CompasInstrument,
    arquetipos: arquetiposAyD as CompasArquetipos,
  },
  // v2: diez PROPOSICIONES con tres grados de acuerdo, dos ejes, sin tercer
  // eje. La v1 --diez items con cinco alternativas sustantivas-- queda en el
  // repo pero fuera del registro: sus mediciones no son comparables con las de
  // la v2, que es justamente por lo que el numero de version esta en el nombre
  // del archivo. Ver `_por_que_v2` en el instrumento.
  mgt300_2026: {
    curso: 'MGT300 · Sociedad, Cultura y Política',
    instrumento: instrumentoMgt as CompasInstrument,
    arquetipos: arquetiposMgt as CompasArquetipos,
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
