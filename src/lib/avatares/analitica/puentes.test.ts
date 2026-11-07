import { describe, expect, it } from 'vitest';
import type { Instrumento, Matriz, Persona, Voto } from '../contrato';
import { aprobacion, porFuente } from './basico';
import { factorizacionCN, inundar, puentePolis, rankings } from './puentes';

// Dos bandos de distinto tamano: A (14) y B (6).
// P1: A ama, B odia (70 % aprueba). P2: B ama, A odia. P4: A ama, B tibio.
// P3: PUENTE: 13 de 20 aprueban (65 %), repartidos en ambos bandos.
const props = ['p1', 'p2', 'p3', 'p4'];
const inst: Instrumento = {
  id: 't', version: 1, titulo: 't', escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [], propuestas: props.map((id) => ({ id, texto: id, origen: 'instrumento' as const })),
};
function construir(): Matriz {
  const personas: Persona[] = [], votos: Voto[] = [];
  const add = (ref: string, v: number[]) => {
    const id = `h_${ref}`;
    personas.push({ id, ref, fuente: 'humano', via: 'app' });
    v.forEach((valor, j) => votos.push({ persona: id, propuesta: props[j], valor }));
  };
  for (let i = 0; i < 14; i++) add(`a${i}`, [5, 1, i < 9 ? 4 : 3, i % 2 ? 5 : 4]);
  for (let i = 0; i < 6; i++) add(`b${i}`, [1, 5, i < 4 ? 4 : 3, 2]);
  return { instrumento: inst, personas, votos };
}

describe('puentePolis', () => {
  it('el minimo entre grupos premia la propuesta puente y castiga la polarizada', () => {
    const m = construir();
    const asig = Object.fromEntries(m.personas.map((p) => [p.id, p.ref.startsWith('a') ? 0 : 1]));
    const r = puentePolis(m, porFuente('humano'), asig);
    expect(r.p3.minimo).toBeCloseTo(0.625);
    expect(r.p1.minimo).toBeCloseTo(0.125);
    expect(r.p3.minimo).toBeGreaterThan(r.p1.minimo);
    expect(r.p3.porGrupo).toHaveLength(2);
  });
  it('un grupo sin votos en una propuesta no revienta (suavizado de Laplace)', () => {
    const m = construir();
    const asig = Object.fromEntries(m.personas.map((p) => [p.id, p.ref.startsWith('a') ? 0 : 1]));
    const sinB = { ...m, votos: m.votos.filter((v) => !(v.propuesta === 'p4' && v.persona.startsWith('h_b'))) };
    expect(puentePolis(sinB, porFuente('humano'), asig).p4.minimo).toBeCloseTo(0.5);
  });
});

describe('factorizacionCN', () => {
  it('la mayoria pone primero a P1; el intercepto pone primero a P3', () => {
    const m = construir();
    const ap = aprobacion(m, porFuente('humano'));
    expect(ap.p1.tasa).toBeGreaterThan(ap.p3.tasa);
    const cn = factorizacionCN(m, porFuente('humano'));
    const orden = Object.entries(cn.propuestas).sort((a, b) => b[1].intercepto - a[1].intercepto).map(([k]) => k);
    expect(orden[0]).toBe('p3');
    expect(Math.abs(cn.propuestas.p1.factor)).toBeGreaterThan(Math.abs(cn.propuestas.p3.factor));
  });
  it('es determinista y sin NaN', () => {
    const m = construir();
    const a = factorizacionCN(m, porFuente('humano')), b = factorizacionCN(m, porFuente('humano'));
    expect(a).toEqual(b);
    expect(Object.values(a.propuestas).every((p) => Number.isFinite(p.intercepto) && Number.isFinite(p.factor))).toBe(true);
  });
});

describe('rankings', () => {
  it('detecta los grupos solo y ordena distinto por mayoria y por puente', () => {
    const r = rankings(construir(), porFuente('humano'));
    expect(r.grupos.k).toBeGreaterThanOrEqual(2);
    expect(r.mayoria[0]).toBe('p1');
    expect(r.puenteCN[0]).toBe('p3');
    expect(r.puentePolis[0]).toBe('p3');
  });
});

describe('inundar', () => {
  it('agrega copias identicas como bots, sin tocar el original', () => {
    const m = construir();
    const m2 = inundar(m, 'h_a0', 10);
    expect(m2.personas.filter((p) => p.fuente === 'bot')).toHaveLength(10);
    expect(m2.votos.length).toBe(m.votos.length + 40);
    expect(m.personas).toHaveLength(20);
  });
  it('los bots mueven la mayoria mas que el intercepto', () => {
    const m = construir();
    // Copiar a un miembro de B: empuja P2 (polarizada).
    const m2 = inundar(m, 'h_b0', 15);
    const todos = (p: Persona) => p.fuente === 'humano' || p.fuente === 'bot';
    const dMay = aprobacion(m2, todos).p2.tasa - aprobacion(m, porFuente('humano')).p2.tasa;
    const dCN = factorizacionCN(m2, todos).propuestas.p2.intercepto - factorizacionCN(m, porFuente('humano')).propuestas.p2.intercepto;
    expect(dMay).toBeGreaterThan(0.2);
    expect(dCN).toBeLessThan(dMay);
  });
  it('n=0 devuelve una matriz equivalente', () => {
    const m = construir();
    expect(inundar(m, 'h_a0', 0).votos).toHaveLength(m.votos.length);
  });
});
