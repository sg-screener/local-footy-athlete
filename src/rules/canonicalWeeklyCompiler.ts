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
  resolveWeeklyConditioningFeasibility,
  type ConditioningFeasibilityContext,
} from './conditioningFeasibility';
import {
  applyDeloadPolicyToSessionAllocation,
  resolveDeloadWeekPolicy,
  resolveDoorDeloadPolicy,
  type DeloadWeekPolicy,
} from './deloadWeekRules';
import { isDateInReadinessDeloadWindow } from './readinessIllnessLaw';
import { resolveTrainingAgePolicy } from './trainingAgePolicy';
import { isoDateForWeekday } from '../utils/appDate';
import {
  scheduleRefused,
  scheduleWeek,
  type WeeklySchedule,
  type WeeklyScheduleRefusal,
  type WeeklySchedulerInputs,
} from './weeklyScheduler';

type DerivedMaterialisationFacts = Omit<
  MaterialisationFacts,
  'capacity' | 'isBeginner' | 'experienced'
>;

type DerivedConnectorInput = Omit<
  ConnectorInput,
  | 'schedule'
  | 'materialised'
  | 'coachingInputs'
  | 'capacity'
  | 'capacityFactors'
  | 'v1Input'
> & {
  readonly v1Input: Omit<ConnectorInput['v1Input'],
    'capacity' | 'readinessDeloaded' | 'weekModeOverride'>;
  /** Other fact families stay explicit until their own compiler slice lands. */
  readonly nonReadinessDeloaded?: boolean;
  readonly nonReadinessWeekModeOverride?: ConnectorInput['v1Input']['weekModeOverride'];
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

export interface CanonicalWeeklyCompilerInput {
  /** WRITER: the generation boundary. READER: the weekly scheduler. */
  readonly scheduler: WeeklySchedulerInputs;
  /** WRITER: onboarding/profile translation. READERS: capacity + connector. */
  readonly coaching: CoachingInputs;
  /** Specialist facts only; capacity and training age are derived once here. */
  readonly materialisation: DerivedMaterialisationFacts;
  /** Contract/provenance inputs that are translations, never schedule policy. */
  readonly connector: DerivedConnectorInput;
  /** One typed fact family; illness/injury/fixture inputs move in later slices. */
  readonly readiness?: CanonicalWeeklyReadinessFact | null;
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
      /** False only while another deload door still belongs to a later slice. */
      readonly planDoseResolved: boolean;
    }
  | {
      readonly ok: false;
      readonly refusal: WeeklyScheduleRefusal;
    };

export function compileCanonicalWeek(
  input: CanonicalWeeklyCompilerInput,
): CanonicalWeeklyCompilerResult {
  const schedule = scheduleWeek({
    ...input.scheduler,
    readiness: {
      ...input.scheduler.readiness,
      lowReadiness: input.readiness?.deloaded === true,
    },
  });
  if (scheduleRefused(schedule)) return { ok: false, refusal: schedule };

  const { level: capacity, factors: capacityFactors } =
    calculateCapacity(input.coaching);
  const agePolicy = resolveTrainingAgePolicy(input.coaching.experienceLevel);
  const materialised = materialiseAuthoredSessions({
    schedule,
    facts: {
      ...input.materialisation,
      capacity,
      isBeginner: agePolicy.level === 'new',
      experienced: agePolicy.level !== 'new',
    },
    gameDay: input.scheduler.gameDay,
    gameDays: input.scheduler.gameDays,
  });

  const connected = scheduleToCoachingPlan({
    ...input.connector,
    v1Input: {
      ...input.connector.v1Input,
      capacity,
      readinessDeloaded:
        input.readiness?.deloaded === true || input.connector.nonReadinessDeloaded === true,
      weekModeOverride: input.readiness?.sessionsOptional === true
        ? 'optional_week'
        : input.connector.nonReadinessWeekModeOverride,
    },
    schedule,
    materialised,
    coachingInputs: input.coaching,
    capacity,
    capacityFactors,
  });
  const anotherDeloadFamilyIsActive = input.connector.nonReadinessDeloaded === true;
  const readinessPolicy = input.readiness?.deloaded
    ? resolveDoorDeloadPolicy({
        door: 'readiness',
        seasonPhase: input.coaching.seasonPhase,
      })
    : null;
  // Scheduled deloads are not silently absorbed by this readiness slice. They
  // remain with the retained adapter until that family moves with its own
  // acceptance witness. We resolve only enough to make the handover honest.
  const legacyScheduledPolicy = !anotherDeloadFamilyIsActive && !readinessPolicy
    ? resolveDeloadWeekPolicy(input.coaching.seasonPhase, input.scheduler.weekKind)
    : null;
  const dosePolicyByDay: Partial<Record<number, DeloadWeekPolicy>> = {};
  if (readinessPolicy) {
    for (let day = 0; day < 7; day += 1) {
      if (input.readiness?.windowStartISO && input.readiness.windowEndISO &&
        !isDateInReadinessDeloadWindow(
          isoDateForWeekday(input.scheduler.weekStartISO, day),
          { startISO: input.readiness.windowStartISO, endISO: input.readiness.windowEndISO },
        )) continue;
      dosePolicyByDay[day] = readinessPolicy;
    }
  }
  const planDoseResolved = !anotherDeloadFamilyIsActive && !legacyScheduledPolicy;
  const doseResolvedPlan = readinessPolicy
    ? {
        ...connected,
        weeklyPlan: connected.weeklyPlan.map((entry) =>
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
    : connected;
  const plan = input.conditioningFeasibility
    ? {
        ...doseResolvedPlan,
        weeklyPlan: resolveWeeklyConditioningFeasibility(
          doseResolvedPlan.weeklyPlan,
          input.conditioningFeasibility,
        ),
      }
    : doseResolvedPlan;

  return {
    ok: true,
    schedule,
    materialised,
    plan,
    dosePolicyByDay,
    planDoseResolved,
  };
}
