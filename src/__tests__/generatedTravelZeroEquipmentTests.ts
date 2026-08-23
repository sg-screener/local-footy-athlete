/**
 * R-018 / R-020 / R-083 / R-090 — travel and zero-equipment generation.
 *
 * This guard drives the production generator. Its central control removes an
 * ACHIEVABLE main-strength day after generation and requires the judge to turn
 * red: equipment may narrow the scheduler's selected set, but it may never
 * lower the target to whatever content happened to survive composition.
 *
 * Run: npm run test:travel-zero-equipment
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import { generatedWeekContractFrom } from '../rules/generatedWeekContract';
import { validateGeneratedWeek } from '../rules/validateGeneratedWeek';
import {
  composeTemporarySourceFactCompatibility,
  createTemporaryEquipmentFact,
  createTemporaryScheduleFact,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import type { Microcycle, Workout } from '../types/domain';

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
};
const DAYS: Record<number, string[]> = {
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

function build(overrides: Record<string, unknown>, options: Record<string, unknown> = {}) {
  return quietly(() => generateProgramLocally({ ...BASE, ...overrides } as never, {
    todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: 1, ...options,
  } as never));
}

function mainStrengthDays(week: Microcycle): number {
  return week.workouts.filter((workout) => (workout.exercises ?? []).some((row) =>
    row.section18Evidence?.role === 'main_strength')).length;
}

function kitGaps(week: Microcycle): string[] {
  return [...new Set(week.workouts.flatMap((workout) => workout.composedGaps ?? [])
    .filter((gap) => gap.cause === 'kit')
    .map((gap) => gap.slot))];
}

console.log('\n-- Permanent zero-equipment worlds --');
const bodyweightGame = build({
  seasonPhase: 'In-season', trainingDaysPerWeek: 4,
  preferredTrainingDays: DAYS[4], equipment: ['Bodyweight Only'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
}).microcycles[0];
const fullGymGame = build({
  seasonPhase: 'In-season', trainingDaysPerWeek: 4,
  preferredTrainingDays: DAYS[4], equipment: ['Full Gym'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
}).microcycles[0];
const bodyweightPreseason = build({
  seasonPhase: 'Pre-season', trainingDaysPerWeek: 5,
  preferredTrainingDays: DAYS[5], equipment: ['Bodyweight Only'],
  teamTrainingDays: [],
}).microcycles[0];

check('[1] the bodyweight game world publishes a real week', !!bodyweightGame);
check('[2] R-090 selects the two kit-achievable main-strength days',
  bodyweightGame.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget === 2
    && mainStrengthDays(bodyweightGame) === 2,
  `selected=${bodyweightGame.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget} `
    + `delivered=${mainStrengthDays(bodyweightGame)}`);
check('[3] R-083 keeps pull out of the required safe pattern set',
  !bodyweightGame.exposureContractV2?.strengthPatterns.requiredSafePatterns.includes('pull'));
check('[4] the missing pull capability remains typed on the stored week',
  kitGaps(bodyweightGame).includes('horizontal_pull')
    && kitGaps(bodyweightGame).includes('vertical_pull'),
  JSON.stringify(kitGaps(bodyweightGame)));
check('[5] the full-gym control still selects and delivers all three layout days',
  fullGymGame.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget === 3
    && mainStrengthDays(fullGymGame) === 3,
  `selected=${fullGymGame.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget} `
    + `delivered=${mainStrengthDays(fullGymGame)}`);
check('[6] the pre-season bodyweight world publishes its best achievable week',
  bodyweightPreseason.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget === 3
    && mainStrengthDays(bodyweightPreseason) === 3,
  `selected=${bodyweightPreseason.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget} `
    + `delivered=${mainStrengthDays(bodyweightPreseason)}`);

console.log('\n-- The selected target keeps its teeth --');
const contract = fullGymGame.exposureContractV2!;
const withoutAchievablePush = fullGymGame.workouts.map((workout): Workout => ({
  ...workout,
  exercises: (workout.exercises ?? []).filter((row) =>
    !(row.section18Evidence?.role === 'main_strength'
      && row.section18Evidence?.mainStrengthPattern === 'push')),
}));
const mutation = validateGeneratedWeek({
  workouts: withoutAchievablePush,
  contract: generatedWeekContractFrom(contract),
  declaredKitGaps: [],
  anchors: contract.anchors.map((anchor) => ({
    dayOfWeek: anchor.dayOfWeek,
    participation: 'normal_unrestricted',
    attended: true,
  })),
});
check('[7 MUTATION] removing an ACHIEVABLE push day is still refused',
  mutation.verdict === 'refused'
    && mutation.findings.some((finding) =>
      finding.clause === 'main_strength_planner_selected_target'),
  JSON.stringify(mutation.findings));

console.log('\n-- Travel plus zero equipment, through dated facts --');
const scope = temporaryFactScope({
  kind: 'window', from: '2026-07-13', until: '2026-07-19',
});
const travel = createTemporaryScheduleFact({
  observedDate: '2026-07-13', scope, scheduleKind: 'travel',
  unavailableDates: [], unavailableWeekdays: [], maxSessions: null,
  sourceActor: 'athlete', sourceSurface: 'away_this_week',
});
const noKit = createTemporaryEquipmentFact({
  observedDate: '2026-07-13', scope, mode: 'only', equipmentTags: [],
  conditioningModalities: [], sourceActor: 'athlete', sourceSurface: 'away_this_week',
});
const facts = [travel, noKit];
const compatibility = composeTemporarySourceFactCompatibility({
  temporarySourceFacts: facts,
  onDate: '2026-07-13',
});
const away = build({
  seasonPhase: 'In-season', trainingDaysPerWeek: 4,
  preferredTrainingDays: DAYS[4], equipment: ['Full Gym'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
}, {
  activeConstraints: compatibility.activeConstraints,
  temporarySourceFacts: facts,
}).microcycles[0];

check('[8] a full-gym athlete travelling with no kit still gets a week', !!away);
check('[9] travel removes the club and game anchors, not the athlete\'s work',
  away.workouts.every((workout) => workout.workoutType !== 'Team Training'
    && workout.workoutType !== 'Game')
    && mainStrengthDays(away) > 0,
  away.workouts.map((workout) => `${workout.dayOfWeek}:${workout.workoutType}`).join(', '));
check('[10] the dated zero-kit fact reaches composition and remains disclosed',
  kitGaps(away).length > 0,
  JSON.stringify(kitGaps(away)));

totalsPrinted(failures.length);
console.log(`\n[travel-zero-equipment] ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  throw new Error(failures.map((failure) => `  - ${failure}`).join('\n'));
}

export {};
