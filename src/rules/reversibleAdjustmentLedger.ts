import type { CalendarDayType } from '../store/calendarStore';
import type {
  OverrideContext,
  UserRemovalConstraint,
  UserRemovalScope,
  Workout,
} from '../types/domain';
import {
  semanticFingerprint,
  snapshotSemanticWorkout,
} from '../utils/programSemanticSnapshot';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';

export const REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION = 1 as const;

export type ReversibleAdjustmentKind =
  | 'game_fixture_add'
  | 'game_fixture_move'
  | 'game_fixture_remove'
  | 'practice_match_fixture_add'
  | 'practice_match_fixture_move'
  | 'practice_match_fixture_remove'
  | 'session_move'
  | 'session_delete'
  | 'session_component_delete';

export type ReversibleAdjustmentStatus =
  | 'active'
  | 'cleared'
  | 'superseded'
  | 'conflicted';

export type ReversibleAdjustmentActor = 'athlete' | 'coach' | 'system';

export type ReversibleAdjustmentSurface =
  | 'program_tab'
  | 'session_detail'
  | 'coach_chat'
  | 'calendar'
  | 'hydration_migration'
  | 'test';

export interface ReversibleAdjustmentCalendarFact {
  date: string;
  before: CalendarDayType | null;
  after: CalendarDayType | null;
}

/**
 * The smallest material delta owned by an adjustment.
 *
 * Workouts are captured per concrete date, never as an historical whole-week
 * snapshot. Restoration may write the `before` value only while the current
 * accepted semantic fingerprint still equals `afterFingerprint`.
 */
export interface ReversibleAdjustmentOwnedDayDelta {
  date: string;
  weekStart: string;
  beforeWorkout: Workout | null;
  afterWorkout: Workout | null;
  /** Raw accepted surface rows are separate from visible semantic rows so a
   * progressed prescription is never fed through progression a second time. */
  beforeSurfaceOwner?: 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty';
  afterSurfaceOwner?: 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty';
  beforeSurfaceWorkout?: Workout | null;
  afterSurfaceWorkout?: Workout | null;
  beforeDateOverride: Workout | null;
  afterDateOverride: Workout | null;
  beforeOverrideContext: OverrideContext | null;
  afterOverrideContext: OverrideContext | null;
  beforeFingerprint: string;
  afterFingerprint: string;
}

/** Contract ownership is kept separately from workouts so restoration never
 * writes an unrelated historical whole-week workout snapshot over later
 * athlete intent. */
export interface ReversibleAdjustmentOwnedWeekDelta {
  weekStart: string;
  beforeExposureContract: WeeklyExposureContractV2 | null;
  afterExposureContract: WeeklyExposureContractV2 | null;
  beforeFingerprint: string;
  afterFingerprint: string;
}

export interface ReversibleAdjustmentSemanticFingerprint {
  date: string;
  fingerprint: string;
}

export interface ReversibleAdjustmentRestorationTarget {
  kind: 'fixture_state' | 'session' | 'session_component';
  dates: string[];
  stableIdentities: string[];
  componentScope?: UserRemovalScope;
}

export interface ReversibleAdjustmentLinkedOverride {
  date: string;
  ownerId: string | null;
}

export interface ReversibleAdjustmentLinkedReduction {
  weekStart: string;
  metric: string;
  reason: string;
  originalApprovedTarget: number;
  reducedTarget: number;
  detail: string;
  deletionIdentity: string | null;
  fingerprint: string;
}

export interface ReversibleAdjustmentValidity {
  reversible: boolean;
  source: 'runtime_exact_delta' | 'legacy_exact_user_removal' | 'legacy_after_state_only';
  validWhile: string[];
  invalidWhen: string[];
}

export interface ReversibleAdjustmentRecord {
  protocolVersion: typeof REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION;
  id: string;
  kind: ReversibleAdjustmentKind;
  sourceActor: ReversibleAdjustmentActor;
  sourceSurface: ReversibleAdjustmentSurface;
  sourceActionOrIntentId: string;
  createdAt: string;
  acceptedRevision: number;
  status: ReversibleAdjustmentStatus;
  clearedAt: string | null;
  supersededById: string | null;
  supersededReason: string | null;
  affectedDates: string[];
  affectedWeeks: string[];
  rollingDependencyWeeks: string[];
  displacedOriginalState: {
    ownedDays: ReversibleAdjustmentOwnedDayDelta[];
    ownedWeeks: ReversibleAdjustmentOwnedWeekDelta[];
    calendarFacts: ReversibleAdjustmentCalendarFact[];
    userRemovalConstraint: UserRemovalConstraint | null;
  };
  acceptedAfterSemanticFingerprints: ReversibleAdjustmentSemanticFingerprint[];
  restorationTarget: ReversibleAdjustmentRestorationTarget;
  linkedConstraintIds: string[];
  linkedCalendarFacts: ReversibleAdjustmentCalendarFact[];
  linkedOverrideOwners: ReversibleAdjustmentLinkedOverride[];
  linkedOverlayIds: string[];
  linkedUserRemovalConstraintIds: string[];
  linkedProvenanceIds: string[];
  linkedTypedReductions: ReversibleAdjustmentLinkedReduction[];
  validity: ReversibleAdjustmentValidity;
  laterIntentPolicy: 'newer_athlete_intent_wins';
}

export interface ReversibleAdjustmentLedger {
  protocolVersion: typeof REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION;
  adjustments: ReversibleAdjustmentRecord[];
}

export type ReversibleAdjustmentMigrationContracts = Record<
  string,
  WeeklyExposureContractV2 | null | undefined
>;

export function createEmptyReversibleAdjustmentLedger(): ReversibleAdjustmentLedger {
  return {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    adjustments: [],
  };
}

export function reversibleAdjustmentWorkoutFingerprint(
  date: string,
  workout: Workout | null,
): string {
  const snapshot = snapshotSemanticWorkout(date.slice(0, 10), workout);
  return semanticFingerprint({
    date: snapshot.date,
    workout: snapshot.workout
      ? {
          identity: snapshot.workout.identity,
          workoutType: snapshot.workout.workoutType,
          durationMinutes: snapshot.workout.durationMinutes,
          strengthIntensity: snapshot.workout.strengthIntensity,
          conditioningIntensity: snapshot.workout.conditioningIntensity,
          components: snapshot.workout.components,
          exercises: snapshot.workout.exercises,
        }
      : null,
  });
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function workoutOnDate(workout: Workout | null, date: string): Workout | null {
  return workout
    ? { ...clone(workout), dayOfWeek: new Date(`${date}T12:00:00`).getDay() }
    : null;
}

function adjustmentKindForLegacyConstraint(
  constraint: UserRemovalConstraint,
): ReversibleAdjustmentKind {
  if (constraint.mutationKind === 'move') return 'session_move';
  return constraint.scope === 'whole_session'
    ? 'session_delete'
    : 'session_component_delete';
}

function legacyOwnedDays(constraint: UserRemovalConstraint): ReversibleAdjustmentOwnedDayDelta[] {
  const targetDate = constraint.targetDate.slice(0, 10);
  const targetAfter = workoutOnDate(constraint.remainingWorkout, targetDate);
  const targetBefore = workoutOnDate(constraint.originalWorkout, targetDate);
  const owned: ReversibleAdjustmentOwnedDayDelta[] = [{
    date: targetDate,
    weekStart: mondayForDate(targetDate),
    beforeWorkout: targetBefore,
    afterWorkout: targetAfter,
    beforeDateOverride: null,
    afterDateOverride: null,
    beforeOverrideContext: null,
    afterOverrideContext: null,
    beforeFingerprint: reversibleAdjustmentWorkoutFingerprint(targetDate, targetBefore),
    afterFingerprint: reversibleAdjustmentWorkoutFingerprint(targetDate, targetAfter),
  }];
  if (constraint.mutationKind === 'move' && constraint.moveTargetDate) {
    const moveDate = constraint.moveTargetDate.slice(0, 10);
    const moveBefore = workoutOnDate(constraint.remainingWorkout, moveDate);
    const moveAfter = workoutOnDate(constraint.movedWorkout ?? null, moveDate);
    owned.push({
      date: moveDate,
      weekStart: mondayForDate(moveDate),
      beforeWorkout: moveBefore,
      afterWorkout: moveAfter,
      beforeDateOverride: null,
      afterDateOverride: null,
      beforeOverrideContext: null,
      afterOverrideContext: null,
      beforeFingerprint: reversibleAdjustmentWorkoutFingerprint(moveDate, moveBefore),
      afterFingerprint: reversibleAdjustmentWorkoutFingerprint(moveDate, moveAfter),
    });
  }
  return owned;
}

/**
 * Lossless legacy migration is deliberately limited to UserRemovalConstraint.
 * Its exact original/remaining/moved prescriptions prove ownership. Fixture
 * Coach Notes contain after-state only and therefore never enter this ledger.
 */
export function migrateLegacyUserRemovalConstraint(
  constraint: UserRemovalConstraint,
  acceptedRevision: number,
  exposureContractsByWeek: ReversibleAdjustmentMigrationContracts = {},
): ReversibleAdjustmentRecord | null {
  if (!constraint?.id || !constraint.originalWorkout?.id) return null;
  const ownedDays = legacyOwnedDays(constraint);
  const affectedDates = ownedDays.map((entry) => entry.date).sort();
  const affectedWeeks = Array.from(new Set(ownedDays.map((entry) => entry.weekStart))).sort();
  const identity = constraint.targetPlanEntryId ?? constraint.targetWorkoutId;
  const active = constraint.status === 'active';
  const calendarFacts = constraint.wholeDayRestOwned
    ? [{ date: constraint.targetDate, before: null, after: 'rest' as const }]
    : [];
  return {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    id: `reversible-adjustment:legacy:${constraint.id}`,
    kind: adjustmentKindForLegacyConstraint(constraint),
    sourceActor: constraint.source === 'coach' ? 'coach' : 'athlete',
    sourceSurface: 'hydration_migration',
    sourceActionOrIntentId: constraint.id,
    createdAt: constraint.createdAt,
    acceptedRevision,
    status: active ? 'active' : 'cleared',
    clearedAt: constraint.restoredAt,
    supersededById: null,
    supersededReason: null,
    affectedDates,
    affectedWeeks,
    rollingDependencyWeeks: affectedWeeks,
    displacedOriginalState: {
      ownedDays,
      ownedWeeks: [],
      calendarFacts,
      userRemovalConstraint: clone(constraint),
    },
    acceptedAfterSemanticFingerprints: ownedDays.map((entry) => ({
      date: entry.date,
      fingerprint: entry.afterFingerprint,
    })),
    restorationTarget: {
      kind: constraint.mutationKind === 'move'
        ? 'session'
        : constraint.scope === 'whole_session' ? 'session' : 'session_component',
      dates: affectedDates,
      stableIdentities: [identity],
      componentScope: constraint.scope,
    },
    linkedConstraintIds: [],
    linkedCalendarFacts: calendarFacts,
    linkedOverrideOwners: [],
    linkedOverlayIds: [],
    linkedUserRemovalConstraintIds: [constraint.id],
    linkedProvenanceIds: [],
    linkedTypedReductions: legacyLinkedTypedReductions(
      constraint.id,
      exposureContractsByWeek,
    ),
    validity: {
      reversible: true,
      source: 'legacy_exact_user_removal',
      validWhile: ['linked_user_removal_constraint_identity_matches'],
      invalidWhen: ['accepted_after_semantic_fingerprint_changes'],
    },
    laterIntentPolicy: 'newer_athlete_intent_wins',
  };
}

function legacyLinkedTypedReductions(
  deletionIdentity: string,
  exposureContractsByWeek: ReversibleAdjustmentMigrationContracts,
): ReversibleAdjustmentLinkedReduction[] {
  const linked = Object.entries(exposureContractsByWeek).flatMap(([weekStart, contract]) =>
    (contract?.authorisedReductions ?? [])
      .filter((entry) => entry.deletionIdentity === deletionIdentity)
      .map((entry) => {
        const reduction = {
          weekStart,
          metric: entry.metric,
          reason: entry.reason,
          originalApprovedTarget: entry.originalApprovedTarget,
          reducedTarget: entry.reducedTarget,
          detail: entry.detail,
          deletionIdentity: entry.deletionIdentity ?? null,
        };
        return {
          ...reduction,
          fingerprint: semanticFingerprint(reduction),
        };
      }));
  return Array.from(new Map(linked.map((entry) => [entry.fingerprint, entry])).values())
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart) ||
      left.fingerprint.localeCompare(right.fingerprint));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validPersistedAdjustment(value: unknown): value is ReversibleAdjustmentRecord {
  if (!isRecord(value) || !isRecord(value.displacedOriginalState)) return false;
  return value.protocolVersion === REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION &&
    typeof value.id === 'string' && typeof value.kind === 'string' &&
    typeof value.createdAt === 'string' && typeof value.status === 'string' &&
    Array.isArray(value.affectedDates) && Array.isArray(value.affectedWeeks) &&
    Array.isArray(value.rollingDependencyWeeks) &&
    Array.isArray(value.displacedOriginalState.ownedDays) &&
    isRecord(value.restorationTarget) && Array.isArray(value.linkedConstraintIds) &&
    Array.isArray(value.linkedUserRemovalConstraintIds) &&
    Array.isArray(value.linkedTypedReductions) && isRecord(value.validity);
}

export function normalizeReversibleAdjustmentLedger(args: {
  value: Partial<ReversibleAdjustmentLedger> | null | undefined;
  userRemovalConstraints?: readonly UserRemovalConstraint[];
  acceptedRevision?: number;
  exposureContractsByWeek?: ReversibleAdjustmentMigrationContracts;
}): ReversibleAdjustmentLedger {
  const persisted = Array.isArray(args.value?.adjustments)
    ? args.value!.adjustments.filter(validPersistedAdjustment).map((adjustment) => ({
        ...clone(adjustment),
        displacedOriginalState: {
          ...clone(adjustment.displacedOriginalState),
          ownedWeeks: clone(adjustment.displacedOriginalState.ownedWeeks ?? []),
        },
      }))
    : [];
  const linkedRemovalIds = new Set(persisted.flatMap((adjustment) =>
    adjustment.linkedUserRemovalConstraintIds ?? []));
  for (const constraint of args.userRemovalConstraints ?? []) {
    if (linkedRemovalIds.has(constraint.id)) continue;
    const migrated = migrateLegacyUserRemovalConstraint(
      constraint,
      args.acceptedRevision ?? 0,
      args.exposureContractsByWeek,
    );
    if (migrated) persisted.push(migrated);
  }
  for (let index = 0; index < persisted.length; index++) {
    const adjustment = persisted[index];
    const exactLinks = adjustment.linkedUserRemovalConstraintIds.flatMap((constraintId) =>
      legacyLinkedTypedReductions(
        constraintId,
        args.exposureContractsByWeek ?? {},
      ));
    if (exactLinks.length === 0) continue;
    const byFingerprint = new Map([
      ...(adjustment.linkedTypedReductions ?? []),
      ...exactLinks,
    ].map((entry) => [entry.fingerprint, entry]));
    persisted[index] = {
      ...adjustment,
      linkedTypedReductions: Array.from(byFingerprint.values()).sort((left, right) =>
        left.weekStart.localeCompare(right.weekStart) ||
        left.fingerprint.localeCompare(right.fingerprint)),
    };
  }
  persisted.sort((left, right) => left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id));
  return {
    protocolVersion: REVERSIBLE_ADJUSTMENT_PROTOCOL_VERSION,
    adjustments: persisted,
  };
}

export function reversibleAdjustmentId(args: {
  kind: ReversibleAdjustmentKind;
  sourceActionOrIntentId: string;
  createdAt?: string;
  nonce?: string;
}): string {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const nonce = args.nonce ?? Math.random().toString(36).slice(2, 8);
  return [
    'reversible-adjustment',
    args.kind,
    createdAt.replace(/[^0-9A-Za-z]/g, ''),
    args.sourceActionOrIntentId.replace(/[^0-9A-Za-z:_-]/g, '-'),
    nonce,
  ].join(':');
}
