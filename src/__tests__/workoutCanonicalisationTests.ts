/**
 * Shared post-generation / post-mutation canonicalisation invariants.
 * Run: npx sucrase-node src/__tests__/workoutCanonicalisationTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import type { Microcycle, TrainingProgram, Workout, WorkoutExercise } from '../types/domain';
import {
  canonicalContextSubphase,
  finaliseWorkoutAfterMutation,
} from '../utils/workoutCanonicalisation';
import * as validationBoundary from '../utils/postGenerationConstraintValidation';
import { getSessionComponentRows, getSessionComponents } from '../utils/sessionComponents';
import { combinedConditioningCategoryLabel } from '../utils/weeklyPlanDisplay';
import { powerRows } from '../rules/sessionRowCounting';

let pass = 0;
let fail = 0;
const failures: string[] = [];
/** True when `run` throws — used to pin the invariant throws. */
function threw(run: () => unknown): boolean {
  try { run(); return false; } catch { return true; }
}
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

/** A power ROW — power's home since 2026-07-28. */
function power(kind: 'primer' | 'contrast', family: 'lower' | 'upper'): WorkoutExercise {
  const name = family === 'lower' ? 'Broad Jump' : 'Explosive Push-Up';
  return {
    ...row(name, -1),
    id: `power-${kind}-${family}`,
    exerciseOrder: 0,
    prescribedSets: 3,
    prescribedRepsMin: 3,
    prescribedRepsMax: 3,
    prescribedWeightKg: undefined,
    notes: kind === 'contrast'
      ? 'Do this fresh, early in the session — before the main lifts. Contrast: pair with the heavy lift.'
      : 'Do this fresh, early in the session — before the main lifts.',
    role: 'power',
    power: { family, kind },
    section18Evidence: {
      protocolVersion: 1,
      role: 'power',
      strengthPattern: null,
      mainStrengthPattern: null,
      provenance: 'canonical_row_classifier',
    },
  };
}

const EARLY = {
  phase: 'Off-season' as const,
  offseasonSubphase: 'early_offseason' as const,
  weekKind: 'build' as const,
};

section('[1] raw conditioning becomes a canonical component');
{
  const source = workout('Upper Push', [
    row('Bench Press', 0),
    row('Bike Zone 2 - 15 min', 1, { prescribedSets: 1, prescribedRepsMin: 1, prescribedRepsMax: 1 }),
  ]);
  const result = finaliseWorkoutAfterMutation(source, { offseasonSubphase: 'not_off_season', phase: 'Pre-season' });
  const rows = getSessionComponentRows(result.workout);
  ok('raw Bike Zone 2 is promoted out of strength rows',
    rows.conditioningRows.length === 1 && rows.strengthRows.length === 1, rows);
  eq('strength plus promoted conditioning becomes Mixed', result.workout.workoutType, 'Mixed' as any);
  ok('weekly identity exposes aerobic conditioning',
    combinedConditioningCategoryLabel(result.workout) === 'Continuous Aerobic');
  ok('promoted conditioning has no kilogram prescription',
    rows.conditioningRows.every((item) => !item.prescribedWeightKg));
  ok('diagnostics explain the promotion', result.actions.some((action) =>
    action.kind === 'row_promoted' && action.reason === 'promoted_to_typed_conditioning'));
}

section('[2] early off-season rejects hard/raw power and downgrades erg intervals');
{
  const result = finaliseWorkoutAfterMutation(workout('Full Body', [power('contrast', 'lower'), 
    row('Romanian Deadlift', 0),
    row('Pull-Ups', 1),
    row('Broad Jump', 2, { pairType: 'contrast', supersetGroup: 'A' }),
    row('Explosive Push-Ups', 3),
    row('Rower Intervals', 4),
  ]), EARLY);
  const names = result.workout.exercises.map((item) => item.exercise?.name ?? '');
  ok('raw Broad Jump and Explosive Push-Ups are removed',
    !names.some((name) => /broad jump|explosive push/i.test(name)), names);
  ok('early power row and contrast are removed',
    powerRows(result.workout).length === 0 &&
      result.workout.exercises.every((item) => item.pairType !== 'contrast'));
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
    workout('Lower Squat', [power('contrast', 'lower'), heavySquat]),
    { phase: 'Off-season', offseasonSubphase: 'mid_offseason' },
  );
  ok('mid off-season removes power during preparation',
    powerRows(mid.workout).length === 0);

  const late = finaliseWorkoutAfterMutation(
    workout('Lower Squat', [power('contrast', 'lower'), heavySquat]),
    { phase: 'Off-season', offseasonSubphase: 'late_offseason' },
  );
  ok('late off-season keeps contrast with heavy same-family main lift',
    powerRows(late.workout)[0]?.power?.kind === 'contrast');

  const removedLift = finaliseWorkoutAfterMutation(
    workout('Lower Squat', [power('contrast', 'lower'), row('Pallof Press', 0)]),
    { phase: 'Off-season', offseasonSubphase: 'late_offseason' },
  );
  ok('removing final same-family lift removes stale contrast power',
    powerRows(removedLift.workout).length === 0);

  const gameProtected = finaliseWorkoutAfterMutation(
    workout('Lower Squat', [power('primer', 'lower'), heavySquat]),
    {
      offseasonSubphase: 'not_off_season',
      phase: 'In-season', hasGame: true, gOffset: -1,
      profile: { experienceLevel: '5+ years' } as any,
    },
  );
  ok('typed power cannot survive the canonical G-1 safety gate',
    powerRows(gameProtected.workout).length === 0 && gameProtected.actions.some((action) =>
      action.reason === 'game_proximity_power_blocked:G-1'));
}

section('[4] trunk/support never creates fake conditioning identity');
{
  const result = finaliseWorkoutAfterMutation(workout('Trunk Support', [
    row('Pallof Press', 0),
    row('Side Plank', 1),
  ]), { offseasonSubphase: 'not_off_season', phase: 'Pre-season' });
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
  }, { offseasonSubphase: 'not_off_season', phase: 'Pre-season' });
  eq('removing all strength rows makes the session Conditioning',
    withoutStrength.workout.workoutType, 'Conditioning' as any);
  ok('remaining conditioning stays visible and load-free',
    getSessionComponentRows(withoutStrength.workout).conditioningRows.length === 1 &&
      !getSessionComponentRows(withoutStrength.workout).conditioningRows[0].prescribedWeightKg);
  eq('stale Tempo Running name becomes structure-based tempo identity', withoutStrength.workout.name, 'Tempo Intervals');
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
    offseasonSubphase: 'not_off_season',
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

  // THE MINOR ROW HAS TO BE MINOR BY IDENTITY, not by dose. This cell used to
  // use 'Chest Supported Row' at 2×10-12 and had been red since Sam's deload
  // law landed (2026-07-27), which is written at the classifier's own site: "A
  // ROW'S MAIN-LIFT IDENTITY IS NOT ITS DOSE ... `RDLs` is an anchor lift
  // whether it is prescribed for five sets or one." Chest Supported Row is a
  // registry ANCHOR, so trimming its sets never made it an accessory, and the
  // drift guard was right to remove it. The fixture was asserting the rule the
  // law replaced. 'Face Pull' is a registry pull ACCESSORY — a minor balancing
  // row by identity — so the cell now exercises the exemption it is named for.
  const push = finaliseWorkoutAfterMutation(workout('Upper Push', [
    row('Bench Press', 0),
    row('Incline DB Press', 1),
    row('Face Pull', 2, {
      prescribedSets: 2,
      prescribedRepsMin: 10,
      prescribedRepsMax: 12,
    }),
  ], {
    planEntryId: 'w1:wednesday:push:strength',
    strengthPatternContributions: ['push'],
  }), { offseasonSubphase: 'not_off_season', phase: 'Pre-season', planIntentValid: true });
  ok('minor balancing row remains on Upper Push day',
    push.workout.exercises.some((item) => /Face Pull/i.test(item.exercise?.name ?? '')),
    push.workout.exercises.map((item) => item.exercise?.name ?? '').join(', '));
  eq('minor pull accessory does not rename Upper Push', push.workout.name, 'Upper Push');

  // THE OTHER HALF OF THE RULE, so the exemption cannot widen unnoticed: an
  // ANCHOR of the wrong pattern is still main drift and still goes, at any
  // dose. Without this, softening `isMinorCrossPatternAccessory` would pass.
  const pushWithAnchorDrift = finaliseWorkoutAfterMutation(workout('Upper Push', [
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
  }), { offseasonSubphase: 'not_off_season', phase: 'Pre-season', planIntentValid: true });
  ok('a trimmed pull ANCHOR on a push day is still main drift',
    !pushWithAnchorDrift.workout.exercises.some(
      (item) => /Chest Supported Row/i.test(item.exercise?.name ?? '')),
    pushWithAnchorDrift.workout.exercises.map((item) => item.exercise?.name ?? '').join(', '));
}

section('[7] stable plan identity moves with the workout, never the weekday');
{
  const planned = workout('Upper Push', [row('Bench Press', 0)], {
    dayOfWeek: 1,
    planEntryId: 'w1:monday:push:strength',
    strengthPatternContributions: ['push'],
  });
  const moved = finaliseWorkoutAfterMutation({ ...planned, dayOfWeek: 4 }, {
    offseasonSubphase: 'not_off_season',
    phase: 'Pre-season',
    planIntentValid: true,
    referenceWorkout: planned,
  });
  eq('move preserves original planEntryId', moved.workout.planEntryId, planned.planEntryId);
  eq('move preserves original strength contribution', moved.workout.strengthPatternContributions, ['push']);

  const stale = finaliseWorkoutAfterMutation({
    ...planned,
    planEntryId: 'missing-plan-entry',
  }, { offseasonSubphase: 'not_off_season', phase: 'Pre-season', planIntentValid: false });
  ok('stale plan identity is cleared rather than weekday-remapped',
    !stale.workout.planEntryId);
  eq('stale legacy workout is re-owned once from meaningful content',
    stale.workout.strengthIntent?.effectivePatterns, ['push']);
  ok('stale-plan diagnostic is explicit', stale.actions.some((action) =>
    action.reason === 'plan_entry_absent_or_stale'));
}

section('[8] validation cannot become a second canonicalisation author');
{
  // The old cell required three retired store-write repair functions to rewrite
  // malformed output. Current live/restart equivalence is exercised through
  // the canonical compiler by canonicalWeeklyCompilerSliceTests.
  for (const name of ['validateMicrocycleAgainstActiveConstraints',
    'validateProgramAgainstActiveConstraints', 'validateWorkoutAgainstActiveConstraints']) {
    ok(`retired procedural writer ${name} is absent`, !(name in validationBoundary));
  }
}

section('[9] explicit Rest keeps plan identity without restoring removed training');
{
  const rest = finaliseWorkoutAfterMutation(workout('Rest', [], {
    workoutType: 'Rest' as any,
    sessionTier: 'recovery',
    planEntryId: 'w1:monday:hinge:strength',
    strengthPatternContributions: ['hinge'],
  }), {
    offseasonSubphase: 'not_off_season',
    phase: 'Pre-season',
    planIntentValid: true,
    referenceWorkout: workout('Lower Hinge', [row('Romanian Deadlift', 0)]),
  });
  eq('Rest retains the allocated identity used by edit/rebuild ownership',
    rest.workout.planEntryId, 'w1:monday:hinge:strength');
  ok('Rest clears pattern credit and never resurrects its planned lift',
      !rest.workout.strengthPatternContributions?.length && rest.workout.exercises.length === 0);
}

section('[10] support copy cannot erase authoritative strength ownership');
{
  const typedPush = finaliseWorkoutAfterMutation(workout('Prehab and mobility', [
    row('Bench Press', 0),
  ], {
    strengthIntent: {
      archetype: 'upper', primaryPattern: 'push',
      plannedPatterns: ['push'], effectivePatterns: ['push'],
    },
    strengthPatternContributions: ['push'],
  }), { offseasonSubphase: 'not_off_season', phase: 'Pre-season' });
  ok('support-like name cannot clear typed push intent or its real main row',
    typedPush.workout.strengthIntent?.effectivePatterns.includes('push') === true &&
    typedPush.workout.exercises.some((item) => item.exercise?.name === 'Bench Press'),
    typedPush.workout);
}

section('[11] the off-season subphase is carried, never guessed');
{
  // `updatePowerForPhase` used to read a MISSING subphase as `early_offseason`.
  // The guess had six consumers, not one: it deleted the power block, forced
  // conditioning intent to aerobic, forced `conditioningCategory` to
  // aerobic_base, stripped hard-conditioning and running rows, rewrote the
  // conditioning block's title, and widened restored-lift reps to 8-12. Five
  // production builders were not carrying the fact, so any off-season week that
  // reached one of them was silently treated as early off-season.
  //
  // The field is now REQUIRED on the context, which is what puts the question
  // to every builder at compile time. These tests pin the runtime half: the
  // helper refuses rather than defaults, and it refuses in the one direction
  // that matters.
  ok(
    'a non-off-season phase resolves without needing a subphase',
    canonicalContextSubphase('Pre-season', null) === 'not_off_season' &&
      canonicalContextSubphase('In-season', null) === 'not_off_season' &&
      canonicalContextSubphase(undefined, null) === 'not_off_season',
  );
  ok(
    'a resolved off-season subphase passes through unchanged',
    canonicalContextSubphase('Off-season', 'late_offseason') === 'late_offseason' &&
      canonicalContextSubphase('Off-season', 'early_offseason') === 'early_offseason',
  );
  ok(
    'an Off-season context with no resolved subphase THROWS rather than guessing',
    threw(() => canonicalContextSubphase('Off-season', null)),
  );

  // LEGACY PRE-CLOCK PROGRAMS CANNOT REACH THE THROW.
  //
  // Hydration passes `currentProgram.seasonPhaseClock?.selectedPhase ??
  // currentProgram.programPhase`. A program persisted before the phase clock
  // shipped has no clock, so the value is a `programPhase`, and NONE of its
  // three spellings canonicalises to 'Off-season' through the phase regex in
  // `canonicaliseHydratedWorkout`. 'Base-Building' is the off-season one, and
  // it lands on 'In-season' — the /in/i probe matches the "in" inside
  // "Building" before any off-season test is reached. That is an accident of
  // the regex rather than a designed mapping, which is precisely why it is
  // worth pinning: the legacy path's safety here is incidental, not intended.
  //
  // If a future edit tightens that regex — or teaches it to map 'Base-Building'
  // onto Off-season, which is what it arguably MEANS — this test fails and the
  // author has to supply the subphase in the same change. That coupling is the
  // point; without it, tightening the regex would silently route legacy
  // programs into the throw.
  const legacyPhases = ['Base-Building', 'In-Season', 'Pre-Season-Skills'];
  ok(
    'no legacy programPhase spelling reaches the Off-season throw',
    legacyPhases.every((phase) => {
      const canonical = /pre/i.test(phase)
        ? 'Pre-season'
        : /off/i.test(phase)
          ? 'Off-season'
          : /in/i.test(phase)
            ? 'In-season'
            : undefined;
      return !threw(() => canonicalContextSubphase(canonical as never, null));
    }),
    legacyPhases,
  );

  // And the contradiction the reader itself guards: a context that states
  // Off-season while claiming there is no subphase is a lie, not a blank.
  ok(
    'an Off-season context claiming not_off_season THROWS at the reader',
    threw(() => finaliseWorkoutAfterMutation(
      workout('Lower Squat', [power('primer', 'lower'), row('Back Squat', 0)]),
      { phase: 'Off-season', offseasonSubphase: 'not_off_season' },
    )),
  );
}

console.log(`\nworkoutCanonicalisationTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
