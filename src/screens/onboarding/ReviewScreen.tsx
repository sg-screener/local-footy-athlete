import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { spacing, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { DayOfWeek } from '../../types/domain';
import { headingXL } from '../../components/onboarding/onboardingStyles';

// Canonical week order. Used to sort any athlete-facing day list so the
// review reads Mon → Sun regardless of selection order.
const DAY_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const sortDays = (days: DayOfWeek[]): DayOfWeek[] =>
  [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

type ReviewScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Review'
>;

export const ReviewScreen: React.FC<ReviewScreenProps> = ({ navigation }) => {
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Review');
  const onboardingData = useProfileStore((state) => state.onboardingData);

  const handleGenerateProgram = () => {
    navigation.navigate('Complete' as any);
  };

  const handleEdit = (screen: keyof OnboardingStackParamList) => {
    navigation.navigate(screen as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ paddingVertical: 4, paddingRight: 16 }}
          >
            <Text variant="bodySmallEmphasis" color={colors.text.secondary}>
              {'<'} Back
            </Text>
          </Pressable>
          <Text variant="caption" color={colors.text.tertiary}>
            {stepLabel}
          </Text>
        </View>

        {/* Progress */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(progressPercent, 2)}%` },
            ]}
          />
        </View>

        {/* Scrollable content */}
        <View style={styles.scrollWrapper}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text
              variant="h1"
              color={colors.text.primary}
              style={{ ...headingXL, marginBottom: 8 }}
            >
              Review Your Profile
            </Text>
            <Text
              variant="bodySmall"
              color={colors.text.secondary}
              style={{ marginBottom: 32, lineHeight: 20 }}
            >
              Everything looks good? Let's generate your program.
            </Text>

            <ReviewSection title="About You" isFirst>
              <ReviewCard
                title="Position"
                value={onboardingData.position || 'Not selected'}
                onEdit={() => handleEdit('Position')}
              />
              <ReviewCard
                title="Motivation"
                value={onboardingData.motivation || 'Not provided'}
                onEdit={() => handleEdit('Motivation')}
              />
            </ReviewSection>

            <ReviewSection title="Body">
              <ReviewCard
                title="Height"
                value={
                  onboardingData.heightCm
                    ? `${onboardingData.heightCm} cm`
                    : 'Not provided'
                }
                onEdit={() => handleEdit('BodyMeasurements')}
              />
              <ReviewCard
                title="Weight"
                value={
                  onboardingData.weightKg
                    ? `${onboardingData.weightKg} kg`
                    : 'Not provided'
                }
                onEdit={() => handleEdit('BodyMeasurements')}
              />
            </ReviewSection>

            <ReviewSection title="Season">
              <ReviewCard
                title="Season Phase"
                value={onboardingData.seasonPhase || 'Not selected'}
                onEdit={() => handleEdit('SeasonPhase')}
              />
              {onboardingData.gameDay && (
                <ReviewCard
                  title="Game Day"
                  value={onboardingData.gameDay}
                  onEdit={() => handleEdit('GameDay')}
                />
              )}
              {onboardingData.teamTrainingDaysPerWeek && (
                <ReviewCard
                  title="Team Training"
                  value={`${onboardingData.teamTrainingDaysPerWeek} days per week`}
                  onEdit={() => handleEdit('TeamTrainingDays')}
                />
              )}
            </ReviewSection>

            <ReviewSection title="Training">
              <ReviewCard
                title="Days Per Week"
                value={
                  onboardingData.trainingDaysPerWeek
                    ? `${onboardingData.trainingDaysPerWeek} days per week`
                    : 'Not selected'
                }
                onEdit={() => handleEdit('TrainingCommitment')}
              />
              {onboardingData.preferredTrainingDays &&
                onboardingData.preferredTrainingDays.length > 0 && (
                  <ReviewCard
                    title="Preferred Days"
                    value={sortDays(onboardingData.preferredTrainingDays).join(', ')}
                    onEdit={() => handleEdit('PreferredTrainingDays')}
                  />
                )}
              <ReviewCard
                title="Session Duration"
                value={
                  onboardingData.sessionDurationMinutes
                    ? `${onboardingData.sessionDurationMinutes} min`
                    : 'Not selected'
                }
                onEdit={() => handleEdit('SessionDuration')}
              />
            </ReviewSection>

            <ReviewSection title="Physical">
              <ReviewCard
                title="Experience"
                value={onboardingData.experienceLevel || 'Not selected'}
                onEdit={() => handleEdit('GymExperience')}
              />
              {onboardingData.squatStrength && (
                <ReviewCard
                  title="Squat Strength"
                  value={onboardingData.squatStrength}
                  onEdit={() => handleEdit('SquatStrength')}
                />
              )}
              {onboardingData.benchStrength && (
                <ReviewCard
                  title="Bench Strength"
                  value={onboardingData.benchStrength}
                  onEdit={() => handleEdit('BenchStrength')}
                />
              )}
              <ReviewCard
                title="Conditioning"
                value={onboardingData.conditioningLevel || 'Not selected'}
                onEdit={() => handleEdit('ConditioningLevel')}
              />
              <ReviewCard
                title="Sprint Exposure"
                value={onboardingData.sprintExposure || 'Not selected'}
                onEdit={() => handleEdit('SprintExposure')}
              />
              <ReviewCard
                title="Recent Training Load"
                value={onboardingData.recentTrainingLoad || 'Not selected'}
                onEdit={() => handleEdit('RecentTrainingLoad')}
              />
            </ReviewSection>

            <ReviewSection title="Health">
              <ReviewCard
                title="Injuries"
                value={
                  onboardingData.injuries &&
                  onboardingData.injuries.length > 0
                    ? onboardingData.injuries
                        .map((inj) => `${inj.bodyArea}: ${inj.description}`)
                        .join('\n')
                    : 'None reported'
                }
                onEdit={() => handleEdit('Injuries')}
              />
            </ReviewSection>

          </ScrollView>
        </View>

        {/* Fixed bottom CTA */}
        <View style={styles.footer}>
          <Button
            title="Generate My Program"
            onPress={handleGenerateProgram}
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

/* ── Sub-components ── */

interface ReviewSectionProps {
  title: string;
  children: React.ReactNode;
  /** First section sits flush with the intro copy — no top margin. */
  isFirst?: boolean;
}

// Section spacing is the only thing standardised here: 24 above (except
// for the first section), 10 between header and card stack. Card layout,
// colours, and inner gap (12) are unchanged.
const ReviewSection: React.FC<ReviewSectionProps> = ({ title, children, isFirst }) => (
  <View style={{ marginTop: isFirst ? 0 : 24 }}>
    <Text
      variant="h4"
      color={colors.accent.lime}
      style={{ marginBottom: 10, fontWeight: '700' }}
    >
      {title}
    </Text>
    <View style={{ gap: 12 }}>{children}</View>
  </View>
);

interface ReviewCardProps {
  title: string;
  value: string;
  onEdit: () => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ title, value, onEdit }) => (
  <View style={[styles.reviewCard, shadows.xs]}>
    <View style={{ flex: 1 }}>
      {/* Label is intentionally de-emphasised (opacity 0.6) so the value
          reads as the primary content of the card. */}
      <Text
        variant="caption"
        color={colors.text.secondary}
        style={{ marginBottom: 4, opacity: 0.6 }}
      >
        {title}
      </Text>
      <Text
        variant="bodyEmphasis"
        color={colors.text.primary}
        style={{ fontWeight: '600' }}
      >
        {value}
      </Text>
    </View>
    <Pressable
      onPress={onEdit}
      style={{ paddingVertical: 8, paddingHorizontal: 12 }}
    >
      <Text
        variant="bodySmall"
        color={colors.accent.lime}
        style={{ fontWeight: '600' }}
      >
        Edit
      </Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surface.tertiary,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.lime,
    borderRadius: 2,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  reviewCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
