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
import { resetPassword } from '../../services/auth/authService';
import type { AuthStackParamList } from '../../types/navigation';

type ForgotPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'ForgotPassword'
>;

export default function ForgotPasswordScreen({
  navigation,
}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    setError(null);
    setSuccess(false);

    if (!validateEmail()) {
      return;
    }

    setLoading(true);

    try {
      const response = await resetPassword(email.trim());

      if (!response.success) {
        setError(response.error?.message || 'Failed to send reset email. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Auto-navigate back after 3 seconds
      setTimeout(() => {
        navigation.navigate('SignIn');
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Icon */}
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text variant="h2" color={colors.accent.lime} align="center" style={styles.successTitle}>
              Email Sent!
            </Text>
            <Text
              variant="body"
              color={colors.text.secondary}
              align="center"
              style={styles.successMessage}
            >
              Check your email for a link to reset your password. If you don't see it, check your spam folder.
            </Text>
          </View>

          {/* Back to Sign In Button */}
          <Button
            title="Back to Sign In"
            onPress={() => navigation.navigate('SignIn')}
            variant="primary"
            size="lg"
            fullWidth
          />
        </ScrollView>
      </View>
    );
  }

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
          {/* Back Button */}
          <Pressable
            onPress={() => navigation.navigate('SignIn')}
            disabled={loading}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed && !loading ? 0.6 : 1 },
            ]}
          >
            <Text variant="body" color={colors.accent.lime}>
              ← Back
            </Text>
          </Pressable>

          <Text variant="h2" color={colors.text.primary} align="center" style={styles.title}>
            Reset Password
          </Text>
          <Text
            variant="body"
            color={colors.text.secondary}
            align="center"
            style={styles.description}
          >
            Enter your email address and we'll send you a link to reset your password.
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

          {/* Send Reset Link Button */}
          <Button
            title="Send Reset Link"
            onPress={handleResetPassword}
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading}
            style={styles.resetButton}
          />
        </View>

        {/* Additional Help */}
        <View style={styles.helpContainer}>
          <Text variant="bodySmall" color={colors.text.tertiary} align="center">
            Didn't receive an email? Check your spam folder or{' '}
            <Text
              variant="bodySmallEmphasis"
              color={colors.accent.lime}
              onPress={() => {
                // Contact support functionality would go here
              }}
            >
              contact support
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: {
    marginBottom: spacing.md,
  },
  description: {
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
  resetButton: {
    marginTop: spacing.lg,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  successIcon: {
    fontSize: 72,
    color: colors.accent.lime,
    marginBottom: spacing.lg,
  },
  successTitle: {
    marginBottom: spacing.md,
  },
  successMessage: {
    marginBottom: spacing.xl,
  },
  helpContainer: {
    paddingTop: spacing.lg,
    borderTopColor: colors.surface.tertiary,
    borderTopWidth: 1,
  },
});
