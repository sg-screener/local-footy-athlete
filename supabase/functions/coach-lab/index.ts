import { OpenAIResponsesClient } from '../../../src/dev/coachLab/openAIResponsesClient.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const ALLOWED_MODELS = new Set(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']);
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json(200, { ok: true });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (Deno.env.get('COACH_LAB_ENABLED') !== 'true') {
    return json(503, { error: 'coach_lab_disabled' });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  if (typeof body.model !== 'string'
    || !ALLOWED_MODELS.has(body.model)
    || typeof body.instructions !== 'string'
    || typeof body.input !== 'string'
    || body.instructions.length > 1_500_000
    || body.input.length > 100_000) {
    return json(400, { error: 'invalid_coach_lab_request' });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  try {
    const client = new OpenAIResponsesClient({ apiKey });
    const result = await client.create({
      model: body.model,
      instructions: body.instructions,
      input: body.input,
    });
    return json(200, result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('coach-lab request failed', detail);
    return json(502, { error: 'coach_lab_provider_failed' });
  }
});
