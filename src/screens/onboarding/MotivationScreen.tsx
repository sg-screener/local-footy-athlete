import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import {
  MAX_MOTIVATION_GOALS,
  MOTIVATION_GOAL_OPTIONS,
  type MotivationGoal,
} from '../../rules/motivationGoals';

type MotivationScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Motivation'
>;

/**
 * THE OPTION LIST IS IMPORTED, NOT DECLARED (Sam, 2026-07-30).
 *
 * This screen used to own its own array of `{ id, label }` with ids like `'senior-team'`
 * that existed nowhere else in the app — the labels were joined into one string and two
 * modules split them back apart to guess at goals. Now the authored set is the single
 * owner, and `motivationGoalsTests` fails the build if this file grows its own option
 * literals again.
 *
 * "Other" is deliberately NOT in the authored set: it is not a goal, it is a free-text
 * escape hatch, and keeping it out is what stops an athlete's prose being stored as if it
 * were one of Sam's seven.
 */
const OTHER_ID = 'other' as const;

type SelectableId = MotivationGoal | typeof OTHER_ID;

/**
 * Multi-select up to 3. Uses the shared <SelectableTile /> primitive for
 * the selected look — the inline checkbox was removed in favour of the
 * canonical corner checkmark so every multi-select surface in the app
 * looks identical.
 */
export const MotivationScreen: React.FC<MotivationScreenProps> = ({
  navigation,
}) => {
  const [selected, setSelected] = useState<SelectableId[]>([]);
  const [otherText, setOtherText] = useState('');
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Motivation');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const isAtMax = selected.length >= MAX_MOTIVATION_GOALS;
  const hasOther = selected.includes(OTHER_ID);

  const toggleOption = (id: SelectableId) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((s) => s !== id);
      }
      if (prev.length >= MAX_MOTIVATION_GOALS) return prev;
      return [...prev, id];
    });
  };

  const canContinue =
    selected.length >= 1 &&
    (!hasOther || otherText.trim().length > 0);

  const handleContinue = () => {
    if (!canContinue) return;

    // THE DECISION IS WHAT PERSISTS. The joined sentence this screen used to write is now
    // derived wherever it is shown (`motivationDisplay`), so a comma in `otherText` can
    // never again be re-read as an extra goal.
    const goals = selected.filter((id): id is MotivationGoal => id !== OTHER_ID);
    const other = hasOther ? otherText.trim() : undefined;

    void commitAndAdvance(
      { goals, motivationOther: other },
      () => navigation.navigate('SeasonPhase'),
    );
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={!canContinue}
    >
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          What do you want to get out of this season?
        </Text>
        <View style={styles.subtitleRow}>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.subtitle}
          >
            Pick up to 3 goals
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.counterText,
              isAtMax && styles.counterTextMax,
            ]}
          >
            {selected.length}/{MAX_MOTIVATION_GOALS} selected
          </Text>
        </View>
      </View>

      <View style={styles.cardsContainer}>
        {[...MOTIVATION_GOAL_OPTIONS, { id: OTHER_ID, label: 'Other' }].map((option) => {
          const isSelected = selected.includes(option.id);
          const isDimmed = isAtMax && !isSelected;

          return (
            <SelectableTile
              key={option.id}
              isSelected={isSelected}
              dimmed={isDimmed}
              onPress={() => toggleOption(option.id)}
              style={styles.card}
            >
              <Text
                style={[
                  styles.cardText,
                  isDimmed && styles.cardTextDimmed,
                ]}
              >
                {option.label}
              </Text>
            </SelectableTile>
          );
        })}
      </View>

      {hasOther && (
        <View style={styles.otherInputContainer}>
          <AppTextInput
            style={styles.otherInput}
            placeholder="What's your focus?"
            placeholderTextColor={colors.text.tertiary}
            value={otherText}
            onChangeText={setOtherText}
            autoFocus
            returnKeyType="done"
          />
        </View>
      )}

      <View style={styles.bottomSpacer} />
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
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  subtitle: {
    flex: 1,
    lineHeight: 20,
  },
  counterText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  counterTextMax: {
    color: colors.accent.lime,
  },
  cardsContainer: {
    gap: 10,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cardText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    // Leave room on the right for the corner checkmark so the label never
    // collides with the badge in longer options like "Get stronger & fitter".
    paddingRight: 26,
  },
  cardTextDimmed: {
    color: colors.text.tertiary,
  },
  otherInputContainer: {
    marginTop: spacing.lg,
  },
  otherInput: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: colors.accent.lime,
  },
  bottomSpacer: {
    height: 96,
  },
});
