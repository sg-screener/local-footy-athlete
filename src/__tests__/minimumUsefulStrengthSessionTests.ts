/** R-334 — useful ordinary strength sessions and typed split-upper ownership. */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import path from 'node:path';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  EXERCISE_TAGS,
  UPPER_ACCESSORY_AFFINITY,
  upperAccessoryAffinity,
} from '../data/exerciseTags';
import {
  auditFinalAutomaticSession,
  auditFinalAutomaticWeek,
  automaticExerciseRouteForIdentity,
  MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION,
  workoutExerciseWasAutomaticallySelected,
} from '../rules/automaticWeeklyExerciseSelection';
import {
  MINIMUM_USEFUL_STRENGTH_EXERCISES,
  minimumUsefulStrengthApplies,
  usefulStrengthExerciseCount,
} from '../rules/minimumUsefulStrengthSession';
import type {
  OnboardingData,
  SeasonPhase,
  Workout,
  WorkoutExercise,
} from '../types/domain';
import { readSheetRecords } from './support/xlsxReader';

let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

function quietly<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const TODAY = '2026-09-07';
const PREFERRED_BY_COUNT: Readonly<Record<number, readonly string[]>> = {
  2: ['Monday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

function profile(gender: 'male' | 'female', phase: SeasonPhase, availableDays: number): OnboardingData {
  return {
    firstName: `${gender}-${phase}-${availableDays}`, ageRange: '22-26', gender,
    position: 'inside_mid', heightCm: 180, weightKg: 82,
    motivation: 'Build strength and football fitness', goals: ['stronger_and_fitter'],
    seasonPhase: phase, seasonFinishedOn: phase === 'Off-season' ? '2026-09-06' : undefined,
    trainingDaysPerWeek: availableDays,
    preferredTrainingDays: [...PREFERRED_BY_COUNT[availableDays]] as never,
    teamTrainingDays: [], teamTrainingDaysPerWeek: 0,
    usualGameDay: phase === 'In-season' ? 'Saturday' : undefined,
    gameDay: phase === 'In-season' ? 'Saturday' : undefined,
    trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete', injuries: [],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight', conditioningLevel: 'Good',
    sprintExposure: '2+ times per week', recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 480, recordedOn: TODAY, source: 'onboarding' },
  } as OnboardingData;
}

function generate(
  gender: 'male' | 'female',
  phase: SeasonPhase,
  availableDays: number,
  phaseWeek = 1,
): Workout[] {
  const phaseEntry = new Date(`${TODAY}T12:00:00Z`);
  phaseEntry.setUTCDate(phaseEntry.getUTCDate() - ((phaseWeek - 1) * 7));
  return quietly(() => generateProgramLocally(profile(gender, phase, availableDays), {
    todayISO: TODAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: phase,
      phaseEntryWeekStartISO: phaseEntry.toISOString().slice(0, 10),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })).microcycles[0]?.workouts ?? [];
}

function identity(row: WorkoutExercise): string {
  return row.exercise?.name ?? '';
}

function finalAutomaticRows(workout: Workout) {
  return workout.exercises.filter(workoutExerciseWasAutomaticallySelected).map((row) => ({
    identity: identity(row),
    authorship: 'automatic' as const,
    route: row.role === 'power' ? 'power' as const : automaticExerciseRouteForIdentity(identity(row)),
    requestedAsMain: row.section18Evidence?.role === 'main_strength',
    requestedSlot: row.section18Evidence?.slot ?? undefined,
  }));
}

const worlds = (['male', 'female'] as const).flatMap((gender) =>
  (['Off-season', 'Pre-season', 'In-season'] as const).flatMap((phase) =>
    [2, 3, 4, 5, 6].map((availableDays) => ({
      gender, phase, availableDays,
      workouts: generate(gender, phase, availableDays),
    }))));

console.log('\n[final generated sessions]');
run('the ruled ordinary-session minimum is exactly four useful exercises', () => {
  assert.equal(MINIMUM_USEFUL_STRENGTH_EXERCISES, 4);
});
run('ordinary Lower Squat, Lower Hinge, Upper Push and Upper Pull meet the useful minimum across 30 worlds', () => {
  const ordinary = worlds.flatMap((world) => world.workouts
    .filter((workout) => minimumUsefulStrengthApplies(workout.composedDayShape))
    .map((workout) => ({ ...world, workout })));
  assert(ordinary.length > 0);
  assert.deepEqual(new Set(ordinary.map(({ workout }) => workout.composedDayShape)), new Set([
    'lower_squat', 'lower_hinge', 'upper_split_push', 'upper_split_pull',
  ]));
  for (const { gender, phase, availableDays, workout } of ordinary) {
    const label = `${gender}/${phase}/${availableDays}/${workout.name}`;
    assert.equal(usefulStrengthExerciseCount(workout) >= MINIMUM_USEFUL_STRENGTH_EXERCISES,
      true, `${label}: ${usefulStrengthExerciseCount(workout)}`);
    assert.equal(workout.usefulStrengthSessionContract?.status, 'met', label);
    assert.equal(workout.usefulStrengthSessionContract?.minimum,
      MINIMUM_USEFUL_STRENGTH_EXERCISES, label);
    assert.deepEqual(workout.usefulStrengthSessionContract?.reductionReasons, [], label);
  }
});

run('Upper Push has no automatic Pull accessory and Upper Pull has no automatic Push accessory', () => {
  for (const world of worlds) for (const workout of world.workouts) {
    const direction = workout.composedDayShape === 'upper_split_push' ? 'push'
      : workout.composedDayShape === 'upper_split_pull' ? 'pull' : null;
    if (!direction) continue;
    for (const row of workout.exercises.filter(workoutExerciseWasAutomaticallySelected)) {
      const slot = row.section18Evidence?.slot ?? '';
      if (!slot.includes('accessory')) continue;
      const affinity = upperAccessoryAffinity(identity(row));
      assert(affinity === direction || affinity === 'both',
        `${workout.name}: ${identity(row)} is ${String(affinity)}`);
    }
  }
});

run('the minimum never introduces an exact repeat, a weekly main-family repeat or a fifth compound', () => {
  for (const world of worlds) {
    const finalDays = world.workouts.map((workout) => ({
      dayKind: workout.composedDayShape ?? null,
      exercises: finalAutomaticRows(workout),
    }));
    const weekly = auditFinalAutomaticWeek(finalDays);
    assert.deepEqual(weekly.repeatedExact, [], `${world.gender}/${world.phase}/${world.availableDays}`);
    assert.deepEqual(weekly.repeatedMainFamilies, [], `${world.gender}/${world.phase}/${world.availableDays}`);
    for (const day of finalDays) {
      const session = auditFinalAutomaticSession(day.exercises);
      assert(session.compoundCount <= MAX_AUTOMATIC_COMPOUNDS_PER_STRENGTH_SESSION,
        JSON.stringify(session));
    }
  }
});

run('the canonical persistence round-trip preserves the complete session and typed minimum receipt', () => {
  for (const world of worlds) {
    const before = JSON.stringify(world.workouts);
    const restarted = JSON.parse(before) as Workout[];
    assert.equal(JSON.stringify(restarted), before);
    for (const workout of restarted.filter((row) => minimumUsefulStrengthApplies(row.composedDayShape))) {
      assert.equal(workout.usefulStrengthSessionContract?.delivered,
        usefulStrengthExerciseCount(workout));
    }
  }
});

run('a scheduled deload may be shorter only with its typed reduction reason', () => {
  const deloads = (['male', 'female'] as const).flatMap((gender) =>
    generate(gender, 'Pre-season', 5, 4)
      .filter((workout) => minimumUsefulStrengthApplies(workout.composedDayShape)));
  assert(deloads.length > 0);
  for (const workout of deloads) {
    if (usefulStrengthExerciseCount(workout) < MINIMUM_USEFUL_STRENGTH_EXERCISES) {
      assert.equal(workout.usefulStrengthSessionContract?.status, 'reduced_for_typed_reason');
      assert(workout.usefulStrengthSessionContract?.reductionReasons.includes('scheduled_deload'));
    }
  }
});

console.log('\n[Exercise Master equality]');
run('typed accessory affinity and Exercise Master agree in both directions', () => {
  const workbook = path.resolve(__dirname, '../../docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx');
  const rows = readSheetRecords(workbook, 'Exercise Master', 6);
  const sheet = new Map(rows.flatMap((row) => {
    const affinity = row['Accessory Affinity']?.trim();
    return affinity ? [[row.Exercise, affinity]] : [];
  }));
  assert.deepEqual(sheet, new Map(Object.entries(UPPER_ACCESSORY_AFFINITY)));
  for (const [exercise, affinity] of sheet) {
    assert.equal(EXERCISE_TAGS[exercise]?.accessoryAffinity, affinity, exercise);
  }
});

console.log(`\nMinimum useful strength session: ${passed} passed / ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
