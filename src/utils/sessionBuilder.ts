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
  AttachedConditioningKind,
} from '../types/domain';
import type {
  FeedbackCompletion,
  FeedbackFeeling,
  SessionFeedback,
} from '../store/programStore';
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
    description: `${reason} - ${meta.descriptionSuffix}`,
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

export interface ConditioningProgressionData {
  sessionFeedback?: Record<string, SessionFeedback>;
}

function feedbackFeelingToConditioningRPE(feeling?: FeedbackFeeling | null): number | null {
  switch (feeling) {
    case 'very_easy': return 3;
    case 'easy': return 4;
    case 'good': return 6;
    case 'hard': return 8;
    case 'very_hard': return 9;
    default: return null;
  }
}

function conditioningComponentCompletion(feedback: SessionFeedback): FeedbackCompletion | null {
  const component = feedback.components?.find((entry) => entry.kind === 'conditioning');
  if (component) return component.completion;
  if (feedback.conditioning) return feedback.completion;
  return null;
}

function hasConditioningFeedback(feedback: SessionFeedback): boolean {
  return conditioningComponentCompletion(feedback) !== null;
}

function completionQualityFromFeedback(
  completion: FeedbackCompletion | null,
): ConditioningProgressionInput['completionQuality'] {
  if (completion === 'skipped') return 'failed';
  if (completion === 'partial') return 'partial';
  return 'full';
}

function recentConditioningFeedback(
  feedbackMap: Record<string, SessionFeedback> | undefined,
  beforeDate: string,
): SessionFeedback | null {
  if (!feedbackMap) return null;
  return Object.values(feedbackMap)
    .filter((feedback) => feedback.dateStr < beforeDate)
    .filter(hasConditioningFeedback)
    .sort((a, b) => b.dateStr.localeCompare(a.dateStr))[0] ?? null;
}

function mondayForISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = date.getDay();
  const mondayOffset = dow === 0 ? -6 : -(dow - 1);
  date.setDate(date.getDate() + mondayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function conditioningTierForFeedback(feedback: SessionFeedback): string {
  const sessionName = feedback.conditioning?.sessionName ?? '';
  const exact = CONDITIONING_META[sessionName]?.tier;
  if (exact) return exact;
  if (feedback.conditioning?.intervalsCompleted || feedback.conditioning?.roundsCompleted) return 'B-low';
  if (feedback.conditioning?.totalTimeMinutes) return 'C';
  return 'C';
}

function previousWeekConditioningLoad(
  feedbackMap: Record<string, SessionFeedback> | undefined,
  dateStr: string,
): number {
  if (!feedbackMap) return 0;
  const thisMonday = mondayForISO(dateStr);
  const previousMonday = addDaysISO(thisMonday, -7);
  const previousSunday = addDaysISO(thisMonday, -1);
  const sessions = Object.values(feedbackMap)
    .filter((feedback) => feedback.dateStr >= previousMonday && feedback.dateStr <= previousSunday)
    .filter(hasConditioningFeedback)
    .map((feedback) => ({ tier: conditioningTierForFeedback(feedback) }));
  return calculateConditioningLoad(sessions);
}

function primaryConditioningRow(exercises: WorkoutExercise[]): WorkoutExercise | null {
  const workRows = exercises.filter((exercise) => {
    const name = `${exercise.exercise?.name ?? ''} ${exercise.notes ?? ''}`.toLowerCase();
    return !/\bwarm-?up\b|\bcool\s*down\b|\beasy\b/.test(name);
  });
  return workRows.sort((a, b) => {
    const aScore = a.prescribedSets + (a.restSeconds > 0 ? 1 : 0);
    const bScore = b.prescribedSets + (b.restSeconds > 0 ? 1 : 0);
    return bScore - aScore;
  })[0] ?? exercises[0] ?? null;
}

export function deriveConditioningProgressionInputOverrides(args: {
  feedback: SessionFeedback | null;
  exercises: WorkoutExercise[];
  baseDuration: number;
}): Partial<ConditioningProgressionInput> {
  const { feedback, exercises, baseDuration } = args;
  if (!feedback) return {};

  const completion = conditioningComponentCompletion(feedback);
  const conditioningLog = feedback.conditioning;
  const primaryRow = primaryConditioningRow(exercises);
  const rpe = conditioningLog?.rpe ?? feedback.difficulty ?? feedbackFeelingToConditioningRPE(feedback.feeling);

  return {
    hasRecentFeedback: true,
    completionQuality: completionQualityFromFeedback(completion),
    recentRPE: rpe ?? 6,
    sorenessLevel: feedback.soreness,
    currentReps: conditioningLog?.roundsCompleted ?? conditioningLog?.intervalsCompleted ?? primaryRow?.prescribedRepsMax ?? 6,
    currentIntervals: conditioningLog?.intervalsCompleted ?? conditioningLog?.roundsCompleted ?? primaryRow?.prescribedSets ?? 4,
    currentDuration: conditioningLog?.totalTimeMinutes ?? baseDuration,
    currentRest: primaryRow?.restSeconds ?? 60,
  };
}

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

const MACHINE_OPTIONS_NOTE = 'Use Bike, Rower, SkiErg, or Assault Bike.';
const LOWER_BODY_MACHINE_NOTE = 'Machine-based conditioning keeps running load down today.';

function noteLines(...lines: Array<string | false | null | undefined>): string {
  return lines
    .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
    .join('\n');
}

function modLabelFromErg(mod: Exclude<ErgModality, 'mixed'>): string {
  if (mod === 'bike') return 'Assault Bike';
  if (mod === 'bike_erg') return 'BikeErg';
  return mod === 'row' ? 'Rower' : 'SkiErg';
}

function modLabelFromErgSelection(mod: ErgModality): string {
  return mod === 'mixed' ? 'Row + SkiErg' : modLabelFromErg(mod);
}

function shortWarmup(modLabel: string, minutes = 5): string {
  return noteLines(`${minutes}min easy ${modLabel}`, '2 short build-ups');
}

function easyBetweenReps(seconds: number): string {
  return seconds % 60 === 0
    ? `${seconds / 60}min easy between reps`
    : `${seconds}s easy between reps`;
}

type AerobicErgPrescription = {
  title: string;
  workLine: string;
  sets: number;
  restSeconds: number;
  restLine?: string;
};

function aerobicErgPrescription(
  mod: ErgModality,
  desiredMinutes: number,
  label: 'zone 2' | 'easy' | 'aerobic flush',
): AerobicErgPrescription {
  const modLabel = modLabelFromErgSelection(mod);
  const isBike = mod === 'bike' || mod === 'bike_erg';
  if (isBike) {
    return {
      title: `${desiredMinutes}min ${label} ${modLabel}`,
      workLine: `${desiredMinutes}min ${label} on ${modLabel}`,
      sets: 1,
      restSeconds: 0,
    };
  }

  const isShort = desiredMinutes <= 10 && mod !== 'mixed';
  if (isShort) {
    return {
      title: `${desiredMinutes}min ${label} ${modLabel}`,
      workLine: `${desiredMinutes}min ${label} on ${modLabel}`,
      sets: 1,
      restSeconds: 0,
    };
  }

  const blockMin = desiredMinutes <= 20 ? 10 : 8;
  const blocks = desiredMinutes <= 20 ? 2 : Math.max(3, Math.floor(desiredMinutes / blockMin));
  const actualTotal = blocks * blockMin;
  const workLine = mod === 'mixed'
    ? `${blocks} x ${blockMin}min ${label}, alternating Rower and SkiErg`
    : `${blocks} x ${blockMin}min ${label} on ${modLabel}`;
  return {
    title: `${blocks} x ${blockMin}min ${label} ${modLabel}`,
    workLine,
    sets: blocks,
    restSeconds: 120,
    restLine: `2min easy between blocks (${actualTotal}min total work)`,
  };
}

interface MachineSprintPrescription {
  reps: number;
  seconds: number;
  restSeconds: number;
  effort: 'all-out' | 'hard';
  qualityCue: string;
}

function machineSprintPrescription(
  modality: ErgModality,
  hash: number,
  feel?: ConditioningFeel,
  reduced = false,
): MachineSprintPrescription {
  if (modality === 'mixed') {
    return reduced
      ? { reps: 4, seconds: 20, restSeconds: 120, effort: 'hard', qualityCue: 'Full quality' }
      : { reps: 6, seconds: 20, restSeconds: 90, effort: 'hard', qualityCue: 'Full quality' };
  }

  if (modality === 'bike') {
    if (reduced) {
      return { reps: 4, seconds: 10, restSeconds: 120, effort: 'all-out', qualityCue: 'Max power, full quality' };
    }
    const assaultBikeVariants: MachineSprintPrescription[] = [
      { reps: 6, seconds: 10, restSeconds: 90, effort: 'all-out', qualityCue: 'Max power, full quality' },
      { reps: 8, seconds: 15, restSeconds: 120, effort: 'all-out', qualityCue: 'Max power, full quality' },
      { reps: 10, seconds: 10, restSeconds: 60, effort: 'all-out', qualityCue: 'Max power, full quality' },
    ];
    const idx = feel === 'grindy' ? 1 : feel === 'flowing' ? 2 : feel === 'sharp' ? 0 : hash % assaultBikeVariants.length;
    return assaultBikeVariants[idx];
  }

  if (reduced) {
    return { reps: 4, seconds: 20, restSeconds: 120, effort: 'hard', qualityCue: 'Full quality' };
  }
  const rhythmErgVariants: MachineSprintPrescription[] = [
    { reps: 6, seconds: 20, restSeconds: 90, effort: 'hard', qualityCue: 'Full quality' },
    { reps: 8, seconds: 25, restSeconds: 120, effort: 'hard', qualityCue: 'Full quality' },
    { reps: 5, seconds: 30, restSeconds: 150, effort: 'hard', qualityCue: 'Full quality' },
  ];
  const idx = feel === 'sharp' ? 0 : feel === 'flowing' ? 1 : feel === 'grindy' ? 2 : hash % rhythmErgVariants.length;
  return rhythmErgVariants[idx];
}

function machineSprintTitle(
  prescription: MachineSprintPrescription,
  modLabel: string,
  suffix = '',
): string {
  return `${prescription.reps} x ${prescription.seconds}s ${prescription.effort} (${modLabel}${suffix})`;
}

function machineSprintNotes(
  prescription: MachineSprintPrescription,
  modLabel: string,
  extraNote?: string,
): string {
  return noteLines(
    `${prescription.reps} x ${prescription.seconds}s ${prescription.effort} on ${modLabel}`,
    easyBetweenReps(prescription.restSeconds),
    prescription.qualityCue,
    extraNote,
  );
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
      // 4B: the old "tempo" pool (1km repeats / 4x4 VO2 / 200-400m) is
      // HARD work — it lives here now, labelled honestly.
      const options = [
        'MAS 15:15 Blocks',
        'Tabata Intervals',
        'Inverse Tabata',
        'Max Effort Sprint Accumulation',
        'Free Sprint Session',
        'Footy Fartlek',
        'Flying Sprints',
        '1km Repeat Intervals',
        '4x4 VO2',
        '200m/400m Repeat Runs',
      ];
      return options[hash % options.length];
    }
    case 'tempo': {
      // 4B: TRUE tempo templates only — controlled repeat efforts,
      // 6-7/10. Never VO2/MAS/hard-repeat templates under this name.
      const options = [
        'Tempo Intervals (1min on / 1min easy)',
        '30:30 Tempo Blocks',
        'Bike/Row/Ski Tempo Intervals',
        'Cruise Intervals',
      ];
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
 * each category at most once before duplicating.
 *
 * 'tempo' (Phase 4B, 2026-07-09) is TRUE medium conditioning:
 * controlled repeat efforts at 6-7/10 — worked but composed, never
 * gasping. It has its OWN templates; VO2/glycolytic templates are hard
 * work and must never be served under a tempo name.
 */
export type ConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic';

export const CONDITIONING_CATEGORIES: ConditioningCategory[] = [
  'aerobic_base', 'tempo', 'sprint', 'vo2', 'glycolytic',
];

/**
 * Target intensity band (out of 10) for each category. This is the
 * canonical source — templates reference these bands in their
 * descriptions instead of using RPE language.
 */
export const CATEGORY_INTENSITY: Record<ConditioningCategory, string> = {
  aerobic_base: '5-6/10',
  tempo:        '6-7/10 (controlled — worked but composed)',
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

  // Tempo — TRUE medium (4B). Controlled repeat efforts, 6-7/10.
  // NEVER reuse VO2/MAS/200-400m templates here — those are hard work.
  '30:30 Tempo Blocks': 'tempo',
  'Tempo Intervals (1min on / 1min easy)': 'tempo',
  'Bike/Row/Ski Tempo Intervals': 'tempo',
  'Cruise Intervals': 'tempo',

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
    case 'tempo': {
      // 4B: true tempo standalone pool. 'Cruise Intervals' is the
      // running-based option and deliberately sits at index 3 so the
      // block rotation reaches erg-first options first (off-feet-first
      // philosophy); the engine's focus text carries the week's
      // run-vs-off-feet call.
      const options = [
        'Tempo Intervals (1min on / 1min easy)',
        '30:30 Tempo Blocks',
        'Bike/Row/Ski Tempo Intervals',
        'Cruise Intervals',
      ];
      return options[pickIndex(options.length)];
    }
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
 * 4B label honesty: 'tempo' means TRUE tempo (controlled repeat efforts,
 * 6-7/10) — it must NEVER resolve to VO2-family hard templates.
 *
 *   aerobic        → aerobic_base
 *   tempo          → tempo
 *   high-intensity → glycolytic  (MAS/Tabata/RSA etc. — sprint is picked
 *                                 separately by the category planner)
 */
export function flavourToCategory(
  flavour: 'aerobic' | 'tempo' | 'high-intensity',
): ConditioningCategory {
  switch (flavour) {
    case 'aerobic': return 'aerobic_base';
    case 'tempo':   return 'tempo';
    case 'high-intensity': return 'glycolytic';
  }
}

/**
 * Map a category back to a flavour for downstream code that still
 * reads `conditioningFlavour` (UI labels, legacy resolvers).
 *
 * 4B label honesty: vo2 is HARD work — it wears 'high-intensity', never
 * 'tempo'. Only the true tempo category carries the tempo flavour.
 */
export function categoryToFlavour(
  category: ConditioningCategory,
): 'aerobic' | 'tempo' | 'high-intensity' {
  switch (category) {
    case 'aerobic_base': return 'aerobic';
    case 'tempo':        return 'tempo';
    case 'vo2':          return 'high-intensity';
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
export type ErgModality = 'bike' | 'bike_erg' | 'row' | 'ski' | 'mixed';

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
    /**
     * Attached dose model for combined strength + conditioning days.
     * Defaults to 'finisher' for backward compatibility.
     */
    attachedConditioningKind?: AttachedConditioningKind;
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
      const attachedKind = opts.attachedConditioningKind ?? 'finisher';
      const scaled = attachedKind === 'component'
        ? buildAttachedConditioningComponentTemplate(
            category, dateStr, opts.strengthRegion, opts.feel, opts.ergModality,
          )
        : buildCombinedConditioningTemplate(
            category, dateStr, opts.strengthRegion, opts.feel, opts.ergModality,
          );
      if (
        category !== 'aerobic_base' &&
        opts.strengthRegion !== 'lower' &&
        !SPEED_SPRINT_TEMPLATES.has(exerciseName) &&
        isModalityFlexibleConditioning(exerciseName)
      ) {
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
  const modalities = ['bike', 'row', 'ski'] as const;
  const mod = ergModality === 'row' || ergModality === 'bike' || ergModality === 'ski'
    ? ergModality
    : modalities[hash % modalities.length];
  const duration = 20 + (hash % 3) * 5; // 20, 25, or 30 min
  const prescription = aerobicErgPrescription(mod, duration, 'easy');
  return [
    condEx(`${prefix}-easy-flush`, `Easy Aerobic Flush (${prescription.title})`, 1, prescription.sets, 1, 1, prescription.restSeconds,
      noteLines(
        prescription.workLine,
        prescription.restLine,
        '3-4/10 effort',
        'Recovery pace',
      )),
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
  const selectedErgModality: ErgModality = isMixed ? 'mixed' : mod;
  const modLabel = modLabelFromErgSelection(selectedErgModality);
  const pairingNote = isLowerPairing ? LOWER_BODY_MACHINE_NOTE : undefined;

  switch (category) {
    case 'aerobic_base': {
      // Bike can run steady for 20-25min. Row/Ski longer than 10min is
      // intervalised so a finisher never becomes one long erg slog.
      const duration = 20 + (hash % 2) * 5; // 20 or 25 min
      const prescription = aerobicErgPrescription(selectedErgModality, duration, 'zone 2');
      return [
        condEx(`${prefix}-aero`, prescription.title, 1, prescription.sets, 1, 1, prescription.restSeconds,
          noteLines(
            prescription.workLine,
            prescription.restLine,
            '5-6/10 effort',
            isLowerPairing ? LOWER_BODY_MACHINE_NOTE : 'Conversational pace',
          )),
      ];
    }
    case 'tempo': {
      // 4B: TRUE tempo finisher — 10-15min of controlled repeat efforts
      // at 6-7/10. Small by design (a finisher, not a session). Erg-based:
      // the engine only pairs tempo with upper days, but even there the
      // legs stay spared after a lift. Shape rotates by feel/hash:
      //   sharp  → 30:30 blocks (30s on / 30s easy)
      //   grindy → 1min on / 1min easy rounds
      const tempoIdx = feel === 'sharp' ? 0
        : feel === 'grindy' ? 1
        : hash % 2;
      if (tempoIdx === 0) {
        const blocks = 2 + (hash % 2);           // 2 or 3 blocks
        const blockReps = 6;                     // 6 x (30s on / 30s easy) per block
        const totalMin = blocks * 6 + (blocks - 1); // ~13-19min incl. 1min between blocks
        void totalMin;
        return [
          condEx(`${prefix}-tempo3030`, `30:30 Tempo Blocks (${blocks} x ${blockReps}) — ${modLabel}`, 2, blocks * blockReps, 1, 1, 30,
            noteLines(
              `${blocks} blocks of ${blockReps} x (30s on / 30s easy) on ${modLabel}`,
              '1min easy between blocks',
              '6-7/10 on the work — controlled, worked but composed',
              'You should finish feeling worked, not wrecked',
              pairingNote,
            )),
        ];
      }
      const rounds = 5 + (hash % 3); // 5-7 rounds = 10-14min
      return [
        condEx(`${prefix}-tempo1on`, `Tempo Intervals ${rounds} x (1min on / 1min easy) — ${modLabel}`, 2, rounds, 1, 1, 60,
          noteLines(
            `${rounds} x 1min on / 1min easy on ${modLabel}`,
            '6-7/10 on the work — controlled repeat efforts',
            'Same pace every rep — if the last rep is a scramble, the first was too fast',
            pairingNote,
          )),
      ];
    }
    case 'sprint': {
      // Sprint exposure — when paired with a lower lift, convert to
      // ergometer power sprints so we're not hammering the legs with
      // both heavy compounds AND max-velocity running. Upper / full-body
      // days keep the running sprint (quality neural exposure).
      if (isLowerPairing) {
        const prescription = machineSprintPrescription(selectedErgModality, hash, feel);
        return [
          condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
            shortWarmup(modLabel)),
          condEx(
            `${prefix}-powersprint`,
            machineSprintTitle(prescription, modLabel),
            2,
            prescription.reps,
            1,
            1,
            prescription.restSeconds,
            machineSprintNotes(prescription, modLabel, pairingNote),
          ),
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
            '8min easy jog + 3 x 20m build-ups'),
          condEx(`${prefix}-ladder`, 'Acceleration ladder × 3 rounds', 2, 3, 1, 1, 120,
            noteLines(
              '3 rounds: 10m / 20m / 30m accelerations',
              '60s walk between distances',
              '9/10 effort',
            )),
        ];
      }
      if (sprintFeelIdx === 2) {
        // grindy — 6×20m shuttle with short rest
        return [
          condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
            '8min easy jog + 3 x 20m build-ups'),
          condEx(`${prefix}-shuttle`, '6 × 20m shuttle sprints', 2, 6, 1, 1, 60,
            noteLines(
              '6 x 20m out-and-back shuttle sprints',
              '60s easy between reps',
              '9/10 effort',
            )),
        ];
      }
      // default sharp — classic flying sprints
      const reps = 3 + (hash % 2); // 3 or 4
      return [
        condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
          '8min easy jog + 3 x 20m build-ups'),
        condEx(`${prefix}-sprints`, `${reps} × max-velocity sprints`, 2, reps, 1, 1, 180,
          noteLines(
            `${reps} x 20m build + 20m max velocity`,
            '3min walk-back between reps',
            'Max speed, full quality',
          )),
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
        variantIdx === 0 ? [3, 180, 90, '3 x 3min', 'Grindy: long work, short recovery - sustained ceiling.']
        : variantIdx === 1 ? [5, 90, 180, '5 x 90s', 'Sharp: short work, long recovery - repeat power.']
        : [4, 120, 120, '4 x 2min', 'Flowing: balanced 1:1 - rhythmic tempo.'];
      void workSec; void feelNote;
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-vo2`, `${label} VO2 intervals (${modLabel})`, 2, reps as number, 1, 1, restSec as number,
          noteLines(
            `${label} hard on ${modLabel}`,
            easyBetweenReps(restSec as number),
            '8-9/10 effort',
            pairingNote,
          )),
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
            shortWarmup(modLabel)),
          condEx(`${prefix}-grind`, `4 × 2min hard (${modLabel})`, 2, 4, 1, 1, 120,
            noteLines(
              `4 x 2min hard on ${modLabel}`,
              '2min easy between reps',
              '8-9/10 effort',
              pairingNote,
            )),
        ];
      }
      if (variantIdx === 1) {
        // sharp
        return [
          condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
            shortWarmup(modLabel)),
          condEx(`${prefix}-sharp`, `10 × 30s hard (${modLabel})`, 2, 10, 1, 1, 90,
            noteLines(
              `10 x 30s hard on ${modLabel}`,
              '90s easy between reps',
              '8-9/10 effort',
              pairingNote,
            )),
        ];
      }
      // flowing (default) — 40s work is MAS-prescribed at 100% MAS (>30s rule).
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-flow`, `40:20 intervals × 2 rounds (${modLabel})`, 2, 2, 1, 1, 120,
          noteLines(
            `40s hard / 20s easy x 4min on ${modLabel}`,
            '2min easy between rounds',
            '8-9/10 effort',
            `${masIntensityLabel(40)} target`,
            pairingNote,
          )),
      ];
    }
    default:
      const prescription = aerobicErgPrescription(selectedErgModality, 20, 'zone 2');
      return [
        condEx(`${prefix}-aero`, prescription.title, 1, prescription.sets, 1, 1, prescription.restSeconds,
          noteLines(
            prescription.workLine,
            prescription.restLine,
            '5-6/10 effort',
            pairingNote ?? 'Conversational pace',
          )),
      ];
  }
}

/**
 * Build a proper attached conditioning component for S+C days.
 *
 * Components are larger than finishers and should read like planned
 * conditioning work, not filler appended to chase volume.
 */
export function buildAttachedConditioningComponentTemplate(
  category: ConditioningCategory,
  dateStr: string,
  strengthRegion?: 'lower' | 'upper' | 'full',
  feel?: ConditioningFeel,
  ergModality?: ErgModality,
): WorkoutExercise[] {
  const hash = conditioningDateHash(dateStr);
  const prefix = `cond-${dateStr}-component`;
  const allMods = ['bike', 'row', 'ski'] as const;
  const legSparingMods = ['ski', 'row', 'bike'] as const;
  const isLowerPairing = strengthRegion === 'lower' || strengthRegion === 'full';
  const modPool = isLowerPairing ? legSparingMods : allMods;
  const mod = ergModality && ergModality !== 'mixed'
    ? ergModality
    : modPool[hash % modPool.length];
  const selectedErgModality: ErgModality = ergModality === 'mixed' ? 'mixed' : mod;
  const modLabel = modLabelFromErgSelection(selectedErgModality);
  const pairingNote = isLowerPairing ? LOWER_BODY_MACHINE_NOTE : undefined;

  switch (category) {
    case 'aerobic_base': {
      const duration = 25 + (hash % 2) * 5; // 25 or 30 min
      const prescription = aerobicErgPrescription(selectedErgModality, duration, 'zone 2');
      return [
        condEx(`${prefix}-aero`, `Aerobic conditioning component (${prescription.title})`, 1, prescription.sets, 1, 1, prescription.restSeconds,
          noteLines(
            prescription.workLine,
            prescription.restLine,
            '5-6/10 effort',
            pairingNote ?? 'Conversational pace',
            'Full conditioning component, not a small finisher',
          )),
      ];
    }
    case 'tempo': {
      const rounds = feel === 'sharp' ? 10 : feel === 'flowing' ? 12 : 11; // 20-24min including easy floats
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-tempo`, `Tempo conditioning component ${rounds} x (1min on / 1min easy) - ${modLabel}`, 2, rounds, 1, 1, 60,
          noteLines(
            `${rounds} x 1min on / 1min easy on ${modLabel}`,
            '20-24min total tempo block',
            '6-7/10 on the work - controlled repeat efforts',
            'Full conditioning component, not a small finisher',
            pairingNote,
          )),
      ];
    }
    case 'vo2': {
      const variantIdx = feel === 'sharp' ? 1 : feel === 'flowing' ? 2 : 0;
      const [reps, workSec, restSec, label] =
        variantIdx === 1 ? [5, 120, 120, '5 x 2min']
        : variantIdx === 2 ? [4, 150, 150, '4 x 2.5min']
        : [4, 180, 120, '4 x 3min'];
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-vo2`, `VO2 conditioning component (${label} - ${modLabel})`, 2, reps as number, 1, 1, restSec as number,
          noteLines(
            `${label} hard on ${modLabel}`,
            easyBetweenReps(restSec as number),
            `${Math.round((reps as number) * (workSec as number) / 60)}min hard work inside a 20-30min component`,
            '8-9/10 effort',
            pairingNote,
          )),
      ];
    }
    case 'glycolytic': {
      const variantIdx = feel === 'sharp' ? 1 : feel === 'flowing' ? 2 : 0;
      if (variantIdx === 1) {
        return [
          condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
            shortWarmup(modLabel)),
          condEx(`${prefix}-glyco-sharp`, `High-intensity conditioning component 12 x 30s - ${modLabel}`, 2, 12, 1, 1, 90,
            noteLines(
              `12 x 30s hard on ${modLabel}`,
              '90s easy between reps',
              '8-9/10 repeat efforts',
              'Full conditioning component, not a small finisher',
              pairingNote,
            )),
        ];
      }
      if (variantIdx === 2) {
        return [
          condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
            shortWarmup(modLabel)),
          condEx(`${prefix}-glyco-flow`, `High-intensity conditioning component 40:20 x 3 rounds - ${modLabel}`, 2, 3, 1, 1, 120,
            noteLines(
              `40s hard / 20s easy x 4min on ${modLabel}`,
              '3 rounds, 2min easy between rounds',
              '8-9/10 repeat efforts',
              `${masIntensityLabel(40)} target`,
              pairingNote,
            )),
        ];
      }
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-glyco-grind`, `High-intensity conditioning component 5 x 2min - ${modLabel}`, 2, 5, 1, 1, 120,
          noteLines(
            `5 x 2min hard on ${modLabel}`,
            '2min easy between reps',
            '8-9/10 repeat efforts',
            'Full conditioning component, not a small finisher',
            pairingNote,
          )),
      ];
    }
    case 'sprint':
      // Placeholder only. The engine should not request attached sprint in v1;
      // if legacy data does, keep the existing compact sprint template.
      return buildCombinedConditioningTemplate(category, dateStr, strengthRegion, feel, ergModality);
    default:
      return buildCombinedConditioningTemplate('aerobic_base', dateStr, strengthRegion, feel, ergModality);
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
  void combined;
  return [
    condEx(`${prefix}-warmup`, 'Sprint warm-up (short)', 1, 1, 1, 1, 0,
      '6min easy jog + 2 x 20m build-ups'),
    condEx(`${prefix}-micro`, `${reps} × 10s flying sprint (micro-dose)`, 2, reps, 1, 1, 180,
      noteLines(
        `${reps} x 10s flying sprint`,
        '3min walk-back between reps',
        'Max speed, full quality',
      )),
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
    const selectedModality: ErgModality = ergModality ?? legSparingMods[hash % legSparingMods.length];
    const modLabel = modLabelFromErgSelection(selectedModality);
    const prescription = machineSprintPrescription(selectedModality, hash, undefined, true);
    return [
      condEx(`${prefix}-warmup`, `${modLabel} warm-up (short)`, 1, 1, 1, 1, 0,
        shortWarmup(modLabel, 4)),
      condEx(
        `${prefix}-reduced`,
        machineSprintTitle(prescription, modLabel, ', reduced'),
        2,
        prescription.reps,
        1,
        1,
        prescription.restSeconds,
        machineSprintNotes(prescription, modLabel, isLower ? LOWER_BODY_MACHINE_NOTE : undefined),
      ),
    ];
  }
  // On-feet reduced — 3 flying sprints with long rest.
  const reps = 3;
  return [
    condEx(`${prefix}-warmup`, 'Sprint warm-up (short)', 1, 1, 1, 1, 0,
      '6min easy jog + 2 x 20m build-ups'),
    condEx(`${prefix}-reduced`, `${reps} × 20m flying sprint (reduced)`, 2, reps, 1, 1, 180,
      noteLines(
        `${reps} x 20m build + 20m max velocity`,
        '3min walk-back between reps',
        'Max speed, full quality',
      )),
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
      // Duration cap: standalone target ≤45min. 4–6 reps (Sam 2026-07-03:
      // widened from 4–5 to absorb the old "6x1km" concept), 6min
      // start-interval: 10min warmup + (reps × 6min) + 5min cool.
      const reps = 4 + (hash % 3); // 4–6 reps
      const startEvery = 6; // fixed 6 min — keeps cap-compliant
      return [
        condEx(`${prefix}-warmup`, 'Run warm-up', 1, 1, 1, 1, 0,
          '10min easy jog + 2 x 200m strides'),
        condEx(`${prefix}-intervals`, `${reps} × 1km repeats`, 2, reps, 1, 1, 0,
          noteLines(
            `${reps} x 1km - start every ${startEvery}min`,
            '8-9/10 effort',
            'Walk/jog remaining time',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog'),
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
          '10min easy Bike/Rower + 3 x 10s build-ups'),
        condEx(`${prefix}-vo2`, `${reps} × 4min VO2 intervals`, 2, reps, 1, 1, rest * 60,
          noteLines(
            `${reps} x 4min hard`,
            `${rest}min easy between reps`,
            '8-9/10 effort',
            'Bike or Rower preferred',
          )),
        condEx(`${prefix}-cooldown`, 'Easy cool-down', 3, 1, 1, 1, 0,
          '5min easy Bike/Rower'),
      ];
    }

    // ════════════════════════════════════════════════
    // 🟡 1B. TRUE TEMPO — controlled repeat efforts (4B)
    // Medium stress. 6-7/10 — worked but composed, never gasping.
    // Standalone target 20-30min total. NEVER reuse VO2/MAS/hard-repeat
    // templates under these names.
    // ════════════════════════════════════════════════

    case '30:30 Tempo Blocks': {
      // Running-based 30s on / 30s easy blocks, 10-15min of work.
      // Convertible off-feet by the run-load guard / off-feet law.
      const blocks = 2 + (hash % 2); // 2-3 blocks of 6 reps
      return [
        condEx(`${prefix}-warmup`, 'Tempo warm-up', 1, 1, 1, 1, 0,
          '8min easy jog + 2 x 60m build-ups'),
        condEx(`${prefix}-tempo3030`, `30:30 Tempo Blocks × ${blocks}`, 2, blocks * 6, 1, 1, 30,
          noteLines(
            `${blocks} blocks of 6 x (30s on / 30s easy)`,
            '1min easy jog between blocks',
            '6-7/10 on the work — controlled, worked but composed',
            'Same pace every rep — smooth, tall running',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog'),
      ];
    }

    case 'Tempo Intervals (1min on / 1min easy)': {
      // Running-based 1:1 tempo rounds — 8-12 rounds (16-24min of work).
      const rounds = 8 + (hash % 5); // 8-12 rounds
      return [
        condEx(`${prefix}-warmup`, 'Tempo warm-up', 1, 1, 1, 1, 0,
          '8min easy jog + 2 x 60m build-ups'),
        condEx(`${prefix}-tempo1on1`, `Tempo Intervals ${rounds} × (1min on / 1min easy)`, 2, rounds, 1, 1, 60,
          noteLines(
            `${rounds} x 1min on / 1min easy jog`,
            '6-7/10 on the work — controlled repeat efforts',
            'If the last rep is a scramble, the first was too fast',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog'),
      ];
    }

    case 'Bike/Row/Ski Tempo Intervals': {
      // Off-feet tempo — 2min on / 1min easy, 5-8 rounds. THE standalone
      // off-feet tempo prescription (off-feet-first philosophy).
      const mods = ['bike', 'row', 'ski'] as const;
      const pickedMod = ergModality && ergModality !== 'mixed'
        ? ergModality
        : mods[hash % mods.length];
      const modName = pickedMod === 'bike' ? 'Assault Bike'
        : pickedMod === 'bike_erg' ? 'BikeErg'
        : pickedMod === 'row' ? 'Rower' : 'SkiErg';
      const rounds = 5 + (hash % 4); // 5-8 rounds
      return [
        condEx(`${prefix}-warmup`, `${modName} warm-up`, 1, 1, 1, 1, 0,
          `5min easy on ${modName}, building the last minute`),
        condEx(`${prefix}-tempoerg`, `Tempo Intervals ${rounds} × (2min on / 1min easy) — ${modName}`, 2, rounds, 1, 1, 60,
          noteLines(
            `${rounds} x 2min on / 1min easy on ${modName}`,
            '6-7/10 on the work — strong but sustainable',
            'Hold the same output every rep',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${pickedMod}`, 3, 1, 1, 1, 0,
          `3min easy ${modName}`),
      ];
    }

    case 'Cruise Intervals': {
      // Running-based cruise blocks — 3-5min at tempo with short floats.
      // The "biggest" tempo shape; standalone only, 20-30min total.
      const blockMin = 3 + (hash % 3); // 3-5min blocks
      const blocks = blockMin === 3 ? 4 : 3; // keep 12-15min of work
      return [
        condEx(`${prefix}-warmup`, 'Tempo warm-up', 1, 1, 1, 1, 0,
          '10min easy jog + 2 x 60m build-ups'),
        condEx(`${prefix}-cruise`, `Cruise Intervals ${blocks} × ${blockMin}min`, 2, blocks, 1, 1, 90,
          noteLines(
            `${blocks} x ${blockMin}min at tempo pace`,
            '90s easy jog between blocks',
            '6-7/10 — controlled, conversational is too easy, gasping is too hard',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog'),
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
          '10min easy jog + 3 x 80m strides'),
        condEx(`${prefix}-intervals`, `15:15 intervals × ${rounds} rounds`, 2, rounds, 1, 1, 120,
          noteLines(
            `15s hard / 15s easy x 4min`,
            `2min easy between rounds (${rounds} rounds)`,
            '9/10 effort',
            `${masIntensityLabel(15)} target`,
            MAS_FALLBACK_NOTE,
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog'),
      ];
    }

    case 'Tabata Intervals': {
      // Bucket: High-intensity metabolic
      // Purpose: High lactate tolerance + repeat effort
      // Bike / row / ski preferred
      const rounds = 4 + (hash % 3); // 4–6 rounds
      return [
        condEx(`${prefix}-warmup`, 'Interval warm-up', 1, 1, 1, 1, 0,
          '5min easy Bike/Rower + 3 x 10s build-ups'),
        condEx(`${prefix}-tabata`, `Tabata 20:10 × ${rounds} rounds`, 2, rounds, 1, 1, 120,
          noteLines(
            `20s hard / 10s easy x 4min`,
            `2min easy between rounds (${rounds} rounds)`,
            '8-9/10 effort',
            MACHINE_OPTIONS_NOTE,
          )),
        condEx(`${prefix}-cooldown`, 'Easy cool-down', 3, 1, 1, 1, 0,
          '3min easy Bike/Rower'),
      ];
    }

    case 'Inverse Tabata': {
      // Bucket: Speed endurance
      // Purpose: Maintain quality output with more recovery
      // Air bike preferred. Lower fatigue than standard Tabata.
      const rounds = 4 + (hash % 3); // 4–6 rounds
      return [
        condEx(`${prefix}-warmup`, 'Interval warm-up', 1, 1, 1, 1, 0,
          '5min easy Assault Bike + 3 x 10s build-ups'),
        condEx(`${prefix}-inv-tabata`, `Inverse Tabata 10:20 × ${rounds} rounds`, 2, rounds, 1, 1, 120,
          noteLines(
            `10s hard / 20s easy x 4min`,
            `2min easy between rounds (${rounds} rounds)`,
            '8-9/10 effort',
            'Assault Bike preferred',
          )),
        condEx(`${prefix}-cooldown`, 'Easy cool-down', 3, 1, 1, 1, 0,
          '3min easy spin'),
      ];
    }

    // ════════════════════════════════════════════════
    // ⚡ 3. SPRINT / ALACTIC
    // ════════════════════════════════════════════════

    case 'Max Effort Sprint Accumulation': {
      // Bucket: Alactic power
      // Purpose: Max output without fatigue spillover
      // Air bike / echo bike. Neural + power session.
      const selectedModality = ergModality ?? 'bike';
      const modLabel = modLabelFromErgSelection(selectedModality);
      const prescription = machineSprintPrescription(selectedModality, hash, feel);
      return [
        condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(
          `${prefix}-sprints`,
          `Sprint accumulation (${prescription.reps} x ${prescription.seconds}s ${prescription.effort} ${modLabel})`,
          2,
          prescription.reps,
          1,
          1,
          prescription.restSeconds,
          machineSprintNotes(prescription, modLabel),
        ),
        condEx(`${prefix}-cooldown`, 'Easy spin', 3, 1, 1, 1, 0,
          `3min easy ${modLabel}`),
      ];
    }

    case 'Free Sprint Session': {
      // Bucket: Alactic sprint
      // Purpose: Speed, mechanics, neural freshness
      // Field or hill. Quality > volume. Never fatigued sprinting.
      const formats = [
        { dist: '20-40m', reps: '6-8', rest: 'walk-back' },
        { dist: '40-60m', reps: '5-6', rest: 'walk-back' },
        { dist: '60-100m', reps: '4-5', rest: '3min' },
      ];
      const fmt = formats[hash % formats.length];
      return [
        condEx(`${prefix}-warmup`, 'Sprint warm-up', 1, 1, 1, 1, 0,
          '12min easy jog + 4 x 20m build-ups'),
        condEx(`${prefix}-sprints`, `Free sprints (${fmt.dist})`, 2, 1, 1, 1, 0,
          noteLines(
            `${fmt.reps} x ${fmt.dist} sprints`,
            `${fmt.rest} recovery between reps`,
            'Max speed, full quality',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog + stretch', 3, 1, 1, 1, 0,
          '5min easy jog'),
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
          '15min easy jog + 4 x 20m build-ups'),
        condEx(`${prefix}-flying`, `Flying sprints (${reps} × ${buildup}m build + ${maxV}m max)`, 2, reps, 1, 1, rest * 60,
          noteLines(
            `${reps} x ${buildup}m build + ${maxV}m max`,
            `${rest}min walk-back between reps`,
            'Max speed, full quality',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog + stretch', 3, 1, 1, 1, 0,
          '5min easy jog'),
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
          '8min easy jog + 2 x 100m strides'),
        condEx(`${prefix}-repeats`, `${dist} repeats (${duration}min)`, 2, 1, 1, 1, 0,
          noteLines(
            `${dist} every ${startEvery}min for ${duration}min`,
            '8-9/10 effort',
            'Walk/jog remaining time',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog', 3, 1, 1, 1, 0,
          '5min easy jog'),
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
          '10min easy jog + 3 x 20m build-ups'),
        condEx(`${prefix}-fartlek`, `Footy fartlek (${rounds} rounds × ${reps} reps)`, 2, rounds, reps, reps, 150,
          noteLines(
            `${rounds} rounds x ${reps} footy fartlek reps`,
            '2-3min easy between rounds',
            '8/10 effort',
          )),
        condEx(`${prefix}-cooldown`, 'Cool-down jog + stretch', 3, 1, 1, 1, 0,
          '5min easy jog'),
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
      let modNote: string | undefined;
      let ergPrescription: AerobicErgPrescription | null = null;
      if (ergModality === 'bike') {
        modLabel = 'Assault Bike';
        ergPrescription = aerobicErgPrescription('bike', duration, 'zone 2');
      } else if (ergModality === 'row') {
        modLabel = 'Rower';
        ergPrescription = aerobicErgPrescription('row', duration, 'zone 2');
      } else if (ergModality === 'ski') {
        modLabel = 'SkiErg';
        ergPrescription = aerobicErgPrescription('ski', duration, 'zone 2');
      } else if (ergModality === 'mixed') {
        modLabel = 'Row + SkiErg';
        ergPrescription = aerobicErgPrescription('mixed', duration, 'zone 2');
      } else {
        const modVariant = hash % 5;
        if (modVariant === 0 || modVariant === 1) {
          modLabel = 'run';
        } else if (modVariant === 2) {
          modLabel = 'Assault Bike';
          ergPrescription = aerobicErgPrescription('bike', duration, 'zone 2');
        } else if (modVariant === 3) {
          modLabel = 'Rower';
          ergPrescription = aerobicErgPrescription('row', duration, 'zone 2');
        } else {
          modLabel = 'SkiErg';
          ergPrescription = aerobicErgPrescription('ski', duration, 'zone 2');
        }
      }
      // Structure variant: drive by feel if supplied, else hash.
      //   flowing → pure steady    (default aerobic character)
      //   sharp   → steady + surges (lifts the intensity feel briefly)
      //   grindy  → fartlek        (continuous, repeating)
      const structVariant = feel === 'flowing' ? 0
        : feel === 'sharp' ? 1
        : feel === 'grindy' ? 2
        : hash % 3;
      const structBlock = ergPrescription
        ? ergPrescription.workLine
        : structVariant === 0
          ? `${duration}min zone 2 on ${modLabel}`
          : structVariant === 1
          ? `${duration}min zone 2 on ${modLabel} + 3 x 60s surges`
          : `${duration}min: 4min zone 2 / 1min high-zone 2 on ${modLabel}`;
      return [
        condEx(`${prefix}-run`, ergPrescription?.title ?? `${duration}min zone 2 ${modLabel}`, 1, ergPrescription?.sets ?? 1, 1, 1, ergPrescription?.restSeconds ?? 0,
          noteLines(
            structBlock,
            ergPrescription?.restLine,
            '5-6/10 effort',
            modNote ?? 'Conversational pace',
          )),
      ];
    }

    // ════════════════════════════════════════════════
    // LEGACY — kept for resolver compatibility
    // (resolveConditioning still references these names)
    // ════════════════════════════════════════════════

    case 'Flush Run':
      return [condEx(`${prefix}-flush`, 'Flush run', 1, 1, 1, 1, 0,
        noteLines('20min easy run', '3-4/10 effort', 'Recovery pace'))];

    case 'Easy Bike':
      return [condEx(`${prefix}-bike`, 'Easy bike', 1, 1, 1, 1, 0,
        noteLines('20min easy bike', '3-4/10 effort', 'Recovery pace'))];

    case 'Easy Row':
      return [condEx(`${prefix}-row`, 'Easy row', 1, 1, 1, 1, 0,
        noteLines('8-10min easy row', '3-4/10 effort', 'Recovery pace'))];

    case 'Easy Ski':
      return [condEx(`${prefix}-ski`, 'Easy SkiErg', 1, 1, 1, 1, 0,
        noteLines('8-10min easy SkiErg', '3-4/10 effort', 'Recovery pace'))];

    case 'Easy Swim':
      return [condEx(`${prefix}-swim`, 'Easy swim', 1, 1, 1, 1, 0,
        noteLines('20-30min easy swim', '3-4/10 effort', 'Recovery pace'))];

    case 'Light Circuits':
      return [condEx(`${prefix}-circuits`, 'Light recovery circuit', 1, 2, 1, 1, 60,
        noteLines(
          '2 rounds easy',
          '2min bike, 10 squats, 10 push-ups, 30s plank, 2min row',
          '60s easy between rounds',
        ))];

    default:
      return [
        condEx(`${prefix}-session`, exerciseName, 1, 1, 1, 1, 0, exerciseName),
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
  MACHINE_OPTIONS_NOTE;

/** Coach-tone note stamped on sessions converted by the run-load guard. */
export const RUN_LOAD_SHIFT_NOTE =
  'Shifted off-feet to manage run load.';

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
  const modLabel = modLabelFromErg(mod);

  // Map each running template to an equivalent off-feet session
  switch (exerciseName) {

    // ── MAS / HI → Bike/Row intervals ──
    case 'MAS 15:15 Blocks': {
      // Prescription: 15s work → 110% MAS (≤30s rule).
      const rounds = 3 + (hash % 3);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel, 10)),
        condEx(`${prefix}-intervals`, `15:15 intervals × ${rounds} rounds (${modLabel})`, 2, rounds, 1, 1, 120,
          noteLines(
            `15s hard / 15s easy x 4min on ${modLabel}`,
            `2min easy between rounds (${rounds} rounds)`,
            '9/10 effort',
            `${masIntensityLabel(15)} target`,
            MAS_FALLBACK_NOTE,
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${modLabel}`),
      ];
    }

    case 'Tabata Intervals': {
      const rounds = 4 + (hash % 3);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-tabata`, `Tabata 20:10 × ${rounds} rounds (${modLabel})`, 2, rounds, 1, 1, 120,
          noteLines(
            `20s hard / 10s easy x 4min on ${modLabel}`,
            `2min easy between rounds (${rounds} rounds)`,
            '8-9/10 effort',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${modLabel}`),
      ];
    }

    case 'Inverse Tabata': {
      const rounds = 4 + (hash % 3);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-inv-tabata`, `Inverse Tabata 10:20 × ${rounds} rounds (${modLabel})`, 2, rounds, 1, 1, 120,
          noteLines(
            `10s hard / 20s easy x 4min on ${modLabel}`,
            `2min easy between rounds (${rounds} rounds)`,
            '8-9/10 effort',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${modLabel}`),
      ];
    }

    // ── Sprint / Alactic → Bike sprints ──
    case 'Max Effort Sprint Accumulation': {
      const prescription = machineSprintPrescription(mod, hash);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} sprint warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(
          `${prefix}-sprints`,
          `Sprint accumulation (${prescription.reps} x ${prescription.seconds}s ${prescription.effort} ${modLabel})`,
          2,
          prescription.reps,
          1,
          1,
          prescription.restSeconds,
          machineSprintNotes(prescription, modLabel),
        ),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${modLabel}`),
      ];
    }

    case 'Free Sprint Session': {
      const prescription = machineSprintPrescription(mod, hash);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} sprint warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(
          `${prefix}-sprints`,
          `Free sprints on ${modLabel}`,
          2,
          prescription.reps,
          1,
          1,
          prescription.restSeconds,
          machineSprintNotes(prescription, modLabel),
        ),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${modLabel}`),
      ];
    }

    case 'Flying Sprints': {
      // Flying sprints are field-only — neural session. Convert to bike sprint equiv.
      const prescription = machineSprintPrescription(mod, hash);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} sprint warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel, 10)),
        condEx(
          `${prefix}-flying`,
          `${modLabel} max velocity sprints (${prescription.reps} x ${prescription.seconds}s ${prescription.effort})`,
          2,
          prescription.reps,
          1,
          1,
          prescription.restSeconds,
          machineSprintNotes(prescription, modLabel),
        ),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${modLabel}`),
      ];
    }

    // ── Tempo / Aerobic Power → Machine intervals ──
    case '1km Repeat Intervals': {
      const reps = 4 + (hash % 3);
      const workTime = mod === 'bike' ? '3:30' : '3:45';
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel, 10)),
        condEx(`${prefix}-intervals`, `${reps} × ${workTime} intervals (${modLabel})`, 2, reps, 1, 1, 0,
          noteLines(
            `${reps} x ${workTime} hard on ${modLabel}`,
            'Start every 7min',
            '8-9/10 effort',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${modLabel}`),
      ];
    }

    case '4x4 VO2': {
      const reps = 4 + (hash % 2 === 0 ? 0 : 1);
      const rest = 2 + (hash % 2);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel, 10)),
        condEx(`${prefix}-vo2`, `${reps} × 4min VO2 intervals (${modLabel})`, 2, reps, 1, 1, rest * 60,
          noteLines(
            `${reps} x 4min hard on ${modLabel}`,
            `${rest}min easy between reps`,
            '8-9/10 effort',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${modLabel}`),
      ];
    }

    case '200m/400m Repeat Runs': {
      const isLong = hash % 2 === 0;
      const workTime = isLong ? '90s' : '45s';
      const duration = 20 + (hash % 3) * 5;
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel, 8)),
        condEx(`${prefix}-repeats`, `${workTime} repeats on ${modLabel} (${duration}min)`, 2, 1, 1, 1, 0,
          noteLines(
            `${workTime} hard / easy for ${duration}min on ${modLabel}`,
            '8-9/10 effort',
            'Consistent output',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${modLabel}`),
      ];
    }

    case 'Footy Fartlek': {
      const reps = 3 + (hash % 3); // 3–5 reps per round
      const rounds = 3; // fixed — keeps volume controlled
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel, 10)),
        condEx(`${prefix}-fartlek`, `Fartlek intervals on ${modLabel} (${rounds} rounds × ${reps} reps)`, 2, rounds, reps, reps, 150,
          noteLines(
            `30s hard / 30s easy x ${reps} reps on ${modLabel}`,
            `2-3min easy between rounds (${rounds} rounds)`,
            '8/10 effort',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `5min easy ${modLabel}`),
      ];
    }

    // ── TRUE tempo (4B) → same controlled shape, erg modality ──
    // Stimulus preserved exactly (work:rest, 6-7/10); only modality moves.
    case '30:30 Tempo Blocks': {
      const blocks = 2 + (hash % 2);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-tempo3030`, `30:30 Tempo Blocks × ${blocks} (${modLabel})`, 2, blocks * 6, 1, 1, 30,
          noteLines(
            `${blocks} blocks of 6 x (30s on / 30s easy) on ${modLabel}`,
            '1min easy between blocks',
            '6-7/10 on the work — controlled, worked but composed',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${modLabel}`),
      ];
    }

    case 'Tempo Intervals (1min on / 1min easy)': {
      const rounds = 8 + (hash % 5);
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-tempo1on1`, `Tempo Intervals ${rounds} × (1min on / 1min easy) (${modLabel})`, 2, rounds, 1, 1, 60,
          noteLines(
            `${rounds} x 1min on / 1min easy on ${modLabel}`,
            '6-7/10 on the work — controlled repeat efforts',
            'Hold the same output every rep',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${modLabel}`),
      ];
    }

    case 'Cruise Intervals': {
      const blockMin = 3 + (hash % 3);
      const blocks = blockMin === 3 ? 4 : 3;
      return [
        condEx(`${prefix}-warmup`, `${modLabel} warm-up`, 1, 1, 1, 1, 0,
          shortWarmup(modLabel)),
        condEx(`${prefix}-cruise`, `Cruise Intervals ${blocks} × ${blockMin}min (${modLabel})`, 2, blocks, 1, 1, 90,
          noteLines(
            `${blocks} x ${blockMin}min at tempo effort on ${modLabel}`,
            '90s easy between blocks',
            '6-7/10 — strong but sustainable',
          )),
        condEx(`${prefix}-cooldown`, `Easy ${mod}`, 3, 1, 1, 1, 0,
          `3min easy ${modLabel}`),
      ];
    }

    // ── Aerobic → Steady-state machine ──
    case 'Long Nasal Run': {
      const duration = 35 + (hash % 3) * 5;
      const prescription = aerobicErgPrescription(mod, duration, 'zone 2');
      return [
        condEx(`${prefix}-steady`, prescription.title, 1, prescription.sets, 1, 1, prescription.restSeconds,
          noteLines(
            prescription.workLine,
            prescription.restLine,
            '5-6/10 effort',
            'Conversational pace',
          )),
      ];
    }

    default:
      // Unknown running template — generic machine conversion
      return [
        condEx(`${prefix}-session`, `${exerciseName} (${modLabel})`, 1, 1, 1, 1, 0,
          `${exerciseName} on ${modLabel}`),
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
  const prescription = aerobicErgPrescription(mod, duration, 'aerobic flush');

  return [
    condEx(`${prefix}-flush-finisher`, `Aerobic flush (${prescription.title})`, 99, prescription.sets, 1, 1, prescription.restSeconds,
      noteLines(
        prescription.workLine,
        prescription.restLine,
        '30s moderate / 30s easy',
        '5-6/10 effort',
      )),
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
 * @param progressionData - Optional feedback/history inputs for progression
 */
export function buildConditioningSession(
  dateStr: string,
  gameDates: string[],
  athlete: AthleteContext,
  seasonPhase: SeasonPhase,
  weekLog: WeekLog,
  microcycleId: string,
  progressionData: ConditioningProgressionData = {},
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
  const recentFeedback = recentConditioningFeedback(progressionData.sessionFeedback, dateStr);
  const realInputOverrides = deriveConditioningProgressionInputOverrides({
    feedback: recentFeedback,
    exercises,
    baseDuration,
  });
  const progressionInput: ConditioningProgressionInput = {
    tier: result.tier,
    readiness: weekLog.readiness,
    recentRPE: 6, // default — no session history available at resolve time
    completionQuality: 'full', // default — assume previous session was completed
    hasRecentFeedback: false,
    hasAvoidInjury: Object.values(activeInjuries).some(s => s === 'avoid'),
    hasModifyInjury: Object.values(activeInjuries).some(s => s === 'caution'),
    seasonPhase,
    weeklyConditioningCount: weekLog.sessions.length,
    daysToGame,
    doubleGameWeek: weekLog.doubleGameWeek,
    highFatigueStrengthThisWeek: weekLog.strengthSessions.some(s => s.fatigue === 'high'),
    lastSessionProgressed: false, // default — no history tracking yet
    weeklyLoad: calculateConditioningLoad(weekLog.sessions),
    previousWeekLoad: previousWeekConditioningLoad(progressionData.sessionFeedback, dateStr),
    currentReps: 6,         // sensible defaults for cap enforcement
    currentIntervals: 4,
    currentDuration: baseDuration,
    currentRest: result.tier === 'A' ? 120 : 60,
    ...realInputOverrides,
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
    // TRUE tempo (4B) — kernel maps 'Tempo-Run' → tempo_conditioning
    '30:30 Tempo Blocks': 'Tempo-Run',
    'Tempo Intervals (1min on / 1min easy)': 'Tempo-Run',
    'Cruise Intervals': 'Tempo-Run',
    'Bike/Row/Ski Tempo Intervals': 'Conditioning',
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
