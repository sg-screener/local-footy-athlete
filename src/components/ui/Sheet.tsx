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
}

export function Sheet({
  visible,
  onClose,
  children,
  dismissable = true,
  contentStyle,
  testID,
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
          style={[styles.content, contentStyle]}
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
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
});
