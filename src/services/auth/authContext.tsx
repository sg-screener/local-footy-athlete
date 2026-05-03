import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from '../../store';
import { onAuthStateChange, getAuthUser } from './authService';

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: { id: string; email: string } | null;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const { setUser, setAuthenticated, setLoading } = useAuthStore();
  const authState = useAuthStore();

  useEffect(() => {
    // Initialize auth state on mount
    async function initializeAuth() {
      try {
        setLoading(true);
        const user = await getAuthUser();

        if (user) {
          setUser({
            id: user.id,
            email: user.email || '',
          });
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthenticated(false);
      } finally {
        setLoading(false);
        setIsInitializing(false);
      }
    }

    initializeAuth();
  }, []);

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChange((user, session) => {
      if (user && session) {
        setUser({
          id: user.id,
          email: user.email || '',
        });
        setAuthenticated(true);
      } else {
        setUser(null);
        setAuthenticated(false);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    isLoading: isInitializing,
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
