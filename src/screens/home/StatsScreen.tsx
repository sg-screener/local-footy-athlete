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

export const StatsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    navigation.goBack();
  };

  // Mock stats data
  const stats = {
    totalWorkouts: 95,
    currentStreak: 8,
    totalVolume: 1250000,
    avgSessionDuration: 63,
    thisWeek: {
      completed: 3,
      planned: 5,
      volume: 48000,
    },
    thisMonth: {
      completed: 13,
      volume: 185000,
    },
    allTime: {
      memberSince: 'Jan 15, 2025',
      programsCompleted: 2,
    },
  };

  const BigStatCard = ({ label, value, unit, icon }: any) => (
    <Card style={styles.bigStatCard}>
      <View style={styles.bigStatContent}>
        <View>
          <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
            {label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              variant="h2"
              style={{ color: colors.accent.lime }}
            >
              {value}
            </Text>
            {unit && (
              <Text
                variant="label"
                style={{ color: colors.text.tertiary, marginLeft: spacing.sm }}
              >
                {unit}
              </Text>
            )}
          </View>
        </View>
        {icon && <Text style={{ fontSize: 40 }}>{icon}</Text>}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          Your Stats
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Big Stat Cards */}
        <View style={styles.bigStatsSection}>
          <BigStatCard
            label="Total Workouts"
            value={stats.totalWorkouts}
            icon="💪"
          />
          <BigStatCard
            label="Current Streak"
            value={stats.currentStreak}
            unit="days"
            icon="🔥"
          />
        </View>

        <View style={styles.bigStatsSection}>
          <BigStatCard
            label="Total Volume Lifted"
            value={(stats.totalVolume / 1000000).toFixed(1)}
            unit="M kg"
            icon="⚙️"
          />
          <BigStatCard
            label="Avg Session Duration"
            value={stats.avgSessionDuration}
            unit="min"
            icon="⏱️"
          />
        </View>

        {/* This Week */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            This Week
          </Text>
          <Card>
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
                  Workouts Completed
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text
                    variant="h3"
                    style={{ color: colors.accent.lime }}
                  >
                    {stats.thisWeek.completed}
                  </Text>
                  <Text
                    variant="label"
                    style={{ color: colors.text.tertiary, marginLeft: spacing.sm }}
                  >
                    of {stats.thisWeek.planned}
                  </Text>
                </View>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${(stats.thisWeek.completed / stats.thisWeek.planned) * 100}%` },
                ]}
              />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                Volume: {(stats.thisWeek.volume / 1000).toFixed(1)} tonnes
              </Text>
            </View>
          </Card>
        </View>

        {/* This Month */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            This Month
          </Text>
          <Card>
            <View style={styles.monthGrid}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
                  Workouts
                </Text>
                <Text
                  variant="h3"
                  style={{ color: colors.accent.lime }}
                >
                  {stats.thisMonth.completed}
                </Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
                  Volume
                </Text>
                <Text
                  variant="h3"
                  style={{ color: colors.accent.lime }}
                >
                  {(stats.thisMonth.volume / 1000).toFixed(0)}
                </Text>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  kg
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* All Time */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            All Time
          </Text>

          <Card style={styles.allTimeCard}>
            <View style={styles.allTimeRow}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
                  Member Since
                </Text>
                <Text
                  variant="label"
                  style={{ color: colors.text.primary }}
                >
                  {stats.allTime.memberSince}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
                  Programs Completed
                </Text>
                <Text
                  variant="h4"
                  style={{ color: colors.accent.lime }}
                >
                  {stats.allTime.programsCompleted}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Motivational Footer */}
        <View style={styles.motivationalSection}>
          <Card style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text
              style={{
                color: colors.text.secondary,
                textAlign: 'center',
                fontSize: 16,
                lineHeight: 24,
              }}
            >
              Keep up the great work! Your consistency is paying off. 🎯
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
  bigStatsSection: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  bigStatCard: {
    flex: 1,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  bigStatContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  section: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    marginBottom: spacing.md,
  },
  progressContainer: {
    height: 8,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginVertical: spacing.md,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent.lime,
  },
  monthGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  allTimeCard: {
    marginBottom: spacing.md,
  },
  allTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  motivationalSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
