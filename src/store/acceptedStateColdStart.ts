import type {
  Microcycle,
  OverrideContext,
  TrainingProgram,
  UserRemovalConstraint,
  WeekScopedWorkoutOverlay,
  Workout,
} from '../types/domain';
import type { StoredProgramBlockState } from '../utils/programBlockState';
import type { WeeklyExposureContract } from '../rules/weeklyExposureContract';
import type { CalendarDayType } from './calendarStore';
import type { ReadinessSignal } from '../utils/readiness';
import type { ActiveConstraint } from './coachUpdatesStore';
import type { InjuryState } from '../utils/injuryProgression';
import {
  type InjuryEpisodeV1,
} from '../rules/injuryEpisode';
import {
  composeTemporarySourceFactCompatibility,
  normalizeTemporarySourceFacts,
  type TemporarySourceFact,
} from '../rules/temporarySourceFact';
import {
  normalizeReversibleAdjustmentLedger,
  type ReversibleAdjustmentLedger,
} from '../rules/reversibleAdjustmentLedger';

/**
 * The canonical empty/unknown accepted-state contract.
 *
 * This module is deliberately pure and imports store/domain values as types
 * only. ProgramStore persistence and the accepted-state coordinator can both
 * use it without creating another store-initialisation cycle.
 */
export interface AcceptedMaterialContext {
  markedDays: Record<string, CalendarDayType>;
  readinessSignalsByDate: Record<string, ReadinessSignal>;
  activeConstraints: ActiveConstraint[];
  activeInjury: InjuryState | null;
  /** Canonical temporary-injury source facts. Resolved episodes remain here. */
  injuryEpisodes: InjuryEpisodeV1[];
  /** Canonical temporary health source facts. Compatibility fields are derived. */
  temporarySourceFacts: TemporarySourceFact[];
  /** Mutable accepted base before active temporary facts are visibly composed. */
  acceptedCompositionBase: AcceptedCompositionBaseV1 | null;
  revision: number;
  lastTransaction: string | null;
}

export interface AcceptedProgramSurfaceSnapshot {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  todayWorkout: Workout | null;
  blockState: StoredProgramBlockState | null;
  dateOverrides: Record<string, Workout>;
  overrideContexts: Record<string, OverrideContext>;
  weekScopedOverlays: Record<string, WeekScopedWorkoutOverlay>;
  userRemovalConstraints: UserRemovalConstraint[];
  reversibleAdjustmentLedger: ReversibleAdjustmentLedger;
  exposureContractsByWeek: Record<string, WeeklyExposureContract>;
}

export const ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION = 1 as const;

export interface AcceptedCompositionBaseV1 {
  protocolVersion: typeof ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION;
  capturedAt: string;
  updatedAt: string;
  sourceRevision: number;
  provenance: 'accepted_pre_injury' | 'legacy_after_state_only';
  /**
   * Exact accepted mutable surfaces. ProgramStore publishes the same values;
   * temporary health facts are composed only at the visible read/verification boundary.
   */
  surfaces: AcceptedProgramSurfaceSnapshot;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeAcceptedKeyedMap<T>(value: unknown): Record<string, T> {
  return isObjectRecord(value)
    ? value as Record<string, T>
    : {};
}

export function normalizeAcceptedArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function createEmptyAcceptedMaterialContext(): AcceptedMaterialContext {
  return {
    markedDays: {},
    readinessSignalsByDate: {},
    activeConstraints: [],
    activeInjury: null,
    injuryEpisodes: [],
    temporarySourceFacts: [],
    acceptedCompositionBase: null,
    revision: 0,
    lastTransaction: null,
  };
}

export function normalizeAcceptedMaterialContext(
  value: Partial<AcceptedMaterialContext> | null | undefined,
): AcceptedMaterialContext {
  const revision = typeof value?.revision === 'number' && Number.isFinite(value.revision)
    ? Math.max(0, Math.trunc(value.revision))
    : 0;
  const temporarySourceFacts = normalizeTemporarySourceFacts({
    value: value?.temporarySourceFacts,
    legacyInjuryEpisodes: value?.injuryEpisodes,
  });
  const compatibility = temporarySourceFacts.length > 0
    ? composeTemporarySourceFactCompatibility({
        temporarySourceFacts,
        activeConstraints: normalizeAcceptedArray<ActiveConstraint>(value?.activeConstraints),
        readinessSignalsByDate: normalizeAcceptedKeyedMap<ReadinessSignal>(value?.readinessSignalsByDate),
      })
    : {
        injuryEpisodes: [],
        activeConstraints: normalizeAcceptedArray<ActiveConstraint>(value?.activeConstraints),
        activeInjury: isObjectRecord(value?.activeInjury) ? value.activeInjury : null,
        readinessSignalsByDate: normalizeAcceptedKeyedMap<ReadinessSignal>(value?.readinessSignalsByDate),
      };
  const rawBase = value?.acceptedCompositionBase;
  const acceptedCompositionBase = isObjectRecord(rawBase) &&
    rawBase.protocolVersion === ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION &&
    isObjectRecord(rawBase.surfaces)
    ? {
        protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
        capturedAt: typeof rawBase.capturedAt === 'string'
          ? rawBase.capturedAt
          : new Date(0).toISOString(),
        updatedAt: typeof rawBase.updatedAt === 'string'
          ? rawBase.updatedAt
          : typeof rawBase.capturedAt === 'string'
            ? rawBase.capturedAt
            : new Date(0).toISOString(),
        sourceRevision: typeof rawBase.sourceRevision === 'number'
          ? Math.max(0, Math.trunc(rawBase.sourceRevision))
          : 0,
        provenance: rawBase.provenance === 'legacy_after_state_only'
          ? 'legacy_after_state_only' as const
          : 'accepted_pre_injury' as const,
        surfaces: normalizeAcceptedProgramSurfaces(rawBase.surfaces),
      }
    : null;
  return {
    markedDays: normalizeAcceptedKeyedMap<CalendarDayType>(value?.markedDays),
    readinessSignalsByDate: compatibility.readinessSignalsByDate,
    activeConstraints: compatibility.activeConstraints,
    activeInjury: compatibility.activeInjury,
    injuryEpisodes: compatibility.injuryEpisodes,
    temporarySourceFacts,
    acceptedCompositionBase,
    revision,
    lastTransaction: typeof value?.lastTransaction === 'string'
      ? value.lastTransaction
      : null,
  };
}

export function normalizeAcceptedProgramSurfaces(
  value: Partial<AcceptedProgramSurfaceSnapshot> | null | undefined,
): AcceptedProgramSurfaceSnapshot {
  const userRemovalConstraints = normalizeAcceptedArray<UserRemovalConstraint>(
    value?.userRemovalConstraints,
  );
  return {
    currentProgram: isObjectRecord(value?.currentProgram)
      ? value.currentProgram
      : null,
    currentMicrocycle: isObjectRecord(value?.currentMicrocycle)
      ? value.currentMicrocycle
      : null,
    todayWorkout: isObjectRecord(value?.todayWorkout)
      ? value.todayWorkout
      : null,
    blockState: isObjectRecord(value?.blockState)
      ? value.blockState
      : null,
    dateOverrides: normalizeAcceptedKeyedMap<Workout>(value?.dateOverrides),
    overrideContexts: normalizeAcceptedKeyedMap<OverrideContext>(value?.overrideContexts),
    weekScopedOverlays: normalizeAcceptedKeyedMap<WeekScopedWorkoutOverlay>(
      value?.weekScopedOverlays,
    ),
    userRemovalConstraints,
    reversibleAdjustmentLedger: normalizeReversibleAdjustmentLedger({
      value: value?.reversibleAdjustmentLedger,
    }),
    exposureContractsByWeek: normalizeAcceptedKeyedMap<WeeklyExposureContract>(
      value?.exposureContractsByWeek,
    ),
  };
}

export function acceptedStatePresenceSummary(args: {
  program?: Partial<AcceptedProgramSurfaceSnapshot> | null;
  context?: Partial<AcceptedMaterialContext> | null;
}): Record<string, string> {
  const describe = (value: unknown): string => {
    if (Array.isArray(value)) return `array:${value.length}`;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return `object:${Object.keys(value).length}`;
    return typeof value;
  };
  return {
    currentProgram: describe(args.program?.currentProgram),
    currentMicrocycle: describe(args.program?.currentMicrocycle),
    todayWorkout: describe(args.program?.todayWorkout),
    blockState: describe(args.program?.blockState),
    dateOverrides: describe(args.program?.dateOverrides),
    overrideContexts: describe(args.program?.overrideContexts),
    weekScopedOverlays: describe(args.program?.weekScopedOverlays),
    reversibleAdjustmentLedger: describe(args.program?.reversibleAdjustmentLedger),
    exposureContractsByWeek: describe(args.program?.exposureContractsByWeek),
    acceptedMaterialContext: describe(args.context),
    markedDays: describe(args.context?.markedDays),
    readinessSignalsByDate: describe(args.context?.readinessSignalsByDate),
    activeConstraints: describe(args.context?.activeConstraints),
    activeInjury: describe(args.context?.activeInjury),
    injuryEpisodes: describe(args.context?.injuryEpisodes),
    temporarySourceFacts: describe(args.context?.temporarySourceFacts),
    acceptedCompositionBase: describe(args.context?.acceptedCompositionBase),
  };
}
