/**
 * Independent effective-week observer for Programming Bible Section 18.
 *
 * It consumes Contract v2 plus final typed workout evidence. It does not read
 * legacy planner constants and it never mutates, repairs, rejects or stores a
 * week in this slice.
 */

import type { Workout } from '../types/domain';
import { classifyVisibleSession } from './sessionClassificationAdapter';
import { normalizeStrengthIntent, type MainStrengthPattern } from './strengthPatternContributions';
import { anchorAttendanceClaimsConditioning } from './weeklyExposureContractV2';
import type {
  AnchorParticipationState,
  Section18AnchorContract,
  Section18AuthorisedReduction,
  Section18ConditioningRole,
  Section18ConditioningStress,
  Section18ReductionMetric,
  Section18SprintCreditSource,
  WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import { powerRows } from './sessionRowCounting';

export type Section18FindingSeverity = 'blocking' | 'advisory';

export type Section18FindingCode =
  | 'required_minimum_shortfall'
  | 'planner_selected_target_miss'
  | 'default_target_miss'
  | 'maximum_breach'
  | 'optional_work_replacing_required_work'
  | 'core_flush_misclassification'
  | 'conditioning_intensity_mismatch'
  | 'prohibited_pattern_breach'
  | 'pattern_restore_failure'
  | 'pattern_imbalance'
  | 'unjustified_anchor_credit'
  | 'power_policy_breach'
  | 'full_rest_miscount'
  | 'hard_day_breach'
  | 'reduction_contradiction'
  | 'phase_subphase_policy_mismatch'
  | 'illegal_first_offseason_deload'
  | 'preseason_phase_age_reset'
  | 'offseason_phase_age_reset'
  | 'phase_clock_phase_mismatch'
  | 'equipment_substitution_missing'
  | 'legacy_evidence_unknown';

export type Section18FindingDomain =
  | 'identity'
  | 'main_strength'
  | 'strength_patterns'
  | 'conditioning'
  | 'sprint_high_speed'
  | 'anchor_credit'
  | 'power'
  | 'full_rest'
  | 'hard_days'
  | 'equipment'
  | 'migration';

export interface Section18Finding {
  code: Section18FindingCode;
  severity: Section18FindingSeverity;
  domain: Section18FindingDomain;
  expected: unknown;
  actual: unknown;
  detail: string;
  evidence: string[];
}

export interface Section18ConditioningCredit {
  dayOfWeek: number;
  role: Section18ConditioningRole;
  stress: Section18ConditioningStress;
  source: 'app' | 'team_training' | 'game' | 'practice_match';
  participation?: AnchorParticipationState;
}

export interface Section18AnchorLedgerRow {
  id: string;
  kind: Section18AnchorContract['kind'];
  dayOfWeek: number;
  participation: AnchorParticipationState;
  conditioningCredited: boolean;
  sprintCredited: boolean;
  hardDayCredited: boolean;
  currentProductionClaim: Section18AnchorContract['currentProductionClaim'];
}

/**
 * How one domain's exposure divides across the governed boundary.
 *
 * `delivered` is history the athlete actually did; `prescribed` is everything in
 * the governed remainder; `appPrescribed` is the part of that remainder the APP
 * authored, excluding exposure the athlete brings from their own team training
 * and game. `delivered + prescribed` is the domain's achieved total, which is
 * what the existing `achievedCount` fields keep reporting.
 */
export interface Section18ExposureSplit {
  delivered: number;
  prescribed: number;
  appPrescribed: number;
}

export interface Section18EffectiveWeekLedger {
  weekStart: string;
  /** Exclusive boundary: dates before it are history. Null = the whole week is governed. */
  governedFromISO: string | null;
  /** Day-of-week values that fall before the boundary. */
  historyDays: number[];
  mainStrength: {
    achievedCount: number;
    sessionDays: number[];
    accessoryOnlySessionCount: number;
    split: Section18ExposureSplit;
    /** @deprecated read `split.delivered` */
    delivered: number;
    /** @deprecated read `split.prescribed` */
    prescribed: number;
  };
  strengthPatterns: {
    meaningfulMainLiftCount: Record<MainStrengthPattern, number>;
    sessionDaysByPattern: Record<MainStrengthPattern, number[]>;
    legacyTypedIntentFallbacks: number;
  };
  conditioning: {
    coreCount: number;
    optionalFlushCount: number;
    optionalRecoveryAerobicCount: number;
    optionalNonCoreCount: number;
    legacyUnknownCount: number;
    appCoreCount: number;
    anchorCoreCount: number;
    byStress: Record<Section18ConditioningStress, number>;
    credits: Section18ConditioningCredit[];
    split: Section18ExposureSplit;
  };
  sprintHighSpeed: {
    achievedCount: number;
    sources: Section18SprintCreditSource[];
    split: Section18ExposureSplit;
  };
  anchors: Section18AnchorLedgerRow[];
  power: {
    achievedPrimerCount: number;
    primerSources: Array<{ dayOfWeek: number; family: 'lower' | 'upper' }>;
    fieldActionPrimerCredit: 0;
    split: Section18ExposureSplit;
  };
  restStress: {
    trueFullRestDays: number[];
    activeRecoveryDays: number[];
    moderateDays: number[];
    hardDays: number[];
    anchorHardDays: number[];
  };
}

export interface Section18EffectiveWeekEvaluation {
  contract: WeeklyExposureContractV2;
  ledger: Section18EffectiveWeekLedger;
  findings: Section18Finding[];
  blockingViolations: Section18Finding[];
  advisories: Section18Finding[];
  /** This observer is deliberately not the storage acceptance decision yet. */
  enforcement: 'observe_only';
}

export interface Section18EffectiveWeekInput {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStart: string;
  /**
   * Dates the athlete actually completed. Only consulted for dates BEFORE the
   * contract's `governedFromISO`. Omitted means "history was delivered", which
   * is right for a normal past week; E6's pre-signup days pass an explicit empty
   * set, because days before the program existed were never delivered and must
   * count toward nothing.
   */
  deliveredDates?: ReadonlySet<string>;
  /** Optional diagnostic comparison with the incomplete legacy ledger. */
  legacyReportedFullRestCount?: number | null;
}

const PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

function cloneContract(contract: WeeklyExposureContractV2): WeeklyExposureContractV2 {
  return JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
}

function uniq(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function dateForDay(weekStart: string, dayOfWeek: number): string {
  const date = new Date(`${weekStart.slice(0, 10)}T12:00:00`);
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isExplicitRestStub(workout: Workout): boolean {
  return workout.workoutType === 'Rest' &&
    (workout.exercises ?? []).length === 0 &&
    !workout.conditioningBlock &&
    !workout.speedBlock;
}

function typedWorkoutActive(workout: Workout): boolean {
  if (isExplicitRestStub(workout)) return false;
  if ((workout.exercises ?? []).length > 0) return true;
  if (workout.conditioningBlock || workout.speedBlock) return true;
  if (workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery') return true;
  return workout.workoutType !== 'Rest';
}

function rowPatternCounts(workout: Workout): {
  counts: Record<MainStrengthPattern, number>;
  accessory: boolean;
  legacyFallback: boolean;
} {
  const counts: Record<MainStrengthPattern, number> = { squat: 0, hinge: 0, push: 0, pull: 0 };
  let accessory = false;
  let sawTypedMain = false;
  let sawUnknown = false;
  for (const row of workout.exercises ?? []) {
    const evidence = row.section18Evidence;
    if (!evidence || evidence.role === 'legacy_unknown') {
      sawUnknown = true;
      continue;
    }
    if (evidence.role === 'strength_accessory') accessory = true;
    if (evidence.role !== 'main_strength' || !evidence.mainStrengthPattern) continue;
    counts[evidence.mainStrengthPattern] += 1;
    sawTypedMain = true;
  }
  if (!sawTypedMain && sawUnknown && workout.strengthIntent) {
    for (const pattern of normalizeStrengthIntent(workout.strengthIntent).effectivePatterns) {
      counts[pattern] += 1;
    }
    return { counts, accessory, legacyFallback: true };
  }
  return { counts, accessory, legacyFallback: false };
}

function workoutConditioning(workout: Workout): {
  role: Section18ConditioningRole;
  stress: Section18ConditioningStress;
} | null {
  const evidence = workout.section18Evidence;
  if (!evidence || evidence.conditioningRole === 'none') return null;
  return { role: evidence.conditioningRole, stress: evidence.conditioningStress };
}

function normalParticipation(anchor: Section18AnchorContract): boolean {
  return anchor.participation === 'normal_unrestricted';
}

/**
 * Did the athlete TAKE PART? — which is a different question from how hard.
 *
 * Sam, 2026-07-27: "Counting counts structure; intensity and prescribed volume
 * must never feed identity." Anchor credit used to answer four questions with
 * one boolean (`normal_unrestricted`): is this a conditioning exposure, was it
 * a sprint exposure, was it a hard day, and how much stress did it carry. Only
 * the first is identity. So softening a game to `reduced_running` — which is
 * exactly what a deload does — deleted the game from the week's conditioning
 * COUNT, and §18 then rejected the week for a shortfall it had created itself.
 * The athlete still played the game.
 *
 * Deliberately delegates to the ONE exported rule rather than restating it: the
 * contract builder, the safety policy and this evaluator all have to give the
 * same answer, and a second copy here is how they would drift apart again.
 */
function attendedAnchor(anchor: { participation: AnchorParticipationState }): boolean {
  return anchorAttendanceClaimsConditioning(anchor.participation);
}

function buildLedger(input: Section18EffectiveWeekInput): Section18EffectiveWeekLedger {
  const patterns: Record<MainStrengthPattern, number> = { squat: 0, hinge: 0, push: 0, pull: 0 };
  const patternDays: Record<MainStrengthPattern, number[]> = { squat: [], hinge: [], push: [], pull: [] };
  const conditioningByStress: Record<Section18ConditioningStress, number> = {
    light: 0, moderate: 0, hard: 0, unknown: 0,
  };
  const conditioningCredits: Section18ConditioningCredit[] = [];
  const sprintSources: Section18SprintCreditSource[] = [];
  const mainDays: number[] = [];
  const activeRecoveryDays: number[] = [];
  const moderateDays: number[] = [];
  const hardDays: number[] = [];
  const anchorHardDays: number[] = [];
  const activeDays = new Set<number>();
  let mainCount = 0;
  let accessoryOnly = 0;
  let legacyFallbacks = 0;
  let coreConditioning = 0;
  let optionalFlush = 0;
  let optionalRecoveryAerobic = 0;
  let optionalNonCore = 0;
  let legacyUnknown = 0;
  let appCore = 0;
  let anchorCore = 0;
  let primerCount = 0;
  const primerSources: Array<{ dayOfWeek: number; family: 'lower' | 'upper' }> = [];

  const workoutsByDay = new Map<number, Workout[]>();
  for (const workout of input.workouts) {
    const list = workoutsByDay.get(workout.dayOfWeek) ?? [];
    list.push(workout);
    workoutsByDay.set(workout.dayOfWeek, list);
  }

  // ── The governed boundary. Dates before it are HISTORY: they count toward the
  // week's requirements and are never governed. §18 governs what the app
  // prescribes for the remainder — see
  // docs/SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24.md.
  const governedFromISO = input.contract.governedFromISO ?? null;
  const isHistory = (day: number): boolean =>
    governedFromISO !== null && dateForDay(input.weekStart, day) < governedFromISO;
  const wasDelivered = (day: number): boolean =>
    input.deliveredDates === undefined ||
    input.deliveredDates.has(dateForDay(input.weekStart, day));

  let creditedAnchorIndex = 0;
  const anchors: Section18AnchorLedgerRow[] = input.contract.anchors.map((anchor) => {
    activeDays.add(anchor.dayOfWeek);
    // ATTENDANCE decides the exposure; PARTICIPATION decides its intensity.
    // These were one boolean, which is what let a deload delete a session from
    // the week's count.
    const attended = attendedAnchor(anchor);
    const fullParticipation = normalParticipation(anchor);
    if (attended) {
      const role: Section18ConditioningRole = creditedAnchorIndex <
        input.contract.conditioning.core.requiredMinimum
        ? 'required_core'
        : 'planner_selected_core';
      creditedAnchorIndex++;
      conditioningCredits.push({
        dayOfWeek: anchor.dayOfWeek,
        role,
        // The exposure is real either way; only how hard it was changes. A
        // restricted anchor recorded as 'hard' would put the intensity back
        // into the ledger by the other door.
        stress: fullParticipation ? 'hard' : 'moderate',
        source: anchor.kind,
        participation: anchor.participation,
      });
      coreConditioning += 1;
      anchorCore += 1;
      if (fullParticipation) conditioningByStress.hard += 1;
      else conditioningByStress.moderate += 1;
    }
    if (fullParticipation) {
      // Sprint/high-speed credit and hard-day credit are INTENSITY claims and
      // stay behind full participation — a modified or reduced-running anchor
      // never earned them and still does not.
      sprintSources.push({
        kind: anchor.kind,
        dayOfWeek: anchor.dayOfWeek,
        participation: anchor.participation,
        evidence: 'normal_unrestricted_participation',
      });
      anchorHardDays.push(anchor.dayOfWeek);
    }
    return {
      id: anchor.id,
      kind: anchor.kind,
      dayOfWeek: anchor.dayOfWeek,
      participation: anchor.participation,
      conditioningCredited: attended,
      sprintCredited: fullParticipation,
      hardDayCredited: fullParticipation,
      currentProductionClaim: anchor.currentProductionClaim,
    };
  });

  for (let day = 0; day <= 6; day++) {
    const dayWorkouts = workoutsByDay.get(day) ?? [];
    const typedAnchorDeniesHardCredit = input.contract.anchors.some((anchor) =>
      anchor.dayOfWeek === day && !normalParticipation(anchor));
    let dayHard = anchorHardDays.includes(day);
    let dayModerate = false;
    let dayRecovery = false;
    let dayMain = false;
    let dayCoreConditioning = false;
    let daySprint = false;
    let dayAccessory = false;
    let dayPower = false;

    for (const workout of dayWorkouts) {
      if (typedWorkoutActive(workout)) activeDays.add(day);
      if (workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery') dayRecovery = true;
      const visibleClassification = classifyVisibleSession(workout);
      const rowResult = rowPatternCounts(workout);
      const sessionPatterns = PATTERNS.filter((pattern) => rowResult.counts[pattern] > 0);
      if (sessionPatterns.length > 0) {
        mainCount += 1;
        mainDays.push(day);
        dayMain = true;
        if (rowResult.legacyFallback) legacyFallbacks += 1;
        for (const pattern of PATTERNS) {
          patterns[pattern] += rowResult.counts[pattern];
          if (rowResult.counts[pattern] > 0) patternDays[pattern].push(day);
        }
        if (sessionPatterns.some((pattern) => pattern === 'squat' || pattern === 'hinge') ||
            workout.intensity === 'High' || workout.intensity === 'Maximal') {
          dayHard = true;
        } else {
          dayModerate = true;
        }
      } else if (rowResult.accessory) {
        accessoryOnly += 1;
        dayAccessory = true;
      }

      const conditioning = workoutConditioning(workout);
      if (conditioning) {
        conditioningByStress[conditioning.stress] += 1;
        conditioningCredits.push({
          dayOfWeek: day,
          role: conditioning.role,
          stress: conditioning.stress,
          source: 'app',
        });
        if (
          conditioning.role === 'core' || conditioning.role === 'required_core' ||
          conditioning.role === 'planner_selected_core'
        ) {
          coreConditioning += 1;
          appCore += 1;
          dayCoreConditioning = true;
        } else if (conditioning.role === 'optional_flush') {
          optionalFlush += 1;
          dayRecovery = true;
        } else if (conditioning.role === 'optional_recovery_aerobic') {
          optionalRecoveryAerobic += 1;
          dayRecovery = true;
        } else if ((conditioning.role as string) === 'optional_noncore') {
          optionalNonCore += 1;
        } else if (conditioning.role === 'legacy_unknown') {
          legacyUnknown += 1;
        }
        if (conditioning.stress === 'hard') dayHard = true;
        else if (
          (conditioning.role === 'core' || conditioning.role === 'required_core' ||
            conditioning.role === 'planner_selected_core') &&
          conditioning.stress === 'moderate'
        ) dayModerate = true;
      }

      if (workout.speedBlock?.kind === 'true_speed') {
        sprintSources.push({ kind: 'app_sprint', dayOfWeek: day, evidence: 'typed_true_speed_block' });
        daySprint = true;
        dayHard = true;
      }
      for (const row of powerRows(workout)) {
        primerCount += 1;
        primerSources.push({ dayOfWeek: day, family: row.power?.family as never });
        dayPower = true;
      }

      // The final resolver may materialise legacy pool sessions (for example
      // Gunshow, Long Run, or Recovery) that correctly carry no Section 18
      // exposure credit. Their visible stress still owns the day ledger.
      // This fallback classifies the day only; it never promotes untyped work
      // into strength, conditioning, sprint, or power credit.
      if (!dayMain && !conditioning && !daySprint && !dayPower) {
        if (
          dayAccessory ||
          visibleClassification.contributions.gunshow > 0 ||
          visibleClassification.contributions.recovery > 0
        ) {
          dayRecovery = true;
          dayAccessory = visibleClassification.contributions.gunshow > 0;
        } else if (
          visibleClassification.stressLevel === 'high' &&
          !typedAnchorDeniesHardCredit
        ) {
          dayHard = true;
        } else if (visibleClassification.stressLevel === 'medium') {
          dayModerate = true;
        }
      }
    }

    if (dayHard) hardDays.push(day);
    else if (dayModerate) moderateDays.push(day);
    else if (activeDays.has(day) && (dayRecovery || dayAccessory) &&
      !dayMain && !dayCoreConditioning && !daySprint && !dayPower) {
      activeRecoveryDays.push(day);
    }
  }

  const trueRestDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => !activeDays.has(day));

  const splitDays = (
    days: readonly number[],
    appAuthored: readonly boolean[] = [],
  ): Section18ExposureSplit => {
    let delivered = 0; let prescribed = 0; let appPrescribed = 0;
    days.forEach((day, index) => {
      if (isHistory(day)) {
        if (wasDelivered(day)) delivered += 1;
        return;
      }
      prescribed += 1;
      if (appAuthored.length === 0 || appAuthored[index]) appPrescribed += 1;
    });
    return { delivered, prescribed, appPrescribed };
  };

  const coreCredits = conditioningCredits.filter((credit) =>
    credit.role === 'core' || credit.role === 'required_core' ||
    credit.role === 'planner_selected_core');
  const conditioningSplit = splitDays(
    coreCredits.map((credit) => credit.dayOfWeek),
    coreCredits.map((credit) => credit.source === 'app'),
  );
  const sprintSplit = splitDays(
    sprintSources.map((source) => source.dayOfWeek),
    sprintSources.map((source) => source.kind === 'app_sprint'),
  );
  const mainSplit = splitDays(mainDays);
  const powerSplit = splitDays(primerSources.map((source) => source.dayOfWeek));

  return {
    weekStart: input.weekStart.slice(0, 10),
    governedFromISO,
    historyDays: [0, 1, 2, 3, 4, 5, 6].filter(isHistory),
    mainStrength: {
      achievedCount: mainCount,
      sessionDays: uniq(mainDays),
      accessoryOnlySessionCount: accessoryOnly,
      split: mainSplit,
      delivered: mainSplit.delivered,
      prescribed: mainSplit.prescribed,
    },
    strengthPatterns: {
      meaningfulMainLiftCount: patterns,
      sessionDaysByPattern: {
        squat: uniq(patternDays.squat),
        hinge: uniq(patternDays.hinge),
        push: uniq(patternDays.push),
        pull: uniq(patternDays.pull),
      },
      legacyTypedIntentFallbacks: legacyFallbacks,
    },
    conditioning: {
      coreCount: coreConditioning,
      optionalFlushCount: optionalFlush,
      optionalRecoveryAerobicCount: optionalRecoveryAerobic,
      optionalNonCoreCount: optionalNonCore,
      legacyUnknownCount: legacyUnknown,
      appCoreCount: appCore,
      anchorCoreCount: anchorCore,
      byStress: conditioningByStress,
      credits: conditioningCredits,
      split: conditioningSplit,
    },
    sprintHighSpeed: {
      achievedCount: sprintSources.length,
      sources: sprintSources,
      split: sprintSplit,
    },
    anchors,
    power: {
      achievedPrimerCount: primerCount,
      primerSources,
      fieldActionPrimerCredit: 0,
      split: powerSplit,
    },
    restStress: {
      trueFullRestDays: trueRestDays,
      activeRecoveryDays: uniq(activeRecoveryDays),
      moderateDays: uniq(moderateDays),
      hardDays: uniq(hardDays),
      anchorHardDays: uniq(anchorHardDays),
    },
  };
}

function addFinding(
  findings: Section18Finding[],
  finding: Section18Finding,
): void {
  findings.push(finding);
}

function hasFrequencyReduction(
  reductions: readonly Section18AuthorisedReduction[],
  metric: Section18ReductionMetric,
): boolean {
  return reductions.some((entry) => entry.metric === metric && entry.change !== 'dose_intensity');
}

function evaluateNumeric(args: {
  findings: Section18Finding[];
  domain: Section18FindingDomain;
  actual: number;
  required: number;
  defaultTarget: number;
  plannerSelectedTarget: number | null;
  plannerSelectionKind: WeeklyExposureContractV2['mainStrength']['exposure']['plannerSelectionKind'];
  maximum: number | null;
  reductions: readonly Section18AuthorisedReduction[];
  reductionMetric: Section18ReductionMetric;
  label: string;
  evidence?: string[];
  /** How this domain's exposure divides across the governed boundary. */
  split?: Section18ExposureSplit;
}): void {
  if (args.actual < args.required) {
    addFinding(args.findings, {
      code: 'required_minimum_shortfall',
      severity: 'blocking',
      domain: args.domain,
      expected: args.required,
      actual: args.actual,
      detail: `${args.label} is below the Section 18 required minimum.`,
      evidence: args.evidence ?? [],
    });
  } else if (
    args.plannerSelectionKind === 'core' &&
    args.plannerSelectedTarget !== null &&
    args.actual < args.plannerSelectedTarget
  ) {
    addFinding(args.findings, {
      code: 'planner_selected_target_miss',
      severity: 'blocking',
      domain: args.domain,
      expected: args.plannerSelectedTarget,
      actual: args.actual,
      detail: `${args.label} meets the floor but misses the phase planner's selected core target.`,
      evidence: args.evidence ?? [],
    });
  } else if (
    args.actual < args.defaultTarget &&
    !hasFrequencyReduction(args.reductions, args.reductionMetric)
  ) {
    addFinding(args.findings, {
      code: 'default_target_miss',
      severity: 'advisory',
      domain: args.domain,
      expected: args.defaultTarget,
      actual: args.actual,
      detail: `${args.label} meets the floor but misses the normal/default target.`,
      evidence: args.evidence ?? [],
    });
  }
  // MAXIMUMS bind the TOTAL week — delivered plus prescribed — but they are
  // enforced on the part the app still controls: the prescribed remainder is
  // capped at (maximum - delivered), floored at zero. So a maximum is never
  // contradicted over history (the app cannot un-prescribe what the athlete
  // already did), and delivered work never buys a fresh full allowance on top
  // of itself. With no governed boundary the split is all-prescribed and this
  // is exactly the old whole-week check.
  //
  // THE ATHLETE'S OWN EXPOSURE IS THE OTHER PART THE APP DOES NOT CONTROL.
  // Team training and games are facts about the athlete's week, not choices the
  // app made, and it can no more un-prescribe them than it can un-prescribe
  // history. This rule is already authored two hundred lines up, on the sprint
  // prohibition: "the athlete's own team-training and game exposure is theirs
  // ... neither is something the app can un-prescribe"
  // (SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24 §2 Q6). That check
  // obeys it by reading `split.appPrescribed`; this one did not, and read
  // `split.prescribed`.
  //
  // The cost was a dead app on an ordinary profile: early off-season authors a
  // sprint maximum of ZERO, an athlete who attends team training is credited
  // sprint for it, and generation refused its own output before the first
  // screen. Same athlete with no team days generated fine — which is the
  // signature of a limit being charged for something the athlete, not the app,
  // decided.
  //
  // The maximum still binds the TOTAL week, exactly as the paragraph above
  // says. What changes is that the allowance is what remains after everything
  // the app cannot touch, and the breach is judged on what the app actually
  // prescribed.
  const delivered = args.split?.delivered ?? 0;
  const prescribed = args.split ? args.split.prescribed : args.actual;
  const appPrescribed = args.split ? args.split.appPrescribed : args.actual;
  const athleteOwnedExposure = Math.max(0, prescribed - appPrescribed);
  const prescribedAllowance = args.maximum === null
    ? null
    : Math.max(0, args.maximum - delivered - athleteOwnedExposure);
  if (prescribedAllowance !== null && appPrescribed > prescribedAllowance) {
    addFinding(args.findings, {
      code: 'maximum_breach',
      severity: 'blocking',
      domain: args.domain,
      expected: args.maximum,
      actual: args.actual,
      detail: delivered > 0
        ? `${args.label} exceeds the Section 18 permitted maximum: ${delivered} already delivered leaves room for ${prescribedAllowance}, and ${appPrescribed} more ${appPrescribed === 1 ? 'is' : 'are'} prescribed.`
        : `${args.label} exceeds the Section 18 permitted maximum.`,
      evidence: args.evidence ?? [],
    });
  }
}

function metricActual(
  metric: Section18ReductionMetric,
  ledger: Section18EffectiveWeekLedger,
): number | null {
  switch (metric) {
    case 'main_strength_frequency': return ledger.mainStrength.achievedCount;
    case 'conditioning_core_frequency': return ledger.conditioning.coreCount;
    case 'sprint_high_speed_frequency': return ledger.sprintHighSpeed.achievedCount;
    case 'strength_pattern_count':
      return PATTERNS.filter((pattern) => ledger.strengthPatterns.meaningfulMainLiftCount[pattern] > 0).length;
    case 'full_rest_frequency': return ledger.restStress.trueFullRestDays.length;
    case 'power_primer_budget': return ledger.power.achievedPrimerCount;
    case 'session_intensity_percent':
    case 'session_volume':
    default:
      return null;
  }
}

/**
 * What an AUTHORISED REDUCTION is measured against.
 *
 * A reduction is the app declaring its own restraint, so it binds only the work
 * the app authored in the governed remainder. It cannot reach backwards over
 * delivered history, and it has no authority over exposure the athlete brings
 * from their own team training and game — which is why "no app sprint this week"
 * must not read as a breach against a Saturday game they are still playing.
 *
 * Metrics with no app/athlete distinction (patterns, rest days) keep the
 * whole-week figure.
 */
function metricGovernedActual(
  metric: Section18ReductionMetric,
  ledger: Section18EffectiveWeekLedger,
): number | null {
  switch (metric) {
    case 'main_strength_frequency': return ledger.mainStrength.split.appPrescribed;
    case 'conditioning_core_frequency': return ledger.conditioning.split.appPrescribed;
    case 'sprint_high_speed_frequency': return ledger.sprintHighSpeed.split.appPrescribed;
    case 'power_primer_budget': return ledger.power.split.appPrescribed;
    case 'strength_pattern_count': {
      // Patterns trained in the governed remainder only — a pattern the
      // athlete already trained before the boundary is history, not a
      // contradiction of a reduction authored after it.
      const history = new Set(ledger.historyDays);
      return PATTERNS.filter((pattern) =>
        ledger.strengthPatterns.sessionDaysByPattern[pattern]
          .some((day) => !history.has(day))).length;
    }
    default: return metricActual(metric, ledger);
  }
}

function assessContract(
  source: WeeklyExposureContractV2,
  ledger: Section18EffectiveWeekLedger,
): WeeklyExposureContractV2 {
  const contract = cloneContract(source);
  const assess = (policy: WeeklyExposureContractV2['mainStrength']['exposure'], actual: number) => {
    policy.achievedCount = actual;
    policy.unresolvedMinimumShortfall = Math.max(0, policy.requiredMinimum - actual);
    policy.unresolvedPlannerSelectedShortfall = policy.plannerSelectionKind === 'core' &&
      policy.plannerSelectedTarget !== null
      ? Math.max(0, policy.plannerSelectedTarget - actual)
      : null;
    policy.maximumBreach = policy.permittedMaximum === null
      ? 0
      : Math.max(0, actual - policy.permittedMaximum);
  };
  assess(contract.mainStrength.exposure, ledger.mainStrength.achievedCount);
  assess(contract.conditioning.core, ledger.conditioning.coreCount);
  assess(contract.sprintHighSpeed.exposure, ledger.sprintHighSpeed.achievedCount);
  contract.strengthPatterns.achievedMeaningfulMainLifts = {
    ...ledger.strengthPatterns.meaningfulMainLiftCount,
  };
  contract.conditioning.optionalFlush.achievedCount = ledger.conditioning.optionalFlushCount;
  contract.conditioning.optionalRecoveryAerobic.achievedCount =
    ledger.conditioning.optionalRecoveryAerobicCount;
  contract.conditioning.optionalNonCoreAchievedCount = ledger.conditioning.optionalNonCoreCount;
  contract.conditioning.legacyUnknownAchievedCount = ledger.conditioning.legacyUnknownCount;
  contract.conditioning.achievedByStress = { ...ledger.conditioning.byStress };
  contract.conditioning.anchorCredit = ledger.conditioning.anchorCoreCount;
  contract.conditioning.appAuthoredCoreCredit = ledger.conditioning.appCoreCount;
  contract.sprintHighSpeed.achievedSources = [...ledger.sprintHighSpeed.sources];
  contract.power.achievedPrimerCount = ledger.power.achievedPrimerCount;
  contract.power.advisoryOverSelection = Math.max(
    0,
    ledger.power.achievedPrimerCount - contract.power.preferredWeeklyRange.max,
  );
  contract.restStress.achievedTrueFullRestCount = ledger.restStress.trueFullRestDays.length;
  contract.restStress.achievedActiveRecoveryCount = ledger.restStress.activeRecoveryDays.length;
  contract.restStress.achievedModerateDayCount = ledger.restStress.moderateDays.length;
  contract.restStress.achievedHardDayCount = ledger.restStress.hardDays.length;
  const permittedHardDayMaximum = contract.restStress.permittedHardDayMaximum ??
    contract.restStress.normalProgrammedHardDayMaximum;
  const appHardDayCount = ledger.restStress.hardDays.filter((day) =>
    !ledger.restStress.anchorHardDays.includes(day)).length;
  const provenAnchorExcess = Math.max(
    0,
    ledger.restStress.hardDays.length - Math.max(
      contract.restStress.preferredHardDayRange.max,
      appHardDayCount,
    ),
  );
  contract.restStress.unavoidableAnchorCausedExcess = Math.min(
    contract.restStress.authorisedUnavoidableAnchorExcess,
    Math.max(0, ledger.restStress.hardDays.length - contract.restStress.preferredHardDayRange.max),
    provenAnchorExcess,
  );
  contract.restStress.hardDayMaximumBreach = Math.max(
    0,
    ledger.restStress.hardDays.length - permittedHardDayMaximum,
  );
  return contract;
}

/**
 * THE ACHIEVED COUNTS ARE DERIVED AT READ — Sam's ruling, 2026-07-29.
 *
 * `achievedCount` and its sibling tallies (`achievedMeaningfulMainLifts`,
 * `achievedPrimerCount`, the rest/stress counts, the conditioning credits) are
 * DERIVATIONS of a week, not facts about it. Storing them on the contract gave
 * one derivable fact three homes — the microcycle's contract, the week
 * overlay's contract, and `exposureContractsByWeek` — and a week that changed
 * through a door which refreshed only one of them left the other two stale.
 * NORTH_STAR.md names that class verbatim: stored outputs going stale beside
 * live inputs.
 *
 * The contained fix would have been a fourth writer syncing the three, which is
 * the banned patch shape. This is the collapse instead: ask, and the count is
 * computed from the week you are asking about.
 *
 * SCOPE. Counts only. The contract's AUTHORED TARGETS — `requiredMinimum`,
 * `plannerSelectedTarget`, the ceilings — are Sam-authored inputs and stay
 * stored; they are what the derivation is judged against.
 */
export function deriveAchievedCounts(input: Section18EffectiveWeekInput): WeeklyExposureContractV2 {
  return evaluateSection18EffectiveWeek(input).contract;
}

export function evaluateSection18EffectiveWeek(
  input: Section18EffectiveWeekInput,
): Section18EffectiveWeekEvaluation {
  const ledger = buildLedger(input);
  const contract = assessContract(input.contract, ledger);
  const findings: Section18Finding[] = [];

  if (
    contract.identity.phaseClockSelectedPhase &&
    contract.identity.phaseClockSelectedPhase !== contract.identity.seasonPhase
  ) {
    addFinding(findings, {
      code: 'phase_clock_phase_mismatch',
      severity: 'blocking',
      domain: 'identity',
      expected: contract.identity.phaseClockSelectedPhase,
      actual: contract.identity.seasonPhase,
      detail: 'The programmed phase differs from the persisted user-selected phase clock.',
      evidence: [
        `entry=${contract.identity.phaseEntryWeekStartISO ?? 'unknown'}`,
        `phaseWeek=${contract.identity.phaseWeek ?? 'unknown'}`,
      ],
    });
  }

  if (
    contract.identity.seasonPhase === 'Off-season' &&
    (contract.identity.phaseWeek ?? Infinity) <= 4 &&
    contract.identity.weekKind === 'deload'
  ) {
    // BIBLE_ANCHOR: offseason_first_four_weeks_no_deload
    addFinding(findings, {
      code: 'illegal_first_offseason_deload',
      severity: 'blocking',
      domain: 'identity',
      expected: 'build',
      actual: contract.identity.weekKind,
      detail: 'The first four Off-season phase weeks are the approved no-deload exception.',
      evidence: [`phaseWeek=${contract.identity.phaseWeek ?? 'unknown'}`],
    });
  }

  if (
    contract.identity.expectedSubphase &&
    contract.identity.declaredSubphase !== contract.identity.expectedSubphase
  ) {
    addFinding(findings, {
      code: 'phase_subphase_policy_mismatch',
      severity: 'blocking',
      domain: 'identity',
      expected: contract.identity.expectedSubphase,
      actual: contract.identity.declaredSubphase,
      detail: 'Declared subphase disagrees with the Section 18 phase clock.',
      evidence: [
        `block=${contract.identity.blockNumber ?? 'unknown'}`,
        `weekInBlock=${contract.identity.weekInBlock ?? 'unknown'}`,
        `phaseWeek=${contract.identity.phaseWeek ?? 'unknown'}`,
      ],
    });
    if (
      contract.identity.seasonPhase === 'Pre-season' &&
      (contract.identity.phaseWeek ?? 0) >= 4 &&
      contract.identity.declaredSubphase !== 'late_preseason'
    ) {
      addFinding(findings, {
        code: 'preseason_phase_age_reset', severity: 'blocking', domain: 'identity',
        expected: contract.identity.expectedSubphase, actual: contract.identity.declaredSubphase,
        detail: 'Pre-season identity reset even though the persisted phase clock continued.',
        evidence: [`phaseWeek=${contract.identity.phaseWeek}`],
      });
    }
    if (
      contract.identity.seasonPhase === 'Off-season' &&
      (contract.identity.phaseWeek ?? 0) > 4 &&
      contract.identity.declaredSubphase !== 'late_offseason'
    ) {
      addFinding(findings, {
        code: 'offseason_phase_age_reset', severity: 'blocking', domain: 'identity',
        expected: 'late_offseason', actual: contract.identity.declaredSubphase,
        detail: 'Late Off-season identity reset despite continuous persisted phase age.',
        evidence: [`phaseWeek=${contract.identity.phaseWeek}`],
      });
    }
  }

  const strengthTotalForMaximum = contract.mainStrength.exposure.plannerSelectionKind === 'optional'
    ? ledger.mainStrength.achievedCount
    : ledger.mainStrength.achievedCount;
  evaluateNumeric({
    findings,
    domain: 'main_strength',
    actual: strengthTotalForMaximum,
    required: contract.mainStrength.exposure.requiredMinimum,
    defaultTarget: contract.mainStrength.exposure.defaultTarget,
    plannerSelectedTarget: contract.mainStrength.exposure.plannerSelectedTarget,
    plannerSelectionKind: contract.mainStrength.exposure.plannerSelectionKind,
    maximum: contract.mainStrength.exposure.permittedMaximum,
    reductions: contract.mainStrength.reductions,
    reductionMetric: 'main_strength_frequency',
    label: 'Main-strength frequency',
    split: ledger.mainStrength.split,
    evidence: ledger.mainStrength.sessionDays.map((day) => `${dateForDay(input.weekStart, day)}:main_strength`),
  });

  // The prohibition governs what the APP prescribes: the finaliser strips
  // app-authored speed blocks and this asserts none survived. The athlete's
  // own team-training and game exposure is theirs, and delivered history is
  // settled — neither is something the app can un-prescribe. See
  // docs/SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24.md §2 Q6.
  if (contract.safety?.prohibitedSprintHighSpeed && ledger.sprintHighSpeed.split.appPrescribed > 0) {
    addFinding(findings, {
      code: 'reduction_contradiction', severity: 'blocking', domain: 'sprint_high_speed',
      expected: 0, actual: ledger.sprintHighSpeed.split.appPrescribed,
      detail: 'App-prescribed sprint/high-speed work remains despite the active safety prohibition.',
      evidence: ledger.sprintHighSpeed.sources.map((source) =>
        `${dateForDay(input.weekStart, source.dayOfWeek)}:${source.kind}`),
    });
  }

  evaluateNumeric({
    findings,
    domain: 'conditioning',
    actual: ledger.conditioning.coreCount,
    required: contract.conditioning.core.requiredMinimum,
    defaultTarget: contract.conditioning.core.defaultTarget,
    plannerSelectedTarget: contract.conditioning.core.plannerSelectedTarget,
    plannerSelectionKind: contract.conditioning.core.plannerSelectionKind,
    maximum: contract.conditioning.core.permittedMaximum,
    reductions: contract.conditioning.reductions,
    reductionMetric: 'conditioning_core_frequency',
    label: 'Core-conditioning frequency',
    split: ledger.conditioning.split,
    evidence: ledger.conditioning.credits.map((credit) =>
      `${dateForDay(input.weekStart, credit.dayOfWeek)}:${credit.source}:${credit.role}:${credit.stress}`),
  });

  // SELECTED means selected BY THE APP — the same rule as the maximum above,
  // and this check's own sentence has always said so ("Selected optional
  // conditioning exceeds the phase maximum"). It counted `coreCount`, which
  // includes the conditioning credit the athlete earns by turning up to team
  // training, so a maximum authored over the app's own selection was charged
  // for the athlete's club commitments.
  //
  // Sam's authored table settles it. Early off-season permits core
  // `{min:1,max:2}` plus optional flush `{min:1,max:2}` under a maximum of 3 —
  // ranges that cannot all be satisfied at once if the maximum bounded a total
  // including anchors, and that read perfectly as a bound on what the app may
  // choose. The same table sets the early-off-season sprint maximum to ZERO,
  // which would make every athlete who attends team training illegal on the
  // other reading.
  const appSelectedConditioningForOptionalMaximum = ledger.conditioning.appCoreCount +
    ledger.conditioning.optionalFlushCount + ledger.conditioning.optionalRecoveryAerobicCount +
      ledger.conditioning.optionalNonCoreCount +
    ledger.conditioning.legacyUnknownCount;
  if (
    contract.conditioning.core.plannerSelectionKind === 'optional' &&
    contract.conditioning.core.permittedMaximum !== null &&
    appSelectedConditioningForOptionalMaximum > contract.conditioning.core.permittedMaximum
  ) {
    addFinding(findings, {
      code: 'maximum_breach', severity: 'blocking', domain: 'conditioning',
      expected: contract.conditioning.core.permittedMaximum,
      actual: appSelectedConditioningForOptionalMaximum,
      detail: 'Selected optional conditioning exceeds the phase maximum.',
      evidence: [`core=${ledger.conditioning.coreCount}`, `optional=${ledger.conditioning.optionalFlushCount + ledger.conditioning.optionalRecoveryAerobicCount + ledger.conditioning.optionalNonCoreCount}`, `legacyUnknown=${ledger.conditioning.legacyUnknownCount}`],
    });
  }

  if (ledger.conditioning.coreCount < contract.conditioning.core.requiredMinimum &&
      ledger.conditioning.optionalFlushCount + ledger.conditioning.optionalRecoveryAerobicCount +
        ledger.conditioning.optionalNonCoreCount > 0) {
    addFinding(findings, {
      code: 'optional_work_replacing_required_work', severity: 'blocking', domain: 'conditioning',
      expected: contract.conditioning.core.requiredMinimum,
      actual: ledger.conditioning.coreCount,
      detail: 'Optional/non-core conditioning is present while required core conditioning remains short.',
      evidence: [`optionalFlush=${ledger.conditioning.optionalFlushCount}`, `optionalRecovery=${ledger.conditioning.optionalRecoveryAerobicCount}`, `optionalNonCore=${ledger.conditioning.optionalNonCoreCount}`],
    });
  }
  if (ledger.conditioning.optionalFlushCount > 0 &&
      ledger.conditioning.coreCount < contract.conditioning.core.requiredMinimum) {
    addFinding(findings, {
      code: 'core_flush_misclassification', severity: 'blocking', domain: 'conditioning',
      expected: 'flush excluded from core credit',
      actual: `${ledger.conditioning.optionalFlushCount} flush with core shortfall`,
      detail: 'A typed flush cannot satisfy the core-conditioning floor.',
      evidence: ledger.conditioning.credits.filter((credit) => credit.role === 'optional_flush')
        .map((credit) => dateForDay(input.weekStart, credit.dayOfWeek)),
    });
  }
  if (ledger.conditioning.legacyUnknownCount > 0) {
    addFinding(findings, {
      code: 'legacy_evidence_unknown',
      severity: contract.conditioning.core.requiredMinimum > ledger.conditioning.coreCount ? 'blocking' : 'advisory',
      domain: 'migration',
      expected: 'typed core or optional conditioning identity',
      actual: ledger.conditioning.legacyUnknownCount,
      detail: 'Legacy conditioning remains explicitly unknown and receives no core credit.',
      evidence: [],
    });
  }

  const appMediumHard = ledger.conditioning.credits.filter((credit) =>
    credit.source === 'app' && credit.role === 'core' &&
    (credit.stress === 'moderate' || credit.stress === 'hard')).length;
  const appHard = ledger.conditioning.credits.filter((credit) =>
    credit.source === 'app' && credit.role === 'core' && credit.stress === 'hard').length;
  const allAppHard = ledger.conditioning.credits.filter((credit) =>
    credit.source === 'app' && credit.role !== 'legacy_unknown' && credit.stress === 'hard').length;
  const intensity = contract.conditioning.intensityPolicy;
  if (appMediumHard < intensity.requiredAppMediumHardMinimum || appHard < intensity.requiredAppHardMinimum) {
    addFinding(findings, {
      code: 'conditioning_intensity_mismatch', severity: 'blocking', domain: 'conditioning',
      expected: { mediumHardApp: intensity.requiredAppMediumHardMinimum, hardApp: intensity.requiredAppHardMinimum },
      actual: { mediumHardApp: appMediumHard, hardApp: appHard },
      detail: 'App conditioning does not meet the Section 18 intensity requirement for this mode.',
      evidence: ledger.conditioning.credits.filter((credit) => credit.source === 'app')
        .map((credit) => `${dateForDay(input.weekStart, credit.dayOfWeek)}:${credit.stress}`),
    });
  }
  if (intensity.permittedHardCoreMaximum !== null && allAppHard > intensity.permittedHardCoreMaximum) {
    addFinding(findings, {
      code: 'maximum_breach', severity: 'blocking', domain: 'conditioning',
      expected: intensity.permittedHardCoreMaximum,
      actual: allAppHard,
      detail: 'Hard app-conditioning count exceeds the mode-specific ceiling.',
      evidence: [],
    });
  }

  evaluateNumeric({
    findings,
    domain: 'sprint_high_speed',
    actual: ledger.sprintHighSpeed.achievedCount,
    required: contract.sprintHighSpeed.exposure.requiredMinimum,
    defaultTarget: contract.sprintHighSpeed.exposure.defaultTarget,
    plannerSelectedTarget: contract.sprintHighSpeed.exposure.plannerSelectedTarget,
    plannerSelectionKind: contract.sprintHighSpeed.exposure.plannerSelectionKind,
    maximum: contract.sprintHighSpeed.exposure.permittedMaximum,
    reductions: contract.sprintHighSpeed.reductions,
    reductionMetric: 'sprint_high_speed_frequency',
    label: 'Sprint/high-speed frequency',
    split: ledger.sprintHighSpeed.split,
    evidence: ledger.sprintHighSpeed.sources.map((source) =>
      `${dateForDay(input.weekStart, source.dayOfWeek)}:${source.kind}`),
  });

  for (const anchor of ledger.anchors) {
    const claim = anchor.currentProductionClaim;
    if (anchor.participation === 'normal_unrestricted') continue;
    // This guard used to require full participation before ANY of the three
    // claims, because all three moved together. They no longer do: a
    // conditioning claim is justified by ATTENDANCE (the athlete was at the
    // session), while sprint and hard-day claims remain intensity statements
    // that only full participation justifies. Leaving the guard undivided would
    // have re-imposed the conflation the split just removed — from the
    // validation side instead of the counting side.
    const unjustifiedConditioning = claim.conditioning && !attendedAnchor(anchor);
    if (!unjustifiedConditioning && !claim.sprintHighSpeed && !claim.hardDay) continue;
    addFinding(findings, {
      code: 'unjustified_anchor_credit', severity: 'blocking', domain: 'anchor_credit',
      expected: 'attendance before conditioning credit; normal unrestricted participation before sprint/hard credit',
      actual: { participation: anchor.participation, claim },
      detail: `${anchor.kind} production credit is not justified by participation state.`,
      evidence: [`day=${anchor.dayOfWeek}`, `anchor=${anchor.id}`],
    });
  }

  // Prohibitions govern the remainder: pressing the athlete did on Monday is
  // history a Friday shoulder report cannot retroactively make a violation.
  const historyDaysForPatterns = new Set(ledger.historyDays);
  for (const pattern of contract.strengthPatterns.prohibitedPatterns) {
    const governedDays = ledger.strengthPatterns.sessionDaysByPattern[pattern]
      .filter((day) => !historyDaysForPatterns.has(day));
    if (governedDays.length <= 0) continue;
    addFinding(findings, {
      code: 'prohibited_pattern_breach', severity: 'blocking', domain: 'strength_patterns',
      expected: 0, actual: governedDays.length,
      detail: `Injury-prohibited ${pattern} main-strength work returned in the final week.`,
      evidence: governedDays.map((day) => dateForDay(input.weekStart, day)),
    });
  }
  const patternCoverageSelected = contract.mainStrength.exposure.plannerSelectedTarget > 0 &&
    !contract.safety.trainingPaused;
  // Weekly pattern coverage is a whole-week authoring expectation. When the
  // contract governs only a remainder (mid-week boundary), the first days are
  // immutable history and a reduced remainder may honestly be unable to
  // restore every pattern — that cannot block the athlete's report.
  const partialWeekGoverned = ledger.historyDays.length > 0;
  if (patternCoverageSelected) {
    for (const pattern of contract.strengthPatterns.requiredSafePatterns) {
      if (ledger.strengthPatterns.meaningfulMainLiftCount[pattern] > 0) continue;
      addFinding(findings, {
        code: 'pattern_restore_failure',
        severity: partialWeekGoverned ? 'advisory' : 'blocking',
        domain: 'strength_patterns',
        expected: `at least one meaningful ${pattern} main lift`, actual: 0,
        detail: `Safe weekly ${pattern} coverage was not restored by a later session.`,
        evidence: [],
      });
    }
  }
  if (patternCoverageSelected &&
      contract.strengthPatterns.balanceExpectation === 'equal_or_near_equal' &&
      !contract.strengthPatterns.intentionalImbalanceReason) {
    const relevant = contract.strengthPatterns.requiredSafePatterns.map((pattern) =>
      ledger.strengthPatterns.meaningfulMainLiftCount[pattern]);
    if (relevant.length > 1 && Math.max(...relevant) - Math.min(...relevant) >
      contract.strengthPatterns.permittedCountDifference) {
      addFinding(findings, {
        code: 'pattern_imbalance', severity: 'blocking', domain: 'strength_patterns',
        expected: `count difference <= ${contract.strengthPatterns.permittedCountDifference}`,
        actual: ledger.strengthPatterns.meaningfulMainLiftCount,
        detail: 'Meaningful main-lift counts are not equal or near-equal and no reason authorises the imbalance.',
        evidence: [],
      });
    }
  }

  const primers = ledger.power.achievedPrimerCount;
  // Ineligibility governs the remainder: a primer the athlete already
  // completed is history and cannot be un-prescribed by a policy authored
  // after it happened.
  if (contract.power.eligible === false && ledger.power.split.prescribed > 0) {
    addFinding(findings, {
      code: 'power_policy_breach', severity: 'blocking', domain: 'power',
      expected: 0, actual: ledger.power.split.prescribed,
      detail: `Power primers remain despite ineligibility (${contract.power.removalReason ?? 'unspecified'}).`,
      evidence: [],
    });
  } else if (contract.power.eligible !== false && primers > contract.power.preferredWeeklyRange.max) {
    addFinding(findings, {
      code: 'power_policy_breach', severity: 'advisory', domain: 'power',
      expected: contract.power.preferredWeeklyRange,
      actual: primers,
      detail: 'Weekly power-primer selection exceeds the Section 18 preferred budget.',
      evidence: [],
    });
  }
  const historyDaySet = new Set(ledger.historyDays);
  const prohibitedPowerSources = ledger.power.primerSources.filter((source) =>
    !historyDaySet.has(source.dayOfWeek) &&
    contract.safety?.prohibitedPowerFamilies?.includes(source.family));
  if (prohibitedPowerSources.length > 0) {
    addFinding(findings, {
      code: 'power_policy_breach', severity: 'blocking', domain: 'power',
      expected: `no ${contract.safety.prohibitedPowerFamilies.join('/')} power`,
      actual: prohibitedPowerSources,
      detail: 'A power primer uses an injury-prohibited movement family.',
      evidence: prohibitedPowerSources.map((source) =>
        `${dateForDay(input.weekStart, source.dayOfWeek)}:${source.family}`),
    });
  }

  const trueRest = ledger.restStress.trueFullRestDays.length;
  if (trueRest < contract.restStress.requiredFullRestMinimum) {
    addFinding(findings, {
      code: 'required_minimum_shortfall', severity: 'blocking', domain: 'full_rest',
      expected: contract.restStress.requiredFullRestMinimum, actual: trueRest,
      detail: 'True full-rest days are below the Section 18 minimum.',
      evidence: [`activeRecoveryDays=${ledger.restStress.activeRecoveryDays.join(',')}`],
    });
  } else if (trueRest < contract.restStress.preferredFullRestCount.min) {
    addFinding(findings, {
      code: 'default_target_miss', severity: 'advisory', domain: 'full_rest',
      expected: contract.restStress.preferredFullRestCount, actual: trueRest,
      detail: 'True full-rest count is below the preferred range.',
      evidence: [],
    });
  }
  if (
    (input.legacyReportedFullRestCount !== undefined && input.legacyReportedFullRestCount !== null &&
      input.legacyReportedFullRestCount !== trueRest) ||
    (ledger.restStress.activeRecoveryDays.length > 0 && trueRest < contract.restStress.requiredFullRestMinimum)
  ) {
    addFinding(findings, {
      code: 'full_rest_miscount', severity: 'blocking', domain: 'full_rest',
      expected: trueRest,
      actual: input.legacyReportedFullRestCount ?? 'active recovery cannot be full rest',
      detail: 'Visible recovery/flush/accessory work is active and cannot be credited as full rest.',
      evidence: ledger.restStress.activeRecoveryDays.map((day) => dateForDay(input.weekStart, day)),
    });
  }

  const permittedHardDayMaximum = contract.restStress.permittedHardDayMaximum ??
    contract.restStress.normalProgrammedHardDayMaximum;
  const hardBreach = Math.max(0, ledger.restStress.hardDays.length - permittedHardDayMaximum);
  if (hardBreach > 0) {
    addFinding(findings, {
      code: 'hard_day_breach', severity: 'blocking', domain: 'hard_days',
      expected: permittedHardDayMaximum,
      actual: ledger.restStress.hardDays.length,
      detail: 'Hard-day count exceeds the Contract v2 permitted maximum for this phase and mode.',
      evidence: ledger.restStress.hardDays.map((day) => dateForDay(input.weekStart, day)),
    });
  } else if (ledger.restStress.hardDays.length > contract.restStress.preferredHardDayRange.max) {
    addFinding(findings, {
      code: 'default_target_miss', severity: 'advisory', domain: 'hard_days',
      expected: contract.restStress.preferredHardDayRange,
      actual: ledger.restStress.hardDays.length,
      detail: 'Hard-day count is above the preferred range but within the mode-specific permitted maximum.',
      evidence: ledger.restStress.hardDays.map((day) => dateForDay(input.weekStart, day)),
    });
  }

  const reductions = contract.authorisedReductions ?? [
    ...contract.mainStrength.reductions,
    ...contract.conditioning.reductions,
    ...contract.sprintHighSpeed.reductions,
  ];
  for (const reduction of reductions) {
    const actual = metricGovernedActual(reduction.metric, ledger);
    if (actual === null) {
      addFinding(findings, {
        code: 'legacy_evidence_unknown', severity: 'advisory', domain: 'migration',
        expected: `typed final evidence for ${reduction.metric}`,
        actual: null,
        detail: 'The final visible week cannot prove whether this dose/intensity reduction survived.',
        evidence: [reduction.detail],
      });
      continue;
    }
    if (reduction.change === 'dose_intensity' || actual <= reduction.reducedTarget) continue;
    const domain: Section18FindingDomain = reduction.metric === 'full_rest_frequency'
      ? 'full_rest'
      : reduction.metric === 'power_primer_budget'
        ? 'power'
        : reduction.metric.startsWith('main_strength') || reduction.metric === 'strength_pattern_count'
          ? 'main_strength'
          : reduction.metric.startsWith('conditioning')
            ? 'conditioning'
            : 'sprint_high_speed';
    addFinding(findings, {
      code: 'reduction_contradiction', severity: 'blocking',
      domain,
      expected: reduction.reducedTarget, actual,
      detail: `Final week exceeds its authorised ${reduction.reason} reduction.`,
      evidence: [reduction.detail],
    });
  }

  if (
    ledger.conditioning.coreCount < contract.conditioning.core.requiredMinimum &&
    contract.equipment.appConditioningFeasible === false &&
    contract.equipment.substitutionStatus === 'not_attempted'
  ) {
    addFinding(findings, {
      code: 'equipment_substitution_missing', severity: 'blocking', domain: 'equipment',
      expected: 'substitution attempted before frequency reduction',
      actual: contract.equipment.substitutionStatus,
      detail: 'Conditioning frequency was reduced before Section 18 substitutions were attempted.',
      evidence: contract.equipment.consideredSubstitutions,
    });
  }

  return {
    contract,
    ledger,
    findings,
    blockingViolations: findings.filter((finding) => finding.severity === 'blocking'),
    advisories: findings.filter((finding) => finding.severity === 'advisory'),
    enforcement: 'observe_only',
  };
}
