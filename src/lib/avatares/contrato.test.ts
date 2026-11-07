import { describe, expect, it } from 'vitest';
import {
  aprueba, idAvatar, idBot, idHumano, idMirofishBase, idMirofishRed, refDe, validarMatriz,
  type Instrumento, type Matriz,
} from './contrato';

const inst: Instrumento = {
  id: 't', version: 1, titulo: 'T',
  escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [],
  propuestas: [
    { id: 'p1', texto: 'Uno', origen: 'instrumento' },
    { id: 'p2', texto: 'Dos', origen: 'instrumento' },
  ],
};

describe('refDe', () => {
  it('es determinista, opaco y depende de la sala', () => {
    const a = refDe('uid-ana', 'ABC123');
    expect(a).toBe(refDe('uid-ana', 'ABC123'));
    expect(a).toMatch(/^r[0-9a-f]{12}$/);
    expect(a).not.toContain('ana');
    expect(refDe('uid-ana', 'XYZ999')).not.toBe(a);
    expect(refDe('uid-beto', 'ABC123')).not.toBe(a);
  });
});

describe('ids de persona', () => {
  it('son deterministas y sin barras', () => {
    expect(idHumano('r1')).toBe('h_r1');
    expect(idAvatar('gemini-2.5-pro', 'r1')).toBe('a_gemini-2.5-pro_r1');
    expect(idAvatar('org/model', 'r1')).toBe('a_org-model_r1');
    expect(idMirofishBase('r1')).toBe('mb_r1');
    expect(idMirofishRed(2, 'r1')).toBe('mr2_r1');
    expect(idBot(3, 'r1')).toBe('bot3_r1');
  });
});

describe('aprueba', () => {
  it('4 y 5 aprueban; 3 no', () => {
    expect([1, 2, 3, 4, 5].map(aprueba)).toEqual([false, false, false, true, true]);
  });
});

describe('validarMatriz', () => {
  const base: Matriz = {
    instrumento: inst,
    personas: [{ id: 'h_r1', ref: 'r1', fuente: 'humano', via: 'app' }],
    votos: [{ persona: 'h_r1', propuesta: 'p1', valor: 4 }],
  };
  it('acepta una matriz con huecos', () => {
    expect(validarMatriz(base)).toEqual([]);
  });
  it('rechaza valores fuera de escala, no enteros, personas y propuestas inexistentes, duplicados', () => {
    const m: Matriz = {
      ...base,
      personas: [...base.personas, { id: 'h_r1', ref: 'r1', fuente: 'humano', via: 'app' }],
      votos: [
        { persona: 'h_r1', propuesta: 'p1', valor: 6 },
        { persona: 'h_r1', propuesta: 'p2', valor: 2.5 },
        { persona: 'x', propuesta: 'p1', valor: 3 },
        { persona: 'h_r1', propuesta: 'p9', valor: 3 },
      ],
    };
    const errs = validarMatriz(m);
    expect(errs.some((e) => e.includes('persona duplicada'))).toBe(true);
    expect(errs.some((e) => e.includes('fuera de escala'))).toBe(true);
    expect(errs.some((e) => e.includes('no entero'))).toBe(true);
    expect(errs.some((e) => e.includes('persona inexistente'))).toBe(true);
    expect(errs.some((e) => e.includes('propuesta inexistente'))).toBe(true);
  });
  it('rechaza dos votos de la misma persona a la misma propuesta', () => {
    const m: Matriz = { ...base, votos: [...base.votos, { persona: 'h_r1', propuesta: 'p1', valor: 2 }] };
    expect(validarMatriz(m).some((e) => e.includes('voto repetido'))).toBe(true);
  });
});
