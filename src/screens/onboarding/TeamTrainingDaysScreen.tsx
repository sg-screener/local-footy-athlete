import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { DayOfWeek } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { DayGrid } from '../../components/onboarding/DayGrid';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type TeamTrainingDaysScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TeamTrainingDays'
>;

/**
 * Multi-select day-of-week picker. Layout is delegated to the shared
 * <DayGrid /> component so this screen reads identically to
 * PreferredTrainingDaysScreen — Mon–Sat in a 3-up grid, Sunday centered
 * underneath. No per-screen grid styles.
 */
export const TeamTrainingDaysScreen: React.FC<TeamTrainingDaysScreenProps> = ({
  navigation,
}) => {
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('TeamTrainingDays');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const isValid = selectedDays.length > 0;

  const handleContinue = () => {
    if (isValid) {
      updateOnboardingData({
        teamTrainingDaysPerWeek: selectedDays.length,
        teamTrainingDays: selectedDays,
      });
      navigation.navigate('TeamTrainingDuration');
    }
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          TEAM TRAINING DAYS
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Pick the days you train with your club.
        </Text>
      </View>

      <DayGrid selectedDays={selectedDays} onToggleDay={toggleDay} />

      {selectedDays.length > 0 && (
        <Text
          variant="bodySmall"
          color={colors.text.tertiary}
          style={styles.selectedCount}
        >
          {feedbackForCount(selectedDays.length)}
        </Text>
      )}
    </OnboardingLayout>
  );
};

/**
 * Load-aware feedback copy.
 * Neutral at 1 ("1 team session"), confident at 2 ("solid load"),
 * honest warning at 3+ ("higher fatigue week") so the athlete sees the
 * stakes of each selection without being preachy.
 */
function feedbackForCount(count: number): string {
  if (count === 1) return '1 team session';
  if (count === 2) return '2 team sessions - solid load';
  return `${count} team sessions - higher fatigue week`;
}

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: spacing.xl,
  },
  title: {
    ...headingXL,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    lineHeight: 20,
  },
  selectedCount: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
