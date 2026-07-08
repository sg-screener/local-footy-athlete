import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../common/Text';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/spacing';

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
  /** Enables keyboard avoidance for steps with text inputs. */
  keyboardAvoiding?: boolean;
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
 *   └─ View  flex:1  (column)
 *      ├─ Header        (auto height — back button + progress bar)
 *      ├─ View flex:1   (scroll wrapper — bounded)
 *      │  └─ ScrollView (scrolls within bounded wrapper)
 *      └─ Footer        (auto height, always visible — unless hideFooter)
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
  keyboardAvoiding = false,
}) => {
  const scrollBottomPadding =
    DEFAULT_SCROLL_BOTTOM_PADDING + scrollContentExtraBottomPadding;

  const content = (
    <>
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

      {/* ─── Scrollable Content ─── */}
      <View style={styles.scrollWrapper}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scrollBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>

      {/* ─── Fixed Bottom CTA ─── */}
      {!hideFooter && (
        <View style={styles.footer}>
          {footerHelperText ? (
            <Text style={styles.footerHelper}>{footerHelperText}</Text>
          ) : null}
          <Pressable
            onPress={onContinue}
            disabled={continueDisabled}
            style={({ pressed }) => [
              styles.ctaButton,
              continueDisabled && styles.ctaDisabled,
              pressed && !continueDisabled && styles.ctaPressed,
            ]}
          >
            <Text
              variant="button"
              color={continueDisabled ? colors.text.disabled : colors.text.inverse}
              align="center"
            >
              {continueLabel}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.root}>{content}</View>
      )}
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
