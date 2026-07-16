import { useProgramStore } from '../store/programStore';
import {
  useCoachUpdatesStore,
  type ActiveEquipmentConstraint,
  type ActiveInjuryConstraint,
  type ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useProfileStore } from '../store/profileStore';
import type { OverrideContext, Workout, WorkoutExercise } from '../types/domain';
import { getMondayForDate, type ResolvedDay } from './sessionResolver';
import {
  applyPlanChange,
  previewPlanChangeRisk,
  type PlanChange,
  type PlanChangeBinScopeId,
  type PlanChangeCategoryId,
} from './planChangeProducer';
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
  upsertTapLoadReductionModifier,
  upsertTapRecoveryModeModifier,
  recoveryModeModifierIdForDate,
  withActiveProgramModifierContext,
  type TapRecoveryModifierScope,
} from './tapProgramModifiers';
import {
  buildTemporaryEquipmentConstraint,
  temporaryEquipmentPresetById,
  upsertActiveEquipmentConstraint,
  type TemporaryEquipmentPresetId,
} from './equipmentAvailability';
import {
  assessTapSwapCandidateSafety,
  resolveTapSwapEnvironment,
} from './tapSwapHierarchy';
import {
  buildPoorSleepReadinessConstraint,
  isPoorSleepConstraint,
  type PoorSleepPattern,
} from './readinessConstraints';
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

export type ProgramControlActionType =
  | 'swap_session'
  | 'add_to_day'
  | 'move_session'
  | 'bin_session'
  | 'swap_exercise'
  | 'add_exercise'
  | 'remove_exercise'
  | 'set_recovery_mode'
  | 'clear_recovery_mode'
  | 'set_fatigue_status'
  | 'set_poor_sleep_status'
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
  | ProgramControlActionBase<'move_session', { fromDate: string; toDate: string }>
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
  | ProgramControlActionBase<'clear_fatigue_status', { noteId?: string; modifierId?: string; date?: string }>
  | ProgramControlActionBase<'set_injury_modifier', { constraint?: ActiveInjuryConstraint }>
  | ProgramControlActionBase<'clear_injury_modifier', {
      noteId?: string;
      modifierId?: string;
      episodeId?: string;
    }>
  | ProgramControlActionBase<'set_equipment_modifier', {
      presetId: TemporaryEquipmentPresetId;
      date: string;
      todayISO?: string;
    }>
  | ProgramControlActionBase<'set_schedule_modifier', {
      date: string;
      todayISO?: string;
      severity?: number;
      reasonLabel?: string;
      maxSessionsThisWeek?: number;
      /** Away / holiday: an explicit day-clearing change applied alongside
       *  the schedule Coach Note. When present the modifier owns the
       *  cleared-day overrides, so clearing the note restores them. */
      planChange?: PlanChange;
      /** Coach Notes copy overrides (busy vs away wording). */
      modifierTitle?: string;
      modifierBody?: string;
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
  setManualOverride?: (
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
  /** Development-only explicit token correlation for the render observer. */
  traceId?: string;
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

function defaultSetManualOverride(
  date: string,
  workout: Workout | null,
  context?: OverrideContext,
) {
  if (!workout) return;
  useProgramStore.getState().setManualOverride(date, workout, context);
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

// Exported for tests (gameChangeLocalRebuildTests) — pure builder, the
// production entry point remains executeProgramControlAction.
export function buildTapScheduleModifier(args: {
  date: string;
  todayISO: string;
  severity?: number;
  reasonLabel?: string;
  maxSessionsThisWeek?: number;
  /** 'busy' reduces the whole week; 'away' records chosen days cleared. */
  variant?: 'busy' | 'away';
  /** Overrides removed when this modifier clears (away days restore). */
  linkedOverrideDates?: string[];
  modifierTitle?: string;
  modifierBody?: string;
}): ActiveScheduleConstraint {
  const variant = args.variant ?? 'busy';
  // Away is a lighter touch on the days the athlete IS training — its job
  // is to clear the chosen days and record the note, not to strip the rest
  // of the week. Busy is the aggressive whole-week reducer.
  const severity = Math.max(
    1,
    Math.min(10, Math.round(args.severity ?? (variant === 'away' ? 3 : 5))),
  );
  const weekStartISO = getMondayForDate(args.date);
  const id = scheduleModifierIdForDate(args.date, variant);
  const now = new Date().toISOString();
  return {
    id,
    type: 'schedule',
    severity,
    status: 'active',
    startDate: args.todayISO,
    lastUpdatedAt: now,
    reasonLabel: args.reasonLabel ?? (variant === 'away' ? 'Away' : 'Busy week'),
    source: 'tap',
    weekStartISO,
    maxSessionsThisWeek: args.maxSessionsThisWeek,
    expiresAt: addDaysISO(weekStartISO, 6),
    linkedOverrideDates: args.linkedOverrideDates ?? [],
    modifierTitle:
      args.modifierTitle ?? (variant === 'away' ? 'Away this week' : 'Busy week active'),
    modifierBody:
      args.modifierBody ??
      (variant === 'away'
        ? "The days you're away are cleared. Clear this note to bring them back."
        : 'Your week is being kept tighter around limited availability.'),
    modifierAffects: ['current_week'],
    rules: variant === 'away'
      ? ['sessions on the days you’re away']
      : severity >= 7
      ? ['max-effort sessions this week', 'long accessory blocks']
      : ['long sessions this week', 'optional accessory volume'],
    safeFocus: ['Short, targeted sessions', 'Skill / technique work', 'Recovery + mobility'],
    advice: [],
  };
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
    return { kind: 'move_session', fromDate: action.payload.fromDate, toDate: action.payload.toDate };
  }
  if (action.type === 'bin_session') {
    return { kind: 'remove_session', date: action.payload.date, scope: action.payload.scope };
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
    setManualOverride: context.setManualOverride ?? defaultSetManualOverride,
    trace: risk.trace,
  });
  return {
    ok: result.ok,
    changedProgram: result.ok && result.appliedDates.length > 0,
    requiresRebuild: false,
    message: result.message,
    fallbackToCoach: false,
    route: route.route,
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
          setManualOverride: (date, workout, overrideContext) =>
            (context.setManualOverride ?? defaultSetManualOverride)(
              date,
              workout,
              withActiveProgramModifierContext(overrideContext, activeModifierId),
            ),
        });
        if (!planResult.ok) {
          return {
            ok: false,
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
      const todayISO = action.payload.todayISO ?? context.todayISO ?? action.payload.date;
      if (action.payload.level === 'cooked') {
        useReadinessStore.getState().clearReadinessSignal(todayISO);
        const modifierId = upsertTapLoadReductionModifier({ date: action.payload.date, todayISO });
        return {
          ok: true,
          changedProgram: true,
          requiresRebuild: false,
          createdModifierIds: [modifierId],
          fallbackToCoach: false,
          route: route.route,
        };
      }
      if (action.payload.level === 'sore') {
        useReadinessStore.getState().setReadinessSignal(todayISO, {
          soreness: 'moderate',
          source: 'quick_check',
        });
      } else {
        useReadinessStore.getState().setReadinessSignal(todayISO, {
          energy: 'low',
          flatToday: action.payload.level === 'worse',
          source: 'quick_check',
        });
      }
      // Garbage-collect dormant past-date signals now that we've written
      // today's — only today's signal is ever read downstream.
      useReadinessStore.getState().pruneBefore(todayISO);
      return {
        ok: true,
        changedProgram: true,
        requiresRebuild: false,
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_poor_sleep_status': {
      const store = useCoachUpdatesStore.getState();
      for (const constraint of store.activeConstraints.filter(isPoorSleepConstraint)) {
        store.removeActiveConstraint(constraint.id);
      }
      const constraint = buildPoorSleepReadinessConstraint({
        date: action.payload.date,
        pattern: action.payload.pattern,
      });
      store.upsertActiveConstraint(constraint);
      return {
        ok: true,
        changedProgram: true,
        requiresRebuild: false,
        createdModifierIds: [constraint.id],
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
    case 'clear_fatigue_status':
    case 'clear_exercise_preference':
    case 'clear_active_modifier':
      return clearModifierFromPayload(action.payload, route);
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
      const todayISO = action.payload.todayISO ?? context.todayISO ?? action.payload.date;
      const preset = temporaryEquipmentPresetById(action.payload.presetId);
      if (preset.clearsActiveEquipment) {
        const store = useCoachUpdatesStore.getState();
        const equipmentConstraints = store.activeConstraints
          .filter((constraint): constraint is ActiveEquipmentConstraint => constraint.type === 'equipment');
        for (const constraint of equipmentConstraints) {
          store.removeActiveConstraint(constraint.id);
        }
        return {
          ok: true,
          changedProgram: equipmentConstraints.length > 0,
          requiresRebuild: equipmentConstraints.length > 0,
          clearedModifierIds: equipmentConstraints.map((constraint) =>
            `program-modifier:active_constraint:${constraint.id}`),
          fallbackToCoach: false,
          route: route.route,
        };
      }
      const constraint = buildTemporaryEquipmentConstraint({
        presetId: action.payload.presetId as Exclude<TemporaryEquipmentPresetId, 'back_to_normal'>,
        date: action.payload.date,
        todayISO,
        source: 'tap',
      });
      const result = upsertActiveEquipmentConstraint(constraint);
      return {
        ok: true,
        changedProgram: true,
        requiresRebuild: result.rebuildRequired,
        createdModifierIds: [result.modifierId],
        fallbackToCoach: false,
        route: route.route,
      };
    }
    case 'set_schedule_modifier': {
      const todayISO = action.payload.todayISO ?? context.todayISO ?? action.payload.date;
      // Away/holiday: an explicit day-clearing change rides alongside the
      // schedule note. The note OWNS those overrides (tagged with its id +
      // recorded as linkedOverrideDates), so clearing the note restores the
      // days — the same ownership pattern recovery mode uses.
      const variant: 'busy' | 'away' = action.payload.planChange ? 'away' : 'busy';
      const scheduleId = scheduleModifierIdForDate(action.payload.date, variant);
      let appliedDates: string[] = [];
      let message: string | undefined;
      if (action.payload.planChange) {
        if (!context.visibleWeek) {
          return fallbackResult(
            action,
            { route: 'guided_follow_up_sheet', reason: 'Visible week context is required.' },
            'Cannot safely clear away days without the current visible week.',
          );
        }
        const planResult = applyPlanChange({
          change: action.payload.planChange,
          visibleWeek: context.visibleWeek,
          todayISO,
          setManualOverride: (date, workout, overrideContext) =>
            (context.setManualOverride ?? defaultSetManualOverride)(
              date,
              workout,
              withActiveProgramModifierContext(overrideContext, scheduleId),
            ),
        });
        if (!planResult.ok) {
          return {
            ok: false,
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
      const constraint = buildTapScheduleModifier({
        date: action.payload.date,
        todayISO,
        severity: action.payload.severity,
        reasonLabel: action.payload.reasonLabel,
        maxSessionsThisWeek: action.payload.maxSessionsThisWeek,
        variant,
        linkedOverrideDates: appliedDates,
        modifierTitle: action.payload.modifierTitle,
        modifierBody: action.payload.modifierBody,
      });
      useCoachUpdatesStore.getState().upsertActiveConstraint(constraint);
      return {
        ok: true,
        changedProgram: true,
        requiresRebuild: false,
        createdModifierIds: [constraint.id],
        message,
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
  if (action.type === 'move_session') return 'move_session';
  if (action.type === 'add_to_day' || action.type === 'add_exercise') return 'add_session';
  if (action.type === 'update_game_day') return 'game_day_change';
  if (action.type === 'set_injury_modifier' || action.type === 'clear_injury_modifier') {
    return 'injury_change';
  }
  if (action.type === 'set_equipment_modifier') return 'equipment_change';
  if (action.type === 'set_fatigue_status' || action.type === 'set_poor_sleep_status' ||
    action.type === 'clear_fatigue_status') return 'readiness_change';
  if (action.type.startsWith('clear_') || action.type === 'clear_active_modifier') {
    return 'clear_adjustment';
  }
  if (action.type === 'set_recovery_mode') return 'go_lighter';
  return 'program_change';
}

function diagnosticActionDate(action: ProgramControlAction): string | undefined {
  if (action.type === 'move_session') return action.payload.fromDate;
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
  if (action.type !== 'move_session' && action.type !== 'bin_session') {
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
  return {
    ok: false,
    changedProgram: false,
    requiresRebuild: false,
    message: 'reason' in transaction
      ? transaction.reason
      : 'The accepted session change could not be persisted.',
    fallbackToCoach: false,
    route: routeProgramControlAction(action).route,
  };
}
