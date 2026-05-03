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
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useProgramStore } from '../../store/programStore';
import type { ProgramStackParamList } from '../../types/navigation';

type WorkoutDetailScreenProps = NativeStackScreenProps<ProgramStackParamList, 'WorkoutDetail'>;

// Mock workout data
const MOCK_WORKOUT = {
  id: 'wo-1',
  microcycleId: 'micro-1',
  dayOfWeek: 0,
  name: 'Upper Body Strength',
  description: 'Focus on chest, back, and shoulders',
  durationMinutes: 75,
  intensity: 'High' as const,
  workoutType: 'Strength' as const,
  exercises: [
    {
      id: 'wex-1',
      workoutId: 'wo-1',
      exerciseId: 'ex-1',
      exerciseOrder: 1,
      prescribedSets: 4,
      prescribedRepsMin: 5,
      prescribedRepsMax: 8,
      prescribedWeightKg: 100,
      restSeconds: 120,
      tempo: '3-1-2',
      notes: 'Focus on full range of motion',
      exercise: {
        id: 'ex-1',
        name: 'Bench Press',
        description: 'Barbell bench press',
        muscleGroups: ['Chest', 'Triceps'],
        exerciseType: 'Compound' as const,
        equipmentRequired: ['Barbell', 'Bench'],
        difficultyLevel: 'Intermediate' as const,
        formNotes: 'Keep elbows at 45 degrees',
        createdAt: '2025-01-20T00:00:00Z',
        updatedAt: '2025-01-20T00:00:00Z',
      },
      createdAt: '2025-01-20T00:00:00Z',
      updatedAt: '2025-01-20T00:00:00Z',
    },
    {
      id: 'wex-2',
      workoutId: 'wo-1',
      exerciseId: 'ex-2',
      exerciseOrder: 2,
      prescribedSets: 4,
      prescribedRepsMin: 6,
      prescribedRepsMax: 10,
      prescribedWeightKg: 80,
      restSeconds: 90,
      tempo: '2-0-2',
      notes: 'Controlled movement',
      exercise: {
        id: 'ex-2',
        name: 'Barbell Row',
        description: 'Barbell bent-over rows',
        muscleGroups: ['Back', 'Biceps'],
        exerciseType: 'Compound' as const,
        equipmentRequired: ['Barbell'],
        difficultyLevel: 'Intermediate' as const,
        formNotes: 'Keep back straight, squeeze shoulder blades',
        createdAt: '2025-01-20T00:00:00Z',
        updatedAt: '2025-01-20T00:00:00Z',
      },
      createdAt: '2025-01-20T00:00:00Z',
      updatedAt: '2025-01-20T00:00:00Z',
    },
    {
      id: 'wex-3',
      workoutId: 'wo-1',
      exerciseId: 'ex-3',
      exerciseOrder: 3,
      prescribedSets: 3,
      prescribedRepsMin: 8,
      prescribedRepsMax: 12,
      prescribedWeightKg: 40,
      restSeconds: 60,
      tempo: '2-1-2',
      notes: 'Finish strong',
      exercise: {
        id: 'ex-3',
        name: 'Overhead Press',
        description: 'Barbell overhead press',
        muscleGroups: ['Shoulders', 'Triceps'],
        exerciseType: 'Compound' as const,
        equipmentRequired: ['Barbell'],
        difficultyLevel: 'Intermediate' as const,
        formNotes: 'Brace core, press straight up',
        createdAt: '2025-01-20T00:00:00Z',
        updatedAt: '2025-01-20T00:00:00Z',
      },
      createdAt: '2025-01-20T00:00:00Z',
      updatedAt: '2025-01-20T00:00:00Z',
    },
  ],
  createdAt: '2025-01-20T00:00:00Z',
  updatedAt: '2025-01-20T00:00:00Z',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatPrescription = (
  sets: number,
  repsMin: number,
  repsMax: number,
  weight?: number
): string => {
  const reps = repsMin === repsMax ? `${repsMin}` : `${repsMin}-${repsMax}`;
  if (weight) {
    return `${sets} × ${reps} @ ${weight}kg`;
  }
  return `${sets} × ${reps}`;
};

const formatRest = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s rest`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m rest`;
  }
  return `${minutes}m${remainingSeconds}s rest`;
};

export default function WorkoutDetailScreen({ navigation }: WorkoutDetailScreenProps) {
  const todayWorkout = useProgramStore((state) => state.todayWorkout) || MOCK_WORKOUT;

  useFocusEffect(
    useCallback(() => {
      // Load workout exercises
    }, [])
  );

  const handleStartWorkout = () => {
    // Navigate to workout logging screen
    navigation.navigate('WorkoutLogger', { workoutId: todayWorkout.id });
  };

  const handleExerciseTap = (exerciseId: string) => {
    navigation.navigate('ExerciseDetail', { exerciseId });
  };

  const renderExerciseCard = ({ item, index }: { item: typeof MOCK_WORKOUT.exercises[0]; index: number }) => {
    return (
      <Pressable
        onPress={() => handleExerciseTap(item.exerciseId)}
        style={styles.exerciseCardContainer}
      >
        <Card>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseNumber}>
              <Text
                variant="bodySmallEmphasis"
                color={colors.accent.lime}
              >
                {index + 1}
              </Text>
            </View>
            <View style={styles.exerciseName}>
              <Text
                variant="bodyEmphasis"
                color={colors.text.primary}
              >
                {item.exercise?.name || 'Exercise'}
              </Text>
              {item.exercise?.exerciseType && (
                <Badge
                  text={item.exercise.exerciseType}
                  variant="info"
                  size="sm"
                  style={styles.typeBadge}
                />
              )}
            </View>
          </View>

          <View style={styles.exerciseDivider} />

          <View style={styles.prescriptionContainer}>
            <Text
              variant="body"
              color={colors.text.primary}
              style={styles.prescriptionText}
            >
              {formatPrescription(
                item.prescribedSets,
                item.prescribedRepsMin,
                item.prescribedRepsMax,
                item.prescribedWeightKg
              )}
            </Text>
          </View>

          <View style={styles.restContainer}>
            <Text
              variant="body"
              color={colors.text.secondary}
            >
              {formatRest(item.restSeconds)}
            </Text>
          </View>

          {item.tempo && (
            <View style={styles.tempoContainer}>
              <Text variant="caption" color={colors.text.tertiary}>
                Tempo: {item.tempo}
              </Text>
            </View>
          )}

          {item.notes && (
            <View style={styles.notesContainer}>
              <Text variant="caption" color={colors.text.tertiary} style={styles.notesLabel}>
                Notes:
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                {item.notes}
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text variant="caption" color={colors.text.tertiary}>
              Tap to view form guide
            </Text>
            <Text variant="h4" color={colors.text.tertiary}>
              ›
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

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
            {todayWorkout.name}
          </Text>
          <View style={styles.headerMeta}>
            <Badge
              text={todayWorkout.workoutType || 'Workout'}
              variant="accent"
              size="md"
              style={styles.headerBadgeSpacing}
            />
            <Badge
              text={todayWorkout.intensity}
              variant="warning"
              size="md"
            />
          </View>
        </View>
      </View>

      {/* Workout Info */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Text variant="caption" color={colors.text.tertiary}>
            {DAY_NAMES[todayWorkout.dayOfWeek]}
          </Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoItem}>
          <Text variant="caption" color={colors.text.tertiary}>
            {todayWorkout.durationMinutes}m
          </Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoItem}>
          <Text variant="caption" color={colors.text.tertiary}>
            {todayWorkout.exercises.length} exercises
          </Text>
        </View>
      </View>

      {/* Exercises List */}
      <FlatList
        data={todayWorkout.exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExerciseCard}
        scrollEnabled={false}
        contentContainerStyle={styles.exercisesList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Start Workout Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Start Workout"
          onPress={handleStartWorkout}
          variant="primary"
          fullWidth
        />
      </View>
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
  headerMeta: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  headerBadgeSpacing: {
    marginRight: spacing.sm,
  },
  infoBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.surface.tertiary,
    borderBottomWidth: 1,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.surface.tertiary,
  },
  exercisesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  exerciseCardContainer: {
    marginBottom: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderColor: colors.accent.lime,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  exerciseName: {
    flex: 1,
  },
  typeBadge: {
    marginTop: spacing.xs,
  },
  exerciseDivider: {
    height: 1,
    backgroundColor: colors.surface.tertiary,
    marginBottom: spacing.md,
  },
  prescriptionContainer: {
    marginBottom: spacing.sm,
  },
  prescriptionText: {
    color: colors.accent.lime,
  },
  restContainer: {
    marginBottom: spacing.sm,
  },
  tempoContainer: {
    marginBottom: spacing.sm,
  },
  notesContainer: {
    marginBottom: spacing.sm,
  },
  notesLabel: {
    marginRight: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopColor: colors.surface.tertiary,
    borderTopWidth: 1,
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
