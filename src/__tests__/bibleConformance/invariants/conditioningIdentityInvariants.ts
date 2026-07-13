export const CONDITIONING_IDENTITY_INVARIANT_IDS = [
  'INV_CANONICAL_CONDITIONING_NEVER_GENERICALLY_COLLAPSES',
  'INV_TEMPO_NOT_AEROBIC_BASE',
  'INV_STRUCTURE_DERIVED_FROM_MAIN_WORK',
  'INV_ATTACHED_PRESERVES_PRIMARY_SESSION',
  'INV_STANDALONE_OWNS_PRIMARY_TITLE',
  'INV_MODALITY_SWAP_PRESERVES_STRUCTURE_LABEL',
  'INV_INTENT_CHANGE_UPDATES_STRUCTURE_LABEL',
  'INV_DOSE_LABEL_IGNORES_WARMUP_COOLDOWN',
  'INV_WEEK_DETAIL_STRUCTURE_AGREEMENT',
  'INV_IDENTITY_PERSISTS_ACROSS_WRITE_PATHS',
] as const;

export type ConditioningIdentityInvariantId =
  typeof CONDITIONING_IDENTITY_INVARIANT_IDS[number];

export interface ConditioningIdentityWitness {
  canonicalLongTitle: string;
  continuousTitle: string;
  continuousFamily: string;
  longFamily: string;
  tempoTitle: string;
  warmupGuardFamily: string;
  attachedPrimary: string;
  attachedContext: string | null;
  standalonePrimary: string;
  modalityFamilies: string[];
  modalityDoses: Array<string | undefined>;
  aerobicSameDoseTitle: string;
  tempoSameDoseTitle: string;
  mainDose: string | undefined;
  weeklyTitle: string;
  detailTitle: string;
  hydratedTitle: string;
  repeatedTitle: string;
}

export interface ConditioningIdentityInvariantFailure {
  invariantId: ConditioningIdentityInvariantId;
  expected: unknown;
  actual: unknown;
}

export function evaluateConditioningIdentityWitness(
  witness: ConditioningIdentityWitness,
): ConditioningIdentityInvariantFailure[] {
  const failures: ConditioningIdentityInvariantFailure[] = [];
  const check = (
    invariantId: ConditioningIdentityInvariantId,
    passed: boolean,
    expected: unknown,
    actual: unknown,
  ) => {
    if (!passed) failures.push({ invariantId, expected, actual });
  };

  check(
    'INV_CANONICAL_CONDITIONING_NEVER_GENERICALLY_COLLAPSES',
    witness.canonicalLongTitle === 'Long Aerobic Intervals',
    'Long Aerobic Intervals', witness.canonicalLongTitle,
  );
  check(
    'INV_TEMPO_NOT_AEROBIC_BASE',
    witness.tempoTitle === 'Tempo Intervals',
    'Tempo Intervals', witness.tempoTitle,
  );
  check(
    'INV_STRUCTURE_DERIVED_FROM_MAIN_WORK',
    witness.warmupGuardFamily === 'long_aerobic_intervals' &&
      witness.continuousFamily === 'continuous_aerobic' &&
      witness.longFamily === 'long_aerobic_intervals',
    ['long_aerobic_intervals', 'continuous_aerobic', 'long_aerobic_intervals'],
    [witness.warmupGuardFamily, witness.continuousFamily, witness.longFamily],
  );
  check(
    'INV_ATTACHED_PRESERVES_PRIMARY_SESSION',
    witness.attachedPrimary === 'Upper Push' && witness.attachedContext === 'Long Aerobic Intervals',
    ['Upper Push', 'Long Aerobic Intervals'],
    [witness.attachedPrimary, witness.attachedContext],
  );
  check(
    'INV_STANDALONE_OWNS_PRIMARY_TITLE',
    witness.standalonePrimary === 'Continuous Aerobic' && witness.continuousTitle === 'Continuous Aerobic',
    'Continuous Aerobic',
    [witness.standalonePrimary, witness.continuousTitle],
  );
  check(
    'INV_MODALITY_SWAP_PRESERVES_STRUCTURE_LABEL',
    new Set(witness.modalityFamilies).size === 1 &&
      witness.modalityFamilies[0] === 'long_aerobic_intervals' &&
      new Set(witness.modalityDoses).size === 1,
    { family: 'long_aerobic_intervals', oneDose: true },
    { families: witness.modalityFamilies, doses: witness.modalityDoses },
  );
  check(
    'INV_INTENT_CHANGE_UPDATES_STRUCTURE_LABEL',
    witness.aerobicSameDoseTitle === 'Short Aerobic Intervals' &&
      witness.tempoSameDoseTitle === 'Tempo Intervals',
    ['Short Aerobic Intervals', 'Tempo Intervals'],
    [witness.aerobicSameDoseTitle, witness.tempoSameDoseTitle],
  );
  check(
    'INV_DOSE_LABEL_IGNORES_WARMUP_COOLDOWN',
    witness.mainDose === '3 × 8 min',
    '3 × 8 min', witness.mainDose,
  );
  check(
    'INV_WEEK_DETAIL_STRUCTURE_AGREEMENT',
    witness.weeklyTitle === witness.detailTitle && witness.weeklyTitle === 'Long Aerobic Intervals',
    ['Long Aerobic Intervals', 'Long Aerobic Intervals'],
    [witness.weeklyTitle, witness.detailTitle],
  );
  check(
    'INV_IDENTITY_PERSISTS_ACROSS_WRITE_PATHS',
    witness.hydratedTitle === 'Long Aerobic Intervals' && witness.repeatedTitle === 'Long Aerobic Intervals',
    ['Long Aerobic Intervals', 'Long Aerobic Intervals'],
    [witness.hydratedTitle, witness.repeatedTitle],
  );

  return failures;
}
