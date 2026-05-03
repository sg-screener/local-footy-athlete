import { useCallback } from 'react';
import { useAuthStore } from '../../store';
import {
  signUp as signUpService,
  signIn as signInService,
  signOut as signOutService,
  resetPassword as resetPasswordService,
  updatePassword as updatePasswordService,
} from './authService';
import { SignUpRequest, SignInRequest } from '../../types/api';

/**
 * Custom hook for authentication operations
 * Provides sign up, sign in, sign out, and password reset functionality
 */
export function useAuthHook() {
  const { setUser, setSession, setAuthenticated, setLoading, setError, signOut: clearAuth } =
    useAuthStore();

  const signUp = useCallback(
    async (request: SignUpRequest) => {
      try {
        setLoading(true);
        setError(null);

        const response = await signUpService(request);

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Sign up failed');
        }

        setUser({
          id: response.data.user.id,
          email: response.data.user.email,
        });

        setSession({
          accessToken: response.data.session.access_token,
          refreshToken: response.data.session.refresh_token,
        });

        setAuthenticated(true);

        return {
          success: true,
          data: response.data,
          error: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign up failed';
        setError(message);
        return {
          success: false,
          data: null,
          error: {
            code: 'SIGNUP_ERROR',
            message,
          },
        };
      } finally {
        setLoading(false);
      }
    },
    [setUser, setSession, setAuthenticated, setLoading, setError],
  );

  const signIn = useCallback(
    async (request: SignInRequest) => {
      try {
        setLoading(true);
        setError(null);

        const response = await signInService(request);

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Sign in failed');
        }

        setUser({
          id: response.data.user.id,
          email: response.data.user.email,
        });

        setSession({
          accessToken: response.data.session.access_token,
          refreshToken: response.data.session.refresh_token,
        });

        setAuthenticated(true);

        return {
          success: true,
          data: response.data,
          error: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign in failed';
        setError(message);
        return {
          success: false,
          data: null,
          error: {
            code: 'SIGNIN_ERROR',
            message,
          },
        };
      } finally {
        setLoading(false);
      }
    },
    [setUser, setSession, setAuthenticated, setLoading, setError],
  );

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await signOutService();

      if (!response.success) {
        throw new Error(response.error?.message || 'Sign out failed');
      }

      clearAuth();

      return {
        success: true,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      setError(message);
      return {
        success: false,
        error: {
          code: 'SIGNOUT_ERROR',
          message,
        },
      };
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, clearAuth]);

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await resetPasswordService(email);

        if (!response.success) {
          throw new Error(response.error?.message || 'Password reset failed');
        }

        return {
          success: true,
          error: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Password reset failed';
        setError(message);
        return {
          success: false,
          error: {
            code: 'RESET_PASSWORD_ERROR',
            message,
          },
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await updatePasswordService(newPassword);

        if (!response.success) {
          throw new Error(response.error?.message || 'Password update failed');
        }

        return {
          success: true,
          error: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Password update failed';
        setError(message);
        return {
          success: false,
          error: {
            code: 'UPDATE_PASSWORD_ERROR',
            message,
          },
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  return {
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };
}
