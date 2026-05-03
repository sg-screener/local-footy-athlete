import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import type { SessionFeeling } from '../../types/domain';

interface CompletionSummaryProps {
  duration: number;
  exercisesCompleted: number;
  onSave: (summary: { feeling: SessionFeeling; notes: string }) => void;
  onCancel: () => void;
}

export const CompletionSummary = ({
  duration,
  exercisesCompleted,
  onSave,
  onCancel,
}: CompletionSummaryProps) => {
  const [feeling, setFeeling] = useState<SessionFeeling>('Good');
  const [notes, setNotes] = useState('');

  const feelings: SessionFeeling[] = ['Cooked', 'Strong', 'Good', 'Average', 'Sore'];

  const handleFeelingPress = (value: SessionFeeling) => {
    Haptics.selectionAsync();
    setFeeling(value);
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ feeling, notes });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  const difficultyLabels: Record<number, string> = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Moderate',
    4: 'Hard',
    5: 'Very Hard',
    6: 'Extreme',
    7: 'Maximal',
    8: 'Beyond Max',
    9: 'Heroic',
    10: 'Impossible',
  };

  return (
    <Modal visible={true} transparent={true} animationType="slide">
      <View style={styles.container}>
        {/* Success header */}
        <View style={styles.successHeader}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text variant="h2" style={styles.successTitle}>
            Session Complete
          </Text>
          <Text variant="body" color={colors.text.secondary} style={styles.successSubtitle}>
            Session done, legend. Get some rest.
          </Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
          {/* Summary stats */}
          <Card style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <View style={styles.statColumn}>
                <Text variant="caption" color={colors.text.secondary}>
                  Duration
                </Text>
                <Text variant="h3" color={colors.accent.lime} style={styles.statValue}>
                  {formatTime(duration)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statColumn}>
                <Text variant="caption" color={colors.text.secondary}>
                  Exercises
                </Text>
                <Text variant="h3" color={colors.accent.lime} style={styles.statValue}>
                  {exercisesCompleted}
                </Text>
              </View>
            </View>
          </Card>

          {/* Feeling selector */}
          <Card style={styles.feelingCard}>
            <View style={styles.feelingContent}>
              <Text variant="h4" color={colors.text.primary} style={styles.feelingTitle}>
                How'd you feel?
              </Text>

              {/* Feeling buttons */}
              <View style={styles.feelingButtons}>
                {feelings.map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => handleFeelingPress(f)}
                    style={[
                      styles.feelingButton,
                      feeling === f && styles.feelingButtonActive,
                      feeling === f && { backgroundColor: getFeelingColor(f) },
                    ]}
                  >
                    <Text
                      variant="bodySmall"
                      color={
                        feeling === f
                          ? colors.button.primaryText
                          : colors.text.secondary
                      }
                      style={styles.feelingButtonText}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>

          {/* Notes input */}
          <Card style={styles.notesCard}>
            <View style={styles.notesContent}>
              <Text variant="h4" color={colors.text.primary} style={styles.notesTitle}>
                Notes (Optional)
              </Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Any observations or notes?"
                placeholderTextColor={colors.text.tertiary}
                multiline={true}
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />
              <Text variant="caption" color={colors.text.tertiary} style={styles.charCount}>
                {notes.length} / 500
              </Text>
            </View>
          </Card>
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.footer}>
          <Button
            title="Keep Going"
            onPress={onCancel}
            variant="outline"
            fullWidth
            style={styles.cancelButton}
          />
          <Button
            title="Save & Close"
            onPress={handleSave}
            variant="primary"
            fullWidth
            style={styles.saveButton}
          />
        </View>
      </View>
    </Modal>
  );
};

function getFeelingColor(feeling: SessionFeeling): string {
  switch (feeling) {
    case 'Cooked':
      return colors.feeling.cooked;
    case 'Strong':
      return colors.feeling.strong;
    case 'Good':
      return colors.feeling.good;
    case 'Average':
      return colors.feeling.average;
    case 'Sore':
      return colors.feeling.sore;
    default:
      return colors.accent.lime;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  successHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: `${colors.accent.lime}20`,
  },
  successEmoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  successTitle: {
    color: colors.accent.lime,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  statsCard: {
    padding: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: `${colors.text.secondary}20`,
  },
  statValue: {
    marginTop: spacing.sm,
  },
  feelingCard: {
    padding: spacing.lg,
  },
  feelingContent: {
    gap: spacing.md,
  },
  feelingTitle: {
    marginBottom: spacing.sm,
  },
  feelingButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  feelingButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.text.secondary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${colors.text.secondary}20`,
  },
  feelingButtonActive: {
    borderColor: 'transparent',
  },
  feelingButtonText: {
    fontWeight: '600',
  },
  notesCard: {
    padding: spacing.lg,
  },
  notesContent: {
    gap: spacing.md,
  },
  notesTitle: {
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.input.background,
    borderColor: colors.input.border,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    minHeight: 100,
    fontSize: typography.body.fontSize,
  },
  charCount: {
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: `${colors.text.secondary}20`,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
