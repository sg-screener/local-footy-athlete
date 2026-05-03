import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: { id: string; email: string } | null;
  session: { accessToken: string; refreshToken: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthState['user']) => void;
  setSession: (session: AuthState['session']) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),

      setSession: (session) => set({ session }),

      setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      signOut: () => {
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clear: () => {
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
