import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { useProfileStore } from '../../store/profileStore';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

const DAYS_OPTIONS = ['2', '3', '4', '5'];
const DURATIONS = ['30 min', '45 min', '60 min', '75 min', '90 min'];

export const TrainingPreferencesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const updateOnboardingData = useProfileStore((state) => state.updateOnboardingData);

  const [daysPerWeek, setDaysPerWeek] = useState(
    onboardingData.trainingDaysPerWeek?.toString() || '3'
  );
  const [sessionDuration, setSessionDuration] = useState(
    onboardingData.sessionDurationMinutes ? `${onboardingData.sessionDurationMinutes} min` : '60 min'
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const durationNum = parseInt(sessionDuration, 10);
      updateOnboardingData({
        trainingDaysPerWeek: parseInt(daysPerWeek, 10),
        sessionDurationMinutes: durationNum as any,
      });
      navigation.goBack();
    } catch (error) {
      console.error('Error updating training preferences:', error);
    } finally {
      setLoading(false);
    }
  };

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
          Training Preferences
        </Text>
      </View>

      {/* Days Per Week */}
      <Text variant="label" style={styles.label}>
        Extra Gym Sessions Per Week
      </Text>
      <View style={styles.optionsGrid}>
        {DAYS_OPTIONS.map((day) => (
          <Pressable
            key={day}
            onPress={() => setDaysPerWeek(day)}
            style={[
              styles.optionCard,
              daysPerWeek === day && styles.optionCardActive,
            ]}
          >
            <Text
              variant="h3"
              style={[
                styles.optionText,
                daysPerWeek === day && styles.optionTextActive,
              ]}
            >
              {day}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Session Duration */}
      <Text variant="label" style={styles.label}>
        Session Duration
      </Text>
      <View style={styles.durationGrid}>
        {DURATIONS.map((duration) => (
          <Pressable
            key={duration}
            onPress={() => setSessionDuration(duration)}
            style={[
              styles.durationCard,
              sessionDuration === duration && styles.durationCardActive,
            ]}
          >
            <Text
              variant="body"
              style={[
                styles.durationText,
                sessionDuration === duration && styles.durationTextActive,
              ]}
            >
              {duration}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Save Button */}
      <Button
        title={loading ? 'Saving...' : 'Save Preferences'}
        variant="primary"
        onPress={handleSave}
        disabled={loading}
        style={styles.saveButton}
      />

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
  label: {
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  } as TextStyle,
  optionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  optionCard: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.surface.tertiary,
    alignItems: 'center',
  } as ViewStyle,
  optionCardActive: {
    borderColor: colors.accent.lime,
    backgroundColor: colors.surface.tertiary,
  } as ViewStyle,
  optionText: {
    color: colors.text.primary,
    fontWeight: '500',
  } as TextStyle,
  optionTextActive: {
    color: colors.accent.lime,
    fontWeight: '700',
  } as TextStyle,
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  durationCard: {
    flex: 0.48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.surface.tertiary,
    alignItems: 'center',
  } as ViewStyle,
  durationCardActive: {
    borderColor: colors.accent.lime,
    backgroundColor: colors.surface.tertiary,
  } as ViewStyle,
  durationText: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  } as TextStyle,
  durationTextActive: {
    color: colors.accent.lime,
    fontWeight: '700',
  } as TextStyle,
  saveButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as ViewStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
