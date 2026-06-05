import type { ResolvedDay } from './sessionResolver';
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
import { resumeFromPending } from './coachClarifierResume';
import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';
import {
  executeCoachCommand,
  type ExecuteCoachCommandInput,
  type ExecutionResult,
} from './coachCommandExecutor';
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
import { useProgramStore } from '../store/programStore';
import { logger } from './logger';

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
  | 'add_whole_session'
  | 'remove_whole_session';

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
  source?: 'pending_clarifier' | 'router' | 'llm_adapter' | 'provided_command';
  semanticRoles?: ProgramEditSemanticRoles;
  protectedTargets?: ProgramEditCandidateItem[];
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
  targetItemId: string;
  requestedChange: 'type' | 'unknown';
}

export interface RemoveSessionEdit extends ProgramEditBase {
  targetDomain: 'session';
  intent: 'remove';
  editScope: 'remove_whole_session';
  targetDate: string;
  targetSessionId: string | null;
  targetItemId: null;
  requestedChange: 'day';
  protectedTargets?: ProgramEditCandidateItem[];
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
  | AddSessionEdit
  | RemoveSessionEdit
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
];

export function interpretCoachMessageToProgramEdit(
  input: InterpretCoachMessageToProgramEditInput,
): ProgramEdit {
  const normalizedMessage = normalizeCoachEditMessage(input.userMessage);
  const semanticRoles = extractProgramEditSemanticRoles(normalizedMessage);

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

export function executeProgramEdit(
  input: ExecuteProgramEditInput,
): ExecutionResult {
  const edit = input.programEdit;
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

  if (
    (edit.intent === 'edit' || edit.intent === 'remove' || edit.intent === 'replace') &&
    !edit.targetItemId &&
    edit.targetDomain !== 'session'
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
    edit.intent === 'remove'
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
): ResolvedDay['workout'] | null {
  if (edit.targetDomain !== 'conditioning' || !edit.targetDate) return null;
  const seam =
    phase === 'before'
      ? input.conditioningDeps?.snapshotBefore
      : input.conditioningDeps?.snapshotAfter;
  if (seam) return seam(edit.targetDate);

  if (input.conditioningDeps) {
    return null;
  }

  try {
    const programState = useProgramStore.getState();
    return getResolvedVisibleProgramForDate({
      date: edit.targetDate,
      todayISO: input.todayISO,
      state: buildScheduleStateImperative(),
      overrideContexts: programState.overrideContexts ?? {},
    }).day.workout ?? null;
  } catch (e) {
    logger.warn('[coach-program-edit-visible-snapshot-failed]', {
      targetDate: edit.targetDate,
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
  currentWeek?: VisibleSessionRef[];
  resolveVisibleProgramForDate?: ResolveVisibleProgramForDate;
}): PendingProgramEditAnswerResult {
  const edit = input.pending.programEdit;
  if (!edit) {
    return { kind: 'unresolved' };
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

export function programEditFromCoachCommand(
  command: CoachCommand,
  input: InterpretCoachMessageToProgramEditInput & {
    normalizedMessage?: string;
  },
): ProgramEdit {
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

  return {
    ...draft,
    targetDomain: draft.targetDomain as Exclude<ProgramEditTargetDomain, 'conditioning'>,
    intent: draft.intent as Exclude<ProgramEditIntent, 'ask_question' | 'explain'>,
    editScope: undefined as never,
  };
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
    !draft.targetItemId
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
      if (!draft.targetItemId) {
        return askQuestionFromDraft({ ...draft, editScope }, ['targetItemId']);
      }
      return {
        ...draft,
        targetDomain: 'conditioning',
        intent: 'remove',
        editScope,
        targetDate: draft.targetDate,
        targetItemId: draft.targetItemId,
        requestedChange: draft.requestedChange === 'unknown' ? 'unknown' : 'type',
      };
    }
    case 'remove_whole_session':
    case 'add_whole_session':
      return askQuestionFromDraft({ ...draft, editScope }, ['editScope']);
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
  protectedTargets: ProgramEditCandidateItem[];
  beforeSources: Array<{ id: string; title: string; modality: ConditioningModality | null; durationMinutes: number | null }>;
  afterSources: Array<{ id: string; title: string; modality: ConditioningModality | null; durationMinutes: number | null }>;
  editableTargetItemId: string | null;
}): ProgramEditVisibleVerification {
  for (const protectedTarget of args.protectedTargets) {
    if (protectedTarget.id === args.editableTargetItemId) continue;
    const before = args.beforeSources.find((item) => item.id === protectedTarget.id);
    const after = args.afterSources.find((item) => item.id === protectedTarget.id);
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
  if (command.operation === 'move_session' || command.operation === 'remove_session' || command.operation === 'add_session') return 'day';
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
    /\b(?:cooked|sore|tight|fried|wrecked|smoked|toast)\b/i.test(message)
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
