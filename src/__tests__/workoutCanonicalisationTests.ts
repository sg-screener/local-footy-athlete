/**
 * Shared post-generation / post-mutation canonicalisation invariants.
 * Run: npx sucrase-node src/__tests__/workoutCanonicalisationTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Microcycle, PowerBlock, TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import {
  validateMicrocycleAgainstActiveConstraints,
  validateProgramAgainstActiveConstraints,
  validateWorkoutAgainstActiveConstraints,
} from '../utils/postGenerationConstraintValidation';
import { getSessionComponentRows, getSessionComponents } from '../utils/sessionComponents';
import { combinedConditioningCategoryLabel } from '../utils/weeklyPlanDisplay';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) { pass++; console.log(`  PASS ${name}`); return; }
  fail++; failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
}
function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}
function section(name: string): void { console.log(`\n${name}`); }

function row(name: string, index: number, overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `row-${slug}-${index}`,
    workoutId: 'workout',
    exerciseId: `ex-${slug}`,
    exerciseOrder: index + 1,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 50,
    restSeconds: 90,
    exercise: {
      id: `ex-${slug}`,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function workout(
  name: string,
  rows: WorkoutExercise[],
  overrides: Partial<Workout> = {},
): Workout {
  return {
    id: 'workout',
    microcycleId: 'mc',
    dayOfWeek: 1,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: rows,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function power(kind: 'primer' | 'contrast', family: 'lower' | 'upper'): PowerBlock {
  return {
    id: `power-${kind}-${family}`,
    kind,
    family,
    title: kind === 'contrast' ? 'Contrast Power' : 'Power Primer',
    prescription: '3 x 3 — full rest, fast & sharp',
    placement: 'pre_lift',
    options: [{
      name: family === 'lower' ? 'Broad Jump' : 'Explosive Push-Up',
      sets: 3,
      repsMin: 3,
      repsMax: 3,
      equipmentRequired: [],
    }],
    notes: kind === 'contrast' ? ['Contrast: pair with the heavy lift.'] : ['Stay sharp.'],
    counting: {
      hardExposure: false,
      mainStrength: false,
      conditioningCredit: 'none',
      isFinisher: false,
    },
  };
}

const EARLY = {
  phase: 'Off-season' as const,
  offseasonSubphase: 'early_offseason' as const,
  weekKind: 'build' as const,
  readiness: 'high' as const,
};

section('[1] raw conditioning becomes a canonical component');
{
  const source = workout('Upper Push', [
    row('Bench Press', 0),
    row('Bike Zone 2 - 15 min', 1, { prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1 }),
  ]);
  const result = finaliseWorkoutAfterMutation(source, { phase: 'Pre-season' });
  const rows = getSessionComponentRows(result.workout);
  ok('raw Bike Zone 2 is promoted out of strength rows',
    rows.conditioningRows.length === 1 && rows.strengthRows.length === 1, rows);
  eq('strength plus promoted conditioning becomes Mixed', result.workout.workoutType, 'Mixed' as any);
  ok('weekly identity exposes aerobic conditioning',
    combinedConditioningCategoryLabel(result.workout) === 'Aerobic Base');
  ok('promoted conditioning has no kilogram prescription',
    rows.conditioningRows.every((item) => !item.prescribedWeightKg));
  ok('diagnostics explain the promotion', result.actions.some((action) =>
    action.kind === 'row_promoted' && action.reason === 'promoted_to_typed_conditioning'));
}

section('[2] early off-season rejects hard/raw power and downgrades erg intervals');
{
  const result = finaliseWorkoutAfterMutation(workout('Full Body', [
    row('Romanian Deadlift', 0),
    row('Pull-Ups', 1),
    row('Broad Jump', 2, { pairType: 'contrast', supersetGroup: 'A' }),
    row('Explosive Push-Ups', 3),
    row('Rower Intervals', 4),
  ], { powerBlock: power('contrast', 'lower') }), EARLY);
  const names = result.workout.exercises.map((item) => item.exercise?.name ?? '');
  ok('raw Broad Jump and Explosive Push-Ups are removed',
    !names.some((name) => /broad jump|explosive push/i.test(name)), names);
  ok('early powerBlock and contrast are removed',
    !result.workout.powerBlock && result.workout.exercises.every((item) => item.pairType !== 'contrast'));
  ok('Rower Intervals becomes easy intervalised RowErg work',
    names.some((name) => /Easy RowErg Aerobic Blocks/i.test(name)) &&
      result.workout.conditioningBlock?.intent === 'aerobic');
  const conditioning = getSessionComponentRows(result.workout).conditioningRows[0];
  ok('early RowErg uses 3 x 8min and complete rest',
    conditioning?.prescribedSets === 3 && conditioning.prescribedRepsMax === 8 &&
      conditioning.restSeconds === 120 && /complete rest/i.test(conditioning.notes ?? ''), conditioning);
}

section('[3] typed power remains bounded by subphase and final strength content');
{
  const heavySquat = row('Back Squat', 0, {
    prescribedRepsMin: 3,
    prescribedRepsMax: 5,
    prescribedWeightKg: 100,
  });
  const mid = finaliseWorkoutAfterMutation(
    workout('Lower Squat', [heavySquat], { powerBlock: power('contrast', 'lower') }),
    { phase: 'Off-season', offseasonSubphase: 'mid_offseason', readiness: 'high' },
  );
  ok('mid off-season keeps valid power only as primer',
    mid.workout.powerBlock?.kind === 'primer' && mid.workout.powerBlock.title === 'Power Primer');

  const late = finaliseWorkoutAfterMutation(
    workout('Lower Squat', [heavySquat], { powerBlock: power('contrast', 'lower') }),
    { phase: 'Off-season', offseasonSubphase: 'late_offseason', readiness: 'high' },
  );
  ok('late off-season keeps contrast with heavy same-family main lift',
    late.workout.powerBlock?.kind === 'contrast');

  const removedLift = finaliseWorkoutAfterMutation(
    workout('Lower Squat', [row('Pallof Press', 0)], { powerBlock: power('contrast', 'lower') }),
    { phase: 'Off-season', offseasonSubphase: 'late_offseason', readiness: 'high' },
  );
  ok('removing final same-family lift removes stale contrast power', !removedLift.workout.powerBlock);

  const gameProtected = finaliseWorkoutAfterMutation(
    workout('Lower Squat', [heavySquat], { powerBlock: power('primer', 'lower') }),
    {
      phase: 'In-season', readiness: 'high', hasGame: true, gOffset: -1,
      profile: { experienceLevel: '5+ years' } as any,
    },
  );
  ok('typed power cannot survive the canonical G-1 safety gate',
    !gameProtected.workout.powerBlock && gameProtected.actions.some((action) =>
      action.reason === 'game_proximity_power_blocked:G-1'));
}

section('[4] trunk/support never creates fake conditioning identity');
{
  const result = finaliseWorkoutAfterMutation(workout('Trunk Support', [
    row('Pallof Press', 0),
    row('Side Plank', 1),
  ]), { phase: 'Pre-season' });
  const rows = getSessionComponentRows(result.workout);
  ok('Pallof and Side Plank remain visible support rows', rows.supportRows.length === 2, rows);
  ok('support-only work creates no conditioning component',
    rows.conditioningRows.length === 0 &&
      !getSessionComponents(result.workout).some((component) => component.kind === 'conditioning'));
  ok('support-only work is not Mixed or Conditioning',
    result.workout.workoutType !== 'Mixed' && result.workout.workoutType !== 'Conditioning');
}

section('[5] final components own type and modality-honest title');
{
  const bike = row('Bike Tempo', 1, { prescribedWeightKg: 75 });
  const source = workout('Tempo Running', [row('Bench Press', 0), bike], {
    workoutType: 'Mixed',
    hasCombinedConditioning: true,
    conditioningFlavour: 'tempo',
    conditioningCategory: 'tempo',
    conditioningBlock: {
      intent: 'tempo',
      options: [{ title: 'Tempo Running', description: '', exerciseIds: [bike.id] }],
    },
  });
  const withoutStrength = finaliseWorkoutAfterMutation({
    ...source,
    exercises: [bike],
  }, { phase: 'Pre-season' });
  eq('removing all strength rows makes the session Conditioning',
    withoutStrength.workout.workoutType, 'Conditioning' as any);
  ok('remaining conditioning stays visible and load-free',
    getSessionComponentRows(withoutStrength.workout).conditioningRows.length === 1 &&
      !getSessionComponentRows(withoutStrength.workout).conditioningRows[0].prescribedWeightKg);
  eq('stale Tempo Running name becomes actual Bike Tempo', withoutStrength.workout.name, 'Bike Tempo');
}

section('[6] deterministic plan intent rejects main drift but permits minor balance');
{
  const reference = workout('Full Body Strength', [
    row('Romanian Deadlift', 0),
    row('Pull-Ups', 1),
  ], {
    planEntryId: 'w1:monday:hinge-pull:strength',
    strengthPatternContributions: ['hinge', 'pull'],
  });
  const drifted = finaliseWorkoutAfterMutation(workout('Full Body Strength', [
    row('Bench Press', 0),
    row('Pull-Ups', 1),
  ], {
    planEntryId: reference.planEntryId,
    strengthPatternContributions: ['hinge', 'pull'],
  }), {
    ...EARLY,
    planIntentValid: true,
    referenceWorkout: reference,
  });
  const driftedNames = drifted.workout.exercises.map((item) => item.exercise?.name ?? '');
  ok('Bench Press main drift is rejected', !driftedNames.includes('Bench Press'), driftedNames);
  ok('missing hinge is restored from allocated reference',
    driftedNames.includes('Romanian Deadlift') && driftedNames.includes('Pull-Ups'), driftedNames);
  eq('hinge + pull contribution remains authoritative',
    drifted.workout.strengthPatternContributions, ['hinge', 'pull']);

  const push = finaliseWorkoutAfterMutation(workout('Upper Push', [
    row('Bench Press', 0),
    row('Incline DB Press', 1),
    row('Chest Supported Row', 2, {
      prescribedSets: 2,
      prescribedRepsMin: 10,
      prescribedRepsMax: 12,
    }),
  ], {
    planEntryId: 'w1:wednesday:push:strength',
    strengthPatternContributions: ['push'],
  }), { phase: 'Pre-season', planIntentValid: true });
  ok('minor balancing row remains on Upper Push day',
    push.workout.exercises.some((item) => /Chest Supported Row/i.test(item.exercise?.name ?? '')));
  eq('minor pull accessory does not rename Upper Push', push.workout.name, 'Upper Push');
}

section('[7] stable plan identity moves with the workout, never the weekday');
{
  const planned = workout('Upper Push', [row('Bench Press', 0)], {
    dayOfWeek: 1,
    planEntryId: 'w1:monday:push:strength',
    strengthPatternContributions: ['push'],
  });
  const moved = finaliseWorkoutAfterMutation({ ...planned, dayOfWeek: 4 }, {
    phase: 'Pre-season',
    planIntentValid: true,
    referenceWorkout: planned,
  });
  eq('move preserves original planEntryId', moved.workout.planEntryId, planned.planEntryId);
  eq('move preserves original strength contribution', moved.workout.strengthPatternContributions, ['push']);

  const stale = finaliseWorkoutAfterMutation({
    ...planned,
    planEntryId: 'missing-plan-entry',
  }, { phase: 'Pre-season', planIntentValid: false });
  ok('stale plan identity is cleared rather than weekday-remapped',
    !stale.workout.planEntryId);
  eq('stale legacy workout is re-owned once from meaningful content',
    stale.workout.strengthIntent?.effectivePatterns, ['push']);
  ok('stale-plan diagnostic is explicit', stale.actions.some((action) =>
    action.reason === 'plan_entry_absent_or_stale'));
}

section('[8] generation, workout write, microcycle write and program write converge');
{
  const malformed = workout('Tempo Running', [
    row('Bench Press', 0),
    row('Bike Zone 2 - 15 min', 1),
    row('Broad Jump', 2),
    row('Pallof Press', 3),
  ], {
    planEntryId: 'w1:monday:push:strength',
    strengthPatternContributions: ['push'],
  });
  const context = { ...EARLY, planIntentValid: true };
  const direct = finaliseWorkoutAfterMutation(malformed, context).workout;
  const single = validateWorkoutAgainstActiveConstraints({
    workout: malformed,
    date: '2099-01-05',
    todayISO: '2099-01-01',
    activeConstraints: [],
    canonicalContext: context,
  }).workout!;
  const microcycle: Microcycle = {
    id: 'mc', programId: 'program', weekNumber: 1,
    startDate: '2099-01-05T12:00:00.000Z', endDate: '2099-01-11T12:00:00.000Z',
    miniCycleNumber: 1, weekKind: 'build', intensityMultiplier: 1,
    workouts: [malformed], createdAt: '', updatedAt: '',
  };
  const fromMicrocycle = validateMicrocycleAgainstActiveConstraints({
    microcycle,
    todayISO: '2099-01-01',
    activeConstraints: [],
    profile: { seasonPhase: 'Off-season' } as any,
    canonicalContext: context,
  }).workouts[0];
  const program: TrainingProgram = {
    id: 'program', userId: 'user', name: 'Program', description: '',
    programPhase: 'Off-Season-Base', startDate: microcycle.startDate,
    endDate: microcycle.endDate, primaryFocus: '', isActive: true,
    microcycles: [microcycle], createdAt: '', updatedAt: '',
  };
  const fromProgram = validateProgramAgainstActiveConstraints({
    program,
    todayISO: '2099-01-01',
    activeConstraints: [],
    profile: { seasonPhase: 'Off-season' } as any,
  }).microcycles[0].workouts[0];
  const shape = (value: Workout) => ({
    name: value.name,
    type: value.workoutType,
    planEntryId: value.planEntryId,
    patterns: value.strengthPatternContributions,
    rows: value.exercises.map((item) => ({
      name: item.exercise?.name,
      weight: item.prescribedWeightKg,
      component: value.conditioningBlock?.options.some((option) => option.exerciseIds.includes(item.id))
        ? 'conditioning'
        : 'training',
    })),
    power: value.powerBlock?.kind ?? null,
  });
  eq('direct generation and single edit finalisation agree', shape(single), shape(direct));
  eq('microcycle/rebuild write finalisation agrees', shape(fromMicrocycle), shape(direct));
  eq('program/regeneration write finalisation agrees', shape(fromProgram), shape(direct));
}

section('[9] explicit Rest keeps plan identity without restoring removed training');
{
  const rest = finaliseWorkoutAfterMutation(workout('Rest', [], {
    workoutType: 'Rest' as any,
    sessionTier: 'recovery',
    planEntryId: 'w1:monday:hinge:strength',
    strengthPatternContributions: ['hinge'],
  }), {
    phase: 'Pre-season',
    planIntentValid: true,
    referenceWorkout: workout('Lower Hinge', [row('Romanian Deadlift', 0)]),
  });
  eq('Rest retains the allocated identity used by edit/rebuild ownership',
    rest.workout.planEntryId, 'w1:monday:hinge:strength');
  ok('Rest clears pattern credit and never resurrects its planned lift',
    !rest.workout.strengthPatternContributions?.length && rest.workout.exercises.length === 0);
}

console.log(`\nworkoutCanonicalisationTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
