import { useProfileStore } from '../store/profileStore';
import { visibleOnboardingSteps } from '../utils/onboardingSteps';

/**
 * Progress display, derived from the shared onboarding step registry.
 *
 * This hook used to keep its own copy of the flow (`ONBOARDING_SCREENS`), which
 * could disagree with the navigator and with the generator's required fields.
 * `onboardingSteps.ts` is now the single declaration; this is a projection of it.
 */
export function useOnboardingProgress(screenName: string) {
  const onboardingData = useProfileStore((s) => s.onboardingData);

  const visibleScreens = visibleOnboardingSteps(onboardingData);
  const totalSteps = visibleScreens.length;
  const currentIndex = visibleScreens.findIndex((s) => s.name === screenName);
  const currentStep = currentIndex + 1; // 1-based

  return {
    currentStep,
    totalSteps,
    progressPercent: totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0,
    /** @deprecated OnboardingLayout no longer displays step labels */
    label: `Step ${currentStep} of ${totalSteps}`,
  };
}
