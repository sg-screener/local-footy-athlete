/** Shared observe-only entry points for generation, overlays and persisted data. */

import type { Microcycle, WeekScopedWorkoutOverlay, Workout } from '../types/domain';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import {
  migrateLegacyWeeklyExposureContractV2,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';

function weekInBlock(weekNumber: number): number {
  return ((Math.max(1, weekNumber) - 1) % 4) + 1;
}

/** New v2 wins; legacy v1 is migrated without manufacturing missing evidence. */
export function resolveMicrocycleSection18Contract(
  microcycle: Microcycle,
): WeeklyExposureContractV2 | null {
  if (microcycle.exposureContractV2) return microcycle.exposureContractV2;
  if (!microcycle.exposureContract) return null;
  return migrateLegacyWeeklyExposureContractV2(microcycle.exposureContract, {
    blockNumber: microcycle.miniCycleNumber,
    weekInBlock: weekInBlock(microcycle.weekNumber),
    globalWeek: microcycle.weekNumber,
  });
}

export function observeMicrocycleSection18(
  microcycle: Microcycle,
  workouts: readonly Workout[] = microcycle.workouts,
) {
  const contract = resolveMicrocycleSection18Contract(microcycle);
  if (!contract) return null;
  return evaluateSection18EffectiveWeek({
    contract,
    workouts,
    weekStart: microcycle.startDate.slice(0, 10),
  });
}

export function resolveOverlaySection18Contract(
  overlay: WeekScopedWorkoutOverlay,
  fallbackMicrocycle?: Microcycle | null,
): WeeklyExposureContractV2 | null {
  if (overlay.exposureContractV2) return overlay.exposureContractV2;
  if (overlay.exposureContract) {
    return migrateLegacyWeeklyExposureContractV2(overlay.exposureContract);
  }
  return fallbackMicrocycle ? resolveMicrocycleSection18Contract(fallbackMicrocycle) : null;
}

export function observeOverlaySection18(
  overlay: WeekScopedWorkoutOverlay,
  fallbackMicrocycle?: Microcycle | null,
) {
  const contract = resolveOverlaySection18Contract(overlay, fallbackMicrocycle);
  if (!contract) return null;
  const workoutsByDate = new Map<string, Workout>();
  if (fallbackMicrocycle) {
    for (const workout of fallbackMicrocycle.workouts) {
      const mondayOffset = workout.dayOfWeek === 0 ? 6 : workout.dayOfWeek - 1;
      const date = new Date(`${overlay.weekStart}T12:00:00`);
      date.setDate(date.getDate() + mondayOffset);
      const dateISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      workoutsByDate.set(dateISO, workout);
    }
  }
  for (const [date, workout] of Object.entries(overlay.workoutsByDate)) {
    if (workout) workoutsByDate.set(date, workout);
    else workoutsByDate.delete(date);
  }
  return evaluateSection18EffectiveWeek({
    contract,
    workouts: Array.from(workoutsByDate.values()),
    weekStart: overlay.weekStart,
  });
}
