/** Adjustment cards are projections. Clear changes their input, never their saved output. */
import type { ReversibleAdjustmentRecord } from '../rules/reversibleAdjustmentLedger';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { AcceptedStateTransactionProposal, AcceptedStateTransactionResult } from './acceptedStateTransaction';
import { normalizeAcceptedMaterialContext, normalizeAcceptedProgramSurfaces } from './acceptedStateColdStart';
import { useProgramStore } from './programStore';
import { resolveInjuryEpisode } from './injuryEpisodeTransaction';
import { transactTemporarySourceFact } from './temporarySourceFactTransaction';
import { isInjurySourceFact, temporarySourceFactId } from '../rules/temporarySourceFact';
import { pendingUndoTarget, undoLastDecision } from './undoLastDecision';
import { todayISOLocal } from '../utils/appDate';
import type { AthleteActionTraceContext } from '../utils/athleteActionDiagnostics';
import type { Workout } from '../types/domain';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';

export type ClearReversibleAdjustmentOutcome =
  | 'restored' | 'recomposed' | 'superseded' | 'conflicted' | 'already-cleared' | 'safely-rejected';

export interface ClearReversibleAdjustmentResult {
  outcome: ClearReversibleAdjustmentOutcome;
  adjustmentId: string;
  acceptedRevisionBefore: number;
  acceptedRevisionAfter: number;
  affectedDates: string[];
  affectedWeeks: string[];
  reason: string | null;
  supersededById: string | null;
  traceId?: string;
}

export interface ClearReversibleAdjustmentStage {
  proposal: AcceptedStateTransactionProposal | null;
  result: ClearReversibleAdjustmentResult;
  accepted: AcceptedStateTransactionResult;
}

/** Exact accepted identities only. Dates, labels and displaced snapshots are not identities. */
export function adjustmentMatchesDecision(
  adjustment: ReversibleAdjustmentRecord,
  entry: DecisionLedgerEntry,
): boolean {
  const decision = entry.decision;
  if (decision.kind === 'plan_change') return !!decision.acceptedEffect?.upsertedConstraints.some(constraint =>
    adjustment.linkedUserRemovalConstraintIds.includes(constraint.id));
  if (decision.kind === 'fixture_add' || decision.kind === 'fixture_move' || decision.kind === 'fixture_remove') {
    const effect = decision.acceptedEffect;
    return !!effect && adjustment.sourceActionOrIntentId === (effect.source.commandId ??
      [effect.fixtureKind, effect.action, effect.sourceDate ?? 'none', effect.targetDate].join(':'));
  }
  return false;
}

/** A stale warning may clear only the exact accepted owner of its current material. */
export function clearableOverrideAdjustment(args: {
  date: string;
  workout: Workout;
  adjustments: readonly ReversibleAdjustmentRecord[];
  latestDecision: DecisionLedgerEntry | null;
}): ReversibleAdjustmentRecord | null {
  const fingerprint = semanticFingerprint(args.workout);
  const matches = args.adjustments.filter(record => record.status === 'active' &&
    (record.sourceFactId || (args.latestDecision && adjustmentMatchesDecision(record, args.latestDecision))) &&
    record.displacedOriginalState.ownedDays.some(day => day.date === args.date &&
      day.afterStableIdentity === (args.workout.planEntryId ?? args.workout.id) &&
      day.afterDateOverrideFingerprint === fingerprint));
  return matches.length === 1 ? matches[0] : null;
}

/** Compatibility callers may inspect status but cannot restore material snapshots. */
export function stageClearReversibleAdjustment(
  adjustmentId: string,
  expectedRevision: number,
): ClearReversibleAdjustmentStage {
  const state = useProgramStore.getState();
  const context = normalizeAcceptedMaterialContext(state.acceptedMaterialContext);
  const program = normalizeAcceptedProgramSurfaces(state);
  const adjustment = program.reversibleAdjustmentLedger.adjustments.find(record => record.id === adjustmentId);
  let outcome: ClearReversibleAdjustmentOutcome = 'safely-rejected';
  let reason = 'This adjustment must be cleared through its accepted input.';
  if (!adjustment) reason = 'No accepted adjustment matched that exact ID. Nothing was changed.';
  else if (expectedRevision > context.revision) reason = 'The expected revision is newer than the current program.';
  else if (adjustment.status === 'cleared') { outcome = 'already-cleared'; reason = 'The adjustment was already cleared.'; }
  else if (adjustment.status === 'superseded' || adjustment.status === 'conflicted') {
    outcome = adjustment.status;
    reason = adjustment.supersededReason ?? 'A later decision owns this adjustment.';
  }
  return { proposal: null, accepted: { program, context }, result: {
    outcome, adjustmentId, acceptedRevisionBefore: context.revision, acceptedRevisionAfter: context.revision,
    affectedDates: [...(adjustment?.affectedDates ?? [])],
    affectedWeeks: [...(adjustment?.rollingDependencyWeeks ?? [])], reason,
    supersededById: adjustment?.supersededById ?? null,
  } };
}

/** Retired synchronous snapshot API: never publishes generated state. */
export function commitClearReversibleAdjustment(
  adjustmentId: string,
  expectedRevision: number,
): ClearReversibleAdjustmentResult {
  return stageClearReversibleAdjustment(adjustmentId, expectedRevision).result;
}

/** Resolve the exact report, or undo its exact latest decision through the existing ledger door. */
export async function clearReversibleAdjustment(
  adjustmentId: string,
  expectedRevision: number,
  inheritedTrace?: AthleteActionTraceContext,
): Promise<ClearReversibleAdjustmentResult> {
  const staged = stageClearReversibleAdjustment(adjustmentId, expectedRevision);
  const { context, program } = staged.accepted;
  const adjustment = program.reversibleAdjustmentLedger.adjustments.find(record => record.id === adjustmentId);
  if (!adjustment || expectedRevision > context.revision || adjustment.status !== 'active') return staged.result;
  const finish = (ok: boolean, reason: string | null): ClearReversibleAdjustmentResult => ({
    ...staged.result, outcome: ok ? 'recomposed' : 'safely-rejected', reason,
    acceptedRevisionAfter: useProgramStore.getState().acceptedMaterialContext.revision,
  });
  if (adjustment.sourceFactId) {
    const fact = context.temporarySourceFacts.find(candidate => temporarySourceFactId(candidate) === adjustment.sourceFactId);
    if (!fact) return finish(false, 'The exact source report could not be matched. Nothing was changed.');
    const result = isInjurySourceFact(fact)
      ? await resolveInjuryEpisode(fact.episodeId, { todayISO: todayISOLocal(), trace: inheritedTrace })
      : await transactTemporarySourceFact({ operation: 'resolve', factId: temporarySourceFactId(fact),
          todayISO: todayISOLocal(), expectedAcceptedRevision: context.revision });
    return finish(!['conflicted', 'safely_rejected'].includes(result.outcome), result.message);
  }
  const target = pendingUndoTarget();
  if (!target || !adjustmentMatchesDecision(adjustment, target)) {
    return finish(false, 'This is not the latest accepted change. Use the current session or status controls to change it.');
  }
  const result = await undoLastDecision();
  return finish(result.outcome === 'undone', result.outcome === 'refused' ? result.reason : null);
}
