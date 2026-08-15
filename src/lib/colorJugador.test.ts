import { describe, it, expect } from 'vitest';
import { colorDeJugador, COLORES_JUGADOR } from './colorJugador';

/** Contraste WCAG, para no afirmar los ratios de memoria. */
function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [alto, bajo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (bajo + 0.05);
}

/** Distancia perceptual en OKLab, x100. Es la que separa dos colores al ojo. */
function deltaE(a: string, b: string): number {
  const oklab = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const [A, B] = [oklab(a), oklab(b)];
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) * 100;
}

describe('colorDeJugador', () => {
  it('el mismo alumno saca siempre el mismo color', () => {
    // Es la razon de ser del modulo: con Math.random() la fila parpadearia en
    // cada re-render, y la tabla se re-renderiza mucho mientras se anima.
    const uid = 'aBcD1234efGH5678ijKL';
    const primero = colorDeJugador(uid);
    for (let i = 0; i < 50; i++) {
      expect(colorDeJugador(uid)).toEqual(primero);
    }
  });

  it('siempre devuelve un color de la paleta', () => {
    for (let i = 0; i < 500; i++) {
      expect(COLORES_JUGADOR).toContainEqual(colorDeJugador(`uid-de-prueba-${i}`));
    }
  });

  it('reparte los cinco colores sobre uids parecidos', () => {
    // Los uid de Firebase comparten forma y largo, asi que un hash malo podria
    // mandarlos todos al mismo color. Con 200 alumnos tienen que salir los cinco.
    const vistos = new Set(
      Array.from({ length: 200 }, (_, i) => colorDeJugador(`AbCdEfGhIjKlMnOpQrSt${i}`).nombre),
    );
    expect(vistos.size).toBe(COLORES_JUGADOR.length);
  });

  it('no revienta sin id, y no deja la fila sin color', () => {
    for (const vacio of [null, undefined, '']) {
      expect(COLORES_JUGADOR).toContainEqual(colorDeJugador(vacio));
    }
  });

  it('ningun color es el verde reservado ni se le parece', () => {
    // El verde significa "correcta" y nada mas. Se compara por canal para cazar
    // tambien un verde distinto del token exacto.
    for (const c of COLORES_JUGADOR) {
      expect(c.fondo.toUpperCase()).not.toBe('#0B7A46');
      const r = parseInt(c.fondo.slice(1, 3), 16);
      const g = parseInt(c.fondo.slice(3, 5), 16);
      const b = parseInt(c.fondo.slice(5, 7), 16);
      // Un verde es aquel cuyo canal verde domina a los otros dos.
      expect(g > r + 30 && g > b + 30).toBe(false);
    }
  });

  it('ninguno es el ambar ni el naranjo, que son dorsales del podio', () => {
    const dorsales = ['#F5A524', '#FF5A1F'];
    for (const c of COLORES_JUGADOR) {
      expect(dorsales).not.toContain(c.fondo.toUpperCase());
    }
  });

  it('los cinco pasan AA con texto blanco encima', () => {
    for (const c of COLORES_JUGADOR) {
      expect(contraste(c.fondo, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * El chequeo que faltaba, y que habria cazado el magenta #BE185D antes de que
   * llegara a produccion: quedaba a deltaE 7,5 del rojo que significa
   * "incorrecta". El ojo no lo separa de una fila de error.
   *
   * El umbral es 15 porque es la distancia que el propio sistema acepta entre su
   * naranjo y su ambar. Y se mide contra los colores que COMPARTEN PANTALLA con
   * la fila —los dorsales del podio y los puntajes—, no entre los cinco: esos
   * nunca coexisten, porque cada alumno ve el suyo y nada mas.
   */
  it('ninguno se acerca a un color que ya significa algo en la misma pantalla', () => {
    const RESERVADOS = {
      verde: '#0B7A46',   // "correcta"
      ambar: '#F5A524',   // dorsal del primer lugar
      naranjo: '#FF5A1F', // dorsal del tercer lugar
      rojo: '#B3272B',    // "incorrecta"
    };
    for (const c of COLORES_JUGADOR) {
      for (const [nombre, hex] of Object.entries(RESERVADOS)) {
        const d = deltaE(c.fondo, hex);
        expect(
          d,
          `${c.nombre} (${c.fondo}) queda a ΔE ${d.toFixed(1)} del ${nombre}`,
        ).toBeGreaterThanOrEqual(15);
      }
    }
  });
});
