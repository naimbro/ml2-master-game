import { describe, expect, it, vi } from 'vitest';

// sala.ts importa el cliente de Firebase; en estas pruebas solo se ejercita lo puro.
vi.mock('../firebase', () => ({ db: {} }));

import { validarMatriz } from './contrato';
import { instrumentoDe } from './instrumentos';
import { aMatriz, codigoNuevo } from './sala';
import { mulberry32 } from './azar';

const inst = instrumentoDe('ayd14_vina_v1')!;

describe('aMatriz', () => {
  it('convierte humanos y personas al contrato, con huecos', () => {
    const m = aMatriz(inst,
      [{ uid: 'u1', ref: 'r1', votos: { salario_minimo: 5, aborto: 2 } }, { uid: 'u2', ref: 'r2', votos: {} }],
      [{ id: 'a_m_r1', ref: 'r1', fuente: 'avatar', via: 'app', modelo: 'm', votos: { salario_minimo: 4 } }]);
    expect(validarMatriz(m)).toEqual([]);
    expect(m.personas.map((p) => p.id)).toEqual(['h_r1', 'h_r2', 'a_m_r1']);
    expect(m.votos).toHaveLength(3);
    expect(JSON.stringify(m)).not.toContain('u1');
  });
  it('descarta votos a propuestas que no estan en el instrumento y valores invalidos', () => {
    const m = aMatriz(inst, [{ uid: 'u1', ref: 'r1', votos: { nope: 3, aborto: 9, migracion: 3 } }], []);
    expect(m.votos).toEqual([{ persona: 'h_r1', propuesta: 'migracion', valor: 3 }]);
  });
});

describe('codigoNuevo', () => {
  it('6 caracteres legibles y determinista con semilla', () => {
    const c = codigoNuevo(mulberry32(1));
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(codigoNuevo(mulberry32(1))).toBe(c);
  });
});
