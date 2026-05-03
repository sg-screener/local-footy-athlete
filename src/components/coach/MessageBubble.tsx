import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Animated,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../common/Text';
import type { CoachMessage } from '../../types/domain';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: CoachMessage;
  isUser: boolean;
}

export const MessageBubble = ({ message, isUser }: MessageBubbleProps) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleCopyText = () => {
    // TODO: Implement clipboard copy
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  const formattedTime = format(new Date(message.createdAt), 'HH:mm');

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
        { opacity: fadeAnim },
      ]}
    >
      <Pressable
        onLongPress={handleCopyText}
        style={({ pressed }) => [
          styles.bubble,
          isUser
            ? [styles.userBubble, pressed && { opacity: 0.8 }]
            : [styles.assistantBubble, pressed && { opacity: 0.9 }],
        ]}
      >
        <Text
          variant="body"
          color={isUser ? colors.primary.dark : colors.text.primary}
          style={styles.messageText}
        >
          {message.content}
        </Text>
      </Pressable>

      <Text
        variant="caption"
        color={colors.text.tertiary}
        style={[
          styles.timestamp,
          isUser ? styles.userTimestamp : styles.assistantTimestamp,
        ]}
      >
        {formattedTime}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xs,
  },
  userBubble: {
    backgroundColor: colors.accent.lime,
  },
  assistantBubble: {
    backgroundColor: colors.surface.secondary,
  },
  messageText: {
    lineHeight: typography.body.lineHeight,
  },
  timestamp: {
    marginHorizontal: spacing.xs,
  },
  userTimestamp: {
    marginRight: spacing.xs,
  },
  assistantTimestamp: {
    marginLeft: spacing.xs,
  },
});
