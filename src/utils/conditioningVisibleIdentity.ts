import type { Workout, WorkoutExercise } from '../types/domain';
import { logger } from './logger';
import { getSessionComponentRows } from './sessionComponents';

export type ConditioningStructureFamily =
  | 'continuous_aerobic'
  | 'long_aerobic_intervals'
  | 'short_aerobic_intervals'
  | 'tempo_intervals'
  | 'aerobic_flush'
  | 'recovery_conditioning'
  | 'hard_intervals'
  | 'speed_conditioning'
  | 'aerobic_conditioning';

export interface ConditioningVisibleIdentity {
  structureFamily: ConditioningStructureFamily;
  primaryLabel: string;
  attachedLabel: string;
  doseLabel?: string;
}

/** One threshold owns the long/short aerobic interval boundary. */
export const LONG_AEROBIC_INTERVAL_MIN_SECONDS = 3 * 60;

type ConditioningIdentityWorkout = Partial<Workout> & {
  exercises?: WorkoutExercise[] | null;
};

interface WorkStructure {
  boutCount?: number;
  boutSeconds?: number;
  continuousSeconds?: number;
  intervalised: boolean;
  structured: boolean;
}

export const CONDITIONING_VISIBLE_LABELS: Readonly<Record<ConditioningStructureFamily, string>> = {
  continuous_aerobic: 'Continuous Aerobic',
  long_aerobic_intervals: 'Long Aerobic Intervals',
  short_aerobic_intervals: 'Short Aerobic Intervals',
  tempo_intervals: 'Tempo Intervals',
  aerobic_flush: 'Aerobic Flush',
  recovery_conditioning: 'Recovery Conditioning',
  hard_intervals: 'Hard Intervals',
  speed_conditioning: 'Speed Conditioning',
  aerobic_conditioning: 'Aerobic Conditioning',
};

const WARMUP_COOLDOWN = /\b(?:warm[-\s]?up|cool[-\s]?down|cooldown)\b/i;
const EXPLICIT_FLUSH = /\b(?:aerobic\s+flush|flush(?:\s+out)?)\b/i;
const EXPLICIT_RECOVERY = /\b(?:recovery\s+(?:conditioning|pace|work)|recovery-oriented)\b/i;

function rowId(row: any): string {
  return String(row?.id ?? row?.exerciseId ?? row?.exercise?.id ?? '').trim();
}

function rowText(row: any): string {
  return [row?.exercise?.name, row?.exercise?.description, row?.notes]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMeaningfulWorkRow(row: WorkoutExercise): boolean {
  return !WARMUP_COOLDOWN.test(rowText(row));
}

function optionRows(workout: ConditioningIdentityWorkout): WorkoutExercise[] {
  const rows = (workout.exercises ?? []) as WorkoutExercise[];
  const firstOption = workout.conditioningBlock?.options?.[0];
  const ids = new Set((firstOption?.exerciseIds ?? []).map(String).filter(Boolean));
  if (ids.size > 0) {
    return rows.filter((row) => ids.has(rowId(row)));
  }
  return getSessionComponentRows(workout).conditioningRows as WorkoutExercise[];
}

/** Final conditioning rows owned by the canonical block, without preparation/recovery rows. */
export function getMeaningfulConditioningWorkRows(
  workout: ConditioningIdentityWorkout,
): WorkoutExercise[] {
  return optionRows(workout).filter(isMeaningfulWorkRow);
}

function hasCanonicalConditioning(workout: ConditioningIdentityWorkout): boolean {
  return !!workout.conditioningBlock?.options?.length ||
    !!workout.conditioningCategory ||
    !!workout.conditioningFlavour ||
    // Legacy and user-authored standalone conditioning may pre-date the
    // typed block fields. The explicit workout domain plus final owned rows
    // is still sufficient to derive identity without trusting display copy.
    (workout.workoutType === 'Conditioning' && (workout.exercises?.length ?? 0) > 0);
}

function unitSeconds(value: number, unit: string): number {
  return /^m/i.test(unit) ? value * 60 : value;
}

function parsedRepeatedDose(text: string): Pick<WorkStructure, 'boutCount' | 'boutSeconds'> | null {
  const match = text.match(
    /\b(\d+)\s*(?:x|×)\s*\(?\s*(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|mins?|sec(?:ond)?s?|secs?|s)\b/i,
  );
  if (!match) return null;
  const count = Number(match[1]);
  const duration = Number(match[2]);
  if (!Number.isFinite(count) || count < 2 || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  return { boutCount: count, boutSeconds: unitSeconds(duration, match[3]) };
}

function typedDurationSeconds(row: WorkoutExercise): number | undefined {
  const min = Number(row.prescribedRepsMin);
  const max = Number(row.prescribedRepsMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || min !== max) return undefined;
  if (row.prescriptionType === 'duration_minutes') return min * 60;
  if (row.prescriptionType === 'duration') return min;
  return undefined;
}

function textDurationSeconds(text: string): number | undefined {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|mins?|sec(?:ond)?s?|secs?)\b/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? unitSeconds(value, match[2]) : undefined;
}

function structureForRow(row: WorkoutExercise): WorkStructure {
  const text = rowText(row);
  const repeated = parsedRepeatedDose(text);
  const prescribedSets = Number(row.prescribedSets);
  const setCount = Number.isFinite(prescribedSets) && prescribedSets > 1
    ? prescribedSets
    : undefined;
  const duration = repeated?.boutSeconds ?? typedDurationSeconds(row) ?? textDurationSeconds(text);
  const boutCount = repeated?.boutCount ?? setCount;
  const intervalised = !!boutCount && boutCount > 1;
  return {
    boutCount,
    boutSeconds: intervalised ? duration : undefined,
    continuousSeconds: intervalised ? undefined : duration,
    intervalised,
    structured: intervalised || !!duration,
  };
}

function mainStructure(rows: WorkoutExercise[]): WorkStructure {
  const candidates = rows.map(structureForRow);
  return candidates.sort((a, b) => {
    const score = (value: WorkStructure) =>
      (value.intervalised ? 100 : 0) +
      (value.structured ? 10 : 0) +
      (value.boutCount ?? 0);
    return score(b) - score(a);
  })[0] ?? { intervalised: false, structured: false };
}

function formatDuration(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  if (seconds >= 60) return `${Number((seconds / 60).toFixed(1))} min`;
  return `${seconds} sec`;
}

function doseLabel(
  family: ConditioningStructureFamily,
  structure: WorkStructure,
): string | undefined {
  if (structure.intervalised && structure.boutCount && structure.boutSeconds) {
    return `${structure.boutCount} × ${formatDuration(structure.boutSeconds)}`;
  }
  if (!structure.intervalised && structure.continuousSeconds) {
    const suffix = family === 'aerobic_flush' || family === 'recovery_conditioning'
      ? 'easy'
      : 'steady';
    return `${formatDuration(structure.continuousSeconds)} ${suffix}`;
  }
  return undefined;
}

function identity(
  family: ConditioningStructureFamily,
  structure: WorkStructure,
): ConditioningVisibleIdentity {
  const label = CONDITIONING_VISIBLE_LABELS[family];
  const dose = doseLabel(family, structure);
  return {
    structureFamily: family,
    primaryLabel: label,
    attachedLabel: label,
    ...(dose ? { doseLabel: dose } : {}),
  };
}

function typedPurpose(workout: ConditioningIdentityWorkout):
  | 'speed'
  | 'hard'
  | 'tempo'
  | 'aerobic'
  | null {
  switch (workout.conditioningCategory) {
    case 'sprint': return 'speed';
    case 'vo2':
    case 'glycolytic': return 'hard';
    case 'tempo': return 'tempo';
    case 'aerobic_base': return 'aerobic';
    default: break;
  }
  switch (workout.conditioningBlock?.intent ?? workout.conditioningFlavour) {
    case 'high-intensity': return 'hard';
    case 'tempo': return 'tempo';
    case 'aerobic': return 'aerobic';
    default: return null;
  }
}

function rowPurposeText(rows: WorkoutExercise[]): string {
  return rows.map(rowText).join(' ');
}

function familyFromAerobicStructure(structure: WorkStructure): ConditioningStructureFamily {
  if (!structure.intervalised && structure.continuousSeconds) return 'continuous_aerobic';
  if (structure.intervalised && structure.boutSeconds) {
    return structure.boutSeconds >= LONG_AEROBIC_INTERVAL_MIN_SECONDS
      ? 'long_aerobic_intervals'
      : 'short_aerobic_intervals';
  }
  return 'aerobic_conditioning';
}

function diagnoseCanonicalFallback(
  workout: ConditioningIdentityWorkout,
  rows: WorkoutExercise[],
): void {
  if (process.env.NODE_ENV === 'production' || rows.length === 0) return;
  logger.warn('[conditioning-visible-identity] canonical_structured_fallback', {
    workoutId: workout.id,
    planEntryId: workout.planEntryId,
    rowIds: rows.map(rowId),
  });
}

/**
 * The single canonical owner of visible conditioning identity.
 *
 * Typed purpose wins first. Structure is then read only from final rows owned
 * by the conditioning component; modality and surrounding workout copy never
 * participate in the result.
 */
export function projectConditioningVisibleIdentity(
  workout: ConditioningIdentityWorkout | null | undefined,
): ConditioningVisibleIdentity | null {
  if (!workout || !hasCanonicalConditioning(workout)) return null;

  const rows = getMeaningfulConditioningWorkRows(workout);
  const structure = mainStructure(rows);
  const purpose = typedPurpose(workout);
  const purposeText = rowPurposeText(rows);

  if (purpose === 'speed') return identity('speed_conditioning', structure);
  if (purpose === 'hard') return identity('hard_intervals', structure);
  if (purpose === 'tempo') return identity('tempo_intervals', structure);

  // Flush/recovery are purpose distinctions not yet represented by the
  // ConditioningBlock intent union. Read them only from the final owned work
  // rows (or an explicit recovery session type), never from modality/name copy.
  if (EXPLICIT_FLUSH.test(purposeText)) {
    return identity('aerobic_flush', structure);
  }
  if (
    EXPLICIT_RECOVERY.test(purposeText) || workout.sessionTier === 'recovery'
  ) {
    return identity('recovery_conditioning', structure);
  }

  // An untyped standalone conditioning workout may use final effective
  // intensity as the last typed purpose signal. Attached strength intensity is
  // deliberately excluded because it describes the whole mixed session.
  if (
    !purpose &&
    !workout.hasCombinedConditioning &&
    (workout.intensity === 'High' || workout.intensity === 'Maximal')
  ) {
    return identity('hard_intervals', structure);
  }

  const family = familyFromAerobicStructure(structure);
  if (family === 'aerobic_conditioning') diagnoseCanonicalFallback(workout, rows);
  return identity(family, structure);
}
