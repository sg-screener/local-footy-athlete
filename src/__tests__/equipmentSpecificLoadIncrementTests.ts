/** R-313 — automatic load changes follow the exercise's typed implement. */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — equipment load boundary is local');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  applyStrengthProgression,
  DEFAULT_PROGRESSION_CONTEXT,
} from '../utils/strengthProgressionIntegration';
import type { Workout, WorkoutExercise } from '../types/domain';
import {
  automaticLoadKindForExercise,
} from '../utils/loadEstimation';
import { isAutomaticLoadRung } from '../data/equipmentLattice';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import {
  coldStartThroughOnboarding,
  quiet,
  quietAsync,
  relaunchApp,
} from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function ok(name: string, value: unknown, detail?: unknown): void {
  if (value) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}`, detail ?? '');
}

function row(name: string, weight: number, order: number): WorkoutExercise {
  const timestamp = '2026-09-28T00:00:00.000Z';
  return {
    id: `row-${order}`, workoutId: 'load-week', exerciseId: `exercise-${order}`,
    exerciseOrder: order, prescribedSets: 3, prescribedRepsMin: 5,
    prescribedRepsMax: 5, prescribedWeightKg: weight, restSeconds: 120,
    exercise: {
      id: `exercise-${order}`, name, description: 'Typed load progression witness.',
      muscleGroups: [], exerciseType: 'Compound', equipmentRequired: [],
      difficultyLevel: 'Intermediate', createdAt: timestamp, updatedAt: timestamp,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const workout = (name: string, weight: number): Workout => ({
  id: `workout-${name}`, microcycleId: 'microcycle-load', dayOfWeek: 1,
  name: 'Load increment witness', description: 'Typed implement increment witness.',
  workoutType: 'Strength', intensity: 'High', durationMinutes: 45,
  exercises: [row(name, weight, 0)],
  createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z',
});

function progressed(name: string, weight: number): number | undefined {
  return applyStrengthProgression(
    workout(name, weight),
    DEFAULT_PROGRESSION_CONTEXT,
  ).exercises[0]?.prescribedWeightKg;
}

async function main(): Promise<void> {
console.log('\nR-313 — equipment-specific automatic load increments\n');

ok('barbell progression uses the next 2.5 kg total-load rung',
  progressed('Back Squat', 100) === 102.5,
  progressed('Back Squat', 100));
ok('dumbbell progression uses the next per-hand rung',
  progressed('DB Bench Press', 10) === 12.5,
  progressed('DB Bench Press', 10));
ok('a fixed kettlebell progresses from 24 kg to the real 28 kg bell',
  progressed('Kettlebell Swings', 24) === 28,
  progressed('Kettlebell Swings', 24));
ok('machine progression uses its authored stack/plate rung',
  progressed('Leg Press', 100) === 102.5,
  progressed('Leg Press', 100));
ok('weighted bodyweight progression uses a suitable external-load rung',
  progressed('Pull-Ups', 12.5) === 15,
  progressed('Pull-Ups', 12.5));
ok('an off-lattice fixed kettlebell base advances to the next real bell, not base plus four',
  progressed('Kettlebell Swings', 26.5) === 28,
  progressed('Kettlebell Swings', 26.5));

localStorageData.clear();
const base = athleteAnswers(ARCHETYPES.find(entry =>
  entry.id === 'male-3-experienced-gym')!);
const profile: import('../types/domain').OnboardingData = {
  ...base,
  seasonPhase: 'Pre-season' as const,
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  usualGameDay: undefined,
  gameDay: undefined,
  recentTrainingLoad: 'Very consistent' as const,
};
const install = await coldStartThroughOnboarding({ profile, installDayISO: '2026-09-28' });
const visible = () => quiet(() => deriveVisibleWeekLive(
  install.blockOneStart, '2026-09-28'));
const visibleLoadedRows = () => visible().flatMap(day =>
  (day.workout?.exercises ?? []).map(row => ({ date: day.date, row })))
  .filter(({ row }) => (row.prescribedWeightKg ?? 0) > 0);
const typedVisible = visibleLoadedRows().map(({ date, row }) => {
  const name = row.exercise?.name ?? '';
  const kind = automaticLoadKindForExercise(name);
  return { date, name, kg: row.prescribedWeightKg ?? 0, kind,
    valid: kind ? isAutomaticLoadRung(row.prescribedWeightKg ?? 0, kind) : true };
});
ok('[live non-vacuity] a real cold-generated visible week reaches typed loaded rows',
  typedVisible.some(item => item.kind !== null), typedVisible);
ok('every app-authored visible load is an actual rung for its typed implement',
  typedVisible.every(item => item.valid), typedVisible.filter(item => !item.valid));
const beforeRestart = JSON.stringify(visibleLoadedRows());
const restart = await quietAsync(() => relaunchApp({
  storage: localStorageData, todayISO: '2026-09-28',
}));
ok('durable save and cold restart preserve the exact visible load prescriptions',
  restart.ok && JSON.stringify(visibleLoadedRows()) === beforeRestart,
  { restart, beforeRestart, after: visibleLoadedRows() });

const total = passed + failures.length;
console.log(`\nEquipment-specific load increments: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('FAILURES:', failures.join(', '));
  process.exitCode = 1;
}
}

void main().catch(error => {
  failures.push(String(error));
  console.error(error);
  totalsPrinted(failures.length);
  process.exitCode = 1;
});
