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
import { colors } from '../../theme/colors';
import { spacing, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { validateOnboardingMeasurement } from '../../data/onboardingNumericBounds';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { useRefusalOnContinue } from '../../hooks/useRefusalOnContinue';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type BodyMeasurementsScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'BodyMeasurements'
>;

export const BodyMeasurementsScreen: React.FC<BodyMeasurementsScreenProps> = ({
  navigation,
}) => {
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightFocused, setHeightFocused] = useState(false);
  const [weightFocused, setWeightFocused] = useState(false);
  const heightInputRef = useRef<TextInput>(null);
  const weightInputRef = useRef<TextInput>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('BodyMeasurements');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  // Sam's ruled ranges (2026-07-28). The numbers live in
  // `onboardingNumericBounds` and are NOT restated here — one owner, so a change
  // to the ruling cannot leave a stale copy behind on this screen.
  //
  // An out-of-range answer is RE-ASKED, never clamped. Clamping would substitute
  // the app's number for the athlete's and carry on as though they had agreed;
  // bodyweight is the first term of the anchor chain, so that number then
  // prescribes every load in the app.
  //
  // An EMPTY box is `null` — unanswered, which is not the same as refused. The
  // difference is what keeps Continue disabled for absence while leaving it
  // pressable for a refusal (see `useRefusalOnContinue`).
  const validations = {
    heightCm: heightCm.trim()
      ? validateOnboardingMeasurement('heightCm', parseFloat(heightCm))
      : null,
    weightKg: weightKg.trim()
      ? validateOnboardingMeasurement('weightKg', parseFloat(weightKg))
      : null,
  };

  // WHEN the refusal is spoken is not this screen's decision (Sam, device pass
  // 2026-07-29). Validating on every keystroke told the athlete that "9" was a
  // bad weight while they were still typing "90".
  const { refusals, continueDisabled, onAnswerEdited, attemptContinue } =
    useRefusalOnContinue(validations);

  const handleContinue = () => {
    if (!attemptContinue()) return;
    void commitAndAdvance({
      heightCm: parseFloat(heightCm),
      weightKg: parseFloat(weightKg),
    }, () => navigation.navigate('Position'));
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={continueDisabled}
    >
      {/* Question Title */}
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          What's your height and weight?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          So we can tailor your training
        </Text>
      </View>

      {/* Input Fields */}
      <View style={styles.inputsContainer}>
        <View style={styles.inputWrapper}>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.inputLabel}
          >
            Height
          </Text>
          <Pressable
            onPress={() => heightInputRef.current?.focus()}
            style={[
              styles.inputShell,
              heightFocused && styles.inputFocused,
            ]}
          >
            <MaterialCommunityIcons
              name="ruler"
              size={19}
              color={colors.text.tertiary}
            />
            <AppTextInput
              ref={heightInputRef}
              style={styles.input}
              placeholder="180"
              placeholderTextColor={colors.text.tertiary}
              value={heightCm}
              onChangeText={(text) => { setHeightCm(text); onAnswerEdited(); }}
              onFocus={() => setHeightFocused(true)}
              onBlur={() => setHeightFocused(false)}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>cm</Text>
          </Pressable>
          {refusals.heightCm ? (
            <Text
              variant="bodySmall"
              color={colors.status.error}
              style={styles.inputError}
            >
              {refusals.heightCm}
            </Text>
          ) : null}
        </View>

        <View style={styles.inputWrapper}>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.inputLabel}
          >
            Weight
          </Text>
          <Pressable
            onPress={() => weightInputRef.current?.focus()}
            style={[
              styles.inputShell,
              weightFocused && styles.inputFocused,
            ]}
          >
            <MaterialCommunityIcons
              name="kettlebell"
              size={19}
              color={colors.text.tertiary}
            />
            <AppTextInput
              ref={weightInputRef}
              style={styles.input}
              placeholder="80"
              placeholderTextColor={colors.text.tertiary}
              value={weightKg}
              onChangeText={(text) => { setWeightKg(text); onAnswerEdited(); }}
              onFocus={() => setWeightFocused(true)}
              onBlur={() => setWeightFocused(false)}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>kg</Text>
          </Pressable>
          {refusals.weightKg ? (
            <Text
              variant="bodySmall"
              color={colors.status.error}
              style={styles.inputError}
            >
              {refusals.weightKg}
            </Text>
          ) : null}
        </View>
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
});
