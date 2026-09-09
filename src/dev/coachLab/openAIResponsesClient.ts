export interface CoachLabFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type CoachLabFetch = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly signal?: AbortSignal;
  },
) => Promise<CoachLabFetchResponse>;

export interface OpenAIResponseResult {
  readonly outputText: string;
  readonly totalTokens: number | null;
  readonly tokenReceipt: OpenAITokenReceipt;
}

export interface OpenAITokenReceipt {
  readonly inputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly totalTokens: number | null;
}

export interface OpenAIResponseRequest {
  readonly model: string;
  readonly instructions: string;
  readonly input: string;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'message',
    'answerMode',
    'basis',
    'snapshotFieldsUsed',
    'knowledgeSources',
    'judgementLabel',
    'programActions',
  ],
  properties: {
    // FIRST on purpose: the app shows the message as it streams (R-399), and
    // structured output emits keys in schema order.
    message: { type: 'string', minLength: 1 },
    answerMode: {
      type: 'string',
      enum: ['answer', 'focused_question', 'honest_limit', 'generic_refusal'],
    },
    // 2026-09-10: `app_door`, the S1/S5 snapshot blocks and `app_map` were
    // missing here while the contract and the instructions named them — under
    // strict JSON Schema the model literally could not say them (the mislabelled
    // DOOR citations and receipt/word mismatches on v12–v17 were this). One
    // list, kept in step with `coachResponseContract.ts`.
    basis: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['athlete_snapshot', 'lfa_rule', 'coaching_judgement', 'general_s_and_c', 'app_door'],
      },
    },
    snapshotFieldsUsed: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'visibleWeek', 'thisWeek', 'readiness', 'load', 'progress', 'restrictions',
          'situation', 'history', 'injuries', 'mas', 'estimates', 'athlete',
        ],
      },
    },
    knowledgeSources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'authority', 'sourceReference'],
        properties: {
          id: { type: 'string' },
          authority: {
            type: 'string',
            enum: ['lfa_bible', 'active_rule', 'canonical_source', 'approved_example', 'app_map'],
          },
          sourceReference: { type: 'string' },
        },
      },
    },
    judgementLabel: {
      type: 'string',
      enum: ['not_needed', 'labelled', 'missing'],
    },
    programActions: {
      type: 'array',
      maxItems: 0,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'label'],
        properties: {
          kind: { type: 'string' },
          label: { type: 'string' },
        },
      },
    },
  },
} as const;

function extractOutputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }
  if (!Array.isArray(payload.output)) return null;
  for (const item of payload.output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const typedPart = part as { type?: unknown; text?: unknown };
      if (typedPart.type === 'output_text' && typeof typedPart.text === 'string') {
        return typedPart.text;
      }
    }
  }
  return null;
}

function safeFailureBody(raw: string): string {
  return raw.slice(0, 500).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

export class OpenAIResponsesClient {
  private readonly apiKey: string;
  private readonly fetcher: CoachLabFetch;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(args: {
    readonly apiKey: string;
    readonly fetch?: CoachLabFetch;
    readonly endpoint?: string;
    readonly timeoutMs?: number;
  }) {
    this.apiKey = args.apiKey.trim();
    this.fetcher = args.fetch ?? (globalThis.fetch as unknown as CoachLabFetch);
    this.endpoint = args.endpoint ?? 'https://api.openai.com/v1/responses';
    this.timeoutMs = args.timeoutMs ?? 120_000;
  }


  /**
   * The same request with `stream: true`: every `response.output_text.delta`
   * reaches `onDelta` as it arrives; the completed response's text and usage
   * are returned at the end, exactly as `create` returns them (R-399).
   */
  async stream(
    request: OpenAIResponseRequest,
    onDelta: (delta: string) => void,
  ): Promise<OpenAIResponseResult> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is missing; the coach did not make a network request.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({ ...this.requestBody(request), stream: true }),
      });
      if (!response.ok || !response.body) {
        const raw = await response.text();
        throw new Error(`OpenAI Responses request failed (${response.status}): ${safeFailureBody(raw)}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let outputText = '';
      let completed: Record<string, unknown> | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
          const data = block.split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('');
          if (!data || data === '[DONE]') continue;
          let event: { type?: unknown; delta?: unknown; response?: unknown; error?: unknown };
          try { event = JSON.parse(data) as typeof event; } catch { continue; }
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            outputText += event.delta;
            onDelta(event.delta);
          } else if (event.type === 'response.completed' && event.response && typeof event.response === 'object') {
            completed = event.response as Record<string, unknown>;
          } else if (event.type === 'response.failed' || event.type === 'error') {
            throw new Error(`OpenAI Responses stream failed: ${safeFailureBody(JSON.stringify(event.error ?? event))}`);
          }
        }
      }
      if (!outputText.trim()) throw new Error('OpenAI Responses returned no output text.');
      const tokenReceipt = readTokenReceipt(completed ?? {});
      return { outputText, totalTokens: tokenReceipt.totalTokens, tokenReceipt };
    } finally {
      clearTimeout(timeout);
    }
  }

  private requestBody(request: OpenAIResponseRequest): Record<string, unknown> {
    return {
      model: request.model,
      store: false,
      reasoning: { effort: 'low', context: 'current_turn' },
      max_output_tokens: 1800,
      instructions: request.instructions,
      input: request.input,
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'coach_lab_response_v1',
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    };
  }

  async create(request: OpenAIResponseRequest): Promise<OpenAIResponseResult> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is missing; Coach Lab did not make a network request.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: CoachLabFetchResponse;
    try {
      response = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(this.requestBody(request)),
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI Responses request failed (${response.status}): ${safeFailureBody(raw)}`);
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('OpenAI Responses returned invalid JSON without usable output text.');
    }
    const outputText = extractOutputText(payload);
    if (!outputText) {
      throw new Error('OpenAI Responses returned no output text.');
    }
    const tokenReceipt = readTokenReceipt(payload);
    return {
      outputText,
      totalTokens: tokenReceipt.totalTokens,
      tokenReceipt,
    };
  }
}

function readTokenReceipt(payload: Record<string, unknown>): OpenAITokenReceipt {
    const usage = payload.usage as {
      input_tokens?: unknown;
      input_tokens_details?: {
        cached_tokens?: unknown;
        cache_write_tokens?: unknown;
      };
      output_tokens?: unknown;
      output_tokens_details?: { reasoning_tokens?: unknown };
      total_tokens?: unknown;
    } | undefined;
    const tokenReceipt: OpenAITokenReceipt = {
      inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : null,
      cachedInputTokens: typeof usage?.input_tokens_details?.cached_tokens === 'number'
        ? usage.input_tokens_details.cached_tokens
        : null,
      cacheWriteTokens: typeof usage?.input_tokens_details?.cache_write_tokens === 'number'
        ? usage.input_tokens_details.cache_write_tokens
        : null,
      outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : null,
      reasoningTokens: typeof usage?.output_tokens_details?.reasoning_tokens === 'number'
        ? usage.output_tokens_details.reasoning_tokens
        : null,
      totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
    };
    return tokenReceipt;
}
