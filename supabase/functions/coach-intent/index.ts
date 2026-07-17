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
import {
  INJURY_EPISODE_PROMPT_CONTRACT,
  parseInjuryEpisodeIntent,
} from "../shared/coachInjuryIntentContract.ts";

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
  "intent": "<one of: new_injury_report | injury_severity_reply | active_injury_followup | temporary_source_fact_followup | why_didnt_program_change | program_explanation | session_mismatch_question | request_program_adjustment | record_session_outcome | fixture_change | fatigue | soreness | poor_sleep | mixed_fact_and_program_adjustment | busy_week | equipment_change | exercise_swap | general_question>",
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
    "operation": "<for program edits: add_conditioning | remove_session | remove_conditioning | replace_conditioning | move_session | replace_exercise | change_duration>",
    "action": "<for fixture_change: add | move | remove>",
    "sourceDate": "<optional fixture source, YYYY-MM-DD>",
    "targetDate": "<optional, YYYY-MM-DD>",
    "explicitFixtureKind": "<optional for fixture_change: game | practice_match; include only when the athlete explicitly says that kind>",
    "missingFields": ["<for incomplete fixture clarification: action | targetDate>"],
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
    "factKind": "<optional: fatigue | soreness | poor_sleep | equipment | schedule | time_cap>",
    "reportKind": "<for fatigue facts: fatigue | cooked>",
    "sorenessDistribution": "<localized | general>",
    "poorSleepPattern": "<single_night | repeated>",
    "reportedLevelIsExplicit": <optional boolean; true only when the athlete explicitly stated the numeric level>,
    "completion": "<for record_session_outcome: full | partial | skipped>",
    "feeling": "<optional: very_easy | easy | good | hard | very_hard>",
    "soreness": "<optional: none | mild | moderate | high>",
    "partialReason": "<optional: ran_out_of_time | felt_sore_tight | too_hard_today | equipment_unavailable | other>",
    "skipReason": "<optional: busy_no_time | sore_tight | injured_niggle | sick_low_energy | didnt_feel_like_it | equipment_unavailable | other>",
    "componentOutcomes": [{ "kind": "<stable component kind such as strength or conditioning>", "completion": "<full | partial | skipped>", "reason": "<optional reason>" }]
  },
  "rationale": "<one sentence>"
}

${INJURY_EPISODE_PROMPT_CONTRACT}

CRITICAL RULES

1. \`acceptedInjuryContext.activeEpisodes\` is the authoritative injury context. \`activeInjury\` is compatibility-only and must not be used as the source of truth. If the message references the same body part as an accepted active episode, DO NOT classify it as new_injury_report. Use active_injury_followup or why_didnt_program_change.

2. If exactly one accepted active episode is the available target and the user just gives a number ("4/10"), this is injury_severity_reply with payload.severity (interpret it as the new severity for that EXISTING episode). If more than one episode could be the target, preserve the injury intent and let the app clarify the target.

3. Severity clarification (needsClarification=true with "How bad is it?") is ONLY appropriate when:
   - no accepted active episode matches the reported body part, AND
   - the user is reporting a NEW injury, AND
   - severity is missing.
   Missing severity is a valid injury classification, not schema failure. Never ask severity for an accepted existing episode unless the athlete is reporting a severity change or answering a severity question.

4. "why didn't X change?" / "why are deadlifts still there?" / "should I still train?" → why_didnt_program_change. Do not classify as a new request unless it's clear they want a NEW change.

5. A body part different from every accepted active episode may be a NEW injury — classify as new_injury_report. A new injury report remains new_injury_report even when a similar accepted episode exists; the app owns target resolution.

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
   - "fatigue" — global tired / cooked / drained / smashed without specific body part ("feeling cooked this week", "exhausted"). Set reportKind="cooked" for cooked language. Only set numeric severity when the athlete explicitly reports a number, and then set reportedLevelIsExplicit=true.
   - "soreness" — localised or general muscle soreness, NOT injury-level pain ("quads are sore", "tight calves", "DOMS"). Preserve payload.bodyPart exactly when localised. Only set numeric severity when the athlete explicitly reports a number, and then set reportedLevelIsExplicit=true.
   - "poor_sleep" — a factual report about sleep ("I slept badly"). Use poorSleepPattern="single_night" unless repeated nights are explicit. Only set numeric severity with reportedLevelIsExplicit=true when the athlete stated that number.
   - "busy_week" — schedule constraint: limited time / capacity ("crazy week ahead", "can only train twice", "exam week"). Set payload.severity=5 by default. If the athlete states an exact bounded weekly maximum, set payload.maxSessionsThisWeek.
   - "equipment_change" — exact available/unavailable equipment. Set payload.equipmentMode="only" or "without", payload.equipmentTags using canonical tags (bodyweight, dumbbells, barbell, cables, bands, bench, pullup_bar, kettlebell, machine, bike_or_treadmill), and payload.equipmentChangeScope="temporary" for bounded/current-week limits or "baseline" for permanent equipment settings. Preserve exact conditioning modality terms in payload.conditioningModalities (bike, row, ski, treadmill).
   - "record_session_outcome" — a report about work that already happened: completed, partial, missed/skipped attendance, or how a completed/recent session felt. Capture payload.requestedDate/targetSessionName, completion, feeling, soreness, reasons and componentOutcomes.
   - "I missed it" means record_session_outcome with completion="skipped". It is attendance feedback, not a schedule constraint and not a delete/move request.
   - "It was too hard" about a completed or recent session means record_session_outcome with feeling="hard" or "very_hard". If no partial/skip language exists, use completion="full".
   - "Make it easier" is a future request_program_adjustment, never session feedback.
   - Factual state and imperative programming are different: "I feel fatigued" is fatigue; "I'm cooked this week" is a fatigue fact with reportKind="cooked" and scope="this_week"; "Make this week lighter" and "Reduce my strength work" are request_program_adjustment.
   - If one message contains both a factual report and an explicit command (for example "I'm cooked, make this week lighter"), use mixed_fact_and_program_adjustment, set factKind and all fact fields, and also populate the structured program-edit fields. The app will apply one fact and one exact reversible edit without treating the fact as a second percentage edit.
   - A factual recovery/clear report ("my calves aren't sore now", "I slept well last night", "I'm not fatigued anymore", "my equipment is available again", "my schedule is back to normal") is temporary_source_fact_followup with followupKind="resolved" and factKind. Include bodyPart for soreness. Use factKind="equipment", "schedule", or "time_cap" for those exact temporary restrictions. Do not classify it as a new report or a generic command.
   - General post-session soreness belongs in record_session_outcome.soreness; only classify injury/soreness constraint intent when the athlete reports a current health issue that should change future training.
   - equipment_unavailable as an outcome reason remains feedback; it is not an equipment constraint.

8. Fixture changes:
   - Adding, moving, rescheduling, or removing a game or practice match is fixture_change. Use payload.action and ISO dates; do not encode fixture changes as request_program_adjustment.
   - A missed game or practice-match report about what already happened is record_session_outcome with completion="skipped", never fixture_change.
   - Moving a workout, strength session, conditioning session, or team-training session is request_program_adjustment, never fixture_change.
   - Set explicitFixtureKind only when the athlete explicitly says "game" or "practice match". It is a conflict signal; the app derives the canonical kind from accepted phase state.
   - add requires targetDate and forbids sourceDate. move requires targetDate and may include sourceDate. remove may include sourceDate and forbids targetDate. Never reinterpret add as move.
   - If action or a required targetDate is missing, set needsClarification=true, ask the smallest useful question, and include payload.missingFields. Do not invent or coerce a date.

9. Program adjustment requests:
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

10. Output VALID JSON only. No prose. No markdown.`;

const VALID_COACH_INTENTS = new Set([
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
  "fixture_change",
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

type FixtureChangeAction = "add" | "move" | "remove";
type FixtureExplicitKind = "game" | "practice_match";
type FixtureChangeMissingField = "action" | "targetDate";

interface FixtureChangePayload {
  action?: FixtureChangeAction;
  sourceDate?: string;
  targetDate?: string;
  explicitFixtureKind?: FixtureExplicitKind;
  missingFields?: FixtureChangeMissingField[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function parseFixtureChangePayload(
  value: unknown,
  needsClarification: boolean,
): FixtureChangePayload | null {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set([
    "action",
    "sourceDate",
    "targetDate",
    "explicitFixtureKind",
    "missingFields",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  const action = value.action;
  if (action !== undefined && action !== "add" && action !== "move" && action !== "remove") {
    return null;
  }
  if (hasOwn(value, "sourceDate") && !isISODate(value.sourceDate)) return null;
  if (hasOwn(value, "targetDate") && !isISODate(value.targetDate)) return null;
  if (
    hasOwn(value, "explicitFixtureKind") &&
    value.explicitFixtureKind !== "game" &&
    value.explicitFixtureKind !== "practice_match"
  ) return null;
  if (action === "add" && hasOwn(value, "sourceDate")) return null;
  if (action === "remove" && hasOwn(value, "targetDate")) return null;

  if (needsClarification) {
    if (!Array.isArray(value.missingFields) || value.missingFields.length === 0) return null;
    const missingFields = value.missingFields;
    if (!missingFields.every((field) => field === "action" || field === "targetDate")) {
      return null;
    }
    if (new Set(missingFields).size !== missingFields.length) return null;
    if (action === undefined && !missingFields.includes("action")) return null;
    if ((action === "add" || action === "move") && !hasOwn(value, "targetDate") &&
      !missingFields.includes("targetDate")) return null;
    if (action === "remove" || ((action === "add" || action === "move") && hasOwn(value, "targetDate"))) {
      return null;
    }
    return value as unknown as FixtureChangePayload;
  }

  if (hasOwn(value, "missingFields")) return null;
  if (action === "add" || action === "move") {
    return hasOwn(value, "targetDate")
      ? value as unknown as FixtureChangePayload
      : null;
  }
  return action === "remove"
    ? value as unknown as FixtureChangePayload
    : null;
}

function explicitFixtureKindWasStated(
  payload: FixtureChangePayload,
  athleteMessage: string | undefined,
): boolean {
  if (!payload.explicitFixtureKind || athleteMessage === undefined) return true;
  return payload.explicitFixtureKind === "practice_match"
    ? /\bpractice[-\s]+match\b/i.test(athleteMessage)
    : /\bgame\b/i.test(athleteMessage);
}

function parseCoachIntent(raw: unknown, athleteMessage?: string): CoachIntent | null {
  if (!isRecord(raw)) return null;
  const r = raw;
  if (typeof r.intent !== "string" || !VALID_COACH_INTENTS.has(r.intent)) return null;
  if (
    typeof r.confidence !== "number" ||
    !Number.isFinite(r.confidence) ||
    r.confidence < 0 ||
    r.confidence > 1 ||
    typeof r.needsClarification !== "boolean"
  ) return null;
  if (hasOwn(r, "clarificationQuestion") && typeof r.clarificationQuestion !== "string") {
    return null;
  }
  if (hasOwn(r, "payload") && !isRecord(r.payload)) return null;
  if (hasOwn(r, "rationale") && typeof r.rationale !== "string") return null;
  if (r.intent === "new_injury_report" || r.intent === "injury_severity_reply" ||
    r.intent === "active_injury_followup") {
    return parseInjuryEpisodeIntent(r) as CoachIntent | null;
  }
  if (r.intent === "fixture_change") {
    if (r.needsClarification &&
      (typeof r.clarificationQuestion !== "string" || !r.clarificationQuestion.trim())) {
      return null;
    }
    const fixturePayload = parseFixtureChangePayload(r.payload, r.needsClarification);
    if (!fixturePayload || !explicitFixtureKindWasStated(fixturePayload, athleteMessage)) return null;
  }
  const out: CoachIntent = {
    intent: r.intent,
    confidence: r.confidence,
    needsClarification: r.needsClarification,
  };
  if (typeof r.clarificationQuestion === "string") {
    out.clarificationQuestion = r.clarificationQuestion;
  }
  if (isRecord(r.payload)) {
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

  const intent = parseCoachIntent(parsed, message);
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
