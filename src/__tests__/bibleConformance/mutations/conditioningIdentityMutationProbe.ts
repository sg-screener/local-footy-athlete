import { buildConditioningIdentityWitness } from '../observations/buildConditioningIdentityWitness';
import {
  evaluateConditioningIdentityWitness,
  type ConditioningIdentityInvariantId,
  type ConditioningIdentityWitness,
} from '../invariants/conditioningIdentityInvariants';

export const CONDITIONING_IDENTITY_MUTATION_IDS = [
  'conditioning_generic_aerobic_base_collapse',
  'tempo_falls_to_aerobic_base',
  'modality_becomes_weekly_identity',
  'warmup_determines_structure_identity',
  'attached_overwrites_primary_title',
  'standalone_continuous_stays_generic',
  'modality_swap_changes_structure_family',
  'continuous_misclassified_as_intervals',
  'long_intervals_misclassified_as_continuous',
  'rehydrate_restores_generic_identity',
] as const;

export type ConditioningIdentityMutationId =
  typeof CONDITIONING_IDENTITY_MUTATION_IDS[number];

const EXPECTED_INVARIANT: Record<ConditioningIdentityMutationId, ConditioningIdentityInvariantId> = {
  conditioning_generic_aerobic_base_collapse: 'INV_CANONICAL_CONDITIONING_NEVER_GENERICALLY_COLLAPSES',
  tempo_falls_to_aerobic_base: 'INV_TEMPO_NOT_AEROBIC_BASE',
  modality_becomes_weekly_identity: 'INV_MODALITY_SWAP_PRESERVES_STRUCTURE_LABEL',
  warmup_determines_structure_identity: 'INV_STRUCTURE_DERIVED_FROM_MAIN_WORK',
  attached_overwrites_primary_title: 'INV_ATTACHED_PRESERVES_PRIMARY_SESSION',
  standalone_continuous_stays_generic: 'INV_STANDALONE_OWNS_PRIMARY_TITLE',
  modality_swap_changes_structure_family: 'INV_MODALITY_SWAP_PRESERVES_STRUCTURE_LABEL',
  continuous_misclassified_as_intervals: 'INV_STRUCTURE_DERIVED_FROM_MAIN_WORK',
  long_intervals_misclassified_as_continuous: 'INV_STRUCTURE_DERIVED_FROM_MAIN_WORK',
  rehydrate_restores_generic_identity: 'INV_IDENTITY_PERSISTS_ACROSS_WRITE_PATHS',
};

function mutate(
  baseline: ConditioningIdentityWitness,
  mutationId: ConditioningIdentityMutationId,
): ConditioningIdentityWitness {
  const witness: ConditioningIdentityWitness = JSON.parse(JSON.stringify(baseline));
  switch (mutationId) {
    case 'conditioning_generic_aerobic_base_collapse':
      witness.canonicalLongTitle = 'Aerobic Base';
      break;
    case 'tempo_falls_to_aerobic_base':
      witness.tempoTitle = 'Aerobic Base';
      break;
    case 'modality_becomes_weekly_identity':
      witness.modalityFamilies = ['bike_aerobic', 'rowerg_aerobic', 'skierg_aerobic'];
      break;
    case 'warmup_determines_structure_identity':
      witness.warmupGuardFamily = 'continuous_aerobic';
      break;
    case 'attached_overwrites_primary_title':
      witness.attachedPrimary = 'Long Aerobic Intervals';
      break;
    case 'standalone_continuous_stays_generic':
      witness.standalonePrimary = 'Aerobic Conditioning';
      witness.continuousTitle = 'Aerobic Conditioning';
      break;
    case 'modality_swap_changes_structure_family':
      witness.modalityFamilies = ['long_aerobic_intervals', 'continuous_aerobic', 'short_aerobic_intervals'];
      break;
    case 'continuous_misclassified_as_intervals':
      witness.continuousFamily = 'long_aerobic_intervals';
      break;
    case 'long_intervals_misclassified_as_continuous':
      witness.longFamily = 'continuous_aerobic';
      break;
    case 'rehydrate_restores_generic_identity':
      witness.hydratedTitle = 'Aerobic Base';
      break;
  }
  return witness;
}

const RESULT_MARKER = 'BIBLE_CONDITIONING_IDENTITY_MUTATION_RESULT ';

export function runConditioningIdentityMutationProbe(mutationId: ConditioningIdentityMutationId) {
  if (!CONDITIONING_IDENTITY_MUTATION_IDS.includes(mutationId)) {
    throw new Error(`Unknown conditioning identity mutation: ${mutationId}`);
  }
  const baseline = buildConditioningIdentityWitness();
  const baselineFailures = evaluateConditioningIdentityWitness(baseline);
  if (baselineFailures.length > 0) {
    throw new Error(`Conditioning identity baseline was not green: ${JSON.stringify(baselineFailures)}`);
  }
  const mutant = mutate(baseline, mutationId);
  const mutationActive = JSON.stringify(mutant) !== JSON.stringify(baseline);
  const failures = evaluateConditioningIdentityWitness(mutant);
  const expectedInvariant = EXPECTED_INVARIANT[mutationId];
  const killed = failures.some((failure) => failure.invariantId === expectedInvariant);
  if (!mutationActive || !killed) {
    throw new Error(`${mutationId} proof incomplete: ${JSON.stringify({ mutationActive, failures })}`);
  }
  const restored = evaluateConditioningIdentityWitness(baseline).length === 0;
  const failure = failures.find((entry) => entry.invariantId === expectedInvariant)!;
  return {
    id: mutationId,
    active: mutationActive,
    killed,
    restored,
    invariantId: expectedInvariant,
    firstStage: mutationId === 'rehydrate_restores_generic_identity' ? 'store_rehydrate' : 'visible_week',
    report: `RULE conditioning identity\nINVARIANT ${expectedInvariant}\nMUTATION ${mutationId}\nSTATUS unauthorised\nEXPECTED ${JSON.stringify(failure.expected)}\nACTUAL ${JSON.stringify(failure.actual)}`,
  };
}

if (require.main === module) {
  try {
    const mutationId = process.argv[2] as ConditioningIdentityMutationId;
    process.stdout.write(`${RESULT_MARKER}${JSON.stringify(runConditioningIdentityMutationProbe(mutationId))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
}
