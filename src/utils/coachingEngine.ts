/**
 * Coaching Engine — Deterministic S&C Decision Logic
 *
 * This module owns all STRATEGIC coaching decisions:
 *   - Readiness classification (low / medium / high)
 *   - Hard exposure counting & caps
 *   - Core / Optional / Recovery session allocation
 *   - Injury & sprint constraints
 *   - Ramp-up conservatism for inconsistent athletes
 *
 * The AI receives the OUTPUT of this engine as constraints,
 * then handles exercise selection, progression style, and coaching tone.
 *
 * Principle: "Code decides the dose. AI decides the details."
 */

import type {
  SeasonPhase,
  ReadinessLevel,
  SessionTier,
  OnboardingData,
  OnboardingInjury,
  ConditioningLevel,
  SprintExposure,
  RecentTrainingLoad,
  TeamTrainingIntensity,
  AttachedConditioningKind,
  SpeedBlock,
  SpeedBlockPlacement,
  SpeedWorkKind,
  WeekKind,
  ExperienceLevel,
  IntensityLevel,
  RecoveryAddonBlock,
  Workout,
  WorkoutType,
} from '../types/domain';
import { logger } from './logger';
import { inferMovementPatterns, type MovementPattern } from './sessionNaming';
import {
  classifyVisibleSession,
  type VisibleSessionClassification,
} from '../rules/sessionClassificationAdapter';
import type { StressContext } from '../rules/stressClassification';
import { logAllocationWeekValidation } from '../rules/weekStructureValidator';
import { evaluateSprintExposureGate } from '../rules/sprintExposureGate';
import {
  resolveOffseasonSubphase,
  type OffseasonSubphase,
} from '../rules/offseasonSubphase';
import {
  getOffseasonSubphasePolicy,
  type OffseasonConditioningCategory,
} from '../rules/offseasonSubphasePolicy';
import {
  resolvePreseasonSubphase,
  type PreseasonSubphase,
} from '../rules/preseasonSubphase';
import { getPreseasonSubphasePolicy } from '../rules/preseasonSubphasePolicy';
import {
  computeProgrammingBias,
  applyConditioningCategoryBias,
} from '../rules/programmingBias';
import { createLateOffseasonSpeedBlock } from '../rules/speedTemplates';
import { resolveWeekContext } from '../rules/weekContext';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import type {
  GenerationConstraintContext,
  GenerationInjuryConstraint,
  GenerationReadinessTier,
} from './generationConstraints';

// ─── Input Types ───

export interface CoachingInputs {
  seasonPhase: SeasonPhase;
  availableDays: number;
  selectedDays: string[];
  teamTrainingDaysPerWeek: number;
  teamTrainingDays: string[];
  teamTrainingIntensity: TeamTrainingIntensity | undefined;
  sprintExposure: SprintExposure | undefined;
  conditioningLevel: ConditioningLevel | undefined;
  recentTrainingLoad: RecentTrainingLoad | undefined;
  experienceLevel: ExperienceLevel | undefined;
  injuries: OnboardingInjury[];
  goals: string[];
  /**
   * Athlete football role/position (raw). Optional: when absent, role
   * contributes NO programming bias (it is treated as "not provided", never
   * as a default). Consumed only by the small deterministic role/goal bias.
   */
  role?: string;
  hasGame: boolean;
  gameDay?: string;
  weekNumber?: number;
  miniCycleNumber?: number;
  weekInBlock?: number;
  weekKind?: WeekKind;
  offseasonSubphase?: OffseasonSubphase;
  preseasonSubphase?: PreseasonSubphase;
  generationConstraints?: GenerationConstraintContext;
  /**
   * Sprint-variant used in the PREVIOUS week, if known. Enables the
   * cross-week guard: if last week used a micro-dose sprint, this week
   * must upgrade to at least 'reduced' (never two micro-doses in a
   * row). Undefined => no guard applied (treated as fresh start).
   */
  previousWeekSprintVariant?: 'standard' | 'reduced' | 'micro_dose';
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
  offseasonSubphase?: OffseasonSubphase;
  preseasonSubphase?: PreseasonSubphase;
  generationConstraints?: GenerationConstraintContext;
}

// ─── Output Types ───

export interface SessionAllocation {
  tier: SessionTier;
  focus: string;
  dayOfWeek?: string;
  isHardExposure: boolean;
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
  conditioningCategory?: 'aerobic_base' | 'tempo' | 'sprint' | 'vo2' | 'glycolytic';
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
   * Explicit strength-movement pattern loaded on this session. This is
   * the single source of truth for "is this session a strength
   * exposure" and must be populated by the engine at placement time for
   * every intentional strength loading (lower/push/pull/full_body).
   *
   * Critical: this field is ORTHOGONAL to `tier`. The universal
   * team-day label pass promotes team days to `tier: 'core'` without
   * layering strength — those days have `strengthPattern: undefined`
   * and must NOT be counted as strength exposures. Likewise, an
   * optional gunshow / arms-pump day is not a strength exposure even
   * if the focus text mentions "upper body".
   *
   * Consumers (invariants, analytics, UI badges): read THIS field, not
   * the focus string, to measure H-IS-3 / H-PRE-6 / H-PRE-7/8/9
   * coverage. Team-label pass and any other tier-promotion logic MUST
   * NOT set or clear this field — only the original strength placement
   * (including the in-season emergency-promotion path) may set it.
   *
   * Values:
   *   'lower'           — dedicated lower-body strength loading a SINGLE
   *                        sub-pattern (L-sq squat-emphasis OR L-hi hinge-
   *                        emphasis) — used by single-region session types
   *   'lower_combined'  — squat + hinge in one session at moderate dose
   *                        (pre-season L-co). Covers BOTH lower sub-patterns
   *                        in a single calendar slot — see H-PRE-7/8/9
   *                        invariant which accepts this when calendar
   *                        geometry (back-to-back team days + H3 spacing)
   *                        makes 2 dedicated lower sessions infeasible.
   *   'push'            — upper push emphasis
   *   'pull'            — upper pull emphasis
   *   'upper_combined'  — push + pull in one session (pre-season U-co)
   *   'full_body'       — covers squat/hinge + push + pull in one session
   */
  strengthPattern?: 'lower' | 'lower_combined' | 'push' | 'pull' | 'upper_combined' | 'full_body';

  /**
   * B1 (2026-07-08): stress classification of this allocation, recorded at
   * placement time by the scorer and projected again after generation.
   * Mirrors the rules kernel semantics in stressClassification. Consumed by
   * the consecutive high-stress guards (H1 / H-PRE-5).
   */
  stressLevel?: 'high' | 'medium' | 'low';
}

/**
 * Structural generation-side view accepted by the shared visible-session
 * classifier. `strengthPattern` is the typed source of truth when present;
 * focus text is only used for non-strength/support session shapes.
 */
export interface GenerationSessionClassificationInput {
  focus: string;
  tier: SessionTier;
  isTeamDay?: boolean;
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
  const canonicalStrengthName = canonicalStrengthClassificationName(input.strengthPattern);
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
  // Readiness
  readiness: ReadinessLevel;
  readinessFactors: string[];

  // Hard exposure budget
  hardExposureCap: number;
  existingHardExposures: number;
  remainingHardBudget: number;

  // Session allocation
  coreSessions: number;
  optionalSessions: number;
  recoverySessions: number;
  weeklyPlan: SessionAllocation[];

  // Constraints for AI
  constraints: AIConstraints;
}

export interface AIConstraints {
  phase: SeasonPhase;
  readiness: ReadinessLevel;
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
}

// ─── Step 1: Determine Readiness ───

export function calculateReadiness(inputs: CoachingInputs): {
  level: ReadinessLevel;
  factors: string[];
} {
  let score = 0;
  const factors: string[] = [];

  // Recent training consistency (0-3 points)
  switch (inputs.recentTrainingLoad) {
    case 'Very consistent':
      score += 3;
      factors.push('Very consistent recent training (+3)');
      break;
    case 'Pretty consistent':
      score += 2;
      factors.push('Pretty consistent recent training (+2)');
      break;
    case 'A bit':
      score += 1;
      factors.push('Some recent training (+1)');
      break;
    case 'Hardly at all':
      score += 0;
      factors.push('Minimal recent training (+0)');
      break;
    default:
      score += 1;
      factors.push('Unknown training history, defaulting conservative (+1)');
  }

  // Current fitness / conditioning level (0-3 points)
  switch (inputs.conditioningLevel) {
    case 'Elite':
      score += 3;
      factors.push('Elite conditioning (+3)');
      break;
    case 'Good':
      score += 2;
      factors.push('Good conditioning (+2)');
      break;
    case 'Average':
      score += 1;
      factors.push('Average conditioning (+1)');
      break;
    case 'Poor':
      score += 0;
      factors.push('Poor conditioning (+0)');
      break;
    default:
      score += 1;
      factors.push('Unknown conditioning, defaulting conservative (+1)');
  }

  // Injury adjustment — injuries MODIFY training, they don't eliminate it.
  // Mild niggles barely affect readiness. Only severe/constant injuries reduce capacity.
  // Cap total penalty so multiple mild injuries don't stack to crush the score.
  if (inputs.injuries.length > 0) {
    let injuryPenalty = 0;
    for (const injury of inputs.injuries) {
      if (injury.severity === 'Severe') {
        injuryPenalty += 1.5;
      } else if (injury.severity === 'Moderate') {
        injuryPenalty += 0.5;
      } else {
        // Mild = niggle — negligible impact on readiness
        injuryPenalty += 0;
      }
    }
    // Cap total injury penalty at 2 — injuries change WHAT you train, not WHETHER you train
    injuryPenalty = Math.min(injuryPenalty, 2);
    score -= injuryPenalty;
    factors.push(`${inputs.injuries.length} injur${inputs.injuries.length === 1 ? 'y' : 'ies'} (-${injuryPenalty}) - training modified, not removed`);
  } else {
    factors.push('No injuries (+0)');
  }

  // Sprint exposure context
  if (inputs.sprintExposure === 'No sprint training') {
    // Not a penalty per se, but means we need to be careful adding sprint load
    factors.push('No current sprint exposure - ramp carefully');
  } else if (inputs.sprintExposure === '2+ times per week') {
    score += 0.5;
    factors.push('Regular sprint exposure (+0.5)');
  }

  // Season context — in-season adds fatigue from games
  if (inputs.seasonPhase === 'In-season') {
    score -= 1;
    factors.push('In-season fatigue penalty (-1)');
  }

  // Classify
  let level: ReadinessLevel;
  if (score <= 2) {
    level = 'low';
  } else if (score <= 4) {
    level = 'medium';
  } else {
    level = 'high';
  }

  const activeReadiness = inputs.generationConstraints?.readiness;
  if (activeReadiness) {
    const before = level;
    if (activeReadiness.tier === 'full_pause' || activeReadiness.tier === 'major_reduction') {
      level = 'low';
    } else if (activeReadiness.tier === 'moderate_reduction' && level === 'high') {
      level = 'medium';
    }
    factors.push(
      `Active readiness constraint (${activeReadiness.label ?? activeReadiness.tier}, ${activeReadiness.severity}/10) ` +
      `applied before generation${before !== level ? `: ${before} → ${level}` : ''}`,
    );
  }

  return { level, factors };
}

// ─── Step 2: Count Existing Hard Exposures from Team Environment ───

export function countTeamHardExposures(inputs: CoachingInputs): {
  count: number;
  breakdown: string[];
} {
  let count = 0;
  const breakdown: string[] = [];

  // Game = 1 hard exposure
  if (inputs.hasGame && inputs.seasonPhase !== 'Off-season') {
    count += 1;
    breakdown.push('Game (1)');
  }

  // Team training — depends on intensity
  const teamDays = inputs.teamTrainingDaysPerWeek || 0;
  if (teamDays > 0) {
    const intensity = inputs.teamTrainingIntensity;
    if (intensity === 'Very intense' || intensity === 'Hard') {
      // All team sessions count as hard
      count += teamDays;
      breakdown.push(`Team training × ${teamDays} @ ${intensity} (${teamDays})`);
    } else if (intensity === 'Moderate') {
      // Only count half (rounded up) as hard
      const hardTeamDays = Math.ceil(teamDays / 2);
      count += hardTeamDays;
      breakdown.push(`Team training × ${teamDays} @ ${intensity} - ${hardTeamDays} counted as hard`);
    } else {
      // Light team training = 0 hard exposures
      breakdown.push(`Team training × ${teamDays} @ Light - not counted as hard`);
    }
  }

  // Sprint exposure from other sources
  if (inputs.sprintExposure === '2+ times per week') {
    // Don't double-count if sprints happen during team training
    if (inputs.seasonPhase === 'Off-season') {
      // Off-season sprints are separate sessions
      count += 1; // Count 1 (conservative — they said 2+ but we don't stack)
      breakdown.push('Independent sprint sessions (1)');
    }
    // In-season/pre-season sprints are likely part of team training, already counted
  }

  return { count, breakdown };
}

// ─── Step 3: Hard Exposure Caps by Season Phase ───

export function getHardExposureCap(
  phase: SeasonPhase,
  readiness: ReadinessLevel
): number {
  switch (phase) {
    case 'In-season':
      // Target 3–4 total hard exposures per week
      return readiness === 'low' ? 3 : 4;

    case 'Pre-season':
      // Target 4–5 hard exposures per week
      if (readiness === 'low') return 4;
      if (readiness === 'medium') return 4;
      return 5;

    case 'Off-season':
      // Target 3–5 depending on readiness
      if (readiness === 'low') return 3;
      if (readiness === 'medium') return 4;
      return 5;

    default:
      return 4;
  }
}

// ─── Step 4: Core Training Dose ───

export function getCoreSessionCount(
  phase: SeasonPhase,
  readiness: ReadinessLevel
): { min: number; max: number } {
  switch (phase) {
    case 'In-season':
      // In-season: 2-3 CORE gym sessions (lower + pull + push = 3 required exposures)
      // The G−2 push session is CORE but low-fatigue (moderate intensity, low volume)
      // so it doesn't consume hard budget the way a heavy session does.
      // 3 CORE is the target when the athlete has 3+ gym days and medium+ readiness.
      if (readiness === 'low') return { min: 1, max: 2 };
      if (readiness === 'medium') return { min: 2, max: 3 };
      return { min: 3, max: 3 };

    case 'Pre-season':
      if (readiness === 'low') return { min: 2, max: 2 };
      if (readiness === 'medium') return { min: 3, max: 3 };
      return { min: 3, max: 4 };

    case 'Off-season':
      if (readiness === 'low') return { min: 2, max: 3 };
      if (readiness === 'medium') return { min: 3, max: 4 };
      return { min: 4, max: 4 };

    default:
      return { min: 2, max: 3 };
  }
}

// ─── Step 5–8: Build the Full Coaching Plan ───

export function buildCoachingPlan(inputs: CoachingInputs): CoachingPlan {
  // Step 1: Readiness
  const { level: readiness, factors: readinessFactors } = calculateReadiness(inputs);
  const trainingAgePolicy = resolveTrainingAgePolicy(inputs.experienceLevel);
  const offseasonSubphase = resolveOffseasonSubphase({
    seasonPhase: inputs.seasonPhase,
    explicitSubphase: inputs.offseasonSubphase,
    miniCycleNumber: inputs.miniCycleNumber,
    weekInBlock: inputs.weekInBlock,
    weekNumber: inputs.weekNumber,
  });
  const offseasonPolicy = offseasonSubphase
    ? getOffseasonSubphasePolicy(offseasonSubphase, { readiness })
    : null;
  const preseasonSubphase = resolvePreseasonSubphase({
    seasonPhase: inputs.seasonPhase,
    explicitSubphase: inputs.preseasonSubphase,
    weekInBlock: inputs.weekInBlock,
    weekNumber: inputs.weekNumber,
  });
  const preseasonPolicy = preseasonSubphase
    ? getPreseasonSubphasePolicy(preseasonSubphase, {
        readiness,
        teamTrainingExposures: inputs.teamTrainingDays.length,
        hasPracticeMatch: inputs.hasGame,
      })
    : null;

  // Step 2: Existing hard exposures from team environment
  const { count: existingHard, breakdown: hardBreakdown } = countTeamHardExposures(inputs);

  // Step 3: Hard exposure cap
  const phaseHardCap = getHardExposureCap(inputs.seasonPhase, readiness);
  const trainingAgeHardCap = trainingAgePolicy.maxHardExposures?.[inputs.seasonPhase];
  const hardCap = trainingAgeHardCap === undefined
    ? phaseHardCap
    : Math.min(phaseHardCap, trainingAgeHardCap);
  const remainingBudget = Math.max(0, hardCap - existingHard);

  // Step 4: Core session count
  let coreRange = getCoreSessionCount(inputs.seasonPhase, readiness);
  if (offseasonPolicy?.subphase === 'early_offseason') {
    const earlyCoreTarget = Math.min(
      inputs.availableDays,
      readiness === 'low' || inputs.availableDays <= 3 ? 2 : 3,
    );
    coreRange = { min: earlyCoreTarget, max: earlyCoreTarget };
  }
  const activeReadinessTier = inputs.generationConstraints?.readiness?.tier;
  if (activeReadinessTier === 'full_pause') {
    coreRange = { min: 0, max: 0 };
  } else if (activeReadinessTier === 'major_reduction') {
    coreRange = { min: Math.min(coreRange.min, 1), max: Math.min(coreRange.max, 2) };
  } else if (activeReadinessTier === 'moderate_reduction') {
    coreRange = { min: Math.min(coreRange.min, 2), max: Math.min(coreRange.max, 3) };
  }

  // ── H-PRE-8: structure priority (4 strength exposures) ──
  // Pre-season with ≥2 team days, no game, and at least 5 training days
  // should target a 4-exposure week (2 lower + 2 upper) instead of the
  // default 3-exposure 1L+1U+FB shape. This forces an extra dedicated
  // strength slot over a conditioning/recovery slot when room exists.
  //   medium readiness: {3,3} → {3,4}  (allow but don't force — engine
  //     chooses 4 when availableDays accommodates it)
  //   high readiness:   {3,4} → {4,4}  (force the target shape)
  //   low readiness:    {2,2} stays — safety rail, FB fallback still applies
  // When trigger conditions are NOT met, coreRange is unchanged and the
  // existing H-PRE-6 fallback (1L+1U+FB at core=3) still governs.
  const shouldTarget4Strength =
    inputs.seasonPhase === 'Pre-season' &&
    (inputs.teamTrainingDays || []).length >= 2 &&
    !inputs.hasGame &&
    inputs.availableDays >= 5 &&
    (!activeReadinessTier || activeReadinessTier === 'slight_reduction');
  if (shouldTarget4Strength) {
    if (readiness === 'medium') coreRange = { min: 3, max: 4 };
    else if (readiness === 'high') coreRange = { min: 4, max: 4 };
  }

  // ── H-IS-3: in-season 3-exposure priority (Lower + Pull + Push) ──
  // Healthy in-season athlete with game + ≥2 team days + ≥5 training days should
  // DEFAULT to core=3 (Lower standalone + Pull on team day + Push at G−2).
  //
  // Why the default budget math under-serves this case:
  //   remainingBudget = hardCap − existingHard = 4 − (game + 2 Hard team days)
  //                   = 4 − 3 = 1
  //   heavyCoreCap = 1, moderateCoreBonus = +1 → actualCore = 2
  //   Result: Lower on Mon, Push at G−2, Pull DROPPED. Tuesday is left as
  //   bare team training — the structural pull exposure the athlete wants is
  //   silently omitted.
  //
  // The budget is correct in spirit (hard DAYS per week) but conflates two
  // things: (a) hard standalone gym days that add a new CNS-tax day, and
  // (b) gym work layered onto an already-hard team day. A moderate pull
  // stacked onto Tuesday's team session does NOT add a 5th hard day to the
  // week — it adds ~30 min of pulling to an already-hard day.
  //
  // Trigger: in-season + game + ≥2 team days + ≥5 selected days + not-low
  // readiness + no severe injuries. Forces coreRange={3,3} so actualCore=3
  // via the max(coreRange.min, coreSessions) floor. Downstream, the 3-core
  // branch places Lower (heavy), Push G−2 (moderate, no hard budget),
  // Pull G−4 (piggybacks on existing team-day hard exposure).
  //
  // Low readiness and severe-injury athletes still get the 2-core safety
  // rail — this is a priority rule, not a mandate. Sam's framing: preserve
  // 3-strength structure by default unless readiness/injury explicitly
  // forces it down.
  const hasSevereInjury = (inputs.injuries || []).some(i => i.severity === 'Severe');
  const shouldTarget3Strength =
    inputs.seasonPhase === 'In-season' &&
    inputs.hasGame &&
    (inputs.teamTrainingDays || []).length >= 2 &&
    inputs.availableDays >= 5 &&
    readiness !== 'low' &&
    !hasSevereInjury &&
    (!activeReadinessTier || activeReadinessTier === 'slight_reduction');
  if (shouldTarget3Strength) {
    coreRange = { min: 3, max: 3 };
  }

  // ── B3 (2026-07-08): pre-season GAME-week analogue of H-IS-3 ──
  // Same hard-DAY accounting philosophy: upper strength stacked onto an
  // already-hard team training day does not add a new hard day, so a
  // healthy pre-season athlete with 2 team days + a game should still get
  // 3 proper strength exposures (Lower standalone + Pull/Push on team
  // days). Without this floor, remainingBudget = cap − (game + 2 hard TT)
  // charges the team-day uppers as if they created new hard days and the
  // week collapses toward 1-2 strength exposures — the S11 failure.
  // Low readiness / severe injury keeps the smaller default: the higher
  // dose is only for athletes who can recover from it. max=3 caps volume.
  const shouldTarget3StrengthPreSeasonGame =
    inputs.seasonPhase === 'Pre-season' &&
    inputs.hasGame &&
    (inputs.teamTrainingDays || []).length >= 2 &&
    inputs.availableDays >= 5 &&
    readiness !== 'low' &&
    !hasSevereInjury &&
    (!activeReadinessTier || activeReadinessTier === 'slight_reduction');
  if (shouldTarget3StrengthPreSeasonGame) {
    coreRange = { min: 3, max: 3 };
  }

  if (preseasonPolicy) {
    coreRange = {
      min: Math.min(coreRange.min, preseasonPolicy.strength.coreSessionCap),
      max: Math.min(coreRange.max, preseasonPolicy.strength.coreSessionCap),
    };
  }

  if (trainingAgePolicy.maxCoreSessions !== null) {
    coreRange = {
      min: Math.min(coreRange.min, trainingAgePolicy.maxCoreSessions),
      max: Math.min(coreRange.max, trainingAgePolicy.maxCoreSessions),
    };
  }

  // In-season: not all CORE sessions are hard exposures. The G−2 push session is CORE
  // (non-negotiable for movement balance) but moderate intensity — it doesn't consume
  // hard budget the way a heavy lower body or pull session does.
  // So: cap heavy CORE by remaining budget, but allow 1 extra moderate CORE on top.
  const isInSeason = inputs.seasonPhase === 'In-season';
  const heavyCoreCap = Math.min(coreRange.max, remainingBudget, inputs.availableDays);
  // In-season with 3+ days and budget for at least 1 heavy session: allow +1 moderate CORE.
  // The G−2 upper session doesn't consume hard budget. It needs only 1 heavy slot (lower)
  // to justify it. Works for both:
  //   - 3-core weeks (push at G−2, moderate)
  //   - 2-core weeks (balanced upper at G−2, moderate)
  // Gate uses coreRange.max >= 2 so low-readiness athletes (max=2) still get the balanced upper.
  const moderateCoreBonus = (isInSeason && inputs.availableDays >= 3 && heavyCoreCap >= 1 && coreRange.max >= 2) ? 1 : 0;
  const coreSessions = Math.min(heavyCoreCap + moderateCoreBonus, coreRange.max, inputs.availableDays);
  const actualCore = Math.max(coreRange.min, coreSessions);

  // Step 5: Fill extra days with optional/recovery
  const extraDays = Math.max(0, inputs.availableDays - actualCore);
  // Optional sessions — even low readiness athletes get at least 1 optional session
  // if they have extra days. Training stimulus > pure recovery for adaptation.
  const normalOptionalSessions = offseasonPolicy?.subphase === 'early_offseason'
    ? Math.min(extraDays, 1)
    : Math.min(extraDays, readiness === 'low' ? 1 : readiness === 'medium' ? 2 : 2);
  const optionalSessions = trainingAgePolicy.maxOptionalSessions === null
    ? normalOptionalSessions
    : Math.min(normalOptionalSessions, trainingAgePolicy.maxOptionalSessions);
  const recoverySessions = Math.max(0, extraDays - optionalSessions);

  // Build weekly plan
  logger.debug('[ENGINE-TRACE] ═══ buildCoachingPlan inputs ═══');
  logger.debug('[ENGINE-TRACE] seasonPhase:', inputs.seasonPhase);
  logger.debug('[ENGINE-TRACE] gameDay:', inputs.gameDay ?? 'NONE');
  logger.debug('[ENGINE-TRACE] hasGame:', inputs.hasGame);
  logger.debug('[ENGINE-TRACE] selectedDays:', inputs.selectedDays);
  logger.debug('[ENGINE-TRACE] availableDays:', inputs.availableDays);
  logger.debug('[ENGINE-TRACE] teamTrainingDays:', inputs.teamTrainingDays);
  logger.debug('[ENGINE-TRACE] readiness:', readiness);
  logger.debug('[ENGINE-TRACE] coreRange:', JSON.stringify(coreRange), '→ actualCore:', actualCore);
  logger.debug('[ENGINE-TRACE] optional:', optionalSessions, 'recovery:', recoverySessions);
  const weeklyPlan = buildWeeklyPlan(inputs, actualCore, optionalSessions, recoverySessions, readiness);
  logger.debug('[ENGINE-TRACE] ═══ weeklyPlan output ═══');
  weeklyPlan.forEach(s => logger.debug(`[ENGINE-TRACE]   ${s.dayOfWeek}: [${s.tier}] ${s.focus}${s.isHardExposure ? ' (HARD)' : ''}`));

  // ── Post-generation validation: required exposures ──
  // In-season with game: validate movement coverage based on core count.
  //   1-core → must be full body (covers lower + push + pull in one session)
  //   2-core → lower + balanced upper (push + pull merged)
  //   3-core → lower + push + pull (separate sessions)
  if (isInSeason && inputs.hasGame && actualCore >= 1) {
    if (actualCore === 1) {
      // 1-core: must be full body
      const hasFullBody = weeklyPlan.some(s => s.tier === 'core' && /full body/i.test(s.focus));
      if (!hasFullBody) {
        logger.error('[ENGINE-VALIDATE] INVARIANT VIOLATION: 1-core week missing full body session');
        logger.error('[ENGINE-VALIDATE] Plan:', weeklyPlan.map(s => `${s.dayOfWeek}:[${s.tier}]${s.focus}`).join(' | '));
        // Emergency fix: relabel the sole core session
        const soleCore = weeklyPlan.find(s => s.tier === 'core');
        if (soleCore) {
          logger.debug(`[ENGINE-VALIDATE] Emergency relabel: ${soleCore.dayOfWeek} → basic full body`);
          soleCore.focus = 'Basic full body (1 squat/hinge + 1 push + 1 pull - cover all patterns, moderate volume)';
          soleCore.strengthPattern = 'full_body';
        }
      }
    } else {
      // 2+ cores: validate lower + upper coverage
      const hasLower = weeklyPlan.some(s => s.tier === 'core' && /lower/i.test(s.focus));
      const hasPush = weeklyPlan.some(s => s.tier === 'core' && /push/i.test(s.focus));
      const hasPull = weeklyPlan.some(s => s.tier === 'core' && /pull/i.test(s.focus));
      const hasFullBody = weeklyPlan.some(s => s.tier === 'core' && /full body/i.test(s.focus));
      const hasUpperCoverage = hasPush || hasPull || hasFullBody;

      if (!hasUpperCoverage) {
        logger.error('[ENGINE-VALIDATE] INVARIANT VIOLATION: In-season weekly plan missing upper body coverage (push or pull)');
        logger.error('[ENGINE-VALIDATE] Plan:', weeklyPlan.map(s => `${s.dayOfWeek}:[${s.tier}]${s.focus}`).join(' | '));
        // Emergency fix: promote best optional slot to a specific upper pattern.
        // Default to PUSH (moderate intensity, safer pre-game) — never emit
        // vague "Balanced upper" / "Upper body strength" labels, even in the
        // emergency path, because canonical naming would render them ambiguously.
        const promotable = weeklyPlan.find(s =>
          s.tier === 'optional' && s.dayOfWeek &&
          !/arm|pump|G.1/i.test(s.focus)
        );
        if (promotable) {
          logger.debug(`[ENGINE-VALIDATE] Emergency promotion: ${promotable.dayOfWeek} optional → upper push`);
          promotable.tier = 'core';
          promotable.focus = 'Upper body - push emphasis (moderate intensity, emergency promotion)';
          promotable.isHardExposure = false;
          promotable.strengthPattern = 'push';
        }
      }
      if (!hasLower) {
        logger.error('[ENGINE-VALIDATE] INVARIANT VIOLATION: In-season weekly plan missing LOWER exposure');
      }
    }
  }

  // ── Post-generation validation: game-week lower coverage (non-in-season) ──
  // H-GAME blocks core strength on game day / G-1 (and heavy lower on G-2)
  // in the scorer allocator. When that squeeze leaves a pre-season game week
  // with NO lower-pattern coverage at all, swap the earliest safe upper-only
  // gym core to a full-body session instead of silently dropping lower —
  // Bible rule: reduce/swap the week, never delete useful work that can
  // move safely, and never force it into the pre-game window.
  if (!isInSeason && inputs.hasGame && inputs.gameDay) {
    const gNum = dayNameToNumber(inputs.gameDay);
    if (gNum !== null && gNum >= 0) {
      const gymCores = weeklyPlan.filter(s => s.tier === 'core' && !s.isTeamDay);
      const hasLowerCoverage = gymCores.some(s =>
        s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined' ||
        s.strengthPattern === 'full_body' ||
        /lower|squat|hinge|full body/i.test(s.focus));
      if (!hasLowerCoverage) {
        const trainingOrderNum = (n: number) => (n === 0 ? 7 : n);
        const swap = gymCores
          .filter(s => s.dayOfWeek && /upper|push|pull/i.test(s.focus))
          .filter(s => {
            const d = dayNameToNumber(s.dayOfWeek!);
            return d !== null && d >= 0 && gOffset(d, gNum) <= -3; // safely clear of the game
          })
          .sort((a, b) =>
            trainingOrderNum(dayNameToNumber(a.dayOfWeek!) ?? 7) -
            trainingOrderNum(dayNameToNumber(b.dayOfWeek!) ?? 7))[0];
        if (swap) {
          logger.debug(`[ENGINE-VALIDATE] Game-week lower coverage: ${swap.dayOfWeek} upper → basic full body (H-GAME squeezed lower out of the week)`);
          swap.focus = 'Basic full body (1 squat/hinge + 1 push + 1 pull - cover all patterns, moderate volume)';
          swap.strengthPattern = 'full_body';
          // Pairing rule (2026-07-08): full body + EASY AEROBIC only. The
          // upper session being swapped may carry a harder finisher
          // (tempo/sprint) that was legal for upper — downgrade it rather
          // than pairing a full-body dose with hard conditioning.
          if (swap.hasCombinedConditioning || swap.conditioningFlavour) {
            swap.conditioningFlavour = 'aerobic';
            swap.conditioningCategory = 'aerobic_base';
            swap.focus += ' + easy aerobic finisher (bike steady or row/ski intervals, low intensity)';
          }
        } else {
          logger.error('[ENGINE-VALIDATE] INVARIANT VIOLATION: game week has no lower coverage and no safe slot to swap to full body');
        }
      }
    }
  }

  // Final generation projection: post-validation passes may have changed a
  // focus, component, speed block, or team-day label after initial placement.
  // Reclassify the returned session shape once so stressLevel cannot drift
  // from the shared kernel. This is metadata-only; scheduling flags and the
  // generated week structure remain owned by the existing engine passes.
  const finalClassificationContext: StressContext = {
    experienceLevel: inputs.experienceLevel,
    conditioningLevel: inputs.conditioningLevel,
    teamTrainingIntensity: inputs.teamTrainingIntensity,
  };
  for (const session of weeklyPlan) {
    const stress = classifyGenerationSession(session, finalClassificationContext).stressLevel;
    if (stress) session.stressLevel = stress;
  }

  const generatedWeekContext = resolveWeekContext({
    seasonPhase: inputs.seasonPhase,
    hasFixture: inputs.hasGame,
    gameDay: inputs.gameDay,
    weekKind: inputs.weekKind,
  });
  const plannedCoreSessions = generatedWeekContext.isByeWeek
    ? weeklyPlan.filter((session) => !!session.strengthPattern).length
    : actualCore;
  const plannedOptionalSessions = generatedWeekContext.isByeWeek
    ? weeklyPlan.filter((session) => session.tier === 'optional').length
    : optionalSessions;
  const plannedRecoverySessions = generatedWeekContext.isByeWeek
    ? weeklyPlan.filter((session) => session.tier === 'recovery').length
    : recoverySessions;

  // Build AI constraints
  const constraints = buildAIConstraints(
    inputs,
    readiness,
    hardCap,
    existingHard,
    plannedCoreSessions,
    plannedOptionalSessions,
    plannedRecoverySessions
  );

  // Phase 2 rules kernel — LOG-ONLY Bible weekly-structure validation of
  // the generated plan. Throw-proof; findings never change this plan.
  logAllocationWeekValidation(weeklyPlan, {
    gameDay: inputs.gameDay,
    seasonPhase: inputs.seasonPhase ?? null,
    profile: {
      teamTrainingIntensity: inputs.teamTrainingIntensity,
      conditioningLevel: inputs.conditioningLevel,
    },
    label: 'buildCoachingPlan',
  });

  return {
    readiness,
    readinessFactors,
    hardExposureCap: hardCap,
    existingHardExposures: existingHard,
    remainingHardBudget: remainingBudget,
    coreSessions: plannedCoreSessions,
    optionalSessions: plannedOptionalSessions,
    recoverySessions: plannedRecoverySessions,
    weeklyPlan,
    constraints,
  };
}

// ─── Day numbering helper ───

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayNameToNumber(name: string): number {
  const idx = DAY_NAMES.indexOf(name);
  return idx >= 0 ? idx : -1;
}

/**
 * Calculate G-offset: how many days before game day is this day?
 * Returns negative numbers (e.g. -5 means G−5).
 * If no game day, returns 0 for all days.
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

function createQualitySpeedMicroDoseBlock(placement: SpeedBlockPlacement): SpeedBlock {
  return {
    id: `preseason-quality-speed-micro-dose-${placement}`,
    title: 'Quality Speed Micro-dose',
    label: 'Speed Micro-dose',
    kind: 'true_speed',
    placement,
    durationMinutes: 15,
    prescription: '4-6 x 10-20m accelerations or build-ups, full walk-back rest',
    notes: [
      'Do this fresh before any fatigue work.',
      'Stop if speed or mechanics drop.',
    ],
    counting: {
      hardExposure: true,
      mainStrength: false,
      conditioningCredit: 'none',
      createsHardDay: true,
      sprintCodExposure: true,
    },
  };
}

function createSpeedTopUpBlock(
  placement: SpeedBlockPlacement,
  inputs: CoachingInputs,
  offseasonSubphase: OffseasonSubphase | null,
): SpeedBlock {
  return createLateOffseasonSpeedBlock(placement, {
    seasonPhase: inputs.seasonPhase,
    offseasonSubphase,
    weekNumber: inputs.weekNumber,
    weekInBlock: inputs.weekInBlock,
  }) ?? createQualitySpeedMicroDoseBlock(placement);
}

// ─── Weekly Plan Builder (Game-Day Relative) ───
//
// DESIGN PRINCIPLES (in-season):
//   1. Exactly 3 CORE gym sessions: Lower, Upper Pull, Upper Push
//   2. CORE means true key sessions ONLY — everything else is OPTIONAL or RECOVERY
//   3. Prefer Tuesday = Pull, Thursday = Push (when paired with team training)
//   4. Wednesday defaults to OPTIONAL/RECOVERY — never CORE unless no alternative
//   5. No back-to-back upper pattern loading (push → pull → push is bad)
//   6. Prioritise spacing and freshness over squeezing in extra work

function buildWeeklyPlan(
  inputs: CoachingInputs,
  core: number,
  optional: number,
  recovery: number,
  /** Profile-derived readiness — read by finisherEligibility (4A). */
  readiness: ReadinessLevel = 'medium',
): SessionAllocation[] {
  const plan: SessionAllocation[] = [];
  const classificationContext: StressContext = {
    experienceLevel: inputs.experienceLevel,
    conditioningLevel: inputs.conditioningLevel,
    teamTrainingIntensity: inputs.teamTrainingIntensity,
  };
  const trainingAgePolicy = resolveTrainingAgePolicy(inputs.experienceLevel);
  const days = [...inputs.selectedDays];
  const gameDayNum = inputs.gameDay ? dayNameToNumber(inputs.gameDay) : null;
  const teamDayNums = (inputs.teamTrainingDays || []).map(dayNameToNumber).filter(d => d >= 0);

  // Convert selected days to numbers with G-offsets
  const daySlots = days.map(dayName => {
    const num = dayNameToNumber(dayName);
    const offset = gOffset(num, gameDayNum);
    const isTeamDay = teamDayNums.includes(num);
    return { dayName, num, offset, isTeamDay };
  });

  // Sort by day of week number for consistent processing.
  // Training-week order: Mon(1) → Sat(6) → Sun(0).
  // Sunday is always the lowest-priority day for core allocation — it should
  // be optional/recovery, not promoted to core ahead of Saturday.
  const trainingOrder = (num: number) => num === 0 ? 7 : num; // Sun(0) → 7 (last)
  daySlots.sort((a, b) => {
    // For game-relative, sort by offset (most negative first = earliest in week)
    if (gameDayNum !== null) return a.offset - b.offset;
    return trainingOrder(a.num) - trainingOrder(b.num);
  });

  const isInSeason = inputs.seasonPhase === 'In-season';
  const weekContext = resolveWeekContext({
    seasonPhase: inputs.seasonPhase,
    hasFixture: gameDayNum !== null,
    gameDay: inputs.gameDay,
    weekKind: inputs.weekKind,
  });
  const hasGameThisWeek = weekContext.kind === 'in_season_game_week';
  const generationConstraints = inputs.generationConstraints;
  const activeReadiness = generationConstraints?.readiness;
  const offseasonSubphase = resolveOffseasonSubphase({
    seasonPhase: inputs.seasonPhase,
    explicitSubphase: inputs.offseasonSubphase,
    miniCycleNumber: inputs.miniCycleNumber,
    weekInBlock: inputs.weekInBlock,
    weekNumber: inputs.weekNumber,
  });
  const offseasonPolicy = offseasonSubphase
    ? getOffseasonSubphasePolicy(offseasonSubphase, { readiness })
    : null;
  const preseasonSubphase = resolvePreseasonSubphase({
    seasonPhase: inputs.seasonPhase,
    explicitSubphase: inputs.preseasonSubphase,
    weekInBlock: inputs.weekInBlock,
    weekNumber: inputs.weekNumber,
  });
  const preseasonPolicy = preseasonSubphase
    ? getPreseasonSubphasePolicy(preseasonSubphase, {
        readiness,
        teamTrainingExposures: teamDayNums.length,
        hasPracticeMatch: inputs.hasGame,
      })
    : null;

  const readinessTierRank = (tier: GenerationReadinessTier | undefined): number => {
    switch (tier) {
      case 'full_pause': return 4;
      case 'major_reduction': return 3;
      case 'moderate_reduction': return 2;
      case 'slight_reduction': return 1;
      default: return 0;
    }
  };
  const readinessAtLeast = (tier: GenerationReadinessTier): boolean =>
    readinessTierRank(activeReadiness?.tier) >= readinessTierRank(tier);
  const activeInjuries = generationConstraints?.injuries ?? [];
  const injuryMatches = (
    injury: GenerationInjuryConstraint,
    pattern: RegExp,
  ): boolean => pattern.test(`${injury.bodyPart} ${injury.bucket ?? ''}`.toLowerCase());
  const hasInjury = (pattern: RegExp, minSeverity = 1): boolean =>
    activeInjuries.some((injury) => injury.severity >= minSeverity && injuryMatches(injury, pattern));
  const hasPausedInjury = (pattern: RegExp): boolean =>
    activeInjuries.some((injury) => injury.pauseAffectedTraining && injuryMatches(injury, pattern));
  const lowerLimbIssue = (minSeverity = 1): boolean =>
    activeInjuries.some((injury) =>
      injury.severity >= minSeverity &&
      (injury.region === 'lower_body' ||
        injury.injuryKeys.some((key) =>
          key === 'hamstring' || key === 'knee' || key === 'calf' ||
          key === 'ankle' || key === 'adductor' || key === 'pubalgia',
        )),
    );
  const activeTriggerText = activeInjuries
    .flatMap((injury) => injury.triggers)
    .join(' ')
    .toLowerCase();
  const hasRiskRestrictedInjury = activeInjuries.some((injury) =>
    injury.removeRiskyWork || injury.pauseAffectedTraining,
  );
  const hasSevereProfileInjury = (inputs.injuries ?? []).some((injury) =>
    injury.severity === 'Severe',
  );
  const lighterByeWeek = weekContext.isByeWeek && (
    inputs.weekKind === 'deload' ||
    readiness === 'low' ||
    readinessAtLeast('moderate_reduction') ||
    !!activeReadiness?.preferRecovery ||
    hasRiskRestrictedInjury ||
    hasSevereProfileInjury
  );

  if (activeReadiness?.fullPause) {
    return daySlots.map((slot) => ({
      tier: 'recovery',
      focus: 'Recovery only - full pause until symptoms settle',
      dayOfWeek: slot.dayName,
      isHardExposure: false,
      stressLevel: 'low',
    }));
  }

  if (hasGameThisWeek) {
    // ─── In-season WITH game: G-relative placement with spacing intelligence ───
    const assigned = new Map<string, SessionAllocation>();

    // Classify available slots
    const highLoad = daySlots.filter(d => d.offset <= -4 && d.offset >= -5);       // G−5 to G−4
    const midWeek = daySlots.filter(d => d.offset === -3);                         // G−3
    const lateWeek = daySlots.filter(d => d.offset === -2);                        // G−2
    const preGame = daySlots.filter(d => d.offset === -1);                         // G−1
    const postGame = daySlots.filter(d => d.offset === 1 || d.offset <= -6);       // G+1

    // ── STEP 1: Place PRIMARY CORE ──
    // 1-core week → Basic Full Body (1 lower + 1 push + 1 pull, minimal accessory)
    // 2+ core week → Lower body strength (squat + hinge), upper handled in Steps 2+3
    const lowerSlot = highLoad.find(d => !d.isTeamDay)
      || highLoad[0]; // fallback: any high load day
    if (lowerSlot && core >= 1) {
      if (core === 1) {
        // Only 1 CORE session — must cover all movement categories in one session
        assigned.set(lowerSlot.dayName, {
          tier: 'core',
        focus: 'Basic full body (1 squat/hinge + 1 push + 1 pull - cover all patterns, moderate volume)',
          dayOfWeek: lowerSlot.dayName,
          isHardExposure: true,
          strengthPattern: 'full_body',
        });
      } else {
        // 2+ CORE — dedicate this slot to lower, upper comes in Steps 2+3
        assigned.set(lowerSlot.dayName, {
          tier: 'core', focus: 'Lower body strength (squat + hinge)',
          dayOfWeek: lowerSlot.dayName, isHardExposure: true,
          strengthPattern: 'lower',
        });
      }
    }

    // ── STEP 2 + 3: Place UPPER session(s) ──
    //
    // 3-core week (ideal):
    //   Step 2 → Upper Push at G−2 (moderate intensity, not a hard exposure)
    //   Step 3 → Upper Pull at G−4 (hard exposure, pair with team training)
    //
    // 2-core week (constrained):
    //   Step 2 → Balanced Upper (push + pull) at G−2 (moderate intensity)
    //   "Never simply omit a movement category" — when only 1 upper slot exists,
    //   merge push + pull into a balanced upper session so neither is dropped.
    //
    // The late-week G−2 slot is the anchor for the upper session in both cases.

    // Find the best upper slot (G−2 preferred)
    const upperSlotCandidates = [
      ...lateWeek.filter(d => !assigned.has(d.dayName)),
      ...highLoad.filter(d => !assigned.has(d.dayName)),
    ];
    const upperSlot = upperSlotCandidates[0];

    let pullSlot: typeof daySlots[0] | null = null;

    if (core >= 3) {
      // ── 3-core: separate push + pull ──
      //
      // Push placement strategy (team-day preferred): layering moderate
      // push onto an ALREADY-hard team session keeps standalone day count
      // low — critical for non-Sat games where G-2 doesn't land on a
      // team day. For a Sat game with Tue/Thu team, lateWeek team day
      // (Thu = G-2) already matches; for a Sun game (Tue=G-5 team,
      // Thu=G-3 team), midWeek team day (Thu) absorbs push so Fri stays
      // optional/recovery. Viable team offsets: G-2, G-3, G-4, G-5.
      // G-1 (captain's run) and G+1 (post-game recovery) are correctly
      // EXCLUDED — those slots aren't in lateWeek/midWeek/highLoad.
      //
      // Moderate vs. hard labelling: push is "moderate" whenever it's
      // on a team day (piggybacks existing hard exposure) OR at G-2
      // non-team (load-protective pre-game window). Only standalone
      // G-4/-5 push gets the hard label.
      const pushSlot3Core =
        lateWeek.find(d => d.isTeamDay && !assigned.has(d.dayName))     // G-2 team — ideal
        || midWeek.find(d => d.isTeamDay && !assigned.has(d.dayName))    // G-3 team
        || highLoad.find(d => d.isTeamDay && !assigned.has(d.dayName))   // G-4/-5 team
        || lateWeek.find(d => !assigned.has(d.dayName))                  // G-2 non-team
        || highLoad.find(d => !assigned.has(d.dayName));                 // G-4/-5 non-team

      if (pushSlot3Core) {
        const isTeamDaySlot = pushSlot3Core.isTeamDay;
        const isLateWeekSlot = pushSlot3Core.offset === -2;
        const isModerate = isTeamDaySlot || isLateWeekSlot;
        assigned.set(pushSlot3Core.dayName, {
          tier: 'core',
          focus: isModerate
            ? 'Upper body - push emphasis (moderate intensity, low fatigue - maintain strength, keep CNS sharp)'
            : 'Upper body - push emphasis',
          dayOfWeek: pushSlot3Core.dayName,
          isHardExposure: !isModerate,
          strengthPattern: 'push',
        });
      }

      // Place PULL at G−4 (hard) — prefer a DIFFERENT team day from push.
      const pushDayNum = pushSlot3Core ? pushSlot3Core.num : -99;
      const pullCandidates = [
        // 1st: team training day in high load, not adjacent to push
        ...highLoad.filter(d => d.isTeamDay && !assigned.has(d.dayName) && Math.abs(d.num - pushDayNum) > 1),
        // 2nd: any team training day in high load
        ...highLoad.filter(d => d.isTeamDay && !assigned.has(d.dayName)),
        // 3rd: team training day at G-3 (midWeek) — last-resort team overlay
        ...midWeek.filter(d => d.isTeamDay && !assigned.has(d.dayName) && Math.abs(d.num - pushDayNum) > 1),
        // 4th: any unassigned high load day
        ...highLoad.filter(d => !assigned.has(d.dayName)),
      ];
      pullSlot = pullCandidates[0] || null;
      if (pullSlot) {
        assigned.set(pullSlot.dayName, {
          tier: 'core', focus: 'Upper body - pull emphasis',
          dayOfWeek: pullSlot.dayName, isHardExposure: true,
          strengthPattern: 'pull',
        });
      }

      // Validate spacing — no back-to-back upper
      if (pullSlot && pushSlot3Core && Math.abs(pullSlot.num - pushSlot3Core.num) === 1) {
        const betterPull = highLoad.find(d => !assigned.has(d.dayName) && d.dayName !== pullSlot!.dayName && Math.abs(d.num - pushDayNum) > 1)
          || daySlots.find(d => !assigned.has(d.dayName) && d.offset <= -3 && d.offset >= -5 && Math.abs(d.num - pushDayNum) > 1);
        if (betterPull) {
          assigned.delete(pullSlot.dayName);
          pullSlot = betterPull;
          assigned.set(betterPull.dayName, {
            tier: 'core', focus: 'Upper body - pull emphasis',
            dayOfWeek: betterPull.dayName, isHardExposure: true,
            strengthPattern: 'pull',
          });
        }
      }
    } else if (core >= 2 && upperSlot) {
      // ── 2-core: single upper slot — commit to push OR pull by position ──
      // Earlier design merged both into "Balanced upper (push + pull)" but that
      // flows through canonical naming as the vague "Upper Body Strength".
      // Sam's rule: plan the split at generation time, don't rename post-resolve.
      //
      // Positional convention (mirrors 3-core branch):
      //   G−2 (late week, moderate) → PUSH emphasis (low CNS load pre-game)
      //   G−4/−5 (early week, hard) → PULL emphasis (horizontal pull is higher RPE)
      //
      // Trade-off: 2-core weeks only cover one upper pattern. Rotation across
      // weeks happens naturally as the slot position drifts block-to-block;
      // within-week "balance" is sacrificed for label clarity.
      const isLateWeekSlot = upperSlot.offset === -2;
      assigned.set(upperSlot.dayName, {
        tier: 'core',
        focus: isLateWeekSlot
          ? 'Upper body - push emphasis (moderate intensity, low fatigue - maintain strength, keep CNS sharp)'
          : 'Upper body - pull emphasis',
        dayOfWeek: upperSlot.dayName,
        isHardExposure: !isLateWeekSlot,
        strengthPattern: isLateWeekSlot ? 'push' : 'pull',
      });
    }

    // ── STEP 5: Fill remaining slots as OPTIONAL / RECOVERY ──
    // G−3 always defaults to OPTIONAL or RECOVERY (never CORE)
    // G−1 always OPTIONAL arms/pump
    // G+1 always RECOVERY
    const remainingDays = daySlots.filter(d => !assigned.has(d.dayName));
    let optCount = 0;
    let recCount = 0;

    for (const slot of remainingDays) {
      if (slot.offset === 1 || slot.offset <= -6) {
        // Post-game → always recovery
        plan.push({ tier: 'recovery', focus: 'Post-game recovery - flush, mobility, stretching', dayOfWeek: slot.dayName, isHardExposure: false });
        recCount++;
      } else if (slot.offset === -1) {
        // G−1 → optional arms/pump only
        plan.push({ tier: 'optional', focus: 'Optional arms/pump - biceps, triceps, lateral raises only', dayOfWeek: slot.dayName, isHardExposure: false });
        optCount++;
      } else if (slot.offset === -3) {
        // G−3 → optional light work or recovery (NEVER CORE)
        plan.push({
          tier: optCount < optional ? 'optional' : 'recovery',
          focus: optCount < optional
            ? 'Light accessories - trunk, calves, groin, shoulder prehab, mobility'
            : 'Mobility, foam rolling, light movement',
          dayOfWeek: slot.dayName,
          isHardExposure: false,
        });
        if (optCount < optional) optCount++; else recCount++;
      } else {
        // Other unassigned days
        if (optCount < optional) {
          plan.push({ tier: 'optional', focus: 'Light accessories - trunk, calves, groin, shoulder prehab, mobility', dayOfWeek: slot.dayName, isHardExposure: false });
          optCount++;
        } else if (recCount < recovery) {
          plan.push({ tier: 'recovery', focus: 'Mobility, foam rolling, light movement', dayOfWeek: slot.dayName, isHardExposure: false });
          recCount++;
        }
      }
    }

    // Add all assigned CORE sessions to plan
    Array.from(assigned.values()).forEach(session => plan.push(session));

  } else if (weekContext.isByeWeek) {
    // ─── In-season NO GAME (bye week / game removed) ───
    //
    // Team training remains the week anchor. Healthy byes carry two main
    // strength exposures; only 0-1 team-training weeks may add one real,
    // typed conditioning component. Cooked, injury-restricted and deload
    // byes use the freed game slot for lower-fatigue work instead.
    type ByeSlot = (typeof daySlots)[number];
    const allocations = new Map<string, SessionAllocation>();
    const teamSlots = daySlots.filter((slot) => slot.isTeamDay);
    const nonTeamSlots = daySlots.filter((slot) => !slot.isTeamDay && slot.dayName !== 'Sunday');
    const orderedNonTeam = [...nonTeamSlots].sort((a, b) => trainingOrder(a.num) - trainingOrder(b.num));
    const restrictedLower = activeInjuries.some((injury) =>
      (injury.region === 'lower_body' || injury.region === 'back_midline') &&
      (injury.removeRiskyWork || injury.pauseAffectedTraining),
    );
    const restrictedUpper = activeInjuries.some((injury) =>
      injury.region === 'upper_body' &&
      (injury.removeRiskyWork || injury.pauseAffectedTraining),
    );

    const setTeamAnchor = (slot: ByeSlot): void => {
      allocations.set(slot.dayName, {
        tier: 'core',
        focus: 'Team training - field session (sprint, skills and contact)',
        dayOfWeek: slot.dayName,
        isHardExposure: false,
        isTeamDay: true,
        stressLevel: 'high',
      });
    };
    const setLowerStrength = (slot: ByeSlot): void => {
      allocations.set(slot.dayName, {
        tier: 'core',
        focus: slot.dayName === 'Saturday'
          ? 'Lower body strength (bye-week gym top-up)'
          : 'Lower body strength (bye-week maintenance)',
        dayOfWeek: slot.dayName,
        isHardExposure: true,
        strengthPattern: 'lower',
        stressLevel: 'high',
      });
    };
    const setUpperStrength = (slot: ByeSlot, withConditioning: boolean): void => {
      allocations.set(slot.dayName, {
        tier: 'core',
        focus: withConditioning
          ? 'Upper body - combined push + pull + controlled VO2 conditioning component (20-24min off-feet)'
          : 'Upper body - combined push + pull (balanced, moderate intensity)',
        dayOfWeek: slot.dayName,
        isHardExposure: withConditioning,
        strengthPattern: 'upper_combined',
        stressLevel: withConditioning ? 'high' : 'medium',
        ...(slot.isTeamDay ? { isTeamDay: true } : {}),
        ...(withConditioning ? {
          hasCombinedConditioning: true,
          attachedConditioningKind: 'component' as const,
          conditioningFlavour: 'high-intensity' as const,
          conditioningCategory: 'vo2' as const,
          conditioningVariant: 'reduced' as const,
          conditioningFeel: 'sharp' as const,
          conditioningOffFeet: true,
          ergModality: 'bike' as const,
        } : {}),
      });
    };
    const setFullBodyStrength = (slot: ByeSlot): void => {
      allocations.set(slot.dayName, {
        tier: 'core',
        focus: 'Basic full body strength (lighter bye week - controlled volume)',
        dayOfWeek: slot.dayName,
        isHardExposure: false,
        strengthPattern: 'full_body',
        stressLevel: 'medium',
      });
    };
    const firstFree = (slots: ByeSlot[]): ByeSlot | undefined =>
      slots.find((slot) => !allocations.has(slot.dayName));
    const mostSpacedFree = (slots: ByeSlot[], anchors: ByeSlot[]): ByeSlot | undefined =>
      slots
        .filter((slot) => !allocations.has(slot.dayName))
        .sort((a, b) => {
          const spacing = (slot: ByeSlot): number => anchors.length === 0
            ? 7
            : Math.min(...anchors.map((anchor) => Math.abs(slot.num - anchor.num)));
          return spacing(b) - spacing(a) || trainingOrder(a.num) - trainingOrder(b.num);
        })[0];

    teamSlots.forEach(setTeamAnchor);

    if (lighterByeWeek) {
      // Keep one useful strength exposure where possible, but do not force the
      // affected region or create a new hard day around existing team load.
      if (teamSlots.length > 0 && !restrictedUpper) {
        setUpperStrength(teamSlots[0], false);
      } else if (teamSlots.length === 0 && !restrictedLower && !restrictedUpper) {
        const slot = firstFree(orderedNonTeam);
        if (slot) setFullBodyStrength(slot);
      } else if (!restrictedLower) {
        const slot = firstFree(orderedNonTeam);
        if (slot) setLowerStrength(slot);
      } else if (!restrictedUpper) {
        const slot = firstFree(orderedNonTeam);
        if (slot) setUpperStrength(slot, false);
      }
    } else {
      // Healthy bye: two main strength exposures. With two team anchors the
      // upper session rides one team day; with 0-1 anchors a separate upper
      // day can carry the sole conditioning top-up as a proper component.
      const allowConditioningTopUp =
        teamSlots.length <= 1 &&
        !trainingAgePolicy.avoidCombinedStrengthConditioning &&
        !activeReadiness?.avoidHardConditioning &&
        !hasRiskRestrictedInjury;
      let lowerSlot: ByeSlot | undefined;
      if (!restrictedLower) {
        lowerSlot = teamSlots.length > 0
          ? nonTeamSlots.find((slot) => slot.dayName === 'Saturday') ?? firstFree(orderedNonTeam)
          : firstFree(orderedNonTeam);
        if (lowerSlot) setLowerStrength(lowerSlot);
      }

      if (!restrictedUpper) {
        if (teamSlots.length >= 2) {
          setUpperStrength(teamSlots[0], false);
        } else if (allowConditioningTopUp) {
          const free = orderedNonTeam.filter((slot) => !allocations.has(slot.dayName));
          const upperSlot = teamSlots.length === 0
            ? free.find((slot) => slot.dayName === 'Saturday') ?? mostSpacedFree(free, lowerSlot ? [lowerSlot] : [])
            : mostSpacedFree(free, [...teamSlots, ...(lowerSlot ? [lowerSlot] : [])]);
          if (upperSlot) setUpperStrength(upperSlot, true);
        } else {
          const upperSlot = teamSlots[0] ?? mostSpacedFree(orderedNonTeam, lowerSlot ? [lowerSlot] : []);
          if (upperSlot) setUpperStrength(upperSlot, false);
        }
      }
    }

    let supportSlotsRemaining = lighterByeWeek && (
      inputs.weekKind === 'deload' || activeReadiness?.preferRecovery
    ) ? 0 : 1;
    for (const slot of daySlots) {
      const existing = allocations.get(slot.dayName);
      if (existing) {
        plan.push(existing);
        continue;
      }
      if (slot.dayName === 'Sunday') {
        plan.push({
          tier: 'recovery',
          focus: 'Full rest or light walk',
          dayOfWeek: slot.dayName,
          isHardExposure: false,
          stressLevel: 'low',
        });
      } else if (supportSlotsRemaining > 0) {
        plan.push({
          tier: 'optional',
          focus: lighterByeWeek
            ? 'Low-fatigue trunk, mobility and prehab (lighter bye week)'
            : 'Low-fatigue support - trunk, calves, groin, shoulder prehab',
          dayOfWeek: slot.dayName,
          isHardExposure: false,
          stressLevel: 'low',
        });
        supportSlotsRemaining--;
      } else {
        plan.push({
          tier: 'recovery',
          focus: lighterByeWeek
            ? 'Recovery and mobility (lighter bye week)'
            : 'Mobility, foam rolling, light movement',
          dayOfWeek: slot.dayName,
          isHardExposure: false,
          stressLevel: 'low',
        });
      }
    }

  } else {
    // ─── Off-season / Pre-season: slot-by-slot scorer ───
    //
    // ARCHITECTURE:
    //   Walk sorted available days Mon→Sun. At each slot, score every candidate
    //   session type against the partial plan built so far. Pick the highest-
    //   scoring valid candidate. Every decision is context-dependent.
    //
    // HARD CONSTRAINTS (reject if violated):
    //   H1: No 3+ consecutive calendar days of core strength
    //   H2: Same lower subtype separated by ≥2 calendar days
    //   H3: Any lower exposure separated by ≥1 calendar day
    //   H5: Minimum 3 conditioning exposures/week (post-validation)
    //   H6: Core strength budget ≤ `core` from buildCoachingPlan
    //
    // CONDITIONING PHILOSOPHY:
    //   - Minimum 3, baseline 4, high-end 5 (not default)
    //   - Actively planned by scorer, not left to resolver fill
    //   - Mix of standalone COND + combined S+C days
    //   - Varied flavours: aerobic, tempo, high-intensity
    //   - S+C counts 0.75 toward conditioning target

    // ── Candidate types ──
    type CondFlavour = 'aerobic' | 'tempo' | 'high-intensity';
    // Energy-system category — the weekly distribution tracker.
    // Applied in Off-season and Pre-season weeks to prevent redundant
    // conditioning sessions.
    //
    // 'tempo' (Phase 4B, Sam 2026-07-09) is TRUE medium conditioning:
    // controlled repeat efforts at 6-7/10, worked but composed. Medium
    // stress — NOT a hard exposure, NOT easy aerobic. The old mislabelled
    // "tempo" (vo2 wearing a tempo label) is gone; vo2/glycolytic stay hard.
    type CondCategory = OffseasonConditioningCategory;
    // L-co / U-co are combined-region sessions used in pre-season when
    // the week only has room for a single lower or single upper slot.
    // They carry BOTH movement patterns (squat+hinge in one L-co, push+pull
    // in one U-co) so movement-pattern integrity is preserved even at
    // low strength frequency. They are NOT full-body (FB) — the opposite
    // region is not trained that day.
    type CandidateType =
      | 'L-sq' | 'L-hi' | 'U-pu' | 'U-pl' | 'FB'
      | 'L-co' | 'U-co'
      | 'COND' | 'S+C'
      | 'ACC' | 'REC';

    const STRENGTH_CANDIDATES: CandidateType[] = ['L-sq', 'L-hi', 'U-pu', 'U-pl', 'FB', 'L-co', 'U-co'];
    // Free-form candidate list excludes combined-region types: L-co / U-co
    // only enter the plan via an approved structure queue, never via the
    // open scorer. This prevents core ≥ 5 weeks from replacing dedicated
    // sessions with combined ones for no reason.
    const FREEFORM_STRENGTH: CandidateType[] = ['L-sq', 'L-hi', 'U-pu', 'U-pl', 'FB'];
    const ALL_CANDIDATES: CandidateType[] = [...FREEFORM_STRENGTH, 'COND', 'S+C', 'ACC', 'REC'];
    const COND_FLAVOURS: CondFlavour[] = ['aerobic', 'tempo', 'high-intensity'];
    const COND_FLAVOUR_CAPS: Record<CondFlavour, number> = { aerobic: 2, tempo: 2, 'high-intensity': 1 };

    // ── Category-based weekly distribution (off-season / pre-season) ──
    // Priority order (head = highest priority — covered first when slots
    // are limited). Off-season uses the full priority; pre-season keeps
    // sprint late in the pool and lets `sprintExposureGate` decide whether
    // field anchors already cover the week's sprint/COD target.
    // 4B design decision: tempo is NOT a coverage category. Weekly
    // coverage stays category-native — tempo enters a week ONLY through
    // the eligibility downgrade ladder (hard → tempo → aerobic). Making
    // tempo a must-cover 5th category
    // inflated conditioning scores everywhere (there is never room to
    // cover 5 systems in a real week), letting COND steal queue-strength
    // slots and breaking the signed-off weekly rhythm (Sunday-off
    // regression in strengthSequencingTests). Coverage pressure is
    // structural; tempo is opportunistic.
    // Off-season category availability comes from the shared subphase
    // policy. Sprint remains outside the conditioning pool because the
    // existing late-off-season speed gate owns true-speed placement.
    const CATEGORY_PRIORITY_OFF: CondCategory[] = offseasonPolicy
      ? [
          offseasonPolicy.conditioning.defaultCategory,
          ...offseasonPolicy.conditioning.allowedCategories.filter((category) =>
            category !== 'sprint' &&
            category !== offseasonPolicy.conditioning.defaultCategory),
        ]
      : ['aerobic_base', 'tempo'];
    const CATEGORY_PRIORITY_PRE: CondCategory[] = preseasonPolicy
      ? [...preseasonPolicy.conditioning.categoryPriority]
      : ['vo2', 'glycolytic', 'aerobic_base', 'sprint'];

    // Does this phase use category-based distribution?
    const useCategoryPlanner =
      inputs.seasonPhase === 'Off-season' || inputs.seasonPhase === 'Pre-season';
    let categoryPriority = inputs.seasonPhase === 'Pre-season'
      ? CATEGORY_PRIORITY_PRE
      : CATEGORY_PRIORITY_OFF;

    // Map category → flavour (for downstream code). 4A label honesty
    // (Sam, 2026-07-08): vo2 is HARD work and must not wear the "tempo"
    // flavour — flavour/category/label/stress must agree. As of 4B the
    // 'tempo' flavour belongs to the TRUE tempo category only.
    function categoryToFlavour(cat: CondCategory): CondFlavour {
      switch (cat) {
        case 'aerobic_base': return 'aerobic';
        case 'tempo':        return 'tempo';
        case 'vo2':          return 'high-intensity';
        case 'sprint':       return 'high-intensity';
        case 'glycolytic':   return 'high-intensity';
      }
    }

    function isStrength(c: CandidateType): boolean { return STRENGTH_CANDIDATES.includes(c) || c === 'S+C'; }
    function isLower(c: CandidateType): boolean { return c === 'L-sq' || c === 'L-hi' || c === 'L-co' || c === 'FB'; }
    function isUpper(c: CandidateType): boolean { return c === 'U-pu' || c === 'U-pl' || c === 'U-co' || c === 'FB'; }
    function isConditioning(c: CandidateType): boolean { return c === 'COND' || c === 'S+C'; }
    // "Heavy lower" = any dedicated lower or combined lower session. Blocked
    // on team days under H-PRE-2. FB is NOT heavy lower (moderate mixed load).
    function isHeavyLower(c: CandidateType): boolean { return c === 'L-sq' || c === 'L-hi' || c === 'L-co'; }
    const shoulderIssue = (minSeverity = 1): boolean =>
      hasInjury(/\b(shoulder|pec|rotator)\b/, minSeverity);
    const hamstringIssue = (minSeverity = 1): boolean =>
      hasInjury(/\b(hamstring|hammy)\b/, minSeverity);
    const kneeIssue = (minSeverity = 1): boolean =>
      hasInjury(/\b(knee|patella|acl|mcl|meniscus)\b/, minSeverity);
    const lowerBackIssue = (minSeverity = 1): boolean =>
      hasInjury(/\b(lower back|lowerback|lumbar)\b/, minSeverity);
    const triggersMention = (pattern: RegExp): boolean => pattern.test(activeTriggerText);

    function blocksStrengthCandidateForGeneration(c: CandidateType | undefined): boolean {
      if (!c || activeInjuries.length === 0) return false;
      const pushLoaded = c === 'U-pu' || c === 'U-co' || c === 'FB';
      const upperLoaded = c === 'U-pu' || c === 'U-pl' || c === 'U-co' || c === 'FB';
      const hingeLoaded = c === 'L-hi' || c === 'L-co' || c === 'FB';
      const kneeDominant = c === 'L-sq' || c === 'L-co' || c === 'FB';
      const lowerLoaded = c === 'L-sq' || c === 'L-hi' || c === 'L-co' || c === 'FB';

      if (hasPausedInjury(/\b(shoulder|pec|rotator)\b/) && upperLoaded) return true;
      if (shoulderIssue(4) && pushLoaded) return true;
      if (shoulderIssue(1) && triggersMention(/\b(press|bench|overhead|dip|push)\b/) && pushLoaded) return true;

      if (hasPausedInjury(/\b(hamstring|hammy)\b/) && lowerLoaded) return true;
      if (hamstringIssue(4) && hingeLoaded) return true;
      if (hamstringIssue(1) && triggersMention(/\b(hinge|rdl|deadlift|nordic|sprint|running)\b/) && hingeLoaded) return true;

      if (hasPausedInjury(/\b(knee|patella|acl|mcl|meniscus)\b/) && lowerLoaded) return true;
      if (kneeIssue(4) && kneeDominant) return true;
      if (kneeIssue(1) && triggersMention(/\b(deep|squat|jump|plyo|cod|change of direction)\b/) && kneeDominant) return true;

      if (lowerBackIssue(4) && (hingeLoaded || c === 'L-sq')) return true;
      return false;
    }

    function blocksConditioningCategoryForGeneration(category: CondCategory): boolean {
      if (
        offseasonPolicy &&
        isHardConditioningCategory(category) &&
        plan.filter((session) =>
          session.conditioningCategory !== undefined &&
          isHardConditioningCategory(session.conditioningCategory as CondCategory)
        ).length >= offseasonPolicy.conditioning.hardSessionCap
      ) {
        return true;
      }
      if (
        preseasonPolicy &&
        isHardConditioningCategory(category) &&
        plan.filter((session) =>
          session.conditioningCategory !== undefined &&
          isHardConditioningCategory(session.conditioningCategory as CondCategory)
        ).length >= preseasonPolicy.conditioning.hardSessionCap
      ) {
        return true;
      }
      if (activeReadiness?.avoidHardConditioning &&
          (category === 'sprint' || category === 'vo2' || category === 'glycolytic')) {
        return true;
      }
      if (category === 'sprint' && (
        activeReadiness?.avoidSprint ||
        lowerLimbIssue(4) ||
        (lowerLimbIssue(1) && triggersMention(/\b(sprint|speed|max velocity|running|cod|change of direction)\b/))
      )) {
        return true;
      }
      if ((category === 'vo2' || category === 'glycolytic') &&
          (hamstringIssue(4) || kneeIssue(4) || lowerLimbIssue(6))) {
        return true;
      }
      return false;
    }

    function policyRequiresOffFeetAerobic(): boolean {
      if (!offseasonPolicy) return false;
      if (!offseasonPolicy.running.allowedBySubphase) return true;
      if (offseasonPolicy.running.enabledByDefault) {
        return readiness === 'low' || lowerLimbIssue(4);
      }
      const conditioningReady =
        inputs.conditioningLevel === 'Good' || inputs.conditioningLevel === 'Elite';
      const profileLowerLimbIssue = inputs.injuries.some((injury) =>
        /hamstring|calf|achilles|knee|ankle|groin|quad|hip|shin|foot|glute/i
          .test(`${injury.bodyArea} ${injury.description}`));
      return readiness !== 'high' || !conditioningReady || lowerLimbIssue(1) || profileLowerLimbIssue;
    }

    function conditioningPolicyProps(category: CondCategory): Partial<SessionAllocation> {
      const aerobic = category === 'aerobic_base';
      const conditioningOffFeet = aerobic && policyRequiresOffFeetAerobic();
      const reduced =
        activeReadiness?.avoidHardConditioning ||
        lowerLimbIssue(4) ||
        (preseasonPolicy?.conditioning.hardDose === 'reduced' &&
          isHardConditioningCategory(category));
      if (!conditioningOffFeet && !reduced) return {};
      return {
        ...(reduced ? { conditioningVariant: 'reduced' as const } : {}),
        ...(conditioningOffFeet ? { conditioningOffFeet: true } : {}),
        ...(lowerLimbIssue(4) ? { ergModality: 'bike' as const } : {}),
      };
    }

    categoryPriority = categoryPriority.filter((category) =>
      !blocksConditioningCategoryForGeneration(category),
    );
    if (categoryPriority.length === 0) categoryPriority = ['aerobic_base'];

    // ── Role/goal bias (small, phase-scaled, override-safe) ──
    // Re-order the conditioning category priority by the athlete's role/goal
    // preference. This runs AFTER the injury/readiness/deload/cap filter above,
    // so bias can only re-order categories the gates already permitted — it
    // never re-introduces a blocked category. Default athletes (no goal-driven
    // direction) get an empty preference => identity no-op. Only the off- and
    // pre-season category planner consumes categoryPriority, so in-season stays
    // freshness-first regardless of bias.
    const programmingBias = computeProgrammingBias({
      role: inputs.role,
      goals: inputs.goals,
      phase: inputs.seasonPhase,
      isBeginner: trainingAgePolicy.level === 'new',
    });
    if (useCategoryPlanner) {
      categoryPriority = applyConditioningCategoryBias(
        categoryPriority,
        programmingBias.conditioningCategoryPreference,
      );
    }

    // ── Pattern-based targets ──
    //
    // The week must balance 4 movement patterns: squat, hinge, push, pull.
    // Instead of region targets (lower vs upper), each pattern gets an equal
    // share of the core budget. This prevents 2:0 imbalances like double-lower
    // with no pull, and ensures every week looks like a real S&C program.
    //
    // FB (full body) partially covers all patterns — valuable when there aren't
    // enough slots to place each pattern individually.
    const patternShare = core / 4;  // ideal per-pattern count

    // ── Pre-season flag + team-day awareness ──
    //
    // Pre-season is NOT "off-season + team training". It's a third ruleset:
    //   • Team days are PRIMARY field-load anchors. They are not gym-neutral
    //     days that happen to have team training "on top" — they ARE hard
    //     exposures, and the gym plan must be built around them.
    //   • No standalone or combined conditioning on a team day (field load
    //     already counts).
    //   • No heavy lower on a team day (dedicated L-sq / L-hi are blocked;
    //     FB / upper / low-fatigue support only).
    //   • Sprint is NEVER scheduled the day before or day after a team day
    //     (neural freshness + soreness protection).
    //   • Total standalone conditioning is REDUCED compared with off-season
    //     because team training already covers field stress.
    const isPreSeason = inputs.seasonPhase === 'Pre-season';
    const teamDayNumSet = new Set(teamDayNums);
    const hasTeamDays = teamDayNumSet.size > 0;
    // B4 (2026-07-08): a real game this week changes the pre-season shape —
    // upper rides the team days, lower takes the early standalone slot, and
    // H-GAME keeps G-0/G-1/G-2 protected. (In-season never reaches this
    // allocator; off-season has hasGame=false.)
    const isGameWeek = inputs.hasGame && gameDayNum !== null;
    const isTeamDayPos = (pos: number): boolean => {
      // pos uses trainingOrder (Sun=7, Mon..Sat=1..6). Map back to dayNum.
      const dayNum = pos === 7 ? 0 : pos;
      return teamDayNumSet.has(dayNum);
    };
    const isAdjacentToTeamDay = (pos: number): boolean => {
      // pos is trainingOrder (Mon=1..Sat=6, Sun=7). Check pos-1 and pos+1
      // in calendar-day terms (not in trainingOrder), because adjacency is
      // about the real week, not our sort order.
      const dayNum = pos === 7 ? 0 : pos;
      // Adjacent calendar days are dayNum-1 and dayNum+1 mod 7.
      const prevDay = (dayNum + 6) % 7;
      const nextDay = (dayNum + 1) % 7;
      return teamDayNumSet.has(prevDay) || teamDayNumSet.has(nextDay);
    };

    // Conditioning target: at least as many conditioning exposures as strength,
    // minimum 3, baseline 4, high-end 5
    let condTarget = Math.max(core, 4);
    if (inputs.availableDays <= 3) condTarget = 3;
    else if (inputs.conditioningLevel === 'Poor') condTarget = Math.max(3, core);
    if (readinessAtLeast('moderate_reduction') || activeReadiness?.avoidHardConditioning || core <= 2) {
      condTarget = Math.max(3, condTarget - 1);
    }
    condTarget = Math.max(3, Math.min(5, condTarget));
    if (offseasonPolicy?.subphase === 'early_offseason') {
      condTarget = readiness === 'low' ? 1 : 2;
    }

    // Pre-season conditioning volume reduction.
    // Team training provides significant field load (sprints, drills, long
    // aerobic exposure). Each team day in pre-season substitutes for roughly
    // one standalone conditioning exposure — so drop the target and the cap
    // accordingly. Floor at 2 to keep at least some gym-side conditioning
    // variety (usually a VO2/glyco day and an aerobic base flush).
    if (isPreSeason && hasTeamDays) {
      const reduction = Math.min(2, teamDayNumSet.size);
      condTarget = Math.max(2, condTarget - reduction);
      // Pre-season also caps the top end at 4 (off-season's 5 is too much
      // cumulative load when team training is present).
      condTarget = Math.min(4, condTarget);
    }
    if (preseasonPolicy) {
      condTarget = Math.min(condTarget, preseasonPolicy.conditioning.targetCap);
    }

    // ── Conditioning feasibility ──
    const standaloneSlotsAvailable = Math.max(0, daySlots.length - core);
    // The pre-season policy owns the app-side floor because team training
    // and practice matches already count as conditioning. Legacy phases keep
    // their established floor below.
    const MIN_COND_FLOOR = preseasonPolicy
      ? preseasonPolicy.conditioning.minimumAppExposures
      : offseasonPolicy?.subphase === 'early_offseason'
        ? (readiness === 'low' || inputs.availableDays <= 2 ? 0 : 1)
        : (isPreSeason && hasTeamDays) ? 1 : 2;
    const condViaStandaloneMax = Math.min(standaloneSlotsAvailable, condTarget);
    const condShortfall = Math.max(0, MIN_COND_FLOOR - condViaStandaloneMax);
    const minCombinedDays = condShortfall > 0 ? Math.ceil(condShortfall / 0.75) : 0;
    const avoidCombinedDays =
      trainingAgePolicy.avoidCombinedStrengthConditioning ||
      preseasonPolicy?.sessions.combinedStrengthConditioning === 'avoid' ||
      (offseasonPolicy?.sessions.lowAvailabilityCombinedDays === 'avoid' &&
        (inputs.availableDays <= 4 || readiness === 'low'));

    // Finishers are useful add-ons, not hidden second sessions. Keep the
    // conditioning target intact, but do not let repeated steady aerobic
    // add-ons become filler.
    const MAX_STEADY_AEROBIC_FINISHERS = 2;

    // ── Approved strength structures ──
    //
    // PHILOSOPHY: For off-season weeks with core ≤ 4, the engine selects from
    // a curated set of coaching-valid week structures FIRST, then uses scoring
    // to decide placement, S+C combinations, and conditioning. This prevents
    // weird hybrids like push+pull+push or full+push+pull that technically
    // score well but make no practical coaching sense.
    //
    // The structure defines WHAT strength sessions exist in the week.
    // The scorer decides WHERE they go and WHICH become S+C.

    type StructureTemplate = CandidateType[];

    function getApprovedStructures(): StructureTemplate[] {
      // ── Pre-season with team days: tighter structure ──
      // Sam's pre-season ruleset: the gym week must be 2 lower + 2 upper
      // (squat/hinge × push/pull). FB is only allowed when core ≤ 2 (where it
      // replaces upper+lower rather than stacking on top of them). Mixing FB
      // with dedicated lower AND upper in the same week creates redundant
      // volume — explicitly forbidden here.
      if (isPreSeason && hasTeamDays) {
        // Movement-pattern integrity is non-negotiable here: the week must
        // always hit squat + hinge + push + pull, even when total strength
        // frequency is small. The tool for that is the combined-region
        // session (L-co / U-co) — when there's only room for ONE lower
        // slot the athlete trains both squat AND hinge in that session,
        // and likewise for a single upper slot (push + pull together).
        switch (core) {
          case 2:
            // 2 slots → one combined upper + one combined lower. This
            // lands all four patterns (squat, hinge, push, pull) in the
            // two sessions we have. Splitting into e.g. 1 push + 1 squat
            // would drop hinge and pull entirely — the exact failure
            // mode Sam called out.
            return [
              ['U-co', 'L-co'],
            ];
          case 3:
            // ── GAME WEEK (B4, 2026-07-08): 1 lower standalone + upper
            // pull/push on the two team days. FB is deliberately absent:
            // upper lives on team days (no new hard day), the standalone
            // early slot carries the week's lower work, and G-1 stays
            // light. Sam's target: Mon Lower / Tue TT+Pull / Thu TT+Push.
            // L-co covers squat+hinge so pattern coverage is preserved.
            if (isGameWeek) {
              return [
                ['L-co', 'U-pu', 'U-pl'],
                ['L-co', 'U-pl', 'U-pu'],
                ['L-sq', 'U-pu', 'U-pl'],
                ['L-hi', 'U-pu', 'U-pl'],
              ];
            }
            // 3 slots → STRENGTH DISTRIBUTION BALANCE (H-PRE-6).
            //   Team training already delivers heavy lower load (running,
            //   cuts, contact). Stacking 2 dedicated lower sessions on top
            //   compounds soft-tissue stress and starves upper development.
            //   Likewise 2 upper + 1 lower under-doses lower strength.
            //
            //   Rule: exactly 1 lower + 1 upper + 1 full body. FB carries
            //   the "missing" pattern so weekly squat + hinge + push + pull
            //   coverage is preserved even when a region only has one slot.
            //     [L-co, U-co, FB] — optimal, every pattern twice
            //     [L-sq, U-co, FB] — hinge covered via FB
            //     [L-hi, U-co, FB] — squat covered via FB
            //     [L-co, U-pu, FB] — pull  covered via FB
            //     [L-co, U-pl, FB] — push  covered via FB
            //   Forbidden shapes (imbalanced): 2L+1U, 2U+1L.
            return [
              ['L-co', 'U-co', 'FB'],
              ['L-sq', 'U-co', 'FB'],
              ['L-hi', 'U-co', 'FB'],
              ['L-co', 'U-pu', 'FB'],
              ['L-co', 'U-pl', 'FB'],
            ];
          case 4:
            // 4 slots → full 2L + 2U split. Every pattern gets its own
            // dedicated session. This is Sam's explicit target shape.
            return [
              ['U-pu', 'L-sq', 'U-pl', 'L-hi'],
              ['U-pu', 'L-hi', 'U-pl', 'L-sq'],
              ['U-pl', 'L-sq', 'U-pu', 'L-hi'],
              ['U-pl', 'L-hi', 'U-pu', 'L-sq'],
            ];
          default:
            return []; // core ≥ 5 uses free-form scoring
        }
      }

      // ── Off-season / pre-season without team days: original list ──
      switch (core) {
        case 2:
          return [
            ['U-pu', 'L-sq'],   ['U-pl', 'L-hi'],
            ['U-pu', 'L-hi'],   ['U-pl', 'L-sq'],
            ['FB', 'FB'],
          ];
        case 3:
          return [
            ['U-pu', 'U-pl', 'L-sq'],   ['U-pu', 'U-pl', 'L-hi'],
            ['U-pu', 'L-sq', 'FB'],      ['U-pl', 'L-hi', 'FB'],
            ['U-pu', 'L-hi', 'FB'],      ['U-pl', 'L-sq', 'FB'],
            ['FB', 'FB', 'FB'],
          ];
        case 4:
          return [
            ['U-pu', 'L-sq', 'U-pl', 'L-hi'],
            ['U-pu', 'L-hi', 'U-pl', 'L-sq'],
            ['U-pl', 'L-sq', 'U-pu', 'L-hi'],
          ];
        default:
          return []; // core ≥ 5 uses free-form scoring
      }
    }

    function scoreStructure(struct: StructureTemplate): number {
      let score = 0;
      for (const s of struct) {
        if (blocksStrengthCandidateForGeneration(s)) score -= 250;
      }

      // Pattern coverage
      let sq = 0, hi = 0, pu = 0, pl = 0;
      for (const s of struct) {
        if (s === 'L-sq') sq++;
        if (s === 'L-hi') hi++;
        if (s === 'U-pu') pu++;
        if (s === 'U-pl') pl++;
        if (s === 'FB') { sq += 0.5; hi += 0.5; pu += 0.5; pl += 0.5; }
        // Combined-region sessions cover both sub-patterns of their
        // region at moderate dose (0.5 each, like FB within its region).
        if (s === 'L-co') { sq += 0.5; hi += 0.5; }
        if (s === 'U-co') { pu += 0.5; pl += 0.5; }
      }

      // Reward covering all 4 patterns
      const covered = [sq, hi, pu, pl].filter(x => x > 0).length;
      score += covered * 25;

      // Reward having both lower patterns (squat + hinge)
      if (sq > 0 && hi > 0) score += 15;
      // Reward having both upper patterns (push + pull)
      if (pu > 0 && pl > 0) score += 15;

      // Lower body MUST be present — massive penalty if missing
      const hasLower = struct.some(s => s === 'L-sq' || s === 'L-hi');
      const hasFB = struct.some(s => s === 'FB');
      if (!hasLower && !hasFB) score -= 100;

      // Variety bonus — more distinct session types
      const uniqueTypes = new Set(struct).size;
      score += uniqueTypes * 5;

      // Team day compatibility: upper/FB sessions fit well on team days
      const teamDayCount = daySlots.filter(s => s.isTeamDay).length;
      if (teamDayCount > 0) {
        const upperOrFBCount = struct.filter(s =>
          s === 'U-pu' || s === 'U-pl' || s === 'FB'
        ).length;
        score += Math.min(upperOrFBCount, teamDayCount) * 5;
      }

      // For core=3: dedicated splits > all-FB when enough spacing exists
      if (core === 3 && struct.every(s => s === 'FB')) {
        score -= 10;
      }

      // ── H-PRE-6: strength distribution balance (pre-season + team days) ──
      //
      // Belt-and-suspenders alongside getApprovedStructures(): even if a
      // legacy or hand-added imbalanced structure slips into the pool,
      // scoring steers the engine toward the balanced 1L + 1U + FB shape.
      // Heavy lower is penalised more than heavy upper because team
      // training already loads lower-body tissue (running, cuts, contact).
      if (isPreSeason && hasTeamDays && core === 3 && isGameWeek) {
        // ── B4 game-week shape (2026-07-08): 1 lower + 2 upper, no FB ──
        // Upper pull/push ride the team days (medium stress, no new hard
        // day); the single lower anchors the early standalone slot. The
        // no-game upperCount>1 penalty must NOT apply here.
        const lowerCount = struct.filter(s =>
          s === 'L-sq' || s === 'L-hi' || s === 'L-co'
        ).length;
        const upperCount = struct.filter(s =>
          s === 'U-pu' || s === 'U-pl' || s === 'U-co'
        ).length;
        const fullCount = struct.filter(s => s === 'FB').length;
        if (lowerCount === 1 && upperCount === 2 && fullCount === 0) score += 45;
        if (lowerCount > 1) score -= 40; // still never 2 lowers around a game
        score -= fullCount * 15;         // FB shouldn't burn a slot here
      } else if (isPreSeason && hasTeamDays && core === 3) {
        const lowerCount = struct.filter(s =>
          s === 'L-sq' || s === 'L-hi' || s === 'L-co'
        ).length;
        const upperCount = struct.filter(s =>
          s === 'U-pu' || s === 'U-pl' || s === 'U-co'
        ).length;
        const fullCount = struct.filter(s => s === 'FB').length;

        if (lowerCount > 1) score -= 40; // strong: 2L+1U is the failure mode
        if (upperCount > 1) score -= 25; // moderate: 2U+1L under-doses lower
        if (lowerCount === 1 && upperCount === 1 && fullCount === 1) {
          score += 30;
        }

        // ── Muddy-overlap penalty ──
        // [L-co, U-co, FB] covers every pattern twice (L-co has sq+hi, U-co
        // has pu+pl, FB has all four). That "feels" doubled up on the card.
        // Bias toward shapes with a DEDICATED single-pattern session as
        // the main lower or upper anchor, using FB purely for coverage:
        //   [L-sq, U-co, FB]  — dedicated squat, FB backs hinge
        //   [L-hi, U-co, FB]  — dedicated hinge, FB backs squat
        //   [L-co, U-pu, FB]  — dedicated push,  FB backs pull
        //   [L-co, U-pl, FB]  — dedicated pull,  FB backs push
        if (struct.includes('L-co') && struct.includes('U-co') && struct.includes('FB')) {
          score -= 10;
        }
      }

      // ── H-PRE-8: 4-exposure structure priority (pre-season + team days + core=4) ──
      //
      // When the week runs at core=4 in pre-season with team days, the
      // canonical shape is 2 lower + 2 upper (one squat, one hinge, one
      // push, one pull). FB is explicitly NOT a primary slot at core=4
      // (H-PRE-9) — it under-doses pattern specificity when room exists
      // for a dedicated session. Any imbalanced 3+1 shape is a failure
      // mode (under-doses the short side).
      if (isPreSeason && hasTeamDays && core === 4) {
        const lowerCount = struct.filter(s =>
          s === 'L-sq' || s === 'L-hi' || s === 'L-co'
        ).length;
        const upperCount = struct.filter(s =>
          s === 'U-pu' || s === 'U-pl' || s === 'U-co'
        ).length;
        const fbCount = struct.filter(s => s === 'FB').length;

        // Canonical target: exactly 2L + 2U + 0 FB
        if (lowerCount === 2 && upperCount === 2 && fbCount === 0) {
          score += 40;
        }
        // Imbalanced 3+1 shape under-doses the short side
        if (lowerCount === 1 || upperCount === 1) score -= 30;
        // H-PRE-9: FB is not a primary slot at core=4 in this regime
        score -= fbCount * 20;
      }

      return score;
    }

    // Select the best approved structure (or empty for free-form)
    const approvedStructures = getApprovedStructures();
    let strengthQueue: CandidateType[] = [];
    const useStructureMode = approvedStructures.length > 0;

    if (useStructureMode) {
      let bestStruct = approvedStructures[0];
      let bestStructScore = -Infinity;
      for (const struct of approvedStructures) {
        const s = scoreStructure(struct);
        if (s > bestStructScore) { bestStructScore = s; bestStruct = struct; }
      }
      strengthQueue = [...bestStruct];
    }

    // ── Rest day distribution ──
    //
    // Off-season needs rest days distributed across the week, not stacked
    // at the end. When the week has enough slack (more days than required
    // sessions), pre-designate some positions as rest/conditioning-only
    // slots where strength cannot be placed.
    //
    // This ensures the finished week has breaks between hard training days,
    // not 4+ consecutive hard days followed by rest at the end.
    const weekSlack = daySlots.length - core;
    const hasSundaySlot = daySlots.some(s => s.dayName === 'Sunday');
    const usePreSeasonRhythm =
      isPreSeason && hasTeamDays && daySlots.length >= 5;
    const useSixDaySpreadRhythm =
      !hasGameThisWeek &&
      daySlots.length >= 6 &&
      inputs.availableDays >= 6 &&
      daySlots.some(s => s.dayName === 'Saturday');
    const useDistributedRhythm = usePreSeasonRhythm || useSixDaySpreadRhythm;
    const maxDistributedRestSlots = useDistributedRhythm
      // Pre-season wants 3 on / 1 off / 2 on / 1 off. If Sunday is not an
      // available slot, keep one in-week recovery break and leave the extra
      // slack for conditioning/support rather than creating train/rest/train
      // too early in the week.
      ? (hasSundaySlot ? 2 : 1)
      : 2;
    const restCount = daySlots.length >= 5
      ? Math.min(weekSlack, maxDistributedRestSlots)
      : 0;
    const restSlotIndices: Set<number> = new Set();

    // Default rest indices, before team-day reconciliation.
    const defaultRestIndices: number[] = [];
    if (useDistributedRhythm && restCount > 0) {
      const midweekBreakIdx = Math.min(3, daySlots.length - 1);
      defaultRestIndices.push(midweekBreakIdx);
      if (restCount >= 2) {
        const sundayIdx = daySlots.findIndex(s => s.dayName === 'Sunday');
        const lateBreakIdx = sundayIdx >= 0 ? sundayIdx : daySlots.length - 1;
        if (lateBreakIdx !== midweekBreakIdx) {
          defaultRestIndices.push(lateBreakIdx);
        }
      }
      for (let i = daySlots.length - 1; defaultRestIndices.length < restCount && i >= 0; i--) {
        if (!defaultRestIndices.includes(i)) defaultRestIndices.push(i);
      }
    } else if (restCount === 2) {
      if (daySlots.length <= 5) {
        // 5 slots: rest at positions 1 and 3 → train/rest/train/rest/train
        defaultRestIndices.push(1, 3);
      } else {
        // 6+ slots: rest at 2 and 4 → train/train/rest/train/rest/train
        defaultRestIndices.push(2, 4);
      }
    } else if (restCount === 1) {
      // Single rest day in the middle
      defaultRestIndices.push(Math.floor(daySlots.length / 2));
    }

    // ── Team-day reconciliation for rest slots ────────────────────────────
    //
    // Team training days are FIXED ANCHORS — the universal team-day pass at
    // the end of the common tail will promote them to `tier='core'` no matter
    // what the scoring loop produces. If a default rest index lands on a
    // team-day slot, the scorer treats that slot as rest (no strength) AND
    // H-PRE-1 blocks any conditioning on it; the slot is effectively double-
    // booked and the strength queue + conditioning floor get squeezed off
    // the rest of the week. Sam's Wed/Fri reproduction (rest indices {2, 4}
    // both colliding with team days in a 6-day week) is the canonical case:
    // it produced 2L+1U strength and ZERO conditioning before this fix.
    //
    // Strategy: walk each default rest index; if it collides with a team
    // day, push it OUTWARD to the nearest non-team, non-already-rest index.
    // Prefer destinations that sit ADJACENT to a team day so the recovery
    // still "buffers" the field load (active-recovery-after-team pattern),
    // matching how a coach would naturally reorganise the week.
    //
    // Scope: multi-rest weeks always reconcile. Pre-season team weeks also
    // reconcile single-rest collisions because the midweek recovery break is
    // a load-management anchor, not a disposable filler for the team-label
    // pass to absorb.
    const isTeamDayIdx = (i: number): boolean =>
      i >= 0 && i < daySlots.length && !!daySlots[i].isTeamDay;
    const isAdjacentToTeamIdx = (i: number): boolean =>
      isTeamDayIdx(i - 1) || isTeamDayIdx(i + 1);
    const reconcileTeamDayCollisions = restCount >= 2 || usePreSeasonRhythm;

    for (const defaultIdx of defaultRestIndices) {
      if (!isTeamDayIdx(defaultIdx) && !restSlotIndices.has(defaultIdx)) {
        restSlotIndices.add(defaultIdx);
        continue;
      }
      // Non-reconciled single-rest weeks keep the original collision
      // behaviour. The team-day promotion pass will absorb the slot.
      if (!reconcileTeamDayCollisions) {
        if (!restSlotIndices.has(defaultIdx)) {
          restSlotIndices.add(defaultIdx);
        }
        continue;
      }
      // Multi-rest weeks: search outward for a non-team, not-already-rest
      // index so we don't double-book the team day.
      let chosen = -1;
      for (let r = 1; r < daySlots.length && chosen === -1; r++) {
        const candidates: number[] = [];
        const left = defaultIdx - r;
        const right = defaultIdx + r;
        if (left >= 0 && !isTeamDayIdx(left) && !restSlotIndices.has(left)) {
          candidates.push(left);
        }
        if (
          right < daySlots.length
          && !isTeamDayIdx(right)
          && !restSlotIndices.has(right)
        ) {
          candidates.push(right);
        }
        if (candidates.length === 0) continue;
        // Prefer adjacent-to-team (active recovery placement); fall back
        // to the first candidate at this radius.
        chosen = candidates.find(isAdjacentToTeamIdx) ?? candidates[0];
      }
      if (chosen !== -1) {
        restSlotIndices.add(chosen);
      }
      // If no valid non-team slot exists (e.g. every other index is also a
      // team day or already rest), we DROP this rest slot rather than
      // double-booking onto a team day — the scorer's adjacency / streak
      // guards will still keep the week sane, and the conditioning floor
      // post-validation can now actually find a slot.
    }

    // ── Scorer state ──
    interface ScorerState {
      consecutiveCoreCalendarDays: number;
      prevSlotDayNum: number;        // trainingOrder of previous slot
      prevSlotWasCore: boolean;
      lastLowerDay: number;          // trainingOrder of most recent lower
      lastLowerSubtype: CandidateType | null;
      lastUpperDay: number;
      lastUpperSubtype: CandidateType | null;
      lastCondDay: number;
      lastCondCategory: CondCategory | null;  // last conditioning category placed
      // Pattern counts — tracks each movement pattern individually
      sqCount: number;               // L-sq sessions (+ 0.5 per FB)
      hiCount: number;               // L-hi sessions (+ 0.5 per FB)
      puCount: number;               // U-pu sessions (+ 0.5 per FB)
      plCount: number;               // U-pl sessions (+ 0.5 per FB)
      // Region counts — used for spacing, not exposure targeting
      lowerCount: number;
      upperCount: number;
      condCount: number;             // fractional (0.75 for S+C)
      condFlavours: Record<CondFlavour, number>;
      condCategories: Record<CondCategory, number>;
      fbCount: number;
      coreStrengthCount: number;
      lastCoreSubtype: CandidateType | null;
      optCount: number;
      recCount: number;
    }

    const st: ScorerState = {
      consecutiveCoreCalendarDays: 0,
      prevSlotDayNum: -99,
      prevSlotWasCore: false,
      lastLowerDay: -99,
      lastLowerSubtype: null,
      lastUpperDay: -99,
      lastUpperSubtype: null,
      lastCondDay: -99,
      lastCondCategory: null,
      sqCount: 0,
      hiCount: 0,
      puCount: 0,
      plCount: 0,
      lowerCount: 0,
      upperCount: 0,
      condCount: 0,
      condFlavours: { aerobic: 0, tempo: 0, 'high-intensity': 0 },
      condCategories: { aerobic_base: 0, tempo: 0, sprint: 0, vo2: 0, glycolytic: 0 },
      fbCount: 0,
      coreStrengthCount: 0,
      lastCoreSubtype: null,
      optCount: 0,
      recCount: 0,
    };

    function sprintExposureGate(plannedOnFeetSprintExposures = st.condCategories.sprint) {
      return evaluateSprintExposureGate({
        phase: inputs.seasonPhase,
        teamTrainingDays: Array.from(teamDayNumSet),
        gameOrPracticeMatchDays: isGameWeek && gameDayNum !== null ? [gameDayNum] : [],
        plannedOnFeetSprintExposures,
        readinessAllowsSprint: readiness === 'high' && !activeReadiness?.avoidSprint,
        injuryAllowsSprint: !blocksConditioningCategoryForGeneration('sprint'),
        offseasonSubphase,
        preseasonSubphase,
        weekKind: inputs.weekKind,
      });
    }

    // ── H-GAME: game-week proximity protection (ANY phase) ──
    // In-season game weeks use the dedicated G-relative branch above and
    // never reach this allocator. This protects PRE-SEASON (and any future
    // phase) game weeks, which previously fell into the "no game" path and
    // could drop a full lower session on G-1 (Bible validator finding, S11).
    // ALWAYS enforced — including queue-must-complete mode — like the
    // team-day guards: a required movement must be moved or dropped, never
    // forced into the pre-game window.
    //   Game day / G-1: block all core strength (incl. FB and S+C) and all
    //     conditioning. The slot falls through to ACC/REC (light
    //     accessories / recovery) — the Bible's accepted G-1 content.
    //   G-2: block dedicated heavy lower (L-sq/L-hi/L-co, incl. as the
    //     strength half of S+C) and any non-easy conditioning. Upper
    //     strength, FB (moderate mixed dose) and easy aerobic stay legal.
    function violatesGameProximity(c: CandidateType, dayNum: number): boolean {
      if (!inputs.hasGame || gameDayNum === null) return false;
      const offset = gOffset(dayNum, gameDayNum);
      if (offset === 0 || offset === -1) {
        return isStrength(c) || isConditioning(c);
      }
      if (offset === -2) {
        if (isHeavyLower(c)) return true;
        if (c === 'COND' || c === 'S+C') {
          const wouldPickCat = pickCondCategory(trainingOrder(dayNum));
          if (wouldPickCat !== 'aerobic_base') return true;
        }
      }
      return false;
    }

    // ── B2 (2026-07-08): stress-aware streak state update ──
    // st.consecutiveCoreCalendarDays / st.prevSlotWasCore now track
    // consecutive HIGH-STRESS calendar days (team-day stress comes from the
    // shared classifier and its configured training intensity),
    // not "any core strength day". Medium/low days (upper strength,
    // easy aerobic, accessories, recovery) RESET the run — they are the
    // relative-recovery days that make the surrounding high days safe.
    function updateStressStreak(dayStress: 'high' | 'medium' | 'low', isConsecutiveDay: boolean) {
      if (dayStress === 'high') {
        st.consecutiveCoreCalendarDays = isConsecutiveDay && st.prevSlotWasCore
          ? st.consecutiveCoreCalendarDays + 1 : 1;
        st.prevSlotWasCore = true;
      } else {
        st.consecutiveCoreCalendarDays = 0;
        st.prevSlotWasCore = false;
      }
    }

    // ── 4A (2026-07-08): THE shared finisher eligibility law ──
    //
    // The main scorer respects the Bible, but finisher/repair paths (H5a,
    // H5b, Sprint Rescue, in-loop S+C) were each carrying partial guard
    // lists and could bolt hard conditioning onto protected days. Every
    // conditioning attachment now passes THIS one check.
    //
    // v1 decisions (Sam, 2026-07-08):
    //   • NO automatic sprint/COD finishers, ever. Sprint exposure comes
    //     from team training, games, and dedicated standalone sprint
    //     sessions (Sprint Rescue may only retarget standalone slots).
    //   • Lower/hinge days: easy off-feet aerobic only. If unsure,
    //     downgrade — never a hidden second hard session.
    //   • Upper days: aerobic freely; vo2/glycolytic only when readiness
    //     is high AND the week still has hard-day headroom.
    //   • Game window: G-0/G-1 deny everything; G-2 aerobic only.
    //   • Team days: pre-season deny (field session IS the conditioning);
    //     off-season aerobic only. Adjacent/sandwiched: nothing hard.
    //   • Downgrade before dropping: unsafe hard requests become
    //     aerobic_base rather than disappearing.
    type FinisherStrengthContext = 'lower' | 'hinge' | 'upper' | 'full' | 'standalone';
    type FinisherDecision =
      | { allow: true; category: CondCategory; downgraded: boolean; offFeetOnly?: boolean }
      | { allow: false; reason: string };

    function isHardConditioningCategory(category: CondCategory): boolean {
      return category === 'vo2' || category === 'glycolytic' || category === 'sprint';
    }

    function attachedKindFor(
      category: CondCategory,
      strengthContext: FinisherStrengthContext,
    ): AttachedConditioningKind {
      if (
        strengthContext === 'upper' &&
        (category === 'tempo' || category === 'vo2' || category === 'glycolytic')
      ) {
        return 'component';
      }
      return 'finisher';
    }

    function attachedConditioningCredit(kind: AttachedConditioningKind): number {
      return kind === 'component' ? 1.0 : 0.75;
    }

    function hardAttachedComponentCount(): number {
      return plan.filter((s) =>
        s.attachedConditioningKind === 'component' &&
        s.conditioningCategory !== undefined &&
        isHardConditioningCategory(s.conditioningCategory as CondCategory)
      ).length;
    }

    function planHighStressDayCount(): number {
      const highDows = new Set<number>();
      for (const s of plan) {
        if (s.stressLevel === 'high' && s.dayOfWeek) {
          const d = dayNameToNumber(s.dayOfWeek);
          if (d >= 0) highDows.add(d);
        }
      }
      // Include future team anchors using the configured training intensity;
      // Light skills/touch sessions are MEDIUM in the shared kernel.
      const teamAnchorStress = classifyGenerationSession({
        focus: 'Team Training',
        tier: 'core',
        isTeamDay: true,
      }, classificationContext).stressLevel;
      if (teamAnchorStress === 'high') {
        for (const d of teamDayNumSet) highDows.add(d);
      }
      if (isGameWeek && gameDayNum !== null) highDows.add(gameDayNum);
      return highDows.size;
    }

    // ── 4B: standalone tempo modality law ──
    // Running-based standalone tempo is a privilege, not a default. It is
    // only prescribed in PRE-SEASON when the week can genuinely absorb
    // quality running: normal/high readiness, a real conditioning base,
    // no lower-limb injury, and running exposure (team days + game) not
    // already saturating the legs. Everywhere else — and whenever the
    // eligibility law forces it (TT-adjacent) — tempo goes off-feet
    // (bike/row/ski). Off-season and in-season are off-feet-first in v1.
    function standaloneTempoOffFeet(forcedOffFeet: boolean): boolean {
      if (forcedOffFeet) return true;
      if (inputs.seasonPhase !== 'Pre-season') return true;
      if (readiness === 'low') return true;
      const base = inputs.conditioningLevel;
      if (base !== 'Good' && base !== 'Elite') return true;
      const lowerLimb = inputs.injuries.some(i =>
        /hamstring|calf|achilles|knee|ankle|groin|quad|hip|shin|foot|glute/i
          .test(`${i.bodyArea} ${i.description}`));
      if (lowerLimb) return true;
      // Running anchors already in the week: team field sessions + game.
      const runningAnchors = teamDayNumSet.size + (isGameWeek ? 1 : 0);
      if (runningAnchors >= 3) return true;
      return false;
    }

    function finisherEligibility(args: {
      dayNum: number;
      requestedCategory: CondCategory;
      strengthContext: FinisherStrengthContext;
    }): FinisherDecision {
      const { dayNum, strengthContext } = args;
      const easy = (downgraded: boolean): FinisherDecision =>
        ({ allow: true, category: 'aerobic_base', downgraded });

      // ── 4B downgrade ladder: hard → tempo → aerobic ──
      // v1 sprint law: sprint/COD is never a finisher/attachment. Instead
      // of collapsing straight to easy aerobic (4A), a denied sprint
      // finisher request steps DOWN one rung to tempo — the medium dose —
      // and the protective branches below then vet tempo exactly like any
      // other request (game window / TT / adjacency / pairing / readiness
      // all still end at aerobic). This is what makes tempo actually
      // appear in real weeks: the zone picker's sprint/hard requests were
      // previously un-grantable on every finisher slot, so weeks silently
      // collapsed to all-aerobic ("lowest compliant dose"). Highest useful
      // recoverable dose instead: hard → tempo where the day is clean.
      let requestedCategory = args.requestedCategory;
      let laddered = false;
      if (requestedCategory === 'sprint' && strengthContext !== 'standalone') {
        requestedCategory = 'tempo';
        laddered = true;
      }
      if (blocksConditioningCategoryForGeneration(requestedCategory)) {
        return easy(true);
      }
      if (
        trainingAgePolicy.avoidCombinedStrengthConditioning &&
        strengthContext !== 'standalone' &&
        requestedCategory !== 'aerobic_base'
      ) {
        return easy(true);
      }
      const isHardCategory = requestedCategory !== 'aerobic_base';

      // Game window (any phase reaching this allocator).
      if (isGameWeek && gameDayNum !== null) {
        const offset = gOffset(dayNum, gameDayNum);
        if (offset === 0 || offset === -1) {
          return { allow: false, reason: 'game_window_g1' };
        }
        if (offset === -2 && isHardCategory) return easy(true);
      }

      // Team training day.
      if (teamDayNumSet.has(dayNum)) {
        if (isPreSeason) return { allow: false, reason: 'team_day_pre_season' };
        if (isHardCategory) return easy(true);
      }

      // Adjacent to / sandwiched between team days: nothing hard.
      // 4B: tempo FINISHERS also back off to aerobic here (v1 — Sam may
      // relax upper+tempo TT-adjacent later). STANDALONE tempo survives
      // TT-adjacency but goes off-feet — the field session owns the legs.
      {
        const prevD = (dayNum + 6) % 7;
        const nextD = (dayNum + 1) % 7;
        const nearTeam = teamDayNumSet.has(prevD) || teamDayNumSet.has(nextD);
        const sandwiched = teamDayNumSet.has(prevD) && teamDayNumSet.has(nextD);
        if (nearTeam && isHardCategory) {
          // Sandwiched days must be genuinely low-stress — even off-feet
          // tempo backs off to easy aerobic (matches H-PRE-11).
          if (requestedCategory === 'tempo' && strengthContext === 'standalone' && !sandwiched) {
            if (readiness === 'low') return easy(true);
            return { allow: true, category: 'tempo', downgraded: false, offFeetOnly: true };
          }
          return easy(true);
        }
      }

      // Pairing: lower/hinge/full days take easy off-feet aerobic only.
      if (
        (strengthContext === 'lower' || strengthContext === 'hinge' || strengthContext === 'full') &&
        isHardCategory
      ) {
        return easy(true);
      }

      // Standalone sprint sessions (Sprint Rescue's only legal target):
      // deny in off-season (no late-block model yet — do not pretend the
      // app knows "late off-season"), use the exposure-counted pre-season
      // gate for team/practice/game coverage, deny below high readiness.
      if (requestedCategory === 'sprint' && strengthContext === 'standalone') {
        if (inputs.seasonPhase === 'Off-season') return { allow: false, reason: 'sprint_offseason_no_late_flag' };
        if (readiness !== 'high') return { allow: false, reason: 'sprint_readiness' };
        const gate = sprintExposureGate();
        if (!gate.allowStandaloneSprint) return { allow: false, reason: gate.reason };
        return { allow: true, category: 'sprint', downgraded: false };
      }

      // Tempo (4B): MEDIUM stress — controlled repeat efforts, 6-7/10.
      // It shares every protective downgrade above (game window, team
      // day/adjacency, lower/hinge/full pairing → aerobic), but because it
      // is not a hard exposure it does NOT consume weekly hard-day
      // headroom. Only gate left: low readiness backs off to easy aerobic.
      if (requestedCategory === 'tempo') {
        if (readiness === 'low') return easy(true);
        return { allow: true, category: 'tempo', downgraded: laddered };
      }

      // Hard non-sprint (vo2 / glycolytic): upper or standalone only, and
      // only when readiness and weekly hard-day headroom allow it. 4B:
      // headroom-blocked hard requests step down to TEMPO (medium — does
      // not consume hard-day headroom) instead of collapsing to easy.
      // Low readiness still goes all the way down to aerobic.
      if (isHardCategory) {
        if (readiness === 'low') return easy(true);
        if (
          strengthContext !== 'standalone' &&
          inputs.seasonPhase === 'Off-season' &&
          isHardConditioningCategory(requestedCategory) &&
          hardAttachedComponentCount() >= 1
        ) {
          return { allow: true, category: 'tempo', downgraded: true };
        }
        if (planHighStressDayCount() >= 4) {
          return { allow: true, category: 'tempo', downgraded: true };
        }
        return { allow: true, category: requestedCategory, downgraded: false };
      }

      return { allow: true, category: requestedCategory, downgraded: false };
    }

    type FinisherAttachDecision =
      | {
          attach: true;
          requestedCategory: CondCategory;
          category: CondCategory;
          downgraded: boolean;
          attachedKind: AttachedConditioningKind;
          offFeetOnly?: boolean;
        }
      | { attach: false; reason: string };

    function steadyAerobicFinisherCount(): number {
      return plan.filter((s) =>
        s.hasCombinedConditioning &&
        (s.attachedConditioningKind ?? 'finisher') === 'finisher' &&
        s.conditioningCategory === 'aerobic_base'
      ).length;
    }

    function shouldAttachFinisher(args: {
      dayNum: number;
      requestedCategory: CondCategory;
      strengthContext: FinisherStrengthContext;
    }): FinisherAttachDecision {
      const decision = finisherEligibility({
        dayNum: args.dayNum,
        requestedCategory: args.requestedCategory,
        strengthContext: args.strengthContext,
      });

      if (!decision.allow) {
        return {
          attach: false,
          reason: 'reason' in decision ? decision.reason : 'finisher_denied',
        };
      }

      const category = decision.category;
      const attachedKind = attachedKindFor(category, args.strengthContext);
      if (attachedKind === 'finisher' && category === 'aerobic_base') {
        if (steadyAerobicFinisherCount() >= MAX_STEADY_AEROBIC_FINISHERS) {
          return { attach: false, reason: 'steady_aerobic_finisher_cap' };
        }
      }

      return {
        attach: true,
        requestedCategory: args.requestedCategory,
        category,
        downgraded: decision.downgraded,
        attachedKind,
        offFeetOnly: decision.offFeetOnly,
      };
    }

    function shouldAttachBestFinisher(args: {
      dayNum: number;
      slotPos?: number;
      strengthContext: FinisherStrengthContext;
    }): FinisherAttachDecision {
      const denied: Array<{ category: CondCategory; reason: string }> = [];
      const requestedCategories = pickPlacementCondCategories(args.slotPos);
      if (
        inputs.seasonPhase === 'Off-season' &&
        teamDayNumSet.has(args.dayNum) &&
        requestedCategories[0] !== 'aerobic_base'
      ) {
        return { attach: false, reason: 'team_day_non_aerobic_request' };
      }
      for (const requestedCategory of requestedCategories) {
        const decision = shouldAttachFinisher({
          dayNum: args.dayNum,
          requestedCategory,
          strengthContext: args.strengthContext,
        });
        if ('reason' in decision) {
          denied.push({ category: requestedCategory, reason: decision.reason });
          continue;
        }
        return decision;
      }
      return {
        attach: false,
        reason: denied.length > 0
          ? denied.map((d) => `${d.category}:${d.reason}`).join(',')
          : 'no_category_candidates',
      };
    }

    type StandaloneCondDecision =
      | {
          place: true;
          requestedCategory: CondCategory;
          category: CondCategory;
          downgraded: boolean;
          offFeetOnly?: boolean;
        }
      | { place: false; reason: string };

    function pickStandaloneCondDecision(args: {
      dayNum: number;
      slotPos?: number;
    }): StandaloneCondDecision {
      const denied: Array<{ category: CondCategory; reason: string }> = [];
      for (const requestedCategory of pickPlacementCondCategories(args.slotPos)) {
        const decision = finisherEligibility({
          dayNum: args.dayNum,
          requestedCategory,
          strengthContext: 'standalone',
        });
        if (decision.allow) {
          return {
            place: true,
            requestedCategory,
            category: decision.category,
            downgraded: decision.downgraded,
            offFeetOnly: decision.offFeetOnly,
          };
        }
        denied.push({
          category: requestedCategory,
          reason: 'reason' in decision ? decision.reason : 'conditioning_denied',
        });
      }
      return {
        place: false,
        reason: denied.length > 0
          ? denied.map((d) => `${d.category}:${d.reason}`).join(',')
          : 'no_category_candidates',
      };
    }

    /** Map a strength candidate/pattern to the eligibility context. */
    function strengthContextOf(c: CandidateType | SessionAllocation['strengthPattern']): FinisherStrengthContext {
      if (c === 'L-hi' || c === 'lower') return 'hinge';
      if (c === 'L-sq' || c === 'L-co' || c === 'lower_combined') return 'lower';
      if (c === 'FB' || c === 'full_body') return 'full';
      return 'upper';
    }

    // ── Shared candidate classification ───────────────────────────────
    // Candidate selection stays local to the scorer; category, stress,
    // hard-day contribution and strength region come from the same adapter
    // used by visible workouts. Moderate full-body therefore stays MEDIUM,
    // upper stays MEDIUM, and Light team training does not become HIGH.
    function candidateClassification(
      c: CandidateType,
      pos: number,
      onTeamDay = false,
    ): VisibleSessionClassification {
      const strengthCandidate = c === 'S+C'
        ? pickSCStrengthType(pos)
        : STRENGTH_CANDIDATES.includes(c) ? c : undefined;
      const category = c === 'COND' || c === 'S+C'
        ? pickCondCategory(pos)
        : undefined;
      const flavour = category ? categoryToFlavour(category) : undefined;
      const attachedKind = c === 'S+C' && strengthCandidate && category
        ? attachedKindFor(category, strengthContextOf(strengthCandidate))
        : undefined;
      const focus = c === 'S+C' && strengthCandidate
        ? buildFocus(strengthCandidate)
        : buildFocus(c, flavour, category);

      return classifyGenerationSession({
        focus,
        tier: c === 'REC' ? 'recovery' : c === 'ACC' ? 'optional' : 'core',
        isTeamDay: onTeamDay,
        strengthPattern: strengthCandidate
          ? buildStrengthPattern(strengthCandidate)
          : undefined,
        hasCombinedConditioning: c === 'S+C',
        attachedConditioningKind: attachedKind,
        conditioningFlavour: flavour,
        conditioningCategory: category,
      }, classificationContext);
    }

    function candidateStress(
      c: CandidateType,
      pos: number,
      onTeamDay = false,
    ): 'high' | 'medium' | 'low' {
      return candidateClassification(c, pos, onTeamDay).stressLevel ?? 'low';
    }

    function candidateStrengthRegion(
      c: CandidateType,
      pos: number,
    ): 'upper' | 'lower' | null {
      const strengthCandidate = c === 'S+C'
        ? pickSCStrengthType(pos)
        : STRENGTH_CANDIDATES.includes(c) ? c : undefined;
      if (!strengthCandidate) return null;
      const region = classifyGenerationSession({
        focus: buildFocus(strengthCandidate),
        tier: 'core',
        strengthPattern: buildStrengthPattern(strengthCandidate),
      }, classificationContext).strengthRegion;
      return region === 'upper' || region === 'lower' ? region : null;
    }

    // ── Hard constraint check ──
    function violatesHard(c: CandidateType, dayNum: number): boolean {
      const pos = trainingOrder(dayNum);
      const isConsecutiveDay = pos === st.prevSlotDayNum + 1;
      const onTeamDay = isPreSeason && teamDayNumSet.has(dayNum);
      const adjacentTeamDay = isPreSeason && isAdjacentToTeamDay(pos);

      // H-GAME: pre-game protection is a hard rule in every mode.
      if (violatesGameProximity(c, dayNum)) return true;
      if (blocksStrengthCandidateForGeneration(c)) return true;

      // ── H-PRE-1: No separate conditioning on a team training day ──
      // Team training IS the field-load session. Adding standalone COND or
      // combining strength with conditioning (S+C) stacks running/HR stress
      // on top of an already-hard day. Gym on a team day = low-fatigue
      // strength support only (FB / upper / accessories).
      if (onTeamDay && (c === 'COND' || c === 'S+C')) return true;

      // ── H-PRE-2: No heavy lower on a team training day ──
      // Team training already delivers repeated high-force running, cuts,
      // and contact. Dedicated lower strength (squat or hinge focus, or
      // the combined L-co which loads both patterns) compounds the same
      // tissue load. FB is allowed only at core ≤ 2 (see H-PRE-4 below)
      // because its dose is moderate and distributed.
      if (onTeamDay && isHeavyLower(c)) return true;

      // ── H-TEAM-LOWER (Option B guardrail, 2026-07-08): the heavy-lower
      // block applies in EVERY phase, not just pre-season. Sam: "No lower
      // strength stacked onto team training." Before this, the stress-aware
      // streak (correctly) displaced a triple-high off-season shape and the
      // hinge day slid onto a Friday team session (S7).
      if (teamDayNumSet.has(dayNum) && isHeavyLower(c)) return true;

      // ── H-PRE-4: No FB stacking on a team training day at core ≥ 3 ──
      // When the week already has 3+ strength slots (enough for a
      // dedicated 2L+2U or 2L+1U split), placing FB on top of team
      // training creates redundant volume — the exact failure mode Sam
      // called out. FB stays legal at core ≤ 2, where FB+FB or FB+split
      // is the only way to hit every movement pattern.
      if (onTeamDay && c === 'FB' && core >= 3) return true;

      // ── H-PRE-3: Sprint conditioning not adjacent to a team day ──
      // Standalone sprint work the day before a team session leaves legs
      // unprepared for team sprints; the day after stacks neural + soft
      // tissue load while recovery is incomplete. Sprint (category='sprint'
      // on a COND slot, or an S+C slot the picker would pair with sprint)
      // is blocked on days adjacent to any team training day. Other
      // categories (aerobic_base, vo2, glycolytic) are still allowed.
      if (isPreSeason && adjacentTeamDay && c === 'COND') {
        const wouldPickCat = pickCondCategory(pos);
        if (wouldPickCat === 'sprint') return true;
      }
      if (isPreSeason && adjacentTeamDay && c === 'S+C') {
        const wouldPickCat = pickCondCategory(pos);
        if (wouldPickCat === 'sprint') return true;
      }

      // ── H-PRE-7: Block sprint / glycolytic on days SANDWICHED by team days ──
      // When prev AND next calendar days are BOTH team training days (e.g.
      // Tue+Thu team with a Wed slot), the middle day must be low-stress.
      // Sprint and glycolytic work on a sandwiched day taxes CNS + soft
      // tissue that still has team work on both sides — classic overlap
      // failure mode. Aerobic base / VO2 are still allowed (VO2 because
      // it is lower-intensity sustained work rather than true max-effort).
      // This is a stricter rule than H-PRE-3: H-PRE-3 blocks sprint
      // adjacent to any team day; H-PRE-7 additionally blocks glycolytic
      // when the day is sandwiched between two team days.
      if (isPreSeason && (c === 'COND' || c === 'S+C')) {
        const prevDay = (dayNum + 6) % 7;
        const nextDay = (dayNum + 1) % 7;
        const sandwichedBetweenTeam =
          teamDayNumSet.has(prevDay) && teamDayNumSet.has(nextDay);
        if (sandwichedBetweenTeam) {
          const wouldPickCat = pickCondCategory(pos);
          if (wouldPickCat === 'sprint' || wouldPickCat === 'glycolytic') {
            return true;
          }
        }
      }

      // H6: Core strength budget
      if (isStrength(c) && c !== 'COND') {
        const strengthCost = (c === 'S+C') ? 1 : (c === 'FB' ? 1 : 1);
        if (st.coreStrengthCount + strengthCost > core) return true;
      }

      // H1 (stress-aware, B2 2026-07-08): no 3+ consecutive HIGH-STRESS
      // calendar days. Upper strength is medium stress and no longer
      // extends or is blocked by the streak — TT + Wed upper + TT is a
      // legal, Bible-approved shape. Lower and hard conditioning remain
      // protected; moderate full-body follows the shared kernel as MEDIUM.
      if (candidateStress(c, pos, teamDayNumSet.has(dayNum)) === 'high') {
        const runIfPlaced = isConsecutiveDay && st.prevSlotWasCore
          ? st.consecutiveCoreCalendarDays + 1
          : 1;
        if (runIfPlaced >= 3) return true;
      }

      // ── H-PRE-5: No >3 consecutive core days in pre-season ──
      // Counts calendar-consecutive days that are either (a) team days
      // (immutable core), or (b) already-placed core sessions in `plan`,
      // including the candidate we're considering. If placing a
      // strength candidate here would produce a run of 4+, reject.
      // Conditioning candidates are NOT checked — they can be demoted
      // to optional post-validation to break streaks, so blocking them
      // here over-constrains placement.
      // ── H-PRE-11 (B2, graded per Sam 2026-07-08): work SANDWICHED
      // between two team training days. The issue is lower-body stress
      // stacking, not balance alone. Hierarchy:
      //   • NEVER (any phase): hinge-heavy lower (L-hi / L-co), hard
      //     conditioning, sprint, lower-half or hard S+C.
      //   • Pre-season: ALL high-stress work banned on the sandwiched day
      //     (upper is medium and stays legal — TT + Wed upper + TT is a
      //     Bible-approved shape), EXCEPT controlled full body when
      //     availability genuinely forces it (core ≤ 2, the FB-replaces-
      //     everything regime). FB there must stay a controlled moderate
      //     dose, never a brutal lower session.
      {
        const prevDay = (dayNum + 6) % 7;
        const nextDay = (dayNum + 1) % 7;
        if (teamDayNumSet.has(prevDay) && teamDayNumSet.has(nextDay)) {
          if (c === 'L-hi' || c === 'L-co') return true;
          if ((c === 'COND' || c === 'S+C') && pickCondCategory(pos) !== 'aerobic_base') return true;
          if (c === 'S+C' && isLower(pickSCStrengthType(pos))) return true;
          if (isPreSeason && candidateStress(c, pos, teamDayNumSet.has(dayNum)) === 'high') {
            const controlledFbException = c === 'FB' && core <= 2;
            if (!controlledFbException) return true;
          }
        }
      }

      // H-PRE-5 is stress-aware (B2): only HIGH-stress candidates extend or
      // are blocked by the consecutive run; placed sessions count via their
      // recorded stressLevel (legacy fallback: core tier).
      if (isPreSeason && candidateStress(c, pos, teamDayNumSet.has(dayNum)) === 'high') {
        let streak = 1; // the candidate day itself
        // Walk backward
        for (let back = 1; back < 7; back++) {
          const d = dayNum - back;
          if (d < 0) break;
          const placed = plan.find(s => s.dayOfWeek && dayNameToNumber(s.dayOfWeek) === d);
          const coreHere = teamDayNumSet.has(d) ||
            (placed && (placed.stressLevel ? placed.stressLevel === 'high' : placed.tier === 'core'));
          if (coreHere) streak++;
          else break;
        }
        // Walk forward — only team days are known future-core
        for (let fwd = 1; fwd < 7; fwd++) {
          const d = dayNum + fwd;
          if (d > 6) break;
          if (teamDayNumSet.has(d)) streak++;
          else break;
        }
        if (streak >= 4) return true;
      }

      // H3: Dedicated lower exposure separated by ≥1 calendar day
      // FB is NOT counted here — it's moderate load across all patterns,
      // not a dedicated lower session. FB → squat/hinge the next day is
      // valid and normal in off-season programming. L-co IS counted: it
      // loads both squat and hinge tissue at moderate-to-high dose, so
      // stacking it on consecutive days stacks lower tissue load.
      const isDedicatedLower = (c === 'L-sq' || c === 'L-hi' || c === 'L-co');
      if (isDedicatedLower && st.lastLowerDay >= 0) {
        if (pos - st.lastLowerDay < 2) return true;
      }

      // H2: Same lower subtype separated by ≥2 calendar days
      if ((c === 'L-sq' || c === 'L-hi') && st.lastLowerSubtype === c) {
        if (st.lastLowerDay >= 0 && pos - st.lastLowerDay < 3) return true;
      }

      // Budget for optional / recovery
      if (c === 'ACC' && st.optCount >= optional) return true;
      if (c === 'REC' && st.recCount >= recovery) return true;

      return false;
    }

    function pushUniqueCategory(list: CondCategory[], category: CondCategory): void {
      if (!list.includes(category)) list.push(category);
    }

    function autoPlacementCategories(): CondCategory[] {
      return categoryPriority.filter((category) =>
        category !== 'sprint' || sprintExposureGate().allowStandaloneSprint,
      );
    }

    // ── Pick conditioning category candidates (off-season / pre-season) ──
    //
    // Category is the source of truth. This returns a ranked list of
    // concrete categories; eligibility then vets those exact categories and
    // may deliberately downgrade. Flavour is derived AFTER the final
    // category is placed, never used to reconstruct category intent.
    function pickPlacementCondCategories(slotPos?: number): CondCategory[] {
      const weekLen = daySlots.length;
      const zone = slotPos === undefined ? null
        : slotPos <= Math.ceil(weekLen / 3) ? 'early'
        : slotPos <= Math.ceil((weekLen * 2) / 3) ? 'mid'
        : 'late';
      // Zone priority encodes Sam's sequencing intent where sprint is in
      // the active placement pool (pre-season). Off-season filters sprint
      // out via `placementPool` below until the speed-block model exists:
      //   early → high-fatigue first  (vo2 / glyco)
      //   mid   → quality sprint      (athlete should be relatively fresh)
      //   late  → aerobic base flush  (low-fatigue deload feel)
      //
      // Short-week pre-season bias: on ≤4-day weeks sprint has no room in
      // a "middle" slot that isn't adjacent to a vo2/glyco day, so it risks
      // being stranded by sprint-protection. Bias it EARLY so it lands
      // before the high-fatigue categories rather than after them.
      const shortWeek = weekLen <= 4;
      // NOTE (4B): tempo is deliberately ABSENT from these zone lists —
      // it is not a coverage category. See CATEGORY_PRIORITY_* comment.
      // NOTE (Slice 1.1): off-season placement priorities omit sprint
      // before these lists are applied, so it cannot be requested as an
      // automatic attached finisher until the speed-block model exists.
      const zonePriority: Record<string, CondCategory[]> = shortWeek ? {
        early: ['sprint', 'vo2', 'glycolytic', 'aerobic_base'],
        mid:   ['vo2', 'glycolytic', 'aerobic_base', 'sprint'],
        late:  ['aerobic_base', 'vo2', 'glycolytic', 'sprint'],
      } : {
        early: ['vo2', 'glycolytic', 'sprint', 'aerobic_base'],
        mid:   ['sprint', 'vo2', 'glycolytic', 'aerobic_base'],
        late:  ['aerobic_base', 'vo2', 'glycolytic', 'sprint'],
      };

      // Sprint protection — ABSOLUTE. Per Sam's explicit design rule,
      // sprint must never follow a vo2/glycolytic day, even if that means
      // sprint ends up duplicated or uncovered in a given week. Coverage
      // is secondary to recovery quality for sprint sessions.
      const isConsecutive = slotPos !== undefined && slotPos === st.lastCondDay + 1;
      const sprintBlocked = isConsecutive &&
        (st.lastCondCategory === 'vo2' || st.lastCondCategory === 'glycolytic');
      const allow = (c: CondCategory) => !(c === 'sprint' && sprintBlocked);
      const placementPool = autoPlacementCategories();
      const out: CondCategory[] = [];

      // Pass 1 — zone priority among UNCOVERED categories (respecting block).
      if (zone) {
        const rankedForZone =
          inputs.seasonPhase === 'Off-season' ||
          (preseasonSubphase !== null && preseasonSubphase !== 'mid_preseason')
            ? categoryPriority
            : zonePriority[zone];
        for (const c of rankedForZone) {
          if (!placementPool.includes(c)) continue;
          if (!allow(c)) continue;
          if (st.condCategories[c] === 0) pushUniqueCategory(out, c);
        }
      }
      // Pass 2 — global phase priority among UNCOVERED categories (respecting block).
      for (const c of placementPool) {
        if (!allow(c)) continue;
        if (st.condCategories[c] === 0) pushUniqueCategory(out, c);
      }
      // Pass 3 — all allowed uncovered categories added: append least-used
      // covered categories as fallbacks for eligibility denial.
      const byUse = placementPool
        .filter(allow)
        .sort((a, b) =>
          st.condCategories[a] - st.condCategories[b] ||
          placementPool.indexOf(a) - placementPool.indexOf(b)
        );
      for (const c of byUse) pushUniqueCategory(out, c);

      // Defensive fallback only. In practice placementPool is never empty.
      if (out.length === 0) out.push('aerobic_base');
      return out;
    }

    function pickCondCategory(slotPos?: number): CondCategory {
      return pickPlacementCondCategories(slotPos)[0];
    }

    // ── Pick conditioning flavour for a slot ──
    function pickCondFlavour(slotPos?: number): CondFlavour {
      // Off-season & pre-season: route through the category planner so
      // each week covers all 4 energy systems before duplicating. When
      // slotPos is provided, the category picker additionally applies
      // the weekly sequencing + sprint-protection rules.
      if (useCategoryPlanner) {
        const cat = pickCondCategory(slotPos);
        return categoryToFlavour(cat);
      }
      // Other phases: preserve legacy flavour balance behaviour.
      let best: CondFlavour = 'aerobic';
      let bestCount = Infinity;
      for (const f of COND_FLAVOURS) {
        if (st.condFlavours[f] >= COND_FLAVOUR_CAPS[f]) continue;
        if (st.condFlavours[f] < bestCount) {
          bestCount = st.condFlavours[f];
          best = f;
        }
      }
      return best;
    }

    // ── Soft preference scoring ──
    const W_PATTERN = 30;        // per-pattern exposure need
    const W_OVERSHOOT = 15;      // penalty for exceeding pattern target
    const W_BALANCE = 25;        // missing-pattern urgency bonus
    const W_SPACING = 20;        // spacing quality
    const W_TEAM_UPPER = 10;     // upper on team day
    const W_TEAM_LOWER = 5;      // lower on team day penalty
    const W_COMBINED = 12;       // S+C combined day bonus
    const W_FATIGUE_WAVE = 5;    // early-week strength, late-week deload
    const W_VARIETY = 10;        // same-subtype penalty / alternation bonus
    const W_COND_FLAVOUR = 8;    // conditioning flavour balance (legacy phases)
    const W_COND_CATEGORY = 18;  // conditioning category coverage (off/pre-season)
    const W_COND_CATEGORY_DUP = 35; // penalty: duplicate category while others uncovered
    const W_COND_EXPOSURE = 30;  // conditioning exposure need
    const W_REGION_CONSECUTIVE = 45; // penalty: same region on consecutive days
    const W_SEQUENCING = 10;     // zone-matched conditioning (early/mid/late)
    const W_SEQUENCING_MISS = 6; // penalty for wrong-zone conditioning
    const W_SPRINT_MIDWEEK_BONUS = 6; // extra nudge to land sprint in mid zone
    const W_SPRINT_OFFZONE = 3;  // soft penalty for sprint in early/late zones
    const W_SPRINT_BLOCK = 40;   // HARD-STYLE penalty: sprint the day after vo2/glyco
    const W_SC_PAIRING_GOOD = 10; // preferred S+C pairing (lower+aerobic, upper+vo2)
    // Bad-pairing penalty raised from 12 → 20 per Sam's refinement goal
    // of keeping bad pairings <20% of combined days. The combined
    // conditioning builder still auto-swaps to ergometer modality
    // (SkiErg / Rower / Bike) when forced into a lower+sprint/glyco
    // pairing, so the legs-twice problem is mitigated; this penalty
    // strength pushes pattern selection toward better pairings WHEN
    // CHOICE EXISTS, without overriding category coverage (top rule).
    const W_SC_PAIRING_BAD = 35; // soft penalty for lower+glyco / lower+sprint
    const W_SEQUENCE_REGION = 25; // H-PRE-10: standalone-slot region preference vs team-day upper

    // Helper: count for a specific pattern
    function patternCount(c: CandidateType): number {
      switch (c) {
        case 'L-sq': return st.sqCount;
        case 'L-hi': return st.hiCount;
        case 'U-pu': return st.puCount;
        case 'U-pl': return st.plCount;
        default: return 0;
      }
    }

    function scoreCandidate(c: CandidateType, slot: typeof daySlots[0], slotIndex: number): number {
      let score = 0;
      const pos = trainingOrder(slot.num);
      const strengthSlotsLeft = core - st.coreStrengthCount;

      // ── Effective strength region ───────────────────────────────────────
      // Region-based rules (e.g. H-PRE-10) must operate on the strength
      // region actually being placed, not the candidate token. A pure
      // strength candidate carries its own region; an S+C candidate carries
      // whatever scStrength pickSCStrengthType would select for this slot.
      // If region rules gated on `c` alone, S+C with scStrength='U-pu'
      // would bypass Upper penalties and land Upper on days that region
      // sequencing meant to protect for Lower.
      const effectiveRegion = candidateStrengthRegion(c, pos);

      // ── Pattern exposure need ──
      // Each pattern (sq, hi, pu, pl) gets an equal share of core budget.
      // Score based on per-pattern deficit from that share.
      if (c === 'L-sq' || c === 'L-hi' || c === 'U-pu' || c === 'U-pl') {
        const myCount = patternCount(c);
        const deficit = patternShare - myCount;
        score += deficit > 0 ? W_PATTERN * Math.min(deficit, 1) : -W_OVERSHOOT;
      }

      // Combined-region sessions contribute 0.5 to each sub-pattern.
      // Reward L-co when at least one of (sq, hi) is uncovered; reward
      // U-co when at least one of (pu, pl) is uncovered.
      if (c === 'L-co') {
        const lowerDeficit = (st.sqCount === 0 ? 1 : 0) + (st.hiCount === 0 ? 1 : 0);
        score += lowerDeficit > 0 ? W_PATTERN * 0.75 * lowerDeficit : -W_OVERSHOOT * 0.5;
      }
      if (c === 'U-co') {
        const upperDeficit = (st.puCount === 0 ? 1 : 0) + (st.plCount === 0 ? 1 : 0);
        score += upperDeficit > 0 ? W_PATTERN * 0.75 * upperDeficit : -W_OVERSHOOT * 0.5;
      }

      if (c === 'FB') {
        // FB covers all 4 patterns partially — valuable when patterns are missing
        const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
          .filter(x => x === 0).length;
        if (missingPatterns >= 2 && missingPatterns > strengthSlotsLeft) {
          // More missing patterns than remaining strength slots → FB is efficient
          score += W_BALANCE * missingPatterns * 0.75;
        } else if (core <= 2) {
          // Low-core weeks benefit from FB coverage
          score += W_PATTERN * 0.5;
        } else {
          // Dedicated pattern sessions preferred over FB when slots allow
          score -= W_OVERSHOOT * 0.5;
        }
      }

      // ── H-PRE-6 sequence guard: FB must not PRE-LOAD a heavy day ──
      //
      // In pre-season core=3 weeks the FB slot is a SUPPORT session. The
      // failure mode Sam flagged is FB SITTING BEFORE a heavy day:
      //   Mon FB  →  Tue Team+Upper   (FB upper primes a full upper day)
      //   Fri FB  →  Sat Lower        (FB lower primes a dedicated lower)
      // The asymmetric rule: penalise FB when the NEXT day is a team day,
      // a dedicated lower, or a dedicated upper. FB AFTER a heavy day is
      // tolerable — the light full-body dose acts like active recovery
      // rather than pre-loading the next hard exposure.
      //
      // Mirror rule: when placing a dedicated L/U after an already-placed
      // FB, the same "FB precedes heavy" anti-pattern holds → penalise.
      if (isPreSeason && hasTeamDays && core === 3) {
        const W_FB_ADJACENT = 40; // strong — comparable to W_REGION_CONSECUTIVE
        const regionOnDay = (dayNum: number): 'FB' | 'L' | 'U' | 'TEAM' | null => {
          if (teamDayNumSet.has(dayNum)) return 'TEAM';
          const entry = plan.find(s => s.dayOfWeek && dayNameToNumber(s.dayOfWeek) === dayNum);
          if (!entry || entry.tier !== 'core') return null;
          const f = entry.focus;
          if (/^Full body/i.test(f)) return 'FB';
          if (/squat emphasis|Hip-dominant lower|quad-dominant main/i.test(f)) return 'L';
          if (/push emphasis|pull emphasis|combined push \+ pull/i.test(f)) return 'U';
          return null;
        };
        const isHeavyNeighbour = (r: ReturnType<typeof regionOnDay>) =>
          r === 'L' || r === 'U' || r === 'TEAM';

        const prev = regionOnDay(slot.num - 1);
        const next = regionOnDay(slot.num + 1);

        // Placing FB with a heavy NEXT day → FB pre-loads → penalty.
        if (c === 'FB' && isHeavyNeighbour(next)) score -= W_FB_ADJACENT;

        // Placing a dedicated L/U with FB on the PREV day → same
        // "FB precedes heavy" pattern, detected from the other side.
        const isDedicatedStrength =
          c === 'L-sq' || c === 'L-hi' || c === 'L-co' ||
          c === 'U-pu' || c === 'U-pl' || c === 'U-co';
        if (isDedicatedStrength && prev === 'FB') score -= W_FB_ADJACENT;
      }

      if (isConditioning(c)) {
        const condCredit = c === 'S+C' ? 0.75 : 1.0;
        const deficit = condTarget - st.condCount;
        score += deficit > 0 ? W_COND_EXPOSURE * Math.min(deficit, condCredit) : -W_OVERSHOOT;
      }

      // S+C also adds a strength pattern — score the pattern coverage value
      if (c === 'S+C') {
        // The strength component will be picked by pickSCStrengthType.
        // Bonus if there are missing patterns we can fill.
        const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
          .filter(x => x === 0).length;
        if (missingPatterns > 0) score += W_PATTERN * 0.5;
      }

      // ── Conditioning urgency: S+C is REQUIRED when standalone slots are scarce ──
      // "Think like a coach": if there's no room for standalone conditioning,
      // combine strength + conditioning into the same session. This is not a
      // bonus — it's a structural necessity.
      if (c === 'S+C') {
        const totalSlotsLeft = daySlots.length - slotIndex;
        const strengthBudgetLeft = core - st.coreStrengthCount;
        const standaloneLeft = Math.max(0, totalSlotsLeft - strengthBudgetLeft);
        const condDeficit = condTarget - st.condCount;
        const condFloorRemaining = Math.max(0, MIN_COND_FLOOR - st.condCount);

        if (condFloorRemaining > 0 && standaloneLeft < Math.ceil(condFloorRemaining)) {
          // Can't reach minimum conditioning without combined days — S+C is mandatory
          score += W_COND_EXPOSURE * 2.0;
        } else if (condDeficit > 0 && standaloneLeft < condDeficit) {
          // Not enough standalone slots for full target — strongly prefer S+C
          score += W_COND_EXPOSURE * 1.0;
        }
      }

      // ── Penalize pure strength when conditioning is starving ──
      // If choosing a pure strength session in this slot would leave insufficient
      // room for conditioning, penalize it so S+C wins instead.
      if (STRENGTH_CANDIDATES.includes(c) && c !== 'S+C') {
        const totalSlotsLeft = daySlots.length - slotIndex;
        const strengthBudgetLeft = core - st.coreStrengthCount;
        const standaloneLeft = Math.max(0, totalSlotsLeft - strengthBudgetLeft);
        const condFloorRemaining = Math.max(0, MIN_COND_FLOOR - st.condCount);

        if (condFloorRemaining > 0 && standaloneLeft < Math.ceil(condFloorRemaining)) {
          // Taking this as pure strength makes conditioning impossible to fit
          score -= W_COND_EXPOSURE * 1.0;
        }
      }

      if (c === 'ACC') score += 5;
      if (c === 'REC') score += 3;

      // ── Global pattern balance urgency ──
      // Strong bonus for placing a pattern that hasn't appeared yet.
      // Urgency increases dramatically as remaining strength slots decrease.
      if (core >= 3 && (c === 'L-sq' || c === 'L-hi' || c === 'U-pu' || c === 'U-pl')) {
        const myCount = patternCount(c);
        if (myCount === 0) {
          const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
            .filter(x => x === 0).length;
          // Urgency: how tight are we on slots vs missing patterns?
          // If missingPatterns > strengthSlotsLeft, we can't cover everything
          // individually — panic mode.
          const urgency = missingPatterns > strengthSlotsLeft ? 2.5 : 1.0;
          score += W_BALANCE * urgency;
        } else if (myCount >= 1) {
          // Already have this pattern — penalize duplication when other patterns missing
          const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
            .filter(x => x === 0).length;
          if (missingPatterns > 0) score -= W_BALANCE * 0.5;
        }
      }

      // ── Spacing quality (region-based) ──
      if (isLower(c)) {
        const gap = st.lastLowerDay >= 0 ? pos - st.lastLowerDay : 99;
        if (gap >= 3) score += W_SPACING;
        else if (gap >= 2) score += W_SPACING * 0.5;
      }
      if (isUpper(c)) {
        const gap = st.lastUpperDay >= 0 ? pos - st.lastUpperDay : 99;
        if (gap >= 3) score += W_SPACING;
        else if (gap >= 2) score += W_SPACING * 0.5;
      }
      if (isConditioning(c)) {
        const gap = st.lastCondDay >= 0 ? pos - st.lastCondDay : 99;
        if (gap >= 2) score += W_SPACING * 0.5;
      }

      // ── Region consecutive penalty ──
      // Push/pull are both upper body; squat/hinge are both lower body.
      // Placing two same-region sessions on consecutive days clusters stimulus
      // and hinders recovery. Penalize heavily to force interleaving U/L.
      // FB is neutral (full body doesn't cluster one region).
      if ((c === 'U-pu' || c === 'U-pl') && st.lastUpperDay >= 0 && pos - st.lastUpperDay < 2) {
        score -= W_REGION_CONSECUTIVE;
      }
      if ((c === 'L-sq' || c === 'L-hi') && st.lastLowerDay >= 0 && pos - st.lastLowerDay < 2) {
        score -= W_REGION_CONSECUTIVE;
      }
      // S+C inherits region from its strength component
      if (c === 'S+C') {
        const scType = pickSCStrengthType(pos);
        if ((scType === 'U-pu' || scType === 'U-pl') && st.lastUpperDay >= 0 && pos - st.lastUpperDay < 2) {
          score -= W_REGION_CONSECUTIVE;
        }
        if ((scType === 'L-sq' || scType === 'L-hi') && st.lastLowerDay >= 0 && pos - st.lastLowerDay < 2) {
          score -= W_REGION_CONSECUTIVE;
        }
      }

      // ── Team day preference ──
      if (slot.isTeamDay) {
        if (isUpper(c) || c === 'FB') score += W_TEAM_UPPER;
        if (isLower(c) && c !== 'FB') score -= W_TEAM_LOWER;
      }

      // ── Pre-season team-day shaping ──
      // In pre-season, team days are PRIMARY CORE anchors. Hard rules in
      // violatesHard() already block COND / S+C / dedicated lower on a
      // team day. Here the scorer strongly prefers a light upper session
      // (core) layered on top of team training. Sam's pre-season ruleset
      // says: "Strength allowed on team days = upper or light full body
      // only" — so upper wins decisively, FB is a weak fallback, and
      // ACC/REC are only chosen when no strength pattern is needed (e.g.
      // budget already met).
      if (isPreSeason && slot.isTeamDay) {
        // Upper dominates — team day + upper is the default pairing.
        // Both dedicated upper and combined upper (U-co) qualify; the
        // combined-upper variant is the correct placement when the week
        // only has room for one upper slot.
        if (c === 'U-pu' || c === 'U-pl' || c === 'U-co') score += 30;
        // FB penalised on team days when core ≥ 3: if the week already
        // has dedicated lower + upper slots elsewhere, stacking FB on a
        // team day creates redundant full-body volume (Sam's complaint).
        // When core ≤ 2 we leave FB neutral — it may be the only way to
        // hit all movement patterns.
        if (c === 'FB') {
          score += core >= 3 ? -20 : 2;
        }
        // Accessories / recovery still allowed on team days when strength
        // budget is exhausted, but they lose to upper strength when there
        // is still pattern coverage work to do.
        if (c === 'ACC') {
          const strengthBudgetLeft = core - st.coreStrengthCount;
          // If strength budget remains, strongly deprioritise ACC so an
          // upper strength session wins; if budget is spent, ACC is the
          // natural fill for remaining team-day slots.
          score += strengthBudgetLeft > 0 ? -15 : 8;
        }
        if (c === 'REC') {
          const strengthBudgetLeft = core - st.coreStrengthCount;
          score += strengthBudgetLeft > 0 ? -20 : 4;
        }
      }

      // ── Pre-season sprint-adjacency penalty ──
      // Soft reinforcement of H-PRE-3 — if the hard constraint somehow
      // doesn't fire (e.g. category flips between scoring and placement),
      // the scorer still pushes non-sprint options ahead.
      if (isPreSeason && isConditioning(c) && isAdjacentToTeamDay(pos)) {
        const pickedCat = pickCondCategory(pos);
        if (pickedCat === 'sprint') score -= W_SPRINT_BLOCK;
      }

      // ── H-PRE-7 placement penalty: sandwiched day between two team days ──
      // Belt-and-suspenders for the hard rule in violatesHard(): if a
      // conditioning candidate with sprint or glycolytic flavour would
      // otherwise score highly on a day with team training on BOTH sides,
      // crush the score so a safer flavour (aerobic base / VO2) wins.
      if (isPreSeason && isConditioning(c)) {
        const dayNum = slot.num;
        const prevDay = (dayNum + 6) % 7;
        const nextDay = (dayNum + 1) % 7;
        const sandwichedBetweenTeam =
          teamDayNumSet.has(prevDay) && teamDayNumSet.has(nextDay);
        if (sandwichedBetweenTeam) {
          const pickedCat = pickCondCategory(pos);
          if (pickedCat === 'sprint' || pickedCat === 'glycolytic') {
            score -= 50;
          }
        }
      }

      // ── H-PRE-10: region sequencing (pre-season 4-exposure regime) ──
      //
      // In the pre-season 4-exposure regime (core=4, ≥2 team days, no game,
      // ≥5 days), team days are core anchors that almost always host Upper
      // (H-PRE-2 blocks dedicated lower on team days; W_TEAM_UPPER + the
      // pre-season team-day shaping block favour upper strength). That
      // means standalone strength slots should carry LOWER, not Upper —
      // placing a standalone Upper before a team-day Upper produces an
      // Upper-Upper cluster at the start of the week, and leaves the
      // remaining Lower slots to clump at the end (U, Team+U, _, L, L).
      //
      // Sam flagged the exact failure: Mon=U-pu, Tue=Team+U-pl, Fri=L-sq,
      // Sat=L-hi. The queue is correct (2L+2U) but the sequence clusters.
      // This rule tips placement decisions toward alternating/interleaved
      // regions by:
      //   1. Rewarding Lower on any standalone (non-team) strength slot.
      //   2. Penalising standalone Upper while team days are still unplaced
      //      (those upcoming team days will carry Upper themselves).
      //   3. Extra nudge for the FIRST standalone slot BEFORE the first
      //      team day — that slot should strongly prefer Lower so the
      //      week opens L → Team+U rather than U → Team+U.
      //
      // Weight sized so it wins against W_VARIETY alternation (10) and
      // pattern-deficit tie-breakers but stays below W_REGION_CONSECUTIVE
      // (45) so it doesn't override the spacing guard.
      //
      // Gated to core === 4 only. At core=3 the H-PRE-6 regime is already
      // 1L + 1U + FB — no cluster is possible by construction, and adding
      // a lower-preference on the standalone slot can force the single FB
      // into a pre-team pre-load position (breaking H-PRE-6 adjacency).
      //
      // B4 (2026-07-08): ALSO applies to core=3 GAME weeks, whose queue is
      // 1L + 2U (no FB) — the standalone early slot must carry Lower so
      // the team days can host the uppers and G-1 stays light.
      if (isPreSeason && hasTeamDays && !slot.isTeamDay &&
          (core === 4 || (core === 3 && isGameWeek))) {
        // Count team days not yet placed into `plan`. Placement iterates
        // in training-order, so unplaced team days are always those whose
        // training-order position comes after the current slot.
        const placedTeamDayCount = plan.filter(s =>
          s.tier === 'core' && s.dayOfWeek
          && teamDayNumSet.has(dayNameToNumber(s.dayOfWeek))
        ).length;
        const upcomingTeamDays = teamDayNumSet.size - placedTeamDayCount;

        // Use effectiveRegion (computed above) so S+C candidates are classed
        // by their scStrength region — closes the H-PRE-10 bypass where an
        // S+C with scStrength='U-pu' was treated as region-neutral and
        // landed Upper strength on a slot that should have carried Lower.
        //
        // (1) Standalone Upper while team days will still host Upper →
        //     redundant cluster. Penalty scales with unplaced team days.
        if (effectiveRegion === 'upper' && upcomingTeamDays > 0) {
          score -= W_SEQUENCE_REGION;
        }
        // (2) Standalone Lower complements team-upper days → reward.
        if (effectiveRegion === 'lower') {
          score += W_SEQUENCE_REGION * 0.5;
        }

        // (3) First standalone slot BEFORE the first team day: extra nudge.
        //     firstTeamPos uses trainingOrder so Sunday-last weeks resolve
        //     correctly (Sun→7). In the canonical 2L+2U queue the two
        //     team days consume both Upper items, leaving standalone slots
        //     to carry Lower — this rule strengthens that choice for the
        //     very first slot (the highest-leverage anti-cluster decision).
        const teamPositions = Array.from(teamDayNumSet).map(trainingOrder);
        const firstTeamPos = Math.min.apply(null, teamPositions);
        if (pos < firstTeamPos) {
          if (effectiveRegion === 'lower') score += W_SEQUENCE_REGION * 0.5;
          if (effectiveRegion === 'upper') score -= W_SEQUENCE_REGION * 0.5;
        }
      }

      // ── Combined day bonus ──
      if (c === 'S+C') {
        const condDeficit = condTarget - st.condCount;
        if (condDeficit > 0) {
          const canHandle = inputs.conditioningLevel === 'Good' || inputs.conditioningLevel === 'Elite';
          score += canHandle ? W_COMBINED : W_COMBINED * 0.5;
        }
      }

      // ── Fatigue wave ──
      if (pos <= 3 && isStrength(c)) score += W_FATIGUE_WAVE;
      if (pos >= 6 && (c === 'COND' || c === 'REC' || c === 'ACC')) score += W_FATIGUE_WAVE;

      // ── Variety ──
      if (st.lastCoreSubtype === c && isStrength(c)) score -= W_VARIETY;

      // ── Subtype alternation ──
      if (c === 'U-pl' && st.lastUpperSubtype === 'U-pu') score += W_VARIETY;
      if (c === 'U-pu' && st.lastUpperSubtype === 'U-pl') score += W_VARIETY;
      if (c === 'L-hi' && st.lastLowerSubtype === 'L-sq') score += W_VARIETY;
      if (c === 'L-sq' && st.lastLowerSubtype === 'L-hi') score += W_VARIETY;

      // ── Conditioning category / flavour balance ──
      if (isConditioning(c)) {
        if (useCategoryPlanner) {
          // Off-season / Pre-season: the week should cover concrete
          // auto-placement categories distinctly before any duplicates.
          // Reward conditioning
          // slots that fill an uncovered category, penalise ones that would
          // duplicate a covered category while gaps remain.
          const pickedCat = pickCondCategory(pos);
          // Tempo is not a must-cover category (4B), and off-season sprint
          // is not auto-requested until the speed-block model exists.
          const ALL_CATS: CondCategory[] = autoPlacementCategories();
          const uncovered = ALL_CATS.filter(
            cat => st.condCategories[cat] === 0,
          ).length;
          if (st.condCategories[pickedCat] === 0) {
            // Filling an uncovered slot — urgency scales with gaps.
            score += W_COND_CATEGORY + uncovered * 3;
          } else if (uncovered > 0) {
            // All picks would hit a covered category but uncovered ones
            // remain — heavy penalty. The category planner shouldn't reach
            // here unless every uncovered category is structurally impossible.
            score -= W_COND_CATEGORY_DUP;
          }

          // ── Weekly sequencing bonus ──
          // Reward conditioning slots that fall in their "natural" zone:
          //   early → vo2 / glycolytic (higher fatigue up front)
          //   mid   → sprint           (freshness-dependent neural quality)
          //   late  → aerobic_base     (low fatigue, flush volume)
          // Short weeks can still strand sprint after vo2/glyco; when
          // protection wins we accept a zone miss (sprint will slide
          // elsewhere) rather than penalising it heavily.
          const weekLen = daySlots.length;
          const zone: 'early' | 'mid' | 'late' =
            pos <= Math.ceil(weekLen / 3) ? 'early'
            : pos <= Math.ceil((weekLen * 2) / 3) ? 'mid'
            : 'late';
          const zoneFavoured: Record<typeof zone, CondCategory[]> =
            inputs.seasonPhase === 'Off-season'
              ? offseasonPolicy?.subphase === 'early_offseason'
                ? {
                    early: ['aerobic_base'],
                    mid:   ['aerobic_base'],
                    late:  ['aerobic_base'],
                  }
                : offseasonPolicy?.subphase === 'mid_offseason'
                  ? {
                      early: ['tempo'],
                      mid:   ['tempo'],
                      late:  ['aerobic_base'],
                    }
                  : {
                      early: ['vo2', 'glycolytic'],
                      mid:   ['tempo'],
                      late:  ['aerobic_base'],
                    }
              : {
                  early: ['vo2', 'glycolytic'],
                  mid:   ['sprint'],
                  late:  ['aerobic_base'],
                };
          if (zoneFavoured[zone].includes(pickedCat)) {
            score += W_SEQUENCING;
            // Sprint mid-week preference — reinforce. When sprint lands in
            // its preferred zone we ADD extra weight beyond the generic
            // zone bonus, making "mid-week sprint" sticky against other
            // late-stage tie-breakers. Sam's explicit rule: prefer placing
            // sprint mid-week when possible, even under constraints.
            if (pickedCat === 'sprint' && zone === 'mid') {
              score += W_SPRINT_MIDWEEK_BONUS;
            }
          } else if (zone === 'late' && (pickedCat === 'vo2' || pickedCat === 'glycolytic')) {
            // Late-week high-intensity conditioning is the worst-case — the
            // athlete should be freshest early week for this. Penalise.
            score -= W_SEQUENCING_MISS;
          } else if (pickedCat === 'sprint' && zone !== 'mid') {
            // Soft nudge: prefer sprint in mid over early/late, without
            // overriding sprint-protection or category coverage. Weaker
            // than W_SPRINT_MIDWEEK_BONUS — just tips ties.
            score -= W_SPRINT_OFFZONE;
          }

          // ── Sprint protection ──
          // Heavy penalty if picking sprint the day immediately after a
          // vo2/glyco conditioning session. Acts as a soft hard constraint.
          const isConsecutive = pos === st.lastCondDay + 1;
          const sprintBlocked = isConsecutive &&
            (st.lastCondCategory === 'vo2' || st.lastCondCategory === 'glycolytic');
          if (sprintBlocked && pickedCat === 'sprint') {
            score -= W_SPRINT_BLOCK;
          }
        } else {
          // In-season / Finals: legacy flavour-balance behaviour.
          const flavour = pickCondFlavour();
          const lowestCount = Math.min(...COND_FLAVOURS.map(f => st.condFlavours[f]));
          if (st.condFlavours[flavour] === lowestCount) score += W_COND_FLAVOUR;
        }
      }

      // ── S+C pairing rules ──
      // Combined days couple strength-region + conditioning-category. Some
      // pairings compound fatigue badly (heavy lower + glycolytic — hammers
      // legs twice), others complement each other (lower + aerobic base
      // flushes volume, upper + vo2 keeps the intense work off the legs).
      if (c === 'S+C' && useCategoryPlanner) {
        // Peek at what the picker would pair — we only know after we build
        // the S+C allocation, but pickCondCategory is side-effect-free so
        // we can ask it now using the slot's position.
        const pairedCat = pickCondCategory(pos);
        const scStrength = pickSCStrengthType(pos);
        const isLowerSC = isLower(scStrength) && scStrength !== 'FB';
        const isUpperSC = isUpper(scStrength);
        const isFullSC  = scStrength === 'FB';

        // Bad pairings
        if (isLowerSC && pairedCat === 'glycolytic') score -= W_SC_PAIRING_BAD;
        if (isLowerSC && pairedCat === 'sprint')     score -= W_SC_PAIRING_BAD;

        // Good pairings
        if (isLowerSC && pairedCat === 'aerobic_base') score += W_SC_PAIRING_GOOD;
        if (isUpperSC && pairedCat === 'vo2')          score += W_SC_PAIRING_GOOD;
        if (isFullSC  && pairedCat === 'glycolytic')   score += W_SC_PAIRING_GOOD;
      }

      return score;
    }

    // ── Build focus string for a candidate ──
    //
    // Pre-season + team days + core=3 (H-PRE-6): the FB slot is a LIGHTER
    // support session, not a third heavy anchor. Team training already
    // supplies field lower load, and the week's dedicated L + U carry
    // the main strength stress — FB only exists to cover any missing
    // sub-patterns and add movement balance. The focus string reflects
    // that explicitly so downstream prescription + athlete UI both
    // treat it as support rather than a hard exposure.
    function buildFocus(c: CandidateType, flavour?: CondFlavour, category?: CondCategory): string {
      const isFbSupport = isPreSeason && hasTeamDays && core === 3;
      switch (c) {
        case 'L-sq': return 'Lower body - squat emphasis (quad-dominant: squat, lunge, leg press; optional quad accessory: leg extension)';
        case 'L-hi': return 'Hip-dominant lower (RDL, hip thrust; optional hamstring accessory: nordic lower)';
        case 'U-pu': return 'Upper body - push emphasis (bench, OHP, dips)';
        case 'U-pl': return 'Upper body - pull emphasis (rows, pull-ups, face pulls)';
        case 'FB': return isFbSupport
          ? 'Full body support - light load, balance and movement-pattern coverage (not a heavy lower or upper day)'
          : 'Full body - moderate load, cover all movement patterns (1 squat/hinge + 1 push + 1 pull)';
        case 'L-co': return 'Lower body - combined squat + hinge (quad-dominant main + hip-dominant assistance in one session)';
        case 'U-co': return 'Upper body - combined push + pull (horizontal + vertical, balanced load)';
        case 'COND': {
          const fl = flavour || 'aerobic';
          if (category === 'aerobic_base' || (!category && fl === 'aerobic')) {
            return 'Conditioning - aerobic base / zone 2 (steady state, conversational pace)';
          }
          if (category === 'tempo' || (!category && fl === 'tempo')) {
            return 'Conditioning - tempo / controlled repeat efforts (6-7/10, worked but composed)';
          }
          if (category === 'vo2') {
            return 'Conditioning - VO2 / hard repeat efforts (8-9/10 intervals)';
          }
          if (category === 'glycolytic') {
            return 'Conditioning - high-intensity repeat efforts (8-9/10 intervals)';
          }
          if (category === 'sprint') {
            return 'Conditioning - sprint / speed exposure (quality reps, full recovery)';
          }
          return 'Conditioning - high intensity intervals (short, hard repeats with short rest)';
        }
        case 'S+C': {
          // Focus string is set by the strength component; conditioning is appended
          return ''; // placeholder — overridden below
        }
        case 'ACC': return 'Low-fatigue accessories - trunk, calves, groin, shoulder prehab';
        case 'REC': return 'Mobility, foam rolling, light movement';
        default: return '';
      }
    }

    // ── Map CandidateType → strengthPattern (off/pre-season) ──
    //
    // The single source of truth for "what movement pattern does this
    // strength session load". Populated at every strength-placement site
    // alongside `focus`, so invariants/analytics/UI can read the field
    // directly instead of parsing focus strings.
    //
    // Returns undefined for non-strength candidates (COND / S+C shell /
    // ACC / REC). S+C callers set strengthPattern based on the inner
    // strength subtype (see pickSCStrengthType consumers).
    function buildStrengthPattern(c: CandidateType):
      SessionAllocation['strengthPattern'] | undefined {
      switch (c) {
        case 'L-sq':
        case 'L-hi':
          return 'lower';
        case 'L-co':
          // L-co covers BOTH squat + hinge in one moderate-dose session;
          // mark it distinctly so consumers (H-PRE-7/8/9 invariant in
          // particular) can recognise that one combined slot ≈ two
          // dedicated single-pattern slots in pattern-coverage terms.
          return 'lower_combined';
        case 'U-pu':
          return 'push';
        case 'U-pl':
          return 'pull';
        case 'U-co':
          return 'upper_combined';
        case 'FB':
          return 'full_body';
        default:
          return undefined;
      }
    }

    // ── Conditioning label builder (S+C combined sessions) ────────────────
    //
    // Centralised so both the main-loop S+C placement and the H5a fallback
    // (which converts pure-strength sessions into S+C when the conditioning
    // floor is missed) produce identical text. The `useNonRunning` switch
    // is the "S+C fallback rule" Sam called out: lower-body strength paired
    // with sprint or glycolytic conditioning would compound running stress
    // on legs that just took a hard squat/hinge — bike / rower / ski erg
    // delivers the same energy-system stimulus with much lower soft-tissue
    // load. Upper days keep running-based conditioning (legs are fresh).
    // Aerobic and tempo flavours are low-impact enough that running stays.
    // 4A: labels are CATEGORY-driven so the athlete reads what the work
    // actually is. "tempo" no longer labels hard VO2 blocks.
    function buildCondLabel(
      flavour: CondFlavour,
      category: CondCategory,
      useNonRunning: boolean,
      attachedKind: AttachedConditioningKind = 'finisher',
    ): string {
      const noun = attachedKind === 'component' ? 'conditioning component' : 'finisher';
      if (category === 'aerobic_base') {
        return useNonRunning
          ? `easy off-feet aerobic ${noun} (bike steady or row/ski intervals, ${attachedKind === 'component' ? '20-30min' : '8-15min'})`
          : `aerobic base ${noun} (${attachedKind === 'component' ? '20-30min' : '8-15min'} zone 2)`;
      }
      if (category === 'tempo') {
        // 4B: TRUE tempo — controlled repeat efforts, 6-7/10, medium.
        return useNonRunning
          ? `tempo ${noun} (bike/row/ski, controlled repeat efforts 6-7/10, ${attachedKind === 'component' ? '20-30min' : '10-15min'})`
          : `tempo ${noun} (controlled repeat efforts 6-7/10, ${attachedKind === 'component' ? '20-30min' : '10-15min'})`;
      }
      if (category === 'sprint') {
        return useNonRunning
          ? `sprint ${noun} (bike/rower/ski erg, quality, ${attachedKind === 'component' ? '20-30min' : '≤15min'})`
          : `sprint ${noun} (quality, ${attachedKind === 'component' ? '20-30min' : '≤15min'})`;
      }
      if (category === 'vo2') {
        return useNonRunning
          ? `VO2 conditioning component (bike/rower hard repeat efforts, ${attachedKind === 'component' ? '20-30min' : '15min'})`
          : `VO2 conditioning component (hard repeat efforts, ${attachedKind === 'component' ? '20-30min' : '15min'})`;
      }
      // glycolytic
      return useNonRunning
        ? `${attachedKind === 'component' ? 'high-intensity conditioning component' : 'high-intensity finisher'} (bike/rower repeat efforts, ${attachedKind === 'component' ? '20-30min' : '15min'})`
        : `${attachedKind === 'component' ? 'high-intensity conditioning component' : 'high-intensity finisher'} (repeat efforts, ${attachedKind === 'component' ? '20-30min' : '15min'})`;
    }

    // ── Determine strength subtype for S+C ──
    // Position-aware: avoids picking a type that creates consecutive same-region.
    function pickSCStrengthType(currentPos?: number): CandidateType {
      // Peek at the conditioning category that would pair with this slot
      // so we can bias pattern selection toward non-lower for any work above
      // easy aerobic. Lower combined days use the shared easy-aerobic-only
      // law; choosing upper here avoids selecting tempo/hard work and then
      // immediately downgrading it. Only a tie-breaker — pattern coverage
      // and region spacing still win.
      const pairedCat = useCategoryPlanner
        ? pickCondCategory(currentPos)
        : null;
      const avoidLower = pairedCat !== null && pairedCat !== 'aerobic_base';

      // In structure mode: pick from the remaining queue items
      if (useStructureMode && strengthQueue.length > 0) {
        const available = [...new Set(strengthQueue)]
          .filter((candidate) => !blocksStrengthCandidateForGeneration(candidate));
        if (available.length === 0) return 'U-pl';
        // Sort: lowest pattern count first, then pairing bias, then region
        // spacing, then alternation. Pairing bias ranks ABOVE region spacing
        // because a bad sprint/glyco+lower pairing hammers the legs within
        // the same session, whereas consecutive-day same-region just
        // squeezes recovery — we'd rather accept tighter recovery than a
        // legs-twice single session.
        available.sort((a, b) => {
          const aCount = patternCount(a);
          const bCount = patternCount(b);
          if (aCount !== bCount) return aCount - bCount;

          // Category-aware pairing bias: when conditioning is above easy
          // aerobic, prefer non-lower strength patterns (upper / FB).
          if (avoidLower) {
            const aIsLower = isLower(a) && a !== 'FB';
            const bIsLower = isLower(b) && b !== 'FB';
            if (aIsLower !== bIsLower) return aIsLower ? 1 : -1;
          }

          // Region spacing: avoid consecutive same-region
          // If placing upper here and last was upper (gap < 2), penalize.
          // Same for lower. This prevents push→pull or squat→hinge clustering.
          if (currentPos !== undefined) {
            const aIsUpper = (a === 'U-pu' || a === 'U-pl');
            const aIsLower = (a === 'L-sq' || a === 'L-hi');
            const bIsUpper = (b === 'U-pu' || b === 'U-pl');
            const bIsLower = (b === 'L-sq' || b === 'L-hi');
            const aConsec = (aIsUpper && st.lastUpperDay >= 0 && currentPos - st.lastUpperDay < 2)
              || (aIsLower && st.lastLowerDay >= 0 && currentPos - st.lastLowerDay < 2);
            const bConsec = (bIsUpper && st.lastUpperDay >= 0 && currentPos - st.lastUpperDay < 2)
              || (bIsLower && st.lastLowerDay >= 0 && currentPos - st.lastLowerDay < 2);
            if (aConsec !== bConsec) return aConsec ? 1 : -1; // prefer non-consecutive
          }

          // Alternation preference
          const aAlt = isLower(a)
            ? (st.lastLowerSubtype !== null && st.lastLowerSubtype !== a)
            : (st.lastUpperSubtype !== null && st.lastUpperSubtype !== a);
          const bAlt = isLower(b)
            ? (st.lastLowerSubtype !== null && st.lastLowerSubtype !== b)
            : (st.lastUpperSubtype !== null && st.lastUpperSubtype !== b);
          if (aAlt !== bAlt) return aAlt ? -1 : 1;
          return 0; // No upper-over-lower bias in off-season
        });
        return available[0];
      }

      // Free-form fallback (core ≥ 5): original pattern-balance logic
      const patterns = ([
        {
          type: 'L-sq', count: st.sqCount,
          alternates: st.lastLowerSubtype !== null && st.lastLowerSubtype !== 'L-sq',
        },
        {
          type: 'L-hi', count: st.hiCount,
          alternates: st.lastLowerSubtype !== null && st.lastLowerSubtype !== 'L-hi',
        },
        {
          type: 'U-pu', count: st.puCount,
          alternates: st.lastUpperSubtype !== null && st.lastUpperSubtype !== 'U-pu',
        },
        {
          type: 'U-pl', count: st.plCount,
          alternates: st.lastUpperSubtype !== null && st.lastUpperSubtype !== 'U-pl',
        },
      ] as Array<{ type: CandidateType; count: number; alternates: boolean }>)
        .filter((candidate) => !blocksStrengthCandidateForGeneration(candidate.type));
      if (patterns.length === 0) return 'U-pl';
      patterns.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        if (a.alternates !== b.alternates) return a.alternates ? -1 : 1;
        return 0;
      });
      return patterns[0].type;
    }

    function placeStrengthCandidate(
      candidate: CandidateType,
      slot: { dayName: string; isTeamDay: boolean },
      pos: number,
      isConsecutiveDay: boolean,
    ): void {
      const strengthStress = candidateStress(candidate, pos, slot.isTeamDay);
      plan.push({
        tier: 'core',
        focus: buildFocus(candidate),
        dayOfWeek: slot.dayName,
        isHardExposure: true,
        strengthPattern: buildStrengthPattern(candidate),
        stressLevel: strengthStress,
      });
      st.coreStrengthCount++;
      // Pattern counts
      if (candidate === 'L-sq') st.sqCount++;
      if (candidate === 'L-hi') st.hiCount++;
      if (candidate === 'U-pu') st.puCount++;
      if (candidate === 'U-pl') st.plCount++;
      if (candidate === 'L-co') {
        // Combined lower covers both lower sub-patterns at moderate dose.
        st.sqCount += 0.5; st.hiCount += 0.5;
      }
      if (candidate === 'U-co') {
        // Combined upper covers both upper sub-patterns at moderate dose.
        st.puCount += 0.5; st.plCount += 0.5;
      }
      if (candidate === 'FB') {
        // FB partially covers all patterns
        st.sqCount += 0.5; st.hiCount += 0.5;
        st.puCount += 0.5; st.plCount += 0.5;
        st.fbCount++;
        // FB updates upper tracking but NOT lastLowerDay —
        // FB is moderate load and should not block next-day dedicated lower via H3
        st.upperCount++;
        st.lastUpperDay = pos;
        st.lowerCount++;
      } else if (isLower(candidate)) {
        // L-sq / L-hi / L-co — all load the lower chain and count for H3.
        st.lowerCount++;
        st.lastLowerDay = pos;
        st.lastLowerSubtype = candidate;
      } else if (isUpper(candidate)) {
        // U-pu / U-pl / U-co — all load the upper chain.
        st.upperCount++;
        st.lastUpperDay = pos;
        st.lastUpperSubtype = candidate;
      }
      st.lastCoreSubtype = candidate;
      updateStressStreak(strengthStress, isConsecutiveDay);
    }

    // ── Main scoring loop ──
    for (let slotIdx = 0; slotIdx < daySlots.length; slotIdx++) {
      const slot = daySlots[slotIdx];
      let bestCandidate: CandidateType = 'REC';
      let bestScore = -Infinity;
      let bestSCStrength: CandidateType | undefined;

      // ── Queue completion enforcement ──
      // If remaining slots == remaining queue items, every remaining slot
      // MUST place a strength session. Override rest slots and soft preferences.
      const slotsRemaining = daySlots.length - slotIdx;
      const safeStrengthQueue = strengthQueue.filter((candidate) =>
        !blocksStrengthCandidateForGeneration(candidate),
      );
      const queueMustComplete = useStructureMode && safeStrengthQueue.length > 0
        && safeStrengthQueue.length >= slotsRemaining;

      // Build candidate list: in structure mode, limit strength to queue items.
      // Rest slots only allow COND/ACC/REC — UNLESS queue completion is forced.
      const isRestSlot = restSlotIndices.has(slotIdx) && !queueMustComplete;
      let slotCandidates: CandidateType[];

      if (isRestSlot) {
        // Rest/conditioning slot — no strength allowed
        slotCandidates = useSixDaySpreadRhythm ? ['REC', 'ACC'] : ['COND', 'ACC', 'REC'];
      } else if (useStructureMode) {
        const uniqueStrength = [...new Set(safeStrengthQueue)] as CandidateType[];
        if (queueMustComplete) {
          // Must place strength — only strength candidates + S+C
          slotCandidates = [
            ...uniqueStrength,
            ...(uniqueStrength.length > 0 ? ['S+C' as CandidateType] : []),
          ];
        } else {
          slotCandidates = [
            ...uniqueStrength,
            'COND',
            ...(uniqueStrength.length > 0 ? ['S+C' as CandidateType] : []),
            'ACC', 'REC',
          ];
        }
      } else {
        slotCandidates = [...ALL_CANDIDATES];
      }

      if (useSixDaySpreadRhythm && slotIdx < 3 && !slot.isTeamDay) {
        const trainingCandidates = slotCandidates.filter((candidate) =>
          candidate !== 'REC' && candidate !== 'ACC'
        );
        slotCandidates = trainingCandidates.length > 0 ? trainingCandidates : ['COND'];
      }

      for (const candidate of slotCandidates) {
        if (candidate === 'S+C' && avoidCombinedDays) continue;
        // In queue-must-complete mode, relax H3 (lower spacing) to avoid
        // dropping required movements. H1 (3+ consecutive) and H2 (same
        // subtype spacing) still enforced — they protect against injury.
        if (queueMustComplete) {
          // Only enforce H1, H2, H6 — skip H3.
          // Pre-season team-day guards (H-PRE-1/2) are ALWAYS enforced, even
          // in queue-must-complete mode: stacking team + lower or team + S+C
          // is the exact failure mode Sam called out.
          const pos2 = trainingOrder(slot.num);
          const isConsec = pos2 === st.prevSlotDayNum + 1;
          const onTeamDay2 = isPreSeason && teamDayNumSet.has(slot.num);
          // H-GAME: pre-game protection is ALWAYS enforced, even in
          // queue-must-complete mode — never force a required movement
          // into the G-1/G-2 window; move it or drop it instead.
          if (violatesGameProximity(candidate, slot.num)) continue;
          if (blocksStrengthCandidateForGeneration(candidate)) continue;
          // H-PRE-1: no conditioning on team day
          if (onTeamDay2 && (candidate === 'COND' || candidate === 'S+C')) continue;
          // H-PRE-2 / H-TEAM-LOWER: no heavy lower on team day — ANY phase
          // (Option B guardrail). Includes L-co (combined lower still fully
          // loads both squat and hinge tissue).
          if (teamDayNumSet.has(slot.num) && isHeavyLower(candidate)) continue;
          // H-PRE-4: no FB stacking on team day at core ≥ 3
          if (onTeamDay2 && candidate === 'FB' && core >= 3) continue;
          // H6: budget
          if (isStrength(candidate) && candidate !== 'COND') {
            if (st.coreStrengthCount + 1 > core) continue;
          }
          // H1: 3+ consecutive HIGH-stress days (stress-aware, B2)
          if (candidateStress(candidate, pos2, slot.isTeamDay) === 'high') {
            const run = isConsec && st.prevSlotWasCore
              ? st.consecutiveCoreCalendarDays + 1 : 1;
            if (run >= 3) continue;
          }
          // H-PRE-11 (graded): sandwiched between two team days — hinge/
          // hard-cond/sprint banned in any phase; pre-season bans all high
          // stress except controlled FB at core ≤ 2.
          {
            const prevD = (slot.num + 6) % 7;
            const nextD = (slot.num + 1) % 7;
            if (teamDayNumSet.has(prevD) && teamDayNumSet.has(nextD)) {
              if (candidate === 'L-hi' || candidate === 'L-co') continue;
              if ((candidate === 'COND' || candidate === 'S+C') && pickCondCategory(pos2) !== 'aerobic_base') continue;
              if (candidate === 'S+C' && isLower(pickSCStrengthType(pos2))) continue;
              if (isPreSeason && candidateStress(candidate, pos2, slot.isTeamDay) === 'high' &&
                  !(candidate === 'FB' && core <= 2)) continue;
            }
          }
          // H2: same lower subtype spacing
          if ((candidate === 'L-sq' || candidate === 'L-hi') && st.lastLowerSubtype === candidate) {
            if (st.lastLowerDay >= 0 && pos2 - st.lastLowerDay < 3) continue;
          }
          if (candidate === 'ACC' || candidate === 'REC') continue;
          if (candidate === 'S+C') {
            const scType = pickSCStrengthType(pos2);
            if (blocksStrengthCandidateForGeneration(scType)) continue;
            // Check H6 and H1 for S+C
            if (st.coreStrengthCount + 1 > core) continue;
            // H1 stress-aware (B2): only high-stress S+C extends the run.
            if (candidateStress('S+C', pos2, slot.isTeamDay) === 'high') {
              const run = isConsec && st.prevSlotWasCore
                ? st.consecutiveCoreCalendarDays + 1 : 1;
              if (run >= 3) continue;
            }
            // Pre-season adjacency: skip S+C if picker would pair with sprint
            if (isPreSeason && isAdjacentToTeamDay(pos2)) {
              const wouldPickCat = pickCondCategory(pos2);
              if (wouldPickCat === 'sprint') continue;
            }
          }
        } else {
          if (violatesHard(candidate, slot.num)) continue;
        }

        // For S+C, also check hard constraints on the strength component and
        // skip the candidate when the only safe finisher would be filler.
        let scStrength: CandidateType | undefined;
        if (candidate === 'S+C') {
          const slotPos = trainingOrder(slot.num);
          scStrength = pickSCStrengthType(slotPos);
          if (blocksStrengthCandidateForGeneration(scStrength)) continue;
          if (!queueMustComplete && violatesHard(scStrength, slot.num)) continue;
          // H-GAME on the strength half applies in EVERY mode (a lower
          // strength component on G-2 is still a hard lower session).
          if (queueMustComplete && violatesGameProximity(scStrength, slot.num)) continue;
          const attachDecision = shouldAttachBestFinisher({
            dayNum: slot.num,
            slotPos,
            strengthContext: strengthContextOf(scStrength),
          });
          if (!attachDecision.attach) continue;
        }
        if (candidate === 'COND') {
          const slotPos = trainingOrder(slot.num);
          const condDecision = pickStandaloneCondDecision({
            dayNum: slot.num,
            slotPos,
          });
          if (!condDecision.place) continue;
        }

        const score = scoreCandidate(candidate, slot, slotIdx);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          if (candidate === 'S+C') bestSCStrength = scStrength;
        }
      }

      // ── Build allocation from winner ──
      const pos = trainingOrder(slot.num);
      const isConsecutiveDay = pos === st.prevSlotDayNum + 1;

      if (bestCandidate === 'S+C' && bestSCStrength) {
        // Combined day: strength + conditioning — the finisher half passes
        // the shared eligibility law (4A). Lower/hinge days downgrade to
        // easy off-feet aerobic; hard finishers need readiness + headroom.
        const decision = shouldAttachBestFinisher({
          dayNum: slot.num,
          slotPos: pos,
          strengthContext: strengthContextOf(bestSCStrength),
        });
        if (!decision.attach) {
          // Defensive fallback. Candidate selection already filters these
          // out, but never convert a denied/skipped finisher into filler.
          placeStrengthCandidate(bestSCStrength, slot, pos, isConsecutiveDay);
        } else {
          const category = decision.category;
          // Flavour is DERIVED from the final category (single source) so
          // flavour/category/label/stress always agree — no more "tempo"
          // wrapping a hard VO2 block.
          const flavour = categoryToFlavour(category);
          const strengthFocus = buildFocus(bestSCStrength);
          // Lower-body S+C always prefers off-feet modality (bike / rower /
          // ski erg) — even the easy finisher spares the legs.
          const lowerStrengthSC = isLower(bestSCStrength);
          const conditioningProps = conditioningPolicyProps(category);
          const useNonRunning = lowerStrengthSC || conditioningProps.conditioningOffFeet === true;
          const attachedKind = decision.attachedKind;
          const condLabel = buildCondLabel(flavour, category, useNonRunning, attachedKind);
          const scStress = classifyGenerationSession({
            focus: strengthFocus,
            tier: 'core',
            isTeamDay: slot.isTeamDay,
            strengthPattern: buildStrengthPattern(bestSCStrength),
            hasCombinedConditioning: true,
            attachedConditioningKind: attachedKind,
            conditioningFlavour: flavour,
            conditioningCategory: category,
          }, classificationContext).stressLevel ?? 'low';

          plan.push({
            tier: 'core',
            focus: `${strengthFocus} + ${condLabel}`,
            dayOfWeek: slot.dayName,
            isHardExposure: true,
            hasCombinedConditioning: true,
            attachedConditioningKind: attachedKind,
            conditioningFlavour: flavour,
            conditioningCategory: category,
            ...conditioningProps,
            strengthPattern: buildStrengthPattern(bestSCStrength),
            stressLevel: scStress,
          });

          // Update state for BOTH strength and conditioning
          st.coreStrengthCount++;
          st.condCount += attachedConditioningCredit(attachedKind);
          st.condFlavours[flavour]++;
          st.condCategories[category]++;
          // Pattern count for the strength component
          if (bestSCStrength === 'L-sq') st.sqCount++;
          if (bestSCStrength === 'L-hi') st.hiCount++;
          if (bestSCStrength === 'U-pu') st.puCount++;
          if (bestSCStrength === 'U-pl') st.plCount++;
          if (isLower(bestSCStrength)) {
            st.lowerCount++;
            st.lastLowerDay = pos;
            st.lastLowerSubtype = bestSCStrength;
          }
          if (isUpper(bestSCStrength)) {
            st.upperCount++;
            st.lastUpperDay = pos;
            st.lastUpperSubtype = bestSCStrength;
          }
          st.lastCondDay = pos;
          st.lastCondCategory = category;
          st.lastCoreSubtype = bestSCStrength;
          updateStressStreak(scStress, isConsecutiveDay);
        }

      } else if (bestCandidate === 'COND') {
        // Standalone conditioning also passes the shared eligibility law
        // (4A) — same rules, 'standalone' strength context.
        const condDecision = pickStandaloneCondDecision({
          dayNum: slot.num,
          slotPos: pos,
        });
        if (!condDecision.place) {
          plan.push({
            tier: 'recovery',
            focus: 'Mobility, foam rolling, light movement',
            dayOfWeek: slot.dayName,
            isHardExposure: false,
            stressLevel: 'low',
          });
          st.recCount++;
          updateStressStreak('low', isConsecutiveDay);
          st.prevSlotDayNum = pos;
          continue;
        }
        const category = condDecision.category;
        const flavour = categoryToFlavour(category);
        // Rest-slot conditioning is optional — breaks up core streaks and
        // gives the athlete flexibility. Early off-season aerobic work is also
        // support rather than compulsory volume.
        const condTier = isRestSlot || offseasonPolicy?.subphase === 'early_offseason'
          ? 'optional'
          : 'core';
        // 4B standalone tempo modality: off-feet first unless the week
        // genuinely supports quality running tempo (pre-season only).
        const tempoOffFeet = category === 'tempo' &&
          standaloneTempoOffFeet(condDecision.offFeetOnly === true);
        const condFocus = category === 'tempo'
          ? buildFocus('COND', flavour, category) + (tempoOffFeet
              ? ' — off-feet (bike/row/ski)'
              : ' — running-based OK this week')
          : buildFocus('COND', flavour, category);
        const condStress = classifyGenerationSession({
          focus: condFocus,
          tier: condTier as SessionTier,
          isTeamDay: slot.isTeamDay,
          conditioningFlavour: flavour,
          conditioningCategory: category,
        }, classificationContext).stressLevel ?? 'low';
        plan.push({
          tier: condTier as SessionTier,
          focus: condFocus,
          dayOfWeek: slot.dayName,
          isHardExposure: condTier === 'core' && flavour === 'high-intensity',
          conditioningFlavour: flavour,
          conditioningCategory: category,
          ...conditioningPolicyProps(category),
          ...(category === 'tempo' ? { conditioningOffFeet: tempoOffFeet } : {}),
          stressLevel: condStress,
        });
        st.condCount += 1.0;
        st.condFlavours[flavour]++;
        st.condCategories[category]++;
        st.lastCondDay = pos;
        st.lastCondCategory = category;
        // B2: hard conditioning EXTENDS the high-stress run (it no longer
        // "breaks core strength runs" — a hard interval day is a hard day);
        // easy aerobic still resets it.
        updateStressStreak(condStress, isConsecutiveDay);

      } else if (STRENGTH_CANDIDATES.includes(bestCandidate)) {
        placeStrengthCandidate(bestCandidate, slot, pos, isConsecutiveDay);

      } else if (bestCandidate === 'ACC') {
        const accessoryStress = candidateStress('ACC', pos, slot.isTeamDay);
        plan.push({
          tier: 'optional',
          focus: buildFocus('ACC'),
          dayOfWeek: slot.dayName,
          isHardExposure: false,
          stressLevel: accessoryStress,
        });
        st.optCount++;
        updateStressStreak(accessoryStress, isConsecutiveDay);

      } else {
        // REC or fallback
        const recoveryStress = candidateStress('REC', pos, slot.isTeamDay);
        plan.push({
          tier: 'recovery',
          focus: buildFocus('REC'),
          dayOfWeek: slot.dayName,
          isHardExposure: false,
          stressLevel: recoveryStress,
        });
        st.recCount++;
        updateStressStreak(recoveryStress, isConsecutiveDay);
      }

      // ── Update structure queue: remove placed strength type ──
      if (useStructureMode) {
        const placedStrength: CandidateType | null =
          bestCandidate === 'S+C' ? (bestSCStrength || null) :
          STRENGTH_CANDIDATES.includes(bestCandidate) ? bestCandidate : null;
        if (placedStrength) {
          const qIdx = strengthQueue.indexOf(placedStrength);
          if (qIdx >= 0) strengthQueue.splice(qIdx, 1);
        }
      }

      st.prevSlotDayNum = pos;
    }

    // ── Post-validation: H5a — minimum conditioning via S+C conversion ──
    // If conditioning is below the absolute floor (2 exposures), convert
    // pure-strength sessions to S+C combined days. This is the safety net:
    // the scorer should handle this in-loop, but if it doesn't, we enforce here.
    if (st.condCount < MIN_COND_FLOOR && !avoidCombinedDays) {
      // Find pure-strength sessions that can become S+C (no existing conditioning)
      const convertible = plan
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.tier === 'core' && s.isHardExposure
          && !s.hasCombinedConditioning && !s.conditioningFlavour)
        // PRE-SEASON GUARD (H-PRE-1): never attach a conditioning finisher
        // to a TEAM TRAINING day — the field session already is that day's
        // conditioning. (Newly reachable since B4 places upper strength on
        // team days, making them "convertible" cores.)
        .filter(({ s }) => {
          if (!isPreSeason) return true;
          const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
          return dayNum < 0 || !teamDayNumSet.has(dayNum);
        })
        // H-GAME GUARD: never attach a conditioning finisher to a session
        // sitting on game day, G-1, or G-2 — this conversion path bypasses
        // violatesHard(), and a vo2/sprint finisher on a G-2 upper session
        // would put hard conditioning inside the 48h pre-game window.
        .filter(({ s }) => {
          if (!inputs.hasGame || gameDayNum === null) return true;
          const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
          if (dayNum < 0) return true;
          const off = gOffset(dayNum, gameDayNum);
          return off !== 0 && off !== -1 && off !== -2;
        })
        .sort((a, b) => {
          if (offseasonPolicy?.conditioning.allowedCategories.includes('tempo')) {
            const aUpper = strengthContextOf(a.s.strengthPattern) === 'upper' ? 0 : 1;
            const bUpper = strengthContextOf(b.s.strengthPattern) === 'upper' ? 0 : 1;
            if (aUpper !== bUpper) return aUpper - bUpper;
          }
          return b.i - a.i; // otherwise prefer later-in-week sessions
        });

      for (const { s, i } of convertible) {
        if (st.condCount >= MIN_COND_FLOOR) break;
        const slotPos = i < daySlots.length ? trainingOrder(daySlots[i].num) : undefined;
        // 4A: the H5a conversion passes the SAME shared eligibility law as
        // every other finisher path — lower/hinge days get easy off-feet
        // aerobic only; hard finishers need readiness + weekly headroom;
        // team-adjacent and game-window days stay protected.
        const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
        const decision = shouldAttachBestFinisher({
          dayNum,
          slotPos,
          strengthContext: strengthContextOf(s.strengthPattern),
        });
        if (!decision.attach) continue;
        const category = decision.category;
        const flavour = categoryToFlavour(category);
        // Lower-body sessions always take the off-feet modality — even
        // the easy finisher spares legs that just squatted/hinged.
        const lowerStrengthSC =
          s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined' ||
          s.strengthPattern === 'full_body';
        const conditioningProps = conditioningPolicyProps(category);
        const useNonRunning = lowerStrengthSC || conditioningProps.conditioningOffFeet === true;
        const attachedKind = decision.attachedKind;
        const condLabel = buildCondLabel(flavour, category, useNonRunning, attachedKind);
        plan[i] = {
          ...s,
          focus: `${s.focus} + ${condLabel}`,
          hasCombinedConditioning: true,
          attachedConditioningKind: attachedKind,
          conditioningFlavour: flavour,
          conditioningCategory: category,
          ...conditioningProps,
        };
        st.condCount += attachedConditioningCredit(attachedKind);
        st.condFlavours[flavour]++;
        st.condCategories[category]++;
        if (slotPos !== undefined) {
          st.lastCondDay = slotPos;
          st.lastCondCategory = category;
        }
      }
    }

    // ── Post-validation: H5b — promote ACC/REC to standalone conditioning ──
    // Subphase-aware phases use their capped app-conditioning target. Legacy
    // phases retain the established promotion floor of 3.
    const standalonePromotionTarget = preseasonPolicy
      ? Math.min(3, condTarget)
      : offseasonPolicy?.subphase === 'early_offseason'
        ? condTarget
        : 3;
    if (st.condCount < standalonePromotionTarget) {
      const promotable = plan
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.tier === 'optional' || s.tier === 'recovery')
        // PRE-SEASON GUARD (H-PRE-1): never promote a team training day into
        // a standalone conditioning session. Team training already IS the
        // field-load exposure for that day.
        .filter(({ s }) => {
          if (!isPreSeason) return true;
          const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
          return dayNum < 0 || !teamDayNumSet.has(dayNum);
        })
        // H-GAME GUARD: never promote a game-day / G-1 / G-2 slot into
        // standalone conditioning. This path bypasses violatesHard(), so
        // without it a G-1 recovery slot could become a conditioning
        // session right after H-GAME cleared the day (found live, S11).
        .filter(({ s }) => {
          if (!inputs.hasGame || gameDayNum === null) return true;
          const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
          if (dayNum < 0) return true;
          const off = gOffset(dayNum, gameDayNum);
          return off !== 0 && off !== -1 && off !== -2;
        })
        .sort((a, b) => {
          if (a.s.tier !== b.s.tier) return a.s.tier === 'optional' ? -1 : 1;
          return 0;
        });

      // Sort by plan index ascending so chronological sprint-protection applies.
      promotable.sort((a, b) => a.i - b.i);
      // Recompute lastCondDay / lastCondCategory from current plan so the
      // picker's sprint-protection sees the real chronological predecessor,
      // not whichever slot happened to be processed last in H5a.
      let lastCondPos = -99;
      let lastCondCat: CondCategory | null = null;
      for (let k = 0; k < plan.length; k++) {
        if (plan[k].conditioningCategory && k < daySlots.length) {
          const p = trainingOrder(daySlots[k].num);
          if (p > lastCondPos) {
            lastCondPos = p;
            lastCondCat = plan[k].conditioningCategory as CondCategory;
          }
        }
      }

      for (const { i } of promotable) {
        if (st.condCount >= standalonePromotionTarget) break;
        const slotPos = i < daySlots.length ? trainingOrder(daySlots[i].num) : undefined;
        // Reset state for this promotion: compute predecessor cat/day based on
        // chronologically previous conditioning placement.
        let predCat: CondCategory | null = null;
        let predDay = -99;
        for (let k = 0; k < i; k++) {
          if (plan[k].conditioningCategory && k < daySlots.length) {
            predDay = trainingOrder(daySlots[k].num);
            predCat = plan[k].conditioningCategory as CondCategory;
          }
        }
        const prevLastCondDay = st.lastCondDay;
        const prevLastCondCategory = st.lastCondCategory;
        st.lastCondDay = predDay;
        st.lastCondCategory = predCat;

        // 4A: promotions pass the shared eligibility law ('standalone'
        // context) — no hard work adjacent to team days or inside the
        // game window; readiness/headroom gate vo2/glyco.
        const promoDayNum = plan[i].dayOfWeek ? dayNameToNumber(plan[i].dayOfWeek!) : -1;
        const decision = pickStandaloneCondDecision({
          dayNum: promoDayNum,
          slotPos,
        });
        if (!decision.place) {
          st.lastCondDay = prevLastCondDay;
          st.lastCondCategory = prevLastCondCategory;
          continue;
        }
        const category = decision.category;
        const flavour = categoryToFlavour(category);
        // 4B: promoted standalone tempo follows the same modality law.
        const promoTempoOffFeet = category === 'tempo' &&
          standaloneTempoOffFeet(decision.offFeetOnly === true);
        const promoFocus = category === 'tempo'
          ? buildFocus('COND', flavour, category) + (promoTempoOffFeet
              ? ' — off-feet (bike/row/ski)'
              : ' — running-based OK this week')
          : buildFocus('COND', flavour, category);
        const promoTier: SessionTier =
          offseasonPolicy?.subphase === 'early_offseason' ||
          preseasonSubphase === 'early_preseason'
          ? 'optional'
          : 'core';
        const promoStress = classifyGenerationSession({
          focus: promoFocus,
          tier: promoTier,
          conditioningFlavour: flavour,
          conditioningCategory: category,
        }, classificationContext).stressLevel ?? 'low';
        plan[i] = {
          tier: promoTier,
          focus: promoFocus,
          dayOfWeek: plan[i].dayOfWeek,
          isHardExposure: flavour === 'high-intensity',
          conditioningFlavour: flavour,
          conditioningCategory: category,
          ...conditioningPolicyProps(category),
          ...(category === 'tempo' ? { conditioningOffFeet: promoTempoOffFeet } : {}),
          stressLevel: promoStress,
        };
        st.condCount += 1.0;
        st.condFlavours[flavour]++;
        st.condCategories[category]++;

        // Restore / update state. Use the max chronological slot seen.
        if (slotPos !== undefined && slotPos > prevLastCondDay) {
          st.lastCondDay = slotPos;
          st.lastCondCategory = category;
        } else {
          st.lastCondDay = prevLastCondDay;
          st.lastCondCategory = prevLastCondCategory;
        }
      }
      void lastCondPos; void lastCondCat; // silence unused
    }

    // ── Post-validation: off-season 4-day exposure preservation ──
    // Components count as full conditioning exposures, but they must not make
    // the engine drop useful easy lower flushes. If a no-team off-season week
    // still has pure strength days and room under the steady-finisher cap,
    // add only easy aerobic finishers until conditioning exposure count
    // matches the strength-day count. This preserves useful exposure without
    // converting duplicate filler into hidden hard work.
    if (inputs.seasonPhase === 'Off-season' && teamDayNumSet.size === 0 && core >= 4) {
      const targetAttachedExposureCount = Math.min(core, condTarget);
      const currentAttachedExposureCount = () =>
        plan.filter((s) => !!s.conditioningCategory || !!s.hasCombinedConditioning).length;
      const pureStrength = plan
        .map((s, i) => ({ s, i }))
        .filter(({ s }) =>
          s.tier === 'core' &&
          !!s.strengthPattern &&
          !s.hasCombinedConditioning &&
          !s.conditioningFlavour &&
          !s.conditioningCategory
        )
        .sort((a, b) => {
          const aLower = strengthContextOf(a.s.strengthPattern) !== 'upper' ? 0 : 1;
          const bLower = strengthContextOf(b.s.strengthPattern) !== 'upper' ? 0 : 1;
          if (aLower !== bLower) return aLower - bLower;
          const aDay = a.s.dayOfWeek ? dayNameToNumber(a.s.dayOfWeek) : 99;
          const bDay = b.s.dayOfWeek ? dayNameToNumber(b.s.dayOfWeek) : 99;
          return aDay - bDay;
        });

      for (const { s } of pureStrength) {
        if (currentAttachedExposureCount() >= targetAttachedExposureCount) break;
        const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
        if (dayNum < 0) continue;
        const slotPos = trainingOrder(dayNum);
        const decision = shouldAttachFinisher({
          dayNum,
          requestedCategory: 'aerobic_base',
          strengthContext: strengthContextOf(s.strengthPattern),
        });
        if (!decision.attach) continue;
        const category = decision.category;
        const flavour = categoryToFlavour(category);
        const attachedKind = decision.attachedKind;
        const lowerStrengthSC =
          s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined' ||
          s.strengthPattern === 'full_body';
        const conditioningProps = conditioningPolicyProps(category);
        const useNonRunning = lowerStrengthSC || conditioningProps.conditioningOffFeet === true;
        s.focus = `${s.focus} + ${buildCondLabel(flavour, category, useNonRunning, attachedKind)}`;
        s.hasCombinedConditioning = true;
        s.attachedConditioningKind = attachedKind;
        s.conditioningFlavour = flavour;
        s.conditioningCategory = category;
        Object.assign(s, conditioningProps);
        st.condCount += attachedConditioningCredit(attachedKind);
        st.condFlavours[flavour]++;
        st.condCategories[category]++;
        st.lastCondDay = slotPos;
        st.lastCondCategory = category;
      }
    }

    // ── Post-validation: sprint-rescue ──
    // Pre-season no-game weeks may need an explicit standalone sprint
    // exposure. If the main loop plus H5a/H5b left sprint uncovered,
    // retrofit it using Sam's fallback chain:
    //   1. Slide earlier — pick the EARLIEST conditioning slot whose
    //      chronological predecessor (if any) isn't vo2/glycolytic, and
    //      swap its category to sprint.
    //   2. Reduce volume — if every candidate slot is adjacent to a
    //      vo2/glyco day, still pick the earliest but mark the variant as
    //      'reduced' so the builder produces ~50% volume.
    //   3. Micro-dose — if the slot has no room at all (e.g. standalone
    //      conditioning with a blocking predecessor), convert it to a
    //      3–4×10s flying-sprint micro-dose that's low enough volume to
    //      ignore sprint-protection safely.
    // In off-season or team/game-loaded weeks, the exposure gate below
    // drops sprint honestly rather than hiding it inside a finisher.
    if (useCategoryPlanner &&
        !plan.some((session) => session.conditioningCategory === 'sprint' || session.speedWorkKind === 'true_speed') &&
        sprintExposureGate(0).allowStandaloneSprint) {
      // Gather conditioning slots in chronological order. Use the original
      // slot positions (daySlots index == plan index at this point because
      // the sort-by-day happens later, below).
      type CondSlot = {
        planIdx: number;
        slotPos: number;
        prevCat: CondCategory | null;
        prevPos: number;
      };
      const condSlots: CondSlot[] = [];
      for (let i = 0; i < plan.length; i++) {
        const s = plan[i];
        if (!s.conditioningCategory) continue;
        if (i >= daySlots.length) continue;
        const slotPos = trainingOrder(daySlots[i].num);
        // Find chronologically-preceding conditioning slot.
        let prevCat: CondCategory | null = null;
        let prevPos = -99;
        for (const c of condSlots) {
          if (c.slotPos < slotPos && c.slotPos > prevPos) {
            prevPos = c.slotPos;
            prevCat = plan[c.planIdx].conditioningCategory as CondCategory;
          }
        }
        condSlots.push({ planIdx: i, slotPos, prevCat, prevPos });
      }

      // 4A: the rescue passes the shared eligibility law like every other
      // path, with two extra v1 rules:
      //   • it may only retarget STANDALONE conditioning slots — sprint is
      //     never hidden inside a strength-day finisher;
      //   • if no slot passes (off-season with no late-block model, any
      //     week where team training/games already provide sprint
      //     exposure, readiness below high), sprint is dropped HONESTLY
      //     for the week rather than forced somewhere unsafe.
      const rescueEligible = condSlots.filter(cs => {
        if (plan[cs.planIdx].hasCombinedConditioning) return false; // finishers are off-limits
        const dayNum = cs.slotPos === 7 ? 0 : cs.slotPos;
        const decision = finisherEligibility({
          dayNum,
          requestedCategory: 'sprint',
          strengthContext: 'standalone',
        });
        return decision.allow && decision.category === 'sprint';
      });

      const attachPreLiftSpeedMicroDose = (): boolean => {
        const ordered = plan
          .map((session, index) => ({ session, index }))
          .filter(({ session }) => {
            if (!session.dayOfWeek) return false;
            if (session.isTeamDay) return false;
            if (session.speedWorkKind) return false;
            if (session.strengthPattern !== 'push' &&
                session.strengthPattern !== 'pull' &&
                session.strengthPattern !== 'upper_combined') {
              return false;
            }

            const dayNum = dayNameToNumber(session.dayOfWeek);
            if (dayNum < 0) return false;
            if (teamDayNumSet.has(dayNum)) return false;
            const prevD = (dayNum + 6) % 7;
            const nextD = (dayNum + 1) % 7;
            if (teamDayNumSet.has(prevD) || teamDayNumSet.has(nextD)) return false;
            if (isGameWeek && gameDayNum !== null) {
              const offset = gOffset(dayNum, gameDayNum);
              if (offset === 0 || offset === -1 || offset === -2) return false;
            }
            const previousSession = plan.find((other) =>
              other.dayOfWeek && dayNameToNumber(other.dayOfWeek) === prevD);
            if (previousSession?.strengthPattern === 'lower' ||
                previousSession?.strengthPattern === 'lower_combined' ||
                previousSession?.strengthPattern === 'full_body') {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            const da = dayNameToNumber(a.session.dayOfWeek ?? '');
            const db = dayNameToNumber(b.session.dayOfWeek ?? '');
            return trainingOrder(da) - trainingOrder(db) || a.index - b.index;
          });

        const target = ordered[0]?.session;
        if (!target) return false;
        const previousCategory = target.conditioningCategory as CondCategory | undefined;
        if (previousCategory && st.condCategories[previousCategory] > 0) {
          st.condCategories[previousCategory]--;
        }
        if (target.conditioningFlavour && st.condFlavours[target.conditioningFlavour as CondFlavour] > 0) {
          st.condFlavours[target.conditioningFlavour as CondFlavour]--;
        }
        if (target.hasCombinedConditioning) {
          st.condCount = Math.max(
            0,
            st.condCount - attachedConditioningCredit(target.attachedConditioningKind ?? 'finisher'),
          );
        }
        const strengthFocus = target.focus.split(' + ')[0] || target.focus;
        target.hasCombinedConditioning = false;
        target.attachedConditioningKind = undefined;
        target.conditioningFlavour = undefined;
        target.conditioningCategory = undefined;
        target.conditioningVariant = undefined;
        target.conditioningFeel = undefined;
        target.conditioningOffFeet = undefined;
        target.ergModality = undefined;
        target.speedWorkKind = 'true_speed';
        target.speedPlacement = 'pre_lift';
        const speedBlock = createSpeedTopUpBlock('pre_lift', inputs, offseasonSubphase);
        target.speedBlock = speedBlock;
        target.isHardExposure = true;
        target.stressLevel = 'high';
        target.focus = `${speedBlock.title} + ${strengthFocus}`;
        st.condCategories.sprint++;
        return true;
      };

      if (rescueEligible.length > 0) {
        // SP-2: every app-added pre-season sprint top-up is a tiny
        // true-speed micro-dose. We still prefer the first slot that is
        // not chronologically glued to vo2/glycolytic work, but we no
        // longer upgrade the dose into "reduced sprint conditioning".
        const chosen = rescueEligible.find(cs => {
          const adjacent = cs.slotPos === cs.prevPos + 1;
          const blocking = cs.prevCat === 'vo2' || cs.prevCat === 'glycolytic';
          return !(adjacent && blocking);
        }) ?? rescueEligible[0];
        const variant: 'micro_dose' = 'micro_dose';

        const target = plan[chosen.planIdx];
        const prevCat = target.conditioningCategory as CondCategory;
        // Convert: decrement previous cat, increment sprint.
        if (prevCat && st.condCategories[prevCat] > 0) {
          st.condCategories[prevCat]--;
        }
        st.condCategories.sprint++;
        target.conditioningCategory = 'sprint';
        // Sprint is always high-intensity flavour; keep flavour in sync.
        if (target.conditioningFlavour && target.conditioningFlavour !== 'high-intensity') {
          // Adjust flavour counts
          const fprev = target.conditioningFlavour as CondFlavour;
          if (st.condFlavours[fprev] > 0) st.condFlavours[fprev]--;
          st.condFlavours['high-intensity']++;
          target.conditioningFlavour = 'high-intensity';
        }
        target.conditioningVariant = variant;
        target.speedWorkKind = 'true_speed';
        target.speedPlacement = 'standalone';
        const speedBlock = createSpeedTopUpBlock('standalone', inputs, offseasonSubphase);
        target.speedBlock = speedBlock;
        target.focus = `${speedBlock.title} - ${speedBlock.prescription}`;
      } else {
        attachPreLiftSpeedMicroDose();
      }
    }

    // ── Post-validation: weekly feel balance + feel/region pairing ──
    // Assigns `conditioningFeel` to every slot that has a category, honouring:
    //   • Heavy lower S+C + sprint/glyco → force 'sharp' (short work, long
    //     rest — avoids stacking grindy density on legs that were just
    //     hammered by compound lifts).
    //   • Upper S+C → prefer 'grindy' (legs are fresh; embrace density).
    //   • Week must contain ≥1 'sharp' and ≥1 'flowing' session.
    //   • Never cluster all sessions into 'grindy'.
    // This pass is the SOURCE OF TRUTH for feel assignment — defaultProgram
    // only falls back to hash-based feel if the engine left it unset.
    if (useCategoryPlanner) {
      type FeelSlot = {
        planIdx: number;
        slotPos: number;
        region: 'lower' | 'upper' | 'full' | 'none';
        cat: CondCategory;
        isCombined: boolean;
        isMicroDose: boolean;
      };
      const feelSlots: FeelSlot[] = [];
      for (let i = 0; i < plan.length; i++) {
        const s = plan[i];
        if (!s.conditioningCategory) continue;
        if (i >= daySlots.length) continue;
        const slotPos = trainingOrder(daySlots[i].num);
        const focus = (s.focus || '').toLowerCase();
        const isCombined = !!s.hasCombinedConditioning;
        const region: FeelSlot['region'] = !isCombined
          ? 'none'
          : /squat|hinge|lower|rdl|hip/.test(focus) ? 'lower'
          : /full body/.test(focus) ? 'full'
          : /upper|push|pull|bench|row/.test(focus) ? 'upper'
          : 'none';
        feelSlots.push({
          planIdx: i,
          slotPos,
          region,
          cat: s.conditioningCategory as CondCategory,
          isCombined,
          isMicroDose: s.conditioningVariant === 'micro_dose',
        });
      }
      feelSlots.sort((a, b) => a.slotPos - b.slotPos);

      const counts: Record<'grindy' | 'sharp' | 'flowing', number> = {
        grindy: 0, sharp: 0, flowing: 0,
      };

      // Pass 1 — apply hard pairing rules (lower+sprint/glyco → sharp).
      for (const fs of feelSlots) {
        if (fs.isMicroDose) continue; // feel is irrelevant for micro-dose
        if (fs.region === 'lower' && (fs.cat === 'sprint' || fs.cat === 'glycolytic')) {
          plan[fs.planIdx].conditioningFeel = 'sharp';
          counts.sharp++;
        }
      }

      // Pass 2 — fill remaining slots balancing for ≥1 sharp, ≥1 flowing,
      // and respecting region preferences (lower→sharp, upper→grindy).
      // We walk chronologically and pick the feel that (a) honours the
      // region rule and (b) satisfies the weakest-covered global feel.
      for (const fs of feelSlots) {
        if (fs.isMicroDose) continue;
        if (plan[fs.planIdx].conditioningFeel) continue; // set in Pass 1

        let pick: 'grindy' | 'sharp' | 'flowing';
        const remaining = feelSlots
          .filter(x => !plan[x.planIdx].conditioningFeel && !x.isMicroDose).length;
        const needSharp = counts.sharp === 0 && remaining <= 2;
        const needFlowing = counts.flowing === 0 && remaining <= 2;

        if (needSharp) {
          pick = 'sharp';
        } else if (needFlowing) {
          pick = 'flowing';
        } else if (fs.region === 'lower') {
          // Lower → prefer sharp (avoid grindy).
          pick = counts.sharp <= counts.flowing ? 'sharp' : 'flowing';
        } else if (fs.region === 'upper') {
          // Upper → prefer grindy.
          pick = 'grindy';
        } else {
          // Neutral / full — take the feel with the lowest count, preferring
          // whichever feel is still zero.
          const order: ('sharp' | 'flowing' | 'grindy')[] = ['sharp', 'flowing', 'grindy'];
          pick = order.sort((a, b) => counts[a] - counts[b])[0];
        }

        plan[fs.planIdx].conditioningFeel = pick;
        counts[pick]++;
      }

      // Pass 3 — correction. If still missing sharp or flowing (possible
      // when the week has only 1–2 eligible slots), convert the first
      // grindy slot.
      if (feelSlots.length >= 2) {
        const convertFirstGrindyTo = (target: 'sharp' | 'flowing') => {
          const victim = feelSlots.find(fs =>
            !fs.isMicroDose && plan[fs.planIdx].conditioningFeel === 'grindy'
            // Don't rewrite a lower+sprint/glyco slot — pairing rule wins.
            && !(fs.region === 'lower' && (fs.cat === 'sprint' || fs.cat === 'glycolytic'))
          );
          if (victim) {
            plan[victim.planIdx].conditioningFeel = target;
            counts.grindy--;
            counts[target]++;
          }
        };
        if (counts.sharp === 0) convertFirstGrindyTo('sharp');
        if (counts.flowing === 0) convertFirstGrindyTo('flowing');
      }
    }

    // ── Post-validation: if 5th conditioning exposure exists, ensure it's lighter ──
    if (st.condCount >= 5) {
      const condSessions = plan.filter(s =>
        s.conditioningFlavour && !s.hasCombinedConditioning && s.conditioningFlavour !== 'aerobic'
      );
      // Downgrade the last high-intensity standalone to aerobic
      const lastHigh = condSessions.reverse().find(s => s.conditioningFlavour === 'high-intensity');
      if (lastHigh) {
        const prevCat = lastHigh.conditioningCategory;
        lastHigh.focus = buildFocus('COND', 'aerobic', 'aerobic_base');
        lastHigh.conditioningFlavour = 'aerobic';
        lastHigh.conditioningCategory = 'aerobic_base';
        lastHigh.isHardExposure = false;
        if (prevCat) st.condCategories[prevCat as CondCategory]--;
        st.condCategories['aerobic_base']++;
      }
    }

    // ── Post-validation: movement-pattern integrity in pre-season ──
    //
    // When placement drops one side of a regional pattern (e.g. L-sq lands
    // but L-hi can't find a slot, leaving the week with only squat and no
    // hinge), swap the remaining dedicated session to its combined-region
    // equivalent so BOTH sub-patterns are covered in a single session.
    //   Rule: if strict dedicated SQ exists but no HI → swap L-sq → L-co
    //         if strict dedicated HI exists but no SQ → swap L-hi → L-co
    //         if strict dedicated PU exists but no PL → swap U-pu → U-co
    //         if strict dedicated PL exists but no PU → swap U-pl → U-co
    // Full-body sessions contribute to both regions (0.5 each) and therefore
    // do NOT trigger a swap — FB means both patterns are already touched.
    if (isPreSeason && teamDayNumSet.size > 0) {
      const isSqFocus = (f: string) => /squat emphasis/i.test(f) && !/quad-dominant main/i.test(f);
      const isHiFocus = (f: string) => /^Hip-dominant lower/i.test(f);
      const isPuFocus = (f: string) => /push emphasis/i.test(f);
      const isPlFocus = (f: string) => /pull emphasis/i.test(f);
      const isFbFocus = (f: string) => /^Full body/i.test(f);
      const isLcoFocus = (f: string) => /quad-dominant main \+ hip-dominant assistance/i.test(f);
      const isUcoFocus = (f: string) => /combined push \+ pull/i.test(f);

      const sqSessions = plan.filter(s => s.tier === 'core' && isSqFocus(s.focus));
      const hiSessions = plan.filter(s => s.tier === 'core' && isHiFocus(s.focus));
      const puSessions = plan.filter(s => s.tier === 'core' && isPuFocus(s.focus));
      const plSessions = plan.filter(s => s.tier === 'core' && isPlFocus(s.focus));
      const hasFb = plan.some(s => s.tier === 'core' && isFbFocus(s.focus));
      const hasLco = plan.some(s => s.tier === 'core' && isLcoFocus(s.focus));
      const hasUco = plan.some(s => s.tier === 'core' && isUcoFocus(s.focus));

      if (sqSessions.length >= 1 && hiSessions.length === 0 && !hasFb && !hasLco &&
          !blocksStrengthCandidateForGeneration('L-co')) {
        sqSessions[0].focus = buildFocus('L-co');
        sqSessions[0].strengthPattern = buildStrengthPattern('L-co');
      } else if (hiSessions.length >= 1 && sqSessions.length === 0 && !hasFb && !hasLco &&
          !blocksStrengthCandidateForGeneration('L-co')) {
        hiSessions[0].focus = buildFocus('L-co');
        hiSessions[0].strengthPattern = buildStrengthPattern('L-co');
      }
      if (puSessions.length >= 1 && plSessions.length === 0 && !hasFb && !hasUco &&
          !blocksStrengthCandidateForGeneration('U-co')) {
        puSessions[0].focus = buildFocus('U-co');
        puSessions[0].strengthPattern = buildStrengthPattern('U-co');
      } else if (plSessions.length >= 1 && puSessions.length === 0 && !hasFb && !hasUco &&
          !blocksStrengthCandidateForGeneration('U-co')) {
        plSessions[0].focus = buildFocus('U-co');
        plSessions[0].strengthPattern = buildStrengthPattern('U-co');
      }
    }

  }

  // ══════════════════════════════════════════════════════════════════════
  // COMMON POST-VALIDATION TAIL (runs for every phase / branch above)
  // ══════════════════════════════════════════════════════════════════════
  //
  // The branches above all produce an unordered `plan: SessionAllocation[]`.
  // The tail below normalises that plan against the UNIVERSAL rules — the
  // ones that must hold regardless of in-season / pre-season / off-season:
  //
  //   (1) Region adjacency FIRST: no 3 consecutive upper/lower days. Runs
  //       before team-label so Strategy 1 (demote-optional) can still see
  //       optional-tier team days (G-1 arms / G-3 light accessories) as
  //       candidates. Once team-label promotes them to `core`, Strategy 1
  //       has nothing to demote and Strategy 2 (day-swap) / Strategy 3
  //       (focus-flip) kick in — which break team-day semantics (team
  //       labels get moved to non-team days, or focus gets overwritten to
  //       "Lower body strength" losing the "Team training + " prefix).
  //
  //   (2) Team-day label: every day the athlete trains with the team must
  //       lead with "Team training" in its focus string so the UI never
  //       hides the anchor session — applies to IN-season team days too,
  //       not just pre-season (previously pre-season-gated, which left
  //       in-season Tue/Thu team days rendering as plain gym titles).
  //
  //   (3) Weekend peak (H-PRE-11, pre-season no-game only): Saturday is
  //       the marquee training day of a no-game pre-season week. If the
  //       hardest standalone conditioning (VO2 / glycolytic / HI) sits on
  //       a weekday while Saturday holds a vanilla strength slot, we SWAP
  //       them. This is the ONLY place the tail reshuffles day slots —
  //       everything else prefers conversion.
  //
  //   (4) Field-load streak cap (H-PRE-12, all non-game weeks): no more
  //       than 3 consecutive field-load days (team, strength-core, or
  //       standalone conditioning). A 4+ streak is broken by CONVERTING
  //       the interior day (preferring to drop conditioning rather than
  //       swapping day assignments).
  //
  //   (5) Pre-season core-streak cap (existing): no more than 3 core days
  //       in a row. Runs only for pre-season — off-season already self-
  //       limits via placement.
  //
  // Local vars re-derived here (the original `isPreSeason` / `teamDayNumSet`
  // were scoped to the else-branch above).
  const phaseIsPreSeason = inputs.seasonPhase === 'Pre-season';
  const teamDaySetTail = new Set(teamDayNums);

  // Sort plan by day of week for display before adjacency (which also sorts)
  plan.sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));

  // (1) Region adjacency FIRST — preserves optional-tier demotion path ───
  //
  // Pass the team-day Set so Strategy 2 (swap day assignments) can refuse
  // cross-boundary swaps. Without this, `enforceAdjacentRegionLimit`
  // falls back to reading `isTeamDay` off each session — which isn't
  // populated yet (the universal team-day label pass runs in step 2),
  // so the guard always evaluates `false !== false` → swap permitted.
  // The consequence is a team day can silently lose its session when a
  // 3-consecutive-same-region run includes it.
  let adjusted = enforceAdjacentRegionLimit(plan, teamDaySetTail);
  adjusted = optimiseStrengthLoadSequence(adjusted, {
    teamDayNumSet: teamDaySetTail,
    hasGameThisWeek,
    gameDayNum,
  });

  // (2) Universal team-day label ─────────────────────────────────────────
  // "Wholesale replace" list is deliberately narrow: these three focuses
  // represent "no dedicated gym prescription today" — mobility/rest fillers
  // that team training itself is meant to fill. Every other focus (arms/pump,
  // light accessories, post-game recovery, strength, conditioning, etc.) is
  // a REAL prescription that must be preserved alongside "Team training + ".
  //
  // Game proximity guard: on G-1 team days the club typically runs a
  // captain's run (light tactical walkthrough) — NOT a full sprint/skills/
  // contact session. We downgrade the wholesale-replace label accordingly
  // so the G-1 "low fatigue" rule holds even when the team schedules a
  // session the day before the game.
  if (teamDaySetTail.size > 0) {
    for (const s of adjusted) {
      const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
      if (dayNum < 0 || !teamDaySetTail.has(dayNum)) continue;
      s.tier = 'core';
      s.isTeamDay = true;
      const focusLc = s.focus.toLowerCase();
      if (focusLc.startsWith('team training')) continue;
      const offset = gOffset(dayNum, gameDayNum);
      const isG1 = hasGameThisWeek && offset === -1;
      if (focusLc.startsWith('low-fatigue accessories')
        || focusLc.startsWith('mobility, foam rolling')
        || focusLc.startsWith('full rest')) {
        s.focus = isG1
          ? 'Team training - captain\u2019s run (walkthrough, low-load)'
          : 'Team training - field session (sprint + skills + contact)';
      } else {
        s.focus = 'Team training + ' + s.focus;
      }
    }
  }

  // (2.5) In-season WITH-game conditioning floor ──────────────────────────
  // Inserts up to 2 supplementary aerobic_base sessions when the trigger
  // gate matches (≤2 team days, ≥5 days, healthy, no severe injuries).
  // Runs AFTER the team-day label pass so isTeamDay flags are reliable,
  // and BEFORE the weekend-peak / field-load passes (both pre-season /
  // no-game gated, so they don't interact with our with-game insertion).
  // Helper exits silently if the gate doesn't match — no behaviour change
  // for pre-season, off-season, no-game, low-readiness, or 3+ team-day
  // configurations. `isInSeason` + `hasGameThisWeek` were declared at
  // line ~646 in this same function scope.
  if (hasGameThisWeek) {
    applyInSeasonConditioningFloor(adjusted, inputs);
  }

  // (2.6) In-season push/pull balance safety net ──────────────────────────
  // Hard rule: every in-season week must carry at least 1 push exposure
  // AND at least 1 pull exposure (or a single full_body / upper_combined
  // session covering both). Catches the 2-core (low-readiness) case where
  // the placement branch only emits one upper slot, AND any future
  // configuration where push/pull go missing. Runs LAST among the
  // in-season post-validation steps so it sees the final session shape
  // including any conditioning floor mutations. The repair may consume a
  // finisher or standalone conditioning slot, but proper components remain
  // protected and any valid conditioning removal re-checks the floor.
  if (isInSeason && !weekContext.isByeWeek) {
    enforceInSeasonPushPullBalance(adjusted, inputs);
  }

  // (3) Weekend-peak swap (pre-season, no-game weeks only) ───────────────
  if (phaseIsPreSeason && !hasGameThisWeek) {
    enforceWeekendPeak(adjusted);
  }

  // (4) Field-load streak cap — max 3 consecutive field-load days ────────
  if (!hasGameThisWeek) {
    enforceFieldLoadStreak(adjusted);
  }

  // (5) Pre-season strength-streak cap (existing rule) ───────────────────
  if (phaseIsPreSeason) {
    enforcePreSeasonCoreStreak(adjusted, teamDaySetTail);
  }

  // (6) SP-2/SP-3 quality speed top-up placement.
  // If the sprint exposure gate still allows one app-added pre-season or
  // late-off-season exposure after the shared tail has finished reshaping the
  // week, attach it as first-in-session true speed on an upper day. This keeps
  // sprint work out of conditioning and avoids finishers.
  const phaseSupportsSpeedTopUp = phaseIsPreSeason || offseasonSubphase === 'late_offseason';
  if (phaseSupportsSpeedTopUp) {
    const plannedSprintRows = adjusted.filter((session) =>
      session.speedWorkKind === 'true_speed' || session.conditioningCategory === 'sprint',
    ).length;
    const lowerLimbSprintBlocked = activeInjuries.some((injury) => {
      const lowerLimb =
        injury.region === 'lower_body' ||
        injury.injuryKeys.some((key) =>
          key === 'hamstring' || key === 'knee' || key === 'calf' ||
          key === 'ankle' || key === 'adductor' || key === 'pubalgia',
        );
      const triggerText = `${injury.bodyPart} ${injury.bucket ?? ''} ${injury.triggers.join(' ')}`.toLowerCase();
      const sprintTrigger =
        /\b(sprint|speed|max velocity|running|cod|change of direction|cutting|jumping)\b/.test(triggerText);
      return lowerLimb && (injury.removeRiskyWork || injury.pauseAffectedTraining || sprintTrigger);
    });
    const gameAnchorDayNum = inputs.hasGame && gameDayNum !== null ? gameDayNum : null;
    const gate = evaluateSprintExposureGate({
      phase: inputs.seasonPhase,
      teamTrainingDays: Array.from(teamDaySetTail),
      gameOrPracticeMatchDays: gameAnchorDayNum !== null ? [gameAnchorDayNum] : [],
      plannedOnFeetSprintExposures: plannedSprintRows,
      readinessAllowsSprint: readiness === 'high' && !activeReadiness?.avoidSprint,
      injuryAllowsSprint: !lowerLimbSprintBlocked,
      offseasonSubphase,
      preseasonSubphase,
      weekKind: inputs.weekKind,
    });

    if (plannedSprintRows === 0 && gate.allowStandaloneSprint) {
      const target = adjusted
        .map((session, index) => ({ session, index }))
        .filter(({ session }) => {
          if (!session.dayOfWeek || session.isTeamDay || session.speedWorkKind) return false;
          if (session.strengthPattern !== 'push' &&
              session.strengthPattern !== 'pull' &&
              session.strengthPattern !== 'upper_combined') {
            return false;
          }
          const dayNum = dayNameToNumber(session.dayOfWeek);
          if (dayNum < 0 || teamDaySetTail.has(dayNum)) return false;
          const prevDay = (dayNum + 6) % 7;
          const nextDay = (dayNum + 1) % 7;
          if (teamDaySetTail.has(prevDay) || teamDaySetTail.has(nextDay)) return false;
          if (gameAnchorDayNum !== null) {
            const offset = gOffset(dayNum, gameAnchorDayNum);
            if (offset === 0 || offset === -1 || offset === -2) return false;
          }
          const previousSession = adjusted.find((other) =>
            other.dayOfWeek && dayNameToNumber(other.dayOfWeek) === prevDay);
          return previousSession?.strengthPattern !== 'lower' &&
            previousSession?.strengthPattern !== 'lower_combined' &&
            previousSession?.strengthPattern !== 'full_body';
        })
        .sort((a, b) => {
          const da = dayNameToNumber(a.session.dayOfWeek ?? '');
          const db = dayNameToNumber(b.session.dayOfWeek ?? '');
          return (da === 0 ? 7 : da) - (db === 0 ? 7 : db) || a.index - b.index;
        })[0]?.session;

      if (target) {
        const strengthFocus = target.focus.split(' + ')[0] || target.focus;
        target.hasCombinedConditioning = false;
        target.attachedConditioningKind = undefined;
        target.conditioningFlavour = undefined;
        target.conditioningCategory = undefined;
        target.conditioningVariant = undefined;
        target.conditioningFeel = undefined;
        target.conditioningOffFeet = undefined;
        target.ergModality = undefined;
        target.speedWorkKind = 'true_speed';
        target.speedPlacement = 'pre_lift';
        const speedBlock = createSpeedTopUpBlock('pre_lift', inputs, offseasonSubphase);
        target.speedBlock = speedBlock;
        target.isHardExposure = true;
        target.stressLevel = 'high';
        target.focus = `${speedBlock.title} + ${strengthFocus}`;
      }
    }
  }

  // Major readiness reductions keep safe/easy work, but app-authored hard
  // sessions become visible recovery substitutions instead of disappearing.
  // Team anchors remain intact; full_pause already returns recovery above.
  if (activeReadiness?.tier === 'major_reduction') {
    adjusted = adjusted.map((session) => {
      if (!session.isHardExposure || session.isTeamDay) return session;
      return {
        ...session,
        tier: 'recovery',
        focus: 'Recovery / easy movement - keep this light while readiness returns',
        isHardExposure: false,
        stressLevel: 'low',
        strengthPattern: undefined,
        hasCombinedConditioning: false,
        attachedConditioningKind: undefined,
        conditioningFlavour: undefined,
        conditioningCategory: undefined,
        conditioningVariant: undefined,
        conditioningFeel: undefined,
        conditioningOffFeet: undefined,
        ergModality: undefined,
        speedWorkKind: undefined,
        speedPlacement: undefined,
        speedBlock: undefined,
      };
    });
  }

  // Final sort (weekend-peak / field-load / core-streak may have mutated)
  adjusted.sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));

  // ── Pre-season conditioning-zero diagnostic ───────────────────────────
  //
  // Conditioning is allowed to land at zero ONLY when there's a structural
  // reason (every non-team slot was either rest, hard strength, or blocked
  // by H-PRE-1/3). This block is the "never silently drop" guard Sam asked
  // for: when a pre-season week with healthy readiness ends with no
  // conditioning despite both H5a (S+C conversion) and H5b (ACC/REC promo)
  // running, we emit a structured warning that names exactly which slots
  // were filled with what — so the next regression of this kind shows up
  // in dev logs instead of going silent. In-season weeks aren't covered
  // here (their structural rules genuinely permit weeks with no standalone
  // conditioning around game days).
  if (phaseIsPreSeason) {
    const condSessionCount = adjusted.filter(s =>
      !!s.conditioningCategory || !!s.hasCombinedConditioning,
    ).length;
    if (condSessionCount === 0) {
      const teamDayList = [...teamDaySetTail]
        .map(d => DAY_NAMES[d])
        .join(', ');
      const slotSummary = adjusted
        .map(s => {
          const cond = s.hasCombinedConditioning
            ? '+cond'
            : s.conditioningCategory ? `cond:${s.conditioningCategory}` : '';
          const team = s.isTeamDay ? '(team)' : '';
          return `${s.dayOfWeek}=${s.tier}${team}${cond ? `[${cond}]` : ''}`;
        })
        .join(', ');
      // eslint-disable-next-line no-console
      logger.warn(
        '[engine] Pre-season week landed at 0 conditioning — both standalone ' +
        'placement AND S+C fallback were exhausted. ' +
        `team_days=[${teamDayList || 'none'}] ` +
        `selected_days=[${inputs.selectedDays.join(', ')}] ` +
        `core=${(adjusted.filter(s => s.tier === 'core' && s.isHardExposure).length)} ` +
        `week_shape={${slotSummary}}. ` +
        'If you see this, file a bug — the engine should have found at ' +
        'least one valid conditioning slot OR a valid S+C pairing.'
      );
    }
  }

  return adjusted;
}

// ─── In-season conditioning floor (with-game weeks only) ─────────────────
//
// Inserts up to 2 supplementary aerobic_base conditioning sessions into an
// in-season with-game plan. Mutates the plan in place. Pre-season /
// off-season / no-game branches are NEVER touched.
//
// Conditioning targets per Sam's coaching policy:
//   - 1 team day:   1 core (Wed standalone OR Tue S+C) + 1 optional (Mon)  = 2 cond
//   - 2 team days:  0–1 core (only when Wed is a non-team day)  + 1 optional (Mon)
//                                                                        = 1–2 cond
//   - 3+ team days: gate trips → 0 cond (saturation rule)
//
// Tier rules:
//   CORE
//     - Place standalone aerobic_base on Wednesday (G−3) when Wed is a
//       non-team training day and not already a core strength slot.
//       If Wednesday sits between Tue/Thu team training, bias it toward
//       recovery: 20–30min easy bike/row, optional, 3–4/10.
//     - When Wed is unavailable (team day OR not in selectedDays) AND
//       teamCount ≤ 1, fall back to Tuesday (G−4) as an S+C aerobic
//       finisher attached to an existing strength session.
//     - When Wed is unavailable AND teamCount ≥ 2, SKIP core (per Sam:
//       2 team days = 1 optional only when Wed is busy).
//   OPTIONAL
//     - Always attempt Monday (G−5), regardless of whether core landed.
//     - Required when teamCount ≥ 2 + Wed is busy (it's the only
//       conditioning the week gets).
//     - S+C aerobic finisher attached to Monday's strength session.
//     - Lower-body pairing → non-running modality (bike/rower/ski erg) so
//       running stress doesn't compound on legs that just took heavy
//       squat/hinge.
//     - Upper-body pairing → running OK (legs fresh).
//
// Hard guards (always enforced):
//   - Never modify a session with isTeamDay=true.
//   - Never place anything on G−2, G−1, G, G+1 (48h game-proximity).
//   - Conditioning category MUST be 'aerobic_base' (no sprint/vo2/glycolytic).
//   - Don't double-up: if any session already carries conditioning, exit.
//
// Trigger gate (all must hold; otherwise exit silently):
//   in-season + has game + teamCount ≤ 2 + ≥5 available days +
//   readiness === 'high' + no severe injury + plan has zero conditioning.
//
// Diagnostic: only emits a structured warning when NEITHER core nor
// optional could land — i.e. zero conditioning was placed despite the
// gate matching. Routine "core skipped because Wed is team and 2-team
// case" is the expected path and emits no warning.
function applyInSeasonConditioningFloor(
  plan: SessionAllocation[],
  inputs: CoachingInputs,
): void {
  // ── Trigger gate ────────────────────────────────────────────────────
  if (inputs.seasonPhase !== 'In-season') return;
  if (!inputs.hasGame) return;
  const teamDays = inputs.teamTrainingDays || [];
  if (teamDays.length > 2) return;
  if (inputs.availableDays < 5) return;
  const { level: readiness } = calculateReadiness(inputs);
  if (readiness !== 'high') return;
  const hasSevere = (inputs.injuries || []).some(i => i.severity === 'Severe');
  if (hasSevere) return;
  const alreadyHasCond = plan.some(
    s => !!s.conditioningCategory || !!s.hasCombinedConditioning,
  );
  if (alreadyHasCond) return;

  // ── Day-offset map ──────────────────────────────────────────────────
  const gameDayNum = inputs.gameDay ? dayNameToNumber(inputs.gameDay) : null;
  if (gameDayNum === null) return;
  const teamDayNumSet = new Set(
    teamDays.map(dayNameToNumber).filter(d => d >= 0),
  );
  const isTeamSlot = (s: SessionAllocation): boolean => {
    if (s.isTeamDay) return true;
    if (!s.dayOfWeek) return false;
    return teamDayNumSet.has(dayNameToNumber(s.dayOfWeek));
  };
  const byOffset = new Map<number, SessionAllocation>();
  for (const s of plan) {
    if (!s.dayOfWeek) continue;
    const dn = dayNameToNumber(s.dayOfWeek);
    if (dn < 0) continue;
    const off = gOffset(dn, gameDayNum);
    if (off === -3 || off === -4 || off === -5) {
      byOffset.set(off, s);
    }
  }
  const teamCount = teamDays.length;

  // S+C label builder — pairs aerobic finisher with strength session.
  // Sets typed conditioning fields and the human-readable focus suffix.
  // Lower-body pairing forces non-running modality (Sam's hard rule:
  // "Lower + conditioning → MUST be non-running").
  function attachSCFinisher(s: SessionAllocation, durationCap: '15min' | '20min'): void {
    const isLower =
      s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined';
    s.hasCombinedConditioning = true;
    s.attachedConditioningKind = 'finisher';
    s.conditioningCategory = 'aerobic_base';
    s.conditioningFlavour = 'aerobic';
    if (isLower) {
      s.ergModality = 'mixed'; // bike / rower / ski erg
      s.focus = `${s.focus} + easy aerobic finisher (bike steady or row/ski intervals, ≤${durationCap}, low intensity)`;
    } else {
      // Upper / non-strength day — running OK (legs are fresh).
      s.focus = `${s.focus} + easy aerobic finisher (≤${durationCap}, low intensity)`;
    }
  }

  // ── CORE TIER ────────────────────────────────────────────────────────
  // Wed (G−3) standalone preferred; Tue (G−4) S+C is the fallback ONLY
  // when teamCount ≤ 1. The 2-team case deliberately skips core when Wed
  // is busy — Sam's policy: "2 team days → 1 optional only when Wed is a
  // team day".
  let corePlaced = false;
  const g3 = byOffset.get(-3);
  const g3Eligible =
    !!g3 && !isTeamSlot(g3) && g3.tier !== 'core';
  if (g3Eligible) {
    const wedBetweenTueThuTeam =
      teamDayNumSet.has(dayNameToNumber('Tuesday')) &&
      teamDayNumSet.has(dayNameToNumber('Thursday')) &&
      gameDayNum === dayNameToNumber('Saturday');
    g3!.tier = 'optional';
    g3!.focus = wedBetweenTueThuTeam
      ? 'Easy Aerobic Flush - 20-30min easy bike/row, 3-4/10.'
      : 'Aerobic base - 25-35min easy run/erg, low intensity.';
    g3!.conditioningCategory = 'aerobic_base';
    g3!.conditioningFlavour = 'aerobic';
    if (wedBetweenTueThuTeam) {
      g3!.conditioningVariant = 'reduced';
      g3!.ergModality = 'row';
    }
    g3!.isHardExposure = false;
    corePlaced = true;
  } else if (teamCount <= 1) {
    // Tue fallback — 1-team or 0-team weeks only.
    const g4 = byOffset.get(-4);
    if (
      g4 &&
      !isTeamSlot(g4) &&
      !g4.hasCombinedConditioning &&
      g4.tier === 'core' &&
      !!g4.strengthPattern
    ) {
      // Pair S+C with whatever strength pattern Tue carries — upper or
      // lower. Lower triggers non-running modality automatically.
      attachSCFinisher(g4, '15min');
      corePlaced = true;
    }
  }

  // ── OPTIONAL TIER ────────────────────────────────────────────────────
  // Always attempt Mon (G−5) regardless of core status. For 2-team-Wed-busy
  // weeks this is the only conditioning exposure the engine plants.
  let optionalPlaced = false;
  const g5 = byOffset.get(-5);
  if (
    g5 &&
    !isTeamSlot(g5) &&
    g5.tier === 'core' &&
    !!g5.strengthPattern &&
    !g5.hasCombinedConditioning
  ) {
    attachSCFinisher(g5, '20min');
    optionalPlaced = true;
  }

  // ── Diagnostic ───────────────────────────────────────────────────────
  // Only warn when NEITHER tier landed. "Core skipped because Wed is team
  // in a 2-team week" is Sam's expected path; that yields optionalPlaced=true
  // and skips the warning.
  if (!corePlaced && !optionalPlaced) {
    const stateOf = (s: SessionAllocation | undefined): string => {
      if (!s) return 'absent';
      if (isTeamSlot(s)) return `${s.dayOfWeek}:team`;
      if (s.tier === 'core' && s.strengthPattern) {
        return s.hasCombinedConditioning ? `${s.dayOfWeek}:combined` : `${s.dayOfWeek}:eligible-${s.strengthPattern}`;
      }
      return `${s.dayOfWeek}:tier=${s.tier}/pat=${s.strengthPattern ?? 'none'}`;
    };
    // eslint-disable-next-line no-console
    logger.warn(
      '[engine] In-season conditioning floor: zero exposures placed. ' +
        `G-3=${stateOf(g3)} G-4=${stateOf(byOffset.get(-4))} G-5=${stateOf(g5)} ` +
        `team_days=[${teamDays.join(', ') || 'none'}] ` +
        `selected_days=[${inputs.selectedDays.join(', ')}] ` +
        `gameDay=${inputs.gameDay}.`,
    );
  }
}

// ─── In-season push/pull balance safety net ──────────────────────────────
//
// Hard rule: every in-season week (with or without game) must carry at
// least 1 push exposure AND at least 1 pull exposure. A 1-core full-body
// session covers both (strengthPattern === 'full_body'); a 2-core upper
// session can cover both via 'upper_combined'.
//
// Strength balance can consume low-value filler or a finisher. Proper
// conditioning components are planned work and cannot be sacrificed by this
// repair. If standalone conditioning must be consumed, the existing in-season
// floor is run again before returning.
//
// Fix strategies (first that succeeds wins, retried per missing pattern):
//   (1) Promote an existing single-pattern upper to 'upper_combined' —
//       preserves day, conditioning suffix, team-day prefix; just re-labels
//       the pattern semantics. Cheapest, no slot churn. Works for both
//       free-standing AND team-day-anchored uppers.
//   (2) Find a non-team, non-core, outside-48h candidate (G−3/G−4/G−5)
//       and promote to a moderate upper carrying the missing pattern.
//       Prefers empty filler, then finishers, then standalone conditioning;
//       attached components are not candidates.
//   (3) Team-day overlay (last resort) — when no non-team slot exists,
//       layer the missing pattern onto an existing team day. Per Sam:
//       "team days are NOT untouchable" — adding a light/moderate upper
//       overlay onto a team session is acceptable and matches real-world
//       coaching practice (gym session before / after team training on
//       the same day). Constraints: never on G−1 / G−2 / G / G+1; never
//       on team days carrying lower-pattern (don't compound legs); never
//       on team days already covering the missing pattern.
//
// Loop semantics: this helper runs up to 2 iterations so it can fix BOTH
// patterns when both are missing (e.g. 4-day weeks where the placement
// branch couldn't find an upperSlot at all). Iter 1 adds one pattern via
// Strategy 2 or 3; iter 2 then promotes that newly-added single pattern
// to upper_combined via Strategy 1 to cover the other side.
export function enforceInSeasonPushPullBalance(
  plan: SessionAllocation[],
  inputs: CoachingInputs,
): void {
  if (inputs.seasonPhase !== 'In-season') return;

  const gameDayNum = inputs.gameDay ? dayNameToNumber(inputs.gameDay) : null;
  const teamDayNumSet = new Set(
    (inputs.teamTrainingDays || []).map(dayNameToNumber).filter(d => d >= 0),
  );
  const isTeamSlot = (s: SessionAllocation): boolean => {
    if (s.isTeamDay) return true;
    if (!s.dayOfWeek) return false;
    return teamDayNumSet.has(dayNameToNumber(s.dayOfWeek));
  };
  const offsetOf = (s: SessionAllocation): number | null => {
    if (gameDayNum === null) return null;
    if (!s.dayOfWeek) return null;
    const dn = dayNameToNumber(s.dayOfWeek);
    if (dn < 0) return null;
    return gOffset(dn, gameDayNum);
  };
  const inProximityWindow = (s: SessionAllocation): boolean => {
    const off = offsetOf(s);
    if (off === null) return false;
    return off === -2 || off === -1 || off === 0 || off === 1;
  };
  const sortByEarliest = (arr: SessionAllocation[]): SessionAllocation[] =>
    arr.slice().sort((a, b) => {
      if (gameDayNum === null) {
        // Mon=1 first, Sun=0 last (matches buildWeeklyPlan's trainingOrder).
        const aDn = dayNameToNumber(a.dayOfWeek!);
        const bDn = dayNameToNumber(b.dayOfWeek!);
        const aOrd = aDn === 0 ? 7 : aDn;
        const bOrd = bDn === 0 ? 7 : bDn;
        return aOrd - bOrd;
      }
      // Furthest from game first (most negative offset = smallest value).
      return offsetOf(a)! - offsetOf(b)!;
    });
  type ConditioningOwnership = 'none' | 'finisher' | 'standalone' | 'component';
  const conditioningOwnership = (session: SessionAllocation): ConditioningOwnership => {
    if (session.attachedConditioningKind === 'component') return 'component';
    if (session.hasCombinedConditioning || session.attachedConditioningKind === 'finisher') {
      return 'finisher';
    }
    if (session.conditioningCategory || session.conditioningFlavour) return 'standalone';
    return 'none';
  };
  const conditioningRemovalCost = (session: SessionAllocation): number => {
    switch (conditioningOwnership(session)) {
      case 'none': return 0;
      case 'finisher': return 1;
      case 'standalone': return 2;
      case 'component': return 3;
    }
  };
  const sortByRepairCost = (arr: SessionAllocation[]): SessionAllocation[] => {
    const chronological = sortByEarliest(arr);
    const chronologicalIndex = new Map(chronological.map((session, index) => [session, index]));
    return arr.slice().sort((a, b) =>
      conditioningRemovalCost(a) - conditioningRemovalCost(b) ||
      (chronologicalIndex.get(a) ?? 0) - (chronologicalIndex.get(b) ?? 0));
  };
  const clearRemovableConditioning = (session: SessionAllocation): boolean => {
    const ownership = conditioningOwnership(session);
    if (ownership === 'none' || ownership === 'component') return false;
    session.conditioningCategory = undefined;
    session.conditioningFlavour = undefined;
    session.conditioningFeel = undefined;
    session.conditioningVariant = undefined;
    session.conditioningOffFeet = undefined;
    session.ergModality = undefined;
    session.hasCombinedConditioning = false;
    session.attachedConditioningKind = undefined;
    return true;
  };
  let removedConditioning = false;
  const recheckConditioningFloor = (): void => {
    if (removedConditioning) applyInSeasonConditioningFloor(plan, inputs);
  };

  // Up to 2 iterations: handles the both-missing case where iter 1 plants
  // one pattern and iter 2 promotes it to upper_combined for the other.
  for (let iter = 0; iter < 2; iter++) {
    const hasPush = plan.some(
      s =>
        s.strengthPattern === 'push' ||
        s.strengthPattern === 'upper_combined' ||
        s.strengthPattern === 'full_body',
    );
    const hasPull = plan.some(
      s =>
        s.strengthPattern === 'pull' ||
        s.strengthPattern === 'upper_combined' ||
        s.strengthPattern === 'full_body',
    );
    if (hasPush && hasPull) {
      recheckConditioningFloor();
      return;
    }

    const missing: 'push' | 'pull' = !hasPush ? 'push' : 'pull';
    const oppositePattern: 'push' | 'pull' =
      missing === 'push' ? 'pull' : 'push';
    let succeeded = false;

    // ── Strategy 1: Promote single-pattern upper → upper_combined ──────
    const promotable = plan.find(
      s => s.tier === 'core' && s.strengthPattern === oppositePattern,
    );
    if (promotable) {
      const focus = promotable.focus;
      const teamPrefix = focus.startsWith('Team training + ')
        ? 'Team training + '
        : '';
      const withoutTeamPrefix = teamPrefix ? focus.slice(teamPrefix.length) : focus;
      const suffixStart = withoutTeamPrefix.indexOf(' + ');
      const condSuffix =
        conditioningOwnership(promotable) !== 'none' && suffixStart >= 0
          ? withoutTeamPrefix.slice(suffixStart)
          : '';
      promotable.focus = `${teamPrefix}Upper body - combined push + pull (balanced, moderate intensity - restored for push/pull coverage)${condSuffix}`;
      promotable.strengthPattern = 'upper_combined';
      succeeded = true;
    }

    // ── Strategy 2: Insert on non-team, non-core, outside-48h slot ─────
    if (!succeeded) {
      const candidates = plan
        .filter(s => !!s.dayOfWeek)
        .filter(s => !isTeamSlot(s))
        .filter(s => s.tier !== 'core')
        .filter(s => !inProximityWindow(s))
        .filter(s => conditioningOwnership(s) !== 'component');
      if (candidates.length > 0) {
        const chosen = sortByRepairCost(candidates)[0];
        removedConditioning = clearRemovableConditioning(chosen) || removedConditioning;
        chosen.tier = 'core';
        chosen.focus =
          missing === 'push'
            ? 'Upper body - push emphasis (moderate intensity - added for push/pull balance)'
            : 'Upper body - pull emphasis (moderate intensity - added for push/pull balance)';
        chosen.strengthPattern = missing;
        chosen.isHardExposure = false;
        succeeded = true;
      }
    }

    // ── Strategy 3: Team-day overlay (last resort) ─────────────────────
    // Per Sam: team days are NOT untouchable. When Strategies 1+2 fail,
    // overlay the missing pattern onto an existing team day. Eligibility:
    //   - team day with no lower-pattern strength loaded
    //   - not on G−1 / G−2 / G / G+1 (proximity guard)
    //   - not already carrying the missing pattern (no double-up)
    if (!succeeded) {
      const teamCandidates = plan
        .filter(s => !!s.dayOfWeek)
        .filter(s => isTeamSlot(s))
        .filter(
          s =>
            s.strengthPattern !== 'lower' &&
            s.strengthPattern !== 'lower_combined',
        )
        .filter(s => s.strengthPattern !== missing) // guard against duplicate
        .filter(s => conditioningOwnership(s) !== 'component')
        .filter(s => {
          // Don't overlay on G−1 (captain's run), G−2 (pre-game),
          // G (game), G+1 (post-game). G−3 / G−4 / G−5 are eligible.
          if (gameDayNum === null) return true;
          return !inProximityWindow(s);
        });
      if (teamCandidates.length > 0) {
        const tdChosen = sortByRepairCost(teamCandidates)[0];
        removedConditioning = clearRemovableConditioning(tdChosen) || removedConditioning;
        const layerLabel =
          missing === 'push'
            ? 'Upper body - push emphasis (light/moderate, layered onto team day)'
            : 'Upper body - pull emphasis (light/moderate, layered onto team day)';
        tdChosen.tier = 'core';
        tdChosen.focus = `Team training + ${layerLabel}`;
        tdChosen.strengthPattern = missing;
        tdChosen.isHardExposure = false;
        succeeded = true;
      }
    }

    if (!succeeded) {
      // eslint-disable-next-line no-console
      logger.warn(
        '[engine] In-season push/pull balance: missing ' + missing +
          ' but no strategy could land it ' +
          '(no single-pattern upper to promote, no eligible non-team slot, ' +
          'no eligible team-day overlay). ' +
          `team_days=[${(inputs.teamTrainingDays || []).join(', ') || 'none'}] ` +
          `selected_days=[${inputs.selectedDays.join(', ')}] ` +
          `gameDay=${inputs.gameDay ?? 'none'}.`,
      );
      recheckConditioningFloor();
      return;
    }
  }
  recheckConditioningFloor();
}

// ─── Region Classification ───
//
// Every session has a region: upper, lower, or neutral.
// Used by the adjacency constraint pass to prevent >2 consecutive
// same-region exposures. Optional sessions still count — even light
// upper accessories contribute to upper-body fatigue accumulation.

export type GenerationAdjacencyRegion = 'upper' | 'lower' | 'neutral';

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

  // Main strength region comes from the shared classifier. Full-body remains
  // neutral for this particular adjacency policy: it deliberately does not
  // cluster either single region.
  const sharedRegion = classifyGenerationSession(session).strengthRegion;
  if (sharedRegion === 'lower' || sharedRegion === 'upper') return sharedRegion;
  if (sharedRegion === 'full_body') return 'neutral';

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

    if (prevRegion !== 'neutral' && prevRegion === currRegion) {
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

function optimiseStrengthLoadSequence(
  plan: SessionAllocation[],
  options: StrengthSequenceOptions = {},
): SessionAllocation[] {
  if (plan.length <= 2) return plan;

  let result = [...plan].sort(
    (a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || '')
  );

  const teamDayNumSet = options.teamDayNumSet ?? new Set<number>();
  const isTeamDay = (s: SessionAllocation): boolean => {
    const d = dayNameToNumber(s.dayOfWeek || '');
    return d >= 0 && (teamDayNumSet.has(d) || !!s.isTeamDay);
  };
  const canSwap = (a: SessionAllocation, b: SessionAllocation): boolean => {
    const dayA = dayNameToNumber(a.dayOfWeek || '');
    const dayB = dayNameToNumber(b.dayOfWeek || '');
    if (dayA < 0 || dayB < 0) return false;
    if (isTeamDay(a) !== isTeamDay(b)) return false;

    if (options.hasGameThisWeek) {
      const bucketA = gameProximityBucket(dayA, options.gameDayNum);
      const bucketB = gameProximityBucket(dayB, options.gameDayNum);
      if (bucketA !== bucketB) return false;
    }

    return true;
  };
  const withDaySwap = (
    sessions: SessionAllocation[],
    a: number,
    b: number,
  ): SessionAllocation[] => {
    const dayA = sessions[a].dayOfWeek;
    const dayB = sessions[b].dayOfWeek;
    return sessions
      .map((s, idx) => {
        if (idx === a) return { ...s, dayOfWeek: dayB };
        if (idx === b) return { ...s, dayOfWeek: dayA };
        return s;
      })
      .sort((x, y) => dayNameToNumber(x.dayOfWeek || '') - dayNameToNumber(y.dayOfWeek || ''));
  };

  for (let pass = 0; pass < 6; pass++) {
    const currentScore = scoreStrengthSequence(result);
    let bestScore = currentScore;
    let best: SessionAllocation[] | null = null;

    for (let i = 0; i < result.length; i++) {
      if (strengthSequenceKind(result[i]) === 'neutral') continue;
      for (let j = i + 1; j < result.length; j++) {
        if (strengthSequenceKind(result[j]) === 'neutral') continue;
        if (!canSwap(result[i], result[j])) continue;

        const swapped = withDaySwap(result, i, j);
        const swappedScore = scoreStrengthSequence(swapped);
        if (swappedScore < bestScore) {
          bestScore = swappedScore;
          best = swapped;
        }
      }
    }

    if (!best) break;
    result = best;
  }

  return result;
}

// ─── Adjacency Constraint Pass ───
//
// RULE: No more than 2 consecutive days with the same region (upper or lower).
//       Optional sessions count toward exposure tracking.
//       Neutral sessions (recovery, mobility) break runs.
//
// ALGORITHM:
//   1. Walk the sorted plan and detect runs of >2 consecutive same-region days.
//   2. For each violation, try to swap the offending session with the nearest
//      non-adjacent session of a different region (or neutral).
//   3. If no swap target exists, demote the offending session's focus to neutral
//      (e.g., change optional upper accessories → mobility/recovery).
//   4. Single pass is sufficient — swaps only redistribute, they don't create
//      new violations because we swap with a different-region session.

// enforcePreSeasonCoreStreak: never allow >3 consecutive core days in pre-season.
//
// Runs BEFORE the plan is sorted for output. The pre-season branch produces
// the final `plan` array; we scan days in calendar order (Mon→Sun, taking the
// entries the user actually selected) and identify runs of ≥4 consecutive
// core-tier sessions. Team-day core slots are IMMUTABLE (can't downgrade),
// and isHardExposure strength sessions are the week's primary stimulus —
// those are also immutable. Breakable candidates inside a run are downgraded
// to 'optional' tier (and, when appropriate, their focus is softened).
//
// Downgrade preference (first-match):
//   1. Core conditioning that is NOT on a team day → demote to optional
//   2. Core non-hard-exposure, non-team session → demote to optional
//
// Notes:
//   - We identify "consecutive" via calendar day numbers (dayNameToNumber),
//     not plan array order, so Friday + Saturday are consecutive regardless
//     of where they sit in the selected training days array.
//   - We leave `isTeamDay === true` slots untouched no matter what.
function enforcePreSeasonCoreStreak(
  plan: SessionAllocation[],
  teamDayNumSet: Set<number>
): SessionAllocation[] {
  if (!plan || plan.length === 0) return plan;
  // Sort a shallow view by calendar day for streak detection
  const byDay = [...plan]
    .map(s => ({ ref: s, dayNum: s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1 }))
    .filter(x => x.dayNum >= 0)
    .sort((a, b) => a.dayNum - b.dayNum);

  // Build an ordered array of CONSECUTIVE-calendar core entries.
  // Two entries are consecutive if their dayNum differs by exactly 1.
  // We want to find runs of ≥4 and downgrade one slot.
  // Perform multiple passes in case one downgrade isn't enough.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    // Walk through byDay and find runs
    let runStart = 0;
    for (let i = 0; i <= byDay.length; i++) {
      const curr = byDay[i];
      const prev = byDay[i - 1];
      const breaks =
        i === byDay.length ||
        curr.ref.tier !== 'core' ||
        !prev ||
        prev.ref.tier !== 'core' ||
        curr.dayNum - prev.dayNum !== 1;
      if (breaks) {
        // Run [runStart, i-1] ended
        const runLen = i - runStart;
        // Only count if all are core and consecutive
        if (runLen >= 4) {
          // Find first breakable candidate in the run
          // Priority 1: non-team conditioning
          // Priority 2: non-team, non-hard-exposure core
          let target: SessionAllocation | null = null;
          for (let j = runStart; j < i; j++) {
            const s = byDay[j].ref;
            if (s.isTeamDay) continue;
            if (s.tier !== 'core') continue;
            if (s.conditioningFlavour && !s.isHardExposure) { target = s; break; }
          }
          if (!target) {
            for (let j = runStart; j < i; j++) {
              const s = byDay[j].ref;
              if (s.isTeamDay) continue;
              if (s.tier !== 'core') continue;
              if (s.isHardExposure) continue;
              target = s; break;
            }
          }
          // Priority 3 (LAST RESORT): hard-exposure standalone
          // conditioning. When every non-team slot is a hard
          // exposure (common in high-readiness athletes with many
          // available days), a 3-day cap still wins over preserving
          // every stimulus. Conditioning sessions are the most
          // replaceable hard exposure — demoting one keeps both
          // strength emphases and both team days intact while
          // breaking the streak. We prefer a MIDDLE-of-run slot so
          // the streak splits rather than merely shortening.
          if (!target) {
            const midStart = runStart + 1;
            const midEnd = i - 1;
            for (let j = midStart; j < midEnd; j++) {
              const s = byDay[j].ref;
              if (s.isTeamDay) continue;
              if (s.tier !== 'core') continue;
              if (s.conditioningFlavour && !s.hasCombinedConditioning) {
                target = s; break;
              }
            }
            if (!target) {
              for (let j = runStart; j < i; j++) {
                const s = byDay[j].ref;
                if (s.isTeamDay) continue;
                if (s.tier !== 'core') continue;
                if (s.conditioningFlavour && !s.hasCombinedConditioning) {
                  target = s; break;
                }
              }
            }
          }
          // NOTE: We deliberately do NOT downgrade hard STRENGTH
          // sessions (the week's primary stimulus). If even priority
          // 3 finds nothing, we accept the streak and rely on
          // placement-time prevention (H-PRE-5) for future weeks.
          if (target) {
            target.tier = 'optional';
            changed = true;
            // One downgrade per pass is enough — break out and reloop
            break;
          }
        }
        runStart = i;
      }
    }
    if (!changed) break;
  }
  return plan;
}

// ─── H-PRE-11: Weekend Peak ─────────────────────────────────────────────
//
// Pre-season no-game weeks: Saturday is the marquee training day. If the
// week's HARDEST standalone conditioning (VO2 / glycolytic / HI) is sitting
// on a weekday while Saturday holds a vanilla strength slot, swap them so
// the peak stimulus lands on the weekend. Friday becomes the strength
// buffer into it.
//
// This is the ONE place the tail reshuffles day assignments. All other
// post-validation passes prefer CONVERSION.
//
// Rules:
//   - Only operates when Saturday exists in the plan.
//   - Skipped entirely if Saturday is already a team day (team > peak) or
//     already hosts a hard standalone conditioning session (nothing to do).
//   - Skipped if Saturday is a hard-strength session that also carries
//     combined conditioning (it's already doing the peak work).
//   - Target swap partner: the highest-priority weekday standalone
//     conditioning. Priority: vo2 > glycolytic > high-intensity > sprint.
//     Aerobic base and tempo conditioning are NOT the peak — leave them.
//   - Never swaps INTO a team day or a day adjacent to one (fatigue).
//   - Never swaps if the swap would leave the chosen weekday vacant of
//     load it shouldn't lose (hard-exposure strength).
function enforceWeekendPeak(plan: SessionAllocation[]): void {
  const saturday = plan.find(s => s.dayOfWeek === 'Saturday');
  if (!saturday) return;
  if (saturday.isTeamDay) return;

  const isPeakConditioning = (s: SessionAllocation): boolean => {
    if (s.isTeamDay) return false;
    if (s.hasCombinedConditioning) return false; // combined = strength+cond, not standalone peak
    // Must be a STANDALONE conditioning session (no strength focus).
    const focusLc = s.focus.toLowerCase();
    const looksStandalone =
      focusLc.startsWith('conditioning')
      || focusLc.includes('standalone')
      || !(focusLc.includes('strength') || focusLc.includes('upper body') || focusLc.includes('lower body') || focusLc.includes('full body'));
    if (!looksStandalone) return false;
    return s.conditioningCategory === 'vo2'
        || s.conditioningCategory === 'glycolytic'
        || s.conditioningFlavour === 'high-intensity';
  };

  // If Saturday is already a peak standalone, nothing to do.
  if (isPeakConditioning(saturday)) return;

  // Priority order: vo2 > glycolytic > high-intensity flavour > anything else peak
  const peakRank = (s: SessionAllocation): number => {
    if (s.conditioningCategory === 'vo2') return 3;
    if (s.conditioningCategory === 'glycolytic') return 2;
    if (s.conditioningFlavour === 'high-intensity') return 1;
    return 0;
  };

  const candidates = plan
    .filter(s => s !== saturday && s.dayOfWeek !== 'Sunday' && isPeakConditioning(s))
    .sort((a, b) => peakRank(b) - peakRank(a));
  const swapPartner = candidates[0];
  if (!swapPartner || !swapPartner.dayOfWeek) return;

  // Saturday itself must be something we're willing to move to a weekday.
  // Don't relocate team days (handled above), recovery slots, or Game days.
  if (saturday.tier === 'recovery') return;
  if (/^game/i.test(saturday.focus)) return;

  // Execute swap: exchange dayOfWeek only. All other properties stay with
  // the session (so the "peak" stimulus moves to Saturday, not the label).
  const originalSatDow = saturday.dayOfWeek;
  const originalPartnerDow = swapPartner.dayOfWeek;
  saturday.dayOfWeek = originalPartnerDow;
  swapPartner.dayOfWeek = originalSatDow;
}

// ─── H-PRE-12: Max 3 Consecutive Field-Load Days ────────────────────────
//
// "Field load" = any day that stresses the athlete's locomotor/contact
// system: team training, core strength, or standalone conditioning.
// When 4+ such days stack consecutively, the body can't recover — we
// break the streak.
//
// Mechanism: CONVERSION, not reshuffling.
//   - Team days are IMMUTABLE (field load is the point of the day).
//   - Core strength hard-exposures are IMMUTABLE (primary stimulus).
//   - Breakable targets, in priority order:
//       1. Non-team standalone conditioning (downgrade tier OR demote
//          combined-cond off the day).
//       2. Non-team optional-tier days that happen to carry cond.
//   - We break the MIDDLE of the run first so the 4+ streak splits into
//     two shorter streaks rather than just being trimmed at the edge.
function enforceFieldLoadStreak(plan: SessionAllocation[]): void {
  if (!plan || plan.length === 0) return;

  const isFieldLoad = (s: SessionAllocation): boolean => {
    if (s.isTeamDay) return true;
    if (s.tier === 'recovery') return false;
    if (s.tier === 'optional' && !s.conditioningFlavour && !s.conditioningCategory) return false;
    // Any core session is field load.
    if (s.tier === 'core') return true;
    // Optional day with conditioning also counts.
    return !!(s.conditioningFlavour || s.conditioningCategory);
  };

  const isBreakable = (s: SessionAllocation): boolean => {
    if (s.isTeamDay) return false;
    if (s.tier === 'recovery') return false;
    // Hard strength exposures are sacrosanct — don't touch them.
    if (s.isHardExposure && !s.conditioningFlavour && !s.conditioningCategory && !s.hasCombinedConditioning) return false;
    // Standalone conditioning is the most replaceable field-load day.
    const standalone = !!(s.conditioningFlavour || s.conditioningCategory) && !s.hasCombinedConditioning;
    if (standalone) return true;
    // Only small finishers are breakable. Proper attached components are
    // planned conditioning work and must not be stripped by finisher cleanup.
    if (
      s.hasCombinedConditioning &&
      (s.attachedConditioningKind ?? 'finisher') === 'finisher' &&
      !s.isHardExposure
    ) return true;
    return false;
  };

  const breakDay = (s: SessionAllocation): void => {
    // Convert, don't relocate. Two strategies, in order:
    //   (a) If standalone conditioning → demote to recovery (mobility).
    //   (b) If combined conditioning → strip the conditioning tail.
    const standalone = !!(s.conditioningFlavour || s.conditioningCategory) && !s.hasCombinedConditioning;
    if (standalone) {
      s.tier = 'recovery';
      s.focus = 'Mobility, foam rolling, light movement';
      s.conditioningFlavour = undefined;
      s.conditioningCategory = undefined;
      s.conditioningFeel = undefined;
      s.conditioningVariant = undefined;
      s.ergModality = undefined;
      s.attachedConditioningKind = undefined;
      s.isHardExposure = false;
      // Standalone conditioning demoted to mobility is no longer a
      // strength exposure — clear any carried-over pattern (defensive;
      // standalone COND shouldn't have one).
      s.strengthPattern = undefined;
      return;
    }
    if (s.hasCombinedConditioning) {
      s.hasCombinedConditioning = false;
      s.attachedConditioningKind = undefined;
      s.conditioningFlavour = undefined;
      s.conditioningCategory = undefined;
      s.conditioningFeel = undefined;
      s.conditioningVariant = undefined;
      s.ergModality = undefined;
    }
  };

  // Multiple passes — one break per pass, in case the week has nested
  // streaks that only separate after a mid-run demotion.
  for (let pass = 0; pass < 3; pass++) {
    const byDay = [...plan]
      .map(s => ({ ref: s, dayNum: s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1 }))
      .filter(x => x.dayNum >= 0)
      .sort((a, b) => a.dayNum - b.dayNum);

    let runStart = 0;
    let broke = false;
    for (let i = 0; i <= byDay.length; i++) {
      const curr = byDay[i];
      const prev = byDay[i - 1];
      const ends =
        i === byDay.length
        || !isFieldLoad(curr.ref)
        || !prev
        || !isFieldLoad(prev.ref)
        || curr.dayNum - prev.dayNum !== 1;

      if (ends) {
        const runLen = i - runStart;
        if (runLen >= 4) {
          // Prefer mid-run break: indices runStart+1 .. i-2.
          // Try middle slots first, then edges.
          const midStart = runStart + 1;
          const midEnd = i - 2;
          let target: SessionAllocation | null = null;
          const thursdayBreak = byDay
            .slice(runStart, i)
            .find((entry) => entry.dayNum === 4 && isBreakable(entry.ref));
          if (thursdayBreak) {
            target = thursdayBreak.ref;
          }
          for (let j = midStart; j <= midEnd; j++) {
            if (target) break;
            if (isBreakable(byDay[j].ref)) { target = byDay[j].ref; break; }
          }
          if (!target) {
            for (let j = runStart; j < i; j++) {
              if (isBreakable(byDay[j].ref)) { target = byDay[j].ref; break; }
            }
          }
          if (target) {
            breakDay(target);
            broke = true;
            break;
          }
        }
        runStart = i;
      }
    }
    if (!broke) break;
  }
}

function enforceAdjacentRegionLimit(
  plan: SessionAllocation[],
  teamDayNumSet: Set<number> = new Set(),
): SessionAllocation[] {
  if (plan.length <= 2) return plan;

  // Work on a mutable copy sorted by day of week
  const result = [...plan].sort(
    (a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || '')
  );

  // At this stage the universal team-day label pass hasn't run yet, so
  // `isTeamDay` is undefined on every session. Read team-day membership
  // from the authoritative day-number Set passed in by the caller.
  const isTeamDay = (s: SessionAllocation): boolean => {
    const d = dayNameToNumber(s.dayOfWeek || '');
    return d >= 0 && teamDayNumSet.has(d);
  };

  // We may need multiple passes since a swap can create new adjacency.
  // Cap iterations to prevent infinite loops.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;

    for (let i = 2; i < result.length; i++) {
      const regionA = classifyGenerationAdjacencyRegion(result[i - 2]);
      const regionB = classifyGenerationAdjacencyRegion(result[i - 1]);
      const regionC = classifyGenerationAdjacencyRegion(result[i]);

      // Only care about non-neutral runs of 3
      if (regionA === 'neutral' || regionB === 'neutral' || regionC === 'neutral') continue;
      if (regionA !== regionB || regionB !== regionC) continue;

      // Check they're actually consecutive days (not e.g. Mon, Wed, Fri)
      const dayA = dayNameToNumber(result[i - 2].dayOfWeek || '');
      const dayB = dayNameToNumber(result[i - 1].dayOfWeek || '');
      const dayC = dayNameToNumber(result[i].dayOfWeek || '');
      if (dayB - dayA !== 1 || dayC - dayB !== 1) continue;

      const offendingRegion = regionC;
      let fixed = false;

      // ── Strategy 1: Demote an optional session in the run to neutral ──
      // Cheapest fix — preserves day assignments and G-relative placement.
      // Prefer the middle session (creates region → neutral → region).
      //
      // Team-day guard: never demote a team-day session here. Team days
      // are always promoted back to core by the team-label pass and their
      // focus gets overwritten — so demoting would silently undo itself
      // (and for a mobility demotion specifically, team-label would
      // wholesale-replace with a HARDER "field session" focus, inverting
      // the load-reduction intent).
      for (const idx of [i - 1, i, i - 2]) {
        if (isTeamDay(result[idx])) continue;
        if (result[idx].tier === 'optional') {
          result[idx] = {
            ...result[idx],
            focus: 'Mobility, foam rolling, light movement',
            tier: 'recovery',
            isHardExposure: false,
            // Mobility ≠ strength exposure — drop any pattern the session
            // previously carried so invariants don't over-count.
            strengthPattern: undefined,
          };
          fixed = true;
          changed = true;
          break;
        }
      }
      if (fixed) break;

      // ── Strategy 2: Swap day assignments with a different-region session ──
      // Moves sessions to different days to break clustering. More disruptive
      // than demoting, so only used when no optional sessions are available.
      //
      // Team-day guard: never swap across a team-day / non-team-day boundary
      // (in either direction). Team days are scheduling anchors fixed by the
      // club — their `dayOfWeek` is NOT ours to move. A cross-boundary swap
      // would either (a) leave a stale isTeamDay flag on the session moved
      // OUT of a team-day slot, or (b) allow a non-team session to land on
      // a team day where the team-label pass would then prefix "Team
      // training + " onto a focus that was never meant for the team-day
      // context. Restricting both endpoints to the same team/non-team class
      // preserves team-day semantics.
      for (let j = 0; j < result.length; j++) {
        if (j >= i - 2 && j <= i) continue; // skip the violating trio
        // Team-day boundary guard: swap endpoints must be same-class
        // (team↔team or non-team↔non-team). Checked against the immutable
        // teamDayNumSet so the guard holds even though `isTeamDay` isn't
        // populated on the SessionAllocation at this stage.
        if (isTeamDay(result[i]) !== isTeamDay(result[j])) continue;
        const candidateRegion = classifyGenerationAdjacencyRegion(result[j]);
        if (candidateRegion === offendingRegion) continue;

        const candidateDayNum = dayNameToNumber(result[j].dayOfWeek || '');

        // Check candidate's neighbours won't form a 3-run after swap
        const jPrev = j > 0 ? result[j - 1] : null;
        const jNext = j < result.length - 1 ? result[j + 1] : null;
        const jPrevDay = jPrev ? dayNameToNumber(jPrev.dayOfWeek || '') : -99;
        const jNextDay = jNext ? dayNameToNumber(jNext.dayOfWeek || '') : -99;
        const jPrevRegion = jPrev ? classifyGenerationAdjacencyRegion(jPrev) : 'neutral';
        const jNextRegion = jNext ? classifyGenerationAdjacencyRegion(jNext) : 'neutral';

        const adjBefore = (candidateDayNum - jPrevDay === 1) && jPrevRegion === offendingRegion;
        const adjAfter = (jNextDay - candidateDayNum === 1) && jNextRegion === offendingRegion;
        if (adjBefore && adjAfter) continue;

        // Swap day assignments (not array positions)
        const tempDay = result[i].dayOfWeek;
        result[i] = { ...result[i], dayOfWeek: result[j].dayOfWeek };
        result[j] = { ...result[j], dayOfWeek: tempDay };

        // Re-sort after swap
        result.sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));
        fixed = true;
        changed = true;
        break;
      }
      if (fixed) break;

      // ── Strategy 3: Flip the middle session's focus to opposite region ──
      // Last resort for all-core runs (e.g. 3 consecutive team days forced upper).
      // Flip the middle to create: upper → LOWER → upper.
      // Pick a specific upper pattern (push by default) to stay consistent with
      // canonical naming — vague "Upper body strength" is not emitted anywhere.
      const newFocus = offendingRegion === 'upper'
        ? 'Lower body strength'
        : 'Upper body - push emphasis';
      const newPattern: SessionAllocation['strengthPattern'] =
        offendingRegion === 'upper' ? 'lower' : 'push';
      result[i - 1] = {
        ...result[i - 1],
        focus: newFocus,
        // Keep strengthPattern in sync with the flipped focus — it's the
        // engine's source of truth for "what movement is loaded today".
        strengthPattern: newPattern,
      };
      changed = true;
      break;
    }

    if (!changed) break; // no violations found, we're done
  }

  return result;
}

function getOptionalFocus(inputs: CoachingInputs): string {
  if (inputs.seasonPhase === 'In-season') {
    return 'Upper body hypertrophy / trunk & accessory work';
  }
  if (inputs.seasonPhase === 'Pre-season') {
    return 'Light conditioning / accessory work / mobility';
  }
  // Off-season: low-fatigue accessories only — conditioning is handled
  // as a first-class session by the resolver, not shoehorned into optional.
  return 'Low-fatigue accessories - trunk, calves, groin, shoulder prehab';
}

// ─── AI Constraint Builder ───

function buildAIConstraints(
  inputs: CoachingInputs,
  readiness: ReadinessLevel,
  hardCap: number,
  existingHard: number,
  core: number,
  optional: number,
  recovery: number
): AIConstraints {
  const trainingAgePolicy = resolveTrainingAgePolicy(inputs.experienceLevel);
  // Lower body loading strategy — injuries MODIFY movement selection, not eliminate training.
  // 'avoid' is reserved for severe + constant pain only. Otherwise we train around it.
  let lowerBodyLoading: AIConstraints['lowerBodyLoading'] = 'normal';
  const lowerInjuries = inputs.injuries.filter((i) =>
    ['Hip', 'Knee', 'Ankle', 'Hamstring', 'Groin', 'Lower back'].includes(i.bodyArea)
  );
  if (lowerInjuries.length > 0) {
    const hasSevereConstant = lowerInjuries.some(
      (i) =>
        i.severity === 'Severe' &&
        i.movementTriggers?.includes('Constant')
    );
    // Only 'avoid' if severe AND constant — otherwise conservative (modify, don't eliminate)
    lowerBodyLoading = hasSevereConstant ? 'avoid' : 'conservative';
  }

  // Sprint loading strategy
  let sprintLoading: AIConstraints['sprintLoading'] = 'allowed';
  const activeReadiness = inputs.generationConstraints?.readiness;
  const activeInjuries = inputs.generationConstraints?.injuries ?? [];
  const offseasonSubphase = resolveOffseasonSubphase({
    seasonPhase: inputs.seasonPhase,
    explicitSubphase: inputs.offseasonSubphase,
    miniCycleNumber: inputs.miniCycleNumber,
    weekInBlock: inputs.weekInBlock,
    weekNumber: inputs.weekNumber,
  });
  const lowerLimbGenerationIssue = activeInjuries.some((injury) =>
    injury.severity >= 4 &&
    (injury.region === 'lower_body' ||
      injury.injuryKeys.some((key) =>
        key === 'hamstring' || key === 'knee' || key === 'calf' ||
        key === 'ankle' || key === 'adductor' || key === 'pubalgia',
      )),
  );
  if (inputs.sprintExposure === 'No sprint training') {
    sprintLoading = readiness === 'low' ? 'do-not-add' : 'conservative';
  }
  if (inputs.seasonPhase === 'In-season') {
    // In-season: footy training IS the running
    sprintLoading = 'do-not-add';
  }
  if (inputs.seasonPhase === 'Off-season' && offseasonSubphase !== 'late_offseason') {
    sprintLoading = 'do-not-add';
  }
  if (inputs.weekKind === 'deload') {
    sprintLoading = 'do-not-add';
  }
  if (activeReadiness?.avoidSprint || lowerLimbGenerationIssue) {
    sprintLoading = 'do-not-add';
  }

  // Conditioning loading
  let conditioningLoading: AIConstraints['conditioningLoading'] = 'full';
  if (inputs.seasonPhase === 'In-season') {
    conditioningLoading = 'light-only'; // No extra running in-season
  } else if (activeReadiness?.preferRecovery || activeReadiness?.avoidHardConditioning) {
    conditioningLoading = activeReadiness.preferRecovery ? 'light-only' : 'moderate';
  } else if (readiness === 'low') {
    conditioningLoading = 'moderate';
  }

  // Injury restrictions as strings for AI prompt — include severity-aware action guidance
  const injuryRestrictions = inputs.injuries.map((i) => {
    const parts = [i.bodyArea];
    if (i.severity) parts.push(i.severity.toLowerCase());
    if (i.movementTriggers && i.movementTriggers.length > 0) {
      parts.push(`triggers: ${i.movementTriggers.join(', ')}`);
    } else if (i.whenItHurts) {
      parts.push(`hurts when ${i.whenItHurts.toLowerCase()}`);
    }
    if (i.notes) parts.push(`notes: ${i.notes}`);
    // Add severity-aware action so the AI knows how to respond
    if (i.severity === 'Mild') {
      parts.push('ACTION: train normally, slight awareness - swap only directly painful movements');
    } else if (i.severity === 'Moderate') {
      parts.push('ACTION: modify trigger movements, reduce load/ROM - keep training structure intact');
    } else if (i.severity === 'Severe') {
      const isConstant = i.movementTriggers?.includes('Constant');
      parts.push(isConstant
        ? 'ACTION: avoid directly aggravating patterns, replace with safe alternatives - still train other patterns'
        : 'ACTION: remove only the specific trigger movements, replace with non-aggravating alternatives - maintain training volume');
    }
    return parts.join(' - ');
  });
  for (const injury of activeInjuries) {
    injuryRestrictions.push(
      `${injury.bodyPart} active ${injury.severity}/10 (${injury.severityBand}) - ` +
      `triggers: ${injury.triggers.join(', ') || 'not specified'} - ` +
      (injury.pauseAffectedTraining
        ? 'ACTION: pause affected training only; keep clearly unaffected strength and easy conditioning'
        : injury.removeRiskyWork
          ? 'ACTION: remove risky affected work; keep unaffected strength and easy conditioning'
          : injury.reduceAffectedWork
            ? 'ACTION: reduce/swap affected work; keep safe work'
            : 'ACTION: avoid exact trigger only; keep normal safe training'),
    );
  }

  // Ramp-up flag
  const rampUp =
    readiness === 'low' ||
    inputs.recentTrainingLoad === 'Hardly at all' ||
    inputs.recentTrainingLoad === 'A bit';

  // Safety notes
  const notes: string[] = [];
  if (rampUp) {
    notes.push('Athlete needs gradual ramp-up - do NOT prescribe full volume immediately');
  }
  if (inputs.seasonPhase === 'Pre-season') {
    const teamDayList = (inputs.teamTrainingDays && inputs.teamTrainingDays.length > 0)
      ? inputs.teamTrainingDays.join(' and ')
      : null;
    notes.push('PRE-SEASON: Team training days are PRIMARY FIELD-LOAD ANCHORS - treat them as real running/field stress, not as rest days with gym on top.');
    if (teamDayList) {
      notes.push(`PRE-SEASON TEAM DAYS: ${teamDayList}. These days count as hard exposures because team training provides sprint, aerobic, and contact load.`);
    }
    notes.push('NO separate conditioning on a team training day. No tempo / VO2 / glycolytic / sprint finisher. No "+ conditioning" suffix. The team session IS the conditioning.');
    notes.push('NO heavy lower strength on a team training day (no dedicated squat or hinge focus). If gym is programmed on a team day, use: light upper, light full body (moderate load, cover all patterns), or low-fatigue support work (accessories, trunk, calves, groin, prehab).');
    notes.push('NO standalone sprint/speed conditioning on the day before or day after a team training day. Protect neural freshness and soft tissue recovery around team sessions.');
    notes.push('PRIORITISE VO2 and glycolytic first, then aerobic base; sprint work is mostly covered by team training and should only be added when team load is light.');
    notes.push('STANDALONE CONDITIONING VOLUME is reduced compared with off-season because team training already covers field load. Gym complements team load - extra conditioning only fills gaps.');
    notes.push('PRE-SEASON WEEKLY STRUCTURE: team sessions provide major field stress → gym complements team load → extra conditioning fills remaining gaps only where appropriate.');
  }
  if (inputs.seasonPhase === 'Off-season') {
    if (offseasonSubphase === 'late_offseason') {
      notes.push('LATE OFF-SEASON: one small true-speed exposure may be added if the athlete is fresh, healthy, and placement is safe. Keep it low volume and before fatigue.');
    } else {
      notes.push('EARLY/MID OFF-SEASON: do not add sprint work yet. Prioritise strength, size, base conditioning, recovery, and controlled movement quality.');
    }
  }
  if (inputs.weekKind === 'deload') {
    notes.push('DELOAD WEEK: do not add app-side sprint or true-speed work. Keep sprint/COD exposure only from existing team training, practice match, or game anchors.');
  }
  if (inputs.seasonPhase === 'In-season') {
    notes.push('IN-SEASON: Anchor ENTIRE week to game day (G). All scheduling is G-relative, NOT fixed weekdays.');
    notes.push('PREFERRED TARGET: 3 CORE gym sessions (1× Lower, 1× Upper Pull, 1× Upper Push). If only 2 CORE sessions fit (low budget or readiness), use: 1× Lower + 1× Balanced Upper (push + pull merged). If only 1 CORE session fits, use: 1× Basic Full Body (1 squat/hinge + 1 push + 1 pull, moderate volume). NEVER omit an entire movement category.');
    notes.push('3-CORE PLACEMENT: Lower earliest (G−5), Pull next (G−4, pair with team training), Push late (G−2, moderate intensity). This creates: Lower → Pull → gap → Push - good spacing.');
    notes.push('2-CORE PLACEMENT: Lower earliest (G−5), Balanced Upper at G−2 (moderate intensity). The balanced upper should include 1 main push (moderate load, 3×4-6), 1 main pull (moderate load), plus 1-2 accessories. Both push and pull patterns are covered in a single session.');
    notes.push('1-CORE PLACEMENT: Basic Full Body at best available slot (G−5 preferred). Include 1 squat or hinge, 1 horizontal/vertical push, 1 horizontal/vertical pull, plus 1-2 prehab accessories. Moderate volume - cover all patterns rather than loading any one heavily.');
    notes.push('NO BACK-TO-BACK UPPER: Do NOT place pull and push on consecutive days (e.g. Tue pull → Wed push → Thu push). Space upper exposures with at least 1 day gap where possible.');
    notes.push('G−3 (WEDNESDAY) = OPTIONAL or RECOVERY by default. Light accessories, trunk, calves, groin, shoulder prehab, mobility. ONLY promote to CORE if a required exposure genuinely cannot fit elsewhere.');
    notes.push('G−2 UPPER IS CORE: The upper session at G−2 is a required exposure (not optional). If 3-core: push emphasis. If 2-core: balanced upper (push + pull). Moderate intensity in both cases. Do NOT make it a hypertrophy pump session.');
    notes.push('G−1: ABSOLUTE ZERO sprinting, speed work, conditioning, lower body, or plyometrics. Arms/pump ONLY. Always OPTIONAL tier.');
    notes.push('G+1: Recovery ONLY. Always RECOVERY tier.');
    notes.push('CORE means true key sessions ONLY. 3 CORE gym + Game Day is the ideal ceiling - do NOT add more. If readiness or schedule makes 3 impractical, 2 CORE is fine.');
    notes.push('OPTIONAL ≠ junk. OPTIONAL can include: trunk, calves, groin, shoulder health, arms pump, low-fatigue balancing work. But OPTIONAL should not replace a missing CORE.');
    notes.push('No conditioning within 48h of game. No high-DOMS lower body in last 72h before game. No heavy lower body after G−4.');
    notes.push('Sprint exposure covered by team training + games - do NOT add extra sprints or conditioning.');
    notes.push('PATTERN FREQUENCY: Pull max 2x/week, Push max 2-3x/week, Heavy hinge max 2x/week, Heavy squat max 2x/week. No same pattern on consecutive days.');
    notes.push('STRUCTURE FIRST: Place exposure type + tier + day FIRST, then fill exercises. Do NOT build exercises first and assign tiers after.');
    notes.push('MERGING: If 3 separate sessions cannot fit, merge intelligently. 2-core: push+pull=balanced upper. 1-core: lower+push+pull=basic full body. NEVER simply omit a movement category.');
    notes.push('PRIORITISE: 1) game day freshness, 2) sensible spacing, 3) movement balance, 4) exercise selection. Do NOT chase perfect balance by jamming patterns into adjacent days.');
  }
  if (existingHard >= hardCap) {
    notes.push(`Hard exposure budget FULL (${existingHard}/${hardCap}) - all gym sessions should be moderate or light`);
  }
  notes.push('Injuries MODIFY training - they do NOT eliminate it. Train around limitations, replace movements, maintain stimulus.');
  notes.push('NEVER default to all-recovery programs unless injuries are severe AND constant. Keep strength, power, and conditioning pillars.');
  notes.push('Ensure at least 1 true recovery / low-load day per week');

  return {
    phase: inputs.seasonPhase,
    readiness,
    hardExposureCap: hardCap,
    existingHardExposures: existingHard,
    coreSessionsToProgram: core,
    optionalSessionsAllowed: optional,
    recoverySessionsAllowed: recovery,
    lowerBodyLoading,
    sprintLoading,
    conditioningLoading,
    injuryRestrictions,
    priorities: inputs.goals || [],
    rampUp,
    maxExercisesPerSession: trainingAgePolicy.maxExercisesPerStrengthSession,
    notes,
  };
}

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
  const rawPrefDays = (data.preferredTrainingDays || []) as string[];
  const blockedDays = activeUnavailableDays(data, options.availabilityDateISO);
  const prefDays = rawPrefDays.filter((day) => !blockedDays.has(day));
  const teamDays = (data.teamTrainingDays || []) as string[];
  const selectedDays: string[] = [...prefDays];
  for (const td of teamDays) {
    if (!selectedDays.includes(td)) selectedDays.push(td);
  }
  const baseTrainingDays = data.trainingDaysPerWeek || prefDays.length || 3;
  const baseAvailableDays = blockedDays.size > 0
    ? Math.min(baseTrainingDays, selectedDays.length)
    : baseTrainingDays;
  // availableDays feeds conditioning-target math. If team days forced the
  // actual schedulable-day count above the user's declared budget, lift
  // availableDays to match — otherwise conditioning targets under-count
  // relative to the real week shape (e.g. 5 schedulable days but 4-day
  // conditioning budget → one slot gets no prescription).
  const availableDays = Math.max(baseAvailableDays, selectedDays.length);
  return {
    seasonPhase: data.seasonPhase || 'Pre-season',
    availableDays,
    selectedDays: selectedDays as any,
    teamTrainingDaysPerWeek: data.teamTrainingDaysPerWeek || 0,
    teamTrainingDays: teamDays as any,
    teamTrainingIntensity: data.teamTrainingIntensity,
    sprintExposure: data.sprintExposure,
    conditioningLevel: data.conditioningLevel,
    recentTrainingLoad: data.recentTrainingLoad,
    experienceLevel: data.experienceLevel,
    injuries: data.injuries || [],
    goals: data.motivation ? data.motivation.split(', ') : [],
    role: data.position,
    // hasGame means "a specific game is scheduled this week" — it must NOT be
    // a proxy for "phase has team-level context". Previously this was
    // `seasonPhase === 'In-season' || seasonPhase === 'Pre-season'` which made
    // hasGame=true in pre-season even when no game day existed (the log output
    // "gameDay: NONE, hasGame: true" was a symptom of that). That inflated
    // hard-exposure counts in `countTeamHardExposures` for pre-season weeks.
    // Now: hasGame is true iff there is an actual game day on the profile.
    // Off-season always has hasGame=false (no game day). Pre-season only has
    // hasGame=true if the athlete has set a usualGameDay/gameDay.
    hasGame: Boolean(data.usualGameDay || data.gameDay),
    // Prefer the new usualGameDay (full DayOfWeek) over the legacy gameDay field
    // so the in-season phase-shift flow drives game-proximity scheduling immediately.
    gameDay: data.usualGameDay || data.gameDay,
    weekNumber: options.weekNumber,
    miniCycleNumber: options.miniCycleNumber,
    weekInBlock: options.weekInBlock,
    weekKind: options.weekKind,
    offseasonSubphase: options.offseasonSubphase,
    preseasonSubphase: options.preseasonSubphase,
    generationConstraints: options.generationConstraints,
  };
}

function activeUnavailableDays(data: OnboardingData, availabilityDateISO?: string): Set<string> {
  const out = new Set<string>();
  for (const constraint of data.availabilityConstraints ?? []) {
    if (constraint.active === false) continue;
    if (constraint.kind !== 'unavailable_day') continue;
    if (!constraint.dayOfWeek) continue;
    if (constraint.scope === 'temporary' && availabilityDateISO) {
      if (constraint.startDate && constraint.startDate > availabilityDateISO) continue;
      if (constraint.endDate && constraint.endDate < availabilityDateISO) continue;
    }
    out.add(constraint.dayOfWeek);
  }
  return out;
}
