/**
 * Nombre legible del modelo que respaldó a un juez.
 *
 * Cada evaluación guarda el `model` que realmente corrió (`functions/src/index.ts`
 * lo escribe junto al score), así que esto es un registro histórico, no una
 * consulta a la configuración actual: una evaluación de julio sigue mostrando el
 * modelo de julio aunque hoy el juez esté apuntando a otro. Eso es lo que se
 * quiere — el feedback dice quién lo escribió.
 *
 * Las evaluaciones anteriores al panel multi-modelo no traen `model`. En ese caso
 * devolvemos '' y la UI no dibuja el paréntesis, en vez de mostrarlo vacío.
 */
const LABELS: Record<string, string> = {
  // OpenAI
  'gpt-5': 'GPT-5',
  'gpt-5-mini': 'GPT-5 mini',
  'gpt-5-nano': 'GPT-5 nano',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o mini',
  // Google
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
  // Anthropic
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-opus-5': 'Claude Opus 5',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
};

/**
 * Un id desconocido (modelo nuevo, o uno al que un profesor apuntó su juez) no
 * puede quedar en blanco: se capitaliza cada palabra y los tramos numéricos
 * consecutivos se reúnen con punto, que es como se escriben las versiones.
 *   'gpt-5.6-luna'      -> 'GPT 5.6 Luna'
 *   'claude-sonnet-4-6' -> 'Claude Sonnet 4.6'
 */
function fallbackLabel(model: string): string {
  const out: string[] = [];
  for (const part of model.split('-').filter(Boolean)) {
    const isVersion = /^[\d.]+$/.test(part);
    const prev = out[out.length - 1];
    if (isVersion && prev && /[\d.]$/.test(prev)) {
      out[out.length - 1] = `${prev}.${part}`;
    } else if (isVersion) {
      out.push(part);
    } else {
      out.push(/^gpt$/i.test(part) ? 'GPT' : part.charAt(0).toUpperCase() + part.slice(1));
    }
  }
  return out.join(' ');
}

export function modelLabel(model?: string): string {
  const id = (model || '').trim();
  if (!id) return '';
  return LABELS[id] ?? fallbackLabel(id);
}

/** `' (Claude Sonnet 5)'`, o `''` si la evaluación no registró modelo. */
export function modelSuffix(model?: string): string {
  const label = modelLabel(model);
  return label ? ` (${label})` : '';
}
