import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';

export const COACH_LAB_RESPONSE_SCHEMA_VERSION = 1 as const;

export type CoachLabBasis =
  | 'athlete_snapshot'
  | 'lfa_rule'
  | 'coaching_judgement'
  | 'general_s_and_c';

export type CoachLabSnapshotField = keyof Pick<
  CoachSnapshot,
  'visibleWeek' | 'thisWeek' | 'readiness' | 'load' | 'progress' | 'restrictions'
>;

export interface CoachLabKnowledgeSource {
  readonly id: string;
  readonly authority: 'lfa_bible' | 'active_rule' | 'canonical_source' | 'approved_example';
  readonly sourceReference: string;
}

export interface CoachLabProgramAction {
  readonly kind: string;
  readonly label: string;
}

export interface CoachLabResponseV1 {
  readonly schemaVersion: typeof COACH_LAB_RESPONSE_SCHEMA_VERSION;
  readonly message: string;
  readonly answerMode: 'answer' | 'focused_question' | 'honest_limit' | 'generic_refusal';
  readonly basis: readonly CoachLabBasis[];
  readonly snapshotFieldsUsed: readonly CoachLabSnapshotField[];
  readonly knowledgeSources: readonly CoachLabKnowledgeSource[];
  readonly judgementLabel: 'not_needed' | 'labelled' | 'missing';
  readonly programActions: readonly CoachLabProgramAction[];
  readonly diagnostics: {
    readonly provider: string;
    readonly model: string;
    readonly promptVersion: string;
    readonly tokenUse?: number | null;
    readonly tokenReceipt?: {
      readonly inputTokens: number | null;
      readonly cachedInputTokens: number | null;
      readonly cacheWriteTokens: number | null;
      readonly outputTokens: number | null;
      readonly reasoningTokens: number | null;
      readonly totalTokens: number | null;
    };
    readonly knowledgeAvailableCharacters?: number;
    readonly knowledgeSelectedCharacters?: number;
    readonly retrievedChunkIds?: readonly string[];
  };
}

export interface CoachLabOwnerReview {
  readonly status: 'pending' | 'approved' | 'corrected';
  readonly idealAnswer: string | null;
  readonly correctionReason: string | null;
  readonly approvedModel: string | null;
  readonly approvedPromptVersion: string | null;
}

export interface CoachLabCase {
  readonly id: string;
  readonly athleteMessage: string;
  readonly source: string;
  readonly requiresLiveProgramFacts: boolean;
  readonly reviewFocus: readonly (
    | 'coaching_quality'
    | 'program_factuality'
    | 'lfa_consistency'
    | 'judgement_transparency'
    | 'medical_safety'
    | 'voice'
  )[];
  readonly ownerReview: CoachLabOwnerReview;
}

export interface CoachLabCandidate {
  readonly id: string;
  answer(input: {
    readonly labCase: CoachLabCase;
    readonly snapshot: CoachSnapshot;
  }): CoachLabResponseV1;
}

export interface AsyncCoachLabCandidate {
  readonly id: string;
  answer(input: {
    readonly labCase: CoachLabCase;
    readonly snapshot: CoachSnapshot;
  }): Promise<CoachLabResponseV1>;
}

export interface CoachLabAutomaticChecks {
  readonly schemaValid: boolean;
  readonly useful: boolean;
  readonly readOnly: boolean;
  readonly programFactsGrounded: boolean;
  readonly lfaClaimsGrounded: boolean;
  readonly judgementTransparent: boolean;
  readonly concise: boolean;
}

export interface CoachLabEvaluation {
  readonly verdict: 'automatic_fail' | 'needs_owner_review' | 'approved';
  readonly automaticChecks: CoachLabAutomaticChecks;
  readonly manualReviewRequired: readonly CoachLabCase['reviewFocus'][number][];
}

export interface CoachLabResult extends CoachLabEvaluation {
  readonly caseId: string;
  readonly athleteMessage: string;
  readonly response: CoachLabResponseV1;
  readonly latencyMs: number;
}

export interface CoachLabReport {
  readonly candidateId: string;
  readonly results: readonly CoachLabResult[];
  readonly summary: {
    readonly cases: number;
    readonly automaticFail: number;
    readonly needsOwnerReview: number;
    readonly approved: number;
  };
}

const SNAPSHOT_FIELDS: ReadonlySet<string> = new Set([
  'visibleWeek',
  'thisWeek',
  'readiness',
  'load',
  'progress',
  'restrictions',
]);

export const COACH_LAB_MAX_ANSWER_WORDS = 100;

function answerWordCount(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

function responseHasValidShape(response: CoachLabResponseV1): boolean {
  return response.schemaVersion === COACH_LAB_RESPONSE_SCHEMA_VERSION
    && typeof response.message === 'string'
    && response.message.trim().length > 0
    && Array.isArray(response.basis)
    && response.basis.every((entry) => [
      'athlete_snapshot', 'lfa_rule', 'coaching_judgement', 'general_s_and_c',
    ].includes(entry))
    && Array.isArray(response.snapshotFieldsUsed)
    && response.snapshotFieldsUsed.every((entry) => SNAPSHOT_FIELDS.has(entry))
    && Array.isArray(response.knowledgeSources)
    && Array.isArray(response.programActions)
    && typeof response.diagnostics?.provider === 'string'
    && typeof response.diagnostics?.model === 'string'
    && typeof response.diagnostics?.promptVersion === 'string';
}

export function evaluateCoachLabResponse(
  labCase: CoachLabCase,
  response: CoachLabResponseV1,
): CoachLabEvaluation {
  const usesSnapshot = response.basis.includes('athlete_snapshot');
  const claimsLfaRule = response.basis.includes('lfa_rule');
  const usesJudgement = response.basis.includes('coaching_judgement');
  const automaticChecks: CoachLabAutomaticChecks = {
    schemaValid: responseHasValidShape(response),
    useful: response.answerMode !== 'generic_refusal',
    readOnly: response.programActions.length === 0,
    programFactsGrounded: !labCase.requiresLiveProgramFacts
      || (usesSnapshot && response.snapshotFieldsUsed.includes('visibleWeek')),
    lfaClaimsGrounded: !claimsLfaRule
      || response.knowledgeSources.some(
        (entry) => entry.authority === 'lfa_bible' || entry.authority === 'active_rule',
      ),
    judgementTransparent: !usesJudgement || response.judgementLabel === 'labelled',
    concise: answerWordCount(response.message) <= COACH_LAB_MAX_ANSWER_WORDS,
  };
  const automaticFail = Object.values(automaticChecks).some((value) => !value);
  const ownerApproved = labCase.ownerReview.status === 'approved'
    && typeof labCase.ownerReview.idealAnswer === 'string'
    && labCase.ownerReview.idealAnswer.trim().length > 0
    && response.message === labCase.ownerReview.idealAnswer
    && response.diagnostics.model === labCase.ownerReview.approvedModel
    && response.diagnostics.promptVersion === labCase.ownerReview.approvedPromptVersion;

  return {
    verdict: automaticFail
      ? 'automatic_fail'
      : ownerApproved
        ? 'approved'
        : 'needs_owner_review',
    automaticChecks,
    manualReviewRequired: labCase.reviewFocus,
  };
}

export function runCoachLab(args: {
  readonly cases: readonly CoachLabCase[];
  readonly snapshot: CoachSnapshot;
  readonly candidate: CoachLabCandidate;
}): CoachLabReport {
  const results = args.cases.map((labCase): CoachLabResult => {
    const startedAt = Date.now();
    const response = args.candidate.answer({ labCase, snapshot: args.snapshot });
    const evaluation = evaluateCoachLabResponse(labCase, response);
    return {
      caseId: labCase.id,
      athleteMessage: labCase.athleteMessage,
      response,
      latencyMs: Date.now() - startedAt,
      ...evaluation,
    };
  });

  return {
    candidateId: args.candidate.id,
    results,
    summary: {
      cases: results.length,
      automaticFail: results.filter((entry) => entry.verdict === 'automatic_fail').length,
      needsOwnerReview: results.filter((entry) => entry.verdict === 'needs_owner_review').length,
      approved: results.filter((entry) => entry.verdict === 'approved').length,
    },
  };
}

export async function runCoachLabAsync(args: {
  readonly cases: readonly CoachLabCase[];
  readonly snapshot: CoachSnapshot;
  readonly candidate: AsyncCoachLabCandidate;
}): Promise<CoachLabReport> {
  const results: CoachLabResult[] = [];
  for (const labCase of args.cases) {
    const startedAt = Date.now();
    const response = await args.candidate.answer({ labCase, snapshot: args.snapshot });
    results.push({
      caseId: labCase.id,
      athleteMessage: labCase.athleteMessage,
      response,
      latencyMs: Date.now() - startedAt,
      ...evaluateCoachLabResponse(labCase, response),
    });
  }

  return {
    candidateId: args.candidate.id,
    results,
    summary: {
      cases: results.length,
      automaticFail: results.filter((entry) => entry.verdict === 'automatic_fail').length,
      needsOwnerReview: results.filter((entry) => entry.verdict === 'needs_owner_review').length,
      approved: results.filter((entry) => entry.verdict === 'approved').length,
    },
  };
}
