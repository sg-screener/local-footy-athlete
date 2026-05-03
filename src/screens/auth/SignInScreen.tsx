import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { signIn } from '../../services/auth/authService';
import type { AuthStackParamList } from '../../types/navigation';

type SignInScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUser = useAuthStore((state) => state.setUser);
  const setSession = useAuthStore((state) => state.setSession);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!password) {
      setError('Password is required');
      return false;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    return true;
  };

  const handleSignIn = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await signIn({
        email: email.trim(),
        password,
      });

      if (!response.success || !response.data) {
        setError(response.error?.message || 'Sign in failed. Please try again.');
        setLoading(false);
        return;
      }

      // Update auth store with response data
      setUser({
        id: response.data.user.id,
        email: response.data.user.email,
      });

      setSession({
        accessToken: response.data.session.access_token,
        refreshToken: response.data.session.refresh_token,
      });

      setAuthenticated(true);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h1" color={colors.accent.lime} align="center">
            Local Footy Athlete
          </Text>
          <Text
            variant="h4"
            color={colors.text.secondary}
            align="center"
            style={styles.tagline}
          >
            Your AI-Powered S&C Coach
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text variant="bodySmall" color={colors.status.error}>
              {error}
            </Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            error={error && !email ? 'Email is required' : undefined}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            editable={!loading}
            error={error && !password ? 'Password is required' : undefined}
          />

          {/* Forgot Password Link */}
          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading}
            style={({ pressed }) => ({
              opacity: pressed && !loading ? 0.6 : 1,
            })}
          >
            <Text
              variant="bodySmall"
              color={colors.accent.lime}
              align="right"
              style={styles.forgotPasswordLink}
            >
              Forgot Password?
            </Text>
          </Pressable>

          {/* Sign In Button */}
          <Button
            title="Sign In"
            onPress={handleSignIn}
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading}
            style={styles.signInButton}
          />
        </View>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text variant="body" color={colors.text.secondary}>
            Don't have an account?{' '}
            <Text
              variant="bodyEmphasis"
              color={colors.accent.lime}
              onPress={() => !loading && navigation.navigate('SignUp')}
            >
              Sign Up
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  tagline: {
    marginTop: spacing.sm,
  },
  errorContainer: {
    backgroundColor: colors.status.errorDark + '20',
    borderRadius: borderRadius.md,
    borderColor: colors.status.error,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  form: {
    marginBottom: spacing.xl,
  },
  forgotPasswordLink: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  signInButton: {
    marginTop: spacing.lg,
  },
  signUpContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopColor: colors.surface.tertiary,
    borderTopWidth: 1,
  },
});
