/**
 * repeatWeek.ts — deterministic "repeat a week" mechanism (Bible §13
 * "When to repeat a week").
 *
 * Bible intent: if the athlete missed too much, was sick/cooked, found the
 * week too hard, or simply needs more time before progressing, the app should
 * be able to REPEAT the current training week instead of forcing progression —
 * "Do not progress just because a week passed."
 *
 * ARCHITECTURE — reuse, don't reinvent
 * ------------------------------------
 * A repeat is expressed with the EXISTING week-scoped overlay mechanism
 * (`WeekScopedWorkoutOverlay`), the same one used for one-off game weeks. The
 * overlay is SPARSE: it only overrides the source week's training days onto the
 * target week's dates. Days it omits fall through to the target week's own base
 * program — which is exactly how the target week's real game / team-training
 * anchors keep winning, and how a stale source-week game is never copied.
 *
 *   • Held progression  — copied source workouts carry the source week's
 *                         prescriptions and (deload) intensity, so load holds
 *                         instead of advancing.
 *   • Target anchors win — game/team DOWs are omitted → base target week shows.
 *   • No stale game copy — source `Game` workouts are skipped.
 *   • Owner / id         — `reason: 'repeat_week'` overlay keyed by target week
 *                         start; restored only through its reversible ledger ID.
 *   • Sweep policy       — pure staging runs the shared `decideOverrideSweep`
 *                         and captures exact displaced rows in the ledger.
 *   • Block rollover     — untouched: no block-number advance, no block-anchor
 *                         shift. A repeat is an overlay, not a progression.
 *
 * No LLM, no coach chat, no new generation path.
 */

import type {
  DayOfWeek,
  OnboardingData,
  OverrideContext,
  TrainingProgram,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import {
  resolveProfileTargetWeekAvailability,
} from '../rules/fixtureConditionedAvailability';
import type { WeeklyExposureContract } from '../rules/weeklyExposureContract';
import {
  section18PhaseTableSignature,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { buildCoachingPlan, onboardingToCoachingInputs } from './coachingEngine';
import { addDays, computeGameDatesForBlock, getMondayForDate } from './sessionResolver';
import { getProgramBlockStateForDate, selectMicrocycleForDate } from './programBlockState';
import { resolveEquipmentCapabilities } from './equipmentAvailability';
import { resolveConditioningSubstitutionPolicy } from '../rules/conditioningFeasibility';
import {
  decideOverrideSweep,
  liveConstraintIds,
  type OverrideSweepDecision,
} from './weekRebuild';
import {
  beginProgramPersistenceStage,
  endProgramPersistenceStage,
  persistProgramStoreEnvelopeDurably,
  readDurableProgramStoreEnvelope,
  restoreProgramStoreEnvelopeDurably,
  serializeProgramStoreEnvelope,
  useProgramStore,
  type ProgramState,
} from '../store/programStore';
import {
  assertAcceptedVisibleLedgerEquivalence,
  stageAcceptedStateTransaction,
  type AcceptedStateTransactionResult,
} from '../store/acceptedStateTransaction';
import {
  captureAcceptedAthleteSemanticSnapshotV2,
  captureAcceptedProgramState,
  withAcceptedMutationLock,
} from '../store/coachMutationTransaction';
import { todayISOLocal } from './appDate';
import { logger } from './logger';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { effectiveFixtureDatesForWeeks } from '../rules/rollingHorizonRepair';
import {
  REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
  reversibleAdjustmentId,
  reversibleAdjustmentWorkoutFingerprint,
  type ReversibleAdjustmentProvenanceDelta,
  type ReversibleAdjustmentRecord,
  type ReversibleAdjustmentSweptOverrideDelta,
  type ReversibleAdjustmentTypedReductionDelta,
} from '../rules/reversibleAdjustmentLedger';
import { semanticFingerprint } from './programSemanticSnapshot';
import { semanticFingerprintV2 } from './semanticFingerprintV2';
import { capturedTraceField } from '../dev/e2e/AthleteActionTraceCoordinator';
import {
  athleteActionDiagnosticsEnabled,
  athleteActionDiagnosticHash,
  athleteActionTraceCoordinator,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
} from './athleteActionDiagnostics';

const DAY_NAME_TO_NUM: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};
const DAY_NUMBER_TO_NAME: DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/** Deterministic owner id for a repeat-week overlay (clearable / sweepable). */
export function repeatWeekOverlayId(targetWeekStart: string): string {
  return `week-overlay:${targetWeekStart}:repeat_week`;
}

export function isRepeatWeekOverlay(overlay: WeekScopedWorkoutOverlay | null | undefined): boolean {
  return overlay?.reason === 'repeat_week';
}

/** ISO date within `weekStart`'s week for a given day-of-week number (0-6). */
function dateForDowInWeek(weekStart: string, dow: number): string {
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  return addDays(weekStart, mondayOffset);
}

function isGameWorkout(workout: Workout): boolean {
  return workout.workoutType === 'Game';
}

function cloneWorkoutForRepeat(workout: Workout, date: string, overlayId: string): Workout {
  const id = `${workout.id}:repeat-week:${date}`;
  const dow = new Date(`${date}T12:00:00`).getDay();
  return {
    ...workout,
    id,
    microcycleId: overlayId,
    dayOfWeek: dow,
    exercises: (workout.exercises ?? []).map((exercise) => ({
      ...exercise,
      workoutId: id,
    })),
  };
}

export interface BuildRepeatWeekOverlayArgs {
  /** The source week's resolved/generated workouts (held-progression content). */
  sourceWorkouts: Workout[];
  /** Monday ISO of the target week the repeat lands on. */
  targetWeekStart: string;
  /**
   * DOWs (0-6) that are TARGET-week anchors — the recurring game day and team
   * training days. These are OMITTED from the overlay so the base target week's
   * real anchors win.
   */
  targetAnchorDows?: number[];
  /**
   * Explicit target-week workouts that must WIN over any copied source content
   * (e.g. a one-off game that exists only in the target week). Keyed by ISO
   * date within the target week.
   */
  targetWinningWorkoutsByDate?: Record<string, Workout>;
  /** Contract resolved for the target week; never copied from the source. */
  targetExposureContract?: WeeklyExposureContract;
  /** Parallel Section 18 target-week contract. */
  targetExposureContractV2?: WeeklyExposureContractV2;
}

/**
 * Build a sparse `repeat_week` overlay for the target week from the source
 * week's workouts. Pure — no store access.
 */
export function buildRepeatWeekOverlay(args: BuildRepeatWeekOverlayArgs): WeekScopedWorkoutOverlay {
  const overlayId = repeatWeekOverlayId(args.targetWeekStart);
  const anchorDows = new Set(args.targetAnchorDows ?? []);
  const now = new Date().toISOString();
  const workoutsByDate: Record<string, Workout | null> = {};

  for (const workout of args.sourceWorkouts ?? []) {
    const dow = workout.dayOfWeek;
    // Never copy a stale game/practice-match from the source week.
    if (isGameWorkout(workout)) continue;
    // Target-week anchors (game/team) win — leave those days to the base week.
    if (anchorDows.has(dow)) continue;
    const date = dateForDowInWeek(args.targetWeekStart, dow);
    workoutsByDate[date] = cloneWorkoutForRepeat(workout, date, overlayId);
  }

  // Any explicit target-week winning workout (one-off game) overrides the copy.
  for (const [date, workout] of Object.entries(args.targetWinningWorkoutsByDate ?? {})) {
    workoutsByDate[date] = workout;
  }

  return {
    id: overlayId,
    weekStart: args.targetWeekStart,
    weekEnd: addDays(args.targetWeekStart, 6),
    anchorDate: null,
    reason: 'repeat_week',
    exposureContract: args.targetExposureContract,
    exposureContractV2: args.targetExposureContractV2,
    workoutsByDate,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Feedback recommender (Bible §13 "When to repeat a week") ──────────

export interface RepeatWeekFeedbackSummary {
  /** Sessions the week planned. */
  plannedSessions: number;
  /** Sessions actually completed. */
  completedSessions: number;
  /** Athlete reported the week / its sessions as too hard. */
  reportedTooHard?: boolean;
  /** Week disrupted by illness. */
  wasSick?: boolean;
  /** Athlete was very cooked / fatigued. */
  wasCooked?: boolean;
  /** Explicit "repeat this week" request. */
  userRequestedRepeat?: boolean;
}

/**
 * Should the app recommend repeating the week? Deterministic, advisory only —
 * this never forces a repeat, it only signals that one is appropriate per the
 * Bible triggers (missed key sessions, illness, struggled with the dose, needs
 * more time before progressing).
 */
export function shouldRecommendRepeatWeek(summary: RepeatWeekFeedbackSummary): boolean {
  if (summary.userRequestedRepeat) return true;
  if (summary.wasSick || summary.wasCooked || summary.reportedTooHard) return true;
  const planned = Math.max(0, summary.plannedSessions);
  if (planned > 0) {
    const completedRatio = Math.max(0, summary.completedSessions) / planned;
    if (completedRatio < 0.5) return true; // missed too much of the week
  }
  return false;
}

// ─── Store-wired action ───────────────────────────────────────────────

function anchorDowsForProfile(profile: OnboardingData): number[] {
  const dows = new Set<number>();
  const gameDay = (profile.usualGameDay || profile.gameDay) as DayOfWeek | undefined;
  if (gameDay && gameDay in DAY_NAME_TO_NUM) dows.add(DAY_NAME_TO_NUM[gameDay]);
  for (const day of profile.teamTrainingDays ?? []) {
    if (day in DAY_NAME_TO_NUM) dows.add(DAY_NAME_TO_NUM[day as DayOfWeek]);
  }
  return Array.from(dows);
}

function resolveRepeatTargetExposureContracts(args: {
  profile: OnboardingData;
  program: TrainingProgram;
  targetWeekStart: string;
  acceptedMaterialContext: ProgramState['acceptedMaterialContext'];
}): { legacy: WeeklyExposureContract; v2: WeeklyExposureContractV2; workouts: Workout[] } {
  const blockState = getProgramBlockStateForDate({
    dateISO: args.targetWeekStart,
    programStartISO: args.program.startDate,
    blockNumber: args.program.microcycles?.[0]?.miniCycleNumber ?? 1,
    seasonPhase: args.profile.seasonPhase,
    seasonPhaseClock: args.program.seasonPhaseClock,
  });
  const equipment = resolveEquipmentCapabilities(args.profile, [], args.targetWeekStart);
  const substitutionPolicy = resolveConditioningSubstitutionPolicy({
    phase: args.profile.seasonPhase,
    offseasonSubphase: blockState.phaseResolution.offseasonSubphase,
    preseasonSubphase: blockState.phaseResolution.preseasonSubphase,
    equipment,
    profile: args.profile,
  });
  const targetWeekAvailability = resolveProfileTargetWeekAvailability({
    profile: args.profile,
    weekStart: args.targetWeekStart,
    markedDays: args.acceptedMaterialContext.markedDays,
    activeConstraints: args.acceptedMaterialContext.activeConstraints,
  });
  const targetFixture = targetWeekAvailability.proposedFixtures[0];
  const inputs = onboardingToCoachingInputs(args.profile, {
    availabilityDateISO: args.targetWeekStart,
    miniCycleNumber: blockState.miniCycleNumber,
    weekInBlock: blockState.weekInBlock,
    weekNumber: blockState.weekNumber,
    weekKind: blockState.weekKind,
    phaseWeekNumber: blockState.phaseWeekNumber,
    phaseClock: blockState.phaseClock,
    phaseClockProvenance: blockState.phaseResolution.provenance,
    offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
    preseasonSubphase: blockState.phaseResolution.preseasonSubphase ?? undefined,
    appConditioningFeasible: substitutionPolicy.appConditioningFeasible ?? undefined,
    conditioningSubstitutionPolicy: substitutionPolicy,
    targetWeekAvailability,
    targetFixtureDay: targetFixture
      ? DAY_NUMBER_TO_NAME[new Date(`${targetFixture.date}T12:00:00`).getDay()]
      : null,
  });
  const plan = buildCoachingPlan(inputs);
  const workouts = buildWorkoutsFromCoach(
    [],
    `repeat-target:${args.targetWeekStart}`,
    plan.weeklyPlan,
    args.profile,
    {
      miniCycleNumber: blockState.miniCycleNumber,
      weekInBlock: blockState.weekInBlock,
      weekStartISO: blockState.weekStart,
      weekKind: blockState.weekKind,
      intensityMultiplier: blockState.intensityMultiplier,
      offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
    },
  );
  return {
    legacy: plan.weeklyExposureContract!,
    v2: plan.weeklyExposureContractV2!,
    workouts,
  };
}

type RepeatWeekSnapshot = ProgramState;

export interface RepeatWeekResult {
  overlay: WeekScopedWorkoutOverlay;
  sweep: OverrideSweepDecision;
  sourceWeekStart: string;
  targetWeekStart: string;
  adjustmentId: string;
  acceptedRevision: number;
  traceId?: string;
  observationId?: string;
}

export interface RepeatWeekStage {
  accepted: AcceptedStateTransactionResult;
  /** Complete immutable publication candidate; also the exact durable envelope. */
  programState: ProgramState;
  result: RepeatWeekResult;
}

function clone<T>(value: T): T {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value)) as T;
}

function workoutForRawTargetDate(args: {
  snapshot: RepeatWeekSnapshot;
  overlay: WeekScopedWorkoutOverlay | null;
  targetMicrocycle: ReturnType<typeof selectMicrocycleForDate>;
  date: string;
}): { owner: 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty'; workout: Workout | null } {
  const override = args.snapshot.dateOverrides[args.date];
  if (override) return { owner: 'date_override', workout: override };
  if (args.overlay && Object.prototype.hasOwnProperty.call(args.overlay.workoutsByDate, args.date)) {
    return { owner: 'week_overlay', workout: args.overlay.workoutsByDate[args.date] ?? null };
  }
  const dow = new Date(`${args.date}T12:00:00`).getDay();
  const base = args.targetMicrocycle?.workouts.find((workout) => workout.dayOfWeek === dow) ?? null;
  return base
    ? { owner: 'base_microcycle', workout: base }
    : { owner: 'empty', workout: null };
}

function provenanceRows(
  overlay: WeekScopedWorkoutOverlay | null,
): ReversibleAdjustmentProvenanceDelta[] {
  return Object.entries(overlay?.workoutsByDate ?? {}).flatMap(([date, workout]) =>
    (workout?.derivedSessionProvenance ?? []).map((record) => ({
      date,
      record: clone(record),
      fingerprint: semanticFingerprint({ date, record }),
    }))).sort((left, right) => left.date.localeCompare(right.date) ||
      left.fingerprint.localeCompare(right.fingerprint));
}

function reductionRows(
  weekStart: string,
  overlay: WeekScopedWorkoutOverlay | null,
): ReversibleAdjustmentTypedReductionDelta[] {
  return (overlay?.exposureContractV2?.authorisedReductions ?? []).map((reduction) => ({
    weekStart,
    reduction: clone(reduction),
    fingerprint: semanticFingerprint({
      weekStart,
      metric: reduction.metric,
      reason: reduction.reason,
      originalApprovedTarget: reduction.originalApprovedTarget,
      reducedTarget: reduction.reducedTarget,
      detail: reduction.detail,
      deletionIdentity: reduction.deletionIdentity ?? null,
    }),
  })).sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
}

function deltaRows<T extends { fingerprint: string }>(
  before: T[],
  after: T[],
): { added: T[]; removed: T[] } {
  const beforeIds = new Set(before.map((entry) => entry.fingerprint));
  const afterIds = new Set(after.map((entry) => entry.fingerprint));
  return {
    added: after.filter((entry) => !beforeIds.has(entry.fingerprint)),
    removed: before.filter((entry) => !afterIds.has(entry.fingerprint)),
  };
}

function buildRepeatAdjustment(args: {
  snapshot: RepeatWeekSnapshot;
  sourceWeekStart: string;
  targetWeekStart: string;
  targetMicrocycle: ReturnType<typeof selectMicrocycleForDate>;
  beforeOverlay: WeekScopedWorkoutOverlay | null;
  afterOverlay: WeekScopedWorkoutOverlay;
  sweep: OverrideSweepDecision;
  acceptedRevision: number;
}): ReversibleAdjustmentRecord {
  const createdAt = args.afterOverlay.createdAt;
  const id = reversibleAdjustmentId({
    kind: 'repeat_week',
    sourceActionOrIntentId: `${args.sourceWeekStart}:${args.targetWeekStart}`,
    createdAt,
  });
  const targetDates = Array.from({ length: 7 }, (_, offset) =>
    addDays(args.targetWeekStart, offset));
  const sweptDates = new Set(args.sweep.clear);
  const ownedDays = targetDates.map((date) => {
    const before = workoutForRawTargetDate({
      snapshot: args.snapshot,
      overlay: args.beforeOverlay,
      targetMicrocycle: args.targetMicrocycle,
      date,
    });
    const afterDateOverride = sweptDates.has(date)
      ? null
      : args.snapshot.dateOverrides[date] ?? null;
    const afterOverrideContext = sweptDates.has(date)
      ? null
      : args.snapshot.overrideContexts[date] ?? null;
    const dow = new Date(`${date}T12:00:00`).getDay();
    const targetBaseWorkout = args.targetMicrocycle?.workouts.find((workout) =>
      workout.dayOfWeek === dow) ?? null;
    const hasAfterOverlayRow = Object.prototype.hasOwnProperty.call(
      args.afterOverlay.workoutsByDate,
      date,
    );
    const afterWorkout = afterDateOverride ?? (
      hasAfterOverlayRow
        ? args.afterOverlay.workoutsByDate[date] ?? null
        : targetBaseWorkout
    );
    const afterOwner = afterDateOverride
      ? 'date_override' as const
      : hasAfterOverlayRow
        ? 'week_overlay' as const
        : targetBaseWorkout
          ? 'base_microcycle' as const
          : 'empty' as const;
    return {
      date,
      weekStart: args.targetWeekStart,
      beforeWorkout: clone(before.workout),
      afterWorkout: clone(afterWorkout),
      beforeSurfaceOwner: before.owner,
      afterSurfaceOwner: afterOwner,
      beforeSurfaceWorkout: clone(before.workout),
      afterSurfaceWorkout: clone(afterWorkout),
      beforeDateOverride: clone(args.snapshot.dateOverrides[date] ?? null),
      afterDateOverride: clone(afterDateOverride),
      beforeOverrideContext: clone(args.snapshot.overrideContexts[date] ?? null),
      afterOverrideContext: clone(afterOverrideContext),
      beforeFingerprint: reversibleAdjustmentWorkoutFingerprint(date, before.workout),
      afterFingerprint: reversibleAdjustmentWorkoutFingerprint(date, afterWorkout),
    };
  });
  const sweptOverrides: ReversibleAdjustmentSweptOverrideDelta[] = args.sweep.clear.map((date) => {
    const beforeWorkout = args.snapshot.dateOverrides[date] ?? null;
    const beforeContext = args.snapshot.overrideContexts[date] ?? null;
    return {
      date,
      beforeWorkout: clone(beforeWorkout),
      afterWorkout: null,
      beforeContext: clone(beforeContext),
      afterContext: null,
      beforeFingerprint: semanticFingerprint({ workout: beforeWorkout, context: beforeContext }),
      afterFingerprint: semanticFingerprint({ workout: null, context: null }),
    };
  });
  const provenanceDeltas = deltaRows(
    provenanceRows(args.beforeOverlay),
    provenanceRows(args.afterOverlay),
  );
  const typedReductionDeltas = deltaRows(
    reductionRows(args.targetWeekStart, args.beforeOverlay),
    reductionRows(args.targetWeekStart, args.afterOverlay),
  );
  const affectedDates = Array.from(new Set([...targetDates, ...args.sweep.clear])).sort();
  const affectedWeeks = Array.from(new Set(affectedDates.map(getMondayForDate))).sort();
  return {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    id,
    kind: 'repeat_week',
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
    sourceActionOrIntentId: `${args.sourceWeekStart}:${args.targetWeekStart}`,
    sourceProducer: 'tap',
    createdAt,
    acceptedRevision: args.acceptedRevision,
    status: 'active',
    clearedAt: null,
    supersededById: null,
    supersededReason: null,
    affectedDates,
    affectedWeeks,
    rollingDependencyWeeks: affectedWeeks,
    displacedOriginalState: {
      ownedDays,
      ownedWeeks: [],
      calendarFacts: [],
      userRemovalConstraint: null,
      weekOverlay: {
        weekStart: args.targetWeekStart,
        before: clone(args.beforeOverlay),
        after: clone(args.afterOverlay),
        beforeFingerprint: semanticFingerprint(args.beforeOverlay),
        afterFingerprint: semanticFingerprint(args.afterOverlay),
      },
      sweptOverrides,
      provenanceDeltas,
      typedReductionDeltas,
    },
    acceptedAfterSemanticFingerprints: ownedDays.map((entry) => ({
      date: entry.date,
      fingerprint: entry.afterFingerprint,
    })),
    restorationTarget: {
      kind: 'week_overlay',
      dates: affectedDates,
      stableIdentities: [args.afterOverlay.id],
    },
    linkedConstraintIds: [],
    linkedCalendarFacts: [],
    linkedOverrideOwners: sweptOverrides.map((entry) => ({
      date: entry.date,
      ownerId: entry.beforeContext?.activeModifierId ?? null,
    })),
    linkedOverlayIds: [args.afterOverlay.id],
    linkedUserRemovalConstraintIds: [],
    linkedProvenanceIds: provenanceDeltas.added.map((entry) => entry.fingerprint),
    linkedTypedReductions: typedReductionDeltas.added.map((entry) => ({
      weekStart: entry.weekStart,
      metric: entry.reduction.metric,
      reason: entry.reduction.reason,
      originalApprovedTarget: entry.reduction.originalApprovedTarget,
      reducedTarget: entry.reduction.reducedTarget,
      detail: entry.reduction.detail,
      deletionIdentity: entry.reduction.deletionIdentity ?? null,
      fingerprint: entry.fingerprint,
    })),
    validity: {
      reversible: true,
      source: 'runtime_exact_delta',
      validWhile: [
        'target_overlay_matches_repeat_accepted_after',
        'swept_override_rows_remain_repeat_owned',
      ],
      invalidWhen: [
        'newer_overlapping_athlete_intent_exists',
        'unowned_target_overlay_or_swept_row_drift',
      ],
    },
    laterIntentPolicy: 'newer_athlete_intent_wins',
  };
}

/**
 * Pure staging for the Durable Reversible Target-Overlay Transaction.
 * The supplied snapshot is the only source of truth; no store is mutated or
 * re-read while the candidate, ledger delta and accepted envelope are built.
 */
export function stageRepeatWeekTransaction(args: {
  snapshot: RepeatWeekSnapshot;
  baseProfile: OnboardingData;
  sourceWeekDate: string;
  todayISO?: string;
  expectedAcceptedRevision: number;
  trace?: AthleteActionTraceContext;
}): RepeatWeekStage {
  // Staging owns a closed, detached value graph. Accepted-week canonicalisation
  // is allowed to normalize its candidate in place, but it must never be able
  // to mutate the live Zustand graph before durable acknowledgement.
  args = { ...args, snapshot: clone(args.snapshot) };
  const todayISO = args.todayISO ?? todayISOLocal();
  if (args.snapshot.acceptedMaterialContext.revision !== args.expectedAcceptedRevision) {
    throw new Error('repeat_week_expected_revision_conflict');
  }
  const program = args.snapshot.currentProgram;
  if (!program) throw new Error('Cannot repeat a week without a current program');
  const sourceWeekStart = getMondayForDate(args.sourceWeekDate.split('T')[0]);
  const targetWeekStart = addDays(sourceWeekStart, 7);
  const acceptedSource = rebaseAcceptedEffectiveWeek({
    surfaces: args.snapshot,
    weekStart: sourceWeekStart,
    profile: args.baseProfile,
    markedDays: args.snapshot.acceptedMaterialContext.markedDays,
  });
  // The accepted gateway's visible rows already include active source facts,
  // exact user removals and any owned derived provenance. They are the repeat
  // source of truth when the target phase table has not changed.
  const sourceWorkouts = acceptedSource.visibleWorkouts;
  const existingTargetOverlay = args.snapshot.weekScopedOverlays[targetWeekStart] ?? null;
  const targetMicrocycle = selectMicrocycleForDate(program, null, targetWeekStart);
  const targetWinningWorkoutsByDate: Record<string, Workout> = {};
  const profileAnchorDows = new Set(anchorDowsForProfile(args.baseProfile));
  const targetAnchorDows = new Set(profileAnchorDows);
  if (existingTargetOverlay?.exposureContractV2 || targetMicrocycle?.exposureContractV2) {
    const acceptedTarget = rebaseAcceptedEffectiveWeek({
      surfaces: args.snapshot,
      weekStart: targetWeekStart,
      profile: args.baseProfile,
      markedDays: args.snapshot.acceptedMaterialContext.markedDays,
    });
    for (const workout of acceptedTarget.visibleWorkouts) {
      if (workout.workoutType !== 'Game' && workout.workoutType !== 'Team Training') continue;
      const date = dateForDowInWeek(targetWeekStart, workout.dayOfWeek);
      targetAnchorDows.add(workout.dayOfWeek);
      const canonicalAnchor = targetMicrocycle?.workouts.find((candidate) =>
        candidate.dayOfWeek === workout.dayOfWeek &&
        (candidate.workoutType === 'Game' || candidate.workoutType === 'Team Training'));
      const sameCanonicalIdentity = !!canonicalAnchor && (
        canonicalAnchor.id === workout.id ||
        (!!canonicalAnchor.planEntryId && canonicalAnchor.planEntryId === workout.planEntryId)
      );
      // Canonical target-week anchors fall through to the base microcycle. Only
      // an overlay-/fixture-owned target anchor is carried into the replacement
      // overlay, because it has no equivalent canonical surface to fall through
      // to after the previous overlay is displaced.
      if (!profileAnchorDows.has(workout.dayOfWeek) && !sameCanonicalIdentity) {
        targetWinningWorkoutsByDate[date] = clone(workout);
      }
    }
  }
  const resolvedTargetContracts = (
    !existingTargetOverlay?.exposureContract && !targetMicrocycle?.exposureContract
  ) || (
    !existingTargetOverlay?.exposureContractV2 && !targetMicrocycle?.exposureContractV2
  ) ? resolveRepeatTargetExposureContracts({
      profile: args.baseProfile,
      program,
      targetWeekStart,
      acceptedMaterialContext: args.snapshot.acceptedMaterialContext,
    }) : null;
  const targetExposureContract = existingTargetOverlay?.exposureContract ??
    targetMicrocycle?.exposureContract ?? resolvedTargetContracts!.legacy;
  const targetExposureContractV2 = existingTargetOverlay?.exposureContractV2 ??
    targetMicrocycle?.exposureContractV2 ?? resolvedTargetContracts?.v2;
  const targetTableChanged = section18PhaseTableSignature(acceptedSource.contract) !==
    section18PhaseTableSignature(targetExposureContractV2);
  const phaseOwnedSourceWorkouts = targetTableChanged
    ? targetMicrocycle?.workouts ?? resolvedTargetContracts?.workouts ?? sourceWorkouts
    : sourceWorkouts;
  const sourceRemovedDows = new Set(acceptedSource.dates
    .filter((entry) => entry.workout && !acceptedSource.visibleWorkouts.some((workout) =>
      workout.dayOfWeek === entry.dayOfWeek))
    .map((entry) => entry.dayOfWeek));
  let overlay = buildRepeatWeekOverlay({
    sourceWorkouts: phaseOwnedSourceWorkouts,
    targetWeekStart,
    targetAnchorDows: Array.from(targetAnchorDows),
    targetWinningWorkoutsByDate,
    targetExposureContract,
    targetExposureContractV2,
  });
  if (sourceRemovedDows.size > 0) {
    const workoutsByDate = { ...overlay.workoutsByDate };
    for (const dow of sourceRemovedDows) {
      if (targetAnchorDows.has(dow)) continue;
      const date = dateForDowInWeek(targetWeekStart, dow);
      if (!Object.prototype.hasOwnProperty.call(targetWinningWorkoutsByDate, date)) {
        workoutsByDate[date] = null;
      }
    }
    overlay = { ...overlay, workoutsByDate };
  }
  if (existingTargetOverlay) {
    const activeFixtureDates = effectiveFixtureDatesForWeeks({
      profile: args.baseProfile,
      markedDays: args.snapshot.acceptedMaterialContext.markedDays,
      weekStarts: [sourceWeekStart, targetWeekStart],
    });
    const workoutsByDate = { ...overlay.workoutsByDate };
    for (const [date, existing] of Object.entries(existingTargetOverlay.workoutsByDate)) {
      if (!existing) continue;
      const activeDependencies = existing.derivedSessionProvenance?.filter((record) =>
        record.dependency && activeFixtureDates.has(record.dependency.source.date)) ?? [];
      if (activeDependencies.length === 0) continue;
      const proposedUnderlying = workoutsByDate[date] ?? null;
      workoutsByDate[date] = {
        ...existing,
        derivedSessionProvenance: existing.derivedSessionProvenance?.map((record) =>
          record.dependency && activeFixtureDates.has(record.dependency.source.date)
            ? {
                ...record,
                dependency: {
                  ...record.dependency,
                  displacedSession: {
                    targetDate: date,
                    sourcePlanEntryId: proposedUnderlying?.planEntryId ?? null,
                    workout: clone(proposedUnderlying),
                  },
                  restoration: {
                    targetDate: date,
                    sourcePlanEntryId: proposedUnderlying?.planEntryId ?? null,
                    workout: clone(proposedUnderlying),
                  },
                },
              }
            : record),
      };
    }
    overlay = { ...overlay, workoutsByDate };
  }
  const gameDay = (args.baseProfile.usualGameDay || args.baseProfile.gameDay) as
    DayOfWeek | undefined;
  const gameDates = gameDay
    ? computeGameDatesForBlock(gameDay, program.startDate.slice(0, 10), program.endDate.slice(0, 10))
    : [];
  const sweep = decideOverrideSweep({
    gameDates,
    overrides: args.snapshot.dateOverrides,
    overrideContexts: args.snapshot.overrideContexts,
    activeConstraintIds: liveConstraintIds(
      args.snapshot.acceptedMaterialContext.activeConstraints,
      todayISO,
    ),
  });
  const cleared = new Set(sweep.clear);
  const dateOverrides = Object.fromEntries(Object.entries(args.snapshot.dateOverrides)
    .filter(([date]) => !cleared.has(date))) as Record<string, Workout>;
  const overrideContexts = Object.fromEntries(Object.entries(args.snapshot.overrideContexts)
    .filter(([date]) => !cleared.has(date))) as Record<string, OverrideContext>;
  const firstAccepted = stageAcceptedStateTransaction({
    reason: `repeat_week:${sourceWeekStart}:${targetWeekStart}`,
    trace: args.trace,
    profile: args.baseProfile,
    program: {
      weekScopedOverlays: {
        ...args.snapshot.weekScopedOverlays,
        [targetWeekStart]: overlay,
      },
      dateOverrides,
      overrideContexts,
    },
    validateWeekStarts: [targetWeekStart, ...sweep.clear.map(getMondayForDate)],
  }, args.snapshot);
  const acceptedOverlay = firstAccepted.program.weekScopedOverlays[targetWeekStart];
  if (!acceptedOverlay) throw new Error('repeat_week_staged_overlay_missing');
  const adjustment = buildRepeatAdjustment({
    snapshot: args.snapshot,
    sourceWeekStart,
    targetWeekStart,
    targetMicrocycle,
    beforeOverlay: existingTargetOverlay,
    afterOverlay: acceptedOverlay,
    sweep,
    acceptedRevision: firstAccepted.context.revision,
  });
  const accepted = stageAcceptedStateTransaction({
    reason: `repeat_week:${sourceWeekStart}:${targetWeekStart}`,
    trace: args.trace,
    profile: args.baseProfile,
    preserveExactAcceptedWorkouts: true,
    program: {
      ...firstAccepted.program,
      reversibleAdjustmentLedger: {
        protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
        adjustments: [
          ...args.snapshot.reversibleAdjustmentLedger.adjustments,
          adjustment,
        ],
      },
    },
    validateWeekStarts: [targetWeekStart, ...sweep.clear.map(getMondayForDate)],
  }, args.snapshot);
  return {
    accepted,
    programState: {
      ...args.snapshot,
      ...accepted.program,
      acceptedMaterialContext: accepted.context,
    },
    result: {
      overlay: accepted.program.weekScopedOverlays[targetWeekStart]!,
      sweep,
      sourceWeekStart,
      targetWeekStart,
      adjustmentId: adjustment.id,
      acceptedRevision: accepted.context.revision,
    },
  };
}

function publishStagedRepeatWeek(args: {
  stage: RepeatWeekStage;
  profile: OnboardingData;
  expectedAcceptedRevision: number;
  trace: AthleteActionTraceContext;
  onPublished: () => void;
}): void {
  if (useProgramStore.getState().acceptedMaterialContext.revision !== args.expectedAcceptedRevision) {
    throw new Error('repeat_week_expected_revision_conflict_before_publish');
  }
  assertAcceptedVisibleLedgerEquivalence({
    surfaces: args.stage.accepted.program,
    context: args.stage.accepted.context,
    weekStarts: [args.stage.result.targetWeekStart],
    profile: args.profile,
    trace: args.trace,
  });
  useProgramStore.setState({
    ...args.stage.programState,
  });
  args.onPublished();
  if (serializeProgramStoreEnvelope(useProgramStore.getState()) !==
    serializeProgramStoreEnvelope(args.stage.programState)) {
    throw new Error('repeat_week_live_publication_mismatch');
  }
  emitAthleteActionEvent(args.trace, 'accepted_state_publication_result', {
    published: true,
    acceptedStateVersion: args.stage.accepted.context.revision,
    targetWeekId: args.stage.result.targetWeekStart,
    internalResultCode: 'repeat_week_persisted_before_publication',
  });
}

/** Production Repeat Week door: durable acknowledgement precedes one live publication. */
export async function repeatWeekIntoNextWeek(args: {
  baseProfile: OnboardingData;
  sourceWeekDate: string;
  todayISO?: string;
  expectedAcceptedRevision?: number;
  trace?: AthleteActionTraceContext;
}): Promise<RepeatWeekResult> {
  const sourceWeekStart = getMondayForDate(args.sourceWeekDate.split('T')[0]);
  const targetWeekStart = addDays(sourceWeekStart, 7);
  const trace = beginAthleteActionTrace({
    source: 'tap',
    actionType: 'repeat_week',
    route: 'repeat_week',
    currentWeekId: sourceWeekStart,
    sourceDate: sourceWeekStart,
    targetDate: targetWeekStart,
    scope: 'target_week_overlay',
    controlId: 'program-week-repeat',
  }, args.trace);
  return runWithAthleteActionTrace(trace, () => withAcceptedMutationLock(async () => {
    const expectedAcceptedRevision = args.expectedAcceptedRevision ??
      useProgramStore.getState().acceptedMaterialContext.revision;
    const preState = useProgramStore.getState();
    const preStateEnvelope = serializeProgramStoreEnvelope(preState);
    const preProgram = captureAcceptedProgramState();
    const preFingerprint = semanticFingerprint(preProgram);
    let preEnvelope: string | null = null;
    let preEnvelopeRead = false;
    let token: ReturnType<typeof beginProgramPersistenceStage> | null = null;
    let published = false;
    let attemptedStage: RepeatWeekStage | null = null;
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: 'repeat_week',
      sourceWeekId: sourceWeekStart,
      targetWeekId: targetWeekStart,
      expectedAcceptedRevision,
      beforeStateHash: athleteActionDiagnosticHash(preProgram),
    });
    try {
      if (useProgramStore.getState().acceptedMaterialContext.revision !== expectedAcceptedRevision) {
        throw new Error('repeat_week_expected_revision_conflict');
      }
      const stageTrace = beginAthleteActionTrace({
        source: 'tap', actionType: 'repeat_week', route: 'repeat_week_stage',
      }, trace);
      const stage = runWithAthleteActionTrace(stageTrace, () => stageRepeatWeekTransaction({
        snapshot: preState,
        baseProfile: args.baseProfile,
        sourceWeekDate: args.sourceWeekDate,
        todayISO: args.todayISO,
        expectedAcceptedRevision,
        trace: stageTrace,
      }));
      attemptedStage = stage;
      token = beginProgramPersistenceStage();
      const persistTrace = beginAthleteActionTrace({
        source: 'tap', actionType: 'repeat_week', route: 'repeat_week_persist_before_publish',
      }, trace);
      await runWithAthleteActionTrace(persistTrace, async () => {
        preEnvelope = await readDurableProgramStoreEnvelope();
        preEnvelopeRead = true;
        if (athleteActionDiagnosticsEnabled()) {
          athleteActionTraceCoordinator.recordBefore({
            token: trace,
            semantic: captureAcceptedAthleteSemanticSnapshotV2(preProgram),
            visibleCard: { status: 'awaiting_actual_home_render' },
            visibleDetail: { sourceWeekStart, targetWeekStart },
            persistedEnvelope: preEnvelope,
          });
          athleteActionTraceCoordinator.recordPersistence(persistTrace, {
            operation: 'read_before',
            store: 'program-store',
            attempted: true,
            acknowledged: true,
            expectedFingerprint: capturedTraceField(semanticFingerprintV2(preEnvelope)),
            actualFingerprint: capturedTraceField(semanticFingerprintV2(preEnvelope)),
          });
        }
        if (serializeProgramStoreEnvelope(useProgramStore.getState()) !== preStateEnvelope ||
          semanticFingerprint(captureAcceptedProgramState()) !== preFingerprint ||
          useProgramStore.getState().acceptedMaterialContext.revision !== expectedAcceptedRevision) {
          throw new Error('repeat_week_expected_revision_conflict_before_persist');
        }
        const persistedEnvelope = await persistProgramStoreEnvelopeDurably(
          token!,
          stage.programState,
        );
        if (athleteActionDiagnosticsEnabled()) {
          athleteActionTraceCoordinator.recordPersistence(persistTrace, {
            operation: 'write_attempt',
            store: 'program-store',
            attempted: true,
            acknowledged: true,
            expectedFingerprint: capturedTraceField(semanticFingerprintV2(persistedEnvelope)),
            actualFingerprint: capturedTraceField(semanticFingerprintV2(persistedEnvelope)),
          });
        }
        const acknowledgedEnvelope = await readDurableProgramStoreEnvelope();
        if (acknowledgedEnvelope !== persistedEnvelope) {
          throw new Error('repeat_week_persisted_envelope_ack_mismatch');
        }
        const acknowledgedRevision = acknowledgedEnvelope
          ? (JSON.parse(acknowledgedEnvelope) as { state?: { acceptedMaterialContext?: { revision?: number } } })
            .state?.acceptedMaterialContext?.revision
          : undefined;
        if (acknowledgedRevision !== stage.accepted.context.revision) {
          throw new Error('repeat_week_persisted_revision_ack_mismatch');
        }
        if (athleteActionDiagnosticsEnabled()) {
          athleteActionTraceCoordinator.recordPersistence(persistTrace, {
            operation: 'readback',
            store: 'program-store',
            attempted: true,
            acknowledged: true,
            expectedFingerprint: capturedTraceField(semanticFingerprintV2(persistedEnvelope)),
            actualFingerprint: capturedTraceField(semanticFingerprintV2(acknowledgedEnvelope)),
          });
        }
      });
      const publishTrace = beginAthleteActionTrace({
        source: 'tap', actionType: 'repeat_week', route: 'repeat_week_publish_and_verify',
      }, trace);
      if (serializeProgramStoreEnvelope(useProgramStore.getState()) !== preStateEnvelope) {
        throw new Error('repeat_week_live_state_changed_before_publish');
      }
      runWithAthleteActionTrace(publishTrace, () => {
        publishStagedRepeatWeek({
          stage,
          profile: args.baseProfile,
          expectedAcceptedRevision,
          trace: publishTrace,
          onPublished: () => { published = true; },
        });
      });
      if (athleteActionDiagnosticsEnabled()) {
        athleteActionTraceCoordinator.recordAfter({
          token: trace,
          semantic: captureAcceptedAthleteSemanticSnapshotV2(),
          visibleCard: { status: 'awaiting_actual_home_render' },
          visibleDetail: { sourceWeekStart, targetWeekStart },
        });
      }
      logger.debug('[repeatWeek] durable target overlay published', {
        sourceWeekStart,
        targetWeekStart,
        adjustmentId: stage.result.adjustmentId,
        cleared: stage.result.sweep.clear,
      });
      emitAthleteActionEvent(trace, 'athlete_action_completed', {
        outcome: 'repeat_week_committed',
        internalResultCode: 'repeat_week_accepted',
        acceptedStateVersion: stage.accepted.context.revision,
        sourceWeekId: sourceWeekStart,
        targetWeekId: targetWeekStart,
        reversibleAdjustmentId: stage.result.adjustmentId,
      });
      return {
        ...stage.result,
        traceId: trace.traceId,
        observationId: `repeat-week-visible:${stage.result.adjustmentId}`,
      };
    } catch (error) {
      let durableRollbackError: unknown = null;
      if (token && preEnvelopeRead) {
        try {
          const currentEnvelope = await readDurableProgramStoreEnvelope();
          if (currentEnvelope !== preEnvelope) {
            await restoreProgramStoreEnvelopeDurably(token, preEnvelope);
            const restoredEnvelope = await readDurableProgramStoreEnvelope();
            if (restoredEnvelope !== preEnvelope) {
              throw new Error('repeat_week_durable_rollback_mismatch');
            }
          }
        } catch (rollbackError) {
          durableRollbackError = rollbackError;
        }
      }
      if (published) {
        useProgramStore.setState(preState);
        if (serializeProgramStoreEnvelope(useProgramStore.getState()) !== preStateEnvelope ||
          semanticFingerprint(captureAcceptedProgramState()) !== preFingerprint) {
          const currentEnvelope = serializeProgramStoreEnvelope(useProgramStore.getState());
          throw new Error(
            `repeat_week_memory_rollback_mismatch:${String((error as Error)?.message ?? error)}` +
            `:${firstStringDivergence(preStateEnvelope, currentEnvelope)}`,
          );
        }
      } else if (attemptedStage) {
        const live = useProgramStore.getState();
        const leakedAdjustment = live.reversibleAdjustmentLedger.adjustments.some((adjustment) =>
          adjustment.id === attemptedStage!.result.adjustmentId);
        const stagedOverlay = attemptedStage.programState.weekScopedOverlays[targetWeekStart] ?? null;
        const preOverlay = preState.weekScopedOverlays[targetWeekStart] ?? null;
        const liveOverlay = live.weekScopedOverlays[targetWeekStart] ?? null;
        const leakedOverlay = semanticFingerprint(liveOverlay) === semanticFingerprint(stagedOverlay) &&
          semanticFingerprint(preOverlay) !== semanticFingerprint(stagedOverlay);
        if (leakedAdjustment || leakedOverlay) {
          throw new Error('repeat_week_unpublished_state_leak');
        }
      }
      if (athleteActionDiagnosticsEnabled()) {
        athleteActionTraceCoordinator.recordRollback(trace, {
          memory: { verified: true },
          programEnvelope: { verified: durableRollbackError === null },
          mirrorEnvelopes: { verified: true, status: 'not_applicable' },
          visibleProjection: { verified: true },
        });
      }
      const rejectionCode = athleteActionErrorCode(error, 'repeat_week_unknown_error');
      emitAthleteActionEvent(trace, 'accepted_state_publication_result', {
        published: false,
        previousStateRestored: durableRollbackError === null,
        internalResultCode: rejectionCode,
      });
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'threw',
        internalResultCode: 'repeat_week_failed',
        originalRejectionCode: rejectionCode,
        rejectionCodes: [rejectionCode],
        firstFailingBoundary: published
          ? 'repeat_week_publish_and_verify'
          : 'repeat_week_persist_before_publish',
        failureCategory: classifyAthleteActionFailure(rejectionCode, 'repeatWeekIntoNextWeek'),
        previousStateRestored: durableRollbackError === null,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
      if (durableRollbackError) throw durableRollbackError;
      throw error;
    } finally {
      if (token) endProgramPersistenceStage(token);
    }
  }));
}

function firstStringDivergence(expected: string, actual: string): string {
  let index = 0;
  while (index < expected.length && index < actual.length && expected[index] === actual[index]) {
    index += 1;
  }
  return `${index}:expected=${expected.slice(Math.max(0, index - 40), index + 100)}` +
    `:actual=${actual.slice(Math.max(0, index - 40), index + 100)}`;
}

/** Test-only compatibility seam; production callers must use the durable async door. */
export function repeatWeekIntoNextWeekInMemory(args: {
  baseProfile: OnboardingData;
  sourceWeekDate: string;
  todayISO?: string;
}): RepeatWeekResult {
  const expectedAcceptedRevision = useProgramStore.getState().acceptedMaterialContext.revision;
  const stage = stageRepeatWeekTransaction({
    snapshot: useProgramStore.getState(),
    baseProfile: args.baseProfile,
    sourceWeekDate: args.sourceWeekDate,
    todayISO: args.todayISO,
    expectedAcceptedRevision,
  });
  useProgramStore.setState({
    ...stage.accepted.program,
    acceptedMaterialContext: stage.accepted.context,
  });
  return stage.result;
}
