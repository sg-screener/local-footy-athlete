/**
 * pendingInjuryResolver.ts
 *
 * Pure helper that resolves which injury context (bodyPart + severity)
 * the UAE should run with, given:
 *   - the latest user message
 *   - any pending injury context stashed by the severity-unknown clarifier
 *     guard on a prior turn
 *
 * BACKGROUND
 *   The injury client guard fires when an athlete writes "my hammy is
 *   cooked" (body part + descriptor, no severity). It returns
 *   "How bad is it? Rough pain out of 10." Without help, the UAE then
 *   sees the next reply ("6/10") in isolation — no body part, no injury
 *   signal — and falls through to the LLM with no context. This helper
 *   bridges those two turns: when the guard fires we stash bodyPart in
 *   a pending record; on the next message we merge severity-only inputs
 *   with that record so the UAE keeps owning the turn end-to-end.
 *
 * LIFECYCLE
 *   stored    — written when the severity-unknown guard fires AND the
 *               message names a body part
 *   consumed  — used (and cleared) on a severity-only follow-up turn
 *   stale     — cleared when the next message arrives more than
 *               PENDING_INJURY_TTL_MS after the stash
 *   abandoned — caller clears it whenever the turn falls through to the
 *               LLM, so a later "6/10" answering an unrelated question
 *               doesn't accidentally trigger the injury flow
 *
 * The helper is pure: it does not own the ref, it just reads/decides.
 * The caller (CoachScreen.handleSend) owns the ref and the side effects
 * (clearing stale entries, writing on guard fire).
 */

import {
  extractBodyPart,
  extractInjuryContext,
  parseSeverityNumber,
  type InjuryContext,
  type InjuryBucket,
} from './injuryAdjustmentEngine';
import { resolveInjuryBucket } from './programAdjustmentEngine';
import type { InjuryState } from './injuryProgression';
import { logger } from './logger';

export const PENDING_INJURY_TTL_MS = 10 * 60 * 1000;

export interface PendingInjury {
  bodyPart: string;
  originalMessage: string;
  timestamp: number;
}

/**
 * Parse a severity number when we KNOW the user is replying to a
 * "rate it 1–10" question. Stricter than parseSeverityNumber: rejects
 * accidental matches like "I trained for 9 hours" — but accepts bare
 * single-token numbers ("9", "  8  ", "9/10", "8 out of 10",
 * "around 7", "maybe a 6") which the production parser misses.
 *
 * Used by `shouldBindSeverityToPending` and the pending branch of
 * `resolveInjuryFromMessage` so a fresh pending clarifier can bind to
 * a one-word reply like "9".
 */
export function parsePendingSeverity(message: string): number | null {
  if (!message || typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed) return null;

  // Bare integer 1–10 with no other content (most common: user typed "9").
  const bare = trimmed.match(/^([1-9]|10)$/);
  if (bare) return parseInt(bare[1], 10);

  // "9/10", "8 / 10", "9 out of 10" — whole-message form.
  const slash = trimmed.match(/^([1-9]|10)\s*(?:\/\s*10|out\s*of\s*10)$/i);
  if (slash) return parseInt(slash[1], 10);

  // Same forms but inside a longer message ("around 7", "maybe a 6").
  const inline = trimmed.match(
    /\b(?:around|maybe|like|about|a)\s+(?:a\s+)?([1-9]|10)\b/i,
  );
  if (inline) return parseInt(inline[1], 10);

  // Fall back to the general parser (handles "feels off" → 6 etc.).
  return parseSeverityNumber(trimmed);
}

export type ResolveSource = 'message' | 'pending';

export interface ResolvedInjury {
  bodyPart: string;
  severity: number;
  bucket: InjuryBucket | null;
  source: ResolveSource;
}

export type ResolveOutcome =
  | {
      kind: 'resolved';
      resolved: ResolvedInjury;
      pendingAfter: PendingInjury | null; // ALWAYS null — pending is consumed
    }
  | {
      kind: 'stale_cleared';
      pendingAfter: null;
    }
  | {
      kind: 'no_match';
      pendingAfter: PendingInjury | null; // unchanged
    };

/**
 * Decide whether the UAE should fire on this message and, if so, what
 * (bodyPart, severity) to pass it.
 *
 * Decision order:
 *   1. Message contains both body part + severity (or is a severity-only
 *      report with an injury signal that resolves to bodyPart='unknown')
 *      → resolve from message
 *   2. Message has severity only AND we have a fresh pending entry
 *      → merge: bodyPart from pending, severity from message
 *   3. Message has severity only but pending is stale (> TTL)
 *      → drop pending; do not fire
 *   4. Otherwise → no match
 *
 * The caller is responsible for the ref write/read; this returns
 * `pendingAfter` so the caller knows whether to update.
 */
export function resolveInjuryFromMessage(
  message: string,
  pending: PendingInjury | null,
  now: number = Date.now(),
  ttlMs: number = PENDING_INJURY_TTL_MS,
): ResolveOutcome {
  // (a) Direct context — body part + severity in this message, OR
  //     severity + injury signal with no body part token (bodyPart='unknown').
  const direct: InjuryContext | null = extractInjuryContext(message);
  if (direct) {
    return {
      kind: 'resolved',
      resolved: {
        bodyPart: direct.bodyPart,
        severity: direct.severity,
        bucket: direct.bucket,
        source: 'message',
      },
      pendingAfter: null,
    };
  }

  // (b) Severity-only follow-up. Try to merge with pending.
  // We use the broader `parsePendingSeverity` here because pending
  // means we explicitly asked for a 1–10 rating — bare numbers like
  // "9" should bind even though parseSeverityNumber rejects them.
  const severityOnly = parsePendingSeverity(message);
  if (severityOnly == null) {
    // Not a severity reply at all — leave pending alone (caller decides
    // whether to abandon on fall-through).
    return { kind: 'no_match', pendingAfter: pending };
  }

  if (pending == null) {
    // "6/10" with no prior context — should fall through to LLM.
    return { kind: 'no_match', pendingAfter: null };
  }

  const isFresh = now - pending.timestamp <= ttlMs;
  if (!isFresh) {
    return { kind: 'stale_cleared', pendingAfter: null };
  }

  // Canonicalise the bodyPart → InjuryBucket here so every consumer
  // gets the same answer. Returning bucket=null when the body part is
  // a KNOWN alias was the root cause of the live "future weeks not
  // filtered" bug — the activeInjury seed was using bucket from this
  // resolution, the resolver-level filter then had no bucket to act
  // on, and next week kept showing Deadlifts/Nordics for hamstring.
  const canonicalBucket = resolveInjuryBucket(pending.bodyPart);
  if (!canonicalBucket && pending.bodyPart && pending.bodyPart !== 'unknown') {
    // Loud dev signal: a known body-part alias should never resolve
    // to a null bucket. If you hit this, add the alias to
    // BODY_PART_TO_BUCKET in programAdjustmentEngine.ts.
    logger.warn('[injury-context] canonicalization_failed', {
      rawBodyPart: pending.bodyPart,
      reason: 'unknown alias — add to BODY_PART_TO_BUCKET',
    });
  }
  logger.debug('[injury-context] canonicalized', {
    rawBodyPart: pending.bodyPart,
    canonicalBucket,
    severity: severityOnly,
    source: 'pending',
  });
  return {
    kind: 'resolved',
    resolved: {
      bodyPart: pending.bodyPart,
      severity: severityOnly,
      bucket: canonicalBucket,
      source: 'pending',
    },
    pendingAfter: null,
  };
}

/**
 * Decide whether `message` is a NEW injury report for a body part that
 * differs from `activeInjury.bodyPart`. When true, the active-injury
 * follow-up logic must NOT consume the message — it's a new injury,
 * not a hammy → hammy update.
 *
 *   activeInjury = hamstring 6/10
 *   message = "knee is sore"   → true  (different body part)
 *   message = "9"              → false (no body part to compare)
 *   message = "hammy still cooked" → false (same body part)
 *
 * Used by CoachScreen.handleSend to gate the active-injury follow-up
 * block. Pure: no I/O, no store reads.
 */
export function isDifferentBodyPartInjuryReport(
  message: string,
  activeInjury: InjuryState | null | undefined,
): boolean {
  if (!activeInjury || activeInjury.status === 'resolved') return false;
  if (!message || typeof message !== 'string') return false;
  const messageBodyPart = extractBodyPart(message);
  if (!messageBodyPart) return false;
  return (
    messageBodyPart.toLowerCase() !== (activeInjury.bodyPart || '').toLowerCase()
  );
}

/**
 * Decide whether `message` is a "severity-only" follow-up that should
 * bind to a fresh pendingInjuryRef. When true, the caller MUST consume
 * pending and skip the active-injury follow-up block — otherwise the
 * progression logic will hijack a severity reply meant for a NEW
 * injury.
 *
 * Returns false when:
 *   - message contains an injury context (body part + severity together)
 *   - message has no severity number at all
 *   - pending is null or stale (TTL expired)
 */
export function shouldBindSeverityToPending(
  message: string,
  pending: PendingInjury | null,
  now: number = Date.now(),
  ttlMs: number = PENDING_INJURY_TTL_MS,
): boolean {
  if (!pending) return false;
  if (now - pending.timestamp > ttlMs) return false;
  if (!message || typeof message !== 'string') return false;
  const direct = extractInjuryContext(message);
  if (direct) return false; // full injury context — not a severity-only reply
  // If the message names a different body part (even without an injury
  // signal), don't auto-bind — let the new-injury flow take over.
  const messageBodyPart = extractBodyPart(message);
  if (
    messageBodyPart &&
    messageBodyPart.toLowerCase() !== pending.bodyPart.toLowerCase()
  ) {
    return false;
  }
  const severity = parsePendingSeverity(message);
  return severity != null;
}
