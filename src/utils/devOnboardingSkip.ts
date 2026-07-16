import type { OnboardingData, TrainingProgram } from '../types/domain';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';

/** The development skip is the same named seed used by Maestro. */
export const DEV_TEST_ONBOARDING_DATA: OnboardingData = DEV_E2E_STANDARD_PROFILE;

export function isDevOnboardingSkipEnabled(
  isDev: boolean =
    typeof __DEV__ !== 'undefined'
      ? __DEV__
      : process.env.NODE_ENV !== 'production',
): boolean {
  return isDev;
}

/**
 * Compatibility-shaped arguments remain so existing dev callers compile, but
 * generation/store injection is intentionally no longer an alternate entry
 * architecture. Every press delegates to the allowlisted local seed and can
 * never call the network-backed onboarding generator.
 */
export async function runDevOnboardingSkip(_args: {
  onboardingData?: OnboardingData;
  generateProgram?: (data: OnboardingData) => Promise<TrainingProgram>;
  profileStore?: unknown;
  programStore?: unknown;
  calendarStore?: unknown;
} = {}): Promise<{
  program: TrainingProgram;
  onboardingData: OnboardingData;
  usedFallback: false;
}> {
  if (!isDevOnboardingSkipEnabled()) {
    throw new Error('Development onboarding skip is unavailable outside dev builds.');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createDefaultDevE2ESeedCoordinator } = require('../dev/e2e/defaultDevE2ESeedCoordinator');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useProgramStore } = require('../store/programStore');
  const coordinator = createDefaultDevE2ESeedCoordinator(true);
  const installed = await coordinator.reset('standard-in-season-week');
  const program = useProgramStore.getState().currentProgram;
  if (!installed || !program) {
    throw new Error('The standard development E2E seed did not install a program.');
  }
  return {
    program,
    onboardingData: DEV_TEST_ONBOARDING_DATA,
    usedFallback: false,
  };
}
