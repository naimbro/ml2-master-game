// Comparing two applications of the same instrument — the payoff of the whole
// thing, and the easiest place to lie by accident.
//
// The lie this file exists to prevent: comparing the average of everyone who
// answered in March against the average of everyone who answered in November.
// Those are two different sets of people. Whoever stopped coming to class took
// their opinions with them, and the "shift" is partly the class roster changing
// rather than anybody changing their mind. So the comparison is PAIRED: only
// students present in both applications count, and the ones dropped are
// reported, never hidden.

import { movimiento } from './compas';
import type { Arquetipo, CompasMovimiento, CompasPosicion } from '../types/compas';

/** One position as stored under `compas/{courseId}/{instrumentId}_a{n}/{uid}`. */
export interface PosicionGuardada {
  playerId: string;
  magnitud: number;
  direccion: number;
  respondidas: number;
  total: number;
  arquetipoId: string | null;
}

export interface Par {
  playerId: string;
  antes: PosicionGuardada;
  despues: PosicionGuardada;
  mov: CompasMovimiento;
}

export interface Emparejamiento {
  pares: Par[];
  /** Answered the first application but not the second. */
  soloAntes: number;
  /** Answered the second but not the first — joined the course late, or missed the day. */
  soloDespues: number;
}

/**
 * Pairs positions by student. Anyone missing from either side is counted, not
 * silently dropped: with 28 students, four people missing one application is
 * enough to move an average on its own.
 */
export function emparejar(antes: PosicionGuardada[], despues: PosicionGuardada[]): Emparejamiento {
  const porId = new Map((despues ?? []).map((p) => [p.playerId, p]));
  const pares: Par[] = [];
  let soloAntes = 0;

  for (const a of antes ?? []) {
    const d = porId.get(a.playerId);
    if (!d) {
      soloAntes += 1;
      continue;
    }
    const mov = movimiento(comoPosicion(a), comoPosicion(d));
    if (mov) pares.push({ playerId: a.playerId, antes: a, despues: d, mov });
    porId.delete(a.playerId);
  }

  return { pares, soloAntes, soloDespues: porId.size };
}

function comoPosicion(p: PosicionGuardada): CompasPosicion {
  return {
    magnitud: p.magnitud,
    direccion: p.direccion,
    respondidas: p.respondidas,
    total: p.total,
  };
}

/** Centre of mass of a set of positions. Null on an empty set. */
export function centroide(ps: Array<{ magnitud: number; direccion: number }>): {
  magnitud: number;
  direccion: number;
} | null {
  const validas = (ps ?? []).filter(
    (p) => Number.isFinite(p?.magnitud) && Number.isFinite(p?.direccion),
  );
  if (validas.length === 0) return null;
  return {
    magnitud: validas.reduce((s, p) => s + p.magnitud, 0) / validas.length,
    direccion: validas.reduce((s, p) => s + p.direccion, 0) / validas.length,
  };
}

export interface ResumenComparacion {
  n: number;
  centroideAntes: { magnitud: number; direccion: number } | null;
  centroideDespues: { magnitud: number; direccion: number } | null;
  desplazamientoMedio: CompasMovimiento | null;
  /** How many moved further than `umbral` on the plane. */
  seMovieron: number;
  /** …and how many barely budged. */
  sinCambio: number;
  umbral: number;
}

/**
 * Paired summary.
 *
 * `umbral` is what counts as "moved at all". It defaults to 1 point on a scale
 * of 20, which is deliberately generous: a student who answered one item
 * differently out of ten shifts by about that much, and calling that a change
 * of mind would be reading noise as learning.
 */
export function resumenComparacion(pares: Par[], umbral = 1): ResumenComparacion {
  const n = pares?.length ?? 0;
  const centroideAntes = centroide((pares ?? []).map((p) => p.antes));
  const centroideDespues = centroide((pares ?? []).map((p) => p.despues));
  return {
    n,
    centroideAntes,
    centroideDespues,
    desplazamientoMedio:
      centroideAntes && centroideDespues
        ? {
            dMagnitud: centroideDespues.magnitud - centroideAntes.magnitud,
            dDireccion: centroideDespues.direccion - centroideAntes.direccion,
            distancia: Math.hypot(
              centroideDespues.magnitud - centroideAntes.magnitud,
              centroideDespues.direccion - centroideAntes.direccion,
            ),
          }
        : null,
    seMovieron: (pares ?? []).filter((p) => p.mov.distancia > umbral).length,
    sinCambio: (pares ?? []).filter((p) => p.mov.distancia <= umbral).length,
    umbral,
  };
}

export interface FilaArquetipo {
  id: string;
  name: string;
  antes: number;
  despues: number;
}

/**
 * How the class redistributed across archetypes. Counts only paired students,
 * so the two columns always add up to the same total — a table where they
 * didn't would invite reading a drop-out as a conversion.
 */
export function repartoArquetipos(pares: Par[], arquetipos: Arquetipo[]): FilaArquetipo[] {
  const filas = new Map<string, FilaArquetipo>(
    (arquetipos ?? []).map((a) => [a.id, { id: a.id, name: a.name, antes: 0, despues: 0 }]),
  );
  for (const p of pares ?? []) {
    const a = p.antes.arquetipoId;
    const d = p.despues.arquetipoId;
    if (a && filas.has(a)) filas.get(a)!.antes += 1;
    if (d && filas.has(d)) filas.get(d)!.despues += 1;
  }
  return [...filas.values()];
}

/** Who ended up somewhere else. The list that seeds the closing discussion. */
export function cambiaronDeArquetipo(pares: Par[]): Par[] {
  return (pares ?? []).filter(
    (p) => p.antes.arquetipoId && p.despues.arquetipoId && p.antes.arquetipoId !== p.despues.arquetipoId,
  );
}
