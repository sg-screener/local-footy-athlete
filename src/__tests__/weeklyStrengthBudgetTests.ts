/**
 * R-317 — automatic strength programming spends each weekly main seat once.
 *
 * This drives the real generator. It judges final typed rows, not exercise
 * names, except for the four athlete-selected tracked lifts whose identity is
 * itself the subject of the ruling.
 *
 * Run: npm run test:weekly-strength-budget
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { generateProgramLocally } from '../services/api/generateProgram';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import type { OnboardingData, SeasonPhase, TrainingProgram, Workout } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const DAYS: Readonly<Record<number, readonly string[]>> = {
  2: ['Monday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sunday'],
};

function athlete(args: {
  gender: 'male' | 'female';
  phase: SeasonPhase;
  gymDays: number;
  club: boolean;
}): OnboardingData {
  return {
    gender: args.gender,
    seasonPhase: args.phase,
    gameDay: args.phase === 'Off-season' ? undefined : 'Saturday',
    trainingDaysPerWeek: args.gymDays,
    preferredTrainingDays: [...DAYS[args.gymDays]],
    teamTrainingDaysPerWeek: args.club && args.phase !== 'Off-season' ? 2 : 0,
    teamTrainingDays: args.club && args.phase !== 'Off-season'
      ? ['Tuesday', 'Thursday'] : [],
    equipmentAnswer: presetEquipmentAnswer('commercial_gym'),
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '2-5 years',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    weightKg: args.gender === 'female' ? 65 : 85,
  } as unknown as OnboardingData;
}

const WEEKLY_MAIN_SLOTS = new Set([
  'squat', 'hinge',
  'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
]);

function evidence(row: Workout['exercises'][number]): {
  readonly role?: string;
  readonly slot?: string | null;
} {
  return row.section18Evidence ?? {};
}

function currentName(row: Workout['exercises'][number]): string {
  return String(row.exercise?.name ?? '');
}

function weekPrograms(program: TrainingProgram): readonly Workout[][] {
  return program.microcycles.map((week) => week.workouts);
}

interface World {
  readonly id: string;
  readonly program: TrainingProgram;
}

const worlds: World[] = [];
for (const phase of ['In-season', 'Pre-season', 'Off-season'] as const) {
  for (const gymDays of [2, 3, 4, 5, 6]) {
    for (const gender of ['male', 'female'] as const) {
      for (const club of phase === 'Off-season' ? [false] : [false, true]) {
        const id = `${gender}/${phase}/${gymDays}d/${club ? 'club' : 'noclub'}`;
        const program = quiet(() => generateProgramLocally(
          athlete({ gender, phase, gymDays, club }),
          {
            todayISO: '2026-08-03',
            blockNumber: 1,
            selectionHistory: [],
            recordSelections: false,
          },
        ));
        worlds.push({ id, program });
      }
    }
  }
}

run('the real 2–6 day matrix generated all 50 profile worlds', () => {
  assert(worlds.length === 50, `expected 50 worlds, got ${worlds.length}`);
  assert(worlds.every((world) => world.program.microcycles.length > 0),
    `empty programmes: ${worlds.filter((world) => world.program.microcycles.length === 0)
      .map((world) => world.id).join(', ')}`);
});

run('each automatic weekly main squat, hinge, push plane and pull plane is spent at most once', () => {
  const breaches: string[] = [];
  for (const world of worlds) {
    for (const [weekIndex, workouts] of weekPrograms(world.program).entries()) {
      const counts = new Map<string, number>();
      for (const row of workouts.flatMap((workout) => workout.exercises ?? [])) {
        const typed = evidence(row);
        if (typed.role !== 'main_strength' || !typed.slot || !WEEKLY_MAIN_SLOTS.has(typed.slot)) continue;
        counts.set(typed.slot, (counts.get(typed.slot) ?? 0) + 1);
      }
      for (const [slot, count] of counts) {
        if (count > 1) breaches.push(`${world.id}/week${weekIndex + 1}/${slot}:${count}`);
      }
    }
  }
  assert(breaches.length === 0,
    `${breaches.length} automatic weekly main-seat breaches:\n${breaches.slice(0, 40).join('\n')}`);
});

run('separate Lower Squat and Lower Hinge days keep their bilateral purposes separate', () => {
  const breaches: string[] = [];
  let separateWeeks = 0;
  for (const world of worlds) {
    for (const [weekIndex, workouts] of weekPrograms(world.program).entries()) {
      const squatDays = workouts.filter((workout) => {
        const patterns = workout.strengthIntent?.plannedPatterns ?? [];
        return workout.strengthIntent?.primaryPattern === 'squat'
          && patterns.includes('squat') && !patterns.includes('hinge');
      });
      const hingeDays = workouts.filter((workout) => {
        const patterns = workout.strengthIntent?.plannedPatterns ?? [];
        return workout.strengthIntent?.primaryPattern === 'hinge'
          && patterns.includes('hinge') && !patterns.includes('squat');
      });
      if (squatDays.length === 0 || hingeDays.length === 0) continue;
      separateWeeks += 1;
      for (const workout of squatDays) {
        const rows = (workout.exercises ?? []).filter((row) => evidence(row).slot === 'hinge');
        if (rows.length > 0) breaches.push(`${world.id}/week${weekIndex + 1}/${workout.name}: ${rows.map(currentName).join(', ')}`);
      }
      for (const workout of hingeDays) {
        const rows = (workout.exercises ?? []).filter((row) => evidence(row).slot === 'squat');
        if (rows.length > 0) breaches.push(`${world.id}/week${weekIndex + 1}/${workout.name}: ${rows.map(currentName).join(', ')}`);
      }
    }
  }
  assert(separateWeeks > 0, 'the matrix reached no separate lower weeks');
  assert(breaches.length === 0,
    `${breaches.length} dedicated-lower purpose breaches across ${separateWeeks} athlete-weeks:\n`
      + breaches.slice(0, 40).join('\n'));
});

run('tracked main lifts are not copied into a second automatic weekly seat', () => {
  const TRACKED = new Set(['Bench Press', 'Back Squat', 'RDLs', 'Pull-Ups']);
  const breaches: string[] = [];
  for (const world of worlds) {
    for (const [weekIndex, workouts] of weekPrograms(world.program).entries()) {
      const counts = new Map<string, number>();
      for (const row of workouts.flatMap((workout) => workout.exercises ?? [])) {
        const name = currentName(row);
        if (TRACKED.has(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      for (const [name, count] of counts) {
        if (count > 1) breaches.push(`${world.id}/week${weekIndex + 1}/${name}:${count}`);
      }
    }
  }
  assert(breaches.length === 0,
    `${breaches.length} repeated tracked lifts:\n${breaches.slice(0, 40).join('\n')}`);
});

run('two-day weeks consolidate coverage without giant strength sessions', () => {
  const twoDay = worlds.filter((world) => world.id.includes('/2d/'));
  assert(twoDay.length === 10, `expected 10 two-day worlds, got ${twoDay.length}`);
  const failuresHere: string[] = [];
  for (const world of twoDay) {
    const workouts = world.program.microcycles[0]?.workouts ?? [];
    const mainSlots = new Set(workouts.flatMap((workout) => workout.exercises ?? [])
      .filter((row) => evidence(row).role === 'main_strength')
      .map((row) => evidence(row).slot)
      .filter((slot): slot is string => !!slot && WEEKLY_MAIN_SLOTS.has(slot)));
    const giant = workouts.filter((workout) => (workout.exercises ?? [])
      .filter((row) => evidence(row).role === 'main_strength' || evidence(row).role === 'strength_accessory')
      .length > 7);
    if (mainSlots.size < 6 || giant.length > 0) {
      failuresHere.push(`${world.id}: main=[${[...mainSlots].join(',')}], giant=${giant.map((w) => w.name).join(',')}`);
    }
  }
  assert(failuresHere.length === 0, failuresHere.join('\n'));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
