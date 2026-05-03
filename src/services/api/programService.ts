import { supabase, handleSupabaseError } from './supabaseClient';
import { TrainingProgram, Microcycle, Workout } from '../../types/domain';
import { ApiResponse } from '../../types/api';

/**
 * Get the current active training program for a user
 */
export async function getCurrentProgram(userId: string): Promise<ApiResponse<TrainingProgram>> {
  try {
    const { data, error } = await supabase
      .from('training_programs')
      .select(
        `
        *,
        microcycles (
          *,
          workouts (
            *,
            workout_exercises (
              *,
              exercises (*)
            )
          )
        )
      `,
      )
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found, return null data but success
        return {
          data: null as unknown as TrainingProgram,
          error: null,
          success: true,
        };
      }
      throw error;
    }

    return {
      data: transformProgramData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as TrainingProgram,
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
 * Get a specific training program by ID
 */
export async function getProgramById(programId: string): Promise<ApiResponse<TrainingProgram>> {
  try {
    const { data, error } = await supabase
      .from('training_programs')
      .select(
        `
        *,
        microcycles (
          *,
          workouts (
            *,
            workout_exercises (
              *,
              exercises (*)
            )
          )
        )
      `,
      )
      .eq('id', programId)
      .single();

    if (error) {
      throw error;
    }

    return {
      data: transformProgramData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as TrainingProgram,
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
 * Create a new training program
 */
export async function createProgram(
  programData: Omit<TrainingProgram, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ApiResponse<TrainingProgram>> {
  try {
    const { data, error } = await supabase
      .from('training_programs')
      .insert([
        {
          user_id: programData.userId,
          name: programData.name,
          description: programData.description,
          program_phase: programData.programPhase,
          start_date: programData.startDate,
          end_date: programData.endDate,
          primary_focus: programData.primaryFocus,
          is_active: programData.isActive,
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
      data: transformProgramData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as TrainingProgram,
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
 * Get the workout for today based on current program
 */
export async function getTodayWorkout(programId: string): Promise<ApiResponse<Workout | null>> {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Get the current microcycle
    const { data: microcycle, error: mcError } = await supabase
      .from('microcycles')
      .select('id')
      .eq('program_id', programId)
      .lte('start_date', today.toISOString().split('T')[0])
      .gte('end_date', today.toISOString().split('T')[0])
      .single();

    if (mcError) {
      if (mcError.code === 'PGRST116') {
        return {
          data: null,
          error: null,
          success: true,
        };
      }
      throw mcError;
    }

    // Get workout for today's day of week
    const { data, error } = await supabase
      .from('workouts')
      .select(
        `
        *,
        workout_exercises (
          *,
          exercises (*)
        )
      `,
      )
      .eq('microcycle_id', microcycle.id)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          data: null,
          error: null,
          success: true,
        };
      }
      throw error;
    }

    return {
      data: transformWorkoutData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null,
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
 * Get all workouts for a specific microcycle
 */
export async function getWeekWorkouts(microcycleId: string): Promise<ApiResponse<Workout[]>> {
  try {
    const { data, error } = await supabase
      .from('workouts')
      .select(
        `
        *,
        workout_exercises (
          *,
          exercises (*)
        )
      `,
      )
      .eq('microcycle_id', microcycleId)
      .order('day_of_week', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      data: data.map(transformWorkoutData),
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
 * Update a training program
 */
export async function updateProgram(
  programId: string,
  updates: Partial<TrainingProgram>,
): Promise<ApiResponse<TrainingProgram>> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.description) updateData.description = updates.description;
    if (updates.programPhase) updateData.program_phase = updates.programPhase;
    if (updates.startDate) updateData.start_date = updates.startDate;
    if (updates.endDate) updateData.end_date = updates.endDate;
    if (updates.primaryFocus) updateData.primary_focus = updates.primaryFocus;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('training_programs')
      .update(updateData)
      .eq('id', programId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: transformProgramData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as TrainingProgram,
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
 * Deactivate a training program
 */
export async function deactivateProgram(programId: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase
      .from('training_programs')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', programId);

    if (error) {
      throw error;
    }

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

// Helper functions for data transformation
function transformProgramData(data: any): TrainingProgram {
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    programPhase: data.program_phase,
    startDate: data.start_date,
    endDate: data.end_date,
    microcycles: (data.microcycles || []).map(transformMicrocycleData),
    primaryFocus: data.primary_focus,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformMicrocycleData(data: any): Microcycle {
  return {
    id: data.id,
    programId: data.program_id,
    weekNumber: data.week_number,
    startDate: data.start_date,
    endDate: data.end_date,
    deloadWeek: data.deload_week,
    intensityMultiplier: data.intensity_multiplier,
    workouts: (data.workouts || []).map(transformWorkoutData),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformWorkoutData(data: any): Workout {
  return {
    id: data.id,
    microcycleId: data.microcycle_id,
    dayOfWeek: data.day_of_week,
    name: data.name,
    description: data.description,
    durationMinutes: data.duration_minutes,
    intensity: data.intensity,
    workoutType: data.workout_type,
    exercises: (data.workout_exercises || []).map((we: any) => ({
      id: we.id,
      workoutId: we.workout_id,
      exerciseId: we.exercise_id,
      exerciseOrder: we.exercise_order,
      prescribedSets: we.prescribed_sets,
      prescribedRepsMin: we.prescribed_reps_min,
      prescribedRepsMax: we.prescribed_reps_max,
      prescribedWeightKg: we.prescribed_weight_kg,
      prescribedRpe: we.prescribed_rpe,
      restSeconds: we.rest_seconds,
      tempo: we.tempo,
      notes: we.notes,
      exercise: we.exercises
        ? {
            id: we.exercises.id,
            name: we.exercises.name,
            description: we.exercises.description,
            externalId: we.exercises.external_id,
            muscleGroups: we.exercises.muscle_groups,
            exerciseType: we.exercises.exercise_type,
            equipmentRequired: we.exercises.equipment_required,
            difficultyLevel: we.exercises.difficulty_level,
            videoUrl: we.exercises.video_url,
            formNotes: we.exercises.form_notes,
            createdAt: we.exercises.created_at,
            updatedAt: we.exercises.updated_at,
          }
        : undefined,
      createdAt: we.created_at,
      updatedAt: we.updated_at,
    })),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
