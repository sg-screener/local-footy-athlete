import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { OnboardingStackParamList } from '../types/navigation';
import { useProfileStore } from '../store/profileStore';
import { resolveOnboardingResumeStep } from '../utils/onboardingSteps';

// Import all onboarding screens
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { NameScreen } from '../screens/onboarding/NameScreen';
import { PositionScreen } from '../screens/onboarding/PositionScreen';
import { MotivationScreen } from '../screens/onboarding/MotivationScreen';
import { BodyMeasurementsScreen } from '../screens/onboarding/BodyMeasurementsScreen';
import { SeasonPhaseScreen } from '../screens/onboarding/SeasonPhaseScreen';
import { GameDayScreen } from '../screens/onboarding/GameDayScreen';
import { TeamTrainingDaysScreen } from '../screens/onboarding/TeamTrainingDaysScreen';
import { TeamTrainingDurationScreen } from '../screens/onboarding/TeamTrainingDurationScreen';
import { TeamTrainingIntensityScreen } from '../screens/onboarding/TeamTrainingIntensityScreen';
import { TrainingCommitmentScreen } from '../screens/onboarding/TrainingCommitmentScreen';
import { PreferredTrainingDaysScreen } from '../screens/onboarding/PreferredTrainingDaysScreen';
import { GymExperienceScreen } from '../screens/onboarding/GymExperienceScreen';
import { SquatStrengthScreen } from '../screens/onboarding/SquatStrengthScreen';
import { BenchStrengthScreen } from '../screens/onboarding/BenchStrengthScreen';
import { TwoKmTimeTrialScreen } from '../screens/onboarding/TwoKmTimeTrialScreen';
import { ConditioningLevelScreen } from '../screens/onboarding/ConditioningLevelScreen';
import { SprintExposureScreen } from '../screens/onboarding/SprintExposureScreen';
import { RecentTrainingLoadScreen } from '../screens/onboarding/RecentTrainingLoadScreen';
import { InjuriesScreen } from '../screens/onboarding/InjuriesScreen';
import { EquipmentScreen } from '../screens/onboarding/EquipmentScreen';
import { ReviewScreen } from '../screens/onboarding/ReviewScreen';
import { CompleteScreen } from '../screens/onboarding/CompleteScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Interrupted-onboarding recovery.
 *
 * Onboarding always restarted at Welcome, so an athlete whose first process was
 * killed mid-flow re-entered at step 1 and any step they did not revisit kept
 * its default straight through to Review
 * (docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §4). With answers now
 * durably committed per step, a relaunch can resume where the athlete stopped.
 *
 * The entry point is resolved once, from hydrated state, when the navigator
 * mounts — RootNavigator does not mount this until the hydration gate reports
 * ready, so the profile read here is the persisted one.
 */
export default function OnboardingNavigator() {
  const onboardingData = useProfileStore.getState().onboardingData;
  const resumeStep = resolveOnboardingResumeStep(onboardingData);
  // A profile with nothing answered is a genuine first run: show Welcome.
  const initialRouteName: keyof OnboardingStackParamList =
    resumeStep === 'Name' && !onboardingData.firstName ? 'Welcome' : resumeStep;

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.surface.primary,
        },
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen name="Name" component={NameScreen} />
      <Stack.Screen name="BodyMeasurements" component={BodyMeasurementsScreen} />
      <Stack.Screen name="Position" component={PositionScreen} />
      <Stack.Screen name="Motivation" component={MotivationScreen} />
      <Stack.Screen name="SeasonPhase" component={SeasonPhaseScreen} />
      <Stack.Screen name="GameDay" component={GameDayScreen} />
      <Stack.Screen name="TeamTrainingDays" component={TeamTrainingDaysScreen} />
      <Stack.Screen name="TeamTrainingDuration" component={TeamTrainingDurationScreen} />
      <Stack.Screen name="TeamTrainingIntensity" component={TeamTrainingIntensityScreen} />
      <Stack.Screen name="TrainingCommitment" component={TrainingCommitmentScreen} />
      <Stack.Screen name="PreferredTrainingDays" component={PreferredTrainingDaysScreen} />
      <Stack.Screen name="Equipment" component={EquipmentScreen} />
      <Stack.Screen name="GymExperience" component={GymExperienceScreen} />
      <Stack.Screen name="SquatStrength" component={SquatStrengthScreen} />
      <Stack.Screen name="BenchStrength" component={BenchStrengthScreen} />
      <Stack.Screen name="TwoKmTimeTrial" component={TwoKmTimeTrialScreen} />
      <Stack.Screen name="ConditioningLevel" component={ConditioningLevelScreen} />
      <Stack.Screen name="SprintExposure" component={SprintExposureScreen} />
      <Stack.Screen name="RecentTrainingLoad" component={RecentTrainingLoadScreen} />
      <Stack.Screen name="Injuries" component={InjuriesScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Complete" component={CompleteScreen} />
    </Stack.Navigator>
  );
}
