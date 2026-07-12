import type {
  OnboardingData,
  Workout,
  WorkoutExercise,
} from '../../../types/domain';
import type { SessionAllocation } from '../../../utils/coachingEngine';
import { attachRecoveryAddonsToWeek } from '../../../utils/recoveryAddonBuilder';
import { finaliseWorkoutAfterMutation } from '../../../utils/workoutCanonicalisation';
import {
  buildSingleWorkoutFixtureTrace,
  buildStrengthScenarioTrace,
  type StrengthTraceBuildOptions,
} from './buildStrengthTrace';
import type {
  ComponentGoldenScenario,
  ComponentScenarioTrace,
  StrengthGoldenScenario,
} from '../types';

const SOURCE_SCENARIO_ID = 'is-healthy-5d-tt2-game-sat' as const;
const NOW = '2026-03-23T00:00:00.000Z';

function sourceScenario(scenario: ComponentGoldenScenario): StrengthGoldenScenario {
  return {
    id: SOURCE_SCENARIO_ID,
    description: scenario.description,
    referenceDate: scenario.referenceDate,
    timezone: scenario.timezone,
    profile: scenario.profile,
    ruleIds: ['ALL-STR-BLOCK-01'],
  };
}

function productionOptions(scenario: ComponentGoldenScenario): StrengthTraceBuildOptions {
  return {
    transformGeneratedWeek: ({ workouts, profile, state }) => {
      let next = workouts;
      if (scenario.sourceKind === 'deterministic_with_recovery_addons') {
        next = attachRecoveryAddonsToWeek({
          workouts: next,
          profile,
          weekKind: state.weekKind,
        });
      }
      if (scenario.scalarMutation) {
        const targetDay = scenario.target.day;
        next = next.map((workout) => {
          const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][workout.dayOfWeek];
          if (day !== targetDay) return workout;
          return {
            ...workout,
            workoutType: scenario.scalarMutation!.workoutType as Workout['workoutType'],
            name: scenario.scalarMutation!.workoutName,
            description: scenario.scalarMutation!.subtitle,
          };
        });
      }
      return next;
    },
  };
}

function fixtureRow(workoutId: string, index: number, name: string): WorkoutExercise {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `${workoutId}:row:${index}`,
    workoutId,
    exerciseId: `${slug}:${index}`,
    exerciseOrder: index,
    prescribedSets: 3,
    prescribedRepsMin: 10,
    prescribedRepsMax: 15,
    restSeconds: 60,
    exercise: {
      id: `${slug}:${index}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Accessory',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: NOW,
      updatedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildAccessoryFixtureTrace(scenario: ComponentGoldenScenario): ComponentScenarioTrace {
  const workoutId = 'bible:accessory-gunshow-only:w1:wednesday';
  const planEntryId = 'fixture:w1:wednesday:accessory';
  const raw: Workout = {
    id: workoutId,
    microcycleId: 'bible:accessory-gunshow-only:w1',
    dayOfWeek: 3,
    name: 'Gunshow',
    description: 'Optional arms, shoulder health and trunk support.',
    durationMinutes: 35,
    intensity: 'Light',
    workoutType: 'Strength',
    sessionTier: 'optional',
    planEntryId,
    exercises: [
      fixtureRow(workoutId, 0, 'Bicep Curls'),
      fixtureRow(workoutId, 1, 'Tricep Pushdowns'),
      fixtureRow(workoutId, 2, 'Face Pulls'),
      fixtureRow(workoutId, 3, 'Pallof Press'),
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
  const workout = finaliseWorkoutAfterMutation(raw, {
    phase: 'In-season',
    planIntentValid: true,
  }).workout;
  const allocation: SessionAllocation = {
    tier: 'optional',
    focus: 'Gunshow / accessory / trunk support — no main-pattern credit',
    dayOfWeek: 'Wednesday',
    isHardExposure: false,
    planEntryId,
  };
  return buildSingleWorkoutFixtureTrace({ scenario, allocation, workout });
}

export function buildComponentScenarioTrace(
  scenario: ComponentGoldenScenario,
): ComponentScenarioTrace {
  if (scenario.timezone !== 'Australia/Melbourne' || scenario.referenceDate !== '2026-03-23') {
    throw new Error(`${scenario.id} must use the fixed Slice 2 date and timezone`);
  }
  if (scenario.sourceKind === 'direct_accessory_fixture') {
    return buildAccessoryFixtureTrace(scenario);
  }
  const observed = buildStrengthScenarioTrace(sourceScenario(scenario), productionOptions(scenario));
  return {
    scenario,
    sessions: observed.sessions,
    runtimeMs: observed.runtimeMs,
  };
}

export function componentScenarioProfile(
  scenario: ComponentGoldenScenario,
): OnboardingData {
  return scenario.profile as OnboardingData;
}
