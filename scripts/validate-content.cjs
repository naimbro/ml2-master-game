#!/usr/bin/env node
/**
 * Validador liviano de content packs.
 *
 * Recorre todas las sesiones bajo content/sessions/{course}/{session}/
 * y verifica:
 *  - JSON valido en config.json, scenarios.json, rubric.json
 *  - knowledge_base.md existe
 *  - sessionId del config y rubric coinciden con la carpeta
 *  - cada escenario tiene id unico (dentro de la sesion), order, title,
 *    context, question, conceptTags
 *  - rubric.dimensions tienen id, name, weight, description, level_100
 *  - pesos de dimensiones suman ~1.0
 *  - judges del config existen en content/judges/default_judges.json
 *  - si el escenario declara requiredTags, son strings no vacios
 *  - el courseId del config (si existe) corresponde a la carpeta del curso
 *
 * Uso:
 *   node scripts/validate-content.cjs               # valida todos los packs
 *   node scripts/validate-content.cjs ai_democracy_2026  # solo un pack
 *
 * Sale con codigo 0 si todo pasa, 1 si hay errores. Las advertencias
 * (warnings) no rompen, pero se imprimen.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SESSIONS_ROOT = path.join(ROOT, 'content', 'sessions');
const JUDGES_PATH = path.join(ROOT, 'content', 'judges', 'default_judges.json');

let errorCount = 0;
let warnCount = 0;

function err(scope, msg) {
  console.error(`  ERROR  [${scope}] ${msg}`);
  errorCount++;
}

function warn(scope, msg) {
  console.warn(`  WARN   [${scope}] ${msg}`);
  warnCount++;
}

function ok(scope, msg) {
  console.log(`  ok     [${scope}] ${msg}`);
}

function readJsonStrict(filePath, scope) {
  if (!fs.existsSync(filePath)) {
    err(scope, `archivo no existe: ${path.relative(ROOT, filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    err(scope, `JSON invalido en ${path.relative(ROOT, filePath)}: ${e.message}`);
    return null;
  }
}

function loadKnownJudgeIds() {
  if (!fs.existsSync(JUDGES_PATH)) {
    warn('global', `no se encontro ${JUDGES_PATH} — no validare ids de jueces`);
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(JUDGES_PATH, 'utf8'));
    return new Set((data.judges || []).map(j => j.judgeId));
  } catch (e) {
    warn('global', `no pude parsear default_judges.json: ${e.message}`);
    return null;
  }
}

function validateSession(courseId, sessionId, sessionDir, knownJudgeIds) {
  const scope = `${courseId}/${sessionId}`;

  const config = readJsonStrict(path.join(sessionDir, 'config.json'), scope);
  const scenarios = readJsonStrict(path.join(sessionDir, 'scenarios.json'), scope);
  const rubric = readJsonStrict(path.join(sessionDir, 'rubric.json'), scope);
  const kbPath = path.join(sessionDir, 'knowledge_base.md');

  if (!fs.existsSync(kbPath)) {
    err(scope, 'falta knowledge_base.md');
  }

  if (!config || !scenarios || !rubric) return; // errores ya reportados

  // config
  if (config.sessionId !== sessionId) {
    err(scope, `config.sessionId='${config.sessionId}' no coincide con carpeta '${sessionId}'`);
  }
  for (const f of ['title', 'roundCount', 'roundDurationSeconds', 'judges', 'conceptTags']) {
    if (config[f] === undefined) err(scope, `config.json: falta campo '${f}'`);
  }
  if (Array.isArray(config.judges)) {
    if (knownJudgeIds) {
      for (const jw of config.judges) {
        if (!knownJudgeIds.has(jw.judgeId)) {
          warn(scope, `judge '${jw.judgeId}' no esta en default_judges.json (se cargara peso pero el motor caera al fallback de formula)`);
        }
      }
    }
    const sum = config.judges.reduce((s, j) => s + (Number(j.weight) || 0), 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      err(scope, `pesos de jueces en config.json suman ${sum.toFixed(3)}, deben sumar 1.0`);
    }
  }

  // scenarios
  if (!Array.isArray(scenarios)) {
    err(scope, 'scenarios.json no es un array');
  } else {
    if (scenarios.length === 0) {
      warn(scope, 'scenarios.json esta vacio');
    }
    if (config.roundCount !== undefined && scenarios.length !== config.roundCount) {
      warn(scope, `config.roundCount=${config.roundCount} pero hay ${scenarios.length} escenarios`);
    }
    const ids = new Set();
    for (const [i, sc] of scenarios.entries()) {
      const sScope = `${scope}#${i}`;
      const isMC = sc.type === 'multiple_choice';
      const required = isMC
        ? ['id', 'order', 'title', 'mcQuestions']
        : ['id', 'order', 'title', 'context', 'question', 'conceptTags'];
      for (const f of required) {
        if (sc[f] === undefined || sc[f] === null || sc[f] === '') {
          err(sScope, `escenario sin campo '${f}'`);
        }
      }
      if (sc.id) {
        if (ids.has(sc.id)) err(sScope, `id duplicado: '${sc.id}'`);
        ids.add(sc.id);
      }
      if (sc.requiredTags !== undefined) {
        if (!Array.isArray(sc.requiredTags)) {
          err(sScope, `requiredTags debe ser array, encontrado ${typeof sc.requiredTags}`);
        } else {
          for (const t of sc.requiredTags) {
            if (typeof t !== 'string' || !t.trim()) {
              err(sScope, `requiredTags contiene valor no-string o vacio`);
            }
          }
        }
      }
      if (sc.idealAnswer === undefined && sc.referenceAnswer === undefined) {
        warn(sScope, `escenario '${sc.id || i}' no tiene idealAnswer ni referenceAnswer (el juez tendra menos calibracion)`);
      }
    }
  }

  // rubric
  if (rubric.sessionId !== sessionId) {
    err(scope, `rubric.sessionId='${rubric.sessionId}' no coincide con carpeta '${sessionId}'`);
  }
  if (!Array.isArray(rubric.dimensions)) {
    err(scope, 'rubric.dimensions no es un array');
  } else {
    let sum = 0;
    for (const [i, dim] of rubric.dimensions.entries()) {
      const dScope = `${scope}/dim#${i}`;
      for (const f of ['id', 'name', 'weight', 'description']) {
        if (dim[f] === undefined) err(dScope, `dimension sin campo '${f}'`);
      }
      if (typeof dim.weight === 'number') sum += dim.weight;
      // El motor consume tanto el formato flat (level_100/level_60/level_20) como el legacy (levels: [{score,label,indicators}]).
      // Si no hay ninguno, error. Si esta en formato legacy, advertencia.
      const hasFlat = 'level_100' in dim;
      const hasLegacy = Array.isArray(dim.levels) && dim.levels.length > 0;
      if (!hasFlat && !hasLegacy) {
        err(dScope, `dimension sin anchors: falta level_100/level_60/level_20 (formato actual) o levels[] (formato legacy)`);
      } else if (hasLegacy && !hasFlat) {
        warn(dScope, `dimension usa formato legacy 'levels[]'; el motor lo soporta pero el formato actual es level_100/level_60/level_20 plano`);
      } else {
        if (!('level_60' in dim)) warn(dScope, `dimension sin 'level_60' (anchor intermedio recomendado)`);
        if (!('level_20' in dim)) warn(dScope, `dimension sin 'level_20' (anchor inferior recomendado)`);
      }
    }
    if (Math.abs(sum - 1.0) > 0.001) {
      err(scope, `pesos de dimensiones suman ${sum.toFixed(3)}, deben sumar 1.0`);
    }
  }
  if (!Array.isArray(rubric.globalPenalties) && !Array.isArray(rubric.hardPenalties)) {
    warn(scope, 'rubric sin globalPenalties ni hardPenalties (el juez no tendra techos duros)');
  }

  ok(scope, `validacion completa (${(scenarios || []).length} escenarios)`);
}

function validateCoursePack(courseId, knownJudgeIds) {
  const courseDir = path.join(SESSIONS_ROOT, courseId);
  if (!fs.existsSync(courseDir) || !fs.statSync(courseDir).isDirectory()) {
    err('global', `course pack no existe: ${courseId}`);
    return;
  }
  console.log(`\n=== Validando pack: ${courseId} ===`);
  const entries = fs.readdirSync(courseDir, { withFileTypes: true });
  const sessions = entries.filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'));
  if (sessions.length === 0) {
    warn(courseId, 'no hay sesiones en este pack');
  }
  for (const session of sessions) {
    validateSession(courseId, session.name, path.join(courseDir, session.name), knownJudgeIds);
  }
}

function main() {
  const arg = process.argv[2];
  const knownJudgeIds = loadKnownJudgeIds();

  if (!fs.existsSync(SESSIONS_ROOT)) {
    console.error(`No existe ${SESSIONS_ROOT}`);
    process.exit(1);
  }

  if (arg) {
    validateCoursePack(arg, knownJudgeIds);
  } else {
    const courses = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .map(e => e.name);
    for (const c of courses) {
      validateCoursePack(c, knownJudgeIds);
    }
  }

  console.log(`\n=== Resultado: ${errorCount} errores, ${warnCount} advertencias ===`);
  process.exit(errorCount > 0 ? 1 : 0);
}

main();
