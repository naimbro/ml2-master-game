import { describe, it, expect } from 'vitest';
import { pickOverrideFields, JUDGE_OVERRIDE_FIELDS } from './judges';

describe('pickOverrideFields', () => {
  it('keeps only the four whitelisted persona fields', () => {
    expect([...JUDGE_OVERRIDE_FIELDS]).toEqual(['name', 'avatar', 'personality', 'evaluationStyle']);
  });

  it('drops non-whitelisted fields like provider/model/promptTemplate', () => {
    const out = pickOverrideFields({
      name: 'N', provider: 'gemini', model: 'x', promptTemplate: 'HACK', judgeId: 'j',
    });
    expect(out).toEqual({ name: 'N' });
  });

  it('trims values and drops empty / whitespace-only ones', () => {
    const out = pickOverrideFields({ name: '  Dra. Redes  ', avatar: '   ', personality: '' });
    expect(out).toEqual({ name: 'Dra. Redes' });
  });

  it('ignores non-string values', () => {
    const out = pickOverrideFields({ name: 42 as unknown as string, avatar: '🧠' });
    expect(out).toEqual({ avatar: '🧠' });
  });

  it('returns an empty object when nothing is overridable', () => {
    expect(pickOverrideFields({ foo: 'bar' })).toEqual({});
  });
});
