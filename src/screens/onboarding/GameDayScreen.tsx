import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { GameDay } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type GameDayScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'GameDay'
>;

/**
 * "Varies" intentionally omitted from the picker — the enum value stays in
 * `GameDay` (domain.ts) for legacy profiles and engine paths that may still
 * route through it, but onboarding forces a concrete day so downstream logic
 * (game-proximity guards, virtual-game rendering) gets a deterministic anchor.
 *
 * Visuals come from the shared <SelectableTile /> primitive so the picker
 * matches every other selection surface (lime border + lime fill + corner
 * checkmark).
 */
const GAME_DAY_OPTIONS: { id: GameDay; label: string }[] = [
  { id: 'Friday', label: 'Friday' },
  { id: 'Saturday', label: 'Saturday' },
  { id: 'Sunday', label: 'Sunday' },
];

export const GameDayScreen: React.FC<GameDayScreenProps> = ({ navigation }) => {
  const [selectedGameDay, setSelectedGameDay] = useState<GameDay | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('GameDay');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((day: GameDay) => {
    setSelectedGameDay(day);
    updateOnboardingData({ gameDay: day });
    setTimeout(() => {
      navigation.navigate('TeamTrainingDays');
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
          What day do you usually play?
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {GAME_DAY_OPTIONS.map((option) => {
          const isSelected = selectedGameDay === option.id;
          return (
            <SelectableTile
              key={option.id}
              isSelected={isSelected}
              onPress={() => handleSelect(option.id)}
              style={styles.card}
            >
              <Text
                variant="body"
                color={colors.text.primary}
                style={styles.cardText}
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
    marginBottom: 28,
  },
  title: {
    ...headingXL,
  },
  cardsContainer: {
    gap: 10,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  cardText: {
    fontWeight: '600',
  },
});
