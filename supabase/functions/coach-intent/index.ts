/**
 * coach-intent edge function — LLM-backed implementation of the
 * `CoachIntentClassifier` interface defined in
 * `src/utils/coachIntent.ts`.
 *
 *   POST /coach-intent
 *   Body: { packet: <serialised CoachContextPacket JSON string>,
 *           message: <user message string> }
 *   200:  { intent, confidence, needsClarification, ... }   (CoachIntent)
 *   400:  { error }                                          (bad request)
 *   500:  { error }                                          (server / API key missing)
 *   502:  { error, raw }                                     (upstream model error)
 *
 * The function is INTENTIONALLY THIN. It does not mutate program state,
 * does not write a database row, does not return a final user message —
 * it only classifies. The dispatcher in CoachScreen consumes the JSON
 * and routes to deterministic engines that own the program mutation.
 *
 * The system prompt + intent kinds are mirrored from
 * `src/utils/coachIntent.ts`. Deno can't import from src/, so the
 * prompt is inlined here. KEEP IN SYNC with that file.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// KEEP IN SYNC with src/utils/coachIntent.ts (COACH_INTENT_SYSTEM_PROMPT).
const COACH_INTENT_SYSTEM_PROMPT = `You are the intent classifier for a strength coach app.

Your job is to read the athlete's latest message + the surrounding context and return a JSON object that matches this schema:

{
  "intent": "<one of: new_injury_report | injury_severity_reply | active_injury_followup | why_didnt_program_change | request_program_adjustment | fatigue | missed_session | exercise_swap | general_question>",
  "confidence": <0..1>,
  "needsClarification": <boolean>,
  "clarificationQuestion": "<string if needsClarification>",
  "payload": {
    "bodyPart": "<optional, free-text>",
    "severity": <optional, 1..10>,
    "requestedDate": "<optional, YYYY-MM-DD>",
    "requestedSession": "<optional>",
    "concern": "<optional, free-text>",
    "followupKind": "<optional: resolved | improving | worsening | unchanged>"
  },
  "rationale": "<one sentence>"
}

CRITICAL RULES

1. If \`activeInjury\` is set in context AND the message references the same body part (or no specific body part), DO NOT classify as new_injury_report. Use active_injury_followup or why_didnt_program_change.

2. If \`activeInjury\` is set and the user just gives a number ("4/10"), this is injury_severity_reply with payload.severity (interpret as the new severity for the EXISTING injury).

3. Severity clarification (needsClarification=true with "How bad is it?") is ONLY appropriate when:
   - no activeInjury exists, AND
   - the user is reporting a NEW injury, AND
   - severity is missing.
   Never ask severity if activeInjury.severity is already set unless the user explicitly reports a different injury.

4. "why didn't X change?" / "why are deadlifts still there?" / "should I still train?" → why_didnt_program_change. Do not classify as a new request unless it's clear they want a NEW change.

5. Different body part with activeInjury → may be a NEW injury — classify as new_injury_report (the dispatcher will handle the severity clarifier flow if needed).

6. Output VALID JSON only. No prose. No markdown.`;

const VALID_INTENTS = new Set([
  "new_injury_report",
  "injury_severity_reply",
  "active_injury_followup",
  "why_didnt_program_change",
  "request_program_adjustment",
  "fatigue",
  "missed_session",
  "exercise_swap",
  "general_question",
]);

interface CoachIntent {
  intent: string;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  payload?: Record<string, unknown>;
  rationale?: string;
}

function parseCoachIntent(raw: unknown): CoachIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.intent !== "string" || !VALID_INTENTS.has(r.intent)) return null;
  const confidence =
    typeof r.confidence === "number" ? r.confidence : 0.5;
  const needsClarification = !!r.needsClarification;
  const out: CoachIntent = {
    intent: r.intent,
    confidence,
    needsClarification,
  };
  if (typeof r.clarificationQuestion === "string") {
    out.clarificationQuestion = r.clarificationQuestion;
  }
  if (r.payload && typeof r.payload === "object") {
    out.payload = r.payload as Record<string, unknown>;
  }
  if (typeof r.rationale === "string") {
    out.rationale = r.rationale;
  }
  return out;
}

const ALLOWED_ORIGINS = new Set<string>(); // tighten in prod; * for now
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, x-client-info, apikey",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  let body: { packet?: string; message?: string };
  try {
    body = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  const packet = typeof body.packet === "string" ? body.packet : null;
  const message = typeof body.message === "string" ? body.message : null;
  if (!packet || !message) {
    return new Response(
      JSON.stringify({ error: "missing 'packet' or 'message'" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Compose the user turn the model sees: the latest message followed
  // by the structured context. The system prompt instructs JSON-only
  // output. We extract the first JSON object from the response text.
  const userBlock = `MESSAGE:\n${message}\n\nCONTEXT (JSON):\n${packet}`;

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: COACH_INTENT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userBlock }],
      }),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "upstream fetch failed",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(
      JSON.stringify({ error: "upstream HTTP error", status: upstream.status, detail: errText.slice(0, 500) }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const data = await upstream.json();
  const text: string = data?.content?.[0]?.text?.trim?.() ?? "";

  // Permissive JSON extraction — model occasionally wraps in fences /
  // adds whitespace despite the prompt. Pick the first {...} block.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) {
    return new Response(
      JSON.stringify({ error: "no JSON in model response", raw: text.slice(0, 500) }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(m[0]);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "JSON parse failed",
        detail: err instanceof Error ? err.message : String(err),
        raw: m[0].slice(0, 500),
      }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const intent = parseCoachIntent(parsed);
  if (!intent) {
    return new Response(
      JSON.stringify({ error: "intent failed schema validation", raw: parsed }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  return new Response(JSON.stringify(intent), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
});
