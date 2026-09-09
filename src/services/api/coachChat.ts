import { getClientEnvConfig } from '../../config/env';
import {
  buildCoachModelInput,
  type CoachModelConversationContext,
} from '../../rules/coachModelContext';
import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import type { CoachChatFailureCode } from '../../rules/coachChatFailure';
import { validateCoachCommunicationTruth } from '../../utils/verifiedCoachCommunication';
import { coachChatMessageWithinLimit } from '../../rules/coachChatLimits';
import {
  coachResponseGroundingFacts,
  fixtureClaimGrounded,
  readinessClaimGrounded,
} from '../../rules/coachResponseContract';

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
 * The screen must not infer why Coach failed from provider prose or HTTP text.
 * This is the app-side boundary: transport/provider failures are retryable,
 * malformed or empty answers are absence, and answers rejected by the
 * read-only/truth contracts are safety refusals.
 */
export class CoachChatError extends Error {
  constructor(
    readonly code: CoachChatFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'CoachChatError';
  }
}

export function coachChatFailureCode(error: unknown): CoachChatFailureCode {
  return error instanceof CoachChatError ? error.code : 'unavailable';
}

function serverFailureCode(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    return typeof parsed.error === 'string' ? parsed.error : null;
  } catch {
    return null;
  }
}

/**
 * The live app's only AI door. It can ask for one read-only answer and nothing
 * else: the server owns Terra, retrieval, instructions and the empty-action
 * schema, while this client owns only the current derived athlete context.
 */
export async function askCoachReadOnly(input: AskCoachReadOnlyInput): Promise<string> {
  if (!coachChatMessageWithinLimit(input.message)) {
    throw new CoachChatError('no_answer', 'Coach chat message is outside the request boundary.');
  }
  const config = getClientEnvConfig();
  if (!config.isReady) {
    throw new CoachChatError('unavailable', 'Coach chat environment is unavailable.');
  }
  const fetcher = input.fetch ?? (globalThis.fetch as unknown as CoachChatFetch);
  const modelInput = buildCoachModelInput({
    athleteMessage: input.message,
    snapshot: input.snapshot,
    conversationContext: input.conversationContext,
  });
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
      body: JSON.stringify({ modelInput }),
    });
  } catch {
    throw new CoachChatError('unavailable', 'Coach chat request could not reach the server.');
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  if (!response.ok) {
    const serverCode = serverFailureCode(raw);
    if (serverCode === 'coach_chat_response_refused') {
      throw new CoachChatError('refused', 'Coach chat refused an unsafe answer.');
    }
    if (serverCode === 'coach_chat_invalid_answer') {
      throw new CoachChatError('no_answer', 'Coach chat returned no usable answer.');
    }
    throw new CoachChatError('unavailable', `Coach chat unavailable (${response.status}).`);
  }
  let payload: { message?: unknown; programActions?: unknown };
  try {
    payload = JSON.parse(raw) as { message?: unknown; programActions?: unknown };
  } catch {
    throw new CoachChatError('no_answer', 'Coach chat returned an unreadable answer.');
  }
  if (typeof payload.message !== 'string' || !payload.message.trim()) {
    throw new CoachChatError('no_answer', 'Coach chat returned no answer.');
  }
  if (!Array.isArray(payload.programActions) || payload.programActions.length !== 0) {
    throw new CoachChatError('refused', 'Coach chat refused a non-read-only answer.');
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
    throw new CoachChatError('refused', 'Coach chat refused an untruthful read-only answer.');
  }
  // F14 (2026-09-09): the words are checked against the same snapshot facts
  // the server checks, so an invented readiness tier or game day never reaches
  // the athlete even if the server's gate is behind this build.
  const facts = coachResponseGroundingFacts(modelInput.currentAthleteSnapshot);
  if (!readinessClaimGrounded(message, facts) || !fixtureClaimGrounded(message, facts)) {
    throw new CoachChatError('refused', 'Coach chat refused an answer that contradicts the athlete snapshot.');
  }
  return message;
}
