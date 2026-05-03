/**
 * SessionExplanationBanner — "Why this session" panel.
 *
 * Shows a headline + body explanation when toggled.
 * Headline: bold, slightly larger — the coaching intent.
 * Body: regular weight — execution guidance.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated, Platform, UIManager } from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  headline: string;
  body: string;
  visible: boolean;
  onToggle: () => void;
}

/**
 * Info button (ⓘ) — small, subtle, tappable.
 */
export const InfoButton: React.FC<{ onPress: () => void; isActive?: boolean }> = ({
  onPress,
  isActive = false,
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    style={({ pressed }) => [
      styles.infoButton,
      isActive && styles.infoButtonActive,
      pressed && { opacity: 0.6 },
    ]}
  >
    <Text style={[styles.infoIcon, isActive && styles.infoIconActive]}>ⓘ</Text>
  </Pressable>
);

/**
 * Expandable explanation panel with fade + slide animation.
 */
export const SessionExplanationBanner: React.FC<Props> = ({
  headline,
  body,
  visible,
  onToggle,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  if (!visible || (!headline && !body)) return null;

  const opacity = anim;
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  return (
    <Animated.View style={[styles.banner, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.bannerAccent} />
      <View style={styles.bannerContent}>
        {headline ? (
          <Text style={styles.bannerHeadline}>{headline}</Text>
        ) : null}
        {body ? (
          <Text style={styles.bannerBody}>{body}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Info button
  infoButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  infoButtonActive: {
    backgroundColor: 'rgba(200, 255, 0, 0.12)',
  },
  infoIcon: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '600',
  },
  infoIconActive: {
    color: '#C8FF00',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: spacing.sm,
  },
  bannerAccent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#C8FF00',
    marginRight: 10,
    alignSelf: 'stretch',
  },
  bannerContent: {
    flex: 1,
  },
  bannerHeadline: {
    color: '#EEEEEE',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 3,
  },
  bannerBody: {
    color: '#BBBBBB',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
});
