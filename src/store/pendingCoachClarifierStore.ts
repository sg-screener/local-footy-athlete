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
import type { CoachMutateOperation, CoachMutatePayload, CoachCommandScope, CoachMoveScope } from '../utils/coachCommandRouter';
import type { ProgramEdit, ProgramEditCandidateItem } from '../utils/coachProgramEdit';
import type { ProgramEditDraft } from '../utils/coachProgramEditDraft';
import type {
  CoachRevisionIntent,
  CoachRevisionProposal,
} from '../utils/coachRevisionProposal';
import type { ProgramEditRiskAssessment } from '../utils/programEditRiskAssessment';
import type { DayOfWeek } from '../types/domain';

/**
 * How long a pending clarifier is treated as "still on the table".
 * 10 minutes — covers a brief pause without anchoring a stale prompt
 * forever.
 */
export const PENDING_CLARIFIER_TTL_MS = 10 * 60 * 1000;

export interface PendingScheduleSessionSnapshot {
  date?: string;
  day?: DayOfWeek;
  sessionName?: string;
  summary?: string;
  itemTitles?: string[];
}

export interface PendingScheduleCandidateDate {
  date: string;
  day: DayOfWeek;
  sessionName?: string;
  isPast?: boolean;
}

export interface PendingMoveSessionTransaction {
  kind: 'move_session_transaction';
  originalUserMessage: string;
  sourceDate?: string;
  sourceDay?: DayOfWeek;
  sourceSessionSnapshot?: PendingScheduleSessionSnapshot;
  targetDate?: string;
  targetDay?: DayOfWeek;
  scope: CoachMoveScope;
  missingFields: string[];
  candidateDates?: PendingScheduleCandidateDate[];
  createdFromVisibleWeek: boolean;
  currentStep:
    | 'resolve_source'
    | 'resolve_target'
    | 'resolve_scope'
    | 'resolve_conflict'
    | 'resolve_week_context'
    | 'confirm'
    | 'ready';
}

export interface PendingAddToDateTransaction {
  kind: 'add_to_date_transaction';
  originalUserMessage: string;
  action: 'add';
  targetDate?: string;
  targetDow?: DayOfWeek;
  targetStatus: 'rest' | 'empty' | 'existing_session' | 'unknown';
  addType: 'conditioning' | 'strength' | 'recovery' | 'session' | 'unknown';
  overrideType?: 'one_off_extra';
  setupChange: boolean;
  sessionType?: string;
  prescription?: Record<string, unknown>;
  missingFields: string[];
  candidateOptions?: string[];
  createdFromVisibleWeek: boolean;
  currentStep:
    | 'resolve_target'
    | 'resolve_add_type'
    | 'resolve_scope'
    | 'resolve_existing_target'
    | 'confirm'
    | 'ready';
}

export type PendingScheduleTransaction =
  | PendingMoveSessionTransaction
  | PendingAddToDateTransaction;

export type PendingClarificationExpectedAnswerType =
  | 'date'
  | 'session'
  | 'item'
  | 'scope'
  | 'type'
  | 'duration'
  | 'confirmation'
  | 'unknown';

export interface PendingClarificationProposedCandidate {
  label: string;
  value: string;
  answerType: PendingClarificationExpectedAnswerType;
}

export type PendingProgramEditDraftSource = 'semantic' | 'deterministic';

export interface PendingProgramEditDraftEnvelope {
  draft: ProgramEditDraft;
  source: PendingProgramEditDraftSource;
  originalUserWording: string;
  continuationId: string;
}

/** One clarification round in a revision transaction: what was asked, and the
 *  athlete's raw answer once it arrives. Accumulated so resumed turns always
 *  regenerate from ORIGINAL wording + every answered slot, never from the
 *  latest short reply alone. */
export interface PendingCoachRevisionClarification {
  missingField: string;
  question: string;
  answer: string | null;
}

export interface PendingCoachRevisionProposalEnvelope {
  source: 'semantic';
  originalUserWording: string;
  continuationId: string;
  /** Null when the transaction began from a clarify response that carried no
   *  partial intent. Filled/refined as rounds progress. */
  partialIntent: CoachRevisionIntent | null;
  /** Full proposal when the transaction began from a validated revision
   *  (e.g. stale-date). Null for clarify-origin transactions. */
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }> | null;
  /** Accumulated clarification rounds, oldest first. The last entry has
   *  answer: null while its question is outstanding. */
  clarifications?: PendingCoachRevisionClarification[];
  /** Risk warning accepted/awaiting acceptance for this exact proposal. */
  riskConfirmation?: {
    signature: string;
    assessment: ProgramEditRiskAssessment;
  };
}

export interface PendingClarificationSlot {
  originalIntent: string;
  missingField: string;
  expectedAnswerType: PendingClarificationExpectedAnswerType;
  source?: PendingProgramEditDraftSource;
  continuationId?: string;
  originalUserWording?: string;
  staleDate?: string;
  requestedDow?: DayOfWeek;
  proposedCandidate?: PendingClarificationProposedCandidate;
  candidateOptions?: string[];
  partialDraft?: ProgramEditDraft;
  partialCoachRevision?: PendingCoachRevisionProposalEnvelope;
  partialTransaction?: PendingScheduleTransaction;
  reason?: string;
}

export type PendingClarificationAnswerKind =
  | 'accept_proposed'
  | 'reject_proposed'
  | 'choose_candidate'
  | 'provide_alternative_value'
  | 'unclear';

export interface PendingClarificationAnswerClassification {
  kind: PendingClarificationAnswerKind;
  confidence: number;
  candidate?: PendingClarificationProposedCandidate;
  reason: string;
}

export interface PendingClarificationAnswerInput {
  message: string;
  pendingClarification?: PendingClarificationSlot | null;
  askedQuestion?: string | null;
}

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
  /** Typed scope answer for whole-day move clarifiers. */
  moveScope?: CoachMoveScope;
  /** Transaction state for multi-turn schedule edits. */
  scheduleTransaction?: PendingScheduleTransaction;
  /** Structured names of the missing pieces (e.g. ['source_date']). */
  missingFields: string[];
  /** The user's original mutation request — for transaction logs. */
  originalMessage: string;
  /** The clarifier question the coach actually asked. */
  askedQuestion: string;
  /** ms since epoch — used for TTL. */
  createdAt: number;
  /** Optional: the resolved target date from the original turn.
   *  Used by placeholder clarifiers (mutation_like_no_payload) so the
   *  follow-up can bind to the same session without re-resolving. */
  targetDate?: string;
  /** Optional: the session name at targetDate. */
  targetSessionName?: string;
  /** Structured edit contract the coach was trying to complete. When
   *  present, the next user reply is resolved against this object before
   *  the fresh router/LLM path is allowed to run. */
  programEdit?: ProgramEdit;
  /** Full typed draft transaction. When present, pending answers patch this
   *  draft instead of rebuilding intent from the short reply. */
  programEditDraftEnvelope?: PendingProgramEditDraftEnvelope;
  /** Full revision proposal transaction. When present, pending answers patch
   *  the missing slot and regenerate a revised visible snapshot from the
   *  original user wording instead of rebuilding intent from the short reply. */
  coachRevisionProposalEnvelope?: PendingCoachRevisionProposalEnvelope;
  /** Snapshot of visible candidates shown/considered when the question
   *  was asked. The next reply is matched against this before any fresh
   *  state read, so clarification answers do not drift. */
  candidateItems?: ProgramEditCandidateItem[];
  /** Durable slot contract for the next answer. This is the generic
   *  “fill this missing field first” hook before routing/ProgramEdit/legacy
   *  get to reinterpret the reply. */
  pendingClarification?: PendingClarificationSlot;
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
        moveScope: entry.moveScope,
        scheduleTransaction: entry.scheduleTransaction,
        missingFields: entry.missingFields,
        originalMessage: entry.originalMessage,
        askedQuestion: entry.askedQuestion,
        createdAt: entry.createdAt ?? Date.now(),
        targetDate: entry.targetDate,
        targetSessionName: entry.targetSessionName,
        programEdit: entry.programEdit,
        programEditDraftEnvelope: entry.programEditDraftEnvelope,
        coachRevisionProposalEnvelope: entry.coachRevisionProposalEnvelope,
        candidateItems: entry.candidateItems,
        pendingClarification: entry.pendingClarification,
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
  /\bleave\s+(it|that)\b/i,
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

export function classifyPendingClarificationAnswer(
  input: PendingClarificationAnswerInput,
): PendingClarificationAnswerClassification {
  const slot = input.pendingClarification;
  const message = String(input.message ?? '');
  const normalized = normalizePendingAnswer(message);
  if (!slot || !normalized) {
    return {
      kind: 'unclear',
      confidence: 0,
      reason: 'no_pending_slot_or_empty_answer',
    };
  }

  const explicitCandidate = matchPendingClarificationCandidate(normalized, slot);
  if (explicitCandidate) {
    if (candidateIsRejectOption(explicitCandidate)) {
      return {
        kind: 'reject_proposed',
        confidence: 0.95,
        candidate: explicitCandidate,
        reason: 'explicit_reject_candidate',
      };
    }
    return {
      kind: 'choose_candidate',
      confidence: 0.95,
      candidate: explicitCandidate,
      reason: 'explicit_candidate_match',
    };
  }

  if (isCancelClarifierMessage(message) || isNegativeClarifierMessage(message)) {
    return {
      kind: 'reject_proposed',
      confidence: 0.9,
      reason: 'obvious_negative_or_cancel_answer',
    };
  }

  if (looksLikeAlternativePendingValue(normalized, slot)) {
    return {
      kind: 'provide_alternative_value',
      confidence: 0.75,
      reason: 'answer_contains_alternative_value',
    };
  }

  if (isObviousPendingAffirmation(normalized)) {
    if (slot.proposedCandidate) {
      return {
        kind: 'accept_proposed',
        confidence: 0.9,
        candidate: slot.proposedCandidate,
        reason: 'obvious_accepts_proposed_candidate',
      };
    }
    const candidates = pendingClarificationCandidates(slot);
    if (candidates.length === 1) {
      return {
        kind: 'choose_candidate',
        confidence: 0.85,
        candidate: candidates[0],
        reason: 'obvious_accepts_single_candidate',
      };
    }
    return {
      kind: 'unclear',
      confidence: 0.35,
      reason: 'affirmative_without_single_candidate',
    };
  }

  return {
    kind: 'unclear',
    confidence: 0.2,
    reason: 'needs_semantic_pending_answer_classifier',
  };
}

function pendingClarificationCandidates(
  slot: PendingClarificationSlot,
): PendingClarificationProposedCandidate[] {
  const candidates: PendingClarificationProposedCandidate[] = [];
  if (slot.proposedCandidate) candidates.push(slot.proposedCandidate);
  for (const option of slot.candidateOptions ?? []) {
    if (!option) continue;
    if (slot.proposedCandidate && normalizePendingAnswer(option) === normalizePendingAnswer(slot.proposedCandidate.label)) {
      continue;
    }
    candidates.push({
      label: option,
      value: option,
      answerType: slot.expectedAnswerType,
    });
  }
  return candidates;
}

function matchPendingClarificationCandidate(
  normalized: string,
  slot: PendingClarificationSlot,
): PendingClarificationProposedCandidate | null {
  for (const candidate of pendingClarificationCandidates(slot)) {
    const label = normalizePendingAnswer(candidate.label);
    const value = normalizePendingAnswer(candidate.value);
    if (!label && !value) continue;
    if (label && (normalized === label || normalized.includes(label))) {
      return candidate;
    }
    if (value && value !== label && (normalized === value || normalized.includes(value))) {
      return candidate;
    }
  }
  return null;
}

function candidateIsRejectOption(candidate: PendingClarificationProposedCandidate): boolean {
  const text = normalizePendingAnswer(`${candidate.label} ${candidate.value}`);
  return /\b(?:leave|unchanged|cancel|no change|keep as is)\b/.test(text);
}

function looksLikeAlternativePendingValue(
  normalized: string,
  slot: PendingClarificationSlot,
): boolean {
  if (slot.expectedAnswerType === 'date') {
    return /\b(?:today|tomorrow|next|upcoming|future|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/.test(normalized);
  }
  if (slot.expectedAnswerType === 'duration') {
    return /\b\d+(?:\.\d+)?\s*(?:s|sec|secs|second|seconds|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/.test(normalized);
  }
  return false;
}

function isObviousPendingAffirmation(normalized: string): boolean {
  const compact = normalized.replace(/[.!?]+$/g, '').trim();
  if (!compact) return false;
  if (/^(?:y(?:es|eah|ep|up)?|ok(?:ay)?|correct|right|affirmative|please)$/.test(compact)) {
    return true;
  }
  if (/^(?:sounds|looks|that(?: is|'s)|this(?: is|'s))\s+(?:good|right|correct|fine|okay|ok)$/.test(compact)) {
    return true;
  }
  if (/^(?:(?:do|use|choose|go\s+with)\s+)?(?:that|this|it|that\s+one|this\s+one)$/.test(compact)) {
    return true;
  }
  return false;
}

function normalizePendingAnswer(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
