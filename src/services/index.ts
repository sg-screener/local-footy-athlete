/**
 * Service Layer Exports
 * Central export point for all API and business logic services
 */

// Supabase Client
export { supabase, getCurrentUser, getCurrentSession, handleSupabaseError } from './api/supabaseClient';

// Auth Service
export * from './auth/authService';

// Program Service
export * from './api/programService';

// Workout Service
export * from './api/workoutService';

// Coach Service
export * from './api/coachService';

// Schedule Service
export * from './api/scheduleService';
