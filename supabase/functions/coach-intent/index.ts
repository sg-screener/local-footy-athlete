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

type CoachLLMProvider = "openai" | "anthropic";

function normalizeCoachProvider(raw: string | undefined | null): CoachLLMProvider | null {
  const value = raw?.trim().toLowerCase();
  if (value === "openai") return "openai";
  if (value === "anthropic" || value === "claude") return "anthropic";
  return null;
}

function resolveCoachProvider(): CoachLLMProvider {
  const configured = normalizeCoachProvider(Deno.env.get("COACH_LLM_PROVIDER"));
  if (configured) return configured;
  return Deno.env.get("OPENAI_API_KEY") ? "openai" : "anthropic";
}

function getOpenAIIntentModel(): string {
  return Deno.env.get("COACH_INTENT_LLM_MODEL") ||
    Deno.env.get("COACH_LLM_FAST_MODEL") ||
    "gpt-5.4-mini";
}

function getAnthropicIntentModel(): string {
  return Deno.env.get("ANTHROPIC_INTENT_MODEL") || "claude-haiku-4-5-20251001";
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const parts: string[] = [];
  for (const item of data?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
      if (typeof content?.refusal === "string") parts.push(content.refusal);
    }
  }
  return parts.join("\n").trim();
}

// KEEP IN SYNC with src/utils/coachIntent.ts (COACH_INTENT_SYSTEM_PROMPT).
const COACH_INTENT_SYSTEM_PROMPT = `You are the intent classifier for a strength coach app.

Your job is to read the athlete's latest message + the surrounding context and return a JSON object that matches this schema:

{
  "intent": "<one of: new_injury_report | injury_severity_reply | active_injury_followup | temporary_source_fact_followup | why_didnt_program_change | program_explanation | session_mismatch_question | request_program_adjustment | record_session_outcome | fatigue | soreness | poor_sleep | mixed_fact_and_program_adjustment | busy_week | equipment_change | exercise_swap | general_question>",
  "confidence": <0..1>,
  "needsClarification": <boolean>,
  "clarificationQuestion": "<string if needsClarification>",
  "payload": {
    "bodyPart": "<optional, free-text>",
    "severity": <optional, 1..10>,
    "requestedDate": "<optional, YYYY-MM-DD>",
    "requestedSession": "<optional>",
    "concern": "<optional, free-text>",
    "followupKind": "<optional: resolved | improving | worsening | unchanged>",
    "factKind": "<optional: fatigue | soreness | poor_sleep | equipment | schedule | time_cap>",
    "operation": "<for program edits: add_conditioning | remove_conditioning | replace_conditioning | move_session | replace_exercise | change_duration>",
    "targetDate": "<optional, YYYY-MM-DD>",
    "targetSessionName": "<optional>",
    "activity": "<new activity to add, preserve exact terms like HIIT rowing intervals, hard hill running, Pilates, assault bike sprints>",
    "replaceActivity": "<existing activity being replaced, e.g. Pilates>",
    "durationMinutes": <optional number>,
    "durationSeconds": <optional number, for sprint/effort reps>,
    "maxSessionsThisWeek": <optional number>,
    "equipmentMode": "<optional: only | without>",
    "equipmentTags": ["<optional canonical equipment tags>"],
    "conditioningModalities": ["<optional: bike | row | ski | treadmill>"],
    "equipmentChangeScope": "<optional: temporary | baseline>",
    "sets": <optional number>,
    "repsMin": <optional number>,
    "repsMax": <optional number>,
    "modality": "<optional: bike | row | run | walk | ski | swim | cardio | aerobic | sprint>",
    "intensity": "<optional: light | moderate | hard>",
    "bikeLabel": "<optional: standard | assault>",
    "effortKind": "<optional: sprint | interval>",
    "trainingIntent": "<optional: hiit | sprint | tempo | aerobic | low_load>",
    "changeKind": "<optional: modality | training_intent | modality_and_training_intent>",
    "scope": "<optional: one_off | this_week | recurring | permanent>",
    "completion": "<for record_session_outcome: full | partial | skipped>",
    "feeling": "<optional: very_easy | easy | good | hard | very_hard>",
    "soreness": "<optional: none | mild | moderate | high>",
    "partialReason": "<optional: ran_out_of_time | felt_sore_tight | too_hard_today | equipment_unavailable | other>",
    "skipReason": "<optional: busy_no_time | sore_tight | injured_niggle | sick_low_energy | didnt_feel_like_it | equipment_unavailable | other>",
    "componentOutcomes": [{ "kind": "<stable component kind such as strength or conditioning>", "completion": "<full | partial | skipped>", "reason": "<optional reason>" }]
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

6. Programming rationale and session naming/display mismatch questions are NOT injuries. Classify as program_explanation or session_mismatch_question, never new_injury_report:
   - "why did you put a mid week row in?"
   - "why is there a row on Wednesday?"
   - "why am I rowing instead of running?"
   - "why is this a zone 2 row?"
   - "upper pull", "pull day", "pull session", "push/pull", "upper/lower" are training terms unless paired with explicit injury language.
   - "why is upper pull on Wednesday a rowing session?"
   - "why do I have upper pull listed as Wednesday but it opens as rowing?"
   - "why does Wednesday say X but open as Y?"
   - "session mismatch", "rowing session"
   Only ask pain out of 10 when explicit pain/injury words are present: pain, hurt, sore, soreness, strain, injured, tight, tweaked, pulled my hamstring/back/groin.

7. Non-injury signals — disambiguate carefully:
   - "fatigue" — global tired / cooked / drained / smashed without specific body part ("feeling cooked this week", "exhausted"). Estimate severity 1..10 from intensity language.
   - "soreness" — localised muscle soreness, NOT injury-level pain ("quads are sore", "tight calves", "DOMS"). payload.bodyPart is required. Severity 1..10 from descriptors.
   - "busy_week" — schedule constraint: limited time / capacity ("crazy week ahead", "can only train twice", "exam week"). Set payload.severity=5 by default. If an exact bounded weekly maximum is stated, set payload.maxSessionsThisWeek.
   - "equipment_change" — exact available/unavailable equipment. Set payload.equipmentMode="only" or "without", payload.equipmentTags using canonical tags (bodyweight, dumbbells, barbell, cables, bands, bench, pullup_bar, kettlebell, machine, bike_or_treadmill), and payload.equipmentChangeScope="temporary" for bounded/current-week limits or "baseline" for permanent equipment settings. Preserve exact conditioning modality terms in payload.conditioningModalities.
   - A factual clear report ("my equipment is available again", "my schedule is back to normal", "the time restriction is over") is temporary_source_fact_followup with followupKind="resolved" and the exact factKind.
   - "record_session_outcome" — a report about work that already happened: completed, partial, missed/skipped attendance, or how a completed/recent session felt. Capture target, completion, feeling, soreness, reason, and component outcomes.
   - "I missed it" is record_session_outcome with completion="skipped". It is attendance feedback, not a schedule constraint and not a delete/move request.
   - "It was too hard" about a completed or recent session is record_session_outcome. "Make it easier" is a future request_program_adjustment.
   - Post-session soreness belongs in record_session_outcome; equipment_unavailable as an outcome reason is feedback, not a new constraint.

8. Program adjustment requests:
   - "add conditioning to Monday", "chuck some HIIT rowing intervals on Tuesday", "slot in a rower session Friday", "remove conditioning from Friday", "can we move Monday" → request_program_adjustment.
   - If pendingCoachProposal is set and the user says "sounds good", "yes", "do it", or similar confirmation, classify as request_program_adjustment, not general_question.
   - For supported edits, fill the structured edit fields in payload. Preserve the athlete's actual requested activity words. "HIIT rowing intervals" must not become "row"; "assault bike sprints" must not become "bike intervals"; "hard hill running" must not become "run".
   - If the athlete asks for HIIT/high-intensity intervals on a named modality and gives a day, do not ask for the prescription unless they explicitly want custom work/rest. Use operation="add_conditioning", activity with their exact phrase, modality, intensity="hard", effortKind="interval".
   - If the athlete changes only the modality of a recent add-on ("make them SkiErg", "can that be bike instead"), preserve the source training intent. HIIT rowing intervals → HIIT SkiErg intervals, not easy SkiErg. Return operation="change_modality", replaceActivity=<old title>, activity=<new title>, trainingIntent=<preserved intent>, changeKind="modality".
   - If the athlete changes only the training quality ("make it HIIT", "make that recovery"), preserve the modality and return changeKind="training_intent".
   - If the user says "X instead of Y", use operation="replace_conditioning", activity="X", replaceActivity="Y".
   - If the user asks to make an existing add-on longer/shorter or a specific duration, use operation="change_duration", activity if known, and durationMinutes if stated. For sprint/effort work, use durationSeconds or repsMin/repsMax when seconds are requested.
   - Pronouns like "it", "them", "that", "those" usually refer to packet.lastMutation.touchedActivities[0] first, then recentMessages/context. Preserve that activity title and target date when filling payload.
   - If the date/session or activity is missing, set needsClarification=true and ask the smallest useful question.
   - You only classify/structure intent. The app will apply or reject deterministic supported edits.

9. Output VALID JSON only. No prose. No markdown.`;

const VALID_INTENTS = new Set([
  "new_injury_report",
  "injury_severity_reply",
  "active_injury_followup",
  "temporary_source_fact_followup",
  "why_didnt_program_change",
  "program_explanation",
  "session_mismatch_question",
  "request_program_adjustment",
  "fatigue",
  "soreness",
  "poor_sleep",
  "mixed_fact_and_program_adjustment",
  "busy_week",
  "equipment_change",
  "record_session_outcome",
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

  const provider = resolveCoachProvider();
  const apiKey = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    const envName = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    return new Response(
      JSON.stringify({ error: `${envName} not configured` }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Compose the user turn the model sees: the latest message followed
  // by the structured context. The system prompt instructs JSON-only
  // output. We extract the first JSON object from the response text.
  const userBlock = `MESSAGE:\n${message}\n\nCONTEXT (JSON):\n${packet}`;

  let upstream: Response;
  try {
    upstream = provider === "openai"
      ? await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getOpenAIIntentModel(),
          instructions: COACH_INTENT_SYSTEM_PROMPT,
          input: [{ role: "user", content: userBlock }],
          max_output_tokens: 900,
        }),
      })
      : await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: getAnthropicIntentModel(),
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
  const text: string = provider === "openai"
    ? extractOpenAIText(data)
    : data?.content?.[0]?.text?.trim?.() ?? "";

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
