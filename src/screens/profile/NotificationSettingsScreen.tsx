import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Text } from '../../components/common/Text';
import { useProfileStore } from '../../store/profileStore';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface NotificationPreference {
  enabled: boolean;
  description: string;
}

export const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);

  const [notifications, setNotifications] = useState({
    workoutReminders: true,
    coachTips: true,
    achievementAlerts: true,
    weeklySummary: true,
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const notificationOptions = [
    {
      key: 'workoutReminders' as const,
      label: 'Workout Reminders',
      description: 'Get reminders for your scheduled workouts',
    },
    {
      key: 'coachTips' as const,
      label: 'Coach Tips',
      description: 'Receive training tips and advice from our AI coach',
    },
    {
      key: 'achievementAlerts' as const,
      label: 'Achievement Alerts',
      description: 'Celebrate your milestones and achievements',
    },
    {
      key: 'weeklySummary' as const,
      label: 'Weekly Summary',
      description: 'Get a summary of your training for the week',
    },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text variant="h3" style={styles.backButton}>
            ← Back
          </Text>
        </Pressable>
        <Text variant="h2" style={styles.title}>
          Notifications
        </Text>
      </View>

      {/* Notification Toggles */}
      <View style={styles.container}>
        {notificationOptions.map((option) => (
          <View key={option.key} style={styles.notificationRow}>
            <View style={styles.labelContainer}>
              <Text variant="body" style={styles.label}>
                {option.label}
              </Text>
              <Text variant="bodySmall" style={styles.description}>
                {option.description}
              </Text>
            </View>
            <Switch
              value={notifications[option.key]}
              onValueChange={() => handleToggle(option.key)}
              trackColor={{ false: colors.surface.tertiary, true: colors.accent.lime }}
              thumbColor={notifications[option.key] ? colors.accent.lime : colors.text.secondary}
            />
          </View>
        ))}
      </View>

      <View style={styles.spacer} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  backButton: {
    color: colors.accent.lime,
    marginBottom: spacing.md,
  } as TextStyle,
  title: {
    color: colors.text.primary,
  } as TextStyle,
  container: {
    gap: spacing.md,
  } as ViewStyle,
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
  } as ViewStyle,
  labelContainer: {
    flex: 1,
    marginRight: spacing.md,
  } as ViewStyle,
  label: {
    color: colors.text.primary,
    marginBottom: spacing.xs,
  } as TextStyle,
  description: {
    color: colors.text.tertiary,
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
