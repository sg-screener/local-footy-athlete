/**
 * Session naming regressions.
 *
 * Run: npm run test:session-naming
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import {
  buildCoachingPlan,
  type CoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  inferMeaningfulExerciseMovementPatterns,
  inferStrengthMovementPatterns,
  movementPatternsFromStrengthPattern,
  resolveSessionDisplayName,
} from '../utils/sessionNaming';
import {
  combinedConditioningCategoryLabel,
  weeklyPlanTitle,
} from '../utils/weeklyPlanDisplay';
import { createStrengthIntent } from '../rules/strengthPatternContributions';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function notEq<T>(name: string, actual: T, unexpected: T) {
  ok(
    name,
    JSON.stringify(actual) !== JSON.stringify(unexpected),
    `did not expect ${JSON.stringify(unexpected)}`,
  );
}

function section(label: string) {
  console.log(`\n${label}`);
}

const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const lowerHingeWithFinisher =
  'Hip-dominant lower (RDL, hip thrust; optional hamstring accessory: nordic lower) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const lowerSquatWithFinisher =
  'Lower body - squat emphasis (quad-dominant: squat, lunge, leg press; optional quad accessory: leg extension) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const upperPushWithFinisher =
  'Upper body - push emphasis (bench, OHP, dips) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const upperPullWithFinisher =
  'Upper body - pull emphasis (rows, pull-ups, face pulls) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const fullBodyWithFinisher =
  'Full body - moderate load, cover all movement patterns (1 squat/hinge + 1 push + 1 pull) + easy off-feet aerobic finisher (bike/row/ski, 15-20min)';
const conditioningOnly =
  'easy off-feet aerobic finisher (bike/row/ski/erg, 15-20min)';

function display(input: Parameters<typeof resolveSessionDisplayName>[0]): string {
  return resolveSessionDisplayName({
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    ...input,
  });
}

function offSeasonFourDayInputs(): CoachingInputs {
  return {
    seasonPhase: 'Off-season',
    availableDays: 4,
    selectedDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: undefined,
    sprintExposure: 'Moderate',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
    goals: ['Get stronger'],
    hasGame: false,
    gameDay: undefined,
  };
}

function displayLabelForAllocation(session: SessionAllocation): string {
  return resolveSessionDisplayName({
    focus: session.focus,
    strengthPattern: session.strengthPattern,
    strengthIntent: session.strengthIntent,
    isTeamDay: session.isTeamDay,
    conditioningFlavour: session.conditioningFlavour,
    hasCombinedConditioning: session.hasCombinedConditioning,
    tier: session.tier,
  });
}

section('[1] Strength naming ignores conditioning finisher text');

eq(
  'typed lower hinge + bike/row/ski finisher stays Lower Hinge',
  display({ focus: lowerHingeWithFinisher, strengthPattern: 'lower' }),
  'Lower Hinge',
);
eq(
  'legacy lower hinge + bike/row/ski finisher does not become full body',
  display({ focus: lowerHingeWithFinisher }),
  'Lower Hinge',
);
eq(
  'typed lower squat + bike/row/ski finisher stays Lower Squat',
  display({ focus: lowerSquatWithFinisher, strengthPattern: 'lower' }),
  'Lower Squat',
);
eq(
  'legacy lower squat + bike/row/ski finisher does not become full body',
  display({ focus: lowerSquatWithFinisher }),
  'Lower Squat',
);
eq(
  'upper push + bike/row/ski finisher stays Upper Push',
  display({ focus: upperPushWithFinisher, strengthPattern: 'push' }),
  'Upper Push',
);
eq(
  'legacy upper push + bike/row/ski finisher stays Upper Push',
  display({ focus: upperPushWithFinisher }),
  'Upper Push',
);
eq(
  'upper pull + bike/row/ski finisher stays Upper Pull',
  display({ focus: upperPullWithFinisher, strengthPattern: 'pull' }),
  'Upper Pull',
);
eq(
  'legacy upper pull + bike/row/ski finisher stays Upper Pull',
  display({ focus: upperPullWithFinisher }),
  'Upper Pull',
);
eq(
  'ambiguous legacy full-body metadata does not invent four pattern credits',
  display({ focus: fullBodyWithFinisher, strengthPattern: 'full_body' }),
  'Full body',
);
eq(
  'typed full body displays Full Body Strength',
  display({
    focus: fullBodyWithFinisher,
    strengthPattern: 'full_body',
    strengthIntent: createStrengthIntent({
      archetype: 'full_body',
      primaryPattern: 'squat',
      plannedPatterns: ['squat', 'push', 'pull'],
    }),
  }),
  'Full Body Strength',
);
eq(
  'conditioning-only text does not create movement patterns',
  inferStrengthMovementPatterns(conditioningOnly),
  [],
);
notEq(
  'conditioning-only display does not create fake full-body strength',
  resolveSessionDisplayName({ focus: conditioningOnly }),
  'Full Body Strength',
);
notEq(
  'conditioning-only display does not create fake upper pull',
  resolveSessionDisplayName({ focus: conditioningOnly }),
  'Upper Pull',
);
eq(
  'typed lower metadata never imports pull from row finisher',
  movementPatternsFromStrengthPattern('lower', lowerHingeWithFinisher),
  ['hinge'],
);
eq(
  'lower squat + hinge text keeps both strength patterns before conditioning',
  inferStrengthMovementPatterns(
    'Lower body strength (squat + hinge) + easy aerobic finisher (bike/row/ski)',
  ),
  ['squat', 'hinge'],
);
eq(
  'upper push + pull text keeps both strength patterns before conditioning',
  inferStrengthMovementPatterns(
    'Upper body strength (push + pull) + easy aerobic finisher (bike/row/ski)',
  ),
  ['push', 'pull'],
);

section('[2] Final visible strength content refines generic display identity');

const lowerMixedExercises = [
  { name: 'Box Squat' },
  { name: 'Hip Thrusts' },
  { name: 'Nordic Lowers' },
  { name: 'Copenhagen Plank' },
  { name: 'Tib Raises' },
];

eq(
  'meaningful exercise inference sees the squat and hip-extension anchors only',
  inferMeaningfulExerciseMovementPatterns(lowerMixedExercises),
  ['squat', 'hinge'],
);
eq(
  'generic lower with squat + hinge displays Lower Body Strength',
  resolveSessionDisplayName({
    name: 'Lower Strength',
    exercises: lowerMixedExercises,
  }),
  'Lower Body Strength',
);
eq(
  'pure squat-dominant lower remains Lower Squat',
  resolveSessionDisplayName({
    name: 'Lower Strength',
    strengthPattern: 'lower',
    exercises: [{ name: 'Box Squat' }, { name: 'Leg Press' }, { name: 'Tib Raises' }],
  }),
  'Lower Squat',
);
eq(
  'pure hinge-dominant lower remains Lower Hinge',
  resolveSessionDisplayName({
    name: 'Lower Strength',
    strengthPattern: 'lower',
    exercises: [{ name: 'Romanian Deadlift' }, { name: 'Hip Thrust' }, { name: 'Nordic Lower' }],
  }),
  'Lower Hinge',
);
eq(
  'typed full-body intent remains Full Body Strength',
  resolveSessionDisplayName({
    name: 'Full Body',
    strengthPattern: 'full_body',
    strengthIntent: createStrengthIntent({
      archetype: 'full_body',
      primaryPattern: 'squat',
      plannedPatterns: ['squat', 'push', 'pull'],
    }),
    exercises: [{ name: 'Box Squat' }, { name: 'Bench Press' }],
  }),
  'Full Body Strength',
);
eq(
  'upper push plus support-only Face Pull remains Upper Push',
  resolveSessionDisplayName({
    name: 'Upper Strength',
    strengthPattern: 'push',
    exercises: [{ name: 'Bench Press' }, { name: 'Shoulder Press' }, { name: 'Face Pull' }],
  }),
  'Upper Push',
);
eq(
  'upper push plus attached easy row conditioning remains Upper Push',
  resolveSessionDisplayName({
    name: 'Upper Strength',
    strengthPattern: 'push',
    hasCombinedConditioning: true,
    conditioningFlavour: 'aerobic',
    exercises: [{ name: 'Bench Press' }, { name: 'Easy Zone 2 Row' }],
  }),
  'Upper Push',
);
eq(
  'pure upper pull remains Upper Pull',
  resolveSessionDisplayName({
    name: 'Upper Strength',
    strengthPattern: 'pull',
    exercises: [{ name: 'Cable Row' }, { name: 'Pull-Up' }],
  }),
  'Upper Pull',
);
eq(
  'generic upper with main push + pull anchors displays Upper Body Strength',
  resolveSessionDisplayName({
    name: 'Upper Strength',
    exercises: [{ name: 'Bench Press' }, { name: 'Cable Row' }],
  }),
  'Upper Body Strength',
);
eq(
  'Gunshow is not promoted to main upper strength',
  resolveSessionDisplayName({
    name: 'Gunshow',
    exercises: [{ name: 'Dumbbell Curl' }, { name: 'Triceps Pushdown' }],
  }),
  'Gunshow',
);
eq(
  'prehab identity is not promoted to main strength',
  resolveSessionDisplayName({
    name: 'Prehab & Accessories',
    exercises: [{ name: 'Face Pull' }, { name: 'Copenhagen Plank' }],
  }),
  'Prehab & Accessories',
);
eq(
  'recovery-tier identity remains recovery',
  resolveSessionDisplayName({
    name: 'Recovery Flow',
    tier: 'recovery',
    exercises: [{ name: 'Mobility Flow' }],
  }),
  'Recovery Flow',
);

section('[3] Early off-season 4-day display labels match structural plan');

{
  const plan = buildCoachingPlan(offSeasonFourDayInputs()).weeklyPlan;
  const labels = [...plan]
    .filter((session) => session.strengthPattern)
    .sort((a, b) => DAY_ORDER[a.dayOfWeek || ''] - DAY_ORDER[b.dayOfWeek || ''])
    .map(displayLabelForAllocation);

  eq(
    'S6 early off-season 4-day no-team-training display labels',
    labels,
    ['Full Body Strength', 'Upper Push', 'Lower Squat'],
  );

  const actualFullBodyCount = plan.filter((session) => session.strengthPattern === 'full_body').length;
  const displayedFullBodyCount = labels.filter((label) => label === 'Full Body Strength').length;
  eq(
    'S6 does not display full body unless the structural type is full_body',
    displayedFullBodyCount,
    actualFullBodyCount,
  );
}

section('[4] Program builder names engine-built sessions from typed metadata');

{
  const plan = buildCoachingPlan(offSeasonFourDayInputs()).weeklyPlan;
  const workouts = buildWorkoutsFromCoach([], 'mc-session-naming', plan);
  const labels = workouts
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((workout) => workout.name);
  const strengthLabels = workouts
    .filter((workout) => workout.strengthPatternContributions?.length)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((workout) => workout.name);

  eq(
    'Program-screen strength workout names for S6',
    strengthLabels,
    ['Full Body Strength', 'Upper Push', 'Lower Squat'],
  );
  ok(
    'Program-screen S6 keeps standalone aerobic support separate',
    workouts.some((workout) => workout.workoutType === 'Conditioning') &&
      labels.length === 4,
    labels.join(' | '),
  );
}

section('[5] Edge-normalised mixed session keeps one honest visible identity');

{
  const plan: SessionAllocation[] = [{
    dayOfWeek: 'Monday',
    tier: 'core',
    focus: 'Lower body strength (squat + hinge) + easy aerobic finisher (bike/row/ski)',
    isHardExposure: true,
    strengthPattern: 'lower',
    stressLevel: 'high',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'finisher',
    conditioningFlavour: 'aerobic',
    conditioningCategory: 'aerobic_base',
  }];
  const [workout] = buildWorkoutsFromCoach([{
    dayOfWeek: 1,
    name: 'Lower Strength',
    workoutType: 'Mixed',
    sessionTier: 'core',
    exercises: lowerMixedExercises.map((exercise) => ({
      ...exercise,
      sets: 3,
      repsMin: 5,
      repsMax: 8,
    })),
  }], 'mc-edge-lower-name', plan);
  const visibleStrengthNames = workout.exercises.map((row) => row.exercise?.name ?? '');

  eq(
    'edge Lower Strength with squat + hip thrust normalises to Lower Body Strength',
    workout.name,
    'Lower Body Strength',
  );
  eq('mixed workout type remains Mixed', workout.workoutType, 'Mixed');
  ok(
    'naming leaves the edge-provided squat, hinge and support content visible',
    ['Box Squat', 'Hip Thrusts', 'Nordic Lower', 'Copenhagen Plank', 'Tib Raises']
      .every((name) => visibleStrengthNames.includes(name)),
    visibleStrengthNames.join(' | '),
  );
  eq(
    'weekly card title agrees with the workout detail identity',
    weeklyPlanTitle(workout),
    workout.name,
  );
  eq(
    'attached conditioning stays a separate Aerobic Base subtitle',
    combinedConditioningCategoryLabel(workout),
    'Aerobic Base',
  );
}

console.log(`\nSession naming tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
