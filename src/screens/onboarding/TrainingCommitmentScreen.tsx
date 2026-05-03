import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type TrainingCommitmentScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TrainingCommitment'
>;

const COMMITMENT_OPTIONS = [1, 2, 3, 4, 5, 6];

/**
 * How-many-days picker (outside team training).
 *
 * Uses the shared <SelectableTile /> primitive with `variant="grid"` so
 * the big number (1..6) is the primary visual signal and the selected
 * chrome stays light (4% tint, no scale, small 14×14 checkmark). The
 * selected number is also coloured lime by the consumer — together,
 * these cues make the choice unambiguous without drowning the tile in
 * a heavy fill.
 *
 * The "Not sure" escape hatch below is a Pressable (not a tile) because
 * it's a text-link affordance, not a peer option.
 */
export const TrainingCommitmentScreen: React.FC<
  TrainingCommitmentScreenProps
> = ({ navigation }) => {
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('TrainingCommitment');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const [notSure, setNotSure] = useState(false);

  const handleSelect = useCallback((days: number) => {
    setSelectedDays(days);
    setNotSure(false);
    updateOnboardingData({ trainingDaysPerWeek: days });
    setTimeout(() => {
      navigation.navigate('PreferredTrainingDays');
    }, 250);
  }, [navigation, updateOnboardingData]);

  const handleNotSure = useCallback(() => {
    setNotSure(true);
    setSelectedDays(null);
    updateOnboardingData({ trainingDaysPerWeek: 0 });
    setTimeout(() => {
      navigation.navigate('PreferredTrainingDays');
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
      <View style={styles.section}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.sectionTitle}
        >
          HOW MANY DAYS PER WEEK CAN YOU TRAIN?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Be realistic — we'll build around your team training and games
        </Text>

        <View style={styles.grid}>
          {COMMITMENT_OPTIONS.map((day) => {
            const isSelected = selectedDays === day;
            return (
              <SelectableTile
                key={day}
                variant="grid"
                isSelected={isSelected}
                onPress={() => handleSelect(day)}
                style={styles.card}
              >
                <Text
                  variant="h2"
                  color={isSelected ? colors.accent.lime : colors.text.primary}
                  style={[styles.cardNumber, isSelected && styles.cardNumberSelected]}
                >
                  {day}
                </Text>
              </SelectableTile>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.notSureButton,
            notSure && styles.notSureButtonSelected,
            pressed && !notSure && styles.notSurePressed,
          ]}
          onPress={handleNotSure}
        >
          <Text style={[styles.notSureText, notSure && styles.notSureTextSelected]}>
            Not sure — we can adjust later
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '31%',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  cardNumber: {
    fontWeight: '700',
  },
  cardNumberSelected: {
    // Selected number lives inside lime-tinted card — lift weight to keep
    // contrast without introducing a glow (reserved for completion states).
    fontWeight: '800',
  },
  notSureButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  notSureButtonSelected: {
    opacity: 1,
  },
  notSurePressed: {
    opacity: 0.6,
  },
  notSureText: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  notSureTextSelected: {
    color: colors.accent.lime,
  },
});
