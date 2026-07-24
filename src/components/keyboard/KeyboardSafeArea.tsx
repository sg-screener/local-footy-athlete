import React from 'react';
import {
  Keyboard,
  Pressable,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';
import { KeyboardDoneAccessory } from './KeyboardDoneAccessory';

/**
 * Room left under the focused input so it clears the keypad *and* the Done bar
 * above it. This number is the fix for E7 — the weight field sitting behind the
 * "Done" overlay while the athlete typed into it.
 */
const FOCUSED_INPUT_BOTTOM_OFFSET = 64;

interface KeyboardSafeAreaProps {
  children: React.ReactNode;
  /**
   * Content pinned below the scroll area and *inside* the avoided region —
   * the Continue CTA belongs here. Dogfood finding E3 was the CTA sitting
   * outside the avoided region, so the keypad covered it.
   */
  footer?: React.ReactNode;
  /** Render children in a keyboard-aware scroll view (the usual case). */
  scrollable?: boolean;
  scrollProps?: Pick<
    ScrollViewProps,
    'contentContainerStyle' | 'showsVerticalScrollIndicator'
  >;
  style?: StyleProp<ViewStyle>;
  /** Tap outside an input to dismiss. Off for screens whose body is a list. */
  dismissOnBackgroundTap?: boolean;
}

/**
 * The app's one keyboard-avoidance owner.
 *
 * Dogfood findings E3, E4 and E7 were a single bug wearing three hats:
 * keyboard handling was decided per screen, so every screen got a different
 * (and differently broken) answer. Everything the keyboard touches is now
 * decided here, once:
 *
 * - **Avoidance** — one `KeyboardAvoidingView` wrapping content *and* footer,
 *   so the CTA rides above the keypad instead of under it (E3).
 * - **Taps stay live** — `keyboardShouldPersistTaps="handled"`, so Continue is
 *   reachable on the first tap rather than needing a blank-space tap first (E4).
 * - **The focused field stays visible** — `KeyboardAwareScrollView` scrolls it
 *   clear of the keypad, with `bottomOffset` covering the Done bar too (E7).
 * - **Dismissal** — background tap here, plus the shared Done toolbar, which
 *   this component renders exactly once per screen.
 *
 * Built on `react-native-keyboard-controller`, whose `KeyboardProvider` is
 * already mounted in App.tsx: it tracks the keyboard frame natively on both
 * platforms rather than guessing, which is what RN's own `KeyboardAvoidingView`
 * could never do reliably on Android.
 */
export const KeyboardSafeArea: React.FC<KeyboardSafeAreaProps> = ({
  children,
  footer,
  scrollable = true,
  scrollProps,
  style,
  dismissOnBackgroundTap = true,
}) => {
  const body = scrollable ? (
    <KeyboardAwareScrollView
      style={styles.body}
      contentContainerStyle={scrollProps?.contentContainerStyle}
      showsVerticalScrollIndicator={scrollProps?.showsVerticalScrollIndicator ?? false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      bottomOffset={FOCUSED_INPUT_BOTTOM_OFFSET}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={styles.body}>{children}</View>
  );

  return (
    <KeyboardAvoidingView style={[styles.root, style]} behavior="padding">
      {dismissOnBackgroundTap ? (
        <Pressable
          style={styles.body}
          onPress={() => Keyboard.dismiss()}
          accessible={false}
          importantForAccessibility="no"
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {footer}
      <KeyboardDoneAccessory />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
});
