// Puente con MiroFish (spec M5). Lo que sale: el texto seudonimizado de la
// planilla como persona, nada mas. MiroFish exige campos de panel y marginales
// exactas (weekly/panel.py:validate_panel); la spec se GENERA desde el panel.
// MiroFish rechaza escalas de acuerdo/desacuerdo: cada propuesta va como
// eleccion forzada entre texto (A) y polo (B), mas Ninguna (C) y No se (D).
import type { Instrumento, Persona } from './contrato';
import type { DocPersona, DocPlanilla } from './sala';
import { tramoEdad } from './planilla';

export interface PersonaMirofish {
  id: string; nombre: string; sexo: 'Mujer' | 'Hombre' | 'No informa'; edad: number; tramo_edad: string;
  zona: 'UAI'; comuna: 'Peñalolén'; educacion: 'Universitaria (en curso)'; ocupacion: string;
  posicion_politica: 'Ninguna'; mbti: 'ISTJ'; persona: string;
}
export interface PanelMirofish { version: string; size: number; note: string; personas: PersonaMirofish[] }
export interface SpecMirofish {
  SIZE: number; SEX: Record<string, number>; AGE: Record<string, number>; EDU: Record<string, number>;
  POL: Record<string, number>; ZONES: { UAI: [number, string[]] };
}
export interface ItemMirofish {
  id: string; scale: 'choice'; topic: string; context: string; question: string; options: { letter: string; text: string }[];
}

const EDAD_CENTRAL: Record<string, number> = { '18-20': 19, '21-25': 23, '26-30': 28, '31+': 33, 'no informa': 22 };

function sexoDe(genero: string | undefined): PersonaMirofish['sexo'] {
  const g = (genero ?? '').trim().toLowerCase();
  if (/^(mujer|femenino|f)$/.test(g)) return 'Mujer';
  if (/^(hombre|masculino|m)$/.test(g)) return 'Hombre';
  return 'No informa';
}

function proporciones(xs: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of xs) c[x] = (c[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / xs.length]));
}

export function panelDesdePlanillas(planillas: DocPlanilla[], code: string) {
  const orden = [...planillas].sort((a, b) => a.ref.localeCompare(b.ref));
  const personas: PersonaMirofish[] = orden.map((p, i) => {
    const tramo = tramoEdad(p.campos?.edad ?? '');
    return {
      id: p.ref, nombre: `Estudiante ${i + 1}`, sexo: sexoDe(p.campos?.genero), edad: EDAD_CENTRAL[tramo], tramo_edad: tramo,
      zona: 'UAI', comuna: 'Peñalolén', educacion: 'Universitaria (en curso)',
      ocupacion: (p.campos?.ocupacion || 'estudiante universitario').slice(0, 80), posicion_politica: 'Ninguna', mbti: 'ISTJ',
      persona: `Estudiante de la Universidad Adolfo Ibáñez, en Chile. Así se describe políticamente:\n${p.texto ?? ''}`,
    };
  });
  const panel: PanelMirofish = {
    version: `panel_ayd14_${code}`, size: personas.length,
    note: 'Planillas seudonimizadas de la Semana 14 AyD (autorizado 2026-11-07).', personas,
  };
  const spec: SpecMirofish = {
    SIZE: personas.length,
    SEX: proporciones(personas.map((p) => p.sexo)),
    AGE: proporciones(personas.map((p) => p.tramo_edad)),
    EDU: proporciones(personas.map((p) => p.educacion)),
    POL: proporciones(personas.map((p) => p.posicion_politica)),
    ZONES: { UAI: [1, ['Peñalolén']] },
  };
  return { panel, spec };
}

export function itemsDesdeInstrumento(inst: Instrumento) {
  const todos: ItemMirofish[] = inst.propuestas.map((p) => {
    if (!p.polo) throw new Error(`la propuesta ${p.id} no tiene polo (MiroFish no acepta acuerdo/desacuerdo)`);
    const tema = (p.tema ?? p.texto).replace(/[0-9%]/g, '');
    return {
      id: p.id, scale: 'choice', topic: p.tema ?? p.texto,
      context: `En Chile se discute este tema: ${tema}. Hay dos posiciones en juego.`,
      question: '¿Cuál se acerca más a lo que piensas?',
      options: [
        { letter: 'A', text: p.texto }, { letter: 'B', text: p.polo },
        { letter: 'C', text: 'Ninguna de las dos' }, { letter: 'D', text: 'No sé' },
      ],
    };
  });
  return { question: todos[0], items: todos.slice(1) };
}

export function validarResultadosMirofish(json: unknown, refsValidos: Set<string>, propuestas: Set<string>) {
  const errores: string[] = [];
  const crudas = (json as { personas?: unknown })?.personas;
  if (!Array.isArray(crudas)) return { personas: [] as DocPersona[], errores: ['el archivo no tiene "personas"'] };
  const personas: DocPersona[] = [];
  for (const c of crudas as (Persona & { votos?: Record<string, unknown> })[]) {
    if (!refsValidos.has(c.ref)) { errores.push(`ref desconocido: ${c.ref}`); continue; }
    if (c.via !== 'mirofish' || !['avatar', 'avatar_red'].includes(c.fuente)) {
      errores.push(`persona no es de MiroFish: ${c.id}`);
      continue;
    }
    const votos: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.votos ?? {})) {
      if (propuestas.has(k) && [1, 2, 3, 4, 5].includes(v as number)) votos[k] = v as number;
    }
    const persona: DocPersona = { id: c.id, ref: c.ref, fuente: c.fuente, via: c.via, votos };
    if (c.modelo !== undefined) persona.modelo = c.modelo;
    if (c.replica !== undefined) persona.replica = c.replica;
    if (c.condicion !== undefined) persona.condicion = c.condicion;
    personas.push(persona);
  }
  return { personas, errores };
}
