import { supabase, handleSupabaseError } from './supabaseClient';
import { ApiResponse } from '../../types/api';
import { ScheduleEvent } from '../../types/domain';

/**
 * Program Modification Service
 * Handles changes to training programs triggered by schedule events
 */

export type ChangeType = 'Injury' | 'Game Day Changed' | 'Change Training Days' | 'Bye Week' | 'Season Over' | 'Something Else';

export interface ChangeDetails {
  type: ChangeType;
  injuryDescription?: string;
  injurySeverity?: 'Minor niggle' | 'Can train around it' | 'Need to rest it' | 'Seeing physio';
  newGameDay?: number; // 0-6 for Mon-Sun
  newTrainingDays?: number[]; // Array of day numbers
  description?: string; // For "Something Else"
}

/**
 * Submit a change to the training program
 */
export async function submitChange(
  userId: string,
  change: ChangeDetails,
): Promise<ApiResponse<ScheduleEvent>> {
  try {
    const today = new Date().toISOString().split('T')[0];

    let eventType: 'Game' | 'Team Training' | 'Bye Week' | 'Injury' | 'Other' = 'Other';
    let eventName = '';
    let notes = '';

    switch (change.type) {
      case 'Injury':
        eventType = 'Injury';
        eventName = `Injury: ${change.injuryDescription}`;
        notes = `Severity: ${change.injurySeverity}`;
        break;

      case 'Game Day Changed':
        eventType = 'Game';
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        eventName = `Game Day Changed to ${dayNames[change.newGameDay || 0]}`;
        notes = `New game day: ${dayNames[change.newGameDay || 0]}`;
        break;

      case 'Change Training Days':
        eventType = 'Team Training';
        const trainingDaysStr = (change.newTrainingDays || [])
          .map(d => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][d])
          .join(', ');
        eventName = `Training Days Changed to ${trainingDaysStr}`;
        notes = `New training days: ${trainingDaysStr}`;
        break;

      case 'Bye Week':
        eventType = 'Bye Week';
        eventName = 'Bye Week - No Training';
        notes = 'Bye week assigned - training suspended for this period';
        break;

      case 'Season Over':
        eventType = 'Other';
        eventName = 'Season Over — shifted to Off-season mode';
        notes = 'Season has ended — shifting to Off-season mode';
        break;

      case 'Something Else':
        eventType = 'Other';
        eventName = 'Program Change';
        notes = change.description || 'Athlete requested program modification';
        break;
    }

    // Create schedule event
    const { data, error } = await supabase
      .from('schedule_events')
      .insert([
        {
          user_id: userId,
          event_type: eventType,
          event_name: eventName,
          start_date: today,
          end_date: today,
          modifies_program: true,
          notes: notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Transform response
    const scheduleEvent: ScheduleEvent = {
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

    return {
      data: scheduleEvent,
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
 * Get recent changes/modifications for a user
 */
export async function getRecentChanges(
  userId: string,
  days: number = 30,
): Promise<ApiResponse<ScheduleEvent[]>> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('user_id', userId)
      .eq('modifies_program', true)
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const scheduleEvents: ScheduleEvent[] = data.map((event) => ({
      id: event.id,
      userId: event.user_id,
      eventType: event.event_type,
      eventName: event.event_name,
      startDate: event.start_date,
      endDate: event.end_date,
      modifiesProgram: event.modifies_program,
      notes: event.notes,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    }));

    return {
      data: scheduleEvents,
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
