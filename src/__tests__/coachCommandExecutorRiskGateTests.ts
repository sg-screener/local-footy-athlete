(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { executeCoachCommand } from '../utils/coachCommandExecutor';
import type { CoachCommand } from '../utils/coachCommandRouter';
import type { Workout, WorkoutExercise } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(label: string, condition: unknown, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL ${label}`);
    if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  ok(label, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function exercise(name: string): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return {
    id: `we-${slug}`,
    workoutId: 'workout',
    exerciseId: `ex-${slug}`,
    exerciseOrder: 0,
    prescribedSets: 4,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: 70,
    restSeconds: 120,
    exercise: {
      id: `ex-${slug}`,
      name,
      description: name,
      exerciseType: 'Compound' as any,
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as any,
      createdAt: '2026-07-06T00:00:00Z',
      updatedAt: '2026-07-06T00:00:00Z',
    } as any,
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  };
}

function workout(date: string, name: string, type: Workout['workoutType'], exercises: WorkoutExercise[] = []): Workout {
  return {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}`,
    microcycleId: 'test-microcycle',
    dayOfWeek: new Date(`${date}T12:00:00Z`).getUTCDay(),
    name,
    description: name,
    durationMinutes: type === 'Game' ? 90 : 60,
    intensity: 'High',
    workoutType: type,
    sessionTier: type === 'Game' ? 'game' : 'core',
    exercises,
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  } as Workout;
}

function lower(date: string): Workout {
  return workout(date, 'Lower Body Strength', 'Strength', [
    exercise('Back Squat'),
    exercise('RDL'),
  ]);
}

function game(date: string): Workout {
  return workout(date, 'Game Day', 'Game');
}

function day(date: string, work: Workout | null = null): any {
  return {
    date,
    dayOfWeek: new Date(`${date}T12:00:00Z`).getUTCDay(),
    short: date,
    isToday: false,
    source: work ? 'template' : 'none',
    workout: work,
  };
}

const visibleWeek = [
  day('2026-07-06'),
  day('2026-07-07'),
  day('2026-07-08'),
  day('2026-07-09', lower('2026-07-09')),
  day('2026-07-10'),
  day('2026-07-11', game('2026-07-11')),
  day('2026-07-12'),
];

console.log('coachCommandExecutorRiskGateTests');

console.log('\n[1] legacy add_session rejects G-1 hard lower before apply');
{
  let applyCalls = 0;
  const command: CoachCommand = {
    mode: 'mutate',
    operation: 'add_session',
    target: { kind: 'date', date: '2026-07-10' },
    payload: {
      operation: 'add_session',
      sourceDate: '2026-07-09',
      sourceSessionName: 'Lower Body Strength',
    },
    scope: 'one_off',
    confidence: 0.95,
    needsClarification: false,
    reason: 'test hard-stop risk gate',
  };
  const result = executeCoachCommand({
    command,
    todayISO: '2026-07-06',
    referenceResolution: null,
    userMessage: 'put lower body strength on Friday',
    addSessionDeps: {
      visibleWeek: () => visibleWeek,
      snapshotBefore: (date) => visibleWeek.find((candidate) => candidate.date === date)?.workout ?? null,
      snapshotAfter: (date) => visibleWeek.find((candidate) => candidate.date === date)?.workout ?? null,
      applyAdd: () => {
        applyCalls++;
        return { applied: true };
      },
    },
  });

  eq('result kind', result.kind, 'rejected');
  eq('route', result.route, 'risk_blocked:add_session');
  eq('applyAdd not called', applyCalls, 0);
  ok('reply mentions game proximity', /G-1|day before|game/i.test(result.reply), result.reply);
}

console.log('\nSummary');
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
