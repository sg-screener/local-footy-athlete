import { OFFSEASON_PREPARATION } from './offseasonSubphasePolicy';
import type {
  CapacityBand,
  SeasonPhase,
  WeekKind,
} from '../types/domain';
import { resolveWeekIntensityMultiplier } from './deloadWeekRules';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { PreseasonSubphase } from './preseasonSubphase';
import type { MainStrengthPattern } from './strengthPatternContributions';
import type { CanonicalWeeklyInjuryPolicy } from './canonicalWeeklyInjuryState';
import {
  resolveSection18PhasePlannerSelection,
  type Section18PhasePlannerSelection,
  type Section18WeekMode,
} from './weeklyExposureContractV2';
import {
  addExposureReduction,
  trainingOrder,
  uniqueExposureDays,
  withExposureTarget,
  type WeeklyExposureContract,
  type WeeklyExposureContractMode,
  type WeeklyExposureContractSubphase,
  type WeeklyExposureDomain,
  type WeeklyExposureReductionReason,
} from './weeklyExposureContract';

export interface WeeklyExposureContractInput {
  seasonPhase: SeasonPhase;
  capacity: CapacityBand;
  selectedDayNumbers: readonly number[];
  teamTrainingDayNumbers: readonly number[];
  hasGame: boolean;
  gameDay: number | null;
  weekKind?: WeekKind;
  offseasonSubphase?: OffseasonSubphase | null;
  preseasonSubphase?: PreseasonSubphase | null;
  /** True when this week falls inside a readiness/illness/scheduled deload. */
  readinessDeloaded?: boolean;
  maxStrengthSessions?: number | null;
  /** False means the resolved equipment set cannot deliver an app conditioning block. */
  appConditioningFeasible?: boolean;
  /** Ordered substitution proof recorded when feasibility is exhausted. */
  attemptedConditioningSubstitutions?: readonly string[];
  /** Canonical compiler input. Raw injury copy and severity never reach this builder. */
  injuryPolicy?: CanonicalWeeklyInjuryPolicy;
  /**
   * The athlete's answer to the bye ask, and the ONLY producer of
   * `in_season_bye_recovery` (Sam, 2026-07-29). Omitted means unanswered, which
   * is a BUILD bye — never "let something else decide", which is what this field
   * used to mean.
   */
  byeMode?: 'build' | 'recovery';
  /**
   * Derived week mode, minted by the single composition-boundary owner
   * (`deriveIllnessRecoveryWeekMode`) at generation and PRESERVED verbatim on
   * re-derivation. When set it wins over readiness/injury/bye logic; the builder
   * never re-reads facts.
   */
  weekModeOverride?: 'optional_week';
}

const ALL_PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

interface BaseTargets {
  mode: WeeklyExposureContractMode;
  subphase: WeeklyExposureContractSubphase;
  strength: { required: number; preferredMin: number; preferredMax: number; selectedTarget?: number };
  conditioning: { required: number; preferredMin: number; preferredMax: number; selectedTarget?: number };
  sprintCod: { required: number; preferredMin: number; preferredMax: number; selectedTarget?: number };
  fullRest: { required: number; preferredMin: number; preferredMax: number };
  allowCombined: boolean;
  preferredHardDays: number;
  permittedHardDays: number;
}

function phaseSelection(
  input: WeeklyExposureContractInput,
  mode: Section18WeekMode,
): Section18PhasePlannerSelection {
  return resolveSection18PhasePlannerSelection({
    mode,
    capacity: input.capacity,
    availableDayCount: uniqueExposureDays(input.selectedDayNumbers).length,
    teamTrainingCount: uniqueExposureDays(input.teamTrainingDayNumbers).length,
    weekKind: input.weekKind,
  });
}

function createBaseContract(
  input: WeeklyExposureContractInput,
  targets: BaseTargets,
): WeeklyExposureContract {
  const selected = uniqueExposureDays(input.selectedDayNumbers);
  const selectedSet = new Set(selected);
  const teamDays = uniqueExposureDays(input.teamTrainingDayNumbers)
    .filter((day) => selectedSet.has(day));
  const fixtureCredit = input.hasGame && input.gameDay !== null ? 1 : 0;
  const anchorCredit = teamDays.length + fixtureCredit;
  // No mode-specific floor lives here any more. illness_recovery used to zero
  // the anchor credit at this line so it could not FLOOR a requirement; it is now
  // a decoration applied AFTER the week is built (`asIllnessRecoveryWeek`), which
  // zeroes the requirements directly. Credited counts stay factual either way.
  const floorCredit = anchorCredit;
  const conditioningRequired = Math.max(targets.conditioning.required, floorCredit);
  const selectedConditioning = Math.max(
    targets.conditioning.selectedTarget ?? targets.conditioning.required,
    floorCredit,
  );
  return {
    protocolVersion: 1,
    identity: {
      phase: input.seasonPhase,
      subphase: targets.subphase,
      mode: targets.mode,
      weekKind: input.weekKind ?? 'build',
    },
    strength: {
      requiredPatterns: targets.strength.required > 0 ? [...ALL_PATTERNS] : [],
      targetCount: targets.strength.selectedTarget ?? targets.strength.required,
      required: targets.strength.required,
      preferred: { min: targets.strength.preferredMin, max: targets.strength.preferredMax },
    },
    conditioning: {
      targetCount: selectedConditioning,
      required: conditioningRequired,
      preferred: {
        min: Math.max(targets.conditioning.preferredMin, floorCredit),
        max: Math.max(targets.conditioning.preferredMax, floorCredit),
      },
      creditedTeamTrainingCount: teamDays.length,
      creditedGameOrPracticeMatchCount: fixtureCredit,
      additionalRequiredCount: Math.max(0, selectedConditioning - anchorCredit),
      allowCombinedStrengthConditioning: targets.allowCombined,
    },
    sprintCod: {
      targetCount: targets.sprintCod.selectedTarget ?? targets.sprintCod.required,
      required: targets.sprintCod.required,
      preferred: {
        min: targets.sprintCod.preferredMin,
        max: targets.sprintCod.preferredMax,
      },
      creditedTeamTrainingCount: teamDays.length,
      creditedGameOrPracticeMatchCount: fixtureCredit,
      additionalRequiredCount: Math.max(
        0,
        (targets.sprintCod.selectedTarget ?? targets.sprintCod.required) - anchorCredit,
      ),
    },
    anchors: {
      teamTrainingDays: teamDays,
      gameDay: input.hasGame ? input.gameDay : null,
      gameOrPracticeMatchCredit: fixtureCredit,
    },
    fullRest: {
      required: targets.fullRest.required,
      preferred: { min: targets.fullRest.preferredMin, max: targets.fullRest.preferredMax },
    },
    recovery: { minimumFullRestDays: targets.fullRest.required },
    hardDays: {
      preferredCount: targets.preferredHardDays,
      permittedCount: targets.permittedHardDays,
      isHardMaximum: false,
    },
    reductions: [],
  };
}

function reduce(
  contract: WeeklyExposureContract,
  domain: WeeklyExposureDomain,
  to: number,
  reason: WeeklyExposureReductionReason,
  detail: string,
): WeeklyExposureContract {
  return withExposureTarget(contract, domain, to, reason, detail);
}

function reduceAllocationTarget(
  initial: WeeklyExposureContract,
  domain: Exclude<WeeklyExposureDomain, 'full_rest'>,
  to: number,
  reason: WeeklyExposureReductionReason,
  detail: string,
): WeeklyExposureContract {
  const contract = reduce(initial, domain, to, reason, detail);
  const target = Math.max(0, Math.floor(to));
  const current = domain === 'main_strength'
    ? contract.strength.targetCount
    : domain === 'conditioning'
      ? contract.conditioning.targetCount
      : contract.sprintCod.targetCount;
  if (target >= current) return contract;
  addExposureReduction(contract.reductions, {
    domain,
    reason,
    metric: 'weekly_exposure_count',
    from: current,
    to: target,
    detail,
  });
  if (domain === 'main_strength') {
    contract.strength.targetCount = target;
    contract.strength.preferred.min = Math.min(contract.strength.preferred.min, target);
    contract.strength.preferred.max = Math.min(contract.strength.preferred.max, target);
  } else if (domain === 'conditioning') {
    contract.conditioning.targetCount = target;
    contract.conditioning.preferred.min = Math.min(contract.conditioning.preferred.min, target);
    contract.conditioning.preferred.max = Math.min(contract.conditioning.preferred.max, target);
  } else {
    contract.sprintCod.targetCount = target;
    contract.sprintCod.preferred.min = Math.min(contract.sprintCod.preferred.min, target);
    contract.sprintCod.preferred.max = Math.min(contract.sprintCod.preferred.max, target);
  }
  return contract;
}

/** Shared typed constraint projection; policy consumers must not reclassify injuries independently. */
export function resolveRestrictedMainStrengthPatterns(
  input: Pick<WeeklyExposureContractInput, 'injuryPolicy'>,
): Set<MainStrengthPattern> {
  return new Set(input.injuryPolicy?.prohibitedPatterns ?? []);
}

function applyCommonSafetyReductions(
  initial: WeeklyExposureContract,
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  let contract = initial;
  const selected = uniqueExposureDays(input.selectedDayNumbers);
  const selectedSet = new Set(selected);
  const teamDays = uniqueExposureDays(input.teamTrainingDayNumbers).filter((day) => selectedSet.has(day));
  const anchorCredit = teamDays.length + (input.hasGame && input.gameDay !== null ? 1 : 0);
  const nonTeamDays = selected.filter((day) => !teamDays.includes(day) && day !== input.gameDay);
  const gameOffset = (day: number): number | null => {
    if (!input.hasGame || input.gameDay === null) return null;
    let offset = day - input.gameDay;
    if (offset > 0) offset -= 7;
    return offset === -6 ? 1 : offset;
  };
  // The excluded offsets are quoted Bible rules, not spacing heuristics — see
  // src/data/bibleThresholdAnchors.ts.
  // BIBLE_ANCHOR: g_minus_1_optional_only
  // BIBLE_ANCHOR: g_plus_1_rest_or_recovery
  const conditioningPlacementDays = nonTeamDays.filter((day) => {
    const offset = gameOffset(day);
    if (offset === null) return true;
    return offset !== -2 && offset !== -1 && offset !== 1;
  });
  // BIBLE_ANCHOR: g_minus_2_no_heavy_lower_or_speed
  const sprintPlacementDays = nonTeamDays.filter((day) => {
    const offset = gameOffset(day);
    if (offset === null) return true;
    return offset !== -2 && offset !== -1 && offset !== 1;
  });

  // RETIRED (Sam's readiness law, 2026-07-27). These reduced session COUNTS by
  // tier — main_strength to 0 on a full pause, sprint_cod on a slight reduction.
  // Counts are STRUCTURE, and the deload law holds structure constant while the
  // work inside shrinks. A deloaded week keeps its targets; the sessions arrive
  // smaller. Reinstating a reduction here at any magnitude would be the tier
  // system in disguise.
  void input.readinessDeloaded;

  const blockedPatterns = resolveRestrictedMainStrengthPatterns(input);
  if (blockedPatterns.size > 0) {
    const allowed = ALL_PATTERNS.filter((pattern) => !blockedPatterns.has(pattern));
    contract.strength.requiredPatterns = contract.strength.required > 0 ? allowed : [];
    addExposureReduction(contract.reductions, {
      domain: 'main_strength',
      reason: 'injury_restriction',
      metric: 'strength_pattern_count',
      from: ALL_PATTERNS.length,
      to: allowed.length,
      detail: `Active injury restrictions remove affected strength patterns: ${Array.from(blockedPatterns).join(', ')}.`,
    });
    // THE SECOND SITE THAT STATES THE FREQUENCY RULE, and the one that governs
    // an off-season week's allocation. It capped `targetCount` at
    // `allowed.length`, which is the pattern-count cap wearing the allocation's
    // clothes; `section18SafetyPolicy` carries the matching ruling comment.
    //
    // CITATION CORRECTED 2026-08-06. This comment cited Bible `:4755` for the
    // substitute-before-reduce rule ON INJURY. Line 4755 sits under EQUIPMENT
    // ("Substitute before reducing frequency" — running, walking, ergs). The
    // INJURY bands are authored separately at `:1920-1926` ("Pause affected
    // training ... Use rest, recovery, or clearly unaffected training only"),
    // `:2200` and `:4108`. Both rules point the same way here, so no behaviour
    // rested on the wrong line — but the load-bearing citation for injury is not
    // the one that was written, and a comment that cites the wrong section is
    // how the next reader inherits the wrong rule.
    //
    // Bible `:1920-1926` / `:2200` / `:4108` — pause the affected work and use
    // clearly unaffected training. The week keeps its count and fills the freed
    // days with safe work; only a whole-body restriction removes the work
    // itself. Where the calendar leaves no eligible day for the safe patterns,
    // `lower_strength_g3`'s state-2 exception is what fills it — see the G-2
    // quality-lower last resort in `coachingEngine.buildWeeklyPlan`.
    if (allowed.length === 0) {
      contract = reduceAllocationTarget(contract, 'main_strength', 0,
        'injury_restriction',
        `Active injury restrictions remove every main-strength pattern: ${Array.from(blockedPatterns).join(', ')}.`);
    }
    const lowerBlocked = blockedPatterns.has('squat') || blockedPatterns.has('hinge');
    if (lowerBlocked) {
      contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit), 'injury_restriction',
        'A lower-limb or back restriction removes app-authored sprint/COD.');
    }
  }

  const activeInjuryBlocksSprint = input.injuryPolicy?.blocksAppSprint === true;
  if (activeInjuryBlocksSprint) {
    contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit),
      'injury_restriction',
      'An active lower-body or back restriction explicitly removes app-authored sprint/COD.');
  }

  if (input.seasonPhase === 'Pre-season' && teamDays.length > 0 && nonTeamDays.length === 0) {
    contract.strength.requiredPatterns = contract.strength.required > 0 ? ['push', 'pull'] : [];
    addExposureReduction(contract.reductions, {
      domain: 'main_strength',
      reason: 'spacing_safety_conflict',
      metric: 'strength_pattern_count',
      from: ALL_PATTERNS.length,
      to: 2,
      detail: 'Every available day is a team-training anchor, so required gym pattern coverage is limited to safe upper-body work.',
    });
  }

  if (input.maxStrengthSessions !== null && input.maxStrengthSessions !== undefined) {
    contract = reduceAllocationTarget(contract, 'main_strength', Math.min(contract.strength.targetCount, input.maxStrengthSessions),
      'training_age_limit',
      'Training-age policy consolidates the weekly strength dose.');
    if (input.maxStrengthSessions <= 2) {
      contract.conditioning.allowCombinedStrengthConditioning = false;
    }
  }

  // STRENGTH WAS THE ONLY ALLOCATION COUNTING A DAY IT CAN NEVER USE (item 7a).
  //
  // Conditioning is capped at `anchorCredit + conditioningPlacementDays`, sprint
  // at `anchorCredit + sprintPlacementDays`. Strength alone used raw
  // `selected.length` — every selected day, THE GAME DAY INCLUDED — so its
  // capacity counted a day no strength session can be placed on.
  //
  // TEAM DAYS ARE NOT THE DEFECT AND ARE DELIBERATELY STILL COUNTED: strength
  // legitimately STACKS on a team night ("Team Training + Upper Pull" is a real
  // generated session), which is why this uses its own set rather than the
  // existing `nonTeamDays`, which drops both.
  //
  // MEASURED BEFORE AND AFTER, AND IT IS INERT TODAY: across all 34 QA weeks the
  // game day is never among the selected training days, so this changes no
  // shipped week. It is fixed anyway because NOTHING PREVENTS the overlap —
  // `selectedDays` and `gameDay` are independent onboarding answers with no
  // filter between them — so the miscount is reachable and simply unexercised.
  // The cell for it BUILDS that coordinate rather than waiting for a fixture to.
  const strengthCapacityDays = selected.filter(
    (day) => !(input.hasGame && input.gameDay !== null && day === input.gameDay),
  );
  contract = reduceAllocationTarget(contract, 'main_strength', Math.min(contract.strength.targetCount, strengthCapacityDays.length),
    'insufficient_availability',
    'Selected-day availability cannot safely hold the original strength target.');
  const maximumConditioning = anchorCredit + conditioningPlacementDays.length;
  contract = reduceAllocationTarget(contract, 'conditioning', Math.min(contract.conditioning.targetCount, maximumConditioning),
    'insufficient_availability',
    'No additional safe non-anchor slot remains for conditioning.');
  contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(contract.sprintCod.targetCount, anchorCredit + sprintPlacementDays.length),
    'insufficient_availability',
    'No additional safe non-anchor slot remains for sprint/COD.');

  if (input.appConditioningFeasible === false && contract.conditioning.additionalRequiredCount > 0) {
    contract = reduceAllocationTarget(contract, 'conditioning', anchorCredit, 'equipment_infeasibility',
      `No safe equivalent app-conditioning modality remained after attempts: ${(input.attemptedConditioningSubstitutions ?? []).join(', ') || 'none recorded'}.`);
  }

  if (!contract.conditioning.allowCombinedStrengthConditioning) {
    const standaloneConditioningCapacity = Math.max(
      0,
      conditioningPlacementDays.length - contract.strength.targetCount,
    );
    contract = reduceAllocationTarget(
      contract,
      'conditioning',
      Math.min(contract.conditioning.targetCount, anchorCredit + standaloneConditioningCapacity),
      'insufficient_availability',
      'Required strength owns the available app slots and combined conditioning is not authorised.',
    );
  }

  if (input.weekKind === 'deload') {
    const intensityPercent = Math.round(
      resolveWeekIntensityMultiplier(input.seasonPhase, input.weekKind) * 100,
    );
    if (intensityPercent < 100) {
      addExposureReduction(contract.reductions, {
        domain: 'main_strength',
        reason: 'deload_policy',
        metric: 'session_intensity_percent',
        from: 100,
        to: intensityPercent,
        detail: 'The phase deload policy reduces session intensity while retaining safe movement-pattern frequency.',
      });
    }
    const appConditioningBeforeDeload = Math.max(
      0,
      contract.conditioning.targetCount - anchorCredit,
    );
    const appConditioningAfterDeload = anchorCredit >= 2
      ? Math.min(1, appConditioningBeforeDeload)
      : Math.min(2, Math.max(0, appConditioningBeforeDeload - 1));
    contract = reduceAllocationTarget(
      contract,
      'conditioning',
      anchorCredit + appConditioningAfterDeload,
      'deload_policy',
      'Deload policy preserves anchors and keeps at most two controlled app exposures, including one restorative top-up when anchor load is already high.',
    );
  }

  contract.conditioning.additionalRequiredCount = Math.max(
    0,
    contract.conditioning.targetCount - contract.conditioning.creditedTeamTrainingCount -
      contract.conditioning.creditedGameOrPracticeMatchCount,
  );
  contract.sprintCod.additionalRequiredCount = Math.max(
    0,
    contract.sprintCod.targetCount - contract.sprintCod.creditedTeamTrainingCount -
      contract.sprintCod.creditedGameOrPracticeMatchCount,
  );
  return contract;
}

/**
 * THE BYE MODE IS THE ATHLETE'S ANSWER (Sam, 2026-07-29).
 *
 * > A bye is detected from the fixture gap (existing law); build-vs-recovery is
 * > the ATHLETE'S choice via an ask — a typed schedule-class fact, the only
 * > producer of `in_season_bye_recovery`. Default is bye_build if unanswered.
 * > Facts may inform the ask's copy, never decide it.
 *
 * Four triggers have left this function across two rulings. Capacity and an
 * active injury went first (readiness law, 2026-07-28): the mode carries a
 * strength maximum of 2 against a build week's 3, so each of them cut a session
 * in the hardest way to see — a MODE change records no reduction anywhere, so
 * the week simply arrives smaller with a name that reads like a coaching
 * decision.
 *
 * The scheduled deload went with this ruling, superseding ruling 4's "the
 * scheduled deload is the intended entry condition". It could not be the entry
 * condition: the phase clock schedules deloads in pre-season and off-season and
 * NEVER in-season, so under ruling 4 the mode had no producer at all. And it
 * cannot coexist with "default is build if unanswered" — a deload bye nobody
 * answered would arrive as recovery.
 *
 * WHY AN ASK IS NOT A REGRESSION toward controls. The other phase-shape rulings
 * replace a control with a derivation from a fact the athlete already gives us
 * (`ONBOARDING_PHASE_SHAPE_RULINGS_2026-07-28.md`). This one does not contradict
 * them: the fixture gap still DERIVES the bye. What the schedule cannot answer is
 * what the athlete wants to do with the free week, because both answers are
 * legitimate for the same calendar. That question has no fact to derive from, so
 * it is asked — once, and its answer is stored as a fact like any other.
 *
 * `byeMode` is the seam that answer lands on. It has no producer in generation
 * today, deliberately: the ask belongs to the buttons/step-5 work, and until it
 * ships every bye is a build bye.
 */
function byeRecoveryMode(input: WeeklyExposureContractInput): boolean {
  return input.byeMode === 'recovery';
}

/**
 * THE FIXTURE-WEEK ROW (Sam, 2026-07-28).
 *
 * > A pre-season practice-match week is structurally an IN-SEASON GAME WEEK —
 * > same shape, 2 team trainings + 1 game — and carries the game week's
 * > authored numbers, not the generic pre-season row.
 *
 * So there is ONE authored fixture-week row and two weeks that reference it.
 * There used to be two rows: `buildPreseasonBase` took its selected target from
 * the `practice_match_week` policy and its preferred range from the generic
 * pre-season row, which left a single contract declaring a target of 3 beside
 * an aim of 4. Batch 0 surfaced it by aiming at the preferred maximum and
 * watching a pre-season fixture week ask for a fourth strength session the
 * fixture leaves nowhere safe to place.
 *
 * Like `strongByeBuild`, the ruling turned out to be a DELETION. Nothing had to
 * be authored to express it — the game week's row already said it, and the
 * second row was the defect.
 *
 * Conditioning is deliberately not here: on a fixture week it is anchor-derived
 * (the game and the team sessions ARE the exposures), so it is a function of
 * the athlete's schedule rather than a fixed triple. See `fixtureWeekConditioning`.
 */
const GAME_WEEK_TARGETS = {
  strength: { required: 2, preferredMin: 2, preferredMax: 3 },
  // The game/team anchors satisfy the shared floor without inflating it.
  //
  // ── R-079: IN SEASON, UP TO THREE SPRINT NIGHTS ─────────────────────────
  // **Sam, 2026-08-13: *"in season that may mean 3 sprint sessions"*.** The
  // team trainings and the game are what get it there, and **that is ACCEPTABLE,
  // not a breach** — the cap was 1, so a normal club week with two team nights
  // and a game was over its own ceiling by construction. His `:90` "2 nights"
  // is corrected by this ruling. The unit is NIGHTS (see the ledger's
  // `achievedCount`), so one evening carrying both a team night and a sprint
  // block is ONE.
  sprintCod: { required: 1, preferredMin: 1, preferredMax: 3 },
  fullRest: { required: 1, preferredMin: 1, preferredMax: 2 },
  allowCombined: true,
  preferredHardDays: 4,
  permittedHardDays: 5,
} as const;

function fixtureWeekConditioning(
  input: WeeklyExposureContractInput,
): { required: number; preferredMin: number; preferredMax: number } {
  const anchorCount = uniqueExposureDays(input.teamTrainingDayNumbers).length + 1;
  const total = Math.max(3, anchorCount);
  return { required: total, preferredMin: total, preferredMax: total };
}

/**
 * The one builder for a week with a fixture in it, in either phase.
 *
 * IDENTITY IS NOT SHAPE. The ruling says a practice-match week has the game
 * week's NUMBERS; it does not say the week has moved season. A pre-season
 * fixture week keeps its pre-season phase and subphase, because that is where
 * it sits in the athlete's year and Section 18 checks the declared subphase
 * against the season phase.
 */
function buildFixtureWeekContract(
  input: WeeklyExposureContractInput,
  identity: {
    mode: WeeklyExposureContractMode;
    subphase: WeeklyExposureContractSubphase;
    plannerMode: 'in_season_game_week' | 'practice_match_week';
  },
  spacingDetail: string,
): WeeklyExposureContract {
  const selected = phaseSelection(input, identity.plannerMode);
  let contract = applyCommonSafetyReductions(createBaseContract(input, {
    ...GAME_WEEK_TARGETS,
    mode: identity.mode,
    subphase: identity.subphase,
    strength: { ...GAME_WEEK_TARGETS.strength, selectedTarget: selected.mainStrength },
    conditioning: { ...fixtureWeekConditioning(input), selectedTarget: selected.coreConditioning },
    sprintCod: { ...GAME_WEEK_TARGETS.sprintCod, selectedTarget: selected.sprintHighSpeed },
  }), input);
  if (input.gameDay !== null) {
    // BIBLE_ANCHOR: game_day_no_programmed_sessions
    // BIBLE_ANCHOR: g_minus_1_optional_only
    const safeStrengthCapacity = uniqueExposureDays(input.selectedDayNumbers).filter((day) => {
      let offset = day - input.gameDay!;
      if (offset > 0) offset -= 7;
      if (offset === -6) offset = 1;
      return offset !== 0 && offset !== -1 && offset !== 1;
    }).length;
    contract = reduceAllocationTarget(
      contract,
      'main_strength',
      Math.min(contract.strength.targetCount, safeStrengthCapacity),
      'spacing_safety_conflict',
      spacingDetail,
    );
  }
  return contract;
}

export function buildInSeasonGameWeekExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  return buildFixtureWeekContract(
    input,
    { mode: 'in_season_game_week', subphase: 'game_week', plannerMode: 'in_season_game_week' },
    'Game-day, G-1 and G+1 protection leave fewer safe gym placements in this selected week.',
  );
}

export function buildInSeasonByeBuildExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'in_season_bye_build');
  return applyCommonSafetyReductions(createBaseContract(input, {
    mode: 'in_season_bye_build',
    subphase: 'bye_build',
    strength: { required: 2, preferredMin: 3, preferredMax: 4, selectedTarget: selected.mainStrength },
    // RULED (Sam, 2026-07-28): required 3, preferred max 4. The fourth is the
    // optional top of range for ANYONE — "if fresh" was expressly rejected as a
    // count condition, because that is capacity setting structure.
    conditioning: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.coreConditioning },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 1, preferredMin: 1, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  }), input);
}

export function buildInSeasonByeRecoveryExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'in_season_bye_recovery');
  const teams = uniqueExposureDays(input.teamTrainingDayNumbers).length;
  let contract = createBaseContract(input, {
    mode: 'in_season_bye_recovery',
    subphase: 'bye_recovery',
    strength: { required: 2, preferredMin: 2, preferredMax: 2, selectedTarget: selected.mainStrength },
    conditioning: { required: 0, preferredMin: 0, preferredMax: teams, selectedTarget: selected.coreConditioning },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 3 },
    allowCombined: false,
    preferredHardDays: 2,
    permittedHardDays: 4,
  });
  for (const domain of ['main_strength', 'conditioning', 'sprint_cod'] as WeeklyExposureDomain[]) {
    const before = domain === 'main_strength' ? 3 :
      domain === 'conditioning' ? 3 : 1;
    const after = domain === 'main_strength' ? contract.strength.required :
      domain === 'conditioning' ? contract.conditioning.required : contract.sprintCod.required;
    addExposureReduction(contract.reductions, {
      domain,
      reason: 'bye_recovery_mode',
      metric: 'weekly_exposure_count',
      from: before,
      to: after,
      detail: 'Bye recovery mode spends the missing game slot on restoration, not extra build work.',
    });
  }
  if (teams === 0) {
    contract = reduceAllocationTarget(
      contract,
      'sprint_cod',
      0,
      'bye_recovery_mode',
      'Bye recovery without a genuine team anchor removes app-authored sprint/high-speed work.',
    );
  }
  return applyCommonSafetyReductions(contract, input);
}

/**
 * Stamp a built week as illness_recovery: nothing required, everything optional.
 *
 * THE ILLNESS LAW (Sam, 2026-07-27) — severity decides exactly TWO things,
 * deload or not and optional or not. This is the second flag, and the ONLY thing
 * illness does to the contract.
 *
 * This used to be `buildIllnessRecoveryExposureContract`, which REPLACED the
 * phase contract with a hand-written one carrying its own counts: strength
 * capped at 2, conditioning at the team-day count, one sprint, four rest days,
 * no combined sessions. Every one of those was an illness-specific number, which
 * the law forbids, and every one was a COUNT — which the deload law holds
 * constant ("same week, same days: the structure does not change, the work
 * shrinks"). Deleting them without inventing replacements is only possible by
 * decorating the week that would otherwise have been built, so that is what this
 * does. The shrink is DELOAD_LAW's, applied to the dose, and does not live here.
 */
function asIllnessRecoveryWeek(contract: WeeklyExposureContract): WeeklyExposureContract {
  return {
    ...contract,
    // ONLY the mode. The subphase is where the week sits in the season, and an
    // optional week sits exactly where it always did — overwriting it was what
    // made an optional off-season week impossible to express.
    identity: { ...contract.identity, mode: 'optional_week' },
    strength: {
      ...contract.strength,
      // Nothing is REQUIRED, so no pattern is required either.
      requiredPatterns: [],
      required: 0,
    },
    conditioning: {
      ...contract.conditioning,
      required: 0,
      // Credited counts stay FACTUAL — the athlete's anchors are still on the
      // calendar. Only the floor they imply drops.
      additionalRequiredCount: 0,
    },
    sprintCod: {
      ...contract.sprintCod,
      required: 0,
      additionalRequiredCount: 0,
    },
  };
}

// `targetCount` is DELIBERATELY untouched above, in all three domains.
//
// It used to be zeroed here to stop §18 rejecting the week for a missed
// planner-selected target. That worked, and it also emptied the week: this
// number is what the generator reads to decide how many sessions to BUILD, so
// zeroing it meant a pre-season "absolutely cooked" week arrived as six
// recovery sessions. "Nothing is required" had been implemented as "nothing is
// offered", against Sam's law — "it does not empty the week. It lifts the
// MINIMUMS so nothing is required, and the sessions remain, OFFERED."
//
// One lever per question. `targetCount` is STRUCTURE and is preserved; the
// commitment is lifted by `plannerSelectionKind: 'optional'` in Contract v2,
// which is the only thing §18 enforces a core target on.

export function buildInSeasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  // A minted illness_recovery mode DECORATES the week the athlete would have
  // had; it no longer wins over game/bye logic by replacing it. The builder
  // never re-reads facts, only the derived mode.
  // The optional-week decoration is applied by `buildWeeklyExposureContract`
  // for EVERY phase now, not here: readiness can make an off-season week
  // optional too, and this branch never ran for those.
  return input.hasGame && input.gameDay !== null
    ? buildInSeasonGameWeekExposureContract(input)
    : byeRecoveryMode(input)
      ? buildInSeasonByeRecoveryExposureContract(input)
      : buildInSeasonByeBuildExposureContract(input);
}

export function buildEarlyOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'early_offseason');
  const contract = createBaseContract(input, {
    mode: 'early_offseason', subphase: 'early_offseason',
    // Bible first 1-2 weeks: everything is optional. Preferred work remains explicit.
    // RULED (Sam, 2026-07-28): target 3, and every session in this block is
    // OPTIONAL — required stays 0. Bible Section 1: weeks 1-2 are the optional
    // block and zero completed sessions is a valid honest week.
    strength: { required: 0, preferredMin: 3, preferredMax: 3, selectedTarget: 0 },
    conditioning: { required: OFFSEASON_PREPARATION.exposureConditioning.required, preferredMin: OFFSEASON_PREPARATION.exposureConditioning.preferred.min, preferredMax: OFFSEASON_PREPARATION.exposureConditioning.preferred.max, selectedTarget: OFFSEASON_PREPARATION.exposureConditioning.defaultTarget },
    sprintCod: { required: 0, preferredMin: 0, preferredMax: 0, selectedTarget: 0 },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 3 },
    allowCombined: false,
    preferredHardDays: 2,
    permittedHardDays: 4,
  });
  const reduced = applyCommonSafetyReductions(contract, input);
  // RETIRED: removed planner-selected optional early off-season strength on low
  // readiness — another COUNT reduction the deload law replaces.
  void input.readinessDeloaded;
  return reduced;
}

export function buildMidOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'mid_offseason');
  return applyCommonSafetyReductions(createBaseContract(input, {
    mode: 'mid_offseason', subphase: 'mid_offseason',
    strength: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.mainStrength },
    conditioning: { required: OFFSEASON_PREPARATION.exposureConditioning.required, preferredMin: OFFSEASON_PREPARATION.exposureConditioning.preferred.min, preferredMax: OFFSEASON_PREPARATION.exposureConditioning.preferred.max, selectedTarget: OFFSEASON_PREPARATION.exposureConditioning.defaultTarget },
    // Off-season weeks 3-4 are the transition block, but still carry zero
    // automatic Speed. The late-Off-season builder below starts the floor.
    sprintCod: { required: 0, preferredMin: 0, preferredMax: 0, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  }), input);
}

export function buildLateOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'late_offseason');
  return applyCommonSafetyReductions(createBaseContract(input, {
    mode: 'late_offseason', subphase: 'late_offseason',
    strength: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.mainStrength },
    conditioning: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.coreConditioning },
    // R-079: *"in later off season after first 4 weeks of off season, they can
    // sprint once a week"*. Was 2; he ruled ONE.
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 1, preferredMin: 1, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  }), input);
}

export function buildOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  if (input.offseasonSubphase === 'early_offseason') return buildEarlyOffseasonExposureContract(input);
  if (input.offseasonSubphase === 'late_offseason') return buildLateOffseasonExposureContract(input);
  return buildMidOffseasonExposureContract(input);
}

function buildPreseasonBase(
  input: WeeklyExposureContractInput,
  targets: BaseTargets,
): WeeklyExposureContract {
  // RULED (Sam, 2026-07-28): a pre-season practice-match week is STRUCTURALLY AN
  // IN-SEASON GAME WEEK — same shape, two team trainings and a game — so it
  // carries the game week's authored numbers, not the generic pre-season row.
  //
  // The week keeps its pre-season identity; only the numbers come from the
  // fixture row. This branch used to build the pre-season row and then reach
  // into the practice-match policy for the selected target alone, which is how
  // one contract came to declare two modes' numbers at once.
  if (input.hasGame && input.gameDay !== null) {
    return buildFixtureWeekContract(
      input,
      { mode: targets.mode, subphase: targets.subphase, plannerMode: 'practice_match_week' },
      'Practice-match, G-1 and G+1 protection leave fewer safe gym placements in this selected week.',
    );
  }
  const selected = phaseSelection(input, targets.mode);
  return applyCommonSafetyReductions(createBaseContract(input, {
    ...targets,
    strength: { ...targets.strength, selectedTarget: selected.mainStrength },
    conditioning: { ...targets.conditioning, selectedTarget: selected.coreConditioning },
    sprintCod: { ...targets.sprintCod, selectedTarget: selected.sprintHighSpeed },
  }), input);
}

/**
 * THE ONE PRE-SEASON ROW (Sam, 2026-07-28, Batch 2 Q1).
 *
 * The three subphase contracts were numerically IDENTICAL across all fourteen
 * slots. Sam's ruling: subphase distinctions do DOSE and CONTENT work, not
 * COUNT work — so there is one authored pre-season contract, and the three
 * modes reference it rather than restating it.
 *
 * The modes survive because the enum needs them elsewhere (identity, subphase
 * policy, the phase clock). What does not survive is three copies of one
 * decision: that was three chances to edit one and not the others, with nothing
 * anywhere noticing the drift.
 */
const PRE_SEASON_TARGETS = {
  strength: { required: 3, preferredMin: 4, preferredMax: 4 },
  conditioning: { required: 3, preferredMin: 4, preferredMax: 4 },
  sprintCod: { required: 1, preferredMin: 1, preferredMax: 1 },
  fullRest: { required: 2, preferredMin: 2, preferredMax: 2 },
  allowCombined: true,
  preferredHardDays: 4,
  permittedHardDays: 5,
} as const;

export function buildEarlyPreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  return buildPreseasonBase(input, {
    ...PRE_SEASON_TARGETS, mode: 'early_preseason', subphase: 'early_preseason',
  });
}

export function buildMidPreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  return buildPreseasonBase(input, {
    ...PRE_SEASON_TARGETS, mode: 'mid_preseason', subphase: 'mid_preseason',
  });
}

export function buildLatePreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  return buildPreseasonBase(input, {
    ...PRE_SEASON_TARGETS, mode: 'late_preseason', subphase: 'late_preseason',
  });
}

export function buildPreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  if (input.preseasonSubphase === 'early_preseason') return buildEarlyPreseasonExposureContract(input);
  if (input.preseasonSubphase === 'late_preseason') return buildLatePreseasonExposureContract(input);
  return buildMidPreseasonExposureContract(input);
}

export function buildWeeklyExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const built = buildForPhase(input);
  // ONE decoration point, every phase. The optional-only week used to be minted
  // inside the in-season branch because only a severe illness could produce it,
  // and illness_recovery is in-season. "Absolutely cooked" readiness can make an
  // off-season or pre-season week optional too, and that path silently skipped
  // the decoration — leaving the contract demanding core sessions from a week
  // whose every session had been stamped optional.
  return input.weekModeOverride === 'optional_week' ? asIllnessRecoveryWeek(built) : built;
}

function buildForPhase(input: WeeklyExposureContractInput): WeeklyExposureContract {
  if (input.seasonPhase === 'In-season') return buildInSeasonExposureContract(input);
  if (input.seasonPhase === 'Off-season') {
    // A stale onboarding game-day value is not an off-season fixture anchor.
    // Off-season allocation has no game projection and must not manufacture
    // fixture credit or G-relative safety rules that its phase does not own.
    return buildOffseasonExposureContract({ ...input, hasGame: false, gameDay: null });
  }
  return buildPreseasonExposureContract(input);
}

/** Deterministic helper for target-week construction and tests. */
export function selectedExposureDaysFromCount(count: number): number[] {
  return [1, 2, 3, 4, 5, 6, 0]
    .sort((a, b) => trainingOrder(a) - trainingOrder(b))
    .slice(0, Math.max(0, Math.min(7, Math.floor(count))));
}
