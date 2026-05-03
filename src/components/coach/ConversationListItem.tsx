import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { Card } from '../common/Card';
import { Text } from '../common/Text';
import type { CoachConversation } from '../../types/domain';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListItemProps {
  conversation: CoachConversation;
}

const TOPIC_ICONS: Record<string, string> = {
  'Nutrition': '🍎',
  'Injury': '🏥',
  'Program': '💪',
  'General Advice': '💡',
};

const TOPIC_COLORS: Record<string, string> = {
  'Nutrition': '#FF6D00',
  'Injury': '#F44336',
  'Program': '#00E676',
  'General Advice': '#2196F3',
};

export const ConversationListItem = ({ conversation }: ConversationListItemProps) => {
  const topicIcon = useMemo(() => {
    return TOPIC_ICONS[conversation.topic] || '💬';
  }, [conversation.topic]);

  const topicColor = useMemo(() => {
    return TOPIC_COLORS[conversation.topic] || colors.accent.lime;
  }, [conversation.topic]);

  const lastMessage = useMemo(() => {
    return conversation.messages?.[conversation.messages.length - 1]?.content || 'No messages';
  }, [conversation.messages]);

  const relativTime = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  }, [conversation.updatedAt]);

  const hasUnread = false; // TODO: Implement unread tracking

  return (
    <Card style={styles.card}>
      <View style={styles.container}>
        <View style={[styles.iconContainer, { backgroundColor: `${topicColor}20` }]}>
          <Text style={styles.icon}>{topicIcon}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text variant="bodyEmphasis" color={colors.text.primary} numberOfLines={1}>
              {conversation.title}
            </Text>
            {hasUnread && <View style={[styles.unreadIndicator, { backgroundColor: topicColor }]} />}
          </View>

          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            numberOfLines={2}
            style={styles.preview}
          >
            {lastMessage}
          </Text>

          <Text variant="caption" color={colors.text.tertiary}>
            {relativTime}
          </Text>
        </View>

        <View style={styles.rightContent}>
          <View style={[styles.topicBadge, { backgroundColor: `${topicColor}20` }]}>
            <Text variant="caption" color={topicColor}>
              {conversation.topic}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    lineHeight: 20,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  rightContent: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  topicBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
});
