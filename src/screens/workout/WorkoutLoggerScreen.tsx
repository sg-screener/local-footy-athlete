import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions, shadows } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { useWorkoutLogStore, useProgramStore } from '../../store';
import type { HomeStackParamList } from '../../types/navigation';
import type { LoggedWorkout, LoggedSet, SessionFeeling } from '../../types/domain';
import { v4 as uuidv4 } from 'uuid';
import { SetLoggerRow } from './SetLoggerRow';
import { ExerciseVideoPlayer } from './ExerciseVideoPlayer';
import { CompletionSummary } from './CompletionSummary';
import { format } from 'date-fns';

type WorkoutLoggerScreenProps = NativeStackScreenProps<HomeStackParamList, 'WorkoutLogger'>;

export default function WorkoutLoggerScreen({ route, navigation }: WorkoutLoggerScreenProps) {
  const { workoutId } = route.params;

  // Store state
  const activeWorkout = useWorkoutLogStore((state) => state.activeWorkout);
  const loggedSets = useWorkoutLogStore((state) => state.loggedSets);
  const currentExerciseIndex = useWorkoutLogStore((state) => state.currentExerciseIndex);
  const {
    startWorkout,
    logSet,
    updateSet,
    nextExercise,
    prevExercise,
    setCurrentExerciseIndex,
    completeWorkout,
    getExerciseSets,
  } = useWorkoutLogStore();

  // Local state
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);

  // Get today's workout from program store to initialize
  const todayWorkout = useProgramStore((state) => state.todayWorkout);

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  // Initialize workout
  useFocusEffect(
    useCallback(() => {
      if (!activeWorkout && todayWorkout) {
        const newLoggedWorkout: LoggedWorkout = {
          id: uuidv4(),
          userId: '', // Will be set when saving
          workoutId: todayWorkout.id,
          loggedDate: format(new Date(), 'yyyy-MM-dd'),
          completed: false,
          synced: false,
          sets: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        startWorkout(newLoggedWorkout);
      }
    }, [activeWorkout, todayWorkout, startWorkout])
  );

  if (!activeWorkout) {
    return (
      <View style={styles.container}>
        <Loading />
      </View>
    );
  }

  const exercises = activeWorkout.exercises || [];
  const currentExercise = exercises[currentExerciseIndex];
  const currentExerciseSets = getExerciseSets(currentExercise?.id || '');
  const isLastExercise = currentExerciseIndex === exercises.length - 1;

  const handleAddSet = () => {
    if (!currentExercise) return;

    const newSet: LoggedSet = {
      id: uuidv4(),
      loggedWorkoutId: activeWorkout.id,
      workoutExerciseId: currentExercise.id,
      setNumber: currentExerciseSets.length + 1,
      actualReps: currentExercise.prescribedRepsMax,
      actualWeightKg: currentExercise.prescribedWeightKg,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    logSet(currentExercise.id, newSet);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleUpdateSet = (setIndex: number, updates: Partial<LoggedSet>) => {
    updateSet(currentExercise.id, setIndex, updates);
  };

  const handleCompleteWorkout = () => {
    Alert.alert(
      'Complete Workout?',
      'Are you sure you want to finish this workout?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Complete',
          onPress: () => {
            setShowCompletionSummary(true);
          },
        },
      ]
    );
  };

  const handleSaveWorkout = async (summary: {
    feeling: SessionFeeling;
    notes: string;
  }) => {
    completeWorkout();
    navigation.replace('WorkoutComplete', {
      workoutId: activeWorkout.id,
      duration: elapsedTime,
      feeling: summary.feeling,
      notes: summary.notes,
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text color={colors.text.primary} style={styles.closeIcon}>
            ✕
          </Text>
        </Pressable>
        <View style={styles.headerContent}>
          <Text variant="h4" style={[styles.workoutName, { color: colors.accent.lime }]}>
            {activeWorkout.workoutId}
          </Text>
          <Text variant="caption" color={colors.text.secondary}>
            {formatTime(elapsedTime)}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Exercise progress */}
      <View style={[styles.progressBar, styles.section]}>
        <Text variant="caption" color={colors.text.secondary}>
          Exercise {currentExerciseIndex + 1} of {exercises.length}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%`,
                backgroundColor: colors.accent.lime,
              },
            ]}
          />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        {/* Current exercise */}
        <Card style={styles.exerciseCard}>
          {/* Exercise header */}
          <View style={styles.exerciseHeader}>
            <View>
              <Text variant="h3" style={styles.exerciseName}>
                {currentExercise.exercise?.name || 'Exercise'}
              </Text>
              {currentExercise.exercise?.muscleGroups && (
                <Text variant="caption" color={colors.text.secondary}>
                  {currentExercise.exercise.muscleGroups.join(', ')}
                </Text>
              )}
            </View>
            {currentExercise.exercise?.videoUrl && (
              <Pressable
                onPress={() => setShowVideoPlayer(true)}
                style={styles.videoButton}
              >
                <Text color={colors.accent.lime} style={styles.videoIcon}>
                  ▶
                </Text>
              </Pressable>
            )}
          </View>

          {/* Prescribed values */}
          <View style={styles.prescribedSection}>
            <Text variant="labelSmall" color={colors.text.secondary}>
              PRESCRIBED
            </Text>
            <Text variant="body" color={colors.accent.lime} style={styles.prescribedText}>
              {currentExercise.prescribedSets} sets x {currentExercise.prescribedRepsMin}-
              {currentExercise.prescribedRepsMax} reps
              {currentExercise.prescribedWeightKg && ` @ ${currentExercise.prescribedWeightKg}kg`}
            </Text>
          </View>

          {/* Previous performance */}
          {currentExercise.exercise?.formNotes && (
            <View style={styles.formNotesSection}>
              <Text variant="labelSmall" color={colors.text.secondary}>
                FORM NOTES
              </Text>
              <Text variant="bodySmall" color={colors.text.primary}>
                {currentExercise.exercise.formNotes}
              </Text>
            </View>
          )}
        </Card>

        {/* Set logging table */}
        <Card style={styles.setLoggingCard}>
          <View style={styles.setTableHeader}>
            <Text variant="labelSmall" color={colors.text.secondary}>
              SET LOG
            </Text>
          </View>

          <View style={styles.setTable}>
            {/* Set rows */}
            {currentExerciseSets.length > 0 ? (
              currentExerciseSets.map((set, index) => (
                <SetLoggerRow
                  key={set.id}
                  set={set}
                  setIndex={index}
                  prescribed={{
                    reps: currentExercise.prescribedRepsMax,
                    weight: currentExercise.prescribedWeightKg || 0,
                  }}
                  onUpdate={(updates) => handleUpdateSet(index, updates)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text variant="body" color={colors.text.secondary}>
                  No sets logged yet
                </Text>
              </View>
            )}

            {/* Add set button */}
            <Pressable
              onPress={handleAddSet}
              style={({ pressed }) => [
                styles.addSetButton,
                pressed && styles.addSetButtonPressed,
              ]}
            >
              <Text color={colors.accent.lime} style={styles.addSetButtonText}>
                + Add Set
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Video player modal */}
        {showVideoPlayer && currentExercise.exercise && (
          <ExerciseVideoPlayer
            exercise={currentExercise.exercise}
            onClose={() => setShowVideoPlayer(false)}
          />
        )}
      </ScrollView>

      {/* Navigation and completion buttons */}
      <View style={styles.footer}>
        <Button
          title="← Previous"
          onPress={prevExercise}
          variant="outline"
          size="md"
          disabled={currentExerciseIndex === 0}
          style={styles.navButton}
        />

        {isLastExercise ? (
          <Button
            title="Complete Workout 🎉"
            onPress={handleCompleteWorkout}
            variant="primary"
            size="md"
            style={styles.completeButton}
          />
        ) : (
          <Button
            title="Next Exercise →"
            onPress={nextExercise}
            variant="primary"
            size="md"
            style={styles.navButton}
          />
        )}
      </View>

      {/* Completion summary modal */}
      {showCompletionSummary && (
        <CompletionSummary
          duration={elapsedTime}
          exercisesCompleted={exercises.length}
          onSave={handleSaveWorkout}
          onCancel={() => setShowCompletionSummary(false)}
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
    borderBottomWidth: 1,
    borderBottomColor: `${colors.accent.lime}20`,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: `${colors.secondary.main}20`,
  },
  closeIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  workoutName: {
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginHorizontal: spacing.lg,
  },
  progressBar: {
    paddingVertical: spacing.md,
  },
  progressTrack: {
    height: 6,
    backgroundColor: `${colors.accent.lime}20`,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  exerciseCard: {
    padding: spacing.lg,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  exerciseName: {
    color: colors.accent.lime,
    marginBottom: spacing.xs,
  },
  videoButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: `${colors.accent.lime}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  prescribedSection: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${colors.text.secondary}20`,
    marginBottom: spacing.lg,
  },
  prescribedText: {
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  formNotesSection: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: `${colors.text.secondary}20`,
  },
  setLoggingCard: {
    padding: spacing.lg,
  },
  setTableHeader: {
    marginBottom: spacing.md,
  },
  setTable: {
    borderWidth: 1,
    borderColor: `${colors.text.secondary}20`,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.secondary}20`,
    backgroundColor: `${colors.surface.tertiary}`,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    backgroundColor: `${colors.surface.tertiary}`,
  },
  addSetButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    backgroundColor: `${colors.accent.lime}10`,
    borderTopWidth: 1,
    borderTopColor: `${colors.text.secondary}20`,
  },
  addSetButtonPressed: {
    backgroundColor: `${colors.accent.lime}20`,
  },
  addSetButtonText: {
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: `${colors.text.secondary}20`,
  },
  navButton: {
    flex: 1,
  },
  completeButton: {
    flex: 1,
  },
});
