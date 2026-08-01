import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { TeamTrainingIntensity } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type TeamTrainingDurationScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TeamTrainingDuration'
>;

/**
 * "What are team sessions like?" — the intensity SEED.
 *
 * DURATION WAS REMOVED HERE (Sam's ruling, 2026-07-30). The screen used to ask "HOW
 * LONG?" as well, and the answer had no programming consumer anywhere in the app — the
 * influence map found it reached this screen, the Review row and the coach prompt, and
 * stopped. Sam's options were to give it a consumer or to stop asking; he chose to stop
 * asking, so the athlete is asked one question here instead of two.
 *
 * WHAT INTENSITY IS FOR NOW. It is the ESTIMATE SEED, and only that: the team-night size
 * that actually drives programming is a rolling read of the last three LOGGED team nights
 * (`rules/teamNightSize.ts`). This answer holds until the first of those exists, and then
 * measurement takes over — the same estimate→measured shape as loads and the 2km TT.
 *
 * Intensity tiles use the default `variant="card"` — each has a label AND a subtitle
 * ("Match-level intensity"), so the fuller selected fill helps the two-line block read as
 * a selected block.
 *
 * Continue is persistent: when incomplete, the button stays visible but dimmed.
 *
 * Presentation labels (Light / Moderate / Hard / Very hard) map to the
 * stored enum values (`Light` / `Moderate` / `Hard` / `Very intense`) —
 * downstream load-estimation logic reads the enum, not the label.
 */

const INTENSITY_OPTIONS: {
  id: TeamTrainingIntensity;
  label: string;
  subtitle: string;
}[] = [
  { id: 'Light', label: 'Light', subtitle: 'Skills & touch' },
  { id: 'Moderate', label: 'Moderate', subtitle: 'Some running' },
  { id: 'Hard', label: 'Hard', subtitle: 'Plenty of running' },
  { id: 'Very intense', label: 'Very hard', subtitle: 'Match-level intensity' },
];

export const TeamTrainingDurationScreen: React.FC<TeamTrainingDurationScreenProps> = ({
  navigation,
}) => {
  const [intensity, setIntensity] = useState<TeamTrainingIntensity | null>(null);
  const { label: stepLabel, progressPercent } =
    useOnboardingProgress('TeamTrainingDuration');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const canContinue = intensity !== null;

  const handleContinue = useCallback(() => {
    if (!intensity) return;
    void commitAndAdvance({
      teamTrainingIntensity: intensity,
    }, () => navigation.navigate('TrainingCommitment'));
  }, [intensity, navigation, commitAndAdvance]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      footerHelperText={canContinue ? undefined : 'Pick how hard team training usually is'}
    >
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          What are team sessions like?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          This helps balance your weekly load.
        </Text>
      </View>

      {/* ── Intensity section ───────────────────────────────────── */}
      <Text style={styles.sectionHeader}>HOW HARD?</Text>
      <View style={styles.intensityGrid}>
        {INTENSITY_OPTIONS.map((option) => (
          <SelectableTile
            key={option.id}
            isSelected={intensity === option.id}
            onPress={() => setIntensity(option.id)}
            style={styles.intensitySlot}
          >
            <Text style={[
              styles.cardLabel,
              intensity === option.id && styles.cardLabelSelected,
            ]}>
              {option.label}
            </Text>
            <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
          </SelectableTile>
        ))}
      </View>
    </OnboardingLayout>
  );
};

const CARD_MIN_HEIGHT = 78;

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: spacing.lg,
  },
  title: {
    ...headingXL,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.text.secondary,
    lineHeight: 20,
  },

  /* Section headers — uppercase muted label, clear hierarchy */
  sectionHeader: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
  },
  sectionHeaderGap: {
    // Extra top margin on HOW HARD? so the two sections feel distinct
    // rather than blending into one block.
    marginTop: spacing.xl,
  },

  /* Duration row — 3 equal chips, horizontal */
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationSlot: {
    flex: 1,
    minHeight: CARD_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Intensity grid — 2 cols, 4 cards */
  intensityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  intensitySlot: {
    flexBasis: '48.5%',
    flexGrow: 1,
    minHeight: CARD_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardLabel: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Intensity row (variant="card"): fill carries selection, so the label
  // keeps the primary text colour.
  cardLabelSelected: {
    color: colors.text.primary,
  },
  // Duration row (variant="grid"): the quieter chrome leans on the label
  // itself to signal selection — turn the text lime + bump the weight a
  // touch so it reads as "the chosen one" at a glance.
  cardLabelSelectedGrid: {
    color: colors.accent.lime,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 3,
    textAlign: 'center',
  },
});
