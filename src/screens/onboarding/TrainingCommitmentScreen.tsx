import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common';
import { HorizontalNumberPicker } from '../../components/HorizontalNumberPicker';
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
 * Uses a centred number wheel with seven snapping values. It opens on the
 * middle value (4); numbers grow and become clearer as they reach the centre.
 * The answer remains local and is only committed on Continue.
 *
 * The "Not sure" escape hatch below is a secondary pill that selects a
 * sensible default without advancing automatically.
 */
export const TrainingCommitmentScreen: React.FC<
  TrainingCommitmentScreenProps
> = ({ navigation }) => {
  const [selectedDays, setSelectedDays] = useState<number>(4);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('TrainingCommitment');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const [notSure, setNotSure] = useState(false);

  const handleSelect = useCallback((days: number) => {
    setSelectedDays(days);
    setNotSure(false);
  }, []);

  const handleNotSure = useCallback(() => {
    setNotSure(true);
  }, []);

  // The pick is local until Continue: one commit, awaited, tied to the advance.
  // "Not sure" is an answer too — 3 days, flagged as unsure.
  const handleContinue = useCallback(() => {
    void commitAndAdvance({
      trainingDaysPerWeek: notSure ? 3 : selectedDays,
      trainingDaysUnsure: notSure,
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
    >
      <View style={styles.section}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.sectionTitle}
        >
          How many strength sessions would you like each week?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          A gym session can be on the same day as team training. Lifting in the morning or before training is completely fine.
        </Text>

        <HorizontalNumberPicker
          testID="training-commitment-picker"
          value={selectedDays}
          onChange={handleSelect}
          min={1}
          max={7}
          style={[styles.picker, notSure && styles.pickerInactive]}
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
  picker: {
    marginHorizontal: -4,
    marginBottom: spacing.sm,
  },
  pickerInactive: {
    opacity: 0.35,
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
    backgroundColor: 'rgba(216,216,0,0.04)',
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
