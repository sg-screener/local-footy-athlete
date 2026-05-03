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
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import { BenchStrength } from '../../types/domain';

type BenchStrengthScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'BenchStrength'
>;

// Mirrors SquatStrengthScreen's option-list refresh — see that file for
// the rationale on the "I don't bench" + "Not sure" merge (canonical id
// is 'Not sure' because it claims less about whether the user benches).
// Bench progression is 1.0 → 1.25 → 1.5 BW — already evenly spaced; only
// the labels changed (Below + leading "~" on multiplier tiers).
const STRENGTH_OPTIONS: { id: BenchStrength; label: string }[] = [
  { id: 'Less than bodyweight', label: 'Below bodyweight' },
  { id: 'Around bodyweight', label: 'Around bodyweight' },
  { id: '1.25x bodyweight', label: '~1.25× bodyweight' },
  { id: '1.5x bodyweight+', label: '~1.5× bodyweight+' },
  { id: 'Not sure', label: "I don't bench / not sure" },
];

export const BenchStrengthScreen: React.FC<BenchStrengthScreenProps> = ({
  navigation,
}) => {
  const [selectedStrength, setSelectedStrength] = useState<BenchStrength | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('BenchStrength');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((strength: BenchStrength) => {
    setSelectedStrength(strength);
    updateOnboardingData({ benchStrength: strength });
    setTimeout(() => {
      navigation.navigate('ConditioningLevel');
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
          How strong is your bench press?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Rough estimate is fine
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {STRENGTH_OPTIONS.map((option) => {
          const isSelected = selectedStrength === option.id;
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
              <Text
                variant="bodyEmphasis"
                color={isSelected ? colors.text.primary : colors.text.secondary}
                style={styles.cardLabel}
              >
                {option.label}
              </Text>
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
  cardLabel: {
    fontWeight: '600',
  },
});
