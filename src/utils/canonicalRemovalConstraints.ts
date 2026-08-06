/**
 * THE ONE CANONICAL SOURCE OF THE ATHLETE'S REMOVAL DECISIONS
 * (`docs/CONSTRAINT_VISIBILITY_PRECONDITION_RULING_2026-08-06.md`).
 *
 * `userRemovalConstraints` used to be a parameter every gateway caller had to
 * remember to thread. Five of twelve never did — all four doors in
 * `postGenerationConstraintValidation` and one in `programStore` — and the
 * consequence was not a missing field but a WRONG ANSWER: the repair search
 * saw `constraints: []`, could not tell that a DECISION explained the missing
 * pattern, relocated anyway, and greened the week before the deletion class's
 * own relocation (the one recording typed ownership that makes a restore
 * reversible) ever ran.
 *
 * NOTHING IS WIRED TO THIS YET, AND THAT IS THE FINDING.
 *
 * The ruling would have retired the parameter and had the gateway ask here.
 * This module exists so condition 1 could be MEASURED rather than assumed, and
 * the measurement refuted the mechanism
 * (`docs/CONSTRAINT_VISIBILITY_ENTRY_MEASUREMENT_2026-08-06.md`): the source is
 * reachable at every door, but it is not the TRUTH at every door. At the
 * staging doors the gateway is deliberately handed a constraint set the store
 * does not hold — the athlete's decision under evaluation, which by
 * construction is not persisted until after the gateway has passed on it.
 *
 * So this stays as the probe's source and nothing else until the resolution
 * point is re-ruled. It is not a second representation of the constraints
 * while no product read calls it.
 */
import type { UserRemovalConstraint } from '../types/domain';

/**
 * The gateway is a rules module and the store is a persistence module, so the
 * store is reached the way `programStore` already reaches the gateway: lazily,
 * at call time, never at module load. There is no import cycle to break
 * because neither side is present in the other's module graph until a call is
 * actually made.
 *
 * A harness that never mounts the store is not an error either — it has no
 * removal decisions, which is exactly what the empty array says.
 */
export function canonicalUserRemovalConstraints(): readonly UserRemovalConstraint[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const store = require('../store/programStore') as
      typeof import('../store/programStore');
    return store.useProgramStore.getState().userRemovalConstraints ?? [];
  } catch {
    return [];
  }
}
