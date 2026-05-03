import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
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
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const isFlexible = !trainingDaysPerWeek || trainingDaysPerWeek === 0;
  const cap = trainingDaysPerWeek || 0;
  const isAtCap = !isFlexible && selectedDays.length >= cap;
  const isValid = selectedDays.length >= 1;

  /**
   * Hard cap at `trainingDaysPerWeek` with no auto-rotate — the prior screen's
   * answer is treated as the ceiling, and the athlete picks any subset up to
   * that. If they pick fewer (they only have 3 slots that work but said 4),
   * we sync `trainingDaysPerWeek` down on continue rather than silently
   * dropping a day later.
   */
  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      if (!isFlexible && prev.length >= cap) {
        return prev; // at cap — ignore taps on unselected tiles
      }
      return [...prev, day];
    });
  };

  /**
   * Graceful handling of upstream changes: if the athlete goes back and
   * lowers `trainingDaysPerWeek`, trim the local selection so nothing
   * exceeds the new cap.
   */
  useEffect(() => {
    if (isFlexible) return;
    if (selectedDays.length > cap) {
      setSelectedDays((prev) => prev.slice(0, cap));
    }
  }, [cap, isFlexible, selectedDays.length]);

  const subtitle = useMemo(() => {
    const picked = selectedDays.length;
    if (isFlexible) {
      if (picked === 0) return 'Tap all the days that work for you';
      return `${picked} day${picked === 1 ? '' : 's'} selected`;
    }
    if (picked === 0) return `Up to ${cap} day${cap === 1 ? '' : 's'}`;
    return `${picked} of ${cap} selected`;
  }, [cap, isFlexible, selectedDays.length]);

  const handleContinue = () => {
    if (isValid) {
      updateOnboardingData({
        preferredTrainingDays: selectedDays,
        // Sync down when athlete picks fewer than they said (flexible = always).
        trainingDaysPerWeek: selectedDays.length,
      });
      navigation.navigate('GymExperience');
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
      <View>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          Pick your available days
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

        {/*
         * Day picker layout (Mon–Sat 3-up, Sunday centered) lives in the
         * shared <DayGrid /> so this screen and TeamTrainingDaysScreen
         * stay in lockstep. Cap-aware dimming is the only per-screen
         * behaviour we plumb in.
         */}
        <DayGrid
          selectedDays={selectedDays}
          onToggleDay={toggleDay}
          isDimmed={() => isAtCap}
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
