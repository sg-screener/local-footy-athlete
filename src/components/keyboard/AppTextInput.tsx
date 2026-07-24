import React, { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

/**
 * The app's only text input.
 *
 * It is a deliberately thin wrapper: the keyboard *behaviour* lives in
 * `KeyboardSafeArea` (avoidance, scroll-into-view, dismiss) and the Done bar
 * attaches itself to whichever input has focus, so nothing has to be wired per
 * input. What this owns is the small set of submit defaults that were
 * previously copied — inconsistently — into every screen, which is how the name
 * screen ended up with a keypad tick and the height/weight screen without one
 * (dogfood finding E4).
 *
 * Keeping every input behind one component is also what makes the convention
 * enforceable: `keyboardConventionContractTests` fails the build if a raw
 * `TextInput` reappears anywhere outside this file.
 */

// Keypad keyboards have no return key. Asking for a `returnKeyType` on one makes
// iOS 26 float a rounded "Done" pill above the keypad — proven on the iOS 26.3
// sim: a bare number-pad shows no pill; the same field with `returnKeyType='done'`
// shows it (run-4 device finding). That float is the exact look `KeyboardDoneAccessory`
// was hand-rolled to avoid, so the submit-key default below is applied ONLY to
// keyboards that actually have a return key; keypad types default to none, and
// the pill never appears. A caller can still pass one explicitly.
const KEYLESS_KEYPAD_TYPES: ReadonlyArray<TextInputProps['keyboardType']> = [
  'number-pad',
  'numeric',
  'decimal-pad',
  'phone-pad',
];

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput(props, ref) {
    const isKeypad =
      props.keyboardType != null &&
      KEYLESS_KEYPAD_TYPES.includes(props.keyboardType);
    // A multiline field's return key inserts a newline, and a keypad has no
    // return key at all; every other single-line field gets a submit key so
    // there is always a way off the keyboard.
    const defaultReturnKeyType =
      props.multiline || isKeypad ? undefined : 'done';
    return (
      <TextInput
        returnKeyType={props.returnKeyType ?? defaultReturnKeyType}
        {...props}
        ref={ref}
      />
    );
  },
);
