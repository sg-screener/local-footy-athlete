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
  MOBILITY_POOL,
  preferAutomaticCurlCandidates,
  gunshowExercisesCanPair,
  gunshowExerciseIsAutomaticEligible,
  type PoolExercise,
  type ExerciseCategory,
  type EquipmentTag,
  type InjuryTag,
} from '../data/exercisePools';
import {
  injurySeverityPausesAffectedTraining,
  injurySeverityReducesAffectedWork,
  onboardingInjurySeverityScore,
} from '../rules/injurySeverityBands';
import { EXERCISE_TAGS, CONDITIONING_META } from '../data/exerciseTags';
import { composedRowIsLegal } from '../rules/composedRowLegality';
import {
  resolveInjuryRegion,
  routableBodyParts,
  type InjuryRegion,
} from '../data/injuryRegions';
import { exerciseProgrammingAllows, type FilterContext } from './exerciseFilter';
import {
  equipmentRequiredFor,
  exerciseIsAvailableWith,
} from '../data/exerciseEquipmentRequirement';
import { injuryPermitsExerciseAtSeverity } from '../rules/injuryExerciseRisk';
import { guidedInjuryBucketForArea } from './guidedInjuryControl';
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
  mobilityRegionOf,
  type MobilityRegion,
} from '../rules/mobilitySessionComposition';
import {
  eligiblePowerExercises,
  selectPowerExerciseWithTrace,
  type BlockPowerSelection,
  type PowerPoolEntry,
} from '../rules/powerExercisePool';
import {
  rankSelectedFirst,
  type AutomaticProgrammingSelectionTrace,
} from '../rules/programmingSelectionTrace';
import { ladderLevelForProfile } from '../rules/experienceCrosswalk';
import { canonicalExerciseName } from './exerciseCanonicalisation';
import type { PowerFamily } from '../rules/powerPrimerPolicy';

// ─── Athlete Context ───

export interface AthleteContext {
  daysToGame?: number | null;
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
  /** Compiler-owned history and evidence sink for automatically placed Primer power. */
  powerSelectionHistory?: readonly BlockPowerSelection[];
  powerSelectionsOut?: BlockPowerSelection[];
  powerSelectionTracesOut?: AutomaticProgrammingSelectionTrace[];
  powerSelectionBlockStartISO?: string;
  /** Compiler evidence sink for automatically composed Mobility sessions. */
  selectionTracesOut?: AutomaticProgrammingSelectionTrace[];
  selectionWeekStartISO?: string;
}

/** Default context when no profile data is available. */
export const DEFAULT_ATHLETE_CONTEXT: AthleteContext = {
  injuries: [],
  // `swiss_ball` and `ab_wheel` ADDED 2026-08-13 (item 46/47) TO PRESERVE
  // BEHAVIOUR, NOT TO EXTEND IT. This list was written when both exercises
  // were tagged `bodyweight`, so this athlete could always draw them. Sam's
  // own sheet then answered `Swiss Ball Hamstring Curl -> swiss_ball` and
  // `Ab Wheel -> ab_wheel`, and without these two tags this context — which
  // already owns machines, cables and a bench — silently lost them.
  //
  // IT EMPTIED A SLOT: `hamstring_prehab` resolved to ZERO candidates, because
  // the Swiss Ball curl is its only one. That is a real one-deep pool worth
  // knowing about (recorded in docs/STATUS_AUDIT.md), but a default fixture
  // not knowing about a new tag is not the way to discover it.
  equipmentTags: ['bodyweight', 'dumbbells', 'cables', 'bands', 'bench', 'foam_roller', 'bike_or_treadmill', 'machine', 'swiss_ball', 'ab_wheel'],
};

// ─── Derived Session Types ───

export type DerivedSessionType =
  | 'recovery'
  | 'passive_recovery'
  | 'extended_recovery'
  | 'prehab_accessories'
  | 'arms_pump'
  /**
   * PRIMER — Sam's R-129 session, 2026-08-23. A 20-minute day-before-a-game
   * session the athlete adds themselves: four mobility drills, pogo hops, an
   * explosive movement each way, then two skippable extras.
   *
   * It is slot-composed like the others. What is new is not the session, it is
   * two abilities its slots needed and no slot had — a REGION-FILTERED pool
   * draw and non-pool slot sources (`power`, `authored`). Both are properties
   * of a slot, available to anything; neither is a primer branch.
   */
  | 'primer'
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

/**
 * A row a slot AUTHORS rather than chooses.
 *
 * The composer's job is selection. Where Sam authored the movement AND its dose
 * — Pogo Hops 2 x 10, three 15m accelerations — there is nothing to select, and
 * inventing a one-member pool so the picker has something to pick would be a
 * pool that exists to satisfy a code path rather than to hold candidates.
 */
export interface AuthoredSlotRow {
  /**
   * The candidates for this ONE row. The seed picks among them, so a row Sam
   * authored as a choice rotates instead of freezing on the first name.
   *
   * A list rather than a `name` + `alternatives` pair because it is one idea:
   * *"TB dead or high box squat"* (Sam, R-129) is a single row with two legal
   * fillings, and a single-filling row is a list of one. Every name must
   * resolve in the exercise library.
   */
  readonly names: readonly string[];
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly restSeconds: number;
  readonly notes: string;
  readonly prescriptionType?: PoolExercise['prescriptionType'];
  /**
   * SKIPPABLE — renders in the session's OPTIONAL WORK cluster, below the
   * prescribed work, under its own header.
   *
   * ⚠ **THIS FIELD WAS DELETED ON 2026-08-23 AND IS BACK THE SAME DAY, WHICH IS
   * THE POINT.** It was cut because it had a WRITER AND NO READER — the
   * `canOverride` shape. Sam then read the session on his phone: *"the strength
   * work and the accelerations are still in the main session - they should be
   * optional"*. It now has a reader — `sessionTemplate`'s optional cluster,
   * through `WorkoutExercise.optionalNoPenalty` — so it is a fact the athlete
   * can see, not dead weight. **Deleting a reader-less field was right; adding
   * it back once a reader exists is the same rule, not a reversal of it.**
   */
  readonly optional?: boolean;
}

/*
 * ⚠ **TWO FIELDS WERE DRAFTED HERE AND DELETED BEFORE THEY SHIPPED — READ THIS
 * BEFORE ADDING THEM BACK.**
 *
 * `optional?: boolean` and `belowRepFloor?: boolean` were written on this
 * interface to carry R-129's *"optional"* rows and its 3-rep exception. Both
 * would have had a WRITER AND NO READER — CLAUDE.md's `canOverride` shape,
 * "written nine times and read zero" — because Sam's amendment removed the only
 * behaviour `optional` was going to drive (*"you can keep the checkboxes"*), and
 * because the rep floor turned out not to need a per-row flag at all.
 *
 * WHAT CARRIES THEM INSTEAD:
 *  - OPTIONAL is COPY. The athlete has to READ that a row is skippable, and a
 *    boolean nothing renders does not tell them. It leads the row's notes.
 *  - THE REP FLOOR is fixed in its own owner, for every row in the app rather
 *    than for this session — see `strengthProgressionIntegration.applyDelta`.
 */

/**
 * A SLOT NAMES ITS SOURCE.
 *
 * It was one shape — a category and a count — because every composed session
 * drew from the accessory pools and nothing else. R-129's Primer draws from the
 * mobility pool BY REGION, from the explosive pool BY FAMILY, and from Sam's own
 * authored rows, so "which pool" stopped being the only question a slot answers.
 *
 * ⚠ **READ WITH `in`, NEVER BY A DISCRIMINANT FIELD.** This project has no
 * `strictNullChecks`, so the false arm of a discriminated union does not narrow;
 * `'authored' in slot` does. That is why there is no `source: '...'` tag.
 *
 * ⚠ **THESE ARE SLOT ABILITIES, NOT PRIMER RULES.** Sam, 2026-08-23, on being
 * offered the special-case build: *"no do it properly, build it the right
 * way"*. Any session type may use any of them.
 */
export type SessionSlot =
  | {
      category: ExerciseCategory;
      /** How many exercises to pick from this category. */
      count: number;
      /** Additional authored pool candidates competing for the same slot. */
      alternatives?: readonly PoolExercise[];
      /**
       * ONE PICK PER NAMED REGION, then the remainder free.
       *
       * SAM, 2026-08-21, on a recovery day that offered Toe Stretch AND Calf
       * Stretch: *"i don't like the toe stretch and calf stretch either one or the
       * other is fine, but not both, maybe it should be 1 hip, 1 upper body, and
       * one extra"*. Two free picks from one pool can land twice in the same
       * region, which is what he read.
       *
       * The regions are `mobilitySessionComposition`'s — Sam's own signed table,
       * one region per movement, already used by the standalone Mobility session
       * for its full-body spread. **No second opinion about what a region is.**
       */
      spread?: readonly MobilityRegion[];
      /**
       * RESTRICT the shelf to these regions. Every pick comes from one of them.
       *
       * ⚠ **NOT `spread`, AND THE DIFFERENCE IS THE WHOLE POINT.** `spread` takes
       * ONE pick per named region and then fills FREELY from anywhere; `regions`
       * never leaves the named set. R-129 slot 1-2 is *"2 hip mobility drills"* —
       * two picks, both hips — which `spread: ['hips']` would have answered with
       * one hip drill and one of anything.
       *
       * Same shrink-never-pad rule as everywhere else: a region emptied by kit or
       * injury yields fewer rows, never a substitute from outside the set.
       */
      regions?: readonly MobilityRegion[];
    }
  | {
      /** Pick from `POWER_EXERCISE_POOL`, this explosive family only. */
      power: PowerFamily;
      count: number;
      /**
       * The dose, AUTHORED ON THE SLOT and not derived here.
       *
       * `decidePowerPrimer` owns the dose for power that rides INSIDE a strength
       * session, and it needs a phase / readiness / injury context this builder
       * does not receive. Re-deriving a dose from what is to hand would make a
       * second authority for one number. So the slot states it, in the open,
       * where the session's author can see it beside the rows it applies to.
       */
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number;
    }
  | { authored: readonly AuthoredSlotRow[] };

// BIBLE_ANCHOR: gunshow_two_two_two
const SESSION_SLOTS: Record<SlotComposedSessionType, SessionSlot[]> = {
  /* SAM'S SHAPE, 2026-08-21: *"2 soft tissues - 1 light cardio for 10 min and
     breathing to finish"*, with the mobility picks spread *"1 hip, 1 upper
     body, and one extra"*. The breathing row is last because he said "to
     finish" and the rows render in slot order. */
  recovery: [
    { category: 'tissue_quality',   count: 2 },
    { category: 'mobility',         count: 3, spread: ['hips', 'upper'] },
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
  // CROSS-FAMILY TOP-UP — the app reaching outside the candidates Sam had
  // signed to fill a sixth slot — and it is what put "Face Pull" (from
  // `UPPER_BACK_PUMP_POOL`) into a session whose signed shoulder family holds
  // "Cable Face Pull". Gunshow is normal gym work, so its signed families have
  // enough candidates to fill all six slots without a cross-family top-up.
  arms_pump: [
    { category: 'biceps',           count: 2 },
    { category: 'triceps',          count: 2 },
    { category: 'delts',            count: 2 },
  ],
  /**
   * PRIMER — Sam's authored order, R-129, 2026-08-23. Rows render in slot
   * order, so this list IS the session the athlete reads top to bottom.
   *
   * *"2 hip mobility drills, upper back mobility drill, 1 extra drill (not hip
   * or upper back mobility), pogo hops 2x10, explosive upper body, explosive
   * lower body"*. R-288 removes the former three optional exercise rows from
   * this one shared composition owner, so generated and athlete-added Primers
   * cannot diverge.
   *
   * ⚠ **SLOT 3 IS THE WHOLE `upper` REGION, INCLUDING `pec-doorway`.** Sam
   * wrote "upper BACK"; the signed region is broader and holds a chest stretch.
   * He was asked and ruled *"yeah just put the whole upper group in please"*.
   * Narrowing it later needs a new ruling, not a tidy-up.
   */
  primer: [
    { category: 'mobility', count: 2, regions: ['hips'] },
    { category: 'mobility', count: 1, regions: ['upper'] },
    // "1 extra drill (not hip or upper back mobility)" — the complement of the
    // two named regions, stated as the regions it MAY use so an added fifth
    // region is a decision rather than a silent inclusion.
    { category: 'mobility', count: 1, regions: ['lower', 'midline'],
      alternatives: POOL_REGISTRY.hamstring_light.filter(row => EXERCISE_TAGS[row.name]?.programming?.primer) },
    {
      authored: [{
        names: ['Pogo Hops'],
        sets: 2, repsMin: 10, repsMax: 10, restSeconds: 60,
        notes: 'Short, springy contacts. Keep it light.',
      }],
    },
    // Explosive upper is a ONE-CANDIDATE SHELF today (`Explosive Push-up` is the
    // only `family: 'upper'` entry in the pool) and will prescribe the same
    // movement every time. That is R-118's open pool gap, not a defect here;
    // Sam, 2026-08-23: *"just use the push ups for now, I will add more power
    // later"*. It is a pool draw and not an authored row precisely so that the
    // day a second candidate lands, this session rotates with no edit.
    { power: 'upper', count: 1, sets: 2, repsMin: 3, repsMax: 3, restSeconds: 90 },
    // ⚠ **NO `exclude: ['Pogo Hops']` HERE, AND ITS ABSENCE IS MEASURED.**
    // Slot 4 authors Pogo Hops, so this slot must not draw it again (R-118: one
    // exercise appears once per session). An explicit exclusion was written, and
    // MUTATION TESTING KILLED IT — removing it changed nothing, because
    // `eligiblePowerExercises` already drops every `reducedTakeoverOnly` entry
    // and Pogo Hops is the only one. The guarantee lives in the pool owner; a
    // second copy here would have read like the thing holding it.
    { power: 'lower', count: 1, sets: 2, repsMin: 3, repsMax: 3, restSeconds: 90 },
  ],
};

const SESSION_META: Record<DerivedSessionType, {
  name: string;
  workoutType: WorkoutType;
  sessionTier: SessionTier;
  durationMinutes: number;
  intensity: IntensityLevel;
  descriptionSuffix: string;
  /**
   * The suffix IS the whole description — no `reason` prefix.
   * Writer: `SESSION_META` below. Reader: `finaliseDerivedSession`'s
   * `description`. Held by `test:primer-session` S11.
   */
  descriptionIsWhole?: boolean;
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
    descriptionSuffix: 'low-soreness upper body pump; stop with 3 reps in reserve',
  },
  /**
   * PRIMER (R-129). `sessionTier: 'optional'` is the whole counting answer and
   * it is the SAME field Gunshow uses — Sam, 2026-08-23: *"this session will
   * not add fatigue just like gunshow doesn't add fatigue so it won't
   * contribute to their load or readiness"*. No load, never a hard day, never
   * breaks a rest day; nothing here is a second opinion about that.
   *
   * `workoutType: 'Strength'` so the day projects a STRENGTH part, which
   * `composedOptionalKind: 'primer'` then names "Primer" — the same route
   * Gunshow takes. It is not `'Mobility'`: the mobility drills open the session
   * but the explosive and heavy rows are its point.
   *
   * Twenty minutes, in his words: *"a little 20 min session the day before
   * their game to feel good"*.
   */
  primer: {
    name: 'Primer',
    workoutType: 'Strength',
    sessionTier: 'optional',
    durationMinutes: 20,
    intensity: 'Light',
    descriptionSuffix: 'Short and sharp, the day before a game',
    descriptionIsWhole: true,
  },
  // Not conditioning and not strength. The charter's counting row says what the
  // ledger says: no load, never a hard day, never breaks rest — which is also why
  // `:116` lets it sit on a rest day.
  mobility: {
    name: 'Mobility',
    /* ⚠ **`'Recovery'` STOOD HERE AND IT IS WHY THE CARD SAID RECOVERY.** Sam,
     * 2026-08-21, on a session titled Mobility wearing a RECOVERY chip:
     * *"there should be a specific mobility day and a specific recovery day"*.
     * The session was always composed from `MOBILITY_POOL` — only its TYPE was
     * borrowed. The TIER below is deliberately unchanged: it keeps the
     * charter's counting (no load, never a hard day) and the blue badge Sam
     * said could stay. */
    workoutType: 'Mobility',
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
  return preferAutomaticCurlCandidates(filterPool(
    [...entries],
    injuriesToTags(athlete.injuries),
    new Set(athlete.equipmentTags),
  ), athlete.onboardingData?.experienceLevel, row => row.name)
    .filter(row => exerciseProgrammingAllows(row.name, {
      experienceLevel: athlete.onboardingData?.experienceLevel,
      daysToGame: athlete.daysToGame, route: 'automatic',
    }) && (!EXERCISE_TAGS[row.name]?.programming || athlete.injuries.every(injury => {
      const region = guidedInjuryBucketForArea(injury.bodyArea);
      return !region || injuryPermitsExerciseAtSeverity(row.name,
        region, onboardingInjurySeverityScore(injury));
    })));
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
    // Exclude if any contraindication matches an active injury.
    //
    // ⚠ THIS IS ONE OF **TWO** INJURY MECHANISMS, AND IT IS THE ONE THAT COVERS
    // THE POOLS. The other is `classifyExerciseRiskForBucket`
    // (`rules/injuryExerciseRisk.ts`), which reads `EXERCISE_TAGS` and FILTERS an
    // already-built week. **34 of 90 pooled exercises have NO `EXERCISE_TAGS`
    // entry** (measured 2026-08-13), so that filter returns `unknown` for them
    // and lets them through — and they are safe anyway because THIS line refuses
    // them at selection, from `PoolExercise.contraindications`.
    //
    // So the two are not redundant: this one guards WHAT IS CHOSEN, the other
    // guards WHAT SURVIVED. **Deleting either leaves a real hole**, and reading
    // only one of them is how a reader concludes the app fails open on injuries.
    if (ex.contraindications.some(c => injuryTags.has(c))) return false;
    // Exclude if requires equipment the athlete doesn't have
    // (bodyweight exercises always pass — equipment array is empty or contains 'bodyweight')
    if (equipmentRequiredFor(ex.name) !== null) {
      if (!exerciseIsAvailableWith(ex.name, [...equipmentTags])) return false;
    } else if (ex.equipment.length > 0) {
      const hasRequirement = (requirement: (typeof ex.equipment)[number]): boolean => {
        if (Array.isArray(requirement)) {
          return requirement.some((tag) => tag === 'bodyweight' || equipmentTags.has(tag));
        }
        return requirement === 'bodyweight' || equipmentTags.has(requirement as EquipmentTag);
      };
      const hasEquipment = ex.equipment.every(hasRequirement);
      if (!hasEquipment) return false;
    }
    return true;
  });
}

/**
 * Pick N exercises from a filtered pool, using dateHash for rotation.
 * If fewer than N are available after filtering, returns all available.
 */
// BIBLE_ANCHOR: gunshow_two_two_two
function pickFromPool(
  pool: PoolExercise[],
  count: number,
  seed: number,
  canPair?: (left: PoolExercise, right: PoolExercise) => boolean,
): PoolExercise[] {
  if (pool.length === 0) return [];
  const start = seed % pool.length;

  // Preserve the established picker for every session without pair rules.
  if (!canPair) {
    if (pool.length <= count) return pool;
    const picks: PoolExercise[] = [];
    for (let index = 0; index < count; index++) {
      picks.push(pool[(start + index) % pool.length]);
    }
    return picks;
  }

  const rotated = pool.map((_, index) => pool[(start + index) % pool.length]);
  let best: PoolExercise[] = [];

  const search = (from: number, picks: PoolExercise[]): boolean => {
    if (picks.length > best.length) best = [...picks];
    if (picks.length === count) return true;
    for (let index = from; index < rotated.length; index++) {
      const candidate = rotated[index];
      if (!picks.every((picked) => canPair(picked, candidate))) continue;
      picks.push(candidate);
      if (search(index + 1, picks)) return true;
      picks.pop();
    }
    return false;
  };

  search(0, []);
  return best;
}

/**
 * ONE PICK PER NAMED REGION FIRST, THEN FILL — Sam's *"1 hip, 1 upper body,
 * and one extra"*.
 *
 * ⚠ **A NAMED REGION WITH NOTHING LEGAL IN IT IS SKIPPED, NOT PADDED.** An
 * athlete whose kit or injuries empty the `upper` shelf gets the remaining
 * picks from what IS legal rather than a short session or a refusal — the same
 * "shrink rather than pad" rule the composed Mobility session already follows.
 *
 * Rotation is preserved: each region's own pick walks `seed`, so two
 * consecutive recovery days do not open with the same hip stretch.
 */
function pickAcrossRegions(
  pool: PoolExercise[],
  count: number,
  spread: readonly MobilityRegion[],
  seed: number,
): PoolExercise[] {
  const picks: PoolExercise[] = [];
  const taken = new Set<string>();

  spread.forEach((region, index) => {
    if (picks.length >= count) return;
    const shelf = pool.filter(
      (entry) => mobilityRegionOf(entry) === region && !taken.has(entry.id),
    );
    if (shelf.length === 0) return;
    const chosen = shelf[(seed + index * 31) % shelf.length];
    picks.push(chosen);
    taken.add(chosen.id);
  });

  // The remainder — "one extra" — from anything not already taken.
  const rest = pool.filter((entry) => !taken.has(entry.id));
  for (let index = 0; picks.length < count && index < rest.length; index++) {
    picks.push(rest[(seed + index * 17) % rest.length]);
    taken.add(rest[(seed + index * 17) % rest.length].id);
  }
  return picks;
}

function pairRuleFor(type: DerivedSessionType): ((
  left: PoolExercise,
  right: PoolExercise,
) => boolean) | undefined {
  if (type === 'arms_pump') {
    return gunshowExercisesCanPair;
  }
  return undefined;
}

const GUNSHOW_AFFECTED_INJURY_REGIONS = new Set<InjuryRegion>([
  'shoulder', 'elbow', 'wrist/hand', 'neck',
]);

/**
 * Gunshow is optional pump work, so the Bible injury band owns its whole dose:
 * 4-7/10 reduces each 2-row family to one; 8-10/10 pauses it. Mild injuries
 * keep the ordinary per-exercise trigger filter. This preserves the manual Add
 * door while preventing a significant upper-body injury receiving six rows.
 */
function gunshowSlotCount(
  authoredCount: number,
  injuries: readonly OnboardingInjury[],
): number {
  const relevantSeverities = injuries.flatMap((injury) => {
    const region = resolveInjuryRegion(injury.bodyArea);
    return region && GUNSHOW_AFFECTED_INJURY_REGIONS.has(region)
      ? [onboardingInjurySeverityScore(injury)] : [];
  });
  if (relevantSeverities.some(injurySeverityPausesAffectedTraining)) return 0;
  if (relevantSeverities.some(injurySeverityReducesAffectedWork)) {
    return Math.min(authoredCount, 1);
  }
  return authoredCount;
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

/**
 * A slug for an authored row, so its id is stable and readable rather than a
 * position. `exerciseId` is what every downstream lookup keys on.
 */
function authoredRowId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * THE ROW SAM AUTHORED, WITH ITS FILLING ROTATED.
 *
 * `names` is one row's candidates — *"TB dead or high box squat"* — so the seed
 * chooses among them exactly as a pool draw would, and two consecutive Primers
 * do not open the same way. A single-candidate row is the same code path with
 * nothing to choose.
 */
function authoredSlotRowToWorkoutExercise(
  row: AuthoredSlotRow,
  workoutId: string,
  order: number,
  seed: number,
): WorkoutExercise {
  const now = new Date().toISOString();
  const name = row.names[Math.abs(seed) % row.names.length];
  const id = authoredRowId(name);
  return {
    // AN AUTHORED PRIMER ROW IS NOT MAIN STRENGTH AND NEVER A HARD DAY.
    // `Trap Bar Deadlift` and `Bench Press` are main lifts anywhere else in the
    // app, and a classifier reading their NAMES here would hand the week a hard
    // strength exposure the athlete never took — the exact inference
    // ACCESSORY_ROW_EVIDENCE was written to end for the Gunshow's curls.
    section18Evidence: ACCESSORY_ROW_EVIDENCE,
    id: `${workoutId}-ex-${order}`,
    workoutId,
    exerciseId: id,
    exerciseOrder: order,
    prescribedSets: row.sets,
    prescribedRepsMin: row.repsMin,
    prescribedRepsMax: row.repsMax,
    restSeconds: row.restSeconds,
    ...(row.prescriptionType ? { prescriptionType: row.prescriptionType } : {}),
    ...(row.optional ? { optionalNoPenalty: true } : {}),
    // An authored row's dose is a decision, not a range to simplify.
    exactDose: true,
    notes: row.notes,
    exercise: {
      id,
      name,
      description: row.notes,
    } as Exercise,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * THE EXPLOSIVE PICK IS THE POWER POOL'S OWN DECISION, NOT A SECOND FILTER.
 *
 * `eligiblePowerExercises` already holds every safety answer the pool's author
 * signed — family, in-season safety, phase gate, training age, equipment, and
 * the reduced-takeover exclusion that keeps Pogo Hops out of an ordinary slot.
 * Re-implementing any of it here would be a second opinion about which jumps are
 * safe.
 *
 * ⚠ **PHASE IS ASSERTED AS `In-season`, WHICH IS THE STRICT READING AND IS
 * DELIBERATE.** This builder receives no phase. A Primer is the session before a
 * game, and prescribing an off-season-only movement — depth jumps, bounds,
 * kneeling jumps — the day before one contradicts the session's whole purpose.
 * Asserting the narrowest phase asks the pool for the safest answer rather than
 * guessing at the athlete's actual one. It is a FLOOR, and if this builder is
 * ever handed a real phase, pass it — the answer can only widen.
 */
function pickPowerEntries(
  slot: { power: PowerFamily; count: number },
  athlete: AthleteContext,
  seed: number,
  dateISO: string,
): PowerPoolEntry[] {
  const context = {
    family: slot.power,
    phase: 'In-season' as const,
    // ⚠ **`ladderLevelForProfile`, NOT `ladderLevelForOnboardingAnswer`.** The
    // strict resolver THROWS on an answer with no crosswalk row, and this call
    // site is a session build, not a profile validation — an athlete whose
    // recorded answer is off the crosswalk should get a Primer, not a crash.
    // Written strict first and CAUGHT BY MEASUREMENT: `test:athlete-door-matrix`
    // went 416/15 to 414/17 with "no crosswalk row for onboarding answer
    // 'Advanced'". That module's own comment names this the entry point for a
    // possibly-incomplete profile; the strict one exists for callers who must
    // refuse, and this is not one.
    trainingAge: ladderLevelForProfile(athlete.onboardingData?.experienceLevel),
    reduced: false,
    availableEquipment: athlete.equipmentTags ?? [],
    blockId: athlete.powerSelectionBlockStartISO ?? `primer-${seed}`,
    kind: 'primer' as const,
    selectionContext: athlete.powerSelectionBlockStartISO ? {
      blockStartISO: athlete.powerSelectionBlockStartISO,
      history: athlete.powerSelectionHistory ?? [],
    } : undefined,
  };
  const eligible = eligiblePowerExercises(context).filter(entry => exerciseProgrammingAllows(entry.name, {
    experienceLevel: athlete.onboardingData?.experienceLevel,
    daysToGame: athlete.daysToGame, route: 'primer',
  }) && athlete.injuries.every(injury => {
    const region = guidedInjuryBucketForArea(injury.bodyArea);
    return !region || injuryPermitsExerciseAtSeverity(entry.name,
      region, onboardingInjurySeverityScore(injury));
  }));

  // SHRINK, NEVER PAD — the rule this repo applies everywhere else. A family
  // whose shelf is empty yields no row; it does not borrow from the other one.
  const picks: PowerPoolEntry[] = [];
  for (let index = 0; index < slot.count && index < eligible.length; index++) {
    const decision = selectPowerExerciseWithTrace(
      { ...context, seatIndex: index },
      {
        dateISO,
        weekStartISO: athlete.powerSelectionBlockStartISO ?? dateISO,
        dayOfWeek: new Date(`${dateISO}T12:00:00Z`).getUTCDay(),
        experience: athlete.onboardingData?.experienceLevel ?? null,
        injuries: athlete.injuries.map((injury) => injury.bodyArea),
        daysToGame: athlete.daysToGame ?? null,
      },
    );
    const selected = decision.entry && eligible.some((entry) => entry.name === decision.entry?.name)
      ? decision.entry
      : [...eligible].sort((left, right) => left.name.localeCompare(right.name))[index % eligible.length];
    picks.push(selected);
    if (athlete.powerSelectionBlockStartISO && athlete.powerSelectionsOut &&
        !athlete.powerSelectionsOut.some((row) =>
          row.blockStartISO === athlete.powerSelectionBlockStartISO &&
          row.family === slot.power && row.seatIndex === index)) {
      athlete.powerSelectionsOut.push({
        blockStartISO: athlete.powerSelectionBlockStartISO,
        family: slot.power,
        seatIndex: index,
        exerciseName: selected.name,
      });
    }
    athlete.powerSelectionTracesOut?.push(selected === decision.entry
      ? decision.trace
      : {
          ...decision.trace,
          selected: selected.name,
          candidates: decision.trace.candidates.map((candidate) => ({
            ...candidate,
            eligible: eligible.some((entry) => entry.name === candidate.name),
            rejectedBy: eligible.some((entry) => entry.name === candidate.name)
              ? []
              : candidate.rejectedBy.length > 0 ? candidate.rejectedBy : ['injury'],
            rank: candidate.name === selected.name ? 1 : null,
          })),
          selectionReason: 'primer_safety_filter_then_stable_power_selection',
        });
  }
  return picks;
}

function powerEntryToWorkoutExercise(
  entry: PowerPoolEntry,
  slot: { sets: number; repsMin: number; repsMax: number; restSeconds: number },
  workoutId: string,
  order: number,
): WorkoutExercise {
  const now = new Date().toISOString();
  const id = authoredRowId(entry.name);
  const authored = EXERCISE_TAGS[entry.name]?.prescription;
  return {
    // The existing authored slot owns dose/order; the power pool owns role.
    // A Primer's explosive row must not masquerade as a strength accessory.
    role: 'power',
    power: { family: entry.family, kind: 'primer' },
    section18Evidence: {
      protocolVersion: 1,
      role: 'power',
      strengthPattern: null,
      mainStrengthPattern: null,
      provenance: 'canonical_row_classifier',
    },
    id: `${workoutId}-ex-${order}`,
    workoutId,
    exerciseId: id,
    exerciseOrder: order,
    prescribedSets: slot.sets,
    prescribedRepsMin: authored?.repsMin ?? slot.repsMin,
    prescribedRepsMax: authored?.repsMax ?? slot.repsMax,
    restSeconds: authored?.restSeconds ?? slot.restSeconds,
    prescriptionType: authored?.prescriptionType,
    perSide: authored?.perSide,
    notes: authored?.notes ?? entry.authoredCueIntent,
    exercise: {
      id,
      name: entry.name,
      description: entry.authoredCueIntent,
    } as Exercise,
    createdAt: now,
    updatedAt: now,
  };
}

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
  existingExerciseNames: readonly string[] = [],
): Workout {
  const meta = SESSION_META[type];
  const seed = dateHash(dateStr);

  // Build constraint sets
  const injuryTags = injuriesToTags(athlete.injuries);
  const equipmentSet = new Set(athlete.equipmentTags);
  const alreadyProgrammed = new Set(existingExerciseNames.map(canonicalExerciseName));
  const notAlreadyProgrammed = (row: PoolExercise) => !alreadyProgrammed.has(canonicalExerciseName(row.name));

  // Assemble exercises from slots
  const exercises: WorkoutExercise[] = [];
  const workoutId = `derived-${type}-${dateStr}`;
  let order = 1;

  // MOBILITY composes by region, not by slot — Sam's signed shape. Everything
  // after this point (naming, tier, load estimates, the returned Workout) is
  // shared, so the door and the top-up get the identical session.
  if (type === 'mobility') {
    const eligible = filterMobilityPoolForAthlete(athlete).filter(notAlreadyProgrammed);
    const selected = composeMobilitySession({
      seed,
      eligible,
    });
    const previouslySelected = new Set<string>();
    selected.forEach((movement, seatIndex) => {
      const region = mobilityRegionOf(movement);
      const candidates = MOBILITY_POOL.map((candidate) => {
        const sameRegion = mobilityRegionOf(candidate) === region;
        const available = eligible.some((entry) => entry.id === candidate.id);
        const alreadyOnDay = previouslySelected.has(candidate.id);
        const eligibleForSeat = sameRegion && available && !alreadyOnDay;
        return {
          name: candidate.name,
          eligible: eligibleForSeat,
          rejectedBy: eligibleForSeat ? []
            : !sameRegion ? ['wrong_movement_or_quality' as const]
              : alreadyOnDay ? ['already_on_day' as const]
                : ['athlete_availability' as const],
          rank: null,
          score: {
            phasePriority: 0,
            athletePreference: false,
            recentUsage: 0,
            annualUsage: 0,
            weeksOrBlocksSinceUse: null,
            weeklyUsage: alreadyOnDay ? 1 : 0,
          },
        };
      });
      athlete.selectionTracesOut?.push({
        schemaVersion: 1,
        decisionId: `mobility:${dateStr}:${region ?? 'unmapped'}:${seatIndex}`,
        kind: 'mobility_exercise',
        owner: 'mobilitySessionComposition',
        need: {
          dateISO: dateStr,
          weekStartISO: athlete.selectionWeekStartISO ?? dateStr,
          dayOfWeek: new Date(`${dateStr}T12:00:00`).getDay(),
          phase: athlete.onboardingData?.seasonPhase ?? 'unknown',
          movementOrQuality: region ?? 'unmapped',
          role: 'mobility_support',
          seatIndex,
          equipment: [...athlete.equipmentTags],
          experience: athlete.onboardingData?.experienceLevel ?? null,
          injuries: athlete.injuries.map((injury) => injury.bodyArea),
          daysToGame: athlete.daysToGame ?? null,
        },
        candidates: rankSelectedFirst(candidates, movement.name),
        selected: movement.name,
        selectionReason: 'deterministic_region_spread',
      });
      previouslySelected.add(movement.id);
      exercises.push(
        poolExerciseToWorkoutExercise(movement, workoutId, order, MOBILITY_ROW_EVIDENCE),
      );
      order += 1;
    });
    return finaliseDerivedSession({ type, meta, workoutId, microcycleId, dateStr, reason, athlete, exercises });
  }

  const slots = SESSION_SLOTS[type];

  // Use a category-specific sub-seed for each slot so different categories
  // rotate independently
  let slotIndex = 0;
  for (const slot of slots) {
    const slotSeedForSource = seed + slotIndex * 7919;

    // Authored dose/order stays fixed; an authored candidate still needs kit.
    if ('authored' in slot) {
      for (const row of slot.authored) {
        const names = row.names.filter(name => composedRowIsLegal(name, athlete.equipmentTags));
        if (names.length === 0) continue;
        exercises.push(authoredSlotRowToWorkoutExercise(
          { ...row, names }, workoutId, order, slotSeedForSource + order,
        ));
        order += 1;
      }
      slotIndex += 1;
      continue;
    }

    // ── EXPLOSIVE POOL — the power pool's own eligibility owner decides ──
    if ('power' in slot) {
      for (const entry of pickPowerEntries(slot, athlete, slotSeedForSource, dateStr)) {
        exercises.push(powerEntryToWorkoutExercise(entry, slot, workoutId, order));
        order += 1;
      }
      slotIndex += 1;
      continue;
    }

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
    // REGION RESTRICTION FIRST, so injury and equipment filtering then runs over
    // the shelf the slot actually named. Doing it the other way round would let
    // an unavailable drill count against the region's supply.
    const inRegion = slot.regions
      ? pool.filter((entry) => slot.regions.indexOf(mobilityRegionOf(entry)) !== -1)
      : pool;
    const filtered = filterPoolEntriesForAthlete([...inRegion, ...(slot.alternatives ?? [])], athlete).filter(notAlreadyProgrammed)
      .filter(row => type !== 'arms_pump' || gunshowExerciseIsAutomaticEligible(row))
      .filter(row => type !== 'primer' || exerciseProgrammingAllows(row.name, {
        experienceLevel: athlete.onboardingData?.experienceLevel, daysToGame: 1, route: 'primer',
      }));
    const slotSeed = slotSeedForSource; // prime offset for variety
    const requestedCount = type === 'arms_pump'
      ? gunshowSlotCount(slot.count, athlete.injuries)
      : slot.count;
    const picks = slot.spread
      ? pickAcrossRegions(filtered, requestedCount, slot.spread, slotSeed)
      : pickFromPool(filtered, requestedCount, slotSeed, pairRuleFor(type));

    for (const pe of picks) {
      // Recovery sessions already carry their identity in `workoutType`; the
      // ACCESSORY types are the ones that were being inferred from content.
      // A PRIMER's pool picks are all mobility drills, so they declare
      // `recovery_support` for the same reason the Mobility session's do — a
      // classifier reading `ATG Split Squat` in a stretching slot is the trap
      // MOBILITY_ROW_EVIDENCE exists for.
      const evidence = type === 'prehab_accessories' || type === 'arms_pump'
        ? ACCESSORY_ROW_EVIDENCE
        : type === 'primer'
          ? MOBILITY_ROW_EVIDENCE
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
  primer: 'primer',
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
    /*
     * WARNING: `reason` IS PROVENANCE, AND THE PRIMER DOES NOT PUT IT ON SCREEN.
     * Sam, 2026-08-23: *"the subtitle doesn't need to say 'athlete added session'
     * - just start at 'short and sharp'"*. `reason` is a builder-internal string
     * ("Athlete-added session", "coach-template"), and prefixing it told the
     * athlete where the row came from instead of what it is.
     *
     * SCOPED to the sessions that opt in via `descriptionIsWhole`, NOT applied to
     * every type: the other six have shipped their prefixed description for
     * months and changing them all is a copy change Sam has not asked for.
     */
    description: meta.descriptionIsWhole
      ? meta.descriptionSuffix
      : `${reason} - ${meta.descriptionSuffix}`,
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
// CONDITIONING SESSION BUILDING
// ═══════════════════════════════════════════════════════════════

import type { ConditioningProgressionInput } from './conditioningProgressionRules';
import { calculateConditioningLoad } from './progressionHelpers';

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

/** R-232: stored feedback → the ease module's plain entries. Effort and
 *  completion come from the SAME readers the progression overrides use, so
 *  the two consumers cannot classify one log differently. */
function conditioningFeedbackEaseEntries(
  feedbackMap: Record<string, SessionFeedback> | undefined,
): import('../rules/conditioningFeedbackEase').ConditioningFeedbackEntry[] {
  if (!feedbackMap) return [];
  return Object.values(feedbackMap)
    .filter(hasConditioningFeedback)
    .map((feedback) => ({
      date: feedback.dateStr,
      tier: conditioningTierForFeedback(feedback) as import('../data/exerciseTags').ConditioningTier,
      effort: feedback.conditioning?.rpe ?? feedback.difficulty
        ?? feedbackFeelingToConditioningRPE(feedback.feeling),
      completedFully: conditioningComponentCompletion(feedback) === 'full',
    }));
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
    /** The athlete's measured MAS (km/h) for the `Your pace` line. */
    masKmh?: number | null;
    /** Kept for callers; selection upstream owns modality/pairing now. */
    strengthRegion?: 'lower' | 'upper' | 'full';
    feel?: ConditioningFeel;
    variant?: ConditioningVariant;
    ergModality?: ErgModality;
    attachedConditioningKind?: AttachedConditioningKind;
    /** Exact build-week prescription rung. */
    weekInBlock?: number;
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
    // ⚠ **THIS USED TO SWAP THE TEMPLATE, WHICH IS NOT A VOLUME REDUCTION.**
    // It returned `SPEED_FALLBACK_TEMPLATE` — `20 m Acceleration Reps`, authored
    // `8 reps` — in place of, say, `10 m Acceleration Reps` at `6–10 reps`. The
    // deload week came back with 8 reps of a LONGER sprint than the build week's
    // 8 reps of a shorter one. Measured: `10 m … 8x1` -> `20 m … 8x1`.
    //
    // Sam's ruling asks for the VOLUME to fall on an authored dose. So the
    // athlete keeps their own session and drops to the sheet's authored low end
    // — same template, same quality, 8 reps becomes 6.
    return composeConditioningRows(template, dateStr, {
      omitWarmup: opts?.combined === true,
      authoredMinimumDose: true,
      masKmh: opts?.masKmh ?? null,
      weekInBlock: opts?.weekInBlock,
    });
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
    masKmh: opts?.masKmh ?? null,
    weekInBlock: opts?.weekInBlock,
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
