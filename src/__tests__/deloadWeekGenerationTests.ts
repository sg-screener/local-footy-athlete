(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import type { Microcycle, OnboardingData, SeasonPhase, Workout, WorkoutExercise } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import {
  applyStrengthDeloadToExercises,
  isConditioningExerciseRow,
  resolveDeloadWeekPolicy,
  resolveWeekKind,
} from '../rules/deloadWeekRules';
import { buildBlockWeekStates } from '../utils/programBlockState';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function profileFor(seasonPhase: SeasonPhase): OnboardingData {
  return {
    seasonPhase,
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: seasonPhase === 'Off-season' ? 0 : 2,
    teamTrainingDays: seasonPhase === 'Off-season' ? [] : ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Moderate',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
    motivation: 'Get stronger and fitter',
    weightKg: 85,
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    usualGameDay: seasonPhase === 'In-season' ? 'Saturday' : undefined,
  } as OnboardingData;
}

function generatedBlock(seasonPhase: SeasonPhase): Microcycle[] {
  return generateProgramLocally(profileFor(seasonPhase), {
    todayISO: '2026-07-06',
    previousProgram: null,
  }).microcycles;
}

function days(microcycle: Microcycle): number[] {
  return microcycle.workouts.map((workout) => workout.dayOfWeek).sort((a, b) => a - b);
}

function hardConditioning(workout: Workout): boolean {
  return workout.conditioningCategory === 'sprint' ||
    workout.conditioningCategory === 'vo2' ||
    workout.conditioningCategory === 'glycolytic' ||
    workout.conditioningFlavour === 'high-intensity';
}

function hasConditioningTouch(workout: Workout): boolean {
  return !!workout.conditioningCategory || !!workout.hasCombinedConditioning;
}

function easyOrTempoConditioningTouch(workout: Workout): boolean {
  return workout.conditioningCategory === 'aerobic_base' ||
    workout.conditioningCategory === 'tempo' ||
    (workout.hasCombinedConditioning &&
      (workout.conditioningFlavour === 'aerobic' || workout.conditioningFlavour === 'tempo'));
}

function strengthRows(workout: Workout): WorkoutExercise[] {
  return workout.exercises.filter((exercise) => !isConditioningExerciseRow(exercise));
}

function mainRows(workout: Workout): WorkoutExercise[] {
  return strengthRows(workout).filter((exercise) =>
    classifyPoolSlot(exercise.exercise?.name ?? '')?.role === 'anchor');
}

function strengthLike(workout: Workout): boolean {
  return workout.workoutType === 'Strength' ||
    workout.workoutType === 'Mixed' ||
    workout.workoutType === 'Team Training';
}

function totalStrengthSets(microcycle: Microcycle): number {
  return microcycle.workouts
    .filter(strengthLike)
    .flatMap(strengthRows)
    .reduce((sum, exercise) => sum + exercise.prescribedSets, 0);
}

function deloadNotes(microcycle: Microcycle): string[] {
  return microcycle.workouts
    .flatMap(strengthRows)
    .map((exercise) => exercise.notes ?? '')
    .filter((note) => /Deload week:/i.test(note));
}

function comparableStrengthPairs(buildWeek: Microcycle, deloadWeek: Microcycle): Array<[Workout, Workout]> {
  return buildWeek.workouts
    .filter(strengthLike)
    .map((buildWorkout) => {
      const deloadWorkout = deloadWeek.workouts.find((candidate) => candidate.dayOfWeek === buildWorkout.dayOfWeek);
      return deloadWorkout ? [buildWorkout, deloadWorkout] as [Workout, Workout] : null;
    })
    .filter((pair): pair is [Workout, Workout] => !!pair);
}

function weeklyStrengthPatterns(microcycle: Microcycle): string[] {
  return Array.from(new Set(
    microcycle.workouts.flatMap((workout) =>
      workout.strengthIntent?.effectivePatterns ?? workout.strengthIntent?.plannedPatterns ?? [],
    ),
  )).sort();
}

function assertCalendarDeload(
  seasonPhase: 'Off-season' | 'Pre-season',
  expectedMultiplier: number,
  microcycles: Microcycle[] = generatedBlock(seasonPhase),
): void {
  const week1 = microcycles[0];
  const week2 = microcycles[1];
  const week3 = microcycles[2];
  const week4 = microcycles[3];

  ok(`${seasonPhase} weeks 1-3 are build weeks`,
    [week1, week2, week3].every((week) => week.weekKind === 'build' && week.intensityMultiplier === 1.0),
    JSON.stringify([week1, week2, week3].map((week) => ({ weekKind: week.weekKind, intensityMultiplier: week.intensityMultiplier }))));
  ok(`${seasonPhase} week 4 is deload`, week4.weekKind === 'deload');
  ok(`${seasonPhase} week 4 multiplier applied`, week4.intensityMultiplier === expectedMultiplier,
    String(week4.intensityMultiplier));
  ok(`${seasonPhase} week 4 keeps same session days`,
    JSON.stringify(days(week4)) === JSON.stringify(days(week3)),
    JSON.stringify({ week3: days(week3), week4: days(week4) }));
  ok(`${seasonPhase} week 4 does not collapse days to rest`,
    week4.workouts.length === week3.workouts.length,
    JSON.stringify({ week3: week3.workouts.length, week4: week4.workouts.length }));
  ok(`${seasonPhase} week 4 is lighter than week 3`,
    totalStrengthSets(week4) < totalStrengthSets(week3),
    JSON.stringify({ week3: totalStrengthSets(week3), week4: totalStrengthSets(week4) }));
  ok(`${seasonPhase} week 4 has deload RPE notes`, deloadNotes(week4).length > 0);
  ok(`${seasonPhase} week 4 has no hard conditioning`,
    week4.workouts.every((workout) => !hardConditioning(workout)),
    JSON.stringify(week4.workouts.map((workout) => ({
      day: workout.dayOfWeek,
      category: workout.conditioningCategory,
      flavour: workout.conditioningFlavour,
    }))));
  ok(`${seasonPhase} week 4 has no sprint/COD category`,
    week4.workouts.every((workout) => workout.conditioningCategory !== 'sprint'));
  ok(`${seasonPhase} week 4 keeps an easy/tempo conditioning touch`,
    week4.workouts.some(easyOrTempoConditioningTouch),
    JSON.stringify(week4.workouts.map((workout) => ({
      day: workout.dayOfWeek,
      category: workout.conditioningCategory,
      combined: workout.hasCombinedConditioning,
    }))));
  ok(`${seasonPhase} week 4 keeps useful conditioning somewhere`,
    week4.workouts.some(hasConditioningTouch));
  if (seasonPhase === 'Pre-season') {
    ok('Pre-season deload preserves weekly strength-pattern coverage',
      JSON.stringify(weeklyStrengthPatterns(week4)) === JSON.stringify(weeklyStrengthPatterns(week3)) &&
      weeklyStrengthPatterns(week4).length === 4,
      JSON.stringify({
        build: weeklyStrengthPatterns(week3),
        deload: weeklyStrengthPatterns(week4),
      }));
  }

  for (const [buildWorkout, deloadWorkout] of comparableStrengthPairs(week3, week4)) {
    const buildMain = mainRows(buildWorkout)[0];
    const deloadMain = mainRows(deloadWorkout)[0];
    if (!buildMain) continue;
    if (seasonPhase === 'Off-season') {
      ok(`${seasonPhase} day ${buildWorkout.dayOfWeek} keeps main lift`,
        !!deloadMain && buildMain.exercise?.name === deloadMain.exercise?.name,
        JSON.stringify({
          build: buildMain?.exercise?.name,
          deload: deloadMain?.exercise?.name,
        }));
    }
    if (deloadMain) {
      ok(`${seasonPhase} day ${buildWorkout.dayOfWeek} main sets reduced safely`,
        deloadMain.prescribedSets >= 2 && deloadMain.prescribedSets <= buildMain.prescribedSets,
        JSON.stringify({ build: buildMain.prescribedSets, deload: deloadMain.prescribedSets }));
      if ((buildMain.prescribedWeightKg ?? 0) > 0 && (deloadMain.prescribedWeightKg ?? 0) > 0) {
        ok(`${seasonPhase} day ${buildWorkout.dayOfWeek} main load reduced`,
          (deloadMain.prescribedWeightKg ?? 0) < (buildMain.prescribedWeightKg ?? 0),
          JSON.stringify({ build: buildMain.prescribedWeightKg, deload: deloadMain.prescribedWeightKg }));
      }
    }
  }

  ok(`${seasonPhase} deload strength sets floor at 2`,
    week4.workouts
      .filter(strengthLike)
      .flatMap(strengthRows)
      .every((exercise) => exercise.prescribedSets >= 2),
    JSON.stringify(week4.workouts.flatMap(strengthRows).map((exercise) => ({
      name: exercise.exercise?.name,
      sets: exercise.prescribedSets,
    }))));
}

console.log('\n-- Calendar deload week generation --');

{
  const states = buildBlockWeekStates({
    blockStartISO: '2026-07-06',
    blockNumber: 1,
    seasonPhase: 'Off-season',
  });
  ok('week kind table: week 3 builds', resolveWeekKind('Off-season', 3) === 'build');
  ok('week kind table: first Off-season phase week 4 builds', resolveWeekKind('Off-season', 4) === 'build');
  ok('week kind table: late Off-season phase week 8 deloads', resolveWeekKind('Off-season', 8) === 'deload');
  ok('week kind table: in-season week 4 still builds', resolveWeekKind('In-season', 4) === 'build');
  ok('first Off-season block exposes no automatic deload',
    states.map((state) => state.weekKind).join(',') === 'build,build,build,build',
    states.map((state) => state.weekKind).join(','));
}

{
  const firstOffseason = generatedBlock('Off-season');
  ok('first Off-season phase block keeps all four weeks as build',
    firstOffseason.every((week) => week.weekKind === 'build' && week.intensityMultiplier === 1));
  ok('first Off-season phase week 4 receives no deload prescription notes',
    deloadNotes(firstOffseason[3]).length === 0);
  const firstProgram = generateProgramLocally(profileFor('Off-season'), {
    todayISO: '2026-07-06',
    previousProgram: null,
  });
  const lateBlock = generateProgramLocally(profileFor('Off-season'), {
    todayISO: '2026-08-03',
    blockNumber: 2,
    previousProgram: firstProgram,
  });
  assertCalendarDeload('Off-season', 0.85, lateBlock.microcycles);
}
assertCalendarDeload('Pre-season', 0.9);

{
  const inSeason = generatedBlock('In-season');
  ok('in-season weeks stay build in this slice',
    inSeason.every((week) => week.weekKind === 'build' && week.intensityMultiplier === 1.0),
    JSON.stringify(inSeason.map((week) => ({ week: week.weekNumber, kind: week.weekKind, intensity: week.intensityMultiplier }))));
  ok('in-season week 4 is not tagged with deload RPE notes',
    deloadNotes(inSeason[3]).length === 0);
}

{
  const policy = resolveDeloadWeekPolicy('Off-season', 'deload');
  const exercise = {
    id: 'e1',
    workoutId: 'w1',
    exerciseId: 'ex1',
    exerciseOrder: 1,
    prescribedSets: 2,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: 100,
    restSeconds: 0,
    exercise: {
      id: 'ex1',
      name: 'Back Squat',
      description: '',
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  } as WorkoutExercise;
  const deloaded = applyStrengthDeloadToExercises([exercise], policy!)[0];
  ok('double reduction clamp keeps sets at floor',
    deloaded.prescribedSets === 2,
    JSON.stringify({ sets: deloaded.prescribedSets }));
}

console.log(`\ndeloadWeekGenerationTests: ${pass} passed, ${fail} failed`);

if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
