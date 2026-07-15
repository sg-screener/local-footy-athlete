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
    if (
      !best ||
      assessment.blockingCount < best.assessment.blockingCount ||
      (assessment.blockingCount === best.assessment.blockingCount && current.depth < best.depth)
    ) {
      best = { candidate: current.candidate, assessment, depth: current.depth };
    }
    if (assessment.accepted) {
      return {
        outcome: current.depth === 0 ? 'accepted' : 'repaired',
        candidate: current.candidate,
        evaluation: assessment.evaluation,
        candidatesEvaluated: evaluated,
        exhausted: false,
      };
    }
    for (const candidate of args.expand(current.candidate, assessment)) {
      if (!seen.has(args.stateSignature(candidate))) {
        queue.push({ candidate, depth: current.depth + 1 });
      }
    }
  }

  if (!best) throw new Error('Whole-week search evaluated no candidate');
  return {
    outcome: 'impossible',
    candidate: best.candidate,
    evaluation: best.assessment.evaluation,
    candidatesEvaluated: evaluated,
    exhausted: queue.length === 0,
  };
}
