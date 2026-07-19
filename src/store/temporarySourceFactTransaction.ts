import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  acceptedProfileForContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedCompositionBaseV1,
} from './acceptedStateColdStart';
import {
  assertAcceptedVisibleLedgerEquivalence,
  commitAcceptedStateTransaction,
} from './acceptedStateTransaction';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import { canonicaliseAcceptedStateCandidate, useProgramStore } from './programStore';
import { useProfileStore } from './profileStore';
import {
  composeTemporarySourceFactCompatibility,
  expireTemporarySourceFacts,
  isInjurySourceFact,
  isTemporarySourceFactConstraint,
  migrateLegacyTemporarySourceFacts,
  normalizeTemporarySourceFacts,
  temporarySourceFactId,
  type TemporarySourceFact,
  type TemporarySourceFactActor,
  type TemporarySourceFactStatus,
} from '../rules/temporarySourceFact';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  athleteActionTerminalReasonChain,
  classifyAthleteActionFailure,
  currentAthleteActionTrace,
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';
import { isAcceptedProfileConstraint } from '../rules/acceptedProfileProjection';

export type TemporarySourceFactOperation =
  | 'create'
  | 'update'
  | 'resolve'
  | 'expire'
  | 'supersede'
  | 'hydrate';
export type TemporarySourceFactTransactionOutcome =
  | 'created_and_recomposed'
  | 'created_no_program_change'
  | 'updated_and_recomposed'
  | 'updated_no_program_change'
  | 'resolved_and_recomposed'
  | 'resolved_no_program_change'
  | 'expired_and_recomposed'
  | 'expired_no_program_change'
  | 'superseded_and_recomposed'
  | 'superseded_no_program_change'
  | 'hydrated_and_recomposed'
  | 'hydrated_no_program_change'
  | 'no_op'
  | 'conflicted'
  | 'safely_rejected';

export interface TemporarySourceFactTransactionTestHooks {
  beforeStage?: () => void;
  beforeEffectiveValidation?: () => void;
  verifyCandidate?: () => boolean;
  verifyAfterPersistence?: () => boolean;
}

export interface TemporarySourceFactTransactionInput {
  operation: TemporarySourceFactOperation;
  /** Full replacement for one exact fact on create/update. */
  fact?: TemporarySourceFact;
  factId?: string;
  todayISO?: string;
  now?: string;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface?: string;
  expectedAcceptedRevision?: number;
  testHooks?: TemporarySourceFactTransactionTestHooks;
}

export interface TemporarySourceFactTransactionResult {
  outcome: TemporarySourceFactTransactionOutcome;
  factId: string | null;
  changedProgram: boolean;
  message: string;
  reason?: string;
}

interface CanonicalFactOwnership {
  context: ReturnType<typeof normalizeAcceptedMaterialContext>;
  compositionBase: AcceptedCompositionBaseV1;
}

export interface CommitTemporarySourceFactSetInput {
  nextFacts: TemporarySourceFact[];
  targetFactId: string;
  todayISO: string;
  reason: string;
  /** Deterministic transaction clock for accepted fixtures and replay tests. */
  now?: string;
  expectedAcceptedRevision?: number;
  testHooks?: TemporarySourceFactTransactionTestHooks;
  /** Explicit TraceV2 correlation for async command executors. */
  trace?: AthleteActionTraceContext;
}

export interface CommitTemporarySourceFactSetResult {
  ok: boolean;
  acceptedStateChanged: boolean;
  visibleProgramChanged: boolean;
  /** @deprecated Compatibility alias for visibleProgramChanged. */
  changedProgram: boolean;
  reason?: string;
  route?: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
}

function mondayFor(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function affectedHorizon(anchorDate: string, facts: readonly TemporarySourceFact[]): {
  weeks: string[];
  dates: string[];
} {
  const state = useProgramStore.getState();
  const weeks = new Set<string>([mondayFor(anchorDate)]);
  for (const microcycle of state.currentProgram?.microcycles ?? []) weeks.add(microcycle.startDate.slice(0, 10));
  if (state.currentMicrocycle) weeks.add(state.currentMicrocycle.startDate.slice(0, 10));
  for (const week of Object.keys(state.weekScopedOverlays ?? {})) weeks.add(week.slice(0, 10));
  for (const date of Object.keys(state.dateOverrides ?? {})) weeks.add(mondayFor(date));
  for (const fact of facts) {
    if (isInjurySourceFact(fact)) {
      for (const week of fact.affectedWeeks) weeks.add(week.slice(0, 10));
    } else {
      weeks.add(mondayFor(fact.effectiveFrom));
      weeks.add(mondayFor(fact.effectiveUntil));
    }
  }
  const sortedWeeks = Array.from(weeks).sort();
  return {
    weeks: sortedWeeks,
    dates: sortedWeeks.flatMap((week) => Array.from({ length: 7 }, (_, offset) => addDays(week, offset)))
      .filter((date) => date >= anchorDate)
      .sort(),
  };
}

export function loadCanonicalTemporarySourceFactOwnership(now: string): CanonicalFactOwnership {
  const state = useProgramStore.getState();
  const rawContext = state.acceptedMaterialContext;
  let context = normalizeAcceptedMaterialContext(rawContext);
  let facts = context.temporarySourceFacts;
  const unownedLegacyConstraints = (rawContext.activeConstraints ?? []).filter((constraint) =>
    (constraint.type === 'injury' && !constraint.injuryEpisodeId) ||
    ((constraint.type === 'fatigue' || constraint.type === 'soreness' ||
      constraint.type === 'equipment' || constraint.type === 'schedule') &&
      (constraint.temporarySourceFactIds?.length ?? 0) === 0));
  const legacyFacts = migrateLegacyTemporarySourceFacts({
    activeConstraints: unownedLegacyConstraints,
    activeInjury: facts.some(isInjurySourceFact) ? null : rawContext.activeInjury,
    readinessSignalsByDate: rawContext.readinessSignalsByDate ?? {},
    availabilityConstraints: acceptedProfileForContext(
      context,
      useProfileStore.getState().onboardingData,
    ).availabilityConstraints,
    sourceSurface: 'temporary_source_fact_transaction',
  });
  facts = normalizeTemporarySourceFacts({ value: [...legacyFacts, ...facts] });
  const surfaces = normalizeAcceptedProgramSurfaces(state);
  const legacyAfterStateOnly = facts.some((fact) =>
    isInjurySourceFact(fact)
      ? fact.legacyMigrationStatus === 'legacy_after_state_only'
      : fact.legacyMigrationStatus === 'legacy_after_state_only');
  const compositionBase = context.acceptedCompositionBase ?? {
    protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
    capturedAt: now,
    updatedAt: now,
    sourceRevision: context.revision,
    provenance: legacyAfterStateOnly
      ? 'legacy_after_state_only' as const
      : 'accepted_pre_injury' as const,
    surfaces: clone(surfaces),
  };
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: facts,
    activeConstraints: context.activeConstraints,
    readinessSignalsByDate: context.readinessSignalsByDate,
  });
  context = normalizeAcceptedMaterialContext({
    ...context,
    temporarySourceFacts: facts,
    injuryEpisodes: compatibility.injuryEpisodes,
    activeConstraints: compatibility.activeConstraints,
    activeInjury: compatibility.activeInjury,
    readinessSignalsByDate: compatibility.readinessSignalsByDate,
    acceptedCompositionBase: compositionBase,
  });
  return { context, compositionBase };
}

function validateEffectiveComposition(args: {
  base: AcceptedCompositionBaseV1;
  context: ReturnType<typeof normalizeAcceptedMaterialContext>;
  weekStarts: readonly string[];
}): void {
  const profile = acceptedProfileForContext(
    args.context,
    useProfileStore.getState().onboardingData,
  );
  const projected = canonicaliseAcceptedStateCandidate(args.base.surfaces, {
    activeConstraints: args.context.activeConstraints.filter((constraint) =>
      isTemporarySourceFactConstraint(constraint) ||
      isAcceptedProfileConstraint(constraint)),
    profile,
    markedDays: args.context.markedDays,
    validateWeekStarts: args.weekStarts,
  });
  assertAcceptedVisibleLedgerEquivalence({
    surfaces: normalizeAcceptedProgramSurfaces(projected),
    context: args.context,
    weekStarts: args.weekStarts,
    profile,
  });
}

/**
 * The one canonical source-fact publication boundary used by injuries and all
 * non-injury facts. It validates a composed candidate from the clean accepted
 * base, then publishes the clean base plus the canonical facts atomically.
 */
export async function commitTemporarySourceFactSet(
  args: CommitTemporarySourceFactSetInput,
): Promise<CommitTemporarySourceFactSetResult> {
  const now = args.now ?? new Date().toISOString();
  const ownership = loadCanonicalTemporarySourceFactOwnership(now);
  if (args.expectedAcceptedRevision !== undefined &&
    args.expectedAcceptedRevision !== ownership.context.revision) {
    return {
      ok: false,
      acceptedStateChanged: false,
      visibleProgramChanged: false,
      changedProgram: false,
      route: 'conflicted',
      reason: 'accepted_revision_changed',
    };
  }
  const normalizedFacts = normalizeTemporarySourceFacts({
    value: expireTemporarySourceFacts(args.nextFacts, args.todayISO, now),
  });
  const compositionBase = normalizedFacts.some((fact) =>
    fact.legacyMigrationStatus === 'legacy_after_state_only')
    ? {
        ...ownership.compositionBase,
        provenance: 'legacy_after_state_only' as const,
      }
    : ownership.compositionBase;
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: normalizedFacts,
    activeConstraints: ownership.context.activeConstraints,
    readinessSignalsByDate: ownership.context.readinessSignalsByDate,
  });
  const horizon = affectedHorizon(args.todayISO, normalizedFacts);
  const baseFingerprint = semanticFingerprint(compositionBase.surfaces);
  const ledgerFingerprint = semanticFingerprint(compositionBase.surfaces.reversibleAdjustmentLedger);
  const factsFingerprint = semanticFingerprint(normalizedFacts);
  const transaction = await runCoachMutationTransaction({
    todayISO: args.todayISO,
    extraDates: horizon.dates,
    trace: args.trace,
    allowAcceptedStateOnlyChange: true,
    mutate: () => {
      args.testHooks?.beforeStage?.();
      const nextContext = normalizeAcceptedMaterialContext({
        ...ownership.context,
        temporarySourceFacts: normalizedFacts,
        injuryEpisodes: compatibility.injuryEpisodes,
        activeConstraints: compatibility.activeConstraints,
        activeInjury: compatibility.activeInjury,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        acceptedCompositionBase: compositionBase,
      });
      args.testHooks?.beforeEffectiveValidation?.();
      validateEffectiveComposition({
        base: compositionBase,
        context: nextContext,
        weekStarts: horizon.weeks,
      });
      return commitAcceptedStateTransaction({
        reason: args.reason,
        program: compositionBase.surfaces,
        temporarySourceFacts: normalizedFacts,
        injuryEpisodes: compatibility.injuryEpisodes,
        activeConstraints: compatibility.activeConstraints,
        activeInjury: compatibility.activeInjury,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        acceptedCompositionBase: compositionBase,
        validateWeekStarts: horizon.weeks,
        skipConstraintProjection: true,
      });
    },
    didApply: () => true,
    verifyCandidate: () => {
      if (args.testHooks?.verifyCandidate?.() === false) {
        return { ok: false, reason: 'temporary_source_fact_visible_candidate_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
      if (args.targetFactId !== 'temporary-source-facts:empty' &&
        !accepted.temporarySourceFacts.some((fact) => temporarySourceFactId(fact) === args.targetFactId)) {
        return { ok: false, reason: 'temporary_source_fact_candidate_missing' };
      }
      if (semanticFingerprint(accepted.temporarySourceFacts) !== factsFingerprint) {
        return { ok: false, reason: 'temporary_source_fact_candidate_mismatch' };
      }
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
        return { ok: false, reason: 'accepted_composition_base_changed_by_temporary_fact' };
      }
      if (accepted.acceptedCompositionBase?.provenance !== compositionBase.provenance) {
        return { ok: false, reason: 'accepted_composition_base_provenance_mismatch' };
      }
      if (semanticFingerprint(useProgramStore.getState().reversibleAdjustmentLedger) !== ledgerFingerprint) {
        return { ok: false, reason: 'temporary_source_fact_created_reversible_adjustment' };
      }
      return { ok: true };
    },
    verifyAfterPersistence: () => {
      if (args.testHooks?.verifyAfterPersistence?.() === false) {
        return { ok: false, reason: 'temporary_source_fact_durable_readback_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext);
      if (semanticFingerprint(accepted.temporarySourceFacts) !== factsFingerprint) {
        return { ok: false, reason: 'temporary_source_fact_durable_readback_mismatch' };
      }
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
        return { ok: false, reason: 'accepted_composition_base_durable_readback_mismatch' };
      }
      if (accepted.acceptedCompositionBase?.provenance !== compositionBase.provenance) {
        return { ok: false, reason: 'accepted_composition_base_provenance_durable_readback_mismatch' };
      }
      return { ok: true };
    },
  });
  if (!('route' in transaction)) {
    return {
      ok: true,
      acceptedStateChanged: true,
      visibleProgramChanged: transaction.diff.hasProgrammingChange,
      changedProgram: transaction.diff.hasProgrammingChange,
    };
  }
  return {
    ok: false,
    acceptedStateChanged: false,
    visibleProgramChanged: false,
    changedProgram: false,
    route: transaction.route,
    reason: transaction.reason,
  };
}

function comparableFact(fact: TemporarySourceFact): unknown {
  if (isInjurySourceFact(fact)) return fact;
  const { createdAt: _createdAt, updatedAt: _updatedAt, resolvedAt: _resolvedAt, ...rest } = fact;
  return rest;
}

function exactFactReplacement(
  existing: TemporarySourceFact,
  replacement: TemporarySourceFact,
): TemporarySourceFact {
  if (isInjurySourceFact(existing) || isInjurySourceFact(replacement)) return replacement;
  return {
    ...replacement,
    createdAt: existing.createdAt,
    resolvedAt: replacement.status === 'active' ? null : replacement.resolvedAt,
    transitionHistory: [...existing.transitionHistory],
  };
}

function statusForOperation(operation: TemporarySourceFactOperation): TemporarySourceFactStatus | null {
  if (operation === 'resolve') return 'resolved';
  if (operation === 'expire') return 'expired';
  if (operation === 'supersede') return 'superseded';
  return null;
}

export async function transactTemporarySourceFact(
  input: TemporarySourceFactTransactionInput,
): Promise<TemporarySourceFactTransactionResult> {
  const trace = currentAthleteActionTrace();
  emitAthleteActionEvent(trace, 'athlete_action_parsed', {
    parsedMutationType: `temporary_source_fact:${input.operation}`,
    sourceFactId: input.factId ?? (input.fact ? temporarySourceFactId(input.fact) : null),
    sourceSurface: input.sourceSurface ?? null,
  });
  const result = await transactTemporarySourceFactWithinTrace(input);
  const succeeded = result.outcome !== 'conflicted' && result.outcome !== 'safely_rejected';
  if (succeeded && result.outcome !== 'no_op' && result.factId) {
    emitAthleteActionEvent(trace, 'mutation_constraint_created', {
      constraintType: 'temporary_source_fact',
      constraintId: result.factId,
      constraintStatus: result.outcome.startsWith('resolved')
        ? 'resolved'
        : result.outcome.startsWith('expired') ? 'expired' : 'active',
      factOperation: input.operation,
      changedProgram: result.changedProgram,
      sourceSurface: input.sourceSurface ?? null,
    });
  }
  const internalResultCode = `temporary_source_fact_${result.outcome}`;
  emitAthleteActionEvent(
    trace,
    succeeded ? 'athlete_action_completed' : 'athlete_action_failed',
    succeeded
      ? {
          outcome: result.changedProgram ? 'accepted_changed' : 'accepted_no_change',
          internalResultCode,
          factId: result.factId,
        }
      : {
          outcome: 'rejected',
          internalResultCode,
          originalRejectionCode: result.reason ?? result.outcome,
          rejectionCodes: [result.reason ?? result.outcome],
          firstFailingBoundary: 'temporarySourceFactTransaction',
          failureCategory: classifyAthleteActionFailure(
            result.reason ?? result.outcome,
            'temporarySourceFactTransaction',
          ),
          validCandidateExisted: false,
          previousStateRestored: true,
          terminalReasonChain: trace
            ? athleteActionTerminalReasonChain(trace.traceId)
            : [],
        },
  );
  return result;
}

async function transactTemporarySourceFactWithinTrace(
  input: TemporarySourceFactTransactionInput,
): Promise<TemporarySourceFactTransactionResult> {
  const now = input.now ?? new Date().toISOString();
  const todayISO = (input.todayISO ?? localToday()).slice(0, 10);
  const ownership = loadCanonicalTemporarySourceFactOwnership(now);
  if (input.expectedAcceptedRevision !== undefined &&
    input.expectedAcceptedRevision !== ownership.context.revision) {
    return {
      outcome: 'conflicted', factId: input.factId ?? (input.fact ? temporarySourceFactId(input.fact) : null),
      changedProgram: false, message: 'The accepted program changed before this report could be applied.',
      reason: 'accepted_revision_changed',
    };
  }
  let nextFacts = expireTemporarySourceFacts(ownership.context.temporarySourceFacts, todayISO, now);
  let effectiveOperation = input.operation;
  const dueExpiryChanged = semanticFingerprint(nextFacts) !==
    semanticFingerprint(ownership.context.temporarySourceFacts);
  let targetFactId = input.factId ?? (input.fact ? temporarySourceFactId(input.fact) : null);
  if (input.operation === 'hydrate') {
    if (nextFacts.length === 0) {
      nextFacts = migrateLegacyTemporarySourceFacts({
        activeConstraints: ownership.context.activeConstraints,
        activeInjury: ownership.context.activeInjury,
        readinessSignalsByDate: ownership.context.readinessSignalsByDate,
      });
    }
    targetFactId = targetFactId ?? (nextFacts[0]
      ? temporarySourceFactId(nextFacts[0])
      : 'temporary-source-facts:empty');
  } else if (input.operation === 'create' || input.operation === 'update') {
    if (!input.fact) {
      return { outcome: 'safely_rejected', factId: targetFactId, changedProgram: false, message: 'No exact source fact was supplied.', reason: 'temporary_source_fact_missing' };
    }
    targetFactId = temporarySourceFactId(input.fact);
    const index = nextFacts.findIndex((fact) => temporarySourceFactId(fact) === targetFactId);
    if (input.operation === 'update' && index < 0) {
      return { outcome: 'conflicted', factId: targetFactId, changedProgram: false, message: 'That active report could not be matched.', reason: 'temporary_source_fact_not_found' };
    }
    if (input.operation === 'create' && index >= 0 &&
      semanticFingerprint(comparableFact(nextFacts[index])) === semanticFingerprint(comparableFact(input.fact))) {
      if (semanticFingerprint(nextFacts) === semanticFingerprint(ownership.context.temporarySourceFacts)) {
        return { outcome: 'no_op', factId: targetFactId, changedProgram: false, message: 'That report is already active.' };
      }
    } else if (index >= 0) {
      if (input.operation === 'create') effectiveOperation = 'update';
      nextFacts = nextFacts.map((fact, factIndex) => factIndex === index
        ? exactFactReplacement(fact, input.fact!)
        : fact);
    } else {
      nextFacts = [...nextFacts, input.fact];
    }
  } else {
    if (!targetFactId) {
      return { outcome: 'safely_rejected', factId: null, changedProgram: false, message: 'No exact source fact was selected.', reason: 'temporary_source_fact_id_missing' };
    }
    const status = statusForOperation(input.operation)!;
    const existing = nextFacts.find((fact) => temporarySourceFactId(fact) === targetFactId);
    if (!existing) {
      return { outcome: 'conflicted', factId: targetFactId, changedProgram: false, message: 'That active report could not be matched.', reason: 'temporary_source_fact_not_found' };
    }
    const alreadyInactive = isInjurySourceFact(existing)
      ? existing.status === 'resolved' || existing.status === 'superseded'
      : existing.status !== 'active';
    if (alreadyInactive) {
      if (!isInjurySourceFact(existing) && existing.status === 'expired' && dueExpiryChanged) {
        effectiveOperation = 'expire';
      } else {
        return { outcome: 'no_op', factId: targetFactId, changedProgram: false, message: 'That report is already inactive.' };
      }
    }
    if (isInjurySourceFact(existing)) {
      return { outcome: 'safely_rejected', factId: targetFactId, changedProgram: false, message: 'Injury transitions require the typed injury transition payload.', reason: 'injury_transition_payload_required' };
    }
    if (effectiveOperation !== 'expire') {
      const actor = input.sourceActor ?? existing.sourceActor;
      const surface = input.sourceSurface ?? existing.sourceSurface;
      const replacement: TemporarySourceFact = {
        ...existing,
        status,
        updatedAt: now,
        resolvedAt: now,
        sourceActor: actor,
        sourceSurface: surface,
        transitionHistory: [
          ...existing.transitionHistory,
          {
            at: now,
            from: existing.status,
            to: status,
            actor,
            surface,
            reason: `transaction_${effectiveOperation}`,
          },
        ],
      };
      nextFacts = nextFacts.map((fact) => temporarySourceFactId(fact) === targetFactId
        ? replacement
        : fact);
    }
  }
  nextFacts = normalizeTemporarySourceFacts({ value: nextFacts });
  const persisted = await commitTemporarySourceFactSet({
    nextFacts,
    targetFactId: targetFactId ?? 'temporary-source-facts:empty',
    todayISO,
    reason: `temporary_source_fact:${effectiveOperation}`,
    now,
    expectedAcceptedRevision: input.expectedAcceptedRevision ?? ownership.context.revision,
    testHooks: input.testHooks,
  });
  if (!persisted.ok) {
    return {
      outcome: persisted.route === 'conflicted' ? 'conflicted' : 'safely_rejected',
      factId: targetFactId,
      changedProgram: false,
      message: persisted.route === 'conflicted'
        ? 'The accepted program changed before this report could be applied.'
        : 'The report was not applied because the visible program could not be verified.',
      reason: persisted.reason,
    };
  }
  const prefix = effectiveOperation === 'hydrate' ? 'hydrated' : `${effectiveOperation}d`;
  const target = nextFacts.find((fact) => temporarySourceFactId(fact) === targetFactId);
  const subject = target && !isInjurySourceFact(target)
    ? target.factKind === 'equipment'
      ? 'equipment restriction'
      : target.factKind === 'schedule'
        ? 'schedule restriction'
        : target.factKind === 'time_cap'
          ? 'temporary time cap'
          : 'report'
    : 'report';
  return {
    outcome: `${prefix}_${persisted.changedProgram ? 'and_recomposed' : 'no_program_change'}` as TemporarySourceFactTransactionOutcome,
    factId: targetFactId,
    changedProgram: persisted.changedProgram,
    message: persisted.changedProgram
      ? effectiveOperation === 'resolve' || effectiveOperation === 'expire' ||
        effectiveOperation === 'supersede'
        ? `That ${subject} is inactive. The visible program was recomposed from the clean accepted base, restoring only what verification allowed while preserving other active facts and later edits.`
        : `The ${subject} is active and the visible program was safely recomposed.`
      : effectiveOperation === 'resolve' || effectiveOperation === 'expire' ||
        effectiveOperation === 'supersede'
        ? `That ${subject} is inactive. Other active facts and later program edits were preserved.`
        : `The ${subject} is active. No visible session needed changing.`,
  };
}

export async function hydrateTemporarySourceFacts(todayISO?: string): Promise<TemporarySourceFactTransactionResult> {
  return transactTemporarySourceFact({ operation: 'hydrate', todayISO, sourceActor: 'system', sourceSurface: 'hydration_migration' });
}
