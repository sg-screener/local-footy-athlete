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
import { todayISOLocal } from '../../utils/appDate';
import type { ResolvedDay } from '../../utils/sessionResolver';
import {
  deriveCoachSnapshot,
  type CoachSnapshot,
} from '../../rules/liveAthleteSnapshot';
import type { VisibleWeek } from '../../rules/visibleProjection';

export interface UseLiveAthleteSnapshotInput {
  readonly weekDays: readonly ResolvedDay[];
  readonly visibleWeek: VisibleWeek;
  readonly activeModifiers: readonly ActiveCoachNote[];
}

export function useLiveAthleteSnapshot(input: UseLiveAthleteSnapshotInput): CoachSnapshot {
  const sessionFeedback = useProgramStore((state) => state.sessionFeedback);
  const readinessSignalsByDate = useReadinessStore((state) => state.signalsByDate);
  const athlete = useAthleteContext();
  const asOfDateISO = todayISOLocal();

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
  }), [
    asOfDateISO,
    input.weekDays,
    input.visibleWeek,
    input.activeModifiers,
    sessionFeedback,
    readinessSignalsByDate,
    athlete.onboardingData?.experienceLevel,
    athlete.onboardingData?.conditioningLevel,
    athlete.onboardingData?.twoKmTimeTrial,
    athlete.onboardingData?.weightKg,
  ]);
}
