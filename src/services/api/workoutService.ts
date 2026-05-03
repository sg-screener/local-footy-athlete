import { supabase, handleSupabaseError } from './supabaseClient';
import { LoggedWorkout, LoggedSet, PersonalRecord } from '../../types/domain';
import { ApiResponse, PaginatedResponse } from '../../types/api';

/**
 * Log a workout session
 */
export async function logWorkout(data: {
  userId: string;
  workoutId: string;
  loggedDate: string;
  durationMinutes?: number;
  perceivedDifficulty?: number;
  notes?: string;
}): Promise<ApiResponse<LoggedWorkout>> {
  try {
    const { data: result, error } = await supabase
      .from('logged_workouts')
      .insert([
        {
          user_id: data.userId,
          workout_id: data.workoutId,
          logged_date: data.loggedDate,
          duration_minutes: data.durationMinutes,
          perceived_difficulty: data.perceivedDifficulty,
          notes: data.notes,
          completed: false,
          synced: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: transformLoggedWorkoutData(result),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as LoggedWorkout,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Log a set for an exercise
 */
export async function logSet(data: {
  loggedWorkoutId: string;
  workoutExerciseId: string;
  setNumber: number;
  actualReps?: number;
  actualWeightKg?: number;
  actualRpe?: number;
  notes?: string;
}): Promise<ApiResponse<LoggedSet>> {
  try {
    const { data: result, error } = await supabase
      .from('logged_sets')
      .insert([
        {
          logged_workout_id: data.loggedWorkoutId,
          workout_exercise_id: data.workoutExerciseId,
          set_number: data.setNumber,
          actual_reps: data.actualReps,
          actual_weight_kg: data.actualWeightKg,
          actual_rpe: data.actualRpe,
          notes: data.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: transformLoggedSetData(result),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as LoggedSet,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Get workout history for a user
 */
export async function getWorkoutHistory(
  userId: string,
  limit: number = 50,
): Promise<ApiResponse<PaginatedResponse<LoggedWorkout>>> {
  try {
    const { data, error, count } = await supabase
      .from('logged_workouts')
      .select('*, logged_sets(*)', { count: 'exact' })
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return {
      data: {
        items: data.map(transformLoggedWorkoutData),
        total: count || 0,
        page: 1,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: (count || 0) > limit,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as PaginatedResponse<LoggedWorkout>,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Get exercise history for a specific exercise
 */
export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
  limit: number = 50,
): Promise<ApiResponse<PaginatedResponse<LoggedSet>>> {
  try {
    const { data, error, count } = await supabase
      .from('logged_sets')
      .select('logged_sets(*, logged_workouts!inner(*))', { count: 'exact' })
      .eq('logged_workouts.user_id', userId)
      .eq('workout_exercise_id', exerciseId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return {
      data: {
        items: data.map(transformLoggedSetData),
        total: count || 0,
        page: 1,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: (count || 0) > limit,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as PaginatedResponse<LoggedSet>,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Get personal records for a user by exercise
 */
export async function getPersonalRecords(userId: string): Promise<ApiResponse<PersonalRecord[]>> {
  try {
    const { data, error } = await supabase.rpc('get_personal_records', {
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    return {
      data: (data || []).map((pr: any) => ({
        exerciseId: pr.exercise_id,
        exerciseName: pr.exercise_name,
        weightKg: pr.weight_kg,
        reps: pr.reps,
        achievedDate: pr.achieved_date,
        maxEver: pr.max_ever,
      })),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: [],
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Mark a logged workout as completed
 */
export async function completeWorkout(
  loggedWorkoutId: string,
  completionData: {
    completedAt: string;
    durationMinutes: number;
    perceivedDifficulty: number;
  },
): Promise<ApiResponse<LoggedWorkout>> {
  try {
    const { data, error } = await supabase
      .from('logged_workouts')
      .update({
        completed: true,
        completed_at: completionData.completedAt,
        duration_minutes: completionData.durationMinutes,
        perceived_difficulty: completionData.perceivedDifficulty,
        synced: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loggedWorkoutId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: transformLoggedWorkoutData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as LoggedWorkout,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Update a logged set
 */
export async function updateSet(
  loggedSetId: string,
  updates: Partial<LoggedSet>,
): Promise<ApiResponse<LoggedSet>> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.actualReps !== undefined) updateData.actual_reps = updates.actualReps;
    if (updates.actualWeightKg !== undefined) updateData.actual_weight_kg = updates.actualWeightKg;
    if (updates.actualRpe !== undefined) updateData.actual_rpe = updates.actualRpe;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await supabase
      .from('logged_sets')
      .update(updateData)
      .eq('id', loggedSetId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: transformLoggedSetData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as LoggedSet,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Bulk update logged sets
 */
export async function bulkUpdateSets(
  updates: Array<{ id: string; updates: Partial<LoggedSet> }>,
): Promise<ApiResponse<LoggedSet[]>> {
  try {
    const updatePromises = updates.map(({ id, updates: upd }) => updateSet(id, upd));
    const results = await Promise.all(updatePromises);

    const failedResults = results.filter((r) => !r.success);
    if (failedResults.length > 0) {
      throw new Error(`Failed to update ${failedResults.length} sets`);
    }

    return {
      data: results.map((r) => r.data).filter(Boolean) as LoggedSet[],
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: [],
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

// Helper functions
function transformLoggedWorkoutData(data: any): LoggedWorkout {
  return {
    id: data.id,
    userId: data.user_id,
    workoutId: data.workout_id,
    loggedDate: data.logged_date,
    completedAt: data.completed_at,
    durationMinutes: data.duration_minutes,
    perceivedDifficulty: data.perceived_difficulty,
    notes: data.notes,
    completed: data.completed,
    synced: data.synced,
    sets: (data.logged_sets || []).map(transformLoggedSetData),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformLoggedSetData(data: any): LoggedSet {
  return {
    id: data.id,
    loggedWorkoutId: data.logged_workout_id,
    workoutExerciseId: data.workout_exercise_id,
    setNumber: data.set_number,
    actualReps: data.actual_reps,
    actualWeightKg: data.actual_weight_kg,
    actualRpe: data.actual_rpe,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
