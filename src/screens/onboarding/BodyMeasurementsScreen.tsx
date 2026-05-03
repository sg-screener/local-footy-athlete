import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
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
  const { label: stepLabel, progressPercent } = useOnboardingProgress('BodyMeasurements');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const isValid =
    heightCm.trim() &&
    weightKg.trim() &&
    parseFloat(heightCm) > 0 &&
    parseFloat(weightKg) > 0;

  const handleContinue = () => {
    if (isValid) {
      updateOnboardingData({
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
      });
      navigation.navigate('Position');
    }
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
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
          <TextInput
            style={[
              styles.input,
              heightFocused && styles.inputFocused,
            ]}
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
            value={heightCm}
            onChangeText={setHeightCm}
            onFocus={() => setHeightFocused(true)}
            onBlur={() => setHeightFocused(false)}
            keyboardType="numeric"
          />
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.inputUnit}
          >
            cm
          </Text>
        </View>

        <View style={styles.inputWrapper}>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.inputLabel}
          >
            Weight
          </Text>
          <TextInput
            style={[
              styles.input,
              weightFocused && styles.inputFocused,
            ]}
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
            value={weightKg}
            onChangeText={setWeightKg}
            onFocus={() => setWeightFocused(true)}
            onBlur={() => setWeightFocused(false)}
            keyboardType="numeric"
          />
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.inputUnit}
          >
            kg
          </Text>
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
  inputsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    padding: 20,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputFocused: {
    borderColor: colors.accent.lime,
    ...shadows.xs,
  },
  inputUnit: {
    fontWeight: '500',
  },
});
