import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';

interface StatItem {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}

interface StatsCardProps {
  stats: {
    completed: number;
    total: number;
    streak: number;
    volume: number;
  };
}

export const StatsCard = ({ stats }: StatsCardProps) => {
  const statItems: StatItem[] = [
    {
      label: 'Workouts',
      value: `${stats.completed}/${stats.total}`,
      color: colors.accent.lime,
    },
    {
      label: 'Streak',
      value: stats.streak,
      unit: 'days',
      color: colors.status.success,
    },
    {
      label: 'Volume',
      value: stats.volume,
      unit: 'kg',
      color: colors.status.info,
    },
  ];

  return (
    <Card>
      <View style={styles.container}>
        {statItems.map((stat, index) => (
          <View
            key={index}
            style={[
              styles.statItem,
              index !== statItems.length - 1 && styles.statItemWithBorder,
            ]}
          >
            <Text
              variant="h2"
              style={[
                styles.statValue,
                { color: stat.color || colors.accent.lime },
              ]}
            >
              {stat.value}
            </Text>
            <View style={styles.labelContainer}>
              <Text
                variant="caption"
                color={colors.text.secondary}
                style={styles.label}
              >
                {stat.label}
              </Text>
              {stat.unit && (
                <Text
                  variant="caption"
                  color={colors.text.tertiary}
                >
                  {stat.unit}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItemWithBorder: {
    borderRightWidth: 1,
    borderRightColor: `${colors.text.secondary}30`,
  },
  statValue: {
    marginBottom: spacing.xs,
  },
  labelContainer: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    textTransform: 'capitalize',
  },
});
