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
  type AcceptedStateTransactionResult,
} from './acceptedStateTransaction';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import {
  canonicaliseAcceptedStateCandidate,
  getCurrentBlockNumberForGeneration,
  useProgramStore,
} from './programStore';
import { useProfileStore } from './profileStore';
import type { WeekScopedWorkoutOverlay } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { buildWeekScopedWorkoutOverlay } from '../utils/weekRebuild';
import { deriveIllnessRecoveryWeekMode } from '../rules/illnessRecoveryWeekMode';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  activeUserRemovalConstraintsForWeek,
  applyAthleteRemovalTypedReduction,
} from '../rules/userRemovalConstraints';
import {
  REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
  reversibleAdjustmentId,
  type ReversibleAdjustmentRecord,
} from '../rules/reversibleAdjustmentLedger';
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
 * A DERIVING readiness/illness fact is an AUTHORING event: it changes what the
 * athlete is prescribed. Severe illness derives the illness_recovery §18 week
 * mode; cooked fatigue derives a readiness reduction. Neither is delivered by
 * the pure-projection resolvers (mode/reduction live only in generation), so the
 * overlay-preserving inert path is a silent no-op. This authors the reduced week
 * as a scoped regeneration committed as a week overlay + fact-linked reversible
 * adjustment, mirroring repeatWeek: the base microcycle stays clean, the overlay
 * is the mutation layer, and clearing the fact cascade-reverts byte-exact via the
 * stored prior overlay (R12, keyed on `sourceFactId`).
 */
function buildDerivingSourceFactAdjustment(args: {
  sourceFactId: string;
  weekStart: string;
  beforeOverlay: WeekScopedWorkoutOverlay | null;
  afterOverlay: WeekScopedWorkoutOverlay;
  acceptedRevision: number;
  createdAt: string;
}): ReversibleAdjustmentRecord {
  const sourceActionOrIntentId = `${args.sourceFactId}:${args.weekStart}`;
  const id = reversibleAdjustmentId({
    kind: 'deriving_source_fact',
    sourceActionOrIntentId,
    createdAt: args.createdAt,
  });
  const affectedDates = Array.from({ length: 7 }, (_, offset) => addDays(args.weekStart, offset));
  return {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    id,
    kind: 'deriving_source_fact',
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
    sourceActionOrIntentId,
    sourceProducer: 'tap',
    sourceFactId: args.sourceFactId,
    createdAt: args.createdAt,
    acceptedRevision: args.acceptedRevision,
    status: 'active',
    clearedAt: null,
    supersededById: null,
    supersededReason: null,
    affectedDates,
    affectedWeeks: [args.weekStart],
    rollingDependencyWeeks: [args.weekStart],
    displacedOriginalState: {
      ownedDays: [],
      ownedWeeks: [],
      calendarFacts: [],
      userRemovalConstraint: null,
      weekOverlay: {
        weekStart: args.weekStart,
        before: clone(args.beforeOverlay),
        after: clone(args.afterOverlay),
        beforeFingerprint: semanticFingerprint(args.beforeOverlay),
        afterFingerprint: semanticFingerprint(args.afterOverlay),
      },
      sweptOverrides: [],
      provenanceDeltas: { added: [], removed: [] },
      typedReductionDeltas: { added: [], removed: [] },
    },
    acceptedAfterSemanticFingerprints: [],
    restorationTarget: {
      kind: 'week_overlay',
      dates: affectedDates,
      stableIdentities: [args.afterOverlay.id],
    },
    linkedConstraintIds: [],
    linkedCalendarFacts: [],
    linkedOverrideOwners: [],
    linkedOverlayIds: [args.afterOverlay.id],
    linkedUserRemovalConstraintIds: [],
    linkedProvenanceIds: [],
    linkedTypedReductions: [],
    validity: {
      reversible: true,
      source: 'runtime_exact_delta',
      validWhile: ['target_overlay_matches_deriving_accepted_after'],
      invalidWhen: [
        'newer_overlapping_athlete_intent_exists',
        'unowned_target_overlay_drift',
      ],
    },
    laterIntentPolicy: 'newer_athlete_intent_wins',
  };
}

function commitDerivingSourceFactScopedRegen(args: {
  compositionBase: AcceptedCompositionBaseV1;
  normalizedFacts: TemporarySourceFact[];
  compatibility: ReturnType<typeof composeTemporarySourceFactCompatibility>;
  weekStart: string;
  reason: string;
  sourceFactId: string;
  now: string;
}): AcceptedStateTransactionResult {
  const state = useProgramStore.getState();
  const currentProgram = state.currentProgram;
  if (!currentProgram) throw new Error('deriving_scoped_regen_requires_current_program');
  const profile = acceptedProfileForContext(
    normalizeAcceptedMaterialContext(state.acceptedMaterialContext),
    useProfileStore.getState().onboardingData,
  );
  // 1. Generate the reduced week with the PENDING facts threaded, so the per-week
  //    context mints the illness_recovery mode / readiness reduction (the store is
  //    still fact-empty mid-transaction). Single microcycle — the target week only.
  const generated = generateProgramLocally(profile, {
    todayISO: args.weekStart,
    blockNumber: getCurrentBlockNumberForGeneration(args.weekStart),
    previousProgram: currentProgram,
    seasonPhaseClock: currentProgram.seasonPhaseClock,
    activeConstraints: args.compatibility.activeConstraints.filter((constraint) =>
      isTemporarySourceFactConstraint(constraint)),
    temporarySourceFacts: args.normalizedFacts,
    microcycleLimit: 1,
  });
  // 2. The regenerated microcycle becomes a sparse week overlay (the mutation
  //    layer). The base microcycle is never touched.
  const built = buildWeekScopedWorkoutOverlay({
    program: generated,
    weekStart: args.weekStart,
    anchorDate: null,
    reason: 'readiness_reduction',
  });
  let overlay: WeekScopedWorkoutOverlay = { ...built, createdAt: args.now, updatedAt: args.now };
  // Preserve athlete pins across the regen: a session removed BEFORE the fact
  // stays removed over the reduced week (the removal re-applies at resolve), and
  // the reduced contract must AUTHORISE that removal — otherwise §18 flags the
  // pinned gap as a planner-target / pattern shortfall. This mirrors the accepted
  // week's own removal path (applyAthleteRemovalTypedReduction).
  const activeRemovals = activeUserRemovalConstraintsForWeek(
    state.userRemovalConstraints, args.weekStart);
  if (activeRemovals.length > 0 && overlay.exposureContractV2) {
    // Lower the reduced contract to the athlete's actual pinned week and iterate
    // to a fixpoint. The commit's equivalence check both (a) rejects blocking
    // violations and (b) requires the persisted contract to equal the
    // safety-finalised evaluation contract — so each pass ADOPTS the finaliser's
    // contract (which can expose a second-order pattern shortfall) and re-authors
    // the removal against the finalised visible week. Bounded + monotonic,
    // mirroring the accepted-week deletion path (fixtureMinimalReplan).
    let contract = overlay.exposureContractV2;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const trial: WeekScopedWorkoutOverlay = { ...overlay, exposureContractV2: contract };
      const rebased = rebaseAcceptedEffectiveWeek({
        surfaces: {
          ...state,
          weekScopedOverlays: { ...state.weekScopedOverlays, [args.weekStart]: trial },
        } as never,
        weekStart: args.weekStart,
        profile,
        markedDays: state.acceptedMaterialContext.markedDays,
      });
      const finalised = rebased.evaluation.contract;
      const stable = semanticFingerprint(finalised) === semanticFingerprint(contract);
      if (rebased.evaluation.blockingViolations.length === 0 && stable) break;
      let next = finalised;
      for (const constraint of activeRemovals) {
        next = applyAthleteRemovalTypedReduction({
          contract: next, workouts: rebased.visibleWorkouts, weekStart: args.weekStart, constraint,
        });
      }
      if (semanticFingerprint(next) === semanticFingerprint(contract)) { contract = finalised; break; }
      contract = next;
    }
    overlay = { ...overlay, exposureContractV2: contract };
  }
  const beforeOverlay = state.weekScopedOverlays[args.weekStart] ?? null;
  // 3. Fact-linked reversible adjustment with the byte-exact prior overlay.
  const adjustment = buildDerivingSourceFactAdjustment({
    sourceFactId: args.sourceFactId,
    weekStart: args.weekStart,
    beforeOverlay,
    afterOverlay: overlay,
    acceptedRevision: state.acceptedMaterialContext.revision + 1,
    createdAt: args.now,
  });
  // 4. One atomic authoring commit: overlay + ledger + fact context. The base
  //    stays clean (preserveExactAcceptedWorkouts); the overlay carries the
  //    reduced contract, validated for the effective week by validateWeekStarts.
  return commitAcceptedStateTransaction({
    reason: args.reason,
    program: {
      weekScopedOverlays: { ...state.weekScopedOverlays, [args.weekStart]: overlay },
      reversibleAdjustmentLedger: {
        protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
        adjustments: [...state.reversibleAdjustmentLedger.adjustments, adjustment],
      },
    },
    temporarySourceFacts: args.normalizedFacts,
    injuryEpisodes: args.compatibility.injuryEpisodes,
    activeConstraints: args.compatibility.activeConstraints,
    activeInjury: args.compatibility.activeInjury,
    readinessSignalsByDate: args.compatibility.readinessSignalsByDate,
    acceptedCompositionBase: args.compositionBase,
    profile,
    preserveExactAcceptedWorkouts: true,
    skipConstraintProjection: true,
    validateWeekStarts: [args.weekStart],
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
  // A fact commit that composes NO change to the exposure-affecting (source-fact)
  // constraints is INERT: it changes no visible program, so it must NOT re-run the
  // whole-week §18 MUTATION gate. A contextual signal is not a program mutation —
  // it commits off that boundary (Q4/Q5; Sam 2026-07-22). Deriving facts (which
  // add or remove a source-fact constraint, e.g. severe fatigue / injury) still run
  // the gate. This is the fix for the whole-week §18 gateway firing on a record-only
  // fact commit. See docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md.
  const sourceFactConstraintSignature = (constraints: readonly unknown[]): string =>
    JSON.stringify((constraints as Array<{ id?: string; type?: string; severity?: number }>)
      .filter((constraint) => isTemporarySourceFactConstraint(constraint as never))
      .map((constraint) => ({ id: constraint.id, type: constraint.type, severity: constraint.severity }))
      .sort((left, right) => String(left.id).localeCompare(String(right.id))));
  const inertComposition = sourceFactConstraintSignature(ownership.context.activeConstraints)
    === sourceFactConstraintSignature(compatibility.activeConstraints);
  // A DERIVING readiness/illness fact (severe illness → illness_recovery, cooked
  // fatigue → readiness reduction) is an AUTHORING event with no projection home:
  // the mode/reduction lives only in generation. When a NEW auto-protect
  // (type 'fatigue') source-fact constraint appears, route it through a scoped
  // regeneration committed as a week overlay + fact-linked adjustment, rather than
  // the overlay-preserving inert path (a silent no-op) or the base-immutability
  // guard (a reject). Injury/equipment/schedule facts deliver via projection and
  // stay on their existing path. See
  // docs/DERIVING_SOURCE_FACT_SCOPED_REGEN_REASSESSMENT_2026-07-23.md.
  const fatigueSourceFactIds = (constraints: readonly unknown[]): Set<string> =>
    new Set((constraints as Array<{ id?: string; type?: string }>)
      .filter((constraint) => constraint.type === 'fatigue' &&
        isTemporarySourceFactConstraint(constraint as never))
      .map((constraint) => String(constraint.id)));
  const priorFatigueIds = fatigueSourceFactIds(ownership.context.activeConstraints);
  const scopedRegenWeekStart = mondayFor(args.todayISO);
  const scopedRegen = !inertComposition &&
    Array.from(fatigueSourceFactIds(compatibility.activeConstraints))
      .some((id) => !priorFatigueIds.has(id));
  // Typed ownership (undo = stored prior state, never re-derive): removing a fact that
  // OWNS a scoped-regen reversible adjustment (sourceFactId-linked) is a stored-prior-state
  // restore, not a re-derivation. The scoped-regen ADD kept the base clean (preserveExact)
  // — its overlay carried the reduction — and the cascade revert has already put the base
  // back. Re-canonicalising here would re-author a base this fact never owned (e.g. null
  // today's workout on a game week), tripping the base-immutability guard: the finding #4
  // half-apply. Preserve the base exactly, symmetric with the ADD. The ownership link is
  // the whole condition — NO fact-kind sniffing. Projection-delivered facts (equipment/
  // schedule/time_cap) own no such adjustment and keep re-projecting on the path below.
  // See docs/ILLNESS_CLEAR_LEDGER_REASSESSMENT_2026-07-23.md.
  const ownsScopedRegenAdjustment = useProgramStore.getState()
    .reversibleAdjustmentLedger.adjustments
    .some((adjustment) => adjustment.kind === 'deriving_source_fact' &&
      adjustment.sourceFactId === args.targetFactId);
  const scopedRegenRestore = !inertComposition && !scopedRegen && ownsScopedRegenAdjustment;
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
      if (!inertComposition) {
        args.testHooks?.beforeEffectiveValidation?.();
        // A deriving fact still runs the §18 gate (the fact stays gated — R9/R14),
        // but its effective week is the RE-AUTHORED reduced week, not the base.
        if (scopedRegen) {
          return commitDerivingSourceFactScopedRegen({
            compositionBase,
            normalizedFacts,
            compatibility,
            weekStart: scopedRegenWeekStart,
            reason: args.reason,
            sourceFactId: args.targetFactId,
            now,
          });
        }
        // A scoped-regen RESTORE re-authors nothing: the cascade revert already restored
        // the stored prior base, and the commit below preserves it exactly. Its effective
        // week is that restored (previously validated) base, re-gated by validateWeekStarts.
        if (!scopedRegenRestore) {
          validateEffectiveComposition({
            base: compositionBase,
            context: nextContext,
            weekStarts: horizon.weeks,
          });
        }
      }
      return commitAcceptedStateTransaction({
        reason: args.reason,
        program: compositionBase.surfaces,
        temporarySourceFacts: normalizedFacts,
        injuryEpisodes: compatibility.injuryEpisodes,
        activeConstraints: compatibility.activeConstraints,
        activeInjury: compatibility.activeInjury,
        readinessSignalsByDate: compatibility.readinessSignalsByDate,
        acceptedCompositionBase: compositionBase,
        // Inert facts commit off the mutation boundary: no whole-week §18 re-gate,
        // AND the exact accepted program surfaces are preserved (no re-canonicalise).
        // Re-canonicalising a record-only fact mutates `acceptedCompositionBase.surfaces`,
        // which `verifyCandidate` rejects with
        // `accepted_composition_base_changed_by_temporary_fact` (the on-device failure).
        validateWeekStarts: inertComposition ? [] : horizon.weeks,
        // Base-preserving for inert facts AND scoped-regen restores (both own no base
        // change); the re-canonicalising path stays for projection-delivered facts.
        preserveExactAcceptedWorkouts: (inertComposition || scopedRegenRestore) ? true : undefined,
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
      // A scoped-regen authoring commit LEGITIMATELY re-authors the accepted
      // surfaces (adds the week overlay) and the ledger (the fact-linked
      // adjustment) — the same base-change authority weekRebuild:block uses. The
      // base-immutability and ledger-immutability guards protect the INERT path
      // only; they do not apply to an authorised deriving regen.
      if (!scopedRegen) {
        if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
          return { ok: false, reason: 'accepted_composition_base_changed_by_temporary_fact' };
        }
        if (semanticFingerprint(useProgramStore.getState().reversibleAdjustmentLedger) !== ledgerFingerprint) {
          return { ok: false, reason: 'temporary_source_fact_created_reversible_adjustment' };
        }
      }
      if (accepted.acceptedCompositionBase?.provenance !== compositionBase.provenance) {
        return { ok: false, reason: 'accepted_composition_base_provenance_mismatch' };
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
      if (!scopedRegen &&
        semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
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
  // A severe (bed-ridden) illness derives the illness_recovery week mode: nothing
  // is required this week and the remaining work is optional/reduced. Disclose
  // that specifically when it lands, rather than the generic recompose line.
  const severeIllnessLanding = target && !isInjurySourceFact(target) &&
    target.factKind === 'illness' && 'severity' in target && target.severity === 'severe' &&
    effectiveOperation === 'create';
  return {
    outcome: `${prefix}_${persisted.changedProgram ? 'and_recomposed' : 'no_program_change'}` as TemporarySourceFactTransactionOutcome,
    factId: targetFactId,
    changedProgram: persisted.changedProgram,
    message: severeIllnessLanding
      ? "Rest up — nothing's required this week. I've left gentle optional work if you're up to it, at a lighter dose."
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
