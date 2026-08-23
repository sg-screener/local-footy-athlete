/**
 * ── DOES THIS SESSION ASK THE ATHLETE FOR A WEIGHT? ───────────────────────────
 *
 * A SESSION-LEVEL question, and it did not have an owner. `resolveLoadControlMode`
 * answers a different one — *"what kind of load does THIS EXERCISE take"* — from
 * the exercise NAME alone, with no idea which session the row is sitting in.
 *
 * That gap became visible with R-129. Sam, 2026-08-23, on the Primer: *"I
 * actually don't care about what weight they use or whether they tick it off or
 * not really … maybe it's worth removing the weight toggle completely from this
 * session?"* His Primer prescribes `Trap Bar Deadlift` and `Bench Press`, which
 * must keep their steppers in every strength session in the app and lose them
 * here. **A name-keyed answer cannot say that**, and adding those names to
 * `PREHAB_NO_LOAD_EXERCISES` would have deleted the stepper from real strength
 * days — the tempting one-line fix, and a live defect.
 *
 * ⚠ **THIS IS A DERIVATION, NOT STORED STATE.** The north star: store only
 * decisions, derive everything else. The decision is already stored — the
 * builder stamps `composedOptionalKind` — so no new field is written, nothing
 * has to survive a boot, and a session cannot end up disagreeing with itself
 * about whether it wants a weight.
 *
 * ⚠ **IT IS A SESSION PROPERTY, NOT A PRIMER BRANCH.** Sam, on being offered the
 * special-case build: *"no do it properly, build it the right way"*. Any session
 * type may join the set below by being added to it; nothing about the shape is
 * about the Primer.
 */

import type { Workout } from '../types/domain';

/**
 * Session kinds that never ask for a weight.
 *
 * A SET rather than a comparison so the membership question has one answer and a
 * second kind joins by being listed, not by growing an `||`.
 */
const KINDS_THAT_NEVER_ASK_FOR_LOAD: ReadonlySet<string> = new Set<string>([
  // PRIMER (R-129). The heavy row is deliberately vague — "heavy but easy,
  // around 70%" — and the app has no percent-of-1RM concept to make it precise.
  // Offering a kilogram box under a prescription the app cannot compute invites
  // a number nobody asked for; the note carries the intent instead.
  'primer',
]);

/**
 * True when the session wants a load control on its rows.
 *
 * Defaults to TRUE for everything, including a null workout: a missing session
 * must not silently strip a control the athlete expects, and the failure mode of
 * a wrongly-shown stepper is visible while a wrongly-hidden one is not.
 */
export function sessionAsksForLoad(
  workout: Pick<Workout, 'composedOptionalKind'> | null | undefined,
): boolean {
  const kind = workout?.composedOptionalKind;
  return !kind || !KINDS_THAT_NEVER_ASK_FOR_LOAD.has(kind);
}
