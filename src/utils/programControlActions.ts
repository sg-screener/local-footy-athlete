import { athleteActionSourceForDoor, planChangeSourceForDoor } from '../rules/athleteActionSourceLabel';
import { applyProgramOverrideWrite, useProgramStore } from '../store/programStore';
import { logger } from './logger';
import {
  useCoachUpdatesStore,
  type ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useProfileStore } from '../store/profileStore';
import type { OverrideContext, Workout, WorkoutExercise } from '../types/domain';
import { getMondayForDate, type ResolvedDay } from './sessionResolver';
import { resolveDateWithConditioning } from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
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
import { applyExerciseExclusionDecision } from './exerciseExclusionOwner';
// The latch carries NO imports of its own, so it cannot join the module cycle
// this file's ledger-append site documents at length.
import { ledgerReplayActive } from '../store/ledgerReplayLatch';
import { applyExclusionsToAuthoredDay } from '../rules/exerciseExclusions';
import { injuryWithholdingsOn } from '../rules/injuryWithheldRows';
import { liveAthleteExclusions } from './liveEvaluationSurfaces';
import {
  sessionRowNames,
  describeVisibleInjuryChange,
  injuryRecompositionMessage,
  planInjuryRecomposition,
  unsafeRowsForInjury,
  type InjuryRecompositionPlan,
  type InjurySubstitution,
} from './injurySessionRecomposition';
import {
  banExerciseGlobally,
  setPreferredAlternative,
  replaceExerciseAtDate,
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
  type TapSwapEnvironment,
  type TapSwapPrimaryInjury,
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
  reportedLevelDeloads,
  type TemporaryAthleteReportedLevel,
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
import { durableStateFactScope, readinessDeloadFactScope } from '../rules/durableFactHorizon';
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

// THE ACTION VOCABULARY NOW LIVES IN `types/programControlAction.ts`.
//
// It moved because the decision ledger records it verbatim and therefore has to
// name it, and importing it from here closed a module cycle that silently broke
// an unrelated type guard in this very file (the reason is written out in full
// at the top of that module). Re-exported so no caller moved.
export type {
  ProgramControlActionType,
  ProgramControlScope,
  ProgramControlScreen,
  ProgramControlActionSource,
  ProgramControlAction,
} from '../types/programControlAction';
import type {
  ProgramControlActionType,
  ProgramControlScope,
  ProgramControlAction,
} from '../types/programControlAction';

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

/**
 * WHICH ROW THE ATHLETE MEANT — id first, then name, and AMBIGUITY IS AN ANSWER.
 *
 * Kept here rather than reusing `coachActions.findExerciseMatch` because that
 * module's removal path is the coach-override one this door just stopped using,
 * and a shared helper would be the seam that quietly pulls it back in.
 */
/**
 * The exercise NAMES the athlete can see on a day, in order. The unit the
 * injury door's honesty is measured in — see the note at its `set_injury_modifier`
 * arm, and `injurySessionRecomposition.describeVisibleInjuryChange`.
 */
/**
 * The rows an active injury is WITHHOLDING on a date — present, and not to be
 * done. Read through the same resolver the athlete's week comes from, so this
 * cannot answer about a different session than the one on screen.
 */
function injuryWithheldNamesOn(dateISO: string): string[] {
  try {
    return injuryWithholdingsOn({
      workout: resolveWorkoutOnDate(dateISO),
      dateISO,
      facts: useProgramStore.getState().acceptedMaterialContext?.temporarySourceFacts,
    }).map((entry) => entry.exercise);
  } catch {
    return [];
  }
}

function visibleExerciseNamesOn(dateISO: string): string[] {
  if (!dateISO) return [];
  const workout = applyExclusionsToAuthoredDay({
    workout: resolveWorkoutOnDate(dateISO),
    dateISO,
    exclusions: liveAthleteExclusions(),
  });
  return ((workout?.exercises ?? []) as { exercise?: { name?: string } }[])
    .map((row) => row.exercise?.name ?? '')
    .filter((name): name is string => name.length > 0);
}

/** The day as the athlete is seeing it, through the one resolver. */
function resolveWorkoutOnDate(dateISO: string): Workout | null {
  const state = buildScheduleStateImperative();
  const resolved = resolveDateWithConditioning(dateISO, state);
  return (resolved?.workout as Workout | undefined) ?? null;
}

function findRemovableExerciseIndex(
  workout: Workout,
  exerciseName: string,
  exerciseId: string | undefined,
): { kind: 'found'; index: number } | { kind: 'not_found' } | { kind: 'ambiguous' } {
  const rows = workout.exercises ?? [];
  if (exerciseId) {
    const wanted = String(exerciseId);
    const byId = rows.findIndex((row) => [
      (row as { id?: string }).id,
      (row as { exerciseId?: string }).exerciseId,
      (row as { exercise?: { id?: string } }).exercise?.id,
    ].filter(Boolean).some((candidate) => String(candidate) === wanted));
    if (byId >= 0) return { kind: 'found', index: byId };
  }
  const wantedName = String(exerciseName ?? '').trim().toLowerCase();
  if (!wantedName) return { kind: 'not_found' };
  const matches: number[] = [];
  rows.forEach((row, index) => {
    const name = String(
      (row as { exercise?: { name?: string } }).exercise?.name
      ?? (row as { name?: string }).name
      ?? '',
    ).trim().toLowerCase();
    if (name === wantedName) matches.push(index);
  });
  if (matches.length === 1) return { kind: 'found', index: matches[0]! };
  if (matches.length > 1) return { kind: 'ambiguous' };
  return { kind: 'not_found' };
}

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
    doorSource: planChangeSourceForDoor(action.source),
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
      /**
       * ⚠ **THE DOOR REFUSES AN UNSAFE PICK. A REPLAY DOES NOT RE-JUDGE ONE.**
       *
       * Sam, 2026-08-19: *"Startup may replay the accepted decisions and facts,
       * but it must not make a new choice or silently discard anything."*
       *
       * This gate is right when the athlete is CHOOSING: it stops them picking
       * a replacement that their live injury or kit forbids. It was also
       * running during ledger replay, where the same decision is being
       * RECONSTRUCTED — and there it silently threw the athlete's swap away.
       *
       * MEASURED ON GLASS 2026-08-19, after the staleness refusal one layer up
       * was already removed: the athlete swapped `RDLs -> Hip Thrusts`, then
       * declared a knee injury and a missing barbell, and the next launch
       * printed
       *   `swap_exercise dl-1 "The replacement still loads the active knee issue."`
       *   `swap_exercise dl-1 "barbell equipment is not available."`
       * and their session came back with `RDLs` on it. Two facts declared AFTER
       * the decision were vetoing the decision itself.
       *
       * **THE DECISION LANDS; ITS LEGALITY IS THE FACTS' BUSINESS.** The swap is
       * replayed, and the injury/equipment pass that runs after it displaces the
       * row through the approved ladder and says why (`substitutedFrom`). That
       * is the same order the athlete lived, so the restart reproduces the same
       * session — and their preference is still underneath, ready to come back
       * when the constraint lifts.
       */
      const safety = ledgerReplayActive()
        ? { safe: true as const, reason: undefined }
        : assessTapSwapCandidateSafety(action.payload.toExercise!.name, environment);
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
        substitutedFrom: action.payload.substitutedFrom,
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
      // ── REMOVE MEANS REMOVE, AND IT IS ONE DECISION ──────────────────────
      //
      // Sam, 2026-08-19: *"Remove means simply remove the selected
      // exercise/component. Nothing replaces it. The session may have fewer
      // exercises and may lose that movement pattern. **Do not ask the composer
      // to fill the empty slot.**"* And: *"No second removal authority
      // survives."*
      //
      // THE DECISION IS THE ONLY THING WRITTEN. `applyExerciseExclusionDecision`
      // stores one record — the exercise, the scope and the stamped expiry — and
      // two projections read it and nothing else:
      //
      //   READ  `rules/exerciseExclusions.applyExclusionsToAuthoredDay`, applied
      //         at `utils/sessionResolver`, takes the row off every remaining
      //         already-authored session inside the decision's span. That is
      //         *"this block removes it from every remaining already-authored
      //         session in this block"*.
      //   AUTHOR `services/api/generateProgram.composerExclusionInput` keeps it
      //         out of blocks the app has not authored yet. That is *"until
      //         restored removes it from current and future sessions/blocks"*.
      //
      // **NOTHING IS DESTROYED, SO NOTHING HAS TO BE REBUILT TO UNDO IT.** The
      // authored row stays in the stored program; the decision hides it. Undo
      // and Restore delete the decision and the EXACT item is back — which is
      // Sam's requirement stated as a mechanism rather than as a repair.
      //
      // ⚠ **TWO EARLIER AUTHORITIES ARE GONE FROM THIS DOOR.**
      // `coachActions.removeExerciseAtDate` cloned the day and wrote the result
      // as a COACH OVERRIDE (`writeCoachOverride`), patching the visible week
      // with the transaction bypassed. Its replacement,
      // `commitAthleteSessionDeletionTransaction`, was correct for TODAY and
      // could not speak for a block: a dated constraint answers one date, and
      // an athlete who says "this block" means every session in it. Both are
      // off this path, and `removeExerciseAtDate` is deleted outright.
      const removalDate = action.payload.date.slice(0, 10);
      const removalOriginal = resolveWorkoutOnDate(removalDate);
      if (!removalOriginal) {
        return {
          ok: false,
          changedProgram: false,
          requiresRebuild: false,
          message: `There is no session on ${removalDate} to remove anything from.`,
          fallbackToCoach: false,
          route: route.route,
        };
      }
      const removalTarget = findRemovableExerciseIndex(
        removalOriginal,
        action.payload.exercise,
        action.payload.exerciseId,
      );
      if (removalTarget.kind !== 'found') {
        // TYPED, never a shrug. The athlete asked for something the session does
        // not carry, or carries twice under one name. Asked BEFORE the decision
        // is written, so a removal that cannot name its target writes nothing.
        return {
          ok: false,
          changedProgram: false,
          requiresRebuild: false,
          message: removalTarget.kind === 'ambiguous'
            ? `"${action.payload.exercise}" matches more than one exercise on ${removalDate}.`
            : `Could not find "${action.payload.exercise}" on ${removalDate}.`,
          fallbackToCoach: false,
          route: route.route,
        };
      }
      // THE ROW'S OWN NAME, not the caller's spelling. A removal matched by id
      // may have been asked for under a display name the exclusion's canonical
      // identity would never match, and a decision keyed on the wrong name is a
      // decision that hides nothing.
      const removalRow = removalOriginal.exercises![removalTarget.index] as
        { exercise?: { name?: string }; name?: string };
      const removalIdentity = String(
        removalRow.exercise?.name ?? removalRow.name ?? action.payload.exercise,
      );
      const removalDecision = applyExerciseExclusionDecision({
        exercise: removalIdentity,
        // "Future weeks too" is the athlete saying *until I change it*. It is
        // the same question the day screen asks after the tap, so it resolves to
        // the same three-answer vocabulary rather than to a second one.
        scope: action.payload.futureWeeksToo || action.scope === 'future_weeks'
          ? 'until_changed'
          : 'today_only',
        decidedOnISO: removalDate,
      });
      if (!removalDecision.ok || !removalDecision.exclusion) {
        return {
          ok: false,
          changedProgram: false,
          requiresRebuild: false,
          message: `That removal could not be saved (${removalDecision.reason ?? 'unknown'}).`,
          fallbackToCoach: false,
          route: route.route,
        };
      }
      return {
        ok: true,
        changedProgram: true,
        // NO REBUILD. Nothing regenerates for a removal — a rebuild is exactly
        // the thing that would let the composer choose a replacement.
        requiresRebuild: false,
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
          doorSource: planChangeSourceForDoor(action.source),
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
  // ONE OWNER: the label is derived from the DOOR (see rules/athleteActionSourceLabel).
  // It used to read `initiatedBy`, which answers "was this a human?" and cannot
  // tell the coach card from the Program tab — the field that misdirected a
  // whole pass of Sam's investigation on 2026-08-10.
  const source: AthleteActionSource = athleteActionSourceForDoor(action.source);
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
  // THE TRIP IS THE HORIZON (item 28). The athlete gave a leave date and a
  // return date; the window between them is the fact, and no scope word can
  // improve on it.
  const span = action.payload.awaySpan;
  if (span) {
    return temporaryFactScope({
      kind: 'window',
      from: span.from.slice(0, 10),
      until: span.until.slice(0, 10),
    });
  }
  // THE BREAK IS THE HORIZON TOO (item 31 part 5) — with one difference the
  // trip never has: an END THE ATHLETE HAS NOT BEEN ASKED FOR YET. `until:
  // null` is the open window `durableFactHorizon` already understands, so the
  // December answer needs no placeholder date and no second representation.
  const breakSpan = action.payload.noTeamTrainingSpan;
  if (breakSpan) {
    return breakSpan.until === null
      ? temporaryFactScope({ kind: 'open', from: breakSpan.from.slice(0, 10) })
      : temporaryFactScope({
          kind: 'window',
          from: breakSpan.from.slice(0, 10),
          until: breakSpan.until.slice(0, 10),
        });
  }
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
    source: athleteActionSourceForDoor(action.source),
    actionType: diagnosticActionType(action),
    // THE SCREEN, THEN THE SURFACE — the same shape the synchronous door above
    // uses, and it was NOT the same until 2026-08-12. This read
    // `${surface ?? screen}`, and since every durable caller sets a surface the
    // SCREEN never reached the tape at all. `route` is the field that saved the
    // 2026-08-10 investigation (`rules/athleteActionSourceLabel.ts` writes that
    // story out); on this door it could not have, because the one thing it was
    // asked to answer — which door — was the part being dropped.
    route: `program_control_durable:${action.source.screen}:${action.source.surface ?? 'default'}`,
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


/**
 * EVERY ACTIVE INJURY, OLDEST FIRST — the order the athlete lived them in.
 *
 * ⚠ **DERIVED FROM THE FACTS, SO BOOT AND THE LIVE DOOR AGREE FOREVER.** The
 * live door knows which injury was just declared; boot does not. Ordering by the
 * stored stamps means the replay produces the identical sequence, which is the
 * whole reason the athlete's session does not re-shuffle on relaunch.
 *
 * The constraint being applied is folded in even when the store has not settled
 * it yet, so the live pass and the replay see the same list.
 */
function injuryStagesInDeclarationOrder(
  pending: ActiveInjuryConstraint,
): ActiveInjuryConstraint[] {
  const constraints = (useCoachUpdatesStore.getState().activeConstraints ?? [])
    .filter((constraint) => constraint.type === 'injury' && constraint.status === 'active');
  const merged = constraints.some((constraint) => constraint.id === pending.id)
    ? [...constraints]
    : [...constraints, pending as never];
  return merged
    .slice()
    .sort((left, right) => {
      const byStart = String((left as { startDate?: string }).startDate ?? '')
        .localeCompare(String((right as { startDate?: string }).startDate ?? ''));
      if (byStart !== 0) return byStart;
      const byUpdated = String((left as { lastUpdatedAt?: string }).lastUpdatedAt ?? '')
        .localeCompare(String((right as { lastUpdatedAt?: string }).lastUpdatedAt ?? ''));
      if (byUpdated !== 0) return byUpdated;
      return String((left as { id?: string }).id ?? '')
        .localeCompare(String((right as { id?: string }).id ?? ''));
    })
    .filter((constraint) => Boolean((constraint as { bucket?: string }).bucket)) as ActiveInjuryConstraint[];
}

/** The `TapSwapPrimaryInjury` a stage's constraint stands for. */
function stagePrimaryInjury(constraint: ActiveInjuryConstraint): TapSwapPrimaryInjury {
  return {
    bucket: constraint.bucket as TapSwapPrimaryInjury['bucket'],
    severity: constraint.severity,
    seriousSymptoms: constraint.seriousSymptoms === true,
  };
}

/**
 * THE SESSION AS IT WOULD LOOK WITH ONE STAGE APPLIED — in memory, written
 * nowhere.
 *
 * Only the NAMES move: this exists so the next stage plans against the rows the
 * athlete would be looking at, and every real write still goes through
 * `swap_exercise` at the end. A withheld row stays exactly where it is, which is
 * R-115's rule and is why omissions are not removed here.
 */
function applyPlanToWorkout(
  workout: Workout | null,
  plan: { substitutions: readonly { from: string; to: { name: string | null } }[] },
): Workout | null {
  if (!workout || plan.substitutions.length === 0) return workout;
  const replacement = new Map(
    plan.substitutions
      .filter((entry) => entry.to.name)
      .map((entry) => [entry.from.toLowerCase(), entry.to.name!]),
  );
  return {
    ...workout,
    exercises: (workout.exercises ?? []).map((row) => {
      const name = (row as { exercise?: { name?: string } }).exercise?.name ?? '';
      const next = replacement.get(String(name).toLowerCase());
      return next
        ? { ...row, exercise: { ...(row as { exercise?: object }).exercise, name: next } }
        : row;
    }) as Workout['exercises'],
  };
}

/**
 * THE INJURY PASS'S INPUTS, ASSEMBLED ONCE — SO THE REVIEW AND THE WRITE CANNOT
 * DISAGREE ABOUT WHAT THE INJURY DOES.
 *
 * Sam, 2026-08-20: the Active Session injury flow must *"show one review of all
 * proposed changes"* and then *"apply the approved changes together"*. A review
 * is a PROMISE, and the only way a promise is kept is if the thing that made it
 * and the thing that keeps it ask the identical question of the identical world.
 *
 * ⚠ **A SECOND BUILDER IS THE DEFECT THIS FUNCTION EXISTS TO PREVENT.** Measured
 * on 2026-08-20 in a different unit: a preview built from its own re-derived
 * arguments disagreed with the delivered program in **40 of 90** prescriptions.
 * So the review screen does not re-derive anything — it calls THIS, exactly as
 * `recomposeSessionForInjury` does, and hands the plan it was shown straight
 * back to the door.
 *
 * ⚠ **THE ONE THING THAT MOVES BETWEEN THE TWO CALLS IS THE FACT ITSELF.** The
 * review runs BEFORE `set_injury_modifier` stores the constraint, the write runs
 * AFTER, so `activeConstraints` differs by exactly this injury. That difference
 * is closed by passing the pending constraint as `primaryInjury`:
 * `resolveTapSwapEnvironment` folds it into `injurySeverities` (and, since this
 * unit, into `medicalStop`) whether or not it is stored yet. Every OTHER injury
 * on the athlete is stored in both worlds and reaches both calls identically.
 *
 * ⚠ **`seriousSymptoms` USED TO BE HARD-CODED `false` HERE.** That was harmless
 * while this was the only caller — the stored constraint set `medicalStop` a
 * line later anyway — but it is exactly the field the unstored review has no
 * other way of learning, so it is read from the constraint now. For the write
 * path this changes nothing: the same flag arrives from the stored constraint.
 *
 * WRITER: none, pure read of the live stores. READERS: `recomposeSessionForInjury`
 * (the write) and `utils/sessionInjuryReview` (the review).
 * TEST: `test:session-injury-review` section [1].
 */
export function resolveInjuryRecompositionInputs(args: {
  date: string;
  constraint: ActiveInjuryConstraint;
}): {
  workout: Workout | null;
  environment: TapSwapEnvironment;
  primaryInjury: TapSwapPrimaryInjury | null;
  trainingPaused: boolean;
} {
  /**
   * ⚠ **THE SESSION THE ATHLETE CAN SEE, NOT THE ONE UNDERNEATH IT.**
   *
   * `resolveWorkoutOnDate` returns the AUTHORED day, which still carries every
   * row an exclusion is currently hiding — the filter is a READ-time projection
   * and this is not a read door. Measured 2026-08-19 by
   * `npm run test:session-change-sequence`: an athlete removed `RDLs`, then
   * declared a knee injury, and the injury pass "made safe" the very row they
   * had already taken out. **An injury pass had quietly consumed the athlete's
   * own decision.** An exercise the athlete has removed is not unsafe — it is
   * not there. Sam's *"Injury and ordinary Remove must remain separate"*
   * (2026-08-20) is the same boundary stated from the other side.
   */
  const workout = applyExclusionsToAuthoredDay({
    workout: resolveWorkoutOnDate(args.date),
    dateISO: args.date,
    exclusions: liveAthleteExclusions(),
  });
  const trainingPaused = args.constraint.adjustmentLevel === 'training_paused';
  const primaryInjury = args.constraint.bucket
    ? {
      bucket: args.constraint.bucket as TapSwapPrimaryInjury['bucket'],
      severity: args.constraint.severity,
      seriousSymptoms: args.constraint.seriousSymptoms === true,
    }
    : null;
  const environment = resolveTapSwapEnvironment({
    date: args.date,
    profile: useProfileStore.getState().onboardingData,
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    readinessSignal: useReadinessStore.getState().signalsByDate[args.date],
    primaryInjury,
  });
  return { workout, environment, primaryInjury, trainingPaused };
}

/**
 * APPLY THE INJURY PLAN TO THE ATHLETE'S OWN SESSION, AND REPORT WHAT HAPPENED.
 *
 * ⚠ **THE `remainingUnsafe` COUNT IS MEASURED AFTER THE WRITES, FROM THE REAL
 * SESSION — NEVER PREDICTED FROM THE PLAN.** A prediction is exactly what the
 * deleted claim was: `visibleProgramChanged` was a true statement about a
 * transaction, read as a statement about rows. So the session is re-read through
 * the same door the screen uses, and the sentence is derived from that.
 *
 * SCOPE, STATED: the athlete's own dated session. The injury constraint already
 * governs every week the composer authors from here on
 * (`generateProgramLocally` reads active constraints); this is the half nothing
 * regenerates — the day in front of them.
 */
function recomposeSessionForInjury(args: {
  date: string;
  constraint: ActiveInjuryConstraint;
  source: ProgramControlAction['source'];
}): { changed: boolean; message: string } {
  // The session, the environment and the exclusion boundary are assembled by
  // `resolveInjuryRecompositionInputs` above — the SAME call the review screen
  // makes, which is what makes the review a promise this door keeps.
  const { workout, environment, primaryInjury, trainingPaused } =
    resolveInjuryRecompositionInputs(args);
  if (!workout) {
    return {
      changed: false,
      message: trainingPaused
        ? 'Affected training is paused until you get medical or physio advice.'
        : 'Injury restrictions are active. There is no session on this day to change.',
    };
  }
  /**
   * ── STACKED INJURIES ACT ON THE SESSION THE ATHLETE COULD SEE ─────────────
   *
   * Sam, 2026-08-20: *"Stacked injuries operate on the session the athlete could
   * see before the newest injury."*
   *
   * ⚠ **THIS SETTLE USED TO RE-PLAN EVERY ACTIVE INJURY JOINTLY, FROM THE
   * AUTHORED WEEK.** MEASURED, knee 7/10 then shoulder 7/10 on one day: the
   * second pass planned against `Leg Press` — the authored row — and never saw
   * the `Chest-Supported DB Row` the first injury had put there and the athlete
   * had been looking at all week. Two things fell out of that, and they are the
   * same defect seen from two sides: the row's *"Swapped from"* named an
   * exercise the athlete could not see (R-121), and the REVIEW — which is built
   * from the visible day — promised changes the settle then made differently.
   *
   * **So the injuries are applied IN DECLARATION ORDER, each against the result
   * of the one before it.** Stage k plans against the day as it stands after
   * stages 0..k-1, which IS "the session the athlete could see before this
   * injury". The newest stage therefore plans against exactly what the review
   * planned against, and the two agree by construction rather than by a name
   * derivation bolted on afterwards.
   *
   * ⚠ **EVERY STAGE STILL CHECKS SAFETY WITH ALL ACTIVE INJURIES.** Sam's
   * requirement, and it is what makes the sequence converge: an earlier
   * injury's answer that a later injury forbids is caught, because the earlier
   * stage's own environment already carries the later injury's severity. The
   * ORDER decides which row each substitution is named against; it never widens
   * what counts as safe.
   */
  const stages = injuryStagesInDeclarationOrder(args.constraint);

  // WHAT ACTUALLY LANDED. A plan is not an outcome: each write goes through the
  // ordinary action owner and can be refused by it, and counting the PLAN would
  // be the same class of claim this whole unit exists to delete.
  const appliedSubstitutions: InjurySubstitution[] = [];
  const appliedOmissions: string[] = [];
  const refused: string[] = [];
  /** The authored exercise each slot began as, carried across stages. */
  const authoredOrigin = new Map<string, string>();
  const unsafeSeen = new Set<string>();

  /**
   * ⚠ **EACH STAGE WRITES BEFORE THE NEXT ONE PLANS, AND IT HAS TO.**
   *
   * An in-memory sequence was written first and did not work: stage 2's rows
   * only exist once stage 1's swaps are on the day, so its `swap_exercise`
   * calls named exercises the live session did not carry and were refused. The
   * day IS the state these stages hand to each other.
   */
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]!;
    /**
     * ⚠ **STAGE k SEES THE INJURIES THAT EXISTED BY STAGE k, AND NOT THE ONES
     * AFTER IT.** This was the full environment first, and it did not work: the
     * day is reset to the authored week before this pass, so stage 1 re-planned
     * the athlete's FIRST injury while already knowing about the second — and
     * answered it differently from the session they had been looking at. Then
     * stage 2 had nothing of theirs to act on and the naming reverted to
     * authored rows, which is the very thing R-121 forbids.
     *
     * **THE FINAL ANSWER IS STILL CHECKED AGAINST EVERY ACTIVE INJURY** (Sam's
     * requirement) because the LAST stage carries them all: an earlier stage's
     * answer that a later injury forbids is unsafe in the later stage's world,
     * so that stage replaces it. The sequence reproduces the athlete's history
     * and the final state is safe against all of it.
     */
    const stageConstraints = [
      ...(useCoachUpdatesStore.getState().activeConstraints ?? [])
        .filter((constraint) => constraint.type !== 'injury'),
      ...stages.slice(0, index + 1),
    ];
    const stageWorkout = applyExclusionsToAuthoredDay({
      workout: resolveWorkoutOnDate(args.date),
      dateISO: args.date,
      exclusions: liveAthleteExclusions(),
    });
    if (!stageWorkout) break;
    const stagePlan = planInjuryRecomposition({
      workout: stageWorkout,
      environment: resolveTapSwapEnvironment({
        date: args.date,
        profile: useProfileStore.getState().onboardingData,
        activeConstraints: stageConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[args.date],
        primaryInjury: stagePrimaryInjury(stage),
      }),
      primaryInjury: stagePrimaryInjury(stage),
    });
    for (const name of stagePlan.unsafeRows) unsafeSeen.add(name);

    for (const substitution of stagePlan.substitutions) {
      const origin = authoredOrigin.get(substitution.from) ?? substitution.from;
      const outcome = executeProgramControlAction({
        type: 'swap_exercise',
        source: args.source,
        scope: 'today_only',
        payload: {
          date: args.date,
          fromExercise: substitution.from,
          toExercise: {
            name: substitution.to.name!,
            sets: substitution.to.prescription?.sets ?? 3,
            repsMin: substitution.to.prescription?.repsMin ?? 8,
            repsMax: substitution.to.prescription?.repsMax ?? 12,
          },
          /**
           * R-121: the name the athlete reads is the row this substitution
           * actually replaced, and because the stage planned against the
           * session they could see, `substitution.from` IS that row.
           * `originExerciseName` carries the authored exercise when the two
           * differ — internal history, rendered nowhere.
           */
          substitutedFrom: {
            baseExerciseName: substitution.from,
            ...(origin !== substitution.from ? { originExerciseName: origin } : {}),
            cause: 'injury',
          },
        },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: true,
      } as ProgramControlAction);
      if (outcome.ok) {
        if (substitution.to.name) authoredOrigin.set(substitution.to.name, origin);
        // A row this pass already replaced is superseded, not listed twice.
        const superseded = appliedSubstitutions
          .findIndex((entry) => entry.to.name === substitution.from);
        if (superseded >= 0) appliedSubstitutions.splice(superseded, 1);
        appliedSubstitutions.push(substitution);
      } else refused.push(`${substitution.from} (${outcome.message ?? 'refused'})`);
    }
    /* ── AN OMISSION IS WITHHELD, NOT REMOVED ────────────────────────────
     *
     * **Sam, 2026-08-20 (R-115):** *"An 8-10 injury with serious symptoms must
     * NEVER write into the athlete's Remove list or permanently alter the
     * accepted program."* This loop used to call `remove_exercise`, whose
     * `today_only` scope lands in `athletePreferencesStore.exclusions` — the
     * athlete's OWN decisions. MEASURED before the ruling, red-flag hamstring
     * 9/10: five exclusions the athlete never made, and because Restore works by
     * RE-DERIVING, it replayed them and **the day was empty forever.**
     *
     * Nothing is written. `rules/injuryWithheldRows` marks the rows at the VIEW
     * doors from the injury FACT, so the accepted program keeps every row and
     * its load, the athlete sees why each one is unavailable, and clearing the
     * injury reveals the original session by doing nothing at all. They are
     * still reported as omissions here — the sentence must name them. */
    for (const omission of stagePlan.omissions) {
      if (!appliedOmissions.includes(omission)) appliedOmissions.push(omission);
    }
  }

  const plan: InjuryRecompositionPlan = {
    unsafeRows: Array.from(unsafeSeen),
    substitutions: appliedSubstitutions,
    omissions: appliedOmissions,
    untouched: [],
  };
  if (refused.length > 0) {
    logger.debug('[injury-recomposition] writes refused', { date: args.date, refused });
  }

  const after = applyExclusionsToAuthoredDay({
    workout: resolveWorkoutOnDate(args.date),
    dateISO: args.date,
    exclusions: liveAthleteExclusions(),
  });
  const remainingUnsafe = unsafeRowsForInjury({ workout: after, environment });
  const applied: InjuryRecompositionPlan = {
    ...plan,
    substitutions: appliedSubstitutions,
    omissions: appliedOmissions,
  };
  return {
    changed: appliedSubstitutions.length > 0 || appliedOmissions.length > 0,
    message: injuryRecompositionMessage({ plan: applied, remainingUnsafe, trainingPaused }),
  };
}

/**
 * ── THE ATHLETE'S ACTIVE INJURIES, RE-APPLIED AT BOOT AFTER THE LEDGER REPLAY ──
 *
 * Sam, 2026-08-19: *"Apply this when the injury/equipment action occurs — not
 * for the first time during startup. … Startup may replay the accepted
 * decisions and facts, but it must not make a new choice or silently discard
 * anything."*
 *
 * **THE INJURY EPISODE IS DURABLE; ITS RECOMPOSITION WAS NOT.** The episode
 * survives a process death — `activeConstraints` still reads `["injury-knee"]`
 * after hydration — but the rows it changed are written to `dateOverrides`,
 * which boot blanks by design and rebuilds from the decision ledger. The injury
 * is not a ledger decision (`LEDGER_RECORDED_ACTION_TYPES` is deliberately the
 * three exercise-level types, so that one act never becomes two undoable
 * decisions), so nothing put the recomposition back and the athlete's session
 * came back the pre-injury one.
 *
 * **THIS IS A REPLAY OF A FACT, NOT A NEW DECISION.** It mints no ledger entry,
 * takes no transaction, and runs the SAME owner the live action ran
 * (`recomposeSessionForInjury`) over the SAME day the live action changed — the
 * constraint's own `startDate`, which is the day it was declared on. Same
 * inputs, same approved ladder, same answer.
 *
 * **ORDER IS THE WHOLE POINT.** It runs AFTER the ledger replay, because that is
 * the order the athlete lived: they swapped, and then they got hurt. Running it
 * before would judge an injury against a session the athlete had not edited yet,
 * and their swap would land on top of the safe row and undo the safety.
 *
 * WRITER: `store/quiescentBoot` (boot) and the `set_injury_modifier` arm (live).
 * READER: the athlete's session. TEST: `test:session-change-durability` [6].
 */
export function reapplyActiveInjuryRecompositions(): { days: number } {
  const constraints = useCoachUpdatesStore.getState().activeConstraints ?? [];
  let days = 0;
  for (const constraint of constraints) {
    if (constraint.type !== 'injury' || constraint.status !== 'active') continue;
    const date = String((constraint as { startDate?: string }).startDate ?? '').slice(0, 10);
    if (!date) continue;
    const outcome = recomposeSessionForInjury({
      date,
      constraint: constraint as ActiveInjuryConstraint,
      // SYSTEM, because nobody tapped anything: this is the world being rebuilt.
      source: { screen: 'session_detail', surface: 'exercise_injury_flow', initiatedBy: 'system' },
    });
    if (outcome.changed) days += 1;
  }
  return { days };
}

async function executeProgramControlActionDurablyWithinTrace(
  action: ProgramControlAction,
  context: ProgramControlActionContext,
): Promise<ProgramControlActionResult> {
  if (action.type === 'set_injury_modifier') {
    /**
     * ⚠ **THE ROWS ARE READ BEFORE THE FACT LANDS, AND THE CLAIM COMES FROM THE
     * DIFFERENCE.**
     *
     * `createOrUpdateInjuryEpisode` settles the derived world on its way out,
     * and that settle now re-applies active injuries (Sam's ruling: the fact is
     * applied when the action occurs, and startup only replays it). So by the
     * time `recomposeSessionForInjury` runs below, the work is usually already
     * done and its own pass reports nothing — which said *"Nothing on this
     * session needed changing"* over a session that had just lost two rows.
     *
     * The honest measure is the athlete's own rows, before and after.
     */
    const injuryRowsBefore = visibleExerciseNamesOn(
      (action.payload.constraint?.startDate ?? context.todayISO ?? '').slice(0, 10),
    );
    const result = await createOrUpdateInjuryEpisode({
      constraint: action.payload.constraint!,
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface: action.source.surface ?? action.source.screen,
      todayISO: context.todayISO,
    });
    const ok = result.outcome !== 'conflicted' && result.outcome !== 'safely_rejected';
    if (!ok) {
      return {
        ok,
        changedProgram: result.changedProgram,
        requiresRebuild: false,
        message: result.message,
        fallbackToCoach: false,
        route: routeProgramControlAction(action).route,
      };
    }
    // ── THE SESSION IS ACTUALLY RECOMPOSED, AND THE CLAIM IS DERIVED ────────
    //
    // Sam, 2026-08-19: *"Delete the false-success path ... Never say 'safely
    // recomposed' unless visible content actually changed appropriately."*
    //
    // ⚠ **THE OLD SENTENCE CAME FROM `visibleProgramChanged`, WHICH IS ABOUT
    // STORED STATE, NOT ABOUT ROWS.** Measured
    // (`npm run probe:injury-recompose`): declaring a knee injury returned
    // `ok=true changedProgram=true` with the message *"affected sessions were
    // safely recomposed"*, while the visible session was BYTE-IDENTICAL and
    // `RDLs` and `Bulgarian Split Squats` were still on it. A hamstring at
    // severity 8 — `training_paused` — behaved the same way.
    //
    // So the recomposition is performed here, over the athlete's own session,
    // through the SAME action owners their taps use: an injury substitution is a
    // `swap_exercise` and an injury omission is a `remove_exercise`. There is no
    // private injury writer, and `planInjuryRecomposition` reads the approved
    // fallback ladder rather than a second opinion about safety.
    const injuryDate = (context.todayISO ?? action.payload.constraint!.startDate
      ?? '').slice(0, 10);
    // Still called, and still the owner: it catches anything the settle did not
    // reach, and it is the ONLY writer here. Normally it is a no-op now.
    const recomposition = recomposeSessionForInjury({
      date: injuryDate,
      constraint: action.payload.constraint!,
      source: action.source,
    });
    // WHAT THE ATHLETE CAN SEE, not what the store did and not which pass did
    // it. `unsafeRowsForInjury` over the final day supplies the honest refusal
    // arm, exactly as before.
    const injuryRowsAfter = visibleExerciseNamesOn(injuryDate);
    const visible = describeVisibleInjuryChange({
      before: injuryRowsBefore,
      after: injuryRowsAfter,
      remainingUnsafe: unsafeRowsForInjury({
        workout: applyExclusionsToAuthoredDay({
          workout: resolveWorkoutOnDate(injuryDate),
          dateISO: injuryDate,
          exclusions: liveAthleteExclusions(),
        }),
        environment: resolveTapSwapEnvironment({
          date: injuryDate,
          profile: useProfileStore.getState().onboardingData,
          activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
          readinessSignal: useReadinessStore.getState().signalsByDate[injuryDate],
          primaryInjury: action.payload.constraint!.bucket
            ? {
              bucket: action.payload.constraint!.bucket as never,
              severity: action.payload.constraint!.severity,
              seriousSymptoms: false,
            }
            : null,
        }),
      }) as string[],
      trainingPaused: action.payload.constraint!.adjustmentLevel === 'training_paused',
    });
    return {
      ok,
      changedProgram: visible.changed || recomposition.changed,
      requiresRebuild: false,
      createdModifierIds: result.episodeId ? [result.episodeId] : undefined,
      message: visible.changed ? visible.message : recomposition.message,
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
    /* ── THE RESOLVE'S CLAIM IS DERIVED FROM THE ROWS TOO ──────────────────
     *
     * Sam, 2026-08-19: *"Never say 'safely recomposed' unless visible content
     * actually changed appropriately."* The SET path was fixed for that; its
     * twin was not, and it says the same words.
     *
     * **MEASURED, in a medical-stop world (`seriousSymptoms: true`, hamstring
     * 9/10):** the injury omitted all five rows, `clear_injury_modifier`
     * returned *"Injury resolved. Affected sessions were safely recomposed."*
     * and the session was **still empty** — none of the five came back. The
     * sentence was the deleted false-success claim, arriving from the
     * resolution end.
     *
     * The cause is recorded and NOT fixed here: an injury OMISSION is written
     * through `remove_exercise`, which lands in the athlete's own exclusion
     * ledger, so re-deriving replays it as if the athlete had chosen it.
     * Substitutions restore correctly because nothing durable holds them. That
     * is an ownership question about the removal authority, which another lane
     * signed — see `docs/STATUS_FINISH_INJURY.md`. Until it is ruled, the
     * athlete is told the truth rather than told it worked. */
    const resolveDate = (context.todayISO ?? '').slice(0, 10);
    const rowsBeforeResolve = resolveDate ? visibleExerciseNamesOn(resolveDate) : [];
    /* ⚠ **A WITHHELD ROW IS STILL ON THE DAY, SO NAMES ALONE CANNOT SEE IT
     * COME BACK.** Since the omission stopped writing anything, clearing a
     * red-flag injury changes no NAME — it lifts the marks. Comparing only
     * names answered "Nothing on this session needed changing" over a session
     * that had just become usable again, which is the same false claim from the
     * other direction. */
    const withheldBeforeResolve = resolveDate
      ? injuryWithheldNamesOn(resolveDate).length
      : 0;
    const result = await resolveInjuryEpisode(episodeId, {
      sourceActor: action.source.initiatedBy === 'system' ? 'system' : 'athlete',
      sourceSurface: action.source.surface ?? action.source.screen,
      todayISO: context.todayISO,
    });
    const rowsAfterResolve = resolveDate ? visibleExerciseNamesOn(resolveDate) : [];
    const withheldAfterResolve = resolveDate ? injuryWithheldNamesOn(resolveDate).length : 0;
    const rowsCameBack = rowsAfterResolve.length > rowsBeforeResolve.length
      || rowsAfterResolve.some((name) => !rowsBeforeResolve.includes(name))
      || withheldAfterResolve < withheldBeforeResolve;
    /* ⚠ **THE "STILL EMPTY" ARM IS GONE, AND SAM'S RULING IS WHERE IT WENT.**
     *
     * It existed because an injury omission emptied the day permanently, so the
     * resolve had to admit the exercises had not come back. Under his ruling of
     * 2026-08-20 nothing is ever removed — the rows are WITHHELD at the view
     * door and the accepted program is untouched — so a session cleared of its
     * injury cannot be empty for that reason. Kept as a branch it was
     * UNMUTATABLE (mutation M11 survived: inverting it changed nothing in any
     * world), which is a clause not doing the work its comment claims, and on a
     * genuine REST day it would have fired and told the athlete their session
     * was missing. */
    const ok = result.outcome === 'resolved_and_recomposed' ||
      result.outcome === 'resolved_no_program_change' ||
      result.outcome === 'already_resolved';
    return {
      ok,
      changedProgram: result.changedProgram,
      requiresRebuild: false,
      clearedModifierIds: ok ? [episodeId] : undefined,
      message: !ok
        ? result.message
        : withheldBeforeResolve > 0 && withheldAfterResolve === 0
          ? 'Injury cleared. Your usual exercises are available again.'
          : rowsCameBack
            ? result.message
            : 'Injury cleared. Nothing on this session needed changing.',
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
    //
    // THE SPAN IS THE AWAY ANSWER — SEAT_INBOX 22(c). A `missing_for_span`
    // decision carries the athlete's return date, so the fact is scoped to a
    // WINDOW and stops applying after it: the modifier lifts itself with no
    // second decision for the athlete to remember. `missing_this_week` keeps
    // the week scope it always had.
    //
    // `kind: 'window'` IS NOT NEW MACHINERY — it has been in
    // `TemporarySourceFactScope` all along with `from`/`until`, and the
    // equipment path simply hard-coded `{ kind: 'week' }` and never reached
    // for it. That is why "an equipment answer with a start and an end date"
    // is a scope argument here rather than a new fact shape.
    // THE SESSION SCOPE IS A ONE-DAY WINDOW, and it is written the same way the
    // other two are. `kind: 'date'` resolves to `from === until === date`, so
    // `equipmentConstraintAppliesToDate` admits it on exactly the session's own
    // day and `expireTemporarySourceFacts` retires it the next — which is what
    // makes "for this session only" true of the STORED fact and not merely of
    // the receipt sentence the athlete was shown.
    const scope = decision.kind === 'missing_for_span'
      ? temporaryFactScope({
          kind: 'window',
          from: decision.from.slice(0, 10),
          until: decision.until.slice(0, 10),
        })
      : decision.kind === 'missing_for_session'
        ? temporaryFactScope({ kind: 'date', date })
        : temporaryFactScope({ kind: 'week', date });
    const fact = createTemporaryEquipmentFact({
      observedDate: date,
      scope,
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
    const awaySpan = action.payload.awaySpan;
    const breakSpan = action.payload.noTeamTrainingSpan;
    const shortOnTimeToday = awayDates.length === 0 && !awaySpan && !breakSpan &&
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
          // ONE FACT ID FOR BOTH ANSWERS (item 31 part 5). The stable id is
          // derived from the day the club stops and NOTHING ELSE, so when the
          // January answer arrives with the same `from` and a real `until`, the
          // transaction matches the December fact and REPLACES it rather than
          // laying a second break beside the first. The default id includes the
          // scope, which changes the moment the end date is known — that would
          // have left two overlapping breaks and no way to tell which one won.
          ...(breakSpan
            ? { factId: `temporary-source-fact:v1:no-team-training:${breakSpan.from.slice(0, 10)}` }
            : {}),
          scheduleKind: breakSpan
            ? 'no_team_training'
            : awayDates.length > 0 || awaySpan
              ? 'travel'
              : action.payload.maxSessionsThisWeek !== undefined ? 'max_sessions' : 'busy_week',
          // A SPAN-SHAPED TRIP MARKS NO DATE UNAVAILABLE, and that is the whole
          // difference between it and the door it replaced. `unavailableDates`
          // means "there is no training on this day at all", which collapsed
          // the athlete's own gym session along with the club's night. What
          // being away DOES is decided at the deriving seam, from the day's
          // PARTS: club-bound work goes, solo work stays.
          unavailableDates: awaySpan || breakSpan ? [] : awayDates,
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
    // ONE reading of the athlete's answer, used for BOTH the reported level and
    // the scope. They were two separate ternaries over the same `level`, which
    // is how the scope could say "one day" while the level said "wrecked".
    // Guarded by the action type: only `set_fatigue_status` carries a `level`;
    // the poor-sleep variant carries a `pattern` and never reaches the fatigue
    // mint below.
    const reportedReadinessLevel: TemporaryAthleteReportedLevel =
      action.type === 'set_fatigue_status'
        ? (action.payload.level === 'cooked'
            ? 'cooked'
            : action.payload.level === 'worse'
              ? 'high'
              : action.payload.level === 'not_right' ? 'moderate' : 'slight')
        : 'slight';
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
            // COOKED IS A 7-DAY WINDOW, NOT AN OPEN HOLD (census A1). It used
            // to take `durableStateFactScope` — illness's open horizon, which
            // never elapses — so one tap deloaded the athlete forever. Sam's
            // ruling is that readiness and illness differ in exactly this.
            // R-038: "Wrecked" IS SEVEN DAYS TOO, NOT JUST "absolutely cooked".
            // This read `level === 'cooked'`, so the window went to the top tier
            // and the middle one got a single DATE — a wrecked athlete was
            // deloaded for ONE day and back at full load by the second.
            // `reportedLevelDeloads` asks the law (level -> severity -> tier ->
            // directive) instead of matching a literal, so a new level or a
            // moved threshold cannot silently lose its window again.
            scope: reportedLevelDeloads(reportedReadinessLevel)
              ? readinessDeloadFactScope({ declaredOnISO: date, todayISO })
              : temporaryFactScope({ kind: 'date', date }),
            athleteReportedLevel: reportedReadinessLevel,
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
  if (transaction.ok) {
    // ── THE DECISION IS RECORDED HERE, AND ONLY HERE ────────────────────────
    //
    // `docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md` §4-§5. Until this
    // line the exercise-level destination wrote to `dateOverrides`, which
    // `partialize` does not persist and `rebuildDerivedWorld` empties — so the
    // athlete's edit was gone by morning, measured at
    // `npm run tape:exercise-edit-durability`.
    //
    // WHY AFTER THE TRANSACTION AND NOT INSIDE THE EXECUTOR. A decision is
    // recorded when it LANDED, not when it was attempted. The transaction is
    // what knows: it can roll the mutation back, and a ledger entry for a
    // rolled-back edit would be replayed forever onto a world that rejected it.
    //
    // WHY NOT SESSION-LEVEL ACTIONS. `move_session` and `bin_session` reach
    // this same block, and they already appended a `plan_change` inside
    // `applyPlanChange`. The allow-list in `rules/programControlDecisions.ts`
    // is what keeps one act from becoming two decisions — which the athlete
    // would feel as an undo that needs two taps.
    //
    // Replay is safe by construction: `appendDecisionEntry` returns early while
    // the replay latch is held, so a replayed action never re-records itself.
    // LAZY REQUIRES, AND THE REASON IS A MEASUREMENT RATHER THAN A HABIT.
    //
    // The ledger's `program_control` kind carries `ProgramControlAction`, which
    // is declared in THIS file — so a static `import { appendDecisionEntry }`
    // closes a module cycle (`programControlActions` -> `decisionLedgerStore`
    // -> `types/decisionLedger` -> `programControlActions`). That cycle is not
    // harmless here: with it in place `tsc -p tsconfig.devtools.json` reported
    // FOUR errors in this file, none of them at the edit — three
    // `Property 'factId' does not exist on type 'TemporarySourceFact'` at
    // :1265-:1300 and a union assignment at :1290. Resolution of an unrelated
    // discriminated union degraded because the cycle made this module's own
    // exports unresolved while it was being checked.
    //
    // The alternative was to weaken the ledger kind to `action: unknown`, which
    // clears the errors and gives up the whole claim the kind exists to make —
    // that the decision IS the action, checked by the compiler. Keeping the
    // type and deferring the require keeps both. Same dodge, same reason, as
    // the boot's replay interpreters one layer down.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { programControlDecisionFor } = require('../rules/programControlDecisions');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { appendDecisionEntry } = require('../store/decisionLedgerStore');
    const decision = programControlDecisionFor(action);
    if (decision && transaction.value.ok && transaction.value.changedProgram) {
      const outcome = appendDecisionEntry({
        decision,
        provenance: action.source.initiatedBy === 'system' ? 'system_fixture' : 'athlete_tap',
        writer: 'program_control',
      });
      if (!outcome.ok) {
        // THE EDIT STANDS AND THE FAILURE IS LOUD. Refusing the athlete's
        // applied change because bookkeeping failed would be a worse trade than
        // the durability gap this line exists to close — but an unrecorded edit
        // is one that vanishes at the next boot, so it can never be silent.
        logger.error('[programControl] the door applied an edit the ledger refused to record', {
          actionType: action.type,
          reason: (outcome as { reason?: string }).reason,
        });
      }
    }
    return transaction.value;
  }
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
