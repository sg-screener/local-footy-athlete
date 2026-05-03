import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Text } from './Text';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export const Loading = ({
  message,
  fullScreen = true,
  style,
}: LoadingProps) => {
  const containerStyle: ViewStyle = fullScreen
    ? {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
      }
    : {
        flex: 1,
      };

  return (
    <View
      style={[
        styles.container,
        containerStyle,
        {
          backgroundColor: colors.surface.overlayDark,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <ActivityIndicator
          size="large"
          color={colors.accent.lime}
          style={styles.indicator}
        />

        {message && (
          <Text
            variant="body"
            color={colors.text.primary}
            style={styles.message}
          >
            {message}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  indicator: {
    marginBottom: spacing.lg,
  },
  message: {
    marginTop: spacing.md,
  },
});
