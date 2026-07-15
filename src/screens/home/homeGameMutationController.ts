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
export function executeHomeGameMutation(args: {
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
