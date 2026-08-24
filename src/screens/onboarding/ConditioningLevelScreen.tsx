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
import { ConditioningLevel } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import {
  answerCardSubtitle,
  answerCardTitle,
  headingXL,
} from '../../components/onboarding/onboardingStyles';

type ConditioningLevelScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'ConditioningLevel'
>;

const CONDITIONING_OPTIONS: {
  id: ConditioningLevel;
  label: string;
  subtitle: string;
}[] = [
  // Tone-aligned progression: each pair is (short punchy verb-led label,
  // one-line subtitle). `id` values are the persisted ConditioningLevel
  // enum and are unchanged — only the athlete-facing copy was refreshed.
  {
    id: 'Poor',
    label: 'STRUGGLE EARLY',
    subtitle: 'Gas out quickly',
  },
  {
    id: 'Average',
    label: 'FADE LATE',
    subtitle: 'Start okay, drop off late',
  },
  {
    id: 'Good',
    label: 'SOLID',
    subtitle: 'Handle most conditioning well',
  },
  {
    id: 'Elite',
    label: 'VERY FIT',
    subtitle: 'Rarely struggle',
  },
];

export const ConditioningLevelScreen: React.FC<ConditioningLevelScreenProps> = ({
  navigation,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<ConditioningLevel | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('ConditioningLevel');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const handleSelect = useCallback((level: ConditioningLevel) => {
    setSelectedLevel(level);
    void commitAndAdvance({ conditioningLevel: level }, () => {
      setTimeout(() => navigation.navigate('SprintExposure'), 250);
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
          How's your conditioning right now?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Be honest - this helps set the right conditioning load.
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {CONDITIONING_OPTIONS.map((option) => {
          const isSelected = selectedLevel === option.id;
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
    ...answerCardTitle,
    color: colors.text.primary,
    marginBottom: 4,
  },
  optionSubtitle: {
    ...answerCardSubtitle,
    color: colors.text.tertiary,
  },
});
