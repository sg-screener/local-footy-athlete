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
import {
  resolveInjuryRegion,
  routableBodyParts,
  type InjuryRegion,
} from '../data/injuryRegions';
import { applyHardFilters, buildFilterContext, type FilterContext } from './exerciseFilter';
import { selectExercises, buildIntent, findSubstitute } from './exerciseScorer';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';
import {
  resolveLegacyStrengthIntent,
  resolveStrengthOwnershipBoundary,
} from '../rules/strengthPatternContributions';
import { applyLoadEstimates } from './loadEstimation';
import {
  SPEED_FALLBACK_TEMPLATE,
  composeConditioningRows,
  composeSpeedRows,
  resolveTemplateByName,
  workoutTypeForTemplate,
} from '../rules/conditioningSelection';
import {
  MOBILITY_SESSION_MINUTES,
  composeMobilitySession,
} from '../rules/mobilitySessionComposition';

// ─── Athlete Context ───

export interface AthleteContext {
  /** Injury list from onboarding. */
  injuries: OnboardingInjury[];
  /** Equipment tags the athlete has access to. */
  equipmentTags: EquipmentTag[];
  // The training-location field is REMOVED (Sam's audit ruling 3, 2026-07-31): the
  // location is a UI seed for the equipment step and coach context, and
  // nothing downstream may read it. Equipment inference died with ruling 4;
  // this field was its last shadow — carried everywhere, consumed nowhere.
  /** Full onboarding data — used for load estimation (strength levels, bodyweight). */
  onboardingData?: import('../types/domain').OnboardingData;
}

/** Default context when no profile data is available. */
export const DEFAULT_ATHLETE_CONTEXT: AthleteContext = {
  injuries: [],
  equipmentTags: ['bodyweight', 'dumbbells', 'cables', 'bands', 'bench', 'foam_roller', 'bike_or_treadmill', 'machine'],
};

// ─── Derived Session Types ───

export type DerivedSessionType =
  | 'recovery'
  | 'passive_recovery'
  | 'extended_recovery'
  | 'prehab_accessories'
  | 'arms_pump'
  /**
   * A standalone Mobility session, COMPOSED — Sam's signed 5-8 across the four
   * regions, at the doses he authored on each movement.
   *
   * It is a derived type rather than a set of slots because its composition is a
   * region SPREAD, not a per-category count, and because it now has two callers:
   * the athlete's Mobility door (`coachRevisionTemplates`) and the need-based
   * top-up pass. One owner of "what a Mobility session is" is the reason the door
   * and the generator cannot disagree about it — the failure R1 turns out to have
   * (see `composedOptionalKind`).
   */
  | 'mobility';

/** The slot-composed types. `mobility` composes by region and is not one. */
type SlotComposedSessionType = Exclude<DerivedSessionType, 'mobility'>;

// ─── Session Slot Definitions ───
// Each session type is a sequence of "slots" — pick N exercises from a category.

interface SessionSlot {
  category: ExerciseCategory;
  /** How many exercises to pick from this category. */
  count: number;
}

// BIBLE_ANCHOR: gunshow_two_two_two
const SESSION_SLOTS: Record<SlotComposedSessionType, SessionSlot[]> = {
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
  // GUNSHOW — Sam's signed structure, 2026-07-30: 2 biceps + 2 triceps +
  // 2 shoulder, and "shoulder" means the PUMP delts pool, not shoulder health.
  //
  // It used to be 2 + 2 + 1 delt + 1 UPPER BACK PUMP. That last slot is a
  // CROSS-FAMILY TOP-UP — the app reaching outside the sixteen candidates Sam
  // signed to fill a sixth slot — and it is what put "Face Pull" (from
  // `UPPER_BACK_PUMP_POOL`) into a session whose signed shoulder family holds
  // "Cable Face Pull". His ruling is explicit: under thin equipment a gunshow
  // gets SMALLER, never padded; the app never invents to fill a quota. Found by
  // `sessionTypeCharterTests` group D on its first run.
  //
  // Shrinking is already how `pickFromPool` behaves — it returns the whole pool
  // when the pool is smaller than the slot count and never repeats to reach it —
  // so removing the top-up is the entire fix.
  arms_pump: [
    { category: 'biceps',           count: 2 },
    { category: 'triceps',          count: 2 },
    { category: 'delts',            count: 2 },
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
  // Not conditioning and not strength. The charter's counting row says what the
  // ledger says: no load, never a hard day, never breaks rest — which is also why
  // `:116` lets it sit on a rest day.
  mobility: {
    name: 'Mobility',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    durationMinutes: MOBILITY_SESSION_MINUTES,
    intensity: 'Light',
    descriptionSuffix: 'easy ranges only, nothing forced',
  },
};

// ─── Injury Mapping ───
//
// LR-27 convergence (Sam's ruling, 2026-08-02): the owner's sheet wins every
// row, so body areas route through `data/injuryRegions.ts` — the single
// owner — and this builder holds no body-part vocabulary of its own. Routing
// is SINGLE-TARGET by the same ruling: achilles means calf (not ankle+calf),
// shin means calf (added to the sheet by the ruling).
//
// What remains here is only the RENAME: the pool filter's InjuryTag
// vocabulary spells three regions differently ('ankle/foot' -> 'ankle',
// lowerBack -> 'lower_back', 'wrist/hand' -> 'wrist'). The record is total
// over InjuryRegion so a new region fails the build rather than silently
// filtering nothing.

const REGION_TO_INJURY_TAG: Readonly<Record<InjuryRegion, InjuryTag>> = {
  groin: 'groin',
  hip: 'hip',
  quad: 'quad',
  hamstring: 'hamstring',
  knee: 'knee',
  calf: 'calf',
  'ankle/foot': 'ankle',
  ribs: 'ribs',
  lowerBack: 'lower_back',
  neck: 'neck',
  shoulder: 'shoulder',
  elbow: 'elbow',
  'wrist/hand': 'wrist',
};

/**
 * The owner's answer for one body area, renamed into the pool filter's tag
 * vocabulary. Exported so the divergence gate can pin this door equal to the
 * owner behaviourally.
 */
export function injuryTagsForBodyArea(area: string): InjuryTag[] {
  const region = resolveInjuryRegion(area);
  return region === null ? [] : [REGION_TO_INJURY_TAG[region]];
}

/** Convert athlete injuries to a set of InjuryTags for filtering. */
function injuriesToTags(injuries: OnboardingInjury[]): Set<InjuryTag> {
  const tags = new Set<InjuryTag>();
  for (const injury of injuries) {
    for (const tag of injuryTagsForBodyArea(injury.bodyArea)) tags.add(tag);
    // Also check the description for routable body-part words (word-bounded,
    // so 'dribbling' does not read as a rib complaint).
    const desc = (injury.description || '').toLowerCase();
    if (!desc) continue;
    for (const phrase of routableBodyParts()) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`).test(desc)) {
        for (const tag of injuryTagsForBodyArea(phrase)) tags.add(tag);
      }
    }
  }
  return tags;
}

// ─── Equipment Inference ───

// LOCATION_EQUIPMENT and inferEquipment are DELETED (Sam's ruling 4,
// 2026-07-31). The four rows were unsigned, keyed on a location field no
// screen ever collected, and live for 100% of athletes — every kit in the app
// was this constant. Equipment now comes from the athlete's own answer via
// `resolveEquipmentCapabilities`; nothing infers a kit from a location.

// ─── Date Hash (deterministic variety) ───

/**
 * Simple numeric hash from a date string.
 * Used to rotate exercise selection — same date always picks the same exercises,
 * but different dates get variety within the pool.
 */
/**
 * The athlete's eligible mobility movements — equipment and injuries applied.
 *
 * Exported so the Mobility door composes through the SAME filter every other
 * pool draw uses. Re-implementing it in the registry would be a second answer to
 * "can this athlete do this movement", and the first thing it would get wrong is
 * the equipment gate on `dead-hang` and `db-pullovers`.
 */
export function filterMobilityPoolForAthlete(athlete: AthleteContext): PoolExercise[] {
  return filterPoolForAthlete('mobility', athlete);
}

/**
 * Any curated pool, filtered for this athlete.
 *
 * The general form of the function above, added when the D17 session flow needed
 * five pools rather than one. Every consumer that asks "can this athlete do this
 * movement" now asks the same function — which is the point: the first thing a
 * second implementation gets wrong is the equipment gate on `dead-hang` and
 * `db-pullovers`.
 */
export function filterPoolForAthlete(
  category: ExerciseCategory,
  athlete: AthleteContext,
): PoolExercise[] {
  return filterPoolEntriesForAthlete(POOL_REGISTRY[category] ?? [], athlete);
}

/**
 * The same filter over an arbitrary set of curated entries.
 *
 * D17's flow draws its candidates by MUSCLE-SHEET pool rather than by registry
 * category, so it arrives with entries rather than a category — and must still ask
 * the one owner of "can this athlete do this movement".
 */
export function filterPoolEntriesForAthlete(
  entries: readonly PoolExercise[],
  athlete: AthleteContext,
): PoolExercise[] {
  return filterPool(
    [...entries],
    injuriesToTags(athlete.injuries),
    new Set(athlete.equipmentTags),
  );
}

export function dateHash(dateStr: string): number {
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

/**
 * ACCESSORY WORK SAYS SO, instead of being guessed at from its exercise names.
 *
 * Sam's ruling 2 is that gunshow, prehab and accessories are never hard days,
 * and `sessionTypeCharterTests` found the app breaking it: a built
 * "Prehab & Accessories" session classified as `lower_strength` at HIGH stress
 * and took a hard day off the week's budget. The mechanism was pure inference —
 * the session draws Cossack Squat from the groin pool, the exercise tagger reads
 * a squat exposure, and one accessory movement re-typed the whole session.
 *
 * The rows carried NO Section 18 evidence at all, so every consumer downstream
 * had to guess. They now declare `strength_accessory`, which is what they are:
 * the evaluator counts them as accessory (never main strength, never a hard
 * day), and the guess has nothing left to do. A typed fact instead of a
 * heuristic is the charter's whole point.
 */
const ACCESSORY_ROW_EVIDENCE = {
  protocolVersion: 1,
  role: 'strength_accessory',
  strengthPattern: null,
  mainStrengthPattern: null,
  provenance: 'canonical_row_classifier',
} as const;

/**
 * A mobility row declares what it is for the same reason an accessory row does.
 *
 * `Cossack Squat` re-typed a whole prehab session as lower strength once. A
 * mobility draw carries `ATG Split Squat` and `Deep Squat Hold`, which is the same
 * trap one pool over — so the rows say `recovery_support` rather than leaving a
 * classifier to read squats in a stretching session.
 */
const MOBILITY_ROW_EVIDENCE = {
  protocolVersion: 1,
  role: 'recovery_support',
  strengthPattern: null,
  mainStrengthPattern: null,
  provenance: 'canonical_row_classifier',
} as const;

function poolExerciseToWorkoutExercise(
  pe: PoolExercise,
  workoutId: string,
  order: number,
  section18Evidence?: WorkoutExercise['section18Evidence'],
): WorkoutExercise {
  const now = new Date().toISOString();
  return {
    ...(section18Evidence ? { section18Evidence } : {}),
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
  const seed = dateHash(dateStr);

  // Build constraint sets
  const injuryTags = injuriesToTags(athlete.injuries);
  const equipmentSet = new Set(athlete.equipmentTags);

  // Assemble exercises from slots
  const exercises: WorkoutExercise[] = [];
  const workoutId = `derived-${type}-${dateStr}`;
  let order = 1;

  // MOBILITY composes by region, not by slot — Sam's signed shape. Everything
  // after this point (naming, tier, load estimates, the returned Workout) is
  // shared, so the door and the top-up get the identical session.
  if (type === 'mobility') {
    for (const movement of composeMobilitySession({
      seed,
      eligible: filterMobilityPoolForAthlete(athlete),
    })) {
      exercises.push(
        poolExerciseToWorkoutExercise(movement, workoutId, order, MOBILITY_ROW_EVIDENCE),
      );
      order += 1;
    }
    return finaliseDerivedSession({ type, meta, workoutId, microcycleId, dateStr, reason, athlete, exercises });
  }

  const slots = SESSION_SLOTS[type];

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
      // Recovery sessions already carry their identity in `workoutType`; the
      // ACCESSORY types are the ones that were being inferred from content.
      const evidence = type === 'prehab_accessories' || type === 'arms_pump'
        ? ACCESSORY_ROW_EVIDENCE
        : undefined;
      exercises.push(poolExerciseToWorkoutExercise(pe, workoutId, order, evidence));
      order++;
    }

    // Track usage for downstream callers that accumulate across sessions
    if (weekCategoryUsage && picks.length > 0) {
      const prev = weekCategoryUsage.get(slot.category) || 0;
      weekCategoryUsage.set(slot.category, prev + picks.length);
    }

    slotIndex++;
  }

  return finaliseDerivedSession({ type, meta, workoutId, microcycleId, dateStr, reason, athlete, exercises });
}

/**
 * The parts every derived session shares once its rows are chosen.
 *
 * Factored out when `mobility` arrived: a second return statement assembling the
 * same Workout is how the door and the generator would eventually disagree about a
 * field nobody was looking at.
 */
/**
 * The typed charter identity a derived optional session carries to the
 * projection (2026-08-01, device-pass fail 2). The plan entry's
 * `composedOptionalKind` used to die here — the builder consumed the type and
 * emitted name-only identity, so a Gunshow reached the athlete's card as the
 * generic word "Strength". Stamped from the `DerivedSessionType` the builder
 * already receives; the recovery variants stamp nothing (recovery is a
 * charter-deleted type — nothing may carry its identity forward).
 */
const COMPOSED_OPTIONAL_KIND_BY_TYPE: Partial<
  Record<DerivedSessionType, NonNullable<Workout['composedOptionalKind']>>
> = {
  arms_pump: 'gunshow',
  prehab_accessories: 'prehab',
  mobility: 'mobility',
};

function finaliseDerivedSession(args: {
  type: DerivedSessionType;
  meta: (typeof SESSION_META)[DerivedSessionType];
  workoutId: string;
  microcycleId: string;
  dateStr: string;
  reason: string;
  athlete: AthleteContext;
  exercises: WorkoutExercise[];
}): Workout {
  const { type, meta, workoutId, microcycleId, dateStr, reason, athlete, exercises } = args;
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
    ...(COMPOSED_OPTIONAL_KIND_BY_TYPE[type]
      ? { composedOptionalKind: COMPOSED_OPTIONAL_KIND_BY_TYPE[type] }
      : {}),
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

  // Canonical typed strength intent owns composition. Name/type parsing is
  // retained only for legacy templates that have not crossed the ingress yet.
  const exerciseCount = templateWorkout.exercises.length || 5;
  // Position among COUNTED work — see `countingIndices`.
  const contentIndices = countingIndices(templateWorkout.exercises);
  const contentClassifications = templateWorkout.exercises
    .map((row, index) => classifyGeneratedWorkoutRow({
      name: row.exercise?.name ?? row.exerciseId,
      sets: row.prescribedSets,
      repsMax: row.prescribedRepsMax,
      index: contentIndices[index],
    }));
  const contentPatterns = contentClassifications
    .filter((classification) => classification.kind === 'strength_main' && !!classification.mainPattern)
    .map((classification) => classification.mainPattern!);
  const ownership = resolveStrengthOwnershipBoundary({
    strengthIntent: templateWorkout.strengthIntent,
    strengthPatternContributions: templateWorkout.strengthPatternContributions,
    hasModernPlanIdentity: !!templateWorkout.planEntryId,
    standaloneConditioning: !templateWorkout.hasCombinedConditioning && !!(
      templateWorkout.conditioningBlock ||
      templateWorkout.conditioningCategory ||
      templateWorkout.conditioningFlavour
    ),
    canonicalConditioningOnly: contentClassifications.some((classification) =>
      classification.kind === 'conditioning') && contentPatterns.length === 0,
    hasCanonicalMainStrengthRows: contentPatterns.length > 0,
  });
  const legacyIngress = resolveLegacyStrengthIntent({
    strengthIntent: templateWorkout.strengthIntent,
    strengthPatternContributions: templateWorkout.strengthPatternContributions,
    contentPatterns: ownership.allowCanonicalRowInference ? contentPatterns : undefined,
    name: templateWorkout.name,
    allowTextInference: ownership.allowLegacyTextInference,
    allowScalarInference: ownership.allowLegacyTextInference,
  });
  const intent = buildIntent(
    templateWorkout.name,
    templateWorkout.workoutType,
    exerciseCount,
    legacyIngress.intent ?? undefined,
  );

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
import { countingIndices } from '../rules/sessionRowCounting';

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
  const component = feedback.components?.find((entry) => entry.kind === 'conditioning')
    ?? feedback.components?.find((entry) => entry.kind === 'finisher');
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

/**
 * Default easy-aerobic erg policy, expressed as ten deterministic buckets:
 * Bike 40%, mixed erg 40%, RowErg 10%, SkiErg 10%.
 *
 * Callers provide an existing deterministic hash. Explicit plan/athlete
 * modality choices must be resolved before this fallback is used.
 */
export function selectDefaultAerobicErgModalityFromHash(
  hash: number,
): Exclude<ErgModality, 'bike_erg'> {
  const weightedBuckets = [
    'bike', 'bike', 'bike', 'bike',
    'mixed', 'mixed', 'mixed', 'mixed',
    'row',
    'ski',
  ] as const;
  const normalizedHash = Number.isFinite(hash) ? Math.abs(Math.trunc(hash)) : 0;
  const bucket = normalizedHash % weightedBuckets.length;
  return weightedBuckets[bucket];
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
    /** Kept for callers; selection upstream owns modality/pairing now. */
    strengthRegion?: 'lower' | 'upper' | 'full';
    feel?: ConditioningFeel;
    variant?: ConditioningVariant;
    ergModality?: ErgModality;
    attachedConditioningKind?: AttachedConditioningKind;
  },
): WorkoutExercise[] {
  // Sprint rescue volumes: the Stage B pins rule the retired micro-dose and
  // reduced-sprint variants onto the authored '20 m Acceleration Reps'.
  if (opts?.variant === 'micro_dose') {
    return composeSpeedRows(SPEED_FALLBACK_TEMPLATE, dateStr);
  }
  const template = resolveTemplateByName(exerciseName);
  if (
    opts?.variant === 'reduced'
    && template
    && (template.quality === 'acceleration'
      || template.quality === 'top_end_speed'
      || template.quality === 'repeat_sprint')
  ) {
    return composeSpeedRows(SPEED_FALLBACK_TEMPLATE, dateStr);
  }
  if (!template) {
    // Stored/legacy content the sheet does not resolve. Rendering the stored
    // words is not inventing a dose; a bare row keeps them visible.
    return [
      condEx(`cond-${dateStr}-session`, exerciseName, 1, 1, 1, 1, 0, exerciseName),
    ];
  }
  // Combined S+C days: the lift warmed the athlete up; the authored block
  // rides after it without a structural warm-up row.
  return composeConditioningRows(template, dateStr, {
    omitWarmup: opts?.combined === true,
  });
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
  const resolvedTemplate = resolveTemplateByName(result.exerciseName);
  const workoutType: WorkoutType = resolvedTemplate
    ? workoutTypeForTemplate(resolvedTemplate)
    : result.tier === 'C' ? 'Recovery' : 'Conditioning';

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
    capacity: weekLog.capacity,
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

  // ── THE RETIRED PROGRESSION LAYER IS GONE (census B1, 2026-08-13) ──
  //
  // `resolveConditioningProgression` nudged the duration here, on top of Sam's
  // authored dose. He retired that system outright on 2026-07-27, Bible `:4966`:
  // its caps "were never authored ... invented numbers that quietly decide an
  // athlete's conditioning dose", and Section 6 already says *"Doses come from
  // the templates sheet. A layer that invents its own conditioning dose is a
  // defect."* The replacement has been live at `conditioningSelection` the whole
  // time, so BOTH were dosing — precisely the two-systems state he forbade, with
  // the older one inventing its numbers.
  //
  // THE AUTHORED DOSE NOW SHIPS UNMODIFIED. `baseDuration` is the template's own
  // number, and nothing between it and the athlete adjusts it.

  return {
    id: workoutId,
    microcycleId,
    dayOfWeek,
    name: result.exerciseName,
    description: result.exerciseName,
    durationMinutes: baseDuration,
    intensity: conditioningIntensity(result.tier),
    workoutType,
    sessionTier: result.tier === 'C' ? 'recovery' : 'core',
    exercises,
    createdAt: now,
    updatedAt: now,
    // The `_progression*` metadata went with the layer that produced it. It had
    // NO production reader — measured before removal — so nothing downstream
    // loses a value it was using.
  } as Workout;
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
