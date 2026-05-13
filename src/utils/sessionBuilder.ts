/**
 * Session Builder — Adaptive Derived Session Content
 *
 * Pure functions. No React. No Zustand. No AI calls.
 *
 * The resolver (sessionResolver.ts) decides WHAT KIND of session a date
 * needs (recovery, arms_pump, prehab). This builder decides WHAT EXERCISES
 * go in that session, based on:
 *   - athlete injuries → exclude unsafe exercises
 *   - athlete equipment → only use what's available
 *   - date → deterministic variety (different dates pick different exercises)
 *   - session constraints → fatigue budget, exercise count
 *
 * DETERMINISTIC VARIETY:
 *   Uses a simple date-based hash to rotate through available exercises.
 *   Same date always produces the same workout (no randomness), but
 *   Monday's recovery ≠ Thursday's recovery if both appear in a week.
 *
 * PERFORMANCE:
 *   Pool filtering + selection is a few array ops. Trivially fast.
 *   No network calls, no async, no caching needed.
 */

import type {
  Workout,
  WorkoutExercise,
  Exercise,
  OnboardingInjury,
  IntensityLevel,
  WorkoutType,
  SessionTier,
} from '../types/domain';
import {
  POOL_REGISTRY,
  type PoolExercise,
  type ExerciseCategory,
  type EquipmentTag,
  type InjuryTag,
} from '../data/exercisePools';
import { getAllTaggedExercises, EXERCISE_TAGS, CONDITIONING_META } from '../data/exerciseTags';
import { applyHardFilters, buildFilterContext, type FilterContext } from './exerciseFilter';
import { selectExercises, buildIntent, findSubstitute } from './exerciseScorer';
import { applyLoadEstimates } from './loadEstimation';
import { MAS_FALLBACK_NOTE, masIntensityLabel } from './masCopy';

// ─── Athlete Context ───

export interface AthleteContext {
  /** Injury list from onboarding. */
  injuries: OnboardingInjury[];
  /** Equipment tags the athlete has access to. */
  equipmentTags: EquipmentTag[];
  /** Training location for equipment inference. */
  trainingLocation: string;
  /** Full onboarding data — used for load estimation (strength levels, bodyweight). */
  onboardingData?: import('../types/domain').OnboardingData;
}

/** Default context when no profile data is available. */
export const DEFAULT_ATHLETE_CONTEXT: AthleteContext = {
  injuries: [],
  equipmentTags: ['bodyweight', 'dumbbells', 'cables', 'bands', 'bench', 'foam_roller', 'bike_or_treadmill', 'machine'],
  trainingLocation: 'Commercial gym',
};

// ─── Derived Session Types ───

export type DerivedSessionType =
  | 'recovery'
  | 'passive_recovery'
  | 'extended_recovery'
  | 'prehab_accessories'
  | 'arms_pump';

// ─── Session Slot Definitions ───
// Each session type is a sequence of "slots" — pick N exercises from a category.

interface SessionSlot {
  category: ExerciseCategory;
  /** How many exercises to pick from this category. */
  count: number;
}

const SESSION_SLOTS: Record<DerivedSessionType, SessionSlot[]> = {
  recovery: [
    { category: 'tissue_quality',   count: 2 },
    { category: 'mobility',         count: 2 },
    { category: 'easy_cardio',      count: 1 }, // Zone 1 / conversational pace only. No intervals or intensity.
    { category: 'breathing_reset',  count: 1 },
  ],
  passive_recovery: [
    { category: 'tissue_quality',   count: 2 },
    { category: 'breathing_reset',  count: 1 },
  ],
  extended_recovery: [
    // Active recovery base + low-load trunk / prehab.
    // GUARDRAIL: All components must be fatigue: low, doms: low.
    // This is NOT training volume. No progressive overload.
    { category: 'tissue_quality',      count: 1 },
    { category: 'mobility',            count: 2 },
    { category: 'easy_cardio',         count: 1 }, // Zone 1 / conversational pace only.
    { category: 'trunk_anti_rotation', count: 1 },
    { category: 'hamstring_light',     count: 1 },
    { category: 'lower_prehab',        count: 1 }, // Tib raises / ankle work — appropriate in recovery context
    { category: 'breathing_reset',     count: 1 },
  ],
  prehab_accessories: [
    { category: 'trunk_anti_rotation', count: 1 },
    { category: 'groin_adductors',     count: 1 },
    { category: 'shoulder_health',     count: 1 },
    { category: 'calves',             count: 1 },  // General calf work; lower_prehab (tib raises) reserved for lower/recovery sessions
    { category: 'hamstring_light',     count: 1 },
  ],
  arms_pump: [
    { category: 'biceps',           count: 2 },
    { category: 'triceps',          count: 2 },
    { category: 'delts',            count: 1 },
    { category: 'upper_back_pump',  count: 1 },
  ],
};

const SESSION_META: Record<DerivedSessionType, {
  name: string;
  workoutType: WorkoutType;
  sessionTier: SessionTier;
  durationMinutes: number;
  intensity: IntensityLevel;
  descriptionSuffix: string;
}> = {
  // Recovery sessions reduce fatigue — they never add to it.
  // Active Recovery = tissue quality + mobility + easy cyclical + breathing.
  // Extended Recovery (future) adds low-fatigue trunk + light prehab.
  //
  // IMPORTANT — Extended Recovery guardrails:
  //   Extended Recovery is a low-load capacity / prehab session, NOT
  //   additional training volume. It must remain fatigue: low, doms: low,
  //   with no progressive overload intent. All components must pass the
  //   same hard filter as recovery: no moderate+ fatigue, no moderate+
  //   doms, no moderate+ load, no moderate+ eccentric.
  //   Not allowed: within 48h of game, day after Tier A/B-high, or
  //   when readiness is low.
  recovery: {
    name: 'Recovery Session',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    durationMinutes: 30,
    intensity: 'Light',
    descriptionSuffix: 'flush, mobilise, restore',
  },
  passive_recovery: {
    name: 'Passive Recovery',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    durationMinutes: 15,
    intensity: 'Light',
    descriptionSuffix: 'tissue quality, breathing reset',
  },
  extended_recovery: {
    name: 'Extended Recovery',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    durationMinutes: 40,
    intensity: 'Light',
    descriptionSuffix: 'recovery and light prehab',
  },
  prehab_accessories: {
    name: 'Prehab & Accessories',
    workoutType: 'Strength',
    sessionTier: 'optional',
    durationMinutes: 35,
    intensity: 'Light',
    descriptionSuffix: 'injury prevention and accessory work',
  },
  arms_pump: {
    // Athlete-facing name; derivedType key ('arms_pump') is unchanged so
    // builder/scorer wiring stays intact. Renamed 2026-04-22 for tone.
    name: 'Gunshow',
    workoutType: 'Strength',
    sessionTier: 'optional',
    durationMinutes: 35,
    intensity: 'Light',
    descriptionSuffix: 'light upper body pump work',
  },
};

// ─── Injury Mapping ───
// Maps onboarding bodyArea strings to our InjuryTag system.

const INJURY_BODY_AREA_MAP: Record<string, InjuryTag[]> = {
  'shoulder':     ['shoulder'],
  'shoulders':    ['shoulder'],
  'knee':         ['knee'],
  'knees':        ['knee'],
  'ankle':        ['ankle'],
  'ankles':       ['ankle'],
  'lower back':   ['lower_back'],
  'back':         ['lower_back'],
  'hip':          ['hip'],
  'hips':         ['hip'],
  'groin':        ['groin'],
  'hamstring':    ['hamstring'],
  'hamstrings':   ['hamstring'],
  'wrist':        ['wrist'],
  'wrists':       ['wrist'],
  'elbow':        ['elbow'],
  'elbows':       ['elbow'],
  'quad':         ['quad'],
  'quads':        ['quad'],
  'calf':         ['calf'],
  'calves':       ['calf'],
  'neck':         ['neck'],
  'achilles':     ['ankle', 'calf'],
  'shin':         ['calf', 'ankle'],
  'shins':        ['calf', 'ankle'],
  'adductor':     ['groin'],
  'adductors':    ['groin'],
  'glute':        ['hip'],
  'glutes':       ['hip'],
};

/** Convert athlete injuries to a set of InjuryTags for filtering. */
function injuriesToTags(injuries: OnboardingInjury[]): Set<InjuryTag> {
  const tags = new Set<InjuryTag>();
  for (const injury of injuries) {
    const area = injury.bodyArea.toLowerCase().trim();
    const mapped = INJURY_BODY_AREA_MAP[area];
    if (mapped) {
      mapped.forEach(t => tags.add(t));
    }
    // Also check description for keywords
    const desc = (injury.description || '').toLowerCase();
    for (const [keyword, injuryTags] of Object.entries(INJURY_BODY_AREA_MAP)) {
      if (desc.includes(keyword)) {
        injuryTags.forEach(t => tags.add(t));
      }
    }
  }
  return tags;
}

// ─── Equipment Inference ───

const LOCATION_EQUIPMENT: Record<string, EquipmentTag[]> = {
  'Commercial gym': ['bodyweight', 'dumbbells', 'barbell', 'cables', 'bands', 'bench', 'foam_roller', 'bike_or_treadmill', 'pullup_bar', 'kettlebell', 'machine'],
  'Club gym':       ['bodyweight', 'dumbbells', 'barbell', 'cables', 'bands', 'bench', 'foam_roller', 'bike_or_treadmill', 'pullup_bar', 'machine'],
  'Home gym':       ['bodyweight', 'dumbbells', 'bands', 'foam_roller', 'kettlebell'],
  'Outdoor':        ['bodyweight', 'bands'],
};

/** Infer available equipment from training location. */
export function inferEquipment(trainingLocation: string): EquipmentTag[] {
  return LOCATION_EQUIPMENT[trainingLocation] || LOCATION_EQUIPMENT['Commercial gym'];
}

// ─── Date Hash (deterministic variety) ───

/**
 * Simple numeric hash from a date string.
 * Used to rotate exercise selection — same date always picks the same exercises,
 * but different dates get variety within the pool.
 */
function dateHash(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ─── Weekly Category Caps ───
//
// Prevents low-fatigue accessory categories from being auto-selected
// as the default filler across every session in a week. The cap is
// per-category-per-week, enforced at build time.
//
// Only categories that tend to be over-selected need caps. Most categories
// are naturally limited by session slot structure. These caps are a safety
// net, not the primary gating mechanism.

export const WEEKLY_CATEGORY_CAPS: Partial<Record<ExerciseCategory, number>> = {
  lower_prehab: 1, // Tib raises / ankle work: max 1x per week by default
  calves: 2,       // General calf work: max 2x per week
};

// ─── Core Selection Engine ───

/**
 * Filter a pool to exercises the athlete can safely do with their equipment.
 */
function filterPool(
  pool: PoolExercise[],
  injuryTags: Set<InjuryTag>,
  equipmentTags: Set<EquipmentTag>,
): PoolExercise[] {
  return pool.filter(ex => {
    // Exclude if any contraindication matches an active injury
    if (ex.contraindications.some(c => injuryTags.has(c))) return false;
    // Exclude if requires equipment the athlete doesn't have
    // (bodyweight exercises always pass — equipment array is empty or contains 'bodyweight')
    if (ex.equipment.length > 0) {
      const hasEquipment = ex.equipment.every(e => e === 'bodyweight' || equipmentTags.has(e));
      if (!hasEquipment) return false;
    }
    return true;
  });
}

/**
 * Pick N exercises from a filtered pool, using dateHash for rotation.
 * If fewer than N are available after filtering, returns all available.
 */
function pickFromPool(
  pool: PoolExercise[],
  count: number,
  seed: number,
): PoolExercise[] {
  if (pool.length === 0) return [];
  if (pool.length <= count) return pool;

  // Rotate the starting index based on seed
  const start = seed % pool.length;
  const picks: PoolExercise[] = [];
  for (let i = 0; i < count; i++) {
    picks.push(pool[(start + i) % pool.length]);
  }
  return picks;
}

// ─── WorkoutExercise Builder ───

function poolExerciseToWorkoutExercise(
  pe: PoolExercise,
  workoutId: string,
  order: number,
): WorkoutExercise {
  const now = new Date().toISOString();
  return {
    id: `${workoutId}-ex-${order}`,
    workoutId,
    exerciseId: pe.id,
    exerciseOrder: order,
    prescribedSets: pe.sets,
    prescribedRepsMin: pe.repsMin,
    prescribedRepsMax: pe.repsMax,
    restSeconds: pe.restSeconds,
    prescriptionType: pe.prescriptionType,
    perSide: pe.perSide,
    notes: pe.notes,
    exercise: {
      id: pe.id,
      name: pe.name,
      description: pe.notes,
    } as Exercise,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Public API ───

/**
 * Build a fully-formed derived Workout for a given session type and date.
 *
 * This is the main entry point. The resolver calls this instead of the
 * old hardcoded createRecoveryWorkout / createArmsPumpWorkout / etc.
 *
 * @param type        - Which derived session to build
 * @param dateStr     - ISO date (YYYY-MM-DD) for the workout
 * @param microcycleId - ID to stamp on the workout
 * @param reason      - Human-readable reason (e.g. "Post-game recovery")
 * @param athlete     - Athlete context for personalization
 * @param weekCategoryUsage - Optional map of category → count already used this week.
 *                            If a category has hit its WEEKLY_CATEGORY_CAPS limit,
 *                            the slot is skipped. Callers (e.g. resolveWeekWithConditioning)
 *                            can pass this to enforce anti-spam weekly frequency caps.
 */
export function buildDerivedSession(
  type: DerivedSessionType,
  dateStr: string,
  microcycleId: string,
  reason: string,
  athlete: AthleteContext,
  weekCategoryUsage?: Map<ExerciseCategory, number>,
): Workout {
  const meta = SESSION_META[type];
  const slots = SESSION_SLOTS[type];
  const seed = dateHash(dateStr);

  // Build constraint sets
  const injuryTags = injuriesToTags(athlete.injuries);
  const equipmentSet = new Set(athlete.equipmentTags);

  // Assemble exercises from slots
  const exercises: WorkoutExercise[] = [];
  const workoutId = `derived-${type}-${dateStr}`;
  let order = 1;

  // Use a category-specific sub-seed for each slot so different categories
  // rotate independently
  let slotIndex = 0;
  for (const slot of slots) {
    // ── Weekly category cap enforcement ──
    // If the caller provided week-level usage counts and this category
    // has a weekly cap defined, skip the slot when the cap is reached.
    const cap = WEEKLY_CATEGORY_CAPS[slot.category];
    if (cap !== undefined && weekCategoryUsage) {
      const used = weekCategoryUsage.get(slot.category) || 0;
      if (used >= cap) {
        slotIndex++;
        continue; // Skip — this category has been used enough this week
      }
    }

    const pool = POOL_REGISTRY[slot.category] || [];
    const filtered = filterPool(pool, injuryTags, equipmentSet);
    const slotSeed = seed + slotIndex * 7919; // prime offset for variety
    const picks = pickFromPool(filtered, slot.count, slotSeed);

    for (const pe of picks) {
      exercises.push(poolExerciseToWorkoutExercise(pe, workoutId, order));
      order++;
    }

    // Track usage for downstream callers that accumulate across sessions
    if (weekCategoryUsage && picks.length > 0) {
      const prev = weekCategoryUsage.get(slot.category) || 0;
      weekCategoryUsage.set(slot.category, prev + picks.length);
    }

    slotIndex++;
  }

  // Apply intelligent load estimates for exercises that should have weight
  // (e.g. arms_pump curls, tricep pushdowns) if onboarding data is available.
  const finalExercises = athlete.onboardingData
    ? applyLoadEstimates(exercises, athlete.onboardingData)
    : exercises;

  const now = new Date().toISOString();
  const dow = new Date(dateStr + 'T12:00:00').getDay();

  return {
    id: workoutId,
    microcycleId,
    dayOfWeek: dow,
    name: meta.name,
    description: `${reason} — ${meta.descriptionSuffix}`,
    durationMinutes: meta.durationMinutes,
    intensity: meta.intensity,
    workoutType: meta.workoutType,
    sessionTier: meta.sessionTier,
    exercises: finalExercises,
    createdAt: now,
    updatedAt: now,
  };
}

// ═══════════════════════════════════════════════════════════════
// TAG-BASED SESSION BUILDING
// ═══════════════════════════════════════════════════════════════

/**
 * Build a tag-aware workout for a template session.
 *
 * Uses the exercise tag system to:
 *   1. Apply hard filters (game proximity, late-week, plyos)
 *   2. Apply injury filters
 *   3. Score remaining candidates against session intent
 *   4. Select top exercises deterministically
 *
 * The resolver still decides WHAT session type a date needs.
 * This function decides WHICH EXERCISES go in that session.
 *
 * @param templateWorkout - The template workout (from microcycle)
 * @param dateStr         - ISO date (YYYY-MM-DD)
 * @param gameDates       - All game dates in the block
 * @param athlete         - Athlete context (injuries, equipment)
 * @param inSeason        - Whether we're in-season
 * @param weekExercises   - Exercises already used this week (for variety)
 */
export function buildTagAwareSession(
  templateWorkout: Workout,
  dateStr: string,
  gameDates: string[],
  athlete: AthleteContext,
  inSeason: boolean,
  weekExercises: Set<string> = new Set(),
): Workout {
  // Build filter context from date + game data + injuries
  const injuries = athlete.injuries.map(i => ({
    bodyArea: i.bodyArea,
    severity: i.severity,
  }));
  const filterCtx = buildFilterContext(dateStr, gameDates, injuries, inSeason);

  // Get all tagged exercises and apply hard + injury filters
  const allTagged = getAllTaggedExercises();
  const candidates = applyHardFilters(allTagged, filterCtx);

  // Build intent from the template workout's name/type
  const exerciseCount = templateWorkout.exercises.length || 5;
  const intent = buildIntent(templateWorkout.name, templateWorkout.workoutType, exerciseCount);

  // Score and select
  const selected = selectExercises(candidates, intent, filterCtx, weekExercises);

  // Build WorkoutExercise array from selected exercises
  const workoutId = `tag-${templateWorkout.id}-${dateStr}`;
  const now = new Date().toISOString();
  const exercises: WorkoutExercise[] = selected.map((name, idx) => {
    // Prescription is determined by context (session type, slot role, etc.),
    // not stored on the exercise tag. Default placeholder until builder
    // gains context-aware prescription logic.
    const rx = { sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 };
    return {
      id: `${workoutId}-ex-${idx + 1}`,
      workoutId,
      exerciseId: `tag-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      exerciseOrder: idx + 1,
      prescribedSets: rx.sets,
      prescribedRepsMin: rx.repsMin,
      prescribedRepsMax: rx.repsMax,
      restSeconds: rx.restSeconds,
      notes: undefined,
      exercise: {
        id: `tag-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name,
        description: '',
      } as Exercise,
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    ...templateWorkout,
    id: workoutId,
    exercises,
    updatedAt: now,
  };
}

/**
 * Substitute a specific exercise in a workout using the tag system.
 *
 * Finds the best replacement that preserves:
 *   - Movement pattern
 *   - Fatigue profile
 *   - DOMS level
 *   - Injury constraints
 *
 * Returns a new workout with the substitution applied, or the
 * original workout if no valid substitute is found.
 */
export function substituteExercise(
  workout: Workout,
  exerciseName: string,
  dateStr: string,
  gameDates: string[],
  athlete: AthleteContext,
  inSeason: boolean,
): Workout {
  const injuries = athlete.injuries.map(i => ({
    bodyArea: i.bodyArea,
    severity: i.severity,
  }));
  const filterCtx = buildFilterContext(dateStr, gameDates, injuries, inSeason);

  // Get filtered candidates
  const allTagged = getAllTaggedExercises();
  const candidates = applyHardFilters(allTagged, filterCtx);

  // Exclude exercises already in the workout
  const currentNames = new Set(
    workout.exercises.map(e => e.exercise?.name).filter(Boolean) as string[]
  );
  const availableCandidates = candidates.filter(c => !currentNames.has(c));

  const substitute = findSubstitute(exerciseName, availableCandidates, filterCtx);
  if (!substitute) return workout;

  const now = new Date().toISOString();
  // Substitution inherits the original exercise's prescription from the workout,
  // falling back to a default placeholder. Context-aware prescription TBD.
  const rx = { sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90 };

  const newExercises = workout.exercises.map(e => {
    if (e.exercise?.name !== exerciseName) return e;
    return {
      ...e,
      exerciseId: `tag-${substitute.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      prescribedSets: rx.sets,
      prescribedRepsMin: rx.repsMin,
      prescribedRepsMax: rx.repsMax,
      restSeconds: rx.restSeconds,
      exercise: {
        id: `tag-${substitute.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: substitute,
        description: '',
      } as Exercise,
      updatedAt: now,
    };
  });

  return { ...workout, exercises: newExercises, updatedAt: now };
}

// ═══════════════════════════════════════════════════════════════
// CONDITIONING SESSION BUILDING
// ═══════════════════════════════════════════════════════════════

import {
  resolveConditioning,
  type ConditioningContext,
  type WeekLog,
  type ConditioningResult,
} from './conditioningRules';
import type { SeasonPhase } from '../types/domain';
import {
  resolveConditioningProgression,
  type ConditioningProgressionInput,
  type ConditioningProgressionOutput,
} from './conditioningProgressionRules';
import { calculateConditioningLoad } from './progressionHelpers';

// ─── Conditioning Session Templates ───
//
// Deterministic exercise content for every conditioning session type.
// These replace the empty exercises: [] that previously relied on AI.
//
// Each template defines the full session structure: warm-up, working sets,
// distances, rest periods, and cool-down. The progression engine can
// adjust volume/intensity, but the base template is always populated.
//
// DESIGN:
//   - Templates are keyed by exercise name (matching CONDITIONING_META keys)
//   - Each returns WorkoutExercise[] with fully specified prescriptions
//   - Uses a date hash for deterministic variety (different distances, formats)
//   - Progression adjustments (reps, rest, duration deltas) are applied on top

interface ConditioningTemplate {
  exercises: WorkoutExercise[];
}

/** Simple date hash for deterministic variety (same date = same workout). */
export function conditioningDateHash(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Helper: build a WorkoutExercise for conditioning. */
export function condEx(
  id: string,
  name: string,
  order: number,
  sets: number,
  repsMin: number,
  repsMax: number,
  rest: number,
  notes?: string,
): WorkoutExercise {
  const now = new Date().toISOString();
  return {
    id,
    workoutId: '',          // filled by caller
    exerciseId: id,
    exerciseOrder: order,
    prescribedSets: sets,
    prescribedRepsMin: repsMin,
    prescribedRepsMax: repsMax,
    restSeconds: rest,
    notes,
    exercise: {
      id,
      name,
      description: notes || name,
      muscleGroups: [],
      exerciseType: 'Cardio' as const,
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as const,
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Map a conditioningFlavour (from coaching engine) to a concrete exercise name
 * for buildConditioningTemplate. Uses the date hash for deterministic variety
 * within each flavour category.
 *
 * Buckets:
 *   aerobic       → Long Nasal Run
 *   tempo         → 1km Repeat Intervals, 4x4 VO2, 200m/400m Repeat Runs
 *   high-intensity → MAS 15:15, Tabata 20:10, Inverse Tabata 10:20,
 *                    Max Effort Sprint Accumulation, Free Sprint Session,
 *                    Footy Fartlek, Flying Sprints
 */
export function conditioningFlavourToExerciseName(
  flavour: 'aerobic' | 'tempo' | 'high-intensity',
  dateStr: string,
): string {
  const hash = conditioningDateHash(dateStr);

  switch (flavour) {
    case 'high-intensity': {
      const options = [
        'MAS 15:15 Blocks',
        'Tabata Intervals',
        'Inverse Tabata',
        'Max Effort Sprint Accumulation',
        'Free Sprint Session',
        'Footy Fartlek',
        'Flying Sprints',
      ];
      return options[hash % options.length];
    }
    case 'tempo': {
      const options = ['1km Repeat Intervals', '4x4 VO2', '200m/400m Repeat Runs'];
      return options[hash % options.length];
    }
    case 'aerobic': {
      return 'Long Nasal Run';
    }
    default:
      return 'Long Nasal Run';
  }
}

// ════════════════════════════════════════════════════════════════════
// CONDITIONING CATEGORY — energy-system classification
// ════════════════════════════════════════════════════════════════════

/**
 * Energy-system category. Off-season and pre-season weeks must cover
 * each category at most once before duplicating. Priority order when
 * slots are limited: aerobic_base → sprint → vo2 → glycolytic.
 */
export type ConditioningCategory =
  | 'aerobic_base'
  | 'sprint'
  | 'vo2'
  | 'glycolytic';

export const CONDITIONING_CATEGORIES: ConditioningCategory[] = [
  'aerobic_base', 'sprint', 'vo2', 'glycolytic',
];

/**
 * Target intensity band (out of 10) for each category. This is the
 * canonical source — templates reference these bands in their
 * descriptions instead of using RPE language.
 */
export const CATEGORY_INTENSITY: Record<ConditioningCategory, string> = {
  aerobic_base: '5-6/10',
  sprint:       '9-10/10 (quality-based)',
  vo2:          '8-9/10',
  glycolytic:   '8-9/10',
};

/**
 * Static classification of every known conditioning template into a
 * single energy-system category. The classification is deterministic
 * — it does NOT depend on date or context.
 */
export const TEMPLATE_CATEGORY: Record<string, ConditioningCategory> = {
  // Aerobic base
  'Long Nasal Run': 'aerobic_base',
  'Flush Run': 'aerobic_base',
  'Easy Bike': 'aerobic_base',
  'Easy Row': 'aerobic_base',
  'Easy Ski': 'aerobic_base',
  'Easy Swim': 'aerobic_base',

  // Sprint / alactic
  'Flying Sprints': 'sprint',
  'Free Sprint Session': 'sprint',
  'Max Effort Sprint Accumulation': 'sprint',

  // VO2
  '4x4 VO2': 'vo2',
  '1km Repeat Intervals': 'vo2',

  // Glycolytic / repeat-effort / high lactate
  'MAS 15:15 Blocks': 'glycolytic',
  'Tabata Intervals': 'glycolytic',
  'Inverse Tabata': 'glycolytic',
  '200m/400m Repeat Runs': 'glycolytic',
  'Footy Fartlek': 'glycolytic',
};

export function getTemplateCategory(exerciseName: string): ConditioningCategory | null {
  return TEMPLATE_CATEGORY[exerciseName] ?? null;
}

/**
 * Pick a concrete template name for a given category.
 *
 * When `miniCycleNumber` is provided, template selection is
 * **stable within a mini-cycle and rotates across blocks** —
 * `idx = (miniCycleNumber - 1) mod options.length`. This mirrors
 * the strength-side philosophy (anchor stable within a block, varies
 * at block boundaries) and lets the athlete become fluent on one
 * structure (4x4 VO2, 1km Repeats, ...) across the 3-4 weeks of a
 * block before rotating to a new stimulus next block. Week-to-week
 * variety within a block is provided by feel + erg modality, which
 * rotate independently.
 *
 * When `miniCycleNumber` is undefined, falls back to the date-hash
 * behaviour for backward compatibility with callers that don't
 * thread the rotation context. `aerobic_base` is 1:1 regardless
 * (modality variation happens inside the template itself).
 */
export function conditioningCategoryToExerciseName(
  category: ConditioningCategory,
  dateStr: string,
  miniCycleNumber?: number,
): string {
  const pickIndex = (poolLen: number): number =>
    miniCycleNumber !== undefined
      ? (Math.max(1, miniCycleNumber) - 1) % poolLen
      : conditioningDateHash(dateStr) % poolLen;

  switch (category) {
    case 'aerobic_base':
      // Single template — modality variation happens inside the template
      // itself (Long Nasal Run rotates run / bike / row / ski by hash).
      // Keeps category-to-template mapping 1:1 for resolver simplicity
      // while still giving week-to-week variety at the session level.
      return 'Long Nasal Run';
    case 'sprint': {
      const options = [
        'Free Sprint Session',
        'Flying Sprints',
        'Max Effort Sprint Accumulation',
      ];
      return options[pickIndex(options.length)];
    }
    case 'vo2': {
      const options = ['4x4 VO2', '1km Repeat Intervals'];
      return options[pickIndex(options.length)];
    }
    case 'glycolytic': {
      const options = [
        'MAS 15:15 Blocks',
        '200m/400m Repeat Runs',
        'Tabata Intervals',
        'Inverse Tabata',
        'Footy Fartlek',
      ];
      return options[pickIndex(options.length)];
    }
    default:
      return 'Long Nasal Run';
  }
}

/**
 * Map the legacy flavour field onto a category. Used when upgrading a
 * planner slot that only has `conditioningFlavour` set.
 *
 *   aerobic        → aerobic_base
 *   tempo          → vo2   (tempo/threshold templates are VO2-family)
 *   high-intensity → glycolytic  (MAS/Tabata/RSA etc. — sprint is picked
 *                                 separately by the category planner)
 */
export function flavourToCategory(
  flavour: 'aerobic' | 'tempo' | 'high-intensity',
): ConditioningCategory {
  switch (flavour) {
    case 'aerobic': return 'aerobic_base';
    case 'tempo':   return 'vo2';
    case 'high-intensity': return 'glycolytic';
  }
}

/**
 * Map a category back to a flavour for downstream code that still
 * reads `conditioningFlavour` (UI labels, legacy resolvers).
 */
export function categoryToFlavour(
  category: ConditioningCategory,
): 'aerobic' | 'tempo' | 'high-intensity' {
  switch (category) {
    case 'aerobic_base': return 'aerobic';
    case 'vo2':          return 'tempo';
    case 'sprint':       return 'high-intensity';
    case 'glycolytic':   return 'high-intensity';
  }
}

/**
 * Deterministic conditioning templates — single source of truth.
 *
 * Each template returns ONLY conditioning exercises.
 * NO strength. NO accessories. NO prehab. NO filler.
 *
 * Variation is controlled via:
 *   - date hash (deterministic rotation of reps/duration/format)
 *   - NOT randomisation
 */
/** Supported ergometer modalities for combined-day leg-sparing. */
export type ErgModality = 'bike' | 'row' | 'ski' | 'mixed';

/** Density/feel tag — drives session differentiation within a category. */
export type ConditioningFeel = 'grindy' | 'sharp' | 'flowing';

/** Volume variant — drives sprint fallback sessions when retrofitted. */
export type ConditioningVariant = 'standard' | 'reduced' | 'micro_dose';

export function buildConditioningTemplate(
  exerciseName: string,
  dateStr: string,
  opts?: {
    combined?: boolean;
    /**
     * For combined days only — strength region being paired with the
     * conditioning block. Used to auto-shift modality to an ergometer
     * (bike / row / ski) when pairing a lower-body lift with sprint or
     * glycolytic conditioning, to protect the legs.
     */
    strengthRegion?: 'lower' | 'upper' | 'full';
    /**
     * Density/feel hint. When present, the builder selects the variant
     * with the matching density/work:rest shape rather than rotating
     * purely by date hash. Lets the engine drive intra-category
     * differentiation (grindy vs sharp vs flowing).
     */
    feel?: ConditioningFeel;
    /**
     * Volume variant. 'reduced' roughly halves the prescribed volume;
     * 'micro_dose' collapses a sprint session to 3–4×10s flying sprints
     * only. Standalone sprint-rescue placements use these.
     */
    variant?: ConditioningVariant;
    /**
     * Explicit ergometer modality to use when running is off. Overrides
     * the default hash-based rotation. Used for weekly erg tracking so
     * the same modality isn't repeated twice in a week when it can be
     * avoided. 'mixed' = row+ski combo.
     */
    ergModality?: ErgModality;
  },
): WorkoutExercise[] {
  // Sprint-rescue micro-dose / reduced-volume sessions short-circuit to
  // a compact neural exposure template regardless of exercise name.
  if (opts?.variant === 'micro_dose') {
    return buildSprintMicroDose(dateStr, opts.combined ?? false);
  }
  if (opts?.variant === 'reduced') {
    const category = getTemplateCategory(exerciseName);
    if (category === 'sprint') {
      return buildSprintReducedVolume(dateStr, opts.combined ?? false, opts.ergModality, opts.strengthRegion);
    }
    if (category === 'aerobic_base') {
      return buildReducedAerobicBase(dateStr, opts.ergModality);
    }
    // Other non-sprint 'reduced' variants are not specified in the UI yet — fall through.
  }

  // Combined S+C days get a category-based, duration-capped (≤25min)
  // template. Purpose: complement the lift without dominating the session.
  if (opts?.combined) {
    const category = getTemplateCategory(exerciseName);
    if (category) {
      const scaled = buildCombinedConditioningTemplate(
        category, dateStr, opts.strengthRegion, opts.feel, opts.ergModality,
      );
      if (!SPEED_SPRINT_TEMPLATES.has(exerciseName) && isModalityFlexibleConditioning(exerciseName)) {
        return appendNoteToHeadline(scaled, MODALITY_FLEX_NOTE);
      }
      return scaled;
    }
    // Unknown template — fall through to raw (safe default).
  }

  const exercises = buildConditioningTemplateRaw(exerciseName, dateStr, opts?.feel, opts?.ergModality);
  // Append the modality-flex note to the headline row of any non-sprint
  // template. Pure speed / sprint exposures are intentionally excluded —
  // running IS the goal there, not a modality choice.
  if (!SPEED_SPRINT_TEMPLATES.has(exerciseName) && isModalityFlexibleConditioning(exerciseName)) {
    return appendNoteToHeadline(exercises, MODALITY_FLEX_NOTE);
  }
  return exercises;
}

// ════════════════════════════════════════════════════════════════════
// COMBINED-DAY CONDITIONING — scaled templates for S+C days
// ════════════════════════════════════════════════════════════════════

/**
 * Duration cap (minutes) for conditioning on different day types.
 * Enforced by buildCombinedConditioningTemplate (combined) and by
 * template design (standalone never exceeds ~45min).
 */
export const CONDITIONING_DURATION_CAP = {
  combined: { max: 30, target: 22 }, // 15–25 preferred, 30 absolute
  standalone: { max: 45, target: 35 },
} as const;

function buildReducedAerobicBase(
  dateStr: string,
  ergModality?: ErgModality,
): WorkoutExercise[] {
  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}`;
  const modalities = ['bike', 'row'] as const;
  const mod = ergModality === 'row' || ergModality === 'bike'
    ? ergModality
    : modalities[hash % modalities.length];
  const modLabel = mod === 'bike' ? 'Assault Bike' : 'Rower';
  const duration = 20 + (hash % 3) * 5; // 20, 25, or 30 min
  return [
    condEx(`${prefix}-easy-flush`, `Easy Aerobic Flush (${duration}min ${modLabel})`, 1, 1, 1, 1, 0,
      `${duration}min easy ${modLabel}.\n` +
      'Intensity: 3-4/10 — genuinely easy, conversational pace.\n' +
      'Optional. Use this for recovery and aerobic maintenance.\n' +
      'Skip if legs feel heavy after team training or if Thursday training quality would suffer.'),
  ];
}

/**
 * Build an abbreviated, duration-capped conditioning block for a
 * combined Strength + Conditioning day. Target: 15–25min, max 30min.
 * Focus: complement the lift — low-to-moderate fatigue.
 *
 * Scaled by category so the energy-system purpose of the day is
 * preserved even though volume is reduced.
 */
export function buildCombinedConditioningTemplate(
  category: ConditioningCategory,
  dateStr: string,
  /**
   * Optional strength region being paired today. When the pairing would
   * hammer the legs twice (lower + sprint, lower + glycolytic), modality
   * is forced to an ergometer (bike / row / ski) so the conditioning is
   * still category-correct but spares the running system.
   */
  strengthRegion?: 'lower' | 'upper' | 'full',
  /**
   * Feel/density override. When present, selects the matching variant
   * (grindy: long work + short rest; sharp: short work + long rest;
   * flowing: continuous/fartlek). When absent, rotates by date hash.
   */
  feel?: ConditioningFeel,
  /**
   * Explicit ergometer modality. Overrides the default hash-based choice
   * so the weekly scheduler can avoid repeats.
   */
  ergModality?: ErgModality,
): WorkoutExercise[] {
  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}`;
  // Default modality rotation (bike / row / ski) for variety.
  const allMods = ['bike', 'row', 'ski'] as const;
  // Leg-sparing subset — SkiErg and Row are more upper-biased than Bike
  // for pure glycolytic/power work. We include bike too (it's still off-
  // feet), but prefer ski/row first for lower-day pairings.
  const legSparingMods = ['ski', 'row', 'bike'] as const;
  const isLowerPairing = strengthRegion === 'lower';
  const modPool = isLowerPairing ? legSparingMods : allMods;
  // 'mixed' = row + ski combo block. Otherwise use explicit mod or hash rotation.
  const mod = ergModality && ergModality !== 'mixed'
    ? ergModality
    : modPool[hash % modPool.length];
  const isMixed = ergModality === 'mixed';
  const modLabel = isMixed ? 'Row + SkiErg (mixed)'
    : mod === 'bike' ? 'Assault Bike' : mod === 'row' ? 'Rower' : 'SkiErg';
  const combinedNote =
    'Combined S+C day — abbreviated conditioning dose.\n' +
    'Should complement the lift, not dominate the session.';
  const legSpareNote = isLowerPairing
    ? '\nLower-body lift today — conditioning is on the ergometer to spare the legs.'
    : '';

  switch (category) {
    case 'aerobic_base': {
      // 20–25min zone 2 — lift first, then a controlled aerobic finisher.
      const duration = 20 + (hash % 2) * 5; // 20 or 25 min
      return [
        condEx(`${prefix}-aero`, `${duration}min zone 2 ${mod}`, 1, 1, 1, 1, 0,
          `${duration}min zone 2 steady on ${modLabel}.\n` +
          'Intensity: 5-6/10 — conversational pace.\n' +
          `${combinedNote}${legSpareNote}`),
      ];
    }
    case 'sprint': {
      // Sprint exposure — when paired with a lower lift, convert to
      // ergometer power sprints so we're not hammering the legs with
      // both heavy compounds AND max-velocity running. Upper / full-body
      // days keep the running sprint (quality neural exposure).
      if (isLowerPairing) {
        // Ergo power-sprint session on lower-paired day. Feel variants:
        //   sharp   → 6 × 10s all-out, 90s rest   (neural, full recovery)
        //   grindy  → 8 × 15s hard, 45s rest      (repeat power, short rest)
        //   flowing → pyramid 10/15/20/15/10s     (rising then easing)
        const ergFeelIdx = feel === 'sharp' ? 0
          : feel === 'grindy' ? 1
          : feel === 'flowing' ? 2
          : hash % 3;
        if (ergFeelIdx === 1) {
          return [
            condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
              `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps).`),
            condEx(`${prefix}-grindsprint`, `8 × 15s hard (${modLabel})`, 2, 8, 1, 1, 45,
              `8 reps: 15s hard on ${modLabel}, 45s rest between (1:3).\n` +
              'Intensity: 9/10 — grindy repeat power, alactic-lactic.\n' +
              `${combinedNote}${legSpareNote}`),
          ];
        }
        if (ergFeelIdx === 2) {
          return [
            condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
              `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps).`),
            condEx(`${prefix}-pyramid`, `Pyramid 10/15/20/15/10s × 2 rounds (${modLabel})`, 2, 2, 1, 1, 120,
              `2 rounds of 10s / 15s / 20s / 15s / 10s on ${modLabel}.\n` +
              '60s rest between reps, 2min between rounds.\n' +
              'Intensity: 9/10 — flowing surges, rising then easing.\n' +
              `${combinedNote}${legSpareNote}`),
          ];
        }
        // default sharp
        const reps = 6 + (hash % 3); // 6 / 7 / 8
        return [
          condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
            `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps).`),
          condEx(`${prefix}-powersprint`, `${reps} × 10s all-out power sprint (${modLabel})`, 2, reps, 1, 1, 90,
            `${reps} × 10s max-wattage on ${modLabel}.\n` +
            '90s easy spin between reps — full recovery.\n' +
            'Intensity: 9-10/10 — sharp, quality-based, neural alactic.\n' +
            `${combinedNote}${legSpareNote}`),
        ];
      }
      // Upper/full-body sprint day — running sprints stay on.
      // Variant selection honours `feel` if supplied, else rotates by hash.
      //   sharp   → 4 × 20m max velocity, 3min rest  (long rest, neural)
      //   flowing → accel ladder 10/20/30m × 3       (surges, rhythmic)
      //   grindy  → 6 × 20m shuttle, 60s rest        (repeat speed, short rest)
      const sprintFeelIdx = feel === 'sharp' ? 0
        : feel === 'flowing' ? 1
        : feel === 'grindy' ? 2
        : hash % 3;
      if (sprintFeelIdx === 1) {
        // flowing — acceleration ladder
        return [
          condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
            '8min: light jog, dynamic prep, 3 × 20m gradual accelerations (50% → 70% → 90%). Must feel sharp.'),
          condEx(`${prefix}-ladder`, 'Acceleration ladder × 3 rounds', 2, 3, 1, 1, 120,
            '3 rounds of 10m / 20m / 30m accelerations.\n' +
            '60s walk between distances, 2min between rounds.\n' +
            'Intensity: 9/10 — crisp, rhythmic, rising velocity.\n' +
            `${combinedNote}`),
        ];
      }
      if (sprintFeelIdx === 2) {
        // grindy — 6×20m shuttle with short rest
        return [
          condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
            '8min: light jog, dynamic prep, 3 × 20m gradual accelerations (50% → 70% → 90%). Must feel sharp.'),
          condEx(`${prefix}-shuttle`, '6 × 20m shuttle sprints', 2, 6, 1, 1, 60,
            '6 reps: 20m out / 20m back, hard turn.\n' +
            '60s rest between reps — deliberately short to grind.\n' +
            'Intensity: 9/10 — repeat speed quality.\n' +
            `${combinedNote}`),
        ];
      }
      // default sharp — classic flying sprints
      const reps = 3 + (hash % 2); // 3 or 4
      return [
        condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
          '8min: light jog, dynamic prep, 3 × 20m gradual accelerations (50% → 70% → 90%). Must feel sharp.'),
        condEx(`${prefix}-sprints`, `${reps} × max-velocity sprints`, 2, reps, 1, 1, 180,
          `${reps} reps: 20m build → 20m max velocity.\n` +
          'Full walk-back recovery between reps (3min).\n' +
          'Intensity: 9-10/10 — quality-based, neural.\n' +
          `${combinedNote}`),
      ];
    }
    case 'vo2': {
      // VO2 dose — variant differs by DENSITY (work:rest) not just structure:
      //   grindy  → 3 × 3min @ 1:0.5 rest   (long work, short recovery)
      //   sharp   → 5 × 90s @ 1:2 rest     (short work, long recovery)
      //   flowing → 4 × 2min @ 1:1 rest    (balanced, rhythmic)
      const variantIdx = feel === 'grindy' ? 0
        : feel === 'sharp' ? 1
        : feel === 'flowing' ? 2
        : hash % 3;
      const [reps, workSec, restSec, label, feelNote] =
        variantIdx === 0 ? [3, 180, 90, '3 × 3min', 'Grindy: long work, short recovery — sustained ceiling.']
        : variantIdx === 1 ? [5, 90, 180, '5 × 90s', 'Sharp: short work, long recovery — repeat power.']
        : [4, 120, 120, '4 × 2min', 'Flowing: balanced 1:1 — rhythmic tempo.'];
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `5min easy ${mod}, 2 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-vo2`, `${label} VO2 intervals (${modLabel})`, 2, reps as number, 1, 1, restSec as number,
          `${label} at ~90% HRmax on ${modLabel} (${workSec}s work).\n` +
          `${Math.round((restSec as number) / 60 * 10) / 10}min easy recovery between reps.\n` +
          'Intensity: 8-9/10.\n' +
          `${feelNote}\n` +
          `${combinedNote}${legSpareNote}`),
      ];
    }
    case 'glycolytic': {
      // Glycolytic dose — variant differs by DENSITY / feel:
      //   grindy  → 4 × 2min @ 1:1          (long lactate accumulation)
      //   sharp   → 10 × 30s @ 1:3 rest     (short efforts, long rest)
      //   flowing → 40:20 MAS × 2 rounds    (continuous block, surges)
      const variantIdx = feel === 'grindy' ? 0
        : feel === 'sharp' ? 1
        : feel === 'flowing' ? 2
        : hash % 3;
      if (variantIdx === 0) {
        // grindy
        return [
          condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
            `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
          condEx(`${prefix}-grind`, `4 × 2min hard (${modLabel})`, 2, 4, 1, 1, 120,
            `4 reps: 2min hard on ${modLabel}, 2min easy between.\n` +
            'Intensity: 8-9/10 — grindy, long lactate accumulation.\n' +
            `${combinedNote}${legSpareNote}`),
        ];
      }
      if (variantIdx === 1) {
        // sharp
        return [
          condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
            `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
          condEx(`${prefix}-sharp`, `10 × 30s hard (${modLabel})`, 2, 10, 1, 1, 90,
            `10 reps: 30s hard on ${modLabel}, 90s easy between (1:3).\n` +
            'Intensity: 8-9/10 — sharp repeat power with full recovery.\n' +
            `${combinedNote}${legSpareNote}`),
        ];
      }
      // flowing (default) — 40s work is MAS-prescribed at 100% MAS (>30s rule).
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-flow`, `40:20 intervals × 2 rounds (${modLabel})`, 2, 2, 1, 1, 120,
          `40s on / 20s off × 4min block on ${modLabel}.\n` +
          '2 rounds total. Rest 2min between blocks.\n' +
          `\n${MAS_FALLBACK_NOTE}\n` +
          `\nTarget pace: ${masIntensityLabel(40)} on each 40s work rep.\n` +
          'Intensity: 8-9/10 — flowing continuous, glycolytic repeat effort.\n' +
          `${combinedNote}${legSpareNote}`),
      ];
    }
    default:
      return [
        condEx(`${prefix}-aero`, `20min zone 2 ${mod}`, 1, 1, 1, 1, 0,
          `20min zone 2 steady on ${modLabel}.\n` +
          'Intensity: 5-6/10.\n' +
          `${combinedNote}${legSpareNote}`),
      ];
  }
}

// ════════════════════════════════════════════════════════════════════
// SPRINT RESCUE TEMPLATES — micro-dose and reduced-volume sessions
// used by the engine when sprint must be retrofitted into a week
// without violating sprint-protection. Very low volume, neural only.
// ════════════════════════════════════════════════════════════════════

/**
 * Sprint micro-dose — the absolute last-resort sprint exposure. 3–4
 * flying sprints only, long recovery, ~8–10min including warm-up.
 * Low enough volume that placing it the day after vo2/glycolytic is
 * still safe (no meaningful fatigue contribution).
 */
function buildSprintMicroDose(
  dateStr: string,
  combined: boolean,
): WorkoutExercise[] {
  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}`;
  const reps = 3 + (hash % 2); // 3 or 4
  const note = combined
    ? 'Combined S+C day — sprint micro-dose. Neural exposure only.'
    : 'Sprint micro-dose. Keeps speed alive in the week without accumulating fatigue.';
  return [
    condEx(`${prefix}-warmup`, 'Sprint warm-up (short)', 1, 1, 1, 1, 0,
      '6min: light jog, dynamic prep, 2 × 20m gradual accelerations (50% → 70% → 90%).\n' +
      'Must feel sharp — stop immediately if anything tight.'),
    condEx(`${prefix}-micro`, `${reps} × 10s flying sprint (micro-dose)`, 2, reps, 1, 1, 180,
      `${reps} reps: 15m gradual build → 10s flying sprint.\n` +
      'Full walk-back recovery (3min) — quality over volume.\n' +
      'Intensity: 9-10/10 — neural only, very low total volume.\n' +
      `${note}`),
  ];
}

/**
 * Sprint reduced-volume — used when sprint had to be retrofitted into a
 * slot that normally would've been another category. Cut rep count by
 * roughly half compared to a standard sprint session (~10–12min).
 */
function buildSprintReducedVolume(
  dateStr: string,
  combined: boolean,
  ergModality: ErgModality | undefined,
  strengthRegion: 'lower' | 'upper' | 'full' | undefined,
): WorkoutExercise[] {
  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}`;
  const isLower = strengthRegion === 'lower';
  // If this is a lower-day combined session, keep it off-feet.
  if (isLower || ergModality) {
    const legSparingMods = ['ski', 'row', 'bike'] as const;
    const mod = ergModality && ergModality !== 'mixed'
      ? ergModality
      : legSparingMods[hash % legSparingMods.length];
    const modLabel = mod === 'bike' ? 'Assault Bike' : mod === 'row' ? 'Rower' : 'SkiErg';
    const reps = 4; // half of standard 8
    return [
      condEx(`${prefix}-warmup`, `${modLabel} warm-up (short)`, 1, 1, 1, 1, 0,
        `4min easy ${mod}, 2 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps).`),
      condEx(`${prefix}-reduced`, `${reps} × 10s power sprint (${modLabel}, reduced)`, 2, reps, 1, 1, 120,
        `${reps} × 10s all-out on ${modLabel} — reduced volume.\n` +
        '2min easy spin between reps — full recovery.\n' +
        'Intensity: 9-10/10.\n' +
        `${combined ? 'Combined S+C day — ' : ''}Reduced-volume sprint retrofit.`),
    ];
  }
  // On-feet reduced — 3 flying sprints with long rest.
  const reps = 3;
  return [
    condEx(`${prefix}-warmup`, 'Sprint warm-up (short)', 1, 1, 1, 1, 0,
      '6min: light jog, dynamic prep, 2 × 20m gradual accelerations (50% → 70% → 90%). Must feel sharp.'),
    condEx(`${prefix}-reduced`, `${reps} × 20m flying sprint (reduced)`, 2, reps, 1, 1, 180,
      `${reps} reps: 20m build → 20m max velocity.\n` +
      'Full walk-back recovery (3min).\n' +
      'Intensity: 9-10/10 — neural, reduced volume.\n' +
      `${combined ? 'Combined S+C day — ' : ''}Reduced-volume sprint retrofit.`),
  ];
}

/** Append a single coach-tone note to the headline (non-warm-up, non-cool-down) row. */
function appendNoteToHeadline(
  exercises: WorkoutExercise[],
  note: string,
): WorkoutExercise[] {
  if (exercises.length === 0) return exercises;
  const headlineIdx = exercises.findIndex((ex) => {
    const n = (ex.exercise?.name || '').toLowerCase();
    return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
  });
  const idx = headlineIdx >= 0 ? headlineIdx : exercises.length - 1;
  return exercises.map((ex, i) => {
    if (i !== idx) return ex;
    const existing = ex.notes || '';
    return {
      ...ex,
      notes: existing ? `${existing}\n\n${note}` : note,
    };
  });
}

/** Internal: raw template builder. Wrapped by buildConditioningTemplate.
 *
 * Accepts an optional `feel` hint (grindy / sharp / flowing) to drive
 * in-template variety beyond the date-hash rotation, and an optional
 * `ergModality` to bias off-feet templates toward a specific erg. These
 * are used by the weekly scheduler to avoid repeating the same modality
 * twice within a week and to differentiate sessions by density/feel.
 */
function buildConditioningTemplateRaw(
  exerciseName: string,
  dateStr: string,
  feel?: ConditioningFeel,
  ergModality?: ErgModality,
): WorkoutExercise[] {
  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}`;
  // `feel`/`ergModality` are used within a few templates below (Long
  // Nasal Run, Tabata variants etc.); touch here to satisfy unused-param
  // lint when a template doesn't consume them.
  void feel; void ergModality;

  switch (exerciseName) {

    // ════════════════════════════════════════════════
    // 🔵 1. LONG INTERVAL / AEROBIC POWER
    // ════════════════════════════════════════════════

    case '1km Repeat Intervals': {
      // Bucket: Aerobic Power
      // Purpose: Build sustained high-output engine and pacing discipline
      // Duration cap: standalone ≤45min. Locked to 4–5 reps, 6min start-interval
      // so total session = 10min warmup + (reps × 6min) + 5min cool ≤ 45min.
      const reps = 4 + (hash % 2); // 4–5 reps
      const startEvery = 6; // fixed 6 min — keeps cap-compliant
      return [
        condEx(`${prefix}-warmup`, 'Run warm-up', 1, 1, 1, 1, 0,
          '10min easy jog, then dynamic prep: leg swings, walking lunges, A-skips, high knees, butt kicks. Finish with 2 × 200m strides.'),
        condEx(`${prefix}-intervals`, `${reps} × 1km repeats`, 2, reps, 1, 1, 0,
          `${reps} × 1km — start every ${startEvery} min.\n` +
          'Intensity: 8-9/10 — VO2 effort.\n' +
          'Consistent pacing — not all-out sprinting.\n' +
          'Walk/jog in remaining time before next rep.'),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog, stretch'),
      ];
    }

    case '4x4 VO2': {
      // Bucket: Aerobic Power / VO2 (Norwegian Method)
      // Purpose: Maximise VO2 output and cardiac adaptation
      // Bike / row preferred. Controlled hard effort, not a sprint.
      // Duration cap: standalone ≤45min. 10 warmup + reps × (4min + rest) + 5 cool.
      // Rest locked to 2min so 5 reps × 6min = 30min → 45min total max.
      const reps = 4 + (hash % 2 === 0 ? 0 : 1); // 4–5 reps (5th is rare)
      const rest = 2; // fixed 2min recovery — keeps cap-compliant
      return [
        condEx(`${prefix}-warmup`, 'Conditioning warm-up', 1, 1, 1, 1, 0,
          '10min easy bike/row, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)'),
        condEx(`${prefix}-vo2`, `${reps} × 4min VO2 intervals`, 2, reps, 1, 1, rest * 60,
          `${reps} × 4min at high aerobic intensity (~90% HRmax).\n` +
          `Intensity: 8-9/10.\n` +
          `${rest}min easy recovery between intervals.\n` +
          'Controlled hard effort — not a sprint. Bike or row preferred.'),
        condEx(`${prefix}-cooldown`, 'Easy cool-down', 3, 1, 1, 1, 0,
          '5min easy spin/row, stretch'),
      ];
    }

    // ════════════════════════════════════════════════
    // 🔴 2. MAS / HIGH-INTENSITY INTERVALS
    // ════════════════════════════════════════════════

    case 'MAS 15:15 Blocks': {
      // Bucket: High-intensity aerobic power
      // Purpose: Repeat high-speed efforts with controlled fatigue
      // Prescription: 15s work → ${masIntensityLabel(15)} (110% MAS — ≤30s rule).
      const rounds = 3 + (hash % 3); // 3–5 rounds
      return [
        condEx(`${prefix}-warmup`, 'Interval warm-up', 1, 1, 1, 1, 0,
          '10min jog, then dynamic prep: leg swings, walking lunges, A-skips, high knees, hip openers. Finish with 3 × 80m strides at 80%.'),
        condEx(`${prefix}-intervals`, `15:15 intervals × ${rounds} rounds`, 2, rounds, 1, 1, 120,
          `15s on / 15s off × 4min block.\n` +
          `Rest 2min between blocks.\n` +
          `${rounds} rounds total.\n` +
          `\n${MAS_FALLBACK_NOTE}\n` +
          `\nTarget pace: ${masIntensityLabel(15)} on each 15s work rep.\n` +
          'Intensity: 9/10 — glycolytic repeat effort.\n' +
          'Must stay sharp — stop if form collapses.'),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog, stretch'),
      ];
    }

    case 'Tabata Intervals': {
      // Bucket: High-intensity metabolic
      // Purpose: High lactate tolerance + repeat effort
      // Bike / row / ski preferred
      const rounds = 4 + (hash % 3); // 4–6 rounds
      return [
        condEx(`${prefix}-warmup`, 'Interval warm-up', 1, 1, 1, 1, 0,
          '5min easy bike/row, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)'),
        condEx(`${prefix}-tabata`, `Tabata 20:10 × ${rounds} rounds`, 2, rounds, 1, 1, 120,
          `20s on / 10s off × 4min block.\n` +
          `Rest 2min between blocks.\n` +
          `${rounds} rounds total.\n` +
          'Intensity: 8-9/10 — glycolytic.\n' +
          'Max effort on working intervals. Bike/row/ski.'),
        condEx(`${prefix}-cooldown`, 'Easy cool-down', 3, 1, 1, 1, 0,
          '3min easy spin/row, stretch'),
      ];
    }

    case 'Inverse Tabata': {
      // Bucket: Speed endurance
      // Purpose: Maintain quality output with more recovery
      // Air bike preferred. Lower fatigue than standard Tabata.
      const rounds = 4 + (hash % 3); // 4–6 rounds
      return [
        condEx(`${prefix}-warmup`, 'Interval warm-up', 1, 1, 1, 1, 0,
          '5min easy bike, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)'),
        condEx(`${prefix}-inv-tabata`, `Inverse Tabata 10:20 × ${rounds} rounds`, 2, rounds, 1, 1, 120,
          `10s on / 20s off × 4min block.\n` +
          `Rest 2min between blocks.\n` +
          `${rounds} rounds total.\n` +
          'Intensity: 8-9/10 — quality > volume. Air bike preferred.'),
        condEx(`${prefix}-cooldown`, 'Easy cool-down', 3, 1, 1, 1, 0,
          '3min easy spin, stretch'),
      ];
    }

    // ════════════════════════════════════════════════
    // ⚡ 3. SPRINT / ALACTIC
    // ════════════════════════════════════════════════

    case 'Max Effort Sprint Accumulation': {
      // Bucket: Alactic power
      // Purpose: Max output without fatigue spillover
      // Air bike / echo bike. Neural + power session.
      const formats = [
        { reps: 2, dur: '30s', rest: 180, note: '2 × 30s max effort sprints. Start every 3min. MUST be max effort — full recovery between.' },
        { reps: 3, dur: '20s', rest: 120, note: '3 × 20s max effort sprints. Start every 2min. Full commitment, full recovery.' },
        { reps: 6, dur: '10s', rest: 60, note: '6 × 10s max effort sprints. Start every 1min. Explosive — zero pacing.' },
      ];
      const fmt = formats[hash % formats.length];
      return [
        condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
          '5min easy bike, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)'),
        condEx(`${prefix}-sprints`, `Sprint accumulation (${fmt.reps} × ${fmt.dur})`, 2, fmt.reps, 1, 1, fmt.rest,
          `Accumulate 60s total max sprinting.\n${fmt.note}\n` +
          'Intensity: 9-10/10 — quality-based, full recovery.'),
        condEx(`${prefix}-cooldown`, 'Easy spin', 3, 1, 1, 1, 0,
          '3min easy spin, stretch'),
      ];
    }

    case 'Free Sprint Session': {
      // Bucket: Alactic sprint
      // Purpose: Speed, mechanics, neural freshness
      // Field or hill. Quality > volume. Never fatigued sprinting.
      const formats = [
        { dist: '20–40m', note: 'Short acceleration sprints. 20–40m × 6–8 reps. Full walk-back recovery. Focus on first-step explosion.' },
        { dist: '40–60m', note: 'Medium sprints. 40–60m × 5–6 reps. Full walk-back recovery. Focus on acceleration + top speed.' },
        { dist: '60–100m', note: 'Longer sprints. 60–100m × 4–5 reps. Full 3min recovery. Focus on speed maintenance and mechanics.' },
      ];
      const fmt = formats[hash % formats.length];
      return [
        condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
          '12min jog, then dynamic prep: leg swings, walking lunges, A-skips, high knees, butt kicks, straight-leg bounds, ankling. Finish with 4 × 20m gradual accelerations (50% → 70% → 80% → 90%).'),
        condEx(`${prefix}-sprints`, `Free sprints (${fmt.dist})`, 2, 1, 1, 1, 0,
          `20min total session.\n${fmt.note}\n` +
          'Intensity: 9-10/10 — quality-based.\n' +
          'Quality > volume. Stop if any rep feels sluggish.'),
        condEx(`${prefix}-cooldown`, 'Cool-down jog + stretch', 3, 1, 1, 1, 0,
          '5min easy jog, hamstring/hip flexor/calf stretch'),
      ];
    }

    case 'Flying Sprints': {
      // Bucket: Neural / top-end speed
      // Purpose: Max velocity exposure with full recovery — quality > volume
      // Field session. NOT a conditioning fatigue session.
      // Duration cap: standalone ≤45min. Capped at 3–5 reps with 2–3min rest
      // so: 15 warmup + 5 × 3min + 5 cool ≈ 35min worst-case.
      const reps = 3 + (hash % 3); // 3–5 reps
      const buildup = 20 + (hash % 2) * 10; // 20 or 30m
      const maxV = 20 + (hash % 2) * 10; // 20 or 30m
      const rest = 2 + (hash % 2); // 2–3 min full recovery
      return [
        condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
          '15min easy jog, then dynamic prep: leg swings, walking lunges, hip openers, high knees, butt kicks, A-skips, B-skips, straight-leg bounds, pogo hops.\n' +
          '4 × 20m gradual accelerations (50% → 70% → 80% → 90%).\n' +
          'Must feel sharp before first rep.'),
        condEx(`${prefix}-flying`, `Flying sprints (${reps} × ${buildup}m build + ${maxV}m max)`, 2, reps, 1, 1, rest * 60,
          `${reps} reps:\n` +
          `• ${buildup}m gradual acceleration to ~95%\n` +
          `• ${maxV}m at max velocity\n` +
          `• ${rest}min FULL recovery between reps (walk back, wait).\n\n` +
          'Intensity: 9-10/10 — quality-based neural session.\n\n' +
          'Rules:\n' +
          '• Full recovery is mandatory — no fatigue sprinting.\n' +
          '• Quality > volume. Stop if any rep feels sluggish.\n' +
          '• This is a neural/speed session, not conditioning.\n' +
          '• Focus: hip height, relaxation at top speed, ground contact.'),
        condEx(`${prefix}-cooldown`, 'Cool-down jog + stretch', 3, 1, 1, 1, 0,
          '5min easy jog, hamstring/hip flexor/calf stretch'),
      ];
    }

    // ════════════════════════════════════════════════
    // 🟣 4. REPEAT SPRINT / GAME CONDITIONING
    // ════════════════════════════════════════════════

    case '200m/400m Repeat Runs': {
      // Bucket: Game conditioning
      // Purpose: Repeat effort under fatigue
      const isLong = hash % 2 === 0;
      const dist = isLong ? '400m' : '200m';
      const startEvery = isLong ? 3 : 2; // min
      const duration = 20 + (hash % 3) * 5; // 20–30 min
      return [
        condEx(`${prefix}-warmup`, 'Run warm-up', 1, 1, 1, 1, 0,
          '8min easy jog, then dynamic prep: leg swings, walking lunges, A-skips, high knees, butt kicks. Finish with 2 × 100m strides.'),
        condEx(`${prefix}-repeats`, `${dist} repeats (${duration}min)`, 2, 1, 1, 1, 0,
          `${dist} every ${startEvery}min for ${duration}min.\n` +
          'Intensity: 8-9/10 — glycolytic repeat effort.\n' +
          'Consistent output — avoid early burnout.\n' +
          'Walk/jog remaining time before next rep.'),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog, stretch'),
      ];
    }

    case 'Footy Fartlek': {
      // Bucket: Game-specific conditioning
      // Purpose: Mimic AFL movement patterns
      // Oval sessions — game simulation
      // Duration cap: standalone ≤45min. Each round ≈ 3 reps × ~2min work + 2min rest.
      // Locked to 3 rounds × 3–4 reps so total stays well under 45min.
      const reps = 3 + (hash % 3); // 3–5 reps per round
      const rounds = 3; // fixed — keeps volume controlled
      return [
        condEx(`${prefix}-warmup`, 'Dynamic warm-up', 1, 1, 1, 1, 0,
          '10min: jog, high knees, butt kicks, A-skips, lateral shuffles, 3 × 20m gradual accelerations (50% → 70% → 90%)'),
        condEx(`${prefix}-fartlek`, `Footy fartlek (${rounds} rounds × ${reps} reps)`, 2, rounds, reps, reps, 150,
          `Goal-to-goal sprint (200m)\n` +
          `Very slow 50m recovery\n` +
          `Sprint centre square (50m)\n` +
          `Very slow jog\n\n` +
          `${reps} reps per round. Rest 2–3min between rounds.\n` +
          `${rounds} rounds total.\n` +
          'Intensity: 8/10 — game-simulation repeat effort.'),
        condEx(`${prefix}-cooldown`, 'Cool-down jog + stretch', 3, 1, 1, 1, 0,
          '5min easy jog, full body stretch'),
      ];
    }

    // ════════════════════════════════════════════════
    // 🟢 5. AEROBIC BASE / RECOVERY
    // ════════════════════════════════════════════════

    case 'Long Nasal Run': {
      // Bucket: Aerobic base
      // Purpose: Build engine + recovery
      // Variation: rotate modality (run / bike / row / ski) and structure
      // (steady vs fartlek-style surges) by date hash so aerobic base
      // doesn't feel identical week-to-week. Run gets the highest weight
      // because AFL is a running sport.
      // ergModality hint from the weekly scheduler can force a specific
      // erg to avoid repeating a modality already used this week.
      const duration = 35 + (hash % 3) * 5; // 35–45 min
      let modLabel: string;
      let modNote: string;
      if (ergModality === 'bike') {
        modLabel = 'Assault Bike';
        modNote = 'Smooth cadence 80–90rpm, low resistance.';
      } else if (ergModality === 'row') {
        modLabel = 'Rower';
        modNote = 'Stroke rate 20–24, relaxed recovery between drives.';
      } else if (ergModality === 'ski') {
        modLabel = 'SkiErg';
        modNote = 'Relaxed arm rhythm, drive from hips — no grip strain.';
      } else if (ergModality === 'mixed') {
        modLabel = 'Row + SkiErg (mixed)';
        modNote = 'Alternate 5min Rower / 5min SkiErg blocks, smooth and relaxed.';
      } else {
        const modVariant = hash % 5;
        const pair =
          modVariant === 0 || modVariant === 1
            ? ['run', 'Nasal breathing encouraged on easy stretches.']
            : modVariant === 2
            ? ['Assault Bike', 'Smooth cadence 80–90rpm, low resistance.']
            : modVariant === 3
            ? ['Rower', 'Stroke rate 20–24, relaxed recovery between drives.']
            : ['SkiErg', 'Relaxed arm rhythm, drive from hips — no grip strain.'];
        modLabel = pair[0];
        modNote = pair[1];
      }
      // Structure variant: drive by feel if supplied, else hash.
      //   flowing → pure steady    (default aerobic character)
      //   sharp   → steady + surges (lifts the intensity feel briefly)
      //   grindy  → fartlek        (continuous, repeating)
      const structVariant = feel === 'flowing' ? 0
        : feel === 'sharp' ? 1
        : feel === 'grindy' ? 2
        : hash % 3;
      const structBlock =
        structVariant === 0
          ? `${duration}min zone 2 steady state.`
          : structVariant === 1
          ? `${duration}min: steady zone 2, with 3 × 60s surges to high zone 2 at ${Math.floor(duration / 4)}min, ${Math.floor(duration / 2)}min and ${Math.floor((3 * duration) / 4)}min.`
          : `${duration}min fartlek: alternating 4min zone 2 / 1min high-zone 2 throughout. Never red, never sprinting.`;
      return [
        condEx(`${prefix}-run`, `${duration}min zone 2 ${modLabel}`, 1, 1, 1, 1, 0,
          `${structBlock}\n` +
          `${modNote}\n` +
          'Intensity: 5-6/10 — conversational pace.\n' +
          'Must feel easy — no drift into tempo.'),
      ];
    }

    // ════════════════════════════════════════════════
    // LEGACY — kept for resolver compatibility
    // (resolveConditioning still references these names)
    // ════════════════════════════════════════════════

    case 'Flush Run':
      return [condEx(`${prefix}-flush`, 'Flush run', 1, 1, 1, 1, 0,
        '20min easy run at conversational pace (Zone 1–2). Purpose: flush metabolites, promote blood flow, aid recovery.')];

    case 'Easy Bike':
      return [condEx(`${prefix}-bike`, 'Easy bike', 1, 1, 1, 1, 0,
        '20min easy spin (Zone 1–2). Low resistance, high cadence (80–90rpm). Recovery only.')];

    case 'Easy Row':
      return [condEx(`${prefix}-row`, 'Easy row', 1, 1, 1, 1, 0,
        '15–20min easy row (Zone 1–2). Stroke rate 18–22. Smooth technique, not power.')];

    case 'Easy Ski':
      return [condEx(`${prefix}-ski`, 'Easy SkiErg', 1, 1, 1, 1, 0,
        '15–20min easy SkiErg (Zone 1–2). Smooth, relaxed rhythm. Recovery focus.')];

    case 'Easy Swim':
      return [condEx(`${prefix}-swim`, 'Easy swim', 1, 1, 1, 1, 0,
        '20–30min easy swim. Mix of freestyle and backstroke. Recovery pace.')];

    case 'Light Circuits':
      return [condEx(`${prefix}-circuits`, 'Light recovery circuit', 1, 2, 1, 1, 60,
        '2 rounds — easy pace, no rushing:\n• 2min easy bike\n• 10 bodyweight squats\n• 10 push-ups\n• 30s plank\n• 2min easy row\n60s rest between rounds. Purpose: blood flow, not fitness.')];

    default:
      return [
        condEx(`${prefix}-session`, exerciseName, 1, 1, 1, 1, 0, `${exerciseName} — see coach notes for details`),
      ];
  }
}

// ════════════════════════════════════════════════════════════════════
// RUNNING EXPOSURE LIMIT — Off-Feet Modality Switching
// ════════════════════════════════════════════════════════════════════

/**
 * Templates that are TRUE speed / sprint exposures — running IS the
 * intent, not a modality choice. These never get the modality-flexibility
 * note and never get converted to off-feet by the run-load guard.
 */
export const SPEED_SPRINT_TEMPLATES = new Set<string>([
  'Flying Sprints',
  'Free Sprint Session',
  'Max Effort Sprint Accumulation',
]);

/**
 * Templates whose modality CAN be swapped out for an ergo without
 * losing the training intent. Aerobic, tempo, repeat-effort, fartlek,
 * MAS-style work all qualify — the stimulus carries on bike/row/ski.
 */
export function isModalityFlexibleConditioning(exerciseName: string): boolean {
  if (SPEED_SPRINT_TEMPLATES.has(exerciseName)) return false;
  const meta = CONDITIONING_META[exerciseName];
  if (meta) {
    // run + (mixed where the stimulus is conditioning, not pure sprint) qualify
    return meta.modality === 'run'
      || meta.modality === 'mixed'
      || meta.modality === 'bike'
      || meta.modality === 'row'
      || meta.modality === 'ski';
  }
  // Unknown template — be permissive for aerobic/tempo/conditioning style names
  return /run|interval|tempo|aerobic|fartlek|repeat|MAS|threshold|VO2|nasal/i
    .test(exerciseName);
}

/**
 * Check if a conditioning exercise is running-based (ground contact).
 * Uses CONDITIONING_META modality where available, falls back to name matching.
 */
export function isRunningBasedConditioning(exerciseName: string): boolean {
  const meta = CONDITIONING_META[exerciseName];
  if (meta) return meta.modality === 'run';
  // Fallback: match template names that are running
  const runNames = /run|sprint|fartlek|1km|200m|400m|MAS 15:15|flying/i;
  return runNames.test(exerciseName);
}

/**
 * Returns the standard coach-tone "this can be done off-feet" note for
 * modality-flexible aerobic / tempo / repeat-effort sessions. Returned
 * as a single line so callers can append to existing prescription notes.
 */
export const MODALITY_FLEX_NOTE =
  'Can also be completed on bike, rower, SkiErg, or Assault Bike. ' +
  'If your weekly run load is already high, prefer a non-running modality.';

/** Coach-tone note stamped on sessions converted by the run-load guard. */
export const RUN_LOAD_SHIFT_NOTE =
  'Shifted to non-running modality to manage weekly run load.';

/**
 * Tag a freshly converted off-feet conditioning block with the coach
 * "Shifted to non-running modality" note, prepended to the headline
 * prescription row. Pure: returns a new array, does not mutate input.
 */
export function tagAsShiftedFromRun(
  exercises: WorkoutExercise[],
): WorkoutExercise[] {
  if (exercises.length === 0) return exercises;
  // Find the headline row — first non-warm-up / non-cool-down.
  const headlineIdx = exercises.findIndex((ex) => {
    const n = (ex.exercise?.name || '').toLowerCase();
    return !n.includes('warm-up') && !n.includes('cool-down') && !n.includes('cooldown');
  });
  const idx = headlineIdx >= 0 ? headlineIdx : exercises.length - 1;
  return exercises.map((ex, i) => {
    if (i !== idx) return ex;
    const existing = ex.notes || '';
    const stamped = existing
      ? `${RUN_LOAD_SHIFT_NOTE}\n\n${existing}`
      : RUN_LOAD_SHIFT_NOTE;
    return { ...ex, notes: stamped };
  });
}

/**
 * Convenience wrapper: convert a run-based conditioning template to an
 * off-feet equivalent AND stamp the shift note. Returns null if the
 * template is not eligible for conversion (sprint/speed templates).
 */
export function convertToOffFeetWithNote(
  exerciseName: string,
  dateStr: string,
): WorkoutExercise[] | null {
  if (SPEED_SPRINT_TEMPLATES.has(exerciseName)) return null;
  const converted = switchToOffFeetModality(exerciseName, dateStr);
  if (!converted || converted.length === 0) return null;
  return tagAsShiftedFromRun(converted);
}

/**
 * Convert a running-based conditioning template to an off-feet equivalent.
 * Preserves the conditioning STIMULUS (intensity, work:rest, structure)
 * but changes MODALITY to bike/row/ski.
 *
 * The user should not notice a difference in session intent — only the modality changes.
 *
 * @param exerciseName - Original running-based exercise name
 * @param dateStr      - ISO date for hash-based variety of modality
 * @returns            - Off-feet exercise template array, or null if no conversion needed
 */
export function switchToOffFeetModality(
  exerciseName: string,
  dateStr: string,
): WorkoutExercise[] | null {
  if (!isRunningBasedConditioning(exerciseName)) return null;
  // Flying Sprints are top-end speed exposure — NEVER convert off-feet.
  if (exerciseName === 'Flying Sprints') return null;

  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}`;
  const modalities = ['bike', 'row', 'ski'] as const;
  const mod = modalities[hash % modalities.length];
  const modLabel = mod === 'bike' ? 'Assault Bike' : mod === 'row' ? 'Rower' : 'SkiErg';

  // Map each running template to an equivalent off-feet session
  switch (exerciseName) {

    // ── MAS / HI → Bike/Row intervals ──
    case 'MAS 15:15 Blocks': {
      // Prescription: 15s work → 110% MAS (≤30s rule).
      const rounds = 3 + (hash % 3);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `10min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-intervals`, `15:15 intervals × ${rounds} rounds (${modLabel})`, 2, rounds, 1, 1, 120,
          `15s on / 15s off × 4min block on ${modLabel}.\n` +
          `Rest 2min between blocks.\n${rounds} rounds total.\n` +
          `\n${MAS_FALLBACK_NOTE}\n` +
          `\nTarget pace: ${masIntensityLabel(15)} equivalent on each 15s work rep.\n` +
          'Intensity: 9/10 — glycolytic repeat effort.\n' +
          'Must stay sharp — stop if form collapses.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${mod}, stretch`),
      ];
    }

    case 'Tabata Intervals': {
      const rounds = 4 + (hash % 3);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-tabata`, `Tabata 20:10 × ${rounds} rounds (${modLabel})`, 2, rounds, 1, 1, 120,
          `20s on / 10s off × 4min block on ${modLabel}.\n` +
          `Rest 2min between blocks.\n${rounds} rounds total.\n` +
          'Intensity: 8-9/10 — glycolytic.\n' +
          `Max effort on working intervals.`),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${mod}, stretch`),
      ];
    }

    case 'Inverse Tabata': {
      const rounds = 4 + (hash % 3);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-inv-tabata`, `Inverse Tabata 10:20 × ${rounds} rounds (${modLabel})`, 2, rounds, 1, 1, 120,
          `10s on / 20s off × 4min block on ${modLabel}.\n` +
          `Rest 2min between blocks.\n${rounds} rounds total.\n` +
          'Intensity: 8-9/10 — quality > volume.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${mod}, stretch`),
      ];
    }

    // ── Sprint / Alactic → Bike sprints ──
    case 'Max Effort Sprint Accumulation': {
      const formats = [
        { reps: 2, dur: '30s', rest: 180, note: `2 × 30s max effort on ${modLabel}. Start every 3min. Full recovery.` },
        { reps: 3, dur: '20s', rest: 120, note: `3 × 20s max effort on ${modLabel}. Start every 2min. Full recovery.` },
        { reps: 6, dur: '10s', rest: 60, note: `6 × 10s max effort on ${modLabel}. Start every 1min. Explosive.` },
      ];
      const fmt = formats[hash % formats.length];
      return [
        condEx(`${prefix}-warmup`, `${modLabel} sprint warm-up`, 1, 1, 1, 1, 0,
          `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-sprints`, `Sprint accumulation (${fmt.reps} × ${fmt.dur}, ${modLabel})`, 2, fmt.reps, 1, 1, fmt.rest,
          `Accumulate 60s total max effort on ${modLabel}.\n${fmt.note}\n` +
          'Intensity: 9-10/10 — quality-based, full recovery.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${mod}, stretch`),
      ];
    }

    case 'Free Sprint Session': {
      return [
        condEx(`${prefix}-warmup`, `${modLabel} sprint warm-up`, 1, 1, 1, 1, 0,
          `5min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-sprints`, `Free sprints on ${modLabel}`, 2, 1, 1, 1, 0,
          `20min session: 6–8 × 10–15s max effort on ${modLabel}.\n` +
          'Intensity: 9-10/10 — quality-based.\n' +
          'Full recovery between reps (easy spin/row until HR settles).\n' +
          'Quality > volume. Stop if output drops.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${mod}, stretch`),
      ];
    }

    case 'Flying Sprints': {
      // Flying sprints are field-only — neural session. Convert to bike sprint equiv.
      const reps = 3 + (hash % 4);
      const rest = 2 + (hash % 3);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} sprint warm-up`, 1, 1, 1, 1, 0,
          `10min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-flying`, `${modLabel} max velocity sprints (${reps} × 10–15s)`, 2, reps, 1, 1, rest * 60,
          `${reps} reps: 5s progressive build → 10–15s max effort on ${modLabel}.\n` +
          `${rest}min FULL recovery between reps.\n` +
          'Intensity: 9-10/10 — quality-based neural equivalent.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${mod}, stretch`),
      ];
    }

    // ── Tempo / Aerobic Power → Machine intervals ──
    case '1km Repeat Intervals': {
      const reps = 4 + (hash % 3);
      const workTime = mod === 'bike' ? '3:30' : '3:45';
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `10min easy ${mod}, then dynamic prep: leg swings, walking lunges, hip openers, high knees, ankling. Finish with 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps).`),
        condEx(`${prefix}-intervals`, `${reps} × ${workTime} intervals (${modLabel})`, 2, reps, 1, 1, 0,
          `${reps} × ${workTime} at 1km-repeat intensity on ${modLabel}.\n` +
          'Intensity: 8-9/10 — VO2 effort.\n' +
          'Start every 7min. Consistent output.\n' +
          'Easy recovery between reps.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${mod}, stretch`),
      ];
    }

    case '4x4 VO2': {
      const reps = 4 + (hash % 2 === 0 ? 0 : 1);
      const rest = 2 + (hash % 2);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `10min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-vo2`, `${reps} × 4min VO2 intervals (${modLabel})`, 2, reps, 1, 1, rest * 60,
          `${reps} × 4min at ~90% HRmax on ${modLabel}.\n` +
          `Intensity: 8-9/10.\n` +
          `${rest}min easy recovery between intervals.\n` +
          'Controlled hard effort — not a sprint.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${mod}, stretch`),
      ];
    }

    case '200m/400m Repeat Runs': {
      const isLong = hash % 2 === 0;
      const workTime = isLong ? '90s' : '45s';
      const duration = 20 + (hash % 3) * 5;
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `8min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-repeats`, `${workTime} repeats on ${modLabel} (${duration}min)`, 2, 1, 1, 1, 0,
          `${workTime} hard / easy recovery on ${modLabel} for ${duration}min.\n` +
          'Intensity: 8-9/10 — glycolytic repeat effort.\n' +
          'Consistent output. Equivalent of 200m/400m repeats.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${mod}, stretch`),
      ];
    }

    case 'Footy Fartlek': {
      const reps = 3 + (hash % 3); // 3–5 reps per round
      const rounds = 3; // fixed — keeps volume controlled
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          `10min easy ${mod}, 3 × 5-10s gradual accelerations (easy → moderate → fast, easy between reps)`),
        condEx(`${prefix}-fartlek`, `Fartlek intervals on ${modLabel} (${rounds} rounds × ${reps} reps)`, 2, rounds, reps, reps, 150,
          `Hard 30s / easy 30s × ${reps} reps per round on ${modLabel}.\n` +
          `Rest 2–3min between rounds. ${rounds} rounds total.\n` +
          'Intensity: 8/10 — game-conditioning equivalent with varied output.'),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${mod}, stretch`),
      ];
    }

    // ── Aerobic → Steady-state machine ──
    case 'Long Nasal Run': {
      const duration = 35 + (hash % 3) * 5;
      return [
        condEx(`${prefix}-steady`, `${duration}min zone 2 ${mod}`, 1, 1, 1, 1, 0,
          `${duration}min zone 2 steady state on ${modLabel}.\n` +
          'Intensity: 5-6/10 — conversational pace.\n' +
          'Nasal breathing encouraged. Must feel easy.'),
      ];
    }

    default:
      // Unknown running template — generic machine conversion
      return [
        condEx(`${prefix}-session`, `${exerciseName} (${modLabel})`, 1, 1, 1, 1, 0,
          `${exerciseName} adapted to ${modLabel}. See coach notes.`),
      ];
  }
}

// ════════════════════════════════════════════════════════════════════
// AEROBIC FLUSH FINISHER — S+C days only
// ════════════════════════════════════════════════════════════════════

/** High-fatigue conditioning names that should NOT get a flush finisher. */
const HIGH_FATIGUE_CONDITIONING = new Set([
  'MAS 15:15 Blocks', 'Tabata Intervals', 'Inverse Tabata',
  'Max Effort Sprint Accumulation', 'Free Sprint Session', 'Flying Sprints',
  'Footy Fartlek', '200m/400m Repeat Runs',
]);

/**
 * Build an Aerobic Flush Finisher block for combined S+C days.
 *
 * Rules:
 *   - ONLY for S+C days (caller must check)
 *   - NOT for standalone conditioning
 *   - NOT for high-fatigue sessions (MAS, Tabata, RSA-heavy)
 *   - Must not impact recovery or next-day performance
 *
 * Structure: 15–30min, 30s on / 30s steady, Intensity 5-6/10, bike preferred.
 *
 * @param conditioningName - The conditioning template used on this S+C day
 * @param dateStr          - ISO date for hash variety
 * @returns                - Finisher exercises, or empty array if not appropriate
 */
export function buildAerobicFlushFinisher(
  conditioningName: string,
  dateStr: string,
): WorkoutExercise[] {
  // Guard: skip for high-fatigue conditioning
  if (HIGH_FATIGUE_CONDITIONING.has(conditioningName)) return [];

  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}`;
  const duration = 15 + (hash % 4) * 5; // 15, 20, 25, or 30 min
  const modalities = ['bike', 'row', 'ski'] as const;
  const mod = modalities[hash % modalities.length];
  const modLabel = mod === 'bike' ? 'Assault Bike' : mod === 'row' ? 'Rower' : 'SkiErg';

  return [
    condEx(`${prefix}-flush-finisher`, `Aerobic flush (${duration}min ${modLabel})`, 99, 1, 1, 1, 0,
      `${duration}min aerobic flush on ${modLabel}:\n` +
      '30s moderate / 30s easy steady — repeat.\n' +
      'Intensity: 5-6/10 — conversational pace.\n' +
      'Purpose: low-fatigue aerobic volume, not a second hard session.\n' +
      'Must not feel difficult. Skip if fatigued.'),
  ];
}

/**
 * Build a conditioning session for a given date, if one is valid.
 *
 * Uses the conditioning rule engine to determine tier placement,
 * then returns a Workout with fully populated exercise templates.
 * Returns null if no conditioning is valid (non-forcing rule).
 *
 * @param dateStr         - ISO date (YYYY-MM-DD)
 * @param gameDates       - All game dates in the block
 * @param athlete         - Athlete context (injuries)
 * @param seasonPhase     - Current season phase
 * @param weekLog         - Conditioning + strength sessions already placed this week
 * @param microcycleId    - ID to stamp on the workout
 */
export function buildConditioningSession(
  dateStr: string,
  gameDates: string[],
  athlete: AthleteContext,
  seasonPhase: SeasonPhase,
  weekLog: WeekLog,
  microcycleId: string,
): Workout | null {
  // Build conditioning context
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dayOfWeek = date.getDay();

  let daysToGame: number | null = null;
  let daysSinceGame: number | null = null;
  for (const gd of gameDates) {
    const [gy, gm, gdd] = gd.split('-').map(Number);
    const gameDate = new Date(gy, gm - 1, gdd, 12, 0, 0, 0);
    const diffMs = gameDate.getTime() - date.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && (daysToGame === null || diffDays < daysToGame)) {
      daysToGame = diffDays;
    }
    if (diffDays < 0 && (daysSinceGame === null || -diffDays < daysSinceGame)) {
      daysSinceGame = -diffDays;
    }
  }

  // Build active injuries map
  const activeInjuries: Record<string, 'caution' | 'avoid'> = {};
  for (const inj of athlete.injuries) {
    const sev = (inj.severity?.toLowerCase() === 'mild') ? 'caution' as const : 'avoid' as const;
    activeInjuries[inj.bodyArea] = sev;
  }

  const ctx: ConditioningContext = {
    dateStr,
    daysToGame,
    daysSinceGame,
    dayOfWeek,
    seasonPhase,
    activeInjuries,
  };

  // Resolve conditioning
  const result = resolveConditioning(ctx, weekLog);
  if (!result) return null;

  // Build Workout from result
  const now = new Date().toISOString();
  const workoutId = `cond-${result.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${dateStr}`;

  // Build deterministic exercise template
  const exercises = buildConditioningTemplate(result.exerciseName, dateStr);
  // Stamp workoutId on all exercises
  for (const ex of exercises) {
    ex.workoutId = workoutId;
  }

  // Map conditioning tier to workout type
  const workoutType = conditioningWorkoutType(result.exerciseName);

  // ── Conditioning Progression ──
  // Resolve progression adjustments for this conditioning session.
  // The builder applies adjustments to duration/reps/intervals/rest.
  const baseDuration = conditioningDuration(result.tier);
  const progressionInput: ConditioningProgressionInput = {
    tier: result.tier,
    readiness: weekLog.readiness,
    recentRPE: 6, // default — no session history available at resolve time
    completionQuality: 'full', // default — assume previous session was completed
    hasAvoidInjury: Object.values(activeInjuries).some(s => s === 'avoid'),
    hasModifyInjury: Object.values(activeInjuries).some(s => s === 'caution'),
    seasonPhase,
    weeklyConditioningCount: weekLog.sessions.length,
    daysToGame,
    doubleGameWeek: weekLog.doubleGameWeek,
    highFatigueStrengthThisWeek: weekLog.strengthSessions.some(s => s.fatigue === 'high'),
    lastSessionProgressed: false, // default — no history tracking yet
    weeklyLoad: calculateConditioningLoad(weekLog.sessions),
    previousWeekLoad: 0, // default — no previous week available at resolve time
    currentReps: 6,         // sensible defaults for cap enforcement
    currentIntervals: 4,
    currentDuration: baseDuration,
    currentRest: result.tier === 'A' ? 120 : 60,
  };

  const progression = resolveConditioningProgression(progressionInput);

  // Apply progression adjustments
  const adjustedDuration = Math.max(
    15,
    baseDuration + (progression.adjustment.durationDelta || 0),
  );

  return {
    id: workoutId,
    microcycleId,
    dayOfWeek,
    name: result.exerciseName,
    description: result.exerciseName,
    durationMinutes: adjustedDuration,
    intensity: conditioningIntensity(result.tier),
    workoutType,
    sessionTier: result.tier === 'C' ? 'recovery' : 'core',
    exercises,
    createdAt: now,
    updatedAt: now,
    // Store progression metadata for downstream consumers
    _progressionState: progression.state,
    _progressionNote: progression.note,
    _progressionAdjustment: progression.adjustment,
  } as Workout & { _progressionState?: string; _progressionNote?: string; _progressionAdjustment?: any };
}

/** Map conditioning exercise to WorkoutType. */
export function conditioningWorkoutType(name: string): WorkoutType {
  const map: Record<string, WorkoutType> = {
    // ── New deterministic templates ──
    // Aerobic Power
    '1km Repeat Intervals': 'Conditioning',
    '4x4 VO2': 'Conditioning',
    // MAS / HI
    'MAS 15:15 Blocks': 'MAS-Training',
    'Tabata Intervals': 'Conditioning',
    'Inverse Tabata': 'Conditioning',
    // Sprint / Alactic
    'Max Effort Sprint Accumulation': 'Sprint-Intervals',
    'Free Sprint Session': 'Sprint-Intervals',
    // Neural / Top-End Speed
    'Flying Sprints': 'Sprint-Intervals',
    // Game Conditioning
    '200m/400m Repeat Runs': 'Conditioning',
    'Footy Fartlek': 'Conditioning',
    // Aerobic Base
    'Long Nasal Run': 'Long-Run',
    // ── Legacy (resolver compatibility) ──
    'Flush Run': 'Flush-Out',
    'Easy Bike': 'Recovery',
    'Easy Row': 'Recovery',
    'Easy Ski': 'Recovery',
    'Easy Swim': 'Recovery',
    'Light Circuits': 'Recovery',
  };
  return map[name] || 'Conditioning';
}

/** Approximate duration by tier. */
function conditioningDuration(tier: string): number {
  switch (tier) {
    case 'A': return 30;
    case 'B-high': return 40;
    case 'B-low': return 35;
    case 'C': return 20;
    default: return 30;
  }
}

/** Intensity label by tier. */
function conditioningIntensity(tier: string): IntensityLevel {
  switch (tier) {
    case 'A': return 'Maximal';
    case 'B-high': return 'High';
    case 'B-low': return 'Moderate';
    case 'C': return 'Light';
    default: return 'Moderate';
  }
}
