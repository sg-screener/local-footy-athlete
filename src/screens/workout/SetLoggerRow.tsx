import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import type { LoggedSet } from '../../types/domain';

interface SetLoggerRowProps {
  set: LoggedSet;
  setIndex: number;
  prescribed: {
    reps: number;
    weight: number;
  };
  onUpdate: (updates: Partial<LoggedSet>) => void;
}

export const SetLoggerRow = ({
  set,
  setIndex,
  prescribed,
  onUpdate,
}: SetLoggerRowProps) => {
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weight, setWeight] = useState(String(set.actualWeightKg || prescribed.weight));

  const handleWeightChange = (text: string) => {
    setWeight(text);
  };

  const handleConfirmWeight = () => {
    const newWeight = weight ? parseFloat(weight) : prescribed.weight;
    onUpdate({ actualWeightKg: newWeight });
    setIsEditingWeight(false);
  };

  const incrementWeight = () => {
    Haptics.selectionAsync();
    const parsed = parseFloat(weight);
    // Use parsed value if valid, otherwise fall back to prescribed only on first tap
    const currentWeight = !isNaN(parsed) ? parsed : (prescribed.weight || 0);
    const newWeight = currentWeight + 2.5;
    setWeight(String(newWeight));
    onUpdate({ actualWeightKg: newWeight });
  };

  const decrementWeight = () => {
    Haptics.selectionAsync();
    const parsed = parseFloat(weight);
    // If weight is not a valid number, nothing to decrement
    if (isNaN(parsed)) return;
    // Floor at 0 — never wrap back to prescribed.weight
    if (parsed <= 0) return;
    const newWeight = Math.max(0, parsed - 2.5);
    setWeight(String(newWeight));
    onUpdate({ actualWeightKg: newWeight });
  };

  const toggleSetComplete = () => {
    Haptics.selectionAsync();
    onUpdate({ completed: !set.completed });
  };

  return (
    <View style={styles.row}>
      {/* Set circle - tappable to mark complete/incomplete */}
      <Pressable
        onPress={toggleSetComplete}
        style={[
          styles.setCircle,
          set.completed && styles.setCircleCompleted,
        ]}
      >
        <Text
          variant="bodySmall"
          color={set.completed ? colors.button.primaryText : colors.text.secondary}
          style={styles.setCircleText}
        >
          {setIndex + 1}
        </Text>
      </Pressable>

      {/* Reps display */}
      <View style={styles.repsSection}>
        <Text variant="caption" color={colors.text.secondary}>
          Reps
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.primary}
          style={styles.repsValue}
        >
          {prescribed.reps}
        </Text>
      </View>

      {/* Weight section with +/- buttons */}
      <View style={styles.weightSection}>
        <Pressable
          onPress={decrementWeight}
          style={({ pressed }) => [
            styles.weightButton,
            pressed && styles.weightButtonPressed,
          ]}
        >
          <Text color={colors.accent.lime} style={styles.weightButtonText}>
            −
          </Text>
        </Pressable>

        {isEditingWeight ? (
          <TextInput
            style={styles.weightInput}
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={handleWeightChange}
            onBlur={handleConfirmWeight}
            autoFocus
          />
        ) : (
          <Pressable
            onPress={() => setIsEditingWeight(true)}
            style={styles.weightDisplay}
          >
            <Text variant="bodySmall" color={colors.text.primary} style={styles.weightValue}>
              {parseFloat(weight).toFixed(1)}
            </Text>
            <Text variant="caption" color={colors.text.secondary}>
              kg
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={incrementWeight}
          style={({ pressed }) => [
            styles.weightButton,
            pressed && styles.weightButtonPressed,
          ]}
        >
          <Text color={colors.accent.lime} style={styles.weightButtonText}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.secondary}10`,
    gap: spacing.md,
  },
  setCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: `${colors.accent.lime}40`,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent.lime}05`,
  },
  setCircleCompleted: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.accent.lime,
  },
  setCircleText: {
    fontWeight: '600',
    fontSize: 14,
  },
  repsSection: {
    alignItems: 'center',
    minWidth: 50,
  },
  repsValue: {
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  weightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.accent.lime}10`,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  weightButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.accent.lime}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightButtonPressed: {
    backgroundColor: `${colors.accent.lime}40`,
  },
  weightButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  weightDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  weightInput: {
    flex: 1,
    minHeight: 32,
    backgroundColor: colors.input.background,
    borderColor: colors.input.borderFocused,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
  },
  weightValue: {
    fontWeight: '600',
  },
});
