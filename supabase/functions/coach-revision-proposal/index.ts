/**
 * coach-revision-proposal edge function.
 *
 * Thin LLM transport for Stage 4A-2 shadow diagnostics. It does not mutate,
 * does not compose a user reply, and does not claim success. The app validates
 * returned JSON against CoachRevisionProposal, computes the visible diff, and
 * validates that diff before any future write path can use it.
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
  // Function-scoped override first: the revision task (full-state echo with
  // strict IDs) has different model requirements than coach-chat, and the
  // shared COACH_LLM_PROVIDER must not be repurposed per-function.
  const perFunction = normalizeCoachProvider(
    Deno.env.get("COACH_REVISION_PROPOSAL_PROVIDER"),
  );
  if (perFunction) return perFunction;
  const configured = normalizeCoachProvider(Deno.env.get("COACH_LLM_PROVIDER"));
  if (configured) return configured;
  return Deno.env.get("OPENAI_API_KEY") ? "openai" : "anthropic";
}

function getOpenAIModel(): string {
  return Deno.env.get("COACH_REVISION_PROPOSAL_LLM_MODEL") ||
    Deno.env.get("COACH_SEMANTIC_DRAFT_LLM_MODEL") ||
    Deno.env.get("COACH_INTENT_LLM_MODEL") ||
    Deno.env.get("COACH_LLM_FAST_MODEL") ||
    "gpt-5.4-mini";
}

function getAnthropicModel(): string {
  return Deno.env.get("ANTHROPIC_COACH_REVISION_PROPOSAL_MODEL") ||
    Deno.env.get("ANTHROPIC_SEMANTIC_DRAFT_MODEL") ||
    Deno.env.get("ANTHROPIC_INTENT_MODEL") ||
    "claude-haiku-4-5-20251001";
}

function getMaxOutputTokens(): number {
  // Full-state echo of a real training day (6+ exercises with prescriptions
  // and descriptions) does not fit in a small budget; truncated JSON fails
  // parse and surfaces as an opaque 502 to the app. Default high, allow
  // env override for tuning.
  const raw = Number(Deno.env.get("COACH_REVISION_PROPOSAL_MAX_OUTPUT_TOKENS"));
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
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

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function extractFirstJsonObject(text: string): string | null {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  let body: {
    message?: string;
    context?: unknown;
    schema?: unknown;
    systemPrompt?: string;
  };
  try {
    body = await req.json();
  } catch (_err) {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const message = typeof body.message === "string" ? body.message : null;
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : null;
  if (!message || !systemPrompt || !body.context || !body.schema) {
    return jsonResponse({ error: "missing message, context, schema, or systemPrompt" }, 400);
  }

  const provider = resolveCoachProvider();
  const apiKey = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    const envName = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    return jsonResponse({ error: `${envName} not configured` }, 500);
  }

  const userBlock = `MESSAGE:\n${message}\n\nSCHEMA (JSON):\n${JSON.stringify(body.schema)}\n\nCONTEXT (JSON):\n${JSON.stringify(body.context)}`;
  const model = provider === "openai" ? getOpenAIModel() : getAnthropicModel();

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
          model,
          instructions: systemPrompt,
          input: [{ role: "user", content: userBlock }],
          max_output_tokens: getMaxOutputTokens(),
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
          model,
          max_tokens: getMaxOutputTokens(),
          system: systemPrompt,
          messages: [{ role: "user", content: userBlock }],
        }),
      });
  } catch (err) {
    return jsonResponse({
      error: "upstream fetch failed",
      detail: err instanceof Error ? err.message : String(err),
    }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return jsonResponse({
      error: "upstream HTTP error",
      status: upstream.status,
      detail: detail.slice(0, 500),
    }, 502);
  }

  const data = await upstream.json();
  // Truncated output is the classic large-payload failure: the JSON echo gets
  // cut at the token budget and would otherwise surface as an opaque parse
  // error. Name it explicitly so client logs say exactly what to fix.
  const truncated = provider === "openai"
    ? data?.status === "incomplete" &&
      data?.incomplete_details?.reason === "max_output_tokens"
    : data?.stop_reason === "max_tokens";
  if (truncated) {
    return jsonResponse({
      error: "model output truncated at max output tokens",
      model,
      maxOutputTokens: getMaxOutputTokens(),
    }, 502);
  }
  const text = provider === "openai"
    ? extractOpenAIText(data)
    : data?.content?.[0]?.text?.trim?.() ?? "";
  const jsonText = extractFirstJsonObject(text);
  if (!jsonText) {
    return jsonResponse({ error: "no JSON in model response", raw: text.slice(0, 500) }, 502);
  }

  try {
    // Model observability: header only (never in the body — the client
    // validates the body as a raw CoachRevisionProposal).
    return new Response(JSON.stringify(JSON.parse(jsonText)), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "x-coach-provider": provider,
        "x-coach-model": model,
        ...corsHeaders(),
      },
    });
  } catch (err) {
    return jsonResponse({
      error: "JSON parse failed",
      detail: err instanceof Error ? err.message : String(err),
      raw: jsonText.slice(0, 500),
    }, 502);
  }
});
