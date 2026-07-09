import type { LoggedWorkout, Workout, WorkoutExercise } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import {
  applyStrengthProgression,
  buildProgressionContext,
  buildStrengthWorkoutHistoryFromFeedback,
  DEFAULT_PROGRESSION_CONTEXT,
  deriveMissedStrengthSessionsThisWeek,
} from '../utils/strengthProgressionIntegration';
import { deriveAdaptation } from '../utils/feedbackAdapter';
import {
  resolveWeekWithConditioning,
  type ScheduleState,
} from '../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';

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

function exerciseId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeExercise(name: string, order: number, weightKg?: number): WorkoutExercise {
  const id = exerciseId(name);
  return {
    id: `workout-ex-${order}`,
    workoutId: 'workout-strength',
    exerciseId: id,
    exerciseOrder: order,
    prescribedSets: order === 1 ? 4 : 3,
    prescribedRepsMin: order === 1 ? 5 : 10,
    prescribedRepsMax: order === 1 ? 5 : 12,
    prescribedWeightKg: weightKg,
    restSeconds: order === 1 ? 180 : 60,
    exercise: { id, name, description: '' } as any,
    createdAt: '2026-07-06T12:00:00.000Z',
    updatedAt: '2026-07-06T12:00:00.000Z',
  };
}

function makeWorkout(): Workout {
  return {
    id: 'workout-strength',
    microcycleId: 'micro-1',
    dayOfWeek: 1,
    name: 'Lower Body Strength',
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [
      makeExercise('Back Squat', 1, 100),
      makeExercise('Bicep Curl (Dumbbell)', 2, 12),
    ],
    createdAt: '2026-07-06T12:00:00.000Z',
    updatedAt: '2026-07-06T12:00:00.000Z',
  };
}

function makeMixedWorkout(): Workout {
  return {
    ...makeWorkout(),
    name: 'Lower Body Strength + Bike Conditioning',
    workoutType: 'Mixed',
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningBlock: {
      intent: 'high-intensity',
      options: [{
        title: 'Assault Bike Intervals',
        description: '20-30min conditioning component',
        exerciseIds: ['workout-ex-2'],
      }],
    },
    exercises: [
      makeExercise('Back Squat', 1, 100),
      makeExercise('Assault Bike Intervals', 2),
    ],
  };
}

function strengthFeedback(args: {
  date: string;
  feeling?: SessionFeedback['feeling'];
  completion: SessionFeedback['completion'];
  weightKg?: number;
}): SessionFeedback {
  return {
    dateStr: args.date,
    completion: args.completion,
    feeling: args.feeling,
    strength: args.completion === 'skipped'
      ? []
      : [{
          exerciseId: exerciseId('Back Squat'),
          workoutExerciseId: 'workout-ex-1',
          exerciseName: 'Back Squat',
          prescribedSets: 4,
          prescribedRepsMin: 5,
          prescribedRepsMax: 5,
          weightKg: args.weightKg ?? 100,
          completion: args.completion,
        }],
  };
}

function contextFromFeedback(
  feedback: SessionFeedback | null,
  date: string,
  missedSessionsThisWeek = 0,
) {
  const feedbackMap = feedback ? { [feedback.dateStr]: feedback } : {};
  const history = buildStrengthWorkoutHistoryFromFeedback(feedbackMap, date);
  return buildProgressionContext(
    'Off-season',
    'medium',
    [],
    date,
    [],
    {},
    history,
    feedback?.feeling ?? null,
    feedback ? [feedback] : [],
    feedback ? deriveAdaptation(feedback) : null,
    { missedSessionsThisWeek },
  );
}

function progressedSquatWeight(workout: Workout): number | undefined {
  return workout.exercises.find((exercise) => exercise.exercise?.name === 'Back Squat')
    ?.prescribedWeightKg;
}

function progressedSquatSets(workout: Workout): number | undefined {
  return workout.exercises.find((exercise) => exercise.exercise?.name === 'Back Squat')
    ?.prescribedSets;
}

console.log('\n-- Strength progression real inputs --');

{
  const feedback = strengthFeedback({ date: '2026-07-06', feeling: 'easy', completion: 'full' });
  const result = applyStrengthProgression(makeWorkout(), contextFromFeedback(feedback, '2026-07-13'));
  const weight = progressedSquatWeight(result);
  ok('completed good main lift can progress slightly', weight === 102.5, String(weight));
}

{
  const feedback = strengthFeedback({ date: '2026-07-06', feeling: 'good', completion: 'full' });
  const result = applyStrengthProgression(makeWorkout(), contextFromFeedback(feedback, '2026-07-13'));
  ok('average session repeats main lift load', progressedSquatWeight(result) === 100);
}

{
  const feedback = strengthFeedback({ date: '2026-07-06', feeling: 'very_hard', completion: 'full' });
  const result = applyStrengthProgression(makeWorkout(), contextFromFeedback(feedback, '2026-07-13'));
  ok('hard/bad session does not increase load', (progressedSquatWeight(result) ?? 0) <= 100);
  ok('hard/bad session can back off volume', (progressedSquatSets(result) ?? 0) <= 3);
}

{
  const feedback = strengthFeedback({ date: '2026-07-06', feeling: 'easy', completion: 'full' });
  const result = applyStrengthProgression(makeMixedWorkout(), contextFromFeedback(feedback, '2026-07-13'));
  ok('Mixed session with strength rows can progress strength rows',
    progressedSquatWeight(result) === 102.5,
    String(progressedSquatWeight(result)));
  const conditioningRow = result.exercises.find((exercise) => exercise.exercise?.name === 'Assault Bike Intervals');
  ok('Mixed session strength progression does not mutate conditioning rows',
    conditioningRow?.prescribedSets === 3 &&
      conditioningRow.prescribedRepsMin === 10 &&
      conditioningRow.prescribedRepsMax === 12 &&
      conditioningRow.restSeconds === 60,
    JSON.stringify(conditioningRow));
  ok('Mixed session conditioning rows are not in strength progression results',
    (result as any)._progressionResults?.['Assault Bike Intervals'] === undefined);
}

{
  const feedback = strengthFeedback({ date: '2026-07-06', feeling: 'very_hard', completion: 'full' });
  const result = applyStrengthProgression(makeMixedWorkout(), contextFromFeedback(feedback, '2026-07-13'));
  ok('Mixed session hard/bad feedback does not increase strength rows',
    (progressedSquatWeight(result) ?? 0) <= 100,
    String(progressedSquatWeight(result)));
  ok('Mixed session hard/bad feedback can reduce strength volume',
    (progressedSquatSets(result) ?? 0) <= 3,
    String(progressedSquatSets(result)));
}

{
  const feedbackMap = {
    '2026-07-06': strengthFeedback({ date: '2026-07-06', completion: 'skipped' }),
    '2026-07-07': strengthFeedback({ date: '2026-07-07', completion: 'skipped' }),
    '2026-07-13': strengthFeedback({ date: '2026-07-13', completion: 'skipped' }),
  };
  ok('missed session increases missedSessionsThisWeek',
    deriveMissedStrengthSessionsThisWeek(feedbackMap, '2026-07-09') === 2);
  ok('next week misses are not counted in current week',
    deriveMissedStrengthSessionsThisWeek(feedbackMap, '2026-07-09') !== 3);
}

{
  const ctx = {
    ...DEFAULT_PROGRESSION_CONTEXT,
    seasonPhase: 'Off-season' as const,
    readiness: 'high' as const,
    consecutiveBuildWeeks: 3,
    missedSessionsThisWeek: 2,
  };
  const result = applyStrengthProgression(makeWorkout(), ctx);
  ok('multiple missed sessions do not trigger catch-up overload',
    (result as any)._progressionResults?.['Back Squat']?.state === 'hold');
  ok('multiple missed sessions hold load steady', progressedSquatWeight(result) === 100);
}

{
  const result = applyStrengthProgression(makeWorkout(), contextFromFeedback(null, '2026-07-13'));
  ok('no feedback week keeps current baseline progression', progressedSquatWeight(result) === 102.5);
}

{
  const feedback = strengthFeedback({ date: '2026-07-06', feeling: 'easy', completion: 'full' });
  const result = applyStrengthProgression(makeWorkout(), contextFromFeedback(feedback, '2026-07-13'));
  const curl = result.exercises.find((exercise) => exercise.exercise?.name === 'Bicep Curl (Dumbbell)');
  ok('accessories do not get strict progression', curl?.prescribedWeightKg === 12);
  ok('accessories are not in progression results',
    (result as any)._progressionResults?.['Bicep Curl (Dumbbell)'] === undefined);
}

{
  const ctx = buildProgressionContext(
    'Off-season',
    'medium',
    [],
    '2026-07-27',
    [],
    {},
    [],
    null,
    [],
    null,
    {
      blockState: {
        blockNumber: 1,
        miniCycleNumber: 1,
        weekInBlock: 4,
        weekNumber: 4,
        blockStart: '2026-07-06',
        blockEnd: '2026-08-02',
        weekStart: '2026-07-27',
        weekEnd: '2026-08-02',
        intensityMultiplier: 1.0,
        weeksSinceDeload: 3,
        consecutiveBuildWeeks: 3,
      },
    },
  );
  ok('block state feeds consecutiveBuildWeeks', ctx.consecutiveBuildWeeks === 3);
}

{
  const providedHistory: LoggedWorkout[] = [{
    id: 'provided-history',
    userId: 'local',
    workoutId: 'workout-strength',
    loggedDate: '2026-07-06',
    completed: true,
    synced: true,
    sets: [1, 2, 3, 4].map((setNumber) => ({
      id: `provided-history-set-${setNumber}`,
      loggedWorkoutId: 'provided-history',
      workoutExerciseId: exerciseId('Back Squat'),
      setNumber,
      actualReps: 5,
      actualWeightKg: 100,
      createdAt: '2026-07-06T12:00:00.000Z',
      updatedAt: '2026-07-06T12:00:00.000Z',
    })),
    createdAt: '2026-07-06T12:00:00.000Z',
    updatedAt: '2026-07-06T12:00:00.000Z',
  }];
  const state: ScheduleState = {
    currentProgram: {
      id: 'program-1',
      userId: 'local',
      name: 'Program',
      description: '',
      programPhase: 'Base-Building',
      startDate: '2026-07-06',
      endDate: '2026-08-02',
      microcycles: [],
      createdAt: '2026-07-06T12:00:00.000Z',
      updatedAt: '2026-07-06T12:00:00.000Z',
    } as any,
    currentMicrocycle: {
      id: 'micro-1',
      programId: 'program-1',
      miniCycleNumber: 1,
      weekNumber: 2,
      startDate: '2026-07-13',
      endDate: '2026-07-19',
      workouts: [makeWorkout()],
      createdAt: '2026-07-06T12:00:00.000Z',
      updatedAt: '2026-07-06T12:00:00.000Z',
    },
    manualOverrides: {},
    markedDays: {},
    athleteContext: DEFAULT_ATHLETE_CONTEXT,
    seasonPhase: 'Off-season',
    readiness: 'medium',
    workoutHistory: providedHistory,
    sessionFeedback: {
      '2026-07-06': strengthFeedback({ date: '2026-07-06', feeling: 'easy', completion: 'full' }),
    },
    weightOverrides: {},
    blockState: { blockStartDate: '2026-07-06', blockNumber: 1 },
  };
  const week = resolveWeekWithConditioning('2026-07-13', state);
  const monday = week.find((day) => day.date === '2026-07-13')?.workout;
  ok('resolver uses real provided/feedback workout history',
    (progressedSquatWeight(monday as Workout) ?? 0) > 100);
}

console.log(`\nStrength progression input tests: ${pass} passed, ${fail} failed`);

if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
