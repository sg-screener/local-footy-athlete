/**
 * llmCoachIntentClassifier.ts — production wiring for the
 * `CoachIntentClassifier` interface.
 *
 *   const classifier = new LLMCoachIntentClassifier({
 *     endpoint: 'https://<project>.supabase.co/functions/v1/coach-intent',
 *     authToken: '<anon key>',
 *   });
 *   const intent = await classifier.classify(packet);
 *
 * The class delegates the heavy lifting to the edge function at
 * `supabase/functions/coach-intent/index.ts`, which calls the configured
 * coach LLM provider and returns the parsed JSON intent. This module is
 * just the client transport.
 *
 * SAFETY GUARANTEES
 *   - On any failure (network error, HTTP error, malformed JSON,
 *     schema mismatch) the classifier returns a deterministic
 *     `general_question` fallback. The dispatcher treats this as
 *     "no understanding" and falls back to the existing rule-based
 *     flow. We never crash the chat UI on a classifier failure.
 *
 *   - The classifier NEVER mutates state. It only returns intent.
 *
 *   - All classifier output goes through `parseCoachIntent` so a
 *     malicious / hallucinating LLM can't smuggle unknown fields
 *     into the dispatcher.
 *
 * LOGGING (per spec)
 *   - `[coach-intent] input`  — packet summary + first chars of message
 *   - `[coach-intent] raw`    — raw LLM response (truncated)
 *   - `[coach-intent] parsed` — validated CoachIntent
 *   - `[coach-intent] error`  — on any failure path
 */

import {
  parseCoachIntent,
  type CoachContextPacket,
  type CoachIntent,
  type CoachIntentClassifier,
} from './coachIntent';
import { serialisePacketForLLM } from './coachContextPacket';
import { logger } from './logger';

export interface LLMCoachIntentClassifierOptions {
  /** Full URL to the deployed edge function. */
  endpoint: string;
  /** Optional Supabase anon key / bearer token. Sent as Authorization. */
  authToken?: string;
  /** Override the global fetch — tests inject a mock. */
  fetcher?: typeof fetch;
  /**
   * Per-request timeout in ms. Defaults to 8s — the edge function
   * upstream is a compact classifier model, so this should be plenty.
   */
  timeoutMs?: number;
}

/** Length-cap for log lines so verbose packets don't drown the console. */
const LOG_TRUNCATE = 240;

function truncate(s: string, n: number = LOG_TRUNCATE): string {
  if (!s) return s;
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

/**
 * Safe fallback when the LLM is unreachable / malformed. Returning
 * `general_question` with confidence=0 tells the dispatcher to use
 * its deterministic guards (the legacy injury clarifier etc.) for
 * this turn — the chat doesn't break.
 */
function safeFallback(): CoachIntent {
  return {
    intent: 'general_question',
    confidence: 0,
    needsClarification: false,
    rationale: 'classifier_fallback',
  };
}

export class LLMCoachIntentClassifier implements CoachIntentClassifier {
  private readonly endpoint: string;
  private readonly authToken?: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: LLMCoachIntentClassifierOptions) {
    this.endpoint = opts.endpoint;
    this.authToken = opts.authToken;
    this.fetcher = opts.fetcher ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  async classify(packet: CoachContextPacket): Promise<CoachIntent> {
    const serialisedPacket = serialisePacketForLLM(packet);
    logger.debug('[coach-intent] input', {
      messageLength: packet.userMessage.length,
      activeInjury: packet.activeInjury
        ? {
            bodyPart: packet.activeInjury.bodyPart,
            severity: packet.activeInjury.severity,
            status: packet.activeInjury.status,
          }
        : null,
      coachUpdate: packet.coachUpdate ? packet.coachUpdate.reason : null,
      packetBytes: serialisedPacket.length,
      todayISO: packet.todayISO,
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      // Supabase API gateway requires BOTH headers — `apikey` is checked by
      // the gateway, `Authorization: Bearer` by the function runtime. Sending
      // only one returns 401 Invalid JWT even when verify_jwt=false.
      headers['Authorization'] = `Bearer ${this.authToken}`;
      headers['apikey'] = this.authToken;
    }

    const body = JSON.stringify({
      packet: serialisedPacket,
      message: packet.userMessage,
    });

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      controller != null
        ? setTimeout(() => controller.abort(), this.timeoutMs)
        : null;

    let resp: Response;
    try {
      resp = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller?.signal as any,
      });
    } catch (err) {
      logger.warn('[coach-intent] error', {
        kind: 'fetch_failed',
        detail: err instanceof Error ? err.message : String(err),
      });
      return safeFallback();
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      logger.warn('[coach-intent] error', {
        kind: 'http_error',
        status: resp.status,
      });
      logger.debug('[coach-intent] http_error body preview', truncate(errText));
      return safeFallback();
    }

    let json: unknown;
    try {
      json = await resp.json();
    } catch (err) {
      logger.warn('[coach-intent] error', {
        kind: 'json_parse_failed',
        detail: err instanceof Error ? err.message : String(err),
      });
      return safeFallback();
    }

    logger.debug('[coach-intent] raw', truncate(JSON.stringify(json)));

    const parsed = parseCoachIntent(json);
    if (!parsed) {
      logger.warn('[coach-intent] error', {
        kind: 'schema_validation_failed',
      });
      logger.debug('[coach-intent] schema_validation_failed raw', truncate(JSON.stringify(json)));
      return safeFallback();
    }

    logger.debug('[coach-intent] parsed', {
      intent: parsed.intent,
      confidence: parsed.confidence,
      needsClarification: parsed.needsClarification,
      payloadKeys: parsed.payload ? Object.keys(parsed.payload) : [],
    });
    return parsed;
  }

  classifySessionOutcome(packet: CoachContextPacket): Promise<CoachIntent> {
    return this.classify(packet);
  }
}
