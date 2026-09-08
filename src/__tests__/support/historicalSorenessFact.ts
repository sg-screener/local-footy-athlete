/** Historical read-compatibility fixture. No production writer exists. */
import { TEMPORARY_SOURCE_FACT_PROTOCOL_VERSION, stableTemporarySourceFactId, type TemporarySourceFactScope, type TemporaryAthleteReportedLevel, type TemporarySourceFactActor, type TemporarySourceFactSurface, type TemporarySorenessFact } from '../../rules/temporarySourceFact';
import type { InjuryState } from '../../utils/injuryProgression';
export function historicalSorenessFact(args: {
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

