/**
 * THE ORDERING. One statement, one owner.
 *
 * Sam's Option C addition to Stage B (2026-08-03): *"The precedence divergence
 * between live and accepted resolvers is Stage B's to fix in the same motion —
 * one ordering, one owner."* This module is that owner.
 *
 * ─── THE ORDERING, top to bottom ────────────────────────────────────────────
 *
 *   1. EMPTYING DECISIONS — a calendar mark, an active removal constraint.
 *      The athlete saying "not this day" outranks anything anyone composed
 *      onto it, including his own earlier edit and the coach's.
 *   2. COMPOSED CONTENT — `date_override` > `week_overlay` > `base_microcycle`.
 *      An athlete/coach decision beats fact-authored derived content, which
 *      beats the generated plan.
 *   3. DERIVATION — virtual games, proximity rules, freed slots, conditioning
 *      and recovery fill, then the injury filter. Owned by `sessionResolver`;
 *      this module only fixes where it starts.
 *   4. §18 — the accepted week's conformance pass, last.
 *
 * ─── WHY THIS ORDER AND NOT THE OTHER ───────────────────────────────────────
 *
 * Sam recorded the device consequence himself (`programStore.ts:1187-1196`):
 * the screen prescribed Lower Squat on a day he had marked rest "while the
 * accepted week correctly held nothing". *Correctly* — his own note names the
 * accepted answer as the right one, three actions from a fresh install, and it
 * went on to cost two further device findings because the move door compares
 * accepted against visible and was refusing correctly about a day that
 * disagreed with itself. The derived-repair ruling (2026-07-30) is the same
 * shape from the other side: a deletion door does not speak for the calendar.
 *
 * ─── WHAT THE MEASUREMENT ACTUALLY FOUND (2026-08-04) ────────────────────────
 *
 * The map that preceded this module described two stacks that "order the same
 * two inputs oppositely". **They do not. They run the same ordering code.**
 * `rebaseAcceptedEffectiveWeek` composes surfaces into a flat workout list and
 * hands it to `resolveFinalVisibleSection18Week`, which synthesises a throwaway
 * microcycle and calls `resolveWeekWithConditioning` — the live resolver —
 * with `manualOverrides: {}` and `weekScopedOverlays: {}`
 * (`section18AcceptedWeekGateway.ts:248-250`).
 *
 * So the accepted week's "marks last" was never a second ordering. It is the
 * LIVE ordering run against a blanked override surface: Priority 1 finds
 * nothing, the mark fires, the day comes back empty. **Flattening is what
 * demoted the override, and Priority 1 was the only thing in the app that ever
 * let an override outrank a mark.**
 *
 * Two consequences, both load-bearing:
 *
 * - The blanking at `:248-250` is NOT a defect to retire. Under this ordering
 *   it is exactly right: the composed content has already absorbed the
 *   override, and the emptying decision legitimately outranks it. The map
 *   called the blanking "the genuine unknown" that might force a larger unit.
 *   Once the ordering is chosen, it stops being a question.
 * - Convergence is therefore one-sided. The ACCEPTED stack does not move; the
 *   LIVE path stops making an exception for Priority 1. Every accepted-state
 *   suite stays green because nothing about the accepted stack changed.
 *
 * ─── THE SECOND DIVERGENCE IS NOT AN ORDERING QUESTION ──────────────────────
 *
 * `userRemovalConstraints` — the surface that makes a bin survive §18 — was
 * not a field on `ScheduleState` and appeared nowhere in `sessionResolver.ts`.
 * The live path could not order what it could not see. That is a missing
 * input, not a disagreement, and `removalConstraintForComposedDay` below is
 * where the live path now asks the same question the accepted stack asks.
 *
 * ─── DEPENDENCY RULE ────────────────────────────────────────────────────────
 *
 * This module imports TYPES and the canonical athlete-edit compiler only. It must never
 * import `sessionResolver`, `acceptedEffectiveWeek` or the §18 gateway: they
 * import it, and the cycle risk is real (the gateway already imports
 * `sessionResolver`). L14-clean — callable from a plain test with explicit
 * inputs, no store, no clock, no React.
 *
 * Gated by `src/__tests__/dayPrecedenceOwnershipTests.ts`
 * (`npm run test:day-precedence-ownership`), whose source-text cell fails if
 * any of the four consumer files goes back to composing surfaces by hand.
 */
import type { UserRemovalConstraint, Workout } from '../types/domain';
import { compileCanonicalAthleteEditedWeek } from './canonicalWeeklyAthleteEditCompiler';

/** Which surface a day's content came from. Ownership travels with content. */
export type DaySurfaceOwner =
  | 'date_override'
  | 'week_overlay'
  | 'base_microcycle'
  | 'empty';

export interface ComposedDaySurface {
  date: string;
  dayOfWeek: number;
  owner: DaySurfaceOwner;
  workout: Workout | null;
}

/** The Monday of `date`'s week. Was five hand-rolled copies; this is the one. */
export function mondayForDate(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayOfWeekForDate(dateISO: string): number {
  return new Date(`${dateISO.slice(0, 10)}T12:00:00`).getDay();
}

/**
 * Tier 2 of the ordering: compose one day's content from the decision surfaces.
 *
 * THE LOOKUP ASYMMETRY IS DELIBERATE AND IS THE ACCEPTED STACK'S OWN SEMANTIC,
 * preserved byte-for-byte from `acceptedEffectiveWeek.ts:115-126` so that
 * delegating is behaviour-preserving:
 *
 * - The override surface is tested for **truthiness**, so an explicit `null`
 *   entry falls through to overlay/base and means nothing.
 * - The overlay surface is tested with **`hasOwnProperty`**, so an explicit
 *   `null` entry IS honoured and means "this day is empty".
 *
 * That asymmetry is not an accident to tidy away. The product has no way to
 * express "the athlete cleared this day" as a null override — emptiness is
 * expressed through `userRemovalConstraints` and the canonical rest stub
 * (`canonicalWeeklyAthleteEditState.ts`, the `wholeDayRestOwned` branch), added
 * precisely because a calendar mark outranked every deriver and Sam ruled that
 * a deletion door does not speak for the calendar. A null override is
 * therefore a state no product writer produces, and every product reader
 * agreed on discarding it before this module existed. What did NOT agree was
 * the dev-E2E seed registry, which used `hasOwnProperty` on the override
 * surface and so modelled a semantic the product does not implement — a
 * witness could assert a state no product reader would ever produce. That is
 * the fixture-fidelity law (AGENTS.md) at the precedence layer, and it is why
 * the registry delegates here rather than keeping its own copy.
 */
export function composeDaySurfaces(args: {
  date: string;
  dayOfWeek?: number;
  dateOverrides?: Readonly<Record<string, Workout | null | undefined>> | null;
  /**
   * The overlay ALREADY SELECTED for this date's week by the caller. Callers
   * differ on how they select it (site 1 range-checks `weekStart`/`weekEnd`,
   * the others key straight off the Monday) and on whether they pass the
   * stored map or a locally validated one, so selection stays with the caller
   * and only the ordering lives here.
   */
  overlay?: { workoutsByDate: Readonly<Record<string, Workout | null | undefined>> } | null;
  base?: Workout | null;
}): ComposedDaySurface {
  const date = args.date.slice(0, 10);
  const dayOfWeek = args.dayOfWeek ?? dayOfWeekForDate(date);

  const manual = args.dateOverrides?.[date];
  if (manual) return { date, dayOfWeek, owner: 'date_override', workout: manual };

  const overlay = args.overlay ?? null;
  if (overlay && Object.prototype.hasOwnProperty.call(overlay.workoutsByDate, date)) {
    return {
      date,
      dayOfWeek,
      owner: 'week_overlay',
      workout: overlay.workoutsByDate[date] ?? null,
    };
  }

  const base = args.base ?? null;
  return base
    ? { date, dayOfWeek, owner: 'base_microcycle', workout: base }
    : { date, dayOfWeek, owner: 'empty', workout: null };
}

/**
 * Tier 1 of the ordering, constraint half: what an active removal constraint
 * leaves on this day, given what tier 2 composed onto it.
 *
 * Delegates to `compileCanonicalAthleteEditedWeek` rather than restating its
 * rules — the compiler-owned semantic edit state owns what a bin MEANS (the
 * `remainingWorkout` remainder, the `wholeDayRestOwned` rest stub and its
 * placement stamp). This module owns only WHERE it sits in the
 * order. Constraints are pre-filtered to the ones that speak about this date
 * so a constraint targeting another day cannot deposit its remainder here.
 *
 * Returns `null` when no constraint speaks about the date at all, so a caller
 * can tell "no constraint" from "a constraint that emptied the day".
 */
export function removalConstraintForComposedDay(args: {
  composed: ComposedDaySurface;
  constraints?: readonly UserRemovalConstraint[] | null;
}): { workout: Workout | null } | null {
  const { date, dayOfWeek } = args.composed;
  const speaking = (args.constraints ?? []).filter((constraint) =>
    constraint.status === 'active' &&
    (constraint.targetDate === date ||
      /* ── R-229 S2: A LATER EDIT OUTRANKS THE MOVE'S STORED COPY ──────────
       *
       * A move constraint's placement half replays `movedWorkout` — a stored
       * clone of the session AS IT WAS WHEN MOVED — onto the landing day, and
       * the canonical athlete-edit compiler clears the day first. MEASURED
       * 2026-08-26 (S2 probe, acted world): the athlete swapped an exercise
       * on the landed session, the swap's override was WRITTEN and then
       * invisible — this replay stamped the old copy back over it on every
       * read, the transaction's diff saw "no programming change", and the
       * whole edit rolled back. Launch-audit finding #1 root B.
       *
       * A `date_override` on the landing day is the athlete's NEWER decision
       * about that day's content (the move transaction owns the target date's
       * overrides at move time, so one present afterwards postdates the
       * move). The placement therefore YIELDS to it; the constraint's other
       * halves — emptying its source day — key on `targetDate` and are
       * untouched. */
      (constraint.moveTargetDate === date &&
        args.composed.owner !== 'date_override')));
  if (speaking.length === 0) return null;

  const resolved = compileCanonicalAthleteEditedWeek({
    workouts: args.composed.workout ? [args.composed.workout] : [],
    weekStartISO: mondayForDate(date),
    constraints: speaking,
  });
  return { workout: resolved.find((workout) => workout.dayOfWeek === dayOfWeek) ?? null };
}
