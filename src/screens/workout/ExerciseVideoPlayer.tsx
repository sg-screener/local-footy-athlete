import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import type { Exercise } from '../../types/domain';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';

interface ExerciseVideoPlayerProps {
  exercise: Exercise;
  onClose: () => void;
}

export const ExerciseVideoPlayer = ({ exercise, onClose }: ExerciseVideoPlayerProps) => {
  const [gifLoading, setGifLoading] = useState(true);
  const [gifError, setGifError] = useState(false);

  const hasGif = !!exercise.gifUrl;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text color={colors.text.primary} style={styles.closeIcon}>
              ✕
            </Text>
          </Pressable>
          <Text variant="h4" style={styles.modalTitle}>
            Exercise Guide
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
          {/* GIF / Video area */}
          {hasGif && !gifError ? (
            <View style={styles.gifContainer}>
              {gifLoading && (
                <View style={styles.gifLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.accent.lime} />
                  <Text variant="caption" color={colors.text.tertiary} style={styles.loadingText}>
                    Loading demo...
                  </Text>
                </View>
              )}
              <Image
                source={{ uri: exercise.gifUrl }}
                style={styles.gifImage}
                resizeMode="contain"
                onLoadStart={() => setGifLoading(true)}
                onLoadEnd={() => setGifLoading(false)}
                onError={() => {
                  setGifError(true);
                  setGifLoading(false);
                }}
              />
            </View>
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text color={colors.text.secondary} style={styles.videoPlaceholderIcon}>
                🏋️
              </Text>
              <Text
                variant="caption"
                color={colors.text.tertiary}
                style={styles.videoNote}
              >
                {gifError
                  ? 'GIF failed to load'
                  : 'Exercise demo coming soon'}
              </Text>
            </View>
          )}

          {/* Exercise info card */}
          <Card style={styles.infoCard}>
            <View style={styles.infoContent}>
              <Text variant="h3" style={styles.exerciseName}>
                {formatExerciseDisplayName(exercise.name) || exercise.name}
              </Text>

              {/* Type and difficulty */}
              <View style={styles.metaSection}>
                <View style={styles.metaItem}>
                  <Text variant="caption" color={colors.text.secondary}>
                    Type
                  </Text>
                  <Text variant="body" color={colors.accent.lime}>
                    {exercise.exerciseType}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text variant="caption" color={colors.text.secondary}>
                    Difficulty
                  </Text>
                  <Text
                    variant="body"
                    color={getDifficultyColor(exercise.difficultyLevel)}
                  >
                    {exercise.difficultyLevel}
                  </Text>
                </View>
              </View>

              {/* Muscle groups */}
              {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
                <View style={styles.section}>
                  <Text variant="labelSmall" color={colors.text.secondary}>
                    MUSCLE GROUPS
                  </Text>
                  <View style={styles.muscleGroupsList}>
                    {exercise.muscleGroups.map((muscle, index) => (
                      <View key={index} style={styles.muscleBadge}>
                        <Text variant="caption" color={colors.button.primaryText}>
                          {muscle}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Equipment required */}
              {exercise.equipmentRequired && exercise.equipmentRequired.length > 0 && (
                <View style={styles.section}>
                  <Text variant="labelSmall" color={colors.text.secondary}>
                    EQUIPMENT
                  </Text>
                  <View style={styles.equipmentList}>
                    {exercise.equipmentRequired.map((equipment, index) => (
                      <View key={index} style={styles.equipmentItem}>
                        <View style={styles.equipmentBullet} />
                        <Text variant="body" color={colors.text.primary}>
                          {equipment}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Description */}
              {exercise.description && (
                <View style={styles.section}>
                  <Text variant="labelSmall" color={colors.text.secondary}>
                    HOW TO
                  </Text>
                  <Text variant="body" color={colors.text.primary} style={styles.description}>
                    {exercise.description}
                  </Text>
                </View>
              )}

              {/* Form notes */}
              {exercise.formNotes && (
                <View style={styles.section}>
                  <Text variant="labelSmall" color={colors.text.secondary}>
                    FORM TIPS
                  </Text>
                  <Text variant="body" color={colors.text.primary} style={styles.formNotes}>
                    {exercise.formNotes}
                  </Text>
                </View>
              )}

              {/* Tips section */}
              <View style={styles.tipsSection}>
                <Text variant="labelSmall" color={colors.text.secondary}>
                  PRO TIPS
                </Text>
                <View style={styles.tipsList}>
                  <View style={styles.tipItem}>
                    <Text color={colors.accent.lime} style={styles.tipBullet}>
                      •
                    </Text>
                    <Text variant="body" color={colors.text.primary} style={styles.tipText}>
                      Focus on mind-muscle connection
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text color={colors.accent.lime} style={styles.tipBullet}>
                      •
                    </Text>
                    <Text variant="body" color={colors.text.primary} style={styles.tipText}>
                      Control the eccentric (lowering) phase
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text color={colors.accent.lime} style={styles.tipBullet}>
                      •
                    </Text>
                    <Text variant="body" color={colors.text.primary} style={styles.tipText}>
                      Keep your core engaged throughout
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
};

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'Beginner':
      return colors.status.successLight;
    case 'Intermediate':
      return colors.secondary.main;
    case 'Advanced':
      return colors.secondary.dark;
    case 'Expert':
      return colors.status.error;
    default:
      return colors.text.primary;
  }
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.secondary}20`,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: `${colors.secondary.main}20`,
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalTitle: {
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  // GIF display
  gifContainer: {
    height: 300,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${colors.accent.lime}30`,
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  gifLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.secondary,
    zIndex: 1,
  },
  loadingText: {
    marginTop: spacing.sm,
  },

  // Fallback placeholder
  videoPlaceholder: {
    height: 200,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.accent.lime}30`,
  },
  videoPlaceholderIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  videoNote: {
    textAlign: 'center',
  },

  // Info card
  infoCard: {
    marginBottom: spacing.xl,
  },
  infoContent: {
    padding: spacing.lg,
  },
  exerciseName: {
    color: colors.accent.lime,
    marginBottom: spacing.lg,
  },
  metaSection: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.text.secondary}20`,
  },
  metaItem: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
  },
  muscleGroupsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  muscleBadge: {
    backgroundColor: colors.accent.lime,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  equipmentList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  equipmentBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.lime,
  },
  description: {
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  formNotes: {
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  tipsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: `${colors.text.secondary}20`,
  },
  tipsList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  tipItem: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tipBullet: {
    fontSize: 16,
    lineHeight: 24,
  },
  tipText: {
    flex: 1,
    lineHeight: 24,
  },
});
