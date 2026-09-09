/**
 * THE COACH ANSWER ARRIVES AS IT IS WRITTEN (R-399, Sam, 2026-09-10: "show
 * the words as they arrive"; option 1 — words shown, then withdrawn if the
 * check fails).
 *
 * The wire is newline-delimited JSON, one line per event, on a 200 response
 * of `application/x-ndjson`:
 *   {"t":"open"}                              — first bytes, so the phone knows it is live
 *   {"t":"m","text":"<the message so far>"}   — the whole message text so far (idempotent)
 *   {"t":"final","message":…,"programActions":[]}
 *   {"t":"refused","error":…,"violations":[…],"details":{…}}
 *   {"t":"error","error":"coach_chat_provider_failed"}
 * A failure BEFORE the model is called (rate limit, contract version, bad
 * input) is still a plain JSON error with its status code.
 *
 * The model writes a JSON object whose FIRST key is `message`; the extractor
 * below reads that string as the characters arrive, escapes and all, so the
 * words can be forwarded before the receipt fields exist. Shared by the
 * server (writer) and the app (reader) so one parser is the parser.
 */

export const COACH_CHAT_STREAM_CONTENT_TYPE = 'application/x-ndjson';

export type CoachChatStreamLine =
  | { readonly t: 'open' }
  | { readonly t: 'm'; readonly text: string }
  | {
    readonly t: 'final';
    readonly message: string;
    readonly answerMode?: unknown;
    readonly programActions: readonly unknown[];
  }
  | {
    readonly t: 'refused';
    readonly error: 'coach_chat_response_refused' | 'coach_chat_invalid_answer';
    readonly violations: readonly string[];
    readonly details?: Readonly<Record<string, string>>;
  }
  | { readonly t: 'error'; readonly error: string };

/** Every complete line so far; a partial last line is returned as `trailing`. */
export function parseCoachChatStream(text: string): {
  readonly lines: readonly CoachChatStreamLine[];
  readonly trailing: string;
} {
  const parts = text.split('\n');
  const trailing = parts.pop() ?? '';
  const lines: CoachChatStreamLine[] = [];
  for (const part of parts) {
    const raw = part.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { t?: unknown };
      if (parsed && typeof parsed === 'object' && typeof parsed.t === 'string') {
        lines.push(parsed as CoachChatStreamLine);
      }
    } catch {
      // a torn line is not an event; the next chunk completes it
    }
  }
  return { lines, trailing };
}

export function isCoachChatStream(contentType: string | null, text: string): boolean {
  return (contentType ?? '').includes('x-ndjson') || /^\s*\{"t":/.test(text);
}

export interface CoachMessageExtractor {
  /** Feed the next chunk of the model's JSON; returns the message so far. */
  push(chunk: string): string;
  readonly message: string;
  readonly complete: boolean;
}

/**
 * Reads the value of the first `"message"` key out of a JSON object as it
 * streams. Handles `\"`, `\\`, `\n`, `\t`, `\uXXXX` and chunks that split an
 * escape. Nothing is emitted until the key is found; once the closing quote
 * arrives the extractor is complete and ignores the rest.
 */
export function createMessageExtractor(): CoachMessageExtractor {
  let mode: 'seek' | 'in' | 'done' = 'seek';
  let seen = '';
  let message = '';
  let pending = '';
  const KEY = /"message"\s*:\s*"/;
  return {
    push(chunk: string): string {
      if (mode === 'done') return message;
      if (mode === 'seek') {
        seen += chunk;
        const match = KEY.exec(seen);
        if (!match) return message;
        mode = 'in';
        chunk = seen.slice(match.index + match[0].length);
        seen = '';
      }
      let input = pending + chunk;
      pending = '';
      let index = 0;
      while (index < input.length) {
        const char = input[index];
        if (char === '\\') {
          const next = input[index + 1];
          if (next === undefined) { pending = input.slice(index); break; }
          if (next === 'u') {
            const hex = input.slice(index + 2, index + 6);
            if (hex.length < 4) { pending = input.slice(index); break; }
            message += String.fromCharCode(parseInt(hex, 16));
            index += 6;
            continue;
          }
          const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
          message += map[next] ?? next;
          index += 2;
          continue;
        }
        if (char === '"') { mode = 'done'; break; }
        message += char;
        index += 1;
      }
      return message;
    },
    get message() { return message; },
    get complete() { return mode === 'done'; },
  };
}
