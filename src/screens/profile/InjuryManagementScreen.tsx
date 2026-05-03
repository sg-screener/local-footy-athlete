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
import { SelectableTile } from '../../components/common';
import { useProfileStore } from '../../store/profileStore';
import { OnboardingInjury } from '../../types/domain';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'];

export const InjuryManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const updateOnboardingData = useProfileStore((state) => state.updateOnboardingData);

  const [showForm, setShowForm] = useState(false);
  const [bodyPart, setBodyPart] = useState('');
  const [severity, setSeverity] = useState('Mild');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const injuries = onboardingData.injuries || [];

  const handleAddInjury = async () => {
    if (!bodyPart.trim()) return;

    setLoading(true);
    try {
      const newInjury: OnboardingInjury = {
        bodyArea: bodyPart,
        description: `${severity}${notes ? ' - ' + notes : ''}`,
      };

      updateOnboardingData({
        injuries: [...injuries, newInjury],
      });

      setBodyPart('');
      setSeverity('Mild');
      setNotes('');
      setShowForm(false);
    } catch (error) {
      console.error('Error adding injury:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveInjury = async (index: number) => {
    setLoading(true);
    try {
      const updatedInjuries = injuries.filter((_, i) => i !== index);
      updateOnboardingData({ injuries: updatedInjuries });
    } catch (error) {
      console.error('Error removing injury:', error);
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
          Injury Management
        </Text>
      </View>

      {/* Injuries List */}
      {injuries.length > 0 && (
        <View style={styles.injuriesContainer}>
          <Text variant="label" style={styles.listTitle}>
            Current Injuries
          </Text>
          {injuries.map((injury, index) => (
            <Card key={index} variant="default" style={styles.injuryCard}>
              <View style={styles.injuryHeader}>
                <View style={styles.injuryInfo}>
                  <Text variant="bodyEmphasis" style={styles.bodyPart}>
                    {injury.bodyArea}
                  </Text>
                  <Text variant="bodySmall" style={styles.injuryDescription}>
                    {injury.description}
                  </Text>
                </View>
                <Pressable onPress={() => handleRemoveInjury(index)}>
                  <Text style={styles.removeButton}>✕</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Add Injury Form */}
      {!showForm ? (
        <Button
          title="+ Add Injury"
          variant="primary"
          onPress={() => setShowForm(true)}
          style={styles.addButton}
        />
      ) : (
        <View style={styles.formContainer}>
          <Text variant="label" style={styles.formLabel}>
            Body Part
          </Text>
          <Input
            label=""
            value={bodyPart}
            onChangeText={setBodyPart}
            placeholder="e.g., Hamstring, Knee, Shoulder"
          />

          <Text variant="label" style={styles.formLabel}>
            Severity
          </Text>
          {/*
           * Severity picker migrated to shared SelectableTile so the single-
           * select vocabulary (lime border + tinted fill + corner checkmark)
           * matches every other multi/single-select surface in the app.
           */}
          <View style={styles.severityGrid}>
            {SEVERITY_OPTIONS.map((option) => {
              const active = severity === option;
              return (
                <SelectableTile
                  key={option}
                  isSelected={active}
                  onPress={() => setSeverity(option)}
                  style={styles.severityCard}
                >
                  <Text
                    variant="body"
                    style={[
                      styles.severityOption,
                      active && styles.severityOptionActive,
                    ]}
                  >
                    {option}
                  </Text>
                </SelectableTile>
              );
            })}
          </View>

          <Text variant="label" style={styles.formLabel}>
            Notes (Optional)
          </Text>
          <Input
            label=""
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes about the injury"
            multiline
          />

          <View style={styles.formButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setShowForm(false);
                setBodyPart('');
                setSeverity('Mild');
                setNotes('');
              }}
              style={styles.cancelButton}
            />
            <Button
              title={loading ? 'Adding...' : 'Add Injury'}
              variant="primary"
              onPress={handleAddInjury}
              disabled={loading || !bodyPart.trim()}
              style={styles.submitButton}
            />
          </View>
        </View>
      )}

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
  injuriesContainer: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  listTitle: {
    color: colors.text.primary,
    marginBottom: spacing.md,
  } as TextStyle,
  injuryCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface.secondary,
  } as ViewStyle,
  injuryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  } as ViewStyle,
  injuryInfo: {
    flex: 1,
  } as ViewStyle,
  bodyPart: {
    color: colors.text.primary,
    marginBottom: spacing.xs,
  } as TextStyle,
  injuryDescription: {
    color: colors.text.secondary,
  } as TextStyle,
  removeButton: {
    color: colors.status.error,
    fontSize: 20,
    fontWeight: '700',
  } as TextStyle,
  addButton: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  formContainer: {
    backgroundColor: colors.surface.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  formLabel: {
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  } as TextStyle,
  severityGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  // Layout-only override — SelectableTile owns the selected visual.
  severityCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  severityOption: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
    // Clear the shared corner checkmark badge.
    paddingRight: 18,
  } as TextStyle,
  severityOptionActive: {
    color: colors.text.primary,
    fontWeight: '700',
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
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
