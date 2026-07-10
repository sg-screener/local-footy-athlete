(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import {
  assessProgramEditWrites,
  guardProgramEditWritesForHardStops,
} from '../utils/programEditWriteGuard';
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

function exercise(name: string, sets = 4, reps = 6): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return {
    id: `we-${slug}`,
    workoutId: 'workout',
    exerciseId: `ex-${slug}`,
    exerciseOrder: 0,
    prescribedSets: sets,
    prescribedRepsMin: reps,
    prescribedRepsMax: reps,
    prescribedWeightKg: 60,
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
    durationMinutes: type === 'Recovery' ? 20 : 60,
    intensity: type === 'Recovery' ? 'Light' : 'High',
    workoutType: type,
    sessionTier: type === 'Game' ? 'game' : type === 'Recovery' ? 'recovery' : 'core',
    exercises,
    createdAt: '2026-07-06T00:00:00Z',
    updatedAt: '2026-07-06T00:00:00Z',
  } as Workout;
}

function lower(date: string): Workout {
  return workout(date, 'Lower Body Strength', 'Strength', [
    exercise('Back Squat', 4, 5),
    exercise('RDL', 4, 6),
  ]);
}

function upper(date: string): Workout {
  return workout(date, 'Upper Body Strength', 'Strength', [
    exercise('Bench Press', 3, 6),
  ]);
}

function recovery(date: string): Workout {
  return workout(date, 'Recovery', 'Recovery');
}

function game(date: string): Workout {
  return workout(date, 'Game Day', 'Game');
}

function teamTraining(date: string): Workout {
  return {
    ...workout(date, 'Team Training', 'Team Training' as Workout['workoutType']),
    isTeamDay: true,
  } as Workout;
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

function week(startISO: string, workouts: Record<number, Workout | null>): any[] {
  const start = new Date(`${startISO}T12:00:00Z`);
  const out: any[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    out.push(day(iso, workouts[offset] ?? null));
  }
  return out;
}

console.log('programEditWriteGuardTests');

console.log('\n[1] G-1 hard lower write is blocked before write');
{
  const current = week('2026-07-06', {
    4: upper('2026-07-10'),
    5: game('2026-07-11'),
    6: recovery('2026-07-12'),
  });
  const result = guardProgramEditWritesForHardStops({
    visibleWeek: current,
    todayISO: '2026-07-06',
    writes: [{ date: '2026-07-10', workout: lower('2026-07-10') }],
  });

  eq('blocks G-1 hard lower', result.ok, false);
  ok('reports g1 hard-work rule',
    !result.ok && result.assessment.findings.some((finding) => finding.ruleId === 'g1_hard_work'),
    result);
}

console.log('\n[2] unchanged existing G-1 finding is not surfaced');
{
  const current = week('2026-07-06', {
    4: lower('2026-07-10'),
    5: game('2026-07-11'),
  });
  const assessment = assessProgramEditWrites({
    visibleWeek: current,
    todayISO: '2026-07-06',
    writes: [{ date: '2026-07-10', workout: lower('2026-07-10') }],
  });

  eq('unchanged hard-stop noise allows', assessment?.decision, 'allow');
  eq('no findings surfaced', assessment?.findings, []);
}

console.log('\n[3] protected anchors cannot be removed through normal write guard');
{
  const current = week('2026-07-06', {
    1: teamTraining('2026-07-07'),
    5: game('2026-07-11'),
  });
  const teamResult = guardProgramEditWritesForHardStops({
    visibleWeek: current,
    todayISO: '2026-07-06',
    writes: [{ date: '2026-07-07', workout: null }],
  });
  const gameResult = guardProgramEditWritesForHardStops({
    visibleWeek: current,
    todayISO: '2026-07-06',
    writes: [{ date: '2026-07-11', workout: null }],
  });

  ok('team anchor removal blocks',
    !teamResult.ok && teamResult.assessment.findings.some((finding) => finding.ruleId === 'protected_team_training_anchor_removed'),
    teamResult);
  ok('game anchor removal blocks',
    !gameResult.ok && gameResult.assessment.findings.some((finding) => finding.ruleId === 'protected_game_anchor_removed'),
    gameResult);
}

console.log('\n[4] cross-week Monday game protects previous Sunday');
{
  const currentWeek = week('2026-07-06', {
    6: recovery('2026-07-12'),
  });
  const nextWeek = week('2026-07-13', {
    0: game('2026-07-13'),
  });
  const result = guardProgramEditWritesForHardStops({
    visibleWeek: [...currentWeek, ...nextWeek],
    todayISO: '2026-07-06',
    writes: [{ date: '2026-07-12', workout: lower('2026-07-12') }],
  });

  eq('blocks Sunday hard lower before Monday game', result.ok, false);
  ok('finding names G-1',
    !result.ok && result.assessment.findings.some((finding) => finding.ruleId === 'g1_hard_work'),
    result);
}

console.log('\n[5] active severe injury constraint blocks normal program writes');
{
  const current = week('2026-07-06', {
    0: upper('2026-07-06'),
  });
  const result = guardProgramEditWritesForHardStops({
    visibleWeek: current,
    todayISO: '2026-07-06',
    writes: [{ date: '2026-07-06', workout: lower('2026-07-06') }],
    activeConstraints: [{
      id: 'injury-hard-stop',
      type: 'injury',
      bodyPart: 'Chest',
      severity: 9,
      status: 'active',
      startDate: '2026-07-06',
      lastUpdatedAt: '2026-07-06T08:00:00Z',
      adjustmentLevel: 'training_paused',
      seriousSymptoms: true,
      source: 'chat',
      rules: ['stop training'],
      safeFocus: [],
      advice: [],
      modifierAffects: ['current_week'],
    } as any],
  });

  ok('severe injury hard-stop blocks',
    !result.ok && result.assessment.findings.some((finding) => finding.ruleId === 'active_injury_hard_stop'),
    result);
}

console.log('\n[6] user-facing write-path sources import/use the hard-stop guard');
{
  const root = process.cwd();
  const expectations: Array<{ rel: string; pattern: RegExp; label: string }> = [
    {
      rel: 'src/utils/programControlActions.ts',
      pattern: /previewPlanChangeRisk/,
      label: 'routes plan changes through preview risk before apply',
    },
    {
      rel: 'src/utils/coachActions.ts',
      pattern: /programEditWriteGuard/,
      label: 'uses hard-stop write guard',
    },
    {
      rel: 'src/utils/coachCommandExecutor.ts',
      pattern: /programEditWriteGuard/,
      label: 'uses hard-stop write guard',
    },
    {
      rel: 'src/utils/planChangeProducer.ts',
      pattern: /programEditWriteGuard/,
      label: 'plan-change preview uses shared write guard',
    },
    {
      rel: 'src/utils/coachTurnController.ts',
      pattern: /programEditWriteGuard/,
      label: 'coach revision gate uses shared write guard',
    },
  ];
  for (const { rel, pattern, label } of expectations) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    ok(`${rel} ${label}`, pattern.test(src), rel);
  }
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
