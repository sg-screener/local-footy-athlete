import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  KeyboardController,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { colors } from '../../theme/colors';
import { Text } from '../common/Text';

/**
 * The app's one keyboard dismiss affordance — a custom, flush "Done" bar.
 *
 * Numeric keypads have no return key, so on iOS there is no way off them from
 * the keyboard itself (dogfood finding E4). This bar gives every keyboard the
 * same exit, on both platforms, with no per-input wiring.
 *
 * ## Why not `KeyboardToolbar` (Sam ruling, L10 run 2 — NO float)
 * The library's `KeyboardToolbar` renders as a *floating rounded pill* on iOS 26+
 * (`KEYBOARD_HAS_ROUNDED_CORNERS`: side margins + a negative opened offset),
 * which reads on-device as a gap between the bar and the keypad. There is no prop
 * to defeat the float — it is keyed on `Platform.Version`. So the affordance is
 * hand-rolled here from the lower-level primitives:
 *
 * - `KeyboardStickyView offset={{ closed: 0, opened: 0 }}` rides the view to the
 *   keyboard's top edge with **zero** opened offset, so a full-width bar sits
 *   flush on the keypad with no gap, identically on every iOS version.
 * - `useKeyboardState(isVisible)` gates it: `KeyboardStickyView` parks its child
 *   at the screen bottom when the keyboard is closed, so we mount the bar only
 *   while the keyboard is up — it never shows at rest.
 * - `KeyboardController.dismiss()` closes the keyboard (same action the old
 *   toolbar's Done fired).
 *
 * Rendered exactly once per screen, by `KeyboardSafeArea`, and only on screens
 * that actually have a text input (the `hasTextInput` gate).
 *
 * NOTE (device verification, L10): flush positioning is native and cannot be
 * asserted in the source-contract tests — it needs a pass on Sam's phone.
 */
const DONE_BAR_HEIGHT = 44;

export const KeyboardDoneAccessory: React.FC = () => {
  const isVisible = useKeyboardState((state) => state.isVisible);
  if (!isVisible) return null;
  return (
    <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => KeyboardController.dismiss()}
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
          style={styles.donePressable}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </KeyboardStickyView>
  );
};

const styles = StyleSheet.create({
  // Full-width bar — no side margins, no rounded pill — so it meets the keypad
  // edge to edge. A hairline top border separates it from the field above.
  bar: {
    height: DONE_BAR_HEIGHT,
    width: '100%',
    backgroundColor: colors.surface.secondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  donePressable: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  doneText: {
    color: colors.accent.lime,
    fontSize: 16,
    fontWeight: '700',
  },
});
