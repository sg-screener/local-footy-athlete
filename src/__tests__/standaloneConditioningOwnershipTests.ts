(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { generateProgramLocally } from '../services/api/generateProgram';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { buildRepeatWeekOverlay } from '../utils/repeatWeek';
import { getSessionComponentRows, getSessionComponents } from '../utils/sessionComponents';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
    return;
  }
  fail++;
  failures.push(name);
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
}

function row(name: string, index: number, workoutId = 'ownership'): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `${workoutId}:row:${index}`,
    workoutId,
    exerciseId: `${workoutId}:exercise:${slug}`,
    exerciseOrder: index + 1,
    prescribedSets: 1,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: 50,
    restSeconds: 60,
    exercise: {
      id: `${workoutId}:exercise:${slug}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Compound',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function workout(name: string, rows: WorkoutExercise[], overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'ownership',
    microcycleId: 'ownership-mc',
    dayOfWeek: 1,
    name,
    description: '',
    durationMinutes: 30,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    exercises: rows,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function components(value: Workout): string[] {
  return getSessionComponents(value).map((component) => component.kind);
}

function names(value: Workout): string[] {
  return value.exercises.map((item) => item.exercise?.name ?? item.exerciseId);
}

function assertConditioningOnly(label: string, value: Workout): void {
  const rows = getSessionComponentRows(value);
  const classified = classifyVisibleSession(value);
  ok(`${label}: no strength intent`, !value.strengthIntent && !value.strengthPatternContributions?.length, value.strengthIntent);
  ok(`${label}: no strength rows`, rows.strengthRows.length === 0, names(value));
  ok(`${label}: no Pull-Ups`, !names(value).some((name) => /pull[- ]?ups?/i.test(name)), names(value));
  ok(`${label}: conditioning component remains`, components(value).includes('conditioning'), components(value));
  ok(`${label}: no strength component`, !components(value).includes('strength'), components(value));
  ok(`${label}: final type is Conditioning`, value.workoutType === 'Conditioning', value.workoutType);
  ok(`${label}: no main-strength exposure`, classified.contributions.mainStrength === 0, classified);
  ok(`${label}: no upper-pull region`, classified.strengthRegion !== 'upper', classified);
}

console.log('standaloneConditioningOwnershipTests');

console.log('\n[1] Modern standalone SkiErg tempo owns no strength');
const skiRows = [
  row('SkiErg warm-up', 0),
  row('5 x 2min SkiErg tempo intervals', 1),
  row('SkiErg cool-down', 2),
];
const modernSki = finaliseWorkoutAfterMutation(workout('Bike/Row/Ski Tempo Intervals', skiRows, {
  planEntryId: 'w3:monday:none:tempo',
  conditioningCategory: 'tempo',
  conditioningFlavour: 'tempo',
  workoutType: 'Strength',
}), { phase: 'Off-season', offseasonSubphase: 'mid_offseason', planIntentValid: true }).workout;
assertConditioningOnly('modern SkiErg tempo', modernSki);
ok('modern SkiErg tempo headline uses main work',
  /5\s*x\s*2min/i.test(modernSki.conditioningBlock?.options[0]?.title ?? '') &&
  !/warm[- ]?up|cool[- ]?down/i.test(modernSki.conditioningBlock?.options[0]?.title ?? ''),
  modernSki.conditioningBlock?.options[0]);

console.log('\n[2] Modern and legacy RowErg conditioning cannot create pull credit');
const modernRow = finaliseWorkoutAfterMutation(workout('Row aerobic work', [
  row('Rower warm-up', 0),
  row('3 x 8min zone 2 RowErg', 1),
  row('Easy row', 2),
], {
  planEntryId: 'w1:tuesday:none:aerobic-base',
  conditioningCategory: 'aerobic_base',
  conditioningFlavour: 'aerobic',
  workoutType: 'Mixed',
}), { phase: 'Off-season', offseasonSubphase: 'early_offseason', planIntentValid: true }).workout;
assertConditioningOnly('modern RowErg aerobic', modernRow);
ok('typed standalone domain preserves an unclassified easy conditioning row',
  names(modernRow).includes('Easy row') &&
  getSessionComponentRows(modernRow).conditioningRows.some((item) => item.exercise?.name === 'Easy row'),
  names(modernRow));

const legacyRow = finaliseWorkoutAfterMutation(workout('Rower aerobic work', [
  row('Rower aerobic blocks', 0),
]), { phase: 'Pre-season', planIntentValid: false }).workout;
assertConditioningOnly('legacy RowErg aerobic', legacyRow);

console.log('\n[3] Planned Mixed and genuine Upper Pull remain valid');
const bench = row('Bench Press', 0, 'mixed');
const rowErg = row('3 x 8min zone 2 RowErg', 1, 'mixed');
const mixed = finaliseWorkoutAfterMutation(workout('Upper Push + Row conditioning', [bench, rowErg], {
  id: 'mixed',
  planEntryId: 'w3:wednesday:none:strength',
  workoutType: 'Mixed',
  hasCombinedConditioning: true,
  attachedConditioningKind: 'component',
  conditioningCategory: 'aerobic_base',
  conditioningFlavour: 'aerobic',
  strengthIntent: {
    archetype: 'upper', primaryPattern: 'push',
    plannedPatterns: ['push'], effectivePatterns: ['push'],
  },
  strengthPatternContributions: ['push'],
  conditioningBlock: {
    intent: 'aerobic', attachedKind: 'component',
    options: [{ title: 'RowErg aerobic blocks', description: '', exerciseIds: [rowErg.id] }],
  },
}), { phase: 'Off-season', offseasonSubphase: 'mid_offseason', planIntentValid: true }).workout;
ok('planned Mixed keeps Strength + Conditioning',
  components(mixed).includes('strength') && components(mixed).includes('conditioning'), components(mixed));
ok('RowErg adds no pull pattern to planned Upper Push',
  JSON.stringify(mixed.strengthIntent?.effectivePatterns) === JSON.stringify(['push']), mixed.strengthIntent);

const legacyPullOnce = finaliseWorkoutAfterMutation(workout('Upper Pull', [
  row('Barbell Row', 0),
  row('Pull-Ups', 1),
], { workoutType: 'Strength' }), { phase: 'Pre-season' }).workout;
const legacyPullTwice = finaliseWorkoutAfterMutation(legacyPullOnce, { phase: 'Pre-season' }).workout;
ok('genuine legacy Upper Pull migrates from canonical strength rows',
  JSON.stringify(legacyPullOnce.strengthIntent?.effectivePatterns) === JSON.stringify(['pull']), legacyPullOnce.strengthIntent);
ok('legacy strength migration is idempotent',
  JSON.stringify(legacyPullTwice) === JSON.stringify(legacyPullOnce));

console.log('\n[4] Exact four-week off-season regression');
const profile: OnboardingData = {
  firstName: 'OwnershipAudit',
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
ok('exact regression generates four microcycles', program.microcycles.length === 4, program.microcycles.length);
const coreConditioningRoles = new Set(['required_core', 'planner_selected_core']);
for (const [label, microcycle] of [
  ['Week 3', program.microcycles[2]],
  ['Week 4', program.microcycles[3]],
] as const) {
  const mainStrength = microcycle.workouts.filter((value) => !!value.strengthIntent);
  const coreConditioning = microcycle.workouts.filter((value) =>
    coreConditioningRoles.has(value.section18ConditioningRole ?? ''));
  ok(`${label} keeps the mid-off-season S4 default`, mainStrength.length === 4,
    mainStrength.map((value) => value.planEntryId));
  ok(`${label} keeps C3 within the approved C3-4 range`, coreConditioning.length === 3,
    coreConditioning.map((value) => value.planEntryId));
  ok(`${label} core conditioning may be combined after strength is allocated`,
    coreConditioning.every((value) =>
      value.hasCombinedConditioning === true &&
      !!value.strengthIntent &&
      components(value).includes('strength') &&
      components(value).includes('conditioning')),
    coreConditioning.map((value) => ({
      id: value.planEntryId,
      role: value.section18ConditioningRole,
      components: components(value),
    })));
  ok(`${label} has no legacy weekday-owned standalone core entry`,
    coreConditioning.every((value) => value.workoutType !== 'Conditioning'),
    coreConditioning.map((value) => ({ id: value.planEntryId, type: value.workoutType })));
}

console.log('\n[5] Repeat and rebuild preserve standalone ownership');
const overlay = buildRepeatWeekOverlay({
  sourceWorkouts: [modernSki],
  targetWeekStart: '2026-08-10',
});
const repeated = Object.values(overlay.workoutsByDate).find(Boolean) as Workout | undefined;
ok('Repeat Week retains standalone workout', !!repeated);
if (repeated) assertConditioningOnly('repeated standalone tempo', repeated);
const rebuilt = finaliseWorkoutAfterMutation(modernSki, {
  phase: 'Off-season', offseasonSubphase: 'mid_offseason', planIntentValid: true,
}).workout;
assertConditioningOnly('canonically rebuilt standalone tempo', rebuilt);
ok('canonical standalone rebuild is idempotent', JSON.stringify(rebuilt) === JSON.stringify(modernSki));

console.log(`\nstandaloneConditioningOwnershipTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
