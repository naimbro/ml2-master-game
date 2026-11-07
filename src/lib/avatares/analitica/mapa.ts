// El mapa latente de Evans y Weyl / Polis: PCA sobre la matriz de votos. Se
// ajusta con los humanos y TODAS las fuentes se proyectan en esas coordenadas,
// para que humanos, avatares y avatares en red se comparen en el mismo plano.
import type { Fuente, Matriz } from '../contrato';
import { mulberry32 } from '../azar';
import { porFuente, type FiltroPersona } from './basico';

export interface PuntoMapa { personaId: string; ref: string; fuente: Fuente; x: number; y: number }
export interface Mapa {
  puntos: PuntoMapa[];
  cargas: { propuesta: string; x: number; y: number }[];
  varianzaExplicada: [number, number];
  degenerado: boolean;
}

const EPS = 1e-9;

function filas(m: Matriz, ids: string[]): (number | null)[][] {
  const col = new Map(m.instrumento.propuestas.map((p, j) => [p.id, j]));
  const fila = new Map(ids.map((id, i) => [id, i]));
  const X: (number | null)[][] = ids.map(() => m.instrumento.propuestas.map(() => null));
  for (const v of m.votos) {
    const i = fila.get(v.persona), j = col.get(v.propuesta);
    if (i !== undefined && j !== undefined) X[i][j] = v.valor;
  }
  return X;
}

/** Primer vector propio de C (simetrica) por iteracion de potencia, determinista. */
function vectorPropio(C: number[][]): { v: number[]; lambda: number } {
  const d = C.length;
  let v = Array.from({ length: d }, (_, i) => 1 / Math.sqrt(d) + i * 1e-3);
  let lambda = 0;
  for (let it = 0; it < 500; it++) {
    const w = C.map((fila) => fila.reduce((s, c, j) => s + c * v[j], 0));
    const norma = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
    if (norma < EPS) return { v: v.map(() => 0), lambda: 0 };
    const nv = w.map((x) => x / norma);
    lambda = norma;
    const delta = nv.reduce((s, x, j) => s + Math.abs(x - v[j]), 0);
    v = nv;
    if (delta < 1e-12) break;
  }
  // Signo fijo: la componente de mayor valor absoluto es positiva.
  const iMax = v.reduce((b, x, i) => (Math.abs(x) > Math.abs(v[b]) ? i : b), 0);
  if (v[iMax] < 0) v = v.map((x) => -x);
  return { v, lambda };
}

export function mapaPCA(m: Matriz, ajustarCon: FiltroPersona = porFuente('humano')): Mapa {
  const d = m.instrumento.propuestas.length;
  const ajuste = m.personas.filter(ajustarCon);
  const Xa = filas(m, ajuste.map((p) => p.id));
  const medias = Array.from({ length: d }, (_, j) => {
    const xs = Xa.map((f) => f[j]).filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 3;
  });
  const centrar = (f: (number | null)[]) => f.map((x, j) => (x === null ? 0 : x - medias[j]));
  const Za = Xa.map(centrar);
  const n = Math.max(Za.length, 1);
  const C = Array.from({ length: d }, (_, a) =>
    Array.from({ length: d }, (_, b) => Za.reduce((s, z) => s + z[a] * z[b], 0) / n));
  const traza = C.reduce((s, f, i) => s + f[i], 0);
  const e1 = vectorPropio(C);
  const C2 = C.map((f, a) => f.map((c, b) => c - e1.lambda * e1.v[a] * e1.v[b]));
  const e2 = vectorPropio(C2);
  const degenerado = ajuste.length < 4 || traza < EPS;
  const todas = m.personas;
  const Z = filas(m, todas.map((p) => p.id)).map(centrar);
  const puntos = todas.map((p, i) => ({
    personaId: p.id, ref: p.ref, fuente: p.fuente,
    x: Z[i].reduce((s, z, j) => s + z * e1.v[j], 0),
    y: Z[i].reduce((s, z, j) => s + z * e2.v[j], 0),
  }));
  return {
    puntos,
    cargas: m.instrumento.propuestas.map((p, j) => ({ propuesta: p.id, x: e1.v[j], y: e2.v[j] })),
    varianzaExplicada: traza < EPS ? [0, 0] : [e1.lambda / traza, e2.lambda / traza],
    degenerado,
  };
}

export interface Grupos {
  k: number;
  asignacion: Record<string, number>;
  centroides: [number, number][];
  silueta: number;
  degenerado: boolean;
}

type P = { id: string; x: number; y: number };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function kmeans(pts: P[], k: number, seed: number): { asig: number[]; cents: [number, number][] } {
  const r = mulberry32(seed);
  const cents: [number, number][] = [[pts[0].x, pts[0].y]];
  while (cents.length < k) {
    // k-means++ determinista: el siguiente centro con probabilidad proporcional a d^2.
    const d2 = pts.map((p) => Math.min(...cents.map(([cx, cy]) => (p.x - cx) ** 2 + (p.y - cy) ** 2)));
    const tot = d2.reduce((a, b) => a + b, 0);
    let u = r() * tot, i = 0;
    while (i < pts.length - 1 && u > d2[i]) { u -= d2[i]; i++; }
    cents.push([pts[i].x, pts[i].y]);
  }
  let asig = pts.map(() => 0);
  for (let it = 0; it < 100; it++) {
    const nueva = pts.map((p) =>
      cents.reduce((b, c, j) => (dist(p, { x: c[0], y: c[1] }) < dist(p, { x: cents[b][0], y: cents[b][1] }) ? j : b), 0));
    for (let j = 0; j < k; j++) {
      const miembros = pts.filter((_, i) => nueva[i] === j);
      if (miembros.length)
        cents[j] = [miembros.reduce((s, p) => s + p.x, 0) / miembros.length, miembros.reduce((s, p) => s + p.y, 0) / miembros.length];
    }
    const igual = nueva.every((a, i) => a === asig[i]);
    asig = nueva;
    if (igual && it > 0) break;
  }
  return { asig, cents };
}

function silueta(pts: P[], asig: number[], k: number): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const propio = pts.filter((_, j) => j !== i && asig[j] === asig[i]);
    if (!propio.length) continue;
    const a = propio.reduce((t, q) => t + dist(pts[i], q), 0) / propio.length;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === asig[i]) continue;
      const otros = pts.filter((_, j) => asig[j] === c);
      if (otros.length) b = Math.min(b, otros.reduce((t, q) => t + dist(pts[i], q), 0) / otros.length);
    }
    if (Number.isFinite(b)) s += (b - a) / Math.max(a, b, EPS);
  }
  return s / pts.length;
}

export function grupos(puntos: P[], kMax = 4): Grupos {
  const distintos = new Set(puntos.map((p) => `${p.x.toFixed(9)},${p.y.toFixed(9)}`)).size;
  const tope = Math.min(kMax, distintos, Math.floor(puntos.length / 2));
  if (tope < 2) {
    const cx = puntos.reduce((s, p) => s + p.x, 0) / Math.max(puntos.length, 1);
    const cy = puntos.reduce((s, p) => s + p.y, 0) / Math.max(puntos.length, 1);
    return { k: 1, asignacion: Object.fromEntries(puntos.map((p) => [p.id, 0])), centroides: [[cx, cy]], silueta: 0, degenerado: true };
  }
  let mejor: Grupos | null = null;
  for (let k = 2; k <= tope; k++) {
    const { asig, cents } = kmeans(puntos, k, 20261109 + k);
    const s = silueta(puntos, asig, k);
    if (!mejor || s > mejor.silueta + 1e-12) {
      mejor = {
        k, asignacion: Object.fromEntries(puntos.map((p, i) => [p.id, asig[i]])),
        centroides: cents.map((c) => [c[0], c[1]] as [number, number]), silueta: s, degenerado: false,
      };
    }
  }
  return mejor!;
}
