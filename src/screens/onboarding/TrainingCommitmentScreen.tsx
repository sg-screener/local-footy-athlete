import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common';
import { DiscreteSlider } from '../../components/DiscreteSlider';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type TrainingCommitmentScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TrainingCommitment'
>;

/**
 * How-many-days picker.
 *
 * Uses the same shared discrete slider mechanism as the feedback forms, with
 * seven visible stops. The answer still starts empty and is only committed on
 * Continue.
 *
 * The "Not sure" escape hatch below is a secondary pill that selects a
 * sensible default without advancing automatically.
 */
export const TrainingCommitmentScreen: React.FC<
  TrainingCommitmentScreenProps
> = ({ navigation }) => {
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('TrainingCommitment');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const [notSure, setNotSure] = useState(false);

  const handleSelect = useCallback((days: number) => {
    setSelectedDays(days);
    setNotSure(false);
  }, []);

  const handleNotSure = useCallback(() => {
    setSelectedDays(null);
    setNotSure(true);
  }, []);

  // The pick is local until Continue: one commit, awaited, tied to the advance.
  // "Not sure" is an answer too — 3 days, flagged as unsure.
  const handleContinue = useCallback(() => {
    if (selectedDays === null && !notSure) return;
    void commitAndAdvance({
      trainingDaysPerWeek: selectedDays ?? 3,
      trainingDaysUnsure: selectedDays === null,
    }, () => navigation.navigate('PreferredTrainingDays'));
  }, [commitAndAdvance, navigation, notSure, selectedDays]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={selectedDays === null && !notSure}
    >
      <View style={styles.section}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.sectionTitle}
        >
          How many days each week can you get to a gym?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          A gym session can be on the same day as team training. Lifting in the morning or before training is completely fine.
        </Text>

        <DiscreteSlider
          testID="training-commitment-slider"
          value={selectedDays}
          onChange={handleSelect}
          min={1}
          max={7}
          showReadout={false}
          showStepLabels
          style={styles.slider}
        />

        <Pressable
          style={({ pressed }) => [
            styles.notSureButton,
            notSure && styles.notSureButtonSelected,
            pressed && styles.notSurePressed,
          ]}
          onPress={handleNotSure}
        >
          <Text style={[styles.notSureText, notSure && styles.notSureTextSelected]}>
            Not sure? We can adjust later
          </Text>
        </Pressable>
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...headingXL,
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  subtitle: {
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  slider: {
    marginHorizontal: 4,
    marginBottom: spacing.sm,
  },
  notSureButton: {
    marginTop: spacing.lg,
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  notSureButtonSelected: {
    backgroundColor: 'rgba(200,255,0,0.04)',
    borderColor: colors.accent.lime,
  },
  notSurePressed: {
    opacity: 0.72,
  },
  notSureText: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontWeight: '700',
  },
  notSureTextSelected: {
    color: colors.text.primary,
  },
});
