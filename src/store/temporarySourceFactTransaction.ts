import { logger } from '../utils/logger';
import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  acceptedProfileForContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedCompositionBaseV1,
} from './acceptedStateColdStart';
import { commitAcceptedStateTransaction } from './acceptedStateTransaction';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import { useProgramStore } from './programStore';
import { useProfileStore } from './profileStore';
import { factHorizon } from '../rules/durableFactHorizon';
import {
  composeTemporarySourceFactCompatibility,
  expireTemporarySourceFacts,
  isInjurySourceFact,
  isTemporaryEquipmentFact,
  normalizeTemporarySourceFacts,
  temporarySourceFactId,
  type TemporarySourceFact,
  type TemporarySourceFactActor,
  type TemporarySourceFactStatus,
} from '../rules/temporarySourceFact';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  targetWeekFixtures,
  type FixtureAvailabilityKind,
} from '../rules/fixtureConditionedAvailability';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import {
  athleteActionTerminalReasonChain,
  classifyAthleteActionFailure,
  currentAthleteActionTrace,
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

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

/**
 * WHY an inert commit changed nothing, typed — so the acknowledgment owner can
 * select its clause from the COMMITTED result, never from the door or the date
 * alone. 'fixture_day' is Sam's §7 answer (2026-08-03): a time-cap fact whose
 * every target date is a fixture day has nothing to shorten, records inert,
 * and the athlete is told the game-day truth.
 */
export type TemporarySourceFactInertReason = 'fixture_day';

export interface TemporarySourceFactTransactionResult {
  outcome: TemporarySourceFactTransactionOutcome;
  factId: string | null;
  changedProgram: boolean;
  message: string;
  reason?: string;
  inertReason?: TemporarySourceFactInertReason;
  /** The fixture's own kind — picks the signed sentence's variant (§10). */
  inertFixtureVariant?: FixtureAvailabilityKind;
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
  /** Rider 3: the weeks a scoped-regen authoring actually changed, so the
   *  disclosure copy derives from the committed diff. */
  changedWeekStarts?: string[];
  reason?: string;
  route?: string;
  inertReason?: TemporarySourceFactInertReason;
  /** The fixture's own kind — picks the signed sentence's variant (§10). */
  inertFixtureVariant?: FixtureAvailabilityKind;
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
      continue;
    }
    // Stage 1: the reached weeks come from the fact's horizon, asked of its
    // owner. An OPEN horizon has no last week of its own, so it reaches every
    // week the athlete actually has — which the program weeks above already
    // enumerate. Reading `effectiveUntil` here was the third of the four
    // duration representations.
    const horizon = factHorizon(fact);
    weeks.add(mondayFor(horizon.startsFrom));
    if (horizon.endsAfter !== null) weeks.add(mondayFor(horizon.endsAfter));
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
  // ⚠ THE UNOWNED-CONSTRAINT BACK-FILL IS DELETED (demolition area 4).
  //
  // It manufactured typed source facts for stored constraints that carried no
  // `injuryEpisodeId` and no `temporarySourceFactIds` — the shape of a world
  // written before typed facts existed. No production users exist, so there is
  // no such world. A constraint's WRITER produces its fact; nothing back-fills
  // one at load, which is also the only way a fact can carry honest provenance.
  facts = normalizeTemporarySourceFacts({ value: [...facts] });
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
    readinessSignalsByDate: compatibility.readinessSignalsByDate,
    acceptedCompositionBase: compositionBase,
  });
  return { context, compositionBase };
}

/**
 * Record the fact, then reconstruct from inputs inside the existing atomic
 * transaction. There is no live-only overlay author or stored-prior-world
 * restoration. Boot and live changes execute the same compiler fold.
 */
export async function commitTemporarySourceFactSet(
  args: CommitTemporarySourceFactSetInput,
): Promise<CommitTemporarySourceFactSetResult> {
  const now = args.now ?? new Date().toISOString();
  const ownership = loadCanonicalTemporarySourceFactOwnership(now);
  if (args.expectedAcceptedRevision !== undefined &&
      args.expectedAcceptedRevision !== ownership.context.revision) {
    return { ok: false, acceptedStateChanged: false, visibleProgramChanged: false,
      changedProgram: false, route: 'conflicted', reason: 'accepted_revision_changed' };
  }
  const facts = normalizeTemporarySourceFacts({
    value: expireTemporarySourceFacts(args.nextFacts, args.todayISO, now),
  });
  const compatibility = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: facts,
    activeConstraints: ownership.context.activeConstraints,
    readinessSignalsByDate: ownership.context.readinessSignalsByDate,
  });
  const fingerprint = semanticFingerprint(facts);
  const horizon = affectedHorizon(args.todayISO, facts);
  const before = useProgramStore.getState();
  const target = facts.find(fact => temporarySourceFactId(fact) === args.targetFactId);
  const profile = acceptedProfileForContext(ownership.context, useProfileStore.getState().onboardingData);
  const fixtureKinds = target && !isInjurySourceFact(target) && target.factKind === 'time_cap'
    ? (target.dates ?? []).map(date => targetWeekFixtures({
        profile, weekStart: mondayFor(date), markedDays: ownership.context.markedDays,
        ownedPhase: ownSeasonPhase({ program: before.currentProgram, profile }),
      }).find(fixture => fixture.date === date)?.kind)
    : [];
  const inertFixtureVariant = fixtureKinds.length > 0 && fixtureKinds.every(Boolean)
    ? fixtureKinds[0] : undefined;
  const beforeWeeks = new Map(horizon.weeks.map(week => [week,
    semanticFingerprint(before.weekScopedOverlays[week] ?? null)]));
  const verifyFacts = (): boolean => semanticFingerprint(
    normalizeAcceptedMaterialContext(useProgramStore.getState().acceptedMaterialContext)
      .temporarySourceFacts) === fingerprint;
  const transaction = await runCoachMutationTransaction({
    todayISO: args.todayISO, extraDates: horizon.dates, trace: args.trace,
    allowAcceptedStateOnlyChange: true,
    mutate: () => {
      args.testHooks?.beforeStage?.();
      const committed = commitAcceptedStateTransaction({
        reason: args.reason, operation: 'forward_decision',
        temporarySourceFacts: facts, injuryEpisodes: compatibility.injuryEpisodes,
        activeConstraints: compatibility.activeConstraints,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        preserveExactAcceptedWorkouts: true, skipConstraintProjection: true,
        validateWeekStarts: [],
      });
      args.testHooks?.beforeEffectiveValidation?.();
      if (before.currentProgram) {
        const { rebuildDerivedWorldNow } = require('./quiescentBoot');
        rebuildDerivedWorldNow();
      }
      return committed;
    },
    didApply: () => true,
    verifyCandidate: () => {
      if (args.testHooks?.verifyCandidate?.() === false) {
        return { ok: false, reason: 'temporary_source_fact_visible_candidate_test_rejection' };
      }
      return verifyFacts() ? { ok: true } : { ok: false, reason: 'temporary_source_fact_candidate_mismatch' };
    },
    verifyAfterPersistence: () => {
      if (args.testHooks?.verifyAfterPersistence?.() === false) {
        return { ok: false, reason: 'temporary_source_fact_durable_readback_test_rejection' };
      }
      return verifyFacts() ? { ok: true } : { ok: false, reason: 'temporary_source_fact_durable_readback_mismatch' };
    },
  });
  if ('route' in transaction) {
    return { ok: false, acceptedStateChanged: false, visibleProgramChanged: false,
      changedProgram: false, route: transaction.route, reason: transaction.reason };
  }
  return { ok: true, acceptedStateChanged: true,
    visibleProgramChanged: transaction.diff.hasProgrammingChange,
    changedProgram: transaction.diff.hasProgrammingChange,
    inertReason: inertFixtureVariant ? 'fixture_day' : undefined,
    inertFixtureVariant,
    changedWeekStarts: horizon.weeks.filter(week => beforeWeeks.get(week) !==
      semanticFingerprint(useProgramStore.getState().weekScopedOverlays[week] ?? null)),
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
    // The legacy hydration migration is deleted (demolition area 4): an empty
    // fact list now means the athlete has no temporary facts, not that they
    // have some in a shape this build cannot read.
    targetFactId = targetFactId ?? (nextFacts[0]
      ? temporarySourceFactId(nextFacts[0])
      : 'temporary-source-facts:empty');
  } else if (input.operation === 'create' || input.operation === 'update') {
    if (!input.fact) {
      return { outcome: 'safely_rejected', factId: targetFactId, changedProgram: false, message: 'No exact source fact was supplied.', reason: 'temporary_source_fact_missing' };
    }
    if ('factKind' in input.fact && input.fact.factKind === 'soreness') {
      return { outcome: 'safely_rejected', factId: temporarySourceFactId(input.fact), changedProgram: false, message: 'This option is no longer available.', reason: 'retired_soreness_input' };
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
        resolvedOnISO: todayISO,
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
      // Cancel the trip and its paired equipment answer in one transaction.
      // Only input facts change; the compiler restores the resulting week.
      const trip = input.operation === 'resolve' && existing.factKind === 'schedule' &&
        (existing.scheduleKind === 'travel' || existing.scheduleKind === 'no_team_training');
      nextFacts = nextFacts.map((fact) => {
        if (temporarySourceFactId(fact) === targetFactId) return replacement;
        if (trip && isTemporaryEquipmentFact(fact) && fact.status === 'active' &&
            fact.sourceSurface === 'away_this_week' && fact.scope.kind === 'window' &&
            existing.scope.kind === 'window' && fact.scope.from === existing.scope.from &&
            fact.scope.until === existing.scope.until) {
          return { ...fact, status, updatedAt: now, resolvedAt: now, resolvedOnISO: todayISO,
            transitionHistory: [...fact.transitionHistory, {
              at: now, from: fact.status, to: status, actor, surface,
              reason: `transaction_${effectiveOperation}_linked_trip`,
            }] };
        }
        return fact;
      });
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
    // ── A REFUSAL WITH NO REASON ON THE WIRE IS ITS OWN DEFECT ──
    // **SEAT_INBOX item 30, 2026-08-13.** The athlete read *"That didn't save —
    // your week is unchanged."* on a real device and NOTHING said why: two
    // reproduction attempts, an OS-log detour and a second Metro all found the
    // regen succeeding and the commit rejected in silence. **The typed reason
    // existed the whole time and nobody printed it.**
    // It goes to `logger.warn` rather than a diagnostic tape on purpose — the
    // tape is for athlete ACTIONS, and this is the engine explaining a refusal
    // to whoever is watching the bundler when it happens.
    logger.warn('[temporary-source-fact] refused', {
      route: persisted.route,
      reason: persisted.reason,
      operation: effectiveOperation,
      factId: targetFactId,
    });
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
  // A severe (bed-ridden) illness derives the illness_recovery week mode: nothing
  // is required this week and the remaining work is optional/reduced. Disclose
  // that specifically when it lands, rather than the generic recompose line.
  const severeIllnessLanding = target && !isInjurySourceFact(target) &&
    target.factKind === 'illness' && 'severity' in target && target.severity === 'severe' &&
    effectiveOperation === 'create';
  // Rider 3: the multi-week half of the disclosure comes from the COMMITTED
  // diff — the weeks the scoped regen actually changed — never from the
  // action kind alone.
  const laterWeeksChanged = (persisted.changedWeekStarts ?? [])
    .some((weekStart) => weekStart > mondayFor(todayISO));
  return {
    outcome: `${prefix}_${persisted.changedProgram ? 'and_recomposed' : 'no_program_change'}` as TemporarySourceFactTransactionOutcome,
    factId: targetFactId,
    changedProgram: persisted.changedProgram,
    inertReason: persisted.inertReason,
    inertFixtureVariant: persisted.inertFixtureVariant,
    message: severeIllnessLanding
      ? "Rest up — nothing's required this week. I've left gentle optional work if you're up to it, at a lighter dose." +
        (laterWeeksChanged
          ? " I've eased the weeks ahead the same way — they stay that way until you tell me you're better."
          : '')
      : persisted.changedProgram
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
