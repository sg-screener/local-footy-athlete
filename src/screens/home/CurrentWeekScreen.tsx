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
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import type { SessionTier } from '../../types/domain';

// Mock week data
const MOCK_WEEK = {
  weekNumber: 8,
  days: [
    {
      day: 'Mon',
      date: 'Mar 3',
      workout: {
        type: 'Lower Strength',
        focus: 'Quad Focus',
        exercises: 6,
      },
      completed: false,
      isToday: false,
    },
    {
      day: 'Tue',
      date: 'Mar 4',
      workout: null,
      completed: false,
      isToday: false,
    },
    {
      day: 'Wed',
      date: 'Mar 5',
      workout: {
        type: 'Upper Strength',
        focus: 'Chest & Back',
        exercises: 5,
      },
      completed: false,
      isToday: false,
    },
    {
      day: 'Thu',
      date: 'Mar 6',
      workout: null,
      completed: false,
      isToday: false,
    },
    {
      day: 'Fri',
      date: 'Mar 7',
      workout: {
        type: 'Full Body',
        focus: 'Compound Focus',
        exercises: 8,
      },
      completed: false,
      isToday: false,
    },
    {
      day: 'Sat',
      date: 'Mar 2',
      workout: {
        type: 'Accessory',
        focus: 'Weak Points',
        exercises: 4,
      },
      completed: true,
      isToday: true,
    },
    {
      day: 'Sun',
      date: 'Mar 1',
      workout: null,
      completed: false,
      isToday: false,
    },
  ],
};

export const CurrentWeekScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDayPress = (day: any) => {
    if (day.workout) {
      navigation.navigate('DayWorkout', { day });
    }
  };

  const DayCard = ({ day }: { day: any }) => {
    const isRestDay = !day.workout;
    const isTodayCard = day.isToday;

    return (
      <Pressable
        onPress={() => handleDayPress(day)}
        disabled={isRestDay}
        style={({ pressed }) => [
          styles.dayCardPressable,
          pressed && !isRestDay && { opacity: 0.7 },
        ]}
      >
        <Card
          style={[
            styles.dayCard,
            isTodayCard && styles.todayCard,
            isRestDay && styles.restDayCard,
          ]}
        >
          {isTodayCard && <View style={styles.todayBorder} />}

          <View style={styles.dayHeader}>
            <View>
              <Text
                variant="label"
                style={{
                  color: isTodayCard ? colors.accent.lime : colors.text.primary,
                  fontWeight: 'bold',
                }}
              >
                {day.day}
              </Text>
              <Text
                variant="caption"
                style={{
                  color: colors.text.tertiary,
                  marginTop: spacing.xs,
                }}
              >
                {day.date}
              </Text>
            </View>

            {day.completed && (
              <View style={{ marginLeft: spacing.md }}>
                <Text style={{ fontSize: 20, color: colors.accent.lime }}>✓</Text>
              </View>
            )}
          </View>

          {isRestDay ? (
            <View style={{ marginTop: spacing.md }}>
              <Text
                variant="label"
                style={{ color: colors.text.tertiary }}
              >
                Rest Day
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              {(day.workout as any).sessionTier && (
                <SessionTierBadge
                  tier={(day.workout as any).sessionTier as SessionTier}
                  style={{ marginBottom: spacing.xs }}
                />
              )}
              <Text
                variant="h4"
                style={{
                  color: colors.text.primary,
                  marginBottom: spacing.xs,
                }}
              >
                {day.workout.type}
              </Text>
              <Text
                variant="caption"
                style={{
                  color: colors.text.tertiary,
                  marginBottom: spacing.sm,
                }}
              >
                {day.workout.focus}
              </Text>
              <View style={styles.workoutMeta}>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  {day.workout.exercises} exercises
                </Text>
              </View>

              {!day.completed && !isRestDay && (
                <Pressable
                  onPress={() => handleDayPress(day)}
                  style={({ pressed }) => [
                    styles.startButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    variant="label"
                    style={{ color: colors.accent.lime, fontSize: 12 }}
                  >
                    Start →
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text variant="h2" style={{ color: colors.text.primary }}>
            This Week
          </Text>
          <View style={styles.weekBadge}>
            <Text variant="caption" style={{ color: colors.accent.lime }}>
              Week {MOCK_WEEK.weekNumber}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {MOCK_WEEK.days.map((day, index) => (
          <DayCard key={index} day={day} />
        ))}
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
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.tertiary,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  weekBadge: {
    marginTop: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dayCardPressable: {
    marginBottom: spacing.md,
  },
  dayCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  todayCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.lime,
  },
  todayBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accent.lime,
  },
  restDayCard: {
    opacity: 0.6,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutMeta: {
    marginTop: spacing.sm,
  },
  startButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
});
