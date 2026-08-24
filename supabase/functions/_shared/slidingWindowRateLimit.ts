export interface SlidingWindowRateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

interface WindowEntry {
  windowStartedAt: number;
  requests: number;
  lastSeenAt: number;
}

/**
 * Coarse per-isolate protection for paid Edge Function calls. It stores only an
 * opaque client key and timestamps, expires naturally, and is deliberately
 * bounded so an attacker cannot grow the map without limit.
 */
export function createSlidingWindowRateLimiter(options: {
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly maxKeys: number;
  readonly now?: () => number;
}) {
  if (options.windowMs <= 0 || options.maxRequests <= 0 || options.maxKeys <= 0) {
    throw new Error('Sliding-window limits must be positive.');
  }
  const now = options.now ?? Date.now;
  const windows = new Map<string, WindowEntry>();

  function pruneExpired(at: number): void {
    for (const [key, entry] of windows) {
      if (at - entry.lastSeenAt >= options.windowMs) windows.delete(key);
    }
  }

  function makeRoom(at: number): void {
    if (windows.size < options.maxKeys) return;
    pruneExpired(at);
    if (windows.size < options.maxKeys) return;
    let oldestKey: string | null = null;
    let oldestSeen = Infinity;
    for (const [key, entry] of windows) {
      if (entry.lastSeenAt < oldestSeen) {
        oldestKey = key;
        oldestSeen = entry.lastSeenAt;
      }
    }
    if (oldestKey !== null) windows.delete(oldestKey);
  }

  return {
    check(key: string): SlidingWindowRateLimitResult {
      const at = now();
      const existing = windows.get(key);
      if (!existing || at - existing.windowStartedAt >= options.windowMs) {
        if (!existing) makeRoom(at);
        windows.set(key, { windowStartedAt: at, requests: 1, lastSeenAt: at });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      existing.lastSeenAt = at;
      if (existing.requests >= options.maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.windowStartedAt + options.windowMs - at) / 1_000),
          ),
        };
      }
      existing.requests += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
