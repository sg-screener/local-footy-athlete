import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
  SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';

// Mock data for a single exercise history
const MOCK_EXERCISE_HISTORY = {
  name: 'Squat',
  type: 'Barbell',
  primaryMuscle: 'Quadriceps',
  difficulty: 'Advanced',
  history: [
    {
      date: '2 Mar 2026',
      sets: [
        { set: 1, reps: 5, weight: 120 },
        { set: 2, reps: 5, weight: 130 },
        { set: 3, reps: 5, weight: 140 },
        { set: 4, reps: 3, weight: 145 },
      ],
    },
    {
      date: '26 Feb 2026',
      sets: [
        { set: 1, reps: 5, weight: 120 },
        { set: 2, reps: 5, weight: 130 },
        { set: 3, reps: 5, weight: 140 },
      ],
    },
    {
      date: '20 Feb 2026',
      sets: [
        { set: 1, reps: 5, weight: 115 },
        { set: 2, reps: 5, weight: 125 },
        { set: 3, reps: 5, weight: 135 },
      ],
    },
    {
      date: '15 Feb 2026',
      sets: [
        { set: 1, reps: 5, weight: 115 },
        { set: 2, reps: 5, weight: 125 },
        { set: 3, reps: 5, weight: 140 },
      ],
    },
    {
      date: '10 Feb 2026',
      sets: [
        { set: 1, reps: 5, weight: 110 },
        { set: 2, reps: 5, weight: 120 },
        { set: 3, reps: 5, weight: 130 },
      ],
    },
  ],
  bestPerformance: {
    maxWeight: 145,
    maxReps: 5,
    maxVolume: 700,
  },
};

export const ExerciseHistoryScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  // Use route params if available, otherwise use mock data
  const exercise = route.params?.exercise || MOCK_EXERCISE_HISTORY;

  const handleBack = () => {
    navigation.goBack();
  };

  // Transform history into sections for SectionList
  const sections = exercise.history.map((item: any) => ({
    title: item.date,
    data: item.sets,
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          {formatExerciseDisplayName(exercise.name) || exercise.name}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Exercise Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
                Type
              </Text>
              <Text variant="label" style={{ color: colors.text.primary }}>
                {exercise.type}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
                Primary Muscle
              </Text>
              <Text variant="label" style={{ color: colors.text.primary }}>
                {exercise.primaryMuscle}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
                Difficulty
              </Text>
              <Text variant="label" style={{ color: colors.text.primary }}>
                {exercise.difficulty}
              </Text>
            </View>
          </View>
        </Card>

        {/* History Section */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            History
          </Text>

          {exercise.history.map((item: any, index: number) => (
            <View key={index} style={styles.dateSection}>
              <Text
                variant="label"
                style={{
                  color: colors.accent.lime,
                  marginBottom: spacing.md,
                  fontSize: 14,
                  fontWeight: '600',
                }}
              >
                {item.date}
              </Text>

              {item.sets.map((set: any, setIndex: number) => (
                <View key={setIndex} style={styles.setItem}>
                  <Text style={{ color: colors.text.secondary }}>
                    Set {set.set}: {set.reps} reps @ {set.weight} kg
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Best Performance Card */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Best Performance
          </Text>

          <Card style={styles.bestPerfCard}>
            <View style={styles.bestPerfRow}>
              <View style={{ flex: 1 }}>
                <Text
                  variant="caption"
                  style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}
                >
                  Max Weight
                </Text>
                <Text
                  variant="h3"
                  style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
                >
                  {exercise.bestPerformance.maxWeight}
                </Text>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  kg
                </Text>
              </View>

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text
                  variant="caption"
                  style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}
                >
                  Max Reps
                </Text>
                <Text
                  variant="h3"
                  style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
                >
                  {exercise.bestPerformance.maxReps}
                </Text>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  reps
                </Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text
                  variant="caption"
                  style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}
                >
                  Max Volume
                </Text>
                <Text
                  variant="h3"
                  style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
                >
                  {exercise.bestPerformance.maxVolume}
                </Text>
                <Text variant="caption" style={{ color: colors.text.tertiary }}>
                  total
                </Text>
              </View>
            </View>
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
  infoCard: {
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  section: {
    marginBottom: spacing.lg,
  },
  dateSection: {
    marginBottom: spacing.md,
  },
  setItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  bestPerfCard: {
    marginBottom: spacing.md,
  },
  bestPerfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
