/**
 * ONE OWNER FOR "WHAT PART OF THIS SESSION MAY MOVE".
 *
 * This function has one job and two callers, and it lives in a module of its
 * own because of where those callers sit. The deriver-acquires-repair-search
 * ruling made the §18 gateway a re-planner alongside `fixtureMinimalReplan`,
 * so the rule had to stop being the publisher's private copy — two answers to
 * "may this component travel?" is the exact shape the rules layer exists to
 * prevent.
 *
 * WHY NOT `sessionRowCounting`, where it was first migrated: that module is
 * low-level — `sessionTaxonomy` imports it, and through
 * `sessionClassificationAdapter` → `section18EffectiveWeekEvaluator` →
 * `dayPrecedence` → `acceptedEffectiveWeek` it is reachable from
 * `programStore` at module load. Giving it an eager import of
 * `visibleWorkoutIdentity` closed that loop, and a store whose module body runs
 * mid-cycle reads its own imports as `undefined`: four ownership suites died at
 * `programStore.ts:1877` with `Cannot read properties of undefined (reading
 * 'call')`. Measured, not reasoned — the four were on the scaffold too and had
 * been written off as scaffold noise.
 *
 * Both real callers (`section18AcceptedWeekGateway`, `fixtureMinimalReplan`)
 * already sit above `visibleWorkoutIdentity`, so the rule lives here instead.
 */
import type { Workout } from '../types/domain';
import { hasMeaningfulWorkoutContent } from '../utils/workoutContent';
import { normalizeVisibleWorkoutIdentity } from '../utils/visibleWorkoutIdentity';

/**
 * THE STRENGTH RELOCATION TEMPLATE — a lift without its stacked conditioning.
 *
 * MIGRATED from `utils/fixtureMinimalReplan` per the deriver-acquires-repair-
 * search ruling: the publisher used to be the only caller because it was the
 * only re-planner, and now the deriver re-plans too. Two copies of "what part
 * of this session may move" is exactly the shape this module exists to stop —
 * `fixtureMinimalReplan` imports it from here rather than keeping its own.
 *
 * A stacked conditioning component belongs to the DAY it was placed on (it
 * pays that day's conditioning bill), so carrying it to the relocation target
 * double-counts the week and breaches the conditioning maximum. Only the lift
 * travels.
 */
export function stripConditioningComponent(workout: Workout): Workout | null {
  const linkedRows = new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds),
  );
  const stripped = normalizeVisibleWorkoutIdentity({
    ...workout,
    exercises: (workout.exercises ?? []).filter((row) =>
      !linkedRows.has(row.id) && row.section18Evidence?.role !== 'conditioning'),
    conditioningBlock: undefined,
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
    conditioningFeasibility: undefined,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    coachAddedConditioningLabel: undefined,
    section18ConditioningRole: 'none',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    derivedSessionProvenance: workout.derivedSessionProvenance?.filter((record) =>
      record.scope !== 'conditioning_component' && record.targetMetric !== 'conditioning_core'),
  });
  return hasMeaningfulWorkoutContent(stripped) ? stripped : null;
}
