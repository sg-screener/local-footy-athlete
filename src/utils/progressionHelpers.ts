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

import type {
  SessionFeeling,
  LoggedWorkout,
  LoggedSet,
} from '../types/domain';
import { formatLocalISODate, todayISOLocal } from './appDate';

// ─── Types ───

export type CompletionQuality = 'full' | 'partial' | 'failed';

export type TrendSignal = 'up' | 'flat' | 'down';

export type ExerciseRole = 'primary_strength' | 'secondary_strength';

export interface ExposureRecord {
  /** Average load (weight) across sets for this exercise in one session. */
  load: number;
  /** Average reps across sets for this exercise in one session. */
  reps: number;
  /** ISO date of the session. */
  date: string;
}

// ─── SessionFeeling → RPE Bridge ───

const FEELING_RPE_MAP: Record<SessionFeeling, number> = {
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
export function feelingToRPE(feeling: SessionFeeling): number {
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
export function deriveCompletionQuality(
  loggedSets: LoggedSet[],
  prescribedSets: number,
  prescribedWeight?: number,
): CompletionQuality {
  if (loggedSets.length === 0) return 'failed';
  if (prescribedSets === 0) return 'full';

  const completedCount = loggedSets.filter(s =>
    s.actualReps !== undefined && s.actualReps !== null && s.actualReps > 0
  ).length;

  const completionRate = completedCount / prescribedSets;

  if (completionRate < 0.5) return 'failed';

  // Check if load was reduced below target
  if (prescribedWeight !== undefined && prescribedWeight > 0) {
    const loadReduced = loggedSets.some(s =>
      s.actualWeightKg !== undefined &&
      s.actualWeightKg !== null &&
      s.actualWeightKg < prescribedWeight * 0.9 // >10% drop = reduced
    );
    if (loadReduced && completionRate < 1) return 'partial';
  }

  if (completionRate < 1) return 'partial';

  return 'full';
}

/**
 * Derive session-level completion quality from an entire logged workout.
 * Aggregates across all exercises — the worst quality wins.
 */
export function deriveSessionCompletionQuality(
  loggedWorkout: LoggedWorkout,
  prescribedSetsPerExercise: number = 3,
): CompletionQuality {
  if (!loggedWorkout.completed) return 'failed';
  if (loggedWorkout.sets.length === 0) return 'failed';

  // Group sets by exercise
  const byExercise = new Map<string, LoggedSet[]>();
  for (const set of loggedWorkout.sets) {
    const existing = byExercise.get(set.workoutExerciseId) || [];
    existing.push(set);
    byExercise.set(set.workoutExerciseId, existing);
  }

  let worstQuality: CompletionQuality = 'full';
  for (const sets of byExercise.values()) {
    const q = deriveCompletionQuality(sets, prescribedSetsPerExercise);
    if (q === 'failed') return 'failed';
    if (q === 'partial') worstQuality = 'partial';
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
export function deriveTrend(recentExposures: ExposureRecord[]): TrendSignal {
  if (recentExposures.length < 2) return 'flat';

  const oldest = recentExposures[0];
  const newest = recentExposures[recentExposures.length - 1];

  const oldVolume = oldest.load * oldest.reps;
  const newVolume = newest.load * newest.reps;

  // Guard against division by zero
  if (oldVolume === 0) {
    return newVolume > 0 ? 'up' : 'flat';
  }

  const changePercent = (newVolume - oldVolume) / oldVolume;

  if (changePercent >= 0.05) return 'up';
  if (changePercent <= -0.05) return 'down';
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
export function extractExposureHistory(
  workoutHistory: LoggedWorkout[],
  exerciseId: string,
  limit: number = 3,
): ExposureRecord[] {
  const exposures: ExposureRecord[] = [];

  for (const workout of workoutHistory) {
    if (exposures.length >= limit) break;

    const matchingSets = workout.sets.filter(s =>
      s.workoutExerciseId === exerciseId &&
      s.actualWeightKg !== undefined &&
      s.actualWeightKg !== null &&
      s.actualReps !== undefined &&
      s.actualReps !== null
    );

    if (matchingSets.length === 0) continue;

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
 * Extract exposure history for an exercise, with slot-sibling fallback.
 *
 * Used by the cross-cycle variation system: when an exercise rotates
 * across pool slots (e.g. Back Squat → Front Squat at a block boundary),
 * the rotated exercise has no logged history under its own ID. Instead
 * of starting from scratch, this helper pulls history from any sibling
 * in the same (slot, role) and normalizes loads via the pool's load
 * ratios — so the rotated exercise inherits the block's progression
 * trend.
 *
 * Behaviour:
 *   1. If the target exercise is not managed by any pool, delegate to
 *      extractExposureHistory(history, targetExerciseId, limit).
 *   2. Otherwise, gather all sibling IDs in the same (slot, role),
 *      walk the history, match any sibling's sets, normalize the
 *      average load by (targetRatio / siblingRatio), and return up
 *      to `limit` most recent exposures.
 *
 * Siblings with loadRatio = 0 (bodyweight) contribute unnormalized
 * loads (translation is not meaningful).
 */
export function extractSlotExposureHistory(
  workoutHistory: LoggedWorkout[],
  targetExerciseName: string,
  targetExerciseId: string,
  limit: number = 3,
): ExposureRecord[] {
  // Dynamic imports avoided — keep this pure + synchronous. We take
  // the hit of evaluating the pool module at import time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pools = require('../data/exercisePoolsStrength') as typeof import('../data/exercisePoolsStrength');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const program = require('../data/defaultProgram') as typeof import('../data/defaultProgram');

  const classification = pools.findPoolEntry(targetExerciseName);
  if (!classification) {
    return extractExposureHistory(workoutHistory, targetExerciseId, limit);
  }

  const { entry: targetEntry, slot, role } = classification;
  const siblings = pools.getSlotSiblings(slot, role);

  // Resolve each sibling name → canonical Exercise.id (same path used at
  // workout build time, so IDs in history match up).
  const siblingById = new Map<string, { name: string; ratio: number }>();
  for (const s of siblings) {
    const id = program.findOrCreateExercise(s.name).id;
    siblingById.set(id, { name: s.name, ratio: s.loadRatio });
  }

  const exposures: ExposureRecord[] = [];

  for (const workout of workoutHistory) {
    if (exposures.length >= limit) break;

    // Find this workout's first sibling match (avoid double-counting if
    // two sibling exercises appear in one session).
    let matchedMeta: { name: string; ratio: number } | null = null;
    let matchingSets: LoggedSet[] = [];
    for (const [siblingId, meta] of siblingById) {
      const sets = workout.sets.filter(s =>
        s.workoutExerciseId === siblingId &&
        s.actualWeightKg !== undefined && s.actualWeightKg !== null &&
        s.actualReps !== undefined && s.actualReps !== null
      );
      if (sets.length > 0) {
        matchedMeta = meta;
        matchingSets = sets;
        break;
      }
    }

    if (!matchedMeta || matchingSets.length === 0) continue;

    const avgLoad = matchingSets.reduce((sum, s) => sum + (s.actualWeightKg || 0), 0) / matchingSets.length;
    const avgReps = matchingSets.reduce((sum, s) => sum + (s.actualReps || 0), 0) / matchingSets.length;

    // Normalize load from sibling → target via ratio.
    // If either side is bodyweight (ratio 0) the translation is undefined —
    // pass through unnormalized.
    const normalizedLoad =
      matchedMeta.ratio > 0 && targetEntry.loadRatio > 0
        ? avgLoad * (targetEntry.loadRatio / matchedMeta.ratio)
        : avgLoad;

    exposures.push({
      load: normalizedLoad,
      reps: avgReps,
      date: workout.loggedDate,
    });
  }

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
export function countConsecutiveBuildWeeks(
  workoutHistory: LoggedWorkout[],
): number {
  if (workoutHistory.length === 0) return 0;

  // Group by ISO week
  const weekSet = new Set<string>();
  for (const w of workoutHistory) {
    if (!w.completed) continue;
    const weekKey = getISOWeekKey(w.loggedDate);
    weekSet.add(weekKey);
  }

  // Walk backwards from current week
  const now = new Date(`${todayISOLocal()}T12:00:00`);
  let count = 0;
  for (let i = 0; i < 12; i++) {
    const checkDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekKey = getISOWeekKey(formatLocalISODate(checkDate));
    if (weekSet.has(weekKey)) {
      count++;
    } else {
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
export function estimateWeeksSinceDeload(
  workoutHistory: LoggedWorkout[],
): number {
  // Same as consecutive build weeks — a gap in training = deload boundary
  return countConsecutiveBuildWeeks(workoutHistory);
}

// ─── Internal Helpers ───

/** Get ISO week key (YYYY-WNN) from a date string. */
function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  // Simple ISO week calculation
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

// ─── Conditioning Load Model ───

const TIER_WEIGHT: Record<string, number> = {
  'A': 3,
  'B-high': 2,
  'B-low': 1,
  'C': 0.5,
};

/**
 * Calculate weighted conditioning load for a set of sessions.
 * Used by the weekly load guard in conditioning progression.
 */
export function calculateConditioningLoad(
  sessions: Array<{ tier: string }>,
): number {
  return sessions.reduce((sum, s) => sum + (TIER_WEIGHT[s.tier] || 0), 0);
}
