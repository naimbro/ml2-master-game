/**
 * Telemetria de escritura de las rondas abiertas: tipos compartidos y las
 * funciones puras que el panel del profesor usa para dibujarla.
 *
 * REGLA QUE MANDA SOBRE ESTE ARCHIVO: nada de aca entra en un puntaje, en el
 * ranking ni en la recalibracion por duelos. Es registro descriptivo. Si
 * alguna vez una de estas funciones aparece importada desde el calculo de
 * puntajes, eso es el bug.
 *
 * Ver docs/superpowers/specs/2026-08-08-telemetria-antitrampa-design.md
 */

export interface PegadoEvento {
  /** ms desde que se le abrio la ronda a ese alumno */
  ms: number;
  /** cuantos caracteres traia el portapapeles */
  chars: number;
}

/** Lo que el navegador del alumno junta durante una ronda abierta. */
export interface TelemetriaCaptura {
  scenarioId: string;
  msPrimeraTecla: number | null;
  msEnvio: number;
  /** (momento del montaje) - game.roundStartTime. Negativo si monto antes. */
  roundStartOffsetMs: number;
  pegados: PegadoEvento[];
  /** huella[i] = largo del texto a los (i+1) * huellaIntervaloMs ms */
  huella: number[];
  huellaIntervaloMs: number;
  msFueraDeApp: number;
  salidas: number;
  msFueraAntesDeEscribir: number;
  largoFinal: number;
  charsPegados: number;
  charsEditadosTrasUltimoPegado: number;
}

/** El documento tal como queda en Firestore. */
export interface TelemetriaDoc extends TelemetriaCaptura {
  playerId: string;
  round: number;
  version: number;
}

/** "2 min 18 s", "41 s", "3 min". */
export function formatoReloj(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  if (min === 0) return `${seg} s`;
  if (seg === 0) return `${min} min`;
  return `${min} min ${seg} s`;
}

/**
 * Que fraccion del texto final llego pegada, entre 0 y 1. Se topa en 1 porque
 * alguien puede pegar 900 caracteres y dejar 400: la proporcion no significa
 * nada sobre 1, y un punto fuera del grafico si molesta.
 */
export function proporcionPegada(t: { charsPegados: number; largoFinal: number }): number {
  if (t.largoFinal <= 0) return 0;
  return Math.min(1, t.charsPegados / t.largoFinal);
}
