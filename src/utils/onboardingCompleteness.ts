import type { OnboardingData } from '../types/domain';
import {
  answerableOnboardingSteps,
  type OnboardingStep,
  type OnboardingStepName,
} from './onboardingSteps';

/**
 * The onboarding refusal owner.
 *
 * Review and generation used to accept whatever was in the store and paper
 * over the gaps — `seasonPhase ?? 'Pre-season'` produced a pre-season program
 * for an in-season athlete, and the profile fell back to "Athlete"
 * (docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §2). A default that
 * looks like an answer is worse than no answer: the athlete cannot tell it is
 * wrong.
 *
 * Both doors now ask this owner first. If an answer is missing they refuse and
 * send the athlete back to the step that owns it, naming what is missing.
 */

export interface OnboardingCompleteness {
  readonly complete: boolean;
  readonly missingSteps: readonly OnboardingStep[];
  readonly firstIncompleteStep: OnboardingStepName | null;
}

export function assessOnboardingCompleteness(
  data: OnboardingData,
): OnboardingCompleteness {
  const missingSteps = answerableOnboardingSteps(data)
    .filter((step) => !step.satisfied(data));
  return {
    complete: missingSteps.length === 0,
    missingSteps,
    firstIncompleteStep: missingSteps[0]?.name ?? null,
  };
}

/**
 * Athlete-facing refusal copy. Names the missing answers in plain language —
 * never a field name, never a code.
 */
export function onboardingIncompleteMessage(
  assessment: OnboardingCompleteness,
): string {
  if (assessment.complete) return '';
  const labels = assessment.missingSteps.map((step) => step.answerLabel);
  const listed = labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `I still need ${listed} before I can build your program.`;
}
