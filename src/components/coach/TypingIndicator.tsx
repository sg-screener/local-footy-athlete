import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export const TypingIndicator = () => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounceAnimation = (animatedValue: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(animatedValue, {
              toValue: -8,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        ),
      ]);
    };

    const animations = [
      createBounceAnimation(dot1Anim, 0),
      createBounceAnimation(dot2Anim, 100),
      createBounceAnimation(dot3Anim, 200),
    ];

    Animated.parallel(animations).start();

    return () => {
      animations.forEach((anim) => {
        anim.stop?.();
      });
    };
  }, [dot1Anim, dot2Anim, dot3Anim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          {
            transform: [{ translateY: dot1Anim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            transform: [{ translateY: dot2Anim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            transform: [{ translateY: dot3Anim }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.lime,
  },
});
