/**
 * Deterministic program-block lifecycle boundary.
 *
 * Rollover deliberately reuses `rebuildLocalWeek(scope: 'block')`: that is
 * the existing owner of local generation, active-constraint collection and
 * the canonical manual-override sweep. This coordinator only decides when
 * the old four-week window has ended and carries forward still-future week
 * overlays that `setCurrentProgram` clears while replacing the template.
 */

import type {
  OnboardingData,
  TrainingProgram,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import { useProgramStore } from '../store/programStore';
import {
  getProgramBlockRolloverStatus,
  selectMicrocycleForDate,
  type ProgramBlockRolloverStatus,
} from './programBlockState';
import {
  rebuildLocalWeek,
  type OverrideSweepDecision,
} from './weekRebuild';
import { todayISOLocal } from './appDate';
import { logger } from './logger';

export interface ProgramBlockRolloverResult {
  rolledOver: boolean;
  status: ProgramBlockRolloverStatus;
  program: TrainingProgram | null;
  sweep?: OverrideSweepDecision;
  preservedOverlayWeeks: string[];
  removedOverlayWeeks: string[];
}

/** Keep only exact-week overlays that have not expired before the new block. */
export function selectRelevantRolloverOverlays(
  overlays: Record<string, WeekScopedWorkoutOverlay>,
  nextBlockStart: string,
): Record<string, WeekScopedWorkoutOverlay> {
  return Object.fromEntries(
    Object.entries(overlays).filter(([, overlay]) => overlay.weekEnd >= nextBlockStart),
  );
}

/**
 * Roll an expired program forward by exactly one four-week block.
 *
 * Generation remains synchronous and local. Session feedback and performed
 * weight history live outside `setCurrentProgram`, so the canonical rebuild
 * leaves both intact for the progression resolver.
 */
export function rolloverProgramBlock(args: {
  baseProfile: OnboardingData;
  targetDateISO?: string;
}): ProgramBlockRolloverResult {
  const targetDateISO = (args.targetDateISO ?? todayISOLocal()).split('T')[0];
  const before = useProgramStore.getState();
  const status = getProgramBlockRolloverStatus({
    program: before.currentProgram,
    dateISO: targetDateISO,
    blockState: before.blockState,
  });

  if (!status.needsRollover || !status.nextBlockStart) {
    return {
      rolledOver: false,
      status,
      program: before.currentProgram,
      preservedOverlayWeeks: Object.keys(before.weekScopedOverlays).sort(),
      removedOverlayWeeks: [],
    };
  }

  const relevantOverlays = selectRelevantRolloverOverlays(
    before.weekScopedOverlays,
    status.nextBlockStart,
  );
  const preservedOverlayWeeks = Object.keys(relevantOverlays).sort();
  const removedOverlayWeeks = Object.keys(before.weekScopedOverlays)
    .filter((weekStart) => !(weekStart in relevantOverlays))
    .sort();

  const result = rebuildLocalWeek({
    baseProfile: args.baseProfile,
    todayISO: status.nextBlockStart,
    blockNumber: status.nextBlockNumber ?? undefined,
    scope: 'block',
  });

  // The canonical block commit intentionally clears week overlays. Restore
  // only future exact-week overlays after the new shared template is in place.
  for (const overlay of Object.values(relevantOverlays)) {
    useProgramStore.getState().setWeekScopedOverlay(overlay);
  }

  // Canonical rebuilds select week 1 by default. If the app was unopened for
  // part of the new block, point direct store consumers at the microcycle that
  // actually contains the triggering date; the full resolver does this too.
  const targetMicrocycle = selectMicrocycleForDate(
    result.program,
    null,
    targetDateISO,
  );
  if (targetMicrocycle) {
    const store = useProgramStore.getState();
    store.setCurrentMicrocycle(targetMicrocycle);
    const targetDayOfWeek = new Date(`${targetDateISO}T12:00:00`).getDay();
    store.setTodayWorkout(
      targetMicrocycle.workouts.find((workout) => workout.dayOfWeek === targetDayOfWeek) ?? null,
    );
  }

  logger.debug('[programBlockRollover] committed', {
    previousBlockNumber: status.currentBlockNumber,
    nextBlockNumber: status.nextBlockNumber,
    nextBlockStart: status.nextBlockStart,
    targetDateISO,
    preservedOverlayWeeks,
    removedOverlayWeeks,
  });

  return {
    rolledOver: true,
    status,
    program: result.program,
    sweep: result.sweep,
    preservedOverlayWeeks,
    removedOverlayWeeks,
  };
}
