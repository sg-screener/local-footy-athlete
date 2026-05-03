import React, { useState } from 'react';
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

// Mock strength trends data
const MOCK_STRENGTH_TRENDS = [
  {
    id: '1',
    exercise: 'Squat',
    currentMax: 140,
    change: 15,
    direction: 'up',
  },
  {
    id: '2',
    exercise: 'Bench Press',
    currentMax: 100,
    change: 5,
    direction: 'up',
  },
  {
    id: '3',
    exercise: 'Deadlift',
    currentMax: 160,
    change: 20,
    direction: 'up',
  },
  {
    id: '4',
    exercise: 'Overhead Press',
    currentMax: 65,
    change: 2,
    direction: 'up',
  },
  {
    id: '5',
    exercise: 'Barbell Row',
    currentMax: 120,
    change: 5,
    direction: 'up',
  },
  {
    id: '6',
    exercise: 'Leg Press',
    currentMax: 210,
    change: 10,
    direction: 'up',
  },
];

type TimePeriod = '1W' | '1M' | '3M' | 'All';

export const ProgressChartsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1M');

  const handleBack = () => {
    navigation.goBack();
  };

  // Mock stats data that changes based on period
  const getStats = () => {
    const stats = {
      '1W': {
        totalVolume: 48000,
        volumeTrend: 'up',
        volumeChange: 5,
        avgDuration: 62,
        workouts: 3,
        consistency: 85,
      },
      '1M': {
        totalVolume: 185000,
        volumeTrend: 'up',
        volumeChange: 12,
        avgDuration: 64,
        workouts: 13,
        consistency: 88,
      },
      '3M': {
        totalVolume: 550000,
        volumeTrend: 'up',
        volumeChange: 18,
        avgDuration: 63,
        workouts: 38,
        consistency: 82,
      },
      All: {
        totalVolume: 1250000,
        volumeTrend: 'up',
        volumeChange: 22,
        avgDuration: 63,
        workouts: 95,
        consistency: 80,
      },
    };
    return stats[selectedPeriod];
  };

  const stats = getStats();

  const TrendArrow = ({ direction, change }: { direction: string; change: number }) => (
    <Text style={{ color: direction === 'up' ? colors.accent.lime : '#FF6B6B', fontSize: 16 }}>
      {direction === 'up' ? '↑' : '↓'} {change}
    </Text>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          Progress
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Time Period Selector */}
        <View style={styles.periodSelector}>
          {(['1W', '1M', '3M', 'All'] as TimePeriod[]).map((period) => (
            <Pressable
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={[
                styles.periodChip,
                selectedPeriod === period && styles.periodChipActive,
              ]}
            >
              <Text
                variant="label"
                style={{
                  color:
                    selectedPeriod === period
                      ? colors.accent.lime
                      : colors.text.secondary,
                }}
              >
                {period}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
              Total Volume
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
            >
              {(stats.totalVolume / 1000).toFixed(0)}
            </Text>
            <Text variant="caption" style={{ color: colors.text.tertiary }}>
              tonnes
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <TrendArrow direction={stats.volumeTrend} change={stats.volumeChange} />
            </View>
          </Card>

          <Card style={styles.statCard}>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
              Avg Session
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
            >
              {stats.avgDuration}
            </Text>
            <Text variant="caption" style={{ color: colors.text.tertiary }}>
              minutes
            </Text>
          </Card>
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
              Workouts
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
            >
              {stats.workouts}
            </Text>
            <Text variant="caption" style={{ color: colors.text.tertiary }}>
              this period
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}>
              Consistency
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
            >
              {stats.consistency}
            </Text>
            <Text variant="caption" style={{ color: colors.text.tertiary }}>
              percent
            </Text>
          </Card>
        </View>

        {/* Strength Trends */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Strength Trends
          </Text>

          {MOCK_STRENGTH_TRENDS.map((trend) => (
            <Card key={trend.id} style={styles.trendCard}>
              <View style={styles.trendRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="label"
                    style={{ color: colors.text.primary, marginBottom: spacing.xs }}
                  >
                    {trend.exercise}
                  </Text>
                  <Text
                    variant="h4"
                    style={{ color: colors.accent.lime }}
                  >
                    {trend.currentMax} kg
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <TrendArrow direction={trend.direction} change={trend.change} />
                </View>
              </View>
            </Card>
          ))}
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
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  periodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.tertiary,
  },
  periodChipActive: {
    borderWidth: 2,
    borderColor: colors.accent.lime,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
  },
  trendCard: {
    marginBottom: spacing.md,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
