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
 * How-many-days picker.
 *
 * Uses the shared <SelectableTile /> primitive with `variant="grid"` so
 * the big number (1..6) is the primary visual signal and the selected
 * chrome stays light (4% tint, no scale, small 14×14 checkmark). The
 * selected number is also coloured lime by the consumer — together,
 * these cues make the choice unambiguous without drowning the tile in
 * a heavy fill.
 *
 * The "Not sure" escape hatch below is a secondary pill that selects a
 * sensible default without advancing automatically.
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
    updateOnboardingData({
      trainingDaysPerWeek: days,
      trainingDaysUnsure: false,
    });
  }, [updateOnboardingData]);

  const handleNotSure = useCallback(() => {
    setSelectedDays(null);
    setNotSure(true);
    updateOnboardingData({
      trainingDaysPerWeek: 3,
      trainingDaysUnsure: true,
    });
  }, [updateOnboardingData]);

  const handleContinue = useCallback(() => {
    if (selectedDays !== null || notSure) {
      navigation.navigate('PreferredTrainingDays');
    }
  }, [navigation, notSure, selectedDays]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={selectedDays === null && !notSure}
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
          Pick how many days you can fit LFA work in. Include club training nights when you're happy to double up.
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
    backgroundColor: 'rgba(200,255,0,0.04)',
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
