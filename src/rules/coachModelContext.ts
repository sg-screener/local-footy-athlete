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
): CoachModelConversationContext {
  return {
    activeProgramTarget: context.activeProgramTarget,
    recentTurns: context.recentTurns
      .filter((turn) => turn.text.trim().length > 0)
      .slice(-MAX_RECENT_TURNS)
      .map((turn) => ({ speaker: turn.speaker, text: turn.text.trim() })),
  };
}

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
  const snapshot = args.snapshot;
  return {
    athleteMessage: args.athleteMessage,
    ...(args.reviewFocus ? { reviewFocus: args.reviewFocus } : {}),
    ...(typeof args.requiresLiveProgramFacts === 'boolean'
      ? { requiresLiveProgramFacts: args.requiresLiveProgramFacts }
      : {}),
    currentAthleteSnapshot: {
      asOfDateISO: snapshot.asOfDateISO,
      visibleWeek: {
        ...snapshot.visibleWeek,
        days: snapshot.visibleWeek.days.map((day) => ({
          ...day,
          timing: coachModelDayTiming(day.date, snapshot.asOfDateISO),
        })),
      },
      thisWeek: snapshot.thisWeek,
      readiness: {
        ...snapshot.readiness,
        interpretation: readinessInterpretation(snapshot),
      },
      load: snapshot.load,
      progress: snapshot.progress,
      restrictions: snapshot.restrictions,
    },
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
