import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { spacing } from '../../theme/spacing';
import { colors } from '../../theme/colors';
import { Text } from '../common/Text';

/**
 * V2 Sheet primitive — bottom-anchored modal with rounded top corners,
 * a drag handle pill, and tap-outside-to-dismiss.
 *
 * Replaces the repeated `styles.modalOverlay` + `styles.modalContent`
 * pattern across HomeScreen (game-day modal, rebuild modal, phase-shift
 * modal). Callers pass `visible`, `onClose`, and render children for the
 * sheet body.
 *
 * If `dismissable` is false (e.g. during an in-flight rebuild) the
 * backdrop press is a no-op and the hardware back is blocked.
 */

export interface V2SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  dismissable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Set when the sheet body FLEXES — a `ScrollView`, or anything built on
   * `KeyboardSafeArea`, whose root is `flex: 1`.
   *
   * The sheet is auto-height by default: it hugs its children, which is right
   * for the short confirm/step sheets and is why most callers need nothing
   * here. But `flex: 1` is `flexGrow:1, flexShrink:1, flexBasis:0`, and a
   * flex-basis-0 child inside an auto-height parent has no definite free space
   * to grow into — so it resolves to ZERO height. The sheet then renders as a
   * sliver: backdrop dims, grab handle shows, no content, nothing to dismiss.
   *
   * That is exactly what happened to the Profile setup sheet on 2026-07-29
   * (Sam's device; the code's own "Device-verify the sheet layout" comment had
   * feared it). It is invisible to every source-level gate and to a
   * non-rendering test suite — the "renders but unusable" class.
   *
   * Setting this gives `content` a DEFINITE height, which is what a flexing
   * child needs to resolve against. Percentages resolve here because the
   * overlay is `flex: 1` inside the Modal, so its height is definite.
   */
  flexibleBody?: boolean;
  /**
   * THE SECOND SAFE ANSWER, AND IT IS NOT THE SAME AS `flexibleBody`.
   *
   * `flexibleBody` gives a DEFINITE height, which is what a `flex: 1` child
   * needs. But a definite height also means a two-line confirm opens as a
   * 92%-tall sheet with white space under it, which is why every caller that
   * wanted "hug the content, but stop before the top of the screen" had been
   * inventing its own `maxHeight` on an inner list instead — three different
   * ones, at the last count.
   *
   * `cappedBody` is that shape, once: the sheet still hugs, and stops at 92%.
   *
   * ⚠ **A `cappedBody` SHEET'S SCROLLING CHILD MUST USE `flexShrink: 1`, NEVER
   * `flex: 1`.** `flex: 1` is `flexBasis: 0`, and a flex-basis-0 child measures
   * ZERO inside a parent that is still deriving its height from its children —
   * the sliver defect `flexibleBody` exists to prevent, which a `maxHeight`
   * cannot fix because a cap on an undetermined height never binds. `flexShrink`
   * with an AUTO basis measures the content first and gives space back only when
   * the cap bites, which is exactly the behaviour wanted here.
   */
  cappedBody?: boolean;
}

export interface V2SheetHeaderProps {
  /** Small uppercase category label, e.g. INJURY. */
  title: React.ReactNode;
  /** Larger white question or heading beneath the category label. */
  subtitle: React.ReactNode;
  centered?: boolean;
  titleTestID?: string;
  subtitleTestID?: string;
}

export interface V2SheetDescriptionProps {
  children: React.ReactNode;
  centered?: boolean;
  testID?: string;
}

/** The one title/subtitle hierarchy for every athlete-facing popup. */
export function SheetHeader({
  title,
  subtitle,
  centered = false,
  titleTestID,
  subtitleTestID,
}: V2SheetHeaderProps) {
  return (
    <View style={[styles.header, centered && styles.headerCentered]}>
      <Text style={styles.headerTitle} testID={titleTestID}>{title}</Text>
      <Text style={styles.headerSubtitle} testID={subtitleTestID}>{subtitle}</Text>
    </View>
  );
}

/** Explanatory copy between a popup heading and its controls/content. */
export function SheetDescription({
  children,
  centered = false,
  testID,
}: V2SheetDescriptionProps) {
  return (
    <Text
      style={[styles.description, centered && styles.descriptionCentered]}
      testID={testID}
    >
      {children}
    </Text>
  );
}

export function Sheet({
  visible,
  onClose,
  children,
  dismissable = true,
  contentStyle,
  testID,
  flexibleBody = false,
  cappedBody = false,
}: V2SheetProps) {
  const handleClose = dismissable ? onClose : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View
        style={styles.overlay}
        accessible={false}
        importantForAccessibility="no"
        collapsable={false}
        testID={testID}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          style={[
            styles.content,
            flexibleBody && styles.contentFlexible,
            cappedBody && styles.contentCapped,
            contentStyle,
          ]}
          accessible={false}
          importantForAccessibility="no"
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  /**
   * A DEFINITE height, not `maxHeight`. `maxHeight` caps a size the parent is
   * still deriving from its children, so it does nothing for a flex-basis-0
   * child — the child measures 0 and the cap never binds. Only a definite
   * height gives the child something to fill.
   */
  contentFlexible: {
    height: '92%',
  },
  /** The hug-but-stop mode. See `cappedBody` above for why this is a cap and
   *  `contentFlexible` is not. */
  contentCapped: {
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent.lime,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    marginBottom: 14,
  },
  headerCentered: {
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    color: colors.text.primary,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  description: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  descriptionCentered: {
    textAlign: 'center',
  },
});
