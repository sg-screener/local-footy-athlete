/**
 * HOW MANY DEFICIENT DAYS ARE A COMPOSED FULL-BODY DAY WEARING THE PLANNER'S
 * OLD NAME? Same corpus, same oracle — but the composer's own declared `kind`
 * is captured at the seam and compared against the kind the census INFERS from
 * the day's name.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean;
}
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as composeWeekModule from '../src/rules/composeWeek';

/** planEntryId -> the shape the composer declared for that day. */
const declaredKindByEntry = new Map<string, string>();
const realCompose = composeWeekModule.composeWeek;
(composeWeekModule as any).composeWeek = function wrapped(inputs: any) {
  const composed = realCompose(inputs);
  for (const day of composed.days) declaredKindByEntry.set(day.planEntryId, day.kind);
  return composed;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../src/services/api/generateProgram');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sessionSlotCoverage, slotDayKindFor } = require('../src/rules/sessionSlotCoverage');
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

let deficient = 0;
let deficientAndComposedFullBody = 0;
let laddered = 0;
let composedFullBodyDays = 0;
const fullBodyWorlds = new Set<string>();
const lines: string[] = [];

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
          declaredKindByEntry.clear();
          let program: any;
          try {
            program = generateProgramLocally(profile, {
              todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
            });
          } catch { continue; }
          const label = `${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}`
            + `/${equipment[0]}/w${week}`;
          const kit = resolveEquipmentCapabilities(profile as any).tags;
          for (const workout of (program?.microcycles?.[week - 1]?.workouts ?? [])) {
            const nameKind = slotDayKindFor(String(workout.name ?? ''));
            if (!nameKind) continue;
            laddered += 1;
            const declared = declaredKindByEntry.get(String(workout.planEntryId ?? ''));
            const isFullBody = declared === 'full_body_a' || declared === 'full_body_b';
            if (isFullBody) { composedFullBodyDays += 1; fullBodyWorlds.add(label); }
            const coverage = sessionSlotCoverage(workout.exercises ?? [], nameKind, kit);
            if (coverage.missing.length > 0 || coverage.duplicated.length > 0) {
              deficient += 1;
              if (isFullBody) {
                deficientAndComposedFullBody += 1;
                lines.push(`${label} | declared=${declared} judgedAs=${nameKind} `
                  + `missing=${JSON.stringify(coverage.missing)} name="${workout.name}"`);
              } else {
                lines.push(`${label} | declared=${declared ?? 'NOT-COMPOSED'} judgedAs=${nameKind} `
                  + `missing=${JSON.stringify(coverage.missing)} name="${workout.name}"`);
              }
            }
          }
        }
      }
    }
  }
}

console.log(`\nladdered days: ${laddered}`);
console.log(`deficient: ${deficient}`);
console.log(`composed FULL-BODY days that the census judged by a lower/upper name: ${composedFullBodyDays}`);
console.log(`  of which DEFICIENT under that name: ${deficientAndComposedFullBody}`);
console.log(`worlds containing a composed full-body day: ${fullBodyWorlds.size}`);
for (const w of fullBodyWorlds) console.log(`    ${w}`);
console.log('\nEVERY DEFICIENT DAY, WITH THE SHAPE THE COMPOSER DECLARED:');
for (const line of lines) console.log(`  ${line}`);
