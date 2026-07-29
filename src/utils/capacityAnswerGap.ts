import type { OnboardingData } from '../types/domain';
import { canScoreCapacity } from '../data/capacityRubric';
import {
  ONBOARDING_STEPS,
  resolveOnboardingResumeStep,
  type OnboardingStepName,
} from './onboardingSteps';

/**
 * The one owner of "this athlete's capacity cannot be scored — what do we tell
 * them, and where do we send them?".
 *
 * Sam's ruling (2026-07-30). The rubric's refusal is right and stays; what was
 * wrong was WHERE it landed. `useSchedule` called the throwing accessor from a
 * hook body, so an unscoreable profile crashed the app during render on launch
 * — no disclosure, no repair, nothing the athlete could act on.
 *
 * This is the season-phase skew pattern applied to the same class of problem:
 * stored state that is already wrong, disclosed honestly, with one action that
 * fixes it. Nothing is guessed on the athlete's behalf and nothing is
 * overwritten to make the error go away.
 *
 * WHY THE REPAIR IS THE ONBOARDING RESUME. `OnboardingNavigator` already opens
 * at `resolveOnboardingResumeStep`, which is the first step whose own
 * `satisfied` predicate is false — so an athlete missing exactly one capacity
 * answer is asked exactly that question and continues from there. No second
 * route, no new screen, and no separate idea of "which question is missing"
 * that could drift from the step registry. The gap and the navigator read the
 * SAME owner, which `capacityRenderSafetyTests` pins in both directions.
 *
 * Nothing is lost by routing there: generation refuses for an unscoreable
 * profile, so an athlete in this state has no program the resume could discard.
 */
export interface CapacityAnswerGap {
  /** Athlete-facing labels of the missing answers, from the step registry. */
  readonly missingAnswers: readonly string[];
  /** Where the athlete is sent to answer — the onboarding resume owner's word. */
  readonly resumeStep: OnboardingStepName;
}

/** The two steps whose answers the capacity rubric reads. */
const CAPACITY_STEPS: readonly OnboardingStepName[] = ['ConditioningLevel', 'RecentTrainingLoad'];

/**
 * `null` when capacity scores. Otherwise the gap, named in the athlete's words.
 *
 * Asks `canScoreCapacity` rather than re-deriving "is this answer present":
 * a second presence check here could accept a value the rubric refuses, and the
 * athlete would be told everything was fine while generation kept refusing.
 */
export function capacityAnswerGap(
  data: OnboardingData | null | undefined,
): CapacityAnswerGap | null {
  if (canScoreCapacity(data)) return null;
  const profile = (data ?? {}) as OnboardingData;
  const missingAnswers = ONBOARDING_STEPS
    .filter((step) => CAPACITY_STEPS.includes(step.name) && !step.satisfied(profile))
    .map((step) => step.answerLabel);
  return {
    // An answer the rubric cannot read is still an unanswered question as far as
    // the athlete is concerned, so a profile that fails scoring with both fields
    // "filled" is described by both labels rather than by nothing at all.
    missingAnswers: missingAnswers.length > 0
      ? missingAnswers
      : ONBOARDING_STEPS
          .filter((step) => CAPACITY_STEPS.includes(step.name))
          .map((step) => step.answerLabel),
    resumeStep: resolveOnboardingResumeStep(profile),
  };
}

/**
 * The disclosure sentence. Plain language, never a field name or a code —
 * same contract as `onboardingIncompleteMessage`, whose voice this matches so
 * the athlete meets one way of being told an answer is missing.
 */
export function capacityAnswerGapMessage(gap: CapacityAnswerGap): string {
  const labels = gap.missingAnswers;
  const listed = labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `We're missing ${listed}. Your plan is still here — we just can't set your training load until you answer.`;
}
