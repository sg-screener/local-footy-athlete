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
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';

// Mock data for a sample workout
const MOCK_WORKOUT_DETAIL = {
  id: '1',
  date: '2 Mar 2026',
  type: 'Lower Strength',
  duration: 65,
  feeling: 'Strong',
  exercises: [
    {
      id: 'ex1',
      name: 'Squat',
      sets: [
        { set: 1, reps: 5, weight: 120 },
        { set: 2, reps: 5, weight: 130 },
        { set: 3, reps: 5, weight: 140 },
        { set: 4, reps: 3, weight: 145 },
      ],
      bestSet: 3,
    },
    {
      id: 'ex2',
      name: 'Romanian Deadlift',
      sets: [
        { set: 1, reps: 6, weight: 110 },
        { set: 2, reps: 6, weight: 115 },
        { set: 3, reps: 5, weight: 120 },
      ],
      bestSet: 2,
    },
    {
      id: 'ex3',
      name: 'Leg Press',
      sets: [
        { set: 1, reps: 8, weight: 200 },
        { set: 2, reps: 8, weight: 200 },
        { set: 3, reps: 6, weight: 210 },
      ],
      bestSet: 2,
    },
    {
      id: 'ex4',
      name: 'Leg Curl',
      sets: [
        { set: 1, reps: 10, weight: 60 },
        { set: 2, reps: 10, weight: 60 },
      ],
      bestSet: 1,
    },
    {
      id: 'ex5',
      name: 'Calf Raises',
      sets: [
        { set: 1, reps: 15, weight: 80 },
        { set: 2, reps: 15, weight: 80 },
      ],
      bestSet: 0,
    },
    {
      id: 'ex6',
      name: 'Ab Wheel',
      sets: [
        { set: 1, reps: 8, weight: 0 },
        { set: 2, reps: 8, weight: 0 },
      ],
      bestSet: 0,
    },
  ],
  totalVolume: 12500,
  notes: 'Great session! Felt strong throughout. Squat 5RM felt solid.',
};

const getFeelingEmoji = (feeling: string): string => {
  const emojis: { [key: string]: string } = {
    Cooked: '🔥',
    Strong: '💪',
    Good: '✅',
    Average: '😐',
    Sore: '🤕',
  };
  return emojis[feeling] || '😐';
};

export const WorkoutHistoryDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  // Use route params if available, otherwise use mock data
  const workout = route.params?.workout || MOCK_WORKOUT_DETAIL;

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text variant="h2" style={{ color: colors.text.primary }}>
            {workout.date}
          </Text>
          <Text variant="label" style={{ color: colors.text.tertiary, marginTop: spacing.xs }}>
            {workout.type}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                Duration
              </Text>
              <Text
                variant="h3"
                style={{ color: colors.accent.lime, marginTop: spacing.xs }}
              >
                {workout.duration}
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                minutes
              </Text>
            </View>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                Total Volume
              </Text>
              <Text
                variant="h3"
                style={{ color: colors.accent.lime, marginTop: spacing.xs }}
              >
                {(workout.totalVolume / 1000).toFixed(1)}
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                tonnes
              </Text>
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                Feeling
              </Text>
              <Text
                variant="h3"
                style={{ marginTop: spacing.xs }}
              >
                {getFeelingEmoji(workout.feeling)}
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                {workout.feeling}
              </Text>
            </View>
          </View>
        </Card>

        {/* Exercise Breakdown */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Exercises ({workout.exercises.length})
          </Text>

          {workout.exercises.map((exercise: any) => (
            <Card key={exercise.id} style={styles.exerciseCard}>
              <Text
                variant="h4"
                style={{ color: colors.text.primary, marginBottom: spacing.md }}
              >
                {formatExerciseDisplayName(exercise.name) || exercise.name}
              </Text>

              {/* Sets Table */}
              <View style={styles.setsTable}>
                <View style={styles.setsHeader}>
                  <Text
                    variant="caption"
                    style={{
                      flex: 1,
                      color: colors.text.tertiary,
                      fontWeight: '600',
                    }}
                  >
                    Set
                  </Text>
                  <Text
                    variant="caption"
                    style={{
                      flex: 1,
                      color: colors.text.tertiary,
                      fontWeight: '600',
                    }}
                  >
                    Reps
                  </Text>
                  <Text
                    variant="caption"
                    style={{
                      flex: 1,
                      color: colors.text.tertiary,
                      fontWeight: '600',
                    }}
                  >
                    Weight (kg)
                  </Text>
                </View>

                {exercise.sets.map((set: any, index: number) => (
                  <View
                    key={index}
                    style={[
                      styles.setRow,
                      index === exercise.bestSet && styles.bestSetRow,
                    ]}
                  >
                    <Text
                      variant="label"
                      style={{
                        flex: 1,
                        color:
                          index === exercise.bestSet
                            ? colors.accent.lime
                            : colors.text.primary,
                      }}
                    >
                      {set.set}
                    </Text>
                    <Text
                      variant="label"
                      style={{
                        flex: 1,
                        color:
                          index === exercise.bestSet
                            ? colors.accent.lime
                            : colors.text.primary,
                      }}
                    >
                      {set.reps}
                    </Text>
                    <Text
                      variant="label"
                      style={{
                        flex: 1,
                        color:
                          index === exercise.bestSet
                            ? colors.accent.lime
                            : colors.text.primary,
                      }}
                    >
                      {set.weight > 0 ? set.weight : '-'}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </View>

        {/* Notes Section */}
        {workout.notes && (
          <View style={styles.section}>
            <Text
              variant="h3"
              style={{ color: colors.text.primary, marginBottom: spacing.md }}
            >
              Notes
            </Text>
            <Card>
              <Text style={{ color: colors.text.secondary, lineHeight: 22 }}>
                {workout.notes}
              </Text>
            </Card>
          </View>
        )}
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
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  section: {
    marginBottom: spacing.lg,
  },
  exerciseCard: {
    marginBottom: spacing.md,
  },
  setsTable: {
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  setsHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface.tertiary,
  },
  bestSetRow: {
    backgroundColor: colors.surface.tertiary,
  },
});
