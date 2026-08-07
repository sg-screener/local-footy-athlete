/**
 * The world a cell is evaluating, stated rather than assumed
 * (`docs/SURFACES_CONTEXT_RULING_2026-08-06.md`).
 *
 * The gateway's evaluation context is required, so a cell must say which world
 * its week is judged against. Most cells mean "a world with no accepted
 * surfaces and no removal decisions", and that is what `emptyEvaluationSurfaces`
 * says — explicitly, in one place, so a cell that means something else is
 * visibly different rather than accidentally identical.
 */
import type { AcceptedEffectiveWeekSurfaces } from '../rules/acceptedEffectiveWeek';
import { composeAcceptedEffectiveWeekSurfaces } from '../utils/liveEvaluationSurfaces';
import type { UserRemovalConstraint } from '../types/domain';

export function emptyEvaluationSurfaces(): AcceptedEffectiveWeekSurfaces {
  return composeAcceptedEffectiveWeekSurfaces({
    currentProgram: null,
    removalDecisions: [],
  });
}

/**
 * A world whose only distinguishing fact is what the athlete has binned.
 *
 * ONE argument still, because a cell means one thing: these removals are the
 * athlete's decisions AND the removals this world has yet to apply
 * (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`). A cell that means the
 * two apart says so with the composer directly.
 */
export function surfacesWithRemovals(
  userRemovalConstraints: readonly UserRemovalConstraint[],
): AcceptedEffectiveWeekSurfaces {
  return composeAcceptedEffectiveWeekSurfaces({
    currentProgram: null,
    removalDecisions: userRemovalConstraints,
  });
}
