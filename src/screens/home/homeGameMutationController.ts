import type { DayOfWeek, OnboardingData, SeasonPhase } from '../../types/domain';
import type { GameChangeVisibleDay } from '../../utils/gameChangeCoachNotes';
import type { WholeWeekRepairOutcome } from '../../rules/wholeWeekRepairEngine';
import {
  executeFixtureMutationInMemory,
  executeFixtureMutationTransaction,
  type FixtureMutationTransactionInput,
  type FixtureMutationTransactionResult,
} from '../../store/fixtureMutationTransaction';
import { useProgramStore } from '../../store/programStore';
import type { WeekRebuildResult } from '../../utils/weekRebuild';

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
  traceId?: string;
};

interface LegacyHomeGameMutationInput {
  baseProfile: OnboardingData;
  currentPhase: SeasonPhase;
  newGameDay: DayOfWeek | null;
  targetDate: string;
  clearOverlayDate?: string;
  beforeRows: readonly GameChangeVisibleDay[];
  todayISO?: string;
  deriveCoachNote?: boolean;
}

function legacyCommandId(
  args: LegacyHomeGameMutationInput,
  revision: number,
): string {
  const action = args.clearOverlayDate
    ? 'move'
    : args.newGameDay ? 'add' : 'remove';
  return [
    'home-fixture-compat',
    action,
    args.clearOverlayDate ?? 'none',
    args.targetDate,
    `revision-${revision}`,
  ].join(':');
}

function canonicalInput(
  args: LegacyHomeGameMutationInput,
): FixtureMutationTransactionInput {
  const revision = useProgramStore.getState().acceptedMaterialContext.revision;
  const action = args.clearOverlayDate
    ? 'move' as const
    : args.newGameDay ? 'add' as const : 'remove' as const;
  return {
    action,
    fixtureKind: args.currentPhase === 'Pre-season'
      ? 'practice_match' as const
      : 'game' as const,
    ...(action === 'add'
      ? { targetDate: args.targetDate }
      : action === 'move'
        ? { sourceDate: args.clearOverlayDate!, targetDate: args.targetDate }
        : { sourceDate: args.targetDate }),
    expectedAcceptedRevision: revision,
    source: {
      requestedBy: 'athlete' as const,
      producer: 'tap' as const,
      surface: 'program_tab' as const,
      commandId: legacyCommandId(args, revision),
    },
    todayISO: args.todayISO,
  };
}

function toLegacyResult(
  result: FixtureMutationTransactionResult,
): HomeGameMutationResult {
  if (
    result.outcome === 'no_change' ||
    result.outcome === 'conflicted' ||
    result.outcome === 'impossible'
  ) {
    return {
      outcome: 'impossible',
      reason: result.reason,
      error: result.error,
      traceId: result.traceId,
    };
  }
  return {
    outcome: result.outcome,
    result: result.result,
    traceId: result.traceId,
  };
}

/**
 * Compatibility-only adapter for older synchronous fixture regression tests.
 * The canonical owner is FixtureMutationTransaction in src/store.
 */
export function executeHomeGameMutation(
  args: LegacyHomeGameMutationInput,
): HomeGameMutationResult {
  void args.baseProfile;
  void args.beforeRows;
  void args.deriveCoachNote;
  return toLegacyResult(executeFixtureMutationInMemory(canonicalInput(args)));
}

/**
 * Compatibility-only durable adapter. Live Home tap flows import the
 * screen-neutral transaction directly.
 */
export async function executeHomeGameMutationDurably(
  args: Omit<LegacyHomeGameMutationInput, 'deriveCoachNote'>,
): Promise<HomeGameMutationResult> {
  void args.baseProfile;
  void args.beforeRows;
  const result = await executeFixtureMutationTransaction(canonicalInput(args));
  return toLegacyResult(result);
}
