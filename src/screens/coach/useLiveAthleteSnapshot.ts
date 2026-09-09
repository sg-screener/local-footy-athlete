/**
 * LIVE INPUT ADAPTER FOR THE COACH SNAPSHOT.
 *
 * Store reads stop here. The domain builder remains pure, and every output is
 * recomputed from the existing decisions/facts whenever one of them changes.
 * No Coach Snapshot is persisted.
 *
 * R-397 (Sam, 2026-09-10, plan slice S1): the adapter now also reads WHERE
 * the athlete is in the year (the owned phase and the block clock), the
 * standing weekly pattern, the fixtures ahead, NEXT week through the same
 * projection, the fourteen-day history the app already records (readiness,
 * outcomes, ledger decisions) and the accepted injury episodes. Every read is
 * of an existing owner; nothing new is stored.
 */

import { useMemo } from 'react';
import { useAthleteContext, useProjectedWeekFor } from '../../hooks/useSchedule';
import { useProgramStore } from '../../store/programStore';
import { useProfileStore } from '../../store/profileStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useDecisionLedgerStore } from '../../store/decisionLedgerStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import type { ActiveCoachNote } from '../../utils/activeCoachNotes';
import { todayISOLocal } from '../../utils/appDate';
import { addDaysISO, getStoredBlockStateForDate } from '../../utils/programBlockState';
import type { ResolvedDay } from '../../utils/sessionResolver';
import { ownSeasonPhase } from '../../rules/seasonPhaseOwner';
import { storedGameAnchor } from '../../rules/gameAnchor';
import {
  deriveCoachSnapshot,
  type CoachSnapshot,
  type CoachSnapshotAthlete,
  type CoachSnapshotInjuryEpisodeRecord,
  type CoachSnapshotSeason,
  type CoachSnapshotStanding,
} from '../../rules/liveAthleteSnapshot';
import type { VisibleWeek } from '../../rules/visibleProjection';

export interface UseLiveAthleteSnapshotInput {
  readonly weekDays: readonly ResolvedDay[];
  readonly visibleWeek: VisibleWeek;
  readonly activeModifiers: readonly ActiveCoachNote[];
}

/** Four weeks of fixtures after the as-of date. */
const FIXTURES_AHEAD_DAYS = 28;

export function useLiveAthleteSnapshot(input: UseLiveAthleteSnapshotInput): CoachSnapshot {
  const sessionFeedback = useProgramStore((state) => state.sessionFeedback);
  const currentProgram = useProgramStore((state) => state.currentProgram);
  const blockState = useProgramStore((state) => state.blockState);
  const acceptedMaterialContext = useProgramStore((state) => state.acceptedMaterialContext);
  const trackedLiftChoices = useProfileStore((state) => state.trackedLiftChoices);
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const readinessSignalsByDate = useReadinessStore((state) => state.signalsByDate);
  const markedDays = useCalendarStore((state) => state.markedDays);
  const decisions = useDecisionLedgerStore((state) => state.entries);
  const prefs = useAthletePreferencesStore((state) => state.prefs);
  const athlete = useAthleteContext();
  const asOfDateISO = todayISOLocal();
  const nextWeekStart = addDaysISO(input.visibleWeek.weekStart, 7);
  const nextWeek = useProjectedWeekFor(nextWeekStart).visibleWeek;
  const currentMicrocycle = currentProgram?.microcycles.find((microcycle) => {
    const start = microcycle.startDate.slice(0, 10);
    const end = microcycle.endDate.slice(0, 10);
    return input.visibleWeek.weekStart >= start && input.visibleWeek.weekStart <= end;
  });
  const isDeloadWeek = currentMicrocycle?.weekKind === 'deload'
    || currentMicrocycle?.deloadDoor !== undefined;

  const season = useMemo((): CoachSnapshotSeason | null => {
    const owned = ownSeasonPhase({ program: currentProgram, profile: onboardingData });
    if (!owned.phase) return null;
    let block: ReturnType<typeof getStoredBlockStateForDate> | null = null;
    if (blockState) {
      try {
        block = getStoredBlockStateForDate(
          blockState,
          input.visibleWeek.weekStart,
          owned.phase,
          currentProgram?.seasonPhaseClock,
        );
      } catch (error) {
        console.warn('[coach-snapshot] block clock unavailable for the visible week', error);
      }
    }
    return {
      phase: owned.phase,
      subphase: block?.phaseResolution.subphase ?? null,
      phaseWeekNumber: block?.phaseWeekNumber ?? null,
      weekKind: block?.weekKind ?? currentMicrocycle?.weekKind ?? null,
      blockNumber: block?.blockNumber ?? null,
      weekInBlock: block?.weekInBlock ?? null,
      isDeloadWeek,
    };
  }, [currentProgram, onboardingData, blockState, input.visibleWeek.weekStart, currentMicrocycle, isDeloadWeek]);

  const standing = useMemo((): CoachSnapshotStanding | null => {
    if (!onboardingData) return null;
    return {
      usualGameDay: storedGameAnchor(onboardingData),
      clubNights: [...(onboardingData.teamTrainingDays ?? [])],
      gymDays: [...(onboardingData.preferredTrainingDays ?? [])],
      sessionsPerWeek: onboardingData.trainingDaysPerWeek ?? null,
      christmasBreak: onboardingData.teamTrainingStopsOverChristmas === undefined ? null : {
        stopsOverChristmas: onboardingData.teamTrainingStopsOverChristmas === true,
        lastTeamTraining: onboardingData.christmasLastTeamTrainingDate ?? null,
        returns: onboardingData.christmasTeamTrainingReturnDate ?? null,
      },
    };
  }, [onboardingData]);

  const fixturesAhead = useMemo(() => {
    const until = addDaysISO(asOfDateISO, FIXTURES_AHEAD_DAYS);
    return Object.entries(markedDays ?? {})
      .filter(([date, type]) => type === 'game' && date > asOfDateISO && date <= until)
      .map(([date]) => date)
      .sort();
  }, [markedDays, asOfDateISO]);

  const injuryEpisodes = useMemo(
    () => ((acceptedMaterialContext?.injuryEpisodes ?? []) as readonly CoachSnapshotInjuryEpisodeRecord[]),
    [acceptedMaterialContext],
  );

  const recentDecisions = useMemo(
    () => (decisions ?? []).map((entry) => ({
      occurredAt: entry.occurredAt,
      provenance: entry.provenance,
      decision: entry.decision as { readonly kind: string } & Readonly<Record<string, unknown>>,
    })),
    [decisions],
  );

  // R-397 / slice S5: who the athlete is, as they set it. Name and ids never.
  const athleteProfile = useMemo((): CoachSnapshotAthlete | null => {
    if (!onboardingData) return null;
    const answer = onboardingData.equipmentAnswer;
    const owned = (record: Readonly<Record<string, unknown>> | undefined): string[] => Object.entries(record ?? {})
      .filter(([, possession]) => possession === 'have')
      .map(([tag]) => tag);
    const equipment = answer
      ? [...owned(answer.tags as Readonly<Record<string, unknown>>), ...owned(answer.modalities as Readonly<Record<string, unknown>>)]
      : [...(onboardingData.equipment ?? [])];
    return {
      position: onboardingData.position ?? null,
      goals: [...(onboardingData.goals ?? [])],
      biggestLimitation: onboardingData.biggestLimitation ?? null,
      experienceLevel: onboardingData.experienceLevel ?? null,
      conditioningLevel: onboardingData.conditioningLevel ?? null,
      ageRange: onboardingData.ageRange ?? null,
      heightCm: onboardingData.heightCm ?? null,
      weightKg: onboardingData.weightKg ?? null,
      trainingLocation: onboardingData.trainingLocation ?? null,
      equipment,
      equipmentAnsweredOn: answer?.answeredOn ?? null,
      availabilityConstraints: (onboardingData.availabilityConstraints ?? [])
        .filter((constraint) => constraint.active !== false)
        .map((constraint) => ({
          kind: constraint.kind,
          scope: constraint.scope,
          dayOfWeek: constraint.dayOfWeek ?? null,
          startDate: constraint.startDate ?? null,
          endDate: constraint.endDate ?? null,
          maxSessionMinutes: constraint.maxSessionMinutes ?? null,
        })),
      exclusions: (prefs?.exclusions ?? []).map((exclusion) => ({
        exercise: exclusion.exercise,
        scope: exclusion.scope,
        since: exclusion.decidedOnISO,
      })),
      pinned: [...(prefs?.pinned ?? [])],
    };
  }, [onboardingData, prefs]);

  const readinessHistory = useMemo(
    () => Object.values(readinessSignalsByDate ?? {}),
    [readinessSignalsByDate],
  );

  return useMemo(() => deriveCoachSnapshot({
    asOfDateISO,
    weekDays: input.weekDays,
    visibleWeek: input.visibleWeek,
    recordedSessions: sessionFeedback ?? {},
    readinessSignal: readinessSignalsByDate[asOfDateISO] ?? null,
    activeModifiers: input.activeModifiers,
    experienceLevel: athlete.onboardingData?.experienceLevel,
    conditioningLevel: athlete.onboardingData?.conditioningLevel,
    twoKmTimeTrial: athlete.onboardingData?.twoKmTimeTrial,
    bodyWeightKg: athlete.onboardingData?.weightKg,
    trackedLiftChoices,
    isDeloadWeek,
    season,
    standing,
    fixturesAhead,
    nextWeek,
    readinessHistory,
    recentDecisions,
    injuryEpisodes,
    performanceTesting: onboardingData?.performanceTesting,
    athlete: athleteProfile,
  }), [
    asOfDateISO,
    input.weekDays,
    input.visibleWeek,
    input.activeModifiers,
    sessionFeedback,
    currentProgram,
    trackedLiftChoices,
    readinessSignalsByDate,
    athlete.onboardingData?.experienceLevel,
    athlete.onboardingData?.conditioningLevel,
    athlete.onboardingData?.twoKmTimeTrial,
    athlete.onboardingData?.weightKg,
    isDeloadWeek,
    season,
    standing,
    fixturesAhead,
    nextWeek,
    readinessHistory,
    recentDecisions,
    injuryEpisodes,
    onboardingData?.performanceTesting,
    athleteProfile,
  ]);
}
