import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import type { Workout } from '../../types/domain';
import { splitSessionName } from '../../utils/sessionNaming';
import { getConditioningContextLabel } from './homeScreenConstants';
import { weeklyPlanTitle } from '../../utils/weeklyPlanDisplay';

import { format } from 'date-fns';

/**
 * Derive a short, glanceable label for the weekly view.
 *
 * Session names reaching the UI are already canonical short labels
 * (produced by resolveSessionDisplayName in the builder). For team-day
 * composite names like "Team Training + Upper Push" we show the context
 * half ("Upper Push") because the TEAM badge already conveys team-day
 * status. For everything else we pass the canonical name through.
 */
function getShortLabel(workout: Workout): string {
  const projected = weeklyPlanTitle(workout);
  if (projected) return projected;
  const name = (workout.name || '').trim();
  if (!name) return workout.workoutType || 'Workout';
  const { title, context } = splitSessionName(name);
  // "Team Training + X" → prefer X (team badge already shows TEAM).
  // "Team Training" alone → keep full label.
  if (/^team training$/i.test(title) && context) return context;
  return title;
}

interface WeekDay {
  day: Date;
  dayOfWeek: number;
  workout: Workout | undefined;
  isToday: boolean;
}

interface WeekViewCardProps {
  weekWorkouts: WeekDay[];
  onDayPress: (workout: Workout | undefined) => void;
}

export const WeekViewCard = ({ weekWorkouts, onDayPress }: WeekViewCardProps) => {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      scrollEventThrottle={16}
    >
      {weekWorkouts.map((day, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [
            styles.dayCard,
            day.isToday && styles.todayCard,
            pressed && styles.dayCardPressed,
          ]}
          onPress={() => onDayPress(day.workout)}
        >
          {/* Day label */}
          <Text
            variant="labelSmall"
            color={day.isToday ? colors.button.primaryText : colors.text.secondary}
            style={styles.dayLabel}
          >
            {dayLabels[day.dayOfWeek]}
          </Text>

          {/* Workout indicator or rest */}
          {day.workout ? (
            <View style={styles.workoutContent}>
              <Text
                variant="caption"
                color={day.isToday ? colors.button.primaryText : colors.accent.lime}
                style={styles.workoutType}
                numberOfLines={2}
              >
                {getShortLabel(day.workout)}
              </Text>
              {/* Combined S+C: show conditioning flavour as paired secondary line */}
              {(() => {
                const conditioningContext = getConditioningContextLabel(day.workout);
                if (!conditioningContext) return null;
                return (
                  <View style={[
                    styles.combinedBadge,
                    day.isToday && styles.combinedBadgeToday,
                  ]}>
                    <Text
                      variant="caption"
                      color={day.isToday ? colors.button.primaryText : colors.accent.lime}
                      style={styles.conditioningLabel}
                      numberOfLines={1}
                    >
                      {day.workout.hasCombinedConditioning || day.workout.conditioningBlock?.attachedKind ? '+ ' : ''}{conditioningContext}
                    </Text>
                  </View>
                );
              })()}
              {/* Optional badge */}
              {day.workout.sessionTier === 'optional' ? (
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalBadgeText}>Optional</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text
              variant="caption"
              color={colors.text.tertiary}
              style={styles.restText}
            >
              Rest
            </Text>
          )}

          {/* Checkmark for completed (placeholder) */}
          {false && (
            <View style={styles.checkmark}>
              <Text color={colors.accent.lime} style={styles.checkmarkText}>
                ✓
              </Text>
            </View>
          )}

          {/* Today indicator */}
          {day.isToday && (
            <View style={styles.todayIndicator} />
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -spacing.sm,
  },
  contentContainer: {
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  dayCard: {
    width: 90,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  dayCardPressed: {
    opacity: 0.8,
    backgroundColor: `${colors.accent.lime}15`,
  },
  todayCard: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.accent.lime,
  },
  dayLabel: {
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
  },
  workoutContent: {
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  workoutType: {
    textAlign: 'center',
    fontWeight: '600',
  },
  combinedBadge: {
    backgroundColor: `${colors.accent.lime}20`,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: -2,
  },
  combinedBadgeToday: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  conditioningLabel: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  optionalBadge: {
    backgroundColor: `${colors.text.tertiary}20`,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  optionalBadgeText: {
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  restText: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  checkmark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  todayIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.button.primaryText,
  },
});
