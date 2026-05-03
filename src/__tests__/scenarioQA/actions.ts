/**
 * Action runner — walks a scenario step-by-step, applying each Action to
 * the profile via the SHARED mutation utilities (src/utils/profileMutations).
 * After each step we re-run the engine and capture the plan.
 *
 * This deliberately uses the same `applyGameDayChange` / `applyPhaseShift`
 * helpers that HomeScreen.tsx wires into its handlers — so the harness
 * exercises the exact overlay logic that ships in the app. If the app
 * grows a new mutation handler, add it here AND in the helpers, never
 * just one.
 */

import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
} from '../../utils/coachingEngine';
import {
  applyGameDayChange,
  applyPhaseShift,
} from '../../utils/profileMutations';
import type { Action, Scenario, ScenarioResult, StepResult } from './types';
import { describeAction } from './types';

export function runScenario(
  scenario: Scenario,
  invariants: NonNullable<Scenario['invariants']>,
): ScenarioResult {
  let currentProfile = { ...scenario.profile };
  const steps: StepResult[] = [];

  for (const action of scenario.actions) {
    currentProfile = applyAction(currentProfile, action);
    const inputs = onboardingToCoachingInputs(currentProfile);
    const plan = buildCoachingPlan(inputs);

    const invariantResults = invariants
      .map((inv) => inv({ profile: currentProfile, inputs, plan }))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const passed = invariantResults.every((r) => r.passed);

    steps.push({
      action,
      profile: currentProfile,
      plan,
      invariants: invariantResults,
      passed,
    });
  }

  return {
    scenario,
    steps,
    passed: steps.every((s) => s.passed),
  };
}

function applyAction(
  profile: typeof import('../../types/domain').OnboardingData extends never
    ? never
    : Parameters<typeof applyGameDayChange>[0],
  action: Action,
) {
  switch (action.type) {
    case 'onboard':
      // No mutation — caller's `scenario.profile` is taken as-is.
      return profile;

    case 'phaseShift':
      return applyPhaseShift(profile, {
        targetPhase: action.targetPhase,
        preferredTrainingDays: action.preferredTrainingDays,
        teamTrainingDays: action.teamTrainingDays,
        gameDay: action.gameDay,
      });

    case 'addGame':
      return applyGameDayChange(profile, action.day);

    case 'moveGame':
      return applyGameDayChange(profile, action.day);

    case 'removeGame':
      return applyGameDayChange(profile, null);

    default: {
      // Exhaustiveness guard — TS will error if a new Action variant
      // is added without a case here.
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Build a human-readable action path for the report.
 *   "onboard → shift→In-season (game Saturday) → removeGame"
 */
export function describeActionPath(actions: Action[]): string {
  return actions.map(describeAction).join(' → ');
}
