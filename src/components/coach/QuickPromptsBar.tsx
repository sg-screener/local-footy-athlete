import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../common/Text';

interface QuickPromptsBarProps {
  topic?: string;
  onSelectPrompt: (prompt: string) => void;
}

const QUICK_PROMPTS: Record<string, string[]> = {
  'Nutrition': [
    'What should I eat before a game?',
    'Post-training meal ideas',
    'How much protein do I need?',
  ],
  'Injury': [
    "I've got a sore knee",
    'How to manage a rolled ankle',
    'Should I train with a niggle?',
  ],
  'Program': [
    'Why is this exercise in my program?',
    'Can I swap an exercise?',
    "When's my next deload?",
  ],
  'General Advice': [
    'How do I improve my fitness?',
    'Tips for better recovery',
    'What helps with motivation?',
  ],
};

export const QuickPromptsBar = ({ topic = 'General Advice', onSelectPrompt }: QuickPromptsBarProps) => {
  const prompts = useMemo(() => {
    return QUICK_PROMPTS[topic] || QUICK_PROMPTS['General Advice'];
  }, [topic]);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        {prompts.map((prompt, index) => (
          <Pressable
            key={`${topic}-${index}`}
            onPress={() => onSelectPrompt(prompt)}
            style={({ pressed }) => [
              styles.chip,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              variant="bodySmall"
              color={colors.text.primary}
              numberOfLines={2}
            >
              {prompt}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface.secondary,
    backgroundColor: colors.surface.primary,
  },
  content: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.full,
    borderColor: colors.accent.lime,
    borderWidth: 1,
    marginRight: spacing.sm,
    maxWidth: 150,
    justifyContent: 'center',
  },
});
