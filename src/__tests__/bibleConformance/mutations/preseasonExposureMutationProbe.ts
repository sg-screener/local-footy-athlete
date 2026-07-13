import { buildPreseasonExposureWitness } from '../observations/buildPreseasonExposureWitness';
import {
  evaluatePreseasonExposureWitness,
  type PreseasonExposureInvariantId,
  type PreseasonExposureWitness,
} from '../invariants/preseasonExposureInvariants';

export const PRESEASON_EXPOSURE_MUTATION_IDS = [
  'hard_day_preference_deletes_conditioning',
  'recovery_reserves_required_day',
  'only_team_conditioning_remains',
  'team_training_gets_false_strength_credit',
  'upper_pattern_disappears',
  'lower_pattern_disappears',
  'edge_fallback_conditioning_mismatch',
  'valid_conditioning_pair_ignored',
  'five_hard_day_structure_rejected',
  'exposure_reduction_loses_typed_reason',
] as const;

export type PreseasonExposureMutationId =
  typeof PRESEASON_EXPOSURE_MUTATION_IDS[number];

const EXPECTED_INVARIANT: Record<PreseasonExposureMutationId, PreseasonExposureInvariantId> = {
  hard_day_preference_deletes_conditioning: 'INV_HARD_DAY_PREFERENCE_DOES_NOT_REDUCE_EXPOSURE',
  recovery_reserves_required_day: 'INV_RECOVERY_DOES_NOT_DISPLACE_REQUIRED_EXPOSURE',
  only_team_conditioning_remains: 'INV_PRESEASON_CONDITIONING_TARGET_SATISFIED',
  team_training_gets_false_strength_credit: 'INV_TEAM_TRAINING_CREDIT_CORRECT',
  upper_pattern_disappears: 'INV_PRESEASON_STRENGTH_PATTERNS_COMPLETE',
  lower_pattern_disappears: 'INV_PRESEASON_STRENGTH_PATTERNS_COMPLETE',
  edge_fallback_conditioning_mismatch: 'INV_EDGE_FALLBACK_EXPOSURE_EQUIVALENT',
  valid_conditioning_pair_ignored: 'INV_HARD_DAY_PREFERENCE_DOES_NOT_REDUCE_EXPOSURE',
  five_hard_day_structure_rejected: 'INV_FIVE_HARD_DAY_STRUCTURE_ALLOWED',
  exposure_reduction_loses_typed_reason: 'INV_EXPOSURE_REDUCTION_HAS_REASON',
};

function mutate(
  baseline: PreseasonExposureWitness,
  mutationId: PreseasonExposureMutationId,
): PreseasonExposureWitness {
  const witness: PreseasonExposureWitness = JSON.parse(JSON.stringify(baseline));
  switch (mutationId) {
    case 'hard_day_preference_deletes_conditioning':
      witness.actualAdditionalConditioning = 1;
      break;
    case 'recovery_reserves_required_day':
      witness.recoveryDisplacedRequiredExposure = true;
      break;
    case 'only_team_conditioning_remains':
      witness.actualAdditionalConditioning = 0;
      break;
    case 'team_training_gets_false_strength_credit':
      witness.teamOnlySessionHasStrengthCredit = true;
      break;
    case 'upper_pattern_disappears':
      witness.actualPatterns = witness.actualPatterns.filter((pattern) => pattern !== 'pull');
      break;
    case 'lower_pattern_disappears':
      witness.actualPatterns = witness.actualPatterns.filter((pattern) => pattern !== 'hinge');
      break;
    case 'edge_fallback_conditioning_mismatch':
      (witness.fallbackComponentShape as Array<{ conditioning: boolean }>)[4].conditioning = false;
      break;
    case 'valid_conditioning_pair_ignored':
      witness.safeConditioningPairUsed = false;
      break;
    case 'five_hard_day_structure_rejected':
      witness.fiveHardDayStructureAccepted = false;
      break;
    case 'exposure_reduction_loses_typed_reason':
      witness.reductionsAreTyped = false;
      break;
  }
  return witness;
}
const RESULT_MARKER = 'BIBLE_PRESEASON_EXPOSURE_MUTATION_RESULT ';

export function runPreseasonExposureMutationProbe(mutationId: PreseasonExposureMutationId) {
  if (!PRESEASON_EXPOSURE_MUTATION_IDS.includes(mutationId)) {
    throw new Error(`Unknown pre-season exposure mutation: ${mutationId}`);
  }
  const baseline = buildPreseasonExposureWitness();
  const baselineFailures = evaluatePreseasonExposureWitness(baseline);
  if (baselineFailures.length > 0) {
    throw new Error(`Pre-season exposure baseline was not green: ${JSON.stringify(baselineFailures)}`);
  }
  const mutant = mutate(baseline, mutationId);
  const active = JSON.stringify(mutant) !== JSON.stringify(baseline);
  const failures = evaluatePreseasonExposureWitness(mutant);
  const invariantId = EXPECTED_INVARIANT[mutationId];
  const failure = failures.find((entry) => entry.invariantId === invariantId);
  const killed = !!failure;
  const restored = evaluatePreseasonExposureWitness(baseline).length === 0;
  if (!active || !killed || !restored || !failure) {
    throw new Error(`${mutationId} proof incomplete: ${JSON.stringify({ active, killed, restored, failures })}`);
  }
  return {
    id: mutationId,
    active,
    killed,
    restored,
    invariantId,
    firstStage: mutationId.startsWith('edge_fallback') ? 'generated_fallback' : 'allocation',
    report: `RULE pre-season exposure\nINVARIANT ${invariantId}\nMUTATION ${mutationId}\nSTATUS unauthorised\nEXPECTED ${JSON.stringify(failure.expected)}\nACTUAL ${JSON.stringify(failure.actual)}`,
  };
}

if (require.main === module) {
  try {
    const mutationId = process.argv[2] as PreseasonExposureMutationId;
    process.stdout.write(
      `${RESULT_MARKER}${JSON.stringify(runPreseasonExposureMutationProbe(mutationId))}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
}
