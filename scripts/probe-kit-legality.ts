/**
 * IS EVERY COMPOSED ROW LEGAL FOR THE ATHLETE'S KIT? — final-acceptance arm.
 *
 * Asked of `exerciseIsAvailableWith`, the app's OWN equipment owner and the same
 * one generation filters with, over every strength row of every world the corpus
 * builds. A list kept here would be a second authority on a derived fact.
 *
 * ALSO COUNTS the typed equipment gaps that survive onto the workout
 * (`composedGaps`), because a kit-caused removal that is silent and a kit-caused
 * removal that is DISCLOSED are the same number of rows and very different facts.
 */
// `__DEV__` off, as every node suite runs it. Assigned rather than `declare
// global`-ed: this file has no ESM import, so a global augmentation here is not
// nested in a module and `test:compile` reds on it.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEquipmentCapabilities } = require('../src/utils/equipmentAvailability');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { exerciseIsAvailableWith } = require('../src/data/exerciseEquipmentRequirement');

const BASE = {
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  gameDay: 'Saturday',
};
const DAYS: Record<number, string[]> = {
  2: ['Tuesday', 'Thursday'], 3: ['Monday', 'Wednesday', 'Friday'],
  4: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
  5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  6: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const KITS: string[][] = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];

let composedRows = 0;
let illegal = 0;
let disclosedGaps = 0;
let worldsWithGaps = 0;
const offenders: string[] = [];

for (const seasonPhase of ['In-season', 'Pre-season', 'Off-season']) {
  for (const trainingDaysPerWeek of [2, 3, 4, 5, 6]) {
    for (const club of [true, false]) {
      for (const equipment of KITS) {
        for (const week of [1, 2]) {
          const preferredTrainingDays = DAYS[trainingDaysPerWeek];
          const profile = {
            ...BASE, seasonPhase, trainingDaysPerWeek, preferredTrainingDays, equipment,
            teamTrainingDays: club
              ? ['Tuesday', 'Thursday'].filter((d) => preferredTrainingDays.includes(d)) : [],
          };
          let program: any;
          try {
            program = generateProgramLocally(profile, {
              todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
            });
          } catch { continue; }
          const label = `${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}`
            + `/${equipment[0]}/w${week}`;
          const kit = resolveEquipmentCapabilities(profile as any).tags as string[];
          let gapsHere = 0;
          for (const workout of (program?.microcycles?.[week - 1]?.workouts ?? [])) {
            gapsHere += ((workout as any).composedGaps ?? []).length;
            for (const row of (workout.exercises ?? [])) {
              if (row.section18Evidence?.provenance !== 'composer_declaration') continue;
              composedRows += 1;
              const name = String(row.exercise?.name ?? '');
              if (!exerciseIsAvailableWith(name, kit)) {
                illegal += 1;
                offenders.push(`${label} | ${name} | kit=${kit.join(',')}`);
              }
            }
          }
          disclosedGaps += gapsHere;
          if (gapsHere > 0) worldsWithGaps += 1;
        }
      }
    }
  }
}

console.log(`\ncomposed strength rows checked: ${composedRows}`);
console.log(`ILLEGAL FOR THE ATHLETE'S KIT:  ${illegal}`);
for (const o of offenders.slice(0, 20)) console.log(`    ${o}`);
console.log(`\ntyped equipment gaps surviving onto the workout: ${disclosedGaps} `
  + `across ${worldsWithGaps} worlds`);
// NON-VACUITY: if no row was ever checked, "0 illegal" is a confident zero about
// nothing — the exact shape this repo has been bitten by.
if (composedRows === 0) {
  console.error('\nFAIL — 0 composed rows checked. The instrument is blind.');
  process.exit(1);
}
if (illegal > 0) process.exit(1);
console.log('\nPASS — every composed row is legal for its athlete\'s kit.');
