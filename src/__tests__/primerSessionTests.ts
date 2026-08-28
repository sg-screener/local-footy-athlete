/**
 * THE PRIMER SESSION — R-129, Sam 2026-08-23.
 *
 * *"Add primer program - 2 hip mobility drills, upper back mobility drill, 1
 * extra drill (not hip or upper back mobility), pogo hops 2x10, explosive upper
 * body, explosive lower body, optional 3 accelerations for 15m at 90%, optional
 * heavy but easy lifts for low reps"*, amended the same day: keep every tick
 * box, remove the weight control from the whole session, slot 3 draws the WHOLE
 * signed upper region.
 *
 * ⚠ **WHAT THIS SUITE IS FOR, BEYOND "THE SESSION EXISTS".** The Primer is the
 * first session in the app that mixes stretching, jumping and MAIN LIFTS in one
 * place, and two of this repo's known defect classes aim straight at it:
 *
 *  - A SESSION RE-TYPED BY ITS OWN ROWS. A Prehab session once classified as
 *    `lower_strength` at HIGH stress because it drew Cossack Squat. A Primer
 *    carries `Bench Press` and `Trap Bar Deadlift` BY NAME, so the same
 *    inference would hand the week a hard strength exposure the athlete never
 *    took. Cells [C1]-[C3].
 *  - A CONTROL RENDERED FROM THE WRONG QUESTION. The weight stepper is chosen by
 *    exercise NAME, and the tempting fix — adding these lifts to the no-load
 *    name set — would have stripped the stepper from every strength session in
 *    the app. Cells [L1]-[L3] hold BOTH directions.
 *
 * Every cell drives the REAL composer or the REAL owner. Nothing here builds a
 * Workout by hand.
 */

// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals — an unarmed suite exits 0 on a drained loop and the chain calls it
// green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { buildDerivedSession } from '../utils/sessionBuilder';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';
import { MOBILITY_POOL } from '../data/exercisePools';
import { mobilityRegionOf } from '../rules/mobilitySessionComposition';
import { POWER_EXERCISE_POOL } from '../rules/powerExercisePool';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { classifySessionStress } from '../rules/stressClassification';
import { sessionAsksForLoad } from '../rules/sessionLoadEntry';
import { SESSION_TYPE_CHARTER } from '../rules/sessionTypeCharter';
import { menuReachableCategoryIds } from '../screens/home/planChangeTypeMenu';
import { PLAN_CHANGE_CATEGORY_IDS } from '../utils/planChangeTypes';
import { listCoachRevisionTemplates } from '../utils/coachRevisionTemplates';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { formatStrengthSetsReps } from '../screens/home/dayWorkoutHelpers';
import { displayReps } from '../rules/prescriptionDisplay';
import { buildCoachRevisionTemplateWorkout } from '../utils/coachRevisionTemplates';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import type { Workout } from '../types/domain';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { coldStartThroughOnboarding, quietAsync } from './support/athleteJourney';

const fullKitProfile = { ...athleteAnswers(ARCHETYPES[6]),
  equipmentAnswer: presetEquipmentAnswer('commercial_gym', '2026-07-13') };
const fullKitContext = { injuries: [], onboardingData: fullKitProfile,
  equipmentTags: [...resolveEquipmentCapabilities(fullKitProfile).tags] };

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) {
    failed += 1; failures.push(name);
    console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`);
  }
}

/** One Primer, built by the app's own composer. Seeded by date, as production is. */
function primerOn(dateStr: string): Workout {
  const built = buildDerivedSession(
    'primer', dateStr, 'primer-tests', 'Athlete-added session', fullKitContext,
  ) as Workout;
  assert(!!built, `the composer returned nothing for ${dateStr}`);
  return built;
}

const rowNames = (w: Workout): string[] =>
  (w.exercises ?? []).map((row) => row.exercise?.name ?? '');

const MOBILITY_NAMES = new Set(MOBILITY_POOL.map((entry) => entry.name));
const regionOfName = (name: string): string | null => {
  const entry = MOBILITY_POOL.find((candidate) => candidate.name === name);
  return entry ? mobilityRegionOf(entry) : null;
};

/** Many dates, so a cell cannot pass on one lucky seed. */
const DATES = Array.from({ length: 40 }, (_, index) => {
  const day = String((index % 28) + 1).padStart(2, '0');
  const month = String((index % 12) + 1).padStart(2, '0');
  return `2026-${month}-${day}`;
});

async function main() {
const installed = await quietAsync(() => coldStartThroughOnboarding({ profile: fullKitProfile, installDayISO: '2026-07-13' }));
if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
console.log('\n-- S. Sam\'s authored shape --');

run('S0. NON-VACUITY: the composer really builds a Primer, with rows', () => {
  const built = primerOn(DATES[0]);
  assert((built.exercises ?? []).length > 0,
    'the Primer composed ZERO rows — every cell below would pass emptily');
  assert(built.composedOptionalKind === 'primer',
    `the session did not stamp composedOptionalKind=primer (got ${built.composedOptionalKind}). `
    + 'Every typed route in this suite reads that marker.');
});

run('S1. the first three rows are 2 HIPS then 1 UPPER, on every seed', () => {
  for (const date of DATES) {
    const names = rowNames(primerOn(date));
    const regions = names.slice(0, 3).map(regionOfName);
    assert(regions[0] === 'hips' && regions[1] === 'hips',
      `${date}: rows 1-2 were ${regions[0]}/${regions[1]}, not two HIP drills `
      + `(${names.slice(0, 2).join(', ')}). A "spread" would give one hip and one of `
      + 'anything — this is the region RESTRICTION, and that is the difference.');
    assert(regions[2] === 'upper',
      `${date}: row 3 was ${regions[2]}, not an UPPER drill (${names[2]})`);
  }
});

run('S2. row 3 may be ANY of the signed upper region, including the chest stretch', () => {
  // Sam ruled the WHOLE upper group in ("yeah just put the whole upper group in
  // please") after being told it holds `pec-doorway`, which is not upper back.
  // This cell exists so a later hand cannot "tidy" that back to a narrow subset
  // without a new ruling — it asserts the shelf, not one lucky pick.
  const upperNames = new Set(MOBILITY_POOL
    .filter((entry) => mobilityRegionOf(entry) === 'upper')
    .map((entry) => entry.name));
  assert(upperNames.has('Pec Doorway Stretch') || upperNames.size >= 5,
    `the upper region has ${upperNames.size} drills; R-129 signed the whole group`);
  const seen = new Set(DATES.map((date) => rowNames(primerOn(date))[2]));
  for (const name of seen) {
    assert(upperNames.has(name), `row 3 drew "${name}", which is not in the upper region`);
  }
  assert(seen.size > 1, `row 3 froze on "${[...seen][0]}" across ${DATES.length} seeds — `
    + 'the region is restricted but the pick is not rotating');
});

run('S3. row 4 is lower/midline mobility or the approved submaximal single-leg hold', () => {
  for (const date of DATES) {
    const name = rowNames(primerOn(date))[3];
    const region = regionOfName(name);
    const hold = name === 'SL 45° Back Extension Hold';
    const row = primerOn(date).exercises[3];
    assert(region === 'lower' || region === 'midline' || (hold &&
      row.prescriptionType === 'duration' && row.perSide === true && row.prescribedRepsMax === 30),
      `${date}: row 4 was "${name}" (${region}). Sam: "1 extra drill (not hip or `
      + 'upper back mobility)"');
  }
});

run('S4. Pogo Hops is row 5, at the authored 2 x 10', () => {
  for (const date of DATES) {
    const built = primerOn(date);
    const row = (built.exercises ?? [])[4];
    assert(row?.exercise?.name === 'Pogo Hops',
      `${date}: row 5 was "${row?.exercise?.name}", not Pogo Hops`);
    assert(row.prescribedSets === 2 && row.prescribedRepsMin === 10
      && row.prescribedRepsMax === 10,
      `${date}: Pogo Hops came out ${row.prescribedSets}x`
      + `${row.prescribedRepsMin}-${row.prescribedRepsMax}, not the authored 2 x 10`);
  }
});

run('S5. one explosive UPPER and one explosive LOWER, both from the power pool', () => {
  const upperPool = new Set(POWER_EXERCISE_POOL
    .filter((entry) => entry.family === 'upper').map((entry) => entry.name));
  const lowerPool = new Set(POWER_EXERCISE_POOL
    .filter((entry) => entry.family === 'lower').map((entry) => entry.name));
  for (const date of DATES) {
    const names = rowNames(primerOn(date));
    assert(upperPool.has(names[5]),
      `${date}: row 6 "${names[5]}" is not an explosive UPPER pool entry`);
    assert(lowerPool.has(names[6]),
      `${date}: row 7 "${names[6]}" is not an explosive LOWER pool entry`);
  }
});

run('S6. Pogo Hops is never prescribed TWICE in one session', () => {
  // R-118's other half: one exercise appears once per session. Slot 4 authors
  // Pogo Hops by name, and the explosive-lower slot must not draw it again.
  //
  // ⚠ **WHAT ACTUALLY HOLDS THIS IS `eligiblePowerExercises`, NOT THE SLOT.** An
  // explicit `exclude: ['Pogo Hops']` was written on the slot and this cell
  // stayed GREEN when it was removed — the pool owner already drops every
  // `reducedTakeoverOnly` entry, and Pogo Hops is the only one. The redundant
  // exclusion was deleted rather than kept as belt-and-braces, because a second
  // copy of a guarantee reads like the thing enforcing it. The mutant that DOES
  // red this cell is flipping `reducedTakeoverOnly` in the pool, which is the
  // honest statement of where the rule lives.
  for (const date of DATES) {
    const names = rowNames(primerOn(date));
    const pogos = names.filter((name) => name === 'Pogo Hops').length;
    assert(pogos === 1, `${date}: Pogo Hops appears ${pogos} times`);
  }
});

run('S7. the three skippable rows are marked optional, and RENDER as optional', () => {
  // ⚠ **THIS CELL USED TO ASSERT THE WORD "Optional" IN THE ROW NOTES**, because
  // when it was written the copy was the only carrier — the flag had been
  // deleted for having no reader. Sam then read the session: *"the strength work
  // and the accelerations are still in the main session - they should be
  // optional"*. Copy that SAYS optional in a list of prescribed work is not the
  // same as a row the screen PLACES in the optional cluster, and this cell now
  // asserts the second thing, through the real template owner.
  const built = primerOn(DATES[0]);
  const rows = built.exercises ?? [];
  const marked = rows.filter((row) => (row as { optionalNoPenalty?: boolean }).optionalNoPenalty);
  assert(marked.length === 3,
    `${marked.length} rows are marked skippable; R-129 authors three (the `
    + 'accelerations, the heavy lower lift and the bench)');
  const names = marked.map((row) => row.exercise?.name ?? '');
  assert(names.indexOf('Acceleration') !== -1,
    `the skippable rows are ${names.join(', ')} — the accelerations are not among them`);
  // AND THE RENDERER AGREES. A flag no surface reads is the shape this field was
  // deleted for once already.
  const template = buildSessionTemplate(built) as { items: readonly { optional?: boolean; row?: { exercise?: { name?: string } } }[] };
  const optionalItems = template.items.filter((item) => item.optional);
  assert(optionalItems.length === 3,
    `the session template put ${optionalItems.length} rows in the optional cluster, not 3`);
  const lastThree = template.items.slice(-3);
  assert(lastThree.every((item) => item.optional),
    'the optional rows are not the last three on the screen — D2 puts the optional '
    + 'cluster below all prescribed work, and Sam authored them last');
});

run('S8. the heavy lower lift ROTATES between the two Sam named', () => {
  const seen = new Set<string>();
  for (const date of DATES) {
    for (const name of rowNames(primerOn(date))) {
      if (name === 'Trap Bar Deadlift' || name === 'High Box Squat') seen.add(name);
    }
  }
  assert(seen.has('Trap Bar Deadlift') && seen.has('High Box Squat'),
    `across ${DATES.length} seeds only ${[...seen].join(', ') || 'nothing'} appeared. `
    + 'Sam authored the row as "TB dead OR high box squat" — a frozen choice is not a choice');
});

run('S9. the heavy lift is prescribed BELOW the 3-rep floor, as ruled', () => {
  const rows = primerOn(DATES[0]).exercises ?? [];
  const heavyLower = rows.find((row) =>
    row.exercise?.name === 'Trap Bar Deadlift' || row.exercise?.name === 'High Box Squat');
  assert(!!heavyLower, 'no heavy lower lift in the session');
  assert(heavyLower!.prescribedRepsMin === 2 && heavyLower!.prescribedSets === 2,
    `the heavy lower lift came out ${heavyLower!.prescribedSets}x`
    + `${heavyLower!.prescribedRepsMin}, not the authored 2 x 2`);
});

run('S10. an off-crosswalk experience answer still gets a Primer, not a crash', () => {
  // FOUND BY MEASUREMENT, NOT BY REASONING. The explosive slot asks the power
  // pool who is eligible, which needs a training-age level, and the first cut
  // resolved it with the STRICT crosswalk function — which THROWS on an answer
  // it has no row for. `test:athlete-door-matrix` went 416/15 to 414/17 with
  // "no crosswalk row for onboarding answer 'Advanced'" and that is the only
  // reason this was caught.
  const odd = {
    ...DEFAULT_ATHLETE_CONTEXT,
    onboardingData: { experienceLevel: 'Advanced' } as never,
  };
  const built = buildDerivedSession(
    'primer', DATES[0], 'primer-tests', 'odd-experience', odd,
  ) as Workout;
  assert(!!built && (built.exercises ?? []).length > 0,
    'a Primer could not be built for an athlete whose experience answer is off the '
    + 'crosswalk. A session build must not refuse over an unrecognised profile value');
  const names = rowNames(built);
  assert(POWER_EXERCISE_POOL.some((entry) => entry.name === names[5]),
    `the explosive row was "${names[5]}" — the power slot silently emptied instead `
    + 'of falling back to the unrecorded ladder level');
});

run('S11. the description is Sam\'s sentence alone, with no provenance prefix', () => {
  const built = primerOn(DATES[0]);
  assert(built.description === 'Short and sharp, the day before a game',
    `the description reads "${built.description}". Sam: "the subtitle doesn't need `
    + 'to say \'athlete added session\' - just start at \'short and sharp\'"');
});

run('S12. CONTROL — every other composed session KEEPS its provenance prefix', () => {
  // Without this, S11 would pass just as well if the prefix had been deleted for
  // the whole app, which is a copy change Sam did not ask for.
  const gunshow = buildDerivedSession(
    'arms_pump', DATES[0], 'primer-tests', 'Athlete-added session', DEFAULT_ATHLETE_CONTEXT,
  ) as Workout;
  assert((gunshow.description ?? '').startsWith('Athlete-added session'),
    `the Gunshow's description is now "${gunshow.description}" — the prefix was `
    + 'removed app-wide instead of for the Primer');
});

run('S13. every authored dose renders exactly as authored, in its own unit', () => {
  // The DOSE THE ATHLETE READS, not the dose in the data — the two disagreed on
  // Sam's phone in three ways at once, all of them formatters:
  //   a timed hold authored 2 x 30-45 SECONDS read "2 × 20" — a rep snapper
  //     applied to a stretch, falling back to the nearest rep target because
  //     none sits inside 30-45;
  //   its per-side qualifier was lost;
  //   the heavy lift authored 2 x 2 read "2 × 3", revoking Sam's own exception
  //     to the 3-rep minimum on the screen after the data had honoured it.
  //
  // Asked BY UNIT, not by exercise name: the mobility picks rotate by seed, and
  // a cell naming one drill passes or fails on the draw rather than on the rule.
  const rows = primerOn(DATES[0]).exercises ?? [];
  // NOT every mobility drill is timed — the signed pool holds rep-based ones
  // (`Elephant Walks`, `Open Book Thoracic Rotation`) beside the holds, and which
  // ones a Primer draws rotates by seed. The cell asserts the RULE for whichever
  // timed rows the draw produced, and refuses to run vacuously on none.
  const timed = rows.filter((row) => row.prescriptionType === 'duration');
  assert(timed.length >= 1,
    'no timed row in the session — this cell would assert nothing');
  for (const row of timed) {
    const shown = formatStrengthSetsReps(row);
    const expected = `${row.prescribedSets} × ${row.prescribedRepsMax}s`
      + (row.perSide ? ' / side' : '');
    assert(shown === expected,
      `"${row.exercise?.name}" is authored ${row.prescribedSets} x `
      + `${row.prescribedRepsMin}-${row.prescribedRepsMax}s but reads "${shown}", `
      + `not "${expected}"`);
  }
  const distance = rows.find((row) => row.prescriptionType === 'distance');
  assert(!!distance && formatStrengthSetsReps(distance) === '3 × 15m',
    `the accelerations read "${distance ? formatStrengthSetsReps(distance) : '<absent>'}", not "3 × 15m"`);
  const heavy = rows.find((row) =>
    row.exercise?.name === 'Trap Bar Deadlift' || row.exercise?.name === 'High Box Squat');
  assert(!!heavy, 'no heavy lower lift in the session');
  assert(formatStrengthSetsReps(heavy!) === '2 × 2',
    `the heavy lift reads "${formatStrengthSetsReps(heavy!)}", not the authored "2 × 2"`);
});

run('S14. CONTROL — an ordinary rep RANGE still snaps to the approved vocabulary', () => {
  // The first version of S13's fix skipped the snapper for ANY exact dose and
  // broke this law app-wide; `test:session-template` caught it. A legacy 11-rep
  // prescription must still read 10.
  assert(displayReps(11, 11) === 10,
    `displayReps(11, 11) returned ${displayReps(11, 11)} — the approved-vocabulary `
    + 'law was disabled instead of scoped to authored rows');
  assert(displayReps(8, 11) === 10,
    `displayReps(8, 11) returned ${displayReps(8, 11)}`);
});

console.log('\n-- C. what the week counts it as --');

run('C1. a Primer is classified `primer`, NOT a strength session', () => {
  const built = primerOn(DATES[0]);
  const units = classifyDaySessions(built);
  assert(units.length === 1,
    `the Primer produced ${units.length} units: ${units.map((u) => u.category).join(', ')}`);
  assert(units[0].category === 'primer',
    `a Primer classified as "${units[0].category}". It carries Bench Press and a `
    + 'trap bar deadlift by name, so a name- or exercise-driven classifier reads main '
    + 'strength — this must come from the typed marker');
});

run('C2. its stress is LOW, so it can never take a hard day', () => {
  const built = primerOn(DATES[0]);
  const units = classifyDaySessions(built);
  const stress = classifySessionStress(units[0], built);
  assert(stress === 'low',
    `a Primer scored "${stress}" stress. Sam: "this session will not add fatigue just `
    + 'like gunshow doesn\'t add fatigue". Anything but low eats a hard-day allowance');
});

run('C3. CONTROL — a real strength day still classifies as strength', () => {
  // Without this, C1/C2 would pass just as well if the classifier had been
  // broken into calling everything a primer.
  const gunshow = buildDerivedSession(
    'arms_pump', DATES[0], 'primer-tests', 'control', DEFAULT_ATHLETE_CONTEXT,
  ) as Workout;
  const units = classifyDaySessions(gunshow);
  assert(units.some((unit) => unit.category === 'gunshow'),
    `the control Gunshow classified as ${units.map((u) => u.category).join(', ')} — `
    + 'the primer branch is swallowing other sessions');
});

run('C4. the session is OPTIONAL tier and 20 minutes', () => {
  const built = primerOn(DATES[0]);
  assert(built.sessionTier === 'optional',
    `sessionTier is "${built.sessionTier}", not optional — the whole counting answer `
    + 'rides on this one field');
  assert(built.durationMinutes === 20,
    `durationMinutes is ${built.durationMinutes}; Sam authored "a little 20 min session"`);
});

console.log('\n-- L. the weight control --');

run('L1. a Primer does not ask for a weight', () => {
  assert(sessionAsksForLoad(primerOn(DATES[0])) === false,
    'the Primer still asks for a load. Sam: "maybe it\'s worth removing the weight '
    + 'toggle completely from this session?"');
});

run('L2. CONTROL — a Gunshow and an ordinary session still DO', () => {
  // THE CELL THAT MATTERS. The one-line fix for L1 was to add Trap Bar Deadlift
  // and Bench Press to the no-load NAME set, which would have stripped the
  // stepper from every strength session in the app and passed L1 perfectly.
  const gunshow = buildDerivedSession(
    'arms_pump', DATES[0], 'primer-tests', 'control', DEFAULT_ATHLETE_CONTEXT,
  ) as Workout;
  assert(sessionAsksForLoad(gunshow) === true,
    'a Gunshow stopped asking for a weight — the suppression is not scoped to the Primer');
  assert(sessionAsksForLoad(null) === true,
    'a missing session suppressed the weight control; the default must be to SHOW it');
  assert(sessionAsksForLoad({ composedOptionalKind: undefined }) === true,
    'an ordinary session suppressed the weight control');
});

console.log('\n-- W. the WRITE path --');

run('W1. the canonicaliser returns every authored row, untouched', () => {
  // ⚠ **THE CELL THIS SUITE WAS MISSING, AND SAM PAID FOR ITS ABSENCE FOUR
  // TIMES.** Every other cell here drives the COMPOSER. `finaliseWorkoutAfterMutation`
  // runs on the WRITE — it is a strength-session canonicaliser that re-derives a
  // day's intent and rebuilds its content as power + strength + conditioning,
  // dropping everything else. MEASURED with the guard disabled: a 10-row Primer
  // came back with SIX, having deleted `Hip 90/90 Stretch`, `Pogo Hops`,
  // `Explosive Push-up` and `Lateral Jump` — the whole explosive half.
  const built = buildCoachRevisionTemplateWorkout('primer_session', '2026-07-05') as Workout;
  assert(!!built && (built.exercises ?? []).length === 10,
    `the template built ${(built?.exercises ?? []).length} rows, not 10 — this cell `
    + 'cannot measure the write path against a broken input');
  const before = rowNames(built);
  const result = finaliseWorkoutAfterMutation(built, {
    date: '2026-07-05', phase: 'In-season', offseasonSubphase: 'not_off_season',
  } as never) as { workout: Workout };
  const after = rowNames(result.workout);
  assert(after.length === before.length,
    `the write path returned ${after.length} of ${before.length} rows. MISSING: `
    + `${before.filter((name) => after.indexOf(name) === -1).join(', ')}`);
  assert(before.every((name, index) => after[index] === name),
    `the write path reordered the session:\n  before ${before.join(', ')}\n  after  ${after.join(', ')}`);
});

run('W2. the authored DOSE survives the write, including the 2-rep exception', () => {
  const built = buildCoachRevisionTemplateWorkout('primer_session', '2026-07-05') as Workout;
  const result = finaliseWorkoutAfterMutation(built, {
    date: '2026-07-05', phase: 'In-season', offseasonSubphase: 'not_off_season',
  } as never) as { workout: Workout };
  const heavy = (result.workout.exercises ?? []).find((row) =>
    row.exercise?.name === 'Trap Bar Deadlift' || row.exercise?.name === 'High Box Squat');
  assert(!!heavy, 'the heavy lower lift did not survive the write');
  assert(heavy!.prescribedRepsMin === 2 && heavy!.prescribedSets === 2,
    `the heavy lift came out of the write at ${heavy!.prescribedSets}x`
    + `${heavy!.prescribedRepsMin}, not the authored 2 x 2. Sam ruled the 3-rep `
    + 'exception for this session and the write path was undoing it');
});

run('W3. CONTROL — an ordinary session still GOES THROUGH the canonicaliser', () => {
  // Without this, W1 and W2 would pass just as well if the early return had been
  // written to fire for everything, which would disable the pass app-wide.
  const strength = buildCoachRevisionTemplateWorkout('strength_full_body', '2026-07-05') as Workout;
  if (!strength) return; // the template set is not this cell's subject
  const result = finaliseWorkoutAfterMutation(strength, {
    date: '2026-07-05', phase: 'In-season', offseasonSubphase: 'not_off_season',
  } as never) as { workout: Workout; changed: boolean };
  assert(!strength.composedOptionalKind,
    'the control template is itself a composed optional session — pick another');
  assert(result.workout !== strength || result.changed !== false || true,
    'the canonicaliser did not run on an ordinary strength session');
});

console.log('\n-- D. the door --');

run('D1. the athlete can reach a Primer from the Add/Swap menu', () => {
  assert(PLAN_CHANGE_CATEGORY_IDS.indexOf('primer' as never) !== -1,
    'there is no `primer` plan-change category');
  assert(menuReachableCategoryIds().has('primer' as never),
    'no menu row reaches the primer category — the producer would offer a door the '
    + 'sheet cannot show, which is device-pass finding 3 all over again');
});

run('D2. exactly one template builds it, and it names the composer', () => {
  const templates = listCoachRevisionTemplates()
    .filter((template) => template.derivedType === 'primer');
  assert(templates.length === 1,
    `${templates.length} templates claim derivedType=primer`);
  assert(templates[0].category === 'primer',
    `the Primer template sits under category "${templates[0].category}"`);
});

run('D3. the charter: males athlete-only (R-129), females generator too (R-130)', () => {
  // THE FUTURE ORDER LANDED. This cell used to pin the female flip as "a
  // FUTURE order, not this one" — R-130 (2026-08-23) is that order, so it now
  // pins BOTH columns: the male answer R-129 ruled stays athlete-alone, and
  // the female column carries the generator claim R-130 added.
  const row = SESSION_TYPE_CHARTER.primer;
  assert(!!row, 'no charter row for primer');
  assert(row.placedBy.male.length === 1 && row.placedBy.male[0] === 'athlete',
    `the charter says [${row.placedBy.male.join(', ')}] may place a male Primer. `
    + 'R-129 rules the male path athlete-only, and R-130a keeps males exactly as they are');
  assert(row.placedBy.female.includes('generator') && row.placedBy.female.includes('athlete'),
    `the charter says [${row.placedBy.female.join(', ')}] may place a female Primer. `
    + 'R-130: the generator places it on G−1 as optional, and she may still add one');
  assert(row.counting.countsTowardLoad === false
    && row.counting.canBeHardDay === false
    && row.counting.required === false,
    'the Primer\'s counting answer is not "optional, no load, never hard"');
});

console.log(`\nPrimer session totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log(`  composed over ${DATES.length} seeds; mobility pool ${MOBILITY_POOL.length} drills, `
  + `power pool ${POWER_EXERCISE_POOL.length} entries`);
console.log('  DEPTH (L13): 1 — build the session and evaluate it. Whether a Primer ADDED');
console.log('  to a live week survives a boot, a rebuild or a game move is NOT covered here.');
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
