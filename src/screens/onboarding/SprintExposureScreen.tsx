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
import { useProfileStore } from '../../store/profileStore';
import { SprintExposure } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type SprintExposureScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'SprintExposure'
>;

// `id` is the persisted SprintExposure enum and stays untouched — only
// the athlete-facing `label` / `subtitle` were refined for tone.
const SPRINT_OPTIONS: { id: SprintExposure; label: string; subtitle: string }[] = [
  {
    id: 'No sprint training',
    label: 'NONE',
    subtitle: 'No sprint work',
  },
  {
    id: 'Occasionally',
    label: 'OCCASIONAL',
    subtitle: 'Once a week or less',
  },
  {
    id: '2+ times per week',
    label: 'REGULAR',
    subtitle: '2+ times per week',
  },
];

export const SprintExposureScreen: React.FC<SprintExposureScreenProps> = ({
  navigation,
}) => {
  const [selectedExposure, setSelectedExposure] = useState<SprintExposure | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('SprintExposure');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((exposure: SprintExposure) => {
    setSelectedExposure(exposure);
    updateOnboardingData({ sprintExposure: exposure });
    setTimeout(() => {
      navigation.navigate('RecentTrainingLoad');
    }, 250);
  }, [navigation, updateOnboardingData]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
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
          So we can manage speed work and recovery. Club training counts if you sprint there.
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
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingRight: 28,
  },
  optionLabelSelected: {
    color: colors.text.primary,
  },
  optionSubtitle: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '400',
    paddingRight: 28,
  },
  optionSubtitleSelected: {
    color: colors.text.secondary,
  },
});
