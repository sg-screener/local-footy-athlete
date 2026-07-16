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
import { useProfileStore } from '../../store/profileStore';
import type { RoleBucket } from '../../types/domain';
import { ROLE_BUCKET_OPTIONS, normalizeRoleBucket } from '../../utils/roleBuckets';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';
import { todayISOLocal } from '../../utils/appDate';

export const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);

  const [name, setName] = useState(onboardingData.firstName || '');
  const [selectedPosition, setSelectedPosition] = useState<RoleBucket | null>(
    onboardingData.position ? normalizeRoleBucket(onboardingData.position) : null,
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await commitProfileProgramTransaction({
        change: {
          kind: 'profile_setup',
          patch: {
            firstName: name,
            ...(selectedPosition ? { position: selectedPosition } : {}),
          },
        },
        todayISO: todayISOLocal(),
        sourceSurface: 'edit_profile',
      });
      if (!result.ok) throw new Error(result.reason ?? 'edit_profile_transaction_failed');
      navigation.goBack();
    } catch (error) {
      console.error('Error updating profile:', error);
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
          Edit Profile
        </Text>
      </View>

      {/* Name Input */}
      <Text variant="label" style={styles.label}>
        Name
      </Text>
      <Input
        label=""
        value={name}
        onChangeText={setName}
        placeholder="Your first name or nickname"
      />

      {/* Role Selector */}
      <Text variant="label" style={styles.label}>
        Role
      </Text>
      <View style={styles.positionGrid}>
        {ROLE_BUCKET_OPTIONS.map((role) => (
          <Pressable
            key={role.id}
            onPress={() => setSelectedPosition(role.id)}
            style={[
              styles.positionCard,
              selectedPosition === role.id && styles.positionCardActive,
            ]}
          >
            <Text
              variant="body"
              style={[
                styles.positionText,
                selectedPosition === role.id && styles.positionTextActive,
              ]}
            >
              {role.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Save Button */}
      <Button
        title={loading ? 'Saving...' : 'Save Changes'}
        variant="primary"
        onPress={handleSave}
        disabled={loading || !name.trim() || !selectedPosition}
        style={styles.saveButton}
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
  label: {
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  } as TextStyle,
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginVertical: spacing.md,
  } as ViewStyle,
  positionCard: {
    flex: 0.48,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.surface.tertiary,
    alignItems: 'center',
  } as ViewStyle,
  positionCardActive: {
    borderColor: colors.accent.lime,
    backgroundColor: colors.surface.tertiary,
  } as ViewStyle,
  positionText: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  } as TextStyle,
  positionTextActive: {
    color: colors.accent.lime,
    fontWeight: '700',
  } as TextStyle,
  saveButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  } as ViewStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
