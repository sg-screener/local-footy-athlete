import { createLogger } from './logger';

export type AthleteActionSource = 'tap' | 'coach' | 'system';

export type AthleteActionType =
  | 'delete_session'
  | 'delete_component'
  | 'move_session'
  | 'add_session'
  | 'game_day_change'
  | 'practice_match_change'
  | 'clear_adjustment'
  | 'repeat_week'
  | 'rollover'
  | 'readiness_change'
  | 'injury_change'
  | 'equipment_change'
  | 'session_feedback'
  | 'go_lighter'
  | 'coach_command'
  | 'hydration'
  | 'program_change';

export type AthleteActionEventName =
  | 'athlete_mutation_received'
  | 'athlete_action_requested'
  | 'athlete_action_parsed'
  | 'athlete_action_route_selected'
  | 'mutation_constraint_created'
  | 'mutation_preview_result'
  | 'mutation_transaction_staged'
  | 'repair_horizon_selected'
  | 'repair_candidates_generated'
  | 'repair_candidate_rejected'
  | 'repair_candidate_selected'
  | 'accepted_week_gateway_result'
  | 'transaction_verification_result'
  | 'accepted_state_publication_result'
  | 'transaction_publish_result'
  | 'persistence_result'
  | 'visible_projection_result'
  | 'coach_notes_result'
  | 'athlete_action_completed'
  | 'athlete_action_failed'
  | 'athlete_ui_outcome_shown'
  | 'ui_outcome_mapped'
  | 'hydrated_state_checked'
  | 'diagnostic_snapshot';

export type AthleteActionFailureCategory =
  | 'hard_safety'
  | 'bible_contract'
  | 'user_constraint_violation'
  | 'identity_mismatch'
  | 'persistence_failure'
  | 'projection_mismatch'
  | 'technical_failure';

export interface AthleteActionTraceContext {
  traceId: string;
  source: AthleteActionSource;
  actionType: AthleteActionType;
  startedAt: string;
  route?: string;
  currentWeekId?: string;
  sourceDate?: string;
  targetDate?: string;
  sessionDate?: string;
  planEntryId?: string | null;
  workoutId?: string | null;
  scope?: string | null;
  sessionTier?: string | null;
  workoutType?: string | null;
  fixtureId?: string | null;
  practiceMatchId?: string | null;
}

export interface AthleteActionDiagnosticEvent {
  event: AthleteActionEventName;
  traceId: string;
  timestamp: string;
  source: AthleteActionSource;
  actionType: AthleteActionType;
  route?: string;
  currentWeekId?: string;
  sourceDate?: string;
  targetDate?: string;
  sessionDate?: string;
  planEntryId?: string | null;
  workoutId?: string | null;
  scope?: string | null;
  sessionTier?: string | null;
  workoutType?: string | null;
  fixtureId?: string | null;
  practiceMatchId?: string | null;
  [field: string]: unknown;
}

interface DiagnosticTestConfig {
  enabled?: boolean;
  production?: boolean;
  now?: () => Date;
  sink?: (event: AthleteActionDiagnosticEvent) => void;
}

const diagnosticLogger = createLogger({ enableDebugLogs: true });
const MAX_RETAINED_EVENTS = 5000;
const retainedEvents: AthleteActionDiagnosticEvent[] = [];
const traceStack: AthleteActionTraceContext[] = [];
const pendingPersistence: AthleteActionTraceContext[] = [];
let testConfig: DiagnosticTestConfig | null = null;
let traceCounter = 0;
let hydrationTrace: AthleteActionTraceContext | null = null;
let selectedDebugTraceId: string | null = null;

const FORBIDDEN_EVENT_KEYS = /(?:profile|health|bodypart|description|coachnotes|exercises?|prescription|weight|reps?|sets?|medical|symptom|injurydetail)/i;
const SENSITIVE_SNAPSHOT_KEYS = /(?:profile|health|bodypart|description|coachnotes|notes?|exercises?|prescription|weight|reps?|sets?|medical|symptom|injury|rules?|advice|safefocus|message|reason)/i;

function productionBuild(): boolean {
  if (testConfig?.production !== undefined) return testConfig.production;
  const globalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  if (globalDev !== undefined) return !globalDev;
  return process.env.NODE_ENV === 'production';
}

export function athleteActionDiagnosticsEnabled(): boolean {
  if (productionBuild()) return false;
  if (testConfig?.enabled !== undefined) return testConfig.enabled;
  return process.env.EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS === 'true';
}

function now(): Date {
  return testConfig?.now?.() ?? new Date();
}

function stableValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((entry) => stableValue(entry, seen));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, stableValue(entry, seen)]));
}

/** Compact deterministic hash for state/candidate correlation without state dumps. */
export function athleteActionDiagnosticHash(value: unknown): string {
  if (!athleteActionDiagnosticsEnabled()) return 'diagnostics-disabled';
  const input = JSON.stringify(stableValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function nextTraceId(input: Omit<AthleteActionTraceContext, 'traceId' | 'startedAt'>): string {
  traceCounter += 1;
  const timestamp = now().toISOString();
  return `aa-${athleteActionDiagnosticHash({
    timestamp,
    counter: traceCounter,
    source: input.source,
    actionType: input.actionType,
    sourceDate: input.sourceDate,
    targetDate: input.targetDate,
  }).replace('fnv1a-', '')}`;
}

function safeFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([key]) =>
    !FORBIDDEN_EVENT_KEYS.test(key)));
}

export function currentAthleteActionTrace(): AthleteActionTraceContext | undefined {
  return traceStack[traceStack.length - 1];
}

/** First production entry owns the trace; nested entries reuse it. */
export function beginAthleteActionTrace(
  input: Omit<AthleteActionTraceContext, 'traceId' | 'startedAt'>,
  existing?: AthleteActionTraceContext,
): AthleteActionTraceContext {
  const inherited = existing ?? currentAthleteActionTrace();
  if (inherited) return inherited;
  const trace: AthleteActionTraceContext = {
    ...input,
    traceId: nextTraceId(input),
    startedAt: now().toISOString(),
  };
  if (
    !productionBuild() &&
    !selectedDebugTraceId &&
    trace.actionType !== 'hydration' &&
    process.env.EXPO_PUBLIC_ATHLETE_ACTION_DEBUG_NEXT_TRACE === 'true'
  ) {
    selectedDebugTraceId = trace.traceId;
  }
  emitAthleteActionEvent(trace, 'athlete_action_requested', {
    internalResultCode: 'requested',
  });
  return trace;
}

export function runWithAthleteActionTrace<T>(
  trace: AthleteActionTraceContext,
  run: () => T,
): T {
  traceStack.push(trace);
  try {
    return run();
  } finally {
    traceStack.pop();
  }
}

export function emitAthleteActionEvent(
  trace: AthleteActionTraceContext | undefined,
  event: AthleteActionEventName,
  fields: Record<string, unknown> = {},
): AthleteActionDiagnosticEvent | null {
  if (!trace || !athleteActionDiagnosticsEnabled()) return null;
  const diagnostic: AthleteActionDiagnosticEvent = {
    event,
    traceId: trace.traceId,
    timestamp: now().toISOString(),
    source: trace.source,
    actionType: trace.actionType,
    ...(trace.route ? { route: trace.route } : {}),
    ...(trace.currentWeekId ? { currentWeekId: trace.currentWeekId } : {}),
    ...(trace.sourceDate ? { sourceDate: trace.sourceDate } : {}),
    ...(trace.targetDate ? { targetDate: trace.targetDate } : {}),
    ...(trace.sessionDate ? { sessionDate: trace.sessionDate } : {}),
    ...(trace.planEntryId !== undefined ? { planEntryId: trace.planEntryId } : {}),
    ...(trace.workoutId !== undefined ? { workoutId: trace.workoutId } : {}),
    ...(trace.scope !== undefined ? { scope: trace.scope } : {}),
    ...(trace.sessionTier !== undefined ? { sessionTier: trace.sessionTier } : {}),
    ...(trace.workoutType !== undefined ? { workoutType: trace.workoutType } : {}),
    ...(trace.fixtureId !== undefined ? { fixtureId: trace.fixtureId } : {}),
    ...(trace.practiceMatchId !== undefined ? { practiceMatchId: trace.practiceMatchId } : {}),
    ...safeFields(fields),
  };
  retainedEvents.push(diagnostic);
  if (retainedEvents.length > MAX_RETAINED_EVENTS) {
    retainedEvents.splice(0, retainedEvents.length - MAX_RETAINED_EVENTS);
  }
  if (testConfig?.sink) testConfig.sink(diagnostic);
  else diagnosticLogger.info('[athlete-action-trace]', diagnostic);
  return diagnostic;
}

export function classifyAthleteActionFailure(
  code: string | null | undefined,
  boundary = '',
): AthleteActionFailureCategory {
  const value = `${code ?? ''} ${boundary}`.toLowerCase();
  if (/persist|storage|hydrate/.test(value)) return 'persistence_failure';
  if (/projection|ledger|visible|verify/.test(value)) return 'projection_mismatch';
  if (/identity|target|date|session_missing|not_present/.test(value)) return 'identity_mismatch';
  if (/user_removal|constraint|prohibited_target/.test(value)) return 'user_constraint_violation';
  if (/injury|red_flag|hard_stop|safety|maximum_breach|spacing/.test(value)) return 'hard_safety';
  if (/required|contract|pattern|conditioning|strength|sprint|rest/.test(value)) {
    return 'bible_contract';
  }
  return 'technical_failure';
}

/** Stable failure identity without leaking arbitrary exception text into events. */
export function athleteActionErrorCode(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
    if (error instanceof Error && error.name) return error.name;
  }
  return fallback;
}

export function athleteActionTerminalReasonChain(traceId: string): Array<{
  event: AthleteActionEventName;
  boundary: unknown;
  codes: unknown;
  category: unknown;
}> {
  return retainedEvents
    .filter((event) => event.traceId === traceId && (
      event.event === 'repair_candidate_rejected' ||
      event.event === 'transaction_verification_result' ||
      event.event === 'athlete_action_failed'))
    .map((event) => ({
      event: event.event,
      boundary: event.rejectingBoundary ?? event.firstFailingBoundary ?? null,
      codes: event.rejectionCodes ?? event.originalRejectionCode ?? null,
      category: event.failureCategory ?? null,
    }));
}

export function queueAthleteActionPersistence(trace?: AthleteActionTraceContext): void {
  const resolved = trace ?? currentAthleteActionTrace();
  if (!resolved || !athleteActionDiagnosticsEnabled()) return;
  pendingPersistence.push(resolved);
}

export function consumeAthleteActionPersistenceTrace(): AthleteActionTraceContext | undefined {
  return pendingPersistence.shift();
}

export function programHydrationTrace(): AthleteActionTraceContext {
  if (!hydrationTrace) {
    hydrationTrace = beginAthleteActionTrace({
      source: 'system',
      actionType: 'hydration',
      route: 'program_store_hydration',
    });
  }
  return hydrationTrace;
}

export function clearProgramHydrationTrace(): void {
  hydrationTrace = null;
}

function redactSnapshot(value: unknown, includePrescriptions: boolean): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => redactSnapshot(entry, includePrescriptions));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
    if (SENSITIVE_SNAPSHOT_KEYS.test(key) && !(
      includePrescriptions && /exercise|prescription|weight|reps?|sets?/i.test(key)
    )) return [key, '[redacted]'];
    return [key, redactSnapshot(entry, includePrescriptions)];
  }));
}

/** Optional deep snapshot for one explicitly selected local trace only. */
export function emitAthleteActionDebugSnapshot(
  trace: AthleteActionTraceContext,
  label: string,
  snapshot: unknown,
): void {
  if (!athleteActionDiagnosticsEnabled() ||
    (
      process.env.EXPO_PUBLIC_ATHLETE_ACTION_DEBUG_TRACE_ID !== trace.traceId &&
      selectedDebugTraceId !== trace.traceId
    )) return;
  const includePrescriptions =
    process.env.EXPO_PUBLIC_ATHLETE_ACTION_INCLUDE_PRESCRIPTIONS === 'true';
  emitAthleteActionEvent(trace, 'diagnostic_snapshot', {
    snapshotLabel: label,
    snapshotHash: athleteActionDiagnosticHash(snapshot),
    snapshot: redactSnapshot(snapshot, includePrescriptions),
    prescriptionsIncluded: includePrescriptions,
  });
}

/** Local debugger hook for selecting exactly one already-known trace. */
export function selectAthleteActionDebugTrace(traceId: string | null): void {
  if (productionBuild()) return;
  selectedDebugTraceId = traceId;
}

export function getAthleteActionDiagnosticEvents(traceId?: string): AthleteActionDiagnosticEvent[] {
  return retainedEvents.filter((event) => !traceId || event.traceId === traceId)
    .map((event) => ({ ...event }));
}

export function clearAthleteActionDiagnosticEvents(): void {
  retainedEvents.length = 0;
  pendingPersistence.length = 0;
  traceStack.length = 0;
  hydrationTrace = null;
  selectedDebugTraceId = null;
}

export function configureAthleteActionDiagnosticsForTests(
  config: DiagnosticTestConfig | null,
): void {
  testConfig = config;
}
