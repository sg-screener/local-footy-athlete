import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import LinearGradient from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions, shadows } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { SessionTierBadge } from '../../components/common/SessionTierBadge';
import type { Workout } from '../../types/domain';
import { splitSessionName as splitWorkoutName } from '../../utils/sessionNaming';
import { getConditioningContextLabel } from './homeScreenConstants';
import { getTeamTrainingWorkoutState } from '../../utils/teamTraining';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';
import { weeklyPlanTitle } from '../../utils/weeklyPlanDisplay';

interface TodayWorkoutCardProps {
  workout: Workout;
  onStart: () => void;
  previousPerformance?: {
    duration: number;
    maxWeight: number;
  };
}

export const TodayWorkoutCard = ({
  workout,
  onStart,
  previousPerformance,
}: TodayWorkoutCardProps) => {
  const teamState = getTeamTrainingWorkoutState(workout);
  const exerciseCount = teamState.renderableExercises.length;
  const displayExercises = teamState.renderableExercises.slice(0, 4);
  const moreExercises = Math.max(0, exerciseCount - 4);
  const conditioningContext = getConditioningContextLabel(workout);

  // Calculate estimated volume
  const estimatedDuration = workout.durationMinutes || 45;

  const getIntensityColor = () => {
    switch (workout.intensity) {
      case 'Light':
        return colors.intensity.light;
      case 'Moderate':
        return colors.intensity.moderate;
      case 'High':
        return colors.intensity.high;
      case 'Maximal':
        return colors.intensity.maximal;
      default:
        return colors.accent.lime;
    }
  };

  const getWorkoutTypeColor = () => {
    switch (workout.workoutType) {
      case 'Strength':
        return colors.status.info;
      case 'Conditioning':
        return colors.intensity.moderate;
      case 'Technical':
        return colors.accent.lime;
      case 'Recovery':
        return colors.accent.lime;
      case 'Mixed':
        return colors.status.warning;
      default:
        return colors.accent.lime;
    }
  };

  return (
    <LinearGradient
      colors={[colors.surface.secondary, `${colors.surface.secondary}dd`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, shadows.md]}
    >
      <View style={styles.content}>
        {/* Header with badges */}
        <View style={styles.header}>
          <View style={styles.badgesContainer}>
            {workout.sessionTier && (
              <SessionTierBadge tier={workout.sessionTier} />
            )}
            <Badge
              label={workout.workoutType}
              color={getWorkoutTypeColor()}
              size="sm"
            />
            {conditioningContext && (
              <Badge
                label={`${workout.hasCombinedConditioning || workout.conditioningBlock?.attachedKind ? '+ ' : ''}${conditioningContext}`}
                color={colors.intensity.moderate}
                size="sm"
              />
            )}
            <Badge
              label={workout.intensity}
              color={getIntensityColor()}
              size="sm"
            />
          </View>
        </View>

        {/* Workout title */}
        <Text variant="h3" style={styles.title}>
          {weeklyPlanTitle(workout)}
        </Text>
        {splitWorkoutName(workout.name).context && (
          <Text style={styles.titleContext}>
            {splitWorkoutName(workout.name).context}
          </Text>
        )}

        {/* Workout description */}
        {workout.description && (
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            style={styles.description}
          >
            {workout.description}
          </Text>
        )}

        {/* Exercise list */}
        {exerciseCount > 0 ? (
          <View style={styles.exercisesSection}>
            <Text variant="labelSmall" color={colors.text.secondary} style={styles.exerciseLabel}>
              EXERCISES ({exerciseCount})
            </Text>
            <View style={styles.exercisesList}>
              {displayExercises.map((exercise, index) => (
                <View key={index} style={styles.exerciseItem}>
                  <View style={styles.exerciseBullet} />
                  <View style={styles.exerciseInfo}>
                    <Text variant="bodySmall" color={colors.text.primary}>
                      {formatExerciseDisplayName(exercise.exercise?.name) || `Exercise ${index + 1}`}
                    </Text>
                    <Text variant="caption" color={colors.text.tertiary}>
                      {exercise.prescribedSets}x {exercise.prescribedRepsMin}-{exercise.prescribedRepsMax}
                      {exercise.prescribedWeightKg && ` @ ${exercise.prescribedWeightKg}kg`}
                    </Text>
                  </View>
                </View>
              ))}
              {moreExercises > 0 && (
                <View style={styles.moreExercises}>
                  <View style={styles.exerciseBullet} />
                  <Text variant="bodySmall" color={colors.accent.lime}>
                    and {moreExercises} more...
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Duration info */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text variant="caption" color={colors.text.secondary}>
              Estimated Duration
            </Text>
            <Text variant="h4" color={colors.accent.lime}>
              {estimatedDuration} min
            </Text>
          </View>
          {previousPerformance && (
            <View style={styles.infoItem}>
              <Text variant="caption" color={colors.text.secondary}>
                Previous Best
              </Text>
              <Text variant="bodySmall" color={colors.status.successLight}>
                {previousPerformance.duration} min
              </Text>
            </View>
          )}
        </View>

        {/* Start button */}
        <Button
          title="Start Workout"
          onPress={onStart}
          variant="primary"
          size="lg"
          fullWidth
          style={styles.startButton}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    color: colors.accent.lime,
    marginBottom: 2,
  },
  titleContext: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
    marginBottom: spacing.md,
  },
  description: {
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  exercisesSection: {
    marginBottom: spacing.lg,
  },
  exerciseLabel: {
    marginBottom: spacing.sm,
    opacity: 0.8,
  },
  exercisesList: {
    gap: spacing.sm,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  exerciseBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.lime,
    marginTop: spacing.sm,
    flexShrink: 0,
  },
  exerciseInfo: {
    flex: 1,
  },
  moreExercises: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${colors.accent.lime}30`,
  },
  infoItem: {
    flex: 1,
  },
  startButton: {
    marginTop: spacing.md,
  },
});
