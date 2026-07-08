import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  FlatList,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useProgramStore } from '../../store/programStore';
import type { ProgramStackParamList } from '../../types/navigation';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';

type CustomizeWorkoutScreenProps = NativeStackScreenProps<ProgramStackParamList, 'CustomizeWorkout'>;

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
      exercise: {
        id: 'ex-1',
        name: 'Bench Press',
      },
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
      exercise: {
        id: 'ex-2',
        name: 'Barbell Row',
      },
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
      exercise: {
        id: 'ex-3',
        name: 'Overhead Press',
      },
    },
  ],
  createdAt: '2025-01-20T00:00:00Z',
  updatedAt: '2025-01-20T00:00:00Z',
};

// Replacement options grouped by movement pattern
const REPLACEMENT_OPTIONS: Record<string, { id: string; name: string }[]> = {
  'Bench Press': [
    { id: 'ex-11', name: 'Dumbbell Bench Press' },
    { id: 'ex-12', name: 'Machine Chest Press' },
    { id: 'ex-13', name: 'Push-ups' },
  ],
  'Barbell Row': [
    { id: 'ex-21', name: 'Dumbbell Rows' },
    { id: 'ex-22', name: 'Machine Rows' },
    { id: 'ex-23', name: 'Pendulum Rows' },
  ],
  'Overhead Press': [
    { id: 'ex-31', name: 'Dumbbell Press' },
    { id: 'ex-32', name: 'Machine Press' },
    { id: 'ex-33', name: 'Pike Push-ups' },
  ],
};

interface CustomExerciseState {
  workoutExerciseId: string;
  selectedReplacementId: string | null;
  showReplacements: boolean;
}

export default function CustomizeWorkoutScreen({ navigation }: CustomizeWorkoutScreenProps) {
  const todayWorkout = useProgramStore((state) => state.todayWorkout) || MOCK_WORKOUT;
  const [customizations, setCustomizations] = useState<CustomExerciseState[]>(
    todayWorkout.exercises.map((ex) => ({
      workoutExerciseId: ex.id,
      selectedReplacementId: null,
      showReplacements: false,
    }))
  );

  const handleToggleReplacements = (workoutExerciseId: string) => {
    setCustomizations((prev) =>
      prev.map((custom) =>
        custom.workoutExerciseId === workoutExerciseId
          ? { ...custom, showReplacements: !custom.showReplacements }
          : custom
      )
    );
  };

  const handleSelectReplacement = (workoutExerciseId: string, replacementId: string) => {
    setCustomizations((prev) =>
      prev.map((custom) =>
        custom.workoutExerciseId === workoutExerciseId
          ? {
              ...custom,
              selectedReplacementId: replacementId,
              showReplacements: false,
            }
          : custom
      )
    );
  };

  const handleSave = () => {
    // Apply customizations to the workout
    // For now, just navigate back
    navigation.goBack();
  };

  const renderExerciseRow = ({ item, index }: { item: typeof MOCK_WORKOUT.exercises[0]; index: number }) => {
    const customization = customizations[index];
    const replacementOptions = REPLACEMENT_OPTIONS[item.exercise?.name || ''] || [];
    const selectedReplacement = replacementOptions.find(
      (opt) => opt.id === customization.selectedReplacementId
    );

    return (
      <View key={item.id} style={styles.exerciseRowContainer}>
        <Card style={styles.exerciseRow}>
          <View style={styles.exerciseMainContent}>
            <View style={styles.exerciseName}>
              <Text
                variant="bodyEmphasis"
                color={colors.text.primary}
              >
                {formatExerciseDisplayName(selectedReplacement ? selectedReplacement.name : item.exercise?.name) || 'Exercise'}
              </Text>
              {selectedReplacement && (
                <Text variant="caption" color={colors.text.tertiary} style={styles.replacedNote}>
                  (substituted)
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => handleToggleReplacements(item.id)}
              style={styles.swapButton}
            >
              <Text variant="labelSmall" color={colors.accent.lime}>
                Swap
              </Text>
            </Pressable>
          </View>

          {/* Replacement Options */}
          {customization.showReplacements && replacementOptions.length > 0 && (
            <View style={styles.replacementOptions}>
              <View style={styles.replacementsDivider} />
              <Text
                variant="caption"
                color={colors.text.tertiary}
                style={styles.replacementsLabel}
              >
                Choose a replacement:
              </Text>
              {replacementOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelectReplacement(item.id, option.id)}
                  style={[
                    styles.replacementOption,
                    customization.selectedReplacementId === option.id &&
                      styles.replacementOptionSelected,
                  ]}
                >
                  <View style={styles.optionCheckbox}>
                    {customization.selectedReplacementId === option.id && (
                      <Text
                        variant="body"
                        color={colors.button.primaryText}
                        align="center"
                      >
                        ✓
                      </Text>
                    )}
                  </View>
                  <Text
                    variant="body"
                    color={
                      customization.selectedReplacementId === option.id
                        ? colors.accent.lime
                        : colors.text.secondary
                    }
                  >
                    {option.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>
      </View>
    );
  };

  const hasChanges = customizations.some((c) => c.selectedReplacementId !== null);

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
          Customize Workout
        </Text>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text variant="bodyEmphasis" color={colors.accent.lime}>
            Save
          </Text>
        </Pressable>
      </View>

      {/* Info Card */}
      <View style={styles.infoBar}>
        <Text variant="caption" color={colors.text.secondary} align="center">
          Swap exercises for variations that suit your preferences or available equipment
        </Text>
      </View>

      {/* Exercises List */}
      <FlatList
        data={todayWorkout.exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExerciseRow}
        scrollEnabled={true}
        contentContainerStyle={styles.exercisesList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Save Button */}
      <View style={styles.buttonContainer}>
        <Button
          title={hasChanges ? 'Save Changes' : 'Done'}
          onPress={handleSave}
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
  saveButton: {
    padding: spacing.sm,
  },
  infoBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.surface.tertiary,
    borderBottomWidth: 1,
  },
  exercisesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  exerciseRowContainer: {
    marginBottom: spacing.md,
  },
  exerciseRow: {
    paddingVertical: spacing.lg,
  },
  exerciseMainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    flex: 1,
  },
  replacedNote: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  swapButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(200, 255, 0, 0.1)',
    borderRadius: borderRadius.sm,
    borderColor: colors.accent.lime,
    borderWidth: 1,
  },
  replacementOptions: {
    marginTop: spacing.md,
  },
  replacementsDivider: {
    height: 1,
    backgroundColor: colors.surface.tertiary,
    marginBottom: spacing.md,
  },
  replacementsLabel: {
    marginBottom: spacing.sm,
  },
  replacementOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface.secondary,
  },
  replacementOptionSelected: {
    backgroundColor: 'rgba(200, 255, 0, 0.1)',
    borderColor: colors.accent.lime,
    borderWidth: 1,
  },
  optionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderColor: colors.accent.lime,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
