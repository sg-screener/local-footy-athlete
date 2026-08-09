/**
 * UndoToast — the ONE screen-level undo affordance in this app.
 *
 * Ruled 2026-08-09 (`docs/UNDO_SURFACE_RULING_2026-08-09.md`): the standing bar
 * and the confirm sheet are dead — change-talk belongs to the coach tab — and
 * the transient toast is what survived, because it does not build a second
 * change-interface beside the coach.
 *
 * IT WATCHES THE LEDGER, NOT THE DOORS. Nothing calls this component to say a
 * change happened; it derives from the decision ledger, so every door that
 * lands a decision gets its toast by existing. See `rules/undoToast.ts` for why
 * that beats raising it at ten call sites.
 *
 * NO NEW CHROME ANYWHERE ELSE, per the order. This mounts once, on the Program
 * screen, positioned absolutely so it cannot participate in the layout it sits
 * over — `invisible instrumentation participates in layout` is a law this repo
 * has already paid for, and a toast is the shape most likely to repeat it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { undoLastDecision } from '../store/undoLastDecision';
import { undoToastFor, undoToastSeenMarker } from '../rules/undoToast';
import { UNDO_TOAST_COPY } from '../rules/undoToastCopy';

/** How long the toast stays before it withdraws itself. */
const VISIBLE_MS = 6000;

export function UndoToast(): React.ReactElement | null {
  const entries = useDecisionLedgerStore((state) => state.entries);
  const [seenEntryId, setSeenEntryId] = useState<string | null>(
    () => undoToastSeenMarker(entries),
  );
  const [busy, setBusy] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const model = undoToastFor(entries, seenEntryId);

  useEffect(() => {
    if (!model) return undefined;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => setSeenEntryId(model.entryId), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [model?.entryId]);

  if (!model) return null;

  const handleUndo = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await undoLastDecision();
    } finally {
      // MARKED SEEN FROM THE LEDGER AFTER THE UNDO, never from the entry we
      // just annulled: the marker is then the decision BEFORE it, so one tap
      // is one step and the toast does not immediately re-offer the change it
      // has just uncovered. Sam ruled one step.
      setSeenEntryId(undoToastSeenMarker(useDecisionLedgerStore.getState().entries));
      setBusy(false);
    }
  };

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]} pointerEvents="box-none">
      <View style={styles.toast}>
        <Text style={styles.sentence} numberOfLines={2}>
          {UNDO_TOAST_COPY.sentencePrefix} {model.sentence}
        </Text>
        <Pressable
          onPress={handleUndo}
          disabled={busy}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={UNDO_TOAST_COPY.undoAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>{UNDO_TOAST_COPY.undoAction}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // `position: absolute` is the ONLY layout-inert option — a toast that took
  // part in flow would push the week it sits over.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card.background,
    borderColor: colors.card.border,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sentence: { flex: 1, color: colors.text.secondary },
  action: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  actionPressed: { opacity: 0.6 },
  actionLabel: { color: colors.accent.lime, fontWeight: '700' },
});
