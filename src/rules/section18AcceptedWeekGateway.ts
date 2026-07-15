import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  Workout,
} from '../types/domain';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import {
  DEFAULT_ATHLETE_CONTEXT,
  type AthleteContext,
} from '../utils/sessionBuilder';
import {
  resolveWeekWithConditioning,
  type ScheduleState,
} from '../utils/sessionResolver';
import {
  evaluateSection18EffectiveWeek,
  type Section18EffectiveWeekEvaluation,
  type Section18Finding,
} from './section18EffectiveWeekEvaluator';
import { finaliseSection18SafetyWeek } from './section18SafetyFinaliser';
import { applyGenerationSafetyToSection18Contract } from './section18SafetyPolicy';
import type {
  Section18AuthorisedReduction,
  WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import { resolveProfileTargetWeekAvailability } from './fixtureConditionedAvailability';
import {
  buildDerivedSessionExpiryCandidates,
  rebindDerivedSessionProvenance,
} from './derivedSessionProvenance';
import { searchWholeWeekRepairCandidates } from './wholeWeekRepairEngine';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export type Section18WeekAcceptanceStatus =
  | 'accepted'
  | 'repaired'
  | 'regenerated'
  | 'fallback'
  | 'impossible';

export type Section18WeekRepairKind =
  | 'weekly_power_budget'
  | 'obsolete_derived_work_expired'
  | 'optional_work_removed_for_rest'
  | 'core_work_stacked_on_existing_stress_day'
  | 'regenerated_candidate'
  | 'safe_fallback_candidate';

export interface Section18WeekRepair {
  kind: Section18WeekRepairKind;
  detail: string;
  sourceDay?: number;
  targetDay?: number;
}

export interface Section18AcceptedWeekCandidate {
  contract: WeeklyExposureContractV2;
  workouts: Workout[];
}

export interface Section18AcceptedWeekGatewayInput extends Section18AcceptedWeekCandidate {
  weekStart: string;
  profile?: OnboardingData | null;
  /** The caller may supply the exact live projection; generation uses the canonical resolver below. */
  resolveVisibleWorkouts?: (workouts: readonly Workout[]) => Workout[];
  maxRepairAttempts?: number;
  regenerate?: () => Section18AcceptedWeekCandidate | null;
  safeFallback?: () => Section18AcceptedWeekCandidate | null;
}

export interface Section18AcceptedWeekGatewayResult {
  status: Section18WeekAcceptanceStatus;
  contract: WeeklyExposureContractV2;
  canonicalWorkouts: Workout[];
  visibleWorkouts: Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  repairs: Section18WeekRepair[];
  attempts: number;
  failureSignature: string | null;
}

export class Section18WeekAcceptanceError extends Error {
  readonly code = 'section18_week_rejected' as const;
  readonly userMessage = 'We couldn’t safely build your week from your current settings. Please review your availability, readiness and injury information.';

  constructor(public readonly result: Section18AcceptedWeekGatewayResult) {
    super(`Section 18 final-week rejection (${result.failureSignature ?? 'unknown'})`);
    this.name = 'Section18WeekAcceptanceError';
  }
}

function cloneContract(contract: WeeklyExposureContractV2): WeeklyExposureContractV2 {
  return JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
}

function dateForDay(weekStart: string, dayOfWeek: number): string {
  const date = new Date(`${weekStart.slice(0, 10)}T12:00:00`);
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function programPhaseFor(contract: WeeklyExposureContractV2): TrainingProgram['programPhase'] {
  if (contract.identity.seasonPhase === 'In-season') return 'In-Season';
  if (contract.identity.seasonPhase === 'Pre-season') return 'Pre-Season-Skills';
  return 'Base-Building';
}

function athleteContext(profile: OnboardingData | null | undefined): AthleteContext {
  if (!profile) return DEFAULT_ATHLETE_CONTEXT;
  const equipment = resolveEquipmentCapabilities(profile);
  return {
    injuries: profile.injuries ?? [],
    equipmentTags: equipment.tags,
    trainingLocation: profile.trainingLocation ?? DEFAULT_ATHLETE_CONTEXT.trainingLocation,
    onboardingData: profile,
  };
}

/**
 * Resolve exactly what the athlete will see, including fixture replacement,
 * G+1 recovery, G-1 protection, conditioning fill and recovery fill.
 */
export function resolveFinalVisibleSection18Week(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStart: string;
  profile?: OnboardingData | null;
  scheduleState?: Partial<ScheduleState>;
}): Workout[] {
  const weekStart = args.weekStart.slice(0, 10);
  const weekEnd = dateForDay(weekStart, 0);
  const microcycle: Microcycle = {
    id: `section18-visible:${weekStart}`,
    programId: `section18-visible-program:${weekStart}`,
    weekNumber: args.contract.identity.globalWeek ?? 1,
    startDate: `${weekStart}T12:00:00.000Z`,
    endDate: `${weekEnd}T12:00:00.000Z`,
    miniCycleNumber: args.contract.identity.blockNumber ?? 1,
    intensityMultiplier: args.contract.identity.weekKind === 'deload' ? 0.9 : 1,
    weekKind: args.contract.identity.weekKind,
    exposureContractV2: args.contract,
    workouts: [...args.workouts],
    createdAt: `${weekStart}T00:00:00.000Z`,
    updatedAt: `${weekStart}T00:00:00.000Z`,
  };
  const program: TrainingProgram = {
    id: microcycle.programId,
    userId: 'section18-gateway',
    name: 'Section 18 accepted-week candidate',
    description: '',
    programPhase: programPhaseFor(args.contract),
    startDate: microcycle.startDate,
    endDate: microcycle.endDate,
    microcycles: [microcycle],
    primaryFocus: 'Section 18 conformance',
    isActive: true,
    createdAt: microcycle.createdAt,
    updatedAt: microcycle.updatedAt,
  };
  const markedDays: ScheduleState['markedDays'] = {
    ...(args.scheduleState?.markedDays ?? {}),
  };
  const fixture = args.contract.anchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  if (fixture) {
    const fixtureDate = dateForDay(weekStart, fixture.dayOfWeek);
    if (!Object.prototype.hasOwnProperty.call(markedDays, fixtureDate)) {
      markedDays[fixtureDate] = 'game';
    }
  }
  if (!fixture && args.contract.identity.mode.startsWith('in_season_bye')) {
    const profileGameDay = args.profile?.usualGameDay ?? args.profile?.gameDay;
    const gameDayIndex = profileGameDay ? DAY_NAMES.indexOf(profileGameDay as typeof DAY_NAMES[number]) : -1;
    if (gameDayIndex >= 0) markedDays[dateForDay(weekStart, gameDayIndex)] = 'noGame';
  }
  const targetWeekAvailability = args.profile
    ? resolveProfileTargetWeekAvailability({
        profile: args.profile,
        weekStart,
        markedDays,
      })
    : null;
  const profileAvailableDays = targetWeekAvailability?.effectiveAvailableDayNumbers ?? [];
  const canonicalAvailableDays = Array.from(new Set(
    args.workouts.map((workout) => workout.dayOfWeek),
  ));

  const state: ScheduleState = {
    manualOverrides: {},
    weekScopedOverlays: {},
    athleteContext: athleteContext(args.profile),
    seasonPhase: args.contract.identity.seasonPhase,
    usualGameDay: args.profile?.usualGameDay,
    gameDay: args.profile?.gameDay,
    readiness: args.contract.safety.reasons.includes('low_readiness') ? 'low' : 'medium',
    // The resolver's historical empty-array convention means "all days".
    // At the commit boundary, a missing profile instead falls back to the
    // candidate's allocated days; a truly empty/full-pause candidate uses a
    // sentinel that permits no optional fill.
    availableDayNumbers: profileAvailableDays.length > 0
      ? profileAvailableDays
      : canonicalAvailableDays.length > 0
        ? canonicalAvailableDays
        : [-1],
    ...args.scheduleState,
    currentProgram: program,
    currentMicrocycle: microcycle,
    markedDays,
  };
  return resolveWeekWithConditioning(weekStart, state)
    .flatMap((day) => day.workout ? [day.workout] : []);
}

function powerReductionReason(contract: WeeklyExposureContractV2): Section18AuthorisedReduction['reason'] {
  if (contract.safety.fullPause) return 'full_pause';
  if (contract.identity.weekKind === 'deload') return 'deload_policy';
  if (contract.identity.mode === 'in_season_bye_recovery') return 'bye_recovery_mode';
  if (contract.safety.reasons.includes('low_readiness')) return 'low_readiness';
  if (contract.safety.prohibitedPower || contract.safety.prohibitedPowerFamilies.length >= 2) {
    return 'injury_restriction';
  }
  if (contract.identity.mode === 'practice_match_week') return 'practice_match_load';
  return 'game_load_protection';
}

function withPowerReduction(
  contract: WeeklyExposureContractV2,
  original: number,
  budget: number,
  detail: string,
): WeeklyExposureContractV2 {
  contract.authorisedReductions = contract.authorisedReductions.filter((entry) =>
    entry.metric !== 'power_primer_budget');
  if (budget < original) {
    contract.authorisedReductions.push({
      metric: 'power_primer_budget',
      originalApprovedTarget: original,
      reducedTarget: budget,
      reason: powerReductionReason(contract),
      scope: 'week',
      change: 'frequency',
      detail,
      provenance: 'live_typed_reduction',
    });
  }
  return contract;
}

function weeklyPowerBudget(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  profile?: OnboardingData | null;
}): { contract: WeeklyExposureContractV2; workouts: Workout[]; budget: number; removed: number } {
  const contract = cloneContract(args.contract);
  const beginner = args.profile?.experienceLevel === 'Complete beginner';
  const ineligible = contract.power.eligible === false || beginner ||
    contract.identity.weekKind === 'deload' ||
    contract.identity.mode === 'in_season_bye_recovery' ||
    contract.safety.fullPause || contract.safety.prohibitedPower ||
    contract.safety.reasons.includes('low_readiness');
  const normalAnchors = contract.anchors.filter((anchor) =>
    anchor.participation === 'normal_unrestricted');
  const teamCount = normalAnchors.filter((anchor) => anchor.kind === 'team_training').length;
  const fixture = normalAnchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  const budget = ineligible
    ? 0
    : fixture && teamCount >= 2
      ? 0
      : fixture || teamCount >= 2
        ? 1
        : 2;
  const fixtureDay = fixture?.dayOfWeek;
  const candidates = args.workouts
    .filter((workout) => !!workout.powerBlock)
    .map((workout, index) => ({
      workout,
      index,
      tooCloseToFixture: fixtureDay === undefined
        ? false
        : ((fixtureDay - workout.dayOfWeek + 7) % 7) <= 2,
      anchorDay: normalAnchors.some((anchor) => anchor.dayOfWeek === workout.dayOfWeek),
    }))
    .sort((a, b) =>
      Number(a.tooCloseToFixture) - Number(b.tooCloseToFixture) ||
      Number(a.anchorDay) - Number(b.anchorDay) ||
      a.workout.dayOfWeek - b.workout.dayOfWeek ||
      a.index - b.index);
  const keep = new Set<string>();
  const usedFamilies = new Set<string>();
  for (const candidate of candidates) {
    if (keep.size >= budget || candidate.tooCloseToFixture || candidate.anchorDay) continue;
    const family = candidate.workout.powerBlock!.family;
    if (usedFamilies.has(family) && candidates.some((other) =>
      !keep.has(other.workout.id) && other.workout.powerBlock?.family !== family &&
      !other.tooCloseToFixture && !other.anchorDay)) continue;
    keep.add(candidate.workout.id);
    usedFamilies.add(family);
  }
  const workouts = args.workouts.map((workout) =>
    workout.powerBlock && !keep.has(workout.id)
      ? (({ powerBlock: _removed, ...rest }) => rest as Workout)(workout)
      : { ...workout });
  const achieved = workouts.filter((workout) => !!workout.powerBlock).length;
  contract.power.eligible = !ineligible;
  contract.power.plannerSelectedWeeklyBudget = budget;
  contract.power.achievedPrimerCount = achieved;
  contract.power.removalReason = ineligible
    ? beginner ? 'training_age_ineligible' : contract.power.removalReason ?? 'weekly_power_ineligible'
    : budget < 2 ? 'field_load_budget_reduction' : null;
  withPowerReduction(
    contract,
    2,
    budget,
    `Weekly selector budget=${budget}; normal anchors=${normalAnchors.map((anchor) => anchor.kind).join(',') || 'none'}.`,
  );
  return {
    contract,
    workouts,
    budget,
    removed: candidates.length - achieved,
  };
}

function explicitRestStub(dayOfWeek: number, source?: Workout): Workout {
  const timestamp = source?.updatedAt ?? new Date(0).toISOString();
  return {
    id: source?.id ?? `section18-rest-${dayOfWeek}`,
    microcycleId: source?.microcycleId ?? 'section18-rest',
    dayOfWeek,
    name: 'Rest',
    description: '',
    durationMinutes: 0,
    intensity: 'Light',
    workoutType: 'Rest',
    sessionTier: 'recovery',
    exercises: [],
    createdAt: source?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function workoutHasMainStrength(workout: Workout): boolean {
  return workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength') ||
    !!workout.strengthIntent?.effectivePatterns.length;
}

function workoutHasAppCoreConditioning(workout: Workout): boolean {
  const role = workout.section18Evidence?.conditioningRole;
  return role === 'core' || role === 'required_core' || role === 'planner_selected_core';
}

function mergeCoreWork(source: Workout, target: Workout): Workout | null {
  const sourceConditioning = workoutHasAppCoreConditioning(source);
  const targetConditioning = workoutHasAppCoreConditioning(target);
  if (sourceConditioning && targetConditioning) return null;
  const exercises = [
    ...target.exercises,
    ...source.exercises.map((row, index) => ({
      ...row,
      workoutId: target.id,
      exerciseOrder: target.exercises.length + index + 1,
    })),
  ];
  const preserveTargetType = target.workoutType === 'Team Training';
  const stackedDate = source.derivedSessionProvenance?.[0]?.originatingDate ??
    source.updatedAt.slice(0, 10);
  const sourceProvenance = (source.derivedSessionProvenance ?? []).map((record) => ({
    ...record,
    scope: record.scope === 'session'
      ? record.targetMetric === 'main_strength' || record.targetMetric === 'strength_pattern'
        ? 'strength_component' as const
        : record.targetMetric === 'conditioning_core'
          ? 'conditioning_component' as const
          : record.targetMetric === 'sprint_high_speed'
            ? 'speed_component' as const
            : record.scope
      : record.scope,
    history: [...record.history, {
      action: 'stacked' as const,
      date: stackedDate,
      fromDayOfWeek: source.dayOfWeek,
      toDayOfWeek: target.dayOfWeek,
    }],
  }));
  const combinedProvenance = [
    ...(target.derivedSessionProvenance ?? []),
    ...sourceProvenance,
  ];
  return {
    ...target,
    name: preserveTargetType ? target.name : `${target.name} + ${source.name}`,
    workoutType: preserveTargetType ? target.workoutType : 'Mixed',
    sessionTier: 'core',
    intensity: target.intensity === 'High' || target.intensity === 'Maximal' ||
      source.intensity === 'High' || source.intensity === 'Maximal'
      ? 'High'
      : 'Moderate',
    durationMinutes: target.durationMinutes + source.durationMinutes,
    exercises,
    derivedSessionProvenance: combinedProvenance.length > 0 ? combinedProvenance : undefined,
    ...(source.strengthIntent ? { strengthIntent: source.strengthIntent } : {}),
    ...(source.strengthPatternContributions
      ? { strengthPatternContributions: [...source.strengthPatternContributions] }
      : {}),
    ...(source.powerBlock && !target.powerBlock ? { powerBlock: source.powerBlock } : {}),
    ...(source.speedBlock && !target.speedBlock ? { speedBlock: source.speedBlock } : {}),
    ...(sourceConditioning && !targetConditioning ? {
      hasCombinedConditioning: true,
      attachedConditioningKind: source.attachedConditioningKind,
      conditioningFlavour: source.conditioningFlavour,
      conditioningCategory: source.conditioningCategory,
      conditioningFeasibility: source.conditioningFeasibility,
      conditioningBlock: source.conditioningBlock,
      section18ConditioningRole: source.section18ConditioningRole,
      section18Evidence: source.section18Evidence,
    } : {}),
    recoveryAddons: [...(target.recoveryAddons ?? []), ...(source.recoveryAddons ?? [])],
    updatedAt: source.updatedAt > target.updatedAt ? source.updatedAt : target.updatedAt,
  };
}

function replaceDay(workouts: readonly Workout[], day: number, replacement: Workout): Workout[] {
  const without = workouts.filter((workout) => workout.dayOfWeek !== day);
  return [...without, replacement].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function repairOptionalRestCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const fixtureDays = args.contract.anchors
    .filter((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
    .map((anchor) => anchor.dayOfWeek);
  const protectedRecoveryDays = new Set(fixtureDays.map((day) => (day + 1) % 7));
  const optionalDays = args.workouts
    .filter((workout) => workout.sessionTier === 'optional')
    .map((workout) => workout.dayOfWeek);
  const candidates = Array.from(new Set([
    ...args.evaluation.ledger.restStress.activeRecoveryDays,
    ...optionalDays,
  ])).filter((day) => !protectedRecoveryDays.has(day));
  return candidates.flatMap((day) => {
    const source = args.workouts.find((workout) => workout.dayOfWeek === day);
    if (source && (workoutHasMainStrength(source) || workoutHasAppCoreConditioning(source))) return [];
    return [{
      workouts: replaceDay(args.workouts, day, explicitRestStub(day, source)),
      repair: {
        kind: 'optional_work_removed_for_rest',
        detail: `Removed optional/recovery-only work from ${DAY_NAMES[day]} to create true full rest.`,
        sourceDay: day,
      },
    }];
  });
}

function repairByStackingCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
  requireHardTarget: boolean;
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const anchorByDay = new Map(args.contract.anchors.map((anchor) => [anchor.dayOfWeek, anchor]));
  const hardDays = new Set(args.evaluation.ledger.restStress.hardDays);
  const sources = args.workouts
    .filter((workout) => workoutHasMainStrength(workout) && !anchorByDay.has(workout.dayOfWeek))
    .sort((a, b) => b.dayOfWeek - a.dayOfWeek);
  const targets = args.workouts
    .filter((workout) => {
      const anchor = anchorByDay.get(workout.dayOfWeek);
      if (anchor?.kind === 'game' || anchor?.kind === 'practice_match') return false;
      if (workoutHasMainStrength(workout)) return false;
      if (args.requireHardTarget && !hardDays.has(workout.dayOfWeek)) return false;
      return workout.workoutType === 'Team Training' || workoutHasAppCoreConditioning(workout);
    })
    .sort((a, b) => Number(!hardDays.has(a.dayOfWeek)) - Number(!hardDays.has(b.dayOfWeek)) ||
      a.dayOfWeek - b.dayOfWeek);
  return sources.flatMap((source) => targets.flatMap((target) => {
      if (source.dayOfWeek === target.dayOfWeek) return [];
      const merged = mergeCoreWork(source, target);
      if (!merged) return [];
      let workouts = replaceDay(args.workouts, target.dayOfWeek, merged);
      workouts = replaceDay(workouts, source.dayOfWeek, explicitRestStub(source.dayOfWeek, source));
      return [{
        workouts,
        repair: {
          kind: 'core_work_stacked_on_existing_stress_day',
          detail: `Stacked required ${source.name} onto ${target.name}; no required exposure was removed.`,
          sourceDay: source.dayOfWeek,
          targetDay: target.dayOfWeek,
        },
      }];
  }));
}

function signature(evaluation: Section18EffectiveWeekEvaluation): string {
  return evaluation.blockingViolations
    .map((finding) => `${finding.code}:${finding.domain}:${JSON.stringify(finding.actual)}`)
    .sort()
    .join('|');
}

function localRepairCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const restShort = args.evaluation.blockingViolations.some((finding) =>
    finding.domain === 'full_rest');
  const hardBreach = args.evaluation.blockingViolations.some((finding) =>
    finding.code === 'hard_day_breach');
  return [
    ...(restShort ? repairOptionalRestCandidates(args) : []),
    ...(hardBreach
      ? repairByStackingCandidates({ ...args, requireHardTarget: true })
      : []),
    ...(restShort
      ? repairByStackingCandidates({ ...args, requireHardTarget: false })
      : []),
  ];
}

function resolveCandidate(args: {
  input: Section18AcceptedWeekGatewayInput;
  candidate: Section18AcceptedWeekCandidate;
  inheritedRepairs?: Section18WeekRepair[];
}): Section18AcceptedWeekGatewayResult {
  const maxCandidates = Math.max(1, args.input.maxRepairAttempts ?? 48);
  const initialRepairs = [...(args.inheritedRepairs ?? [])];
  const preScoreExpiry = buildDerivedSessionExpiryCandidates({
    workouts: args.candidate.workouts,
    contract: args.candidate.contract,
    weekStart: args.input.weekStart,
  })[0];
  if (preScoreExpiry) {
    initialRepairs.push({
      kind: 'obsolete_derived_work_expired',
      detail: `Expired ${preScoreExpiry.expiries.length} obsolete system-derived session/component${preScoreExpiry.expiries.length === 1 ? '' : 's'} before preservation scoring: ${preScoreExpiry.expiries.map((expiry) => `${expiry.origin}/${expiry.scope}/${expiry.reason}/${expiry.planEntryId ?? expiry.workoutId}`).join(', ')}.`,
    });
  }
  const safety = finaliseSection18SafetyWeek({
    contract: args.candidate.contract,
    workouts: preScoreExpiry?.workouts ?? args.candidate.workouts,
    weekStart: args.input.weekStart,
    canonicalContext: {
      phase: args.candidate.contract.identity.seasonPhase,
      weekKind: args.candidate.contract.identity.weekKind,
      profile: args.input.profile ?? undefined,
    },
  });
  const power = weeklyPowerBudget({
    contract: safety.contract,
    workouts: safety.workouts,
    profile: args.input.profile,
  });
  if (power.removed > 0 || power.budget < 2) {
    initialRepairs.push({
      kind: 'weekly_power_budget',
      detail: `Weekly selector kept ${power.workouts.filter((workout) => !!workout.powerBlock).length} primers within budget ${power.budget}.`,
    });
  }
  const baseContract = power.contract;
  type CandidateState = { workouts: Workout[]; repairs: Section18WeekRepair[] };
  type CandidateEvaluation = {
    contract: WeeklyExposureContractV2;
    visibleWorkouts: Workout[];
    evaluation: Section18EffectiveWeekEvaluation;
  };
  const search = searchWholeWeekRepairCandidates<CandidateState, CandidateEvaluation>({
    initial: { workouts: power.workouts, repairs: initialRepairs },
    maxCandidates,
    stateSignature: (candidate) => JSON.stringify(candidate.workouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((row) => ({ ...row, exercise: row.exercise?.name ?? null })),
    }))),
    assess: (candidate) => {
      let contract = cloneContract(baseContract);
      const resolver = args.input.resolveVisibleWorkouts ?? ((candidateWorkouts: readonly Workout[]) =>
        resolveFinalVisibleSection18Week({
          contract,
          workouts: candidateWorkouts,
          weekStart: args.input.weekStart,
          profile: args.input.profile,
        }));
      const visibleWorkouts = resolver(candidate.workouts);
      let evaluation = evaluateSection18EffectiveWeek({
        contract,
        workouts: visibleWorkouts,
        weekStart: args.input.weekStart,
      });
      contract = evaluation.contract;
      if (evaluation.blockingViolations.length === 0) {
        contract = applyGenerationSafetyToSection18Contract({ contract });
        evaluation = evaluateSection18EffectiveWeek({
          contract,
          workouts: visibleWorkouts,
          weekStart: args.input.weekStart,
        });
        contract = evaluation.contract;
      }
      return {
        accepted: evaluation.blockingViolations.length === 0,
        blockingCount: evaluation.blockingViolations.length,
        evaluation: { contract, visibleWorkouts, evaluation },
      };
    },
    expand: (candidate, assessment) => {
      const evaluated = assessment.evaluation;
      const expiryCandidates = buildDerivedSessionExpiryCandidates({
        workouts: candidate.workouts,
        contract: evaluated.contract,
        weekStart: args.input.weekStart,
      }).map((expiry) => ({
        workouts: expiry.workouts,
        repairs: [...candidate.repairs, {
          kind: 'obsolete_derived_work_expired' as const,
          detail: `Expired ${expiry.expiries.length} obsolete system-derived session/component${expiry.expiries.length === 1 ? '' : 's'} before preservation scoring.`,
        }],
      }));
      const repairCandidates = localRepairCandidates({
        workouts: candidate.workouts,
        evaluation: evaluated.evaluation,
        contract: evaluated.contract,
      }).map((repair) => ({
        workouts: repair.workouts,
        repairs: [...candidate.repairs, repair.repair],
      }));
      return [...expiryCandidates, ...repairCandidates];
    },
  });
  const selected = search.candidate;
  const selectedEvaluation = search.evaluation;
  return {
    status: search.outcome === 'impossible'
      ? 'impossible'
      : selected.repairs.some((repair) => repair.kind === 'regenerated_candidate')
        ? 'regenerated'
        : selected.repairs.length > 0 ? 'repaired' : 'accepted',
    contract: selectedEvaluation.contract,
    canonicalWorkouts: selected.workouts,
    visibleWorkouts: selectedEvaluation.visibleWorkouts,
    evaluation: selectedEvaluation.evaluation,
    repairs: selected.repairs,
    attempts: search.candidatesEvaluated,
    failureSignature: search.outcome === 'impossible'
      ? signature(selectedEvaluation.evaluation)
      : null,
  };
}

/**
 * The only Section 18 commit decision. Every candidate, regenerated week and
 * fallback is evaluated by the same safety → visible resolver → evaluator
 * boundary; approved targets are never reconciled down to deficient output.
 */
export function runSection18AcceptedWeekGateway(
  input: Section18AcceptedWeekGatewayInput,
): Section18AcceptedWeekGatewayResult {
  const primary = resolveCandidate({ input, candidate: input });
  if (primary.status !== 'impossible') return primary;

  const regenerated = input.regenerate?.();
  if (regenerated) {
    const reboundRegenerated = {
      ...regenerated,
      workouts: rebindDerivedSessionProvenance({
        workouts: regenerated.workouts,
        contract: regenerated.contract,
        weekStart: input.weekStart,
      }),
    };
    const result = resolveCandidate({
      input: { ...input, regenerate: undefined, safeFallback: undefined },
      candidate: reboundRegenerated,
      inheritedRepairs: [...primary.repairs, {
        kind: 'regenerated_candidate',
        detail: 'The first deterministic candidate remained invalid; regenerated candidate entered the same gateway.',
      }],
    });
    if (result.status !== 'impossible') return { ...result, status: 'regenerated' };
  }

  const fallback = input.safeFallback?.();
  if (fallback) {
    const reboundFallback = {
      ...fallback,
      workouts: rebindDerivedSessionProvenance({
        workouts: fallback.workouts,
        contract: fallback.contract,
        weekStart: input.weekStart,
      }),
    };
    const result = resolveCandidate({
      input: { ...input, regenerate: undefined, safeFallback: undefined },
      candidate: reboundFallback,
      inheritedRepairs: [...primary.repairs, {
        kind: 'safe_fallback_candidate',
        detail: 'Safe deterministic fallback entered the same gateway.',
      }],
    });
    if (result.status !== 'impossible') return { ...result, status: 'fallback' };
    return result;
  }
  return primary;
}

export function requireSection18AcceptedWeek(
  input: Section18AcceptedWeekGatewayInput,
): Section18AcceptedWeekGatewayResult {
  const result = runSection18AcceptedWeekGateway(input);
  if (result.status === 'impossible') throw new Section18WeekAcceptanceError(result);
  return result;
}

export function section18BlockingSummary(findings: readonly Section18Finding[]): string {
  return findings.map((finding) => `${finding.code}:${finding.domain}`).sort().join(',');
}
