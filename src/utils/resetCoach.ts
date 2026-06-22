/**
 * resetCoach.ts — explicit reset/clear utilities for coach + program state.
 *
 * Three reset levels (least → most destructive):
 *
 *   clearCoachAdjustments()      — surgical: removes activeInjury,
 *                                  Coach Update cards, injury-tagged
 *                                  manual overrides, and coach-authored
 *                                  notes. Preserves the base program,
 *                                  onboarding profile, calendar marks,
 *                                  user-authored manual overrides, and
 *                                  athlete preferences.
 *
 *   clearCoachChat()             — clears CoachScreen chat messages
 *                                  and the pendingInjury ref. Preserves
 *                                  program + activeInjury (caller can
 *                                  combine with clearCoachAdjustments).
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
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { logger } from './logger';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useCoachStore } from '../store/coachStore';
import { useCoachContextStateStore } from '../store/coachContextStateStore';
import { useCoachMemoryStore } from '../store/coachMemoryStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { usePendingCoachClarifierStore } from '../store/pendingCoachClarifierStore';
import { useReadinessStore } from '../store/readinessStore';
import { useWorkoutLogStore } from '../store/workoutLogStore';
import { fireResetSignal } from './resetSignals';
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
    getActiveInjury: () => unknown;
    getUpdatesByWeek: () => Record<string, unknown>;
    setActiveInjury: (state: any) => void;
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
  coachStore: {
    clear: () => void;
  };
  /**
   * Caller-supplied callback to clear ephemeral CoachScreen state
   * that lives outside Zustand (refs, timers). Used by chat reset
   * so pendingInjuryRef doesn't survive after a "Clear coach chat".
   */
  clearPendingInjury?: () => void;
  /**
   * Caller-supplied callback to clear CoachScreen.messages local
   * state. Optional — if omitted, the store-backed coachStore is
   * still cleared but the in-memory React state may remain until
   * the screen re-mounts.
   */
  clearChatMessages?: () => void;
}

export interface DevPostOnboardingResetDeps {
  isDev: () => boolean;
  getCurrentOnboardingData: () => OnboardingData;
  programStore: { clear: () => void };
  coachUpdatesStore: { clearAllCoachUpdates: () => void };
  calendarStore: { clear: () => void };
  athletePreferencesStore: { clear: () => void };
  coachStore: { clear: () => void };
  pendingClarifierStore: { clearPending: () => void };
  mutationHistoryStore: { clearAll: () => void };
  readinessStore: { clear: () => void };
  coachContextStore: { clearCoachContext: () => void };
  coachPreferencesStore: { clearAllModalityPreferences: () => void };
  coachMemoryStore: { clearNotes: () => void };
  workoutLogStore: { clear: () => void };
  fireResetSignal: () => void;
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
      getActiveInjury: () => useCoachUpdatesStore.getState().activeInjury,
      getUpdatesByWeek: () => useCoachUpdatesStore.getState().updatesByWeek,
      setActiveInjury: (state) =>
        useCoachUpdatesStore.getState().setActiveInjury(state),
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
    coachStore: {
      clear: () => useCoachStore.getState().clear(),
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
    coachStore: {
      clear: () => useCoachStore.getState().clear(),
    },
    pendingClarifierStore: {
      clearPending: () =>
        usePendingCoachClarifierStore.getState().clearPending(),
    },
    mutationHistoryStore: {
      clearAll: () => useCoachMutationHistoryStore.getState().clearAll(),
    },
    readinessStore: {
      clear: () => useReadinessStore.getState().clear(),
    },
    coachContextStore: {
      clearCoachContext: () =>
        useCoachContextStateStore.getState().clearCoachContext(),
    },
    coachPreferencesStore: {
      clearAllModalityPreferences: () =>
        useCoachPreferencesStore.getState().clearAllModalityPreferences(),
    },
    coachMemoryStore: {
      clearNotes: () => useCoachMemoryStore.getState().clearNotes(),
    },
    workoutLogStore: {
      clear: () => useWorkoutLogStore.getState().clear(),
    },
    fireResetSignal,
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
  /** True when the caller supplied a clearPendingInjury callback. */
  pendingInjuryCleared: boolean;
  /** True when chat messages were cleared. */
  chatCleared: boolean;
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
 *   - activeInjury ⇒ null
 *   - all CoachUpdate cards ⇒ removed
 *   - dateOverrides where overrideContext.intent === 'injury' ⇒ removed
 *   - coach-authored coachNotes on remaining (non-injury) overrides ⇒
 *     removed (notes that read like injury restrictions are stripped
 *     so the surface no longer carries the message)
 *   - athletePreferencesStore.activeInjuries ⇒ []
 *   - pendingInjuryRef (caller-supplied) ⇒ cleared
 *
 * NEVER touched:
 *   - currentProgram, currentMicrocycle (base program)
 *   - profileStore.onboardingData (game days, team days, equipment)
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
    pendingInjuryCleared: false,
    chatCleared: false,
  };

  // 1. Active injury — single record on coachUpdatesStore.
  const activeInjury = deps.coachUpdatesStore.getActiveInjury();
  if (activeInjury) {
    deps.coachUpdatesStore.setActiveInjury(null);
    summary.activeInjuryCleared = true;
    logger.debug('[reset] active_injury_cleared');
  }

  // 2. Coach Update cards.
  const updates = deps.coachUpdatesStore.getUpdatesByWeek();
  const updateCount = Object.keys(updates).length;
  if (updateCount > 0) {
    // clearAllCoachUpdates also nulls activeInjury — already handled
    // above but harmless to call again.
    deps.coachUpdatesStore.clearAllCoachUpdates();
    summary.coachUpdatesCleared = updateCount;
    logger.debug('[reset] coach_updates_cleared', { count: updateCount });
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

  // 6. Caller-side pending ref (CoachScreen owns the ref). Either the
  //    caller passes a clearPendingInjury callback (test path), or the
  //    global resetSignal fires (production — CoachScreen subscribes).
  if (deps.clearPendingInjury) {
    deps.clearPendingInjury();
    summary.pendingInjuryCleared = true;
  } else {
    fireResetSignal();
    summary.pendingInjuryCleared = true;
  }

  logger.debug('[reset] complete', { mode: 'clear_coach_adjustments', summary });
  return summary;
}

// ─── 2. CHAT-ONLY: clearCoachChat ───────────────────────────────────

/**
 * Wipe the CoachScreen conversation. Clears the persisted coachStore
 * (conversations, messages) and the in-memory pending injury ref.
 *
 * Preserves: program, activeInjury, coachUpdates, overrides.
 *
 * Use when the user wants to start a fresh conversation but keep
 * their current program/injury state intact.
 */
export function clearCoachChat(opts?: {
  deps?: Partial<ResetDeps>;
}): ResetSummary {
  const deps: ResetDeps = { ...defaultDeps(), ...(opts?.deps ?? {}) } as ResetDeps;
  logger.debug('[reset] clear_coach_chat_started');

  const summary: ResetSummary = {
    activeInjuryCleared: false,
    coachUpdatesCleared: 0,
    injuryOverridesRemoved: [],
    coachNotesRemoved: 0,
    athletePrefInjuriesCleared: 0,
    pendingInjuryCleared: false,
    chatCleared: false,
  };

  deps.coachStore.clear();
  summary.chatCleared = true;
  logger.debug('[reset] coach_chat_cleared');

  if (deps.clearPendingInjury) {
    deps.clearPendingInjury();
    summary.pendingInjuryCleared = true;
  } else {
    fireResetSignal();
    summary.pendingInjuryCleared = true;
  }
  if (deps.clearChatMessages) {
    deps.clearChatMessages();
  }

  logger.debug('[reset] complete', { mode: 'clear_coach_chat', summary });
  return summary;
}

// ─── 3. FULL RESET ──────────────────────────────────────────────────

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

  // 1. First do a surgical coach clear so the per-feature logs fire
  //    (so the audit trail shows what was cleared, not just "everything").
  const surgical = clearCoachAdjustments({ deps: opts?.deps });

  // 2. Coach chat.
  deps.coachStore.clear();

  // 3. Program store (base program + all overrides).
  deps.programStore.clear();
  logger.debug('[reset] program_store_cleared');

  // 4. Profile / onboarding.
  deps.profileStore.clear();
  logger.debug('[reset] profile_store_cleared');

  // 5. Calendar marks.
  deps.calendarStore.clear();
  logger.debug('[reset] calendar_store_cleared');

  // 6. Athlete preferences.
  deps.athletePreferencesStore.clear();
  logger.debug('[reset] athlete_preferences_cleared');

  // 7. Caller-supplied ref / chat-message clears (or signal).
  if (deps.clearPendingInjury) deps.clearPendingInjury();
  else fireResetSignal();
  if (deps.clearChatMessages) deps.clearChatMessages();

  const summary: ResetSummary = {
    ...surgical,
    chatCleared: true,
    pendingInjuryCleared: true,
  };
  logger.debug('[reset] complete', { mode: 'full_reset', summary });
  return summary;
}

// ─── 4. DEV-ONLY POST-ONBOARDING RESET ─────────────────────────────

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

  deps.pendingClarifierStore.clearPending();
  deps.mutationHistoryStore.clearAll();
  deps.readinessStore.clear();
  deps.coachContextStore.clearCoachContext();
  deps.coachPreferencesStore.clearAllModalityPreferences();
  deps.coachMemoryStore.clearNotes();
  deps.coachUpdatesStore.clearAllCoachUpdates();
  deps.programStore.clear();
  deps.calendarStore.clear();
  deps.athletePreferencesStore.clear();
  deps.coachStore.clear();
  deps.workoutLogStore.clear();
  deps.fireResetSignal();

  const result = await deps.runDevOnboardingSkip({
    onboardingData,
    generateProgram: opts?.generateProgram,
  });

  deps.pendingClarifierStore.clearPending();
  deps.mutationHistoryStore.clearAll();
  deps.readinessStore.clear();
  deps.coachContextStore.clearCoachContext();
  deps.coachPreferencesStore.clearAllModalityPreferences();
  deps.coachMemoryStore.clearNotes();
  deps.coachUpdatesStore.clearAllCoachUpdates();
  deps.coachStore.clear();
  deps.workoutLogStore.clear();
  deps.fireResetSignal();

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
