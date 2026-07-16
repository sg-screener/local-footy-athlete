import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import type {
  InjuryHistoryEntry,
  InjuryState,
} from '../utils/injuryProgression';

export const INJURY_EPISODE_PROTOCOL_VERSION = 1 as const;

export type InjuryEpisodeStatus = 'active' | 'improving' | 'resolved' | 'superseded';
export type InjuryEpisodeMigrationStatus = 'native_v1' | 'legacy_after_state_only';
export type InjuryEpisodeSourceActor = 'athlete' | 'coach' | 'system' | 'migration';

export interface InjuryRestrictionPolicyV1 {
  rules: string[];
  safeFocus: string[];
  advice: string[];
  severityBand?: ActiveInjuryConstraint['severityBand'];
  adjustmentLevel?: ActiveInjuryConstraint['adjustmentLevel'];
  priorSeverity?: number;
}

export interface InjuryEpisodeTransitionV1 {
  timestamp: string;
  fromStatus: InjuryEpisodeStatus | 'new';
  toStatus: InjuryEpisodeStatus;
  severity: number;
  note: string;
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
}

export interface InjuryEpisodeV1 {
  protocolVersion: typeof INJURY_EPISODE_PROTOCOL_VERSION;
  episodeId: string;
  bodyPart: string;
  region?: ActiveInjuryConstraint['region'];
  bucket: InjuryState['bucket'];
  severity: number;
  status: InjuryEpisodeStatus;
  onsetOrReportedDate: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  triggers: string[];
  seriousSymptoms: boolean;
  seriousSymptom?: string;
  transitionHistory: InjuryEpisodeTransitionV1[];
  sourceActor: InjuryEpisodeSourceActor;
  sourceSurface: string;
  affectedDates: string[];
  affectedWeeks: string[];
  currentRestrictionPolicy: InjuryRestrictionPolicyV1;
  legacyMigrationStatus: InjuryEpisodeMigrationStatus;
  compatibility: {
    constraintId: string;
    activeInjuryId?: string;
    coachUpdateIds?: string[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string')))
    : [];
}

function clampSeverity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(10, Math.round(value)))
    : 0;
}

function isoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value;
}

function stablePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function episodeStatus(value: unknown): InjuryEpisodeStatus {
  return value === 'improving' || value === 'resolved' || value === 'superseded'
    ? value
    : 'active';
}

export function normalizeInjuryEpisode(value: unknown): InjuryEpisodeV1 | null {
  if (!isRecord(value) || value.protocolVersion !== INJURY_EPISODE_PROTOCOL_VERSION) return null;
  if (typeof value.episodeId !== 'string' || !value.episodeId.trim()) return null;
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString();
  const status = episodeStatus(value.status);
  const policy = isRecord(value.currentRestrictionPolicy)
    ? value.currentRestrictionPolicy
    : {};
  const compatibility = isRecord(value.compatibility) ? value.compatibility : {};
  const history = Array.isArray(value.transitionHistory)
    ? value.transitionHistory.flatMap((entry): InjuryEpisodeTransitionV1[] => {
        if (!isRecord(entry) || typeof entry.timestamp !== 'string') return [];
        const fromStatus = entry.fromStatus === 'new'
          ? 'new'
          : episodeStatus(entry.fromStatus);
        return [{
          timestamp: entry.timestamp,
          fromStatus,
          toStatus: episodeStatus(entry.toStatus),
          severity: clampSeverity(entry.severity),
          note: typeof entry.note === 'string' ? entry.note : '',
          sourceActor: entry.sourceActor === 'coach' || entry.sourceActor === 'system' ||
            entry.sourceActor === 'migration' ? entry.sourceActor : 'athlete',
          sourceSurface: typeof entry.sourceSurface === 'string'
            ? entry.sourceSurface
            : 'unknown',
        }];
      })
    : [];
  return {
    protocolVersion: INJURY_EPISODE_PROTOCOL_VERSION,
    episodeId: value.episodeId,
    bodyPart: typeof value.bodyPart === 'string' ? value.bodyPart : 'unknown',
    region: value.region as InjuryEpisodeV1['region'],
    bucket: (typeof value.bucket === 'string' ? value.bucket : null) as InjuryState['bucket'],
    severity: clampSeverity(value.severity),
    status,
    onsetOrReportedDate: typeof value.onsetOrReportedDate === 'string'
      ? isoDate(value.onsetOrReportedDate)
      : isoDate(createdAt),
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
    resolvedAt: status === 'resolved' && typeof value.resolvedAt === 'string'
      ? value.resolvedAt
      : null,
    triggers: strings(value.triggers),
    seriousSymptoms: value.seriousSymptoms === true,
    seriousSymptom: typeof value.seriousSymptom === 'string' ? value.seriousSymptom : undefined,
    transitionHistory: history,
    sourceActor: value.sourceActor === 'coach' || value.sourceActor === 'system' ||
      value.sourceActor === 'migration' ? value.sourceActor : 'athlete',
    sourceSurface: typeof value.sourceSurface === 'string' ? value.sourceSurface : 'unknown',
    affectedDates: strings(value.affectedDates).sort(),
    affectedWeeks: strings(value.affectedWeeks).sort(),
    currentRestrictionPolicy: {
      rules: strings(policy.rules),
      safeFocus: strings(policy.safeFocus),
      advice: strings(policy.advice),
      severityBand: policy.severityBand as InjuryRestrictionPolicyV1['severityBand'],
      adjustmentLevel: policy.adjustmentLevel as InjuryRestrictionPolicyV1['adjustmentLevel'],
      priorSeverity: typeof policy.priorSeverity === 'number'
        ? policy.priorSeverity
        : undefined,
    },
    legacyMigrationStatus: value.legacyMigrationStatus === 'legacy_after_state_only'
      ? 'legacy_after_state_only'
      : 'native_v1',
    compatibility: {
      constraintId: typeof compatibility.constraintId === 'string'
        ? compatibility.constraintId
        : `injury-${stablePart(String(value.bucket ?? value.bodyPart ?? 'unknown'))}`,
      activeInjuryId: typeof compatibility.activeInjuryId === 'string'
        ? compatibility.activeInjuryId
        : undefined,
      coachUpdateIds: strings(compatibility.coachUpdateIds),
    },
  };
}

export function normalizeInjuryEpisodes(value: unknown): InjuryEpisodeV1[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, InjuryEpisodeV1>();
  for (const candidate of value) {
    const episode = normalizeInjuryEpisode(candidate);
    if (episode) byId.set(episode.episodeId, episode);
  }
  return Array.from(byId.values()).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.episodeId.localeCompare(right.episodeId));
}

export function injuryEpisodeIsActive(episode: InjuryEpisodeV1): boolean {
  return episode.status === 'active' || episode.status === 'improving';
}

export function activeInjuryEpisodes(episodes: readonly InjuryEpisodeV1[]): InjuryEpisodeV1[] {
  return episodes.filter(injuryEpisodeIsActive);
}

export function deriveInjuryConstraintFromEpisode(
  episode: InjuryEpisodeV1,
): ActiveInjuryConstraint | null {
  if (!injuryEpisodeIsActive(episode)) return null;
  return {
    id: episode.compatibility.constraintId,
    type: 'injury',
    injuryEpisodeId: episode.episodeId,
    bodyPart: episode.bodyPart,
    region: episode.region,
    bucket: episode.bucket,
    severity: episode.severity,
    priorSeverity: episode.currentRestrictionPolicy.priorSeverity,
    status: episode.status === 'improving' ? 'improving' : 'active',
    startDate: episode.onsetOrReportedDate,
    lastUpdatedAt: episode.updatedAt,
    source: episode.sourceSurface === 'guided_injury_flow' ? 'guided_injury_flow' : 'coach',
    triggers: [...episode.triggers],
    seriousSymptoms: episode.seriousSymptoms,
    seriousSymptom: episode.seriousSymptom,
    rules: [...episode.currentRestrictionPolicy.rules],
    safeFocus: [...episode.currentRestrictionPolicy.safeFocus],
    advice: [...episode.currentRestrictionPolicy.advice],
    severityBand: episode.currentRestrictionPolicy.severityBand,
    adjustmentLevel: episode.currentRestrictionPolicy.adjustmentLevel,
    modifierAffects: ['current_week', 'future_generation'],
    presentationOnlyDismiss: true,
  };
}

export function deriveInjuryConstraintsFromEpisodes(
  episodes: readonly InjuryEpisodeV1[],
): ActiveInjuryConstraint[] {
  return episodes.flatMap((episode) => {
    const constraint = deriveInjuryConstraintFromEpisode(episode);
    return constraint ? [constraint] : [];
  });
}

export function deriveLegacyInjuryFromEpisodes(
  episodes: readonly InjuryEpisodeV1[],
): InjuryState | null {
  const episode = activeInjuryEpisodes(episodes)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (!episode) return null;
  const history: InjuryHistoryEntry[] = episode.transitionHistory.map((entry) => ({
    timestamp: entry.timestamp,
    fromStatus: entry.fromStatus === 'superseded' ? 'resolved' : entry.fromStatus,
    toStatus: entry.toStatus === 'superseded' ? 'resolved' : entry.toStatus,
    severity: entry.severity,
    note: entry.note,
  }));
  return {
    bodyPart: episode.bodyPart,
    bucket: episode.bucket,
    severity: episode.severity,
    initialSeverity: history[0]?.severity ?? episode.severity,
    priorSeverity: episode.currentRestrictionPolicy.priorSeverity,
    status: episode.status === 'improving' ? 'improving' : 'active',
    rules: [...episode.currentRestrictionPolicy.rules],
    seriousSymptoms: episode.seriousSymptoms,
    seriousSymptom: episode.seriousSymptom,
    adjustmentLevel: episode.currentRestrictionPolicy.adjustmentLevel,
    safeFocus: [...episode.currentRestrictionPolicy.safeFocus],
    advice: [...episode.currentRestrictionPolicy.advice],
    startDate: episode.onsetOrReportedDate,
    createdAt: episode.createdAt,
    lastUpdatedAt: episode.updatedAt,
    history,
  };
}

function legacyEpisodeId(constraintId: string): string {
  return `injury-episode:legacy:${stablePart(constraintId || 'unknown')}`;
}

function legacyConstraintFromAlias(injury: InjuryState): ActiveInjuryConstraint {
  const constraintId = `injury-${stablePart(injury.bucket || injury.bodyPart || 'unknown')}`;
  return {
    id: constraintId,
    type: 'injury',
    bodyPart: injury.bodyPart,
    bucket: injury.bucket,
    severity: injury.severity,
    priorSeverity: injury.priorSeverity,
    status: injury.status,
    startDate: injury.startDate,
    lastUpdatedAt: injury.lastUpdatedAt,
    seriousSymptoms: injury.seriousSymptoms,
    seriousSymptom: injury.seriousSymptom,
    adjustmentLevel: injury.adjustmentLevel,
    rules: [...(injury.rules ?? [])],
    safeFocus: [...(injury.safeFocus ?? [])],
    advice: [...(injury.advice ?? [])],
  };
}

export function migrateLegacyInjuryEpisodes(args: {
  activeConstraints: readonly ActiveConstraint[];
  activeInjury: InjuryState | null;
  existingEpisodes?: readonly InjuryEpisodeV1[];
  sourceSurface?: string;
}): InjuryEpisodeV1[] {
  if ((args.existingEpisodes?.length ?? 0) > 0) {
    return normalizeInjuryEpisodes(args.existingEpisodes);
  }
  const injuryConstraints = args.activeConstraints.filter(
    (constraint): constraint is ActiveInjuryConstraint =>
      constraint.type === 'injury' && constraint.status !== 'resolved',
  );
  if (injuryConstraints.length === 0 && args.activeInjury?.status !== 'resolved') {
    if (args.activeInjury) injuryConstraints.push(legacyConstraintFromAlias(args.activeInjury));
  }
  return injuryConstraints.map((constraint) => {
    const matchingAlias = args.activeInjury && (
      args.activeInjury.bucket === constraint.bucket ||
      args.activeInjury.bodyPart.toLowerCase() === constraint.bodyPart.toLowerCase()
    ) ? args.activeInjury : null;
    const createdAt = matchingAlias?.createdAt ?? constraint.lastUpdatedAt ?? constraint.startDate;
    const history: InjuryEpisodeTransitionV1[] = (matchingAlias?.history ?? []).map((entry) => ({
      timestamp: entry.timestamp,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      severity: entry.severity,
      note: entry.note,
      sourceActor: 'migration',
      sourceSurface: args.sourceSurface ?? 'legacy_hydration',
    }));
    if (history.length === 0) {
      history.push({
        timestamp: createdAt,
        fromStatus: 'new',
        toStatus: constraint.status,
        severity: constraint.severity,
        note: 'Migrated from the legacy active injury state.',
        sourceActor: 'migration',
        sourceSurface: args.sourceSurface ?? 'legacy_hydration',
      });
    }
    return {
      protocolVersion: INJURY_EPISODE_PROTOCOL_VERSION,
      episodeId: constraint.injuryEpisodeId ?? legacyEpisodeId(constraint.id),
      bodyPart: constraint.bodyPart,
      region: constraint.region,
      bucket: constraint.bucket,
      severity: constraint.severity,
      status: constraint.status,
      onsetOrReportedDate: isoDate(constraint.startDate),
      createdAt,
      updatedAt: constraint.lastUpdatedAt,
      resolvedAt: null,
      triggers: [...(constraint.triggers ?? [])],
      seriousSymptoms: constraint.seriousSymptoms === true,
      seriousSymptom: constraint.seriousSymptom,
      transitionHistory: history,
      sourceActor: 'migration',
      sourceSurface: args.sourceSurface ?? 'legacy_hydration',
      affectedDates: [...(constraint.linkedOverrideDates ?? [])].sort(),
      affectedWeeks: constraint.weekStartISO ? [constraint.weekStartISO] : [],
      currentRestrictionPolicy: {
        rules: [...constraint.rules],
        safeFocus: [...constraint.safeFocus],
        advice: [...constraint.advice],
        severityBand: constraint.severityBand,
        adjustmentLevel: constraint.adjustmentLevel,
        priorSeverity: constraint.priorSeverity,
      },
      legacyMigrationStatus: 'legacy_after_state_only',
      compatibility: {
        constraintId: constraint.id,
        activeInjuryId: matchingAlias
          ? `injury-${stablePart(matchingAlias.bucket || matchingAlias.bodyPart || 'unknown')}`
          : undefined,
      },
    };
  });
}

export function composeInjuryCompatibility(args: {
  activeConstraints: readonly ActiveConstraint[];
  injuryEpisodes: readonly InjuryEpisodeV1[];
}): { activeConstraints: ActiveConstraint[]; activeInjury: InjuryState | null } {
  const nonInjury = args.activeConstraints.filter((constraint) => constraint.type !== 'injury');
  return {
    activeConstraints: [...nonInjury, ...deriveInjuryConstraintsFromEpisodes(args.injuryEpisodes)],
    activeInjury: deriveLegacyInjuryFromEpisodes(args.injuryEpisodes),
  };
}
