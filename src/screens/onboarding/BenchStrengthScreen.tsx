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
const STRENGTH_OPTIONS: { id: BenchStrength; label: string }[] = [
  { id: 'Less than bodyweight', label: 'Less than bodyweight' },
  { id: 'Around bodyweight', label: 'Around bodyweight' },
  { id: '1.25x bodyweight', label: '1.25× bodyweight' },
  { id: '1.5x bodyweight+', label: '1.5× bodyweight+' },
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
            <SelectableTile
              key={option.id}
              isSelected={isSelected}
              onPress={() => handleSelect(option.id)}
              style={styles.card}
            >
              <Text
                variant="bodyEmphasis"
                color={isSelected ? colors.text.primary : colors.text.secondary}
                style={styles.cardLabel}
              >
                {option.label}
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
  cardLabel: {
    fontWeight: '600',
    paddingRight: 28,
  },
});
