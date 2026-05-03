/**
 * StaleOverrideBanner — Warning banner for stale manual overrides.
 *
 * Shows when a manual override appears to reference a game-proximity intent
 * but the game context has changed. Offers three actions:
 *   - Keep: dismiss the warning, keep the override as-is
 *   - Review: navigate to coach chat to discuss the override
 *   - Clear: remove the override entirely, let the resolver take over
 *
 * Used in both HomeScreen (inline on day rows) and DayWorkoutScreen (top banner).
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { useProgramStore } from '../store/programStore';
import type { StaleOverrideWarning } from '../utils/staleOverrideDetector';

interface StaleOverrideBannerProps {
  warning: StaleOverrideWarning;
  /** Compact mode for inline use in day rows */
  compact?: boolean;
  /** Called when user taps "Review" — navigate to coach chat with pre-filled context */
  onReview?: (prefill: string) => void;
}

export function StaleOverrideBanner({ warning, compact = false, onReview }: StaleOverrideBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const removeManualOverride = useProgramStore((s) => s.removeManualOverride);
  const dismissStaleWarning = useProgramStore((s) => s.dismissStaleWarning);

  if (dismissed) return null;

  const handleKeep = () => {
    dismissStaleWarning(warning.date);
    setDismissed(true);
  };

  const handleClear = () => {
    removeManualOverride(warning.date);
    setDismissed(true);
  };

  const handleReview = () => {
    const prefill = `I have a manual override on ${warning.date} ("${warning.workout.name}") that might need updating. ${warning.reason} What should I do — keep it, change it, or clear it?`;
    onReview?.(prefill);
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactDot} />
        <Text style={styles.compactText} numberOfLines={1}>
          Schedule changed — override may be stale
        </Text>
        <Pressable onPress={handleClear} style={styles.compactAction}>
          <Text style={styles.compactActionText}>Clear</Text>
        </Pressable>
        <Pressable onPress={handleKeep} style={styles.compactAction}>
          <Text style={styles.compactKeepText}>Keep</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.warningDot} />
        <Text style={styles.headerText}>Override may be outdated</Text>
      </View>

      <Text style={styles.reasonText}>{warning.reason}</Text>

      <View style={styles.actions}>
        <Pressable
          onPress={handleKeep}
          style={({ pressed }) => [styles.actionButton, styles.keepButton, pressed && styles.pressed]}
        >
          <Text style={styles.keepButtonText}>Keep</Text>
        </Pressable>

        {onReview && (
          <Pressable
            onPress={handleReview}
            style={({ pressed }) => [styles.actionButton, styles.reviewButton, pressed && styles.pressed]}
          >
            <Text style={styles.reviewButtonText}>Review</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleClear}
          style={({ pressed }) => [styles.actionButton, styles.clearButton, pressed && styles.pressed]}
        >
          <Text style={styles.clearButtonText}>Clear Override</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Full banner ───
  container: {
    backgroundColor: 'rgba(255, 193, 7, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.warning,
  },
  headerText: {
    color: colors.status.warning,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  reasonText: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  keepButton: {
    backgroundColor: 'transparent',
    borderColor: '#444444',
  },
  keepButtonText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: 'transparent',
    borderColor: colors.status.warning,
  },
  reviewButtonText: {
    color: colors.status.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderColor: colors.status.warning,
  },
  clearButtonText: {
    color: colors.status.warning,
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── Compact inline ───
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 193, 7, 0.06)',
    borderRadius: 6,
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.warning,
  },
  compactText: {
    color: colors.status.warning,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  compactAction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  compactActionText: {
    color: colors.status.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  compactKeepText: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '600',
  },
});
