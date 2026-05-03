import { useCallback } from 'react';
import { useCoachStore } from '../store';
import * as coachService from '../services/api/coachService';

/**
 * Custom hook for managing AI coach conversations
 * Handles creating conversations, sending messages, and streaming responses
 */
export function useCoach() {
  const {
    conversations,
    activeConversation,
    messages,
    isStreaming,
    setConversations,
    setActiveConversation,
    setMessages,
    addMessage,
    setStreaming,
    setLoading,
    setError,
  } = useCoachStore();

  const loadConversations = useCallback(
    async (userId: string) => {
      try {
        setLoading(true);
        const response = await coachService.getConversations(userId);

        if (response.success) {
          setConversations(response.data);
          return { success: true };
        } else {
          setError(response.error?.message || 'Failed to load conversations');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load conversations';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [setConversations, setLoading, setError],
  );

  const createNewConversation = useCallback(
    async (userId: string, topic: string, title: string, initialMessage: string) => {
      try {
        setLoading(true);
        const response = await coachService.createConversation({
          userId,
          topic,
          title,
          initialMessage,
        });

        if (response.success && response.data) {
          setActiveConversation(response.data);
          setConversations([response.data, ...conversations]);
          return { success: true, conversation: response.data };
        } else {
          setError(response.error?.message || 'Failed to create conversation');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create conversation';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [conversations, setConversations, setActiveConversation, setLoading, setError],
  );

  const selectConversation = useCallback(
    async (conversationId: string) => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation) {
        setActiveConversation(conversation);
        return { success: true };
      }

      try {
        setLoading(true);
        const response = await coachService.getMessages(conversationId);

        if (response.success) {
          const conv = {
            ...conversation!,
            messages: response.data,
          };
          setActiveConversation(conv);
          return { success: true };
        } else {
          setError(response.error?.message || 'Failed to load messages');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load messages';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [conversations, setActiveConversation, setLoading, setError],
  );

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!activeConversation?.id) {
        setError('No active conversation');
        return { success: false };
      }

      try {
        setLoading(true);
        const response = await coachService.sendMessage(activeConversation.id, userMessage);

        if (response.success && response.data) {
          addMessage(response.data);
          return { success: true, message: response.data };
        } else {
          setError(response.error?.message || 'Failed to send message');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send message';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [activeConversation?.id, addMessage, setLoading, setError],
  );

  const streamMessage = useCallback(
    async (userMessage: string) => {
      if (!activeConversation?.id) {
        setError('No active conversation');
        return { success: false };
      }

      return new Promise((resolve) => {
        setStreaming(true);
        let fullMessage = '';

        coachService.streamMessage(
          activeConversation.id,
          userMessage,
          (chunk) => {
            fullMessage = chunk.fullMessage;
            // Update store with partial message for real-time display
            // This can be improved with a separate store for streaming state
          },
          () => {
            setStreaming(false);
            resolve({ success: true });
          },
          (error) => {
            setError(error.message);
            setStreaming(false);
            resolve({ success: false });
          },
        );
      });
    },
    [activeConversation?.id, setStreaming, setError],
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        setLoading(true);
        const response = await coachService.deleteConversation(conversationId);

        if (response.success) {
          setConversations(conversations.filter((c) => c.id !== conversationId));
          if (activeConversation?.id === conversationId) {
            setActiveConversation(null);
          }
          return { success: true };
        } else {
          setError(response.error?.message || 'Failed to delete conversation');
          return { success: false };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete conversation';
        setError(message);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [conversations, activeConversation?.id, setConversations, setActiveConversation, setLoading, setError],
  );

  return {
    conversations,
    activeConversation,
    messages,
    isStreaming,
    loadConversations,
    createNewConversation,
    selectConversation,
    sendMessage,
    streamMessage,
    deleteConversation,
  };
}
