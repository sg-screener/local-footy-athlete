/**
 * Load Estimation — Intelligent starting weight defaults.
 *
 * Converts onboarding strength data (categorical squat/bench levels + bodyweight)
 * into credible starting weights for every exercise in the system.
 *
 * DESIGN:
 *   1. Convert categorical strength levels → estimated 1RM (kg)
 *   2. Map each exercise to an anchor lift (squat or bench) + working ratio
 *   3. Return a sensible working weight for the exercise's typical rep range
 *   4. Explicitly classify truly-bodyweight exercises (BW is the exception, not default)
 *
 * The ratios are NOT 1RM percentages — they're "what would a real athlete load
 * for this exercise given their anchor 1RM". They bake in the rep-range discount
 * so the output is a direct working weight, not a 1RM.
 *
 * ROUNDING:
 *   - Barbell exercises: 2.5 kg increments
 *   - Dumbbell exercises: 2.5 kg increments (per hand)
 *   - Cable/machine exercises: 5 kg increments
 *
 * ADDING EXERCISES:
 *   Append to EXERCISE_LOAD_MAP. The system falls back to a heuristic
 *   for unknown exercises (using exercise tags if available).
 */
import type { OnboardingData } from '../types/domain';
export interface AnchorEstimates {
    bodyweightKg: number;
    squat1RM: number;
    bench1RM: number;
}
/**
 * Derive numeric 1RM estimates from onboarding data.
 * Returns conservative estimates — starting too light is always better than too heavy.
 */
export declare function estimateAnchors(data: OnboardingData): AnchorEstimates;
export type LoadAnchor = 'squat' | 'bench';
export type EquipmentClass = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell';
export interface ExerciseLoadProfile {
    /** Which anchor 1RM to derive from */
    anchor: LoadAnchor;
    /** Fraction of anchor 1RM → working weight (NOT a 1RM percentage) */
    ratio: number;
    /** Equipment type — determines rounding increment */
    equipment: EquipmentClass;
}
/**
 * Exercises that are genuinely bodyweight-based.
 * These should show "BW" in the UI. Everything else gets a load estimate.
 */
export declare const TRUE_BODYWEIGHT_EXERCISES: Set<string>;
/**
 * Map exercise names to their load profile.
 *
 * Ratio interpretation:
 *   If anchor 1RM = 120kg and ratio = 0.25, working weight = 30kg.
 *   This is the weight the athlete would actually load for the exercise's
 *   typical rep range (e.g. 3×8-12 for accessories).
 *
 * Dumbbell ratios are PER HAND.
 */
export declare const EXERCISE_LOAD_MAP: Record<string, ExerciseLoadProfile>;
/**
 * Resolve an exercise name to its canonical form.
 * Tries: exact match → alias lookup → lowercase alias lookup.
 * Returns the original name if no match found.
 */
export declare function resolveExerciseName(name: string): string;
/** Round a weight to the nearest equipment-appropriate increment. */
export declare function roundToEquipment(weight: number, equipment: EquipmentClass): number;
/**
 * Estimate a starting working weight for a named exercise.
 *
 * Resolution order:
 *   1. Resolve name aliases (AI phrasing → canonical name)
 *   2. Check true bodyweight set → null
 *   3. Check prehab/no-load set → null
 *   4. Look up EXERCISE_LOAD_MAP → calculated weight
 *   5. Fall back to tag-based heuristic
 *
 * @returns weight in kg, or null if the exercise is genuinely bodyweight / unloaded.
 */
export declare function estimateStartingWeight(exerciseName: string, onboardingData: OnboardingData): number | null;
/**
 * Check if an exercise is genuinely bodyweight-based.
 * Uses name resolution → explicit BW set → prehab set → tag fallback.
 */
export declare function isTrueBodyweightExercise(exerciseName: string): boolean;
/**
 * Apply load estimates to an array of workout exercises.
 * Fills in weight for any exercise that has weight=0 or undefined
 * and is NOT a true bodyweight exercise.
 *
 * Priority order for each exercise:
 *   1. lastPerformedWeights (athlete's actual history) — best signal
 *   2. Existing template weight (if > 0) — keep it
 *   3. Onboarding-derived estimate — intelligent default
 *   4. Leave as-is (true BW / prehab / unknown)
 *
 * Pure function — returns a new array without mutating the input.
 *
 * @param exercises         - Exercises to process
 * @param onboardingData    - Athlete profile for estimation
 * @param lastPerformedWeights - Optional map of exerciseId → last performed weight.
 *                               Prioritised over estimates when available.
 */
export declare function applyLoadEstimates(exercises: import('../types/domain').WorkoutExercise[], onboardingData: OnboardingData, lastPerformedWeights?: Record<string, number | null>): import('../types/domain').WorkoutExercise[];
