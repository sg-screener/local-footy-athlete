/**
 * ONE LIVE PICTURE OF THE ATHLETE FOR EVERY COACH SURFACE.
 *
 * The dashboard and conversation receive this value. It is derived from the
 * visible week and the existing Journal/readiness/modifier owners, never saved
 * and never allowed to invent a second account of any of them.
 */

import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { OnboardingData } from '../types/domain';
import {
  getReadinessQuickOption,
  type ReadinessQuickOption,
  type ReadinessSignal,
} from '../utils/readiness';
import type { VisibleWeek } from './visibleProjection';
import {
  buildJournalWeek,
  type JournalSessionOutcome,
  type JournalWeek,
} from './journalWeek';
import {
  buildJournalLoadModel,
  journalWeekStartOf,
  signedValue,
  type JournalLoadSessionInput,
  type JournalLoadCoverage,
  type JournalLoadHeadline,
  type JournalLoadModel,
  type PlannedLift,
} from './journalLoad';
import {
  buildJournalStrengthSeries,
  buildJournalStrengthTrend,
  type StrengthTopSet,
  type StrengthLiftTrend,
} from './journalStrengthTrend';
import { countWeeklyExposures } from './weeklyExposureCounts';
import type { TwoKmTimeTrialAnswer } from '../types/domain';
import {
  buildProgressMainLiftHistories,
  type ProgressMainLiftHistory,
} from './progressMainLiftStrength';

export type CoachSnapshotReadinessState =
  | ReadinessQuickOption
  | 'recorded'
  | 'not_recorded';

export interface CoachSnapshotReadiness {
  readonly state: CoachSnapshotReadinessState;
  readonly signal: ReadinessSignal | null;
}

export interface CoachSnapshotLoad {
  readonly headline: JournalLoadHeadline | null;
  readonly sweetSpotBand: { readonly low: number; readonly high: number } | null;
  readonly coverage: JournalLoadCoverage | null;
  readonly weeklyCompletedLoadAU: readonly {
    readonly weekStart: string;
    readonly value: number;
  }[];
  readonly isDeloadWeek: boolean;
}

export interface StrengthProgressPoint {
  readonly weekStart: string;
  readonly topSet: StrengthTopSet;
}

export interface StrengthProgressHistory {
  readonly exerciseName: string;
  readonly points: readonly StrengthProgressPoint[];
}

export interface CoachSnapshot {
  /** The date whose readiness answer this picture carries. */
  readonly asOfDateISO: string;
  /** The one projection every Coach reader uses. */
  readonly visibleWeek: VisibleWeek;
  /** Existing Journal week facts, derived over that exact projection. */
  readonly thisWeek: JournalWeek;
  readonly readiness: CoachSnapshotReadiness;
  readonly load: CoachSnapshotLoad;
  readonly progress: readonly StrengthLiftTrend[];
  /** Every recorded main-lift top set, grouped by lift for the Progress chart. */
  readonly strengthHistory: readonly StrengthProgressHistory[];
  /** The four fixed Progress graphs, including honest empty histories. */
  readonly mainLiftEstimates: readonly ProgressMainLiftHistory[];
  /** The one recorded 2km answer. An array would falsely imply stored history. */
  readonly twoKmTimeTrial: TwoKmTimeTrialAnswer | null;
  readonly restrictions: readonly ActiveCoachNote[];
}

export interface BuildCoachSnapshotInput {
  readonly asOfDateISO: string;
  readonly visibleWeek: VisibleWeek;
  readonly journalWeek: JournalWeek;
  readonly loadModel: JournalLoadModel;
  readonly strengthLifts: readonly StrengthLiftTrend[];
  readonly strengthHistory: readonly StrengthProgressHistory[];
  readonly mainLiftEstimates?: readonly ProgressMainLiftHistory[];
  readonly twoKmTimeTrial: TwoKmTimeTrialAnswer | null;
  readonly readinessSignal: ReadinessSignal | null;
  readonly activeModifiers: readonly ActiveCoachNote[];
  readonly isDeloadWeek?: boolean;
}

/**
 * The persisted facts this derivation is allowed to read, expressed in the
 * existing Journal owners' types rather than as a second SessionFeedback type.
 */
export interface CoachSnapshotRecordedSession {
  readonly completion: JournalSessionOutcome['completion'];
  readonly skipReason?: JournalSessionOutcome['reason'];
  readonly partialReason?: JournalSessionOutcome['reason'];
  readonly feeling?: JournalSessionOutcome['feeling'];
  readonly soreness?: JournalSessionOutcome['soreness'];
  readonly gameFeel?: JournalSessionOutcome['gameFeel'];
  readonly expectation?: JournalSessionOutcome['expectation'];
  readonly strength?: JournalLoadSessionInput['strength'];
  readonly conditioning?: JournalLoadSessionInput['conditioning'];
  readonly teamTraining?: JournalLoadSessionInput['teamTraining'];
  readonly game?: JournalLoadSessionInput['game'];
  readonly difficulty?: JournalLoadSessionInput['difficulty'];
  readonly actualMinutes?: JournalLoadSessionInput['actualMinutes'];
}

export interface DeriveCoachSnapshotInput {
  readonly asOfDateISO: string;
  readonly weekDays: readonly ResolvedDay[];
  readonly visibleWeek: VisibleWeek;
  readonly activeModifiers: readonly ActiveCoachNote[];
  readonly recordedSessions: Readonly<Record<string, CoachSnapshotRecordedSession>>;
  readonly readinessSignal: ReadinessSignal | null;
  readonly experienceLevel?: OnboardingData['experienceLevel'];
  readonly conditioningLevel?: OnboardingData['conditioningLevel'];
  readonly twoKmTimeTrial?: OnboardingData['twoKmTimeTrial'];
  readonly bodyWeightKg?: OnboardingData['weightKg'];
  readonly trackedLiftChoices?: import('./estimatedOneRepMax').TrackedLiftChoices;
  readonly isDeloadWeek?: boolean;
}

function countRecordedWeeks(
  recordedSessions: Readonly<Record<string, CoachSnapshotRecordedSession>>,
): number {
  const weeks = new Set<string>();
  for (const dateISO of Object.keys(recordedSessions)) {
    const weekStart = journalWeekStartOf(dateISO);
    if (weekStart) weeks.add(weekStart);
  }
  return weeks.size;
}

/**
 * Derive the complete live picture from explicit current facts. Store and
 * React ownership stop outside this function, so the athlete walker can prove
 * the same calculation the mounted Coach reads without manufacturing a store.
 */
export function deriveCoachSnapshot(input: DeriveCoachSnapshotInput): CoachSnapshot {
  const exposures = countWeeklyExposures(
    input.weekDays.map((day) => ({ date: day.date, workout: day.workout })),
    {
      experienceLevel: input.experienceLevel,
      conditioningLevel: input.conditioningLevel,
    },
  );
  const outcomesByDate: Record<string, JournalSessionOutcome> = {};
  for (const day of input.visibleWeek.days) {
    const feedback = input.recordedSessions[day.date];
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
  const journalWeek = buildJournalWeek({
    weekStart: input.visibleWeek.weekStart,
    days: input.visibleWeek.days,
    exposures,
    outcomesByDate,
    weeksOfHistory: countRecordedWeeks(input.recordedSessions),
  });

  const sessions: JournalLoadSessionInput[] = Object.entries(input.recordedSessions)
    .map(([date, feedback]) => ({
      date,
      strength: feedback.strength ?? [],
      conditioning: feedback.conditioning ?? null,
      teamTraining: feedback.teamTraining ?? null,
      game: feedback.game ?? null,
      difficulty: feedback.difficulty ?? null,
      actualMinutes: feedback.actualMinutes ?? null,
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
  const loadModel = buildJournalLoadModel({
    weekStart: journalWeek.weekStart,
    sessions,
    sessionsPlannedThisWeek: journalWeek.work.sessionsPlanned,
    plannedStrength,
  });
  const strengthSessions = Object.entries(input.recordedSessions).map(([date, feedback]) => ({
    date,
    strength: feedback.strength ?? [],
  }));
  const progress = buildJournalStrengthTrend({
    weekStart: journalWeek.weekStart,
    sessions: strengthSessions,
  });
  const strengthSeries = buildJournalStrengthSeries({
    weekStart: journalWeek.weekStart,
    sessions: strengthSessions,
  });
  const strengthHistory = Array.from(strengthSeries.entries())
    .map(([exerciseName, points]) => ({ exerciseName, points }))
    .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName));
  const mainLiftEstimates = buildProgressMainLiftHistories({
    weekStart: journalWeek.weekStart,
    sessions: strengthSessions,
    bodyWeightKg: input.bodyWeightKg,
    choices: input.trackedLiftChoices,
  });

  return buildCoachSnapshot({
    asOfDateISO: input.asOfDateISO,
    visibleWeek: input.visibleWeek,
    journalWeek,
    loadModel,
    strengthLifts: progress,
    strengthHistory,
    mainLiftEstimates,
    twoKmTimeTrial: input.twoKmTimeTrial ?? null,
    readinessSignal: input.readinessSignal,
    activeModifiers: input.activeModifiers,
    isDeloadWeek: input.isDeloadWeek,
  });
}

function readinessState(
  signal: ReadinessSignal | null,
): CoachSnapshotReadinessState {
  if (!signal) return 'not_recorded';
  return getReadinessQuickOption(signal) ?? 'recorded';
}

/**
 * Build the ephemeral picture. Week mismatches refuse instead of presenting
 * three individually-correct derivations as though they described one week.
 */
export function buildCoachSnapshot(input: BuildCoachSnapshotInput): CoachSnapshot {
  const weekStart = input.visibleWeek.weekStart;
  if (input.journalWeek.weekStart !== weekStart || input.loadModel.weekStart !== weekStart) {
    throw new Error('Coach Snapshot inputs must describe the same visible week.');
  }
  if (input.readinessSignal && input.readinessSignal.date !== input.asOfDateISO) {
    throw new Error('Coach Snapshot readiness must describe its as-of date.');
  }

  const model = input.loadModel;
  const weeklyCompletedLoadAU = [...(model.history ?? [])]
    .reverse()
    .concat(model.thisWeek ? [model.thisWeek] : [])
    .filter((week) => week.sessionsMeasured > 0)
    .map((week) => ({ weekStart: week.weekStart, value: week.completedLoadAU }));

  return {
    asOfDateISO: input.asOfDateISO,
    visibleWeek: input.visibleWeek,
    thisWeek: input.journalWeek,
    readiness: {
      state: readinessState(input.readinessSignal),
      signal: input.readinessSignal,
    },
    load: {
      headline: signedValue(model.headline),
      sweetSpotBand: signedValue(model.sweetSpotBand),
      coverage: signedValue(model.coverage),
      weeklyCompletedLoadAU,
      isDeloadWeek: input.isDeloadWeek === true,
    },
    progress: [...input.strengthLifts],
    strengthHistory: input.strengthHistory.map((history) => ({
      exerciseName: history.exerciseName,
      points: [...history.points],
    })),
    mainLiftEstimates: (input.mainLiftEstimates ?? buildProgressMainLiftHistories({
      weekStart,
      sessions: [],
    })).map((history) => ({
      ...history,
      points: [...history.points],
    })),
    twoKmTimeTrial: input.twoKmTimeTrial,
    restrictions: [...input.activeModifiers],
  };
}
