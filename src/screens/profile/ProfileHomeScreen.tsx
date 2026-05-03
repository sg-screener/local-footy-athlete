import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Text } from '../../components/common/Text';
import { SettingsRow } from '../../components/common/SettingsRow';
import { useProfileStore } from '../../store/profileStore';
import { useAuthStore } from '../../store/authStore';
import {
  clearCoachAdjustments,
  clearCoachChat,
  resetProgramAndOnboarding,
} from '../../utils/resetCoach';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export const ProfileHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const auth = useAuthStore((state) => state.user);

  const displayName = onboardingData.firstName || 'Athlete';
  const position = onboardingData.position || '';

  const initials = (
    (displayName.charAt(0) || '').toUpperCase()
  ) || 'LF';

  const stats = [
    { label: 'Programs', value: '3' },
    { label: 'Workouts', value: '24' },
    { label: 'Streak', value: '12 days' },
  ];

  // ─── Reset handlers ────────────────────────────────────────────────
  // Three levels of destructiveness, each behind a confirmation prompt.
  // Surgical "Clear coach adjustments" preserves the base program; the
  // full reset returns the user to onboarding. See utils/resetCoach.ts.
  const handleClearCoachAdjustments = () => {
    Alert.alert(
      'Clear coach adjustments?',
      'Removes the active injury, Coach Update cards, and any program changes the coach has made. Your base program, profile, and game days stay intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            const summary = clearCoachAdjustments();
            Alert.alert(
              'Coach state cleared',
              `Active injury: ${summary.activeInjuryCleared ? 'removed' : 'none'}\n` +
              `Coach Update cards: ${summary.coachUpdatesCleared}\n` +
              `Injury overrides: ${summary.injuryOverridesRemoved.length}`,
            );
          },
        },
      ],
    );
  };

  const handleClearCoachChat = () => {
    Alert.alert(
      'Clear coach chat?',
      'Removes all chat messages with the coach. Your active injury and program stay intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear chat',
          style: 'destructive',
          onPress: () => clearCoachChat(),
        },
      ],
    );
  };

  const handleFullReset = () => {
    Alert.alert(
      'Full reset?',
      "This wipes your profile, program, calendar, coach chat, and all overrides. You'll be returned to onboarding. This can't be undone.",
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

  return (
    <ScreenContainer>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.initialsCircle}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
        <Text variant="h2" style={styles.displayName}>
          {displayName}
        </Text>
        {position ? (
          <View style={styles.positionBadge}>
            <Text variant="label" style={styles.positionText}>
              {position}
            </Text>
          </View>
        ) : null}
        {auth?.email && (
          <Text variant="bodySmall" style={styles.email}>
            {auth.email}
          </Text>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <Text variant="h3" style={styles.statValue}>
              {stat.value}
            </Text>
            <Text variant="caption" style={styles.statLabel}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Training Settings */}
      <Text variant="h4" style={styles.sectionTitle}>
        Training
      </Text>
      <SettingsRow
        icon="✏️"
        label="Edit Profile"
        onPress={() => navigation.navigate('EditProfile')}
      />
      <SettingsRow
        icon="⚙️"
        label="Training Preferences"
        onPress={() => navigation.navigate('Preferences')}
      />
      <SettingsRow
        icon="🎯"
        label="Goals"
        onPress={() => navigation.navigate('GoalSettings')}
      />

      {/* Health Settings */}
      <Text variant="h4" style={styles.sectionTitle}>
        Health
      </Text>
      <SettingsRow
        icon="❤️"
        label="Health Settings"
        onPress={() => navigation.navigate('HealthSettings')}
      />
      <SettingsRow
        icon="🩹"
        label="Injury Management"
        onPress={() => navigation.navigate('InjuryManagement')}
      />

      {/* App Settings */}
      <Text variant="h4" style={styles.sectionTitle}>
        App
      </Text>
      <SettingsRow
        icon="🔔"
        label="Notifications"
        onPress={() => navigation.navigate('NotificationSettings')}
      />
      <SettingsRow
        icon="ℹ️"
        label="About"
        onPress={() => navigation.navigate('About')}
      />
      <SettingsRow
        icon="❓"
        label="Help"
        onPress={() => navigation.navigate('Help')}
      />
      <SettingsRow
        icon="🔒"
        label="Privacy"
        onPress={() => navigation.navigate('Privacy')}
      />
      <SettingsRow
        icon="📜"
        label="Terms"
        onPress={() => navigation.navigate('Terms')}
      />

      {/* Account Settings */}
      <Text variant="h4" style={styles.sectionTitle}>
        Account
      </Text>
      <SettingsRow
        icon="👤"
        label="Account"
        onPress={() => navigation.navigate('Account')}
      />
      <SettingsRow
        icon="💳"
        label="Subscription"
        onPress={() => navigation.navigate('Subscription')}
      />

      {/* Coach state — three reset levels (least → most destructive) */}
      <Text variant="h4" style={styles.sectionTitle}>
        Coach state
      </Text>
      <SettingsRow
        icon="🩹"
        label="Clear coach adjustments"
        onPress={handleClearCoachAdjustments}
      />
      <SettingsRow
        icon="💬"
        label="Clear coach chat"
        onPress={handleClearCoachChat}
      />

      {/* Danger Zone */}
      <Text variant="h4" style={styles.dangerTitle}>
        Danger Zone
      </Text>
      <SettingsRow
        icon="🔄"
        label="Full reset (clears everything)"
        onPress={handleFullReset}
        danger
      />
      <SettingsRow
        icon="⚠️"
        label="Delete Account"
        onPress={() => navigation.navigate('DeleteAccount')}
        danger
      />

      {/* Extra spacing at bottom */}
      <View style={styles.spacer} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  } as ViewStyle,
  initialsCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent.lime,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  } as ViewStyle,
  initialsText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.surface.primary,
  } as TextStyle,
  displayName: {
    color: colors.text.primary,
    marginBottom: spacing.sm,
  } as TextStyle,
  positionBadge: {
    backgroundColor: colors.accent.lime,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  } as ViewStyle,
  positionText: {
    color: colors.surface.primary,
    fontWeight: '600',
  } as TextStyle,
  email: {
    color: colors.text.secondary,
  } as TextStyle,
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: spacing.md,
  } as ViewStyle,
  statCard: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  } as ViewStyle,
  statValue: {
    color: colors.accent.lime,
    marginBottom: spacing.xs,
  } as TextStyle,
  statLabel: {
    color: colors.text.tertiary,
  } as TextStyle,
  sectionTitle: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as TextStyle,
  dangerTitle: {
    color: colors.status.error,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
