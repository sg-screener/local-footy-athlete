import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import {
  EMPTY_SEASON_FINISH_DATE,
  SeasonFinishDateFields,
  seasonFinishDateDraft,
} from '../../components/season/SeasonFinishDateFields';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { validateSeasonFinishDateParts } from '../../rules/seasonPhaseClock';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import type { OnboardingStackParamList } from '../../types/navigation';
import { todayISOLocal } from '../../utils/appDate';
import { useProfileStore } from '../../store/profileStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SeasonFinished'>;

export const SeasonFinishedScreen: React.FC<Props> = ({ navigation }) => {
  const storedAnswer = useProfileStore((state) => state.onboardingData.seasonFinishedOn);
  const [date, setDate] = useState(() => storedAnswer
    ? seasonFinishDateDraft(storedAnswer)
    : EMPTY_SEASON_FINISH_DATE);
  const [attempted, setAttempted] = useState(false);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('SeasonFinished');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const validation = useMemo(
    () => validateSeasonFinishDateParts(date.day, date.month, date.year, todayISOLocal()),
    [date],
  );
  const hasAllParts = date.day.trim() !== '' && date.month.trim() !== '' && date.year.trim() !== '';
  const validationError = 'message' in validation ? validation.message : null;

  const save = (seasonFinishedOn: string | null) => {
    void commitAndAdvance(
      { seasonFinishedOn },
      () => navigation.navigate('TrainingCommitment'),
    );
  };

  const handleContinue = () => {
    setAttempted(true);
    if (validation.ok) save(validation.dateISO);
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={!hasAllParts}
    >
      <View style={styles.titleSection}>
        <Text variant="h1" color={colors.text.primary} style={styles.title}>
          When did your season finish?
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
          This helps LFA start you at the right point of your off-season.
        </Text>
      </View>

      <SeasonFinishDateFields
        value={date}
        onChange={(next) => { setDate(next); setAttempted(false); }}
      />

      {attempted && validationError ? (
        <Text variant="bodySmall" color={colors.status.error} style={styles.error}>
          {validationError}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => save(null)}
        style={({ pressed }) => [styles.unsureButton, pressed && styles.pressed]}
      >
        <Text style={styles.unsureText}>I'm not sure</Text>
      </Pressable>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  titleSection: { marginBottom: spacing.xl },
  title: { ...headingXL, marginBottom: spacing.sm },
  subtitle: { lineHeight: 20 },
  error: { marginTop: spacing.sm, lineHeight: 18 },
  unsureButton: {
    height: 54,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsureText: { color: colors.text.secondary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
