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
import { TeamTrainingIntensity } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type TeamTrainingIntensityScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TeamTrainingIntensity'
>;

const INTENSITY_OPTIONS: { id: TeamTrainingIntensity; label: string; subtitle: string }[] = [
  {
    id: 'Light',
    label: 'LIGHT',
    subtitle: 'Skills & touch',
  },
  {
    id: 'Moderate',
    label: 'MODERATE',
    subtitle: 'Bit of running',
  },
  {
    id: 'Hard',
    label: 'HARD',
    subtitle: 'Plenty of running',
  },
  {
    id: 'Very intense',
    label: 'VERY HARD',
    subtitle: 'Match-level intensity',
  },
];

export const TeamTrainingIntensityScreen: React.FC<TeamTrainingIntensityScreenProps> = ({
  navigation,
}) => {
  const [selectedIntensity, setSelectedIntensity] = useState<TeamTrainingIntensity | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('TeamTrainingIntensity');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((intensity: TeamTrainingIntensity) => {
    setSelectedIntensity(intensity);
    updateOnboardingData({ teamTrainingIntensity: intensity });
    setTimeout(() => {
      navigation.navigate('TrainingCommitment');
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
          How hard are your team sessions?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          We'll adjust your training around this
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {INTENSITY_OPTIONS.map((option) => {
          const isSelected = selectedIntensity === option.id;
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
    color: colors.text.primary,
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
