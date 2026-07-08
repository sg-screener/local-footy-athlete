import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing, shadows } from '../../theme/spacing';
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
  const heightInputRef = useRef<TextInput>(null);
  const weightInputRef = useRef<TextInput>(null);
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
            <TextInput
              ref={heightInputRef}
              style={styles.input}
              placeholder="180"
              placeholderTextColor={colors.text.tertiary}
              value={heightCm}
              onChangeText={setHeightCm}
              onFocus={() => setHeightFocused(true)}
              onBlur={() => setHeightFocused(false)}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>cm</Text>
          </Pressable>
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
            <TextInput
              ref={weightInputRef}
              style={styles.input}
              placeholder="80"
              placeholderTextColor={colors.text.tertiary}
              value={weightKg}
              onChangeText={setWeightKg}
              onFocus={() => setWeightFocused(true)}
              onBlur={() => setWeightFocused(false)}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>kg</Text>
          </Pressable>
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
