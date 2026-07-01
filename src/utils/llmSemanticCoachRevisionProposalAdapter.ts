import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';
import {
  COACH_REVISION_PROPOSAL_SCHEMA,
  COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
  type CoachVisibleWeekSnapshot,
} from './coachRevisionProposal';
import {
  type SemanticCoachRevisionProposalAdapter,
  type SemanticCoachRevisionProposalAdapterInput,
} from './semanticCoachRevisionProposal';
import { logger } from './logger';

export const COACH_REVISION_PROPOSAL_FUNCTION_NAME = 'coach-revision-proposal';

export const COACH_REVISION_PROPOSAL_SYSTEM_PROMPT = `You are the semantic CoachRevisionProposal parser for a strength coach app.

Your only job is to convert the athlete's latest message plus the grounded visible program snapshot into one strict JSON object matching schemaVersion "${COACH_REVISION_PROPOSAL_SCHEMA_VERSION}".

Return JSON only. No prose. No markdown. No tool calls.

The JSON must match the provided schema exactly. Do not add extra keys.

Rules:
- The LLM may propose revised visible state, but it cannot mutate stores.
- Never claim success.
- Return a revised visible day/week snapshot, not a command and not an operation label.
- Preserve stable ids for unchanged workouts, sections, and items.
- If a section/item is unchanged, copy it exactly from the visible snapshot.
- Do not invent hidden internal objects, hidden ids, or private program fields.
- Protected refs are constraints. If the athlete says keep/preserve/leave something alone, include those stable ids in userIntent.protectedRefs and preserve them exactly in revisedDays.
- A workout with no visible sections/items must be represented as workout: null, not an empty shell.
- The app will compute and validate the old-vs-new visible diff before any write can happen.

Date resolution:
- context.dateGuide is the app-computed calendar truth: today's date/weekday and every visible date with weekday and daysFromToday.
- Resolve relative phrases ("tomorrow", "Monday", "next Monday", "the 6th") against context.dateGuide. Never do your own calendar arithmetic and never ask which date when exactly one visible date matches the phrase.
- "Next <weekday>" means the upcoming visible date with that weekday (smallest positive daysFromToday). A bare weekday name means the same unless the athlete clearly refers to the past.

When to clarify:
- Return kind "clarify" only when TWO OR MORE visible targets genuinely match the request, or a required field is missing and cannot be resolved from context.
- When exactly one visible target matches, return a revision for it. Safety is enforced by the app validator, not by asking extra questions.
- Ask the smallest useful question, and put concrete choices in candidateOptions.

Continuing a clarification (context.pendingClarifier.revisionTransaction or context.recentContext.pendingCoachRevision present):
- The MESSAGE is the athlete's ORIGINAL request. The short latest answer is in pendingCoachRevision.clarificationAnswer and the full Q&A history is in clarifications/revisionTransaction.
- Combine the original request with EVERY answered clarification, then return the revision. Never treat the short answer as a new request, and never re-ask a question that already has an answer.
- Use pendingCoachRevision.targetDateOverride as the target date when set; otherwise resolve clarificationAnswer against context.dateGuide.

Exact clarify shape:
{
  "schemaVersion": "${COACH_REVISION_PROPOSAL_SCHEMA_VERSION}",
  "kind": "clarify",
  "confidence": 0.0,
  "question": "small question",
  "missingField": "targetDate|targetScope|targetSession|replacement|confirmation",
  "candidateOptions": [{ "id": "stable_option_id", "label": "Visible label", "value": {} }],
  "partialIntent": null,
  "reason": "short_reason"
}

Exact revision shape:
{
  "schemaVersion": "${COACH_REVISION_PROPOSAL_SCHEMA_VERSION}",
  "kind": "revision",
  "source": "semantic",
  "confidence": 0.0,
  "userIntent": {
    "intent": "add|edit|remove|replace|move|reduce",
    "targetDomain": "strength|conditioning|recovery|session|team_training|schedule",
    "actionScope": "whole_session|strength_section|conditioning_section|recovery_section|session|exercise|duration|intensity|visible_week",
    "targetDates": ["YYYY-MM-DD"],
    "protectedRefs": [],
    "allowedAddedSectionKinds": [],
    "requiresConfirmation": false,
    "reason": "short_reason"
  },
  "scope": {
    "mode": "single_day|visible_week",
    "dates": ["YYYY-MM-DD"]
  },
  "revisedDays": [
    {
      "date": "YYYY-MM-DD",
      "workout": null
    }
  ],
  "explanation": "short_reason"
}

When returning a workout, every workout must have exactly:
{
  "id": "stable workout id",
  "title": "visible title",
  "workoutType": "visible type",
  "sections": []
}

Every section must have exactly:
{
  "id": "stable section id",
  "kind": "strength|conditioning|recovery|session",
  "title": "visible section title",
  "items": []
}

Every item must have exactly:
{
  "id": "stable item id",
  "title": "visible title",
  "domain": "strength|conditioning|recovery|session",
  "source": "visible source string from snapshot",
  "description": "string or null",
  "exerciseIds": [],
  "durationMinutes": 0,
  "prescription": {
    "sets": 0,
    "repsMin": 0,
    "repsMax": 0,
    "intensity": "string or null"
  }
}

Use null for nullable item fields exactly as shown in the visible snapshot.`;

export interface CoachRevisionDateGuideEntry {
  date: string;
  weekday: string;
  /** Signed day offset from todayISO (negative = past). */
  daysFromToday: number;
  relation: 'past' | 'today' | 'upcoming';
}

export interface CoachRevisionProposalLLMContext {
  schemaVersion: typeof COACH_REVISION_PROPOSAL_SCHEMA_VERSION;
  todayISO?: string;
  nowISO?: string;
  timezone?: string;
  /** Deterministic, app-computed date resolution guide: today's weekday plus
   *  every visible date with weekday + offset. The model must use this to
   *  resolve relative phrases ("tomorrow", "next Monday") instead of doing
   *  its own calendar arithmetic or asking. */
  dateGuide: {
    todayISO: string;
    todayWeekday: string;
    visibleDates: CoachRevisionDateGuideEntry[];
  } | null;
  visibleSnapshot: CoachVisibleWeekSnapshot;
  pendingClarifier: ReturnType<typeof summarisePendingClarifier>;
  recentContext?: unknown;
  visibleCandidates: Array<{
    kind: 'day' | 'workout' | 'section' | 'item';
    label: string;
    date: string;
    workoutId?: string | null;
    sectionId?: string | null;
    itemId?: string | null;
    domain?: string | null;
  }>;
}

export interface LLMSemanticCoachRevisionProposalAdapterOptions {
  endpoint: string;
  authToken?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const LOG_TRUNCATE = 240;

function truncate(value: string, n: number = LOG_TRUNCATE): string {
  return value.length <= n ? value : `${value.slice(0, n)}...`;
}

export function coachRevisionProposalFunctionNameFromEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  } catch (_err) {
    return endpoint.split('/').filter(Boolean).at(-1) ?? '';
  }
}

export class LLMSemanticCoachRevisionProposalAdapter
  implements SemanticCoachRevisionProposalAdapter {
  private readonly endpoint: string;
  private readonly functionName: string;
  private readonly authToken?: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: LLMSemanticCoachRevisionProposalAdapterOptions) {
    this.endpoint = opts.endpoint;
    this.functionName = coachRevisionProposalFunctionNameFromEndpoint(opts.endpoint);
    this.authToken = opts.authToken;
    this.fetcher = opts.fetcher ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 12000;
  }

  async buildProposal(input: SemanticCoachRevisionProposalAdapterInput): Promise<unknown> {
    const context = buildCoachRevisionProposalLLMContext(input);
    logger.debug('[coach-revision-proposal] input', {
      messageLength: input.userMessage.length,
      todayISO: context.todayISO,
      timezone: context.timezone,
      visibleDays: context.visibleSnapshot.days.length,
      candidateCount: context.visibleCandidates.length,
      endpoint: this.endpoint,
      functionName: this.functionName,
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
      headers.apikey = this.authToken;
    }

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    let resp: Response;
    try {
      resp = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: input.userMessage,
          context,
          schema: COACH_REVISION_PROPOSAL_SCHEMA,
          systemPrompt: COACH_REVISION_PROPOSAL_SYSTEM_PROMPT,
        }),
        signal: controller?.signal as any,
      });
    } catch (err) {
      logger.warn('[coach-revision-proposal] transport_error', {
        kind: 'fetch_failed',
        detail: err instanceof Error ? err.message : String(err),
        endpoint: this.endpoint,
        functionName: this.functionName,
      });
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      logger.warn('[coach-revision-proposal] transport_error', {
        kind: 'http_error',
        status: resp.status,
        endpoint: this.endpoint,
        functionName: this.functionName,
        diagnostic:
          resp.status === 404
            ? 'coach revision proposal endpoint missing / HTTP 404'
            : undefined,
      });
      logger.debug('[coach-revision-proposal] http_error body preview', truncate(body));
      throw new Error(`coach revision proposal endpoint HTTP ${resp.status}`);
    }

    const json = await resp.json();
    logger.debug('[coach-revision-proposal] raw', truncate(JSON.stringify(json)));
    logger.debug('[coach-revision-proposal] served_by', {
      provider: resp.headers?.get?.('x-coach-provider') ?? null,
      model: resp.headers?.get?.('x-coach-model') ?? null,
    });
    return json;
  }
}

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

function weekdayFromISODate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return WEEKDAY_NAMES[parsed.getUTCDay()];
}

function daysBetweenISODates(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function buildCoachRevisionDateGuide(args: {
  todayISO: string | undefined;
  visibleSnapshot: CoachVisibleWeekSnapshot;
}): CoachRevisionProposalLLMContext['dateGuide'] {
  const todayISO = args.todayISO?.trim();
  if (!todayISO) return null;
  return {
    todayISO,
    todayWeekday: weekdayFromISODate(todayISO),
    visibleDates: args.visibleSnapshot.days.map((day) => {
      const daysFromToday = daysBetweenISODates(todayISO, day.date);
      return {
        date: day.date,
        weekday: weekdayFromISODate(day.date),
        daysFromToday,
        relation: daysFromToday < 0 ? 'past' : daysFromToday === 0 ? 'today' : 'upcoming',
      };
    }),
  };
}

export function buildCoachRevisionProposalLLMContext(
  input: SemanticCoachRevisionProposalAdapterInput,
): CoachRevisionProposalLLMContext {
  return {
    schemaVersion: COACH_REVISION_PROPOSAL_SCHEMA_VERSION,
    todayISO: input.todayISO,
    nowISO: input.nowISO,
    timezone: input.timezone,
    dateGuide: buildCoachRevisionDateGuide({
      todayISO: input.todayISO,
      visibleSnapshot: input.visibleSnapshot,
    }),
    visibleSnapshot: input.visibleSnapshot,
    pendingClarifier: summarisePendingClarifier(input.pendingClarifier ?? null),
    recentContext: summariseRecentContext(input.recentContext),
    visibleCandidates: buildVisibleCandidates(input.visibleSnapshot),
  };
}

function summarisePendingClarifier(pending: PendingCoachClarifier | null) {
  if (!pending) return null;
  return {
    operation: pending.operation,
    scope: pending.scope,
    missingFields: pending.missingFields,
    askedQuestion: pending.askedQuestion,
    targetDate: pending.targetDate ?? null,
    pendingClarification: pending.pendingClarification
      ? {
          originalIntent: pending.pendingClarification.originalIntent,
          missingField: pending.pendingClarification.missingField,
          expectedAnswerType: pending.pendingClarification.expectedAnswerType,
          proposedCandidate: pending.pendingClarification.proposedCandidate ?? null,
          candidateOptions: pending.pendingClarification.candidateOptions ?? [],
          reason: pending.pendingClarification.reason ?? null,
        }
      : null,
    revisionContext: pending.programEditDraftEnvelope
      ? {
          source: pending.programEditDraftEnvelope.source,
          originalUserWording: pending.programEditDraftEnvelope.originalUserWording,
          draft: {
            intent: pending.programEditDraftEnvelope.draft.intent,
            targetDomain: pending.programEditDraftEnvelope.draft.targetDomain,
            actionScope: pending.programEditDraftEnvelope.draft.actionScope,
            targetDate: pending.programEditDraftEnvelope.draft.targetDate,
            protectedTargets: pending.programEditDraftEnvelope.draft.protectedTargets,
          },
        }
      : null,
    // The revision transaction itself: original wording, accumulated intent,
    // and every clarification round so far. This is what lets a short answer
    // like "the 6th" resume the original request instead of arriving bare.
    revisionTransaction: pending.coachRevisionProposalEnvelope
      ? {
          continuationId: pending.coachRevisionProposalEnvelope.continuationId,
          originalUserWording: pending.coachRevisionProposalEnvelope.originalUserWording,
          partialIntent: pending.coachRevisionProposalEnvelope.partialIntent,
          clarifications: pending.coachRevisionProposalEnvelope.clarifications ?? [],
        }
      : null,
  };
}

function summariseRecentContext(value: unknown): unknown {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_err) {
    return null;
  }
}

function buildVisibleCandidates(
  snapshot: CoachVisibleWeekSnapshot,
): CoachRevisionProposalLLMContext['visibleCandidates'] {
  const out: CoachRevisionProposalLLMContext['visibleCandidates'] = [];
  for (const day of snapshot.days) {
    out.push({
      kind: 'day',
      label: day.workout?.title ?? 'Rest',
      date: day.date,
      workoutId: day.workout?.id ?? null,
      domain: day.workout?.workoutType ?? null,
    });
    if (!day.workout) continue;
    out.push({
      kind: 'workout',
      label: day.workout.title,
      date: day.date,
      workoutId: day.workout.id,
      domain: day.workout.workoutType,
    });
    for (const section of day.workout.sections) {
      out.push({
        kind: 'section',
        label: section.title,
        date: day.date,
        workoutId: day.workout.id,
        sectionId: section.id,
        domain: section.kind,
      });
      for (const item of section.items) {
        out.push({
          kind: 'item',
          label: item.title,
          date: day.date,
          workoutId: day.workout.id,
          sectionId: section.id,
          itemId: item.id,
          domain: item.domain,
        });
      }
    }
  }
  return out;
}
