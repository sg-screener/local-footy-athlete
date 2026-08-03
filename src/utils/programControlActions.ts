import { applyProgramOverrideWrite, useProgramStore } from '../store/programStore';
import {
  useCoachUpdatesStore,
  type ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useProfileStore } from '../store/profileStore';
import type { OverrideContext, Workout, WorkoutExercise } from '../types/domain';
import { getMondayForDate, type ResolvedDay } from './sessionResolver';
import {
  applyPlanChange,
  planChangeResultIsLandingAsk,
  type PlanChangeOutcome,
  previewPlanChangeRisk,
  type PlanChange,
  type PlanChangeBinScopeId,
  type PlanChangeMoveScopeId,
  type PlanChangeCategoryId,
} from './planChangeProducer';
import type { TeamNightMoveRouteId } from './planChangeTypes';
import { athleteSafeRefusal } from './planChangeRefusalCopy';
import { buildCoachNotesFromModifiers, clearActiveCoachNote } from './activeCoachNotes';
import { getActiveProgramModifiers } from './activeProgramModifiers';
import {
  banExerciseGlobally,
  setPreferredAlternative,
  replaceExerciseAtDate,
  removeExerciseAtDate,
  addExerciseAtDate,
  pinExerciseGlobally,
} from './coachActions';
import {
  upsertTapRecoveryModeModifier,
  recoveryModeModifierIdForDate,
  withActiveProgramModifierContext,
  type TapRecoveryModifierScope,
} from './tapProgramModifiers';
import type { EquipmentTag } from '../data/exercisePools';
import type { ConditioningEquipmentModality } from '../types/domain';
import {
  assessTapSwapCandidateSafety,
  resolveTapSwapEnvironment,
} from './tapSwapHierarchy';
import type { PoorSleepPattern } from './readinessConstraints';
import type { IllnessSeverityTier } from '../rules/readinessIllnessLaw';
import {
  athleteActionDiagnosticHash,
  athleteActionDiagnosticsEnabled,
  athleteActionTerminalReasonChain,
  beginAthleteActionTrace,
  classifyAthleteActionFailure,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionSource,
  type AthleteActionType,
} from './athleteActionDiagnostics';
import { runCoachMutationTransaction } from '../store/coachMutationTransaction';
import {
  createOrUpdateInjuryEpisode,
  resolveInjuryEpisode,
} from '../store/injuryEpisodeTransaction';
import {
  createTemporaryFatigueFact,
  createTemporaryIllnessFact,
  createTemporaryEquipmentFact,
  createTemporaryPoorSleepFact,
  createTemporaryScheduleFact,
  createTemporarySorenessFact,
  createTemporaryTimeCapFact,
  isTemporaryEquipmentFact,
  isInjurySourceFact,
  isNonInjuryTemporarySourceFact,
  temporaryFactScope,
  temporarySourceFactId,
  type TemporarySourceFactScope,
} from '../rules/temporarySourceFact';
import { SHORT_ON_TIME_MINUTES } from '../rules/timeAvailabilityPolicy';
import type { FixtureAvailabilityKind } from '../rules/fixtureConditionedAvailability';
import { durableStateFactScope } from '../rules/durableFactHorizon';
import {
  commitTemporarySourceFactSet,
  transactTemporarySourceFact,
  type TemporarySourceFactInertReason,
} from '../store/temporarySourceFactTransaction';
import { clearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { liveAthleteContext } from './liveAthleteContext';
import {
  TEAM_NIGHT_MOVE_ASK,
  teamNightMoveAskContext,
  teamNightPermanentPatch,
} from '../rules/teamNightMoveAsk';

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

export type ProgramControlRoute =
  | 'guided_tap_flow'
  | 'guided_follow_up_sheet'
  | 'coach_fallback';

export type ProgramControlStatusUpdate =
  | 'good_now'
  | 'still_not_right'
  | 'still_sick'
  | 'still_cooked'
  | 'worse';

export interface ProgramControlRoutingDecision {
  route: ProgramControlRoute;
  reason: string;
}

export interface ProgramControlActionContext {
  todayISO?: string;
  visibleWeek?: ResolvedDay[];
  applyOverride?: (
    date: string,
    workout: Workout | null,
    context?: OverrideContext,
  ) => void;
}

export interface ProgramControlActionResult {
  ok: boolean;
  changedProgram: boolean;
  requiresRebuild: boolean;
  createdModifierIds?: string[];
  clearedModifierIds?: string[];
  message?: string;
  fallbackToCoach?: boolean;
  fallbackReason?: string;
  needsGuidedFollowUp?: boolean;
  route: ProgramControlRoute;
  /**
   * Present when this action ran a plan change. Carries the producer's typed
   * three-way answer (ruling #6) so a stage that published nothing is not
   * flattened into `ok: false` and rendered as an error by the surface.
   */
  outcome?: PlanChangeOutcome;
  /** Development-only explicit token correlation for the render observer. */
  traceId?: string;
  /**
   * WHY an inert fact commit changed nothing, typed, from the COMMITTED
   * transaction result (Sam's §7 answer, 2026-08-03: a time-cap fact whose
   * every target date is a fixture day records inert — nothing to shorten).
   * The acknowledgment owner selects its clause from this, never the door.
   */
  inertReason?: TemporarySourceFactInertReason;
  /** The fixture's kind — picks the §10 sentence variant. */
  inertFixtureVariant?: FixtureAvailabilityKind;
}

const SETUP_ACTIONS = new Set<ProgramControlActionType>([
  'update_lfa_days',
  'update_team_training_days',
  'update_game_day',
  'update_season_phase',
  'update_program_setup',
]);

export function routeProgramControlAction(
  action: ProgramControlAction,
): ProgramControlRoutingDecision {
  if (SETUP_ACTIONS.has(action.type)) {
    return {
      route: 'guided_tap_flow',
      reason: 'Routine setup changes should stay inside guided controls.',
    };
  }
  if (action.type === 'swap_exercise' && !action.payload.toExercise) {
    return {
      route: 'guided_follow_up_sheet',
      reason: 'Exercise swap needs a selected replacement exercise.',
    };
  }
  if (action.type === 'add_exercise' && !action.payload.exercise) {
    return {
      route: 'guided_follow_up_sheet',
      reason: 'Add exercise needs a selected exercise prescription.',
    };
  }
  if (action.type === 'set_injury_modifier' && !action.payload.constraint) {
    return {
      route: 'guided_follow_up_sheet',
      reason: 'Injury modifiers need body area, severity, and restriction details.',
    };
  }
  return {
    route: 'guided_tap_flow',
    reason: 'Routine typed action.',
  };
}

function fallbackResult(
  _action: ProgramControlAction,
  route: ProgramControlRoutingDecision,
  reason: string,
): ProgramControlActionResult {
  return {
    ok: false,
    changedProgram: false,
    requiresRebuild: false,
    route: route.route,
    message: reason,
    fallbackToCoach: route.route === 'coach_fallback',
    fallbackReason: route.route === 'coach_fallback' ? reason : undefined,
    needsGuidedFollowUp: route.route === 'guided_follow_up_sheet',
  };
}

function defaultApplyOverride(
  date: string,
  workout: Workout | null,
  context?: OverrideContext,
) {
  if (!workout) return;
  applyProgramOverrideWrite({ date, workout, context, writer: 'program_control' });
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function scheduleModifierIdForDate(
  dateISO: string,
  variant: 'busy' | 'away' = 'busy',
): string {
  const weekStartISO = getMondayForDate(dateISO);
  return variant === 'away'
    ? `tap-schedule-away:${weekStartISO}`
    : `tap-schedule-busy-week:${weekStartISO}`;
}

function planChangeForAction(action: ProgramControlAction): PlanChange | null {
  if (action.type === 'swap_session') {
    if (action.payload.category) {
      return { kind: 'swap_category', date: action.payload.date, category: action.payload.category };
    }
    if (action.payload.templateId) {
      return { kind: 'swap_template', date: action.payload.date, templateId: action.payload.templateId };
    }
  }
  if (action.type === 'add_to_day') {
    if (action.payload.category) {
      return { kind: 'add_category', date: action.payload.date, category: action.payload.category };
    }
    if (action.payload.templateId) {
      return { kind: 'add_template', date: action.payload.date, templateId: action.payload.templateId };
    }
  }
  if (action.type === 'move_session') {
    return {
      kind: 'move_session',
      fromDate: action.payload.fromDate,
      toDate: action.payload.toDate,
      ...(action.payload.scope ? { scope: action.payload.scope } : {}),
    };
  }
  if (action.type === 'bin_session') {
    return { kind: 'remove_session', date: action.payload.date, scope: action.payload.scope };
  }
  return null;
}

/**
 * THE SCREEN'S DOOR, AS ONE OWNER.
 *
 * `PlanChangeSheet.commitPlanChange` decides which change kinds go through the
 * program-control wrapper (move and bin) and which go straight to the producer,
 * and it builds the wrapper payload. That decision and that payload ARE the
 * screen's behaviour, so they live here rather than inside a component — the
 * sheet calls this, and so does the harness that has to enter the same door.
 *
 * Written because the alternative was proven bad within one commit: the device
 * replay suite hand-copied the sheet's payload in order to reproduce a defect,
 * and the moment the sheet was fixed the copy still carried the bug. A harness
 * that mirrors a screen drifts from it; a harness that CALLS it cannot.
 *
 * Returns null when the change is not one the wrapper owns — the caller then
 * goes straight to `applyPlanChange`, exactly as the sheet always has.
 */
export function programControlActionForPlanChange(
  change: PlanChange,
): ProgramControlAction | null {
  const source = {
    screen: 'program_tab' as const,
    surface: 'plan_change_sheet' as const,
    initiatedBy: 'tap' as const,
  };
  const shared = {
    source,
    scope: 'today_only' as const,
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  };
  if (change.kind === 'move_session') {
    return {
      ...shared,
      type: 'move_session',
      payload: {
        fromDate: change.fromDate,
        toDate: change.toDate,
        // The component the athlete picked. It used to stop at this boundary:
        // the sheet offered "just the gym session", the payload could not say
        // so, and the whole day moved.
        ...(change.scope ? { scope: change.scope } : {}),
      },
    } as ProgramControlAction;
  }
  if (change.kind === 'remove_session') {
    return {
      ...shared,
      type: 'bin_session',
      payload: { date: change.date, scope: change.scope },
    } as ProgramControlAction;
  }
  // Only an ANSWERED team-night move enters the door; a routeless change is
  // the producer's to answer with the ask, and mapping it here would let a
  // commit path skip the question.
  if (change.kind === 'move_team_night' && change.teamNightRoute) {
    return {
      ...shared,
      type: 'move_team_night',
      payload: {
        fromDate: change.fromDate,
        toDate: change.toDate,
        route: change.teamNightRoute,
      },
    } as ProgramControlAction;
  }
  return null;
}

function executePlanChangeAction(
  action: ProgramControlAction,
  context: ProgramControlActionContext,
  route: ProgramControlRoutingDecision,
): ProgramControlActionResult | null {
  const change = planChangeForAction(action);
  if (!change) return null;
  if (!context.visibleWeek || !context.todayISO) {
    return fallbackResult(
      action,
      { route: 'guided_follow_up_sheet', reason: 'Visible week context is required.' },
      'Cannot safely apply this day/session action without the current visible week.',
    );
  }
  const risk = previewPlanChangeRisk({
    change,
    visibleWeek: context.visibleWeek,
    todayISO: context.todayISO,
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
  });
  if (risk.ok && risk.assessment.decision === 'block' && action.type !== 'bin_session') {
    return {
      ok: false,
      changedProgram: false,
      requiresRebuild: false,
      message: risk.assessment.findings[0]?.message ?? "That edit can't be applied safely.",
      fallbackToCoach: false,
      route: route.route,
    };
  }
  const result = applyPlanChange({
    change,
    visibleWeek: context.visibleWeek,
    todayISO: context.todayISO,
    applyOverride: context.applyOverride ?? defaultApplyOverride,
    trace: risk.trace,
  });
  // THE WRAPPER ROUTES THE PRODUCER'S ANSWER. IT DOES NOT INTERPRET IT.
  //
  // This mapped every non-ok producer result to a bare `ok: false`, and the
  // outer layer then computed
  // `program_control_<type>_${needsGuidedFollowUp ? 'needs_input' : 'rejected'}`
  // — so a QUESTION arrived at the athlete as `..._rejected` with
  // `failureCategory: technical_failure`, and the G-1 ask never rendered. The
  // vocabulary for the right answer already existed here and was simply never
  // set on this path.
  //
  // The owner decides what its own answer means: `planChangeResultIsLandingAsk`
  // is asked, never a code string matched. Nothing else about the result is
  // reinterpreted — the producer's own sentence is passed through as it always
  // was.
  const isAsk = planChangeResultIsLandingAsk(result);
  return {
    ok: result.ok,
    outcome: result.outcome,
    changedProgram: result.ok && result.appliedDates.length > 0,
    requiresRebuild: false,
    message: result.message,
    fallbackToCoach: false,
    ...(isAsk ? { needsGuidedFollowUp: true } : {}),
    route: isAsk ? 'guided_follow_up_sheet' : route.route,
  };
}

function clearModifierFromPayload(
  payload: { noteId?: string; modifierId?: string },
  route: ProgramControlRoutingDecision,
): ProgramControlActionResult {
  const id = payload.noteId ?? payload.modifierId;
  if (!id) {
    return {
      ok: false,
      changedProgram: false,
      requiresRebuild: false,
      message: 'No active modifier id was provided.',
      needsGuidedFollowUp: true,
      fallbackToCoach: false,
      route: 'guided_follow_up_sheet',
    };
  }
  const normalizedId = id
    .replace(/^coach-note:/, '')
    .replace(/^program-modifier:active_constraint:/, '');
  const acceptedConstraint = useProgramStore.getState().acceptedMaterialContext.activeConstraints
    .find((constraint) => constraint.id === normalizedId);
  if ((acceptedConstraint?.temporarySourceFactIds?.length ?? 0) > 0) {
    return {
      ok: false,
      changedProgram: false,
      requiresRebuild: false,
      message: 'Resolve the exact wellbeing report through the durable source-fact action.',
      fallbackToCoach: false,
      route: route.route,
    };
  }
  const cleared = clearActiveCoachNote(id);
  return {
    ok: Boolean(cleared.cleared),
    changedProgram: Boolean(cleared.cleared),
    requiresRebuild: cleared.rebuildRequired,
    clearedModifierIds: cleared.cleared ? [cleared.cleared.id] : [],
    message: cleared.cleared ? `Cleared ${cleared.cleared.title}.` : 'No active modifier matched.',
    fallbackToCoach: false,
    route: route.route,
  };
}

function executeProgramControlActionWithinTrace(
  action: ProgramControlAction,
  context: ProgramControlActionContext = {},
): ProgramControlActionResult {
  const route = routeProgramControlAction(action);
  if (route.route === 'guided_follow_up_sheet') {
    return fallbackResult(action, route, route.reason);
  }

  const planResult = executePlanChangeAction(action, context, route);
  if (planResult) return planResult;

  switch (action.type) {
    case 'swap_exercise': {
      const activeConstraints = useCoachUpdatesStore.getState().activeConstraints;
      const environment = resolveTapSwapEnvironment({
        date: action.payload.date,
        profile: useProfileStore.getState().onboardingData,
        activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[action.payload.date],
      });
      const safety = assessTapSwapCandidateSafety(
        action.payload.toExercise!.name,
        environment,
      );
      if (!safety.safe) {
        return {
          ok: false,
          changedProgram: false,
          requiresRebuild: false,
          message: safety.reason,
          fallbackToCoach: false,
          route: route.route,
        };
      }
      const result = replaceExerciseAtDate({
        date: action.payload.date,
        todayISO: context.todayISO,
        fromExercise: action.payload.fromExercise,
        fromExerciseId: action.payload.fromExerciseId,
        toExercise: action.payload.toExercise!,
      });
      let futureResult: { success: boolean; reason?: string } | null = null;
      if (result.success && action.payload.futureWeeksToo) {
        futureResult = setPreferredAlternative({
          exercise: action.payload.fromExercise,
          alternative: action.payload.toExercise!.name,
        });
      }
      return {
        ok: result.success && futureResult?.success !== false,
        changedProgram: result.success,
        requiresRebuild: false,
        message: futureResult?.reason ?? result.reason,
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'add_exercise': {
      const result = addExerciseAtDate({
        date: action.payload.date,
        exercise: action.payload.exercise!,
      });
      let futureResult: { success: boolean; reason?: string } | null = null;
      if (result.success && action.payload.futureWeeksToo) {
        futureResult = pinExerciseGlobally({ exercise: action.payload.exercise!.name });
      }
      return {
        ok: result.success && futureResult?.success !== false,
        changedProgram: result.success,
        requiresRebuild: false,
        message: futureResult?.reason ?? result.reason,
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'remove_exercise': {
      const result = removeExerciseAtDate({
        date: action.payload.date,
        exercise: action.payload.exercise,
        exerciseId: action.payload.exerciseId,
      });
      let futureResult: { success: boolean; reason?: string } | null = null;
      if (result.success && action.payload.futureWeeksToo) {
        futureResult = banExerciseGlobally({ exercise: action.payload.exercise });
      }
      return {
        ok: result.success && futureResult?.success !== false,
        changedProgram: result.success,
        requiresRebuild: false,
        message: futureResult?.reason ?? result.reason,
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_recovery_mode': {
      const todayISO = action.payload.todayISO ?? context.todayISO ?? action.payload.date;
      const activeModifierId = recoveryModeModifierIdForDate(action.payload.date);
      let appliedDates = action.payload.appliedDates ?? [];
      let message: string | undefined;
      if (action.payload.planChange) {
        if (!context.visibleWeek) {
          return fallbackResult(
            action,
            { route: 'guided_follow_up_sheet', reason: 'Visible week context is required.' },
            'Cannot safely apply recovery mode without the current visible week.',
          );
        }
        const planResult = applyPlanChange({
          change: action.payload.planChange,
          visibleWeek: context.visibleWeek,
          todayISO,
          applyOverride: (date, workout, overrideContext) =>
            (context.applyOverride ?? defaultApplyOverride)(
              date,
              workout,
              withActiveProgramModifierContext(overrideContext, activeModifierId),
            ),
        });
        if (!planResult.ok) {
          return {
            ok: false,
            outcome: planResult.outcome,
            changedProgram: false,
            requiresRebuild: false,
            message: planResult.message,
            fallbackToCoach: false,
            route: route.route,
          };
        }
        appliedDates = planResult.appliedDates;
        message = planResult.message;
      }
      const modifierId = upsertTapRecoveryModeModifier({
        date: action.payload.date,
        todayISO,
        appliedDates,
        scope: action.payload.recoveryScope,
      });
      return {
        ok: true,
        changedProgram: true,
        requiresRebuild: false,
        createdModifierIds: [modifierId],
        message,
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_fatigue_status': {
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Temporary wellbeing reports require the durable source-fact transaction.',
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_poor_sleep_status': {
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Poor-sleep replacement requires the durable source-fact transaction.',
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_illness_status': {
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Illness reports require the durable source-fact transaction.',
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'clear_injury_modifier':
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Injury resolution must use the durable Injury resolved action.',
        fallbackToCoach: false,
        route: route.route,
      };
    case 'clear_recovery_mode':
    case 'clear_exercise_preference':
    case 'clear_active_modifier':
      return clearModifierFromPayload(action.payload, route);
    case 'clear_fatigue_status':
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Temporary wellbeing resolution requires the durable source-fact transaction.',
        fallbackToCoach: false,
        route: route.route,
      };
    case 'set_injury_modifier': {
      const accepted = useProgramStore.getState().acceptedMaterialContext;
      if ((accepted.injuryEpisodes?.length ?? 0) === 0 && !accepted.acceptedCompositionBase) {
        // Legacy pre-migration compatibility only. Every production injury
        // surface now calls executeProgramControlActionDurably; this seam lets
        // an old envelope enter the explicit legacy_after_state_only migration.
        useCoachUpdatesStore.getState().upsertActiveConstraint(action.payload.constraint!);
        return {
          ok: true,
          changedProgram: true,
          requiresRebuild: false,
          createdModifierIds: [action.payload.constraint!.id],
          fallbackToCoach: false,
          route: route.route,
        };
      }
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Injury changes must use the durable injury transaction.',
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_equipment_modifier': {
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Temporary equipment changes require the durable source-fact transaction.',
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_schedule_modifier': {
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'Temporary schedule changes require the durable source-fact transaction.',
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'add_exercise_preference': {
      const result = action.payload.preferenceKind === 'preferred_alternative'
        ? setPreferredAlternative({
            exercise: action.payload.exercise,
            alternative: action.payload.alternative ?? '',
          })
        : action.payload.preferenceKind === 'add_focus'
          ? pinExerciseGlobally({
              exercise: action.payload.alternative ?? action.payload.exercise,
            })
          : banExerciseGlobally({ exercise: action.payload.exercise });
      return {
        ok: result.success,
        changedProgram: result.success,
        requiresRebuild: false,
        message: result.reason,
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'update_lfa_days':
    case 'update_team_training_days':
    case 'update_game_day':
    case 'update_season_phase':
    case 'update_program_setup':
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: action.requiresRebuild,
        message: 'This routine setup action is typed, but its guided executor wiring belongs in Stage 2B.',
        fallbackToCoach: false,
        needsGuidedFollowUp: false,
        route: route.route,
      };
    default:
      return fallbackResult(
        action,
        { route: 'coach_fallback', reason: 'No deterministic handler exists for this action.' },
        'No deterministic handler exists for this action.',
      );
  }
}

function diagnosticActionType(action: ProgramControlAction): AthleteActionType {
  if (action.type === 'bin_session') {
    return action.payload.scope && action.payload.scope !== 'whole_day'
      ? 'delete_component'
      : 'delete_session';
  }
  if (action.type === 'remove_exercise') return 'delete_component';
  if (action.type === 'move_session' || action.type === 'move_team_night') return 'move_session';
  if (action.type === 'add_to_day' || action.type === 'add_exercise') return 'add_session';
  if (action.type === 'update_game_day') return 'game_day_change';
  if (action.type === 'set_injury_modifier' || action.type === 'clear_injury_modifier') {
    return 'injury_change';
  }
  if (action.type === 'set_equipment_modifier') return 'equipment_change';
  if (action.type === 'set_fatigue_status' || action.type === 'set_poor_sleep_status' ||
    action.type === 'set_illness_status' ||
    action.type === 'clear_fatigue_status') return 'readiness_change';
  if (action.type.startsWith('clear_') || action.type === 'clear_active_modifier') {
    return 'clear_adjustment';
  }
  if (action.type === 'set_recovery_mode') return 'go_lighter';
  return 'program_change';
}

function diagnosticActionDate(action: ProgramControlAction): string | undefined {
  if (action.type === 'move_session' || action.type === 'move_team_night') {
    return action.payload.fromDate;
  }
  const payload = action.payload as Record<string, unknown>;
  return typeof payload.date === 'string' ? payload.date : undefined;
}

function diagnosticComponentId(action: ProgramControlAction): string | null | undefined {
  if (action.type === 'remove_exercise') return action.payload.exerciseId ?? action.payload.exercise;
  if (action.type === 'swap_exercise') return action.payload.fromExerciseId ?? action.payload.fromExercise;
  return undefined;
}

/** Stable tap/system production entry for diagnostic correlation only. */
export function executeProgramControlAction(
  action: ProgramControlAction,
  context: ProgramControlActionContext = {},
): ProgramControlActionResult {
  const date = diagnosticActionDate(action);
  const source: AthleteActionSource = action.source.initiatedBy === 'system' ? 'system' : 'tap';
  const visibleWorkout = date
    ? context.visibleWeek?.find((day) => day.date === date)?.workout ?? null
    : null;
  const trace = beginAthleteActionTrace({
    source,
    actionType: diagnosticActionType(action),
    route: `program_control:${action.source.screen}:${action.source.surface ?? 'default'}`,
    currentWeekId: date ? getMondayForDate(date) : undefined,
    sourceDate: date,
    targetDate: action.type === 'move_session' ? action.payload.toDate : date,
    sessionDate: date,
    planEntryId: visibleWorkout?.planEntryId ?? null,
    workoutId: visibleWorkout?.id ?? null,
    scope: action.scope ?? null,
    sessionTier: visibleWorkout?.sessionTier ?? null,
    workoutType: visibleWorkout?.workoutType ?? null,
    componentId: diagnosticComponentId(action),
  });
  return runWithAthleteActionTrace(trace, () => {
    const diagnosticsEnabled = athleteActionDiagnosticsEnabled();
    const beforeModifiers = diagnosticsEnabled ? getActiveProgramModifiers() : [];
    const beforeNotes = diagnosticsEnabled ? buildCoachNotesFromModifiers(beforeModifiers) : [];
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: action.type,
      requiresRebuild: action.requiresRebuild,
      createsActiveModifier: action.createsActiveModifier,
      beforeStateHash: athleteActionDiagnosticHash({
        activeConstraintIds: useCoachUpdatesStore.getState().activeConstraints.map((entry) => entry.id),
        visibleIdentities: context.visibleWeek?.map((day) =>
          day.workout?.planEntryId ?? day.workout?.id ?? null),
      }),
    });
    const route = routeProgramControlAction(action);
    emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
      selectedRoute: route.route,
      routeDecision: route.route,
      producer: 'executeProgramControlAction',
    });
    try {
      const result = executeProgramControlActionWithinTrace(action, context);
      const afterModifiers = diagnosticsEnabled ? getActiveProgramModifiers() : [];
      const afterNotes = diagnosticsEnabled ? buildCoachNotesFromModifiers(afterModifiers) : [];
      const beforeNoteIds = new Set(beforeNotes.map((note) => note.id));
      const afterNoteIds = new Set(afterNotes.map((note) => note.id));
      emitAthleteActionEvent(trace, 'coach_notes_result', {
        activeAdjustmentCountBefore: beforeModifiers.length,
        activeAdjustmentCountAfter: afterModifiers.length,
        activeCoachNoteCountBefore: beforeNotes.length,
        activeCoachNoteCountAfter: afterNotes.length,
        noteIdentitiesDerived: afterNotes.map((note) => note.id),
        noteIdentitiesAdded: afterNotes.filter((note) => !beforeNoteIds.has(note.id))
          .map((note) => note.id),
        noteIdentitiesRemoved: beforeNotes.filter((note) => !afterNoteIds.has(note.id))
          .map((note) => note.id),
        noteIdentitiesPreserved: afterNotes.filter((note) => beforeNoteIds.has(note.id))
          .map((note) => note.id),
        noteIdentitiesSuppressed: afterModifiers
          .filter((modifier) => !afterNotes.some((note) => note.modifierId === modifier.id))
          .map((modifier) => modifier.id),
        deduplicationKeys: afterNotes.map((note) => note.modifierId),
        adjustmentCleared: beforeNotes.some((note) => !afterNoteIds.has(note.id)),
        clearedAdjustmentIds: beforeNotes.filter((note) => !afterNoteIds.has(note.id))
          .map((note) => note.modifierId),
        noteStateMatchesAcceptedProvenance: afterNotes.length === afterNoteIds.size,
      });
      const internalResultCode = result.ok
        ? `program_control_${action.type}_accepted`
        : `program_control_${action.type}_${result.needsGuidedFollowUp ? 'needs_input' : 'rejected'}`;
      if (result.ok) {
        emitAthleteActionEvent(trace, 'athlete_action_completed', {
          outcome: result.changedProgram ? 'accepted_changed' : 'accepted_no_change',
          internalResultCode,
          afterStateHash: athleteActionDiagnosticHash({
            activeConstraintIds: useCoachUpdatesStore.getState().activeConstraints.map((entry) => entry.id),
            createdModifierIds: result.createdModifierIds ?? [],
            clearedModifierIds: result.clearedModifierIds ?? [],
          }),
        });
      } else {
        emitAthleteActionEvent(trace, 'athlete_action_failed', {
          outcome: 'rejected',
          internalResultCode,
          originalRejectionCode: internalResultCode,
          rejectionCodes: [internalResultCode],
          firstFailingBoundary: route.route === 'guided_follow_up_sheet'
            ? 'routeProgramControlAction'
            : 'executeProgramControlAction',
          failureCategory: classifyAthleteActionFailure(internalResultCode),
          validCandidateExisted: false,
          previousStateRestored: true,
          terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
        });
      }
      emitAthleteActionEvent(trace, 'athlete_ui_outcome_shown', {
        uiSurface: action.source.surface ?? action.source.screen,
        uiOutcome: result.ok ? 'success' : result.needsGuidedFollowUp ? 'guided_follow_up' : 'failure',
        internalResultCode,
        changedProgram: result.changedProgram,
        finalUiMessageKey: internalResultCode,
      });
      return athleteActionDiagnosticsEnabled()
        ? { ...result, traceId: trace.traceId }
        : result;
    } catch (error) {
      const originalRejectionCode = error instanceof Error ? error.name : 'unknown_error';
      emitAthleteActionEvent(trace, 'athlete_action_failed', {
        outcome: 'threw',
        internalResultCode: `program_control_${action.type}_threw`,
        originalRejectionCode,
        rejectionCodes: [originalRejectionCode],
        firstFailingBoundary: 'executeProgramControlAction',
        failureCategory: classifyAthleteActionFailure(originalRejectionCode),
        validCandidateExisted: false,
        previousStateRestored: true,
        terminalReasonChain: athleteActionTerminalReasonChain(trace.traceId),
      });
      throw error;
    }
  });
}

/** The exact dates an away/holiday request names, sorted, day-precision. */
function scheduleModifierAwayDates(
  action: Extract<ProgramControlAction, { type: 'set_schedule_modifier' }>,
): string[] {
  return action.payload.planChange?.kind === 'clear_days'
    ? [...action.payload.planChange.dates.map((value) => value.slice(0, 10))].sort()
    : [];
}

/**
 * THE ACTION'S DECLARED SCOPE IS THE FACT'S HORIZON.
 *
 * `ProgramControlActionBase.scope` has always been part of this request and the
 * schedule branch always threw it away: every schedule fact got a WEEK, whatever
 * the door said. That was invisible while the only door said "Busy or away this
 * week?" — and became a lie the moment Sam's ruling 2 (2026-07-31) split it and
 * named the busy half "Short on time today". Being short on time on a Tuesday
 * says nothing about Thursday.
 *
 * The horizon is not a second opinion invented here. `scheduleProjection`
 * already publishes `startDate: effectiveFrom` / `expiresAt: effectiveUntil`,
 * and `constraintAppliesToDate` already refuses the constraint on any date
 * outside them — so a `date`-kind scope reaches exactly one day through
 * machinery that was already there. One door, one fact kind, a scoped payload:
 * no second writer, no forked kind, no per-button special case.
 *
 * Exported because it is the whole decision this door makes, and a decision
 * worth asserting is worth naming. `executeProgramControlActionDurably` is its
 * only production caller.
 */
export function scheduleFactScopeForAction(
  action: Extract<ProgramControlAction, { type: 'set_schedule_modifier' }>,
): TemporarySourceFactScope {
  const date = action.payload.date.slice(0, 10);
  const awayDates = scheduleModifierAwayDates(action);
  // Away names its own dates, so the window IS the answer — a scope word cannot
  // improve on the days the athlete ticked.
  if (awayDates.length > 0) {
    return temporaryFactScope({
      kind: 'window',
      from: awayDates[0],
      until: awayDates[awayDates.length - 1],
    });
  }
  return action.scope === 'today_only'
    ? temporaryFactScope({ kind: 'date', date })
    : temporaryFactScope({ kind: 'week', date });
}

/** Durable accepted boundary for the migrated tap-owned session mutations.
 * Unmigrated actions retain the existing synchronous control path. */
export async function executeProgramControlActionDurably(
  action: ProgramControlAction,
  context: ProgramControlActionContext = {},
): Promise<ProgramControlActionResult> {
  if (!athleteActionDiagnosticsEnabled()) {
    return executeProgramControlActionDurablyWithinTrace(action, context);
  }
  const date = diagnosticActionDate(action);
  const trace = beginAthleteActionTrace({
    source: action.source.initiatedBy === 'system' ? 'system' : 'tap',
    actionType: diagnosticActionType(action),
    route: `program_control_durable:${action.source.surface ?? action.source.screen}`,
    sourceDate: action.type === 'move_session' ? action.payload.fromDate : date,
    targetDate: action.type === 'move_session' ? action.payload.toDate : undefined,
    sessionDate: date,
    scope: action.scope,
    componentId: diagnosticComponentId(action),
  });
  return runWithAthleteActionTrace(trace, async () => {
    const result = await executeProgramControlActionDurablyWithinTrace(action, context);
    return { ...result, traceId: trace.traceId };
  });
}

async function executeProgramControlActionDurablyWithinTrace(
  action: ProgramControlAction,
  context: ProgramControlActionContext,
): Promise<ProgramControlActionResult> {
  if (action.type === 'set_injury_modifier') {
    const result = await createOrUpdateInjuryEpisode({
      constraint: action.payload.constraint!,
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface: action.source.surface ?? action.source.screen,
      todayISO: context.todayISO,
    });
    const ok = result.outcome !== 'conflicted' && result.outcome !== 'safely_rejected';
    return {
      ok,
      changedProgram: result.changedProgram,
      requiresRebuild: false,
      createdModifierIds: ok && result.episodeId ? [result.episodeId] : undefined,
      message: result.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
    };
  }
  if (action.type === 'clear_injury_modifier') {
    let episodeId = action.payload.episodeId;
    if (!episodeId) {
      const notes = buildCoachNotesFromModifiers(getActiveProgramModifiers(), []);
      const note = notes.find((candidate) =>
        candidate.id === action.payload.noteId ||
        candidate.modifierId === action.payload.modifierId);
      episodeId = note?.injuryEpisodeId;
    }
    if (!episodeId) {
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: 'No exact active injury episode matched this action.',
        fallbackToCoach: false,
        route: routeProgramControlAction(action).route,
      };
    }
    const result = await resolveInjuryEpisode(episodeId, {
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface: action.source.surface ?? action.source.screen,
      todayISO: context.todayISO,
    });
    const ok = result.outcome === 'resolved_and_recomposed' ||
      result.outcome === 'resolved_no_program_change' ||
      result.outcome === 'already_resolved';
    return {
      ok,
      changedProgram: result.changedProgram,
      requiresRebuild: false,
      clearedModifierIds: ok ? [episodeId] : undefined,
      message: result.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
    };
  }
  if (action.type === 'set_equipment_modifier') {
    const date = action.payload.date.slice(0, 10);
    const todayISO = action.payload.todayISO ?? context.todayISO ?? date;
    const sourceSurface = action.source.surface ?? action.source.screen;
    const decision = action.payload.decision;
    if (decision.kind === 'available_again') {
      const accepted = useProgramStore.getState().acceptedMaterialContext;
      const facts = accepted.temporarySourceFacts
        .filter((fact) => isTemporaryEquipmentFact(fact) && fact.status === 'active');
      if (facts.length === 0) {
        return {
          ok: true,
          changedProgram: false,
          requiresRebuild: false,
          clearedModifierIds: [],
          message: 'No temporary equipment restriction is active.',
          fallbackToCoach: false,
          route: routeProgramControlAction(action).route,
        };
      }
      const now = new Date().toISOString();
      const ids = new Set(facts.map((fact) => fact.factId));
      const actor = action.source.initiatedBy === 'system' ? 'system' : 'athlete';
      const nextFacts = accepted.temporarySourceFacts.map((fact) =>
        isTemporaryEquipmentFact(fact) && ids.has(fact.factId)
          ? {
              ...fact,
              status: 'resolved' as const,
              updatedAt: now,
              resolvedAt: now,
              sourceActor: actor,
              sourceSurface,
              transitionHistory: [
                ...fact.transitionHistory,
                {
                  at: now,
                  from: 'active' as const,
                  to: 'resolved' as const,
                  actor,
                  surface: sourceSurface,
                  reason: 'equipment_available_again',
                },
              ],
            }
          : fact);
      const result = await commitTemporarySourceFactSet({
        nextFacts,
        targetFactId: facts[0].factId,
        todayISO,
        reason: 'temporary_source_fact:equipment_available_again',
        expectedAcceptedRevision: accepted.revision,
      });
      return {
        ok: result.ok,
        changedProgram: result.changedProgram,
        requiresRebuild: false,
        clearedModifierIds: result.ok ? facts.map((fact) => fact.factId) : undefined,
        message: result.ok
          ? 'Equipment available again. The accepted program was recomposed and verified.'
          : 'The equipment restriction was not cleared because the accepted program could not be verified.',
        fallbackToCoach: false,
        route: routeProgramControlAction(action).route,
      };
    }
    // The decision is 'without' by construction: the athlete marked which of
    // their OWN items are missing. There is no preset menu to translate.
    const fact = createTemporaryEquipmentFact({
      observedDate: date,
      scope: temporaryFactScope({ kind: 'week', date }),
      mode: 'without',
      equipmentTags: decision.tags,
      conditioningModalities: decision.conditioningModalities,
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface,
    });
    const result = await transactTemporarySourceFact({
      operation: 'create',
      fact,
      todayISO,
      sourceActor: fact.sourceActor,
      sourceSurface,
    });
    const ok = result.outcome !== 'conflicted' && result.outcome !== 'safely_rejected';
    return {
      ok,
      changedProgram: result.changedProgram,
      requiresRebuild: false,
      createdModifierIds: ok ? [fact.factId] : undefined,
      message: result.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
    };
  }
  if (action.type === 'move_team_night') {
    const fromDate = action.payload.fromDate.slice(0, 10);
    const toDate = action.payload.toDate.slice(0, 10);
    const todayISO = action.payload.todayISO ?? context.todayISO ?? fromDate;
    const sourceSurface = action.source.surface ?? action.source.screen;
    const context_ = teamNightMoveAskContext({ fromDate, toDate });
    if (action.payload.route === 'permanent') {
      // THE ONE SETUP OWNER. The patch is the whole input; the owner writes
      // the profile through its armoured door and regenerates forward per its
      // own rules. Confirmed INLINE — the signed success sentence is the ack.
      // The current team days are read through `liveAthleteContext` — LR-4's
      // own migration direction — never as a raw mirror read.
      const profile = liveAthleteContext().onboardingData;
      const result = await commitProfileProgramTransaction({
        change: {
          kind: 'profile_setup',
          patch: teamNightPermanentPatch(profile ?? { teamTrainingDays: [] }, context_),
        },
        todayISO,
        sourceSurface: `team_night_move:${sourceSurface}`,
      });
      return {
        ok: result.ok,
        changedProgram: result.changedProgram,
        requiresRebuild: false,
        message: result.ok
          ? TEAM_NIGHT_MOVE_ASK.successMessage('permanent', context_)
          : result.message,
        fallbackToCoach: false,
        route: routeProgramControlAction(action).route,
      };
    }
    // ONE-OFF: a dated schedule fact through the approved deriving lane. The
    // week re-derives around it (anchor relocation; doubling law) and
    // resolving the fact undoes it clean via the fact-linked adjustment.
    const fact = createTemporaryScheduleFact({
      observedDate: todayISO,
      scope: temporaryFactScope({ kind: 'week', date: fromDate }),
      scheduleKind: 'team_night_move',
      teamNightFromDate: fromDate,
      teamNightToDate: toDate,
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface,
    });
    const result = await transactTemporarySourceFact({
      operation: 'create',
      fact,
      todayISO,
      sourceActor: fact.sourceActor,
      sourceSurface,
    });
    const ok = result.outcome !== 'conflicted' && result.outcome !== 'safely_rejected';
    return {
      ok,
      changedProgram: result.changedProgram,
      requiresRebuild: false,
      createdModifierIds: ok ? [fact.factId] : undefined,
      message: ok
        ? TEAM_NIGHT_MOVE_ASK.successMessage('this_week_only', context_)
        : result.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
    };
  }
  if (action.type === 'set_schedule_modifier') {
    const date = action.payload.date.slice(0, 10);
    const todayISO = action.payload.todayISO ?? context.todayISO ?? date;
    const sourceSurface = action.source.surface ?? action.source.screen;
    const awayDates = scheduleModifierAwayDates(action);
    // "Short on time today" is RULED (Sam, 2026-08-02): the fact this door
    // records IS the ruling's answer to "how short is short" — a today-scoped
    // time cap at the one 35-minute owner (`SHORT_ON_TIME_MINUTES`), whose
    // deriving lane builds the compressed session (main lift kept, cut to
    // essentials). Away and max-sessions requests stay UNRULED schedule facts
    // and commit record-only through the inert lane.
    const shortOnTimeToday = awayDates.length === 0 &&
      action.payload.maxSessionsThisWeek === undefined &&
      action.scope === 'today_only';
    const fact = shortOnTimeToday
      ? createTemporaryTimeCapFact({
          observedDate: date,
          scope: scheduleFactScopeForAction(action),
          targetKind: 'dates',
          dates: [date],
          maxSessionMinutes: SHORT_ON_TIME_MINUTES,
          sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
          sourceSurface,
        })
      : createTemporaryScheduleFact({
          observedDate: date,
          scope: scheduleFactScopeForAction(action),
          scheduleKind: awayDates.length > 0
            ? 'travel'
            : action.payload.maxSessionsThisWeek !== undefined ? 'max_sessions' : 'busy_week',
          unavailableDates: awayDates,
          maxSessions: action.payload.maxSessionsThisWeek,
          sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
          sourceSurface,
        });
    const result = await transactTemporarySourceFact({
      operation: 'create',
      fact,
      todayISO,
      sourceActor: fact.sourceActor,
      sourceSurface,
    });
    const ok = result.outcome !== 'conflicted' && result.outcome !== 'safely_rejected';
    return {
      ok,
      changedProgram: result.changedProgram,
      requiresRebuild: false,
      createdModifierIds: ok ? [fact.factId] : undefined,
      message: result.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
      // The typed WHY of an inert commit (fixture day — §7) flows through so
      // the ack owner reads it off the committed result.
      inertReason: result.inertReason,
      inertFixtureVariant: result.inertFixtureVariant,
    };
  }
  if (action.type === 'set_illness_status') {
    const date = action.payload.date.slice(0, 10);
    const sourceSurface = action.source.surface ?? action.source.screen;
    // Minor illness is today-scoped + inert (record-only, opt-in soften offer);
    // severe illness is a DURABLE STATE fact + deriving (auto-protect). The
    // create helper maps severity → athleteReportedLevel so the shared
    // health-fact threshold classifies it (see temporarySourceFact
    // `globalConstraint`).
    //
    // Stage 1: severe illness no longer takes its duration from the UI's scope
    // string. "I'm properly sick" is true until the athlete says otherwise, and
    // it starts when they say it — never back-dated to Monday over days they
    // have already trained.
    const todayISO = (action.payload.todayISO ?? context.todayISO ?? date).slice(0, 10);
    const fact = createTemporaryIllnessFact({
      observedDate: date,
      // MILD is the record-only tier and stays today-scoped. MODERATE and
      // SEVERE both hold "for as long as the illness fact is ACTIVE" — open
      // until cleared on the illness horizon, per the law — so both take the
      // durable scope. The test is which tiers DERIVE, not which one is worst.
      scope: action.payload.severity !== 'mild'
        ? durableStateFactScope({ anchorDate: date, todayISO })
        : temporaryFactScope({ kind: 'date', date }),
      severity: action.payload.severity,
      sourceSurface,
    });
    const factResult = await transactTemporarySourceFact({
      operation: 'create',
      fact,
      todayISO,
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface,
    });
    const ok = factResult.outcome !== 'conflicted' && factResult.outcome !== 'safely_rejected';
    return {
      ok,
      changedProgram: factResult.changedProgram,
      requiresRebuild: false,
      createdModifierIds: ok && factResult.factId ? [factResult.factId] : undefined,
      message: factResult.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
    };
  }
  if (action.type === 'set_fatigue_status' || action.type === 'set_poor_sleep_status') {
    const date = action.payload.date.slice(0, 10);
    const sourceSurface = action.source.surface ?? action.source.screen;
    // Stage 1: the week-tier readiness reports ("cooked", repeated poor sleep)
    // are DURABLE STATE facts like severe illness — they last until the athlete
    // says otherwise and start when they are reported, not on the week's Monday.
    // The today-tier reports stay genuinely date-shaped.
    const todayISO = (action.payload.todayISO ?? context.todayISO ?? date).slice(0, 10);
    const existingPoorSleep = action.type === 'set_poor_sleep_status'
      ? useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts
          ?.find((fact) => !isInjurySourceFact(fact) && fact.factKind === 'poor_sleep' && fact.status === 'active')
      : null;
    const fact = action.type === 'set_poor_sleep_status'
      ? createTemporaryPoorSleepFact({
          observedDate: date,
          scope: action.payload.pattern === 'repeated'
            ? durableStateFactScope({ anchorDate: date, todayISO })
            : temporaryFactScope({ kind: 'date', date }),
          pattern: action.payload.pattern,
          sourceSurface,
          factId: existingPoorSleep && !isInjurySourceFact(existingPoorSleep)
            ? existingPoorSleep.factId
            : undefined,
        })
      : action.payload.level === 'sore'
        ? createTemporarySorenessFact({
            observedDate: date,
            scope: temporaryFactScope({ kind: 'date', date }),
            athleteReportedLevel: 'moderate',
            distribution: 'general',
            sourceSurface,
          })
        : createTemporaryFatigueFact({
            observedDate: date,
            scope: action.payload.level === 'cooked'
              ? durableStateFactScope({ anchorDate: date, todayISO })
              : temporaryFactScope({ kind: 'date', date }),
            athleteReportedLevel: action.payload.level === 'cooked'
              ? 'cooked'
              : action.payload.level === 'worse' ? 'high' : action.payload.level === 'not_right' ? 'moderate' : 'slight',
            reportKind: action.payload.level === 'cooked' ? 'cooked' : 'fatigue',
            sourceSurface,
          });
    const factResult = await transactTemporarySourceFact({
      operation: existingPoorSleep ? 'update' : 'create',
      fact,
      todayISO,
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface,
    });
    const ok = factResult.outcome !== 'conflicted' && factResult.outcome !== 'safely_rejected';
    return {
      ok,
      changedProgram: factResult.changedProgram,
      requiresRebuild: false,
      createdModifierIds: ok && factResult.factId ? [factResult.factId] : undefined,
      message: factResult.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
    };
  }
  if (action.type === 'clear_fatigue_status') {
    const accepted = useProgramStore.getState().acceptedMaterialContext;
    const requested = action.payload.modifierId ?? action.payload.noteId ?? null;
    const normalizedModifierId = requested
      ?.replace(/^coach-note:/, '')
      .replace(/^program-modifier:active_constraint:/, '');
    const constraint = accepted.activeConstraints.find((candidate) =>
      candidate.id === normalizedModifierId ||
      `program-modifier:active_constraint:${candidate.id}` === requested);
    const sourceFactIds = constraint?.temporarySourceFactIds ?? [];
    const directFactId = accepted.temporarySourceFacts
      .filter(isNonInjuryTemporarySourceFact)
      .find((fact) => temporarySourceFactId(fact) === normalizedModifierId)?.factId;
    const factId = directFactId ?? (sourceFactIds.length === 1 ? sourceFactIds[0] : null);
    if (!factId) {
      return {
        ok: false,
        changedProgram: false,
        requiresRebuild: false,
        message: sourceFactIds.length > 1
          ? 'Choose the exact report to resolve; the visible adjustment is composed from multiple active facts.'
          : 'No exact active temporary restriction matched this action.',
        fallbackToCoach: false,
        route: routeProgramControlAction(action).route,
      };
    }
    // Cascade: revert any reversible adjustment authored by THIS fact (generic —
    // keyed on the recorded `sourceFactId`, no per-feature special case), through
    // the proven transaction-owned clearReversibleAdjustment path, before resolving
    // the fact. This makes the fact's clear action revert its linked program change
    // (e.g. an accepted lighter-day trim), honouring the "undo anytime" promise.
    const linkedAdjustments = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
      .filter((adjustment) => adjustment.sourceFactId === factId && adjustment.status === 'active');
    let revertedAdjustment = false;
    for (const adjustment of linkedAdjustments) {
      const revert = await clearReversibleAdjustment(
        adjustment.id,
        useProgramStore.getState().acceptedMaterialContext.revision,
      );
      if (revert.outcome === 'restored' || revert.outcome === 'recomposed') revertedAdjustment = true;
    }
    const factResult = await transactTemporarySourceFact({
      operation: 'resolve',
      factId,
      todayISO: action.payload.date ?? context.todayISO,
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface: action.source.surface ?? action.source.screen,
    });
    const ok = factResult.outcome !== 'conflicted' && factResult.outcome !== 'safely_rejected';
    return {
      ok,
      changedProgram: factResult.changedProgram || revertedAdjustment,
      requiresRebuild: false,
      clearedModifierIds: ok ? [factId] : undefined,
      message: ok && revertedAdjustment
        ? "Cleared — today's back to its original session."
        : factResult.message,
      fallbackToCoach: false,
      route: routeProgramControlAction(action).route,
    };
  }
  const durableSessionMutation =
    action.type === 'move_session' ||
    action.type === 'bin_session' ||
    action.type === 'swap_exercise' ||
    action.type === 'add_exercise' ||
    action.type === 'remove_exercise';
  if (!durableSessionMutation) {
    return executeProgramControlAction(action, context);
  }
  const dates = action.type === 'move_session'
    ? [action.payload.fromDate, action.payload.toDate]
    : [action.payload.date];
  const transaction = await runCoachMutationTransaction({
    todayISO: context.todayISO ?? dates[0],
    extraDates: dates,
    mutate: () => executeProgramControlAction(action, context),
    didApply: (result) => result.ok && result.changedProgram,
  });
  if (transaction.ok) return transaction.value;
  // THE DURABLE TWIN ROUTES THE CORE'S ANSWER. IT DOES NOT TRANSLATE IT.
  //
  // This is the wrapper defect one layer up, on the ONLY path the sheet awaits.
  // `executePlanChangeAction` was taught to route the producer's
  // `g1_route_required` sentinel to the ask-flow, and the synchronous executor
  // duly answers `needsGuidedFollowUp: true` / `guided_follow_up_sheet`. Then
  // this ran that executor inside `runCoachMutationTransaction`, whose
  // `didApply` is `ok && changedProgram` — which an ask satisfies neither of, by
  // construction, because an ask deliberately publishes nothing. The transaction
  // reported "not applied", correctly, and everything the core had said was
  // thrown away and replaced with "That change didn't go through — nothing on
  // your plan changed. Try again, or ask your coach." A question, again, as a
  // bug report.
  //
  // A core result that is ALREADY `ok: false` has answered for itself: the
  // transaction's "not applied" is a restatement of that answer, not new
  // information about it. So it is returned in the core's own words.
  // `athleteSafeRefusal` still owns the case it was written for — the core
  // claimed success and the transaction could not keep it (rollback, semantic
  // verification), which is the only situation where this layer knows something
  // the core does not.
  const core = transaction.value;
  if (core && !core.ok) return core;
  return {
    ok: false,
    changedProgram: false,
    requiresRebuild: false,
    // The transaction's `reason` is an internal diagnostic (executor/candidate/
    // accepted-state route codes). Never render it raw — the athlete-facing
    // copy owner turns any raw reason into one honest sentence.
    message: athleteSafeRefusal('reason' in transaction ? transaction.reason : null),
    fallbackToCoach: false,
    route: routeProgramControlAction(action).route,
  };
}
