import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Text } from '../common/Text';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/spacing';
import { KeyboardSafeArea } from '../keyboard/KeyboardSafeArea';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  progressPercent: number;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  /** When true, the Continue button is hidden (used for auto-advance screens) */
  hideFooter?: boolean;
  /**
   * Optional helper rendered *above* the CTA button. Use this when Continue
   * is disabled to explain why (e.g. "Select duration and intensity") —
   * keeps the button visible and the athlete oriented instead of silently
   * locking them out.
   */
  footerHelperText?: string;
  /** Extra room at the end of the scroll area, useful above sticky footers. */
  scrollContentExtraBottomPadding?: number;
  /** True while the step's answer is being saved — blocks a double-advance. */
  saving?: boolean;
  /** Set when the answer could not be saved; shown instead of the CTA helper. */
  saveError?: string | null;
  /** @deprecated No longer displayed — kept for backward compat */
  stepLabel?: string;
}

const DEFAULT_SCROLL_BOTTOM_PADDING = 40;

/**
 * Onboarding screen shell.
 *
 * Layout (no absolute positioning anywhere):
 *
 *   SafeAreaView  flex:1
 *   ├─ Header             (auto height — back button + progress bar)
 *   └─ KeyboardSafeArea   (owns avoidance, scroll, dismiss, Done accessory)
 *      ├─ ScrollView      (content)
 *      └─ Footer          (CTA — INSIDE the avoided region)
 *
 * Keyboard avoidance used to be an opt-in prop, and the two screens that most
 * needed it — Name and BodyMeasurements — never opted in, which is dogfood
 * finding E3. There is no opt-in any more: the shell is keyboard-safe for every
 * step, because the convention lives in KeyboardSafeArea rather than here.
 */
export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  progressPercent,
  onBack,
  onContinue,
  continueDisabled = false,
  continueLabel = 'Continue',
  hideFooter = false,
  footerHelperText,
  scrollContentExtraBottomPadding = 0,
  saving = false,
  saveError = null,
}) => {
  const scrollBottomPadding =
    DEFAULT_SCROLL_BOTTOM_PADDING + scrollContentExtraBottomPadding;

  // Keyboard-LIFT is owned by KeyboardSafeArea (the sticky footer). The bottom
  // safe-area INSET is a separate concern owned here by the shell: it must clear
  // the home indicator at rest, but COLLAPSE while the keyboard is up — the keypad
  // then covers the home-indicator zone, and the CTA must ride flush on it with
  // zero gap (run-3 device finding + Sam ruling). Keeping the inset static on the
  // outer SafeAreaView is exactly what the full-height sticky lift overshot.
  //
  // The inset must collapse on the SAME clock the sticky lift rides, or it races
  // it. A boolean `isVisible` flag flips once, snapping paddingBottom
  // insets.bottom -> 0 in a single step, while KeyboardStickyView's transform
  // lifts continuously over the open animation — the CTA overshoots above the
  // keypad then settles (run-4 device finding). So the inset is interpolated on
  // the reanimated keyboard PROGRESS (0 closed .. 1 open) that KeyboardStickyView
  // also rides, on the UI thread: inset-collapse and lift are one motion, flush.
  const insets = useSafeAreaInsets();
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();
  const restingBottomInset = Math.max(insets.bottom, 12);
  const footerInsetStyle = useAnimatedStyle(() => ({
    paddingBottom: (1 - keyboardProgress.value) * restingBottomInset,
  }));

  const footer = hideFooter ? null : (
    <Animated.View style={[styles.footer, footerInsetStyle]}>
      {saveError ? (
        <Text style={styles.footerError}>{saveError}</Text>
      ) : footerHelperText ? (
        <Text style={styles.footerHelper}>{footerHelperText}</Text>
      ) : null}
      <Pressable
        onPress={onContinue}
        disabled={continueDisabled || saving}
        style={({ pressed }) => [
          styles.ctaButton,
          (continueDisabled || saving) && styles.ctaDisabled,
          pressed && !continueDisabled && !saving && styles.ctaPressed,
        ]}
      >
        <Text
          variant="button"
          color={continueDisabled || saving ? colors.text.disabled : colors.text.inverse}
          align="center"
        >
          {saving ? 'Saving…' : continueLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backTouchable}
        >
          <Text style={styles.backText}>
            {'‹'}
          </Text>
        </Pressable>

        {/* Progress bar — takes remaining width */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(progressPercent, 2)}%` },
            ]}
          />
        </View>
      </View>

      {/* ─── Content + CTA, both inside the avoided region ─── */}
      <KeyboardSafeArea
        footer={footer}
        // Auto-advance steps (hideFooter) are selection-only — no text input,
        // so no keyboard and no Done bar (L10 device finding, 2026-07-24).
        hasTextInput={!hideFooter}
        scrollProps={{
          contentContainerStyle: [
            styles.scrollContent,
            { paddingBottom: scrollBottomPadding },
          ],
        }}
      >
        {children}
      </KeyboardSafeArea>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  root: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 14,
  },
  backTouchable: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  backText: {
    color: colors.text.secondary,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },

  /* Progress — fills remaining width */
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: colors.surface.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.lime,
    borderRadius: 2,
  },

  /* Scroll */
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: DEFAULT_SCROLL_BOTTOM_PADDING,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerError: {
    color: colors.status.error,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  footerHelper: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },

  /* CTA Button */
  ctaButton: {
    height: 56,
    backgroundColor: colors.accent.lime,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  ctaDisabled: {
    backgroundColor: colors.surface.tertiary,
    ...shadows.none,
  },
  ctaPressed: {
    backgroundColor: colors.accent.limeDark,
    transform: [{ scale: 0.98 }],
  },
});
