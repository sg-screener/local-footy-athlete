import { buildRetrievedCoachLabBrainInstructions } from '../../../src/dev/coachLab/coachLabBrainPack.ts';
import { retrieveCoachLabKnowledge } from '../../../src/dev/coachLab/coachLabKnowledgeRetriever.ts';
import { OpenAIResponsesClient } from '../../../src/dev/coachLab/openAIResponsesClient.ts';
import { CANONICAL_COACH_KNOWLEDGE } from './canonicalCoachKnowledge.generated.ts';
import {
  coachResponseContractFailureCode,
  coachResponseGroundingFacts,
  evaluateCoachResponseContract,
} from '../../../src/rules/coachResponseContract.ts';
import type { CoachModelSnapshot } from '../../../src/rules/coachModelContext.ts';
import { COACH_CHAT_CONTRACT_VERSION, COACH_CHAT_MAX_MESSAGE_CHARACTERS } from '../../../src/rules/coachChatLimits.ts';
import {
  checkDurableCoachRateLimit,
  forwardedClientAddress,
  opaqueClientRateLimitKey,
} from '../_shared/durableCoachRateLimit.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const COACH_CHAT_MODEL = 'gpt-5.6-terra';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_CLIENT_MAX = 20;
const RATE_LIMIT_GLOBAL_MAX = 200;

function json(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validSnapshot(value: unknown): value is CoachModelSnapshot {
  if (!record(value) || typeof value.asOfDateISO !== 'string' || !record(value.visibleWeek)) {
    return false;
  }
  const days = value.visibleWeek.days;
  const fixtures = value.visibleWeek.fixtures;
  return Array.isArray(days) && days.every((day) => record(day)
    && typeof day.kind === 'string'
    && Array.isArray(day.parts)
    && day.parts.every((part) => record(part) && typeof part.kind === 'string'))
    // The grounding facts the answer is checked against (F14, 2026-09-09).
    && Array.isArray(fixtures)
    && fixtures.every((fixture) => record(fixture) && typeof fixture.weekday === 'string')
    && record(value.readiness)
    && typeof value.readiness.reported === 'boolean'
    // Where the athlete is in the year (R-397, 2026-09-10): the block is
    // required; `season` inside it may be null when the app cannot say.
    && record(value.situation)
    && (value.situation.season === null
      || (record(value.situation.season) && typeof value.situation.season.phase === 'string'));
}

function validModelInput(value: unknown): value is {
  athleteMessage: string;
  currentAthleteSnapshot: RuntimeCoachSnapshot;
  conversationContext: {
    recentTurns: readonly unknown[];
    activeProgramTarget: unknown;
  };
} {
  if (!record(value)) return false;
  const snapshot = value.currentAthleteSnapshot;
  const conversation = value.conversationContext;
  return typeof value.athleteMessage === 'string'
    && value.athleteMessage.trim().length > 0
    && value.athleteMessage.length <= COACH_CHAT_MAX_MESSAGE_CHARACTERS
    && validSnapshot(snapshot)
    && record(conversation)
    && Array.isArray(conversation.recentTurns)
    && conversation.recentTurns.length <= 6
    && conversation.recentTurns.every((turn) => record(turn)
      && (turn.speaker === 'coach' || turn.speaker === 'athlete')
      && typeof turn.text === 'string'
      && turn.text.length <= COACH_CHAT_MAX_MESSAGE_CHARACTERS);
}

function parseCoachPayload(outputText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(outputText) as unknown;
    return record(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json(200, { ok: true });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (Deno.env.get('COACH_CHAT_ENABLED') !== 'true') {
    return json(503, { error: 'coach_chat_disabled' });
  }
  const forwardedAddress = forwardedClientAddress(request);
  if (forwardedAddress === null) {
    return json(503, { error: 'coach_chat_rate_limit_unavailable' });
  }
  let rateLimit;
  try {
    const clientKey = await opaqueClientRateLimitKey(
      forwardedAddress,
      Deno.env.get('COACH_RATE_LIMIT_SECRET') ?? '',
    );
    rateLimit = await checkDurableCoachRateLimit({
      clientKey,
      supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      clientMaxRequests: RATE_LIMIT_CLIENT_MAX,
      globalMaxRequests: RATE_LIMIT_GLOBAL_MAX,
    });
  } catch {
    console.error('coach-chat durable rate limit unavailable');
    return json(503, { error: 'coach_chat_rate_limit_unavailable' });
  }
  if (!rateLimit.allowed) {
    return json(429, { error: 'coach_chat_rate_limited' }, {
      'Retry-After': String(rateLimit.retryAfterSeconds),
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const raw = JSON.stringify(body);
  if (Object.keys(body).length !== 1
    || !validModelInput(body.modelInput)
    || raw.length > 120_000
    || /\"(?:email|userId|athleteId|accountId|name)\"\s*:/i.test(raw)) {
    return json(400, { error: 'invalid_coach_chat_request' });
  }

  const modelInput = body.modelInput;
  // The app names the contract it speaks (slice S2). A mismatch is told
  // apart from a refusal so the athlete is never handed a safety sentence
  // for what is an update problem.
  const clientVersion = (modelInput as { contractVersion?: unknown }).contractVersion;
  if (clientVersion !== COACH_CHAT_CONTRACT_VERSION) {
    return json(409, {
      error: 'coach_chat_contract_mismatch',
      serverContractVersion: COACH_CHAT_CONTRACT_VERSION,
    });
  }
  const retrieval = retrieveCoachLabKnowledge({
    athleteMessage: modelInput.athleteMessage,
    snapshot: modelInput.currentAthleteSnapshot,
    sources: CANONICAL_COACH_KNOWLEDGE,
  });
  const instructions = buildRetrievedCoachLabBrainInstructions(retrieval.chunks);
  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  try {
    const result = await new OpenAIResponsesClient({ apiKey }).create({
      model: COACH_CHAT_MODEL,
      instructions,
      input: JSON.stringify(modelInput),
    });
    const payload = parseCoachPayload(result.outputText);
    if (!payload) return json(502, { error: 'coach_chat_invalid_answer' });
    const evaluation = evaluateCoachResponseContract(payload, {
      requiresLiveProgramFacts: true,
      allowedKnowledgeSourceIds: retrieval.chunks.map((chunk) => chunk.id),
      facts: coachResponseGroundingFacts(modelInput.currentAthleteSnapshot),
    });
    const failureCode = coachResponseContractFailureCode(evaluation);
    if (failureCode !== null) {
      console.warn('coach-chat response rejected by contract', evaluation.violations);
      return json(502, {
        error: failureCode === 'invalid_answer'
          ? 'coach_chat_invalid_answer'
          : 'coach_chat_response_refused',
      });
    }
    console.log('coach-chat token receipt', JSON.stringify(result.tokenReceipt));
    return json(200, {
      message: payload.message,
      answerMode: payload.answerMode,
      programActions: payload.programActions,
    });
  } catch (error) {
    console.error('coach-chat provider failure', error instanceof Error ? error.message : 'unknown');
    return json(502, { error: 'coach_chat_provider_failed' });
  }
});
