import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { DayOfWeek } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { DayGrid } from '../../components/onboarding/DayGrid';
import { SelectableTile } from '../../components/common/SelectableTile';
import { useProfileStore } from '../../store/profileStore';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import { DateCalendarPicker } from '../../components/calendar/DateCalendarPicker';
import { addDaysISO } from '../../utils/programBlockState';
import { christmasBreakSeasonKey } from '../../rules/christmasBreakAsk';
import { todayISOLocal } from '../../utils/appDate';

type TeamTrainingDaysScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TeamTrainingDays'
>;

/**
 * Multi-select day-of-week picker using the shared 4-over-3 grid. This screen
 * keeps its explicit Continue behaviour while matching the other weekday
 * questions and the in-app season-shift picker.
 */
export const TeamTrainingDaysScreen: React.FC<TeamTrainingDaysScreenProps> = ({
  navigation,
}) => {
  const saved = useProfileStore((state) => state.onboardingData);
  // null is unanswered; [] is an explicit no-team-training answer.
  const [answer, setAnswer] = useState<DayOfWeek[] | null>(() =>
    saved.teamTrainingDays?.length || saved.teamTrainingDaysPerWeek === 0
      ? [...(saved.teamTrainingDays ?? [])] : null);
  const selectedDays = answer ?? [];
  const noTeamTraining = answer !== null && answer.length === 0;
  const asksChristmasBreak = saved.seasonPhase === 'Pre-season' && selectedDays.length > 0;
  const [stopsOverChristmas, setStopsOverChristmas] = useState<boolean | null>(() =>
    typeof saved.teamTrainingStopsOverChristmas === 'boolean'
      ? saved.teamTrainingStopsOverChristmas : null);
  const [lastTrainingDate, setLastTrainingDate] = useState<string | null>(
    saved.christmasLastTeamTrainingDate ?? null,
  );
  const [returnDate, setReturnDate] = useState<string | null>(
    saved.christmasTeamTrainingReturnDate ?? null,
  );
  const christmasYear = Number(christmasBreakSeasonKey(todayISOLocal()));
  const { label: stepLabel, progressPercent } = useOnboardingProgress('TeamTrainingDays');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      const next = selectedDays.filter((d) => d !== day);
      setAnswer(next.length ? next : null);
    } else {
      setAnswer([...selectedDays, day]);
    }
  };

  const christmasValid = !asksChristmasBreak
    || stopsOverChristmas === false
    || (stopsOverChristmas === true && !!lastTrainingDate && !!returnDate
      && returnDate > lastTrainingDate);
  const isValid = answer !== null && christmasValid
    && (!asksChristmasBreak || stopsOverChristmas !== null);

  const handleContinue = () => {
    if (isValid) {
      const christmasPatch = saved.seasonPhase === 'Pre-season'
        ? {
            teamTrainingStopsOverChristmas: noTeamTraining ? false : stopsOverChristmas ?? false,
            christmasLastTeamTrainingDate:
              !noTeamTraining && stopsOverChristmas ? lastTrainingDate ?? undefined : undefined,
            christmasTeamTrainingReturnDate:
              !noTeamTraining && stopsOverChristmas ? returnDate ?? undefined : undefined,
          }
        : {};
      void commitAndAdvance({
        teamTrainingDaysPerWeek: selectedDays.length,
        teamTrainingDays: selectedDays,
        ...christmasPatch,
      }, () => navigation.navigate('TrainingCommitment'));
    }
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          Team training days
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Pick the days you train with your club.
        </Text>
      </View>

      <DayGrid
        selectedDays={selectedDays}
        onToggleDay={toggleDay}
      />

      <SelectableTile
        isSelected={noTeamTraining}
        onPress={() => setAnswer([])}
        disabled={saving}
        accessibilityLabel="No team training"
        style={styles.noTeamTraining}
      >
        <Text variant="bodyEmphasis" color={noTeamTraining ? colors.accent.lime : colors.text.primary}>
          No team training
        </Text>
      </SelectableTile>

      {selectedDays.length > 0 && (
        <Text
          variant="bodySmall"
          color={colors.text.tertiary}
          style={styles.selectedCount}
        >
          {feedbackForCount(selectedDays.length)}
        </Text>
      )}

      {asksChristmasBreak && (
        <View style={styles.christmasSection} testID="onboarding-christmas-break">
          <Text variant="h2" color={colors.text.primary}>
            Does team training stop over Christmas?
          </Text>
          <View style={styles.answerRow}>
            <SelectableTile
              isSelected={stopsOverChristmas === true}
              onPress={() => setStopsOverChristmas(true)}
              disabled={saving}
              accessibilityLabel="Yes, team training stops over Christmas"
            >
              <Text variant="bodyEmphasis">Yes</Text>
            </SelectableTile>
            <SelectableTile
              isSelected={stopsOverChristmas === false}
              onPress={() => {
                setStopsOverChristmas(false);
                setLastTrainingDate(null);
                setReturnDate(null);
              }}
              disabled={saving}
              accessibilityLabel="No, team training continues over Christmas"
            >
              <Text variant="bodyEmphasis">No</Text>
            </SelectableTile>
          </View>

          {stopsOverChristmas === true && (
            <>
              <Text variant="bodyEmphasis" style={styles.dateHeading}>
                Last team training date
              </Text>
              <DateCalendarPicker
                onPick={(dateISO) => {
                  setLastTrainingDate(dateISO);
                  if (returnDate && returnDate <= dateISO) setReturnDate(null);
                }}
                minISO={`${christmasYear}-11-01`}
                maxISO={`${christmasYear}-12-31`}
                initialMonthISO={`${christmasYear}-12-01`}
                selectedISO={lastTrainingDate}
                testIDPrefix="onboarding-christmas-last-training"
              />
              {lastTrainingDate && (
                <>
                  <Text variant="bodyEmphasis" style={styles.dateHeading}>
                    Team training return date
                  </Text>
                  <DateCalendarPicker
                    onPick={setReturnDate}
                    minISO={addDaysISO(lastTrainingDate, 1)}
                    maxISO={`${christmasYear + 1}-03-31`}
                    initialMonthISO={`${christmasYear + 1}-01-01`}
                    selectedISO={returnDate}
                    testIDPrefix="onboarding-christmas-return"
                  />
                </>
              )}
            </>
          )}
        </View>
      )}
    </OnboardingLayout>
  );
};

/**
 * Load-aware feedback copy.
 * Neutral at 1 ("1 team session"), confident at 2 ("solid load"),
 * honest warning at 3+ ("higher fatigue week") so the athlete sees the
 * stakes of each selection without being preachy.
 */
function feedbackForCount(count: number): string {
  if (count === 1) return '1 team session';
  if (count === 2) return '2 team sessions - solid load';
  return `${count} team sessions - higher fatigue week`;
}

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
    lineHeight: 20,
  },
  selectedCount: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  noTeamTraining: {
    marginTop: spacing.lg,
  },
  christmasSection: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  answerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateHeading: {
    marginTop: spacing.md,
  },
});
