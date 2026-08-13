import {
  DEV_E2E_SEED_IDS,
  buildDevE2ESeed,
  devE2EWeekStartForSeed,
  validateDevE2EWitnesses,
  type DevE2ESeedId,
} from '../dev/e2e/devE2ESeedRegistry';
import { DEV_E2E_SCENARIO_MANIFESTS } from '../dev/e2e/devE2EScenarioManifestRegistry';
import { semanticFingerprint } from '../dev/e2e/semanticFingerprint';
import { getSessionComponents } from '../utils/sessionComponents';
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
  'coach-production-replay',
] as const;

const EXPECTED_WITNESS_KINDS: Record<DevE2ESeedId, string> = {
  'standard-in-season-week': 'program,profile_exact,calendar_mark',
  'spent-week-friday':
    'program,profile_exact,calendar_mark,workout,session_feedback,workout,session_feedback,workout,session_feedback,eligible_target_date,absent_source_fact,absent_source_fact,absent_source_fact,absent_source_fact',
  'stacked-team-training-upper-pull':
    'program,profile_exact,workout,component_identity,component_identity,visible_card_detail_equality',
  'lower-body-deletion': 'program,profile_exact,workout',
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
  'coach-production-replay':
    'program,profile_exact,empty_coach_state,calendar_mark,fixture_identity,eligible_target_date,workout,exercise_present,future_progression_target,absent_source_fact,absent_source_fact,absent_source_fact,absent_source_fact,reversible_ledger_state,visible_card_detail_equality,visible_card_detail_equality,visible_card_detail_equality,visible_card_detail_equality',
  // THE THINNEST WITNESS LIST IN THE REGISTRY, AND DELIBERATELY SO. This seed
  // exists to put a simulator on 10 December with a club — its whole product is
  // the CLOCK and the PROFILE, which `program` and `profile_exact` already pin.
  // A witness asserting the Christmas card is on screen would belong to a
  // Maestro flow, not to the seed: the seed's job is the world, not the render.
  'christmas-break-ask': 'program,profile_exact',
};

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async () => {
  fetchCalls += 1;
  throw new Error('fetch must not be called by a dev E2E seed');
}) as typeof fetch;

try {
  ok(
    // 11 -> 12: `christmas-break-ask` (SEAT_INBOX item 31 part 5). **A COUNT
    // RAISED DELIBERATELY, IN THE COMMIT THAT EARNS IT** — this cell exists so a
    // seed cannot appear without someone saying why, and the why is that the
    // Christmas ask is date-gated to December and no seed could reach it.
    'Explorer campaign adds exactly the two requested seed IDs',
    DEV_E2E_SEED_IDS.length === 12 &&
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

  // ── STABILISATION MAY CHANGE IDENTITIES; IT MAY NEVER CHANGE CONTENT ─────
  //
  // FOUNDING CASE, 2026-08-12, and it was found by DRIVING a seeded app rather
  // than by reading code. `stabilizeMicrocycle` rewrites every exercise row id
  // so a seed is reproducible, and nothing rewrote the references TO those ids.
  // `conditioningBlock.options[].exerciseIds` still named the generator's ids,
  // matched no row, and `conditioningIdsFromBlock` returned an empty set — so
  // the conditioning work was filed as strength.
  //
  // **23 of 23 seeded workouts carrying a conditioning block were affected —
  // every seed, not a sample.** A Monday the generator built as strength PLUS a
  // walk seeded as strength alone, with the walk buried inside the strength
  // part, and the day-first card drew one component where the athlete has two.
  // The raw generated program was measured at the same time and is CORRECT
  // (4 of 4 blocks resolve), so this never reached a real athlete — it made
  // every seeded world a world no athlete is in, which is the fixture-fidelity
  // law's exact subject.
  //
  // A RENAME CARRIES ITS REFERENCES OR IT IS A DELETION. That is what this
  // cell holds, and it is stated as the general rule because the next field to
  // point at a row id will arrive the same way this one did.
  {
    let workoutsWithBlock = 0;
    let unresolvedBlockIds = 0;
    let workoutsWithConditioningComponent = 0;
    for (const seedId of DEV_E2E_SEED_IDS) {
      for (const microcycle of buildDevE2ESeed(seedId).program.microcycles) {
        for (const workout of microcycle.workouts) {
          const options = workout.conditioningBlock?.options ?? [];
          if (options.length === 0) continue;
          workoutsWithBlock += 1;
          const rowIds = new Set((workout.exercises ?? []).map((row) => String(row.id)));
          for (const option of options) {
            for (const rowId of option.exerciseIds ?? []) {
              if (!rowIds.has(String(rowId))) unresolvedBlockIds += 1;
            }
          }
          if (getSessionComponents(workout).some((part) => part.kind === 'conditioning')) {
            workoutsWithConditioningComponent += 1;
          }
        }
      }
    }
    // ANTI-VACUOUS: a world with no conditioning blocks would satisfy the
    // resolve check by having nothing to resolve.
    ok(
      'the seeds still contain conditioning blocks for this cell to read',
      workoutsWithBlock >= 20,
      `only ${workoutsWithBlock} seeded workouts carry a conditioning block`,
    );
    ok(
      'every conditioning block id resolves to a row on its own workout',
      unresolvedBlockIds === 0,
      `${unresolvedBlockIds} of the block ids across ${workoutsWithBlock} workouts point at no row — `
      + 'the stabiliser renamed rows without carrying their references',
    );
    // THE CONSEQUENCE, ASSERTED SEPARATELY FROM THE CAUSE. Ids that resolve are
    // only interesting because the component survives; asserting the id alone
    // would pass on a classifier that had stopped reading the block at all.
    ok(
      'a seeded day that carries attached conditioning still reports it as a component',
      workoutsWithConditioningComponent === workoutsWithBlock,
      `${workoutsWithConditioningComponent} of ${workoutsWithBlock} report a conditioning component`,
    );
  }

  // ── spent-week-friday: the device-exact "week is spent" state ────────────
  // Sam's phone, 2026-07-24. Every other seed anchors on a Monday, so "today"
  // and "the visible week's Monday" were the same date and a partly-spent week
  // was unreachable. These assertions pin the divergence itself, not just the
  // witnesses — if a future change re-collapses anchor and week start, this
  // seed silently stops reproducing the state it exists for.
  const spentSeed = buildDevE2ESeed('spent-week-friday');
  const spentWeekStart = devE2EWeekStartForSeed('spent-week-friday');
  ok(
    'spent-week seed anchors on Friday, four days into its own week',
    spentSeed.anchorDate === '2026-07-24' &&
      spentWeekStart === '2026-07-20' &&
      spentSeed.anchorDate !== spentWeekStart,
  );
  ok(
    'spent-week seed program covers the week the Friday anchor falls in',
    spentSeed.program.microcycles[0]?.startDate.slice(0, 10) === spentWeekStart,
  );
  const spentDone = spentSeed.auxiliaryState.filter((item) =>
    item.kind === 'session_feedback');
  ok(
    'spent-week seed records Mon/Tue/Thu Done before the anchor day',
    spentDone.length === 3 &&
      spentDone.every((item) =>
        item.kind === 'session_feedback' &&
        item.completion === 'full' &&
        item.date < spentSeed.anchorDate) &&
      spentDone.map((item) => (item.kind === 'session_feedback' ? item.date : ''))
        .join(',') === '2026-07-20,2026-07-21,2026-07-23',
  );
  const spentState = buildDevE2EWitnessState(spentSeed);
  ok(
    'spent-week seed leaves Wednesday and Friday unsessioned and Saturday a game',
    !spentState.program?.microcycles[0]?.workouts.some((workout) =>
      workout.dayOfWeek === 3 || workout.dayOfWeek === 5) &&
      spentState.calendarMarks['2026-07-25'] === 'game',
  );
  ok(
    'spent-week seed carries a real adjacent next week to project onto',
    spentSeed.program.microcycles.length >= 2 &&
      spentSeed.program.microcycles[1]?.startDate.slice(0, 10) === '2026-07-27' &&
      (spentSeed.program.microcycles[1]?.workouts.length ?? 0) > 0,
  );
  ok(
    'spent-week seed starts with an empty fact store (findings cannot be pre-seeded)',
    (spentState.temporarySourceFacts ?? []).length === 0 &&
      spentState.activeInjury === null &&
      spentState.activeConstraints.length === 0,
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
  ok('scenario protocol plus nine Explorer manifests add no seed families',
    DEV_E2E_SCENARIO_MANIFESTS.length === DEV_E2E_SEED_IDS.length + 9 &&
      DEV_E2E_SCENARIO_MANIFESTS.every((manifest) =>
        DEV_E2E_SEED_IDS.includes(manifest.seedId)) &&
      DEV_E2E_SEED_IDS.every((seedId) =>
        DEV_E2E_SCENARIO_MANIFESTS.some((manifest) =>
          manifest.scenarioId === seedId &&
          manifest.steps.length === 1 &&
          manifest.steps[0].stepId === seedId)));
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\nDev E2E seed registry: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
