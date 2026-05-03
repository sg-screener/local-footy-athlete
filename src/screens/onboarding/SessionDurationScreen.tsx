import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { SessionDuration } from '../../types/domain';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type SessionDurationScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'SessionDuration'
>;

const DURATION_OPTIONS: { label: string; value: SessionDuration }[] = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '75 min', value: 75 },
  { label: '90+ min', value: 90 },
];

export const SessionDurationScreen: React.FC<SessionDurationScreenProps> = ({
  navigation,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<SessionDuration | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('SessionDuration');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleContinue = () => {
    if (selectedDuration !== null) {
      updateOnboardingData({ sessionDurationMinutes: selectedDuration });
      navigation.navigate('GymExperience');
    }
  };

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={selectedDuration === null}
    >
      <View>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          How long can your training sessions usually be?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Select your typical session length
        </Text>

        <View style={styles.cardsContainer}>
          {DURATION_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.card,
                selectedDuration === option.value && styles.cardSelected,
                pressed && selectedDuration !== option.value && styles.cardPressed,
              ]}
              onPress={() => setSelectedDuration(option.value)}
            >
              <Text
                variant="bodyEmphasis"
                color={colors.text.primary}
                style={styles.cardLabel}
              >
                {option.label}
              </Text>

              {selectedDuration === option.value && (
                <View style={styles.radio}>
                  <View style={styles.radioInner} />
                </View>
              )}
              {selectedDuration !== option.value && (
                <View style={styles.radioEmpty} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  title: {
    ...headingXL,
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 20,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.xs,
  },
  cardSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
    ...shadows.accentShadow,
  },
  cardPressed: {
    backgroundColor: colors.surface.tertiary,
  },
  cardLabel: {
    fontWeight: '600',
    flex: 1,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accent.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent.lime,
  },
  radioEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral.gray600,
  },
});
