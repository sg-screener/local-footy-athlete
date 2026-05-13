/**
 * coachClarifierResume.ts — pure helper that reconstructs a complete
 * mutate `CoachCommand` from a stashed `PendingCoachClarifier` + the
 * fresh `CoachReferenceResolution` for the athlete's current message.
 *
 * THE CONTRACT
 *
 *   captureFromExecutorClarify(routedCommand, executorResult, originalMessage)
 *     → PendingCoachClarifier | null
 *       (only emits a slot for mutate-mode ops that have a missing target;
 *        permanent-preference ops never need a "which session" follow-up.)
 *
 *   resumeFromPending(pending, newMessage, newResolution)
 *     → CoachCommand | null
 *       (returns a complete `mode: 'mutate'` command with target +
 *        full payload + needsClarification=false when the new message
 *        binds a fresh target; null when the new message can't be
 *        interpreted as an answer.)
 *
 * Both helpers are PURE — no store reads, no logger noise. The screen
 * is responsible for stashing / clearing the pending entry, and for
 * running the resumed command through the executor.
 */

import type {
  CoachCommand,
  CoachMutatePayload,
  CoachCommandTarget,
  CoachCommandScope,
  CoachMutateOperation,
} from './coachCommandRouter';
import type { CoachReferenceResolution } from './coachReferenceResolver';
import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';

/**
 * Operations that can be resumed by binding a target session via the
 * resolver's date / explicit day output.
 *
 * RULE: if the router ever emits an op with `needsClarification=true`, the
 * op MUST be in this set. Otherwise the next user message falls through to
 * legacy /coach-chat — which has no tools to honour the resumed mutation
 * and will hallucinate a structural reply.
 *
 * Permanent-preference ops (set_conditioning_modality_preference,
 * set_bike_subtype_preference) are included here even though strictly
 * speaking they don't need a "which session?" answer to be applied. The
 * router asks anyway when it can't resolve a recent target — to give the
 * orchestrator a session to verify the projection against — so the resume
 * path must accept the answer rather than drop it.
 *
 * `undo_last_change` is included for symmetry: if a future variant of the
 * router asks "which change should I undo?", the answer must resume here.
 */
const RESUMABLE_OPS: ReadonlySet<CoachMutateOperation> = new Set([
  'swap_conditioning_modality_once',
  'set_conditioning_modality_preference',
  'set_bike_subtype_preference',
  'add_conditioning',
  'remove_conditioning',
  'replace_exercise',
  'move_session',
  'undo_last_change',
]);

export interface CaptureClarifierInput {
  /** The mutate-mode command the router emitted (with needsClarification=true). */
  routedCommand: CoachCommand;
  /** The clarifier question the executor returned to the screen. */
  askedQuestion: string;
  /** The athlete's original mutation request. */
  originalMessage: string;
  /** Optional structured list of fields the executor reported missing. */
  missingFields?: string[];
}

/**
 * Decide whether to stash a pending clarifier when the executor returned
 * `kind: 'clarify'`. Returns the entry (without `createdAt`) or null when
 * the operation isn't resumable — the screen drops the slot in that case.
 */
export function captureFromExecutorClarify(
  input: CaptureClarifierInput,
): Omit<PendingCoachClarifier, 'createdAt'> | null {
  const cmd = input.routedCommand;
  if (cmd.mode !== 'mutate') return null;
  if (!RESUMABLE_OPS.has(cmd.operation)) return null;
  return {
    operation: cmd.operation,
    partialPayload: cmd.payload as Partial<CoachMutatePayload> & { operation: CoachMutateOperation },
    scope: cmd.scope,
    missingFields: input.missingFields ?? cmd.missingFields ?? ['target_session'],
    originalMessage: input.originalMessage,
    askedQuestion: input.askedQuestion,
  };
}

export interface ResumeFromPendingInput {
  pending: PendingCoachClarifier;
  /** The athlete's NEW message (the one answering the clarifier). */
  newMessage: string;
  /** Resolution for the new message — must contain a resolved target. */
  newResolution: CoachReferenceResolution | null;
}

/**
 * Attempt to splice the new resolved target into the pending payload
 * and return a complete mutate CoachCommand. Returns null when:
 *
 *   • The new resolution didn't bind a target.
 *   • The pending operation isn't resumable.
 *   • The op needs a destination date (move_session) but the new
 *     resolution only carries a source date.
 */
export function resumeFromPending(
  input: ResumeFromPendingInput,
): CoachCommand | null {
  const { pending, newMessage, newResolution } = input;
  if (!newResolution || newResolution.status !== 'resolved' || !newResolution.target) {
    return null;
  }
  if (!RESUMABLE_OPS.has(pending.operation)) {
    return null;
  }
  const targetDate = newResolution.target.date;
  const target: CoachCommandTarget = {
    kind: 'date',
    date: targetDate,
    sessionName: newResolution.target.sessionName,
  };

  const op = pending.operation;
  const scope: CoachCommandScope = pending.scope;
  const partial = pending.partialPayload;

  // Build a fully-typed payload by op. Each branch validates the
  // already-stashed fields are present — anything still missing means
  // the pending capture was malformed (defensive null return).
  switch (op) {
    case 'swap_conditioning_modality_once': {
      const p = partial as Partial<{ from: any; to: any; bikeLabel: any }>;
      if (!p.to) return null;
      const payload: CoachMutatePayload = {
        operation: 'swap_conditioning_modality_once',
        from: p.from ?? null,
        to: p.to,
        bikeLabel: p.bikeLabel ?? null,
      };
      return makeMutate(op, target, payload, scope, newMessage);
    }
    case 'set_conditioning_modality_preference': {
      const p = partial as Partial<{ from: any; to: any; bikeLabel: any }>;
      if (!p.to) return null;
      const payload: CoachMutatePayload = {
        operation: 'set_conditioning_modality_preference',
        from: p.from ?? null,
        to: p.to,
        bikeLabel: p.bikeLabel ?? null,
      };
      return makeMutate(op, target, payload, scope, newMessage);
    }
    case 'set_bike_subtype_preference': {
      const p = partial as Partial<{ bikeLabel: any }>;
      if (!p.bikeLabel) return null;
      const payload: CoachMutatePayload = {
        operation: 'set_bike_subtype_preference',
        bikeLabel: p.bikeLabel,
      };
      return makeMutate(op, target, payload, scope, newMessage);
    }
    case 'undo_last_change': {
      const payload: CoachMutatePayload = {
        operation: 'undo_last_change',
      };
      // undo_last_change is keyed off `last_change`, not the new target.
      // The newResolution gave us a session, but the canonical target for
      // an undo command is `last_change` — preserve it.
      const undoTarget: CoachCommandTarget = { kind: 'last_change' };
      return makeMutate(op, undoTarget, payload, scope, newMessage);
    }
    case 'add_conditioning': {
      const p = partial as Partial<{ modality: any; durationMinutes: number }>;
      const payload: CoachMutatePayload = {
        operation: 'add_conditioning',
        modality: p.modality ?? null,
        durationMinutes: p.durationMinutes,
      };
      return makeMutate(op, target, payload, scope, newMessage);
    }
    case 'remove_conditioning': {
      const p = partial as Partial<{ modality: any }>;
      const payload: CoachMutatePayload = {
        operation: 'remove_conditioning',
        modality: p.modality ?? null,
      };
      return makeMutate(op, target, payload, scope, newMessage);
    }
    case 'replace_exercise': {
      const p = partial as Partial<{ fromExercise: string; toExercise: string | null }>;
      if (!p.fromExercise) return null;
      const payload: CoachMutatePayload = {
        operation: 'replace_exercise',
        fromExercise: p.fromExercise,
        toExercise: p.toExercise ?? null,
      };
      // replace_exercise needs target.kind = 'exercise'
      const exTarget: CoachCommandTarget = {
        kind: 'exercise',
        date: targetDate,
        exerciseName: p.fromExercise,
      };
      return makeMutate(op, exTarget, payload, scope, newMessage);
    }
    case 'move_session': {
      const p = partial as Partial<{ toDate: string; toDow: number; swap: boolean; swapWithDow: number }>;
      // For move_session, the new message resolves the SOURCE day.
      // The destination must already be present in the partial payload.
      if (!p.toDate && p.toDow == null && !p.swap) return null;
      const payload: CoachMutatePayload = {
        operation: 'move_session',
        toDate: p.toDate,
        toDow: p.toDow,
        swap: p.swap,
        swapWithDow: p.swapWithDow,
      };
      return makeMutate(op, target, payload, scope, newMessage);
    }
    default:
      return null;
  }
}

function makeMutate(
  operation: CoachMutateOperation,
  target: CoachCommandTarget,
  payload: CoachMutatePayload,
  scope: CoachCommandScope,
  newMessage: string,
): CoachCommand {
  return {
    mode: 'mutate',
    operation,
    target,
    payload,
    scope,
    confidence: 0.85,
    needsClarification: false,
    reason: `resumed_from_pending_clarifier:${operation}`,
    missingFields: [],
    // We deliberately do NOT include the clarification question — the
    // command is now complete. The original message is preserved
    // upstream in transaction logs / mutation history via the executor's
    // userMessage arg.
    clarificationQuestion: undefined,
  } as CoachCommand;
}
