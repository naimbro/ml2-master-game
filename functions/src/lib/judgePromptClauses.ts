/**
 * Two anti-noise clauses appended to every judge prompt, targeting the two
 * systematic verifier failure modes documented in Peng et al. 2026,
 * "Can LLM-as-a-Judge Reliably Verify Rubrics in Agentic Scenarios?" (RuVerBench):
 *
 *  1. PARTIAL SATISFACTION — the judge credits a level from fragmentary or
 *     merely-implied evidence. Our anchor design ("pick level 0/20/.../100")
 *     already gives each level a written definition, but nothing tells the judge
 *     that a level requires ALL of what it describes. STRICT_ANCHOR_CLAUSE does.
 *
 *  2. REQUIREMENT EXPANSION — the judge invents constraints not in the rubric
 *     (specific wording, extra reasoning, length) and lowers a level for missing
 *     them. ANTI_EXPANSION_CLAUSE forbids this: judge only against the shown
 *     dimensions and penalties.
 *
 * These are exported individually so the offline A/B harness
 * (scripts/bt-judge-prompt-ab.ts) can reuse the EXACT production text rather than
 * a drifting copy.
 */

/** Fix for PARTIAL SATISFACTION: a level requires everything it describes. */
export const STRICT_ANCHOR_CLAUSE =
  `CALIBRACION ESTRICTA DE NIVELES: cada nivel (0, 20, 40, 60, 80, 100) describe TODO lo que la respuesta `
  + `debe cumplir para merecerlo. Otorga un nivel solo si la respuesta cumple TODO lo que ese nivel describe. `
  + `Si solo cumple parte de la definicion, o la evidencia es fragmentaria, insinuada o generica, BAJA al nivel `
  + `inferior. Evidencia parcial no es cumplimiento total: ante la duda entre dos niveles, elige el menor.`;

/** Fix for REQUIREMENT EXPANSION: judge only against the rubric shown. */
export const ANTI_EXPANSION_CLAUSE =
  `EVALUA SOLO LO QUE PIDE LA RUBRICA: juzga la respuesta unicamente contra las dimensiones y penalizaciones `
  + `mostradas arriba. NO exijas contenido, formato, extension, terminologia ni razonamiento que la rubrica no `
  + `pide, aunque a ti te parezca deseable. No bajes un nivel por algo que la rubrica no requiere. Puedes `
  + `mencionar una carencia en el feedback, pero no debe afectar los niveles si la rubrica no lo pide. Si dudas `
  + `entre una expectativa tuya y lo que la rubrica pide, cinete a la rubrica.`;

/**
 * The block appended to the judge prompt, right after the rubric/reference
 * material and before the response-format instructions.
 */
export function strictJudgingClauses(): string {
  return `\n\nREGLAS DE VERIFICACION (aplican a TODAS las dimensiones):\n`
    + `- ${STRICT_ANCHOR_CLAUSE}\n`
    + `- ${ANTI_EXPANSION_CLAUSE}`;
}
