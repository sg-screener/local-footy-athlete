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
import { resolveTrainingAgePolicy } from './trainingAgePolicy';
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
  readonly v1Input: Omit<ConnectorInput['v1Input'], 'capacity'>;
};

export interface CanonicalWeeklyCompilerInput {
  /** WRITER: the generation boundary. READER: the weekly scheduler. */
  readonly scheduler: WeeklySchedulerInputs;
  /** WRITER: onboarding/profile translation. READERS: capacity + connector. */
  readonly coaching: CoachingInputs;
  /** Specialist facts only; capacity and training age are derived once here. */
  readonly materialisation: DerivedMaterialisationFacts;
  /** Contract/provenance inputs that are translations, never schedule policy. */
  readonly connector: DerivedConnectorInput;
  /** Optional specialist projection, still executed inside the compiler. */
  readonly conditioningFeasibility?: ConditioningFeasibilityContext;
}

export type CanonicalWeeklyCompilerResult =
  | {
      readonly ok: true;
      readonly schedule: WeeklySchedule;
      readonly materialised: readonly MaterialisedSession[];
      readonly plan: CoachingPlan;
    }
  | {
      readonly ok: false;
      readonly refusal: WeeklyScheduleRefusal;
    };

export function compileCanonicalWeek(
  input: CanonicalWeeklyCompilerInput,
): CanonicalWeeklyCompilerResult {
  const schedule = scheduleWeek(input.scheduler);
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
    v1Input: { ...input.connector.v1Input, capacity },
    schedule,
    materialised,
    coachingInputs: input.coaching,
    capacity,
    capacityFactors,
  });
  const plan = input.conditioningFeasibility
    ? {
        ...connected,
        weeklyPlan: resolveWeeklyConditioningFeasibility(
          connected.weeklyPlan,
          input.conditioningFeasibility,
        ),
      }
    : connected;

  return {
    ok: true,
    schedule,
    materialised,
    plan,
  };
}
