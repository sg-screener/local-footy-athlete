import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';
import {
  buildCoachRevisionDiff,
  parseCoachRevisionProposal,
  validateCoachRevisionDiff,
  type CoachRevisionDiff,
  type CoachRevisionProposal,
  type CoachRevisionValidationPolicy,
  type CoachRevisionValidationResult,
  type CoachVisibleWeekSnapshot,
} from './coachRevisionProposal';
import { logger } from './logger';

export type CoachRevisionProposalMode = 'off' | 'shadow' | 'active';

export interface SemanticCoachRevisionProposalAdapterInput {
  userMessage: string;
  visibleSnapshot: CoachVisibleWeekSnapshot;
  pendingClarifier?: PendingCoachClarifier | null;
  recentContext?: unknown;
  todayISO?: string;
  nowISO?: string;
  timezone?: string;
}

export interface SemanticCoachRevisionProposalAdapter {
  buildProposal(
    input: SemanticCoachRevisionProposalAdapterInput,
  ): Promise<unknown> | unknown;
}

export interface BuildSemanticCoachRevisionProposalInput
  extends SemanticCoachRevisionProposalAdapterInput {
  adapter: SemanticCoachRevisionProposalAdapter;
  validationPolicy?: CoachRevisionValidationPolicy;
  minConfidence?: number;
}

export interface CoachRevisionShadowDiagnostic {
  proposalKind: 'revision' | 'clarify' | 'invalid' | 'not_an_edit' | 'out_of_scope_setup';
  affectedDates: string[];
  diffSummary: Array<{
    date: string;
    workoutChange: string;
    sectionsAdded: string[];
    sectionsRemoved: string[];
    sectionsChanged: string[];
    itemsAdded: string[];
    itemsRemoved: string[];
    itemsChanged: string[];
  }>;
  validatorStatus: CoachRevisionValidationResult['status'] | 'not_run';
  protectedRefsPreserved: string[];
  protectedRefsViolated: string[];
  unknownIds: string[];
  confirmationRequired: boolean;
  issues: string[];
}

export type SemanticCoachRevisionProposalResult =
  | {
      kind: 'revision';
      proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
      diff: CoachRevisionDiff;
      validation: Extract<CoachRevisionValidationResult, { status: 'valid' }>;
      diagnostic: CoachRevisionShadowDiagnostic;
      confidence: number;
    }
  | {
      kind: 'clarify';
      proposal: Extract<CoachRevisionProposal, { kind: 'clarify' }>;
      reply: string;
      options: string[];
      diagnostic: CoachRevisionShadowDiagnostic;
      confidence: number;
      reason: string;
    }
  | {
      kind: 'needs_confirmation';
      proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
      diff: CoachRevisionDiff;
      validation: Extract<CoachRevisionValidationResult, { status: 'needs_confirmation' }>;
      diagnostic: CoachRevisionShadowDiagnostic;
      confidence: number;
      reason: string;
    }
  | {
      kind: 'invalid';
      reason: string;
      issues: string[];
      raw: unknown;
      diagnostic: CoachRevisionShadowDiagnostic;
      proposal?: CoachRevisionProposal;
      diff?: CoachRevisionDiff;
      validation?: CoachRevisionValidationResult;
    }
  | {
      /** Typed decline: not a program-change request. The controller releases
       *  the turn to normal conversation handling. */
      kind: 'not_an_edit';
      proposal: Extract<CoachRevisionProposal, { kind: 'not_an_edit' }>;
      reason: string;
      confidence: number;
      diagnostic: CoachRevisionShadowDiagnostic;
    }
  | {
      /** Typed decline: a program-SHAPE change (recurring/availability/
       *  frequency). The controller releases the turn to the setup pipeline. */
      kind: 'out_of_scope_setup';
      proposal: Extract<CoachRevisionProposal, { kind: 'out_of_scope_setup' }>;
      reason: string;
      detectedChange: string;
      confidence: number;
      diagnostic: CoachRevisionShadowDiagnostic;
    };

export class MockSemanticCoachRevisionProposalAdapter
  implements SemanticCoachRevisionProposalAdapter {
  constructor(private readonly response: unknown) {}

  buildProposal(): unknown {
    return this.response;
  }
}

export async function buildSemanticCoachRevisionProposal(
  input: BuildSemanticCoachRevisionProposalInput,
): Promise<SemanticCoachRevisionProposalResult> {
  let raw: unknown;
  try {
    raw = await input.adapter.buildProposal({
      userMessage: input.userMessage,
      visibleSnapshot: input.visibleSnapshot,
      pendingClarifier: input.pendingClarifier,
      recentContext: input.recentContext,
      todayISO: input.todayISO,
      nowISO: input.nowISO,
      timezone: input.timezone,
    });
  } catch (err) {
    const diagnostic = invalidDiagnostic([
      err instanceof Error ? err.message : String(err),
    ]);
    emitShadowDiagnostic(diagnostic);
    return {
      kind: 'invalid',
      reason: 'adapter_failed',
      issues: diagnostic.issues,
      raw: null,
      diagnostic,
    };
  }

  const parsed = parseCoachRevisionProposal(raw);
  if (!parsed.ok || !parsed.proposal) {
    const diagnostic = invalidDiagnostic(parsed.issues);
    emitShadowDiagnostic(diagnostic);
    return {
      kind: 'invalid',
      reason: 'schema_validation_failed',
      issues: parsed.issues,
      raw,
      diagnostic,
    };
  }

  const proposal = parsed.proposal;

  // Typed declines: bypass the confidence gate entirely. Whether the model is
  // 0.5 or 0.99 sure, forcing a clarify would hijack the turn — releasing it
  // to the owning layer is the safe outcome either way.
  if (proposal.kind === 'out_of_scope_setup') {
    const diagnostic: CoachRevisionShadowDiagnostic = {
      proposalKind: 'out_of_scope_setup',
      affectedDates: [],
      diffSummary: [],
      validatorStatus: 'not_run',
      protectedRefsPreserved: [],
      protectedRefsViolated: [],
      unknownIds: [],
      confirmationRequired: false,
      issues: [],
    };
    emitShadowDiagnostic(diagnostic);
    return {
      kind: 'out_of_scope_setup',
      proposal,
      reason: proposal.reason,
      detectedChange: proposal.detectedChange,
      confidence: proposal.confidence,
      diagnostic,
    };
  }
  if (proposal.kind === 'not_an_edit') {
    const diagnostic: CoachRevisionShadowDiagnostic = {
      proposalKind: 'not_an_edit',
      affectedDates: [],
      diffSummary: [],
      validatorStatus: 'not_run',
      protectedRefsPreserved: [],
      protectedRefsViolated: [],
      unknownIds: [],
      confirmationRequired: false,
      issues: [],
    };
    emitShadowDiagnostic(diagnostic);
    return {
      kind: 'not_an_edit',
      proposal,
      reason: proposal.reason,
      confidence: proposal.confidence,
      diagnostic,
    };
  }

  const minConfidence = input.minConfidence ?? 0.65;
  if (proposal.confidence < minConfidence) {
    const diagnostic = proposal.kind === 'revision'
      ? diagnosticForValidation({
          proposal,
          validation: validateCoachRevisionDiff({
            before: input.visibleSnapshot,
            proposal,
            policy: input.validationPolicy,
          }),
        })
      : clarifyDiagnostic(proposal);
    emitShadowDiagnostic(diagnostic);
    return {
      kind: 'clarify',
      proposal: proposal.kind === 'clarify'
        ? proposal
        : {
            schemaVersion: proposal.schemaVersion,
            kind: 'clarify',
            confidence: proposal.confidence,
            question: 'I think that is a program edit, but I need one more detail before changing anything.',
            missingField: 'confirmation',
            candidateOptions: [],
            partialIntent: proposal.userIntent,
            reason: 'coach_revision_low_confidence',
          },
      reply: proposal.kind === 'clarify'
        ? proposal.question
        : 'I think that is a program edit, but I need one more detail before changing anything.',
      options: proposal.kind === 'clarify'
        ? proposal.candidateOptions.map((option) => option.label)
        : [],
      diagnostic,
      confidence: proposal.confidence,
      reason: 'coach_revision_low_confidence',
    };
  }

  if (proposal.kind === 'clarify') {
    const diagnostic = clarifyDiagnostic(proposal);
    emitShadowDiagnostic(diagnostic);
    return {
      kind: 'clarify',
      proposal,
      reply: proposal.question,
      options: proposal.candidateOptions.map((option) => option.label),
      diagnostic,
      confidence: proposal.confidence,
      reason: proposal.reason,
    };
  }

  const validation = validateCoachRevisionDiff({
    before: input.visibleSnapshot,
    proposal,
    policy: input.validationPolicy,
  });
  const diagnostic = diagnosticForValidation({ proposal, validation });
  emitShadowDiagnostic(diagnostic);

  if (validation.status === 'valid') {
    return {
      kind: 'revision',
      proposal,
      diff: validation.diff,
      validation,
      diagnostic,
      confidence: proposal.confidence,
    };
  }

  if (validation.status === 'needs_confirmation') {
    return {
      kind: 'needs_confirmation',
      proposal,
      diff: validation.diff,
      validation,
      diagnostic,
      confidence: proposal.confidence,
      reason: 'coach_revision_requires_confirmation',
    };
  }

  return {
    kind: 'invalid',
    reason: 'diff_validation_failed',
    issues: validation.issues.map((issue) => `${issue.code}:${issue.message}`),
    raw,
    proposal,
    diff: validation.diff,
    validation,
    diagnostic,
  };
}

export function diagnosticForValidation(args: {
  proposal: Extract<CoachRevisionProposal, { kind: 'revision' }>;
  validation: CoachRevisionValidationResult;
}): CoachRevisionShadowDiagnostic {
  const { proposal, validation } = args;
  const issues = validation.issues as Array<{
    code: string;
    message?: string;
    date?: string;
    ref?: string;
  }>;
  const protectedRefs = new Set(proposal.userIntent.protectedRefs);
  const violated = issues
    .filter((issue) =>
      issue.code === 'protected_ref_changed' ||
      issue.code === 'protected_ref_missing_before',
    )
    .map((issue) => issue.ref)
    .filter((ref): ref is string => !!ref);
  const violatedSet = new Set(violated);
  const unknownIds = issues
    .filter((issue) =>
      issue.code === 'unknown_section_id' ||
      issue.code === 'unknown_item_id',
    )
    .map((issue) => issue.ref)
    .filter((ref): ref is string => !!ref);

  return {
    proposalKind: 'revision',
    affectedDates: validation.diff.changedDates,
    diffSummary: validation.diff.dateDiffs.map((entry) => ({
      date: entry.date,
      workoutChange: entry.workoutChange,
      sectionsAdded: entry.sectionDiffs
        .filter((diff) => diff.kind === 'added')
        .map((diff) => `${diff.sectionKind}:${diff.sectionId}`),
      sectionsRemoved: entry.sectionDiffs
        .filter((diff) => diff.kind === 'removed')
        .map((diff) => `${diff.sectionKind}:${diff.sectionId}`),
      sectionsChanged: entry.sectionDiffs
        .filter((diff) => diff.kind === 'changed')
        .map((diff) => `${diff.sectionKind}:${diff.sectionId}`),
      itemsAdded: entry.itemDiffs
        .filter((diff) => diff.kind === 'added')
        .map((diff) => `${diff.sectionKind}:${diff.itemId}`),
      itemsRemoved: entry.itemDiffs
        .filter((diff) => diff.kind === 'removed')
        .map((diff) => `${diff.sectionKind}:${diff.itemId}`),
      itemsChanged: entry.itemDiffs
        .filter((diff) => diff.kind === 'changed')
        .map((diff) => `${diff.sectionKind}:${diff.itemId}`),
    })),
    validatorStatus: validation.status,
    protectedRefsPreserved: [...protectedRefs].filter((ref) => !violatedSet.has(ref)),
    protectedRefsViolated: violated,
    unknownIds,
    confirmationRequired: validation.status === 'needs_confirmation',
    issues: issues.map((issue) => issue.code),
  };
}

function clarifyDiagnostic(
  proposal: Extract<CoachRevisionProposal, { kind: 'clarify' }>,
): CoachRevisionShadowDiagnostic {
  return {
    proposalKind: 'clarify',
    affectedDates: [],
    diffSummary: [],
    validatorStatus: 'not_run',
    protectedRefsPreserved: proposal.partialIntent?.protectedRefs ?? [],
    protectedRefsViolated: [],
    unknownIds: [],
    confirmationRequired: proposal.missingField === 'confirmation',
    issues: [],
  };
}

function invalidDiagnostic(issues: string[]): CoachRevisionShadowDiagnostic {
  return {
    proposalKind: 'invalid',
    affectedDates: [],
    diffSummary: [],
    validatorStatus: 'not_run',
    protectedRefsPreserved: [],
    protectedRefsViolated: [],
    unknownIds: [],
    confirmationRequired: false,
    issues,
  };
}

function emitShadowDiagnostic(diagnostic: CoachRevisionShadowDiagnostic): void {
  logger.debug('[coach-revision-proposal-shadow]', diagnostic);
}
