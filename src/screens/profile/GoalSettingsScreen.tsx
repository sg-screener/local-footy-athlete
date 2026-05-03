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
import { SelectableTile } from '../../components/common';
import { useProfileStore } from '../../store/profileStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const GOAL_OPTIONS = [
  'Build Strength',
  'Improve Endurance',
  'Increase Speed',
  'Build Muscle',
  'Improve Flexibility',
  'Reduce Injury Risk',
  'Improve Game Performance',
  'Staying injury free',
];

export const GoalSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const updateOnboardingData = useProfileStore((state) => state.updateOnboardingData);

  const [selectedGoals, setSelectedGoals] = useState<string[]>(
    onboardingData.goals || []
  );
  const [loading, setLoading] = useState(false);

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : [...prev, goal]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      updateOnboardingData({ goals: selectedGoals });
      navigation.goBack();
    } catch (error) {
      console.error('Error updating goals:', error);
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
          Goals
        </Text>
      </View>

      <Text variant="bodySmall" style={styles.description}>
        Select all goals that apply to you
      </Text>

      {/* Goals Grid — migrated to shared SelectableTile so every multi-
          select surface in the product reads the same way. */}
      <View style={styles.goalsGrid}>
        {GOAL_OPTIONS.map((goal) => {
          const active = selectedGoals.includes(goal);
          return (
            <SelectableTile
              key={goal}
              isSelected={active}
              onPress={() => toggleGoal(goal)}
              style={styles.goalCard}
            >
              <Text
                variant="body"
                style={[
                  styles.goalText,
                  active && styles.goalTextActive,
                ]}
              >
                {goal}
              </Text>
            </SelectableTile>
          );
        })}
      </View>

      {/* Save Button */}
      <Button
        title={loading ? 'Saving...' : 'Save Goals'}
        variant="primary"
        onPress={handleSave}
        disabled={loading || selectedGoals.length === 0}
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
  description: {
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  } as TextStyle,
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  // Layout-only overrides — SelectableTile owns the selected look +
  // corner checkmark. The 0.48 flex keeps the 2-column grid readable.
  goalCard: {
    flex: 0.48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  goalText: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
    // Leave headroom on the right for the shared corner checkmark so
    // long labels like "Improve Game Performance" don't slide under it.
    paddingRight: 18,
  } as TextStyle,
  goalTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  } as TextStyle,
  saveButton: {
    marginBottom: spacing.md,
  } as ViewStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
