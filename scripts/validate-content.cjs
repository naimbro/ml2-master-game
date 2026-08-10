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
const PUBLIC_ROOT = path.join(ROOT, 'public');

let errorCount = 0;
let warnCount = 0;

function err(scope, msg) {
  console.error(`  ERROR  [${scope}] ${msg}`);
  errorCount++;
}

// Espejo de src/lib/mcTiming.ts: la ventana de revelacion sale del largo de la
// explicacion. Se duplica a proposito — este script corre en node sin el bundle
// de Vite — y por eso los numeros van juntos aca abajo y alla arriba.
const MC_READ_CHARS_PER_SECOND = 18;
const MC_FEEDBACK_MIN_SECONDS = 6;
const MC_FEEDBACK_MAX_SECONDS = 16;
const MC_FEEDBACK_BEAT_SECONDS = 3;
const MC_EXPLANATION_MAX_CHARS =
  (MC_FEEDBACK_MAX_SECONDS - MC_FEEDBACK_BEAT_SECONDS) * MC_READ_CHARS_PER_SECOND;

function mcFeedbackSeconds(explanation) {
  const len = typeof explanation === 'string' ? explanation.trim().length : 0;
  if (len === 0) return MC_FEEDBACK_MIN_SECONDS;
  const needed = MC_FEEDBACK_BEAT_SECONDS + Math.ceil(len / MC_READ_CHARS_PER_SECOND);
  return Math.min(MC_FEEDBACK_MAX_SECONDS, Math.max(MC_FEEDBACK_MIN_SECONDS, needed));
}

/**
 * Cuanto reloj necesita, como minimo, una pregunta cuyos distractores son un
 * PAR MINIMO: dos alternativas hechas de las mismas palabras, cambiadas de
 * orden o de relacion.
 *
 * Sale de la ronda 5 de dataviz clase 2 (juego XNTUHB, 2026-08-10), donde A y B
 * eran literalmente la misma frase invertida:
 *
 *   A  "Cuantas personas respondieron, y cuantas preguntas tenia el formulario"
 *   B  "Cuantas preguntas tenia el formulario, y cuantas personas respondieron"
 *
 * Con 25 segundos el curso uso el 89% del reloj (mediana 22,3 s), 16 de los 28
 * que contestaron apretaron en los ultimos 3 segundos, ocho no alcanzaron, y el
 * acierto se hundio al 43%. Para dejar la mediana bajo el 60% del limite hacian
 * falta ~37 s; 40 deja margen.
 *
 * Un par minimo NO es un defecto — es la pregunta que mejor distingue a quien
 * entendio de quien reconocio. Lo que no puede es correr contra un reloj corto:
 * obliga a releer las dos alternativas enteras y compararlas termino a termino,
 * y ese costo no se ve contando caracteres.
 */
const MC_PAR_MINIMO_MIN_SECONDS = 40;

/** Palabras comparables: sin tildes, sin puntuacion, en minuscula. */
function palabrasNormalizadas(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * ¿Estas dos alternativas son un par minimo?
 *
 * Dos criterios, y el segundo existe porque el primero es fragil: cambiar una
 * sola palabra ("mas" por "menos") rompe la igualdad exacta y deja pasar un par
 * igual de dificil.
 *
 * Se exigen 5 palabras minimo: dos alternativas de tres palabras comparten
 * vocabulario por casualidad todo el tiempo ("Si", "No, al reves").
 */
function esParMinimo(a, b) {
  if (a.trim() === b.trim()) return false; // identicas es otro problema
  const pa = palabrasNormalizadas(a);
  const pb = palabrasNormalizadas(b);
  if (pa.length < 5 || pb.length < 5) return false;

  // Mismas palabras, otro orden.
  if ([...pa].sort().join(' ') === [...pb].sort().join(' ')) return true;

  // Casi las mismas: se comparten al menos el 80% del vocabulario.
  const sa = new Set(pa);
  const sb = new Set(pb);
  const comunes = [...sa].filter((w) => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  return union > 0 && comunes / union >= 0.8;
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

// A relative media src must resolve to a real file under public/, or it will
// 404 in the live game — and nothing else in the pipeline would catch it.
function checkMediaFileExists(scope, src) {
  if (!src || /^(https?:)?\/\//i.test(src) || /^(data|blob):/i.test(src)) return;
  const target = path.join(PUBLIC_ROOT, src.replace(/^\//, ''));
  if (!fs.existsSync(target)) {
    err(scope, `el archivo no existe: public/${src.replace(/^\//, '')}`);
  }
}

// Optional image/audio attached to a scenario or an MC question.
// `src` is either a path relative to the app base URL (public/...) or an https URL.
function validateMedia(scope, media, whereLabel) {
  if (media === undefined) return;
  if (!Array.isArray(media)) {
    err(scope, `media de ${whereLabel} debe ser array, encontrado ${typeof media}`);
    return;
  }
  for (const [i, m] of media.entries()) {
    const mScope = `${scope}/media#${i}`;
    if (!m || typeof m !== 'object') {
      err(mScope, 'entrada de media no es un objeto');
      continue;
    }
    if (m.kind !== 'image' && m.kind !== 'audio') {
      err(mScope, `media.kind debe ser 'image' o 'audio', encontrado '${m.kind}'`);
    }
    if (typeof m.src !== 'string' || !m.src.trim()) {
      err(mScope, 'media sin src');
    } else if (m.src.startsWith('/')) {
      // A leading slash resolves to the domain root and 404s on GitHub Pages,
      // where the app lives under /ml2-master-game/.
      err(mScope, `media.src no debe empezar con '/': usa una ruta relativa ('media/...') o una URL absoluta`);
    }
    if (m.kind === 'image' && (typeof m.alt !== 'string' || !m.alt.trim())) {
      err(mScope, 'imagen sin alt (se muestra si el archivo no carga)');
    }
    if (m.kind === 'audio' && /\.ogg$/i.test(m.src || '')) {
      warn(mScope, 'audio .ogg no reproduce en Safari/iOS — usa .mp3');
    }
    checkMediaFileExists(mScope, m.src);
  }
}

function validateMCQuestions(scope, sc) {
  const questions = sc.mcQuestions;
  if (!Array.isArray(questions) || questions.length === 0) {
    err(scope, 'escenario multiple_choice sin mcQuestions');
    return;
  }

  // gate + slack, mirrors src/lib/mcTiming.ts. The gate is longer when the
  // round carries media, because the audio/image clue plays before any clock.
  const hasMedia = Array.isArray(sc.media) && sc.media.length > 0;
  let expectedDuration = (hasMedia ? 12 : 5) + 15;

  for (const [qi, q] of questions.entries()) {
    const qScope = `${scope}/q#${qi}`;
    if (typeof q.question !== 'string' || !q.question.trim()) {
      err(qScope, 'pregunta sin enunciado');
    }
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
      err(qScope, `una pregunta necesita entre 2 y 4 alternativas, encontradas ${Array.isArray(q.options) ? q.options.length : 0}`);
    } else {
      for (const [oi, o] of q.options.entries()) {
        if (!o || typeof o.text !== 'string' || !o.text.trim()) {
          err(`${qScope}/opt#${oi}`, 'alternativa sin texto');
        }
        if (!o || typeof o.id !== 'string' || !o.id.trim()) {
          err(`${qScope}/opt#${oi}`, 'alternativa sin id (A/B/C/D)');
        }
        if (o && o.imageSrc !== undefined) {
          if (typeof o.imageSrc !== 'string' || !o.imageSrc.trim()) {
            err(`${qScope}/opt#${oi}`, 'imageSrc vacio');
          } else if (o.imageSrc.startsWith('/')) {
            err(`${qScope}/opt#${oi}`, `imageSrc no debe empezar con '/'`);
          } else {
            checkMediaFileExists(`${qScope}/opt#${oi}`, o.imageSrc);
            if (!o.imageAlt || !String(o.imageAlt).trim()) {
              err(`${qScope}/opt#${oi}`, 'alternativa con imagen pero sin imageAlt');
            }
          }
        }
      }
    }

    const n = Array.isArray(q.options) ? q.options.length : 0;
    if (!Number.isInteger(q.correctOptionIndex) || q.correctOptionIndex < 0 || q.correctOptionIndex >= n) {
      err(qScope, `correctOptionIndex=${q.correctOptionIndex} fuera de rango (0..${Math.max(0, n - 1)})`);
    }

    // La ventana de revelacion sale del largo de la explicacion, igual que en
    // src/lib/mcTiming.ts (mcFeedbackSeconds). Si se cambia alla, cambiar aca.
    const reveal = mcFeedbackSeconds(q.explanation);
    if (typeof q.explanation === 'string' && q.explanation.trim().length > MC_EXPLANATION_MAX_CHARS) {
      warn(
        qScope,
        `explicacion de ${q.explanation.trim().length} caracteres: no alcanza a leerse en los ${MC_FEEDBACK_MAX_SECONDS}s de revelacion (tope ${MC_EXPLANATION_MAX_CHARS}). Acortala o se corta a media frase.`,
      );
    }

    const limit = Number(q.timeLimitSeconds);
    if (!Number.isFinite(limit) || limit <= 0) {
      err(qScope, `timeLimitSeconds invalido: ${q.timeLimitSeconds}`);
      expectedDuration += 20 + reveal;
    } else {
      expectedDuration += limit + reveal;

      // Un par minimo con reloj corto es la unica forma conocida de que una
      // pregunta buena se convierta en una loteria. Ver la constante arriba.
      if (Array.isArray(q.options) && limit < MC_PAR_MINIMO_MIN_SECONDS) {
        for (let i = 0; i < q.options.length; i++) {
          for (let j = i + 1; j < q.options.length; j++) {
            const ta = q.options[i] && q.options[i].text;
            const tb = q.options[j] && q.options[j].text;
            if (typeof ta !== 'string' || typeof tb !== 'string') continue;
            if (!esParMinimo(ta, tb)) continue;
            err(
              qScope,
              `las alternativas ${q.options[i].id} y ${q.options[j].id} son un par minimo ` +
              `(las mismas palabras, distinto orden o relacion) y el reloj es de ${limit}s. ` +
              `Distinguirlas obliga a releer las dos enteras: necesita ${MC_PAR_MINIMO_MIN_SECONDS}s o mas. ` +
              `Sube timeLimitSeconds y recalcula durationSeconds, o separa las alternativas.`,
            );
          }
        }
      }
    }

    validateMedia(qScope, q.media, 'pregunta');
  }

  // The round timer must outlast the block, or the host auto-end guillotines it.
  if (sc.durationSeconds === undefined) {
    err(scope, `escenario multiple_choice sin durationSeconds (deberia ser ${expectedDuration})`);
  } else if (Number(sc.durationSeconds) < expectedDuration) {
    err(
      scope,
      `durationSeconds=${sc.durationSeconds} es menor que lo que consume el bloque (${expectedDuration}s): el host cortaria la ronda a medias`,
    );
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
      validateMedia(sScope, sc.media, 'escenario');

      if (isMC) {
        validateMCQuestions(sScope, sc);
      } else if (sc.idealAnswer === undefined && sc.referenceAnswer === undefined) {
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

// `main()` corre solo cuando el script se invoca directo. Sin esta guarda,
// importarlo desde un test dispara la validacion entera y termina el proceso
// antes de la primera aseveracion.
if (require.main === module) {
  main();
}

module.exports = { esParMinimo, palabrasNormalizadas, MC_PAR_MINIMO_MIN_SECONDS };
