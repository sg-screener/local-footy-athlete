/**
 * THE TELLING — the athlete-facing half of the clean-reset door.
 *
 * Sam ordered the door and the sentence together: *"an unreadable stored world
 * resets and the athlete is told once, in plain words."* A reset with no telling
 * is the silent loss the old migration existed to prevent, arriving by a
 * different route — so the sentence is not decoration on the door, it is half of
 * it, and it ships in the same unit.
 *
 * ## Why it reads its own fact instead of taking a prop
 *
 * The reset happens at storage read ingress, before any React tree exists.
 * Threading it up through boot would mean a second representation of "was the
 * world reset" living in component state beside the stored fact — and two
 * representations of one truth is the defect this repo keeps paying for. The
 * component asks the door, and the door reads the fact.
 *
 * ## "Once" is derived, not counted
 *
 * There is no shown-counter. `athleteIsOwedTheResetNotice()` is
 * `fact !== null && fact.toldAtISO === null`, and the dismissal stamps
 * `toldAtISO`. A relaunch before dismissal shows it again, which is correct: the
 * athlete has still not been told.
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import { signedCopy } from '../rules/signedCopy';
import {
  WORLD_RESET_NOTICE_DISMISS_ID,
  WORLD_RESET_NOTICE_ID,
} from '../rules/unreadableWorldReset';
import {
  athleteIsOwedTheResetNotice,
  recordResetNoticeSeen,
} from '../store/unreadableWorldResetDoor';

export function WorldResetNotice(): React.ReactElement | null {
  const [owed, setOwed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void athleteIsOwedTheResetNotice().then((isOwed) => {
      if (mounted) setOwed(isOwed);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!owed) return null;

  const dismiss = () => {
    // Optimistic, deliberately. The athlete has read it; a storage write that
    // fails must not leave the sentence sitting on their screen forever.
    setOwed(false);
    void recordResetNoticeSeen(new Date().toISOString());
  };

  return (
    <View style={styles.container} testID="world-reset-notice">
      <Text style={styles.body}>{signedCopy(WORLD_RESET_NOTICE_ID)}</Text>
      <Pressable
        onPress={dismiss}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        testID="world-reset-notice-dismiss"
      >
        <Text style={styles.buttonText}>{signedCopy(WORLD_RESET_NOTICE_DISMISS_ID)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // ABSOLUTE, and that is a law not a preference: only `position: 'absolute'`
    // is layout-inert, so a notice that appears on one boot and not the next
    // cannot move the screen underneath it.
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.input.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  body: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.lime,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
  },
});
