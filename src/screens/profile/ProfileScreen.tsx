import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useProfileStore } from '../../store/profileStore';
import {
  useCoachUpdatesStore,
  type ActiveConstraint,
} from '../../store/coachUpdatesStore';
import {
  clearCoachAdjustments,
  clearCoachChat,
  resetProgramAndOnboarding,
} from '../../utils/resetCoach';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { buildMailto, getClientEnvConfig } from '../../config/env';
import { logger } from '../../utils/logger';

function capitalise(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatList(values?: readonly string[]): string | null {
  if (!values || values.length === 0) return null;
  return values.join(', ');
}

function formatCoachIssue(c: ActiveConstraint): string | null {
  if (c.status === 'resolved') return null;
  if (c.type === 'injury') {
    const part = c.bodyPart === 'unknown' ? 'Injury' : capitalise(c.bodyPart);
    return `${part} pain — ${c.severity}/10`;
  }
  if (c.type === 'fatigue') return `Fatigue — ${c.severity}/10`;
  if (c.type === 'soreness') {
    const part = c.bodyPart && c.bodyPart !== 'unknown' ? `${capitalise(c.bodyPart)} soreness` : 'Soreness';
    return `${part} — ${c.severity}/10`;
  }
  if (c.type === 'schedule') return `Busy week — ${c.severity}/10`;
  if (c.type === 'missed_session') return c.sessionName ? `Missed ${c.sessionName}` : 'Missed session';
  return null;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const activeConstraints = useCoachUpdatesStore((s) => s.activeConstraints);
  const env = getClientEnvConfig();

  // Render-time proof — confirms the live Profile tab actually mounts
  // the Coach adjustments section. Pair with [reset-ui] press logs below.
  useEffect(() => {
    logger.debug('[profile] coach_adjustments_section_rendered');
  }, []);

  // ─── Reset handlers ────────────────────────────────────────────────
  const onClearCoachAdjustments = () => {
    logger.debug('[reset-ui] clear_coach_adjustments_pressed');
    Alert.alert(
      'Clear coach adjustments?',
      'Clears active restrictions and coach-made program edits. Keeps your base program.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            const summary = clearCoachAdjustments();
            Alert.alert(
              'Coach adjustments cleared',
              `Active injury: ${summary.activeInjuryCleared ? 'removed' : 'none'}\n` +
              `Coach Update cards: ${summary.coachUpdatesCleared}\n` +
              `Injury overrides: ${summary.injuryOverridesRemoved.length}`,
            );
          },
        },
      ],
    );
  };

  const onClearCoachChat = () => {
    logger.debug('[reset-ui] clear_coach_chat_pressed');
    Alert.alert(
      'Clear coach chat?',
      'Clears the coach conversation only. Keeps your program.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear chat',
          onPress: () => clearCoachChat(),
        },
      ],
    );
  };

  const onFullReset = () => {
    logger.debug('[reset-ui] full_reset_pressed');
    Alert.alert(
      'Full reset?',
      "Wipes profile, program, calendar and coach history. Returns to onboarding. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: () => resetProgramAndOnboarding(),
        },
      ],
    );
  };

  const onProgramSetupChanged = () => {
    navigation.navigate('CoachTab', {
      screen: 'Coach',
      params: { prefill: 'I need to make an adjustment to my program setup — ' },
    });
  };

  const displayName = onboardingData.firstName || 'Athlete';
  const position = onboardingData.position || '';
  const experienceLevel = onboardingData.experienceLevel || '';
  const daysPerWeek = onboardingData.trainingDaysPerWeek;
  const teamDays = onboardingData.teamTrainingDays || [];
  const gameDay = onboardingData.gameDay || onboardingData.usualGameDay || '';
  const mainFocus = onboardingData.biggestLimitation || onboardingData.goals?.[0] || '';
  const activeIssues = activeConstraints
    .map(formatCoachIssue)
    .filter((issue): issue is string => Boolean(issue));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header} testID="profile-page-header">
          <Text variant="label" color={colors.accent.lime} style={styles.headerTitle}>
            PROFILE
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary} style={styles.headerSubtitle}>
            Your program setup, coach adjustments and support.
          </Text>
        </View>

        {/* Program setup */}
        <View style={styles.section} testID="profile-program-setup-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>PROGRAM SETUP</Text>
          <Card style={styles.infoCard}>
            <InfoRow label="Name" value={displayName} />
            {position ? <InfoRow label="Position" value={position} /> : null}
            {experienceLevel ? <InfoRow label="Experience" value={experienceLevel} /> : null}
            <InfoRow
              label="Training days per week"
              value={daysPerWeek ? `${daysPerWeek} per week` : 'Not set'}
            />
            {teamDays.length > 0 ? (
              <InfoRow label="Team training days" value={formatList(teamDays) ?? ''} />
            ) : null}
            {gameDay ? <InfoRow label="Game day" value={gameDay} /> : null}
            {mainFocus ? <InfoRow label="Main goal / focus" value={mainFocus} last /> : null}
            <TouchableOpacity
              style={styles.setupChangeButton}
              activeOpacity={0.7}
              onPress={onProgramSetupChanged}
              testID="profile-program-setup-change"
              accessibilityLabel="Something changed? Tell the coach"
            >
              <Text variant="bodySmall" color={colors.accent.lime} style={{ fontWeight: '700' }}>
                Something changed? Tell the coach
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Coach adjustments */}
        <View
          style={styles.section}
          testID="profile-coach-adjustments-section"
          accessibilityLabel="Coach adjustments"
        >
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            COACH ADJUSTMENTS
          </Text>
          <Card style={styles.infoCard}>
            <View style={styles.activeCoachState} testID="profile-active-coach-state">
              {activeIssues.length > 0 ? (
                <>
                  <Text variant="caption" color={colors.text.tertiary} style={styles.activeLabel}>
                    Active:
                  </Text>
                  {activeIssues.map((issue, index) => (
                    <Text
                      key={`${issue}-${index}`}
                      variant="bodySmall"
                      color={colors.text.primary}
                      style={styles.activeIssue}
                    >
                      • {issue}
                    </Text>
                  ))}
                </>
              ) : (
                <Text
                  variant="bodySmall"
                  color={colors.text.secondary}
                  testID="profile-no-active-coach-adjustments"
                >
                  No active coach changes.
                </Text>
              )}
            </View>
            <View style={styles.resetDivider} />
            <TouchableOpacity
              style={styles.resetRow}
              activeOpacity={0.7}
              onPress={onClearCoachAdjustments}
              testID="profile-clear-coach-adjustments"
              accessibilityLabel="Clear active changes"
            >
              <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                Clear active changes
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                Clears active restrictions and coach-made edits. Keeps your base program.
              </Text>
            </TouchableOpacity>
            <View style={styles.resetDivider} />
            <TouchableOpacity
              style={styles.resetRow}
              activeOpacity={0.7}
              onPress={onClearCoachChat}
              testID="profile-clear-coach-chat"
              accessibilityLabel="Clear coach chat"
            >
              <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                Clear coach chat
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                Clears the coach conversation only. Keeps your program.
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Learn / FAQ */}
        <View style={styles.section} testID="profile-learn-faq-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            LEARN / FAQ
          </Text>
          <TouchableOpacity
            style={styles.faqButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('FAQ')}
          >
            <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
              Frequently Asked Questions
            </Text>
            <Text variant="caption" color={colors.text.tertiary}>
              How the program, coach updates and game-week logic work.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section} testID="profile-support-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            SUPPORT
          </Text>
          <View style={styles.feedbackCard}>
            <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600', marginBottom: spacing.sm }}>
              Leave Feedback
            </Text>
            <Text variant="caption" color={colors.text.tertiary}>
              Tell us what feels clunky, missing or unclear.
            </Text>
            <TouchableOpacity
              style={styles.feedbackButton}
              activeOpacity={0.7}
              onPress={() => Linking.openURL(buildMailto(env.feedbackEmail, 'LFA Feedback'))}
            >
              <Text variant="body" color={colors.surface.primary} style={{ fontWeight: '700' }}>
                Leave Feedback
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.feedbackCard}>
            <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600', marginBottom: spacing.sm }}>
              Ask a Human
            </Text>
            <Text variant="caption" color={colors.text.tertiary}>
              Got a question the app can’t answer?
            </Text>
            <TouchableOpacity
              style={styles.feedbackButton}
              activeOpacity={0.7}
              onPress={() => Linking.openURL(buildMailto(env.supportEmail, 'LFA - Speak to a Human'))}
            >
              <Text variant="body" color={colors.surface.primary} style={{ fontWeight: '700' }}>
                Ask a Human
              </Text>
            </TouchableOpacity>
            <Text variant="caption" color={colors.text.tertiary} style={{ textAlign: 'center', marginTop: spacing.sm }}>
              We’ll get back to you as soon as we can.
            </Text>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section} testID="profile-legal-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            LEGAL
          </Text>
          <Card style={styles.infoCard}>
            <TouchableOpacity
              style={styles.legalRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Privacy')}
              testID="profile-privacy-policy"
              accessibilityLabel="Privacy Policy"
            >
              <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                Privacy Policy
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                How your app, training and coach data is handled.
              </Text>
            </TouchableOpacity>
            <View style={styles.resetDivider} />
            <TouchableOpacity
              style={styles.legalRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Terms')}
              testID="profile-terms-of-use"
              accessibilityLabel="Terms of Use"
            >
              <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                Terms of Use
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                Practical use, safety and training guidance terms.
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Danger zone */}
        <View
          style={styles.section}
          testID="profile-danger-zone-section"
          accessibilityLabel="Danger zone"
        >
          <Text variant="label" color={colors.status.error} style={styles.sectionTitle}>
            DANGER ZONE
          </Text>
          <Card style={styles.dangerCard}>
            <TouchableOpacity
              style={styles.resetRow}
              activeOpacity={0.7}
              onPress={onFullReset}
              testID="profile-full-reset"
              accessibilityLabel="Full reset"
            >
              <Text variant="body" color={colors.status.error} style={{ fontWeight: '700' }}>
                Full reset
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                Wipes profile, program, calendar and coach history. Returns to onboarding.
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="label" color={colors.accent.lime}>LFA</Text>
          <Text variant="caption" color={colors.text.tertiary} style={{ marginTop: spacing.xs }}>
            MVP 0.1
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && { marginBottom: spacing.md }]}>
      <Text variant="caption" color={colors.text.tertiary}>{label}</Text>
      <Text variant="body" color={colors.text.primary} style={{ marginTop: spacing.xs }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  infoCard: {
    padding: spacing.lg,
  },
  setupChangeButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.35)',
  },
  activeCoachState: {
    marginBottom: spacing.md,
  },
  activeLabel: {
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  activeIssue: {
    marginTop: 2,
  },
  infoRow: {},
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  equipmentTag: {
    backgroundColor: colors.accent.lime,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  goalTag: {
    backgroundColor: colors.surface.tertiary,
    borderWidth: 1,
    borderColor: colors.accent.lime,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  faqButton: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  feedbackCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  feedbackButton: {
    backgroundColor: colors.accent.lime,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resetRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  legalRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  resetDivider: {
    height: 1,
    backgroundColor: colors.surface.tertiary,
    marginVertical: 0,
  },
  dangerCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.45)',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.tertiary,
    marginTop: spacing.lg,
  },
});
