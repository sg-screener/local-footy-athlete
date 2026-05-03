import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Animated,
  Easing,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { Text } from './Text';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
  showLabel?: boolean;
  style?: ViewStyle;
  animated?: boolean;
}

export const ProgressBar = ({
  progress,
  color = colors.accent.lime,
  height = 8,
  showLabel = false,
  style,
  animated = true,
}: ProgressBarProps) => {
  // Clamp progress between 0 and 1
  const normalizedProgress = Math.max(0, Math.min(1, progress));

  const animatedValue = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: normalizedProgress,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(normalizedProgress);
    }
  }, [normalizedProgress, animated, animatedValue]);

  const fillWidth = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const containerStyle: ViewStyle = {
    height,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  };

  const percentage = Math.round(normalizedProgress * 100);

  return (
    <View style={style}>
      <View style={[styles.container, containerStyle]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillWidth,
              height: '100%',
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {showLabel && (
        <Text
          variant="caption"
          color={colors.text.secondary}
          align="right"
          style={styles.label}
        >
          {percentage}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  fill: {
    borderRadius: borderRadius.full,
  },
  label: {
    marginTop: spacing.xs,
  },
});
