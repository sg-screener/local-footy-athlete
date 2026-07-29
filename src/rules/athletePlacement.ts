import type { Workout } from '../types/domain';

/**
 * ATHLETE PLACEMENT — "the athlete put this session on this day."
 *
 * Sam's law (2026-07-28): athlete-placed content outranks derived filler. The
 * defect this exists to close: `applyGameProximity`'s G-1 branch overwrote a
 * session the athlete had deliberately moved onto the day before a game with
 * the derived Gunshow, and the move's conservation post-condition then refused
 * the whole thing. The athlete's choice lost to a filler that is regenerated
 * every render.
 *
 * OWNERSHIP — read this before adding a second writer.
 *
 * The stamp is DERIVED, not stored, and it is derived from the athlete-owned
 * SURFACES — of which there are exactly two, both persisted:
 *
 *   `removal_constraint` — a `UserRemovalConstraint`. Stamped inside
 *      `applyUserRemovalConstraintsToWeek`, the site that lands constraint-
 *      decided content on a day.
 *   `date_override` — an entry in `dateOverrides`, the persisted record of a
 *      human edit to one date. Stamped inside `rebaseAcceptedEffectiveWeek`,
 *      the site that composes the accepted week and the only place that knows
 *      which dates that surface owns.
 *
 * That is two derivation sites because there are two surfaces, and it is still
 * ONE predicate: `resolverMayDisplace` below, which every deriver asks and
 * nothing else. A third writer — an overlay, a repair, a finaliser — would mean
 * the resolver could be told "the athlete placed this" by something that is not
 * the athlete, which is exactly the confusion this marker exists to remove.
 *
 * THE SECOND SURFACE WAS MISSING, AND IT COST AN L4 VIOLATION (matrix catch #3,
 * `add_strength × derived_recovery_g_plus_1`). An add through the tap door
 * writes a date override and no constraint. The composed accepted week
 * therefore carried it unstamped, `resolveFinalVisibleSection18Week` resolves
 * with `manualOverrides: {}` — correctly, the content is already composed — and
 * the G+1 recovery deriver regenerated over it. The screen kept the session
 * because the live resolver answers ownership a different way (the
 * `source === 'manual'` short-circuit), so the athlete SAW "Lower Squat" while
 * the accepted week held "Recovery Session". Two mechanisms for one fact is
 * what produced the divergence; the stamp is the portable one, so it is the
 * one that survived.
 *
 * EVERY DOOR, NOT JUST MOVE (Sam, 2026-07-30, ruling #4). The stamp originally
 * covered only the move's `movedWorkout`. Swap, add and component-bin land their
 * content on the sibling `remainingWorkout` push a few lines earlier, so they
 * arrived unstamped and the derived G-1 Gunshow regenerated over them while the
 * sheet reported "Done." One defect, one site, four doors: the ingress stamps
 * unconditionally, because which door built the constraint is not information
 * about who owns the day.
 *
 * §18 repair relocation does NOT pass through that site and so is never
 * stamped: automatic heavy relocation onto G-1 stays refused. The ask-flow is
 * the only door onto G-1. `athleteSessionDeletionTests` regressions 14/15 pin
 * that boundary.
 */
export interface AthletePlacement {
  /** Always the athlete. A system author has no business writing this marker. */
  authorship: 'athlete';
  /** Which athlete-owned surface this stamp was derived from. */
  surface: AthletePlacementSurface;
  /**
   * The owning `UserRemovalConstraint` — the stored truth this is derived from.
   * Null on the `date_override` surface, whose stored truth is the override
   * entry itself and is keyed by date, not by id.
   */
  constraintId: string | null;
  /** The day the athlete chose, ISO `YYYY-MM-DD`. */
  placedDate: string;
}

/** The persisted surfaces that mean "the athlete decided this day". */
export type AthletePlacementSurface = 'removal_constraint' | 'date_override';

/**
 * Did the athlete deliberately put this session on this day?
 *
 * The inverse of `isResolverOwnedDerivedSession`. Where that predicate marks
 * content the resolver may freely regenerate, this marks content the resolver
 * must not touch.
 */
export function isAthletePlacedSession(
  workout: Workout | null | undefined,
): boolean {
  return workout?.athletePlacement?.authorship === 'athlete';
}

/**
 * May the resolver replace what is on this day with content of its own?
 *
 * THE ONE PREDICATE. The resolver builds derived sessions at six sites, and
 * for a long time exactly one of them — the G-1 branch — knew about the stamp,
 * because that is where the device found the defect. The other five each had
 * their own opinion about what may be replaced (a name-and-tier heuristic, a
 * source check, or nothing at all), so the same athlete-placed session survived
 * Friday and was silently eaten on Sunday.
 *
 * Every deriver now asks this and nothing else. `resolverDisplacementSweepTests`
 * is the table: one row per site, both directions, and a new site fails the
 * suite until it has answered the question too.
 */
export function resolverMayDisplace(
  workout: Workout | null | undefined,
): boolean {
  return !isAthletePlacedSession(workout);
}

/** The marker for a session the athlete moved onto `placedDate`. */
export function athletePlacementFor(args: {
  constraintId: string;
  placedDate: string;
}): AthletePlacement {
  return {
    authorship: 'athlete',
    surface: 'removal_constraint',
    constraintId: args.constraintId,
    placedDate: args.placedDate.slice(0, 10),
  };
}

/**
 * The marker for a session the athlete owns because a date override says so.
 *
 * The override IS the stored truth here — `dateOverrides[date]` is the
 * persisted record of the human edit — so there is no id to carry, only the
 * date it is keyed by. Written at exactly one site
 * (`rebaseAcceptedEffectiveWeek`); see the ownership note at the top of this
 * file before adding a second.
 */
export function athletePlacementForDateOverride(args: {
  placedDate: string;
}): AthletePlacement {
  return {
    authorship: 'athlete',
    surface: 'date_override',
    constraintId: null,
    placedDate: args.placedDate.slice(0, 10),
  };
}
