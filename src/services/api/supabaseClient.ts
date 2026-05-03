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

// Helper to handle Supabase errors
export function handleSupabaseError(error: unknown): {
  code: string;
  message: string;
  details?: unknown;
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
        details: error,
      };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
  };
}
