/**
 * R-013 — THE EXERCISE CAP, ENFORCED AGAINST WHAT THE APP ACTUALLY SHIPS.
 *
 * **THE RULING:** *"ONE exercise cap for every training age; the beginner cap of
 * 3 was never authored"* (Bible `:3149`, `:4969`). One cap, all training ages,
 * and the number 3 is abolished.
 *
 * **WHAT WAS ALREADY HELD, AND WHAT WAS NOT.** `test:rules-kernel` carries
 * *"ONE exercise cap for every training age"* — it proves the two policies agree
 * and that the beginner-only 3 is gone. **That is the ABOLITION.** R-013's row
 * then says something different and was still true: *"nothing enforces a cap
 * anywhere"*. **A cap nothing measures is a number, not a limit**, and this file
 * is the measurement.
 *
 * ## ⚠ THE CAP IS A CEILING, AND THE 3-ROW BRANCHES ARE NOT WHERE IT BITES
 *
 * This unit was ordered as *"find the seven fallback branches handing out three
 * rows and make them read the cap"*. **Measured first, and that framing is
 * refuted — recorded here because it is the reason this file looks the way it
 * does:**
 *
 * | branch | day kind | rows | slots | verdict |
 * | --- | --- | --- | --- | --- |
 * | pull-only, push-only, pull-by-text | `upper_split_*` | 3 | **3** | **COVERS — three is CORRECT** |
 * | hinge-by-text | `lower` | 3 | 5 | short, and duplicates `hinge` |
 * | squat-by-text | `lower` | 3 | 5 | short |
 * | catch-all | `upper_full` | 3 | 5 | short |
 * | full-body-by-text | — | 3 | — | no ladder classified |
 *
 * **Three of the seven are the right size**, because an upper SPLIT ladder has
 * exactly three slots. **And every one of the seven is UNDER the cap of 6**, so
 * reading a maximum would have changed nothing at all — a reader that cannot
 * bite is the dead weight this repo already pays for elsewhere.
 * **What those branches are short of is SLOT COVERAGE, which is R-014 and the
 * composer's unit (item 51), not this one.**
 *
 * ## WHERE IT DOES BITE, AND WHY THIS FILE DOES NOT TRIM
 *
 * Measured over 5 worlds x 3 weeks: **43 strength sessions, histogram
 * `3x22, 5x17, 6x1, 7x3` — three sessions ship SEVEN rows against a cap of 6.**
 *
 * **ALL THREE ARE THE BODYWEIGHT ATHLETE, AND ALL THREE ARE HOLDING BARBELL
 * LIFTS** — `Back Squat`, `Romanian Deadlift`, `Overhead Press`, `Barbell Row`
 * appended onto an already-composed day, which is also why they duplicate
 * (`Bodyweight Squat` + `Back Squat`; `Single-Leg RDL` + `Romanian Deadlift`).
 *
 * **SO A TRIM WOULD PATCH THE WRONG LAYER.** Cutting the seventh row would drop
 * one barbell lift, leave the rest, and turn a visible equipment defect into a
 * lawful-looking six-row session. That is exactly the stop-patching trigger:
 * fix the layer that explains the class, and do not let one law's guard bury
 * another's evidence. **The kit defect has its own census and its own owner**
 * (`sessionSlotCoverageTests`' EQUIPMENT CENSUS, ceiling 5).
 *
 * **THIS FILE THEREFORE MEASURES AND RATCHETS. It never edits a session.**
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { participatesInCounting } from '../rules/sessionRowCounting';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../services/api/generateProgram') as any;

const BASE = {
  name: 'Test', age: 24, experienceLevel: '2-5 years', primaryGoal: 'Performance',
  equipment: ['Full Gym'], sessionsPerWeek: 4, seasonPhase: 'Pre-season',
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday',
  recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
};

const WORLDS: Array<[string, any]> = [
  ['in-season full gym', { ...BASE, seasonPhase: 'In-season' }],
  ['pre-season full gym', { ...BASE, seasonPhase: 'Pre-season' }],
  ['off-season full gym', { ...BASE, seasonPhase: 'Off-season' }],
  // THE BEGINNER IS IN THE CENSUS ON PURPOSE — R-013's whole subject is that
  // this athlete does NOT get a smaller cap. If the abolished 3 ever returns,
  // it returns HERE, and a census without a beginner could not see it.
  ['new athlete full gym', { ...BASE, experienceLevel: 'Complete beginner' }],
  ['off-season bodyweight', {
    ...BASE, seasonPhase: 'Off-season', equipment: ['Bodyweight Only'], teamTrainingDays: [],
  }],
];

console.log('\n[1] The cap is READ, not written into this file');
// THE CAP COMES FROM THE POLICY. A literal 6 here would be a SECOND
// representation of the number, and the day Sam moves it this suite would go on
// asserting the old one while claiming to hold his ruling.
const NORMAL_CAP = resolveTrainingAgePolicy('2-5 years').maxExercisesPerStrengthSession;
const BEGINNER_CAP = resolveTrainingAgePolicy('Complete beginner').maxExercisesPerStrengthSession;
ok('[non-vacuity] the cap resolves to a real number',
  Number.isInteger(NORMAL_CAP) && NORMAL_CAP > 0, `cap=${String(NORMAL_CAP)}`);
ok('R-013: the beginner cap IS the normal cap — the 3 is abolished',
  BEGINNER_CAP === NORMAL_CAP, `beginner=${BEGINNER_CAP} normal=${NORMAL_CAP}`);

console.log('\n[2] CENSUS — no strength session the app ships exceeds the cap');
{
  /**
   * MEASURED 2026-08-13. Three sessions, ALL the bodyweight athlete, all
   * carrying appended barbell lifts. **Lower it when a session is fixed; never
   * raise it.** It falls to 0 when the kit defect is paid — the cause is not in
   * this unit and the ceiling names it rather than hiding it.
   */
  const OVER_CAP_CEILING = 3;

  const over: string[] = [];
  const histogram: Record<number, number> = {};
  let sessionsSeen = 0;
  let maxRows = 0;

  for (const [label, profile] of WORLDS) {
    for (const week of [1, 2, 3]) {
      const program = generateProgramLocally(profile as never, {
        todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
      });
      for (const workout of (program?.microcycles?.[week - 1]?.workouts ?? [])) {
        if (!/strength|lower|upper|full body/i.test(String(workout.name))) continue;
        const rows = (workout.exercises ?? []).filter((r: unknown) => participatesInCounting(r as never));
        if (rows.length === 0) continue;
        sessionsSeen += 1;
        histogram[rows.length] = (histogram[rows.length] ?? 0) + 1;
        maxRows = Math.max(maxRows, rows.length);
        // EACH WORLD IS JUDGED AGAINST ITS OWN ATHLETE'S CAP, not against a
        // number this file picked. R-013 says the two are the same today — so
        // resolving it per world ASSERTS that rather than assuming it, and a
        // beginner-only cap creeping back would be caught here as well as by
        // the abolition cell above.
        const cap = resolveTrainingAgePolicy(profile.experienceLevel).maxExercisesPerStrengthSession;
        if (rows.length > cap) {
          const names = rows.map((r: any) => String(r?.exercise?.name ?? '?')).join(' · ');
          over.push(`${label} | ${workout.name} | ${rows.length} rows (cap ${cap}): ${names}`);
        }
      }
    }
  }

  // NON-VACUITY FIRST. A census that generated nothing reports ZERO breaches and
  // reads as perfect health — the trap every ratchet in this repo guards.
  ok('[non-vacuity] the census actually built strength sessions',
    sessionsSeen >= 20, `sessions seen: ${sessionsSeen}`);
  // AND it must reach sessions big enough for the cap to be capable of biting.
  ok('[non-vacuity] the corpus contains sessions at or near the cap',
    maxRows >= NORMAL_CAP, `max rows seen: ${maxRows}, cap ${NORMAL_CAP}`);

  ok('R-013: no strength session exceeds the cap, beyond the measured ceiling',
    over.length <= OVER_CAP_CEILING,
    `${over.length} over cap ${NORMAL_CAP} (ceiling ${OVER_CAP_CEILING})\n     ${over.join('\n     ')}`);

  console.log(`\n  EXERCISE CAP CENSUS: ${over.length} of ${sessionsSeen} strength sessions exceed the cap of ${NORMAL_CAP} (ceiling ${OVER_CAP_CEILING})`);
  console.log(`  row-count histogram: ${JSON.stringify(Object.entries(histogram).sort((a, b) => Number(a[0]) - Number(b[0])))}`);
  for (const line of over) console.log(`    ${line}`);
}

console.log(
  `\nExercise cap census: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
