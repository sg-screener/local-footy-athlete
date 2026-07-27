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
 * conditioning credit, not a finisher — is enforced today BY ABSENCE: power
 * lives in `workout.powerBlock`, so nothing that iterates `workout.exercises`
 * can count it. The `PowerBlockCountingFence` object documents a guarantee the
 * data shape already makes. Move power into the list and the guarantee is gone.
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
 * has not been declared exempt, so it counts — which is exactly what happens
 * today. That makes this module incapable of moving a count by omission, which
 * is what lets Stage 2 prove byte-equivalence rather than assert it.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import type { SessionRole } from '../utils/sessionRoles';

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
