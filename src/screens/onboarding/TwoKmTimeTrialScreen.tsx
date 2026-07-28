import React, { useRef, useState } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '../../components/common/Text';
import { SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { recordTwoKmTime, validateTwoKmTime } from '../../data/twoKmTimeTrial';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import { todayISOLocal } from '../../utils/appDate';

type TwoKmTimeTrialScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'TwoKmTimeTrial'
>;

/**
 * The 2km time trial (D14) — the input every %MAS prescription hangs off.
 *
 * Sam ruled a KEYPAD here rather than D14's min/sec roller (2026-07-29). A
 * roller spanning exactly the accepted range would make a bad time
 * unrepresentable, which is normally the stronger design — but it would be a
 * new UI component outside the keyboard contract gate, and the ingress has to
 * validate regardless because coach chat is a fourth, unconstrained producer.
 * So this screen is the ruling's politest face, not the ruling.
 *
 * The ruled numbers are NOT restated here. The screen asks
 * `validateTwoKmTime` what is acceptable and shows whatever sentence it gets
 * back, so a change to the ruling cannot leave a stale copy behind on a screen.
 */
export const TwoKmTimeTrialScreen: React.FC<TwoKmTimeTrialScreenProps> = ({
  navigation,
}) => {
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [minutesFocused, setMinutesFocused] = useState(false);
  const [secondsFocused, setSecondsFocused] = useState(false);
  const minutesInputRef = useRef<TextInput>(null);
  const secondsInputRef = useRef<TextInput>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('TwoKmTimeTrial');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const started = minutes.trim() !== '' || seconds.trim() !== '';
  // A blank seconds box means ":00", which is how people say a round time.
  // A blank MINUTES box is not a time at all, and NaN is refused by the bound.
  const totalSeconds = minutes.trim() === ''
    ? NaN
    : parseInt(minutes, 10) * 60 + (seconds.trim() === '' ? 0 : parseInt(seconds, 10));

  const validation = started ? validateTwoKmTime(totalSeconds) : null;
  const error = validation && !validation.ok ? validation.message : null;
  const canContinue = Boolean(validation?.ok);

  const commit = (value: number | null) => {
    const result = recordTwoKmTime(value, 'onboarding', todayISOLocal());
    // The ingress owns the refusal. If it says no, the screen shows what it
    // said and commits nothing — it never substitutes a value of its own.
    if (!result.ok) return;
    void commitAndAdvance(
      { twoKmTimeTrial: result.answer },
      () => navigation.navigate('ConditioningLevel'),
    );
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={() => commit(totalSeconds)}
      continueDisabled={!canContinue}
    >
      <View style={styles.titleSection}>
        <Text variant="h1" color={colors.text.primary} style={styles.title}>
          What's your recent 2km time?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Sets your running paces. Skip it and we'll estimate.
        </Text>
      </View>

      <View style={styles.inputsContainer}>
        <View style={styles.inputWrapper}>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.inputLabel}
          >
            Minutes
          </Text>
          <Pressable
            onPress={() => minutesInputRef.current?.focus()}
            style={[styles.inputShell, minutesFocused && styles.inputFocused]}
          >
            <MaterialCommunityIcons
              name="timer-outline"
              size={19}
              color={colors.text.tertiary}
            />
            <AppTextInput
              ref={minutesInputRef}
              style={styles.input}
              placeholder="7"
              placeholderTextColor={colors.text.tertiary}
              value={minutes}
              onChangeText={setMinutes}
              onFocus={() => setMinutesFocused(true)}
              onBlur={() => setMinutesFocused(false)}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>min</Text>
          </Pressable>
        </View>

        <View style={styles.inputWrapper}>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.inputLabel}
          >
            Seconds
          </Text>
          <Pressable
            onPress={() => secondsInputRef.current?.focus()}
            style={[styles.inputShell, secondsFocused && styles.inputFocused]}
          >
            <AppTextInput
              ref={secondsInputRef}
              style={styles.input}
              placeholder="15"
              placeholderTextColor={colors.text.tertiary}
              value={seconds}
              onChangeText={setSeconds}
              onFocus={() => setSecondsFocused(true)}
              onBlur={() => setSecondsFocused(false)}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>sec</Text>
          </Pressable>
        </View>
      </View>

      {/* The re-ask. One sentence, no suggested value — a suggestion is a clamp
          wearing a question mark. */}
      {error ? (
        <Text
          variant="bodySmall"
          color={colors.status.error}
          style={styles.inputError}
        >
          {error}
        </Text>
      ) : null}

      {/* "Haven't tested" is an ANSWER, worded as one. It commits
          `seconds: null` through the same ingress and moves on. */}
      <View style={styles.skipContainer}>
        <SelectableTile isSelected={false} onPress={() => commit(null)}>
          <Text
            variant="bodyEmphasis"
            color={colors.text.secondary}
            style={styles.skipLabel}
          >
            I haven't tested it
          </Text>
        </SelectableTile>
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: 32,
  },
  title: {
    ...headingXL,
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 20,
  },
  inputError: {
    marginTop: 6,
    lineHeight: 18,
  },
  inputsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    minWidth: 0,
  },
  inputLabel: {
    marginBottom: spacing.sm,
  },
  inputShell: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
    paddingLeft: 10,
    paddingRight: 8,
  },
  inputFocused: {
    borderColor: colors.accent.lime,
    ...shadows.xs,
  },
  inputUnit: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  skipContainer: {
    marginTop: spacing.lg,
  },
  skipLabel: {
    textAlign: 'center',
  },
});
