(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { snapshotProjectedDay } from '../utils/coachRevisionProposal';
import {
  extractVisibleProgramItemsFromWorkout,
  visibleWorkoutItemCountLabel,
} from '../utils/visibleProgramReadModel';
import {
  extractTeamTrainingFromWorkout,
  getTeamTrainingWorkoutState,
  isTeamTrainingExercise,
  isTeamTrainingItem,
  normalizeTeamTrainingBlocks,
  normalizeTeamTrainingWorkoutForDisplay,
  splitTeamTrainingFromExercises,
} from '../utils/teamTraining';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

const teamRow = {
  id: 'we-team',
  workoutId: 'w-team',
  exerciseId: 'ex-team',
  exerciseOrder: 1,
  prescribedSets: 1,
  prescribedRepsMin: 60,
  prescribedRepsMax: 90,
  prescribedWeightKg: 12.5,
  restSeconds: 0,
  notes: 'Primary field-load anchor.',
  exercise: {
    id: 'ex-team',
    name: 'Team training field session',
    description: 'Club/team field session.',
    muscleGroups: [],
    exerciseType: 'Cardio',
    equipmentRequired: [],
    difficultyLevel: 'Beginner',
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  },
};

function strengthRow(id: string, name: string, order: number) {
  return {
    id,
    workoutId: 'w-team',
    exerciseId: `ex-${id}`,
    exerciseOrder: order,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 50,
    restSeconds: 90,
    exercise: {
      id: `ex-${id}`,
      name,
      description: `${name} strength work`,
      muscleGroups: ['Upper'],
      exerciseType: 'Compound',
      equipmentRequired: ['Gym'],
      difficultyLevel: 'Intermediate',
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T00:00:00Z',
    },
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  };
}

function workout(overrides: any = {}) {
  return {
    id: 'w-team',
    microcycleId: 'mc-1',
    dayOfWeek: 1,
    name: 'Team Training + Upper Push',
    description: '',
    durationMinutes: 75,
    intensity: 'Moderate',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [
      teamRow,
      strengthRow('bench', 'Bench Press', 2),
      strengthRow('pushup', 'Explosive Push-ups', 3),
    ],
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
    ...overrides,
  };
}

console.log('teamTrainingRenderingTests');

console.log('\n[1] combined day render model separates team training from strength');
{
  const combined = workout();
  const state = getTeamTrainingWorkoutState(combined);
  const split = splitTeamTrainingFromExercises(combined.exercises);
  eq('team row predicate catches legacy field-session row', isTeamTrainingItem(teamRow), true);
  eq('team exercise alias catches legacy row', isTeamTrainingExercise(teamRow), true);
  eq('shared split extracts one team row', split.teamTrainingItems.length, 1);
  eq('shared split preserves real gym rows', split.renderableExercises.length, 2);
  eq('combined day has Team Training block', state.hasTeamTraining, true);
  eq('combined day is not team-only', state.isTeamTrainingOnly, false);
  eq(
    'strength render rows exclude Team Training',
    state.renderableExercises.map((row) => row.exercise?.name),
    ['Bench Press', 'Explosive Push-ups'],
  );
  eq('exercise count excludes Team Training', visibleWorkoutItemCountLabel(combined as any), '2 exercises');

  const items = extractVisibleProgramItemsFromWorkout(combined as any);
  eq('visible items exclude Team Training as strength item',
    items.filter((item) => item.domain === 'strength').map((item) => item.title),
    ['Bench Press', 'Explosive Push-ups']);
}

console.log('\n[2] team-only malformed workout normalises to a loggable session');
{
  const teamOnly = workout({
    name: 'Team Training',
    workoutType: 'Team Training',
    exercises: [
      {
        ...strengthRow('sprint', 'Sprint Intervals', 1),
        prescribedSets: 10,
        prescribedRepsMin: 1,
        prescribedRepsMax: 1,
      },
    ],
  });
  const state = getTeamTrainingWorkoutState(teamOnly);
  const normalised = normalizeTeamTrainingWorkoutForDisplay(teamOnly as any);
  eq('team-only is detected even with legacy exercise rows', state.isTeamTrainingOnly, true);
  eq('team-only render rows are empty', state.renderableExercises.length, 0);
  eq('normalised team-only title', normalised.name, 'Team Training');
  eq('normalised team-only type', normalised.workoutType, 'Team Training');
  eq('team-only has no exercise count label', visibleWorkoutItemCountLabel(teamOnly as any), null);
  eq(
    'team-only read model exposes a session item, not strength',
    extractVisibleProgramItemsFromWorkout(teamOnly as any).map((item) => `${item.domain}:${item.title}`),
    ['session:Team Training'],
  );
}

console.log('\n[3] legacy only-team row with stale strength title becomes Team Training');
{
  const stale = workout({
    name: 'Upper Push',
    workoutType: 'Strength',
    exercises: [teamRow],
  });
  const state = getTeamTrainingWorkoutState(stale);
  const normalised = normalizeTeamTrainingWorkoutForDisplay(stale as any);
  const aliased = normalizeTeamTrainingBlocks(stale as any);
  eq('stale strength shell is team-only', state.isTeamTrainingOnly, true);
  eq('stale strength shell display name is Team Training', normalised.name, 'Team Training');
  eq('normalise alias matches Team Training title', aliased.name, 'Team Training');
  eq('stale strength shell display type is Team Training', normalised.workoutType, 'Team Training');
  eq('stale strength shell has no count label', visibleWorkoutItemCountLabel(stale as any), null);
}

console.log('\n[4] composite legacy exercise names are lifted out of gym rows');
{
  const malformedComposite = {
    ...teamRow,
    exercise: {
      ...teamRow.exercise,
      name: 'Upper Push + Team Training',
    },
  };
  const malformed = workout({
    exercises: [
      malformedComposite,
      strengthRow('bench', 'Bench Press', 2),
    ],
  });
  const state = extractTeamTrainingFromWorkout(malformed as any);
  eq('extract alias detects team block', state.hasTeamTraining, true);
  eq('composite team row removed from renderable exercises',
    state.renderableExercises.map((row) => row.exercise?.name),
    ['Bench Press']);
}

console.log('\n[5] visible snapshot gives Team Training its own session section');
{
  const snap = snapshotProjectedDay({
    date: '2026-07-06',
    dayOfWeek: 1,
    short: 'Mon',
    isToday: false,
    source: 'program',
    workout: workout() as any,
    indicator: 'workout',
  } as any);
  eq('snapshot has strength + session sections',
    snap.workout?.sections.map((section) => section.kind).sort(),
    ['session', 'strength']);
  ok('Team Training section has no exercise ids',
    snap.workout?.sections
      .find((section) => section.kind === 'session')
      ?.items.every((item) => item.exerciseIds.length === 0));
}

console.log('\n[6] generation fallback never creates Team Training as an exercise');
{
  const teamOnly = buildWorkoutsFromCoach([], 'mc-test', [{
    dayOfWeek: 'Monday',
    tier: 'core',
    focus: 'Team Training',
    isTeamDay: true,
    isHardExposure: true,
  }] as any);
  eq('team-only fallback has zero exercises', teamOnly[0]?.exercises.length, 0);

  const combined = buildWorkoutsFromCoach([], 'mc-test', [{
    dayOfWeek: 'Tuesday',
    tier: 'core',
    focus: 'Team Training + Upper Push',
    isTeamDay: true,
    isHardExposure: true,
  }] as any);
  ok('combined fallback keeps strength rows',
    (combined[0]?.exercises.length ?? 0) > 0,
    combined[0]?.exercises.map((row) => row.exercise?.name));
  ok('combined fallback has no Team Training exercise',
    !combined[0]?.exercises.some(isTeamTrainingItem),
    combined[0]?.exercises.map((row) => row.exercise?.name));
}

console.log('\n[7] team-only detail source keeps logging closed until explicit tap');
{
  const fs = require('fs');
  const path = require('path');
  const dayWorkoutSrc = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'),
    'utf8',
  );
  const useDayWorkoutSrc = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'useDayWorkout.ts'),
    'utf8',
  );
  ok('team-only detail hides exercise edit door',
    /date && !isTeamOnly && editableExercises\.length > 0/.test(dayWorkoutSrc));
  ok('team-only sheet no longer has Coach-prefill team menu',
    !/team_menu|I can.t make team training|Tell coach about team training/.test(dayWorkoutSrc));
  ok('team training still exposes explicit log button',
    /label="Log Team Training"/.test(dayWorkoutSrc));
  ok('startFinished is ignored for Team Training workouts',
    /getTeamTrainingWorkoutState\(rawWorkout\)\.hasTeamTraining[\s\S]{0,120}setIsFinished\(false\)/.test(useDayWorkoutSrc));
}

console.log(`\nteamTrainingRenderingTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
