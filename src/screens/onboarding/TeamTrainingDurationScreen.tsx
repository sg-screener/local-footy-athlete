import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { TeamTrainingDuration, TeamTrainingIntensity } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type TeamTrainingDurationScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TeamTrainingDuration'
>;

/**
 * Combined "What are team sessions like?" screen.
 *
 * Duration + intensity collected in one pass. The screen renders two
 * clearly-separated sections ("HOW LONG?" / "HOW HARD?") using the shared
 * <SelectableTile /> primitive.
 *
 * Two different tile variants are used on purpose:
 *   • Duration row uses `variant="grid"` — "60 min" / "90 min" / "2 hrs"
 *     are compact, number-led labels, so the light chrome + lime text
 *     let the value dominate.
 *   • Intensity row uses the default `variant="card"` — each tile has a
 *     label AND a subtitle ("Match-level intensity"), so the fuller
 *     selected fill helps the two-line block read as a selected block.
 *
 * Continue is persistent: when incomplete, the button stays visible but
 * dimmed and the footer explains "Select duration and intensity".
 *
 * Presentation labels (Light / Moderate / Hard / Very hard) map to the
 * stored enum values (`Light` / `Moderate` / `Hard` / `Very intense`) —
 * downstream load-estimation logic reads the enum, not the label.
 */

const DURATION_OPTIONS: { id: TeamTrainingDuration; label: string }[] = [
  { id: '60 minutes', label: '60 min' },
  { id: '90 minutes', label: '90 min' },
  { id: '2 hours', label: '2 hrs' },
];

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
  const [duration, setDuration] = useState<TeamTrainingDuration | null>(null);
  const [intensity, setIntensity] = useState<TeamTrainingIntensity | null>(null);
  const { label: stepLabel, progressPercent } =
    useOnboardingProgress('TeamTrainingDuration');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData,
  );

  const canContinue = duration !== null && intensity !== null;

  const handleContinue = useCallback(() => {
    if (!canContinue || !duration || !intensity) return;
    updateOnboardingData({
      teamTrainingDuration: duration,
      teamTrainingIntensity: intensity,
    });
    navigation.navigate('TrainingCommitment');
  }, [canContinue, duration, intensity, navigation, updateOnboardingData]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!canContinue}
      footerHelperText={canContinue ? undefined : 'Select duration and intensity'}
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

      {/* ── Duration section ────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>HOW LONG?</Text>
      <View style={styles.durationRow}>
        {DURATION_OPTIONS.map((option) => {
          const active = duration === option.id;
          return (
            <SelectableTile
              key={option.id}
              variant="grid"
              isSelected={active}
              onPress={() => setDuration(option.id)}
              style={styles.durationSlot}
            >
              <Text style={[
                styles.cardLabel,
                active && styles.cardLabelSelectedGrid,
              ]}>
                {option.label}
              </Text>
            </SelectableTile>
          );
        })}
      </View>

      {/* ── Intensity section ───────────────────────────────────── */}
      <Text style={[styles.sectionHeader, styles.sectionHeaderGap]}>HOW HARD?</Text>
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
