/**
 * Feedback Adapter — Session-type-matched adaptation rules.
 *
 * Pure functions. No React. No Zustand. No side effects.
 *
 * Reads recent feedback (including recorded effort and completion) and
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

import { sessionEffortFromFeedback } from '../rules/effortScale';
import type { SessionFeedback } from '../store/programStore';
import type { Workout, WorkoutType, SessionFeeling, CapacityBand } from '../types/domain';
import { feedbackComponentKindForWorkoutType } from './sessionComponents';
import { normalizeStrengthIntent } from '../rules/strengthPatternContributions';

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

type FeedbackMatchTarget = WorkoutType | string | Workout;

function workoutMatchCategory(target: FeedbackMatchTarget): string {
  if (typeof target === 'string') return normalizeWorkoutCategory(target);
  if (target.strengthIntent) {
    const intent = normalizeStrengthIntent(target.strengthIntent);
    if (intent.effectivePatterns.length > 0) {
      return `strength:${intent.effectivePatterns.join('+')}`;
    }
  }
  return normalizeWorkoutCategory(target.workoutType);
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
  targetType: FeedbackMatchTarget,
  allFeedback: Record<string, SessionFeedback>,
  allWorkouts: Record<string, FeedbackMatchTarget>,
  currentDate: string,
  lookbackDays: number = 14,
): SessionFeedback | null {
  const targetCategory = workoutMatchCategory(targetType);
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

    if (workoutMatchCategory(wType) === targetCategory) {
      best = projectFeedbackForWorkoutType(fb, targetType);
      break; // most recent match
    }
  }

  return best;
}

function projectFeedbackForWorkoutType(
  feedback: SessionFeedback,
  workoutType: FeedbackMatchTarget,
): SessionFeedback {
  const targetKind = typeof workoutType !== 'string' && workoutType.strengthIntent?.effectivePatterns.length
    ? 'strength'
    : feedbackComponentKindForWorkoutType(
        typeof workoutType === 'string' ? workoutType : workoutType.workoutType,
      );
  const component = targetKind
    ? feedback.components?.find((entry) => entry.kind === targetKind)
    : null;
  if (!component) return feedback;

  if (component.completion === 'skipped') {
    return {
      dateStr: feedback.dateStr,
      completion: 'skipped',
      components: feedback.components,
      notes: feedback.notes,
    };
  }

  return {
    ...feedback,
    completion: component.completion,
  };
}

// ─── Adaptation Rules ───

/**
 * Derive adaptation adjustments from the most recent matching feedback.
 *
 * Rules are simple, deterministic, and conservative:
 *
 * Numeric effort is read through sessionEffortFromFeedback. Historical soreness
 * is not an input. This compatibility adapter does not write accepted doses;
 * the canonical progression compiler owns those decisions.
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

  const completion = feedback.completion;

  // ── Rule 1: Skipped session ──
  if (completion === 'skipped') {
    return {
      feelingOverride: null,
      readinessBias: 'down',
      volumeAdjustment: -1,
      blockProgression: true,
      explanation: 'Holding steady - no increase after missed session.',
    };
  }

  // ── Rule 2: Partial session ──
  if (completion === 'partial') {
    return {
      feelingOverride: null,
      readinessBias: null,
      volumeAdjustment: 0,
      blockProgression: true,
      explanation: 'Maintaining load - last session was cut short.',
    };
  }

  const difficulty = sessionEffortFromFeedback(feedback);
  if (difficulty === null) return NO_ADAPTATION;

  // ── Rule 3: High fatigue (difficulty >= 9) ──
  if (difficulty >= 9) {
    return {
      feelingOverride: 'Cooked',
      readinessBias: 'down',
      volumeAdjustment: -1,
      blockProgression: true,
      explanation: 'Volume reduced based on previous session fatigue.',
    };
  }

  // ── Rule 4: High difficulty (8+) ──
  if (difficulty >= 8) {
    return {
      feelingOverride: null,
      readinessBias: null,
      volumeAdjustment: 0,
      blockProgression: true,
      explanation: 'Maintaining load - recovery still in progress.',
    };
  }

  // ── Rule 6: Easy effort → allow progression ──
  if (difficulty <= 5) {
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

// ─── Readiness Adjustment ───

const READINESS_DOWN: Record<CapacityBand, CapacityBand> = {
  high: 'medium',
  medium: 'low',
  low: 'low',
};

/**
 * Does this adaptation report RECENT FATIGUE?
 *
 * RENAMED AND RE-POINTED from `applyReadinessBias` (Sam, 2026-08-13, the
 * readiness homonym). It used to take the CAPACITY band and step it down —
 * `READINESS_DOWN[readiness]` — which is the laundering site Sam had already
 * deleted once at `calculateCapacity`, surviving here under a second name.
 *
 * **Capacity is the athlete's standing baseline, computed from two onboarding
 * answers; it moves when the PROFILE moves and at no other time.** An
 * adaptation is evidence about the last few sessions. Writing one into the
 * other told every downstream reader that a fit athlete was untrained.
 *
 * The adaptation's intent — "be more conservative" — is unchanged and now
 * travels as `ProgressionInput.recentFatiguePattern`, which is a peer of the
 * three fatigue signals the soft-deload counter already had.
 */
export function adaptationReportsFatigue(adaptation: AdaptationResult): boolean {
  return adaptation.readinessBias === 'down';
}
