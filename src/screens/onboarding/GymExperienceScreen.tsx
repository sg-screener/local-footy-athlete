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
import { ExperienceLevel } from '../../types/domain';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import {
  answerCardSubtitle,
  answerCardTitle,
  headingXL,
} from '../../components/onboarding/onboardingStyles';

type GymExperienceScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'GymExperience'
>;

/**
 * THE YEARS BELONG ON THE TILE — Sam, 2026-08-27: *"just add the years to the
 * tiles i.e. advance 5+ years then subtitle"*.
 *
 * The year range was ALWAYS the stored answer and was never shown here — see
 * the initial build, where these tiles already read NEW TO TRAINING /
 * BUILDING / CONSISTENT / ADVANCED. So the Profile page (which shows the stored
 * value) said "5+ years" while this screen said "Advanced": one answer, two
 * names. The tile now says both, and the beginner tile says only its title,
 * because its stored value is not a span of years.
 */
const EXPERIENCE_OPTIONS: { id: ExperienceLevel; title: string; subtitle: string }[] = [
  // `id` is the persisted ExperienceLevel value AND gates navigation
  // (see handleSelect: 'Complete beginner' routes to a different next
  // screen). Do NOT rename ids when refreshing copy — only the
  // athlete-facing `title` / `subtitle` should change.
  {
    id: 'Complete beginner',
    title: 'New to training',
    subtitle: "Haven't done much structured gym work",
  },
  {
    id: '1-2 years',
    title: 'Developing',
    subtitle: 'Some gym experience, still learning',
  },
  {
    id: '2-5 years',
    title: 'Consistent',
    subtitle: 'Train regularly and handle solid loads',
  },
  {
    id: '5+ years',
    title: 'Advanced',
    subtitle: 'High training loads, push hard consistently',
  },
];

/**
 * "Advanced · 5+ years". The years come from the STORED id, so the two can
 * never drift; the beginner tile keeps its title alone, because its id is not a
 * span of years and "New to training · Complete beginner" says one thing twice.
 */
function experienceTileTitle(option: { id: ExperienceLevel; title: string }): string {
  return option.id === 'Complete beginner' ? option.title : `${option.title} · ${option.id}`;
}

export const GymExperienceScreen: React.FC<GymExperienceScreenProps> = ({
  navigation,
}) => {
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(
    null
  );
  const { label: stepLabel, progressPercent } = useOnboardingProgress('GymExperience');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const handleSelect = useCallback((exp: ExperienceLevel) => {
    setSelectedExperience(exp);
    void commitAndAdvance({ experienceLevel: exp }, () => {
      setTimeout(() => {
        if (exp === 'Complete beginner') {
          navigation.navigate('TwoKmTimeTrial');
        } else {
          navigation.navigate('SquatStrength');
        }
      }, 250);
    });
  }, [navigation, commitAndAdvance]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
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
          What's your training experience?
        </Text>

        <View style={styles.cardsContainer}>
          {EXPERIENCE_OPTIONS.map((option) => {
            const isSelected = selectedExperience === option.id;
            return (
              <SelectableTile
                key={option.id}
                isSelected={isSelected}
                onPress={() => handleSelect(option.id)}
                style={styles.card}
              >
                <View style={styles.cardContent}>
                  <Text
                    color={isSelected ? colors.text.primary : colors.text.secondary}
                    style={styles.cardLabel}
                  >
                    {experienceTileTitle(option)}
                  </Text>
                  <Text
                    color={isSelected ? colors.text.secondary : colors.text.tertiary}
                    style={styles.cardDescription}
                  >
                    {option.subtitle}
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
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cardContent: {
    paddingRight: 28,
  },
  cardLabel: {
    ...answerCardTitle,
  },
  cardDescription: {
    ...answerCardSubtitle,
    marginTop: 4,
  },
});
