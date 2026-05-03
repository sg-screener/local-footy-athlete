import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import type { CoachStackParamList } from '../../types/navigation';
import { MessageBubble } from '../../components/coach/MessageBubble';
import { TypingIndicator } from '../../components/coach/TypingIndicator';
import { QuickPromptsBar } from '../../components/coach/QuickPromptsBar';
import type { CoachMessage } from '../../types/domain';

type ChatScreenProps = NativeStackScreenProps<CoachStackParamList, 'CoachChat'>;

interface Message extends CoachMessage {
  isLocal?: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    conversationId: '',
    role: 'assistant',
    content: "Hey! I'm your AI Coach. I'm here to help with questions about training, nutrition, recovery, and your program. What's on your mind?",
    createdAt: new Date().toISOString(),
  },
];

export default function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { conversationId, topic } = route.params;
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: String(Date.now()),
      conversationId: conversationId || '',
      role: 'user',
      content: inputValue.trim(),
      createdAt: new Date().toISOString(),
      isLocal: true,
    };

    setMessages((prev) => [userMessage, ...prev]);
    setInputValue('');
    setIsTyping(true);
    inputRef.current?.blur();

    try {
      // TODO: Replace with actual coachService.sendMessage call
      // const response = await coachService.sendMessage(conversationId, inputValue);

      // Simulate AI response delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const assistantMessage: Message = {
        id: String(Date.now() + 1),
        conversationId: conversationId || '',
        role: 'assistant',
        content: "That's a great question! Let me help you with that. In general, the best approach depends on your specific situation, goals, and current fitness level. Consider factors like your training phase, recovery capacity, and individual preferences.",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [assistantMessage, ...prev]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: String(Date.now() + 1),
        conversationId: conversationId || '',
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [errorMessage, ...prev]);
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, conversationId]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  }, []);

  const isInputDisabled = !inputValue.trim() || isTyping || isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerContent}>
          <Text variant="h4" color={colors.text.primary}>
            {topic || 'AI Coach'}
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary}>
            Always here to help
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => (
          <MessageBubble message={item} isUser={item.role === 'user'} />
        )}
        keyExtractor={(item) => item.id}
        inverted
        scrollEventThrottle={16}
        contentContainerStyle={styles.messagesContainer}
        ListHeaderComponent={
          isTyping ? (
            <View style={styles.typingContainer}>
              <TypingIndicator />
            </View>
          ) : null
        }
      />

      {/* Quick Prompts Bar */}
      <QuickPromptsBar topic={topic} onSelectPrompt={handleQuickPrompt} />

      {/* Input Area */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask your coach..."
            placeholderTextColor={colors.input.placeholder}
            value={inputValue}
            onChangeText={setInputValue}
            multiline
            maxLength={1000}
            editable={!isLoading && !isTyping}
            scrollEnabled={false}
            returnKeyType="default"
          />
          <Pressable
            onPress={handleSendMessage}
            disabled={isInputDisabled}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: isInputDisabled
                  ? colors.button.disabled
                  : colors.accent.lime,
              },
              pressed && !isInputDisabled && { opacity: 0.8 },
            ]}
          >
            {isTyping ? (
              <ActivityIndicator size="small" color={colors.primary.dark} />
            ) : (
              <Text style={styles.sendIcon}>→</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  backIcon: {
    fontSize: 28,
    color: colors.accent.lime,
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  messagesContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  typingContainer: {
    paddingVertical: spacing.md,
  },
  inputArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.surface.secondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.input.background,
    borderColor: colors.input.border,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    color: colors.input.text,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontWeight,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sendIcon: {
    fontSize: 20,
    color: colors.primary.dark,
    fontWeight: 'bold',
  },
});
