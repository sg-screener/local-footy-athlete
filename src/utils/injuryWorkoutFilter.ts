/**
 * injuryWorkoutFilter.ts
 *
 * The resolver-level injury filter. Given a workout and the active
 * injury state, returns a NEW workout with the appropriate
 * modifications applied for that severity tier.
 *
 *   severe / strict — remove tagged risky exercises + coachNotes
 *   relaxed         — coachNotes only ("limited sprinting", "light hinge")
 *   light           — single advisory note
 *   none            — pass-through (template stands)
 *
 * Pure function. The workout passed in is treated as immutable; the
 * caller (resolveDate) substitutes the returned object before handing
 * the ResolvedDay back to the UI.
 *
 * IMPORTANT — relationship to applyAdjustmentEvents:
 *   - applyAdjustmentEvents writes COMMITTED state to dateOverrides.
 *     It records "what coach changed" for a specific date.
 *   - applyInjuryFilterToWorkout is RESOLVER-time. It runs every render
 *     and modifies the template before display. It does NOT write to
 *     the store. Future weeks (which have no overrides yet) reflect
 *     the injury automatically through this filter.
 *
 *   The resolver should only apply this filter when source !== 'manual'.
 *   Manual overrides ARE the source of truth for that date — the
 *   filter would double-mutate them.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { getExerciseTags } from '../data/exerciseTags';
import {
  severityToTier,
  tierIsActive,
  tierRemovesExercises,
  type RestrictionTier,
} from './injuryProgression';

/** Loose shape — matches what ScheduleState surfaces. */
export interface ActiveInjuryLike {
  bodyPart: string;
  bucket: string | null;
  severity: number;
  status: 'active' | 'improving' | 'resolved';
}

/** Per-bucket tier-aware notes for the resolver-level filter. */
const BUCKET_TIER_NOTES: Record<
  string,
  { strict: string; relaxed: string; light: string }
> = {
  hamstring: {
    strict: 'no sprinting / no high-speed running',
    relaxed: 'limited sprinting (50-60%) - light hinge work OK with reduced load',
    light: 'build sprint volume back gradually',
  },
  knee: {
    strict: 'no sprinting / no cutting / no plyos',
    relaxed: 'limited sprinting + cutting; light squats only',
    light: 'rebuild plyo + sprint volume gradually',
  },
  calf: {
    strict: 'no sprinting / no plyo work',
    relaxed: 'limited sprinting; light plyos OK',
    light: 'build sprint + plyo volume gradually',
  },
  ankle: {
    strict: 'no sprinting / no cutting / no plyos',
    relaxed: 'limited cutting / change-of-direction; controlled drills only',
    light: 'rebuild change-of-direction work gradually',
  },
  adductor: {
    strict: 'no cutting / no sprinting',
    relaxed: 'limited cutting; controlled lateral work only',
    light: 'rebuild lateral work gradually',
  },
  pubalgia: {
    strict: 'no cutting / no kicking',
    relaxed: 'limited cutting / kicking - controlled work only',
    light: 'rebuild kicking + cutting gradually',
  },
  shoulder: {
    strict: 'no contact drills / no overhead throwing',
    relaxed: 'limited pressing - moderate load OK',
    light: 'build pressing load back gradually',
  },
  elbow: {
    strict: 'no heavy contact drills',
    relaxed: 'limited heavy upper work',
    light: 'rebuild upper load gradually',
  },
  wrist: {
    strict: 'no contact drills',
    relaxed: 'limited grip-loaded work',
    light: 'rebuild grip work gradually',
  },
  lowerBack: {
    strict: 'no heavy contact / no high-load tackle drills',
    relaxed: 'limited axial load - light hinge OK',
    light: 'rebuild loaded hinge gradually',
  },
};

const LOWER_BUCKETS = new Set([
  'hamstring', 'knee', 'calf', 'ankle', 'adductor', 'pubalgia',
]);
const UPPER_BUCKETS = new Set(['shoulder', 'elbow', 'wrist']);

function getTierNote(bucket: string | null, tier: RestrictionTier): string | null {
  if (!bucket) return null;
  const map = BUCKET_TIER_NOTES[bucket];
  if (!map) return null;
  if (tier === 'strict' || tier === 'severe') return map.strict;
  if (tier === 'relaxed') return map.relaxed;
  if (tier === 'light') return map.light;
  return null;
}

/**
 * Classify an exercise against a bucket. Wraps `getExerciseTags`
 * defensively — if the exercise isn't tagged, treat it as 'unknown'
 * (i.e. don't act on it).
 */
function classifyExerciseForBucket(name: string, bucket: string): 'avoid' | 'caution' | 'good' | 'unknown' {
  if (!name) return 'unknown';
  const tag = getExerciseTags(name);
  if (!tag) return 'unknown';
  const rating = (tag.injury as any)[bucket];
  if (rating === 'avoid') return 'avoid';
  if (rating === 'caution') return 'caution';
  return 'good';
}

function isTeamTrainingName(name: string): boolean {
  const n = (name || '').trim().toLowerCase();
  return (
    n === 'team training' ||
    /^team training\s*\+/.test(n) ||
    /\+\s*team training$/.test(n)
  );
}

function appendNoteUnique(notes: string[] | undefined, n: string): string[] {
  const existing = notes ?? [];
  if (existing.includes(n)) return existing;
  return [...existing, n];
}

/**
 * Apply the tier-aware injury filter to a workout. Returns a NEW
 * Workout with modifications. The original is untouched.
 *
 * The filter is a no-op when:
 *   - injury.status === 'resolved' (the loop already cleared)
 *   - severity → tier === 'none'
 *   - bucket is unknown / unmapped
 *   - workoutType === 'Recovery' (recovery is the lightest session;
 *     never modify)
 *   - workoutType === 'Game' (game day stub)
 */
export function applyInjuryFilterToWorkout(
  workout: Workout,
  injury: ActiveInjuryLike | null | undefined,
): Workout {
  if (!injury) return workout;
  if (injury.status === 'resolved') return workout;
  const tier = severityToTier(injury.severity);
  if (!tierIsActive(tier)) return workout;
  if (!injury.bucket) return workout;

  const wt = (workout as any).workoutType;
  if (wt === 'Recovery' || wt === 'Game') return workout;
  const tier2 = (workout as any).sessionTier;
  if (tier2 === 'recovery') return workout;

  const bucket = injury.bucket;
  const isLowerLimb = LOWER_BUCKETS.has(bucket);
  const isUpperLimb = UPPER_BUCKETS.has(bucket);
  const tierNote = getTierNote(bucket, tier);

  // Decide relevance — only modify sessions that actually expose the
  // injured area. Otherwise the filter is a no-op.
  const exercises: WorkoutExercise[] = workout.exercises ?? [];
  const isTeam = isTeamTrainingName(workout.name);
  const hasRiskyExercise = exercises.some((ex) => {
    const r = classifyExerciseForBucket((ex.exercise?.name || ''), bucket);
    return r === 'avoid' || r === 'caution';
  });
  const isRunningCond = wt === 'Conditioning';

  const isRelevant =
    hasRiskyExercise ||
    (isLowerLimb && (isTeam || isRunningCond)) ||
    (isUpperLimb && exercises.some((ex) => {
      const tag = getExerciseTags(ex.exercise?.name || '');
      return tag && (tag.region === 'upper' || tag.region === 'full');
    }));

  if (!isRelevant) return workout;

  // Session-level classification — drives whether to rebuild (HIGH)
  // or surgically modify (MODERATE) at strict/severe tiers. Relaxed/
  // light skip exercise mutation entirely (notes only).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { classifySessionRisk, getReplacementForBucket, summariseRebuild } =
    require('./injurySessionClassifier');
  const sessionRisk = classifySessionRisk(workout, bucket as any) as
    | 'HIGH' | 'MODERATE' | 'LOW';

  let filteredExercises = exercises;
  const removedNames: string[] = [];
  const replacements: Array<{ from: string; to: string }> = [];

  if (tierRemovesExercises(tier) && sessionRisk !== 'LOW') {
    const removeCaution = injury.severity >= 6;
    filteredExercises = exercises.map((ex) => {
      const name = ex.exercise?.name || '';
      const r = classifyExerciseForBucket(name, bucket);
      const isRisky =
        r === 'avoid' || (removeCaution && r === 'caution');
      if (!isRisky) return ex;

      // Prefer a curated replacement; fall back to removal when none.
      const replacement = getReplacementForBucket(name, bucket);
      if (replacement) {
        replacements.push({ from: name, to: replacement });
        return ex.exercise
          ? { ...ex, exercise: { ...ex.exercise, name: replacement, description: replacement } }
          : ex;
      }
      removedNames.push(name);
      return null as any;
    }).filter((ex) => ex !== null) as typeof exercises;
  }

  // Build the coachNotes list — preserve any pre-existing entries (e.g.
  // from a same-week override that we might be filtering on top of)
  // and append the tier note + per-modification entries + rebuild
  // summary on HIGH-risk sessions.
  let coachNotes = workout.coachNotes ? [...workout.coachNotes] : [];
  if (tierNote) coachNotes = appendNoteUnique(coachNotes, tierNote);
  for (const n of removedNames) {
    coachNotes = appendNoteUnique(coachNotes, `Removed: ${n}`);
  }
  for (const r of replacements) {
    coachNotes = appendNoteUnique(coachNotes, `Replaced ${r.from} with ${r.to}`);
  }
  if (
    sessionRisk === 'HIGH' &&
    tierRemovesExercises(tier) &&
    (replacements.length > 0 || removedNames.length > 0)
  ) {
    coachNotes = appendNoteUnique(
      coachNotes,
      `Rebuilt for ${bucket} - ${summariseRebuild(bucket)}`,
    );
  }

  // No actual changes? Pass-through (avoid creating churn).
  const mutated = removedNames.length > 0 || replacements.length > 0;
  const notesGrew = coachNotes.length > (workout.coachNotes?.length ?? 0);
  if (!mutated && !notesGrew) return workout;

  return {
    ...workout,
    exercises: filteredExercises,
    coachNotes,
  };
}
