import { describe, expect, it } from 'vitest';
import type { Instrumento, Matriz, Persona, Voto } from '../contrato';
import { aprobacion, correlacionPorPropuesta, dispersion, porFuente } from './basico';

const inst: Instrumento = {
  id: 't', version: 1, titulo: 't',
  escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [], propuestas: [{ id: 'p1', texto: 'a', origen: 'instrumento' }, { id: 'p2', texto: 'b', origen: 'instrumento' }],
};

function matriz(h: Record<string, [number, number]>, a: Record<string, [number, number]>): Matriz {
  const personas: Persona[] = [];
  const votos: Voto[] = [];
  for (const [ref, [v1, v2]] of Object.entries(h)) {
    personas.push({ id: `h_${ref}`, ref, fuente: 'humano', via: 'app' });
    votos.push({ persona: `h_${ref}`, propuesta: 'p1', valor: v1 }, { persona: `h_${ref}`, propuesta: 'p2', valor: v2 });
  }
  for (const [ref, [v1, v2]] of Object.entries(a)) {
    personas.push({ id: `a_m_${ref}`, ref, fuente: 'avatar', via: 'app', modelo: 'm' });
    votos.push({ persona: `a_m_${ref}`, propuesta: 'p1', valor: v1 }, { persona: `a_m_${ref}`, propuesta: 'p2', valor: v2 });
  }
  return { instrumento: inst, personas, votos };
}

describe('aprobacion', () => {
  it('cuenta 4 y 5 como aprobacion, por fuente', () => {
    const m = matriz({ r1: [5, 1], r2: [4, 2], r3: [3, 5] }, { r1: [5, 5] });
    const h = aprobacion(m, porFuente('humano'));
    expect(h.p1).toEqual({ aprueban: 2, n: 3, tasa: 2 / 3 });
    expect(h.p2.tasa).toBeCloseTo(1 / 3);
    expect(aprobacion(m, porFuente('avatar')).p2.tasa).toBe(1);
  });
  it('una propuesta sin votos tiene n=0 y tasa NaN', () => {
    const m = matriz({}, {});
    expect(aprobacion(m, porFuente('humano')).p1.n).toBe(0);
    expect(Number.isNaN(aprobacion(m, porFuente('humano')).p1.tasa)).toBe(true);
  });
});

describe('correlacionPorPropuesta', () => {
  it('empareja por ref y cuenta los que quedan sin pareja', () => {
    const m = matriz(
      { r1: [1, 5], r2: [3, 3], r3: [5, 1], solo_h: [2, 2] },
      { r1: [1, 4], r2: [3, 3], r3: [5, 2], solo_a: [4, 4] },
    );
    const c = correlacionPorPropuesta(m, porFuente('humano'), porFuente('avatar'));
    expect(c.porPropuesta.p1.n).toBe(3);
    expect(c.porPropuesta.p1.r).toBeCloseTo(1);
    expect(c.porPropuesta.p2.r).toBeCloseTo(1);
    expect(c.refsSinPareja).toBe(2);
    expect(c.promedio).toBeCloseTo(1);
  });
  it('r es null con varianza cero o menos de 3 pares', () => {
    const m = matriz({ r1: [3, 1], r2: [3, 5], r3: [3, 2] }, { r1: [1, 1], r2: [5, 5], r3: [2, 2] });
    const c = correlacionPorPropuesta(m, porFuente('humano'), porFuente('avatar'));
    expect(c.porPropuesta.p1.r).toBeNull();
    expect(c.porPropuesta.p2.r).not.toBeNull();
    const m2 = matriz({ r1: [1, 1], r2: [5, 5] }, { r1: [1, 1], r2: [5, 5] });
    expect(correlacionPorPropuesta(m2, porFuente('humano'), porFuente('avatar')).porPropuesta.p1.r).toBeNull();
  });
});

describe('dispersion', () => {
  it('es la varianza poblacional por propuesta', () => {
    const m = matriz({ r1: [1, 3], r2: [5, 3] }, {});
    const d = dispersion(m, porFuente('humano'));
    expect(d.p1).toBeCloseTo(4);
    expect(d.p2).toBe(0);
  });
});
