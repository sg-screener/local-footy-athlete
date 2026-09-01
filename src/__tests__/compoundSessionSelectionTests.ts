/**
 * R-319 — automatic strength sessions use at most four compound exercises.
 *
 * The classification comes from the canonical exercise tag. The composer may
 * use a compound only for an uncovered required movement direction; support
 * seats use isolation, then prehab, then core/robustness, then stay empty.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { generateProgramLocally } from '../services/api/generateProgram';
import { POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS, type PoolSlotKey } from '../data/exercisePoolsStrength';
import {
  EXERCISE_TAGS,
  strengthExerciseClassification,
} from '../data/exerciseTags';
import {
  MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION,
  auditFinalAutomaticSession,
  automaticIsolationSupportCandidatesForSlot,
  createAutomaticWeeklyExerciseSelector,
  missingRequiredStrengthClassifications,
  requiredStrengthClassificationIdentities,
  type AutomaticWeeklySelectionCandidate,
  type FinalAutomaticSelectionExercise,
} from '../rules/automaticWeeklyExerciseSelection';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { composedRowIsLegal } from '../rules/composedRowLegality';
import { injuryPermitsExerciseAtSeverity } from '../rules/injuryExerciseRisk';
import type { InjuryKey } from '../data/exerciseTags';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}
function assert(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(detail);
}
function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

function strengthPoolNames(slot: PoolSlotKey): string[] {
  return [
    ...STRENGTH_POOLS[slot].anchor.entries,
    ...STRENGTH_POOLS[slot].accessory.entries,
  ].map((entry) => entry.name);
}

function assertAllClassifiedAs(
  names: readonly string[],
  expected: 'compound' | 'isolation',
): void {
  const wrong = names.filter((name) => strengthExerciseClassification(name) !== expected);
  assert(wrong.length === 0, `expected ${expected}: ${wrong.join(', ')}`);
}

run('canonical classification keeps the approved boundary and distinct face-pull identities', () => {
  assertAllClassifiedAs(strengthPoolNames('squat'), 'compound');
  assertAllClassifiedAs(['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']
    .flatMap((slot) => strengthPoolNames(slot as PoolSlotKey)), 'compound');
  assertAllClassifiedAs(strengthPoolNames('hinge')
    .filter((name) => name !== 'SL 45° Back Extension'), 'compound');
  assertAllClassifiedAs(strengthPoolNames('isolation_upper'), 'isolation');
  for (const name of POOL_REGISTRY.biceps.map((entry) => entry.name)) {
    assert(strengthExerciseClassification(name)
      === (name === 'Chin-Up Negative (Slow)' ? 'compound' : 'isolation'),
    `wrong biceps classification: ${name}`);
  }
  for (const name of POOL_REGISTRY.groin_adductors.map((entry) => entry.name)) {
    assert(strengthExerciseClassification(name)
      === (name === 'Cossack Squat' || name === 'Lateral Lunge' ? 'compound' : 'isolation'),
    `wrong groin classification: ${name}`);
  }
  assert(strengthExerciseClassification('Face Pull') === 'isolation', 'Face Pull is not isolation');
  assert(strengthExerciseClassification('Cable Face Pull') === 'isolation',
    'Cable Face Pull is not isolation');
  assert(strengthExerciseClassification('Box Jumps') === undefined, 'power was classified');
  assert(strengthExerciseClassification('Farmer Carry') === undefined, 'carry was classified');
  assert(strengthExerciseClassification('Dead Bug') === undefined, 'core was classified');
  assert(strengthExerciseClassification('Banded External Rotation') === undefined,
    'prehab was classified');
});

run('Lower Accessories — Isolation is the corrected 13-name grouping without a new pool', () => {
  const fromExistingPools = [...new Set([
    'SL 45° Back Extension',
    ...strengthPoolNames('isolation_lower'),
    ...POOL_REGISTRY.groin_adductors
      .map((entry) => entry.name)
      .filter((name) => strengthExerciseClassification(name) === 'isolation'),
    ...POOL_REGISTRY.calves.map((entry) => entry.name),
  ])];
  const approved = [
    'SL 45° Back Extension',
    'Nordic Lower',
    'Hamstring Curl',
    'Leg Extension',
    'Calf Raises',
    'Tib Raises',
    'Single-Leg Hip Thrust',
    'Back Extension',
    'Copenhagen Plank (Half)',
    'Long-Lever Copenhagen',
    'Groin Squeeze',
    'Single-Leg Calf Raise',
    'Seated Calf Raise',
  ];
  assert(fromExistingPools.length === approved.length
    && approved.every((name) => fromExistingPools.includes(name)),
  `lower accessory grouping changed: ${fromExistingPools.join(', ')}`);
  assertAllClassifiedAs(fromExistingPools, 'isolation');
});

run('every selectable governed strength/accessory identity has one classification', () => {
  const required = requiredStrengthClassificationIdentities();
  const missing = missingRequiredStrengthClassifications();
  const compounds = required.filter((name) => strengthExerciseClassification(name) === 'compound');
  const isolations = required.filter((name) => strengthExerciseClassification(name) === 'isolation');
  assert(required.length === 84,
    `classification scope changed: ${required.length} identities`);
  assert(compounds.length === 49 && isolations.length === 35,
    `classification split changed: compound=${compounds.length} isolation=${isolations.length}`);
  assert(missing.length === 0, `missing classifications: ${missing.join(', ')}`);
});

run('removing one required classification makes the completeness guard fail', () => {
  const tags = EXERCISE_TAGS['Back Squat'];
  assert(tags?.strengthClassification === 'compound', 'mutation subject is absent');
  const original = tags.strengthClassification;
  delete tags.strengthClassification;
  try {
    assert(missingRequiredStrengthClassifications().includes('Back Squat'),
      'completeness guard survived a removed required classification');
  } finally {
    tags.strengthClassification = original;
  }
  assert(missingRequiredStrengthClassifications().length === 0,
    'classification mutation was not restored');
});

const automatic = (
  identity: string,
  requestedSlot: AutomaticWeeklySelectionCandidate['requestedSlot'],
  requestedAsMain: boolean,
): FinalAutomaticSelectionExercise & AutomaticWeeklySelectionCandidate => ({
  identity, authorship: 'automatic', route: 'strength', requestedAsMain, requestedSlot,
  dayKind: null,
});

run('founding upper session keeps four directions and refuses fifth/sixth compounds', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.beginSession();
  const main = [
    automatic('Bench Press', 'horizontal_push', true),
    automatic('Pull-Ups', 'vertical_pull', true),
    automatic('Chest-Supported DB Row', 'horizontal_pull', true),
    automatic('DB Shoulder Press', 'vertical_push', true),
  ];
  for (const row of main) {
    assert(selector.canUse(row), `required direction was refused: ${row.identity}`);
    selector.accept(row);
  }
  assert(selector.sessionCompoundCount() === 4, 'the four main directions were not counted');
  assert(!selector.canUse(automatic('Push-ups', 'push_accessory_1', false)),
    'Push-ups was admitted as a fifth support compound');
  assert(!selector.canUse(automatic('Single-Arm Lat Pulldown', 'pull_accessory_1', false)),
    '1-Arm Lat Pulldown was admitted as a sixth support compound');

  const pushSupport = selector.chooseFallback({
    sameCategory: [],
    accessories: automaticIsolationSupportCandidatesForSlot('push_accessory_1'),
    prehab: [], coreOrRobustness: [], requestedSlot: 'push_accessory_1',
    dayKind: 'upper_full', requestedAsMain: false,
  });
  assert(pushSupport && strengthExerciseClassification(pushSupport.identity) === 'isolation',
    `push support was not isolation: ${JSON.stringify(pushSupport)}`);
});

run('a deliberate fifth automatic compound is a session finding; athlete additions are unrestricted', () => {
  const four = [
    automatic('Bench Press', 'horizontal_push', true),
    automatic('Pull-Ups', 'vertical_pull', true),
    automatic('Chest-Supported DB Row', 'horizontal_pull', true),
    automatic('DB Shoulder Press', 'vertical_push', true),
  ];
  const fifth = automatic('Push-ups', 'push_accessory_1', false);
  const mutation = auditFinalAutomaticSession([...four, fifth]);
  assert(mutation.compoundCount === 5 && mutation.overLimitIdentities.includes('Push-ups'),
    JSON.stringify(mutation));
  const athleteFifth = auditFinalAutomaticSession([...four, { ...fifth, authorship: 'athlete' }]);
  assert(athleteFifth.compoundCount === 4 && athleteFifth.overLimitIdentities.length === 0,
    JSON.stringify(athleteFifth));
});

run('lower selection allows the main plus matching single-leg compound, then falls to isolation', () => {
  const selector = createAutomaticWeeklyExerciseSelector();
  selector.beginSession();
  const hinge = automatic('RDLs', 'hinge', true);
  const singleLeg = automatic('Single-Leg RDL', 'single_leg_hip', false);
  assert(selector.canUse(hinge), 'lower main was refused'); selector.accept(hinge);
  assert(selector.canUse(singleLeg), 'matching single-leg compound was refused'); selector.accept(singleLeg);
  assert(!selector.canUse(automatic('Hip Thrusts', 'football_robustness', false)),
    'unneeded support compound was admitted on a lower day');
  const support = selector.chooseFallback({
    sameCategory: [], accessories: ['Hamstring Curl'], prehab: ['Nordic Lower'],
    coreOrRobustness: ['Band Pallof Press'], requestedSlot: 'football_robustness',
    dayKind: 'lower_hinge', requestedAsMain: false,
  });
  assert(support?.identity === 'Hamstring Curl' && support.tier === 'accessory',
    JSON.stringify(support));
});

function athlete(
  gender: 'male' | 'female',
  phase: 'In-season' | 'Pre-season' | 'Off-season',
  kit: 'commercial_gym' | 'bodyweight_only',
  injuries: OnboardingData['injuries'] = [],
): OnboardingData {
  return {
    gender, seasonPhase: phase, gameDay: phase === 'Off-season' ? undefined : 'Saturday',
    seasonFinishedOn: phase === 'Off-season' ? '2026-07-12' : undefined,
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: phase === 'Off-season' ? 0 : 2,
    teamTrainingDays: phase === 'Off-season' ? [] : ['Tuesday', 'Thursday'],
    equipmentAnswer: kit === 'commercial_gym'
      ? presetEquipmentAnswer('commercial_gym')
      : { tags: {}, modalities: {}, answeredOn: '2026-08-03' },
    goals: ['stronger_and_fitter'], experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent', squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight', weightKg: gender === 'female' ? 65 : 85,
    twoKmTimeTrial: { seconds: 480, recordedOn: '2026-08-03', source: 'onboarding' },
  } as OnboardingData;
}

function automaticSessions(program: TrainingProgram): FinalAutomaticSelectionExercise[][] {
  return program.microcycles.slice(0, 2).flatMap((week) => week.workouts.map((workout: Workout) =>
    (workout.exercises ?? [])
      .filter((row) => row.section18Evidence?.provenance === 'composer_declaration')
      .map((row) => ({
        identity: String(row.exercise?.name ?? ''),
        authorship: 'automatic' as const,
        route: 'strength' as const,
        requestedAsMain: row.section18Evidence?.role === 'main_strength',
        requestedSlot: row.section18Evidence?.slot as FinalAutomaticSelectionExercise['requestedSlot'],
      }))));
}

run('small upper/lower sample respects the cap across sex, phase, equipment and injury', () => {
  const worlds = [
    athlete('male', 'In-season', 'commercial_gym'),
    athlete('female', 'Pre-season', 'commercial_gym'),
    athlete('male', 'Off-season', 'bodyweight_only'),
    athlete('female', 'In-season', 'commercial_gym', [{
      bodyArea: 'shoulder', description: 'shoulder', severityScore: 6,
      severity: 'Moderate', whenItHurts: 'Lifting', movementTriggers: ['pressing'],
    }]),
  ];
  let sessions = 0;
  for (const [index, profile] of worlds.entries()) {
    const program = quiet(() => generateProgramLocally(profile, {
      todayISO: '2026-08-03', blockNumber: 1, microcycleLimit: 4,
      selectionHistory: [], recordSelections: false,
    }));
    const kit = resolveEquipmentCapabilities(profile).tags;
    for (const rows of automaticSessions(program)) {
      if (rows.length === 0) continue;
      sessions += 1;
      const result = auditFinalAutomaticSession(rows);
      assert(result.compoundCount <= MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION,
        `world ${index}: ${JSON.stringify(result)}`);
      for (const row of rows) {
        assert(composedRowIsLegal(row.identity, kit),
          `world ${index}: ${row.identity} is illegal for the athlete's kit`);
        if (row.requestedSlot?.startsWith('push_accessory')
          || row.requestedSlot?.startsWith('pull_accessory')) {
          assert(strengthExerciseClassification(row.identity) === 'isolation',
            `world ${index}: compound support survived: ${row.identity}`);
        }
        for (const injury of profile.injuries ?? []) {
          if (strengthExerciseClassification(row.identity) === undefined) continue;
          assert(injuryPermitsExerciseAtSeverity(
            row.identity,
            injury.bodyArea as InjuryKey,
            injury.severityScore ?? 0,
            injury.movementTriggers ?? [],
          ), `world ${index}: ${row.identity} is illegal for ${injury.bodyArea} injury`);
        }
      }
    }
  }
  assert(sessions >= 8, `sample was green and empty: ${sessions} strength sessions`);
});

console.log(`\nCompound session selection: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
