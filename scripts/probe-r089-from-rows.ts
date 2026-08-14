/**
 * R-089 MEASURED FROM THE ROWS, NOT FROM THE DAY'S NAME.
 *
 * `ladderCoverageWideCensusTests` counts a week's squat/hinge exposures out of
 * `coverage.filled`, which is computed against `SLOTS_FOR_KIND[kind]` where
 * `kind` is inferred from `workout.name`. A hinge row on a day whose NAME says
 * "upper" is therefore invisible to that counter — the slot is not in the upper
 * ladder, so nothing assigns the row and nothing increments the hinge.
 *
 * R-089 is a property of the WEEK'S CONTENT. This counts it twice, from two
 * independent sources, and prints both beside the census's own answer:
 *
 *   1. THE COMPOSER'S DECLARATION — `ComposedRow.slot`, captured at the seam.
 *      This is what the composer says it built.
 *   2. THE MATERIALISED ROWS — `slotsForExerciseName` over every strength row in
 *      the week, ignoring day names and day ladders entirely.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as composeWeekModule from '../src/rules/composeWeek';

/** week -> slot -> count, as the COMPOSER declared it. */
let declaredSlotCounts: Record<string, number> = {};
const realCompose = composeWeekModule.composeWeek;
(composeWeekModule as any).composeWeek = function wrapped(inputs: any) {
  const composed = realCompose(inputs);
  declaredSlotCounts = {};
  for (const day of composed.days) {
    for (const row of day.rows) {
      declaredSlotCounts[row.slot] = (declaredSlotCounts[row.slot] ?? 0) + 1;
    }
  }
  return composed;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const coverage = require('../src/rules/sessionSlotCoverage');
const { slotsForExerciseName, sessionSlotCoverage, slotDayKindFor } = coverage;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEquipmentCapabilities } = require('../src/utils/equipmentAvailability');

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
};
const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'],
  3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KITS: string[][] = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];

const PAIRS = ['squat', 'hinge', 'single_leg_knee', 'single_leg_hip'];

let censusUnmatched = 0;
let declaredUnmatched = 0;
let rowsUnmatched = 0;
const disagreements: string[] = [];

for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const trainingDaysPerWeek of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const equipment of KITS) {
        for (const week of [1, 2]) {
          const preferredTrainingDays = DAYS[trainingDaysPerWeek];
          const profile = {
            ...BASE,
            seasonPhase,
            trainingDaysPerWeek,
            preferredTrainingDays,
            equipment,
            teamTrainingDays: club
              ? ['Tuesday', 'Thursday'].filter((day) => preferredTrainingDays.includes(day))
              : [],
          };
          declaredSlotCounts = {};
          let program: any;
          try {
            program = generateProgramLocally(profile, {
              todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
            });
          } catch { continue; }
          const label = `${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}`
            + `/${equipment[0]}/w${week}`;
          const kit = resolveEquipmentCapabilities(profile as any).tags;
          const declared = { ...declaredSlotCounts };

          // (1) the census's own counting, reproduced exactly
          const censusPairs: Record<string, number> = {
            squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0 };
          // (2) from every strength row in the week, day names ignored
          const rowPairs: Record<string, number> = {
            squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0 };
          for (const workout of (program?.microcycles?.[week - 1]?.workouts ?? [])) {
            const kind = slotDayKindFor(String(workout.name ?? ''));
            if (kind) {
              const cov = sessionSlotCoverage(workout.exercises ?? [], kind, kit);
              for (const slot of cov.filled) {
                if (slot in censusPairs) censusPairs[slot] += 1;
              }
            }
            for (const row of (workout.exercises ?? [])) {
              const evidence = (row as any).section18Evidence;
              if (!evidence || evidence.provenance !== 'composer_declaration') continue;
              const name = String((row as any).exercise?.name ?? '');
              const slots: string[] = slotsForExerciseName(name) ?? [];
              // A row is spent on ONE pair slot, so a lift filling two is not
              // counted twice. First pair slot in the authored order wins.
              const hit = PAIRS.find((slot) => slots.includes(slot));
              if (hit) rowPairs[hit] += 1;
            }
          }
          const cU = censusPairs.squat > censusPairs.hinge;
          const dU = (declared.squat ?? 0) > (declared.hinge ?? 0);
          const rU = rowPairs.squat > rowPairs.hinge;
          if (cU) censusUnmatched += 1;
          if (dU) declaredUnmatched += 1;
          if (rU) rowsUnmatched += 1;
          if (cU !== rU || cU !== dU) {
            disagreements.push(
              `${label}\n      census   sq${censusPairs.squat}/hi${censusPairs.hinge} `
              + `slk${censusPairs.single_leg_knee}/slh${censusPairs.single_leg_hip}`
              + `\n      declared sq${declared.squat ?? 0}/hi${declared.hinge ?? 0} `
              + `slk${declared.single_leg_knee ?? 0}/slh${declared.single_leg_hip ?? 0}`
              + `\n      rows     sq${rowPairs.squat}/hi${rowPairs.hinge} `
              + `slk${rowPairs.single_leg_knee}/slh${rowPairs.single_leg_hip}`);
          }
        }
      }
    }
  }
}

console.log('\nR-089 UNMATCHED-SQUAT WEEKS, COUNTED THREE WAYS');
console.log(`  as the census counts it (day NAME -> ladder -> filled): ${censusUnmatched}`);
console.log(`  from the COMPOSER'S declared row slots:                 ${declaredUnmatched}`);
console.log(`  from the MATERIALISED rows, names ignored:              ${rowsUnmatched}`);
console.log(`\nWORLDS WHERE THE THREE DISAGREE: ${disagreements.length}`);
for (const d of disagreements) console.log(`  ${d}`);
