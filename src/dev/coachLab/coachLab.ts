import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import {
  COACH_RESPONSE_MAX_ANSWER_WORDS,
  evaluateCoachResponseContract,
  type CoachResponseAutomaticChecks,
  type CoachResponseBasis,
  type CoachResponseKnowledgeSource,
  type CoachResponsePayload,
  type CoachResponseProgramAction,
  type CoachResponseSnapshotField,
} from '../../rules/coachResponseContract';

export const COACH_LAB_RESPONSE_SCHEMA_VERSION = 1 as const;

export type CoachLabBasis = CoachResponseBasis;

export type CoachLabSnapshotField = CoachResponseSnapshotField;

export type CoachLabKnowledgeSource = CoachResponseKnowledgeSource;

export type CoachLabProgramAction = CoachResponseProgramAction;

export interface CoachLabResponseV1 extends CoachResponsePayload {
  readonly schemaVersion: typeof COACH_LAB_RESPONSE_SCHEMA_VERSION;
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

export type CoachLabAutomaticChecks = CoachResponseAutomaticChecks;

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

export const COACH_LAB_MAX_ANSWER_WORDS = COACH_RESPONSE_MAX_ANSWER_WORDS;

export function evaluateCoachLabResponse(
  labCase: CoachLabCase,
  response: CoachLabResponseV1,
): CoachLabEvaluation {
  const shared = evaluateCoachResponseContract(response, {
    requiresLiveProgramFacts: labCase.requiresLiveProgramFacts,
  });
  const labEnvelopeValid = response.schemaVersion === COACH_LAB_RESPONSE_SCHEMA_VERSION
    && typeof response.diagnostics?.provider === 'string'
    && typeof response.diagnostics?.model === 'string'
    && typeof response.diagnostics?.promptVersion === 'string';
  const labChecks: CoachLabAutomaticChecks = {
    ...shared.automaticChecks,
    schemaValid: shared.automaticChecks.schemaValid && labEnvelopeValid,
  };
  const automaticFail = Object.values(labChecks).some((value) => !value);
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
    automaticChecks: labChecks,
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
