import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';

// Mock week review data
const MOCK_WEEK_REVIEW = {
  weekNumber: 8,
  year: 2026,
  startDate: '23 Feb 2026',
  endDate: '1 Mar 2026',
  workoutsCompleted: 4,
  workoutsPlanned: 5,
  totalVolume: 48000,
  totalDuration: 265,
  avgDuration: 66,
  weekFeeling: 'Strong',
  days: [
    { day: 'Mon', completed: true, type: 'Lower Strength' },
    { day: 'Tue', completed: false, type: 'Rest' },
    { day: 'Wed', completed: true, type: 'Upper Strength' },
    { day: 'Thu', completed: false, type: 'Rest' },
    { day: 'Fri', completed: true, type: 'Full Body' },
    { day: 'Sat', completed: true, type: 'Accessory' },
    { day: 'Sun', completed: false, type: 'Rest' },
  ],
  nextWeekPreview: 'Next week looks solid! We\'ll focus on strength progression with heavy compound lifts and accessory work. Expect similar volume to this week with some new exercise variations to keep things fresh.',
};

export const WeeklyReviewScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  // Use route params if available, otherwise use mock data
  const weekReview = route.params?.weekReview || MOCK_WEEK_REVIEW;

  const handleBack = () => {
    navigation.goBack();
  };

  const getDayStatusIcon = (completed: boolean) => {
    return completed ? '✓' : '✕';
  };

  const getDayStatusColor = (completed: boolean) => {
    return completed ? colors.accent.lime : '#FF6B6B';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          Week {weekReview.weekNumber} Review
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary Stats */}
        <Card style={styles.summaryCard}>
          <View style={styles.statsRow}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
                Workouts
              </Text>
              <Text
                variant="h2"
                style={{ color: colors.accent.lime, marginBottom: spacing.xs }}
              >
                {weekReview.workoutsCompleted}/{weekReview.workoutsPlanned}
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                completed
              </Text>
            </View>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
                Total Volume
              </Text>
              <Text
                variant="h2"
                style={{ color: colors.accent.lime, marginBottom: spacing.xs }}
              >
                {(weekReview.totalVolume / 1000).toFixed(1)}
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                tonnes
              </Text>
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
                Avg Duration
              </Text>
              <Text
                variant="h2"
                style={{ color: colors.accent.lime, marginBottom: spacing.xs }}
              >
                {weekReview.avgDuration}
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                min
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${(weekReview.workoutsCompleted / weekReview.workoutsPlanned) * 100}%`,
                },
              ]}
            />
          </View>
        </Card>

        {/* Weekly Breakdown */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Week Breakdown
          </Text>

          {weekReview.days.map((dayData: any, index: number) => (
            <Card key={index} style={styles.dayCard}>
              <View style={styles.dayRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="label"
                    style={{ color: colors.text.primary, marginBottom: spacing.xs }}
                  >
                    {dayData.day}
                  </Text>
                  <Text
                    variant="caption"
                    style={{ color: colors.text.tertiary }}
                  >
                    {dayData.type}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: getDayStatusColor(dayData.completed),
                    }}
                  >
                    {getDayStatusIcon(dayData.completed)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* How was this week */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            How was this week?
          </Text>
          <Card style={styles.feelingCard}>
            <View style={styles.feelingContent}>
              <Text style={{ fontSize: 48, marginRight: spacing.md }}>💪</Text>
              <View>
                <Text variant="label" style={{ color: colors.text.tertiary }}>
                  Overall feeling
                </Text>
                <Text
                  variant="h3"
                  style={{ color: colors.accent.lime, marginTop: spacing.xs }}
                >
                  {weekReview.weekFeeling}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Next Week Preview */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Next Week Preview
          </Text>
          <Card>
            <Text style={{ color: colors.text.secondary, lineHeight: 22 }}>
              {weekReview.nextWeekPreview}
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
  summaryCard: {
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressContainer: {
    height: 8,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent.lime,
  },
  section: {
    marginBottom: spacing.lg,
  },
  dayCard: {
    marginBottom: spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feelingCard: {
    paddingVertical: spacing.lg,
  },
  feelingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
