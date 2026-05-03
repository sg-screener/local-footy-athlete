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
import { Text } from '../../components/common/Text';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { signUp } from '../../services/auth/authService';
import type { AuthStackParamList } from '../../types/navigation';

type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(password)) {
      setError(
        'Password must contain uppercase, lowercase, and numbers'
      );
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await signUp({
        email: email.trim(),
        password,
        displayName: email.split('@')[0], // Use email prefix as display name
      });

      if (!response.success || !response.data) {
        setError(response.error?.message || 'Sign up failed. Please try again.');
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
          <Text variant="h2" color={colors.text.primary} align="center">
            Join Local Footy Athlete
          </Text>
          <Text
            variant="h4"
            color={colors.text.secondary}
            align="center"
            style={styles.subheader}
          >
            Start your free 1-week trial
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

          <View style={styles.passwordHint}>
            <Text variant="caption" color={colors.text.tertiary}>
              • At least 8 characters
            </Text>
            <Text variant="caption" color={colors.text.tertiary}>
              • Uppercase and lowercase letters
            </Text>
            <Text variant="caption" color={colors.text.tertiary}>
              • Numbers
            </Text>
          </View>

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            secureTextEntry
            editable={!loading}
            error={error && !confirmPassword ? 'Please confirm your password' : undefined}
          />

          {/* Create Account Button */}
          <Button
            title="Create Account"
            onPress={handleSignUp}
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading}
            style={styles.createButton}
          />
        </View>

        {/* Sign In Link */}
        <View style={styles.signInContainer}>
          <Text variant="body" color={colors.text.secondary}>
            Already have an account?{' '}
            <Text
              variant="bodyEmphasis"
              color={colors.accent.lime}
              onPress={() => !loading && navigation.navigate('SignIn')}
            >
              Sign In
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
    marginBottom: spacing.xl,
  },
  subheader: {
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
  passwordHint: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderColor: colors.surface.tertiary,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  createButton: {
    marginTop: spacing.lg,
  },
  signInContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopColor: colors.surface.tertiary,
    borderTopWidth: 1,
  },
});
