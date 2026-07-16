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
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';
import { todayISOLocal } from '../../utils/appDate';

export const HealthSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);

  const [height, setHeight] = useState(onboardingData.heightCm?.toString() || '');
  const [weight, setWeight] = useState(onboardingData.weightKg?.toString() || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await commitProfileProgramTransaction({
        change: {
          kind: 'profile_setup',
          patch: {
            heightCm: height ? parseInt(height, 10) : undefined,
            weightKg: weight ? parseInt(weight, 10) : undefined,
          },
        },
        todayISO: todayISOLocal(),
        sourceSurface: 'health_settings',
      });
      if (!result.ok) throw new Error(result.reason ?? 'health_settings_transaction_failed');
      navigation.goBack();
    } catch (error) {
      console.error('Error updating health settings:', error);
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
          Health Settings
        </Text>
      </View>

      {/* Height Input */}
      <Text variant="label" style={styles.label}>
        Height (cm)
      </Text>
      <Input
        label=""
        value={height}
        onChangeText={setHeight}
        placeholder="Enter your height in cm"
        keyboardType="numeric"
      />

      {/* Weight Input */}
      <Text variant="label" style={styles.label}>
        Weight (kg)
      </Text>
      <Input
        label=""
        value={weight}
        onChangeText={setWeight}
        placeholder="Enter your weight in kg"
        keyboardType="numeric"
      />

      {/* Save Button */}
      <Button
        title={loading ? 'Saving...' : 'Save Health Settings'}
        variant="primary"
        onPress={handleSave}
        disabled={loading}
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
  saveButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  } as ViewStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
