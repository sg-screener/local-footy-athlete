import { createLogger } from './logger';
import { semanticFingerprintV2 } from './semanticFingerprintV2';
import {
  AthleteActionTraceCoordinator,
  type AthleteActionReloadEvidenceV2,
  type AthleteActionTraceCheckpointV2,
  type AthleteActionTraceRecordV2,
  type AthleteActionTraceTokenV2,
  type AthleteSemanticSnapshotV2,
} from '../dev/e2e/AthleteActionTraceCoordinator';

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

export interface AthleteActionTraceContext extends AthleteActionTraceTokenV2 {
  traceId: string;
  spanId: string;
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
  componentId?: string | null;
  adjustmentId?: string | null;
  injuryEpisodeId?: string | null;
  controlId?: string;
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
  componentId?: string | null;
  adjustmentId?: string | null;
  injuryEpisodeId?: string | null;
  controlId?: string;
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
/** Bounded V1 output projection only; V2 owns correlation and terminal truth. */
const retainedEvents: AthleteActionDiagnosticEvent[] = [];
const traceStack: AthleteActionTraceContext[] = [];
let testConfig: DiagnosticTestConfig | null = null;
let hydrationTrace: AthleteActionTraceContext | null = null;
let selectedDebugTraceId: string | null = null;

/** Sole V2 record owner. The legacy event facade below is derived from it. */
export const athleteActionTraceCoordinator = new AthleteActionTraceCoordinator(
  () => athleteActionDiagnosticsEnabled(),
  () => now(),
);

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

/** Versioned SHA-256 correlation hash shared with the V2 semantic contract. */
export function athleteActionDiagnosticHash(value: unknown): string {
  if (!athleteActionDiagnosticsEnabled()) return 'diagnostics-disabled';
  return semanticFingerprintV2(stableValue(value));
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
  input: Omit<AthleteActionTraceContext, 'traceId' | 'spanId' | 'startedAt'>,
  existing?: AthleteActionTraceContext,
  options: { forceRoot?: boolean } = {},
): AthleteActionTraceContext {
  const inherited = options.forceRoot
    ? undefined
    : existing ?? currentAthleteActionTrace();
  if (inherited) {
    const span = athleteActionTraceCoordinator.startSpan(inherited, input.route ?? input.actionType);
    return { ...inherited, spanId: span.spanId };
  }
  const token = athleteActionTraceCoordinator.startRoot({
    source: input.source,
    actionType: input.actionType,
    route: input.route,
    canonicalRequestedAction: {
      actionType: input.actionType,
      scope: input.scope ?? null,
      sourceDate: input.sourceDate ?? input.sessionDate ?? null,
      targetDate: input.targetDate ?? null,
    },
    sourceSurface: input.route,
    controlId: input.controlId,
    sourceDate: input.sourceDate ?? input.sessionDate,
    targetDate: input.targetDate,
    identities: {
      sessionId: input.planEntryId ?? input.workoutId,
      componentId: input.componentId ?? null,
      fixtureId: input.fixtureId ?? input.practiceMatchId,
      adjustmentId: input.adjustmentId ?? null,
      injuryEpisodeId: input.injuryEpisodeId ?? null,
    },
  }, options);
  const trace: AthleteActionTraceContext = {
    ...input,
    ...token,
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
  return athleteActionTraceCoordinator.run(trace, () => {
    traceStack.push(trace);
    let result: T;
    try {
      result = run();
    } catch (error) {
      traceStack.splice(traceStack.lastIndexOf(trace), 1);
      throw error;
    }
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      return Promise.resolve(result).finally(() => {
        const index = traceStack.lastIndexOf(trace);
        if (index >= 0) traceStack.splice(index, 1);
      }) as T;
    }
    const index = traceStack.lastIndexOf(trace);
    if (index >= 0) traceStack.splice(index, 1);
    return result;
  });
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
    ...(trace.componentId !== undefined ? { componentId: trace.componentId } : {}),
    ...(trace.adjustmentId !== undefined ? { adjustmentId: trace.adjustmentId } : {}),
    ...(trace.injuryEpisodeId !== undefined ? { injuryEpisodeId: trace.injuryEpisodeId } : {}),
    ...(trace.controlId !== undefined ? { controlId: trace.controlId } : {}),
    ...safeFields(fields),
  };
  retainedEvents.push(diagnostic);
  if (retainedEvents.length > MAX_RETAINED_EVENTS) {
    retainedEvents.splice(0, retainedEvents.length - MAX_RETAINED_EVENTS);
  }
  if (testConfig?.sink) testConfig.sink(diagnostic);
  else diagnosticLogger.info('[athlete-action-trace]', diagnostic);
  athleteActionTraceCoordinator.recordEvent(trace, event, {
    ...safeFields(fields),
    legacyCompatibilityEvent: true,
  });
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
  return (athleteActionTraceCoordinator.getRecord(traceId)?.events ?? [])
    .filter((entry) =>
      entry.event === 'repair_candidate_rejected' ||
      entry.event === 'transaction_verification_result' ||
      entry.event === 'athlete_action_failed')
    .map((entry) => ({
      event: entry.event as AthleteActionEventName,
      boundary: entry.fields.rejectingBoundary ?? entry.fields.firstFailingBoundary ?? null,
      codes: entry.fields.rejectionCodes ?? entry.fields.originalRejectionCode ?? null,
      category: entry.fields.failureCategory ?? null,
    }));
}

export function queueAthleteActionPersistence(trace?: AthleteActionTraceContext): void {
  // Retained as a source-compatible no-op while callers migrate. Persistence
  // correlation is captured explicitly at the storage boundary, never FIFO.
  void trace;
}

export function consumeAthleteActionPersistenceTrace(): AthleteActionTraceContext | undefined {
  return currentAthleteActionTrace();
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
  traceStack.length = 0;
  hydrationTrace = null;
  selectedDebugTraceId = null;
  athleteActionTraceCoordinator.clear();
}

export function configureAthleteActionDiagnosticsForTests(
  config: DiagnosticTestConfig | null,
): void {
  testConfig = config;
}

export function getAthleteActionTraceV2(traceId: string): AthleteActionTraceRecordV2 | null {
  return athleteActionTraceCoordinator.getRecord(traceId);
}

export function getAthleteActionTracesV2(): AthleteActionTraceRecordV2[] {
  return athleteActionTraceCoordinator.getRecords();
}

export function exportAthleteActionTraceCheckpointV2(): AthleteActionTraceCheckpointV2 {
  return athleteActionTraceCoordinator.exportCheckpoint();
}

export function resumeAthleteActionTraceCheckpointV2(
  checkpoint: AthleteActionTraceCheckpointV2 | null | undefined,
  evidence?: AthleteActionReloadEvidenceV2,
): string[] {
  return athleteActionTraceCoordinator.resumeCheckpoint(checkpoint, evidence);
}

export function recordAthleteActionBeforeV2(args: {
  trace?: AthleteActionTraceContext;
  semantic: AthleteSemanticSnapshotV2;
  visibleCard: unknown;
  visibleDetail: unknown;
  persistedEnvelope: unknown;
}): void {
  athleteActionTraceCoordinator.recordBefore({
    token: args.trace ?? currentAthleteActionTrace(),
    semantic: args.semantic,
    visibleCard: args.visibleCard,
    visibleDetail: args.visibleDetail,
    persistedEnvelope: args.persistedEnvelope,
  });
}

export function recordAthleteActionAfterV2(args: {
  trace?: AthleteActionTraceContext;
  semantic: AthleteSemanticSnapshotV2;
  visibleCard: unknown;
  visibleDetail: unknown;
}): void {
  athleteActionTraceCoordinator.recordAfter({
    token: args.trace ?? currentAthleteActionTrace(),
    semantic: args.semantic,
    visibleCard: args.visibleCard,
    visibleDetail: args.visibleDetail,
  });
}
