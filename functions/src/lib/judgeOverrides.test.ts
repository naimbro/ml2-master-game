import { describe, it, expect } from 'vitest';
import { applyJudgeOverrides, JUDGE_OVERRIDE_FIELDS } from './judgeOverrides';

const baseline = [
  {
    judgeId: 'technical_expert',
    name: 'Dr. Tech',
    avatar: '🔬',
    personality: 'baseline personality',
    evaluationStyle: 'baseline style',
    provider: 'openai',
    model: 'gpt-5',
    promptTemplate: 'BASELINE TEMPLATE',
  },
];

describe('applyJudgeOverrides', () => {
  it('returns judges untouched when overrides is null/undefined', () => {
    expect(applyJudgeOverrides(baseline, null)).toEqual(baseline);
    expect(applyJudgeOverrides(baseline, undefined)).toEqual(baseline);
  });

  it('returns judges untouched when there is no override for the judgeId', () => {
    expect(applyJudgeOverrides(baseline, { someone_else: { name: 'X' } })).toEqual(baseline);
  });

  it('applies a partial override (name only), leaving other fields at baseline', () => {
    const out = applyJudgeOverrides(baseline, { technical_expert: { name: 'Dra. Redes' } });
    expect(out[0].name).toBe('Dra. Redes');
    expect(out[0].avatar).toBe('🔬');
    expect(out[0].personality).toBe('baseline personality');
  });

  it('applies a full persona override', () => {
    const out = applyJudgeOverrides(baseline, {
      technical_expert: { name: 'N', avatar: '🧠', personality: 'P', evaluationStyle: 'E' },
    });
    expect(out[0]).toMatchObject({ name: 'N', avatar: '🧠', personality: 'P', evaluationStyle: 'E' });
  });

  it('IGNORES non-whitelisted fields (provider/model/promptTemplate)', () => {
    const out = applyJudgeOverrides(baseline, {
      technical_expert: { provider: 'gemini', model: 'gemini-2.5-flash', promptTemplate: 'HACK' } as never,
    });
    expect(out[0].provider).toBe('openai');
    expect(out[0].model).toBe('gpt-5');
    expect(out[0].promptTemplate).toBe('BASELINE TEMPLATE');
  });

  it('ignores empty / whitespace-only values (falls through to baseline)', () => {
    const out = applyJudgeOverrides(baseline, { technical_expert: { name: '   ', avatar: '' } });
    expect(out[0].name).toBe('Dr. Tech');
    expect(out[0].avatar).toBe('🔬');
  });

  it('ignores non-string values on whitelisted fields (number/null/array)', () => {
    const out = applyJudgeOverrides(baseline, {
      technical_expert: { name: 42, avatar: null, personality: ['x'] } as never,
    });
    expect(out[0].name).toBe('Dr. Tech');
    expect(out[0].avatar).toBe('🔬');
    expect(out[0].personality).toBe('baseline personality');
  });

  it('does not mutate the input judges', () => {
    const input = [{ ...baseline[0] }];
    const snapshot = JSON.parse(JSON.stringify(input));
    applyJudgeOverrides(input, { technical_expert: { name: 'Changed' } });
    expect(input).toEqual(snapshot);
  });

  it('ignores metadata keys like updatedAt/updatedBy without crashing', () => {
    const overrides = { updatedAt: 123, updatedBy: 'uid', technical_expert: { name: 'N' } } as never;
    const out = applyJudgeOverrides(baseline, overrides);
    expect(out[0].name).toBe('N');
  });

  it('exposes the whitelist and it is exactly the four persona fields', () => {
    expect([...JUDGE_OVERRIDE_FIELDS]).toEqual(['name', 'avatar', 'personality', 'evaluationStyle']);
  });
});
