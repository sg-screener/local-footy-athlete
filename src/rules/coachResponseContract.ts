import type { CoachSnapshot } from './liveAthleteSnapshot';

/** Pure automatic response boundary shared by Coach Lab and the live endpoint. */

export type CoachResponseBasis =
  | 'athlete_snapshot'
  | 'lfa_rule'
  | 'coaching_judgement'
  | 'general_s_and_c';

export type CoachResponseSnapshotField = keyof Pick<
  CoachSnapshot,
  'visibleWeek' | 'thisWeek' | 'readiness' | 'load' | 'progress' | 'restrictions'
>;

export interface CoachResponseKnowledgeSource {
  readonly id: string;
  readonly authority: 'lfa_bible' | 'active_rule' | 'canonical_source' | 'approved_example';
  readonly sourceReference: string;
}

export interface CoachResponseProgramAction {
  readonly kind: string;
  readonly label: string;
}

export interface CoachResponsePayload {
  readonly message: string;
  readonly answerMode: 'answer' | 'focused_question' | 'honest_limit' | 'generic_refusal';
  readonly basis: readonly CoachResponseBasis[];
  readonly snapshotFieldsUsed: readonly CoachResponseSnapshotField[];
  readonly knowledgeSources: readonly CoachResponseKnowledgeSource[];
  readonly judgementLabel: 'not_needed' | 'labelled' | 'missing';
  readonly programActions: readonly CoachResponseProgramAction[];
}

export interface CoachResponseAutomaticChecks {
  readonly schemaValid: boolean;
  readonly useful: boolean;
  readonly readOnly: boolean;
  readonly programFactsGrounded: boolean;
  readonly lfaClaimsGrounded: boolean;
  readonly judgementTransparent: boolean;
  readonly concise: boolean;
  readonly changeClaimsTruthful: boolean;
}

export interface CoachResponseContractEvaluation {
  readonly ok: boolean;
  readonly automaticChecks: CoachResponseAutomaticChecks;
  readonly violations: readonly (keyof CoachResponseAutomaticChecks)[];
}

const BASIS = new Set<string>([
  'athlete_snapshot',
  'lfa_rule',
  'coaching_judgement',
  'general_s_and_c',
]);
const SNAPSHOT_FIELDS = new Set<string>([
  'visibleWeek',
  'thisWeek',
  'readiness',
  'load',
  'progress',
  'restrictions',
]);
const ANSWER_MODES = new Set<string>([
  'answer',
  'focused_question',
  'honest_limit',
  'generic_refusal',
]);
const JUDGEMENT_LABELS = new Set<string>(['not_needed', 'labelled', 'missing']);
const SOURCE_AUTHORITIES = new Set<string>([
  'lfa_bible',
  'active_rule',
  'canonical_source',
  'approved_example',
]);

export const COACH_RESPONSE_MAX_ANSWER_WORDS = 100;

/**
 * Last-resort semantic tripwire for the false-authority class the retired
 * Coach exhibited: claiming a program mutation when none can have happened.
 */
export const READ_ONLY_FALSE_CHANGE_PATTERNS: readonly RegExp[] = [
  /\bprogram\s+updated\b/i,
  /\bI\s+changed\b/i,
  /\bI\s+reduced\b/i,
  /\blighter\s+loads?\b/i,
  /\bsubbed?\s+in\b/i,
  /\bcap(p|ping|ped)\s+the\s+hard\s+sessions?\b/i,
  /\badjusted\s+your\s+week\b/i,
  /\bI\s+adjusted\b/i,
  /\bI\s+removed\b/i,
  /\bI\s+swapped\b/i,
  /\bI\s+pulled\s+back\b/i,
  /\bI(?:'ve|\s+have)?\s+pulled\s+back\b/i,
  /\bpulled\s+back\b/i,
  /\bnow\s+adjusted\b/i,
  /\bI\s+moved\b/i,
  /\bI(?:'ve|\s+have)\s+moved\b/i,
  /\bmoved\s+your\b/i,
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown, allowed: ReadonlySet<string>): value is readonly string[] {
  return Array.isArray(value)
    && value.every((entry) => typeof entry === 'string' && allowed.has(entry));
}

function validKnowledgeSource(value: unknown): value is CoachResponseKnowledgeSource {
  return record(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.sourceReference === 'string'
    && value.sourceReference.length > 0
    && typeof value.authority === 'string'
    && SOURCE_AUTHORITIES.has(value.authority);
}

function validProgramAction(value: unknown): value is CoachResponseProgramAction {
  return record(value)
    && typeof value.kind === 'string'
    && typeof value.label === 'string';
}

export function isCoachResponsePayload(value: unknown): value is CoachResponsePayload {
  return record(value)
    && typeof value.message === 'string'
    && value.message.trim().length > 0
    && typeof value.answerMode === 'string'
    && ANSWER_MODES.has(value.answerMode)
    && stringArray(value.basis, BASIS)
    && stringArray(value.snapshotFieldsUsed, SNAPSHOT_FIELDS)
    && Array.isArray(value.knowledgeSources)
    && value.knowledgeSources.every(validKnowledgeSource)
    && typeof value.judgementLabel === 'string'
    && JUDGEMENT_LABELS.has(value.judgementLabel)
    && Array.isArray(value.programActions)
    && value.programActions.every(validProgramAction);
}

function wordCount(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

export interface CoachResponseGroundingPolicy {
  readonly requiresLiveProgramFacts: boolean;
  readonly allowedKnowledgeSourceIds: readonly string[];
}

export type CoachResponseContractFailureCode = 'invalid_answer' | 'refused';

/**
 * Usability failures mean the provider produced no answer the app can show.
 * Truth, grounding and read-only failures are refusals. Keeping this decision
 * beside the checks prevents the transport from turning "too long" into a
 * false safety claim about the athlete's question.
 */
export function coachResponseContractFailureCode(
  evaluation: CoachResponseContractEvaluation,
): CoachResponseContractFailureCode | null {
  if (evaluation.ok) return null;
  const checks = evaluation.automaticChecks;
  if (!checks.schemaValid) return 'invalid_answer';
  if (!checks.readOnly
    || !checks.programFactsGrounded
    || !checks.lfaClaimsGrounded
    || !checks.judgementTransparent
    || !checks.changeClaimsTruthful) {
    return 'refused';
  }
  return 'invalid_answer';
}

export function evaluateCoachResponseContract(
  response: unknown,
  policy: CoachResponseGroundingPolicy,
): CoachResponseContractEvaluation {
  const schemaValid = isCoachResponsePayload(response);
  const payload = schemaValid ? response : null;
  const basis = payload?.basis ?? [];
  const snapshotFields = payload?.snapshotFieldsUsed ?? [];
  const sources = payload?.knowledgeSources ?? [];
  const usesSnapshot = basis.includes('athlete_snapshot');
  const claimsLfaRule = basis.includes('lfa_rule');
  const usesJudgement = basis.includes('coaching_judgement');
  const focusedQuestionWithoutFacts = payload?.answerMode === 'focused_question'
    && !usesSnapshot
    && snapshotFields.length === 0;
  const snapshotReceiptConsistent = usesSnapshot
    ? snapshotFields.length > 0
    : snapshotFields.length === 0;
  const allowedIds = new Set(policy.allowedKnowledgeSourceIds);
  const sourcesWereRetrieved = sources.every((source) => allowedIds.has(source.id));
  const checks: CoachResponseAutomaticChecks = {
    schemaValid,
    useful: payload !== null && payload.answerMode !== 'generic_refusal',
    readOnly: payload !== null && payload.programActions.length === 0,
    programFactsGrounded: payload !== null
      && snapshotReceiptConsistent
      && (!policy.requiresLiveProgramFacts
        || focusedQuestionWithoutFacts
        || usesSnapshot),
    lfaClaimsGrounded: payload !== null
      && sourcesWereRetrieved
      && (!claimsLfaRule || sources.some(
        (source) => source.authority === 'lfa_bible' || source.authority === 'active_rule',
      )),
    judgementTransparent: payload !== null
      && (!usesJudgement || payload.judgementLabel === 'labelled'),
    concise: payload !== null
      && wordCount(payload.message) <= COACH_RESPONSE_MAX_ANSWER_WORDS,
    changeClaimsTruthful: payload !== null
      && !READ_ONLY_FALSE_CHANGE_PATTERNS.some((pattern) => pattern.test(payload.message)),
  };
  const violations = (Object.keys(checks) as (keyof CoachResponseAutomaticChecks)[])
    .filter((name) => !checks[name]);
  return { ok: violations.length === 0, automaticChecks: checks, violations };
}
