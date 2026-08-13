import {
  readinessTierForSeverity,
  resolveReadinessDirective,
} from './readinessIllnessLaw';
import type { IllnessSeverityTier } from './readinessIllnessLaw';
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
// The single duration owner. This module STORES the bounds; it never decides
// what they mean. `durableFactHorizon` imports only types from here, so there
// is no cycle.
import {
  factHorizonCoversDate,
  factHorizonHasElapsed,
} from './durableFactHorizon';
import {
  severityHasModerateEffect,
  severityIsLimiting,
  severityIsRecordOnly,
} from './injurySeverityBands';

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

/**
 * `kind: 'open'` with `until: null` is how a DURABLE STATE fact says "true
 * until the athlete clears it". Before Stage 1 that had no representation, so
 * `status: 'active'` and a calendar-expired `effectiveUntil` could disagree
 * about the same fact. `durableFactHorizon` is the only module that decides
 * what these bounds mean.
 */
export interface TemporarySourceFactScope {
  kind: 'date' | 'week' | 'window' | 'open';
  date?: string;
  weekStart?: string;
  from: string;
  until: string | null;
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
  /** `null` = open, until the athlete resolves it. Read via `factHorizon`. */
  effectiveUntil: string | null;
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

/**
 * Illness ("under the weather") — a SIBLING health fact, not a variant of injury
 * or fatigue.
 *
 * Severity is THE ILLNESS LAW's tier, imported rather than re-declared. This
 * interface used to carry its own binary `'minor' | 'severe'` union — a second
 * illness vocabulary beside the law's three tiers, and one with no room for
 * MODERATE, so a flu-level illness had nowhere to be stored. One vocabulary now,
 * so the two cannot drift.
 *
 * The inert/deriving boundary is unchanged and still the shared health-fact one:
 * the tier is carried by `athleteReportedLevel` through `projectionScore`, with
 * mild below 4 (INERT — record-only; a light sniffle merely records, and any
 * adjustment is opt-in via the "soften today?" offer) and moderate/severe at or
 * above it (DERIVING). What each deriving tier DOES is the law's answer, not
 * this file's.
 */
export interface TemporaryIllnessFact extends TemporarySourceFactBase<'illness'> {
  severity: IllnessSeverityTier;
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
  | 'max_sessions'
  /**
   * "Team training is on <target day> instead of <usual day>, for the week of
   * <date>" — the one-off half of Sam's team-night movability ruling (signed
   * 2026-08-02). A DERIVING fact: its ruled effect relocates the team anchor
   * within its week (doubling law: the anchor lands COMBINED on an occupied
   * day; the vacated day re-derives) and resolving it cascade-reverts clean.
   */
  | 'team_night_move'
  /**
   * "There is no team training between these dates" — SEAT_INBOX item 31 part
   * 5, Sam 2026-08-13: *"it may be helpful to add a button for Christmas break
   * and removing team training sessions from the app … an athlete can select
   * when their last team training is, and then around the 3rd of Jan they
   * should be ask when does team training go back? that way the app isn't
   * guessing"*.
   *
   * **IT IS NOT `travel`, AND THE DIFFERENCE IS A FIXTURE.** Away removes the
   * club night AND the game, because the athlete is not there —
   * ***"OBVIOUSLY YOU'RE NOT GOING TO BE THERE"***. Over the Christmas break he
   * is HOME; the club is shut. A fixture he typed in himself inside that span
   * is a fact about his own calendar and stays. Reusing `travel` would have
   * deleted it, which is why this is its own kind rather than a second surface
   * writing the same word.
   *
   * **ITS `until` IS ALLOWED TO BE OPEN, and that is the ruling rather than an
   * oversight.** The December question knows when the break STARTS and nothing
   * else; the January question is what closes it. An invented end date is the
   * one thing Sam ruled out.
   */
  | 'no_team_training';

export interface TemporaryScheduleFact extends TemporarySourceFactBase<'schedule'> {
  scheduleKind: TemporaryScheduleFactKind;
  unavailableDates: string[];
  unavailableWeekdays: DayOfWeek[];
  maxSessions: number | null;
  /** `team_night_move` only: the dated pair the fact states. Null otherwise. */
  teamNightFromDate: string | null;
  teamNightToDate: string | null;
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
  | TemporaryPoorSleepFact
  | TemporaryIllnessFact;

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

// Sam's 13 authored injury regions (2026-07-28). adductor + pubalgia merged into
// groin; ankle/wrist widened; hip, quad, neck and ribs added.
const CANONICAL_BODY_PART_BUCKETS = new Set<NonNullable<InjuryState['bucket']>>([
  'groin',
  'hip',
  'quad',
  'hamstring',
  'knee',
  'calf',
  'ankle/foot',
  'ribs',
  'lowerBack',
  'neck',
  'shoulder',
  'elbow',
  'wrist/hand',
]);

function canonicalBodyPartBucket(value: unknown): InjuryState['bucket'] | null {
  return typeof value === 'string' &&
    CANONICAL_BODY_PART_BUCKETS.has(value as NonNullable<InjuryState['bucket']>)
    ? value as NonNullable<InjuryState['bucket']>
    : null;
}

function normalizeScope(
  value: unknown,
  from: string,
  until: string | null,
): TemporarySourceFactScope {
  const raw = isRecord(value) ? value : {};
  const kind = raw.kind === 'week' || raw.kind === 'window' || raw.kind === 'open'
    ? raw.kind
    : 'date';
  return {
    kind,
    ...(kind === 'date' ? { date: isoDate(raw.date) ?? from } : {}),
    ...(kind === 'week' ? { weekStart: isoDate(raw.weekStart) ?? from } : {}),
    from: isoDate(raw.from) ?? from,
    // An OPEN scope has no end. `isoDate(undefined) ?? until` would silently
    // re-close a hydrated open fact, which is the exact truncation Stage 1
    // removed, so open-ness is preserved explicitly.
    until: kind === 'open' ? null : isoDate(raw.until) ?? until,
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
  'bike_erg',
  'air_bike',
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

/**
 * Hydrate a stored illness severity into the law's tier.
 *
 * Facts written before THE THREE SICK DOORS carry the old binary vocabulary.
 * Sam's migration ruling: `minor` → MILD and `severe` → SEVERE. NOT severe →
 * moderate — the old `severe` is exactly what drove the optional-sessions week
 * mode, which is what the new SEVERE tier does, so remapping it would silently
 * downgrade a bed-bound athlete's stored record to flu. MODERATE is new and has
 * no historical producer; nothing stored is reinterpreted, and no data is
 * invented. Anything unrecognised falls back to the INERT tier, so a corrupt
 * value can never derive a program change.
 */
function normalizeIllnessSeverity(value: unknown): IllnessSeverityTier {
  if (value === 'severe') return 'severe';
  if (value === 'moderate') return 'moderate';
  // 'mild' (current) and 'minor' (legacy) are the same tier.
  return 'mild';
}

function normalizeNonInjuryFact(value: unknown): NonInjuryTemporarySourceFact | null {
  if (!isRecord(value) || typeof value.factId !== 'string') return null;
  if (value.factKind !== 'fatigue' && value.factKind !== 'soreness' &&
    value.factKind !== 'poor_sleep' && value.factKind !== 'illness' &&
    value.factKind !== 'equipment' &&
    value.factKind !== 'schedule' && value.factKind !== 'time_cap') {
    return null;
  }
  const observedDate = isoDate(value.observedDate);
  const effectiveFrom = isoDate(value.effectiveFrom) ?? observedDate;
  // An OPEN fact hydrates back as open. `?? effectiveFrom` would re-close it to
  // a single day, quietly resurrecting the truncation Stage 1 removed — so
  // open-ness is read from the persisted scope, not inferred from a missing end.
  const persistedOpen = isRecord(value.scope) && value.scope.kind === 'open';
  const effectiveUntil = persistedOpen
    ? null
    : isoDate(value.effectiveUntil) ?? effectiveFrom;
  if (!observedDate || !effectiveFrom || (!persistedOpen && !effectiveUntil)) return null;
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
  if (value.factKind === 'illness') {
    return {
      ...base,
      factKind: 'illness',
      severity: normalizeIllnessSeverity(value.severity),
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
      value.scheduleKind === 'max_sessions' ||
      value.scheduleKind === 'team_night_move' ||
      value.scheduleKind === 'no_team_training'
        ? value.scheduleKind
        : 'unavailable_dates';
    const rawMax = typeof value.maxSessions === 'number' && Number.isFinite(value.maxSessions)
      ? Math.max(0, Math.min(14, Math.trunc(value.maxSessions)))
      : null;
    const teamNightFromDate = isoDate(value.teamNightFromDate);
    const teamNightToDate = isoDate(value.teamNightToDate);
    // A team-night move without its dated pair states nothing — a corrupt
    // hydration must never derive an anchor relocation, so it does not exist.
    if (scheduleKind === 'team_night_move' && (!teamNightFromDate || !teamNightToDate)) {
      return null;
    }
    return {
      ...base,
      factKind: 'schedule',
      scheduleKind,
      unavailableDates: normalizeDates(value.unavailableDates),
      unavailableWeekdays: normalizeWeekdays(value.unavailableWeekdays),
      maxSessions: rawMax,
      teamNightFromDate: scheduleKind === 'team_night_move' ? teamNightFromDate : null,
      teamNightToDate: scheduleKind === 'team_night_move' ? teamNightToDate : null,
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
      fact.factKind === 'poor_sleep' || fact.factKind === 'illness');
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
  // ORDER IS ARRIVAL ORDER, NOT ALPHABETICAL (Sam's D-3 ruling, 2026-08-05).
  //
  // This used to `.sort()` by `temporarySourceFactId`. Ids begin with the fact
  // KIND, so that sort was a hidden ranking — fatigue before illness before
  // poor_sleep before soreness — and `find()`-style readers downstream turned
  // it into "which fact is the fact for this day". Nobody authored that
  // ordering; it fell out of a string prefix chosen for id stability, and it
  // decided an athlete-visible undo link. Sam: "the athlete's tap is the
  // decision; the guess dies."
  //
  // A Map preserves insertion order, so the result is still fully
  // deterministic — it is now the order the facts arrived in, which is the
  // order the athlete authored them. NOTHING may read position as priority:
  // `selectReadinessFactForDate` is the one owner of that question.
  return Array.from(byId.values());
}

export function activeTemporarySourceFacts(
  facts: readonly TemporarySourceFact[],
  onDate?: string,
): TemporarySourceFact[] {
  return facts.filter((fact) => {
    if (isInjurySourceFact(fact)) return fact.status === 'active' || fact.status === 'improving';
    if (fact.status !== 'active') return false;
    return !onDate || factHorizonCoversDate(fact, onDate);
  });
}

/** The readiness family: the kinds the "Not 100% today" sheet can author. */
export const READINESS_FACT_KINDS: ReadonlySet<string> =
  new Set(['fatigue', 'soreness', 'poor_sleep', 'illness']);

/**
 * WHICH READINESS FACT IS *THE* FACT FOR THIS DAY — the one owner.
 *
 * Sam's D-3 ruling, 2026-08-05. Two surfaces used to answer this differently:
 * the lighter-day trim took the first match in an ALPHABETICALLY sorted array
 * (so fatigue outranked illness by byte order), while the readiness card
 * preferred a today-scoped fact and otherwise took position zero. With an open
 * `cooked` window and today's `illness_mild` tap both active, the card's Clear
 * resolved the illness while the trim was linked to the fatigue — so the
 * athlete cleared what they reported, read "Cleared — today's back to its
 * original session", and the day stayed trimmed. One owner, so that cannot
 * happen.
 *
 * THE RULE, and every part of it is a decision the athlete made:
 *   1. a TODAY-SCOPED fact wins — they said "today", and this is today;
 *   2. otherwise the most recently UPDATED one — their latest word on it;
 *   3. only for an exact timestamp tie, the id, purely so the answer is
 *      total. That is a stability tie-break, NOT a priority: no kind outranks
 *      another here, and Sam explicitly declined to author a kind ladder.
 *
 * NOT A REPLACEMENT FOR THE TAP. When the athlete has just authored a fact,
 * that id travels with the offer and this function is not consulted at all —
 * a stored decision always beats a derived one.
 */
export function selectReadinessFactForDate(args: {
  readonly facts: readonly TemporarySourceFact[];
  readonly dateISO: string;
  /** When given, a fact scoped to exactly this date is preferred. */
  readonly todayISO?: string;
}): TemporarySourceFact | null {
  const candidates = args.facts.filter((fact): fact is NonInjuryTemporarySourceFact =>
    !isInjurySourceFact(fact)
    && fact.status === 'active'
    && 'factKind' in fact
    && READINESS_FACT_KINDS.has((fact as { factKind: string }).factKind)
    && factHorizonCoversDate(fact, args.dateISO));
  if (candidates.length === 0) return null;

  const isTodayScoped = (fact: NonInjuryTemporarySourceFact): boolean =>
    !!args.todayISO && fact.scope.kind === 'date' && fact.scope.from === args.todayISO;

  return [...candidates].sort((left, right) => {
    const scoped = Number(isTodayScoped(right)) - Number(isTodayScoped(left));
    if (scoped !== 0) return scoped;
    const recency = String(right.updatedAt).localeCompare(String(left.updatedAt));
    if (recency !== 0) return recency;
    return temporarySourceFactId(left).localeCompare(temporarySourceFactId(right));
  })[0] ?? null;
}

export function expireTemporarySourceFacts(
  facts: readonly TemporarySourceFact[],
  onDate: string,
  now: string,
): TemporarySourceFact[] {
  return facts.map((fact) => {
    // An OPEN fact never elapses by calendar. "I'm properly sick" stops being
    // true when the athlete says so, not at midnight on Sunday — the whole
    // point of Stage 1. Only a closed window can expire.
    if (isInjurySourceFact(fact) || fact.status !== 'active' ||
      !factHorizonHasElapsed(fact, onDate)) return fact;
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

/**
 * Does a declaration at this reported level open the 7-day deload window?
 *
 * R-038: "Tired" is noted only; "Wrecked" AND "Absolutely cooked" are both
 * SEVEN DAYS DELOADED. The readiness door used to attach the window on the
 * literal `level === 'cooked'`, which gave the seven days to the top tier and
 * withheld them from the middle one — a wrecked athlete got ONE easier day.
 *
 * Asks the LAW rather than restating the ladder: `levelScore` here owns the
 * level -> severity mapping, `readinessTierForSeverity` owns severity -> tier,
 * and `resolveReadinessDirective` owns what a tier DOES.
 */
export function reportedLevelDeloads(level: TemporaryAthleteReportedLevel): boolean {
  return resolveReadinessDirective(readinessTierForSeverity(levelScore(level))).deloaded;
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

/**
 * Stable identity token for a fact's window. An open window has no end date, so
 * it contributes the literal `open` rather than a date — ids stay stable and a
 * hydrated open fact never collides with a closed one covering the same start.
 */
export function factWindowKey(fact: { effectiveFrom: string; effectiveUntil: string | null }): string {
  return `${fact.effectiveFrom}:${fact.effectiveUntil ?? 'open'}`;
}

function factConstraintMetadata(facts: readonly TemporaryHealthFact[]) {
  const updated = facts.map((fact) => fact.updatedAt).sort();
  // One open fact makes the composed constraint open: it cannot expire on a
  // calendar date while the athlete still has the condition.
  const anyOpen = facts.some((fact) => fact.effectiveUntil === null);
  const expires = facts
    .map((fact) => fact.effectiveUntil)
    .filter((value): value is string => value !== null)
    .sort();
  return {
    temporarySourceFactIds: facts.map((fact) => fact.factId).sort(),
    startDate: facts.map((fact) => fact.effectiveFrom).sort()[0],
    lastUpdatedAt: updated[updated.length - 1],
    ...(anyOpen || expires.length === 0
      ? {}
      : { expiresAt: expires[expires.length - 1] }),
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
  if (severityIsRecordOnly(severity)) return null;
  const dateScoped = facts.every((fact) => fact.scope.kind === 'date') &&
    new Set(facts.map((fact) => fact.effectiveFrom)).size === 1;
  const poorSleep = strongest.factKind === 'poor_sleep' ? strongest : null;
  return {
    id: `source-fact:global:${factWindowKey(strongest)}`,
    type: 'fatigue',
    severity,
    status: 'active',
    ...factConstraintMetadata(facts),
    reasonLabel: poorSleep
      ? poorSleep.pattern === 'repeated' ? 'Repeated poor sleep' : 'Poor sleep'
      : strongest.factKind === 'soreness' ? 'General soreness'
        : strongest.factKind === 'illness' ? 'Illness' : 'Fatigue',
    source: poorSleep ? 'readiness' : 'coach',
    ...(poorSleep ? { readinessKind: 'poor_sleep' as const, readinessPattern: poorSleep.pattern } : {}),
    // Typed discriminator so coach-note attribution never mislabels an illness as
    // fatigue ("you said you're cooked"). Illness shares the fatigue constraint
    // type for now (post-v1 cleanup gives it its own type).
    ...(strongest.factKind === 'illness' ? { readinessKind: 'illness' as const } : {}),
    ...(dateScoped ? { appliesToDate: strongest.effectiveFrom } : {}),
    ...(strongest.scope.kind === 'week' ? { weekStartISO: strongest.scope.weekStart } : {}),
    modifierAffects: [dateScoped ? 'current_day' : 'current_week'],
    rules: severityIsLimiting(severity)
      ? ['max-effort + heavy strength', 'sprinting / plyos', 'extra hard conditioning']
      : severityHasModerateEffect(severity)
        ? ['max-effort lifts', 'hard conditioning + sprints']
        : ['finishers / hard extras'],
    safeFocus: severityHasModerateEffect(severity)
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
    const key = factWindowKey(fact);
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
    const key = `${fact.canonicalBodyPartBucket}:${factWindowKey(fact)}`;
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
      id: `source-fact:soreness:${bucket}:${factWindowKey(strongest)}`,
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
      rules: severityIsLimiting(severity) ? [`avoid hard ${bodyPart} loading`] : [`keep ${bodyPart} work pain-free`],
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
    ...(fact.effectiveUntil === null ? {} : { expiresAt: fact.effectiveUntil }),
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

/**
 * THE SENTENCE READS THE FACT'S HORIZON, because the fact has one.
 *
 * A `busy_week` fact used to be week-scoped by construction, so every word here
 * could say "week" and be right. Sam's ruling 2 (2026-07-31) gave the busy door
 * the words "Short on time today" and the executor now honours a `today_only`
 * request with a `date`-kind scope — at which point "Busy week active" is a
 * sentence about a week the athlete never mentioned.
 *
 * The horizon is not re-derived here and no new stored field carries it: the
 * fact's own `scope.kind` is the whole input, and the same value already decides
 * which dates `constraintAppliesToDate` lets this constraint touch. One fact,
 * one horizon, and the copy agrees with it.
 */
function scheduleFactIsSingleDay(fact: TemporaryScheduleFact): boolean {
  return fact.scope.kind === 'date';
}

/** Weekday name for the team-night modifier copy — display only. */
function weekdayNameFor(dateISO: string): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${dateISO.slice(0, 10)}T12:00:00`).getDay()
  ];
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
      fact.scheduleKind === 'busy_week'
        ? (scheduleFactIsSingleDay(fact) ? 'Short on time' : 'Busy week')
        : fact.scheduleKind === 'team_night_move'
          ? 'Team training moved'
          : fact.scheduleKind === 'no_team_training'
            ? 'No team training'
            : 'Temporary availability',
    source: fact.sourceActor === 'coach' ? 'coach' :
      fact.sourceActor === 'system' ? 'system' : 'tap',
    temporarySourceFactIds: [fact.factId],
    ...(fact.effectiveUntil === null ? {} : { expiresAt: fact.effectiveUntil }),
    ...(fact.scope.kind === 'week' ? { weekStartISO: fact.scope.weekStart } : {}),
    scheduleKind: fact.scheduleKind,
    unavailableDates: [...fact.unavailableDates],
    unavailableWeekdays: [...fact.unavailableWeekdays],
    maxSessionsThisWeek: fact.maxSessions ?? undefined,
    teamNightFromDate: fact.teamNightFromDate ?? undefined,
    teamNightToDate: fact.teamNightToDate ?? undefined,
    modifierTitle: fact.scheduleKind === 'travel'
      ? 'Away / travel period active'
      : fact.scheduleKind === 'busy_week'
        ? (scheduleFactIsSingleDay(fact) ? 'Short on time today' : 'Busy week active')
        : fact.scheduleKind === 'team_night_move'
          ? 'Team training moved this week'
          : fact.scheduleKind === 'no_team_training'
            ? 'Team training is off'
            : 'Temporary availability active',
    // ── ITEM 28, 2026-08-13: THE SENTENCE FOLLOWS THE BEHAVIOUR ──
    // It read "Your program is avoiding the dates you are away", which was true
    // of the door that MARKED THOSE DATES UNAVAILABLE and deleted the whole
    // day. Sam ruled that away twice over: the plan keeps running on whatever
    // kit he has, and what away actually removes is club-bound work —
    // *"yes clear team training and games while away"*.
    modifierBody: fact.scheduleKind === 'travel'
      ? 'Team training and games are off while you are away. Your own sessions keep running.'
      : fact.scheduleKind === 'busy_week'
        ? (scheduleFactIsSingleDay(fact)
            ? "Today's session drops the highest-cost work. The rest of your week is untouched."
            : 'Your bounded week is being kept within the session limit you set.')
        : fact.scheduleKind === 'team_night_move'
          // PROPOSED (Batch 10 prose; parked §8): the modifier names the fact's
          // own dated pair; clearing the fact is the undo.
          ? `Team training is on ${weekdayNameFor(fact.teamNightToDate ?? fact.effectiveFrom)} instead of ${weekdayNameFor(fact.teamNightFromDate ?? fact.effectiveFrom)} this week only.`
          // ── ITEM 31 PART 5: WHAT THE BREAK DOES, AND WHAT IT LEAVES ALONE ──
          // Two sentences because the athlete has to be able to tell this apart
          // from Away at a glance. Away takes the games too; this does not.
          : fact.scheduleKind === 'no_team_training'
            ? 'Team training is off until you tell us it is back. Your own sessions and any games you added keep running.'
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
  // A SINGLE-DAY cap is the "Short on time today" door's fact since the
  // 2026-08-03 lanes (the ruled 35-minute compressed session), so it carries
  // the sentences Sam signed for that door in 6-II-e — whose body ("drops the
  // highest-cost work… rest of your week untouched") became TRUE when the cap
  // owner started cutting to essentials. Multi-day/weekday caps keep the
  // technical cap wording. One fact, one horizon, and the copy agrees with it
  // — the same rule `scheduleFactIsSingleDay` documents above.
  return facts.map((fact): ActiveScheduleConstraint => ({
    id: `source-fact:time-cap:${fact.factId}`,
    type: 'schedule',
    severity: fact.maxSessionMinutes < 20 ? 7 : 5,
    status: 'active',
    startDate: fact.effectiveFrom,
    lastUpdatedAt: fact.updatedAt,
    reasonLabel: fact.scope.kind === 'date'
      ? 'Short on time'
      : `Temporary ${fact.maxSessionMinutes}-minute cap`,
    source: fact.sourceActor === 'coach' ? 'coach' :
      fact.sourceActor === 'system' ? 'system' : 'tap',
    temporarySourceFactIds: [fact.factId],
    ...(fact.effectiveUntil === null ? {} : { expiresAt: fact.effectiveUntil }),
    ...(fact.scope.kind === 'week' ? { weekStartISO: fact.scope.weekStart } : {}),
    scheduleKind: 'time_cap',
    maxSessionMinutes: fact.maxSessionMinutes,
    timeCapDates: [...fact.dates],
    timeCapWeekdays: [...fact.weekdays],
    timeCapAllSessions: fact.targetKind === 'all_sessions',
    modifierTitle: fact.scope.kind === 'date'
      ? 'Short on time today'
      : `${fact.maxSessionMinutes}-minute session cap active`,
    modifierBody: fact.scope.kind === 'date'
      ? "Today's session drops the highest-cost work. The rest of your week is untouched."
      : 'Every targeted session is capped deterministically within the effective window.',
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
  kind: 'date' | 'week' | 'window' | 'open';
  date?: string;
  from?: string;
  until?: string;
}): TemporarySourceFactScope {
  const anchor = (args.date ?? args.from ?? new Date().toISOString()).slice(0, 10);
  // AN OPEN SCOPE WITH A CALLER-GIVEN START — item 31 part 5. `durableFactHorizon`
  // already owns the OTHER open scope (`durableStateFactScope`), and it pins the
  // start to today because a body report cannot be about a day that has not
  // happened. The Christmas break can: on the 10th the athlete states that his
  // last session is on the 18th, so the break starts on the 19th and today is
  // not a bound on it. Same open end, different start rule, so it cannot borrow
  // that function.
  if (args.kind === 'open') {
    return { kind: 'open', from: (args.from ?? anchor).slice(0, 10), until: null };
  }
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

export function createTemporaryIllnessFact(args: {
  observedDate: string;
  scope: TemporarySourceFactScope;
  severity: IllnessSeverityTier;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporaryIllnessFact {
  const now = args.now ?? new Date().toISOString();
  // The tier drives the projection score through the shared health-fact
  // threshold: mild → 'slight' (3, < 4, inert / record-only), moderate →
  // 'moderate' (5) and severe → 'high' (7), both >= 4 and therefore deriving.
  // Same boundary fatigue uses. Moderate MUST clear the threshold or the law's
  // "deloaded while the fact is active" could never fire.
  const athleteReportedLevel: TemporaryAthleteReportedLevel =
    args.severity === 'severe' ? 'high'
      : args.severity === 'moderate' ? 'moderate'
        : 'slight';
  return {
    protocolVersion: TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION,
    factId: args.factId ?? stableTemporarySourceFactId({
      factKind: 'illness', observedDate: args.observedDate, scope: args.scope,
    }),
    factKind: 'illness',
    severity: args.severity,
    status: 'active',
    observedDate: args.observedDate.slice(0, 10),
    effectiveFrom: args.scope.from,
    effectiveUntil: args.scope.until,
    scope: args.scope,
    athleteReportedLevel,
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
  /** Required when scheduleKind is 'team_night_move'; ignored otherwise. */
  teamNightFromDate?: string | null;
  teamNightToDate?: string | null;
  sourceActor?: TemporarySourceFactActor;
  sourceSurface: TemporarySourceFactSurface;
  now?: string;
  factId?: string;
}): TemporaryScheduleFact {
  const now = args.now ?? new Date().toISOString();
  const actor = args.sourceActor ?? 'athlete';
  if (args.scheduleKind === 'team_night_move' &&
    (!isoDate(args.teamNightFromDate) || !isoDate(args.teamNightToDate))) {
    throw new Error('team_night_move_requires_dated_pair');
  }
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
    teamNightFromDate: args.scheduleKind === 'team_night_move'
      ? isoDate(args.teamNightFromDate)
      : null,
    teamNightToDate: args.scheduleKind === 'team_night_move'
      ? isoDate(args.teamNightToDate)
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
              // THE BREAK SURVIVES ITS OWN ROUND TRIP. Without this arm a
              // hydrated no-team-training constraint came back as `busy_week`
              // — the club would return mid-break and nothing would say why.
              : constraint.scheduleKind === 'no_team_training'
                ? 'no_team_training'
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
            reportKind: severityIsLimiting(constraint.severity) ? 'cooked' : 'fatigue',
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
