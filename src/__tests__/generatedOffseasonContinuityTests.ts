/**
 * Off-season continuity: dormant club answers stay dormant and weeks 3–4 are
 * judged by the mid-Off-season contract the scheduler used to author them.
 *
 * Run: npm run test:offseason-generation-continuity
 */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import type { Microcycle } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: unknown, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function quietly<T>(run: () => T): T {
  const log = console.log; const warn = console.warn;
  console.log = () => undefined; console.warn = () => undefined;
  try { return run(); } finally { console.log = log; console.warn = warn; }
}

const BASE = {
  // R-130: refused at the generation door with no default; male ≙ pre-R-130.
  gender: 'male',
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
  seasonPhase: 'Off-season',
};

function build(overrides: Record<string, unknown>) {
  return quietly(() => generateProgramLocally({ ...BASE, ...overrides } as never, {
    todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 2,
  } as never));
}

function mainStrengthDays(week: Microcycle): number {
  return week.workouts.filter((workout) => (workout.exercises ?? []).some((row) =>
    (row.section18Evidence?.role === 'main_strength'
      || row.section18Evidence?.role === 'strength_accessory')
    && slotCountsTowardSetBudget(row.section18Evidence?.slot))).length;
}

function snapshot(week: Microcycle): string {
  const contract = week.exposureContractV2;
  return `phaseWeek=${contract?.identity.phaseWeek} mode=${contract?.identity.mode} `
    + `selected=${contract?.mainStrength.exposure.plannerSelectedTarget} `
    + `optional=${contract?.mainStrength.optionalMainStrengthSelected} `
    + `max=${contract?.mainStrength.exposure.permittedMaximum} `
    + `delivered=${mainStrengthDays(week)}`;
}

console.log('\n-- One continuous first Off-season block --');
const standingClubProfile = build({
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  equipment: ['Full Gym'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
});
const weeks = standingClubProfile.microcycles;

check('[1] the formerly-refused five-day profile publishes all four weeks',
  weeks.length === 4, `weeks=${weeks.length}`);
check('[2] R-079 leaves standing club/game answers dormant throughout Off-season',
  weeks.every((week) => week.workouts.every((workout) =>
    workout.workoutType !== 'Team Training' && workout.workoutType !== 'Game')),
  weeks.flatMap((week) => week.workouts)
    .map((workout) => `${workout.dayOfWeek}:${workout.workoutType}`).join(', '));
check('[3] every contract records zero Off-season anchors',
  weeks.every((week) => (week.exposureContractV2?.anchors ?? []).length === 0));
check('[4] the phase clock advances continuously across the generated block',
  weeks.map((week) => week.exposureContractV2?.identity.phaseWeek).join(',') === '1,2,3,4',
  weeks.map(snapshot).join(' | '));
check('[5] weeks 1–2 use the early-Off-season three-session ceiling',
  weeks.slice(0, 2).every((week) =>
    week.exposureContractV2?.identity.mode === 'early_offseason'
      && week.exposureContractV2.mainStrength.exposure.permittedMaximum === 3
      && week.exposureContractV2.mainStrength.optionalMainStrengthSelected === 3
      && mainStrengthDays(week) === 3),
  weeks.slice(0, 2).map(snapshot).join(' | '));
check('[6] weeks 3–4 use the mid-Off-season four-session contract',
  weeks.slice(2).every((week) =>
    week.exposureContractV2?.identity.mode === 'mid_offseason'
      && week.exposureContractV2.mainStrength.exposure.permittedMaximum === 4
      && week.exposureContractV2.mainStrength.exposure.plannerSelectedTarget === 4
      && mainStrengthDays(week) === 4),
  weeks.slice(2).map(snapshot).join(' | '));

console.log('\n-- Availability and equipment controls --');
const threeDays = build({
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  equipment: ['Full Gym'], teamTrainingDays: [],
}).microcycles;
check('[7] mid Off-season scales honestly to three available days',
  threeDays.slice(2).every((week) =>
    week.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget === 3
      && mainStrengthDays(week) === 3),
  threeDays.slice(2).map(snapshot).join(' | '));

const bodyweight = build({
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  equipment: ['Bodyweight Only'], teamTrainingDays: ['Tuesday', 'Thursday'],
}).microcycles;
check('[8] the same continuous block publishes for a bodyweight athlete',
  bodyweight.length === 4);
check('[9] equipment narrows selection without reverting the week identity',
  bodyweight.slice(2).every((week) =>
    week.exposureContractV2?.identity.mode === 'mid_offseason'
      && week.exposureContractV2.mainStrength.exposure.permittedMaximum === 4
      && week.exposureContractV2.mainStrength.exposure.plannerSelectedTarget
        === mainStrengthDays(week)),
  bodyweight.slice(2).map(snapshot).join(' | '));

totalsPrinted(failures.length);
console.log(`\n[offseason-generation-continuity] ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  throw new Error(failures.map((failure) => `  - ${failure}`).join('\n'));
}

export {};
