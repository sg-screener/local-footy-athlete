/**
 * injurySessionClassifier.ts — session-level risk classification +
 * targeted exercise replacement for the injury-aware pipeline.
 *
 * Why this layer exists
 *   Per-exercise filtering is too granular: removing a single risky
 *   movement from a session that's "mostly risky" still leaves a
 *   session that targets the injured area. The athlete sees almost no
 *   change. Session-level reasoning lets the engine + resolver decide
 *   whether to leave a session alone (LOW), surgically modify
 *   (MODERATE), or rebuild it entirely with safe alternatives (HIGH).
 *
 * Three concerns:
 *   1. classifySessionRisk(workout, bucket) — HIGH / MODERATE / LOW
 *   2. getReplacementForBucket(name, bucket) — safe substitution
 *      (returns null when no curated replacement exists)
 *   3. summariseRebuild(workout, bucket) — short note for the rebuild
 *      coachNote (e.g. "quad-dominant focus")
 *
 * Pure functions. Tested in isolation. Used by both the engine
 * (programAdjustmentEngine) and the resolver filter
 * (injuryWorkoutFilter) so current-week and future-week behaviour
 * agree.
 */

import type { Workout } from '../types/domain';
import { getExerciseTags, getConditioningMeta } from '../data/exerciseTags';
import type { InjuryBucket } from './programAdjustmentEngine';
import { injurySeverityPausesAffectedTraining } from '../rules/injurySeverityBands';
import { classifyExerciseRiskForBucket } from '../rules/injuryExerciseRisk';
import {
  compareSafeTrainingFallbackTiers,
  type SafeTrainingFallbackTier,
} from '../rules/conflictResolutionHierarchy';

// ─── Risk class ─────────────────────────────────────────────────────

export type SessionRisk = 'HIGH' | 'MODERATE' | 'LOW';

const LOWER_BUCKETS = new Set<InjuryBucket>([
  'hamstring', 'knee', 'calf', 'ankle', 'adductor', 'pubalgia',
]);

function isRecovery(workout: Workout): boolean {
  const wt = (workout as any).workoutType;
  if (wt === 'Recovery') return true;
  const tier = (workout as any).sessionTier;
  if (tier === 'recovery') return true;
  return /\brecovery\b/i.test(workout.name || '');
}

function isTeamTraining(workout: Workout): boolean {
  const n = (workout.name || '').trim().toLowerCase();
  return (
    n === 'team training' ||
    /^team training\s*\+/.test(n) ||
    /\+\s*team training$/.test(n)
  );
}

function isRunningCond(workout: Workout): boolean {
  const wt = (workout as any).workoutType;
  if (wt !== 'Conditioning') return false;
  const exercises = workout.exercises ?? [];
  for (const ex of exercises) {
    const meta = getConditioningMeta(ex.exercise?.name || '');
    if (meta && (meta.modality === 'run' || meta.impact === 'high')) return true;
  }
  return /sprint|run|interval|mas\b|km/i.test(workout.name || '');
}

/**
 * Classify how risky a session is for a given injury bucket.
 *
 *   LOW       — recovery, empty, or no risky exercises / not region-relevant
 *   MODERATE  — some risky work but mixed (no single dominant pattern)
 *   HIGH      — session is dominated by risk:
 *                 - sprint/team-training day for a lower-limb injury, OR
 *                 - ≥1 'avoid'-rated exercise AND ≥50% of exercises risky
 *
 * The HIGH threshold deliberately requires an 'avoid'-rated exercise
 * (not just multiple cautions). A 100%-caution session is still
 * MODERATE — the engine can fix it with surgical removals + replacements
 * rather than a wholesale rebuild.
 */
export function classifySessionRisk(workout: Workout, bucket: InjuryBucket): SessionRisk {
  if (isRecovery(workout)) return 'LOW';

  const exercises = workout.exercises ?? [];

  // Sprint conditioning + team training sessions are always HIGH for
  // lower-limb buckets — the exposure (running/sprinting) doesn't live
  // in the exercise list, but it dominates the session's training load.
  if (LOWER_BUCKETS.has(bucket) && (isRunningCond(workout) || isTeamTraining(workout))) {
    return 'HIGH';
  }

  if (exercises.length === 0) return 'LOW';

  let avoidCount = 0;
  let cautionCount = 0;
  for (const ex of exercises) {
    const r = classifyExerciseRiskForBucket(ex.exercise?.name || '', bucket);
    if (r === 'avoid') avoidCount++;
    else if (r === 'caution') cautionCount++;
  }

  const riskCount = avoidCount + cautionCount;
  if (riskCount === 0) return 'LOW';
  const riskShare = riskCount / exercises.length;

  // HIGH: ≥1 avoid and ≥50% risky.
  if (avoidCount >= 1 && riskShare >= 0.5) return 'HIGH';
  return 'MODERATE';
}

// ─── Replacement hierarchy ───────────────────────────────────────────
//
// Bible order:
//   1. same movement pattern if safe
//   2. similar muscle group
//   3. unaffected body area
//   4. recovery / easy conditioning
//   5. removal/rest only when no safe useful work remains
//
// The candidates below are ordered in that hierarchy. We still validate
// every candidate against the injury tags before returning it, so a
// nominally-similar swap that is still risky gets skipped.

export type SubstitutionHierarchyTier = Exclude<SafeTrainingFallbackTier, 'rest'>;

export interface InjuryReplacementChoice {
  name: string;
  hierarchyTier: SubstitutionHierarchyTier;
}

interface ReplacementCandidate extends InjuryReplacementChoice {
  /** Optional alias used when tests/AI wording differs from tag names. */
  aliases?: string[];
}

const REPLACEMENT_BY_BUCKET: Partial<Record<InjuryBucket, Record<string, ReplacementCandidate[]>>> = {
  hamstring: {
    'RDLs': [
      { name: 'Single-Leg RDL', hierarchyTier: 'same_movement_pattern' },
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Single-Leg RDL': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Deadlift': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Conventional Deadlift': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Sumo Deadlift': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Hamstring Curl': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Nordic Lower': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group', aliases: ['Nordics', 'Nordic Hamstring Curl'] },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Sprint Intervals': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Hill Sprints': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Quality Sprints': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'MAS Training': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  knee: {
    'Back Squat': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Front Squat': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Walking Lunges': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group', aliases: ['Walking Lunge'] },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Reverse Lunges': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group', aliases: ['Reverse Lunge'] },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Bulgarian Split Squats': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group', aliases: ['Bulgarian Split Squat'] },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Depth Jumps': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Box Jumps': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  calf: {
    'Sprint Intervals': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Depth Jumps': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Box Jumps': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  ankle: {
    'Sprint Intervals': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Depth Jumps': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Box Jumps': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  adductor: {
    'Sprint Intervals': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Walking Lunges': [
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group', aliases: ['Walking Lunge'] },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  pubalgia: {
    'Sprint Intervals': [
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'RDLs': [
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Deadlift': [
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  shoulder: {
    'Bench Press': [
      { name: 'DB Bench Press', hierarchyTier: 'same_movement_pattern' },
      { name: 'Landmine Press', hierarchyTier: 'similar_muscle_group' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Overhead Press': [
      { name: 'Landmine Press', hierarchyTier: 'same_movement_pattern' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Pull-Ups': [
      { name: 'Neutral-Grip Pulldown', hierarchyTier: 'same_movement_pattern' },
      { name: 'Chest Supported Row', hierarchyTier: 'similar_muscle_group' },
      { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  elbow: {
    'Bench Press': [
      { name: 'DB Bench Press', hierarchyTier: 'same_movement_pattern' },
      { name: 'Landmine Press', hierarchyTier: 'similar_muscle_group' },
      { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Pull-Ups': [
      { name: 'Neutral-Grip Pulldown', hierarchyTier: 'same_movement_pattern' },
      { name: 'Chest Supported Row', hierarchyTier: 'similar_muscle_group' },
      { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  wrist: {
    'Bench Press': [
      { name: 'DB Bench Press', hierarchyTier: 'same_movement_pattern' },
      { name: 'Landmine Press', hierarchyTier: 'similar_muscle_group' },
      { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Pull-Ups': [
      { name: 'Neutral-Grip Pulldown', hierarchyTier: 'same_movement_pattern' },
      { name: 'Chest Supported Row', hierarchyTier: 'similar_muscle_group' },
      { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
  lowerBack: {
    'Back Squat': [
      { name: 'Goblet Squat', hierarchyTier: 'same_movement_pattern' },
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Front Squat': [
      { name: 'Goblet Squat', hierarchyTier: 'same_movement_pattern' },
      { name: 'Hip Thrusts', hierarchyTier: 'similar_muscle_group' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Deadlift': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Conventional Deadlift': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'Sumo Deadlift': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
    'RDLs': [
      { name: 'Hip Thrusts', hierarchyTier: 'same_movement_pattern' },
      { name: 'Goblet Squat', hierarchyTier: 'similar_muscle_group' },
      { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
      { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
    ],
  },
};

const GENERIC_SAFE_BY_BUCKET: Partial<Record<InjuryBucket, ReplacementCandidate[]>> = {
  hamstring: [
    { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  knee: [
    { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  calf: [
    { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  ankle: [
    { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  adductor: [
    { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  pubalgia: [
    { name: 'Bench Press', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  shoulder: [
    { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  elbow: [
    { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  wrist: [
    { name: 'Goblet Squat', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
  lowerBack: [
    { name: 'Chest Supported Row', hierarchyTier: 'unaffected_body_area' },
    { name: 'Easy Bike', hierarchyTier: 'recovery_easy_conditioning' },
  ],
};

function matchesCandidateKey(raw: string, key: string, candidates: ReplacementCandidate[]): boolean {
  const name = raw.toLowerCase();
  if (key.toLowerCase() === name) return true;
  return candidates.some((candidate) =>
    (candidate.aliases ?? []).some((alias) => alias.toLowerCase() === name));
}

function candidateIsAllowedBySeverity(
  candidate: ReplacementCandidate,
  severity: number,
): boolean {
  if (!injurySeverityPausesAffectedTraining(severity)) return true;
  return candidate.hierarchyTier === 'unaffected_body_area' ||
    candidate.hierarchyTier === 'recovery_easy_conditioning';
}

function isSafeCandidate(candidate: ReplacementCandidate, bucket: InjuryBucket): boolean {
  const tag = getExerciseTags(candidate.name);
  if (!tag) return false;
  return (tag.injury as any)[bucket] === 'good';
}

function candidatesForExercise(
  exerciseName: string,
  bucket: InjuryBucket,
): ReplacementCandidate[] {
  const bucketMap = REPLACEMENT_BY_BUCKET[bucket];
  if (bucketMap) {
    for (const [key, candidates] of Object.entries(bucketMap)) {
      if (matchesCandidateKey(exerciseName, key, candidates)) {
        return candidates;
      }
    }
  }
  return GENERIC_SAFE_BY_BUCKET[bucket] ?? [];
}

/**
 * Curated safe replacement for a risky exercise + bucket. Returns null
 * when no replacement is on file — caller should fall back to
 * remove_exercise for those cases.
 */
export function getReplacementForBucket(
  exerciseName: string,
  bucket: InjuryBucket,
  severity: number = 6,
  avoidNames: readonly string[] = [],
): string | null {
  return getReplacementChoiceForBucket(exerciseName, bucket, severity, avoidNames)?.name ?? null;
}

/**
 * Return every safe curated choice in Bible hierarchy order.
 *
 * Resolver/generation callers normally need only the first choice, while
 * tap surfaces need the ordered ladder so they can apply equipment and
 * readiness filters without recreating the injury substitution table.
 */
export function getReplacementChoicesForBucket(
  exerciseName: string,
  bucket: InjuryBucket,
  severity: number = 6,
  avoidNames: readonly string[] = [],
): InjuryReplacementChoice[] {
  const avoided = new Set(avoidNames.map((name) => name.toLowerCase()));
  const seen = new Set<string>();
  const choices: InjuryReplacementChoice[] = [];
  for (const candidate of candidatesForExercise(exerciseName, bucket)) {
    const key = candidate.name.toLowerCase();
    if (avoided.has(key) || seen.has(key)) continue;
    if (!candidateIsAllowedBySeverity(candidate, severity)) continue;
    if (!isSafeCandidate(candidate, bucket)) continue;
    seen.add(key);
    choices.push({
      name: candidate.name,
      hierarchyTier: candidate.hierarchyTier,
    });
  }
  return choices.sort((left, right) =>
    compareSafeTrainingFallbackTiers(left.hierarchyTier, right.hierarchyTier));
}

export function getReplacementChoiceForBucket(
  exerciseName: string,
  bucket: InjuryBucket,
  severity: number = 6,
  avoidNames: readonly string[] = [],
): InjuryReplacementChoice | null {
  return getReplacementChoicesForBucket(
    exerciseName,
    bucket,
    severity,
    avoidNames,
  )[0] ?? null;
}

/**
 * Short prose for the "Rebuilt for ..." coachNote attached to HIGH-risk
 * sessions. Per-bucket so the athlete sees the rebuild rationale on the
 * Program tab.
 */
const REBUILD_HINT: Partial<Record<InjuryBucket, string>> = {
  hamstring: 'quad-dominant focus, no hinge or sprint exposure',
  knee: 'hinge-dominant focus, no plyo or heavy knee load',
  calf: 'low-impact: no sprinting or plyos',
  ankle: 'controlled bilateral work, no cutting',
  adductor: 'no cutting or adductor-heavy work',
  pubalgia: 'no cutting, kicking, or heavy hinges',
  shoulder: 'lighter pressing, machine / iso alternatives',
  elbow: 'machine / iso upper alternatives',
  wrist: 'reduced grip load',
  lowerBack: 'no axial load, machine / supported work',
};

export function summariseRebuild(bucket: InjuryBucket): string {
  return REBUILD_HINT[bucket] ?? 'safe alternatives substituted';
}
