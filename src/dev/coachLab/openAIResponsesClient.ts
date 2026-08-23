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
    message: { type: 'string', minLength: 1 },
    answerMode: {
      type: 'string',
      enum: ['answer', 'focused_question', 'honest_limit', 'generic_refusal'],
    },
    basis: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['athlete_snapshot', 'lfa_rule', 'coaching_judgement', 'general_s_and_c'],
      },
    },
    snapshotFieldsUsed: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['visibleWeek', 'thisWeek', 'readiness', 'load', 'progress', 'restrictions'],
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
            enum: ['lfa_bible', 'active_rule', 'approved_example'],
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
        body: JSON.stringify({
          model: request.model,
          store: false,
          reasoning: { effort: 'medium' },
          instructions: request.instructions,
          input: request.input,
          text: {
            format: {
              type: 'json_schema',
              name: 'coach_lab_response_v1',
              strict: true,
              schema: RESPONSE_SCHEMA,
            },
          },
        }),
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
    const usage = payload.usage as { total_tokens?: unknown } | undefined;
    return {
      outputText,
      totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
    };
  }
}
