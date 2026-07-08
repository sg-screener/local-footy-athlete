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
  const trainingDaysUnsure = useProfileStore(
    (state) => state.onboardingData.trainingDaysUnsure === true
  );
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const cap = trainingDaysUnsure ? 3 : trainingDaysPerWeek || 0;
  const isFlexible = !trainingDaysUnsure && (!trainingDaysPerWeek || trainingDaysPerWeek === 0);
  const isAtCap = !isFlexible && selectedDays.length >= cap;
  const isValid = selectedDays.length >= 1;

  /**
   * Hard cap at `trainingDaysPerWeek` with no auto-rotate — the prior screen's
   * answer is treated as the ceiling, and the athlete picks any subset up to
   * that. "Not sure" is also capped at 3 while keeping its own copy and visual
   * state upstream.
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
    if (trainingDaysUnsure) {
      return "We'll start you with 3 LFA days. Pick the days that usually work best.";
    }
    if (isFlexible) {
      return 'Tap all the days that work for you';
    }
    return `Pick up to ${cap} day${cap === 1 ? '' : 's'} for LFA work.`;
  }, [cap, isFlexible, trainingDaysUnsure]);

  const handleContinue = () => {
    if (isValid) {
      let nextTrainingDays = selectedDays.length;
      if (trainingDaysUnsure) {
        nextTrainingDays = 3;
      } else if (!isFlexible) {
        nextTrainingDays = cap;
      }
      updateOnboardingData({
        preferredTrainingDays: selectedDays,
        trainingDaysPerWeek: nextTrainingDays,
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
