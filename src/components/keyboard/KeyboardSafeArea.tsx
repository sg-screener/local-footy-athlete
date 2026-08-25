import React from 'react';
import {
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  useKeyboardContext,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
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
   * Content pinned below the scroll area that must ride above the keyboard —
   * the Continue CTA belongs here. Dogfood finding E3 was the CTA sitting
   * below the keypad where the athlete could not reach it.
   */
  footer?: React.ReactNode;
  /** Render children in a keyboard-aware scroll view (the usual case). */
  scrollable?: boolean;
  scrollProps?: Pick<
    ScrollViewProps,
    'contentContainerStyle' | 'showsVerticalScrollIndicator' | 'onScrollBeginDrag'
  >;
  style?: StyleProp<ViewStyle>;
  /** Tap outside an input to dismiss. Off for screens whose body is a list. */
  dismissOnBackgroundTap?: boolean;
  /**
   * Whether this screen contains a text input. The Done bar exists only to get
   * off a keyboard, so a selection-only screen (no input) must not mount it —
   * L10 device finding, 2026-07-24, where a "Done" bar showed on an auto-advance
   * question. The owner can't introspect its children, so the caller declares
   * it; defaults true so every existing input screen keeps its exit.
   */
  hasTextInput?: boolean;
}

/**
 * The app's one keyboard-avoidance owner.
 *
 * Dogfood findings E3, E4 and E7 were a single bug wearing three hats:
 * keyboard handling was decided per screen, so every screen got a different
 * (and differently broken) answer. Everything the keyboard touches is now
 * decided here, once:
 *
 * - **The focused field stays visible** — `KeyboardAwareScrollView` scrolls it
 *   clear of the keypad, with `bottomOffset` covering the Done bar too (E7).
 * - **The CTA rides above the keypad** — `KeyboardStickyView` moves the footer
 *   with the keyboard on the UI thread (E3).
 * - **Taps stay live** — `keyboardShouldPersistTaps="handled"`, so Continue is
 *   reachable on the first tap rather than needing a blank-space tap first (E4).
 * - **Dismissal** — background tap here, plus the shared Done toolbar (E4).
 *
 * Built on `react-native-keyboard-controller`, whose `KeyboardProvider` is
 * already mounted in App.tsx: it tracks the keyboard frame natively on both
 * platforms rather than guessing, which RN's own `KeyboardAvoidingView` could
 * never do reliably on Android.
 *
 * **Composition matters.** An earlier cut nested `KeyboardAwareScrollView`
 * inside a `KeyboardAvoidingView` and rendered the toolbar inside both. Each
 * one shifted the same content, and the toolbar was laid out as ordinary
 * content *and* positioned against the keyboard — which put a second, floating
 * Done bar over the screen title (caught on the simulator pass, 2026-07-24).
 * These three primitives are siblings, each owning exactly one job, and the
 * toolbar is a root-level sibling because it positions itself.
 */
export const KeyboardSafeArea: React.FC<KeyboardSafeAreaProps> = ({
  children,
  footer,
  scrollable = true,
  scrollProps,
  style,
  dismissOnBackgroundTap = true,
  hasTextInput = true,
}) => {
  // ── THE BODY MUST END WHERE THE KEYPAD BEGINS ──────────────────────────────
  //
  // SAM'S DEVICE, 2026-08-09, verbatim: *"the chat history is stuck - it gets
  // hidden behind the keypad and it doesn't scroll down - so when I'm typing a
  // new question after a few questions I can't see the answers."*
  //
  // The cause is a gap in THIS owner, not in the screen that found it.
  // `KeyboardStickyView` lifts the footer, and nothing ever moved the body: it
  // is `flex: 1` inside a root that does not shrink, so its frame still runs to
  // the true screen bottom and its last content sits behind the keypad. A
  // `KeyboardAwareScrollView` body hides that, because it scrolls the FOCUSED
  // INPUT clear — but a screen whose input lives in the FOOTER has no focused
  // input inside the body at all, so nothing was ever adjusted. **The bare
  // `View` branch owned nothing, and that is the hole.**
  //
  // So the non-scrollable body reserves the keyboard's height. The value is the
  // shared value `KeyboardStickyView` itself rides — one native keyboard frame,
  // read twice — because the slice-1 boundary named the failure mode of the
  // alternative by name: two animations on two clocks. `Math.abs` because this
  // reads as a height here and as a translation there, and a sign convention is
  // not something a layout should depend on remembering.
  //
  // The scrollable branch is deliberately NOT padded: `KeyboardAwareScrollView`
  // already owns keeping its focused field clear of the keypad, and adding a
  // second adjustment to content it is already moving is the "two primitives
  // shifting the same content" defect this file was rewritten to end.
  const { reanimated } = useKeyboardContext();
  const keyboardInset = useAnimatedStyle(() => ({
    paddingBottom: Math.abs(reanimated.height.value),
  }));

  /**
   * ── THE BACKGROUND DISMISS-TAP IS DELETED — MEASURED FATAL, TWICE ────────
   *
   * Its two lives, both measured:
   *
   * 1. PERMANENT wrapper (pre-2026-08-25): a responder wrapper around the
   *    scroll view competed for every pan — the Profile "Review your setup"
   *    page would not scroll AT ALL (launch-audit #4), and Sam's 2026-08-09
   *    "the chat history is stuck" was the same wrapper on the Coach tab.
   * 2. CONDITIONAL wrapper (2026-08-25 → 2026-08-26): mounting it only while
   *    the keyboard was up REPARENTED the subtree holding the focused input
   *    on every keyboard transition — the input lost focus, the keyboard
   *    hid, autofocus re-raised it, and the loop locked the first onboarding
   *    screen solid on Sam's PHONE (Release build, 2026-08-26: "the keyboard
   *    popping up and disappearing and now i cant tap anything", Continue
   *    frozen mid-screen at its keyboard-open offset). The simulator never
   *    showed it because its hardware keyboard means the software keyboard —
   *    and therefore the toggle — never appears.
   *
   * A mechanism that breaks scroll when permanent and breaks focus when
   * conditional is the wrong mechanism. Dismissal keeps its two working
   * paths: the scroll view's own `keyboardDismissMode="interactive"` (drag
   * down) and the Done accessory bar. `dismissOnBackgroundTap` remains in
   * the props so no call site churns; it now gates nothing.
   */
  void dismissOnBackgroundTap;

  const body = scrollable ? (
    <KeyboardAwareScrollView
      style={styles.body}
      contentContainerStyle={scrollProps?.contentContainerStyle}
      showsVerticalScrollIndicator={scrollProps?.showsVerticalScrollIndicator ?? false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      bottomOffset={FOCUSED_INPUT_BOTTOM_OFFSET}
      onScrollBeginDrag={scrollProps?.onScrollBeginDrag}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <Animated.View style={[styles.body, keyboardInset]}>{children}</Animated.View>
  );

  return (
    <View style={[styles.root, style]}>
      {body}
      {footer ? <KeyboardStickyView>{footer}</KeyboardStickyView> : null}
      {/*
        The Done bar and a sticky CTA both want the strip directly above the
        keypad, and rendering both put the toolbar on top of Continue (caught on
        the simulator pass). Where a screen has a footer CTA, that CTA *is* the
        exit — it rides above the keyboard and `keyboardShouldPersistTaps`
        makes it tappable on the first tap, which is exactly what E4 asked for.
        The toolbar is for screens with no CTA of their own.

        It is also gated on `hasTextInput`: a selection-only screen never raises
        a keyboard, so mounting a dismiss bar there is pure noise (L10 device
        finding). No input and no footer → the strip stays empty.
      */}
      {footer || !hasTextInput ? null : <KeyboardDoneAccessory />}
    </View>
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
