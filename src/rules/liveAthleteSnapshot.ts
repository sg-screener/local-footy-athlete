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
import type {
  AgeRange,
  ConditioningLevel,
  DayOfWeek,
  ExperienceLevel,
  MotivationGoal,
  PerformanceTesting,
  Position,
  SeasonPhase,
  TrainingLocation,
  WeekKind,
} from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { deriveMasFromPerformanceTesting } from '../data/performanceTests';
import type { DerivedMas } from '../data/twoKmTimeTrial';

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

/**
 * WHERE THE ATHLETE IS IN THE YEAR (R-397, plan slice S1, 2026-09-10).
 *
 * The coach used to guess the phase from day kinds ("you've got a game, so
 * in-season"). The app owns the phase (`ownSeasonPhase`) and the block clock
 * (`getStoredBlockStateForDate`); this block carries their answer, and `null`
 * means the app could not say — the model is told "unknown", never left to
 * infer. READER: `projectCoachSnapshotForModel`, the retrieval query and the
 * `phaseClaimGrounded` gate. TEST: `coachSnapshotTests` §5.
 */
export interface CoachSnapshotSeason {
  readonly phase: SeasonPhase;
  readonly subphase: string | null;
  readonly phaseWeekNumber: number | null;
  readonly weekKind: WeekKind | null;
  readonly blockNumber: number | null;
  readonly weekInBlock: number | null;
  readonly isDeloadWeek: boolean;
}

/** The standing weekly pattern the program is built around. */
export interface CoachSnapshotStanding {
  readonly usualGameDay: DayOfWeek | null;
  readonly clubNights: readonly DayOfWeek[];
  readonly gymDays: readonly DayOfWeek[];
  readonly sessionsPerWeek: number | null;
  readonly christmasBreak: {
    readonly stopsOverChristmas: boolean;
    readonly lastTeamTraining: string | null;
    readonly returns: string | null;
  } | null;
}

export interface CoachSnapshotSituation {
  readonly season: CoachSnapshotSeason | null;
  readonly standing: CoachSnapshotStanding | null;
  /** Game dates after the as-of date, four weeks out, from the calendar owner. */
  readonly fixturesAhead: readonly string[];
  /** The week after `visibleWeek`, through the same projection, or null when none exists. */
  readonly nextWeek: VisibleWeek | null;
}

export interface CoachSnapshotSessionOutcome {
  readonly date: string;
  readonly completion: JournalSessionOutcome['completion'];
  readonly reason: JournalSessionOutcome['reason'];
  readonly feeling: JournalSessionOutcome['feeling'];
  readonly components: readonly {
    readonly label: string;
    readonly kind: string;
    readonly completion: string;
  }[];
}

/**
 * One ledger entry, verbatim in kind and provenance, with its primitive
 * fields flattened one level. Ids never cross (they are internal); a key
 * literally named `name` never crosses (the server refuses it).
 */
export interface CoachSnapshotRecentChange {
  readonly occurredAt: string;
  readonly kind: string;
  readonly provenance: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface CoachSnapshotInjury {
  readonly bodyPart: string;
  readonly region: string | null;
  readonly severity: number;
  readonly status: string;
  readonly since: string;
  readonly triggers: readonly string[];
  readonly seriousSymptoms: boolean;
}

/** Fourteen days of what the athlete recorded; derived from the owners, stored nowhere. */
export interface CoachSnapshotHistory {
  readonly readiness: readonly ReadinessSignal[];
  readonly sessionOutcomes: readonly CoachSnapshotSessionOutcome[];
  readonly recentChanges: readonly CoachSnapshotRecentChange[];
}

/**
 * WHO THE ATHLETE IS (R-397, Sam 2026-09-10: "yes full profile"; plan slice
 * S5). The standing facts the program is built from, as the athlete set
 * them. Never the name, never an id: those are the Privacy screen's
 * exclusions and the server refuses a payload carrying them. Height and
 * weight travel as numbers because Sam granted the full profile; the Privacy
 * sentence is rewritten in the same slice to say exactly this.
 */
export interface CoachSnapshotAthlete {
  readonly position: Position | null;
  readonly goals: readonly MotivationGoal[];
  readonly biggestLimitation: string | null;
  readonly experienceLevel: ExperienceLevel | null;
  readonly conditioningLevel: ConditioningLevel | null;
  readonly ageRange: AgeRange | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly trainingLocation: TrainingLocation | null;
  /** Equipment tags and conditioning machines the athlete said they have. */
  readonly equipment: readonly string[];
  readonly equipmentAnsweredOn: string | null;
  readonly availabilityConstraints: readonly {
    readonly kind: string;
    readonly scope: string;
    readonly dayOfWeek: DayOfWeek | null;
    readonly startDate: string | null;
    readonly endDate: string | null;
    readonly maxSessionMinutes: number | null;
  }[];
  /** Exercises the athlete has excluded, with the scope they chose. */
  readonly exclusions: readonly { readonly exercise: string; readonly scope: string; readonly since: string }[];
  readonly pinned: readonly string[];
}

export const COACH_SNAPSHOT_HISTORY_DAYS = 14;

export const EMPTY_COACH_SNAPSHOT_SITUATION: CoachSnapshotSituation = {
  season: null,
  standing: null,
  fixturesAhead: [],
  nextWeek: null,
};

export const EMPTY_COACH_SNAPSHOT_HISTORY: CoachSnapshotHistory = {
  readiness: [],
  sessionOutcomes: [],
  recentChanges: [],
};

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
  readonly situation: CoachSnapshotSituation;
  readonly history: CoachSnapshotHistory;
  /** Who the athlete is; null when no profile exists yet. */
  readonly athlete: CoachSnapshotAthlete | null;
  /** Active or improving injury episodes, in the athlete's own facts (body part, since, triggers). */
  readonly injuries: readonly CoachSnapshotInjury[];
  readonly mas: DerivedMas | null;
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
  readonly situation?: CoachSnapshotSituation;
  readonly history?: CoachSnapshotHistory;
  readonly injuries?: readonly CoachSnapshotInjury[];
  readonly mas?: DerivedMas | null;
  readonly athlete?: CoachSnapshotAthlete | null;
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
  readonly gameFeel?: JournalSessionOutcome['gameFeel'];
  readonly expectation?: JournalSessionOutcome['expectation'];
  readonly strength?: JournalLoadSessionInput['strength'];
  readonly conditioning?: JournalLoadSessionInput['conditioning'];
  readonly teamTraining?: JournalLoadSessionInput['teamTraining'];
  readonly game?: JournalLoadSessionInput['game'];
  readonly difficulty?: JournalLoadSessionInput['difficulty'];
  readonly actualMinutes?: JournalLoadSessionInput['actualMinutes'];
  readonly components?: readonly {
    readonly label: string;
    readonly kind: string;
    readonly completion: string;
  }[];
}

/** A decision-ledger entry as the adapter hands it over: kind and provenance verbatim. */
export interface CoachSnapshotDecisionRecord {
  readonly occurredAt: string;
  readonly provenance: string;
  readonly decision: { readonly kind: string } & Readonly<Record<string, unknown>>;
}

/** An injury episode as the accepted program context holds it. */
export interface CoachSnapshotInjuryEpisodeRecord {
  readonly bodyPart: string;
  readonly region?: string | null;
  readonly severity: number;
  readonly status: string;
  readonly onsetOrReportedDate: string;
  readonly triggers: readonly string[];
  readonly seriousSymptoms: boolean;
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
  readonly season?: CoachSnapshotSeason | null;
  readonly standing?: CoachSnapshotStanding | null;
  readonly fixturesAhead?: readonly string[];
  readonly nextWeek?: VisibleWeek | null;
  readonly readinessHistory?: readonly ReadinessSignal[];
  readonly recentDecisions?: readonly CoachSnapshotDecisionRecord[];
  readonly injuryEpisodes?: readonly CoachSnapshotInjuryEpisodeRecord[];
  readonly performanceTesting?: PerformanceTesting;
  readonly athlete?: CoachSnapshotAthlete | null;
}

const RECENT_CHANGE_LIMIT = 20;
const RECENT_CHANGE_DETAIL_LIMIT = 12;

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function detailKeyAllowed(key: string): boolean {
  return key !== 'kind' && key !== 'name' && !/id$/i.test(key) && !/Ids$/.test(key);
}

/** Primitive fields one level deep; ids and `name` keys never cross the boundary. */
export function projectRecentChange(record: CoachSnapshotDecisionRecord): CoachSnapshotRecentChange {
  const details: Record<string, string | number | boolean> = {};
  let count = 0;
  const put = (key: string, value: unknown): void => {
    if (count >= RECENT_CHANGE_DETAIL_LIMIT || !detailKeyAllowed(key)) return;
    if (isPrimitive(value)) {
      details[key] = value;
      count += 1;
    }
  };
  for (const [key, value] of Object.entries(record.decision)) {
    if (isPrimitive(value)) {
      put(key, value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        put(`${key}.${subKey}`, subValue);
      }
    } else if (Array.isArray(value) && value.every(isPrimitive)) {
      put(key, value.join(', '));
    }
  }
  return {
    occurredAt: record.occurredAt,
    kind: record.decision.kind,
    provenance: record.provenance,
    details,
  };
}

function withinHistoryWindow(dateISO: string, asOfDateISO: string): boolean {
  const since = addDaysISO(asOfDateISO, -(COACH_SNAPSHOT_HISTORY_DAYS - 1));
  const date = dateISO.slice(0, 10);
  return date >= since && date <= asOfDateISO;
}

function deriveHistory(input: DeriveCoachSnapshotInput): CoachSnapshotHistory {
  const readiness = [...(input.readinessHistory ?? [])]
    .filter((signal) => withinHistoryWindow(signal.date, input.asOfDateISO))
    .sort((left, right) => left.date.localeCompare(right.date));
  const sessionOutcomes = Object.entries(input.recordedSessions)
    .filter(([date]) => withinHistoryWindow(date, input.asOfDateISO))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, feedback]) => ({
      date,
      completion: feedback.completion,
      reason: feedback.skipReason ?? feedback.partialReason ?? null,
      feeling: feedback.feeling ?? null,
      components: (feedback.components ?? []).map((component) => ({
        label: component.label,
        kind: component.kind,
        completion: component.completion,
      })),
    }));
  const recentChanges = [...(input.recentDecisions ?? [])]
    .filter((record) => withinHistoryWindow(record.occurredAt, input.asOfDateISO))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, RECENT_CHANGE_LIMIT)
    .map(projectRecentChange);
  return { readiness, sessionOutcomes, recentChanges };
}

function deriveInjuries(
  episodes: readonly CoachSnapshotInjuryEpisodeRecord[] | undefined,
): readonly CoachSnapshotInjury[] {
  return (episodes ?? [])
    .filter((episode) => episode.status === 'active' || episode.status === 'improving')
    .map((episode) => ({
      bodyPart: episode.bodyPart,
      region: episode.region ?? null,
      severity: episode.severity,
      status: episode.status,
      since: episode.onsetOrReportedDate,
      triggers: [...episode.triggers],
      seriousSymptoms: episode.seriousSymptoms,
    }));
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
      // Historical Journal schema only; no current soreness observation.
      soreness: null,
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
    situation: {
      season: input.season ?? null,
      standing: input.standing ?? null,
      fixturesAhead: [...(input.fixturesAhead ?? [])]
        .map((date) => date.slice(0, 10))
        .filter((date) => date > input.asOfDateISO)
        .sort(),
      nextWeek: input.nextWeek ?? null,
    },
    history: deriveHistory(input),
    athlete: input.athlete ?? null,
    injuries: deriveInjuries(input.injuryEpisodes),
    mas: input.experienceLevel
      ? deriveMasFromPerformanceTesting(
        input.performanceTesting,
        input.twoKmTimeTrial ?? undefined,
        input.experienceLevel,
      )
      : null,
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
  const situation = input.situation ?? EMPTY_COACH_SNAPSHOT_SITUATION;
  if (situation.nextWeek && situation.nextWeek.weekStart !== addDaysISO(weekStart, 7)) {
    throw new Error('Coach Snapshot next week must be the week after the visible week.');
  }
  if (situation.season && situation.season.isDeloadWeek !== (input.isDeloadWeek === true)) {
    throw new Error('Coach Snapshot season and load must agree about the deload week.');
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
    situation,
    history: input.history ?? EMPTY_COACH_SNAPSHOT_HISTORY,
    athlete: input.athlete ?? null,
    injuries: [...(input.injuries ?? [])],
    mas: input.mas ?? null,
  };
}
