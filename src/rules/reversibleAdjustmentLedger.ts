import type { CalendarDayType } from '../store/calendarStore';
import type {
  DerivedSessionProvenance,
  OverrideContext,
  UserRemovalConstraint,
  UserRemovalScope,
  Workout,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import {
  semanticFingerprint,
  snapshotSemanticWorkout,
} from '../utils/programSemanticSnapshot';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';
import type { Section18AuthorisedReduction } from './weeklyExposureContractV2';

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
  | 'session_component_delete'
  /** Net-new session added onto a previously empty/rest day (athlete addition). */
  | 'session_add'
  /**
   * Exact week-overlay transaction authored by a DERIVING readiness/illness
   * source fact (severe illness → illness_recovery, cooked fatigue → readiness
   * reduction). Carries `sourceFactId`; clearing the fact cascade-reverts it via
   * the shared week_overlay restoration, byte-exact to the stored prior overlay.
   */
  | 'deriving_source_fact'
  /** Exact accepted delta for an explicit athlete go-lighter command. */
  | 'explicit_load_edit';

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
  /** Raw accepted surface rows are separate from visible semantic rows so a
   * progressed prescription is never fed through progression a second time. */
  beforeSurfaceOwner?: 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty';
  afterSurfaceOwner?: 'date_override' | 'week_overlay' | 'base_microcycle' | 'empty';
  beforeSurfaceWorkout?: Workout | null;
  beforeDateOverride: Workout | null;
  beforeOverrideContext: OverrideContext | null;
  beforeFingerprint: string;
  afterFingerprint: string;

  // ── THE AFTER SIDE IS A RECORD, NOT A COPY (LR-26, Sam's ruling 2, 2026-08-05)
  //
  // `afterWorkout`, `afterSurfaceWorkout`, `afterDateOverride` and
  // `afterOverrideContext` used to store full `Workout`/`OverrideContext`
  // objects here. MEASURED 2026-08-05: none of their CONTENT was ever read
  // back. `afterSurfaceWorkout` had no reader at all; `afterWorkout` was read
  // only for `planEntryId ?? id`; the other two only to compute a
  // `semanticFingerprint` for the "has the world moved since?" check. So the
  // stored copies were output, and the three fields below are what was
  // actually being consumed — an identity and two fingerprints.
  //
  // The BEFORE side stays and is deliberately NOT symmetrical: it is read in
  // full to restore (`reversibleAdjustmentTransaction.ts:511-553`), and Sam
  // ruled it the decision's own content. Rebuilding undo as
  // replay-from-decisions — which is what would make the before side derivable
  // too — is its own queued census unit, not this one.
  /** `planEntryId ?? id` of the accepted workout this decision produced. */
  afterStableIdentity: string | null;
  afterDateOverrideFingerprint: string;
  afterOverrideContextFingerprint: string;
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
  kind: 'fixture_state' | 'session' | 'session_component' | 'week_overlay';
  dates: string[];
  stableIdentities: string[];
  componentScope?: UserRemovalScope;
}

/** Exact raw overlay ownership for a target-week replacement. */
export interface ReversibleAdjustmentWeekOverlayDelta {
  weekStart: string;
  before: WeekScopedWorkoutOverlay | null;
  after: WeekScopedWorkoutOverlay | null;
  beforeFingerprint: string;
  afterFingerprint: string;
}

/** Exact override/context row displaced by a transaction sweep. */
export interface ReversibleAdjustmentSweptOverrideDelta {
  date: string;
  beforeWorkout: Workout | null;
  afterWorkout: Workout | null;
  beforeContext: OverrideContext | null;
  afterContext: OverrideContext | null;
  beforeFingerprint: string;
  afterFingerprint: string;
}

export interface ReversibleAdjustmentProvenanceDelta {
  date: string;
  record: DerivedSessionProvenance;
  fingerprint: string;
}

export interface ReversibleAdjustmentTypedReductionDelta {
  weekStart: string;
  reduction: Section18AuthorisedReduction;
  fingerprint: string;
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
  source: 'runtime_exact_delta';
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
  /**
   * First-class link to the temporary source fact that authored this adjustment,
   * when it was made in response to one (e.g. a lighter-day trim accepted after a
   * readiness report). Clearing that fact cascade-reverts this adjustment
   * generically — no per-feature special case. Absent for adjustments with no
   * originating fact.
   */
  sourceFactId?: string;
  /** Optional producer detail retained by newer canonical transactions. */
  sourceProducer?: 'tap' | 'coach' | 'system';
  /** Optional producer-turn correlation; never part of fixture/session identity. */
  sourceTurnId?: string;
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
    /** Present for exact target-overlay transactions such as Repeat Week. */
    weekOverlay?: ReversibleAdjustmentWeekOverlayDelta | null;
    sweptOverrides?: ReversibleAdjustmentSweptOverrideDelta[];
    provenanceDeltas?: {
      added: ReversibleAdjustmentProvenanceDelta[];
      removed: ReversibleAdjustmentProvenanceDelta[];
    };
    typedReductionDeltas?: {
      added: ReversibleAdjustmentTypedReductionDelta[];
      removed: ReversibleAdjustmentTypedReductionDelta[];
    };
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
}): ReversibleAdjustmentLedger {
  const persisted = Array.isArray(args.value?.adjustments)
    ? args.value!.adjustments.filter(validPersistedAdjustment).map((adjustment) => ({
        ...clone(adjustment),
        displacedOriginalState: {
          ...clone(adjustment.displacedOriginalState),
          ownedDays: clone(adjustment.displacedOriginalState.ownedDays ?? []),
          ownedWeeks: clone(adjustment.displacedOriginalState.ownedWeeks ?? []),
          weekOverlay: clone(adjustment.displacedOriginalState.weekOverlay ?? null),
          sweptOverrides: clone(adjustment.displacedOriginalState.sweptOverrides ?? []),
          provenanceDeltas: clone(adjustment.displacedOriginalState.provenanceDeltas ?? {
            added: [],
            removed: [],
          }),
          typedReductionDeltas: clone(adjustment.displacedOriginalState.typedReductionDeltas ?? {
            added: [],
            removed: [],
          }),
        },
      }))
    : [];
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
