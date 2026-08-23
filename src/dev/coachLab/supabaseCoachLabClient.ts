import type {
  CoachLabFetch,
  OpenAIResponseRequest,
  OpenAIResponseResult,
  OpenAITokenReceipt,
} from './openAIResponsesClient';

function nullableToken(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function parseTokenReceipt(value: unknown): OpenAITokenReceipt {
  const receipt = value && typeof value === 'object'
    ? value as Partial<Record<keyof OpenAITokenReceipt, unknown>>
    : {};
  return {
    inputTokens: nullableToken(receipt.inputTokens),
    cachedInputTokens: nullableToken(receipt.cachedInputTokens),
    cacheWriteTokens: nullableToken(receipt.cacheWriteTokens),
    outputTokens: nullableToken(receipt.outputTokens),
    reasoningTokens: nullableToken(receipt.reasoningTokens),
    totalTokens: nullableToken(receipt.totalTokens),
  };
}

/**
 * Local Coach Lab transport. The public Supabase key only authenticates the
 * request to the new Edge Function; OPENAI_API_KEY never leaves Supabase.
 */
export class SupabaseCoachLabClient {
  private readonly endpoint: string;
  private readonly anonKey: string;
  private readonly fetcher: CoachLabFetch;

  constructor(args: {
    readonly supabaseUrl: string;
    readonly anonKey: string;
    readonly fetch?: CoachLabFetch;
  }) {
    const baseUrl = args.supabaseUrl.trim().replace(/\/$/, '');
    this.endpoint = `${baseUrl}/functions/v1/coach-lab`;
    this.anonKey = args.anonKey.trim();
    this.fetcher = args.fetch ?? (globalThis.fetch as unknown as CoachLabFetch);
  }

  async create(request: OpenAIResponseRequest): Promise<OpenAIResponseResult> {
    if (!this.endpoint.startsWith('https://') || !this.anonKey) {
      throw new Error('Coach Lab needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    }
    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.anonKey}`,
        apikey: this.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Coach Lab endpoint failed (${response.status}): ${raw.slice(0, 500)}`);
    }
    const payload = JSON.parse(raw) as Partial<OpenAIResponseResult>;
    if (typeof payload.outputText !== 'string') {
      throw new Error('Coach Lab endpoint returned no output text.');
    }
    return {
      outputText: payload.outputText,
      totalTokens: typeof payload.totalTokens === 'number' ? payload.totalTokens : null,
      tokenReceipt: parseTokenReceipt(payload.tokenReceipt),
    };
  }
}
