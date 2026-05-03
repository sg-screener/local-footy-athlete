import { useCallback, useEffect } from 'react';
import { useProgramStore } from '../store';
import * as programService from '../services/api/programService';
import { useAuthStore } from '../store';

/**
 * Custom hook for managing training programs
 * Handles fetching, setting, and updating the current program
 */
export function useProgram() {
  const { currentProgram, setCurrentProgram, setGenerating, setLoading, setError } =
    useProgramStore();
  const { user } = useAuthStore();

  const loadCurrentProgram = useCallback(async () => {
    if (!user?.id) {
      setError('No authenticated user');
      return;
    }

    try {
      setLoading(true);
      const response = await programService.getCurrentProgram(user.id);

      if (response.success && response.data) {
        setCurrentProgram(response.data);
      } else {
        setError(response.error?.message || 'Failed to load program');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load program';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, setLoading, setError, setCurrentProgram]);

  const updateProgram = useCallback(
    async (updates: Parameters<typeof programService.updateProgram>[1]) => {
      if (!currentProgram?.id) {
        setError('No program selected');
        return;
      }

      try {
        setLoading(true);
        const response = await programService.updateProgram(currentProgram.id, updates);

        if (response.success && response.data) {
          setCurrentProgram(response.data);
          return { success: true };
        } else {
          setError(response.error?.message || 'Failed to update program');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update program';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [currentProgram?.id, setLoading, setError, setCurrentProgram],
  );

  const deactivateCurrentProgram = useCallback(async () => {
    if (!currentProgram?.id) {
      setError('No program selected');
      return;
    }

    try {
      setLoading(true);
      const response = await programService.deactivateProgram(currentProgram.id);

      if (response.success) {
        setCurrentProgram(null);
        return { success: true };
      } else {
        setError(response.error?.message || 'Failed to deactivate program');
        return { success: false };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to deactivate program';
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [currentProgram?.id, setLoading, setError, setCurrentProgram]);

  const getTodayWorkout = useCallback(async () => {
    if (!currentProgram?.id) {
      setError('No program selected');
      return null;
    }

    try {
      setLoading(true);
      const response = await programService.getTodayWorkout(currentProgram.id);

      if (response.success) {
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to load today workout');
        return null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load today workout';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentProgram?.id, setLoading, setError]);

  const getWeekWorkouts = useCallback(
    async (microcycleId: string) => {
      try {
        setLoading(true);
        const response = await programService.getWeekWorkouts(microcycleId);

        if (response.success) {
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to load week workouts');
          return [];
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load week workouts';
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  return {
    currentProgram,
    loadCurrentProgram,
    updateProgram,
    deactivateCurrentProgram,
    getTodayWorkout,
    getWeekWorkouts,
    setGenerating,
  };
}
