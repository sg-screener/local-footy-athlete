/**
 * Shared utilities for Supabase Edge Functions
 * Database client creation, error handling, response helpers
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import type { Database } from '../../../src/types/supabase';

// Initialize Supabase client for edge functions
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

/**
 * Standard error response format
 */
export function errorResponse(
  message: string,
  status: number = 400,
  details?: unknown
) {
  console.error(`[Error] ${message}`, details);
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      ...(details && { details }),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Standard success response format
 */
export function successResponse(data: unknown, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T = any>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch (error) {
    throw new Error(`Invalid JSON in request body: ${error}`);
  }
}

/**
 * Validate required fields in object
 */
export function validateRequired(obj: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Generate ISO datetime string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get week number from date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Format ISO date string to readable format
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get start of week (Monday) from date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Get end of week (Sunday) from date
 */
export function getWeekEnd(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  return new Date(d.setDate(diff));
}

/**
 * Random selection from array
 */
export function randomSelect<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('Cannot select from empty array');
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Random selection of N items from array without replacement
 */
export function randomSelectMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Safe database transaction wrapper
 */
export async function withTransaction<T>(
  client: ReturnType<typeof createSupabaseClient>,
  callback: (client: ReturnType<typeof createSupabaseClient>) => Promise<T>
): Promise<T> {
  try {
    return await callback(client);
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
}

/**
 * Retry helper for flaky operations
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Log with context
 */
export function log(context: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${context}] ${message}`, data || '');
}
