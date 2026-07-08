import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  FlatList,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import { useProgramStore } from '../../store/programStore';
import type { ProgramStackParamList } from '../../types/navigation';
import { getTeamTrainingWorkoutState } from '../../utils/teamTraining';

type MicrocycleDetailScreenProps = NativeStackScreenProps<ProgramStackParamList, 'MicrocycleDetail'>;

// Mock workout data
const MOCK_WORKOUTS = [
  {
    id: 'wo-1',
    microcycleId: 'micro-1',
    dayOfWeek: 0,
    name: 'Upper Body Strength',
    description: 'Focus on chest, back, and shoulders',
    durationMinutes: 75,
    intensity: 'High' as const,
    workoutType: 'Strength' as const,
    exercises: [
      { id: 'ex-1', name: 'Bench Press', order: 1 },
      { id: 'ex-2', name: 'Barbell Row', order: 2 },
      { id: 'ex-3', name: 'Overhead Press', order: 3 },
    ],
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
  },
  {
    id: 'wo-2',
    microcycleId: 'micro-1',
    dayOfWeek: 1,
    name: 'Conditioning',
    description: 'Sprint intervals and conditioning',
    durationMinutes: 45,
    intensity: 'Maximal' as const,
    workoutType: 'Sprint-Intervals' as const,
    exercises: [],
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
  },
  {
    id: 'wo-3',
    microcycleId: 'micro-1',
    dayOfWeek: 2,
    name: null,
    description: null,
    durationMinutes: 0,
    intensity: 'Light' as const,
    workoutType: null,
    exercises: [],
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
  },
  {
    id: 'wo-4',
    microcycleId: 'micro-1',
    dayOfWeek: 3,
    name: 'Lower Body Strength',
    description: 'Quads, hamstrings, and glutes',
    durationMinutes: 80,
    intensity: 'High' as const,
    workoutType: 'Strength' as const,
    exercises: [
      { id: 'ex-4', name: 'Back Squats', order: 1 },
      { id: 'ex-5', name: 'Deadlifts', order: 2 },
      { id: 'ex-6', name: 'Leg Press', order: 3 },
    ],
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
  },
  {
    id: 'wo-5',
    microcycleId: 'micro-1',
    dayOfWeek: 4,
    name: null,
    description: null,
    durationMinutes: 0,
    intensity: 'Light' as const,
    workoutType: null,
    exercises: [],
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
  },
  {
    id: 'wo-6',
    microcycleId: 'micro-1',
    dayOfWeek: 5,
    name: 'MetCon',
    description: 'Metabolic conditioning',
    durationMinutes: 30,
    intensity: 'Moderate' as const,
    workoutType: 'MetCon' as const,
    exercises: [],
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
  },
  {
    id: 'wo-7',
    microcycleId: 'micro-1',
    dayOfWeek: 6,
    name: null,
    description: null,
    durationMinutes: 0,
    intensity: 'Light' as const,
    workoutType: null,
    exercises: [],
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
  },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function MicrocycleDetailScreen() {
  const navigation = useNavigation<any>();
  const currentMicrocycle = useProgramStore((state) => state.currentMicrocycle);

  useFocusEffect(
    useCallback(() => {
      // Load microcycle workouts
    }, [])
  );

  const handleWorkoutTap = (workoutId: string) => {
    const workout = MOCK_WORKOUTS.find((w) => w.id === workoutId);
    if (workout && workout.name) {
      useProgramStore.getState().setTodayWorkout(workout as any);
      navigation.navigate('WorkoutDetail');
    }
  };

  const getCurrentDayOfWeek = () => {
    return new Date().getDay();
  };

  const getIntensityBadgeVariant = (intensity: string) => {
    switch (intensity) {
      case 'Maximal':
        return 'error' as const;
      case 'High':
        return 'warning' as const;
      case 'Moderate':
        return 'info' as const;
      case 'Light':
        return 'success' as const;
      default:
        return 'info' as const;
    }
  };

  const renderDayCard = ({ item, index }: { item: typeof MOCK_WORKOUTS[0]; index: number }) => {
    const isToday = index === getCurrentDayOfWeek();
    const isRestDay = !item.name;
    const exerciseCount = getTeamTrainingWorkoutState(item as any).renderableExercises.length;

    return (
      <Pressable
        onPress={() => !isRestDay && handleWorkoutTap(item.id)}
        disabled={isRestDay}
        style={[
          styles.dayCard,
          isToday && styles.dayCardToday,
        ]}
      >
        <Card style={[isRestDay && styles.restDayCard]}>
          <View style={styles.cardContent}>
            {/* Left Border Highlight for Today */}
            {isToday && <View style={styles.todayIndicator} />}

            <View style={styles.dayInfo}>
              <Text
                variant="bodyEmphasis"
                color={isToday ? colors.accent.lime : colors.text.primary}
              >
                {DAY_NAMES[index]}
              </Text>

              {isRestDay ? (
                <Text
                  variant="body"
                  color={colors.text.tertiary}
                  style={styles.restDayText}
                >
                  Rest Day
                </Text>
              ) : (
                <>
                  <Text
                    variant="body"
                    color={colors.text.secondary}
                    style={styles.workoutName}
                  >
                    {item.name}
                  </Text>
                  <Text
                    variant="caption"
                    color={colors.text.tertiary}
                  >
                    {item.description}
                  </Text>
                </>
              )}
            </View>

            {!isRestDay && (
              <View style={styles.cardRight}>
                <View style={styles.details}>
                  {(item as any).sessionTier && (
                    <SessionTierBadge tier={(item as any).sessionTier} style={styles.detailBadge} />
                  )}
                  <Badge
                    text={item.intensity}
                    variant={getIntensityBadgeVariant(item.intensity)}
                    size="sm"
                    style={styles.detailBadge}
                  />
                  <Text
                    variant="caption"
                    color={colors.text.tertiary}
                  >
                    {exerciseCount} exercises
                  </Text>
                  <Text
                    variant="caption"
                    color={colors.text.tertiary}
                  >
                    {item.durationMinutes}m
                  </Text>
                </View>
                <Text
                  variant="h3"
                  color={colors.text.tertiary}
                  style={styles.arrow}
                >
                  ›
                </Text>
              </View>
            )}
          </View>
        </Card>
      </Pressable>
    );
  };

  if (!currentMicrocycle) {
    return (
      <SafeAreaView style={styles.container}>
        <Text variant="body" color={colors.text.secondary}>
          No microcycle selected
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text variant="h3" color={colors.text.primary}>
            ←
          </Text>
        </Pressable>
        <View style={styles.headerTitle}>
          <Text variant="h2" color={colors.text.primary}>
            Week {currentMicrocycle.weekNumber}
          </Text>
          <Badge
            text={`Intensity: ${(currentMicrocycle.intensityMultiplier * 100).toFixed(0)}%`}
            variant="accent"
            size="md"
            style={styles.headerBadge}
          />
        </View>
      </View>

      {/* Date Range */}
      <View style={styles.dateRange}>
        <Text variant="caption" color={colors.text.secondary} align="center">
          {new Date(currentMicrocycle.startDate).toLocaleDateString()} - {new Date(currentMicrocycle.endDate).toLocaleDateString()}
        </Text>
      </View>

      {/* Days List */}
      <FlatList
        data={MOCK_WORKOUTS}
        keyExtractor={(item) => item.id}
        renderItem={renderDayCard}
        scrollEnabled={false}
        contentContainerStyle={styles.daysList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.secondary,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  headerTitle: {
    flex: 1,
  },
  headerBadge: {
    marginTop: spacing.sm,
  },
  dateRange: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  daysList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  dayCard: {
    position: 'relative',
  },
  dayCardToday: {
  },
  todayIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accent.lime,
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInfo: {
    flex: 1,
    paddingLeft: spacing.md,
  },
  workoutName: {
    marginTop: spacing.xs,
  },
  restDayText: {
    marginTop: spacing.xs,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  details: {
    alignItems: 'flex-end',
  },
  detailBadge: {
    marginBottom: spacing.xs,
  },
  arrow: {
    marginTop: spacing.sm,
  },
  restDayCard: {
    backgroundColor: 'rgba(200, 255, 0, 0.05)',
  },
});
