import {
  DEV_E2E_SEED_IDS,
  buildDevE2ESeed,
  validateDevE2EWitnesses,
  type DevE2ESeedId,
} from '../dev/e2e/devE2ESeedRegistry';
import { DEV_E2E_SCENARIO_MANIFESTS } from '../dev/e2e/devE2EScenarioManifestRegistry';
import { semanticFingerprint } from '../dev/e2e/semanticFingerprint';
import { buildDevE2EWitnessState } from './devE2ESeedTestSupport';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}`);
  }
}

const EXPLORER_SEEDS = [
  'multi-reload-fixture-chain',
  'repeat-week-phase-transition',
  'coach-production-replay',
] as const;

const EXPECTED_WITNESS_KINDS: Record<DevE2ESeedId, string> = {
  'standard-in-season-week': 'program,profile_exact,calendar_mark',
  'stacked-team-training-upper-pull':
    'program,profile_exact,workout,component_identity,component_identity,visible_card_detail_equality',
  'lower-body-deletion': 'program,profile_exact,workout,exercise_present',
  'one-set-strength': 'program,profile_exact,exercise_sets',
  'fixture-move':
    'program,profile_exact,calendar_mark,fixture_identity,eligible_target_date,absent_overlay,visible_card_detail_equality',
  'injury-case': 'program,profile_exact,active_injury',
  'equipment-restriction-case':
    'program,profile_exact,profile_equipment,active_equipment',
  'feedback-progression-case':
    'program,profile_exact,session_feedback,future_progression_target,visible_card_detail_equality',
  'multi-reload-fixture-chain':
    'program,profile_exact,accepted_week_count,calendar_mark,fixture_identity,eligible_target_date,workout,absent_source_fact,absent_source_fact,absent_source_fact,absent_source_fact,reversible_ledger_state,accepted_revision,visible_card_detail_equality,visible_card_detail_equality,visible_card_detail_equality',
  'repeat-week-phase-transition':
    'program,profile_exact,accepted_week_count,week_contract_signature,week_contract_signature,workout,workout,fixture_identity,component_identity,absent_overlay',
  'coach-production-replay':
    'program,profile_exact,empty_coach_state,calendar_mark,fixture_identity,eligible_target_date,workout,exercise_present,future_progression_target,absent_source_fact,absent_source_fact,absent_source_fact,absent_source_fact,reversible_ledger_state,visible_card_detail_equality,visible_card_detail_equality,visible_card_detail_equality,visible_card_detail_equality',
};

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async () => {
  fetchCalls += 1;
  throw new Error('fetch must not be called by a dev E2E seed');
}) as typeof fetch;

try {
  ok(
    'Explorer campaign adds exactly the three requested seed IDs',
    DEV_E2E_SEED_IDS.length === 11 &&
      DEV_E2E_SEED_IDS.filter((seedId) =>
      (EXPLORER_SEEDS as readonly string[]).includes(seedId)).join(',') ===
      EXPLORER_SEEDS.join(','),
  );

  for (const seedId of DEV_E2E_SEED_IDS) {
    const seed = buildDevE2ESeed(seedId);
    const state = buildDevE2EWitnessState(seed);
    const failuresForSeed = validateDevE2EWitnesses(
      seedId,
      seed.witnesses,
      state,
    );
    ok(
      `${seedId} has an explicit anchor`,
      /^\d{4}-\d{2}-\d{2}$/.test(seed.anchorDate),
    );
    ok(
      `${seedId} passes every declared semantic witness`,
      failuresForSeed.length === 0,
      failuresForSeed.join(', '),
    );
    ok(`${seedId} has visible witnesses`, seed.witnesses.length >= 2);
    ok(
      `${seedId} keeps its typed witness contract`,
      seed.witnesses.map((witness) => witness.kind).join(',') ===
        EXPECTED_WITNESS_KINDS[seedId],
    );
  }

  const repeatSeed = buildDevE2ESeed('repeat-week-phase-transition');
  const repeatSignatures = repeatSeed.witnesses
    .filter((witness) => witness.kind === 'week_contract_signature')
    .map((witness) => witness.signature);
  ok(
    'repeat-week seed proves source and target phase signatures differ',
    repeatSignatures.length === 2 && repeatSignatures[0] !== repeatSignatures[1],
  );

  const multiSeed = buildDevE2ESeed('multi-reload-fixture-chain');
  ok(
    'multi-reload seed contains at least two accepted adjacent weeks',
    multiSeed.program.microcycles.length >= 2 &&
      multiSeed.program.microcycles.every((week) => !!week.exposureContractV2),
  );
  const acceptedRevisionWitness = multiSeed.witnesses.find((witness) =>
    witness.kind === 'accepted_revision');
  ok(
    'multi-reload seed declares the exact accepted installation revision',
    acceptedRevisionWitness?.kind === 'accepted_revision' &&
      acceptedRevisionWitness.revision === 8,
  );

  const stackedSeed = buildDevE2ESeed('stacked-team-training-upper-pull');
  const stackedComponents = stackedSeed.witnesses.filter((witness) =>
    witness.kind === 'component_identity');
  ok(
    'stacked seed binds separate Team Training and Upper Pull identities to one day',
    stackedComponents.length === 2 &&
      stackedComponents[0]?.kind === 'component_identity' &&
      stackedComponents[1]?.kind === 'component_identity' &&
      stackedComponents[0].date === stackedComponents[1].date &&
      stackedComponents[0].workoutId === stackedComponents[1].workoutId &&
      stackedComponents[0].identity !== stackedComponents[1].identity,
  );

  const coachSeed = buildDevE2ESeed('coach-production-replay');
  const coachState = buildDevE2EWitnessState(coachSeed).coachState;
  ok(
    'Coach replay seed begins with zero Coach state',
    coachState?.transcriptCount === 0 &&
      coachState.memoryCount === 0 &&
      coachState.mutationHistoryCount === 0 &&
      coachState.pendingClarifier === null &&
      coachState.pendingProposal === null,
  );

  const originalTZ = process.env.TZ;
  process.env.TZ = 'Pacific/Honolulu';
  const honolulu = Object.fromEntries(DEV_E2E_SEED_IDS.map((seedId) => [
    seedId,
    semanticFingerprint(buildDevE2ESeed(seedId)),
  ]));
  process.env.TZ = 'Europe/Berlin';
  const berlin = Object.fromEntries(DEV_E2E_SEED_IDS.map((seedId) => [
    seedId,
    semanticFingerprint(buildDevE2ESeed(seedId)),
  ]));
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
  ok(
    'seed results remain identical across timezone changes',
    semanticFingerprint(honolulu) === semanticFingerprint(berlin),
  );

  let unknownRejected = false;
  try {
    buildDevE2ESeed('not-allowlisted' as DevE2ESeedId);
  } catch {
    unknownRejected = true;
  }
  ok('unknown seed IDs fail in the pure registry', unknownRejected);
  ok('no named seed calls fetch', fetchCalls === 0, `fetchCalls=${fetchCalls}`);
  ok('scenario protocol adds no seed families',
    DEV_E2E_SCENARIO_MANIFESTS.length === DEV_E2E_SEED_IDS.length &&
      DEV_E2E_SCENARIO_MANIFESTS.every((manifest) =>
        DEV_E2E_SEED_IDS.includes(manifest.seedId) &&
        manifest.steps.length === 1 &&
        manifest.steps[0].stepId === manifest.seedId));
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\nDev E2E seed registry: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
