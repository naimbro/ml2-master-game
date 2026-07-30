#!/usr/bin/env node
/**
 * Reproduce, offline, lo que los jueces van a recibir de una sesion.
 *
 *   node scripts/verify-session-prompt.cjs <courseId> <sessionId>
 *   node scripts/verify-session-prompt.cjs dataviz_2026 clase_01_diagnostico
 *
 * NO reemplaza jugar el juego. Cubre los modos de falla SILENCIOSA que ni el
 * validador de contenido ni los tests unitarios detectan, porque no son errores
 * de forma sino de cableado:
 *
 *   1. El juez recibe los campos de senales de OTRO curso. Las rondas no
 *      rankeadas de ml2-2025 tienen instrucciones hardcodeadas elegidas por
 *      substring del id del escenario; una sesion nueva que no declara
 *      `signalSchema` cae ahi y sus jueces extraen PREFERENCIAS_FAMILIAS.
 *   2. Una seccion del knowledge base nunca llega, porque el conceptTag del
 *      escenario no calza con ningun marcador <!-- section: ... -->. El juez
 *      evalua sin el material de referencia y nada avisa.
 *   3. Los tres jueces terminan con los mismos pesos por dimension. Sin
 *      `config.judgeConfig.<judgeId>.weightFormula`, los `generic_*` caen a los
 *      pesos de la rubrica: el panel deja de decorrelacionar y queda un juez
 *      triplicado.
 *   4. Un techo duro que es solo prosa. Una penalizacion sin `effect` no la
 *      aplica el motor: se le muestra al juez y se confia en su aritmetica.
 *
 * Usa las funciones COMPILADAS de functions/lib, o sea exactamente las que estan
 * desplegadas. Si functions/lib esta desactualizado, corre `cd functions &&
 * npm run build` antes.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const [courseId, sessionId] = process.argv.slice(2);
if (!courseId || !sessionId) {
  console.error('Uso: node scripts/verify-session-prompt.cjs <courseId> <sessionId>');
  process.exit(1);
}

const DIR = path.join(ROOT, 'content', 'sessions', courseId, sessionId);
if (!fs.existsSync(DIR)) {
  console.error(`No existe ${path.relative(ROOT, DIR)}`);
  process.exit(1);
}

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
const config = readJson('config.json');
const scenarios = readJson('scenarios.json');
const rubric = readJson('rubric.json');
const kb = fs.readFileSync(path.join(DIR, 'knowledge_base.md'), 'utf8');

const { buildSignalInstructions } = require(path.join(ROOT, 'functions/lib/lib/signalSchema.js'));
const { resolveDimensionWeights } = require(path.join(ROOT, 'functions/lib/lib/scoring.js'));

/** Copia literal de selectKBSections (functions/src/index.ts). */
function selectKBSections(knowledgeBase, conceptTags) {
  if (!knowledgeBase || !conceptTags?.length) return knowledgeBase || '';
  const parts = knowledgeBase.split(/<!--\s*section:\s*(.*?)\s*-->/);
  if (parts.length < 3) return knowledgeBase;
  let result = parts[0].trim();
  for (let i = 1; i < parts.length; i += 2) {
    const sectionTags = parts[i].split(',').map((t) => t.trim());
    const sectionContent = parts[i + 1] || '';
    if (sectionTags.includes('_always') || sectionTags.some((t) => conceptTags.includes(t))) {
      result += '\n' + sectionContent.trim();
    }
  }
  return result.trim();
}

/** Los campos que las ramas hardcodeadas de ml2-2025 piden. Ninguno debe filtrarse. */
const CAMPOS_ML2 = ['PREFERENCIAS_FAMILIAS', 'SKILL_TECH', 'SKILL_SECTOR_PUBLICO', 'family_chosen',
  'boundary_quality', 'ROL_PREFERIDO', 'OUTPUT_PREFERIDO'];

let fail = 0;
let warn = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok   ' : 'FALLA'}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) fail++;
};
const aviso = (label, detail) => {
  console.log(`  aviso  ${label}${detail ? ' — ' + detail : ''}`);
  warn++;
};
const info = (label) => console.log(`         ${label}`);

console.log(`\n### ${courseId}/${sessionId} — ${scenarios.length} escenarios\n`);

console.log('=== 1. Rondas no rankeadas: extraccion de senales ===\n');
const noRankeadas = scenarios.filter((s) => s.ranked === false && s.type !== 'multiple_choice');
if (noRankeadas.length === 0) {
  console.log('  (sin rondas abiertas no rankeadas: nada que extraer)');
}
for (const sc of noRankeadas) {
  const instr = buildSignalInstructions(sc.signalSchema);
  if (!instr) {
    // Sin signalSchema el motor cae a las ramas hardcodeadas. Eso es CORRECTO
    // para las sesiones de ml2-2025, para las que se escribieron; es un bug para
    // cualquier otra, porque le pide al juez los campos de otro curso. No se
    // puede decidir por el contenido, asi que se avisa y se nombra la rama.
    const rama = sc.id.includes('feria') ? 'FERIA (family_chosen, decision_clarity, ...)'
      : sc.id.includes('estilo') ? 'ESTILO (primary_strength, work_style, ...)'
      : 'generica de ml2-2025 (PREFERENCIAS_FAMILIAS, SKILL_TECH, ROL_PREFERIDO, ...)';
    aviso(`${sc.id} sin signalSchema: cae a la rama ${rama}`,
      courseId === 'ml2-2025' ? 'esperado en ml2-2025' : 'REVISAR: no es una sesion de ml2-2025');
    continue;
  }
  check(true, `${sc.id} declara signalSchema`, `${sc.signalSchema.fields.length} campos`);
  for (const f of sc.signalSchema.fields) {
    check(instr.includes(`"${f.key}"`), `  pide la clave "${f.key}"`);
  }
  const filtrados = CAMPOS_ML2.filter((v) => instr.includes(v));
  check(filtrados.length === 0, '  no arrastra campos de ml2-2025',
    filtrados.length ? 'FILTRADOS: ' + filtrados.join(', ') : undefined);
}

console.log('\n=== 2. Knowledge base que llega por ronda ===\n');
const marcadores = new Set(
  (kb.match(/<!--\s*section:\s*(.*?)\s*-->/g) || [])
    .flatMap((m) => m.replace(/<!--\s*section:\s*|\s*-->/g, '').split(',').map((t) => t.trim())),
);
if (marcadores.size === 0) {
  // Sin marcadores, selectKBSections devuelve el KB completo: no hay filtrado
  // que pueda fallar, y por lo tanto no hay tags huerfanos posibles.
  info(`el knowledge base no usa marcadores <!-- section: --> : se manda entero (${kb.length} chars)`);
} else {
  for (const sc of scenarios) {
    const tags = sc.conceptTags || [];
    const huerfanos = tags.filter((t) => !marcadores.has(t));
    const got = selectKBSections(kb, tags);
    const secciones = (got.match(/^## /gm) || []).length;
    check(huerfanos.length === 0 && secciones >= 1, sc.id,
      huerfanos.length
        ? 'TAGS SIN SECCION: ' + huerfanos.join(', ')
        : `${secciones} secciones, ${got.length} chars`);
  }
}

console.log('\n=== 3. Diferenciacion de los jueces ===\n');
// Una sesion 100% opcion multiple se puntua en el cliente y nunca llama a los
// jueces: sus pesos son inertes y no tiene sentido exigir que difieran.
const abiertas = scenarios.filter((s) => s.type !== 'multiple_choice');
if (abiertas.length === 0) {
  info('sesion 100% opcion multiple: los jueces nunca corren, los pesos son inertes');
}
const dims = (rubric.dimensions || []).map((d) => ({ id: d.id, weight: d.weight }));
const dimIds = dims.map((d) => d.id);

// Copia de defaultFormulas (functions/src/index.ts). SOLO existe para los tres
// judgeIds historicos: los generic_* no tienen default, asi que sin weightFormula
// en el config caen a los pesos de la rubrica y quedan indistinguibles.
const defaultFormulas = {
  technical_expert: `score = 0.50 * ${dimIds[0]} + 0.10 * ${dimIds[1]} + 0.40 * ${dimIds[2]}`,
  public_sector: `score = 0.15 * ${dimIds[0]} + 0.65 * ${dimIds[1]} + 0.20 * ${dimIds[2]}`,
  professor_twin: `score = 0.35 * ${dimIds[0]} + 0.30 * ${dimIds[1]} + 0.35 * ${dimIds[2]}`,
};

const perfiles = new Set();
for (const { judgeId } of config.judges || []) {
  const declarada = config.judgeConfig?.[judgeId]?.weightFormula;
  const formula = declarada || defaultFormulas[judgeId];
  if (declarada) {
    check(true, `${judgeId} declara weightFormula`);
  } else if (defaultFormulas[judgeId]) {
    aviso(`${judgeId} sin weightFormula en el config`, 'usa el default del motor');
  } else {
    check(false, `${judgeId} declara weightFormula`,
      'no hay default para este judgeId: cae a los pesos de la rubrica');
  }
  const w = resolveDimensionWeights(formula, dims);
  const firma = Object.entries(w).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ');
  perfiles.add(firma);
  info(`  ${judgeId}: ${firma}`);
}
const nJueces = (config.judges || []).length;
if (abiertas.length > 0) {
  check(perfiles.size === nJueces, `los ${nJueces} jueces tienen perfiles de peso distintos`,
    `${perfiles.size} perfiles unicos`);
} else if (perfiles.size !== nJueces) {
  aviso(`los ${nJueces} jueces comparten perfil de peso`, 'da igual: no hay rondas abiertas');
}

console.log('\n=== 4. Techos duros ejecutables ===\n');
const penalties = rubric.penalties || [];
if (penalties.length === 0) {
  console.log('  (sin penalizaciones estructuradas)');
}
for (const p of penalties) {
  check(!!p.effect, `"${p.id}"`,
    p.effect
      ? `${p.effect.type} ${p.effect.value} en ${p.effect.dimensions.join(',')}`
      : 'SOLO PROSA: el motor no la aplica');
}

const resumen = fail === 0 ? 'TODO OK' : `${fail} FALLAS`;
console.log(`\n=== ${resumen}${warn ? `, ${warn} avisos` : ''} ===\n`);
process.exit(fail > 0 ? 1 : 0);
