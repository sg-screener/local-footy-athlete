"use strict";
/**
 * Progression Helpers — Shared utilities for strength and conditioning progression.
 *
 * Pure functions. No React. No Zustand. No side effects.
 *
 * Provides:
 *   - SessionFeeling → RPE bridge
 *   - Completion quality derivation from logged sets
 *   - Trend signal derivation from exercise exposure history
 *   - Exposure history extraction from logged workout data
 *
 * All functions work with the existing LoggedWorkout / LoggedSet types
 * from domain.ts — no new persistence layer needed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.feelingToRPE = feelingToRPE;
exports.deriveCompletionQuality = deriveCompletionQuality;
exports.deriveSessionCompletionQuality = deriveSessionCompletionQuality;
exports.deriveTrend = deriveTrend;
exports.extractExposureHistory = extractExposureHistory;
exports.countConsecutiveBuildWeeks = countConsecutiveBuildWeeks;
exports.estimateWeeksSinceDeload = estimateWeeksSinceDeload;
exports.calculateConditioningLoad = calculateConditioningLoad;
// ─── SessionFeeling → RPE Bridge ───
const FEELING_RPE_MAP = {
    Cooked: 10,
    Sore: 8,
    Strong: 7,
    Good: 6,
    Average: 5,
};
/**
 * Bridge a qualitative SessionFeeling to a numeric RPE value.
 * Used as the primary RPE source until direct RPE logging is added.
 */
function feelingToRPE(feeling) {
    return FEELING_RPE_MAP[feeling] ?? 6;
}
// ─── Completion Quality Derivation ───
/**
 * Derive completion quality from logged sets vs prescribed prescription.
 *
 * - full:    all prescribed sets completed at or above target load
 * - partial: ≥50% of sets completed, or load reduced mid-session
 * - failed:  <50% of sets completed, or session abandoned
 *
 * @param loggedSets      - Sets actually logged for this exercise
 * @param prescribedSets  - Number of sets prescribed
 * @param prescribedWeight - Target weight in kg (optional — if not set, only reps matter)
 */
function deriveCompletionQuality(loggedSets, prescribedSets, prescribedWeight) {
    if (loggedSets.length === 0)
        return 'failed';
    if (prescribedSets === 0)
        return 'full';
    const completedCount = loggedSets.filter(s => s.actualReps !== undefined && s.actualReps !== null && s.actualReps > 0).length;
    const completionRate = completedCount / prescribedSets;
    if (completionRate < 0.5)
        return 'failed';
    // Check if load was reduced below target
    if (prescribedWeight !== undefined && prescribedWeight > 0) {
        const loadReduced = loggedSets.some(s => s.actualWeightKg !== undefined &&
            s.actualWeightKg !== null &&
            s.actualWeightKg < prescribedWeight * 0.9 // >10% drop = reduced
        );
        if (loadReduced && completionRate < 1)
            return 'partial';
    }
    if (completionRate < 1)
        return 'partial';
    return 'full';
}
/**
 * Derive session-level completion quality from an entire logged workout.
 * Aggregates across all exercises — the worst quality wins.
 */
function deriveSessionCompletionQuality(loggedWorkout, prescribedSetsPerExercise = 3) {
    if (!loggedWorkout.completed)
        return 'failed';
    if (loggedWorkout.sets.length === 0)
        return 'failed';
    // Group sets by exercise
    const byExercise = new Map();
    for (const set of loggedWorkout.sets) {
        const existing = byExercise.get(set.workoutExerciseId) || [];
        existing.push(set);
        byExercise.set(set.workoutExerciseId, existing);
    }
    let worstQuality = 'full';
    for (const sets of byExercise.values()) {
        const q = deriveCompletionQuality(sets, prescribedSetsPerExercise);
        if (q === 'failed')
            return 'failed';
        if (q === 'partial')
            worstQuality = 'partial';
    }
    return worstQuality;
}
// ─── Trend Signal Derivation ───
/**
 * Derive a trend signal from the last 2–3 logged exposures of an exercise.
 *
 * Compares volume (load × reps) between oldest and most recent exposure:
 *   - ≥5% increase  → 'up'
 *   - ≥5% decrease  → 'down'
 *   - otherwise      → 'flat'
 *
 * Returns 'flat' if fewer than 2 exposures exist (insufficient data).
 *
 * @param recentExposures - Ordered oldest-first. Max 3 entries expected.
 */
function deriveTrend(recentExposures) {
    if (recentExposures.length < 2)
        return 'flat';
    const oldest = recentExposures[0];
    const newest = recentExposures[recentExposures.length - 1];
    const oldVolume = oldest.load * oldest.reps;
    const newVolume = newest.load * newest.reps;
    // Guard against division by zero
    if (oldVolume === 0) {
        return newVolume > 0 ? 'up' : 'flat';
    }
    const changePercent = (newVolume - oldVolume) / oldVolume;
    if (changePercent >= 0.05)
        return 'up';
    if (changePercent <= -0.05)
        return 'down';
    return 'flat';
}
// ─── Exposure History Extraction ───
/**
 * Extract recent exposure records for a specific exercise from workout history.
 *
 * Scans logged workouts (newest first), finds sets for the given exercise,
 * and returns up to `limit` exposure records ordered oldest-first.
 *
 * @param workoutHistory  - Logged workouts, newest first
 * @param exerciseId      - The exercise ID to find
 * @param limit           - Max exposures to return (default 3)
 */
function extractExposureHistory(workoutHistory, exerciseId, limit = 3) {
    const exposures = [];
    for (const workout of workoutHistory) {
        if (exposures.length >= limit)
            break;
        const matchingSets = workout.sets.filter(s => s.workoutExerciseId === exerciseId &&
            s.actualWeightKg !== undefined &&
            s.actualWeightKg !== null &&
            s.actualReps !== undefined &&
            s.actualReps !== null);
        if (matchingSets.length === 0)
            continue;
        const avgLoad = matchingSets.reduce((sum, s) => sum + (s.actualWeightKg || 0), 0) / matchingSets.length;
        const avgReps = matchingSets.reduce((sum, s) => sum + (s.actualReps || 0), 0) / matchingSets.length;
        exposures.push({
            load: avgLoad,
            reps: avgReps,
            date: workout.loggedDate,
        });
    }
    // Return oldest-first (we collected newest-first)
    return exposures.reverse();
}
/**
 * Count consecutive build weeks from session history.
 *
 * Looks at recent logged workouts and checks how many consecutive weeks
 * had at least one completed strength session. Resets on any week with
 * no logged sessions.
 *
 * @param workoutHistory - Logged workouts, newest first
 * @returns Number of consecutive weeks with completed strength sessions
 */
function countConsecutiveBuildWeeks(workoutHistory) {
    if (workoutHistory.length === 0)
        return 0;
    // Group by ISO week
    const weekSet = new Set();
    for (const w of workoutHistory) {
        if (!w.completed)
            continue;
        const weekKey = getISOWeekKey(w.loggedDate);
        weekSet.add(weekKey);
    }
    // Walk backwards from current week
    const now = new Date();
    let count = 0;
    for (let i = 0; i < 12; i++) {
        const checkDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekKey = getISOWeekKey(checkDate.toISOString().split('T')[0]);
        if (weekSet.has(weekKey)) {
            count++;
        }
        else {
            break;
        }
    }
    return count;
}
/**
 * Estimate weeks since last deload.
 *
 * Simple heuristic: count consecutive weeks with completed sessions,
 * working backwards. A week with no sessions or very light sessions
 * is treated as a deload boundary.
 *
 * @param workoutHistory - Logged workouts, newest first
 */
function estimateWeeksSinceDeload(workoutHistory) {
    // Same as consecutive build weeks — a gap in training = deload boundary
    return countConsecutiveBuildWeeks(workoutHistory);
}
// ─── Internal Helpers ───
/** Get ISO week key (YYYY-WNN) from a date string. */
function getISOWeekKey(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    // Simple ISO week calculation
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}
// ─── Conditioning Load Model ───
const TIER_WEIGHT = {
    'A': 3,
    'B-high': 2,
    'B-low': 1,
    'C': 0.5,
};
/**
 * Calculate weighted conditioning load for a set of sessions.
 * Used by the weekly load guard in conditioning progression.
 */
function calculateConditioningLoad(sessions) {
    return sessions.reduce((sum, s) => sum + (TIER_WEIGHT[s.tier] || 0), 0);
}
