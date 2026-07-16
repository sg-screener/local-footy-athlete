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

export type FeedbackFeeling = typeof FEEDBACK_FEELINGS[number];
export type FeedbackCompletion = typeof FEEDBACK_COMPLETIONS[number];
export type FeedbackSoreness = typeof FEEDBACK_SORENESS_LEVELS[number];
export type FeedbackPartialReason = typeof FEEDBACK_PARTIAL_REASONS[number];
export type FeedbackSkipReason = typeof FEEDBACK_SKIP_REASONS[number];
export type SessionOutcomeReason = FeedbackPartialReason | FeedbackSkipReason;

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
  soreness: FeedbackSoreness | null;
  reason: SessionOutcomeReason | null;
  componentOutcomes: RecordSessionOutcomeComponentIntent[];
  strength?: StrengthExercisePerformanceLog[];
  conditioning?: ConditioningPerformanceLog;
  notes?: string;
  difficulty?: number;
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
