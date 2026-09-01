import type { Workout } from '../types/domain';

/**
 * Gunshow and Primer are fixture-relative only when the scheduler authored the
 * allocation. Athlete-added sessions are accepted decisions and do not carry a
 * `sched:` allocation id, so fixture/source-fact recompilation must preserve
 * them.
 */
export function isAutomaticFixtureRelativePlannerOffer(
  workout: Pick<Workout, 'composedOptionalKind' | 'planEntryId'> | null | undefined,
): boolean {
  return (workout?.composedOptionalKind === 'gunshow'
      || workout?.composedOptionalKind === 'primer')
    && workout.planEntryId?.startsWith('sched:') === true;
}

/**
 * A later source fact may compile from the healthy block while the accepted
 * week already contains a fixture edit. Never let that later compilation
 * resurrect the block's old offer; the accepted fixture-relative answer owns
 * whether this date has one.
 */
export function preserveAcceptedFixtureRelativeOffer(
  accepted: Workout | null | undefined,
  planned: Workout | null | undefined,
): Workout | null | undefined {
  return isAutomaticFixtureRelativePlannerOffer(planned)
    && !isAutomaticFixtureRelativePlannerOffer(accepted)
    ? accepted
    : planned;
}
