import { describe, expect, it } from 'vitest';
import { instrumentoDe } from './instrumentos';
import { itemsDesdeInstrumento, panelDesdePlanillas, validarResultadosMirofish } from './mirofishPuente';
import type { DocPlanilla } from './sala';

const inst = instrumentoDe('ayd14_vina_v1')!;
const planillas: DocPlanilla[] = [
  { uid: 'u1', ref: 'r1', campos: { edad: '22', genero: 'mujer', pais_ciudad: 'Viña' }, texto: 'Edad (tramo): 21-25\nGénero (opcional): mujer' },
  { uid: 'u2', ref: 'r2', campos: { edad: '19' }, texto: 'Edad (tramo): 18-20' },
  { uid: 'u3', ref: 'r3', campos: {}, texto: '' },
];

describe('panelDesdePlanillas', () => {
  const { panel, spec } = panelDesdePlanillas(planillas, 'ABC123');
  it('una persona por planilla, id = ref, sin uid, sin ciudad, sin nombre real', () => {
    expect(panel.personas.map((p) => p.id)).toEqual(['r1', 'r2', 'r3']);
    const s = JSON.stringify(panel);
    expect(s).not.toContain('u1');
    expect(s).not.toContain('Viña');
    expect(panel.personas[0].nombre).toBe('Estudiante 1');
    expect(panel.personas[0].sexo).toBe('Mujer');
    expect(panel.personas[2].sexo).toBe('No informa');
  });
  it('la spec reproduce exactamente las marginales del panel', () => {
    expect(spec.SIZE).toBe(3);
    const suma = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    for (const k of ['SEX', 'AGE', 'EDU', 'POL'] as const) expect(suma(spec[k])).toBeCloseTo(1);
    expect(spec.AGE['21-25']).toBeCloseTo(1 / 3);
  });
  it('la persona de MiroFish es el texto seudonimizado, nunca respuestas', () => {
    expect(panel.personas[0].persona).toContain('21-25');
    expect(panel.personas[0].persona).toContain('Universidad Adolfo Ibáñez');
  });
});

describe('itemsDesdeInstrumento', () => {
  const { question, items } = itemsDesdeInstrumento(inst);
  it('eleccion forzada entre la propuesta y su polo, sin escala de acuerdo y sin digitos en el contexto', () => {
    expect(items).toHaveLength(11);
    for (const it of [question, ...items]) {
      expect(it.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);
      expect(it.options[2].text).toBe('Ninguna de las dos');
      expect(it.options[3].text).toBe('No sé');
      expect(it.options.some((o) => /acuerdo/i.test(o.text))).toBe(false);
      expect(it.context).not.toMatch(/[0-9%]/);
    }
  });
  it('falla con un mensaje claro si una propuesta no tiene polo', () => {
    const sinPolo = { ...inst, propuestas: [{ id: 'x', texto: 'X', origen: 'alumno' as const }] };
    expect(() => itemsDesdeInstrumento(sinPolo)).toThrow(/polo/);
  });
});

describe('validarResultadosMirofish', () => {
  const refs = new Set(['r1', 'r2']), props = new Set(['salario_minimo', 'aborto']);
  it('acepta personas del contrato con ids de MiroFish y descarta lo ajeno', () => {
    const r = validarResultadosMirofish({ personas: [
      { id: 'mb_r1', ref: 'r1', fuente: 'avatar', via: 'mirofish', modelo: 'gemini-2.5-flash-lite', votos: { salario_minimo: 5, aborto: 3 } },
      { id: 'mr1_r2', ref: 'r2', fuente: 'avatar_red', via: 'mirofish', replica: 1, votos: { salario_minimo: 1, nope: 5 } },
      { id: 'mr1_rX', ref: 'rX', fuente: 'avatar_red', via: 'mirofish', replica: 1, votos: {} },
    ] }, refs, props);
    expect(r.personas).toHaveLength(2);
    expect(r.personas[1].votos).toEqual({ salario_minimo: 1 });
    expect(r.errores.some((e) => e.includes('rX'))).toBe(true);
  });
  it('rechaza un json sin personas', () => {
    expect(validarResultadosMirofish({}, refs, props).errores.length).toBeGreaterThan(0);
  });
});
