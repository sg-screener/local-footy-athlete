/**
 * THE CANONICAL WEEKLY COMPILER — one typed input, one authored week plan.
 *
 * This is deliberately an orchestration boundary, not a new policy owner:
 *
 *   scheduler facts -> one schedule -> specialist materialisation -> connector
 *
 * The scheduler remains the only owner of which days exist. Specialists still
 * own their content and the connector still only translates. What this module
 * removes is the old freedom for callers to run those stages independently,
 * or to schedule the same week twice and accidentally compose against a
 * different answer.
 *
 * Pure: no store, clock, network or logging. A refusal is data and no partial
 * plan is returned.
 */
import {
  calculateCapacity,
  type CoachingInputs,
  type CoachingPlan,
} from '../utils/coachingEngine';
import type { InjuryKey } from '../data/exerciseTags';
import {
  materialiseAuthoredSessions,
  type MaterialisationFacts,
  type MaterialisedSession,
} from './materialiseAuthoredSessions';
import {
  scheduleToCoachingPlan,
  type ConnectorInput,
} from './scheduleToCoachingPlan';
import {
  resolveConditioningSubstitutionPolicy,
  resolveWeeklyConditioningFeasibility,
  type ConditioningFeasibilityContext,
} from './conditioningFeasibility';
import {
  applyDeloadPolicyToSessionAllocation,
  resolveDoorDeloadPolicy,
  type DeloadWeekPolicy,
} from './deloadWeekRules';
import {
  scheduledDeloadPolicyForWeek,
  type CanonicalWeeklyScheduledDeloadState,
} from './canonicalWeeklyScheduledDeloadState';
import { isDateInReadinessDeloadWindow } from './readinessIllnessLaw';
import { resolveTrainingAgePolicy } from './trainingAgePolicy';
import { isoDateForWeekday } from '../utils/appDate';
import {
  schedulerInputsWithFixtureState,
  type CanonicalWeeklyFixtureState,
} from './canonicalWeeklyFixtureState';
import type { CanonicalWeeklyInjuryState } from './canonicalWeeklyInjuryState';
import {
  coachingInputsWithAvailabilityState,
  schedulerInputsWithAvailabilityState,
  type CanonicalWeeklyAvailabilityState,
  type CanonicalWeeklyCompositionAvailability,
} from './canonicalWeeklyAvailabilityState';
import {
  scheduleRefused,
  scheduleWeek,
  type WeeklySchedule,
  type WeeklyScheduleRefusal,
  type WeeklySchedulerInputs,
} from './weeklyScheduler';
import {
  buildFixtureMinimalReplan,
  type BuildFixtureMinimalReplanInput,
  type FixtureMinimalReplanResult,
} from '../utils/fixtureMinimalReplan';
import { applyGenerationSafetyToSection18Contract } from './section18SafetyPolicy';

type DerivedMaterialisationFacts = Omit<
  MaterialisationFacts,
  'capacity' | 'isBeginner' | 'experienced' | 'injuries'
>;

type DerivedConnectorInput = Omit<
  ConnectorInput,
  | 'schedule'
  | 'materialised'
  | 'coachingInputs'
  | 'capacity'
  | 'capacityFactors'
  | 'v1Input'
  | 'clubNights'
  | 'gameDays'
> & {
  readonly v1Input: Omit<ConnectorInput['v1Input'],
    'capacity' | 'readinessDeloaded' | 'weekModeOverride'
    | 'selectedDayNumbers' | 'teamTrainingDayNumbers' | 'hasGame' | 'gameDay'
    | 'injuryPolicy' | 'appConditioningFeasible'
    | 'attemptedConditioningSubstitutions'>;
};

/**
 * The readiness door's authorised output. Raw severity is deliberately absent:
 * it remains private to the door that maps the athlete's words to these flags.
 */
export interface CanonicalWeeklyReadinessFact {
  readonly kind: 'readiness';
  readonly id: string;
  readonly deloaded: boolean;
  readonly sessionsOptional: boolean;
  readonly windowStartISO?: string;
  readonly windowEndISO?: string;
}

/** Illness door output; the compiler never receives or graduates on severity. */
export interface CanonicalWeeklyIllnessFact {
  readonly kind: 'illness';
  readonly id: string;
  readonly activeFromISO: string;
  readonly deloaded: boolean;
  readonly sessionsOptional: boolean;
}

/** One dose decision per date. Overlapping causes never halve the same row twice. */
export function compileCanonicalWeeklyDosePolicies(input: {
  readonly weekStartISO: string;
  readonly seasonPhase: CoachingInputs['seasonPhase'];
  readonly readiness?: CanonicalWeeklyReadinessFact | null;
  readonly illness?: CanonicalWeeklyIllnessFact | null;
  readonly scheduledDeload?: CanonicalWeeklyScheduledDeloadState | null;
}): {
  readonly dosePolicyByDay: Readonly<Partial<Record<number, DeloadWeekPolicy>>>;
  readonly doseDoor: 'scheduled' | 'readiness' | 'illness' | null;
} {
  const readinessDose = input.readiness?.deloaded
    ? resolveDoorDeloadPolicy({ door: 'readiness', seasonPhase: input.seasonPhase })
    : null;
  const illnessDose = input.illness?.deloaded
    ? resolveDoorDeloadPolicy({ door: 'illness', seasonPhase: input.seasonPhase })
    : null;
  const scheduledPolicy = scheduledDeloadPolicyForWeek(
    input.scheduledDeload,
    input.weekStartISO,
  );
  const dosePolicyByDay: Partial<Record<number, DeloadWeekPolicy>> = {};
  for (let day = 0; day < 7; day += 1) {
    const dateISO = isoDateForWeekday(input.weekStartISO, day);
    const illnessPolicy = illnessDose && input.illness &&
      dateISO >= input.illness.activeFromISO ? illnessDose : null;
    const readinessPolicy = readinessDose &&
      (!input.readiness?.windowStartISO || !input.readiness.windowEndISO ||
        isDateInReadinessDeloadWindow(dateISO, {
          startISO: input.readiness.windowStartISO,
          endISO: input.readiness.windowEndISO,
        })) ? readinessDose : null;
    // More specific live facts outrank the schedule only on their own dates.
    // Outside a readiness/illness window the scheduled week still applies.
    const policy = illnessPolicy ?? readinessPolicy ?? scheduledPolicy;
    if (policy) dosePolicyByDay[day] = policy;
  }
  const appliedDoors = Object.values(dosePolicyByDay).map((policy) => policy.door);
  const doseDoor = (['illness', 'readiness', 'scheduled'] as const)
    .find((door) => appliedDoors.includes(door)) ?? null;
  return { dosePolicyByDay, doseDoor };
}

export interface CanonicalWeeklyCompilerInput {
  /** WRITER: the generation boundary. READER: the weekly scheduler. */
  readonly scheduler: WeeklySchedulerInputs;
  /** WRITER: onboarding/profile translation. READERS: capacity + connector. */
  readonly coaching: CoachingInputs;
  /** Specialist facts only; capacity and training age are derived once here. */
  readonly materialisation: DerivedMaterialisationFacts;
  /** Contract/provenance inputs that are translations, never schedule policy. */
  readonly connector: DerivedConnectorInput;
  /** Typed fact families already migrated into this compiler. */
  readonly readiness?: CanonicalWeeklyReadinessFact | null;
  readonly illness?: CanonicalWeeklyIllnessFact | null;
  readonly scheduledDeload?: CanonicalWeeklyScheduledDeloadState | null;
  readonly fixture?: CanonicalWeeklyFixtureState | null;
  readonly injury?: CanonicalWeeklyInjuryState | null;
  readonly availability?: CanonicalWeeklyAvailabilityState | null;
  /** Optional specialist projection, still executed inside the compiler. */
  readonly conditioningFeasibility?: ConditioningFeasibilityContext;
}

export type CanonicalWeeklyCompilerResult =
  | {
      readonly ok: true;
      readonly schedule: WeeklySchedule;
      readonly materialised: readonly MaterialisedSession[];
      readonly plan: CoachingPlan;
      /** Compiler-authored instruction; materialisers consume without re-deciding. */
      readonly dosePolicyByDay: Readonly<Partial<Record<number, DeloadWeekPolicy>>>;
      /** The accepted fact door, carried so metadata never re-infers it. */
      readonly doseDoor: 'scheduled' | 'readiness' | 'illness' | null;
      /** Compiler-authored semantic keys consumed by exercise selection. */
      readonly activeInjuryKeys: readonly InjuryKey[];
      /** Compiler-authored kit projection consumed by row composition. */
      readonly compositionAvailability: CanonicalWeeklyCompositionAvailability | null;
    }
  | {
      readonly ok: false;
      readonly refusal: WeeklyScheduleRefusal;
    };

export function compileCanonicalWeek(
  input: CanonicalWeeklyCompilerInput,
): CanonicalWeeklyCompilerResult {
  const fixtureScheduler = schedulerInputsWithFixtureState(input.scheduler, input.fixture);
  const availabilityScheduler = schedulerInputsWithAvailabilityState(
    fixtureScheduler,
    input.availability,
  );
  const gameDays = availabilityScheduler.gameDays ??
    (availabilityScheduler.gameDay === null ? [] : [availabilityScheduler.gameDay]);
  const scheduler = {
    ...availabilityScheduler,
    gameDays,
    gameDay: gameDays[0] ?? null,
  };
  const schedule = scheduleWeek({
    ...scheduler,
    offLegAvailableDays: input.availability
      ? Object.entries(input.availability.equipmentByDayOfWeek).filter(([, equipment]) =>
        equipment.conditioningModalities.some(mode => mode !== 'treadmill')).map(([day]) => Number(day))
      : scheduler.offLegAvailableDays,
    appSprintPermitted: input.injury?.blocksAppSprint !== true,
    sprintExposure: input.coaching.sprintExposure,
    appRunningPermitted: input.injury?.lowerBodyRestricted !== true,
    readiness: {
      ...input.scheduler.readiness,
      lowReadiness: input.readiness?.deloaded === true,
    },
  });
  if (scheduleRefused(schedule)) return { ok: false, refusal: schedule };

  const coaching = coachingInputsWithAvailabilityState(input.coaching, scheduler);
  const { level: capacity, factors: capacityFactors } = calculateCapacity(coaching);
  const agePolicy = resolveTrainingAgePolicy(coaching.experienceLevel);
  const materialisedBase = materialiseAuthoredSessions({
    schedule,
    facts: {
      ...input.materialisation,
      capacity,
      isBeginner: agePolicy.level === 'new',
      experienced: agePolicy.level !== 'new',
      injuries: [...(input.injury?.powerInjuries ?? [])],
    },
    gameDay: scheduler.gameDay,
    gameDays: scheduler.gameDays,
  });
  const materialised = materialisedBase.map((session): MaterialisedSession => {
    const readinessOptional = input.readiness?.sessionsOptional === true &&
      (!input.readiness.windowStartISO || !input.readiness.windowEndISO ||
        isDateInReadinessDeloadWindow(session.dateISO, {
          startISO: input.readiness.windowStartISO,
          endISO: input.readiness.windowEndISO,
        }));
    const illnessOptional = input.illness?.sessionsOptional === true &&
      session.dateISO >= input.illness.activeFromISO;
    return readinessOptional || illnessOptional
      ? { ...session, optional: true }
      : session;
  });
  const conditioningPolicy = input.availability
    ? resolveConditioningSubstitutionPolicy({
        phase: coaching.seasonPhase,
        equipment: input.availability.reachableEquipmentAcrossWeek,
        injury: input.injury ?? undefined,
        readinessDeloaded:
          input.readiness?.deloaded === true || input.illness?.deloaded === true,
      })
    : null;

  const connected = scheduleToCoachingPlan({
    ...input.connector,
    clubNights: scheduler.clubNights,
    gameDays: [...scheduler.gameDays],
    v1Input: {
      ...input.connector.v1Input,
      selectedDayNumbers: [...scheduler.gymAccessDays],
      teamTrainingDayNumbers: [...scheduler.clubNights],
      hasGame: scheduler.gameDays.length > 0,
      gameDay: scheduler.gameDays[0] ?? null,
      capacity,
      readinessDeloaded:
        input.readiness?.deloaded === true || input.illness?.deloaded === true,
      weekModeOverride:
        input.readiness?.sessionsOptional === true || input.illness?.sessionsOptional === true
          ? 'optional_week'
          : undefined,
      injuryPolicy: input.injury ?? undefined,
      appConditioningFeasible: conditioningPolicy?.appConditioningFeasible ?? undefined,
      attemptedConditioningSubstitutions:
        conditioningPolicy?.consideredSubstitutions ?? [],
    },
    schedule,
    materialised,
    coachingInputs: coaching,
    capacity,
    capacityFactors,
  });
  const injuryResolvedPlan = input.injury && connected.weeklyExposureContractV2
    ? {
        ...connected,
        weeklyExposureContractV2: applyGenerationSafetyToSection18Contract({
          contract: connected.weeklyExposureContractV2,
          injuryPolicy: input.injury,
        }),
      }
    : connected;
  const { dosePolicyByDay, doseDoor } = compileCanonicalWeeklyDosePolicies({
    weekStartISO: scheduler.weekStartISO,
    seasonPhase: coaching.seasonPhase,
    readiness: input.readiness,
    illness: input.illness,
    scheduledDeload: input.scheduledDeload,
  });
  const doseResolvedPlan = doseDoor
    ? {
        ...injuryResolvedPlan,
        weeklyPlan: injuryResolvedPlan.weeklyPlan.map((entry) =>
          applyDeloadPolicyToSessionAllocation(
            entry,
            entry.dayOfWeek
              ? dosePolicyByDay[
                  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                    .indexOf(entry.dayOfWeek)
                ] ?? null
              : null,
          )),
      }
    : injuryResolvedPlan;
  const plan = input.conditioningFeasibility
    ? {
        ...doseResolvedPlan,
        weeklyPlan: resolveWeeklyConditioningFeasibility(
          doseResolvedPlan.weeklyPlan,
          {
            ...input.conditioningFeasibility,
            injury: input.injury ?? undefined,
            readinessDeloaded:
              input.readiness?.deloaded === true || input.illness?.deloaded === true,
            ...(input.availability
              ? { equipmentByDayOfWeek: input.availability.equipmentByDayOfWeek }
              : {}),
          },
        ),
      }
    : doseResolvedPlan;

  return {
    ok: true,
    schedule,
    materialised,
    plan,
    dosePolicyByDay,
    doseDoor,
    activeInjuryKeys: input.injury?.activeInjuryKeys ?? [],
    compositionAvailability: input.availability?.composition ?? null,
  };
}

/**
 * Final-workout fixture specialist, owned by the same compiler boundary.
 * The specialist may preserve accepted athlete decisions and enumerate legal
 * candidates; no transaction or read surface may invoke it independently.
 */
export function compileCanonicalFixtureMutationWeek(
  input: BuildFixtureMinimalReplanInput,
): FixtureMinimalReplanResult {
  return buildFixtureMinimalReplan(input);
}
