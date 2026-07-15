import {
  athleteActionDiagnosticHash,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

export type WholeWeekRepairOutcome =
  | 'accepted'
  | 'repaired'
  | 'regenerated'
  | 'fallback'
  | 'impossible';

export interface WholeWeekCandidateAssessment<Evaluation> {
  accepted: boolean;
  blockingCount: number;
  evaluation: Evaluation;
}

export interface WholeWeekRepairSearchResult<Candidate, Evaluation> {
  outcome: 'accepted' | 'repaired' | 'impossible';
  candidate: Candidate;
  evaluation: Evaluation;
  candidatesEvaluated: number;
  exhausted: boolean;
}

/**
 * Deterministic breadth-first whole-week search. State identity, not a failure
 * message, controls de-duplication: two candidates with the same blocker are
 * both evaluated when their visible program state differs.
 */
export function searchWholeWeekRepairCandidates<Candidate, Evaluation>(args: {
  initial: Candidate;
  stateSignature: (candidate: Candidate) => string;
  assess: (candidate: Candidate) => WholeWeekCandidateAssessment<Evaluation>;
  expand: (
    candidate: Candidate,
    assessment: WholeWeekCandidateAssessment<Evaluation>,
  ) => Candidate[];
  maxCandidates?: number;
  trace?: AthleteActionTraceContext;
  diagnosticBoundary?: string;
  diagnosticWeekId?: string;
  diagnosticRejection?: (assessment: WholeWeekCandidateAssessment<Evaluation>) => {
    codes: string[];
    invariant?: string;
    category?: string;
  };
}): WholeWeekRepairSearchResult<Candidate, Evaluation> {
  const maxCandidates = Math.max(1, args.maxCandidates ?? 48);
  const queue: Array<{ candidate: Candidate; depth: number }> = [
    { candidate: args.initial, depth: 0 },
  ];
  const seen = new Set<string>();
  let best: {
    candidate: Candidate;
    assessment: WholeWeekCandidateAssessment<Evaluation>;
    depth: number;
  } | null = null;
  let evaluated = 0;

  while (queue.length > 0 && evaluated < maxCandidates) {
    const current = queue.shift()!;
    const signature = args.stateSignature(current.candidate);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const assessment = args.assess(current.candidate);
    evaluated += 1;
    const candidateId = athleteActionDiagnosticHash(signature);
    if (
      !best ||
      assessment.blockingCount < best.assessment.blockingCount ||
      (assessment.blockingCount === best.assessment.blockingCount && current.depth < best.depth)
    ) {
      best = { candidate: current.candidate, assessment, depth: current.depth };
    }
    if (assessment.accepted) {
      emitAthleteActionEvent(args.trace, 'repair_candidate_selected', {
        candidateId,
        candidateIndex: evaluated - 1,
        candidateScore: { blockingCount: assessment.blockingCount, depth: current.depth },
        preservationCost: current.depth,
        affectedWeek: args.diagnosticWeekId,
        boundary: args.diagnosticBoundary ?? 'searchWholeWeekRepairCandidates',
        outcome: current.depth === 0 ? 'accepted' : 'repaired',
      });
      return {
        outcome: current.depth === 0 ? 'accepted' : 'repaired',
        candidate: current.candidate,
        evaluation: assessment.evaluation,
        candidatesEvaluated: evaluated,
        exhausted: false,
      };
    }
    const rejection = args.diagnosticRejection?.(assessment) ?? {
      codes: [`blocking_count:${assessment.blockingCount}`],
    };
    emitAthleteActionEvent(args.trace, 'repair_candidate_rejected', {
      candidateId,
      candidateIndex: evaluated - 1,
      candidateScore: { blockingCount: assessment.blockingCount, depth: current.depth },
      affectedWeek: args.diagnosticWeekId,
      rejectionCodes: rejection.codes,
      rejectingBoundary: args.diagnosticBoundary ?? 'searchWholeWeekRepairCandidates',
      relevantInvariant: rejection.invariant ?? null,
      failureCategory: rejection.category ?? classifyAthleteActionFailure(
        rejection.codes[0],
        args.diagnosticBoundary,
      ),
    });
    const expanded = args.expand(current.candidate, assessment);
    emitAthleteActionEvent(args.trace, 'repair_candidates_generated', {
      parentCandidateId: candidateId,
      generatedCandidateCount: expanded.length,
      candidateCount: seen.size + queue.length + expanded.length,
      affectedWeek: args.diagnosticWeekId,
      boundary: args.diagnosticBoundary ?? 'searchWholeWeekRepairCandidates',
    });
    for (const candidate of expanded) {
      if (!seen.has(args.stateSignature(candidate))) {
        queue.push({ candidate, depth: current.depth + 1 });
      }
    }
  }

  if (!best) throw new Error('Whole-week search evaluated no candidate');
  emitAthleteActionEvent(args.trace, 'repair_candidates_generated', {
    candidateCount: evaluated,
    searchExhausted: queue.length === 0,
    searchLimitReached: evaluated >= maxCandidates,
    affectedWeek: args.diagnosticWeekId,
    boundary: args.diagnosticBoundary ?? 'searchWholeWeekRepairCandidates',
    outcome: 'impossible',
  });
  return {
    outcome: 'impossible',
    candidate: best.candidate,
    evaluation: best.assessment.evaluation,
    candidatesEvaluated: evaluated,
    exhausted: queue.length === 0,
  };
}
