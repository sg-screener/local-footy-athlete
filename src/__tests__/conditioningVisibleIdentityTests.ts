(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { generateProgramLocally } from '../services/api/generateProgram';
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import {
  LONG_AEROBIC_INTERVAL_MIN_SECONDS,
  projectConditioningVisibleIdentity,
} from '../utils/conditioningVisibleIdentity';
import { getConditioningLoggingConfig } from '../utils/conditioningLogging';
import { buildRepeatWeekOverlay } from '../utils/repeatWeek';
import { extractVisibleProgramItemsFromWorkout } from '../utils/visibleProgramReadModel';
import { deriveVisibleWorkoutIdentity } from '../utils/visibleWorkoutIdentity';
import { weeklyPlanContextLabel, weeklyPlanTitle } from '../utils/weeklyPlanDisplay';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function eq(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
  }
}

function row(
  id: string,
  name: string,
  sets = 1,
  restSeconds = 0,
  prescription?: { type: WorkoutExercise['prescriptionType']; value: number },
): WorkoutExercise {
  return {
    id,
    workoutId: 'identity',
    exerciseId: id,
    exerciseOrder: Number(id.replace(/\D/g, '')) || 1,
    prescribedSets: sets,
    prescribedRepsMin: prescription?.value ?? 1,
    prescribedRepsMax: prescription?.value ?? 1,
    prescriptionType: prescription?.type,
    restSeconds,
    exercise: {
      id,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Cardio',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function workout(
  rows: WorkoutExercise[],
  overrides: Partial<Workout> = {},
): Workout {
  return {
    id: 'identity',
    microcycleId: 'identity-mc',
    dayOfWeek: 2,
    name: 'Generic template name',
    description: 'Generic focus copy',
    durationMinutes: 40,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    conditioningCategory: 'aerobic_base',
    conditioningFlavour: 'aerobic',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{ title: 'Generic template name', description: '', exerciseIds: rows.map((value) => value.id) }],
    },
    exercises: rows,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

console.log('conditioningVisibleIdentityTests');

console.log('\n[1] final meaningful work structure owns aerobic identity');
const continuous = workout([
  row('r1', 'Bike warm-up 5min'),
  row('r2', '40min steady Zone 2 Bike'),
  row('r3', 'Bike cool-down 5min'),
]);
eq('continuous family ignores warm-up/cool-down', projectConditioningVisibleIdentity(continuous)?.structureFamily, 'continuous_aerobic');
eq('continuous label', projectConditioningVisibleIdentity(continuous)?.primaryLabel, 'Continuous Aerobic');
eq('continuous dose', projectConditioningVisibleIdentity(continuous)?.doseLabel, '40 min steady');

const long = workout([
  row('r1', 'RowErg warm-up'),
  row('r2', '3 x 8min aerobic RowErg', 3, 120),
  row('r3', 'RowErg cool-down'),
]);
eq('long interval family', projectConditioningVisibleIdentity(long)?.structureFamily, 'long_aerobic_intervals');
eq('long interval dose', projectConditioningVisibleIdentity(long)?.doseLabel, '3 × 8 min');

const exactThreshold = workout([row('r1', '4 x 3min aerobic', 4, 60)]);
eq('three-minute threshold is central and inclusive', LONG_AEROBIC_INTERVAL_MIN_SECONDS, 180);
eq('three-minute intervals are long', projectConditioningVisibleIdentity(exactThreshold)?.primaryLabel, 'Long Aerobic Intervals');
const belowThreshold = workout([row('r1', '4 x 179sec aerobic', 4, 60)]);
eq('below-three-minute intervals are short', projectConditioningVisibleIdentity(belowThreshold)?.primaryLabel, 'Short Aerobic Intervals');

const typedContinuous = workout([
  row('r1', 'Cyclical aerobic work', 1, 0, { type: 'duration_minutes', value: 20 }),
]);
eq('typed duration produces continuous identity', projectConditioningVisibleIdentity(typedContinuous)?.primaryLabel, 'Continuous Aerobic');
eq('typed duration produces concise dose', projectConditioningVisibleIdentity(typedContinuous)?.doseLabel, '20 min steady');

console.log('\n[2] typed purpose and effective intensity outrank bout length');
for (const [category, intent, expected] of [
  ['tempo', 'tempo', 'Tempo Intervals'],
  ['vo2', 'high-intensity', 'Hard Intervals'],
  ['glycolytic', 'high-intensity', 'Hard Intervals'],
  ['sprint', 'high-intensity', 'Speed Conditioning'],
] as const) {
  const value = workout([row('r1', '5 x 2min Bike intervals', 5, 60)], {
    conditioningCategory: category,
    conditioningFlavour: intent,
    conditioningBlock: {
      intent,
      options: [{ title: 'Aerobic Base', description: '', exerciseIds: ['r1'] }],
    },
  });
  eq(`${category} typed purpose`, projectConditioningVisibleIdentity(value)?.primaryLabel, expected);
}
const untypedHard = workout([row('r1', '5 x 2min work', 5, 60)], {
  conditioningCategory: undefined,
  conditioningFlavour: undefined,
  conditioningBlock: { intent: 'aerobic', options: [{ title: 'work', description: '', exerciseIds: ['r1'] }] },
  intensity: 'High',
});
eq('typed aerobic intent prevents high scalar from changing purpose', projectConditioningVisibleIdentity(untypedHard)?.primaryLabel, 'Short Aerobic Intervals');
const staleWorkoutType = workout([row('r1', '40min steady aerobic work')], {
  workoutType: 'Flush-Out',
});
eq('stale workoutType cannot override typed aerobic purpose', projectConditioningVisibleIdentity(staleWorkoutType)?.primaryLabel, 'Continuous Aerobic');

console.log('\n[3] flush/recovery and honest fallback');
eq('explicit final flush purpose', projectConditioningVisibleIdentity(workout([row('r1', '20min Easy Aerobic Flush')]))?.primaryLabel, 'Aerobic Flush');
eq('explicit recovery purpose', projectConditioningVisibleIdentity(workout([row('r1', '20min recovery conditioning')], { workoutType: 'Recovery', sessionTier: 'recovery' }))?.primaryLabel, 'Recovery Conditioning');
eq('insufficient canonical structure fallback', projectConditioningVisibleIdentity(workout([row('r1', 'Easy cyclical conditioning')]))?.primaryLabel, 'Aerobic Conditioning');

console.log('\n[4] modality independence and intent honesty');
const modalityIdentities = ['Bike', 'RowErg', 'SkiErg', 'Bike + RowErg'].map((modality) =>
  projectConditioningVisibleIdentity(workout([row('r1', `3 x 8min aerobic ${modality}`, 3, 120)])),
);
eq('modality swap preserves families', modalityIdentities.map((value) => value?.structureFamily), [
  'long_aerobic_intervals', 'long_aerobic_intervals', 'long_aerobic_intervals', 'long_aerobic_intervals',
]);
eq('modality swap preserves doses', modalityIdentities.map((value) => value?.doseLabel), [
  '3 × 8 min', '3 × 8 min', '3 × 8 min', '3 × 8 min',
]);
const sameDoseAerobic = workout([row('r1', '5 x 2min aerobic Bike', 5, 60)]);
const sameDoseTempo = workout([row('r1', '5 x 2min aerobic Bike', 5, 60)], {
  conditioningCategory: 'tempo', conditioningFlavour: 'tempo',
  conditioningBlock: { intent: 'tempo', options: [{ title: 'same copy', description: '', exerciseIds: ['r1'] }] },
});
eq('intent-only change updates family', [
  projectConditioningVisibleIdentity(sameDoseAerobic)?.primaryLabel,
  projectConditioningVisibleIdentity(sameDoseTempo)?.primaryLabel,
], ['Short Aerobic Intervals', 'Tempo Intervals']);

console.log('\n[5] weekly, detail, logging and visible-item paths agree');
const attached = workout([row('r1', '3 x 8min zone 2 RowErg', 3, 120)], {
  name: 'Upper Push', workoutType: 'Mixed', hasCombinedConditioning: true,
  attachedConditioningKind: 'component',
  strengthIntent: { archetype: 'upper', primaryPattern: 'push', plannedPatterns: ['push'], effectivePatterns: ['push'] },
  conditioningBlock: { intent: 'aerobic', attachedKind: 'component', options: [{ title: 'RowErg aerobic', description: 'actual prescription', exerciseIds: ['r1'] }] },
});
eq('attached primary remains strength', weeklyPlanTitle(attached), 'Upper Push');
eq('attached secondary is shared family', weeklyPlanContextLabel(attached), 'Long Aerobic Intervals');
eq('visible item carries shared family without losing prescription title', {
  title: extractVisibleProgramItemsFromWorkout(attached as any).find((item) => item.domain === 'conditioning')?.title,
  structureLabel: extractVisibleProgramItemsFromWorkout(attached as any).find((item) => item.domain === 'conditioning')?.structureLabel,
}, { title: 'RowErg aerobic', structureLabel: 'Long Aerobic Intervals' });

const standaloneTempo = sameDoseTempo;
eq('standalone primary owns shared family', weeklyPlanTitle(standaloneTempo), 'Tempo Intervals');
eq('standalone weekly card omits dose', weeklyPlanContextLabel(standaloneTempo), null);
eq('canonical identity retains dose internally', projectConditioningVisibleIdentity(standaloneTempo)?.doseLabel, '5 × 2 min');
eq('detail identity agrees', deriveVisibleWorkoutIdentity(standaloneTempo), {
  title: 'Tempo Intervals', subtitle: '5 × 2 min', isConditioningOnly: true,
});
eq('logging headline agrees', getConditioningLoggingConfig(standaloneTempo).title, 'Tempo Intervals');

console.log('\n[6] persistence/repeat preserve derived identity without persisted display copy');
const hydrated = JSON.parse(JSON.stringify(standaloneTempo)) as Workout;
eq('JSON roundtrip family', projectConditioningVisibleIdentity(hydrated), projectConditioningVisibleIdentity(standaloneTempo));
const repeat = buildRepeatWeekOverlay({ sourceWorkouts: [standaloneTempo], targetWeekStart: '2026-08-10' });
const repeated = Object.values(repeat.workoutsByDate).find(Boolean) as Workout;
eq('Repeat Week family', weeklyPlanTitle(repeated), 'Tempo Intervals');
eq('Repeat Week weekly card omits dose', weeklyPlanContextLabel(repeated), null);
eq('Repeat Week detail identity retains dose', deriveVisibleWorkoutIdentity(repeated).subtitle, '5 × 2 min');

console.log('\n[7] exact four-week off-season visible regression');
const profile: OnboardingData = {
  firstName: 'ConditioningIdentityAudit',
  position: 'inside_mid',
  motivation: 'Build strength and fitness',
  goals: ['Build Strength', 'Improve Fitness'],
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 6,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  teamTrainingIntensity: 'Moderate',
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: 'Occasionally',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
};
const program = generateProgramLocally(profile, { todayISO: '2026-07-13' });
eq('four weeks generated', program.microcycles.length, 4);

function entry(weekIndex: number, planEntryId: string): Workout | undefined {
  return program.microcycles[weekIndex].workouts.find((value) => value.planEntryId === planEntryId);
}

for (const [label, value, primary] of [
  ['W1 Monday', entry(0, 'w1:monday:none:strength'), 'Full Body Strength'],
  ['W1 Wednesday', entry(0, 'w1:wednesday:none:strength'), 'Upper Push'],
  ['W2 Monday', entry(1, 'w2:monday:none:strength'), 'Full Body Strength'],
  ['W2 Wednesday', entry(1, 'w2:wednesday:none:strength'), 'Upper Push'],
] as const) {
  ok(`${label} exists`, !!value);
  if (value) {
    eq(`${label} primary strength survives`, weeklyPlanTitle(value), primary);
    eq(`${label} optional aerobic context`, weeklyPlanContextLabel(value), 'Aerobic Flush');
    eq(`${label} typed optional ownership`, value.section18ConditioningRole, 'optional_recovery_aerobic');
  }
}

for (const weekIndex of [0, 1]) {
  const identities = program.microcycles[weekIndex].workouts
    .filter((value) => value.section18ConditioningRole === 'optional_recovery_aerobic')
    .map((value) => projectConditioningVisibleIdentity(value));
  ok(`W${weekIndex + 1} selects one or two optional aerobic sessions`,
    identities.length >= 1 && identities.length <= 2, identities);
  ok(`W${weekIndex + 1} optional sessions remain flush/recovery identities`,
    identities.every((value) => value?.structureFamily === 'aerobic_flush'), identities);
  ok(`W${weekIndex + 1} contains no core conditioning ownership`,
    program.microcycles[weekIndex].workouts.every((value) =>
      value.section18ConditioningRole !== 'required_core' &&
      value.section18ConditioningRole !== 'planner_selected_core'));
}

for (const weekIndex of [2, 3]) {
  const core = program.microcycles[weekIndex].workouts.filter((value) =>
    value.section18ConditioningRole === 'required_core' ||
    value.section18ConditioningRole === 'planner_selected_core');
  const identities = core.map((value) => projectConditioningVisibleIdentity(value));
  eq(`W${weekIndex + 1} mid-off-season core conditioning count`, core.length, 3);
  ok(`W${weekIndex + 1} core conditioning retains canonical identity`,
    identities.every((value) => !!value && value.structureFamily !== 'aerobic_flush'), identities);
  ok(`W${weekIndex + 1} has at most one hard/tempo development exposure`,
    identities.filter((value) => value?.structureFamily === 'tempo_intervals').length <= 1,
    identities);
}

console.log(`\nconditioningVisibleIdentityTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
