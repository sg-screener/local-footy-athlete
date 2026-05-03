import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  FlatList,
  Pressable,
  RefreshControl,
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
  {
    id: '6',
    date: '20 Feb 2026',
    type: 'Full Body',
    duration: 70,
    feeling: 'Strong',
    exercises: 7,
    totalVolume: 14100,
  },
  {
    id: '7',
    date: '18 Feb 2026',
    type: 'Upper Strength',
    duration: 60,
    feeling: 'Good',
    exercises: 5,
    totalVolume: 9200,
  },
  {
    id: '8',
    date: '15 Feb 2026',
    type: 'Lower Strength',
    duration: 66,
    feeling: 'Cooked',
    exercises: 6,
    totalVolume: 13100,
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

export const WorkoutHistoryScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleWorkoutTap = (workout: any) => {
    navigation.navigate('WorkoutHistoryDetail', { workout });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Card style={{ paddingVertical: spacing.xl, paddingHorizontal: spacing.md }}>
        <Text style={{ color: colors.text.secondary, textAlign: 'center', fontSize: 16 }}>
          No workouts logged yet
        </Text>
      </Card>
    </View>
  );

  const renderWorkout = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => handleWorkoutTap(item)}
      style={({ pressed }) => [styles.workoutItem, pressed && { opacity: 0.7 }]}
    >
      <Card style={{ paddingVertical: spacing.md }}>
        <View style={styles.workoutRow}>
          <View style={{ flex: 1 }}>
            <Text variant="label" style={{ color: colors.text.tertiary, marginBottom: spacing.xs }}>
              {item.date}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: colors.surface.tertiary },
                ]}
              >
                <Text variant="caption" style={{ color: colors.accent.lime }}>
                  {item.type}
                </Text>
              </View>
            </View>
            <View style={styles.workoutMeta}>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginRight: spacing.md }}>
                {item.duration} min
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary, marginRight: spacing.md }}>
                {item.exercises} ex
              </Text>
              <Text variant="caption" style={{ color: colors.text.tertiary }}>
                {item.totalVolume.toLocaleString()} kg
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>{getFeelingEmoji(item.feeling)}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          Workout History
        </Text>
      </View>

      <FlatList
        data={MOCK_WORKOUTS}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkout}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.lime}
          />
        }
      />
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
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  workoutItem: {
    marginBottom: spacing.md,
  },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
});
