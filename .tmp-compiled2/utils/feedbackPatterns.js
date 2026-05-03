"use strict";
/**
 * Feedback Pattern Recognition — Deterministic bias layer.
 *
 * Pure functions. No React. No Zustand. No AI. No NLP.
 *
 * Reads recent SessionFeedback entries and detects simple patterns:
 *   - Fatigue streaks (repeated hard/very_hard)
 *   - Ease streaks (repeated very_easy/easy)
 *   - Completion drops (repeated partial/skipped)
 *   - Cooked repeats (back-to-back very_hard)
 *   - Mixed signals (hard feeling + full completion)
 *
 * Produces a FeedbackPatternSummary that feeds into existing context
 * fields as single-step biases. Never overrides hard rules (game
 * proximity, injury, hard deload, conditioning caps).
 *
 * Called at read time — nothing is persisted.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WINDOW_SIZE = exports.MIN_SAMPLE = exports.FEELING_UP_ONE = exports.READINESS_DOWN = exports.FEELING_SCORE = void 0;
exports.analyzeFeedbackPatterns = analyzeFeedbackPatterns;
exports.applyPatternBiases = applyPatternBiases;
exports.biasConditioningReadiness = biasConditioningReadiness;
exports.shouldPreferRest = shouldPreferRest;
exports.detectFlags = detectFlags;
exports.deriveFatigueTrend = deriveFatigueTrend;
exports.deriveCompletionTrend = deriveCompletionTrend;
exports.deriveProgressionConfidence = deriveProgressionConfidence;
// ─── Constants ───
/** Analysis window size. */
const WINDOW_SIZE = 4;
exports.WINDOW_SIZE = WINDOW_SIZE;
/** Minimum feedback entries required to produce a summary. */
const MIN_SAMPLE = 3;
exports.MIN_SAMPLE = MIN_SAMPLE;
/** Feeling → numeric score for trend calculation. */
const FEELING_SCORE = {
    very_easy: 1,
    easy: 2,
    good: 3,
    hard: 4,
    very_hard: 5,
};
exports.FEELING_SCORE = FEELING_SCORE;
// ─── Readiness / Feeling Step Maps ───
const READINESS_DOWN = {
    high: 'medium',
    medium: 'low',
    low: 'low', // floor — cannot go lower
};
exports.READINESS_DOWN = READINESS_DOWN;
/**
 * One-step feeling escalation for fatigue bias.
 * Moves feeling one notch toward more fatigued.
 * Good → Sore (not Good → Cooked). Enforces the one-step constraint.
 */
const FEELING_UP_ONE = {
    Average: 'Good',
    Good: 'Sore',
    Strong: 'Good', // Strong is a positive signal — one step toward neutral
    Sore: 'Cooked',
    Cooked: 'Cooked', // ceiling — already max fatigue
};
exports.FEELING_UP_ONE = FEELING_UP_ONE;
// ─── Detection ───
function isHardFeeling(f) {
    return f === 'hard' || f === 'very_hard';
}
function isEasyFeeling(f) {
    return f === 'very_easy' || f === 'easy';
}
function isIncomplete(c) {
    return c === 'partial' || c === 'skipped';
}
function detectFlags(entries) {
    const flags = [];
    const n = entries.length;
    // FATIGUE_STREAK: 3+ of last 4 hard/very_hard
    const hardCount = entries.slice(0, WINDOW_SIZE).filter(e => isHardFeeling(e.feeling)).length;
    if (hardCount >= 3) {
        flags.push('FATIGUE_STREAK');
    }
    // EASE_STREAK: 3+ of last 4 very_easy/easy
    const easyCount = entries.slice(0, WINDOW_SIZE).filter(e => isEasyFeeling(e.feeling)).length;
    if (easyCount >= 3) {
        flags.push('EASE_STREAK');
    }
    // COMPLETION_DROP: 2+ of last 4 partial/skipped
    const incompleteCount = entries.slice(0, WINDOW_SIZE).filter(e => isIncomplete(e.completion)).length;
    if (incompleteCount >= 2) {
        flags.push('COMPLETION_DROP');
    }
    // COOKED_REPEAT: 2+ of last 3 very_hard
    const cookedCount = entries.slice(0, 3).filter(e => e.feeling === 'very_hard').length;
    if (cookedCount >= 2) {
        flags.push('COOKED_REPEAT');
    }
    // FULL_COMPLETION_RUN: all entries in window are full, need at least 4
    if (n >= WINDOW_SIZE) {
        const allFull = entries.slice(0, WINDOW_SIZE).every(e => e.completion === 'full');
        if (allFull) {
            flags.push('FULL_COMPLETION_RUN');
        }
    }
    // MIXED_SIGNALS: 2+ of last 4 have hard/very_hard feeling + full completion
    const mixedCount = entries.slice(0, WINDOW_SIZE).filter(e => isHardFeeling(e.feeling) && e.completion === 'full').length;
    if (mixedCount >= 2) {
        flags.push('MIXED_SIGNALS');
    }
    return flags;
}
function deriveFatigueTrend(entries) {
    const scores = entries.slice(0, WINDOW_SIZE).map(e => FEELING_SCORE[e.feeling]);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg >= 4.0)
        return 'rising';
    if (avg <= 2.0)
        return 'falling';
    return 'stable';
}
function deriveCompletionTrend(entries) {
    const window = entries.slice(0, WINDOW_SIZE);
    const fullCount = window.filter(e => e.completion === 'full').length;
    if (fullCount === window.length)
        return 'consistent';
    if (fullCount <= window.length / 2)
        return 'declining';
    return 'sporadic';
}
function deriveProgressionConfidence(flags) {
    const hasEase = flags.includes('EASE_STREAK');
    const hasFullRun = flags.includes('FULL_COMPLETION_RUN');
    const hasCooked = flags.includes('COOKED_REPEAT');
    const hasFatigue = flags.includes('FATIGUE_STREAK');
    const hasDrop = flags.includes('COMPLETION_DROP');
    if (hasEase && hasFullRun)
        return 'under_challenged';
    if (hasCooked || (hasFatigue && hasDrop))
        return 'over_reached';
    return 'well_matched';
}
// ─── Main API ───
/**
 * Analyze recent feedback entries and return a pattern summary.
 *
 * @param recentFeedback - Feedback entries, newest first. Caller is
 *   responsible for sorting and filtering to entries before the target date.
 * @returns Summary, or null if insufficient data (< 3 entries).
 */
function analyzeFeedbackPatterns(recentFeedback) {
    if (recentFeedback.length < MIN_SAMPLE)
        return null;
    const window = recentFeedback.slice(0, WINDOW_SIZE);
    const flags = detectFlags(window);
    return {
        sampleSize: window.length,
        fatigueTrend: deriveFatigueTrend(window),
        completionTrend: deriveCompletionTrend(window),
        progressionConfidence: deriveProgressionConfidence(flags),
        activeFlags: flags,
    };
}
/**
 * Apply pattern-based biases to a StrengthProgressionContext.
 *
 * CONSTRAINT: Each bias moves a field by at most one step.
 *   - readiness: high→medium or medium→low (never high→low)
 *   - sessionFeeling: one notch toward fatigue (never two)
 *   - consecutiveBuildWeeks: +1 only
 *   - missedSessionsThisWeek: +1 only
 *
 * Returns a new context object — does not mutate the input.
 */
function applyPatternBiases(ctx, summary) {
    if (!summary)
        return ctx;
    const biased = { ...ctx };
    const flags = summary.activeFlags;
    // FATIGUE_STREAK → readiness down one step
    if (flags.includes('FATIGUE_STREAK')) {
        biased.readiness = READINESS_DOWN[biased.readiness];
    }
    // COOKED_REPEAT → sessionFeeling up one notch toward fatigue
    // Only if FATIGUE_STREAK didn't already downgrade readiness to low.
    // This prevents double-stacking: readiness down + feeling up would be two steps.
    if (flags.includes('COOKED_REPEAT')) {
        if (!flags.includes('FATIGUE_STREAK')) {
            // Standalone COOKED_REPEAT: feeling up one step
            biased.sessionFeeling = FEELING_UP_ONE[biased.sessionFeeling];
        }
        // If FATIGUE_STREAK is also active, readiness was already downgraded.
        // Don't also push feeling — one bias per dimension.
    }
    // MIXED_SIGNALS → readiness down one step (athlete hiding fatigue)
    // Only if FATIGUE_STREAK hasn't already downgraded readiness.
    if (flags.includes('MIXED_SIGNALS') && !flags.includes('FATIGUE_STREAK')) {
        biased.readiness = READINESS_DOWN[biased.readiness];
    }
    // EASE_STREAK + FULL_COMPLETION_RUN → consecutiveBuildWeeks +1
    // Makes build/overreach slightly more likely.
    if (flags.includes('EASE_STREAK') && flags.includes('FULL_COMPLETION_RUN')) {
        biased.consecutiveBuildWeeks = biased.consecutiveBuildWeeks + 1;
    }
    // COMPLETION_DROP → missedSessionsThisWeek +1
    // Contributes to soft deload signal count.
    if (flags.includes('COMPLETION_DROP')) {
        biased.missedSessionsThisWeek = biased.missedSessionsThisWeek + 1;
    }
    return biased;
}
// ─── Conditioning Readiness Bias ───
/**
 * Downgrade readiness by one step for conditioning tier selection.
 * Applies when FATIGUE_STREAK, COOKED_REPEAT, or MIXED_SIGNALS is active.
 *
 * Only one downgrade regardless of how many flags are active.
 */
function biasConditioningReadiness(readiness, summary) {
    if (!summary)
        return readiness;
    const flags = summary.activeFlags;
    if (flags.includes('FATIGUE_STREAK') ||
        flags.includes('COOKED_REPEAT') ||
        flags.includes('MIXED_SIGNALS')) {
        return READINESS_DOWN[readiness];
    }
    return readiness;
}
// ─── Recovery Rest Preference ───
/**
 * Check if COOKED_REPEAT pattern suggests preferring full rest
 * over placing additional recovery sessions.
 *
 * Returns true if the athlete has reported being smashed recently
 * AND already has at least one recovery session this week.
 */
function shouldPreferRest(summary, weekRecoveryCount) {
    if (!summary)
        return false;
    return summary.activeFlags.includes('COOKED_REPEAT') && weekRecoveryCount >= 1;
}
