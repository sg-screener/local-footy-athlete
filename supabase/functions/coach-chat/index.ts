import { buildRetrievedCoachLabBrainInstructions } from '../../../src/dev/coachLab/coachLabBrainPack.ts';
import { retrieveCoachLabKnowledge } from '../../../src/dev/coachLab/coachLabKnowledgeRetriever.ts';
import { OpenAIResponsesClient } from '../../../src/dev/coachLab/openAIResponsesClient.ts';
import { CANONICAL_COACH_KNOWLEDGE } from './canonicalCoachKnowledge.generated.ts';

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

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface RuntimeCoachSnapshot {
  readonly asOfDateISO: string;
  readonly readiness: unknown;
  readonly restrictions: unknown;
  readonly load: unknown;
  readonly progress: unknown;
  readonly visibleWeek: {
    readonly days: readonly {
      readonly kind: string;
      readonly headline: unknown;
      readonly parts: readonly { readonly kind: string; readonly headline: unknown }[];
    }[];
  };
}

function validSnapshot(value: unknown): value is RuntimeCoachSnapshot {
  if (!record(value) || typeof value.asOfDateISO !== 'string' || !record(value.visibleWeek)) {
    return false;
  }
  const days = value.visibleWeek.days;
  return Array.isArray(days) && days.every((day) => record(day)
    && typeof day.kind === 'string'
    && Array.isArray(day.parts)
    && day.parts.every((part) => record(part) && typeof part.kind === 'string'));
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
    && value.athleteMessage.length <= 1_000
    && validSnapshot(snapshot)
    && record(conversation)
    && Array.isArray(conversation.recentTurns)
    && conversation.recentTurns.length <= 6
    && conversation.recentTurns.every((turn) => record(turn)
      && (turn.speaker === 'coach' || turn.speaker === 'athlete')
      && typeof turn.text === 'string'
      && turn.text.length <= 1_000);
}

function parseReadOnlyPayload(outputText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(outputText) as Record<string, unknown>;
    return record(parsed)
      && typeof parsed.message === 'string'
      && Array.isArray(parsed.programActions)
      && parsed.programActions.length === 0
      ? parsed
      : null;
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
    || /\"(?:email|userId|athleteId|accountId)\"\s*:/i.test(raw)) {
    return json(400, { error: 'invalid_coach_chat_request' });
  }

  const modelInput = body.modelInput;
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
    const payload = parseReadOnlyPayload(result.outputText);
    if (!payload) return json(502, { error: 'coach_chat_invalid_answer' });
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
