/**
 * StaleOverrideBanner — Warning banner for stale manual overrides.
 *
 * Shows when a manual override appears to reference a game-proximity intent
 * but the game context has changed. Offers guided actions:
 *   - Keep: dismiss the warning, keep the override as-is
 *   - Review: open a no-chat choice sheet
 *   - Clear: clear its exact accepted owner, when that owner is still clearable
 *
 * Used in both HomeScreen (inline on day rows) and DayWorkoutScreen (top banner).
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Text } from './common/Text';
import { Button, Sheet, SheetDescription, SheetHeader } from './ui';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { useProgramStore } from '../store/programStore';
import type { StaleOverrideWarning } from '../utils/staleOverrideDetector';
import { clearableOverrideAdjustment, clearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import { pendingUndoTarget } from '../store/undoLastDecision';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';

interface StaleOverrideBannerProps {
  warning: StaleOverrideWarning;
  /** Compact mode for inline use in day rows */
  compact?: boolean;
}

export function StaleOverrideBanner({ warning, compact = false }: StaleOverrideBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [clearing, setClearing] = useState(false);
  const adjustments = useProgramStore((s) => s.reversibleAdjustmentLedger.adjustments);
  useDecisionLedgerStore((s) => s.entries);
  const clearable = clearableOverrideAdjustment({ date: warning.date, workout: warning.workout,
    adjustments, latestDecision: pendingUndoTarget() });

  if (dismissed) return null;

  const handleKeep = () => {
    setReviewVisible(false);
    setDetailVisible(false);
    setDismissed(true);
  };

  const handleClear = async () => {
    if (!clearable || clearing) return;
    setClearing(true);
    try {
      const state = useProgramStore.getState();
      const current = state.dateOverrides[warning.date];
      const exact = current && clearableOverrideAdjustment({ date: warning.date, workout: current,
        adjustments: state.reversibleAdjustmentLedger.adjustments, latestDecision: pendingUndoTarget() });
      if (exact?.id !== clearable.id) {
        Alert.alert('Nothing changed', 'This session has changed since you opened it. Review it again.');
        return;
      }
      const result = await clearReversibleAdjustment(clearable.id, state.acceptedMaterialContext.revision);
      if (result.outcome !== 'restored' && result.outcome !== 'recomposed' && result.outcome !== 'already-cleared') {
        Alert.alert('Nothing changed', result.reason ?? 'Review this change in the weekly view.');
        return;
      }
      setReviewVisible(false);
      setDetailVisible(false);
      setDismissed(true);
    } catch {
      Alert.alert('Nothing changed', 'The change could not be cleared. Please try again.');
    } finally { setClearing(false); }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactDot} />
        <Text style={styles.compactText} numberOfLines={1}>
          Schedule changed - override may be stale
        </Text>
        {clearable && <Pressable onPress={handleClear} disabled={clearing} style={styles.compactAction}>
          <Text style={styles.compactActionText}>Clear</Text>
        </Pressable>}
        <Pressable onPress={handleKeep} style={styles.compactAction}>
          <Text style={styles.compactKeepText}>Keep</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
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

          {/*
            R5.7 — THE BETA COACH CUT. `Review` was gated on an `onReview`
            prop that existed ONLY to carry a coach prefill; with the coach
            entry cut, no caller passes it. The sheet it opens is NOT
            coach-dependent — its actions are Keep and Clear, both the
            athlete's — so the affordance becomes unconditional rather than
            being orphaned behind a prop nobody supplies. Gating it on the
            deleted prop would hide a working surface.
          */}
          <Pressable
            onPress={() => setReviewVisible(true)}
            style={({ pressed }) => [styles.actionButton, styles.reviewButton, pressed && styles.pressed]}
          >
            <Text style={styles.reviewButtonText}>Review</Text>
          </Pressable>

          {clearable && <Pressable
            onPress={handleClear}
            disabled={clearing}
            style={({ pressed }) => [styles.actionButton, styles.clearButton, pressed && styles.pressed]}
          >
            <Text style={styles.clearButtonText}>Clear Override</Text>
          </Pressable>}
        </View>
      </View>

      <Sheet
        visible={reviewVisible}
        onClose={() => setReviewVisible(false)}
        testID="stale-override-review-sheet"
      >
        <SheetHeader title="Program change" subtitle="Review this change" />
        <SheetDescription>
          This change may no longer match your current program.
        </SheetDescription>
        <Button label="Keep this change" variant="secondary" glow={false} onPress={handleKeep} />
        {clearable && <Button
          label="Clear this change"
          variant="danger"
          glow={false}
          onPress={handleClear}
          disabled={clearing}
          style={styles.sheetButton}
        />}
        <Button
          label="Update this change"
          variant="outline"
          glow={false}
          onPress={() => {
            setReviewVisible(false);
            setDetailVisible(true);
          }}
          style={styles.sheetButton}
        />
      </Sheet>

      <Sheet
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        testID="stale-override-detail-sheet"
      >
        <SheetHeader title="Program change" subtitle="More detail needed" />
        {/* PROPOSED COPY, UNSIGNED — R5.7. This sheet's only action was
            "Ask Coach". It now says what is true and closes rather than
            leaving the athlete somewhere with nothing to press. */}
        <SheetDescription>
          {clearable
            ? 'Keep this session or clear the accepted change from the options above.'
            : 'Use the weekly view to change this session. Nothing has changed here.'}
        </SheetDescription>
        <Button
          label="Close"
          variant="ghost"
          glow={false}
          onPress={() => setDetailVisible(false)}
          style={styles.sheetButton}
        />
      </Sheet>
    </>
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
  sheetTitle: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sheetBody: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  sheetButton: {
    marginTop: spacing.sm,
  },
});
