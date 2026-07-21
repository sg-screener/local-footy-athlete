import type {
  DerivedSessionProvenance,
  Microcycle,
  OnboardingData,
  UserRemovalConstraint,
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
import {
  appendDerivedSessionHistory,
  buildDerivedSessionExpiryCandidates,
  createDerivedSessionProvenance,
  section18ContractLifecycleSignature,
} from '../rules/derivedSessionProvenance';
import type {
  AvailabilityProvenance,
  FixtureConditionedAvailability,
  TargetWeekFixture,
} from '../rules/fixtureConditionedAvailability';
import type { CalendarDayType } from '../store/calendarStore';
import { hasMeaningfulWorkoutContent } from './workoutContent';
import { getSessionComponentRows } from './sessionComponents';
import { resolveSessionDisplayName } from './sessionNaming';
import { normalizeVisibleWorkoutIdentity } from './visibleWorkoutIdentity';
import {
  activeUserRemovalConstraintsForWeek,
  applyAthleteRemovalTypedReduction,
} from '../rules/userRemovalConstraints';
import {
  athleteActionDiagnosticHash,
  classifyAthleteActionFailure,
  currentAthleteActionTrace,
  emitAthleteActionEvent,
} from './athleteActionDiagnostics';

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
  /** Bounded accepted candidates retained for rolling-horizon composition. */
  alternatives: FixtureMinimalReplanAlternative[];
}

export interface FixtureMinimalReplanAlternative {
  workouts: Workout[];
  gateway: Section18AcceptedWeekGatewayResult;
  editCost: FixtureReplanEditCost;
  changedDays: number[];
  addedDays: number[];
  removedDays: number[];
  preservedCorePlanEntryIds: string[];
}

export interface FixtureReplanCandidateDiagnostic {
  addedDays: number[];
  status: 'accepted' | 'rejected';
  editCost?: FixtureReplanEditCost;
  failureSignature?: string;
  canonicalConditioningDays?: number[];
  visibleConditioningCredits?: Array<{ dayOfWeek: number; source: string; role: string }>;
  repairs?: Section18AcceptedWeekGatewayResult['repairs'];
}

export type FixtureMutationIntent =
  | 'fixture_transition'
  | 'remove_from_date'
  | 'athlete_removal'
  | 'athlete_move'
  | 'athlete_addition'
  | 'restore_adjustment'
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

const ROLLING_HORIZON_ALTERNATIVE_CAP = 8;

export interface BuildFixtureMinimalReplanInput {
  profile: OnboardingData;
  weekStart: string;
  sourceWorkouts: readonly Workout[];
  targetMicrocycle: Microcycle;
  availability: FixtureConditionedAvailability;
  proposedMarkedDays: Record<string, CalendarDayType>;
  priorFixtures: readonly TargetWeekFixture[];
  proposedFixtures: readonly TargetWeekFixture[];
  activeFixtureDates?: ReadonlySet<string>;
  userRemovalConstraints?: readonly UserRemovalConstraint[];
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
  // Calendar/availability resolution owns whether a retained session is
  // visible. Keeping it in the candidate lets the generic repair owner move or
  // stack it and prevents user/Coach-authored work from being discarded merely
  // because a new anchor temporarily occupies its date.
  const occupied = new Set(args.proposedFixtures.map((fixture) =>
    new Date(`${fixture.date}T12:00:00`).getDay()));
  const unavailable = new Set(args.availability.days
    .filter((day) => !day.available && day.blockedBy.length > 0)
    .map((day) => day.dayNumber));
  return args.sourceWorkouts.filter((workout) => {
    if (workout.workoutType === 'Game') return false;
    const collides = occupied.has(workout.dayOfWeek) || (
      workout.workoutType !== 'Team Training' && unavailable.has(workout.dayOfWeek)
    );
    if (!collides) return true;
    // Only explicitly system-owned content is disposable here. An unprovenanced
    // legacy/user/Coach session stays in the candidate for relocation or a
    // typed impossible result; it is never silently treated as fixture debris.
    return !workout.derivedSessionProvenance?.some((record) => record.authorship === 'system');
  });
}

function visibleResolver(
  args: BuildFixtureMinimalReplanInput,
  contract = args.targetMicrocycle.exposureContractV2!,
) {
  return (workouts: readonly Workout[]): Workout[] => resolveFinalVisibleSection18Week({
    contract,
    workouts,
    weekStart: args.weekStart,
    profile: args.profile,
    scheduleState: {
      markedDays: args.proposedMarkedDays,
      availableDayNumbers: args.availability.effectiveAvailableDayNumbers,
    },
    userRemovalConstraints: args.userRemovalConstraints,
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
    section18ConditioningRole: 'none',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    derivedSessionProvenance: workout.derivedSessionProvenance?.filter((record) =>
      record.scope !== 'conditioning_component' && record.targetMetric !== 'conditioning_core'),
  });
  return hasMeaningfulWorkoutContent(stripped) ? stripped : null;
}

/**
 * A strength component displaced from a stacked day is a relocatable app
 * component, not the whole source workout. In particular, Team Training is a
 * fixed anchor and must remain on its accepted date while the attached lift
 * moves with its exact typed intent and prescription.
 */
function extractRelocatableStrengthComponent(workout: Workout): Workout | null {
  const { strengthRows, supportRows } = getSessionComponentRows(workout);
  const retainedIds = new Set([...strengthRows, ...supportRows]
    .map((row) => row.id)
    .filter(Boolean));
  const exercises = workout.exercises.filter((row) => retainedIds.has(row.id));
  if (exercises.length === 0 || !workout.strengthIntent?.effectivePatterns.length) {
    return null;
  }
  const id = `${workout.id}:strength-component`;
  const planEntryId = `${workout.planEntryId ?? workout.id}:strength-component`;
  const component = {
    ...workout,
    id,
    planEntryId,
    name: resolveSessionDisplayName({
      strengthIntent: workout.strengthIntent,
      exercises,
      isTeamDay: false,
      tier: 'core',
    }),
    workoutType: 'Strength' as const,
    sessionTier: 'core' as const,
    exercises: exercises.map((row, index) => ({
      ...row,
      id: row.id,
      workoutId: id,
      exerciseOrder: index + 1,
    })),
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    conditioningFlavour: undefined,
    conditioningCategory: undefined,
    conditioningFeasibility: undefined,
    conditioningBlock: undefined,
    coachAddedConditioningLabel: undefined,
    section18ConditioningRole: 'none' as const,
    section18Evidence: {
      protocolVersion: 1 as const,
      conditioningRole: 'none' as const,
      conditioningStress: 'unknown' as const,
      provenance: 'explicit_mutation' as const,
    },
    derivedSessionProvenance: workout.derivedSessionProvenance?.filter((record) =>
      record.scope === 'strength_component' || record.targetMetric === 'main_strength' ||
      record.targetMetric === 'strength_pattern'),
    ...({ isTeamDay: false } as Record<string, unknown>),
  } as Workout;
  return hasMeaningfulWorkoutContent(component) ? component : null;
}

function buildConditioning(args: {
  profile: OnboardingData;
  weekStart: string;
  dayNumber: number;
  microcycle: Microcycle;
  role: 'required_core' | 'planner_selected_core';
  stress: 'hard' | 'moderate';
  origin: 'fixture_replacement' | 'contract_shortfall_repair';
  originatingFixtureDate: string | null;
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
    derivedSessionProvenance: [createDerivedSessionProvenance({
      origin: args.origin,
      scope: 'session',
      triggerSignature: section18ContractLifecycleSignature(
        args.microcycle.exposureContractV2!,
        args.weekStart,
      ),
      credit: {
        metric: 'conditioning_core',
        amount: 1,
        conditioningRole: args.role,
      },
      originatingDate: args.weekStart,
      originatingFixtureDate: args.originatingFixtureDate,
      sourcePlanEntryId: planEntryId,
      validWhile: args.origin === 'fixture_replacement'
        ? [{ kind: 'fixture_absent', fixtureDate: args.originatingFixtureDate }]
        : undefined,
    })],
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
    derivedSessionProvenance: [
      ...(target.derivedSessionProvenance ?? []).filter((record) =>
        record.scope !== 'conditioning_component' && record.targetMetric !== 'conditioning_core'),
      ...(conditioning.derivedSessionProvenance ?? []).map((record) => ({
        ...record,
        scope: 'conditioning_component' as const,
        history: [...record.history, {
          action: 'stacked' as const,
          date: record.originatingDate,
          fromDayOfWeek: conditioning.dayOfWeek,
          toDayOfWeek: target.dayOfWeek,
        }],
      })),
    ],
    updatedAt: target.updatedAt > conditioning.updatedAt ? target.updatedAt : conditioning.updatedAt,
  };
}

function relocateNewStrength(
  template: Workout,
  dayNumber: number,
  weekStart: string,
  contract: NonNullable<Microcycle['exposureContractV2']>,
  preserveIdentity = false,
  fixtureDisplacement?: DerivedSessionProvenance,
): Workout {
  const dayName = DAY_NAMES[dayNumber];
  const id = preserveIdentity
    ? template.id
    : `${template.id}:fixture-replan:${weekStart}:${dayName.toLowerCase()}`;
  const triggerSignature = section18ContractLifecycleSignature(contract, weekStart);
  const existingProvenance = template.derivedSessionProvenance?.map((record) => ({
    ...record,
    origin: preserveIdentity ? record.origin : 'pattern_balance_repair' as const,
    triggerSignature,
    validWhile: preserveIdentity
      ? []
      : [{ kind: 'contract_signature_matches' as const, signature: triggerSignature }],
    invalidWhen: preserveIdentity ? [] : record.invalidWhen,
    history: [...record.history, {
      action: 'relocated' as const,
      date: weekStart,
      fromDayOfWeek: template.dayOfWeek,
      toDayOfWeek: dayNumber,
    }],
  }));
  let derivedSessionProvenance = existingProvenance?.length
    ? existingProvenance
    : preserveIdentity
      ? undefined
      : [createDerivedSessionProvenance({
          origin: 'pattern_balance_repair',
          scope: 'session',
          triggerSignature,
          credit: { metric: 'main_strength', amount: 1 },
          originatingDate: weekStart,
          sourcePlanEntryId: template.planEntryId ?? null,
          history: [{
            action: 'relocated',
            date: weekStart,
            fromDayOfWeek: template.dayOfWeek,
            toDayOfWeek: dayNumber,
          }],
        })];
  if (fixtureDisplacement?.dependency) {
    const offset = dayNumber === 0 ? 6 : dayNumber - 1;
    const target = new Date(`${weekStart}T12:00:00`);
    target.setDate(target.getDate() + offset);
    const targetDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    derivedSessionProvenance = [
      ...(derivedSessionProvenance ?? []),
      {
        ...fixtureDisplacement,
        origin: 'required_core_relocation',
        credit: { metric: 'main_strength', amount: 1 },
        targetMetric: 'main_strength',
        originatingDate: targetDate,
        sourcePlanEntryId: template.planEntryId ?? null,
        history: [...fixtureDisplacement.history, {
          action: 'relocated',
          date: targetDate,
          fromDayOfWeek: template.dayOfWeek,
          toDayOfWeek: dayNumber,
          detail: 'Temporary relocation owned by the fixture dependency that displaced the source session.',
        }],
        dependency: {
          ...fixtureDisplacement.dependency,
          target: { date: targetDate, weekStart },
          crossesWeekBoundary: fixtureDisplacement.dependency.source.weekStart !== weekStart,
          displacedSession: {
            targetDate,
            sourcePlanEntryId: null,
            workout: null,
          },
          restoration: {
            targetDate,
            sourcePlanEntryId: null,
            workout: null,
          },
        },
      },
    ];
  }
  return {
    ...template,
    id,
    dayOfWeek: dayNumber,
    planEntryId: preserveIdentity
      ? template.planEntryId
      : `fixture-replan:${weekStart}:${dayName.toLowerCase()}:strength`,
    derivedSessionProvenance,
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
): Array<{ workout: Workout; fixtureDisplacement?: DerivedSessionProvenance }> {
  const explicitComponentDisplacements = activeUserRemovalConstraintsForWeek(
    input.userRemovalConstraints,
    input.weekStart,
  ).flatMap((constraint) => {
    if (constraint.scope !== 'strength_component' ||
      !constraint.equivalentExposureMayRelocate) return [];
    const component = extractRelocatableStrengthComponent(constraint.originalWorkout);
    return component ? [{ workout: component }] : [];
  });
  const explicitSourceIds = new Set(activeUserRemovalConstraintsForWeek(
    input.userRemovalConstraints,
    input.weekStart,
  ).flatMap((constraint) => constraint.scope === 'strength_component'
    ? [constraint.targetPlanEntryId ?? constraint.targetWorkoutId]
    : []));
  const projected = byDay(visibleResolver(input)(input.sourceWorkouts));
  const retainedIds = new Set(source.map((workout) => workout.planEntryId ?? workout.id));
  const inferredDisplacements = input.sourceWorkouts.flatMap((workout) => {
    if (!hasMainStrength(workout) || isTeamTraining(workout)) return [];
    if (explicitSourceIds.has(workout.planEntryId ?? workout.id)) return [];
    const visible = projected.get(workout.dayOfWeek);
    const displaced = !retainedIds.has(workout.planEntryId ?? workout.id) ||
      !visible || !hasMainStrength(visible);
    if (!displaced) return [];
    const fixtureDisplacement = visible?.derivedSessionProvenance?.find((record) =>
      !!record.dependency && (
        record.dependency.restoration.sourcePlanEntryId === workout.planEntryId ||
        record.dependency.displacedSession.sourcePlanEntryId === workout.planEntryId
      ));
    const keepsAnotherVisibleComponent = !!visible;
    const relocationTemplate = keepsAnotherVisibleComponent
      ? extractRelocatableStrengthComponent(workout)
      : workout;
    return relocationTemplate ? [{ workout: relocationTemplate, fixtureDisplacement }] : [];
  });
  return [...explicitComponentDisplacements, ...inferredDisplacements];
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
  const displacedIds = new Set([
    ...displaced.map(({ workout }) => workout.planEntryId ?? workout.id),
    ...activeUserRemovalConstraintsForWeek(
      args.input.userRemovalConstraints,
      args.input.weekStart,
    ).flatMap((constraint) => constraint.scope === 'strength_component'
      ? [constraint.targetPlanEntryId ?? constraint.targetWorkoutId]
      : []),
  ]);
  const templates = [
    ...displaced.map(({ workout, fixtureDisplacement }) => ({
      workout,
      preserveIdentity: true,
      fixtureDisplacement,
    })),
    ...generated
      .filter((workout) => !displacedIds.has(workout.planEntryId ?? workout.id))
      .map((workout) => ({ workout, preserveIdentity: false, fixtureDisplacement: undefined })),
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
      contract,
      templates[index].preserveIdentity,
      templates[index].fixtureDisplacement,
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

function relocateExistingConditioning(
  template: Workout,
  dayNumber: number,
  contract: NonNullable<Microcycle['exposureContractV2']>,
  weekStart: string,
): Workout {
  const triggerSignature = section18ContractLifecycleSignature(contract, weekStart);
  return {
    ...template,
    dayOfWeek: dayNumber,
    derivedSessionProvenance: appendDerivedSessionHistory(
      template.derivedSessionProvenance?.map((record) => ({
        ...record,
        origin: record.targetMetric === 'conditioning_core'
          ? 'required_core_relocation' as const
          : record.origin,
        triggerSignature,
        validWhile: [],
        invalidWhen: [],
      })), {
        action: 'relocated',
        date: weekStart,
        fromDayOfWeek: template.dayOfWeek,
        toDayOfWeek: dayNumber,
      }),
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

/** Lower-priority work is the first capacity sacrifice for required repair. */
function optionalDisplacementVariants(
  args: BuildFixtureMinimalReplanInput,
  source: Workout[],
): Workout[][] {
  const available = new Set(args.availability.effectiveAvailableDayNumbers);
  const removable = source.filter((workout) =>
    available.has(workout.dayOfWeek) && isOptional(workout) &&
    !isTeamTraining(workout) && workout.workoutType !== 'Game');
  return [
    source,
    ...removable.map((optional) =>
      source.filter((workout) => workout !== optional)),
  ];
}

/**
 * A returning fixture can supply conditioning that an app session supplied
 * in the prior accepted week. Remove only the resulting surplus app credit;
 * preserve a stacked strength component whenever one exists.
 */
function conditioningSurplusVariants(
  args: BuildFixtureMinimalReplanInput,
  source: Workout[],
): Workout[][] {
  const contract = args.targetMicrocycle.exposureContractV2!;
  const evaluation = evaluateSection18EffectiveWeek({
    contract,
    workouts: visibleResolver(args)(source),
    weekStart: args.weekStart,
  });
  const maximum = contract.conditioning.core.permittedMaximum;
  if (maximum === null || evaluation.ledger.conditioning.coreCount <= maximum) {
    return [source];
  }
  const excess = evaluation.ledger.conditioning.coreCount - maximum;
  const appDays = new Set(evaluation.ledger.conditioning.credits
    .filter((credit) => credit.source === 'app')
    .map((credit) => credit.dayOfWeek));
  const removable = source
    .filter((workout) => appDays.has(workout.dayOfWeek) &&
      !isTeamTraining(workout) && workout.workoutType !== 'Game')
    .sort((left, right) =>
      Number(!left.derivedSessionProvenance?.some((record) => record.authorship === 'system')) -
        Number(!right.derivedSessionProvenance?.some((record) => record.authorship === 'system')) ||
      Number(hasMainStrength(left)) - Number(hasMainStrength(right)) ||
      left.dayOfWeek - right.dayOfWeek);
  return [
    source,
    ...combinations(removable.map((_, index) => index), excess).map((indexes) => {
      const selected = new Set(indexes.map((index) => removable[index]));
      return source.flatMap((workout) => {
        if (!selected.has(workout)) return [workout];
        const survivor = stripConditioningComponent(workout);
        return survivor ? [survivor] : [];
      });
    }),
  ];
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
  preferredReplacementDay?: number | null;
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
    // In a no-fixture week the recurring fixture slot owns the preferred
    // replacement shape. A temporarily moved/released Sunday must not become
    // the permanent conditioning preference merely because it was released
    // most recently.
    releasedFixtureDayPenalty: args.addedDays.length > 0 && args.addedDays.some((day) =>
      args.preferredReplacementDay === null || args.preferredReplacementDay === undefined
        ? releasedDays.has(day)
        : day === args.preferredReplacementDay) ? 0 : 1,
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

/**
 * Fixture adapter: enumerate preservation-biased seed candidates only. The
 * shared whole-week gateway owns lifecycle expiry, repair and acceptance;
 * full generation remains its fallback rather than a fixture authority.
 */
export function buildFixtureMinimalReplan(
  args: BuildFixtureMinimalReplanInput,
): FixtureMinimalReplanResult {
  const trace = currentAthleteActionTrace();
  const contract = args.targetMicrocycle.exposureContractV2;
  if (!contract) throw new Error('Fixture minimal replan requires Contract v2');
  const fixtureNeutral = fixtureNeutralSource(args);
  const source = buildDerivedSessionExpiryCandidates({
    workouts: fixtureNeutral,
    contract,
    weekStart: args.weekStart,
    activeFixtureDates: args.activeFixtureDates,
  })[0]?.workouts ?? fixtureNeutral;
  const occupied = new Set(args.proposedFixtures.map((fixture) =>
    new Date(`${fixture.date}T12:00:00`).getDay()));
  const releasedDays = new Set(args.availability.days
    .filter((day) => day.provenance.some(releaseProvenance))
    .map((day) => day.dayNumber));
  const removedFixture = args.priorFixtures.find((fixture) =>
    !args.proposedFixtures.some((proposed) => proposed.date === fixture.date)) ?? null;
  const recurringFixtureDay = args.profile.usualGameDay ?? args.profile.gameDay;
  const preferredReplacementDay = args.proposedFixtures.length === 0 &&
    recurringFixtureDay && recurringFixtureDay !== 'Varies'
    ? DAY_NAMES.indexOf(recurringFixtureDay)
    : null;

  const accepted: Array<{
    gateway: Section18AcceptedWeekGatewayResult;
    cost: FixtureReplanEditCost;
    addedDays: number[];
  }> = [];
  const rejectedCandidates: Array<{
    gateway: Section18AcceptedWeekGatewayResult;
    workouts: Workout[];
  }> = [];
  const structuralFallbackSeeds: Workout[][] = [];
  const rejectedCandidateSignatures: string[] = [];
  const candidateDiagnostics: FixtureReplanCandidateDiagnostic[] = [];
  if (args.mutationIntent === 'remove_weekly_exposure') {
    throw new RequiredCoreRelocationError('authorised_reduction_required', []);
  }
  for (const optionalSource of optionalDisplacementVariants(args, source)) {
    for (const surplusSource of conditioningSurplusVariants(args, optionalSource)) {
      for (const structuralSource of conditioningStackingVariants(args, surplusSource)) {
        structuralFallbackSeeds.push(structuralSource);
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
          const daysWithCoreConditioning = new Set(
            strengthSource
              .filter((workout) => {
                const role = workout.section18Evidence?.conditioningRole ??
                  workout.section18ConditioningRole;
                return role === 'required_core' || role === 'planner_selected_core' || role === 'core';
              })
              .map((workout) => workout.dayOfWeek),
          );
          const candidateDays = args.availability.effectiveAvailableDayNumbers.filter((day) => {
            if (occupied.has(day) || daysWithCoreConditioning.has(day)) return false;
            const workout = sourceMap.get(day);
            return !workout || (hasMainStrength(workout) && !isTeamTraining(workout)) ||
              workout.derivedSessionProvenance
                ?.some((record) => record.authorship === 'system') === true;
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
                ? relocateExistingConditioning(displaced, dayNumber, contract, args.weekStart)
                : buildConditioning({
                    profile: args.profile,
                    weekStart: args.weekStart,
                    dayNumber,
                    microcycle: args.targetMicrocycle,
                    role,
                    stress: releasedDays.has(dayNumber) ? 'hard' : 'moderate',
                    origin: removedFixture ? 'fixture_replacement' : 'contract_shortfall_repair',
                    originatingFixtureDate: removedFixture?.date ?? null,
                  });
              const existing = candidate.find((workout) => workout.dayOfWeek === dayNumber);
              candidate = existing && hasMainStrength(existing)
                ? candidate.map((workout) => workout.dayOfWeek === dayNumber
                    ? attachConditioningPreservingCore(workout, conditioning)
                    : workout)
                : [
                    ...candidate.filter((workout) => workout.dayOfWeek !== dayNumber),
                    conditioning,
                  ];
            }
            candidate.sort((left, right) => left.dayOfWeek - right.dayOfWeek);
            const gateway = runSection18AcceptedWeekGateway({
              contract,
              workouts: candidate,
              weekStart: args.weekStart,
              profile: args.profile,
              activeFixtureDates: args.activeFixtureDates,
              userRemovalConstraints: args.userRemovalConstraints,
              resolveVisibleWorkouts: visibleResolver(args),
            });
            if (gateway.status === 'impossible') {
              rejectedCandidates.push({
                gateway,
                workouts: gateway.canonicalWorkouts,
              });
              const failureSignature = gateway.failureSignature ?? 'unknown';
              rejectedCandidateSignatures.push(failureSignature);
              candidateDiagnostics.push({
                addedDays,
                status: 'rejected',
                failureSignature,
                canonicalConditioningDays: gateway.canonicalWorkouts
                  .filter((workout) => !!workout.section18Evidence?.conditioningRole)
                  .map((workout) => workout.dayOfWeek),
                visibleConditioningCredits: gateway.evaluation.ledger.conditioning.credits
                  .map((credit) => ({
                    dayOfWeek: credit.dayOfWeek,
                    source: credit.source,
                    role: credit.role,
                  })),
                repairs: gateway.repairs,
              });
              emitAthleteActionEvent(trace, 'repair_candidate_rejected', {
                candidateId: athleteActionDiagnosticHash({
                  weekId: args.weekStart,
                  addedDays,
                  canonical: gateway.canonicalWorkouts.map((workout) =>
                    workout.planEntryId ?? workout.id),
                }),
                candidateIndex: candidateDiagnostics.length - 1,
                affectedWeek: args.weekStart,
                candidateChanges: { addedDays },
                candidateStrengthDays: gateway.visibleWorkouts
                  .filter((workout) => hasMainStrength(workout))
                  .map((workout) => ({
                    dayOfWeek: workout.dayOfWeek,
                    identity: workout.planEntryId ?? workout.id,
                    patterns: workout.strengthIntent?.effectivePatterns ?? [],
                  })),
                rejectionCodes: gateway.evaluation.blockingViolations.map((finding) =>
                  `${finding.code}:${finding.domain}`),
                rejectingBoundary: 'buildFixtureMinimalReplan',
                relevantInvariant: gateway.evaluation.blockingViolations
                  .map((finding) => finding.domain).join(','),
                failureCategory: classifyAthleteActionFailure(
                  gateway.evaluation.blockingViolations[0]?.code,
                  'buildFixtureMinimalReplan',
                ),
              });
              continue;
            }
            const cost = scoreCandidate({
              source: args.sourceWorkouts,
              candidate: gateway.canonicalWorkouts,
              gateway,
              availability: args.availability,
              addedDays,
              preferredReplacementDay,
            });
            accepted.push({ gateway, addedDays, cost });
            candidateDiagnostics.push({ addedDays, status: 'accepted', editCost: cost });
          }
        }
      }
    }
  }

  accepted.sort((left, right) =>
    compareFixtureReplanEditCost(left.cost, right.cost) ||
    left.addedDays.join(',').localeCompare(right.addedDays.join(',')));
  const winner = accepted[0];
  emitAthleteActionEvent(trace, 'repair_candidates_generated', {
    candidateCount: accepted.length + rejectedCandidates.length,
    acceptedCandidateCount: accepted.length,
    rejectedCandidateCount: rejectedCandidates.length,
    affectedWeek: args.weekStart,
    boundary: 'buildFixtureMinimalReplan',
  });
  if (winner) {
    const changes = changedDaySets(args.sourceWorkouts, winner.gateway.canonicalWorkouts);
    const retained = new Set(winner.gateway.canonicalWorkouts.map((workout) => workout.planEntryId));
    emitAthleteActionEvent(trace, 'repair_candidate_selected', {
      candidateId: athleteActionDiagnosticHash({
        weekId: args.weekStart,
        canonical: winner.gateway.canonicalWorkouts.map((workout) =>
          workout.planEntryId ?? workout.id),
      }),
      candidateScore: winner.cost,
      preservationCost: winner.cost,
      candidateChanges: changedDaySets(args.sourceWorkouts, winner.gateway.canonicalWorkouts),
      affectedWeek: args.weekStart,
      outcome: winner.gateway.status,
      boundary: 'buildFixtureMinimalReplan',
    });
    const seenAlternatives = new Set<string>();
    const alternatives: FixtureMinimalReplanAlternative[] = [];
    for (const candidate of accepted) {
      const signature = candidate.gateway.canonicalWorkouts
        .map((workout) => `${workout.dayOfWeek}:${workoutSignature(workout)}`)
        .sort()
        .join('|');
      if (seenAlternatives.has(signature)) continue;
      seenAlternatives.add(signature);
      alternatives.push({
        workouts: candidate.gateway.canonicalWorkouts,
        gateway: candidate.gateway,
        editCost: candidate.cost,
        ...changedDaySets(args.sourceWorkouts, candidate.gateway.canonicalWorkouts),
        preservedCorePlanEntryIds: args.sourceWorkouts
          .filter((workout) => isCore(workout) && workout.planEntryId &&
            candidate.gateway.canonicalWorkouts.some((acceptedWorkout) =>
              acceptedWorkout.planEntryId === workout.planEntryId))
          .map((workout) => workout.planEntryId!),
      });
      if (alternatives.length >= ROLLING_HORIZON_ALTERNATIVE_CAP) break;
    }
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
      alternatives,
    };
  }

  const activeRemovalConstraint = activeUserRemovalConstraintsForWeek(
    args.userRemovalConstraints,
    args.weekStart,
  ).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (
    args.mutationIntent === 'athlete_removal' ||
    args.mutationIntent === 'athlete_move' ||
    activeRemovalConstraint
  ) {
    const constraint = activeRemovalConstraint;
    if (!constraint) {
      throw new Error('Athlete mutation repair requires an active typed constraint');
    }
    const seenFallbackSeeds = new Set<string>();
    for (const fallbackSeed of structuralFallbackSeeds) {
      const seedSignature = fallbackSeed
        .map((workout) => `${workout.dayOfWeek}:${workoutSignature(workout)}`)
        .sort()
        .join('|');
      if (seenFallbackSeeds.has(seedSignature)) continue;
      seenFallbackSeeds.add(seedSignature);
      const gateway = runSection18AcceptedWeekGateway({
        contract,
        workouts: fallbackSeed,
        weekStart: args.weekStart,
        profile: args.profile,
        activeFixtureDates: args.activeFixtureDates,
        userRemovalConstraints: args.userRemovalConstraints,
        resolveVisibleWorkouts: visibleResolver(args),
      });
      if (gateway.status === 'impossible') {
        rejectedCandidates.push({ gateway, workouts: gateway.canonicalWorkouts });
      }
    }
    // Typed deletion reductions can lower an unattainable minimum, but never
    // relax a phase/safety maximum. Prefer a ceiling-safe candidate before
    // comparing the remaining reducible shortfalls.
    const bestRejected = [...rejectedCandidates].sort((left, right) =>
      left.gateway.evaluation.blockingViolations.filter((finding) =>
        finding.code === 'maximum_breach').length -
        right.gateway.evaluation.blockingViolations.filter((finding) =>
          finding.code === 'maximum_breach').length ||
      left.gateway.evaluation.blockingViolations.length -
        right.gateway.evaluation.blockingViolations.length ||
      (left.gateway.failureSignature ?? '').localeCompare(right.gateway.failureSignature ?? ''))[0];
    const reductionSource = bestRejected?.workouts ?? source;
    const visible = bestRejected?.gateway.visibleWorkouts ?? visibleResolver(args)(source);
    let reducedContract = applyAthleteRemovalTypedReduction({
      contract,
      workouts: visible,
      weekStart: args.weekStart,
      constraint,
    });
    let reducedGateway: Section18AcceptedWeekGatewayResult;
    for (let attempt = 0; ; attempt += 1) {
      reducedGateway = runSection18AcceptedWeekGateway({
        contract: reducedContract,
        workouts: reductionSource,
        weekStart: args.weekStart,
        profile: args.profile,
        activeFixtureDates: args.activeFixtureDates,
        userRemovalConstraints: args.userRemovalConstraints,
        resolveVisibleWorkouts: visibleResolver(args, reducedContract),
      });
      if (reducedGateway.status !== 'impossible' || attempt >= 3) break;
      // Safety finalisation can expose a second-order shortfall (for example,
      // a now-unrepresentable strength pattern). Reduce from that accepted-
      // state candidate as well; the loop is monotonic and strictly bounded.
      const nextContract = applyAthleteRemovalTypedReduction({
        contract: reducedContract,
        workouts: reducedGateway.visibleWorkouts,
        weekStart: args.weekStart,
        constraint,
      });
      if (JSON.stringify(nextContract) === JSON.stringify(reducedContract)) break;
      reducedContract = nextContract;
    }
    if (reducedGateway.status === 'impossible') {
      throw new Error(
        `Athlete deletion could not be published after typed reduction ` +
        `(${reducedGateway.failureSignature ?? 'unknown'}).`,
      );
    }
    reducedGateway.repairs.push({
      kind: 'athlete_removal_typed_reduction',
      detail: `Preserved athlete removal on ${constraint.targetDate} and recorded explicit_user_override for the unavoidable shortfall.`,
    });
    emitAthleteActionEvent(trace, 'repair_candidate_selected', {
      candidateId: athleteActionDiagnosticHash({
        weekId: args.weekStart,
        reductionConstraint: constraint.id,
        canonical: reducedGateway.canonicalWorkouts.map((workout) =>
          workout.planEntryId ?? workout.id),
      }),
      candidateScore: { blockingCount: 0, typedReduction: true },
      candidateChanges: changedDaySets(args.sourceWorkouts, reducedGateway.canonicalWorkouts),
      affectedWeek: args.weekStart,
      typedReductionCreated: reducedGateway.contract.authorisedReductions
        .filter((reduction) => reduction.reason === 'explicit_user_override')
        .map((reduction) => ({
          metric: reduction.metric,
          reducedTarget: reduction.reducedTarget,
          reason: reduction.reason,
        })),
      outcome: 'reduced',
      boundary: 'buildFixtureMinimalReplan',
    });
    const changes = changedDaySets(args.sourceWorkouts, reducedGateway.canonicalWorkouts);
    const cost = scoreCandidate({
      source: args.sourceWorkouts,
      candidate: reducedGateway.canonicalWorkouts,
      gateway: reducedGateway,
      availability: args.availability,
      addedDays: changes.addedDays,
      preferredReplacementDay,
    });
    const alternative: FixtureMinimalReplanAlternative = {
      workouts: reducedGateway.canonicalWorkouts,
      gateway: reducedGateway,
      editCost: cost,
      ...changes,
      preservedCorePlanEntryIds: args.sourceWorkouts
        .filter((workout) => isCore(workout) && workout.planEntryId &&
          reducedGateway.canonicalWorkouts.some((candidate) =>
            candidate.planEntryId === workout.planEntryId))
        .map((workout) => workout.planEntryId!),
    };
    return {
      path: 'minimal_repair',
      usedFullRegeneration: false,
      workouts: alternative.workouts,
      gateway: reducedGateway,
      editCost: cost,
      ...changes,
      preservedCorePlanEntryIds: alternative.preservedCorePlanEntryIds,
      availability: args.availability,
      rejectedCandidateSignatures: Array.from(new Set(rejectedCandidateSignatures)),
      candidateDiagnostics,
      sourcePlanEntryIds: args.sourceWorkouts.flatMap((workout) =>
        workout.planEntryId ? [workout.planEntryId] : []),
      alternatives: [alternative],
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
    activeFixtureDates: args.activeFixtureDates,
    userRemovalConstraints: args.userRemovalConstraints,
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
    preferredReplacementDay,
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
    alternatives: [{
      workouts: fallbackGateway.canonicalWorkouts,
      gateway: fallbackGateway,
      editCost: cost,
      ...changes,
      preservedCorePlanEntryIds: [],
    }],
  };
}
