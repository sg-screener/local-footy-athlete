/**
 * Compatibility types, capacity/classification queries and profile translation.
 * Weekly scheduling is owned by canonicalWeeklyCompiler. The retired private
 * planner and its private rewrite passes have no production caller and were
 * removed; this module must not grow another weekly author.
 */

import type {
  AuthoredDayIdentity, SeasonPhase, AthleteGender, CapacityBand, SessionTier,
  OnboardingData, OnboardingInjury, ConditioningLevel, SprintExposure,
  RecentTrainingLoad, AttachedConditioningKind, SpeedBlock, SpeedBlockPlacement,
  SpeedWorkKind, WeekKind, ExperienceLevel, IntensityLevel, BiggestLimitation,
  RecoveryAddonBlock, Workout, WorkoutType, DeterministicCoachNoteEffectSeed,
  ConditioningFeasibilityDecision, DayOfWeek,
} from '../types/domain';
import { logger } from './logger';
import { todayISOLocal } from './appDate';
import { storedGameAnchor } from '../rules/gameAnchor';
import {
  canonicalStrengthLabel,
  inferMovementPatterns,
  type MovementPattern,
} from './sessionNaming';
import {
  classifyVisibleSession,
  type VisibleSessionClassification,
} from '../rules/sessionClassificationAdapter';
import type { StressContext } from '../rules/stressClassification';
import {
  capacityFor,
  CONSISTENCY_SCORES,
  CONDITIONING_SCORES,
} from '../data/capacityRubric';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';
import type { PreseasonSubphase } from '../rules/preseasonSubphase';
import { motivationBiasTokens, resolveMotivation } from '../rules/motivationGoals';
import type { PowerPrimerSpec } from '../rules/powerPrimerPolicy';
import type { WeeklyExposureContract } from '../rules/weeklyExposureContract';
import type {
  Section18ConditioningRole, Section18EquipmentPolicyState, WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import {
  createStrengthIntent, mainPatternsForLegacyStrengthPattern, normalizeStrengthIntent,
  strengthRegionsForPatterns, type MainStrengthPattern, type StrengthIntent,
} from '../rules/strengthPatternContributions';
import type { GenerationConstraintContext } from './generationConstraints';
import {
  resolveProfileTargetWeekAvailability,
  type FixtureConditionedAvailability,
} from '../rules/fixtureConditionedAvailability';
import { ownSeasonPhaseForGeneration } from '../rules/seasonPhaseOwner';
import { clubTrainingDaysForPhase } from '../rules/clubSeasonScope';
import type {
  SeasonPhaseClock,
  SeasonPhaseClockResolutionProvenance,
} from '../rules/seasonPhaseClock';
// ─── Input Types ───

export interface CoachingInputs {
  seasonPhase: SeasonPhase;
  availableDays: number;
  selectedDays: string[];
  teamTrainingDaysPerWeek: number;
  teamTrainingDays: string[];
  sprintExposure: SprintExposure | undefined;
  conditioningLevel: ConditioningLevel | undefined;
  recentTrainingLoad: RecentTrainingLoad | undefined;
  experienceLevel: ExperienceLevel | undefined;
  // NO squatStrength / benchStrength. They reached this layer only to feed the
  // squat/bench gap-lean, which Sam killed on 2026-07-30. They remain profile answers and
  // still drive starting LOADS through `loadEstimation`'s ruled anchor ladders — that
  // path reads `OnboardingData` directly and never came through here.
  biggestLimitation?: BiggestLimitation;
  injuries: OnboardingInjury[];
  goals: string[];
  /**
   * Athlete football role/position (raw). Optional: when absent, role
   * contributes NO programming bias (it is treated as "not provided", never
   * as a default). Consumed only by the small deterministic role/goal bias.
   */
  role?: string;
  /**
   * R-130's one switch. Optional in the TYPE because non-generation callers
   * (coach reads over partial profiles) can reach this converter — but the
   * generation path is gated by `generationGenderOrThrow`, so a program is
   * never built without it. Consumers branch ONLY on `'female'`: the male path
   * is the absence of the female branch, never a defaulted value.
   */
  gender?: AthleteGender;
  hasGame: boolean;
  gameDay?: string;
  weekNumber?: number;
  miniCycleNumber?: number;
  weekInBlock?: number;
  weekKind?: WeekKind;
  /**
   * The athlete's answer to the bye ask — the ONLY producer of
   * `in_season_bye_recovery` (Sam, 2026-07-29). A pass-through to the contract
   * builder: this engine neither derives it nor defaults it, and an absent
   * answer is a build bye.
   *
   * NOTHING SETS THIS YET, deliberately, and that is APPROVED AS BUILT (Sam,
   * 2026-07-29) — not an oversight and not dead wiring to tidy away. The ask
   * belongs to the buttons/step-5 work
   * (`docs/ONBOARDING_PHASE_SHAPE_RULINGS_2026-07-28.md` §1a), which will store
   * the answer as a schedule-class source fact and thread it here.
   *
   * Sam's reason for keeping the seam ahead of its producer: "a mode with no
   * end-to-end path is untestable, and the seam is exactly where the ask will
   * plug in — one channel, already gated." Deleting it would leave
   * `in_season_bye_recovery` reachable by nothing, which is how a mode quietly
   * acquires a new trigger from whatever happens to be nearby.
   */
  byeMode?: 'build' | 'recovery';
  /** Canonical continuous week inside the persisted selected season phase. */
  phaseWeekNumber?: number;
  phaseEntryWeekStartISO?: string;
  phaseClockSelectedPhase?: SeasonPhase;
  phaseClockProvenance?: SeasonPhaseClockResolutionProvenance;
  offseasonSubphase?: OffseasonSubphase;
  preseasonSubphase?: PreseasonSubphase;
  /** Resolved before contract construction; false authorises equipment reduction. */
  appConditioningFeasible?: boolean;
  /** Typed proof that safe substitutes were considered before any reduction. */
  conditioningSubstitutionPolicy?: Section18EquipmentPolicyState;
  generationConstraints?: GenerationConstraintContext;
  /**
   * Sprint-variant used in the PREVIOUS week, if known. Enables the
   * cross-week guard: if last week used a micro-dose sprint, this week
   * must upgrade to at least 'reduced' (never two micro-doses in a
   * row). Undefined => no guard applied (treated as fresh start).
   */
  previousWeekSprintVariant?: 'standard' | 'reduced' | 'micro_dose';
  /**
   * SET ONLY BY THE COMPOSED ROUTE (slice B1). Its presence is what makes the
   * §18 contract derive its required-pattern set from the planner's own answer
   * and this athlete's kit instead of from `ALL_PATTERNS` — see
   * `Section18ContractV2Input.declaredRequiredPatterns`. Absent on every other
   * route, which is why no non-migrated world moves.
   */
  composedRoute?: { readonly kitUnachievablePatterns: readonly MainStrengthPattern[] };
}

export interface OnboardingToCoachingInputsOptions {
  /**
   * Date used to decide whether temporary availability constraints are active.
   * When omitted, `active` is treated as the source of truth and temporary
   * windows are not compared with the machine clock.
   */
  availabilityDateISO?: string;
  weekNumber?: number;
  miniCycleNumber?: number;
  weekInBlock?: number;
  weekKind?: WeekKind;
  phaseWeekNumber?: number;
  phaseClock?: SeasonPhaseClock;
  phaseClockProvenance?: SeasonPhaseClockResolutionProvenance;
  offseasonSubphase?: OffseasonSubphase;
  preseasonSubphase?: PreseasonSubphase;
  generationConstraints?: GenerationConstraintContext;
  appConditioningFeasible?: boolean;
  conditioningSubstitutionPolicy?: Section18EquipmentPolicyState;
  /** Canonical target-week availability; fixture flows must pass their transition result. */
  targetWeekAvailability?: FixtureConditionedAvailability;
  /** undefined = profile fixture, null = no fixture, day = target fixture day. */
  targetFixtureDay?: DayOfWeek | null;
}

// ─── Output Types ───

/**
 * Re-exported from the domain, where it lives because it TRAVELS: the scheduler
 * states it, the connector carries it, the adapter stamps it onto the workout
 * and the assembler defends it. See `AuthoredDayIdentity` in `types/domain`.
 */
export type { AuthoredDayIdentity };

export interface SessionAllocation {
  tier: SessionTier;
  focus: string;
  dayOfWeek?: string;
  isHardExposure: boolean;
  /**
   * The scheduler's typed day identity. **Read this before inferring anything.**
   * Absent on plans from older producers, which is why every reader falls back
   * to the historical inference rather than assuming.
   */
  authoredDay?: AuthoredDayIdentity;
  /**
   * THIS DAY'S CONTENT IS A COMPOSED SESSION, not a sentence to be interpreted.
   *
   * Sam's class ruling, 2026-07-30: "REAL COMPOSED SESSIONS ONLY — Accessories from
   * the prehab pools, Gunshow from the arms pools, per the signed structures. A
   * sentence on a day is invented composition; that class is dead."
   *
   * Four of the eight placement rows put a FOCUS STRING describing accessory work
   * on a day and left the content to whatever read the string — the AI, or the
   * builder's hardcoded five-row fallback. When this field is set,
   * `buildWorkoutsFromCoach` composes the session from the signed pools instead and
   * the focus string becomes a label rather than a specification.
   *
   * It is set on the two allocations that survive as placements: the authored G-1
   * Gunshow (R1) and the adjacency repair's neutralised day (R8). R2, R3, R4 and R5
   * are deleted rather than marked — the need-based top-up pass owns their
   * placement now, and it composes through the same builders.
   */
  // 'primer' joined on R-130: the female G−1 offer, stamped by the live
  // scheduler-connector path (`scheduleToCoachingPlan`), composed by the same
  // `buildDerivedSession('primer')` the athlete's add door uses.
  composedOptionalKind?: 'gunshow' | 'prehab' | 'primer';
  /** When true, this day has a conditioning block appended after the strength block. */
  hasCombinedConditioning?: boolean;
  /** Finisher vs proper conditioning component for attached S+C work. */
  attachedConditioningKind?: AttachedConditioningKind;
  /** Conditioning flavour for COND or S+C days — guides the resolver/builder. */
  conditioningFlavour?: 'aerobic' | 'tempo' | 'high-intensity';
  /**
   * Energy-system category — primary driver in off-season / pre-season
   * planning. 'tempo' (4B) is TRUE medium conditioning: controlled repeat
   * efforts at 6-7/10 — medium stress, never a hard exposure.
   */
  conditioningCategory?: 'aerobic_base' | 'tempo' | 'sprint' | 'vo2' | 'glycolytic' | 'cod_decel';
  /** Section 18 ownership; canonical construction must preserve this identity. */
  section18ConditioningRole?: Section18ConditioningRole;
  /**
   * Volume variant of the conditioning block:
   *   - 'standard'  : normal template volume (default)
   *   - 'reduced'   : lower fatigue dose — used when sprint is being
   *                   retrofitted into a slot whose preferred pattern was
   *                   different, and for recovery-biased aerobic flushes.
   *   - 'micro_dose': very low volume neural exposure — used as the last
   *                   resort so sprint category is never dropped from a week.
   * Currently only meaningful for sprint sessions.
   */
  conditioningVariant?: 'standard' | 'reduced' | 'micro_dose';
  /** When true, the builder must keep this conditioning block off-feet. */
  conditioningOffFeet?: boolean;
  /**
   * Feel/density tag for the session — used by the builder to pick a
   * structurally-differentiated variant within a category.
   *   - 'grindy'  : long work bouts, short rest (e.g. 3×3min @ 1:1)
   *   - 'sharp'   : short work, long rest      (e.g. 8×20s @ 1:4)
   *   - 'flowing' : continuous or fartlek style with surges
   * Omitted for categories where feel isn't applicable (pure speed).
   */
  conditioningFeel?: 'grindy' | 'sharp' | 'flowing';
  /**
   * Preferred ergometer modality for this session — hint from the engine
   * used when running has been converted to off-feet work. Passes
   * through to the session builder so the week avoids repeating the
   * same erg twice unless forced.
   */
  ergModality?: 'bike' | 'bike_erg' | 'row' | 'ski' | 'mixed';
  /** Canonical equipment/safety feasibility result consumed by every generator. */
  conditioningFeasibility?: ConditioningFeasibilityDecision;
  /** True speed work is not conditioning; it travels as a typed speed block. */
  speedWorkKind?: SpeedWorkKind;
  speedPlacement?: SpeedBlockPlacement;
  speedBlock?: SpeedBlock;
  /**
   * Set by pre-season post-validation when this slot falls on a
   * scheduled team training day. Downstream renderers MUST treat this
   * flag as the primary signal for rendering "Team Training" as the
   * leading label. Team days are locked core sessions — any gym /
   * conditioning layered on top is secondary complement.
   */
  isTeamDay?: boolean;
  /**
   * @deprecated Compatibility/display projection only. Exact allocation
   * ownership lives in strengthIntent; consumers must not reconstruct exact
   * patterns from this enum, focus text, workout names or plan-entry tokens.
   */
  strengthPattern?: 'lower' | 'lower_combined' | 'push' | 'pull' | 'upper_combined' | 'full_body';

  /** Canonical allocation-owned planned/effective strength contract. */
  strengthIntent?: StrengthIntent;
  /**
   * Volume variant of the MAIN STRENGTH work, the exact twin of
   * `conditioningVariant` above — a DOSE, never an identity.
   *
   *   - undefined / 'standard' : normal session volume.
   *   - 'quality_low_volume'   : the authored G-2 exception. Sam, Section 3:
   *     "How close can lower strength be to game day: g-3 (g-2 if it's low range
   *     of motion, low reps, high quality i.e. 2x3 box squats to high box + 2x3
   *     vertical jumps) - low volume, not many exercises."
   *
   * WHY A DOSE AND NOT AN ARCHETYPE. `StrengthArchetype` is DERIVED from the
   * pattern set (`inferStrengthArchetype`: squat -> 'lower'), so a fourth member
   * could never be inferred and `workoutCanonicalisation` would overwrite it on
   * every round trip. It would also be intensity feeding identity, which is a
   * closed Sam ruling (`a670115`). This session IS a lower session; what the
   * anchor's second state scopes is how much of it there is.
   *
   * THE SHAPE ALREADY HAD AN OWNER AND NO PRODUCER. `looksLikeNeuralPrimer`
   * (rules/weekStructureValidator.ts, approved 2026-07-08) is the authored
   * definition — <=2 lower/power exercises, <=3 sets, <=3 reps, no hinge, no
   * deadlift/RDL/Nordic — and `weekStructureValidatorTests` pins Sam's own
   * example. This variant is what finally BUILDS what that validator has been
   * licensing, and cell G3 of the injury-authority suite binds the two so they
   * cannot drift apart.
   *
   * BIBLE_ANCHOR: lower_strength_g3   (this is state 2, the G-2 exception)
   */
  strengthVariant?: 'standard' | 'quality_low_volume';
  /** @deprecated Compatibility projection of strengthIntent.plannedPatterns. */
  strengthPatternContributions?: MainStrengthPattern[];
  /** Stable identity for generated workout matching and diagnostics. */
  planEntryId?: string;

  /**
   * B1 (2026-07-08): stress classification of this allocation, recorded at
   * placement time by the scorer and projected again after generation.
   * Mirrors the rules kernel semantics in stressClassification. Consumed by
   * the consecutive high-stress guards (H1 / H-PRE-5).
   */
  stressLevel?: 'high' | 'medium' | 'low';

  /**
   * Low-dose power/explosive primer decided by `decidePowerPrimer`. Present
   * only on suitable strength sessions when phase, game proximity, readiness,
   * injury, deload and beginner gates all allow it. Rendered downstream as a
   * separate `powerBlock` — never conditioning, never a finisher, never an
   * extra session.
   */
  powerPrimer?: PowerPrimerSpec;

  /**
   * Typed provenance for system Coach Notes. The workout builder converts
   * these seeds into visible-shape proof; they never alter this allocation.
   */
  deterministicCoachNoteEffects?: DeterministicCoachNoteEffectSeed[];
}

function plannedPatternsForAllocation(
  allocation: SessionAllocation,
): MainStrengthPattern[] {
  if (allocation.strengthIntent) {
    return normalizeStrengthIntent(allocation.strengthIntent).plannedPatterns;
  }
  if (allocation.strengthPatternContributions?.length) {
    return [...allocation.strengthPatternContributions];
  }
  return mainPatternsForLegacyStrengthPattern(allocation.strengthPattern);
}

function effectivePatternsForAllocation(
  allocation: SessionAllocation,
): MainStrengthPattern[] {
  if (allocation.strengthIntent) {
    const intent = normalizeStrengthIntent(allocation.strengthIntent);
    return intent.effectivePatterns.length > 0
      ? intent.effectivePatterns
      : intent.plannedPatterns;
  }
  return plannedPatternsForAllocation(allocation);
}

/**
 * Structural generation-side view accepted by the shared visible-session
 * classifier. `strengthIntent` is authoritative; legacy strengthPattern and
 * focus are compatibility inputs only when typed intent is absent.
 */
export interface GenerationSessionClassificationInput {
  focus: string;
  tier: SessionTier;
  isTeamDay?: boolean;
  strengthIntent?: StrengthIntent;
  strengthPattern?: SessionAllocation['strengthPattern'];
  hasCombinedConditioning?: boolean;
  attachedConditioningKind?: AttachedConditioningKind;
  conditioningFlavour?: SessionAllocation['conditioningFlavour'];
  conditioningCategory?: SessionAllocation['conditioningCategory'];
  speedBlock?: SpeedBlock;
  recoveryAddons?: RecoveryAddonBlock[];
  workoutType?: WorkoutType;
  intensity?: IntensityLevel;
}

function canonicalStrengthClassificationName(
  pattern: SessionAllocation['strengthPattern'],
): string | null {
  switch (pattern) {
    case 'lower':
    case 'lower_combined':
      return 'Lower Body Strength';
    case 'push':
    case 'pull':
    case 'upper_combined':
      return 'Upper Body Strength';
    case 'full_body':
      return 'Full Body Strength';
    default:
      return null;
  }
}

/**
 * Project a generation allocation/candidate through the canonical rules
 * adapter without depending on its pre-existing stressLevel flag.
 */
export function classifyGenerationSession(
  input: GenerationSessionClassificationInput,
  context: StressContext = {},
): VisibleSessionClassification {
  const normalizedIntent = input.strengthIntent
    ? normalizeStrengthIntent(input.strengthIntent)
    : null;
  const canonicalStrengthName = normalizedIntent
    ? canonicalStrengthLabel(
        normalizedIntent.effectivePatterns.length > 0
          ? normalizedIntent.effectivePatterns
          : normalizedIntent.plannedPatterns,
      )
    : canonicalStrengthClassificationName(input.strengthPattern);
  const name = canonicalStrengthName ?? input.focus;
  const hardConditioning =
    input.conditioningCategory === 'vo2' ||
    input.conditioningCategory === 'glycolytic' ||
    input.conditioningCategory === 'sprint';
  const hasStandaloneConditioning =
    !input.strengthPattern &&
    (!!input.conditioningCategory || !!input.conditioningFlavour);
  const workoutType = input.workoutType ?? (
    input.isTeamDay
      ? 'Team Training'
      : input.tier === 'recovery'
        ? 'Recovery'
        : input.hasCombinedConditioning
          ? 'Mixed'
          : hasStandaloneConditioning
            ? 'Conditioning'
            : 'Strength'
  );
  const intensity = input.intensity ?? (
    input.speedBlock || hardConditioning
      ? 'High'
      : input.tier === 'recovery' || input.tier === 'optional'
        ? 'Light'
        : 'Moderate'
  );
  const workout: Workout & { isTeamDay?: boolean } = {
    id: 'generation-classification',
    microcycleId: 'generation-classification',
    dayOfWeek: 1,
    name,
    description: name,
    durationMinutes: 45,
    intensity,
    workoutType,
    sessionTier: input.tier,
    strengthIntent: normalizedIntent ?? undefined,
    strengthPatternContributions: normalizedIntent?.plannedPatterns,
    hasCombinedConditioning: input.hasCombinedConditioning,
    attachedConditioningKind: input.attachedConditioningKind,
    conditioningFlavour: input.conditioningFlavour,
    conditioningCategory: input.conditioningCategory,
    speedBlock: input.speedBlock,
    recoveryAddons: input.recoveryAddons,
    exercises: [],
    createdAt: '',
    updatedAt: '',
  };
  if (input.isTeamDay) workout.isTeamDay = true;
  return classifyVisibleSession(workout, context);
}

export interface CoachingPlan {
  // The athlete's STANDING CAPACITY BAND — not what he said about today.
  capacity: CapacityBand;
  capacityFactors: string[];

  // Hard exposure budget
  hardExposureCap: number;
  existingHardExposures: number;
  remainingHardBudget: number;

  // Session allocation
  coreSessions: number;
  optionalSessions: number;
  recoverySessions: number;
  weeklyPlan: SessionAllocation[];

  // Typed phase context owned by the allocation that produced this plan.
  // Downstream prompt/fallback feasibility must not reconstruct it from copy.
  offseasonSubphase?: OffseasonSubphase | null;
  preseasonSubphase?: PreseasonSubphase | null;

  /** Pre-placement source of truth for year-round weekly exposure demand. */
  weeklyExposureContract?: WeeklyExposureContract | null;

  /** Parallel Section 18 policy contract; observational until the commit-gateway slice. */
  weeklyExposureContractV2?: WeeklyExposureContractV2 | null;

  // Constraints for AI
  constraints: AIConstraints;
}

export interface AIConstraints {
  phase: SeasonPhase;
  capacity: CapacityBand;
  hardExposureCap: number;
  existingHardExposures: number;
  coreSessionsToProgram: number;
  optionalSessionsAllowed: number;
  recoverySessionsAllowed: number;
  lowerBodyLoading: 'normal' | 'conservative' | 'avoid';
  sprintLoading: 'allowed' | 'conservative' | 'do-not-add';
  conditioningLoading: 'full' | 'moderate' | 'light-only';
  injuryRestrictions: string[];
  priorities: string[];
  rampUp: boolean;
  maxExercisesPerSession: number;
  notes: string[];
  weeklyExposureContract?: WeeklyExposureContract | null;
}






interface PlanShapeDifference {
  actual: SessionAllocation;
  baseline: SessionAllocation | undefined;
}




// ─── Step 1: Determine Capacity (the standing "readiness" score) ───

/**
 * Score the athlete's STANDING capacity from the two authored ladders.
 *
 * The rubric itself lives in `data/capacityRubric.ts`, which cites Bible
 * Section 9. It used to live here as 18 loose numbers with no source at all —
 * the largest unsourced cluster in the repo. Sam authored it and deleted three
 * whole terms in the process (sprint +0.5, in-season -1, and the injury
 * penalty); see the owner for why each went.
 *
 * This function no longer decides anything. It reads two answers, asks the
 * owner, and reports. That is the point: one representation of the rubric.
 */
export function calculateCapacity(inputs: CoachingInputs): {
  level: CapacityBand;
  factors: string[];
} {
  // Throws when either answer is missing — Sam's ruling, same law as the
  // deleted default bodyweight. Callers must not absorb it into a tier.
  const { score, level } = capacityFor(inputs.recentTrainingLoad, inputs.conditioningLevel);

  const factors: string[] = [
    `Recent training: ${inputs.recentTrainingLoad} (+${CONSISTENCY_SCORES[inputs.recentTrainingLoad!]})`,
    `Conditioning: ${inputs.conditioningLevel} (+${CONDITIONING_SCORES[inputs.conditioningLevel!]})`,
    `Capacity ${score}/6 → ${level}`,
  ];

  const activeReadiness = inputs.generationConstraints?.readiness;
  if (activeReadiness) {
    // THE LAUNDERING SITE — deleted (Sam, 2026-07-27).
    //
    // This used to step the CAPACITY score down on `deloaded` (high -> medium,
    // otherwise -> low). That converted the law's boolean straight back into a
    // magnitude, and every `readiness === 'low'` branch in this engine then read
    // it — so one declaration of "wrecked" quietly reclassified the athlete as
    // permanently detrained and rebuilt their week as recovery work.
    //
    // It is also the HOMONYM running backwards: `level` is the profile capacity
    // score, a different signal that this law does not govern. A deload changes
    // the DOSE, which is DELOAD_LAW's job, not the athlete's training status.
    factors.push(
      // The "/10" was the last severity read outside the door. It was only a log
      // string, which is exactly how these leak: harmless today, then something
      // graduates on it. The two flags say everything this line needs.
      `Active readiness constraint (${activeReadiness.label ?? 'low readiness'}` +
      `${activeReadiness.sessionsOptional ? ', optional' : activeReadiness.deloaded ? ', deloaded' : ''}) ` +
      'recorded; the deload transform owns what it changes',
    );
  }

  return { level, factors };
}

/*
 * ─── Steps 2-4 DELETED (Sam's Batch 0 ruling, 2026-07-28) ───
 *
 * `countTeamHardExposures`, `getHardExposureCap` and `getCoreSessionCount` used
 * to live here: 33 numbers deciding how many hard exposures an athlete could
 * afford and how many gym sessions their week contained. The week-mode exposure
 * contract decided the same things from Sam-authored values, and the two were
 * set from different tables. `coreRange` was then rewritten EIGHT times before
 * it became `actualCore`, so nobody could answer "why did this athlete get
 * three strength sessions?" without simulating all eight.
 *
 * Sam's ruling: the contract is the SINGLE owner of "how many strength sessions
 * this week". This engine consumes what the contract declares; it never
 * re-decides it. Three specific things died with the tables:
 *
 *   - the readiness axis. Structure comes from phase + schedule facts;
 *     capacity affects DOSE only. A phase x readiness count table is the
 *     capacity score setting structure, twice over.
 *   - hard EXPOSURES counted as a budget spent on gym SESSIONS. The unit is
 *     DAYS (Bible Section 2, Sam Batch 2 Q3), and gym work stacked onto an
 *     already-hard team day is deliberately free against it. That conflation is
 *     what the three override floors existed to work around.
 *   - the off-season sprint "+1". A sprint session is not a hard DAY, and
 *     counting it as one silently charged off-season athletes for a day they
 *     never spent.
 *
 * The behaviour the floors encoded is not lost — it is authored, per week mode,
 * in the exposure-contract sheet, and the weeks they protected are pinned BY
 * NAME in `weeklyDoseOwnershipTests` block [4].
 *
 * docs/BATCH0_WEEKLY_DOSE_OWNERSHIP_REASSESSMENT_2026-07-28.md
 * docs/BATCH0_RULING_APPLIED_2026-07-28.md
 */

// ─── Step 2: Build the Full Coaching Plan ───


// ─── Day numbering helper ───

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayNameToNumber(name: string): number {
  const idx = DAY_NAMES.indexOf(name);
  return idx >= 0 ? idx : -1;
}

/**
 * THE DATE A WEEKDAY FALLS ON, in the week containing `anchorISO` — item 30.
 *
 * `dayNameToNumber` is JS-indexed (Sunday 0) and this app's weeks run Monday to
 * Sunday, so the offset is computed against the anchor's Monday. Noon-anchored
 * so it cannot drift across a daylight-saving boundary.
 */
/**
 * Calculate G-offset: how many days before game day is this day?
 * Returns negative numbers (e.g. -5 means G−5).
 * If no game day, returns 0 for all days.
 *
 * Callers compare the result against -3, which is the Bible's boundary for
 * additional high stress rather than a tuned number.
 * BIBLE_ANCHOR: last_high_stress_g3
 */
function gOffset(dayNum: number, gameDayNum: number | null): number {
  if (gameDayNum === null) return 0;
  let diff = dayNum - gameDayNum;
  if (diff > 0) diff -= 7; // wrap around: Sunday after Saturday game = -6 → actually +1, but we want G+1
  if (diff === 0) return 0; // game day itself
  // Special case: day after game = G+1
  if (diff === -6) return 1; // e.g. Sunday (0) after Saturday (6) game
  return diff;
}


// ─── Region Classification ───
//
// Every session has a region: upper, lower, or neutral.
// Used by the adjacency constraint pass to prevent >2 consecutive
// same-region exposures. Optional sessions still count — even light
// upper accessories contribute to upper-body fatigue accumulation.

export type GenerationAdjacencyRegion = 'upper' | 'lower' | 'full_body' | 'neutral';

function adjacencyRegionIncludes(
  region: GenerationAdjacencyRegion,
  target: 'upper' | 'lower',
): boolean {
  return region === target || region === 'full_body';
}

/**
 * Region used by the generation adjacency policy. Main-strength region comes
 * from the shared Bible classifier; accessory-only fatigue remains an
 * explicitly separate placement concern.
 */
export function classifyGenerationAdjacencyRegion(
  session: SessionAllocation,
): GenerationAdjacencyRegion {
  const focus = session.focus.toLowerCase();

  // Recovery tier is always neutral — it's restorative, not loading
  if (session.tier === 'recovery') return 'neutral';

  if (session.strengthIntent) {
    const regions = strengthRegionsForPatterns(
      normalizeStrengthIntent(session.strengthIntent).effectivePatterns,
    );
    if (regions.length === 2) return 'full_body';
    if (regions[0]) return regions[0];
  }

  // Legacy fallback only: live allocations carry typed effective patterns.
  const sharedRegion = classifyGenerationSession(session).strengthRegion;
  if (sharedRegion === 'lower' || sharedRegion === 'upper') return sharedRegion;
  if (sharedRegion === 'full_body') return 'full_body';

  // Accessory-only region is a separate fatigue-placement policy. It is not
  // main-strength credit, so retain the existing low-fatigue distinctions.
  if (focus.includes('arm') || focus.includes('pump') || focus.includes('bicep') || focus.includes('tricep')) return 'upper';

  // Low-fatigue accessories that span both regions (trunk, calves, groin,
  // shoulder prehab) → neutral. These are whole-body accessory work, not
  // upper-biased. Check BEFORE the in-season-specific accessor/prehab rule.
  if (focus.includes('low-fatigue accessor') || focus.includes('low-fatigue accessori')) return 'neutral';

  // In-season accessory / prehab sessions count toward upper exposure tracking.
  // "Light accessories — trunk, calves, groin, shoulder prehab, mobility" is
  // primarily upper-body-adjacent work when placed in the in-season context
  // (G-3 slot). Check these BEFORE the mobility catch-all.
  if (focus.includes('accessor') || focus.includes('prehab') || focus.includes('trunk')) return 'upper';
  if (focus.includes('shoulder')) return 'upper';

  // Pure mobility / recovery sessions that don't include accessory work → neutral
  if (focus.includes('mobility') || focus.includes('foam rolling') || focus.includes('recovery')) return 'neutral';

  // Default: neutral (unknown focus doesn't trigger clustering)
  return 'neutral';
}

type StrengthSequenceKind =
  | 'squat'
  | 'hinge'
  // R-087 widened `MainStrengthPattern`, and `intent.primaryPattern` flows
  // straight into this union — so the two single-leg slots arrive here whether
  // or not the sequencer has an opinion about them. Listed rather than cast.
  | 'single_leg_knee'
  | 'single_leg_hip'
  | 'push'
  | 'pull'
  | 'lower_combined'
  | 'upper_combined'
  | 'full_body'
  | 'neutral';

interface StrengthSequenceOptions {
  teamDayNumSet?: Set<number>;
  hasGameThisWeek?: boolean;
  gameDayNum?: number | null;
}

function strengthSequenceKind(session: SessionAllocation): StrengthSequenceKind {
  if (session.strengthIntent) {
    const intent = normalizeStrengthIntent(session.strengthIntent);
    const patterns = intent.effectivePatterns;
    const hasSquat = patterns.includes('squat');
    const hasHinge = patterns.includes('hinge');
    const hasPush = patterns.includes('push');
    const hasPull = patterns.includes('pull');
    if ((hasSquat || hasHinge) && (hasPush || hasPull)) return 'full_body';
    if (hasSquat && hasHinge) return 'lower_combined';
    if (hasPush && hasPull) return 'upper_combined';
    return intent.primaryPattern ?? 'neutral';
  }
  const strengthPart = (session.focus || '').replace(
    /\s\+\s.*(?:conditioning|finisher|interval|aerobic|tempo|sprint|zone 2).*/i,
    '',
  );
  const patterns = inferMovementPatterns(strengthPart);
  const has = (pattern: MovementPattern): boolean => patterns.includes(pattern);

  const hasSquat = has('squat');
  const hasHinge = has('hinge');
  const hasPush = has('push');
  const hasPull = has('pull');
  const hasLower = hasSquat || hasHinge;
  const hasUpper = hasPush || hasPull;

  if (hasLower && hasUpper) return 'full_body';
  if (hasSquat && hasHinge) return 'lower_combined';
  if (hasPush && hasPull) return 'upper_combined';
  if (hasHinge) return 'hinge';
  if (hasSquat) return 'squat';
  if (hasPull) return 'pull';
  if (hasPush) return 'push';

  switch (session.strengthPattern) {
    case 'lower':
      return 'lower_combined';
    case 'lower_combined':
      return 'lower_combined';
    case 'push':
      return 'push';
    case 'pull':
      return 'pull';
    case 'upper_combined':
      return 'upper_combined';
    case 'full_body':
      return 'full_body';
    default:
      return 'neutral';
  }
}

function strengthBodyRegion(kind: StrengthSequenceKind): GenerationAdjacencyRegion {
  switch (kind) {
    case 'squat':
    case 'hinge':
    case 'lower_combined':
      return 'lower';
    case 'push':
    case 'pull':
    case 'upper_combined':
      return 'upper';
    case 'full_body':
      return 'full_body';
    default:
      return 'neutral';
  }
}

function isPullLike(kind: StrengthSequenceKind): boolean {
  return kind === 'pull' || kind === 'upper_combined' || kind === 'full_body';
}

function isHingeLike(kind: StrengthSequenceKind): boolean {
  return kind === 'hinge' || kind === 'lower_combined' || kind === 'full_body';
}

function isHighPosteriorChainPair(a: StrengthSequenceKind, b: StrengthSequenceKind): boolean {
  return (isPullLike(a) && isHingeLike(b)) || (isHingeLike(a) && isPullLike(b));
}

export function scoreStrengthSequence(plan: SessionAllocation[]): number {
  const byDay = [...plan]
    .filter(s => dayNameToNumber(s.dayOfWeek || '') >= 0)
    .sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));

  let score = 0;

  for (let i = 1; i < byDay.length; i++) {
    const prev = byDay[i - 1];
    const curr = byDay[i];
    const prevDay = dayNameToNumber(prev.dayOfWeek || '');
    const currDay = dayNameToNumber(curr.dayOfWeek || '');
    if (currDay - prevDay !== 1) continue;

    const prevKind = strengthSequenceKind(prev);
    const currKind = strengthSequenceKind(curr);
    const prevRegion = strengthBodyRegion(prevKind);
    const currRegion = strengthBodyRegion(currKind);

    const regionsOverlap =
      (adjacencyRegionIncludes(prevRegion, 'lower') && adjacencyRegionIncludes(currRegion, 'lower')) ||
      (adjacencyRegionIncludes(prevRegion, 'upper') && adjacencyRegionIncludes(currRegion, 'upper'));
    if (regionsOverlap) {
      score += 100;
    }

    if (isHighPosteriorChainPair(prevKind, currKind)) {
      score += 45;
    }

    if (prevRegion === 'lower' && currRegion === 'upper') {
      score += 3;
    }
  }

  const orderedKinds = byDay.map(strengthSequenceKind);
  const firstPush = orderedKinds.indexOf('push');
  const firstPull = orderedKinds.indexOf('pull');
  if (firstPush >= 0 && firstPull >= 0 && firstPull < firstPush) {
    score += 5;
  }

  return score;
}

function gameProximityBucket(dayNum: number, gameDayNum: number | null | undefined): string {
  if (gameDayNum === null || gameDayNum === undefined || gameDayNum < 0) return 'none';
  const offset = gOffset(dayNum, gameDayNum);
  if (offset <= -4 && offset >= -5) return 'high_load';
  if (offset === -3) return 'mid';
  if (offset === -2) return 'late';
  if (offset === -1) return 'pre_game';
  if (offset === 0) return 'game';
  if (offset === 1 || offset <= -6) return 'post_game';
  return 'other';
}


// ─── AI Constraint Builder ───


/**
 * A TEAM DAY IS NEVER REST.
 *
 * Team training is a FACT about the athlete's week — the club places it, not the
 * app — so a team day always carries an allocation even when the app prescribes
 * nothing extra on it. This focus is the placeholder that says exactly that, and
 * the team-day label pass above wholesale-replaces it with the real team session
 * (or the G-1 captain's run).
 *
 * IT IS A NAMED CONSTANT BECAUSE IT USED TO BE A COUPLING NOBODY COULD SEE. The
 * placeholder was previously a recovery session — `tier: 'recovery'`, focus
 * "Mobility, foam rolling, light movement" — and the label pass recognised it by
 * matching that string. So deleting the generator's uninvited recovery
 * placements (Sam's charter, 2026-07-30) silently deleted the TEAM SESSION on
 * any team day the app had nothing else for: `section18PhasePlannerTests`
 * scenario 29 caught a pre-season week that lost its third team training day
 * entirely. One end of a two-ended string match is not a coupling anyone can
 * maintain; both ends now read this.
 */
const TEAM_DAY_PLACEHOLDER_FOCUS = 'Full rest';

// ─── Helper: Build CoachingInputs from OnboardingData ───

export function onboardingToCoachingInputs(
  data: OnboardingData,
  options: OnboardingToCoachingInputsOptions = {},
): CoachingInputs {
  // Reconcile team days into selectedDays.
  //
  // Team days are HARD calendar anchors — the club schedules them and the
  // engine must produce a session on each one. But `preferredTrainingDays`
  // (the user's soft preference) and `teamTrainingDays` are captured by
  // different onboarding steps AND by different phase-shift UI flows, so
  // they can legitimately disagree: an off-season athlete with pref =
  // [Mon, Tue, Thu, Sat] who then shifts to pre-season and picks team =
  // [Mon, Wed] has `preferredTrainingDays` frozen at the old value (the
  // phase-shift UI never asks them to re-pick training days). Without
  // this union, Wed never lands in the scorer's `daySlots`, the universal
  // team-day label pass has nothing to mark on Wed, and the athlete sees
  // Rest on what should be a team day.
  //
  // We union at the engine-input boundary — NOT in `applyPhaseShift` —
  // because team-day-as-hard-anchor is an engine invariant. The stored
  // profile keeps the user's original preferences untouched, and every
  // downstream consumer that goes through this function gets the
  // reconciled set for free.
  const availabilityDate = options.availabilityDateISO ?? todayISOLocal();
  const availabilityDateValue = new Date(`${availabilityDate}T12:00:00`);
  availabilityDateValue.setDate(
    availabilityDateValue.getDate() - ((availabilityDateValue.getDay() + 6) % 7),
  );
  const weekStart = `${availabilityDateValue.getFullYear()}-${String(availabilityDateValue.getMonth() + 1).padStart(2, '0')}-${String(availabilityDateValue.getDate()).padStart(2, '0')}`;
  const targetWeekAvailability = options.targetWeekAvailability ??
    resolveProfileTargetWeekAvailability({
      profile: data,
      weekStart,
      ownedPhase: ownSeasonPhaseForGeneration(data),
    });
  const prefDays = targetWeekAvailability.effectiveAvailableDayNames as string[];
  // THE CLUB FACT IS PHASE-SCOPED HERE (finding 1a, Sam 2026-08-06). Off-season
  // has no club season — Bible :107 "no team training or games means
  // conditioning is controlled" — so derivation does not read the answer. The
  // ANSWER is untouched, which is the whole point: coming back to pre-season
  // restores the club fact with no write. Same boundary, same reasoning as the
  // union below.
  const ownedPhaseForClub = ownSeasonPhaseForGeneration(data).phase;
  const teamDaysForPhase = clubTrainingDaysForPhase(ownedPhaseForClub, data.teamTrainingDays);
  const teamDays = teamDaysForPhase;
  const selectedDays: string[] = [...prefDays];
  for (const td of teamDays) {
    if (!selectedDays.includes(td)) selectedDays.push(td);
  }
  const baseTrainingDays = targetWeekAvailability.effectiveWeeklyTrainingCapacity ||
    data.trainingDaysPerWeek || prefDays.length || 3;
  // availableDays feeds conditioning-target math. If team days forced the
  // actual schedulable-day count above the user's declared budget, lift
  // availableDays to match — otherwise conditioning targets under-count
  // relative to the real week shape (e.g. 5 schedulable days but 4-day
  // conditioning budget → one slot gets no prescription).
  const availableDays = Math.max(baseTrainingDays, selectedDays.length);
  const resolvedFixtureDay = options.targetFixtureDay === undefined
    ? (storedGameAnchor(data) ?? undefined)
    : options.targetFixtureDay;
  const targetFixtureDay = resolvedFixtureDay;
  return {
    seasonPhase: data.seasonPhase || 'Pre-season',
    availableDays,
    selectedDays: selectedDays as any,
    // Both come from the phase-scoped set above, never from the raw answer —
    // a count that outlived the days it counts is the same defect one field on.
    teamTrainingDaysPerWeek: teamDays.length,
    teamTrainingDays: teamDays as any,
    sprintExposure: data.sprintExposure,
    conditioningLevel: data.conditioningLevel,
    recentTrainingLoad: data.recentTrainingLoad,
    experienceLevel: data.experienceLevel,
    biggestLimitation: data.biggestLimitation,
    injuries: data.injuries || [],
    // ONE PARSING RULE, OWNED ELSEWHERE. This was `data.motivation.split(', ')`, one of
    // two copies of that rule; `resolveMotivation` lifts legacy sentences and reads typed
    // goals, so neither copy can drift from the other any more.
    goals: motivationBiasTokens(resolveMotivation(data)),
    role: data.position,
    // R-130: carried verbatim; the scheduler's female G−1 placement reads it.
    gender: data.gender,
    // hasGame means "a specific game is scheduled this week" — it must NOT be
    // a proxy for "phase has team-level context". Previously this was
    // `seasonPhase === 'In-season' || seasonPhase === 'Pre-season'` which made
    // hasGame=true in pre-season even when no game day existed (the log output
    // "gameDay: NONE, hasGame: true" was a symptom of that). That inflated
    // hard-exposure counts in `countTeamHardExposures` for pre-season weeks.
    // Now: hasGame is true iff there is an actual game day on the profile.
    // Off-season always has hasGame=false (no game day). Pre-season only has
    // hasGame=true if the athlete has set a usualGameDay/gameDay.
    hasGame: Boolean(targetFixtureDay),
    // Prefer the new usualGameDay (full DayOfWeek) over the legacy gameDay field
    // so the in-season phase-shift flow drives game-proximity scheduling immediately.
    gameDay: targetFixtureDay ?? undefined,
    weekNumber: options.weekNumber,
    miniCycleNumber: options.miniCycleNumber,
    weekInBlock: options.weekInBlock,
    weekKind: options.weekKind,
    phaseWeekNumber: options.phaseWeekNumber,
    phaseEntryWeekStartISO: options.phaseClock?.phaseEntryWeekStartISO,
    phaseClockSelectedPhase: options.phaseClock?.selectedPhase,
    phaseClockProvenance: options.phaseClockProvenance,
    offseasonSubphase: options.offseasonSubphase,
    preseasonSubphase: options.preseasonSubphase,
    generationConstraints: options.generationConstraints,
    appConditioningFeasible: options.appConditioningFeasible,
    conditioningSubstitutionPolicy: options.conditioningSubstitutionPolicy,
  };
}
