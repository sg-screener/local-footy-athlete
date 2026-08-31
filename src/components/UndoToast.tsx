/**
 * UndoToast — the ONE undo affordance in this app, ON WHICHEVER SURFACE THE
 * ATHLETE ACTED.
 *
 * Ruled 2026-08-09 (`docs/UNDO_SURFACE_RULING_2026-08-09.md`): the standing bar
 * and the confirm sheet are dead — change-talk belongs to the coach tab — and
 * the transient toast is what survived, because it does not build a second
 * change-interface beside the coach. **That reasoning is untouched.**
 *
 * ## R-107 AMENDED THE "ONE MOUNT" CLAUSE, AND ONLY THAT CLAUSE (2026-08-20)
 *
 * Sam: *"Keep the athlete on the current screen. Undo must appear on whichever
 * screen initiated the change, including inside the active session. Do not send
 * them back to the Day page."*
 *
 * This header used to read *"This mounts once, on the Program screen"*. That
 * held while every change the athlete could make was ON the Program screen.
 * Once the five labelled changes moved into the session screen, a one-mount
 * toast meant **every session-screen change raised its Undo on the screen
 * BEHIND it**, where its six-second life expired unseen. The Day-screen Remove
 * chip had been hiding that, and Sam's Day/Session contract removed that chip.
 *
 * ⚠ **IT IS STILL ONE TOAST.** One component, one copy, one ledger read, one
 * step. The rejected alternative was navigating the athlete back to the Day
 * page after a session change so the single mount could be reached — Sam
 * refused it outright: a change made inside a session must not eject the
 * athlete from that session.
 *
 * ## AT MOST ONE IS EVER VISIBLE, AND THE COMPONENT GUARANTEES IT ITSELF
 *
 * **The guard is HERE, not at the call sites.** A rule that each screen has to
 * remember to apply is a rule one screen will forget; a mount that renders
 * nothing unless its own screen is focused cannot be mounted wrongly. So a
 * third surface can mount it tomorrow with no new reasoning.
 *
 * ⚠ **AN UNFOCUSED MOUNT DOES NOT MERELY GO QUIET — IT KEEPS UP WITH THE
 * LEDGER.** Each mount carries its own "already seen" marker. Without this, a
 * removal made on the pushed session screen would show its toast there AND
 * again on the Day screen the moment the athlete went back, because the Day
 * mount's marker still predated it. **One action, one toast, once.**
 *
 * IT WATCHES THE LEDGER, NOT THE DOORS. Nothing calls this component to say a
 * change happened; it derives from the decision ledger, so every door that
 * lands a decision gets its toast by existing. See `rules/undoToast.ts` for why
 * that beats raising it at ten call sites.
 *
 * NO NEW CHROME ANYWHERE ELSE, per the order. Positioned absolutely so it
 * cannot participate in the layout it sits over — `invisible instrumentation
 * participates in layout` is a law this repo has already paid for, and a toast
 * is the shape most likely to repeat it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { undoLastDecision } from '../store/undoLastDecision';
import { undoToastFor, undoToastSeenMarker } from '../rules/undoToast';
import { UNDO_TOAST_COPY } from '../rules/undoToastCopy';

/** How long the toast stays before it withdraws itself. */
const VISIBLE_MS = 6000;

interface UndoToastProps {
  /**
   * Optional clearance for a sticky action owned by the current surface.
   * The toast remains an overlay; the surface only tells it where the free
   * bottom edge begins so both actions stay visible and tappable.
   */
  bottomOffset?: number;
}

export function UndoToast({ bottomOffset }: UndoToastProps = {}): React.ReactElement | null {
  const entries = useDecisionLedgerStore((state) => state.entries);
  const isFocused = useIsFocused();
  const [seenEntryId, setSeenEntryId] = useState<string | null>(
    () => undoToastSeenMarker(entries),
  );
  const [busy, setBusy] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const model = undoToastFor(entries, seenEntryId);

  /**
   * NOT THE SURFACE THE ATHLETE IS ON: STAY SILENT, AND STAY CURRENT.
   *
   * Staying silent alone is the bug. This mount's marker would still predate a
   * decision another surface already announced, so returning here would replay
   * that surface's toast — the athlete undoing a change they were told about
   * two screens ago. Advancing the marker while unfocused is what makes "one
   * action, one toast, once" true across a push and a pop.
   */
  useEffect(() => {
    if (isFocused) return;
    setSeenEntryId(undoToastSeenMarker(entries));
  }, [isFocused, entries]);

  useEffect(() => {
    if (!model || !isFocused) return undefined;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => setSeenEntryId(model.entryId), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [model?.entryId, isFocused]);

  if (!model || !isFocused) return null;

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
    <Animated.View
      style={[
        styles.wrap,
        bottomOffset !== undefined ? { bottom: bottomOffset } : null,
        { opacity: fade },
      ]}
      pointerEvents="box-none"
    >
      {/* ADDRESSABLE, because a flow has to be able to prove this appeared on
          the surface the athlete acted on. The accessibility label stays the
          athlete's word ("Undo"); these ids are for the walk. */}
      <View style={styles.toast} testID="undo-toast">
        <Text style={styles.sentence} numberOfLines={2}>
          {UNDO_TOAST_COPY.sentencePrefix} {model.sentence}
        </Text>
        <Pressable
          onPress={handleUndo}
          disabled={busy}
          hitSlop={12}
          accessibilityRole="button"
          testID="undo-toast-action"
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
    // The board's Save bar is layer 20; Undo must remain visible and tappable
    // above it on the same surface (R-107), not merely in accessibility state.
    zIndex: 30,
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
