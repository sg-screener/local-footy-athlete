import { useCallback } from 'react';
import { useWorkoutLogStore } from '../store';
import * as workoutService from '../services/api/workoutService';
import { LoggedSet } from '../types/domain';

/**
 * Custom hook for managing workout logging
 * Handles starting, logging, and completing workouts
 */
export function useWorkoutLog() {
  const {
    activeWorkout,
    loggedSets,
    currentExerciseIndex,
    startWorkout,
    logSet,
    updateSet,
    getExerciseSets,
    nextExercise,
    prevExercise,
    completeWorkout,
    setLoading,
    setError,
    setIsLogging,
  } = useWorkoutLogStore();

  const startNewWorkout = useCallback(
    async (workoutId: string, userId: string, loggedDate: string) => {
      try {
        setLoading(true);
        const response = await workoutService.logWorkout({
          userId,
          workoutId,
          loggedDate,
        });

        if (response.success && response.data) {
          startWorkout(response.data);
          return { success: true, workout: response.data };
        } else {
          setError(response.error?.message || 'Failed to start workout');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start workout';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [startWorkout, setLoading, setError],
  );

  const addSet = useCallback(
    async (workoutExerciseId: string, set: Omit<LoggedSet, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!activeWorkout?.id) {
        setError('No active workout');
        return { success: false };
      }

      try {
        setLoading(true);
        const response = await workoutService.logSet({
          loggedWorkoutId: activeWorkout.id,
          workoutExerciseId,
          setNumber: set.setNumber,
          actualReps: set.actualReps,
          actualWeightKg: set.actualWeightKg,
          notes: set.notes,
        });

        if (response.success && response.data) {
          logSet(workoutExerciseId, response.data);
          return { success: true, set: response.data };
        } else {
          setError(response.error?.message || 'Failed to log set');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to log set';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [activeWorkout?.id, logSet, setLoading, setError],
  );

  const updateLoggedSet = useCallback(
    async (setId: string, updates: Partial<LoggedSet>) => {
      try {
        setLoading(true);
        const response = await workoutService.updateSet(setId, updates);

        if (response.success && response.data) {
          // Update in local state
          updateSet(response.data.workoutExerciseId, response.data.setNumber - 1, response.data);
          return { success: true };
        } else {
          setError(response.error?.message || 'Failed to update set');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update set';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [updateSet, setLoading, setError],
  );

  const finishWorkout = useCallback(
    async (durationMinutes: number, perceivedDifficulty: number) => {
      if (!activeWorkout?.id) {
        setError('No active workout');
        return { success: false };
      }

      try {
        setLoading(true);
        const response = await workoutService.completeWorkout(activeWorkout.id, {
          completedAt: new Date().toISOString(),
          durationMinutes,
          perceivedDifficulty,
        });

        if (response.success && response.data) {
          completeWorkout();
          return { success: true, workout: response.data };
        } else {
          setError(response.error?.message || 'Failed to complete workout');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to complete workout';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [activeWorkout?.id, completeWorkout, setLoading, setError],
  );

  const getCurrentExercise = useCallback(() => {
    if (!activeWorkout?.exercises || activeWorkout.exercises.length === 0) {
      return null;
    }
    return activeWorkout.exercises[currentExerciseIndex] || null;
  }, [activeWorkout?.exercises, currentExerciseIndex]);

  const moveToNextExercise = useCallback(() => {
    nextExercise();
  }, [nextExercise]);

  const moveToPrevExercise = useCallback(() => {
    prevExercise();
  }, [prevExercise]);

  const hasNextExercise = useCallback(() => {
    if (!activeWorkout?.exercises) return false;
    return currentExerciseIndex < activeWorkout.exercises.length - 1;
  }, [activeWorkout?.exercises, currentExerciseIndex]);

  const hasPrevExercise = useCallback(() => {
    return currentExerciseIndex > 0;
  }, [currentExerciseIndex]);

  return {
    activeWorkout,
    currentExerciseIndex,
    loggedSets,
    startNewWorkout,
    addSet,
    updateLoggedSet,
    finishWorkout,
    getCurrentExercise,
    moveToNextExercise,
    moveToPrevExercise,
    hasNextExercise,
    hasPrevExercise,
    getExerciseSets,
    setIsLogging,
  };
}
