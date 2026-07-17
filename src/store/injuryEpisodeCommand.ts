import type { ActiveInjuryConstraint } from './coachUpdatesStore';
import { normalizeAcceptedMaterialContext } from './acceptedStateColdStart';
import { useProgramStore } from './programStore';
import {
  transactExactInjuryEpisode,
  type ExactInjuryEpisodeTransactionInput,
  type ExactInjuryEpisodeTransactionResult,
  type InjuryEpisodeTransactionTestHooks,
} from './injuryEpisodeTransaction';
import type { InjuryEpisodeV1 } from '../rules/injuryEpisode';
import { classifyBibleInjurySeverity } from '../rules/injurySeverityBands';
import {
  buildInjuryPolicy,
  resolveInjuryBucket,
} from '../utils/programAdjustmentEngine';
import type { RedFlagAdviceLevel } from '../utils/injuryClarificationGuard';
import {
  athleteActionDiagnosticsEnabled,
  beginAthleteActionTrace,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

export type InjuryEpisodeRedFlagReason =
  | 'chest_symptom'
  | 'breathing_symptom'
  | 'dizziness_or_fainting'
  | 'numbness_or_tingling'
  | 'weakness_or_loss_of_power'
  | 'head_or_concussion'
  | 'pop_snap_or_tear'
  | 'cannot_bear_weight'
  | 'cannot_walk'
  | 'severe_swelling'
  | 'major_loss_of_function'
  | 'severe_pain_after_acute_incident'
  | 'other_clinical_red_flag';

export type InjuryEpisodeCommandSafety =
  | { kind: 'standard' }
  | {
      kind: 'red_flag';
      advice: RedFlagAdviceLevel;
      reason: InjuryEpisodeRedFlagReason;
    };

interface InjuryEpisodeCommandBase {
  commandId: `coach-injury:${string}`;
  turnId: string;
  expectedAcceptedRevision: number;
  todayISO: string;
  occurredAtISO: string;
  sourceActor: 'athlete';
  sourceSurface: 'coach_chat';
  note: string;
  safety: InjuryEpisodeCommandSafety;
}

export type InjuryEpisodeCommand =
  | (InjuryEpisodeCommandBase & {
      operation: 'report';
      bodyPart: string;
      severity: number;
    })
  | (InjuryEpisodeCommandBase & {
      operation: 'update';
      episodeId: string;
      severity: number;
      status: 'active' | 'improving';
      change: 'severity_reply' | 'improving' | 'worsening';
    })
  | (InjuryEpisodeCommandBase & {
      operation: 'refresh' | 'resolve';
      episodeId: string;
    });

export interface ExecuteInjuryEpisodeCommandOptions {
  /** Existing TraceV2 root supplied by the eventual Coach turn owner. */
  trace?: AthleteActionTraceContext;
  /** @internal Permanent failure-boundary witnesses. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
}

export type InjuryEpisodeCommandResult = ExactInjuryEpisodeTransactionResult;

const RED_FLAG_REASONS = new Set<InjuryEpisodeRedFlagReason>([
  'chest_symptom',
  'breathing_symptom',
  'dizziness_or_fainting',
  'numbness_or_tingling',
  'weakness_or_loss_of_power',
  'head_or_concussion',
  'pop_snap_or_tear',
  'cannot_bear_weight',
  'cannot_walk',
  'severe_swelling',
  'major_loss_of_function',
  'severe_pain_after_acute_incident',
  'other_clinical_red_flag',
]);

function isSeverity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

function validCommand(command: InjuryEpisodeCommand): boolean {
  if (!command.turnId.trim() || command.commandId !== `coach-injury:${command.turnId}`) return false;
  if (!Number.isInteger(command.expectedAcceptedRevision) || command.expectedAcceptedRevision < 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(command.todayISO)) return false;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(command.occurredAtISO)) return false;
  if (command.sourceActor !== 'athlete' || command.sourceSurface !== 'coach_chat') return false;
  if (typeof command.note !== 'string') return false;
  if (command.safety.kind === 'red_flag' && (
    !['urgent_medical', 'physio_medical'].includes(command.safety.advice) ||
    !RED_FLAG_REASONS.has(command.safety.reason)
  )) return false;
  if (command.operation === 'report') {
    return !!command.bodyPart.trim() && isSeverity(command.severity);
  }
  if (!command.episodeId.trim()) return false;
  if (command.operation === 'update') {
    return isSeverity(command.severity) &&
      (command.status === 'active' || command.status === 'improving') &&
      (command.change === 'severity_reply' || command.change === 'improving' ||
        command.change === 'worsening');
  }
  return true;
}

function safelyRejected(command: InjuryEpisodeCommand): InjuryEpisodeCommandResult {
  return {
    outcome: 'safely_rejected',
    episodeId: command.operation === 'report' ? null : command.episodeId,
    acceptedStateChanged: false,
    visibleProgramChanged: false,
    changedProgram: false,
    message: 'The injury command was incomplete or invalid, so no accepted state was changed.',
    reason: 'invalid_injury_episode_command',
  } as InjuryEpisodeCommandResult;
}

function severityMetadata(severity: number): Pick<
  ActiveInjuryConstraint,
  'severityBand' | 'adjustmentLevel'
> {
  switch (classifyBibleInjurySeverity(severity).band) {
    case 'avoid_trigger_1_3':
      return { severityBand: 'mild', adjustmentLevel: 'minimal' };
    case 'reduce_affected_4_5':
      return { severityBand: 'slight', adjustmentLevel: 'slight' };
    case 'restrict_and_refer_6_7':
      return { severityBand: 'moderate', adjustmentLevel: 'moderate' };
    case 'pause_affected_8_10':
      return { severityBand: 'avoid', adjustmentLevel: 'training_paused' };
  }
}

function commandConstraint(args: {
  command: Extract<InjuryEpisodeCommand, { operation: 'report' | 'update' }>;
  existing?: InjuryEpisodeV1;
}): ActiveInjuryConstraint {
  const bodyPart = args.existing?.bodyPart ??
    (args.command.operation === 'report' ? args.command.bodyPart.trim() : 'unknown');
  const bucket = args.existing?.bucket ?? resolveInjuryBucket(bodyPart);
  const policy = buildInjuryPolicy(bucket, args.command.severity);
  const redFlag = args.command.safety.kind === 'red_flag';
  const metadata = severityMetadata(args.command.severity);
  const priorSeverity = args.existing && (
    args.command.operation === 'update' && args.command.change === 'improving' ||
    args.command.severity < args.existing.severity
  ) ? args.existing.severity : undefined;
  return {
    id: args.existing?.compatibility.constraintId ?? args.command.commandId,
    type: 'injury',
    ...(args.existing ? { injuryEpisodeId: args.existing.episodeId } : {}),
    bodyPart,
    bucket,
    severity: args.command.severity,
    priorSeverity,
    status: args.command.operation === 'update' ? args.command.status : 'active',
    startDate: args.existing?.onsetOrReportedDate ?? args.command.todayISO,
    lastUpdatedAt: args.command.occurredAtISO,
    source: 'coach',
    ...(args.existing?.region ? { region: args.existing.region } : {}),
    severityBand: redFlag ? 'avoid' : metadata.severityBand,
    adjustmentLevel: redFlag ? 'training_paused' : metadata.adjustmentLevel,
    triggers: [...(args.existing?.triggers ?? [])],
    seriousSymptoms: redFlag,
    seriousSymptom: redFlag ? args.command.safety.reason : undefined,
    rules: [...policy.globalRules],
    safeFocus: [...policy.replacements, ...policy.preserveText],
    advice: policy.closingAdvice ? [policy.closingAdvice] : [],
    modifierAffects: ['current_week', 'future_generation'],
    presentationOnlyDismiss: true,
  };
}

function transactionInput(
  command: InjuryEpisodeCommand,
  options: ExecuteInjuryEpisodeCommandOptions,
  trace: AthleteActionTraceContext | undefined,
): ExactInjuryEpisodeTransactionInput {
  const common = {
    sourceActor: command.sourceActor,
    sourceSurface: command.sourceSurface,
    note: command.note,
    todayISO: command.todayISO,
    occurredAtISO: command.occurredAtISO,
    expectedAcceptedRevision: command.expectedAcceptedRevision,
    testHooks: options.testHooks,
    trace,
  } as const;
  if (command.operation === 'report') {
    return {
      ...common,
      operation: 'report',
      constraint: commandConstraint({ command }),
    };
  }
  if (command.operation === 'update') {
    const context = normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext,
    );
    const existing = context.injuryEpisodes.find((episode) =>
      episode.episodeId === command.episodeId);
    return {
      ...common,
      operation: 'update',
      episodeId: command.episodeId,
      constraint: commandConstraint({ command, existing }),
    };
  }
  return {
    ...common,
    operation: command.operation,
    episodeId: command.episodeId,
  };
}

function rollbackOutcome(result: InjuryEpisodeCommandResult): string {
  if (result.acceptedStateChanged || result.outcome === 'already_resolved' ||
    result.outcome === 'conflicted') return 'not_required';
  return result.reason === 'injury_episode_not_found' ||
    result.reason === 'injury_episode_not_active' ||
    result.reason === 'injury_episode_command_already_recorded' ||
    result.reason === 'invalid_injury_episode_command'
    ? 'not_required'
    : 'verified';
}

async function executeWithinTrace(
  command: InjuryEpisodeCommand,
  options: ExecuteInjuryEpisodeCommandOptions,
  trace?: AthleteActionTraceContext,
): Promise<InjuryEpisodeCommandResult> {
  emitAthleteActionEvent(trace, 'athlete_action_route_selected', {
    commandOperation: command.operation,
    commandTarget: command.operation === 'report' ? 'new_report' : 'exact_episode',
    targetEpisodeId: command.operation === 'report' ? null : command.episodeId,
    expectedAcceptedRevision: command.expectedAcceptedRevision,
  });
  const result = validCommand(command)
    ? await transactExactInjuryEpisode(transactionInput(command, options, trace))
    : safelyRejected(command);
  emitAthleteActionEvent(trace, 'transaction_verification_result', {
    commandOperation: command.operation,
    targetEpisodeId: result.episodeId,
    expectedAcceptedRevision: command.expectedAcceptedRevision,
    acceptedStateChanged: result.acceptedStateChanged,
    visibleProgramChanged: result.visibleProgramChanged,
    persistenceReadbackVerification: result.acceptedStateChanged ? 'verified' : 'not_acknowledged',
    rollbackOutcome: rollbackOutcome(result),
    internalResultCode: `coach_injury_${result.outcome}`,
  });
  emitAthleteActionEvent(
    trace,
    result.outcome === 'conflicted' || result.outcome === 'safely_rejected'
      ? 'athlete_action_failed'
      : 'athlete_action_completed',
    {
      commandOperation: command.operation,
      acceptedStateChanged: result.acceptedStateChanged,
      visibleProgramChanged: result.visibleProgramChanged,
      internalResultCode: `coach_injury_${result.outcome}`,
    },
  );
  return result;
}

/**
 * Canonical Coach injury command executor. It never creates a TraceV2 root and
 * never reads wall-clock time; callers supply both the trace and transaction
 * timestamps explicitly.
 */
export async function executeInjuryEpisodeCommand(
  command: InjuryEpisodeCommand,
  options: ExecuteInjuryEpisodeCommandOptions = {},
): Promise<InjuryEpisodeCommandResult> {
  if (!options.trace || !athleteActionDiagnosticsEnabled()) {
    return executeWithinTrace(command, options, options.trace);
  }
  const child = beginAthleteActionTrace({
    source: 'coach',
    actionType: 'injury_change',
    route: `executeInjuryEpisodeCommand:${command.operation}`,
    sourceDate: command.todayISO,
    sessionDate: command.todayISO,
    scope: 'canonical_injury_episode_command',
    injuryEpisodeId: command.operation === 'report' ? null : command.episodeId,
    controlId: command.commandId,
  }, options.trace);
  return runWithAthleteActionTrace(child, () =>
    executeWithinTrace(command, options, child));
}
