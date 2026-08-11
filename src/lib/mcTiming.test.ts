import { describe, it, expect } from 'vitest';
import { mcAnswerRevealed, mcFeedbackSeconds } from './mcTiming';

/**
 * La revelacion en dos tiempos. Lo que se prueba aca no es el diseno sino la
 * frontera: que el verde NUNCA se encienda en el primer instante (ahi se pierde
 * el efecto entero) y que SIEMPRE se encienda antes de que la ventana cierre
 * (ahi el curso se queda sin saber cual era la correcta, que es mucho peor).
 */
describe('mcAnswerRevealed', () => {
  // 203 caracteres: la explicacion real de la R1 de MGT300 clase 2.
  const expl = 'x'.repeat(203);
  const total = mcFeedbackSeconds(expl); // 3 + ceil(203/18) = 15

  it('la ventana de esa explicacion son 15 s', () => {
    expect(total).toBe(15);
  });

  it('en el primer instante muestra el reparto, no la respuesta', () => {
    expect(mcAnswerRevealed(expl, total)).toBe(false);
  });

  it('aguanta los 3 segundos del compas', () => {
    expect(mcAnswerRevealed(expl, total - 1)).toBe(false); // 1 s corrido
    expect(mcAnswerRevealed(expl, total - 2)).toBe(false); // 2 s
  });

  it('enciende la correcta al tercer segundo', () => {
    expect(mcAnswerRevealed(expl, total - 3)).toBe(true);
  });

  it('sigue encendida hasta el final de la ventana', () => {
    for (let left = total - 3; left >= 0; left--) {
      expect(mcAnswerRevealed(expl, left)).toBe(true);
    }
  });

  it('sin explicacion la ventana cae al piso y el compas se recorta a la mitad', () => {
    const piso = mcFeedbackSeconds(null); // 6
    expect(piso).toBe(6);
    expect(mcAnswerRevealed(null, 6)).toBe(false); // recien empieza
    expect(mcAnswerRevealed(null, 4)).toBe(false); // 2 s corridos
    expect(mcAnswerRevealed(null, 3)).toBe(true); // 3 s: mitad de la ventana
    expect(mcAnswerRevealed(null, 0)).toBe(true);
  });

  it('la correcta nunca se queda sin mostrarse: al cerrar la ventana ya esta', () => {
    for (const e of [null, '', 'corta', 'x'.repeat(120), 'x'.repeat(400)]) {
      expect(mcAnswerRevealed(e, 0)).toBe(true);
    }
  });

  it('nunca abre la respuesta en el instante cero, sea cual sea la explicacion', () => {
    for (const e of ['', 'corta', 'x'.repeat(120), 'x'.repeat(400)]) {
      expect(mcAnswerRevealed(e, mcFeedbackSeconds(e))).toBe(false);
    }
  });

  it('un secondsLeft mayor que la ventana (reloj desfasado) no adelanta el verde', () => {
    expect(mcAnswerRevealed(expl, total + 5)).toBe(false);
  });
});
