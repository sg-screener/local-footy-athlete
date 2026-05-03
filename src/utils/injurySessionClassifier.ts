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

function ratingFor(name: string, bucket: InjuryBucket): 'avoid' | 'caution' | 'good' | 'unknown' {
  if (!name) return 'unknown';
  const tag = getExerciseTags(name);
  if (!tag) return 'unknown';
  const r = (tag.injury as any)[bucket];
  if (r === 'avoid') return 'avoid';
  if (r === 'caution') return 'caution';
  return 'good';
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
    const r = ratingFor(ex.exercise?.name || '', bucket);
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

// ─── Replacement map ─────────────────────────────────────────────────
//
// Curated list keyed by bucket → original-exercise → safe substitute.
// Entries are deliberately conservative; a missing key falls back to
// `remove_exercise`. The exercise names match those in EXERCISE_TAGS
// so the resolver / engine can compose tag lookups against them.

const REPLACEMENT_BY_BUCKET: Partial<Record<InjuryBucket, Record<string, string>>> = {
  hamstring: {
    'RDLs': 'Goblet Squat',
    'Single-Leg RDL': 'Goblet Squat',
    'Deadlift': 'Goblet Squat',
    'Conventional Deadlift': 'Goblet Squat',
    'Sumo Deadlift': 'Goblet Squat',
    'Hamstring Curl': 'Goblet Squat',
    'Nordics': 'Goblet Squat',
    'Sprint Intervals': 'Hard Assault Bike Intervals',
    'Hill Sprints': 'Hard Assault Bike Intervals',
    'Quality Sprints': 'Hard Assault Bike Intervals',
    'MAS Training': 'Hard Assault Bike Intervals',
  },
  knee: {
    'Back Squat': 'RDLs',
    'Front Squat': 'RDLs',
    'Walking Lunge': 'Hip Thrust',
    'Reverse Lunge': 'Hip Thrust',
    'Bulgarian Split Squat': 'Hip Thrust',
    'Depth Jumps': 'Goblet Squat',
    'Box Jumps': 'Goblet Squat',
  },
  calf: {
    'Sprint Intervals': 'Assault Bike Intervals',
    'Depth Jumps': 'Wall Sit',
    'Box Jumps': 'Wall Sit',
  },
  ankle: {
    'Sprint Intervals': 'Assault Bike Intervals',
    'Depth Jumps': 'Wall Sit',
    'Box Jumps': 'Wall Sit',
  },
  adductor: {
    'Sprint Intervals': 'Assault Bike Intervals',
    'Walking Lunge': 'Hip Thrust',
  },
  pubalgia: {
    'Sprint Intervals': 'Assault Bike Intervals',
    'RDLs': 'Goblet Squat',
    'Deadlift': 'Goblet Squat',
  },
  shoulder: {
    'Bench Press': 'DB Bench Press',
    'Overhead Press': 'Landmine Press',
    'Pull-Ups': 'Inverted Row',
  },
  elbow: {
    'Bench Press': 'DB Bench Press',
    'Pull-Ups': 'Inverted Row',
  },
  wrist: {
    'Bench Press': 'DB Bench Press',
    'Pull-Ups': 'Inverted Row',
  },
  lowerBack: {
    'Back Squat': 'Goblet Squat',
    'Front Squat': 'Goblet Squat',
    'Deadlift': 'Hip Thrust',
    'Conventional Deadlift': 'Hip Thrust',
    'Sumo Deadlift': 'Hip Thrust',
    'RDLs': 'Single-Leg RDL',
  },
};

/**
 * Curated safe replacement for a risky exercise + bucket. Returns null
 * when no replacement is on file — caller should fall back to
 * remove_exercise for those cases.
 */
export function getReplacementForBucket(
  exerciseName: string,
  bucket: InjuryBucket,
): string | null {
  const map = REPLACEMENT_BY_BUCKET[bucket];
  if (!map) return null;
  // Exact match first.
  if (map[exerciseName]) return map[exerciseName];
  // Case-insensitive fallback for slightly off naming.
  const lower = exerciseName.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
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
