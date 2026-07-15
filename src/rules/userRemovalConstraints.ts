import type { UserRemovalConstraint, UserRemovalScope, Workout } from '../types/domain';
import { evaluateSection18EffectiveWeek } from './section18EffectiveWeekEvaluator';
import type {
  Section18AuthorisedReduction,
  Section18ReductionMetric,
  WeeklyExposureContractV2,
} from './weeklyExposureContractV2';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function activeUserRemovalConstraintsForWeek(
  constraints: readonly UserRemovalConstraint[] | undefined,
  weekStart: string,
): UserRemovalConstraint[] {
  const start = weekStart.slice(0, 10);
  const end = new Date(`${start}T12:00:00`);
  end.setDate(end.getDate() + 6);
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return (constraints ?? [])
    .filter((constraint) => constraint.status === 'active' &&
      ((constraint.targetDate >= start && constraint.targetDate <= endISO) ||
        (!!constraint.moveTargetDate &&
          constraint.moveTargetDate >= start && constraint.moveTargetDate <= endISO)))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id));
}

/** Apply persisted user ownership before any visible-week evaluation. */
export function applyUserRemovalConstraintsToWeek(args: {
  workouts: readonly Workout[];
  weekStart: string;
  constraints?: readonly UserRemovalConstraint[];
}): Workout[] {
  let workouts = args.workouts.map((workout) => ({ ...workout }));
  for (const constraint of activeUserRemovalConstraintsForWeek(
    args.constraints,
    args.weekStart,
  )) {
    const start = args.weekStart.slice(0, 10);
    const end = new Date(`${start}T12:00:00`);
    end.setDate(end.getDate() + 6);
    const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    if (constraint.targetDate >= start && constraint.targetDate <= endISO) {
      const dayOfWeek = new Date(`${constraint.targetDate}T12:00:00`).getDay();
      workouts = workouts.filter((workout) => workout.dayOfWeek !== dayOfWeek);
      if (constraint.remainingWorkout) {
        workouts.push({ ...clone(constraint.remainingWorkout), dayOfWeek });
      }
    }
    if (
      constraint.mutationKind === 'move' &&
      constraint.moveTargetDate &&
      constraint.movedWorkout &&
      constraint.moveTargetDate >= start &&
      constraint.moveTargetDate <= endISO
    ) {
      const targetDayOfWeek = new Date(`${constraint.moveTargetDate}T12:00:00`).getDay();
      workouts = workouts.filter((workout) => workout.dayOfWeek !== targetDayOfWeek);
      workouts.push({ ...clone(constraint.movedWorkout), dayOfWeek: targetDayOfWeek });
    }
  }
  return workouts.sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}

export function userRemovalConstraintId(args: {
  date: string;
  scope: UserRemovalScope;
  workout: Workout;
}): string {
  return [
    'user-removal',
    args.date.slice(0, 10),
    args.scope,
    args.workout.planEntryId ?? args.workout.id,
  ].join(':');
}

export function userMoveConstraintId(args: {
  sourceDate: string;
  targetDate: string;
  workout: Workout;
}): string {
  return [
    'user-move',
    args.sourceDate.slice(0, 10),
    args.targetDate.slice(0, 10),
    args.workout.planEntryId ?? args.workout.id,
  ].join(':');
}

function addFrequencyReduction(args: {
  contract: WeeklyExposureContractV2;
  metric: Section18ReductionMetric;
  original: number;
  reduced: number;
  targetDate: string;
  scope: UserRemovalScope;
}): void {
  if (args.reduced >= args.original) return;
  const prior = args.contract.authorisedReductions.find((existing) =>
    existing.reason === 'explicit_user_override' && existing.metric === args.metric &&
    existing.detail.includes(args.targetDate));
  const entry: Section18AuthorisedReduction = {
    metric: args.metric,
    originalApprovedTarget: Math.max(args.original, prior?.originalApprovedTarget ?? 0),
    reducedTarget: args.reduced,
    reason: 'explicit_user_override',
    scope: args.metric === 'strength_pattern_count' ? 'pattern' : 'week',
    change: 'frequency',
    detail: `Athlete removed ${args.scope} from ${args.targetDate}; relocation and substitution were exhausted.`,
    provenance: 'live_typed_reduction',
  };
  args.contract.authorisedReductions = args.contract.authorisedReductions.filter((existing) =>
    !(existing.reason === 'explicit_user_override' && existing.metric === args.metric &&
      existing.detail.includes(args.targetDate)));
  args.contract.authorisedReductions.push(entry);
}

/**
 * Last-resort Section 18 projection for a valid athlete deletion.
 *
 * The candidate has already exhausted relocation/substitution search. This
 * lowers only the metrics the accepted visible result cannot supply and keeps
 * the typed reduction in the persisted Contract v2 ledger.
 */
export function applyAthleteRemovalTypedReduction(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStart: string;
  constraint: UserRemovalConstraint;
}): WeeklyExposureContractV2 {
  const contract = clone(args.contract);
  const evaluation = evaluateSection18EffectiveWeek({
    contract,
    workouts: args.workouts,
    weekStart: args.weekStart,
  });
  const ledger = evaluation.ledger;
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
      targetDate: args.constraint.targetDate,
      scope: args.constraint.scope,
    });
    policy.requiredMinimum = Math.min(policy.requiredMinimum, actual);
    if (policy.plannerSelectedTarget !== null) {
      policy.plannerSelectedTarget = Math.min(policy.plannerSelectedTarget, actual);
    }
  };

  lowerPolicy(
    'main_strength_frequency',
    contract.mainStrength.exposure,
    ledger.mainStrength.achievedCount,
  );
  lowerPolicy(
    'conditioning_core_frequency',
    contract.conditioning.core,
    ledger.conditioning.coreCount,
  );
  lowerPolicy(
    'sprint_high_speed_frequency',
    contract.sprintHighSpeed.exposure,
    ledger.sprintHighSpeed.achievedCount,
  );

  const achievedPatterns = contract.strengthPatterns.requiredSafePatterns.filter((pattern) =>
    ledger.strengthPatterns.meaningfulMainLiftCount[pattern] > 0);
  addFrequencyReduction({
    contract,
    metric: 'strength_pattern_count',
    original: contract.strengthPatterns.requiredSafePatterns.length,
    reduced: achievedPatterns.length,
    targetDate: args.constraint.targetDate,
    scope: args.constraint.scope,
  });
  if (achievedPatterns.length < contract.strengthPatterns.requiredSafePatterns.length) {
    contract.strengthPatterns.requiredSafePatterns = achievedPatterns;
    contract.safety.requiredSafePatterns = achievedPatterns;
    contract.strengthPatterns.intentionalImbalanceReason =
      `explicit_user_override:${args.constraint.id}`;
    // The missing pattern is intentional and typed. Leaving the normal
    // balance selector active would cause the safety policy to expand this
    // reduced set back to every safe pattern on its second validation pass.
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
