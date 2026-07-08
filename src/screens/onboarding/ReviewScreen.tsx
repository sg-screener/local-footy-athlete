import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { spacing, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import {
  BenchStrength,
  ConditioningLevel,
  DayOfWeek,
  ExperienceLevel,
  OnboardingInjury,
  RecentTrainingLoad,
  SprintExposure,
  SquatStrength,
  TeamTrainingDuration,
  TeamTrainingIntensity,
} from '../../types/domain';
import { roleBucketLabel } from '../../utils/roleBuckets';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type ReviewScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Review'
>;

type ReviewRowData = {
  label: string;
  value: string;
  onEdit: () => void;
};

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

const formatDays = (days?: DayOfWeek[]): string | null => {
  if (!days || days.length === 0) return null;
  return sortDays(days).join(', ');
};

const formatTeamDuration = (duration?: TeamTrainingDuration): string | null => {
  if (!duration) return null;
  const labels: Record<TeamTrainingDuration, string> = {
    '60 minutes': '60 min',
    '90 minutes': '90 min',
    '2 hours': '2 hrs',
  };
  return labels[duration];
};

const formatTeamIntensity = (intensity?: TeamTrainingIntensity): string | null => {
  if (!intensity) return null;
  return intensity === 'Very intense' ? 'Very hard' : intensity;
};

const formatTeamSessions = (
  duration?: TeamTrainingDuration,
  intensity?: TeamTrainingIntensity,
): string | null => {
  const parts = [
    formatTeamDuration(duration),
    formatTeamIntensity(intensity),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};

const formatExperience = (value?: ExperienceLevel): string => {
  if (!value) return 'Not selected';
  const labels: Record<ExperienceLevel, string> = {
    'Complete beginner': 'New to training',
    '1-2 years': 'Developing',
    '2-5 years': 'Consistent',
    '5+ years': 'Advanced',
  };
  return labels[value];
};

const formatSquatStrength = (value?: SquatStrength): string => {
  if (!value) return 'Not selected';
  const labels: Record<SquatStrength, string> = {
    "I don't squat": "I don't squat / not sure",
    'Less than bodyweight': 'Less than bodyweight',
    'Around bodyweight': 'Around bodyweight',
    '1.5x bodyweight': '1.5x bodyweight'.replace('x', '×'),
    '2x bodyweight+': '2x bodyweight+'.replace('x', '×'),
    'Not sure': "I don't squat / not sure",
  };
  return labels[value];
};

const formatBenchStrength = (value?: BenchStrength): string => {
  if (!value) return 'Not selected';
  const labels: Record<BenchStrength, string> = {
    "I don't bench": "I don't bench / not sure",
    'Less than bodyweight': 'Less than bodyweight',
    'Around bodyweight': 'Around bodyweight',
    '1.25x bodyweight': '1.25x bodyweight'.replace('x', '×'),
    '1.5x bodyweight+': '1.5x bodyweight+'.replace('x', '×'),
    'Not sure': "I don't bench / not sure",
  };
  return labels[value];
};

const formatConditioning = (value?: ConditioningLevel): string => {
  if (!value) return 'Not selected';
  const labels: Record<ConditioningLevel, string> = {
    Poor: 'Struggle early',
    Average: 'Fade late',
    Good: 'Solid',
    Elite: 'Very fit',
  };
  return labels[value];
};

const formatSprintWork = (value?: SprintExposure): string => {
  if (!value) return 'Not selected';
  const labels: Record<SprintExposure, string> = {
    'No sprint training': 'None',
    Occasionally: 'Occasional',
    '2+ times per week': 'Regular',
  };
  return labels[value];
};

const formatRecentTraining = (value?: RecentTrainingLoad): string => {
  if (!value) return 'Not selected';
  const labels: Record<RecentTrainingLoad, string> = {
    'Hardly at all': 'Hardly at all',
    'A bit': 'A bit',
    'Pretty consistent': 'Consistent',
    'Very consistent': 'Very consistent',
  };
  return labels[value];
};

const present = (value: string | null | undefined): string =>
  value && value.trim().length > 0 ? value : 'Not selected';

export const ReviewScreen: React.FC<ReviewScreenProps> = ({ navigation }) => {
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Review');
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const insets = useSafeAreaInsets();

  const handleGenerateProgram = () => {
    navigation.navigate('Complete' as any);
  };

  const handleEdit = (screen: keyof OnboardingStackParamList) => {
    navigation.navigate(screen as any);
  };

  const teamSessions = formatTeamSessions(
    onboardingData.teamTrainingDuration,
    onboardingData.teamTrainingIntensity,
  );
  const shouldShowTeamSessions =
    Boolean(teamSessions) ||
    Boolean(onboardingData.teamTrainingDaysPerWeek) ||
    Boolean(onboardingData.teamTrainingDays?.length);

  const aboutRows: ReviewRowData[] = [
    {
      label: 'Footy role',
      value: onboardingData.position ? roleBucketLabel(onboardingData.position) : 'Not provided',
      onEdit: () => handleEdit('Position'),
    },
    {
      label: 'Goals',
      value: present(onboardingData.motivation || onboardingData.goals?.join(', ')),
      onEdit: () => handleEdit('Motivation'),
    },
  ];

  const bodyRows: ReviewRowData[] = [
    {
      label: 'Height',
      value: onboardingData.heightCm ? `${onboardingData.heightCm} cm` : 'Not provided',
      onEdit: () => handleEdit('BodyMeasurements'),
    },
    {
      label: 'Weight',
      value: onboardingData.weightKg ? `${onboardingData.weightKg} kg` : 'Not provided',
      onEdit: () => handleEdit('BodyMeasurements'),
    },
  ];

  const seasonRows: ReviewRowData[] = [
    {
      label: 'Season Phase',
      value: present(onboardingData.seasonPhase),
      onEdit: () => handleEdit('SeasonPhase'),
    },
  ];

  if (onboardingData.gameDay) {
    seasonRows.push({
      label: 'Game Day',
      value: onboardingData.gameDay,
      onEdit: () => handleEdit('GameDay'),
    });
  }

  if (onboardingData.teamTrainingDaysPerWeek || onboardingData.teamTrainingDays?.length) {
    seasonRows.push({
      label: 'Team Training',
      value:
        formatDays(onboardingData.teamTrainingDays) ||
        `${onboardingData.teamTrainingDaysPerWeek} days per week`,
      onEdit: () => handleEdit('TeamTrainingDays'),
    });
  }

  if (shouldShowTeamSessions) {
    seasonRows.push({
      label: 'Team Sessions',
      value: teamSessions || 'Not selected',
      onEdit: () => handleEdit('TeamTrainingDuration'),
    });
  }

  const trainingRows: ReviewRowData[] = [
    {
      label: 'LFA Days',
      value: onboardingData.trainingDaysPerWeek
        ? `${onboardingData.trainingDaysPerWeek} days per week`
        : 'Not selected',
      onEdit: () => handleEdit('TrainingCommitment'),
    },
  ];

  const lfaDays = formatDays(onboardingData.preferredTrainingDays);
  if (lfaDays) {
    trainingRows.push({
      label: 'LFA Training Days',
      value: lfaDays,
      onEdit: () => handleEdit('PreferredTrainingDays'),
    });
  }

  if (onboardingData.sessionDurationMinutes) {
    trainingRows.push({
      label: 'Session Length',
      value: `${onboardingData.sessionDurationMinutes} min`,
      onEdit: () => handleEdit('SessionDuration'),
    });
  }

  const physicalRows: ReviewRowData[] = [
    {
      label: 'Training Experience',
      value: formatExperience(onboardingData.experienceLevel),
      onEdit: () => handleEdit('GymExperience'),
    },
    {
      label: 'Squat Strength',
      value: formatSquatStrength(onboardingData.squatStrength),
      onEdit: () => handleEdit('SquatStrength'),
    },
    {
      label: 'Bench Strength',
      value: formatBenchStrength(onboardingData.benchStrength),
      onEdit: () => handleEdit('BenchStrength'),
    },
    {
      label: 'Conditioning',
      value: formatConditioning(onboardingData.conditioningLevel),
      onEdit: () => handleEdit('ConditioningLevel'),
    },
    {
      label: 'Sprint Work',
      value: formatSprintWork(onboardingData.sprintExposure),
      onEdit: () => handleEdit('SprintExposure'),
    },
    {
      label: 'Recent Training',
      value: formatRecentTraining(onboardingData.recentTrainingLoad),
      onEdit: () => handleEdit('RecentTrainingLoad'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backButton}
          >
            <Text variant="bodySmallEmphasis" color={colors.text.secondary}>
              {'<'} Back
            </Text>
          </Pressable>
          <Text variant="caption" color={colors.text.tertiary}>
            {stepLabel}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(progressPercent, 2)}%` },
            ]}
          />
        </View>

        <View style={styles.scrollWrapper}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 128 + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text
              variant="h1"
              color={colors.text.primary}
              style={styles.title}
            >
              Review Your Profile
            </Text>
            <Text
              variant="bodySmall"
              color={colors.text.secondary}
              style={styles.subtitle}
            >
              Everything looks good? Let's generate your program.
            </Text>

            <ReviewSection title="About You" rows={aboutRows} isFirst />
            <ReviewSection title="Body" rows={bodyRows} />
            <ReviewSection title="Season" rows={seasonRows} />
            <ReviewSection title="Training" rows={trainingRows} />
            <ReviewSection title="Physical" rows={physicalRows} />
            <HealthSection
              injuries={onboardingData.injuries}
              onEdit={() => handleEdit('Injuries')}
            />
          </ScrollView>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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

interface ReviewSectionProps {
  title: string;
  rows: ReviewRowData[];
  isFirst?: boolean;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({ title, rows, isFirst }) => (
  <View style={[styles.section, isFirst && styles.sectionFirst]}>
    <Text variant="h4" color={colors.accent.lime} style={styles.sectionTitle}>
      {title}
    </Text>
    <View style={[styles.sectionCard, shadows.xs]}>
      {rows.map((row, index) => (
        <React.Fragment key={`${row.label}-${index}`}>
          <ReviewRow {...row} />
          {index < rows.length - 1 ? <View style={styles.divider} /> : null}
        </React.Fragment>
      ))}
    </View>
  </View>
);

const ReviewRow: React.FC<ReviewRowData> = ({ label, value, onEdit }) => (
  <View style={styles.reviewRow}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
    <Pressable
      onPress={onEdit}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.editButton}
    >
      <Text style={styles.editText}>Edit</Text>
    </Pressable>
  </View>
);

const HealthSection: React.FC<{
  injuries?: OnboardingInjury[];
  onEdit: () => void;
}> = ({ injuries, onEdit }) => {
  const hasInjuries = Boolean(injuries && injuries.length > 0);
  return (
    <View style={styles.section}>
      <Text variant="h4" color={colors.accent.lime} style={styles.sectionTitle}>
        Health
      </Text>
      <View style={[styles.sectionCard, shadows.xs]}>
        <ReviewRow
          label="Injuries"
          value={hasInjuries ? `${injuries?.length} reported` : 'No current issues'}
          onEdit={onEdit}
        />
        {hasInjuries ? (
          <>
            <View style={styles.divider} />
            <View style={styles.injuryList}>
              {injuries?.map((injury, index) => (
                <InjurySummary
                  key={`${injury.bodyArea}-${index}`}
                  injury={injury}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
};

const InjurySummary: React.FC<{ injury: OnboardingInjury }> = ({ injury }) => (
  <View style={styles.injurySummary}>
    <Text style={styles.injuryTitle}>{injury.bodyArea}</Text>
    {injury.severity ? (
      <SummaryLine label="Severity" value={injury.severity} />
    ) : null}
    {injury.movementTriggers && injury.movementTriggers.length > 0 ? (
      <SummaryLine label="Triggers" value={injury.movementTriggers.join(', ')} />
    ) : null}
    {injury.notes ? (
      <SummaryLine label="Note" value={injury.notes} />
    ) : null}
  </View>
);

const SummaryLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Text style={styles.summaryLine}>
    <Text style={styles.summaryLabel}>{label}: </Text>
    {value}
  </Text>
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
  backButton: {
    paddingVertical: 4,
    paddingRight: 16,
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
  },
  title: {
    ...headingXL,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 28,
    lineHeight: 20,
  },
  section: {
    marginTop: 22,
  },
  sectionFirst: {
    marginTop: 0,
  },
  sectionTitle: {
    marginBottom: 10,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    overflow: 'hidden',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: {
    width: 104,
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  rowValue: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  editButton: {
    paddingLeft: 6,
    paddingVertical: 1,
  },
  editText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 16,
  },
  injuryList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  injurySummary: {
    gap: 4,
  },
  injuryTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  summaryLine: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  summaryLabel: {
    color: colors.text.tertiary,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.surface.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
