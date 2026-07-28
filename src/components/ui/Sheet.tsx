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
}

export function Sheet({
  visible,
  onClose,
  children,
  dismissable = true,
  contentStyle,
  testID,
  flexibleBody = false,
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
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
});
