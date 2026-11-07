import { aprueba, type Fuente, type Matriz, type Persona } from '../contrato';

export type FiltroPersona = (p: Persona) => boolean;

export function porFuente(f: Fuente, extra: Partial<Persona> = {}): FiltroPersona {
  return (p) =>
    p.fuente === f &&
    Object.entries(extra).every(([k, v]) => (p as unknown as Record<string, unknown>)[k] === v);
}

/** propuesta -> ref -> valor. Si una fuente tiene varias personas por ref (replicas), promedia. */
export function valoresPorPropuesta(m: Matriz, filtro: FiltroPersona): Map<string, Map<string, number>> {
  const personas = new Map(m.personas.filter(filtro).map((p) => [p.id, p]));
  const suma = new Map<string, Map<string, [number, number]>>();
  for (const v of m.votos) {
    const p = personas.get(v.persona);
    if (!p) continue;
    if (!suma.has(v.propuesta)) suma.set(v.propuesta, new Map());
    const porRef = suma.get(v.propuesta)!;
    const [s, n] = porRef.get(p.ref) ?? [0, 0];
    porRef.set(p.ref, [s + v.valor, n + 1]);
  }
  const out = new Map<string, Map<string, number>>();
  for (const prop of m.instrumento.propuestas) {
    const porRef = suma.get(prop.id) ?? new Map<string, [number, number]>();
    out.set(prop.id, new Map([...porRef].map(([ref, [s, n]]) => [ref, s / n])));
  }
  return out;
}

export function aprobacion(m: Matriz, filtro: FiltroPersona) {
  const personas = new Set(m.personas.filter(filtro).map((p) => p.id));
  const out: Record<string, { aprueban: number; n: number; tasa: number }> = {};
  for (const prop of m.instrumento.propuestas) out[prop.id] = { aprueban: 0, n: 0, tasa: NaN };
  for (const v of m.votos) {
    if (!personas.has(v.persona) || !out[v.propuesta]) continue;
    out[v.propuesta].n += 1;
    if (aprueba(v.valor)) out[v.propuesta].aprueban += 1;
  }
  for (const k of Object.keys(out)) out[k].tasa = out[k].n ? out[k].aprueban / out[k].n : NaN;
  return out;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function correlacionPorPropuesta(m: Matriz, filtroA: FiltroPersona, filtroB: FiltroPersona) {
  const A = valoresPorPropuesta(m, filtroA);
  const B = valoresPorPropuesta(m, filtroB);
  const refsA = new Set(m.personas.filter(filtroA).map((p) => p.ref));
  const refsB = new Set(m.personas.filter(filtroB).map((p) => p.ref));
  const refsSinPareja =
    [...refsA].filter((r) => !refsB.has(r)).length + [...refsB].filter((r) => !refsA.has(r)).length;
  const porPropuesta: Record<string, { r: number | null; n: number }> = {};
  const rs: number[] = [];
  for (const prop of m.instrumento.propuestas) {
    const a = A.get(prop.id)!, b = B.get(prop.id)!;
    const x: number[] = [], y: number[] = [];
    for (const [ref, va] of a) if (b.has(ref)) { x.push(va); y.push(b.get(ref)!); }
    const r = pearson(x, y);
    porPropuesta[prop.id] = { r, n: x.length };
    if (r !== null) rs.push(r);
  }
  return {
    porPropuesta,
    promedio: rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : null,
    refsSinPareja,
  };
}

export function dispersion(m: Matriz, filtro: FiltroPersona): Record<string, number> {
  const V = valoresPorPropuesta(m, filtro);
  const out: Record<string, number> = {};
  for (const [prop, porRef] of V) {
    const xs = [...porRef.values()];
    if (!xs.length) { out[prop] = NaN; continue; }
    const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
    out[prop] = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length;
  }
  return out;
}
