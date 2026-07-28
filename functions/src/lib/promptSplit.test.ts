import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { splitPrompt, STUDENT_RESPONSE_MARKER } from './promptSplit';

const fill = (t: string) => t
  .replace('{{name}}', 'Dr. Tech')
  .replace('{{knowledgeBase}}', 'KB LARGA')
  .replace('{{rubric}}', 'RUBRICA')
  .replace('{{penaltyList}}', 'PENALIZACIONES')
  .replace('{{dimensionScoresJson}}', 'DIMS');

describe('splitPrompt', () => {
  it('puts the shared half in the prefix and the answer at the head of the suffix', () => {
    const { prefix, suffix } = splitPrompt(
      'Eres {{name}}.\nKB: {{knowledgeBase}}\nRESPUESTA:\n{{studentResponse}}\nDevuelve {{dimensionScoresJson}}',
      fill,
      'la respuesta del alumno'
    );
    expect(prefix).toBe('Eres Dr. Tech.\nKB: KB LARGA\nRESPUESTA:\n');
    expect(suffix).toBe('la respuesta del alumno\nDevuelve DIMS');
  });

  it('is byte-identical to filling the template in one pass — the whole point', () => {
    const template = 'A {{name}} B {{knowledgeBase}} C {{studentResponse}} D {{penaltyList}} E {{dimensionScoresJson}}';
    const answer = 'RESPUESTA DEL ALUMNO';
    const { prefix, suffix } = splitPrompt(template, fill, answer);
    const onePass = fill(template).replace(STUDENT_RESPONSE_MARKER, answer);
    expect(prefix + suffix).toBe(onePass);
  });

  it('degrades to an empty prefix when the template has no marker', () => {
    const { prefix, suffix } = splitPrompt('Sin marcador, {{name}}.', fill, 'ignorada');
    expect(prefix).toBe('');
    expect(suffix).toBe('Sin marcador, Dr. Tech.');
  });

  it('keeps the equivalence on every seeded template in the repo', () => {
    // The per-half fill is only equivalent to a single-pass fill because no template
    // repeats a placeholder (`String.replace` with a string pattern hits the first
    // occurrence only). This test fails the build if a new template ever does.
    const coursesDir = join(__dirname, '../../../content/courses');
    if (!existsSync(coursesDir)) return; // functions/ deployed standalone: nothing to check
    let checked = 0;
    for (const courseId of readdirSync(coursesDir)) {
      const path = join(coursesDir, courseId, 'judges.json');
      if (!existsSync(path)) continue;
      for (const judge of JSON.parse(readFileSync(path, 'utf8')).judges || []) {
        const t: string = judge.promptTemplate || '';
        expect(t.split(STUDENT_RESPONSE_MARKER).length - 1, `${courseId}/${judge.judgeId}`).toBe(1);
        const { prefix, suffix } = splitPrompt(t, fill, 'RESPUESTA');
        expect(prefix + suffix, `${courseId}/${judge.judgeId}`)
          .toBe(fill(t).replace(STUDENT_RESPONSE_MARKER, 'RESPUESTA'));
        expect(prefix.length, `${courseId}/${judge.judgeId} prefijo vacio`).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
