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

// Mock data for testing
const MOCK_WORKOUTS = [
  {
    id: '1',
    date: '2 Mar 2026',
    type: 'Lower Strength',
    duration: 65,
    feeling: 'Strong',
    exercises: 6,
    totalVolume: 12500,
  },
  {
    id: '2',
    date: '28 Feb 2026',
    type: 'Upper Strength',
    duration: 58,
    feeling: 'Good',
    exercises: 5,
    totalVolume: 8900,
  },
  {
    id: '3',
    date: '26 Feb 2026',
    type: 'Full Body',
    duration: 72,
    feeling: 'Cooked',
    exercises: 8,
    totalVolume: 15200,
  },
  {
    id: '4',
    date: '24 Feb 2026',
    type: 'Upper Strength',
    duration: 55,
    feeling: 'Average',
    exercises: 5,
    totalVolume: 8100,
  },
  {
    id: '5',
    date: '22 Feb 2026',
    type: 'Lower Strength',
    duration: 68,
    feeling: 'Sore',
    exercises: 6,
    totalVolume: 11800,
  },
];

const MOCK_PERSONAL_RECORDS = [
  {
    id: '1',
    exercise: 'Squat',
    weight: 140,
    reps: 5,
    date: '15 Feb 2026',
  },
  {
    id: '2',
    exercise: 'Bench Press',
    weight: 100,
    reps: 5,
    date: '28 Feb 2026',
  },
  {
    id: '3',
    exercise: 'Deadlift',
    weight: 160,
    reps: 3,
    date: '22 Feb 2026',
  },
];

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

export const JournalHomeScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handleWorkoutTap = (workout: any) => {
    navigation.navigate('WorkoutHistoryDetail', { workout });
  };

  const handleSeeAllPRs = () => {
    navigation.navigate('PersonalRecords');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h2" style={{ color: colors.text.primary }}>
            JOURNAL
          </Text>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <Card style={{ flex: 1, marginRight: spacing.sm }}>
            <Text variant="caption" style={{ color: colors.text.tertiary }}>
              This Week
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime, marginTop: spacing.xs }}
            >
              3/5
            </Text>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginTop: spacing.xs }}>
              workouts
            </Text>
          </Card>

          <Card style={{ flex: 1, marginHorizontal: spacing.sm }}>
            <Text variant="caption" style={{ color: colors.text.tertiary }}>
              Total Volume
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime, marginTop: spacing.xs }}
            >
              48kg
            </Text>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginTop: spacing.xs }}>
              this week
            </Text>
          </Card>

          <Card style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text variant="caption" style={{ color: colors.text.tertiary }}>
              Current Streak
            </Text>
            <Text
              variant="h3"
              style={{ color: colors.accent.lime, marginTop: spacing.xs }}
            >
              8
            </Text>
            <Text variant="caption" style={{ color: colors.text.tertiary, marginTop: spacing.xs }}>
              days
            </Text>
          </Card>
        </View>

        {/* Recent Workouts Section */}
        <View style={styles.section}>
          <Text variant="h3" style={{ color: colors.text.primary, marginBottom: spacing.md }}>
            Recent Workouts
          </Text>

          {MOCK_WORKOUTS.length === 0 ? (
            <Card style={{ paddingVertical: spacing.lg }}>
              <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
                No workouts logged yet. Start your first session!
              </Text>
            </Card>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={MOCK_WORKOUTS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleWorkoutTap(item)}
                  style={({ pressed }) => [
                    styles.workoutCard,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Card style={{ marginBottom: spacing.md }}>
                    <View style={styles.workoutHeader}>
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="label"
                          style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}
                        >
                          {item.date}
                        </Text>
                        <Text variant="h4" style={{ color: colors.text.primary }}>
                          {item.type}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 24 }}>{getFeelingEmoji(item.feeling)}</Text>
                    </View>

                    <View style={styles.workoutDetails}>
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" style={{ color: colors.text.tertiary }}>
                          {item.duration} min
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" style={{ color: colors.text.tertiary }}>
                          {item.exercises} exercises
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" style={{ color: colors.text.tertiary }}>
                          {item.totalVolume.toLocaleString()} kg
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              )}
            />
          )}
        </View>

        {/* Personal Records Section */}
        <View style={styles.section}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Text variant="h3" style={{ color: colors.text.primary }}>
              Personal Records
            </Text>
            <Pressable onPress={handleSeeAllPRs}>
              <Text style={{ color: colors.accent.lime, fontSize: 14, fontWeight: '600' }}>
                See All
              </Text>
            </Pressable>
          </View>

          {MOCK_PERSONAL_RECORDS.map((pr) => (
            <Card key={pr.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.prCard}>
                <View style={{ flex: 1 }}>
                  <Text variant="label" style={{ color: colors.text.tertiary }}>
                    {pr.exercise}
                  </Text>
                  <Text
                    variant="h3"
                    style={{ color: colors.accent.lime, marginTop: spacing.xs }}
                  >
                    {pr.weight}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 24, marginBottom: spacing.xs }}>🏆</Text>
                  <Text variant="caption" style={{ color: colors.text.tertiary }}>
                    {pr.reps}x @ {pr.date}
                  </Text>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  workoutCard: {
    marginBottom: spacing.md,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  workoutDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
