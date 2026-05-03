import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';

// Mock program data
const MOCK_PROGRAM = {
  name: '12 Week Strength Block',
  phase: 'Hypertrophy Phase',
  phaseDescription: 'Focus on building muscle mass with moderate weight and higher rep ranges (8-12 reps). Progressive overload through volume.',
  weeksCompleted: 4,
  totalWeeks: 12,
  split: [
    { day: 'Monday', type: 'Lower Strength', focus: 'Quad Focus' },
    { day: 'Tuesday', type: 'Rest', focus: '' },
    { day: 'Wednesday', type: 'Upper Strength', focus: 'Chest & Back' },
    { day: 'Thursday', type: 'Rest', focus: '' },
    { day: 'Friday', type: 'Full Body', focus: 'Compound Focus' },
    { day: 'Saturday', type: 'Accessory', focus: 'Weak Points' },
    { day: 'Sunday', type: 'Rest', focus: '' },
  ],
  totalExercises: 45,
  weeksRemaining: 8,
  workoutsPerWeek: 5,
};

export const TrainingOverviewScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    navigation.goBack();
  };

  const progressPercentage = (MOCK_PROGRAM.weeksCompleted / MOCK_PROGRAM.totalWeeks) * 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          Training Overview
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Current Program Card */}
        <Card style={styles.programCard}>
          <Text
            variant="label"
            style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}
          >
            Current Program
          </Text>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            {MOCK_PROGRAM.name}
          </Text>

          <View style={styles.phaseInfo}>
            <Text variant="label" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
              {MOCK_PROGRAM.phase}
            </Text>
            <Text variant="h4" style={{ color: colors.accent.lime, marginBottom: spacing.sm }}>
              Week {MOCK_PROGRAM.weeksCompleted} of {MOCK_PROGRAM.totalWeeks}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progressPercentage}%` },
              ]}
            />
          </View>
          <Text variant="caption" style={{ color: colors.text.tertiary, marginTop: spacing.sm }}>
            {MOCK_PROGRAM.weeksCompleted} / {MOCK_PROGRAM.totalWeeks} weeks
          </Text>
        </Card>

        {/* Your Split Section */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Your Split
          </Text>

          {MOCK_PROGRAM.split.map((day, index) => (
            <Card key={index} style={styles.splitCard}>
              <View style={styles.splitRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="label"
                    style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}
                  >
                    {day.day}
                  </Text>
                  <Text
                    variant="h4"
                    style={{ color: colors.text.primary }}
                  >
                    {day.type}
                  </Text>
                  {day.focus && (
                    <Text
                      variant="caption"
                      style={{ color: colors.text.tertiary, marginTop: spacing.xs }}
                    >
                      {day.focus}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={{ fontSize: 20 }}>
                    {day.type === 'Rest' ? '🛌' : '💪'}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Phase Info Card */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Phase Info
          </Text>
          <Card>
            <Text
              variant="label"
              style={{ color: colors.text.tertiary, marginBottom: spacing.md }}
            >
              {MOCK_PROGRAM.phase}
            </Text>
            <Text
              style={{
                color: colors.text.secondary,
                lineHeight: 22,
                marginBottom: spacing.md,
              }}
            >
              {MOCK_PROGRAM.phaseDescription}
            </Text>
            <View style={styles.phaseStats}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  Focus
                </Text>
                <Text
                  variant="h4"
                  style={{ color: colors.accent.lime, marginTop: spacing.xs }}
                >
                  Muscle
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  Rep Range
                </Text>
                <Text
                  variant="h4"
                  style={{ color: colors.accent.lime, marginTop: spacing.xs }}
                >
                  8-12
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  Intensity
                </Text>
                <Text
                  variant="h4"
                  style={{ color: colors.accent.lime, marginTop: spacing.xs }}
                >
                  Mod
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Program Stats */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Program Stats
          </Text>

          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
                Total Exercises
              </Text>
              <Text
                variant="h3"
                style={{ color: colors.accent.lime }}
              >
                {MOCK_PROGRAM.totalExercises}
              </Text>
            </Card>

            <Card style={styles.statCard}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
                Weeks Remaining
              </Text>
              <Text
                variant="h3"
                style={{ color: colors.accent.lime }}
              >
                {MOCK_PROGRAM.weeksRemaining}
              </Text>
            </Card>
          </View>

          <Card style={{ marginTop: spacing.md }}>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
              Workouts Per Week
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime }}
            >
              {MOCK_PROGRAM.workoutsPerWeek}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.tertiary,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  programCard: {
    marginBottom: spacing.lg,
  },
  phaseInfo: {
    marginBottom: spacing.md,
  },
  progressContainer: {
    height: 8,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent.lime,
  },
  section: {
    marginBottom: spacing.lg,
  },
  splitCard: {
    marginBottom: spacing.md,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsGrid: {
    flexDirection: 'row',
  },
  statCard: {
    flex: 1,
    marginRight: spacing.sm,
  },
});
