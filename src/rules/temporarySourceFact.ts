import type { ActiveConstraint, ActiveFatigueConstraint, ActiveSorenessConstraint } from '../store/coachUpdatesStore';
import type { ReadinessSignal } from '../utils/readiness';
import type { InjuryState } from '../utils/injuryProgression';
import {
  composeInjuryCompatibility,
  migrateLegacyInjuryEpisodes,
  normalizeInjuryEpisodes,
  type InjuryEpisodeV1,
} from './injuryEpisode';

export const TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION = 1 as const;

export type TemporarySourceFactStatus = 'active' | 'resolved' | 'expired';
export type TemporarySourceFactActor = 'athlete' | 'coach' | 'system';
export type TemporarySourceFactSurface =
  | 'coach_chat'
  | 'program_tab'
  | 'session_detail'
  | 'quick_check'
  | 'hydration_migration'
  | 'test'
  | string;
export type TemporaryAthleteReportedLevel =
  | number
  | 'slight'
  | 'moderate'
  | 'high'
  | 'cooked'
  | 'unspecified';

export interface TemporarySourceFactScope {
  kind: 'date' | 'week' | 'window';
  date?: string;
  weekStart?: string;
  from: string;
  until: string;
}

interface TemporarySourceFactBase<TKind extends string> {
  protocolVersion: typeof TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION;
  factId: string;
  factKind: TKind;
  status: TemporarySourceFactStatus;
  observedDate: string;
  effectiveFrom: string;
  effectiveUntil: string;
  scope: TemporarySourceFactScope;
  athleteReportedLevel: TemporaryAthleteReportedLevel;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  sourceActor: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  legacyMigrationStatus: 'native_v1' | 'legacy_after_state_only';
}

export interface TemporaryFatigueFact extends TemporarySourceFactBase<'fatigue'> {
  /** Factual "cooked" reports are fatigue facts, never implicit load edits. */
  reportKind: 'fatigue' | 'cooked';
}

export interface TemporarySorenessFact extends TemporarySourceFactBase<'soreness'> {
  distribution: 'localized' | 'general';
  /** Exact athlete wording, e.g. "my calves", retained without rewriting. */
  reportedBodyPartLanguage: string | null;
  canonicalBodyPartBucket: InjuryState['bucket'] | null;
}

export interface TemporaryPoorSleepFact extends TemporarySourceFactBase<'poor_sleep'> {
  pattern: 'single_night' | 'repeated';
}

/** InjuryEpisodeV1 is the landed injury member of the same canonical fact set. */
export type TemporarySourceFact =
  | InjuryEpisodeV1
  | TemporaryFatigueFact
  | TemporarySorenessFact
  | TemporaryPoorSleepFact;

export interface TemporarySourceFactCompatibility {
  injuryEpisodes: InjuryEpisodeV1[];
  activeConstraints: ActiveConstraint[];
  activeInjury: InjuryState | null;
  readinessSignalsByDate: Record<string, ReadinessSignal>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isoDate(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : null;
}

function isoTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function clampReportedLevel(value: unknown): TemporaryAthleteReportedLevel {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(10, Math.round(value)));
  }
  return value === 'slight' || value === 'moderate' || value === 'high' ||
    value === 'cooked' || value === 'unspecified'
    ? value
    : 'unspecified';
}

const CANONICAL_BODY_PART_BUCKETS = new Set<NonNullable<InjuryState['bucket']>>([
  'adductor',
  'pubalgia',
  'lowerBack',
  'knee',
  'hamstring',
  'calf',
  'ankle',
  'shoulder',
  'elbow',
  'wrist',
]);

function canonicalBodyPartBucket(value: unknown): InjuryState['bucket'] | null {
  return typeof value === 'string' &&
    CANONICAL_BODY_PART_BUCKETS.has(value as NonNullable<InjuryState['bucket']>)
    ? value as NonNullable<InjuryState['bucket']>
    : null;
}

function normalizeScope(value: unknown, from: string, until: string): TemporarySourceFactScope {
  const raw = isRecord(value) ? value : {};
  const kind = raw.kind === 'week' || raw.kind === 'window' ? raw.kind : 'date';
  return {
    kind,
    ...(kind === 'date' ? { date: isoDate(raw.date) ?? from } : {}),
    ...(kind === 'week' ? { weekStart: isoDate(raw.weekStart) ?? from } : {}),
    from: isoDate(raw.from) ?? from,
    until: isoDate(raw.until) ?? until,
  };
}

function normalizeNonInjuryFact(value: unknown): TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact | null {
  if (!isRecord(value) || typeof value.factId !== 'string') return null;
  if (value.factKind !== 'fatigue' && value.factKind !== 'soreness' && value.factKind !== 'poor_sleep') {
    return null;
  }
  const observedDate = isoDate(value.observedDate);
  const effectiveFrom = isoDate(value.effectiveFrom) ?? observedDate;
  const effectiveUntil = isoDate(value.effectiveUntil) ?? effectiveFrom;
  if (!observedDate || !effectiveFrom || !effectiveUntil) return null;
  const createdAt = isoTimestamp(value.createdAt, `${observedDate}T00:00:00.000Z`);
  const updatedAt = isoTimestamp(value.updatedAt, createdAt);
  const base = {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: value.factId,
    status: value.status === 'resolved' || value.status === 'expired' ? value.status : 'active' as const,
    observedDate,
    effectiveFrom,
    effectiveUntil,
    scope: normalizeScope(value.scope, effectiveFrom, effectiveUntil),
    athleteReportedLevel: clampReportedLevel(value.athleteReportedLevel),
    createdAt,
    updatedAt,
    resolvedAt: value.status === 'resolved' || value.status === 'expired'
      ? isoTimestamp(value.resolvedAt, updatedAt)
      : null,
    sourceActor: value.sourceActor === 'coach' || value.sourceActor === 'system'
      ? value.sourceActor
      : 'athlete' as const,
    sourceSurface: typeof value.sourceSurface === 'string' ? value.sourceSurface : 'hydration_migration',
    legacyMigrationStatus: value.legacyMigrationStatus === 'legacy_after_state_only'
      ? 'legacy_after_state_only' as const
      : 'native_v1' as const,
  };
  if (value.factKind === 'fatigue') {
    return {
      ...base,
      factKind: 'fatigue',
      reportKind: value.reportKind === 'cooked' ? 'cooked' : 'fatigue',
    };
  }
  if (value.factKind === 'poor_sleep') {
    return {
      ...base,
      factKind: 'poor_sleep',
      pattern: value.pattern === 'repeated' ? 'repeated' : 'single_night',
    };
  }
  const bucket = canonicalBodyPartBucket(value.canonicalBodyPartBucket);
  return {
    ...base,
    factKind: 'soreness',
    distribution: value.distribution === 'localized' ? 'localized' : 'general',
    reportedBodyPartLanguage: typeof value.reportedBodyPartLanguage === 'string'
      ? value.reportedBodyPartLanguage
      : null,
    canonicalBodyPartBucket: bucket,
  };
}

export function isInjurySourceFact(fact: TemporarySourceFact): fact is InjuryEpisodeV1 {
  return 'episodeId' in fact;
}

export function temporarySourceFactId(fact: TemporarySourceFact): string {
  return isInjurySourceFact(fact) ? fact.episodeId : fact.factId;
}

export function normalizeTemporarySourceFacts(args: {
  value: unknown;
  legacyInjuryEpisodes?: unknown;
}): TemporarySourceFact[] {
  const source = Array.isArray(args.value) ? args.value : [];
  const sourceInjuries = normalizeInjuryEpisodes(
    source.filter((fact) => isRecord(fact) && typeof fact.episodeId === 'string'),
  );
  const injuries = sourceInjuries.length > 0
    ? sourceInjuries
    : normalizeInjuryEpisodes(args.legacyInjuryEpisodes);
  const nonInjuries = source
    .map(normalizeNonInjuryFact)
    .filter((fact): fact is TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact => !!fact);
  const byId = new Map<string, TemporarySourceFact>();
  for (const fact of [...injuries, ...nonInjuries]) byId.set(temporarySourceFactId(fact), fact);
  return Array.from(byId.values()).sort((left, right) =>
    temporarySourceFactId(left).localeCompare(temporarySourceFactId(right)));
}

export function activeTemporarySourceFacts(
  facts: readonly TemporarySourceFact[],
  onDate?: string,
): TemporarySourceFact[] {
  return facts.filter((fact) => {
    if (isInjurySourceFact(fact)) return fact.status === 'active' || fact.status === 'improving';
    if (fact.status !== 'active') return false;
    return !onDate || (fact.effectiveFrom <= onDate && fact.effectiveUntil >= onDate);
  });
}

export function expireTemporarySourceFacts(
  facts: readonly TemporarySourceFact[],
  onDate: string,
  now: string,
): TemporarySourceFact[] {
  return facts.map((fact) => {
    if (isInjurySourceFact(fact) || fact.status !== 'active' || fact.effectiveUntil >= onDate) return fact;
    return { ...fact, status: 'expired', updatedAt: now, resolvedAt: now };
  });
}

function levelScore(level: TemporaryAthleteReportedLevel): number {
  if (typeof level === 'number') return level;
  if (level === 'slight') return 3;
  if (level === 'moderate') return 5;
  if (level === 'high') return 7;
  if (level === 'cooked') return 8;
  return 3;
}

function projectionScore(
  fact: TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact,
): number {
  if (fact.factKind === 'poor_sleep' && fact.athleteReportedLevel === 'unspecified') {
    return fact.pattern === 'repeated' ? 5 : 3;
  }
  return levelScore(fact.athleteReportedLevel);
}

function factConstraintMetadata(facts: readonly (TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact)[]) {
  const updated = facts.map((fact) => fact.updatedAt).sort();
  const expires = facts.map((fact) => fact.effectiveUntil).sort();
  return {
    temporarySourceFactIds: facts.map((fact) => fact.factId).sort(),
    startDate: facts.map((fact) => fact.effectiveFrom).sort()[0],
    lastUpdatedAt: updated[updated.length - 1],
    expiresAt: expires[expires.length - 1],
  };
}

function globalConstraint(
  facts: readonly (TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact)[],
): ActiveFatigueConstraint | null {
  if (facts.length === 0) return null;
  const strongest = [...facts].sort((left, right) =>
    projectionScore(right) - projectionScore(left) ||
    right.updatedAt.localeCompare(left.updatedAt))[0];
  const severity = projectionScore(strongest);
  const dateScoped = facts.every((fact) => fact.scope.kind === 'date') &&
    new Set(facts.map((fact) => fact.effectiveFrom)).size === 1;
  const poorSleep = strongest.factKind === 'poor_sleep' ? strongest : null;
  return {
    id: `source-fact:global:${strongest.effectiveFrom}:${strongest.effectiveUntil}`,
    type: 'fatigue',
    severity,
    status: 'active',
    ...factConstraintMetadata(facts),
    reasonLabel: poorSleep
      ? poorSleep.pattern === 'repeated' ? 'Repeated poor sleep' : 'Poor sleep'
      : strongest.factKind === 'soreness' ? 'General soreness' : 'Fatigue',
    source: poorSleep ? 'readiness' : 'coach',
    ...(poorSleep ? { readinessKind: 'poor_sleep' as const, readinessPattern: poorSleep.pattern } : {}),
    ...(dateScoped ? { appliesToDate: strongest.effectiveFrom } : {}),
    ...(strongest.scope.kind === 'week' ? { weekStartISO: strongest.scope.weekStart } : {}),
    modifierAffects: [dateScoped ? 'current_day' : 'current_week'],
    rules: severity >= 7
      ? ['max-effort + heavy strength', 'sprinting / plyos', 'extra hard conditioning']
      : severity >= 5
        ? ['max-effort lifts', 'hard conditioning + sprints']
        : ['finishers / hard extras'],
    safeFocus: severity >= 5
      ? ['Controlled strength dose', 'Easy aerobic conditioning', 'Recovery + mobility']
      : ['Main work if moving well', 'Easy aerobic conditioning', 'Light technique work'],
    advice: [],
  };
}

function globalConstraints(
  facts: readonly (TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact)[],
): ActiveFatigueConstraint[] {
  const byWindow = new Map<string, Array<TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact>>();
  for (const fact of facts) {
    const key = `${fact.effectiveFrom}:${fact.effectiveUntil}`;
    const windowFacts = byWindow.get(key) ?? [];
    windowFacts.push(fact);
    byWindow.set(key, windowFacts);
  }
  return Array.from(byWindow.values())
    .map(globalConstraint)
    .filter((constraint): constraint is ActiveFatigueConstraint => !!constraint)
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id));
}

function localizedSorenessConstraints(facts: readonly TemporarySorenessFact[]): ActiveSorenessConstraint[] {
  const byBucketAndWindow = new Map<string, {
    bucket: NonNullable<InjuryState['bucket']>;
    facts: TemporarySorenessFact[];
  }>();
  for (const fact of facts) {
    if (fact.distribution !== 'localized' || !fact.canonicalBodyPartBucket) continue;
    const key = `${fact.canonicalBodyPartBucket}:${fact.effectiveFrom}:${fact.effectiveUntil}`;
    const group = byBucketAndWindow.get(key) ?? {
      bucket: fact.canonicalBodyPartBucket,
      facts: [],
    };
    group.facts.push(fact);
    byBucketAndWindow.set(key, group);
  }
  return Array.from(byBucketAndWindow.values()).map(({ bucket, facts: bucketFacts }) => {
    const strongest = [...bucketFacts].sort((left, right) =>
      levelScore(right.athleteReportedLevel) - levelScore(left.athleteReportedLevel) ||
      right.updatedAt.localeCompare(left.updatedAt))[0];
    const severity = levelScore(strongest.athleteReportedLevel);
    const bodyPart = strongest.reportedBodyPartLanguage?.trim() || bucket;
    const dateScoped = bucketFacts.every((fact) => fact.scope.kind === 'date') &&
      new Set(bucketFacts.map((fact) => fact.effectiveFrom)).size === 1;
    return {
      id: `source-fact:soreness:${bucket}:${strongest.effectiveFrom}:${strongest.effectiveUntil}`,
      type: 'soreness',
      bodyPart,
      bucket,
      severity,
      status: 'active',
      ...factConstraintMetadata(bucketFacts),
      reasonLabel: `${bodyPart} soreness`,
      source: 'coach',
      ...(dateScoped ? { appliesToDate: strongest.effectiveFrom } : {}),
      ...(strongest.scope.kind === 'week' ? { weekStartISO: strongest.scope.weekStart } : {}),
      modifierAffects: [dateScoped ? 'current_day' : 'current_week'],
      rules: severity >= 7 ? [`avoid hard ${bodyPart} loading`] : [`keep ${bodyPart} work pain-free`],
      safeFocus: ['Pain-free strength', 'Easy aerobic conditioning', 'Mobility / recovery'],
      advice: [],
    };
  }).sort((left, right) => left.bucket.localeCompare(right.bucket) ||
    left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id));
}

function readinessProjection(
  facts: readonly (TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact)[],
): Record<string, ReadinessSignal> {
  const byDate: Record<string, ReadinessSignal> = {};
  for (const fact of facts) {
    const date = fact.observedDate;
    const previous = byDate[date];
    const signal: ReadinessSignal = previous ?? {
      date,
      source: 'coach_message',
      updatedAt: fact.updatedAt,
      temporarySourceFactIds: [],
    };
    signal.temporarySourceFactIds = Array.from(new Set([
      ...(signal.temporarySourceFactIds ?? []),
      fact.factId,
    ])).sort();
    if (fact.updatedAt > signal.updatedAt) signal.updatedAt = fact.updatedAt;
    if (fact.factKind === 'fatigue') {
      signal.energy = 'low';
      signal.flatToday = levelScore(fact.athleteReportedLevel) >= 7;
    } else if (fact.factKind === 'poor_sleep') {
      signal.poorSleepPattern = fact.pattern;
    } else {
      signal.soreness = levelScore(fact.athleteReportedLevel) >= 7 ? 'high' : 'moderate';
      if (fact.distribution === 'localized' && fact.reportedBodyPartLanguage) {
        signal.bodyPart = fact.reportedBodyPartLanguage;
      }
    }
    byDate[date] = signal;
  }
  return byDate;
}

export function isTemporarySourceFactConstraint(constraint: ActiveConstraint): boolean {
  return (constraint.temporarySourceFactIds?.length ?? 0) > 0 ||
    (constraint.type === 'injury' && !!constraint.injuryEpisodeId);
}

/** Pure compatibility projection. Facts remain the only health authority. */
export function composeTemporarySourceFactCompatibility(args: {
  temporarySourceFacts: readonly TemporarySourceFact[];
  activeConstraints?: readonly ActiveConstraint[];
  readinessSignalsByDate?: Readonly<Record<string, ReadinessSignal>>;
  onDate?: string;
}): TemporarySourceFactCompatibility {
  const facts = normalizeTemporarySourceFacts({ value: args.temporarySourceFacts });
  const injuryEpisodes = facts.filter(isInjurySourceFact);
  const active = activeTemporarySourceFacts(facts, args.onDate);
  const activeNonInjuries = active.filter((fact): fact is TemporaryFatigueFact | TemporarySorenessFact | TemporaryPoorSleepFact =>
    !isInjurySourceFact(fact));
  const injury = composeInjuryCompatibility({
    activeConstraints: (args.activeConstraints ?? []).filter((constraint) =>
      !isTemporarySourceFactConstraint(constraint) &&
      constraint.type !== 'injury' &&
      constraint.type !== 'fatigue' &&
      constraint.type !== 'soreness'),
    injuryEpisodes,
  });
  const localized = localizedSorenessConstraints(activeNonInjuries.filter((fact): fact is TemporarySorenessFact =>
    fact.factKind === 'soreness' && fact.distribution === 'localized'));
  const global = globalConstraints(activeNonInjuries.filter((fact) =>
    fact.factKind !== 'soreness' || fact.distribution === 'general'));
  const retainedSignals = Object.fromEntries(Object.entries(args.readinessSignalsByDate ?? {})
    .filter(([, signal]) =>
      (signal.temporarySourceFactIds?.length ?? 0) === 0 &&
      signal.source !== 'session_feedback' &&
      typeof signal.timeAvailableMinutes === 'number')
    .map(([date, signal]) => [date, {
      date,
      timeAvailableMinutes: signal.timeAvailableMinutes,
      source: signal.source,
      updatedAt: signal.updatedAt,
    } satisfies ReadinessSignal]));
  return {
    injuryEpisodes,
    activeConstraints: [
      ...injury.activeConstraints,
      ...localized,
      ...global,
    ],
    activeInjury: injury.activeInjury,
    readinessSignalsByDate: {
      ...retainedSignals,
      ...readinessProjection(activeNonInjuries),
    },
  };
}

export function stableTemporarySourceFactId(args: {
  factKind: 'fatigue' | 'soreness' | 'poor_sleep';
  observedDate: string;
  scope: TemporarySourceFactScope;
  canonicalBodyPartBucket?: InjuryState['bucket'] | null;
}): string {
  const scopeKey = args.scope.kind === 'week'
    ? `week:${args.scope.weekStart}`
    : args.scope.kind === 'date' ? `date:${args.scope.date}` : `window:${args.scope.from}:${args.scope.until}`;
  const body = args.factKind === 'soreness'
    ? `:${args.canonicalBodyPartBucket ?? 'general'}`
    : '';
  return `temporary-source-fact:v1:${args.factKind}:${scopeKey}${body}`;
}

function mondayFor(dateISO: string): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function addDays(dateISO: string, count: number): string {
  const date = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
}

export function temporaryFactScope(args: {
  kind: 'date' | 'week' | 'window';
  date?: string;
  from?: string;
  until?: string;
}): TemporarySourceFactScope {
  const anchor = (args.date ?? args.from ?? new Date().toISOString()).slice(0, 10);
  if (args.kind === 'week') {
    const weekStart = mondayFor(anchor);
    return { kind: 'week', weekStart, from: weekStart, until: addDays(weekStart, 6) };
  }
  if (args.kind === 'window') {
    const from = (args.from ?? anchor).slice(0, 10);
    return { kind: 'window', from, until: (args.until ?? from).slice(0, 10) };
  }
  return { kind: 'date', date: anchor, from: anchor, until: anchor };
}

export function createTemporaryFatigueFact(args: {
  observedDate: string;
  scope: TemporarySourceFactScope;
  athleteReportedLevel: TemporaryAthleteReportedLevel;
  reportKind?: 'fatigue' | 'cooked';
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporaryFatigueFact {
  const now = args.now ?? new Date().toISOString();
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? stableTemporarySourceFactId({
      factKind: 'fatigue', observedDate: args.observedDate, scope: args.scope,
    }),
    factKind: 'fatigue',
    reportKind: args.reportKind ?? 'fatigue',
    status: 'active',
    observedDate: args.observedDate.slice(0, 10),
    effectiveFrom: args.scope.from,
    effectiveUntil: args.scope.until,
    scope: args.scope,
    athleteReportedLevel: args.athleteReportedLevel,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    sourceActor: args.sourceActor ?? 'athlete',
    sourceSurface: args.sourceSurface,
    legacyMigrationStatus: 'native_v1',
  };
}

export function createTemporarySorenessFact(args: {
  observedDate: string;
  scope: TemporarySourceFactScope;
  athleteReportedLevel: TemporaryAthleteReportedLevel;
  distribution: 'localized' | 'general';
  reportedBodyPartLanguage?: string | null;
  canonicalBodyPartBucket?: InjuryState['bucket'] | null;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporarySorenessFact {
  const now = args.now ?? new Date().toISOString();
  const canonicalBodyPartBucket = args.distribution === 'localized'
    ? args.canonicalBodyPartBucket ?? null
    : null;
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? stableTemporarySourceFactId({
      factKind: 'soreness',
      observedDate: args.observedDate,
      scope: args.scope,
      canonicalBodyPartBucket,
    }),
    factKind: 'soreness',
    status: 'active',
    observedDate: args.observedDate.slice(0, 10),
    effectiveFrom: args.scope.from,
    effectiveUntil: args.scope.until,
    scope: args.scope,
    athleteReportedLevel: args.athleteReportedLevel,
    distribution: args.distribution,
    reportedBodyPartLanguage: args.distribution === 'localized'
      ? args.reportedBodyPartLanguage?.trim() || null
      : null,
    canonicalBodyPartBucket,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    sourceActor: args.sourceActor ?? 'athlete',
    sourceSurface: args.sourceSurface,
    legacyMigrationStatus: 'native_v1',
  };
}

export function createTemporaryPoorSleepFact(args: {
  observedDate: string;
  scope: TemporarySourceFactScope;
  pattern: 'single_night' | 'repeated';
  athleteReportedLevel?: TemporaryAthleteReportedLevel;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporaryPoorSleepFact {
  const now = args.now ?? new Date().toISOString();
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? stableTemporarySourceFactId({
      factKind: 'poor_sleep', observedDate: args.observedDate, scope: args.scope,
    }),
    factKind: 'poor_sleep',
    status: 'active',
    observedDate: args.observedDate.slice(0, 10),
    effectiveFrom: args.scope.from,
    effectiveUntil: args.scope.until,
    scope: args.scope,
    athleteReportedLevel: args.athleteReportedLevel ?? 'unspecified',
    pattern: args.pattern,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    sourceActor: args.sourceActor ?? 'athlete',
    sourceSurface: args.sourceSurface,
    legacyMigrationStatus: 'native_v1',
  };
}

/** One-way hydration migration. It never reads SessionFeedback and never invents restoration. */
export function migrateLegacyTemporarySourceFacts(args: {
  activeConstraints: readonly ActiveConstraint[];
  activeInjury: InjuryState | null;
  readinessSignalsByDate: Readonly<Record<string, ReadinessSignal>>;
  sourceSurface?: string;
}): TemporarySourceFact[] {
  const sourceSurface = args.sourceSurface ?? 'hydration_migration';
  const injuries = migrateLegacyInjuryEpisodes({
    activeConstraints: args.activeConstraints,
    activeInjury: args.activeInjury,
    sourceSurface,
  });
  const migrated: TemporarySourceFact[] = [...injuries];
  const seen = new Set<string>();
  for (const constraint of args.activeConstraints) {
    if (constraint.status !== 'active' || isTemporarySourceFactConstraint(constraint)) continue;
    if (constraint.type !== 'fatigue' && constraint.type !== 'soreness') continue;
    const date = (constraint.appliesToDate ?? constraint.startDate).slice(0, 10);
    const scope = constraint.weekStartISO
      ? temporaryFactScope({ kind: 'week', date: constraint.weekStartISO })
      : constraint.appliesToDate
        ? temporaryFactScope({ kind: 'date', date })
        : temporaryFactScope({ kind: 'window', from: date, until: constraint.expiresAt ?? date });
    const fact = constraint.type === 'soreness'
      ? createTemporarySorenessFact({
          observedDate: date,
          scope,
          athleteReportedLevel: constraint.severity,
          distribution: 'localized',
          reportedBodyPartLanguage: constraint.bodyPart,
          canonicalBodyPartBucket: constraint.bucket,
          sourceActor: 'system',
          sourceSurface,
          now: constraint.lastUpdatedAt,
        })
      : constraint.readinessKind === 'poor_sleep'
        ? createTemporaryPoorSleepFact({
            observedDate: date,
            scope,
            pattern: constraint.readinessPattern ?? 'single_night',
            athleteReportedLevel: constraint.severity,
            sourceActor: 'system',
            sourceSurface,
            now: constraint.lastUpdatedAt,
          })
        : createTemporaryFatigueFact({
            observedDate: date,
            scope,
            athleteReportedLevel: constraint.severity,
            reportKind: constraint.severity >= 7 ? 'cooked' : 'fatigue',
            sourceActor: 'system',
            sourceSurface,
            now: constraint.lastUpdatedAt,
          });
    fact.legacyMigrationStatus = 'legacy_after_state_only';
    if (!seen.has(fact.factId)) {
      migrated.push(fact);
      seen.add(fact.factId);
    }
  }
  for (const signal of Object.values(args.readinessSignalsByDate)) {
    if (signal.source === 'session_feedback' || (signal.temporarySourceFactIds?.length ?? 0) > 0) continue;
    const scope = temporaryFactScope({ kind: 'date', date: signal.date });
    const candidates: Array<TemporaryFatigueFact | TemporarySorenessFact> = [];
    if (signal.energy === 'low' || signal.flatToday) {
      candidates.push(createTemporaryFatigueFact({
        observedDate: signal.date,
        scope,
        athleteReportedLevel: signal.flatToday ? 'high' : 'slight',
        sourceActor: 'system',
        sourceSurface,
        now: signal.updatedAt,
      }));
    }
    if (signal.soreness === 'moderate' || signal.soreness === 'high') {
      const matchingConstraint = args.activeConstraints.find((constraint) =>
        constraint.type === 'soreness' && constraint.appliesToDate === signal.date);
      candidates.push(createTemporarySorenessFact({
        observedDate: signal.date,
        scope,
        athleteReportedLevel: signal.soreness === 'high' ? 'high' : 'moderate',
        distribution: matchingConstraint?.type === 'soreness' ? 'localized' : 'general',
        reportedBodyPartLanguage: signal.bodyPart ?? null,
        canonicalBodyPartBucket: matchingConstraint?.type === 'soreness' ? matchingConstraint.bucket : null,
        sourceActor: 'system',
        sourceSurface,
        now: signal.updatedAt,
      }));
    }
    for (const fact of candidates) {
      fact.legacyMigrationStatus = 'legacy_after_state_only';
      if (!seen.has(fact.factId)) {
        migrated.push(fact);
        seen.add(fact.factId);
      }
    }
  }
  return normalizeTemporarySourceFacts({ value: migrated });
}
