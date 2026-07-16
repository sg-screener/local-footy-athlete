import type { OverrideContext, UserRemovalConstraint, Workout } from '../types/domain';
import type { CalendarDayType } from './calendarStore';
import { useProfileStore } from './profileStore';
import { todayISOLocal } from '../utils/appDate';
import {
  REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
  reversibleAdjustmentWorkoutFingerprint,
  type ReversibleAdjustmentRecord,
  type ReversibleAdjustmentStatus,
} from '../rules/reversibleAdjustmentLedger';
import type { WeeklyExposureContractV2 } from '../rules/weeklyExposureContractV2';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  diffSemanticDays,
  semanticFingerprint,
  snapshotSemanticWorkout,
} from '../utils/programSemanticSnapshot';
import {
  assertAcceptedVisibleLedgerEquivalence,
  commitAcceptedStateTransaction,
  stageAcceptedStateTransaction,
  stageRollingHorizonFixtureRepair,
  type AcceptedProgramSurfaces,
  type AcceptedStateTransactionProposal,
  type AcceptedStateTransactionResult,
} from './acceptedStateTransaction';
import {
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedMaterialContext,
} from './acceptedStateColdStart';
import { runCoachMutationTransaction } from './coachMutationTransaction';
import { useProgramStore } from './programStore';
import {
  athleteActionDiagnosticsEnabled,
  beginAthleteActionTrace,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

export type ClearReversibleAdjustmentOutcome =
  | 'restored'
  | 'recomposed'
  | 'superseded'
  | 'conflicted'
  | 'already-cleared'
  | 'safely-rejected';

export interface ClearReversibleAdjustmentResult {
  outcome: ClearReversibleAdjustmentOutcome;
  adjustmentId: string;
  acceptedRevisionBefore: number;
  acceptedRevisionAfter: number;
  affectedDates: string[];
  affectedWeeks: string[];
  reason: string | null;
  supersededById: string | null;
  /** Development-only explicit token correlation for the render observer. */
  traceId?: string;
}

export interface ClearReversibleAdjustmentStage {
  proposal: AcceptedStateTransactionProposal | null;
  result: ClearReversibleAdjustmentResult;
  accepted: AcceptedStateTransactionResult;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function acceptedWorkoutForDate(args: {
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
  date: string;
}): Workout | null {
  const profile = useProfileStore.getState().onboardingData;
  const rebased = rebaseAcceptedEffectiveWeek({
    surfaces: args.surfaces,
    weekStart: mondayForDate(args.date),
    profile,
    markedDays: args.context.markedDays,
  });
  const day = new Date(`${args.date}T12:00:00`).getDay();
  const workout = rebased.visibleWorkouts.find((candidate) => candidate.dayOfWeek === day);
  return workout ? clone(workout) : null;
}

function clearResult(args: {
  outcome: ClearReversibleAdjustmentOutcome;
  adjustmentId: string;
  context: AcceptedMaterialContext;
  adjustment?: ReversibleAdjustmentRecord | null;
  reason?: string | null;
  supersededById?: string | null;
  acceptedRevisionAfter?: number;
}): ClearReversibleAdjustmentResult {
  return {
    outcome: args.outcome,
    adjustmentId: args.adjustmentId,
    acceptedRevisionBefore: args.context.revision,
    acceptedRevisionAfter: args.acceptedRevisionAfter ?? args.context.revision,
    affectedDates: [...(args.adjustment?.affectedDates ?? [])],
    affectedWeeks: [...(args.adjustment?.rollingDependencyWeeks ?? [])],
    reason: args.reason ?? null,
    supersededById: args.supersededById ?? null,
  };
}

function overlap(left: readonly string[], right: readonly string[]): boolean {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

function newerOverlappingAdjustment(
  adjustment: ReversibleAdjustmentRecord,
  all: readonly ReversibleAdjustmentRecord[],
): ReversibleAdjustmentRecord | null {
  return all
    .filter((candidate) => candidate.id !== adjustment.id && candidate.status === 'active' &&
      (candidate.acceptedRevision > adjustment.acceptedRevision ||
        candidate.createdAt > adjustment.createdAt) && (
        overlap(candidate.restorationTarget.stableIdentities,
          adjustment.restorationTarget.stableIdentities) ||
        overlap(candidate.restorationTarget.dates, adjustment.restorationTarget.dates)
      ))
    .sort((left, right) => right.acceptedRevision - left.acceptedRevision ||
      right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function updateAdjustmentStatus(args: {
  adjustment: ReversibleAdjustmentRecord;
  status: ReversibleAdjustmentStatus;
  supersededById?: string | null;
  reason: string;
}): ReversibleAdjustmentRecord {
  return {
    ...args.adjustment,
    status: args.status,
    clearedAt: args.status === 'cleared' ? new Date().toISOString() : null,
    supersededById: args.supersededById ?? null,
    supersededReason: args.reason,
  };
}

function stageStatusOnly(args: {
  adjustment: ReversibleAdjustmentRecord;
  status: 'superseded' | 'conflicted' | 'cleared';
  supersededById?: string | null;
  reason: string;
  outcome: ClearReversibleAdjustmentOutcome;
}): ClearReversibleAdjustmentStage {
  const state = useProgramStore.getState();
  const context = normalizeAcceptedMaterialContext(state.acceptedMaterialContext);
  const updated = updateAdjustmentStatus(args);
  const proposal: AcceptedStateTransactionProposal = {
    reason: `reversible_adjustment:${args.status}:${args.adjustment.id}`,
    preserveExactAcceptedWorkouts: true,
    program: {
      reversibleAdjustmentLedger: {
        protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
        adjustments: state.reversibleAdjustmentLedger.adjustments.map((candidate) =>
          candidate.id === updated.id ? updated : candidate),
      },
    },
  };
  const accepted = stageAcceptedStateTransaction(proposal);
  return {
    proposal,
    accepted,
    result: clearResult({
      outcome: args.outcome,
      adjustmentId: args.adjustment.id,
      context,
      adjustment: args.adjustment,
      reason: args.reason,
      supersededById: args.supersededById,
      acceptedRevisionAfter: accepted.context.revision,
    }),
  };
}

function currentMatchesAcceptedAfter(args: {
  adjustment: ReversibleAdjustmentRecord;
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
}): { matches: boolean; mismatchedDates: string[] } {
  const mismatchedDates = args.adjustment.displacedOriginalState.ownedDays
    .filter((owned) => {
      const current = acceptedWorkoutForDate({
        surfaces: args.surfaces,
        context: args.context,
        date: owned.date,
      });
      if (reversibleAdjustmentWorkoutFingerprint(owned.date, current) !== owned.afterFingerprint) {
        return true;
      }
      if (semanticFingerprint(args.surfaces.dateOverrides[owned.date] ?? null) !==
        semanticFingerprint(owned.afterDateOverride ?? null)) {
        return true;
      }
      if (semanticFingerprint(args.surfaces.overrideContexts[owned.date] ?? null) !==
        semanticFingerprint(owned.afterOverrideContext ?? null)) {
        return true;
      }
      return false;
    })
    .map((owned) => owned.date);
  for (const fact of args.adjustment.linkedCalendarFacts) {
    if ((args.context.markedDays[fact.date] ?? null) !== fact.after) {
      mismatchedDates.push(fact.date);
    }
  }
  return {
    matches: mismatchedDates.length === 0,
    mismatchedDates: Array.from(new Set(mismatchedDates)).sort(),
  };
}

function reductionFingerprint(args: {
  weekStart: string;
  entry: WeeklyExposureContractV2['authorisedReductions'][number];
}): string {
  return semanticFingerprint({
    weekStart: args.weekStart,
    metric: args.entry.metric,
    reason: args.entry.reason,
    originalApprovedTarget: args.entry.originalApprovedTarget,
    reducedTarget: args.entry.reducedTarget,
    detail: args.entry.detail,
    deletionIdentity: args.entry.deletionIdentity ?? null,
  });
}

function restoredPatterns(adjustment: ReversibleAdjustmentRecord): Array<'squat' | 'hinge' | 'push' | 'pull'> {
  return Array.from(new Set(adjustment.displacedOriginalState.ownedDays.flatMap((owned) => {
    const workout = owned.beforeWorkout;
    if (!workout) return [];
    const typed = workout.exercises.flatMap((row) =>
      row.section18Evidence?.role === 'main_strength' &&
      row.section18Evidence.mainStrengthPattern
        ? [row.section18Evidence.mainStrengthPattern]
        : []);
    return typed.length > 0 ? typed : workout.strengthIntent?.effectivePatterns ?? [];
  }))) as Array<'squat' | 'hinge' | 'push' | 'pull'>;
}

function reverseOwnedReductions(
  contract: WeeklyExposureContractV2,
  weekStart: string,
  adjustment: ReversibleAdjustmentRecord,
): WeeklyExposureContractV2 {
  const restored = clone(contract);
  const owned = new Map(adjustment.linkedTypedReductions
    .filter((entry) => entry.weekStart === weekStart)
    .map((entry) => [entry.fingerprint, entry]));
  const removed = restored.authorisedReductions.filter((entry) =>
    owned.has(reductionFingerprint({ weekStart, entry })));
  if (removed.length === 0) return restored;
  for (const reduction of removed) {
    if (reduction.metric === 'main_strength_frequency') {
      restored.mainStrength.exposure.requiredMinimum = Math.max(
        restored.mainStrength.exposure.requiredMinimum,
        reduction.originalApprovedTarget,
      );
      if (restored.mainStrength.exposure.plannerSelectedTarget !== null) {
        restored.mainStrength.exposure.plannerSelectedTarget = Math.max(
          restored.mainStrength.exposure.plannerSelectedTarget,
          reduction.originalApprovedTarget,
        );
      }
    } else if (reduction.metric === 'conditioning_core_frequency') {
      restored.conditioning.core.requiredMinimum = Math.max(
        restored.conditioning.core.requiredMinimum,
        reduction.originalApprovedTarget,
      );
      if (restored.conditioning.core.plannerSelectedTarget !== null) {
        restored.conditioning.core.plannerSelectedTarget = Math.max(
          restored.conditioning.core.plannerSelectedTarget,
          reduction.originalApprovedTarget,
        );
      }
    } else if (reduction.metric === 'sprint_high_speed_frequency') {
      restored.sprintHighSpeed.exposure.requiredMinimum = Math.max(
        restored.sprintHighSpeed.exposure.requiredMinimum,
        reduction.originalApprovedTarget,
      );
      if (restored.sprintHighSpeed.exposure.plannerSelectedTarget !== null) {
        restored.sprintHighSpeed.exposure.plannerSelectedTarget = Math.max(
          restored.sprintHighSpeed.exposure.plannerSelectedTarget,
          reduction.originalApprovedTarget,
        );
      }
    }
  }
  const patterns = restoredPatterns(adjustment);
  if (patterns.length > 0) {
    restored.strengthPatterns.requiredSafePatterns = Array.from(new Set([
      ...restored.strengthPatterns.requiredSafePatterns,
      ...patterns.filter((pattern) =>
        !restored.strengthPatterns.prohibitedPatterns.includes(pattern)),
    ]));
    restored.safety.requiredSafePatterns = [...restored.strengthPatterns.requiredSafePatterns];
    restored.strengthPatterns.balanceExpectation = 'equal_or_near_equal';
    restored.strengthPatterns.laterSessionRestorationRequired = false;
    if (restored.strengthPatterns.intentionalImbalanceReason?.includes(adjustment.id)) {
      restored.strengthPatterns.intentionalImbalanceReason = null;
    }
  }
  restored.authorisedReductions = restored.authorisedReductions.filter((entry) =>
    !owned.has(reductionFingerprint({ weekStart, entry })));
  restored.mainStrength.reductions = restored.authorisedReductions.filter((entry) =>
    entry.metric === 'main_strength_frequency' || entry.metric === 'strength_pattern_count' ||
    entry.metric === 'session_intensity_percent' || entry.metric === 'session_volume');
  restored.conditioning.reductions = restored.authorisedReductions.filter((entry) =>
    entry.metric === 'conditioning_core_frequency');
  restored.sprintHighSpeed.reductions = restored.authorisedReductions.filter((entry) =>
    entry.metric === 'sprint_high_speed_frequency');
  return restored;
}

function recomposeUnrelatedReductions(args: {
  restored: WeeklyExposureContractV2;
  current: WeeklyExposureContractV2;
  weekStart: string;
  adjustment: ReversibleAdjustmentRecord;
}): WeeklyExposureContractV2 {
  const contract = clone(args.restored);
  const owned = new Set(args.adjustment.linkedTypedReductions
    .filter((entry) => entry.weekStart === args.weekStart)
    .map((entry) => entry.fingerprint));
  const existing = new Set(contract.authorisedReductions.map((entry) =>
    reductionFingerprint({ weekStart: args.weekStart, entry })));
  const unrelated = args.current.authorisedReductions.filter((entry) => {
    const fingerprint = reductionFingerprint({ weekStart: args.weekStart, entry });
    return !owned.has(fingerprint) && !existing.has(fingerprint);
  });
  contract.authorisedReductions = [...contract.authorisedReductions, ...clone(unrelated)];
  for (const reduction of unrelated) {
    if (reduction.metric === 'main_strength_frequency') {
      contract.mainStrength.exposure.requiredMinimum = Math.min(
        contract.mainStrength.exposure.requiredMinimum,
        reduction.reducedTarget,
      );
      if (contract.mainStrength.exposure.plannerSelectedTarget !== null) {
        contract.mainStrength.exposure.plannerSelectedTarget = Math.min(
          contract.mainStrength.exposure.plannerSelectedTarget,
          reduction.reducedTarget,
        );
      }
    } else if (reduction.metric === 'conditioning_core_frequency') {
      contract.conditioning.core.requiredMinimum = Math.min(
        contract.conditioning.core.requiredMinimum,
        reduction.reducedTarget,
      );
      if (contract.conditioning.core.plannerSelectedTarget !== null) {
        contract.conditioning.core.plannerSelectedTarget = Math.min(
          contract.conditioning.core.plannerSelectedTarget,
          reduction.reducedTarget,
        );
      }
    } else if (reduction.metric === 'sprint_high_speed_frequency') {
      contract.sprintHighSpeed.exposure.requiredMinimum = Math.min(
        contract.sprintHighSpeed.exposure.requiredMinimum,
        reduction.reducedTarget,
      );
      if (contract.sprintHighSpeed.exposure.plannerSelectedTarget !== null) {
        contract.sprintHighSpeed.exposure.plannerSelectedTarget = Math.min(
          contract.sprintHighSpeed.exposure.plannerSelectedTarget,
          reduction.reducedTarget,
        );
      }
    }
  }
  contract.mainStrength.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'main_strength_frequency' || entry.metric === 'strength_pattern_count' ||
    entry.metric === 'session_intensity_percent' || entry.metric === 'session_volume');
  contract.conditioning.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'conditioning_core_frequency');
  contract.sprintHighSpeed.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'sprint_high_speed_frequency');
  return contract;
}

function restoreOwnedSurfaces(args: {
  adjustment: ReversibleAdjustmentRecord;
  surfaces: AcceptedProgramSurfaces;
  context: AcceptedMaterialContext;
}): {
  surfaces: AcceptedProgramSurfaces;
  markedDays: Record<string, CalendarDayType>;
} {
  const surfaces = clone(args.surfaces);
  const markedDays = { ...args.context.markedDays };
  const newerActiveWeeks = new Set(surfaces.reversibleAdjustmentLedger.adjustments
    .filter((candidate) => candidate.id !== args.adjustment.id && candidate.status === 'active' &&
      (candidate.acceptedRevision > args.adjustment.acceptedRevision ||
        candidate.createdAt > args.adjustment.createdAt))
    .flatMap((candidate) => candidate.affectedWeeks));
  for (const fact of args.adjustment.linkedCalendarFacts) {
    if (fact.before === null) delete markedDays[fact.date];
    else markedDays[fact.date] = fact.before;
  }
  for (const owned of args.adjustment.displacedOriginalState.ownedDays) {
    if (owned.beforeDateOverride) {
      surfaces.dateOverrides[owned.date] = clone(owned.beforeDateOverride);
      if (owned.beforeOverrideContext) {
        surfaces.overrideContexts[owned.date] = clone(owned.beforeOverrideContext);
      } else {
        delete surfaces.overrideContexts[owned.date];
      }
    } else {
      delete surfaces.dateOverrides[owned.date];
      delete surfaces.overrideContexts[owned.date];
    }
    const overlay = surfaces.weekScopedOverlays[owned.weekStart];
    if (overlay) {
      const workoutsByDate = { ...overlay.workoutsByDate };
      if (owned.beforeSurfaceOwner === 'week_overlay') {
        workoutsByDate[owned.date] = owned.beforeSurfaceWorkout
          ? clone(owned.beforeSurfaceWorkout)
          : null;
      } else if (owned.beforeSurfaceOwner) {
        delete workoutsByDate[owned.date];
      } else {
        workoutsByDate[owned.date] = owned.beforeWorkout ? clone(owned.beforeWorkout) : null;
      }
      surfaces.weekScopedOverlays[owned.weekStart] = {
        ...overlay,
        workoutsByDate,
        exposureContractV2: overlay.exposureContractV2
          ? reverseOwnedReductions(
              overlay.exposureContractV2,
              owned.weekStart,
              args.adjustment,
            )
          : overlay.exposureContractV2,
      };
    } else if (owned.beforeWorkout) {
      // Legacy exact user removals can predate week overlays. A concrete
      // override is the smallest exact restoration surface in that case.
      surfaces.dateOverrides[owned.date] = clone(owned.beforeWorkout);
      surfaces.overrideContexts[owned.date] = {
        intent: 'program_adjustment',
      } as OverrideContext;
    }
  }
  for (const owned of args.adjustment.displacedOriginalState.ownedWeeks ?? []) {
    const overlay = surfaces.weekScopedOverlays[owned.weekStart];
    if (!overlay || newerActiveWeeks.has(owned.weekStart)) continue;
    const beforeContract = owned.beforeExposureContract
      ? recomposeUnrelatedReductions({
          restored: owned.beforeExposureContract,
          current: overlay.exposureContractV2,
          weekStart: owned.weekStart,
          adjustment: args.adjustment,
        })
      : null;
    surfaces.weekScopedOverlays[owned.weekStart] = {
      ...overlay,
      exposureContractV2: beforeContract
        ? beforeContract
        : overlay.exposureContractV2,
    };
  }
  surfaces.userRemovalConstraints = surfaces.userRemovalConstraints.map((constraint) =>
    args.adjustment.linkedUserRemovalConstraintIds.includes(constraint.id)
      ? {
          ...constraint,
          status: 'restored',
          restoredAt: new Date().toISOString(),
          restorationReason: 'explicit_restore',
        } as UserRemovalConstraint
      : constraint);
  return { surfaces, markedDays };
}

function verifyRestoredOwnedDays(args: {
  adjustment: ReversibleAdjustmentRecord;
  accepted: AcceptedStateTransactionResult;
}): void {
  for (const owned of args.adjustment.displacedOriginalState.ownedDays) {
    const current = acceptedWorkoutForDate({
      surfaces: args.accepted.program,
      context: args.accepted.context,
      date: owned.date,
    });
    const fingerprint = reversibleAdjustmentWorkoutFingerprint(owned.date, current);
    if (fingerprint !== owned.beforeFingerprint) {
      throw new Error(`restored_semantic_fingerprint_mismatch:${owned.date}:${JSON.stringify({
        expected: owned.beforeWorkout
          ? { id: owned.beforeWorkout.id, name: owned.beforeWorkout.name, type: owned.beforeWorkout.workoutType }
          : null,
        current: current ? { id: current.id, name: current.name, type: current.workoutType } : null,
        changes: diffSemanticDays(
          snapshotSemanticWorkout(owned.date, owned.beforeWorkout),
          snapshotSemanticWorkout(owned.date, current),
        ).changes,
      })}`);
    }
  }
}

/** Pure restoration staging. Any rejection returns a typed no-publication result. */
export function stageClearReversibleAdjustment(
  adjustmentId: string,
  expectedRevision: number,
): ClearReversibleAdjustmentStage {
  const state = useProgramStore.getState();
  const surfaces = normalizeAcceptedProgramSurfaces(state);
  const context = normalizeAcceptedMaterialContext(state.acceptedMaterialContext);
  const adjustment = surfaces.reversibleAdjustmentLedger.adjustments.find((candidate) =>
    candidate.id === adjustmentId) ?? null;
  const currentAccepted = { program: surfaces, context };
  if (!adjustment) {
    return {
      proposal: null,
      accepted: currentAccepted,
      result: clearResult({
        outcome: 'safely-rejected', adjustmentId, context,
        reason: 'No accepted reversible adjustment matched that exact ID.',
      }),
    };
  }
  if (adjustment.status === 'cleared') {
    return {
      proposal: null,
      accepted: currentAccepted,
      result: clearResult({
        outcome: 'already-cleared', adjustmentId, context, adjustment,
        reason: 'The adjustment was already cleared.',
      }),
    };
  }
  if (adjustment.status === 'superseded' || adjustment.status === 'conflicted') {
    return {
      proposal: null,
      accepted: currentAccepted,
      result: clearResult({
        outcome: adjustment.status, adjustmentId, context, adjustment,
        reason: adjustment.supersededReason,
        supersededById: adjustment.supersededById,
      }),
    };
  }
  if (!adjustment.validity.reversible) {
    return {
      proposal: null,
      accepted: currentAccepted,
      result: clearResult({
        outcome: 'safely-rejected', adjustmentId, context, adjustment,
        reason: 'This legacy presentation record has no reversible before-state.',
      }),
    };
  }
  if (expectedRevision > context.revision) {
    return {
      proposal: null,
      accepted: currentAccepted,
      result: clearResult({
        outcome: 'safely-rejected', adjustmentId, context, adjustment,
        reason: 'The expected accepted revision is newer than the current program.',
      }),
    };
  }
  const newer = newerOverlappingAdjustment(
    adjustment,
    surfaces.reversibleAdjustmentLedger.adjustments,
  );
  const currentAfter = currentMatchesAcceptedAfter({ adjustment, surfaces, context });
  if (!currentAfter.matches) {
    if (newer) {
      return stageStatusOnly({
        adjustment,
        status: 'superseded',
        supersededById: newer.id,
        reason: `Newer athlete intent ${newer.id} owns the same restoration target.`,
        outcome: 'superseded',
      });
    }
    return stageStatusOnly({
      adjustment,
      status: 'conflicted',
      reason: `Accepted-after semantic state changed on ${currentAfter.mismatchedDates.join(', ')}.`,
      outcome: 'conflicted',
    });
  }
  if (newer) {
    return stageStatusOnly({
      adjustment,
      status: 'superseded',
      supersededById: newer.id,
      reason: `Newer athlete intent ${newer.id} owns the same restoration target.`,
      outcome: 'superseded',
    });
  }

  try {
    const restored = restoreOwnedSurfaces({ adjustment, surfaces, context });
    const profile = useProfileStore.getState().onboardingData;
    if (!surfaces.currentProgram || !profile) {
      throw new Error('Restoration requires an accepted program and profile.');
    }
    const overlays = { ...restored.surfaces.weekScopedOverlays };
    let validatedWeekStarts = adjustment.rollingDependencyWeeks;
    if (adjustment.kind.includes('fixture')) {
      const repair = stageRollingHorizonFixtureRepair({
        program: surfaces.currentProgram,
        profile,
        beforeMarkedDays: context.markedDays,
        afterMarkedDays: restored.markedDays,
        sourceSurfaces: restored.surfaces,
        activeConstraints: context.activeConstraints,
        primaryWeekStarts: adjustment.rollingDependencyWeeks,
        primaryMutationIntent: 'restore_adjustment',
        dependentMutationIntent: 'restore_adjustment',
        userRemovalConstraints: restored.surfaces.userRemovalConstraints,
      });
      const exactOwnedWeeks = new Set([
        ...adjustment.displacedOriginalState.ownedDays.map((owned) => owned.weekStart),
        ...(adjustment.displacedOriginalState.ownedWeeks ?? []).map((owned) => owned.weekStart),
      ]);
      for (const projection of repair.projections) {
        // The ledger owns exact raw rows and the accepted contract for weeks
        // it changed. The rolling repair still closes and validates the full
        // horizon, but only unowned dependency weeks take its projection;
        // replaying a primary accepted row would apply progression twice.
        if (!exactOwnedWeeks.has(projection.weekStart)) {
          overlays[projection.weekStart] = projection.overlay;
        }
      }
      validatedWeekStarts = repair.weekStarts.length > 0
        ? repair.weekStarts
        : adjustment.rollingDependencyWeeks;
    }
    const cleared = updateAdjustmentStatus({
      adjustment,
      status: 'cleared',
      reason: 'Explicit typed restoration completed.',
    });
    const activeConstraints = context.activeConstraints.filter((constraint) =>
      !adjustment.linkedConstraintIds.includes(constraint.id));
    const proposal: AcceptedStateTransactionProposal = {
      reason: `reversible_adjustment:clear:${adjustment.id}`,
      program: {
        dateOverrides: restored.surfaces.dateOverrides,
        overrideContexts: restored.surfaces.overrideContexts,
        weekScopedOverlays: overlays,
        userRemovalConstraints: restored.surfaces.userRemovalConstraints,
        todayWorkout: adjustment.affectedDates.includes(todayISOLocal())
          ? adjustment.displacedOriginalState.ownedDays.find((owned) =>
              owned.date === todayISOLocal())?.beforeWorkout ?? null
          : restored.surfaces.todayWorkout,
        reversibleAdjustmentLedger: {
          protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
          adjustments: surfaces.reversibleAdjustmentLedger.adjustments.map((candidate) =>
            candidate.id === cleared.id ? cleared : candidate),
        },
      },
      markedDays: restored.markedDays,
      activeConstraints,
      validateWeekStarts: validatedWeekStarts,
      profile,
      programAlreadyAccepted: true,
      preserveExactAcceptedWorkouts: true,
    };
    const accepted = stageAcceptedStateTransaction(proposal);
    assertAcceptedVisibleLedgerEquivalence({
      surfaces: accepted.program,
      context: accepted.context,
      weekStarts: adjustment.rollingDependencyWeeks,
      profile,
    });
    verifyRestoredOwnedDays({ adjustment, accepted });
    const outcome: ClearReversibleAdjustmentOutcome = expectedRevision === context.revision
      ? 'restored'
      : 'recomposed';
    return {
      proposal,
      accepted,
      result: clearResult({
        outcome,
        adjustmentId,
        context,
        adjustment,
        acceptedRevisionAfter: accepted.context.revision,
      }),
    };
  } catch (error) {
    return {
      proposal: null,
      accepted: currentAccepted,
      result: clearResult({
        outcome: 'safely-rejected', adjustmentId, context, adjustment,
        reason: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/** Shared deterministic executor used by both Coach and tap restoration. */
export function commitClearReversibleAdjustment(
  adjustmentId: string,
  expectedRevision: number,
): ClearReversibleAdjustmentResult {
  const staged = stageClearReversibleAdjustment(adjustmentId, expectedRevision);
  if (!staged.proposal) return staged.result;
  try {
    const accepted = commitAcceptedStateTransaction(staged.proposal);
    return {
      ...staged.result,
      acceptedRevisionAfter: accepted.context.revision,
    };
  } catch (error) {
    return {
      ...staged.result,
      outcome: 'safely-rejected',
      acceptedRevisionAfter: staged.result.acceptedRevisionBefore,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Durable public boundary: persist, read back, verify the complete semantic
 * projection, and roll back both memory and storage before returning failure.
 */
export async function clearReversibleAdjustment(
  adjustmentId: string,
  expectedRevision: number,
  inheritedTrace?: AthleteActionTraceContext,
): Promise<ClearReversibleAdjustmentResult> {
  if (!athleteActionDiagnosticsEnabled()) {
    return clearReversibleAdjustmentWithinTrace(adjustmentId, expectedRevision);
  }
  const trace = beginAthleteActionTrace({
    source: inheritedTrace?.source ?? 'tap',
    actionType: 'clear_adjustment',
    route: 'canonical_reversible_adjustment_restore',
    scope: 'owned_reversible_adjustment',
    adjustmentId,
    controlId: inheritedTrace?.controlId ?? 'coach-note-confirm-clear',
  }, inheritedTrace);
  return runWithAthleteActionTrace(trace, async () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: 'restore_reversible_adjustment',
      adjustmentId,
      expectedAcceptedRevision: expectedRevision,
    });
    const result = await clearReversibleAdjustmentWithinTrace(adjustmentId, expectedRevision);
    emitAthleteActionEvent(trace,
      result.outcome === 'restored' || result.outcome === 'recomposed' ||
        result.outcome === 'already-cleared'
        ? 'athlete_action_completed'
        : 'athlete_action_failed', {
        outcome: result.outcome,
        internalResultCode: `reversible_adjustment_${result.outcome}`,
        adjustmentId,
        acceptedRevisionBefore: result.acceptedRevisionBefore,
        acceptedRevisionAfter: result.acceptedRevisionAfter,
      });
    return { ...result, traceId: trace.traceId };
  });
}

async function clearReversibleAdjustmentWithinTrace(
  adjustmentId: string,
  expectedRevision: number,
): Promise<ClearReversibleAdjustmentResult> {
  const existing = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .find((candidate) => candidate.id === adjustmentId);
  const context = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  if (!existing || existing.status !== 'active') {
    return stageClearReversibleAdjustment(adjustmentId, expectedRevision).result;
  }
  const transaction = await runCoachMutationTransaction({
    todayISO: todayISOLocal(),
    extraDates: existing.affectedDates,
    allowAcceptedStateOnlyChange: true,
    mutate: () => commitClearReversibleAdjustment(adjustmentId, expectedRevision),
    didApply: (result) => result.outcome !== 'safely-rejected' &&
      result.outcome !== 'already-cleared',
  });
  if (transaction.ok) return transaction.value;
  return clearResult({
    outcome: 'safely-rejected',
    adjustmentId,
    context,
    adjustment: existing,
    reason: 'reason' in transaction ? transaction.reason : 'Durable restoration failed.',
  });
}
