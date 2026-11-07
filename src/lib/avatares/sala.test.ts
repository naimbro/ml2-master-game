import { describe, expect, it, vi } from 'vitest';

// sala.ts importa el cliente de Firebase; en estas pruebas solo se ejercita lo puro.
vi.mock('../firebase', () => ({ db: {} }));

import { validarMatriz } from './contrato';
import { instrumentoDe } from './instrumentos';
import { aMatriz, avataresBloqueados, codigoNuevo } from './sala';
import { refDe } from './contrato';
import { mulberry32 } from './azar';

const inst = instrumentoDe('ayd14_vina_v1')!;

describe('aMatriz', () => {
  it('convierte humanos y personas al contrato, con huecos', () => {
    const m = aMatriz(inst, 'C',
      [{ uid: 'u1', ref: 'r1', votos: { salario_minimo: 5, aborto: 2 } }, { uid: 'u2', ref: 'r2', votos: {} }],
      [{ id: 'a_m_r1', ref: 'r1', fuente: 'avatar', via: 'app', modelo: 'm', votos: { salario_minimo: 4 } }]);
    expect(validarMatriz(m)).toEqual([]);
    expect(m.personas.map((p) => p.id)).toEqual([`h_${refDe('u1', 'C')}`, `h_${refDe('u2', 'C')}`, 'a_m_r1']);
    expect(m.votos).toHaveLength(3);
    expect(JSON.stringify(m)).not.toContain('u1');
  });
  it('descarta votos a propuestas que no estan en el instrumento y valores invalidos', () => {
    const m = aMatriz(inst, 'C', [{ uid: 'u1', ref: 'r1', votos: { nope: 3, aborto: 9, migracion: 3 } }], []);
    expect(m.votos).toEqual([{ persona: `h_${refDe('u1', 'C')}`, propuesta: 'migracion', valor: 3 }]);
  });
});

describe('aMatriz: lo que el cliente no puede falsear', () => {
  it('el ref del humano sale de su uid, no del ref que escribio el cliente', () => {
    const m = aMatriz(inst, 'C', [{ uid: 'u1', ref: 'ref-de-otro', votos: { aborto: 4 } }], []);
    expect(m.personas[0].ref).toBe(refDe('u1', 'C'));
  });
  it('un avatar sin ningun voto (fallo completo) no entra a la matriz', () => {
    const m = aMatriz(inst, 'C', [], [{ id: 'a_m_r9', ref: 'r9', fuente: 'avatar', via: 'app', modelo: 'm', votos: {}, faltantes: ['aborto'] }]);
    expect(m.personas).toEqual([]);
  });
});

describe('avataresBloqueados', () => {
  const ahora = 1_000_000_000;
  it('bloquea mientras corre, y se destraba si quedo pegado mas de 12 minutos', () => {
    expect(avataresBloqueados(undefined, ahora)).toBe(false);
    expect(avataresBloqueados({ estado: 'corriendo', n: 0, fallos: [], iniciadoEn: ahora - 60_000 }, ahora)).toBe(true);
    expect(avataresBloqueados({ estado: 'corriendo', n: 0, fallos: [], iniciadoEn: ahora - 13 * 60_000 }, ahora)).toBe(false);
    expect(avataresBloqueados({ estado: 'corriendo', n: 0, fallos: [] }, ahora)).toBe(false);
    expect(avataresBloqueados({ estado: 'error', n: 0, fallos: [] }, ahora)).toBe(false);
  });
});

describe('codigoNuevo', () => {
  it('6 caracteres legibles y determinista con semilla', () => {
    const c = codigoNuevo(mulberry32(1));
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(codigoNuevo(mulberry32(1))).toBe(c);
  });
});
