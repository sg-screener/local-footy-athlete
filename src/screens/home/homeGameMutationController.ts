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
  athleteActionDiagnosticsEnabled,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
} from '../../utils/athleteActionDiagnostics';
import { runCoachMutationTransaction } from '../../store/coachMutationTransaction';

type HomeGameMutationOutcome =
  | {
      outcome: Exclude<WholeWeekRepairOutcome, 'impossible'>;
      result: WeekRebuildResult;
    }
  | {
      outcome: 'impossible';
      reason: string;
      error: unknown;
    };

export type HomeGameMutationResult = HomeGameMutationOutcome & {
  /** Development-only explicit token correlation for the render observer. */
  traceId?: string;
};

function beginHomeGameMutationTrace(
  args: Pick<
    Parameters<typeof executeHomeGameMutation>[0],
    'currentPhase' | 'targetDate' | 'clearOverlayDate' | 'newGameDay'
  >,
  inherited?: AthleteActionTraceContext,
): AthleteActionTraceContext {
  const actionType = fixtureKindForPhase(args.currentPhase) === 'practice_match'
    ? 'practice_match_change' as const
    : 'game_day_change' as const;
  return beginAthleteActionTrace({
    source: inherited?.source ?? 'tap',
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
    controlId: inherited?.controlId ?? 'home-fixture-control',
  }, inherited);
}

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

function deriveGameChangeCoachNote(args: {
  currentPhase: SeasonPhase;
  newGameDay: DayOfWeek | null;
  targetDate: string;
  clearOverlayDate?: string;
  beforeRows: readonly GameChangeVisibleDay[];
  todayISO?: string;
}, result: WeekRebuildResult): void {
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
    adjustmentId: result.reversibleAdjustmentId,
  });
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
  deriveCoachNote?: boolean;
}): HomeGameMutationResult {
  const actionType = fixtureKindForPhase(args.currentPhase) === 'practice_match'
    ? 'practice_match_change' as const
    : 'game_day_change' as const;
  const trace = beginHomeGameMutationTrace(args);
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
    if (result.outcome !== 'impossible' && args.deriveCoachNote !== false) {
      deriveGameChangeCoachNote(args, result.result);
    }
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

/** Production tap boundary: the accepted fixture mutation and ledger are
 * persisted/read back before its Coach Note projection is derived. */
export async function executeHomeGameMutationDurably(
  args: Omit<Parameters<typeof executeHomeGameMutation>[0], 'deriveCoachNote'>,
): Promise<HomeGameMutationResult> {
  const execute = async (): Promise<HomeGameMutationOutcome> => {
    const transaction = await runCoachMutationTransaction({
      todayISO: args.todayISO ?? todayISOLocal(),
      extraDates: [args.clearOverlayDate, args.targetDate]
        .filter((date): date is string => !!date),
      mutate: () => executeHomeGameMutation({ ...args, deriveCoachNote: false }),
      didApply: (result) => result.outcome !== 'impossible' &&
        !!result.result.reversibleAdjustmentId,
    });
    if (transaction.ok) {
      if (transaction.value.outcome !== 'impossible') {
        deriveGameChangeCoachNote(args, transaction.value.result);
      }
      return transaction.value;
    }
    const reason = 'reason' in transaction
      ? transaction.reason
      : 'The fixture change could not be persisted.';
    return { outcome: 'impossible', reason, error: new Error(reason) };
  };
  if (!athleteActionDiagnosticsEnabled()) return execute();
  const trace = beginHomeGameMutationTrace(args);
  return runWithAthleteActionTrace(trace, async () => {
    const result = await execute();
    if (result.outcome === 'impossible') {
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: result.outcome,
        internalResultCode: `${trace.actionType}_durable_failure`,
        originalRejectionCode: athleteActionErrorCode(
          result.error,
          `${trace.actionType}_durable_failure`,
        ),
        firstFailingBoundary: 'executeHomeGameMutationDurably',
        failureCategory: classifyAthleteActionFailure(
          athleteActionErrorCode(result.error, `${trace.actionType}_durable_failure`),
          'fixture_persistence',
        ),
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
    }
    return { ...result, traceId: trace.traceId };
  });
}
