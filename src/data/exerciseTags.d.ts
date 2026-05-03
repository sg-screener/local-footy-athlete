/**
 * Exercise Tags — Structured metadata for tag-based exercise selection.
 *
 * Used by the session builder's filter → score → select pipeline.
 * Each exercise has tags for movement pattern, region, load, fatigue,
 * DOMS, stability, laterality, eccentric demand, late-week suitability,
 * and per-injury-area safety ratings.
 *
 * ADDING EXERCISES:
 *   Append to the EXERCISE_TAGS map. The filter/scorer will pick them up
 *   automatically. Follow the existing tag patterns.
 *
 * INJURY RATINGS:
 *   'good'    = safe, no concern
 *   'caution' = usable but deprioritise / reduce volume
 *   'avoid'   = hard exclude when injury is active
 */
export type MovementPattern = 'squat' | 'lunge' | 'hinge' | 'plyo' | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull' | 'carry' | 'core' | 'isolation_upper' | 'conditioning';
export type Region = 'lower' | 'upper' | 'full' | 'core';
export type LoadLevel = 'low' | 'moderate' | 'high';
export type FatigueLevel = 'low' | 'moderate' | 'high';
export type DomsLevel = 'low' | 'moderate' | 'high';
export type StabilityLevel = 'low' | 'moderate' | 'high';
export type EccentricLevel = 'low' | 'moderate' | 'high';
export type LateWeekRating = 'good' | 'caution' | 'avoid';
export type InjuryRating = 'good' | 'caution' | 'avoid';
export interface InjuryProfile {
    adductor: InjuryRating;
    pubalgia: InjuryRating;
    lowerBack: InjuryRating;
    knee: InjuryRating;
    hamstring: InjuryRating;
    calf: InjuryRating;
    ankle: InjuryRating;
    shoulder: InjuryRating;
    elbow: InjuryRating;
    wrist: InjuryRating;
}
export interface ExerciseTag {
    movement: MovementPattern;
    region: Region;
    load: LoadLevel;
    fatigue: FatigueLevel;
    doms: DomsLevel;
    stability: StabilityLevel;
    unilateral: boolean;
    eccentric: EccentricLevel;
    lateWeek: LateWeekRating;
    power?: boolean;
    injury: InjuryProfile;
}
export type ConditioningTier = 'A' | 'B-high' | 'B-low' | 'C';
export type ConditioningModality = 'run' | 'bike' | 'row' | 'ski' | 'swim' | 'mixed';
export type ConditioningImpact = 'high' | 'low';
export interface ConditioningMeta {
    tier: ConditioningTier;
    modality: ConditioningModality;
    /** high = running (ground contact), low = bike/row/ski/swim */
    impact: ConditioningImpact;
}
/**
 * Conditioning metadata per exercise name.
 * Only conditioning-movement exercises appear here.
 *
 * Tier classification is by SESSION INTENT, not individual modalities:
 *   Tier A = high output, sprint-dominant, high CNS (field sprinting).
 *   Tier B-high = high output (running or machine-based).
 *   Tier B-low = moderate output, lower tissue cost.
 *   Tier C = recovery / flush.
 *
 * Mixed-modality sessions (Flog Friday, MetCon) are classified by intent.
 * Modality field is used only for injury compatibility routing.
 */
export declare const CONDITIONING_META: Record<string, ConditioningMeta>;
export declare const EXERCISE_TAGS: Record<string, ExerciseTag>;
/** Get tags for an exercise. Returns undefined if not tagged. */
export declare function getExerciseTags(name: string): ExerciseTag | undefined;
/** Get all tagged exercise names. */
export declare function getAllTaggedExercises(): string[];
/** Get all exercises matching a movement pattern. */
export declare function getByMovement(movement: MovementPattern): string[];
/** Get all exercises matching a region. */
export declare function getByRegion(region: Region): string[];
/** Get conditioning metadata for an exercise. Returns undefined if not a conditioning exercise. */
export declare function getConditioningMeta(name: string): ConditioningMeta | undefined;
/** Get all conditioning exercises for a given tier. */
export declare function getConditioningByTier(tier: ConditioningTier): string[];
