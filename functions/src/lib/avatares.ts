// Avatares de la Semana 14 AyD (spec 2026-11-07, M2). El texto de la planilla ya
// viene seudonimizado desde la app (planillaComoTexto): sin nombre, uid, correo
// ni ciudad, edad en tramos. El parrafo de instrucciones es el de la planilla de
// Vina, para que el avatar sea el mismo que armaban los alumnos a mano.
// v2 (2026-11-09): el mismo texto de prompt, pero los modelos razonan antes de votar
// (callJudgeModel con profundo: true, 16000 tokens). v1 = razonamiento al minimo, 800 tokens.
export const PROMPT_VERSION = 'avatar-v2';

/** FNV-1a de 32 bits; copia exacta de refDe (src/lib/avatares/contrato.ts), fijada por prueba. */
function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** El seudonimo del alumno, derivado del uid (id del doc) en el servidor: el cliente no lo puede elegir. */
export function refAvatares(uid: string, code: string): string {
  const s = `${code}:${uid}`;
  const a = fnv1a(s, 0x811c9dc5).toString(16).padStart(8, '0');
  const b = fnv1a(s, 0x9e3779b9).toString(16).padStart(8, '0');
  return `r${(a + b).slice(0, 12)}`;
}

export function idAvatarFn(modelo: string, ref: string): string {
  return `a_${modelo.replace(/[/\s]+/g, '-')}_${ref}`;
}

export function promptAvatar(textoPlanilla: string, propuestas: { id: string; texto: string }[], etiquetas: string[]) {
  const systemPrefix =
    'Por favor, a partir de la información que está abajo, simula ser mi representante político digital (mi avatar). ' +
    'Responde siempre como si fueras yo, tomando decisiones políticas coherentes con estas preferencias. ' +
    'No hables como un asistente de IA, sino como si fueras mi representante político.\n\n' +
    `Escala: 1 = ${etiquetas[0]}, 2 = ${etiquetas[1]}, 3 = ${etiquetas[2]}, 4 = ${etiquetas[3]}, 5 = ${etiquetas[4]}.\n`;
  const lista = propuestas.map((p) => `- "${p.id}": ${p.texto}`).join('\n');
  const systemSuffix = `\nMi información:\n${textoPlanilla}\n\nPropuestas:\n${lista}\n`;
  const userPrompt =
    'Vota cada propuesta como votaría yo. Responde SOLO con un objeto JSON cuyas claves son los ids de las propuestas ' +
    'y cuyos valores son enteros de 1 a 5. Sin texto adicional.';
  return { systemPrefix, systemSuffix, userPrompt };
}

function comoNumero(x: unknown): number {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '') return Number(x.trim());
  return NaN;
}

/** Lo normalizable se normaliza; lo demas queda como faltante, nunca como un voto inventado. */
export function normalizarVotos(raw: Record<string, unknown>, ids: string[]) {
  const anidado = raw && typeof raw.votos === 'object' && raw.votos !== null;
  const fuente = (anidado ? raw.votos : raw ?? {}) as Record<string, unknown>;
  const votos: Record<string, number> = {};
  const faltantes: string[] = [];
  for (const id of ids) {
    const v = comoNumero(fuente[id]);
    const r = Math.round(v);
    if (Number.isFinite(v) && r >= 1 && r <= 5) votos[id] = r;
    else faltantes.push(id);
  }
  return { votos, faltantes };
}

/**
 * Con menos compañeros que esto, el promedio del curso no se muestra: con 1 o 2
 * compañeros, el promedio deja ver sus votos (con uno, es exactamente su voto).
 */
export const MIN_CURSO = 5;

/**
 * Promedio por propuesta de las encuestas COMPLETAS de los demás (sin la persona),
 * o null si son menos de MIN_CURSO. Es la vara del alumno: ¿su avatar lo conoce
 * mejor que simplemente adivinar lo que piensa el curso?
 */
export function promedioCurso(otros: Record<string, unknown>[], ids: string[], min = MIN_CURSO) {
  const completos = otros.filter((v) => ids.every((id) => Number.isFinite(v?.[id]))) as Record<string, number>[];
  if (completos.length < min) return { curso: null, n: completos.length };
  const curso = Object.fromEntries(ids.map((id) => [id, completos.reduce((s, v) => s + v[id], 0) / completos.length]));
  return { curso, n: completos.length };
}
