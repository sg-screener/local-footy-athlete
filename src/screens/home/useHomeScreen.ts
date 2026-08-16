import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useStaleOverrides } from '../../hooks/useStaleOverrides';
import { useRebuildNotice } from '../../hooks/useRebuildNotice';
import {
  beginRebuildNotice,
  endRebuildNotice,
  setRebuildNoticeError,
  clearRebuildNoticeError,
} from '../../store/rebuildNoticeStore';
import { getCurrentBlockNumberForGeneration, useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useDecisionLedgerStore } from '../../store/decisionLedgerStore';
import {
  acknowledgeBlockBoundaryNotice,
  confirmWeeklyCommitment,
  declineWeeklyCommitment,
  EXTRA_SESSION_SOURCE_SURFACE,
} from '../../store/weeklyCommitmentAnswer';
import { useBlockBoundaryPrompts } from './useBlockBoundaryPrompts';
import { availableTrainingDays } from '../../rules/extraSessionOffer';
import { DAYS_OF_WEEK } from '../../rules/gameAnchor';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useReadinessStore } from '../../store/readinessStore';
import { generateProgramFromProfile } from '../../services/api/generateProgram';
import { classifyProgramGenerationFailure } from '../../utils/onboardingGenerationOutcome';
import {
  commitRebuiltProgram,
  decideSweepForCurrentStores,
} from '../../utils/weekRebuild';
import type { SeasonPhase, DayOfWeek } from '../../types/domain';
import { useActiveModifiers } from '../../hooks/useActiveModifiers';
import { isShownOnProgram } from '../../rules/programModifierVisibility';
import {
  getActiveProgramModifiers,
  type ActiveProgramModifier,
} from '../../utils/activeProgramModifiers';
import {
  executeProgramControlActionDurably,
  type ProgramControlActionResult,
} from '../../utils/programControlActions';
import type { EquipmentLimitationDecision } from './EquipmentLimitationSheet';
import {
  readinessActionForKind,
  type WeekReadinessApplyKind,
} from '../../utils/weekReadinessActions';
import {
  buildGuidedInjuryConstraint,
  type GuidedInjuryFlowResult,
} from '../../utils/guidedInjuryControl';
import {
  mostRecentMissedSession,
  missedSessionSkippedFeedback,
  programHistoryBoundaryFromCreatedAt,
  type MissedSession,
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
  DAY_NUM_TO_NAME,
  type InteractionMode,
} from './homeScreenConstants';
import { logger } from '../../utils/logger';
import {
  executeFixtureMutationTransaction,
} from '../../store/fixtureMutationTransaction';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../../dev/e2e/athleteActionUIObservation';
import { dayOfWeekTestIdToken, explorerTestId } from '../../utils/stableTestId';
import { isTemporaryEquipmentFact } from '../../rules/temporarySourceFact';
import type { TemporaryScheduleFact } from '../../rules/temporarySourceFact';
import { decideChristmasBreakAsk } from '../../rules/christmasBreakAsk';
import { factHorizonCoversWeek, isOpenHorizon } from '../../rules/durableFactHorizon';
import { ownSeasonPhase } from '../../rules/seasonPhaseOwner';
import { canonicalFixtureKind } from '../../rules/fixtureConditionedAvailability';
import { classifyProgramMutationRefusal } from '../../rules/programMutationRefusal';
import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';
import { useSeasonPhaseControl } from '../../hooks/useSeasonPhaseControl';
import {
  useProgramRebuild,
  classifyRebuildFailure,
  alertGameConflicts,
} from '../../hooks/useProgramRebuild';
import { useCoachNoteActions } from '../coach/useCoachNoteActions';

type HomeQuickStatusAction = 'busy_week_reduce';
export type WeekReadinessAction = WeekReadinessApplyKind;

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
    canGoPrev,
    canGoNext,
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
  // ONE OWNER, TWO SCREENS. Extracted 2026-08-12 into `hooks/useProgramRebuild`
  // so Coach / My Status — which now owns the modifier controls, four families
  // of which come back asking for a rebuild — runs the SAME rebuild through the
  // SAME notice rather than growing a second one. `LAW-one-name-two-meanings`
  // sighting 7 is this file meaning both "the day screen's state" and "the
  // app's rebuild owner"; this is the second meaning leaving.
  const {
    rebuildModalVisible,
    setRebuildModalVisible,
    runRebuild,
    handleProgramControlResult,
    handleCancelRebuild,
    handleConfirmRebuild,
  } = useProgramRebuild();
  // THE REBUILD NOTICE IS NOT THIS SCREEN'S STATE. A rebuild is one event in
  // the athlete's world, so `store/rebuildNoticeStore.ts` owns it and every
  // surface reads the same truth through this hook. This screen renders those
  // values by the same names it always did — see docs/REBUILD_NOTICE_OWNERSHIP.
  const {
    isRebuilding,
    rebuildMsgIdx,
    rebuildMsgOpacity,
    rebuildError,
    rebuildErrorCanRetry,
  } = useRebuildNotice();
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
  // Classic remains in the source tree as an unreachable compatibility
  // surface. It consumes the same controller My Status owns rather than
  // keeping a second phase mutation implementation alive here.
  const phaseControl = useSeasonPhaseControl();

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
  // `activeInjury`, `dismissedCoachNoteIds`, `athletePrefs` and
  // `modalityPreferences` were read here ONLY to feed the inline
  // `selectActiveCoachNotes` memo above. That memo is now `useActiveModifiers`,
  // which subscribes to the same four itself, so these four reads lost their
  // last reader in the same edit and go with it — a subscription nothing reads
  // is not spare capacity, it is a re-render the screen pays for and a fact the
  // next reader will assume somebody uses.
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

  /**
   * THE CHRISTMAS-BREAK QUESTION THAT IS LIVE TODAY — item 31 part 5.
   *
   * NOT FILTERED BY THE VISIBLE WEEK, unlike the two lists above, and that is
   * deliberate: the question is about the CALENDAR, not about the week the
   * athlete happens to be scrolled to. Paging forward to look at January must
   * not make December's question appear or disappear.
   *
   * `dismissedCoachNoteIds` comes back here after the note above removed it.
   * It has a reader again — "we train through Christmas" is a decision, and the
   * dismissed-id set is the shelf this app already keeps decisions like it on,
   * so it costs no new stored field and no migration.
   */
  const dismissedCoachNoteIds = useCoachUpdatesStore((s) => s.dismissedCoachNoteIds);
  const christmasBreakAsk = useMemo(() => {
    const breaks = temporarySourceFacts.filter((fact) =>
      'factKind' in fact && fact.factKind === 'schedule' &&
      (fact as { scheduleKind?: string }).scheduleKind === 'no_team_training' &&
      fact.status === 'active') as TemporaryScheduleFact[];
    // OPEN-NESS IS ASKED OF THE HORIZON OWNER, NEVER READ OFF THE FIELD.
    // `test:fact-horizon` T5 caught the first version of this comparing
    // `effectiveUntil === null` by hand — a second opinion about a duration,
    // which is exactly the one-owner rule that module exists to hold.
    return decideChristmasBreakAsk({
      todayISO: todayISOLocal(),
      seasonPhase: onboardingData?.seasonPhase,
      teamTrainingDays: onboardingData?.teamTrainingDays,
      openBreakFromISO: breaks.find(isOpenHorizon)?.effectiveFrom ?? null,
      // DESTRUCTURED RATHER THAN DOTTED OFF THE PARAMETER, AND THAT IS NOT
      // STYLE. `test:fact-horizon` T5 forbids comparing a fact's raw window
      // bounds, and its detector looks for a comparison operator beside one of
      // those field names. AN ARROW FUNCTION SATISFIES IT — the arrow ends in
      // the same character a greater-than does — so returning the field
      // straight out of an arrow reads to that gate as a comparison. It is a
      // false positive, it belongs to that suite, and it is named in the
      // boundary report rather than quietly loosened here. This shape avoids it
      // and costs nothing. (Writing the offending form even in a COMMENT trips
      // it too: the gate reads source, not code.)
      answeredBreakFromISOs: breaks
        .filter((fact) => !isOpenHorizon(fact))
        .map(({ effectiveFrom }) => effectiveFrom),
      dismissedIds: dismissedCoachNoteIds,
    });
  }, [temporarySourceFacts, onboardingData, dismissedCoachNoteIds]);
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
  /**
   * THE SAME DERIVATION MY STATUS USES, NOT A SECOND ONE.
   *
   * Until 2026-08-13 this was an inline `selectActiveCoachNotes` memo whose
   * seven store reads and two week inputs were byte-for-byte the ones inside
   * `useActiveModifiers`. That was survivable while Program only needed the
   * LIST — but SEAT_INBOX item 16 puts a COUNT on the day and week screens,
   * and its rule (d) is that the count comes from this hook and never from a
   * separate tally. Two copies of one selector is `a count taken for a record`
   * (sighting 14 in this repo): the copies agree until the day one of them is
   * given a filter the other never hears about.
   *
   * So the duplicate is COLLAPSED rather than joined by a third: the strip's
   * count is `modifiers.length` of the very list `coachNoteActions` acts on and
   * My Status renders, which is why the number on the day screen cannot
   * disagree with the list behind it.
   */
  const { modifiers: coachNotes } = useActiveModifiers({
    visibleWeekDays: weekDays,
    weekKind: visibleWeekKind,
  });

  /**
   * WHAT PROGRAM SHOWS, AND THEREFORE WHAT PROGRAM COUNTS — SEAT_INBOX 22(b).
   *
   * **Sam, 2026-08-13:** *"hide time caps from the Program count and the popup
   * together, keep them on My Status."*
   *
   * ONE FILTER, APPLIED ONCE, FEEDING BOTH. The notice's number and the sheet's
   * rows are the same array here, so they cannot disagree — which was the whole
   * risk in hiding a row. `isShownOnProgram` lives beside the sheet that renders
   * the rows, so there is no second copy of the rule to drift.
   *
   * `coachNotes` STAYS WHOLE for `coachNoteActions` below: the action router is
   * about what CAN be acted on, not what Program draws, and narrowing it here
   * would quietly remove a door rather than a row.
   *
   * MY STATUS IS UNFILTERED, by the same ruling — it holds the only control
   * that clears a time cap, so filtering there would strand an active
   * constraint with no door at all.
   */
  const programModifiers = useMemo(
    () => coachNotes.filter(isShownOnProgram),
    [coachNotes],
  );
  const modifierCount = programModifiers.length;

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


  // ── THE TWO BLOCK-BOUNDARY PROMPTS ──
  //
  // Both are DERIVED (`useBlockBoundaryPrompts`) from the stored program, the
  // logged sessions and the decision ledger. Nothing here writes; the answers
  // below go through `store/weeklyCommitmentAnswer.ts`, the only writer.
  const ledgerEntries = useDecisionLedgerStore((s) => s.entries);
  const blockBoundaryPrompts = useBlockBoundaryPrompts({
    currentProgram,
    blockNumber: blockState?.blockNumber ?? null,
    blockStartISO: blockState?.blockStartDate ?? null,
    sessionFeedback,
    onboardingData,
    ledgerEntries,
    weekOrder: DAYS_OF_WEEK,
  });
  const blockBoundaryNotice = blockBoundaryPrompts.notice;
  const weeklyCommitmentPrompt = blockBoundaryPrompts.commitment;
  const extraSessionOffer = blockBoundaryPrompts.extraSession;

  /** Dismiss the reduced-block notice. Records the read; touches no program. */
  const handleAcknowledgeBlockBoundaryNotice = useCallback(() => {
    if (!blockBoundaryNotice) return;
    acknowledgeBlockBoundaryNotice({ forBlockNumber: blockBoundaryNotice.forBlockNumber });
  }, [blockBoundaryNotice]);

  /** Confirm a smaller weekly commitment: one canonical fact, then a rebuild. */
  const handleConfirmWeeklyCommitment = useCallback(async (sessionsPerWeek: number) => {
    if (!weeklyCommitmentPrompt || !onboardingData) return;
    await confirmWeeklyCommitment({
      forBlockNumber: weeklyCommitmentPrompt.question.forBlockNumber,
      sessionsPerWeek,
      profile: onboardingData,
      todayISO: todayISOLocal(),
      weekOrder: DAYS_OF_WEEK,
    });
  }, [weeklyCommitmentPrompt, onboardingData]);

  /** Decline. Records the answer so it is not re-asked; changes nothing else. */
  const handleDeclineWeeklyCommitment = useCallback(() => {
    if (!weeklyCommitmentPrompt) return;
    declineWeeklyCommitment({
      forBlockNumber: weeklyCommitmentPrompt.question.forBlockNumber,
    });
  }, [weeklyCommitmentPrompt]);

  /**
   * Accept the extra session — THE SAME DOOR, one session larger.
   *
   * The offer's own `trainingDays` were produced by `commitmentPatchFor` and
   * proven buildable by generation before the card ever rendered, so the athlete
   * cannot accept a week the app will refuse.
   */
  const handleAcceptExtraSession = useCallback(async (sessionsPerWeek: number) => {
    if (!extraSessionOffer || !onboardingData) return;
    await confirmWeeklyCommitment({
      forBlockNumber: extraSessionOffer.offer.forBlockNumber,
      sessionsPerWeek,
      profile: onboardingData,
      todayISO: todayISOLocal(),
      weekOrder: DAYS_OF_WEEK,
      availableDays: availableTrainingDays({
        profile: onboardingData,
        weekOrder: DAYS_OF_WEEK,
      }),
      sourceSurface: EXTRA_SESSION_SOURCE_SURFACE,
    });
  }, [extraSessionOffer, onboardingData]);

  /**
   * *"Keep my current schedule."* One ledger entry, no program write — the same
   * construction the missed-session decline uses, and what stops the offer being
   * put again during this block.
   */
  const handleDeclineExtraSession = useCallback(() => {
    if (!extraSessionOffer) return;
    declineWeeklyCommitment({ forBlockNumber: extraSessionOffer.offer.forBlockNumber });
  }, [extraSessionOffer]);

  // ───────── Error helpers ─────────

  /**
   * Clear error state. The rule (reset `canRetry` to true so a stale
   * `canRetry=false` can't suppress the rebuild button next time) moved to the
   * notice's owner with the state itself; this is the local name for it.
   */
  const clearRebuildError = clearRebuildNoticeError;

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
  // THE TICKER MOVED TO THE NOTICE'S OWNER. It used to live here as an effect,
  // which meant a second screen mounting a rebuild reader would run a second
  // interval and rotate the messages at double speed. One rebuild, one ticker.

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

  /**
   * THE DAY/WEEK NOTICE IS A DOORWAY, AND THIS IS THE DOOR IT OPENS.
   *
   * `status: 'open'` is a NAVIGATION param, not a Coach-private boolean, and
   * that is the whole reason Program can open My Status at all — cell [9] of
   * `test:coach-tab-slice3` holds that ownership ("a private Coach boolean
   * cannot be opened by Program"). `CoachTabScreen` reads the param, opens the
   * screen, and clears it; Program only has to ask.
   */
  const handleOpenMyStatus = useCallback(() => {
    navigation.navigate('CoachTab', { status: 'open' });
  }, [navigation]);

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

  /**
   * AWAY IS AN EQUIPMENT ANSWER WITH DATES ON IT — SEAT_INBOX item 28.
   *
   * **Sam, 2026-08-13, refusing the question this seat asked him:** *"can't we
   * just treat going away as a modifier for equipment? the athlete just removes
   * the equipment they don't have while on the trip and it's kept that way
   * until they turn the modifier off and say 'i'm back now'"*.
   *
   * THE DOOR THAT STOOD HERE WROTE A `travel` SCHEDULE FACT WITH THE AWAY DAYS
   * MARKED UNAVAILABLE — it took the sessions AWAY. That is the opposite of
   * what he asked for twice (*"if yes, follow same program"*, *"the plan should
   * change until their return date"*), and it also made this item impossible to
   * build honestly: an equipment answer dated over days that no longer hold a
   * session substitutes nothing. It would have shipped green and empty.
   *
   * So the away door now writes ONE fact — the dated equipment fact
   * (`missing_for_span`, `bfad51b7`) — over the span the athlete just gave. The
   * sessions stay; the exercises change; the fact lifts itself on the return
   * date, with "Equipment available again" as the early exit.
   *
   * WHEN THE ATHLETE HAS THEIR NORMAL KIT, NOTHING IS WRITTEN, and that is the
   * ruling rather than an omission: *"if yes, follow same program"*.
   */
  /**
   * THE TRIP ITSELF — SEAT_INBOX item 28, and Sam's answer to the one question
   * this flow left open: *"yes clear team training and games while away"*.
   *
   * WRITTEN IN BOTH BRANCHES, because the club is shut to him either way. The
   * equipment answer decides what his OWN sessions look like; this fact decides
   * that he is not at the club. A trip with normal kit therefore still writes
   * exactly one fact, and *"if yes, follow same program"* stays true of every
   * session that was ever his to do.
   *
   * IT MARKS NO DATE UNAVAILABLE. What being away DOES is derived at
   * `postGenerationConstraintValidation`, where the day's parts are known —
   * club-bound work goes, solo work stays. The door that stood here sent
   * `clear_days` and lost the whole day.
   */
  const handleApplyAwaySpan = useCallback(async (
    span: { from: string; until: string },
  ) => {
    const todayISO = todayISOLocal();
    const result = await executeProgramControlActionDurably({
      type: 'set_schedule_modifier',
      source: {
        screen: 'program_tab',
        surface: 'away_this_week',
        initiatedBy: 'tap',
      },
      scope: 'current_week',
      payload: { date: span.from, todayISO, awaySpan: span },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { visibleWeek: weekDays, todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [weekDays, handleProgramControlResult]);

  /**
   * THE TWO CHRISTMAS-BREAK ANSWERS — SEAT_INBOX item 31 part 5.
   *
   * ONE DOOR FOR BOTH QUESTIONS, and that is the whole reason the January half
   * is safe. December sends `{ from, until: null }` and January sends
   * `{ from: <the same day>, until: <the day before it is back> }`; the executor
   * derives ONE fact id from `from`, so the second answer REPLACES the first
   * instead of laying a second break over the top of it. Two doors would have
   * needed two ids and a rule about which one wins.
   *
   * IT IS NOT THE AWAY DOOR. Away writes `awaySpan`, and away deletes the
   * fixture too. Over the break the athlete is home: his club is shut, and a
   * game he entered himself is still his game.
   */
  const handleApplyChristmasBreak = useCallback(async (
    span: { from: string; until: string | null },
  ) => {
    const todayISO = todayISOLocal();
    const result = await executeProgramControlActionDurably({
      type: 'set_schedule_modifier',
      source: {
        screen: 'program_tab',
        surface: 'christmas_break',
        initiatedBy: 'tap',
      },
      scope: 'current_week',
      payload: { date: span.from, todayISO, noTeamTrainingSpan: span },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { visibleWeek: weekDays, todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [weekDays, handleProgramControlResult]);

  /**
   * "WE TRAIN THROUGH CHRISTMAS" — the answer that writes no break.
   *
   * A QUESTION WITH NO "NO" IS A NAG, and this one would run for three weeks.
   * The December ask is a real question with two real answers, and the negative
   * one is stored so it is not asked again this season — a dismissed id, on the
   * shelf this app already keeps them on, rather than a new stored field.
   *
   * IT IS OFFERED ON THE DECEMBER QUESTION ONLY. The January question has no
   * dismissal anywhere, because dismissing it would leave a break the athlete
   * already declared running with nothing to end it.
   */
  const handleDismissChristmasBreakAsk = useCallback((dismissId: string) => {
    useCoachUpdatesStore.getState().dismissCoachNote(dismissId);
  }, []);

  const handleApplyAwayEquipment = useCallback(async (
    decision: EquipmentLimitationDecision,
  ) => {
    const todayISO = todayISOLocal();
    const anchor = decision.kind === 'missing_for_span' ? decision.from : todayISO;
    const result = await executeProgramControlActionDurably({
      type: 'set_equipment_modifier',
      source: {
        screen: 'program_tab',
        surface: 'away_this_week',
        initiatedBy: 'tap',
      },
      scope: 'current_week',
      payload: {
        decision,
        date: anchor,
        todayISO,
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { visibleWeek: weekDays, todayISO });
    await handleProgramControlResult(result);
    return result;
  }, [weekDays, handleProgramControlResult]);

  // ── Missed sessions ──
  // The prompt does not own a parallel survey or move engine. It exposes the
  // existing visible owners for those two decisions; this hook owns only the
  // two real operations it can perform without another athlete choice.
  const handleLogMissedSession = useCallback((missed: MissedSession) => {
    const workout = weekDays.find((day) => day.date === missed.date)?.workout;
    if (!workout) return;
    navigation.navigate('DayWorkout', {
      workoutId: workout.id,
      date: missed.date,
      startFinished: true,
    });
  }, [navigation, weekDays]);

  const handleSkipMissedSession = useCallback(async (missed: MissedSession) => {
    const todayISO = todayISOLocal();
    const workout = weekDays.find((day) => day.date === missed.date)?.workout ?? null;
    const feedback = missedSessionSkippedFeedback(missed.date);
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
    if (!result.ok) logger.warn('[missed-session] skipped outcome transaction failed', result);
  }, [weekDays]);

  /**
   * THE COACH-NOTE WRITERS NOW LIVE IN ONE PLACE, AND THIS SCREEN NAMES ITSELF
   * TO THEM.
   *
   * Extracted 2026-08-12 (SEAT_INBOX item 8) into
   * `screens/coach/useCoachNoteActions`, which Coach / My Status mounts with
   * its own source. The bodies are unchanged; the ONLY difference is that the
   * nine `screen: 'program_tab'` literals that used to sit inside them are now
   * this one argument.
   *
   * **The rebuild and the render witnesses stayed here on purpose.**
   * `handleProgramControlResult` reaches `runRebuild`, which regenerates the
   * program, and the pending-observation setters are this screen watching ITSELF
   * re-render a door's result. Neither is a property of the writer, so neither
   * moved — they are handed in, and a surface without them still writes the same
   * state through the same door.
   */
  const coachNoteActions = useCoachNoteActions({
    screen: 'program_tab',
    notes: coachNotes,
    onResult: handleProgramControlResult,
    notifyRefusal: Alert.alert,
    observers: useMemo(() => ({
      onInjuryOutcome: setPendingInjuryObservation,
      onRestorationOutcome: setPendingRestorationObservation,
      onSourceFactOutcome: registerSourceFactRenderObservation,
    }), [registerSourceFactRenderObservation]),
  });
  const handleClearCoachNote = coachNoteActions.clearCoachNote;
  const handleApplyGuidedInjury = coachNoteActions.applyGuidedInjury;
  const handleDismissCoachNote = coachNoteActions.dismissCoachNote;
  const handleUpdateCoachNoteStatus = coachNoteActions.updateCoachNoteStatus;

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

  // `weekHasGame` WAS COMPUTED AND RETURNED HERE, AND IT LEFT WITH ITS ONLY
  // READERS (SEAT_INBOX item 19, 2026-08-13). Both screens used it for one
  // purpose — hiding the add-a-game control once the week had a game — which is
  // exactly the behaviour Sam ruled out. A returned field with no reader is not
  // spare capacity; it is a fact the next surface will trust and re-introduce
  // the cap by accident. The week's fixtures are still derivable from
  // `weekDays` by anything that genuinely needs them.

  /**
   * ONE ADD-FIXTURE CONTROL, IN BOTH COMPETITIVE PHASES, AND IT NEVER STOPS
   * BEING AN *ADD* CONTROL (SEAT_INBOX item 19).
   *
   * **Sam, 2026-08-12:** *"no a user should be able to have as many games as
   * needed in their week"*, pointing straight at the button while he said it.
   *
   * WHAT WAS ACTUALLY WRONG — AND IT WAS NOT WHAT THE ORDER SAID. The order
   * states "in season there is NO add-a-game control at all". Measured
   * 2026-08-13: there WAS one. It was gated `!weekHasGame`, so it existed on an
   * empty week and VANISHED the moment the week had a fixture. Pre-season's
   * card had the same defect wearing different clothes: once a fixture existed
   * it stopped being a button and became a LABEL for that one fixture, routing
   * to its actions. **Neither phase had a route to a SECOND game.** The
   * defect Sam found is real and the fix is the same; the premise was not, and
   * building against "there is no control" would have added a third card beside
   * two that already existed.
   *
   * SO THE GATE IS THE PHASE AND NOTHING ELSE. No fixture count, no cap, no
   * warning at three — his words are "as many games as needed", and a week that
   * gets ugly is the contract's job to disclose, not this button's job to
   * prevent. Off-season keeps no control, exactly as before.
   *
   * TWO FLAGS BECAME ONE because they were one decision wearing two names, and
   * the copy is not this hook's business: the screen already knows the phase and
   * picks the words, the way the picker banner above the days already does.
   */
  const showAddFixtureCTA = useMemo(
    () => currentPhase === 'In-season' || currentPhase === 'Pre-season',
    [currentPhase],
  );

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
    canGoPrev,
    canGoNext,
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

    // Block-rollover honest refusal (Sam's interim ruling, 2026-07-31)
    rolloverRefusal,
    handleRetryRollover,
    handleApplyAwaySpan,
    handleApplyAwayEquipment,
    christmasBreakAsk,
    handleApplyChristmasBreak,
    handleDismissChristmasBreakAsk,
    handleApplyWeekReadiness,
    handleClearWeekReadiness,
    missedSessionPrompt,
    blockBoundaryNotice,
    weeklyCommitmentPrompt,
    extraSessionOffer,
    handleAcknowledgeBlockBoundaryNotice,
    handleConfirmWeeklyCommitment,
    handleAcceptExtraSession,
    handleDeclineExtraSession,
    handleDeclineWeeklyCommitment,
    handleLogMissedSession,
    handleSkipMissedSession,

    // Stale overrides
    staleByDate,

    // Week context / derived
    showAddFixtureCTA,
    currentPhase,
    coachNotes,
    programModifiers,
    modifierCount,
    handleOpenMyStatus,
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

    // Compatibility names for the unreachable Classic screen. The decision
    // flow itself has one owner: useSeasonPhaseControl.
    phaseShiftModalVisible: phaseControl.visible,
    phaseShiftStep: phaseControl.step,
    pendingPreferredDays: phaseControl.pendingPreferredDays,
    pendingTeamDays: phaseControl.pendingTeamDays,
    pendingGameDay: phaseControl.pendingGameDay,
    pendingGameAnchorAnswered: phaseControl.gameAnchorAnswered,
    targetPhase: phaseControl.targetPhase,
    handleOpenPhaseShift: phaseControl.open,
    handleCancelPhaseShift: phaseControl.close,
    handlePhaseShiftBack: phaseControl.back,
    togglePendingPreferredDay: phaseControl.togglePreferredDay,
    togglePendingTeamDay: phaseControl.toggleTeamDay,
    setPendingGameDay: phaseControl.answerGameDay,
    answerNoUsualGameDay: phaseControl.answerNoGameDay,
    handleAdvancePhaseShift: phaseControl.advance,
  };
}
