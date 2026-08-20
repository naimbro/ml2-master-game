// Static registry of compass content, mirroring how `courses.ts` registers
// sessions: hand-written imports, caught by `npm run build` when a path rots.
//
// Kept separate from `courses.ts` on purpose. A compass is not a session, and
// folding it into `COURSES`/`SESSIONS` would put it in the professor's
// create-a-game list, where picking it would build a game the engine cannot
// score.
//
// KEYED BY COMPASS, NOT BY COURSE. It used to be one compass per course, and
// that was wrong in a way that only shows up when you need the second one: a
// course runs a semester-long instrument that must not change between
// applications, and it also runs one-off instruments built for a single class,
// whose whole product is the debate groups of that afternoon. Those are
// different measurements with different axes, and forcing them through one slot
// meant either editing the semester instrument --which silently breaks the
// week 3 vs week 15 comparison-- or inventing a fake courseId, which writes the
// positions into a collection nobody will think to look in.
//
// Two compasses of the same course share `courseId` and MUST NOT share
// `instrumentId`: the Firestore path is `compas/{courseId}/{instrumentId}_a{n}`,
// so a duplicated id would have one instrument overwrite the other's positions
// student by student, and nothing would look wrong until the numbers did.
// `compasContent.test.ts` asserts both ids are unique across the registry.

import instrumentoAyD from '../../content/compas/ai_democracy_2026/instrumento_v3.json';
import arquetiposAyD from '../../content/compas/ai_democracy_2026/arquetipos_v3.json';
import instrumentoAyDs3 from '../../content/compas/ai_democracy_2026/instrumento_s3_v1.json';
import arquetiposAyDs3 from '../../content/compas/ai_democracy_2026/arquetipos_s3_v1.json';
import instrumentoMgt from '../../content/compas/mgt300_2026/instrumento_v2.json';
import arquetiposMgt from '../../content/compas/mgt300_2026/arquetipos_v2.json';

import type { CompasArquetipos, CompasInstrument } from '../types/compas';

export interface CompasPack {
  /** Registry key, repeated inside so a pack can be passed around on its own. */
  compasId: string;
  /**
   * Como se llama el ramo, para el desplegable del profesor.
   *
   * Escrito a mano aca y no leido de `courses.ts` a proposito, por la misma
   * razon por la que este registro vive aparte. Se duplica un string y se evita
   * que abrir un compas dependa del modulo de sesiones.
   */
  curso: string;
  /**
   * Como se llama ESTE compas, para distinguirlo de los otros del mismo ramo.
   *
   * Existe porque los instrumentos comparten `title` --varios se llaman «Compas
   * IA y Democracia», y esta bien que asi sea-- de modo que el desplegable los
   * mostraba como lineas casi identicas separadas solo por un sufijo. Elegir el
   * equivocado escribe las posiciones bajo otro instrumento, y eso no se nota
   * hasta que la medicion no cuadra. El nombre tiene que decir DE QUE MIDE y DE
   * CUANDO ES, no solo de que ramo.
   */
  nombre: string;
  /** A que ramo pertenece. Es el primer segmento de la ruta en Firestore. */
  courseId: string;
  instrumento: CompasInstrument;
  arquetipos: CompasArquetipos;
}

/** Every compass in the repo, by compassId. */
export const COMPASES: Record<string, CompasPack> = {
  ayd_semestral_v3: {
    compasId: 'ayd_semestral_v3',
    curso: 'AyD · IA y Democracia',
    nombre: 'Compás de semestre · magnitud × dirección (v3)',
    courseId: 'ai_democracy_2026',
    instrumento: instrumentoAyD as CompasInstrument,
    arquetipos: arquetiposAyD as CompasArquetipos,
  },
  // Compas de UNA CLASE. Mismo curso que el de arriba y ejes distintos: el de
  // semestre pregunta por 2035 --cuanto altera la IA la estructura del poder, y
  // hacia donde-- y en la semana 3 eso se contesta por el medio, que es
  // honesto y deja la nube apretada en el centro. Este pregunta solo por cosas
  // que ya pasaron y por el propio trabajo del que contesta, y su producto son
  // los cuatro campos del debate de esa tarde. No se compara con nada.
  ayd_s3_backlash_v1: {
    compasId: 'ayd_s3_backlash_v1',
    curso: 'AyD · IA y Democracia',
    nombre: 'Compás de clase · Semana 3, el backlash (diagnóstico × legitimidad)',
    courseId: 'ai_democracy_2026',
    instrumento: instrumentoAyDs3 as CompasInstrument,
    arquetipos: arquetiposAyDs3 as CompasArquetipos,
  },
  // v2: diez PROPOSICIONES con tres grados de acuerdo, dos ejes, sin tercer
  // eje. La v1 --diez items con cinco alternativas sustantivas-- queda en el
  // repo pero fuera del registro: sus mediciones no son comparables con las de
  // la v2, que es justamente por lo que el numero de version esta en el nombre
  // del archivo. Ver `_por_que_v2` en el instrumento.
  mgt300_semestral_v2: {
    compasId: 'mgt300_semestral_v2',
    curso: 'MGT300 · Sociedad, Cultura y Política',
    nombre: 'Compás de semestre · proposiciones (v2)',
    courseId: 'mgt300_2026',
    instrumento: instrumentoMgt as CompasInstrument,
    arquetipos: arquetiposMgt as CompasArquetipos,
  },
};

/** By registry key. What the professor picked when opening the room. */
export function compasDe(compasId: string | undefined): CompasPack | null {
  if (!compasId) return null;
  return COMPASES[compasId] ?? null;
}

/**
 * By instrument id — how a RUN finds its pack.
 *
 * Runs persist `instrumentId` and predate `compasId`, so this is what keeps
 * rooms opened before the registry was re-keyed still resolving. It is also the
 * honest lookup: the instrument is what produced those answers, and a run whose
 * compass was renamed or re-registered must keep scoring against the same one.
 */
export function compasDeInstrumento(instrumentId: string | undefined): CompasPack | null {
  if (!instrumentId) return null;
  return Object.values(COMPASES).find((p) => p.instrumento.instrumentId === instrumentId) ?? null;
}

/** Every compass of one course, in registry order. For grouping the picker. */
export function compasesDeCurso(courseId: string | undefined): CompasPack[] {
  if (!courseId) return [];
  return Object.values(COMPASES).filter((p) => p.courseId === courseId);
}

/**
 * Firestore path for one student's position in one application.
 *
 * Positions live OUTSIDE `games/{code}` because the whole point is comparing
 * week 3 against week 15 — two different game codes, months apart. Hanging them
 * off a game document would scope them to the session that produced them and
 * make the comparison impossible to query.
 *
 * Keyed by instrument and not by compass: two compasses of the same course
 * write side by side under the course, each in its own collection.
 */
export function posicionPath(courseId: string, instrumentId: string, aplicacion: number): string {
  return `compas/${courseId}/${instrumentId}_a${aplicacion}`;
}
