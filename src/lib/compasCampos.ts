// Campos: turning a cloud of positions into debate groups.
//
// Not by archetype. There are ten of those and a course has under thirty
// people, so grouping by archetype hands you a group of seven and three groups
// of one — and a debate needs sides of comparable size or the small one just
// stops talking.
//
// So: k fields with a CAPACITY CEILING. Plain k-means would be the obvious
// tool and is the wrong one here, because nothing in it stops one cluster from
// swallowing half the class. Balance is a hard requirement of the activity, not
// a nice-to-have of the statistics.
//
// Deterministic: no Math.random and no Date. Same positions in, same fields
// out — which matters, because a professor who reshuffles and gets different
// groups cannot explain the grouping to the class.

import type { Timon } from '../types/compas';

export interface Miembro {
  id: string;
  nombre: string;
  magnitud: number;
  direccion: number;
  timon?: Timon | null;
}

export interface Campo {
  n: number;
  miembros: Miembro[];
  centroide: { magnitud: number; direccion: number };
}

export interface OpcionesCampos {
  /**
   * Extra distance charged when two people disagree about who should hold the
   * wheel. 0 ignores it; around 4 makes it weigh about as much as a quarter of
   * the plane. Useful when the debate is about governance, where the wheel
   * separates people better than the direction axis does.
   */
  pesoTimon?: number;
}

const dist = (
  a: { magnitud: number; direccion: number; timon?: Timon | null },
  b: { magnitud: number; direccion: number; timon?: Timon | null },
  pesoTimon: number,
) => {
  const base = Math.hypot(a.magnitud - b.magnitud, a.direccion - b.direccion);
  const castigo =
    pesoTimon > 0 && a.timon && b.timon && a.timon !== b.timon ? pesoTimon : 0;
  return base + castigo;
};

function centroide(ms: Miembro[]): { magnitud: number; direccion: number; timon?: Timon | null } {
  if (ms.length === 0) return { magnitud: 0, direccion: 0 };
  // El centro arrastra el timon MAYORITARIO del grupo. Sin eso el castigo por
  // timon distinto solo se aplicaba contra las semillas y desaparecia en los
  // refinamientos —los centros no tenian timon—, deshaciendo en la segunda
  // pasada la separacion que la primera habia logrado.
  const cuenta = new Map<Timon, number>();
  for (const m of ms) if (m.timon) cuenta.set(m.timon, (cuenta.get(m.timon) ?? 0) + 1);
  const mayoritario =
    [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  return {
    magnitud: ms.reduce((s, m) => s + m.magnitud, 0) / ms.length,
    direccion: ms.reduce((s, m) => s + m.direccion, 0) / ms.length,
    timon: mayoritario,
  };
}

/**
 * Seeds as far apart as possible: the first is the point furthest from the
 * centre of the cloud, and each next one maximises its distance to the seeds
 * already chosen.
 *
 * Picking the extremes rather than the densest spots is deliberate — the seeds
 * define what the fields will ARGUE about, and two seeds drawn from the same
 * crowded middle produce two groups that agree with each other.
 */
function semillas(ms: Miembro[], k: number, pesoTimon: number): Miembro[] {
  if (ms.length === 0) return [];
  const centro = centroide(ms);
  const orden = [...ms].sort((a, b) => a.id.localeCompare(b.id)); // estable ante el orden de llegada
  const elegidas: Miembro[] = [
    orden.reduce((mejor, m) =>
      dist(m, centro, 0) > dist(mejor, centro, 0) ? m : mejor,
    ),
  ];
  while (elegidas.length < Math.min(k, orden.length)) {
    let mejor: Miembro | null = null;
    let mejorDist = -1;
    for (const m of orden) {
      if (elegidas.some((s) => s.id === m.id)) continue;
      const d = Math.min(...elegidas.map((s) => dist(m, s, pesoTimon)));
      if (d > mejorDist) {
        mejorDist = d;
        mejor = m;
      }
    }
    if (!mejor) break;
    elegidas.push(mejor);
  }
  return elegidas;
}

function asignar(
  ms: Miembro[],
  centros: Array<{ magnitud: number; direccion: number; timon?: Timon | null }>,
  cupos: number[],
  pesoTimon: number,
): Miembro[][] {
  const pares: Array<{ m: Miembro; c: number; d: number }> = [];
  ms.forEach((m) => {
    centros.forEach((c, ci) => pares.push({ m, c: ci, d: dist(m, c, pesoTimon) }));
  });
  // Desempate por id para que dos alumnos a la misma distancia caigan siempre
  // en el mismo campo entre una corrida y otra.
  pares.sort((x, y) => x.d - y.d || x.m.id.localeCompare(y.m.id) || x.c - y.c);

  const grupos: Miembro[][] = centros.map(() => []);
  const puestos = new Set<string>();
  for (const p of pares) {
    if (puestos.has(p.m.id)) continue;
    if (grupos[p.c].length >= cupos[p.c]) continue;
    grupos[p.c].push(p.m);
    puestos.add(p.m.id);
  }
  // Si alguien quedó fuera porque todos sus campos cercanos se llenaron, entra
  // al que tenga menos gente. Nadie se queda sin grupo.
  for (const m of ms) {
    if (puestos.has(m.id)) continue;
    const i = grupos.reduce((mejor, g, gi) => (g.length < grupos[mejor].length ? gi : mejor), 0);
    grupos[i].push(m);
    puestos.add(m.id);
  }
  return grupos;
}

/**
 * k balanced fields. Sizes differ by at most one person.
 */
export function armarCampos(miembros: Miembro[], k: number, opts: OpcionesCampos = {}): Campo[] {
  const ms = (miembros ?? []).filter(
    (m) => m && Number.isFinite(m.magnitud) && Number.isFinite(m.direccion),
  );
  const pesoTimon = opts.pesoTimon ?? 0;
  const kReal = Math.max(1, Math.min(Math.floor(k), ms.length));
  if (ms.length === 0) return [];

  // Cupos EXACTOS: reparten ms.length entre kReal sin holgura. Con ceil() puro,
  // 28 personas en 3 campos daban cupo 10 y salia 10/10/8 — dos de diferencia,
  // que en un debate ya se nota.
  const base = Math.floor(ms.length / kReal);
  const sobran = ms.length % kReal;
  const cupos = Array.from({ length: kReal }, (_, i) => base + (i < sobran ? 1 : 0));

  let centros: Array<{ magnitud: number; direccion: number; timon?: Timon | null }> = semillas(
    ms,
    kReal,
    pesoTimon,
  );
  let grupos = asignar(ms, centros, cupos, pesoTimon);

  // Dos refinamientos: mueve los centros al medio de lo que quedó y reasigna.
  // Más iteraciones no cambian nada apreciable con treinta puntos y sí harían
  // el resultado más difícil de explicar.
  for (let i = 0; i < 2; i++) {
    centros = grupos.map((g, gi) => (g.length ? centroide(g) : centros[gi]));
    grupos = asignar(ms, centros, cupos, pesoTimon);
  }

  return grupos
    .map((g, i) => ({ n: i + 1, miembros: g, centroide: centroide(g) }))
    .filter((c) => c.miembros.length > 0)
    .map((c, i) => ({ ...c, n: i + 1 }));
}

export interface GrupoMezclado {
  n: number;
  miembros: Array<Miembro & { campo: number }>;
}

/**
 * Mixed groups: one person from each field, as far as the numbers allow.
 *
 * The other half of the activity. Homogeneous fields let a position be argued
 * at its strongest; mixed groups are where somebody has to sit with the
 * strongest version of what they disagree with — and if you measure again
 * afterwards, that is a deliberative poll of your own class.
 */
export function mezclar(campos: Campo[], nGrupos: number): GrupoMezclado[] {
  const total = (campos ?? []).reduce((s, c) => s + c.miembros.length, 0);
  const g = Math.max(1, Math.min(Math.floor(nGrupos), total));
  if (total === 0) return [];

  const grupos: GrupoMezclado[] = Array.from({ length: g }, (_, i) => ({ n: i + 1, miembros: [] }));
  // Se reparte campo por campo y se sigue donde quedó el anterior, para que los
  // primeros grupos no se lleven siempre a los del primer campo.
  let cursor = 0;
  for (const campo of campos) {
    for (const m of campo.miembros) {
      grupos[cursor % g].miembros.push({ ...m, campo: campo.n });
      cursor += 1;
    }
  }
  return grupos.filter((x) => x.miembros.length > 0);
}
