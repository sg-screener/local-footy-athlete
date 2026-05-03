import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Pressable,
  FlatList,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Loading } from '../../components/common/Loading';
import { SelectableTile } from '../../components/common';
import type { ProgramStackParamList } from '../../types/navigation';

type ExerciseLibraryScreenProps = NativeStackScreenProps<ProgramStackParamList, 'ExerciseLibrary'>;

// Mock exercise data
const SAMPLE_EXERCISES = [
  {
    id: 'ex-1',
    name: 'Barbell Bench Press',
    exerciseType: 'Compound',
    muscleGroups: ['Chest', 'Triceps'],
    difficultyLevel: 'Intermediate',
  },
  {
    id: 'ex-2',
    name: 'Barbell Row',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Biceps'],
    difficultyLevel: 'Intermediate',
  },
  {
    id: 'ex-3',
    name: 'Back Squats',
    exerciseType: 'Compound',
    muscleGroups: ['Quads', 'Glutes'],
    difficultyLevel: 'Advanced',
  },
  {
    id: 'ex-4',
    name: 'Deadlifts',
    exerciseType: 'Compound',
    muscleGroups: ['Back', 'Glutes', 'Hamstrings'],
    difficultyLevel: 'Advanced',
  },
  {
    id: 'ex-5',
    name: 'Dumbbell Curls',
    exerciseType: 'Isolation',
    muscleGroups: ['Biceps'],
    difficultyLevel: 'Beginner',
  },
  {
    id: 'ex-6',
    name: 'Dips',
    exerciseType: 'Isolation',
    muscleGroups: ['Triceps'],
    difficultyLevel: 'Intermediate',
  },
  {
    id: 'ex-7',
    name: 'Box Jumps',
    exerciseType: 'Plyometric',
    muscleGroups: ['Quads', 'Glutes'],
    difficultyLevel: 'Intermediate',
  },
  {
    id: 'ex-8',
    name: 'Burpees',
    exerciseType: 'Plyometric',
    muscleGroups: ['Full Body'],
    difficultyLevel: 'Advanced',
  },
  {
    id: 'ex-9',
    name: 'Push-ups',
    exerciseType: 'Compound',
    muscleGroups: ['Chest', 'Triceps'],
    difficultyLevel: 'Beginner',
  },
  {
    id: 'ex-10',
    name: 'Leg Press',
    exerciseType: 'Compound',
    muscleGroups: ['Quads', 'Glutes'],
    difficultyLevel: 'Beginner',
  },
];

type FilterType = 'All' | 'Compound' | 'Isolation' | 'Plyometric';

export default function ExerciseLibraryScreen({ navigation }: ExerciseLibraryScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [isLoading] = useState(false);

  const filteredExercises = useMemo(() => {
    let results = SAMPLE_EXERCISES;

    // Filter by type
    if (selectedFilter !== 'All') {
      results = results.filter((ex) => ex.exerciseType === selectedFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      results = results.filter((ex) =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return results;
  }, [searchQuery, selectedFilter]);

  const handleExerciseTap = (exerciseId: string) => {
    navigation.navigate('ExerciseDetail', { exerciseId });
  };

  const renderExerciseItem = ({ item }: { item: typeof SAMPLE_EXERCISES[0] }) => {
    return (
      <Pressable
        onPress={() => handleExerciseTap(item.id)}
        style={styles.exerciseItemContainer}
      >
        <Card>
          <View style={styles.exerciseItemContent}>
            <View style={styles.exerciseInfo}>
              <Text variant="bodyEmphasis" color={colors.text.primary}>
                {item.name}
              </Text>
              <View style={styles.exerciseMeta}>
                <Badge
                  text={item.exerciseType}
                  variant="accent"
                  size="sm"
                  style={styles.metaBadge}
                />
                <Badge
                  text={item.difficultyLevel}
                  variant="info"
                  size="sm"
                />
              </View>
              <View style={styles.muscleGroupsContainer}>
                {item.muscleGroups.map((muscle, index) => (
                  <Text
                    key={index}
                    variant="caption"
                    color={colors.text.tertiary}
                    style={styles.muscleTag}
                  >
                    {muscle}
                  </Text>
                ))}
              </View>
            </View>
            <Text variant="h3" color={colors.text.tertiary}>
              ›
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Loading />
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
        <Text variant="h2" color={colors.text.primary}>
          Exercise Library
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exercises..."
          style={styles.searchInput}
        />
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
        style={styles.filtersScroll}
      >
        {/*
          Filter chips use the shared SelectableTile primitive (chip shape,
          no checkmark — filter pills read as nav-like and checkmarks
          would crowd them). Pill radius is preserved via override.
        */}
        {(['All', 'Compound', 'Isolation', 'Plyometric'] as FilterType[]).map((filter) => (
          <SelectableTile
            key={filter}
            shape="chip"
            isSelected={selectedFilter === filter}
            hideCheckmark
            onPress={() => setSelectedFilter(filter)}
            style={styles.filterChip}
          >
            <Text
              variant="bodySmall"
              color={
                selectedFilter === filter
                  ? colors.text.primary
                  : colors.text.secondary
              }
            >
              {filter}
            </Text>
          </SelectableTile>
        ))}
      </ScrollView>

      {/* Exercises List */}
      {filteredExercises.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="body" color={colors.text.secondary} align="center">
            {searchQuery.trim() ? 'No exercises found' : 'No exercises available'}
          </Text>
          {searchQuery.trim() && (
            <Text
              variant="caption"
              color={colors.text.tertiary}
              align="center"
              style={styles.emptyText}
            >
              Try a different search term
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExerciseItem}
          contentContainerStyle={styles.exercisesList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          scrollEnabled={true}
        />
      )}
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
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchInput: {
    marginBottom: 0,
  },
  filtersScroll: {
    borderBottomColor: colors.surface.tertiary,
    borderBottomWidth: 1,
  },
  filtersContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Layout-only overrides. The shared SelectableTile (chip shape) owns
  // the selected look; this just re-asserts a fully pill-shaped radius
  // and horizontal spacing for the row of filters.
  filterChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.md,
  },
  exercisesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  exerciseItemContainer: {
    marginBottom: spacing.md,
  },
  exerciseItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  exerciseMeta: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  metaBadge: {
    marginRight: spacing.sm,
  },
  muscleGroupsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  muscleTag: {
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    marginTop: spacing.sm,
  },
});
