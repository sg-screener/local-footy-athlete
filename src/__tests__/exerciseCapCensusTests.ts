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
 * exactly three slots. **And every one of the seven is UNDER the cap**, so
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
 *
 * ## ⚠⚠ AND THE FIRST VERSION OF THIS CENSUS MANUFACTURED ITS OWN DEFECTS
 *
 * It banked a ceiling of THREE against the policy cap of 6. **All three were
 * SEVEN-row sessions, and seven is Sam's AUTHORED SIZE** — his words, Bible
 * `:122`, quoted in R-087 as *"Bible :122 sets the SIZE at 7 and Sam has not
 * moved it"*:
 *
 *   *"I wouldn't stack lower body strength (say **6-7 exercises**) with upper
 *   body strength (6-7 exercises)... I'd prefer to just make that a full body
 *   day i.e. **full body strength and 7 exercises**."*
 *
 * **So the three "breaches" were three lawful sessions, and a ceiling of 3 would
 * have pinned them as debt forever** — the shape this repo names as pinning a
 * defect, run in reverse: pinning a NON-defect, which is worse, because paying
 * it down would mean breaking Sam's own prescription.
 *
 * **THE REAL FINDING IS THE NUMBER ITSELF.** `maxExercisesPerStrengthSession` is
 * **6**; Sam authored **6-7, and 7 for a full body day**. The policy cap is ONE
 * LOW, and nothing ever caught it **because nothing enforced the cap** — R-013's
 * own sentence. **An unenforced number is never wrong out loud.**
 *
 * **THIS CENSUS THEREFORE JUDGES AGAINST SAM'S AUTHORED MAXIMUM, and holds a
 * separate cell on the policy cap agreeing with it.**
 *
 * ## ✅ SAM RULED IT — R-088, 2026-08-13. THE CAP IS 7, AND IT COUNTS STRENGTH ONLY
 *
 * *"7 strength exercises can be a cap - but the mobility pairings dont count at
 * all towards the cap… there should be a mobility warm up and prehab stuff then
 * there should be 2-3 non competing pairings of strength with mobility in the
 * session… the mobility portion does not count so 7 is the max the app should
 * set and a user should be able to add as many of their own things on top of it
 * as they choose"*.
 *
 * **THREE CLAUSES, AND THIS FILE HOLDS THE FIRST TWO:**
 * 1. **The number is 7.** `trainingAgePolicy` moved 6 -> 7; the gap cell below is
 *    now an EQUALITY and its ceiling is 0.
 * 2. **It counts STRENGTH rows only.** The census reads `exerciseBudgetRows` —
 *    the cap's own fence, which R-088 split from the taxonomy's — so mobility,
 *    prehab, power, conditioning and team training are all free of it.
 * 3. **It binds the app, not the athlete.** *"a user should be able to add as
 *    many of their own things on top of it as they choose."* **NOT BUILT AND
 *    DELIBERATELY SO: nothing enforces a cap, so there is no refusal to exempt,
 *    and there is no athlete-added marker on a row to exempt it BY.** Inventing
 *    one before its reader exists is what this repo bans. **Whoever builds the
 *    enforcement owes this exemption in the same commit** — it is written into
 *    `sessionRowCounting`'s docstring where that builder will be standing.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { exerciseBudgetRows } from '../rules/sessionRowCounting';
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
  equipment: ['Full Gym'], sessionsPerWeek: 4, gender: 'male', seasonPhase: 'Pre-season',
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday',
  recentTrainingLoad: 'Pretty consistent', conditioningLevel: 'Average',
};

const WORLDS: Array<[string, any]> = [
  ['in-season full gym', { ...BASE, gender: 'male', seasonPhase: 'In-season' }],
  ['pre-season full gym', { ...BASE, gender: 'male', seasonPhase: 'Pre-season' }],
  ['off-season full gym', { ...BASE, gender: 'male', seasonPhase: 'Off-season' }],
  // THE BEGINNER IS IN THE CENSUS ON PURPOSE — R-013's whole subject is that
  // this athlete does NOT get a smaller cap. If the abolished 3 ever returns,
  // it returns HERE, and a census without a beginner could not see it.
  ['new athlete full gym', { ...BASE, experienceLevel: 'Complete beginner' }],
  ['off-season bodyweight', {
    ...BASE, gender: 'male', seasonPhase: 'Off-season', equipment: ['Bodyweight Only'], teamTrainingDays: [],
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

/**
 * SAM'S AUTHORED MAXIMUM, Bible `:122`, verbatim: *"lower body strength (say 6-7
 * exercises)"*, *"upper body strength (6-7 exercises)"*, *"full body strength
 * and 7 exercises"*. **SEVEN is the largest number he wrote**, and R-087 states
 * it is unmoved. This is the number a shipped session is judged against.
 */
const AUTHORED_MAX_EXERCISES = 7;

console.log('\n[2] The policy cap must AGREE with the size Sam authored');
/**
 * **ZERO. Sam ruled (R-088) and the cap moved 6 -> 7, so the two numbers are now
 * simply equal.** This was briefly a ratchet at 1 while the question was with
 * him; it is an EQUALITY now and must stay one. **If it ever drifts again, the
 * number changed without the ruling changing.**
 */
const CAP_VS_AUTHORED_GAP_CEILING = 0;
ok('R-088: the policy cap IS Sam\'s authored maximum of 7',
  Math.abs(AUTHORED_MAX_EXERCISES - NORMAL_CAP) <= CAP_VS_AUTHORED_GAP_CEILING,
  `policy cap ${NORMAL_CAP}, Sam authored ${AUTHORED_MAX_EXERCISES}, `
  + `gap ${Math.abs(AUTHORED_MAX_EXERCISES - NORMAL_CAP)} (ceiling ${CAP_VS_AUTHORED_GAP_CEILING})`);
if (NORMAL_CAP !== AUTHORED_MAX_EXERCISES) {
  console.log(`\n  ⚠ THE CAP HAS DRIFTED FROM R-088 — policy ${NORMAL_CAP}, `
    + `Sam ruled ${AUTHORED_MAX_EXERCISES}. His number moved without his ruling moving.`);
}

console.log('\n[3] CENSUS — no strength session exceeds the size Sam authored');
{
  /**
   * **ZERO, and it was never anything else.** The three sessions this census
   * first reported were 7-row days measured against a policy cap of 6, and
   * SEVEN is what Sam authored. **Against his own number the app is clean, and
   * this ratchet starts where a ratchet should — at nothing owed.**
   * Never raise it.
   */
  const OVER_CAP_CEILING = 0;

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
        // COUNTED THROUGH THE CAP'S OWN FENCE (R-088), never `workout.exercises`:
        // mobility, prehab, power, conditioning and team training are all free of it.
        const rows = exerciseBudgetRows(workout as never);
        if (rows.length === 0) continue;
        sessionsSeen += 1;
        histogram[rows.length] = (histogram[rows.length] ?? 0) + 1;
        maxRows = Math.max(maxRows, rows.length);
        // EACH WORLD IS JUDGED AGAINST ITS OWN ATHLETE'S CAP, not against a
        // number this file picked. R-013 says the two are the same today — so
        // resolving it per world ASSERTS that rather than assuming it, and a
        // beginner-only cap creeping back would be caught here as well as by
        // the abolition cell above.
        // JUDGED AGAINST SAM'S AUTHORED MAXIMUM, not the policy cap — the two
        // disagree by one and the cell above is where that is reported. Judging
        // against the lower number would flag his own prescription as a defect.
        const cap = AUTHORED_MAX_EXERCISES;
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

  ok('R-013: no strength session exceeds the size Sam authored',
    over.length <= OVER_CAP_CEILING,
    `${over.length} over cap ${NORMAL_CAP} (ceiling ${OVER_CAP_CEILING})\n     ${over.join('\n     ')}`);

  console.log(`\n  EXERCISE CAP CENSUS: ${over.length} of ${sessionsSeen} strength sessions exceed SAM'S AUTHORED MAXIMUM of ${AUTHORED_MAX_EXERCISES} (ceiling ${OVER_CAP_CEILING}; the policy cap agrees at ${NORMAL_CAP})`);
  console.log(`  row-count histogram: ${JSON.stringify(Object.entries(histogram).sort((a, b) => Number(a[0]) - Number(b[0])))}`);
  for (const line of over) console.log(`    ${line}`);
}

// ── R-088 CLAUSE 2 — WHAT THE CAP COUNTS ────────────────────────────────────
//
// **SYNTHETIC ON PURPOSE, and the census above is why.** Generation stamps a
// role on almost nothing today — measured across the same 5 worlds x 3 weeks,
// the role histogram is `UNSET 178, conditioning 19, power 4`, with **ZERO**
// `prehab` and **ZERO** `mobility` rows. So the corpus cannot exercise this
// rule, and a cell that waited for it would be green and empty forever.
// **A rule provable only on data the generator happens to emit is not held.**
console.log('\n[4] R-088: the cap counts STRENGTH rows only');
{
  const strengthRow = (name: string, role: string) => ({
    id: `r:${name}`, workoutId: 'w', exerciseId: name, exerciseOrder: 0,
    prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, restSeconds: 120,
    role, exercise: { id: name, name },
  });
  // Sam's own worked example: seven strength rows and three paired mobility
  // picks. **"the mobility portion does not count so 7 is the max"** — this
  // session is AT the cap, and a counter reading session rows would say 10.
  const sevenPlusPairings = {
    exercises: [
      strengthRow('Back Squat', 'main_lift'),
      strengthRow('RDLs', 'main_lift'),
      strengthRow('Bulgarian Split Squats', 'accessory'),
      strengthRow('Single-Leg RDL', 'accessory'),
      strengthRow('Bench Press', 'main_lift'),
      strengthRow('Chest Supported Row', 'accessory'),
      strengthRow('Pallof Press', 'midline'),
      // the mobility half of three R-015 supersets — free of the cap
      strengthRow('Ankle Rock', 'mobility'),
      strengthRow('Thoracic Opener', 'mobility'),
      strengthRow('Hip Flexor Stretch', 'mobility'),
      // the warm-up / prehab flow, Bible :229 — free of the cap
      strengthRow('Band Pull-Apart', 'prehab'),
      strengthRow('Banded External Rotation', 'prehab'),
    ],
  };
  const counted = exerciseBudgetRows(sevenPlusPairings as never);
  ok('[non-vacuity] the fixture really does carry 12 rows',
    sevenPlusPairings.exercises.length === 12, `${sevenPlusPairings.exercises.length}`);
  ok('R-088: 7 strength + 3 paired mobility + 2 prehab counts as SEVEN',
    counted.length === 7, `counted ${counted.length}: ${counted.map((r: any) => r.exercise.name).join(' · ')}`);
  ok('R-088: that session is AT the cap, not over it',
    counted.length <= NORMAL_CAP, `counted ${counted.length}, cap ${NORMAL_CAP}`);
  ok('R-088: no mobility row is counted',
    !counted.some((r: any) => r.role === 'mobility'));
  ok('R-088: no prehab row is counted',
    !counted.some((r: any) => r.role === 'prehab'));
  // AND THE FENCE MUST NOT SWALLOW STRENGTH. If it excused main lifts or
  // accessories the cap would never bite at all — the failure mode of every
  // exemption this repo has added.
  ok('R-088: main lifts, accessories and midline ARE counted',
    ['main_lift', 'accessory', 'midline'].every((role) => counted.some((r: any) => r.role === role)),
    `roles counted: ${JSON.stringify(counted.map((r: any) => r.role))}`);
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
