export const PRESEASON_EXPOSURE_INVARIANT_IDS = [
  'INV_PRESEASON_EXPOSURE_CONTRACT_SATISFIED',
  'INV_PRESEASON_STRENGTH_PATTERNS_COMPLETE',
  'INV_PRESEASON_CONDITIONING_TARGET_SATISFIED',
  'INV_RECOVERY_DOES_NOT_DISPLACE_REQUIRED_EXPOSURE',
  'INV_HARD_DAY_PREFERENCE_DOES_NOT_REDUCE_EXPOSURE',
  'INV_FIVE_HARD_DAY_STRUCTURE_ALLOWED',
  'INV_TEAM_TRAINING_CREDIT_CORRECT',
  'INV_EDGE_FALLBACK_EXPOSURE_EQUIVALENT',
  'INV_EXPOSURE_REDUCTION_HAS_REASON',
  'INV_ZERO_EXTRA_CONDITIONING_HAS_AUTHORISED_REASON',
] as const;

export type PreseasonExposureInvariantId =
  typeof PRESEASON_EXPOSURE_INVARIANT_IDS[number];

export interface PreseasonExposureWitness {
  validationViolationCount: number;
  requiredPatterns: string[];
  actualPatterns: string[];
  conditioningTarget: number;
  creditedTeamTraining: number;
  requiredAdditionalConditioning: number;
  actualAdditionalConditioning: number;
  recoveryDisplacedRequiredExposure: boolean;
  safeConditioningPairAvailable: boolean;
  safeConditioningPairUsed: boolean;
  preferredHardDays: number;
  permittedHardDays: number;
  actualHardDays: number;
  fiveHardDayStructureAccepted: boolean;
  teamOnlySessionHasStrengthCredit: boolean;
  edgeContract: unknown;
  fallbackContract: unknown;
  edgeComponentShape: unknown;
  fallbackComponentShape: unknown;
  reductionsAreTyped: boolean;
  zeroAdditionalConditioningAuthorised: boolean;
}
export interface PreseasonExposureInvariantFailure {
  invariantId: PreseasonExposureInvariantId;
  expected: unknown;
  actual: unknown;
}

export function evaluatePreseasonExposureWitness(
  witness: PreseasonExposureWitness,
): PreseasonExposureInvariantFailure[] {
  const failures: PreseasonExposureInvariantFailure[] = [];
  const check = (
    invariantId: PreseasonExposureInvariantId,
    passed: boolean,
    expected: unknown,
    actual: unknown,
  ) => {
    if (!passed) failures.push({ invariantId, expected, actual });
  };
  const required = [...witness.requiredPatterns].sort();
  const actual = [...witness.actualPatterns].sort();

  check(
    'INV_PRESEASON_EXPOSURE_CONTRACT_SATISFIED',
    witness.validationViolationCount === 0,
    0, witness.validationViolationCount,
  );
  check(
    'INV_PRESEASON_STRENGTH_PATTERNS_COMPLETE',
    JSON.stringify(actual) === JSON.stringify(required),
    required, actual,
  );
  check(
    'INV_PRESEASON_CONDITIONING_TARGET_SATISFIED',
    witness.creditedTeamTraining + witness.actualAdditionalConditioning >= witness.conditioningTarget,
    witness.conditioningTarget,
    witness.creditedTeamTraining + witness.actualAdditionalConditioning,
  );
  check(
    'INV_RECOVERY_DOES_NOT_DISPLACE_REQUIRED_EXPOSURE',
    !witness.recoveryDisplacedRequiredExposure,
    false, witness.recoveryDisplacedRequiredExposure,
  );
  check(
    'INV_HARD_DAY_PREFERENCE_DOES_NOT_REDUCE_EXPOSURE',
    witness.actualAdditionalConditioning >= witness.requiredAdditionalConditioning,
    witness.requiredAdditionalConditioning, witness.actualAdditionalConditioning,
  );
  check(
    'INV_FIVE_HARD_DAY_STRUCTURE_ALLOWED',
    witness.actualHardDays !== 5 || (
      witness.fiveHardDayStructureAccepted && witness.permittedHardDays >= 5
    ),
    { accepted: true, permitted: 5 },
    { accepted: witness.fiveHardDayStructureAccepted, permitted: witness.permittedHardDays },
  );
  check(
    'INV_TEAM_TRAINING_CREDIT_CORRECT',
    witness.creditedTeamTraining === 2 && !witness.teamOnlySessionHasStrengthCredit,
    { conditioningCredit: 2, teamOnlyStrengthCredit: false },
    {
      conditioningCredit: witness.creditedTeamTraining,
      teamOnlyStrengthCredit: witness.teamOnlySessionHasStrengthCredit,
    },
  );
  check(
    'INV_EDGE_FALLBACK_EXPOSURE_EQUIVALENT',
    JSON.stringify(witness.edgeContract) === JSON.stringify(witness.fallbackContract) &&
      JSON.stringify(witness.edgeComponentShape) === JSON.stringify(witness.fallbackComponentShape),
    { contract: witness.edgeContract, shape: witness.edgeComponentShape },
    { contract: witness.fallbackContract, shape: witness.fallbackComponentShape },
  );
  check(
    'INV_EXPOSURE_REDUCTION_HAS_REASON',
    witness.reductionsAreTyped,
    true, witness.reductionsAreTyped,
  );
  check(
    'INV_ZERO_EXTRA_CONDITIONING_HAS_AUTHORISED_REASON',
    witness.zeroAdditionalConditioningAuthorised,
    true, witness.zeroAdditionalConditioningAuthorised,
  );
  check(
    'INV_HARD_DAY_PREFERENCE_DOES_NOT_REDUCE_EXPOSURE',
    !witness.safeConditioningPairAvailable || witness.safeConditioningPairUsed,
    { safePairUsedWhenAvailable: true },
    {
      safePairAvailable: witness.safeConditioningPairAvailable,
      safePairUsed: witness.safeConditioningPairUsed,
    },
  );

  return failures;
}
