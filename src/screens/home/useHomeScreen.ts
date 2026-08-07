import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Animated, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useStaleOverrides } from '../../hooks/useStaleOverrides';
import { getCurrentBlockNumberForGeneration, useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useReadinessStore } from '../../store/readinessStore';
import { generateProgramFromProfile } from '../../services/api/generateProgram';
import { classifyProgramGenerationFailure } from '../../utils/onboardingGenerationOutcome';
import {
  commitRebuiltProgram,
  decideSweepForCurrentStores,
} from '../../utils/weekRebuild';
import type { SeasonPhase, DayOfWeek } from '../../types/domain';
import { applyPhaseShift } from '../../utils/profileMutations';
import { dismissActiveCoachNote, selectActiveCoachNotes } from '../../utils/activeCoachNotes';
import {
  getActiveProgramModifiers,
  type ActiveProgramModifier,
} from '../../utils/activeProgramModifiers';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
  type ProgramControlActionResult,
  type ProgramControlStatusUpdate,
} from '../../utils/programControlActions';
import { readinessActionForKind } from '../../utils/weekReadinessActions';
import { athleteSafeRefusal } from '../../utils/planChangeRefusalCopy';
import type { EquipmentLimitationDecision } from './EquipmentLimitationSheet';
import {
  buildGuidedInjuryConstraint,
  type GuidedInjuryFlowResult,
} from '../../utils/guidedInjuryControl';
import {
  mostRecentMissedSession,
  missedSessionFeedback,
  programHistoryBoundaryFromCreatedAt,
  type MissedSession,
  type MissedSessionResponse,
} from '../../utils/missedSessions';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
} from '../../store/sessionOutcomeTransaction';
import { todayISOLocal } from '../../utils/appDate';
import {
  getProgramBlockStateForDate,
  getProgramBlockRolloverStatus,
  getStoredBlockStateForDate,
} from '../../utils/programBlockState';
import { rolloverProgramBlock } from '../../utils/programBlockRollover';
import {
  buildRolloverAcknowledgment,
  type ReadinessAcknowledgment,
} from '../../utils/readinessAcknowledgment';
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
import {
  executeFixtureMutationTransaction,
} from '../../store/fixtureMutationTransaction';
import { clearReversibleAdjustment } from '../../store/reversibleAdjustmentTransaction';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../../dev/e2e/athleteActionUIObservation';
import { dayOfWeekTestIdToken, explorerTestId } from '../../utils/stableTestId';
import { isTemporaryEquipmentFact } from '../../rules/temporarySourceFact';
import { factHorizonCoversWeek } from '../../rules/durableFactHorizon';
import { ownSeasonPhase } from '../../rules/seasonPhaseOwner';
import { canonicalFixtureKind } from '../../rules/fixtureConditionedAvailability';
import { classifyProgramMutationRefusal } from '../../rules/programMutationRefusal';
import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';

type StatusModifierKind = 'recovery' | 'load_reduction' | 'readiness' | 'unknown';
type HomeQuickStatusAction = 'busy_week_reduce';
export type WeekReadinessAction =
  | 'tired_today'
  | 'poor_sleep_today'
  | 'poor_sleep_week'
  | 'cooked_week'
  | 'sore_today'
  | 'illness_mild'
  | 'illness_moderate'
  | 'illness_severe';

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
 * gated by HomeScreen's DESIGN_VERSION constant). Nothing else in the app needs to
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
 *   committed atomically through `commitProfileProgramTransaction` — the
 *   profile patch, the rebuild and the fixture-mark retirement publish
 *   together or roll back together.
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
    visibleWeek,
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
  const [pendingFixtureObservation, setPendingFixtureObservation] = useState<{
    traceId: string;
    observationId: string;
    sourceDate?: string;
    targetDate: string;
    fixtureExpectedAtTarget: boolean;
    fixtureId: string;
  } | null>(null);
  const [pendingRestorationObservation, setPendingRestorationObservation] = useState<{
    traceId: string;
    observationId: string;
    acceptedRevisionAfter: number;
    affectedDates: string[];
    controlId?: string;
    renderedStatus?: string;
    adjustmentId: string;
  } | null>(null);
  const [pendingSourceFactObservations, setPendingSourceFactObservations] = useState<Array<{
    traceId: string;
    observationId: string;
    domain: 'readiness' | 'equipment';
    factId: string;
    expectedStatus: 'active' | 'resolved';
    controlId: string;
  }>>([]);
  const [pendingInjuryObservation, setPendingInjuryObservation] = useState<{
    traceId: string;
    observationId: string;
    episodeId: string;
    expectedStatus: 'active' | 'resolved';
    controlId: string;
  } | null>(null);
  // ── Rebuild state ──
  const [rebuildModalVisible, setRebuildModalVisible] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  // rebuildError holds the USER-FACING copy only. Raw HTML / server payloads
  // are never assigned here — see classifyRebuildFailure() below.
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [rebuildErrorCanRetry, setRebuildErrorCanRetry] = useState(true);
  const [rebuildMsgIdx, setRebuildMsgIdx] = useState(0);
  const rebuildMsgOpacity = useRef(new Animated.Value(1)).current;
  const rolloverAttemptRef = useRef<string | null>(null);
  // THE ROLLOVER IS NEVER SILENT (Sam's interim ruling, 2026-07-31). A failed
  // rollover used to be caught and logged here, leaving the athlete a program
  // that stopped outside the edit horizon with no sentence. The typed refusal
  // now lands in this state and the week screen renders it, with a retry that
  // clears the attempt key so the effect runs again.
  const [rolloverRefusal, setRolloverRefusal] =
    useState<ReadinessAcknowledgment | null>(null);
  const [rolloverRetryNonce, setRolloverRetryNonce] = useState(0);

  // Profile store
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const isOnboardingComplete = useProfileStore((s) => s.isOnboardingComplete);

  // Program store — currentProgram is read up here so the season-phase
  // derivation below can source the phase from its clock (single source of truth).
  const currentProgram = useProgramStore((s) => s.currentProgram);

  // ── Phase-shift state ──
  const [phaseShiftModalVisible, setPhaseShiftModalVisible] = useState(false);
  const [phaseShiftStep, setPhaseShiftStep] = useState<PhaseShiftStep>('confirm');
  // Availability pending buffer — seeded from profile on open, overwrites
  // the stored `preferredTrainingDays` before rebuild. See the availability
  // step in the modal + applyPhaseShift for why we re-ask rather than reuse.
  const [pendingPreferredDays, setPendingPreferredDays] = useState<DayOfWeek[]>([]);
  const [pendingTeamDays, setPendingTeamDays] = useState<DayOfWeek[]>([]);
  const [pendingGameDay, setPendingGameDay] = useState<DayOfWeek | null>(null);
  // The game anchor is an ANSWER, and `null` is one of its values. This flag
  // separates "the athlete said they have no usual game day" from "nobody has
  // asked yet" — the two used to be the same empty field, and the second one
  // silently wiped a stored anchor.
  const [pendingGameAnchorAnswered, setPendingGameAnchorAnswered] = useState(false);

  /** Naming a day is an answer. */
  const answerUsualGameDay = (day: DayOfWeek) => {
    setPendingGameDay(day);
    setPendingGameAnchorAnswered(true);
  };

  /** So is saying there is no usual day. */
  const answerNoUsualGameDay = () => {
    setPendingGameDay(null);
    setPendingGameAnchorAnswered(true);
  };
  // Season phase comes from THE owner (rules/seasonPhaseOwner). The comment
  // that used to sit here claimed the clock was "the single source of truth
  // the visible week is built from" — and it was not, because `useSchedule`
  // built that week from `profile.seasonPhase`. Both now read the same owner,
  // so the claim is true by construction rather than by assertion.
  //
  // `ownedPhase.skew` is the typed report of a device that carries the old
  // disagreement; it drives the repair disclosure below, and it is never
  // resolved silently in either direction.
  const ownedPhase = ownSeasonPhase({ program: currentProgram, profile: onboardingData });
  const currentPhase = (ownedPhase.phase ?? 'Pre-season') as SeasonPhase;
  const seasonPhaseSkew = ownedPhase.skew;
  // Latched target phase for the shift modal. Set explicitly by the caller
  // of handleOpenPhaseShift so the modal renders from the user's actual
  // selection, never from a derived "next phase". Seeded to NEXT_PHASE so
  // first-paint of the outer CTA button has something sensible; only
  // handleOpenPhaseShift is allowed to change it after that.
  const [targetPhase, setTargetPhase] = useState<SeasonPhase>(NEXT_PHASE[currentPhase]);

  // Program store
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const blockState = useProgramStore((s) => s.blockState);
  const acceptedRevision = useProgramStore((s) => s.acceptedMaterialContext.revision);
  const reversibleAdjustments = useProgramStore((s) =>
    s.reversibleAdjustmentLedger.adjustments);
  const injuryEpisodes = useProgramStore((s) => s.acceptedMaterialContext.injuryEpisodes);
  const temporarySourceFacts = useProgramStore((s) =>
    s.acceptedMaterialContext.temporarySourceFacts);
  const activeConstraints = useCoachUpdatesStore((s) => s.activeConstraints);
  const activeInjury = useCoachUpdatesStore((s) => s.activeInjury);
  const dismissedCoachNoteIds = useCoachUpdatesStore((s) => s.dismissedCoachNoteIds);
  const athletePrefs = useAthletePreferencesStore((s) => s.prefs);
  const modalityPreferences = useCoachPreferencesStore((s) => s.modalityPreferences);
  const readinessSignalsByDate = useReadinessStore((s) => s.signalsByDate);
  const todayReadinessModifier = useMemo<ActiveProgramModifier | null>(() => {
    const todayISO = todayISOLocal();
    if (!readinessSignalsByDate[todayISO]) return null;
    return getActiveProgramModifiers(todayISO)
      .find((modifier) => modifier.source === 'readiness_signal') ?? null;
  }, [readinessSignalsByDate]);
  const rolloverTargetDateISO = todayISOLocal();

  // Program lifecycle boundary: once the stored four-week window has ended,
  // advance through the canonical deterministic block rebuild. A stale app
  // several blocks behind advances one block per render until today is inside
  // the active window, preserving the required block-by-block rotation.
  useEffect(() => {
    if (!isOnboardingComplete || isRebuilding) return;

    const status = getProgramBlockRolloverStatus({
      program: currentProgram,
      dateISO: rolloverTargetDateISO,
      blockState,
    });
    if (!status.needsRollover) {
      rolloverAttemptRef.current = null;
      return;
    }

    const attemptKey = [
      currentProgram?.id ?? 'no-program',
      status.currentBlockEnd ?? 'no-end',
      rolloverTargetDateISO,
      String(rolloverRetryNonce),
    ].join(':');
    if (rolloverAttemptRef.current === attemptKey) return;
    rolloverAttemptRef.current = attemptKey;

    try {
      const result = rolloverProgramBlock({
        baseProfile: onboardingData,
        targetDateISO: rolloverTargetDateISO,
      });
      // The boundary refuses typed now; the athlete reads the ack owner's
      // sentence, never the engine's code (which stays on the tape).
      setRolloverRefusal(buildRolloverAcknowledgment(result));
      if (result.refusal) {
        logger.error('[programBlockRollover] rollover refused', result.refusal.code);
      }
    } catch (error) {
      // Belt for an unexpected throw — the contract says the boundary never
      // throws, and if that contract breaks the athlete is STILL told.
      logger.error('[programBlockRollover] automatic rollover failed', error);
      setRolloverRefusal(buildRolloverAcknowledgment({ refusal: { code: 'threw' } }));
    }
  }, [
    blockState,
    currentProgram,
    isOnboardingComplete,
    isRebuilding,
    onboardingData,
    rolloverRetryNonce,
    rolloverTargetDateISO,
  ]);

  /** "Try again" on the rollover-refusal card: clear the sentence and the
   *  attempt key so the lifecycle effect runs the same boundary once more. */
  const handleRetryRollover = useCallback(() => {
    setRolloverRefusal(null);
    rolloverAttemptRef.current = null;
    setRolloverRetryNonce((nonce) => nonce + 1);
  }, []);
  const visibleWeekStart = weekDays[0]?.date;
  const visibleWeekEnd = weekDays[weekDays.length - 1]?.date ?? visibleWeekStart;
  const visibleReversibleAdjustments = useMemo(() => reversibleAdjustments
    .filter((adjustment) => adjustment.restorationTarget.dates.some((date) =>
      weekDays.some((day) => day.date === date)) || (
      adjustment.restorationTarget.kind === 'week_overlay' &&
      adjustment.displacedOriginalState.weekOverlay?.weekStart === visibleWeekStart
    )), [reversibleAdjustments, visibleWeekStart, weekDays]);
  // Which facts reach the visible week is asked of `durableFactHorizon`. These
  // two filters used to compare `scope.until` directly, which drops every OPEN
  // fact — the coach note and the readiness list would go blank for exactly the
  // durable reports (severe illness, cooked) that most need showing.
  const equipmentFacts = useMemo(() => temporarySourceFacts
    .filter(isTemporaryEquipmentFact)
    .filter((fact) => !visibleWeekStart ||
      factHorizonCoversWeek(fact, visibleWeekStart)),
  [temporarySourceFacts, visibleWeekStart]);
  const readinessFacts = useMemo(() => temporarySourceFacts.filter((fact) =>
    'factKind' in fact && (
      fact.factKind === 'fatigue' || fact.factKind === 'soreness' ||
      fact.factKind === 'poor_sleep' || fact.factKind === 'illness'
    ) && (!visibleWeekStart || factHorizonCoversWeek(fact, visibleWeekStart))),
  [temporarySourceFacts, visibleWeekStart]);
  const visibleWeekKind = useMemo(() => {
    if (!visibleWeekStart) return undefined;
    const exactMicrocycle = currentProgram?.microcycles?.find((microcycle) => {
      const start = microcycle.startDate.split('T')[0];
      const end = microcycle.endDate.split('T')[0];
      return visibleWeekStart >= start && visibleWeekStart <= end;
    });
    if (exactMicrocycle?.weekKind) return exactMicrocycle.weekKind;
    if (blockState) {
      return getStoredBlockStateForDate(
        blockState,
        visibleWeekStart,
        currentPhase,
        currentProgram?.seasonPhaseClock,
      ).weekKind;
    }
    if (currentProgram?.startDate) {
      return getProgramBlockStateForDate({
        dateISO: visibleWeekStart,
        programStartISO: currentProgram.startDate,
        seasonPhase: currentPhase,
        seasonPhaseClock: currentProgram.seasonPhaseClock,
      }).weekKind;
    }
    return undefined;
  }, [blockState, currentPhase, currentProgram, visibleWeekStart]);
  const coachNotes = useMemo(
    () => selectActiveCoachNotes({
      activeConstraints,
      activeInjury,
      dismissedCoachNoteIds,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
      weekKind: visibleWeekKind,
      visibleWeekDays: weekDays,
    }),
    [
      activeConstraints,
      activeInjury,
      dismissedCoachNoteIds,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
      visibleWeekKind,
      weekDays,
    ],
  );

  useEffect(() => {
    if (!pendingFixtureObservation) return;
    const target = weekDays.find((day) => day.date === pendingFixtureObservation.targetDate);
    const source = pendingFixtureObservation.sourceDate
      ? weekDays.find((day) => day.date === pendingFixtureObservation.sourceDate)
      : null;
    const targetHasFixture = target?.workout?.workoutType === 'Game';
    const sourceReleased = !source || source.workout?.workoutType !== 'Game';
    if (
      targetHasFixture !== pendingFixtureObservation.fixtureExpectedAtTarget ||
      !sourceReleased
    ) return;
    observeRenderedAthleteActionOutcome({
      traceId: pendingFixtureObservation.traceId,
      observationId: pendingFixtureObservation.observationId,
      renderedText: {
        targetDate: pendingFixtureObservation.targetDate,
        targetHasFixture,
        sourceDate: pendingFixtureObservation.sourceDate ?? null,
        sourceReleased,
      },
      controlId: explorerTestId.fixtureState(
        pendingFixtureObservation.fixtureId,
        targetHasFixture ? 'active' : 'absent',
      ),
      accessibilityNode: {
        targetTestID: target
          ? `day-row-${dayOfWeekTestIdToken(target.dayOfWeek)}-state-${
              targetHasFixture ? 'fixture' : target.workout ? 'scheduled' : 'rest'
            }`
          : null,
        sourceTestID: source
          ? `day-row-${dayOfWeekTestIdToken(source.dayOfWeek)}-state-${
              source.workout?.workoutType === 'Game'
                ? 'fixture'
                : source.workout ? 'scheduled' : 'rest'
            }`
          : null,
      },
      screenshotReference: 'screenshots/trace-v2-fixture-after-mutation.png',
      hierarchyReference:
        'accessibility-hierarchy/trace-v2-fixture-after-mutation.json',
    });
    setPendingFixtureObservation(null);
  }, [pendingFixtureObservation, weekDays]);

  useEffect(() => {
    if (pendingSourceFactObservations.length === 0) return;
    const completedTraceIds = new Set<string>();
    for (const pending of pendingSourceFactObservations) {
      const fact = temporarySourceFacts.find((candidate) =>
        'factId' in candidate && candidate.factId === pending.factId);
      const activeConstraintExists = activeConstraints.some((constraint) =>
        constraint.id === pending.factId ||
        constraint.temporarySourceFactIds?.includes(pending.factId));
      const renderedStatus = fact && 'status' in fact ? fact.status : null;
      const matches = pending.expectedStatus === 'active'
        ? activeConstraintExists && (renderedStatus === 'active' || renderedStatus === null)
        : !activeConstraintExists && (renderedStatus === 'resolved' || renderedStatus === null);
      if (!matches) continue;
      observeRenderedAthleteActionOutcome({
        traceId: pending.traceId,
        observationId: pending.observationId,
        renderedText: {
          domain: pending.domain,
          factId: pending.factId,
          status: renderedStatus,
          activeConstraintExists,
          acceptedRevision,
        },
        controlId: pending.controlId,
        accessibilityNode: { testID: pending.controlId },
      });
      completedTraceIds.add(pending.traceId);
    }
    if (completedTraceIds.size > 0) {
      setPendingSourceFactObservations((current) => current.filter((pending) =>
        !completedTraceIds.has(pending.traceId)));
    }
  }, [
    acceptedRevision,
    activeConstraints,
    pendingSourceFactObservations,
    temporarySourceFacts,
  ]);

  useEffect(() => {
    if (!pendingInjuryObservation) return;
    const episode = injuryEpisodes.find((candidate) =>
      candidate.episodeId === pendingInjuryObservation.episodeId);
    const matches = pendingInjuryObservation.expectedStatus === 'active'
      ? episode?.status === 'active' || episode?.status === 'improving'
      : episode?.status === 'resolved' || episode?.status === 'superseded';
    if (!matches) return;
    observeRenderedAthleteActionOutcome({
      traceId: pendingInjuryObservation.traceId,
      observationId: pendingInjuryObservation.observationId,
      renderedText: {
        episodeId: pendingInjuryObservation.episodeId,
        status: episode?.status ?? null,
        acceptedRevision,
      },
      controlId: pendingInjuryObservation.controlId,
      accessibilityNode: { testID: pendingInjuryObservation.controlId },
    });
    setPendingInjuryObservation(null);
  }, [acceptedRevision, injuryEpisodes, pendingInjuryObservation]);

  useEffect(() => {
    if (
      !pendingRestorationObservation ||
      acceptedRevision !== pendingRestorationObservation.acceptedRevisionAfter
    ) return;
    const restoredAdjustment = reversibleAdjustments.find((adjustment) =>
      adjustment.id === pendingRestorationObservation.adjustmentId);
    if (restoredAdjustment?.status !== 'cleared') return;
    const visibleFixtureDates = weekDays
      .filter((day) =>
        pendingRestorationObservation.affectedDates.includes(day.date) &&
        day.workout?.workoutType === 'Game')
      .map((day) => day.date)
      .sort();
    observeRenderedAthleteActionOutcome({
      traceId: pendingRestorationObservation.traceId,
      observationId: pendingRestorationObservation.observationId,
      renderedText: {
        acceptedRevision,
        affectedDates: pendingRestorationObservation.affectedDates,
        visibleFixtureDates,
        renderedStatus: pendingRestorationObservation.renderedStatus ?? null,
      },
      controlId: pendingRestorationObservation.controlId ??
        explorerTestId.adjustmentRestored(pendingRestorationObservation.adjustmentId),
      accessibilityNode: {
        fixtureStateTestIDs: weekDays
          .filter((day) => visibleFixtureDates.includes(day.date))
          .map((day) =>
            `day-row-${dayOfWeekTestIdToken(day.dayOfWeek)}-state-fixture`),
        resultTestID: null,
        canonicalResultTestID: explorerTestId.adjustmentRestored(
          pendingRestorationObservation.adjustmentId,
        ),
      },
      screenshotReference: 'screenshots/trace-v2-restoration-after-mutation.png',
      hierarchyReference:
        'accessibility-hierarchy/trace-v2-restoration-after-mutation.json',
    });
    setPendingRestorationObservation(null);
  }, [acceptedRevision, pendingRestorationObservation, reversibleAdjustments, weekDays]);

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
        // E6: days before the program existed are history — display context,
        // never prompted, never counted missed.
        programHistoryBeforeISO: programHistoryBoundaryFromCreatedAt(
          currentProgram?.createdAt,
        ),
      }),
    [weekDays, sessionFeedback, currentProgram?.createdAt],
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
   * Safe user-facing copy + retryability for a failed rebuild.
   *
   * This used to be a private closure here, which meant the app carried two
   * independent answers to "generation failed — what do we tell the athlete?".
   * Onboarding had no classifier at all and papered over failures instead; the
   * two surfaces drifted until the same error produced honest copy on one and a
   * misleading save error on the other. One owner now answers for both
   * (see utils/onboardingGenerationOutcome.ts).
   *
   * Raw HTML / server payloads NEVER flow here — generateProgram.ts already
   * redacts them to a safe `userMessage` before throwing.
   */
  const classifyRebuildFailure = (err: unknown): { userMessage: string; canRetry: boolean } => {
    const { userMessage, canRetry } = classifyProgramGenerationFailure(err);
    return { userMessage, canRetry };
  };

  // ───────── Rebuild handlers ─────────

  // THERE IS NO ATHLETE-FACING REBUILD DOOR (Sam, device pass 2026-07-29).
  //
  // `handleOpenRebuild` opened the sheet in its CONFIRM state from a button in
  // the week top bar — dev tooling from early testing that regenerated the whole
  // week and discarded every custom swap. It is deleted, not merely unwired: an
  // exported opener is a door anything can reconnect.
  //
  // The handlers below stay because the rebuilds the athlete DOES ask for by
  // name — clearing a coach note, shifting phase, changing a fixture — still
  // need somewhere to show progress and to report a failure they can retry.

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
    const program = await generateProgramFromProfile(profile, {
      // The athlete asked for this rebuild (onboarding, phase shift). A week
      // that cannot meet its contract is disclosed downstream, not refused.
      weekAcceptance: 'forward_decision',
      blockNumber: getCurrentBlockNumberForGeneration(),
    });
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
      const { userMessage, canRetry } = classifyRebuildFailure(err);
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
    const storedGameDay =
      (onboardingData.usualGameDay as DayOfWeek | undefined) ||
      (typeof onboardingData.gameDay === 'string' &&
      WEEK_DAYS.includes(onboardingData.gameDay as DayOfWeek)
        ? (onboardingData.gameDay as DayOfWeek)
        : null);
    setPendingGameDay(storedGameDay ?? null);
    // A stored anchor IS a prior answer, so re-confirming it is one tap. An
    // absent one is not an answer of any kind and must be asked for.
    setPendingGameAnchorAnswered(Boolean(storedGameDay));
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

  /**
   * Commit a phase shift ATOMICALLY.
   *
   * This used to write `profile.seasonPhase` and then await the rebuild. A
   * rebuild that failed left the profile in the new phase over a program
   * still built for the old one — the skew that made the home chrome and the
   * visible week disagree, and that Sam's own device still carries.
   *
   * `commitProfileProgramTransaction` publishes the profile and the rebuilt
   * program in one accepted-state replacement with a durable read-back, and
   * rolls the whole thing back if it cannot be verified. There is no window
   * in which one has moved and the other has not. Leaving In-season retires
   * explicit fixture marks inside that same transaction.
   */
  // ───────── Stored-state repair: season-phase skew ─────────
  //
  // Sam's device carries a profile and a clock that disagree, from a phase
  // shift whose profile write landed before its rebuild failed. Fixing the
  // write path does nothing for state that is already wrong, and neither
  // value may be quietly overwritten to match the other: the clock is what
  // the athlete's visible week is actually built from, and the profile
  // selection is what they told us they are.
  //
  // So the skew is DISCLOSED, and one press reconciles it — by re-running the
  // athlete's own selection through the same atomic transaction a deliberate
  // phase shift uses. Nothing is deleted, the rebuild is verified, and a
  // failure rolls back whole and leaves the disclosure standing.
  const [seasonPhaseRepairBusy, setSeasonPhaseRepairBusy] = useState(false);
  const [seasonPhaseRepairError, setSeasonPhaseRepairError] = useState<string | null>(null);

  const handleRepairSeasonPhaseSkew = async () => {
    if (!seasonPhaseSkew || seasonPhaseRepairBusy) return;
    setSeasonPhaseRepairBusy(true);
    setSeasonPhaseRepairError(null);
    try {
      const result = await commitProfileProgramTransaction({
        change: {
          kind: 'profile_setup',
          // The athlete's selection is the aim. The clock is re-minted from
          // it by the rebuild inside the transaction.
          patch: { seasonPhase: seasonPhaseSkew.profileSelection },
        },
        todayISO: todayISOLocal(),
        sourceSurface: 'season_phase_skew_repair',
      });
      if (!result.ok) {
        const refusal = classifyProgramMutationRefusal({ reason: result.reason });
        logger.error('[PhaseSkew] repair refused:', refusal.diagnostic ?? result.message);
        setSeasonPhaseRepairError(refusal.userMessage);
        return;
      }
      if (!result.changedProgram) {
        // A repair that changes nothing must SAY so. This branch was missing:
        // the handler read only `!result.ok`, so a `no_change` outcome was
        // swallowed whole — the button darkened, nothing happened, and the
        // disclosure stayed. The refusal table covered `no_change` the whole
        // time; the caller simply never asked it.
        const outcome = classifyProgramMutationRefusal({ reason: result.reason });
        logger.error('[PhaseSkew] repair changed nothing:', outcome.diagnostic ?? result.message);
        setSeasonPhaseRepairError(outcome.userMessage);
      }
    } catch (err: any) {
      logger.error('[PhaseSkew] repair failed:', err?.diagnostic || err?.message || err);
      setSeasonPhaseRepairError(classifyProgramMutationRefusal({ error: err }).userMessage);
    } finally {
      setSeasonPhaseRepairBusy(false);
    }
  };

  const executePhaseShift = async () => {
    setRebuildMsgIdx(0);
    rebuildMsgOpacity.setValue(1);
    setPhaseShiftStep('building');
    setIsRebuilding(true);
    clearRebuildError();
    // Fall back to the step the user was on so they can act on a refusal.
    // Off-season's last interactive step is `availability`; Pre-season's is
    // `teamDays`; In-season's is `gameDay`. Matches the forward-path terminal.
    const interactiveStep: PhaseShiftStep = targetPhase === 'In-season'
      ? 'gameDay'
      : targetPhase === 'Pre-season'
        ? 'teamDays'
        : 'availability';
    try {
      // The pure mutation still owns the overlay rules, so the QA harness
      // exercises the same logic. It REFUSES an In-season shift with no
      // game-anchor answer rather than silently clearing the anchor.
      const nextProfile = applyPhaseShift(onboardingData, {
        targetPhase,
        preferredTrainingDays: pendingPreferredDays,
        teamTrainingDays: pendingTeamDays,
        gameAnchor: targetPhase === 'In-season' && pendingGameAnchorAnswered
          ? (pendingGameDay
            ? { kind: 'usual_day', day: pendingGameDay }
            : { kind: 'no_usual_day' })
          : undefined,
      });
      const patch: Partial<typeof onboardingData> = {
        seasonPhase: nextProfile.seasonPhase,
        // The availability step re-asks every shift — onboarding data can be
        // months stale — so the answer is carried into the same patch.
        preferredTrainingDays: nextProfile.preferredTrainingDays,
        trainingDaysPerWeek: nextProfile.trainingDaysPerWeek,
        teamTrainingDays: nextProfile.teamTrainingDays,
        teamTrainingDaysPerWeek: nextProfile.teamTrainingDaysPerWeek,
        usualGameDay: nextProfile.usualGameDay,
        gameDay: nextProfile.gameDay,
      };
      if (__DEV__) {
        logger.debug('[PhaseShift] Committing:', patch);
      }
      const result = await commitProfileProgramTransaction({
        change: { kind: 'profile_setup', patch },
        todayISO: todayISOLocal(),
        sourceSurface: 'phase_shift',
      });
      if (!result.ok) {
        const refusal = classifyProgramMutationRefusal({ reason: result.reason });
        logger.error('[PhaseShift] refused:', refusal.diagnostic ?? result.message);
        setRebuildError(refusal.userMessage);
        setRebuildErrorCanRetry(refusal.canRetry);
        setPhaseShiftStep(interactiveStep);
        return;
      }
      if (!result.changedProgram) {
        // A shift that changed nothing is an outcome the athlete is told
        // about, not a silent close that looks like success.
        const outcome = classifyProgramMutationRefusal({ reason: result.reason });
        setRebuildError(outcome.userMessage);
        setRebuildErrorCanRetry(outcome.canRetry);
        setPhaseShiftStep(interactiveStep);
        return;
      }
      setPhaseShiftModalVisible(false);
      setPhaseShiftStep('confirm');
    } catch (err: any) {
      logger.error('[PhaseShift] failed:', err?.diagnostic || err?.message || err);
      const refusal = classifyProgramMutationRefusal({ error: err });
      setRebuildError(refusal.userMessage);
      setRebuildErrorCanRetry(refusal.canRetry);
      setPhaseShiftStep(interactiveStep);
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
      // Guarded by the button's disabled state; an unanswered anchor would
      // be refused by `applyPhaseShift` anyway.
      if (!pendingGameAnchorAnswered) return;
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
  // This helper runs the deterministic local generation path with a
  // temporary game/no-game profile, then commits only a week-scoped overlay.
  // The athlete's `usualGameDay` and the shared base program template stay
  // intact so future weeks resolve from the normal recurring structure.
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
  // succeeds do we commit the selected-week overlay AND run the caller's
  // game-mark commit and accepted program publication together. On failure nothing is
  // touched \u2014 no more "Game Day card shows but the week didn't reshape".
  //
  // Returns true when the rebuild + commit succeeded so callers can gate
  // their own follow-up state (mode/selection) on it.
  const rebuildForGameChange = async (
    newGameDay: DayOfWeek | null,
    options: { targetDate: string; clearOverlayDate?: string },
  ): Promise<boolean> => {
    clearRebuildError();
    try {
      if (__DEV__) {
        logger.debug('[GameChange] Canonical local rebuild:', { newGameDay });
      }
      // FixtureMutationTransaction derives the accepted profile, visible
      // before-state, fixture facts and rolling horizon, then commits the
      // fixture, repaired program, reversible ledger and Coach Note proof.
      const action = options.clearOverlayDate
        ? 'move' as const
        : newGameDay ? 'add' as const : 'remove' as const;
      const sourceDate = action === 'move'
        ? options.clearOverlayDate
        : action === 'remove' ? options.targetDate : undefined;
      const mutation = await executeFixtureMutationTransaction({
        action,
        fixtureKind: canonicalFixtureKind(ownedPhase),
        ...(sourceDate ? { sourceDate } : {}),
        ...(action !== 'remove' ? { targetDate: options.targetDate } : {}),
        expectedAcceptedRevision: acceptedRevision,
        source: {
          requestedBy: 'athlete',
          producer: 'tap',
          surface: 'program_tab',
          commandId: [
            'home-fixture',
            action,
            sourceDate ?? 'none',
            options.targetDate,
            `revision-${acceptedRevision}`,
          ].join(':'),
        },
      });
      if (mutation.outcome === 'no_change') return true;
      if (mutation.outcome === 'conflicted' || mutation.outcome === 'impossible') {
        throw mutation.error;
      }
      if (mutation.traceId) {
        const fixtureDate = newGameDay === null
          ? sourceDate ?? options.targetDate
          : options.targetDate;
        const fixtureId = `calendar-game-${fixtureDate}`;
        const fixtureState = newGameDay === null ? 'absent' as const : 'active' as const;
        const controlId = explorerTestId.fixtureState(fixtureId, fixtureState);
        const observationId = `home-fixture-result:${mutation.traceId}`;
        registerAthleteActionUIOutcome({
          traceId: mutation.traceId,
          observationId,
          domainReturn: {
            outcome: mutation.outcome,
            sourceDate: options.clearOverlayDate ?? null,
            targetDate: options.targetDate,
            fixtureExpectedAtTarget: newGameDay !== null,
          },
          controlId,
        });
        setPendingFixtureObservation({
          traceId: mutation.traceId,
          observationId,
          sourceDate: options.clearOverlayDate,
          targetDate: options.targetDate,
          fixtureExpectedAtTarget: newGameDay !== null,
          fixtureId,
        });
      }
      const result = mutation.result;
      alertGameConflicts(result.sweep.conflictsRemoved);
      return true;
    } catch (err: any) {
      logger.error('[GameChange] Rebuild failed:', err?.diagnostic || err?.message || err);
      const { userMessage, canRetry } = classifyRebuildFailure(err);
      Alert.alert(
        'Couldn\u2019t update your week',
        userMessage,
        canRetry
          ? [
              { text: 'Dismiss', style: 'cancel' },
              {
                text: 'Try again',
                onPress: () => {
                  void rebuildForGameChange(newGameDay, options);
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

      setMode({ type: 'normal' });
      setSelectedIdx(idx);

      if (currentPhase !== 'In-season' && currentPhase !== 'Pre-season') return;
      const targetName = DAY_NUM_TO_NAME[day.dayOfWeek];
      await rebuildForGameChange(targetName, {
        targetDate,
        clearOverlayDate: fromDate,
      });
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
      if (currentPhase !== 'In-season' && currentPhase !== 'Pre-season') return;
      const targetName = DAY_NUM_TO_NAME[day.dayOfWeek];
      await rebuildForGameChange(targetName, {
        targetDate: day.date,
      });
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
   * SELECT A DAY, NEVER TOGGLE IT OFF — the day-first view's picker.
   *
   * The week list's selection is a toggle because selection there is expansion:
   * tapping the open row closes it and the list is still whole. The day-first
   * view is the other shape — the strip picks WHICH day the screen is about, and
   * a strip that could deselect would leave the screen about nothing.
   *
   * Same setter, same sentinel, same owner. This is one more question asked of
   * the existing selection state, not a second selection state.
   */
  const handleSelectDay = (idx: number) => {
    if (mode.type !== 'normal') return;
    setSelectedIdx(idx);
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
      const { userMessage, canRetry } = classifyRebuildFailure(err);
      setRebuildError(userMessage);
      setRebuildErrorCanRetry(canRetry);
    } finally {
      setIsRebuilding(false);
    }
  }, [rebuildMsgOpacity, runRebuild]);

  const registerSourceFactRenderObservation = useCallback((args: {
    result: ProgramControlActionResult;
    domain: 'readiness' | 'equipment';
    expectedStatus: 'active' | 'resolved';
    factId?: string;
    controlId?: string;
  }) => {
    const factId = args.factId ?? (args.expectedStatus === 'active'
      ? args.result.createdModifierIds?.[0]
      : args.result.clearedModifierIds?.[0]);
    if (!args.result.ok || !args.result.traceId || !factId) return;
    const traceId = args.result.traceId;
    const controlId = args.controlId ?? (args.domain === 'equipment'
      ? args.expectedStatus === 'active'
        ? explorerTestId.equipmentActive(factId)
        : explorerTestId.equipmentCleared(factId)
      : args.expectedStatus === 'active'
        ? explorerTestId.readinessActive(factId)
        : explorerTestId.readinessClear(factId));
    const observationId = `${args.domain}-${args.expectedStatus}:${traceId}`;
    registerAthleteActionUIOutcome({
      traceId,
      observationId,
      domainReturn: {
        ok: args.result.ok,
        factId,
        expectedStatus: args.expectedStatus,
        changedProgram: args.result.changedProgram,
      },
      controlId,
    });
    setPendingSourceFactObservations((current) => [...current, {
      traceId,
      observationId,
      domain: args.domain,
      factId,
      expectedStatus: args.expectedStatus,
      controlId,
    }]);
  }, []);

  const handleApplyHomeQuickStatus = useCallback(async (
    action: HomeQuickStatusAction,
  ) => {
    const todayISO = todayISOLocal();
    if (action === 'busy_week_reduce') {
      const result = await executeProgramControlActionDurably({
        type: 'set_schedule_modifier',
        source: {
          screen: 'program_tab',
          surface: 'home_quick_action_busy_week',
          initiatedBy: 'tap',
        },
        // V1 HomeScreen's quick action, which is not on the athlete's path
        // (App.tsx renders HomeScreenV2). Its copy still says "Busy week", so
        // its scope still says week — the ruling that made the scope a lie
        // renamed the V2 button, not this one.
        scope: 'current_week',
        payload: {
          date: todayISO,
          todayISO,
        },
        requiresRebuild: false,
        createsActiveModifier: true,
        oneOffOnly: false,
      }, { todayISO });
      await handleProgramControlResult(result);
    }
  }, [handleProgramControlResult]);

  const handleApplyEquipmentDecision = useCallback(async (
    decision: EquipmentLimitationDecision,
    anchorDateISO?: string,
  ) => {
    const todayISO = todayISOLocal();
    const activeFactId = temporarySourceFacts
      .filter(isTemporaryEquipmentFact)
      .find((fact) => fact.status === 'active')?.factId;
    const result = await executeProgramControlActionDurably({
      type: 'set_equipment_modifier',
      source: {
        screen: 'program_tab',
        surface: 'equipment_limitation_sheet',
        initiatedBy: 'tap',
      },
      scope: 'current_week',
      payload: {
        decision,
        date: anchorDateISO ?? weekDays[0]?.date ?? todayISO,
        todayISO,
      },
      requiresRebuild: false,
      createsActiveModifier: decision.kind === 'missing_this_week',
      oneOffOnly: false,
    }, { todayISO });
    registerSourceFactRenderObservation({
      result,
      domain: 'equipment',
      expectedStatus: decision.kind === 'available_again' ? 'resolved' : 'active',
      factId: decision.kind === 'available_again' ? activeFactId : undefined,
    });
    await handleProgramControlResult(result);
    return result;
  }, [
    handleProgramControlResult,
    registerSourceFactRenderObservation,
    temporarySourceFacts,
    weekDays,
  ]);

  // ── Short on time today / Away this week (vocab group 5) ──
  // Both are canonical temporary schedule facts through the one door. Away
  // carries exact unavailable dates and never creates fact-owned Rest
  // overrides.
  //
  // SCOPE IS THE COPY'S PROMISE, NOT A DEFAULT. Sam's ruling 2 (2026-07-31)
  // named this button "Short on time today", so the fact it writes is
  // today-scoped: `scope: 'today_only'` reaches the executor, which builds a
  // `date`-kind fact horizon, which `constraintAppliesToDate` honours on
  // exactly one day. It used to say `current_week` under the same tap, so a
  // rushed Tuesday reduced Saturday too.
  const handleApplyShortOnTimeToday = useCallback(async () => {
    const todayISO = todayISOLocal();
    const result = await executeProgramControlActionDurably({
      type: 'set_schedule_modifier',
      source: {
        screen: 'program_tab',
        surface: 'short_on_time_today',
        initiatedBy: 'tap',
      },
      scope: 'today_only',
      payload: { date: todayISO, todayISO },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [handleProgramControlResult]);

  // ── Weekly readiness ("I'm sick/flat today") ──
  // This surface only routes into existing owners: today's readiness signal
  // for tired/sore, a factual week-scoped cooked report, and week recovery
  // mode for sick. Independent facts remain active until their exact report
  // is resolved; busy/away and injury modifiers remain independent.
  const handleApplyWeekReadiness = useCallback(async (
    kind: WeekReadinessAction,
    anchorDateISO: string,
  ) => {
    const todayISO = todayISOLocal();
    // Single owner: every tier maps through the one pure `readinessActionForKind`
    // function (invariant R16). The three sick doors write a TIER and nothing
    // else — illness_mild (record-only + inert, today-scoped soften offer),
    // illness_moderate (deloads while active, minimums intact) and
    // illness_severe (deloads AND lifts every minimum, deriving the
    // illness_recovery §18 week mode — no shutdown_week, no recovery-mode
    // writer). What a tier DOES is the illness law's answer, resolved
    // downstream; this layer must never grow a second opinion about it. The
    // day-card door opens this same sheet, so both doors commit identically.
    const result = await executeProgramControlActionDurably(
      readinessActionForKind(kind, { anchorDateISO, todayISO }),
      { todayISO },
    );
    registerSourceFactRenderObservation({
      result,
      domain: 'readiness',
      expectedStatus: 'active',
    });
    await handleProgramControlResult(result);
    return result;
  }, [handleProgramControlResult, registerSourceFactRenderObservation, weekDays]);

  const handleClearWeekReadiness = useCallback(async (constraintId: string) => {
    const todayISO = todayISOLocal();
    // The clear action resolves ACTIVE PROGRAM MODIFIER ids
    // (program-modifier:active_constraint:<constraintId>), not raw
    // constraint ids — resolve through the same selector Coach Notes use.
    const modifier = getActiveProgramModifiers()
      .find((m) => m.sourceId === constraintId);
    const sourceFactId = activeConstraints.find((constraint) => constraint.id === constraintId)
      ?.temporarySourceFactIds?.[0];
    const factId = sourceFactId ?? constraintId;
    const result = await executeProgramControlActionDurably({
      type: 'clear_fatigue_status',
      source: { screen: 'program_tab', surface: 'week_readiness_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: { modifierId: modifier?.id ?? constraintId, date: todayISO },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: false,
    }, { todayISO });
    registerSourceFactRenderObservation({
      result,
      domain: 'readiness',
      expectedStatus: 'resolved',
      factId,
      controlId: sourceFactId
        ? explorerTestId.readinessClear(sourceFactId)
        : explorerTestId.readinessClearState(weekDays[0]?.date ?? todayISO),
    });
    await handleProgramControlResult(result);
    return result;
  }, [
    activeConstraints,
    handleProgramControlResult,
    registerSourceFactRenderObservation,
    weekDays,
  ]);

  const handleApplyAwayDays = useCallback(async (dates: string[]) => {
    const todayISO = todayISOLocal();
    // Anchor the schedule note to the week the away days actually fall in
    // so it shows + expires on the right week (not necessarily this one).
    const anchor = [...dates].sort()[0] ?? todayISO;
    const result = await executeProgramControlActionDurably({
      type: 'set_schedule_modifier',
      source: {
        screen: 'program_tab',
        surface: 'away_this_week',
        initiatedBy: 'tap',
      },
      scope: 'current_week',
      payload: {
        date: anchor,
        todayISO,
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
      const workout = weekDays.find((day) => day.date === missed.date)?.workout ?? null;
      const feedback = missedSessionFeedback(missed.date, response);
      const result = await commitSessionOutcomeTransaction(
        createRecordSessionOutcomeIntentFromFeedback({
          date: missed.date,
          feedback,
          workout,
          todayISO,
          source: {
            entryPoint: 'tap',
            surface: 'missed_session_prompt',
          },
        }),
      );
      if (!result.ok) logger.warn('[missed-session] feedback transaction failed', result);
      return;
    }
    if (response === 'skip_it') {
      const result = await executeProgramControlActionDurably({
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
      const workout = weekDays.find((day) => day.date === missed.date)?.workout ?? null;
      const feedback = missedSessionFeedback(missed.date, 'missed_it');
      const result = await commitSessionOutcomeTransaction(
        createRecordSessionOutcomeIntentFromFeedback({
          date: missed.date,
          feedback,
          workout,
          todayISO,
          source: {
            entryPoint: 'tap',
            surface: 'missed_session_prompt_no_move_target',
          },
        }),
      );
      if (!result.ok) logger.warn('[missed-session] fallback feedback transaction failed', result);
      return;
    }
    const result = await executeProgramControlActionDurably({
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
    const actionResult = await executeProgramControlActionDurably({
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
    const episodeId = actionResult.createdModifierIds?.[0];
    if (actionResult.ok && actionResult.traceId && episodeId) {
      const controlId = explorerTestId.injuryActive(episodeId);
      const observationId = `injury-active:${actionResult.traceId}`;
      registerAthleteActionUIOutcome({
        traceId: actionResult.traceId,
        observationId,
        domainReturn: {
          episodeId,
          existingConstraintId: existingId ?? null,
          changedProgram: actionResult.changedProgram,
        },
        controlId,
      });
      setPendingInjuryObservation({
        traceId: actionResult.traceId,
        observationId,
        episodeId,
        expectedStatus: 'active',
        controlId,
      });
    }
    await handleProgramControlResult(actionResult);
  }, [handleProgramControlResult]);

  const handleClearCoachNote = useCallback(async (
    noteId: string,
    observeResult = true,
  ) => {
    const note = coachNotes.find((candidate) => candidate.id === noteId);
    if (note?.injuryEpisodeId) {
      const result = await executeProgramControlActionDurably({
        type: 'clear_injury_modifier',
        source: {
          screen: 'program_tab',
          surface: 'coach_notes_injury_resolved',
          initiatedBy: 'tap',
        },
        scope: 'current_and_future',
        payload: { noteId, episodeId: note.injuryEpisodeId },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: false,
      }, { todayISO: todayISOLocal() });
      if (result.ok && result.traceId) {
        const controlId = explorerTestId.injuryResolved(note.injuryEpisodeId);
        const observationId = `injury-resolved:${result.traceId}`;
        registerAthleteActionUIOutcome({
          traceId: result.traceId,
          observationId,
          domainReturn: {
            episodeId: note.injuryEpisodeId,
            changedProgram: result.changedProgram,
          },
          controlId,
        });
        setPendingInjuryObservation({
          traceId: result.traceId,
          observationId,
          episodeId: note.injuryEpisodeId,
          expectedStatus: 'resolved',
          controlId,
        });
      }
      await handleProgramControlResult(result);
      if (!result.ok) {
        Alert.alert('Couldn’t resolve this injury', result.message ??
          'The accepted program could not be safely recomposed.');
      }
      return;
    }
    if (note?.reversibleAdjustmentId) {
      const result = await clearReversibleAdjustment(
        note.reversibleAdjustmentId,
        useProgramStore.getState().acceptedMaterialContext.revision,
      );
      const restored = result.outcome === 'restored' || result.outcome === 'recomposed' ||
        result.outcome === 'already-cleared';
      if (result.traceId && restored) {
        const observationId = `home-restoration-result:${result.traceId}`;
        registerAthleteActionUIOutcome({
          traceId: result.traceId,
          observationId,
          domainReturn: {
            outcome: result.outcome,
            acceptedRevisionAfter: result.acceptedRevisionAfter,
            affectedDates: result.affectedDates,
          },
          controlId: explorerTestId.adjustmentRestored(note.reversibleAdjustmentId),
        });
        setPendingRestorationObservation({
          traceId: result.traceId,
          observationId,
          acceptedRevisionAfter: result.acceptedRevisionAfter,
          affectedDates: result.affectedDates,
          adjustmentId: note.reversibleAdjustmentId,
          controlId: explorerTestId.adjustmentRestored(note.reversibleAdjustmentId),
        });
      }
      if (result.outcome === 'safely-rejected' || result.outcome === 'conflicted' ||
        result.outcome === 'superseded') {
        // result.reason can be a raw transaction error.message — never show it
        // verbatim (census finding #8 / addendum i). The safety gate collapses an
        // internal reason to plain copy; a curated reason passes through.
        Alert.alert('Couldn’t restore this adjustment', athleteSafeRefusal(result.reason ??
          'Your program has changed since this adjustment was made.'));
      }
      return;
    }
    const constraint = note
      ? useProgramStore.getState().acceptedMaterialContext.activeConstraints
          .find((candidate) => candidate.id === note.constraintId)
      : null;
    const sourceFactId = note?.temporarySourceFactIds?.[0];
    const sourceFactDomain = sourceFactId && temporarySourceFacts.some((fact) =>
      isTemporaryEquipmentFact(fact) && fact.factId === sourceFactId)
      ? 'equipment' as const
      : 'readiness' as const;
    const result = (constraint?.temporarySourceFactIds?.length ?? 0) > 0
      ? await executeProgramControlActionDurably({
          type: 'clear_fatigue_status',
          source: { screen: 'program_tab', surface: 'coach_notes_resolved', initiatedBy: 'tap' },
          scope: 'current_and_future',
          payload: { noteId, modifierId: note?.modifierId, date: todayISOLocal() },
          requiresRebuild: false,
          createsActiveModifier: false,
          oneOffOnly: false,
        }, { todayISO: todayISOLocal() })
      : clearCoachNoteAction(noteId);
    if (sourceFactId && observeResult) {
      registerSourceFactRenderObservation({
        result,
        domain: sourceFactDomain,
        expectedStatus: 'resolved',
        factId: sourceFactId,
      });
    }
    await handleProgramControlResult(result);
  }, [
    clearCoachNoteAction,
    coachNotes,
    handleProgramControlResult,
    registerSourceFactRenderObservation,
    temporarySourceFacts,
  ]);

  const handleDismissCoachNote = useCallback((noteId: string) => {
    dismissActiveCoachNote(noteId);
  }, []);

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
      await handleClearCoachNote(noteId, false);
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
      : await executeProgramControlActionDurably({
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
    registerSourceFactRenderObservation({
      result,
      domain: 'readiness',
      expectedStatus: 'active',
    });
    await handleProgramControlResult(result);
  }, [
    clearCoachNoteAction,
    handleClearCoachNote,
    handleDismissCoachNote,
    handleProgramControlResult,
    registerSourceFactRenderObservation,
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

    // Structural rebuild: the calendar override alone only hides the game
    // marker — the engine's weeklyPlan still reflects the WITH-game branch,
    // so Saturday would otherwise render as the G+1 recovery template.
    // Deterministic local rebuild via the NO-game branch (Saturday becomes
    // a core peak + conditioning day). Pre-season practice matches use the
    // same anchor logic.
    if (currentPhase !== 'In-season' && currentPhase !== 'Pre-season') return;
    await rebuildForGameChange(null, {
      targetDate: removedDate,
    });
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
    visibleWeek,
    weekLabel,
    weekOffset,
    isThisWeek,
    handlePrev,
    handleNext,
    handleThisWeek,

    // Selection / interaction mode
    selectedIdx,
    // The index of today in the displayed week, or -1 on any other week. The
    // day-first view needs it to fall back to today rather than re-deriving
    // "which day is now" beside the owner that already answered it.
    todayIdx,
    mode,
    handleDayTap,
    handleSelectDayOnly,
    handleSelectDay,
    handleClearSelection,
    handleCancelMove,
    handleAddGameMode,

    // Per-day actions
    handleViewWorkout,
    handleFinishTeamSession,
    handleOpenProgramSetup,
    handleApplyHomeQuickStatus,
    handleApplyGuidedInjury,
    handleApplyEquipmentDecision,

    // Short on time / away + missed sessions (vocab groups 5 + 2)
    handleApplyShortOnTimeToday,

    // Block-rollover honest refusal (Sam's interim ruling, 2026-07-31)
    rolloverRefusal,
    handleRetryRollover,
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
    todayReadinessModifier,
    injuryEpisodes,
    readinessFacts,
    equipmentFacts,
    visibleReversibleAdjustments,
    currentProgram,
    sessionFeedback,
    handleClearCoachNote,
    handleDismissCoachNote,
    handleUpdateCoachNoteStatus,

    // Game-day modal
    gameModalVisible,
    gameModalDate,
    gameModalLabel,
    closeGameModal,
    handleOpenGameDayActions,
    handleLogGame,
    handleMoveGameDay,
    handleRemoveGameDay,

    // Season-phase skew disclosure + its one repair path
    seasonPhaseSkew,
    seasonPhaseRepairBusy,
    seasonPhaseRepairError,
    handleRepairSeasonPhaseSkew,

    // Rebuild modal
    rebuildModalVisible,
    isRebuilding,
    rebuildError,
    rebuildErrorCanRetry,
    rebuildMsgIdx,
    rebuildMsgOpacity,
    handleCancelRebuild,
    handleConfirmRebuild,

    // Phase-shift modal
    phaseShiftModalVisible,
    phaseShiftStep,
    pendingPreferredDays,
    pendingTeamDays,
    pendingGameDay,
    pendingGameAnchorAnswered,
    targetPhase,
    handleOpenPhaseShift,
    handleCancelPhaseShift,
    handlePhaseShiftBack,
    togglePendingPreferredDay,
    togglePendingTeamDay,
    setPendingGameDay: answerUsualGameDay,
    answerNoUsualGameDay,
    handleAdvancePhaseShift,
  };
}
