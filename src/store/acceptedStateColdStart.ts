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
  exposureContractsByWeek: Record<string, WeeklyExposureContract>;
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
  return {
    markedDays: normalizeAcceptedKeyedMap<CalendarDayType>(value?.markedDays),
    readinessSignalsByDate: normalizeAcceptedKeyedMap<ReadinessSignal>(
      value?.readinessSignalsByDate,
    ),
    activeConstraints: normalizeAcceptedArray<ActiveConstraint>(value?.activeConstraints),
    activeInjury: isObjectRecord(value?.activeInjury)
      ? value.activeInjury
      : null,
    revision,
    lastTransaction: typeof value?.lastTransaction === 'string'
      ? value.lastTransaction
      : null,
  };
}

export function normalizeAcceptedProgramSurfaces(
  value: Partial<AcceptedProgramSurfaceSnapshot> | null | undefined,
): AcceptedProgramSurfaceSnapshot {
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
    userRemovalConstraints: normalizeAcceptedArray<UserRemovalConstraint>(
      value?.userRemovalConstraints,
    ),
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
    exposureContractsByWeek: describe(args.program?.exposureContractsByWeek),
    acceptedMaterialContext: describe(args.context),
    markedDays: describe(args.context?.markedDays),
    readinessSignalsByDate: describe(args.context?.readinessSignalsByDate),
    activeConstraints: describe(args.context?.activeConstraints),
    activeInjury: describe(args.context?.activeInjury),
  };
}
