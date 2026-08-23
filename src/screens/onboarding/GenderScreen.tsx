import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { AthleteGender } from '../../types/domain';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import { GENDER_COPY } from '../../rules/onboardingGenderCopy';

type GenderScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Gender'
>;

/**
 * R-130 (Sam, 2026-08-23). His literal, signed words: the question is
 * `What is your gender?` and the two buttons are `Male` · `Female` — nothing
 * else on the screen, and every word comes through the signed-copy sheet
 * (`rules/onboardingGenderCopy.ts`), never a literal.
 *
 * Same shape as every other option step (per Sam, R-130a: *"the UI to keep
 * consistent style … it should match all the other steps"*): `OnboardingLayout`,
 * `SelectableTile`, commit-on-tap with the shared 250ms advance.
 */
const GENDER_OPTIONS: { id: AthleteGender; title: string }[] = [
  // `id` is the persisted AthleteGender value. Do NOT rename ids when
  // refreshing copy — only the athlete-facing `title` may change.
  { id: 'male', title: GENDER_COPY.male },
  { id: 'female', title: GENDER_COPY.female },
];

export const GenderScreen: React.FC<GenderScreenProps> = ({
  navigation,
}) => {
  const [selectedGender, setSelectedGender] = useState<AthleteGender | null>(
    null
  );
  const { progressPercent } = useOnboardingProgress('Gender');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const handleSelect = useCallback((gender: AthleteGender) => {
    setSelectedGender(gender);
    void commitAndAdvance({ gender }, () => {
      setTimeout(() => {
        navigation.navigate('BodyMeasurements');
      }, 250);
    });
  }, [navigation, commitAndAdvance]);

  return (
    <OnboardingLayout
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={() => {}}
      hideFooter
    >
      <View style={styles.section}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          {GENDER_COPY.question}
        </Text>

        <View style={styles.cardsContainer}>
          {GENDER_OPTIONS.map((option) => {
            const isSelected = selectedGender === option.id;
            return (
              <SelectableTile
                key={option.id}
                isSelected={isSelected}
                onPress={() => handleSelect(option.id)}
                style={styles.card}
              >
                <View style={styles.cardContent}>
                  <Text
                    variant="bodyEmphasis"
                    color={isSelected ? colors.text.primary : colors.text.secondary}
                    style={styles.cardLabel}
                  >
                    {option.title}
                  </Text>
                </View>
              </SelectableTile>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  // Same heading-to-content gap as GymExperienceScreen: the title is the whole
  // heading block (no subtitle), so its marginBottom is the gap.
  title: {
    ...headingXL,
    marginBottom: 20,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cardContent: {
    paddingRight: 28,
  },
  cardLabel: {
    fontWeight: '600',
  },
});
