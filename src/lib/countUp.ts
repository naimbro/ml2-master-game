/** Duracion estandar de un conteo en el cierre de ronda. */
export const COUNT_UP_MS = 760;

/**
 * Rapido al principio, suave al final: el numero salta y despues se asienta.
 * Un easing lineal se lee como una barra de carga, no como un puntaje subiendo.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface CountUpArgs {
  from: number;
  to: number;
  elapsedMs: number;
  durationMs: number;
  /** Decimales a conservar. El promedio del ranking usa 1; los puntajes, 0. */
  decimals?: number;
}

/**
 * Valor del conteo en un instante dado. Funcion pura del tiempo transcurrido:
 * el hook solo le pasa el reloj, asi que se puede testear sin rAF ni Date.now.
 */
export function countUpValue({ from, to, elapsedMs, durationMs, decimals = 0 }: CountUpArgs): number {
  const t = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / durationMs));
  const raw = from + (to - from) * easeOutCubic(t);
  const factor = Math.pow(10, decimals);
  return Math.round(raw * factor) / factor;
}
