/**
 * pendingCoachClarifierStore.ts — single-slot in-memory store for the
 * "I asked the athlete a question, now their next reply must answer it"
 * handoff between two coach turns.
 *
 * THE PROBLEM
 *
 *   Athlete: "Can you change to a bike?"
 *   Coach:   "Which session should I switch?"   (clarify — no target bound)
 *   Athlete: "The Wednesday one"
 *
 * Without a pending-clarifier slot, that third message classifies as
 * `mode: conversation` (no operation verbs, no obvious target on its own),
 * falls through to legacy /coach-chat, and the legacy path either returns
 * a hallucinated structural action or chats about Wednesday's session
 * without applying anything.
 *
 * THE FIX
 *
 * When the executor returns `kind: 'clarify'` for a mutate-mode command,
 * we capture the operation + partial payload + scope + asked question +
 * original message into THIS store. On the next user turn, the screen
 * checks the store BEFORE running the router — if a fresh entry exists
 * and the new message looks like an answer (resolves a target via day
 * name / pronoun / modality), we splice payload + target into a complete
 * mutate command and run the executor directly. Cancel verbs ("never
 * mind" / "cancel" / "forget it") clear the slot without applying.
 *
 * BOUNDARY
 *
 *   • Single slot — only the most recent unresolved clarifier matters.
 *     A new clarifier overwrites the old one.
 *   • In-memory only — DO NOT persist. A pending question from yesterday
 *     must NOT silently bind today's "yes please" to last night's swap.
 *   • TTL — entries older than 10 minutes are treated as missing.
 *   • Pure data — no resolver / executor calls inside this module.
 */

import { create } from 'zustand';
import type { CoachMutateOperation, CoachMutatePayload, CoachCommandScope } from '../utils/coachCommandRouter';

/**
 * How long a pending clarifier is treated as "still on the table".
 * 10 minutes — covers a brief pause without anchoring a stale prompt
 * forever.
 */
export const PENDING_CLARIFIER_TTL_MS = 10 * 60 * 1000;

export interface PendingCoachClarifier {
  /** The operation the router wanted to run before it asked. */
  operation: CoachMutateOperation;
  /**
   * The fields of the eventual payload the router already knew
   * (e.g. `from='rower' to='bike' bikeLabel=null` for a modality swap).
   * Always partial — the missing pieces are listed in `missingFields`.
   */
  partialPayload: Partial<CoachMutatePayload> & { operation: CoachMutateOperation };
  /** Scope of the eventual command (one_off / this_week / recurring / permanent). */
  scope: CoachCommandScope;
  /** Structured names of the missing pieces (e.g. ['target_session']). */
  missingFields: string[];
  /** The user's original mutation request — for transaction logs. */
  originalMessage: string;
  /** The clarifier question the coach actually asked. */
  askedQuestion: string;
  /** ms since epoch — used for TTL. */
  createdAt: number;
}

interface PendingCoachClarifierState {
  pending: PendingCoachClarifier | null;
  /** Stash a new pending clarifier (overwrites any previous one). */
  setPending: (entry: Omit<PendingCoachClarifier, 'createdAt'> & { createdAt?: number }) => void;
  /** Clear the slot. */
  clearPending: () => void;
}

export const usePendingCoachClarifierStore = create<PendingCoachClarifierState>()((set) => ({
  pending: null,
  setPending: (entry) =>
    set({
      pending: {
        operation: entry.operation,
        partialPayload: entry.partialPayload,
        scope: entry.scope,
        missingFields: entry.missingFields,
        originalMessage: entry.originalMessage,
        askedQuestion: entry.askedQuestion,
        createdAt: entry.createdAt ?? Date.now(),
      },
    }),
  clearPending: () => set({ pending: null }),
}));

/**
 * Imperative getter — returns the live pending entry with TTL applied.
 * Anything older than `PENDING_CLARIFIER_TTL_MS` is treated as missing.
 */
export function getPendingClarifierSnapshot(
  now: number = Date.now(),
): PendingCoachClarifier | null {
  const p = usePendingCoachClarifierStore.getState().pending;
  if (!p) return null;
  if (now - p.createdAt > PENDING_CLARIFIER_TTL_MS) return null;
  return p;
}

/**
 * Cancel verbs that ABORT a pending clarifier instead of resuming it.
 * Stays narrow: words/phrases the athlete uses to back out, not ambiguous
 * "no" replies that could be the actual answer to a yes/no question.
 */
const CANCEL_PATTERNS: RegExp[] = [
  /\bnever\s*mind\b/i,
  /\bnvm\b/i,
  /\bforget\s+(it|that)\b/i,
  /\bcancel\s+(it|that)\b/i,
  /\bnah\s*,?\s*(actually|forget|skip)\b/i,
  /\bdon'?t\s+(bother|worry)\b/i,
  /\bskip\s+(it|that)\b/i,
];

export function isCancelClarifierMessage(message: string): boolean {
  if (!message) return false;
  const trimmed = message.trim();
  for (const r of CANCEL_PATTERNS) {
    if (r.test(trimmed)) return true;
  }
  return false;
}

/**
 * Affirmative-only replies that don't carry a concrete target. When a
 * clarifier was asked ("Which session?") and the next message is a bare
 * "Yes" / "Yeah" / "Sure", the answer is meaningless — the pending
 * question is still unanswered. We must keep the truth gate closed
 * around legacy and instead restate the question so the athlete can
 * give a concrete answer.
 *
 * Bounds:
 *   • Bare affirmative tokens only — "yes please change Wednesday" is
 *     NOT bare (resolver should have bound a target from "Wednesday").
 *   • Trailing whitespace / single punctuation tolerated.
 */
const AFFIRMATIVE_PATTERNS: RegExp[] = [
  /^\s*(?:yes|yeah|yep|yup|yh|sure|ok|okay|aye|please|please\s+do|sounds\s+good|do\s+it|go\s+ahead)\s*[.!?]*\s*$/i,
];

export function isAffirmativeClarifierMessage(message: string): boolean {
  if (!message) return false;
  const trimmed = message.trim();
  if (!trimmed) return false;
  for (const r of AFFIRMATIVE_PATTERNS) {
    if (r.test(trimmed)) return true;
  }
  return false;
}

/**
 * Bare-negative replies. Treated like cancel — drop the pending slot
 * and reply with a soft acknowledgement. Kept distinct from
 * `isCancelClarifierMessage` because that one matches longer
 * "never mind / forget it" phrasing; this one catches single-word
 * "no" answers to a yes/no clarifier.
 */
const NEGATIVE_PATTERNS: RegExp[] = [
  /^\s*(?:no|nope|nah|no\s+thanks|don'?t|leave\s+it)\s*[.!?]*\s*$/i,
];

export function isNegativeClarifierMessage(message: string): boolean {
  if (!message) return false;
  const trimmed = message.trim();
  if (!trimmed) return false;
  for (const r of NEGATIVE_PATTERNS) {
    if (r.test(trimmed)) return true;
  }
  return false;
}
