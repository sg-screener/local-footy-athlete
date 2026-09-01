import type { ConditioningOption, Workout, WorkoutExercise } from '../types/domain';
import { logger } from './logger';
import { getSessionComponentRows } from './sessionComponents';
import {
  conditioningAthletePrescription,
  conditioningWordingForModality,
} from '../rules/conditioningDisplay';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';

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

/** P09: quality/title and the selected mode are separate, plainly named facts. */
export function conditioningModeLabel(
  modality: ConditioningOption['modality'],
  sequence?: ConditioningOption['modalitySequence'],
): string | undefined {
  if (!modality) return undefined;
  if (modality === 'mixed') {
    const names = sequence?.map(m => ({ run: 'Run', bike: 'Bike', air_bike: 'Air Bike', row: 'RowErg', ski: 'SkiErg' })[m]);
    return names?.length ? names.join(' → ') : undefined;
  }
  if (modality === 'bike' && sequence?.[0] === 'air_bike') return 'Air Bike';
  return { bike: 'Bike', row: 'RowErg', ski: 'SkiErg', running: 'Run' }[modality];
}

/** Only the typed option owning this row can label it; never parse a lift name. */
export function conditioningModeLabelForRow(workout: Partial<Workout>, id: string): string | undefined {
  const option = workout.conditioningBlock?.options.find(option => option.exerciseIds.includes(id));
  if (!option && workout.speedBlock?.exerciseIds?.includes(id)) {
    return ({ run: 'Run', bike: 'Bike', air_bike: 'Air Bike', row: 'RowErg', ski: 'SkiErg' } as const)[workout.speedBlock.modality ?? 'run'];
  }
  if (!option) return undefined;
  const selectedMode = conditioningModeLabel(option.modality, option.modalitySequence);
  if (selectedMode) return selectedMode;
  switch (workout.conditioningFeasibility?.resolvedSubstitutionFamily) {
    case 'treadmill':
    case 'outdoor_running':
      return 'Run';
    case 'hill_running_or_walking':
      return 'Run / Walk';
    case 'brisk_walking':
      return 'Walk';
    case 'bodyweight_circuit':
      return 'Bodyweight';
    case 'safe_mixed_modal':
      return 'Mixed';
    default:
      return undefined;
  }
}

/** Read-time wording follows the same typed option as the machine label.
 * Saved rows, dose, completion and selection remain untouched, including history.
 */
export function conditioningRowForDisplay<T extends { id?: string; notes?: string | null }>(workout: Partial<Workout>, row: T): T {
  const option = workout.conditioningBlock?.options.find(option => option.exerciseIds.includes(String(row.id)));
  if (option?.modality && row.notes) {
    const notes = conditioningWordingForModality(row.notes, option.modality);
    return notes === row.notes ? row : { ...row, notes };
  }
  const speedMode = workout.speedBlock?.exerciseIds?.includes(String(row.id))
    ? ({ run: 'running', bike: 'bike', air_bike: 'bike', row: 'row', ski: 'ski' } as const)[workout.speedBlock.modality ?? 'run']
    : undefined;
  if (!speedMode || !row.notes) return row;
  const notes = conditioningWordingForModality(row.notes, speedMode);
  return notes === row.notes ? row : { ...row, notes };
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
const CONDITIONING_TEMPLATE_BY_NAME = new Map(
  CONDITIONING_TEMPLATES.map((template) => [template.name, template]),
);

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

/** Repeat count from the one concrete athlete prescription, not row placeholders. */
function prescriptionBoutCount(text: string): number | undefined {
  const beforeBetween = text.split(/\bbetween\b/i)[0];
  const namedCounts = [...beforeBetween.matchAll(/\b(\d+)\s+(?:sets?|blocks?|rounds?|reps?)\b/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (namedCounts.length > 0) return namedCounts.reduce((total, value) => total * value, 1);
  // Flush copy uses `4 × 2-minute blocks`: four work bouts, each paired with
  // its stated recovery inside a two-minute block.
  const leadingMultiplier = /^\s*(\d+)\s*[×x]\s*\d+(?:\.\d+)?[-\s](?:min(?:ute)?|sec(?:ond)?)/i
    .exec(beforeBetween);
  return leadingMultiplier ? Number(leadingMultiplier[1]) : undefined;
}

/**
 * Authored conditioning rows carry numeric placeholders because the Workout
 * schema requires sets/reps. Deload and injury transforms can legitimately
 * change those placeholders; they never re-author the selected template's
 * visible dose. Resolve the same concrete athlete prescription the card uses.
 */
function authoredTemplateStructure(
  row: WorkoutExercise,
  workout: ConditioningIdentityWorkout,
): WorkStructure | null {
  const template = CONDITIONING_TEMPLATE_BY_NAME.get(String(row.exercise?.name ?? ''));
  if (!template) return null;
  const option = workout.conditioningBlock?.options
    .find((candidate) => candidate.exerciseIds.includes(rowId(row)));
  // The generated row already carries the exact week rung. Read it first so a
  // 35-minute week cannot be collapsed back to the catalogue's default rung.
  const stored = String(row.notes ?? '');
  const storedWork = /^Work:\s*(.+)$/m.exec(stored)?.[1];
  const storedCount = /^(?:Sets|Rounds|Reps|Blocks):\s*(.+)$/m.exec(stored)?.[1];
  const prescription = conditioningAthletePrescription(template, undefined, option?.modality);
  const work = storedWork ?? prescription.work;
  const countText = storedCount ?? prescription.setsRounds;
  const duration = textDurationSeconds(work);
  if (!duration) return { intervalised: false, structured: false };
  const count = prescriptionBoutCount(countText) ?? 1;
  const intervalised = count > 1 && !/\bcontinuous\b/i.test(work);
  return {
    boutCount: intervalised ? count : undefined,
    boutSeconds: intervalised ? duration : undefined,
    continuousSeconds: intervalised ? undefined : duration,
    intervalised,
    structured: true,
  };
}

function structureForRow(
  row: WorkoutExercise,
  workout: ConditioningIdentityWorkout,
): WorkStructure {
  const authored = authoredTemplateStructure(row, workout);
  if (authored) return authored;
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

function mainStructure(
  rows: WorkoutExercise[],
  workout: ConditioningIdentityWorkout,
): WorkStructure {
  const candidates = rows.map((row) => structureForRow(row, workout));
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
  | 'flush'
  | null {
  // THE RECOVERY DECISION IS TYPED, so read it before anything else. The §18
  // role is stamped by the allocator that chose to make this session light;
  // it is the same decision the flush regex below tries to recover from the
  // athlete-visible copy. Reading the role first means an authored flush
  // template that happens not to contain the word "flush" — 'Nasal-Paced
  // Easy', 'Short Flush''s siblings — still reads as flush.
  if (
    workout.section18ConditioningRole === 'optional_recovery_aerobic'
    || workout.section18ConditioningRole === 'optional_flush'
  ) {
    return 'flush';
  }
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
  if (!workout) return null;

  // A typed Speed block is itself canonical content. Read the final component
  // ownership before the legacy conditioning-domain fallback: a speed-only
  // recovery-tier day used to fall through with zero conditioning-owned rows
  // and inherit the label "Recovery Conditioning" even though every final
  // work row belonged to Speed.
  const components = getSessionComponentRows(workout);
  const speedWorkRows = components.speedRows.filter(isMeaningfulWorkRow);
  if (speedWorkRows.length > 0 && components.conditioningRows.length === 0) {
    return identity('speed_conditioning', mainStructure(speedWorkRows, workout));
  }

  if (!hasCanonicalConditioning(workout)) return null;

  const rows = getMeaningfulConditioningWorkRows(workout);
  const structure = mainStructure(rows, workout);
  const purpose = typedPurpose(workout);
  const purposeText = rowPurposeText(rows);

  if (purpose === 'speed') return identity('speed_conditioning', structure);
  if (purpose === 'hard') return identity('hard_intervals', structure);
  if (purpose === 'tempo') return identity('tempo_intervals', structure);
  if (purpose === 'flush') return identity('aerobic_flush', structure);

  // Flush/recovery are purpose distinctions the ConditioningBlock intent union
  // still does not represent, so a session carrying no §18 role falls back to
  // reading them from the final owned work rows (or an explicit recovery
  // session type) — never from modality or surrounding name copy. Generated
  // sessions take the typed path above; this is for stored and coach content.
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
