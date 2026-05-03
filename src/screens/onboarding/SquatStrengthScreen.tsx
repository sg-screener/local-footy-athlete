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
import { SquatStrength } from '../../types/domain';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type SquatStrengthScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'SquatStrength'
>;

// Strength progression (1.0 → 1.5 → 2.0 BW) is the same as it ever was —
// only the labels softened: "Below" instead of "Less than", and a leading
// "~" on the multiplier tiers to land the "rough estimate is fine" tone.
//
// "I don't squat" + "Not sure" are merged into a single escape-hatch tile
// that persists the broader `'Not sure'` id. We deliberately use 'Not
// sure' as the canonical (rather than "I don't squat") because the
// merged tile may be picked by someone who DOES squat but can't ballpark
// their number — claiming "I don't squat" for that user would lie to the
// engine. The "I don't squat" enum value is left in the SquatStrength
// type so previously-persisted profiles still validate; we just don't
// surface it during onboarding any more.
const STRENGTH_OPTIONS: { id: SquatStrength; label: string }[] = [
  { id: 'Less than bodyweight', label: 'Below bodyweight' },
  { id: 'Around bodyweight', label: 'Around bodyweight' },
  { id: '1.5x bodyweight', label: '~1.5× bodyweight' },
  { id: '2x bodyweight+', label: '~2× bodyweight+' },
  { id: 'Not sure', label: "I don't squat / not sure" },
];

export const SquatStrengthScreen: React.FC<SquatStrengthScreenProps> = ({
  navigation,
}) => {
  const [selectedStrength, setSelectedStrength] = useState<SquatStrength | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('SquatStrength');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((strength: SquatStrength) => {
    setSelectedStrength(strength);
    updateOnboardingData({ squatStrength: strength });
    setTimeout(() => {
      navigation.navigate('BenchStrength');
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
          How strong is your squat?
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
