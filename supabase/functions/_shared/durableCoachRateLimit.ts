export interface DurableCoachRateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
  readonly scope: 'client' | 'global';
}

interface DurableRateLimitFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

type DurableRateLimitFetch = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Record<string, string>;
    readonly body: string;
  },
) => Promise<DurableRateLimitFetchResponse>;

function isForwardedAddress(value: string): boolean {
  return value.length > 0
    && value.length <= 64
    && /^[0-9a-f:.]+$/i.test(value);
}

/**
 * Supabase's gateway supplies the original address as the first X-Forwarded-For
 * entry. Missing or malformed gateway identity fails closed; the public app key
 * is deliberately never a fallback because every athlete shares it.
 */
export function forwardedClientAddress(request: Request): string | null {
  const value = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  return isForwardedAddress(value) ? value : null;
}

export async function opaqueClientRateLimitKey(
  forwardedAddress: string,
  secret: string,
): Promise<string> {
  if (!isForwardedAddress(forwardedAddress) || secret.length < 32) {
    throw new Error('Coach rate-limit identity is unavailable.');
  }
  const encoder = new TextEncoder();
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await globalThis.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(forwardedAddress),
  ));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function checkDurableCoachRateLimit(args: {
  readonly clientKey: string;
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly windowSeconds: number;
  readonly clientMaxRequests: number;
  readonly globalMaxRequests: number;
  readonly fetch?: DurableRateLimitFetch;
}): Promise<DurableCoachRateLimitResult> {
  if (!/^[0-9a-f]{64}$/.test(args.clientKey)
    || !args.supabaseUrl.startsWith('https://')
    || args.serviceRoleKey.length === 0
    || args.windowSeconds <= 0
    || args.clientMaxRequests <= 0
    || args.globalMaxRequests < args.clientMaxRequests) {
    throw new Error('Coach durable rate-limit configuration is invalid.');
  }
  const fetcher = args.fetch ?? (globalThis.fetch as unknown as DurableRateLimitFetch);
  const response = await fetcher(
    `${args.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/check_coach_rate_limit`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.serviceRoleKey}`,
        apikey: args.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_client_key: args.clientKey,
        p_window_seconds: args.windowSeconds,
        p_client_max_requests: args.clientMaxRequests,
        p_global_max_requests: args.globalMaxRequests,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Coach durable rate limit failed (${response.status}).`);
  }
  const parsed = JSON.parse(await response.text()) as unknown;
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!row || typeof row !== 'object') {
    throw new Error('Coach durable rate limit returned no verdict.');
  }
  const value = row as Record<string, unknown>;
  if (typeof value.allowed !== 'boolean'
    || typeof value.retry_after_seconds !== 'number'
    || (value.scope !== 'client' && value.scope !== 'global')) {
    throw new Error('Coach durable rate limit returned an invalid verdict.');
  }
  return {
    allowed: value.allowed,
    retryAfterSeconds: Math.max(0, Math.ceil(value.retry_after_seconds)),
    scope: value.scope,
  };
}
