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
import { OnboardingContinueButton } from '../../components/onboarding/OnboardingLayout';
import { colors } from '../../theme/colors';
import { spacing, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingInjury } from '../../types/domain';
import {
  assessOnboardingCompleteness,
  onboardingIncompleteMessage,
} from '../../utils/onboardingCompleteness';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import { classifyBibleInjurySeverity } from '../../rules/injurySeverityBands';
import {
  buildReviewSections,
  type ReviewRowData,
} from './reviewRows';

type ReviewScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Review'
>;

export const ReviewScreen: React.FC<ReviewScreenProps> = ({ navigation }) => {
  const { progressPercent } = useOnboardingProgress('Review');
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const insets = useSafeAreaInsets();

  // Refuse rather than generate around a gap. Naming the missing answer and
  // sending the athlete to the step that owns it is the only honest response —
  // a default that looks like an answer is worse than no answer, because they
  // cannot tell it is wrong.
  const completeness = assessOnboardingCompleteness(onboardingData);

  const handleGenerateProgram = () => {
    if (!completeness.complete && completeness.firstIncompleteStep) {
      navigation.navigate(completeness.firstIncompleteStep as any);
      return;
    }
    navigation.navigate('Complete' as any);
  };

  const handleEdit = (screen: keyof OnboardingStackParamList) => {
    navigation.navigate(screen as any);
  };

  // Rows are DERIVED from the onboarding step registry, not hand-listed here —
  // hand-listing is what let the 2km time trial ship without a Review row at all
  // (Sam, device pass 2026-07-29). See `reviewRows`.
  const sections = buildReviewSections(onboardingData);

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

            {sections.map((section, index) => (
              <ReviewSection
                key={section.title}
                title={section.title}
                rows={section.rows}
                isFirst={index === 0}
                onEdit={handleEdit}
                // The Health card carries the injury detail beneath its row —
                // the row says how many, the detail says which.
                footer={section.title === 'Health' ? (
                  <InjuryDetail injuries={onboardingData.injuries} />
                ) : null}
              />
            ))}
          </ScrollView>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {completeness.complete ? null : (
            <Text
              variant="bodySmall"
              color={colors.text.tertiary}
              align="center"
              style={styles.footerHelper}
            >
              {onboardingIncompleteMessage(completeness)}
            </Text>
          )}
          <OnboardingContinueButton
            label={completeness.complete
              ? 'Generate My Program'
              : `Add ${completeness.missingSteps[0].answerLabel}`}
            onPress={handleGenerateProgram}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

interface ReviewSectionProps {
  title: string;
  rows: readonly ReviewRowData[];
  isFirst?: boolean;
  onEdit: (screen: keyof OnboardingStackParamList) => void;
  footer?: React.ReactNode;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({
  title, rows, isFirst, onEdit, footer,
}) => (
  <View style={[styles.section, isFirst && styles.sectionFirst]}>
    <Text variant="h4" color={colors.accent.lime} style={styles.sectionTitle}>
      {title}
    </Text>
    <View style={[styles.sectionCard, shadows.xs]}>
      {rows.map((row, index) => (
        <React.Fragment key={`${row.label}-${index}`}>
          <ReviewRow
            step={row.step}
            label={row.label}
            value={row.value}
            // A row names the step that owns its answer; turning that into
            // navigation is the only thing this screen knows that the row owner
            // does not.
            onEdit={() => onEdit(row.step as keyof OnboardingStackParamList)}
          />
          {index < rows.length - 1 ? <View style={styles.divider} /> : null}
        </React.Fragment>
      ))}
      {footer}
    </View>
  </View>
);

const ReviewRow: React.FC<{
  step: ReviewRowData['step'];
  label: string;
  value: string;
  onEdit: () => void;
}> = ({ step, label, value, onEdit }) => (
  <View style={styles.reviewRow}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text testID={`onboarding-review-${step}-value`} style={styles.rowValue}>{value}</Text>
    <Pressable
      testID={`onboarding-review-${step}-edit`}
      onPress={onEdit}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.editButton}
    >
      <Text style={styles.editText}>Edit</Text>
    </Pressable>
  </View>
);

const InjuryDetail: React.FC<{ injuries?: OnboardingInjury[] }> = ({ injuries }) => {
  if (!injuries || injuries.length === 0) return null;
  return (
    <>
      <View style={styles.divider} />
      <View style={styles.injuryList}>
        {injuries.map((injury, index) => (
          <InjurySummary key={`${injury.bodyArea}-${index}`} injury={injury} />
        ))}
      </View>
    </>
  );
};

const InjurySummary: React.FC<{ injury: OnboardingInjury }> = ({ injury }) => (
  <View style={styles.injurySummary}>
    <Text style={styles.injuryTitle}>{injury.bodyArea}</Text>
    {injury.severityScore || injury.severity ? (
      <SummaryLine
        label="Severity"
        value={injury.severityScore
          ? classifyBibleInjurySeverity(injury.severityScore).label
          : injury.severity ?? ''}
      />
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
  footerHelper: {
    marginBottom: 10,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.surface.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
