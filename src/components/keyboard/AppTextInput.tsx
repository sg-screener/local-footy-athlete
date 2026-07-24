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
export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput(props, ref) {
    return (
      <TextInput
        // A multiline field's return key inserts a newline; single-line fields
        // get a submit key so there is always a way off the keyboard.
        returnKeyType={props.returnKeyType ?? (props.multiline ? undefined : 'done')}
        {...props}
        ref={ref}
      />
    );
  },
);
