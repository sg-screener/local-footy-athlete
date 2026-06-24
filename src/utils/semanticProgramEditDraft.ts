import type { ResolvedDay } from './sessionResolver';
import type {
  CoachExplicitDateRole,
  CoachResolvedTarget,
  CoachResolvedTargetKind,
  CoachTargetFrame,
} from './coachTargetFrame';
import type {
  ProgramEditDraft,
  ProgramEditDraftAction,
  ProgramEditDraftActionScope,
  ProgramEditDraftIntent,
  ProgramEditDraftProtectedTarget,
  ProgramEditDraftTargetDomain,
  ProgramEditVerifierExpectation,
  ProgramEditVerifierExpectationKind,
} from './coachProgramEditDraft';
import { extractVisibleProgramItemsFromWorkout } from './visibleProgramReadModel';
import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';

export const SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION = 'program_edit_draft.v1';

export const SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA = {
  schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
  topLevelKeys: [
    'schemaVersion',
    'status',
    'confidence',
    'draft',
    'clarificationQuestion',
    'candidateOptions',
    'reason',
  ],
  status: ['draft', 'clarify', 'not_program_edit', 'unsupported'],
  intent: ['add', 'edit', 'remove', 'replace', 'move', 'reduce', 'explain', 'ask_question'],
  targetDomain: ['strength', 'conditioning', 'session', 'recovery', 'setup', 'schedule'],
  actionScope: [
    'whole_session',
    'strength_block',
    'conditioning_block',
    'exercise',
    'duration',
    'intensity',
    'modality',
    'setup',
  ],
  explicitDateRole: ['referent', 'destination', 'none', 'ambiguous'],
  verifierExpectationKind: [
    'domain_changed',
    'domain_unchanged',
    'session_removed',
    'item_added',
    'ask_before_execution',
  ],
} as const;

export type SemanticProgramEditDraftStatus =
  | 'draft'
  | 'clarify'
  | 'not_program_edit'
  | 'unsupported';

export interface SemanticProgramEditDraftResponse {
  schemaVersion: typeof SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION;
  status: SemanticProgramEditDraftStatus;
  confidence: number;
  draft: ProgramEditDraft | null;
  clarificationQuestion?: string;
  candidateOptions?: string[];
  reason: string;
}

export interface SemanticProgramEditDraftAdapterInput {
  userMessage: string;
  targetFrame: CoachTargetFrame | null;
  visibleWeek: ResolvedDay[];
  pendingClarifier?: PendingCoachClarifier | null;
  currentProgramContext?: unknown;
}

export interface SemanticProgramEditDraftAdapter {
  buildDraft(
    input: SemanticProgramEditDraftAdapterInput,
  ): Promise<unknown> | unknown;
}

export interface BuildSemanticProgramEditDraftInput
  extends SemanticProgramEditDraftAdapterInput {
  adapter: SemanticProgramEditDraftAdapter;
  minConfidence?: number;
}

export type SemanticProgramEditDraftResult =
  | {
      kind: 'draft';
      draft: ProgramEditDraft;
      response: SemanticProgramEditDraftResponse;
      confidence: number;
    }
  | {
      kind: 'clarify';
      reply: string;
      options?: string[];
      response?: SemanticProgramEditDraftResponse;
      confidence: number;
      reason: string;
    }
  | {
      kind: 'not_program_edit';
      response: SemanticProgramEditDraftResponse;
      confidence: number;
    }
  | {
      kind: 'unsupported';
      reply: string;
      response: SemanticProgramEditDraftResponse;
      confidence: number;
      reason: string;
    }
  | {
      kind: 'invalid';
      reason: string;
      issues: string[];
      raw: unknown;
    };

export class MockSemanticProgramEditDraftAdapter implements SemanticProgramEditDraftAdapter {
  constructor(private readonly response: unknown) {}

  buildDraft(): unknown {
    return this.response;
  }
}

export async function buildSemanticProgramEditDraft(
  input: BuildSemanticProgramEditDraftInput,
): Promise<SemanticProgramEditDraftResult> {
  let raw: unknown;
  try {
    raw = await input.adapter.buildDraft({
      userMessage: input.userMessage,
      targetFrame: input.targetFrame,
      visibleWeek: input.visibleWeek,
      pendingClarifier: input.pendingClarifier,
      currentProgramContext: input.currentProgramContext,
    });
  } catch (err) {
    return {
      kind: 'invalid',
      reason: 'adapter_failed',
      issues: [err instanceof Error ? err.message : String(err)],
      raw: null,
    };
  }

  return parseSemanticProgramEditDraftResponse({
    raw,
    targetFrame: input.targetFrame,
    visibleWeek: input.visibleWeek,
    minConfidence: input.minConfidence,
  });
}

export function parseSemanticProgramEditDraftResponse(input: {
  raw: unknown;
  targetFrame: CoachTargetFrame | null;
  visibleWeek: ResolvedDay[];
  minConfidence?: number;
}): SemanticProgramEditDraftResult {
  const parsed = parseRawSemanticResponse(input.raw);
  if (!parsed.ok) {
    return {
      kind: 'invalid',
      reason: 'malformed_json',
      issues: [parsed.issue],
      raw: input.raw,
    };
  }

  const context = semanticValidationContext(input.visibleWeek, input.targetFrame);
  const validated = validateSemanticResponse(parsed.value, context);
  if (!validated.ok) {
    return {
      kind: 'invalid',
      reason: 'schema_validation_failed',
      issues: validated.issues,
      raw: input.raw,
    };
  }

  const response = validated.response;
  const minConfidence = input.minConfidence ?? 0.65;
  if (response.confidence < minConfidence) {
    return {
      kind: 'clarify',
      reply:
        response.clarificationQuestion ??
        'I think that is a program edit, but I need one more detail before changing anything.',
      options: response.candidateOptions,
      response,
      confidence: response.confidence,
      reason: 'semantic_draft_low_confidence',
    };
  }

  if (response.status === 'clarify') {
    return {
      kind: 'clarify',
      reply:
        response.clarificationQuestion ??
        'What exactly should I change?',
      options: response.candidateOptions,
      response,
      confidence: response.confidence,
      reason: response.reason,
    };
  }

  if (response.status === 'not_program_edit') {
    return {
      kind: 'not_program_edit',
      response,
      confidence: response.confidence,
    };
  }

  if (response.status === 'unsupported') {
    return {
      kind: 'unsupported',
      reply:
        response.clarificationQuestion ??
        'I understand the edit, but I cannot safely apply that change yet.',
      response,
      confidence: response.confidence,
      reason: response.reason,
    };
  }

  if (!response.draft) {
    return {
      kind: 'invalid',
      reason: 'missing_draft',
      issues: ['draft response must include draft'],
      raw: input.raw,
    };
  }

  return {
    kind: 'draft',
    draft: response.draft,
    response,
    confidence: response.confidence,
  };
}

type RawParseResult =
  | { ok: true; value: unknown }
  | { ok: false; issue: string };

function parseRawSemanticResponse(raw: unknown): RawParseResult {
  if (typeof raw === 'string') {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (err) {
      return {
        ok: false,
        issue: err instanceof Error ? err.message : 'invalid JSON string',
      };
    }
  }
  return { ok: true, value: raw };
}

interface SemanticValidationContext {
  dates: Set<string>;
  itemIds: Set<string>;
  sessionIds: Set<string>;
  targetFrame: CoachTargetFrame | null;
}

type SemanticValidationResult =
  | { ok: true; response: SemanticProgramEditDraftResponse }
  | { ok: false; issues: string[] };

function semanticValidationContext(
  visibleWeek: ResolvedDay[],
  targetFrame: CoachTargetFrame | null,
): SemanticValidationContext {
  const dates = new Set<string>();
  const itemIds = new Set<string>();
  const sessionIds = new Set<string>();

  for (const day of visibleWeek) {
    if (day.date) dates.add(day.date);
    const workout = day.workout;
    if (workout && (workout as any).id) sessionIds.add(String((workout as any).id));
    for (const item of extractVisibleProgramItemsFromWorkout(workout)) {
      itemIds.add(item.id);
      for (const exerciseId of item.exerciseIds) itemIds.add(exerciseId);
    }
    for (const exercise of (workout as any)?.exercises ?? []) {
      const id = String(exercise?.id ?? exercise?.exerciseId ?? exercise?.exercise?.id ?? '');
      if (id) itemIds.add(id);
    }
  }

  const target = targetFrame?.resolvedTarget;
  if (target?.date) dates.add(target.date);
  if (target?.itemId) {
    itemIds.add(target.itemId);
    if (target.kind === 'session') sessionIds.add(target.itemId);
  }

  return { dates, itemIds, sessionIds, targetFrame };
}

function validateSemanticResponse(
  raw: unknown,
  context: SemanticValidationContext,
): SemanticValidationResult {
  const issues: string[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, issues: ['response must be an object'] };
  }

  assertExactKeys(raw, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.topLevelKeys], 'response', issues);
  const schemaVersion = stringValue(raw.schemaVersion);
  if (schemaVersion !== SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION) {
    issues.push(`response.schemaVersion must be ${SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION}`);
  }
  const status = enumValue<SemanticProgramEditDraftStatus>(
    raw.status,
    [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.status],
    'response.status',
    issues,
  );
  const confidence = numberValue(raw.confidence, 'response.confidence', issues);
  if (confidence != null && (confidence < 0 || confidence > 1)) {
    issues.push('response.confidence must be between 0 and 1');
  }
  const reason = stringValue(raw.reason);
  if (!reason) issues.push('response.reason must be a non-empty string');

  const clarificationQuestion = optionalStringValue(raw.clarificationQuestion, 'response.clarificationQuestion', issues);
  const candidateOptions = optionalStringArrayValue(raw.candidateOptions, 'response.candidateOptions', issues);

  const draftRaw = raw.draft;
  const draft = draftRaw == null
    ? null
    : validateDraft(draftRaw, 'response.draft', context, issues);

  if (status === 'draft' && !draft) {
    issues.push('response.draft is required when status is draft');
  }
  if (status !== 'draft' && draftRaw != null && !draft) {
    issues.push('response.draft must be null or valid for non-draft statuses');
  }

  if (issues.length > 0 || !status || confidence == null || !reason) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    response: {
      schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
      status,
      confidence,
      draft,
      ...(clarificationQuestion ? { clarificationQuestion } : {}),
      ...(candidateOptions ? { candidateOptions } : {}),
      reason,
    },
  };
}

function validateDraft(
  raw: unknown,
  path: string,
  context: SemanticValidationContext,
  issues: string[],
): ProgramEditDraft | null {
  if (!isPlainObject(raw)) {
    issues.push(`${path} must be an object`);
    return null;
  }
  assertExactKeys(raw, [
    'intent',
    'targetDomain',
    'actionScope',
    'targetDate',
    'targetSessionId',
    'targetItemId',
    'sourceTarget',
    'explicitDateRole',
    'explicitUserWording',
    'missingFields',
    'confidence',
    'protectedTargets',
    'constraints',
    'proposedActions',
    'verifierExpectations',
    'isCompound',
    'reason',
  ], path, issues);

  const intent = enumValue<ProgramEditDraftIntent>(raw.intent, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.intent], `${path}.intent`, issues);
  const targetDomain = enumValue<ProgramEditDraftTargetDomain>(raw.targetDomain, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.targetDomain], `${path}.targetDomain`, issues);
  const actionScope = enumValue<ProgramEditDraftActionScope>(raw.actionScope, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.actionScope], `${path}.actionScope`, issues);
  const targetDate = optionalNullableStringValue(raw.targetDate, `${path}.targetDate`, issues);
  const targetSessionId = optionalNullableStringValue(raw.targetSessionId, `${path}.targetSessionId`, issues);
  const targetItemId = optionalNullableStringValue(raw.targetItemId, `${path}.targetItemId`, issues);
  const sourceTarget = validateSourceTarget(raw.sourceTarget, `${path}.sourceTarget`, context, issues);
  const explicitDateRole = enumValue<CoachExplicitDateRole>(raw.explicitDateRole, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.explicitDateRole], `${path}.explicitDateRole`, issues);
  const explicitUserWording = stringValue(raw.explicitUserWording);
  if (!explicitUserWording) issues.push(`${path}.explicitUserWording must be a non-empty string`);
  const missingFields = stringArrayValue(raw.missingFields, `${path}.missingFields`, issues);
  const confidence = numberValue(raw.confidence, `${path}.confidence`, issues);
  if (confidence != null && (confidence < 0 || confidence > 1)) {
    issues.push(`${path}.confidence must be between 0 and 1`);
  }
  const protectedTargets = validateArray(raw.protectedTargets, `${path}.protectedTargets`, issues, (item, index) =>
    validateProtectedTarget(item, `${path}.protectedTargets[${index}]`, context, issues),
  );
  const constraints = stringArrayValue(raw.constraints, `${path}.constraints`, issues);
  const proposedActions = validateArray(raw.proposedActions, `${path}.proposedActions`, issues, (item, index) =>
    validateAction(item, `${path}.proposedActions[${index}]`, context, issues),
  );
  const verifierExpectations = validateArray(raw.verifierExpectations, `${path}.verifierExpectations`, issues, (item, index) =>
    validateVerifierExpectation(item, `${path}.verifierExpectations[${index}]`, context, issues),
  );
  const isCompound = booleanValue(raw.isCompound, `${path}.isCompound`, issues);
  const reason = stringValue(raw.reason);
  if (!reason) issues.push(`${path}.reason must be a non-empty string`);

  validateDateInContext(targetDate, `${path}.targetDate`, context, issues);
  validateIdInContext(targetSessionId, `${path}.targetSessionId`, context.sessionIds, issues);
  validateIdInContext(targetItemId, `${path}.targetItemId`, context.itemIds, issues);

  if (
    !intent ||
    !targetDomain ||
    !actionScope ||
    !explicitDateRole ||
    !explicitUserWording ||
    !missingFields ||
    confidence == null ||
    !protectedTargets ||
    !constraints ||
    !proposedActions ||
    !verifierExpectations ||
    isCompound == null ||
    !reason
  ) {
    return null;
  }

  return {
    intent,
    targetDomain,
    actionScope,
    targetDate,
    targetSessionId,
    targetItemId,
    sourceTarget,
    explicitDateRole,
    explicitUserWording,
    missingFields,
    confidence,
    protectedTargets,
    constraints,
    proposedActions,
    verifierExpectations,
    isCompound,
    reason,
  };
}

function validateAction(
  raw: unknown,
  path: string,
  context: SemanticValidationContext,
  issues: string[],
): ProgramEditDraftAction | null {
  if (!isPlainObject(raw)) {
    issues.push(`${path} must be an object`);
    return null;
  }
  assertExactKeys(raw, [
    'intent',
    'targetDomain',
    'actionScope',
    'targetDate',
    'targetSessionId',
    'targetItemId',
    'sourceTarget',
    'reason',
  ], path, issues);

  const intent = enumValue<ProgramEditDraftAction['intent']>(raw.intent, ['add', 'edit', 'remove', 'replace', 'move'], `${path}.intent`, issues);
  const targetDomain = enumValue<ProgramEditDraftTargetDomain>(raw.targetDomain, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.targetDomain], `${path}.targetDomain`, issues);
  const actionScope = enumValue<ProgramEditDraftActionScope>(raw.actionScope, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.actionScope], `${path}.actionScope`, issues);
  const targetDate = optionalNullableStringValue(raw.targetDate, `${path}.targetDate`, issues);
  const targetSessionId = optionalNullableStringValue(raw.targetSessionId, `${path}.targetSessionId`, issues);
  const targetItemId = optionalNullableStringValue(raw.targetItemId, `${path}.targetItemId`, issues);
  const sourceTarget = validateSourceTarget(raw.sourceTarget, `${path}.sourceTarget`, context, issues);
  const reason = stringValue(raw.reason);
  if (!reason) issues.push(`${path}.reason must be a non-empty string`);

  validateDateInContext(targetDate, `${path}.targetDate`, context, issues);
  validateIdInContext(targetSessionId, `${path}.targetSessionId`, context.sessionIds, issues);
  validateIdInContext(targetItemId, `${path}.targetItemId`, context.itemIds, issues);

  if (!intent || !targetDomain || !actionScope || !reason) return null;
  return {
    intent,
    targetDomain,
    actionScope,
    targetDate,
    targetSessionId,
    targetItemId,
    sourceTarget,
    reason,
  };
}

function validateProtectedTarget(
  raw: unknown,
  path: string,
  context: SemanticValidationContext,
  issues: string[],
): ProgramEditDraftProtectedTarget | null {
  if (!isPlainObject(raw)) {
    issues.push(`${path} must be an object`);
    return null;
  }
  assertExactKeys(raw, [
    'targetDomain',
    'actionScope',
    'targetDate',
    'targetItemId',
    'title',
    'reason',
  ], path, issues);

  const targetDomain = enumValue<ProgramEditDraftTargetDomain>(raw.targetDomain, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.targetDomain], `${path}.targetDomain`, issues);
  const actionScope = raw.actionScope == null
    ? undefined
    : enumValue<ProgramEditDraftActionScope>(raw.actionScope, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.actionScope], `${path}.actionScope`, issues);
  const targetDate = optionalNullableStringValue(raw.targetDate, `${path}.targetDate`, issues);
  const targetItemId = optionalNullableStringValue(raw.targetItemId, `${path}.targetItemId`, issues);
  const title = optionalNullableStringValue(raw.title, `${path}.title`, issues);
  const reason = stringValue(raw.reason);
  if (!reason) issues.push(`${path}.reason must be a non-empty string`);

  validateDateInContext(targetDate, `${path}.targetDate`, context, issues);
  validateIdInContext(targetItemId, `${path}.targetItemId`, context.itemIds, issues);

  if (!targetDomain || !reason) return null;
  return {
    targetDomain,
    ...(actionScope ? { actionScope } : {}),
    targetDate,
    targetItemId,
    title,
    reason,
  };
}

function validateVerifierExpectation(
  raw: unknown,
  path: string,
  context: SemanticValidationContext,
  issues: string[],
): ProgramEditVerifierExpectation | null {
  if (!isPlainObject(raw)) {
    issues.push(`${path} must be an object`);
    return null;
  }
  assertExactKeys(raw, [
    'kind',
    'targetDomain',
    'actionScope',
    'targetDate',
    'reason',
  ], path, issues);

  const kind = enumValue<ProgramEditVerifierExpectationKind>(raw.kind, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.verifierExpectationKind], `${path}.kind`, issues);
  const targetDomain = raw.targetDomain == null
    ? undefined
    : enumValue<ProgramEditDraftTargetDomain>(raw.targetDomain, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.targetDomain], `${path}.targetDomain`, issues);
  const actionScope = raw.actionScope == null
    ? undefined
    : enumValue<ProgramEditDraftActionScope>(raw.actionScope, [...SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA.actionScope], `${path}.actionScope`, issues);
  const targetDate = optionalNullableStringValue(raw.targetDate, `${path}.targetDate`, issues);
  const reason = stringValue(raw.reason);
  if (!reason) issues.push(`${path}.reason must be a non-empty string`);

  validateDateInContext(targetDate, `${path}.targetDate`, context, issues);

  if (!kind || !reason) return null;
  return {
    kind,
    ...(targetDomain ? { targetDomain } : {}),
    ...(actionScope ? { actionScope } : {}),
    targetDate,
    reason,
  };
}

function validateSourceTarget(
  raw: unknown,
  path: string,
  context: SemanticValidationContext,
  issues: string[],
): CoachResolvedTarget | null {
  if (raw == null) return null;
  if (!isPlainObject(raw)) {
    issues.push(`${path} must be null or an object`);
    return null;
  }
  assertExactKeys(raw, [
    'kind',
    'date',
    'sessionName',
    'itemId',
    'itemTitle',
    'domain',
    'stillVisible',
  ], path, issues);

  const kind = enumValue<CoachResolvedTargetKind>(raw.kind, ['session', 'conditioning_item', 'exercise', 'day'], `${path}.kind`, issues);
  const date = stringValue(raw.date);
  if (!date) issues.push(`${path}.date must be a non-empty string`);
  const sessionName = optionalStringValue(raw.sessionName, `${path}.sessionName`, issues);
  const itemId = optionalStringValue(raw.itemId, `${path}.itemId`, issues);
  const itemTitle = optionalStringValue(raw.itemTitle, `${path}.itemTitle`, issues);
  const domain = raw.domain == null
    ? undefined
    : enumValue<CoachResolvedTarget['domain']>(raw.domain, ['session', 'conditioning', 'strength', 'schedule'], `${path}.domain`, issues);
  const stillVisible = booleanValue(raw.stillVisible, `${path}.stillVisible`, issues);

  validateDateInContext(date, `${path}.date`, context, issues);
  if (kind === 'session') {
    validateIdInContext(itemId, `${path}.itemId`, context.sessionIds, issues);
  } else {
    validateIdInContext(itemId, `${path}.itemId`, context.itemIds, issues);
  }

  if (!kind || !date || stillVisible == null) return null;
  return {
    kind,
    date,
    ...(sessionName ? { sessionName } : {}),
    ...(itemId ? { itemId } : {}),
    ...(itemTitle ? { itemTitle } : {}),
    ...(domain ? { domain } : {}),
    stillVisible,
  };
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  path: string,
  issues: string[],
) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(`${path}.${key} is not supported`);
  }
}

function validateDateInContext(
  date: string | null,
  path: string,
  context: SemanticValidationContext,
  issues: string[],
) {
  if (!date) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    issues.push(`${path} must be YYYY-MM-DD`);
    return;
  }
  if (!context.dates.has(date)) {
    issues.push(`${path} is not present in the target frame or visible week`);
  }
}

function validateIdInContext(
  id: string | null | undefined,
  path: string,
  allowedIds: Set<string>,
  issues: string[],
) {
  if (!id) return;
  if (!allowedIds.has(id)) {
    issues.push(`${path} is not present in the target frame or visible week`);
  }
}

function validateArray<T>(
  raw: unknown,
  path: string,
  issues: string[],
  itemValidator: (item: unknown, index: number) => T | null,
): T[] | null {
  if (!Array.isArray(raw)) {
    issues.push(`${path} must be an array`);
    return null;
  }
  const out: T[] = [];
  raw.forEach((item, index) => {
    const validated = itemValidator(item, index);
    if (validated) out.push(validated);
  });
  return out;
}

function enumValue<T extends string>(
  raw: unknown,
  allowed: readonly string[],
  path: string,
  issues: string[],
): T | null {
  if (typeof raw !== 'string') {
    issues.push(`${path} must be a string`);
    return null;
  }
  if (!allowed.includes(raw)) {
    issues.push(`${path} has unsupported value ${raw}`);
    return null;
  }
  return raw as T;
}

function stringValue(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function optionalStringValue(
  raw: unknown,
  path: string,
  issues: string[],
): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'string') {
    issues.push(`${path} must be a string`);
    return undefined;
  }
  return raw;
}

function optionalNullableStringValue(
  raw: unknown,
  path: string,
  issues: string[],
): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') {
    issues.push(`${path} must be a string or null`);
    return null;
  }
  return raw;
}

function optionalStringArrayValue(
  raw: unknown,
  path: string,
  issues: string[],
): string[] | undefined {
  if (raw == null) return undefined;
  return stringArrayValue(raw, path, issues) ?? undefined;
}

function stringArrayValue(
  raw: unknown,
  path: string,
  issues: string[],
): string[] | null {
  if (!Array.isArray(raw)) {
    issues.push(`${path} must be an array`);
    return null;
  }
  const out: string[] = [];
  raw.forEach((item, index) => {
    if (typeof item !== 'string') {
      issues.push(`${path}[${index}] must be a string`);
      return;
    }
    out.push(item);
  });
  return out;
}

function numberValue(
  raw: unknown,
  path: string,
  issues: string[],
): number | null {
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    issues.push(`${path} must be a number`);
    return null;
  }
  return raw;
}

function booleanValue(
  raw: unknown,
  path: string,
  issues: string[],
): boolean | null {
  if (typeof raw !== 'boolean') {
    issues.push(`${path} must be a boolean`);
    return null;
  }
  return raw;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
