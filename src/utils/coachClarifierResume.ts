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

import {
  extractAddConditioningIntent,
  type CoachCommand,
  type CoachCommandTarget,
  type CoachCommandScope,
  type CoachMutatePayload,
  type CoachMutateOperation,
} from './coachCommandRouter';
import type { CoachReferenceResolution } from './coachReferenceResolver';
import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';
import { parseCoachDurationMinutes } from './coachValueNormalizers';
import type { ProgramEdit, ProgramEditCandidateItem } from './coachProgramEdit';

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
  'add_session',
  'add_conditioning',
  'remove_session',
  'remove_conditioning',
  'replace_exercise',
  'move_session',
  'undo_last_change',
]);

export interface CaptureClarifierInput {
  /** The command the router emitted (mutate with needsClarification, or clarify). */
  routedCommand: CoachCommand;
  /** The clarifier question the executor returned to the screen. */
  askedQuestion: string;
  /** The athlete's original mutation request. */
  originalMessage: string;
  /** Optional structured list of fields the executor reported missing. */
  missingFields?: string[];
  /** Pre-resolved reference — used for mode='clarify' captures where
   *  the router already bound a target but lacked an operation. */
  referenceResolution?: CoachReferenceResolution | null;
  /** Incomplete structured edit contract that produced the clarifier. */
  programEdit?: ProgramEdit;
  /** Visible item snapshot captured with the clarifier. */
  candidateItems?: ProgramEditCandidateItem[];
}

/**
 * Decide whether to stash a pending clarifier when the executor returned
 * `kind: 'clarify'`. Returns the entry (without `createdAt`) or null when
 * the operation isn't resumable — the screen drops the slot in that case.
 *
 * Also handles mode='clarify' commands (mutation_like_no_payload) by
 * capturing a swap_conditioning_modality_once placeholder so the
 * follow-up turn can resume instead of falling to legacy.
 */
export function captureFromExecutorClarify(
  input: CaptureClarifierInput,
): Omit<PendingCoachClarifier, 'createdAt'> | null {
  const cmd = input.routedCommand;

  // ─── mode='mutate' capture (existing path) ────────────────────
  if (cmd.mode === 'mutate') {
    if (!RESUMABLE_OPS.has(cmd.operation)) return null;
    const targetDate =
      cmd.target.kind === 'date' || cmd.target.kind === 'exercise'
        ? cmd.target.date
        : undefined;
    const targetSessionName =
      cmd.target.kind === 'date'
        ? cmd.target.sessionName
        : undefined;
    return {
      operation: cmd.operation,
      partialPayload: cmd.payload as Partial<CoachMutatePayload> & { operation: CoachMutateOperation },
      scope: cmd.scope,
      missingFields: input.missingFields ?? cmd.missingFields ?? ['target_session'],
      originalMessage: input.originalMessage,
      askedQuestion: input.askedQuestion,
      targetDate,
      targetSessionName,
      programEdit: input.programEdit,
      candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
    };
  }

  // ─── mode='clarify' capture (new path) ────────────────────────
  // When the router returned mode='clarify' for a mutation-like turn
  // that has a resolved target (e.g. "Can we change the conditioning
  // today?" → target resolved to today but no operation detected),
  // capture a placeholder pending so the follow-up ("longer session",
  // "lighter", "skip") can resume instead of falling to legacy.
  if (cmd.mode === 'clarify' && input.referenceResolution?.target) {
    const reason = cmd.reason ?? '';
    if (reason === 'add_conditioning_missing_activity') {
      return {
        operation: 'add_conditioning',
        partialPayload: {
          operation: 'add_conditioning',
          modality: null,
        },
        scope: 'one_off',
        missingFields: ['activity'],
        originalMessage: input.originalMessage,
        askedQuestion: input.askedQuestion,
        targetDate: input.referenceResolution.target.date,
        targetSessionName: input.referenceResolution.target.sessionName,
        programEdit: input.programEdit,
        candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
      };
    }
    if (reason === 'mutation_like_no_payload' || reason === 'mutation_like_no_target') {
      return {
        operation: 'swap_conditioning_modality_once',
        partialPayload: {
          operation: 'swap_conditioning_modality_once',
          from: null,
          to: null as any,
          bikeLabel: null,
        },
        scope: 'one_off',
        missingFields: ['operation', 'payload'],
        originalMessage: input.originalMessage,
        askedQuestion: input.askedQuestion,
        targetDate: input.referenceResolution.target.date,
        targetSessionName: input.referenceResolution.target.sessionName,
        programEdit: input.programEdit,
        candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
      };
    }
  }

  return null;
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
 *   • The new resolution didn't bind a target (unless the pending is
 *     a placeholder with missingFields=['operation','payload']).
 *   • The pending operation isn't resumable.
 *   • The op needs a destination date (move_session) but the new
 *     resolution only carries a source date.
 */
export function resumeFromPending(
  input: ResumeFromPendingInput,
): CoachCommand | null {
  const { pending, newMessage, newResolution } = input;

  // ─── Placeholder pending (mutation_like_no_payload) ────────────
  // The previous turn was "What change would you like?" with a known
  // target. The follow-up ("longer session", "lighter", "skip") is
  // the answer. Re-route through the router with the saved original
  // message + new answer combined, using the stashed target.
  if (
    pending.missingFields.includes('operation') &&
    pending.missingFields.includes('payload')
  ) {
    return resumePlaceholderPending(pending, newMessage);
  }

  if (
    pending.operation === 'add_conditioning' &&
    pending.missingFields.includes('activity') &&
    pending.targetDate
  ) {
    return resumeAddConditioningActivityPending(pending, newMessage);
  }

  if (
    pending.operation === 'add_conditioning' &&
    pending.targetDate &&
    pending.missingFields.some((field) =>
      /^(?:duration|durationMinutes|minutes|time)$/.test(field),
    )
  ) {
    return resumeAddConditioningDurationPending(pending, newMessage);
  }

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
    case 'add_session': {
      const p = partial as Partial<{ sourceDate: string; sourceSessionName: string; targetSessionName: string; reason: string }>;
      if (!p.sourceSessionName) return null;
      const payload: CoachMutatePayload = {
        operation: 'add_session',
        sourceDate: p.sourceDate,
        sourceSessionName: p.sourceSessionName,
        targetSessionName: p.targetSessionName ?? p.sourceSessionName,
        reason: p.reason,
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
    case 'remove_session': {
      const p = partial as Partial<{ targetSessionId: string | null; reason: string }>;
      const payload: CoachMutatePayload = {
        operation: 'remove_session',
        targetSessionId: p.targetSessionId ?? null,
        reason: p.reason,
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
  reason?: string,
): CoachCommand {
  return {
    mode: 'mutate',
    operation,
    target,
    payload,
    scope,
    confidence: 0.85,
    needsClarification: false,
    reason: reason ?? `resumed_from_pending_clarifier:${operation}`,
    missingFields: [],
    clarificationQuestion: undefined,
  } as CoachCommand;
}

// ─── Placeholder resume ────────────────────────────────────────────
// When the previous turn was a generic "What change would you like?"
// clarify (mutation_like_no_payload), the follow-up is the user's
// answer describing what they want. Map common short answers to
// concrete operations so they don't fall to legacy.

const ANSWER_TO_OP: Array<{
  re: RegExp;
  operation: CoachMutateOperation;
  payloadFn: (message: string) => CoachMutatePayload;
}> = [
  // Duration / volume increase
  {
    re: /\b(?:longer|more\s+(?:volume|time|work)|increase\s+(?:duration|length|time)|extend|bigger)\b/i,
    operation: 'add_conditioning',
    payloadFn: () => ({ operation: 'add_conditioning', modality: null }),
  },
  // Lighter / easier
  {
    re: /\b(?:lighter|easier|less\s+(?:intense|volume|load)|dial\s+(?:it\s+)?(?:back|down)|tone\s+(?:it\s+)?down)\b/i,
    operation: 'remove_conditioning',
    payloadFn: () => ({ operation: 'remove_conditioning', modality: null }),
  },
  // Harder / more intense
  {
    re: /\b(?:harder|tougher|more\s+intense|ramp\s+(?:it\s+)?up|step\s+(?:it\s+)?up)\b/i,
    operation: 'add_conditioning',
    payloadFn: () => ({ operation: 'add_conditioning', modality: null }),
  },
  // Light recovery walk
  {
    re: /\b(?:light|easy|recovery)?\s*walk(?:ing)?\b/i,
    operation: 'add_conditioning',
    payloadFn: () => ({ operation: 'add_conditioning', modality: 'walk' as any }),
  },
  // Light off-feet conditioning add-ons
  {
    re: /\b(?:light|easy|recovery|gentle)\s+(?:bike|cycle|spin)\b/i,
    operation: 'add_conditioning',
    payloadFn: () => ({
      operation: 'add_conditioning',
      modality: 'bike' as any,
      customActivity: 'Light Bike',
      intensity: 'light',
    } as any),
  },
  // Low-load freeform add-ons
  {
    re: /\b(?:pilates|yoga|mobility|stretch(?:ing)?|foam\s*roll(?:ing)?|prehab|activation)\b/i,
    operation: 'add_conditioning',
    payloadFn: (message) => {
      const label = /\byoga\b/i.test(message) ? 'Yoga'
        : /\bmobility\b/i.test(message) ? 'Mobility'
        : /\bstretch(?:ing)?\b/i.test(message) ? 'Stretching'
        : /\bfoam\s*roll(?:ing)?\b/i.test(message) ? 'Foam Rolling'
        : /\bprehab\b/i.test(message) ? 'Prehab'
        : /\bactivation\b/i.test(message) ? 'Activation'
        : 'Pilates';
      return {
        operation: 'add_conditioning',
        modality: null,
        customActivity: label,
        intensity: 'light',
      } as any;
    },
  },
  // Different exercise
  {
    re: /\b(?:different\s+exercise|swap\s+(?:an?\s+)?exercise|replace\s+(?:an?\s+)?exercise|substitute)\b/i,
    operation: 'replace_exercise',
    payloadFn: () => ({ operation: 'replace_exercise', fromExercise: '__placeholder__', toExercise: null }),
  },
  // Skip / remove
  {
    re: /\b(?:skip|remove|drop|cancel|take\s+(?:it\s+)?(?:out|off)|cut)\b/i,
    operation: 'remove_conditioning',
    payloadFn: () => ({ operation: 'remove_conditioning', modality: null }),
  },
  // Different day
  {
    re: /\b(?:different\s+day|move\s+(?:it|the\s+session)|reschedule)\b/i,
    operation: 'move_session',
    payloadFn: () => ({ operation: 'move_session' }),
  },
  // Modality swap (bike, rower, run, etc.)
  {
    re: /\b(?:bike|row(?:er)?|run(?:ning)?|ski|swim|cycling)\b/i,
    operation: 'swap_conditioning_modality_once',
    payloadFn: () => ({ operation: 'swap_conditioning_modality_once', from: null, to: 'bike' as any, bikeLabel: null }),
  },
];

function resumePlaceholderPending(
  pending: PendingCoachClarifier,
  newMessage: string,
): CoachCommand | null {
  if (!pending.targetDate) return null;
  const target: CoachCommandTarget = {
    kind: 'date',
    date: pending.targetDate,
    sessionName: pending.targetSessionName ?? 'session',
  };

  for (const { re, operation, payloadFn } of ANSWER_TO_OP) {
    if (re.test(newMessage)) {
      return makeMutate(operation, target, payloadFn(newMessage), pending.scope, newMessage);
    }
  }
  return null;
}

function resumeAddConditioningActivityPending(
  pending: PendingCoachClarifier,
  newMessage: string,
): CoachCommand | null {
  if (!pending.targetDate) return null;
  const payload = addConditioningPayloadFromAnswer(newMessage);
  if (!payload) return null;
  const target: CoachCommandTarget = {
    kind: 'date',
    date: pending.targetDate,
    sessionName: pending.targetSessionName ?? 'session',
  };
  return makeMutate('add_conditioning', target, payload, pending.scope, newMessage);
}

function resumeAddConditioningDurationPending(
  pending: PendingCoachClarifier,
  newMessage: string,
): CoachCommand | null {
  if (!pending.targetDate) return null;
  const durationMinutes = parseDurationMinutesAnswer(newMessage);
  if (durationMinutes == null) return null;

  const partial = pending.partialPayload as Partial<Extract<
    CoachMutatePayload,
    { operation: 'add_conditioning' }
  >>;
  const target: CoachCommandTarget = {
    kind: 'date',
    date: pending.targetDate,
    sessionName: pending.targetSessionName ?? 'session',
  };
  const payload: CoachMutatePayload = {
    operation: 'add_conditioning',
    modality: partial.modality ?? null,
    customActivity: titleForDurationUpdate(
      partial.customActivity,
      durationMinutes,
      partial.modality ?? null,
      partial.bikeLabel,
    ),
    intensity: partial.intensity,
    durationMinutes,
    sets: partial.sets,
    repsMin: partial.repsMin,
    repsMax: partial.repsMax,
    restSeconds: partial.restSeconds,
    prescriptionType: partial.prescriptionType,
    bikeLabel: partial.bikeLabel,
    effortKind: partial.effortKind,
    replaceActivity: partial.replaceActivity ?? partial.customActivity,
    trainingIntent: partial.trainingIntent,
    changeKind: partial.changeKind,
    editMode: 'update_existing',
  };
  return makeMutate(
    'add_conditioning',
    target,
    payload,
    pending.scope,
    newMessage,
    'pending_duration_answer',
  );
}

function addConditioningPayloadFromAnswer(message: string): CoachMutatePayload | null {
  const intent = extractAddConditioningIntent(message, { requireAddVerb: false });
  if (!intent) return null;

  return {
    operation: 'add_conditioning',
    modality: intent.modality,
    customActivity: intent.customActivity,
    intensity: intent.intensity,
    durationMinutes: intent.durationMinutes,
    bikeLabel: intent.bikeLabel,
    effortKind: intent.effortKind,
  } as CoachMutatePayload;
}

function parseDurationMinutesAnswer(message: string): number | null {
  return parseCoachDurationMinutes(message, { allowBareNumber: true });
}

function titleForDurationUpdate(
  title: string | undefined,
  durationMinutes: number,
  modality: unknown,
  bikeLabel: unknown,
): string | undefined {
  const source = String(title ?? '').trim();
  if (!source) return undefined;
  const durationToken = `${durationMinutes}min`;
  if (/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/i.test(source)) {
    return source.replace(/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/ig, durationToken);
  }
  if (/\bEasy\s+Aerobic\s+Flush\b/i.test(source)) {
    const mode = durationModeLabel(modality, bikeLabel);
    return mode ? `Easy Aerobic Flush (${durationToken} ${mode})` : source;
  }
  return source;
}

function durationModeLabel(modality: unknown, bikeLabel: unknown): string | null {
  if (modality === 'bike') return bikeLabel === 'assault' ? 'Assault Bike' : 'Bike';
  if (modality === 'ski') return 'SkiErg';
  if (modality === 'row' || modality === 'rower') return 'Rower';
  if (modality === 'run') return 'Run';
  if (modality === 'swim') return 'Swim';
  return null;
}
