import { describe, it, expect } from 'vitest';
import { armarCampos, mezclar, type Miembro } from './compasCampos';

function m(id: string, magnitud: number, direccion: number, timon?: Miembro['timon']): Miembro {
  return { id, nombre: `Alumno ${id}`, magnitud, direccion, timon };
}

/** Cuatro racimos bien separados, siete personas cada uno. */
const curso: Miembro[] = [
  ...Array.from({ length: 7 }, (_, i) => m(`a${i}`, -7 + i * 0.2, -7 + i * 0.2)),
  ...Array.from({ length: 7 }, (_, i) => m(`b${i}`, 7 + i * 0.2, -7 + i * 0.2)),
  ...Array.from({ length: 7 }, (_, i) => m(`c${i}`, -7 + i * 0.2, 7 + i * 0.2)),
  ...Array.from({ length: 7 }, (_, i) => m(`d${i}`, 7 + i * 0.2, 7 + i * 0.2)),
];

describe('armarCampos', () => {
  it('reparte a todos y a nadie dos veces', () => {
    const campos = armarCampos(curso, 4);
    const ids = campos.flatMap((c) => c.miembros.map((x) => x.id));
    expect(ids).toHaveLength(curso.length);
    expect(new Set(ids).size).toBe(curso.length);
  });

  it('los tamanos no difieren en mas de uno', () => {
    for (const k of [2, 3, 4, 5, 6]) {
      const tam = armarCampos(curso, k).map((c) => c.miembros.length);
      expect(Math.max(...tam) - Math.min(...tam), `k=${k}`).toBeLessThanOrEqual(1);
    }
  });

  it('separa racimos que estan de verdad separados', () => {
    // Con cuatro campos y cuatro racimos, cada campo deberia ser un racimo:
    // es el caso facil, y si este falla el resto no significa nada.
    const campos = armarCampos(curso, 4);
    for (const c of campos) {
      const prefijos = new Set(c.miembros.map((x) => x.id[0]));
      expect(prefijos.size).toBe(1);
    }
  });

  it('es determinista: la misma entrada da los mismos campos', () => {
    const a = armarCampos(curso, 4).map((c) => c.miembros.map((x) => x.id).sort().join(','));
    const b = armarCampos(curso, 4).map((c) => c.miembros.map((x) => x.id).sort().join(','));
    expect(a).toEqual(b);
  });

  it('no depende del orden en que llegaron los alumnos', () => {
    const alReves = [...curso].reverse();
    const norm = (cs: ReturnType<typeof armarCampos>) =>
      cs.map((c) => c.miembros.map((x) => x.id).sort().join(',')).sort();
    expect(norm(armarCampos(alReves, 4))).toEqual(norm(armarCampos(curso, 4)));
  });

  it('no deja a un campo con una sola persona por llenar a otro', () => {
    // El caso que mata la actividad: 26 en un lado, 2 en el otro.
    const desbalanceado: Miembro[] = [
      ...Array.from({ length: 26 }, (_, i) => m(`x${i}`, 0 + i * 0.01, 0)),
      m('y0', 9, 9),
      m('y1', 9.1, 9),
    ];
    const tam = armarCampos(desbalanceado, 4).map((c) => c.miembros.length);
    expect(Math.min(...tam)).toBeGreaterThanOrEqual(7);
  });

  it('el timon pesa cuando se le pide', () => {
    // Dos personas en el MISMO punto del plano pero con timones opuestos: sin
    // peso caen juntas, con peso el algoritmo prefiere separarlas.
    const gente: Miembro[] = [
      m('p0', 0, 0, 'estado'),
      m('p1', 0.1, 0, 'empresas'),
      m('p2', 0.2, 0, 'estado'),
      m('p3', 0.3, 0, 'empresas'),
    ];
    const con = armarCampos(gente, 2, { pesoTimon: 8 });
    for (const c of con) {
      const timones = new Set(c.miembros.map((x) => x.timon));
      expect(timones.size).toBe(1);
    }
  });

  it('aguanta los bordes en vez de romperse', () => {
    expect(armarCampos([], 4)).toEqual([]);
    expect(armarCampos(curso, 0).length).toBe(1); // k se sube a 1
    expect(armarCampos(curso, 99).length).toBeLessThanOrEqual(curso.length);
    expect(armarCampos([m('solo', 1, 1)], 4)).toHaveLength(1);
  });

  it('descarta posiciones no finitas', () => {
    const conBasura = [...curso, { id: 'z', nombre: 'Z', magnitud: NaN, direccion: 0 }];
    const ids = armarCampos(conBasura, 4).flatMap((c) => c.miembros.map((x) => x.id));
    expect(ids).not.toContain('z');
    expect(ids).toHaveLength(curso.length);
  });
});

describe('mezclar', () => {
  it('cada grupo junta gente de campos distintos', () => {
    const campos = armarCampos(curso, 4);
    const grupos = mezclar(campos, 7);
    for (const g of grupos) {
      expect(new Set(g.miembros.map((x) => x.campo)).size).toBeGreaterThan(1);
    }
  });

  it('reparte a todos, sin repetir', () => {
    const campos = armarCampos(curso, 4);
    const ids = mezclar(campos, 7).flatMap((g) => g.miembros.map((x) => x.id));
    expect(ids).toHaveLength(curso.length);
    expect(new Set(ids).size).toBe(curso.length);
  });

  it('los tamanos quedan parejos', () => {
    const tam = mezclar(armarCampos(curso, 4), 7).map((g) => g.miembros.length);
    expect(Math.max(...tam) - Math.min(...tam)).toBeLessThanOrEqual(1);
  });

  it('aguanta los bordes', () => {
    expect(mezclar([], 4)).toEqual([]);
    expect(mezclar(armarCampos(curso, 4), 0)).toHaveLength(1);
  });
});
