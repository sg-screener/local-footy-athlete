/**
 * Feedback Adapter — Session-type-matched adaptation rules.
 *
 * Pure functions. No React. No Zustand. No side effects.
 *
 * Reads recent feedback (including difficulty RPE and soreness) and
 * produces:
 *   1. Context adjustments for the existing progression pipeline
 *   2. Human-readable adaptation explanations for UI display
 *
 * MATCHING RULE:
 * Adaptations apply to the next session of the SAME workout type.
 * Lower → next lower, Upper Push → next upper push, etc.
 *
 * VOLUME MECHANISM:
 * volumeAdjustment is an explicit -1 | 0 | +1 field applied directly by
 * the progression integration layer. No indirect signals through
 * missedSessionsThisWeek or consecutiveBuildWeeks.
 *
 * SAFETY CONSTRAINTS:
 * - Never increases volume/intensity aggressively (caps at +1 set, +2.5% load)
 * - Never overrides game proximity rules
 * - All adjustments are bounded and reversible
 */

import type { SessionFeedback, FeedbackSoreness } from '../store/programStore';
import type { Workout, WorkoutType, SessionFeeling, ReadinessLevel } from '../types/domain';

// ─── Types ───

export interface AdaptationResult {
  /** Adjustment to session feeling (overrides feedback-feeling-derived value). */
  feelingOverride: SessionFeeling | null;
  /** Readiness bias: 'down' to reduce, null for no change. */
  readinessBias: 'down' | null;
  /**
   * Explicit volume (sets) adjustment per exercise.
   *   -1 = reduce by 1 set, 0 = no change, +1 = allow adding 1 set.
   * Applied directly by the progression integration layer — not smuggled
   * through unrelated context fields.
   */
  volumeAdjustment: -1 | 0 | 1;
  /** Whether to block load/rep increases (hold at current prescription). */
  blockProgression: boolean;
  /** Human-readable explanation of what changed and why. */
  explanation: string | null;
}

/** Default: no adaptation. */
const NO_ADAPTATION: AdaptationResult = {
  feelingOverride: null,
  readinessBias: null,
  volumeAdjustment: 0,
  blockProgression: false,
  explanation: null,
};

// ─── Session Type Matching ───

/**
 * Normalize workout type to a category for matching.
 * "Lower Strength" and "Lower Power" both match as "lower".
 */
function normalizeWorkoutCategory(workoutType: WorkoutType | string): string {
  const t = (workoutType || '').toLowerCase();
  if (t.includes('lower')) return 'lower';
  if (t.includes('upper') && t.includes('push')) return 'upper_push';
  if (t.includes('upper') && t.includes('pull')) return 'upper_pull';
  if (t.includes('upper')) return 'upper';
  if (t.includes('full')) return 'full';
  if (t.includes('conditioning')) return 'conditioning';
  if (t.includes('recovery')) return 'recovery';
  if (t.includes('strength')) return 'strength';
  return t;
}

/**
 * Find the most recent feedback entry for a matching session type.
 *
 * @param targetType   - The workout type we're looking for a match
 * @param allFeedback  - All feedback entries keyed by date (from store)
 * @param allWorkouts  - Map of date → workout type (for matching)
 * @param currentDate  - The date being resolved (exclude this date)
 * @param lookbackDays - How many days back to search (default: 14)
 */
export function findMatchingFeedback(
  targetType: WorkoutType | string,
  allFeedback: Record<string, SessionFeedback>,
  allWorkouts: Record<string, string>, // date → workoutType
  currentDate: string,
  lookbackDays: number = 14,
): SessionFeedback | null {
  const targetCategory = normalizeWorkoutCategory(targetType);
  const [y, m, d] = currentDate.split('-').map(Number);
  const current = new Date(y, m - 1, d);

  // Scan backward from current date
  let best: SessionFeedback | null = null;
  for (let i = 1; i <= lookbackDays; i++) {
    const checkDate = new Date(current.getTime() - i * 24 * 60 * 60 * 1000);
    const checkStr = checkDate.toISOString().split('T')[0];
    const fb = allFeedback[checkStr];
    if (!fb) continue;

    const wType = allWorkouts[checkStr];
    if (!wType) continue;

    if (normalizeWorkoutCategory(wType) === targetCategory) {
      best = fb;
      break; // most recent match
    }
  }

  return best;
}

// ─── Adaptation Rules ───

/**
 * Derive adaptation adjustments from the most recent matching feedback.
 *
 * Rules are simple, deterministic, and conservative:
 *
 * HIGH FATIGUE (difficulty >= 9 OR soreness = "high"):
 *   → volumeAdjustment: -1, blockProgression, feeling → Sore
 *   → "Volume reduced based on previous session fatigue"
 *
 * HIGH DIFFICULTY (difficulty >= 8, soreness != "high"):
 *   → volumeAdjustment: 0, blockProgression
 *   → "Maintaining load — recovery still in progress"
 *
 * MODERATE SORENESS (soreness = "moderate"):
 *   → volumeAdjustment: 0, readiness down one step
 *   → "Slightly reduced intensity — managing soreness"
 *
 * LOW DIFFICULTY + NO SORENESS (difficulty <= 5 AND soreness = "none"):
 *   → volumeAdjustment: +1, feeling → Strong
 *   → "Load increased due to strong performance last session"
 *
 * SKIPPED SESSION (completion = "skipped"):
 *   → volumeAdjustment: -1, blockProgression
 *   → "Holding steady — no increase after missed session"
 *
 * PARTIAL SESSION (completion = "partial"):
 *   → volumeAdjustment: 0, blockProgression
 *   → "Maintaining load — last session was cut short"
 */
export function deriveAdaptation(
  feedback: SessionFeedback | null,
): AdaptationResult {
  if (!feedback) return NO_ADAPTATION;

  const difficulty = feedback.difficulty ?? difficultyFromFeeling(feedback.feeling);
  const soreness: FeedbackSoreness = feedback.soreness ?? 'none';
  const completion = feedback.completion;

  // ── Rule 1: Skipped session ──
  if (completion === 'skipped') {
    return {
      feelingOverride: null,
      readinessBias: 'down',
      volumeAdjustment: -1,
      blockProgression: true,
      explanation: 'Holding steady — no increase after missed session.',
    };
  }

  // ── Rule 2: Partial session ──
  if (completion === 'partial') {
    return {
      feelingOverride: null,
      readinessBias: null,
      volumeAdjustment: 0,
      blockProgression: true,
      explanation: 'Maintaining load — last session was cut short.',
    };
  }

  // ── Rule 3: High fatigue (difficulty >= 9 OR soreness = high) ──
  if (difficulty >= 9 || soreness === 'high') {
    return {
      feelingOverride: 'Sore',
      readinessBias: 'down',
      volumeAdjustment: -1,
      blockProgression: true,
      explanation: 'Volume reduced based on previous session fatigue.',
    };
  }

  // ── Rule 4: High difficulty (8+), soreness not high ──
  if (difficulty >= 8) {
    return {
      feelingOverride: null,
      readinessBias: null,
      volumeAdjustment: 0,
      blockProgression: true,
      explanation: 'Maintaining load — recovery still in progress.',
    };
  }

  // ── Rule 5: Moderate soreness ──
  if (soreness === 'moderate') {
    return {
      feelingOverride: null,
      readinessBias: 'down',
      volumeAdjustment: 0,
      blockProgression: false,
      explanation: 'Slightly reduced intensity — managing soreness.',
    };
  }

  // ── Rule 6: Easy + no soreness → allow progression ──
  if (difficulty <= 5 && soreness === 'none') {
    return {
      feelingOverride: 'Strong',
      readinessBias: null,
      volumeAdjustment: 1,
      blockProgression: false,
      explanation: 'Load increased due to strong performance last session.',
    };
  }

  // ── Default: no special adaptation ──
  return NO_ADAPTATION;
}

// ─── Helpers ───

/** Map the 5-level feeling to approximate RPE difficulty (1-10). */
function difficultyFromFeeling(feeling: string): number {
  switch (feeling) {
    case 'very_easy': return 3;
    case 'easy': return 4;
    case 'good': return 6;
    case 'hard': return 8;
    case 'very_hard': return 9;
    default: return 6;
  }
}

// ─── Readiness Adjustment ───

const READINESS_DOWN: Record<ReadinessLevel, ReadinessLevel> = {
  high: 'medium',
  medium: 'low',
  low: 'low',
};

/**
 * Apply adaptation result to a readiness level.
 * Returns adjusted readiness (or original if no bias).
 */
export function applyReadinessBias(
  readiness: ReadinessLevel,
  adaptation: AdaptationResult,
): ReadinessLevel {
  if (adaptation.readinessBias === 'down') {
    return READINESS_DOWN[readiness];
  }
  return readiness;
}
