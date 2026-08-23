import { getClientEnvConfig } from '../../config/env';
import {
  buildCoachModelInput,
  type CoachModelConversationContext,
} from '../../rules/coachModelContext';
import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import { validateCoachCommunicationTruth } from '../../utils/verifiedCoachCommunication';

interface CoachChatFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type CoachChatFetch = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly signal?: AbortSignal;
  },
) => Promise<CoachChatFetchResponse>;

export interface AskCoachReadOnlyInput {
  readonly message: string;
  readonly snapshot: CoachSnapshot;
  readonly conversationContext: CoachModelConversationContext;
  readonly fetch?: CoachChatFetch;
  readonly timeoutMs?: number;
}

/**
 * The live app's only AI door. It can ask for one read-only answer and nothing
 * else: the server owns Terra, retrieval, instructions and the empty-action
 * schema, while this client owns only the current derived athlete context.
 */
export async function askCoachReadOnly(input: AskCoachReadOnlyInput): Promise<string> {
  const config = getClientEnvConfig();
  if (!config.isReady) throw new Error('Coach chat environment is unavailable.');
  const fetcher = input.fetch ?? (globalThis.fetch as unknown as CoachChatFetch);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000);
  let response: CoachChatFetchResponse;
  try {
    response = await fetcher(`${config.supabaseFunctionsBaseUrl}/coach-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        modelInput: buildCoachModelInput({
          athleteMessage: input.message,
          snapshot: input.snapshot,
          conversationContext: input.conversationContext,
        }),
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  if (!response.ok) throw new Error(`Coach chat unavailable (${response.status}).`);
  let payload: { message?: unknown; programActions?: unknown };
  try {
    payload = JSON.parse(raw) as { message?: unknown; programActions?: unknown };
  } catch {
    throw new Error('Coach chat returned an unreadable answer.');
  }
  if (typeof payload.message !== 'string' || !payload.message.trim()) {
    throw new Error('Coach chat returned no answer.');
  }
  if (!Array.isArray(payload.programActions) || payload.programActions.length !== 0) {
    throw new Error('Coach chat refused a non-read-only answer.');
  }
  const message = payload.message.trim();
  const truth = validateCoachCommunicationTruth({
    communication: {
      appliedChanges: [],
      activeGuidance: [],
      optionalAdvice: [],
      canSayProgramUpdated: false,
      canSayProgramChanged: false,
    },
    replyText: message,
  });
  if (!truth.ok) {
    throw new Error('Coach chat refused an untruthful read-only answer.');
  }
  return message;
}
