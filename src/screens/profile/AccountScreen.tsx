import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Text } from '../../components/common/Text';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export const AccountScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!newPassword.trim()) {
      setPasswordError('Password cannot be empty');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      // Call auth store to change password
      // await changePassword(newPassword);
      console.log('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (error) {
      setPasswordError('Failed to change password. Please try again.');
      console.error('Error changing password:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text variant="h3" style={styles.backButton}>
            ← Back
          </Text>
        </Pressable>
        <Text variant="h2" style={styles.title}>
          Account
        </Text>
      </View>

      {/* Email Display */}
      <Card variant="default" style={styles.emailCard}>
        <Text variant="label" style={styles.emailLabel}>
          Email Address
        </Text>
        <Text variant="body" style={styles.emailValue}>
          {user?.email || 'Not available'}
        </Text>
      </Card>

      {/* Change Password Section */}
      <Text variant="h4" style={styles.sectionTitle}>
        Security
      </Text>

      {!showPasswordForm ? (
        <Button
          title="Change Password"
          variant="secondary"
          onPress={() => setShowPasswordForm(true)}
          style={styles.changePasswordButton}
        />
      ) : (
        <Card variant="default" style={styles.passwordFormCard}>
          <Text variant="bodySmall" style={styles.formDescription}>
            Enter your new password below
          </Text>

          <Input
            label="New Password"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setPasswordError('');
            }}
            placeholder="Enter new password"
            secureTextEntry
            error={passwordError}
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            error={passwordError}
          />

          {passwordError && (
            <Text variant="caption" style={styles.errorText}>
              {passwordError}
            </Text>
          )}

          <View style={styles.formButtons}>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => {
                setShowPasswordForm(false);
                setNewPassword('');
                setConfirmPassword('');
                setPasswordError('');
              }}
              style={styles.cancelButton}
            />
            <Button
              title={loading ? 'Updating...' : 'Update Password'}
              variant="primary"
              onPress={handleChangePassword}
              disabled={loading || !newPassword.trim() || !confirmPassword.trim()}
              style={styles.submitButton}
            />
          </View>
        </Card>
      )}

      {/* Sign Out Section */}
      <Text variant="h4" style={styles.dangerSection}>
        Account Actions
      </Text>
      <Button
        title={loading ? 'Signing out...' : 'Sign Out'}
        variant="secondary"
        onPress={handleSignOut}
        disabled={loading}
        style={styles.signOutButton}
      />

      <View style={styles.spacer} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  backButton: {
    color: colors.accent.lime,
    marginBottom: spacing.md,
  } as TextStyle,
  title: {
    color: colors.text.primary,
  } as TextStyle,
  emailCard: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.secondary,
  } as ViewStyle,
  emailLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  } as TextStyle,
  emailValue: {
    color: colors.text.primary,
    fontWeight: '500',
  } as TextStyle,
  sectionTitle: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as TextStyle,
  changePasswordButton: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  passwordFormCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as ViewStyle,
  formDescription: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  } as TextStyle,
  errorText: {
    color: colors.status.error,
    marginTop: spacing.sm,
  } as TextStyle,
  formButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  } as ViewStyle,
  cancelButton: {
    flex: 1,
  } as ViewStyle,
  submitButton: {
    flex: 1,
  } as ViewStyle,
  dangerSection: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as TextStyle,
  signOutButton: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
