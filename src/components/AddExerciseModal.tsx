import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';

interface AddExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (exercise: {
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
    notes: string;
  }) => void;
}

const POPULAR_EXERCISES = [
  'Bicep Curls',
  'Lateral Raise',
  'Tricep Pushdowns',
  'Seated Cable Row',
  'Calf Raises',
  'Ab Wheel',
  'Hanging Leg Raise',
  'Dips',
  'Pull-Ups',
  'Farmers Carry',
  'Hip Thrusts',
  'Incline DB Curls',
];

export default function AddExerciseModal({ visible, onClose, onAdd }: AddExerciseModalProps) {
  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    const parsedSets = parseInt(sets, 10) || 3;
    const parsedReps = parseInt(reps, 10) || 10;
    onAdd({
      name: name.trim(),
      sets: parsedSets,
      repsMin: parsedReps,
      repsMax: parsedReps,
      notes: notes.trim(),
    });
    // Reset
    setName('');
    setSets('3');
    setReps('10');
    setNotes('');
  };

  const handleQuickPick = (exerciseName: string) => {
    setName(exerciseName);
  };

  const canAdd = name.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text variant="h3" color={colors.text.primary} style={styles.title}>
              Add your favourite exercise
            </Text>
            <Text variant="bodySmall" color={colors.text.tertiary} style={styles.subtitle}>
              Your program, your rules. Chuck in whatever you want.
            </Text>

            {/* Quick picks */}
            <View style={styles.quickPicksWrap}>
              {POPULAR_EXERCISES.map((ex) => (
                <Pressable
                  key={ex}
                  style={[
                    styles.quickPickChip,
                    name === ex && styles.quickPickChipActive,
                  ]}
                  onPress={() => handleQuickPick(ex)}
                >
                  <Text
                    style={name === ex ? styles.quickPickTextActive : styles.quickPickText}
                  >
                    {ex}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Exercise name */}
            <Text variant="caption" color={colors.text.tertiary} style={styles.label}>
              EXERCISE NAME
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Bicep Curls, Dips, Calf Raises..."
              placeholderTextColor={colors.input.placeholder}
              autoCapitalize="words"
            />

            {/* Sets & Reps row */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text variant="caption" color={colors.text.tertiary} style={styles.label}>
                  SETS
                </Text>
                <TextInput
                  style={styles.input}
                  value={sets}
                  onChangeText={setSets}
                  placeholder="3"
                  placeholderTextColor={colors.input.placeholder}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.halfField}>
                <Text variant="caption" color={colors.text.tertiary} style={styles.label}>
                  REPS
                </Text>
                <TextInput
                  style={styles.input}
                  value={reps}
                  onChangeText={setReps}
                  placeholder="10"
                  placeholderTextColor={colors.input.placeholder}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Notes (optional) */}
            <Text variant="caption" color={colors.text.tertiary} style={styles.label}>
              NOTES (OPTIONAL)
            </Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Slow eccentric, drop set on last set..."
              placeholderTextColor={colors.input.placeholder}
              multiline
            />

            {/* Add button */}
            <Pressable
              style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
              onPress={handleAdd}
              disabled={!canAdd}
            >
              <Text style={canAdd ? styles.addButtonText : styles.addButtonTextDisabled}>
                Add to Workout
              </Text>
            </Pressable>

            {/* Spacer for keyboard */}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral.gray600,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  quickPicksWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.lg,
  },
  quickPickChip: {
    backgroundColor: colors.surface.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickPickChipActive: {
    borderColor: colors.accent.lime,
    backgroundColor: '#1A1E10',
  },
  quickPickText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  quickPickTextActive: {
    color: colors.accent.lime,
  },
  label: {
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.input.background,
    borderWidth: 1,
    borderColor: colors.input.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.input.text,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.accent.lime,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addButtonDisabled: {
    backgroundColor: colors.button.disabled,
  },
  addButtonText: {
    color: colors.button.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  addButtonTextDisabled: {
    color: colors.button.disabledText,
  },
});
