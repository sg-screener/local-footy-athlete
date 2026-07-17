import type {
  AcceptedInjuryContext,
  AcceptedInjuryContextEpisode,
  InjuryEpisodeIntent,
  InjurySeverity,
} from './coachIntent';
import type { PendingInjuryClarifier } from '../store/pendingCoachClarifierStore';
import {
  resolveInjuryBucket,
  type InjuryBucket,
} from './programAdjustmentEngine';

export interface CoachInjuryMessageInterpretationInputs {
  /** Explicit body part interpreted from the current message, if present. */
  bodyPart?: string | null;
  /** Canonical bucket interpreted from the current message, if already known. */
  bucket?: InjuryBucket | null;
  /** Strict 1..10 rating interpreted from the current message, if present. */
  severity?: InjurySeverity | null;
  /** Exact candidate selected by a prior target-clarification answer. */
  selectedEpisodeId?: string | null;
}

export interface ResolveCoachInjuryTargetInput {
  intent: InjuryEpisodeIntent;
  acceptedInjuryContext: AcceptedInjuryContext;
  pendingInjury?: PendingInjuryClarifier | null;
  currentMessage: CoachInjuryMessageInterpretationInputs;
}

export type CoachInjuryTargetSource =
  | 'intent'
  | 'pending_severity'
  | 'pending_episode_id'
  | 'pending_target_answer'
  | 'explicit_body_part'
  | 'canonical_bucket'
  | 'unique_active_episode';

export interface ResolvedInjuryReportTarget {
  kind: 'resolved_report';
  bodyPart: string | null;
  bucket: InjuryBucket | null;
  severity: InjurySeverity;
  source: 'intent' | 'pending_severity';
}

export interface ExactInjuryEpisodeTarget {
  kind: 'exact_episode';
  episodeId: string;
  episode: AcceptedInjuryContextEpisode;
  operation: 'update' | 'refresh' | 'resolve';
  severity?: InjurySeverity;
  status?: 'active' | 'improving';
  source: Exclude<CoachInjuryTargetSource, 'intent' | 'pending_severity'>;
}

export interface InjurySeverityClarification {
  kind: 'severity_clarification';
  operation: 'report' | 'update';
  bodyPart: string;
  episodeId?: string;
  change?: 'improving' | 'worsening';
}

export interface InjuryTargetClarification {
  kind: 'target_clarification';
  operation: 'update' | 'refresh' | 'resolve';
  candidateEpisodeIds: string[];
  candidateLabels: string[];
  severity?: InjurySeverity;
  status?: 'active' | 'improving';
}

export interface InjuryTargetNoMatch {
  kind: 'no_match';
  reason:
    | 'no_active_episodes'
    | 'explicit_body_part_unmatched'
    | 'pending_episode_unavailable'
    | 'pending_candidates_unavailable';
}

export type CoachInjuryTargetResolutionWithoutSuperseded =
  | ResolvedInjuryReportTarget
  | ExactInjuryEpisodeTarget
  | InjurySeverityClarification
  | InjuryTargetClarification
  | InjuryTargetNoMatch;

export interface SupersededPendingInjuryTarget {
  kind: 'superseded_pending';
  reason: 'new_report' | 'explicit_different_body_part';
  superseded: PendingInjuryClarifier;
  next: CoachInjuryTargetResolutionWithoutSuperseded;
}

export type CoachInjuryTargetResolution =
  | CoachInjuryTargetResolutionWithoutSuperseded
  | SupersededPendingInjuryTarget;

interface CurrentInterpretation {
  bodyPart: string | null;
  bucket: InjuryBucket | null;
  severity: InjurySeverity | null;
  selectedEpisodeId: string | null;
}

function isSeverity(value: unknown): value is InjurySeverity {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

function normalizeBodyPart(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function currentInterpretation(
  intent: InjuryEpisodeIntent,
  current: CoachInjuryMessageInterpretationInputs,
): CurrentInterpretation {
  const currentBodyPart = typeof current.bodyPart === 'string' && current.bodyPart.trim()
    ? current.bodyPart
    : null;
  const payloadBodyPart = typeof intent.payload.bodyPart === 'string' && intent.payload.bodyPart.trim()
    ? intent.payload.bodyPart
    : null;
  const bodyPart = currentBodyPart ?? payloadBodyPart;
  const severity = isSeverity(current.severity)
    ? current.severity
    : isSeverity(intent.payload.severity)
      ? intent.payload.severity
      : null;
  const interpretedBucket = current.bucket ?? (bodyPart ? resolveInjuryBucket(bodyPart) : null);
  return {
    bodyPart,
    bucket: interpretedBucket,
    severity,
    selectedEpisodeId: typeof current.selectedEpisodeId === 'string' &&
      current.selectedEpisodeId.trim()
      ? current.selectedEpisodeId
      : null,
  };
}

function stableEpisodes(context: AcceptedInjuryContext): AcceptedInjuryContextEpisode[] {
  return [...context.activeEpisodes].sort((left, right) =>
    left.onsetOrReportedDate.localeCompare(right.onsetOrReportedDate) ||
    left.episodeId.localeCompare(right.episodeId));
}

function pendingIsTarget(
  pending: PendingInjuryClarifier,
): pending is Extract<PendingInjuryClarifier, { candidateEpisodeIds: string[] }> {
  return 'candidateEpisodeIds' in pending;
}

function pendingIsExistingSeverity(
  pending: PendingInjuryClarifier,
): pending is Extract<PendingInjuryClarifier, { episodeId: string }> {
  return 'episodeId' in pending;
}

function bodyPartsEquivalent(left: string, right: string): boolean {
  if (normalizeBodyPart(left) === normalizeBodyPart(right)) return true;
  const leftBucket = resolveInjuryBucket(left);
  return leftBucket !== null && leftBucket === resolveInjuryBucket(right);
}

function operationForIntent(intent: InjuryEpisodeIntent): 'update' | 'refresh' | 'resolve' {
  if (intent.intent !== 'active_injury_followup') return 'update';
  if (intent.payload.followupKind === 'resolved') return 'resolve';
  if (intent.payload.followupKind === 'unchanged') return 'refresh';
  return 'update';
}

function statusForIntent(
  intent: InjuryEpisodeIntent,
): 'active' | 'improving' | undefined {
  if (intent.intent !== 'active_injury_followup') return undefined;
  if (intent.payload.followupKind === 'improving') return 'improving';
  if (intent.payload.followupKind === 'worsening') return 'active';
  return undefined;
}

function changeForIntent(
  intent: InjuryEpisodeIntent,
): 'improving' | 'worsening' | undefined {
  if (intent.intent !== 'active_injury_followup') return undefined;
  const change = intent.payload.followupKind;
  return change === 'improving' || change === 'worsening' ? change : undefined;
}

function requiresSeverity(intent: InjuryEpisodeIntent): boolean {
  if (intent.intent === 'injury_severity_reply') return true;
  const change = changeForIntent(intent);
  return change === 'improving' || change === 'worsening';
}

function reportResolution(
  interpretation: CurrentInterpretation,
  source: ResolvedInjuryReportTarget['source'],
  fallbackBodyPart?: string,
): ResolvedInjuryReportTarget | InjurySeverityClarification {
  const bodyPart = interpretation.bodyPart ?? fallbackBodyPart ?? null;
  if (interpretation.severity === null) {
    return {
      kind: 'severity_clarification',
      operation: 'report',
      bodyPart: bodyPart ?? 'unknown',
    };
  }
  return {
    kind: 'resolved_report',
    bodyPart,
    bucket: interpretation.bucket ?? (bodyPart ? resolveInjuryBucket(bodyPart) : null),
    severity: interpretation.severity,
    source,
  };
}

function exactEpisodeResolution(args: {
  intent: InjuryEpisodeIntent;
  interpretation: CurrentInterpretation;
  episode: AcceptedInjuryContextEpisode;
  source: ExactInjuryEpisodeTarget['source'];
  operation?: ExactInjuryEpisodeTarget['operation'];
  severity?: InjurySeverity;
  status?: 'active' | 'improving';
}): ExactInjuryEpisodeTarget | InjurySeverityClarification {
  const severity = args.severity ?? args.interpretation.severity ?? undefined;
  const status = args.status ?? statusForIntent(args.intent);
  if (requiresSeverity(args.intent) && severity === undefined) {
    return {
      kind: 'severity_clarification',
      operation: 'update',
      episodeId: args.episode.episodeId,
      bodyPart: args.episode.bodyPart,
      change: changeForIntent(args.intent),
    };
  }
  return {
    kind: 'exact_episode',
    episodeId: args.episode.episodeId,
    episode: args.episode,
    operation: args.operation ?? operationForIntent(args.intent),
    ...(severity === undefined ? {} : { severity }),
    ...(status === undefined ? {} : { status }),
    source: args.source,
  };
}

function labelsForCandidates(
  candidates: AcceptedInjuryContextEpisode[],
): string[] {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = normalizeBodyPart(candidate.bodyPart);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return candidates.map((candidate) =>
    (counts.get(normalizeBodyPart(candidate.bodyPart)) ?? 0) > 1
      ? `${candidate.bodyPart} (${candidate.onsetOrReportedDate})`
      : candidate.bodyPart);
}

function targetClarification(
  intent: InjuryEpisodeIntent,
  interpretation: CurrentInterpretation,
  candidates: AcceptedInjuryContextEpisode[],
  overrides?: Pick<InjuryTargetClarification, 'operation' | 'severity' | 'status'>,
): InjuryTargetClarification {
  const severity = overrides?.severity ?? interpretation.severity ?? undefined;
  const status = overrides?.status ?? statusForIntent(intent);
  return {
    kind: 'target_clarification',
    operation: overrides?.operation ?? operationForIntent(intent),
    candidateEpisodeIds: candidates.map((candidate) => candidate.episodeId),
    candidateLabels: labelsForCandidates(candidates),
    ...(severity === undefined ? {} : { severity }),
    ...(status === undefined ? {} : { status }),
  };
}

function pendingTargetClarification(
  intent: InjuryEpisodeIntent,
  interpretation: CurrentInterpretation,
  candidates: AcceptedInjuryContextEpisode[],
  pending: Extract<PendingInjuryClarifier, { candidateEpisodeIds: string[] }>,
): InjuryTargetClarification {
  const fallbackLabels = labelsForCandidates(candidates);
  const storedLabels = new Map(pending.candidateEpisodeIds.map((episodeId, index) =>
    [episodeId, pending.candidateLabels[index]] as const));
  const severity = pending.severity ?? interpretation.severity ?? undefined;
  const status = pending.status ?? statusForIntent(intent);
  return {
    kind: 'target_clarification',
    operation: pending.operation,
    candidateEpisodeIds: candidates.map((candidate) => candidate.episodeId),
    candidateLabels: candidates.map((candidate, index) =>
      storedLabels.get(candidate.episodeId) ?? fallbackLabels[index]),
    ...(severity === undefined ? {} : { severity }),
    ...(status === undefined ? {} : { status }),
  };
}

function exactBodyPartMatches(
  episodes: AcceptedInjuryContextEpisode[],
  bodyPart: string,
): AcceptedInjuryContextEpisode[] {
  const normalized = normalizeBodyPart(bodyPart);
  return episodes.filter((episode) => normalizeBodyPart(episode.bodyPart) === normalized);
}

function bucketMatches(
  episodes: AcceptedInjuryContextEpisode[],
  bucket: InjuryBucket | null,
): AcceptedInjuryContextEpisode[] {
  return bucket === null ? [] : episodes.filter((episode) => episode.bucket === bucket);
}

function resolveFromCandidates(args: {
  intent: InjuryEpisodeIntent;
  interpretation: CurrentInterpretation;
  candidates: AcceptedInjuryContextEpisode[];
  source: ExactInjuryEpisodeTarget['source'];
}): ExactInjuryEpisodeTarget | InjurySeverityClarification | InjuryTargetClarification {
  if (args.candidates.length === 1) {
    return exactEpisodeResolution({
      intent: args.intent,
      interpretation: args.interpretation,
      episode: args.candidates[0],
      source: args.source,
    });
  }
  return targetClarification(args.intent, args.interpretation, args.candidates);
}

function resolveWithoutPending(
  intent: InjuryEpisodeIntent,
  acceptedInjuryContext: AcceptedInjuryContext,
  interpretation: CurrentInterpretation,
): CoachInjuryTargetResolutionWithoutSuperseded {
  // Classification owns report-vs-update. A report never collapses into a
  // similar active episode.
  if (intent.intent === 'new_injury_report') {
    return reportResolution(interpretation, 'intent');
  }

  const episodes = stableEpisodes(acceptedInjuryContext);
  if (interpretation.bodyPart) {
    const exact = exactBodyPartMatches(episodes, interpretation.bodyPart);
    if (exact.length > 0) {
      return resolveFromCandidates({
        intent,
        interpretation,
        candidates: exact,
        source: 'explicit_body_part',
      });
    }

    const byBucket = bucketMatches(episodes, interpretation.bucket);
    if (byBucket.length > 0) {
      return resolveFromCandidates({
        intent,
        interpretation,
        candidates: byBucket,
        source: 'canonical_bucket',
      });
    }
    return { kind: 'no_match', reason: 'explicit_body_part_unmatched' };
  }

  if (episodes.length === 0) return { kind: 'no_match', reason: 'no_active_episodes' };
  if (episodes.length === 1) {
    return exactEpisodeResolution({
      intent,
      interpretation,
      episode: episodes[0],
      source: 'unique_active_episode',
    });
  }
  return targetClarification(intent, interpretation, episodes);
}

function supersededPending(args: {
  intent: InjuryEpisodeIntent;
  acceptedInjuryContext: AcceptedInjuryContext;
  pending: PendingInjuryClarifier;
  interpretation: CurrentInterpretation;
  reason: SupersededPendingInjuryTarget['reason'];
}): SupersededPendingInjuryTarget {
  return {
    kind: 'superseded_pending',
    reason: args.reason,
    superseded: args.pending,
    next: resolveWithoutPending(args.intent, args.acceptedInjuryContext, args.interpretation),
  };
}

function resolvePending(args: {
  intent: InjuryEpisodeIntent;
  acceptedInjuryContext: AcceptedInjuryContext;
  pending: PendingInjuryClarifier;
  interpretation: CurrentInterpretation;
}): CoachInjuryTargetResolution {
  const episodes = stableEpisodes(args.acceptedInjuryContext);
  const { pending, intent, interpretation } = args;

  if (intent.intent === 'new_injury_report' && pending.operation !== 'report') {
    return supersededPending({ ...args, reason: 'new_report' });
  }

  if (pendingIsTarget(pending)) {
    const candidateSet = new Set(pending.candidateEpisodeIds);
    const candidates = episodes.filter((episode) => candidateSet.has(episode.episodeId));
    if (interpretation.selectedEpisodeId) {
      const selected = candidates.find((episode) =>
        episode.episodeId === interpretation.selectedEpisodeId);
      if (selected) {
        return exactEpisodeResolution({
          intent,
          interpretation,
          episode: selected,
          operation: pending.operation,
          severity: pending.severity,
          status: pending.status,
          source: 'pending_target_answer',
        });
      }
    }

    if (interpretation.bodyPart) {
      const exact = exactBodyPartMatches(candidates, interpretation.bodyPart);
      const matching = exact.length > 0
        ? exact
        : bucketMatches(candidates, interpretation.bucket);
      if (matching.length === 1) {
        return exactEpisodeResolution({
          intent,
          interpretation,
          episode: matching[0],
          operation: pending.operation,
          severity: pending.severity,
          status: pending.status,
          source: 'pending_target_answer',
        });
      }
      if (matching.length > 1) {
        return pendingTargetClarification(intent, interpretation, matching, pending);
      }
      return supersededPending({
        ...args,
        reason: intent.intent === 'new_injury_report'
          ? 'new_report'
          : 'explicit_different_body_part',
      });
    }

    if (candidates.length === 0) {
      return { kind: 'no_match', reason: 'pending_candidates_unavailable' };
    }
    if (candidates.length === 1) {
      return exactEpisodeResolution({
        intent,
        interpretation,
        episode: candidates[0],
        operation: pending.operation,
        severity: pending.severity,
        status: pending.status,
        source: 'pending_episode_id',
      });
    }
    return pendingTargetClarification(intent, interpretation, candidates, pending);
  }

  if (pendingIsExistingSeverity(pending)) {
    if (intent.intent === 'new_injury_report') {
      return supersededPending({ ...args, reason: 'new_report' });
    }
    if (interpretation.bodyPart &&
      !bodyPartsEquivalent(interpretation.bodyPart, pending.bodyPart)) {
      return supersededPending({ ...args, reason: 'explicit_different_body_part' });
    }
    const episode = episodes.find((candidate) => candidate.episodeId === pending.episodeId);
    if (!episode) return { kind: 'no_match', reason: 'pending_episode_unavailable' };
    if (interpretation.severity === null) {
      return {
        kind: 'severity_clarification',
        operation: 'update',
        episodeId: episode.episodeId,
        bodyPart: episode.bodyPart,
        change: pending.change,
      };
    }
    return {
      kind: 'exact_episode',
      episodeId: episode.episodeId,
      episode,
      operation: 'update',
      severity: interpretation.severity,
      status: pending.change === 'improving' ? 'improving' : 'active',
      source: 'pending_episode_id',
    };
  }

  if (interpretation.bodyPart &&
    !bodyPartsEquivalent(interpretation.bodyPart, pending.bodyPart)) {
    return supersededPending({
      ...args,
      reason: intent.intent === 'new_injury_report'
        ? 'new_report'
        : 'explicit_different_body_part',
    });
  }
  return reportResolution(interpretation, 'pending_severity', pending.bodyPart);
}

/**
 * Resolve an injury report/update target without reading stores or performing
 * any mutation. The caller supplies one canonical accepted snapshot and the
 * already-interpreted facts from the current message.
 */
export function resolveCoachInjuryTarget(
  input: ResolveCoachInjuryTargetInput,
): CoachInjuryTargetResolution {
  const interpretation = currentInterpretation(input.intent, input.currentMessage);
  if (input.pendingInjury) {
    return resolvePending({
      intent: input.intent,
      acceptedInjuryContext: input.acceptedInjuryContext,
      pending: input.pendingInjury,
      interpretation,
    });
  }
  return resolveWithoutPending(input.intent, input.acceptedInjuryContext, interpretation);
}

export const resolveCoachInjuryEpisodeTarget = resolveCoachInjuryTarget;
