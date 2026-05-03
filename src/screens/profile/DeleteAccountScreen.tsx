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
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export const DeleteAccountScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const signOut = useAuthStore((state) => state.signOut);

  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isConfirmed = confirmText.toUpperCase() === 'DELETE';

  const handleDeleteAccount = async () => {
    if (!isConfirmed) return;

    setLoading(true);
    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      setError('Failed to delete account. Please try again.');
      console.error('Error deleting account:', err);
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
          Delete Account
        </Text>
      </View>

      {/* Warning Card */}
      <View style={styles.warningCard}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text variant="h4" style={styles.warningTitle}>
          Permanent Action
        </Text>
        <Text variant="body" style={styles.warningText}>
          This will permanently delete your account and all associated data. This action cannot be undone.
        </Text>
      </View>

      {/* Consequences List */}
      <Text variant="label" style={styles.consequencesTitle}>
        What will be deleted:
      </Text>
      <View style={styles.consequencesList}>
        <View style={styles.consequenceItem}>
          <Text style={styles.bullet}>•</Text>
          <Text variant="body" style={styles.consequenceText}>
            Your profile and personal information
          </Text>
        </View>
        <View style={styles.consequenceItem}>
          <Text style={styles.bullet}>•</Text>
          <Text variant="body" style={styles.consequenceText}>
            All your workout history and progress data
          </Text>
        </View>
        <View style={styles.consequenceItem}>
          <Text style={styles.bullet}>•</Text>
          <Text variant="body" style={styles.consequenceText}>
            Your training plans and preferences
          </Text>
        </View>
        <View style={styles.consequenceItem}>
          <Text style={styles.bullet}>•</Text>
          <Text variant="body" style={styles.consequenceText}>
            Your subscription and billing information
          </Text>
        </View>
      </View>

      {/* Confirmation Input */}
      <Text variant="label" style={styles.confirmLabel}>
        Type "DELETE" to confirm
      </Text>
      <Input
        label=""
        value={confirmText}
        onChangeText={(text) => {
          setConfirmText(text);
          setError('');
        }}
        placeholder="Type DELETE"
        style={styles.confirmInput}
      />

      {error && (
        <Text variant="caption" style={styles.errorText}>
          {error}
        </Text>
      )}

      {/* Delete Button */}
      <Button
        title={loading ? 'Deleting...' : 'Delete My Account'}
        variant="danger"
        onPress={handleDeleteAccount}
        disabled={loading || !isConfirmed}
        style={styles.deleteButton}
      />

      {/* Cancel Button */}
      <Button
        title="Cancel"
        variant="secondary"
        onPress={() => navigation.goBack()}
        disabled={loading}
        style={styles.cancelButton}
      />

      {/* Help Text */}
      <Text variant="caption" style={styles.helpText}>
        Having second thoughts? Contact our support team for help.
      </Text>

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
  warningCard: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 2,
    borderColor: colors.status.error,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  } as ViewStyle,
  warningIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  } as TextStyle,
  warningTitle: {
    color: colors.status.error,
    marginBottom: spacing.md,
  } as TextStyle,
  warningText: {
    color: colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,
  consequencesTitle: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as TextStyle,
  consequencesList: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  } as ViewStyle,
  consequenceItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  bullet: {
    color: colors.status.error,
    marginRight: spacing.md,
    fontSize: 18,
  } as TextStyle,
  consequenceText: {
    color: colors.text.secondary,
    flex: 1,
  } as TextStyle,
  confirmLabel: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as TextStyle,
  confirmInput: {
    marginBottom: spacing.md,
    borderColor: colors.status.error,
  } as ViewStyle,
  errorText: {
    color: colors.status.error,
    marginBottom: spacing.md,
  } as TextStyle,
  deleteButton: {
    marginBottom: spacing.md,
    backgroundColor: colors.status.error,
  } as ViewStyle,
  cancelButton: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  helpText: {
    color: colors.text.tertiary,
    textAlign: 'center',
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
