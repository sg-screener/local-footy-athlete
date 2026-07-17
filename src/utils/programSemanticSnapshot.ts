import type { Workout, WorkoutExercise } from '../types/domain';
import type { ResolvedDay } from './sessionResolver';

export interface SemanticExerciseSnapshot {
  identity: string;
  exerciseId: string;
  name: string;
  order: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  weightKg: number | null;
  restSeconds: number;
  prescriptionType: NonNullable<WorkoutExercise['prescriptionType']>;
  strengthIntensity: string | null;
  itemDurationMinutes: number | null;
  equipment: string[];
}

export interface SemanticComponentSnapshot {
  identity: string;
  kind: 'strength' | 'conditioning' | 'speed' | 'power' | 'recovery' | 'session';
  order: number;
  intensity: string | null;
  durationMinutes: number | null;
  exerciseIds: string[];
  exercises: SemanticExerciseSnapshot[];
  metadata: unknown;
}

export type SemanticComponentDomain = SemanticComponentSnapshot['kind'];

export interface SemanticWorkoutSnapshot {
  identity: string;
  workoutType: string;
  durationMinutes: number;
  strengthIntensity: string | null;
  conditioningIntensity: string | null;
  components: SemanticComponentSnapshot[];
  exercises: SemanticExerciseSnapshot[];
  /** Presentation is retained for diagnostics, but never proves a dose edit. */
  presentation: {
    title: string;
    description: string;
    sessionTier: string | null;
    coachNotes: string[];
    conditioningLabels: string[];
  };
}

export interface SemanticDaySnapshot {
  date: string;
  workout: SemanticWorkoutSnapshot | null;
}

export interface SemanticWeeklyExposureSnapshot {
  weekStart: string;
  strengthSessions: number;
  conditioningSessions: number;
  strengthExerciseCount: number;
  strengthSets: number;
  conditioningMinutes: number;
  sessionMinutes: number;
}

export interface SemanticProgramSnapshot {
  days: SemanticDaySnapshot[];
  weeklyExposure: SemanticWeeklyExposureSnapshot[];
}

export interface SemanticFieldChange {
  path: string;
  before: unknown;
  after: unknown;
  category: 'identity' | 'dose' | 'structure' | 'presentation' | 'exposure';
  direction: 'increase' | 'decrease' | 'changed';
}

export interface SemanticProgramDiff {
  before: SemanticProgramSnapshot;
  after: SemanticProgramSnapshot;
  changes: SemanticFieldChange[];
  changedDates: string[];
  hasSemanticChange: boolean;
  hasProgrammingChange: boolean;
  hasMaterialDoseReduction: boolean;
}

const PRESENTATION_SEGMENTS = new Set([
  'presentation',
  'title',
  'description',
  'sessionTier',
  'coachNotes',
  'conditioningLabels',
]);

const DOSE_SEGMENTS = new Set([
  'sets',
  'repsMin',
  'repsMax',
  'weightKg',
  'restSeconds',
  'strengthIntensity',
  'conditioningIntensity',
  'intensity',
  'itemDurationMinutes',
  'durationMinutes',
]);

const EXPOSURE_SEGMENTS = new Set([
  'strengthSessions',
  'conditioningSessions',
  'strengthExerciseCount',
  'strengthSets',
  'conditioningMinutes',
  'sessionMinutes',
]);

export function snapshotSemanticResolvedDay(day: ResolvedDay): SemanticDaySnapshot {
  return snapshotSemanticWorkout(day.date, day.workout ?? null);
}

export function snapshotSemanticWorkout(
  date: string,
  workout: Workout | null,
): SemanticDaySnapshot {
  if (!workout) return { date, workout: null };

  const exercises = orderedExercises(workout).map((row) => semanticExercise(row, workout));
  const conditioningIds = new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) =>
      (option.exerciseIds ?? []).map(String)),
  );
  const strengthExercises = exercises.filter((row) =>
    !conditioningIds.has(row.identity) && !conditioningIds.has(row.exerciseId),
  );
  const components: SemanticComponentSnapshot[] = [];

  if (strengthExercises.length > 0) {
    components.push({
      identity: componentIdentity(workout, 'strength'),
      kind: 'strength',
      order: components.length,
      intensity: clean((workout as any).strengthIntensity) ?? clean(workout.intensity),
      durationMinutes: sumItemDuration(strengthExercises),
      exerciseIds: strengthExercises.map((row) => row.exerciseId),
      exercises: strengthExercises,
      metadata: stableValue({
        strengthIntent: workout.strengthIntent ?? null,
        patterns: workout.strengthPatternContributions ?? [],
      }),
    });
  }

  for (const [index, option] of (workout.conditioningBlock?.options ?? []).entries()) {
    const optionIds = new Set((option.exerciseIds ?? []).map(String));
    const linked = exercises.filter((row) =>
      optionIds.has(row.identity) || optionIds.has(row.exerciseId),
    );
    components.push({
      identity: `${componentIdentity(workout, 'conditioning')}:option:${index}:${stableId(option.exerciseIds)}`,
      kind: 'conditioning',
      order: components.length,
      intensity: clean((option as any).intensity) ?? clean(workout.intensity),
      durationMinutes:
        finiteOrNull((option as any).durationMinutes) ??
        sumItemDuration(linked) ??
        finiteOrNull(workout.durationMinutes),
      exerciseIds: linked.map((row) => row.exerciseId),
      exercises: linked,
      metadata: stableValue({
        intent: workout.conditioningBlock?.intent ?? null,
        attachedKind: workout.conditioningBlock?.attachedKind ?? null,
        title: option.title,
        description: option.description,
      }),
    });
  }

  appendStructuredComponent(components, workout, 'speed', workout.speedBlock);
  appendStructuredComponent(components, workout, 'power', workout.powerBlock);
  for (const [index, recovery] of (workout.recoveryAddons ?? []).entries()) {
    components.push({
      identity: `${componentIdentity(workout, 'recovery')}:${index}`,
      kind: 'recovery',
      order: components.length,
      intensity: clean((recovery as any).intensity) ?? 'Light',
      durationMinutes: finiteOrNull((recovery as any).durationMinutes),
      exerciseIds: [],
      exercises: [],
      metadata: stableValue(recovery),
    });
  }

  if (components.length === 0) {
    components.push({
      identity: componentIdentity(workout, 'session'),
      kind: 'session',
      order: 0,
      intensity: clean(workout.intensity),
      durationMinutes: finiteOrNull(workout.durationMinutes),
      exerciseIds: exercises.map((row) => row.exerciseId),
      exercises,
      metadata: stableValue({ workoutType: workout.workoutType }),
    });
  }

  return {
    date,
    workout: {
      identity: String(workout.planEntryId ?? workout.id),
      workoutType: String(workout.workoutType ?? ''),
      durationMinutes: finite(workout.durationMinutes),
      strengthIntensity:
        clean((workout as any).strengthIntensity) ??
        (strengthExercises.length > 0 ? clean(workout.intensity) : null),
      conditioningIntensity:
        components.some((component) => component.kind === 'conditioning')
          ? clean(workout.intensity)
          : null,
      components,
      exercises,
      presentation: {
        title: String(workout.name ?? ''),
        description: String(workout.description ?? ''),
        sessionTier: clean((workout as any).sessionTier),
        coachNotes: (workout.coachNotes ?? []).map(String),
        conditioningLabels: [
          clean(workout.coachAddedConditioningLabel),
          ...(workout.conditioningBlock?.options ?? []).map((option) => clean(option.title)),
        ].filter((value): value is string => !!value),
      },
    },
  };
}

export function buildSemanticProgramSnapshot(days: readonly ResolvedDay[]): SemanticProgramSnapshot {
  const semanticDays = [...days]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(snapshotSemanticResolvedDay);
  const byWeek = new Map<string, SemanticDaySnapshot[]>();
  for (const day of semanticDays) {
    const weekStart = mondayFor(day.date);
    const week = byWeek.get(weekStart) ?? [];
    week.push(day);
    byWeek.set(weekStart, week);
  }
  return {
    days: semanticDays,
    weeklyExposure: Array.from(byWeek.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([weekStart, weekDays]) => weeklyExposure(weekStart, weekDays)),
  };
}

/**
 * Canonical semantic projection for comparisons scoped to one component domain.
 *
 * Component order in a full workout is intentionally global. Once a consumer
 * asks about one domain, only the relative top-level order inside that domain is
 * semantic; removing an earlier component from another domain must not make an
 * otherwise identical protected component look changed. Nested exercise order
 * and every other component field remain untouched.
 */
export function projectSemanticComponentsForDomain(
  workout: Pick<SemanticWorkoutSnapshot, 'components'> | null | undefined,
  domain: SemanticComponentDomain,
): SemanticComponentSnapshot[] {
  return (workout?.components ?? [])
    .filter((component) => component.kind === domain)
    .map((component, order) => ({
      ...component,
      order,
    }));
}

export function semanticFingerprint(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function diffSemanticPrograms(
  before: SemanticProgramSnapshot,
  after: SemanticProgramSnapshot,
): SemanticProgramDiff {
  const changes: SemanticFieldChange[] = [];
  diffValue(before, after, '', changes);
  const beforeByDate = new Map(before.days.map((day) => [day.date, day]));
  const afterByDate = new Map(after.days.map((day) => [day.date, day]));
  const changedDates = Array.from(new Set([
    ...beforeByDate.keys(),
    ...afterByDate.keys(),
  ])).filter((date) =>
    semanticFingerprint(beforeByDate.get(date) ?? null) !==
    semanticFingerprint(afterByDate.get(date) ?? null),
  ).sort();
  return {
    before,
    after,
    changes,
    changedDates,
    hasSemanticChange: changes.length > 0,
    hasProgrammingChange: changes.some((change) => change.category !== 'presentation'),
    hasMaterialDoseReduction: changes.some(isMaterialReduction),
  };
}

export function diffSemanticDays(
  before: SemanticDaySnapshot,
  after: SemanticDaySnapshot,
): SemanticProgramDiff {
  return diffSemanticPrograms(
    programFromSemanticDays([before]),
    programFromSemanticDays([after]),
  );
}

export function semanticDiffChangesLever(
  diff: SemanticProgramDiff,
  lever: 'sets' | 'reps' | 'intensity' | 'duration' | 'load' | 'rest' | 'identity' | 'any',
): boolean {
  if (lever === 'any') return diff.hasProgrammingChange;
  const needles: Record<Exclude<typeof lever, 'any'>, string[]> = {
    sets: ['sets', 'strengthSets'],
    reps: ['repsMin', 'repsMax'],
    intensity: ['strengthIntensity', 'conditioningIntensity', 'intensity'],
    duration: ['itemDurationMinutes', 'durationMinutes', 'conditioningMinutes', 'sessionMinutes'],
    load: ['weightKg'],
    rest: ['restSeconds'],
    identity: ['identity', 'exerciseId', 'exerciseIds'],
  };
  return diff.changes.some((change) =>
    needles[lever].some((needle) => change.path.split('.').includes(needle)),
  );
}

export function firstSemanticDoseChange(
  diff: SemanticProgramDiff,
): SemanticFieldChange | null {
  return diff.changes.find((change) =>
    change.category === 'dose' && change.before !== change.after) ?? null;
}

export function semanticDiffHasMaterialReductionForLever(
  diff: SemanticProgramDiff,
  lever: 'sets' | 'reps' | 'intensity' | 'duration' | 'load' | 'rest' | 'any',
): boolean {
  return diff.changes.some((change) => {
    if (!isMaterialReduction(change)) return false;
    if (lever === 'any') return true;
    return semanticDiffChangesLever({ ...diff, changes: [change] }, lever);
  });
}

function programFromSemanticDays(days: SemanticDaySnapshot[]): SemanticProgramSnapshot {
  const byWeek = new Map<string, SemanticDaySnapshot[]>();
  for (const day of days) {
    const weekStart = mondayFor(day.date);
    byWeek.set(weekStart, [...(byWeek.get(weekStart) ?? []), day]);
  }
  return {
    days,
    weeklyExposure: Array.from(byWeek.entries()).map(([weekStart, weekDays]) =>
      weeklyExposure(weekStart, weekDays)),
  };
}

function semanticExercise(row: WorkoutExercise, workout: Workout): SemanticExerciseSnapshot {
  const prescriptionType = row.prescriptionType ?? 'reps';
  return {
    identity: String(row.id ?? row.exerciseId),
    exerciseId: String(row.exerciseId ?? row.exercise?.id ?? row.id),
    name: String(row.exercise?.name ?? row.exerciseId ?? ''),
    order: finite(row.exerciseOrder),
    sets: finite(row.prescribedSets),
    repsMin: finite(row.prescribedRepsMin),
    repsMax: finite(row.prescribedRepsMax),
    weightKg: positiveOrNull(row.prescribedWeightKg),
    restSeconds: finite(row.restSeconds),
    prescriptionType,
    strengthIntensity: clean((row as any).intensity) ?? clean(workout.intensity),
    itemDurationMinutes: itemDurationMinutes(row),
    equipment: [...(row.exercise?.equipmentRequired ?? [])].map(String).sort(),
  };
}

function orderedExercises(workout: Workout): WorkoutExercise[] {
  return [...(workout.exercises ?? [])].sort((left, right) =>
    finite(left.exerciseOrder) - finite(right.exerciseOrder));
}

function itemDurationMinutes(row: WorkoutExercise): number | null {
  if (row.prescriptionType === 'duration_minutes') {
    return finiteOrNull(row.prescribedRepsMax ?? row.prescribedRepsMin);
  }
  if (row.prescriptionType === 'duration') {
    const seconds = finiteOrNull(row.prescribedRepsMax ?? row.prescribedRepsMin);
    return seconds === null ? null : seconds / 60;
  }
  return finiteOrNull((row as any).durationMinutes);
}

function sumItemDuration(rows: SemanticExerciseSnapshot[]): number | null {
  const values = rows.map((row) => row.itemDurationMinutes).filter((value): value is number => value !== null);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function appendStructuredComponent(
  components: SemanticComponentSnapshot[],
  workout: Workout,
  kind: 'speed' | 'power',
  value: unknown,
): void {
  if (!value) return;
  components.push({
    identity: componentIdentity(workout, kind),
    kind,
    order: components.length,
    intensity: clean((value as any).intensity) ?? clean(workout.intensity),
    durationMinutes: finiteOrNull((value as any).durationMinutes),
    exerciseIds: [],
    exercises: [],
    metadata: stableValue(value),
  });
}

function weeklyExposure(
  weekStart: string,
  days: readonly SemanticDaySnapshot[],
): SemanticWeeklyExposureSnapshot {
  let strengthSessions = 0;
  let conditioningSessions = 0;
  let strengthExerciseCount = 0;
  let strengthSets = 0;
  let conditioningMinutes = 0;
  let sessionMinutes = 0;
  for (const day of days) {
    const workout = day.workout;
    if (!workout) continue;
    sessionMinutes += workout.durationMinutes;
    const strength = workout.components.filter((component) => component.kind === 'strength');
    const conditioning = workout.components.filter((component) => component.kind === 'conditioning');
    if (strength.length > 0) strengthSessions++;
    if (conditioning.length > 0) conditioningSessions++;
    strengthExerciseCount += strength.reduce((sum, component) => sum + component.exercises.length, 0);
    strengthSets += strength.reduce((sum, component) =>
      sum + component.exercises.reduce((rowSum, row) => rowSum + row.sets, 0), 0);
    conditioningMinutes += conditioning.reduce((max, component) =>
      Math.max(max, component.durationMinutes ?? 0), 0);
  }
  return {
    weekStart,
    strengthSessions,
    conditioningSessions,
    strengthExerciseCount,
    strengthSets,
    conditioningMinutes,
    sessionMinutes,
  };
}

function diffValue(
  before: unknown,
  after: unknown,
  path: string,
  changes: SemanticFieldChange[],
): void {
  if (Object.is(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    const identityKey = arrayIdentityKey(before, after);
    if (identityKey) {
      const beforeKeys = before.map((entry) => String((entry as any)[identityKey]));
      const afterKeys = after.map((entry) => String((entry as any)[identityKey]));
      if (semanticFingerprint(beforeKeys) !== semanticFingerprint(afterKeys)) {
        changes.push({
          path: join(path, 'order'),
          before: beforeKeys,
          after: afterKeys,
          category: 'structure',
          direction: 'changed',
        });
      }
      const beforeByIdentity = new Map(before.map((entry) => [String((entry as any)[identityKey]), entry]));
      const afterByIdentity = new Map(after.map((entry) => [String((entry as any)[identityKey]), entry]));
      const identities = Array.from(new Set([
        ...beforeByIdentity.keys(),
        ...afterByIdentity.keys(),
      ])).sort();
      for (const identity of identities) {
        diffValue(
          beforeByIdentity.get(identity),
          afterByIdentity.get(identity),
          join(path, identity),
          changes,
        );
      }
      return;
    }
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index++) {
      diffValue(before[index], after[index], join(path, String(index)), changes);
    }
    return;
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    for (const key of keys) diffValue(before[key], after[key], join(path, key), changes);
    return;
  }
  changes.push({
    path,
    before,
    after,
    category: categoryFor(path),
    direction: directionFor(before, after),
  });
}

function arrayIdentityKey(before: unknown[], after: unknown[]): 'identity' | 'date' | 'weekStart' | null {
  const values = [...before, ...after];
  if (values.length === 0 || !values.every(isRecord)) return null;
  for (const key of ['identity', 'date', 'weekStart'] as const) {
    if (values.every((value) => typeof value[key] === 'string')) return key;
  }
  return null;
}

function categoryFor(path: string): SemanticFieldChange['category'] {
  const segments = path.split('.');
  if (segments.some((segment) => PRESENTATION_SEGMENTS.has(segment))) return 'presentation';
  if (segments.some((segment) => EXPOSURE_SEGMENTS.has(segment))) return 'exposure';
  if (segments.some((segment) => DOSE_SEGMENTS.has(segment))) return 'dose';
  if (segments.some((segment) => segment === 'identity' || segment === 'exerciseId')) return 'identity';
  return 'structure';
}

function directionFor(before: unknown, after: unknown): SemanticFieldChange['direction'] {
  if (typeof before === 'number' && typeof after === 'number') {
    if (after < before) return 'decrease';
    if (after > before) return 'increase';
  }
  return 'changed';
}

function isMaterialReduction(change: SemanticFieldChange): boolean {
  if (change.category === 'presentation') return false;
  const leaf = change.path.split('.').pop() ?? '';
  if (change.before !== undefined && change.after === undefined) {
    return change.category === 'identity' || change.category === 'structure';
  }
  if (change.before !== null && change.before !== undefined && change.after === null) {
    return change.category === 'identity' || change.category === 'structure';
  }
  if (leaf === 'restSeconds') return change.direction === 'increase';
  if (leaf.toLowerCase().includes('intensity')) {
    return semanticIntensityRank(change.after) < semanticIntensityRank(change.before);
  }
  return change.direction === 'decrease' && (
    DOSE_SEGMENTS.has(leaf) || EXPOSURE_SEGMENTS.has(leaf)
  );
}

export function semanticIntensityRank(value: unknown): number {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return 0;
  if (/very light|recovery|easy/.test(normalized)) return 1;
  if (/light|low/.test(normalized)) return 2;
  if (/moderate|medium|tempo/.test(normalized)) return 3;
  if (/hard|high|heavy|vigorous/.test(normalized)) return 4;
  if (/max|maximum|all.out/.test(normalized)) return 5;
  return 3;
}

function componentIdentity(workout: Workout, kind: string): string {
  return `${String(workout.planEntryId ?? workout.id)}:${kind}`;
}

function stableId(value: unknown): string {
  return semanticFingerprint(value).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 80);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function join(path: string, next: string): string {
  return path ? `${path}.${next}` : next;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function finite(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function finiteOrNull(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : finite(value);
}

function positiveOrNull(value: unknown): number | null {
  const valueOrNull = finiteOrNull(value);
  return valueOrNull !== null && valueOrNull > 0 ? valueOrNull : null;
}

function mondayFor(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}
