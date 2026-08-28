/** Final-workout athlete-edit projection owned by the canonical compiler. */
import type { UserRemovalConstraint, Workout } from '../types/domain';
import {
  canonicalWeeklyAthleteEditStateFrom,
  type CanonicalWeeklyAthleteEditState,
  type CanonicalWeeklyAthleteEditReductionRequest,
} from './canonicalWeeklyAthleteEditState';
import { evaluateSection18EffectiveWeek } from './section18EffectiveWeekEvaluator';
import type {
  Section18AuthorisedReduction,
  Section18ReductionMetric,
  WeeklyExposureContractV2,
} from './weeklyExposureContractV2';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function compileCanonicalAthleteEditedWeek(args: {
  readonly workouts: readonly Workout[];
  readonly weekStartISO: string;
  readonly edits?: CanonicalWeeklyAthleteEditState;
  readonly constraints?: readonly UserRemovalConstraint[];
}): Workout[] {
  const edits = args.edits ?? canonicalWeeklyAthleteEditStateFrom({
    weekStartISO: args.weekStartISO,
    constraints: args.constraints,
  });
  const byDay = new Map<number, Workout>(
    args.workouts.map((workout) => [workout.dayOfWeek, clone(workout)]),
  );
  for (const placement of edits.placements) {
    // This exact accepted placement may already have been compiled through
    // later injury/equipment facts. Replaying its healthy snapshot again would
    // undo those facts. A newer decision has a different constraint identity
    // and still wins; a null removal still empties its day.
    const current = byDay.get(placement.dayOfWeek);
    const existing = current?.athletePlacement;
    if (placement.workout && current?.sourceFactAdjustedPlacementId === placement.constraintId &&
        existing?.constraintId === placement.constraintId &&
        existing.placedDate === placement.dateISO) continue;
    byDay.delete(placement.dayOfWeek);
    if (placement.workout) byDay.set(placement.dayOfWeek, clone(placement.workout));
  }
  return [...byDay.values()].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}

function addFrequencyReduction(args: {
  contract: WeeklyExposureContractV2;
  metric: Section18ReductionMetric;
  original: number;
  reduced: number;
  request: CanonicalWeeklyAthleteEditReductionRequest;
  affectedWeek: string;
}): void {
  if (args.reduced >= args.original) return;
  const prior = args.contract.authorisedReductions.find((existing) =>
    existing.reason === 'explicit_user_override' && existing.metric === args.metric &&
    existing.deletionIdentity === args.request.constraintId);
  const entry: Section18AuthorisedReduction = {
    metric: args.metric,
    originalApprovedTarget: Math.max(args.original, prior?.originalApprovedTarget ?? 0),
    reducedTarget: args.reduced,
    reason: 'explicit_user_override',
    scope: args.metric === 'strength_pattern_count' ? 'pattern' : 'week',
    change: 'frequency',
    detail: `Athlete removed ${args.request.scope} from ${args.request.targetDate}; relocation and substitution were exhausted.`,
    provenance: 'live_typed_reduction',
    affectedWeek: args.affectedWeek,
    deletionIdentity: args.request.constraintId,
  };
  args.contract.authorisedReductions = args.contract.authorisedReductions.filter((existing) =>
    !(existing.reason === 'explicit_user_override' && existing.metric === args.metric &&
      existing.deletionIdentity === args.request.constraintId));
  args.contract.authorisedReductions.push(entry);
}

function reduceContractForRequest(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStartISO: string;
  request: CanonicalWeeklyAthleteEditReductionRequest;
}): WeeklyExposureContractV2 {
  const contract = clone(args.contract);
  const ledger = evaluateSection18EffectiveWeek({
    contract,
    workouts: args.workouts,
    weekStart: args.weekStartISO,
  }).ledger;
  const lowerPolicy = (
    metric: Section18ReductionMetric,
    policy: WeeklyExposureContractV2['mainStrength']['exposure'],
    actual: number,
  ) => {
    const selected = policy.plannerSelectedTarget ?? policy.requiredMinimum;
    addFrequencyReduction({
      contract,
      metric,
      original: Math.max(policy.requiredMinimum, selected),
      reduced: actual,
      request: args.request,
      affectedWeek: args.weekStartISO,
    });
    policy.requiredMinimum = Math.min(policy.requiredMinimum, actual);
    if (policy.plannerSelectedTarget !== null) {
      policy.plannerSelectedTarget = Math.min(policy.plannerSelectedTarget, actual);
    }
  };

  lowerPolicy('main_strength_frequency', contract.mainStrength.exposure,
    ledger.mainStrength.achievedCount);
  lowerPolicy('conditioning_core_frequency', contract.conditioning.core,
    ledger.conditioning.coreCount);
  lowerPolicy('sprint_high_speed_frequency', contract.sprintHighSpeed.exposure,
    ledger.sprintHighSpeed.achievedCount);

  const achievedPatterns = contract.strengthPatterns.requiredSafePatterns.filter((pattern) =>
    ledger.strengthPatterns.meaningfulMainLiftCount[pattern] > 0);
  addFrequencyReduction({
    contract,
    metric: 'strength_pattern_count',
    original: contract.strengthPatterns.requiredSafePatterns.length,
    reduced: achievedPatterns.length,
    request: args.request,
    affectedWeek: args.weekStartISO,
  });
  if (achievedPatterns.length < contract.strengthPatterns.requiredSafePatterns.length) {
    contract.strengthPatterns.requiredSafePatterns = achievedPatterns;
    contract.safety.requiredSafePatterns = achievedPatterns;
    contract.strengthPatterns.intentionalImbalanceReason =
      `explicit_user_override:${args.request.constraintId}`;
    contract.strengthPatterns.balanceExpectation = 'not_applicable';
    contract.strengthPatterns.laterSessionRestorationRequired = false;
  }

  const appCore = ledger.conditioning.credits.filter((credit) => credit.source === 'app' &&
    (credit.role === 'core' || credit.role === 'required_core' ||
      credit.role === 'planner_selected_core'));
  contract.conditioning.intensityPolicy.requiredAppMediumHardMinimum = Math.min(
    contract.conditioning.intensityPolicy.requiredAppMediumHardMinimum,
    appCore.filter((credit) => credit.stress === 'moderate' || credit.stress === 'hard').length,
  );
  contract.conditioning.intensityPolicy.requiredAppHardMinimum = Math.min(
    contract.conditioning.intensityPolicy.requiredAppHardMinimum,
    appCore.filter((credit) => credit.stress === 'hard').length,
  );

  contract.mainStrength.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'main_strength_frequency' || entry.metric === 'strength_pattern_count' ||
    entry.metric === 'session_intensity_percent' || entry.metric === 'session_volume');
  contract.conditioning.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'conditioning_core_frequency');
  contract.sprintHighSpeed.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'sprint_high_speed_frequency');
  return contract;
}

export function compileCanonicalAthleteEditedContract(args: {
  readonly contract: WeeklyExposureContractV2;
  readonly workouts: readonly Workout[];
  readonly weekStartISO: string;
  readonly edits?: CanonicalWeeklyAthleteEditState;
  readonly constraints?: readonly UserRemovalConstraint[];
}): WeeklyExposureContractV2 {
  const edits = args.edits ?? canonicalWeeklyAthleteEditStateFrom({
    weekStartISO: args.weekStartISO,
    constraints: args.constraints,
  });
  let contract = clone(args.contract);
  for (const request of edits.reductionRequests) {
    contract = reduceContractForRequest({
      contract,
      workouts: args.workouts,
      weekStartISO: args.weekStartISO.slice(0, 10),
      request,
    });
  }
  return contract;
}
