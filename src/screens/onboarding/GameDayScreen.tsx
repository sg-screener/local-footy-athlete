import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { OnboardingStackParamList } from '../../types/navigation';
import { DayOfWeek } from '../../types/domain';
import { DAYS_OF_WEEK } from '../../rules/gameAnchor';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type GameDayScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'GameDay'
>;

/**
 * THE WHOLE WEEK. Sam, 2026-08-12: *"games should be able to be placed any day
 * of the week - i can't know when every single club in aus is going to play a
 * game so I want to be prepared for everything"*.
 *
 * This picker offered three days until then, and a midweek game answered here
 * was not merely unavailable — the resolver's allowlist turned it into no game
 * at all, so the athlete's week lost its taper, its spacing and its recovery
 * day. The list is `DAYS_OF_WEEK` from the game-anchor owner, so the picker and
 * everything that reads the answer cannot disagree about what a day is.
 *
 * Visuals come from the shared <SelectableTile /> primitive so the picker
 * matches every other selection surface (lime border + lime fill + corner
 * checkmark).
 */

export const GameDayScreen: React.FC<GameDayScreenProps> = ({ navigation }) => {
  const [selectedGameDay, setSelectedGameDay] = useState<DayOfWeek | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('GameDay');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const handleSelect = useCallback((day: DayOfWeek) => {
    setSelectedGameDay(day);
    void commitAndAdvance({ gameDay: day }, () => {
      setTimeout(() => navigation.navigate('TeamTrainingDays'), 250);
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
          What day do you usually play?
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = selectedGameDay === day;
          return (
            <SelectableTile
              key={day}
              isSelected={isSelected}
              onPress={() => handleSelect(day)}
              style={styles.card}
            >
              <Text
                variant="body"
                color={colors.text.primary}
                style={styles.cardText}
              >
                {day}
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
