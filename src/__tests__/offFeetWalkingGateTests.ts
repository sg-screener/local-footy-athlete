/**
 * OFF YOUR FEET MEANS OFF YOUR FEET — including walking.
 *
 * SEAT_INBOX item 14, first in the batch, and the only member of it that can
 * change an athlete's training — so it gets the mutation testing 1c makes
 * mandatory for exactly that case.
 *
 * ## The defect, measured
 *
 * `conditioningFeasibility.ts` picks a conditioning family by trying each in
 * order and returning the first that is safe. Two of the three on-feet families
 * check `conditioningOffFeet`:
 *
 * - `outdoor_running` (:207) — `!lowerRestricted && !entry.conditioningOffFeet`
 * - `hill_running_or_walking` (:210) — the same
 * - `brisk_walking` (:215) — **`!lowerRestricted && stress !== 'hard'`, and
 *   NOTHING ABOUT `conditioningOffFeet`**
 *
 * So an athlete whose program says *stay off your feet* is refused running, is
 * refused hills, and is then handed **brisk walking** — which is the one thing
 * the instruction was about. Walking is exactly what an off-feet report means.
 *
 * ## AND THE SECOND HALF, ONE STEP LATER
 *
 * `:326-329` clears `conditioningOffFeet` when the resolved family is
 * `outdoor_running` or `hill_running_or_walking` — **and forgets
 * `brisk_walking`**. The same omission twice, in two places that had to agree
 * and were written separately. That is the shape item 14 names: *"declare
 * `onFeet` on the family table and derive both gates."*
 *
 * ## WHY THE FIX IS A TABLE AND NOT TWO MORE `&&`s
 *
 * Adding `&& !entry.conditioningOffFeet` at :215 fixes today and leaves the
 * next family to be forgotten in the same two places. `FAMILY_ON_FEET` states
 * the property once, per family, and both gates read it — so a family added
 * without an answer does not compile.
 *
 * Run: npm run test:off-feet-walking
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import {
  FAMILY_ON_FEET,
  familyIsOnFeet,
  substitutionDecision,
} from '../rules/conditioningFeasibility';
import type { ConditioningSubstitutionFamily } from '../types/domain';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${(error as Error)?.message ?? String(error)}`);
  }
}

// ── [1] WALKING IS ON YOUR FEET ────────────────────────────────────────────

run('walking is declared on-feet, with running and hills', () => {
  assert(familyIsOnFeet('brisk_walking') === true,
    'brisk_walking is not declared on-feet. An athlete told to stay OFF their '
    + 'feet was refused running, refused hills, and then handed WALKING — which '
    + 'is the one thing the instruction was about.');
  assert(familyIsOnFeet('outdoor_running') === true,
    'running stopped being on-feet');
  assert(familyIsOnFeet('hill_running_or_walking') === true,
    'hill running/walking stopped being on-feet');
});

run('the machines and the floor are off-feet', () => {
  for (const family of ['bike', 'row', 'ski'] as ConditioningSubstitutionFamily[]) {
    assert(familyIsOnFeet(family) === false,
      `${family} is declared on-feet — an off-feet athlete would lose the very `
      + 'families that exist for them, which is the defect pointing the other way');
  }
  assert(familyIsOnFeet('bodyweight_circuit') === false,
    'bodyweight_circuit is declared on-feet, removing the fallback an off-feet '
    + 'athlete lands on');
});

// ── [2] THE TABLE IS TOTAL ─────────────────────────────────────────────────
//
// The point of a table over two `&&`s: a family added without an answer must be
// impossible, not merely unlikely. TypeScript holds this at compile time; this
// cell holds it at run time so a cast cannot slip one through.

run('every conditioning family declares whether it is on feet', () => {
  // ELEVEN, NOT TEN, AND THE ELEVENTH IS A FINDING. `mixed` is in the family
  // UNION and absent from `ALL_FAMILIES` — the module's own list of families it
  // tries. The table caught it on its FIRST COMPILE, because a `Record` over the
  // union cannot be partial. That is the whole argument for a table over two
  // more `&&`s, made by the type checker before any cell ran.
  const families: ConditioningSubstitutionFamily[] = [
    'selected_modality', 'bike', 'row', 'ski', 'mixed', 'treadmill',
    'outdoor_running', 'hill_running_or_walking', 'brisk_walking',
    'bodyweight_circuit', 'safe_mixed_modal',
  ];
  const missing = families.filter((family) => typeof FAMILY_ON_FEET[family] !== 'boolean');
  assert(missing.length === 0,
    `${missing.join(', ')} has no on-feet answer. A family with no answer is a `
    + 'family both gates will guess about, separately, which is how walking was '
    + 'forgotten in two places at once.');
  assert(Object.keys(FAMILY_ON_FEET).length === families.length,
    `the table has ${Object.keys(FAMILY_ON_FEET).length} entries for `
    + `${families.length} families — it has drifted from the vocabulary it answers for`);
});

// ── [3] TREADMILL IS THE INTERESTING ONE, AND IT IS RULED ─────────────────
//
// A treadmill IS on your feet. But `conditioningOffFeet` in this engine is the
// athlete's report about IMPACT and terrain — it is set beside restrictions
// that refuse running and hills. The families that exist to serve an off-feet
// athlete are the machines, and the treadmill sits with them in `ALL_FAMILIES`
// ahead of outdoor running. Declaring it on-feet would remove a machine option
// from the athlete it was chosen for.
//
// Stated here rather than silently encoded, because it is the one entry in the
// table a reader could reasonably disagree with.

run('treadmill stays available to an off-feet athlete, deliberately', () => {
  assert(familyIsOnFeet('treadmill') === false,
    'treadmill was declared on-feet. That is defensible in the abstract and '
    + 'wrong here: `conditioningOffFeet` sits beside restrictions that refuse '
    + 'outdoor running and hills, and the treadmill is ordered with the '
    + 'machines that serve that athlete. If this is to change, it is a Sam '
    + 'ruling, not a tidy-up.');
});

// ── [4] AND THE CHOICE ITSELF, WHICH IS THE ONLY THING THAT MATTERS ───────
//
// Cells [1]-[3] assert a TABLE. The defect was a correct fact used in one place
// and forgotten in another, so a cell that only reads the fact would have been
// green throughout it. This one makes the decision and reads the answer.

function decideFor(offFeet: boolean, tags: string[] = ['bodyweight']) {
  return substitutionDecision({
    entry: {
      conditioningOffFeet: offFeet,
      conditioningCategory: 'aerobic',
      section18ConditioningRole: 'core',
      ergModality: undefined,
    } as never,
    // A HEALTHY athlete with no gear: the ONLY thing separating the two cases
    // below is the off-feet report itself, so nothing else can explain a
    // difference in the answer.
    context: {
      equipment: { tags, conditioningModalities: [] },
      profile: { injuries: [] },
      generationConstraints: { injuries: [] },
    } as never,
    allowed: [],
  });
}

run('an off-feet athlete is never handed an on-feet family', () => {
  const chosen = decideFor(true);
  assert(chosen !== null, 'the resolver produced no family at all for an off-feet athlete');
  assert(!familyIsOnFeet(chosen!.family),
    `an athlete told to stay OFF their feet was given '${chosen!.family}'. `
    + 'Before 2026-08-12 this returned `brisk_walking`: refused running, '
    + 'refused hills, then handed a walk — the one thing the instruction was '
    + 'about.');
  assert(chosen!.attempted.includes('brisk_walking'),
    `walking was never even ATTEMPTED (${chosen!.attempted.join(', ')}), so this `
    + 'cell passed without exercising the gate it exists for — the branch must '
    + 'be reached and REFUSED, not skipped');
});

run('an on-feet athlete can still walk', () => {
  const chosen = decideFor(false, []);
  assert(chosen !== null, 'the resolver produced no family for an on-feet athlete');
  assert(familyIsOnFeet(chosen!.family),
    `with no equipment and no off-feet report the resolver chose `
    + `'${chosen!.family}' instead of an on-feet family. The fix must refuse `
    + 'walking for the off-feet athlete WITHOUT taking it from everyone — a '
    + 'guard that always refuses is the defect pointing the other way.');
});

// ── WHAT THESE CELLS DO **NOT** COVER, MEASURED BY MUTATION ───────────────
//
// Reverting the CLEARING step at the bottom of the module — back to the
// hand-written `outdoor_running || hill_running_or_walking` pair that forgot
// walking — leaves this suite GREEN. That is not a gap in the cells; it is a
// fact about the code, and it is worth stating precisely:
//
//   once the SELECTION gate refuses walking to an off-feet athlete, the
//   combination the clearing step got wrong (`conditioningOffFeet` true AND
//   family `brisk_walking`) can no longer occur. The two shapes are
//   behaviourally identical TODAY.
//
// So the table there is defence against the NEXT family, not a fix with its own
// observable. Claiming otherwise would be a green cell making a false claim —
// and the honest form of this is `assert-neither-when-unproven`.

console.log(`\noff-feet walking gate: ${passed} passed, ${failed} failed`);
if (failures.length) console.log(`Failing: ${failures.join(', ')}`);
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
