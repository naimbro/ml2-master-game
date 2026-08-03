/**
 * Multi-provider judge dispatch.
 *
 * The three judges on a panel are meant to be three DIFFERENT models, not three
 * personas of one. Three personas of gpt-4o share a training run and a tokenizer,
 * so when the model misreads an answer all three miss it the same way — averaging
 * correlated errors launders one opinion into a false consensus. Genuinely
 * independent models decorrelate those errors, and a sharp disagreement between
 * them is itself a signal (borderline answer, or ambiguous rubric).
 *
 * This module owns provider selection, the per-provider API call, and JSON
 * extraction. The prompt building and score arithmetic stay in index.ts /
 * scoring.ts — this layer only turns "(provider, prompt) -> parsed JSON".
 */

export type JudgeProvider = 'openai' | 'anthropic' | 'gemini';

/**
 * Default model per provider. Overridable per judge via `judge.model` in
 * content/courses/<course>/judges.json.
 *
 * These are deliberately kept in ONE pricing band (anchored on gpt-4o at
 * $2.50/$10 per MTok): claude-sonnet-5 is $3/$15, gemini-2.5-pro is $1.25/$10 —
 * output within ~1.5x across all three. That matters because three judges run per
 * answer: a lopsided panel (e.g. opus-4-8 at $5/$25 next to flash at $0.30/$2.50)
 * makes one judge dominate the bill and another nearly free, which is not really a
 * balanced three-model panel. Keeping them same-band preserves the decorrelation
 * benefit (three genuinely different models) without one model owning the cost.
 *
 * To move the whole panel to a cheaper band, set each judge's `model` in
 * judges.json (e.g. gpt-4o-mini / claude-haiku-4-5 / gemini-2.5-flash) — but note
 * gemini-2.5-flash lets you drop GEMINI_THINKING_BUDGET back toward 0, whereas
 * gemini-2.5-pro requires >= 128 (see below).
 */
export const DEFAULT_MODELS: Record<JudgeProvider, string> = {
  openai: 'gpt-5',
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-2.5-pro',
};

/**
 * True for OpenAI reasoning-family models (GPT-5 line, o-series). They take a
 * different request shape than the gpt-4o chat models: `max_completion_tokens`
 * instead of `max_tokens`, and they reject `temperature` (only the default 1 is
 * allowed — a probe against gpt-5 returns 400 on temperature: 0). We keep the
 * gpt-4o path available so a judge can be pinned back to a chat model.
 */
export function isOpenAIReasoningModel(model: string): boolean {
  return /^(gpt-5|o[1-9])/i.test(model);
}

/**
 * Gemini hidden-thinking budget, in output tokens.
 *
 * gemini-2.5-pro CANNOT disable thinking — a budget of 0 is rejected (minimum
 * 128). We pin it to the minimum: our prompt already asks for analysis-first JSON,
 * so we don't want Gemini spending extra output tokens (billed at pro's $10/MTok)
 * on a second, hidden reasoning pass. 128 also works for gemini-2.5-flash, so a
 * judge overridden to flash still behaves. If you switch a Gemini judge to flash
 * and want it fully single-pass, this can go to 0 for that model.
 */
export const GEMINI_THINKING_BUDGET = 128;

/**
 * Fallback provider per judgeId, used only when a judge config omits `provider`.
 * The approved mapping: professor-twin personas -> Claude; the scholar/technical
 * lens -> GPT; the institutional/policy lens -> Gemini. Any judge not listed
 * defaults to openai (the historical behavior).
 */
const PROVIDER_BY_JUDGE_ID: Record<string, JudgeProvider> = {
  // Panel por defecto de cursos nuevos (content/courses/_generic/judges.json).
  // Ese archivo ya trae `provider` explícito, que gana sobre este mapa; están acá
  // igual porque un id sin provider cae a openai y los tres jueces terminarían en
  // el mismo modelo — el panel dejaría de decorrelacionar errores sin avisar.
  generic_specialist: 'openai',
  generic_praxis: 'gemini',
  generic_teacher: 'anthropic',
  // AI y Democracia
  professor_twin_ayd: 'anthropic',
  democracy_scholar: 'openai',
  policy_lawyer: 'gemini',
  // ml2-2025
  professor_twin: 'anthropic',
  technical_expert: 'openai',
  public_sector: 'gemini',
};

const VALID_PROVIDERS = new Set<JudgeProvider>(['openai', 'anthropic', 'gemini']);

export function resolveProvider(judge: { judgeId: string; provider?: string }): JudgeProvider {
  if (judge.provider && VALID_PROVIDERS.has(judge.provider as JudgeProvider)) {
    return judge.provider as JudgeProvider;
  }
  return PROVIDER_BY_JUDGE_ID[judge.judgeId] || 'openai';
}

export function resolveModel(judge: { judgeId: string; provider?: string; model?: string }): string {
  if (judge.model && judge.model.trim()) return judge.model.trim();
  return DEFAULT_MODELS[resolveProvider(judge)];
}

/**
 * Parse a model's text output into a JSON object.
 *
 * OpenAI's json_object mode and Gemini's application/json mime type return clean
 * JSON, but Anthropic (and any provider on a bad day) can wrap it in ```json
 * fences or add a stray sentence. Strip fences, then fall back to the first
 * balanced {...} span. Throws if nothing parses, so the caller marks the judge
 * failed rather than scoring garbage.
 */
export function parseJudgeJson(text: string): Record<string, unknown> {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('empty judge response');

  // Direct parse (the common case for json-mode providers).
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fence/span extraction
  }

  // Strip a ```json ... ``` or ``` ... ``` fence if present.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // fall through
    }
  }

  // Last resort: the widest {...} span.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }

  throw new Error('no JSON object found in judge response');
}

export interface JudgeModelClients {
  // Constructed lazily in index.ts; typed loosely to avoid importing three SDKs here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openai?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anthropic?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gemini?: any;
}

export interface JudgeCallOptions {
  provider: JudgeProvider;
  model: string;
  /**
   * The half of the instruction prompt that is identical for every student in a
   * round: persona, knowledge base, rubric, scenario, ideal answer. ~5.000 tokens
   * that used to be re-billed once per student per judge. Handed to Anthropic as a
   * separate cached block; concatenated with the suffix for the other two.
   */
  systemPrefix: string;
  /** The student's answer and everything the template puts after it. */
  systemSuffix: string;
  /** The short user turn ("evaluate and respond with JSON only"). */
  userPrompt: string;
  maxTokens: number;
}

/**
 * Call the right provider and return the parsed JSON object.
 *
 * All three run at temperature 0 (grading should be reproducible). Note the
 * per-provider shapes: OpenAI takes system+user messages and json_object mode;
 * Anthropic takes a top-level `system` string and rejects `temperature` on
 * opus-4-8/4.7 (so it is simply omitted — the model is deterministic enough here
 * and the prompt already forces JSON); Gemini takes systemInstruction + an
 * application/json mime type.
 */
export async function callJudgeModel(
  clients: JudgeModelClients,
  opts: JudgeCallOptions
): Promise<Record<string, unknown>> {
  const { provider, model, systemPrefix, systemSuffix, userPrompt, maxTokens } = opts;

  // OpenAI and Gemini both cache prompt prefixes implicitly (automatic above ~1k
  // tokens), so they get exactly the string they got before the split — the shared
  // half is already at the front, which is all their caches need.
  const systemPrompt = systemPrefix + systemSuffix;

  if (provider === 'openai') {
    if (!clients.openai) throw new Error('openai client not provided');
    const params: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };
    if (isOpenAIReasoningModel(model)) {
      // GPT-5 / o-series: no `temperature` (rejected), `max_completion_tokens`
      // instead of `max_tokens`, and `reasoning_effort: 'minimal'` to keep latency
      // near gpt-4o's — grading against a rubric is not a deep-reasoning task, and
      // full effort roughly triples the wall-clock. Note: these models cannot run
      // at temperature 0, so this judge is not bit-reproducible like the other two;
      // the 6-anchor snap in scoring.ts absorbs most of that variance.
      params.max_completion_tokens = maxTokens;
      params.reasoning_effort = 'minimal';
    } else {
      params.temperature = 0;
      params.max_tokens = maxTokens;
    }
    const completion = await clients.openai.chat.completions.create(params);
    return parseJudgeJson(completion.choices[0]?.message?.content || '');
  }

  if (provider === 'anthropic') {
    if (!clients.anthropic) throw new Error('anthropic client not provided');
    // Unlike OpenAI (json_object) and Gemini (application/json), Claude has no
    // forced-JSON response mode, so it can emit INVALID JSON — most often an
    // unescaped double-quote when it quotes the student's text inside a string
    // value (observed live: a valid answer failed at char 684). We instruct it to
    // escape quotes, and retry once with an explicit repair prompt on a parse
    // failure before giving up (the retry only fires on the rare bad response).
    // No `temperature`: sonnet-5/opus lo rechazan con 400.
    //
    // `thinking` va DESACTIVADO DE FORMA EXPLICITA, y tiene que ir escrito. En
    // sonnet-4.6 omitir el campo dejaba al juez de una sola pasada; en sonnet-5
    // omitirlo significa thinking ADAPTATIVO, y `max_tokens` es un techo duro
    // sobre thinking + texto. Con maxTokens=1200 el razonamiento se comia el
    // presupuesto entero, no quedaba nada para el JSON, y `content` volvia sin
    // bloque de texto: eso es el "empty judge response" que tumbo 2 de 24
    // evaluaciones el 2026-08-02. El reintento de mas abajo repetia la misma
    // llamada y fallaba igual, por eso los fallos venian de a pares.
    //
    // El analysis-first del prompt ya carga el razonamiento, asi que el juez no
    // necesita una pasada extra — es el mismo freno que Gemini ya tenia puesto
    // con GEMINI_THINKING_BUDGET.
    const JSON_SAFETY =
      '\n\nIMPORTANTE: devuelve UN solo objeto JSON válido y parseable. Escapa toda comilla doble interna como \\" y no incluyas saltos de linea sin escapar dentro de los valores de texto.';
    //
    // Claude is the only one of the three with NO implicit prompt caching, and it is
    // also the most expensive input of the panel ($3/MTok vs $1.25). So the system
    // prompt goes in as two blocks with an explicit breakpoint after the shared half:
    // the first student of a round pays a 1.25x cache write, everyone after reads it
    // at 0.1x. Below ~1k tokens of prefix the API silently declines to cache, which
    // is a no-op, not an error — a session with a tiny knowledge base just doesn't
    // benefit. Default TTL is 5 minutes, comfortably longer than a round window.
    const system = systemPrefix
      ? [
          { type: 'text', text: systemPrefix, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: systemSuffix },
        ]
      : systemPrompt;
    const runClaude = async (repair: boolean): Promise<string> => {
      const message = await clients.anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        thinking: { type: 'disabled' },
        system,
        messages: [{ role: 'user', content: userPrompt + JSON_SAFETY + (repair ? ' Tu respuesta anterior NO era JSON parseable; corrigela.' : '') }],
      });
      const text = (message.content || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === 'text')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join('');
      // Una respuesta cortada por el techo de tokens llegaba al parser como un
      // "empty judge response" pelado, sin decir por que. Se deja dicho.
      if (!text.trim() && message.stop_reason === 'max_tokens') {
        throw new Error(`empty judge response: se acabaron los ${maxTokens} tokens antes del JSON`);
      }
      return text;
    };
    try {
      return parseJudgeJson(await runClaude(false));
    } catch {
      return parseJudgeJson(await runClaude(true));
    }
  }

  if (provider === 'gemini') {
    if (!clients.gemini) throw new Error('gemini client not provided');
    // Gemini 2.5 runs hidden "thinking" by default; left uncapped it silently
    // spends output tokens before writing any JSON, which can blow maxTokens and
    // truncate the response mid-string. GEMINI_THINKING_BUDGET pins it to the
    // minimum (see its docstring — pro can't go to 0).
    const response = await clients.gemini.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET },
      },
    });
    return parseJudgeJson(response.text || '');
  }

  throw new Error(`unknown judge provider: ${provider}`);
}
