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
import {
  sessionSlotCoverage,
  slotDayKindFor,
  slotsForExerciseName,
  type SessionSlot,
} from '../rules/sessionSlotCoverage';
// The SAME kit resolution the generator uses (`defaultProgram`), not a second
// one — a census judging against a kit the builder never saw would be measuring
// a world no athlete is in.
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';

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
/**
 * **LOWERED 50 -> 36 ON 2026-08-13, in the commit that paid it.** The composer
 * landed for the combined lower/upper days and the hinge accessory pool was
 * split so `Single-Leg RDL` can no longer rotate into a bilateral hinge.
 *
 * **50 -> 36 of the SAME 216 laddered days, and the shapes fell 5 -> 3.** Both
 * `single_leg_hip`-missing shapes are gone; what remains is the equipment class
 * (`missing: [squat]` with a doubled `single_leg_knee`, and a doubled `squat`),
 * which belongs to the kit fallback and not to this ladder.
 *
 * **RAISED 36 -> 88 ON 2026-08-13, AND THE DENOMINATOR IS WHY.** This is the
 * one thing a ratchet is never allowed to do, so it is stated in full and paired
 * with a floor that banks what bought it.
 *
 * `slotDayKindFor` returned NOTHING for `Lower Body Strength` — the app's
 * COMMONEST strength day — because the text owner reads pattern words out of
 * prose and that name is a REGION. **102 laddered days were invisible to this
 * census and to every other cell in the repo.** The authored set now answers
 * first, and the corpus goes 216 -> 318 laddered days.
 *
 * **THE THREE NUMBERS, ALL TAKEN IN A FRESH WORKTREE AT HEAD:**
 *
 * | tree | deficient / laddered |
 * | --- | --- |
 * | before the composer   | 50 / 216 |
 * | after the composer    | 36 / 216 |
 * | after this widening   | 88 / 318 |
 *
 * **52 of the 102 newly-visible days are deficient, and they were ALWAYS
 * deficient** — nothing regressed, the census simply stopped being blind to
 * them. Their shape is the equipment class (a `Glute Bridge` and a
 * `Romanian Deadlift` on one day = two bilateral hinges), which is the same
 * remainder the composer commit named as not covered.
 *
 * **WHAT BANKS IT: `LADDERED_FLOOR` below rises with the ceiling.** A ceiling
 * raised on the promise of a wider corpus is worthless if the corpus can quietly
 * shrink back — the count would fall, the ceiling would stay, and the suite
 * would read as healthy while looking at less. The floor makes the widening a
 * property this suite HOLDS, not an excuse it was given once.
 */
/**
 * **LOWERED 88 -> 0 ON 2026-08-14, IN THE COMMIT THAT EARNED IT — AND THE NUMBER
 * IS NOT THE ACHIEVEMENT IT LOOKS LIKE. READ THE SECOND HALF OF THIS NOTE.**
 *
 * WHAT ACTUALLY CHANGED. Nothing was added to any week. 24 of the 28 deficient
 * days were composed FULL-BODY days being judged against a lower-or-upper ladder,
 * because this census re-derived the day's shape from the planner's session TITLE
 * while the composer had already DECLARED it; the other 4 were a composed
 * push-only day whose title promised "combined push + pull". The declaration is
 * now carried (`materialiseComposedWeek`) and read (above). Same 294 laddered
 * days, same row-count histogram `{2:22, 3:78, 4:16, 5:106, 6:72}` either side —
 * **no day left the corpus, and no exercise entered a week.**
 *
 * ⚠ **AND FOR A COMPOSED DAY THIS METRIC IS NOW CIRCULAR.** `composeWeek` fills
 * `SLOTS_FOR_KIND[kind]`; this census judges the same day against
 * `SLOTS_FOR_KIND[kind]`. For composed days those are the SAME LIST, so `missing`
 * is empty **by construction** and a ceiling of 0 is a statement about the wiring,
 * not about the training. It is banked because the mission requires a measured
 * improvement to be banked where it was earned, and because it still guards two
 * things that are NOT tautological:
 *
 *   - **days nobody composed** — the adapter's own days are still title-judged;
 *   - **the kit and injury interactions** — a slot the kit CAN train but the
 *     composer left unfilled (an injury-prohibited pattern, an exhausted pool)
 *     survives in `required` and still reports `missing`.
 *
 * **THE HONEST MEASURE OF COMPOSER CORRECTNESS MOVED TO THE `[CONTENT]` R-089
 * ARMS**, which count squat/hinge and single-leg exposures from what the rows ARE
 * and consult no ladder and no declaration. Mutation-proved 2026-08-14: dropping
 * `hinge` from `FULL_BODY_B_SLOTS` — a change that moves the composer and the
 * judge together, so a circular cell would stay green — reds the content arm and
 * takes pair exposures 640 -> 610.
 *
 * **DO NOT read a future "0 deficient" as health.** If this reaches zero while
 * the content arms are also green and `LADDERED_FLOOR` holds, that is the wiring
 * working. The number that means something here is 294.
 */
const DEFICIENT_CEILING = 0;

// ── R-089: THE LOWER PATTERNS MOVE IN PAIRS, ACROSS THE WEEK ──────────────
//
// Sam, 2026-08-13: *"every squat should be matched with a hinge and every
// single leg knee should be matched with a single leg hip / it doesnt matter
// if you have two squats, two hinges, 1 single leg knee and 1 single leg hip /
// thats fiiine"*. **What is wrong is 2 squats and 1 hinge.**
//
// IT IS DIRECTIONAL, NOT AN EQUALITY, AND THAT IS HIS WORDING. "Every squat is
// MATCHED WITH a hinge" bounds squats by hinges; a hinge with no squat is not
// what he objected to, and 28 worlds in this very sweep are `sq0/hi1` — a
// legitimate hinge-led week that an equality would have failed.
//
// THE UNIT IS THE WEEK, NOT THE DAY. R-089 exists because a full-body Wednesday
// is judged by what the rest of the week already did.
const unmatchedSquats: string[] = [];
const unmatchedKnees: string[] = [];
const pairShapes = new Map<string, number>();

/**
 * ── R-089 COUNTED A SECOND WAY, FROM THE CONTENT, AND IT IS THE ARM THAT CANNOT
 *    BE SATISFIED BY CONSTRUCTION ──────────────────────────────────────────────
 *
 * **THE SLOT-BASED COUNT ABOVE WENT CIRCULAR ON 2026-08-14 AND SAYING SO IS THE
 * POINT.** The composer fills `SLOTS_FOR_KIND[kind]`; since the declaration is
 * now read, this census judges the same day against `SLOTS_FOR_KIND[kind]`. For a
 * composed day the two are the SAME LIST, so `missing` is empty by construction
 * and "0 deficient" is a statement about the wiring, not about the training. That
 * is honest and it is a real loss of independence — a ceiling that can only ever
 * read zero has stopped being a measurement.
 *
 * So R-089 is counted again HERE, from what the week's rows ARE:
 * `slotsForExerciseName` over every exercise, day ladders and declared shapes
 * ignored entirely. A `Back Squat` is a squat exposure because of what it is, and
 * no shape declaration can talk this counter out of it. **A composer that shipped
 * a squat with no hinge would pass the slot arm and fail this one**, which is the
 * whole reason it exists — proved by mutation, not asserted.
 *
 * ONE ROW IS SPENT ONCE. A lift filling two pair slots is counted in the first,
 * in Sam's authored order, so a single exercise can never match itself.
 */
const PAIR_SLOTS: readonly SessionSlot[] = [
  'squat', 'hinge', 'single_leg_knee', 'single_leg_hip',
];
const contentUnmatchedSquats: string[] = [];
const contentUnmatchedKnees: string[] = [];
let contentPairExposures = 0;
let worldsBuilt = 0;
let worldsRefused = 0;
let sessionsSeen = 0;
let ladderedDays = 0;
const rowCounts: Record<number, number> = {};
const deficient: string[] = [];
/** R-083: laddered days holding a slot this athlete's KIT cannot train at all. */
const kitBlocked: string[] = [];
const kitBlockedSlots: Record<string, number> = {};

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
          // R-089: the lower patterns move in PAIRS, and the unit is the WEEK.
          const weekPairs: Record<string, number> = {
            squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0,
          };
          // The independent count — see PAIR_SLOTS. Every row in the week, no
          // ladder and no declared shape consulted.
          const contentPairs: Record<string, number> = {
            squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0,
          };
          for (const workout of (program?.microcycles?.[week - 1]?.workouts ?? [])) {
            sessionsSeen += 1;
            for (const row of (workout.exercises ?? [])) {
              const name = String((row as { exercise?: { name?: string } }).exercise?.name ?? '');
              if (!name) continue;
              const filled = slotsForExerciseName(name) ?? [];
              const hit = PAIR_SLOTS.find((slot) => filled.includes(slot));
              if (hit) { contentPairs[hit] += 1; contentPairExposures += 1; }
            }
            // ── THE DECLARATION ANSWERS FIRST, THE NAME ONLY FOR DAYS NOBODY
            //    COMPOSED (2026-08-14) ─────────────────────────────────────────
            //
            // `slotDayKindFor` reads a session TITLE. That is the right owner for
            // a day this census did not build, and it was the ONLY owner here —
            // so a composed day was judged against a ladder re-guessed out of the
            // planner's prose rather than the one the composer declared.
            //
            // **IT IS NOT A HEURISTIC THAT NEEDED IMPROVING.** Sam's full-body A
            // and B are DIFFERENT ladders (A leads with a squat, B with a hinge)
            // and every naming owner in this app calls both `Full Body Strength`.
            // The title does not contain the answer, so no text probe could ever
            // have got it right.
            //
            // MEASURED BEFORE THIS LINE: 24 composed full-body days scored
            // deficient with NOTHING missing from them, and R-089 reported 6
            // squat-without-hinge weeks whose real content is `sq1/hi1` — the
            // hinge was on the day, in the slot, and invisible because `hinge` is
            // not a member of the upper ladder the NAME selected.
            //
            // ⚠ THIS MAY NOT SHRINK THE CORPUS. A day that stops being laddered
            // is a day that stopped being looked at, which is the move
            // `DEFICIENT_CEILING`'s own comment calls worthless — so
            // `LADDERED_FLOOR` below is the arm that reds if this narrows the
            // question instead of correcting it. Measured either side: 294 both
            // ways, no day left the corpus.
            const declaredShape = (workout as { composedDayShape?: string })
              .composedDayShape;
            const kind = (declaredShape as ReturnType<typeof slotDayKindFor>)
              ?? slotDayKindFor(String(workout.name ?? ''));
            if (!kind) continue;
            ladderedDays += 1;
            const rows = workout.exercises ?? [];
            rowCounts[rows.length] = (rowCounts[rows.length] ?? 0) + 1;
            // ── THE LADDER IS JUDGED AGAINST THE KIT-ACHIEVABLE LADDER ───────
            //
            // R-083: *"i can't account for everyone and if they want to train
            // properly they'll sign up to a gym"*. A slot no legal exercise can
            // fill on this athlete's kit is NOT OWED, so counting it as a missing
            // rung scores the ruling's own answer as a defect. Measured: closing
            // the equipment routes took this census 92 → 178 deficient, and the
            // 86 new ones were bodyweight days correctly missing a vertical pull.
            //
            // `sessionSlotCoverage` has taken the kit and computed `unavailable`
            // since R-084 — **this census simply never passed it.** The oracle is
            // unchanged; only the question is now asked properly.
            //
            // FULL-GYM ATHLETES ARE UNTOUCHED BY CONSTRUCTION: their `unavailable`
            // is empty, so `required` is the whole declared ladder exactly as
            // before. That is asserted below, not assumed.
            const kit = resolveEquipmentCapabilities(profile as any).tags;
            const coverage = sessionSlotCoverage(rows, kind, kit);
            for (const slot of coverage.filled) {
              if (slot in weekPairs) weekPairs[slot] += 1;
            }
            // ⚠ NOTHING DISAPPEARS BY REDEFINITION. A slot moved out of `missing`
            // is moved INTO this census, which is printed beside the deficient
            // count and floored below. A number that falls because the question
            // narrowed, with nowhere for the difference to show, is the exact
            // move `DEFICIENT_CEILING`'s own comment calls worthless.
            if (coverage.unavailable.length > 0) {
              kitBlocked.push(`${label} | ${workout.name} [${kind}] `
                + `unavailable=${JSON.stringify(coverage.unavailable)}`);
              for (const slot of coverage.unavailable) {
                kitBlockedSlots[slot] = (kitBlockedSlots[slot] ?? 0) + 1;
              }
            }
            if (coverage.missing.length > 0 || coverage.duplicated.length > 0) {
              deficient.push(`${label} | ${workout.name} [${kind}] `
                + `missing=${JSON.stringify(coverage.missing)} `
                + `dup=${JSON.stringify(coverage.duplicated)} rows=${rows.length}`);
            }
          }
          const shape = `sq${weekPairs.squat}/hi${weekPairs.hinge}`
            + ` slk${weekPairs.single_leg_knee}/slh${weekPairs.single_leg_hip}`;
          if (weekPairs.squat + weekPairs.hinge
            + weekPairs.single_leg_knee + weekPairs.single_leg_hip > 0) {
            pairShapes.set(shape, (pairShapes.get(shape) ?? 0) + 1);
          }
          if (weekPairs.squat > weekPairs.hinge) {
            unmatchedSquats.push(`${label} | ${shape}`);
          }
          if (weekPairs.single_leg_knee > weekPairs.single_leg_hip) {
            unmatchedKnees.push(`${label} | ${shape}`);
          }
          const contentShape = `sq${contentPairs.squat}/hi${contentPairs.hinge}`
            + ` slk${contentPairs.single_leg_knee}/slh${contentPairs.single_leg_hip}`;
          if (contentPairs.squat > contentPairs.hinge) {
            contentUnmatchedSquats.push(`${label} | ${contentShape}`);
          }
          if (contentPairs.single_leg_knee > contentPairs.single_leg_hip) {
            contentUnmatchedKnees.push(`${label} | ${contentShape}`);
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
  // ⚠ THIS FLOOR IS WHAT PAID FOR THE CEILING BEING RAISED, so it moves with it.
  // **RAISED 180 -> 300 ON 2026-08-13**, when the authored set closed
  // `slotDayKindFor`'s blind spot and 102 `Lower Body Strength` days entered the
  // corpus (216 -> 318 laddered). A ceiling raised on the promise of a wider
  // corpus is worthless if the corpus can shrink back afterwards: the count
  // would fall, the ceiling would stay, and the suite would read healthy while
  // looking at less. **Breadth is now a property this suite HOLDS.**
  ok('the sweep reached laddered days in quantity',
    ladderedDays >= 300, `laddered days: ${ladderedDays} of ${sessionsSeen} sessions`);
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

  // ── THE R-083 CATEGORY, PRINTED BESIDE THE DEFICIENT COUNT ────────────────
  //
  // These days are not deficient and are not clean: the athlete's kit cannot
  // train the slot, so by R-083 it is REMOVED, not owed and not substituted.
  // They get their own visible number because a category with no counter is how
  // a narrowed question passes for an improvement.
  //
  // THE FLOOR IS THE NON-VACUITY. If the kit ever stops being passed to the
  // oracle — the exact defect this slice fixed — `unavailable` goes empty
  // everywhere, this count drops to 0, and the deficient count jumps back. The
  // floor reds first and names the cause, instead of the ceiling reddening and
  // sending the next reader looking at the composer.
  ok('[R-083] the kit-blocked census is LIVE — the oracle is being told the kit',
    kitBlocked.length > 0,
    `0 kit-blocked days across ${worldsBuilt} worlds, though one of the three kits is `
    + 'Bodyweight Only. Either sessionSlotCoverage stopped receiving availableEquipment '
    + 'or slotIsTrainableOnKit went blind — the deficient count above is now measuring '
    + 'the wrong ladder.');
  // AND IT MUST NOT SWALLOW THE FULL-GYM ATHLETE. If a full-gym kit ever
  // reported an unavailable slot, this category would be absorbing real composer
  // gaps under an equipment exemption — the one way this change could hide a
  // defect rather than classify one.
  ok('[R-083] a full-gym athlete is never kit-blocked — the exemption cannot spread',
    kitBlocked.every((line) => !line.includes('/Full Gym/')),
    kitBlocked.filter((line) => line.includes('/Full Gym/')).slice(0, 5).join('\n     '));

  console.log(`\n  R-083 KIT-BLOCKED CENSUS: ${kitBlocked.length} laddered days hold a slot `
    + 'their kit cannot train (removed by ruling, not owed)');
  console.log(`    by slot: ${JSON.stringify(kitBlockedSlots)}`);

  console.log(`\n  WIDE LADDER CENSUS: ${deficient.length} deficient of ${ladderedDays} laddered days `
    + `(ceiling ${DEFICIENT_CEILING}) across ${worldsBuilt} worlds, ${worldsRefused} refused`);
  console.log(`  laddered-day row counts: ${JSON.stringify(rowCounts)}`);
  console.log(`  ${shapes.size} DISTINCT SHAPES:`);
  for (const shape of shapes) console.log(`    ${shape}`);
}

// ── R-089 — EVERY SQUAT MATCHED WITH A HINGE, EVERY SINGLE-LEG KNEE WITH A
//    SINGLE-LEG HIP. Measured over the same 174 worlds. ────────────────────
//
// NOTHING ANYWHERE CHECKED THIS BEFORE — the ruling row said so in as many
// words. It could not be checked at ROW level either:
// `mainPatternForExerciseMovement` maps `lunge` -> `squat` and has no
// single-leg member at all, so the pairing is invisible to it. The SLOT
// vocabulary is the only one that can express it, which is why the count is
// taken from `coverage.filled`.
{
  const shapes = [...pairShapes.entries()].sort((a, b) => b[1] - a[1]);
  // NON-VACUITY BEFORE THE VERDICT. A sweep where no week contains a squat or
  // a hinge reports ZERO unmatched and reads as perfect balance — the exact
  // green-and-empty shape this suite already guards three other ways.
  //
  // ⚠ THE FIRST VERSION ASKED FOR >= 3 DISTINCT SHAPES AND FAILED AT 2, AND THE
  // THRESHOLD WAS THE THING THAT WAS WRONG. Shape VARIETY is not what makes
  // this cell mean something — BOTH COUNTERS REGISTERING is. If nothing ever
  // counted a squat, "0 unmatched squats" would be true and worthless. So the
  // assertion is that a week exists carrying a squat AND a hinge, and another
  // carrying both single-leg slots: that proves each counter is live and could
  // have diverged. Weakening a threshold to fit the data would have been
  // fitting the gate to the answer; this replaces it with the property the
  // cell actually needs.
  const sawSquatAndHinge = shapes.some(([shape]) => /sq[1-9]/.test(shape) && /hi[1-9]/.test(shape));
  const sawBothSingleLeg = shapes.some(([shape]) => /slk[1-9]/.test(shape) && /slh[1-9]/.test(shape));
  ok('[R-089 non-vacuity] a week carrying BOTH a squat and a hinge was seen — the counters are live',
    sawSquatAndHinge,
    `shapes seen: ${shapes.map(([s, n]) => `${n}x ${s}`).join(' | ')}`);
  ok('[R-089 non-vacuity] a week carrying BOTH single-leg slots was seen',
    sawBothSingleLeg,
    `shapes seen: ${shapes.map(([s, n]) => `${n}x ${s}`).join(' | ')}`);

  ok('R-089: no week has more squats than hinges',
    unmatchedSquats.length === 0,
    `${unmatchedSquats.length} week(s) with an unmatched squat: ${unmatchedSquats.slice(0, 5).join(' ; ')}`);

  ok('R-089: no week has more single-leg knee than single-leg hip',
    unmatchedKnees.length === 0,
    `${unmatchedKnees.length} week(s) with an unmatched single-leg knee: ${unmatchedKnees.slice(0, 5).join(' ; ')}`);

  // ── AND THE SAME RULING, FROM THE CONTENT. See PAIR_SLOTS for why. ─────────
  //
  // THE NON-VACUITY FIRST, AND IT IS NOT THE SAME ARM AS THE ONE ABOVE. That one
  // proves the SLOT counters are live; this proves rows were read at all. If
  // `slotsForExerciseName` ever stopped answering for the app's own exercise
  // names, every content count would be 0, "no unmatched squat" would be true,
  // and it would mean nothing.
  ok('[R-089 content non-vacuity] pair-slot exposures were counted from the rows',
    contentPairExposures > 0,
    `0 pair-slot exposures across ${worldsBuilt} worlds — slotsForExerciseName has `
    + 'stopped recognising the app\'s own lifts, so the two content cells below are '
    + 'confident zeros about nothing.');

  ok('R-089 [CONTENT]: no week has more squats than hinges, counted from the rows',
    contentUnmatchedSquats.length === 0,
    `${contentUnmatchedSquats.length} week(s): ${contentUnmatchedSquats.slice(0, 5).join(' ; ')}`);

  ok('R-089 [CONTENT]: no week has more single-leg knee than single-leg hip, from the rows',
    contentUnmatchedKnees.length === 0,
    `${contentUnmatchedKnees.length} week(s): ${contentUnmatchedKnees.slice(0, 5).join(' ; ')}`);

  console.log(`  R-089 PAIR CENSUS: ${shapes.length} distinct week shapes, `
    + `${unmatchedSquats.length} unmatched squat, ${unmatchedKnees.length} unmatched single-leg knee`);
  for (const [shape, n] of shapes.slice(0, 6)) console.log(`    ${String(n).padStart(3)}x  ${shape}`);
  console.log(`  R-089 CONTENT CENSUS: ${contentPairExposures} pair-slot exposures read from rows, `
    + `${contentUnmatchedSquats.length} unmatched squat, `
    + `${contentUnmatchedKnees.length} unmatched single-leg knee`);
}

const total = passed + failures.length;
console.log(`\nWide ladder census: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
