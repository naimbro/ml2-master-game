import { describe, it, expect } from 'vitest';
import {
  snapToAnchor,
  parseWeightFormula,
  resolveDimensionWeights,
  loadPenalties,
  slugifyPenalty,
  computeJudgeScore,
  type PenaltyDef,
} from './scoring';

const DIMS = [
  { id: 'process_structuring', weight: 0.45 },
  { id: 'institutional_realism', weight: 0.35 },
  { id: 'precision_clarity', weight: 0.2 },
];

// The real penalty set from content/sessions/ai_democracy_2026/_shared, structured.
const PENALTIES: PenaltyDef[] = [
  {
    id: 'solucionismo_tecnologico',
    description: 'Propone una herramienta de IA como si por si sola resolviera un problema politico.',
    effect: { type: 'cap', value: 60, dimensions: ['process_structuring', 'institutional_realism'] },
  },
  {
    id: 'falsa_precision',
    description: 'Inventa cifras o capacidades tecnicas no entregadas en el escenario.',
    effect: { type: 'deduct', value: 20, dimensions: ['precision_clarity'] },
  },
  {
    id: 'penalizacion_solo_informativa',
    description: 'Sin efecto declarado: se muestra al juez pero no mueve el score.',
  },
];

describe('snapToAnchor', () => {
  it('snaps to the nearest of the six rubric anchors', () => {
    expect(snapToAnchor(87)).toBe(80);
    expect(snapToAnchor(71)).toBe(80);
    expect(snapToAnchor(69)).toBe(60);
    expect(snapToAnchor(0)).toBe(0);
    expect(snapToAnchor(100)).toBe(100);
  });

  it('leaves exact anchors untouched', () => {
    for (const a of [0, 20, 40, 60, 80, 100]) expect(snapToAnchor(a)).toBe(a);
  });
});

describe('parseWeightFormula', () => {
  it('parses the formula strings that already exist in session configs', () => {
    expect(
      parseWeightFormula(
        'score = 0.55 * process_structuring + 0.20 * institutional_realism + 0.25 * precision_clarity'
      )
    ).toEqual({
      process_structuring: 0.55,
      institutional_realism: 0.2,
      precision_clarity: 0.25,
    });
  });

  it('parses the ml2 formulas with different dimension ids', () => {
    expect(
      parseWeightFormula(
        'score = 0.50 * technical_pipeline + 0.10 * institutional_criteria + 0.40 * clarity_critical_thinking'
      )
    ).toEqual({
      technical_pipeline: 0.5,
      institutional_criteria: 0.1,
      clarity_critical_thinking: 0.4,
    });
  });

  it('returns null for prose it cannot execute', () => {
    expect(parseWeightFormula('score = weighted average of dimensions')).toBeNull();
    expect(parseWeightFormula(undefined)).toBeNull();
  });
});

describe('resolveDimensionWeights', () => {
  it('uses the session formula and normalizes to 1', () => {
    const w = resolveDimensionWeights(
      'score = 0.55 * process_structuring + 0.20 * institutional_realism + 0.25 * precision_clarity',
      DIMS
    );
    expect(w.process_structuring).toBeCloseTo(0.55);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('falls back to rubric weights when there is no formula', () => {
    const w = resolveDimensionWeights(undefined, DIMS);
    expect(w.process_structuring).toBeCloseTo(0.45);
    expect(w.precision_clarity).toBeCloseTo(0.2);
  });

  it('falls back to uniform when the formula names only stale dimension ids', () => {
    // Dimension ids have drifted before — see base_rubric.json _id_mapping_note.
    const w = resolveDimensionWeights('score = 0.5 * old_dead_id + 0.5 * another_dead_id', DIMS);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(w.process_structuring).toBeCloseTo(1 / 3);
  });

  it('ignores a stale id but keeps the live ones proportional', () => {
    const w = resolveDimensionWeights(
      'score = 0.60 * process_structuring + 0.40 * a_dead_id',
      DIMS
    );
    expect(w.process_structuring).toBeCloseTo(1);
    expect(w.institutional_realism).toBeUndefined();
  });
});

describe('loadPenalties', () => {
  it('prefers the structured form', () => {
    const defs = loadPenalties({ penalties: PENALTIES, globalPenalties: ['Otra cosa: bla'] });
    expect(defs).toHaveLength(3);
    expect(defs[0].effect?.type).toBe('cap');
  });

  it('derives stable ids from legacy prose penalties', () => {
    const defs = loadPenalties({
      globalPenalties: [
        'Solucionismo tecnologico: si propone una herramienta de IA... no puede superar 60.',
        'Falsa precision: si inventa cifras... baja 20 puntos.',
      ],
    });
    expect(defs.map((d) => d.id)).toEqual(['solucionismo_tecnologico', 'falsa_precision']);
  });

  it('converts the ml2 RAG object form {condition, cap, dimension} into a real effect', () => {
    const defs = loadPenalties({
      hardPenalties: [
        {
          condition: 'Confunde indexacion (offline, una vez) con consulta (online, cada pregunta)',
          cap: 60,
          dimension: 'technical_pipeline',
        },
      ],
    });
    expect(defs).toHaveLength(1);
    expect(defs[0].effect).toEqual({ type: 'cap', value: 60, dimensions: ['technical_pipeline'] });
  });

  it('does not drop object-form penalties on the floor', () => {
    // Regression: an earlier loader filtered for strings only, which silently threw
    // away every ceiling in the ml2 RAG sessions.
    const defs = loadPenalties({
      hardPenalties: [{ condition: 'a', cap: 60, dimension: 'd' }, { condition: 'b', cap: 40, dimension: 'd' }],
    });
    expect(defs).toHaveLength(2);
  });

  it('leaves legacy penalties advisory — no effect means no score change', () => {
    const defs = loadPenalties({ globalPenalties: ['Falsa precision: inventa cifras.'] });
    expect(defs[0].effect).toBeUndefined();

    const result = computeJudgeScore(
      { process_structuring: 100, institutional_realism: 100, precision_clarity: 100 },
      ['falsa_precision'],
      resolveDimensionWeights(undefined, DIMS),
      defs
    );
    expect(result.score).toBe(100);
    expect(result.appliedPenalties).toHaveLength(0);
  });
});

describe('slugifyPenalty', () => {
  it('strips accents and punctuation', () => {
    expect(slugifyPenalty('Falsa precisión: si inventa cifras')).toBe('falsa_precision');
    expect(slugifyPenalty('Legalidad equivale a legitimidad: ...')).toBe(
      'legalidad_equivale_a_legitimidad'
    );
  });
});

describe('computeJudgeScore', () => {
  const weights = resolveDimensionWeights(
    'score = 0.45 * process_structuring + 0.35 * institutional_realism + 0.20 * precision_clarity',
    DIMS
  );

  it('computes the weighted sum the LLM used to compute in its head', () => {
    const r = computeJudgeScore(
      { process_structuring: 80, institutional_realism: 60, precision_clarity: 100 },
      [],
      weights,
      PENALTIES
    );
    // 0.45*80 + 0.35*60 + 0.20*100 = 36 + 21 + 20 = 77
    expect(r.score).toBe(77);
    expect(r.failed).toBe(false);
  });

  it('coerces quoted scores — gpt-4o returns "60" as a string', () => {
    const r = computeJudgeScore(
      { process_structuring: '80', institutional_realism: '60', precision_clarity: '100' },
      [],
      weights,
      PENALTIES
    );
    expect(r.score).toBe(77);
  });

  it('snaps off-anchor scores rather than honouring false precision', () => {
    const r = computeJudgeScore(
      { process_structuring: 83, institutional_realism: 57, precision_clarity: 99 },
      [],
      weights,
      PENALTIES
    );
    expect(r.rawDimensionScores).toEqual({
      process_structuring: 80,
      institutional_realism: 60,
      precision_clarity: 100,
    });
    expect(r.score).toBe(77);
  });

  it('applies a hard cap across every dimension the penalty names', () => {
    const r = computeJudgeScore(
      { process_structuring: 100, institutional_realism: 100, precision_clarity: 100 },
      ['solucionismo_tecnologico'],
      weights,
      PENALTIES
    );
    // capped to 60 / 60 / 100 => 0.45*60 + 0.35*60 + 0.20*100 = 27 + 21 + 20 = 68
    expect(r.score).toBe(68);
    expect(r.dimensionScores.process_structuring).toBe(60);
    expect(r.dimensionScores.precision_clarity).toBe(100);
    expect(r.appliedPenalties).toEqual([
      { id: 'solucionismo_tecnologico', dimension: 'process_structuring', type: 'cap', from: 100, to: 60 },
      { id: 'solucionismo_tecnologico', dimension: 'institutional_realism', type: 'cap', from: 100, to: 60 },
    ]);
  });

  it('does not raise a dimension that is already below the cap', () => {
    const r = computeJudgeScore(
      { process_structuring: 20, institutional_realism: 20, precision_clarity: 20 },
      ['solucionismo_tecnologico'],
      weights,
      PENALTIES
    );
    expect(r.score).toBe(20);
    expect(r.appliedPenalties).toHaveLength(0);
  });

  it('applies deductions and floors at zero', () => {
    const r = computeJudgeScore(
      { process_structuring: 100, institutional_realism: 100, precision_clarity: 0 },
      ['falsa_precision'],
      weights,
      PENALTIES
    );
    expect(r.dimensionScores.precision_clarity).toBe(0);
    expect(r.appliedPenalties).toHaveLength(0); // 0 - 20 floors at 0, no change
  });

  it('caps before deducting, so a capped dimension can still be deducted', () => {
    const both: PenaltyDef[] = [
      { id: 'cap_it', description: '', effect: { type: 'cap', value: 60, dimensions: ['precision_clarity'] } },
      { id: 'deduct_it', description: '', effect: { type: 'deduct', value: 20, dimensions: ['precision_clarity'] } },
    ];
    const r = computeJudgeScore(
      { process_structuring: 100, institutional_realism: 100, precision_clarity: 100 },
      ['deduct_it', 'cap_it'],
      weights,
      both
    );
    // 100 -> cap 60 -> deduct 20 -> 40, regardless of the order reported
    expect(r.dimensionScores.precision_clarity).toBe(40);
  });

  it('flags hallucinated penalty ids instead of silently moving the score', () => {
    const r = computeJudgeScore(
      { process_structuring: 80, institutional_realism: 80, precision_clarity: 80 },
      ['penalidad_que_no_existe'],
      weights,
      PENALTIES
    );
    expect(r.unknownPenalties).toEqual(['penalidad_que_no_existe']);
    expect(r.score).toBe(80);
    expect(r.appliedPenalties).toHaveLength(0);
  });

  it('renormalizes over the dimensions actually returned', () => {
    const r = computeJudgeScore(
      { process_structuring: 80, precision_clarity: 40 },
      [],
      weights,
      PENALTIES
    );
    // institutional_realism missing => weights 0.45 / 0.20 renormalize over 0.65
    // (0.45*80 + 0.20*40) / 0.65 = (36 + 8) / 0.65 = 67.7 -> 68
    expect(r.score).toBe(68);
    expect(r.failed).toBe(false);
  });

  it('fails when the judge returns no usable dimension at all', () => {
    const r = computeJudgeScore({}, [], weights, PENALTIES);
    expect(r.failed).toBe(true);
    expect(r.score).toBe(0);
  });

  it('fails on a judge that returned prose instead of numbers', () => {
    const r = computeJudgeScore(
      { process_structuring: 'excelente', institutional_realism: null },
      [],
      weights,
      PENALTIES
    );
    expect(r.failed).toBe(true);
  });

  it('tolerates a non-array penaltiesApplied', () => {
    const r = computeJudgeScore(
      { process_structuring: 80, institutional_realism: 80, precision_clarity: 80 },
      'solucionismo_tecnologico',
      weights,
      PENALTIES
    );
    expect(r.score).toBe(80);
    expect(r.appliedPenalties).toHaveLength(0);
  });
});
