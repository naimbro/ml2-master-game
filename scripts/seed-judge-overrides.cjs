#!/usr/bin/env node
/**
 * Publica las personas de jueces de un curso a Firestore.
 *
 *   node scripts/seed-judge-overrides.cjs <courseId> [--dry]
 *
 * Lee  content/courses/<courseId>/judge_overrides.json
 * y lo escribe en  judgeOverrides/<courseId>  (merge).
 *
 * Solo se envian los campos de la whitelist (name, avatar, personality,
 * evaluationStyle). provider / model / promptTemplate nunca se tocan: el
 * backend los ignoraria de todos modos, pero enviarlos seria enganoso.
 *
 * El profesor puede seguir editando estas personas desde
 * /professor/courses/<courseId>/judges — este script solo siembra el punto
 * de partida versionado en el repo.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const FIELDS = ['name', 'avatar', 'personality', 'evaluationStyle'];
const PROJECT_ID = 'ml2-master-game';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const courseId = args.find((a) => !a.startsWith('--'));

if (!courseId) {
  console.error('Uso: node scripts/seed-judge-overrides.cjs <courseId> [--dry]');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'content', 'courses', courseId, 'judge_overrides.json');
if (!fs.existsSync(file)) {
  console.error(`No existe ${path.relative(process.cwd(), file)}`);
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`JSON invalido en ${file}: ${err.message}`);
  process.exit(1);
}

// Quedarse solo con entradas de juez válidas y con los campos permitidos.
const payload = {};
let skipped = 0;
for (const [judgeId, value] of Object.entries(raw)) {
  if (judgeId.startsWith('_')) continue; // claves de documentación
  if (!value || typeof value !== 'object') {
    console.warn(`  aviso: '${judgeId}' no es un objeto, se omite`);
    skipped++;
    continue;
  }
  const picked = {};
  for (const f of FIELDS) {
    if (typeof value[f] === 'string' && value[f].trim()) picked[f] = value[f];
  }
  const dropped = Object.keys(value).filter((k) => !FIELDS.includes(k));
  if (dropped.length) {
    console.warn(`  aviso: '${judgeId}' trae campos no permitidos que se ignoran: ${dropped.join(', ')}`);
  }
  if (Object.keys(picked).length === 0) {
    console.warn(`  aviso: '${judgeId}' no tiene ningun campo valido, se omite`);
    skipped++;
    continue;
  }
  payload[judgeId] = picked;
}

const ids = Object.keys(payload);
if (ids.length === 0) {
  console.error('Nada que publicar.');
  process.exit(1);
}

console.log(`Curso: ${courseId}`);
for (const id of ids) {
  const p = payload[id];
  console.log(`  ${p.avatar || '  '} ${id.padEnd(18)} -> ${p.name || '(sin nombre)'}`);
  for (const f of ['personality', 'evaluationStyle']) {
    if (p[f]) console.log(`      ${f}: ${p[f].length} caracteres`);
  }
}
if (skipped) console.log(`  (${skipped} omitidos)`);

if (dry) {
  console.log('\n--dry: no se escribio nada.');
  process.exit(0);
}

admin.initializeApp({ projectId: PROJECT_ID });

admin
  .firestore()
  .collection('judgeOverrides')
  .doc(courseId)
  .set(
    { ...payload, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: 'seed-judge-overrides' },
    { merge: true },
  )
  .then(() => {
    console.log(`\nEscrito judgeOverrides/${courseId} (${ids.length} jueces).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\nError al escribir: ${err.message}`);
    process.exit(1);
  });
