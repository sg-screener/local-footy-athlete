import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Animated, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useStaleOverrides } from '../../hooks/useStaleOverrides';
import { useCalendarStore } from '../../store/calendarStore';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useReadinessStore } from '../../store/readinessStore';
import { generateProgramFromProfile } from '../../services/api/generateProgram';
import {
  commitRebuiltProgram,
  decideSweepForCurrentStores,
  rebuildLocalWeek,
} from '../../utils/weekRebuild';
import type { SeasonPhase, DayOfWeek } from '../../types/domain';
import { applyPhaseShift } from '../../utils/profileMutations';
import { selectActiveCoachNotes } from '../../utils/activeCoachNotes';
import { getActiveProgramModifiers } from '../../utils/activeProgramModifiers';
import {
  executeProgramControlAction,
  type ProgramControlActionResult,
  type ProgramControlStatusUpdate,
} from '../../utils/programControlActions';
import {
  buildGuidedInjuryConstraint,
  type GuidedInjuryFlowResult,
} from '../../utils/guidedInjuryControl';
import {
  mostRecentMissedSession,
  missedSessionFeedback,
  type MissedSession,
  type MissedSessionResponse,
} from '../../utils/missedSessions';
import { todayISOLocal } from '../../utils/appDate';
import {
  loadReductionModifierIdForDate,
  recoveryModeModifierIdForDate,
} from '../../utils/tapProgramModifiers';
import {
  WEEK_DAYS,
  DAY_NUM_TO_NAME,
  NEXT_PHASE,
  REBUILD_MESSAGES,
  REBUILD_MSG_INTERVAL_MS,
  type PhaseShiftStep,
  type InteractionMode,
} from './homeScreenConstants';
import { logger } from '../../utils/logger';

type StatusModifierKind = 'recovery' | 'load_reduction' | 'readiness' | 'unknown';
type HomeQuickStatusAction = 'busy_week_reduce';

const targetStatusModifierKind = (
  status: ProgramControlStatusUpdate,
): Exclude<StatusModifierKind, 'unknown'> => {
  if (status === 'still_sick') return 'recovery';
  if (status === 'still_cooked') return 'load_reduction';
  return 'readiness';
};

/**
 * useHomeScreen — single source of truth for the Home screen's state,
 * effects, and handler orchestration.
 *
 * Both HomeScreenClassic and HomeScreenV2 consume this hook and differ only
 * in how they render its output. Any engine or store interaction happens
 * here; the presentational layers are thin and interchangeable.
 *
 * ## Why a hook, not a context provider
 * There is exactly one Home screen on screen at a time (Classic XOR V2,
 * gated by `useUIStore.designVersion`). Nothing else in the app needs to
 * reach into this state, so a hook keeps the graph flat and side-effect-
 * free for unrelated surfaces.
 *
 * ## Behaviour contract
 * The hook reproduces Classic's behaviour bit-for-bit:
 * - Rebuild: modal + async `generateProgramFromProfile` + program/microcycle
 *   wiring + the selective override sweep
 *   (`clearManualOverridesPreservingActiveModifiers` — modifier-owned
 *   overrides and user manual edits survive; stale system artifacts clear).
 * - Phase shift: 3-step flow (confirm → teamDays → gameDay|off-season skip),
 *   side-effectful `clearAllGames()` on leaving In-season, diff-based
 *   `updateOnboardingData()` patch, and rebuild-for-game-change retry loop.
 * - Game day changes (move/add/remove): in-season structural rebuild with
 *   the stale-game-proximity-override cleanup.
 * - Add-game CTA visibility rule (Off-season never; Pre-season gated on
 *   displayed-week ≥ Jan 1 relative to today).
 *
 * Return shape is intentionally flat — consumers destructure what they
 * need, matching the call sites' current shape and keeping the Classic-
 * to-hook migration mechanical.
 */
export function useHomeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    weekDays,
    weekLabel,
    weekOffset,
    isThisWeek,
    goToPrev,
    goToNext,
    goToThisWeek,
    goToDate,
  } = useResolvedWeek();

  // ── Handle initialDate from Calendar → View Week navigation ──
  const lastInitialDate = useRef<string | null>(null);
  useEffect(() => {
    const initialDate = route.params?.initialDate;
    if (initialDate && initialDate !== lastInitialDate.current) {
      lastInitialDate.current = initialDate;
      goToDate(initialDate);
      // Clear the param so re-focusing the tab doesn't re-trigger.
      navigation.setParams({ initialDate: undefined });
    }
  }, [route.params?.initialDate, goToDate, navigation]);

  // ── Stale override warnings ──
  const staleWarnings = useStaleOverrides();
  const staleByDate = useMemo(() => {
    const map: Record<string, (typeof staleWarnings)[0]> = {};
    for (const w of staleWarnings) map[w.date] = w;
    return map;
  }, [staleWarnings]);

  // ── Selection / interaction mode ──
  // Selected day defaults to today on this week. On any OTHER week
  // (past or future) nothing is selected until the athlete taps a day —
  // selection is the emphasis carrier, and browsing a week shouldn't
  // pre-emphasize an arbitrary Monday. Sentinel -1 = no selection.
  const todayIdx = weekDays.findIndex((d) => d.isToday);
  const todayDay = todayIdx >= 0 ? weekDays[todayIdx] : null;
  const [selectedIdx, setSelectedIdx] = useState(todayIdx >= 0 ? todayIdx : -1);

  // Single owner of the default-selection rule: whenever the visible week
  // changes, selection resets to today (this week) or nothing (any other
  // week). Runs AFTER the new week resolves, so todayIdx is derived from
  // the current week's days — setting selection inside the nav handlers
  // would read the outgoing week's data (stale closure).
  useEffect(() => {
    setSelectedIdx(weekOffset === 0 && todayIdx >= 0 ? todayIdx : -1);
    // todayIdx is intentionally not a dependency: mid-week midnight
    // rollover shouldn't yank a selection the athlete is looking at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  // Game-day action sheet
  const [gameModalVisible, setGameModalVisible] = useState(false);
  const [gameModalDate, setGameModalDate] = useState<string | null>(null);

  // Normal vs. moveGame (tap-to-pick target) vs. addGame
  const [mode, setMode] = useState<InteractionMode>({ type: 'normal' });

  // Calendar store actions
  const { setGameDay, removeGameDay, setNoGame, clearAllGames } = useCalendarStore();

  // ── Rebuild state ──
  const [rebuildModalVisible, setRebuildModalVisible] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  // rebuildError holds the USER-FACING copy only. Raw HTML / server payloads
  // are never assigned here — see classifyRebuildError() below.
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [rebuildErrorCanRetry, setRebuildErrorCanRetry] = useState(true);
  const [rebuildMsgIdx, setRebuildMsgIdx] = useState(0);
  const rebuildMsgOpacity = useRef(new Animated.Value(1)).current;

  // Profile store
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const updateOnboardingData = useProfileStore((s) => s.updateOnboardingData);

  // ── Phase-shift state ──
  const [phaseShiftModalVisible, setPhaseShiftModalVisible] = useState(false);
  const [phaseShiftStep, setPhaseShiftStep] = useState<PhaseShiftStep>('confirm');
  // Availability pending buffer — seeded from profile on open, overwrites
  // the stored `preferredTrainingDays` before rebuild. See the availability
  // step in the modal + applyPhaseShift for why we re-ask rather than reuse.
  const [pendingPreferredDays, setPendingPreferredDays] = useState<DayOfWeek[]>([]);
  const [pendingTeamDays, setPendingTeamDays] = useState<DayOfWeek[]>([]);
  const [pendingGameDay, setPendingGameDay] = useState<DayOfWeek | null>(null);
  const currentPhase = (onboardingData.seasonPhase || 'Pre-season') as SeasonPhase;
  // Latched target phase for the shift modal. Set explicitly by the caller
  // of handleOpenPhaseShift so the modal renders from the user's actual
  // selection, never from a derived "next phase". Seeded to NEXT_PHASE so
  // first-paint of the outer CTA button has something sensible; only
  // handleOpenPhaseShift is allowed to change it after that.
  const [targetPhase, setTargetPhase] = useState<SeasonPhase>(NEXT_PHASE[currentPhase]);

  // Program store
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const activeConstraints = useCoachUpdatesStore((s) => s.activeConstraints);
  const activeInjury = useCoachUpdatesStore((s) => s.activeInjury);
  const athletePrefs = useAthletePreferencesStore((s) => s.prefs);
  const modalityPreferences = useCoachPreferencesStore((s) => s.modalityPreferences);
  const readinessSignalsByDate = useReadinessStore((s) => s.signalsByDate);
  const coachNotes = useMemo(
    () => selectActiveCoachNotes({
      activeConstraints,
      activeInjury,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
    }),
    [
      activeConstraints,
      activeInjury,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
    ],
  );

  // ── Missed-session prompt ──
  // The most recent past, unlogged trainable day in the visible week.
  // Surfaced as a single "Did you do <day>?" follow-up; every answer
  // routes through the feedback / producer pipeline (see
  // handleMissedSessionResponse). No Coach chat.
  const missedSessionPrompt = useMemo(
    () =>
      mostRecentMissedSession({
        weekDays,
        todayISO: todayISOLocal(),
        sessionFeedback,
      }),
    [weekDays, sessionFeedback],
  );


  // ───────── Error helpers ─────────

  /**
   * Clear error state. Always resets `canRetry` back to the default (true)
   * so a stale `canRetry=false` from a previous run can't suppress the
   * rebuild button the next time the modal is opened.
   */
  const clearRebuildError = () => {
    setRebuildError(null);
    setRebuildErrorCanRetry(true);
  };

  /**
   * Extract safe user-facing copy + retryability from a thrown error.
   * - `ProgramGenError` instances carry typed `userMessage` + `canRetry`.
   * - Anything else falls back to generic copy and is retryable by default
   *   (it's almost always a transient/unknown failure from our side).
   * Raw HTML / server payloads NEVER flow here — generateProgram.ts already
   * redacts them to a safe `userMessage` before throwing.
   */
  const classifyRebuildError = (err: any): { userMessage: string; canRetry: boolean } => {
    if (err && typeof err === 'object' && err.name === 'ProgramGenError') {
      return {
        userMessage: err.userMessage || 'Something went wrong. Please try again.',
        canRetry: err.canRetry !== false,
      };
    }
    return {
      userMessage: 'Something went wrong. Please try again.',
      canRetry: true,
    };
  };

  // ───────── Rebuild handlers ─────────

  const handleOpenRebuild = () => {
    clearRebuildError();
    setRebuildModalVisible(true);
  };

  const handleCancelRebuild = () => {
    if (isRebuilding) return;
    setRebuildModalVisible(false);
    clearRebuildError();
  };

  // A preserved manual edit that clashed with a game window was removed —
  // protect the game, but never silently.
  const alertGameConflicts = (conflictsRemoved: Array<{ date: string; name: string }>) => {
    if (conflictsRemoved.length === 0) return;
    const lines = conflictsRemoved
      .map((c) => `• ${c.name} (${new Date(c.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })})`)
      .join('\n');
    Alert.alert(
      'Protected your game day',
      `These custom sessions were too close to the game and were removed:\n${lines}`,
    );
  };

  // AI rebuild path (onboarding / phase shift). Commits through the SAME
  // canonical weekRebuild policy as tap/edit rebuilds — modifier-owned
  // overrides and user manual edits survive; system junk is cleared.
  const runRebuild = async (profileOverride?: typeof onboardingData) => {
    const profile = profileOverride ?? onboardingData;
    const program = await generateProgramFromProfile(profile);
    const sweep = decideSweepForCurrentStores(program, profile);
    commitRebuiltProgram(program, {
      preserve: sweep.preserve,
      clear: sweep.clear,
      conflictsRemoved: sweep.conflictsRemoved,
    });
    alertGameConflicts(sweep.conflictsRemoved);
  };

  const handleConfirmRebuild = async () => {
    setRebuildMsgIdx(0);
    rebuildMsgOpacity.setValue(1);
    setIsRebuilding(true);
    clearRebuildError();
    try {
      await runRebuild();
      setRebuildModalVisible(false);
    } catch (err: any) {
      // Log diagnostic payload to dev console — UI only ever sees safe copy.
      logger.error('[Rebuild] failed:', err?.diagnostic || err?.message || err);
      const { userMessage, canRetry } = classifyRebuildError(err);
      setRebuildError(userMessage);
      setRebuildErrorCanRetry(canRetry);
    } finally {
      setIsRebuilding(false);
    }
  };

  // ───────── Phase-shift handlers ─────────

  /**
   * Open the phase-shift sheet. `target` is the phase the user explicitly
   * chose; it must be passed in by the caller — never inferred here — so
   * the modal can render strictly from the athlete's selection. Callers
   * that want the default "next phase in the cycle" suggestion should pass
   * NEXT_PHASE[currentPhase].
   */
  const handleOpenPhaseShift = (target: SeasonPhase) => {
    clearRebuildError();
    setTargetPhase(target);
    setPhaseShiftStep('confirm');
    // Seed the pending selections from the existing profile so the setup
    // screens reflect the athlete's current anchors (easier to confirm/edit).
    // `preferredTrainingDays` is seeded too but the availability step will
    // let the athlete revise it before we commit — onboarding may be months
    // old and real schedules drift (work, study, gym access).
    setPendingPreferredDays(
      (onboardingData.preferredTrainingDays as DayOfWeek[]) || [],
    );
    setPendingTeamDays((onboardingData.teamTrainingDays as DayOfWeek[]) || []);
    setPendingGameDay(
      (onboardingData.usualGameDay as DayOfWeek | undefined) ||
        (typeof onboardingData.gameDay === 'string' &&
        WEEK_DAYS.includes(onboardingData.gameDay as DayOfWeek)
          ? (onboardingData.gameDay as DayOfWeek)
          : null),
    );
    setPhaseShiftModalVisible(true);
  };

  const handleCancelPhaseShift = () => {
    if (isRebuilding) return;
    setPhaseShiftModalVisible(false);
    setPhaseShiftStep('confirm');
    clearRebuildError();
  };

  const togglePendingTeamDay = (day: DayOfWeek) => {
    setPendingTeamDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const togglePendingPreferredDay = (day: DayOfWeek) => {
    setPendingPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  /**
   * Back navigation for the phase-shift modal — moves one step back without
   * resetting any pending selections. Deliberately narrow: we do NOT expose
   * a "jump to step" API because the flow is short enough that cumulative
   * back taps are fine and opens fewer surprising transitions.
   *
   * On `confirm` this is a no-op (same as tapping the back chevron when
   * there's nowhere to go back to) — callers hide the chevron entirely in
   * that case, so this is just a safety guard.
   */
  const handlePhaseShiftBack = () => {
    if (isRebuilding) return;
    setPhaseShiftStep((prev) => {
      switch (prev) {
        case 'availability':
          return 'confirm';
        case 'teamDays':
          return 'availability';
        case 'gameDay':
          return 'teamDays';
        // 'confirm' and 'building' have no meaningful back.
        default:
          return prev;
      }
    });
  };

  const executePhaseShift = async () => {
    setRebuildMsgIdx(0);
    rebuildMsgOpacity.setValue(1);
    setPhaseShiftStep('building');
    setIsRebuilding(true);
    clearRebuildError();
    try {
      // Compute the next profile via the shared mutation helper so the
      // QA harness exercises the exact same overlay logic. See
      // src/utils/profileMutations.ts for the rules.
      const nextProfile = applyPhaseShift(onboardingData, {
        targetPhase,
        preferredTrainingDays: pendingPreferredDays,
        teamTrainingDays: pendingTeamDays,
        gameDay: pendingGameDay,
      });
      // Side effect outside the pure mutation: when leaving In-season,
      // wipe all explicit game / bye markers. Virtual games disappear
      // automatically once seasonPhase flips, but explicit 'game' marks
      // set during the in-season run would otherwise survive and bleed
      // into the new phase. (calendarStore is not part of OnboardingData
      // so the pure helper can't and shouldn't touch it.)
      if (currentPhase === 'In-season' && targetPhase !== 'In-season') {
        clearAllGames();
      }
      // Persist the diff to profileStore. We compute the patch by diffing
      // against the original profile so unchanged fields don't churn.
      const updates: Partial<typeof onboardingData> = {
        seasonPhase: nextProfile.seasonPhase,
        // Persist the re-confirmed availability from the modal's availability
        // step. `applyPhaseShift` has already set these on `nextProfile` when
        // `preferredTrainingDays` is provided; we mirror them into the patch
        // so profileStore reflects the athlete's current schedule.
        preferredTrainingDays: nextProfile.preferredTrainingDays,
        trainingDaysPerWeek: nextProfile.trainingDaysPerWeek,
        teamTrainingDays: nextProfile.teamTrainingDays,
        teamTrainingDaysPerWeek: nextProfile.teamTrainingDaysPerWeek,
        usualGameDay: nextProfile.usualGameDay,
        gameDay: nextProfile.gameDay,
      };
      updateOnboardingData(updates);
      if (__DEV__) {
        logger.debug('[PhaseShift] Rebuilding with:', {
          seasonPhase: nextProfile.seasonPhase,
          preferredTrainingDays: nextProfile.preferredTrainingDays,
          teamTrainingDays: nextProfile.teamTrainingDays,
          usualGameDay: nextProfile.usualGameDay,
          gameDay: nextProfile.gameDay,
        });
      }
      await runRebuild(nextProfile);
      setPhaseShiftModalVisible(false);
      setPhaseShiftStep('confirm');
    } catch (err: any) {
      logger.error('[PhaseShift] failed:', err?.diagnostic || err?.message || err);
      const { userMessage, canRetry } = classifyRebuildError(err);
      setRebuildError(userMessage);
      setRebuildErrorCanRetry(canRetry);
      // Fall back to the step the user was on so they can retry. Off-season
      // has no teamDays/gameDay, so the last interactive step is
      // `availability`; for Pre-season it's `teamDays`; for In-season
      // `gameDay`. Matches the forward-path terminal step.
      setPhaseShiftStep(
        targetPhase === 'In-season'
          ? 'gameDay'
          : targetPhase === 'Pre-season'
          ? 'teamDays'
          : 'availability',
      );
    } finally {
      setIsRebuilding(false);
    }
  };

  /**
   * Drive the multi-step flow based on targetPhase.
   *
   * Order:
   *   confirm → availability → [teamDays (non-Off-season)] → [gameDay (In-season)] → execute
   *
   * The `availability` step is always present — onboarding data can be
   * months stale, so every phase shift re-confirms "what days can you
   * train?" before teams or games layer on top.
   */
  const handleAdvancePhaseShift = async () => {
    if (phaseShiftStep === 'confirm') {
      setPhaseShiftStep('availability');
      return;
    }
    if (phaseShiftStep === 'availability') {
      // Off-season has no team / game anchors — availability is the last
      // interactive step before rebuild.
      if (targetPhase === 'Off-season') {
        await executePhaseShift();
      } else {
        setPhaseShiftStep('teamDays');
      }
      return;
    }
    if (phaseShiftStep === 'teamDays') {
      if (targetPhase === 'In-season') {
        setPhaseShiftStep('gameDay');
      } else {
        await executePhaseShift();
      }
      return;
    }
    if (phaseShiftStep === 'gameDay') {
      if (!pendingGameDay) return; // guarded by button disabled state
      await executePhaseShift();
    }
  };

  // ───────── Game-state rebuild ─────────
  //
  // When the user removes / moves / adds a game in a game-supported phase, the engine's
  // weeklyPlan must be regenerated. Calendar overrides alone are not enough:
  // they hide/show the game marker but cannot change the underlying plan
  // shape (the in-season NO-game branch produces a fundamentally different
  // Saturday — core lower + conditioning peak, not a G+1 recovery slot).
  //
  // This helper runs the same pipeline as onboarding and phase-shift —
  // generateProgramFromProfile + AI enrichment — but passes a *temporary*
  // profile override instead of persisting the game change to profile state.
  // The athlete's `usualGameDay` stays intact so future weeks keep their
  // virtual-game overlay; only the current program template reflects the
  // per-week game state.
  //
  //   newGameDay === null          → bye week (engine runs NO-game branch)
  //   newGameDay === DayOfWeek     → game on that day (engine runs WITH-game branch)
  //
  // On error: modal closes, an Alert surfaces the error with a Retry option.
  // We deliberately do NOT reuse the rebuild modal's confirm view on error,
  // because its "Rebuild week" button wires back to handleConfirmRebuild
  // (which runs against the stored profile, not our game-change override)
  // and the copy ("Rebuild this week?") is wrong for this context.
  // DETERMINISTIC + ATOMIC (2026-07-08). Tap/edit game changes must never
  // depend on the AI coach or OpenAI (product rule): the week is rebuilt
  // locally via generateProgramLocally \u2014 same coaching engine, same
  // normaliser, no network. Because the build is synchronous and pure,
  // atomicity falls out naturally: we build FIRST, and only if that
  // succeeds do we commit the program AND run the caller's game-mark
  // commit (setGameDay / setNoGame) together. On failure nothing is
  // touched \u2014 no more "Game Day card shows but the week didn't reshape".
  //
  // Returns true when the rebuild + commit succeeded so callers can gate
  // their own follow-up state (mode/selection) on it.
  const rebuildForGameChange = async (
    newGameDay: DayOfWeek | null,
    commitGameMark?: () => void,
  ): Promise<boolean> => {
    clearRebuildError();
    try {
      if (__DEV__) {
        logger.debug('[GameChange] Canonical local rebuild:', { newGameDay });
      }
      // THE canonical rebuild door (src/utils/weekRebuild.ts): assembles
      // the full week context (profile + game overlay, every per-date
      // override with ownership metadata, every live Coach Note
      // constraint, the new game anchors), builds the candidate week,
      // decides the preservation sweep with the pure policy, and commits
      // game mark + program + sweep ATOMICALLY. Throws before any state
      // change on failure \u2014 no half-applied weeks possible.
      const result = rebuildLocalWeek({
        baseProfile: onboardingData,
        newGameDay,
        commitGameMark,
      });
      alertGameConflicts(result.sweep.conflictsRemoved);
      return true;
    } catch (err: any) {
      logger.error('[GameChange] Rebuild failed:', err?.diagnostic || err?.message || err);
      const { userMessage, canRetry } = classifyRebuildError(err);
      Alert.alert(
        'Couldn\u2019t update your week',
        userMessage,
        canRetry
          ? [
              { text: 'Dismiss', style: 'cancel' },
              {
                text: 'Try again',
                onPress: () => {
                  void rebuildForGameChange(newGameDay, commitGameMark);
                },
              },
            ]
          : [{ text: 'OK' }],
      );
      return false;
    }
  };

  // ───────── Rotating coach messages while rebuilding ─────────
  useEffect(() => {
    if (!isRebuilding) return;

    const interval = setInterval(() => {
      Animated.timing(rebuildMsgOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setRebuildMsgIdx((prev) => (prev + 1) % REBUILD_MESSAGES.length);
        Animated.timing(rebuildMsgOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, REBUILD_MSG_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isRebuilding, rebuildMsgOpacity]);

  // ───────── Week navigation ─────────

  // Selection is NOT set here — the weekOffset effect above owns the
  // default-selection rule (today on this week, nothing elsewhere).
  const handlePrev = () => {
    goToPrev();
    setMode({ type: 'normal' });
  };
  const handleNext = () => {
    goToNext();
    setMode({ type: 'normal' });
  };
  const handleThisWeek = () => {
    goToThisWeek();
    setMode({ type: 'normal' });
  };

  // ───────── Day taps ─────────

  const handleDayTap = async (idx: number) => {
    const day = weekDays[idx];

    // ── Move-game mode: tap selects the target day ──
    if (mode.type === 'moveGame') {
      const targetDate = day.date;
      const fromDate = mode.fromDate;

      if (targetDate === fromDate) {
        // Tapped the same day — cancel move.
        setMode({ type: 'normal' });
        return;
      }

      // Move: remove from old date, set on new date.
      removeGameDay(fromDate);
      // Clean up stale game-proximity overrides for the old game.
      const { overrideContexts, removeManualOverride } = useProgramStore.getState();
      for (const [date, ctx] of Object.entries(overrideContexts)) {
        if (ctx.intent === 'gameProximity' && ctx.relatedGameDate === fromDate) {
          removeManualOverride(date);
        }
      }
      setGameDay(targetDate);
      setMode({ type: 'normal' });
      setSelectedIdx(idx);

      // NO structural rebuild on a one-off move. The shared microcycle template
      // is anchored to profile.usualGameDay (e.g. Saturday). Rebuilding it
      // around the moved day would reshape EVERY future week to the new DOW
      // (Mon=Recovery, Fri=Push, etc.) even though the recurring game day
      // hasn't changed — leaving future Saturdays still labelled GAME but
      // the surrounding days running the wrong-shape template.
      //
      // Instead, the resolver handles the local reshape via:
      //   - the explicit 'game' mark on the new date (Week A only)
      //   - applyGameProximity firing G+1 / G-1 / G-2 around that mark
      //   - virtual-Saturday suppression when the week has another game mark
      // Future weeks ignore the one-off mark (see getEffectiveGameDates'
      // dow-based scoping in sessionResolver.ts).
      //
      // If the user wants to permanently change their recurring game day,
      // that goes through the phase-shift modal, which IS a profile mutation.
      return;
    }

    // ── Add-game mode: tap selects the day to add the game on ──
    if (mode.type === 'addGame') {
      setMode({ type: 'normal' });
      setSelectedIdx(idx);

      // Structural rebuild: if the displayed week was previously a no-game
      // week (e.g. user removed a game earlier), the engine's template is
      // running the NO-game branch and Saturday is a core peak. Adding a
      // game must flip the week back to the WITH-game branch so Thu=Push
      // at G−2 and the game-day slot gets the recovery placement.
      //
      // ATOMIC (2026-07-08): the game mark commits INSIDE the rebuild's
      // success path — build first, then mark + program together. If the
      // rebuild fails, no Game Day card appears over an unchanged week.
      if (currentPhase === 'In-season' || currentPhase === 'Pre-season') {
        const targetName = DAY_NUM_TO_NAME[day.dayOfWeek];
        await rebuildForGameChange(targetName, () => setGameDay(day.date));
      } else {
        // No game-aware engine branch for this phase — mark only.
        setGameDay(day.date);
      }
      return;
    }

    // ── Normal mode ──
    const isGame = day.workout?.workoutType === 'Game';
    if (isGame) {
      // Game day tap → show action sheet. The sheet *is* the interaction
      // here, so we always open it (no toggle) and keep the row marked as
      // selected. If the user wants to dismiss, they use the sheet itself.
      setGameModalDate(day.date);
      setGameModalVisible(true);
      setSelectedIdx(idx);
    } else {
      // Toggle: tapping the already-selected row collapses it. Selection
      // is a sentinel index (-1 = none), so unrelated render code that
      // checks `idx === selectedIdx` simply reports false for every row
      // when nothing is selected — no additional guards needed.
      setSelectedIdx((prev) => (prev === idx ? -1 : idx));
    }
  };

  const handleSelectDayOnly = (idx: number) => {
    if (mode.type !== 'normal') return;
    setSelectedIdx((prev) => (prev === idx ? -1 : idx));
  };

  /**
   * Clear the row selection without touching any other state. Intended for
   * the outer tap-outside dismiss layer on HomeScreenV2 — when the athlete
   * taps off any day card, the currently-expanded row collapses.
   *
   * No-op outside `normal` mode: during move-game / add-game picker flows
   * the selection tracks the user's active pick target, so a stray
   * background tap must not erase it. The picker's own "Cancel" affordance
   * remains the intended exit.
   */
  const handleClearSelection = () => {
    if (mode.type === 'normal') setSelectedIdx(-1);
  };

  const handleViewWorkout = (day: typeof weekDays[0]) => {
    if (day.workout) {
      navigation.navigate('DayWorkout', {
        workoutId: day.workout.id,
        date: day.date,
      });
    }
  };

  /** Team-training-only days still open the detail screen; the shared
   * session CTA owns logging from there. */
  const handleFinishTeamSession = (day: typeof weekDays[0]) => {
    if (day.workout) {
      navigation.navigate('DayWorkout', {
        workoutId: day.workout.id,
        date: day.date,
      });
    }
  };

  const handleMessageCoach = (prefill: string) => {
    navigation.navigate('CoachTab', {
      screen: 'Coach',
      params: { prefill: prefill || `Coach, I need to update my program - ` },
    });
  };

  const handleOpenProgramSetup = useCallback(() => {
    navigation.navigate('ProfileTab');
  }, [navigation]);

  const clearCoachNoteAction = useCallback((noteId: string) => executeProgramControlAction({
    type: 'clear_active_modifier',
    source: {
      screen: 'program_tab',
      surface: 'coach_notes',
      initiatedBy: 'tap',
    },
    scope: 'current_and_future',
    payload: { noteId },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: false,
  }), []);

  const statusModifierKindForNote = useCallback((noteId: string): StatusModifierKind => {
    const note = coachNotes.find((candidate) => candidate.id === noteId);
    const sourceId = note?.constraintId ?? note?.modifierId ?? noteId;
    if (sourceId.includes('tap-recovery-mode')) return 'recovery';
    if (sourceId.includes('tap-load-reduction')) return 'load_reduction';
    if (sourceId.includes('readiness:')) return 'readiness';
    return 'unknown';
  }, [coachNotes]);

  const handleProgramControlResult = useCallback(async (
    result: ProgramControlActionResult,
  ) => {
    if (result.fallbackToCoach) {
      logger.warn('[ProgramControl] action requested Coach fallback:', result.fallbackReason);
      return;
    }
    if (!result.requiresRebuild) return;

    setRebuildMsgIdx(0);
    rebuildMsgOpacity.setValue(1);
    setRebuildModalVisible(true);
    setIsRebuilding(true);
    clearRebuildError();
    try {
      await runRebuild();
      setRebuildModalVisible(false);
    } catch (err: any) {
      logger.error('[CoachNotes] rebuild after clear failed:', err?.diagnostic || err?.message || err);
      const { userMessage, canRetry } = classifyRebuildError(err);
      setRebuildError(userMessage);
      setRebuildErrorCanRetry(canRetry);
    } finally {
      setIsRebuilding(false);
    }
  }, [rebuildMsgOpacity, runRebuild]);

  const handleApplyHomeQuickStatus = useCallback(async (
    action: HomeQuickStatusAction,
  ) => {
    const todayISO = todayISOLocal();
    if (action === 'busy_week_reduce') {
      const result = executeProgramControlAction({
        type: 'set_schedule_modifier',
        source: {
          screen: 'program_tab',
          surface: 'home_quick_action_busy_week',
          initiatedBy: 'tap',
        },
        scope: 'current_week',
        payload: {
          date: todayISO,
          todayISO,
          severity: 5,
          reasonLabel: 'Busy week',
        },
        requiresRebuild: false,
        createsActiveModifier: true,
        oneOffOnly: false,
      }, { todayISO });
      await handleProgramControlResult(result);
    }
  }, [handleProgramControlResult]);

  // ── Busy week / Away / Holiday (vocab group 5) ──
  // "Busy" reduces the whole current week; "Away" clears the exact days
  // the athlete picked and records an Away Coach Note that restores them
  // when cleared. Both run through executeProgramControlAction — no chat.
  const handleApplyBusyWeekReduce = useCallback(async () => {
    const todayISO = todayISOLocal();
    const result = executeProgramControlAction({
      type: 'set_schedule_modifier',
      source: {
        screen: 'program_tab',
        surface: 'busy_away_sheet_busy',
        initiatedBy: 'tap',
      },
      scope: 'current_week',
      payload: { date: todayISO, todayISO, severity: 5, reasonLabel: 'Busy week' },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [handleProgramControlResult]);

  // ── Weekly readiness ("I'm not 100%") — week-scoped wellbeing card ──
  // Reuses the EXISTING tap modifiers (no second readiness system):
  //   sore / tired / easier → upsertTapLoadReductionModifier (severity 7,
  //     "Load reduced this week")
  //   sick → upsertTapRecoveryModeModifier week scope (severity 8,
  //     "Recovery mode active")
  // Both are week-keyed by the anchor date (id + expiresAt derive from
  // that week's Monday), so passing a SELECTED-week date scopes the
  // adjustment to that week. Constraints layer onto the resolved week at
  // render time and survive every rebuild via the canonical weekRebuild
  // context — busy/away, game anchors and manual edits are untouched.
  const handleApplyWeekReadiness = useCallback(async (
    kind: 'sore' | 'tired' | 'sick' | 'easier',
    anchorDateISO: string,
  ) => {
    const todayISO = todayISOLocal();
    // One readiness adjustment per week: switching kind replaces the other.
    const otherId = kind === 'sick'
      ? loadReductionModifierIdForDate(anchorDateISO)
      : recoveryModeModifierIdForDate(anchorDateISO);
    const otherModifier = getActiveProgramModifiers()
      .find((m) => m.sourceId === otherId);
    if (otherModifier) {
      executeProgramControlAction({
        type: 'clear_active_modifier',
        source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
        scope: 'current_week',
        payload: { modifierId: otherModifier.id },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: false,
      }, { todayISO });
    }
    const result = kind === 'sick'
      ? executeProgramControlAction({
          type: 'set_recovery_mode',
          source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
          scope: 'current_week',
          payload: { date: anchorDateISO, todayISO, recoveryScope: 'week' },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        }, { todayISO })
      : executeProgramControlAction({
          type: 'set_fatigue_status',
          source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
          scope: 'current_week',
          payload: { date: anchorDateISO, todayISO, level: 'cooked' },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        }, { todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [handleProgramControlResult]);

  const handleClearWeekReadiness = useCallback(async (constraintId: string) => {
    const todayISO = todayISOLocal();
    // The clear action resolves ACTIVE PROGRAM MODIFIER ids
    // (program-modifier:active_constraint:<constraintId>), not raw
    // constraint ids — resolve through the same selector Coach Notes use.
    const modifier = getActiveProgramModifiers()
      .find((m) => m.sourceId === constraintId);
    const result = executeProgramControlAction({
      type: 'clear_active_modifier',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { modifierId: modifier?.id ?? constraintId },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: false,
    }, { todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [handleProgramControlResult]);

  const handleApplyAwayDays = useCallback(async (dates: string[]) => {
    const todayISO = todayISOLocal();
    // Anchor the schedule note to the week the away days actually fall in
    // so it shows + expires on the right week (not necessarily this one).
    const anchor = [...dates].sort()[0] ?? todayISO;
    const result = executeProgramControlAction({
      type: 'set_schedule_modifier',
      source: {
        screen: 'program_tab',
        surface: 'busy_away_sheet_away',
        initiatedBy: 'tap',
      },
      scope: 'current_week',
      payload: {
        date: anchor,
        todayISO,
        reasonLabel: 'Away',
        planChange: { kind: 'clear_days', dates },
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { visibleWeek: weekDays, todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [weekDays, handleProgramControlResult]);

  // ── Missed sessions ──
  // Did it / Missed it → record feedback (feeds progression: 'full' allows
  // normal progression, 'skipped' holds load). Skip it → bin the day.
  // Move it forward → move the session to the next open rest day. Every
  // path clears the prompt because detection keys off feedback + a live
  // trainable session on that date.
  const handleMissedSessionResponse = useCallback(async (
    missed: MissedSession,
    response: MissedSessionResponse,
  ) => {
    const todayISO = todayISOLocal();
    if (response === 'did_it' || response === 'missed_it') {
      useProgramStore
        .getState()
        .setSessionFeedback(missed.date, missedSessionFeedback(missed.date, response));
      return;
    }
    if (response === 'skip_it') {
      const result = executeProgramControlAction({
        type: 'bin_session',
        source: {
          screen: 'program_tab',
          surface: 'missed_session_prompt',
          initiatedBy: 'tap',
        },
        scope: 'today_only',
        payload: { date: missed.date },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: true,
      }, { visibleWeek: weekDays, todayISO });
      await handleProgramControlResult(result);
      return;
    }
    // move_forward → soonest open (rest) day today-or-later this week.
    const target = weekDays
      .filter((day) => day.date >= todayISO && !day.workout)
      .map((day) => day.date)
      .sort()[0];
    if (!target) {
      // Nowhere open to land it — acknowledge as missed so the athlete
      // isn't stuck, and the prompt clears.
      useProgramStore
        .getState()
        .setSessionFeedback(missed.date, missedSessionFeedback(missed.date, 'missed_it'));
      return;
    }
    const result = executeProgramControlAction({
      type: 'move_session',
      source: {
        screen: 'program_tab',
        surface: 'missed_session_prompt',
        initiatedBy: 'tap',
      },
      scope: 'today_only',
      payload: { fromDate: missed.date, toDate: target },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: true,
    }, { visibleWeek: weekDays, todayISO });
    await handleProgramControlResult(result);
  }, [weekDays, handleProgramControlResult]);

  const handleApplyGuidedInjury = useCallback(async (
    result: GuidedInjuryFlowResult,
    existingId?: string,
  ) => {
    const todayISO = todayISOLocal();
    const constraint = buildGuidedInjuryConstraint(result, { todayISO, existingId });
    const actionResult = executeProgramControlAction({
      type: 'set_injury_modifier',
      source: {
        screen: 'program_tab',
        surface: 'guided_injury_flow',
        initiatedBy: 'tap',
      },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    await handleProgramControlResult(actionResult);
  }, [handleProgramControlResult]);

  const handleClearCoachNote = useCallback(async (noteId: string) => {
    const result = clearCoachNoteAction(noteId);
    await handleProgramControlResult(result);
  }, [clearCoachNoteAction, handleProgramControlResult]);

  const handleUpdateCoachNoteStatus = useCallback(async (
    noteId: string,
    status: ProgramControlStatusUpdate,
  ) => {
    if (status === 'good_now') {
      await handleClearCoachNote(noteId);
      return;
    }
    const todayISO = todayISOLocal();
    const currentStatusKind = statusModifierKindForNote(noteId);
    const nextStatusKind = targetStatusModifierKind(status);
    if (currentStatusKind !== 'unknown' && currentStatusKind !== nextStatusKind) {
      await handleProgramControlResult(clearCoachNoteAction(noteId));
    }
    const result = status === 'still_sick'
      ? executeProgramControlAction({
          type: 'set_recovery_mode',
          source: {
            screen: 'program_tab',
            surface: 'coach_notes_status_update',
            initiatedBy: 'tap',
          },
          scope: 'current_week',
          payload: {
            date: todayISO,
            todayISO,
            recoveryScope: 'week',
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        }, { todayISO })
      : executeProgramControlAction({
          type: 'set_fatigue_status',
          source: {
            screen: 'program_tab',
            surface: 'coach_notes_status_update',
            initiatedBy: 'tap',
          },
          scope: status === 'still_cooked' ? 'current_week' : 'today_only',
          payload: {
            date: todayISO,
            todayISO,
            level: status === 'still_cooked'
              ? 'cooked'
              : status === 'worse'
                ? 'worse'
                : 'not_right',
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        }, { todayISO });
    await handleProgramControlResult(result);
  }, [
    clearCoachNoteAction,
    handleClearCoachNote,
    handleProgramControlResult,
    statusModifierKindForNote,
  ]);

  // ───────── Game day modal ─────────

  const closeGameModal = () => {
    setGameModalVisible(false);
    setGameModalDate(null);
  };

  const handleOpenGameDayActions = (date: string) => {
    setGameModalDate(date);
    setGameModalVisible(true);
  };

  // Game day primary action — opens the session-feedback / logging flow
  // for the game itself. Game days don't carry a workout, so they still
  // route through `startFinished: true` and land directly on
  // SessionFeedbackPanel. Team Training no longer uses this shortcut.
  const handleLogGame = (dateOverride?: unknown) => {
    const targetDate = typeof dateOverride === 'string' ? dateOverride : gameModalDate;
    if (!targetDate) return;
    const day = weekDays.find((d) => d.date === targetDate);
    closeGameModal();
    if (day?.workout) {
      // If a workout slot exists for the game day (some season-phase
      // variants attach one), reuse it as the logging surface.
      navigation.navigate('DayWorkout', {
        workoutId: day.workout.id,
        date: day.date,
        startFinished: true,
      });
      return;
    }
    // No workout attached — fall through to the same logging route with
    // a synthetic empty workoutId; DayWorkout will resolve via date.
    navigation.navigate('DayWorkout', {
      workoutId: 'game',
      date: targetDate,
      startFinished: true,
    });
  };

  const handleMoveGameDay = () => {
    if (!gameModalDate) return;
    const fromIdx = weekDays.findIndex((d) => d.date === gameModalDate);
    closeGameModal();
    setMode({ type: 'moveGame', fromDate: gameModalDate, fromIdx });
  };

  const handleRemoveGameDay = async () => {
    if (!gameModalDate) return;
    const removedDate = gameModalDate;
    closeGameModal();

    // ATOMIC (2026-07-08): all calendar-mark mutations run INSIDE the
    // deterministic rebuild's success path, so a failed rebuild never
    // leaves the game half-removed over an unchanged week.
    const commitRemoval = () => {
      removeGameDay(removedDate);

      // In-season: the week's virtual game (rendered on the effective game
      // day) would otherwise re-appear after we remove any explicit 'game'
      // mark. Plant a 'noGame' marker on the virtual game's date inside
      // this week so the bye sticks until the user explicitly adds another
      // game. Uses the same usualGameDay → gameDay fallback as
      // useResolvedWeek so onboarded-only profiles (gameDay set,
      // usualGameDay missing) also get the bye marker.
      if (currentPhase === 'In-season') {
        const legacyGameDay = onboardingData.gameDay;
        const effectiveGameDay: DayOfWeek | undefined =
          (onboardingData.usualGameDay as DayOfWeek | undefined) ||
          (legacyGameDay === 'Friday' ||
          legacyGameDay === 'Saturday' ||
          legacyGameDay === 'Sunday'
            ? (legacyGameDay as DayOfWeek)
            : undefined);
        if (effectiveGameDay) {
          const DOW_NUM: Record<DayOfWeek, number> = {
            Sunday: 0,
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
          };
          const virtualDow = DOW_NUM[effectiveGameDay];
          const virtualDay = weekDays.find((d) => d.dayOfWeek === virtualDow);
          if (virtualDay) {
            setNoGame(virtualDay.date);
          }
        }
      }

      // Clean up stale game-proximity overrides (same pattern as CalendarScreen).
      const { overrideContexts, removeManualOverride } = useProgramStore.getState();
      for (const [date, ctx] of Object.entries(overrideContexts)) {
        if (ctx.intent === 'gameProximity' && ctx.relatedGameDate === removedDate) {
          removeManualOverride(date);
        }
      }
    };

    // Structural rebuild: the calendar override alone only hides the game
    // marker — the engine's weeklyPlan still reflects the WITH-game branch,
    // so Saturday would otherwise render as the G+1 recovery template.
    // Deterministic local rebuild via the NO-game branch (Saturday becomes
    // a core peak + conditioning day). Pre-season practice matches use the
    // same anchor logic.
    if (currentPhase === 'In-season' || currentPhase === 'Pre-season') {
      await rebuildForGameChange(null, commitRemoval);
    } else {
      commitRemoval();
    }
  };

  const handleCancelMove = () => {
    setMode({ type: 'normal' });
  };

  // ───────── Add-game CTA ─────────

  const weekHasGame = weekDays.some((d) => d.workout?.workoutType === 'Game');

  /**
   * Visibility for the regular-season "No game this week — add one" CTA.
   * Pre-season practice matches are exposed by a separate tap/edit card so
   * they can use practice-match copy without duplicating the in-season CTA.
   */
  const showAddGameCTA = useMemo(() => {
    return currentPhase === 'In-season';
  }, [currentPhase]);

  const showPracticeMatchCTA = currentPhase === 'Pre-season';

  const handleAddGameMode = () => {
    setMode({ type: 'addGame' });
  };

  // Date label for the game-day modal title.
  const gameModalLabel = gameModalDate
    ? new Date(gameModalDate + 'T12:00:00').toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
    : '';

  // ───────── Return flat bag ─────────
  // Flat-by-design. Grouping into nested objects (`rebuild.open()`) reads
  // nicely but forces every call site to rewrite. Keep the surface shape
  // 1:1 with how the render code already uses these names.
  return {
    // Week nav / resolved week
    weekDays,
    weekLabel,
    weekOffset,
    isThisWeek,
    handlePrev,
    handleNext,
    handleThisWeek,

    // Selection / interaction mode
    selectedIdx,
    mode,
    handleDayTap,
    handleSelectDayOnly,
    handleClearSelection,
    handleCancelMove,
    handleAddGameMode,

    // Per-day actions
    handleViewWorkout,
    handleFinishTeamSession,
    handleMessageCoach,
    handleOpenProgramSetup,
    handleApplyHomeQuickStatus,
    handleApplyGuidedInjury,

    // Busy / away + missed sessions (vocab groups 5 + 2)
    handleApplyBusyWeekReduce,
    handleApplyAwayDays,
    handleApplyWeekReadiness,
    handleClearWeekReadiness,
    missedSessionPrompt,
    handleMissedSessionResponse,

    // Stale overrides
    staleByDate,

    // Week context / derived
    weekHasGame,
    showAddGameCTA,
    showPracticeMatchCTA,
    currentPhase,
    coachNotes,
    activeConstraints,
    handleClearCoachNote,
    handleUpdateCoachNoteStatus,

    // Game-day modal
    gameModalVisible,
    gameModalLabel,
    closeGameModal,
    handleOpenGameDayActions,
    handleLogGame,
    handleMoveGameDay,
    handleRemoveGameDay,

    // Rebuild modal
    rebuildModalVisible,
    isRebuilding,
    rebuildError,
    rebuildErrorCanRetry,
    rebuildMsgIdx,
    rebuildMsgOpacity,
    handleOpenRebuild,
    handleCancelRebuild,
    handleConfirmRebuild,

    // Phase-shift modal
    phaseShiftModalVisible,
    phaseShiftStep,
    pendingPreferredDays,
    pendingTeamDays,
    pendingGameDay,
    targetPhase,
    handleOpenPhaseShift,
    handleCancelPhaseShift,
    handlePhaseShiftBack,
    togglePendingPreferredDay,
    togglePendingTeamDay,
    setPendingGameDay,
    handleAdvancePhaseShift,
  };
}
