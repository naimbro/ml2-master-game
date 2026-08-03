import { describe, it, expect, vi } from 'vitest';
import {
  resolveProvider,
  resolveModel,
  parseJudgeJson,
  callJudgeModel,
  isOpenAIReasoningModel,
  DEFAULT_MODELS,
  GEMINI_THINKING_BUDGET,
} from './judgeModels';

describe('resolveProvider', () => {
  it('honours an explicit valid provider', () => {
    expect(resolveProvider({ judgeId: 'anything', provider: 'gemini' })).toBe('gemini');
  });

  it('ignores an invalid provider string and falls back by judgeId', () => {
    expect(resolveProvider({ judgeId: 'democracy_scholar', provider: 'llama' })).toBe('openai');
  });

  it('maps the approved persona -> provider assignment', () => {
    expect(resolveProvider({ judgeId: 'professor_twin_ayd' })).toBe('anthropic');
    expect(resolveProvider({ judgeId: 'democracy_scholar' })).toBe('openai');
    expect(resolveProvider({ judgeId: 'policy_lawyer' })).toBe('gemini');
    expect(resolveProvider({ judgeId: 'professor_twin' })).toBe('anthropic');
    expect(resolveProvider({ judgeId: 'technical_expert' })).toBe('openai');
    expect(resolveProvider({ judgeId: 'public_sector' })).toBe('gemini');
  });

  it('defaults an unknown judge to openai (historical behavior)', () => {
    expect(resolveProvider({ judgeId: 'brand_new_judge' })).toBe('openai');
  });
});

describe('resolveModel', () => {
  it('uses an explicit per-judge model override', () => {
    expect(resolveModel({ judgeId: 'professor_twin_ayd', model: 'claude-haiku-4-5' })).toBe(
      'claude-haiku-4-5'
    );
  });

  it('falls back to the provider default', () => {
    expect(resolveModel({ judgeId: 'professor_twin_ayd' })).toBe(DEFAULT_MODELS.anthropic);
    expect(resolveModel({ judgeId: 'democracy_scholar' })).toBe(DEFAULT_MODELS.openai);
    expect(resolveModel({ judgeId: 'policy_lawyer' })).toBe(DEFAULT_MODELS.gemini);
  });

  it('honours provider override when picking the default model', () => {
    expect(resolveModel({ judgeId: 'x', provider: 'gemini' })).toBe(DEFAULT_MODELS.gemini);
  });
});

describe('isOpenAIReasoningModel', () => {
  it('flags the GPT-5 line and o-series', () => {
    for (const m of ['gpt-5', 'gpt-5-mini', 'GPT-5', 'o1', 'o3', 'o4-mini']) {
      expect(isOpenAIReasoningModel(m)).toBe(true);
    }
  });
  it('does not flag gpt-4o chat models', () => {
    for (const m of ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini']) {
      expect(isOpenAIReasoningModel(m)).toBe(false);
    }
  });
});

describe('parseJudgeJson', () => {
  it('parses clean JSON', () => {
    expect(parseJudgeJson('{"score": 80}')).toEqual({ score: 80 });
  });

  it('strips a ```json fence (Claude sometimes wraps output)', () => {
    expect(parseJudgeJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('strips a bare ``` fence', () => {
    expect(parseJudgeJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('recovers a {...} span from surrounding prose', () => {
    expect(parseJudgeJson('Here is my evaluation: {"a": 1}. Done.')).toEqual({ a: 1 });
  });

  it('throws on empty output', () => {
    expect(() => parseJudgeJson('   ')).toThrow();
  });

  it('throws when there is no JSON object', () => {
    expect(() => parseJudgeJson('no json here')).toThrow();
  });
});

describe('callJudgeModel dispatch', () => {
  // The prompt now arrives split at the student's answer: `systemPrefix` is the
  // half shared by every student in a round, `systemSuffix` is the rest.
  const base = { systemPrefix: '', systemSuffix: 'sys', userPrompt: 'usr', maxTokens: 100 };

  it('calls a gpt-4o chat model with temperature 0 and max_tokens', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"dimensionScores":{"d":80}}' } }],
    });
    const out = await callJudgeModel(
      { openai: { chat: { completions: { create } } } },
      { ...base, provider: 'openai', model: 'gpt-4o' }
    );
    expect(out).toEqual({ dimensionScores: { d: 80 } });
    const arg = create.mock.calls[0][0];
    expect(arg.model).toBe('gpt-4o');
    expect(arg.temperature).toBe(0);
    expect(arg.max_tokens).toBe(100);
    expect(arg.max_completion_tokens).toBeUndefined();
    expect(arg.reasoning_effort).toBeUndefined();
    expect(arg.response_format).toEqual({ type: 'json_object' });
    expect(arg.messages[0]).toEqual({ role: 'system', content: 'sys' });
  });

  it('calls a GPT-5 reasoning model with max_completion_tokens and NO temperature', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"dimensionScores":{"d":60}}' } }],
    });
    const out = await callJudgeModel(
      { openai: { chat: { completions: { create } } } },
      { ...base, provider: 'openai', model: 'gpt-5' }
    );
    expect(out).toEqual({ dimensionScores: { d: 60 } });
    const arg = create.mock.calls[0][0];
    // GPT-5 rejects temperature (only default 1) and max_tokens.
    expect(arg.temperature).toBeUndefined();
    expect(arg.max_tokens).toBeUndefined();
    expect(arg.max_completion_tokens).toBe(100);
    expect(arg.reasoning_effort).toBe('minimal');
    expect(arg.response_format).toEqual({ type: 'json_object' });
  });

  // Este test pedia lo contrario —que `thinking` NO se mandara— y por eso
  // protegia el bug en vez de pillarlo: en sonnet-5 omitir el campo significa
  // thinking ADAPTATIVO, no thinking apagado, y el razonamiento se comia los
  // 1200 tokens antes de escribir el JSON. Tiene que ir escrito y desactivado.
  it('calls Anthropic with top-level system, NO temperature, and thinking OFF', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"ok":true}' }],
    });
    const out = await callJudgeModel(
      { anthropic: { messages: { create } } },
      { ...base, provider: 'anthropic', model: 'claude-opus-4-8' }
    );
    expect(out).toEqual({ ok: true });
    const arg = create.mock.calls[0][0];
    expect(arg.system).toBe('sys');
    expect(arg.temperature).toBeUndefined();
    expect(arg.thinking).toEqual({ type: 'disabled' });
    expect(arg.messages[0].role).toBe('user');
    expect(arg.messages[0].content).toMatch(/^usr/); // user prompt + JSON-safety suffix
  });

  it('retries the Anthropic call once when the first response is invalid JSON', async () => {
    // Claude has no forced-JSON mode; an unescaped quote can break the first reply.
    const create = vi.fn()
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '{"analysis":"dijo "hola" sin"}' }] }) // invalid JSON
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '{"dimensionScores":{"d":80}}' }] }); // valid on retry
    const out = await callJudgeModel(
      { anthropic: { messages: { create } } },
      { ...base, provider: 'anthropic', model: 'claude-sonnet-5' }
    );
    expect(out).toEqual({ dimensionScores: { d: 80 } });
    expect(create).toHaveBeenCalledTimes(2);
    // The repair prompt is only on the second call.
    expect(create.mock.calls[0][0].messages[0].content).not.toMatch(/anterior NO era JSON/);
    expect(create.mock.calls[1][0].messages[0].content).toMatch(/anterior NO era JSON/);
  });

  it('throws if Anthropic returns invalid JSON twice (judge then fails gracefully)', async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    await expect(
      callJudgeModel({ anthropic: { messages: { create } } }, { ...base, provider: 'anthropic', model: 'claude-sonnet-5' })
    ).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('concatenates multiple Anthropic text blocks', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [
        { type: 'text', text: '{"a":1,' },
        { type: 'text', text: '"b":2}' },
      ],
    });
    const out = await callJudgeModel(
      { anthropic: { messages: { create } } },
      { ...base, provider: 'anthropic', model: 'claude-opus-4-8' }
    );
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it('gives Anthropic a cached prefix block and an uncached suffix block', async () => {
    // The shared half of the prompt (persona + KB + rubric + scenario) is the same
    // for every student in a round. Claude has no implicit caching, so it only gets
    // the discount if we mark the breakpoint ourselves.
    const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"ok":1}' }] });
    await callJudgeModel(
      { anthropic: { messages: { create } } },
      { ...base, systemPrefix: 'RUBRICA COMPARTIDA', systemSuffix: 'respuesta del alumno', provider: 'anthropic', model: 'claude-sonnet-5' }
    );
    expect(create.mock.calls[0][0].system).toEqual([
      { type: 'text', text: 'RUBRICA COMPARTIDA', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'respuesta del alumno' },
    ]);
  });

  it('falls back to a single Anthropic system string when there is no shared prefix', async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"ok":1}' }] });
    await callJudgeModel(
      { anthropic: { messages: { create } } },
      { ...base, systemPrefix: '', systemSuffix: 'todo junto', provider: 'anthropic', model: 'claude-sonnet-5' }
    );
    expect(create.mock.calls[0][0].system).toBe('todo junto');
  });

  it('hands OpenAI and Gemini the two halves concatenated, unchanged', async () => {
    // Both cache prefixes implicitly, so they must receive byte-for-byte what they
    // received before the split — the shared half is already at the front.
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: '{"ok":1}' } }] });
    await callJudgeModel(
      { openai: { chat: { completions: { create } } } },
      { ...base, systemPrefix: 'PREFIJO\n', systemSuffix: 'SUFIJO', provider: 'openai', model: 'gpt-5' }
    );
    expect(create.mock.calls[0][0].messages[0].content).toBe('PREFIJO\nSUFIJO');

    const generateContent = vi.fn().mockResolvedValue({ text: '{"ok":1}' });
    await callJudgeModel(
      { gemini: { models: { generateContent } } },
      { ...base, systemPrefix: 'PREFIJO\n', systemSuffix: 'SUFIJO', provider: 'gemini', model: 'gemini-2.5-pro' }
    );
    expect(generateContent.mock.calls[0][0].config.systemInstruction).toBe('PREFIJO\nSUFIJO');
  });

  it('calls Gemini with systemInstruction and json mime type', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: '{"g":9}' });
    const out = await callJudgeModel(
      { gemini: { models: { generateContent } } },
      { ...base, provider: 'gemini', model: 'gemini-2.5-pro' }
    );
    expect(out).toEqual({ g: 9 });
    const arg = generateContent.mock.calls[0][0];
    expect(arg.model).toBe('gemini-2.5-pro');
    expect(arg.config.systemInstruction).toBe('sys');
    expect(arg.config.responseMimeType).toBe('application/json');
    expect(arg.config.temperature).toBe(0);
    // Hidden thinking is capped low or it eats the token budget and truncates JSON.
    expect(arg.config.thinkingConfig).toEqual({ thinkingBudget: GEMINI_THINKING_BUDGET });
  });

  it('throws when the needed client is missing', async () => {
    await expect(
      callJudgeModel({}, { ...base, provider: 'anthropic', model: 'claude-opus-4-8' })
    ).rejects.toThrow('anthropic client not provided');
  });
});
