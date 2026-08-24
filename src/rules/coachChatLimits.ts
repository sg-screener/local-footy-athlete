/** One request boundary shared by the composer, client projection and server. */
export const COACH_CHAT_MAX_MESSAGE_CHARACTERS = 1_000;

export function coachChatMessageWithinLimit(message: string): boolean {
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= COACH_CHAT_MAX_MESSAGE_CHARACTERS;
}
