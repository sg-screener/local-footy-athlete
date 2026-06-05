import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const DEBUG_LOGS_ENABLED = Deno.env.get("ENABLE_DEBUG_LOGS") === "true";
const debugLog = (...args: unknown[]) => {
  if (DEBUG_LOGS_ENABLED) console.log(...args);
};
const infoLog = (...args: unknown[]) => console.log(...args);
const safeErrorSummary = (err: unknown): string => {
  const status = typeof err === "object" && err != null && "status" in err
    ? ` status=${String((err as { status?: unknown }).status)}`
    : "";
  if (err instanceof Error) {
    return `${err.name || "Error"}${status}: ${err.message.split("\n")[0].slice(0, 160).replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")}`;
  }
  return `Error${status}: ${String(err).slice(0, 160).replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")}`;
};

const safePreview = (value: unknown, max = 500): string => {
  return String(value ?? "")
    .slice(0, max)
    .replace(/\s+/g, " ")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .trim();
};

function attachRuntimeDiagnostic(error: unknown, diagnostic: Record<string, unknown>): unknown {
  if (typeof error !== "object" || error === null) return error;
  const existing = (error as any).__coachDiagnostic;
  (error as any).__coachDiagnostic = {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...diagnostic,
  };
  return error;
}

function readRuntimeDiagnostic(error: unknown): Record<string, unknown> | null {
  if (typeof error !== "object" || error === null) return null;
  const diagnostic = (error as any).__coachDiagnostic;
  return diagnostic && typeof diagnostic === "object" ? diagnostic : null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ═══════════════════════════════════════════════════════════════════════
// DETERMINISTIC INJURY CLARIFICATION GUARD
// ═══════════════════════════════════════════════════════════════════════
//
// Runs BEFORE any LLM call. When an injury-context message arrives without a
// severity rating, we short-circuit the model and return the canonical
// severity question. This eliminates multi-question violations entirely
// (the LLM can't combine "where" + "how bad" if it never gets the turn).
//
// KEEP IN SYNC with src/utils/injuryClarificationGuard.ts — this is an
// embedded mirror because the deno edge function can't import from src/.
// Source-of-truth lives in that file. Update both when changing the keyword
// lists, severity patterns, or decision tree.

const GUARD_SEVERITY_QUESTION = 'How bad is it? Rough pain out of 10.';

// KEEP IN SYNC with src/utils/injuryClarificationGuard.ts.
// Curated athlete vocabulary; OR-gate with body parts means we don't need
// every conjugation ("my hammy hurts" still fires via body-part branch).
const GUARD_INJURY_KEYWORDS: string[] = [
  'hurt',
  'hurts',
  'injured',
  'injury',
  'tweak',
  'tweaked',
  'strain',
  'strained',
  'pulled',
  'tight',
  'tightness',
  'sore',
  'niggle',
  'twinge',
  'pinged',
];

// Misspelling / slang variants → canonical spellings. Applied before
// keyword & body-part detection so detection survives imperfect spelling.
const GUARD_BODY_PART_NORMALIZATION: Record<string, string> = {
  hammie: 'hammy',
  hammys: 'hammy',
  hamy: 'hammy',
  hamie: 'hammy',
  hamstrng: 'hamstring',
  hammstring: 'hamstring',
  sholder: 'shoulder',
  sholders: 'shoulders',
  shouder: 'shoulder',
  ankel: 'ankle',
  ankels: 'ankles',
  achelies: 'achilles',
  achillies: 'achilles',
  achiles: 'achilles',
  calve: 'calf',
  grain: 'groin',
  qaud: 'quad',
  qauds: 'quads',
};

const GUARD_KEYWORD_NORMALIZATION: Record<string, string> = {
  tweek: 'tweak',
  tweeked: 'tweaked',
  tweeking: 'tweak',
  injuried: 'injured',
};

// Phrase patterns that indicate injury intent without a single-token kw.
const GUARD_INJURY_PHRASE_PATTERNS: RegExp[] = [
  /\bfelt (?:it|something|that|it all) go\b/i,
  /\bfelt (?:it|something|that) (?:pop|snap|tear|give|crack)\b/i,
  /\bsomething (?:popped|snapped|tore|gave way|cracked)\b/i,
  /\bgone in my\b/i,
];

// Negative descriptors paired with a body part trigger the high-priority
// shortcut: "hammy cooked", "shoulder feels off", "calf is gone". KEEP IN
// SYNC with src/utils/injuryClarificationGuard.ts.
const GUARD_NEGATIVE_DESCRIPTORS: string[] = [
  'cooked',
  'sore',
  'tight',
  'hurt',
  'hurts',
  'hurting',
  'tweak',
  'tweaked',
  'niggle',
  'twinge',
  'pinged',
  'pulled',
  'strained',
  'ache',
  'aching',
  'gone',
  'grabbed',
  'went',
  'pain',
  'painful',
  'stiff',
];

const GUARD_NEGATIVE_DESCRIPTOR_PATTERNS: RegExp[] = [
  /\bfeels off\b/i,
  /\bnot right\b/i,
  /\bfeels weird\b/i,
  /\blocked up\b/i,
  /\bplaying up\b/i,
];

const GUARD_BODY_PARTS: string[] = [
  'lower back', 'upper back',
  'hamstring', 'hamstrings', 'hammy', 'hammies',
  'shoulder', 'shoulders',
  'knee', 'knees',
  'back',
  'groin',
  'quad', 'quads', 'quadricep', 'quadriceps',
  'calf', 'calves',
  'ankle', 'ankles',
  'hip', 'hips',
  'neck',
  'glute', 'glutes',
  'achilles',
  'elbow', 'elbows',
  'wrist', 'wrists',
  'foot', 'feet',
  'forearm', 'forearms',
  'bicep', 'biceps',
  'tricep', 'triceps',
  'pec', 'pecs', 'chest',
];

const GUARD_SEVERITY_PATTERNS: RegExp[] = [
  /\b(?:[1-9]|10)\s*(?:\/\s*10|out of 10)\b/i,
  /\b(?:pain|sore|hurt|hurts).{0,20}\b(?:[1-9]|10)\b/i,
  /\b(?:[1-9]|10)\s*\/\s*10\b/,
  /\b(?:really bad|very bad|severe|sharp pain|stabbing|excruciating|killing me|agony|can'?t walk|cannot walk|can'?t move|cannot move|barely walk|barely move)\b/i,
  /\b(?:mild|minor|slight|barely (?:notice|hurts|sore)|just a bit|a little tight|a bit tight)\b/i,
];

interface GuardSignals {
  isInjury: boolean;
  hasLocation: boolean;
  hasSeverity: boolean;
  hasNegativeDescriptor: boolean;
}

function guardWordMatch(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
}

function guardNormalizeText(text: string): string {
  let out = text.toLowerCase();
  for (const variant of Object.keys(GUARD_BODY_PART_NORMALIZATION)) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), GUARD_BODY_PART_NORMALIZATION[variant]);
  }
  for (const variant of Object.keys(GUARD_KEYWORD_NORMALIZATION)) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), GUARD_KEYWORD_NORMALIZATION[variant]);
  }
  return out;
}

function guardDetectSignals(text: string): GuardSignals {
  if (!text || typeof text !== 'string') {
    return { isInjury: false, hasLocation: false, hasSeverity: false, hasNegativeDescriptor: false };
  }
  const normalized = guardNormalizeText(text);
  const hasKeyword = GUARD_INJURY_KEYWORDS.some((kw) => guardWordMatch(normalized, kw));
  const hasPhrase = GUARD_INJURY_PHRASE_PATTERNS.some((re) => re.test(text));
  const isInjury = hasKeyword || hasPhrase;
  const hasLocation = GUARD_BODY_PARTS.some((p) => guardWordMatch(normalized, p));
  const hasSeverity = GUARD_SEVERITY_PATTERNS.some((re) => re.test(text));
  const hasNegativeDescriptor =
    GUARD_NEGATIVE_DESCRIPTORS.some((d) => guardWordMatch(normalized, d)) ||
    GUARD_NEGATIVE_DESCRIPTOR_PATTERNS.some((re) => re.test(text));
  return { isInjury, hasLocation, hasSeverity, hasNegativeDescriptor };
}

interface GuardResult {
  fired: boolean;
  reply?: string;
  reason: string;
}

function checkInjuryClarificationGuard(messages: Message[] | undefined): GuardResult {
  if (!messages || messages.length === 0) return { fired: false, reason: 'no messages' };
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string') {
    return { fired: false, reason: 'last turn is not a user message' };
  }
  const signals = guardDetectSignals(last.content);

  // 1. Severity already provided → fall through to LLM.
  if (signals.hasSeverity) return { fired: false, reason: 'severity already provided' };

  // 2. HIGH-PRIORITY SHORTCUT: body part + negative descriptor → FIRE.
  //    Catches "hammy cooked", "shoulder feels off", "calf is gone" etc.
  //    Runs BEFORE the keyword/phrase gate so body+descriptor never needs
  //    an INJURY_KEYWORD match. Loop-safety intentionally skipped.
  if (signals.hasLocation && signals.hasNegativeDescriptor) {
    return {
      fired: true,
      reply: GUARD_SEVERITY_QUESTION,
      reason: 'body part + negative descriptor → ask severity (high-priority shortcut)',
    };
  }

  // 3. Gate: from here on we require an injury keyword or phrase pattern.
  //    Body-part alone NO LONGER fires (was a false-positive vector:
  //    "rolled out my hammy", "calves are fine", "back squats today").
  if (!signals.isInjury) {
    return { fired: false, reason: 'no injury keyword/phrase detected (body-part alone or descriptor alone is not enough)' };
  }

  // 4. Injury kw/phrase + body part → FIRE. Each new body-part mention is
  //    a fresh injury report and is never suppressed by history.
  if (signals.hasLocation) {
    return { fired: true, reply: GUARD_SEVERITY_QUESTION, reason: 'injury kw/phrase + location, severity missing (fresh body part)' };
  }

  // 5. Injury kw/phrase, no body part → severity-first default with
  //    loop-safety: if the previous assistant turn already asked a
  //    clarifier, fall through to the LLM instead of re-asking.
  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'assistant' || typeof m.content !== 'string') continue;
    if (
      /how bad is it.{0,40}(rough )?pain out of 10/i.test(m.content) ||
      /\bwhere\s+(?:is\s+it|exactly|are\s+you\s+sore)\b/i.test(m.content) ||
      /pain.{0,20}out of 10/i.test(m.content)
    ) {
      return { fired: false, reason: 'kw/phrase but no body part + prior clarifier asked — let LLM interpret reply' };
    }
    break;
  }

  return { fired: true, reply: GUARD_SEVERITY_QUESTION, reason: 'injury kw/phrase, no body part — severity-first default' };
}

// ─── INJURY-INTENT CLASSIFIER FALLBACK ──────────────────────────────────
// LLM-backed safety net for messages the deterministic fast-path missed.
// Calls a small model (Haiku) with a tiny structured-output prompt and
// returns a 3-field intent. Pre-filtered by `shouldRunInjuryClassifier`
// so action/scheduling messages never trigger the call.

interface InjuryIntent {
  isInjuryIntent: boolean;
  bodyPartKnown: boolean;
  severityKnown: boolean;
}

const CLASSIFIER_SYSTEM_PROMPT = `You are an injury-intent classifier for an AFL athlete training app.

Given a single user message, output ONLY this JSON object — no prose, no markdown, no code fences:
{"isInjuryIntent": boolean, "bodyPartKnown": boolean, "severityKnown": boolean}

Definitions:
- isInjuryIntent: true if the message reports any pain, injury, soreness, niggle, tightness, twinge, or body issue affecting training. False for general fatigue, scheduling, or workout questions.
- bodyPartKnown: true only if a specific body part is named (e.g. "hammy", "shoulder", "lower back"). "Leg" / "arm" count.
- severityKnown: true if the user gives a numeric pain rating (1-10) OR a clear qualitative severity ("really bad", "mild", "can't walk", "sharp", "agony", "minor").

Examples:
"my hammie feels cooked" -> {"isInjuryIntent": true, "bodyPartKnown": true, "severityKnown": false}
"felt something go in my leg" -> {"isInjuryIntent": true, "bodyPartKnown": true, "severityKnown": false}
"I'm feeling cooked this week" -> {"isInjuryIntent": false, "bodyPartKnown": false, "severityKnown": false}
"My hammy is a 6/10" -> {"isInjuryIntent": true, "bodyPartKnown": true, "severityKnown": true}
"what's today's session?" -> {"isInjuryIntent": false, "bodyPartKnown": false, "severityKnown": false}`;

async function classifyInjuryIntent(message: string): Promise<InjuryIntent | null> {
  const provider = resolveCoachProvider();
  const apiKey = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  try {
    const resp = provider === "openai"
      ? await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getOpenAIModel("classifier"),
          instructions: CLASSIFIER_SYSTEM_PROMPT,
          input: [{ role: "user", content: message }],
          max_output_tokens: 300,
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
        model: getAnthropicModel("classifier"),
        max_tokens: 100,
        system: CLASSIFIER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });
    if (!resp.ok) {
      console.warn(`[coach-chat] classifier HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const text: string = provider === "openai"
      ? extractOpenAIText(data)
      : data?.content?.[0]?.text?.trim() || '';
    // Permissive JSON extraction — model occasionally wraps in fences.
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return {
      isInjuryIntent: !!parsed.isInjuryIntent,
      bodyPartKnown: !!parsed.bodyPartKnown,
      severityKnown: !!parsed.severityKnown,
    };
  } catch (err) {
    console.warn(`[coach-chat] classifier error: ${safeErrorSummary(err)}`);
    return null;
  }
}

// Pre-filter: avoid spending an API call on messages that are clearly not
// injury reports (action verbs, scheduling, day names, very short replies).
function shouldRunInjuryClassifier(messages: Message[] | undefined): boolean {
  if (!messages || messages.length === 0) return false;
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string') return false;
  const text = last.content.trim();
  if (text.length < 6) return false; // "ok", "yeah", "thanks"
  const lower = text.toLowerCase();
  const skipPatterns: RegExp[] = [
    /\b(?:session|workout|training|gym)\b/i,
    /\btoday'?s?\b/i,
    /\btomorrow\b/i,
    /\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day)?\b/i,
    /\b(?:swap|move|skip|redo|change|reschedule|switch|replace|substitute|sub out)\b/i,
    /\b(?:what'?s?|when'?s?|how do|can you|show me|what is|what time)\b/i,
    /\b(?:pre[- ]?season|in[- ]?season|off[- ]?season)\b/i,
  ];
  if (skipPatterns.some((re) => re.test(lower))) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════

interface AthleteProfile {
  firstName?: string;
  ageRange?: string;
  position?: string;
  motivation?: string | string[];
  heightCm?: number;
  weightKg?: number;
  seasonPhase?: string;
  gameDay?: string;
  teamTrainingDaysPerWeek?: number;
  teamTrainingDays?: string[];
  teamTrainingDuration?: string;
  teamTrainingIntensity?: string;
  trainingDaysPerWeek?: number;
  preferredTrainingDays?: string[];
  sessionDurationMinutes?: number;
  trainingLocation?: string;
  equipment?: string[];
  experienceLevel?: string;
  squatStrength?: string;
  benchStrength?: string;
  conditioningLevel?: string;
  sprintExposure?: string;
  recentTrainingLoad?: string;
  injuries?: { bodyArea: string; description: string; severity?: string; whenItHurts?: string; movementTriggers?: string[]; notes?: string }[];
  successVision?: string;
}

interface AIConstraints {
  phase: string;
  readiness: string;
  hardExposureCap: number;
  existingHardExposures: number;
  coreSessionsToProgram: number;
  optionalSessionsAllowed: number;
  recoverySessionsAllowed: number;
  lowerBodyLoading: string;
  sprintLoading: string;
  conditioningLoading: string;
  injuryRestrictions: string[];
  priorities: string[];
  rampUp: boolean;
  maxExercisesPerSession: number;
  notes: string[];
}

interface RequestBody {
  messages: Message[];
  coachNotes?: string[];
  currentProgramContext?: string;
  athleteProfile?: AthleteProfile;
  coachingPlan?: AIConstraints;
  /** 'generate' = initial program gen (lean prompt). Absent/other = full coaching chat. */
  mode?: 'generate' | 'chat';
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: any;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
  openAIOutput?: any[];
}

type CoachLLMProvider = "openai" | "anthropic";

type CoachLLMKind = "chat" | "classifier";

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

function getOpenAIModel(kind: CoachLLMKind, role: "primary" | "fallback" = "primary"): string {
  if (kind === "classifier") {
    return Deno.env.get("COACH_CLASSIFIER_LLM_MODEL") ||
      Deno.env.get("COACH_LLM_FAST_MODEL") ||
      "gpt-5.4-mini";
  }
  if (role === "fallback") {
    return Deno.env.get("COACH_LLM_FALLBACK_MODEL") || "gpt-5.4";
  }
  return Deno.env.get("COACH_LLM_MODEL") || "gpt-5.5";
}

function getAnthropicModel(kind: CoachLLMKind, role: "primary" | "fallback" = "primary"): string {
  if (kind === "classifier") {
    return Deno.env.get("ANTHROPIC_CLASSIFIER_MODEL") || "claude-haiku-4-5-20251001";
  }
  if (role === "fallback") {
    return Deno.env.get("ANTHROPIC_FALLBACK_MODEL") || "claude-sonnet-4-6";
  }
  return Deno.env.get("ANTHROPIC_COACH_MODEL") || "claude-opus-4-7";
}

function requireProviderKey(provider: CoachLLMProvider): string {
  const key = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    const envName = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    console.error(`[coach-chat] ${envName} is not set`);
    throw new Error(`${envName} environment variable is not set`);
  }
  return key;
}

function safeParseJSON(raw: unknown): any {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return {};
  }
}

function toOpenAIFunctionTool(tool: any): any {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
    strict: false,
  };
}

function toOpenAIInput(messages: any[]): any[] {
  const input: any[] = [];

  for (const msg of messages) {
    if (!msg) continue;

    if (typeof msg.content === "string") {
      input.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (!block) continue;

      // Raw Responses API output items must be replayed alongside tool results.
      if (block.type === "function_call" || block.type === "reasoning" || block.type === "message") {
        input.push(block);
        continue;
      }

      // Anthropic-normalized assistant tool calls.
      if (block.type === "tool_use") {
        input.push({
          type: "function_call",
          call_id: String(block.id || `${block.name}-call`),
          name: block.name,
          arguments: JSON.stringify(block.input || {}),
        });
        continue;
      }

      // Anthropic tool results from the existing loop.
      if (block.type === "tool_result") {
        input.push({
          type: "function_call_output",
          call_id: String(block.tool_use_id),
          output: typeof block.content === "string" ? block.content : JSON.stringify(block.content),
        });
        continue;
      }

      if (block.type === "text" && typeof block.text === "string") {
        input.push({ role: msg.role || "assistant", content: block.text });
      }
    }
  }

  return input;
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

function normalizeOpenAIResponse(data: any): AnthropicResponse {
  const content: AnthropicContentBlock[] = [];

  for (const item of data?.output || []) {
    if (item?.type === "function_call") {
      content.push({
        type: "tool_use",
        id: item.call_id || item.id,
        name: item.name,
        input: safeParseJSON(item.arguments),
      });
      continue;
    }

    if (item?.type === "message") {
      for (const part of item.content || []) {
        const text = typeof part?.text === "string"
          ? part.text
          : typeof part?.refusal === "string"
            ? part.refusal
            : "";
        if (text) content.push({ type: "text", text });
      }
    }
  }

  const outputText = extractOpenAIText(data);
  if (content.length === 0 && outputText) {
    content.push({ type: "text", text: outputText });
  }

  return {
    content,
    stop_reason: content.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn",
    openAIOutput: Array.isArray(data?.output) ? data.output : undefined,
  };
}

const SYSTEM_PROMPT = `You are an elite AFL Strength & Conditioning coach.

Your job is to:
- Keep the athlete training consistently
- Adjust their program intelligently when things change
- Protect them from injury and overload
- Be clear, direct, and practical

You are NOT:
- a physio
- a lecturer
- a motivational speaker

----------------------------------------
CORE PRINCIPLES
----------------------------------------

1. ALWAYS THINK IN TERMS OF THE PROGRAM
Every response must answer:
→ "What happens to their training now?"
Do not give generic advice without linking it to training changes.

2. KEEP RESPONSES TIGHT
- 1 short empathy line (optional)
- 2–4 bullet points max
- No long paragraphs
- No over-explaining
- No markdown bold markers like **text**. Use short plain headings on their own lines if you need structure.

3. ASK QUESTIONS ONLY WHEN NECESSARY
Only ask a question if it directly changes the program.
Rules:
- Max ONE question per message
- If you already have enough info → DO NOT ask anything

4. PRIORITISE ACTION OVER DIAGNOSIS
You are not diagnosing injuries.
Instead:
- Adjust training based on what they told you
- Reduce risk
- Keep them moving where possible

----------------------------------------
INJURY HANDLING
----------------------------------------

If athlete reports pain/injury:

Step 1:
If severity is NOT given →
→ Ask ONE question:
"How bad is it? Rough pain out of 10."
STOP. Do nothing else.

Step 2:
If severity IS given →
→ IMMEDIATELY adjust the program

Response format:
- Short empathy line
- Program changes:
  • what is removed
  • what is modified
  • what is swapped
- Avoid this week:
  • key restrictions
- Optional: physio line if needed

Rules:
- NO multiple questions
- NO detailed diagnosis
- NO long explanations

----------------------------------------
PROGRAM ADJUSTMENT STYLE
----------------------------------------

When modifying training:

Be specific:
- "Removed sprinting"
- "Swapped running → bike"
- "Lightened lower session"
- "Kept upper body work"

Avoid vague advice like:
- "take it easy"
- "listen to your body"

----------------------------------------
UNKNOWN / GENERAL MESSAGES
----------------------------------------

If the message is unclear or doesn't fit a known scenario:
Do NOT guess.
→ Ask ONE simple clarification:

Example:
"What do you want to adjust — volume, sessions, or recovery?"

Do NOT change the program yet.

----------------------------------------
TONE
----------------------------------------

- Direct
- Calm
- Practical
- Slightly conversational (AFL tone)
- Never robotic

----------------------------------------
GOAL
----------------------------------------

Keep the athlete progressing while managing fatigue, injury risk, and real-life constraints.

Every response should feel like:
→ a coach making a smart call on the fly`;

// ═══════════════════════════════════════════════════════════════════════════════
// LEAN SYSTEM PROMPT — used ONLY for initial program generation.
//
// The deterministic coaching engine has already decided:
//   - session count, tiers, placement, game-proximity structure
//   - hard exposure caps, readiness, loading constraints
//
// The AI's ONLY job here is:
//   - exercise selection within each session skeleton
//   - rep/set schemes appropriate for tier + phase
//   - short coaching notes where useful
//   - use the update_program tool with the correct structure
//
// Everything the full SYSTEM_PROMPT teaches about weekly structure, fatigue waves,
// G-relative scheduling, periodisation templates, energy systems, nutrition, etc.
// is REMOVED. That knowledge lives in the engine, not in the prompt.
// ═══════════════════════════════════════════════════════════════════════════════

const GENERATE_SYSTEM_PROMPT = `You are an S&C coach for local Australian Rules Football players. Generate a training program using the update_program tool.

Your job: fill sessions with exercises. The coaching engine has ALREADY decided session count, tiers, placement, and game-proximity structure. Follow its constraints EXACTLY.

=== EXERCISE SELECTION RULES ===

MOVEMENT PATTERNS (every exercise belongs to exactly one):
Upper push horizontal: bench press, incline bench, flat/incline DB press, landmine press, dips, push-ups, explosive push-ups, speed bench.
Upper push vertical: overhead press (BB), single arm half kneeling OHP (DB), seated DB OHP, Z press.
Upper pull horizontal: bent over BB row, incline DB row (chest supported), single arm DB row, face pulls.
Upper pull vertical: pull-ups, weighted pull-ups (advanced only: 8+ BW reps), chin-ups.
Lower squat bilateral: back squat, box squat, high box squat, goblet squat, leg press.
Lower squat unilateral: Bulgarian/RFE split squats, lunges, walking lunges, single leg squat to box.
Lower hinge bilateral: trap bar deadlift, RDL, hip thrusts, speed trap bar DL.
Lower hinge unilateral: single leg RDL.
Lower power: squat jump (DB/BB light), box jump, vertical jump, broad jump.
Upper power: speed bench, explosive landmine press, explosive push-ups.
Core: ab wheel, hanging leg raise, dragon flag, Pallof press, suitcase carry, side plank, farmers carry.
Accessories upper: skull crushers, tricep pushdowns, bicep curls, lateral raises, DB shrugs.
Accessories lower: Nordic lowers, hamstring curls, knee extensions, calf raises, tib raises, Copenhagen plank, crab walks, back extension.

PATTERN RULES:
- No same primary pattern on consecutive training days.
- No back squat + trap bar DL same day (axial overload). Pair bilateral with unilateral, squat with hinge.
- Pull max 2x/week, push max 2-3x/week, heavy hinge max 2x/week, heavy squat max 2x/week.
- Across the week: cover horizontal push, vertical push, horizontal pull, vertical pull, squat, hinge, core.

SESSION STRUCTURE:
- CORE: compound first, accessories last. Max 6 exercises. Aim for squat/hinge + push/pull pattern + 1-2 accessories + core.
- OPTIONAL: 4-5 low-fatigue exercises. Trunk, prehab, arms, mobility. NOT junk — useful balancing work.
- RECOVERY: specific mobility/recovery prescriptions. Foam rolling routines, stretches, walks, hot/cold.

REP RANGES:
- Heavy/neural: 2-5 reps (in-season compounds — maintain strength without soreness).
- Strength: 3-6 reps (off-season compounds).
- Hypertrophy: 6-12 reps (secondary compounds, accessories).
- Endurance: 10-20 reps (accessories, prehab). Accessories ALWAYS 8-20 reps.

PAIRING (experienced athletes only, core sessions only):
- Default: NO pairing. Max 1 paired block per session.
- Use structured fields: supersetGroup="A", supersetOrder=1/2, pairType="contrast"|"superset".
- Contrast: heavy compound + explosive (e.g. squat + box jump). Superset: agonist/antagonist.
- Never pair two heavy compounds. Never pair in optional/recovery sessions.

IN-SEASON DOMS RULES:
- HIGH DOMS exercises (RFE/Bulgarians, walking lunges, Nordics, heavy eccentrics): 3-6 reps ONLY, 2-3 sets, early in loading window (G-5/G-4). NEVER after G-4.
- PREFERRED alternatives: trap bar DL, leg press, machine curls, isometrics (zero DOMS).
- No heavy lower body within 48h of game. No lower body AT ALL on G-1.
- G-2: push-dominant upper ONLY. No heavy pull/back (creates stiffness). Light face pulls OK.
- G-1: arms/pump ONLY (biceps, triceps, laterals). ZERO lower body, sprinting, conditioning, plyometrics.
- G+1: recovery only.

NON-NEGOTIABLE PREHAB (include in every program):
- Nordics: off-season 3x5-8, in-season 2-3x4-5 early week only.
- Copenhagen planks: 2-3x20-30sec each side (safe any day).
- Tib raises: 2-3x15-20 reps (safe any day).

SET SCHEMES: Use variety — AMRAP back-off sets after working sets, accessory circuits, "1 easy 1 max" for accessories.

CREATIVITY: Rotate exercises within patterns between programs. Don't default to the same lifts every time.

NAMING: Body region first — "Upper Pull", "Upper Push", "Lower Strength". NEVER "Push Upper" or "Pull Upper". Team training combo: TEAM TRAINING LEADS — "Team Training + Upper Pull" (not "Upper Pull + Team Training"). Team training is the primary session on those days; the gym work is a secondary complement.

NEVER program: Olympic lifts (cleans, snatches). Use jump squats for explosive stimulus instead.

CONDITIONING (only if constraints allow):
- Off-season: finish CORE sessions with 20-30min conditioning. Hit all 3 energy systems across the week.
- In-season: no extra running. Optional conditioning = off-leg only (bike, rower, ski erg).

=== OUTPUT CONTRACT — STRICTLY ENFORCED ===

You MUST call the \`update_program\` tool exactly once. The tool's \`workouts\` argument is the program.

DO NOT:
- Reply with prose, markdown, headings, tables, or bullet lists.
- Say "Here's your weekly program..." or any narrative wrapper.
- Use any other tool. Only \`update_program\`.
- Skip days with rest — omit them from the workouts array entirely.

The tool call IS the response. There is nothing to say in text.`;

// ─── Scoped action tools (Phase 6) ───
//
// Each tool maps 1:1 to a function in src/utils/coachActions.ts. The edge
// function does NOT mutate program state — it only emits intents. The client
// dispatcher in CoachScreen calls applyCoachActions() to actually write.
//
// SCOPE TIERS:
//   LOCAL  = single date; today + next 1–2 days only
//   WEEKLY = current week (Mon–Sun); never spills past Sun
//   PERMANENT = future programs (athletePreferencesStore); never touches the
//               current week's resolved view
//
// All date arguments MUST be ISO YYYY-MM-DD. The AI is instructed to convert
// "today", "tomorrow", "Wednesday" etc. to a concrete date before tool use.

// ─── Generate-mode tool: update_program ───
//
// Used ONLY when the request comes in with mode="generate" (program rebuild
// path). Forced via tool_choice so the LLM CANNOT respond in prose. Schema
// matches CoachResponse.programUpdate.workouts in
// src/services/api/generateProgram.ts — keep in sync.

const UPDATE_PROGRAM_TOOL = {
  name: "update_program",
  description:
    "Emit the full weekly training program. Call this exactly once with the complete workouts array — one entry per training day. Skip rest days entirely (do not include empty workouts). This tool is the ONLY way to respond in generate mode.",
  input_schema: {
    type: "object" as const,
    properties: {
      workouts: {
        type: "array" as const,
        description:
          "One workout per training day for the week. Order does not matter; the client sorts by dayOfWeek.",
        items: {
          type: "object" as const,
          properties: {
            dayOfWeek: {
              type: "number" as const,
              description: "1 = Monday, 7 = Sunday.",
            },
            name: {
              type: "string" as const,
              description:
                'Athlete-facing session name. Body region first, e.g. "Upper Pull", "Lower Strength", "Team Training + Upper Push".',
            },
            workoutType: {
              type: "string" as const,
              enum: ["Strength", "Conditioning", "Recovery", "Team Training", "Mixed"],
              description:
                'App-level session type. One of: "Strength" | "Conditioning" | "Recovery" | "Team Training" | "Mixed". Do NOT put tier labels like "core" or "optional" here; use sessionTier for those.',
            },
            sessionTier: {
              type: "string" as const,
              enum: ["core", "optional", "recovery"],
              description:
                'Optional tier label from the coaching engine — pass through if provided in the constraints, otherwise omit.',
            },
            exercises: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  name: { type: "string" as const },
                  sets: { type: "number" as const },
                  repsMin: { type: "number" as const },
                  repsMax: { type: "number" as const },
                  weight: { type: "number" as const, description: "Optional. Numeric load in kg." },
                  notes: { type: "string" as const, description: "Optional short coaching note." },
                  supersetGroup: {
                    type: "string" as const,
                    description: 'Optional. e.g. "A". Pair with supersetOrder.',
                  },
                  supersetOrder: { type: "number" as const, description: "Optional. 1 or 2." },
                  pairType: {
                    type: "string" as const,
                    description: 'Optional. "contrast" | "superset".',
                  },
                },
                required: ["name", "sets", "repsMin", "repsMax"],
              },
            },
          },
          required: ["dayOfWeek", "name", "workoutType", "exercises"],
        },
      },
    },
    required: ["workouts"],
  },
};

const LIGHTEN_SESSION_TOOL = {
  name: "lighten_session",
  description: "LOCAL scope. Drop intensity/volume on a single day. Use when the athlete reports soreness, low energy, illness, or asks 'can I take it easier today/tomorrow'. Does NOT touch any other day. Default `level=optional` halves sets and marks the session optional. `level=recovery` strips the session down to mobility/walk only. NEVER use this for permanent preferences — only for one-off, day-specific dial-back.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: "string" as const, description: "ISO date YYYY-MM-DD. Must be today or within the next 2 days." },
      level: { type: "string" as const, enum: ["optional", "recovery"], description: "How far to lighten. 'optional' (default) = halve sets + mark optional. 'recovery' = full conversion to mobility/walk." },
      reason: { type: "string" as const, description: "Brief reason for the change (used for logs and the athlete-facing summary)." },
    },
    required: ["date"],
  },
};

const MOVE_SESSION_TOOL = {
  name: "move_session",
  description: "LOCAL scope. Swap two days' sessions within the current week. Use when the athlete says 'I moved my session from X to Y' or 'shift Wednesday's gym to Thursday'. If the destination has a session, the two are swapped; if it's a rest day, the source becomes rest. NEVER use for a permanent schedule change — that's `add_weekly_override` with a follow-up question about whether to make it permanent.",
  input_schema: {
    type: "object" as const,
    properties: {
      fromDate: { type: "string" as const, description: "ISO date YYYY-MM-DD of the session being moved away from." },
      toDate: { type: "string" as const, description: "ISO date YYYY-MM-DD of the new home for the session." },
      reason: { type: "string" as const, description: "Brief reason." },
    },
    required: ["fromDate", "toDate"],
  },
};

const MAKE_SESSION_OPTIONAL_TOOL = {
  name: "make_session_optional",
  description: "LOCAL scope. Mark one day as optional without changing its content. Use when the athlete says 'I might skip Wednesday' or 'leave it there but don't push me on it'. Different from lighten_session: contents stay the same — only the tier flips so it doesn't break the program flow if skipped.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: "string" as const, description: "ISO date YYYY-MM-DD." },
      reason: { type: "string" as const, description: "Brief reason." },
    },
    required: ["date"],
  },
};

const REPLACE_EXERCISE_TOOL = {
  name: "replace_exercise",
  description: "LOCAL scope (single date). Swap one exercise on one specific day. Use when the athlete says 'swap the back squat for front squat today' or 'instead of bench, do DB bench this Tuesday'. Does NOT touch the same exercise on other days, future weeks, or the template. If the athlete asks to permanently swap, use `set_preferred_alternative` (PERMANENT) AFTER doing this LOCAL swap, and ask whether they want it permanent.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: "string" as const, description: "ISO date YYYY-MM-DD where the exercise lives." },
      fromExercise: { type: "string" as const, description: "Name of the exercise to replace (case-insensitive)." },
      toExercise: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const, description: "Replacement exercise name." },
          sets: { type: "number" as const },
          repsMin: { type: "number" as const },
          repsMax: { type: "number" as const },
          weight: { type: "number" as const, description: "Weight in kg. 0 for bodyweight." },
          notes: { type: "string" as const, description: "Optional cue/tempo notes." },
        },
        required: ["name", "sets", "repsMin", "repsMax"],
      },
      reason: { type: "string" as const, description: "Brief reason for the swap." },
    },
    required: ["date", "fromExercise", "toExercise"],
  },
};

const REMOVE_EXERCISE_TOOL = {
  name: "remove_exercise",
  description: "LOCAL scope (single date). Remove one exercise from one specific day. Use when the athlete says 'skip the deadlifts today, my back's tight' or 'cut the conditioning piece tomorrow'. Does NOT touch any other day. For a permanent ban across all future programs, use `ban_exercise_globally` (PERMANENT).",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: "string" as const, description: "ISO date YYYY-MM-DD." },
      exercise: { type: "string" as const, description: "Name of the exercise to remove (case-insensitive)." },
      reason: { type: "string" as const, description: "Brief reason." },
    },
    required: ["date", "exercise"],
  },
};

const ADD_WEEKLY_OVERRIDE_TOOL = {
  name: "add_weekly_override",
  description: "WEEKLY scope. Apply a structural rule to every day in the current week (Mon–Sun). Use when the athlete describes a week-wide constraint: 'easy week, drop everything', 'no running this week, my shins are sore', 'lighten lower body — I'm carrying tightness'. NEVER spills past Sunday — next week resolves clean from the template. If the athlete signals this is permanent ('I never want to run on Wednesdays' / 'my knees are always bad'), use a PERMANENT tool instead AND ask to confirm.",
  input_schema: {
    type: "object" as const,
    properties: {
      rule: {
        type: "string" as const,
        enum: ["reduce_lower_volume", "reduce_intensity", "no_running", "remove_optional_sessions"],
        description: "The rule to apply across the week.",
      },
      reason: { type: "string" as const, description: "Brief reason for the weekly override." },
    },
    required: ["rule"],
  },
};

const BAN_EXERCISE_GLOBALLY_TOOL = {
  name: "ban_exercise_globally",
  description: "PERMANENT scope. Add an exercise to the athlete's exclusion list — it will never appear in any future generated program. Use ONLY when the athlete is explicit and unambiguous: 'never program back squats again', 'I can't do nordic curls — chronic hamstring issue', 'no deadlifts ever, lower back surgery'. If there's any ambiguity (one-off soreness, temporary), DO NOT use this — ask whether they want it permanent first.",
  input_schema: {
    type: "object" as const,
    properties: {
      exercise: { type: "string" as const, description: "Exact exercise name to ban." },
      reason: { type: "string" as const, description: "Why this is being permanently excluded (used for the athlete-facing confirmation)." },
    },
    required: ["exercise"],
  },
};

const SET_PREFERRED_ALTERNATIVE_TOOL = {
  name: "set_preferred_alternative",
  description: "PERMANENT scope. Express 'whenever you would have programmed X, program Y instead'. Bans the original AND pins the alternative for future programs. Use ONLY for explicit permanent preferences: 'always use trap bar instead of conventional deadlift', 'sub front squat for back squat going forward'. Composite — both the exclusion and the pin apply to all future weeks.",
  input_schema: {
    type: "object" as const,
    properties: {
      exercise: { type: "string" as const, description: "The exercise to replace going forward." },
      alternative: { type: "string" as const, description: "The preferred substitute." },
      reason: { type: "string" as const, description: "Why this preference exists." },
    },
    required: ["exercise", "alternative"],
  },
};

const SAVE_NOTE_TOOL = {
  name: "save_note",
  description: "Save an important note about the user to remember for future sessions. Use this for context the AI will need next time — equipment limits, schedule constraints, longstanding injury history, training-style preferences. Examples: 'no access to barbell at home', 'works night shifts on Wednesdays', 'prefers DB over BB for pressing'. Notes do NOT mutate the program — they're context only. For program changes, use the scoped action tools above.",
  input_schema: {
    type: "object" as const,
    properties: {
      note: { type: "string" as const, description: "A short, clear note to remember about the user. Keep it concise." },
    },
    required: ["note"],
  },
};

// ─── Substitution tool ───
//
// QUERY-ONLY tool. Does NOT mutate the program — returns 2 candidate
// exercise names back to the model in the same tool-use loop, so the
// model can weave them into its reply ("I can swap deadlifts for RDLs
// or Hip Thrusts — do either feel okay?"). Use BEFORE firing
// replace_exercise / set_preferred_alternative when the athlete asks
// to drop or avoid an exercise.
//
// The candidate list is computed by the embedded substitution helper
// below (mirror of src/utils/exerciseSubstitutes.ts) so the model gets
// real names grounded in the pool data + the athlete's active injuries
// and equipment, not memorised ladder text.
const SUGGEST_SUBSTITUTES_TOOL = {
  name: "suggest_substitutes",
  description: "QUERY-ONLY (no mutation). Returns up to 2 pattern-preserving substitute exercises. May return ONLY 1 if no second candidate is meaningfully different — never invent a second to pad the reply. Call this BEFORE firing replace_exercise or set_preferred_alternative whenever the athlete asks to drop, avoid, or swap an exercise (e.g. 'no deadlifts', 'bench is killing my shoulder', 'sub the squats'). Returned candidates are guaranteed meaningfully different from each other AND the original. Each candidate also includes a short reason ('lower spinal load', 'avoids overhead pull', 'lighter load'). Use the names verbatim in your reply along with the reason, then ask which the athlete prefers. CROSS-PATTERN FALLBACK: when vertical pulling itself is the problem (overhead, shoulder), the tool automatically returns row variations from the horizontal_pull family — that's intended; lead with rows in that case.",
  input_schema: {
    type: "object" as const,
    properties: {
      exercise: { type: "string" as const, description: "The exercise the athlete wants to swap. Aliases ('rdl', 'barbell squat') resolve automatically." },
      reason: { type: "string" as const, description: "Short note on why the athlete wants the swap (e.g. 'back tight', 'shoulder sore', 'overhead pulling hurts'). The string 'overhead' or 'vertical pull' here triggers the row fallback even without a registered shoulder injury." },
      avoid_overhead_pull: { type: "boolean" as const, description: "Optional explicit flag. Set true when the athlete clearly says overhead/vertical pulling is the issue rather than the specific lift. Forces the row fallback for vertical_pull exercises." },
    },
    required: ["exercise"],
  },
};

// ─── Action shape returned to the client ───
//
// Each tool call → one CoachAction emitted to CoachScreen, which calls
// applyCoachActions() (src/utils/coachActions.ts) to do the actual store
// mutations. The kind ↔ tool name correspondence is 1:1.

interface CoachActionPayload {
  kind:
    | 'lighten_session'
    | 'move_session'
    | 'make_session_optional'
    | 'replace_exercise'
    | 'remove_exercise'
    | 'add_weekly_override'
    | 'ban_exercise_globally'
    | 'set_preferred_alternative';
  scope: 'local_adjustment' | 'weekly_adjustment' | 'permanent_preference';
  payload: Record<string, any>;
  reason?: string;
}

interface ProgramUpdate {
  workouts: any[];
}

interface CallResult {
  reply: string;
  actions?: CoachActionPayload[];
  newNotes?: string[];
  programUpdate?: ProgramUpdate;
}

function buildAthleteProfileContext(profile: AthleteProfile): string {
  const lines: string[] = [];
  lines.push("\n\nATHLETE PROFILE (from onboarding — use this to personalise everything):");

  if (profile.firstName) lines.push(`- Name: ${profile.firstName} (always call them by this name)`);
  if (profile.ageRange) lines.push(`- Age: ${profile.ageRange}`);
  if (profile.position) lines.push(`- Position: ${profile.position}`);
  if (profile.heightCm) lines.push(`- Height: ${profile.heightCm}cm`);
  if (profile.weightKg) lines.push(`- Weight: ${profile.weightKg}kg`);
  if (profile.seasonPhase) lines.push(`- Season phase: ${profile.seasonPhase}`);
  if (profile.gameDay) lines.push(`- Game day: ${profile.gameDay}`);
  if (profile.teamTrainingDaysPerWeek !== undefined) {
    lines.push(`- Team training: ${profile.teamTrainingDaysPerWeek} days/week`);
    if (profile.teamTrainingDays?.length) lines.push(`  Days: ${profile.teamTrainingDays.join(", ")}`);
  }
  if (profile.teamTrainingDuration) lines.push(`  Session length: ${profile.teamTrainingDuration}`);
  if (profile.teamTrainingIntensity) lines.push(`  Intensity: ${profile.teamTrainingIntensity}`);
  if (profile.trainingDaysPerWeek) lines.push(`- Own training days: ${profile.trainingDaysPerWeek} days/week`);
  if (profile.preferredTrainingDays?.length) lines.push(`  Preferred days: ${profile.preferredTrainingDays.join(", ")}`);
  if (profile.sessionDurationMinutes) lines.push(`- Session duration: ${profile.sessionDurationMinutes} minutes`);
  if (profile.trainingLocation) lines.push(`- Training location: ${profile.trainingLocation}`);
  if (profile.equipment?.length) lines.push(`- Equipment: ${profile.equipment.join(", ")}`);
  if (profile.experienceLevel) lines.push(`- Gym experience: ${profile.experienceLevel}`);
  if (profile.squatStrength) lines.push(`- Squat strength: ${profile.squatStrength}`);
  if (profile.benchStrength) lines.push(`- Bench strength: ${profile.benchStrength}`);
  if (profile.conditioningLevel) lines.push(`- Conditioning level: ${profile.conditioningLevel}`);
  if (profile.sprintExposure) lines.push(`- Sprint exposure: ${profile.sprintExposure}`);
  if (profile.recentTrainingLoad) lines.push(`- Recent training load (last 4 weeks): ${profile.recentTrainingLoad}`);
  if (profile.injuries?.length) {
    lines.push(`- Current injuries:`);
    for (const injury of profile.injuries) {
      const severity = injury.severity ? ` (${injury.severity})` : '';
      const triggers = injury.movementTriggers?.length ? ` — triggers: ${injury.movementTriggers.join(', ')}` : '';
      const notes = injury.notes ? ` — notes: ${injury.notes}` : '';
      lines.push(`  * ${injury.bodyArea}${severity}${triggers}${notes}`);
    }
  }
  if (profile.motivation) {
    const motivationStr = Array.isArray(profile.motivation)
      ? profile.motivation.join(', ')
      : profile.motivation;
    lines.push(`- Motivation / focus areas: ${motivationStr}`);
  }
  if (profile.successVision) lines.push(`- What success looks like this season: ${profile.successVision}`);

  lines.push("");
  lines.push("PERSONALISATION RULES (use the athlete profile above to make this feel custom-built):");
  lines.push("- Reference their MOTIVATION / FOCUS AREAS in session summaries and encouragement. E.g. if they want to make the senior team, say things like 'One step closer to that senior spot.'");
  lines.push("- Reinforce their SUCCESS VISION periodically. E.g. 'You said you wanted the best season of your life — this block is built for exactly that.'");
  lines.push("- INJURIES MODIFY TRAINING — THEY DO NOT ELIMINATE IT. You are an S&C coach, not a physio. Train AROUND injuries, don't stop training.");
  lines.push("  * Mild (niggle): Train normally. Only swap the specific movement that causes pain. Keep full structure.");
  lines.push("  * Moderate: Modify affected movements — reduce load, limit ROM, use alternatives. Keep weekly structure and session count intact.");
  lines.push("  * Severe: Remove only directly aggravating movements. Replace with safe alternatives that maintain training stimulus. Still program strength, power, and conditioning.");
  lines.push("  * Multiple injuries: Do NOT stack restrictions blindly. Look for overlap, find what they CAN do, and build around it. The program should NEVER become all-recovery unless every injury is severe AND constant.");
  lines.push("  * REPLACE, don't remove. Groin issue → reduce COD, add controlled strength. Shoulder issue → modify pressing, keep lower body + conditioning. Lower back → avoid heavy axial loading, use alternatives.");
  lines.push("  * Always maintain training pillars: strength work (modified if needed), power/speed exposure (if safe), conditioning (adjusted), and recovery.");
  lines.push("- Only program exercises possible with their EQUIPMENT. If they don't have a cable machine, don't program cable exercises.");
  lines.push("- Adjust complexity and loading based on EXPERIENCE LEVEL. Beginners get simpler movements, fewer sets, and more technique focus.");
  lines.push("- Respect SESSION DURATION. If they said 45 minutes, don't program 8-exercise sessions with conditioning blocks.");
  lines.push("- CRITICAL SAFETY: Use RECENT TRAINING LOAD to set starting volume. If they said 'Hardly at all (0-1 sessions/week)', start with LOW volume (2-3 sessions, no sprints in week 1, lighter loads, gradual ramp over 3-4 weeks). Never spike training load on a deconditioned athlete — that's when hamstrings and groins explode.");
  lines.push("- Don't overdo personalisation references — weave them in naturally, not every single message. Once every few interactions is the right cadence.");

  return lines.join("\n");
}

/**
 * Lean athlete context for program generation.
 * Only includes fields that directly affect exercise selection.
 * Omits: motivation, success vision, personalisation rules, detailed injury coaching guidance.
 */
function buildLeanAthleteContext(profile: AthleteProfile): string {
  const lines: string[] = ['\n\nATHLETE:'];
  if (profile.seasonPhase) lines.push(`Phase: ${profile.seasonPhase}`);
  if (profile.gameDay) lines.push(`Game day: ${profile.gameDay}`);
  if (profile.teamTrainingDays?.length) lines.push(`Team training: ${profile.teamTrainingDays.join(', ')}`);
  if (profile.preferredTrainingDays?.length) lines.push(`Gym days: ${profile.preferredTrainingDays.join(', ')}`);
  if (profile.sessionDurationMinutes) lines.push(`Session length: ${profile.sessionDurationMinutes}min`);
  if (profile.experienceLevel) {
    lines.push(`Experience: ${profile.experienceLevel}`);
    if (profile.experienceLevel === '2-5 years' || profile.experienceLevel === '5+ years') {
      lines.push('Eligible for contrast pairs (max 1 per CORE session).');
    }
  }
  if (profile.equipment?.length) lines.push(`Equipment: ${profile.equipment.join(', ')}`);
  if (profile.injuries?.length) {
    const injuryStrs = profile.injuries.map(i => {
      const parts = [i.bodyArea];
      if (i.severity) parts.push(i.severity);
      if (i.movementTriggers?.length) parts.push(`triggers: ${i.movementTriggers.join(', ')}`);
      return parts.join(' — ');
    });
    lines.push(`Injuries: ${injuryStrs.join('; ')}. Work around these — replace, don't remove.`);
  }
  if (profile.recentTrainingLoad === 'Hardly at all (0-1 sessions/week)') {
    lines.push('RAMP-UP: deconditioned athlete, start conservative volume.');
  }
  return lines.join('\n');
}

function buildCoachingConstraintsContext(plan: AIConstraints): string {
  const lines: string[] = [];
  lines.push("\n\n═══ COACHING ENGINE CONSTRAINTS ═══");
  lines.push("These constraints were pre-calculated by the deterministic coaching engine.");
  lines.push("When generating or modifying programs, follow these EXACTLY. Code decides the dose — you decide the details.");

  lines.push(`\nSEASON PHASE: ${plan.phase}`);
  lines.push(`READINESS: ${plan.readiness.toUpperCase()}`);
  lines.push(`HARD EXPOSURE CAP: ${plan.hardExposureCap} per week`);
  lines.push(`EXISTING HARD EXPOSURES (team/game): ${plan.existingHardExposures}`);
  lines.push(`REMAINING HARD BUDGET: ${plan.hardExposureCap - plan.existingHardExposures}`);

  lines.push(`\nSESSION ALLOCATION (pre-calculated — do NOT override):`);
  lines.push(`  CORE sessions: ${plan.coreSessionsToProgram} (hard strength sessions)`);
  lines.push(`  OPTIONAL sessions: ${plan.optionalSessionsAllowed} (low-fatigue — skip if fatigued)`);
  lines.push(`  RECOVERY sessions: ${plan.recoverySessionsAllowed} (mobility, foam rolling, walks)`);

  lines.push(`\nLOADING CONSTRAINTS:`);
  lines.push(`  Lower body: ${plan.lowerBodyLoading}`);
  lines.push(`  Sprint: ${plan.sprintLoading}`);
  lines.push(`  Conditioning: ${plan.conditioningLoading}`);
  if (plan.rampUp) {
    lines.push(`  RAMP-UP: Athlete needs gradual volume increase — start conservative`);
  }

  if (plan.injuryRestrictions.length > 0) {
    lines.push(`\nINJURY RESTRICTIONS (modify training, do NOT eliminate it):`);
    plan.injuryRestrictions.forEach((r) => lines.push(`  • ${r}`));
    lines.push(`  REMEMBER: Replace aggravating movements with safe alternatives. Keep training volume and session count. A good S&C coach finds what the athlete CAN do.`);
  }

  if (plan.priorities.length > 0) {
    lines.push(`PRIORITIES: ${plan.priorities.join(', ')}`);
  }

  lines.push(`MAX EXERCISES PER SESSION: ${plan.maxExercisesPerSession}`);

  if (plan.notes.length > 0) {
    lines.push("\nSAFETY NOTES:");
    plan.notes.forEach((n) => lines.push(`  • ${n}`));
  }

  lines.push("\nSESSION TIER LABELS (REQUIRED — include 'sessionTier' in EVERY workout):");
  lines.push('  "core" — non-negotiable strength sessions (2-4 per week)');
  lines.push('  "optional" — beneficial if time/energy allows, can be skipped (Friday arms, Monday flush)');
  lines.push('  "recovery" — low intensity only (post-game flush, mobility, stretching)');
  lines.push('  Rules: OPTIONAL must never interfere with CORE. Friday arm session = OPTIONAL always.');

  if (plan.phase === 'In-season') {
    lines.push("\n═══ IN-SEASON FATIGUE WAVE (NON-NEGOTIABLE) ═══");
    lines.push("Structure the ENTIRE week relative to game day:");
    lines.push("  Early week (game day −5 to −4): HIGHEST load — heavy strength goes here [CORE]");
    lines.push("  Mid week (game day −3): MODERATE — power/speed, no high-DOMS work [CORE]");
    lines.push("  Late week (game day −2): PUSH DOMINANT upper body ONLY. No pull/back sessions (rows, pull-ups, lats = stiffness) [CORE or OPTIONAL]");
    lines.push("  Game day −1: ZERO sprinting/speed/conditioning/lower body/plyometrics. Arms/pump ONLY [OPTIONAL]");
    lines.push("  Game day: Peak performance [CORE]");
    lines.push("  Post game: Recovery only [RECOVERY]");
    lines.push("  HARD RULES: Game day −2 = PUSH dominant only (no pull/back sessions). Game day −1 = ZERO sprinting/speed/conditioning/lower body/plyometrics (NO exceptions). No conditioning within 48h of game. No high-DOMS lower body after game day −4. No heavy lower body after game day −3.");
  }

  return lines.join("\n");
}

async function callCoachLLMAPI(messages: Message[], coachNotes: string[] = [], athleteProfile?: AthleteProfile, coachingPlan?: AIConstraints, currentProgramContext?: string, mode?: string): Promise<CallResult> {
  const startTime = Date.now();
  const provider = resolveCoachProvider();
  const apiKey = requireProviderKey(provider);

  // Build system prompt — lean version for program generation, full for coaching chat
  const isGenerate = mode === 'generate';
  let systemPrompt = isGenerate ? GENERATE_SYSTEM_PROMPT : SYSTEM_PROMPT;
  if (isGenerate) {
    debugLog('[coach-chat] Using LEAN generation prompt (mode=generate)');
  }

  if (athleteProfile && Object.keys(athleteProfile).length > 0) {
    systemPrompt += isGenerate
      ? buildLeanAthleteContext(athleteProfile)
      : buildAthleteProfileContext(athleteProfile);
  }
  if (coachingPlan) {
    systemPrompt += buildCoachingConstraintsContext(coachingPlan);
  }
  if (currentProgramContext) {
    systemPrompt += currentProgramContext;
  }
  if (coachNotes.length > 0) {
    systemPrompt += `\n\nUSER NOTES (remembered from previous conversations — always respect these):\n${coachNotes.map((n) => `- ${n}`).join("\n")}`;
  }

  // Log prompt metrics
  const systemPromptWords = systemPrompt.split(/\s+/).length;
  const userMsgContent = typeof messages[0]?.content === 'string' ? messages[0].content : JSON.stringify(messages[0]?.content);
  const userMsgWords = userMsgContent?.split(/\s+/).length || 0;
  debugLog(`[coach-chat] System prompt: ${systemPromptWords} words (~${Math.round(systemPromptWords * 1.3)} tokens)`);
  debugLog(`[coach-chat] User message: ${userMsgWords} words (~${Math.round(userMsgWords * 1.3)} tokens)`);
  debugLog(`[coach-chat] Messages count: ${messages.length}`);

  // Per-request timeout: 55 seconds to stay within Supabase edge function limits
  const REQUEST_TIMEOUT_MS = 55_000;

  // ── Model + retry config ──
  // Primary provider is OpenAI when OPENAI_API_KEY is configured, unless
  // COACH_LLM_PROVIDER explicitly selects Anthropic. The coaching engine
  // still owns structure; the model supplies language and tool intents.
  // Policy: 2 primary attempts → 2 fallback attempts. Faster failover than 3+0.
  const PRIMARY_MODEL = provider === "openai"
    ? getOpenAIModel("chat", "primary")
    : getAnthropicModel("chat", "primary");
  const FALLBACK_MODEL = provider === "openai"
    ? getOpenAIModel("chat", "fallback")
    : getAnthropicModel("chat", "fallback");
  const runtimeDiagnostic = {
    mode: isGenerate ? "generate" : "chat",
    isGenerate,
    provider,
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
  };
  if (isGenerate) {
    infoLog("[coach-chat] Generate LLM config", runtimeDiagnostic);
  }
  const ATTEMPTS_PER_MODEL = 2;
  const BASE_DELAY_MS = 1500; // exponential: ~1.5s, ~3s
  const RETRYABLE_STATUSES = provider === "openai"
    ? new Set([429, 500, 502, 503, 504])
    : new Set([529, 503]);

  /** Send a single LLM request. Returns an Anthropic-shaped response or throws. */
  const sendRequest = async (msgs: any[], model: string, label: string): Promise<AnthropicResponse> => {
    const reqStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const coachTools = isGenerate
        ? [UPDATE_PROGRAM_TOOL]
        : [
            LIGHTEN_SESSION_TOOL,
            MOVE_SESSION_TOOL,
            MAKE_SESSION_OPTIONAL_TOOL,
            REPLACE_EXERCISE_TOOL,
            REMOVE_EXERCISE_TOOL,
            ADD_WEEKLY_OVERRIDE_TOOL,
            BAN_EXERCISE_GLOBALLY_TOOL,
            SET_PREFERRED_ALTERNATIVE_TOOL,
            SUGGEST_SUBSTITUTES_TOOL,
            SAVE_NOTE_TOOL,
          ];

      const response = provider === "openai"
        ? await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            instructions: systemPrompt,
            input: toOpenAIInput(msgs),
            tools: coachTools.map(toOpenAIFunctionTool),
            max_output_tokens: 4096,
            ...(isGenerate
              ? { tool_choice: { type: "function", name: "update_program" } }
              : {}),
          }),
          signal: controller.signal,
        })
        : await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: msgs,
            tools: coachTools,
            // Generate mode FORCES update_program — the LLM cannot respond in prose.
            ...(isGenerate
              ? { tool_choice: { type: "tool", name: "update_program" } }
              : {}),
          }),
          signal: controller.signal,
        });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - reqStart;
      debugLog(`[coach-chat] ${label}: status=${response.status} in ${elapsed}ms (model=${model})`);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[coach-chat] ${label}: API error ${response.status}`);
        debugLog(`[coach-chat] ${label}: API error body preview: ${errorBody.substring(0, 300)}`);
        const err = new Error(`${provider === "openai" ? "OpenAI" : "Anthropic"} API error: ${response.status} - ${errorBody.substring(0, 300)}`);
        (err as any).status = response.status;
        attachRuntimeDiagnostic(err, {
          ...runtimeDiagnostic,
          attemptedModel: model,
          attemptLabel: label,
          apiStatus: response.status,
          apiErrorPreview: safePreview(errorBody, 500),
        });
        throw err;
      }

      const json = await response.json();
      const normalized = provider === "openai" ? normalizeOpenAIResponse(json) : json as AnthropicResponse;
      debugLog(`[coach-chat] ${label}: stop_reason=${normalized.stop_reason}, content_blocks=${normalized.content?.length} (provider=${provider}, model=${model})`);
      if (json.usage) {
        debugLog(`[coach-chat] ${label}: usage input=${json.usage.input_tokens} output=${json.usage.output_tokens}`);
      }
      return normalized;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const elapsed = Date.now() - reqStart;
        console.error(`[coach-chat] ${label}: TIMEOUT after ${elapsed}ms (model=${model})`);
        const timeoutError = new Error(`${provider === "openai" ? "OpenAI" : "Anthropic"} API timeout after ${Math.round(elapsed / 1000)}s — prompt may be too large or model too slow`);
        attachRuntimeDiagnostic(timeoutError, {
          ...runtimeDiagnostic,
          attemptedModel: model,
          attemptLabel: label,
          timeoutMs: REQUEST_TIMEOUT_MS,
          elapsedMs: elapsed,
        });
        throw timeoutError;
      }
      throw err;
    }
  };

  /** Is this error a transient overload we should retry / fall back for? */
  const isRetryable = (err: any): boolean => {
    if (err?.status && RETRYABLE_STATUSES.has(err.status)) return true;
    // Network/fetch failures (not timeouts, not [OVERLOADED] re-throws)
    if (err?.name === 'TypeError' && /fetch|network/i.test(err.message)) return true;
    return false;
  };

  /**
   * Try a model up to ATTEMPTS_PER_MODEL times with exponential backoff.
   * Returns the response on success, or throws the last error.
   */
  const tryModel = async (msgs: any[], model: string, baseLabel: string): Promise<AnthropicResponse> => {
    let lastError: any;

    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      const role = model === PRIMARY_MODEL ? "primary" : "fallback";
      const label = `${baseLabel} (${role} attempt ${attempt}/${ATTEMPTS_PER_MODEL})`;
      try {
        const result = await sendRequest(msgs, model, label);
        if (attempt > 1) {
          debugLog(`[coach-chat] ${baseLabel}: ${model} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (err: any) {
        lastError = err;

        // Non-retryable errors — don't waste another attempt
        if (!isRetryable(err)) {
          console.error(`[coach-chat] ${baseLabel}: non-retryable error on ${model}, not retrying — ${safeErrorSummary(err)}`);
          throw err;
        }

        // Retryable but more attempts left — backoff and retry
        if (attempt < ATTEMPTS_PER_MODEL) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          debugLog(`[coach-chat] ${baseLabel}: retryable error on ${model} attempt ${attempt}, waiting ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All attempts for this model exhausted
    throw lastError;
  };

  /**
   * makeRequest: tries primary model, falls back to secondary on retryable exhaustion.
   * Non-retryable errors (400, 401, timeout, etc.) always throw immediately.
   */
  const makeRequest = async (msgs: any[], label: string): Promise<AnthropicResponse> => {
    // ── Primary model ──
    try {
      return await tryModel(msgs, PRIMARY_MODEL, label);
    } catch (primaryErr: any) {
      // Non-retryable — don't fall back, surface immediately
      if (!isRetryable(primaryErr)) {
        throw primaryErr;
      }
      debugLog(`[coach-chat] ${label}: primary model (${PRIMARY_MODEL}) exhausted after ${ATTEMPTS_PER_MODEL} retryable failures, falling back to ${FALLBACK_MODEL}`);
    }

    // ── Fallback model ──
    try {
      const result = await tryModel(msgs, FALLBACK_MODEL, label);
      debugLog(`[coach-chat] ${label}: fallback model (${FALLBACK_MODEL}) succeeded`);
      return result;
    } catch (fallbackErr: any) {
      console.error(`[coach-chat] ${label}: fallback model (${FALLBACK_MODEL}) also failed — ${safeErrorSummary(fallbackErr)}`);

      if (isRetryable(fallbackErr)) {
        const overloadedError = new Error(`[OVERLOADED] Both ${PRIMARY_MODEL} and ${FALLBACK_MODEL} unavailable after ${ATTEMPTS_PER_MODEL * 2} total attempts`);
        attachRuntimeDiagnostic(overloadedError, {
          ...runtimeDiagnostic,
          finalError: safeErrorSummary(fallbackErr),
          fallbackDiagnostic: readRuntimeDiagnostic(fallbackErr),
        });
        throw overloadedError;
      }
      throw fallbackErr;
    }
  };

  // Tool use loop — may need multiple rounds if coach uses multiple tools.
  // Each scoped tool call → one CoachActionPayload pushed to `actions[]`.
  // `save_note` is the only non-action tool; it goes to `newNotes[]`.
  let data = await makeRequest(messages, "call-1");
  const actions: CoachActionPayload[] = [];
  const newNotes: string[] = [];
  let programUpdate: ProgramUpdate | undefined;
  let currentMessages = [...messages];
  let callCount = 1;

  // ── Generate-mode short-circuit ──
  // tool_choice forces a single update_program tool_use. Capture and return.
  if (isGenerate && data.stop_reason === "tool_use") {
    const block = data.content.find(
      (b) => b.type === "tool_use" && b.name === "update_program",
    );
    if (block && Array.isArray(block.input?.workouts)) {
      programUpdate = { workouts: block.input.workouts };
      debugLog(
        `[coach-chat] update_program captured: ${block.input.workouts.length} workouts`,
      );
      const totalElapsed = Date.now() - startTime;
      debugLog(
        `[coach-chat] Generate complete: 1 API call in ${totalElapsed}ms`,
      );
      return {
        reply: "",
        programUpdate,
      };
    }
    console.error(
      "[coach-chat] Generate mode: expected update_program tool_use but did not get one",
    );
    const generateSchemaError = new Error(
      "Generate mode expected update_program tool_use but did not get one",
    );
    attachRuntimeDiagnostic(generateSchemaError, {
      ...runtimeDiagnostic,
      stopReason: data.stop_reason,
      contentTypes: (data.content ?? []).map((block) => block?.type),
      outputTextPreview: safePreview(
        data.content?.filter((block) => block?.type === "text").map((block) => block.text).join(" "),
        500,
      ),
    });
    throw generateSchemaError;
  }

  // Tool name → CoachAction kind + scope. Keep this table in sync with
  // src/utils/coachActions.ts CoachActionKind / ScopeKind unions.
  const TOOL_DISPATCH: Record<
    string,
    { kind: CoachActionPayload['kind']; scope: CoachActionPayload['scope'] }
  > = {
    lighten_session:           { kind: 'lighten_session',           scope: 'local_adjustment' },
    move_session:              { kind: 'move_session',              scope: 'local_adjustment' },
    make_session_optional:     { kind: 'make_session_optional',     scope: 'local_adjustment' },
    replace_exercise:          { kind: 'replace_exercise',          scope: 'local_adjustment' },
    remove_exercise:           { kind: 'remove_exercise',           scope: 'local_adjustment' },
    add_weekly_override:       { kind: 'add_weekly_override',       scope: 'weekly_adjustment' },
    ban_exercise_globally:     { kind: 'ban_exercise_globally',     scope: 'permanent_preference' },
    set_preferred_alternative: { kind: 'set_preferred_alternative', scope: 'permanent_preference' },
  };

  while (data.stop_reason === "tool_use") {
    callCount++;
    const toolBlocks = data.content.filter((b) => b.type === "tool_use");
    const toolResults: any[] = [];

    debugLog(`[coach-chat] Tool use round ${callCount - 1}: ${toolBlocks.map(b => b.name).join(', ')}`);

    for (const toolBlock of toolBlocks) {
      const dispatch = TOOL_DISPATCH[toolBlock.name];

      if (dispatch) {
        // Scoped action tool: split out reason from payload.
        const { reason, ...rest } = (toolBlock.input || {}) as Record<string, any>;
        actions.push({
          kind: dispatch.kind,
          scope: dispatch.scope,
          payload: rest,
          reason: typeof reason === 'string' ? reason : undefined,
        });
        debugLog(`[coach-chat] action queued: ${dispatch.kind} (${dispatch.scope})`);
        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: toolBlock.id,
          // Tell the model the action is queued, not yet applied — the client
          // will apply and the next reply turn just summarizes.
          content: `Action queued: ${dispatch.kind}. The client will apply it; verify in your final reply against the resolved week (do not assume success — the diff will tell you).`,
        });
      } else if (toolBlock.name === "save_note") {
        const note = toolBlock.input?.note;
        if (note) newNotes.push(note);
        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: toolBlock.id,
          content: "Note saved successfully.",
        });
      } else if (toolBlock.name === "suggest_substitutes") {
        // QUERY-ONLY: compute candidates inline and hand them back to
        // the model in this tool-use round so it can name them in its
        // reply. NOT an action — nothing is mutated, nothing is queued
        // for the client.
        const exerciseName = (toolBlock.input?.exercise || '').toString();
        const injuries = buildInjuryMapForSubstitutes(athleteProfile?.injuries);
        // Athlete's available equipment is best-effort: profile.equipment
        // is a free-text list. We map common entries to EmbeddedEquipment.
        let availableEquipment: EmbeddedEquipment[] | undefined;
        if (athleteProfile?.equipment?.length) {
          const eqLower = athleteProfile.equipment.map((e) => e.toLowerCase());
          const map: Array<[string, EmbeddedEquipment]> = [
            ['barbell', 'barbell'], ['dumbbell', 'dumbbell'], ['kettlebell', 'kettlebell'],
            ['cable', 'cable'], ['machine', 'machine'], ['bodyweight', 'bodyweight'],
          ];
          const detected = new Set<EmbeddedEquipment>();
          for (const [needle, klass] of map) {
            if (eqLower.some((e) => e.includes(needle))) detected.add(klass);
          }
          if (detected.size > 0) availableEquipment = Array.from(detected);
        }

        // Optional explicit overhead-pull constraint hinted by the model.
        const reasonText = (toolBlock.input?.reason || '').toString().toLowerCase();
        const avoidOverheadPull =
          /overhead|vertical pull/.test(reasonText) ||
          toolBlock.input?.avoid_overhead_pull === true;

        const { slot, candidates } = embeddedGetSubstitutes(
          exerciseName,
          injuries,
          availableEquipment,
          avoidOverheadPull,
        );
        let content: string;
        if (!slot || candidates.length === 0) {
          content = `No safe pattern-preserving substitutes found for "${exerciseName}". Pattern may need to be dropped or the exercise isn't in a substitutable family (core / conditioning / plyo / iso).`;
        } else {
          const lines = candidates.map((c) => {
            const reasonStr = c.reason ? ` — ${c.reason}` : '';
            const axes = c.differsOn.length > 0 ? ` [differs on: ${c.differsOn.join(', ')}]` : '';
            return `• ${c.name}${reasonStr}${axes}`;
          });
          // Surface the slot — when fallback fired, candidates may span
          // both vertical_pull and horizontal_pull.
          const slots = Array.from(new Set(candidates.map((c) => c.slot)));
          const familyLabel = slots.length > 1 ? slots.join(' / ') : slots[0];
          const countNote =
            candidates.length === 1
              ? '\n\nOnly one meaningfully-different option exists. Offer just this one — do not invent a second.'
              : '\n\nUse these names verbatim when offering the swap. Lead with both options; let the athlete pick.';
          content = `Substitutes for "${exerciseName}" (${familyLabel} family):\n${lines.join('\n')}${countNote}`;
        }
        debugLog(`[coach-chat] suggest_substitutes: ${exerciseName} → [${candidates.map((c) => c.name).join(', ')}] (slot=${slot}, avoidOverhead=${avoidOverheadPull})`);
        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: toolBlock.id,
          content,
        });
      } else {
        // Unknown tool name — log and surface a soft error to the model so
        // it doesn't loop on a typo.
        console.warn(`[coach-chat] Unknown tool: ${toolBlock.name}`);
        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: toolBlock.id,
          content: `Unknown tool: ${toolBlock.name}. Available: ${Object.keys(TOOL_DISPATCH).join(', ')}, save_note.`,
        });
      }
    }

    const assistantContent = provider === "openai" && data.openAIOutput
      ? data.openAIOutput
      : data.content;

    currentMessages = [
      ...currentMessages,
      { role: "assistant" as const, content: assistantContent },
      { role: "user" as const, content: toolResults },
    ];

    // Safety: cap at 5 tool rounds to prevent infinite loops
    if (callCount > 5) {
      console.error("[coach-chat] Exceeded max tool rounds (5). Breaking loop.");
      break;
    }

    data = await makeRequest(currentMessages, `call-${callCount}`);
  }

  // Extract text reply
  const textContent = data.content.find((b) => b.type === "text");
  const reply = textContent?.text || "Done. Check your program tab.";

  const totalElapsed = Date.now() - startTime;
  debugLog(`[coach-chat] Complete: ${callCount} API calls in ${totalElapsed}ms. actions=${actions.length}, notes=${newNotes.length}`);

  return {
    reply,
    actions: actions.length > 0 ? actions : undefined,
    newNotes: newNotes.length > 0 ? newNotes : undefined,
    programUpdate,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SUBSTITUTION HELPER (deno mirror of src/utils/exerciseSubstitutes.ts)
// ═══════════════════════════════════════════════════════════════════════
//
// The deno edge function can't import from src/, so this is a compact
// mirror of the substitution helper. KEEP IN SYNC with:
//   - src/data/exercisePoolsStrength.ts STRENGTH_POOLS
//   - src/data/exerciseTags.ts EXERCISE_TAGS (relevant fields)
//   - src/utils/loadEstimation.ts EXERCISE_ALIASES + EXERCISE_LOAD_MAP equipment
//   - src/utils/exerciseSubstitutes.ts algorithm
//
// When pools or tags change in src/, update this mirror. The substitution
// algorithm itself is the same.

type EmbeddedRole = 'anchor' | 'accessory';
type EmbeddedSlot =
  | 'squat' | 'hinge'
  | 'horizontal_push' | 'vertical_push'
  | 'horizontal_pull' | 'vertical_pull';

interface EmbeddedPoolEntry { name: string; loadRatio: number; role: EmbeddedRole; }

const EMBEDDED_POOLS: Record<EmbeddedSlot, EmbeddedPoolEntry[]> = {
  squat: [
    { name: 'Back Squat',  loadRatio: 1.00, role: 'anchor' },
    { name: 'Front Squat', loadRatio: 0.85, role: 'anchor' },
    { name: 'Box Squat',   loadRatio: 0.95, role: 'anchor' },
    { name: 'Walking Lunges',         loadRatio: 0.45, role: 'accessory' },
    { name: 'Bulgarian Split Squats', loadRatio: 0.40, role: 'accessory' },
    { name: 'Reverse Lunges',         loadRatio: 0.45, role: 'accessory' },
    { name: 'Step Ups',               loadRatio: 0.40, role: 'accessory' },
  ],
  hinge: [
    { name: 'Deadlift',          loadRatio: 1.00, role: 'anchor' },
    { name: 'Trap Bar Deadlift', loadRatio: 1.05, role: 'anchor' },
    { name: 'RDLs',              loadRatio: 0.80, role: 'anchor' },
    { name: 'Single-Leg RDL',    loadRatio: 0.45, role: 'accessory' },
    { name: 'Hip Thrusts',       loadRatio: 1.10, role: 'accessory' },
    { name: 'Kettlebell Swings', loadRatio: 0.35, role: 'accessory' },
  ],
  horizontal_push: [
    { name: 'Bench Press',      loadRatio: 1.00, role: 'anchor' },
    { name: 'Incline Bench',    loadRatio: 0.85, role: 'anchor' },
    { name: 'Close Grip Bench', loadRatio: 0.90, role: 'anchor' },
    { name: 'DB Bench Press',   loadRatio: 0.80, role: 'accessory' },
    { name: 'Incline DB Bench', loadRatio: 0.70, role: 'accessory' },
    { name: 'Push-ups',         loadRatio: 0.00, role: 'accessory' },
    { name: 'Dips',             loadRatio: 0.60, role: 'accessory' },
  ],
  vertical_push: [
    { name: 'Overhead Press', loadRatio: 1.00, role: 'anchor' },
    { name: 'Landmine Press', loadRatio: 0.70, role: 'anchor' },
    { name: 'DB Shoulder Press',                       loadRatio: 0.55, role: 'accessory' },
    { name: 'Seated DB Press',                         loadRatio: 0.55, role: 'accessory' },
    { name: 'Half-Kneeling Single-Arm Overhead Press', loadRatio: 0.35, role: 'accessory' },
    { name: 'Z-Press',                                 loadRatio: 0.60, role: 'accessory' },
  ],
  horizontal_pull: [
    { name: 'Barbell Row',         loadRatio: 1.00, role: 'anchor' },
    { name: 'Chest Supported Row', loadRatio: 0.85, role: 'anchor' },
    { name: 'Single-Arm DB Row',   loadRatio: 0.60, role: 'anchor' },
    { name: 'Seated Cable Row',    loadRatio: 0.90, role: 'accessory' },
    { name: 'Face Pull',           loadRatio: 0.20, role: 'accessory' },
  ],
  vertical_pull: [
    { name: 'Pull-Ups',                loadRatio: 1.00, role: 'anchor' },
    { name: 'Chin-Ups',                loadRatio: 1.00, role: 'anchor' },
    { name: 'Lat Pulldown',            loadRatio: 0.80, role: 'accessory' },
    { name: 'Neutral-Grip Pulldown',   loadRatio: 0.80, role: 'accessory' },
    { name: 'Single-Arm Lat Pulldown', loadRatio: 0.40, role: 'accessory' },
  ],
};

// Compact tag mirror — only fields used by the substitution algorithm.
type EmbeddedRating = 'good' | 'caution' | 'avoid';
type EmbeddedLevel = 'low' | 'moderate' | 'high';
type EmbeddedEquipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell';
interface EmbeddedTag {
  unilateral: boolean;
  load: EmbeddedLevel;
  fatigue: EmbeddedLevel;
  region: 'lower' | 'upper' | 'full' | 'core';
  doms: EmbeddedLevel;
  eccentric: EmbeddedLevel;
  stability: EmbeddedLevel;
  injury: { lowerBack: EmbeddedRating; shoulder: EmbeddedRating; knee: EmbeddedRating; hamstring: EmbeddedRating; adductor: EmbeddedRating; calf: EmbeddedRating; ankle: EmbeddedRating; elbow: EmbeddedRating; wrist: EmbeddedRating; pubalgia: EmbeddedRating };
  equipment: EmbeddedEquipment;
  movement: 'squat' | 'lunge' | 'hinge' | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull';
}

// Defaults reduce the per-entry weight. Override only the fields that aren't 'good'/baseline.
const DEFAULT_INJURY = {
  lowerBack: 'good' as EmbeddedRating, shoulder: 'good' as EmbeddedRating, knee: 'good' as EmbeddedRating,
  hamstring: 'good' as EmbeddedRating, adductor: 'good' as EmbeddedRating, calf: 'good' as EmbeddedRating,
  ankle: 'good' as EmbeddedRating, elbow: 'good' as EmbeddedRating, wrist: 'good' as EmbeddedRating,
  pubalgia: 'good' as EmbeddedRating,
};

const t = (
  partial: Partial<EmbeddedTag> & Pick<EmbeddedTag, 'movement' | 'load' | 'fatigue' | 'region' | 'equipment'>,
): EmbeddedTag => ({
  unilateral: false,
  doms: 'low',
  eccentric: 'low',
  stability: 'high',
  injury: { ...DEFAULT_INJURY, ...(partial.injury || {}) },
  ...partial,
});

const EMBEDDED_TAGS: Record<string, EmbeddedTag> = {
  // Squat family
  'Back Squat':              t({ movement: 'squat', load: 'high',     fatigue: 'high',     region: 'lower', equipment: 'barbell',  doms: 'high', eccentric: 'moderate', injury: { lowerBack: 'caution', knee: 'caution' } }),
  'Front Squat':             t({ movement: 'squat', load: 'high',     fatigue: 'high',     region: 'lower', equipment: 'barbell',  doms: 'high', eccentric: 'moderate', injury: { knee: 'caution', wrist: 'caution' } }),
  'Box Squat':               t({ movement: 'squat', load: 'high',     fatigue: 'moderate', region: 'lower', equipment: 'barbell',  doms: 'moderate', eccentric: 'low' }),
  'Walking Lunges':          t({ movement: 'lunge', load: 'moderate', fatigue: 'moderate', region: 'lower', equipment: 'dumbbell', unilateral: true, doms: 'high', eccentric: 'high', injury: { knee: 'caution', adductor: 'caution' } }),
  'Bulgarian Split Squats':  t({ movement: 'lunge', load: 'moderate', fatigue: 'moderate', region: 'lower', equipment: 'dumbbell', unilateral: true, doms: 'high', eccentric: 'high', injury: { knee: 'caution' } }),
  'Reverse Lunges':          t({ movement: 'lunge', load: 'moderate', fatigue: 'moderate', region: 'lower', equipment: 'dumbbell', unilateral: true, doms: 'moderate', eccentric: 'moderate' }),
  'Step Ups':                t({ movement: 'lunge', load: 'low',      fatigue: 'low',      region: 'lower', equipment: 'dumbbell', unilateral: true, doms: 'low', eccentric: 'low' }),
  // Hinge family
  'Deadlift':                t({ movement: 'hinge', load: 'high',     fatigue: 'high',     region: 'full',  equipment: 'barbell',  doms: 'moderate', eccentric: 'moderate', injury: { lowerBack: 'caution', hamstring: 'caution' } }),
  'Trap Bar Deadlift':       t({ movement: 'hinge', load: 'high',     fatigue: 'high',     region: 'full',  equipment: 'barbell',  doms: 'moderate', eccentric: 'moderate', injury: { lowerBack: 'good', hamstring: 'caution' } }),
  'RDLs':                    t({ movement: 'hinge', load: 'high',     fatigue: 'moderate', region: 'lower', equipment: 'barbell',  doms: 'high', eccentric: 'high', injury: { lowerBack: 'caution', hamstring: 'caution' } }),
  'Single-Leg RDL':          t({ movement: 'hinge', load: 'low',      fatigue: 'low',      region: 'lower', equipment: 'dumbbell', unilateral: true, doms: 'moderate', eccentric: 'moderate', stability: 'low' }),
  'Hip Thrusts':             t({ movement: 'hinge', load: 'high',     fatigue: 'moderate', region: 'lower', equipment: 'barbell',  doms: 'moderate', eccentric: 'low', injury: { lowerBack: 'good' } }),
  'Kettlebell Swings':       t({ movement: 'hinge', load: 'low',      fatigue: 'moderate', region: 'full',  equipment: 'kettlebell', doms: 'low', eccentric: 'low' }),
  // Horizontal push
  'Bench Press':             t({ movement: 'horizontal_push', load: 'high', fatigue: 'high',     region: 'upper', equipment: 'barbell',  doms: 'moderate', eccentric: 'moderate', injury: { shoulder: 'caution' } }),
  'Incline Bench':           t({ movement: 'horizontal_push', load: 'high', fatigue: 'moderate', region: 'upper', equipment: 'barbell',  doms: 'moderate', eccentric: 'moderate', injury: { shoulder: 'caution' } }),
  'Close Grip Bench':        t({ movement: 'horizontal_push', load: 'high', fatigue: 'moderate', region: 'upper', equipment: 'barbell',  doms: 'moderate', eccentric: 'moderate', injury: { elbow: 'caution' } }),
  'DB Bench Press':          t({ movement: 'horizontal_push', load: 'moderate', fatigue: 'moderate', region: 'upper', equipment: 'dumbbell', doms: 'moderate', eccentric: 'moderate', injury: { shoulder: 'good' } }),
  'Incline DB Bench':        t({ movement: 'horizontal_push', load: 'moderate', fatigue: 'moderate', region: 'upper', equipment: 'dumbbell', doms: 'moderate', eccentric: 'moderate' }),
  'Push-ups':                t({ movement: 'horizontal_push', load: 'low',      fatigue: 'low',      region: 'upper', equipment: 'bodyweight', doms: 'low', eccentric: 'low' }),
  'Dips':                    t({ movement: 'horizontal_push', load: 'moderate', fatigue: 'moderate', region: 'upper', equipment: 'bodyweight', doms: 'moderate', eccentric: 'moderate', injury: { shoulder: 'caution' } }),
  // Vertical push
  'Overhead Press':          t({ movement: 'vertical_push', load: 'high', fatigue: 'moderate', region: 'upper', equipment: 'barbell', doms: 'moderate', eccentric: 'moderate', injury: { shoulder: 'caution', lowerBack: 'caution' } }),
  'Landmine Press':          t({ movement: 'vertical_push', load: 'moderate', fatigue: 'low', region: 'upper', equipment: 'barbell', doms: 'low', eccentric: 'low', injury: { shoulder: 'good' } }),
  'DB Shoulder Press':       t({ movement: 'vertical_push', load: 'moderate', fatigue: 'moderate', region: 'upper', equipment: 'dumbbell', doms: 'moderate', eccentric: 'moderate', injury: { shoulder: 'caution' } }),
  'Seated DB Press':         t({ movement: 'vertical_push', load: 'moderate', fatigue: 'moderate', region: 'upper', equipment: 'dumbbell', doms: 'moderate', eccentric: 'moderate' }),
  'Half-Kneeling Single-Arm Overhead Press': t({ movement: 'vertical_push', load: 'low', fatigue: 'low', region: 'upper', equipment: 'dumbbell', unilateral: true, doms: 'low', eccentric: 'low', stability: 'moderate' }),
  'Z-Press':                 t({ movement: 'vertical_push', load: 'moderate', fatigue: 'moderate', region: 'upper', equipment: 'barbell', doms: 'moderate', eccentric: 'moderate' }),
  // Horizontal pull
  'Barbell Row':             t({ movement: 'horizontal_pull', load: 'high', fatigue: 'moderate', region: 'upper', equipment: 'barbell', doms: 'moderate', eccentric: 'moderate', injury: { lowerBack: 'caution' } }),
  'Chest Supported Row':     t({ movement: 'horizontal_pull', load: 'moderate', fatigue: 'low', region: 'upper', equipment: 'dumbbell', doms: 'low', eccentric: 'low', injury: { lowerBack: 'good' } }),
  'Single-Arm DB Row':       t({ movement: 'horizontal_pull', load: 'moderate', fatigue: 'low', region: 'upper', equipment: 'dumbbell', unilateral: true, doms: 'low', eccentric: 'low' }),
  'Seated Cable Row':        t({ movement: 'horizontal_pull', load: 'moderate', fatigue: 'low', region: 'upper', equipment: 'cable', doms: 'low', eccentric: 'low' }),
  'Face Pull':               t({ movement: 'horizontal_pull', load: 'low', fatigue: 'low', region: 'upper', equipment: 'cable', doms: 'low', eccentric: 'low' }),
  // Vertical pull
  'Pull-Ups':                t({ movement: 'vertical_pull', load: 'high', fatigue: 'moderate', region: 'upper', equipment: 'bodyweight', doms: 'moderate', eccentric: 'moderate', injury: { shoulder: 'caution', elbow: 'caution' } }),
  'Chin-Ups':                t({ movement: 'vertical_pull', load: 'high', fatigue: 'moderate', region: 'upper', equipment: 'bodyweight', doms: 'moderate', eccentric: 'moderate', injury: { elbow: 'caution' } }),
  'Lat Pulldown':            t({ movement: 'vertical_pull', load: 'moderate', fatigue: 'low', region: 'upper', equipment: 'cable', doms: 'low', eccentric: 'low' }),
  'Neutral-Grip Pulldown':   t({ movement: 'vertical_pull', load: 'moderate', fatigue: 'low', region: 'upper', equipment: 'cable', doms: 'low', eccentric: 'low', injury: { shoulder: 'good' } }),
  'Single-Arm Lat Pulldown': t({ movement: 'vertical_pull', load: 'low', fatigue: 'low', region: 'upper', equipment: 'cable', unilateral: true, doms: 'low', eccentric: 'low' }),
};

// Compact alias map for the most common Coach inputs.
const EMBEDDED_ALIASES: Record<string, string> = {
  'rdl': 'RDLs',
  'rdls': 'RDLs',
  'romanian deadlift': 'RDLs',
  'romanian deadlifts': 'RDLs',
  'sl rdl': 'Single-Leg RDL',
  'single leg rdl': 'Single-Leg RDL',
  'single-leg rdl': 'Single-Leg RDL',
  'barbell squat': 'Back Squat',
  'back squats': 'Back Squat',
  'front squats': 'Front Squat',
  'deadlifts': 'Deadlift',
  'conventional deadlift': 'Deadlift',
  'trap bar deadlifts': 'Trap Bar Deadlift',
  'hex bar deadlift': 'Trap Bar Deadlift',
  'bench': 'Bench Press',
  'flat bench': 'Bench Press',
  'pullup': 'Pull-Ups',
  'pull ups': 'Pull-Ups',
  'pullups': 'Pull-Ups',
  'chin up': 'Chin-Ups',
  'chinups': 'Chin-Ups',
  'pulldown': 'Lat Pulldown',
  'pulldowns': 'Lat Pulldown',
  'ohp': 'Overhead Press',
  'press': 'Overhead Press',
  'shoulder press': 'DB Shoulder Press',
  'split squat': 'Bulgarian Split Squats',
  'bulgarian': 'Bulgarian Split Squats',
  'hip thrust': 'Hip Thrusts',
  'kb swings': 'Kettlebell Swings',
  'kb swing': 'Kettlebell Swings',
};

function embeddedResolveAlias(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (EMBEDDED_TAGS[trimmed]) return trimmed;
  if (EMBEDDED_ALIASES[lower]) return EMBEDDED_ALIASES[lower];
  if (lower.endsWith('s') && EMBEDDED_ALIASES[lower.slice(0, -1)]) {
    return EMBEDDED_ALIASES[lower.slice(0, -1)];
  }
  // Last resort: case-insensitive scan over the tag map.
  for (const k of Object.keys(EMBEDDED_TAGS)) {
    if (k.toLowerCase() === lower) return k;
  }
  return trimmed;
}

function embeddedFindSlot(name: string): EmbeddedSlot | null {
  for (const slot of Object.keys(EMBEDDED_POOLS) as EmbeddedSlot[]) {
    if (EMBEDDED_POOLS[slot].some((e) => e.name === name)) return slot;
  }
  // Tag-based fallback: lunge → squat slot.
  const tag = EMBEDDED_TAGS[name];
  if (!tag) return null;
  if (tag.movement === 'lunge') return 'squat';
  return tag.movement as EmbeddedSlot;
}

type DiffAxis = 'load' | 'structure' | 'spinal_stress' | 'equipment' | 'fatigue';

function embeddedDiffAxes(
  o: { tag: EmbeddedTag | undefined; loadRatio: number; equipment: EmbeddedEquipment | null },
  c: { tag: EmbeddedTag | undefined; loadRatio: number; equipment: EmbeddedEquipment | null },
): DiffAxis[] {
  const axes: DiffAxis[] = [];
  if (Math.abs(c.loadRatio - o.loadRatio) >= 0.2) axes.push('load');
  if (o.tag && c.tag && o.tag.unilateral !== c.tag.unilateral) axes.push('structure');
  if (o.tag && c.tag && o.tag.injury.lowerBack !== c.tag.injury.lowerBack) axes.push('spinal_stress');
  if (o.equipment && c.equipment && o.equipment !== c.equipment) axes.push('equipment');
  if (o.tag && c.tag && o.tag.fatigue !== c.tag.fatigue) axes.push('fatigue');
  return axes;
}

function embeddedPassesInjury(
  tag: EmbeddedTag,
  injuries: Record<string, 'caution' | 'avoid'>,
): boolean {
  for (const [areaRaw, severity] of Object.entries(injuries)) {
    const area = areaRaw as keyof EmbeddedTag['injury'];
    const rating = tag.injury[area];
    if (rating === 'avoid') return false;
    if (severity === 'avoid') {
      if (area === 'hamstring') {
        if (tag.eccentric === 'high' && tag.region === 'lower') return false;
        if (tag.doms === 'high' && tag.movement === 'hinge') return false;
      }
      if (area === 'adductor' && tag.movement === 'lunge') return false;
      if (area === 'lowerBack') {
        if (tag.load === 'high' && !tag.unilateral) return false;
        if (tag.stability === 'low' && tag.region === 'lower') return false;
      }
    }
  }
  return true;
}

interface EmbeddedSubstitute {
  name: string;
  slot: EmbeddedSlot;
  role: EmbeddedRole;
  loadRatio: number;
  differsOn: DiffAxis[];
  equipment: EmbeddedEquipment | null;
  reason?: string;
}

// Compute a single dominant reason — mirrors src/utils/exerciseSubstitutes:computeReason.
function embeddedComputeReason(
  original: { tag: EmbeddedTag | undefined; loadRatio: number; slot: EmbeddedSlot },
  candidate: EmbeddedSubstitute,
  injuries: Record<string, 'caution' | 'avoid'>,
): string | undefined {
  if (original.slot === 'vertical_pull' && candidate.slot === 'horizontal_pull') {
    return 'avoids overhead pull';
  }
  const fatigueRank = { low: 0, moderate: 1, high: 2 };
  const lbRank = { good: 0, caution: 1, avoid: 2 };
  const cTag = EMBEDDED_TAGS[candidate.name];

  if (
    injuries.lowerBack &&
    original.tag &&
    cTag &&
    lbRank[cTag.injury.lowerBack] < lbRank[original.tag.injury.lowerBack]
  ) {
    return 'safer for lower back';
  }
  if (
    original.tag &&
    cTag &&
    lbRank[cTag.injury.lowerBack] < lbRank[original.tag.injury.lowerBack]
  ) {
    return 'lower spinal load';
  }
  if (
    original.tag &&
    cTag &&
    fatigueRank[cTag.fatigue] < fatigueRank[original.tag.fatigue]
  ) {
    return 'lower fatigue';
  }
  const loadDelta = original.loadRatio - candidate.loadRatio;
  if (loadDelta >= 0.2) return 'lighter load';
  if (
    original.tag &&
    cTag &&
    !original.tag.unilateral &&
    cTag.unilateral
  ) {
    return 'unilateral variation';
  }
  if (loadDelta <= -0.2) return 'heavier load';
  if (
    original.tag &&
    cTag &&
    candidate.equipment &&
    candidate.differsOn.includes('equipment')
  ) {
    return 'different equipment';
  }
  return undefined;
}

// Movement-family stopwords (mirror of src/utils/exerciseSubstitutes.ts).
const EMBEDDED_FAMILY_STOPWORDS = new Set<string>([
  'single', 'double', 'one', 'two', 'arm', 'arms', 'leg', 'legs',
  'standing', 'seated', 'kneeling', 'split',
  'high', 'low', 'wide', 'narrow', 'close', 'neutral', 'grip',
  'incline', 'decline', 'flat', 'overhead',
  'db', 'dumbbell', 'bb', 'barbell', 'kb', 'kettlebell',
  'cable', 'machine', 'band', 'banded', 'smith',
  'trap', 'bar', 'conventional',
  'and', 'the', 'with', 'for', 'of', 'pulls', 'press',
]);

function embeddedTokenizeName(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[-(),.\/]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !EMBEDDED_FAMILY_STOPWORDS.has(w)),
  );
}

// Mirror of src/ isMovementVariant. Same slot + (matching or absent
// equipment) + ≥1 shared root word → variants of the same base exercise.
function embeddedIsMovementVariant(a: EmbeddedSubstitute, b: EmbeddedSubstitute): boolean {
  if (a.slot !== b.slot) return false;
  if (a.equipment && b.equipment && a.equipment !== b.equipment) return false;
  const wordsA = embeddedTokenizeName(a.name);
  const wordsB = embeddedTokenizeName(b.name);
  for (const w of wordsA) if (wordsB.has(w)) return true;
  return false;
}

// Cross-pattern fallback for the SECOND pick when the same-slot pool
// can't yield a meaningfully-different second candidate. Mirror of
// CROSS_PATTERN_FALLBACK_MAP in src/utils/exerciseSubstitutes.ts.
//
// Only vertical_pull is mapped — hinge / squat within-slot diversity
// (Hip Thrust, KB Swings, Single-Leg RDL, Step Ups, Split Squat) already
// covers the user's "glute-dominant / unilateral" preferences. See the
// src/ file for the full rationale.
const EMBEDDED_CROSS_PATTERN_FALLBACK_MAP: Partial<Record<EmbeddedSlot, EmbeddedSlot>> = {
  vertical_pull: 'horizontal_pull',
};

// Build & filter candidates for one or more slots (mirror of src/ buildCandidates).
function embeddedBuildCandidates(
  slots: ReadonlyArray<EmbeddedSlot>,
  canonical: string,
  original: { tag: EmbeddedTag | undefined; loadRatio: number; equipment: EmbeddedEquipment | null },
  injuries: Record<string, 'caution' | 'avoid'>,
  availableEquipment: EmbeddedEquipment[] | undefined,
): EmbeddedSubstitute[] {
  let candidates: EmbeddedSubstitute[] = [];
  for (const s of slots) {
    const pool = EMBEDDED_POOLS[s];
    if (!pool) continue;
    for (const e of pool) {
      if (e.name === canonical) continue;
      const tag = EMBEDDED_TAGS[e.name];
      const equipment = tag?.equipment ?? null;
      const differsOn = embeddedDiffAxes(
        original,
        { tag, loadRatio: e.loadRatio, equipment },
      );
      candidates.push({ name: e.name, slot: s, role: e.role, loadRatio: e.loadRatio, differsOn, equipment });
    }
  }

  // Injury filter
  if (Object.keys(injuries).length > 0) {
    candidates = candidates.filter((c) => {
      const tag = EMBEDDED_TAGS[c.name];
      if (!tag) return true;
      return embeddedPassesInjury(tag, injuries);
    });
  }
  // Equipment filter (bodyweight always allowed)
  if (availableEquipment && availableEquipment.length > 0) {
    const allowed = new Set<EmbeddedEquipment>([...availableEquipment, 'bodyweight']);
    candidates = candidates.filter((c) => !c.equipment || allowed.has(c.equipment));
  }
  // Fatigue downgrade preference
  const origFatigue = original.tag?.fatigue;
  candidates = candidates.filter((c) => {
    const tag = EMBEDDED_TAGS[c.name];
    if (!tag) return true;
    return tag.fatigue !== 'high' || origFatigue === 'high';
  });
  // Reject zero-diff candidates (Pull-Ups → Chin-Ups never appears here)
  candidates = candidates.filter((c) => c.differsOn.length > 0);
  return candidates;
}

function embeddedGetSubstitutes(
  exerciseName: string,
  injuries: Record<string, 'caution' | 'avoid'> = {},
  availableEquipment?: EmbeddedEquipment[],
  avoidOverheadPull?: boolean,
): { slot: EmbeddedSlot | null; candidates: EmbeddedSubstitute[] } {
  const canonical = embeddedResolveAlias(exerciseName);
  const slot = embeddedFindSlot(canonical);
  if (!slot) return { slot: null, candidates: [] };

  const originalTag = EMBEDDED_TAGS[canonical];
  const originalEntry = EMBEDDED_POOLS[slot].find((e) => e.name === canonical);
  const originalLoad = originalEntry?.loadRatio ?? 1.0;
  const originalEquipment = originalTag?.equipment ?? null;
  const originalCtx = { tag: originalTag, loadRatio: originalLoad, equipment: originalEquipment };

  // ─── Cross-pattern fallback for vertical_pull ───
  let candidateSlots: EmbeddedSlot[] = [slot];
  let candidates: EmbeddedSubstitute[] = [];

  if (slot === 'vertical_pull') {
    const overheadHardBlock = avoidOverheadPull === true || injuries.shoulder === 'avoid';
    const shoulderCaution = injuries.shoulder === 'caution';
    if (overheadHardBlock) {
      candidateSlots = ['horizontal_pull'];
      candidates = embeddedBuildCandidates(candidateSlots, canonical, originalCtx, injuries, availableEquipment);
    } else if (shoulderCaution) {
      candidateSlots = ['vertical_pull', 'horizontal_pull'];
      candidates = embeddedBuildCandidates(candidateSlots, canonical, originalCtx, injuries, availableEquipment);
    } else {
      candidates = embeddedBuildCandidates(candidateSlots, canonical, originalCtx, injuries, availableEquipment);
      // Last-resort widen: vertical_pull pool too small / all near-twins.
      if (candidates.length === 0) {
        candidateSlots = ['vertical_pull', 'horizontal_pull'];
        candidates = embeddedBuildCandidates(candidateSlots, canonical, originalCtx, injuries, availableEquipment);
      }
    }
  } else {
    candidates = embeddedBuildCandidates(candidateSlots, canonical, originalCtx, injuries, availableEquipment);
  }

  if (candidates.length === 0) return { slot, candidates: [] };

  // Score each candidate.
  const scored = candidates.map((c) => {
    const tag = EMBEDDED_TAGS[c.name];
    let score = c.differsOn.length;
    const fatigueRank = { low: 0, moderate: 1, high: 2 };
    if (tag && originalTag && fatigueRank[tag.fatigue] < fatigueRank[originalTag.fatigue]) score += 0.5;
    const loadDelta = originalLoad - c.loadRatio;
    if (loadDelta > 0) score += loadDelta * 0.3;
    if (tag) {
      for (const area of Object.keys(injuries) as Array<keyof EmbeddedTag['injury']>) {
        if (tag.injury[area] === 'caution') { score -= 0.7; break; }
      }
    }
    return { c, score };
  }).sort((a, b) => b.score - a.score);

  const first = scored[0].c;
  first.reason = embeddedComputeReason({ tag: originalTag, loadRatio: originalLoad, slot }, first, injuries);

  if (scored.length === 1) {
    // Only one same-slot candidate — try cross-pattern fallback before
    // giving up on the second pick.
    const fallback = embeddedTryCrossPatternFallback(
      first, slot, candidateSlots, canonical, originalCtx, injuries, availableEquipment,
    );
    if (fallback) {
      fallback.reason = embeddedComputeReason({ tag: originalTag, loadRatio: originalLoad, slot }, fallback, injuries);
      return { slot, candidates: [first, fallback] };
    }
    return { slot, candidates: [first] };
  }

  // ─── Same-slot second pick ───
  const sameSlotSecond = embeddedPickSecond(first, scored.slice(1).map(({ c }) => c));
  if (sameSlotSecond) {
    sameSlotSecond.reason = embeddedComputeReason({ tag: originalTag, loadRatio: originalLoad, slot }, sameSlotSecond, injuries);
    return { slot, candidates: [first, sameSlotSecond] };
  }

  // ─── Cross-pattern fallback for second pick ───
  // Same-slot pool exhausted — try the sibling slot
  // (vertical_pull → horizontal_pull). Skipped when the candidate pool
  // already routed through the fallback slot (shoulder=avoid case).
  const fallback = embeddedTryCrossPatternFallback(
    first, slot, candidateSlots, canonical, originalCtx, injuries, availableEquipment,
  );
  if (fallback) {
    fallback.reason = embeddedComputeReason({ tag: originalTag, loadRatio: originalLoad, slot }, fallback, injuries);
    return { slot, candidates: [first, fallback] };
  }

  return { slot, candidates: [first] };
}

// Score remaining candidates as potential second picks (vs original AND
// vs first). Returns the highest-scoring candidate that passes hard
// filters: pairDiff > 0 AND not a movement-variant of first. Otherwise
// null. Mirror of pickSecond in src/utils/exerciseSubstitutes.ts.
//
// Second pick rules (KEEP IN SYNC with src/utils/exerciseSubstitutes.ts):
//   1. Must differ from original (zero-diff filter already enforced upstream).
//   2. (HARD) Must differ from first on ≥1 axis (pairDiff > 0).
//   3. (HARD) Must NOT be a movement-variant of first.
//   4. (SOFT) Prefer candidates whose pairDiff includes an axis NOT
//      already in first.differsOn — fresh-axis is a scoring nudge.
function embeddedPickSecond(
  first: EmbeddedSubstitute,
  candidates: ReadonlyArray<EmbeddedSubstitute>,
): EmbeddedSubstitute | null {
  if (candidates.length === 0) return null;
  const firstTag = EMBEDDED_TAGS[first.name];
  const firstDiffSet = new Set(first.differsOn);
  const ranked = candidates.map((c) => {
    const cTag = EMBEDDED_TAGS[c.name];
    const pairDiff = embeddedDiffAxes(
      { tag: firstTag, loadRatio: first.loadRatio, equipment: first.equipment },
      { tag: cTag, loadRatio: c.loadRatio, equipment: c.equipment },
    );
    const freshAxes = pairDiff.filter((a) => !firstDiffSet.has(a));
    const variant = embeddedIsMovementVariant(first, c);
    const pairScore =
      freshAxes.length * 2.0 +
      pairDiff.length * 1.0 +
      c.differsOn.length * 0.5 -
      (c.role === first.role ? 0.3 : 0) -
      (variant ? 5.0 : 0);
    return { c, pairScore, pairDiff, variant };
  }).sort((a, b) => b.pairScore - a.pairScore);
  const valid = ranked.find((r) => r.pairDiff.length > 0 && !r.variant);
  return valid ? valid.c : null;
}

// Try the sibling-slot fallback for the second pick. Returns the chosen
// candidate (already filtered/scored against `first` and the original)
// or null. Skipped when:
//   • The original slot has no entry in EMBEDDED_CROSS_PATTERN_FALLBACK_MAP.
//   • The fallback slot was already part of the candidate pool (e.g.
//     shoulder='avoid' already widened slots to horizontal_pull).
function embeddedTryCrossPatternFallback(
  first: EmbeddedSubstitute,
  slot: EmbeddedSlot,
  candidateSlots: ReadonlyArray<EmbeddedSlot>,
  canonical: string,
  originalCtx: { tag: EmbeddedTag | undefined; loadRatio: number; equipment: EmbeddedEquipment | null },
  injuries: Record<string, 'caution' | 'avoid'>,
  availableEquipment: EmbeddedEquipment[] | undefined,
): EmbeddedSubstitute | null {
  const fallbackSlot = EMBEDDED_CROSS_PATTERN_FALLBACK_MAP[slot];
  if (!fallbackSlot) return null;
  if (candidateSlots.includes(fallbackSlot)) return null;
  const fallbackCandidates = embeddedBuildCandidates(
    [fallbackSlot], canonical, originalCtx, injuries, availableEquipment,
  );
  if (fallbackCandidates.length === 0) return null;
  // Order by their own score (vs original) before pickSecond re-ranks.
  const ordered = fallbackCandidates.map((c) => {
    const tag = EMBEDDED_TAGS[c.name];
    let score = c.differsOn.length;
    const fatigueRank = { low: 0, moderate: 1, high: 2 };
    if (tag && originalCtx.tag && fatigueRank[tag.fatigue] < fatigueRank[originalCtx.tag.fatigue]) score += 0.5;
    const loadDelta = originalCtx.loadRatio - c.loadRatio;
    if (loadDelta > 0) score += loadDelta * 0.3;
    if (tag) {
      for (const area of Object.keys(injuries) as Array<keyof EmbeddedTag['injury']>) {
        if (tag.injury[area] === 'caution') { score -= 0.7; break; }
      }
    }
    return { c, score };
  }).sort((a, b) => b.score - a.score).map((s) => s.c);
  return embeddedPickSecond(first, ordered);
}

// Map raw athlete profile injuries → severity map used by the helper.
function buildInjuryMapForSubstitutes(
  profileInjuries: Array<{ bodyArea: string; severity?: string }> | undefined,
): Record<string, 'caution' | 'avoid'> {
  const out: Record<string, 'caution' | 'avoid'> = {};
  if (!profileInjuries) return out;
  const norm: Record<string, string> = {
    'lower back': 'lowerBack', 'lower_back': 'lowerBack', 'back': 'lowerBack',
    'groin': 'adductor', 'adductors': 'adductor',
    'shoulders': 'shoulder', 'knees': 'knee', 'hamstrings': 'hamstring',
  };
  for (const inj of profileInjuries) {
    const area = (norm[inj.bodyArea.toLowerCase()] || inj.bodyArea.toLowerCase()).trim();
    out[area] = inj.severity?.toLowerCase() === 'mild' ? 'caution' : 'avoid';
  }
  return out;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const FUNCTION_VERSION = 'v7-2026-04-26-update-program-tool';

serve(async (req: Request) => {
  const reqStart = Date.now();
  infoLog(`[coach-chat] ${FUNCTION_VERSION} | ${req.method} request received`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: CORS_HEADERS }
    );
  }

  try {
    const body: RequestBody = await req.json();
    debugLog(`[coach-chat] Request body parsed. messages=${body.messages?.length}, hasProfile=${!!body.athleteProfile}, hasPlan=${!!body.coachingPlan}`);

    // Validate request body
    if (!body.messages || !Array.isArray(body.messages)) {
      console.error("[coach-chat] Invalid request body — no messages array");
      return new Response(
        JSON.stringify({ reply: null, actions: null, newNotes: null, error: "Invalid request body. Expected { messages: Message[] }" }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // ─── INJURY CLARIFICATION GUARD (Tier 1: deterministic fast-path) ───
    // Runs BEFORE the LLM. Higher precedence than system prompt, classification,
    // and tool selection. Source-of-truth in src/utils/injuryClarificationGuard.ts.
    if (body.mode !== 'generate') {
      const guard = checkInjuryClarificationGuard(body.messages);
      if (guard.fired && guard.reply) {
        const elapsed = Date.now() - reqStart;
        debugLog(`[coach-chat] Injury guard FIRED in ${elapsed}ms: ${guard.reason}`);
        return new Response(
          JSON.stringify({
            reply: guard.reply,
            actions: null,
            newNotes: null,
            error: null,
            _v: FUNCTION_VERSION,
            _guard: { fired: true, tier: 1, reason: guard.reason },
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      // ─── Tier 2: classifier fallback ───
      // The fast-path missed this message (no kw, no body part, no phrase).
      // Run a small LLM classifier — pre-filtered to skip action/scheduling
      // messages so we never spend an API call on "what's today's session?".
      // If classifier confirms injury intent without severity, return the
      // exact severity question. No appended text, no merging.
      if (shouldRunInjuryClassifier(body.messages)) {
        const lastMsg = body.messages![body.messages!.length - 1];
        const cls = await classifyInjuryIntent(lastMsg.content);
        if (cls && cls.isInjuryIntent && !cls.severityKnown) {
          const elapsed = Date.now() - reqStart;
          debugLog(
            `[coach-chat] Injury classifier FIRED in ${elapsed}ms: intent=${cls.isInjuryIntent} body=${cls.bodyPartKnown} sev=${cls.severityKnown}`,
          );
          return new Response(
            JSON.stringify({
              reply: GUARD_SEVERITY_QUESTION,
              actions: null,
              newNotes: null,
              error: null,
              _v: FUNCTION_VERSION,
              _guard: { fired: true, tier: 2, reason: 'classifier injury intent' },
            }),
            { status: 200, headers: CORS_HEADERS }
          );
        }
      }
    }

    // Call the configured coach LLM provider.
    const result = await callCoachLLMAPI(body.messages, body.coachNotes || [], body.athleteProfile, body.coachingPlan, body.currentProgramContext, body.mode);

    const elapsed = Date.now() - reqStart;
    infoLog(`[coach-chat] Success in ${elapsed}ms`);

    return new Response(
      JSON.stringify({
        reply: result.reply,
        actions: result.actions || null,
        newNotes: result.newNotes || null,
        programUpdate: result.programUpdate || null,
        error: null,
        _v: FUNCTION_VERSION,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const diagnostic = readRuntimeDiagnostic(error);
    const elapsed = Date.now() - reqStart;
    console.error(`[coach-chat] FAILED after ${elapsed}ms: ${safeErrorSummary(error)}`);
    if (diagnostic) {
      console.error("[coach-chat] failure diagnostic", diagnostic);
    }

    // ALWAYS return 200 with error in body — non-2xx causes supabase.functions.invoke()
    // to discard the error body, making debugging impossible on the client.
    return new Response(
      JSON.stringify({
        reply: null,
        actions: null,
        newNotes: null,
        programUpdate: null,
        error: errorMessage,
        diagnostic,
        _v: FUNCTION_VERSION,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
});
