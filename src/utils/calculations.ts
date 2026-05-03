/**
 * Training Calculation Utilities
 *
 * Functions for calculating training metrics:
 * - One rep max estimation (Epley formula)
 * - Working weight from RPE and target reps
 * - Training volume calculations
 * - Training load (intensity × volume)
 * - Weekly and monthly totals
 * - Training streaks
 * - Body composition estimates
 */

import type { LoggedWorkout, LoggedSet } from '../types/domain';

/**
 * Estimate one rep maximum using the Epley formula
 *
 * Formula: 1RM = weight * (1 + reps/30)
 *
 * @param weight Weight lifted in kg
 * @param reps Number of repetitions completed
 * @returns Estimated one rep max in kg
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0) return weight;
  const oneRM = weight * (1 + reps / 30);
  return Math.round(oneRM * 10) / 10; // Round to 1 decimal
}

/**
 * Alternative one rep max estimation using Brzycki formula
 * Generally more conservative than Epley
 *
 * Formula: 1RM = weight / (1.0278 - 0.0278 * reps)
 *
 * @param weight Weight lifted in kg
 * @param reps Number of repetitions completed
 * @returns Estimated one rep max in kg
 */
export function estimateOneRepMaxBrzycki(weight: number, reps: number): number {
  if (reps <= 0) return weight;
  const oneRM = weight / (1.0278 - 0.0278 * reps);
  return Math.round(oneRM * 10) / 10;
}

/**
 * Calculate working weight based on RPE and target reps
 *
 * Uses percentage of estimated 1RM based on RPE:
 * RPE 10 (max) = 100% of 1RM
 * RPE 9 = 95% of 1RM
 * RPE 8 = 90% of 1RM
 * RPE 7 = 85% of 1RM
 * RPE 6 = 80% of 1RM
 *
 * @param oneRepMax Estimated one rep maximum
 * @param targetRPE Target RPE (1-10)
 * @param targetReps Target number of reps
 * @returns Recommended working weight in kg
 */
export function calculateWorkingWeight(
  oneRepMax: number,
  targetRPE: number,
  targetReps: number
): number {
  // RPE to percentage mapping
  const rpePercentages: Record<number, number> = {
    10: 1.0,
    9: 0.95,
    8: 0.9,
    7: 0.85,
    6: 0.8,
    5: 0.75,
    4: 0.7,
    3: 0.65,
    2: 0.6,
    1: 0.5,
  };

  const percentage = rpePercentages[Math.round(targetRPE)] || 0.9;
  const workingWeight = oneRepMax * percentage;

  return Math.round(workingWeight * 2) / 2; // Round to nearest 0.5kg
}

/**
 * Calculate training volume for a set
 *
 * Volume = sets × reps × weight
 *
 * @param sets Number of sets
 * @param reps Number of reps per set
 * @param weight Weight lifted in kg
 * @returns Total volume
 */
export function calculateVolume(sets: number, reps: number, weight: number): number {
  return sets * reps * weight;
}

/**
 * Calculate total training load for a workout
 *
 * Load = sets × reps × weight × (RPE/10)
 * Accounts for intensity via RPE
 *
 * @param sets Number of sets
 * @param reps Number of reps per set
 * @param weight Weight lifted in kg
 * @param rpe Rate of perceived exertion (1-10)
 * @returns Training load value
 */
export function calculateTrainingLoad(
  sets: number,
  reps: number,
  weight: number,
  rpe: number
): number {
  const baseVolume = calculateVolume(sets, reps, weight);
  const intensityFactor = Math.min(rpe, 10) / 10; // RPE as percentage
  return Math.round(baseVolume * intensityFactor);
}

/**
 * Format weight with consistent decimal places
 *
 * @param kg Weight in kilograms
 * @param decimals Number of decimal places (default 1)
 * @returns Formatted weight string with unit
 */
export function formatWeight(kg: number, decimals: number = 1): string {
  return `${(Math.round(kg * 10 ** decimals) / 10 ** decimals).toFixed(decimals)}kg`;
}

/**
 * Format sets × reps × weight prescription
 *
 * @param sets Number of sets
 * @param repsMin Minimum reps
 * @param repsMax Maximum reps
 * @param weight Weight in kg (optional)
 * @returns Formatted prescription string
 */
export function formatPrescription(
  sets: number,
  repsMin: number,
  repsMax: number,
  weight?: number
): string {
  const repsStr = repsMin === repsMax ? `${repsMin}` : `${repsMin}-${repsMax}`;
  const baseStr = `${sets} × ${repsStr}`;

  if (weight) {
    return `${baseStr} @ ${formatWeight(weight)}`;
  }
  return baseStr;
}

/**
 * Calculate total weekly volume from logged workouts
 *
 * @param loggedWorkouts Array of logged workouts
 * @returns Total volume for the week
 */
export function getWeeklyVolume(loggedWorkouts: LoggedWorkout[]): number {
  let totalVolume = 0;

  for (const workout of loggedWorkouts) {
    for (const set of workout.sets || []) {
      if (set.actualWeightKg && set.actualReps) {
        totalVolume += calculateVolume(1, set.actualReps, set.actualWeightKg);
      }
    }
  }

  return Math.round(totalVolume);
}

/**
 * Calculate monthly volume from logged workouts
 *
 * @param loggedWorkouts Array of logged workouts
 * @returns Total volume for the month
 */
export function getMonthlyVolume(loggedWorkouts: LoggedWorkout[]): number {
  return getWeeklyVolume(loggedWorkouts); // Can be extended to filter by date
}

/**
 * Calculate training streak (consecutive training days)
 *
 * @param loggedWorkouts Array of logged workouts, ordered by date desc
 * @returns Number of consecutive training days
 */
export function calculateStreak(loggedWorkouts: LoggedWorkout[]): number {
  if (loggedWorkouts.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  // Sort workouts by date in ascending order
  const sorted = [...loggedWorkouts].sort(
    (a, b) => new Date(a.loggedDate).getTime() - new Date(b.loggedDate).getTime()
  );

  // Start from the most recent
  for (let i = sorted.length - 1; i >= 0; i--) {
    const workoutDate = new Date(sorted[i].loggedDate);
    const expectedDate = new Date(today.getTime() - oneDay * (sorted.length - 1 - i));

    // Allow 1 day grace period
    const dayDiff = Math.floor(
      (expectedDate.getTime() - workoutDate.getTime()) / oneDay
    );

    if (dayDiff <= 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate average RPE from a set of workouts
 *
 * @param loggedWorkouts Array of logged workouts
 * @returns Average RPE (1-10)
 */
export function getAverageRPE(loggedWorkouts: LoggedWorkout[]): number {
  let totalRPE = 0;
  let count = 0;

  for (const workout of loggedWorkouts) {
    for (const set of workout.sets || []) {
      if (set.actualRpe) {
        totalRPE += set.actualRpe;
        count++;
      }
    }
  }

  return count > 0 ? Math.round((totalRPE / count) * 10) / 10 : 0;
}

/**
 * Calculate workout completion rate
 *
 * @param loggedWorkouts Array of logged workouts
 * @returns Completion percentage (0-100)
 */
export function getCompletionRate(loggedWorkouts: LoggedWorkout[]): number {
  if (loggedWorkouts.length === 0) return 0;

  const completed = loggedWorkouts.filter((w) => w.completed).length;
  return Math.round((completed / loggedWorkouts.length) * 100);
}

/**
 * Get personal record for an exercise
 *
 * @param loggedWorkouts Array of logged workouts
 * @param exerciseName Name of the exercise
 * @returns Personal record weight and reps
 */
export function getPersonalRecord(
  loggedWorkouts: LoggedWorkout[],
  exerciseName: string
): { weight: number; reps: number; date: string } | null {
  let maxWeight = 0;
  let maxReps = 0;
  let recordDate = '';

  for (const workout of loggedWorkouts) {
    for (const set of workout.sets || []) {
      if (
        set.actualWeightKg &&
        set.actualReps &&
        set.actualWeightKg > maxWeight
      ) {
        maxWeight = set.actualWeightKg;
        maxReps = set.actualReps;
        recordDate = workout.loggedDate;
      }
    }
  }

  if (maxWeight === 0) return null;

  return {
    weight: maxWeight,
    reps: maxReps,
    date: recordDate,
  };
}

/**
 * Calculate estimated 1RM from recent workouts
 * Uses the heaviest weight with reps recorded
 *
 * @param loggedWorkouts Array of logged workouts
 * @param exerciseName Name of the exercise
 * @returns Estimated 1RM in kg
 */
export function estimateCurrentMax(
  loggedWorkouts: LoggedWorkout[],
  exerciseName: string
): number {
  const pr = getPersonalRecord(loggedWorkouts, exerciseName);
  if (!pr) return 0;

  return estimateOneRepMax(pr.weight, pr.reps);
}

/**
 * Calculate body weight estimate from training data
 * (This is a placeholder - in a real app, body weight would be logged separately)
 *
 * @param loggedWorkouts Array of logged workouts
 * @returns Estimated body weight in kg
 */
export function estimateBodyWeight(loggedWorkouts: LoggedWorkout[]): number {
  // In a real implementation, this would use logged body weight metrics
  // For now, return a default
  return 85; // Average AFL player weight
}

/**
 * Calculate relative strength (weight lifted relative to body weight)
 *
 * @param maxWeight Maximum weight lifted
 * @param bodyWeight Body weight in kg
 * @returns Relative strength ratio
 */
export function calculateRelativeStrength(maxWeight: number, bodyWeight: number): number {
  if (bodyWeight === 0) return 0;
  return Math.round((maxWeight / bodyWeight) * 100) / 100;
}

/**
 * Calculate projected max based on current performance trajectory
 * Linear regression of recent workouts
 *
 * @param loggedWorkouts Array of recent logged workouts
 * @param weeksAhead Number of weeks to project (default 4)
 * @returns Projected max weight
 */
export function projectMax(
  loggedWorkouts: LoggedWorkout[],
  weeksAhead: number = 4
): number {
  if (loggedWorkouts.length < 2) {
    const pr = getPersonalRecord(loggedWorkouts, 'All');
    return pr?.weight || 0;
  }

  // Simple linear regression
  const dates = loggedWorkouts.map((w) => new Date(w.loggedDate).getTime());
  const weights = loggedWorkouts.map((w) => {
    const sets = w.sets || [];
    return Math.max(...sets.map((s) => s.actualWeightKg || 0));
  });

  if (weights.every((w) => w === 0)) return 0;

  const n = dates.length;
  const xMean = dates.reduce((a, b) => a + b) / n;
  const yMean = weights.reduce((a, b) => a + b) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (dates[i] - xMean) * (weights[i] - yMean);
    denominator += (dates[i] - xMean) ** 2;
  }

  const slope = numerator / denominator;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const projectedWeight = yMean + slope * (weeksAhead * weekMs);

  return Math.max(0, Math.round(projectedWeight * 10) / 10);
}

/**
 * Calculate training volume trend
 * Returns change in volume over the past N workouts
 *
 * @param loggedWorkouts Array of logged workouts
 * @param windowSize Number of workouts to consider (default 4)
 * @returns Volume change percentage
 */
export function getVolumeTrend(loggedWorkouts: LoggedWorkout[], windowSize: number = 4): number {
  if (loggedWorkouts.length < windowSize) return 0;

  const recent = loggedWorkouts.slice(0, windowSize);
  const previous = loggedWorkouts.slice(windowSize, windowSize * 2);

  const recentVolume = getWeeklyVolume(recent);
  const previousVolume = getWeeklyVolume(previous);

  if (previousVolume === 0) return 0;

  const percentChange = ((recentVolume - previousVolume) / previousVolume) * 100;
  return Math.round(percentChange * 10) / 10;
}

/**
 * Determine training status based on recent performance
 *
 * @param loggedWorkouts Array of logged workouts
 * @returns Status: 'improving', 'stable', 'declining', or 'insufficient_data'
 */
export function getTrainingStatus(
  loggedWorkouts: LoggedWorkout[]
): 'improving' | 'stable' | 'declining' | 'insufficient_data' {
  if (loggedWorkouts.length < 4) return 'insufficient_data';

  const trend = getVolumeTrend(loggedWorkouts, 4);

  if (trend > 5) return 'improving';
  if (trend < -5) return 'declining';
  return 'stable';
}

/**
 * Format time duration (minutes)
 *
 * @param minutes Duration in minutes
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Calculate exercise-specific fatigue index
 * Based on volume and RPE
 *
 * @param sets Number of sets
 * @param reps Number of reps
 * @param rpe Rate of perceived exertion
 * @returns Fatigue index (0-100)
 */
export function calculateFatigueIndex(sets: number, reps: number, rpe: number): number {
  const volumeFactor = Math.min(sets * reps, 100) / 100;
  const intensityFactor = Math.min(rpe, 10) / 10;
  const fatigueIndex = (volumeFactor + intensityFactor) / 2 * 100;

  return Math.round(fatigueIndex);
}

/**
 * Assess if an athlete is overtraining based on volume
 *
 * @param weeklyVolume Total weekly training volume
 * @param bodyWeight Body weight in kg
 * @returns Assessment: 'adequate', 'overtraining', or 'undertraining'
 */
export function assessTrainingVolume(
  weeklyVolume: number,
  bodyWeight: number
): 'adequate' | 'overtraining' | 'undertraining' {
  // Target: 15-30 reps × weight ratio per kg body weight
  const volumePerKg = weeklyVolume / bodyWeight;

  if (volumePerKg < 200) return 'undertraining';
  if (volumePerKg > 500) return 'overtraining';
  return 'adequate';
}
