import { create } from 'zustand';
import { LoggedWorkout, LoggedSet, Workout } from '../types/domain';

interface WorkoutLogState {
  activeWorkout: Workout | null;
  loggedSets: Map<string, LoggedSet[]>;
  currentExerciseIndex: number;
  isLogging: boolean;
  isLoading: boolean;
  error: string | null;
  startWorkout: (workout: Workout) => void;
  logSet: (workoutExerciseId: string, set: LoggedSet) => void;
  updateSet: (workoutExerciseId: string, setIndex: number, updates: Partial<LoggedSet>) => void;
  getExerciseSets: (workoutExerciseId: string) => LoggedSet[];
  nextExercise: () => void;
  prevExercise: () => void;
  setCurrentExerciseIndex: (index: number) => void;
  completeWorkout: () => void;
  setIsLogging: (logging: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useWorkoutLogStore = create<WorkoutLogState>((set, get) => ({
  activeWorkout: null,
  loggedSets: new Map(),
  currentExerciseIndex: 0,
  isLogging: false,
  isLoading: false,
  error: null,

  startWorkout: (workout) => {
    set({
      activeWorkout: workout,
      loggedSets: new Map(),
      currentExerciseIndex: 0,
      isLogging: true,
      error: null,
    });
  },

  logSet: (workoutExerciseId, set_) => {
    set((state) => {
      const newLoggedSets = new Map(state.loggedSets);
      const existingSets = newLoggedSets.get(workoutExerciseId) || [];
      newLoggedSets.set(workoutExerciseId, [...existingSets, set_]);
      return { loggedSets: newLoggedSets };
    });
  },

  updateSet: (workoutExerciseId, setIndex, updates) => {
    set((state) => {
      const newLoggedSets = new Map(state.loggedSets);
      const sets = newLoggedSets.get(workoutExerciseId) || [];
      if (setIndex < sets.length) {
        sets[setIndex] = { ...sets[setIndex], ...updates };
        newLoggedSets.set(workoutExerciseId, sets);
      }
      return { loggedSets: newLoggedSets };
    });
  },

  getExerciseSets: (workoutExerciseId) => {
    const state = get();
    return state.loggedSets.get(workoutExerciseId) || [];
  },

  nextExercise: () => {
    set((state) => {
      const workout = state.activeWorkout;
      if (!workout || !workout.exercises) return {};
      const nextIndex = Math.min(
        state.currentExerciseIndex + 1,
        workout.exercises.length - 1,
      );
      return { currentExerciseIndex: nextIndex };
    });
  },

  prevExercise: () => {
    set((state) => {
      const prevIndex = Math.max(state.currentExerciseIndex - 1, 0);
      return { currentExerciseIndex: prevIndex };
    });
  },

  setCurrentExerciseIndex: (index) => set({ currentExerciseIndex: index }),

  completeWorkout: () => {
    set({
      isLogging: false,
      activeWorkout: null,
    });
  },

  setIsLogging: (logging) => set({ isLogging: logging }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clear: () => {
    set({
      activeWorkout: null,
      loggedSets: new Map(),
      currentExerciseIndex: 0,
      isLogging: false,
      isLoading: false,
      error: null,
    });
  },
}));
