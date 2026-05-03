import { supabase, getCurrentUser, handleSupabaseError } from '../api/supabaseClient';
import {
  SignUpRequest,
  SignUpResponse,
  SignInRequest,
  SignInResponse,
  ApiResponse,
} from '../../types/api';

/**
 * Sign up a new user with email and password
 */
export async function signUp(request: SignUpRequest): Promise<ApiResponse<SignUpResponse>> {
  try {
    const { email, password, displayName } = request;

    // Create auth user
    const {
      data: { user, session },
      error: authError,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (authError) {
      throw authError;
    }

    if (!user || !session) {
      throw new Error('Sign up failed: No user or session returned');
    }

    // Create user profile record
    const { error: profileError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      display_name: displayName,
      subscription_status: 'trial',
      onboarding_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      throw profileError;
    }

    return {
      data: {
        user: {
          id: user.id,
          email: user.email || '',
        },
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
          expires_in: session.expires_in || 3600,
        },
      },
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as SignUpResponse,
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
 * Sign in with email and password
 */
export async function signIn(request: SignInRequest): Promise<ApiResponse<SignInResponse>> {
  try {
    const { email, password } = request;

    const {
      data: { user, session },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!user || !session) {
      throw new Error('Sign in failed: No user or session returned');
    }

    return {
      data: {
        user: {
          id: user.id,
          email: user.email || '',
        },
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
          expires_in: session.expires_in || 3600,
        },
      },
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as SignInResponse,
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
 * Sign out the current user
 */
export async function signOut(): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase.auth.signOut();

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
 * Request password reset email
 */
export async function resetPassword(email: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.EXPO_PUBLIC_APP_URL || 'app://reset-password'}`,
    });

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
 * Update password with recovery token
 */
export async function updatePassword(newPassword: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

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
 * Get the current authenticated user
 */
export async function getAuthUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    console.error('Error getting auth user:', error);
    return null;
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: any, session: any) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null, session || null);
  });

  // Return unsubscribe function
  return () => {
    subscription?.unsubscribe();
  };
}
