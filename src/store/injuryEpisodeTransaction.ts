import type { ActiveInjuryConstraint } from './coachUpdatesStore';
import {
  normalizeAcceptedMaterialContext,
  type AcceptedCompositionBaseV1,
} from './acceptedStateColdStart';
import { useProgramStore } from './programStore';
import {
  INJURY_EPISODE_PROTOCOL_VERSION,
  activeInjuryEpisodes,
  type InjuryEpisodeSourceActor,
  type InjuryEpisodeStatus,
  type InjuryEpisodeTransitionV1,
  type InjuryEpisodeV1,
} from '../rules/injuryEpisode';
import { isInjurySourceFact } from '../rules/temporarySourceFact';
import {
  athleteActionDiagnosticsEnabled,
  beginAthleteActionTrace,
  emitAthleteActionEvent,
  runWithAthleteActionTrace,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';
import { todayISOLocal } from '../utils/appDate';
import {
  commitTemporarySourceFactSet,
  loadCanonicalTemporarySourceFactOwnership,
} from './temporarySourceFactTransaction';

export type InjuryEpisodeMutationOutcome =
  | 'created_and_recomposed'
  | 'created_no_program_change'
  | 'updated_and_recomposed'
  | 'updated_no_program_change'
  | 'refreshed_and_recomposed'
  | 'refreshed_no_program_change'
  | 'conflicted'
  | 'safely_rejected';

export type InjuryEpisodeResolutionOutcome =
  | 'resolved_and_recomposed'
  | 'resolved_no_program_change'
  | 'conflicted'
  | 'already_resolved'
  | 'safely_rejected';

export interface InjuryEpisodeMutationResult {
  outcome: InjuryEpisodeMutationOutcome;
  episodeId: string | null;
  acceptedStateChanged: boolean;
  visibleProgramChanged: boolean;
  /** @deprecated Compatibility alias for visibleProgramChanged. */
  changedProgram: boolean;
  message: string;
  reason?: string;
}

export interface InjuryEpisodeResolutionResult {
  outcome: InjuryEpisodeResolutionOutcome;
  episodeId: string;
  acceptedStateChanged: boolean;
  visibleProgramChanged: boolean;
  /** @deprecated Compatibility alias for visibleProgramChanged. */
  changedProgram: boolean;
  message: string;
  reason?: string;
}

export interface CreateOrUpdateInjuryEpisodeInput {
  constraint: ActiveInjuryConstraint;
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
  note?: string;
  todayISO?: string;
  /** Deterministic transaction clock for accepted fixtures and replay tests. */
  now?: string;
  expectedAcceptedRevision?: number;
  /** @internal Deterministic failure-boundary witnesses for transaction tests. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
  trace?: AthleteActionTraceContext;
}

export interface InjuryEpisodeTransactionTestHooks {
  beforeStage?: () => void;
  beforeEffectiveValidation?: () => void;
  verifyCandidate?: () => boolean;
  verifyAfterPersistence?: () => boolean;
}

export interface UpdateInjuryEpisodeInput {
  episodeId: string;
  severity: number;
  status: Extract<InjuryEpisodeStatus, 'active' | 'improving'>;
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
  note?: string;
  todayISO?: string;
  /** Deterministic transaction clock for accepted fixtures and replay tests. */
  now?: string;
  expectedAcceptedRevision?: number;
  /** @internal Deterministic failure-boundary witnesses for transaction tests. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
  trace?: AthleteActionTraceContext;
}

export interface RefreshInjuryEpisodeInput {
  episodeId: string;
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
  note?: string;
  todayISO?: string;
  /** Deterministic transaction clock for accepted fixtures and replay tests. */
  now?: string;
  expectedAcceptedRevision?: number;
  /** @internal Deterministic failure-boundary witnesses for transaction tests. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
  trace?: AthleteActionTraceContext;
}

export interface ResolveInjuryEpisodeOptions {
  sourceActor?: InjuryEpisodeSourceActor;
  sourceSurface?: string;
  note?: string;
  todayISO?: string;
  /** Deterministic transaction clock for accepted fixtures and replay tests. */
  now?: string;
  expectedAcceptedRevision?: number;
  /** @internal Deterministic failure-boundary witnesses for transaction tests. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
  trace?: AthleteActionTraceContext;
}

interface ExactInjuryEpisodeTransactionBase {
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
  note?: string;
  todayISO: string;
  occurredAtISO: string;
  expectedAcceptedRevision: number;
  testHooks?: InjuryEpisodeTransactionTestHooks;
  trace?: AthleteActionTraceContext;
}

export type ExactInjuryEpisodeTransactionInput =
  | (ExactInjuryEpisodeTransactionBase & {
      operation: 'report';
      constraint: ActiveInjuryConstraint;
    })
  | (ExactInjuryEpisodeTransactionBase & {
      operation: 'update';
      episodeId: string;
      constraint: ActiveInjuryConstraint;
    })
  | (ExactInjuryEpisodeTransactionBase & {
      operation: 'refresh' | 'resolve';
      episodeId: string;
    });

export type ExactInjuryEpisodeTransactionResult =
  | InjuryEpisodeMutationResult
  | InjuryEpisodeResolutionResult;

interface CanonicalOwnershipSnapshot {
  context: ReturnType<typeof normalizeAcceptedMaterialContext>;
  compositionBase: AcceptedCompositionBaseV1;
}

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mondayFor(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function acceptedWeeksAndDates(anchorDate: string): { weeks: string[]; dates: string[] } {
  const state = useProgramStore.getState();
  const weeks = new Set<string>();
  for (const microcycle of state.currentProgram?.microcycles ?? []) {
    weeks.add(microcycle.startDate.slice(0, 10));
  }
  if (state.currentMicrocycle) weeks.add(state.currentMicrocycle.startDate.slice(0, 10));
  for (const week of Object.keys(state.weekScopedOverlays ?? {})) weeks.add(week.slice(0, 10));
  for (const date of Object.keys(state.dateOverrides ?? {})) weeks.add(mondayFor(date));
  weeks.add(mondayFor(anchorDate));
  const sortedWeeks = Array.from(weeks).sort();
  return {
    weeks: sortedWeeks,
    dates: sortedWeeks.flatMap((week) =>
      Array.from({ length: 7 }, (_, offset) => addDays(week, offset)))
      .filter((date) => date >= anchorDate)
      .sort(),
  };
}

function currentOwnership(now: string): CanonicalOwnershipSnapshot {
  return loadCanonicalTemporarySourceFactOwnership(now);
}

function activeEpisodeForConstraint(
  episodes: readonly InjuryEpisodeV1[],
  constraint: ActiveInjuryConstraint,
): InjuryEpisodeV1 | null {
  if (constraint.injuryEpisodeId) {
    const exact = episodes.find((episode) => episode.episodeId === constraint.injuryEpisodeId);
    if (exact) return exact;
  }
  return [...activeInjuryEpisodes(episodes)]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .find((episode) =>
      episode.compatibility.constraintId === constraint.id || (
        episode.bucket === constraint.bucket &&
        episode.bodyPart.toLowerCase() === constraint.bodyPart.toLowerCase()
      )) ?? null;
}

function stableEpisodeId(constraint: ActiveInjuryConstraint, now: string): string {
  const suffix = now.replace(/[^0-9]/g, '').slice(0, 17);
  const id = constraint.id.trim().replace(/[^a-zA-Z0-9:_-]+/g, '-');
  return `injury-episode:v1:${id}:${suffix}`;
}

function transition(args: {
  now: string;
  fromStatus: InjuryEpisodeTransitionV1['fromStatus'];
  toStatus: InjuryEpisodeStatus;
  severity: number;
  note?: string;
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
}): InjuryEpisodeTransitionV1 {
  return {
    timestamp: args.now,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    severity: Math.max(0, Math.min(10, Math.round(args.severity))),
    note: args.note?.trim() ?? '',
    sourceActor: args.sourceActor,
    sourceSurface: args.sourceSurface,
  };
}

function episodeFromConstraint(args: {
  constraint: ActiveInjuryConstraint;
  existing: InjuryEpisodeV1 | null;
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
  note?: string;
  now: string;
  anchorDate: string;
  affectedDates: string[];
  affectedWeeks: string[];
}): InjuryEpisodeV1 {
  const status = args.constraint.status === 'improving' ? 'improving' : 'active';
  const severity = Math.max(0, Math.min(10, Math.round(args.constraint.severity)));
  if (args.existing) {
    return {
      ...args.existing,
      bodyPart: args.constraint.bodyPart,
      region: args.constraint.region,
      bucket: args.constraint.bucket,
      severity,
      status,
      updatedAt: args.now,
      resolvedAt: null,
      triggers: [...(args.constraint.triggers ?? args.existing.triggers)],
      seriousSymptoms: args.constraint.seriousSymptoms === true,
      seriousSymptom: args.constraint.seriousSymptom,
      transitionHistory: [
        ...args.existing.transitionHistory,
        transition({
          now: args.now,
          fromStatus: args.existing.status,
          toStatus: status,
          severity,
          note: args.note,
          sourceActor: args.sourceActor,
          sourceSurface: args.sourceSurface,
        }),
      ],
      sourceActor: args.sourceActor,
      sourceSurface: args.sourceSurface,
      affectedDates: Array.from(new Set([
        ...args.existing.affectedDates,
        ...args.affectedDates,
      ])).sort(),
      affectedWeeks: Array.from(new Set([
        ...args.existing.affectedWeeks,
        ...args.affectedWeeks,
      ])).sort(),
      currentRestrictionPolicy: {
        rules: [...args.constraint.rules],
        safeFocus: [...args.constraint.safeFocus],
        advice: [...args.constraint.advice],
        severityBand: args.constraint.severityBand,
        adjustmentLevel: args.constraint.adjustmentLevel,
        priorSeverity: args.constraint.priorSeverity,
      },
      compatibility: {
        ...args.existing.compatibility,
        constraintId: args.constraint.id,
      },
    };
  }
  return {
    protocolVersion: INJURY_EPISODE_PROTOCOL_VERSION,
    episodeId: stableEpisodeId(args.constraint, args.now),
    bodyPart: args.constraint.bodyPart,
    region: args.constraint.region,
    bucket: args.constraint.bucket,
    severity,
    status,
    onsetOrReportedDate: (args.constraint.startDate || args.anchorDate).slice(0, 10),
    createdAt: args.now,
    updatedAt: args.now,
    resolvedAt: null,
    triggers: [...(args.constraint.triggers ?? [])],
    seriousSymptoms: args.constraint.seriousSymptoms === true,
    seriousSymptom: args.constraint.seriousSymptom,
    transitionHistory: [transition({
      now: args.now,
      fromStatus: 'new',
      toStatus: status,
      severity,
      note: args.note,
      sourceActor: args.sourceActor,
      sourceSurface: args.sourceSurface,
    })],
    sourceActor: args.sourceActor,
    sourceSurface: args.sourceSurface,
    affectedDates: [...args.affectedDates],
    affectedWeeks: [...args.affectedWeeks],
    currentRestrictionPolicy: {
      rules: [...args.constraint.rules],
      safeFocus: [...args.constraint.safeFocus],
      advice: [...args.constraint.advice],
      severityBand: args.constraint.severityBand,
      adjustmentLevel: args.constraint.adjustmentLevel,
      priorSeverity: args.constraint.priorSeverity,
    },
    legacyMigrationStatus: 'native_v1',
    compatibility: { constraintId: args.constraint.id },
  };
}

async function persistEpisodeSet(args: {
  nextEpisodes: InjuryEpisodeV1[];
  ownership: CanonicalOwnershipSnapshot;
  anchorDate: string;
  now: string;
  reason: string;
  expectedAcceptedRevision?: number;
  targetEpisodeId: string;
  testHooks?: InjuryEpisodeTransactionTestHooks;
  trace?: AthleteActionTraceContext;
}): Promise<{
  ok: boolean;
  acceptedStateChanged: boolean;
  visibleProgramChanged: boolean;
  changedProgram: boolean;
  reason?: string;
  route?: string;
}> {
  const nonInjuryFacts = args.ownership.context.temporarySourceFacts
    .filter((fact) => !isInjurySourceFact(fact));
  return commitTemporarySourceFactSet({
    nextFacts: [...nonInjuryFacts, ...args.nextEpisodes],
    targetFactId: args.targetEpisodeId,
    todayISO: args.anchorDate,
    reason: args.reason,
    now: args.now,
    expectedAcceptedRevision: args.expectedAcceptedRevision ?? args.ownership.context.revision,
    testHooks: args.testHooks,
    trace: args.trace,
  });
}

function unchangedResult(args: {
  outcome: 'conflicted' | 'safely_rejected' | 'already_resolved';
  episodeId: string | null;
  message: string;
  reason?: string;
}): ExactInjuryEpisodeTransactionResult {
  return {
    outcome: args.outcome,
    episodeId: args.episodeId,
    acceptedStateChanged: false,
    visibleProgramChanged: false,
    changedProgram: false,
    message: args.message,
    ...(args.reason ? { reason: args.reason } : {}),
  } as ExactInjuryEpisodeTransactionResult;
}

function acceptedResult(args: {
  operation: 'report' | 'update' | 'refresh' | 'resolve';
  episodeId: string;
  visibleProgramChanged: boolean;
}): ExactInjuryEpisodeTransactionResult {
  const prefix = args.operation === 'report' ? 'created' :
    args.operation === 'update' ? 'updated' :
      args.operation === 'refresh' ? 'refreshed' : 'resolved';
  const outcome = `${prefix}_${args.visibleProgramChanged
    ? 'and_recomposed'
    : 'no_program_change'}` as
      | InjuryEpisodeMutationOutcome
      | InjuryEpisodeResolutionOutcome;
  const message = args.operation === 'resolve'
    ? args.visibleProgramChanged
      ? 'Injury resolved. Affected sessions were safely recomposed.'
      : 'Injury resolved. No affected session needed changing.'
    : args.operation === 'refresh'
      ? args.visibleProgramChanged
        ? 'Injury restrictions were refreshed and affected sessions were safely recomposed.'
        : 'Injury restrictions were refreshed. No affected session needed changing.'
      : args.visibleProgramChanged
        ? 'Injury restrictions are active and affected sessions were safely recomposed.'
        : 'Injury restrictions are active. No affected session needed changing.';
  return {
    outcome,
    episodeId: args.episodeId,
    acceptedStateChanged: true,
    visibleProgramChanged: args.visibleProgramChanged,
    changedProgram: args.visibleProgramChanged,
    message,
  } as ExactInjuryEpisodeTransactionResult;
}

/**
 * Exact canonical injury mutation boundary. It owns episode targeting and
 * transition construction, then delegates publication, persistence, readback,
 * visible verification, and exact rollback to TemporarySourceFactTransaction.
 */
export async function transactExactInjuryEpisode(
  input: ExactInjuryEpisodeTransactionInput,
): Promise<ExactInjuryEpisodeTransactionResult> {
  const ownership = currentOwnership(input.occurredAtISO);
  const targetEpisodeId = input.operation === 'report' ? null : input.episodeId;
  if (input.expectedAcceptedRevision !== ownership.context.revision) {
    return unchangedResult({
      outcome: 'conflicted',
      episodeId: targetEpisodeId,
      message: 'The program changed before the injury command could be applied.',
      reason: 'accepted_revision_changed',
    });
  }

  const horizon = acceptedWeeksAndDates(input.todayISO);
  let nextEpisode: InjuryEpisodeV1;
  let nextEpisodes: InjuryEpisodeV1[];

  if (input.operation === 'report') {
    nextEpisode = episodeFromConstraint({
      constraint: input.constraint,
      existing: null,
      sourceActor: input.sourceActor,
      sourceSurface: input.sourceSurface,
      note: input.note,
      now: input.occurredAtISO,
      anchorDate: input.todayISO,
      affectedDates: horizon.dates,
      affectedWeeks: horizon.weeks,
    });
    if (ownership.context.injuryEpisodes.some((episode) =>
      episode.episodeId === nextEpisode.episodeId)) {
      return unchangedResult({
        outcome: 'safely_rejected',
        episodeId: nextEpisode.episodeId,
        message: 'That injury report command was already recorded.',
        reason: 'injury_episode_command_already_recorded',
      });
    }
    nextEpisodes = [...ownership.context.injuryEpisodes, nextEpisode];
  } else {
    const existing = ownership.context.injuryEpisodes.find((episode) =>
      episode.episodeId === input.episodeId);
    if (!existing) {
      return unchangedResult({
        outcome: 'safely_rejected',
        episodeId: input.episodeId,
        message: 'That exact injury episode could not be matched. No restrictions were changed.',
        reason: 'injury_episode_not_found',
      });
    }
    if (input.operation === 'resolve' &&
      (existing.status === 'resolved' || existing.status === 'superseded')) {
      return unchangedResult({
        outcome: 'already_resolved',
        episodeId: input.episodeId,
        message: 'That injury episode is already resolved.',
      });
    }
    if ((input.operation === 'update' || input.operation === 'refresh') &&
      !activeInjuryEpisodes([existing]).length) {
      return unchangedResult({
        outcome: 'safely_rejected',
        episodeId: input.episodeId,
        message: 'That exact active injury episode could not be matched.',
        reason: 'injury_episode_not_active',
      });
    }

    if (input.operation === 'update') {
      nextEpisode = episodeFromConstraint({
        constraint: input.constraint,
        existing,
        sourceActor: input.sourceActor,
        sourceSurface: input.sourceSurface,
        note: input.note,
        now: input.occurredAtISO,
        anchorDate: input.todayISO,
        affectedDates: horizon.dates,
        affectedWeeks: horizon.weeks,
      });
    } else if (input.operation === 'refresh') {
      nextEpisode = {
        ...existing,
        updatedAt: input.occurredAtISO,
        transitionHistory: [
          ...existing.transitionHistory,
          transition({
            now: input.occurredAtISO,
            fromStatus: existing.status,
            toStatus: existing.status,
            severity: existing.severity,
            note: input.note,
            sourceActor: input.sourceActor,
            sourceSurface: input.sourceSurface,
          }),
        ],
        sourceActor: input.sourceActor,
        sourceSurface: input.sourceSurface,
        affectedDates: Array.from(new Set([
          ...existing.affectedDates,
          ...horizon.dates,
        ])).sort(),
        affectedWeeks: Array.from(new Set([
          ...existing.affectedWeeks,
          ...horizon.weeks,
        ])).sort(),
        currentRestrictionPolicy: {
          ...existing.currentRestrictionPolicy,
          rules: [...existing.currentRestrictionPolicy.rules],
          safeFocus: [...existing.currentRestrictionPolicy.safeFocus],
          advice: [...existing.currentRestrictionPolicy.advice],
        },
      };
    } else {
      nextEpisode = {
        ...existing,
        severity: 0,
        status: 'resolved',
        updatedAt: input.occurredAtISO,
        resolvedAt: input.occurredAtISO,
        transitionHistory: [
          ...existing.transitionHistory,
          transition({
            now: input.occurredAtISO,
            fromStatus: existing.status,
            toStatus: 'resolved',
            severity: 0,
            note: input.note,
            sourceActor: input.sourceActor,
            sourceSurface: input.sourceSurface,
          }),
        ],
        sourceActor: input.sourceActor,
        sourceSurface: input.sourceSurface,
        currentRestrictionPolicy: {
          ...existing.currentRestrictionPolicy,
          rules: [],
          safeFocus: [],
          advice: [],
          priorSeverity: existing.severity,
        },
      };
    }
    nextEpisodes = ownership.context.injuryEpisodes.map((episode) =>
      episode.episodeId === input.episodeId ? nextEpisode : episode);
  }

  const persisted = await persistEpisodeSet({
    nextEpisodes,
    ownership,
    anchorDate: input.todayISO,
    now: input.occurredAtISO,
    reason: `injury_episode:${input.operation}`,
    expectedAcceptedRevision: input.expectedAcceptedRevision,
    targetEpisodeId: nextEpisode.episodeId,
    testHooks: input.testHooks,
    trace: input.trace,
  });
  if (!persisted.ok) {
    return unchangedResult({
      outcome: persisted.route === 'conflicted' ? 'conflicted' : 'safely_rejected',
      episodeId: nextEpisode.episodeId,
      message: persisted.route === 'conflicted'
        ? 'The program changed before the injury command could be applied.'
        : 'The injury command was not applied because the accepted program could not be verified.',
      reason: persisted.reason,
    });
  }
  return acceptedResult({
    operation: input.operation,
    episodeId: nextEpisode.episodeId,
    visibleProgramChanged: persisted.visibleProgramChanged,
  });
}

export async function createOrUpdateInjuryEpisode(
  input: CreateOrUpdateInjuryEpisodeInput,
): Promise<InjuryEpisodeMutationResult> {
  if (!athleteActionDiagnosticsEnabled()) return createOrUpdateInjuryEpisodeWithinTrace(input);
  const trace = beginAthleteActionTrace({
    source: /coach/i.test(input.sourceSurface)
      ? 'coach'
      : input.sourceActor === 'system' ? 'system' : 'tap',
    actionType: 'injury_change',
    route: `canonical_injury_episode:${input.sourceSurface}`,
    sourceDate: (input.todayISO ?? todayISOLocal()).slice(0, 10),
    sessionDate: (input.todayISO ?? todayISOLocal()).slice(0, 10),
    scope: 'canonical_injury_episode',
    injuryEpisodeId: input.constraint.injuryEpisodeId ?? null,
    controlId: input.sourceSurface,
  }, input.trace);
  return runWithAthleteActionTrace(trace, async () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: 'canonical_injury_create_or_update',
      sourceSurface: input.sourceSurface,
    });
    const result = await createOrUpdateInjuryEpisodeWithinTrace({ ...input, trace });
    emitAthleteActionEvent(trace, 'mutation_constraint_created', {
      constraintType: 'injury_episode',
      constraintId: result.episodeId,
      constraintStatus: result.outcome.includes('created') || result.outcome.includes('updated')
        ? 'active'
        : result.outcome,
    });
    emitAthleteActionEvent(trace,
      result.outcome === 'conflicted' || result.outcome === 'safely_rejected'
        ? 'athlete_action_failed'
        : 'athlete_action_completed', {
        outcome: result.outcome,
        internalResultCode: `canonical_injury_${result.outcome}`,
      });
    return result;
  });
}

async function createOrUpdateInjuryEpisodeWithinTrace(
  input: CreateOrUpdateInjuryEpisodeInput,
): Promise<InjuryEpisodeMutationResult> {
  const now = input.now ?? new Date().toISOString();
  const anchorDate = (input.todayISO ?? todayISOLocal()).slice(0, 10);
  const ownership = currentOwnership(now);
  const existing = activeEpisodeForConstraint(ownership.context.injuryEpisodes, input.constraint);
  return transactExactInjuryEpisode({
    operation: existing ? 'update' : 'report',
    ...(existing ? { episodeId: existing.episodeId } : {}),
    constraint: input.constraint,
    sourceActor: input.sourceActor,
    sourceSurface: input.sourceSurface,
    note: input.note,
    todayISO: anchorDate,
    occurredAtISO: now,
    expectedAcceptedRevision: input.expectedAcceptedRevision ?? ownership.context.revision,
    testHooks: input.testHooks,
    trace: input.trace,
  } as ExactInjuryEpisodeTransactionInput) as Promise<InjuryEpisodeMutationResult>;
}

export async function updateInjuryEpisode(
  input: UpdateInjuryEpisodeInput,
): Promise<InjuryEpisodeMutationResult> {
  if (!athleteActionDiagnosticsEnabled()) return updateInjuryEpisodeWithinTrace(input);
  const trace = beginAthleteActionTrace({
    source: /coach/i.test(input.sourceSurface)
      ? 'coach'
      : input.sourceActor === 'system' ? 'system' : 'tap',
    actionType: 'injury_change',
    route: `canonical_injury_update:${input.sourceSurface}`,
    sourceDate: (input.todayISO ?? todayISOLocal()).slice(0, 10),
    sessionDate: (input.todayISO ?? todayISOLocal()).slice(0, 10),
    scope: 'canonical_injury_episode',
    injuryEpisodeId: input.episodeId,
    controlId: input.sourceSurface,
  }, input.trace);
  return runWithAthleteActionTrace(trace, () => updateInjuryEpisodeWithinTrace({ ...input, trace }));
}

async function updateInjuryEpisodeWithinTrace(
  input: UpdateInjuryEpisodeInput,
): Promise<InjuryEpisodeMutationResult> {
  const now = input.now ?? new Date().toISOString();
  const context = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  const episode = context.injuryEpisodes.find((candidate) =>
    candidate.episodeId === input.episodeId);
  if (!episode || !activeInjuryEpisodes([episode]).length) {
    return {
      outcome: 'conflicted',
      episodeId: input.episodeId,
      acceptedStateChanged: false,
      visibleProgramChanged: false,
      changedProgram: false,
      message: 'That active injury episode could not be matched.',
      reason: 'injury_episode_not_active',
    };
  }
  const constraint = context.activeConstraints.find((candidate): candidate is ActiveInjuryConstraint =>
    candidate.type === 'injury' && candidate.injuryEpisodeId === input.episodeId);
  if (!constraint) {
    return {
      outcome: 'conflicted',
      episodeId: input.episodeId,
      acceptedStateChanged: false,
      visibleProgramChanged: false,
      changedProgram: false,
      message: 'That active injury episode could not be matched.',
      reason: 'injury_episode_projection_missing',
    };
  }
  return transactExactInjuryEpisode({
    operation: 'update',
    episodeId: input.episodeId,
    constraint: {
      ...constraint,
      severity: input.severity,
      status: input.status,
      priorSeverity: input.severity < episode.severity ? episode.severity : undefined,
      lastUpdatedAt: now,
    },
    sourceActor: input.sourceActor,
    sourceSurface: input.sourceSurface,
    note: input.note,
    todayISO: (input.todayISO ?? todayISOLocal()).slice(0, 10),
    occurredAtISO: now,
    expectedAcceptedRevision: input.expectedAcceptedRevision ?? context.revision,
    testHooks: input.testHooks,
    trace: input.trace,
  }) as Promise<InjuryEpisodeMutationResult>;
}

export async function refreshInjuryEpisode(
  input: RefreshInjuryEpisodeInput,
): Promise<InjuryEpisodeMutationResult> {
  const now = input.now ?? new Date().toISOString();
  const context = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  return transactExactInjuryEpisode({
    operation: 'refresh',
    episodeId: input.episodeId,
    sourceActor: input.sourceActor,
    sourceSurface: input.sourceSurface,
    note: input.note,
    todayISO: (input.todayISO ?? todayISOLocal()).slice(0, 10),
    occurredAtISO: now,
    expectedAcceptedRevision: input.expectedAcceptedRevision ?? context.revision,
    testHooks: input.testHooks,
    trace: input.trace,
  }) as Promise<InjuryEpisodeMutationResult>;
}

export async function resolveInjuryEpisode(
  episodeId: string,
  options: ResolveInjuryEpisodeOptions = {},
): Promise<InjuryEpisodeResolutionResult> {
  if (!athleteActionDiagnosticsEnabled()) return resolveInjuryEpisodeWithinTrace(episodeId, options);
  const sourceSurface = options.sourceSurface ?? 'injury_resolved_action';
  const trace = beginAthleteActionTrace({
    source: /coach/i.test(sourceSurface)
      ? 'coach'
      : options.sourceActor === 'system' ? 'system' : 'tap',
    actionType: 'injury_change',
    route: `canonical_injury_resolve:${sourceSurface}`,
    sourceDate: (options.todayISO ?? todayISOLocal()).slice(0, 10),
    sessionDate: (options.todayISO ?? todayISOLocal()).slice(0, 10),
    scope: 'canonical_injury_episode',
    injuryEpisodeId: episodeId,
    controlId: sourceSurface,
  }, options.trace);
  return runWithAthleteActionTrace(trace, async () => {
    emitAthleteActionEvent(trace, 'athlete_action_parsed', {
      parsedMutationType: 'canonical_injury_resolve',
      injuryEpisodeId: episodeId,
    });
    const result = await resolveInjuryEpisodeWithinTrace(episodeId, { ...options, trace });
    emitAthleteActionEvent(trace, 'mutation_constraint_created', {
      constraintType: 'injury_episode',
      constraintId: episodeId,
      constraintStatus: result.outcome.startsWith('resolved') || result.outcome === 'already_resolved'
        ? 'resolved'
        : result.outcome,
    });
    emitAthleteActionEvent(trace,
      result.outcome === 'conflicted' || result.outcome === 'safely_rejected'
        ? 'athlete_action_failed'
        : 'athlete_action_completed', {
        outcome: result.outcome,
        internalResultCode: `canonical_injury_${result.outcome}`,
      });
    return result;
  });
}

async function resolveInjuryEpisodeWithinTrace(
  episodeId: string,
  options: ResolveInjuryEpisodeOptions,
): Promise<InjuryEpisodeResolutionResult> {
  const now = options.now ?? new Date().toISOString();
  const anchorDate = (options.todayISO ?? todayISOLocal()).slice(0, 10);
  const ownership = currentOwnership(now);
  const episode = ownership.context.injuryEpisodes.find((candidate) =>
    candidate.episodeId === episodeId);
  // Preserve the pre-command compatibility facade's observable target and
  // idempotence ordering. The typed command executor calls the exact
  // transaction directly, where expected revision remains the first check.
  if (!episode) {
    return {
      outcome: 'conflicted',
      episodeId,
      acceptedStateChanged: false,
      visibleProgramChanged: false,
      changedProgram: false,
      message: 'That injury episode could not be matched. No restrictions were changed.',
      reason: 'injury_episode_not_found',
    };
  }
  if (episode.status === 'resolved' || episode.status === 'superseded') {
    return {
      outcome: 'already_resolved',
      episodeId,
      acceptedStateChanged: false,
      visibleProgramChanged: false,
      changedProgram: false,
      message: 'That injury episode is already resolved.',
    };
  }
  if (options.expectedAcceptedRevision !== undefined &&
    options.expectedAcceptedRevision !== ownership.context.revision) {
    return {
      outcome: 'conflicted',
      episodeId,
      acceptedStateChanged: false,
      visibleProgramChanged: false,
      changedProgram: false,
      message: 'The program changed before the injury could be resolved.',
      reason: 'accepted_revision_changed',
    };
  }
  const legacyAfterStateOnly = episode.legacyMigrationStatus === 'legacy_after_state_only';
  const result = await transactExactInjuryEpisode({
    operation: 'resolve',
    episodeId,
    sourceActor: options.sourceActor ?? 'athlete',
    sourceSurface: options.sourceSurface ?? 'injury_resolved_action',
    note: options.note,
    todayISO: anchorDate,
    occurredAtISO: now,
    expectedAcceptedRevision: options.expectedAcceptedRevision ?? ownership.context.revision,
    testHooks: options.testHooks,
    trace: options.trace,
  }) as InjuryEpisodeResolutionResult;
  return legacyAfterStateOnly && result.acceptedStateChanged
    ? {
        ...result,
        message: 'Injury restrictions ended and affected sessions were refreshed.',
      }
    : result;
}
