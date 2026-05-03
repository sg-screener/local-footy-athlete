import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

// Mock today's workouts
const MOCK_TODAYS_WORKOUTS = [
  {
    id: '1',
    type: 'Lower Strength',
    focus: 'Quadriceps & Hamstrings',
    estimatedDuration: 65,
    exerciseCount: 6,
  },
];

// Mock fallback workouts if store is empty
const MOCK_AVAILABLE_WORKOUTS = [
  {
    id: '1',
    type: 'Lower Strength',
    focus: 'Quadriceps & Hamstrings',
    estimatedDuration: 65,
    exerciseCount: 6,
  },
  {
    id: '2',
    type: 'Upper Strength',
    focus: 'Chest & Back',
    estimatedDuration: 58,
    exerciseCount: 5,
  },
  {
    id: '3',
    type: 'Full Body',
    focus: 'All Muscle Groups',
    estimatedDuration: 72,
    exerciseCount: 8,
  },
];

export const LogWorkoutScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // Use mock data (in real app, would pull from programStore.todayWorkout)
  const todaysWorkouts = MOCK_TODAYS_WORKOUTS.length > 0 ? MOCK_TODAYS_WORKOUTS : null;

  const handleWorkoutSelect = (workout: any) => {
    // Navigate to WorkoutLogger with selected workout
    navigation.navigate('WorkoutLogger', { workout });
  };

  const handleQuickLog = () => {
    // Navigate to WorkoutLogger in quick/freestyle mode
    navigation.navigate('WorkoutLogger', { quickLog: true });
  };

  const renderWorkoutCard = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => handleWorkoutSelect(item)}
      style={({ pressed }) => [styles.workoutButton, pressed && { opacity: 0.7 }]}
    >
      <Card>
        <View style={styles.workoutCardContent}>
          <View style={{ flex: 1 }}>
            <Text
              variant="h4"
              style={{ color: colors.text.primary, marginBottom: spacing.sm }}
            >
              {item.type}
            </Text>
            <Text
              variant="label"
              style={{ color: colors.text.tertiary, marginBottom: spacing.md }}
            >
              {item.focus}
            </Text>
            <View style={styles.workoutMeta}>
              <Text variant="caption" style={{ color: colors.text.secondary, marginRight: spacing.md }}>
                {item.estimatedDuration} min
              </Text>
              <Text variant="caption" style={{ color: colors.text.secondary }}>
                {item.exerciseCount} exercises
              </Text>
            </View>
          </View>
          <View style={styles.startButton}>
            <Text style={{ fontSize: 20, color: colors.accent.lime }}>→</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );

  const renderNoWorkout = () => (
    <View style={styles.emptyContainer}>
      <Card style={styles.emptyCard}>
        <Text
          variant="h4"
          style={{ color: colors.text.primary, marginBottom: spacing.md, textAlign: 'center' }}
        >
          No scheduled workout today
        </Text>
        <Text
          style={{
            color: colors.text.secondary,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: spacing.lg,
          }}
        >
          You don't have a programmed workout for today. Start a freestyle session or come back tomorrow!
        </Text>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text variant="h2" style={{ color: colors.text.primary, marginBottom: spacing.sm }}>
            Choose a Workout
          </Text>
          <Text variant="label" style={{ color: colors.text.tertiary }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* Workouts List */}
        {todaysWorkouts && todaysWorkouts.length > 0 ? (
          <View style={styles.workoutsSection}>
            <FlatList
              scrollEnabled={false}
              data={todaysWorkouts}
              keyExtractor={(item) => item.id}
              renderItem={renderWorkoutCard}
            />
          </View>
        ) : (
          renderNoWorkout()
        )}

        {/* Quick Log Section */}
        <View style={styles.quickLogSection}>
          <Text
            variant="h4"
            style={{ color: colors.text.primary, marginBottom: spacing.md }}
          >
            Or start freestyle
          </Text>
          <Pressable
            onPress={handleQuickLog}
            style={({ pressed }) => [styles.quickLogButton, pressed && { opacity: 0.7 }]}
          >
            <Card style={{ paddingVertical: spacing.lg }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>⚡</Text>
                <Text
                  variant="label"
                  style={{ color: colors.accent.lime, textAlign: 'center' }}
                >
                  Quick Log
                </Text>
                <Text
                  variant="caption"
                  style={{
                    color: colors.text.tertiary,
                    marginTop: spacing.xs,
                    textAlign: 'center',
                  }}
                >
                  Log any workout on the fly
                </Text>
              </View>
            </Card>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerSection: {
    marginBottom: spacing.lg,
  },
  workoutsSection: {
    marginBottom: spacing.xl,
  },
  workoutButton: {
    marginBottom: spacing.md,
  },
  workoutCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButton: {
    marginLeft: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  quickLogSection: {
    marginBottom: spacing.xl,
  },
  quickLogButton: {
    marginBottom: spacing.md,
  },
});
