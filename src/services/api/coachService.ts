import { supabase, handleSupabaseError } from './supabaseClient';
import { CoachConversation, CoachMessage, StreamCoachMessageChunk } from '../../types/domain';
import {
  ApiResponse,
  StreamCoachMessageRequest,
  CreateCoachConversationRequest,
} from '../../types/api';

/**
 * Send a message to the AI coach
 */
export async function sendMessage(
  conversationId: string,
  userMessage: string,
): Promise<ApiResponse<CoachMessage>> {
  try {
    // First, save the user message
    const { data: userMsg, error: userMsgError } = await supabase
      .from('coach_messages')
      .insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: userMessage,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (userMsgError) {
      throw userMsgError;
    }

    // Call the edge function to get AI response
    const { data: edgeFunctionResponse, error: edgeFunctionError } =
      await supabase.functions.invoke('coach-message', {
        body: {
          conversationId,
          userMessage,
        },
      });

    if (edgeFunctionError) {
      throw edgeFunctionError;
    }

    // Save the assistant response
    const { data: assistantMsg, error: assistantMsgError } = await supabase
      .from('coach_messages')
      .insert([
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: edgeFunctionResponse.message,
          tokens_used: edgeFunctionResponse.tokensUsed,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (assistantMsgError) {
      throw assistantMsgError;
    }

    return {
      data: transformCoachMessageData(assistantMsg),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as CoachMessage,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Get all conversations for a user
 */
export async function getConversations(userId: string): Promise<ApiResponse<CoachConversation[]>> {
  try {
    const { data, error } = await supabase
      .from('coach_conversations')
      .select('*, coach_messages(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return {
      data: data.map(transformCoachConversationData),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: [],
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Create a new coach conversation
 */
export async function createConversation(
  request: CreateCoachConversationRequest,
): Promise<ApiResponse<CoachConversation>> {
  try {
    // Create the conversation
    const { data: conversation, error: convError } = await supabase
      .from('coach_conversations')
      .insert([
        {
          user_id: request.userId,
          topic: request.topic,
          title: request.title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (convError) {
      throw convError;
    }

    // Create initial message from user
    const { data: message, error: msgError } = await supabase
      .from('coach_messages')
      .insert([
        {
          conversation_id: conversation.id,
          role: 'user',
          content: request.initialMessage,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (msgError) {
      throw msgError;
    }

    return {
      data: {
        id: conversation.id,
        userId: conversation.user_id,
        topic: conversation.topic,
        title: conversation.title,
        messages: [transformCoachMessageData(message)],
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null as unknown as CoachConversation,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Get messages for a conversation
 */
export async function getMessages(conversationId: string): Promise<ApiResponse<CoachMessage[]>> {
  try {
    const { data, error } = await supabase
      .from('coach_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      data: data.map(transformCoachMessageData),
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: [],
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

/**
 * Stream a message response from the coach (for real-time display)
 * This requires a server-sent events endpoint
 */
export async function streamMessage(
  conversationId: string,
  userMessage: string,
  onChunk: (chunk: StreamCoachMessageChunk) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
): Promise<void> {
  try {
    // Save user message first
    await supabase.from('coach_messages').insert([
      {
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString(),
      },
    ]);

    // Get a streaming response
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/coach-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        conversationId,
        userMessage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stream error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader');
    }

    let fullMessage = '';
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            fullMessage += data.token;
            onChunk({
              token: data.token,
              fullMessage,
              isComplete: false,
            });
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }

    // Save the complete assistant message
    await supabase.from('coach_messages').insert([
      {
        conversation_id: conversationId,
        role: 'assistant',
        content: fullMessage,
        created_at: new Date().toISOString(),
      },
    ]);

    onChunk({
      token: '',
      fullMessage,
      isComplete: true,
    });

    onComplete();
  } catch (error) {
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error(String(error)));
    }
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<ApiResponse<null>> {
  try {
    // Delete messages first
    const { error: msgError } = await supabase
      .from('coach_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (msgError) {
      throw msgError;
    }

    // Delete conversation
    const { error: convError } = await supabase
      .from('coach_conversations')
      .delete()
      .eq('id', conversationId);

    if (convError) {
      throw convError;
    }

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    const apiError = handleSupabaseError(error);
    return {
      data: null,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      success: false,
    };
  }
}

// Helper functions
function transformCoachConversationData(data: any): CoachConversation {
  return {
    id: data.id,
    userId: data.user_id,
    topic: data.topic,
    title: data.title,
    messages: (data.coach_messages || []).map(transformCoachMessageData),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformCoachMessageData(data: any): CoachMessage {
  return {
    id: data.id,
    conversationId: data.conversation_id,
    role: data.role,
    content: data.content,
    tokensUsed: data.tokens_used,
    createdAt: data.created_at,
  };
}
