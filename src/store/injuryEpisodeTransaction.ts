import type { ActiveInjuryConstraint } from './coachUpdatesStore';
import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedCompositionBaseV1,
} from './acceptedStateColdStart';
import {
  assertAcceptedVisibleLedgerEquivalence,
  commitAcceptedStateTransaction,
} from './acceptedStateTransaction';
import { canonicaliseHydratedState, useProgramStore } from './programStore';
import { useProfileStore } from './profileStore';
import {
  runCoachMutationTransaction,
} from './coachMutationTransaction';
import {
  INJURY_EPISODE_PROTOCOL_VERSION,
  activeInjuryEpisodes,
  composeInjuryCompatibility,
  migrateLegacyInjuryEpisodes,
  normalizeInjuryEpisodes,
  type InjuryEpisodeSourceActor,
  type InjuryEpisodeStatus,
  type InjuryEpisodeTransitionV1,
  type InjuryEpisodeV1,
} from '../rules/injuryEpisode';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';

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
  expectedAcceptedRevision?: number;
  /** @internal Deterministic failure-boundary witnesses for transaction tests. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
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
}

export interface ResolveInjuryEpisodeOptions {
  sourceActor?: InjuryEpisodeSourceActor;
  sourceSurface?: string;
  note?: string;
  todayISO?: string;
  expectedAcceptedRevision?: number;
  /** @internal Deterministic failure-boundary witnesses for transaction tests. */
  testHooks?: InjuryEpisodeTransactionTestHooks;
}

interface CanonicalOwnershipSnapshot {
  context: ReturnType<typeof normalizeAcceptedMaterialContext>;
  compositionBase: AcceptedCompositionBaseV1;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
  const state = useProgramStore.getState();
  let context = normalizeAcceptedMaterialContext(state.acceptedMaterialContext);
  let episodes = context.injuryEpisodes;
  if (episodes.length === 0) {
    episodes = migrateLegacyInjuryEpisodes({
      activeConstraints: context.activeConstraints,
      activeInjury: context.activeInjury,
      sourceSurface: 'injury_episode_transaction',
    });
  }
  const surfaces = normalizeAcceptedProgramSurfaces(state);
  const migratedAfterStateOnly = episodes.some((episode) =>
    episode.legacyMigrationStatus === 'legacy_after_state_only');
  const compositionBase = context.acceptedCompositionBase ?? {
    protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
    capturedAt: now,
    updatedAt: now,
    sourceRevision: context.revision,
    provenance: migratedAfterStateOnly
      ? 'legacy_after_state_only' as const
      : 'accepted_pre_injury' as const,
    surfaces: clone(surfaces),
  };
  context = normalizeAcceptedMaterialContext({
    ...context,
    injuryEpisodes: episodes,
    acceptedCompositionBase: compositionBase,
  });
  return { context, compositionBase };
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

function validateEffectiveInjuryComposition(args: {
  base: AcceptedCompositionBaseV1;
  context: ReturnType<typeof normalizeAcceptedMaterialContext>;
  weekStarts: readonly string[];
}): void {
  const profile = useProfileStore.getState().onboardingData;
  const projected = canonicaliseHydratedState(args.base.surfaces, {
    programAlreadyAccepted: true,
    activeConstraints: args.context.activeConstraints,
    profile,
    markedDays: args.context.markedDays,
    validateWeekStarts: args.weekStarts,
  });
  const surfaces = normalizeAcceptedProgramSurfaces(projected);
  assertAcceptedVisibleLedgerEquivalence({
    surfaces,
    context: args.context,
    weekStarts: args.weekStarts,
    profile,
  });
}

async function persistEpisodeSet(args: {
  nextEpisodes: InjuryEpisodeV1[];
  ownership: CanonicalOwnershipSnapshot;
  anchorDate: string;
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
  const currentRevision = args.ownership.context.revision;
  if (args.expectedAcceptedRevision !== undefined &&
    args.expectedAcceptedRevision !== currentRevision) {
    return { ok: false, changedProgram: false, route: 'conflicted', reason: 'accepted_revision_changed' };
  }
  const horizon = acceptedWeeksAndDates(args.anchorDate);
  const compatibility = composeInjuryCompatibility({
    activeConstraints: args.ownership.context.activeConstraints,
    injuryEpisodes: args.nextEpisodes,
  });
  const baseFingerprint = semanticFingerprint(args.ownership.compositionBase.surfaces);
  const ledgerFingerprint = semanticFingerprint(
    args.ownership.compositionBase.surfaces.reversibleAdjustmentLedger,
  );
  const transaction = await runCoachMutationTransaction({
    todayISO: args.anchorDate,
    extraDates: horizon.dates,
    allowAcceptedStateOnlyChange: true,
    mutate: () => {
      args.testHooks?.beforeStage?.();
      const nextContext = normalizeAcceptedMaterialContext({
        ...args.ownership.context,
        activeConstraints: compatibility.activeConstraints,
        activeInjury: compatibility.activeInjury,
        injuryEpisodes: args.nextEpisodes,
        acceptedCompositionBase: args.ownership.compositionBase,
      });
      args.testHooks?.beforeEffectiveValidation?.();
      validateEffectiveInjuryComposition({
        base: args.ownership.compositionBase,
        context: nextContext,
        weekStarts: horizon.weeks,
      });
      return commitAcceptedStateTransaction({
        reason: args.reason,
        activeConstraints: compatibility.activeConstraints,
        activeInjury: compatibility.activeInjury,
        injuryEpisodes: args.nextEpisodes,
        acceptedCompositionBase: args.ownership.compositionBase,
        validateWeekStarts: horizon.weeks,
      });
    },
    didApply: () => true,
    verifyCandidate: () => {
      if (args.testHooks?.verifyCandidate?.() === false) {
        return { ok: false, reason: 'injury_visible_candidate_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      );
      const target = accepted.injuryEpisodes.find((episode) =>
        episode.episodeId === args.targetEpisodeId);
      if (!target) return { ok: false, reason: 'injury_episode_candidate_missing' };
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
        return { ok: false, reason: 'accepted_composition_base_changed_by_injury_fact' };
      }
      if (semanticFingerprint(useProgramStore.getState().reversibleAdjustmentLedger) !==
        ledgerFingerprint) {
        return { ok: false, reason: 'injury_created_reversible_adjustment_record' };
      }
      return { ok: true };
    },
    verifyAfterPersistence: () => {
      if (args.testHooks?.verifyAfterPersistence?.() === false) {
        return { ok: false, reason: 'injury_durable_readback_test_rejection' };
      }
      const accepted = normalizeAcceptedMaterialContext(
        useProgramStore.getState().acceptedMaterialContext,
      );
      const expected = normalizeInjuryEpisodes(args.nextEpisodes);
      if (semanticFingerprint(accepted.injuryEpisodes) !== semanticFingerprint(expected)) {
        return { ok: false, reason: 'injury_episode_durable_readback_mismatch' };
      }
      if (semanticFingerprint(accepted.acceptedCompositionBase?.surfaces ?? null) !== baseFingerprint) {
        return { ok: false, reason: 'accepted_composition_base_durable_readback_mismatch' };
      }
      return { ok: true };
    },
  });
  if (!('route' in transaction)) {
    return { ok: true, changedProgram: transaction.diff.hasProgrammingChange };
  }
  return {
    ok: false,
    changedProgram: false,
    route: transaction.route,
    reason: transaction.reason,
  };
}

export async function createOrUpdateInjuryEpisode(
  input: CreateOrUpdateInjuryEpisodeInput,
): Promise<InjuryEpisodeMutationResult> {
  const now = new Date().toISOString();
  const anchorDate = (input.todayISO ?? todayISO()).slice(0, 10);
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
  });
}

export async function resolveInjuryEpisode(
  episodeId: string,
  options: ResolveInjuryEpisodeOptions = {},
): Promise<InjuryEpisodeResolutionResult> {
  const now = new Date().toISOString();
  const anchorDate = (options.todayISO ?? todayISO()).slice(0, 10);
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
