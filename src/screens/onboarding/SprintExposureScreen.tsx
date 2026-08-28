import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { SprintExposure } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import {
  answerCardSubtitle,
  answerCardTitle,
  headingXL,
} from '../../components/onboarding/onboardingStyles';

type SprintExposureScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'SprintExposure'
>;

// `id` is the persisted SprintExposure enum and stays untouched — only
// the athlete-facing `label` / `subtitle` were refined for tone.
const SPRINT_OPTIONS: { id: SprintExposure; label: string; subtitle: string }[] = [
  {
    id: 'No sprint training',
    label: 'None',
    subtitle: 'No sprint work',
  },
  {
    id: 'Occasionally',
    label: 'Occasional',
    subtitle: 'Once a week or less',
  },
  {
    id: '2+ times per week',
    label: 'Regular',
    subtitle: '2+ times per week',
  },
  { id: 'Acceleration only', label: 'Acceleration only', subtitle: 'Short bursts, but no top-speed runs' },
  { id: 'Top-speed only', label: 'Top-speed only', subtitle: 'Fast upright running, but no acceleration work' },
];

export const SprintExposureScreen: React.FC<SprintExposureScreenProps> = ({
  navigation,
}) => {
  const [selectedExposure, setSelectedExposure] = useState<SprintExposure | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('SprintExposure');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const handleSelect = useCallback((exposure: SprintExposure) => {
    setSelectedExposure(exposure);
    void commitAndAdvance({ sprintExposure: exposure }, () => {
      setTimeout(() => navigation.navigate('RecentTrainingLoad'), 250);
    });
  }, [navigation, commitAndAdvance]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={() => {}}
      hideFooter
    >
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          Do you already do sprint work?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          So we can manage speed work and recovery. Team training counts if you sprint there.
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {SPRINT_OPTIONS.map((option) => {
          const isSelected = selectedExposure === option.id;
          return (
            <SelectableTile
              key={option.id}
              isSelected={isSelected}
              onPress={() => handleSelect(option.id)}
              style={styles.card}
            >
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.optionSubtitle,
                  isSelected && styles.optionSubtitleSelected,
                ]}
              >
                {option.subtitle}
              </Text>
            </SelectableTile>
          );
        })}
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: spacing.xl,
  },
  title: {
    ...headingXL,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  cardsContainer: {
    gap: 10,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  optionLabel: {
    ...answerCardTitle,
    color: colors.text.secondary,
    marginBottom: 4,
    paddingRight: 28,
  },
  optionLabelSelected: {
    color: colors.text.primary,
  },
  optionSubtitle: {
    ...answerCardSubtitle,
    color: colors.text.tertiary,
    paddingRight: 28,
  },
  optionSubtitleSelected: {
    color: colors.text.secondary,
  },
});
