import type { ResolvedDay } from './sessionResolver';
import type { CoachTargetFrame } from './coachTargetFrame';
import {
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA,
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
  type SemanticProgramEditDraftAdapter,
  type SemanticProgramEditDraftAdapterInput,
} from './semanticProgramEditDraft';
import { extractVisibleProgramItemsFromWorkout } from './visibleProgramReadModel';
import type { PendingCoachClarifier } from '../store/pendingCoachClarifierStore';
import { logger } from './logger';

export const SEMANTIC_PROGRAM_EDIT_DRAFT_SYSTEM_PROMPT = `You are the semantic ProgramEditDraft parser for a strength coach app.

Your only job is to convert the athlete's latest message plus grounded visible program context into one strict JSON object matching schemaVersion "${SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION}".

Return JSON only. No prose. No markdown. No tool calls.

The JSON must match the provided schema exactly. Do not add extra keys.

Rules:
- The LLM may understand messy human language, but it cannot mutate the program.
- Never claim success.
- Preserve exact athlete training terms when they matter.
- Use targetFrame, pending clarification, recent mutation target, and visible candidates to resolve references.
- If a required field is missing, return status "clarify" with the smallest useful question.
- If the request is not a program edit, return status "not_program_edit".
- If the request is program-edit shaped but unsupported or unsafe, return status "unsupported".
- Explicit domain words win: strength, conditioning, whole session, exercise, setup, schedule.
- Protected targets must be listed when the athlete says to keep/preserve/leave something alone.
- Compound requests should set isCompound=true and include proposedActions.
- Dates and ids must come from the visible context or targetFrame only.
- Do not invent a nested "target" object. Use targetDate, targetSessionId, targetItemId, and sourceTarget.
- Do not invent "keep" actions. If the athlete says to keep something, put it in protectedTargets and verifierExpectations.
- For block-level strength requests, use targetDomain "strength" and actionScope "strength_block"; do not force a single exercise target unless the athlete names a specific exercise.

Exact draft shape when status is "draft":
{
  "schemaVersion": "${SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION}",
  "status": "draft",
  "confidence": 0.0,
  "draft": {
    "intent": "add|edit|remove|replace|move|reduce|explain|ask_question",
    "targetDomain": "strength|conditioning|session|recovery|setup|schedule",
    "actionScope": "whole_session|strength_block|conditioning_block|exercise|duration|intensity|modality|setup",
    "targetDate": "YYYY-MM-DD or null",
    "targetSessionId": "visible session id or null",
    "targetItemId": "visible item id or null",
    "sourceTarget": null,
    "explicitDateRole": "referent|destination|none|ambiguous",
    "explicitUserWording": "the athlete message",
    "missingFields": [],
    "confidence": 0.0,
    "protectedTargets": [],
    "constraints": [],
    "proposedActions": [],
    "verifierExpectations": [],
    "isCompound": false,
    "reason": "short_reason"
  },
  "clarificationQuestion": null,
  "candidateOptions": [],
  "reason": "short_reason"
}

Exact sourceTarget shape, when non-null:
{
  "kind": "session|conditioning_item|exercise|day",
  "date": "YYYY-MM-DD",
  "sessionName": "visible session name or null",
  "itemId": "visible session/item id or null",
  "itemTitle": "visible item title or null",
  "domain": "strength|conditioning|session|recovery|setup|schedule or null",
  "stillVisible": true
}

Exact protectedTargets item shape:
{
  "targetDomain": "conditioning",
  "actionScope": "conditioning_block",
  "targetDate": "YYYY-MM-DD or null",
  "targetItemId": "visible item id or null",
  "title": "visible title or null",
  "reason": "short_reason"
}

Exact proposedActions item shape:
{
  "intent": "add|edit|remove|replace|move",
  "targetDomain": "strength|conditioning|session|recovery|setup|schedule",
  "actionScope": "whole_session|strength_block|conditioning_block|exercise|duration|intensity|modality|setup",
  "targetDate": "YYYY-MM-DD or null",
  "targetSessionId": "visible session id or null",
  "targetItemId": "visible item id or null",
  "sourceTarget": null,
  "reason": "short_reason"
}

Exact verifierExpectations item shape:
{
  "kind": "domain_changed|domain_unchanged|session_removed|item_added|ask_before_execution",
  "targetDomain": "strength|conditioning|session|recovery|setup|schedule or null",
  "actionScope": "whole_session|strength_block|conditioning_block|exercise|duration|intensity|modality|setup or null",
  "targetDate": "YYYY-MM-DD or null",
  "reason": "short_reason"
}

The app will validate this JSON, then deterministic finalisers/executors/verifiers decide whether anything can happen.`;

export interface SemanticProgramEditDraftVisibleItemSummary {
  id: string;
  title: string;
  domain: string;
  modality?: string | null;
  durationMinutes?: number | null;
  exerciseIds?: string[];
}

export interface SemanticProgramEditDraftVisibleDaySummary {
  date: string;
  short?: string;
  source?: string | null;
  session: {
    id?: string | null;
    name?: string | null;
    workoutType?: string | null;
    sessionTier?: string | null;
    items: SemanticProgramEditDraftVisibleItemSummary[];
    exercises: Array<{
      id?: string | null;
      name?: string | null;
      notes?: string | null;
    }>;
  } | null;
}

export interface SemanticProgramEditDraftLLMContext {
  schemaVersion: typeof SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION;
  todayISO?: string;
  nowISO?: string;
  timezone?: string;
  targetFrame: CoachTargetFrame | null;
  pendingClarifier: ReturnType<typeof summarisePendingClarifier>;
  visibleWeek: SemanticProgramEditDraftVisibleDaySummary[];
  nextWeek?: SemanticProgramEditDraftVisibleDaySummary[];
  visibleCandidates: Array<{
    kind: 'day' | 'session' | 'item' | 'target_frame_option';
    label: string;
    date?: string | null;
    sessionId?: string | null;
    itemId?: string | null;
    domain?: string | null;
  }>;
}

export interface LLMSemanticProgramEditDraftAdapterOptions {
  endpoint: string;
  authToken?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const LOG_TRUNCATE = 240;

function truncate(value: string, n: number = LOG_TRUNCATE): string {
  return value.length <= n ? value : `${value.slice(0, n)}...`;
}

export function semanticProgramEditDraftFunctionNameFromEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  } catch (_err) {
    return endpoint.split('/').filter(Boolean).at(-1) ?? '';
  }
}

export class LLMSemanticProgramEditDraftAdapter implements SemanticProgramEditDraftAdapter {
  private readonly endpoint: string;
  private readonly functionName: string;
  private readonly authToken?: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: LLMSemanticProgramEditDraftAdapterOptions) {
    this.endpoint = opts.endpoint;
    this.functionName = semanticProgramEditDraftFunctionNameFromEndpoint(opts.endpoint);
    this.authToken = opts.authToken;
    this.fetcher = opts.fetcher ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  async buildDraft(input: SemanticProgramEditDraftAdapterInput): Promise<unknown> {
    const context = buildSemanticProgramEditDraftLLMContext(input);
    logger.debug('[semantic-program-edit-draft] input', {
      messageLength: input.userMessage.length,
      todayISO: context.todayISO,
      timezone: context.timezone,
      visibleDays: context.visibleWeek.length,
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
          schema: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA,
          systemPrompt: SEMANTIC_PROGRAM_EDIT_DRAFT_SYSTEM_PROMPT,
        }),
        signal: controller?.signal as any,
      });
    } catch (err) {
      logger.warn('[semantic-program-edit-draft] transport_error', {
        kind: 'fetch_failed',
        detail: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      logger.warn('[semantic-program-edit-draft] transport_error', {
        kind: 'http_error',
        status: resp.status,
        endpoint: this.endpoint,
        functionName: this.functionName,
        diagnostic:
          resp.status === 404
            ? 'semantic adapter endpoint missing / HTTP 404'
            : undefined,
      });
      logger.debug('[semantic-program-edit-draft] http_error body preview', truncate(body));
      throw new Error(`semantic draft endpoint HTTP ${resp.status}`);
    }

    const json = await resp.json();
    logger.debug('[semantic-program-edit-draft] raw', truncate(JSON.stringify(json)));
    return json;
  }
}

export function buildSemanticProgramEditDraftLLMContext(
  input: SemanticProgramEditDraftAdapterInput,
): SemanticProgramEditDraftLLMContext {
  const currentContext = isRecord(input.currentProgramContext)
    ? input.currentProgramContext
    : {};
  const nextWeek = Array.isArray(currentContext.nextWeek)
    ? currentContext.nextWeek as ResolvedDay[]
    : [];
  const visibleWeek = input.visibleWeek.map(summariseDay);
  return {
    schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
    todayISO: input.todayISO,
    nowISO: input.nowISO,
    timezone: input.timezone,
    targetFrame: input.targetFrame,
    pendingClarifier: summarisePendingClarifier(input.pendingClarifier ?? null),
    visibleWeek,
    ...(nextWeek.length ? { nextWeek: nextWeek.map(summariseDay) } : {}),
    visibleCandidates: buildVisibleCandidates({
      visibleWeek,
      targetFrame: input.targetFrame,
    }),
  };
}

function summariseDay(day: ResolvedDay): SemanticProgramEditDraftVisibleDaySummary {
  const workout = day.workout ?? null;
  if (!workout) {
    return {
      date: day.date,
      short: day.short,
      source: day.source,
      session: null,
    };
  }

  return {
    date: day.date,
    short: day.short,
    source: day.source,
    session: {
      id: (workout as any).id ?? null,
      name: workout.name ?? null,
      workoutType: (workout as any).workoutType ?? null,
      sessionTier: (workout as any).sessionTier ?? null,
      items: extractVisibleProgramItemsFromWorkout(workout).map((item) => ({
        id: item.id,
        title: item.title,
        domain: item.domain,
        modality: item.modality ?? null,
        durationMinutes: item.durationMinutes ?? null,
        exerciseIds: item.exerciseIds,
      })),
      exercises: (workout.exercises ?? []).map((exercise: any) => ({
        id: exercise?.id ?? exercise?.exerciseId ?? exercise?.exercise?.id ?? null,
        name: exercise?.exercise?.name ?? null,
        notes: exercise?.notes ?? null,
      })).filter((exercise: { name?: string | null }) => !!exercise.name),
    },
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
    targetSessionName: pending.targetSessionName ?? null,
    pendingClarification: pending.pendingClarification
      ? {
          originalIntent: pending.pendingClarification.originalIntent,
          missingField: pending.pendingClarification.missingField,
          expectedAnswerType: pending.pendingClarification.expectedAnswerType,
          source: pending.pendingClarification.source ?? null,
          continuationId: pending.pendingClarification.continuationId ?? null,
          proposedCandidate: pending.pendingClarification.proposedCandidate ?? null,
          candidateOptions: pending.pendingClarification.candidateOptions ?? [],
          reason: pending.pendingClarification.reason ?? null,
        }
      : null,
    draftEnvelope: pending.programEditDraftEnvelope
      ? {
          source: pending.programEditDraftEnvelope.source,
          continuationId: pending.programEditDraftEnvelope.continuationId,
          originalUserWording: pending.programEditDraftEnvelope.originalUserWording,
          draft: {
            intent: pending.programEditDraftEnvelope.draft.intent,
            targetDomain: pending.programEditDraftEnvelope.draft.targetDomain,
            actionScope: pending.programEditDraftEnvelope.draft.actionScope,
            targetDate: pending.programEditDraftEnvelope.draft.targetDate,
            missingFields: pending.programEditDraftEnvelope.draft.missingFields,
            protectedTargets: pending.programEditDraftEnvelope.draft.protectedTargets,
            proposedActions: pending.programEditDraftEnvelope.draft.proposedActions,
            verifierExpectations: pending.programEditDraftEnvelope.draft.verifierExpectations,
          },
        }
      : null,
    programEdit: pending.programEdit
      ? {
          intent: pending.programEdit.intent,
          targetDomain: pending.programEdit.targetDomain,
          targetDate: pending.programEdit.targetDate,
          targetItemId: pending.programEdit.targetItemId,
          missingFields: pending.programEdit.missingFields,
        }
      : null,
  };
}

function buildVisibleCandidates(args: {
  visibleWeek: SemanticProgramEditDraftVisibleDaySummary[];
  targetFrame: CoachTargetFrame | null;
}): SemanticProgramEditDraftLLMContext['visibleCandidates'] {
  const out: SemanticProgramEditDraftLLMContext['visibleCandidates'] = [];
  for (const day of args.visibleWeek) {
    out.push({
      kind: 'day',
      label: day.session?.name ?? 'Rest',
      date: day.date,
      sessionId: day.session?.id ?? null,
      domain: day.session?.workoutType ?? null,
    });
    if (day.session) {
      out.push({
        kind: 'session',
        label: day.session.name ?? 'session',
        date: day.date,
        sessionId: day.session.id ?? null,
        domain: day.session.workoutType ?? null,
      });
      for (const item of day.session.items) {
        out.push({
          kind: 'item',
          label: item.title,
          date: day.date,
          sessionId: day.session.id ?? null,
          itemId: item.id,
          domain: item.domain,
        });
      }
    }
  }
  for (const option of args.targetFrame?.candidateOptions ?? []) {
    out.push({
      kind: 'target_frame_option',
      label: option.label,
      date: option.date,
      sessionId: null,
      domain: null,
    });
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
