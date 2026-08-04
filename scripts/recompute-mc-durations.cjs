#!/usr/bin/env node
/**
 * Reescribe `durationSeconds` de cada escenario de opcion multiple a partir de
 * lo que el bloque realmente consume.
 *
 * Existe porque `durationSeconds` es un valor DERIVADO que igual vive escrito en
 * el JSON: el motor lo usa para auto-cerrar la ronda, y si queda corto el host
 * guillotina el bloque a media pregunta. Cada vez que cambian las constantes de
 * `src/lib/mcTiming.ts` —paso lo que paso el 2026-08-04 con la ventana de
 * revelacion— todos los `durationSeconds` guardados quedan chicos de golpe y el
 * validador falla el build. Esto los pone al dia sin editarlos a mano.
 *
 *   node scripts/recompute-mc-durations.cjs            # muestra lo que cambiaria
 *   node scripts/recompute-mc-durations.cjs --write    # lo escribe
 *
 * Espejo de src/lib/mcTiming.ts. Si cambias los numeros alla, cambialos aca.
 */
const fs = require('fs');
const path = require('path');

const MC_GATE_SECONDS = 5;
const MC_GATE_WITH_MEDIA_SECONDS = 12;
const MC_SLACK_SECONDS = 15;
const MC_DEFAULT_TIME_LIMIT = 20;
const MC_READ_CHARS_PER_SECOND = 18;
const MC_FEEDBACK_MIN_SECONDS = 6;
const MC_FEEDBACK_MAX_SECONDS = 16;
const MC_FEEDBACK_BEAT_SECONDS = 3;

function mcFeedbackSeconds(explanation) {
  const len = typeof explanation === 'string' ? explanation.trim().length : 0;
  if (len === 0) return MC_FEEDBACK_MIN_SECONDS;
  const needed = MC_FEEDBACK_BEAT_SECONDS + Math.ceil(len / MC_READ_CHARS_PER_SECOND);
  return Math.min(MC_FEEDBACK_MAX_SECONDS, Math.max(MC_FEEDBACK_MIN_SECONDS, needed));
}

function derivedMCRoundDuration(mcQuestions, media) {
  const questions = mcQuestions || [];
  const gate = Array.isArray(media) && media.length > 0
    ? MC_GATE_WITH_MEDIA_SECONDS
    : MC_GATE_SECONDS;
  if (questions.length === 0) return gate + MC_SLACK_SECONDS;

  const limits = questions.reduce((sum, q) => {
    const l = Number(q && q.timeLimitSeconds);
    return sum + (Number.isFinite(l) && l > 0 ? l : MC_DEFAULT_TIME_LIMIT);
  }, 0);
  const feedback = questions.reduce((sum, q) => sum + mcFeedbackSeconds(q && q.explanation), 0);

  return gate + limits + feedback + MC_SLACK_SECONDS;
}

const write = process.argv.includes('--write');
const base = path.join(__dirname, '..', 'content', 'sessions');
const dirs = (p) => fs.readdirSync(p).filter((d) => fs.statSync(path.join(p, d)).isDirectory());

let cambios = 0;
let archivos = 0;

for (const curso of dirs(base)) {
  for (const sesion of dirs(path.join(base, curso))) {
    const file = path.join(base, curso, sesion, 'scenarios.json');
    if (!fs.existsSync(file)) continue;

    const scenarios = JSON.parse(fs.readFileSync(file, 'utf8'));
    let tocado = false;

    for (const sc of scenarios) {
      if (sc.type !== 'multiple_choice' || !Array.isArray(sc.mcQuestions)) continue;
      const nuevo = derivedMCRoundDuration(sc.mcQuestions, sc.media);
      if (sc.durationSeconds === nuevo) continue;
      console.log(`  ${curso}/${sesion} ${sc.id}: ${sc.durationSeconds} -> ${nuevo}`);
      sc.durationSeconds = nuevo;
      tocado = true;
      cambios++;
    }

    if (tocado) {
      archivos++;
      if (write) fs.writeFileSync(file, JSON.stringify(scenarios, null, 2) + '\n');
    }
  }
}

console.log(
  cambios === 0
    ? '\nNada que cambiar: todos los durationSeconds estan al dia.'
    : `\n${cambios} escenario(s) en ${archivos} archivo(s)${write ? ' ESCRITOS' : ' — corre con --write para aplicar'}.`
);
