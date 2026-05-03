import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachConversation, CoachMessage } from '../types/domain';

interface CoachState {
  conversations: CoachConversation[];
  activeConversation: CoachConversation | null;
  messages: CoachMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  setConversations: (conversations: CoachConversation[]) => void;
  setActiveConversation: (conversation: CoachConversation | null) => void;
  setMessages: (messages: CoachMessage[]) => void;
  addMessage: (message: CoachMessage) => void;
  setStreaming: (streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set) => ({
      conversations: [],
      activeConversation: null,
      messages: [],
      isStreaming: false,
      isLoading: false,
      error: null,

      setConversations: (conversations) => set({ conversations }),

      setActiveConversation: (conversation) =>
        set({
          activeConversation: conversation,
          messages: conversation?.messages || [],
        }),

      setMessages: (messages) => set({ messages }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      setStreaming: (streaming) => set({ isStreaming: streaming }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clear: () => {
        set({
          conversations: [],
          activeConversation: null,
          messages: [],
          isStreaming: false,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'coach-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
