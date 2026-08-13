/**
 * R-014 AT SCALE — SAM'S LADDER, MEASURED OVER THE WORLDS THE APP ACTUALLY HAS.
 *
 * **HIS RULING (2026-08-13), which `sessionSlotCoverage` already encodes:**
 * *"the number of exercises is not important the total work being done evenly
 * across the body is"* — a lower day wants hinge, squat, single-leg knee,
 * single-leg hip and accessory/core; a full upper day wants both planes both
 * directions plus arm work.
 *
 * ## WHY A SECOND CENSUS EXISTS, AND WHY IT IS NOT A RIVAL
 *
 * `sessionSlotCoverageTests`'s SLOT CENSUS holds **0 deficient** and its comment
 * says *"zero is the floor — this may now only be held."* **That is true and it
 * stays true: it sweeps THREE worlds at ONE week.** This suite sweeps the same
 * oracle over **174 worlds** — 3 phases x 5 training-day counts x club/no-club x
 * 3 equipment sets x 2 weeks — and the answer is different by two orders of
 * magnitude.
 *
 * **MEASURED 2026-08-13 AT COMMITTED HEAD, seat `patterns`, inbox item 51:**
 *
 *     worlds built 174 (6 refused by §18) · laddered days 216
 *     DEFICIENT: 50 of 216  (23%)  in 5 distinct shapes
 *     laddered-day row counts: {3: 126, 4: 12, 5: 50, 6: 28}
 *
 * **⚠ THE FIRST NUMBER I TOOK WAS 148 OF 318, AND IT WAS MEASURED IN A WORLD
 * THAT DOES NOT EXIST IN GIT.** The shared checkout held another seat's
 * uncommitted `defaultProgram.ts`, and that one file moved both the deficient
 * count and how many days are laddered at all. The mutation run caught it: the
 * RESTORED baseline in a clean worktree disagreed with the live tree, which is
 * the only reason it was noticed. **A ratchet calibrated to a dirty tree pins a
 * number the chain can never reproduce**, so every figure here is taken at HEAD
 * and this suite must be re-measured the same way.
 *
 * **THE NARROW CENSUS IS NOT WRONG — IT IS NARROW**, and raising ITS ceiling
 * from 0 would have destroyed a real held property to record a new finding. Two
 * censuses, two corpora, two honest numbers. This one ratchets.
 *
 * ## WHAT THE 50 ARE — ONE SHAPE, NOT FIFTY BUGS
 *
 * All five distinct shapes are the SAME DAY, `Lower Squat`, in two variants:
 *   - `missing: [single_leg_hip]` with `dup: [hinge]` — two hinges and no
 *     single-leg hip lift, which is R-070's shape and R-014's in one day;
 *   - `missing: [squat]` with `dup: [single_leg_knee]` — a squat day with no
 *     squat, its knee work doubled instead.
 * **`Upper` days are clean at HEAD.** That is worth stating because it is the
 * opposite of what item 51 implies, and it narrows the composer's first job to
 * one session kind.
 *
 * **126 of the 216 laddered days ship THREE rows into a FIVE-slot ladder.**
 * Three rows cannot cover five slots. `defaultProgram` has 15 fallback branches
 * and **11 return exactly 3 rows** — counted; of item 51's three claims this is
 * the one that is exactly right.
 *
 * ## WHAT THIS SUITE IS NOT
 *
 * **It is not the composer.** `sessionSlotCoverage`'s header has said from the
 * start: *"it does not compose, reorder or repair a session. It NAMES what is
 * missing. The composer is the next unit and this is its oracle."* Still true.
 * This is the RATCHET that makes the composer's progress visible and stops the
 * number climbing while it is built — nothing more, and it is deliberately not
 * dressed as more.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { sessionSlotCoverage, slotDayKindFor } from '../rules/sessionSlotCoverage';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateProgramLocally } = require('../services/api/generateProgram');

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

/**
 * THE KIT SETS ARE THREE BECAUSE TWO WOULD HAVE HIDDEN A SHAPE. `Full Gym` and
 * `Bodyweight Only` are the ends; the middle set is where `missing: [squat]`
 * lives, and it appears in neither end.
 */
const KITS: string[][] = [['Full Gym'], ['Bodyweight Only'], ['Dumbbells', 'Bands']];

/**
 * **MEASURED 2026-08-13. IT FALLS OR THE CELL REDS — it may never be raised.**
 *
 * A ratchet rather than a pin: pinning the number would red on every genuine
 * improvement, and asserting 0 today would be a knowingly-red cell in a chain
 * suite, which the registry forbids as loudly as it forbids a silent debt.
 */
const DEFICIENT_CEILING = 50;

let worldsBuilt = 0;
let worldsRefused = 0;
let sessionsSeen = 0;
let ladderedDays = 0;
const rowCounts: Record<number, number> = {};
const deficient: string[] = [];

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
          let program: any;
          try {
            program = generateProgramLocally(profile, {
              todayISO: '2026-07-13', blockNumber: 1, microcycleLimit: week,
            });
          } catch {
            // A world §18 REFUSES never reaches an athlete, so it cannot break
            // the ladder. Counted, never silently skipped — a refusal rate that
            // climbs is its own finding and the cell below watches it.
            worldsRefused += 1;
            continue;
          }
          worldsBuilt += 1;
          const label = `${seasonPhase}/${trainingDaysPerWeek}d/${club ? 'club' : 'noclub'}`
            + `/${equipment[0]}/w${week}`;
          for (const workout of (program?.microcycles?.[week - 1]?.workouts ?? [])) {
            sessionsSeen += 1;
            const kind = slotDayKindFor(String(workout.name ?? ''));
            if (!kind) continue;
            ladderedDays += 1;
            const rows = workout.exercises ?? [];
            rowCounts[rows.length] = (rowCounts[rows.length] ?? 0) + 1;
            const coverage = sessionSlotCoverage(rows, kind);
            if (coverage.missing.length > 0 || coverage.duplicated.length > 0) {
              deficient.push(`${label} | ${workout.name} [${kind}] `
                + `missing=${JSON.stringify(coverage.missing)} `
                + `dup=${JSON.stringify(coverage.duplicated)} rows=${rows.length}`);
            }
          }
        }
      }
    }
  }
}

// ── NON-VACUITY FIRST, IN THREE PARTS ──────────────────────────────────────
//
// This suite's whole value is its BREADTH, so the thing most worth checking is
// that the breadth is real. A census that built nothing, or reached no laddered
// day, reports ZERO deficient and reads as perfect health — sighted three times
// in one day across three seats (the R-070 generation census on a broken tree,
// this oracle's own narrow census, and `readinessStructureCensus`'s file walk).
console.log('\n[1] The sweep is as wide as it claims — non-vacuity first');
{
  ok('most worlds actually built', worldsBuilt >= 150, `built ${worldsBuilt}, refused ${worldsRefused}`);
  ok('the sweep reached laddered days in quantity',
    ladderedDays >= 180, `laddered days: ${ladderedDays} of ${sessionsSeen} sessions`);
  // AND THE CORPUS IS NOT ONE WORLD REPEATED. If every world produced the same
  // week, the count above would be met by 174 copies of one answer.
  ok('the corpus is varied — laddered days come in at least four sizes',
    Object.keys(rowCounts).length >= 4, JSON.stringify(rowCounts));
}

console.log('\n[2] Sam\'s ladder, over every world the app can build');
{
  const shapes = new Set(deficient.map((line) => line.split('|').slice(1).join('|')));
  // ⚠ THE LOWER BOUND IS NOT DECORATION — IT IS WHAT A MUTATION PROVED MISSING.
  // Blinding the oracle so every day reads clean left this suite 4/4 GREEN with
  // "0 deficient of 216": a ceiling-only ratchet cannot tell WE FIXED IT from WE
  // STOPPED LOOKING. Same shape as `rulingRegistryTests`'s UNENFORCED cell, and
  // the same remedy — the number falling is GOOD NEWS that must be BANKED in the
  // commit that earned it, or the gate quietly stops measuring.
  ok('a real improvement is BANKED — lower the ceiling in the commit that paid it',
    deficient.length >= DEFICIENT_CEILING - 10,
    `only ${deficient.length} deficient but the ceiling is still ${DEFICIENT_CEILING}. `
    + 'If the composer landed, lower DEFICIENT_CEILING to the new number here. If '
    + 'nothing was fixed, the oracle or the corpus has gone blind — check that '
    + `${ladderedDays} laddered days is still the real breadth.`);

  ok('no more laddered days miss Sam\'s ladder than did when this was measured',
    deficient.length <= DEFICIENT_CEILING,
    `${deficient.length} deficient of ${ladderedDays} laddered days `
    + `(ceiling ${DEFICIENT_CEILING}, ${shapes.size} distinct shapes)\n     `
    + [...shapes].slice(0, 20).join('\n     '));

  console.log(`\n  WIDE LADDER CENSUS: ${deficient.length} deficient of ${ladderedDays} laddered days `
    + `(ceiling ${DEFICIENT_CEILING}) across ${worldsBuilt} worlds, ${worldsRefused} refused`);
  console.log(`  laddered-day row counts: ${JSON.stringify(rowCounts)}`);
  console.log(`  ${shapes.size} DISTINCT SHAPES:`);
  for (const shape of shapes) console.log(`    ${shape}`);
}

const total = passed + failures.length;
console.log(`\nWide ladder census: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
