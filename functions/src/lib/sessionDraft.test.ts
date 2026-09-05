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

function guiaValida() {
  return {
    idealAnswer: 'Una respuesta de ochenta puntos toma posición, la justifica con un dato del material y nombra la restricción que la vuelve difícil.',
    evaluationGuide: {
      must_hit: ['Toma una posición explícita', 'La justifica con algo del material'],
      fatal_errors: ['Enumera consideraciones sin elegir', 'Inventa una cifra'],
    },
  };
}

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
        { judgeId: 'generic_specialist', weight: 0.35 },
        { judgeId: 'generic_praxis', weight: 0.35 },
        { judgeId: 'generic_teacher', weight: 0.3 },
      ],
      judgeConfig: {
        generic_specialist: { sessionLens: 'lente de prueba para el juez en esta sesión', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
        generic_praxis: { sessionLens: 'lente de prueba para el juez en esta sesión', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
        generic_teacher: { sessionLens: 'lente de prueba para el juez en esta sesión', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
      },
    },
    scenarios: [
      { id: 'r1', title: 'Ronda 1', prompt: 'p1', judgeFocus: 'f1', ...guiaValida() },
      { id: 'r2', title: 'Ronda 2', prompt: 'p2', judgeFocus: 'f2', ...guiaValida() },
      { id: 'r3', title: 'Ronda 3', prompt: 'p3', judgeFocus: 'f3', ...guiaValida() },
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
    d.config.judgeConfig.generic_praxis.sessionLens = 'x';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/sessionLens/i);
  });
  it('rejects judgeConfig without weightFormula', () => {
    const d = validDraft();
    d.config.judgeConfig.generic_teacher.weightFormula = '';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/weightFormula/i);
  });
  it('rechaza un escenario sin idealAnswer', () => {
    const d = validDraft();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (d.scenarios[1] as any).idealAnswer;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/idealAnswer/i);
  });
  it('rechaza un idealAnswer de relleno', () => {
    const d = validDraft();
    d.scenarios[0].idealAnswer = 'N/A';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/idealAnswer/i);
  });
  it('acepta un idealAnswer de exactamente 80 caracteres y rechaza uno de 79', () => {
    const justo = validDraft();
    justo.scenarios[0].idealAnswer = 'x'.repeat(80);
    expect(validateGeneratedDraft(justo, validInput)).toBeNull();

    const corto = validDraft();
    corto.scenarios[0].idealAnswer = 'x'.repeat(79);
    expect(validateGeneratedDraft(corto, validInput)).toMatch(/idealAnswer/i);
  });
  it('rechaza un escenario sin evaluationGuide', () => {
    const d = validDraft();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (d.scenarios[2] as any).evaluationGuide;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/evaluationGuide/i);
  });
  it('rechaza must_hit vacio en evaluationGuide', () => {
    const d = validDraft();
    d.scenarios[0].evaluationGuide.must_hit = [];
    expect(validateGeneratedDraft(d, validInput)).toMatch(/must_hit/i);
  });
  it('rechaza fatal_errors sin texto util en evaluationGuide', () => {
    const d = validDraft();
    d.scenarios[0].evaluationGuide.fatal_errors = ['   '];
    expect(validateGeneratedDraft(d, validInput)).toMatch(/fatal_errors/i);
  });
});

describe('buildGenerationPrompt', () => {
  it('embeds the input parameters', () => {
    const prompt = buildGenerationPrompt(validInput);
    expect(prompt).toContain(validInput.title);
    expect(prompt).toContain(validInput.topicDescription);
    expect(prompt).toContain('3');
    expect(prompt).toContain('generic_specialist');
  });
});
