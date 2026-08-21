/**
 * coachUpdatesStore.ts — week-level Coach Update notes surfaced on the
 * Program tab. The store keeps one entry per Mon-Sun week (keyed by
 * `weekStartISO`); the HomeScreen reads it on render and hides the
 * card when the entry is missing or `active === false`.
 *
 * WRITE PATH
 *   CoachScreen.handleSend writes here ONLY after applyAdjustmentEvents
 *   reports applied.length > 0 AND the visible-diff verifier confirms
 *   the user-facing surface actually moved. So if the card is rendered,
 *   the program tab MUST have a corresponding visible change.
 *
 * READ PATH
 *   HomeScreen calls `getActiveCoachUpdate(weekStartISO)`. If null →
 *   render nothing. If present → render the card with reason / rules /
 *   changes / "Update coach" button.
 *
 * LIFECYCLE
 *   - upsertCoachUpdate(weekStartISO, payload)  — coach made changes
 *   - deactivateCoachUpdate(weekStartISO)       — athlete dismissed it
 *     OR a follow-up turn replaces the prior entry
 *   - clearAllCoachUpdates                       — nuke (test/reset use)
 *
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`): update
 * cards and active constraints are the
 * athlete's record of WHY their week changed, so every write of them goes
 * through `applyCoachUpdatesWrite` — one door, typed refusals of the wipe
 * shape, every writer on the tape, and a quarantine boundary at the
 * persistence writer. `coachUpdatesOwnershipTests` fails the build on a
 * product writer around the owner. LR-6: no coach path changes WHAT it does —
 * the mirror publish, the rollback restore and the constraint-transaction
 * commits are named writers under named reset acts (a constraint set that
 * empties when the last injury resolves is a common real state), behaviour
 * identical. The refusal guards the bare-wipe class.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import {
  normalizeAcceptedKeyedMap,
  normalizeAcceptedMaterialContext,
} from './acceptedStateColdStart';
import type {
  InjuryState,
  InjuryStatus,
} from '../utils/injuryProgression';
import type { EquipmentTag } from '../data/exercisePools';
import type { ConditioningEquipmentModality } from '../types/domain';
import type { FixtureMutationSourceMetadata } from '../types/fixtureMutation';
import {
  decideQuarantinedWrite,
  guardedDurableWrite,
  quarantineRefusedPayload,
  registerQuarantineBoundary,
  releaseQuarantine,
} from './refusedPayloadQuarantine';
import { logger } from '../utils/logger';
import {
  athleteActionDiagnosticHash,
  athleteActionErrorCode,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionSource,
  type AthleteActionType,
} from '../utils/athleteActionDiagnostics';

export type CoachUpdateSource = 'coach' | 'uae';

export interface CoachUpdate {
  /** Stable id (timestamp + week key). */
  id: string;
  /** ISO date of Monday (Mon-Sun week boundary). */
  weekStartISO: string;
  /** Origin of the update — manual coach action or the deterministic UAE. */
  source: CoachUpdateSource;
  /** Athlete-facing summary of WHY the week changed. */
  reason: string;
  /** Bucketed rules (e.g. "No sprinting or high-speed running"). */
  rules: string[];
  /** Per-session change bullets for THIS week (event-derived). */
  changes: string[];
  /**
   * Per-session change bullets for NEXT week (constraint-projection
   * derived — the exposure engine reshaped future
   * sessions silently; this surfaces them on the card). Optional for
   * back-compat — older entries simply don't render the section.
   */
  nextWeekChanges?: string[];
  /**
   * Plan-driven concise card fields (live-derived path only — stored
   * entries leave these undefined and fall back to legacy rendering).
   * The card prefers these when present so the athlete sees the same
   * spec the engine validates against.
   *
   * NOTE — these are LEGACY shape (Avoid / Sub in / Keep). Pre-MVP
   * the card was rewritten around the truth gate (Applied / Guidance
   * / Optional) — see `appliedChanges`/`activeGuidance`/`optionalAdvice`
   * below. New entries SHOULD populate the truth-gate fields. The
   * legacy fields remain so older AsyncStorage entries still render.
   */
  avoid?: string[];
  /** Substitution suggestions, plan-derived (legacy only). */
  substituteWith?: string[];
  /** Safe focus, plan-derived (legacy only). */
  keep?: string[];
  /** Closing physio nudges + advice, deduped. */
  advice?: string[];

  /**
   * TRUTH-GATE FIELDS (preferred — see verifiedCoachCommunication.ts).
   * The card renders these when present. They guarantee the athlete
   * never sees a claim ("Sub in: bike") that has no counterpart in the
   * visible program.
   *
   * appliedChanges — only items derived from the actual visible diff.
   * activeGuidance — restrictions the athlete must respect this week.
   * optionalAdvice — suggestions IF the athlete chooses to add work.
   * canSayProgramUpdated — gate for "program updated" / "I adjusted"
   *                         phrasing in any reply built from this card.
   */
  appliedChanges?: import('../utils/verifiedCoachCommunication').AppliedChange[];
  activeGuidance?: string[];
  optionalAdvice?: string[];
  canSayProgramUpdated?: boolean;
  unchangedReason?: string;
  /** ISO timestamp when the update was created. */
  createdAt: string;
  /** False when the athlete dismisses or the engine supersedes. */
  active: boolean;
}

/**
 * Multi-constraint model. Every active issue (injury, fatigue,
 * soreness, schedule, preference) becomes one ActiveConstraint entry.
 * The visible projection + Coach Update card derive from the array,
 * so adding a second injury never silently overwrites the first.
 */
export type ActiveConstraintType =
  | 'injury'
  | 'fatigue'
  | 'soreness'
  | 'schedule'
  | 'equipment'
  | 'missed_session'
  | 'preference';

export type ActiveConstraintModifierAffect =
  | 'current_day'
  | 'current_week'
  | 'future_generation';

export interface ActiveConstraintModifierMetadata {
  /** Canonical fact owners. Compatibility projections never publish upstream. */
  temporarySourceFactIds?: string[];
  /** Optional Coach Notes display override for this constraint. */
  modifierTitle?: string;
  /** Optional Coach Notes body override for this constraint. */
  modifierBody?: string;
  /** Program surfaces this modifier is currently changing. */
  modifierAffects?: ActiveConstraintModifierAffect[];
  /** Manual overrides that should be removed when this modifier clears. */
  linkedOverrideDates?: string[];
  /** ISO date after which this temporary constraint is no longer active. */
  expiresAt?: string;
  /** Optional Monday boundary for a future or current week-scoped modifier. */
  weekStartISO?: string;
  /** Ledger owner for reversible fixture/session projections. */
  reversibleAdjustmentId?: string;
  /** This record can be hidden without clearing any accepted program state. */
  presentationOnlyDismiss?: boolean;
}

export interface ActiveConstraintGameChangeProofRow {
  date: string;
  workoutName: string | null;
  workoutType: string | null;
  sessionTier?: string | null;
}

export interface ActiveConstraintNoteProof {
  kind: 'game_change';
  /** Unique projection identity. Accepted event history lives in the ledger. */
  lifecycleKey: string;
  changedDates: string[];
  after: ActiveConstraintGameChangeProofRow[];
}

function sharesGameChangePresentationSlot(
  left: ActiveConstraint,
  right: ActiveConstraint,
): boolean {
  const leftProjection = left as ActiveConstraint & {
    noteProof?: ActiveConstraintNoteProof;
    weekStartISO?: string;
  };
  const rightProjection = right as ActiveConstraint & {
    noteProof?: ActiveConstraintNoteProof;
    weekStartISO?: string;
  };
  return leftProjection.noteProof?.kind === 'game_change' &&
    rightProjection.noteProof?.kind === 'game_change' &&
    !!leftProjection.weekStartISO &&
    leftProjection.weekStartISO === rightProjection.weekStartISO;
}

export interface ActiveInjuryConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'injury';
  /** Canonical source-fact identity. Present for InjuryEpisodeV1 projections. */
  injuryEpisodeId?: string;
  bodyPart: string;
  bucket: InjuryState['bucket'];
  severity: number;
  /** Immediately-previous severity when improving — drives staged reintroduction. */
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  source?: 'coach' | 'uae' | 'tap' | 'guided_injury_flow';
  /**
   * `'other'` left THIS union with the menu row on 2026-08-21 (Sam) — no
   * installed base, so no stored constraint can carry it.
   *
   * ⚠ **IT IS STILL LEGAL FURTHER DOWN, AND THAT IS NOT AN OVERSIGHT.**
   * `GenerationInjuryRegion` keeps `'other'` because `inferRegion` still
   * returns it for a body part it cannot classify — and the ONBOARDING
   * injuries screen, which still has its own "Other area" free-text answer,
   * feeds exactly that path. Narrowing the generation side too was tried and
   * reverted: it broke two real assignment sites.
   */
  region?: 'upper_body' | 'lower_body' | 'back_midline';
  severityBand?: 'mild' | 'slight' | 'moderate' | 'avoid';
  adjustmentLevel?: 'minimal' | 'slight' | 'moderate' | 'avoid_affected' | 'training_paused';
  triggers?: string[];
  seriousSymptoms?: boolean;
  seriousSymptom?: string;
  rules: string[];
  /** Free-text bullets the card surfaces under "Keep". */
  safeFocus: string[];
  /** Free-text bullets the card surfaces under "Get a physio…" advice. */
  advice: string[];
}

export interface ActiveFatigueConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'fatigue';
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  /** Optional display override for derived constraints such as readiness chips. */
  reasonLabel?: string;
  /** Optional origin for derived/non-chat constraints. */
  source?: 'coach' | 'readiness' | 'tap' | 'system';
  /** Typed readiness reason for deterministic non-chat flows. Illness composes a
   *  fatigue-typed constraint (shared type, post-v1 cleanup pending), so it carries
   *  this discriminator to keep its coach-note attribution correct. */
  readinessKind?: 'poor_sleep' | 'illness';
  /** One poor night is day-scoped; repeated poor sleep is week-scoped. */
  readinessPattern?: 'single_night' | 'repeated';
  /** Optional single-day scope. If present, projection only applies on this date. */
  appliesToDate?: string;
  weekStartISO?: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

/**
 * Soreness — region-aware, milder than injury. The engine downscales
 * severity by 2 (see `buildSorenessConstraint`) so a 6/10 soreness is
 * roughly equivalent to a 4/10 injury — limits, not full blocks.
 */
export interface ActiveSorenessConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'soreness';
  /** Athlete-facing free-text — "quads", "calves", "shoulders". */
  bodyPart: string;
  /** Mapped to the engine's ConstraintRegion taxonomy. */
  bucket: InjuryState['bucket'];
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  reasonLabel?: string;
  source?: 'coach' | 'readiness' | 'tap';
  appliesToDate?: string;
  weekStartISO?: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

/**
 * Busy-week / schedule constraint — the athlete signalled limited
 * capacity for the current week. Severity drives how aggressively the
 * engine drops hard exposures (max effort, heavy lower, etc.).
 */
export interface ActiveScheduleConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'schedule';
  /** 1..10 — perceived capacity hit. Defaults to 5 (moderate). */
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  reasonLabel?: string;
  source?: 'coach' | 'readiness' | 'tap' | 'system';
  /** Acknowledged producer metadata for fixture-derived Coach Notes. */
  fixtureMutationSource?: FixtureMutationSourceMetadata;
  /** Trace root that owns fixture mutation plus this note projection. */
  fixtureMutationTraceId?: string;
  appliesToDate?: string;
  /** Optional Mon-Sun ISO of the affected week. */
  weekStartISO?: string;
  /** Visible proof used to suppress stale week-scoped Coach Notes. */
  noteProof?: ActiveConstraintNoteProof;
  /** Optional cap on total sessions for the week. */
  maxSessionsThisWeek?: number;
  /** Canonical compatibility projection of an exact temporary schedule fact. */
  scheduleKind?: 'unavailable_dates' | 'unavailable_weekdays' | 'busy_week' |
    'travel' | 'max_sessions' | 'time_cap' | 'team_night_move' | 'no_team_training';
  unavailableDates?: string[];
  unavailableWeekdays?: import('../types/domain').DayOfWeek[];
  /** `team_night_move` only: the dated pair the owning fact states. */
  teamNightFromDate?: string;
  teamNightToDate?: string;
  maxSessionMinutes?: number;
  timeCapDates?: string[];
  timeCapWeekdays?: import('../types/domain').DayOfWeek[];
  timeCapAllSessions?: boolean;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

export interface ActiveEquipmentConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'equipment';
  /** only = use only these tags plus bodyweight; without = subtract these tags. */
  mode: 'only' | 'without';
  tags: EquipmentTag[];
  /** Optional exact conditioning-machine subset for no-bike/no-row style limits. */
  conditioningModalities?: ConditioningEquipmentModality[];
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  source: 'tap' | 'chat' | 'system';
  reasonLabel?: string;
  /** Program surfaces this equipment modifier is changing. Required to avoid hidden effects. */
  modifierAffects: ActiveConstraintModifierAffect[];
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

/**
 * Missed-session constraint — informational. Surfaces a Coach Update
 * card so the athlete sees the missed day was acknowledged. Does not
 * mutate exposures by default; the coach reply explains what to keep
 * doing this week.
 */
export interface ActiveMissedSessionConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'missed_session';
  /** ISO date the athlete missed (or the team session). */
  missedDate?: string;
  /** Free-text label — "Tuesday Lower", "Field session", etc. */
  sessionName?: string;
  /** Always severity 0 — not an injury / soreness signal. */
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

export interface ActivePreferenceConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'preference';
  preferenceKind: 'avoid_exercise' | 'preferred_alternative' | 'add_focus';
  /** Athlete-facing label shown under Profile -> Coach Adjustments. */
  label: string;
  /** Canonical exercise name excluded from future generation, when relevant. */
  exercise?: string;
  /** Canonical preferred/pinned exercise name, when relevant. */
  alternative?: string;
  /** Human-readable focus bucket, such as "core" or "upper body". */
  focus?: string;
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

export type ActiveConstraint =
  | ActiveInjuryConstraint
  | ActiveFatigueConstraint
  | ActiveSorenessConstraint
  | ActiveScheduleConstraint
  | ActiveEquipmentConstraint
  | ActiveMissedSessionConstraint
  | ActivePreferenceConstraint;

const INJURY_MODIFIER_AFFECTS: ActiveConstraintModifierAffect[] = [
  'current_week',
  'future_generation',
];

const EQUIPMENT_MODIFIER_AFFECTS: ActiveConstraintModifierAffect[] = [
  'current_week',
  'future_generation',
];

function withDefaultModifierMetadata(c: ActiveConstraint): ActiveConstraint {
  if (c.type === 'equipment') {
    return {
      ...c,
      modifierAffects: Array.isArray(c.modifierAffects) && c.modifierAffects.length > 0
        ? [...c.modifierAffects]
        : [...EQUIPMENT_MODIFIER_AFFECTS],
    };
  }
  if (c.type !== 'injury') return c;
  return {
    ...c,
    modifierAffects: Array.isArray(c.modifierAffects) && c.modifierAffects.length > 0
      ? [...c.modifierAffects]
      : [...INJURY_MODIFIER_AFFECTS],
  };
}

interface CoachUpdatesState {
  /** weekStartISO → CoachUpdate. One per week. */
  updatesByWeek: Record<string, CoachUpdate>;

  /**
   * All active constraints — injuries / fatigue / soreness / etc.
   * The visible-program projection and the weekly Coach Update card
   * derive from this array. Multiple injuries are first-class.
   */
  activeConstraints: ActiveConstraint[];
  /** Presentation-only Coach Note dismissals. These never alter accepted
   * constraints or program surfaces. */
  dismissedCoachNoteIds: string[];
  dismissCoachNote: (noteId: string) => void;

  /** Upsert (creates a new entry or replaces the existing one for the same week). */
  upsertCoachUpdate: (
    weekStartISO: string,
    payload: Omit<CoachUpdate, 'id' | 'weekStartISO' | 'createdAt' | 'active'>,
  ) => CoachUpdate;

  /** Deactivate the entry for a week (keeps history; UI hides it). */
  deactivateCoachUpdate: (weekStartISO: string) => void;

  /** Wipe everything (used by tests + Settings → Reset). */
  clearAllCoachUpdates: () => void;

  // ─── Multi-constraint API ────────────────────────────────────────
  /** Add a new active constraint (or upsert by id). */
  upsertActiveConstraint: (constraint: ActiveConstraint) => void;
  /** Remove an active constraint by id. */
  removeActiveConstraint: (id: string) => void;
  /** Replace the entire active constraint set. */
  setActiveConstraints: (constraints: ActiveConstraint[]) => void;
}

let safetyProjectionInProgress = false;

export const COACH_UPDATES_PERSISTENCE_KEY = 'coach-updates';

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload carries the athlete's
 * material when any part of the record survives in it — one update card, one
 * active constraint. Unreadable bytes prove
 * nothing and answer no.
 */
registerQuarantineBoundary(COACH_UPDATES_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as {
        state?: {
          updatesByWeek?: Record<string, CoachUpdate>;
          activeConstraints?: ActiveConstraint[];
        };
      }).state;
      return Object.keys(state?.updatesByWeek ?? {}).length > 0
        || (state?.activeConstraints ?? []).length > 0;
    } catch {
      return false;
    }
  },
});

/**
 * The single persistence writer. A REFUSAL MUST NEVER PERSIST THE STATE IT
 * REFUSED INTO (Sam, 2026-07-30): while a refused material payload is held,
 * a bare payload does not travel; a material one always passes and releases
 * the hold. Exported for the ownership suite, which proves this store's
 * boundary rather than trusting the law's fixture cell.
 */
export const coachUpdatesGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: (name: string, value: string): Promise<void> =>
    // Not async — zustand voids this call; guardedDurableWrite returns the
    // base write's own (handled) promise. See refusedPayloadQuarantine.ts.
    guardedDurableWrite({
      storeKey: name,
      envelope: value,
      base: asyncStorageCompat,
      onRefused: (reason) => {
        emitAthleteActionEvent(beginAthleteActionTrace({
          source: 'system',
          actionType: 'program_change',
          route: 'coachUpdatesGuardedStorage.setItem',
        }, undefined, { forceRoot: true }), 'persistence_result', {
          persistenceOperation: 'write',
          persistenceStore: name,
          persistenceSucceeded: false,
          originalRejectionCode: reason,
          rejectingBoundary: 'coachUpdatesGuardedStorage.setItem.quarantine',
          failureCategory: 'persistence_failure',
        });
        logger.error('[coachUpdatesStore] refused to persist over a quarantined payload.',
          { store: name, reason: reason });
      },
    }),
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

function commitConstraintProgramTransaction(
  proposedConstraints: readonly ActiveConstraint[],
  commitConstraintState: () => void,
): void {
  const before = useCoachUpdatesStore.getState().activeConstraints;
  const beforeById = new Map(before.map((constraint) => [constraint.id, constraint]));
  const proposedById = new Map(proposedConstraints.map((constraint) => [constraint.id, constraint]));
  const added = proposedConstraints.filter((constraint) => !beforeById.has(constraint.id));
  const removed = before.filter((constraint) => !proposedById.has(constraint.id));
  const representative = added[0] ?? removed[0] ?? proposedConstraints[0] ?? before[0];
  const sourceValue = 'source' in (representative ?? {})
    ? (representative as { source?: string }).source
    : undefined;
  const source: AthleteActionSource = sourceValue === 'coach' || sourceValue === 'chat'
    ? 'coach'
    : sourceValue === 'system' || sourceValue === 'readiness' || sourceValue === 'uae'
      ? 'system'
      : 'tap';
  const actionType: AthleteActionType = representative?.type === 'injury'
    ? 'injury_change'
    : representative?.type === 'equipment'
      ? 'equipment_change'
      : representative?.type === 'fatigue' || representative?.type === 'soreness'
        ? 'readiness_change'
        : removed.length > 0 && added.length === 0
          ? 'clear_adjustment'
          : 'program_change';
  const targetDate = representative && 'appliesToDate' in representative
    ? representative.appliesToDate
    : representative?.startDate;
  const trace = beginAthleteActionTrace({
    source,
    actionType,
    route: 'constraint_program_transaction',
    targetDate,
    sessionDate: targetDate,
    scope: representative && 'weekStartISO' in representative && representative.weekStartISO
      ? 'week'
      : targetDate ? 'date' : 'program',
  });
  runWithAthleteActionTrace(trace, () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: 'active_constraint_change',
      constraintTypesAdded: added.map((constraint) => constraint.type),
      constraintTypesRemoved: removed.map((constraint) => constraint.type),
      constraintIdsAdded: added.map((constraint) => constraint.id),
      constraintIdsRemoved: removed.map((constraint) => constraint.id),
      beforeConstraintHash: athleteActionDiagnosticHash(before.map((constraint) => ({
        id: constraint.id,
        type: constraint.type,
        status: constraint.status,
      }))),
    });
    for (const constraint of added) {
      emitAthleteActionEvent(trace, 'mutation_constraint_created', {
        constraintId: constraint.id,
        constraintType: constraint.type,
        constraintStatus: constraint.status,
        appliesToDate: 'appliesToDate' in constraint ? constraint.appliesToDate ?? null : null,
        weekId: 'weekStartISO' in constraint ? constraint.weekStartISO ?? null : null,
        provenanceIdentity: `${constraint.type}:${constraint.id}`,
      });
    }
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: 'accepted_constraint_projection',
      producer: 'commitConstraintProgramTransaction',
    });
    safetyProjectionInProgress = true;
    try {
      // ⚠ THE SAFETY RE-PROJECTION IS DELETED (demolition area 1, 2026-08-19).
      //
      // `stageLiveStoredProgramSafety` re-ran the whole rewriting boundary over
      // EVERY persisted program surface — program, microcycle, today, every
      // date override, every overlay — and committed the rewritten result. A
      // constraint the athlete stated silently re-authored weeks they had
      // already accepted. That is post-acceptance repair, and the accepted-state
      // transaction owns writes.
      //
      // WHAT STAYS IS THE FACT: the constraint itself is still committed. What
      // is missing is any re-shaping of already-accepted weeks in response to
      // it — recorded on the rebuild list, owner = the composer at rebuild.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./acceptedStateTransaction').commitAcceptedStateTransaction({
      // Constraints are what an athlete just told the app about their body or
      // their week. The gate informs; it does not veto a fact (§18 D3).
      operation: 'forward_decision',
      reason: 'constraint:update',
      activeConstraints: [...proposedConstraints],
      });
      // The commit is a write of accepted truth, and it may legitimately
      // empty the store (the last constraint resolved, clearAll). It runs
      // under a reset act so the door admits and NAMES it — the calendar
      // transaction precedent (recipe lesson 1: the write happens deep
      // inside the commit, so the door falls back to the act in flight).
      {
        const resetActionId = beginCoachUpdatesResetAction('constraint_transaction_commit');
        try {
          commitConstraintState();
        } finally {
          endCoachUpdatesResetAction(resetActionId);
        }
      }
      emitAthleteActionEvent(trace, 'athlete_action_completed', {
        outcome: 'constraint_state_committed',
        internalResultCode: 'constraint_update_accepted',
        activeConstraintCountBefore: before.length,
        activeConstraintCountAfter: proposedConstraints.length,
        afterConstraintHash: athleteActionDiagnosticHash(proposedConstraints.map((constraint) => ({
          id: constraint.id,
          type: constraint.type,
          status: constraint.status,
        }))),
      });
    } catch (error) {
      const rejectionCode = athleteActionErrorCode(error, 'constraint_update_unknown_error');
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'threw',
        internalResultCode: 'constraint_update_failed',
        originalRejectionCode: rejectionCode,
        rejectionCodes: [rejectionCode],
        firstFailingBoundary: 'commitConstraintProgramTransaction',
        failureCategory: classifyAthleteActionFailure(rejectionCode, 'constraint'),
        validCandidateExisted: false,
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
      throw error;
    } finally {
      safetyProjectionInProgress = false;
    }
  });
}

function hasCanonicalInjuryOwnership(): boolean {
  // Lazy access avoids the store initialisation cycle. Once any episode has
  // migrated, legacy aliases are projections only and may not mutate it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const context = require('./programStore').useProgramStore.getState()
    .acceptedMaterialContext;
  return Array.isArray(context?.injuryEpisodes) && context.injuryEpisodes.length > 0;
}

function hasCanonicalTemporaryFactOwnership(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const context = require('./programStore').useProgramStore.getState()
    .acceptedMaterialContext;
  return Array.isArray(context?.temporarySourceFacts) && context.temporarySourceFacts.length > 0;
}

function hasCanonicalAcceptedEnvelope(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const context = require('./programStore').useProgramStore.getState()
    .acceptedMaterialContext;
  return typeof context?.revision === 'number' && context.revision > 0;
}

function isFixtureMutationProjection(
  constraint: ActiveConstraint | undefined,
): constraint is ActiveScheduleConstraint {
  return constraint?.type === 'schedule' &&
    constraint.noteProof?.kind === 'game_change';
}

function canonicalTemporaryFactCompatibilityConstraints(): ActiveConstraint[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const context = normalizeAcceptedMaterialContext(
    require('./programStore').useProgramStore.getState().acceptedMaterialContext,
  );
  return context.activeConstraints.filter((constraint) =>
    (constraint.temporarySourceFactIds?.length ?? 0) > 0 ||
    (constraint.type === 'injury' && !!constraint.injuryEpisodeId));
}

function canonicalInjuryCompatibilityConstraints(): ActiveInjuryConstraint[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const context = normalizeAcceptedMaterialContext(
    require('./programStore').useProgramStore.getState().acceptedMaterialContext,
  );
  return context.activeConstraints.filter(
    (constraint): constraint is ActiveInjuryConstraint => constraint.type === 'injury',
  );
}

export const useCoachUpdatesStore = create<CoachUpdatesState>()(
  persist(
    (set, get) => ({
      updatesByWeek: {},
      activeConstraints: [],
      dismissedCoachNoteIds: [],
      dismissCoachNote: (noteId) => set((state) => ({
        dismissedCoachNoteIds: state.dismissedCoachNoteIds.includes(noteId)
          ? state.dismissedCoachNoteIds
          : [...state.dismissedCoachNoteIds, noteId],
      })),

      upsertCoachUpdate: (weekStartISO, payload) => {
        // Composite id: timestamp + random suffix so two upserts in the
        // same millisecond (back-to-back tests / fast user input) still
        // produce distinct ids.
        const suffix = Math.random().toString(36).slice(2, 8);
        const update: CoachUpdate = {
          id: `cu-${weekStartISO}-${Date.now()}-${suffix}`,
          weekStartISO,
          source: payload.source,
          reason: payload.reason,
          rules: [...payload.rules],
          changes: [...payload.changes],
          // Optional next-week constraint-projection bullets. Cloned
          // for store-immutability; absent → field is omitted.
          ...(payload.nextWeekChanges
            ? { nextWeekChanges: [...payload.nextWeekChanges] }
            : {}),
          ...(payload.avoid ? { avoid: [...payload.avoid] } : {}),
          ...(payload.substituteWith ? { substituteWith: [...payload.substituteWith] } : {}),
          ...(payload.keep ? { keep: [...payload.keep] } : {}),
          ...(payload.advice ? { advice: [...payload.advice] } : {}),
          createdAt: new Date().toISOString(),
          active: true,
        };
        applyCoachUpdatesWrite({
          next: { updatesByWeek: { ...get().updatesByWeek, [weekStartISO]: update } },
          writer: 'update_card',
        });
        return update;
      },

      deactivateCoachUpdate: (weekStartISO) => {
        const existing = get().updatesByWeek[weekStartISO];
        if (!existing) return;
        applyCoachUpdatesWrite({
          next: {
            updatesByWeek: {
              ...get().updatesByWeek,
              [weekStartISO]: { ...existing, active: false },
            },
          },
          writer: 'update_card',
        });
      },

      clearAllCoachUpdates: () =>
        commitConstraintProgramTransaction(
          hasCanonicalTemporaryFactOwnership()
            ? canonicalTemporaryFactCompatibilityConstraints()
            : canonicalInjuryCompatibilityConstraints(),
          () =>
          applyCoachUpdatesWrite({
            next: {
              updatesByWeek: {},
              activeConstraints: hasCanonicalTemporaryFactOwnership()
                ? canonicalTemporaryFactCompatibilityConstraints()
                : canonicalInjuryCompatibilityConstraints(),
              dismissedCoachNoteIds: [],
            },
            writer: 'reset',
          })),

      upsertActiveConstraint: (c) => {
        if (c.type === 'injury' && hasCanonicalInjuryOwnership()) return;
        if (c.type === 'fatigue' || c.type === 'soreness' ||
          ((c.type === 'equipment' || c.type === 'schedule') &&
            hasCanonicalAcceptedEnvelope() &&
            !isFixtureMutationProjection(c))) {
          const accepted = normalizeAcceptedMaterialContext(
            require('./programStore').useProgramStore.getState().acceptedMaterialContext,
          );
          if (accepted.revision > 0 || accepted.temporarySourceFacts.length > 0) {
            publishAcceptedCoachUpdatesCompatibilityMirror({
              activeConstraints: accepted.activeConstraints,
            });
          }
          return;
        }
        const nextConstraint = withDefaultModifierMetadata(c);
        const filtered = get().activeConstraints.filter((x) =>
          x.id !== nextConstraint.id &&
          !sharesGameChangePresentationSlot(x, nextConstraint));
        const nextConstraints = [...filtered, nextConstraint];
        commitConstraintProgramTransaction(nextConstraints, () =>
          applyCoachUpdatesWrite({
            next: { activeConstraints: nextConstraints },
            writer: 'constraint_transaction',
          }));
      },

      removeActiveConstraint: (id) => {
        const removed = get().activeConstraints.find((c) => c.id === id);
        if (removed?.type === 'injury' && hasCanonicalInjuryOwnership()) return;
        if (removed?.type === 'fatigue' || removed?.type === 'soreness' ||
          ((removed?.type === 'equipment' || removed?.type === 'schedule') &&
            hasCanonicalAcceptedEnvelope() &&
            !isFixtureMutationProjection(removed))) {
          const accepted = normalizeAcceptedMaterialContext(
            require('./programStore').useProgramStore.getState().acceptedMaterialContext,
          );
          if (accepted.revision > 0 || accepted.temporarySourceFacts.length > 0) {
            publishAcceptedCoachUpdatesCompatibilityMirror({
              activeConstraints: accepted.activeConstraints,
            });
          }
          return;
        }
        const remaining = get().activeConstraints.filter((c) => c.id !== id);
        commitConstraintProgramTransaction(remaining, () =>
          applyCoachUpdatesWrite({
            next: { activeConstraints: remaining },
            writer: 'constraint_transaction',
          }));
      },

      setActiveConstraints: (constraints) => {
        const requested = constraints.map(withDefaultModifierMetadata)
          .filter((constraint) => constraint.type !== 'fatigue' && constraint.type !== 'soreness');
        const factCompatibility = canonicalTemporaryFactCompatibilityConstraints();
        const nextConstraints = hasCanonicalTemporaryFactOwnership()
          ? [...requested.filter((constraint) =>
              !(constraint.type === 'injury' && constraint.injuryEpisodeId)), ...factCompatibility]
          : hasCanonicalInjuryOwnership()
          ? [
              ...requested.filter((constraint) => constraint.type !== 'injury'),
              ...canonicalInjuryCompatibilityConstraints(),
            ]
          : requested;
        commitConstraintProgramTransaction(nextConstraints, () =>
          applyCoachUpdatesWrite({
            next: { activeConstraints: [...nextConstraints] },
            writer: 'constraint_transaction',
          }));
      },

    }),
    {
      name: COACH_UPDATES_PERSISTENCE_KEY,
      storage: createJSONStorage(() => coachUpdatesGuardedStorage),
      merge: (persisted, current) => {
        const incoming = (persisted as Partial<CoachUpdatesState> | undefined) ?? {};
        const context = normalizeAcceptedMaterialContext({
          activeConstraints: incoming.activeConstraints,
        });
        return {
          ...current,
          ...incoming,
          updatesByWeek: normalizeAcceptedKeyedMap<CoachUpdate>(incoming.updatesByWeek),
          activeConstraints: context.activeConstraints,
          dismissedCoachNoteIds: Array.isArray(incoming.dismissedCoachNoteIds)
            ? Array.from(new Set(incoming.dismissedCoachNoteIds.filter((id): id is string =>
                typeof id === 'string')))
            : [],
        };
      },
    },
  ),
);

/**
 * Both mirror writers project state that is authoritative UPSTREAM of this
 * store — the accepted context, or the pre-transaction snapshot a rollback
 * restores — and either may legitimately be empty. Each therefore writes
 * through the door under its named reset act (recipe lesson 2: a rollback
 * restore is a legitimate erasure, under a reset act), with the projection
 * flag held so the constraint subscriber does not re-enter.
 */
function setCoachUpdatesCompatibilityMirror(
  patch: CoachUpdatesMaterialPatch,
  writer: CoachUpdatesWriterId,
  resetSource: string,
): void {
  const alreadyProjecting = safetyProjectionInProgress;
  safetyProjectionInProgress = true;
  const resetActionId = beginCoachUpdatesResetAction(resetSource);
  try {
    applyCoachUpdatesWrite({ next: patch, writer, resetActionId });
  } finally {
    endCoachUpdatesResetAction(resetActionId);
    safetyProjectionInProgress = alreadyProjecting;
  }
}

/** Accepted ProgramStore context is authoritative; this updates the
 * compatibility read model without starting a second program transaction. */
export function publishAcceptedCoachUpdatesCompatibilityMirror(args: {
  activeConstraints: ActiveConstraint[];
}): void {
  setCoachUpdatesCompatibilityMirror(args, 'accepted_mirror', 'accepted_mirror_publish');
}

/** Exact transaction rollback mirror restore. */
export function restoreCoachUpdatesCompatibilityMirror(args: {
  updatesByWeek: Record<string, CoachUpdate>;
  activeConstraints: ActiveConstraint[];
  dismissedCoachNoteIds: string[];
}): void {
  setCoachUpdatesCompatibilityMirror(args, 'coach_mutation_mirror', 'coach_mutation_rollback');
}

useCoachUpdatesStore.subscribe((state, previous) => {
  if (state.activeConstraints === previous.activeConstraints || safetyProjectionInProgress) return;
  // ProgramStore episodes win hydration order. A stale persisted alias or
  // CoachUpdates constraint can update the compatibility view only by being
  // replaced with the projection of the durable episode history.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const accepted = normalizeAcceptedMaterialContext(
    require('./programStore').useProgramStore.getState().acceptedMaterialContext,
  );
  if (accepted.revision > 0 || accepted.temporarySourceFacts.length > 0) {
    publishAcceptedCoachUpdatesCompatibilityMirror({
      activeConstraints: accepted.activeConstraints,
    });
    return;
  }
  // Revision zero is a legacy envelope. ProgramStore is the sole migration
  // owner and may consume this mirror when it hydrates; this store never
  // publishes constraints upstream or mutates accepted programming.
});

/**
 * Read helper used by HomeScreen. Returns null when no entry exists
 * for the week OR when the entry is inactive — both are "don't render".
 */
export function getActiveCoachUpdate(weekStartISO: string): CoachUpdate | null {
  const update = useCoachUpdatesStore.getState().updatesByWeek[weekStartISO];
  if (!update || !update.active) return null;
  return update;
}

/* ══ THE COACH UPDATES WRITE OWNER ══
 *
 * The profile door's shape (`applyProfileOnboardingWrite`), applied by recipe
 * (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`):
 *
 *   1. ONE DOOR. Every write of the material slices — update cards, active
 *      constraints — goes through here. The
 *      card actions, the constraint-transaction commits, the accepted mirror
 *      publish and the rollback restore are its writers, not exceptions.
 *   2. THE DEFAULT IS NOT A VALUE. A patch whose EFFECTIVE result is the
 *      bare default (no cards, no constraints, no injury) over material
 *      state is refused, unless a reset action is IN FLIGHT. A REDUCED
 *      state is not the wipe — a resolved injury legitimately empties the
 *      constraint list, and refusing reduction would refuse the athlete.
 *   3. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *      Writers inside the constraint transaction may not know the act that
 *      opened them, so the door falls back to the act currently in flight.
 *   4. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the material counts either side. Counts only — a card's
 *      reason, a rule, a body part and any date are answers, and answers
 *      never leave the device.
 */

export type CoachUpdatesWriterId =
  | 'update_card'
  | 'constraint_transaction'
  | 'accepted_mirror'
  | 'coach_mutation_mirror'
  | 'reset';

/**
 * A PARTIAL patch: only the keys a writer carries are written, because the
 * accepted mirror publishes constraints WITHOUT touching the cards. The
 * wipe decision is made on the EFFECTIVE state (patch over current).
 * `dismissedCoachNoteIds` is a NON-MATERIAL rider — presentation-only
 * dismissals travel with a rollback restore but never count toward the
 * wipe decision.
 */
export interface CoachUpdatesMaterialPatch {
  updatesByWeek?: Record<string, CoachUpdate>;
  activeConstraints?: ActiveConstraint[];
  dismissedCoachNoteIds?: string[];
}

export interface CoachUpdatesWriteOutcome {
  ok: boolean;
  reason?: 'default_over_answered_updates' | 'reset_action_not_in_flight';
}

const resetActionsInFlight = new Set<string>();
let nextResetActionId = 1;

/**
 * Open a reset. The id is only good while the reset is running, which is what
 * makes a deferred write belonging to a finished reset refusable.
 */
export function beginCoachUpdatesResetAction(source: string): string {
  const id = `coach-updates-reset:${source}:${nextResetActionId++}`;
  resetActionsInFlight.add(id);
  return id;
}

export function endCoachUpdatesResetAction(id: string): void {
  resetActionsInFlight.delete(id);
}

/** The reset act currently in flight, if exactly one writer opened it. */
function activeCoachUpdatesResetActionId(): string | undefined {
  for (const id of resetActionsInFlight) return id;
  return undefined;
}

function materialCounts(state: {
  updatesByWeek: Record<string, CoachUpdate>;
  activeConstraints: ActiveConstraint[];
}): { updates: number; constraints: number } {
  return {
    updates: Object.keys(state.updatesByWeek).length,
    constraints: state.activeConstraints.length,
  };
}

export function applyCoachUpdatesWrite(args: {
  next: CoachUpdatesMaterialPatch;
  writer: CoachUpdatesWriterId;
  resetActionId?: string;
}): CoachUpdatesWriteOutcome {
  const current = useCoachUpdatesStore.getState();
  const before = materialCounts(current);
  const record = (outcome: 'applied' | 'refused', reason?: string, resetActionId?: string) => {
    const after = materialCounts(useCoachUpdatesStore.getState());
    emitAthleteActionEvent(beginAthleteActionTrace({
      source: args.writer === 'update_card' ? 'coach' : 'system',
      actionType: 'program_change',
      route: 'applyCoachUpdatesWrite',
    }, undefined, { forceRoot: true }), 'coach_updates_write', {
      writer: args.writer,
      outcome,
      updateCountBefore: before.updates,
      updateCountAfter: after.updates,
      constraintCountBefore: before.constraints,
      constraintCountAfter: after.constraints,
      ...(reason ? { internalResultCode: reason } : {}),
      ...(resetActionId ? { resetActionId } : {}),
    });
  };

  const effective = materialCounts({
    updatesByWeek: args.next.updatesByWeek ?? current.updatesByWeek,
    activeConstraints: args.next.activeConstraints ?? current.activeConstraints,
  });
  const nextIsTheDefault = effective.updates + effective.constraints === 0;
  const beforeIsMaterial = before.updates + before.constraints > 0;
  const effectiveResetActionId = args.resetActionId ?? activeCoachUpdatesResetActionId();
  if (nextIsTheDefault && beforeIsMaterial) {
    if (!effectiveResetActionId) {
      quarantineDiskCopyBestEffort();
      record('refused', 'default_over_answered_updates');
      return { ok: false, reason: 'default_over_answered_updates' };
    }
    if (!resetActionsInFlight.has(effectiveResetActionId)) {
      quarantineDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  const patch: Partial<CoachUpdatesState> = {};
  if (args.next.updatesByWeek !== undefined) patch.updatesByWeek = args.next.updatesByWeek;
  if (args.next.activeConstraints !== undefined) {
    patch.activeConstraints = args.next.activeConstraints;
  }
  if (args.next.dismissedCoachNoteIds !== undefined) {
    patch.dismissedCoachNoteIds = args.next.dismissedCoachNoteIds;
  }
  useCoachUpdatesStore.setState(patch);
  record('applied', undefined, effectiveResetActionId);
  return { ok: true };
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 */
function quarantineDiskCopyBestEffort(): void {
  void asyncStorageCompat.getItem(COACH_UPDATES_PERSISTENCE_KEY)
    .then((envelope) => quarantineRefusedPayload(COACH_UPDATES_PERSISTENCE_KEY, envelope))
    .catch(() => {});
}
