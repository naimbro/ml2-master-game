// Avatares de la Semana 14 AyD (spec 2026-11-07, M2). El texto de la planilla ya
// viene seudonimizado desde la app (planillaComoTexto): sin nombre, uid, correo
// ni ciudad, edad en tramos. El parrafo de instrucciones es el de la planilla de
// Vina, para que el avatar sea el mismo que armaban los alumnos a mano.
export const PROMPT_VERSION = 'avatar-v1';

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
