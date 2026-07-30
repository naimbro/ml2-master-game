// Instrucciones de extraccion de senales, declaradas en el contenido.
//
// Las rondas diagnosticas piden al juez que ademas de evaluar, extraiga campos
// estructurados de la respuesta ("que dominio eligio", "que rol se autoasigno")
// para que el profesor arme los grupos. Ese texto de instrucciones estaba
// hardcodeado en index.ts en tres ramas elegidas por substring del id del
// escenario ('feria', 'estilo', y un else), y los campos que pedia eran los de
// ml2-2025: PREFERENCIAS_FAMILIAS, SKILL_TECH, ROL_PREFERIDO.
//
// Cualquier curso nuevo caia en el else y sus jueces recibian la lista de campos
// de otro curso. Aca el esquema viaja en el escenario y esto solo lo traduce a
// prompt. Las tres ramas viejas siguen en index.ts como fallback: las sesiones
// de ml2-2025 no declaran signalSchema y tienen que seguir funcionando igual.

export interface SignalField {
  /** La clave EXACTA que debe aparecer en parsedSignals. */
  key: string;
  /** Como se llama el campo dentro del bloque que el estudiante pega. */
  label?: string;
  /** 'texto' | 'enum' | 'entero_1_5' | 'numero' — libre; solo se muestra al juez. */
  type?: string;
  values?: string[];
  description?: string;
}

export interface SignalSchema {
  instructions?: string;
  fields: SignalField[];
}

function describeField(field: SignalField): string {
  const parts: string[] = [];
  if (field.label) parts.push(`en el bloque aparece como ${field.label}`);
  if (field.type) parts.push(`tipo ${field.type}`);
  if (field.values?.length) parts.push(`uno de: ${field.values.join(' / ')}`);
  if (field.description) parts.push(field.description);
  return parts.join('; ');
}

/**
 * El bloque de instrucciones que se le agrega al prompt del juez, o null si el
 * escenario no declara un esquema usable (ahi el llamador cae al fallback).
 */
export function buildSignalInstructions(
  schema: SignalSchema | null | undefined
): string | null {
  if (!schema || !Array.isArray(schema.fields)) return null;

  const fields = schema.fields.filter(
    (f) => f && typeof f.key === 'string' && f.key.trim()
  );
  if (fields.length === 0) return null;

  const lines = fields
    .map((f) => {
      const detail = describeField(f);
      return detail ? `- "${f.key}": ${detail}` : `- "${f.key}"`;
    })
    .join('\n');

  return `\n\nINSTRUCCIONES ADICIONALES PARA RONDA DIAGNOSTICA:
Esta ronda NO afecta el ranking. Evalua normalmente segun la rubrica, y ADEMAS extrae senales estructuradas de la respuesta.

${schema.instructions || 'Extrae los campos de la lista desde la respuesta del estudiante.'}

CAMPOS A EXTRAER:
${lines}

Incluye en tu JSON de respuesta un campo "parsedSignals" con EXACTAMENTE esas claves. Un campo que no aparezca o que no se pueda leer va como null: no lo inventes ni lo dejes fuera.
Agrega tambien "extractionConfidence" entre 0.0 y 1.0 segun la calidad del parseo (0.0 si no encontraste el bloque).
La extraccion NO cambia tu evaluacion: no premies ni castigues que el bloque este bien llenado, salvo que el judgeFocus del escenario diga otra cosa.
Manten tu feedback conciso (max 120 palabras).`;
}
