/**
 * LIVE INPUT ADAPTER FOR THE COACH SNAPSHOT.
 *
 * Store reads stop here. The domain builder remains pure, and every output is
 * recomputed from the existing decisions/facts whenever one of them changes.
 * No Coach Snapshot is persisted.
 */

import { useMemo } from 'react';
import { useAthleteContext } from '../../hooks/useSchedule';
import { useProgramStore } from '../../store/programStore';
import { useReadinessStore } from '../../store/readinessStore';
import type { ActiveCoachNote } from '../../utils/activeCoachNotes';
import type { ResolvedDay } from '../../utils/sessionResolver';
import { todayISOLocal } from '../../utils/appDate';
import { countWeeklyExposures } from '../../rules/weeklyExposureCounts';
import {
  buildJournalWeek,
  type JournalSessionOutcome,
} from '../../rules/journalWeek';
import {
  buildJournalLoadModel,
  journalWeekStartOf,
  type JournalLoadSessionInput,
  type PlannedLift,
} from '../../rules/journalLoad';
import { buildJournalStrengthTrend } from '../../rules/journalStrengthTrend';
import { buildCoachSnapshot, type CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import type { VisibleWeek } from '../../rules/visibleProjection';

export interface UseLiveAthleteSnapshotInput {
  readonly weekDays: readonly ResolvedDay[];
  readonly visibleWeek: VisibleWeek;
  readonly activeModifiers: readonly ActiveCoachNote[];
}

function countRecordedWeeks(sessionFeedback: Readonly<Record<string, unknown>>): number {
  const weeks = new Set<string>();
  for (const dateISO of Object.keys(sessionFeedback)) {
    const weekStart = journalWeekStartOf(dateISO);
    if (weekStart) weeks.add(weekStart);
  }
  return weeks.size;
}

export function useLiveAthleteSnapshot(input: UseLiveAthleteSnapshotInput): CoachSnapshot {
  const sessionFeedback = useProgramStore((state) => state.sessionFeedback);
  const readinessSignalsByDate = useReadinessStore((state) => state.signalsByDate);
  const athlete = useAthleteContext();
  const asOfDateISO = todayISOLocal();

  const journalWeek = useMemo(() => {
    const exposures = countWeeklyExposures(
      input.weekDays.map((day) => ({ date: day.date, workout: day.workout })),
      {
        experienceLevel: athlete.onboardingData?.experienceLevel,
        conditioningLevel: athlete.onboardingData?.conditioningLevel,
      },
    );
    const outcomesByDate: Record<string, JournalSessionOutcome> = {};
    for (const day of input.visibleWeek.days) {
      const feedback = sessionFeedback?.[day.date];
      if (!feedback) continue;
      outcomesByDate[day.date] = {
        completion: feedback.completion,
        reason: feedback.skipReason ?? feedback.partialReason ?? null,
        feeling: feedback.feeling ?? null,
        soreness: feedback.soreness ?? null,
        gameFeel: feedback.game?.feel ?? feedback.gameFeel ?? null,
        expectation: feedback.expectation ?? null,
      };
    }
    return buildJournalWeek({
      weekStart: input.visibleWeek.weekStart,
      days: input.visibleWeek.days,
      exposures,
      outcomesByDate,
      weeksOfHistory: countRecordedWeeks(sessionFeedback ?? {}),
    });
  }, [
    input.weekDays,
    input.visibleWeek,
    sessionFeedback,
    athlete.onboardingData?.experienceLevel,
    athlete.onboardingData?.conditioningLevel,
  ]);

  const loadModel = useMemo(() => {
    const sessions: JournalLoadSessionInput[] = Object.entries(sessionFeedback ?? {})
      .map(([date, feedback]) => ({
        date,
        strength: feedback?.strength ?? [],
        conditioning: feedback?.conditioning ?? null,
        teamTraining: feedback?.teamTraining ?? null,
        game: feedback?.game ?? null,
        difficulty: feedback?.difficulty ?? null,
        actualMinutes: feedback?.actualMinutes ?? null,
      }));
    const plannedStrength: PlannedLift[] = input.weekDays.flatMap((day) =>
      (day.workout?.exercises ?? []).map((exercise) => ({
        exerciseName: exercise.exercise?.name ?? '',
        sets: Number(exercise.prescribedSets) || 0,
        repsMin: Number(exercise.prescribedRepsMin) || 0,
        repsMax: Number(exercise.prescribedRepsMax) || 0,
        weightKg: typeof exercise.prescribedWeightKg === 'number'
          ? exercise.prescribedWeightKg
          : null,
      })));
    return buildJournalLoadModel({
      weekStart: journalWeek.weekStart,
      sessions,
      sessionsPlannedThisWeek: journalWeek.work.sessionsPlanned,
      plannedStrength,
    });
  }, [input.weekDays, journalWeek, sessionFeedback]);

  const progress = useMemo(() => buildJournalStrengthTrend({
    weekStart: journalWeek.weekStart,
    sessions: Object.entries(sessionFeedback ?? {}).map(([date, feedback]) => ({
      date,
      strength: feedback?.strength ?? [],
    })),
  }), [journalWeek.weekStart, sessionFeedback]);

  return useMemo(() => buildCoachSnapshot({
    asOfDateISO,
    visibleWeek: input.visibleWeek,
    journalWeek,
    loadModel,
    strengthLifts: progress,
    readinessSignal: readinessSignalsByDate[asOfDateISO] ?? null,
    activeModifiers: input.activeModifiers,
  }), [
    asOfDateISO,
    input.visibleWeek,
    input.activeModifiers,
    journalWeek,
    loadModel,
    progress,
    readinessSignalsByDate,
  ]);
}
