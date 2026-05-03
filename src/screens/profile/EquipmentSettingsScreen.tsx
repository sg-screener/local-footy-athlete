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
import { Button } from '../../components/common/Button';
import { SelectableTile } from '../../components/common';
import { useProfileStore } from '../../store/profileStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const EQUIPMENT_OPTIONS = [
  'Full Gym',
  'Home Gym',
  'Barbell & Rack',
  'Dumbbells Only',
  'Bodyweight Only',
  'Resistance Bands',
  'Kettlebells',
  'Cable Machine',
  'Pull-up Bar',
];

export const EquipmentSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const updateOnboardingData = useProfileStore((state) => state.updateOnboardingData);

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(
    onboardingData.equipment || []
  );
  const [loading, setLoading] = useState(false);

  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipment)
        ? prev.filter((e) => e !== equipment)
        : [...prev, equipment]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      updateOnboardingData({ equipment: selectedEquipment });
      navigation.goBack();
    } catch (error) {
      console.error('Error updating equipment:', error);
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
          Equipment
        </Text>
      </View>

      <Text variant="bodySmall" style={styles.description}>
        Select all the equipment you have access to
      </Text>

      {/*
       * Equipment grid uses the shared SelectableTile primitive so the
       * multi-select visual is identical to Goals, Motivations, and the
       * onboarding pickers. No more local cardSelected / checkmark styles.
       */}
      <View style={styles.equipmentGrid}>
        {EQUIPMENT_OPTIONS.map((equipment) => {
          const active = selectedEquipment.includes(equipment);
          return (
            <SelectableTile
              key={equipment}
              isSelected={active}
              onPress={() => toggleEquipment(equipment)}
              style={styles.equipmentCard}
            >
              <Text
                variant="body"
                style={[
                  styles.equipmentText,
                  active && styles.equipmentTextSelected,
                ]}
              >
                {equipment}
              </Text>
            </SelectableTile>
          );
        })}
      </View>

      {/* Save Button */}
      <Button
        title={loading ? 'Saving...' : 'Save Equipment'}
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
  description: {
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  } as TextStyle,
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  // Layout-only overrides — SelectableTile owns the selected look.
  equipmentCard: {
    flex: 0.48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  equipmentText: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
    paddingRight: 18, // clear the corner checkmark
  } as TextStyle,
  equipmentTextSelected: {
    color: colors.text.primary,
    fontWeight: '700',
  } as TextStyle,
  saveButton: {
    marginBottom: spacing.md,
  } as ViewStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
