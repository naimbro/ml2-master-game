import { describe, it, expect } from 'vitest';
import {
  validateDraftInput,
  validateGeneratedDraft,
  buildGenerationPrompt,
  type SessionDraftInput,
} from './sessionDraft';

const validInput: SessionDraftInput = {
  courseId: 'c1',
  title: 'Sesión 1: Sesgos cognitivos',
  topicDescription: 'Sesgos cognitivos en decisiones de política pública, con foco en anclaje y disponibilidad.',
  audience: 'Estudiantes de magíster en políticas públicas',
  roundCount: 3,
  roundMinutes: 5,
  language: 'español',
};

function validDraft() {
  const dim = (id: string, weight: number) => ({
    id, name: id, weight, description: 'desc',
    level_100: 'a', level_80: 'b', level_60: 'c', level_40: 'd', level_20: 'e', level_0: 'f',
  });
  return {
    config: {
      title: validInput.title,
      description: 'desc',
      judges: [
        { judgeId: 'technical_expert', weight: 0.35 },
        { judgeId: 'public_sector', weight: 0.35 },
        { judgeId: 'professor_twin', weight: 0.3 },
      ],
      judgeConfig: {
        technical_expert: { sessionLens: 'lente de prueba para el juez en esta sesión', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
        public_sector: { sessionLens: 'lente de prueba para el juez en esta sesión', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
        professor_twin: { sessionLens: 'lente de prueba para el juez en esta sesión', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
      },
    },
    scenarios: [
      { id: 'r1', title: 'Ronda 1', prompt: 'p1', judgeFocus: 'f1' },
      { id: 'r2', title: 'Ronda 2', prompt: 'p2', judgeFocus: 'f2' },
      { id: 'r3', title: 'Ronda 3', prompt: 'p3', judgeFocus: 'f3' },
    ],
    rubric: {
      globalInstructions: 'gi',
      dimensions: [dim('a', 0.4), dim('b', 0.3), dim('c', 0.3)],
    },
    knowledgeBase: 'x'.repeat(600),
  };
}

describe('validateDraftInput', () => {
  it('accepts valid input', () => {
    expect(validateDraftInput(validInput)).toBeNull();
  });
  it('rejects short topic description', () => {
    expect(validateDraftInput({ ...validInput, topicDescription: 'corto' })).toMatch(/tema/i);
  });
  it('rejects out-of-range round count', () => {
    expect(validateDraftInput({ ...validInput, roundCount: 1 })).toMatch(/rondas/i);
    expect(validateDraftInput({ ...validInput, roundCount: 7 })).toMatch(/rondas/i);
  });
  it('rejects non-object', () => {
    expect(validateDraftInput(null)).not.toBeNull();
    expect(validateDraftInput('x')).not.toBeNull();
  });
});

describe('validateGeneratedDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateGeneratedDraft(validDraft(), validInput)).toBeNull();
  });
  it('rejects scenario count mismatch', () => {
    const d = validDraft();
    d.scenarios.pop();
    expect(validateGeneratedDraft(d, validInput)).toMatch(/escenarios/i);
  });
  it('rejects dimension weights not summing to 1', () => {
    const d = validDraft();
    d.rubric.dimensions[0].weight = 0.9;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/pesos/i);
  });
  it('rejects missing rubric levels', () => {
    const d = validDraft();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (d.rubric.dimensions[0] as any).level_60;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/nivel/i);
  });
  it('rejects unknown judges', () => {
    const d = validDraft();
    d.config.judges[0].judgeId = 'invented_judge';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/jueces/i);
  });
  it('rejects short knowledge base', () => {
    const d = validDraft();
    d.knowledgeBase = 'corta';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/knowledge/i);
  });
  it('rejects missing judgeConfig', () => {
    const d = validDraft();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (d.config as any).judgeConfig;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/judgeConfig/i);
  });
  it('rejects judgeConfig with short sessionLens', () => {
    const d = validDraft();
    d.config.judgeConfig.public_sector.sessionLens = 'x';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/sessionLens/i);
  });
  it('rejects judgeConfig without weightFormula', () => {
    const d = validDraft();
    d.config.judgeConfig.professor_twin.weightFormula = '';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/weightFormula/i);
  });
});

describe('buildGenerationPrompt', () => {
  it('embeds the input parameters', () => {
    const prompt = buildGenerationPrompt(validInput);
    expect(prompt).toContain(validInput.title);
    expect(prompt).toContain(validInput.topicDescription);
    expect(prompt).toContain('3');
    expect(prompt).toContain('technical_expert');
  });
});
