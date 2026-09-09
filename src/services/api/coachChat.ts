import { getClientEnvConfig } from '../../config/env';
import {
  buildCoachModelInput,
  type CoachModelConversationContext,
} from '../../rules/coachModelContext';
import type { CoachSnapshot } from '../../rules/liveAthleteSnapshot';
import type { CoachChatFailureCode } from '../../rules/coachChatFailure';
import { validateCoachCommunicationTruth } from '../../utils/verifiedCoachCommunication';
import { coachChatMessageWithinLimit } from '../../rules/coachChatLimits';
import { COACH_APP_DOOR_LABELS } from '../../rules/coachAppMap';
import {
  coachResponseGroundingFacts,
  fixtureClaimGrounded,
  readinessClaimGrounded,
  phaseClaimGrounded,
  wordGatesHold,
} from '../../rules/coachResponseContract';
import { isCoachChatStream, parseCoachChatStream, type CoachChatStreamLine } from '../../rules/coachChatStream';
import { defaultCoachChatTransport, type CoachChatTransport } from './coachChatTransport';

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
  /** Streaming reader (R-399); the default reads incrementally on the phone and in node. */
  readonly transport?: CoachChatTransport;
  /**
   * The message so far, each time more words arrive and the word gates still
   * hold on the text so far. The final, checked answer is the promise's
   * value; if the check fails the promise rejects and the caller withdraws
   * what it showed (R-399).
   */
  readonly onDelta?: (messageSoFar: string) => void;
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

/** The refused checks' NAMES, for the log; never the athlete's words. */
function serverViolations(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { violations?: unknown; details?: unknown };
    const names = Array.isArray(parsed.violations) ? parsed.violations.map(String).join(', ') : 'unnamed';
    const details = parsed.details && typeof parsed.details === 'object'
      ? Object.entries(parsed.details as Record<string, unknown>).map(([key, value]) => `${key}=${String(value)}`).join('; ')
      : '';
    return details ? `${names}: ${details}` : names;
  } catch {
    return 'unnamed';
  }
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
  const modelInput = buildCoachModelInput({
    athleteMessage: input.message,
    snapshot: input.snapshot,
    conversationContext: input.conversationContext,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000);
  // R-399: the words are read as they arrive. Each line of the stream carries
  // the message so far; it is forwarded only while every word gate holds on
  // that text, and the promise settles on the final line.
  const facts = coachResponseGroundingFacts(modelInput.currentAthleteSnapshot, COACH_APP_DOOR_LABELS);
  let forwarding = true;
  let lastForwarded = '';
  const readSoFar = (textSoFar: string): void => {
    if (!input.onDelta || !forwarding) return;
    // Every 'm' line carries the WHOLE message so far, so only the newest
    // one matters; older lines were forwarded when they were newest.
    const { lines } = parseCoachChatStream(textSoFar);
    const newest = [...lines].reverse().find((line): line is Extract<CoachChatStreamLine, { t: 'm' }> => line.t === 'm');
    if (!newest || newest.text === lastForwarded) return;
    if (!wordGatesHold(newest.text, facts)) {
      forwarding = false;
      return;
    }
    lastForwarded = newest.text;
    input.onDelta(newest.text);
  };
  const url = `${config.supabaseFunctionsBaseUrl}/coach-chat`;
  const init = {
    method: 'POST' as const,
    headers: {
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      apikey: config.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify({ modelInput }),
  };
  let status: number;
  let contentType: string | null = null;
  let raw: string;
  try {
    if (input.fetch) {
      const response = await input.fetch(url, init);
      status = response.status;
      raw = await response.text();
      readSoFar(raw);
    } else {
      const result = await (input.transport ?? defaultCoachChatTransport())(url, init, readSoFar);
      status = result.status;
      contentType = result.contentType;
      raw = result.text;
    }
  } catch {
    throw new CoachChatError('unavailable', 'Coach chat request could not reach the server.');
  } finally {
    clearTimeout(timeout);
  }

  if (status < 200 || status >= 300) {
    const serverCode = serverFailureCode(raw);
    if (serverCode === 'coach_chat_response_refused') {
      throw new CoachChatError('refused', `Coach chat refused an unsafe answer (${serverViolations(raw)}).`);
    }
    if (serverCode === 'coach_chat_invalid_answer') {
      throw new CoachChatError('no_answer', 'Coach chat returned no usable answer.');
    }
    if (serverCode === 'coach_chat_contract_mismatch') {
      // Not a refusal and not the athlete's question: the app and the server
      // speak different contracts. The unavailable sentence is the honest one
      // of the three signed sentences (R-140); the versions go to the log.
      console.warn('[coach-chat] contract mismatch: app speaks', modelInput.contractVersion, 'server answered', raw.slice(0, 120));
      throw new CoachChatError('unavailable', 'Coach chat contract mismatch.');
    }
    throw new CoachChatError('unavailable', `Coach chat unavailable (${status}).`);
  }
  let payload: { message?: unknown; programActions?: unknown };
  if (isCoachChatStream(contentType, raw)) {
    const { lines } = parseCoachChatStream(raw);
    const terminal = [...lines].reverse().find((line): line is Exclude<CoachChatStreamLine, { t: 'open' } | { t: 'm' }> =>
      line.t === 'final' || line.t === 'refused' || line.t === 'error');
    if (!terminal) {
      throw new CoachChatError('unavailable', 'Coach chat stream ended without an answer.');
    }
    if (terminal.t === 'error') {
      throw new CoachChatError('unavailable', `Coach chat unavailable (${terminal.error}).`);
    }
    if (terminal.t === 'refused') {
      const detail = `${terminal.violations.join(', ')}${terminal.details && Object.keys(terminal.details).length > 0
        ? `: ${Object.entries(terminal.details).map(([key, value]) => `${key}=${value}`).join('; ')}`
        : ''}`;
      if (terminal.error === 'coach_chat_invalid_answer') {
        throw new CoachChatError('no_answer', `Coach chat returned no usable answer (${detail}).`);
      }
      throw new CoachChatError('refused', `Coach chat refused an unsafe answer (${detail}).`);
    }
    payload = { message: terminal.message, programActions: terminal.programActions };
  } else {
    try {
      payload = JSON.parse(raw) as { message?: unknown; programActions?: unknown };
    } catch {
      throw new CoachChatError('no_answer', 'Coach chat returned an unreadable answer.');
    }
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
  if (!readinessClaimGrounded(message, facts)
    || !fixtureClaimGrounded(message, facts)
    || !phaseClaimGrounded(message, facts)) {
    throw new CoachChatError('refused', 'Coach chat refused an answer that contradicts the athlete snapshot.');
  }
  return message;
}
