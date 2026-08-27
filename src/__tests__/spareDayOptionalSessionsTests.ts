/**
 * R-237 — SPARE CAPACITY BECOMES OPTIONAL HELP, NEVER REQUIRED QUOTA.
 *
 * Drives real generation across phase, gender and gym capacity. The gym answer
 * remains R-235's ceiling; this suite checks only what the finished week offers
 * after its optimal core has been built.
 *
 * Run: npm run test:spare-day-options
 */

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import { MOBILITY_POOL } from '../data/exercisePools';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import type { Microcycle, OnboardingData, Workout } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: unknown, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function quietly<T>(run: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  try { return run(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

const BASE = {
  gender: 'male',
  position: 'inside_mid',
  motivation: 'Build strength and football fitness',
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  equipmentSelectionCompleteness: 'complete',
  experienceLevel: 'Advanced',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
} as const;

function generate(overrides: Record<string, unknown>): Microcycle {
  const profile = { ...BASE, ...overrides } as unknown as OnboardingData;
  const program = quietly(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13',
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: profile.seasonPhase!,
      phaseEntryWeekStartISO: '2026-07-13',
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  }));
  const week = program.microcycles[0];
  if (!week) throw new Error('real generation returned no first microcycle');
  return week;
}

const workoutKind = (week: Microcycle, kind: string): Workout[] =>
  week.workouts.filter((workout) => workout.composedOptionalKind === kind);

const mobilityEquipment = new Map(MOBILITY_POOL.map((entry) => [
  canonicalExerciseName(entry.name), entry.equipment,
]));

function mobilityRowsRequireNoEquipment(workout: Workout): boolean {
  const rows = workout.exercises ?? [];
  return rows.length > 0 && rows.every((row) => {
    const name = canonicalExerciseName(row.exercise?.name ?? '');
    const requirements = mobilityEquipment.get(name);
    return !!requirements && requirements.every((requirement) =>
      Array.isArray(requirement)
        ? requirement.every((tag) => tag === 'bodyweight')
        : requirement === 'bodyweight');
  });
}

const inSeasonBase = {
  seasonPhase: 'In-season',
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  usualGameDay: 'Saturday',
  gameDay: 'Saturday',
};

console.log('\n-- R-237: the finished week uses spare capacity honestly --');

const maleFive = generate({
  ...inSeasonBase,
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
});
const maleFiveMobility = workoutKind(maleFive, 'mobility');
check('[1] five gym days remain a ceiling — the core is not inflated to five',
  (maleFive.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget ?? 99) < 5,
  `selected=${maleFive.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget}`);
check('[2] the spare in-season Wednesday offers optional Mobility',
  maleFiveMobility.some((workout) => workout.dayOfWeek === 3
    && workout.sessionTier === 'optional'),
  maleFive.workouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`).join(' | '));
check('[3] the male spare gym offer is Gunshow, never Primer',
  workoutKind(maleFive, 'gunshow').length === 1
    && workoutKind(maleFive, 'primer').length === 0);

const femaleFive = generate({
  ...inSeasonBase,
  gender: 'female',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
});
check('[4] the female spare gym offer is Primer, never Gunshow',
  workoutKind(femaleFive, 'primer').length === 1
    && workoutKind(femaleFive, 'gunshow').length === 0);

const maleThree = generate({
  ...inSeasonBase,
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
});
const maleThreeMobility = workoutKind(maleThree, 'mobility');
check('[5] a three-gym-day athlete still receives one equipment-free optional Mobility',
  maleThreeMobility.length === 1
    && maleThreeMobility[0].sessionTier === 'optional'
    && mobilityRowsRequireNoEquipment(maleThreeMobility[0]),
  maleThree.workouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`).join(' | '));
check('[6] equipment-free Mobility may use a spare day outside the gym-day answer',
  maleThreeMobility.length === 1
    && ![1, 3, 5].includes(maleThreeMobility[0].dayOfWeek),
  `mobilityDay=${maleThreeMobility[0]?.dayOfWeek}`);

const maleFour = generate({
  ...inSeasonBase,
  trainingDaysPerWeek: 4,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'],
});
check('[6a] four gym days keep the optimal core and both optional offers',
  (maleFour.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget ?? 99) <= 4
    && workoutKind(maleFour, 'gunshow').length === 1
    && workoutKind(maleFour, 'mobility').length === 1
    && workoutKind(maleFour, 'mobility').every(mobilityRowsRequireNoEquipment),
  maleFour.workouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`).join(' | '));

const maleSix = generate({
  ...inSeasonBase,
  trainingDaysPerWeek: 6,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
});
check('[6b] six gym days keep the optimal core and both optional offers',
  (maleSix.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget ?? 99) <= 6
    && workoutKind(maleSix, 'gunshow').length === 1
    && workoutKind(maleSix, 'mobility').length === 1
    && workoutKind(maleSix, 'mobility').every(mobilityRowsRequireNoEquipment),
  maleSix.workouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`).join(' | '));

const preSeason = generate({
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Monday', 'Wednesday'],
  usualGameDay: null,
  gameDay: null,
});
check('[7] Pre-season uses spare gym capacity for the gendered optional session',
  workoutKind(preSeason, 'gunshow').length === 1);
check('[8] Pre-season also offers equipment-free optional Mobility',
  workoutKind(preSeason, 'mobility').length >= 1
    && workoutKind(preSeason, 'mobility').every(mobilityRowsRequireNoEquipment));
const femalePreSeason = generate({
  seasonPhase: 'Pre-season',
  gender: 'female',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Monday', 'Wednesday'],
  usualGameDay: null,
  gameDay: null,
});
check('[8a] a no-game female spare gym offer is Primer, never Gunshow',
  workoutKind(femalePreSeason, 'primer').length === 1
    && workoutKind(femalePreSeason, 'gunshow').length === 0);

const offSeason = generate({
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  usualGameDay: null,
  gameDay: null,
});
check('[9] Off-season keeps its two-mobility target and gains one spare-gym Gunshow',
  workoutKind(offSeason, 'mobility').length === 2
    && workoutKind(offSeason, 'gunshow').length === 1,
  offSeason.workouts.map((workout) => `${workout.dayOfWeek}:${workout.name}`).join(' | '));

for (const [label, week] of [
  ['male five', maleFive], ['female five', femaleFive], ['male three', maleThree],
  ['male four', maleFour], ['male six', maleSix],
  ['pre-season', preSeason], ['female pre-season', femalePreSeason],
  ['off-season', offSeason],
] as const) {
  const days = week.workouts.map((workout) => workout.dayOfWeek);
  check(`[10 ${label}] optional offers replace Rest shells rather than double-booking a day`,
    new Set(days).size === days.length,
    days.join(','));
}

totalsPrinted(failures.length);
console.log(`\n[spare-day-options] ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  throw new Error(failures.map((failure) => `  - ${failure}`).join('\n'));
}

export {};
