import React from 'react';
import { KeyboardToolbar } from 'react-native-keyboard-controller';
import { colors } from '../../theme/colors';

/**
 * The app's one keyboard dismiss affordance.
 *
 * Numeric keypads have no return key, so on iOS there is no way off them from
 * the keyboard itself — dogfood finding E4, where the name screen accepted the
 * keypad tick but height/weight required tapping blank space before Continue
 * was reachable. This bar gives every keyboard the same exit, on both
 * platforms, with no per-input wiring: the toolbar attaches itself to whichever
 * input has focus.
 *
 * Rendered exactly once per screen, by `KeyboardSafeArea`. It rides *above* the
 * keypad rather than over the content, which is the other half of E7 (the Done
 * overlay covering the weight field).
 */
export const KeyboardDoneAccessory: React.FC = () => (
  <KeyboardToolbar
    showArrows={false}
    doneText="Done"
    content={null}
    theme={{
      dark: {
        primary: colors.accent.lime,
        disabled: colors.text.disabled,
        background: colors.surface.secondary,
        ripple: 'rgba(255,255,255,0.08)',
      },
      light: {
        primary: colors.accent.lime,
        disabled: colors.text.disabled,
        background: colors.surface.secondary,
        ripple: 'rgba(0,0,0,0.08)',
      },
    }}
  />
);
