// Mayoria contra puente. Dos reglas puente:
//  - Polis: aprobacion suavizada (a+1)/(n+2) en cada grupo detectado; minimo y producto.
//  - Community Notes: r = mu + i_persona + i_propuesta + f_persona * f_propuesta, factor de 1
//    dimension, valores (v-1)/4, lambda_i = 0.15 y lambda_f = 0.03 (twitter/communitynotes,
//    documentation/under-the-hood/ranking-notes.md). El intercepto de la propuesta es el apoyo
//    que no explica el bando: el puntaje puente. Personas y propuestas quedan en el mismo eje.
import { aprueba, idBot, type Matriz, type Persona, type Voto } from '../contrato';
import { aprobacion, type FiltroPersona } from './basico';
import { grupos, mapaPCA, type Grupos } from './mapa';

export function puentePolis(m: Matriz, filtro: FiltroPersona, asignacion: Record<string, number>) {
  const personas = new Set(m.personas.filter(filtro).map((p) => p.id));
  const kGrupos = Math.max(0, ...Object.values(asignacion)) + 1;
  const out: Record<string, { minimo: number; producto: number; porGrupo: number[] }> = {};
  for (const prop of m.instrumento.propuestas) {
    const a = Array<number>(kGrupos).fill(0), n = Array<number>(kGrupos).fill(0);
    for (const v of m.votos) {
      if (v.propuesta !== prop.id || !personas.has(v.persona)) continue;
      const g = asignacion[v.persona];
      if (g === undefined) continue;
      n[g] += 1;
      if (aprueba(v.valor)) a[g] += 1;
    }
    const porGrupo = a.map((ag, g) => (ag + 1) / (n[g] + 2));
    out[prop.id] = { minimo: Math.min(...porGrupo), producto: porGrupo.reduce((s, x) => s * x, 1), porGrupo };
  }
  return out;
}

export interface ResultadoCN {
  mu: number;
  propuestas: Record<string, { intercepto: number; factor: number }>;
  personas: Record<string, { intercepto: number; factor: number }>;
}

export function factorizacionCN(
  m: Matriz, filtro: FiltroPersona, opts: { lambdaI?: number; lambdaF?: number; iter?: number } = {},
): ResultadoCN {
  const lI = opts.lambdaI ?? 0.15, lF = opts.lambdaF ?? 0.03, iter = opts.iter ?? 300;
  const personas = m.personas.filter(filtro).map((p) => p.id);
  const pIdx = new Map(personas.map((id, i) => [id, i]));
  const props = m.instrumento.propuestas.map((p) => p.id);
  const qIdx = new Map(props.map((id, j) => [id, j]));
  const R = m.votos
    .filter((v) => pIdx.has(v.persona) && qIdx.has(v.propuesta))
    .map((v) => ({ u: pIdx.get(v.persona)!, n: qIdx.get(v.propuesta)!, r: (v.valor - 1) / 4 }));
  const iu = new Array<number>(personas.length).fill(0), inn = new Array<number>(props.length).fill(0);
  // Inicializacion determinista y no simetrica de los factores.
  const fu = personas.map((_, i) => 0.1 * Math.sin(i + 1));
  const fn = props.map((_, j) => 0.1 * Math.cos(j + 1));
  let mu = 0;
  const porU = personas.map(() => [] as typeof R), porN = props.map(() => [] as typeof R);
  for (const x of R) { porU[x.u].push(x); porN[x.n].push(x); }
  for (let it = 0; it < iter; it++) {
    mu = R.reduce((s, x) => s + (x.r - iu[x.u] - inn[x.n] - fu[x.u] * fn[x.n]), 0) / (R.length + lI);
    for (let u = 0; u < personas.length; u++)
      iu[u] = porU[u].reduce((s, x) => s + (x.r - mu - inn[x.n] - fu[u] * fn[x.n]), 0) / (porU[u].length + lI);
    for (let n = 0; n < props.length; n++)
      inn[n] = porN[n].reduce((s, x) => s + (x.r - mu - iu[x.u] - fu[x.u] * fn[n]), 0) / (porN[n].length + lI);
    for (let u = 0; u < personas.length; u++) {
      const num = porU[u].reduce((s, x) => s + fn[x.n] * (x.r - mu - iu[u] - inn[x.n]), 0);
      const den = porU[u].reduce((s, x) => s + fn[x.n] ** 2, 0) + lF;
      fu[u] = num / den;
    }
    for (let n = 0; n < props.length; n++) {
      const num = porN[n].reduce((s, x) => s + fu[x.u] * (x.r - mu - iu[x.u] - inn[n]), 0);
      const den = porN[n].reduce((s, x) => s + fu[x.u] ** 2, 0) + lF;
      fn[n] = num / den;
    }
  }
  // Signo fijo: la propuesta de mayor |factor| queda positiva.
  const jMax = fn.reduce((b, x, j) => (Math.abs(x) > Math.abs(fn[b]) ? j : b), 0);
  const s = fn[jMax] < 0 ? -1 : 1;
  return {
    mu,
    propuestas: Object.fromEntries(props.map((id, j) => [id, { intercepto: inn[j], factor: s * fn[j] }])),
    personas: Object.fromEntries(personas.map((id, i) => [id, { intercepto: iu[i], factor: s * fu[i] }])),
  };
}

export interface Rankings { mayoria: string[]; puenteCN: string[]; puentePolis: string[]; grupos: Grupos }

const ordenar = (xs: Record<string, number>) =>
  Object.entries(xs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);

export function rankings(m: Matriz, filtro: FiltroPersona): Rankings {
  const mapa = mapaPCA(m, filtro);
  const ids = new Set(m.personas.filter(filtro).map((p) => p.id));
  const g = grupos(mapa.puntos.filter((p) => ids.has(p.personaId)).map((p) => ({ id: p.personaId, x: p.x, y: p.y })));
  const ap = aprobacion(m, filtro);
  const cn = factorizacionCN(m, filtro);
  const polis = puentePolis(m, filtro, g.asignacion);
  return {
    mayoria: ordenar(Object.fromEntries(Object.entries(ap).map(([k, v]) => [k, Number.isNaN(v.tasa) ? -1 : v.tasa]))),
    puenteCN: ordenar(Object.fromEntries(Object.entries(cn.propuestas).map(([k, v]) => [k, v.intercepto]))),
    puentePolis: ordenar(Object.fromEntries(Object.entries(polis).map(([k, v]) => [k, v.minimo]))),
    grupos: g,
  };
}

export function inundar(m: Matriz, personaId: string, n: number): Matriz {
  const original = m.personas.find((p) => p.id === personaId);
  if (!original || n <= 0) return { ...m, personas: [...m.personas], votos: [...m.votos] };
  const suyos = m.votos.filter((v) => v.persona === personaId);
  const personas: Persona[] = [...m.personas];
  const votos: Voto[] = [...m.votos];
  for (let i = 0; i < n; i++) {
    const id = idBot(i, original.ref);
    personas.push({ id, ref: `${original.ref}_bot${i}`, fuente: 'bot', via: 'simulado', condicion: `copia de ${personaId}` });
    for (const v of suyos) votos.push({ persona: id, propuesta: v.propuesta, valor: v.valor });
  }
  return { ...m, personas, votos };
}
