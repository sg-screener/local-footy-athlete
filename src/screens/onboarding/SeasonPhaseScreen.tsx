import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { SeasonPhase } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type SeasonPhaseScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'SeasonPhase'
>;

type PhaseOption = {
  id: SeasonPhase;
  label: string;
  tagline: string;
};

const PHASE_OPTIONS: PhaseOption[] = [
  { id: 'Off-season', label: 'Off-season', tagline: 'Build your base' },
  { id: 'Pre-season', label: 'Pre-season', tagline: 'Get game-ready' },
  { id: 'In-season', label: 'In-season', tagline: 'Stay strong & fresh' },
];

/**
 * Phase picker. Selection visuals come from the shared <SelectableTile />
 * primitive — the previous inline radio dot was removed in favour of the
 * canonical corner checkmark so every selection surface looks identical.
 */
export const SeasonPhaseScreen: React.FC<SeasonPhaseScreenProps> = ({
  navigation,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<SeasonPhase | null>(null);
  const { label: stepLabel, progressPercent } =
    useOnboardingProgress('SeasonPhase');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData,
  );

  const handleSelect = useCallback((phase: SeasonPhase) => {
    setSelectedPhase(phase);
    updateOnboardingData({ seasonPhase: phase });

    setTimeout(() => {
      if (phase === 'Off-season') {
        navigation.navigate('TrainingCommitment');
      } else if (phase === 'Pre-season') {
        navigation.navigate('TeamTrainingDays');
      } else {
        navigation.navigate('GameDay');
      }
    }, 300);
  }, [navigation, updateOnboardingData]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={() => {}}
      hideFooter
    >
      <Text variant="h1" color={colors.text.primary} style={styles.title}>
        Where are you in your season?
      </Text>

      <View style={styles.cardsContainer}>
        {PHASE_OPTIONS.map((phase) => {
          const isSelected = selectedPhase === phase.id;
          return (
            <SelectableTile
              key={phase.id}
              isSelected={isSelected}
              onPress={() => handleSelect(phase.id)}
              style={styles.card}
            >
              <Text variant="h4" color={colors.text.primary}>
                {phase.label}
              </Text>
              <Text
                variant="bodySmall"
                color={isSelected ? colors.accent.lime : colors.text.secondary}
                style={styles.cardTagline}
              >
                {phase.tagline}
              </Text>
            </SelectableTile>
          );
        })}
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  title: {
    ...headingXL,
    marginBottom: 8,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cardTagline: {
    lineHeight: 20,
    marginTop: 6,
  },
});
