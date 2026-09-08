import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { DayOfWeek } from '../../types/domain';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { DayGrid } from '../../components/onboarding/DayGrid';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type PreferredTrainingDaysScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'PreferredTrainingDays'
>;

export const PreferredTrainingDaysScreen: React.FC<
  PreferredTrainingDaysScreenProps
> = ({ navigation }) => {
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('PreferredTrainingDays');
  const trainingDaysPerWeek = useProfileStore(
    (state) => state.onboardingData.trainingDaysPerWeek
  );
  const trainingDaysUnsure = useProfileStore(
    (state) => state.onboardingData.trainingDaysUnsure === true
  );
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const isValid = selectedDays.length >= 1;
  const toggleDay = (day: DayOfWeek) => setSelectedDays(prev =>
    prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const subtitle = 'Choose every day you can access your strength equipment. We will fit your requested sessions into these days. Running can use other available days.';

  const handleContinue = () => {
    if (isValid) {
      void commitAndAdvance({
        preferredTrainingDays: selectedDays,
        trainingDaysPerWeek: trainingDaysUnsure ? 3 : trainingDaysPerWeek || 3,
      }, () => navigation.navigate('Equipment'));
    }
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          Which days can you access your strength equipment?
        </Text>
        {subtitle ? (
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.subtitle}
          >
            {subtitle}
          </Text>
        ) : null}

        {/* Equipment access is independent of the requested session count. */}
        <DayGrid
          selectedDays={selectedDays}
          onToggleDay={toggleDay}
        />
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  title: {
    ...headingXL,
    marginBottom: spacing.sm,
  },
  subtitle: {
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
});
