/**
 * resetCoach.ts — explicit reset/clear utilities for coach + program state.
 *
 * Explicit full reset and dev-only reset:
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
} from '../store/coachUpdatesStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { logger } from './logger';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useJournalNoteStore } from '../store/journalNoteStore';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { useBlockSelectionHistoryStore } from '../store/blockSelectionHistoryStore';
import { useSessionStopwatchStore } from '../store/sessionStopwatchStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useWorkoutLogStore } from '../store/workoutLogStore';
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
  /**
   * THE HISTORIES. Launch audit 2026-08-25, finding #2: Full reset left the
   * decision ledger and the block-selection history behind, so the NEXT
   * athlete's first relaunch replayed the previous athlete's edits onto their
   * brand-new program (sessions binned, game moved — measured on glass).
   * `resetDevE2EWorldThroughPublicAPIs` had already written the law down:
   * "Leaving either one behind makes the next generated athlete inherit
   * decisions from the last one." These deps make the product reset obey it.
   */
  decisionLedgerStore: { clear: () => void };
  blockSelectionHistoryStore: { clear: () => void };
  workoutLogStore: { clear: () => void };
  journalNoteStore: { clear: () => void };
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
    decisionLedgerStore: {
      clear: () => useDecisionLedgerStore.getState().clear(),
    },
    blockSelectionHistoryStore: {
      clear: () => useBlockSelectionHistoryStore.getState().clear(),
    },
    workoutLogStore: {
      clear: () => useWorkoutLogStore.getState().clear(),
    },
    journalNoteStore: {
      clear: () => useJournalNoteStore.getState().clear(),
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
    return runFullReset(deps, trace, resetActionId);
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
  trace: AthleteActionTraceContext,
  resetActionId: string,
): ResetSummary {

  // This door resets the whole athlete. Individual changes use their accepted
  // fact/decision doors; there is no intermediate surgical output rewrite.
  const overrides = deps.programStore.getDateOverrides();
  const contexts = deps.programStore.getOverrideContexts();
  const summary: ResetSummary = {
    activeInjuryCleared: false,
    coachUpdatesCleared: Object.keys(deps.coachUpdatesStore.getUpdatesByWeek()).length,
    injuryOverridesRemoved: Object.keys(overrides).filter(date => contexts[date]?.intent === 'injury'),
    coachNotesRemoved: Object.values(overrides).reduce((sum, workout) => sum + (workout.coachNotes?.length ?? 0), 0),
    athletePrefInjuriesCleared: useAthletePreferencesStore.getState().prefs.activeInjuries?.length ?? 0,
  };
  deps.coachUpdatesStore.clearAllCoachUpdates();
  useReadinessStore.getState().clear();
  useCoachPreferencesStore.getState().clearAllModalityPreferences();

  // 1b. The athlete's HISTORIES, before the program they explain. Launch
  //     audit 2026-08-25, finding #2: these four were not on this list, and
  //     the surviving decision ledger replayed the previous athlete's edits
  //     onto the next athlete's program at their first relaunch. The dev
  //     world reset already stated the law; the product reset now clears the
  //     same inputs.
  deps.decisionLedgerStore.clear();
  logger.debug('[reset] decision_ledger_cleared');
  deps.blockSelectionHistoryStore.clear();
  logger.debug('[reset] block_selection_history_cleared');
  deps.workoutLogStore.clear();
  logger.debug('[reset] workout_log_cleared');
  deps.journalNoteStore.clear();
  logger.debug('[reset] journal_notes_cleared');

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
