"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useProgramStore = void 0;
exports.getLastPerformedWeight = getLastPerformedWeight;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
exports.useProgramStore = (0, zustand_1.create)()((0, middleware_1.persist)((set) => ({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    dateOverrides: {},
    overrideContexts: {},
    sessionFeedback: {},
    weightOverrides: {},
    // Setting a new program clears overrides — new block = fresh slate
    setCurrentProgram: (program) => set({
        currentProgram: program,
        currentMicrocycle: null,
        todayWorkout: null,
        dateOverrides: {},
        overrideContexts: {},
    }),
    setCurrentMicrocycle: (microcycle) => set({ currentMicrocycle: microcycle }),
    setTodayWorkout: (workout) => set({ todayWorkout: workout }),
    setGenerating: (generating) => set({ isGenerating: generating }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setManualOverride: (date, workout, context) => set((state) => ({
        dateOverrides: { ...state.dateOverrides, [date]: workout },
        overrideContexts: context
            ? { ...state.overrideContexts, [date]: context }
            : state.overrideContexts,
    })),
    removeManualOverride: (date) => set((state) => {
        const updatedOverrides = { ...state.dateOverrides };
        delete updatedOverrides[date];
        const updatedContexts = { ...state.overrideContexts };
        delete updatedContexts[date];
        return { dateOverrides: updatedOverrides, overrideContexts: updatedContexts };
    }),
    clearManualOverrides: () => set({ dateOverrides: {}, overrideContexts: {} }),
    setSessionFeedback: (date, feedback) => set((state) => ({
        sessionFeedback: { ...state.sessionFeedback, [date]: feedback },
    })),
    removeSessionFeedback: (date) => set((state) => {
        const updated = { ...state.sessionFeedback };
        delete updated[date];
        return { sessionFeedback: updated };
    }),
    setWeightOverride: (date, exerciseId, weightKg) => set((state) => ({
        weightOverrides: {
            ...state.weightOverrides,
            [date]: {
                ...(state.weightOverrides[date] || {}),
                [exerciseId]: weightKg,
            },
        },
    })),
    removeWeightOverride: (date, exerciseId) => set((state) => {
        const dateOverrides = { ...(state.weightOverrides[date] || {}) };
        delete dateOverrides[exerciseId];
        const allOverrides = { ...state.weightOverrides };
        if (Object.keys(dateOverrides).length === 0) {
            delete allOverrides[date];
        }
        else {
            allOverrides[date] = dateOverrides;
        }
        return { weightOverrides: allOverrides };
    }),
    dismissStaleWarning: (date) => set((state) => ({
        // Write a 'dismissed' context so neither structured nor heuristic
        // detection will flag this override again. The override itself is untouched.
        overrideContexts: {
            ...state.overrideContexts,
            [date]: { intent: 'dismissed' },
        },
    })),
    addExerciseToWorkout: (workoutId, exercise) => set((state) => {
        if (!state.currentMicrocycle)
            return state;
        const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
            if (w.id !== workoutId)
                return w;
            return {
                ...w,
                exercises: [...w.exercises, exercise],
            };
        });
        const updatedMicrocycle = {
            ...state.currentMicrocycle,
            workouts: updatedWorkouts,
        };
        // Also update todayWorkout if it's the same workout
        const updatedToday = state.todayWorkout?.id === workoutId
            ? { ...state.todayWorkout, exercises: [...state.todayWorkout.exercises, exercise] }
            : state.todayWorkout;
        return {
            currentMicrocycle: updatedMicrocycle,
            todayWorkout: updatedToday,
        };
    }),
    replaceExerciseInWorkout: (dayOfWeek, oldExerciseName, newExercise) => {
        const state = exports.useProgramStore.getState();
        if (!state.currentMicrocycle) {
            console.warn('[programStore] replaceExerciseInWorkout: no currentMicrocycle');
            return false;
        }
        const oldNameLower = oldExerciseName.toLowerCase();
        let swapped = false;
        const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
            if (w.dayOfWeek !== dayOfWeek)
                return w;
            const updatedExercises = w.exercises.map((ex) => {
                const exName = (ex.exercise?.name || ex.exerciseId || '').toLowerCase();
                if (exName.includes(oldNameLower) || oldNameLower.includes(exName)) {
                    swapped = true;
                    console.log(`[programStore] Swapped "${ex.exercise?.name}" → "${newExercise.exercise?.name}" on day ${dayOfWeek}`);
                    return {
                        ...newExercise,
                        id: ex.id, // preserve slot ID
                        workoutId: ex.workoutId,
                        exerciseOrder: ex.exerciseOrder,
                    };
                }
                return ex;
            });
            return { ...w, exercises: updatedExercises, updatedAt: new Date().toISOString() };
        });
        if (!swapped) {
            console.warn(`[programStore] replaceExerciseInWorkout: "${oldExerciseName}" not found on day ${dayOfWeek}`);
            return false;
        }
        const updatedMicrocycle = {
            ...state.currentMicrocycle,
            workouts: updatedWorkouts,
            updatedAt: new Date().toISOString(),
        };
        // Also update todayWorkout if it falls on the same dayOfWeek
        const todayDay = new Date().getDay();
        const updatedToday = todayDay === dayOfWeek
            ? updatedWorkouts.find((w) => w.dayOfWeek === dayOfWeek) || state.todayWorkout
            : state.todayWorkout;
        exports.useProgramStore.setState({
            currentMicrocycle: updatedMicrocycle,
            todayWorkout: updatedToday,
        });
        return true;
    },
    clear: () => {
        set({
            currentProgram: null,
            currentMicrocycle: null,
            todayWorkout: null,
            isGenerating: false,
            isLoading: false,
            error: null,
            dateOverrides: {},
            overrideContexts: {},
            sessionFeedback: {},
            weightOverrides: {},
        });
    },
}), {
    name: 'program-store',
    storage: (0, middleware_1.createJSONStorage)(() => async_storage_1.default),
}));
/**
 * Get the most recent performed weight for an exercise (across all dates).
 * Returns undefined if the exercise has never been weight-overridden.
 *
 * Standalone function (not a store method) to avoid circular type references.
 * Used by progression to determine baseline weight for future sessions.
 */
function getLastPerformedWeight(exerciseId) {
    const state = exports.useProgramStore.getState();
    const dates = Object.keys(state.weightOverrides).sort().reverse();
    for (const d of dates) {
        const exerciseWeights = state.weightOverrides[d];
        if (exerciseWeights && exerciseId in exerciseWeights) {
            return exerciseWeights[exerciseId];
        }
    }
    return undefined;
}
