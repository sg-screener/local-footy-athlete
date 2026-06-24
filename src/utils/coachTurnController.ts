import { generateProgramFromProfile } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import type { DayOfWeek } from '../types/domain';
import {
  usePendingCoachClarifierStore,
  getPendingClarifierSnapshot,
  isCancelClarifierMessage,
  isAffirmativeClarifierMessage,
  isNegativeClarifierMessage,
  classifyPendingClarificationAnswer,
  type PendingClarificationAnswerClassification,
  type PendingCoachClarifier,
} from '../store/pendingCoachClarifierStore';
import { useCoachContextStateStore } from '../store/coachContextStateStore';
import { buildCoachContextPacket } from './coachContextPacket';
import {
  dispatchCoachIntent,
} from './coachIntentDispatcher';
import type {
  CoachIntent,
  CoachIntentClassifier,
  PendingCoachProposal,
} from './coachIntent';
import { buildLiveDispatchDeps } from './coachDispatchDeps';
import {
  extractModalitiesFromSession,
  isMutationLike,
} from './coachReferenceResolver';
import { autoBindUniqueModalityTarget } from './coachVisibleWeekAutoBind';
import { parseModalitySwapRequest } from './coachModalitySwap';
import {
  canFallbackToLegacy,
  isMutateCommand,
  type CoachCommand,
} from './coachCommandRouter';
import {
  coachCommandFromLLMIntent,
  shouldTryLLMCoachCommand,
} from './coachLLMCommandAdapter';
import {
  routeCoachReadinessMessage,
  type CoachReadinessAction,
  type PendingReadinessClarifier,
} from './coachReadinessAdapter';
import {
  describeStage,
  type ExecutionResult,
  type ProgressStage,
} from './coachCommandExecutor';
import {
  interpretCoachMessageToProgramEdit,
  executeProgramEdit,
  executeProgramSetupEdit,
  isProgramSetupEdit,
  resolvePendingProgramEditAnswer,
  type ProgramEdit,
} from './coachProgramEdit';
import {
  decideProgramEditDraftFrontDoor,
  validateProgramEditAgainstDraft,
  type ProgramEditDraft,
} from './coachProgramEditDraft';
import {
  fingerprintVisibleProgramDay,
  verifyProgramEditDraftVisibleState,
  type CoachVisibleDomainSnapshotMap,
  type CoachVisibleDomainVerificationResult,
} from './coachVisibleDomainVerifier';
import {
  captureFromExecutorClarify,
  resumeFromPending,
  resolvePendingGameDayReadinessAnswer,
  resolvePendingScheduleTransactionAnswer,
} from './coachClarifierResume';
import { buildReadinessSignalPatch } from './readiness';
import { isPendingProgramProposalExpired } from './programAdjustmentRequests';
import { buildScheduleStateImperative } from './coachWeekDiff';
import {
  buildDayWorkoutProjectedDay,
  buildProgramTabProjectedWeek,
  getResolvedVisibleProgramForDate,
} from './visibleProgramReadModel';
import { getMondayForDate } from './sessionResolver';
import { logger } from './logger';

export interface CoachTurnMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CoachTurnDebug {
  intent: string;
  route: string;
  referenceStatus: string | null;
  referenceTargetDate: string | null;
  referenceTargetName: string | null;
  mutationLike: boolean;
  legacyCalled: boolean;
  replySource: 'deterministic' | 'legacy';
  applied?: boolean;
  fromModality?: string | null;
  toModality?: string | null;
  projectionShowsTo?: boolean | null;
  projectionShowsFrom?: boolean | null;
}

export type CoachTurnControllerResult =
  | { handled: true }
  | { handled: false; classifiedCoachIntent: CoachIntent | null };

export interface CoachTurnControllerInput {
  userMessage: CoachTurnMessage;
  messages: CoachTurnMessage[];
  todayISO: string;
  classifier: CoachIntentClassifier;
  pendingCoachProposal: PendingCoachProposal | null;
  pendingReadiness: PendingReadinessClarifier | null;
  pendingInjury: {
    bodyPart: string;
    timestamp: number;
  } | null;
  smokeCoachBikeFlow: boolean;
  isFocused: boolean;
  smokeWednesdayMissingReason: string | null;
  smokeWednesdayOpenTarget: {
    date?: string | null;
    workoutId?: string | null;
    title?: string | null;
  } | null;
  setPendingCoachProposal: (proposal: PendingCoachProposal | null) => void;
  setPendingReadiness: (pending: PendingReadinessClarifier | null) => void;
  appendUser: () => void;
  appendAssistant: (message: CoachTurnMessage) => void;
  appendUserAndAssistant: (message: CoachTurnMessage) => void;
  clearInput: () => void;
  setIsLoading: (loading: boolean) => void;
  setCoachProgressLabel: (label: string | null) => void;
  startSetupRebuildProgress: () => void;
  clearSetupRebuildProgress: () => void;
  setLastCoachDebug: (debug: CoachTurnDebug | null) => void;
}

type AppliedReadinessAction = Extract<CoachReadinessAction, { kind: 'apply_signal' }>;

function assistantMessage(suffix: string, content: string): CoachTurnMessage {
  return {
    id: `${Date.now()}-${suffix}`,
    role: 'assistant',
    content,
  };
}

function currentWeekRefs(packet: ReturnType<typeof buildCoachContextPacket>) {
  return (packet.currentWeek ?? []).map((day) => ({
    date: day.date,
    sessionName: day.workout?.name ?? 'session',
    workout: day.workout,
  }));
}

function resolveLiveVisibleProgramForDate(date: string, todayISO: string) {
  const programState = useProgramStore.getState();
  return getResolvedVisibleProgramForDate({
    date,
    todayISO,
    state: buildScheduleStateImperative(),
    overrideContexts: programState.overrideContexts ?? {},
  });
}

function resolveLiveProgramTabVisibleDayForDate(date: string, todayISO: string) {
  const programState = useProgramStore.getState();
  const state = buildScheduleStateImperative();
  const week = buildProgramTabProjectedWeek({
    mondayISO: getMondayForDate(date),
    todayISO,
    state,
    overrideContexts: programState.overrideContexts ?? {},
    modalityPreferences: (state as any).modalityPreferences,
  });
  const day = week.find((candidate) => candidate.date === date);
  if (day) return day;
  return resolveLiveVisibleProgramForDate(date, todayISO).day;
}

interface DraftVisibleVerifierSnapshot {
  dates: string[];
  visible: CoachVisibleDomainSnapshotMap;
  rollback: DraftVisibleRollbackSnapshot[];
}

interface DraftVisibleRollbackSnapshot {
  date: string;
  workout: any | null;
  context: any | null;
  calendarMark: CalendarDayType | null;
}

function captureDraftVisibleVerifierSnapshot(
  draft: ProgramEditDraft | null | undefined,
  edit: ProgramEdit,
  todayISO: string,
): DraftVisibleVerifierSnapshot | null {
  const dates = collectDraftVisibleVerifierDates(draft, edit);
  if (dates.length === 0) return null;

  const visible: CoachVisibleDomainSnapshotMap = {};
  for (const date of dates) {
    try {
      visible[date] = fingerprintVisibleProgramDay(
        resolveLiveProgramTabVisibleDayForDate(date, todayISO),
      );
    } catch (err) {
      logger.warn('[coach-program-edit-draft-visible-snapshot-failed]', {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
      visible[date] = null;
    }
  }

  return {
    dates,
    visible,
    rollback: captureDraftVisibleRollbackSnapshot(dates),
  };
}

function collectDraftVisibleVerifierDates(
  draft: ProgramEditDraft | null | undefined,
  edit: ProgramEdit,
): string[] {
  if (!draft || draft.intent === 'ask_question' || draft.intent === 'explain') {
    return [];
  }

  const dates = new Set<string>();
  const addDate = (value: unknown) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      dates.add(value);
    }
  };

  addDate(draft.targetDate);
  for (const action of draft.proposedActions) addDate(action.targetDate);
  for (const expectation of draft.verifierExpectations) addDate(expectation.targetDate);
  for (const protectedTarget of draft.protectedTargets) addDate(protectedTarget.targetDate);
  addDate(edit.targetDate);
  addDate((edit as any).sourceDate);

  const command = edit.command as any;
  addDate(command?.target?.date);
  addDate(command?.payload?.sourceDate);
  addDate(command?.payload?.fromDate);
  addDate(command?.payload?.toDate);

  return [...dates].sort();
}

function captureDraftVisibleRollbackSnapshot(
  dates: string[],
): DraftVisibleRollbackSnapshot[] {
  const programState = useProgramStore.getState();
  const calendarState = useCalendarStore.getState();
  return dates.map((date) => ({
    date,
    workout: programState.dateOverrides?.[date] ?? null,
    context: programState.overrideContexts?.[date] ?? null,
    calendarMark: calendarState.markedDays?.[date] ?? null,
  }));
}

function restoreDraftVisibleRollbackSnapshot(
  snapshot: DraftVisibleRollbackSnapshot[],
  reason: string,
): void {
  const programStore = useProgramStore.getState();
  const calendarStore = useCalendarStore.getState();
  for (const item of snapshot) {
    try {
      if (item.workout) {
        programStore.setManualOverride(item.date, item.workout, item.context ?? undefined);
      } else {
        programStore.removeManualOverride(item.date);
      }

      calendarStore.removeGameDay(item.date);
      calendarStore.removeRestDay(item.date);
      calendarStore.removeNoGame(item.date);
      if (item.calendarMark === 'game') calendarStore.setGameDay(item.date);
      if (item.calendarMark === 'rest') calendarStore.setRestDay(item.date);
      if (item.calendarMark === 'noGame') calendarStore.setNoGame(item.date);
    } catch (err) {
      logger.warn('[coach-program-edit-draft-visible-rollback-failed]', {
        date: item.date,
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function verifyDraftVisibleExecution(args: {
  draft: ProgramEditDraft | null | undefined;
  edit: ProgramEdit;
  result: ExecutionResult;
  before: DraftVisibleVerifierSnapshot | null;
  todayISO: string;
}): CoachVisibleDomainVerificationResult {
  if (args.result.kind !== 'mutated' || !args.result.applied) {
    return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
  }
  if (!args.before) {
    return { ok: true, route: 'program_edit_draft_visible_guard_ok' };
  }

  const afterVisible: CoachVisibleDomainSnapshotMap = {};
  for (const date of args.before.dates) {
    try {
      afterVisible[date] = fingerprintVisibleProgramDay(
        resolveLiveProgramTabVisibleDayForDate(date, args.todayISO),
      );
    } catch (err) {
      logger.warn('[coach-program-edit-draft-visible-after-snapshot-failed]', {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
      afterVisible[date] = null;
    }
  }

  return verifyProgramEditDraftVisibleState({
    draft: args.draft,
    finalEdit: args.edit,
    result: args.result,
    before: args.before.visible,
    after: afterVisible,
  });
}

type ProgramEditVisibleGuardRun =
  | {
      kind: 'ok';
      result: ExecutionResult;
    }
  | {
      kind: 'blocked';
      result: ExecutionResult;
      verification: Extract<CoachVisibleDomainVerificationResult, { ok: false }>;
    };

function executeProgramEditWithVisibleGuard(args: {
  input: CoachTurnControllerInput;
  programEdit: ProgramEdit;
  draft: ProgramEditDraft | null | undefined;
  referenceResolution: any;
  userMessage: string;
  source: string;
}): ProgramEditVisibleGuardRun {
  const verifierDraft = visibleVerifierDraftForProgramEdit(
    args.programEdit,
    args.draft,
    args.userMessage,
  );
  const before = captureDraftVisibleVerifierSnapshot(
    verifierDraft,
    args.programEdit,
    args.input.todayISO,
  );
  const result = executeProgramEdit({
    programEdit: args.programEdit,
    todayISO: args.input.todayISO,
    referenceResolution: args.referenceResolution,
    userMessage: args.userMessage,
    onProgress: (stage) => setProgress(args.input, stage),
  });
  args.input.setCoachProgressLabel(null);

  const verification = verifyDraftVisibleExecution({
    draft: verifierDraft,
    edit: args.programEdit,
    result,
    before,
    todayISO: args.input.todayISO,
  });
  if (verification.ok === false) {
    if (before?.rollback) {
      restoreDraftVisibleRollbackSnapshot(before.rollback, verification.reason);
    }
    logger.warn('[coach-program-edit-draft-visible-guard-blocked]', {
      source: args.source,
      route: verification.route,
      reason: verification.reason,
      details: verification.details ?? null,
      draftIntent: verifierDraft?.intent ?? null,
      draftTargetDomain: verifierDraft?.targetDomain ?? null,
      draftActionScope: verifierDraft?.actionScope ?? null,
      finalIntent: args.programEdit.intent,
      finalTargetDomain: args.programEdit.targetDomain,
      resultRoute: result.route,
      resultReplyWasDone: /^Done\b/i.test(result.reply),
    });
    return { kind: 'blocked', result, verification };
  }

  return { kind: 'ok', result };
}

function visibleVerifierDraftForProgramEdit(
  edit: ProgramEdit,
  draft: ProgramEditDraft | null | undefined,
  explicitUserWording: string,
): ProgramEditDraft | null {
  if (
    draft &&
    draft.intent !== 'ask_question' &&
    draft.intent !== 'explain' &&
    draft.proposedActions.length > 0
  ) {
    return draft;
  }

  if (edit.intent === 'ask_question' || edit.intent === 'explain') return null;
  const actionScope = visibleVerifierActionScopeFromProgramEdit(edit);
  const targetDomain = visibleVerifierTargetDomainFromProgramEdit(edit);
  const actionIntent = edit.intent as Exclude<ProgramEditDraft['intent'], 'ask_question' | 'explain' | 'reduce'>;
  const reason = `final_program_edit_${edit.intent}_${targetDomain}_${actionScope}`;

  const protectedTargets = (edit.protectedTargets ?? []).map((target: any) => ({
    targetDomain: target.domain === 'strength' ? 'strength' : 'conditioning',
    actionScope: target.domain === 'strength' ? 'strength_block' : 'conditioning_block',
    targetDate: edit.targetDate,
    targetItemId: target.id ?? null,
    title: target.title ?? null,
    reason: 'final_program_edit_protected_target',
  })) as ProgramEditDraft['protectedTargets'];

  return {
    intent: edit.intent as ProgramEditDraft['intent'],
    targetDomain,
    actionScope,
    targetDate: edit.targetDate,
    targetSessionId: edit.targetSessionId,
    targetItemId: edit.targetItemId,
    sourceTarget: null,
    explicitDateRole: 'none',
    explicitUserWording,
    missingFields: edit.missingFields,
    confidence: edit.confidence,
    protectedTargets,
    constraints: protectedTargets.map((target) =>
      `keep ${target.targetDomain}:${target.actionScope ?? 'whole_session'}`,
    ),
    proposedActions: [{
      intent: actionIntent,
      targetDomain,
      actionScope,
      targetDate: edit.targetDate,
      targetSessionId: edit.targetSessionId,
      targetItemId: edit.targetItemId,
      sourceTarget: null,
      reason,
    }],
    verifierExpectations: [
      {
        kind: targetDomain === 'session' && actionScope === 'whole_session'
          ? 'session_removed'
          : 'domain_changed',
        targetDomain,
        actionScope,
        targetDate: edit.targetDate,
        reason,
      },
      ...protectedTargets.map((target) => ({
        kind: 'domain_unchanged' as const,
        targetDomain: target.targetDomain,
        actionScope: target.actionScope,
        targetDate: target.targetDate ?? edit.targetDate,
        reason: target.reason,
      })),
    ],
    isCompound: false,
    reason,
  };
}

function visibleVerifierTargetDomainFromProgramEdit(
  edit: ProgramEdit,
): ProgramEditDraft['targetDomain'] {
  if (edit.targetDomain === 'schedule') return 'schedule';
  return edit.targetDomain;
}

function visibleVerifierActionScopeFromProgramEdit(
  edit: ProgramEdit,
): ProgramEditDraft['actionScope'] {
  const editScope = 'editScope' in edit ? edit.editScope : undefined;
  switch (editScope) {
    case 'add_conditioning_item':
    case 'remove_conditioning_item':
    case 'replace_conditioning_prescription':
      return 'conditioning_block';
    case 'duration_only':
      return 'duration';
    case 'intensity_only':
      return 'intensity';
    case 'modality_only':
      return 'modality';
    case 'add_whole_session':
    case 'remove_whole_session':
      return 'whole_session';
    case 'update_program_setup':
      return 'setup';
    default:
      break;
  }

  if (edit.targetDomain === 'conditioning') return 'conditioning_block';
  if (edit.targetDomain === 'strength') {
    return edit.requestedChange === 'exercise' ? 'exercise' : 'strength_block';
  }
  return 'whole_session';
}

function getTodayProjectedDay(todayISO: string) {
  const state = buildScheduleStateImperative();
  const overrideContext = useProgramStore.getState().overrideContexts?.[todayISO];
  const day = buildDayWorkoutProjectedDay({
    date: todayISO,
    todayISO,
    state,
    overrideContext,
  });
  return { day, state };
}

function recordVerifiedProgramEditMutationFocus(
  edit: ProgramEdit,
  result: ExecutionResult,
  todayISO: string,
) {
  if (result.kind !== 'mutated' || !result.applied) return;
  const targetDate =
    edit.targetDate ??
    result.modalityOutcome?.targetDate ??
    null;
  if (!targetDate) return;

  const visible = resolveLiveVisibleProgramForDate(targetDate, todayISO);
  const workout = visible.day.workout ?? null;
  const sessionName =
    workout?.name ??
    edit.targetItemTitle ??
    (edit.targetDomain === 'session' ? 'Rest' : 'session');
  const modalities = workout
    ? extractModalitiesFromSession({
        name: workout.name,
        exercises: workout.exercises,
      })
    : undefined;
  const mutationType =
    edit.command?.mode === 'mutate'
      ? edit.command.operation
      : result.route;
  const newlyAdded =
    edit.intent === 'add' ||
    mutationType === 'add_session' ||
    result.route === 'add_session:applied';

  useCoachContextStateStore.getState().setLastMutationTarget({
    date: targetDate,
    sessionName,
    modalities,
    lastMutationType: mutationType,
    targetSessionId: workout?.id ?? null,
    newlyAdded,
    source: 'coach_mutation',
  });
  useCoachContextStateStore.getState().setLastExplainedSession({
    date: targetDate,
    sessionName,
    modalities,
    lastMutationType: mutationType,
    targetSessionId: workout?.id ?? null,
    newlyAdded,
    source: 'coach_mutation',
  });
  if (getPendingClarifierSnapshot()) {
    usePendingCoachClarifierStore.getState().clearPending();
    logger.debug('[pending-clarifier] cleared_after_verified_mutation', {
      targetDate,
      route: result.route,
    });
  }
  logger.debug('[coach-flow] mutation_focus_set', {
    targetDate,
    sessionName,
    route: result.route,
    mutationType,
    newlyAdded,
  });
}

export function capturePendingDateClarificationFromProgramEditRejection(args: {
  result: ExecutionResult;
  programEdit: ProgramEdit;
  command: CoachCommand;
  draft: ProgramEditDraft | null | undefined;
  originalMessage: string;
  todayISO?: string;
}): Omit<PendingCoachClarifier, 'createdAt'> | null {
  const { result, programEdit, command, draft, originalMessage, todayISO } = args;
  if (!isDateClarificationRejection(result)) return null;
  if (!programEdit.targetDate || command.mode !== 'mutate') return null;

  const targetDay = controllerDayNameFromISO(programEdit.targetDate);
  const proposedDate = targetDay && todayISO
    ? controllerNextDateForDay(todayISO, targetDay)
    : null;
  const proposedCandidate = proposedDate && targetDay
    ? {
        label: `Next ${targetDay}`,
        value: proposedDate,
        answerType: 'date' as const,
      }
    : undefined;
  const askedQuestion = pendingDateClarificationQuestion(programEdit.targetDate, targetDay);
  const candidateOptions = [
    targetDay ? `Next ${targetDay}` : null,
    'Leave unchanged',
  ].filter((option): option is string => !!option);
  const needsItemRetarget = programEditNeedsRetargetedItem(programEdit);
  const missingFields = uniqueControllerFields([
    ...programEdit.missingFields.filter((field) => !controllerIsDateField(field)),
    'targetDate',
    ...(needsItemRetarget ? ['targetItemId'] : []),
  ]);
  const pendingEdit = {
    ...programEdit,
    targetItemId: needsItemRetarget ? null : programEdit.targetItemId,
    targetItemTitle: needsItemRetarget ? null : programEdit.targetItemTitle,
    candidateItems: needsItemRetarget ? [] : programEdit.candidateItems,
    missingFields,
    question: askedQuestion,
    options: candidateOptions,
  } as ProgramEdit;

  return {
    operation: command.operation,
    partialPayload: command.payload,
    scope: command.scope,
    moveScope:
      command.payload.operation === 'move_session'
        ? command.payload.moveScope
        : undefined,
    missingFields,
    originalMessage,
    askedQuestion,
    targetDate: programEdit.targetDate,
    targetSessionName: programEdit.targetItemTitle ?? undefined,
    programEdit: pendingEdit,
    candidateItems: pendingEdit.candidateItems,
    pendingClarification: {
      originalIntent: `${programEdit.intent}:${programEdit.targetDomain}:${'editScope' in programEdit ? programEdit.editScope ?? programEdit.requestedChange : programEdit.requestedChange}`,
      missingField: 'targetDate',
      expectedAnswerType: 'date',
      staleDate: programEdit.targetDate,
      requestedDow: targetDay ?? undefined,
      proposedCandidate,
      candidateOptions,
      partialDraft: draft ?? undefined,
      reason: result.route,
    },
  };
}

function capturePendingDateClarificationFromPastProgramEditTarget(args: {
  programEdit: ProgramEdit;
  command: CoachCommand;
  draft: ProgramEditDraft | null | undefined;
  originalMessage: string;
  todayISO: string;
}): Omit<PendingCoachClarifier, 'createdAt'> | null {
  const { programEdit, command, draft, originalMessage, todayISO } = args;
  if (!programEdit.targetDate || !isPastISODate(programEdit.targetDate, todayISO)) return null;
  if (!isMutationProgramEditForDateClarifier(programEdit, command)) return null;
  return capturePendingDateClarificationFromProgramEditRejection({
    result: {
      kind: 'verified_no_op',
      reply: pendingDateClarificationQuestion(
        programEdit.targetDate,
        controllerDayNameFromISO(programEdit.targetDate),
      ),
      applied: false,
      route: 'pending_clarification:target_date:past_date',
      progress: ['composing_reply'],
    },
    programEdit,
    command,
    draft,
    originalMessage,
    todayISO,
  });
}

function isDateClarificationRejection(result: ExecutionResult): boolean {
  if (!['rejected', 'rejected_with_alternatives', 'verified_no_op'].includes(result.kind)) return false;
  return /\b(?:past_date_blocked|invalid_target_date|target_date)\b/i.test(result.route);
}

function pendingDateClarificationQuestion(staleDate: string, dayName: string | null): string {
  const label = dayName ? `${dayName} ${staleDate}` : staleDate;
  const next = dayName ? `next ${dayName}` : 'the next matching day';
  return `${label} is in the past. Do you mean ${next} instead?`;
}

function programEditNeedsRetargetedItem(edit: ProgramEdit): boolean {
  return (
    edit.targetDomain !== 'session' &&
    edit.targetDomain !== 'schedule' &&
    edit.intent !== 'add' &&
    edit.intent !== 'explain' &&
    edit.intent !== 'ask_question'
  );
}

function isMutationProgramEditForDateClarifier(edit: ProgramEdit, command: CoachCommand): boolean {
  if (edit.intent === 'explain') return false;
  if (command.mode === 'mutate') return true;
  return edit.intent !== 'ask_question' || edit.missingFields.some((field) =>
    field === 'targetDate' || field === 'target_date' || field === 'targetItemId',
  );
}

function isPastISODate(dateISO: string, todayISO: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateISO) &&
    /^\d{4}-\d{2}-\d{2}$/.test(todayISO) &&
    dateISO < todayISO;
}

function controllerIsDateField(field: string): boolean {
  return /^(?:targetDate|target_date|target_day|destination_date|destination_day|day|date)$/.test(field);
}

function uniqueControllerFields(fields: string[]): string[] {
  const out: string[] = [];
  for (const field of fields) {
    if (!field || out.includes(field)) continue;
    out.push(field);
  }
  return out;
}

function controllerDayNameFromISO(iso: string): DayOfWeek | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const dow = new Date(year, month - 1, day, 12, 0, 0, 0).getDay();
  return (['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as DayOfWeek[])[dow] ?? null;
}

function controllerNextDateForDay(todayISO: string, day: DayOfWeek): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayISO)) return null;
  const currentDow = controllerDayNumberFromISO(todayISO);
  const targetDow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day);
  if (currentDow < 0 || targetDow < 0) return null;
  let diff = targetDow - currentDow;
  if (diff <= 0) diff += 7;
  return controllerAddDaysISO(todayISO, diff);
}

function controllerDayNumberFromISO(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return -1;
  return new Date(year, month - 1, day, 12, 0, 0, 0).getDay();
}

function controllerAddDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

function pendingClarifierNeedsDuration(pending: PendingCoachClarifier): boolean {
  return pending.operation === 'add_conditioning' &&
    pending.missingFields.some((field) =>
      /^(?:duration|durationMinutes|minutes|time)$/.test(field),
    );
}

function shouldHoldDurationClarifier(
  pending: PendingCoachClarifier,
  message: string,
): boolean {
  if (!pendingClarifierNeedsDuration(pending)) return false;
  const text = message.trim();
  if (!text) return false;
  const startsFreshEdit =
    /\b(?:add|remove|drop|skip|swap|replace|move|reschedule|instead\s+of|rather\s+than)\b/i.test(text) ||
    /\b(?:bike|row(?:er|ing)?|ski\s*erg|skierg|run(?:ning)?|walk(?:ing)?|pilates|yoga|mobility|hiit|sprints?|intervals?)\b/i.test(text) ||
    /\b(?:harder|lighter|easier|shorter)\b/i.test(text);
  return !startsFreshEdit;
}

async function classifyPendingAnswerForController(args: {
  input: CoachTurnControllerInput;
  pending: PendingCoachClarifier;
}): Promise<PendingClarificationAnswerClassification | null> {
  if (!args.pending.pendingClarification) return null;
  const deterministic = classifyPendingClarificationAnswer({
    message: args.input.userMessage.content,
    pendingClarification: args.pending.pendingClarification,
    askedQuestion: args.pending.askedQuestion,
  });
  if (deterministic.kind !== 'unclear') {
    return deterministic;
  }
  const semanticClassifier = args.input.classifier.classifyPendingClarificationAnswer;
  if (!semanticClassifier) {
    return deterministic;
  }
  try {
    const semantic = await semanticClassifier({
      message: args.input.userMessage.content,
      pendingClarification: args.pending.pendingClarification,
      askedQuestion: args.pending.askedQuestion,
    });
    return semantic.confidence >= 0.65 ? semantic : deterministic;
  } catch (err) {
    logger.warn('[pending-clarifier] semantic_answer_classifier_failed', {
      error: err instanceof Error ? err.message : String(err),
      deterministicKind: deterministic.kind,
      deterministicReason: deterministic.reason,
    });
    return deterministic;
  }
}

function isRecoveryWorkoutForCoach(workout: any): boolean {
  return (
    workout?.workoutType === 'Recovery' ||
    workout?.sessionTier === 'recovery'
  );
}

function buildSessionAwareReadinessReply(
  readinessAction: AppliedReadinessAction,
  todayISO: string,
): string {
  const signal = readinessAction.signal ?? {};
  const isFlat = signal.flatToday || signal.energy === 'low';
  const isSore = signal.soreness === 'moderate' || signal.soreness === 'high';
  const isShortTime =
    typeof signal.timeAvailableMinutes === 'number' &&
    signal.timeAvailableMinutes < 45;
  const bodyPart =
    typeof signal.bodyPart === 'string' && signal.bodyPart.trim()
      ? signal.bodyPart.trim()
      : 'that area';

  let workout: any = null;
  try {
    workout = getTodayProjectedDay(todayISO).day?.workout ?? null;
  } catch (err) {
    logger.warn('[coach-readiness-reply] failed to read today workout', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!workout) {
    if (isFlat) {
      return 'Got it — no S&C session is scheduled today, so keep it as recovery. Easy movement is fine if it makes you feel better.';
    }
    if (isSore) {
      return `Got it — no S&C session is scheduled today, so keep ${bodyPart} calm and pain-free. If it feels like pain, tell me a rough score out of 10.`;
    }
    if (isShortTime) {
      return 'Got it — no S&C session is scheduled today, so there is nothing we need to squeeze in.';
    }
  }

  if (isRecoveryWorkoutForCoach(workout)) {
    if (isFlat) {
      return 'Got it — today is already a recovery session, so we’ll keep it recovery-led. Aim to finish fresher than you started: easy pace, relaxed mobility, and no extra work added.';
    }
    if (isSore) {
      return `Got it — today is already recovery, so keep it gentle around ${bodyPart}. Stay pain-free, use the flush and mobility work, and tell me a pain score if it feels sharper than soreness.`;
    }
    if (isShortTime) {
      return 'Got it — today is already recovery, so keep the essentials only. Do the main mobility or flush work, then call it.';
    }
  }

  if (isFlat) {
    const sessionName = workout?.name ? `For ${workout.name}, ` : '';
    return (
      `Yep — that’s a low-readiness flag. ${sessionName}` +
      `we’ll pull today back: keep the main work crisp, cap effort around 6–7/10, and skip anything that turns into a grind. ` +
      `If you still feel worse after warming up, make it recovery only.`
    );
  }

  if (isSore) {
    return (
      `Got it — sore ${bodyPart} today. ` +
      `Keep that area pain-free, avoid pushing through sharpness, and I’ll bias the plan away from anything that hammers it.`
    );
  }

  if (isShortTime) {
    return 'Got it — short-time day. Main stimulus first, then leave the accessories unless you’ve genuinely got room.';
  }

  return readinessAction.reply;
}

function describeTodayReadinessImpact(todayISO: string): string {
  try {
    const { day } = getTodayProjectedDay(todayISO);
    const workout = day?.workout;
    if (!workout) {
      return 'Program update\nToday is already a no-session day, so there was nothing to trim.';
    }

    const notes = workout.coachNotes ?? [];
    const removed = notes
      .filter((n: string) => /^Removed:\s*/i.test(n))
      .map((n: string) => n.replace(/^Removed:\s*/i, '').trim());
    const cautions = notes
      .filter((n: string) => /^Caution:\s*/i.test(n))
      .map((n: string) => n.replace(/^Caution:\s*/i, '').trim());
    const focus = notes
      .filter((n: string) => /^Focus:\s*/i.test(n))
      .map((n: string) => n.replace(/^Focus:\s*/i, '').trim())
      .slice(0, 2);

    const lines: string[] = ['Program update'];
    if (removed.length > 0) lines.push(`Removed today: ${removed.join(', ')}`);
    if (cautions.length > 0) lines.push(`Treat as caution: ${cautions.join(', ')}`);
    if (focus.length > 0) lines.push(`Focus: ${focus.join(', ')}`);

    if (lines.length > 1) return lines.join('\n');

    if (isRecoveryWorkoutForCoach(workout)) {
      return [
        'Program update',
        `${workout.name} is already the low-cost option, so I left the structure alone.`,
        'Keep it easy and finish feeling better than you started.',
      ].join('\n');
    }

    return [
      'Program update',
      `${workout.name} was already low-cost enough that I did not need to remove exercises.`,
      'Keep it controlled and do not add extras today.',
    ].join('\n');
  } catch (err) {
    logger.warn('[coach-readiness-impact] failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 'Program update\nI flagged today, but could not verify the visible session change in chat. Check the Program tab before training.';
  }
}

async function executeSetupEditInController(args: {
  input: CoachTurnControllerInput;
  programEdit: Extract<ProgramEdit, { editScope: 'update_program_setup' }>;
  onProgress: (stage: ProgressStage) => void;
}) {
  const { input, programEdit, onProgress } = args;
  return executeProgramSetupEdit({
    programEdit,
    todayISO: input.todayISO,
    getOnboardingData: () => useProfileStore.getState().onboardingData,
    updateOnboardingData: (patch) => useProfileStore.getState().updateOnboardingData(patch),
    generateProgramFromProfile,
    setCurrentProgram: (program) => useProgramStore.getState().setCurrentProgram(program),
    setCurrentMicrocycle: (microcycle) => useProgramStore.getState().setCurrentMicrocycle(microcycle),
    setTodayWorkout: (workout) => useProgramStore.getState().setTodayWorkout(workout),
    onProgress,
  });
}

function setProgress(input: CoachTurnControllerInput, stage: ProgressStage) {
  input.setCoachProgressLabel(describeStage(stage));
}

function replyAndFinish(
  input: CoachTurnControllerInput,
  suffix: string,
  content: string,
): CoachTurnControllerResult {
  input.appendUserAndAssistant(assistantMessage(suffix, content));
  input.clearInput();
  return { handled: true };
}

export async function handleCoachTurn(
  input: CoachTurnControllerInput,
): Promise<CoachTurnControllerResult> {
  let classifiedCoachIntent: CoachIntent | null = null;

  try {
    const recentMessages = input.messages
      .filter((m) => m.id !== '0' && m.role !== 'system')
      .slice(-8)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    let packet = buildCoachContextPacket({
      userMessage: input.userMessage.content,
      recentMessages,
      todayISO: input.todayISO,
      pendingInjury: input.pendingInjury
        ? {
            bodyPart: input.pendingInjury.bodyPart,
            timestamp: input.pendingInjury.timestamp,
          }
        : null,
      pendingCoachProposal: input.pendingCoachProposal,
      pendingTransaction: getPendingClarifierSnapshot()?.scheduleTransaction ?? null,
    });

    const pendingClarifier = getPendingClarifierSnapshot();
    if (pendingClarifier) {
      if (isCancelClarifierMessage(input.userMessage.content)) {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.debug('[pending-clarifier] cancelled', {
          operation: pendingClarifier.operation,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'clarifier-cancelled', 'No worries — leaving things as they are.');
      }

      const pendingGameDayAnswer = resolvePendingGameDayReadinessAnswer(
        pendingClarifier,
        input.userMessage.content,
      );
      if (pendingGameDayAnswer) {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.debug('[pending-clarifier] game_day_readiness_answer', {
          operation: pendingClarifier.operation,
          answerKind: pendingGameDayAnswer.kind,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        if (pendingGameDayAnswer.kind === 'mark_limited') {
          useReadinessStore.getState().setReadinessSignal(input.todayISO, {
            ...buildReadinessSignalPatch('flat'),
            source: 'coach_message',
          });
        }
        return replyAndFinish(input, 'game-day-readiness-answer', pendingGameDayAnswer.reply);
      }

      const pendingScheduleAnswer = resolvePendingScheduleTransactionAnswer({
        pending: pendingClarifier,
        userMessage: input.userMessage.content,
        todayISO: input.todayISO,
        currentWeek: currentWeekRefs(packet),
      });
      if (pendingScheduleAnswer.kind === 'cancelled') {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.debug('[pending-schedule-transaction] cancelled', {
          kind: pendingScheduleAnswer.transaction.kind,
          currentStep: pendingScheduleAnswer.transaction.currentStep,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'schedule-transaction-cancelled', pendingScheduleAnswer.reply);
      }
      if (pendingScheduleAnswer.kind === 'clarify') {
        usePendingCoachClarifierStore.getState().setPending({
          ...pendingClarifier,
          missingFields: pendingScheduleAnswer.transaction.missingFields,
          askedQuestion: pendingScheduleAnswer.reply,
          scheduleTransaction: pendingScheduleAnswer.transaction,
          createdAt: pendingClarifier.createdAt,
        });
        logger.debug('[pending-schedule-transaction] clarify', {
          kind: pendingScheduleAnswer.transaction.kind,
          currentStep: pendingScheduleAnswer.transaction.currentStep,
          missingFields: pendingScheduleAnswer.transaction.missingFields,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'schedule-transaction-clarify', pendingScheduleAnswer.reply);
      }
      if (pendingScheduleAnswer.kind === 'complete') {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.warn('[pending-schedule-transaction-resume]', {
          transactionKind: pendingScheduleAnswer.transaction.kind,
          operation:
            pendingScheduleAnswer.command.mode === 'mutate'
              ? pendingScheduleAnswer.command.operation
              : pendingScheduleAnswer.command.mode,
          legacyBlocked: true,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        const transactionProgramEdit = interpretCoachMessageToProgramEdit({
          userMessage: input.userMessage.content,
          todayISO: input.todayISO,
          referenceResolution: packet.referenceResolution ?? null,
          targetFrame: packet.targetFrame ?? null,
          currentWeek: currentWeekRefs(packet),
          resolveVisibleProgramForDate: (date) =>
            resolveLiveVisibleProgramForDate(date, input.todayISO),
          recentMessages,
          candidateCommand: pendingScheduleAnswer.command,
          source: 'pending_clarifier',
        });
        if (isProgramSetupEdit(transactionProgramEdit)) {
          input.appendUser();
          input.clearInput();
          input.startSetupRebuildProgress();
          input.setIsLoading(true);
          try {
            const setupResult = await executeSetupEditInController({
              input,
              programEdit: transactionProgramEdit,
              onProgress: (stage) => setProgress(input, stage),
            });
            input.setCoachProgressLabel(null);
            input.appendAssistant(assistantMessage('schedule-transaction-setup', setupResult.reply));
          } catch (err) {
            logger.error('[coach-send] schedule_transaction_setup_error', {
              message: pendingClarifier.originalMessage,
              answer: input.userMessage.content,
              error: err instanceof Error ? err.message : String(err),
            });
            input.appendAssistant(assistantMessage(
              'schedule-transaction-setup-error',
              "I understood the setup change, but I couldn't rebuild the program safely. I haven't changed the program.",
            ));
          } finally {
            input.clearSetupRebuildProgress();
            input.setIsLoading(false);
            input.setCoachProgressLabel(null);
          }
          return { handled: true };
        }
        const guarded = executeProgramEditWithVisibleGuard({
          input,
          programEdit: transactionProgramEdit,
          draft: null,
          referenceResolution: packet.referenceResolution ?? null,
          userMessage: pendingClarifier.originalMessage,
          source: 'schedule_transaction',
        });
        if (guarded.kind === 'blocked') {
          return replyAndFinish(
            input,
            'schedule-transaction-visible-guard',
            guarded.verification.reply,
          );
        }
        const result = guarded.result;
        recordVerifiedProgramEditMutationFocus(transactionProgramEdit, result, input.todayISO);
        logger.debug('[coach-flow] schedule_transaction_executed', {
          route: result.route,
          executorKind: result.kind,
          applied: result.applied,
          progress: result.progress,
        });
        return replyAndFinish(input, 'schedule-transaction', result.reply);
      }

      const pendingAnswerClassification = await classifyPendingAnswerForController({
        input,
        pending: pendingClarifier,
      });
      const pendingProgramEditAnswer = resolvePendingProgramEditAnswer({
        pending: pendingClarifier,
        userMessage: input.userMessage.content,
        todayISO: input.todayISO,
        currentWeek: currentWeekRefs(packet),
        resolveVisibleProgramForDate: (date) =>
          resolveLiveVisibleProgramForDate(date, input.todayISO),
        pendingAnswerClassification,
      });
      if (pendingProgramEditAnswer.kind === 'complete') {
        logger.warn('[pending-program-edit-resume]', {
          missingFields: pendingClarifier.programEdit?.missingFields ?? pendingClarifier.missingFields,
          targetDate: pendingProgramEditAnswer.programEdit.targetDate,
          targetItemId: pendingProgramEditAnswer.programEdit.targetItemId,
          targetItemTitle: pendingProgramEditAnswer.programEdit.targetItemTitle,
          legacyBlocked: true,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        const guarded = executeProgramEditWithVisibleGuard({
          input,
          programEdit: pendingProgramEditAnswer.programEdit,
          draft: null,
          referenceResolution: packet.referenceResolution ?? null,
          userMessage: pendingClarifier.originalMessage,
          source: 'pending_program_edit_resume',
        });
        if (guarded.kind === 'blocked') {
          return replyAndFinish(
            input,
            'program-edit-resumed-visible-guard',
            guarded.verification.reply,
          );
        }
        const result = guarded.result;
        recordVerifiedProgramEditMutationFocus(pendingProgramEditAnswer.programEdit, result, input.todayISO);
        if (result.kind === 'mutated' && result.applied) {
          usePendingCoachClarifierStore.getState().clearPending();
        }
        logger.debug('[coach-flow] router_executed', {
          route: result.route,
          executorKind: result.kind,
          applied: result.applied,
          progress: result.progress,
          source: 'pending_program_edit_resume',
        });
        return replyAndFinish(input, 'program-edit-resumed', result.reply);
      }
      if (pendingProgramEditAnswer.kind === 'clarify') {
        usePendingCoachClarifierStore.getState().setPending({
          ...pendingClarifier,
          askedQuestion: pendingProgramEditAnswer.reply,
          programEdit: pendingProgramEditAnswer.programEdit,
          candidateItems: pendingProgramEditAnswer.programEdit.candidateItems,
          createdAt: pendingClarifier.createdAt,
        });
        logger.debug('[pending-program-edit] answer_needs_better_clarifier', {
          missingFields: pendingClarifier.programEdit?.missingFields ?? pendingClarifier.missingFields,
          options: pendingProgramEditAnswer.options,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'program-edit-clarify', pendingProgramEditAnswer.reply);
      }
      if (pendingProgramEditAnswer.kind === 'cancelled') {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.debug('[pending-program-edit] cancelled', {
          missingFields: pendingClarifier.programEdit?.missingFields ?? pendingClarifier.missingFields,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'program-edit-cancelled', pendingProgramEditAnswer.reply);
      }

      const resumed = resumeFromPending({
        pending: pendingClarifier,
        newMessage: input.userMessage.content,
        newResolution: packet.referenceResolution ?? null,
      });
      if (resumed && resumed.mode === 'mutate') {
        logger.warn('[pending-clarifier-resume]', {
          operation: pendingClarifier.operation,
          filledTarget:
            resumed.target.kind === 'date' || resumed.target.kind === 'exercise'
              ? {
                  kind: resumed.target.kind,
                  date: resumed.target.date,
                  sessionName: resumed.target.kind === 'date'
                    ? resumed.target.sessionName
                    : resumed.target.exerciseName,
                }
              : { kind: resumed.target.kind },
          legacyBlocked: true,
          ageMs: Date.now() - pendingClarifier.createdAt,
          newMessage: input.userMessage.content.length > 200
            ? `${input.userMessage.content.slice(0, 200)}…`
            : input.userMessage.content,
        });
        usePendingCoachClarifierStore.getState().clearPending();
        const resumedProgramEdit = interpretCoachMessageToProgramEdit({
          userMessage: input.userMessage.content,
          todayISO: input.todayISO,
          referenceResolution: packet.referenceResolution ?? null,
          targetFrame: packet.targetFrame ?? null,
          currentWeek: currentWeekRefs(packet),
          resolveVisibleProgramForDate: (date) =>
            resolveLiveVisibleProgramForDate(date, input.todayISO),
          recentMessages,
          candidateCommand: resumed,
          source: 'pending_clarifier',
        });
        if (isProgramSetupEdit(resumedProgramEdit)) {
          input.appendUser();
          input.clearInput();
          input.startSetupRebuildProgress();
          input.setIsLoading(true);
          try {
            const setupResult = await executeSetupEditInController({
              input,
              programEdit: resumedProgramEdit,
              onProgress: (stage) => setProgress(input, stage),
            });
            input.setCoachProgressLabel(null);
            logger.debug('[coach-flow] pending_program_setup_executed', {
              route: setupResult.route,
              executorKind: setupResult.kind,
              applied: setupResult.applied,
              progress: setupResult.progress,
              source: 'pending_move_scope_resume',
            });
            input.appendAssistant(assistantMessage('pending-program-setup', setupResult.reply));
          } catch (err) {
            logger.error('[coach-send] pending_program_setup_error', {
              message: pendingClarifier.originalMessage,
              answer: input.userMessage.content,
              error: err instanceof Error ? err.message : String(err),
            });
            input.appendAssistant(assistantMessage(
              'pending-program-setup-error',
              "I understood the setup change, but I couldn't rebuild the program safely. I haven't changed the program.",
            ));
          } finally {
            input.clearSetupRebuildProgress();
            input.setIsLoading(false);
            input.setCoachProgressLabel(null);
          }
          return { handled: true };
        }
        const guarded = executeProgramEditWithVisibleGuard({
          input,
          programEdit: resumedProgramEdit,
          draft: null,
          referenceResolution: packet.referenceResolution ?? null,
          userMessage: pendingClarifier.originalMessage,
          source: 'pending_clarifier_resume',
        });
        if (guarded.kind === 'blocked') {
          return replyAndFinish(
            input,
            'resumed-visible-guard',
            guarded.verification.reply,
          );
        }
        const result = guarded.result;
        recordVerifiedProgramEditMutationFocus(resumedProgramEdit, result, input.todayISO);
        logger.debug('[coach-flow] router_executed', {
          route: result.route,
          executorKind: result.kind,
          applied: result.applied,
          progress: result.progress,
          source: 'pending_clarifier_resume',
        });
        return replyAndFinish(input, 'resumed', result.reply);
      }
      if (shouldHoldDurationClarifier(pendingClarifier, input.userMessage.content)) {
        logger.debug('[pending-clarifier] duration_answer_unparseable', {
          operation: pendingClarifier.operation,
          missingFields: pendingClarifier.missingFields,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(
          input,
          'clarifier-duration-restate',
          pendingClarifier.askedQuestion
            ? `${pendingClarifier.askedQuestion} A time like "45 min" or "1 hour" works.`
            : 'How long should it be? A time like "45 min" or "1 hour" works.',
        );
      }
      if (isNegativeClarifierMessage(input.userMessage.content)) {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.debug('[pending-clarifier] negative_dismiss', {
          operation: pendingClarifier.operation,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'clarifier-no', 'Got it — leaving things as they are.');
      }
      if (isAffirmativeClarifierMessage(input.userMessage.content)) {
        logger.debug('[pending-clarifier] affirmative_no_target', {
          operation: pendingClarifier.operation,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(
          input,
          'clarifier-restate',
          pendingClarifier.askedQuestion
            ? `${pendingClarifier.askedQuestion} (a day name like "Wednesday" works.)`
            : 'Which session do you mean? A day name like "Wednesday" works.',
        );
      }
    }

    const liveSendSwapParse = parseModalitySwapRequest(input.userMessage.content);
    const liveSendPendingClarifierBefore = getPendingClarifierSnapshot();
    const liveSendVisibleWeekTargetCount = (packet.currentWeek ?? []).filter(
      (d) => !!d?.workout,
    ).length;
    logger.debug('[coach-live-send] input', {
      text: input.userMessage.content.length > 200
        ? `${input.userMessage.content.slice(0, 200)}…`
        : input.userMessage.content,
      smokeCoachBikeFlow: input.smokeCoachBikeFlow,
      isFocused: input.isFocused,
      wednesdayWorkoutReady: !input.smokeWednesdayMissingReason,
      wednesdayMissingReason: input.smokeWednesdayMissingReason ?? null,
    });
    logger.debug('[coach-live-send] visible_week_target_count', {
      count: liveSendVisibleWeekTargetCount,
    });
    logger.debug('[coach-live-send] smoke_target_date_workout', {
      date: input.smokeWednesdayOpenTarget?.date ?? null,
      workoutId: input.smokeWednesdayOpenTarget?.workoutId ?? null,
      title: input.smokeWednesdayOpenTarget?.title ?? null,
    });
    logger.debug('[coach-live-send] pending_clarifier_state', {
      present: liveSendPendingClarifierBefore != null,
      operation: liveSendPendingClarifierBefore?.operation ?? null,
      ageMs: liveSendPendingClarifierBefore
        ? Date.now() - liveSendPendingClarifierBefore.createdAt
        : null,
    });
    logger.debug('[coach-live-send] injury_guard_state', {
      activeInjury: !!useCoachUpdatesStore.getState().activeInjury,
      pendingInjuryPresent: input.pendingInjury != null,
      pendingInjuryBodyPart: input.pendingInjury?.bodyPart ?? null,
    });

    const smokePrecoachReady =
      input.smokeCoachBikeFlow && input.isFocused && !input.smokeWednesdayMissingReason;
    if (
      smokePrecoachReady &&
      liveSendSwapParse != null &&
      liveSendPendingClarifierBefore != null
    ) {
      usePendingCoachClarifierStore.getState().clearPending();
      logger.warn('[coach-live-send] stale_pending_cleared', {
        operation: liveSendPendingClarifierBefore.operation,
        ageMs: Date.now() - liveSendPendingClarifierBefore.createdAt,
        reason: 'smoke_precoach_ready_with_direct_modality_swap',
      });
    }

    const autoBind = autoBindUniqueModalityTarget(packet, input.userMessage.content);
    if (autoBind.bound && autoBind.boundTarget) {
      packet = autoBind.packet;
      logger.warn('[coach-live-send] reference_synthesised', {
        method: autoBind.boundTarget.method,
        date: autoBind.boundTarget.date,
        sessionName: autoBind.boundTarget.sessionName,
        candidateCount: autoBind.candidateCount,
        previousStatus: 'no_target_or_unresolved',
      });
    } else {
      logger.debug('[coach-live-send] reference_not_auto_bound', {
        reason: autoBind.reason,
        candidateCount: autoBind.candidateCount,
        existingStatus: packet.referenceResolution?.status ?? null,
        existingTarget: !!packet.referenceResolution?.target,
      });
    }

    logger.debug('[coach-program-edit-draft]', {
      intent: packet.programEditDraft?.intent ?? null,
      targetDomain: packet.programEditDraft?.targetDomain ?? null,
      actionScope: packet.programEditDraft?.actionScope ?? null,
      targetDate: packet.programEditDraft?.targetDate ?? null,
      missingFields: packet.programEditDraft?.missingFields ?? [],
      proposedActionCount: packet.programEditDraft?.proposedActions.length ?? 0,
      compatibilityPath: 'coach_command_router',
    });

    const draftFrontDoor = decideProgramEditDraftFrontDoor(packet.programEditDraft);
    if (
      draftFrontDoor.kind === 'ask_clarification' ||
      draftFrontDoor.kind === 'unsupported'
    ) {
      logger.debug('[coach-program-edit-draft-front-door]', {
        kind: draftFrontDoor.kind,
        route: draftFrontDoor.route,
        intent: packet.programEditDraft?.intent ?? null,
        targetDomain: packet.programEditDraft?.targetDomain ?? null,
        actionScope: packet.programEditDraft?.actionScope ?? null,
        missingFields: packet.programEditDraft?.missingFields ?? [],
        legacyBlocked: true,
      });
      return replyAndFinish(input, 'program-edit-draft-front-door', draftFrontDoor.reply);
    }

    logger.debug('[coach-live-send] router_reached', { reached: true });
    const lastUndoableMutation = useCoachMutationHistoryStore
      .getState()
      .getLastUndoableMutation();
    const lastChange = lastUndoableMutation?.affectedDates?.[0]
      ? {
          operation: lastUndoableMutation.operation,
          target: {
            kind: 'date' as const,
            date: lastUndoableMutation.affectedDates[0],
          },
          appliedAt: lastUndoableMutation.timestamp,
          userMessage: lastUndoableMutation.userMessage,
          appliedReply: lastUndoableMutation.appliedReply,
          touchedActivities: lastUndoableMutation.touchedActivities,
        }
      : null;
    const routedProgramEdit = interpretCoachMessageToProgramEdit({
      userMessage: input.userMessage.content,
      todayISO: input.todayISO,
      referenceResolution: packet.referenceResolution ?? null,
      targetFrame: packet.targetFrame ?? null,
      currentWeek: currentWeekRefs(packet),
      resolveVisibleProgramForDate: (date) =>
        resolveLiveVisibleProgramForDate(date, input.todayISO),
      lastChange,
      recentMessages,
    });
    const routedCommand: CoachCommand = routedProgramEdit.command as CoachCommand;
    logger.debug('[coach-live-send] router_emitted', {
      mode: routedCommand.mode,
      reason: 'reason' in routedCommand ? routedCommand.reason : null,
      needsClarification:
        routedCommand.mode === 'mutate' ? routedCommand.needsClarification : null,
      targetKind:
        routedCommand.mode === 'mutate' ? routedCommand.target?.kind ?? null : null,
    });

    logger.debug('[coach-router] command', {
      mode: routedCommand.mode,
      operation: routedCommand.mode === 'mutate' ? routedCommand.operation : null,
      scope: routedCommand.mode === 'mutate' ? routedCommand.scope : null,
      confidence: routedCommand.mode === 'mutate' ? routedCommand.confidence : null,
      needsClarification: routedCommand.mode === 'mutate' ? routedCommand.needsClarification : null,
      reason: 'reason' in routedCommand ? routedCommand.reason : null,
      legacyAllowed: canFallbackToLegacy(routedCommand),
    });

    let commandForExecution: CoachCommand = routedCommand;
    let programEditForExecution = routedProgramEdit;
    const staleDateClarifier = capturePendingDateClarificationFromPastProgramEditTarget({
      programEdit: programEditForExecution,
      command: commandForExecution,
      draft: packet.programEditDraft,
      originalMessage: input.userMessage.content,
      todayISO: input.todayISO,
    });
    if (staleDateClarifier) {
      usePendingCoachClarifierStore.getState().setPending(staleDateClarifier);
      const route = staleDateClarifier.pendingClarification?.reason ??
        'pending_clarification:target_date:past_date';
      input.setLastCoachDebug({
        intent: 'coach_command_router',
        route,
        referenceStatus: packet.referenceResolution?.status ?? null,
        referenceTargetDate:
          programEditForExecution.targetDate ??
          packet.referenceResolution?.target?.date ??
          null,
        referenceTargetName:
          programEditForExecution.targetItemTitle ??
          packet.referenceResolution?.target?.sessionName ??
          null,
        mutationLike: true,
        legacyCalled: false,
        replySource: 'deterministic',
        applied: false,
      });
      logger.warn('[pending-clarifier-set]', {
        operation: staleDateClarifier.operation,
        scope: staleDateClarifier.scope,
        missingFields: staleDateClarifier.missingFields,
        partialPayload: staleDateClarifier.partialPayload,
        targetStatus: (commandForExecution as any).target?.kind ?? 'absent',
        askedQuestion: staleDateClarifier.askedQuestion?.length > 200
          ? `${staleDateClarifier.askedQuestion.slice(0, 200)}…`
          : staleDateClarifier.askedQuestion,
        source: 'program_edit_stale_target_date',
      });
      return replyAndFinish(
        input,
        'program-edit-stale-target-date',
        staleDateClarifier.askedQuestion,
      );
    }
    if (shouldTryLLMCoachCommand(routedCommand, input.userMessage.content)) {
      const llmIntent = await input.classifier.classify(packet);
      classifiedCoachIntent = llmIntent;
      const adapted = coachCommandFromLLMIntent(llmIntent, packet);
      logger.debug('[coach-llm-command]', {
        intent: llmIntent.intent,
        confidence: llmIntent.confidence,
        needsClarification: llmIntent.needsClarification,
        adapterKind: adapted.kind,
        reason: adapted.kind === 'ignored' ? adapted.reason : adapted.command.reason,
      });
      if (adapted.kind === 'command') {
        programEditForExecution = interpretCoachMessageToProgramEdit({
          userMessage: input.userMessage.content,
          todayISO: input.todayISO,
          referenceResolution: packet.referenceResolution ?? null,
          targetFrame: packet.targetFrame ?? null,
          currentWeek: currentWeekRefs(packet),
          resolveVisibleProgramForDate: (date) =>
            resolveLiveVisibleProgramForDate(date, input.todayISO),
          lastChange,
          recentMessages,
          candidateCommand: adapted.command,
          source: 'llm_adapter',
        });
        commandForExecution = programEditForExecution.command as CoachCommand;
      } else if (adapted.kind === 'clarify') {
        const clarifyCommand = adapted.command;
        const captured = captureFromExecutorClarify({
          routedCommand: clarifyCommand,
          askedQuestion: clarifyCommand.question,
          originalMessage: input.userMessage.content,
          todayISO: input.todayISO,
          referenceResolution: packet.referenceResolution,
          candidateItems: programEditForExecution.candidateItems,
        });
        if (captured) {
          usePendingCoachClarifierStore.getState().setPending(captured);
          logger.warn('[pending-clarifier-set]', {
            operation: captured.operation,
            scope: captured.scope,
            missingFields: captured.missingFields,
            partialPayload: captured.partialPayload,
            targetStatus: packet.referenceResolution?.target ? 'resolved' : 'absent',
            askedQuestion: captured.askedQuestion?.length > 200
              ? `${captured.askedQuestion.slice(0, 200)}…`
              : captured.askedQuestion,
            source: 'llm_command_adapter',
          });
        }
        return replyAndFinish(input, 'llm-command-clarify', clarifyCommand.question);
      }
    }

    const draftExecutionGuard = validateProgramEditAgainstDraft(
      packet.programEditDraft,
      programEditForExecution,
    );
    if (draftExecutionGuard.kind === 'blocked') {
      logger.debug('[coach-program-edit-draft-execution-guard]', {
        route: draftExecutionGuard.route,
        reason: draftExecutionGuard.reason,
        draftIntent: packet.programEditDraft?.intent ?? null,
        draftTargetDomain: packet.programEditDraft?.targetDomain ?? null,
        draftActionScope: packet.programEditDraft?.actionScope ?? null,
        finalIntent: programEditForExecution.intent,
        finalTargetDomain: programEditForExecution.targetDomain,
        finalEditScope: 'editScope' in programEditForExecution
          ? programEditForExecution.editScope ?? null
          : null,
        legacyBlocked: true,
      });
      return replyAndFinish(input, 'program-edit-draft-guard', draftExecutionGuard.reply);
    }

    if (isProgramSetupEdit(programEditForExecution)) {
      logger.debug('[coach-send] message_appended', {
        source: 'program_setup_pre_rebuild',
        messageId: input.userMessage.id,
        route: programEditForExecution.command?.mode === 'mutate'
          ? programEditForExecution.command.operation
          : programEditForExecution.command?.mode ?? null,
      });
      input.appendUser();
      input.clearInput();
      input.startSetupRebuildProgress();
      input.setIsLoading(true);

      try {
        const result = await executeSetupEditInController({
          input,
          programEdit: programEditForExecution,
          onProgress: (stage) => setProgress(input, stage),
        });
        input.setCoachProgressLabel(null);

        if (result.kind === 'mutated' || result.kind === 'rejected' || result.kind === 'error') {
          if (getPendingClarifierSnapshot()) {
            usePendingCoachClarifierStore.getState().clearPending();
            logger.debug('[pending-clarifier] superseded', {
              by: result.kind,
              route: result.route,
            });
          }
        }

        input.setLastCoachDebug({
          intent: 'program_setup_edit',
          route: result.route,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: null,
          referenceTargetName: null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: result.applied,
        });
        logger.debug('[coach-flow] program_setup_executed', {
          route: result.route,
          executorKind: result.kind,
          applied: result.applied,
          progress: result.progress,
          legacyCalled: false,
        });
        logger.debug('[coach-transaction]', {
          message: input.userMessage.content,
          intent: 'program_setup_edit',
          route: result.route,
          pendingProposalBefore: input.pendingCoachProposal,
          mutationAttempted: true,
          eventsEmitted: result.applied ? 1 : 0,
          eventsApplied: result.applied ? 1 : 0,
          visibleDiff: result.applied ? [{ kind: 'program_setup_rebuild' }] : [],
          replyMode: result.applied
            ? 'program_adjustment_applied'
            : 'program_adjustment_failed',
        });
        input.appendAssistant(assistantMessage('program-setup', result.reply));
      } catch (err) {
        logger.error('[coach-send] program_setup_error', {
          message: input.userMessage.content,
          error: err instanceof Error ? err.message : String(err),
        });
        input.setLastCoachDebug({
          intent: 'program_setup_edit',
          route: 'program_setup_unhandled_error',
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: null,
          referenceTargetName: null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        input.appendAssistant(assistantMessage(
          'program-setup-error',
          "I understood the setup change, but I couldn't rebuild the program safely. I haven't changed the program.",
        ));
      } finally {
        input.clearSetupRebuildProgress();
        input.setIsLoading(false);
        input.setCoachProgressLabel(null);
      }
      return { handled: true };
    }

    if (isMutateCommand(commandForExecution)) {
      const guarded = executeProgramEditWithVisibleGuard({
        input,
        programEdit: programEditForExecution,
        draft: packet.programEditDraft,
        referenceResolution: packet.referenceResolution ?? null,
        userMessage: input.userMessage.content,
        source: 'router',
      });
      if (guarded.kind === 'blocked') {
        input.setLastCoachDebug({
          intent: 'coach_command_router',
          route: guarded.verification.route,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate:
            programEditForExecution.targetDate ??
            packet.referenceResolution?.target?.date ??
            null,
          referenceTargetName:
            programEditForExecution.targetItemTitle ??
            packet.referenceResolution?.target?.sessionName ??
            null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        return replyAndFinish(
          input,
          'program-edit-draft-visible-guard',
          guarded.verification.reply,
        );
      }
      const result = guarded.result;
      recordVerifiedProgramEditMutationFocus(programEditForExecution, result, input.todayISO);
      const dateClarifier = capturePendingDateClarificationFromProgramEditRejection({
        result,
        programEdit: programEditForExecution,
        command: commandForExecution,
        draft: packet.programEditDraft,
        originalMessage: input.userMessage.content,
        todayISO: input.todayISO,
      });

      if (result.kind === 'clarify') {
        const captured = captureFromExecutorClarify({
          routedCommand: commandForExecution,
          askedQuestion: result.reply,
          originalMessage: input.userMessage.content,
          todayISO: input.todayISO,
          missingFields:
            programEditForExecution.missingFields.length > 0
              ? programEditForExecution.missingFields
              : commandForExecution.mode === 'mutate'
                ? commandForExecution.missingFields
                : undefined,
          referenceResolution: packet.referenceResolution,
          programEdit: programEditForExecution,
          candidateItems: programEditForExecution.candidateItems,
        });
        if (captured) {
          usePendingCoachClarifierStore.getState().setPending(captured);
          logger.warn('[pending-clarifier-set]', {
            operation: captured.operation,
            scope: captured.scope,
            missingFields: captured.missingFields,
            partialPayload: captured.partialPayload,
            targetStatus: (commandForExecution as any).target?.kind ?? 'absent',
            askedQuestion: captured.askedQuestion?.length > 200
              ? `${captured.askedQuestion.slice(0, 200)}…`
              : captured.askedQuestion,
          });
        }
      } else if (dateClarifier) {
        usePendingCoachClarifierStore.getState().setPending(dateClarifier);
        logger.warn('[pending-clarifier-set]', {
          operation: dateClarifier.operation,
          scope: dateClarifier.scope,
          missingFields: dateClarifier.missingFields,
          partialPayload: dateClarifier.partialPayload,
          targetStatus: (commandForExecution as any).target?.kind ?? 'absent',
          askedQuestion: dateClarifier.askedQuestion?.length > 200
            ? `${dateClarifier.askedQuestion.slice(0, 200)}…`
            : dateClarifier.askedQuestion,
          source: 'program_edit_date_rejection',
        });
      } else if (result.kind === 'mutated' || result.kind === 'rejected'
              || result.kind === 'rejected_with_alternatives') {
        if (getPendingClarifierSnapshot()) {
          usePendingCoachClarifierStore.getState().clearPending();
          logger.debug('[pending-clarifier] superseded', {
            by: result.kind,
          });
        }
      }

      const debugSnapshot = {
        intent: 'coach_command_router',
        route: result.route,
        referenceStatus: packet.referenceResolution?.status ?? null,
        referenceTargetDate: result.modalityOutcome?.targetDate
          ?? packet.referenceResolution?.target?.date
          ?? null,
        referenceTargetName: result.modalityOutcome?.targetSessionName
          ?? packet.referenceResolution?.target?.sessionName
          ?? null,
        mutationLike: true,
        legacyCalled: false,
        replySource: 'deterministic' as const,
        applied: result.applied,
        fromModality: result.modalityOutcome?.fromModality ?? null,
        toModality: result.modalityOutcome?.toModality ?? null,
        projectionShowsTo: result.modalityOutcome?.projectionShowsTo ?? null,
        projectionShowsFrom: result.modalityOutcome?.projectionShowsFrom ?? null,
      };
      input.setLastCoachDebug(debugSnapshot);
      logger.debug('[coach-flow] router_executed', {
        ...debugSnapshot,
        executorKind: result.kind,
        progress: result.progress,
      });
      logger.debug('[coach-transaction]', {
        message: input.userMessage.content,
        intent: 'coach_command_router',
        route: result.route,
        pendingProposalBefore: input.pendingCoachProposal,
        mutationAttempted: true,
        eventsEmitted: result.applied ? 1 : 0,
        eventsApplied: result.applied ? 1 : 0,
        visibleDiff: result.applied
          ? [{ date: result.modalityOutcome?.targetDate, kind: 'router_command' }]
          : [],
        replyMode: result.applied
          ? 'program_adjustment_applied'
          : 'program_adjustment_failed',
      });
      return replyAndFinish(input, 'router', dateClarifier?.askedQuestion ?? result.reply);
    }

    if (routedCommand.mode === 'clarify') {
      const captured = captureFromExecutorClarify({
        routedCommand,
        askedQuestion: routedCommand.question,
        originalMessage: input.userMessage.content,
        todayISO: input.todayISO,
        missingFields: routedProgramEdit.missingFields,
        referenceResolution: packet.referenceResolution,
        programEdit: routedProgramEdit,
        candidateItems: routedProgramEdit.candidateItems,
      });
      if (captured) {
        usePendingCoachClarifierStore.getState().setPending(captured);
        logger.warn('[pending-clarifier-set]', {
          operation: captured.operation,
          scope: captured.scope,
          missingFields: captured.missingFields,
          partialPayload: captured.partialPayload,
          targetStatus: packet.referenceResolution?.target ? 'resolved' : 'absent',
          askedQuestion: captured.askedQuestion?.length > 200
            ? `${captured.askedQuestion.slice(0, 200)}…`
            : captured.askedQuestion,
          source: 'router_clarify_mode',
        });
      } else {
        logger.debug('[pending-clarifier] not_captured_for_clarify', {
          reason: routedCommand.reason ?? 'unknown',
          hasReferenceTarget: !!packet.referenceResolution?.target,
        });
      }
      return replyAndFinish(input, 'clarify', routedCommand.question);
    }

    const readinessAction = routeCoachReadinessMessage({
      message: input.userMessage.content,
      pending: input.pendingReadiness,
    });
    if ('clearPending' in readinessAction && readinessAction.clearPending) {
      input.setPendingReadiness(null);
    }
    if (readinessAction.kind === 'clarify') {
      input.setPendingReadiness(readinessAction.pending);
      logger.debug('[coach-readiness] clarify', {
        reason: readinessAction.reason,
      });
      return replyAndFinish(input, 'readiness-clarify', readinessAction.reply);
    }
    if (readinessAction.kind === 'apply_signal') {
      useReadinessStore.getState().setReadinessSignal(input.todayISO, {
        ...readinessAction.signal,
        source: 'coach_message',
      });
      logger.debug('[coach-readiness] applied', {
        reason: readinessAction.reason,
        todayISO: input.todayISO,
        signal: readinessAction.signal,
      });
      return replyAndFinish(
        input,
        'readiness',
        [
          buildSessionAwareReadinessReply(readinessAction, input.todayISO),
          describeTodayReadinessImpact(input.todayISO),
        ].join('\n\n'),
      );
    }

    const intent: CoachIntent = {
      intent: 'general_question',
      confidence: 0,
      needsClarification: false,
      rationale: `router_mode_${routedCommand.mode}_bypass`,
    };
    classifiedCoachIntent = intent;
    logger.debug('[coach-flow] intent', {
      kind: intent.intent,
      confidence: intent.confidence,
      needsClarification: intent.needsClarification,
      source: 'router_bypass',
    });

    const deps = buildLiveDispatchDeps(input.todayISO);
    const outcome = dispatchCoachIntent(intent, packet, deps);

    if (outcome.handled) {
      if (outcome.pendingCoachProposal !== undefined) {
        input.setPendingCoachProposal(outcome.pendingCoachProposal);
      }
      if (outcome.referencedSession) {
        const day = packet.currentWeek.find(
          (d) => d.date === outcome.referencedSession!.date,
        );
        const modalities = day?.workout
          ? extractModalitiesFromSession({
              name: day.workout.name,
              exercises: day.workout.exercises,
            })
          : undefined;
        useCoachContextStateStore.getState().setLastExplainedSession({
          date: outcome.referencedSession.date,
          sessionName: outcome.referencedSession.sessionName,
          modalities,
          source: 'coach_explanation',
        });
        logger.debug('[coach-flow] last_explained_set', {
          date: outcome.referencedSession.date,
          sessionName: outcome.referencedSession.sessionName,
          replyMode: outcome.replyMode,
        });
      }
      logger.debug('[coach-transaction]', {
        message: input.userMessage.content,
        intent: intent.intent,
        route: outcome.transaction?.route ?? outcome.replyMode,
        pendingProposalBefore: outcome.transaction?.pendingProposalBefore ?? null,
        mutationAttempted: outcome.transaction?.mutationAttempted ?? outcome.mutated,
        eventsEmitted: outcome.transaction?.eventsEmitted ?? 0,
        eventsApplied: outcome.transaction?.eventsApplied ?? 0,
        visibleDiff: outcome.transaction?.visibleDiff ?? [],
        replyMode: outcome.replyMode,
      });
      logger.debug('[coach-flow] dispatcher_handled', {
        replyMode: outcome.replyMode,
        mutated: outcome.mutated,
      });
      input.setLastCoachDebug({
        intent: intent.intent,
        route: outcome.transaction?.route ?? outcome.replyMode,
        referenceStatus: packet.referenceResolution?.status ?? null,
        referenceTargetDate: outcome.referencedSession?.date
          ?? packet.referenceResolution?.target?.date
          ?? null,
        referenceTargetName: outcome.referencedSession?.sessionName
          ?? packet.referenceResolution?.target?.sessionName
          ?? null,
        mutationLike: false,
        legacyCalled: false,
        replySource: 'deterministic',
      });
      return replyAndFinish(input, 'dispatch', outcome.reply);
    }
    logger.debug('[coach-flow] dispatcher_passed', {
      replyMode: outcome.replyMode,
      intent: intent.intent,
    });
    if (isPendingProgramProposalExpired(input.pendingCoachProposal)) {
      input.setPendingCoachProposal(null);
    }

    const mutationLike = isMutationLike(input.userMessage.content);
    if (mutationLike) {
      const refRes = packet.referenceResolution ?? null;
      let reply: string;
      let gateReason: string;
      if (refRes?.status === 'resolved' && refRes.target) {
        gateReason = 'mutation_unsupported_target_resolved';
        const dayLabel = (() => {
          try {
            return new Date(`${refRes.target.date}T12:00:00`)
              .toLocaleDateString(undefined, { weekday: 'long' });
          } catch {
            return refRes.target.date;
          }
        })();
        reply =
          `I can see you mean ${dayLabel}'s ${refRes.target.sessionName}, ` +
          `but I can't apply that change automatically yet. ` +
          `I'm not going to pretend it's done.`;
      } else if (refRes?.clarifierQuestion) {
        gateReason = `mutation_clarifier_${refRes.status}`;
        reply = refRes.clarifierQuestion;
      } else {
        gateReason = 'mutation_no_target';
        reply = 'Which session do you mean?';
      }
      logger.debug('[coach-flow] mutation_truth_gate', {
        reason: gateReason,
        referenceStatus: refRes?.status ?? null,
        referenceTarget: refRes?.target ?? null,
      });
      logger.debug('[coach-transaction]', {
        message: input.userMessage.content,
        intent: classifiedCoachIntent?.intent ?? 'mutation_truth_gate',
        route: 'mutation_truth_gate',
        pendingProposalBefore: input.pendingCoachProposal,
        mutationAttempted: false,
        eventsEmitted: 0,
        eventsApplied: 0,
        visibleDiff: [],
        replyMode: 'program_adjustment_failed',
      });
      return replyAndFinish(input, 'truth-gate', reply);
    }
  } catch (err) {
    logger.warn('[coach-flow] dispatcher_error', {
      detail: err instanceof Error ? err.message : String(err),
    });
    if (
      input.pendingCoachProposal ||
      classifiedCoachIntent?.intent === 'request_program_adjustment'
    ) {
      input.setPendingCoachProposal(null);
      logger.debug('[coach-transaction]', {
        message: input.userMessage.content,
        intent: classifiedCoachIntent?.intent ?? 'dispatcher_error',
        route: 'program_adjustment_dispatcher_error',
        pendingProposalBefore: null,
        mutationAttempted: false,
        eventsEmitted: 0,
        eventsApplied: 0,
        visibleDiff: [],
        replyMode: 'program_adjustment_failed',
      });
      return replyAndFinish(
        input,
        'program-adjustment-error',
        "I tried to handle that program adjustment, but it didn't land in the visible program. I'm not going to pretend it changed.",
      );
    }
  }

  logger.debug('[coach-flow] legacy_fallback', {
    reason: 'dispatcher_did_not_handle',
  });
  logger.debug('[coach-transaction]', {
    message: input.userMessage.content,
    intent: 'legacy_fallback',
    route: 'legacy_fallback',
    pendingProposalBefore: input.pendingCoachProposal,
    mutationAttempted: false,
    eventsEmitted: 0,
    eventsApplied: 0,
    visibleDiff: [],
    replyMode: 'fall_through',
  });
  input.setLastCoachDebug({
    intent: classifiedCoachIntent?.intent ?? 'legacy_fallback',
    route: 'legacy_fallback',
    referenceStatus: null,
    referenceTargetDate: null,
    referenceTargetName: null,
    mutationLike: false,
    legacyCalled: true,
    replySource: 'legacy',
  });
  return { handled: false, classifiedCoachIntent };
}
