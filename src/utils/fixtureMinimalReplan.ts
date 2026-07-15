import type {
  Microcycle,
  OnboardingData,
  Workout,
} from '../types/domain';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import {
  resolveFinalVisibleSection18Week,
  runSection18AcceptedWeekGateway,
  requireSection18AcceptedWeek,
  type Section18AcceptedWeekGatewayResult,
} from '../rules/section18AcceptedWeekGateway';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import type {
  AvailabilityProvenance,
  FixtureConditionedAvailability,
  TargetWeekFixture,
} from '../rules/fixtureConditionedAvailability';
import type { CalendarDayType } from '../store/calendarStore';
import { hasMeaningfulWorkoutContent } from './workoutContent';
import { normalizeVisibleWorkoutIdentity } from './visibleWorkoutIdentity';

export interface FixtureReplanEditCost {
  section18Blockers: number;
  unavailableDayUses: number;
  changedCoreSessions: number;
  changedDays: number;
  changedPlanEntryIdsOrPrescriptions: number;
  releasedFixtureDayPenalty: number;
  patternImbalance: number;
  restDeficit: number;
  duplicateStrengthPatternPenalty: number;
  excessiveActiveStreak: number;
  optionalBeforeCoreViolation: number;
}

export interface FixtureMinimalReplanResult {
  path: 'minimal_repair' | 'full_regeneration';
  usedFullRegeneration: boolean;
  workouts: Workout[];
  gateway: Section18AcceptedWeekGatewayResult;
  editCost: FixtureReplanEditCost;
  changedDays: number[];
  addedDays: number[];
  removedDays: number[];
  preservedCorePlanEntryIds: string[];
  availability: FixtureConditionedAvailability;
  rejectedCandidateSignatures: string[];
  candidateDiagnostics: FixtureReplanCandidateDiagnostic[];
  sourcePlanEntryIds: string[];
}

export interface FixtureReplanCandidateDiagnostic {
  addedDays: number[];
  status: 'accepted' | 'rejected';
  editCost?: FixtureReplanEditCost;
  failureSignature?: string;
}

export type FixtureMutationIntent =
  | 'fixture_transition'
  | 'remove_from_date'
  | 'remove_weekly_exposure';

export class RequiredCoreRelocationError extends Error {
  readonly code = 'required_core_relocation_failed';

  constructor(
    readonly reason: 'authorised_reduction_required' | 'no_safe_placement',
    readonly rejectedCandidateSignatures: string[],
  ) {
    super(reason === 'authorised_reduction_required'
      ? 'Required weekly core exposure cannot be removed without an authorised reduction.'
      : 'Required core work could not be relocated to a safe available day.');
    this.name = 'RequiredCoreRelocationError';
  }
}

const EDIT_COST_ORDER: readonly (keyof FixtureReplanEditCost)[] = [
  'section18Blockers',
  'unavailableDayUses',
  'changedCoreSessions',
  'changedDays',
  'changedPlanEntryIdsOrPrescriptions',
  'releasedFixtureDayPenalty',
  'patternImbalance',
  'restDeficit',
  'duplicateStrengthPatternPenalty',
  'excessiveActiveStreak',
  'optionalBeforeCoreViolation',
];

export interface BuildFixtureMinimalReplanInput {
  profile: OnboardingData;
  weekStart: string;
  sourceWorkouts: readonly Workout[];
  targetMicrocycle: Microcycle;
  availability: FixtureConditionedAvailability;
  proposedMarkedDays: Record<string, CalendarDayType>;
  priorFixtures: readonly TargetWeekFixture[];
  proposedFixtures: readonly TargetWeekFixture[];
  mutationIntent?: FixtureMutationIntent;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function workoutSignature(workout: Workout | undefined): string {
  if (!workout) return 'rest';
  return JSON.stringify({
    planEntryId: workout.planEntryId ?? null,
    tier: workout.sessionTier ?? null,
    type: workout.workoutType,
    name: workout.name,
    exercises: (workout.exercises ?? []).map((row) => ({
      name: row.exercise?.name ?? null,
      sets: row.prescribedSets,
      min: row.prescribedRepsMin,
      max: row.prescribedRepsMax,
      rest: row.restSeconds,
    })),
    conditioning: workout.conditioningBlock ?? null,
    speed: workout.speedBlock ?? null,
    power: workout.powerBlock ?? null,
  });
}

function byDay(workouts: readonly Workout[]): Map<number, Workout> {
  return new Map(workouts.map((workout) => [workout.dayOfWeek, workout]));
}

function isCore(workout: Workout | undefined): boolean {
  if (!workout || workout.workoutType === 'Recovery' || workout.workoutType === 'Rest') {
    return false;
  }
  const conditioningRole = workout.section18Evidence?.conditioningRole;
  return hasMainStrength(workout) || workout.workoutType === 'Team Training' ||
    workout.workoutType === 'Game' || conditioningRole === 'core' ||
    conditioningRole === 'required_core' || conditioningRole === 'planner_selected_core';
}

function isOptional(workout: Workout | undefined): boolean {
  return workout?.sessionTier === 'optional';
}

function mainStrengthPrescription(workout: Workout | undefined): string {
  if (!workout) return 'none';
  return JSON.stringify({
    planEntryId: workout.planEntryId ?? null,
    rows: (workout.exercises ?? [])
      .filter((row) => row.section18Evidence?.role === 'main_strength' ||
        row.section18Evidence?.role === 'legacy_unknown')
      .map((row) => ({
        id: row.id,
        name: row.exercise?.name ?? null,
        sets: row.prescribedSets,
        min: row.prescribedRepsMin,
        max: row.prescribedRepsMax,
        rest: row.restSeconds,
      })),
  });
}

function coreSessionPreserved(before: Workout | undefined, after: Workout | undefined): boolean {
  return !!before && !!after && before.dayOfWeek === after.dayOfWeek &&
    mainStrengthPrescription(before) === mainStrengthPrescription(after);
}

function hasMainStrength(workout: Workout | undefined): boolean {
  return !!workout && ((workout.exercises ?? []).some((row) =>
    row.section18Evidence?.role === 'main_strength' ||
    row.section18Evidence?.role === 'legacy_unknown') ||
    (workout.strengthIntent?.effectivePatterns.length ?? 0) > 0);
}

function isTeamTraining(workout: Workout | undefined): boolean {
  return workout?.workoutType === 'Team Training';
}

function dayAfter(date: string): number {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return value.getDay();
}

function releaseProvenance(provenance: AvailabilityProvenance): boolean {
  return provenance === 'released_game_day' ||
    provenance === 'released_practice_match_day' ||
    provenance === 'bye_usual_game_day';
}

/** Remove only fixture-owned content; unaffected app sessions remain byte-stable inputs. */
function fixtureNeutralSource(args: BuildFixtureMinimalReplanInput): Workout[] {
  const occupied = new Set(args.proposedFixtures.map((fixture) =>
    new Date(`${fixture.date}T12:00:00`).getDay()));
  const releasedRecoveryDays = new Set([
    ...args.priorFixtures.map((fixture) => dayAfter(fixture.date)),
    ...args.availability.releasedFixtures.map((fixture) => dayAfter(fixture.date)),
  ]);
  const releasedFixtureDays = new Set([
    ...args.priorFixtures
      .filter((fixture) => !args.proposedFixtures.some((proposed) => proposed.date === fixture.date))
      .map((fixture) => new Date(`${fixture.date}T12:00:00`).getDay()),
    ...args.availability.days
      .filter((day) => day.provenance.some(releaseProvenance))
      .map((day) => day.dayNumber),
  ]);
  const blockedAppDays = new Set(args.availability.days
    .filter((day) => !day.available && day.blockedBy.length > 0)
    .map((day) => day.dayNumber));
  return args.sourceWorkouts.filter((workout) => {
    if (releasedFixtureDays.has(workout.dayOfWeek)) return false;
    if (workout.workoutType === 'Game') return false;
    if (occupied.has(workout.dayOfWeek)) return false;
    if (
      blockedAppDays.has(workout.dayOfWeek) &&
      workout.workoutType !== 'Team Training'
    ) return false;
    if (releasedRecoveryDays.has(workout.dayOfWeek) && (
      workout.sessionTier === 'recovery' ||
      workout.workoutType === 'Recovery' ||
      workout.workoutType === 'Rest' ||
      /\b(?:recovery|rest)\b/i.test(workout.name)
    )) return false;
    return true;
  });
}

function visibleResolver(args: BuildFixtureMinimalReplanInput) {
  return (workouts: readonly Workout[]): Workout[] => resolveFinalVisibleSection18Week({
    contract: args.targetMicrocycle.exposureContractV2!,
    workouts,
    weekStart: args.weekStart,
    profile: args.profile,
    scheduleState: {
      markedDays: args.proposedMarkedDays,
      availableDayNumbers: args.availability.effectiveAvailableDayNumbers,
    },
  });
}

function stripConditioningComponent(workout: Workout): Workout | null {
  const linkedRows = new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds),
  );
  const stripped = normalizeVisibleWorkoutIdentity({
    ...workout,
    exercises: (workout.exercises ?? []).filter((row) =>
      !linkedRows.has(row.id) && row.section18Evidence?.role !== 'conditioning'),
    conditioningBlock: undefined,
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
    conditioningFeasibility: undefined,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    coachAddedConditioningLabel: undefined,
    section18ConditioningRole: undefined,
    section18Evidence: undefined,
  });
  return hasMeaningfulWorkoutContent(stripped) ? stripped : null;
}

function trimStandaloneConditioningExcess(
  args: BuildFixtureMinimalReplanInput,
  workouts: Workout[],
): Workout[] {
  const contract = args.targetMicrocycle.exposureContractV2!;
  const evaluation = evaluateSection18EffectiveWeek({
    contract,
    workouts,
    weekStart: args.weekStart,
  });
  const target = contract.conditioning.core.plannerSelectedTarget ??
    contract.conditioning.core.requiredMinimum;
  let excess = Math.max(0, evaluation.ledger.conditioning.coreCount - target);
  if (excess === 0) return workouts;
  const appDays = Array.from(new Set(
    evaluation.ledger.conditioning.credits
      .filter((credit) => credit.source === 'app')
      .map((credit) => credit.dayOfWeek),
  ));
  const map = byDay(workouts);
  appDays.sort((left, right) => {
    const leftWorkout = map.get(left);
    const rightWorkout = map.get(right);
    const cost = (_day: number, workout: Workout | undefined): number =>
      isOptional(workout) ? 0
        : hasMainStrength(workout) ? 3 : 2;
    return cost(left, leftWorkout) - cost(right, rightWorkout) || right - left;
  });
  const replacements = new Map<number, Workout | null>();
  for (const day of appDays) {
    if (excess === 0) break;
    const workout = map.get(day);
    if (!workout) continue;
    replacements.set(day, stripConditioningComponent(workout));
    excess -= 1;
  }
  return excess === 0
    ? workouts.flatMap((workout) => {
        if (!replacements.has(workout.dayOfWeek)) return [workout];
        const replacement = replacements.get(workout.dayOfWeek);
        return replacement ? [replacement] : [];
      })
    : workouts;
}

function buildConditioning(args: {
  profile: OnboardingData;
  weekStart: string;
  dayNumber: number;
  microcycle: Microcycle;
  role: 'required_core' | 'planner_selected_core';
  stress: 'hard' | 'moderate';
}): Workout {
  const dayName = DAY_NAMES[args.dayNumber];
  const suffix = args.stress === 'hard' ? 'hard-conditioning' : 'conditioning';
  const planEntryId = `fixture-replan:${args.weekStart}:${dayName.toLowerCase()}:${suffix}`;
  const [workout] = buildWorkoutsFromCoach(
    [],
    args.microcycle.id,
    [{
      tier: 'core',
      focus: args.stress === 'hard'
        ? 'Hard Conditioning — game-replacement exposure'
        : 'Aerobic Conditioning — fixture replan exposure',
      dayOfWeek: dayName,
      isHardExposure: args.stress === 'hard',
      conditioningFlavour: args.stress === 'hard' ? 'high-intensity' : 'aerobic',
      conditioningCategory: args.stress === 'hard' ? 'glycolytic' : 'aerobic_base',
      section18ConditioningRole: args.role,
      conditioningVariant: 'standard',
      stressLevel: args.stress === 'hard' ? 'high' : 'medium',
      planEntryId,
    }],
    args.profile,
    {
      miniCycleNumber: args.microcycle.miniCycleNumber,
      weekInBlock: ((Math.max(1, args.microcycle.weekNumber) - 1) % 4) + 1,
      weekStartISO: args.weekStart,
      weekKind: args.microcycle.weekKind,
      intensityMultiplier: args.microcycle.intensityMultiplier,
    },
  );
  if (!workout) throw new Error(`Unable to build fixture replacement conditioning on ${dayName}`);
  return {
    ...workout,
    name: args.stress === 'hard' ? 'Hard Conditioning' : 'Aerobic Conditioning',
    description: args.stress === 'hard'
      ? 'Hard game-replacement conditioning for the released fixture day.'
      : 'Moderate conditioning retained within the fixture-adjusted weekly structure.',
    planEntryId,
  };
}

function attachConditioningPreservingCore(target: Workout, conditioning: Workout): Workout {
  const appendedRows = (conditioning.exercises ?? []).map((row, index) => ({
    ...row,
    workoutId: target.id,
    exerciseOrder: target.exercises.length + index + 1,
  }));
  return {
    ...target,
    name: `${target.name} + ${conditioning.name}`,
    workoutType: target.workoutType === 'Team Training' ? target.workoutType : 'Mixed',
    intensity: conditioning.intensity === 'High' || conditioning.intensity === 'Maximal'
      ? 'High'
      : target.intensity,
    durationMinutes: target.durationMinutes + conditioning.durationMinutes,
    exercises: [...target.exercises, ...appendedRows],
    hasCombinedConditioning: true,
    attachedConditioningKind: conditioning.attachedConditioningKind,
    conditioningFlavour: conditioning.conditioningFlavour,
    conditioningCategory: conditioning.conditioningCategory,
    conditioningFeasibility: conditioning.conditioningFeasibility,
    conditioningBlock: conditioning.conditioningBlock,
    section18ConditioningRole: conditioning.section18ConditioningRole,
    section18Evidence: conditioning.section18Evidence,
    updatedAt: target.updatedAt > conditioning.updatedAt ? target.updatedAt : conditioning.updatedAt,
  };
}

function relocateNewStrength(
  template: Workout,
  dayNumber: number,
  weekStart: string,
  preserveIdentity = false,
): Workout {
  const dayName = DAY_NAMES[dayNumber];
  const id = preserveIdentity
    ? template.id
    : `${template.id}:fixture-replan:${weekStart}:${dayName.toLowerCase()}`;
  return {
    ...template,
    id,
    dayOfWeek: dayNumber,
    planEntryId: preserveIdentity
      ? template.planEntryId
      : `fixture-replan:${weekStart}:${dayName.toLowerCase()}:strength`,
    exercises: template.exercises.map((row, index) => ({
      ...row,
      id: preserveIdentity ? row.id : `${id}:row:${index + 1}`,
      workoutId: id,
      exerciseOrder: index + 1,
    })),
  };
}

/**
 * Calendar projection can displace a stored core row without deleting that
 * row from the raw candidate (for example Monday strength after a one-off
 * Sunday game). Those displaced rows are the first relocation templates:
 * moving them preserves accepted identity and prescription instead of
 * inventing replacement strength from the generated target.
 */
function displacedStrengthTemplates(
  input: BuildFixtureMinimalReplanInput,
  source: readonly Workout[],
): Workout[] {
  const projected = byDay(visibleResolver(input)(input.sourceWorkouts));
  const retainedIds = new Set(source.map((workout) => workout.planEntryId ?? workout.id));
  return input.sourceWorkouts.filter((workout) => {
    if (!hasMainStrength(workout) || isTeamTraining(workout)) return false;
    const visible = projected.get(workout.dayOfWeek);
    return !retainedIds.has(workout.planEntryId ?? workout.id) ||
      !visible || !hasMainStrength(visible) ||
      mainStrengthPrescription(visible) !== mainStrengthPrescription(workout);
  });
}

function addStrengthDeltaVariants(args: {
  input: BuildFixtureMinimalReplanInput;
  source: Workout[];
  evaluation: ReturnType<typeof evaluateSection18EffectiveWeek>;
  occupied: ReadonlySet<number>;
  releasedDays: ReadonlySet<number>;
}): Workout[][] {
  const contract = args.input.targetMicrocycle.exposureContractV2!;
  const target = contract.mainStrength.exposure.plannerSelectedTarget ??
    contract.mainStrength.exposure.requiredMinimum;
  const shortfall = Math.max(0, target - args.evaluation.ledger.mainStrength.achievedCount);
  if (shortfall === 0) return [args.source];
  const displaced = displacedStrengthTemplates(args.input, args.source);
  const generated = args.input.targetMicrocycle.workouts
    .filter((workout) => hasMainStrength(workout) && !isTeamTraining(workout))
    .map(stripConditioningComponent)
    .filter((workout): workout is Workout => !!workout);
  const displacedIds = new Set(displaced.map((workout) => workout.planEntryId ?? workout.id));
  const templates = [
    ...displaced.map((workout) => ({ workout, preserveIdentity: true })),
    ...generated
      .filter((workout) => !displacedIds.has(workout.planEntryId ?? workout.id))
      .map((workout) => ({ workout, preserveIdentity: false })),
  ];
  if (templates.length < shortfall) return [];
  const sourceMap = byDay(args.source);
  const placementDays = args.input.availability.effectiveAvailableDayNumbers
    .filter((day) => {
      if (args.occupied.has(day)) return false;
      const existing = sourceMap.get(day);
      return !existing || isOptional(existing) ||
        existing.workoutType === 'Recovery' || existing.workoutType === 'Rest' ||
        (workoutHasAppCoreConditioning(existing, args.evaluation) &&
          !hasMainStrength(existing) && !isTeamTraining(existing));
    })
    .sort((left, right) =>
      Number(!args.releasedDays.has(left)) - Number(!args.releasedDays.has(right)) || left - right);
  return combinations(placementDays, shortfall).map((days) => [
    ...args.source.filter((workout) => !days.includes(workout.dayOfWeek)),
    ...days.map((day, index) => relocateNewStrength(
      templates[index].workout,
      day,
      args.input.weekStart,
      templates[index].preserveIdentity,
    )),
  ]);
}

function workoutHasAppCoreConditioning(
  workout: Workout,
  evaluation: ReturnType<typeof evaluateSection18EffectiveWeek>,
): boolean {
  return evaluation.ledger.conditioning.credits.some((credit) =>
    credit.source === 'app' && credit.dayOfWeek === workout.dayOfWeek);
}

function displacedStandaloneConditioningTemplates(
  input: BuildFixtureMinimalReplanInput,
  source: readonly Workout[],
): Workout[] {
  const contract = input.targetMicrocycle.exposureContractV2!;
  const evaluation = evaluateSection18EffectiveWeek({
    contract,
    workouts: input.sourceWorkouts,
    weekStart: input.weekStart,
  });
  const appDays = new Set(evaluation.ledger.conditioning.credits
    .filter((credit) => credit.source === 'app')
    .map((credit) => credit.dayOfWeek));
  const retainedIds = new Set(source.map((workout) => workout.planEntryId ?? workout.id));
  return input.sourceWorkouts.filter((workout) =>
    appDays.has(workout.dayOfWeek) &&
    !retainedIds.has(workout.planEntryId ?? workout.id) &&
    !hasMainStrength(workout) &&
    !isTeamTraining(workout));
}

function relocateExistingConditioning(template: Workout, dayNumber: number): Workout {
  return {
    ...template,
    dayOfWeek: dayNumber,
    exercises: template.exercises.map((row, index) => ({
      ...row,
      workoutId: template.id,
      exerciseOrder: index + 1,
    })),
  };
}

/**
 * Moving an existing standalone app-conditioning session onto an existing
 * strength day creates rest without moving or rewriting that strength dose.
 */
function conditioningStackingVariants(
  args: BuildFixtureMinimalReplanInput,
  source: Workout[],
): Workout[][] {
  const contract = args.targetMicrocycle.exposureContractV2!;
  const evaluation = evaluateSection18EffectiveWeek({
    contract,
    workouts: source,
    weekStart: args.weekStart,
  });
  const standalone = source.filter((workout) =>
    workoutHasAppCoreConditioning(workout, evaluation) &&
    !hasMainStrength(workout) &&
    !isTeamTraining(workout));
  const targets = source.filter((workout) =>
    hasMainStrength(workout) &&
    !workoutHasAppCoreConditioning(workout, evaluation) &&
    !isTeamTraining(workout));
  const variants: Workout[][] = [source];
  for (const conditioning of standalone) {
    for (const target of targets) {
      variants.push(source
        .filter((workout) => workout.dayOfWeek !== conditioning.dayOfWeek)
        .map((workout) => workout.dayOfWeek === target.dayOfWeek
          ? attachConditioningPreservingCore(workout, conditioning)
          : workout));
    }
  }
  return variants;
}

function combinations(values: number[], size: number): number[][] {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  const output: number[][] = [];
  for (let index = 0; index <= values.length - size; index++) {
    for (const tail of combinations(values.slice(index + 1), size - 1)) {
      output.push([values[index], ...tail]);
    }
  }
  return output;
}

function maxActiveStreak(workouts: readonly Workout[]): number {
  const active = new Set(workouts.map((workout) => workout.dayOfWeek));
  let longest = 0;
  let current = 0;
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    if (active.has(day)) {
      current += 1;
      longest = Math.max(longest, current);
    } else current = 0;
  }
  return longest;
}

export function compareFixtureReplanEditCost(
  left: FixtureReplanEditCost,
  right: FixtureReplanEditCost,
): number {
  for (const key of EDIT_COST_ORDER) {
    const delta = left[key] - right[key];
    if (delta !== 0) return delta;
  }
  return 0;
}

function scoreCandidate(args: {
  source: readonly Workout[];
  candidate: readonly Workout[];
  gateway: Section18AcceptedWeekGatewayResult;
  availability: FixtureConditionedAvailability;
  addedDays: readonly number[];
}): FixtureReplanEditCost {
  const source = byDay(args.source);
  const candidate = byDay(args.candidate);
  const changedDays = DAY_NAMES
    .map((_, day) => day)
    .filter((day) => workoutSignature(source.get(day)) !== workoutSignature(candidate.get(day)));
  let changedCoreSessions = 0;
  let changedPlanEntryIdsOrPrescriptions = 0;
  let optionalChanges = 0;
  for (const day of changedDays) {
    const before = source.get(day);
    const after = candidate.get(day);
    if (isCore(before) && !coreSessionPreserved(before, after)) changedCoreSessions += 1;
    if (isOptional(before)) optionalChanges += 1;
    if (before?.planEntryId !== after?.planEntryId ||
      (isCore(before)
        ? !coreSessionPreserved(before, after)
        : workoutSignature(before) !== workoutSignature(after))) {
      changedPlanEntryIdsOrPrescriptions += 1;
    }
  }
  const releasedDays = new Set(args.availability.days
    .filter((day) => day.provenance.some(releaseProvenance))
    .map((day) => day.dayNumber));
  const patterns = Object.values(
    args.gateway.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount,
  );
  const patternImbalance = patterns.length > 0 ? Math.max(...patterns) - Math.min(...patterns) : 0;
  const available = new Set(args.availability.effectiveAvailableDayNumbers);
  const fixtureOwnedDays = new Set([
    ...args.availability.priorFixtures.map((fixture) =>
      new Date(`${fixture.date}T12:00:00`).getDay()),
    ...args.availability.releasedFixtures.map((fixture) =>
      new Date(`${fixture.date}T12:00:00`).getDay()),
  ]);
  const priorRecoveryDays = new Set([
    ...args.availability.priorFixtures.map((fixture) => dayAfter(fixture.date)),
    ...args.availability.releasedFixtures.map((fixture) => dayAfter(fixture.date)),
  ]);
  const fixtureOwnedChanges = changedDays.filter((day) =>
    fixtureOwnedDays.has(day) || (priorRecoveryDays.has(day) && !candidate.has(day)));
  const adjustedCoreChanges = Math.max(0, changedCoreSessions - fixtureOwnedChanges.filter(
    (day) => isCore(source.get(day)) && !coreSessionPreserved(source.get(day), candidate.get(day)),
  ).length);
  const adjustedIdentityChanges = Math.max(
    0,
    changedPlanEntryIdsOrPrescriptions - fixtureOwnedChanges.length,
  );
  return {
    section18Blockers: args.gateway.evaluation.blockingViolations.length,
    unavailableDayUses: args.addedDays.filter((day) => !available.has(day)).length,
    changedCoreSessions: adjustedCoreChanges,
    changedDays: changedDays.length,
    changedPlanEntryIdsOrPrescriptions: adjustedIdentityChanges,
    releasedFixtureDayPenalty: args.addedDays.length > 0 &&
      args.addedDays.some((day) => releasedDays.has(day)) ? 0 : 1,
    patternImbalance,
    restDeficit: Math.max(
      0,
      args.gateway.contract.restStress.requiredFullRestMinimum -
        args.gateway.evaluation.ledger.restStress.trueFullRestDays.length,
    ),
    duplicateStrengthPatternPenalty: patternImbalance > 1 ? patternImbalance - 1 : 0,
    excessiveActiveStreak: Math.max(0, maxActiveStreak(args.candidate) - 4),
    optionalBeforeCoreViolation: adjustedCoreChanges > 0 && optionalChanges === 0 ? 1 : 0,
  };
}

function changedDaySets(source: readonly Workout[], target: readonly Workout[]) {
  const before = byDay(source);
  const after = byDay(target);
  const changedDays = DAY_NAMES.map((_, day) => day)
    .filter((day) => workoutSignature(before.get(day)) !== workoutSignature(after.get(day)));
  return {
    changedDays,
    addedDays: changedDays.filter((day) => !before.has(day) && after.has(day)),
    removedDays: changedDays.filter((day) => before.has(day) && !after.has(day)),
  };
}

/** Fixture-specific preservation planner. Full generation is fallback only. */
export function buildFixtureMinimalReplan(
  args: BuildFixtureMinimalReplanInput,
): FixtureMinimalReplanResult {
  const contract = args.targetMicrocycle.exposureContractV2;
  if (!contract) throw new Error('Fixture minimal replan requires Contract v2');
  const source = trimStandaloneConditioningExcess(args, fixtureNeutralSource(args));
  const occupied = new Set(args.proposedFixtures.map((fixture) =>
    new Date(`${fixture.date}T12:00:00`).getDay()));
  const releasedDays = new Set(args.availability.days
    .filter((day) => day.provenance.some(releaseProvenance))
    .map((day) => day.dayNumber));

  const accepted: Array<{
    gateway: Section18AcceptedWeekGatewayResult;
    cost: FixtureReplanEditCost;
    addedDays: number[];
  }> = [];
  const rejectedCandidateSignatures: string[] = [];
  const candidateDiagnostics: FixtureReplanCandidateDiagnostic[] = [];
  if (args.mutationIntent === 'remove_weekly_exposure') {
    throw new RequiredCoreRelocationError('authorised_reduction_required', []);
  }
  for (const structuralSource of conditioningStackingVariants(args, source)) {
    const structuralEvaluation = evaluateSection18EffectiveWeek({
      contract,
      workouts: visibleResolver(args)(structuralSource),
      weekStart: args.weekStart,
    });
    const strengthVariants = addStrengthDeltaVariants({
      input: args,
      source: structuralSource,
      evaluation: structuralEvaluation,
      occupied,
      releasedDays,
    });
    for (const strengthSource of strengthVariants) {
      const baselineEvaluation = evaluateSection18EffectiveWeek({
        contract,
        workouts: visibleResolver(args)(strengthSource),
        weekStart: args.weekStart,
      });
      const shortfall = contract.identity.mode === 'in_season_bye_recovery'
        ? 0
        : Math.max(0, (contract.conditioning.core.plannerSelectedTarget ??
            contract.conditioning.core.requiredMinimum) -
          baselineEvaluation.ledger.conditioning.coreCount);
      const sourceMap = byDay(strengthSource);
      const daysWithConditioning = new Set(
        baselineEvaluation.ledger.conditioning.credits.map((credit) => credit.dayOfWeek),
      );
      const candidateDays = args.availability.effectiveAvailableDayNumbers.filter((day) => {
        if (occupied.has(day) || daysWithConditioning.has(day)) return false;
        const workout = sourceMap.get(day);
        return !workout || (hasMainStrength(workout) && !isTeamTraining(workout));
      });
      const displacedConditioning = displacedStandaloneConditioningTemplates(args, strengthSource);
      const daySets = shortfall === 0 ? [[]] : combinations(candidateDays, shortfall);
      for (const addedDays of daySets) {
        const role = baselineEvaluation.ledger.conditioning.coreCount <
          contract.conditioning.core.requiredMinimum
          ? 'required_core'
          : 'planner_selected_core';
        let candidate = [...strengthSource];
        for (const dayNumber of addedDays) {
          const displaced = displacedConditioning[addedDays.indexOf(dayNumber)];
          const conditioning = displaced
            ? relocateExistingConditioning(displaced, dayNumber)
            : buildConditioning({
                profile: args.profile,
                weekStart: args.weekStart,
                dayNumber,
                microcycle: args.targetMicrocycle,
                role,
                stress: releasedDays.has(dayNumber) ? 'hard' : 'moderate',
              });
          const existing = candidate.find((workout) => workout.dayOfWeek === dayNumber);
          candidate = existing
            ? candidate.map((workout) => workout.dayOfWeek === dayNumber
                ? attachConditioningPreservingCore(workout, conditioning)
                : workout)
            : [...candidate, conditioning];
        }
        candidate.sort((left, right) => left.dayOfWeek - right.dayOfWeek);
        const gateway = runSection18AcceptedWeekGateway({
          contract,
          workouts: candidate,
          weekStart: args.weekStart,
          profile: args.profile,
          resolveVisibleWorkouts: visibleResolver(args),
        });
        if (gateway.status === 'rejected') {
          const failureSignature = gateway.failureSignature ?? 'unknown';
          rejectedCandidateSignatures.push(failureSignature);
          candidateDiagnostics.push({
            addedDays,
            status: 'rejected',
            failureSignature,
          });
          continue;
        }
        const cost = scoreCandidate({
          source: args.sourceWorkouts,
          candidate: gateway.canonicalWorkouts,
          gateway,
          availability: args.availability,
          addedDays,
        });
        accepted.push({
          gateway,
          addedDays,
          cost,
        });
        candidateDiagnostics.push({ addedDays, status: 'accepted', editCost: cost });
      }
    }
  }

  accepted.sort((left, right) =>
    compareFixtureReplanEditCost(left.cost, right.cost) ||
    left.addedDays.join(',').localeCompare(right.addedDays.join(',')));
  const winner = accepted[0];
  if (winner) {
    const changes = changedDaySets(args.sourceWorkouts, winner.gateway.canonicalWorkouts);
    const retained = new Set(winner.gateway.canonicalWorkouts.map((workout) => workout.planEntryId));
    return {
      path: 'minimal_repair',
      usedFullRegeneration: false,
      workouts: winner.gateway.canonicalWorkouts,
      gateway: winner.gateway,
      editCost: winner.cost,
      ...changes,
      preservedCorePlanEntryIds: args.sourceWorkouts
        .filter((workout) => isCore(workout) && workout.planEntryId && retained.has(workout.planEntryId))
        .map((workout) => workout.planEntryId!),
      availability: args.availability,
      rejectedCandidateSignatures: Array.from(new Set(rejectedCandidateSignatures)),
      candidateDiagnostics,
      sourcePlanEntryIds: args.sourceWorkouts.flatMap((workout) =>
        workout.planEntryId ? [workout.planEntryId] : []),
    };
  }

  if (args.mutationIntent === 'remove_from_date') {
    throw new RequiredCoreRelocationError(
      'no_safe_placement',
      Array.from(new Set(rejectedCandidateSignatures)),
    );
  }

  const fallbackGateway = requireSection18AcceptedWeek({
    contract,
    workouts: source,
    weekStart: args.weekStart,
    profile: args.profile,
    resolveVisibleWorkouts: visibleResolver(args),
    regenerate: () => ({
      contract,
      workouts: args.targetMicrocycle.workouts,
    }),
    safeFallback: () => ({
      contract,
      workouts: args.targetMicrocycle.workouts,
    }),
  });
  const changes = changedDaySets(args.sourceWorkouts, fallbackGateway.canonicalWorkouts);
  const cost = scoreCandidate({
    source: args.sourceWorkouts,
    candidate: fallbackGateway.canonicalWorkouts,
    gateway: fallbackGateway,
    availability: args.availability,
    addedDays: changes.addedDays,
  });
  return {
    path: 'full_regeneration',
    usedFullRegeneration: true,
    workouts: fallbackGateway.canonicalWorkouts,
    gateway: fallbackGateway,
    editCost: cost,
    ...changes,
    preservedCorePlanEntryIds: [],
    availability: args.availability,
    rejectedCandidateSignatures: Array.from(new Set(rejectedCandidateSignatures)),
    candidateDiagnostics,
    sourcePlanEntryIds: args.sourceWorkouts.flatMap((workout) =>
      workout.planEntryId ? [workout.planEntryId] : []),
  };
}
