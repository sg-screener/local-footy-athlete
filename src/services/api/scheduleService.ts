import { supabase, handleSupabaseError } from './supabaseClient';
import { ScheduleEvent } from '../../types/domain';
import { ApiResponse } from '../../types/api';

/**
 * Get events within a date range
 */
export async function getEvents(
  userId: string,
  dateRange?: { startDate: string; endDate: string },
): Promise<ApiResponse<ScheduleEvent[]>> {
  try {
    let query = supabase.from('schedule_events').select('*').eq('user_id', userId);

    if (dateRange) {
      query = query
        .gte('start_date', dateRange.startDate)
        .lte('end_date', dateRange.endDate);
    }

    const { data, error } = await query.order('start_date', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      data: data.map(transformScheduleEventData),
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
 * Create a schedule event
 */
export async function createEvent(eventData: {
  userId: string;
  eventType: string;
  eventName: string;
  startDate: string;
  endDate: string;
  modifiesProgram: boolean;
  notes?: string;
}): Promise<ApiResponse<ScheduleEvent>> {
  try {
    const { data, error } = await supabase
      .from('schedule_events')
      .insert([
        {
          user_id: eventData.userId,
          event_type: eventData.eventType,
          event_name: eventData.eventName,
          start_date: eventData.startDate,
          end_date: eventData.endDate,
          modifies_program: eventData.modifiesProgram,
          notes: eventData.notes,
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
      data: transformScheduleEventData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as ScheduleEvent,
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
 * Update a schedule event
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<ScheduleEvent>,
): Promise<ApiResponse<ScheduleEvent>> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.eventName) updateData.event_name = updates.eventName;
    if (updates.eventType) updateData.event_type = updates.eventType;
    if (updates.startDate) updateData.start_date = updates.startDate;
    if (updates.endDate) updateData.end_date = updates.endDate;
    if (updates.modifiesProgram !== undefined) updateData.modifies_program = updates.modifiesProgram;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await supabase
      .from('schedule_events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: transformScheduleEventData(data),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as ScheduleEvent,
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
 * Delete a schedule event
 */
export async function deleteEvent(eventId: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase
      .from('schedule_events')
      .delete()
      .eq('id', eventId);

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

/**
 * Get upcoming events for the next 7 days
 */
export async function getUpcomingEvents(userId: string): Promise<ApiResponse<ScheduleEvent[]>> {
  try {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_date', todayStr)
      .lte('end_date', nextWeekStr)
      .order('start_date', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      data: data.map(transformScheduleEventData),
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
 * Get events by type for a user
 */
export async function getEventsByType(
  userId: string,
  eventType: string,
): Promise<ApiResponse<ScheduleEvent[]>> {
  try {
    const { data, error } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .order('start_date', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      data: data.map(transformScheduleEventData),
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

// Helper function
function transformScheduleEventData(data: any): ScheduleEvent {
  return {
    id: data.id,
    userId: data.user_id,
    eventType: data.event_type,
    eventName: data.event_name,
    startDate: data.start_date,
    endDate: data.end_date,
    modifiesProgram: data.modifies_program,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
