import { useProfileStore } from '../store/profileStore';

/**
 * All onboarding screen names in order (excluding Welcome and Complete).
 * Conditional screens are included with their condition.
 */
type ScreenEntry = {
  name: string;
  condition?: 'in-season-only' | 'pre-or-in-season' | 'not-beginner';
};

const ONBOARDING_SCREENS: ScreenEntry[] = [
  { name: 'Name' },
  { name: 'BodyMeasurements' },
  { name: 'Position' },
  { name: 'Motivation' },
  { name: 'SeasonPhase' },
  { name: 'GameDay', condition: 'in-season-only' },
  { name: 'TeamTrainingDays', condition: 'pre-or-in-season' },
  // TeamTrainingDuration screen captures BOTH duration + intensity now.
  // The separate TeamTrainingIntensity screen still exists in the nav
  // map (legacy deep links) but is no longer linked in the linear flow.
  { name: 'TeamTrainingDuration', condition: 'pre-or-in-season' },
  { name: 'TrainingCommitment' },
  { name: 'PreferredTrainingDays' },
  { name: 'GymExperience' },
  { name: 'SquatStrength', condition: 'not-beginner' },
  { name: 'BenchStrength', condition: 'not-beginner' },
  { name: 'ConditioningLevel' },
  { name: 'SprintExposure' },
  { name: 'RecentTrainingLoad' },
  { name: 'Injuries' },
  { name: 'Review' },
];

export function useOnboardingProgress(screenName: string) {
  const seasonPhase = useProfileStore((s) => s.onboardingData.seasonPhase);
  const experienceLevel = useProfileStore((s) => s.onboardingData.experienceLevel);

  const isScreenVisible = (entry: ScreenEntry): boolean => {
    if (!entry.condition) return true;

    switch (entry.condition) {
      case 'in-season-only':
        return seasonPhase === 'In-season';
      case 'pre-or-in-season':
        return seasonPhase === 'Pre-season' || seasonPhase === 'In-season';
      case 'not-beginner':
        return experienceLevel !== 'Complete beginner';
      default:
        return true;
    }
  };

  // Build the visible screens list based on current onboarding data
  const visibleScreens = ONBOARDING_SCREENS.filter(isScreenVisible);
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
