import type { Microcycle, Workout } from '../../types/domain';
import { evaluateSection18EffectiveWeek } from '../../rules/section18EffectiveWeekEvaluator';

/** Test adapter only: observe the current typed contract without repairing it. */
export function evaluateMicrocycleForTests(week: Microcycle, workouts: readonly Workout[] = week.workouts) {
  return week.exposureContractV2 ? evaluateSection18EffectiveWeek({
    contract: week.exposureContractV2, workouts, weekStart: week.startDate.slice(0, 10),
  }) : null;
}
