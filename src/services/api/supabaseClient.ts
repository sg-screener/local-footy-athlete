import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import {
  describeMissingClientEnv,
  getClientEnvConfig,
} from '../../config/env';

const clientEnv = getClientEnvConfig();

if (!clientEnv.isReady) {
  throw new Error(describeMissingClientEnv(clientEnv));
}

// Custom storage adapter using expo-secure-store for secure token storage
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`Error retrieving ${key} from secure storage:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`Error storing ${key} in secure storage:`, error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Error deleting ${key} from secure storage:`, error);
    }
  },
};

export const supabase: SupabaseClient = createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper function to get the current user
export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Helper function to get the current session
export async function getCurrentSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
}

/**
 * Normalise any thrown value into the error shape every service layer expects.
 *
 * `details` is `Record<string, unknown>`, not `unknown`: every caller declares
 * its own local error type wanting a keyed object, and returning `unknown` made
 * all six service files fail to compile (33 of the 136 product-`src` errors in
 * docs/TYPECHECK_BASELINE_TRIAGE_2026-07-24.md — one declaration, 33 symptoms).
 * The runtime values were already objects; only the declaration was wrong.
 */
export function handleSupabaseError(error: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
    };
  }

  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;

    if ('status' in err) {
      return {
        code: `HTTP_${err.status}`,
        message: (err.message as string) || 'HTTP error',
        details: err,
      };
    }

    if ('message' in err) {
      return {
        code: 'SUPABASE_ERROR',
        message: (err.message as string) || 'Supabase error',
        details: err,
      };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
  };
}
