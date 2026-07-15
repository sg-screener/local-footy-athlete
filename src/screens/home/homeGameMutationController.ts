import type { DayOfWeek, OnboardingData, SeasonPhase } from '../../types/domain';
import type { WholeWeekRepairOutcome } from '../../rules/wholeWeekRepairEngine';
import {
  fixtureKindForPhase,
  gameChangeActionFromRebuild,
  type GameChangeVisibleDay,
  upsertGameChangeCoachNoteFromDiff,
  weekRebuildResultToGameChangeRows,
} from '../../utils/gameChangeCoachNotes';
import { todayISOLocal } from '../../utils/appDate';
import { rebuildLocalWeek, type WeekRebuildResult } from '../../utils/weekRebuild';
import { getMondayForDate } from '../../utils/sessionResolver';
import {
  athleteActionDiagnosticHash,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
} from '../../utils/athleteActionDiagnostics';

export type HomeGameMutationResult =
  | {
      outcome: Exclude<WholeWeekRepairOutcome, 'impossible'>;
      result: WeekRebuildResult;
    }
  | {
      outcome: 'impossible';
      reason: string;
      error: unknown;
    };

/** The real Home add/remove/move controller, shared verbatim with regression tests. */
function executeHomeGameMutationWithinTrace(args: {
  baseProfile: OnboardingData;
  currentPhase: SeasonPhase;
  newGameDay: DayOfWeek | null;
  targetDate: string;
  clearOverlayDate?: string;
  beforeRows: readonly GameChangeVisibleDay[];
  todayISO?: string;
}): HomeGameMutationResult {
  try {
    const result = rebuildLocalWeek({
      baseProfile: args.baseProfile,
      newGameDay: args.newGameDay,
      scope: 'weekOverlay',
      targetDate: args.targetDate,
      clearOverlayDate: args.clearOverlayDate,
      manageCalendarFixture: true,
      todayISO: args.todayISO,
    });
    const afterRows = weekRebuildResultToGameChangeRows({
      result,
      targetDate: args.targetDate,
      newGameDay: args.newGameDay,
    });
    const weekStartISO = afterRows
      .map((row) => row.date)
      .sort((left, right) => left.localeCompare(right))[0] ?? args.targetDate;
    upsertGameChangeCoachNoteFromDiff({
      action: gameChangeActionFromRebuild({
        newGameDay: args.newGameDay,
        clearOverlayDate: args.clearOverlayDate,
      }),
      fixtureKind: fixtureKindForPhase(args.currentPhase),
      targetDate: args.targetDate,
      previousDate: args.clearOverlayDate,
      weekStartISO,
      before: args.beforeRows,
      after: afterRows,
      todayISO: args.todayISO ?? todayISOLocal(),
    });
    const status = result.fixtureReplan?.gateway.status;
    return {
      outcome: status === 'impossible' || !status ? 'accepted' : status,
      result,
    };
  } catch (error) {
    const reason = error instanceof Error
      ? error.message
      : 'The week could not be repaired safely.';
    return { outcome: 'impossible', reason, error };
  }
}

/** Home fixture entry keeps rebuild, Coach Notes, and UI outcome on one trace. */
export function executeHomeGameMutation(args: {
  baseProfile: OnboardingData;
  currentPhase: SeasonPhase;
  newGameDay: DayOfWeek | null;
  targetDate: string;
  clearOverlayDate?: string;
  beforeRows: readonly GameChangeVisibleDay[];
  todayISO?: string;
}): HomeGameMutationResult {
  const actionType = fixtureKindForPhase(args.currentPhase) === 'practice_match'
    ? 'practice_match_change' as const
    : 'game_day_change' as const;
  const trace = beginAthleteActionTrace({
    source: 'tap',
    actionType,
    route: 'home_fixture_mutation',
    currentWeekId: getMondayForDate(args.targetDate),
    sourceDate: args.clearOverlayDate,
    targetDate: args.targetDate,
    sessionDate: args.targetDate,
    scope: args.clearOverlayDate ? 'move_fixture' : args.newGameDay ? 'add_fixture' : 'remove_fixture',
    fixtureId: `${fixtureKindForPhase(args.currentPhase)}:${args.clearOverlayDate ?? args.targetDate}`,
    practiceMatchId: fixtureKindForPhase(args.currentPhase) === 'practice_match'
      ? `practice_match:${args.clearOverlayDate ?? args.targetDate}`
      : null,
  });
  return runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: args.clearOverlayDate
        ? 'move_fixture'
        : args.newGameDay ? 'add_fixture' : 'remove_fixture',
      fixtureKind: fixtureKindForPhase(args.currentPhase),
      beforeProjectionHash: athleteActionDiagnosticHash(args.beforeRows.map((row) => ({
        date: row.date,
        workoutType: row.workoutType,
        sessionTier: row.sessionTier,
      }))),
    });
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: 'home_fixture_rebuild_and_note',
      producer: 'executeHomeGameMutation',
    });
    const result = executeHomeGameMutationWithinTrace(args);
    const internalResultCode = result.outcome === 'impossible'
      ? `${actionType}_impossible`
      : `${actionType}_${result.outcome}`;
    if (result.outcome === 'impossible') {
      const rejectionCode = athleteActionErrorCode(result.error, `${actionType}_unknown_error`);
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: result.outcome,
        internalResultCode,
        originalRejectionCode: rejectionCode,
        rejectionCodes: [rejectionCode],
        firstFailingBoundary: 'executeHomeGameMutation',
        failureCategory: classifyAthleteActionFailure(
          rejectionCode,
          'fixture_rebuild',
        ),
        validCandidateExisted: false,
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
    }
    emitAthleteActionEvent(trace, 'athlete_ui_outcome_shown', {
      uiSurface: 'home_fixture_control',
      uiOutcome: result.outcome,
      internalResultCode,
      finalUiMessageKey: internalResultCode,
    });
    return result;
  });
}
