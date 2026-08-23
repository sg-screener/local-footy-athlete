import type { CoachSnapshot } from './liveAthleteSnapshot';

export type CoachModelSpeaker = 'coach' | 'athlete';

export interface CoachModelConversationTurn {
  readonly speaker: CoachModelSpeaker;
  readonly text: string;
}

export interface CoachModelProgramTarget {
  readonly kind: 'day' | 'session' | 'exercise';
  readonly dateISO: string | null;
  readonly partId: string | null;
  readonly label: string;
}

export interface CoachModelConversationContext {
  readonly recentTurns: readonly CoachModelConversationTurn[];
  readonly activeProgramTarget: CoachModelProgramTarget | null;
}

export interface CoachModelConversationProjection {
  readonly recentTurns: readonly CoachModelConversationTurn[];
  readonly activeProgramTarget: null | {
    readonly kind: CoachModelProgramTarget['kind'];
    readonly dateISO: string | null;
    readonly label: string;
  };
}

export const EMPTY_COACH_MODEL_CONVERSATION: CoachModelConversationContext = {
  recentTurns: [],
  activeProgramTarget: null,
};

export type CoachModelDayRelation = 'past' | 'today' | 'future';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECENT_TURNS = 6;

function dateValue(dateISO: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.slice(0, 10));
  if (!match) throw new Error(`Coach model context received an invalid date: ${dateISO}`);
  const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== dateISO.slice(0, 10)) {
    throw new Error(`Coach model context received an invalid date: ${dateISO}`);
  }
  return value;
}

export function coachModelDayTiming(dateISO: string, asOfDateISO: string): {
  readonly relationToAsOf: CoachModelDayRelation;
  readonly dayOffset: number;
} {
  const dayOffset = Math.round((dateValue(dateISO) - dateValue(asOfDateISO)) / DAY_MS);
  return {
    relationToAsOf: dayOffset < 0 ? 'past' : dayOffset > 0 ? 'future' : 'today',
    dayOffset,
  };
}

function readinessInterpretation(snapshot: CoachSnapshot) {
  const signal = snapshot.readiness.signal;
  const factKind = !signal
    ? 'none'
    : signal.source === 'quick_check'
      ? 'quick_check'
      : signal.source === 'session_feedback'
        ? 'session_feedback'
        : 'declared_status';
  const separateStatusDeclarationRecorded = signal?.source === 'coach_message'
    && (signal.temporarySourceFactIds?.length ?? 0) > 0;
  return {
    factKind,
    scope: !signal ? 'none' : separateStatusDeclarationRecorded ? 'active_status' : 'today',
    separateStatusDeclarationRecorded,
    visibleProgramResponse: snapshot.restrictions.length > 0
      ? 'active_modifiers_present'
      : 'no_active_modifier_visible',
  } as const;
}

function boundedConversation(
  context: CoachModelConversationContext,
): CoachModelConversationProjection {
  return {
    activeProgramTarget: context.activeProgramTarget ? {
      kind: context.activeProgramTarget.kind,
      dateISO: context.activeProgramTarget.dateISO,
      label: context.activeProgramTarget.label,
    } : null,
    recentTurns: context.recentTurns
      .filter((turn) => turn.text.trim().length > 0)
      .slice(-MAX_RECENT_TURNS)
      .map((turn) => ({ speaker: turn.speaker, text: turn.text.trim() })),
  };
}

function modelReadiness(snapshot: CoachSnapshot) {
  const signal = snapshot.readiness.signal;
  return {
    state: snapshot.readiness.state,
    signal: signal ? {
      date: signal.date,
      bodyPart: signal.bodyPart,
      energy: signal.energy,
      soreness: signal.soreness,
      painFlag: signal.painFlag,
      timeAvailableMinutes: signal.timeAvailableMinutes,
      flatToday: signal.flatToday,
      poorSleepPattern: signal.poorSleepPattern,
    } : null,
    interpretation: readinessInterpretation(snapshot),
  } as const;
}

function modelProgress(snapshot: CoachSnapshot) {
  return {
    weeklyLiftTrends: snapshot.progress.map((lift) => ({
      exerciseName: lift.exerciseName,
      thisWeek: {
        weightKg: lift.thisWeek.weightKg,
        reps: lift.thisWeek.reps,
      },
      lastWeek: lift.lastWeek ? {
        weightKg: lift.lastWeek.weightKg,
        reps: lift.lastWeek.reps,
      } : null,
      direction: lift.direction,
    })),
    mainLiftHistory: snapshot.strengthHistory.flatMap((history) => {
      const first = history.points[0];
      const latest = history.points[history.points.length - 1];
      if (!first || !latest) return [];
      return [{
        exerciseName: history.exerciseName,
        recordedWeeks: history.points.length,
        firstRecorded: {
          weekStart: first.weekStart,
          weightKg: first.topSet.weightKg,
          reps: first.topSet.reps,
        },
        latestRecorded: {
          weekStart: latest.weekStart,
          weightKg: latest.topSet.weightKg,
          reps: latest.topSet.reps,
        },
      }];
    }),
    twoKmTimeTrial: snapshot.twoKmTimeTrial?.seconds != null
      ? {
        seconds: snapshot.twoKmTimeTrial.seconds,
        recordedOn: snapshot.twoKmTimeTrial.recordedOn,
      }
      : null,
  } as const;
}

/**
 * The positive AI-boundary projection. Internal Snapshot fields are absent by
 * construction; only athlete-visible program content and concise coaching
 * summaries are selected.
 */
export function projectCoachSnapshotForModel(snapshot: CoachSnapshot) {
  return {
    asOfDateISO: snapshot.asOfDateISO,
    visibleWeek: {
      weekStart: snapshot.visibleWeek.weekStart,
      days: snapshot.visibleWeek.days.map((day) => ({
        date: day.date,
        kind: day.kind,
        headline: day.headline,
        timing: coachModelDayTiming(day.date, snapshot.asOfDateISO),
        parts: day.parts.map((part) => ({
          kind: part.kind,
          headline: part.headline,
          detail: part.detail,
          rows: part.rows.map((row) => ({
            exercise: row.name,
            prescription: row.prescription,
            dose: [...row.dose],
            cue: row.cue,
          })),
        })),
        gaps: [...day.gaps],
      })),
      explanations: [...snapshot.visibleWeek.explanations],
    },
    thisWeek: {
      weekStart: snapshot.thisWeek.weekStart,
      work: {
        sessionsPlanned: snapshot.thisWeek.work.sessionsPlanned,
        completedFull: snapshot.thisWeek.work.completedFull,
        completedPartial: snapshot.thisWeek.work.completedPartial,
        skipped: snapshot.thisWeek.work.skipped,
        notAnswered: snapshot.thisWeek.work.notAnswered,
      },
      felt: {
        feelingsRecorded: snapshot.thisWeek.felt.feelingsRecorded,
        sorenessRecorded: snapshot.thisWeek.felt.sorenessRecorded,
        gameFeelsRecorded: snapshot.thisWeek.felt.gameFeelsRecorded,
        gameFeelLatest: snapshot.thisWeek.felt.gameFeelLatest,
        differedFromPlan: snapshot.thisWeek.felt.differedFromPlan,
        nothingRecorded: snapshot.thisWeek.felt.nothingRecorded,
      },
      kinds: {
        strength: snapshot.thisWeek.kinds.strength,
        conditioning: snapshot.thisWeek.kinds.conditioning,
        sprint: snapshot.thisWeek.kinds.sprint,
        teamTraining: snapshot.thisWeek.kinds.teamTraining,
        games: snapshot.thisWeek.kinds.games,
        recovery: snapshot.thisWeek.kinds.recovery,
      },
      dataState: snapshot.thisWeek.dataState,
    },
    readiness: modelReadiness(snapshot),
    load: {
      headline: snapshot.load.headline ? {
        ratio: snapshot.load.headline.ratio,
        band: snapshot.load.headline.band,
      } : null,
      sweetSpotBand: snapshot.load.sweetSpotBand ? {
        low: snapshot.load.sweetSpotBand.low,
        high: snapshot.load.sweetSpotBand.high,
      } : null,
      coverage: snapshot.load.coverage ? {
        sessionsMeasured: snapshot.load.coverage.sessionsMeasured,
        sessionsPlanned: snapshot.load.coverage.sessionsPlanned,
        liftsUnmeasured: snapshot.load.coverage.liftsUnmeasured,
      } : null,
    },
    progress: modelProgress(snapshot),
    restrictions: snapshot.restrictions.map((restriction) => ({
      type: restriction.type,
      effect: restriction.effect,
      title: restriction.title,
      body: restriction.body,
      severity: restriction.severity,
      excludedExercise: restriction.excludedExercise,
    })),
  } as const;
}

export type CoachModelSnapshot = ReturnType<typeof projectCoachSnapshotForModel>;

/**
 * One model-facing reading of the live Snapshot.
 *
 * The model does not receive bare dates, an unowned deictic reference, or a
 * readiness value whose source has to be guessed. These are meanings the app
 * already knows and can derive exactly, so asking a language model to infer
 * them would create a second owner for time, conversational target and status.
 */
export function buildCoachModelInput(args: {
  readonly athleteMessage: string;
  readonly snapshot: CoachSnapshot;
  readonly conversationContext?: CoachModelConversationContext;
  readonly reviewFocus?: readonly string[];
  readonly requiresLiveProgramFacts?: boolean;
}) {
  return {
    athleteMessage: args.athleteMessage,
    ...(args.reviewFocus ? { reviewFocus: args.reviewFocus } : {}),
    ...(typeof args.requiresLiveProgramFacts === 'boolean'
      ? { requiresLiveProgramFacts: args.requiresLiveProgramFacts }
      : {}),
    currentAthleteSnapshot: projectCoachSnapshotForModel(args.snapshot),
    conversationContext: boundedConversation(
      args.conversationContext ?? EMPTY_COACH_MODEL_CONVERSATION,
    ),
  } as const;
}

/** Only the shared, derived Coach model input crosses the AI boundary. */
export function serializeCoachModelInput(
  args: Parameters<typeof buildCoachModelInput>[0],
): string {
  return JSON.stringify(buildCoachModelInput(args));
}
