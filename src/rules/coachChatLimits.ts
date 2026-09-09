/** One request boundary shared by the composer, client projection and server. */
export const COACH_CHAT_MAX_MESSAGE_CHARACTERS = 1_000;

export function coachChatMessageWithinLimit(message: string): boolean {
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= COACH_CHAT_MAX_MESSAGE_CHARACTERS;
}

/**
 * THE APP AND THE SERVER NAME THE CONTRACT THEY SPEAK (plan slice S2,
 * 2026-09-10). The deployed function used to accept any app and refuse the
 * answers it could not ground, which the athlete read as "I can't answer that
 * safely". Now the app sends this number inside `modelInput`; a server on a
 * different number answers 409 `coach_chat_contract_mismatch` and the app
 * shows the unavailable sentence (R-140 words, unchanged) and logs both
 * numbers. Bump it when the projection or the response contract changes shape.
 *
 * 2 — R-397 situation/history/injuries/estimates/mas + phase gate (2026-09-10).
 */
export const COACH_CHAT_CONTRACT_VERSION = 2;
