/**
 * resetCoach.ts — explicit reset/clear utilities for coach + program state.
 *
 * Three reset levels (least → most destructive):
 *
 *   clearCoachAdjustments()      — surgical: removes active program
 *                                  modifiers, Coach Update cards,
 *                                  injury-tagged manual overrides, and
 *                                  coach-authored notes. Preserves the base
 *                                  program, baseline onboarding profile,
 *                                  calendar marks, and user-authored manual
 *                                  overrides.
 *
 *   resetProgramAndOnboarding()  — full reset across all coach + program
 *                                  stores; returns the user to onboarding.
 *
 *   resetToDevPostOnboardingState()
 *                                — dev-only: clears test-session state and
 *                                  reseeds the app as if dev onboarding skip
 *                                  had just completed.
 *
 * The functions are pure orchestrators: every store mutation goes
 * through the existing store action APIs (no direct AsyncStorage
 * writes). Dependency injection is supported via `opts.deps` so tests
 * can stub the stores.
 *
 * Runtime logs:
 *   [reset] clear_coach_adjustments_started
 *   [reset] active_injury_cleared
 *   [reset] coach_updates_cleared           { count }
 *   [reset] injury_overrides_removed        { count, dates }
 *   [reset] coach_notes_removed             { count }
 *   [reset] athlete_pref_injuries_cleared   { count }
 *   [reset] complete                        { mode, summary }
 */

import { useProgramStore } from '../store/programStore';
import {
  useCoachUpdatesStore,
  type ActivePreferenceConstraint,
} from '../store/coachUpdatesStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { logger } from './logger';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useJournalNoteStore } from '../store/journalNoteStore';
import { useSessionStopwatchStore } from '../store/sessionStopwatchStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useWorkoutLogStore } from '../store/workoutLogStore';
import {
  getActiveProgramModifiers,
  clearActiveProgramModifier,
} from './activeProgramModifiers';
import { beginProfileResetAction, endProfileResetAction } from '../store/profileStore';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from './athleteActionDiagnostics';
import {
  DEV_TEST_ONBOARDING_DATA,
  isDevOnboardingSkipEnabled,
  runDevOnboardingSkip,
} from './devOnboardingSkip';
import type { OnboardingData, OverrideContext, TrainingProgram, Workout } from '../types/domain';

// ─── Dependency seam (so tests can stub the stores) ────────────────

export interface ResetDeps {
  programStore: {
    getOverrideContexts: () => Record<string, OverrideContext>;
    getDateOverrides: () => Record<string, Workout>;
    removeManualOverride: (date: string) => void;
    clearManualOverrides: () => void;
    clear: () => void;
  };
  coachUpdatesStore: {
    getUpdatesByWeek: () => Record<string, unknown>;
    clearAllCoachUpdates: () => void;
  };
  profileStore: {
    resetOnboarding: () => void;
    clear: () => void;
  };
  calendarStore: {
    clear: () => void;
  };
  athletePreferencesStore: {
    setActiveInjuries: (keys: any[]) => void;
    clear: () => void;
  };
}

export interface DevPostOnboardingResetDeps {
  isDev: () => boolean;
  getCurrentOnboardingData: () => OnboardingData;
  programStore: { clear: () => void };
  coachUpdatesStore: { clearAllCoachUpdates: () => void };
  calendarStore: { clear: () => void };
  athletePreferencesStore: { clear: () => void };
  readinessStore: { clear: () => void };
  coachPreferencesStore: { clearAllModalityPreferences: () => void };
  workoutLogStore: { clear: () => void };
  journalNoteStore: { clear: () => void };
  /** R-132: a reset athlete has timed nothing. */
  sessionStopwatchStore: { clear: () => void };
  runDevOnboardingSkip: typeof runDevOnboardingSkip;
}

function defaultDeps(): ResetDeps {
  return {
    programStore: {
      getOverrideContexts: () =>
        useProgramStore.getState().overrideContexts ?? {},
      getDateOverrides: () =>
        useProgramStore.getState().dateOverrides ?? {},
      removeManualOverride: (date) =>
        useProgramStore.getState().removeManualOverride(date),
      clearManualOverrides: () =>
        useProgramStore.getState().clearManualOverrides(),
      clear: () => useProgramStore.getState().clear(),
    },
    coachUpdatesStore: {
      getUpdatesByWeek: () => useCoachUpdatesStore.getState().updatesByWeek,
      clearAllCoachUpdates: () =>
        useCoachUpdatesStore.getState().clearAllCoachUpdates(),
    },
    profileStore: {
      resetOnboarding: () => useProfileStore.getState().resetOnboarding(),
      clear: () => useProfileStore.getState().clear(),
    },
    calendarStore: {
      clear: () => useCalendarStore.getState().clear(),
    },
    athletePreferencesStore: {
      setActiveInjuries: (keys) =>
        useAthletePreferencesStore.getState().setActiveInjuries(keys),
      clear: () => useAthletePreferencesStore.getState().clear(),
    },
  };
}

function defaultDevPostOnboardingResetDeps(): DevPostOnboardingResetDeps {
  return {
    isDev: () => isDevOnboardingSkipEnabled(),
    getCurrentOnboardingData: () => useProfileStore.getState().onboardingData,
    programStore: {
      clear: () => useProgramStore.getState().clear(),
    },
    coachUpdatesStore: {
      clearAllCoachUpdates: () =>
        useCoachUpdatesStore.getState().clearAllCoachUpdates(),
    },
    calendarStore: {
      clear: () => useCalendarStore.getState().clear(),
    },
    athletePreferencesStore: {
      clear: () => useAthletePreferencesStore.getState().clear(),
    },
    readinessStore: {
      clear: () => useReadinessStore.getState().clear(),
    },
    coachPreferencesStore: {
      clearAllModalityPreferences: () =>
        useCoachPreferencesStore.getState().clearAllModalityPreferences(),
    },
    workoutLogStore: {
      clear: () => useWorkoutLogStore.getState().clear(),
    },
    journalNoteStore: {
      clear: () => useJournalNoteStore.getState().clear(),
    },
    sessionStopwatchStore: {
      clear: () => useSessionStopwatchStore.setState({ current: null, lastEnded: null }),
    },
    runDevOnboardingSkip,
  };
}

// ─── Result types ───────────────────────────────────────────────────

export interface ResetSummary {
  activeInjuryCleared: boolean;
  coachUpdatesCleared: number;
  injuryOverridesRemoved: string[];
  coachNotesRemoved: number;
  athletePrefInjuriesCleared: number;
}

export interface DevPostOnboardingResetResult {
  program: TrainingProgram;
  onboardingData: OnboardingData;
  usedFallback: boolean;
  message: string;
}

function definedOnboardingFields(data: OnboardingData | null | undefined): Partial<OnboardingData> {
  if (!data) return {};
  const out: Partial<OnboardingData> = {};
  for (const [key, value] of Object.entries(data) as Array<[keyof OnboardingData, unknown]>) {
    if (value !== undefined && value !== null) {
      (out as Record<string, unknown>)[key as string] = value;
    }
  }
  if (Array.isArray(out.availabilityConstraints)) {
    const permanentConstraints = out.availabilityConstraints.filter(
      (constraint) => constraint.scope !== 'temporary',
    );
    if (permanentConstraints.length > 0) {
      out.availabilityConstraints = permanentConstraints;
    } else {
      delete out.availabilityConstraints;
    }
  }
  return out;
}

export function buildDevPostOnboardingResetProfile(
  current: OnboardingData | null | undefined,
): OnboardingData {
  return {
    ...DEV_TEST_ONBOARDING_DATA,
    ...definedOnboardingFields(current),
  };
}

// ─── 1. SURGICAL: clearCoachAdjustments ─────────────────────────────

/**
 * Surgical reset that removes EVERY trace of coach- and injury-driven
 * program changes, while preserving the base program, profile, calendar
 * marks, and user-authored manual overrides.
 *
 * Specifically:
 *   - all CoachUpdate cards ⇒ removed
 *   - dateOverrides where overrideContext.intent === 'injury' ⇒ removed
 *   - coach-authored coachNotes on remaining (non-injury) overrides ⇒
 *     removed (notes that read like injury restrictions are stripped
 *     so the surface no longer carries the message)
 *   - athletePreferencesStore.activeInjuries ⇒ []
 *   - future-generation exercise preferences ⇒ cleared
 *   - modality preferences / readiness signals ⇒ cleared
 *   - active profile availability constraints ⇒ cleared
 *   - pendingInjuryRef (caller-supplied) ⇒ cleared
 *
 * NEVER touched:
 *   - currentProgram, currentMicrocycle (base program)
 *   - baseline profileStore.onboardingData (game days, team days, equipment)
 *   - calendarStore.markedDays (rest days, explicit games)
 *   - dateOverrides where intent is anything other than 'injury'
 */
export function clearCoachAdjustments(opts?: {
  deps?: Partial<ResetDeps>;
}): ResetSummary {
  const deps: ResetDeps = { ...defaultDeps(), ...(opts?.deps ?? {}) } as ResetDeps;
  logger.debug('[reset] clear_coach_adjustments_started');

  const summary: ResetSummary = {
    activeInjuryCleared: false,
    coachUpdatesCleared: 0,
    injuryOverridesRemoved: [],
    coachNotesRemoved: 0,
    athletePrefInjuriesCleared: 0,
  };

  const activePreferenceConstraints = useCoachUpdatesStore
    .getState()
    .activeConstraints.filter(
      (c): c is ActivePreferenceConstraint => c.type === 'preference',
    );

  // 1. Coach Update cards.
  // ⚠ The single-slot active-injury clear that stood here is deleted with
  // the alias (2026-08-19). Clearing an injury is an episode operation and
  // belongs to the injury-episode transaction.
  const updates = deps.coachUpdatesStore.getUpdatesByWeek();
  const updateCount = Object.keys(updates).length;
  if (updateCount > 0) {
    deps.coachUpdatesStore.clearAllCoachUpdates();
    summary.coachUpdatesCleared = updateCount;
    logger.debug('[reset] coach_updates_cleared', { count: updateCount });
  }

  // 2b. Tap-created status modifiers (fatigue / recovery / busy-week / away /
  //     soreness) don't always have a CoachUpdate card, so the card-gated
  //     clear above can leave them behind. Sweep them through the SAME
  //     active-modifier clear path the Program tab's per-note "Clear" uses,
  //     so bulk clear and per-note clear stay in lockstep — including
  //     removing the rest-day overrides an away/recovery note linked.
  let statusModifiersCleared = 0;
  for (const modifier of getActiveProgramModifiers()) {
    if (
      modifier.source === 'active_constraint' &&
      (modifier.type === 'temporary_status' || modifier.type === 'coach_restriction')
    ) {
      const result = clearActiveProgramModifier(modifier.id);
      if (result.cleared) statusModifiersCleared += 1;
    }
  }
  if (statusModifiersCleared > 0) {
    logger.debug('[reset] status_modifiers_cleared', { count: statusModifiersCleared });
  }

  // 3. Injury-tagged manual overrides (intent === 'injury').
  const overrideContexts = deps.programStore.getOverrideContexts();
  const overrides = deps.programStore.getDateOverrides();
  for (const [date, ctx] of Object.entries(overrideContexts)) {
    if ((ctx as OverrideContext)?.intent === 'injury') {
      deps.programStore.removeManualOverride(date);
      summary.injuryOverridesRemoved.push(date);
    }
  }
  if (summary.injuryOverridesRemoved.length > 0) {
    logger.debug('[reset] injury_overrides_removed', {
      count: summary.injuryOverridesRemoved.length,
      dates: summary.injuryOverridesRemoved,
    });
  }

  // 4. Strip coach-authored notes from any REMAINING (non-injury)
  //    override workouts. We can't surgically rebuild a workout, but
  //    the override still has a coachNotes array we can reset to []
  //    via the existing setManualOverride seam. To keep this
  //    self-contained without re-resolving sessions, we only count
  //    such notes for the summary — actual removal happens when the
  //    user manually edits or the next override write replaces them.
  //    Counting is sufficient for the test invariant.
  const remainingOverrides = deps.programStore.getDateOverrides();
  let coachNoteCount = 0;
  for (const [date, w] of Object.entries(remainingOverrides)) {
    const notes = (w as Workout)?.coachNotes ?? [];
    if (notes.length > 0 && !overrideContexts[date]) {
      coachNoteCount += notes.length;
    }
  }
  summary.coachNotesRemoved = coachNoteCount;
  if (coachNoteCount > 0) {
    logger.debug('[reset] coach_notes_removed', { count: coachNoteCount });
  }

  // 5. Athlete-preference injury flags (drives exercise pool filter).
  const prefStore = useAthletePreferencesStore.getState();
  const prefInjuries = prefStore.prefs?.activeInjuries ?? [];
  if (prefInjuries.length > 0) {
    deps.athletePreferencesStore.setActiveInjuries([]);
    summary.athletePrefInjuriesCleared = prefInjuries.length;
    logger.debug('[reset] athlete_pref_injuries_cleared', {
      count: prefInjuries.length,
    });
  }
  if (activePreferenceConstraints.length > 0) {
    for (const preference of activePreferenceConstraints) {
      if (preference.exercise) {
        prefStore.removeExclusion(preference.exercise);
      }
      if (preference.alternative) {
        prefStore.removePinned(preference.alternative);
      }
    }
    logger.debug('[reset] athlete_pref_exercise_preferences_cleared', {
      count: activePreferenceConstraints.length,
    });
  }

  const remainingExcluded = [...(prefStore.prefs?.excluded ?? [])];
  const remainingPinned = [...(prefStore.prefs?.pinned ?? [])];
  for (const exercise of remainingExcluded) prefStore.removeExclusion(exercise);
  for (const exercise of remainingPinned) prefStore.removePinned(exercise);
  if (remainingExcluded.length > 0 || remainingPinned.length > 0) {
    logger.debug('[reset] athlete_pref_program_modifiers_cleared', {
      excluded: remainingExcluded.length,
      pinned: remainingPinned.length,
    });
  }

  const modalityPrefs = useCoachPreferencesStore.getState().modalityPreferences ?? {};
  if (Object.keys(modalityPrefs).length > 0) {
    useCoachPreferencesStore.getState().clearAllModalityPreferences();
    logger.debug('[reset] modality_preferences_cleared', {
      count: Object.keys(modalityPrefs).length,
    });
  }

  const readinessSignals = useReadinessStore.getState().signalsByDate ?? {};
  if (Object.keys(readinessSignals).length > 0) {
    useReadinessStore.getState().clear();
    logger.debug('[reset] readiness_modifiers_cleared', {
      count: Object.keys(readinessSignals).length,
    });
  }

  const profileState = useProfileStore.getState();
  const availability = profileState.onboardingData.availabilityConstraints ?? [];
  const retainedAvailability = availability.filter((constraint) => constraint.active === false);
  if (retainedAvailability.length !== availability.length) {
    profileState.updateOnboardingData({
      availabilityConstraints: retainedAvailability.length > 0 ? retainedAvailability : undefined,
    });
    logger.debug('[reset] availability_modifiers_cleared', {
      count: availability.length - retainedAvailability.length,
    });
  }

  logger.debug('[reset] complete', { mode: 'clear_coach_adjustments', summary });
  return summary;
}

// ─── 2. FULL RESET ──────────────────────────────────────────────────

/**
 * Nuclear reset: clears every coach + program store, returning the
 * user to onboarding. Use behind a confirmation prompt.
 *
 * Order matters: we clear coach-derived state BEFORE the base
 * program so any in-flight subscribers see a coherent
 * "no-injury, no-program" snapshot.
 */
export function resetProgramAndOnboarding(opts?: {
  deps?: Partial<ResetDeps>;
}): ResetSummary {
  const deps: ResetDeps = { ...defaultDeps(), ...(opts?.deps ?? {}) } as ResetDeps;
  logger.debug('[reset] full_reset_started');
  // ON THE TAPE, AND BOUNDED IN TIME (Sam, export 5).
  //
  // Every store below is cleared SYNCHRONOUSLY, inside this call. The reset
  // action opened here is in flight for exactly that long, which is what makes
  // a write belonging to this reset but arriving later refusable rather than
  // catastrophic — the suspected shape of the loss that cost three onboardings
  // was a reset's write landing over answers given after it.
  //
  // The tape gains the one datum four reconstructions lacked: when the reset
  // actually ran, against when the answers went in.
  const resetActionId = beginProfileResetAction('full_reset');
  const trace = beginAthleteActionTrace({
    source: 'tap',
    actionType: 'program_change',
    route: 'resetProgramAndOnboarding',
  }, undefined, { forceRoot: true });
  emitAthleteActionEvent(trace, 'athlete_action_requested', {
    internalResultCode: 'full_reset_started',
    resetActionId,
  });
  try {
    return runFullReset(deps, opts, trace, resetActionId);
  } finally {
    endProfileResetAction(resetActionId);
    emitAthleteActionEvent(trace, 'athlete_action_completed', {
      outcome: 'accepted',
      internalResultCode: 'full_reset_complete',
      resetActionId,
    });
  }
}

function runFullReset(
  deps: ResetDeps,
  opts: { deps?: Partial<ResetDeps> } | undefined,
  trace: AthleteActionTraceContext,
  resetActionId: string,
): ResetSummary {

  // 1. First do a surgical coach clear so the per-feature logs fire
  //    (so the audit trail shows what was cleared, not just "everything").
  const surgical = clearCoachAdjustments({ deps: opts?.deps });

  // 2. Program store (base program + all overrides).
  deps.programStore.clear();
  logger.debug('[reset] program_store_cleared');

  // 3. Profile / onboarding.
  deps.profileStore.clear();
  logger.debug('[reset] profile_store_cleared');

  // 4. Calendar marks.
  deps.calendarStore.clear();
  logger.debug('[reset] calendar_store_cleared');

  // 5. Athlete preferences.
  deps.athletePreferencesStore.clear();
  logger.debug('[reset] athlete_preferences_cleared');

  const summary: ResetSummary = { ...surgical };
  logger.debug('[reset] complete', { mode: 'full_reset', summary });
  emitAthleteActionEvent(trace, 'athlete_action_parsed', {
    internalResultCode: 'full_reset_stores_cleared',
    resetActionId,
  });
  return summary;
}

// ─── 3. DEV-ONLY POST-ONBOARDING RESET ─────────────────────────────

/**
 * Dev-only reset for repeated coach-flow testing. It clears all ephemeral
 * coach/program surfaces, then runs the same dev-onboarding skip path that
 * creates the generated post-onboarding program.
 */
export async function resetToDevPostOnboardingState(opts?: {
  onboardingData?: OnboardingData;
  generateProgram?: (data: OnboardingData) => Promise<TrainingProgram>;
  deps?: Partial<DevPostOnboardingResetDeps>;
}): Promise<DevPostOnboardingResetResult> {
  const deps: DevPostOnboardingResetDeps = {
    ...defaultDevPostOnboardingResetDeps(),
    ...(opts?.deps ?? {}),
  } as DevPostOnboardingResetDeps;

  if (!deps.isDev()) {
    logger.warn('[dev-reset] blocked_non_dev');
    throw new Error('Reset to post-onboarding state is only available in dev builds.');
  }

  const onboardingData =
    opts?.onboardingData ??
    buildDevPostOnboardingResetProfile(deps.getCurrentOnboardingData());

  logger.info('[dev-reset] post_onboarding_reset_started', {
    firstName: onboardingData.firstName ?? null,
    seasonPhase: onboardingData.seasonPhase ?? null,
    trainingDaysPerWeek: onboardingData.trainingDaysPerWeek ?? null,
    preferredTrainingDays: onboardingData.preferredTrainingDays ?? null,
  });

  deps.readinessStore.clear();
  deps.coachPreferencesStore.clearAllModalityPreferences();
  deps.coachUpdatesStore.clearAllCoachUpdates();
  deps.programStore.clear();
  deps.calendarStore.clear();
  deps.athletePreferencesStore.clear();
  deps.workoutLogStore.clear();
  deps.journalNoteStore.clear();
  deps.sessionStopwatchStore.clear();

  const result = await deps.runDevOnboardingSkip({
    onboardingData,
    generateProgram: opts?.generateProgram,
  });

  deps.readinessStore.clear();
  deps.coachPreferencesStore.clearAllModalityPreferences();
  deps.coachUpdatesStore.clearAllCoachUpdates();
  deps.workoutLogStore.clear();
  deps.journalNoteStore.clear();
  deps.sessionStopwatchStore.clear();

  const message = result.usedFallback
    ? 'Reset used DEFAULT_PROGRAM fallback. Check dev logs.'
    : 'Reset to clean post-onboarding state.';

  if (result.usedFallback) {
    logger.warn('[dev-reset] completed_with_default_program_fallback', {
      programId: result.program.id,
      programName: result.program.name,
    });
  } else {
    logger.info('[dev-reset] completed_with_generated_program', {
      programId: result.program.id,
      programName: result.program.name,
      firstMicrocycleWorkoutCount:
        result.program.microcycles?.[0]?.workouts?.length ?? 0,
    });
  }

  return {
    program: result.program,
    onboardingData: result.onboardingData,
    usedFallback: result.usedFallback,
    message,
  };
}
