#!/usr/bin/env node
/**
 * Crea la carpeta de una clase de dataviz_2026 con su rubric.json ya derivado
 * de _shared/base_rubric.json.
 *
 *   node scripts/scaffold-dataviz-session.cjs clase_02_describir
 *
 * NO sobreescribe nada que ya exista, así que se puede correr de nuevo sin
 * miedo. rubric.json es un ARTEFACTO GENERADO: si hay que cambiar las anclas de
 * todo el curso, se edita _shared/base_rubric.json, se borran los rubric.json y
 * se vuelve a correr esto por cada clase. Si hay que cambiar las anclas de UNA
 * clase, se edita su copia y este script la deja tranquila.
 *
 * config.json, scenarios.json y knowledge_base.md quedan como placeholders
 * mínimos con `draft: true`: el registro de sesiones de src/lib/courses.ts no
 * publica una sesión draft, así que una carpeta a medio escribir no aparece en
 * la UI del profesor.
 */

const fs = require('fs');
const path = require('path');

const COURSE_ID = 'dataviz_2026';
const ROOT = path.join(__dirname, '..');
const COURSE_ROOT = path.join(ROOT, 'content', 'sessions', COURSE_ID);
const BASE_RUBRIC = path.join(COURSE_ROOT, '_shared', 'base_rubric.json');

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Uso: node scripts/scaffold-dataviz-session.cjs <sessionId>');
  process.exit(1);
}
if (sessionId.startsWith('_')) {
  console.error('Un sessionId no puede empezar con "_": el validador salta esas carpetas.');
  process.exit(1);
}

const dir = path.join(COURSE_ROOT, sessionId);
fs.mkdirSync(dir, { recursive: true });

function writeIfMissing(name, contents) {
  const target = path.join(dir, name);
  if (fs.existsSync(target)) {
    console.log(`  = ${name} (ya existe, no se toca)`);
    return;
  }
  fs.writeFileSync(target, contents);
  console.log(`  + ${name}`);
}

const base = JSON.parse(fs.readFileSync(BASE_RUBRIC, 'utf8'));
base.sessionId = sessionId;
base._doc = `Copia de _shared/base_rubric.json para ${sessionId}. Generada por `
  + 'scripts/scaffold-dataviz-session.cjs. Si ajustas pesos o anclas SOLO para esta '
  + 'clase, hazlo aquí y no en _shared/.';
writeIfMissing('rubric.json', JSON.stringify(base, null, 2) + '\n');

writeIfMissing('config.json', JSON.stringify({
  sessionId,
  courseId: COURSE_ID,
  draft: true,
  title: `TODO: título de ${sessionId}`,
  description: 'TODO: descripción de una línea, la ve el profesor al elegir la sesión',
  date: 'TODO: YYYY-MM-DD',
  roundCount: 0,
  roundDurationSeconds: 240,
  bufferSeconds: 45,
  conceptTags: [],
  judges: [
    { judgeId: 'generic_specialist', weight: 0.35 },
    { judgeId: 'generic_praxis', weight: 0.35 },
    { judgeId: 'generic_teacher', weight: 0.3 },
  ],
}, null, 2) + '\n');

writeIfMissing('scenarios.json', '[]\n');
writeIfMissing('knowledge_base.md', `# ${sessionId}\n\n<!-- section: _always -->\n\nTODO\n`);

console.log(`\nListo: content/sessions/${COURSE_ID}/${sessionId}/`);
