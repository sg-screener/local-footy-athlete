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
  changedProgram: boolean;
  message: string;
  reason?: string;
}

export interface InjuryEpisodeResolutionResult {
  outcome: InjuryEpisodeResolutionOutcome;
  episodeId: string;
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
  expectedAcceptedRevision?: number;
  trace?: AthleteActionTraceContext;
}

export interface ResolveInjuryEpisodeOptions {
  sourceActor?: InjuryEpisodeSourceActor;
  sourceSurface?: string;
  note?: string;
  todayISO?: string;
  expectedAcceptedRevision?: number;
  /** @internal Deterministic failure-boundary witnesses for transaction tests. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
  trace?: AthleteActionTraceContext;
}

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
}): Promise<{
  ok: boolean;
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
  if (input.expectedAcceptedRevision !== undefined &&
    input.expectedAcceptedRevision !== ownership.context.revision) {
    return {
      outcome: 'conflicted',
      episodeId: null,
      changedProgram: false,
      message: 'The program changed before the injury update could be applied.',
      reason: 'accepted_revision_changed',
    };
  }
  const existing = activeEpisodeForConstraint(ownership.context.injuryEpisodes, input.constraint);
  const horizon = acceptedWeeksAndDates(anchorDate);
  const episode = episodeFromConstraint({
    constraint: input.constraint,
    existing,
    sourceActor: input.sourceActor,
    sourceSurface: input.sourceSurface,
    note: input.note,
    now,
    anchorDate,
    affectedDates: horizon.dates,
    affectedWeeks: horizon.weeks,
  });
  const nextEpisodes = existing
    ? ownership.context.injuryEpisodes.map((candidate) =>
        candidate.episodeId === existing.episodeId ? episode : candidate)
    : [...ownership.context.injuryEpisodes, episode];
  const persisted = await persistEpisodeSet({
    nextEpisodes,
    ownership,
    anchorDate,
    now,
    reason: existing ? 'injury_episode:update' : 'injury_episode:create',
    expectedAcceptedRevision: input.expectedAcceptedRevision,
    targetEpisodeId: episode.episodeId,
    testHooks: input.testHooks,
  });
  if (!persisted.ok) {
    return {
      outcome: persisted.route === 'conflicted' ? 'conflicted' : 'safely_rejected',
      episodeId: episode.episodeId,
      changedProgram: false,
      message: persisted.route === 'conflicted'
        ? 'The program changed before the injury update could be applied.'
        : 'The injury update was not applied because the accepted program could not be verified.',
      reason: persisted.reason,
    };
  }
  const prefix = existing ? 'updated' : 'created';
  return {
    outcome: persisted.changedProgram
      ? `${prefix}_and_recomposed` as InjuryEpisodeMutationOutcome
      : `${prefix}_no_program_change` as InjuryEpisodeMutationOutcome,
    episodeId: episode.episodeId,
    changedProgram: persisted.changedProgram,
    message: persisted.changedProgram
      ? 'Injury restrictions are active and affected sessions were safely recomposed.'
      : 'Injury restrictions are active. No affected session needed changing.',
  };
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
  const context = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  const episode = context.injuryEpisodes.find((candidate) =>
    candidate.episodeId === input.episodeId);
  if (!episode || !activeInjuryEpisodes([episode]).length) {
    return {
      outcome: 'conflicted',
      episodeId: input.episodeId,
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
      changedProgram: false,
      message: 'That active injury episode could not be matched.',
      reason: 'injury_episode_projection_missing',
    };
  }
  return createOrUpdateInjuryEpisode({
    constraint: {
      ...constraint,
      severity: input.severity,
      status: input.status,
      priorSeverity: input.severity < episode.severity ? episode.severity : undefined,
      lastUpdatedAt: new Date().toISOString(),
    },
    sourceActor: input.sourceActor,
    sourceSurface: input.sourceSurface,
    note: input.note,
    todayISO: input.todayISO,
    expectedAcceptedRevision: input.expectedAcceptedRevision,
    trace: input.trace,
  });
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
  const now = new Date().toISOString();
  const anchorDate = (options.todayISO ?? todayISOLocal()).slice(0, 10);
  const ownership = currentOwnership(now);
  const episode = ownership.context.injuryEpisodes.find((candidate) =>
    candidate.episodeId === episodeId);
  if (!episode) {
    return {
      outcome: 'conflicted',
      episodeId,
      changedProgram: false,
      message: 'That injury episode could not be matched. No restrictions were changed.',
      reason: 'injury_episode_not_found',
    };
  }
  if (episode.status === 'resolved' || episode.status === 'superseded') {
    return {
      outcome: 'already_resolved',
      episodeId,
      changedProgram: false,
      message: 'That injury episode is already resolved.',
    };
  }
  if (options.expectedAcceptedRevision !== undefined &&
    options.expectedAcceptedRevision !== ownership.context.revision) {
    return {
      outcome: 'conflicted',
      episodeId,
      changedProgram: false,
      message: 'The program changed before the injury could be resolved.',
      reason: 'accepted_revision_changed',
    };
  }
  const resolved: InjuryEpisodeV1 = {
    ...episode,
    severity: 0,
    status: 'resolved',
    updatedAt: now,
    resolvedAt: now,
    transitionHistory: [
      ...episode.transitionHistory,
      transition({
        now,
        fromStatus: episode.status,
        toStatus: 'resolved',
        severity: 0,
        note: options.note,
        sourceActor: options.sourceActor ?? 'athlete',
        sourceSurface: options.sourceSurface ?? 'injury_resolved_action',
      }),
    ],
    sourceActor: options.sourceActor ?? 'athlete',
    sourceSurface: options.sourceSurface ?? 'injury_resolved_action',
    currentRestrictionPolicy: {
      ...episode.currentRestrictionPolicy,
      rules: [],
      safeFocus: [],
      advice: [],
      priorSeverity: episode.severity,
    },
  };
  const nextEpisodes = ownership.context.injuryEpisodes.map((candidate) =>
    candidate.episodeId === episodeId ? resolved : candidate);
  const persisted = await persistEpisodeSet({
    nextEpisodes,
    ownership,
    anchorDate,
    now,
    reason: 'injury_episode:resolve',
    expectedAcceptedRevision: options.expectedAcceptedRevision,
    targetEpisodeId: episodeId,
    testHooks: options.testHooks,
  });
  if (!persisted.ok) {
    return {
      outcome: persisted.route === 'conflicted' ? 'conflicted' : 'safely_rejected',
      episodeId,
      changedProgram: false,
      message: persisted.route === 'conflicted'
        ? 'The program changed before the injury could be resolved.'
        : 'The injury restrictions were not changed because the recomposed program could not be verified.',
      reason: persisted.reason,
    };
  }
  if (episode.legacyMigrationStatus === 'legacy_after_state_only') {
    return {
      outcome: persisted.changedProgram
        ? 'resolved_and_recomposed'
        : 'resolved_no_program_change',
      episodeId,
      changedProgram: persisted.changedProgram,
      message: 'Injury restrictions ended and affected sessions were refreshed.',
    };
  }
  return {
    outcome: persisted.changedProgram
      ? 'resolved_and_recomposed'
      : 'resolved_no_program_change',
    episodeId,
    changedProgram: persisted.changedProgram,
    message: persisted.changedProgram
      ? 'Injury resolved. Affected sessions were safely recomposed.'
      : 'Injury resolved. No affected session needed changing.',
  };
}
