import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
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
          Do you do any sprint work?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          This helps us manage speed work and recovery
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {SPRINT_OPTIONS.map((option) => {
          const isSelected = selectedExposure === option.id;
          return (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                !isSelected && pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(option.id)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </Pressable>
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
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
  },
  cardSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },
  cardPressed: {
    backgroundColor: colors.surface.tertiary,
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  optionSubtitle: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '400',
  },
});
