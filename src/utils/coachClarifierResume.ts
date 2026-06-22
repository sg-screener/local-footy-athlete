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
  type CoachMoveScope,
} from './coachCommandRouter';
import type { CoachReferenceResolution } from './coachReferenceResolver';
import type {
  PendingCoachClarifier,
  PendingAddToDateTransaction,
  PendingMoveSessionTransaction,
  PendingScheduleTransaction,
} from '../store/pendingCoachClarifierStore';
import { parseCoachDurationMinutes } from './coachValueNormalizers';
import type { ProgramEdit, ProgramEditCandidateItem } from './coachProgramEdit';
import type { DayOfWeek } from '../types/domain';

type MoveSessionCommand = Extract<CoachCommand, { mode: 'mutate' }> & {
  operation: 'move_session';
  payload: Extract<CoachMutatePayload, { operation: 'move_session' }>;
};

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
  /** Today's date, used for contextual clarifiers without an explicit text target. */
  todayISO?: string;
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
    const rawMissingFields =
      input.missingFields ?? cmd.missingFields ?? (cmd.operation === 'move_session' ? [] : ['target_session']);
    const missingFields =
      cmd.operation === 'move_session'
        ? normaliseMoveSessionMissingFields({
            fields: rawMissingFields,
            cmd: cmd as MoveSessionCommand,
            askedQuestion: input.askedQuestion,
            originalMessage: input.originalMessage,
          })
        : rawMissingFields;
    const scheduleTransaction =
      cmd.operation === 'move_session'
        ? buildMoveSessionTransactionFromCommand({
            cmd: cmd as MoveSessionCommand,
            missingFields,
            originalMessage: input.originalMessage,
            askedQuestion: input.askedQuestion,
            targetDate,
            targetSessionName,
            candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
          })
        : undefined;
    const partialPayload =
      cmd.operation === 'move_session' && scheduleTransaction?.kind === 'move_session_transaction'
        ? {
            ...(cmd.payload as Extract<CoachMutatePayload, { operation: 'move_session' }>),
            fromDow: scheduleTransaction.sourceDay
              ? dowFromDayName(scheduleTransaction.sourceDay)
              : (cmd.payload as Extract<CoachMutatePayload, { operation: 'move_session' }>).fromDow,
            toDow: scheduleTransaction.targetDay
              ? dowFromDayName(scheduleTransaction.targetDay)
              : (cmd.payload as Extract<CoachMutatePayload, { operation: 'move_session' }>).toDow,
            toDate: scheduleTransaction.targetDate ??
              (cmd.payload as Extract<CoachMutatePayload, { operation: 'move_session' }>).toDate,
          }
        : (cmd.payload as Partial<CoachMutatePayload> & { operation: CoachMutateOperation });
    return {
      operation: cmd.operation,
      partialPayload: partialPayload as Partial<CoachMutatePayload> & { operation: CoachMutateOperation },
      scope: cmd.scope,
      moveScope:
        cmd.payload.operation === 'move_session'
          ? cmd.payload.moveScope
          : undefined,
      scheduleTransaction,
      missingFields,
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
    if (/^vague_load_request_game_day/i.test(reason)) {
      return {
        operation: 'add_conditioning',
        partialPayload: {
          operation: 'add_conditioning',
          modality: null,
        },
        scope: 'one_off',
        missingFields: ['game_day_readiness_choice'],
        originalMessage: input.originalMessage,
        askedQuestion: input.askedQuestion,
        targetDate: input.referenceResolution.target.date,
        targetSessionName: input.referenceResolution.target.sessionName,
        programEdit: input.programEdit,
        candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
      };
    }
    if (reason === 'add_conditioning_missing_activity') {
      if (/\bsession\b/i.test(input.originalMessage)) {
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
      const targetDate =
        input.referenceResolution.target.date ??
        input.programEdit?.targetDate ??
        parseAddTargetDate(input.originalMessage, input.todayISO);
      const missingFields = targetDate ? ['add_type'] : ['target_date', 'add_type'];
      return {
        operation: 'add_session',
        partialPayload: {
          operation: 'add_session',
        },
        scope: 'one_off',
        scheduleTransaction: buildAddToDateTransaction({
          originalMessage: input.originalMessage,
          targetDate,
          addType: 'unknown',
          missingFields,
          createdFromVisibleWeek: !!input.referenceResolution.target,
        }),
        missingFields,
        originalMessage: input.originalMessage,
        askedQuestion: input.askedQuestion,
        targetDate,
        targetSessionName: input.referenceResolution.target.sessionName,
        programEdit: input.programEdit,
        candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
      };
    }
    if (reason === 'add_conditioning_missing_target_and_activity') {
      const targetDate =
        input.programEdit?.targetDate ??
        parseAddTargetDate(input.originalMessage, input.todayISO);
      const missingFields = targetDate ? ['add_type'] : ['target_date', 'add_type'];
      return {
        operation: 'add_session',
        partialPayload: {
          operation: 'add_session',
        },
        scope: 'one_off',
        scheduleTransaction: buildAddToDateTransaction({
          originalMessage: input.originalMessage,
          targetDate,
          addType: 'unknown',
          missingFields,
          createdFromVisibleWeek: false,
        }),
        missingFields,
        originalMessage: input.originalMessage,
        askedQuestion: input.askedQuestion,
        targetDate,
        targetSessionName: input.programEdit?.targetItemTitle ?? undefined,
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

  if (
    cmd.mode === 'clarify' &&
    (cmd.reason ?? '') === 'add_conditioning_missing_target_and_activity'
  ) {
    const targetDate =
      input.programEdit?.targetDate ??
      parseAddTargetDate(input.originalMessage, input.todayISO);
    const missingFields = targetDate ? ['add_type'] : ['target_date', 'add_type'];
    return {
      operation: 'add_session',
      partialPayload: {
        operation: 'add_session',
      },
      scope: 'one_off',
      scheduleTransaction: buildAddToDateTransaction({
        originalMessage: input.originalMessage,
        targetDate,
        addType: 'unknown',
        missingFields,
        createdFromVisibleWeek: false,
      }),
      missingFields,
      originalMessage: input.originalMessage,
      askedQuestion: input.askedQuestion,
      targetDate,
      targetSessionName: input.programEdit?.targetItemTitle ?? undefined,
      programEdit: input.programEdit,
      candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
    };
  }

  if (
    cmd.mode === 'clarify' &&
    /^vague_load_request_game_day/i.test(cmd.reason ?? '') &&
    input.todayISO
  ) {
    return {
      operation: 'add_conditioning',
      partialPayload: {
        operation: 'add_conditioning',
        modality: null,
      },
      scope: 'one_off',
      missingFields: ['game_day_readiness_choice'],
      originalMessage: input.originalMessage,
      askedQuestion: input.askedQuestion,
      targetDate: input.programEdit?.targetDate ?? input.todayISO,
      targetSessionName: 'Game Day',
      programEdit: input.programEdit,
      candidateItems: input.candidateItems ?? input.programEdit?.candidateItems,
    };
  }

  return null;
}

function normaliseMoveSessionMissingFields(args: {
  fields: string[];
  cmd: MoveSessionCommand;
  askedQuestion?: string;
  originalMessage?: string;
}): string[] {
  const payload = args.cmd.payload.operation === 'move_session' ? args.cmd.payload : null;
  const asked = String(args.askedQuestion ?? '').toLowerCase();
  const parsedPair = parseMoveDayPair(args.originalMessage ?? '');
  if (parsedPair) {
    const sourceMatches =
      args.cmd.target.kind === 'date' && dayNameFromISO(args.cmd.target.date) === parsedPair.sourceDay;
    const targetMatches =
      !!payload &&
      ((typeof payload.toDow === 'number' && dayNameFromDow(payload.toDow) === parsedPair.targetDay) ||
        (!!payload.toDate && dayNameFromISO(payload.toDate) === parsedPair.targetDay));
    if (!sourceMatches) return ['source_date'];
    if (!targetMatches) return ['target_date'];
  }
  const mapped = args.fields.flatMap((field) => {
    switch (field) {
      case 'destination_day':
      case 'destination_date':
        return ['target_date'];
      case 'move_scope':
        return ['target_scope'];
      case 'target_conflict':
        return ['conflict_resolution'];
      case 'target_session':
        if (/\bwhere\b[\s\S]*\bmove\b|\bmove\b[\s\S]*\bto\b/.test(asked)) {
          return ['target_date'];
        }
        if (/\bwhich\b[\s\S]*(?:session|workout)\b/.test(asked)) {
          return ['source_session'];
        }
        return ['source_date'];
      default:
        return [field];
    }
  });
  if (mapped.length > 0) return uniqueFields(mapped);
  if (!payload) return ['source_date'];
  const hasSource = args.cmd.target.kind === 'date';
  const hasTarget = !!payload.toDate || typeof payload.toDow === 'number';
  if (!hasSource) return ['source_date'];
  if (!hasTarget) return ['target_date'];
  if (payload.toDate && args.cmd.target.kind === 'date' && payload.toDate === args.cmd.target.date) {
    return ['target_date'];
  }
  return ['confirmation'];
}

function normaliseMoveSessionPendingFields(pending: PendingCoachClarifier): string[] {
  if (pending.operation !== 'move_session' || pending.partialPayload.operation !== 'move_session') {
    return pending.missingFields ?? [];
  }
  const target: CoachCommandTarget = pending.targetDate
    ? { kind: 'date', date: pending.targetDate, sessionName: pending.targetSessionName }
    : { kind: 'unbound' };
  const cmd = {
    mode: 'mutate',
    operation: 'move_session',
    target,
    payload: pending.partialPayload,
    scope: pending.scope,
    confidence: 0,
    needsClarification: true,
    reason: 'pending_move_session_legacy_shape',
  } as MoveSessionCommand;
  return normaliseMoveSessionMissingFields({
    fields: pending.missingFields ?? [],
    cmd,
    askedQuestion: pending.askedQuestion,
    originalMessage: pending.originalMessage,
  });
}

function buildMoveSessionTransactionFromCommand(args: {
  cmd: MoveSessionCommand;
  missingFields: string[];
  originalMessage: string;
  askedQuestion?: string;
  targetDate?: string;
  targetSessionName?: string;
  candidateItems?: ProgramEditCandidateItem[];
}): PendingMoveSessionTransaction | undefined {
  const payload = args.cmd.payload.operation === 'move_session' ? args.cmd.payload : null;
  if (!payload) return undefined;
  const parsedPair = parseMoveDayPair(args.originalMessage);
  const hasMissingSource =
    args.missingFields.includes('source_date') ||
    args.missingFields.includes('source_session');
  const hasMissingTarget =
    args.missingFields.includes('target_date') ||
    args.missingFields.includes('destination_date');
  const targetDateMatchesParsedSource =
    !parsedPair ||
    !args.targetDate ||
    dayNameFromISO(args.targetDate) === parsedPair.sourceDay;
  const sourceDate = hasMissingSource
    ? undefined
    : targetDateMatchesParsedSource
      ? args.targetDate
      : undefined;
  const sourceDow =
    parsedPair?.sourceDay
      ? dowFromDayName(parsedPair.sourceDay)
      : typeof payload.fromDow === 'number'
      ? payload.fromDow
      : args.targetDate
        ? new Date(`${args.targetDate}T12:00:00`).getDay()
        : null;
  const targetDow =
    parsedPair?.targetDay
      ? dowFromDayName(parsedPair.targetDay)
      : typeof payload.toDow === 'number'
      ? payload.toDow
      : payload.toDate
        ? new Date(`${payload.toDate}T12:00:00`).getDay()
        : null;
  const currentStep =
    hasMissingSource
      ? 'resolve_source'
      : hasMissingTarget
        ? 'resolve_target'
        : args.missingFields.includes('conflict_resolution') || args.missingFields.includes('target_conflict')
          ? 'resolve_conflict'
          : args.missingFields.includes('week_context')
            ? 'resolve_week_context'
        : args.missingFields.includes('target_scope') || args.missingFields.includes('move_scope')
          ? 'resolve_scope'
          : args.missingFields.includes('confirmation') || isMoveTransactionConfirmationQuestion(args.askedQuestion)
            ? 'confirm'
            : 'ready';
  const transactionMissingFields =
    currentStep === 'confirm'
      ? uniqueFields([...args.missingFields, 'confirmation'])
      : args.missingFields;
  return {
    kind: 'move_session_transaction',
    originalUserMessage: args.originalMessage,
    sourceDate,
    sourceDay: sourceDow != null ? dayNameFromDow(sourceDow) : undefined,
    sourceSessionSnapshot: {
      date: sourceDate,
      day: sourceDow != null ? dayNameFromDow(sourceDow) : undefined,
      sessionName: args.targetSessionName,
      summary: summariseScheduleSession(args.targetSessionName, args.candidateItems),
      itemTitles: args.candidateItems?.map((item) => item.title).filter(Boolean),
    },
    targetDate: payload.toDate,
    targetDay: targetDow != null ? dayNameFromDow(targetDow) : undefined,
    scope: payload.moveScope ?? (args.cmd.scope === 'recurring' ? 'recurring' : 'unknown'),
    missingFields: transactionMissingFields,
    candidateDates: [],
    createdFromVisibleWeek: !!args.targetDate,
    currentStep,
  };
}

function buildAddToDateTransaction(args: {
  originalMessage: string;
  targetDate?: string;
  addType: PendingAddToDateTransaction['addType'];
  missingFields: string[];
  createdFromVisibleWeek: boolean;
}): PendingAddToDateTransaction {
  const setupChange = isRecurringAddSetupIntent(args.originalMessage);
  return {
    kind: 'add_to_date_transaction',
    originalUserMessage: args.originalMessage,
    action: 'add',
    targetDate: args.targetDate,
    targetDow: args.targetDate ? dayNameFromISO(args.targetDate) : undefined,
    targetStatus: 'unknown',
    addType: args.addType,
    overrideType: setupChange ? undefined : 'one_off_extra',
    setupChange,
    missingFields: uniqueFields(args.missingFields),
    candidateOptions: ['Conditioning', 'Strength', 'Recovery', 'Named session'],
    createdFromVisibleWeek: args.createdFromVisibleWeek,
    currentStep: !args.targetDate
      ? 'resolve_target'
      : setupChange
      ? 'resolve_scope'
      : args.addType === 'unknown'
      ? 'resolve_add_type'
      : 'ready',
  };
}

function summariseScheduleSession(
  sessionName: string | undefined,
  items: ProgramEditCandidateItem[] | undefined,
): string | undefined {
  const base = (sessionName ?? '').trim();
  const titles = (items ?? [])
    .map((item) => String(item.title ?? '').trim())
    .filter(Boolean);
  const conditioning = (items ?? []).find((item) => item.domain === 'conditioning');
  if (conditioning?.title && base && conditioning.title.toLowerCase() !== base.toLowerCase()) {
    return `${base} + ${conditioning.title}`;
  }
  if (base) return base;
  if (titles.length > 0) return titles.slice(0, 2).join(' + ');
  return undefined;
}

export type PendingGameDayReadinessAnswer =
  | {
      kind: 'acknowledge_no_op';
      reply: string;
    }
  | {
      kind: 'adjust_recovery';
      reply: string;
    }
  | {
      kind: 'mark_limited';
      reply: string;
    };

export function resolvePendingGameDayReadinessAnswer(
  pending: PendingCoachClarifier,
  message: string,
): PendingGameDayReadinessAnswer | null {
  if (!isPendingGameDayReadinessClarifier(pending)) return null;
  const text = String(message ?? '').trim();
  if (!text) return null;

  if (/\badjust\b[\s\S]{0,40}\b(?:tomorrow|recovery|recover|mobility)\b/i.test(text)) {
    return {
      kind: 'adjust_recovery',
      reply:
        "How should I adjust tomorrow's recovery — keep it easy, shorten it to mobility, or remove it?",
    };
  }

  if (/\b(?:mark|set|log)\b[\s\S]{0,30}\b(?:limited|low\s+readiness|flat|managed)\b/i.test(text) || /^\s*limited\s*$/i.test(text)) {
    return {
      kind: 'mark_limited',
      reply:
        "Got it — I'll mark today as limited and leave the game day session unchanged.",
    };
  }

  if (isLeaveAsIsAnswer(text)) {
    return {
      kind: 'acknowledge_no_op',
      reply:
        "No worries — I'll leave today as game day. Let me know after the match if you want recovery adjusted.",
    };
  }

  return null;
}

function isPendingGameDayReadinessClarifier(pending: PendingCoachClarifier): boolean {
  if (pending.missingFields.includes('game_day_readiness_choice')) return true;
  const reason = pending.programEdit?.naturalLanguageReason ?? '';
  if (/^vague_load_request_game_day/i.test(reason)) return true;
  return (
    /\bgame day today\b/i.test(pending.askedQuestion) &&
    /\b(?:mark today as limited|leave the game as-is|adjust tomorrow'?s recovery)\b/i.test(pending.askedQuestion)
  );
}

function isLeaveAsIsAnswer(message: string): boolean {
  return (
    /\bleave\b[\s\S]{0,30}\b(?:today|game|it|things)?\s*(?:as[-\s]?is|unchanged)\b/i.test(message) ||
    /\bkeep\b[\s\S]{0,30}\b(?:today|game|it|things)?\s*(?:as[-\s]?is|unchanged)\b/i.test(message) ||
    /\b(?:don'?t|do\s+not)\s+change\s+(?:anything|it|today|the\s+game)\b/i.test(message) ||
    /\bno\s+changes?\b/i.test(message) ||
    /\bsee\s+how\s+(?:i|we)\s+go\b/i.test(message)
  );
}

function classifyMoveScopeAnswer(message: string): CoachMoveScope | null {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (
    /\b(?:just\s+this\s+week|this\s+week|today\s+only|just\s+this\s+once|this\s+once|one[-\s]?off|only\s+this\s+week)\b/i.test(
      text,
    )
  ) {
    return 'one_off';
  }
  if (
    /\b(?:every\s+week|each\s+week|going\s+forward|from\s+now\s+on|permanent(?:ly)?|ongoing|regular(?:ly)?)\b/i.test(
      text,
    )
  ) {
    return 'recurring';
  }
  return null;
}

function dayNameFromISO(iso: string): DayOfWeek {
  const dow = new Date(`${iso}T12:00:00`).getDay();
  const names: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return names[dow] ?? 'Monday';
}

function dayNameFromDow(dow: number): DayOfWeek {
  const names: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return names[dow] ?? 'Monday';
}

function dowFromDayName(day: DayOfWeek): number {
  return day === 'Sunday'
    ? 0
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day) + 1;
}

function nextISOForDay(todayISO: string, day: DayOfWeek): string {
  const t = new Date(`${todayISO}T12:00:00`);
  const todayDow = t.getDay();
  const targetDow = dowFromDayName(day);
  const delta = ((targetDow - todayDow) + 7) % 7 || 7;
  const d = new Date(t.getTime() + delta * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDayAnswer(message: string): { day: DayOfWeek; explicitNext: boolean } | null {
  const m = /\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i.exec(
    message,
  );
  if (!m) return null;
  const raw = m[2].toLowerCase();
  const day =
    raw.startsWith('mon') ? 'Monday' :
    raw.startsWith('tue') ? 'Tuesday' :
    raw.startsWith('wed') ? 'Wednesday' :
    raw.startsWith('thu') ? 'Thursday' :
    raw.startsWith('fri') ? 'Friday' :
    raw.startsWith('sat') ? 'Saturday' :
    'Sunday';
  return { day, explicitNext: !!m[1] };
}

function parseAddTargetDate(message: string, todayISO?: string): string | undefined {
  if (!todayISO) return undefined;
  const text = String(message ?? '');
  if (/\btoday\b/i.test(text)) return todayISO;
  if (/\btomorrow\b/i.test(text)) return addDaysISO(todayISO, 1);
  const day = parseDayAnswer(text);
  if (day) return nextISOForDay(todayISO, day.day);
  return undefined;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseMoveDayPair(message: string): { sourceDay: DayOfWeek; targetDay: DayOfWeek } | null {
  const day =
    '((?:next\\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun))';
  const move =
    new RegExp(
      `\\b(?:move|shift|push|reschedul\\w*|bump)\\s+(?:all\\s+of\\s+)?(?:my\\s+|the\\s+)?${day}(?:'s)?\\s*(?:session|workout|day)?\\s+(?:to|onto|on)\\s+${day}\\b`,
      'i',
    ).exec(message);
  if (move) {
    const source = parseDayAnswer(move[1]);
    const target = parseDayAnswer(move[2]);
    return source && target && source.day !== target.day
      ? { sourceDay: source.day, targetDay: target.day }
      : null;
  }
  const doOn =
    new RegExp(
      `\\b(?:can\\s+we\\s+)?(?:do|put)\\s+(?:all\\s+of\\s+)?(?:my\\s+|the\\s+)?${day}(?:'s)?\\s*(?:session|workout|day)?\\s+(?:on|to)\\s+${day}\\b`,
      'i',
    ).exec(message);
  if (doOn) {
    const source = parseDayAnswer(doOn[1]);
    const target = parseDayAnswer(doOn[2]);
    return source && target && source.day !== target.day
      ? { sourceDay: source.day, targetDay: target.day }
      : null;
  }
  const better =
    new RegExp(
      `\\b${day}\\s+(?:works\\s+better|is\\s+better|would\\s+be\\s+better)\\s+(?:than|instead\\s+of)\\s+${day}\\b`,
      'i',
    ).exec(message);
  if (better) {
    const target = parseDayAnswer(better[1]);
    const source = parseDayAnswer(better[2]);
    return source && target && source.day !== target.day
      ? { sourceDay: source.day, targetDay: target.day }
      : null;
  }
  return null;
}

function parseSessionSummaryAnswer(message: string): string | undefined {
  const equals = /=\s*([^.!?]+)$/i.exec(message);
  if (equals?.[1]?.trim()) return normaliseSummaryText(equals[1]);
  const session = /\b(?:session|workout)\s+(?:is|=)\s+([^.!?]+)$/i.exec(message);
  if (session?.[1]?.trim()) return normaliseSummaryText(session[1]);
  if (/\b(?:upper|lower|push|pull|squat|hinge|zone\s*2|row|bike|skierg|ski\s*erg|conditioning)\b/i.test(message)) {
    return normaliseSummaryText(message.replace(/\bnext\s+/i, '').replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i, ''));
  }
  return undefined;
}

function normaliseSummaryText(value: string): string | undefined {
  const cleaned = String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:=|is|it's|it is)\s*/i, '')
    .trim();
  if (!cleaned) return undefined;
  return cleaned
    .split(/\s+\+\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' + ');
}

export type PendingScheduleTransactionAnswer =
  | { kind: 'complete'; command: CoachCommand; transaction: PendingScheduleTransaction }
  | { kind: 'clarify'; transaction: PendingScheduleTransaction; reply: string; options?: string[] }
  | { kind: 'cancelled'; transaction: PendingScheduleTransaction; reply: string }
  | { kind: 'unresolved' };

export function resolvePendingScheduleTransactionAnswer(input: {
  pending: PendingCoachClarifier;
  userMessage: string;
  todayISO: string;
  currentWeek?: Array<{ date: string; sessionName?: string; workout?: unknown | null }>;
}): PendingScheduleTransactionAnswer {
  const rawTransaction =
    input.pending.scheduleTransaction ?? buildScheduleTransactionFromPending(input.pending, input.todayISO);
  const transaction = rawTransaction
    ? promoteMoveTransactionConfirmation(rawTransaction, input.pending)
    : null;
  if (!transaction) return { kind: 'unresolved' };
  if (transaction.kind === 'add_to_date_transaction') {
    return resolvePendingAddToDateTransactionAnswer(
      transaction,
      input.userMessage,
      input.todayISO,
      input.currentWeek ?? [],
    );
  }
  if (transaction.kind !== 'move_session_transaction') return { kind: 'unresolved' };
  return resolvePendingMoveSessionTransactionAnswer(transaction, input.userMessage, input.todayISO);
}

function buildScheduleTransactionFromPending(
  pending: PendingCoachClarifier,
  todayISO: string,
): PendingScheduleTransaction | null {
  if (pending.operation === 'move_session') return buildMoveSessionTransactionFromPending(pending);
  if (
    pending.operation === 'add_session' &&
    (pending.missingFields.includes('add_type') ||
      pending.missingFields.includes('activity') ||
      pending.missingFields.includes('target_date') ||
      pending.missingFields.includes('target_session'))
  ) {
    const targetDate =
      pending.targetDate ??
      parseAddTargetDate(pending.originalMessage, todayISO);
    const addType = classifyAddTypeAnswer(pending.originalMessage) ?? 'unknown';
    const missingFields = uniqueFields([
      ...(targetDate ? [] : ['target_date']),
      ...(addType === 'unknown' ? ['add_type'] : []),
    ]);
    return buildAddToDateTransaction({
      originalMessage: pending.originalMessage,
      targetDate,
      addType,
      missingFields,
      createdFromVisibleWeek: !!pending.targetDate,
    });
  }
  return null;
}

function resolvePendingAddToDateTransactionAnswer(
  transaction: PendingAddToDateTransaction,
  message: string,
  todayISO: string,
  currentWeek: Array<{ date: string; sessionName?: string; workout?: unknown | null }>,
): PendingScheduleTransactionAnswer {
  const targetDateAnswer = parseAddTargetDate(message, todayISO);
  const addTypeAnswer = classifyAddTypeAnswer(message);
  const addScopeAnswer = classifyAddScopeAnswer(message);
  const messageAsksForSetupChange = isRecurringAddSetupIntent(message);
  let next: PendingAddToDateTransaction = {
    ...transaction,
    missingFields: [...transaction.missingFields],
  };

  if (messageAsksForSetupChange || addScopeAnswer === 'recurring') {
    next = {
      ...next,
      setupChange: true,
      overrideType: undefined,
      currentStep: 'resolve_scope',
      missingFields: uniqueFields([...next.missingFields, 'setup_scope']),
    };
  } else if (addScopeAnswer === 'one_off') {
    next = {
      ...next,
      setupChange: false,
      overrideType: 'one_off_extra',
      missingFields: next.missingFields.filter((field) => field !== 'setup_scope'),
    };
  }

  if (targetDateAnswer) {
    next = {
      ...next,
      targetDate: targetDateAnswer,
      targetDow: dayNameFromISO(targetDateAnswer),
      missingFields: next.missingFields.filter((field) =>
        field !== 'target_date' && field !== 'target_session',
      ),
    };
  }
  if (addTypeAnswer && !(addScopeAnswer && next.addType !== 'unknown')) {
    next = {
      ...next,
      addType: addTypeAnswer,
      missingFields: next.missingFields.filter((field) =>
        field !== 'add_type' && field !== 'activity',
      ),
    };
  }
  if (!next.setupChange && !next.overrideType) {
    next = { ...next, overrideType: 'one_off_extra' };
  }

  const targetStatus = resolveAddTargetStatus(next.targetDate, currentWeek) ?? next.targetStatus;
  next = { ...next, targetStatus };

  if (!next.targetDate) {
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_target',
        missingFields: uniqueFields([...next.missingFields, 'target_date']),
      },
      reply: 'Which day should I add it to?',
      options: ['Today', 'Tomorrow'],
    };
  }

  if (next.addType === 'unknown') {
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_add_type',
        missingFields: uniqueFields([...next.missingFields, 'add_type']),
      },
      reply: 'What would you like to add: conditioning, strength, recovery, or a named session?',
      options: ['Conditioning', 'Strength', 'Recovery', 'Named session'],
    };
  }

  if (next.addType !== 'conditioning') {
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_add_type',
        missingFields: uniqueFields([...next.missingFields, 'add_type']),
      },
      reply: 'What would you like to add: conditioning, strength, recovery, or a named session?',
      options: ['Conditioning', 'Strength', 'Recovery', 'Named session'],
    };
  }

  if (next.setupChange) {
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_scope',
        missingFields: uniqueFields([...next.missingFields, 'setup_scope']),
      },
      reply:
        'Do you want this as a one-off extra session, or should I update your weekly setup and rebuild the program?',
      options: ['One-off extra session', 'Update weekly setup'],
    };
  }

  if (
    targetStatus === 'existing_session' &&
    next.currentStep !== 'resolve_existing_target'
  ) {
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_existing_target',
        missingFields: uniqueFields([...next.missingFields, 'target_mode']),
      },
      reply: `${dayNameFromISO(next.targetDate)} already has a session. Add conditioning to that session, or create a separate conditioning session?`,
      options: ['Add to existing session', 'Create separate conditioning', 'Cancel'],
    };
  }

  if (next.currentStep === 'resolve_existing_target') {
    const existingAnswer = classifyExistingTargetAddAnswer(message);
    if (existingAnswer === 'cancel') {
      return {
        kind: 'cancelled',
        transaction: next,
        reply: 'No worries — I left the plan unchanged.',
      };
    }
    if (existingAnswer === 'separate') {
      return {
        kind: 'clarify',
        transaction: next,
        reply: 'That day already has a session, so I can add conditioning to the existing session instead. Do you want me to do that?',
        options: ['Add to existing session', 'Cancel'],
      };
    }
    if (existingAnswer !== 'existing') {
      return {
        kind: 'clarify',
        transaction: next,
        reply: `${dayNameFromISO(next.targetDate)} already has a session. Add conditioning to that session, or cancel?`,
        options: ['Add to existing session', 'Cancel'],
      };
    }
  }

  const command = commandFromAddToDateTransaction({
    ...next,
    currentStep: 'ready',
    missingFields: [],
  }, message);
  return {
    kind: 'complete',
    command,
    transaction: {
      ...next,
      currentStep: 'ready',
      missingFields: [],
    },
  };
}

function resolvePendingMoveSessionTransactionAnswer(
  transaction: PendingMoveSessionTransaction,
  message: string,
  todayISO: string,
): PendingScheduleTransactionAnswer {
  let next: PendingMoveSessionTransaction = {
    ...transaction,
    missingFields: [...transaction.missingFields],
  };
  const scopeAnswer = classifyMoveScopeAnswer(message);
  const dayAnswer = parseDayAnswer(message);
  const summaryAnswer = parseSessionSummaryAnswer(message);

  if (
    next.currentStep !== 'resolve_week_context' &&
    next.createdFromVisibleWeek &&
    next.sourceDay &&
    next.targetDay &&
    ((next.sourceDate && next.sourceDate < todayISO) || (next.targetDate && next.targetDate < todayISO))
  ) {
    next = {
      ...next,
      currentStep: 'resolve_week_context',
      missingFields: uniqueFields([...next.missingFields, 'week_context']),
    };
  }

  if (next.currentStep !== 'resolve_week_context' && next.sourceDate && next.sourceDate < todayISO) {
    next = {
      ...next,
      sourceDate: undefined,
      sourceSessionSnapshot: {
        ...(next.sourceSessionSnapshot ?? {}),
        date: undefined,
      },
      missingFields: uniqueFields([...next.missingFields, 'source_date']),
      currentStep: 'resolve_source',
    };
  }

  if (next.currentStep !== 'resolve_week_context' && next.targetDate && next.targetDate < todayISO) {
    next = {
      ...next,
      targetDate: undefined,
      missingFields: uniqueFields([...next.missingFields, 'target_date']),
      currentStep: next.currentStep === 'resolve_source' ? 'resolve_source' : 'resolve_target',
    };
  }

  if (scopeAnswer) {
    next = {
      ...next,
      scope: scopeAnswer,
      missingFields: next.missingFields.filter((field) => field !== 'move_scope' && field !== 'target_scope'),
    };
  }

  if (next.currentStep === 'resolve_week_context' || next.missingFields.includes('week_context')) {
    const weekAnswer = classifyWeekContextAnswer(message);
    if (weekAnswer === 'upcoming' && next.sourceDay && next.targetDay) {
      const sourceDate = nextISOForDay(todayISO, next.sourceDay);
      const targetDate = nextISOForDay(todayISO, next.targetDay);
      next = {
        ...next,
        sourceDate,
        targetDate,
        sourceSessionSnapshot: {
          ...(next.sourceSessionSnapshot ?? {}),
          date: sourceDate,
          day: next.sourceDay,
        },
        currentStep: next.scope === 'unknown' ? 'resolve_scope' : 'confirm',
        missingFields: uniqueFields([
          ...next.missingFields.filter((field) => field !== 'week_context'),
          next.scope === 'unknown' ? 'target_scope' : 'confirmation',
        ]),
      };
    } else if (weekAnswer === 'current') {
      return {
        kind: 'cancelled',
        transaction: {
          ...next,
          currentStep: 'resolve_week_context',
          missingFields: uniqueFields([...next.missingFields, 'week_context']),
        },
        reply: "That currently viewed week includes a past date, so I can't change it. I left the plan unchanged.",
      };
    } else {
      return {
        kind: 'clarify',
        transaction: {
          ...next,
          currentStep: 'resolve_week_context',
          missingFields: uniqueFields([...next.missingFields, 'week_context']),
        },
        reply: weekContextClarifier(next),
        options: weekContextOptions(next),
      };
    }
  }

  const needsSourceDate =
    next.currentStep === 'resolve_source' ||
    next.missingFields.includes('source_date') ||
    !next.sourceDate;
  const needsTargetDate =
    next.currentStep === 'resolve_target' ||
    next.missingFields.includes('target_date') ||
    next.missingFields.includes('destination_date') ||
    !next.targetDate;

  const awaitingConfirmation =
    (next.currentStep === 'confirm' || next.missingFields.includes('confirmation')) &&
    !needsSourceDate &&
    !needsTargetDate;

  if (awaitingConfirmation) {
    const confirmationAnswer = classifyScheduleConfirmationAnswer(message);
    if (confirmationAnswer === 'cancel') {
      return {
        kind: 'cancelled',
        transaction: {
          ...next,
          currentStep: 'confirm',
          missingFields: uniqueFields([...next.missingFields, 'confirmation']),
        },
        reply: 'No worries — I left the plan unchanged.',
      };
    }
    if (confirmationAnswer === 'confirm') {
      const command = commandFromMoveTransaction(next, message);
      return {
        kind: 'complete',
        command,
        transaction: {
          ...next,
          currentStep: 'ready',
          missingFields: [],
        },
      };
    }
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'confirm',
        missingFields: uniqueFields([...next.missingFields, 'confirmation']),
      },
      reply: moveTransactionConfirmationPreview(next),
      options: ['Yes', 'No'],
    };
  }

  const resolvingTargetConflict =
    (next.currentStep === 'resolve_conflict' ||
      next.missingFields.includes('conflict_resolution') ||
      next.missingFields.includes('target_conflict')) &&
    !needsSourceDate &&
    !needsTargetDate;

  if (resolvingTargetConflict) {
    const targetConflictAnswer = classifyTargetConflictAnswer(message);
    if (targetConflictAnswer === 'cancel') {
      return {
        kind: 'cancelled',
        transaction: {
          ...next,
          currentStep: 'resolve_conflict',
          missingFields: uniqueFields([...next.missingFields, 'conflict_resolution']),
        },
        reply: 'No worries — I left the plan unchanged.',
      };
    }
    if (targetConflictAnswer === 'replace' || targetConflictAnswer === 'swap') {
      const command = commandFromMoveTransaction(next, message, {
        swap: targetConflictAnswer === 'swap',
      });
      return {
        kind: 'complete',
        command,
        transaction: {
          ...next,
          currentStep: 'ready',
          missingFields: [],
        },
      };
    }
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_conflict',
        missingFields: uniqueFields([...next.missingFields, 'conflict_resolution']),
      },
      reply: targetConflictClarifier(next),
      options: ['Replace', 'Swap the two days', 'Cancel'],
    };
  }

  if (dayAnswer && needsSourceDate) {
    const sourceDate = nextISOForDay(todayISO, dayAnswer.day);
    next = {
      ...next,
      sourceDate,
      sourceDay: dayAnswer.day,
      sourceSessionSnapshot: {
        ...(next.sourceSessionSnapshot ?? {}),
        date: sourceDate,
        day: dayAnswer.day,
        summary: summaryAnswer ?? next.sourceSessionSnapshot?.summary,
      },
      missingFields: next.missingFields.filter((field) => field !== 'source_date'),
      currentStep: next.scope === 'unknown' ? 'resolve_scope' : next.currentStep,
    };
  } else if (dayAnswer && needsTargetDate) {
    const targetDate = nextISOForDay(todayISO, dayAnswer.day);
    next = {
      ...next,
      targetDate,
      targetDay: dayAnswer.day,
      missingFields: next.missingFields.filter((field) =>
        field !== 'target_date' && field !== 'destination_date',
      ),
      currentStep: next.scope === 'unknown' ? 'resolve_scope' : next.currentStep,
    };
  } else if (summaryAnswer && needsSourceDate) {
    next = {
      ...next,
      sourceSessionSnapshot: {
        ...(next.sourceSessionSnapshot ?? {}),
        summary: summaryAnswer,
      },
    };
  }

  if (!next.sourceDate && next.scope === 'recurring' && next.sourceDay && (next.targetDay || next.targetDate)) {
    const command = commandFromMoveTransaction(next, message);
    return {
      kind: 'complete',
      command,
      transaction: {
        ...next,
        currentStep: 'ready',
        missingFields: [],
      },
    };
  }

  if (!next.sourceDate) {
    const reply = sourceDateClarifier(next);
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_source',
        missingFields: uniqueFields([...next.missingFields, 'source_date']),
      },
      reply,
      options: sourceDateOptions(next),
    };
  }

  if (!next.targetDate) {
    const reply = targetDateClarifier(next);
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_target',
        missingFields: uniqueFields([...next.missingFields, 'target_date']),
      },
      reply,
      options: targetDateOptions(next),
    };
  }

  if (
    next.scope === 'unknown' ||
    next.missingFields.includes('target_scope') ||
    next.missingFields.includes('move_scope')
  ) {
    const reply = moveTransactionScopePreview(next);
    return {
      kind: 'clarify',
      transaction: {
        ...next,
        currentStep: 'resolve_scope',
        missingFields: uniqueFields([...next.missingFields, 'target_scope']),
      },
      reply,
      options: ['Just this week', 'Every week going forward'],
    };
  }

  const command = commandFromMoveTransaction(next, message);
  return {
    kind: 'complete',
    command,
    transaction: {
      ...next,
      currentStep: 'ready',
      missingFields: [],
    },
  };
}

function buildMoveSessionTransactionFromPending(
  pending: PendingCoachClarifier,
): PendingMoveSessionTransaction | null {
  if (pending.operation !== 'move_session' || pending.partialPayload.operation !== 'move_session') {
    return null;
  }
  const payload = pending.partialPayload as Partial<Extract<CoachMutatePayload, { operation: 'move_session' }>> & {
    operation: 'move_session';
  };
  const missingFields = normaliseMoveSessionPendingFields(pending);
  const parsedPair = parseMoveDayPair(pending.originalMessage);
  const hasMissingSource =
    missingFields.includes('source_date') ||
    missingFields.includes('source_session');
  const targetDateMatchesParsedSource =
    !parsedPair ||
    !pending.targetDate ||
    dayNameFromISO(pending.targetDate) === parsedPair.sourceDay;
  const sourceDate = hasMissingSource
    ? undefined
    : targetDateMatchesParsedSource
      ? pending.targetDate
      : undefined;
  const sourceDow =
    parsedPair?.sourceDay
      ? dowFromDayName(parsedPair.sourceDay)
      : typeof payload.fromDow === 'number'
      ? payload.fromDow
      : sourceDate
        ? new Date(`${sourceDate}T12:00:00`).getDay()
        : null;
  const targetDow =
    parsedPair?.targetDay
      ? dowFromDayName(parsedPair.targetDay)
      : typeof payload.toDow === 'number'
      ? payload.toDow
      : payload.toDate
        ? new Date(`${payload.toDate}T12:00:00`).getDay()
        : null;
  const hasMissingTarget =
    missingFields.includes('target_date') ||
    missingFields.includes('destination_date');
  const currentStep =
    hasMissingSource
      ? 'resolve_source'
      : hasMissingTarget
        ? 'resolve_target'
        : missingFields.includes('conflict_resolution') || missingFields.includes('target_conflict')
          ? 'resolve_conflict'
          : missingFields.includes('week_context')
            ? 'resolve_week_context'
        : missingFields.includes('target_scope') || missingFields.includes('move_scope')
          ? 'resolve_scope'
          : missingFields.includes('confirmation') || isMoveTransactionConfirmationQuestion(pending.askedQuestion)
            ? 'confirm'
            : 'ready';
  const transactionMissingFields =
    currentStep === 'confirm'
      ? uniqueFields([...missingFields, 'confirmation'])
      : missingFields;
  return {
    kind: 'move_session_transaction',
    originalUserMessage: pending.originalMessage,
    sourceDate,
    sourceDay: sourceDow != null ? dayNameFromDow(sourceDow) : undefined,
    sourceSessionSnapshot: {
      date: sourceDate,
      day: sourceDow != null ? dayNameFromDow(sourceDow) : undefined,
      sessionName: pending.targetSessionName,
      summary: summariseScheduleSession(pending.targetSessionName, pending.candidateItems),
      itemTitles: pending.candidateItems?.map((item) => item.title).filter(Boolean),
    },
    targetDate: payload.toDate,
    targetDay: targetDow != null ? dayNameFromDow(targetDow) : undefined,
    scope: payload.moveScope ?? (pending.scope === 'recurring' ? 'recurring' : 'one_off'),
    missingFields: transactionMissingFields,
    candidateDates: [],
    createdFromVisibleWeek: !!sourceDate,
    currentStep,
  };
}

function promoteMoveTransactionConfirmation(
  transaction: PendingScheduleTransaction,
  pending: PendingCoachClarifier,
): PendingScheduleTransaction {
  if (transaction.kind !== 'move_session_transaction') return transaction;
  if (
    !pending.missingFields.includes('confirmation') &&
    !isMoveTransactionConfirmationQuestion(pending.askedQuestion)
  ) {
    return transaction;
  }
  if (transaction.currentStep !== 'ready' && transaction.currentStep !== 'confirm') {
    return transaction;
  }
  return {
    ...transaction,
    currentStep: 'confirm',
    missingFields: uniqueFields([...transaction.missingFields, 'confirmation']),
  };
}

function isMoveTransactionConfirmationQuestion(question: string | undefined): boolean {
  const text = String(question ?? '').trim();
  if (!text) return false;
  if (/\bjust\s+this\s+week\b|\bevery\s+week\s+going\s+forward\b/i.test(text)) return false;
  return /\bdo\s+you\s+want\b[\s\S]*\bmove\b/i.test(text) ||
    /\b(?:confirm|proceed)\b[\s\S]*\bmove\b/i.test(text);
}

function classifyScheduleConfirmationAnswer(message: string): 'confirm' | 'cancel' | null {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (
    /^\s*(?:yes|yeah|yep|yup|correct|that'?s\s+right|right|confirm|do\s+it|please\s+do|go\s+ahead|sure|ok|okay)(?:\s+please)?\s*[.!?]*\s*$/i.test(text)
  ) {
    return 'confirm';
  }
  if (
    /^\s*(?:no|nope|nah|cancel|cancel\s+(?:it|that)|don'?t|do\s+not|don'?t\s+do\s+it|nevermind|never\s+mind|leave\s+it|leave\s+it\s+as\s+is|no\s+changes?)\s*[.!?]*\s*$/i.test(text)
  ) {
    return 'cancel';
  }
  return null;
}

function classifyAddTypeAnswer(
  message: string,
): PendingAddToDateTransaction['addType'] | null {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (classifyAddScopeAnswer(text) === 'one_off') return null;
  if (/\b(?:conditioning|cardio|zone\s*2|aerobic|flush|sprints?|intervals?|bike|row|rower|skierg|ski\s*erg)\b/i.test(text)) {
    return 'conditioning';
  }
  if (/\b(?:strength|lift|lifting|gym|weights?|upper|lower|push|pull|squat|hinge|gunshow)\b/i.test(text)) {
    return 'strength';
  }
  if (/\b(?:recovery|mobility|stretch|rest|flush)\b/i.test(text)) {
    return 'recovery';
  }
  if (/\b(?:named\s+session|session|workout)\b/i.test(text)) {
    return 'session';
  }
  return null;
}

function isRecurringAddSetupIntent(message: string): boolean {
  return /\b(?:going\s+forward|from\s+now\s+on|every\s+(?:week|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|each\s+(?:week|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|weekly|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/i.test(
    String(message ?? ''),
  );
}

function classifyAddScopeAnswer(message: string): 'one_off' | 'recurring' | null {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (/\b(?:one[-\s]*off|just\s+today|today\s+only|just\s+this\s+once|extra\s+session|this\s+time\s+only)\b/i.test(text)) {
    return 'one_off';
  }
  if (isRecurringAddSetupIntent(text) || /\b(?:update\s+(?:my\s+)?weekly\s+setup|rebuild\s+the\s+program|make\s+it\s+regular)\b/i.test(text)) {
    return 'recurring';
  }
  return null;
}

function resolveAddTargetStatus(
  targetDate: string | undefined,
  currentWeek: Array<{ date: string; sessionName?: string; workout?: unknown | null }>,
): PendingAddToDateTransaction['targetStatus'] | undefined {
  if (!targetDate) return undefined;
  const day = currentWeek.find((candidate) => candidate.date === targetDate);
  if (!day) return undefined;
  if (!day.workout) return 'rest';
  const workout = day.workout as Record<string, unknown>;
  const name = String(workout.name ?? day.sessionName ?? '').toLowerCase();
  const type = String(workout.workoutType ?? '').toLowerCase();
  const removed = (workout as any).removed === true || /\b(?:rest|removed)\b/.test(name) || type === 'rest';
  return removed ? 'rest' : 'existing_session';
}

function classifyExistingTargetAddAnswer(message: string): 'existing' | 'separate' | 'cancel' | null {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (/^\s*(?:cancel|no|nope|nah|leave\s+it|never\s*mind|nevermind)\s*[.!?]*\s*$/i.test(text)) {
    return 'cancel';
  }
  if (/\b(?:existing|that\s+session|same\s+session|add\s+to|on\s+that|onto\s+that|with\s+that)\b/i.test(text)) {
    return 'existing';
  }
  if (/\b(?:separate|standalone|own\s+session|new\s+session)\b/i.test(text)) {
    return 'separate';
  }
  if (/^\s*(?:yes|yeah|yep|do\s+it|ok|okay|sure)\s*[.!?]*\s*$/i.test(text)) {
    return 'existing';
  }
  return null;
}

function uniqueFields(fields: string[]): string[] {
  return Array.from(new Set(fields));
}

function sourceDateClarifier(transaction: PendingMoveSessionTransaction): string {
  const sourceDay = transaction.sourceDay ?? 'that day';
  return `Which ${sourceDay} session do you mean — the next ${sourceDay}, or future ${sourceDay}s going forward?`;
}

function sourceDateOptions(transaction: PendingMoveSessionTransaction): string[] {
  const sourceDay = transaction.sourceDay ?? 'that day';
  return [`Next ${sourceDay}'s session`, `Future ${sourceDay}s going forward`];
}

function targetDateClarifier(transaction: PendingMoveSessionTransaction): string {
  const targetDay = transaction.targetDay ?? 'day';
  return `Which ${targetDay} should I move it to?`;
}

function targetDateOptions(transaction: PendingMoveSessionTransaction): string[] {
  const targetDay = transaction.targetDay ?? 'day';
  return [`Next ${targetDay}`];
}

function moveTransactionScopePreview(transaction: PendingMoveSessionTransaction): string {
  const sourceDay = transaction.sourceDay ?? (transaction.sourceDate ? dayNameFromISO(transaction.sourceDate) : 'that day');
  const targetDay = transaction.targetDay ?? (transaction.targetDate ? dayNameFromISO(transaction.targetDate) : 'the target day');
  const session = transaction.sourceSessionSnapshot?.summary
    ? `${transaction.sourceSessionSnapshot.summary} session`
    : 'whole session';
  return `Move ${sourceDay}'s ${session} to ${targetDay} - just this week, or every week going forward?`;
}

function moveTransactionConfirmationPreview(transaction: PendingMoveSessionTransaction): string {
  const sourceDay = transaction.sourceDay ?? (transaction.sourceDate ? dayNameFromISO(transaction.sourceDate) : 'that day');
  const targetDay = transaction.targetDay ?? (transaction.targetDate ? dayNameFromISO(transaction.targetDate) : 'the target day');
  const session = transaction.sourceSessionSnapshot?.summary ?? 'session';
  return `Move ${sourceDay}'s ${session} to ${targetDay} this week?`;
}

function targetConflictClarifier(transaction: PendingMoveSessionTransaction): string {
  const targetDay = transaction.targetDay ?? (transaction.targetDate ? dayNameFromISO(transaction.targetDate) : 'that day');
  return `${targetDay} already has a session. Do you want to replace it, swap the two days, or cancel?`;
}

function weekContextClarifier(transaction: PendingMoveSessionTransaction): string {
  const sourceDay = transaction.sourceDay ?? 'source day';
  const targetDay = transaction.targetDay ?? 'target day';
  return `${sourceDay} to ${targetDay} is in the currently viewed week, but at least one of those dates has passed. Do you mean the currently viewed week, or the next upcoming ${sourceDay} to ${targetDay}?`;
}

function weekContextOptions(transaction: PendingMoveSessionTransaction): string[] {
  const sourceDay = transaction.sourceDay ?? 'source day';
  const targetDay = transaction.targetDay ?? 'target day';
  return ['Currently viewed week', `Next upcoming ${sourceDay} to ${targetDay}`];
}

function classifyWeekContextAnswer(message: string): 'current' | 'upcoming' | null {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (/\b(?:next|upcoming|future)\b/i.test(text)) return 'upcoming';
  if (/\b(?:current|viewed|this\s+week|shown|selected)\b/i.test(text)) return 'current';
  return null;
}

function classifyTargetConflictAnswer(message: string): 'replace' | 'swap' | 'cancel' | null {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (/^\s*(?:cancel|no|nope|nah|leave\s+it|never\s*mind|nevermind)\s*[.!?]*\s*$/i.test(text)) {
    return 'cancel';
  }
  if (/\bswap\b|\bswitch\b|\btrade\b|\btwo\s+days\b/i.test(text)) return 'swap';
  if (/\breplace\b|\boverwrite\b|\bmove\b|\bdo\s+it\b|\byes\b|\byep\b|\byeah\b/i.test(text)) return 'replace';
  return null;
}

function commandFromMoveTransaction(
  transaction: PendingMoveSessionTransaction,
  message: string,
  opts?: { swap?: boolean },
): CoachCommand {
  const sourceDate = transaction.sourceDate;
  const targetDate = transaction.targetDate;
  const sourceDay = transaction.sourceDay ?? (sourceDate ? dayNameFromISO(sourceDate) : 'Monday');
  const targetDay = transaction.targetDay ?? (targetDate ? dayNameFromISO(targetDate) : 'Monday');
  if (transaction.scope === 'recurring') {
    const payload: CoachMutatePayload = {
      operation: 'update_program_setup',
      addTrainingDays: [targetDay],
      removeTrainingDays: [sourceDay],
      summary: `move ${sourceDay} to ${targetDay}`,
      rebuildRequired: true,
    };
    return makeMutate(
      'update_program_setup',
      { kind: 'unbound' },
      payload,
      'permanent',
      message,
      'schedule_transaction:recurring_move',
    );
  }

  const payload: CoachMutatePayload = {
    operation: 'move_session',
    fromDow: dowFromDayName(sourceDay),
    toDate: targetDate!,
    toDow: dowFromDayName(targetDay),
    swap: opts?.swap === true ? true : undefined,
    moveScope: 'one_off',
  };
  return makeMutate(
    'move_session',
    {
      kind: 'date',
      date: sourceDate!,
      sessionName: transaction.sourceSessionSnapshot?.sessionName,
    },
    payload,
    'one_off',
    message,
    'schedule_transaction:one_off_move',
  );
}

function commandFromAddToDateTransaction(
  transaction: PendingAddToDateTransaction,
  message: string,
): CoachCommand {
  const targetDate = transaction.targetDate!;
  const payload: CoachMutatePayload = {
    operation: 'add_conditioning',
    modality: null,
    overrideType: transaction.overrideType ?? 'one_off_extra',
    setupChange: false,
  };
  return makeMutate(
    'add_conditioning',
    {
      kind: 'date',
      date: targetDate,
      sessionName:
        transaction.targetStatus === 'existing_session'
          ? `${transaction.targetDow ?? dayNameFromISO(targetDate)} session`
          : 'Rest',
    },
    payload,
    'one_off',
    message,
    'add_to_date_transaction:conditioning',
  );
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

  if (pending.missingFields.includes('game_day_readiness_choice')) {
    return null;
  }

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

  if (
    pending.operation === 'move_session' &&
    (pending.missingFields.includes('target_scope') || pending.missingFields.includes('move_scope')) &&
    pending.targetDate
  ) {
    const answerScope = classifyMoveScopeAnswer(newMessage);
    if (!answerScope) return null;
    const p = pending.partialPayload as Partial<{
      fromDow: number;
      toDate: string;
      toDow: number;
      swap: boolean;
      swapWithDow: number;
    }>;
    if (!p.toDate && p.toDow == null) return null;
    const targetDay =
      p.toDow != null
        ? dayNameFromDow(p.toDow)
        : p.toDate
          ? dayNameFromISO(p.toDate)
          : null;
    if (answerScope === 'recurring') {
      if (!targetDay) return null;
      const sourceDay = dayNameFromISO(pending.targetDate);
      const payload: CoachMutatePayload = {
        operation: 'update_program_setup',
        addTrainingDays: [targetDay],
        removeTrainingDays: [sourceDay],
        summary: `move ${sourceDay} to ${targetDay}`,
        rebuildRequired: true,
      };
      return makeMutate(
        'update_program_setup',
        { kind: 'unbound' },
        payload,
        'permanent',
        newMessage,
        'resumed_move_scope:recurring_setup',
      );
    }

    const payload: CoachMutatePayload = {
      operation: 'move_session',
      fromDow: p.fromDow,
      toDate: p.toDate,
      toDow: p.toDow,
      swap: p.swap,
      swapWithDow: p.swapWithDow,
      moveScope: 'one_off',
    };
    return makeMutate(
      'move_session',
      {
        kind: 'date',
        date: pending.targetDate,
        sessionName: pending.targetSessionName,
      },
      payload,
      'one_off',
      newMessage,
      'resumed_move_scope:one_off',
    );
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
      const p = partial as Partial<{ fromDow: number; toDate: string; toDow: number; swap: boolean; swapWithDow: number; moveScope: CoachMoveScope }>;
      // For move_session, the new message resolves the SOURCE day.
      // The destination must already be present in the partial payload.
      if (!p.toDate && p.toDow == null && !p.swap) return null;
      const payload: CoachMutatePayload = {
        operation: 'move_session',
        fromDow: p.fromDow,
        toDate: p.toDate,
        toDow: p.toDow,
        swap: p.swap,
        swapWithDow: p.swapWithDow,
        moveScope: p.moveScope,
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
