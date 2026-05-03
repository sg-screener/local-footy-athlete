import React, { useState, useCallback } from 'react';
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
import { ExperienceLevel } from '../../types/domain';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type GymExperienceScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'GymExperience'
>;

const EXPERIENCE_OPTIONS: { id: ExperienceLevel; title: string; subtitle: string }[] = [
  // `id` is the persisted ExperienceLevel value AND gates navigation
  // (see handleSelect: 'Complete beginner' routes to a different next
  // screen). Do NOT rename ids when refreshing copy — only the
  // athlete-facing `title` / `subtitle` should change.
  {
    id: 'Complete beginner',
    title: 'NEW TO TRAINING',
    subtitle: "Haven't done much structured gym work",
  },
  {
    id: '1-2 years',
    title: 'BUILDING',
    subtitle: 'Some experience, still learning',
  },
  {
    id: '2-5 years',
    title: 'CONSISTENT',
    subtitle: 'Train regularly and handle solid loads',
  },
  {
    id: '5+ years',
    title: 'ADVANCED',
    subtitle: 'High training loads, push hard consistently',
  },
];

export const GymExperienceScreen: React.FC<GymExperienceScreenProps> = ({
  navigation,
}) => {
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(
    null
  );
  const { label: stepLabel, progressPercent } = useOnboardingProgress('GymExperience');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((exp: ExperienceLevel) => {
    setSelectedExperience(exp);
    updateOnboardingData({ experienceLevel: exp });

    setTimeout(() => {
      if (exp === 'Complete beginner') {
        navigation.navigate('ConditioningLevel');
      } else {
        navigation.navigate('SquatStrength');
      }
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
      <View style={styles.section}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          What's your training experience?
        </Text>

        <View style={styles.cardsContainer}>
          {EXPERIENCE_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={({ pressed }) => [
                styles.card,
                selectedExperience === option.id && styles.cardSelected,
                selectedExperience === option.id ? styles.cardSelectedShadow : styles.cardShadow,
                pressed && selectedExperience !== option.id && styles.cardPressed,
              ]}
              onPress={() => handleSelect(option.id)}
            >
              <View style={styles.cardContent}>
                <Text
                  variant="bodyEmphasis"
                  color={colors.text.primary}
                  style={styles.cardLabel}
                >
                  {option.title}
                </Text>
                <Text
                  variant="caption"
                  color={colors.text.tertiary}
                  style={styles.cardDescription}
                >
                  {option.subtitle}
                </Text>
              </View>
              <View
                style={[
                  styles.radioIndicator,
                  selectedExperience === option.id && styles.radioSelected,
                ]}
              >
                {selectedExperience === option.id && (
                  <View style={styles.radioInnerCircle} />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  // The title IS the entire heading block on this screen (no subtitle), so
  // its marginBottom doubles as the heading-to-content gap. Bumped from 8
  // to 20 so the question and the first option tile aren't crowded —
  // gives the screen room to breathe and clarifies the question/answer
  // hierarchy. If a subtitle ever lands here, move this spacing onto the
  // subtitle (i.e. apply to whichever element is last in the heading
  // block) so the gap stays AFTER the full block, not in the middle.
  title: {
    ...headingXL,
    marginBottom: 20,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },
  cardShadow: {
    ...shadows.xs,
  },
  cardSelectedShadow: {
    ...shadows.accentShadow,
  },
  cardPressed: {
    backgroundColor: colors.surface.tertiary,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontWeight: '600',
  },
  cardDescription: {
    marginTop: 4,
  },
  radioIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral.gray600,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioSelected: {
    borderColor: colors.accent.lime,
  },
  radioInnerCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent.lime,
  },
});
