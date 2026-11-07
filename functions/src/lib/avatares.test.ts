import { describe, expect, it } from 'vitest';
import { idAvatarFn, normalizarVotos, promptAvatar, PROMPT_VERSION, refAvatares } from './avatares';

describe('normalizarVotos', () => {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  it('acepta enteros y strings numericos, redondea, descarta fuera de rango e ids ajenos', () => {
    const r = normalizarVotos({ p1: 5, p2: '4', p3: 7, x: 3, p4: 2.6 }, ids);
    expect(r.votos).toEqual({ p1: 5, p2: 4, p4: 3 });
    expect(r.faltantes).toEqual(['p3']);
  });
  it('acepta la forma anidada {votos: {...}}', () => {
    expect(normalizarVotos({ votos: { p1: 1, p2: 2, p3: 3, p4: 4 } }, ids).faltantes).toEqual([]);
  });
  it('todo faltante si la respuesta no sirve', () => {
    expect(normalizarVotos({}, ids).faltantes).toEqual(ids);
  });
  it('null, booleanos y strings vacios son faltantes, no ceros', () => {
    expect(normalizarVotos({ p1: null, p2: true, p3: '', p4: ' 5 ' }, ids)).toEqual({ votos: { p4: 5 }, faltantes: ['p1', 'p2', 'p3'] });
  });
});

describe('promptAvatar', () => {
  const p = promptAvatar('Edad (tramo): 21-25\nEn economía me considero: centro', [{ id: 'p1', texto: 'Subir el salario' }], ['A', 'B', 'C', 'D', 'E']);
  it('lleva la planilla, las propuestas con su id y pide JSON', () => {
    expect(p.systemSuffix).toContain('21-25');
    expect(p.systemSuffix).toContain('"p1"');
    expect(p.systemSuffix).toContain('Subir el salario');
    expect(p.userPrompt).toMatch(/JSON/);
  });
  it('el prefijo es identico para todos los alumnos (cache)', () => {
    const q = promptAvatar('otra cosa', [{ id: 'p1', texto: 'Subir el salario' }], ['A', 'B', 'C', 'D', 'E']);
    expect(q.systemPrefix).toBe(p.systemPrefix);
  });
  it('version y ids', () => {
    expect(PROMPT_VERSION).toBe('avatar-v1');
    expect(idAvatarFn('org/x 1', 'r1')).toBe('a_org-x-1_r1');
  });
});

describe('refAvatares', () => {
  it('da exactamente lo mismo que refDe del frontend (src/lib/avatares/contrato.ts)', () => {
    expect(refAvatares('uid-ana', 'ABC123')).toBe('r8172475a459d');
    expect(refAvatares('x', 'Y')).toBe('rbbfe24d6a7a8');
  });
});
