import { describe, expect, it } from 'vitest';
import type { Instrumento, Matriz, Persona, Voto } from '../contrato';
import { grupos, mapaPCA } from './mapa';
import { mulberry32 } from '../azar';

const props = ['p1', 'p2', 'p3', 'p4'];
const inst: Instrumento = {
  id: 't', version: 1, titulo: 't', escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [], propuestas: props.map((id) => ({ id, texto: id, origen: 'instrumento' as const })),
};

function conVotos(filas: { ref: string; fuente?: Persona['fuente']; v: number[] }[]): Matriz {
  const personas: Persona[] = [], votos: Voto[] = [];
  for (const f of filas) {
    const id = `${f.fuente ?? 'humano'}_${f.ref}`;
    personas.push({ id, ref: f.ref, fuente: f.fuente ?? 'humano', via: 'app' });
    f.v.forEach((valor, i) => { if (valor) votos.push({ persona: id, propuesta: props[i], valor }); });
  }
  return { instrumento: inst, personas, votos };
}

describe('mulberry32', () => {
  it('es determinista', () => {
    const a = mulberry32(7), b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('mapaPCA', () => {
  const izq = [5, 5, 1, 1], der = [1, 1, 5, 5];
  const filas = [
    ...Array.from({ length: 6 }, (_, i) => ({ ref: `i${i}`, v: izq.map((x, j) => (j === i % 4 ? Math.max(1, x - 1) : x)) })),
    ...Array.from({ length: 6 }, (_, i) => ({ ref: `d${i}`, v: der.map((x, j) => (j === i % 4 ? Math.max(1, x - 1) : x)) })),
  ];
  it('separa dos bandos en el primer eje y proyecta otras fuentes en el mismo espacio', () => {
    const m = conVotos([...filas, { ref: 'i0', fuente: 'avatar', v: izq }]);
    const mapa = mapaPCA(m);
    expect(mapa.degenerado).toBe(false);
    const xs = (pref: string) => mapa.puntos.filter((p) => p.fuente === 'humano' && p.ref.startsWith(pref)).map((p) => p.x);
    const signoI = Math.sign(xs('i')[0]);
    expect(xs('i').every((x) => Math.sign(x) === signoI)).toBe(true);
    expect(xs('d').every((x) => Math.sign(x) === -signoI)).toBe(true);
    const av = mapa.puntos.find((p) => p.fuente === 'avatar')!;
    expect(Math.sign(av.x)).toBe(signoI);
    expect(mapa.varianzaExplicada[0]).toBeGreaterThan(0.8);
    expect(mapa.cargas).toHaveLength(4);
  });
  it('imputa huecos con la media de la propuesta sin romperse', () => {
    const m = conVotos([...filas, { ref: 'hueco', v: [5, 0, 0, 1] }]);
    expect(mapaPCA(m).puntos.find((p) => p.ref === 'hueco')).toBeDefined();
  });
  it('N=3 o votos identicos: degenerado sin NaN', () => {
    const igual = conVotos([{ ref: 'a', v: [3, 3, 3, 3] }, { ref: 'b', v: [3, 3, 3, 3] }, { ref: 'c', v: [3, 3, 3, 3] }]);
    const mapa = mapaPCA(igual);
    expect(mapa.degenerado).toBe(true);
    expect(mapa.puntos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});

describe('grupos', () => {
  it('encuentra dos grupos claros y es determinista', () => {
    const r = mulberry32(1);
    const pts = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, x: -3 + r() * 0.5, y: r() * 0.5 })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, x: 3 + r() * 0.5, y: r() * 0.5 })),
    ];
    const g = grupos(pts);
    expect(g.k).toBe(2);
    expect(new Set(pts.slice(0, 8).map((p) => g.asignacion[p.id])).size).toBe(1);
    expect(g.asignacion.a0).not.toBe(g.asignacion.b0);
    expect(grupos(pts)).toEqual(g);
  });
  it('con menos de 2 puntos distintos devuelve un solo grupo degenerado', () => {
    const g = grupos([{ id: 'a', x: 1, y: 1 }, { id: 'b', x: 1, y: 1 }]);
    expect(g.k).toBe(1);
    expect(g.degenerado).toBe(true);
  });
});
