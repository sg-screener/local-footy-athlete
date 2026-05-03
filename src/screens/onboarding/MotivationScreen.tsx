import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
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

type MotivationScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Motivation'
>;

const MAX_SELECTIONS = 3;

const MOTIVATION_OPTIONS = [
  { id: 'senior-team', label: 'Make the senior team' },
  { id: 'dominate', label: 'Dominate your level' },
  { id: 'fresh', label: 'Feel fresh on game day' },
  { id: 'injury-free', label: 'Stay injury-free' },
  { id: 'stronger-fitter', label: 'Get stronger & fitter' },
  { id: 'muscle', label: 'Build muscle' },
  { id: 'consistent', label: 'Stay consistent' },
  { id: 'other', label: 'Other' },
];

/**
 * Multi-select up to 3. Uses the shared <SelectableTile /> primitive for
 * the selected look — the inline checkbox was removed in favour of the
 * canonical corner checkmark so every multi-select surface in the app
 * looks identical.
 */
export const MotivationScreen: React.FC<MotivationScreenProps> = ({
  navigation,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [otherText, setOtherText] = useState('');
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Motivation');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const isAtMax = selected.length >= MAX_SELECTIONS;
  const hasOther = selected.includes('other');

  const toggleOption = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((s) => s !== id);
      }
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  };

  const canContinue =
    selected.length >= 1 &&
    (!hasOther || otherText.trim().length > 0);

  const handleContinue = () => {
    if (!canContinue) return;

    const labels = selected.map((id) => {
      if (id === 'other') return otherText.trim();
      return MOTIVATION_OPTIONS.find((o) => o.id === id)?.label || id;
    });

    updateOnboardingData({ motivation: labels.join(', ') });
    navigation.navigate('SeasonPhase');
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
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
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Pick up to 3
        </Text>
      </View>

      {isAtMax && (
        <Text style={styles.maxText}>Max 3 selected</Text>
      )}

      <View style={styles.cardsContainer}>
        {MOTIVATION_OPTIONS.map((option) => {
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
          <TextInput
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
    lineHeight: 20,
  },
  maxText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.md,
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
});
