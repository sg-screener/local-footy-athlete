import type { Workout } from '../types/domain';

export type ConditioningLogMode =
  | 'run'
  | 'bike'
  | 'rower'
  | 'ski'
  | 'assault_bike'
  | 'swim'
  | 'mixed'
  | 'other';

export type ConditioningLogField =
  | 'mode'
  | 'totalTimeMinutes'
  | 'distanceMeters'
  | 'calories'
  | 'roundsCompleted'
  | 'intervalsCompleted'
  | 'bestInterval'
  | 'averagePace'
  | 'rpe';

export interface ConditioningPerformanceLog {
  sessionName?: string;
  mode?: ConditioningLogMode;
  totalTimeMinutes?: number;
  distanceMeters?: number;
  calories?: number;
  roundsCompleted?: number;
  intervalsCompleted?: number;
  bestInterval?: string;
  averagePace?: string;
  rpe?: number;
}

export interface ConditioningLoggingConfig {
  level: 'none' | 'simple' | 'trackable';
  title: string;
  suggestedMode?: ConditioningLogMode;
  fields: ConditioningLogField[];
}

const CONDITIONING_TYPES = new Set([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Nordic-4x4',
  'Long-Run',
  'MetCon',
  'Flog-Friday',
  '6x1km',
  'Hill-Sprints',
  'MAS-Training',
  'Tempo-Run',
  'Quality-Sprints',
]);

function workoutText(workout: Workout | null | undefined): string {
  if (!workout) return '';
  const optionText = (workout.conditioningBlock?.options ?? [])
    .map((option) => `${option.title ?? ''} ${option.description ?? ''}`)
    .join(' ');
  const exerciseText = (workout.exercises ?? [])
    .map((exercise) => {
      const name = exercise.exercise?.name ?? '';
      const notes = exercise.notes ?? exercise.exercise?.description ?? '';
      return `${name} ${notes}`;
    })
    .join(' ');
  return [
    workout.name,
    workout.workoutType,
    workout.conditioningFlavour,
    workout.conditioningCategory,
    optionText,
    exerciseText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function inferConditioningLogMode(text: string): ConditioningLogMode | undefined {
  const lower = text.toLowerCase();
  if (/\bassault\s*bike\b|\becho\s*bike\b|\bair\s*bike\b/.test(lower)) return 'assault_bike';
  if (/\bskierg\b|\bski\s*erg\b|\bski\b/.test(lower)) return 'ski';
  if (/\brower\b|\brow\b|\browing\b/.test(lower)) return 'rower';
  if (/\bbikeerg\b|\bbike\b|\bcycle\b/.test(lower)) return 'bike';
  if (/\bswim\b|\bswimming\b/.test(lower)) return 'swim';
  if (/\bmixed\b|\brow\s*\+\s*ski\b/.test(lower)) return 'mixed';
  if (/\brun\b|\brunning\b|\bjog\b|\bsprint\b|\b1km\b|\b200m\b|\b400m\b|\bflying\b/.test(lower)) {
    return 'run';
  }
  return undefined;
}

function hasConditioningContent(workout: Workout): boolean {
  return (
    CONDITIONING_TYPES.has(String(workout.workoutType)) ||
    !!workout.conditioningFlavour ||
    !!workout.conditioningCategory ||
    !!workout.conditioningBlock ||
    !!workout.hasCombinedConditioning
  );
}

function isSimpleOnly(text: string, workout: Workout): boolean {
  if (workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery') return true;
  return /\b(easy|flush|recovery|mobility|walk|breathing|foam\s*roll|zone\s*1)\b/.test(text) &&
    !/\b(1km|4x4|vo2|mas|emom|tabata|interval|repeat|sprint|time\s*trial|fartlek|metcon|calorie|cal\b)\b/.test(text);
}

function isTrackable(text: string): boolean {
  return /\b(1km|4x4|vo2|mas|emom|tabata|interval|repeat|sprint|flying|time\s*trial|fartlek|metcon|calorie|cal\b|bike|rower|row|ski\s*erg|skierg|assault\s*bike)\b/.test(text);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function fieldsFor(text: string): ConditioningLogField[] {
  const fields: ConditioningLogField[] = ['mode'];
  const hasIntervals = /\b(interval|repeat|1km|4x4|vo2|mas|tabata|sprint|flying|fartlek|emom)\b/.test(text);
  const hasRounds = /\b(round|tabata|mas|emom|fartlek|metcon)\b/.test(text);
  const hasCalories = /\b(calorie|cal\b|emom|assault\s*bike|bike|rower|ski\s*erg|skierg)\b/.test(text);
  const hasDistance = /\b(run|sprint|1km|200m|400m|flying|rower|row|ski\s*erg|skierg|bike)\b/.test(text);
  const hasTime = /\b(time\s*trial|4x4|vo2|mas|tabata|emom|interval|repeat|fartlek|metcon|bike|rower|ski\s*erg|skierg|run)\b/.test(text);

  if (hasTime) fields.push('totalTimeMinutes');
  if (hasDistance) fields.push('distanceMeters');
  if (hasCalories) fields.push('calories');
  if (hasRounds) fields.push('roundsCompleted');
  if (hasIntervals) fields.push('intervalsCompleted', 'bestInterval', 'averagePace');
  fields.push('rpe');

  return unique(fields);
}

export function getConditioningLoggingConfig(
  workout: Workout | null | undefined,
): ConditioningLoggingConfig {
  const text = workoutText(workout);
  const title = workout?.conditioningBlock?.options?.[0]?.title || workout?.name || 'Conditioning';

  if (!workout) {
    return { level: 'none', title, fields: [] };
  }

  if (workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery') {
    return { level: 'simple', title, suggestedMode: inferConditioningLogMode(text), fields: [] };
  }

  if (!hasConditioningContent(workout)) {
    return { level: 'none', title, fields: [] };
  }

  if (isSimpleOnly(text, workout)) {
    return { level: 'simple', title, suggestedMode: inferConditioningLogMode(text), fields: [] };
  }

  if (!isTrackable(text)) {
    return { level: 'simple', title, suggestedMode: inferConditioningLogMode(text), fields: [] };
  }

  return {
    level: 'trackable',
    title,
    suggestedMode: inferConditioningLogMode(text),
    fields: fieldsFor(text),
  };
}
