/**
 * The ONE role-filtered choke point.
 *
 * Sam's ruling (2026-07-27): "fence semantics at one role-filtered choke point
 * serving taxonomy and the exercise budget (one cap, every training age; power
 * rows never count against it)".
 *
 * ## Why one place rather than a guard per probe
 *
 * Power's counting fence — not a hard exposure, not main strength, no
 * conditioning credit, not a finisher — used to be enforced BY ABSENCE: power
 * lived in `workout.powerBlock`, so nothing that iterated `workout.exercises`
 * could count it, and the block's `counting` object merely documented a
 * guarantee the data shape already made. Power is a row now, so that guarantee
 * is gone and this module is what replaced it.
 *
 * The obvious repair is a guard at each counter. This repo bans that pattern for
 * good reason: `sessionTaxonomy` has FOUR probes over the row list today, and a
 * fifth added next month would silently miss its guard. So the probes stop
 * reading `workout.exercises` and read this instead. The fence gains a POSITIVE
 * definition for the first time — before: "power is not in the list"; after:
 * "power's role does not participate in counting" — a fact the code states
 * rather than one the data shape implies.
 *
 * ## The Explosive Push-up trap
 *
 * This is not theoretical. Of the seven power-pool entries, `Explosive Push-up`
 * matches `MAIN_LIFT_EXERCISE_RX` (via `push[-\s]?ups?`) and is a
 * `horizontal_press` exposure. As a row it would hand `hasMainLiftExercises`
 * main-lift proof, turning an accessory-named session into `upper_strength` and
 * flowing into `mainStrengthExposures`, the 4-session cap and hard-day grading —
 * directly contradicting `mainStrength: false`. Six of seven entries are
 * harmless; that asymmetry is why it would pass most tests and most device
 * passes.
 *
 * Hence the ordering rule this module exists to enforce: FILTER BY ROLE BEFORE
 * ANY NAME PROBE RUNS. A name probe over an unfiltered list is the bug.
 *
 * ## Why exemption rather than inclusion
 *
 * The predicate removes rows; it never adds them. A row with no authored role
 * has not been declared exempt, so it counts — which is exactly what happened
 * before roles existed. That makes this module incapable of moving a count by
 * omission, which is what let Stage 2 prove byte-equivalence rather than assert
 * it, and what keeps un-migrated legacy rows counting exactly as they always
 * did.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import type { SessionRole } from '../utils/sessionRoles';
import type { Section18RowRole } from './weeklyExposureContractV2';

/**
 * Roles whose rows take no part in counting — not in the taxonomy's
 * classification, and not against the per-session exercise cap.
 *
 * ONE entry today. It is a set rather than a comparison because
 * `conditioningBlock` and `speedBlock` have the same shape problem power did
 * (see the reassessment's scope boundary), and when they become rows they join
 * this set rather than growing a second mechanism beside it.
 *
 * Adding a role here is a counting change and must come with a golden diff.
 */
export const ROLES_EXEMPT_FROM_COUNTING: ReadonlySet<SessionRole> = new Set<SessionRole>([
  'power',
]);

/** Whether one row takes part in counting. Authored role only — never a name. */
export function participatesInCounting(row: Pick<WorkoutExercise, 'role'>): boolean {
  return !row.role || !ROLES_EXEMPT_FROM_COUNTING.has(row.role);
}

/**
 * The rows any counter may look at.
 *
 * Every taxonomy probe and the per-session exercise budget read this instead of
 * `workout.exercises`. Accepts a partial workout because the taxonomy classifies
 * loosely-typed hydrated content.
 */
export function countingRows(
  workout: Partial<Workout> | null | undefined,
): readonly WorkoutExercise[] {
  return (workout?.exercises ?? []).filter(participatesInCounting);
}

/**
 * THE ROLE CROSSWALK — the single bridge between the app's two row-role
 * vocabularies.
 *
 * `SessionRole` (six) is what a row IS, authored on the row and read for
 * ordering and counting. `Section18RowRole` (seven) is the same fact in Section
 * 18's spelling, stamped as row evidence for the weekly evaluator. They map 1:1
 * with one documented exception, and having two spellings of one fact is a
 * second representation — queued for collapse as its own unit (Sam, 2026-07-28).
 *
 * Until that lands, this is the ONE place the two are related, and
 * `sessionRowCountingTests` fails if either vocabulary grows a member this map
 * does not cover. That is the point: the collapse unit will be deleting around
 * these two, and silent drift while that happens is exactly how a fence goes
 * missing.
 *
 * `legacy_unknown` is the exception and is deliberately absent: it is an INGRESS
 * SENTINEL for hydrated rows whose evidence predates the classifier, not a kind
 * of work an author can choose. Nothing may map onto it.
 */
export const SESSION_ROLE_TO_SECTION18_ROW_ROLE: Readonly<Record<SessionRole, Section18RowRole>> = {
  power: 'power',
  main_lift: 'main_strength',
  accessory: 'strength_accessory',
  midline: 'trunk_support',
  prehab: 'recovery_support',
  conditioning: 'conditioning',
};

/** Section 18 row roles with no authored `SessionRole` partner, and why. */
export const SECTION18_ROW_ROLES_WITHOUT_SESSION_ROLE: readonly Section18RowRole[] = [
  'legacy_unknown',
];

/**
 * Position among the session's COUNTED work.
 *
 * `generatedWorkoutRowClassification` reads position as one signal of main-lift
 * identity ("the first row or two of a strength session is the main lift").
 * Power is pre-lift and leads the list, so a naive array index renumbers every
 * lift behind it: the session's second main lift slid from index 1 to index 2,
 * lost its main-lift claim, and the canonicaliser then RESTORED the "missing"
 * pattern as a fresh Back Squat row. Found by the differential harness on two
 * in-season days, in a delta that had nothing to do with power's own counts.
 *
 * So the index a classifier sees is the position among rows that count, which
 * power does not. Exempt rows get a sentinel far outside every positional
 * window rather than a real index — they are not in the ordering at all, and a
 * `-1` would silently satisfy an `index <= 1` test.
 *
 * This is a NARROW repair of the perturbation power introduced. It leaves the
 * deeper problem standing and visible: position feeding identity at all is the
 * pattern Sam's readiness law names as wrong ("dose/intensity/position must
 * never feed identity"). Retiring that clause would reclassify rows that are
 * main lifts ONLY by position and move counts across the app, so it belongs to
 * its own unit with its own before/after — not to this one.
 */
export const NON_COUNTING_ROW_INDEX = 99;

export function countingIndices(rows: readonly WorkoutExercise[]): number[] {
  let counted = 0;
  return rows.map((row) =>
    participatesInCounting(row) ? counted++ : NON_COUNTING_ROW_INDEX);
}

/** Whether a row is power work. The authored role decides — never the name. */
export function isPowerRow(row: Pick<WorkoutExercise, 'role'>): boolean {
  return row.role === 'power';
}

/**
 * The day's power rows, in authored order.
 *
 * The complement of what the counters see. `getSessionComponentRows` uses it to
 * give power its own population, the §18 weekly budget uses it to find and strip
 * candidates, and the session screen uses it to render power as an ordinary row.
 */
export function powerRows(
  workout: Partial<Workout> | null | undefined,
): readonly WorkoutExercise[] {
  return (workout?.exercises ?? []).filter(isPowerRow);
}

/** Whether the day carries power at all — the row-era `!!workout.powerBlock`. */
export function hasPowerRow(workout: Partial<Workout> | null | undefined): boolean {
  return (workout?.exercises ?? []).some(isPowerRow);
}

/**
 * RULING 4a (Sam, 2026-08-06): does this day's power count against the WEEKLY
 * PRIMER BUDGET?
 *
 * It does, everywhere but one place. The G-2 quality-lower session's jumps are
 * named by the Bible prescription itself — "2x3 box squats to high box + 2x3
 * vertical jumps" — and that prescription is game-aware BY DEFINITION: it exists
 * precisely because the day is two out from a fixture. Budgeting it against the
 * weekly selector allowance meant a week already carrying two team trainings and
 * a game derived a budget of 0 and stripped the authored half of a session the
 * same Bible line had just licensed.
 *
 * THE EXEMPTION IS SCOPED TO THAT SESSION AND NOTHING ELSE. The budget governs
 * every other day unchanged.
 *
 * ONE PREDICATE, TWO READERS, deliberately. `section18SafetyFinaliser` uses it to
 * decide what may be stripped, and `section18EffectiveWeekEvaluator` uses it to
 * decide what is COUNTED. An exemption known to only one of them is the exact
 * asymmetry the finaliser's own header calls the whole defect: content derived to
 * match its budget cannot be allowed to contradict it. If this predicate ever
 * grows a second copy, that is the bug.
 *
 * BIBLE_ANCHOR: lower_strength_g3
 */
export function budgetedPowerSession(
  workout: Partial<Workout> | null | undefined,
): boolean {
  if (!hasPowerRow(workout)) return false;
  return workout?.strengthVariant !== 'quality_low_volume';
}

/**
 * Remove power from a day — the row-era replacement for `powerBlock: undefined`.
 *
 * Nine sites used to delete the field. A field delete is invisible to every
 * owner: nothing canonicalises after it, nothing records that content left, and
 * the workout's name and type can end up describing work that is no longer
 * there. Row removal is an ordinary content mutation, so it goes back through
 * `finaliseWorkoutAfterMutation` at the call sites that own week content — which
 * is what Sam meant by stripping "through the transaction owner".
 *
 * This helper does the removal only. It deliberately does NOT canonicalise:
 * callers differ in the context they can supply (a §18 pass has the contract, a
 * safety pass has the phase clock), and inventing a context here is exactly the
 * defaulting the subphase fix removed.
 *
 * `familiesToRemove` scopes the removal to an injured region; omit it to remove
 * all power.
 */
export function withoutPowerRows(
  workout: Workout,
  familiesToRemove?: readonly string[],
): Workout {
  const rows = workout.exercises ?? [];
  const survivors = rows.filter((row) =>
    !isPowerRow(row) ||
    (familiesToRemove !== undefined && !familiesToRemove.includes(row.power?.family ?? '')));
  return survivors.length === rows.length ? workout : { ...workout, exercises: survivors };
}

/**
 * Rows that count against the per-session exercise cap.
 *
 * Section 11 (Sam, 2026-07-27): "There is now ONE per-session exercise cap for
 * every training age… power rows never count against that cap at any training
 * age, consistent with power's exclusion from every other count."
 *
 * Deliberately the SAME predicate as the taxonomy's, because it is the same
 * fence — one ruling, one filter. It is a separate export only so the cap's
 * eventual enforcement site reads as what it is.
 *
 * NOTE: nothing enforces a cap today. `trainingAgePolicy`'s
 * `maxExercisesPerStrengthSession` flows into `AIConstraints.maxExercisesPerSession`
 * and is read by no prompt builder, validator or trim. The Bible sentence about
 * power not counting against the cap is therefore true by construction for now.
 * When Sam designs the per-session controls (execution-order step 5), the cap is
 * enforced by counting THIS, and no new limit is invented on the way — §11
 * abolished the beginner-only cap precisely to stop that.
 */
export function exerciseBudgetRows(
  workout: Partial<Workout> | null | undefined,
): readonly WorkoutExercise[] {
  return countingRows(workout);
}
