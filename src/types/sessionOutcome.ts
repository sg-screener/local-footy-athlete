import { isEffortRating } from '../rules/effortScale';
import type { ConditioningPerformanceLog } from '../utils/conditioningLogging';
import type { SessionComponentKind } from '../utils/sessionComponents';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';

export const FEEDBACK_FEELINGS = ['very_easy', 'easy', 'good', 'hard', 'very_hard'] as const;
export const FEEDBACK_COMPLETIONS = ['full', 'partial', 'skipped'] as const;
export const FEEDBACK_SORENESS_LEVELS = ['none', 'mild', 'moderate', 'high'] as const;
export const FEEDBACK_PARTIAL_REASONS = [
  'ran_out_of_time',
  'felt_sore_tight',
  'too_hard_today',
  'equipment_unavailable',
  'other',
] as const;
export const FEEDBACK_SKIP_REASONS = [
  'busy_no_time',
  'sore_tight',
  'injured_niggle',
  'sick_low_energy',
  'didnt_feel_like_it',
  'equipment_unavailable',
  'other',
] as const;

/**
 * THE POST-GAME BODY-FEEL RATING — the design's "linchpin", 1-5, one tap.
 *
 * "How were your legs / energy?" (docs/JOURNAL_DESIGN_2026-07-23.md). It is a
 * PHYSICAL reading of the athlete's body at the game, and it is deliberately not
 * a performance rating: how well they played is not a training input.
 *
 * ASKED ONLY ON A GAME, so it is stored only on a game — the same law the team
 * night answer follows. The app must not hold an answer to a question it did not
 * put on the screen.
 */
export const FEEDBACK_GAME_FEELS = [1, 2, 3, 4, 5] as const;

/**
 * THE "SESSION FELT DIFFERENT" TAP — addendum item 8, one tap after a session.
 *
 * THIS IS NOT `FeedbackFeeling`, AND CONFLATING THEM WOULD CORRUPT DATA RATHER
 * THAN MERELY ADD A BUG. `feeling` answers *how hard was it* (`very_easy` …
 * `very_hard`). This answers *did it match the prescription*. An athlete can
 * have a `very_hard` session that was exactly as expected — the two are
 * independent, and one field holding both would be the two-owners-of-one-fact
 * defect the north star names.
 *
 * It is also what carries EFFORT ON A STRENGTH SESSION. `difficulty` is written
 * from the conditioning RPE input alone, so a strength session records no effort
 * at all; Sam's ruling extends the tap rather than minting a second number —
 * "one tap, no per-set anything".
 */
export const FEEDBACK_EXPECTATIONS = [
  'as_expected',
  'harder_than_expected',
  'easier_than_expected',
  'stopped_early',
] as const;

/**
 * Why it differed. Asked ONLY for the three non-`as_expected` answers, which is
 * the addendum's own rule: "Only the last three ask why".
 *
 * ADJACENT TO `FEEDBACK_PARTIAL_REASONS` AND NOT THE SAME VOCABULARY. That list
 * answers *why did you do only part of it* and overlaps this one on three words
 * (time, soreness, equipment) while disagreeing on the question. Reusing it
 * would make "harder than expected because of `too_hard_today`" expressible,
 * which is not an answer to anything.
 */
export const FEEDBACK_EXPECTATION_REASONS = [
  'soreness',
  'energy',
  'sleep',
  'time',
  'pain',
  'equipment',
  'motivation',
] as const;

export type FeedbackFeeling = typeof FEEDBACK_FEELINGS[number];
export type FeedbackGameFeel = typeof FEEDBACK_GAME_FEELS[number];
export type FeedbackExpectation = typeof FEEDBACK_EXPECTATIONS[number];
export type FeedbackExpectationReason = typeof FEEDBACK_EXPECTATION_REASONS[number];
export type FeedbackCompletion = typeof FEEDBACK_COMPLETIONS[number];
export type FeedbackSoreness = typeof FEEDBACK_SORENESS_LEVELS[number];
export type FeedbackPartialReason = typeof FEEDBACK_PARTIAL_REASONS[number];
export type FeedbackSkipReason = typeof FEEDBACK_SKIP_REASONS[number];
export type SessionOutcomeReason = FeedbackPartialReason | FeedbackSkipReason;

/** One complete post-match result, shared by scheduled and practice games. */
export interface GameSessionOutcome {
  playedWholeGame: boolean;
  timeOnGroundMinutes: number;
  bodyRpe: number;
  feel: FeedbackGameFeel;
}

/** One measured team-training load, stored with the session that produced it. */
export interface TeamTrainingSessionOutcome {
  durationMinutes: number;
  effort: number;
}

/** Validate the two required team-training measurements at the transaction boundary. */
export function parseTeamTrainingSessionOutcome(
  value: unknown,
): TeamTrainingSessionOutcome | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<TeamTrainingSessionOutcome>;
  if (!Number.isInteger(candidate.durationMinutes) || Number(candidate.durationMinutes) <= 0) {
    return null;
  }
  // Same owner as the game rating above — see there for why this is not a
  // literal range.
  if (!isEffortRating(candidate.effort)) {
    return null;
  }
  return {
    durationMinutes: Number(candidate.durationMinutes),
    effort: Number(candidate.effort),
  };
}

/** Validate athlete-shaped match input at the transaction boundary. */
export function parseGameSessionOutcome(value: unknown): GameSessionOutcome | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<GameSessionOutcome>;
  if (typeof candidate.playedWholeGame !== 'boolean') return null;
  if (!Number.isInteger(candidate.timeOnGroundMinutes) || Number(candidate.timeOnGroundMinutes) <= 0) {
    return null;
  }
  // THE ONE SCALE, ASKED — never re-stated as a literal range here. Sam moved
  // every effort input to 1-10 on 2026-08-12, and this validator kept refusing
  // 6 while the slider above it offered 10: the UI would have collected an
  // answer the transaction silently threw away. One owner, both ends.
  if (!isEffortRating(candidate.bodyRpe)) {
    return null;
  }
  const feel = parseFeedbackGameFeel(candidate.feel);
  if (feel === null) return null;
  return {
    playedWholeGame: candidate.playedWholeGame,
    timeOnGroundMinutes: Number(candidate.timeOnGroundMinutes),
    bodyRpe: Number(candidate.bodyRpe),
    feel,
  };
}

export function parseFeedbackCompletion(value: unknown): FeedbackCompletion | null {
  return typeof value === 'string' &&
    (FEEDBACK_COMPLETIONS as readonly string[]).includes(value)
    ? value as FeedbackCompletion
    : null;
}

export function parseFeedbackFeeling(value: unknown): FeedbackFeeling | null {
  return typeof value === 'string' &&
    (FEEDBACK_FEELINGS as readonly string[]).includes(value)
    ? value as FeedbackFeeling
    : null;
}

export function parseFeedbackSoreness(value: unknown): FeedbackSoreness | null {
  return typeof value === 'string' &&
    (FEEDBACK_SORENESS_LEVELS as readonly string[]).includes(value)
    ? value as FeedbackSoreness
    : null;
}

/**
 * A NUMBER, SO THE PARSE IS NOT THE STRING ONE COPIED. `1.5` and `'3'` are both
 * rejected: the vocabulary is five discrete taps, not a range, and a stored
 * `'3'` would compare unequal to every member of it forever after.
 */
export function parseFeedbackGameFeel(value: unknown): FeedbackGameFeel | null {
  return typeof value === 'number' &&
    (FEEDBACK_GAME_FEELS as readonly number[]).includes(value)
    ? value as FeedbackGameFeel
    : null;
}

export function parseFeedbackExpectation(value: unknown): FeedbackExpectation | null {
  return typeof value === 'string' &&
    (FEEDBACK_EXPECTATIONS as readonly string[]).includes(value)
    ? value as FeedbackExpectation
    : null;
}

export function parseFeedbackExpectationReason(
  value: unknown,
): FeedbackExpectationReason | null {
  return typeof value === 'string' &&
    (FEEDBACK_EXPECTATION_REASONS as readonly string[]).includes(value)
    ? value as FeedbackExpectationReason
    : null;
}

/**
 * Does this expectation answer ask a follow-up?
 *
 * ONE PREDICATE, NOT A LIST REPEATED AT EVERY CALLER. The form asks the reason
 * question from it, the payload builder decides whether to send a reason from
 * it, and the save gate decides whether the draft is complete from it — three
 * readers that must agree, so they read the same function rather than three
 * copies of `!== 'as_expected'`.
 */
export function expectationAsksWhy(
  expectation: FeedbackExpectation | null | undefined,
): boolean {
  return !!expectation && expectation !== 'as_expected';
}

export function parseSessionOutcomeReason(
  completion: FeedbackCompletion,
  value: unknown,
): SessionOutcomeReason | null {
  if (typeof value !== 'string') return null;
  if (completion === 'partial' &&
    (FEEDBACK_PARTIAL_REASONS as readonly string[]).includes(value)) {
    return value as FeedbackPartialReason;
  }
  if (completion === 'skipped' &&
    (FEEDBACK_SKIP_REASONS as readonly string[]).includes(value)) {
    return value as FeedbackSkipReason;
  }
  return null;
}

export interface SessionOutcomeTargetIdentity {
  workoutId: string;
  planEntryId?: string;
}

export interface RecordSessionOutcomeComponentIntent {
  componentId: string;
  kind: SessionComponentKind;
  label: string;
  completion: FeedbackCompletion;
  reason: SessionOutcomeReason | null;
}

/**
 * Canonical command shared by Coach and tap session-outcome entry points.
 * `source` is diagnostic metadata only and is excluded from semantic identity.
 */
export interface RecordSessionOutcomeIntent {
  date: string;
  sessionIdentity: SessionOutcomeTargetIdentity;
  completion: FeedbackCompletion;
  feeling: FeedbackFeeling | null;
  /** Read compatibility for historical outcomes; new writers omit this. */
  soreness?: FeedbackSoreness | null;
  reason: SessionOutcomeReason | null;
  componentOutcomes: RecordSessionOutcomeComponentIntent[];
  strength?: StrengthExercisePerformanceLog[];
  conditioning?: ConditioningPerformanceLog;
  notes?: string;
  difficulty?: number;
  /** Actual strength-session minutes. Pairs with `difficulty` for strength sRPE. */
  actualMinutes?: number;
  executionItems?: import('../utils/sessionExecutionChecklist').SessionExecutionItemResult[];
  /** Present only for a game-classified visible session. */
  game?: GameSessionOutcome;
  /** Present only when a team-training component was performed. */
  teamTraining?: TeamTrainingSessionOutcome;
  source: SessionOutcomeSourceMetadata;
}

export interface SessionOutcomeSourceMetadata {
  entryPoint: 'tap' | 'coach';
  surface?: string;
  interpretedIntent?: 'record_session_outcome' | 'missed_session';
  traceId?: string;
}

/** Persisted with the feedback fact so a future Clear/Undo owner has one id. */
export interface SessionOutcomeTransactionReceipt {
  protocolVersion: 1;
  transactionId: string;
  semanticFingerprint: string;
  committedAt: string;
  date: string;
  sessionIdentity: SessionOutcomeTargetIdentity;
  componentIds: string[];
  source: SessionOutcomeSourceMetadata;
}
