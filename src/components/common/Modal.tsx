import React, { useEffect } from 'react';
import {
  Modal as RNModal,
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  Animated,
  Dimensions,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from './Text';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Modal = ({
  visible,
  onClose,
  title,
  children,
  style,
}: ModalProps) => {
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable style={styles.backdropPress} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          <View style={styles.header}>
            {title && (
              <Text variant="h3" color={colors.text.primary}>
                {title}
              </Text>
            )}
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text variant="h3" color={colors.text.primary}>
                ×
              </Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            {children}
          </View>
        </Animated.View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface.overlayDark,
  },
  backdropPress: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.surface.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    minHeight: 300,
    zIndex: 1000,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.tertiary,
  },
  closeButton: {
    padding: spacing.sm,
    marginLeft: spacing.md,
  },
  body: {
    paddingVertical: spacing.lg,
  },
});
