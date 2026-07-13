(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { Workout, WorkoutExercise } from '../types/domain';
import {
  classifyConditioningWorkout,
  combinedConditioningCategoryLabel,
  weeklyConditioningIconKind,
  weeklyPlanContextLabel,
  weeklyPlanSecondaryLabel,
  weeklyPlanTitle,
} from '../utils/weeklyPlanDisplay';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function eq(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

function row(name: string, order: number, sets = 1, restSeconds = 0): WorkoutExercise {
  return {
    id: `row-${order}`,
    workoutId: 'display',
    exerciseId: `exercise-${order}`,
    exerciseOrder: order,
    prescribedSets: sets,
    prescribedRepsMin: 1,
    prescribedRepsMax: 1,
    restSeconds,
    exercise: {
      id: `exercise-${order}`,
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

function conditioning(
  workName: string,
  overrides: Partial<Workout> = {},
): Workout {
  const rows = overrides.exercises ?? [row(workName, 1)];
  return {
    id: 'display',
    microcycleId: 'display-mc',
    dayOfWeek: 2,
    name: 'Generic conditioning template',
    description: '',
    durationMinutes: 40,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    conditioningCategory: 'aerobic_base',
    conditioningFlavour: 'aerobic',
    conditioningBlock: {
      intent: 'aerobic',
      options: [{ title: 'Generic template', description: '', exerciseIds: rows.map((value) => value.id) }],
    },
    exercises: rows,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

console.log('weeklyPlanDisplayTests');

console.log('\n[1] non-conditioning weekly titles are preserved');
eq('Upper Push', weeklyPlanTitle({ name: 'Upper Push', workoutType: 'Strength' }), 'Upper Push');
eq('Full Body Strength', weeklyPlanTitle({ name: 'Full Body Strength', workoutType: 'Strength' }), 'Full Body Strength');
eq('team strength leads', weeklyPlanTitle({ name: 'Team Training + Upper Push', workoutType: 'Team Training' }), 'Upper Push');
eq('team only', weeklyPlanTitle({ name: 'Team Training', workoutType: 'Team Training' }), 'Team Training');
eq('game', weeklyPlanTitle({ name: 'Game Day', workoutType: 'Game' }), 'Game Day');
eq('accessories', weeklyPlanTitle({ name: 'Prehab & Accessories', workoutType: 'Strength' }), 'Accessories');
eq('recovery without conditioning stays Recovery', weeklyPlanTitle({ name: 'Recovery Flow', workoutType: 'Recovery' }), 'Recovery');

console.log('\n[2] standalone structure owns title without weekly dose copy');
const continuous = conditioning('40min zone 2 Assault Bike');
eq('continuous title', weeklyPlanTitle(continuous), 'Continuous Aerobic');
eq('continuous weekly context is empty', weeklyPlanContextLabel(continuous), null);
eq('continuous weekly secondary is empty', weeklyPlanSecondaryLabel(continuous), null);

const long = conditioning('5 x 8min zone 2 Rower', {
  exercises: [row('5 x 8min zone 2 Rower', 1, 5, 120)],
});
eq('long title', weeklyPlanTitle(long), 'Long Aerobic Intervals');
eq('long weekly context is empty', weeklyPlanContextLabel(long), null);

const short = conditioning('12 x 1min aerobic work on SkiErg', {
  exercises: [row('12 x 1min aerobic work on SkiErg', 1, 12, 60)],
});
eq('short title', weeklyPlanTitle(short), 'Short Aerobic Intervals');
eq('short weekly context is empty', weeklyPlanContextLabel(short), null);

console.log('\n[3] typed intent outranks identical interval duration');
const tempo = conditioning('5 x 2min on Bike', {
  conditioningCategory: 'tempo',
  conditioningFlavour: 'tempo',
  conditioningBlock: {
    intent: 'tempo',
    options: [{ title: 'Stale Aerobic Base', description: '', exerciseIds: ['row-1'] }],
  },
  exercises: [row('5 x 2min on Bike', 1, 5, 60)],
});
eq('tempo title', weeklyPlanTitle(tempo), 'Tempo Intervals');
eq('tempo never Aerobic Base', classifyConditioningWorkout(tempo), 'Tempo Intervals');
eq('tempo weekly context is empty', weeklyPlanContextLabel(tempo), null);

const hard = conditioning('5 x 2min on Bike', {
  conditioningCategory: 'vo2', conditioningFlavour: 'high-intensity',
  conditioningBlock: { intent: 'high-intensity', options: [{ title: 'Intervals', description: '', exerciseIds: ['row-1'] }] },
  exercises: [row('5 x 2min on Bike', 1, 5, 60)],
});
eq('hard title', weeklyPlanTitle(hard), 'Hard Intervals');

const speed = conditioning('8 x 15sec Assault Bike sprints', {
  conditioningCategory: 'sprint', conditioningFlavour: 'high-intensity',
  conditioningBlock: { intent: 'high-intensity', options: [{ title: 'Sprints', description: '', exerciseIds: ['row-1'] }] },
  exercises: [row('8 x 15sec Assault Bike sprints', 1, 8, 120)],
});
eq('speed title', weeklyPlanTitle(speed), 'Speed Conditioning');

console.log('\n[4] flush/recovery purpose and fallback are honest');
eq('flush', weeklyPlanTitle(conditioning('20min Easy Aerobic Flush')), 'Aerobic Flush');
const intervalFlush = conditioning('3 x 8min Easy Aerobic Flush', {
  exercises: [row('3 x 8min Easy Aerobic Flush', 1, 3, 120)],
});
eq('interval flush keeps structure-purpose title', weeklyPlanTitle(intervalFlush), 'Aerobic Flush');
eq('interval flush weekly card has no dose subtitle', weeklyPlanContextLabel(intervalFlush), null);
const recovery = conditioning('20min recovery conditioning', {
  workoutType: 'Recovery', sessionTier: 'recovery',
});
eq('recovery conditioning', weeklyPlanTitle(recovery), 'Recovery Conditioning');
const fallback = conditioning('Easy cyclical work');
eq('canonical unknown structure fallback', weeklyPlanTitle(fallback), 'Aerobic Conditioning');

console.log('\n[5] attached placement preserves primary title');
const attached = conditioning('3 x 8min zone 2 RowErg', {
  name: 'Full Body Strength',
  workoutType: 'Mixed',
  hasCombinedConditioning: true,
  attachedConditioningKind: 'component',
  conditioningBlock: {
    intent: 'aerobic', attachedKind: 'component',
    options: [{ title: 'RowErg aerobic', description: '', exerciseIds: ['row-1'] }],
  },
  exercises: [row('3 x 8min zone 2 RowErg', 1, 3, 120)],
});
eq('attached keeps strength title', weeklyPlanTitle(attached), 'Full Body Strength');
eq('attached context is structure only', combinedConditioningCategoryLabel(attached), 'Long Aerobic Intervals');
eq('attached weekly context omits dose', weeklyPlanContextLabel(attached), 'Long Aerobic Intervals');
eq('attached weekly secondary is one structure line', weeklyPlanSecondaryLabel(attached), '+ Long Aerobic Intervals');

console.log('\n[6] modality copy is non-authoritative');
for (const modality of ['Bike', 'RowErg', 'SkiErg', 'Bike + RowErg']) {
  const value = conditioning(`3 x 8min aerobic on ${modality}`, {
    exercises: [row(`3 x 8min aerobic on ${modality}`, 1, 3, 120)],
  });
  eq(`${modality} family`, weeklyPlanTitle(value), 'Long Aerobic Intervals');
  eq(`${modality} weekly context`, weeklyPlanContextLabel(value), null);
}

console.log('\n[7] controlled legacy fallback never revives Aerobic Base');
eq('legacy VO2', classifyConditioningWorkout({ name: '4x4 VO2' }), 'Hard Intervals');
eq('legacy tempo', classifyConditioningWorkout({ name: '5 x 2min tempo' }), 'Tempo Intervals');
eq('legacy long aerobic', classifyConditioningWorkout({ name: '3 x 8min aerobic' }), 'Long Aerobic Intervals');
eq('legacy unknown', classifyConditioningWorkout({ name: 'Mystery conditioning' }), 'Aerobic Conditioning');

console.log('\n[8] all conditioning families reuse the original weekly icon');
for (const label of [
  'Continuous Aerobic',
  'Long Aerobic Intervals',
  'Short Aerobic Intervals',
  'Tempo Intervals',
  'Aerobic Flush',
  'Recovery Conditioning',
  'Hard Intervals',
  'Speed Conditioning',
  'Aerobic Conditioning',
]) {
  eq(`${label} icon`, weeklyConditioningIconKind(label), 'pulse');
  eq(`attached ${label} icon`, weeklyConditioningIconKind(`+ ${label}`), 'pulse');
}
eq('legacy Aerobic Base keeps original icon', weeklyConditioningIconKind('Aerobic Base'), 'pulse');
eq('strength icon remains outside conditioning mapping', weeklyConditioningIconKind('Full Body Strength'), null);
eq('game icon remains outside conditioning mapping', weeklyConditioningIconKind('Game Day'), null);
eq('team icon remains outside conditioning mapping', weeklyConditioningIconKind('Team Training'), null);

console.log(`\nweeklyPlanDisplayTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
