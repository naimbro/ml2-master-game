// El contrato que comparten la app, la Function de avatares, el puente con
// MiroFish y la analitica. Spec 2026-11-07, seccion M0. Una matriz larga con
// huecos: cada persona (humano, avatar, avatar en red, bot) vota un subconjunto
// de propuestas en Likert 1-5.

export type Fuente = 'humano' | 'avatar' | 'avatar_red' | 'bot';
export type Via = 'app' | 'mirofish' | 'simulado';

export interface CampoPlanilla {
  id: string;
  etiqueta: string;
  tipo: 'texto' | 'opcion' | 'escala';
  opciones?: string[];
  /** No sale nunca hacia un LLM ni hacia MiroFish (p. ej. la ciudad). */
  sensible?: boolean;
  ayuda?: string;
}

export interface Propuesta {
  id: string;
  texto: string;
  origen: 'instrumento' | 'alumno' | 'llm';
  autorRef?: string;
  tema?: string;
  /** La posicion contraria con nombre. MiroFish la necesita (no acepta acuerdo/desacuerdo). */
  polo?: string;
}

export interface Instrumento {
  id: string;
  version: number;
  titulo: string;
  escala: { min: 1; max: 5; aprueba: 4; etiquetas: string[] };
  planilla: CampoPlanilla[];
  propuestas: Propuesta[];
}

export interface Persona {
  id: string;
  /** Seudonimo del humano al que corresponde. Une al humano con todos sus avatares. */
  ref: string;
  fuente: Fuente;
  via: Via;
  modelo?: string;
  replica?: number;
  condicion?: string;
}

export interface Voto {
  persona: string;
  propuesta: string;
  valor: number;
}

export interface Matriz {
  instrumento: Instrumento;
  personas: Persona[];
  votos: Voto[];
}

/** FNV-1a de 32 bits. No es criptografico: basta para un seudonimo de curso. */
function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function refDe(uid: string, code: string): string {
  const s = `${code}:${uid}`;
  const a = fnv1a(s, 0x811c9dc5).toString(16).padStart(8, '0');
  const b = fnv1a(s, 0x9e3779b9).toString(16).padStart(8, '0');
  return `r${(a + b).slice(0, 12)}`;
}

const limpio = (s: string) => s.replace(/[/\s]+/g, '-');

export const idHumano = (ref: string) => `h_${ref}`;
export const idAvatar = (modelo: string, ref: string) => `a_${limpio(modelo)}_${ref}`;
export const idMirofishBase = (ref: string) => `mb_${ref}`;
export const idMirofishRed = (replica: number, ref: string) => `mr${replica}_${ref}`;
export const idBot = (i: number, ref: string) => `bot${i}_${ref}`;

export const aprueba = (valor: number) => valor >= 4;

export function validarMatriz(m: Matriz): string[] {
  const errs: string[] = [];
  const personas = new Set<string>();
  for (const p of m.personas) {
    if (personas.has(p.id)) errs.push(`persona duplicada: ${p.id}`);
    personas.add(p.id);
  }
  const propuestas = new Set(m.instrumento.propuestas.map((p) => p.id));
  const vistos = new Set<string>();
  for (const v of m.votos) {
    if (!personas.has(v.persona)) errs.push(`persona inexistente: ${v.persona}`);
    if (!propuestas.has(v.propuesta)) errs.push(`propuesta inexistente: ${v.propuesta}`);
    if (!Number.isInteger(v.valor)) errs.push(`valor no entero: ${v.persona}/${v.propuesta}=${v.valor}`);
    else if (v.valor < m.instrumento.escala.min || v.valor > m.instrumento.escala.max)
      errs.push(`valor fuera de escala: ${v.persona}/${v.propuesta}=${v.valor}`);
    const k = `${v.persona}|${v.propuesta}`;
    if (vistos.has(k)) errs.push(`voto repetido: ${k}`);
    vistos.add(k);
  }
  return errs;
}
