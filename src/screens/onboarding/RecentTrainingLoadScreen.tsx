import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { RecentTrainingLoad } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type RecentTrainingLoadScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'RecentTrainingLoad'
>;

const TRAINING_LOAD_OPTIONS: { id: RecentTrainingLoad; label: string; subtitle: string }[] = [
  {
    id: 'Hardly at all',
    label: 'HARDLY AT ALL',
    subtitle: '0-1 sessions per week',
  },
  {
    id: 'A bit',
    label: 'A BIT',
    subtitle: '2-3 sessions per week',
  },
  {
    id: 'Pretty consistent',
    label: 'PRETTY CONSISTENT',
    subtitle: '4-5 sessions per week',
  },
  {
    id: 'Very consistent',
    label: 'VERY CONSISTENT',
    subtitle: '6+ sessions per week',
  },
];

export const RecentTrainingLoadScreen: React.FC<RecentTrainingLoadScreenProps> = ({
  navigation,
}) => {
  const [selectedLoad, setSelectedLoad] = useState<RecentTrainingLoad | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('RecentTrainingLoad');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((load: RecentTrainingLoad) => {
    setSelectedLoad(load);
    updateOnboardingData({ recentTrainingLoad: load });
    setTimeout(() => {
      navigation.navigate('Injuries');
    }, 250);
  }, [navigation, updateOnboardingData]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={() => {}}
      hideFooter
    >
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          How often have you been training lately?
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {TRAINING_LOAD_OPTIONS.map((option) => {
          const isSelected = selectedLoad === option.id;
          return (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                !isSelected && pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(option.id)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: spacing.xl,
  },
  title: {
    ...headingXL,
    // no marginBottom needed — no subtext
  },
  cardsContainer: {
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
  },
  cardSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },
  cardPressed: {
    backgroundColor: colors.surface.tertiary,
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  optionSubtitle: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '400',
  },
});
