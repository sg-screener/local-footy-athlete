/**
 * THE ATHLETE TAP DOOR'S ACTION VOCABULARY — declared where the LEDGER can see it.
 *
 * This union lived in `utils/programControlActions.ts` beside the executor that
 * consumes it, which was the right home until the ledger learned to record it.
 *
 * WHY IT MOVED, and the reason is a measurement rather than a preference.
 * `docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md` §5 rules that the ledger
 * records the door's vocabulary VERBATIM — `{ kind: 'program_control'; action }`
 * — so `types/decisionLedger.ts` must name this type. Importing it from the
 * executor closed a module cycle (`programControlActions` -> `planChangeProducer`
 * -> `decisionLedgerStore` -> `types/decisionLedger` -> `programControlActions`),
 * and that cycle was not harmless: `tsc -p tsconfig.devtools.json` reported FOUR
 * errors in the executor, none of them at the edit — three
 * `Property 'factId' does not exist on type 'TemporarySourceFact'` and a union
 * assignment, at :1265-:1300. A type guard's narrowing degraded because the
 * module's own exports were unresolved while it was being checked. The errors
 * were REAL as reported and FALSE as diagnoses: they named a narrowing that is
 * correct, in code nobody had touched.
 *
 * The two ways out were to weaken the ledger kind to `action: unknown` — giving
 * up the entire claim the kind exists to make, that the decision IS the action,
 * checked by the compiler — or to move the declaration somewhere both sides can
 * reach. A TYPE with two consumers belongs below both of them, which is L14's
 * domain-purity rule arriving at a file rather than a function.
 *
 * THE LAW THIS MODULE LIVES UNDER, stated precisely rather than tidily. It is
 * NOT "imports no store" — it imports `ActiveInjuryConstraint` from
 * `store/coachUpdatesStore`, because that is where the type is declared. The
 * law is narrower and it is the one that actually matters:
 *
 *   **every import here is `import type`, and none of them reaches
 *   `types/decisionLedger` back.**
 *
 * A value import would put a store on the ledger type's own load path; a type
 * import is erased and cannot. `programControlDecisionTests` pins both halves,
 * because "it is a leaf" is a claim about the whole transitive graph and a
 * comment cannot check itself.
 *
 * `utils/programControlActions.ts` re-exports every name below, so no caller
 * moved and no import path changed.
 */

import type { WorkoutExercise, ConditioningEquipmentModality } from './domain';
import type {
  PlanChange,
  PlanChangeCategoryId,
  PlanChangeMoveScopeId,
  PlanChangeBinScopeId,
  TeamNightMoveRouteId,
} from '../utils/planChangeTypes';
import type { EquipmentTag } from '../data/exercisePools';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import type { TapRecoveryModifierScope } from '../utils/tapProgramModifiers';
import type { PoorSleepPattern } from '../utils/readinessConstraints';
import type { IllnessSeverityTier } from '../rules/readinessIllnessLaw';

export type ProgramControlActionType =
  | 'swap_session'
  | 'add_to_day'
  | 'move_session'
  | 'move_team_night'
  | 'bin_session'
  | 'swap_exercise'
  | 'add_exercise'
  | 'remove_exercise'
  | 'set_recovery_mode'
  | 'clear_recovery_mode'
  | 'set_fatigue_status'
  | 'set_poor_sleep_status'
  | 'set_illness_status'
  | 'clear_fatigue_status'
  | 'set_injury_modifier'
  | 'clear_injury_modifier'
  | 'set_equipment_modifier'
  | 'set_schedule_modifier'
  | 'update_lfa_days'
  | 'update_team_training_days'
  | 'update_game_day'
  | 'update_season_phase'
  | 'update_program_setup'
  | 'add_exercise_preference'
  | 'clear_exercise_preference'
  | 'clear_active_modifier';

export type ProgramControlScope =
  | 'today_only'
  | 'current_week'
  | 'future_weeks'
  | 'current_and_future';

export type ProgramControlScreen =
  | 'program_tab'
  | 'session_detail'
  | 'profile'
  | 'coach_notes'
  /**
   * THE REBUILT COACH TAB (slice 3, 2026-08-10).
   *
   * Added because the ledger records this action VERBATIM, so `source.screen` is
   * where a decision's authorship is written down. Without it a change the coach
   * proposed and the athlete confirmed would land on the ledger indistinguishable
   * from a tap on the Program tab — and "who authored this decision" is a
   * question undo, replay and the parked coach-provenance item all need to ask.
   *
   * It is `coach_tab` and not `coach`: `coach_notes` above is the FROZEN beta
   * surface's id (LR-6), and one word between them is what stops a census of
   * coach-authored decisions from counting the old pipeline's writes as the new
   * one's.
   */
  | 'coach_tab'
  | 'setup'
  | 'system'
  | 'test';

export interface ProgramControlActionSource {
  screen: ProgramControlScreen;
  surface?: string;
  initiatedBy?: 'tap' | 'system' | 'test';
}

interface ProgramControlActionBase<TType extends ProgramControlActionType, TPayload> {
  type: TType;
  source: ProgramControlActionSource;
  payload: TPayload;
  scope?: ProgramControlScope;
  requiresRebuild: boolean;
  createsActiveModifier: boolean;
  oneOffOnly: boolean;
}

interface SessionCategoryPayload {
  date: string;
  category?: PlanChangeCategoryId;
  templateId?: string;
}

interface ExercisePrescriptionPayload {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  weight?: number;
  notes?: string;
  prescriptionType?: WorkoutExercise['prescriptionType'];
  perSide?: boolean;
  restSeconds?: number;
}

export type ProgramControlAction =
  | ProgramControlActionBase<'swap_session', SessionCategoryPayload>
  | ProgramControlActionBase<'add_to_day', SessionCategoryPayload>
  // `scope` is the COMPONENT the athlete chose to move ("just the gym
  // session"), and it had nowhere to live here. The sheet offers the choice,
  // this payload could not express it, and `planChangeForAction` therefore
  // built a whole-day move — which is what travelled. Note this is a different
  // axis from `ProgramControlActionBase.scope` ('today_only'), which is about
  // recurrence; two different meanings of the word, one of which was missing.
  | ProgramControlActionBase<'move_session', {
      fromDate: string;
      toDate: string;
      scope?: PlanChangeMoveScopeId;
    }>
  /**
   * A team night leaving its day, WITH the athlete's answer to the typed ask
   * (Sam, signed 2026-08-02). `this_week_only` = a dated `team_night_move`
   * schedule fact through the deriving lane; `permanent` = a
   * `teamTrainingDays` answer through the ONE setup owner
   * (`commitProfileProgramTransaction`), confirmed inline — never a second
   * writer. A routeless change never reaches this door: the producer's
   * preview raises the ask instead.
   */
  | ProgramControlActionBase<'move_team_night', {
      fromDate: string;
      toDate: string;
      todayISO?: string;
      route: TeamNightMoveRouteId;
    }>
  | ProgramControlActionBase<'bin_session', { date: string; scope?: PlanChangeBinScopeId }>
  | ProgramControlActionBase<'swap_exercise', {
      date: string;
      fromExercise: string;
      fromExerciseId?: string;
      toExercise?: ExercisePrescriptionPayload;
      futureWeeksToo?: boolean;
    }>
  | ProgramControlActionBase<'add_exercise', {
      date: string;
      exercise?: ExercisePrescriptionPayload;
      futureWeeksToo?: boolean;
    }>
  | ProgramControlActionBase<'remove_exercise', {
      date: string;
      exercise: string;
      exerciseId?: string;
      futureWeeksToo?: boolean;
    }>
  | ProgramControlActionBase<'set_recovery_mode', {
      date: string;
      todayISO?: string;
      appliedDates?: string[];
      recoveryScope: TapRecoveryModifierScope;
      planChange?: PlanChange;
    }>
  | ProgramControlActionBase<'clear_recovery_mode', { noteId?: string; modifierId?: string }>
  | ProgramControlActionBase<'set_fatigue_status', {
      date: string;
      todayISO?: string;
      level: 'spark' | 'cooked' | 'low_energy' | 'not_right' | 'sore' | 'worse';
    }>
  | ProgramControlActionBase<'set_poor_sleep_status', {
      date: string;
      todayISO?: string;
      pattern: PoorSleepPattern;
    }>
  | ProgramControlActionBase<'set_illness_status', {
      date: string;
      todayISO?: string;
      severity: IllnessSeverityTier;
    }>
  | ProgramControlActionBase<'clear_fatigue_status', { noteId?: string; modifierId?: string; date?: string }>
  | ProgramControlActionBase<'set_injury_modifier', { constraint?: ActiveInjuryConstraint }>
  | ProgramControlActionBase<'clear_injury_modifier', {
      noteId?: string;
      modifierId?: string;
      episodeId?: string;
    }>
  | ProgramControlActionBase<'set_equipment_modifier', {
      /**
       * The athlete's decision, expressed against their OWN kit (Sam's ruling
       * 5, 2026-07-31): which of their items are missing this week, or that
       * everything is available again. The seven unsigned presets are retired.
       */
      decision:
        | {
            kind: 'missing_this_week';
            tags: readonly EquipmentTag[];
            conditioningModalities: readonly ConditioningEquipmentModality[];
          }
        | { kind: 'available_again' };
      date: string;
      todayISO?: string;
    }>
  /**
   * FOUR FIELDS LEFT THIS PAYLOAD ON 2026-07-31, unread by anybody.
   *
   * `severity`, `reasonLabel`, `modifierTitle` and `modifierBody` were passed by
   * every caller and consumed by none: the durable executor builds a
   * `TemporaryScheduleFact` from `scheduleKind` alone, and `scheduleProjection`
   * (`rules/temporarySourceFact.ts`) derives the severity, the reason label and
   * both modifier sentences from the FACT. A request field that no owner reads
   * is a second, silent opinion about the same decision — it looked like the
   * busy tap chose its own severity and its own words, and it never did.
   *
   * What the athlete actually decides is: WHICH schedule fact (busy vs away vs a
   * bounded maximum), on WHICH horizon (`ProgramControlActionBase.scope`), over
   * WHICH dates. That is the whole input, and it is what remains.
   */
  | ProgramControlActionBase<'set_schedule_modifier', {
      date: string;
      todayISO?: string;
      maxSessionsThisWeek?: number;
      /** Away / holiday dates. The durable executor stores them as schedule
       *  facts; it never creates fact-owned Rest overrides. */
      planChange?: PlanChange;
    }>
  | ProgramControlActionBase<'update_lfa_days', Record<string, unknown>>
  | ProgramControlActionBase<'update_team_training_days', Record<string, unknown>>
  | ProgramControlActionBase<'update_game_day', Record<string, unknown>>
  | ProgramControlActionBase<'update_season_phase', Record<string, unknown>>
  | ProgramControlActionBase<'update_program_setup', Record<string, unknown>>
  | ProgramControlActionBase<'add_exercise_preference', {
      exercise: string;
      alternative?: string;
      focus?: string;
      preferenceKind: 'avoid_exercise' | 'preferred_alternative' | 'add_focus';
    }>
  | ProgramControlActionBase<'clear_exercise_preference', { noteId?: string; modifierId?: string }>
  | ProgramControlActionBase<'clear_active_modifier', { noteId?: string; modifierId?: string }>;
