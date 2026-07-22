import type { ActiveConstraint, ActiveFatigueConstraint, ActiveSorenessConstraint } from '../store/coachUpdatesStore';
import type {
  ActiveEquipmentConstraint,
  ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import type { EquipmentTag } from '../data/exercisePools';
import type { ReadinessSignal } from '../utils/readiness';
import type { InjuryState } from '../utils/injuryProgression';
import type {
  ConditioningEquipmentModality,
  DayOfWeek,
  ProgramAvailabilityConstraint,
} from '../types/domain';
import {
  composeInjuryCompatibility,
  migrateLegacyInjuryEpisodes,
  normalizeInjuryEpisodes,
  type InjuryEpisodeV1,
} from './injuryEpisode';

export const TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION = 1 as const;

export type TemporarySourceFactStatus = 'active' | 'resolved' | 'expired' | 'superseded';
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

export interface TemporarySourceFactTransition {
  at: string;
  from: TemporarySourceFactStatus | null;
  to: TemporarySourceFactStatus;
  actor: TemporarySourceFactActor;
  surface: TemporarySourceFactSurface;
  reason?: string;
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
  transitionHistory: TemporarySourceFactTransition[];
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

export interface TemporaryEquipmentFact extends TemporarySourceFactBase<'equipment'> {
  mode: 'only' | 'without';
  equipmentTags: EquipmentTag[];
  /** Exact unavailable/available conditioning modalities, never generated exercises. */
  conditioningModalities: ConditioningEquipmentModality[];
}

export type TemporaryScheduleFactKind =
  | 'unavailable_dates'
  | 'unavailable_weekdays'
  | 'busy_week'
  | 'travel'
  | 'max_sessions';

export interface TemporaryScheduleFact extends TemporarySourceFactBase<'schedule'> {
  scheduleKind: TemporaryScheduleFactKind;
  unavailableDates: string[];
  unavailableWeekdays: DayOfWeek[];
  maxSessions: number | null;
}

export interface TemporaryTimeCapFact extends TemporarySourceFactBase<'time_cap'> {
  targetKind: 'dates' | 'weekdays' | 'all_sessions';
  dates: string[];
  weekdays: DayOfWeek[];
  maxSessionMinutes: number;
}

export type TemporaryHealthFact =
  | TemporaryFatigueFact
  | TemporarySorenessFact
  | TemporaryPoorSleepFact;

export type NonInjuryTemporarySourceFact =
  | TemporaryHealthFact
  | TemporaryEquipmentFact
  | TemporaryScheduleFact
  | TemporaryTimeCapFact;

/** InjuryEpisodeV1 is the landed injury member of the same canonical fact set. */
export type TemporarySourceFact =
  | InjuryEpisodeV1
  | NonInjuryTemporarySourceFact;

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

const DAY_NAMES = new Set<DayOfWeek>([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

const CONDITIONING_MODALITIES = new Set<ConditioningEquipmentModality>([
  'bike',
  'row',
  'ski',
  'treadmill',
]);

function normalizeStatus(value: unknown): TemporarySourceFactStatus {
  return value === 'resolved' || value === 'expired' || value === 'superseded'
    ? value
    : 'active';
}

function normalizeActor(value: unknown): TemporarySourceFactActor {
  return value === 'coach' || value === 'system' ? value : 'athlete';
}

function normalizeTransitionHistory(args: {
  value: unknown;
  createdAt: string;
  status: TemporarySourceFactStatus;
  actor: TemporarySourceFactActor;
  surface: TemporarySourceFactSurface;
}): TemporarySourceFactTransition[] {
  const normalized = (Array.isArray(args.value) ? args.value : [])
    .map((entry): TemporarySourceFactTransition | null => {
      if (!isRecord(entry)) return null;
      const to = normalizeStatus(entry.to);
      const from = entry.from === null
        ? null
        : entry.from === 'active' || entry.from === 'resolved' ||
          entry.from === 'expired' || entry.from === 'superseded'
          ? entry.from
          : null;
      return {
        at: isoTimestamp(entry.at, args.createdAt),
        from,
        to,
        actor: normalizeActor(entry.actor),
        surface: typeof entry.surface === 'string' ? entry.surface : args.surface,
        ...(typeof entry.reason === 'string' ? { reason: entry.reason } : {}),
      };
    })
    .filter((entry): entry is TemporarySourceFactTransition => !!entry);
  if (normalized.length > 0) return normalized;
  return [{
    at: args.createdAt,
    from: null,
    to: args.status,
    actor: args.actor,
    surface: args.surface,
    reason: args.status === 'active' ? 'created' : 'legacy_hydration',
  }];
}

function normalizeDates(value: unknown): string[] {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map(isoDate)
    .filter((date): date is string => !!date))).sort();
}

function normalizeWeekdays(value: unknown): DayOfWeek[] {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .filter((day): day is DayOfWeek =>
      typeof day === 'string' && DAY_NAMES.has(day as DayOfWeek))));
}

function normalizeNonInjuryFact(value: unknown): NonInjuryTemporarySourceFact | null {
  if (!isRecord(value) || typeof value.factId !== 'string') return null;
  if (value.factKind !== 'fatigue' && value.factKind !== 'soreness' &&
    value.factKind !== 'poor_sleep' && value.factKind !== 'equipment' &&
    value.factKind !== 'schedule' && value.factKind !== 'time_cap') {
    return null;
  }
  const observedDate = isoDate(value.observedDate);
  const effectiveFrom = isoDate(value.effectiveFrom) ?? observedDate;
  const effectiveUntil = isoDate(value.effectiveUntil) ?? effectiveFrom;
  if (!observedDate || !effectiveFrom || !effectiveUntil) return null;
  const createdAt = isoTimestamp(value.createdAt, `${observedDate}T00:00:00.000Z`);
  const updatedAt = isoTimestamp(value.updatedAt, createdAt);
  const status = normalizeStatus(value.status);
  const sourceActor = normalizeActor(value.sourceActor);
  const sourceSurface = typeof value.sourceSurface === 'string'
    ? value.sourceSurface
    : 'hydration_migration';
  const base: Omit<TemporarySourceFactBase<NonInjuryTemporarySourceFact['factKind']>, 'factKind'> = {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: value.factId,
    status,
    observedDate,
    effectiveFrom,
    effectiveUntil,
    scope: normalizeScope(value.scope, effectiveFrom, effectiveUntil),
    athleteReportedLevel: clampReportedLevel(value.athleteReportedLevel),
    createdAt,
    updatedAt,
    resolvedAt: status !== 'active'
      ? isoTimestamp(value.resolvedAt, updatedAt)
      : null,
    sourceActor,
    sourceSurface,
    legacyMigrationStatus: value.legacyMigrationStatus === 'legacy_after_state_only'
      ? 'legacy_after_state_only' as const
      : 'native_v1' as const,
    transitionHistory: normalizeTransitionHistory({
      value: value.transitionHistory,
      createdAt,
      status,
      actor: sourceActor,
      surface: sourceSurface,
    }),
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
  if (value.factKind === 'equipment') {
    const mode = value.mode === 'without' ? 'without' : 'only';
    const conditioningModalities = Array.from(new Set((Array.isArray(value.conditioningModalities)
      ? value.conditioningModalities
      : []).filter((modality): modality is ConditioningEquipmentModality =>
      typeof modality === 'string' &&
      CONDITIONING_MODALITIES.has(modality as ConditioningEquipmentModality))));
    const equipmentTags = Array.from(new Set([
      ...(Array.isArray(value.equipmentTags)
        ? value.equipmentTags
        : []).filter((tag): tag is EquipmentTag => typeof tag === 'string'),
      ...(mode === 'only' && conditioningModalities.length > 0
        ? ['bike_or_treadmill' as EquipmentTag]
        : []),
    ]));
    return {
      ...base,
      factKind: 'equipment',
      mode,
      equipmentTags,
      conditioningModalities,
    };
  }
  if (value.factKind === 'schedule') {
    const scheduleKind: TemporaryScheduleFactKind =
      value.scheduleKind === 'unavailable_weekdays' ||
      value.scheduleKind === 'busy_week' ||
      value.scheduleKind === 'travel' ||
      value.scheduleKind === 'max_sessions'
        ? value.scheduleKind
        : 'unavailable_dates';
    const rawMax = typeof value.maxSessions === 'number' && Number.isFinite(value.maxSessions)
      ? Math.max(0, Math.min(14, Math.trunc(value.maxSessions)))
      : null;
    return {
      ...base,
      factKind: 'schedule',
      scheduleKind,
      unavailableDates: normalizeDates(value.unavailableDates),
      unavailableWeekdays: normalizeWeekdays(value.unavailableWeekdays),
      maxSessions: rawMax,
    };
  }
  if (value.factKind === 'time_cap') {
    const targetKind = value.targetKind === 'dates' || value.targetKind === 'weekdays'
      ? value.targetKind
      : 'all_sessions';
    const maxSessionMinutes = typeof value.maxSessionMinutes === 'number' &&
      Number.isFinite(value.maxSessionMinutes) &&
      value.maxSessionMinutes >= 10
      ? Math.min(240, Math.trunc(value.maxSessionMinutes))
      : 0;
    if (maxSessionMinutes <= 0) return null;
    return {
      ...base,
      factKind: 'time_cap',
      targetKind,
      dates: normalizeDates(value.dates),
      weekdays: normalizeWeekdays(value.weekdays),
      maxSessionMinutes,
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

export function isNonInjuryTemporarySourceFact(
  fact: TemporarySourceFact,
): fact is NonInjuryTemporarySourceFact {
  return !isInjurySourceFact(fact);
}

export function isTemporaryHealthFact(fact: TemporarySourceFact): fact is TemporaryHealthFact {
  return !isInjurySourceFact(fact) &&
    (fact.factKind === 'fatigue' || fact.factKind === 'soreness' ||
      fact.factKind === 'poor_sleep');
}

export function isTemporaryEquipmentFact(
  fact: TemporarySourceFact,
): fact is TemporaryEquipmentFact {
  return !isInjurySourceFact(fact) && fact.factKind === 'equipment';
}

export function isTemporaryScheduleFact(
  fact: TemporarySourceFact,
): fact is TemporaryScheduleFact {
  return !isInjurySourceFact(fact) && fact.factKind === 'schedule';
}

export function isTemporaryTimeCapFact(
  fact: TemporarySourceFact,
): fact is TemporaryTimeCapFact {
  return !isInjurySourceFact(fact) && fact.factKind === 'time_cap';
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
    .filter((fact): fact is NonInjuryTemporarySourceFact => !!fact);
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
    return {
      ...fact,
      status: 'expired',
      updatedAt: now,
      resolvedAt: now,
      transitionHistory: [
        ...fact.transitionHistory,
        {
          at: now,
          from: 'active',
          to: 'expired',
          actor: 'system',
          surface: 'durable_expiry',
          reason: 'effective_window_elapsed',
        },
      ],
    };
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
  fact: TemporaryHealthFact,
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
  facts: readonly TemporaryHealthFact[],
): ActiveFatigueConstraint | null {
  if (facts.length === 0) return null;
  const strongest = [...facts].sort((left, right) =>
    projectionScore(right) - projectionScore(left) ||
    right.updatedAt.localeCompare(left.updatedAt))[0];
  const severity = projectionScore(strongest);
  // Minor-tier contextual facts (severity < 4 = the exposure engine's `minor`
  // tier: slight/"tired today" fatigue, single-night poor sleep) are RECORD-ONLY.
  // They compose NO active constraint, so they have ZERO derivation effect on week
  // resolution / §18 — merely saying "I'm tired" must not mutate the program
  // (adjustment is strictly opt-in via the lighter-day offer). The readiness
  // witness signal is emitted separately by `readinessProjection`, so the card
  // still reflects the fact. Severe tiers (≥4) keep their auto-protect behaviour.
  // Product decision (Sam, 2026-07-22); see
  // docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md.
  if (severity < 4) return null;
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
  facts: readonly TemporaryHealthFact[],
): ActiveFatigueConstraint[] {
  const byWindow = new Map<string, TemporaryHealthFact[]>();
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
  return Array.from(byBucketAndWindow.values()).map(({
    bucket,
    facts: bucketFacts,
  }): ActiveSorenessConstraint => {
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
  facts: readonly TemporaryHealthFact[],
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

function equipmentProjection(
  facts: readonly TemporaryEquipmentFact[],
): ActiveEquipmentConstraint[] {
  return facts.map((fact): ActiveEquipmentConstraint => ({
    id: `source-fact:equipment:${fact.factId}`,
    type: 'equipment',
    mode: fact.mode,
    tags: [...fact.equipmentTags],
    conditioningModalities: [...fact.conditioningModalities],
    severity: 5,
    status: 'active',
    startDate: fact.effectiveFrom,
    lastUpdatedAt: fact.updatedAt,
    source: fact.sourceSurface === 'coach_chat' ? 'chat' :
      fact.sourceActor === 'system' ? 'system' : 'tap',
    reasonLabel: fact.mode === 'only' ? 'Temporary equipment setup' : 'Equipment unavailable',
    temporarySourceFactIds: [fact.factId],
    expiresAt: fact.effectiveUntil,
    ...(fact.scope.kind === 'week' ? { weekStartISO: fact.scope.weekStart } : {}),
    modifierTitle: 'Equipment restriction active',
    modifierBody: fact.mode === 'only'
      ? 'Your sessions are using only the equipment you currently have.'
      : 'Your sessions are avoiding the equipment you marked unavailable.',
    modifierAffects: ['current_week', 'future_generation'],
    rules: fact.mode === 'only'
      ? [`use only: ${fact.equipmentTags.join(', ') || 'bodyweight'}`]
      : [`avoid: ${fact.equipmentTags.join(', ')}`],
    safeFocus: ['Available-equipment substitutions', 'Bodyweight options'],
    advice: [],
  })).sort((left, right) => left.id.localeCompare(right.id));
}

function scheduleProjection(
  facts: readonly TemporaryScheduleFact[],
): ActiveScheduleConstraint[] {
  return facts.map((fact): ActiveScheduleConstraint => ({
    id: `source-fact:schedule:${fact.factId}`,
    type: 'schedule',
    severity: fact.scheduleKind === 'travel' ? 7 : 5,
    status: 'active',
    startDate: fact.effectiveFrom,
    lastUpdatedAt: fact.updatedAt,
    reasonLabel: fact.scheduleKind === 'travel' ? 'Away / travel' :
      fact.scheduleKind === 'busy_week' ? 'Busy week' : 'Temporary availability',
    source: fact.sourceActor === 'coach' ? 'coach' :
      fact.sourceActor === 'system' ? 'system' : 'tap',
    temporarySourceFactIds: [fact.factId],
    expiresAt: fact.effectiveUntil,
    ...(fact.scope.kind === 'week' ? { weekStartISO: fact.scope.weekStart } : {}),
    scheduleKind: fact.scheduleKind,
    unavailableDates: [...fact.unavailableDates],
    unavailableWeekdays: [...fact.unavailableWeekdays],
    maxSessionsThisWeek: fact.maxSessions ?? undefined,
    modifierTitle: fact.scheduleKind === 'travel'
      ? 'Away / travel period active'
      : fact.scheduleKind === 'busy_week'
        ? 'Busy week active'
        : 'Temporary availability active',
    modifierBody: fact.scheduleKind === 'travel'
      ? 'Your program is avoiding the dates you are away.'
      : fact.scheduleKind === 'busy_week'
        ? 'Your bounded week is being kept within the session limit you set.'
        : 'Your program is avoiding the dates or weekdays you marked unavailable.',
    modifierAffects: ['current_week', 'future_generation'],
    rules: [
      ...(fact.unavailableDates.length > 0
        ? [`unavailable dates: ${fact.unavailableDates.join(', ')}`]
        : []),
      ...(fact.unavailableWeekdays.length > 0
        ? [`unavailable weekdays: ${fact.unavailableWeekdays.join(', ')}`]
        : []),
      ...(fact.maxSessions !== null ? [`maximum ${fact.maxSessions} sessions`] : []),
    ],
    safeFocus: ['Eligible available days', 'Highest-priority work'],
    advice: [],
  })).sort((left, right) => left.id.localeCompare(right.id));
}

function timeCapProjection(
  facts: readonly TemporaryTimeCapFact[],
): ActiveScheduleConstraint[] {
  return facts.map((fact): ActiveScheduleConstraint => ({
    id: `source-fact:time-cap:${fact.factId}`,
    type: 'schedule',
    severity: fact.maxSessionMinutes < 20 ? 7 : 5,
    status: 'active',
    startDate: fact.effectiveFrom,
    lastUpdatedAt: fact.updatedAt,
    reasonLabel: `Temporary ${fact.maxSessionMinutes}-minute cap`,
    source: fact.sourceActor === 'coach' ? 'coach' :
      fact.sourceActor === 'system' ? 'system' : 'tap',
    temporarySourceFactIds: [fact.factId],
    expiresAt: fact.effectiveUntil,
    ...(fact.scope.kind === 'week' ? { weekStartISO: fact.scope.weekStart } : {}),
    scheduleKind: 'time_cap',
    maxSessionMinutes: fact.maxSessionMinutes,
    timeCapDates: [...fact.dates],
    timeCapWeekdays: [...fact.weekdays],
    timeCapAllSessions: fact.targetKind === 'all_sessions',
    modifierTitle: `${fact.maxSessionMinutes}-minute session cap active`,
    modifierBody: 'Every targeted session is capped deterministically within the effective window.',
    modifierAffects: ['current_week', 'future_generation'],
    rules: [`maximum session duration ${fact.maxSessionMinutes} minutes`],
    safeFocus: ['Highest-priority session content'],
    advice: [],
  })).sort((left, right) => left.id.localeCompare(right.id));
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
  const activeHealth = active.filter(isTemporaryHealthFact);
  const activeEquipment = active.filter(isTemporaryEquipmentFact);
  const activeSchedule = active.filter(isTemporaryScheduleFact);
  const activeTimeCaps = active.filter(isTemporaryTimeCapFact);
  const injury = composeInjuryCompatibility({
    activeConstraints: (args.activeConstraints ?? []).filter((constraint) =>
      !isTemporarySourceFactConstraint(constraint) &&
      constraint.type !== 'injury' &&
      constraint.type !== 'fatigue' &&
      constraint.type !== 'soreness'),
    injuryEpisodes,
  });
  const localized = localizedSorenessConstraints(activeHealth.filter((fact): fact is TemporarySorenessFact =>
    fact.factKind === 'soreness' && fact.distribution === 'localized'));
  const global = globalConstraints(activeHealth.filter((fact) =>
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
      ...equipmentProjection(activeEquipment),
      ...scheduleProjection(activeSchedule),
      ...timeCapProjection(activeTimeCaps),
    ],
    activeInjury: injury.activeInjury,
    readinessSignalsByDate: {
      ...retainedSignals,
      ...readinessProjection(activeHealth),
    },
  };
}

export function stableTemporarySourceFactId(args: {
  factKind: NonInjuryTemporarySourceFact['factKind'];
  observedDate: string;
  scope: TemporarySourceFactScope;
  canonicalBodyPartBucket?: InjuryState['bucket'] | null;
  discriminator?: string | null;
}): string {
  const scopeKey = args.scope.kind === 'week'
    ? `week:${args.scope.weekStart}`
    : args.scope.kind === 'date' ? `date:${args.scope.date}` : `window:${args.scope.from}:${args.scope.until}`;
  const body = args.factKind === 'soreness'
    ? `:${args.canonicalBodyPartBucket ?? 'general'}`
    : '';
  const discriminator = args.discriminator?.trim()
    ? `:${args.discriminator.trim().replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()}`
    : '';
  return `temporary-source-fact:v1:${args.factKind}:${scopeKey}${body}${discriminator}`;
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
    transitionHistory: [{
      at: now,
      from: null,
      to: 'active',
      actor: args.sourceActor ?? 'athlete',
      surface: args.sourceSurface,
      reason: 'created',
    }],
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
    transitionHistory: [{
      at: now,
      from: null,
      to: 'active',
      actor: args.sourceActor ?? 'athlete',
      surface: args.sourceSurface,
      reason: 'created',
    }],
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
    transitionHistory: [{
      at: now,
      from: null,
      to: 'active',
      actor: args.sourceActor ?? 'athlete',
      surface: args.sourceSurface,
      reason: 'created',
    }],
  };
}

export function createTemporaryEquipmentFact(args: {
  observedDate: string;
  scope: TemporarySourceFactScope;
  mode: 'only' | 'without';
  equipmentTags: readonly EquipmentTag[];
  conditioningModalities?: readonly ConditioningEquipmentModality[];
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporaryEquipmentFact {
  const now = args.now ?? new Date().toISOString();
  const actor = args.sourceActor ?? 'athlete';
  const conditioningModalities = Array.from(new Set(args.conditioningModalities ?? []));
  const equipmentTags = Array.from(new Set([
    ...args.equipmentTags,
    ...(args.mode === 'only' && conditioningModalities.length > 0
      ? ['bike_or_treadmill' as EquipmentTag]
      : []),
  ]));
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? stableTemporarySourceFactId({
      factKind: 'equipment',
      observedDate: args.observedDate,
      scope: args.scope,
    }),
    factKind: 'equipment',
    status: 'active',
    observedDate: args.observedDate.slice(0, 10),
    effectiveFrom: args.scope.from,
    effectiveUntil: args.scope.until,
    scope: args.scope,
    athleteReportedLevel: 'unspecified',
    mode: args.mode,
    equipmentTags,
    conditioningModalities,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    sourceActor: actor,
    sourceSurface: args.sourceSurface,
    legacyMigrationStatus: 'native_v1',
    transitionHistory: [{
      at: now,
      from: null,
      to: 'active',
      actor,
      surface: args.sourceSurface,
      reason: 'created',
    }],
  };
}

export function createTemporaryScheduleFact(args: {
  observedDate: string;
  scope: TemporarySourceFactScope;
  scheduleKind: TemporaryScheduleFactKind;
  unavailableDates?: readonly string[];
  unavailableWeekdays?: readonly DayOfWeek[];
  maxSessions?: number | null;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporaryScheduleFact {
  const now = args.now ?? new Date().toISOString();
  const actor = args.sourceActor ?? 'athlete';
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? stableTemporarySourceFactId({
      factKind: 'schedule',
      observedDate: args.observedDate,
      scope: args.scope,
      discriminator: args.scheduleKind,
    }),
    factKind: 'schedule',
    status: 'active',
    observedDate: args.observedDate.slice(0, 10),
    effectiveFrom: args.scope.from,
    effectiveUntil: args.scope.until,
    scope: args.scope,
    athleteReportedLevel: 'unspecified',
    scheduleKind: args.scheduleKind,
    unavailableDates: normalizeDates(args.unavailableDates ?? []),
    unavailableWeekdays: normalizeWeekdays(args.unavailableWeekdays ?? []),
    maxSessions: typeof args.maxSessions === 'number'
      ? Math.max(0, Math.min(14, Math.trunc(args.maxSessions)))
      : null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    sourceActor: actor,
    sourceSurface: args.sourceSurface,
    legacyMigrationStatus: 'native_v1',
    transitionHistory: [{
      at: now,
      from: null,
      to: 'active',
      actor,
      surface: args.sourceSurface,
      reason: 'created',
    }],
  };
}

export function createTemporaryTimeCapFact(args: {
  observedDate: string;
  scope: TemporarySourceFactScope;
  targetKind: 'dates' | 'weekdays' | 'all_sessions';
  dates?: readonly string[];
  weekdays?: readonly DayOfWeek[];
  maxSessionMinutes: number;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporaryTimeCapFact {
  const now = args.now ?? new Date().toISOString();
  const actor = args.sourceActor ?? 'athlete';
  const maxSessionMinutes = Math.trunc(args.maxSessionMinutes);
  if (!Number.isFinite(maxSessionMinutes) || maxSessionMinutes < 10) {
    throw new Error('temporary_time_cap_below_minimum');
  }
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? stableTemporarySourceFactId({
      factKind: 'time_cap',
      observedDate: args.observedDate,
      scope: args.scope,
      discriminator: args.targetKind,
    }),
    factKind: 'time_cap',
    status: 'active',
    observedDate: args.observedDate.slice(0, 10),
    effectiveFrom: args.scope.from,
    effectiveUntil: args.scope.until,
    scope: args.scope,
    athleteReportedLevel: 'unspecified',
    targetKind: args.targetKind,
    dates: normalizeDates(args.dates ?? []),
    weekdays: normalizeWeekdays(args.weekdays ?? []),
    maxSessionMinutes,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    sourceActor: actor,
    sourceSurface: args.sourceSurface,
    legacyMigrationStatus: 'native_v1',
    transitionHistory: [{
      at: now,
      from: null,
      to: 'active',
      actor,
      surface: args.sourceSurface,
      reason: 'created',
    }],
  };
}

/** One-way hydration migration. It never reads SessionFeedback and never invents restoration. */
export function migrateLegacyTemporarySourceFacts(args: {
  activeConstraints: readonly ActiveConstraint[];
  activeInjury: InjuryState | null;
  readinessSignalsByDate: Readonly<Record<string, ReadinessSignal>>;
  availabilityConstraints?: readonly ProgramAvailabilityConstraint[];
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
    if (constraint.type === 'equipment') {
      const scope = constraint.weekStartISO
        ? temporaryFactScope({ kind: 'week', date: constraint.weekStartISO })
        : temporaryFactScope({
            kind: 'window',
            from: constraint.startDate,
            until: constraint.expiresAt ?? constraint.startDate,
          });
      const fact = createTemporaryEquipmentFact({
        observedDate: constraint.startDate,
        scope,
        mode: constraint.mode,
        equipmentTags: constraint.tags,
        conditioningModalities: constraint.conditioningModalities,
        sourceActor: 'system',
        sourceSurface,
        now: constraint.lastUpdatedAt,
      });
      fact.legacyMigrationStatus = 'legacy_after_state_only';
      if (!seen.has(fact.factId)) {
        migrated.push(fact);
        seen.add(fact.factId);
      }
      continue;
    }
    if (constraint.type === 'schedule') {
      if (constraint.scheduleKind === 'time_cap' &&
        (!constraint.maxSessionMinutes || constraint.maxSessionMinutes < 10)) {
        continue;
      }
      const scope = constraint.weekStartISO
        ? temporaryFactScope({ kind: 'week', date: constraint.weekStartISO })
        : temporaryFactScope({
            kind: 'window',
            from: constraint.startDate,
            until: constraint.expiresAt ?? constraint.startDate,
          });
      const fact = constraint.scheduleKind === 'time_cap' && constraint.maxSessionMinutes
        ? createTemporaryTimeCapFact({
            observedDate: constraint.startDate,
            scope,
            targetKind: constraint.timeCapAllSessions
              ? 'all_sessions'
              : (constraint.timeCapDates?.length ?? 0) > 0 ? 'dates' : 'weekdays',
            dates: constraint.timeCapDates,
            weekdays: constraint.timeCapWeekdays,
            maxSessionMinutes: constraint.maxSessionMinutes,
            sourceActor: 'system',
            sourceSurface,
            now: constraint.lastUpdatedAt,
          })
        : createTemporaryScheduleFact({
            observedDate: constraint.startDate,
            scope,
            scheduleKind: constraint.scheduleKind === 'travel'
              ? 'travel'
              : constraint.maxSessionsThisWeek !== undefined
                ? 'max_sessions'
                : (constraint.unavailableDates?.length ?? 0) > 0
                  ? 'unavailable_dates'
                  : (constraint.unavailableWeekdays?.length ?? 0) > 0
                    ? 'unavailable_weekdays'
                    : 'busy_week',
            unavailableDates: constraint.unavailableDates ?? constraint.linkedOverrideDates,
            unavailableWeekdays: constraint.unavailableWeekdays,
            maxSessions: constraint.maxSessionsThisWeek,
            sourceActor: 'system',
            sourceSurface,
            now: constraint.lastUpdatedAt,
          });
      fact.legacyMigrationStatus = 'legacy_after_state_only';
      if (!seen.has(fact.factId)) {
        migrated.push(fact);
        seen.add(fact.factId);
      }
      continue;
    }
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
  for (const constraint of args.availabilityConstraints ?? []) {
    if (constraint.scope !== 'temporary' || constraint.active === false) continue;
    if (constraint.kind === 'time_limit' &&
      (!constraint.maxSessionMinutes || constraint.maxSessionMinutes < 10)) continue;
    const from = (constraint.startDate ?? new Date().toISOString()).slice(0, 10);
    const until = (constraint.endDate ?? from).slice(0, 10);
    const scope = temporaryFactScope({ kind: 'window', from, until });
    const fact = constraint.kind === 'time_limit' && constraint.maxSessionMinutes
      ? createTemporaryTimeCapFact({
          observedDate: from,
          scope,
          targetKind: constraint.dayOfWeek ? 'weekdays' : 'all_sessions',
          weekdays: constraint.dayOfWeek ? [constraint.dayOfWeek] : [],
          maxSessionMinutes: constraint.maxSessionMinutes,
          sourceActor: 'system',
          sourceSurface,
          now: constraint.updatedAt ?? constraint.createdAt,
          factId: `temporary-source-fact:v1:legacy-profile:${constraint.id}`,
        })
      : createTemporaryScheduleFact({
          observedDate: from,
          scope,
          scheduleKind: constraint.kind === 'travel'
            ? 'travel'
            : constraint.dayOfWeek ? 'unavailable_weekdays' : 'unavailable_dates',
          unavailableDates: constraint.kind === 'travel'
            ? datesBetween(from, until)
            : [],
          unavailableWeekdays: constraint.dayOfWeek ? [constraint.dayOfWeek] : [],
          sourceActor: 'system',
          sourceSurface,
          now: constraint.updatedAt ?? constraint.createdAt,
          factId: `temporary-source-fact:v1:legacy-profile:${constraint.id}`,
        });
    fact.legacyMigrationStatus = 'legacy_after_state_only';
    if (!seen.has(fact.factId)) {
      migrated.push(fact);
      seen.add(fact.factId);
    }
  }
  return normalizeTemporarySourceFacts({ value: migrated });
}

function datesBetween(from: string, until: string): string[] {
  const dates: string[] = [];
  let cursor = from.slice(0, 10);
  while (cursor <= until.slice(0, 10) && dates.length < 370) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}
