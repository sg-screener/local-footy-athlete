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
  type ProgramBlockRolloverStatus,
} from './programBlockState';
import {
  commitRebuiltProgram,
  rebuildLocalWeek,
  type OverrideSweepDecision,
} from './weekRebuild';
import { todayISOLocal } from './appDate';
import { logger } from './logger';
import { getMondayForDate } from './sessionResolver';
import {
  athleteActionDiagnosticHash,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
} from './athleteActionDiagnostics';

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
function rolloverProgramBlockWithinTrace(args: {
  baseProfile: OnboardingData;
  targetDateISO?: string;
  trace?: AthleteActionTraceContext;
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
    commit: false,
  });
  // The new program, phase clock, selected week/day and every still-relevant
  // future overlay are validated as one candidate and published once. One
  // invalid restored week aborts the complete rollover.
  commitRebuiltProgram(result.program, result.sweep, {
    weekScopedOverlays: relevantOverlays,
    selectedDate: targetDateISO,
    reason: `program_rollover:${status.nextBlockStart}`,
  });

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

export function rolloverProgramBlock(args: {
  baseProfile: OnboardingData;
  targetDateISO?: string;
  /** Development-only correlation inherited from a caller. */
  trace?: AthleteActionTraceContext;
}): ProgramBlockRolloverResult {
  const targetDateISO = (args.targetDateISO ?? todayISOLocal()).split('T')[0];
  const trace = beginAthleteActionTrace({
    source: 'system',
    actionType: 'rollover',
    route: 'program_block_rollover',
    currentWeekId: getMondayForDate(targetDateISO),
    targetDate: targetDateISO,
    scope: 'program_block',
  }, args.trace);
  return runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: 'program_block_rollover',
      beforeStateHash: athleteActionDiagnosticHash({
        programId: useProgramStore.getState().currentProgram?.id ?? null,
        blockNumber: useProgramStore.getState().blockState?.blockNumber ?? null,
        overlayWeeks: Object.keys(useProgramStore.getState().weekScopedOverlays).sort(),
      }),
    });
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: 'canonical_block_rebuild',
      producer: 'rolloverProgramBlock',
    });
    try {
      const result = rolloverProgramBlockWithinTrace(args);
      emitAthleteActionEvent(trace, 'athlete_action_completed', {
        outcome: result.rolledOver ? 'rolled_over' : 'no_rollover_needed',
        internalResultCode: result.rolledOver
          ? 'program_rollover_accepted'
          : 'program_rollover_no_op',
        preservedOverlayWeeks: result.preservedOverlayWeeks,
        removedOverlayWeeks: result.removedOverlayWeeks,
        afterStateHash: athleteActionDiagnosticHash({
          programId: result.program?.id ?? null,
          nextBlockStart: result.status.nextBlockStart,
          rolledOver: result.rolledOver,
        }),
      });
      emitAthleteActionEvent(trace, 'athlete_ui_outcome_shown', {
        uiSurface: 'home_program_projection',
        uiOutcome: result.rolledOver ? 'updated' : 'unchanged',
        internalResultCode: result.rolledOver
          ? 'program_rollover_accepted'
          : 'program_rollover_no_op',
        finalUiMessageKey: result.rolledOver
          ? 'program_rollover_accepted'
          : 'program_rollover_no_op',
      });
      return result;
    } catch (error) {
      const rejectionCode = athleteActionErrorCode(error, 'program_rollover_unknown_error');
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'threw',
        internalResultCode: 'program_rollover_failed',
        originalRejectionCode: rejectionCode,
        rejectionCodes: [rejectionCode],
        firstFailingBoundary: 'rolloverProgramBlock',
        failureCategory: classifyAthleteActionFailure(rejectionCode, 'rolloverProgramBlock'),
        validCandidateExisted: false,
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
      throw error;
    }
  });
}
