import { getMondayForDate, type ResolvedDay } from './sessionResolver';
import type {
  DayOfWeek,
  OnboardingData,
  ProgramAvailabilityConstraint,
  TrainingProgram,
} from '../types/domain';
import {
  routeCoachCommand,
  type CoachCommand,
  type CoachCommandTarget,
  type CoachMutatePayload,
  type ConditioningIntentModality,
  type RouteCoachCommandInput,
  type VisibleSessionRef,
} from './coachCommandRouter';
import type { CoachReferenceResolution } from './coachReferenceResolver';
import type { CoachTargetFrame } from './coachTargetFrame';
import type {
  ProgramEditDraft as SemanticProgramEditDraft,
  ProgramEditDraftActionScope as SemanticProgramEditDraftActionScope,
  ProgramEditDraftProtectedTarget as SemanticProgramEditDraftProtectedTarget,
  ProgramEditDraftIntent as SemanticProgramEditDraftIntent,
  ProgramEditDraftTargetDomain as SemanticProgramEditDraftTargetDomain,
} from './coachProgramEditDraft';
import {
  isBlockTargetMissingFieldName,
  isBlockLevelProgramEditDraft,
  isTargetItemMissingFieldName,
} from './coachProgramEditDraft';
import { resumeFromPending } from './coachClarifierResume';
import {
  classifyPendingClarificationAnswer,
  type PendingClarificationAnswerClassification,
  type PendingClarificationProposedCandidate,
  type PendingCoachClarifier,
} from '../store/pendingCoachClarifierStore';
import {
  executeCoachCommand,
  type ExecuteCoachCommandInput,
  type ExecutionResult,
  type ProgressStage,
} from './coachCommandExecutor';
import {
  applyAdjustmentEvents,
  type ApplyEventsResult,
} from './applyAdjustmentEvents';
import type { AdjustmentEvent } from './programAdjustmentEngine';
import {
  inferModalityFromName,
  tokenToModality,
} from './coachModalitySwap';
import { parseCoachDurationMinutes } from './coachValueNormalizers';
import type { ConditioningModality } from '../data/exerciseTags';
import {
  extractVisibleProgramItemsFromWorkout,
  getResolvedVisibleProgramForDate,
  type ResolvedVisibleProgramForDate,
  type VisibleProgramItem,
} from './visibleProgramReadModel';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { buildCoachingPlan, onboardingToCoachingInputs } from './coachingEngine';
import { useProgramStore } from '../store/programStore';
import { logger } from './logger';
import { clearManualOverridesPreservingActiveModifiers } from './activeProgramModifiers';
import {
  athleteActionDiagnosticHash,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionType,
} from './athleteActionDiagnostics';

const COACH_PROGRAM_EDIT_DIAGNOSTIC_MARKER = 'coach-program-edit-diagnostics:stage3e1e-generic-block-resolver';

function programEditDiagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function emitProgramEditDiagnostic(event: string, payload: Record<string, unknown>) {
  if (!programEditDiagnosticsEnabled()) return;
  logger.warn('[coach-program-edit-diagnostic]', {
    marker: COACH_PROGRAM_EDIT_DIAGNOSTIC_MARKER,
    event,
    ...payload,
  });
}

type MutateCoachCommand = Extract<CoachCommand, { mode: 'mutate' }>;
type AddConditioningMutatePayload = Extract<CoachMutatePayload, { operation: 'add_conditioning' }>;

export type ProgramEditIntent =
  | 'add'
  | 'edit'
  | 'remove'
  | 'replace'
  | 'move'
  | 'ask_question'
  | 'explain';

export type ProgramEditTargetDomain =
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'session'
  | 'schedule';

export type ProgramEditRequestedChange =
  | 'duration'
  | 'modality'
  | 'intensity'
  | 'exercise'
  | 'day'
  | 'volume'
  | 'type'
  | 'unknown';

export type ProgramEditEditScope =
  | 'modality_only'
  | 'duration_only'
  | 'intensity_only'
  | 'replace_conditioning_prescription'
  | 'add_conditioning_item'
  | 'remove_conditioning_item'
  | 'remove_strength_block'
  | 'reduce_strength_block'
  | 'add_whole_session'
  | 'remove_whole_session'
  | 'update_program_setup';

export type ConditioningReplacementType =
  | 'sprint'
  | 'aerobic_base'
  | 'vo2'
  | 'glycolytic'
  | 'tempo'
  | 'recovery'
  | 'low_load'
  | 'unknown';

export interface ConditioningEditPrescription {
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  intensity?: string;
}

type ProgramEditSemanticAction =
  | 'add'
  | 'edit'
  | 'remove'
  | 'replace'
  | 'move'
  | 'reduce'
  | 'clarify'
  | 'unknown';

interface ProgramEditSemanticRoles {
  actionIntent: ProgramEditSemanticAction;
  primaryTargetText?: string;
  requestedChange: ProgramEditRequestedChange | 'removal' | 'prescriptionType';
  newValueText?: string;
  protectedTargetTexts: string[];
  negativeTargetTexts: string[];
  constraints: string[];
  qualitativeDuration: boolean;
}

interface ProgramEditBase {
  targetDate: string | null;
  targetSessionId: string | null;
  targetItemId: string | null;
  targetDomain: ProgramEditTargetDomain;
  requestedChange: ProgramEditRequestedChange;
  newValue: unknown;
  missingFields: string[];
  confidence: number;
  naturalLanguageReason: string;

  /** Internal bridge while the old command executor remains the writer. */
  command: CoachCommand | null;
  question?: string;
  options?: string[];
  candidateItems?: ProgramEditCandidateItem[];
  targetItemTitle?: string | null;
  normalizedMessage?: string;
  source?: 'pending_clarifier' | 'router' | 'llm_adapter' | 'provided_command' | 'semantic_draft';
  semanticRoles?: ProgramEditSemanticRoles;
  actionScope?: SemanticProgramEditDraftActionScope;
  sourceTarget?: SemanticProgramEditDraft['sourceTarget'];
  explicitDateRole?: SemanticProgramEditDraft['explicitDateRole'];
  explicitUserWording?: string;
  protectedTargets?: Array<ProgramEditCandidateItem | SemanticProgramEditDraftProtectedTarget>;
  constraints?: string[];
  proposedActions?: SemanticProgramEditDraft['proposedActions'];
  verifierExpectations?: SemanticProgramEditDraft['verifierExpectations'];
  isCompound?: boolean;
  reason?: string;
  negativeTargets?: ProgramEditCandidateItem[];
}

export interface ConditioningModalityEdit extends ProgramEditBase {
  targetDomain: 'conditioning';
  intent: 'edit';
  editScope: 'modality_only';
  targetDate: string;
  targetItemId: string;
  requestedChange: 'modality';
  newModality: ConditioningModality;
  preservePrescription: true;
}

export interface ConditioningDurationEdit extends ProgramEditBase {
  targetDomain: 'conditioning';
  intent: 'edit';
  editScope: 'duration_only';
  targetDate: string;
  targetItemId: string;
  requestedChange: 'duration';
  newDuration: ConditioningEditPrescription;
  newDurationMinutes: number | null;
  preserveModalityAndType: true;
}

export interface ConditioningIntensityEdit extends ProgramEditBase {
  targetDomain: 'conditioning';
  intent: 'edit';
  editScope: 'intensity_only';
  targetDate: string;
  targetItemId: string;
  requestedChange: 'intensity';
  newIntensity: string;
  preserveModalityAndType: true;
}

export interface ConditioningPrescriptionReplacement extends ProgramEditBase {
  targetDomain: 'conditioning';
  intent: 'replace';
  editScope: 'replace_conditioning_prescription';
  targetDate: string;
  targetItemId: string;
  requestedChange: 'type';
  replacementType: ConditioningReplacementType;
  replacementModality: ConditioningModality | null;
  replacementPrescription: ConditioningEditPrescription;
  discardStaleFields: true;
}

export interface ConditioningAppend extends ProgramEditBase {
  targetDomain: 'conditioning';
  intent: 'add';
  editScope: 'add_conditioning_item';
  targetDate: string;
  targetItemId: null;
  requestedChange: ProgramEditRequestedChange;
  appendWasExplicit: true;
}

export interface ConditioningRemove extends ProgramEditBase {
  targetDomain: 'conditioning';
  intent: 'remove';
  editScope: 'remove_conditioning_item';
  targetDate: string;
  targetItemId: string | null;
  requestedChange: 'type' | 'unknown';
}

export interface StrengthBlockEdit extends ProgramEditBase {
  targetDomain: 'strength';
  intent: 'remove' | 'edit';
  editScope: 'remove_strength_block' | 'reduce_strength_block';
  targetDate: string;
  targetSessionId: string | null;
  targetItemId: null;
  requestedChange: 'volume';
  protectedTargets?: Array<ProgramEditCandidateItem | SemanticProgramEditDraftProtectedTarget>;
}

export interface RemoveSessionEdit extends ProgramEditBase {
  targetDomain: 'session';
  intent: 'remove';
  editScope: 'remove_whole_session';
  targetDate: string;
  targetSessionId: string | null;
  targetItemId: null;
  requestedChange: 'day';
  protectedTargets?: Array<ProgramEditCandidateItem | SemanticProgramEditDraftProtectedTarget>;
  reason?: string;
}

export interface AddSessionEdit extends ProgramEditBase {
  targetDomain: 'session';
  intent: 'add';
  editScope: 'add_whole_session';
  targetDate: string;
  targetSessionId: string | null;
  targetItemId: null;
  requestedChange: 'day';
  sourceDate?: string;
  sourceSessionName: string;
}

export interface ProgramSetupChange {
  addTrainingDays?: DayOfWeek[];
  removeTrainingDays?: DayOfWeek[];
  replaceTrainingDays?: DayOfWeek[];
  trainingDaysPerWeek?: number;
  clearUnavailableDays?: DayOfWeek[];
  availabilityConstraints?: ProgramAvailabilityConstraint[];
  summary: string;
}

export interface ProgramSetupEdit extends ProgramEditBase {
  targetDomain: 'schedule';
  intent: 'edit';
  editScope: 'update_program_setup';
  targetDate: null;
  targetSessionId: null;
  targetItemId: null;
  requestedChange: 'day' | 'duration' | 'unknown';
  setupChange: ProgramSetupChange;
  rebuildRequired: true;
}

export type ConditioningProgramEdit =
  | ConditioningModalityEdit
  | ConditioningDurationEdit
  | ConditioningIntensityEdit
  | ConditioningPrescriptionReplacement
  | ConditioningAppend
  | ConditioningRemove;

export interface AskClarificationProgramEdit extends ProgramEditBase {
  intent: 'ask_question';
  editScope?: ProgramEditEditScope;
  missingFields: [string, ...string[]];
  pendingEdit?: ProgramEditDraft;
  candidateItems?: ProgramEditCandidateItem[];
}

export interface ExplainProgramEdit extends ProgramEditBase {
  intent: 'explain';
}

export interface NonConditioningProgramEdit extends ProgramEditBase {
  targetDomain: Exclude<ProgramEditTargetDomain, 'conditioning'>;
  intent: Exclude<ProgramEditIntent, 'ask_question' | 'explain'>;
  editScope?: never;
}

export type ProgramEdit =
  | ConditioningProgramEdit
  | StrengthBlockEdit
  | AddSessionEdit
  | RemoveSessionEdit
  | ProgramSetupEdit
  | AskClarificationProgramEdit
  | ExplainProgramEdit
  | NonConditioningProgramEdit;

type ProgramEditDraft = ProgramEditBase & {
  intent: ProgramEditIntent;
  editScope?: ProgramEditEditScope;
};

type IsAssignable<From, To> = From extends To ? true : false;
type ExpectTrue<T extends true> = T;
type ExpectFalse<T extends false> = T;

type _ProgramEditAllowsScopedConditioningModalityEdit = ExpectTrue<IsAssignable<{
  intent: 'edit';
  targetDomain: 'conditioning';
  editScope: 'modality_only';
  targetDate: '2026-06-03';
  targetSessionId: null;
  targetItemId: 'rower-card';
  requestedChange: 'modality';
  newValue: { modality: 'bike' };
  missingFields: [];
  confidence: 1;
  naturalLanguageReason: 'type contract';
  command: null;
  newModality: 'bike';
  preservePrescription: true;
}, ProgramEdit>>;

type _ProgramEditRejectsConditioningEditWithoutScope = ExpectFalse<IsAssignable<{
  intent: 'edit';
  targetDomain: 'conditioning';
  targetDate: '2026-06-03';
  targetSessionId: null;
  targetItemId: 'rower-card';
  requestedChange: 'modality';
  newValue: { modality: 'bike' };
  missingFields: [];
  confidence: 1;
  naturalLanguageReason: 'type contract';
  command: null;
}, ProgramEdit>>;

type _ProgramEditRejectsAppendWithTargetItem = ExpectFalse<IsAssignable<{
  intent: 'add';
  targetDomain: 'conditioning';
  editScope: 'add_conditioning_item';
  targetDate: '2026-06-03';
  targetSessionId: null;
  targetItemId: 'existing-card';
  requestedChange: 'type';
  newValue: { activity: 'Bike Sprints' };
  missingFields: [];
  confidence: 1;
  naturalLanguageReason: 'type contract';
  command: null;
  appendWasExplicit: true;
}, ProgramEdit>>;

export type ProgramEditCandidateItem = Pick<
  VisibleProgramItem,
  'id' | 'title' | 'domain' | 'modality' | 'durationMinutes' | 'source'
>;

export type ResolveVisibleProgramForDate = (
  date: string,
) => ResolvedVisibleProgramForDate | null;

export interface InterpretCoachMessageToProgramEditInput {
  userMessage: string;
  todayISO: string;
  referenceResolution: CoachReferenceResolution | null;
  targetFrame?: CoachTargetFrame | null;
  currentWeek?: VisibleSessionRef[];
  lastChange?: RouteCoachCommandInput['lastChange'];
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  pendingClarifier?: PendingCoachClarifier | null;
  candidateCommand?: CoachCommand;
  resolveVisibleProgramForDate?: ResolveVisibleProgramForDate;
  source?: ProgramEdit['source'];
}

export interface ExecuteProgramEditInput
  extends Omit<ExecuteCoachCommandInput, 'command'> {
  programEdit: ProgramEdit;
}

export type PendingProgramEditAnswerResult =
  | { kind: 'complete'; programEdit: ProgramEdit }
  | { kind: 'clarify'; programEdit: ProgramEdit; reply: string; options?: string[] }
  | { kind: 'cancelled'; reply: string }
  | { kind: 'unresolved' };

const PROGRAM_EDIT_LEXICON = [
  'add',
  'edit',
  'change',
  'make',
  'swap',
  'replace',
  'remove',
  'move',
  'longer',
  'shorter',
  'harder',
  'easier',
  'lighter',
  'duration',
  'hour',
  'hours',
  'minute',
  'minutes',
  'mins',
  'bike',
  'assault',
  'air',
  'rower',
  'rowing',
  'running',
  'run',
  'ski',
  'skierg',
  'pilates',
  'conditioning',
  'session',
  'today',
  'tomorrow',
  'setup',
  'availability',
  'available',
  'rebuild',
  'train',
  'training',
  'days',
  'week',
];

export function interpretCoachMessageToProgramEdit(
  input: InterpretCoachMessageToProgramEditInput,
): ProgramEdit {
  const normalizedMessage = normalizeCoachEditMessage(input.userMessage);
  const semanticRoles = extractProgramEditSemanticRoles(normalizedMessage);
  const setupEdit = programSetupEditFromMessage({
    message: normalizedMessage,
    todayISO: input.todayISO,
  });
  if (setupEdit) {
    return attachSemanticRolesToProgramEdit(setupEdit, semanticRoles, input);
  }

  const ambiguousTargetEdit = programEditFromAmbiguousTargetFrame(input.targetFrame);
  if (ambiguousTargetEdit) {
    return ambiguousTargetEdit;
  }

  if (input.candidateCommand) {
    return attachSemanticRolesToProgramEdit(programEditFromCoachCommand(input.candidateCommand, {
      ...input,
      userMessage: normalizedMessage,
      normalizedMessage,
      source: input.source ?? 'provided_command',
    }), semanticRoles, input);
  }

  if (input.pendingClarifier) {
    const resumed = resumeFromPending({
      pending: input.pendingClarifier,
      newMessage: normalizedMessage,
      newResolution: input.referenceResolution,
    });
    if (resumed) {
      return attachSemanticRolesToProgramEdit(programEditFromCoachCommand(resumed, {
        ...input,
        userMessage: normalizedMessage,
        normalizedMessage,
        source: 'pending_clarifier',
      }), semanticRoles, input);
    }
  }

  const command = routeCoachCommand({
    userMessage: normalizedMessage,
    todayISO: input.todayISO,
    referenceResolution: input.referenceResolution,
    currentWeek: input.currentWeek,
    lastChange: input.lastChange,
    recentMessages: input.recentMessages,
  });
  const semanticOverride = semanticRoleOverrideCommand({
    command,
    input,
    normalizedMessage,
    semanticRoles,
  });
  if (semanticOverride) {
    return attachSemanticRolesToProgramEdit(programEditFromCoachCommand(semanticOverride, {
      ...input,
      userMessage: normalizedMessage,
      normalizedMessage,
      source: 'router',
    }), semanticRoles, input);
  }
  const categoryFallback = mutationCategoryFallbackCommand({
    command,
    input,
    normalizedMessage,
  });
  if (categoryFallback) {
    return attachSemanticRolesToProgramEdit(programEditFromCoachCommand(categoryFallback, {
      ...input,
      userMessage: normalizedMessage,
      normalizedMessage,
      source: 'router',
    }), semanticRoles, input);
  }
  const durationFallback = durationOnlyFallbackCommand({
    command,
    input,
    normalizedMessage,
  });
  if (durationFallback) {
    return attachSemanticRolesToProgramEdit(programEditFromCoachCommand(durationFallback, {
      ...input,
      userMessage: normalizedMessage,
      normalizedMessage,
      source: 'router',
    }), semanticRoles, input);
  }
  return attachSemanticRolesToProgramEdit(programEditFromCoachCommand(command, {
    ...input,
    userMessage: normalizedMessage,
    normalizedMessage,
    source: 'router',
  }), semanticRoles, input);
}

function semanticRoleOverrideCommand(args: {
  command: CoachCommand;
  input: InterpretCoachMessageToProgramEditInput;
  normalizedMessage: string;
  semanticRoles: ProgramEditSemanticRoles;
}): CoachCommand | null {
  const { command, input, normalizedMessage, semanticRoles } = args;
  if (command.mode === 'mutate' && command.operation === 'remove_session') {
    return null;
  }
  const targetDate =
    input.referenceResolution?.target?.date ??
    (input.currentWeek?.length === 1 ? input.currentWeek[0]?.date : null);
  if (!targetDate) return null;

  const visibleProgram = resolveVisibleProgramForDateFromInputs({
    targetDate,
    currentWeek: input.currentWeek,
    resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
  });
  const conditioningItems = candidateItemsForDomain({
    items: visibleProgram.items,
    targetDomain: 'conditioning',
  });
  const target: CoachCommandTarget = {
    kind: 'date',
    date: targetDate,
    sessionName: visibleProgram.day.workout?.name ?? input.referenceResolution?.target?.sessionName,
  };

  const primaryMatch = findSingleSemanticRoleTarget(
    semanticRoles.primaryTargetText ? [semanticRoles.primaryTargetText] : [],
    conditioningItems,
  );
  const negativeMatch = findSingleSemanticRoleTarget(
    semanticRoles.negativeTargetTexts,
    conditioningItems,
  );

  const hasExplicitReduceLever =
    /\b(?:easier|lighter|shorter|reduce|deload|back\s+it\s+off|back\s+off|lower[-\s]*load|less)\b/i.test(normalizedMessage);
  if (
    command.mode === 'clarify' &&
    command.reason === 'mutation_like_no_payload' &&
    semanticRoles.actionIntent === 'reduce' &&
    !hasExplicitReduceLever
  ) {
    return null;
  }

  if (semanticRoles.actionIntent === 'remove' && semanticRoles.negativeTargetTexts.length > 0) {
    return {
      mode: 'mutate',
      operation: 'remove_conditioning',
      target,
      payload: {
        operation: 'remove_conditioning',
        modality: modalityFromRoleTexts(semanticRoles.negativeTargetTexts) as any,
        targetItemId: negativeMatch?.id,
      },
      scope: 'one_off',
      confidence: negativeMatch ? 0.9 : 0.75,
      needsClarification: false,
      reason: 'program_edit_semantic_remove_negative_target',
    };
  }

  if (
    semanticRoles.qualitativeDuration &&
    parseCoachDurationMinutes(normalizedMessage) == null &&
    (semanticRoles.requestedChange === 'duration' || semanticRoles.newValueText == null)
  ) {
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target,
      payload: {
        operation: 'add_conditioning',
        modality: primaryMatch?.modality as any ?? null,
        customActivity: primaryMatch?.title,
        replaceActivity: primaryMatch?.title,
        editMode: 'update_existing',
        editScope: 'edit_duration_only',
        targetItemId: primaryMatch?.id,
      },
      scope: 'one_off',
      confidence: primaryMatch ? 0.85 : 0.7,
      needsClarification: false,
      reason: 'program_edit_semantic_qualitative_duration_missing_amount',
    };
  }

  if (
    semanticRoles.actionIntent === 'reduce' &&
    semanticRoles.primaryTargetText &&
    primaryMatch
  ) {
    return {
      mode: 'mutate',
      operation: 'add_conditioning',
      target,
      payload: {
        operation: 'add_conditioning',
        modality: primaryMatch.modality as any,
        customActivity: primaryMatch.title,
        replaceActivity: primaryMatch.title,
        editMode: 'update_existing',
        editScope: 'edit_intensity_only',
        targetItemId: primaryMatch.id,
      },
      scope: 'one_off',
      confidence: 0.85,
      needsClarification: false,
      reason: 'program_edit_semantic_reduce_target_missing_lever',
    };
  }

  return null;
}

function attachSemanticRolesToProgramEdit(
  edit: ProgramEdit,
  semanticRoles: ProgramEditSemanticRoles,
  input: InterpretCoachMessageToProgramEditInput,
): ProgramEdit {
  const hasRoles =
    semanticRoles.actionIntent !== 'unknown' ||
    !!semanticRoles.primaryTargetText ||
    semanticRoles.protectedTargetTexts.length > 0 ||
    semanticRoles.negativeTargetTexts.length > 0 ||
    semanticRoles.constraints.length > 0 ||
    semanticRoles.qualitativeDuration;
  if (!hasRoles) return edit;

  const targetDate = edit.targetDate ?? input.referenceResolution?.target?.date ?? null;
  const visibleProgram = targetDate
    ? resolveVisibleProgramForDateFromInputs({
        targetDate,
        currentWeek: input.currentWeek,
        resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
      })
    : null;
  const conditioningItems = visibleProgram
    ? candidateItemsForDomain({
        items: visibleProgram.items,
        targetDomain: 'conditioning',
      })
    : [];
  const protectedTargets = findSemanticRoleTargets(
    semanticRoles.protectedTargetTexts,
    conditioningItems,
  );
  const negativeTargets = findSemanticRoleTargets(
    semanticRoles.negativeTargetTexts,
    conditioningItems,
  );

  return {
    ...edit,
    semanticRoles,
    protectedTargets,
    negativeTargets,
    pendingEdit: edit.intent === 'ask_question' && edit.pendingEdit
      ? {
          ...edit.pendingEdit,
          semanticRoles,
          protectedTargets,
          negativeTargets,
        }
      : edit.intent === 'ask_question'
      ? edit.pendingEdit
      : undefined,
  } as ProgramEdit;
}

function extractProgramEditSemanticRoles(message: string): ProgramEditSemanticRoles {
  const text = String(message ?? '').toLowerCase();
  const protectedTargetTexts = [
    ...extractRoleClauseTargets(text, /\b(?:keep|leave|preserve)\b/gi),
    ...extractRoleClauseTargets(text, /\b(?:don'?t|do\s+not)\s+(?:touch|change|remove|drop|ditch|mess\s+with)\b/gi),
  ];
  const negativeTargetTexts = extractRoleClauseTargets(
    text,
    /\b(?:remove|drop|ditch|scrap|skip|cancel|cut|delete|take\s+out|get\s+rid\s+of|don'?t\s+do|do\s+not\s+do)\b/gi,
  );
  const primaryTargetText = extractPrimaryTargetText(text, protectedTargetTexts, negativeTargetTexts);
  const qualitativeDuration =
    /\b(?:longer|shorter|more|less|a\s+bit\s+longer|bit\s+longer|little\s+longer|extra\s+time)\b/i.test(text) &&
    parseCoachDurationMinutes(text) == null;
  const reduceIntent = hasReduceOrFatigueIntent(text);
  const actionIntent: ProgramEditSemanticAction =
    hasRemovalIntent(text)
      ? 'remove'
      : reduceIntent
      ? 'reduce'
      : /\b(?:replace|swap|instead|make|change)\b/i.test(text)
      ? 'edit'
      : /\b(?:add|also|after|extra|chuck|include)\b/i.test(text)
      ? 'add'
      : 'unknown';
  const requestedChange: ProgramEditSemanticRoles['requestedChange'] =
    qualitativeDuration
      ? 'duration'
      : reduceIntent
      ? 'intensity'
      : hasRemovalIntent(text)
      ? 'removal'
      : /\b(?:sprints?|hiit|intervals?|tempo|flush|aerobic)\b/i.test(removeProtectedClauses(text))
      ? 'prescriptionType'
      : 'unknown';

  return {
    actionIntent,
    primaryTargetText,
    requestedChange,
    protectedTargetTexts,
    negativeTargetTexts,
    constraints: [
      ...protectedTargetTexts.map((target) => `keep ${target}`),
      ...(primaryTargetText ? [`only change ${primaryTargetText}`] : []),
    ],
    qualitativeDuration,
  };
}

function extractRoleClauseTargets(text: string, trigger: RegExp): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(trigger)) {
    const rest = text.slice(match.index! + match[0].length);
    const clause = rest.split(/\b(?:but|and|while|also|then|instead|rather)\b|[,.!?;]/i)[0] ?? '';
    const cleaned = cleanSemanticTargetText(clause);
    if (cleaned) out.push(cleaned);
  }
  return uniqueStrings(out);
}

function extractPrimaryTargetText(
  text: string,
  protectedTargetTexts: string[],
  negativeTargetTexts: string[],
): string | undefined {
  const editable = removeProtectedClauses(text);
  const patterns = [
    /\b(?:make|change|adjust|set)\s+(?:the\s+)?([a-z0-9\s-]+?)\s+(?:easier|lighter|harder|longer|shorter|to|into|a\s+bit|bit|please|pls|$)/i,
    /\b(?:just\s+)?(?:make|change|adjust|set)\s+(?:the\s+)?([a-z0-9\s-]+?)\s+(?:but|and|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(editable);
    const cleaned = cleanSemanticTargetText(match?.[1] ?? '');
    if (
      cleaned &&
      !protectedTargetTexts.some((target) => normaliseItemTitle(target) === normaliseItemTitle(cleaned)) &&
      !negativeTargetTexts.some((target) => normaliseItemTitle(target) === normaliseItemTitle(cleaned)) &&
      !/\b(?:it|that|this|session|conditioning|wednesday|today|tomorrow)\b/i.test(cleaned)
    ) {
      return cleaned;
    }
  }
  return undefined;
}

function removeProtectedClauses(text: string): string {
  return String(text ?? '').replace(
    /\b(?:but\s+)?(?:keep|leave|preserve|don'?t\s+(?:touch|change|remove|drop|ditch|mess\s+with)|do\s+not\s+(?:touch|change|remove|drop|ditch|mess\s+with))\b[^,.!?;]*/gi,
    ' ',
  );
}

function cleanSemanticTargetText(value: string): string {
  return String(value ?? '')
    .replace(/\b(?:the|that|this|one|item|block|session|please|pls|mate|obviously|only|just)\b/gi, ' ')
    .replace(/\b(?:on|for|to|into|a|an)\b\s*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSemanticRoleTargets(
  targetTexts: string[],
  items: ProgramEditCandidateItem[],
): ProgramEditCandidateItem[] {
  const seen = new Set<string>();
  const out: ProgramEditCandidateItem[] = [];
  for (const targetText of targetTexts) {
    const matches = findSemanticRoleTargetMatches(targetText, items);
    for (const item of matches) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

function findSingleSemanticRoleTarget(
  targetTexts: string[],
  items: ProgramEditCandidateItem[],
): ProgramEditCandidateItem | null {
  const matches = findSemanticRoleTargets(targetTexts, items);
  return matches.length === 1 ? matches[0] : null;
}

function findSemanticRoleTargetMatches(
  targetText: string,
  items: ProgramEditCandidateItem[],
): ProgramEditCandidateItem[] {
  const cleaned = cleanSemanticTargetText(targetText);
  if (!cleaned) return [];
  const modality = modalityFromAnswer(cleaned);
  const titleMatches = items.filter((item) =>
    itemTitleMatchesAnswer(item.title, cleaned),
  );
  if (titleMatches.length > 0) return titleMatches;
  if (/\bsprints?\b/i.test(cleaned)) {
    const sprintMatches = items.filter((item) =>
      itemTitleMatchesModality(item.title, 'sprint' as any),
    );
    if (sprintMatches.length > 0) return sprintMatches;
  }
  if (modality) {
    return items.filter((item) =>
      item.modality === modality || itemTitleMatchesModality(item.title, modality),
    );
  }
  return [];
}

function modalityFromRoleTexts(targetTexts: string[]): ConditioningIntentModality | null {
  for (const targetText of targetTexts) {
    if (/\bsprints?\b/i.test(targetText)) return 'sprint' as any;
    const modality = modalityFromAnswer(targetText);
    if (modality) return modality as any;
  }
  return null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mutationCategoryFallbackCommand(args: {
  command: CoachCommand;
  input: InterpretCoachMessageToProgramEditInput;
  normalizedMessage: string;
}): CoachCommand | null {
  const { command, input, normalizedMessage } = args;
  if (command.mode !== 'conversation' && command.mode !== 'explain' && command.mode !== 'inspect_state') {
    return null;
  }
  if ('reason' in command && command.reason === 'hypothetical_program_question') {
    return null;
  }

  if (hasRemovalIntent(normalizedMessage) && looksLikeWholeSessionRemovalTarget(normalizedMessage)) {
    return {
      mode: 'mutate',
      operation: 'remove_session',
      target: targetFromReferenceResolution(input.referenceResolution),
      payload: {
        operation: 'remove_session',
        targetSessionId: input.referenceResolution?.target?.sessionName ?? null,
        reason: hasReduceOrFatigueIntent(normalizedMessage) ? 'fatigue/readiness context' : undefined,
      },
      scope: 'one_off',
      confidence: input.referenceResolution?.target ? 0.82 : 0.45,
      needsClarification: !input.referenceResolution?.target,
      clarificationQuestion: input.referenceResolution?.target
        ? undefined
        : 'Which session should I remove?',
      missingFields: input.referenceResolution?.target ? undefined : ['target_session'],
      reason: 'program_edit_category_remove_session_intent',
    };
  }

  if (hasRemovalIntent(normalizedMessage) && looksLikeConditioningEditTarget(normalizedMessage)) {
    return {
      mode: 'mutate',
      operation: 'remove_conditioning',
      target: targetFromReferenceResolution(input.referenceResolution),
      payload: {
        operation: 'remove_conditioning',
        modality: modalityFromAnswer(normalizedMessage) as any,
      },
      scope: 'one_off',
      confidence: input.referenceResolution?.target ? 0.75 : 0.45,
      needsClarification: !input.referenceResolution?.target,
      clarificationQuestion: input.referenceResolution?.target
        ? undefined
        : 'Which day should I remove conditioning from?',
      reason: 'program_edit_category_remove_intent',
    };
  }

  if (hasReduceOrFatigueIntent(normalizedMessage)) {
    return {
      mode: 'clarify',
      question: 'Do you want me to make the strength work easier, the conditioning easier, or the whole session?',
      options: ['Strength work', 'Conditioning', 'Whole session'],
      missingFields: ['load_lever'],
      reason: 'program_edit_category_reduce_or_fatigue_intent',
    };
  }

  return null;
}

function durationOnlyFallbackCommand(args: {
  command: CoachCommand;
  input: InterpretCoachMessageToProgramEditInput;
  normalizedMessage: string;
}): CoachCommand | null {
  const { command, input, normalizedMessage } = args;
  if (command.mode !== 'clarify') return null;
  const durationMinutes = parseCoachDurationMinutes(normalizedMessage);
  if (durationMinutes == null) return null;

  const targetDate =
    input.referenceResolution?.target?.date ??
    (input.currentWeek?.length === 1 ? input.currentWeek[0]?.date : null);
  if (!targetDate) return null;

  const visibleProgram = resolveVisibleProgramForDateFromInputs({
    targetDate,
    currentWeek: input.currentWeek,
    resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
  });
  const candidates = candidateItemsForDomain({
    items: visibleProgram.items,
    targetDomain: 'conditioning',
  });
  if (candidates.length !== 1) return null;

  const item = candidates[0];
  return {
    mode: 'mutate',
    operation: 'add_conditioning',
    target: {
      kind: 'date',
      date: targetDate,
      sessionName: visibleProgram.day.workout?.name ?? input.referenceResolution?.target?.sessionName,
    },
    payload: {
      operation: 'add_conditioning',
      modality: item.modality as any,
      customActivity: item.title,
      durationMinutes,
      replaceActivity: item.title,
      editMode: 'update_existing',
      editScope: 'edit_duration_only',
      targetItemId: item.id,
    },
    scope: 'one_off',
    confidence: 0.85,
    needsClarification: false,
    reason: `${command.reason}:program_edit_duration_scalar_single_visible_item`,
  };
}

function targetFromReferenceResolution(
  ref: CoachReferenceResolution | null,
): CoachCommandTarget {
  if (ref?.target?.date) {
    return {
      kind: 'date',
      date: ref.target.date,
      sessionName: ref.target.sessionName,
    };
  }
  return { kind: 'unbound' };
}

const DAY_ALIASES: Array<{ day: DayOfWeek; re: RegExp }> = [
  { day: 'Monday', re: /\bmons?days?|\bmons?\b/i },
  { day: 'Tuesday', re: /\btuesdays?|\btues?\b/i },
  { day: 'Wednesday', re: /\bwednesdays?|\bweds?\b/i },
  { day: 'Thursday', re: /\bthursdays?|\bthurs?\b|\bthur\b/i },
  { day: 'Friday', re: /\bfridays?|\bfri\b/i },
  { day: 'Saturday', re: /\bsaturdays?|\bsat\b/i },
  { day: 'Sunday', re: /\bsundays?|\bsun\b/i },
];

const ALL_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function programSetupEditFromMessage(args: {
  message: string;
  todayISO: string;
}): ProgramEdit | null {
  const { message, todayISO } = args;
  const text = message.toLowerCase();
  const mentionedDays = extractDayNames(message);
  const frequency = extractTrainingFrequency(message);
  const durationMinutes = parseCoachDurationMinutes(message);

  if (/\baway\s+next\s+week\b|\btravell?ing\s+next\s+week\b/i.test(message)) {
    return buildProgramSetupClarifier({
      message,
      question: 'What dates are you away?',
      missingFields: ['startDate', 'endDate'],
      reason: 'program_setup_travel_dates_missing',
      options: undefined,
    });
  }

  const explicitSetupLanguage =
    /\bprogram\s+setup\b|\bavailability\b|\bavailable\b|\bcan\s+(?:now\s+)?train\b|\bcan'?t\s+train\b|\bcannot\s+train\b|\bcan\s+only\s+train\b|\bonly\s+(?:can\s+)?train\b|\btraining\s+days?\b|\bdays?\s+(?:a|per)\s+week\b|\b(?:only\s+have|only\s+got|have\s+only|short\s+on\s+time|limited\s+time)\b|\b(?:working\s+late|work\s+late|late\s+shift|night\s+shift)\b/i.test(message);
  const asksRebuildWithSetup =
    /\brebuild\b/i.test(message) &&
    (mentionedDays.length > 0 || frequency != null || /\bsetup|availability|available|train\b/i.test(message));
  if (!explicitSetupLanguage && !asksRebuildWithSetup) {
    return null;
  }

  if (/\bcan\s+(?:now\s+)?train\b[^.?!]*\bagain\b|\bavailable\b[^.?!]*\bagain\b/i.test(message) && mentionedDays.length > 0) {
    return buildProgramSetupEdit({
      message,
      requestedChange: 'day',
      setupChange: {
        addTrainingDays: mentionedDays,
        clearUnavailableDays: mentionedDays,
        trainingDaysPerWeek: frequency,
        summary: `restore ${formatDayList(mentionedDays)}`,
      },
    });
  }

  if (/\b(?:working\s+late|work\s+late|late\s+shift|night\s+shift)\b/i.test(message) && mentionedDays.length > 0) {
    return buildProgramSetupClarifier({
      message,
      question: `Should I make ${formatDayList(mentionedDays)} unavailable while you're working late, or just cap it as a short session?`,
      missingFields: ['constraintType'],
      reason: 'program_setup_work_late_constraint_type_missing',
      options: ['Make unavailable', 'Cap as short session'],
    });
  }

  if (/\b(?:can'?t|cannot|can\s+not|won'?t|not\s+available|unavailable)\s+(?:train|do|make)?\b/i.test(message) && mentionedDays.length > 0) {
    const temporary = extractTemporaryWindow(message, todayISO);
    if (!temporary && !/\b(?:permanent|from\s+now\s+on|going\s+forward|indefinitely)\b/i.test(message)) {
      return buildProgramSetupClarifier({
        message,
        question: `Is ${formatDayList(mentionedDays)} unavailable permanently, or just for a few weeks?`,
        missingFields: ['constraintDuration'],
        reason: 'program_setup_unavailable_duration_missing',
        options: ['Permanent', 'Just a few weeks'],
      });
    }
    const constraints = mentionedDays.map((day) => ({
      id: buildAvailabilityConstraintId('unavailable_day', day, todayISO),
      kind: 'unavailable_day' as const,
      scope: temporary ? 'temporary' as const : 'permanent' as const,
      dayOfWeek: day,
      startDate: temporary?.startDate,
      endDate: temporary?.endDate,
      reason: extractAvailabilityReason(message),
      active: true,
      createdAt: `${todayISO}T00:00:00.000Z`,
      updatedAt: `${todayISO}T00:00:00.000Z`,
    }));
    return buildProgramSetupEdit({
      message,
      requestedChange: 'day',
      setupChange: {
        availabilityConstraints: constraints,
        summary: `${temporary ? 'temporarily block' : 'block'} ${formatDayList(mentionedDays)}`,
      },
    });
  }

  if (/\b(?:only\s+(?:can\s+)?train|can\s+only\s+train)\b/i.test(message) && mentionedDays.length > 0) {
    return buildProgramSetupEdit({
      message,
      requestedChange: 'day',
      setupChange: {
        replaceTrainingDays: mentionedDays,
        trainingDaysPerWeek: frequency ?? mentionedDays.length,
        summary: `use only ${formatDayList(mentionedDays)}`,
      },
    });
  }

  if (
    durationMinutes != null &&
    mentionedDays.length > 0 &&
    /\b(?:only\s+have|only\s+got|have\s+only|short\s+on\s+time|limited\s+time|minutes?\s+on)\b/i.test(message)
  ) {
    const constraints = mentionedDays.map((day) => ({
      id: buildAvailabilityConstraintId('time_limit', day, todayISO),
      kind: 'time_limit' as const,
      scope: /\b(?:for\s+the\s+next|next\s+\d|this\s+week|next\s+week)\b/i.test(message)
        ? 'temporary' as const
        : 'permanent' as const,
      dayOfWeek: day,
      maxSessionMinutes: durationMinutes,
      reason: extractAvailabilityReason(message),
      active: true,
      createdAt: `${todayISO}T00:00:00.000Z`,
      updatedAt: `${todayISO}T00:00:00.000Z`,
    }));
    return buildProgramSetupEdit({
      message,
      requestedChange: 'duration',
      setupChange: {
        availabilityConstraints: constraints,
        summary: `${formatDayList(mentionedDays)} time cap ${durationMinutes} minutes`,
      },
    });
  }

  if (/\bcan\s+(?:now\s+)?train\b|\bavailable\b/i.test(message) && mentionedDays.length > 0) {
    return buildProgramSetupEdit({
      message,
      requestedChange: 'day',
      setupChange: {
        addTrainingDays: mentionedDays,
        trainingDaysPerWeek: frequency,
        summary: `add ${formatDayList(mentionedDays)}`,
      },
    });
  }

  if (frequency != null && /\b(?:train|training|want|days?\s+(?:a|per)\s+week)\b/i.test(message)) {
    return buildProgramSetupEdit({
      message,
      requestedChange: 'day',
      setupChange: {
        trainingDaysPerWeek: frequency,
        summary: `set ${frequency} training days per week`,
      },
    });
  }

  return null;
}

function buildProgramSetupEdit(args: {
  message: string;
  requestedChange: ProgramSetupEdit['requestedChange'];
  setupChange: ProgramSetupChange;
}): ProgramSetupEdit {
  return {
    intent: 'edit',
    targetDomain: 'schedule',
    editScope: 'update_program_setup',
    targetDate: null,
    targetSessionId: null,
    targetItemId: null,
    requestedChange: args.requestedChange,
    newValue: args.setupChange,
    missingFields: [],
    confidence: 0.9,
    naturalLanguageReason: 'program setup / availability update',
    command: {
      mode: 'mutate',
      operation: 'update_program_setup',
      target: { kind: 'unbound' },
      payload: {
        operation: 'update_program_setup',
        addTrainingDays: args.setupChange.addTrainingDays,
        removeTrainingDays: args.setupChange.removeTrainingDays,
        replaceTrainingDays: args.setupChange.replaceTrainingDays,
        trainingDaysPerWeek: args.setupChange.trainingDaysPerWeek,
        clearUnavailableDays: args.setupChange.clearUnavailableDays,
        availabilityConstraints: args.setupChange.availabilityConstraints,
        rebuildRequired: true,
      },
      scope: 'permanent',
      confidence: 0.9,
      needsClarification: false,
      reason: 'program_setup_availability_update',
    },
    normalizedMessage: args.message,
    source: 'router',
    setupChange: args.setupChange,
    rebuildRequired: true,
  };
}

function buildProgramSetupClarifier(args: {
  message: string;
  question: string;
  missingFields: [string, ...string[]] | string[];
  reason: string;
  options?: string[];
}): AskClarificationProgramEdit {
  const missingFields = args.missingFields.length > 0
    ? args.missingFields as [string, ...string[]]
    : ['setupDetail'];
  return {
    intent: 'ask_question',
    targetDomain: 'schedule',
    requestedChange: 'unknown',
    targetDate: null,
    targetSessionId: null,
    targetItemId: null,
    newValue: null,
    missingFields,
    confidence: 0.75,
    naturalLanguageReason: 'program setup clarification',
    command: {
      mode: 'clarify',
      question: args.question,
      options: args.options,
      missingFields,
      reason: args.reason,
    },
    question: args.question,
    options: args.options,
    normalizedMessage: args.message,
    source: 'router',
  } as AskClarificationProgramEdit;
}

function extractDayNames(message: string): DayOfWeek[] {
  const out: DayOfWeek[] = [];
  for (const entry of DAY_ALIASES) {
    if (entry.re.test(message) && !out.includes(entry.day)) {
      out.push(entry.day);
    }
  }
  if (/\bweekdays?\b/i.test(message)) {
    for (const day of ALL_DAYS.slice(0, 5)) {
      if (!out.includes(day)) out.push(day);
    }
  }
  if (/\bweekends?\b/i.test(message)) {
    for (const day of ['Saturday', 'Sunday'] as DayOfWeek[]) {
      if (!out.includes(day)) out.push(day);
    }
  }
  return out;
}

function extractTrainingFrequency(message: string): number | undefined {
  const numeric = /\b(?:train(?:ing)?\s*)?([1-7])\s+days?\s*(?:a|per)?\s*week\b/i.exec(message)
    ?? /\b(?:want|do|set(?:\s+me)?\s+to)\s+([1-7])\s+days?\b/i.exec(message);
  if (numeric) return Number(numeric[1]);

  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  };
  const wordMatch = /\b(one|two|three|four|five|six|seven)\s+days?\s*(?:a|per)?\s*week\b/i.exec(message);
  return wordMatch ? words[wordMatch[1].toLowerCase()] : undefined;
}

function extractTemporaryWindow(message: string, todayISO: string): { startDate: string; endDate: string } | null {
  const weeks = /\b(?:for\s+)?(?:the\s+)?next\s+([1-9])\s+weeks?\b/i.exec(message);
  if (weeks) {
    const count = Number(weeks[1]);
    const start = dateFromISO(todayISO);
    const end = new Date(start);
    end.setDate(end.getDate() + count * 7 - 1);
    return { startDate: todayISO, endDate: isoFromDate(end) };
  }
  if (/\bnext\s+week\b/i.test(message)) {
    const start = dateFromISO(todayISO);
    const day = start.getDay();
    const daysUntilNextMonday = ((1 - day + 7) % 7) || 7;
    start.setDate(start.getDate() + daysUntilNextMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { startDate: isoFromDate(start), endDate: isoFromDate(end) };
  }
  return null;
}

function extractAvailabilityReason(message: string): string | undefined {
  const match = /\b(?:because(?:\s+of)?|due\s+to)\s+([^.!?]+)$/i.exec(message)
    ?? /\bfor\s+([^.!?]+)$/i.exec(message);
  if (!match) return undefined;
  const reason = match[1]
    .replace(/\b(?:the\s+)?next\s+\d+\s+weeks?\b/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return reason || undefined;
}

function buildAvailabilityConstraintId(
  kind: ProgramAvailabilityConstraint['kind'],
  day: DayOfWeek,
  todayISO: string,
): string {
  return `${kind}-${day.toLowerCase()}-${todayISO}`;
}

function formatDayList(days: DayOfWeek[]): string {
  if (days.length <= 1) return days[0] ?? 'that day';
  if (days.length === 2) return `${days[0]} and ${days[1]}`;
  return `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

function dateFromISO(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function executeProgramEditWithinTrace(
  input: ExecuteProgramEditInput,
): ExecutionResult {
  const edit = input.programEdit;
  if (isStrengthBlockProgramEdit(edit)) {
    return executeStrengthBlockProgramEdit(input, edit);
  }

  if (
    edit.intent === 'ask_question' ||
    edit.missingFields.length > 0 ||
    !edit.command
  ) {
    return {
      kind: 'clarify',
      reply: edit.question ?? clarificationForMissingFields(edit),
      applied: false,
      route: `program_edit_clarify:${edit.missingFields.join(',') || 'unknown'}`,
      progress: ['composing_reply'],
      options: edit.options,
    };
  }

  if (isProgramSetupEdit(edit)) {
    return {
      kind: 'not_supported',
      reply: 'I understood that as a program setup change, but this path needs the rebuild executor.',
      applied: false,
      route: 'program_setup_requires_async_executor',
      progress: ['composing_reply'],
    };
  }

  if (
    (edit.intent === 'edit' || edit.intent === 'remove' || edit.intent === 'replace') &&
    !edit.targetItemId &&
    edit.targetDomain !== 'session' &&
    !isBlockLevelProgramEdit(edit)
  ) {
    return {
      kind: 'clarify',
      reply: edit.question ?? 'Which item do you want me to change?',
      applied: false,
      route: 'program_edit_clarify:targetItemId',
      progress: ['composing_reply'],
      options: edit.options,
    };
  }

  assertCompleteProgramEditForExecution(edit);

  const beforeVisibleWorkout = snapshotProgramEditVisibleWorkout(input, edit, 'before');
  const beforeOverrideSnapshot = edit.targetDate
    ? readProgramEditOverrideSnapshot(input, edit.targetDate)
    : null;
  const executableCommand = commandForProgramEditExecution(edit);
  const result = executeCoachCommand({
    ...input,
    referenceResolution:
      input.referenceResolution?.target
        ? input.referenceResolution
        : referenceResolutionFromProgramEdit(edit, input.referenceResolution),
    command: executableCommand,
  });
  const programEditVerification = verifyExecutedProgramEdit({
    input,
    edit,
    result,
    beforeVisibleWorkout,
    beforeOverrideSnapshot,
  });
  if (programEditVerification) return programEditVerification;
  logger.debug('[coach-program-edit-mutation-result]', {
    intent: edit.intent,
    targetDate: edit.targetDate,
    targetItemId: edit.targetItemId,
    targetItemTitle: edit.targetItemTitle,
    requestedChange: edit.requestedChange,
    newValue: edit.newValue,
    resultKind: result.kind,
    applied: result.applied,
    route: result.route,
    verifierResult: {
      projectionShowsTo: (result as any).projectionShowsTo ?? null,
      projectionShowsFrom: (result as any).projectionShowsFrom ?? null,
    },
  });
  return result;
}

function programEditDiagnosticActionType(edit: ProgramEdit): AthleteActionType {
  if (edit.intent === 'remove') {
    return edit.targetDomain === 'session' ? 'delete_session' : 'delete_component';
  }
  if (edit.intent === 'move') return 'move_session';
  if (edit.intent === 'add') return 'add_session';
  return 'coach_command';
}

/** Correlates the typed ProgramEdit with its deterministic executor result. */
export function executeProgramEdit(input: ExecuteProgramEditInput): ExecutionResult {
  const edit = input.programEdit;
  const trace = beginAthleteActionTrace({
    source: 'coach',
    actionType: programEditDiagnosticActionType(edit),
    route: 'coach_program_edit',
    currentWeekId: edit.targetDate ? getMondayForDate(edit.targetDate) : undefined,
    sourceDate: edit.targetDate ?? undefined,
    targetDate: edit.targetDate ?? undefined,
    sessionDate: edit.targetDate ?? undefined,
    planEntryId: edit.targetItemId ?? null,
    scope: edit.actionScope ?? null,
  }, input.trace);
  return runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: edit.intent,
      targetDomain: edit.targetDomain,
      requestedChangeKind: edit.requestedChange,
      missingFieldCodes: edit.missingFields,
      targetIdentityHash: athleteActionDiagnosticHash({
        targetDate: edit.targetDate,
        targetItemId: edit.targetItemId,
      }),
      programEditSource: edit.source,
    });
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: 'coach_program_edit',
      producer: 'executeProgramEdit',
      hasTypedCommand: Boolean(edit.command),
    });
    try {
      const result = executeProgramEditWithinTrace(input);
      if (!result.applied && (
        result.kind === 'rejected' ||
        result.kind === 'rejected_with_alternatives' ||
        result.kind === 'verified_no_op' ||
        result.kind === 'error'
      )) {
        emitAthleteActionEvent(trace, 'athlete_action_failed', {
          outcome: result.kind,
          internalResultCode: `program_edit_${edit.intent}_${result.kind}`,
          originalRejectionCode: result.route,
          rejectionCodes: [result.route],
          firstFailingBoundary: result.route.split(':')[0] ?? 'executeProgramEdit',
          failureCategory: classifyAthleteActionFailure(result.route, 'executeProgramEdit'),
          validCandidateExisted: result.kind === 'verified_no_op',
          previousStateRestored: true,
          terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
        });
      }
      return result;
    } catch (error) {
      const rejectionCode = error instanceof Error ? error.name : 'unknown_error';
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'threw',
        internalResultCode: `program_edit_${edit.intent}_threw`,
        originalRejectionCode: rejectionCode,
        rejectionCodes: [rejectionCode],
        firstFailingBoundary: 'executeProgramEdit',
        failureCategory: classifyAthleteActionFailure(rejectionCode, 'executeProgramEdit'),
        validCandidateExisted: false,
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
      throw error;
    }
  });
}

function isStrengthBlockProgramEdit(edit: ProgramEdit): edit is StrengthBlockEdit {
  return edit.targetDomain === 'strength' &&
    (edit.intent === 'remove' || edit.intent === 'edit') &&
    'editScope' in edit &&
    (edit.editScope === 'remove_strength_block' || edit.editScope === 'reduce_strength_block');
}

function executeStrengthBlockProgramEdit(
  input: ExecuteProgramEditInput,
  edit: StrengthBlockEdit,
): ExecutionResult {
  const stages: ProgressStage[] = [];
  const tick = (stage: ProgressStage) => {
    if (!stages.includes(stage)) stages.push(stage);
    input.onProgress?.(stage);
  };

  if (!edit.targetDate) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: 'Which day should I change the strength work on?',
      applied: false,
      route: 'program_edit_clarify:strength_block_targetDate',
      progress: stages,
    };
  }

  const deps = input.conditioningDeps ?? {};
  const applyEvents = deps.applyEvents ?? applyAdjustmentEvents;
  const snapshotBefore = deps.snapshotBefore ??
    ((date: string) => snapshotProgramEditVisibleWorkout(input, edit, 'before', date));
  const snapshotAfter = deps.snapshotAfter ??
    ((date: string) => snapshotProgramEditVisibleWorkout(input, edit, 'after', date));

  tick('checking_program');
  const beforeWorkout = snapshotBefore(edit.targetDate);
  const beforeOverrideSnapshot = readProgramEditOverrideSnapshot(input, edit.targetDate);
  if (!beforeWorkout) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply: `${humanDate(edit.targetDate)} doesn't have a visible workout to change.`,
      applied: false,
      route: 'no_workout:strength_block',
      progress: stages,
    };
  }
  if (isTeamOrGameWorkout(beforeWorkout)) {
    tick('composing_reply');
    return {
      kind: 'rejected',
      reply: "I won't remove team training or game content as a strength-block edit. Which gym strength work should I change?",
      applied: false,
      route: 'protected_team_or_game:strength_block',
      progress: stages,
    };
  }
  const beforeStrength = visibleStrengthBlockItems(beforeWorkout);
  if (beforeStrength.length === 0) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply: `I couldn't find strength work on ${humanDate(edit.targetDate)}, so I left conditioning unchanged.`,
      applied: false,
      route: 'no_strength_block_visible',
      progress: stages,
    };
  }

  const event: AdjustmentEvent = {
    id: `coach-program-edit-${edit.editScope}-${edit.targetDate}`,
    kind: edit.editScope === 'remove_strength_block'
      ? 'remove_strength_block'
      : 'reduce_strength_block',
    date: edit.targetDate,
    reason: `coach ${edit.editScope}`,
  };

  tick('applying_change');
  const applyResult = applyEvents([event], {
    todayISO: input.todayISO,
    allowFutureWeeks: true,
    allowPastDates: false,
  });

  tick('verifying_update');
  const afterWorkout = snapshotAfter(edit.targetDate);
  const verification = verifyStrengthBlockMutation({
    edit,
    beforeWorkout,
    afterWorkout,
    applyResult,
  });
  const verificationFailureReason = 'reason' in verification ? verification.reason : null;

  logger.debug('[coach-program-edit-strength-block]', {
    targetDate: edit.targetDate,
    editScope: edit.editScope,
    appliedCount: applyResult.applied.length,
    rejectedCount: applyResult.rejected.length,
    rejectedKinds: applyResult.rejected.map((rejection) => rejection.kind),
    verification,
  });

  tick('composing_reply');
  if (verificationFailureReason) {
    rollbackProgramEditVisibleFailure({
      input,
      edit,
      beforeOverrideSnapshot,
      beforeVisibleWorkout: beforeWorkout,
      reason: verificationFailureReason,
    });
    return {
      kind: verificationFailureReason === 'apply_rejected'
        ? 'verified_no_op'
        : 'verified_no_op',
      reply: strengthBlockFailureReply(edit, verificationFailureReason, applyResult),
      applied: false,
      route: `strength_block_verification_failed:${verificationFailureReason}`,
      progress: stages,
    };
  }

  const verb = edit.editScope === 'remove_strength_block' ? 'removed' : 'reduced';
  return {
    kind: 'mutated',
    reply: `Done. I ${verb} the strength work on ${humanDate(edit.targetDate)} and left conditioning alone.`,
    applied: true,
    route: `${edit.editScope}:applied`,
    progress: stages,
  };
}

function isTeamOrGameWorkout(workout: ResolvedDay['workout'] | null): boolean {
  if (!workout) return false;
  const type = String(workout.workoutType ?? '').toLowerCase();
  return type === 'game' ||
    type === 'team training' ||
    type.includes('team training') ||
    (workout as any).isTeamDay === true;
}

function visibleStrengthBlockItems(workout: ResolvedDay['workout'] | null): ProgramEditCandidateItem[] {
  return extractVisibleProgramItemsFromWorkout(workout)
    .filter((item) => item.domain === 'strength');
}

function strengthBlockSignature(workout: ResolvedDay['workout'] | null): string {
  return visibleStrengthBlockItems(workout)
    .map((item) => `${item.id}:${item.title}:${(item as any).description ?? ''}`)
    .sort()
    .join('|');
}

function conditioningBlockSignatureForStrengthGuard(workout: ResolvedDay['workout'] | null): string {
  const optionSignature = (workout?.conditioningBlock?.options ?? [])
    .map((option: any) => `${String(option.title ?? '').trim()}:${String(option.description ?? '').trim()}`)
    .filter((value) => value.replace(/:/g, '').trim().length > 0);
  const visibleSignature = visibleConditioningItems(workout)
    .map((item) => `${item.title}:${item.modality ?? ''}:${item.durationMinutes ?? ''}`);
  return [...optionSignature, ...visibleSignature]
    .sort()
    .join('|');
}

function verifyStrengthBlockMutation(args: {
  edit: StrengthBlockEdit;
  beforeWorkout: ResolvedDay['workout'] | null;
  afterWorkout: ResolvedDay['workout'] | null;
  applyResult: ApplyEventsResult;
}): { ok: true } | { ok: false; reason: string } {
  const { edit, beforeWorkout, afterWorkout, applyResult } = args;
  if (applyResult.applied.length === 0) return { ok: false, reason: 'apply_rejected' };

  const beforeStrength = visibleStrengthBlockItems(beforeWorkout);
  const afterStrength = visibleStrengthBlockItems(afterWorkout);
  if (beforeStrength.length === 0) return { ok: false, reason: 'strength_missing_before' };

  const beforeConditioning = conditioningBlockSignatureForStrengthGuard(beforeWorkout);
  const afterConditioning = conditioningBlockSignatureForStrengthGuard(afterWorkout);
  if (beforeConditioning !== afterConditioning) {
    return { ok: false, reason: 'protected_conditioning_changed' };
  }

  if (edit.editScope === 'remove_strength_block') {
    if (afterStrength.length > 0) return { ok: false, reason: 'strength_still_visible' };
    if (!afterWorkout && beforeConditioning) return { ok: false, reason: 'protected_conditioning_missing' };
    return { ok: true };
  }

  if (afterStrength.length === 0) return { ok: false, reason: 'reduced_strength_removed' };
  if (strengthBlockSignature(beforeWorkout) === strengthBlockSignature(afterWorkout)) {
    return { ok: false, reason: 'strength_unchanged' };
  }
  return { ok: true };
}

function strengthBlockFailureReply(
  edit: StrengthBlockEdit,
  reason: string,
  applyResult: ApplyEventsResult,
): string {
  const first = applyResult.rejected[0];
  if (reason === 'apply_rejected' && first?.kind === 'past_date_blocked') {
    return `${humanDate(edit.targetDate)} is in the past - I can't change it.`;
  }
  if (reason === 'apply_rejected' && first?.reason) {
    return `I couldn't safely change the strength work on ${humanDate(edit.targetDate)}: ${first.reason}`;
  }
  if (reason === 'protected_conditioning_changed' || reason === 'protected_conditioning_missing') {
    return "I couldn't safely change the strength work without touching conditioning, so I left the plan unchanged.";
  }
  if (reason === 'strength_still_visible' || reason === 'strength_unchanged') {
    return "I tried to change the strength work, but the visible program didn't update, so I left the plan unchanged.";
  }
  return "I couldn't safely apply that strength-block change, so I left the plan unchanged.";
}

function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const weekday = dt.toLocaleDateString('en-AU', { weekday: 'short' });
  return `${weekday} ${iso}`;
}

export interface ExecuteProgramSetupEditInput {
  programEdit: ProgramSetupEdit;
  todayISO: string;
  getOnboardingData: () => OnboardingData;
  updateOnboardingData: (patch: Partial<OnboardingData>) => void;
  generateProgramFromProfile: (
    profile: OnboardingData,
    options?: { todayISO?: string; blockNumber?: number },
  ) => Promise<TrainingProgram>;
  setCurrentProgram: (program: TrainingProgram | null) => void;
  setCurrentMicrocycle: (microcycle: TrainingProgram['microcycles'][number] | null) => void;
  setTodayWorkout: (workout: TrainingProgram['microcycles'][number]['workouts'][number] | null) => void;
  /** Production accepted-state owner. Tests/legacy callers may omit this and
   * retain the individual setter seam below. */
  commitAcceptedRebuild?: (args: {
    program: TrainingProgram;
    profile: OnboardingData;
    todayISO: string;
  }) => void;
  onProgress?: (stage: ProgressStage) => void;
}

export function isProgramSetupEdit(edit: ProgramEdit): edit is ProgramSetupEdit {
  return edit.intent === 'edit' &&
    edit.targetDomain === 'schedule' &&
    'editScope' in edit &&
    edit.editScope === 'update_program_setup';
}

export async function executeProgramSetupEdit(
  input: ExecuteProgramSetupEditInput,
): Promise<ExecutionResult> {
  const edit = input.programEdit;
  input.onProgress?.('checking_program');
  const currentProfile = input.getOnboardingData();
  const profilePatchResult = buildProgramSetupProfilePatch(edit, currentProfile, input.todayISO);
  if (profilePatchResult.kind === 'clarify') {
    return {
      kind: 'clarify',
      reply: profilePatchResult.reply,
      applied: false,
      route: profilePatchResult.route,
      progress: ['checking_program', 'composing_reply'],
      options: profilePatchResult.options,
    };
  }

  const nextProfile = {
    ...currentProfile,
    ...profilePatchResult.patch,
  };

  if (
    nextProfile.seasonPhase === 'In-season' &&
    !nextProfile.usualGameDay &&
    !nextProfile.gameDay
  ) {
    return {
      kind: 'clarify',
      reply: 'Do you have a regular game day right now, or should I rebuild this as a no-game training week?',
      applied: false,
      route: 'program_setup_clarify:game_day_missing',
      progress: ['checking_program', 'composing_reply'],
      options: ['Set a regular game day', 'Rebuild as no-game week'],
    };
  }

  input.onProgress?.('applying_change');
  let program: TrainingProgram;
  try {
    program = await input.generateProgramFromProfile(nextProfile, { todayISO: input.todayISO });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[coach-program-setup] rebuild_failed', {
      summary: edit.setupChange.summary,
      message,
    });
    return {
      kind: 'error',
      reply: 'I understood the setup change, but I could not rebuild the program safely. Please try again.',
      applied: false,
      route: 'program_setup_rebuild_failed',
      progress: ['checking_program', 'applying_change', 'composing_reply'],
    };
  }

  input.onProgress?.('verifying_update');
  const verification = verifyProgramSetupRebuild({
    edit,
    nextProfile,
    program,
    todayISO: input.todayISO,
  });
  if (verification.ok === false) {
    logger.warn('[coach-program-setup] verification_failed', {
      reason: verification.reason,
      summary: edit.setupChange.summary,
      preferredTrainingDays: nextProfile.preferredTrainingDays,
      trainingDaysPerWeek: nextProfile.trainingDaysPerWeek,
    });
    return {
      kind: 'rejected',
      reply: verification.reply,
      applied: false,
      route: `program_setup_verification_failed:${verification.reason}`,
      progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'],
    };
  }

  try {
    if (input.commitAcceptedRebuild) {
      input.commitAcceptedRebuild({
        program,
        profile: nextProfile,
        todayISO: input.todayISO,
      });
    } else {
      input.setCurrentProgram(program);
      // Legacy/test seam: production publishes this through the accepted
      // transaction above. Keep the canonical sweep for callers that still
      // provide only individual store setters.
      clearManualOverridesPreservingActiveModifiers(input.todayISO);
      const firstMicrocycle = program.microcycles?.[0] ?? null;
      input.setCurrentMicrocycle(firstMicrocycle);
      if (firstMicrocycle) {
        const todayDow = new Date(`${input.todayISO}T12:00:00`).getDay();
        const todayWorkout = firstMicrocycle.workouts?.find((workout) => workout.dayOfWeek === todayDow) ?? null;
        input.setTodayWorkout(todayWorkout);
      } else {
        input.setTodayWorkout(null);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[coach-program-setup] accepted_rebuild_failed', {
      summary: edit.setupChange.summary,
      message,
    });
    return {
      kind: 'rejected',
      reply: 'I understood the availability change, but I could not relocate the required work safely, so I left your accepted program unchanged.',
      applied: false,
      route: 'program_setup_accepted_rebuild_failed',
      progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'],
    };
  }
  input.updateOnboardingData(profilePatchResult.patch);

  input.onProgress?.('composing_reply');
  return {
    kind: 'mutated',
    reply: buildProgramSetupReply(edit, nextProfile),
    applied: true,
    route: 'program_setup:applied',
    progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'],
  };
}

type ProgramSetupPatchResult =
  | { kind: 'patch'; patch: Partial<OnboardingData> }
  | { kind: 'clarify'; reply: string; route: string; options?: string[] };

function buildProgramSetupProfilePatch(
  edit: ProgramSetupEdit,
  current: OnboardingData,
  todayISO: string,
): ProgramSetupPatchResult {
  const change = edit.setupChange;
  const currentDays = orderedDays(current.preferredTrainingDays ?? []);
  let nextDays = [...currentDays];

  if (change.replaceTrainingDays) {
    nextDays = orderedDays(change.replaceTrainingDays);
  }
  if (change.addTrainingDays) {
    nextDays = orderedDays([...nextDays, ...change.addTrainingDays]);
  }
  if (change.removeTrainingDays) {
    const remove = new Set(change.removeTrainingDays);
    nextDays = nextDays.filter((day) => !remove.has(day));
  }

  const desiredFrequency =
    change.trainingDaysPerWeek ??
    (nextDays.length !== currentDays.length ? nextDays.length : current.trainingDaysPerWeek);
  if (
    desiredFrequency != null &&
    desiredFrequency !== nextDays.length &&
    !change.addTrainingDays?.length &&
    !change.replaceTrainingDays?.length
  ) {
    return {
      kind: 'clarify',
      reply: `Which ${desiredFrequency} weekdays should be your regular training days?`,
      route: 'program_setup_clarify:preferred_training_days',
      options: desiredFrequency > nextDays.length
        ? ALL_DAYS.filter((day) => !nextDays.includes(day))
        : nextDays,
    };
  }

  let nextConstraints = [...(current.availabilityConstraints ?? [])];
  if (change.clearUnavailableDays?.length) {
    const clear = new Set(change.clearUnavailableDays);
    nextConstraints = nextConstraints.map((constraint) =>
      constraint.kind === 'unavailable_day' && constraint.dayOfWeek && clear.has(constraint.dayOfWeek)
        ? { ...constraint, active: false, updatedAt: `${todayISO}T00:00:00.000Z` }
        : constraint,
    );
  }
  if (change.availabilityConstraints?.length) {
    for (const nextConstraint of change.availabilityConstraints) {
      const existingIdx = nextConstraints.findIndex((constraint) =>
        constraint.kind === nextConstraint.kind &&
        constraint.dayOfWeek === nextConstraint.dayOfWeek &&
        constraint.scope === nextConstraint.scope,
      );
      if (existingIdx >= 0) {
        nextConstraints[existingIdx] = {
          ...nextConstraints[existingIdx],
          ...nextConstraint,
          id: nextConstraints[existingIdx].id,
          updatedAt: `${todayISO}T00:00:00.000Z`,
        };
      } else {
        nextConstraints.push(nextConstraint);
      }
    }
  }

  const patch: Partial<OnboardingData> = {};
  if (change.replaceTrainingDays || change.addTrainingDays || change.removeTrainingDays) {
    patch.preferredTrainingDays = nextDays;
  }
  if (desiredFrequency != null) {
    patch.trainingDaysPerWeek = desiredFrequency;
  }
  if (change.availabilityConstraints?.length || change.clearUnavailableDays?.length) {
    patch.availabilityConstraints = nextConstraints;
  }

  return { kind: 'patch', patch };
}

function verifyProgramSetupRebuild(args: {
  edit: ProgramSetupEdit;
  nextProfile: OnboardingData;
  program: TrainingProgram;
  todayISO: string;
}): { ok: true } | { ok: false; reason: string; reply: string } {
  const { edit, nextProfile, program, todayISO } = args;
  const workouts = program.microcycles?.[0]?.workouts ?? [];
  const deterministicPlan = buildCoachingPlan(onboardingToCoachingInputs(nextProfile, {
    availabilityDateISO: todayISO,
  }));
  const expectedPlanDows = new Set(
    deterministicPlan.weeklyPlan
      .map((session) => session.dayOfWeek ? dayOfWeekNumber(session.dayOfWeek as DayOfWeek) : -1)
      .filter((day) => day >= 0),
  );
  const workoutDows = new Set(workouts.map((workout) => workout.dayOfWeek));
  const preferred = new Set(nextProfile.preferredTrainingDays ?? []);
  for (const day of edit.setupChange.addTrainingDays ?? []) {
    if (!preferred.has(day)) {
      return {
        ok: false,
        reason: 'availability_not_stored',
        reply: `I could not verify that ${day} was saved as an available training day, so I did not apply the rebuild.`,
      };
    }
  }

  const missingPlannedDows = [...expectedPlanDows].filter((day) => !workoutDows.has(day));
  if (missingPlannedDows.length > 0) {
    return {
      ok: false,
      reason: 'rebuilt_program_missing_planned_days',
      reply: `I rebuilt the setup draft, but the generated week was missing ${formatDayList(missingPlannedDows.map(dayNameFromNumber))}. I did not apply it because that would not match the updated training plan.`,
    };
  }

  const expectedFrequency = nextProfile.trainingDaysPerWeek ?? 0;
  const shouldUseAddedSaturday =
    (edit.setupChange.addTrainingDays ?? []).includes('Saturday') &&
    expectedFrequency >= 6;
  if (shouldUseAddedSaturday && !workouts.some((workout) => workout.dayOfWeek === 6)) {
    return {
      ok: false,
      reason: 'saturday_not_used_after_rebuild',
      reply: 'I updated the setup draft, but the rebuilt week did not include Saturday. I did not apply it because that would not match your availability change.',
    };
  }

  if (
    expectedFrequency >= 6 &&
    preferred.has('Saturday') &&
    expectedPlanDows.has(6) &&
    !workoutDows.has(6)
  ) {
    return {
      ok: false,
      reason: 'six_day_rebuild_missing_saturday',
      reply: 'I rebuilt the setup draft, but the visible week did not include Saturday even though Saturday is available and the plan is set to 6 days. I did not apply it.',
    };
  }

  const unavailable = (nextProfile.availabilityConstraints ?? []).filter((constraint) =>
    constraint.active !== false &&
    constraint.kind === 'unavailable_day' &&
    !!constraint.dayOfWeek,
  );
  const blockedScheduledDate = program.microcycles.flatMap((microcycle) =>
    (microcycle.workouts ?? []).map((workout) => ({
      date: addDaysISO(
        microcycle.startDate.slice(0, 10),
        workout.dayOfWeek === 0 ? 6 : workout.dayOfWeek - 1,
      ),
      workout,
    })),
  ).find(({ date, workout }) =>
    date >= todayISO && unavailable.some((constraint) =>
      dayOfWeekNumber(constraint.dayOfWeek!) === workout.dayOfWeek &&
      (!constraint.startDate || constraint.startDate <= date) &&
      (!constraint.endDate || constraint.endDate >= date)),
  );
  if (blockedScheduledDate) {
    return {
      ok: false,
      reason: 'blocked_day_still_scheduled',
      reply: `I rebuilt the week, but it still had training on the blocked date ${blockedScheduledDate.date}. I did not apply it.`,
    };
  }

  return { ok: true };
}

function buildProgramSetupReply(edit: ProgramSetupEdit, nextProfile: OnboardingData): string {
  const change = edit.setupChange;
  const recurringMove =
    change.addTrainingDays?.length === 1 &&
    change.removeTrainingDays?.length === 1 &&
    /^move\s+/i.test(change.summary);
  if (recurringMove) {
    return `Done - I’ve updated your weekly setup so that session moves from ${change.removeTrainingDays![0]} to ${change.addTrainingDays![0]} going forward.`;
  }
  if (change.addTrainingDays?.length && change.trainingDaysPerWeek) {
    return `Done - I’ve updated your availability to include ${formatDayList(change.addTrainingDays)} and rebuilt the week. You’re now set up for ${nextProfile.trainingDaysPerWeek} training days where the week allows it.`;
  }
  if (change.addTrainingDays?.length) {
    return `Done - I’ve updated your availability to include ${formatDayList(change.addTrainingDays)} and rebuilt the week. You’re now set up for ${nextProfile.trainingDaysPerWeek ?? change.addTrainingDays.length} training days where the week allows it.`;
  }
  if (change.replaceTrainingDays?.length) {
    return `Done - I’ve updated your available training days to ${formatDayList(change.replaceTrainingDays)} and rebuilt the week.`;
  }
  if (change.trainingDaysPerWeek) {
    return `Done - I’ve set your program up for ${change.trainingDaysPerWeek} training days per week and rebuilt the week.`;
  }
  if (change.clearUnavailableDays?.length) {
    return `Done - ${formatDayList(change.clearUnavailableDays)} can be used again, and I rebuilt the week around your updated availability.`;
  }
  const blocked = (change.availabilityConstraints ?? []).filter((constraint) => constraint.kind === 'unavailable_day' && constraint.dayOfWeek);
  if (blocked.length > 0) {
    return `Done - I’ve blocked ${formatDayList(blocked.map((constraint) => constraint.dayOfWeek!))} and rebuilt the week around that availability.`;
  }
  const timeCaps = (change.availabilityConstraints ?? []).filter((constraint) => constraint.kind === 'time_limit' && constraint.dayOfWeek && constraint.maxSessionMinutes);
  if (timeCaps.length > 0) {
    const first = timeCaps[0];
    return `Done - I’ve saved the ${first.maxSessionMinutes} minute cap for ${first.dayOfWeek} and rebuilt the week around that constraint.`;
  }
  return 'Done - I’ve updated your program setup and rebuilt the week.';
}

function orderedDays(days: DayOfWeek[]): DayOfWeek[] {
  const set = new Set(days.filter((day): day is DayOfWeek => ALL_DAYS.includes(day)));
  return ALL_DAYS.filter((day) => set.has(day));
}

function dayOfWeekNumber(day: DayOfWeek): number {
  return day === 'Sunday' ? 0 : ALL_DAYS.indexOf(day) + 1;
}

function dayNameFromNumber(day: number): DayOfWeek {
  return day === 0 ? 'Sunday' : ALL_DAYS[day - 1] ?? 'Monday';
}

function commandForProgramEditExecution(edit: ProgramEdit): CoachCommand {
  const command = edit.command;
  if (
    !command ||
    command.mode !== 'mutate' ||
    edit.targetDomain !== 'conditioning' ||
    !('editScope' in edit) ||
    !edit.editScope ||
    !edit.targetItemId
  ) {
    return command as CoachCommand;
  }

  if (command.payload.operation === 'remove_conditioning') {
    return {
      ...command,
      payload: {
        ...command.payload,
        targetItemId: command.payload.targetItemId ?? edit.targetItemId,
      },
    };
  }

  if (command.payload.operation !== 'add_conditioning') {
    return command;
  }

  return {
    ...command,
    payload: {
      ...command.payload,
      targetItemId: command.payload.targetItemId ?? edit.targetItemId,
      editMode:
        edit.editScope === 'add_conditioning_item'
          ? command.payload.editMode
          : 'update_existing',
      editScope:
        edit.editScope === 'duration_only'
          ? 'edit_duration_only'
          : edit.editScope === 'modality_only'
          ? 'edit_modality_only'
          : edit.editScope === 'intensity_only'
          ? 'edit_intensity_only'
          : command.payload.editScope,
    },
  };
}

type ProgramEditOverrideSnapshot = {
  workout: ResolvedDay['workout'] | null;
  context: any | null;
};

function verifyExecutedProgramEdit(args: {
  input: ExecuteProgramEditInput;
  edit: ProgramEdit;
  result: ExecutionResult;
  beforeVisibleWorkout: ResolvedDay['workout'] | null;
  beforeOverrideSnapshot: ProgramEditOverrideSnapshot | null;
}): ExecutionResult | null {
  const { input, edit, result, beforeVisibleWorkout, beforeOverrideSnapshot } = args;
  if (
    result.kind !== 'mutated' ||
    !result.applied ||
    edit.targetDomain !== 'conditioning' ||
    !(
      (edit.intent === 'edit' && edit.editScope === 'duration_only') ||
      (edit.intent === 'remove' && edit.editScope === 'remove_conditioning_item') ||
      (edit.intent === 'replace' && edit.editScope === 'replace_conditioning_prescription') ||
      (edit.protectedTargets?.length ?? 0) > 0
    ) ||
    !edit.targetDate
  ) {
    return null;
  }

  const afterVisibleWorkout = snapshotProgramEditVisibleWorkout(input, edit, 'after');
  if (!beforeVisibleWorkout || !afterVisibleWorkout) {
    return null;
  }

  const verification = verifyProgramEditVisibleMutation({
    edit,
    beforeWorkout: beforeVisibleWorkout,
    afterWorkout: afterVisibleWorkout,
    targetDate: edit.targetDate,
  });
  logger.debug('[coach-program-edit-visible-verifier]', {
    intent: edit.intent,
    editScope: 'editScope' in edit ? edit.editScope : null,
    targetDate: edit.targetDate,
    targetItemId: edit.targetItemId,
    ok: verification.ok,
    reason: verification.reason ?? null,
  });
  if (verification.ok) return null;

  const reply =
    edit.intent === 'remove' && isBlockLevelProgramEdit(edit)
      ? 'I couldn\'t safely remove that conditioning block, so I left the session unchanged.'
      : edit.intent === 'remove'
      ? 'I couldn\'t safely remove that item. Which conditioning item should I remove?'
      : (edit.protectedTargets?.length ?? 0) > 0
      ? 'I couldn\'t safely make that change without touching something you asked me to keep. Which item should I change?'
      : 'I couldn\'t safely update that duration. Which conditioning item should I change?';
  rollbackProgramEditVisibleFailure({
    input,
    edit,
    beforeOverrideSnapshot,
    beforeVisibleWorkout,
    reason: verification.reason ?? 'program_edit_visible_verifier_failed',
  });
  return {
    kind: 'verified_no_op',
    reply,
    applied: false,
    route: `program_edit_verification_failed:${verification.reason ?? 'unknown'}`,
    progress: Array.from(new Set([...result.progress, 'verifying_update', 'composing_reply'])),
  };
}

function snapshotProgramEditVisibleWorkout(
  input: ExecuteProgramEditInput,
  edit: ProgramEdit,
  phase: 'before' | 'after',
  targetDateOverride?: string,
): ResolvedDay['workout'] | null {
  const targetDate = targetDateOverride ?? edit.targetDate;
  if (!targetDate) return null;
  const seam =
    phase === 'before'
      ? input.conditioningDeps?.snapshotBefore
      : input.conditioningDeps?.snapshotAfter;
  if (seam) return seam(targetDate);

  if (input.conditioningDeps) {
    return null;
  }

  try {
    const programState = useProgramStore.getState();
    return getResolvedVisibleProgramForDate({
      date: targetDate,
      todayISO: input.todayISO,
      state: buildScheduleStateImperative(),
      overrideContexts: programState.overrideContexts ?? {},
    }).day.workout ?? null;
  } catch (e) {
    logger.warn('[coach-program-edit-visible-snapshot-failed]', {
      targetDate,
      phase,
      error: (e as Error)?.message ?? String(e),
    });
    return null;
  }
}

function readProgramEditOverrideSnapshot(
  input: ExecuteProgramEditInput,
  targetDate: string,
): ProgramEditOverrideSnapshot {
  const read = input.undoDeps?.readDateOverride;
  if (read) return read(targetDate);
  try {
    const state = useProgramStore.getState();
    return {
      workout: state.dateOverrides?.[targetDate] ?? null,
      context: state.overrideContexts?.[targetDate] ?? null,
    };
  } catch {
    return { workout: null, context: null };
  }
}

function rollbackProgramEditVisibleFailure(args: {
  input: ExecuteProgramEditInput;
  edit: ProgramEdit;
  beforeOverrideSnapshot: ProgramEditOverrideSnapshot | null;
  beforeVisibleWorkout: ResolvedDay['workout'] | null;
  reason: string;
}): void {
  const { input, edit, beforeOverrideSnapshot, beforeVisibleWorkout, reason } = args;
  if (!edit.targetDate) return;
  const restore = beforeOverrideSnapshot ?? {
    workout: beforeVisibleWorkout,
    context: null,
  };

  try {
    if (input.conditioningDeps?.rollback) {
      input.conditioningDeps.rollback({
        kind: 'restore_snapshot',
        dateOverrides: [{
          date: edit.targetDate,
          workout: restore.workout,
          context: restore.context,
        }],
      } as any, { todayISO: input.todayISO });
    } else {
      const store = useProgramStore.getState();
      if (restore.workout) {
        store.setManualOverride(edit.targetDate, restore.workout, restore.context ?? undefined);
      } else {
        store.removeManualOverride(edit.targetDate);
      }
    }
    logger.debug('[coach-program-edit-visible-verifier-rollback]', {
      targetDate: edit.targetDate,
      targetItemId: edit.targetItemId,
      reason,
    });
  } catch (e) {
    logger.warn('[coach-program-edit-visible-verifier-rollback-failed]', {
      targetDate: edit.targetDate,
      targetItemId: edit.targetItemId,
      reason,
      error: (e as Error)?.message ?? String(e),
    });
  }
}

function assertCompleteProgramEditForExecution(edit: ProgramEdit): void {
  if (edit.intent === 'ask_question' || edit.intent === 'explain') return;
  if (edit.targetDomain !== 'conditioning') return;

  switch (edit.editScope) {
    case 'modality_only':
      void edit.newModality;
      return;
    case 'duration_only':
      void edit.newDuration;
      return;
    case 'intensity_only':
      void edit.newIntensity;
      return;
    case 'replace_conditioning_prescription':
      void edit.replacementType;
      void edit.replacementPrescription;
      return;
    case 'add_conditioning_item':
      void edit.appendWasExplicit;
      return;
    case 'remove_conditioning_item':
      return;
    default:
      assertNever(edit);
  }
}

export function resolvePendingProgramEditAnswer(input: {
  pending: PendingCoachClarifier;
  userMessage: string;
  todayISO?: string;
  currentWeek?: VisibleSessionRef[];
  resolveVisibleProgramForDate?: ResolveVisibleProgramForDate;
  pendingAnswerClassification?: PendingClarificationAnswerClassification | null;
}): PendingProgramEditAnswerResult {
  const edit = input.pending.programEdit;
  if (!edit) {
    return { kind: 'unresolved' };
  }
  if (pendingProgramEditNeedsTargetDate(input.pending, edit)) {
    return resolvePendingTargetDateAnswer({
      edit,
      pending: input.pending,
      userMessage: input.userMessage,
      todayISO: input.todayISO,
      currentWeek: input.currentWeek,
      resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
      pendingAnswerClassification: input.pendingAnswerClassification,
    });
  }
  if (edit.missingFields.includes('duration_scope')) {
    return resolvePendingDurationScopeAnswer({
      edit,
      pending: input.pending,
      userMessage: input.userMessage,
    });
  }
  if (!edit.missingFields.includes('targetItemId')) {
    return { kind: 'unresolved' };
  }
  if (!edit.targetDate) {
    return {
      kind: 'clarify',
      programEdit: edit,
      reply: 'Which day should I change?',
    };
  }

  const visibleProgram = resolveVisibleProgramForDateFromInputs({
    targetDate: edit.targetDate,
    currentWeek: input.currentWeek,
    resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
  });
  const candidates = candidateItemsForDomain({
    items: input.pending.candidateItems ?? edit.candidateItems ?? visibleProgram.items,
    targetDomain: edit.targetDomain,
  });
  logger.debug('[coach-program-edit-pending-candidates]', {
    targetDate: edit.targetDate,
    source: input.pending.candidateItems?.length
      ? 'pending_snapshot'
      : edit.candidateItems?.length
      ? 'program_edit_snapshot'
      : visibleProgram.source,
    candidates: candidates.map(candidateLogPayload),
    answer: input.userMessage,
  });

  if (candidates.length === 0) {
    return {
      kind: 'clarify',
      programEdit: edit,
      reply: `I can't see a visible item on ${edit.targetDate} to change. Which session or item do you mean?`,
    };
  }

  const answerClassification =
    input.pendingAnswerClassification ??
    classifyPendingClarificationAnswer({
      message: input.userMessage,
      pendingClarification: input.pending.pendingClarification,
      askedQuestion: input.pending.askedQuestion,
    });
  if (answerClassification.kind === 'reject_proposed') {
    return {
      kind: 'cancelled',
      reply: 'Got it - leaving things as they are.',
    };
  }
  const acceptedItem = targetItemFromPendingAnswerClassification(answerClassification, candidates);
  if (acceptedItem) {
    return {
      kind: 'complete',
      programEdit: completeProgramEditTargetItem(edit, acceptedItem),
    };
  }

  const match = matchPendingAnswerToItem(input.userMessage, candidates);
  if (match.kind === 'one') {
    return {
      kind: 'complete',
      programEdit: completeProgramEditTargetItem(edit, match.item),
    };
  }

  const narrowedOptions = match.kind === 'many'
    ? match.items.map((item) => item.title)
    : candidates.map((item) => item.title);
  const reply = betterItemClarificationQuestion({
    targetDate: edit.targetDate,
    answer: input.userMessage,
    options: narrowedOptions,
  });
  return {
    kind: 'clarify',
    programEdit: {
      ...edit,
      question: reply,
      options: narrowedOptions,
    },
    reply,
    options: narrowedOptions,
  };
}

function pendingProgramEditNeedsTargetDate(
  pending: PendingCoachClarifier,
  edit: ProgramEdit,
): boolean {
  return (
    edit.missingFields.includes('targetDate') ||
    edit.missingFields.includes('target_date') ||
    pending.missingFields.includes('targetDate') ||
    pending.missingFields.includes('target_date') ||
    pending.pendingClarification?.missingField === 'targetDate' ||
    pending.pendingClarification?.missingField === 'target_date'
  );
}

function resolvePendingTargetDateAnswer(input: {
  edit: ProgramEdit;
  pending: PendingCoachClarifier;
  userMessage: string;
  todayISO?: string;
  currentWeek?: VisibleSessionRef[];
  resolveVisibleProgramForDate?: ResolveVisibleProgramForDate;
  pendingAnswerClassification?: PendingClarificationAnswerClassification | null;
}): PendingProgramEditAnswerResult {
  const answerClassification =
    input.pendingAnswerClassification ??
    classifyPendingClarificationAnswer({
      message: input.userMessage,
      pendingClarification: input.pending.pendingClarification,
      askedQuestion: input.pending.askedQuestion,
    });
  if (answerClassification.kind === 'reject_proposed') {
    return {
      kind: 'cancelled',
      reply: 'Got it - leaving things as they are.',
    };
  }

  const acceptedCandidateDate = targetDateFromPendingAnswerClassification({
    classification: answerClassification,
    pending: input.pending,
    edit: input.edit,
    todayISO: input.todayISO,
    currentWeek: input.currentWeek,
  });
  const targetDate = acceptedCandidateDate ?? parsePendingTargetDateAnswer({
    message: input.userMessage,
    todayISO: input.todayISO,
    pending: input.pending,
    edit: input.edit,
    currentWeek: input.currentWeek,
  });
  if (!targetDate) {
    const options =
      input.pending.pendingClarification?.candidateOptions?.length
        ? input.pending.pendingClarification.candidateOptions
        : ['Today', 'Tomorrow'];
    const reply =
      input.pending.askedQuestion ??
      'Which day should I use?';
    return {
      kind: 'clarify',
      programEdit: pendingSlotClarificationEdit(input.edit, ['targetDate'], reply, options),
      reply,
      options,
    };
  }

  const visibleProgram = resolveVisibleProgramForDateFromInputs({
    targetDate,
    currentWeek: input.currentWeek,
    resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
  });
  let retargeted = retargetProgramEditDate({
    edit: input.edit,
    targetDate,
    visibleProgram,
  });

  if (!programEditNeedsTargetItem(retargeted)) {
    return { kind: 'complete', programEdit: retargeted };
  }

  const candidates = candidateItemsForDomain({
    items: visibleProgram.items,
    targetDomain: retargeted.targetDomain,
  });
  const match = matchPendingAnswerToItem(input.userMessage, candidates);
  if (match.kind === 'one') {
    return {
      kind: 'complete',
      programEdit: completeProgramEditTargetItem(retargeted, match.item),
    };
  }

  if (candidates.length === 1) {
    return {
      kind: 'complete',
      programEdit: completeProgramEditTargetItem(retargeted, candidates[0]),
    };
  }

  const options = match.kind === 'many'
    ? match.items.map((item) => item.title)
    : candidates.map((item) => item.title);
  const reply = candidates.length === 0
    ? `I can use ${targetDate}, but I can't see a visible ${targetDomainLabel(retargeted.targetDomain)} item there. Which session or item do you mean?`
    : betterItemClarificationQuestion({
        targetDate,
        answer: input.userMessage,
        options,
      });
  retargeted = pendingSlotClarificationEdit(
    {
      ...retargeted,
      candidateItems: candidates,
    } as ProgramEdit,
    ['targetItemId'],
    reply,
    options,
  );
  return {
    kind: 'clarify',
    programEdit: retargeted,
    reply,
    options,
  };
}

function targetDateFromPendingAnswerClassification(args: {
  classification: PendingClarificationAnswerClassification;
  pending: PendingCoachClarifier;
  edit: ProgramEdit;
  todayISO?: string;
  currentWeek?: VisibleSessionRef[];
}): string | null {
  const { classification, pending, edit, todayISO, currentWeek } = args;
  if (classification.kind !== 'accept_proposed' && classification.kind !== 'choose_candidate') {
    return null;
  }
  const candidate = classification.candidate ?? pending.pendingClarification?.proposedCandidate;
  if (!candidate) return null;
  return targetDateFromPendingCandidate({
    candidate,
    pending,
    edit,
    todayISO,
    currentWeek,
  });
}

function targetDateFromPendingCandidate(args: {
  candidate: PendingClarificationProposedCandidate;
  pending: PendingCoachClarifier;
  edit: ProgramEdit;
  todayISO?: string;
  currentWeek?: VisibleSessionRef[];
}): string | null {
  const { candidate, pending, edit, todayISO, currentWeek } = args;
  if (candidate.answerType !== 'date') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate.value)) {
    return candidate.value;
  }
  return parsePendingTargetDateAnswer({
    message: candidate.value || candidate.label,
    todayISO,
    pending,
    edit,
    currentWeek,
  });
}

function targetItemFromPendingAnswerClassification(
  classification: PendingClarificationAnswerClassification,
  candidates: ProgramEditCandidateItem[],
): ProgramEditCandidateItem | null {
  if (classification.kind !== 'accept_proposed' && classification.kind !== 'choose_candidate') {
    return null;
  }
  const candidate = classification.candidate;
  if (!candidate || !['item', 'session'].includes(candidate.answerType)) {
    return null;
  }
  const normalizedValue = normalizeProgramEditMatchText(candidate.value);
  const normalizedLabel = normalizeProgramEditMatchText(candidate.label);
  return candidates.find((item) => {
    const id = normalizeProgramEditMatchText(item.id);
    const title = normalizeProgramEditMatchText(item.title);
    return (
      (!!normalizedValue && (normalizedValue === id || normalizedValue === title)) ||
      (!!normalizedLabel && normalizedLabel === title)
    );
  }) ?? null;
}

function normalizeProgramEditMatchText(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePendingTargetDateAnswer(args: {
  message: string;
  todayISO?: string;
  pending: PendingCoachClarifier;
  edit: ProgramEdit;
  currentWeek?: VisibleSessionRef[];
}): string | null {
  const text = String(args.message ?? '').toLowerCase();
  const todayISO = args.todayISO;
  if (todayISO && /\btoday\b/i.test(text)) return todayISO;
  if (todayISO && /\btomorrow\b/i.test(text)) return addDaysISO(todayISO, 1);

  const explicitDay = extractDayNames(args.message)[0];
  if (explicitDay && todayISO) {
    return nextDateForDay(todayISO, explicitDay, /\bnext\b/i.test(text));
  }

  const inferredDay = pendingDateSlotDay(args.pending, args.edit);
  if (inferredDay) {
    if (/\b(?:the\s+)?(?:next|upcoming|future)\s+one\b/i.test(text) && todayISO) {
      return nextDateForDay(todayISO, inferredDay, true);
    }
    if (/\b(?:this|current)\s+week\b|\bthe\s+one\s+(?:i'?m|im)\s+looking\s+at\b/i.test(text)) {
      return findVisibleWeekDateForDay(args.currentWeek, inferredDay);
    }
  }

  return null;
}

function pendingDateSlotDay(
  pending: PendingCoachClarifier,
  edit: ProgramEdit,
): DayOfWeek | null {
  const seed =
    pending.targetDate ??
    edit.targetDate ??
    (edit.command && 'target' in edit.command ? dateFromTarget(edit.command.target) : null);
  return seed ? dayNameFromISO(seed) : null;
}

function findVisibleWeekDateForDay(
  currentWeek: VisibleSessionRef[] | undefined,
  day: DayOfWeek,
): string | null {
  if (!currentWeek?.length) return null;
  const match = currentWeek.find((ref) => dayNameFromISO(ref.date) === day);
  return match?.date ?? null;
}

function retargetProgramEditDate(args: {
  edit: ProgramEdit;
  targetDate: string;
  visibleProgram: ResolvedVisibleProgramForDate;
}): ProgramEdit {
  const { edit, targetDate, visibleProgram } = args;
  const dateChanged = edit.targetDate !== targetDate;
  const targetSessionId = stringOrNull((visibleProgram.day.workout as any)?.id);
  const pendingDraft = pendingDraftFromProgramEdit(edit);
  const blockLevelEdit = isBlockLevelProgramEdit(edit);
  const shouldClearItem = dateChanged && programEditNeedsTargetItem(edit, pendingDraft);
  const command = retargetProgramEditCommandDate({
    command: edit.command,
    targetDate,
    sessionName: visibleProgram.day.workout?.name,
    clearTargetItem: shouldClearItem,
  });
  const draft = {
    ...((pendingDraft ?? edit) as ProgramEditDraft),
    intent: resumeIntentForPendingEdit(edit),
    targetDate,
    targetSessionId,
    targetItemId: shouldClearItem ? null : edit.targetItemId,
    targetItemTitle: shouldClearItem ? null : edit.targetItemTitle,
    missingFields: uniquePendingFields([
      ...edit.missingFields.filter((field) =>
        !isDateMissingField(field) &&
        !(blockLevelEdit && (isTargetItemMissingField(field) || isBlockTargetMissingFieldName(field))),
      ),
      ...(shouldClearItem ? ['targetItemId'] : []),
    ]),
    question: undefined,
    options: undefined,
    candidateItems: candidateItemsForDomain({
      items: visibleProgram.items,
      targetDomain: edit.targetDomain,
    }),
    command,
    confidence: Math.max(edit.confidence, 0.85),
    naturalLanguageReason: `${edit.naturalLanguageReason}; target date resolved from pending answer`,
    source: 'pending_clarifier',
  } as ProgramEditDraft;
  return finaliseProgramEditDraft(draft);
}

function retargetProgramEditCommandDate(args: {
  command: CoachCommand | null;
  targetDate: string;
  sessionName?: string;
  clearTargetItem: boolean;
}): CoachCommand | null {
  const { command, targetDate, sessionName, clearTargetItem } = args;
  if (!command || command.mode !== 'mutate') return command;
  const missingFields = (command.missingFields ?? []).filter((field) => !isDateMissingField(field));
  const target: CoachCommandTarget = {
    kind: 'date',
    date: targetDate,
    sessionName,
  };
  if (command.payload.operation === 'remove_conditioning') {
    return {
      ...command,
      target,
      payload: {
        ...command.payload,
        targetItemId: clearTargetItem ? undefined : command.payload.targetItemId,
      },
      missingFields,
      needsClarification: missingFields.length > 0,
      reason: `${command.reason}:pending_target_date_resolved`,
    };
  }
  if (command.payload.operation === 'add_conditioning') {
    return {
      ...command,
      target,
      payload: {
        ...command.payload,
        targetItemId: clearTargetItem ? undefined : command.payload.targetItemId,
      },
      missingFields,
      needsClarification: missingFields.length > 0,
      reason: `${command.reason}:pending_target_date_resolved`,
    };
  }
  return {
    ...command,
    target,
    missingFields,
    needsClarification: missingFields.length > 0,
    reason: `${command.reason}:pending_target_date_resolved`,
  };
}

function resumeIntentForPendingEdit(edit: ProgramEdit): ProgramEditIntent {
  if (edit.intent !== 'ask_question') return edit.intent;
  const pendingDraft = pendingDraftFromProgramEdit(edit);
  if (pendingDraft?.intent && pendingDraft.intent !== 'ask_question') {
    return pendingDraft.intent;
  }
  if (edit.command?.mode === 'mutate') return intentFromMutation(edit.command);
  return 'edit';
}

function pendingDraftFromProgramEdit(edit: ProgramEdit): ProgramEditDraft | undefined {
  return edit.intent === 'ask_question' && 'pendingEdit' in edit
    ? edit.pendingEdit
    : undefined;
}

function programEditNeedsTargetItem(
  edit: ProgramEdit,
  draft?: ProgramEditDraft,
): boolean {
  if (draft?.actionScope && isBlockLevelProgramEditDraft({
    intent: draft.intent as SemanticProgramEditDraftIntent,
    targetDomain: draft.targetDomain as SemanticProgramEditDraftTargetDomain,
    actionScope: draft.actionScope,
  })) return false;
  if (isBlockLevelProgramEdit(edit)) return false;
  if (
    edit.missingFields.some(isTargetItemMissingField)
  ) {
    return true;
  }
  return (
    edit.targetDomain !== 'session' &&
    edit.targetDomain !== 'schedule' &&
    edit.intent !== 'add' &&
    edit.intent !== 'explain' &&
    edit.intent !== 'ask_question'
  );
}

function targetDomainLabel(domain: ProgramEditTargetDomain): string {
  if (domain === 'conditioning') return 'conditioning';
  if (domain === 'strength') return 'strength';
  if (domain === 'recovery') return 'recovery';
  return 'program';
}

function isDateMissingField(field: string): boolean {
  return /^(?:targetDate|target_date|target_day|destination_date|destination_day|day|date)$/.test(field);
}

function isTargetItemMissingField(field: string): boolean {
  return isTargetItemMissingFieldName(field);
}

function isStrengthBlockLevelProgramEdit(edit: ProgramEdit): boolean {
  const editScope = 'editScope' in edit ? edit.editScope : undefined;
  return edit.targetDomain === 'strength' &&
    (editScope === 'remove_strength_block' || editScope === 'reduce_strength_block');
}

function isBlockLevelProgramEdit(edit: ProgramEdit): boolean {
  if (isStrengthBlockLevelProgramEdit(edit)) return true;
  const editScope = 'editScope' in edit ? edit.editScope : undefined;
  return edit.targetDomain === 'conditioning' &&
    edit.intent === 'remove' &&
    editScope === 'remove_conditioning_item' &&
    (edit as any).actionScope === 'conditioning_block';
}

function uniquePendingFields(fields: string[]): string[] {
  const out: string[] = [];
  for (const field of fields) {
    if (!field || out.includes(field)) continue;
    out.push(field);
  }
  return out;
}

function dayNameFromISO(iso: string): DayOfWeek {
  const [year, month, day] = iso.split('-').map(Number);
  return dayNameFromNumber(new Date(year, month - 1, day, 12, 0, 0, 0).getDay());
}

function nextDateForDay(todayISO: string, day: DayOfWeek, forceNext: boolean): string {
  const todayDow = isoDayNumber(todayISO);
  const targetDow = dayOfWeekNumber(day);
  let diff = (targetDow - todayDow + 7) % 7;
  if (forceNext || diff === 0) diff = diff === 0 ? 7 : diff;
  return addDaysISO(todayISO, diff);
}

function isoDayNumber(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).getDay();
}

function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

type PendingDurationScopeAnswer =
  | 'whole_session'
  | 'sprint_efforts'
  | 'recovery_between_reps'
  | null;

function resolvePendingDurationScopeAnswer(input: {
  edit: ProgramEdit;
  pending: PendingCoachClarifier;
  userMessage: string;
}): PendingProgramEditAnswerResult {
  const scope = classifyPendingDurationScopeAnswer(input.userMessage);
  if (scope === 'whole_session') {
    const completed = completeWholeSessionDurationScopeEdit(input.edit, input.pending);
    if (completed) {
      return { kind: 'complete', programEdit: completed };
    }
    const reply = 'How many minutes should the whole session be?';
    return {
      kind: 'clarify',
      programEdit: pendingSlotClarificationEdit(input.edit, ['duration'], reply),
      reply,
    };
  }

  if (scope === 'sprint_efforts') {
    const reply = 'How long should each sprint effort be? A duration like 20s or 30s works.';
    return {
      kind: 'clarify',
      programEdit: pendingSlotClarificationEdit(input.edit, ['reps_duration'], reply),
      reply,
    };
  }

  if (scope === 'recovery_between_reps') {
    const reply = 'How much recovery should there be between reps? A duration like 90s or 2 min works.';
    return {
      kind: 'clarify',
      programEdit: pendingSlotClarificationEdit(input.edit, ['rest_duration'], reply),
      reply,
    };
  }

  const options = input.edit.options?.length
    ? input.edit.options
    : ['Whole session', 'Sprint effort length', 'Recovery between reps'];
  const reply =
    input.edit.question ??
    'Do you mean the whole session duration, the sprint effort length, or the recovery between reps?';
  return {
    kind: 'clarify',
    programEdit: pendingSlotClarificationEdit(input.edit, ['duration_scope'], reply, options),
    reply,
    options,
  };
}

function classifyPendingDurationScopeAnswer(message: string): PendingDurationScopeAnswer {
  const text = String(message ?? '').toLowerCase();
  if (!text.trim()) return null;
  const mentionsRecovery =
    /\b(?:recovery|recover|rest|resting|between\s+reps|between\s+efforts|off\s*time)\b/i.test(text);
  const mentionsSprintEffort =
    /\b(?:sprints?|sprint\s+efforts?|effort\s+length|efforts?|work\s+reps?|rep\s+length|each\s+sprint|interval\s+length)\b/i.test(text);
  const mentionsWhole =
    /\b(?:whole|entire|total|overall|full)\b/i.test(text) || /\bsession\b/i.test(text);
  const rejectsSprintEffort =
    /\bnot\s+(?:the\s+)?(?:reps?|sprints?|sprint\s+efforts?|efforts?|work\s+reps?)\b/i.test(text);
  if (mentionsWhole && rejectsSprintEffort) {
    return 'whole_session';
  }
  if (mentionsRecovery) {
    return 'recovery_between_reps';
  }
  if (mentionsSprintEffort) {
    return 'sprint_efforts';
  }
  if (mentionsWhole) {
    return 'whole_session';
  }
  return null;
}

function completeWholeSessionDurationScopeEdit(
  edit: ProgramEdit,
  pending: PendingCoachClarifier,
): ProgramEdit | null {
  const command =
    edit.command?.mode === 'mutate' &&
    edit.command.operation === 'add_conditioning' &&
    edit.command.payload.operation === 'add_conditioning'
      ? edit.command
      : null;
  if (!command || edit.targetDomain !== 'conditioning' || !edit.targetDate || !edit.targetItemId) {
    return null;
  }

  const payload = command.payload as AddConditioningMutatePayload;
  const value = conditioningValueFromDraft(edit as ProgramEditDraft);
  const durationMinutes =
    numberOrUndefined(payload.durationMinutes) ??
    numberOrUndefined(value.durationMinutes) ??
    parseCoachDurationMinutes(pending.originalMessage ?? '') ??
    parseCoachDurationMinutes(edit.question ?? '');
  if (!durationMinutes) {
    return null;
  }

  const requestedEasy = pendingOriginalMessageRequestsEasySession(pending.originalMessage ?? '');
  const nextActivity = wholeSessionDurationActivityTitle({
    modality: payload.modality ?? conditioningModalityFromValue(value),
    bikeLabel: payload.bikeLabel,
    targetItemTitle: edit.targetItemTitle,
    activity: payload.customActivity ?? stringOrNull(value.activity),
  });
  const nextPayload: AddConditioningMutatePayload = {
    ...payload,
    customActivity: nextActivity,
    intensity: requestedEasy || payload.intensity === 'hard'
      ? 'light' as const
      : payload.intensity ?? 'light' as const,
    durationMinutes,
    sets: 1,
    repsMin: undefined,
    repsMax: undefined,
    restSeconds: 0,
    prescriptionType: 'duration_minutes' as const,
    bikeLabel: payload.bikeLabel,
    effortKind: undefined,
    replaceActivity: payload.replaceActivity ?? edit.targetItemTitle ?? payload.customActivity,
    trainingIntent:
      requestedEasy || payload.trainingIntent === 'sprint' || !payload.trainingIntent
        ? 'low_load' as const
        : payload.trainingIntent,
    editMode: 'update_existing' as const,
    editScope: 'replace_conditioning_prescription' as const,
    targetItemId: edit.targetItemId,
  };
  const nextCommand: MutateCoachCommand = {
    ...command,
    payload: nextPayload,
    needsClarification: false,
    missingFields: [],
    clarificationQuestion: undefined,
    confidence: Math.max(command.confidence, 0.9),
    reason: `${command.reason}:duration_scope_whole_session`,
  };

  return finaliseProgramEditDraft({
    ...edit,
    intent: 'replace',
    targetDomain: 'conditioning',
    requestedChange: 'type',
    targetDate: edit.targetDate,
    targetItemId: edit.targetItemId,
    targetItemTitle: edit.targetItemTitle,
    newValue: newValueFromPayload(nextPayload),
    missingFields: [],
    confidence: Math.max(edit.confidence, 0.9),
    naturalLanguageReason: nextCommand.reason,
    question: undefined,
    options: undefined,
    editScope: 'replace_conditioning_prescription',
    command: nextCommand,
    source: 'pending_clarifier',
  });
}

function pendingSlotClarificationEdit(
  edit: ProgramEdit,
  fields: string[],
  reply: string,
  options?: string[],
): ProgramEdit {
  return askQuestionFromDraft({
    ...edit,
    intent: 'ask_question',
    missingFields: fields,
    question: reply,
    options,
    source: 'pending_clarifier',
  }, fields);
}

function pendingOriginalMessageRequestsEasySession(message: string): boolean {
  return /\b(?:easy|light|gentle|recovery|flush|low[-\s]*load|low[-\s]*impact|zone\s*2|z2|conversational)\b/i.test(message);
}

function wholeSessionDurationActivityTitle(input: {
  modality: ConditioningIntentModality | null;
  bikeLabel?: unknown;
  targetItemTitle?: string | null;
  activity?: string | null;
}): string {
  const mode = wholeSessionDurationModeLabel(input);
  return mode ? `Easy ${mode}` : 'Easy Conditioning';
}

function wholeSessionDurationModeLabel(input: {
  modality: ConditioningIntentModality | null;
  bikeLabel?: unknown;
  targetItemTitle?: string | null;
  activity?: string | null;
}): string | null {
  const text = `${input.activity ?? ''} ${input.targetItemTitle ?? ''}`.toLowerCase();
  if (String(input.bikeLabel ?? '').toLowerCase() === 'assault' || /\b(?:assault|air)\s+bike\b/i.test(text)) {
    return 'Assault Bike';
  }
  switch (input.modality) {
    case 'bike':
      return 'Bike';
    case 'row':
      return 'Rower';
    case 'ski':
      return 'SkiErg';
    case 'run':
      return 'Run';
    case 'swim':
      return 'Swim';
    case 'walk':
      return 'Walk';
    case 'aerobic':
      return 'Aerobic Conditioning';
    case 'cardio':
    case 'mixed':
    case 'sprint':
      return 'Conditioning';
    case null:
      return null;
    default:
      return assertNever(input.modality);
  }
}

function repairExplicitScheduleMoveCommand(
  command: CoachCommand,
  input: InterpretCoachMessageToProgramEditInput & { normalizedMessage?: string },
): CoachCommand {
  if (command.mode !== 'mutate' || command.operation !== 'move_session') return command;
  if (command.payload.operation !== 'move_session') return command;
  const pair = parseExplicitScheduleMoveWeekdays(input.normalizedMessage ?? input.userMessage);
  if (!pair) return command;

  const sourceVisible = visibleSessionForDow(input.currentWeek, pair.sourceDow);
  const targetVisible = visibleSessionForDow(input.currentWeek, pair.targetDow);
  const message = input.normalizedMessage ?? input.userMessage;
  const wantsViewedWeek = scheduleMoveUsesViewedWeek(message);
  const wantsNextWeek = scheduleMoveUsesNextWeek(message);
  const visibleDatesHavePassed =
    !wantsViewedWeek &&
    !pair.sourceExplicitNext &&
    !pair.targetExplicitNext &&
    !wantsNextWeek &&
    ((!!sourceVisible?.date && sourceVisible.date < input.todayISO) ||
      (!!targetVisible?.date && targetVisible.date < input.todayISO));
  const useUpcomingDates =
    pair.sourceExplicitNext || pair.targetExplicitNext || wantsNextWeek || visibleDatesHavePassed;
  const originalSourceDate =
    command.target.kind === 'date' && dowFromISO(command.target.date) === pair.sourceDow
      ? command.target.date
      : null;
  const originalTargetDate =
    command.payload.toDate && dowFromISO(command.payload.toDate) === pair.targetDow
      ? command.payload.toDate
      : null;
  const sourceDate =
    useUpcomingDates
      ? nextISOForDow(input.todayISO, pair.sourceDow)
      : sourceVisible?.date ??
        originalSourceDate ??
        nextISOForDow(input.todayISO, pair.sourceDow);
  const toDate =
    useUpcomingDates
      ? nextISOForDow(input.todayISO, pair.targetDow)
      : targetVisible?.date ??
        originalTargetDate ??
        nextISOForDow(input.todayISO, pair.targetDow);
  const sourceDay = dayNameFromDow(pair.sourceDow);
  const targetDay = dayNameFromDow(pair.targetDow);
  const resolvedSourceVisible = resolveVisibleProgramForDateFromInputs({
    targetDate: sourceDate,
    currentWeek: input.currentWeek,
    resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
  });
  const resolvedTargetVisible = resolveVisibleProgramForDateFromInputs({
    targetDate: toDate,
    currentWeek: input.currentWeek,
    resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
  });
  const sourceSession = visibleSessionRefFromResolved(
    sourceDate,
    resolvedSourceVisible,
    `${sourceDay} session`,
  );
  const targetSession = visibleSessionRefFromResolved(
    toDate,
    resolvedTargetVisible,
    `${targetDay} session`,
  );
  const sourceSessionName =
    sourceSession?.workout?.name ??
    (command.target.kind === 'date' && originalSourceDate ? command.target.sessionName : undefined);
  const sourceHasWorkout = !!sourceSession?.workout && !isRestOrEmptyWorkout(sourceSession.workout);
  const targetHasWorkout = !!targetSession?.workout && !isRestOrEmptyWorkout(targetSession.workout);
  const explicitOneOff =
    /\b(?:this\s+week|today\s+only|just\s+this\s+once|just\s+this\s+week|this\s+once|one[-\s]?off|only\s+this\s+week)\b/i.test(
      message,
    );
  const shouldClarify = sourceHasWorkout && (targetHasWorkout || !explicitOneOff);
  const repairedPayload: Extract<CoachMutatePayload, { operation: 'move_session' }> = {
    ...command.payload,
    operation: 'move_session',
    fromDow: pair.sourceDow,
    toDate,
    toDow: pair.targetDow,
    moveScope: command.payload.moveScope ?? 'one_off',
  };
  const repaired: Extract<CoachCommand, { mode: 'mutate' }> = {
    ...command,
    target: {
      kind: 'date',
      date: sourceDate,
      sessionName: sourceSessionName,
    },
    payload: repairedPayload,
    needsClarification: shouldClarify,
    clarificationQuestion: shouldClarify
      ? targetHasWorkout
        ? `${targetDay} already has ${scheduleMoveSessionSummary(targetSession, `${targetDay} session`)}. Do you want to replace it, swap the two days, or cancel?`
        : `Move ${useUpcomingDates ? `next ${sourceDay}` : sourceDay}'s ${scheduleMoveSessionSummary(sourceSession, sourceSessionName ?? 'session')} to ${targetDay}${useUpcomingDates ? '' : ' this week'}?`
      : command.clarificationQuestion,
    options: shouldClarify
      ? targetHasWorkout
        ? [`Replace ${targetDay}`, 'Swap the two days', 'Cancel']
        : ['Yes', 'No']
      : command.options,
    missingFields: shouldClarify
      ? [targetHasWorkout ? 'conflict_resolution' : 'confirmation']
      : command.missingFields,
    reason:
      command.reason === 'move_verb_detected' || command.reason === 'put_on_day_move_detected'
        ? 'explicit_weekday_move_repaired'
        : command.reason,
  };
  logger.debug('[coach-schedule-move-program-edit-repair]', {
    rawUserMessage: input.userMessage,
    parsedSourceWeekday: sourceDay,
    parsedTargetWeekday: targetDay,
    visibleWeekStart: visibleWeekStart(input.currentWeek),
    resolvedFromDate: sourceDate,
    resolvedToDate: toDate,
    dateResolutionDefault: visibleDatesHavePassed
      ? 'next_upcoming_due_past_visible_week'
      : wantsViewedWeek
        ? 'visible_week_requested'
        : wantsNextWeek || pair.sourceExplicitNext || pair.targetExplicitNext
          ? 'next_upcoming_requested'
          : 'visible_week_or_today',
    sourceSessionFound: sourceHasWorkout,
    targetStatus: targetSession ? (targetHasWorkout ? 'session' : 'rest') : 'missing',
    pendingTransactionPayload: repairedPayload,
    originalTarget:
      command.target.kind === 'date'
        ? { date: command.target.date, sessionName: command.target.sessionName ?? null }
        : { kind: command.target.kind },
  });
  return repaired;
}

function parseExplicitScheduleMoveWeekdays(message: string): {
  sourceDow: number;
  targetDow: number;
  sourceExplicitNext: boolean;
  targetExplicitNext: boolean;
} | null {
  const day =
    '((?:next\\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun))';
  const patterns = [
    new RegExp(
      `\\b(?:move|shift|push|reschedul\\w*|bump)\\s+(?:all\\s+of\\s+)?(?:my\\s+|the\\s+)?${day}(?:'s)?\\s*(?:session|workout|day)?\\s+(?:to|onto|on)\\s+${day}\\b`,
      'i',
    ),
    new RegExp(
      `\\b(?:can\\s+we\\s+)?(?:do|put)\\s+(?:all\\s+of\\s+)?(?:my\\s+|the\\s+)?${day}(?:'s)?\\s*(?:session|workout|day)?\\s+(?:on|to)\\s+${day}\\b`,
      'i',
    ),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (!match) continue;
    const sourceDow = dowFromDayToken(match[1]);
    const targetDow = dowFromDayToken(match[2]);
    if (sourceDow !== null && targetDow !== null && sourceDow !== targetDow) {
      return {
        sourceDow,
        targetDow,
        sourceExplicitNext: /\bnext\s+/i.test(match[1]),
        targetExplicitNext: /\bnext\s+/i.test(match[2]),
      };
    }
  }
  const better = new RegExp(
    `\\b${day}\\s+(?:works\\s+better|is\\s+better|would\\s+be\\s+better)\\s+(?:than|instead\\s+of)\\s+${day}\\b`,
    'i',
  ).exec(message);
  if (better) {
    const targetDow = dowFromDayToken(better[1]);
    const sourceDow = dowFromDayToken(better[2]);
    if (sourceDow !== null && targetDow !== null && sourceDow !== targetDow) {
      return {
        sourceDow,
        targetDow,
        sourceExplicitNext: /\bnext\s+/i.test(better[2]),
        targetExplicitNext: /\bnext\s+/i.test(better[1]),
      };
    }
  }
  return null;
}

function dowFromDayToken(token: string | undefined): number | null {
  const raw = String(token ?? '').toLowerCase().replace(/\bnext\s+/i, '').trim();
  if (raw.startsWith('sun')) return 0;
  if (raw.startsWith('mon')) return 1;
  if (raw.startsWith('tue')) return 2;
  if (raw.startsWith('wed')) return 3;
  if (raw.startsWith('thu')) return 4;
  if (raw.startsWith('fri')) return 5;
  if (raw.startsWith('sat')) return 6;
  return null;
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

function dowFromISO(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay();
}

function nextISOForDow(todayISO: string, dow: number): string {
  const t = new Date(`${todayISO}T12:00:00`);
  const todayDow = t.getDay();
  const delta = ((dow - todayDow) + 7) % 7 || 7;
  const d = new Date(t.getTime() + delta * 86_400_000);
  return isoFromDate(d);
}

function scheduleMoveUsesViewedWeek(message: string): boolean {
  return /\b(?:this\s+(?:viewed\s+)?week|the\s+week\s+i'?m\s+looking\s+at|the\s+week\s+i\s+am\s+looking\s+at|that\s+week|viewed\s+week|currently\s+viewed\s+week)\b/i.test(
    message,
  );
}

function scheduleMoveUsesNextWeek(message: string): boolean {
  return /\bnext\s+week\b/i.test(message);
}

function visibleSessionForDow(
  currentWeek: VisibleSessionRef[] | undefined,
  dow: number,
): VisibleSessionRef | null {
  return (currentWeek ?? []).find((day) => dowFromISO(day.date) === dow) ?? null;
}

function visibleSessionRefFromResolved(
  date: string,
  resolved: ResolvedVisibleProgramForDate,
  fallbackName: string,
): VisibleSessionRef | null {
  const workout = resolved.day.workout;
  if (!workout) return null;
  const sessionName = String(workout.name ?? fallbackName).trim() || fallbackName;
  return {
    date,
    sessionName,
    workout: workout as VisibleSessionRef['workout'],
  };
}

function visibleWeekStart(currentWeek: VisibleSessionRef[] | undefined): string | null {
  const dates = (currentWeek ?? [])
    .map((day) => day.date)
    .filter(Boolean)
    .sort();
  return dates[0] ?? null;
}

function isRestOrEmptyWorkout(workout: VisibleSessionRef['workout'] | null | undefined): boolean {
  if (!workout) return true;
  const name = String(workout.name ?? '').trim();
  const type = String(workout.workoutType ?? '').trim();
  const tier = String(workout.sessionTier ?? '').trim();
  return /^(rest|rest day)$/i.test(name) || /^rest$/i.test(type) || /^rest$/i.test(tier);
}

function scheduleMoveSessionSummary(session: VisibleSessionRef | null, fallback: string): string {
  const workout = session?.workout;
  const base = String(workout?.name ?? session?.sessionName ?? fallback).trim() || fallback;
  const conditioningTitle = workout?.conditioningBlock?.options
    ?.map((option) => String(option.title ?? '').trim())
    .find(Boolean);
  if (conditioningTitle && conditioningTitle.toLowerCase() !== base.toLowerCase()) {
    return `${base} + ${conditioningTitle}`;
  }
  return base;
}

export function programEditFromCoachCommand(
  command: CoachCommand,
  input: InterpretCoachMessageToProgramEditInput & {
    normalizedMessage?: string;
  },
): ProgramEdit {
  command = repairExplicitScheduleMoveCommand(command, input);
  const targetDate = targetDateFromCommand(command) ?? input.referenceResolution?.target?.date ?? null;
  const visibleProgram = targetDate
    ? resolveVisibleProgramForDateFromInputs({
        targetDate,
        currentWeek: input.currentWeek,
        resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
      })
    : null;
  const visibleDay = visibleProgram?.day
    ? {
        date: visibleProgram.day.date,
        sessionName: visibleProgram.day.workout?.name ?? 'session',
        workout: visibleProgram.day.workout,
      }
    : undefined;
  const targetSessionId = stringOrNull((visibleDay?.workout as any)?.id);
  const base = baseEdit(command, targetDate, targetSessionId, input);

  if (command.mode === 'mutate' && command.operation === 'update_program_setup') {
    const payload = command.payload.operation === 'update_program_setup'
      ? command.payload
      : null;
    if (payload) {
      return buildProgramSetupEdit({
        message: input.normalizedMessage ?? input.userMessage,
        requestedChange: payload.availabilityConstraints?.length ? 'duration' : 'day',
        setupChange: {
          addTrainingDays: payload.addTrainingDays,
          removeTrainingDays: payload.removeTrainingDays,
          replaceTrainingDays: payload.replaceTrainingDays,
          trainingDaysPerWeek: payload.trainingDaysPerWeek,
          clearUnavailableDays: payload.clearUnavailableDays,
          availabilityConstraints: payload.availabilityConstraints,
          summary: payload.summary ?? 'update program setup',
        },
      });
    }
  }

  if (command.mode === 'clarify') {
    return finaliseProgramEditDraft({
      ...base,
      intent: 'ask_question',
      requestedChange: requestedChangeFromMissing(command.missingFields ?? []),
      missingFields: command.missingFields ?? ['unknown'],
      naturalLanguageReason: command.reason,
      question: command.question,
      options: command.options,
      command,
    });
  }

  if (command.mode === 'conversation' || command.mode === 'explain' || command.mode === 'inspect_state') {
    return finaliseProgramEditDraft({
      ...base,
      intent: 'explain',
      targetDomain: command.mode === 'inspect_state' ? 'session' : base.targetDomain,
      requestedChange: 'unknown',
      naturalLanguageReason: command.reason,
      command,
    });
  }

  if (command.mode === 'reject' || command.mode === 'reject_with_reason') {
    return finaliseProgramEditDraft({
      ...base,
      intent: 'ask_question',
      requestedChange: 'unknown',
      missingFields: ['supported_change'],
      naturalLanguageReason: command.reason,
      question: command.reply,
      options: command.suggestedAlternatives,
      command,
    });
  }

  let mutateCommand = command as MutateCoachCommand;
  let payload = mutateCommand.payload;
  const workout = (visibleDay?.workout ?? null) as ResolvedDay['workout'] | null;
  const targetDomain = targetDomainFromMutation(mutateCommand, workout);
  const requestedChange = requestedChangeFromMutation(mutateCommand);
  const intent = isClearAppendRequest(input.userMessage, mutateCommand)
    ? 'add'
    : intentFromMutation(mutateCommand);
  const item = resolveTargetItem({
    command: mutateCommand,
    targetDate,
    visibleItems: visibleProgram?.items ?? [],
    intent,
    targetDomain,
  });
  const itemId = item && 'id' in item ? item.id : null;
  const itemTitle = item && 'title' in item ? item.title : null;
  const options = item && 'ambiguousOptions' in item ? item.ambiguousOptions : undefined;
  const questionOverride = item && 'question' in item ? item.question : undefined;
  const candidateItems = candidateItemsForDomain({
    items: visibleProgram?.items ?? [],
    targetDomain,
  });
  if (item && 'id' in item) {
    mutateCommand = completeCommandTargetItem(mutateCommand, item);
    payload = mutateCommand.payload;
  }
  const missingFields = new Set<string>(mutateCommand.missingFields ?? []);
  if (!targetDate && mutateCommand.target.kind !== 'last_change') {
    missingFields.add('targetDate');
  }
  if (
    (intent === 'edit' || intent === 'remove' || intent === 'replace') &&
    targetDomain !== 'session' &&
    !itemId
  ) {
    missingFields.add('targetItemId');
  }

  const asksForSource = missingFields.has('targetItemId');

  const produced = finaliseProgramEditDraft({
    ...base,
    intent: asksForSource ? 'ask_question' : intent,
    targetDomain,
    requestedChange,
    targetItemId: itemId,
    targetItemTitle: itemTitle,
    newValue: newValueFromPayload(payload),
    missingFields: [...missingFields],
    confidence: mutateCommand.confidence,
    naturalLanguageReason: mutateCommand.reason,
    question: asksForSource
      ? questionOverride ?? sourceClarificationQuestion(targetDate, options)
      : mutateCommand.clarificationQuestion,
    options: asksForSource ? options : mutateCommand.options ?? options,
    candidateItems,
    editScope: editScopeFromPayload(payload),
    command: mutateCommand,
  });
  logger.debug('[coach-program-edit-produced]', {
    targetDate,
    targetDateResolvedFrom: command.mode === 'mutate' ? command.target.kind : command.mode,
    visibleSource: visibleProgram?.source ?? null,
    visibleWorkoutName: visibleProgram?.day.workout?.name ?? null,
    visibleItems: (visibleProgram?.items ?? []).map(candidateLogPayload),
    candidateItems: candidateItems.map(candidateLogPayload),
    exactlyOneCandidate: candidateItems.length === 1,
    intent: produced.intent,
    targetDomain: produced.targetDomain,
    requestedChange: produced.requestedChange,
    targetItemId: produced.targetItemId,
    targetItemTitle: produced.targetItemTitle,
    newValue: produced.newValue,
    missingFields: produced.missingFields,
  });
  return produced;
}

function finaliseProgramEditDraft(draft: ProgramEditDraft): ProgramEdit {
  if (draft.intent === 'ask_question') {
    return askQuestionFromDraft(draft, draft.missingFields);
  }

  if (draft.intent === 'explain') {
    return {
      ...draft,
      intent: 'explain',
    };
  }

  if (draft.targetDomain === 'conditioning') {
    return finaliseConditioningProgramEdit(draft);
  }

  if (
    draft.targetDomain === 'session' &&
    draft.intent === 'add' &&
    draft.editScope === 'add_whole_session'
  ) {
    return finaliseAddSessionProgramEdit(draft);
  }

  if (
    draft.targetDomain === 'session' &&
    draft.intent === 'remove' &&
    draft.editScope === 'remove_whole_session'
  ) {
    return finaliseRemoveSessionProgramEdit(draft);
  }

  if (
    draft.targetDomain === 'strength' &&
    (draft.editScope === 'remove_strength_block' || draft.editScope === 'reduce_strength_block')
  ) {
    return finaliseStrengthBlockProgramEdit(draft);
  }

  return {
    ...draft,
    targetDomain: draft.targetDomain as Exclude<ProgramEditTargetDomain, 'conditioning'>,
    intent: draft.intent as Exclude<ProgramEditIntent, 'ask_question' | 'explain'>,
    editScope: undefined as never,
  };
}

export function programEditFromSemanticProgramEditDraft(input: {
  draft: SemanticProgramEditDraft;
  userMessage: string;
  todayISO: string;
  resolveVisibleProgramForDate?: ResolveVisibleProgramForDate;
}): ProgramEdit {
  const semanticDraft = resolveBlockLevelProgramEditDraftTarget({
    draft: input.draft,
    resolveVisibleProgramForDate: input.resolveVisibleProgramForDate,
  });
  const { draft } = semanticDraft;
  const targetDomain = programEditDomainFromSemanticDraft(draft.targetDomain);
  const intent = programEditIntentFromSemanticDraft(draft.intent);
  const requestedChange = requestedChangeFromSemanticDraft(draft);
  const editScope = editScopeFromSemanticDraft(draft);
  const command = commandFromSemanticDraft(draft, editScope);
  const missingFields = semanticProgramEditMissingFields(draft, command, editScope);
  const question = missingFields.length > 0
    ? semanticDraft.question ?? semanticDraftClarificationQuestion(draft, missingFields)
    : undefined;

  return finaliseProgramEditDraft({
    actionScope: draft.actionScope,
    sourceTarget: draft.sourceTarget,
    explicitDateRole: draft.explicitDateRole,
    explicitUserWording: draft.explicitUserWording,
    protectedTargets: draft.protectedTargets,
    constraints: draft.constraints,
    proposedActions: draft.proposedActions,
    verifierExpectations: draft.verifierExpectations,
    isCompound: draft.isCompound,
    reason: draft.reason,
    targetDate: draft.targetDate,
    targetSessionId: draft.targetSessionId,
    targetItemId: draft.targetItemId,
    targetDomain,
    intent: missingFields.length > 0 ? 'ask_question' : intent,
    requestedChange,
    newValue: semanticDraftNewValue(draft),
    missingFields,
    confidence: draft.confidence,
    naturalLanguageReason: `semantic_program_edit_draft:${draft.reason}`,
    command,
    question,
    options: semanticDraft.options ?? semanticDraftClarificationOptions(draft, missingFields),
    targetItemTitle: draft.sourceTarget?.itemTitle ?? null,
    editScope,
    source: 'semantic_draft',
  });
}

function resolveBlockLevelProgramEditDraftTarget(input: {
  draft: SemanticProgramEditDraft;
  resolveVisibleProgramForDate?: ResolveVisibleProgramForDate;
}): {
  draft: SemanticProgramEditDraft;
  question?: string;
  options?: string[];
} {
  const { draft } = input;
  const editScope = editScopeFromSemanticDraft(draft);
  const blockConfig = blockLevelResolverConfig(draft, editScope);
  if (!blockConfig) {
    emitProgramEditDiagnostic('block_level_resolver_skipped', {
      intent: draft.intent,
      targetDomain: draft.targetDomain,
      actionScope: draft.actionScope,
      editScope: editScope ?? null,
      targetDate: draft.targetDate,
      missingFields: draft.missingFields,
    });
    return { draft };
  }

  const withoutItemField = {
    ...draft,
    targetItemId: blockConfig.carriesTargetItemId ? draft.targetItemId : null,
    missingFields: draft.missingFields.filter((field) =>
      !isTargetItemMissingField(field) &&
      !isBlockTargetMissingFieldName(field),
    ),
    proposedActions: draft.proposedActions.map((action) => ({
      ...action,
      targetItemId: blockConfig.carriesTargetItemId ? action.targetItemId : null,
    })),
  };
  if (!withoutItemField.targetDate) {
    emitProgramEditDiagnostic(`${blockConfig.diagnosticPrefix}_block_resolver_ran`, {
      targetDate: null,
      candidateCount: 0,
      candidates: [],
      missingFieldsBefore: draft.missingFields,
      missingFieldsAfter: withoutItemField.missingFields,
      resolved: false,
      reason: 'missing_target_date',
    });
    return { draft: withoutItemField };
  }

  if (blockConfig.kind === 'whole_session') {
    emitProgramEditDiagnostic('whole_session_block_resolver_ran', {
      targetDate: withoutItemField.targetDate,
      missingFieldsBefore: draft.missingFields,
      missingFieldsAfter: withoutItemField.missingFields,
      resolved: true,
    });
    return { draft: withoutItemField };
  }

  const visibleProgram = input.resolveVisibleProgramForDate?.(withoutItemField.targetDate) ?? null;
  const blockTargets = visibleBlockTargetsForConfig(visibleProgram, blockConfig);
  emitProgramEditDiagnostic(`${blockConfig.diagnosticPrefix}_block_resolver_ran`, {
    targetDate: withoutItemField.targetDate,
    visibleWorkoutName: visibleProgram?.day.workout?.name ?? null,
    candidateCount: blockTargets.length,
    candidates: blockTargets.map((target) => ({
      id: target.id,
      title: target.title,
      domain: target.domain,
      source: target.source,
    })),
    missingFieldsBefore: draft.missingFields,
    missingFieldsAfter: withoutItemField.missingFields,
    resolved: blockTargets.length === 1 || (blockTargets.length === 0 && blockConfig.kind === 'strength'),
  });
  if (blockTargets.length > 1) {
    const options = blockTargets.map((target) => target.title);
    return {
      draft: {
        ...withoutItemField,
        missingFields: uniquePendingFields([
          ...withoutItemField.missingFields,
          blockConfig.ambiguousField,
        ]),
      },
      question: typedBlockClarificationQuestion(blockConfig, withoutItemField.targetDate, options),
      options,
    };
  }

  if (blockTargets.length === 0 && blockConfig.kind !== 'strength') {
    return {
      draft: {
        ...withoutItemField,
        targetItemId: null,
        missingFields: uniquePendingFields([
          ...withoutItemField.missingFields,
          blockConfig.notFoundField,
        ]),
      },
      question: typedBlockNotFoundMessage(blockConfig, withoutItemField.targetDate),
      options: ['Leave unchanged'],
    };
  }

  const resolvedTarget = blockTargets[0] ?? null;
  const resolvedItemId = blockConfig.carriesTargetItemId
    ? resolvedTarget?.id ?? withoutItemField.targetItemId
    : null;
  const resolvedProposedActions = withoutItemField.proposedActions.map((action) => ({
    ...action,
    targetItemId: blockConfig.carriesTargetItemId ? resolvedItemId ?? null : action.targetItemId,
  }));

  const workoutId = stringOrNull((visibleProgram?.day.workout as any)?.id);
  return {
    draft: {
      ...withoutItemField,
      targetItemId: resolvedItemId ?? null,
      proposedActions: resolvedProposedActions,
      targetSessionId: withoutItemField.targetSessionId ?? workoutId,
      sourceTarget: withoutItemField.sourceTarget
        ? {
            ...withoutItemField.sourceTarget,
            itemId: withoutItemField.sourceTarget.itemId ?? resolvedItemId ?? workoutId ?? undefined,
            itemTitle:
              withoutItemField.sourceTarget.itemTitle ??
              resolvedTarget?.title,
            sessionName:
              withoutItemField.sourceTarget.sessionName ??
              visibleProgram?.day.workout?.name,
          }
        : withoutItemField.sourceTarget,
    },
  };
}

type BlockLevelResolverKind = 'strength' | 'conditioning' | 'recovery' | 'whole_session';

interface BlockLevelResolverConfig {
  kind: BlockLevelResolverKind;
  diagnosticPrefix: string;
  ambiguousField: string;
  notFoundField: string;
  label: string;
  carriesTargetItemId: boolean;
}

function blockLevelResolverConfig(
  draft: SemanticProgramEditDraft,
  editScope: ProgramEditEditScope | undefined,
): BlockLevelResolverConfig | null {
  if (!isBlockLevelProgramEditDraft(draft)) return null;
  if (
    draft.targetDomain === 'strength' &&
    draft.actionScope === 'strength_block' &&
    (editScope === 'remove_strength_block' || editScope === 'reduce_strength_block')
  ) {
    return {
      kind: 'strength',
      diagnosticPrefix: 'strength',
      ambiguousField: 'strengthBlockTarget',
      notFoundField: 'strengthBlockNotFound',
      label: 'strength',
      carriesTargetItemId: false,
    };
  }
  if (
    draft.targetDomain === 'conditioning' &&
    draft.actionScope === 'conditioning_block'
  ) {
    return {
      kind: 'conditioning',
      diagnosticPrefix: 'conditioning',
      ambiguousField: 'conditioningBlockTarget',
      notFoundField: 'conditioningBlockNotFound',
      label: 'conditioning',
      carriesTargetItemId: false,
    };
  }
  if (
    draft.targetDomain === 'recovery' &&
    draft.actionScope === 'conditioning_block'
  ) {
    return {
      kind: 'recovery',
      diagnosticPrefix: 'recovery',
      ambiguousField: 'recoveryBlockTarget',
      notFoundField: 'recoveryBlockNotFound',
      label: 'recovery',
      carriesTargetItemId: false,
    };
  }
  if (draft.actionScope === 'whole_session') {
    return {
      kind: 'whole_session',
      diagnosticPrefix: 'whole_session',
      ambiguousField: 'sessionTarget',
      notFoundField: 'sessionNotFound',
      label: 'session',
      carriesTargetItemId: false,
    };
  }
  return null;
}

function visibleBlockTargetsForConfig(
  visibleProgram: ResolvedVisibleProgramForDate | null,
  config: BlockLevelResolverConfig,
): ProgramEditCandidateItem[] {
  if (config.kind === 'strength') return visibleStrengthBlockTargets(visibleProgram);
  if (config.kind === 'conditioning' || config.kind === 'recovery') {
    return visibleConditioningBlockTargets(visibleProgram, config.kind);
  }
  return [];
}

function visibleStrengthBlockTargets(
  visibleProgram: ResolvedVisibleProgramForDate | null,
): ProgramEditCandidateItem[] {
  if (!visibleProgram?.day.workout) return [];
  const strengthItems = visibleProgram.strengthItems.length > 0
    ? visibleProgram.strengthItems
    : visibleProgram.items.filter((item) => item.domain === 'strength');
  if (strengthItems.length === 0) return [];

  const explicitBlockItems = strengthItems.filter((item) =>
    item.source !== 'strength_exercise',
  );
  const childExerciseItems = strengthItems.filter((item) =>
    item.source === 'strength_exercise',
  );
  if (childExerciseItems.length > 0) {
    return [visibleWorkoutBlockTarget(visibleProgram, 'strength', 'Strength block')];
  }
  if (explicitBlockItems.length > 1) return explicitBlockItems;
  if (explicitBlockItems.length === 1) return explicitBlockItems;

  return [visibleWorkoutBlockTarget(visibleProgram, 'strength', 'Strength block')];
}

function visibleConditioningBlockTargets(
  visibleProgram: ResolvedVisibleProgramForDate | null,
  domain: 'conditioning' | 'recovery',
): ProgramEditCandidateItem[] {
  if (!visibleProgram?.day.workout) return [];
  const conditioningItems = visibleProgram.conditioningItems.length > 0
    ? visibleProgram.conditioningItems
    : visibleProgram.items.filter((item) =>
      item.domain === 'conditioning' || item.domain === 'recovery',
    );
  const domainItems = conditioningItems.filter((item) => item.domain === domain);
  if (domainItems.length === 0) return [];

  const explicitBlockItems = domainItems.filter((item) => item.source === 'session');
  if (explicitBlockItems.length > 1) return explicitBlockItems;
  if (explicitBlockItems.length === 1 && domainItems.length === 1) return explicitBlockItems;

  return [visibleWorkoutBlockTarget(
    visibleProgram,
    domain,
    domain === 'recovery' ? 'Recovery block' : 'Conditioning block',
  )];
}

function visibleWorkoutBlockTarget(
  visibleProgram: ResolvedVisibleProgramForDate,
  domain: 'strength' | 'conditioning' | 'recovery',
  fallbackTitle: string,
): ProgramEditCandidateItem {
  const workout = visibleProgram.day.workout;
  const workoutId = stringOrNull((workout as any)?.id);
  return {
    id: workoutId ?? `${domain}-block:${visibleProgram.day.date}`,
    title: workout?.name || fallbackTitle,
    domain,
    modality: null,
    durationMinutes: null,
    source: 'session',
  };
}

function typedBlockClarificationQuestion(
  config: BlockLevelResolverConfig,
  targetDate: string,
  options: string[],
): string {
  const optionText = options.join(' or ');
  return optionText
    ? `Which ${config.label} block on ${targetDate} should I change: ${optionText}?`
    : `Which ${config.label} block on ${targetDate} should I change?`;
}

function typedBlockNotFoundMessage(
  config: BlockLevelResolverConfig,
  targetDate: string,
): string {
  return `I couldn't find ${config.label} work on ${targetDate}. I left the session unchanged.`;
}

function programEditDomainFromSemanticDraft(
  domain: SemanticProgramEditDraftTargetDomain,
): ProgramEditTargetDomain {
  return domain === 'setup' ? 'schedule' : domain;
}

function programEditIntentFromSemanticDraft(
  intent: SemanticProgramEditDraftIntent,
): ProgramEditIntent {
  if (intent === 'reduce') return 'edit';
  return intent;
}

function requestedChangeFromSemanticDraft(
  draft: SemanticProgramEditDraft,
): ProgramEditRequestedChange {
  switch (draft.actionScope) {
    case 'duration':
      return 'duration';
    case 'intensity':
      return 'intensity';
    case 'modality':
      return 'modality';
    case 'exercise':
      return 'exercise';
    case 'strength_block':
      return draft.intent === 'reduce' ? 'volume' : 'unknown';
    case 'conditioning_block':
      return draft.intent === 'add' || draft.intent === 'replace' || draft.intent === 'remove'
        ? 'type'
        : 'unknown';
    case 'whole_session':
    case 'setup':
      return 'day';
    default:
      return assertNever(draft.actionScope);
  }
}

function editScopeFromSemanticDraft(
  draft: SemanticProgramEditDraft,
): ProgramEditEditScope | undefined {
  if (draft.targetDomain === 'setup' || draft.actionScope === 'setup') {
    return 'update_program_setup';
  }
  if (draft.targetDomain === 'strength' && draft.actionScope === 'strength_block') {
    if (draft.intent === 'remove') return 'remove_strength_block';
    if (draft.intent === 'reduce' || draft.intent === 'edit') return 'reduce_strength_block';
  }
  if (draft.actionScope === 'whole_session') {
    if (draft.intent === 'add') return 'add_whole_session';
    if (draft.intent === 'remove' || draft.intent === 'replace') return 'remove_whole_session';
    return undefined;
  }
  if (draft.targetDomain !== 'conditioning') return undefined;
  return conditioningEditScopeFromSemanticDraft(draft.intent, draft.actionScope);
}

function conditioningEditScopeFromSemanticDraft(
  intent: SemanticProgramEditDraftIntent,
  scope: SemanticProgramEditDraftActionScope,
): ProgramEditEditScope | undefined {
  if (intent === 'add') return 'add_conditioning_item';
  if (intent === 'remove') return 'remove_conditioning_item';
  if (scope === 'duration') return 'duration_only';
  if (scope === 'intensity') return 'intensity_only';
  if (scope === 'modality') return 'modality_only';
  if (intent === 'replace') return 'replace_conditioning_prescription';
  if (scope === 'conditioning_block' && intent === 'edit') return 'replace_conditioning_prescription';
  return undefined;
}

function commandFromSemanticDraft(
  draft: SemanticProgramEditDraft,
  editScope: ProgramEditEditScope | undefined,
): CoachCommand | null {
  if (draft.intent === 'ask_question' || draft.intent === 'explain') return null;
  const target =
    draft.targetDate
      ? {
          kind: 'date' as const,
          date: draft.targetDate,
          sessionName: draft.sourceTarget?.sessionName,
        }
      : { kind: 'unbound' as const };

  if (draft.targetDomain === 'conditioning') {
    if (draft.intent === 'remove') {
      const removesWholeConditioningBlock = draft.actionScope === 'conditioning_block';
      return {
        mode: 'mutate',
        operation: 'remove_conditioning',
        target,
        payload: {
          operation: 'remove_conditioning',
          modality: null,
          targetItemId: draft.targetItemId ?? undefined,
        },
        scope: 'one_off',
        confidence: draft.confidence,
        needsClarification:
          !draft.targetDate || (!removesWholeConditioningBlock && !draft.targetItemId),
        missingFields: [
          ...(!draft.targetDate ? ['targetDate'] : []),
          ...(!removesWholeConditioningBlock && !draft.targetItemId ? ['targetItemId'] : []),
        ],
        reason: `semantic_program_edit_draft:${draft.reason}`,
      };
    }
    if (draft.intent === 'add' || draft.intent === 'edit' || draft.intent === 'replace') {
      return {
        mode: 'mutate',
        operation: 'add_conditioning',
        target,
        payload: {
          operation: 'add_conditioning',
          modality: null,
          editMode: draft.intent === 'add' ? undefined : 'update_existing',
          editScope: semanticConditioningCommandScope(editScope),
          targetItemId: draft.targetItemId ?? undefined,
        },
        scope: 'one_off',
        confidence: draft.confidence,
        needsClarification: !draft.targetDate || (draft.intent !== 'add' && !draft.targetItemId),
        missingFields: [
          ...(!draft.targetDate ? ['targetDate'] : []),
          ...(draft.intent !== 'add' && !draft.targetItemId ? ['targetItemId'] : []),
        ],
        reason: `semantic_program_edit_draft:${draft.reason}`,
      };
    }
  }

  if (draft.targetDomain === 'session' && draft.actionScope === 'whole_session') {
    if (draft.intent === 'remove' || draft.intent === 'replace') {
      return {
        mode: 'mutate',
        operation: 'remove_session',
        target,
        payload: {
          operation: 'remove_session',
          targetSessionId: draft.targetSessionId,
          reason: draft.explicitUserWording,
        },
        scope: 'one_off',
        confidence: draft.confidence,
        needsClarification: !draft.targetDate,
        missingFields: !draft.targetDate ? ['targetDate'] : [],
        reason: `semantic_program_edit_draft:${draft.reason}`,
      };
    }
  }

  return null;
}

function semanticProgramEditMissingFields(
  draft: SemanticProgramEditDraft,
  command: CoachCommand | null,
  editScope: ProgramEditEditScope | undefined,
): string[] {
  const fields = new Set(draft.missingFields);
  const blockConfig = blockLevelResolverConfig(draft, editScope);
  if (blockConfig) {
    for (const field of [...fields]) {
      if (isTargetItemMissingField(field)) fields.delete(field);
    }
  }
  if (draft.intent === 'ask_question' || draft.intent === 'explain') return [...fields];
  if (!draft.targetDate && draft.actionScope !== 'setup') fields.add('targetDate');
  if (
    draft.targetDomain === 'conditioning' &&
    draft.intent !== 'add' &&
    !draft.targetItemId &&
    !blockConfig
  ) {
    fields.add('targetItemId');
  }
  if (!command && !isCommandlessSemanticDraftHandledByProgramEdit(draft, editScope)) {
    fields.add(editScope === 'update_program_setup' ? 'setupChange' : 'supported_change');
  }
  return [...fields];
}

function isCommandlessSemanticDraftHandledByProgramEdit(
  draft: SemanticProgramEditDraft,
  editScope: ProgramEditEditScope | undefined,
): boolean {
  if (editScope === 'remove_strength_block' || editScope === 'reduce_strength_block') return true;
  return draft.isCompound ||
    (draft.targetDomain === 'strength' &&
      draft.actionScope === 'strength_block' &&
      (draft.intent === 'remove' || draft.intent === 'reduce'));
}

function semanticDraftNewValue(draft: SemanticProgramEditDraft): Record<string, unknown> {
  return {
    source: 'semantic_program_edit_draft',
    explicitUserWording: draft.explicitUserWording,
    proposedActions: draft.proposedActions,
    constraints: draft.constraints,
  };
}

function semanticDraftClarificationQuestion(
  draft: SemanticProgramEditDraft,
  fields: string[],
): string {
  if (fields.includes('targetDate')) return 'Which day should I apply that edit to?';
  if (fields.includes('strengthBlockTarget')) {
    return draft.targetDate
      ? `Which strength block on ${draft.targetDate} should I change?`
      : 'Which strength block should I change?';
  }
  if (fields.includes('conditioningBlockTarget')) {
    return draft.targetDate
      ? `Which conditioning block on ${draft.targetDate} should I change?`
      : 'Which conditioning block should I change?';
  }
  if (fields.includes('recoveryBlockTarget')) {
    return draft.targetDate
      ? `Which recovery block on ${draft.targetDate} should I change?`
      : 'Which recovery block should I change?';
  }
  if (fields.includes('conditioningBlockNotFound')) {
    return draft.targetDate
      ? `I couldn't find conditioning work on ${draft.targetDate}. I left the session unchanged.`
      : "I couldn't find conditioning work on that day. I left the session unchanged.";
  }
  if (fields.includes('recoveryBlockNotFound')) {
    return draft.targetDate
      ? `I couldn't find recovery work on ${draft.targetDate}. I left the session unchanged.`
      : "I couldn't find recovery work on that day. I left the session unchanged.";
  }
  if (fields.includes('strengthBlockNotFound')) {
    return draft.targetDate
      ? `I couldn't find strength work on ${draft.targetDate}. I left the session unchanged.`
      : "I couldn't find strength work on that day. I left the session unchanged.";
  }
  if (fields.includes('targetItemId')) {
    emitProgramEditDiagnostic('generic_visible_item_prompt_generated', {
      functionName: 'semanticDraftClarificationQuestion',
      intent: draft.intent,
      targetDomain: draft.targetDomain,
      actionScope: draft.actionScope,
      targetDate: draft.targetDate,
      targetItemId: draft.targetItemId,
      missingFields: fields,
      reason:
        'targetItemId remained missing after semantic draft finalisation',
    });
    return 'Which visible item should I change?';
  }
  if (fields.includes('setupChange')) {
    return 'I understand that as a setup change, but I need the exact availability change before rebuilding.';
  }
  return 'I understand the edit, but I need one more detail before changing the program.';
}

function semanticDraftClarificationOptions(
  draft: SemanticProgramEditDraft,
  fields: string[],
): string[] | undefined {
  if (fields.includes('targetDate')) return ['Today', 'Tomorrow', 'Choose another day'];
  if (fields.includes('strengthBlockTarget')) return ['Gym strength', 'Lower-body strength', 'Whole session'];
  if (fields.includes('conditioningBlockTarget')) return ['Bike conditioning', 'Sprint conditioning', 'Whole session'];
  if (fields.includes('recoveryBlockTarget')) return ['Recovery block', 'Mobility block', 'Whole session'];
  if (
    fields.includes('conditioningBlockNotFound') ||
    fields.includes('recoveryBlockNotFound') ||
    fields.includes('strengthBlockNotFound')
  ) {
    return ['Leave unchanged'];
  }
  if (fields.includes('targetItemId')) {
    const title = draft.sourceTarget?.itemTitle;
    return title ? [title, 'Choose another item'] : undefined;
  }
  if (fields.includes('setupChange')) return ['Training days', 'Availability limit', 'Cancel'];
  return undefined;
}

function semanticConditioningCommandScope(
  editScope: ProgramEditEditScope | undefined,
): Extract<AddConditioningMutatePayload, { operation: 'add_conditioning' }>['editScope'] | undefined {
  if (editScope === 'duration_only') return 'edit_duration_only';
  if (editScope === 'modality_only') return 'edit_modality_only';
  if (editScope === 'intensity_only') return 'edit_intensity_only';
  if (editScope === 'replace_conditioning_prescription') return 'replace_conditioning_prescription';
  return undefined;
}

function finaliseAddSessionProgramEdit(draft: ProgramEditDraft): ProgramEdit {
  const missing = new Set(draft.missingFields);
  const sourceSessionName = stringOrNull((draft.newValue as any)?.sourceSessionName);
  if (!draft.targetDate) missing.add('targetDate');
  if (!sourceSessionName) missing.add('sourceSession');
  if (missing.size > 0 || !draft.targetDate || !sourceSessionName) {
    return askQuestionFromDraft({ ...draft, editScope: 'add_whole_session' }, [...missing]);
  }
  return {
    ...draft,
    targetDomain: 'session',
    intent: 'add',
    editScope: 'add_whole_session',
    targetDate: draft.targetDate,
    targetSessionId: draft.targetSessionId ?? null,
    targetItemId: null,
    requestedChange: 'day',
    sourceDate: stringOrNull((draft.newValue as any)?.sourceDate) ?? undefined,
    sourceSessionName,
  };
}

function finaliseRemoveSessionProgramEdit(draft: ProgramEditDraft): ProgramEdit {
  const missing = new Set(draft.missingFields);
  if (!draft.targetDate) missing.add('targetDate');
  if (missing.size > 0 || !draft.targetDate) {
    return askQuestionFromDraft({ ...draft, editScope: 'remove_whole_session' }, [...missing]);
  }
  return {
    ...draft,
    targetDomain: 'session',
    intent: 'remove',
    editScope: 'remove_whole_session',
    targetDate: draft.targetDate,
    targetSessionId: draft.targetSessionId ?? null,
    targetItemId: null,
    requestedChange: 'day',
    reason: stringOrNull((draft.newValue as any)?.reason) ?? undefined,
  };
}

function finaliseStrengthBlockProgramEdit(draft: ProgramEditDraft): ProgramEdit {
  const missing = new Set(draft.missingFields.filter((field) =>
    !isTargetItemMissingField(field),
  ));
  if (!draft.targetDate) missing.add('targetDate');
  const editScope = draft.editScope === 'reduce_strength_block'
    ? 'reduce_strength_block'
    : 'remove_strength_block';
  if (missing.size > 0 || !draft.targetDate) {
    return askQuestionFromDraft({ ...draft, editScope }, [...missing]);
  }
  return {
    ...draft,
    targetDomain: 'strength',
    intent: editScope === 'reduce_strength_block' ? 'edit' : 'remove',
    editScope,
    targetDate: draft.targetDate,
    targetSessionId: draft.targetSessionId ?? null,
    targetItemId: null,
    requestedChange: 'volume',
    command: null,
  };
}

function finaliseConditioningProgramEdit(draft: ProgramEditDraft): ProgramEdit {
  const missing = new Set(draft.missingFields);
  if (!draft.targetDate) missing.add('targetDate');

  const editScope =
    draft.intent === 'add'
      ? 'add_conditioning_item'
      : draft.editScope ?? inferProgramEditScopeFromDraft(draft);
  if (!editScope) missing.add('editScope');

  if (
    editScope !== 'add_conditioning_item' &&
    (draft.intent === 'edit' || draft.intent === 'remove' || draft.intent === 'replace') &&
    !draft.targetItemId &&
    !(draft.intent === 'remove' && draft.actionScope === 'conditioning_block')
  ) {
    missing.add('targetItemId');
  }

  if (missing.size > 0 || !draft.targetDate || !editScope) {
    return askQuestionFromDraft({ ...draft, editScope }, [...missing]);
  }

  const value = conditioningValueFromDraft(draft);
  switch (editScope) {
    case 'modality_only': {
      const newModality =
        conditioningModalityFromValue(value) ??
        (value.bikeLabel ? 'bike' : null);
      if (!draft.targetItemId || !newModality) {
        return askQuestionFromDraft(
          { ...draft, editScope },
          [!draft.targetItemId ? 'targetItemId' : 'newModality'],
        );
      }
      return {
        ...draft,
        targetDomain: 'conditioning',
        intent: 'edit',
        editScope,
        targetDate: draft.targetDate,
        targetItemId: draft.targetItemId,
        requestedChange: 'modality',
        newModality,
        preservePrescription: true,
      };
    }
    case 'duration_only': {
      if (!draft.targetItemId) {
        return askQuestionFromDraft({ ...draft, editScope }, ['targetItemId']);
      }
      const newDuration = conditioningPrescriptionFromValue(value);
      if (!hasConditioningDuration(newDuration)) {
        return askQuestionFromDraft({ ...draft, editScope }, ['duration']);
      }
      return {
        ...draft,
        targetDomain: 'conditioning',
        intent: 'edit',
        editScope,
        targetDate: draft.targetDate,
        targetItemId: draft.targetItemId,
        requestedChange: 'duration',
        newDuration,
        newDurationMinutes: newDuration.durationMinutes ?? null,
        preserveModalityAndType: true,
      };
    }
    case 'intensity_only': {
      if (!draft.targetItemId) {
        return askQuestionFromDraft({ ...draft, editScope }, ['targetItemId']);
      }
      const newIntensity = stringOrNull(value.intensity) ?? stringOrNull(draft.newValue);
      if (!newIntensity) {
        return askQuestionFromDraft({ ...draft, editScope }, ['intensity']);
      }
      return {
        ...draft,
        targetDomain: 'conditioning',
        intent: 'edit',
        editScope,
        targetDate: draft.targetDate,
        targetItemId: draft.targetItemId,
        requestedChange: 'intensity',
        newIntensity,
        preserveModalityAndType: true,
      };
    }
    case 'replace_conditioning_prescription': {
      if (!draft.targetItemId) {
        return askQuestionFromDraft({ ...draft, editScope }, ['targetItemId']);
      }
      const replacementPrescription = conditioningPrescriptionFromValue(value);
      const replacementType = replacementTypeFromValue(value);
      return {
        ...draft,
        targetDomain: 'conditioning',
        intent: 'replace',
        editScope,
        targetDate: draft.targetDate,
        targetItemId: draft.targetItemId,
        requestedChange: 'type',
        replacementType,
        replacementModality: conditioningModalityFromValue(value),
        replacementPrescription,
        discardStaleFields: true,
      };
    }
    case 'add_conditioning_item': {
      return {
        ...draft,
        targetDomain: 'conditioning',
        intent: 'add',
        editScope,
        targetDate: draft.targetDate,
        targetItemId: null,
        requestedChange: draft.requestedChange,
        appendWasExplicit: true,
      };
    }
    case 'remove_conditioning_item': {
      if (!draft.targetItemId && draft.actionScope !== 'conditioning_block') {
        return askQuestionFromDraft({ ...draft, editScope }, ['targetItemId']);
      }
      return {
        ...draft,
        targetDomain: 'conditioning',
        intent: 'remove',
        editScope,
        targetDate: draft.targetDate,
        targetItemId: draft.targetItemId ?? null,
        requestedChange: draft.requestedChange === 'unknown' ? 'unknown' : 'type',
      };
    }
    case 'remove_strength_block':
    case 'reduce_strength_block':
      return askQuestionFromDraft({ ...draft, editScope }, ['editScope']);
    case 'remove_whole_session':
    case 'add_whole_session':
      return askQuestionFromDraft({ ...draft, editScope }, ['editScope']);
    case 'update_program_setup':
      return askQuestionFromDraft({ ...draft, editScope: undefined }, ['editScope']);
    default:
      return assertNever(editScope);
  }
}

function askQuestionFromDraft(
  draft: ProgramEditDraft,
  fields: string[],
): AskClarificationProgramEdit {
  const missingFields = nonEmptyFields(fields);
  return {
    ...draft,
    intent: 'ask_question',
    missingFields,
    targetItemId: draft.targetItemId ?? null,
    question: draft.question ?? clarificationForMissingFields({
      ...draft,
      intent: 'ask_question',
      missingFields,
    } as AskClarificationProgramEdit),
    pendingEdit: draft.targetDomain === 'conditioning' ? draft : undefined,
  };
}

function programEditFromAmbiguousTargetFrame(
  frame: CoachTargetFrame | null | undefined,
): AskClarificationProgramEdit | null {
  if (!frame || frame.targetSource !== 'ambiguous' || frame.missingFields.length === 0) {
    return null;
  }
  const missingFields = nonEmptyFields(frame.missingFields);
  const options = frame.candidateOptions.map((option) => option.label).filter(Boolean);
  return {
    targetDate: null,
    targetSessionId: null,
    targetItemId: null,
    targetDomain: 'session',
    intent: 'ask_question',
    requestedChange: 'unknown',
    newValue: null,
    missingFields,
    confidence: frame.confidence,
    naturalLanguageReason: frame.reason,
    command: null,
    question: options.length > 0
      ? `Which one do you mean: ${options.join(' or ')}?`
      : 'Which session or item do you mean?',
    options,
  };
}

function nonEmptyFields(fields: string[]): [string, ...string[]] {
  const clean = fields.map((field) => field.trim()).filter(Boolean);
  return clean.length > 0 ? [clean[0], ...clean.slice(1)] : ['unknown'];
}

function inferProgramEditScopeFromDraft(draft: ProgramEditDraft): ProgramEditEditScope | undefined {
  if (draft.targetDomain !== 'conditioning') return undefined;
  if (draft.intent === 'add') return 'add_conditioning_item';
  if (draft.intent === 'remove') return 'remove_conditioning_item';
  if (draft.intent === 'replace' || draft.requestedChange === 'type') {
    return 'replace_conditioning_prescription';
  }
  if (draft.requestedChange === 'modality') return 'modality_only';
  if (draft.requestedChange === 'duration') return 'duration_only';
  if (draft.requestedChange === 'intensity') return 'intensity_only';
  return undefined;
}

function conditioningValueFromDraft(draft: ProgramEditDraft): Record<string, any> {
  return draft.newValue && typeof draft.newValue === 'object'
    ? draft.newValue as Record<string, any>
    : {};
}

function conditioningModalityFromValue(value: Record<string, any>): ConditioningModality | null {
  const raw = value.modality ?? value.to ?? null;
  return raw ? raw as ConditioningModality : null;
}

function conditioningPrescriptionFromValue(value: Record<string, any>): ConditioningEditPrescription {
  return {
    durationMinutes: numberOrUndefined(value.durationMinutes),
    sets: numberOrUndefined(value.sets),
    repsMin: numberOrUndefined(value.repsMin),
    repsMax: numberOrUndefined(value.repsMax),
    restSeconds: numberOrUndefined(value.restSeconds),
    prescriptionType: value.prescriptionType,
    intensity: stringOrNull(value.intensity) ?? undefined,
  };
}

function hasConditioningDuration(value: ConditioningEditPrescription): boolean {
  return value.durationMinutes != null ||
    value.repsMin != null ||
    value.repsMax != null ||
    value.sets != null;
}

function replacementTypeFromValue(value: Record<string, any>): ConditioningReplacementType {
  const intent = String(value.trainingIntent ?? '').toLowerCase();
  if (intent === 'sprint') return 'sprint';
  if (intent === 'hiit') return 'vo2';
  if (intent === 'tempo') return 'tempo';
  if (intent === 'low_load') return 'low_load';
  if (intent === 'aerobic') return 'aerobic_base';
  const activity = String(value.activity ?? '').toLowerCase();
  if (/\bsprints?\b/.test(activity)) return 'sprint';
  if (/\bhiit|interval\b/.test(activity)) return 'vo2';
  if (/\btempo\b/.test(activity)) return 'tempo';
  if (/\brecovery|mobility|pilates|yoga\b/.test(activity)) return 'recovery';
  return 'unknown';
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ProgramEdit variant: ${String(value)}`);
}

export interface ProgramEditVisibleVerification {
  ok: boolean;
  reason?: string;
}

export function verifyProgramEditVisibleMutation(args: {
  edit: ProgramEdit;
  beforeWorkout: ResolvedDay['workout'] | null;
  afterWorkout: ResolvedDay['workout'] | null;
  targetDate: string;
}): ProgramEditVisibleVerification {
  const { edit, beforeWorkout, afterWorkout } = args;
  if (edit.targetDate && edit.targetDate !== args.targetDate) {
    return { ok: false, reason: 'wrong_target_date' };
  }

  if (
    edit.targetDomain === 'session' &&
    edit.intent === 'remove' &&
    edit.editScope === 'remove_whole_session'
  ) {
    if (!beforeWorkout) {
      return { ok: false, reason: 'remove_session_missing_before' };
    }
    if (!afterWorkout || isRemovedSessionWorkout(afterWorkout)) {
      return { ok: true };
    }
    return { ok: false, reason: 'remove_session_still_visible' };
  }

  if (
    edit.targetDomain === 'conditioning' &&
    (edit.intent === 'edit' || edit.intent === 'replace' || edit.intent === 'remove')
  ) {
    const beforeSources = visibleConditioningItems(beforeWorkout);
    const afterSources = visibleConditioningItems(afterWorkout);
    const protectedCheck = verifyProtectedConditioningTargets({
      protectedTargets: edit.protectedTargets ?? [],
      beforeSources,
      afterSources,
      editableTargetItemId: edit.targetItemId,
    });
    if (!protectedCheck.ok) {
      return protectedCheck;
    }

    if (edit.editScope === 'remove_conditioning_item') {
      if (!edit.targetItemId) {
        if (beforeSources.length === 0) {
          return { ok: false, reason: 'remove_block_missing_before' };
        }
        if (afterSources.length > 0) {
          return { ok: false, reason: 'remove_block_still_visible' };
        }
        return { ok: true };
      }
      const beforeTarget = beforeSources.find((item) => item.id === edit.targetItemId);
      const afterTarget = afterSources.find((item) => item.id === edit.targetItemId);
      if (!beforeTarget) {
        return { ok: false, reason: 'remove_target_missing_before' };
      }
      if (afterTarget) {
        return { ok: false, reason: 'remove_target_still_visible' };
      }
      if (afterSources.length !== beforeSources.length - 1) {
        return { ok: false, reason: 'remove_changed_wrong_item_count' };
      }
      const beforeUntouchedIds = beforeSources
        .filter((item) => item.id !== edit.targetItemId)
        .map((item) => item.id)
        .sort();
      const afterIds = afterSources.map((item) => item.id).sort();
      if (JSON.stringify(beforeUntouchedIds) !== JSON.stringify(afterIds)) {
        return { ok: false, reason: 'remove_changed_unrelated_conditioning' };
      }
    }

    if (edit.editScope === 'replace_conditioning_prescription') {
      if (afterSources.length !== 1) {
        return { ok: false, reason: 'replacement_conditioning_not_atomic' };
      }
      const replacementIntent = String((edit.newValue as any)?.trainingIntent ?? '');
      if (
        isStaleConditioningIdentity(afterSources[0]?.title, replacementIntent) ||
        (
          afterWorkout?.workoutType === 'Conditioning' &&
          isStaleConditioningIdentity(afterWorkout?.name, replacementIntent)
        )
      ) {
        return { ok: false, reason: 'stale_conditioning_identity_preserved' };
      }
    }

    if (edit.editScope === 'duration_only') {
      if (afterSources.length !== beforeSources.length) {
        return { ok: false, reason: 'duplicate_conditioning_created' };
      }
      const beforeTarget = beforeSources.find((item) => item.id === edit.targetItemId);
      const afterTarget = afterSources.find((item) => item.id === edit.targetItemId);
      if (!beforeTarget) {
        return { ok: false, reason: 'duration_target_missing_before' };
      }
      if (!afterTarget) {
        return { ok: false, reason: 'duration_target_missing_after' };
      }
      if (beforeTarget.modality !== afterTarget.modality) {
        return { ok: false, reason: 'duration_edit_changed_modality' };
      }
      if (
        normaliseConditioningIdentityForDuration(beforeTarget.title) !==
        normaliseConditioningIdentityForDuration(afterTarget.title)
      ) {
        return { ok: false, reason: 'duration_edit_changed_identity' };
      }
      if (
        edit.newDurationMinutes != null &&
        afterTarget.durationMinutes !== edit.newDurationMinutes
      ) {
        return { ok: false, reason: 'duration_edit_not_applied' };
      }
      if (
        edit.newDurationMinutes != null &&
        beforeTarget.durationMinutes != null &&
        beforeTarget.durationMinutes !== edit.newDurationMinutes &&
        afterSources.some((item) =>
          item.id !== edit.targetItemId &&
          item.durationMinutes === beforeTarget.durationMinutes &&
          normaliseConditioningIdentityForDuration(item.title) ===
            normaliseConditioningIdentityForDuration(beforeTarget.title)
        )
      ) {
        return { ok: false, reason: 'stale_old_duration_item_visible' };
      }
    }

    if (afterSources.length > beforeSources.length) {
      return { ok: false, reason: 'duplicate_conditioning_created' };
    }

    if (edit.targetItemId) {
      const matchingAfter = afterSources.filter((item) => item.id === edit.targetItemId);
      if (matchingAfter.length > 1) {
        return { ok: false, reason: 'duplicate_target_item_created' };
      }
    }
  }

  return { ok: true };
}

function isRemovedSessionWorkout(workout: ResolvedDay['workout'] | null): boolean {
  if (!workout) return true;
  const anyWorkout = workout as any;
  return (
    anyWorkout.removed === true ||
    anyWorkout.isRemoved === true ||
    anyWorkout.sessionTier === 'removed' ||
    anyWorkout.workoutType === 'Removed' ||
    anyWorkout.workoutType === 'Rest'
  );
}

function verifyProtectedConditioningTargets(args: {
  protectedTargets: Array<ProgramEditCandidateItem | SemanticProgramEditDraftProtectedTarget>;
  beforeSources: Array<{ id: string; title: string; modality: ConditioningModality | null; durationMinutes: number | null }>;
  afterSources: Array<{ id: string; title: string; modality: ConditioningModality | null; durationMinutes: number | null }>;
  editableTargetItemId: string | null;
}): ProgramEditVisibleVerification {
  for (const protectedTarget of args.protectedTargets) {
    const protectedDomain = (protectedTarget as any).domain ?? (protectedTarget as any).targetDomain;
    if (
      protectedDomain !== 'conditioning' &&
      protectedDomain !== 'recovery'
    ) {
      continue;
    }
    const protectedItemId = 'id' in protectedTarget
      ? protectedTarget.id
      : protectedTarget.targetItemId ?? null;
    if (!protectedItemId) continue;
    if (protectedItemId === args.editableTargetItemId) continue;
    const before = args.beforeSources.find((item) => item.id === protectedItemId);
    const after = args.afterSources.find((item) => item.id === protectedItemId);
    if (!before) {
      return { ok: false, reason: 'protected_target_missing_before' };
    }
    if (!after) {
      return { ok: false, reason: 'protected_target_removed' };
    }
    if (
      normaliseItemTitle(before.title) !== normaliseItemTitle(after.title) ||
      before.modality !== after.modality ||
      before.durationMinutes !== after.durationMinutes
    ) {
      return { ok: false, reason: 'protected_target_changed' };
    }
  }
  return { ok: true };
}

function normaliseConditioningIdentityForDuration(value: string | undefined | null): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/g, '{duration}')
    .replace(/\b\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*(?:s|sec|secs|second|seconds)\b/g, '{duration}')
    .replace(/\(\s*\{duration\}\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStaleConditioningIdentity(value: string | undefined | null, replacementIntent: string): boolean {
  if (replacementIntent !== 'sprint' && replacementIntent !== 'hiit' && replacementIntent !== 'tempo') {
    return false;
  }
  return /\b(?:easy\s+aerobic\s+flush|aerobic\s+base|recovery\s+flush|low[-\s]*load)\b/i.test(String(value ?? ''));
}

export function normalizeCoachEditMessage(message: string): string {
  const withChatShortcuts = String(message ?? '')
    .replace(/\bu\b/gi, 'you')
    .replace(/\bur\b/gi, 'your')
    .replace(/\bdat\b/gi, 'that')
    .replace(/\bdis\b/gi, 'this')
    .replace(/\b1\s*(?:h|hr|hrs)\b/gi, '1 hour')
    .replace(/\bmins?\b/gi, 'minutes')
    .replace(/\bhrs?\b/gi, 'hours');

  const withEquipmentTerms = withChatShortcuts.replace(/\b[a-z]{5,}\b/gi, (word) => {
    const lower = word.toLowerCase();
    const equipment = ['assault', 'skierg', 'rower'];
    const match = equipment.find((candidate) =>
      Math.abs(candidate.length - lower.length) <= 2 &&
      levenshteinDistanceAtMost(lower, candidate, 2),
    );
    return match ? preserveCase(word, match) : word;
  });

  return withEquipmentTerms.replace(/\b[a-z]{4,}\b/gi, (word) => {
    const lower = word.toLowerCase();
    if (PROGRAM_EDIT_LEXICON.includes(lower)) return word;
    const match = PROGRAM_EDIT_LEXICON.find((candidate) =>
      Math.abs(candidate.length - lower.length) <= 1 &&
      levenshteinAtMostOne(lower, candidate),
    );
    if (!match) return word;
    return preserveCase(word, match);
  });
}

function baseEdit(
  command: CoachCommand,
  targetDate: string | null,
  targetSessionId: string | null,
  input: InterpretCoachMessageToProgramEditInput & { normalizedMessage?: string },
): ProgramEditDraft {
  return {
    intent: 'ask_question',
    targetDate,
    targetSessionId,
    targetItemId: null,
    targetDomain: 'session',
    requestedChange: 'unknown',
    newValue: null,
    missingFields: [],
    confidence: 'confidence' in command ? command.confidence : 0.5,
    naturalLanguageReason: 'reason' in command ? command.reason : 'unknown',
    command,
    normalizedMessage: input.normalizedMessage,
    source: input.source,
  };
}

function targetDateFromCommand(command: CoachCommand): string | null {
  if ('target' in command) return dateFromTarget(command.target);
  return null;
}

function dateFromTarget(target: CoachCommandTarget): string | null {
  if (target.kind === 'date' || target.kind === 'exercise') return target.date;
  return null;
}

function targetDomainFromMutation(
  command: Extract<CoachCommand, { mode: 'mutate' }>,
  workout: ResolvedDay['workout'] | null,
): ProgramEditTargetDomain {
  if (command.operation === 'replace_exercise') return 'strength';
  if (command.operation === 'add_session') return 'session';
  if (command.operation === 'remove_session') return 'session';
  if (command.operation === 'move_session') return 'schedule';
  if (command.operation === 'update_program_setup') return 'schedule';
  if (
    command.operation === 'add_conditioning' ||
    command.operation === 'remove_conditioning' ||
    command.operation === 'swap_conditioning_modality_once' ||
    command.operation === 'set_conditioning_modality_preference' ||
    command.operation === 'set_bike_subtype_preference'
  ) {
    return 'conditioning';
  }
  return 'session';
}

function intentFromMutation(
  command: Extract<CoachCommand, { mode: 'mutate' }>,
): ProgramEditIntent {
  switch (command.operation) {
    case 'add_session':
      return 'add';
    case 'add_conditioning': {
      const p = command.payload.operation === 'add_conditioning' ? command.payload : null;
      if (p?.editScope === 'replace_conditioning_prescription') return 'replace';
      if (p?.editMode === 'update_existing') return 'edit';
      if (p?.replaceActivity) {
        const source = normaliseItemTitle(p.replaceActivity);
        const next = normaliseItemTitle(p.customActivity ?? '');
        return source && next && source !== next ? 'replace' : 'edit';
      }
      return 'add';
    }
    case 'remove_conditioning':
    case 'remove_session':
      return 'remove';
    case 'replace_exercise':
      return 'replace';
    case 'move_session':
      return 'move';
    case 'update_program_setup':
      return 'edit';
    case 'set_conditioning_modality_preference':
    case 'swap_conditioning_modality_once':
    case 'set_bike_subtype_preference':
      return 'edit';
    case 'undo_last_change':
      return 'edit';
  }
}

function requestedChangeFromMutation(
  command: Extract<CoachCommand, { mode: 'mutate' }>,
): ProgramEditRequestedChange {
  if (
    command.operation === 'move_session' ||
    command.operation === 'remove_session' ||
    command.operation === 'add_session' ||
    command.operation === 'update_program_setup'
  ) return 'day';
  if (command.operation === 'replace_exercise') return 'exercise';
  if (
    command.operation === 'swap_conditioning_modality_once' ||
    command.operation === 'set_conditioning_modality_preference' ||
    command.operation === 'set_bike_subtype_preference'
  ) {
    return 'modality';
  }
  if (command.payload.operation === 'add_conditioning') {
    const p = command.payload;
    if (p.editScope === 'edit_duration_only') return 'duration';
    if (p.editScope === 'edit_modality_only') return 'modality';
    if (p.editScope === 'edit_intensity_only') return 'intensity';
    if (p.editScope === 'replace_conditioning_prescription') return 'type';
    if (p.durationMinutes || p.repsMin || p.repsMax) return 'duration';
    if (p.changeKind === 'modality' || p.modality || p.bikeLabel) return 'modality';
    if (p.trainingIntent || p.changeKind === 'training_intent') return 'type';
    if (p.intensity) return 'intensity';
    return 'type';
  }
  if (command.payload.operation === 'remove_conditioning') return 'type';
  if (command.payload.operation === 'add_session') return 'day';
  if (command.payload.operation === 'remove_session') return 'day';
  return 'unknown';
}

function requestedChangeFromMissing(fields: string[]): ProgramEditRequestedChange {
  if (fields.some((field) => /duration|minutes|time/i.test(field))) return 'duration';
  if (fields.some((field) => /exercise|activity|item/i.test(field))) return 'exercise';
  if (fields.some((field) => /day|date|target/i.test(field))) return 'day';
  return 'unknown';
}

function resolveVisibleProgramForDateFromInputs(args: {
  targetDate: string;
  currentWeek?: VisibleSessionRef[];
  resolveVisibleProgramForDate?: ResolveVisibleProgramForDate;
}): ResolvedVisibleProgramForDate & { source: 'shared_visible_resolver' | 'current_week_snapshot' | 'none' } {
  const shared = args.resolveVisibleProgramForDate?.(args.targetDate) ?? null;
  if (shared?.day?.workout) {
    return { ...shared, source: 'shared_visible_resolver' };
  }

  const visibleDay = (args.currentWeek ?? []).find((day) => day.date === args.targetDate);
  const workout = (visibleDay?.workout ?? null) as ResolvedDay['workout'] | null;
  const fallbackDay = {
    date: args.targetDate,
    dayOfWeek: 0,
    short: '',
    source: 'template',
    indicator: 'none',
    workout,
  } as unknown as ResolvedDay;
  const items = extractVisibleProgramItemsFromWorkout(workout);
  return {
    day: fallbackDay,
    items,
    conditioningItems: items.filter((item) =>
      item.domain === 'conditioning' || item.domain === 'recovery',
    ),
    strengthItems: items.filter((item) => item.domain === 'strength'),
    source: workout ? 'current_week_snapshot' : 'none',
  };
}

function candidateItemsForDomain(args: {
  items: ProgramEditCandidateItem[];
  targetDomain: ProgramEditTargetDomain;
}): ProgramEditCandidateItem[] {
  if (args.targetDomain === 'conditioning' || args.targetDomain === 'recovery') {
    return args.items.filter((item) =>
      item.domain === 'conditioning' || item.domain === 'recovery',
    );
  }
  if (args.targetDomain === 'strength') {
    return args.items.filter((item) => item.domain === 'strength');
  }
  if (args.targetDomain === 'session') {
    return args.items.filter((item) => item.domain === 'session');
  }
  return args.items;
}

function candidateLogPayload(item: ProgramEditCandidateItem) {
  return {
    id: item.id,
    title: item.title,
    domain: item.domain,
    modality: item.modality,
    durationMinutes: item.durationMinutes,
    source: item.source,
  };
}

function resolveTargetItem(args: {
  command: MutateCoachCommand;
  targetDate: string | null;
  visibleItems: ProgramEditCandidateItem[];
  intent: ProgramEditIntent;
  targetDomain: ProgramEditTargetDomain;
}): ProgramEditCandidateItem | { ambiguousOptions: string[]; question?: string } | null {
  if (args.targetDomain === 'conditioning' || args.targetDomain === 'recovery') {
    const items = candidateItemsForDomain({
      items: args.visibleItems,
      targetDomain: args.targetDomain,
    });
    const explicitPayloadTargetId =
      args.command.payload.operation === 'add_conditioning' ||
      args.command.payload.operation === 'remove_conditioning'
        ? args.command.payload.targetItemId
        : undefined;
    if (explicitPayloadTargetId) {
      const explicit = items.find((item) => item.id === explicitPayloadTargetId);
      if (explicit) return explicit;
    }
    if (args.command.payload.operation === 'add_conditioning') {
      const sourceTitle = args.command.payload.replaceActivity ?? args.command.payload.customActivity;
      const matched = findItemByTitle(items, sourceTitle);
      if (matched) return matched;
    }
    if (args.command.payload.operation === 'remove_conditioning') {
      const modality = args.command.payload.modality;
      if (modality) {
        const modalityMatches = items.filter((item) =>
          item.modality === modality || itemTitleMatchesModality(item.title, modality),
        );
        if (modalityMatches.length === 1) return modalityMatches[0];
        if (modalityMatches.length > 1) {
          return { ambiguousOptions: modalityMatches.map((item) => item.title) };
        }
        return {
          ambiguousOptions: items.map((item) => item.title),
          question: args.targetDate
            ? `I can't see a visible ${humanConditioningModality(modality)} item on ${args.targetDate}. Which conditioning item do you mean?`
            : `I can't see a visible ${humanConditioningModality(modality)} item. Which conditioning item do you mean?`,
        };
      }
      if (items.length === 1) return items[0];
      if (items.length > 1) return { ambiguousOptions: items.map((item) => item.title) };
    }
    if (args.intent === 'edit' || args.intent === 'replace') {
      if (items.length === 1) return items[0];
      if (items.length > 1) return { ambiguousOptions: items.map((item) => item.title) };
    }
  }

  if (args.targetDomain === 'strength' && args.command.payload.operation === 'replace_exercise') {
    const source = args.command.payload.fromExercise;
    const items = candidateItemsForDomain({
      items: args.visibleItems,
      targetDomain: args.targetDomain,
    });
    const item = items.find((candidate) =>
      normaliseItemTitle(candidate.title) === normaliseItemTitle(source) ||
      normaliseItemTitle(candidate.title).includes(normaliseItemTitle(source)),
    );
    if (!item) return null;
    return item;
  }

  return null;
}

function isClearAppendRequest(
  message: string,
  command: MutateCoachCommand,
): boolean {
  if (command.operation !== 'add_conditioning') return false;
  if (command.payload.operation !== 'add_conditioning') return false;
  const text = String(message ?? '').toLowerCase();
  const hasAppendVerb =
    /\b(?:add|include|put|slot|chuck|throw|work\s+in)\b/i.test(text);
  const hasEditOrReplaceCue =
    /\b(?:make|set|change|adjust|swap|replace|instead|rather|remove|delete|drop|longer|shorter|harder|easier|lighter|less|more)\b/i.test(text);
  return hasAppendVerb && !hasEditOrReplaceCue;
}

function visibleConditioningItems(
  workout: ResolvedDay['workout'] | null,
): Array<{ id: string; title: string; modality: ConditioningModality | null; durationMinutes: number | null }> {
  return extractVisibleProgramItemsFromWorkout(workout)
    .filter((item) => item.domain === 'conditioning' || item.domain === 'recovery')
    .map((item) => ({
      id: item.id,
      title: item.title,
      modality: item.modality,
      durationMinutes: item.durationMinutes,
    }));
}

function findItemByTitle(
  items: ProgramEditCandidateItem[],
  title: string | null | undefined,
): ProgramEditCandidateItem | null {
  const wanted = normaliseItemTitle(title ?? '');
  if (!wanted) return null;
  return items.find((item) => {
    const candidate = normaliseItemTitle(item.title);
    return candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate);
  }) ?? null;
}

function visibleStrengthItems(
  workout: ResolvedDay['workout'] | null,
): Array<{ id: string; title: string; modality: ConditioningModality | null }> {
  return extractVisibleProgramItemsFromWorkout(workout)
    .filter((item) => item.domain === 'strength')
    .map((item) => ({
      id: item.id,
      title: item.title,
      modality: null,
    }));
}

type PendingCandidateItem = ProgramEditCandidateItem;

function matchPendingAnswerToItem(
  message: string,
  candidates: PendingCandidateItem[],
): { kind: 'one'; item: PendingCandidateItem } |
  { kind: 'many'; items: PendingCandidateItem[] } |
  { kind: 'none' } {
  const modality = modalityFromAnswer(message);
  if (modality) {
    const matches = candidates.filter((item) => item.modality === modality);
    if (matches.length === 1) return { kind: 'one', item: matches[0] };
    if (matches.length > 1) return { kind: 'many', items: matches };
  }

  const isGenericItemAnswer = /\b(?:conditioning|session|block|item|piece)\b/i.test(message);
  const answerTitle = normaliseAnswerTitle(message);
  if (isGenericItemAnswer) {
    if (candidates.length === 1) return { kind: 'one', item: candidates[0] };
    return { kind: 'many', items: candidates };
  }

  const titleMatches = candidates.filter((item) =>
    itemTitleMatchesAnswer(item.title, answerTitle),
  );
  if (titleMatches.length === 1) return { kind: 'one', item: titleMatches[0] };
  if (titleMatches.length > 1) return { kind: 'many', items: titleMatches };
  return { kind: 'none' };
}

function completeProgramEditTargetItem(
  edit: ProgramEdit,
  item: PendingCandidateItem,
): ProgramEdit {
  const command = edit.command?.mode === 'mutate'
    ? completeCommandTargetItem(edit.command, item)
    : edit.command;
  const intent = command?.mode === 'mutate'
    ? intentFromMutation(command)
    : edit.intent === 'ask_question'
    ? 'edit'
    : edit.intent;
  return finaliseProgramEditDraft({
    ...edit,
    intent,
    targetItemId: item.id,
    targetItemTitle: item.title,
    missingFields: edit.missingFields.filter((field) => field !== 'targetItemId'),
    question: undefined,
    options: undefined,
    command,
    newValue:
      command?.mode === 'mutate'
        ? newValueFromPayload(command.payload)
        : edit.newValue,
    confidence: Math.max(edit.confidence, 0.85),
    naturalLanguageReason: `${edit.naturalLanguageReason}; target item resolved from pending answer`,
    source: 'pending_clarifier',
  });
}

function completeCommandTargetItem(
  command: MutateCoachCommand,
  item: PendingCandidateItem,
): MutateCoachCommand {
  const resolvedMetadata = completeTargetItemMetadata(command);
  if (
    command.operation === 'swap_conditioning_modality_once' &&
    command.payload.operation === 'swap_conditioning_modality_once'
  ) {
    return {
      ...command,
      payload: {
        ...command.payload,
        from: item.modality ?? command.payload.from ?? null,
      },
      ...resolvedMetadata,
    };
  }
  if (
    command.operation === 'set_conditioning_modality_preference' &&
    command.payload.operation === 'set_conditioning_modality_preference'
  ) {
    return {
      ...command,
      payload: {
        ...command.payload,
        from: item.modality ?? command.payload.from ?? null,
      },
      ...resolvedMetadata,
    };
  }
  if (
    command.operation === 'add_conditioning' &&
    command.payload.operation === 'add_conditioning'
  ) {
    return {
      ...command,
      payload: {
        ...command.payload,
        replaceActivity: command.payload.replaceActivity ?? item.title,
        editMode: 'update_existing',
        targetItemId: item.id,
      },
      ...resolvedMetadata,
    };
  }
  if (
    command.operation === 'remove_conditioning' &&
    command.payload.operation === 'remove_conditioning'
  ) {
    return {
      ...command,
      payload: {
        ...command.payload,
        modality: command.payload.modality ?? item.modality,
        targetItemId: item.id,
      },
      ...resolvedMetadata,
    };
  }
  return {
    ...command,
    ...resolvedMetadata,
  };
}

function completeTargetItemMetadata(command: MutateCoachCommand): Pick<
  MutateCoachCommand,
  'missingFields' | 'needsClarification' | 'reason'
> {
  const missingFields = (command.missingFields ?? []).filter((field) =>
    !/^(?:targetItemId|target_item|target_session|source_item|item)$/.test(field),
  );
  return {
    missingFields,
    needsClarification: missingFields.length > 0,
    reason: `${command.reason}:pending_target_item_resolved`,
  };
}

function modalityFromAnswer(message: string): ConditioningModality | null {
  const text = String(message ?? '').toLowerCase();
  const directPhrases = [
    'assault bike',
    'air bike',
    'stationary bike',
    'regular bike',
    'normal bike',
    'ski erg',
    'skierg',
    'rower',
    'rowing',
    'bike',
    'row',
    'run',
    'running',
    'swim',
    'swimming',
    'ski',
  ];
  for (const phrase of directPhrases) {
    if (new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      const modality = tokenToModality(phrase);
      if (modality) return modality;
    }
  }
  const words = text
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const typoMap: Array<{ token: string; modality: ConditioningModality }> = [
    { token: 'rower', modality: 'row' },
    { token: 'rowing', modality: 'row' },
    { token: 'row', modality: 'row' },
    { token: 'bike', modality: 'bike' },
    { token: 'run', modality: 'run' },
    { token: 'running', modality: 'run' },
    { token: 'ski', modality: 'ski' },
    { token: 'skierg', modality: 'ski' },
    { token: 'swim', modality: 'swim' },
  ];
  for (const word of words) {
    const match = typoMap.find(({ token }) =>
      Math.abs(token.length - word.length) <= 1 &&
      levenshteinAtMostOne(word, token),
    );
    if (match) return match.modality;
  }
  return null;
}

function normaliseAnswerTitle(message: string): string {
  return normaliseItemTitle(
    String(message ?? '')
      .replace(/\b(?:obviously|mate|please|thanks|thank\s+you|yeah|yep|nah|actually)\b/gi, ' ')
      .replace(/\b(?:the|that|this|one|item|piece|part)\b/gi, ' '),
  );
}

function itemTitleMatchesAnswer(title: string, answer: string): boolean {
  if (!answer) return false;
  const candidate = normaliseItemTitle(title);
  if (candidate === answer || candidate.includes(answer) || answer.includes(candidate)) {
    return true;
  }
  const answerWords = answer.split(/\s+/).filter(Boolean);
  const candidateWords = candidate.split(/\s+/).filter(Boolean);
  return answerWords.some((answerWord) =>
    candidateWords.some((candidateWord) =>
      answerWord.length >= 3 &&
      Math.abs(candidateWord.length - answerWord.length) <= 1 &&
      levenshteinAtMostOne(answerWord, candidateWord),
    ),
  );
}

function betterItemClarificationQuestion(args: {
  targetDate: string;
  answer: string;
  options: string[];
}): string {
  const optionsText = args.options.join(' or ');
  const answer = String(args.answer ?? '').trim();
  if (optionsText) {
    return answer
      ? `I can use that, but there is more than one possible match on ${args.targetDate}. Which one: ${optionsText}?`
      : `Which one on ${args.targetDate}: ${optionsText}?`;
  }
  return `Which visible item on ${args.targetDate} should I change?`;
}

function referenceResolutionFromProgramEdit(
  edit: ProgramEdit,
  fallback: CoachReferenceResolution | null,
): CoachReferenceResolution | null {
  if (!edit.targetDate) return fallback;
  return {
    status: 'resolved',
    target: {
      date: edit.targetDate,
      sessionName: edit.targetItemTitle ?? 'session',
      method: 'implicit_recent_context',
    } as any,
    method: 'implicit_recent_context',
    confidence: Math.max(edit.confidence, 0.85),
    isMutationLike: true,
  } as CoachReferenceResolution;
}

function sourceClarificationQuestion(
  targetDate: string | null,
  options: string[] | undefined,
): string {
  if (options?.length) {
    return `Which one do you want to change: ${options.join(' or ')}?`;
  }
  return targetDate
    ? `Which item on ${targetDate} do you want me to change?`
    : 'Which item do you want me to change?';
}

function newValueFromPayload(payload: CoachMutatePayload | undefined): unknown {
  if (!payload) return null;
  if (payload.operation === 'add_session') {
    return {
      sourceDate: payload.sourceDate,
      sourceSessionName: payload.sourceSessionName,
      targetSessionName: payload.targetSessionName,
      reason: payload.reason,
    };
  }
  if (payload.operation === 'add_conditioning') {
    return {
      activity: payload.customActivity,
      modality: payload.modality,
      durationMinutes: payload.durationMinutes,
      sets: payload.sets,
      repsMin: payload.repsMin,
      repsMax: payload.repsMax,
      restSeconds: payload.restSeconds,
      prescriptionType: payload.prescriptionType,
      intensity: payload.intensity,
      bikeLabel: payload.bikeLabel,
      trainingIntent: payload.trainingIntent,
      replaceActivity: payload.replaceActivity,
      editScope: editScopeFromPayload(payload),
    };
  }
  if (payload.operation === 'remove_conditioning') {
    return { modality: payload.modality, targetItemId: payload.targetItemId };
  }
  if (payload.operation === 'remove_session') {
    return { targetSessionId: payload.targetSessionId, reason: payload.reason };
  }
  if (payload.operation === 'replace_exercise') {
    return { fromExercise: payload.fromExercise, toExercise: payload.toExercise };
  }
  if (payload.operation === 'move_session') {
    return { toDate: payload.toDate, toDow: payload.toDow, swap: payload.swap };
  }
  if (
    payload.operation === 'swap_conditioning_modality_once' ||
    payload.operation === 'set_conditioning_modality_preference'
  ) {
    return { from: payload.from, to: payload.to, bikeLabel: payload.bikeLabel };
  }
  if (payload.operation === 'set_bike_subtype_preference') {
    return { bikeLabel: payload.bikeLabel };
  }
  return null;
}

function editScopeFromPayload(payload: CoachMutatePayload | undefined): ProgramEditEditScope | undefined {
  if (!payload) return undefined;
  if (payload.operation === 'add_session') return 'add_whole_session';
  if (payload.operation === 'add_conditioning') {
    switch (payload.editScope) {
      case 'edit_modality_only':
        return 'modality_only';
      case 'edit_duration_only':
        return 'duration_only';
      case 'edit_intensity_only':
        return 'intensity_only';
      case 'replace_conditioning_prescription':
      case 'add_conditioning_item':
      case 'remove_conditioning_item':
        return payload.editScope;
      default:
        return undefined;
    }
  }
  if (payload.operation === 'remove_conditioning') return 'remove_conditioning_item';
  if (payload.operation === 'remove_session') return 'remove_whole_session';
  if (
    payload.operation === 'swap_conditioning_modality_once' ||
    payload.operation === 'set_conditioning_modality_preference' ||
    payload.operation === 'set_bike_subtype_preference'
  ) {
    return 'modality_only';
  }
  return undefined;
}

function clarificationForMissingFields(edit: ProgramEdit): string {
  if (edit.question) return edit.question;
  if (edit.missingFields.includes('targetItemId')) {
    return sourceClarificationQuestion(edit.targetDate, edit.options);
  }
  if (edit.missingFields.includes('targetDate')) {
    return 'Which day or session should I change?';
  }
  if (edit.missingFields.includes('sourceSession')) {
    return 'Which session should I add?';
  }
  if (edit.missingFields.includes('duration')) {
    return 'How much longer should it be: 35, 45, or 60 minutes?';
  }
  if (edit.missingFields.includes('intensity')) {
    return edit.targetItemTitle
      ? `How should I make ${edit.targetItemTitle} easier: shorter, lighter, or swap it for recovery?`
      : 'How should I make it easier: shorter, lighter, or swap it for recovery?';
  }
  if (edit.missingFields.includes('load_lever')) {
    return 'Do you want me to make the strength work easier, the conditioning easier, or the whole session?';
  }
  return 'What exactly should I change?';
}

function itemTitleMatchesModality(
  title: string,
  modality: ConditioningIntentModality,
): boolean {
  switch (modality) {
    case 'row':
      return /\b(?:row|rower|rowing)\b/i.test(title);
    case 'bike':
      return /\b(?:bike|cycling|spin)\b/i.test(title);
    case 'ski':
      return /\b(?:ski|skierg|ski\s*erg)\b/i.test(title);
    case 'run':
      return /\b(?:run|running|jog|jogging)\b/i.test(title);
    case 'swim':
      return /\b(?:swim|swimming)\b/i.test(title);
    case 'walk':
      return /\b(?:walk|walking)\b/i.test(title);
    case 'aerobic':
      return /\b(?:aerobic|flush|recovery)\b/i.test(title);
    case 'sprint':
      return /\bsprints?\b/i.test(title);
    default:
      return normaliseItemTitle(title).includes(String(modality));
  }
}

function humanConditioningModality(modality: string): string {
  switch (modality) {
    case 'row':
      return 'rower';
    case 'ski':
      return 'SkiErg';
    case 'bike':
      return 'bike';
    case 'run':
      return 'run';
    case 'walk':
      return 'walk';
    case 'aerobic':
      return 'aerobic';
    case 'sprint':
      return 'sprint';
    default:
      return 'conditioning';
  }
}

function hasRemovalIntent(message: string): boolean {
  return /\b(?:remove|drop|ditch|scrap|skip|cancel|cut|delete|take\s+out|get\s+rid\s+of|don'?t\s+do|do\s+not\s+do)\b/i.test(message);
}

function looksLikeConditioningEditTarget(message: string): boolean {
  return /\b(?:conditioning|cardio|aerobic|flush|bike|row|rower|rowing|ski|skierg|run|running|walk|swim|sprints?|pilates|mobility|recovery)\b/i.test(message);
}

function looksLikeWholeSessionRemovalTarget(message: string): boolean {
  if (looksLikeConditioningEditTarget(message) && !/\b(?:whole|entire|full)\s+(?:session|workout|day|thing)\b/i.test(message)) {
    return false;
  }
  return (
    /\b(?:whole|entire|full)\s+(?:session|workout|day|thing)\b/i.test(message) ||
    /\b(?:session|workout|day)\s+fully\b/i.test(message) ||
    /\b(?:remove|drop|ditch|scrap|skip|cancel|cut|delete)\b[^.?!,;]*\b(?:session|workout|day)\b/i.test(message) ||
    /\b(?:remove|drop|ditch|scrap|skip|cancel|cut|delete)\b[^.?!,;]*\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(message)
  );
}

function hasReduceOrFatigueIntent(message: string): boolean {
  return (
    /\b(?:easier|lighter|less|reduce|deload|back\s+it\s+off|too\s+much|lower[-\s]*load)\b/i.test(message) ||
    /\b(?:cooked|sore|tight|fried|wrecked|smoked|toast|flat|exhausted|fatigued|drained|knackered|low\s+energy|no\s+energy)\b/i.test(message)
  );
}

function normaliseItemTitle(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:light|easy|gentle|hard|moderate|conditioning|session|block)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function preserveCase(original: string, replacement: string): string {
  if (original.toUpperCase() === original) return replacement.toUpperCase();
  if (original[0]?.toUpperCase() === original[0]) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function levenshteinAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) {
      i += 1;
    } else if (b.length > a.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function levenshteinDistanceAtMost(a: string, b: string, limit: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return false;
    previous = current;
  }
  return previous[b.length] <= limit;
}
