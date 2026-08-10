import type { CourseStandings } from '../types/standings';

/**
 * La lista de juegos ya jugados de un curso, para llegar a sus reportes.
 *
 * Hasta el 2026-08-10 el reporte de clase era inalcanzable: el unico enlace
 * vivia en la pantalla del podio de ese juego y desaparecia al navegar. Sin el
 * codigo anotado a mano, el reporte no existia.
 *
 * SALE DE `standings/{courseId}`, no de una consulta a `games`, y eso es a
 * proposito por dos razones:
 *
 * 1. El documento de un juego trae `knowledgeBase`, `scenarios` y
 *    `referenceDocs` adentro. El SDK del cliente no tiene `select()`, asi que
 *    listar quince juegos serian megabytes para mostrar quince filas.
 * 2. Cual es el juego OFICIAL de cada clase ya lo decidio `pickOfficialGames`
 *    en las functions, y esa decision esta escrita en `gamesCounted` /
 *    `gamesShadowed`. Recalcularla aca con otra regla —por ejemplo contando
 *    jugadores inscritos en vez de los que respondieron— daria una lista que
 *    contradice a la tabla del curso sin que nadie sepa cual miente.
 *
 * Lo que esta lista NO muestra, como consecuencia: los juegos sin terminar.
 * `recomputeCourseStandings` solo mira los `finished`, y un reporte de un juego
 * a medias no significa nada. La tabla se recalcula al cerrar cada juego, asi
 * que el que acaba de terminar ya esta.
 */
export interface FilaJuego {
  gameCode: string;
  /** null en los excluidos a mano: de ellos la tabla guarda solo el codigo. */
  sessionTitle: string | null;
  finishedAtMs: number | null;
  playedCount?: number;
  etiqueta: 'oficial' | 'prueba' | 'excluido';
}

export function filasDeJuegos(standings: CourseStandings | null): FilaJuego[] {
  if (!standings) return [];

  const excluidos = new Set(standings.excludedGameCodes ?? []);

  const desdeTabla = (
    juegos: CourseStandings['gamesCounted'],
    etiqueta: 'oficial' | 'prueba'
  ): FilaJuego[] =>
    juegos
      .filter((j) => !excluidos.has(j.gameCode))
      .map((j) => ({
        gameCode: j.gameCode,
        sessionTitle: j.sessionTitle,
        finishedAtMs: j.finishedAtMs,
        playedCount: j.playedCount,
        etiqueta,
      }));

  const conFecha = [
    ...desdeTabla(standings.gamesCounted ?? [], 'oficial'),
    ...desdeTabla(standings.gamesShadowed ?? [], 'prueba'),
  ].sort((a, b) => (b.finishedAtMs ?? 0) - (a.finishedAtMs ?? 0));

  // Van al final: la tabla guarda su codigo y nada mas, asi que no hay fecha
  // con que ordenarlos entre los demas.
  const sinFecha: FilaJuego[] = [...excluidos].map((gameCode) => ({
    gameCode,
    sessionTitle: null,
    finishedAtMs: null,
    etiqueta: 'excluido' as const,
  }));

  return [...conFecha, ...sinFecha];
}

/**
 * "10 ago, 12:30". En 24 horas: el "12:30 p. m." que sale por defecto ocupa el
 * doble y en una fila apretada empuja al codigo del juego fuera de la vista.
 */
export function fechaCorta(ms: number | null): string {
  if (ms === null) return '';
  return new Date(ms).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
