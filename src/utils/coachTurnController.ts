import { generateProgramFromProfile } from '../services/api/generateProgram';
import { getCurrentBlockNumberForGeneration, useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useCalendarStore } from '../store/calendarStore';
import {
  captureAcceptedLoadEditLedgerBaseline,
  commitAcceptedStateTransaction,
  commitExplicitLoadEditLedgerFromBaseline,
  commitProgramSetupRebuildTransaction,
} from '../store/acceptedStateTransaction';
import { runCoachMutationTransaction } from '../store/coachMutationTransaction';
import type { DayOfWeek } from '../types/domain';
import {
  usePendingCoachClarifierStore,
  getPendingClarifierSnapshot,
  isCancelClarifierMessage,
  isAffirmativeClarifierMessage,
  isNegativeClarifierMessage,
  classifyPendingClarificationAnswer,
  type PendingClarificationAnswerClassification,
  type PendingClarificationExpectedAnswerType,
  type PendingCoachClarifier,
  type PendingCoachRevisionClarification,
  type PendingCoachRevisionProposalEnvelope,
  type PendingProgramEditDraftEnvelope,
  type PendingProgramEditDraftSource,
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
  programEditFromSemanticProgramEditDraft,
  resolvePendingProgramEditAnswer,
  type ProgramEdit,
} from './coachProgramEdit';
import {
  buildProgramEditDraft,
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
  buildSemanticProgramEditDraft,
  type SemanticProgramEditDraftAdapter,
  type SemanticProgramEditDraftResult,
} from './semanticProgramEditDraft';
import {
  captureFromExecutorClarify,
  resumeFromPending,
  resolvePendingGameDayReadinessAnswer,
  resolvePendingScheduleTransactionAnswer,
} from './coachClarifierResume';
import {
  createTemporaryEquipmentFact,
  createTemporaryFatigueFact,
  createTemporaryPoorSleepFact,
  createTemporaryScheduleFact,
  createTemporarySorenessFact,
  createTemporaryTimeCapFact,
  isInjurySourceFact,
  isNonInjuryTemporarySourceFact,
  isTemporaryScheduleFact,
  temporaryFactScope,
  temporarySourceFactId,
  type TemporaryPoorSleepFact,
  type TemporarySourceFact,
} from '../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { resolveInjuryBucket } from './programAdjustmentEngine';
import { isPendingProgramProposalExpired } from './programAdjustmentRequests';
import { buildScheduleStateImperative } from './coachWeekDiff';
import {
  buildDayWorkoutProjectedDay,
  buildProgramTabProjectedWeek,
  getResolvedVisibleProgramForDate,
} from './visibleProgramReadModel';
import { getMondayForDate } from './sessionResolver';
import {
  buildCoachRevisionDiff,
  type CoachRevisionDiff,
  buildCoachRevisionWeekSnapshotFromProjectedDays,
  coachRevisionSectionBodySignature,
  snapshotProjectedDay,
  validateCoachRevisionDiff,
  type CoachRevisionIntent,
  type CoachRevisionProposal,
} from './coachRevisionProposal';
import {
  buildCoachRevisionTemplateSection,
  listCoachRevisionTemplates,
  visibleDayLooksLikeGame,
} from './coachRevisionTemplates';
import { coachRevisionValidationPolicyForWeek } from './coachRevisionPolicy';
import {
  buildSemanticCoachRevisionProposal,
  type CoachRevisionProposalMode,
  type CoachRevisionShadowDiagnostic,
  type SemanticCoachRevisionProposalAdapter,
  type SemanticCoachRevisionProposalResult,
} from './semanticCoachRevisionProposal';
import {
  applyCoachRevisionDateOverrides,
  coachRevisionSemanticContractsMatch,
} from './coachRevisionOverrideWriter';
import {
  type ProgramEditRiskAssessment,
  type ProgramEditRiskFinding,
} from './programEditRiskAssessment';
import { assessProgramEditWrites } from './programEditWriteGuard';
import type { ValidateProgramWeekInput } from '../rules/weekStructureValidator';
import { logger } from './logger';
import {
  firstSemanticDoseChange,
  semanticFingerprint,
  semanticDiffChangesLever,
  semanticDiffHasMaterialReductionForLever,
  type SemanticProgramDiff,
} from './programSemanticSnapshot';
import { executeCoachSessionOutcome } from './coachSessionOutcome';

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

export type SemanticProgramEditDraftMode = 'off' | 'shadow' | 'active';

export interface SemanticProgramEditDraftControllerDiagnostic {
  mode: Exclude<SemanticProgramEditDraftMode, 'off'>;
  kind: SemanticProgramEditDraftResult['kind'];
  confidence: number | null;
  reason: string | null;
  issues?: string[];
  draft?: {
    intent: string;
    targetDomain: string;
    actionScope: string;
    targetDate: string | null;
    isCompound: boolean;
    missingFields: string[];
  };
}

export interface CoachRevisionProposalControllerDiagnostic {
  mode: Exclude<CoachRevisionProposalMode, 'off'>;
  kind: SemanticCoachRevisionProposalResult['kind'];
  confidence: number | null;
  diagnostic: CoachRevisionShadowDiagnostic;
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
  semanticProgramEditDraftMode?: SemanticProgramEditDraftMode;
  semanticProgramEditDraftRawMode?: string;
  semanticProgramEditDraftActiveAllowed?: boolean;
  enableSemanticProgramEditDraft?: boolean;
  semanticProgramEditDraftAdapter?: SemanticProgramEditDraftAdapter | null;
  semanticProgramEditDraftMinConfidence?: number;
  semanticProgramEditDraftNowISO?: string;
  semanticProgramEditDraftTimezone?: string;
  onSemanticProgramEditDraftDiagnostic?: (
    diagnostic: SemanticProgramEditDraftControllerDiagnostic,
  ) => void;
  coachRevisionProposalMode?: CoachRevisionProposalMode;
  coachRevisionProposalRawMode?: string;
  coachRevisionProposalActiveAllowed?: boolean;
  coachRevisionProposalAdapter?: SemanticCoachRevisionProposalAdapter | null;
  coachRevisionProposalMinConfidence?: number;
  onCoachRevisionProposalDiagnostic?: (
    diagnostic: CoachRevisionProposalControllerDiagnostic,
  ) => void;
}


const COACH_TURN_DIAGNOSTIC_MARKER = 'coach-turn-diagnostics:6fa216a-cond1';

/**
 * Self-truthing build fingerprint for turn_start diagnostics. The manual
 * marker above proved unreliable (it was forgotten across several commits and
 * a stale Metro bundle went undetected). These values are DERIVED from code
 * that ships in the bundle, so a stale bundle exposes itself in the logs
 * without anyone remembering to bump a string.
 */
function coachTurnBuildFingerprint() {
  return {
    templateRegistryCount: listCoachRevisionTemplates().length,
    templateRegistryIds: listCoachRevisionTemplates()
      .map((template) => template.templateId)
      .sort()
      .join(','),
  };
}

function coachTurnDiagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function draftDiagnosticSummary(draft: ProgramEditDraft | null | undefined) {
  if (!draft) return null;
  return {
    source: draft.reason,
    intent: draft.intent,
    targetDomain: draft.targetDomain,
    actionScope: draft.actionScope,
    targetDate: draft.targetDate,
    targetItemId: draft.targetItemId,
    protectedTargets: draft.protectedTargets.map((target) => ({
      targetDomain: target.targetDomain,
      actionScope: target.actionScope,
      targetDate: target.targetDate ?? null,
      title: target.title ?? null,
    })),
    missingFields: draft.missingFields,
  };
}

function programEditDiagnosticSummary(edit: ProgramEdit | null | undefined) {
  if (!edit) return null;
  return {
    intent: edit.intent,
    targetDomain: edit.targetDomain,
    editScope: 'editScope' in edit ? edit.editScope ?? null : null,
    targetDate: edit.targetDate,
    targetItemId: edit.targetItemId ?? null,
    targetItemTitle: edit.targetItemTitle ?? null,
    missingFields: edit.missingFields,
  };
}

function pendingDiagnosticSummary(pending: PendingCoachClarifier | null | undefined) {
  if (!pending) return null;
  // Diagnostics are observers, never actors: a summary must NEVER throw,
  // because a diagnostics exception inside the revision path would hand the
  // turn to legacy dispatch (observed live 2026-07-02 via an unguarded
  // partialIntent read on a clarify-origin envelope).
  try {
    return {
      operation: pending.operation,
      missingFields: pending.missingFields,
      askedQuestion: pending.askedQuestion ?? null,
      pendingClarification: pending.pendingClarification
        ? {
            missingField: pending.pendingClarification.missingField,
            expectedAnswerType: pending.pendingClarification.expectedAnswerType,
            source: pending.pendingClarification.source ?? null,
            proposedCandidate: pending.pendingClarification.proposedCandidate ?? null,
            requestedDow: pending.pendingClarification.requestedDow ?? null,
            staleDate: pending.pendingClarification.staleDate ?? null,
          }
        : null,
      storedDraft: draftDiagnosticSummary(pending.programEditDraftEnvelope?.draft),
      storedRevision: pending.coachRevisionProposalEnvelope
        ? {
            source: pending.coachRevisionProposalEnvelope.source,
            continuationId: pending.coachRevisionProposalEnvelope.continuationId,
            originalUserWording: pending.coachRevisionProposalEnvelope.originalUserWording,
            intent: pending.coachRevisionProposalEnvelope.partialIntent?.intent ?? null,
            targetDomain: pending.coachRevisionProposalEnvelope.partialIntent?.targetDomain ?? null,
            actionScope: pending.coachRevisionProposalEnvelope.partialIntent?.actionScope ?? null,
            targetDates: pending.coachRevisionProposalEnvelope.partialIntent?.targetDates ?? [],
            protectedRefs: pending.coachRevisionProposalEnvelope.partialIntent?.protectedRefs ?? [],
            clarificationRounds:
              pending.coachRevisionProposalEnvelope.clarifications?.length ?? 0,
            riskConfirmation:
              pending.coachRevisionProposalEnvelope.riskConfirmation
                ? {
                    signature: pending.coachRevisionProposalEnvelope.riskConfirmation.signature,
                    decision: pending.coachRevisionProposalEnvelope.riskConfirmation.assessment.decision,
                    highestLevel: pending.coachRevisionProposalEnvelope.riskConfirmation.assessment.highestLevel,
                    ruleIds: pending.coachRevisionProposalEnvelope.riskConfirmation.assessment.findings
                      .map((finding) => finding.ruleId),
                  }
                : null,
          }
        : null,
      storedProgramEdit: programEditDiagnosticSummary(pending.programEdit),
    };
  } catch (err) {
    return {
      diagnosticError: err instanceof Error ? err.message : String(err),
      operation: pending.operation,
    };
  }
}

function classificationDiagnosticSummary(
  classification: PendingClarificationAnswerClassification | null | undefined,
) {
  if (!classification) return null;
  return {
    kind: classification.kind,
    confidence: classification.confidence,
    reason: classification.reason,
    candidate: 'candidate' in classification ? classification.candidate ?? null : null,
  };
}

function pendingDraftOnlyPatchedTargetDate(
  before: ProgramEditDraft | null | undefined,
  after: ProgramEditDraft | null | undefined,
): boolean | null {
  if (!before || !after) return null;
  return (
    before.targetDate !== after.targetDate &&
    before.intent === after.intent &&
    before.targetDomain === after.targetDomain &&
    before.actionScope === after.actionScope &&
    JSON.stringify(before.protectedTargets) === JSON.stringify(after.protectedTargets) &&
    before.proposedActions.length === after.proposedActions.length
  );
}

function emitCoachTurnDiagnostic(event: string, payload: Record<string, unknown>) {
  if (!coachTurnDiagnosticsEnabled()) return;
  logger.warn('[coach-turn-diagnostic]', {
    marker: COACH_TURN_DIAGNOSTIC_MARKER,
    event,
    ...payload,
  });
}

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

async function executeProgramEditWithVisibleGuard(args: {
  input: CoachTurnControllerInput;
  programEdit: ProgramEdit;
  draft: ProgramEditDraft | null | undefined;
  referenceResolution: any;
  userMessage: string;
  source: string;
}): Promise<ProgramEditVisibleGuardRun> {
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
  const explicitLoadReduction = args.draft?.intent === 'reduce' ||
    args.programEdit.semanticRoles?.actionIntent === 'reduce' ||
    ('editScope' in args.programEdit && args.programEdit.editScope === 'reduce_strength_block');
  const loadEditBaseline = explicitLoadReduction
    ? captureAcceptedLoadEditLedgerBaseline()
    : null;
  const mutationDates = programEditMutationDates(args.programEdit, verifierDraft);
  let latestVisibleVerification: CoachVisibleDomainVerificationResult = {
    ok: true,
    route: 'program_edit_draft_visible_guard_ok',
  };
  const transaction = await runCoachMutationTransaction({
    todayISO: args.input.todayISO,
    extraDates: mutationDates,
    mutate: () => {
      const result = executeProgramEdit({
        programEdit: args.programEdit,
        todayISO: args.input.todayISO,
        referenceResolution: args.referenceResolution,
        userMessage: args.userMessage,
        onProgress: (stage) => setProgress(args.input, stage),
      });
      if (loadEditBaseline && result.kind === 'mutated' && result.applied) {
        commitExplicitLoadEditLedgerFromBaseline({
          baseline: loadEditBaseline,
          sourceActionOrIntentId: `coach-load-edit:${semanticFingerprint({
            message: args.userMessage,
            dates: mutationDates,
            scope: 'editScope' in args.programEdit ? args.programEdit.editScope : null,
          })}`,
          affectedDates: mutationDates,
          sourceActor: 'athlete',
          sourceSurface: 'coach_chat',
        });
      }
      return result;
    },
    didApply: (result) => result.kind === 'mutated' && result.applied,
    verifyCandidate: ({ value: result, diff }) => {
      const visibleVerification = verifyDraftVisibleExecution({
        draft: verifierDraft,
        edit: args.programEdit,
        result,
        before,
        todayISO: args.input.todayISO,
      });
      latestVisibleVerification = visibleVerification;
      if (visibleVerification.ok === false) {
        return {
          ok: false,
          reason: visibleVerification.reason,
          details: visibleVerification.details,
        };
      }
      return verifyProgramEditSemanticIntent(args.programEdit, verifierDraft, diff);
    },
    verifyAfterPersistence: ({ value: result }) => {
      const visibleVerification = verifyDraftVisibleExecution({
        draft: verifierDraft,
        edit: args.programEdit,
        result,
        before,
        todayISO: args.input.todayISO,
      });
      latestVisibleVerification = visibleVerification;
      if (visibleVerification.ok === false) {
        return { ok: false, reason: visibleVerification.reason };
      }
      return { ok: true };
    },
  });
  args.input.setCoachProgressLabel(null);

  if (transaction.ok === false) {
    if (
      transaction.value &&
      !(transaction.value.kind === 'mutated' && transaction.value.applied)
    ) {
      return { kind: 'ok', result: transaction.value };
    }
    const latest = latestVisibleVerification as CoachVisibleDomainVerificationResult;
    const verification: Extract<CoachVisibleDomainVerificationResult, { ok: false }> =
      latest.ok === false
        ? latest
        : {
            ok: false,
            route: `program_edit_transaction_failed:${transaction.route}`,
            reason: transaction.reason,
            reply: "I couldn't safely apply that change, so I left the plan unchanged.",
            details: { rollbackVerified: transaction.rollbackVerified },
          };
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
      resultRoute: transaction.value?.route ?? transaction.route,
      resultReplyWasDone: /^Done\b/i.test(transaction.value?.reply ?? ''),
    });
    return {
      kind: 'blocked',
      result: transaction.value ?? failedCoachMutationExecutionResult(transaction.route),
      verification,
    };
  }

  return {
    kind: 'ok',
    result: {
      ...transaction.value,
      reply: composeCommittedProgramEditReply(args.programEdit, transaction.diff),
    },
  };
}

function programEditMutationDates(
  edit: ProgramEdit,
  draft: ProgramEditDraft | null,
): string[] {
  const command = edit.command as any;
  return Array.from(new Set([
    edit.targetDate,
    command?.target?.date,
    command?.payload?.toDate,
    draft?.targetDate,
    ...(draft?.proposedActions.map((action) => action.targetDate) ?? []),
  ].filter((date): date is string => typeof date === 'string' && date.length >= 10)));
}

function verifyProgramEditSemanticIntent(
  edit: ProgramEdit,
  draft: ProgramEditDraft | null,
  diff: SemanticProgramDiff,
): { ok: boolean; reason?: string; details?: Record<string, unknown> } {
  const reductionRequested = draft?.intent === 'reduce' ||
    edit.semanticRoles?.actionIntent === 'reduce' ||
    ('editScope' in edit && edit.editScope === 'reduce_strength_block');
  if (reductionRequested) {
    const lever = draft?.actionScope === 'duration' || edit.requestedChange === 'duration'
      ? 'duration'
      : draft?.actionScope === 'intensity' || edit.requestedChange === 'intensity'
        ? 'intensity'
        : 'any';
    if (!semanticDiffHasMaterialReductionForLever(diff, lever)) {
      return {
        ok: false,
        reason: `no_material_${lever}_reduction`,
        details: { lever },
      };
    }
  }
  if ('editScope' in edit && edit.editScope === 'intensity_only' && !semanticDiffChangesLever(diff, 'intensity')) {
    return { ok: false, reason: 'intensity_only_edit_did_not_change_intensity' };
  }
  if ('editScope' in edit && edit.editScope === 'duration_only' && !semanticDiffChangesLever(diff, 'duration')) {
    return { ok: false, reason: 'duration_only_edit_did_not_change_duration' };
  }
  return { ok: true };
}

function composeCommittedProgramEditReply(
  edit: ProgramEdit,
  diff: SemanticProgramDiff,
): string {
  const changedDates = diff.changedDates.length > 0
    ? diff.changedDates.join(' and ')
    : edit.targetDate ?? 'the visible program';
  const doseChange = firstSemanticDoseChange(diff);
  if (doseChange) {
    const field = committedDoseFieldLabel(doseChange.path);
    return `Done. I updated ${field} from ${String(doseChange.before)} to ${String(doseChange.after)} on ${changedDates}.`;
  }
  if (edit.intent === 'move') return `Done. I moved the accepted session across ${changedDates}.`;
  const targetLabel = committedProgramEditTargetLabel(edit.targetDomain);
  const protectedLabels = Array.from(new Set((edit.protectedTargets ?? [])
    .map((target: any) => committedProgramEditTargetLabel(target.domain ?? target.targetDomain))));
  const protectedSuffix = protectedLabels.length > 0
    ? ` and left the ${protectedLabels.join(' and ')} alone`
    : '';
  if (edit.intent === 'remove') {
    return `Done. I removed the ${targetLabel} on ${changedDates}${protectedSuffix}.`;
  }
  if (edit.intent === 'add') return `Done. I added the ${targetLabel} on ${changedDates}.`;
  if (edit.intent === 'replace') return `Done. I replaced the ${targetLabel} on ${changedDates}.`;
  return `Done. I updated the accepted programming on ${changedDates}.`;
}

function committedDoseFieldLabel(path: string): string {
  const leaf = path.split('.').pop() ?? '';
  if (leaf === 'repsMin' || leaf === 'repsMax') return 'reps';
  if (leaf === 'weightKg') return 'load';
  if (leaf === 'restSeconds') return 'rest';
  if (leaf === 'itemDurationMinutes' || leaf === 'durationMinutes') return 'duration';
  if (leaf === 'strengthIntensity' || leaf === 'conditioningIntensity') return 'intensity';
  return leaf || 'prescription';
}

function committedProgramEditTargetLabel(domain: string): string {
  if (domain === 'strength') return 'strength work';
  if (domain === 'conditioning') return 'conditioning';
  if (domain === 'team_training') return 'team training';
  if (domain === 'schedule') return 'scheduled session';
  if (domain === 'session') return 'session';
  return 'programming';
}

function failedCoachMutationExecutionResult(route: string): ExecutionResult {
  return {
    kind: 'verified_no_op',
    reply: "I couldn't safely apply that change, so I left the plan unchanged.",
    applied: false,
    route,
    progress: [],
  };
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
    case 'remove_strength_block':
    case 'reduce_strength_block':
      return 'strength_block';
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

function isCommandlessTypedStrengthBlockProgramEdit(edit: ProgramEdit): boolean {
  if (edit.command) return false;
  if (edit.targetDomain !== 'strength') return false;
  if (edit.intent !== 'remove' && edit.intent !== 'edit') return false;
  const editScope = 'editScope' in edit ? edit.editScope : undefined;
  return editScope === 'remove_strength_block' || editScope === 'reduce_strength_block';
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

function pendingDraftSourceForProgramEdit(
  draft: ProgramEditDraft,
  programEdit?: ProgramEdit | null,
): PendingProgramEditDraftSource {
  if (programEdit?.source === 'semantic_draft') return 'semantic';
  if (/semantic/i.test(draft.reason) || /semantic/i.test(draft.explicitUserWording)) {
    return 'semantic';
  }
  return 'deterministic';
}

function pendingDraftContinuationId(args: {
  draft: ProgramEditDraft;
  source: PendingProgramEditDraftSource;
  originalMessage: string;
}): string {
  const seed = [
    args.source,
    args.draft.intent,
    args.draft.targetDomain,
    args.draft.actionScope,
    args.draft.targetDate ?? 'no-date',
    args.originalMessage,
  ].join('|');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `program-edit-draft:${args.source}:${Math.abs(hash)}`;
}

function pendingDraftEnvelopeFromDraft(args: {
  draft: ProgramEditDraft | null | undefined;
  programEdit?: ProgramEdit | null;
  originalMessage: string;
  source?: PendingProgramEditDraftSource;
}): PendingProgramEditDraftEnvelope | undefined {
  if (!args.draft) return undefined;
  const source = args.source ?? pendingDraftSourceForProgramEdit(args.draft, args.programEdit);
  return {
    draft: args.draft,
    source,
    originalUserWording: args.draft.explicitUserWording || args.originalMessage,
    continuationId: pendingDraftContinuationId({
      draft: args.draft,
      source,
      originalMessage: args.originalMessage,
    }),
  };
}

function coachRevisionContinuationHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pendingCoachRevisionContinuationId(args: {
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
  originalMessage: string;
}): string {
  const intent = args.proposal.userIntent;
  const seed = [
    args.originalMessage,
    intent.intent,
    intent.targetDomain,
    intent.actionScope,
    intent.targetDates.join(','),
    intent.protectedRefs.join(','),
    args.proposal.scope.dates.join(','),
  ].join('|');
  return `coach-revision-proposal:semantic:${coachRevisionContinuationHash(seed)}`;
}

function pendingCoachRevisionEnvelopeFromProposal(args: {
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
  originalMessage: string;
  riskConfirmation?: PendingCoachRevisionProposalEnvelope['riskConfirmation'];
}): PendingCoachRevisionProposalEnvelope {
  return {
    source: 'semantic',
    originalUserWording: args.originalMessage,
    continuationId: pendingCoachRevisionContinuationId(args),
    partialIntent: args.proposal.userIntent,
    proposal: args.proposal,
    riskConfirmation: args.riskConfirmation,
  };
}

function coachRevisionPendingOperation(
  intent: CoachRevisionIntent,
): PendingCoachClarifier['operation'] {
  if (intent.targetDomain === 'conditioning') {
    return intent.intent === 'remove' ? 'remove_conditioning' : 'add_conditioning';
  }
  if (intent.targetDomain === 'session' || intent.actionScope === 'whole_session') {
    if (intent.intent === 'move') return 'move_session';
    if (intent.intent === 'add') return 'add_session';
    return 'remove_session';
  }
  if (intent.targetDomain === 'schedule') {
    return 'update_program_setup';
  }
  if (intent.targetDomain === 'strength' || intent.actionScope === 'exercise') {
    return 'replace_exercise';
  }
  return 'add_conditioning';
}

function capturePendingDateClarificationFromCoachRevisionProposal(args: {
  result: Extract<SemanticCoachRevisionProposalResult, { kind: 'revision' }>;
  originalMessage: string;
  todayISO: string;
}): Omit<PendingCoachClarifier, 'createdAt'> | null {
  const proposal = args.result.proposal;
  const targetDate =
    proposal.scope.dates[0] ??
    proposal.userIntent.targetDates[0] ??
    proposal.revisedDays[0]?.date ??
    null;
  if (!targetDate || !isPastISODate(targetDate, args.todayISO)) return null;

  const targetDay = controllerDayNameFromISO(targetDate);
  const proposedDate = targetDay
    ? controllerNextDateForDay(args.todayISO, targetDay)
    : null;
  const proposedCandidate = proposedDate && targetDay
    ? {
        label: `Next ${targetDay}`,
        value: proposedDate,
        answerType: 'date' as const,
      }
    : undefined;
  const candidateOptions = [
    targetDay ? `Next ${targetDay}` : null,
    'Leave unchanged',
  ].filter((option): option is string => !!option);
  const envelope = pendingCoachRevisionEnvelopeFromProposal({
    proposal,
    originalMessage: args.originalMessage,
  });
  const operation = coachRevisionPendingOperation(proposal.userIntent);
  return {
    operation,
    partialPayload: semanticPendingPayload(operation),
    scope: 'one_off',
    missingFields: ['targetDate'],
    originalMessage: args.originalMessage,
    askedQuestion: pendingDateClarificationQuestion(targetDate, targetDay),
    targetDate,
    coachRevisionProposalEnvelope: envelope,
    pendingClarification: {
      originalIntent: `${proposal.userIntent.intent}:${proposal.userIntent.targetDomain}:${proposal.userIntent.actionScope}`,
      missingField: 'targetDate',
      expectedAnswerType: 'date',
      source: envelope.source,
      continuationId: envelope.continuationId,
      originalUserWording: envelope.originalUserWording,
      staleDate: targetDate,
      requestedDow: targetDay ?? undefined,
      proposedCandidate,
      candidateOptions,
      partialCoachRevision: envelope,
      reason: 'pending_clarification:coach_revision_target_date:past_date',
    },
  };
}

/** Max clarification rounds per revision transaction. Beyond this the coach
 *  declines honestly instead of interrogating the athlete forever. */
const COACH_REVISION_MAX_CLARIFY_ROUNDS = 3;

/** Confirmation transaction for validated-but-unconfirmed revisions
 *  (template replacements): store the FULL proposal so "yes" applies exactly
 *  what was offered — never a regeneration that could drift. */
function capturePendingConfirmationFromCoachRevision(args: {
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
  diff: CoachRevisionDiff;
  originalMessage: string;
  riskAssessment?: ProgramEditRiskAssessment | null;
  riskSignature?: string | null;
}): { pending: Omit<PendingCoachClarifier, 'createdAt'>; question: string } {
  const proposal = args.proposal;
  const riskConfirmation =
    args.riskAssessment && args.riskSignature
      ? {
          signature: args.riskSignature,
          assessment: args.riskAssessment,
        }
      : undefined;
  const envelope = pendingCoachRevisionEnvelopeFromProposal({
    proposal,
    originalMessage: args.originalMessage,
    riskConfirmation,
  });
  const date = args.diff.changedDates[0] ?? proposal.scope.dates[0] ?? 'that day';
  const addedTitle = args.diff.dateDiffs
    .flatMap((entry) => entry.sectionDiffs)
    .find((section) => section.kind === 'added')?.after?.title;
  const riskOnlyPrompt = riskConfirmation && !addedTitle;
  const baseQuestion = riskOnlyPrompt
    ? 'I can make that change, but it adds risk to the week.'
    : `Want me to swap in ${addedTitle ?? 'that session'} on ${date}? (yes / no)`;
  const question = riskConfirmation
    ? withCoachRevisionRiskWarning(baseQuestion, riskConfirmation.assessment)
    : baseQuestion;
  const operation = coachRevisionPendingOperation(proposal.userIntent);
  return {
    question,
    pending: {
      operation,
      partialPayload: semanticPendingPayload(operation),
      scope: 'one_off',
      missingFields: ['confirmation'],
      originalMessage: args.originalMessage,
      askedQuestion: question,
      coachRevisionProposalEnvelope: envelope,
      pendingClarification: {
        originalIntent: `${proposal.userIntent.intent}:${proposal.userIntent.targetDomain}:${proposal.userIntent.actionScope}`,
        missingField: 'confirmation',
        expectedAnswerType: 'confirmation',
        source: envelope.source,
        continuationId: envelope.continuationId,
        originalUserWording: envelope.originalUserWording,
        proposedCandidate: { label: 'Yes', value: 'confirm', answerType: 'confirmation' },
        candidateOptions: ['Yes', 'No'],
        partialCoachRevision: envelope,
        reason: riskConfirmation
          ? 'coach_revision_risk_confirmation'
          : 'coach_revision_requires_confirmation',
      },
    },
  };
}

/**
 * SINGLE owner for entering the confirmation transaction. Both the
 * fresh-message path and the pending-resume path land here, so they can
 * never diverge: the resume path used to dead-end needs_confirmation with a
 * generic "I need confirmation" reply and silently discard the athlete's
 * already-confirmed choice (live: clarify "which hard conditioning?" →
 * "MetCon please" → dead end instead of "Want me to swap in…? (yes / no)").
 */
function enterCoachRevisionConfirmationTransaction(args: {
  input: CoachTurnControllerInput;
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
  diff: CoachRevisionDiff;
  originalMessage: string;
  route: string;
  referenceStatus: string | null;
  referenceTargetDate: string | null;
  referenceTargetName: string | null;
  riskAssessment?: ProgramEditRiskAssessment | null;
  riskSignature?: string | null;
}): CoachTurnControllerResult {
  const confirmationPending = capturePendingConfirmationFromCoachRevision({
    proposal: args.proposal,
    diff: args.diff,
    originalMessage: args.originalMessage,
    riskAssessment: args.riskAssessment,
    riskSignature: args.riskSignature,
  });
  usePendingCoachClarifierStore.getState().setPending(confirmationPending.pending);
  emitCoachTurnDiagnostic('pending_set_coach_revision_confirmation', {
    message: args.input.userMessage.content,
    route: args.route,
    question: confirmationPending.question,
  });
  args.input.setLastCoachDebug({
    intent: 'coach_revision_proposal',
    route: args.route,
    referenceStatus: args.referenceStatus,
    referenceTargetDate: args.referenceTargetDate,
    referenceTargetName: args.referenceTargetName,
    mutationLike: true,
    legacyCalled: false,
    replySource: 'deterministic',
    applied: false,
  });
  return replyAndFinish(args.input, args.route, confirmationPending.question);
}

/** The app KNOWS the addable templates — never make the athlete ask what
 *  their options are. Any replacement-related clarify gets the registry
 *  labels appended deterministically, independent of whether the model
 *  remembered to list them. */
function withTemplateOptionsForReplacement(
  missingField: string | undefined,
  reply: string,
): string {
  if (!missingField || !/replacement/i.test(missingField)) return reply;
  const labels = listCoachRevisionTemplates().map((template) => template.label);
  if (labels.length === 0) return reply;
  if (labels.every((label) => reply.includes(label))) return reply;
  const last = labels[labels.length - 1];
  const list = labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} or ${last}`
    : last;
  return `${reply} Your options: ${list}.`;
}

/** Record the athlete's answer against the outstanding (last, unanswered)
 *  clarification round. */
function fillLastCoachRevisionClarificationAnswer(
  clarifications: PendingCoachRevisionClarification[] | undefined,
  answer: string,
): PendingCoachRevisionClarification[] {
  const list = [...(clarifications ?? [])];
  const last = list[list.length - 1];
  if (last && last.answer === null) {
    list[list.length - 1] = { ...last, answer };
  }
  return list;
}

/**
 * Turn ANY revision-path clarify result into a pending transaction so the
 * athlete's next short answer resumes with original wording + accumulated
 * answered slots. This generalizes the stale-date special case: without it,
 * each clarify round discards partialIntent/missingField/candidateOptions and
 * the conversation can never converge (the "6th" → "which date?" loop).
 * Returns null when the round cap is exhausted — caller must decline.
 */
function capturePendingFromCoachRevisionClarify(args: {
  result: Extract<SemanticCoachRevisionProposalResult, { kind: 'clarify' }>;
  latestMessage: string;
  previousEnvelope?: PendingCoachRevisionProposalEnvelope | null;
  answeredClarifications?: PendingCoachRevisionClarification[];
}): Omit<PendingCoachClarifier, 'createdAt'> | null {
  const prior = args.answeredClarifications ??
    args.previousEnvelope?.clarifications ?? [];
  if (prior.length >= COACH_REVISION_MAX_CLARIFY_ROUNDS) return null;

  const proposal = args.result.proposal;
  const clarifyQuestion = withTemplateOptionsForReplacement(
    proposal.missingField,
    args.result.reply,
  );
  const originalUserWording =
    args.previousEnvelope?.originalUserWording ?? args.latestMessage;
  const partialIntent =
    proposal.partialIntent ?? args.previousEnvelope?.partialIntent ?? null;
  const envelope: PendingCoachRevisionProposalEnvelope = {
    source: 'semantic',
    originalUserWording,
    continuationId:
      args.previousEnvelope?.continuationId ??
      `coach-revision-clarify:semantic:${coachRevisionContinuationHash(originalUserWording)}`,
    partialIntent,
    proposal: args.previousEnvelope?.proposal ?? null,
    clarifications: [
      ...prior,
      {
        missingField: proposal.missingField,
        question: clarifyQuestion,
        answer: null,
      },
    ],
  };
  const operation = partialIntent
    ? coachRevisionPendingOperation(partialIntent)
    : 'remove_session';
  return {
    operation,
    partialPayload: semanticPendingPayload(operation),
    scope: 'one_off',
    missingFields: [proposal.missingField],
    originalMessage: originalUserWording,
    askedQuestion: clarifyQuestion,
    coachRevisionProposalEnvelope: envelope,
    pendingClarification: {
      originalIntent: partialIntent
        ? `${partialIntent.intent}:${partialIntent.targetDomain}:${partialIntent.actionScope}`
        : 'coach_revision_clarify',
      missingField: proposal.missingField,
      expectedAnswerType: semanticExpectedAnswerType(proposal.missingField),
      source: envelope.source,
      continuationId: envelope.continuationId,
      originalUserWording,
      candidateOptions: args.result.options,
      partialCoachRevision: envelope,
      reason: proposal.reason || 'coach_revision_clarify',
    },
  };
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
  const draftEnvelope = pendingDraftEnvelopeFromDraft({
    draft,
    programEdit,
    originalMessage,
  });
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
    programEditDraftEnvelope: draftEnvelope,
    candidateItems: pendingEdit.candidateItems,
    pendingClarification: {
      originalIntent: `${programEdit.intent}:${programEdit.targetDomain}:${'editScope' in programEdit ? programEdit.editScope ?? programEdit.requestedChange : programEdit.requestedChange}`,
      missingField: 'targetDate',
      expectedAnswerType: 'date',
      source: draftEnvelope?.source,
      continuationId: draftEnvelope?.continuationId,
      originalUserWording: draftEnvelope?.originalUserWording,
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

function capturePendingDateClarificationFromProgramEditDraftTarget(args: {
  draft: ProgramEditDraft | null | undefined;
  originalMessage: string;
  todayISO: string;
  source?: PendingProgramEditDraftSource;
}): Omit<PendingCoachClarifier, 'createdAt'> | null {
  const { draft, originalMessage, todayISO } = args;
  if (!draft?.targetDate || !isPastISODate(draft.targetDate, todayISO)) return null;
  if (draft.intent === 'ask_question' || draft.intent === 'explain') return null;
  const targetDay = controllerDayNameFromISO(draft.targetDate);
  const proposedDate = targetDay ? controllerNextDateForDay(todayISO, targetDay) : null;
  const proposedCandidate = proposedDate && targetDay
    ? {
        label: `Next ${targetDay}`,
        value: proposedDate,
        answerType: 'date' as const,
      }
    : undefined;
  const candidateOptions = [
    targetDay ? `Next ${targetDay}` : null,
    'Leave unchanged',
  ].filter((option): option is string => !!option);
  const source = args.source ?? pendingDraftSourceForProgramEdit(draft, null);
  const draftEnvelope = pendingDraftEnvelopeFromDraft({
    draft,
    originalMessage,
    source,
  });
  const operation = semanticPendingOperation(draft);
  const missingFields = uniqueControllerFields([
    ...draft.missingFields.filter((field) => !controllerIsDateField(field)),
    'targetDate',
  ]);
  return {
    operation,
    partialPayload: semanticPendingPayload(operation),
    scope: 'one_off',
    missingFields,
    originalMessage,
    askedQuestion: pendingDateClarificationQuestion(draft.targetDate, targetDay),
    targetDate: draft.targetDate,
    targetSessionName: draft.sourceTarget?.sessionName,
    programEditDraftEnvelope: draftEnvelope,
    pendingClarification: {
      originalIntent: `${draft.intent}:${draft.targetDomain}:${draft.actionScope}`,
      missingField: 'targetDate',
      expectedAnswerType: 'date',
      source,
      continuationId: draftEnvelope?.continuationId,
      originalUserWording: draftEnvelope?.originalUserWording,
      staleDate: draft.targetDate,
      requestedDow: targetDay ?? undefined,
      proposedCandidate,
      candidateOptions,
      partialDraft: draft,
      reason: 'pending_clarification:target_date:past_date',
    },
  };
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

function controllerSemanticProgramEditDraftMode(
  input: CoachTurnControllerInput,
): SemanticProgramEditDraftMode {
  const requested = input.semanticProgramEditDraftMode ??
    (input.enableSemanticProgramEditDraft ? 'active' : 'off');
  if (requested === 'active' && input.semanticProgramEditDraftActiveAllowed === false) {
    logger.warn('[coach-semantic-program-edit-draft] active mode blocked by config gate', {
      rawMode: input.semanticProgramEditDraftRawMode ?? null,
      activeAllowed: false,
    });
    return 'off';
  }
  return requested;
}

function controllerCoachRevisionProposalMode(
  input: CoachTurnControllerInput,
): CoachRevisionProposalMode {
  const requested = input.coachRevisionProposalMode ?? 'off';
  if (requested === 'active' && input.coachRevisionProposalActiveAllowed === false) {
    logger.warn('[coach-revision-proposal] active mode blocked by config gate', {
      rawMode: input.coachRevisionProposalRawMode ?? null,
      activeAllowed: false,
    });
    return 'off';
  }
  return requested;
}

function shouldAttemptSemanticProgramEditDraft(args: {
  mode: SemanticProgramEditDraftMode;
  input: CoachTurnControllerInput;
  packet: ReturnType<typeof buildCoachContextPacket>;
}): boolean {
  if (args.mode === 'off') return false;
  if (args.mode === 'active') return true;
  const draft = args.packet.programEditDraft;
  if (isMutationLike(args.input.userMessage.content)) return true;
  if (!draft) return false;
  if (draft.intent === 'ask_question' || draft.intent === 'explain') return false;
  return draft.proposedActions.length > 0 || draft.missingFields.length > 0;
}

function shouldAttemptCoachRevisionProposal(args: {
  mode: CoachRevisionProposalMode;
  input: CoachTurnControllerInput;
}): boolean {
  if (args.mode === 'off') return false;
  if (args.mode === 'active') return true;
  return isMutationLike(args.input.userMessage.content);
}

function controllerTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_err) {
    return undefined;
  }
}

async function buildSemanticProgramEditDraftForController(args: {
  input: CoachTurnControllerInput;
  packet: ReturnType<typeof buildCoachContextPacket>;
  mode: SemanticProgramEditDraftMode;
}): Promise<SemanticProgramEditDraftResult | null> {
  if (!shouldAttemptSemanticProgramEditDraft(args)) return null;
  const adapter = args.input.semanticProgramEditDraftAdapter;
  if (!adapter) return null;
  return buildSemanticProgramEditDraft({
    userMessage: args.input.userMessage.content,
    targetFrame: args.packet.targetFrame ?? null,
    visibleWeek: args.packet.currentWeek ?? [],
    pendingClarifier: getPendingClarifierSnapshot(),
    currentProgramContext: {
      currentWeek: args.packet.currentWeek ?? [],
      nextWeek: args.packet.nextWeek ?? [],
    },
    todayISO: args.input.todayISO,
    nowISO: args.input.semanticProgramEditDraftNowISO ?? new Date().toISOString(),
    timezone: args.input.semanticProgramEditDraftTimezone ?? controllerTimeZone(),
    adapter,
    minConfidence: args.input.semanticProgramEditDraftMinConfidence,
  });
}

async function buildCoachRevisionProposalForController(args: {
  input: CoachTurnControllerInput;
  packet: ReturnType<typeof buildCoachContextPacket>;
  mode: CoachRevisionProposalMode;
}): Promise<SemanticCoachRevisionProposalResult | null> {
  if (!shouldAttemptCoachRevisionProposal(args)) return null;
  const adapter = args.input.coachRevisionProposalAdapter;
  if (!adapter) return null;
  const visibleWeek = uniqueResolvedDays([
    ...(args.packet.currentWeek ?? []),
    ...(args.packet.nextWeek ?? []),
  ]);
  return buildSemanticCoachRevisionProposal({
    userMessage: args.input.userMessage.content,
    visibleSnapshot: buildCoachRevisionWeekSnapshotFromProjectedDays(visibleWeek),
    // App-side validation policy: the proposal may only change dates that
    // were in the snapshot the LLM was shown, and may not add sections.
    // Past visible dates stay allowed here so stale-date proposals reach the
    // stale-date clarification flow instead of failing as unrelated dates.
    validationPolicy: coachRevisionValidationPolicyForWeek(visibleWeek, args.input.todayISO),
    pendingClarifier: getPendingClarifierSnapshot(),
    recentContext: {
      currentWeekDates: (args.packet.currentWeek ?? []).map((day) => day.date),
      nextWeekDates: (args.packet.nextWeek ?? []).map((day) => day.date),
      targetFrame: args.packet.targetFrame ?? null,
    },
    todayISO: args.input.todayISO,
    nowISO: args.input.semanticProgramEditDraftNowISO ?? new Date().toISOString(),
    timezone: args.input.semanticProgramEditDraftTimezone ?? controllerTimeZone(),
    adapter,
    minConfidence: args.input.coachRevisionProposalMinConfidence,
  });
}

async function buildCoachRevisionProposalForPendingResume(args: {
  input: CoachTurnControllerInput;
  packet: ReturnType<typeof buildCoachContextPacket>;
  pending: PendingCoachClarifier;
  envelope: PendingCoachRevisionProposalEnvelope;
  targetDate: string | null;
  clarificationAnswer: string;
  answeredClarifications: PendingCoachRevisionClarification[];
  mode: CoachRevisionProposalMode;
}): Promise<SemanticCoachRevisionProposalResult | null> {
  if (args.mode !== 'active') return null;
  const adapter = args.input.coachRevisionProposalAdapter;
  if (!adapter) return null;
  const visibleWeek = visibleDaysForCoachRevisionProposal({
    packet: args.packet,
    todayISO: args.input.todayISO,
    includeDates: args.targetDate ? [args.targetDate] : [],
  });
  const patchedIntent: CoachRevisionIntent | null = args.envelope.partialIntent
    ? {
        ...args.envelope.partialIntent,
        targetDates: args.targetDate
          ? [args.targetDate]
          : args.envelope.partialIntent.targetDates,
      }
    : null;
  return buildSemanticCoachRevisionProposal({
    userMessage: args.envelope.originalUserWording,
    visibleSnapshot: buildCoachRevisionWeekSnapshotFromProjectedDays(visibleWeek),
    // Same app-side bound as the new-message path: only snapshot dates may
    // change, no adds. visibleWeek already includes the patched target date.
    validationPolicy: coachRevisionValidationPolicyForWeek(visibleWeek, args.input.todayISO),
    pendingClarifier: args.pending,
    recentContext: {
      currentWeekDates: (args.packet.currentWeek ?? []).map((day) => day.date),
      nextWeekDates: (args.packet.nextWeek ?? []).map((day) => day.date),
      targetFrame: args.packet.targetFrame ?? null,
      pendingCoachRevision: {
        continuationId: args.envelope.continuationId,
        missingField:
          args.pending.pendingClarification?.missingField ?? 'targetDate',
        targetDateOverride: args.targetDate,
        clarificationAnswer: args.clarificationAnswer,
        clarifications: args.answeredClarifications,
        originalUserWording: args.envelope.originalUserWording,
        partialIntent: patchedIntent,
        originalProposalDates: args.envelope.proposal?.scope.dates ?? [],
        instruction:
          'Regenerate the revised visible snapshot from originalUserWording combined with every answered clarification. Use targetDateOverride when set; otherwise resolve clarificationAnswer against context.visibleDates. Never reinterpret a short clarification answer as a new request. Re-derive userIntent.protectedRefs from originalUserWording against the TARGET day\'s snapshot ids only — never reuse refs from a different date.',
      },
    },
    todayISO: args.input.todayISO,
    nowISO: args.input.semanticProgramEditDraftNowISO ?? new Date().toISOString(),
    timezone: args.input.semanticProgramEditDraftTimezone ?? controllerTimeZone(),
    adapter,
    minConfidence: args.input.coachRevisionProposalMinConfidence,
  });
}

// Revision policy (allowed dates, template signatures, bye unlock) is owned
// by coachRevisionPolicy.ts and SHARED with the tap-first plan-change sheet.
// Do not re-introduce a private copy here.

function visibleDaysForCoachRevisionProposal(args: {
  packet: ReturnType<typeof buildCoachContextPacket>;
  todayISO: string;
  includeDates?: string[];
}): ReturnType<typeof buildCoachContextPacket>['currentWeek'] {
  const included = (args.includeDates ?? []).map((date) =>
    resolveLiveProgramTabVisibleDayForDate(date, args.todayISO),
  );
  return uniqueResolvedDays([
    ...(args.packet.currentWeek ?? []),
    ...(args.packet.nextWeek ?? []),
    ...included,
  ]);
}

function uniqueResolvedDays(days: ReturnType<typeof buildCoachContextPacket>['currentWeek']): ReturnType<typeof buildCoachContextPacket>['currentWeek'] {
  const seen = new Set<string>();
  const out: ReturnType<typeof buildCoachContextPacket>['currentWeek'] = [];
  for (const day of days) {
    if (seen.has(day.date)) continue;
    seen.add(day.date);
    out.push(day);
  }
  return out;
}

function diagnosticFromSemanticProgramEditDraftResult(args: {
  mode: Exclude<SemanticProgramEditDraftMode, 'off'>;
  result: SemanticProgramEditDraftResult;
}): SemanticProgramEditDraftControllerDiagnostic {
  const confidence = 'confidence' in args.result ? args.result.confidence : null;
  const reason = 'reason' in args.result ? args.result.reason : null;
  const draft = args.result.kind === 'draft'
    ? args.result.draft
    : args.result.kind === 'invalid'
      ? null
      : args.result.response?.draft ?? null;
  return {
    mode: args.mode,
    kind: args.result.kind,
    confidence,
    reason,
    ...(args.result.kind === 'invalid' ? { issues: args.result.issues } : {}),
    ...(draft
      ? {
          draft: {
            intent: draft.intent,
            targetDomain: draft.targetDomain,
            actionScope: draft.actionScope,
            targetDate: draft.targetDate,
            isCompound: draft.isCompound,
            missingFields: draft.missingFields,
          },
        }
      : {}),
  };
}

function diagnosticFromCoachRevisionProposalResult(args: {
  mode: Exclude<CoachRevisionProposalMode, 'off'>;
  result: SemanticCoachRevisionProposalResult;
}): CoachRevisionProposalControllerDiagnostic {
  const confidence = 'confidence' in args.result ? args.result.confidence : null;
  return {
    mode: args.mode,
    kind: args.result.kind,
    confidence,
    diagnostic: args.result.diagnostic,
  };
}

function emitSemanticProgramEditDraftDiagnostic(args: {
  input: CoachTurnControllerInput;
  diagnostic: SemanticProgramEditDraftControllerDiagnostic;
}) {
  args.input.onSemanticProgramEditDraftDiagnostic?.(args.diagnostic);
  logger.debug('[coach-semantic-program-edit-draft-diagnostic]', args.diagnostic);
}

function emitCoachRevisionProposalDiagnostic(args: {
  input: CoachTurnControllerInput;
  diagnostic: CoachRevisionProposalControllerDiagnostic;
}) {
  args.input.onCoachRevisionProposalDiagnostic?.(args.diagnostic);
  logger.debug('[coach-revision-proposal-diagnostic]', args.diagnostic);
}

/**
 * Active revision mode is dev-only (see env.ts gating), so these replies can
 * name infrastructure directly. They exist so endpoint/wiring failures are
 * impossible to mistake for coach reasoning, and so active mode NEVER falls
 * back to legacy mutation paths when the revision pipeline is unavailable.
 */
const COACH_REVISION_MISCONFIGURED_REPLY =
  '[dev] Coach revision mode is active but the endpoint adapter is missing ' +
  '(check EXPO_PUBLIC_SUPABASE_URL / deployment). No changes made.';

function coachRevisionInvalidReply(
  result: Extract<SemanticCoachRevisionProposalResult, { kind: 'invalid' }>,
): string {
  if (result.reason === 'adapter_failed') {
    const detail = result.issues[0] ?? 'transport error';
    return `[dev] Coach revision endpoint failed (${detail}). No changes made - check deployment/network.`;
  }
  return "I couldn't safely validate that revision, so I left the plan unchanged.";
}

function isSupportedDevActiveCoachRevision(
  result: Extract<SemanticCoachRevisionProposalResult, { kind: 'revision' }>,
): boolean {
  // STRUCTURAL constraints only. Intent/domain/scope labels are the model's
  // commentary; the validated DIFF is the truth. A label matrix here kept
  // rejecting validator-approved edits whenever the model chose a synonym
  // combination (reduce-labeled removals, conditioning+whole_session on a
  // one-item day, …) while adding zero safety: adds are already blocked by
  // the app-side validation policy, protected refs by the validator, and the
  // writer re-verifies the contract before any store write.
  const proposal = result.proposal;
  if (proposal.userIntent.intent === 'move') {
    // Two-day conserved move: destination additions are authorized by the
    // conservation invariant in the validator, not by the adds policy.
    return (
      proposal.scope.dates.length === 2 &&
      proposal.revisedDays.length === 2 &&
      result.diff.changedDates.length === 2
    );
  }
  if (proposal.scope.mode !== 'single_day') return false;
  if (proposal.scope.dates.length !== 1) return false;
  if (proposal.revisedDays.length !== 1) return false;
  if (result.diff.changedDates.length !== 1) return false;
  // Belt-and-braces mirror of the adds policy: writes never add visible
  // content — EXCEPT replacements, whose additions were authorized by the
  // byte-exact template-registry match in the validator.
  const addsContent = result.diff.dateDiffs.some((entry) =>
    entry.sectionDiffs.some((section) => section.kind === 'added') ||
    entry.itemDiffs.some((item) => item.kind === 'added'),
  );
  if (
    addsContent &&
    proposal.userIntent.intent !== 'replace' &&
    proposal.userIntent.intent !== 'add'
  ) {
    return false;
  }
  return true;
}

function emptyCoachRevisionRiskAssessment(): ProgramEditRiskAssessment {
  return {
    decision: 'allow',
    highestLevel: 'info',
    findings: [],
    introducedRuleIds: [],
    worsenedRuleIds: [],
  };
}

function coachRevisionRiskSignature(assessment: ProgramEditRiskAssessment): string {
  return assessment.findings
    .map((finding) => [
      finding.ruleId,
      finding.level,
      [...finding.dates].sort().join(','),
      [...finding.sessions].sort().join(','),
      finding.message,
    ].join('|'))
    .sort()
    .join('||');
}

function coachRevisionRiskReason(finding: ProgramEditRiskFinding): string {
  const observed =
    typeof finding.data?.observed === 'number' ? finding.data.observed : null;
  if (finding.ruleId === 'cap_maxHardDays_over') {
    return `This would give you ${observed ?? 'too many'} hard days this week. I would not apply that without confirmation.`;
  }
  if (finding.ruleId === 'cap_maxMainStrengthSessions_over') {
    return `This would add a 5th main strength session. That is the upper edge.`;
  }
  if (finding.ruleId === 'cap_maxRunningExposures_over') {
    return 'This adds more running than the weekly cap.';
  }
  if (finding.ruleId === 'cap_sprintCodExposures_over') {
    return 'This adds more sprint/COD exposure than the week is set up for.';
  }
  if (finding.ruleId === 'g1_hard_work' || finding.ruleId === 'g1_not_light') {
    return 'This puts hard work one day before your game.';
  }
  if (finding.ruleId === 'g2_hard_work' || finding.ruleId === 'g2_hard_lower') {
    return 'This puts hard work two days before your game.';
  }
  if (finding.ruleId === 'g_plus1_hard_work' || finding.ruleId === 'g_plus1_not_light') {
    return 'This adds hard work the day after your game.';
  }
  if (finding.ruleId === 'game_day_hard_work') {
    return 'This puts hard training on game day.';
  }
  if (/^protected_.*_anchor_removed$/.test(finding.ruleId)) {
    return 'This would remove a protected team/game anchor.';
  }
  if (finding.ruleId === 'active_injury_hard_stop') {
    return 'A serious injury or medical-stop adjustment is active.';
  }
  return finding.message;
}

function coachRevisionRiskReasons(assessment: ProgramEditRiskAssessment): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const finding of assessment.findings) {
    const reason = coachRevisionRiskReason(finding);
    if (seen.has(reason)) continue;
    seen.add(reason);
    out.push(reason);
    if (out.length >= 3) break;
  }
  return out.length > 0 ? out : ['This change makes the week riskier than it is now.'];
}

function withCoachRevisionRiskWarning(
  baseQuestion: string,
  assessment: ProgramEditRiskAssessment,
): string {
  const reasons = coachRevisionRiskReasons(assessment);
  const confirmationQuestion = /\(yes \/ no\)\s*$/i.test(baseQuestion.trim())
    ? baseQuestion.trim()
    : `${baseQuestion.trim()} Continue? (yes / no)`;
  return `Heads up: ${reasons.join(' ')}\n\n${confirmationQuestion}`;
}

function coachRevisionRiskBlockReply(assessment: ProgramEditRiskAssessment): string {
  const reason = coachRevisionRiskReasons(assessment)[0];
  if (/one day before your game/i.test(reason)) {
    return "This puts hard work one day before your game, so I'm not applying it. I can help choose a lighter option instead.";
  }
  if (/game day/i.test(reason)) {
    return "This puts hard training on game day, so I'm not applying it. I can help pick a recovery or light option instead.";
  }
  if (/protected team\/game anchor/i.test(reason)) {
    return "This would remove a protected team/game anchor, so it can't be applied from the coach revision flow.";
  }
  if (/injury|medical-stop/i.test(reason)) {
    return "A serious injury or medical-stop adjustment is active, so I'm not treating this as a normal training edit.";
  }
  return `${reason} So I'm not applying it. I can help choose a safer alternative.`;
}

function assessCoachRevisionProposalRisk(args: {
  input: CoachTurnControllerInput;
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
  diff: CoachRevisionDiff;
  visibleWeek: NonNullable<ReturnType<typeof buildCoachContextPacket>['currentWeek']>;
}): {
  ok: true;
  assessment: ProgramEditRiskAssessment;
  signature: string;
} | {
  ok: false;
  route: string;
  reply: string;
} {
  const preview = applyCoachRevisionDateOverrides({
    proposal: args.proposal,
    visibleWeek: args.visibleWeek,
    todayISO: args.input.todayISO,
    validationPolicy: {
      ...coachRevisionValidationPolicyForWeek(args.visibleWeek, args.input.todayISO),
      requireConfirmationForAdds: false,
    },
  });
  if (preview.applied.length === 0 || preview.rejected.length > 0) {
    return {
      ok: false,
      route: 'coach-revision-proposal-risk-preview-rejected',
      reply: "I couldn't safely preview that revision, so I left the plan unchanged.",
    };
  }

  const profile = {
    ...(useProfileStore.getState().onboardingData as ValidateProgramWeekInput['profile']),
    seasonPhase:
      useProgramStore.getState().currentProgram?.programPhase ??
      (useProfileStore.getState().onboardingData as ValidateProgramWeekInput['profile'])?.seasonPhase,
  } as ValidateProgramWeekInput['profile'];
  const activeConstraints = useCoachUpdatesStore.getState().activeConstraints;
  const allowProtectedAnchorChanges =
    args.proposal.userIntent.targetDomain === 'team_training';
  const assessment = assessProgramEditWrites({
    writes: preview.applied.map((write) => ({
      date: write.date,
      workout: write.workout,
    })),
    visibleWeek: args.visibleWeek,
    profile,
    allowProtectedAnchorChanges,
    activeConstraints,
    todayISO: args.input.todayISO,
  }) ?? emptyCoachRevisionRiskAssessment();
  return {
    ok: true,
    assessment,
    signature: coachRevisionRiskSignature(assessment),
  };
}

async function applyDevActiveCoachRevision(args: {
  input: CoachTurnControllerInput;
  packet: ReturnType<typeof buildCoachContextPacket>;
  result: Extract<SemanticCoachRevisionProposalResult, { kind: 'revision' }>;
  visibleWeek?: ReturnType<typeof buildCoachContextPacket>['currentWeek'];
}): Promise<{ ok: true; reply: string; route: string } | { ok: false; reply: string; route: string }> {
  if (!isSupportedDevActiveCoachRevision(args.result)) {
    return {
      ok: false,
      route: 'coach-revision-proposal-unsupported-scope',
      reply:
        'I understood the requested revision, but this dev path only supports simple single-day edits right now.',
    };
  }

  const visibleWeek = uniqueResolvedDays([
    ...(args.visibleWeek ?? [
      ...(args.packet.currentWeek ?? []),
      ...(args.packet.nextWeek ?? []),
    ]),
  ]);
  const verifyAcceptedProposal = () => {
    const acceptedByDate = new Map(
      args.result.proposal.revisedDays.map((day) => [day.date, day]),
    );
    const verified = args.result.proposal.scope.dates.every((date) => {
      const accepted = acceptedByDate.get(date);
      return !!accepted && verifyCoachRevisionProjectionAfterWrite({
        date,
        todayISO: args.input.todayISO,
        accepted,
      });
    });
    return verified
      ? { ok: true }
      : { ok: false, reason: 'accepted_revision_does_not_match_visible_projection' };
  };
  const transaction = await runCoachMutationTransaction({
    todayISO: args.input.todayISO,
    extraDates: args.result.proposal.scope.dates,
    mutate: () => {
      const multiDate = args.result.proposal.scope.dates.length > 1;
      const apply = applyCoachRevisionDateOverrides({
        proposal: args.result.proposal,
        visibleWeek,
        todayISO: args.input.todayISO,
        // The writer re-validates internally; it must see the SAME app-side
        // policy (date window + template authorization) as proposal time.
        validationPolicy: {
          ...coachRevisionValidationPolicyForWeek(visibleWeek, args.input.todayISO),
          requireConfirmationForAdds: false,
        },
        deferWeekAcceptanceToTransaction: multiDate,
        setManualOverride: multiDate
          ? undefined
          : (date, workout, context) =>
              useProgramStore.getState().setManualOverride(date, workout, context),
      });
      if (multiDate && apply.applied.length > 0 && apply.rejected.length === 0) {
        const state = useProgramStore.getState();
        commitAcceptedStateTransaction({
          reason: `coach_revision:${args.result.proposal.userIntent.intent}`,
          program: {
            dateOverrides: {
              ...state.dateOverrides,
              ...Object.fromEntries(apply.applied.map((write) => [write.date, write.workout])),
            },
            overrideContexts: {
              ...state.overrideContexts,
              ...Object.fromEntries(apply.applied.map((write) => [write.date, write.context])),
            },
          },
          validateWeekStarts: Array.from(new Set(
            apply.applied.map((write) => getMondayForDate(write.date)),
          )),
          programAlreadyAccepted: true,
        });
      }
      return apply;
    },
    didApply: (apply) => apply.applied.length > 0 && apply.rejected.length === 0,
    verifyCandidate: verifyAcceptedProposal,
    verifyAfterPersistence: verifyAcceptedProposal,
  });

  if (transaction.ok === false) {
    const apply = transaction.value;
    // Failures at this layer were previously silent, making every writer
    // rejection look identical from the chat. Name them.
    emitCoachTurnDiagnostic('coach_revision_apply_rejected', {
      appliedDates: apply?.applied.map((write) => write.date) ?? [],
      rejected: apply?.rejected.map((entry) => ({
        date: entry.date ?? null,
        code: entry.code,
        reason: entry.reason,
      })) ?? [],
      proposalDates: args.result.proposal.scope.dates,
      intent: args.result.proposal.userIntent.intent,
      actionScope: args.result.proposal.userIntent.actionScope,
      visibleWeekDates: visibleWeek.map((day) => day.date),
    });
    return {
      ok: false,
      route: transaction.route === 'coach_mutation_not_applied'
        ? 'coach-revision-proposal-apply-rejected'
        : transaction.route,
      reply: "I couldn't safely apply that revision, so I left the plan unchanged.",
    };
  }

  return {
    ok: true,
    route: 'coach-revision-proposal-applied',
    reply: composeCommittedCoachRevisionReply(transaction.diff, args.result.proposal),
  };
}

function composeCommittedCoachRevisionReply(
  diff: SemanticProgramDiff,
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>,
): string {
  const dose = firstSemanticDoseChange(diff);
  const date = diff.changedDates[0] ?? proposal.scope.dates[0] ?? 'the visible program';
  if (proposal.userIntent.intent === 'move') {
    const destination = proposal.scope.dates.find((candidate) => candidate !== date) ??
      proposal.scope.dates.at(-1) ?? date;
    const moved = diff.before.days.find((day) => day.date === date)?.workout?.presentation.title ?? 'the session';
    return `Done. I moved ${moved} to ${destination}.`;
  }
  if (proposal.userIntent.intent === 'replace') {
    const replacement = proposal.revisedDays.find((day) => day.date === date)?.workout?.title ??
      diff.after.days.find((day) => day.date === date)?.workout?.presentation.title ??
      'the replacement session';
    return `Done. I swapped in ${replacement} on ${date}.`;
  }
  if (proposal.userIntent.intent === 'remove') {
    if (proposal.userIntent.targetDomain === 'strength') {
      return `Done. I removed the strength work on ${date}.`;
    }
    if (proposal.userIntent.targetDomain === 'conditioning') {
      return `Done. I removed conditioning on ${date}.`;
    }
    if (proposal.userIntent.targetDomain === 'team_training') {
      return `Done. I removed the team training portion on ${date}.`;
    }
    return `Done. I removed the session on ${date}.`;
  }
  if (dose) {
    const field = committedDoseFieldLabel(dose.path);
    return `Done. I updated ${field} from ${String(dose.before)} to ${String(dose.after)} on ${date}.`;
  }
  return `Done. I applied the accepted programming change on ${date}.`;
}

function verifyCoachRevisionProjectionAfterWrite(args: {
  date: string;
  todayISO: string;
  accepted: ReturnType<typeof snapshotProjectedDay>;
}): boolean {
  const state = buildScheduleStateImperative();
  const programStore = useProgramStore.getState();
  const projected = buildDayWorkoutProjectedDay({
    date: args.date,
    todayISO: args.todayISO,
    state,
    overrideContext: programStore.overrideContexts?.[args.date],
  });
  const projectedSnapshot = snapshotProjectedDay(projected);
  if (coachRevisionSemanticContractsMatch(projectedSnapshot, args.accepted)) return true;
  const acceptedJson = JSON.stringify(args.accepted);
  const projectedJson = JSON.stringify(projectedSnapshot);
  // Verifier mismatches are the "silent lossiness" failure class: the write
  // happened but the projection renders something else. Emit the first point
  // of divergence so every mismatch names the exact field.
  let divergeAt = 0;
  const max = Math.min(acceptedJson.length, projectedJson.length);
  while (divergeAt < max && acceptedJson[divergeAt] === projectedJson[divergeAt]) divergeAt++;
  emitCoachTurnDiagnostic('coach_revision_projection_mismatch', {
    date: args.date,
    acceptedLength: acceptedJson.length,
    projectedLength: projectedJson.length,
    divergeAt,
    acceptedAround: acceptedJson.slice(Math.max(0, divergeAt - 80), divergeAt + 160),
    projectedAround: projectedJson.slice(Math.max(0, divergeAt - 80), divergeAt + 160),
  });
  return false;
}

function pendingClarifierFromSemanticClarify(args: {
  result: Extract<SemanticProgramEditDraftResult, { kind: 'clarify' }>;
  originalMessage: string;
}): Omit<PendingCoachClarifier, 'createdAt'> {
  const draft = args.result.response?.draft ?? null;
  const operation = semanticPendingOperation(draft);
  const missingFields = draft?.missingFields.length
    ? draft.missingFields
    : ['semantic_program_edit'];
  const draftEnvelope = pendingDraftEnvelopeFromDraft({
    draft,
    originalMessage: args.originalMessage,
    source: 'semantic',
  });
  return {
    operation,
    partialPayload: semanticPendingPayload(operation),
    scope: 'one_off',
    missingFields,
    originalMessage: args.originalMessage,
    askedQuestion: args.result.reply,
    targetDate: draft?.targetDate ?? undefined,
    targetSessionName: draft?.sourceTarget?.sessionName ?? undefined,
    programEditDraftEnvelope: draftEnvelope,
    pendingClarification: {
      originalIntent: draft
        ? `${draft.intent}:${draft.targetDomain}:${draft.actionScope}`
        : 'semantic_program_edit',
      missingField: missingFields[0] ?? 'semantic_program_edit',
      expectedAnswerType: semanticExpectedAnswerType(missingFields[0]),
      source: draftEnvelope?.source,
      continuationId: draftEnvelope?.continuationId,
      originalUserWording: draftEnvelope?.originalUserWording,
      candidateOptions: args.result.options,
      partialDraft: draft ?? undefined,
      reason: args.result.reason,
    },
  };
}

function semanticPendingOperation(
  draft: ProgramEditDraft | null,
): PendingCoachClarifier['operation'] {
  if (!draft) return 'add_conditioning';
  if (draft.targetDomain === 'conditioning') {
    return draft.intent === 'remove' ? 'remove_conditioning' : 'add_conditioning';
  }
  if (draft.targetDomain === 'session') {
    if (draft.intent === 'move') return 'move_session';
    if (draft.intent === 'add') return 'add_session';
    return 'remove_session';
  }
  if (draft.targetDomain === 'schedule' || draft.targetDomain === 'setup') {
    return 'update_program_setup';
  }
  if (draft.targetDomain === 'strength') return 'replace_exercise';
  if (draft.actionScope === 'exercise') return 'replace_exercise';
  return 'add_conditioning';
}

function semanticPendingPayload(
  operation: PendingCoachClarifier['operation'],
): PendingCoachClarifier['partialPayload'] {
  switch (operation) {
    case 'remove_conditioning':
      return { operation, modality: null };
    case 'remove_session':
      return { operation };
    case 'add_session':
      return { operation, setupChange: false };
    case 'move_session':
      return { operation };
    case 'update_program_setup':
      return { operation, rebuildRequired: true };
    case 'replace_exercise':
      return { operation, fromExercise: '', toExercise: null };
    case 'set_conditioning_modality_preference':
      return { operation, from: null, to: 'bike', bikeLabel: null };
    case 'swap_conditioning_modality_once':
      return { operation, from: null, to: 'bike', bikeLabel: null };
    case 'set_bike_subtype_preference':
      return { operation, bikeLabel: 'standard' };
    case 'undo_last_change':
      return { operation };
    case 'add_conditioning':
    default:
      return { operation: 'add_conditioning', modality: null };
  }
}

function semanticExpectedAnswerType(
  missingField: string | undefined,
): PendingClarificationExpectedAnswerType {
  if (!missingField) return 'unknown';
  if (/date|day/i.test(missingField)) return 'date';
  if (/session/i.test(missingField)) return 'session';
  if (/item|exercise/i.test(missingField)) return 'item';
  if (/scope|week|recurring/i.test(missingField)) return 'scope';
  if (/type|domain|modality/i.test(missingField)) return 'type';
  if (/duration|minutes|time/i.test(missingField)) return 'duration';
  if (/confirm|confirmation/i.test(missingField)) return 'confirmation';
  return 'unknown';
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

function shouldSupersedePendingClarifierWithNewMutation(args: {
  pending: PendingCoachClarifier;
  classification: PendingClarificationAnswerClassification | null;
  userMessage: string;
  packet: ReturnType<typeof buildCoachContextPacket>;
}): boolean {
  if (!args.pending.askedQuestion) return false;
  if (
    args.classification?.kind === 'accept_proposed' ||
    args.classification?.kind === 'reject_proposed' ||
    args.classification?.kind === 'choose_candidate'
  ) {
    return false;
  }
  if (!isMutationLike(args.userMessage)) return false;

  const draft = buildProgramEditDraft({
    userMessage: args.userMessage,
    targetFrame: args.packet.targetFrame ?? null,
    visibleWeek: args.packet.currentWeek,
    pendingTransaction: null,
  });
  return draft.intent !== 'ask_question' &&
    draft.intent !== 'explain' &&
    draft.proposedActions.length > 0 &&
    draft.confidence >= 0.55;
}

type PendingProgramEditDraftAnswerResult =
  | { kind: 'cancelled'; reply: string }
  | { kind: 'clarify'; reply: string; options?: string[]; draft: ProgramEditDraft }
  | { kind: 'complete'; draft: ProgramEditDraft }
  | { kind: 'unresolved' };

type PendingCoachRevisionProposalAnswerResult =
  | { kind: 'cancelled'; reply: string }
  | { kind: 'clarify'; reply: string; options?: string[] }
  | {
      /** Confirmation accepted: apply the STORED proposal exactly as offered
       *  (after revalidating against current state) — no regeneration. */
      kind: 'apply_stored';
      envelope: PendingCoachRevisionProposalEnvelope;
    }
  | {
      kind: 'complete';
      envelope: PendingCoachRevisionProposalEnvelope;
      /** Deterministically resolved date, when the missing slot was a date
       *  and the answer parsed. Null otherwise — the semantic layer then
       *  integrates the raw clarificationAnswer instead. */
      targetDate: string | null;
      /** Raw athlete answer for this round, always recorded. */
      clarificationAnswer: string;
    }
  | { kind: 'unresolved' };

function resolvePendingCoachRevisionProposalAnswer(args: {
  pending: PendingCoachClarifier;
  userMessage: string;
  todayISO: string;
  currentWeek: ReturnType<typeof currentWeekRefs>;
  pendingAnswerClassification: PendingClarificationAnswerClassification | null;
}): PendingCoachRevisionProposalAnswerResult {
  const envelope =
    args.pending.coachRevisionProposalEnvelope ??
    args.pending.pendingClarification?.partialCoachRevision;
  const slot = args.pending.pendingClarification;
  if (!envelope || !slot) return { kind: 'unresolved' };

  const classification =
    args.pendingAnswerClassification ??
    classifyPendingClarificationAnswer({
      message: args.userMessage,
      pendingClarification: slot,
      askedQuestion: args.pending.askedQuestion,
    });
  if (classification.kind === 'reject_proposed') {
    return {
      kind: 'cancelled',
      reply: 'Got it - leaving things as they are.',
    };
  }

  if (slot.missingField === 'confirmation' && envelope.proposal) {
    if (
      classification.kind === 'accept_proposed' ||
      classification.kind === 'choose_candidate'
    ) {
      return { kind: 'apply_stored', envelope };
    }
    return {
      kind: 'clarify',
      reply: args.pending.askedQuestion ?? 'Should I go ahead? (yes / no)',
      options: slot.candidateOptions,
    };
  }

  if (controllerIsDateField(slot.missingField)) {
    const targetDate = pendingDraftTargetDateFromAnswer({
      pending: args.pending,
      classification,
      message: args.userMessage,
      todayISO: args.todayISO,
      currentWeek: args.currentWeek,
    });
    // Deterministic parse is the fast path. When it fails ("6th", "the one
    // after"), do NOT re-ask the same question — complete with the raw answer
    // and let the semantic layer resolve it against the date guide, with the
    // round cap as the loop guard.
    return {
      kind: 'complete',
      envelope: targetDate
        ? patchPendingCoachRevisionEnvelopeTargetDate({ envelope, targetDate })
        : envelope,
      targetDate,
      clarificationAnswer: args.userMessage,
    };
  }

  // Non-date slots (scope, session, replacement, confirmation…) are semantic
  // by nature: pass the raw answer through; the adapter regenerates from
  // original wording + accumulated Q&A.
  return {
    kind: 'complete',
    envelope,
    targetDate: null,
    clarificationAnswer: args.userMessage,
  };
}

function patchPendingCoachRevisionEnvelopeTargetDate(args: {
  envelope: PendingCoachRevisionProposalEnvelope;
  targetDate: string;
}): PendingCoachRevisionProposalEnvelope {
  // Protected refs are PER-SNAPSHOT bindings (some literally embed the date,
  // e.g. section:2026-06-29:...). When the target date changes they are
  // invalid by construction: carrying them forward makes the model echo refs
  // that cannot exist on the new day, which the validator then rightly
  // rejects. Protection INTENT lives in originalUserWording — the model must
  // re-derive refs against the new day's snapshot.
  const dateChanged = !!args.envelope.partialIntent &&
    !args.envelope.partialIntent.targetDates.includes(args.targetDate);
  return {
    ...args.envelope,
    partialIntent: args.envelope.partialIntent
      ? {
          ...args.envelope.partialIntent,
          targetDates: [args.targetDate],
          protectedRefs: dateChanged
            ? []
            : args.envelope.partialIntent.protectedRefs,
        }
      : null,
    proposal: args.envelope.proposal
      ? {
          ...args.envelope.proposal,
          userIntent: {
            ...args.envelope.proposal.userIntent,
            targetDates: [args.targetDate],
            protectedRefs: dateChanged
              ? []
              : args.envelope.proposal.userIntent.protectedRefs,
          },
          scope: {
            ...args.envelope.proposal.scope,
            dates: [args.targetDate],
          },
        }
      : null,
  };
}

function resolvePendingProgramEditDraftAnswer(args: {
  pending: PendingCoachClarifier;
  userMessage: string;
  todayISO: string;
  currentWeek: ReturnType<typeof currentWeekRefs>;
  pendingAnswerClassification: PendingClarificationAnswerClassification | null;
}): PendingProgramEditDraftAnswerResult {
  const envelope = args.pending.programEditDraftEnvelope;
  const slot = args.pending.pendingClarification;
  if (!envelope?.draft || !slot) return { kind: 'unresolved' };

  const classification =
    args.pendingAnswerClassification ??
    classifyPendingClarificationAnswer({
      message: args.userMessage,
      pendingClarification: slot,
      askedQuestion: args.pending.askedQuestion,
    });
  if (classification.kind === 'reject_proposed') {
    return {
      kind: 'cancelled',
      reply: 'Got it - leaving things as they are.',
    };
  }

  if (controllerIsDateField(slot.missingField)) {
    const targetDate = pendingDraftTargetDateFromAnswer({
      pending: args.pending,
      classification,
      message: args.userMessage,
      todayISO: args.todayISO,
      currentWeek: args.currentWeek,
    });
    if (!targetDate) {
      return {
        kind: 'clarify',
        draft: envelope.draft,
        reply:
          args.pending.askedQuestion ??
          'Which day should I use?',
        options: slot.candidateOptions,
      };
    }
    return {
      kind: 'complete',
      draft: patchProgramEditDraftTargetDate({
        draft: envelope.draft,
        targetDate,
        staleDate: slot.staleDate ?? envelope.draft.targetDate,
      }),
    };
  }

  return { kind: 'unresolved' };
}

function pendingDraftTargetDateFromAnswer(args: {
  pending: PendingCoachClarifier;
  classification: PendingClarificationAnswerClassification;
  message: string;
  todayISO: string;
  currentWeek: ReturnType<typeof currentWeekRefs>;
}): string | null {
  const slot = args.pending.pendingClarification;
  const candidate =
    args.classification.kind === 'accept_proposed' ||
    args.classification.kind === 'choose_candidate'
      ? args.classification.candidate ?? slot?.proposedCandidate ?? null
      : null;
  if (candidate?.answerType === 'date') {
    return pendingDraftDateFromText({
      text: candidate.value || candidate.label,
      todayISO: args.todayISO,
      currentWeek: args.currentWeek,
      requestedDow: slot?.requestedDow ?? null,
    });
  }
  if (
    args.classification.kind === 'provide_alternative_value' ||
    args.classification.kind === 'unclear'
  ) {
    return pendingDraftDateFromText({
      text: args.message,
      todayISO: args.todayISO,
      currentWeek: args.currentWeek,
      requestedDow: slot?.requestedDow ?? null,
    });
  }
  return null;
}

function pendingDraftDateFromText(args: {
  text: string;
  todayISO: string;
  currentWeek: ReturnType<typeof currentWeekRefs>;
  requestedDow: DayOfWeek | null;
}): string | null {
  const text = String(args.text ?? '').trim();
  const lower = text.toLowerCase();
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return iso;
  if (/\btoday\b/i.test(lower)) return args.todayISO;
  if (/\btomorrow\b/i.test(lower)) return controllerAddDaysISO(args.todayISO, 1);

  const explicitDow = controllerDayNameFromText(text);
  if (explicitDow) return controllerNextDateForDay(args.todayISO, explicitDow);

  if (args.requestedDow) {
    if (/\b(?:next|upcoming|future)\b/i.test(lower)) {
      return controllerNextDateForDay(args.todayISO, args.requestedDow);
    }
    if (/\b(?:this|current)\s+week\b|\bthe\s+one\s+(?:i'?m|im)\s+looking\s+at\b/i.test(lower)) {
      return args.currentWeek.find((day) =>
        controllerDayNameFromISO(day.date) === args.requestedDow,
      )?.date ?? null;
    }
  }
  return null;
}

function controllerDayNameFromText(text: string): DayOfWeek | null {
  const lower = text.toLowerCase();
  for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as DayOfWeek[]) {
    if (new RegExp(`\\b${day.toLowerCase()}s?\\b`, 'i').test(lower)) return day;
  }
  return null;
}

function patchProgramEditDraftTargetDate(args: {
  draft: ProgramEditDraft;
  targetDate: string;
  staleDate?: string | null;
}): ProgramEditDraft {
  const previousDate = args.staleDate ?? args.draft.targetDate;
  const dateChanged = previousDate !== args.targetDate;
  const patchDate = (value: string | null | undefined): string | null => {
    if (!value || value === previousDate || controllerIsDateField(args.draft.missingFields[0] ?? '')) {
      return args.targetDate;
    }
    return value;
  };
  const patchSourceTarget = (sourceTarget: ProgramEditDraft['sourceTarget']) =>
    sourceTarget
      ? {
          ...sourceTarget,
          date: patchDate(sourceTarget.date) ?? args.targetDate,
          ...(dateChanged ? { itemId: undefined } : {}),
        }
      : null;

  return {
    ...args.draft,
    targetDate: args.targetDate,
    targetSessionId: dateChanged ? null : args.draft.targetSessionId,
    targetItemId: dateChanged ? null : args.draft.targetItemId,
    sourceTarget: patchSourceTarget(args.draft.sourceTarget),
    missingFields: args.draft.missingFields.filter((field) => !controllerIsDateField(field)),
    protectedTargets: args.draft.protectedTargets.map((target) => ({
      ...target,
      targetDate: patchDate(target.targetDate),
    })),
    proposedActions: args.draft.proposedActions.map((action) => ({
      ...action,
      targetDate: patchDate(action.targetDate),
      targetSessionId: dateChanged ? null : action.targetSessionId,
      targetItemId: dateChanged ? null : action.targetItemId,
      sourceTarget: patchSourceTarget(action.sourceTarget),
    })),
    verifierExpectations: args.draft.verifierExpectations.map((expectation) => ({
      ...expectation,
      targetDate: patchDate(expectation.targetDate),
    })),
    reason: `${args.draft.reason}:pending_${args.targetDate}`,
  };
}

function temporarySourceFactFromIntent(
  intent: CoachIntent,
  todayISO: string,
): { fact: TemporarySourceFact } | { clarification: string } | null {
  if (intent.intent === 'equipment_change' &&
    intent.payload?.equipmentChangeScope !== 'baseline') {
    const equipmentTags = intent.payload?.equipmentTags ?? [];
    if (equipmentTags.length === 0 || !intent.payload?.equipmentMode) {
      return { clarification: 'Which equipment is available or unavailable, and is this temporary?' };
    }
    const observedDate = (intent.payload.requestedDate ??
      intent.payload.targetDate ??
      todayISO).slice(0, 10);
    return { fact: createTemporaryEquipmentFact({
      observedDate,
      scope: temporaryFactScope({ kind: 'week', date: observedDate }),
      mode: intent.payload.equipmentMode,
      equipmentTags,
      conditioningModalities: intent.payload.conditioningModalities,
      sourceActor: 'coach',
      sourceSurface: 'coach_chat',
    }) };
  }
  const factKind = intent.intent === 'mixed_fact_and_program_adjustment'
    ? intent.payload?.factKind
    : intent.intent === 'fatigue' || intent.intent === 'soreness' ||
      intent.intent === 'poor_sleep' || intent.intent === 'busy_week'
      ? intent.intent
      : null;
  if (!factKind) return null;
  if (factKind === 'equipment' || factKind === 'schedule' || factKind === 'time_cap') {
    return null;
  }
  const observedDate = (intent.payload?.requestedDate ?? intent.payload?.targetDate ?? todayISO).slice(0, 10);
  const level = intent.payload?.reportedLevelIsExplicit === true &&
    typeof intent.payload.severity === 'number'
    ? intent.payload.severity
    : intent.payload?.reportKind === 'cooked' ? 'cooked' : 'unspecified';
  const weekScoped = intent.payload?.scope === 'this_week' ||
    intent.payload?.poorSleepPattern === 'repeated';
  const scope = temporaryFactScope({ kind: weekScoped ? 'week' : 'date', date: observedDate });
  if (factKind === 'busy_week') {
    return { fact: createTemporaryScheduleFact({
      observedDate,
      scope: temporaryFactScope({ kind: 'week', date: observedDate }),
      scheduleKind: typeof intent.payload?.maxSessionsThisWeek === 'number'
        ? 'max_sessions'
        : 'busy_week',
      maxSessions: intent.payload?.maxSessionsThisWeek,
      sourceActor: 'coach',
      sourceSurface: 'coach_chat',
    }) };
  }
  if (factKind === 'fatigue') {
    return { fact: createTemporaryFatigueFact({
      observedDate,
      scope,
      athleteReportedLevel: level,
      reportKind: intent.payload?.reportKind === 'cooked' ? 'cooked' : 'fatigue',
      sourceSurface: 'coach_chat',
    }) };
  }
  if (factKind === 'poor_sleep') {
    const pattern = intent.payload?.poorSleepPattern === 'repeated' ? 'repeated' : 'single_night';
    return { fact: createTemporaryPoorSleepFact({
      observedDate,
      scope: temporaryFactScope({ kind: pattern === 'repeated' ? 'week' : 'date', date: observedDate }),
      pattern,
      athleteReportedLevel: level,
      sourceSurface: 'coach_chat',
    }) };
  }
  const distribution = intent.payload?.sorenessDistribution ??
    (intent.payload?.bodyPart ? 'localized' : 'general');
  const bucket = intent.payload?.bodyPart ? resolveInjuryBucket(intent.payload.bodyPart) : null;
  if (distribution === 'localized' && (!intent.payload?.bodyPart || !bucket)) {
    return { clarification: 'Which body part is sore?' };
  }
  return { fact: createTemporarySorenessFact({
    observedDate,
    scope,
    athleteReportedLevel: level,
    distribution,
    reportedBodyPartLanguage: intent.payload?.bodyPart ?? null,
    canonicalBodyPartBucket: bucket,
    sourceSurface: 'coach_chat',
  }) };
}

async function executeSetupEditInController(args: {
  input: CoachTurnControllerInput;
  programEdit: Extract<ProgramEdit, { editScope: 'update_program_setup' }>;
  onProgress: (stage: ProgressStage) => void;
}) {
  const { input, programEdit, onProgress } = args;
  const setup = programEdit.setupChange;
  if (setup.clearUnavailableDays?.length) {
    const clearDays = new Set(setup.clearUnavailableDays);
    const activeScheduleFacts = useProgramStore.getState().acceptedMaterialContext
      .temporarySourceFacts
      .filter((fact) =>
        isTemporaryScheduleFact(fact) &&
        fact.status === 'active' &&
        fact.unavailableWeekdays.some((day) => clearDays.has(day)));
    if (activeScheduleFacts.length > 1) {
      return {
        kind: 'clarify' as const,
        reply: 'I found more than one temporary availability restriction for those days. Which one should end?',
        applied: false,
        route: 'program_setup:temporary_schedule_resolution_ambiguous',
        progress: ['checking_program', 'composing_reply'] as ProgressStage[],
      };
    }
    if (activeScheduleFacts.length === 1) {
      onProgress('checking_program');
      onProgress('applying_change');
      const fact = activeScheduleFacts[0];
      const remainingWeekdays = fact.unavailableWeekdays.filter((day) =>
        !clearDays.has(day));
      const result = remainingWeekdays.length === 0
        ? await transactTemporarySourceFact({
            operation: 'resolve',
            factId: fact.factId,
            todayISO: input.todayISO,
            sourceActor: 'coach',
            sourceSurface: 'coach_chat',
          })
        : await transactTemporarySourceFact({
            operation: 'update',
            fact: {
              ...fact,
              unavailableWeekdays: remainingWeekdays,
              updatedAt: new Date().toISOString(),
              sourceActor: 'coach',
              sourceSurface: 'coach_chat',
            },
            todayISO: input.todayISO,
            sourceActor: 'coach',
            sourceSurface: 'coach_chat',
          });
      const applied = result.outcome !== 'conflicted' &&
        result.outcome !== 'safely_rejected';
      onProgress('verifying_update');
      onProgress('composing_reply');
      return applied
        ? {
            kind: 'mutated' as const,
            reply: 'Schedule is back to normal for the selected day after durable recomposition and visible verification.',
            applied: true,
            route: 'program_setup:temporary_schedule_resolved',
            progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
          }
        : {
            kind: 'rejected' as const,
            reply: result.message,
            applied: false,
            route: `program_setup:temporary_schedule_resolution_failed:${result.reason ?? result.outcome}`,
            progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
          };
    }
    const currentProfile = useProfileStore.getState().onboardingData;
    const remainingPermanent = (currentProfile.availabilityConstraints ?? [])
      .filter((constraint) =>
        constraint.scope === 'permanent' &&
        constraint.kind === 'unavailable_day' &&
        constraint.active !== false &&
        !!constraint.dayOfWeek &&
        !clearDays.has(constraint.dayOfWeek))
      .map((constraint) => constraint.dayOfWeek!)
      .filter((day): day is import('../types/domain').DayOfWeek => !!day);
    onProgress('checking_program');
    onProgress('applying_change');
    const result = await commitProfileProgramTransaction({
      change: {
        kind: 'permanent_unavailable_weekdays',
        weekdays: remainingPermanent,
      },
      todayISO: input.todayISO,
      sourceSurface: 'coach_program_setup',
    });
    onProgress('verifying_update');
    onProgress('composing_reply');
    return result.ok
      ? {
          kind: 'mutated' as const,
          reply: result.message,
          applied: true,
          route: 'program_setup:permanent_schedule_restored',
          progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
        }
      : {
          kind: 'rejected' as const,
          reply: result.message,
          applied: false,
          route: `program_setup:permanent_schedule_restore_failed:${result.reason ?? 'unknown'}`,
          progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
        };
  }
  const temporaryConstraints = (setup.availabilityConstraints ?? [])
    .filter((constraint) => constraint.scope === 'temporary' && constraint.active !== false);
  const onlyTemporaryAvailability = temporaryConstraints.length > 0 &&
    temporaryConstraints.length === (setup.availabilityConstraints ?? []).length &&
    !setup.addTrainingDays?.length &&
    !setup.removeTrainingDays?.length &&
    !setup.replaceTrainingDays?.length &&
    setup.trainingDaysPerWeek === undefined &&
    !setup.clearUnavailableDays?.length;
  if (onlyTemporaryAvailability) {
    const kinds = new Set(temporaryConstraints.map((constraint) => constraint.kind));
    const minutes = Array.from(new Set(temporaryConstraints
      .map((constraint) => constraint.maxSessionMinutes)
      .filter((value): value is number => typeof value === 'number')));
    if ((kinds.size === 1 && kinds.has('unavailable_day')) ||
      (kinds.size === 1 && kinds.has('time_limit') && minutes.length === 1)) {
      onProgress('checking_program');
      const starts = temporaryConstraints
        .map((constraint) => constraint.startDate?.slice(0, 10))
        .filter((date): date is string => !!date)
        .sort();
      const ends = temporaryConstraints
        .map((constraint) => constraint.endDate?.slice(0, 10))
        .filter((date): date is string => !!date)
        .sort();
      const scope = starts.length > 0 || ends.length > 0
        ? temporaryFactScope({
            kind: 'window',
            from: starts[0] ?? input.todayISO,
            until: ends[ends.length - 1] ?? starts[0] ?? input.todayISO,
          })
        : temporaryFactScope({ kind: 'week', date: input.todayISO });
      const weekdays = temporaryConstraints
        .map((constraint) => constraint.dayOfWeek)
        .filter((day): day is import('../types/domain').DayOfWeek => !!day);
      const fact = kinds.has('time_limit')
        ? createTemporaryTimeCapFact({
            observedDate: input.todayISO,
            scope,
            targetKind: weekdays.length > 0 ? 'weekdays' : 'all_sessions',
            weekdays,
            maxSessionMinutes: minutes[0],
            sourceActor: 'coach',
            sourceSurface: 'coach_chat',
          })
        : createTemporaryScheduleFact({
            observedDate: input.todayISO,
            scope,
            scheduleKind: 'unavailable_weekdays',
            unavailableWeekdays: weekdays,
            sourceActor: 'coach',
            sourceSurface: 'coach_chat',
          });
      onProgress('applying_change');
      const result = await transactTemporarySourceFact({
        operation: 'create',
        fact,
        todayISO: input.todayISO,
        sourceActor: 'coach',
        sourceSurface: 'coach_chat',
      });
      const applied = result.outcome !== 'conflicted' &&
        result.outcome !== 'safely_rejected';
      onProgress('verifying_update');
      onProgress('composing_reply');
      return applied
        ? {
            kind: 'mutated' as const,
            reply: result.message,
            applied: true,
            route: `program_setup:temporary_source_fact:${fact.factKind}`,
            progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
          }
        : {
            kind: 'rejected' as const,
            reply: result.message,
            applied: false,
            route: `program_setup:temporary_source_fact_failed:${result.reason ?? result.outcome}`,
            progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
          };
    }
  }
  const permanentConstraints = (setup.availabilityConstraints ?? [])
    .filter((constraint) => constraint.scope === 'permanent' && constraint.active !== false);
  const onlyPermanentAvailability = permanentConstraints.length > 0 &&
    permanentConstraints.length === (setup.availabilityConstraints ?? []).length &&
    !setup.addTrainingDays?.length &&
    !setup.removeTrainingDays?.length &&
    !setup.replaceTrainingDays?.length &&
    setup.trainingDaysPerWeek === undefined &&
    !setup.clearUnavailableDays?.length;
  if (onlyPermanentAvailability) {
    const kinds = new Set(permanentConstraints.map((constraint) => constraint.kind));
    const weekdays = permanentConstraints
      .map((constraint) => constraint.dayOfWeek)
      .filter((day): day is import('../types/domain').DayOfWeek => !!day);
    const minutes = Array.from(new Set(permanentConstraints
      .map((constraint) => constraint.maxSessionMinutes)
      .filter((value): value is number => typeof value === 'number')));
    const currentProfile = useProfileStore.getState().onboardingData;
    const change = kinds.size === 1 && kinds.has('unavailable_day')
      ? {
          kind: 'permanent_unavailable_weekdays' as const,
          weekdays: Array.from(new Set([
            ...(currentProfile.availabilityConstraints ?? [])
              .filter((constraint) =>
                constraint.scope === 'permanent' &&
                constraint.kind === 'unavailable_day' &&
                constraint.active !== false)
              .map((constraint) => constraint.dayOfWeek)
              .filter((day): day is import('../types/domain').DayOfWeek => !!day),
            ...weekdays,
          ])),
        }
      : kinds.size === 1 && kinds.has('time_limit') && minutes.length === 1
        ? {
            kind: 'permanent_session_time_cap' as const,
            weekdays,
            maxSessionMinutes: minutes[0],
          }
        : null;
    if (change) {
      onProgress('checking_program');
      onProgress('applying_change');
      const result = await commitProfileProgramTransaction({
        change,
        todayISO: input.todayISO,
        sourceSurface: 'coach_program_setup',
      });
      onProgress('verifying_update');
      onProgress('composing_reply');
      return result.ok
        ? {
            kind: 'mutated' as const,
            reply: result.message,
            applied: true,
            route: 'program_setup:profile_program_transaction',
            progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
          }
        : {
            kind: 'rejected' as const,
            reply: result.message,
            applied: false,
            route: `program_setup:profile_program_transaction_failed:${result.reason ?? 'unknown'}`,
            progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
          };
    }
  }
  const changesPreferredWeekdays = !!(
    setup.addTrainingDays?.length ||
    setup.removeTrainingDays?.length ||
    setup.replaceTrainingDays?.length
  ) && !(setup.availabilityConstraints?.length) && !(setup.clearUnavailableDays?.length);
  if (changesPreferredWeekdays) {
    const current = useProfileStore.getState().onboardingData.preferredTrainingDays ?? [];
    const next = setup.replaceTrainingDays
      ? [...setup.replaceTrainingDays]
      : Array.from(new Set([
          ...current.filter((day) => !setup.removeTrainingDays?.includes(day)),
          ...(setup.addTrainingDays ?? []),
        ]));
    onProgress('checking_program');
    onProgress('applying_change');
    const result = await commitProfileProgramTransaction({
      change: {
        kind: 'preferred_training_weekdays',
        weekdays: next,
      },
      todayISO: input.todayISO,
      sourceSurface: 'coach_program_setup',
    });
    onProgress('verifying_update');
    onProgress('composing_reply');
    return result.ok
      ? {
          kind: 'mutated' as const,
          reply: result.message,
          applied: true,
          route: 'program_setup:profile_program_transaction',
          progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
        }
      : {
          kind: 'rejected' as const,
          reply: result.message,
          applied: false,
          route: `program_setup:profile_program_transaction_failed:${result.reason ?? 'unknown'}`,
          progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'] as ProgressStage[],
        };
  }
  return executeProgramSetupEdit({
    programEdit,
    todayISO: input.todayISO,
    getOnboardingData: () => useProfileStore.getState().onboardingData,
    updateOnboardingData: (patch) => useProfileStore.getState().updateOnboardingData(patch),
    generateProgramFromProfile: (profile, options) => generateProgramFromProfile(profile, {
      ...options,
      blockNumber: options?.blockNumber ?? getCurrentBlockNumberForGeneration(options?.todayISO ?? input.todayISO),
    }),
    setCurrentProgram: (program) => useProgramStore.getState().setCurrentProgram(program),
    setCurrentMicrocycle: (microcycle) => useProgramStore.getState().setCurrentMicrocycle(microcycle),
    setTodayWorkout: (workout) => useProgramStore.getState().setTodayWorkout(workout),
    commitAcceptedRebuild: ({ program, profile, todayISO }) => {
      commitProgramSetupRebuildTransaction({ program, profile, todayISO });
    },
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
    const semanticModeAtTurnStart = controllerSemanticProgramEditDraftMode(input);
    emitCoachTurnDiagnostic('turn_start', {
      message: input.userMessage.content,
      todayISO: input.todayISO,
      rawSemanticMode: input.semanticProgramEditDraftRawMode ?? null,
      semanticMode: semanticModeAtTurnStart,
      resolvedSemanticMode: semanticModeAtTurnStart,
      semanticAdapterPresent: !!input.semanticProgramEditDraftAdapter,
      activeModeConfigAllowed: input.semanticProgramEditDraftActiveAllowed ?? null,
      activeSemanticAllowed:
        semanticModeAtTurnStart === 'active' &&
        (input.semanticProgramEditDraftActiveAllowed ?? true) &&
        !!input.semanticProgramEditDraftAdapter,
      pendingBefore: pendingDiagnosticSummary(pendingClarifier),
      buildMarker: COACH_TURN_DIAGNOSTIC_MARKER,
      buildFingerprint: coachTurnBuildFingerprint(),
    });

    // Session outcome is an independent typed command, not a program-edit
    // clarifier answer. Give the semantic classifier first ownership so a
    // stale pending edit cannot reinterpret attendance/performance feedback.
    if (input.classifier.classifySessionOutcome) {
      try {
        const semanticOutcomeIntent = await input.classifier.classifySessionOutcome(packet);
        classifiedCoachIntent = semanticOutcomeIntent;
        const sessionOutcome = await executeCoachSessionOutcome(semanticOutcomeIntent, packet);
        if (sessionOutcome.kind !== 'not_outcome') {
          const applied = sessionOutcome.kind === 'recorded';
          const target = sessionOutcome.kind === 'recorded' ? sessionOutcome.target : null;
          input.setLastCoachDebug({
            intent: semanticOutcomeIntent.intent,
            route: `session_outcome:${sessionOutcome.kind}`,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: target?.date ?? null,
            referenceTargetName: target?.workout?.name ?? null,
            mutationLike: false,
            legacyCalled: false,
            replySource: 'deterministic',
            applied,
          });
          return replyAndFinish(input, 'session-outcome', sessionOutcome.reply);
        }
      } catch (error) {
        logger.warn('[coach-session-outcome] classifier_unavailable', {
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Typed semantic ownership for present-tense athlete facts. This runs
    // before program-edit routing so factual "cooked" cannot be reinterpreted
    // as an imperative go-lighter edit. Mixed intents retain the explicit edit
    // fields and continue through the deterministic program-edit executor.
    try {
      const semanticIntent = await input.classifier.classify(packet);
      if (semanticIntent.intent === 'temporary_source_fact_followup' &&
        semanticIntent.payload?.followupKind === 'resolved') {
        const requestedKind = semanticIntent.payload.factKind;
        const requestedBucket = semanticIntent.payload.bodyPart
          ? resolveInjuryBucket(semanticIntent.payload.bodyPart)
          : null;
        const matches = useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts
          .filter(isNonInjuryTemporarySourceFact)
          .filter((fact) => fact.status === 'active')
          .filter((fact) => !requestedKind || fact.factKind === requestedKind)
          .filter((fact) => fact.factKind !== 'soreness' || !requestedBucket ||
            fact.canonicalBodyPartBucket === requestedBucket);
        if (matches.length === 0) {
          return replyAndFinish(
            input,
            'temporary-source-fact-resolve-noop',
            'I could not match an active report, so I left your facts and visible program unchanged.',
          );
        }
        if (matches.length > 1) {
          return replyAndFinish(
            input,
            'temporary-source-fact-resolve-clarify',
            'Which active temporary report or restriction do you mean?',
          );
        }
        const resolution = await transactTemporarySourceFact({
          operation: 'resolve',
          factId: temporarySourceFactId(matches[0]),
          todayISO: input.todayISO,
          sourceActor: 'athlete',
          sourceSurface: 'coach_chat',
        });
        return replyAndFinish(input, 'temporary-source-fact-resolved', resolution.message);
      }
      if (semanticIntent.intent === 'equipment_change' &&
        semanticIntent.payload?.equipmentChangeScope === 'baseline') {
        if (semanticIntent.payload.equipmentMode !== 'only' ||
          !(semanticIntent.payload.equipmentTags?.length)) {
          return replyAndFinish(
            input,
            'baseline-equipment-clarify',
            'For your permanent equipment settings, what equipment do you normally have access to?',
          );
        }
        const profileResult = await commitProfileProgramTransaction({
          change: {
            kind: 'baseline_equipment',
            equipment: semanticIntent.payload.equipmentTags,
          },
          todayISO: input.todayISO,
          sourceSurface: 'coach_program_setup',
        });
        return replyAndFinish(
          input,
          profileResult.ok ? 'baseline-equipment-updated' : 'baseline-equipment-failed',
          profileResult.message,
        );
      }
      const sourceFactIntent = temporarySourceFactFromIntent(semanticIntent, input.todayISO);
      if (sourceFactIntent) {
        classifiedCoachIntent = semanticIntent;
        if ('clarification' in sourceFactIntent) {
          return replyAndFinish(input, 'temporary-source-fact-clarify', sourceFactIntent.clarification);
        }
        const existingPoorSleep = !isInjurySourceFact(sourceFactIntent.fact) &&
          sourceFactIntent.fact.factKind === 'poor_sleep'
          ? useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts
              .filter((fact): fact is TemporaryPoorSleepFact => !isInjurySourceFact(fact) &&
                fact.factKind === 'poor_sleep' && fact.status === 'active')
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
          : null;
        const fact = existingPoorSleep && !isInjurySourceFact(sourceFactIntent.fact)
          ? {
              ...sourceFactIntent.fact,
              factId: existingPoorSleep.factId,
              createdAt: existingPoorSleep.createdAt,
            }
          : sourceFactIntent.fact;
        const factResult = await transactTemporarySourceFact({
          operation: existingPoorSleep ? 'update' : 'create',
          fact,
          todayISO: input.todayISO,
          sourceActor: 'athlete',
          sourceSurface: 'coach_chat',
        });
        const factApplied = factResult.outcome !== 'conflicted' &&
          factResult.outcome !== 'safely_rejected';
        if (!factApplied) {
          return replyAndFinish(input, 'temporary-source-fact-failed', factResult.message);
        }
        if (semanticIntent.intent !== 'mixed_fact_and_program_adjustment') {
          input.setLastCoachDebug({
            intent: semanticIntent.intent,
            route: `temporary_source_fact:${factResult.outcome}`,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: null,
            referenceTargetName: null,
            mutationLike: false,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: factApplied,
          });
          return replyAndFinish(input, 'temporary-source-fact', factResult.message);
        }
        classifiedCoachIntent = {
          ...semanticIntent,
          intent: 'request_program_adjustment',
          rationale: `${semanticIntent.rationale ?? 'mixed_intent'}; temporary fact committed separately`,
        };
      } else {
        classifiedCoachIntent = semanticIntent;
      }
    } catch (error) {
      logger.warn('[temporary-source-fact] semantic_classifier_unavailable', {
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    if (pendingClarifier) {
      if (isCancelClarifierMessage(input.userMessage.content)) {
        usePendingCoachClarifierStore.getState().clearPending();
        logger.debug('[pending-clarifier] cancelled', {
          operation: pendingClarifier.operation,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'clarifier-cancelled', 'No worries - leaving things as they are.');
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
          await transactTemporarySourceFact({
            operation: 'create',
            fact: createTemporaryFatigueFact({
              observedDate: input.todayISO,
              scope: temporaryFactScope({ kind: 'date', date: input.todayISO }),
              athleteReportedLevel: 'slight',
              sourceSurface: 'coach_chat',
            }),
            todayISO: input.todayISO,
            sourceActor: 'athlete',
            sourceSurface: 'coach_chat',
          });
        }
        return replyAndFinish(input, 'game-day-readiness-answer', pendingGameDayAnswer.reply);
      }

      const pendingAnswerClassification = await classifyPendingAnswerForController({
        input,
        pending: pendingClarifier,
      });
      emitCoachTurnDiagnostic('pending_answer_classification', {
        message: input.userMessage.content,
        pendingBefore: pendingDiagnosticSummary(pendingClarifier),
        classification: classificationDiagnosticSummary(pendingAnswerClassification),
      });
      const pendingSupersededByNewMutation = shouldSupersedePendingClarifierWithNewMutation({
        pending: pendingClarifier,
        classification: pendingAnswerClassification,
        userMessage: input.userMessage.content,
        packet,
      });
      if (pendingSupersededByNewMutation) {
        usePendingCoachClarifierStore.getState().clearPending();
        emitCoachTurnDiagnostic('pending_superseded_by_new_mutation', {
          message: input.userMessage.content,
          pendingBefore: pendingDiagnosticSummary(pendingClarifier),
          classification: classificationDiagnosticSummary(pendingAnswerClassification),
        });
        logger.debug('[pending-clarifier] superseded_by_new_mutation', {
          operation: pendingClarifier.operation,
          missingFields: pendingClarifier.missingFields,
          answerKind: pendingAnswerClassification?.kind ?? null,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
      } else {
      // Same no-legacy-on-exception boundary as the new-message revision
      // region: resumed revision turns must never leak to legacy on a throw.
      try {
      const pendingRevisionAnswer = resolvePendingCoachRevisionProposalAnswer({
        pending: pendingClarifier,
        userMessage: input.userMessage.content,
        todayISO: input.todayISO,
        currentWeek: currentWeekRefs(packet),
        pendingAnswerClassification,
      });
      if (pendingRevisionAnswer.kind === 'cancelled') {
        usePendingCoachClarifierStore.getState().clearPending();
        return replyAndFinish(input, 'pending-coach-revision-cancelled', pendingRevisionAnswer.reply);
      }
      if (pendingRevisionAnswer.kind === 'clarify') {
        usePendingCoachClarifierStore.getState().setPending({
          ...pendingClarifier,
          askedQuestion: pendingRevisionAnswer.reply,
          createdAt: pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'pending-coach-revision-clarify', pendingRevisionAnswer.reply);
      }
      if (pendingRevisionAnswer.kind === 'apply_stored') {
        // Confirmation accepted: revalidate the STORED proposal against the
        // CURRENT visible state (it may have changed since we asked), then
        // apply exactly what was offered. No adapter call, no regeneration.
        const storedProposal = pendingRevisionAnswer.envelope.proposal!;
        const visibleWeek = visibleDaysForCoachRevisionProposal({
          packet,
          todayISO: input.todayISO,
          includeDates: storedProposal.scope.dates,
        });
        const before = buildCoachRevisionWeekSnapshotFromProjectedDays(visibleWeek);
        const validation = validateCoachRevisionDiff({
          before,
          proposal: storedProposal,
          policy: coachRevisionValidationPolicyForWeek(visibleWeek, input.todayISO),
        });
        if (validation.status !== 'valid' && validation.status !== 'needs_confirmation') {
          usePendingCoachClarifierStore.getState().clearPending();
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: 'pending-coach-revision-confirm-stale',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: storedProposal.scope.dates[0] ?? null,
            referenceTargetName: null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(
            input,
            'pending-coach-revision-confirm-stale',
            'Your plan changed since I offered that, so I left it as is. Ask again and I will re-check.',
          );
        }
        const pseudoResult: Extract<SemanticCoachRevisionProposalResult, { kind: 'revision' }> = {
          kind: 'revision',
          proposal: storedProposal,
          diff: validation.diff,
          validation: validation as Extract<typeof validation, { status: 'valid' }>,
          diagnostic: {
            proposalKind: 'revision',
            affectedDates: validation.diff.changedDates,
            diffSummary: [],
            validatorStatus: 'valid',
            protectedRefsPreserved: [],
            protectedRefsViolated: [],
            unknownIds: [],
            confirmationRequired: false,
            issues: [],
          },
          confidence: storedProposal.confidence,
        };
        const risk = assessCoachRevisionProposalRisk({
          input,
          proposal: storedProposal,
          diff: validation.diff,
          visibleWeek,
        });
        if (risk.ok === false) {
          usePendingCoachClarifierStore.getState().clearPending();
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: `pending-${risk.route}`,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: storedProposal.scope.dates[0] ?? null,
            referenceTargetName: null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(input, `pending-${risk.route}`, risk.reply);
        }
        if (risk.assessment.decision === 'block') {
          usePendingCoachClarifierStore.getState().clearPending();
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: 'pending-coach-revision-risk-blocked',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: storedProposal.scope.dates[0] ?? null,
            referenceTargetName: null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(
            input,
            'pending-coach-revision-risk-blocked',
            coachRevisionRiskBlockReply(risk.assessment),
          );
        }
        if (
          risk.assessment.decision === 'confirm' &&
          pendingRevisionAnswer.envelope.riskConfirmation?.signature !== risk.signature
        ) {
          return enterCoachRevisionConfirmationTransaction({
            input,
            proposal: storedProposal,
            diff: validation.diff,
            originalMessage: pendingRevisionAnswer.envelope.originalUserWording,
            route: 'pending-coach-revision-risk-confirmation-updated',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: storedProposal.scope.dates[0] ?? null,
            referenceTargetName: null,
            riskAssessment: risk.assessment,
            riskSignature: risk.signature,
          });
        }
        usePendingCoachClarifierStore.getState().clearPending();
        const applied = await applyDevActiveCoachRevision({
          input,
          packet,
          result: pseudoResult,
          visibleWeek,
        });
        input.setLastCoachDebug({
          intent: 'coach_revision_proposal',
          route: `pending_${applied.route}`,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: storedProposal.scope.dates[0] ?? null,
          referenceTargetName: null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: applied.ok,
        });
        return replyAndFinish(input, `pending-${applied.route}`, applied.reply);
      }
      if (pendingRevisionAnswer.kind === 'complete') {
        const revisionMode = controllerCoachRevisionProposalMode(input);
        const answeredClarifications = fillLastCoachRevisionClarificationAnswer(
          pendingRevisionAnswer.envelope.clarifications,
          pendingRevisionAnswer.clarificationAnswer,
        );
        const revisionResult = await buildCoachRevisionProposalForPendingResume({
          input,
          packet,
          pending: pendingClarifier,
          envelope: pendingRevisionAnswer.envelope,
          targetDate: pendingRevisionAnswer.targetDate,
          clarificationAnswer: pendingRevisionAnswer.clarificationAnswer,
          answeredClarifications,
          mode: revisionMode,
        });
        emitCoachTurnDiagnostic('pending_coach_revision_answer_complete', {
          message: input.userMessage.content,
          pendingBefore: pendingDiagnosticSummary(pendingClarifier),
          resolvedTargetDate: pendingRevisionAnswer.targetDate,
          clarificationRounds: answeredClarifications.length,
          storedRevisionAfter: {
            continuationId: pendingRevisionAnswer.envelope.continuationId,
            source: pendingRevisionAnswer.envelope.source,
            intent: pendingRevisionAnswer.envelope.partialIntent?.intent ?? null,
            targetDomain: pendingRevisionAnswer.envelope.partialIntent?.targetDomain ?? null,
            actionScope: pendingRevisionAnswer.envelope.partialIntent?.actionScope ?? null,
            targetDates: pendingRevisionAnswer.envelope.partialIntent?.targetDates ?? [],
            protectedRefs: pendingRevisionAnswer.envelope.partialIntent?.protectedRefs ?? [],
          },
          resultKind: revisionResult?.kind ?? null,
          validatorStatus: revisionResult?.diagnostic.validatorStatus ?? null,
          invalidReason:
            revisionResult?.kind === 'invalid' ? revisionResult.reason : null,
          invalidIssues:
            revisionResult?.kind === 'invalid'
              ? revisionResult.issues.slice(0, 6)
              : null,
        });
        if (revisionResult) {
          emitCoachRevisionProposalDiagnostic({
            input,
            diagnostic: diagnosticFromCoachRevisionProposalResult({
              mode: revisionMode === 'off' ? 'active' : revisionMode,
              result: revisionResult,
            }),
          });
        }
        if (revisionMode !== 'active' || !revisionResult) {
          usePendingCoachClarifierStore.getState().clearPending();
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: 'pending-coach-revision-unavailable',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: pendingRevisionAnswer.targetDate,
            referenceTargetName: null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(
            input,
            'pending-coach-revision-unavailable',
            revisionMode === 'active' && !input.coachRevisionProposalAdapter
              ? COACH_REVISION_MISCONFIGURED_REPLY
              : "I couldn't safely resume that revision, so I left the plan unchanged.",
          );
        }
        if (revisionResult.kind === 'revision') {
          const visibleWeek = visibleDaysForCoachRevisionProposal({
            packet,
            todayISO: input.todayISO,
            includeDates: pendingRevisionAnswer.targetDate
              ? [pendingRevisionAnswer.targetDate]
              : [],
          });
          const risk = assessCoachRevisionProposalRisk({
            input,
            proposal: revisionResult.proposal,
            diff: revisionResult.diff,
            visibleWeek,
          });
          if (risk.ok === false) {
            usePendingCoachClarifierStore.getState().clearPending();
            input.setLastCoachDebug({
              intent: 'coach_revision_proposal',
              route: `pending-${risk.route}`,
              referenceStatus: packet.referenceResolution?.status ?? null,
              referenceTargetDate: pendingRevisionAnswer.targetDate,
              referenceTargetName: null,
              mutationLike: true,
              legacyCalled: false,
              replySource: 'deterministic',
              applied: false,
            });
            return replyAndFinish(input, `pending-${risk.route}`, risk.reply);
          }
          if (risk.assessment.decision === 'block') {
            usePendingCoachClarifierStore.getState().clearPending();
            input.setLastCoachDebug({
              intent: 'coach_revision_proposal',
              route: 'pending-coach-revision-risk-blocked',
              referenceStatus: packet.referenceResolution?.status ?? null,
              referenceTargetDate: pendingRevisionAnswer.targetDate,
              referenceTargetName: null,
              mutationLike: true,
              legacyCalled: false,
              replySource: 'deterministic',
              applied: false,
            });
            return replyAndFinish(
              input,
              'pending-coach-revision-risk-blocked',
              coachRevisionRiskBlockReply(risk.assessment),
            );
          }
          if (risk.assessment.decision === 'confirm') {
            return enterCoachRevisionConfirmationTransaction({
              input,
              proposal: revisionResult.proposal,
              diff: revisionResult.diff,
              originalMessage:
                pendingRevisionAnswer.envelope?.originalUserWording ??
                input.userMessage.content,
              route: 'pending-coach-revision-risk-confirmation',
              referenceStatus: packet.referenceResolution?.status ?? null,
              referenceTargetDate: pendingRevisionAnswer.targetDate,
              referenceTargetName: null,
              riskAssessment: risk.assessment,
              riskSignature: risk.signature,
            });
          }
          const applied = await applyDevActiveCoachRevision({
            input,
            packet,
            result: revisionResult,
            visibleWeek,
          });
          if (applied.ok) {
            usePendingCoachClarifierStore.getState().clearPending();
          }
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: `pending_${applied.route}`,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: pendingRevisionAnswer.targetDate,
            referenceTargetName: null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: applied.ok,
          });
          return replyAndFinish(input, `pending-${applied.route}`, applied.reply);
        }
        if (revisionResult.kind === 'clarify') {
          // Progress, not reset: accumulate the answered round and ask the
          // next question. When the round cap is exhausted, decline honestly
          // rather than looping.
          const nextPending = capturePendingFromCoachRevisionClarify({
            result: revisionResult,
            latestMessage: input.userMessage.content,
            previousEnvelope: pendingRevisionAnswer.envelope,
            answeredClarifications,
          });
          if (!nextPending) {
            usePendingCoachClarifierStore.getState().clearPending();
            input.setLastCoachDebug({
              intent: 'coach_revision_proposal',
              route: 'pending-coach-revision-clarify-rounds-exhausted',
              referenceStatus: packet.referenceResolution?.status ?? null,
              referenceTargetDate: pendingRevisionAnswer.targetDate,
              referenceTargetName: null,
              mutationLike: true,
              legacyCalled: false,
              replySource: 'deterministic',
              applied: false,
            });
            return replyAndFinish(
              input,
              'pending-coach-revision-clarify-rounds-exhausted',
              "I still can't pin down exactly what to change, so I've left the plan as is. Try one message with the day and what to change, like \"remove strength on Monday the 6th\".",
            );
          }
          usePendingCoachClarifierStore.getState().setPending({
            ...nextPending,
            createdAt: pendingClarifier.createdAt,
          });
          return replyAndFinish(
            input,
            'pending-coach-revision-regenerated-clarify',
            withTemplateOptionsForReplacement(
              revisionResult.proposal.missingField,
              revisionResult.reply,
            ),
          );
        }
        if (revisionResult.kind === 'not_an_edit') {
          // A resume that comes back "not an edit" means the transaction no
          // longer describes a change; close it honestly rather than leaking
          // the turn mid-transaction.
          usePendingCoachClarifierStore.getState().clearPending();
          return replyAndFinish(
            input,
            'pending-coach-revision-not-an-edit',
            'No worries - leaving the plan as it is.',
          );
        }
        if (revisionResult.kind === 'out_of_scope_setup') {
          // Mid-transaction setup pivot: close the one-off transaction and
          // redirect honestly — routing a short clarification answer into the
          // setup interpreter would lose the original request anyway.
          usePendingCoachClarifierStore.getState().clearPending();
          return replyAndFinish(
            input,
            'pending-coach-revision-out-of-scope-setup',
            "That's a schedule change rather than a one-off edit. Send it to me as one message - like \"I'm away next week\" or \"I can only train Mon/Wed/Fri now\" - and I'll update your plan properly.",
          );
        }
        if (revisionResult.kind === 'needs_confirmation') {
          // Same transaction owner as the fresh-message path — a resume that
          // needs confirmation stores the proposal and asks yes/no; it never
          // discards the athlete's choice.
          const visibleWeek = visibleDaysForCoachRevisionProposal({
            packet,
            todayISO: input.todayISO,
            includeDates: revisionResult.proposal.scope.dates,
          });
          const risk = assessCoachRevisionProposalRisk({
            input,
            proposal: revisionResult.proposal,
            diff: revisionResult.diff,
            visibleWeek,
          });
          if (risk.ok === false) {
            usePendingCoachClarifierStore.getState().clearPending();
            return replyAndFinish(input, `pending-${risk.route}`, risk.reply);
          }
          if (risk.assessment.decision === 'block') {
            usePendingCoachClarifierStore.getState().clearPending();
            return replyAndFinish(
              input,
              'pending-coach-revision-risk-blocked',
              coachRevisionRiskBlockReply(risk.assessment),
            );
          }
          return enterCoachRevisionConfirmationTransaction({
            input,
            proposal: revisionResult.proposal,
            diff: revisionResult.diff,
            originalMessage:
              pendingRevisionAnswer.envelope?.originalUserWording ??
              input.userMessage.content,
            route: 'pending-coach-revision-needs-confirmation',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: pendingRevisionAnswer.targetDate,
            referenceTargetName: null,
            riskAssessment: risk.assessment.decision === 'confirm' ? risk.assessment : null,
            riskSignature: risk.assessment.decision === 'confirm' ? risk.signature : null,
          });
        }
        usePendingCoachClarifierStore.getState().clearPending();
        const reply = coachRevisionInvalidReply(revisionResult);
        input.setLastCoachDebug({
          intent: 'coach_revision_proposal',
          route: `pending-coach-revision-${revisionResult.kind}`,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: pendingRevisionAnswer.targetDate,
          referenceTargetName: null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        return replyAndFinish(input, `pending-coach-revision-${revisionResult.kind}`, reply);
      }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        logger.error('[coach-revision-proposal] pending_resume_exception', { detail });
        if (controllerCoachRevisionProposalMode(input) === 'active') {
          usePendingCoachClarifierStore.getState().clearPending();
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: 'coach-revision-proposal-error',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: null,
            referenceTargetName: null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(
            input,
            'coach-revision-proposal-error',
            `[dev] Coach revision path crashed (${detail}). No changes made - see logs.`,
          );
        }
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
        const guarded = await executeProgramEditWithVisibleGuard({
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

      const pendingDraftAnswer = resolvePendingProgramEditDraftAnswer({
        pending: pendingClarifier,
        userMessage: input.userMessage.content,
        todayISO: input.todayISO,
        currentWeek: currentWeekRefs(packet),
        pendingAnswerClassification,
      });
      if (pendingDraftAnswer.kind === 'cancelled') {
        usePendingCoachClarifierStore.getState().clearPending();
        return replyAndFinish(input, 'pending-program-edit-draft-cancelled', pendingDraftAnswer.reply);
      }
      if (pendingDraftAnswer.kind === 'clarify') {
        const envelope = pendingClarifier.programEditDraftEnvelope;
        usePendingCoachClarifierStore.getState().setPending({
          ...pendingClarifier,
          askedQuestion: pendingDraftAnswer.reply,
          programEditDraftEnvelope: envelope
            ? { ...envelope, draft: pendingDraftAnswer.draft }
            : undefined,
          pendingClarification: pendingClarifier.pendingClarification
            ? {
                ...pendingClarifier.pendingClarification,
                partialDraft: pendingDraftAnswer.draft,
              }
            : undefined,
          createdAt: pendingClarifier.createdAt,
        });
        return replyAndFinish(input, 'pending-program-edit-draft-clarify', pendingDraftAnswer.reply);
      }
      if (pendingDraftAnswer.kind === 'complete') {
        const resumedDraft = pendingDraftAnswer.draft;
        emitCoachTurnDiagnostic('pending_draft_answer_complete', {
          message: input.userMessage.content,
          storedDraftBefore: draftDiagnosticSummary(
            pendingClarifier.programEditDraftEnvelope?.draft,
          ),
          resumedDraftAfter: draftDiagnosticSummary(resumedDraft),
          patchedOnlyTargetDate: pendingDraftOnlyPatchedTargetDate(
            pendingClarifier.programEditDraftEnvelope?.draft,
            resumedDraft,
          ),
        });
        const draftFrontDoor = decideProgramEditDraftFrontDoor(resumedDraft);
        logger.warn('[pending-program-edit-draft-resume]', {
          continuationId: pendingClarifier.programEditDraftEnvelope?.continuationId ?? null,
          source: pendingClarifier.programEditDraftEnvelope?.source ?? null,
          targetDate: resumedDraft.targetDate,
          targetDomain: resumedDraft.targetDomain,
          actionScope: resumedDraft.actionScope,
          protectedTargets: resumedDraft.protectedTargets.map((target) => ({
            targetDomain: target.targetDomain,
            actionScope: target.actionScope,
            title: target.title ?? null,
          })),
          frontDoor: draftFrontDoor.kind,
          legacyBlocked: true,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        if (
          draftFrontDoor.kind === 'ask_clarification' ||
          draftFrontDoor.kind === 'unsupported'
        ) {
          if (draftFrontDoor.kind === 'ask_clarification') {
            const envelope = pendingClarifier.programEditDraftEnvelope;
            usePendingCoachClarifierStore.getState().setPending({
              ...pendingClarifier,
              missingFields: resumedDraft.missingFields,
              askedQuestion: draftFrontDoor.reply,
              programEditDraftEnvelope: envelope
                ? { ...envelope, draft: resumedDraft }
                : undefined,
              pendingClarification: {
                originalIntent: `${resumedDraft.intent}:${resumedDraft.targetDomain}:${resumedDraft.actionScope}`,
                missingField: resumedDraft.missingFields[0] ?? 'program_edit',
                expectedAnswerType: semanticExpectedAnswerType(resumedDraft.missingFields[0]),
                source: pendingClarifier.programEditDraftEnvelope?.source,
                continuationId: pendingClarifier.programEditDraftEnvelope?.continuationId,
                originalUserWording:
                  pendingClarifier.programEditDraftEnvelope?.originalUserWording ??
                  resumedDraft.explicitUserWording,
                candidateOptions: draftFrontDoor.options,
                partialDraft: resumedDraft,
                reason: draftFrontDoor.route,
              },
              createdAt: pendingClarifier.createdAt,
            });
          } else {
            usePendingCoachClarifierStore.getState().clearPending();
          }
          input.setLastCoachDebug({
            intent: 'program_edit_draft',
            route: `pending_program_edit_draft:${draftFrontDoor.route}`,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: resumedDraft.targetDate,
            referenceTargetName: resumedDraft.sourceTarget?.sessionName ?? null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(input, 'pending-program-edit-draft-front-door', draftFrontDoor.reply);
        }

        const programEditFromDraft = programEditFromSemanticProgramEditDraft({
          draft: resumedDraft,
          userMessage: pendingClarifier.originalMessage,
          todayISO: input.todayISO,
          resolveVisibleProgramForDate: (date) =>
            resolveLiveVisibleProgramForDate(date, input.todayISO),
        });
        const draftExecutionGuard = validateProgramEditAgainstDraft(
          resumedDraft,
          programEditFromDraft,
        );
        if (draftExecutionGuard.kind === 'blocked') {
          usePendingCoachClarifierStore.getState().clearPending();
          input.setLastCoachDebug({
            intent: 'program_edit_draft',
            route: `pending_program_edit_draft:${draftExecutionGuard.route}`,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: resumedDraft.targetDate,
            referenceTargetName: resumedDraft.sourceTarget?.sessionName ?? null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(input, 'pending-program-edit-draft-guard', draftExecutionGuard.reply);
        }
        const guarded = await executeProgramEditWithVisibleGuard({
          input,
          programEdit: programEditFromDraft,
          draft: resumedDraft,
          referenceResolution: packet.referenceResolution ?? null,
          userMessage: pendingClarifier.originalMessage,
          source: 'pending_program_edit_draft_resume',
        });
        if (guarded.kind === 'blocked') {
          return replyAndFinish(
            input,
            'pending-program-edit-draft-visible-guard',
            guarded.verification.reply,
          );
        }
        const result = guarded.result;
        recordVerifiedProgramEditMutationFocus(programEditFromDraft, result, input.todayISO);
        if (result.kind === 'mutated' && result.applied) {
          usePendingCoachClarifierStore.getState().clearPending();
        }
        return replyAndFinish(input, 'pending-program-edit-draft-resume', result.reply);
      }
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
        emitCoachTurnDiagnostic('pending_legacy_program_edit_answer_complete', {
          message: input.userMessage.content,
          pendingBefore: pendingDiagnosticSummary(pendingClarifier),
          resumedProgramEdit: programEditDiagnosticSummary(pendingProgramEditAnswer.programEdit),
        });
        logger.warn('[pending-program-edit-resume]', {
          missingFields: pendingClarifier.programEdit?.missingFields ?? pendingClarifier.missingFields,
          targetDate: pendingProgramEditAnswer.programEdit.targetDate,
          targetItemId: pendingProgramEditAnswer.programEdit.targetItemId,
          targetItemTitle: pendingProgramEditAnswer.programEdit.targetItemTitle,
          legacyBlocked: true,
          ageMs: Date.now() - pendingClarifier.createdAt,
        });
        const guarded = await executeProgramEditWithVisibleGuard({
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
        const guarded = await executeProgramEditWithVisibleGuard({
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
        return replyAndFinish(input, 'clarifier-no', 'Got it - leaving things as they are.');
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

    const revisionMode = controllerCoachRevisionProposalMode(input);
    if (revisionMode === 'active' && !input.coachRevisionProposalAdapter) {
      // Fail loud: active mode with no adapter means env/endpoint wiring is
      // broken. Falling through here would silently hand mutation turns back
      // to legacy paths, which is exactly the failure mode Stage 0 removes.
      logger.error('[coach-revision-proposal] active_mode_without_adapter', {
        rawMode: input.coachRevisionProposalRawMode ?? null,
        activeAllowed: input.coachRevisionProposalActiveAllowed ?? null,
      });
      emitCoachTurnDiagnostic('coach_revision_proposal_misconfigured', {
        message: input.userMessage.content,
        rawRevisionMode: input.coachRevisionProposalRawMode ?? null,
        revisionMode,
        revisionAdapterPresent: false,
      });
      input.setLastCoachDebug({
        intent: 'coach_revision_proposal',
        route: 'coach-revision-proposal-misconfigured',
        referenceStatus: packet.referenceResolution?.status ?? null,
        referenceTargetDate: null,
        referenceTargetName: null,
        mutationLike: true,
        legacyCalled: false,
        replySource: 'deterministic',
        applied: false,
      });
      return replyAndFinish(
        input,
        'coach-revision-proposal-misconfigured',
        COACH_REVISION_MISCONFIGURED_REPLY,
      );
    }
    // No-legacy-on-exception boundary: any throw inside the revision path
    // (including diagnostics) must dead-end fail-loud in active mode. Falling
    // out of this region on an exception would hand a mutation turn to the
    // legacy dispatch/coach-chat layers — the exact leak class the pivot
    // removes.
    try {
    const revisionResult = await buildCoachRevisionProposalForController({
      input,
      packet,
      mode: revisionMode,
    });
    emitCoachTurnDiagnostic('coach_revision_proposal_result', {
      message: input.userMessage.content,
      rawRevisionMode: input.coachRevisionProposalRawMode ?? null,
      revisionMode,
      resolvedRevisionMode: revisionMode,
      revisionAdapterPresent: !!input.coachRevisionProposalAdapter,
      activeModeConfigAllowed: input.coachRevisionProposalActiveAllowed ?? null,
      handledPath:
        revisionMode === 'active'
          ? 'active'
          : revisionMode === 'shadow'
            ? 'shadow'
            : 'off',
      resultKind: revisionResult?.kind ?? null,
      validatorStatus: revisionResult?.diagnostic.validatorStatus ?? null,
      affectedDates: revisionResult?.diagnostic.affectedDates ?? [],
      confidence:
        revisionResult && 'confidence' in revisionResult
          ? revisionResult.confidence
          : null,
      clarifyMissingField:
        revisionResult?.kind === 'clarify'
          ? revisionResult.proposal.missingField
          : null,
      clarifyReason:
        revisionResult?.kind === 'clarify' ? revisionResult.reason ?? null : null,
      invalidReason:
        revisionResult?.kind === 'invalid' ? revisionResult.reason : null,
      invalidIssues:
        revisionResult?.kind === 'invalid'
          ? revisionResult.issues.slice(0, 6)
          : null,
      invalidProposalDates:
        revisionResult?.kind === 'invalid' &&
        revisionResult.proposal?.kind === 'revision'
          ? revisionResult.proposal.scope.dates
          : null,
    });
    if (revisionResult && revisionMode !== 'off') {
      emitCoachRevisionProposalDiagnostic({
        input,
        diagnostic: diagnosticFromCoachRevisionProposalResult({
          mode: revisionMode,
          result: revisionResult,
        }),
      });
      if (revisionMode === 'shadow') {
        logger.debug('[coach-revision-proposal-shadow]', {
          kind: revisionResult.kind,
          ignoredForExecution: true,
          diagnostic: revisionResult.diagnostic,
        });
      } else if (revisionResult.kind === 'revision') {
        const staleRevisionClarifier =
          capturePendingDateClarificationFromCoachRevisionProposal({
            result: revisionResult,
            originalMessage: input.userMessage.content,
            todayISO: input.todayISO,
          });
        if (staleRevisionClarifier) {
          usePendingCoachClarifierStore.getState().setPending(staleRevisionClarifier);
          emitCoachTurnDiagnostic('pending_set_coach_revision_stale_date', {
            message: input.userMessage.content,
            pendingAfter: pendingDiagnosticSummary(staleRevisionClarifier as PendingCoachClarifier),
          });
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: staleRevisionClarifier.pendingClarification?.reason ??
              'pending_clarification:coach_revision_target_date:past_date',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate:
              revisionResult.proposal.scope.dates[0] ??
              revisionResult.proposal.userIntent.targetDates[0] ??
              null,
            referenceTargetName: null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          logger.warn('[pending-clarifier-set]', {
            operation: staleRevisionClarifier.operation,
            scope: staleRevisionClarifier.scope,
            missingFields: staleRevisionClarifier.missingFields,
            source: 'coach_revision_proposal_stale_target_date',
          });
          return replyAndFinish(
            input,
            'coach-revision-proposal-stale-target-date',
            staleRevisionClarifier.askedQuestion,
          );
        }
        const visibleWeek = uniqueResolvedDays([
          ...(packet.currentWeek ?? []),
          ...(packet.nextWeek ?? []),
        ]);
        const risk = assessCoachRevisionProposalRisk({
          input,
          proposal: revisionResult.proposal,
          diff: revisionResult.diff,
          visibleWeek,
        });
        if (risk.ok === false) {
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: risk.route,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
            referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(input, risk.route, risk.reply);
        }
        if (risk.assessment.decision === 'block') {
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: 'coach-revision-proposal-risk-blocked',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
            referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(
            input,
            'coach-revision-proposal-risk-blocked',
            coachRevisionRiskBlockReply(risk.assessment),
          );
        }
        if (risk.assessment.decision === 'confirm') {
          return enterCoachRevisionConfirmationTransaction({
            input,
            proposal: revisionResult.proposal,
            diff: revisionResult.diff,
            originalMessage: input.userMessage.content,
            route: 'coach-revision-proposal-risk-confirmation',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
            referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
            riskAssessment: risk.assessment,
            riskSignature: risk.signature,
          });
        }
        const applied = await applyDevActiveCoachRevision({
          input,
          packet,
          result: revisionResult,
          visibleWeek,
        });
        input.setLastCoachDebug({
          intent: 'coach_revision_proposal',
          route: applied.route,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
          referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: applied.ok,
        });
        return replyAndFinish(input, applied.route, applied.reply);
      } else if (revisionResult.kind === 'needs_confirmation') {
        // Confirmation is a TRANSACTION, not a dead end: store the validated
        // proposal so "yes" applies it and "no" cancels it. Shared owner with
        // the pending-resume path.
        const visibleWeek = visibleDaysForCoachRevisionProposal({
          packet,
          todayISO: input.todayISO,
          includeDates: revisionResult.proposal.scope.dates,
        });
        const risk = assessCoachRevisionProposalRisk({
          input,
          proposal: revisionResult.proposal,
          diff: revisionResult.diff,
          visibleWeek,
        });
        if (risk.ok === false) {
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: risk.route,
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
            referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(input, risk.route, risk.reply);
        }
        if (risk.assessment.decision === 'block') {
          input.setLastCoachDebug({
            intent: 'coach_revision_proposal',
            route: 'coach-revision-proposal-risk-blocked',
            referenceStatus: packet.referenceResolution?.status ?? null,
            referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
            referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
            mutationLike: true,
            legacyCalled: false,
            replySource: 'deterministic',
            applied: false,
          });
          return replyAndFinish(
            input,
            'coach-revision-proposal-risk-blocked',
            coachRevisionRiskBlockReply(risk.assessment),
          );
        }
        return enterCoachRevisionConfirmationTransaction({
          input,
          proposal: revisionResult.proposal,
          diff: revisionResult.diff,
          originalMessage: input.userMessage.content,
          route: 'coach-revision-proposal-needs-confirmation',
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
          referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
          riskAssessment: risk.assessment.decision === 'confirm' ? risk.assessment : null,
          riskSignature: risk.assessment.decision === 'confirm' ? risk.signature : null,
        });
      } else if (revisionResult.kind === 'clarify') {
        // Store the clarification transaction so the athlete's next short
        // answer resumes with original wording + partial intent instead of
        // arriving as a context-free new turn.
        const clarifyPending = capturePendingFromCoachRevisionClarify({
          result: revisionResult,
          latestMessage: input.userMessage.content,
        });
        if (clarifyPending) {
          usePendingCoachClarifierStore.getState().setPending(clarifyPending);
          emitCoachTurnDiagnostic('pending_set_coach_revision_clarify', {
            message: input.userMessage.content,
            missingField: revisionResult.proposal.missingField,
            reason: revisionResult.reason ?? null,
            pendingAfter: pendingDiagnosticSummary(clarifyPending as PendingCoachClarifier),
          });
        }
        input.setLastCoachDebug({
          intent: 'coach_revision_proposal',
          route: 'coach-revision-proposal-clarify',
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
          referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        return replyAndFinish(
          input,
          'coach-revision-proposal-clarify',
          withTemplateOptionsForReplacement(
            revisionResult.proposal.missingField,
            revisionResult.reply,
          ),
        );
      } else if (revisionResult.kind === 'not_an_edit') {
        // Typed release: the message is not a program change. Deliberately no
        // return — the conversation layers (classifier/coach-chat) own the
        // turn from here. Legacy MUTATION execution stays fenced by its own
        // guards; questions and chit-chat get real conversational answers
        // instead of "I think that is a program edit…".
        emitCoachTurnDiagnostic('coach_revision_not_an_edit', {
          message: input.userMessage.content,
          reason: revisionResult.reason,
          confidence: revisionResult.confidence,
          mutationLike: isMutationLike(input.userMessage.content),
        });
      } else if (revisionResult.kind === 'out_of_scope_setup') {
        // Typed release to the setup/regeneration pipeline: program-SHAPE
        // changes (recurring schedule, availability, frequency) must alter
        // generation inputs, never date overrides. Deliberately no return —
        // the deterministic setup interpreter downstream owns the turn
        // (audited working: profile patch → regenerate → verify → write).
        emitCoachTurnDiagnostic('coach_revision_out_of_scope_setup', {
          message: input.userMessage.content,
          reason: revisionResult.reason,
          detectedChange: revisionResult.detectedChange,
          confidence: revisionResult.confidence,
        });
      } else if (revisionResult.kind === 'invalid') {
        input.setLastCoachDebug({
          intent: 'coach_revision_proposal',
          route: `coach-revision-proposal-invalid:${revisionResult.reason}`,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
          referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        return replyAndFinish(
          input,
          'coach-revision-proposal-invalid',
          coachRevisionInvalidReply(revisionResult),
        );
      }
    }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.error('[coach-revision-proposal] active_path_exception', { detail });
      if (revisionMode === 'active') {
        input.setLastCoachDebug({
          intent: 'coach_revision_proposal',
          route: 'coach-revision-proposal-error',
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: null,
          referenceTargetName: null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        return replyAndFinish(
          input,
          'coach-revision-proposal-error',
          `[dev] Coach revision path crashed (${detail}). No changes made - see logs.`,
        );
      }
      // Shadow mode never owned the turn; legacy continues as before.
    }

    const semanticMode = controllerSemanticProgramEditDraftMode(input);
    let semanticProgramEditForExecution: ProgramEdit | null = null;
    let semanticDraftOwnsCurrentPacket = false;
    const semanticDraftResult = await buildSemanticProgramEditDraftForController({
      input,
      packet,
      mode: semanticMode,
    });
    emitCoachTurnDiagnostic('semantic_parser_result', {
      message: input.userMessage.content,
      rawSemanticMode: input.semanticProgramEditDraftRawMode ?? null,
      semanticMode,
      resolvedSemanticMode: semanticMode,
      semanticAdapterPresent: !!input.semanticProgramEditDraftAdapter,
      activeModeConfigAllowed: input.semanticProgramEditDraftActiveAllowed ?? null,
      activeSemanticAllowed:
        semanticMode === 'active' &&
        (input.semanticProgramEditDraftActiveAllowed ?? true) &&
        !!input.semanticProgramEditDraftAdapter,
      handledPath:
        semanticMode === 'active'
          ? 'active'
          : semanticMode === 'shadow'
            ? 'shadow'
            : 'off',
      resultKind: semanticDraftResult?.kind ?? null,
      resultReason:
        semanticDraftResult && 'reason' in semanticDraftResult
          ? semanticDraftResult.reason
          : null,
    });
    if (semanticDraftResult) {
      logger.debug('[coach-semantic-program-edit-draft]', {
        mode: semanticMode,
        kind: semanticDraftResult.kind,
        confidence: 'confidence' in semanticDraftResult ? semanticDraftResult.confidence : null,
        reason: 'reason' in semanticDraftResult ? semanticDraftResult.reason : null,
      });
      if (semanticMode !== 'off') {
        emitSemanticProgramEditDraftDiagnostic({
          input,
          diagnostic: diagnosticFromSemanticProgramEditDraftResult({
            mode: semanticMode,
            result: semanticDraftResult,
          }),
        });
      }
      if (semanticMode === 'shadow') {
        logger.debug('[coach-semantic-program-edit-draft-shadow]', {
          kind: semanticDraftResult.kind,
          ignoredForExecution: true,
        });
      } else if (semanticDraftResult.kind === 'draft') {
        packet = {
          ...packet,
          programEditDraft: semanticDraftResult.draft,
        };
        semanticDraftOwnsCurrentPacket = true;
        semanticProgramEditForExecution = programEditFromSemanticProgramEditDraft({
          draft: semanticDraftResult.draft,
          userMessage: input.userMessage.content,
          todayISO: input.todayISO,
          resolveVisibleProgramForDate: (date) =>
            resolveLiveVisibleProgramForDate(date, input.todayISO),
        });
      } else if (semanticDraftResult.kind === 'clarify') {
        const captured = pendingClarifierFromSemanticClarify({
          result: semanticDraftResult,
          originalMessage: input.userMessage.content,
        });
        usePendingCoachClarifierStore.getState().setPending(captured);
        logger.warn('[pending-clarifier-set]', {
          operation: captured.operation,
          scope: captured.scope,
          missingFields: captured.missingFields,
          partialPayload: captured.partialPayload,
          askedQuestion: captured.askedQuestion,
          source: 'semantic_program_edit_draft',
        });
        input.setLastCoachDebug({
          intent: 'semantic_program_edit_draft',
          route: `semantic_program_edit_draft_clarify:${semanticDraftResult.reason}`,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
          referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        return replyAndFinish(input, 'semantic-program-edit-clarify', semanticDraftResult.reply);
      } else if (semanticDraftResult.kind === 'unsupported') {
        input.setLastCoachDebug({
          intent: 'semantic_program_edit_draft',
          route: `semantic_program_edit_draft_unsupported:${semanticDraftResult.reason}`,
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: packet.referenceResolution?.target?.date ?? null,
          referenceTargetName: packet.referenceResolution?.target?.sessionName ?? null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        return replyAndFinish(input, 'semantic-program-edit-unsupported', semanticDraftResult.reply);
      } else if (semanticDraftResult.kind === 'invalid') {
        logger.warn('[coach-semantic-program-edit-draft] invalid_fallback', {
          reason: semanticDraftResult.reason,
          issues: semanticDraftResult.issues,
        });
      }
    }

    if (semanticDraftOwnsCurrentPacket) {
      const staleSemanticDraftClarifier =
        capturePendingDateClarificationFromProgramEditDraftTarget({
          draft: packet.programEditDraft,
          originalMessage: input.userMessage.content,
          todayISO: input.todayISO,
          source: 'semantic',
        });
      if (staleSemanticDraftClarifier) {
        usePendingCoachClarifierStore.getState().setPending(staleSemanticDraftClarifier);
        emitCoachTurnDiagnostic('pending_set_semantic_stale_date', {
          message: input.userMessage.content,
          storedDraft: draftDiagnosticSummary(packet.programEditDraft),
          pendingAfter: pendingDiagnosticSummary(staleSemanticDraftClarifier as PendingCoachClarifier),
        });
        input.setLastCoachDebug({
          intent: 'semantic_program_edit_draft',
          route: staleSemanticDraftClarifier.pendingClarification?.reason ??
            'pending_clarification:target_date:past_date',
          referenceStatus: packet.referenceResolution?.status ?? null,
          referenceTargetDate: packet.programEditDraft?.targetDate ?? null,
          referenceTargetName: packet.programEditDraft?.sourceTarget?.sessionName ?? null,
          mutationLike: true,
          legacyCalled: false,
          replySource: 'deterministic',
          applied: false,
        });
        logger.warn('[pending-clarifier-set]', {
          operation: staleSemanticDraftClarifier.operation,
          scope: staleSemanticDraftClarifier.scope,
          missingFields: staleSemanticDraftClarifier.missingFields,
          targetDomain: packet.programEditDraft?.targetDomain ?? null,
          actionScope: packet.programEditDraft?.actionScope ?? null,
          source: 'semantic_program_edit_draft_stale_target_date',
        });
        return replyAndFinish(
          input,
          'semantic-program-edit-draft-stale-target-date',
          staleSemanticDraftClarifier.askedQuestion,
        );
      }
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
    if (draftFrontDoor.kind === 'allow_conversation' && semanticProgramEditForExecution) {
      semanticProgramEditForExecution = null;
    }

    if (semanticProgramEditForExecution?.intent === 'ask_question') {
      const reply =
        semanticProgramEditForExecution.question ??
        'I understand the edit, but I need one more detail before changing the program.';
      const captured = pendingClarifierFromSemanticClarify({
        result: {
          kind: 'clarify',
          reply,
          options: semanticProgramEditForExecution.options,
          confidence: semanticProgramEditForExecution.confidence,
          reason: semanticProgramEditForExecution.naturalLanguageReason,
          response: {
            schemaVersion: 'program_edit_draft.v1',
            status: 'clarify',
            confidence: semanticProgramEditForExecution.confidence,
            draft: packet.programEditDraft ?? null,
            clarificationQuestion: reply,
            candidateOptions: semanticProgramEditForExecution.options,
            reason: semanticProgramEditForExecution.naturalLanguageReason,
          },
        },
        originalMessage: input.userMessage.content,
      });
      usePendingCoachClarifierStore.getState().setPending(captured);
      return replyAndFinish(input, 'semantic-program-edit-finaliser-clarify', reply);
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
    const routedProgramEdit = semanticProgramEditForExecution ?? interpretCoachMessageToProgramEdit({
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
    const commandlessTypedStrengthBlockProgramEdit =
      isCommandlessTypedStrengthBlockProgramEdit(routedProgramEdit);
    if (!routedProgramEdit.command && !commandlessTypedStrengthBlockProgramEdit) {
      return replyAndFinish(
        input,
        'semantic-program-edit-no-command',
        'I understand the edit, but I need one more detail before changing the program.',
      );
    }
    const routedCommand: CoachCommand | null =
      routedProgramEdit.command ? routedProgramEdit.command as CoachCommand : null;
    if (routedCommand) {
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
    } else {
      logger.debug('[coach-router] commandless_typed_program_edit', {
        intent: routedProgramEdit.intent,
        targetDomain: routedProgramEdit.targetDomain,
        editScope: 'editScope' in routedProgramEdit ? routedProgramEdit.editScope ?? null : null,
        legacyAllowed: false,
      });
    }

    let commandForExecution: CoachCommand | null = routedCommand;
    let programEditForExecution = routedProgramEdit;
    const staleDateClarifier = commandForExecution
      ? capturePendingDateClarificationFromPastProgramEditTarget({
          programEdit: programEditForExecution,
          command: commandForExecution,
          draft: packet.programEditDraft,
          originalMessage: input.userMessage.content,
          todayISO: input.todayISO,
        })
      : null;
    if (staleDateClarifier) {
      usePendingCoachClarifierStore.getState().setPending(staleDateClarifier);
      emitCoachTurnDiagnostic('pending_set_legacy_stale_date', {
        message: input.userMessage.content,
        semanticDraftInPacket: draftDiagnosticSummary(packet.programEditDraft),
        programEdit: programEditDiagnosticSummary(programEditForExecution),
        pendingAfter: pendingDiagnosticSummary(staleDateClarifier as PendingCoachClarifier),
      });
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
        targetStatus: (commandForExecution as any)?.target?.kind ?? 'absent',
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
    if (routedCommand && shouldTryLLMCoachCommand(routedCommand, input.userMessage.content)) {
      const llmIntent = classifiedCoachIntent ?? await input.classifier.classify(packet);
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

    if (
      (commandForExecution && isMutateCommand(commandForExecution)) ||
      isCommandlessTypedStrengthBlockProgramEdit(programEditForExecution)
    ) {
      const guarded = await executeProgramEditWithVisibleGuard({
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
      const dateClarifier = commandForExecution
        ? capturePendingDateClarificationFromProgramEditRejection({
            result,
            programEdit: programEditForExecution,
            command: commandForExecution,
            draft: packet.programEditDraft,
            originalMessage: input.userMessage.content,
            todayISO: input.todayISO,
          })
        : null;

      if (result.kind === 'clarify') {
        const captured = commandForExecution
          ? captureFromExecutorClarify({
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
            })
          : null;
        if (captured) {
          usePendingCoachClarifierStore.getState().setPending(captured);
          logger.warn('[pending-clarifier-set]', {
            operation: captured.operation,
            scope: captured.scope,
            missingFields: captured.missingFields,
            partialPayload: captured.partialPayload,
            targetStatus: (commandForExecution as any)?.target?.kind ?? 'absent',
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
          targetStatus: (commandForExecution as any)?.target?.kind ?? 'absent',
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

    const intent: CoachIntent = classifiedCoachIntent ?? await input.classifier.classify(packet);
    classifiedCoachIntent = intent;
    logger.debug('[coach-flow] intent', {
      kind: intent.intent,
      confidence: intent.confidence,
      needsClarification: intent.needsClarification,
      source: 'router_bypass',
    });

    const deps = buildLiveDispatchDeps(input.todayISO);
    const outcome = await dispatchCoachIntent(intent, packet, deps);

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
