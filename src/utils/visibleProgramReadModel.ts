import { useProgramStore } from '../store/programStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import {
  resolveDateWithConditioning,
  resolveWeekWithConditioning,
  getMondayStr,
  getMondayForDate,
  type ResolvedDay,
  type ScheduleState,
} from './sessionResolver';
import { projectVisibleDay } from './visibleProgramProjection';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { bucketToRegion } from './coachConstraintProducers';
import { logger } from './logger';
import { filterConstraintsForDate } from './readinessConstraints';
import {
  inferModalityFromName,
} from './coachModalitySwap';
import type { ConditioningModality } from '../data/exerciseTags';
import { getTeamTrainingWorkoutState } from './teamTraining';

export type VisibleProgramItemDomain =
  | 'conditioning'
  | 'recovery'
  | 'strength'
  | 'session';

export interface VisibleProgramItem {
  id: string;
  title: string;
  domain: VisibleProgramItemDomain;
  modality: ConditioningModality | null;
  durationMinutes: number | null;
  description?: string;
  exerciseIds: string[];
  source:
    | 'conditioning_option'
    | 'conditioning_phase'
    | 'conditioning_exercise'
    | 'strength_exercise'
    | 'session';
}

export interface ResolvedVisibleProgramForDate {
  day: ResolvedDay;
  items: VisibleProgramItem[];
  conditioningItems: VisibleProgramItem[];
  strengthItems: VisibleProgramItem[];
}

export function buildExtraConstraintsForVisibleProgram(activeConstraints: any[]): any[] {
  if (!Array.isArray(activeConstraints) || activeConstraints.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    buildFatigueConstraint,
    buildSorenessConstraint,
    buildScheduleConstraint,
    buildMissedSessionConstraint,
  } = require('../utils/exposureEngine');
  const out: any[] = [];
  for (const c of activeConstraints) {
    if (!c || c.status === 'resolved') continue;
    if (c.type === 'fatigue') {
      out.push(buildFatigueConstraint({ id: c.id, severity: c.severity, startDate: c.startDate }));
    } else if (c.type === 'soreness' && c.bucket) {
      out.push(buildSorenessConstraint({
        id: c.id,
        region: bucketToRegion(c.bucket),
        severity: c.severity,
        startDate: c.startDate,
      }));
    } else if (c.type === 'schedule') {
      out.push(buildScheduleConstraint({ id: c.id, severity: c.severity, startDate: c.startDate }));
    } else if (c.type === 'missed_session') {
      out.push(buildMissedSessionConstraint({
        id: c.id,
        missedDate: c.missedDate,
        sessionName: c.sessionName,
        startDate: c.startDate,
      }));
    }
  }
  return out;
}

export function buildProgramTabProjectedWeek(args: {
  mondayISO?: string;
  todayISO: string;
  state: ScheduleState & { activeConstraints?: any[] };
  overrideContexts?: Record<string, any>;
  modalityPreferences?: Record<string, any>;
}): ResolvedDay[] {
  const monday = args.mondayISO ?? getMondayStr(0);
  const rawWeek = resolveWeekWithConditioning(monday, args.state);
  const prefs =
    args.modalityPreferences ??
    useCoachPreferencesStore.getState().modalityPreferences;
  return rawWeek.map((day) => {
    const dayActiveConstraints = filterConstraintsForDate(
      args.state.activeConstraints ?? [],
      day.date,
    );
    const extraConstraints = buildExtraConstraintsForVisibleProgram(dayActiveConstraints);
    return projectVisibleDay({
      day,
      activeInjury: args.state.activeInjury
        ? { ...args.state.activeInjury, rules: args.state.activeInjury.rules ?? [] }
        : null,
      extraConstraints,
      overrideContext: args.overrideContexts?.[day.date],
      todayISO: args.todayISO,
      modalityPreferences: prefs,
    }).day;
  });
}

export function buildDayWorkoutProjectedDay(args: {
  date: string;
  todayISO: string;
  state: ScheduleState & { activeConstraints?: any[] };
  overrideContext?: any;
  modalityPreferences?: Record<string, any>;
}): ResolvedDay {
  const raw = resolveDateWithConditioning(args.date, args.state);
  const dayActiveConstraints = filterConstraintsForDate(
    args.state.activeConstraints ?? [],
    args.date,
  );
  const extraConstraints = buildExtraConstraintsForVisibleProgram(dayActiveConstraints);
  const prefs =
    args.modalityPreferences ??
    useCoachPreferencesStore.getState().modalityPreferences;
  return projectVisibleDay({
    day: raw,
    activeInjury: args.state.activeInjury
      ? { ...args.state.activeInjury, rules: args.state.activeInjury.rules ?? [] }
      : null,
    extraConstraints,
    overrideContext: args.overrideContext,
    todayISO: args.todayISO,
    modalityPreferences: prefs,
  }).day;
}

export function getResolvedVisibleProgramForDate(args: {
  date: string;
  todayISO: string;
  state: ScheduleState & { activeConstraints?: any[] };
  overrideContext?: any;
  overrideContexts?: Record<string, any>;
  modalityPreferences?: Record<string, any>;
}): ResolvedVisibleProgramForDate {
  const day = buildDayWorkoutProjectedDay({
    date: args.date,
    todayISO: args.todayISO,
    state: args.state,
    overrideContext: args.overrideContext ?? args.overrideContexts?.[args.date],
    modalityPreferences: args.modalityPreferences,
  });
  const items = extractVisibleProgramItemsFromResolvedDay(day);
  const conditioningItems = items.filter((item) =>
    item.domain === 'conditioning' || item.domain === 'recovery',
  );
  const strengthItems = items.filter((item) => item.domain === 'strength');
  logger.debug('[visible-program-date-resolution]', {
    date: args.date,
    workoutName: day.workout?.name ?? null,
    workoutType: day.workout?.workoutType ?? null,
    source: day.source,
    itemCount: items.length,
    conditioningItems: conditioningItems.map(visibleItemLogPayload),
    strengthItems: strengthItems.map(visibleItemLogPayload),
  });
  return { day, items, conditioningItems, strengthItems };
}

export function extractVisibleProgramItemsFromResolvedDay(day: ResolvedDay): VisibleProgramItem[] {
  return extractVisibleProgramItemsFromWorkout(day.workout ?? null);
}

export function visibleWorkoutItemCountLabel(
  workout: ResolvedDay['workout'] | null | undefined,
): string | null {
  if (!workout) return null;
  const teamState = getTeamTrainingWorkoutState(workout);
  const items = extractVisibleProgramItemsFromWorkout(workout)
    .filter((item) => item.source !== 'session');
  const count = items.length > 0
    ? items.length
    : teamState.renderableExercises.length;
  if (count <= 0) return null;
  const onlyStrength = items.length > 0 && items.every((item) => item.domain === 'strength');
  const noun = onlyStrength ? 'exercise' : 'item';
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function extractVisibleProgramItemsFromWorkout(
  workout: ResolvedDay['workout'] | null,
): VisibleProgramItem[] {
  if (!workout) return [];

  const teamState = getTeamTrainingWorkoutState(workout);
  const exercises = teamState.renderableExercises;
  const items: VisibleProgramItem[] = [];
  const seen = new Set<string>();
  const isRecovery =
    workout.workoutType === 'Recovery' ||
    (workout as any).sessionTier === 'recovery';
  const workoutType = String(workout.workoutType ?? '');
  const isPureConditioning =
    workoutType === 'Conditioning' ||
    workoutType === 'Aerobic' ||
    workoutType === 'Tempo' ||
    workoutType === 'Speed' ||
    workoutType === 'HIIT' ||
    /(?:flush|sprint|interval|run|metcon|conditioning|tempo|mas)/i.test(workoutType);

  const addItem = (item: VisibleProgramItem) => {
    const key = `${item.domain}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const [index, option] of (workout.conditioningBlock?.options ?? []).entries()) {
    const linkedExercises = linkedExercisesForOption(exercises, option);
    const title =
      cleanVisibleTitle(option.title) ||
      cleanVisibleTitle(linkedExercises[0]?.exercise?.name) ||
      cleanVisibleTitle(workout.name) ||
      `Conditioning ${index + 1}`;
    const description = cleanVisibleTitle(option.description);
    const text = [
      title,
      description,
      ...linkedExercises.flatMap((exercise: any) => [
        exercise?.exercise?.name,
        exercise?.exercise?.description,
        exercise?.notes,
      ]),
    ].filter(Boolean).join(' ');
    const exerciseIds = linkedExercises.map((exercise: any) =>
      String(exercise.id ?? exercise.exerciseId ?? exercise.exercise?.id ?? ''),
    ).filter(Boolean);
    const isStackedConditioningTemplate = exerciseIds.some(isTemplateConditioningRowId);
    addItem({
      id: exerciseIds[0] ?? `conditioning-option:${normaliseVisibleItemKey(title)}`,
      title,
      domain: isRecovery && !isStackedConditioningTemplate ? 'recovery' : 'conditioning',
      modality: inferModalityFromName(text),
      durationMinutes: extractVisibleDurationMinutes(text, linkedExercises),
      description,
      exerciseIds,
      source: 'conditioning_option',
    });
  }

  if (isPureConditioning || isRecovery) {
    for (const [index, exercise] of exercises.entries()) {
      const id = String(
        exercise.id ?? exercise.exerciseId ?? exercise.exercise?.id ?? `conditioning-phase:${index}`,
      );
      if (isTemplateStrengthRowId(id) || (isRecovery && isTemplateConditioningRowId(id))) continue;
      const title =
        cleanVisibleTitle(exercise.exercise?.name) ||
        cleanVisibleTitle(workout.name) ||
        `Phase ${index + 1}`;
      const description = cleanVisibleTitle(exercise.notes || exercise.exercise?.description);
      const text = [title, description].filter(Boolean).join(' ');
      addItem({
        id,
        title,
        domain: isRecovery ? 'recovery' : 'conditioning',
        modality: inferModalityFromName(text),
        durationMinutes: extractVisibleDurationMinutes(text, [exercise]),
        description,
        exerciseIds: [id].filter(Boolean),
        source: isPureConditioning ? 'conditioning_phase' : 'conditioning_exercise',
      });
    }
  }

  const conditioningIds = new Set(
    items.flatMap((item) => item.exerciseIds).filter(Boolean),
  );
  for (const [index, exercise] of exercises.entries()) {
    const id = String(exercise.id ?? exercise.exerciseId ?? exercise.exercise?.id ?? `strength:${index}`);
    if (conditioningIds.has(id)) continue;
    const title = cleanVisibleTitle(exercise.exercise?.name);
    if (!title) continue;
    addItem({
      id,
      title,
      domain: 'strength',
      modality: null,
      durationMinutes: null,
      description: cleanVisibleTitle(exercise.notes || exercise.exercise?.description),
      exerciseIds: [id],
      source: 'strength_exercise',
    });
  }

  if (items.length === 0 && workout.name) {
    const title = cleanVisibleTitle(teamState.displayName ?? workout.name);
    addItem({
      id: String((workout as any).id ?? `session:${normaliseVisibleItemKey(title)}`),
      title,
      domain: 'session',
      modality: inferModalityFromName([
        workout.name,
        workout.description,
        ...(workout.coachNotes ?? []),
      ].filter(Boolean).join(' ')),
      durationMinutes: extractVisibleDurationMinutes([
        workout.name,
        workout.description,
      ].filter(Boolean).join(' '), []),
      description: cleanVisibleTitle(workout.description),
      exerciseIds: [],
      source: 'session',
    });
  }

  return items;
}

function isTemplateStrengthRowId(id: string): boolean {
  return /^template:(?:strength_|accessories_)/.test(id);
}

function isTemplateConditioningRowId(id: string): boolean {
  return /^template:/.test(id) &&
    !isTemplateStrengthRowId(id) &&
    !/^template:recovery_/.test(id);
}

function visibleItemLogPayload(item: VisibleProgramItem) {
  return {
    id: item.id,
    title: item.title,
    domain: item.domain,
    modality: item.modality,
    durationMinutes: item.durationMinutes,
    source: item.source,
  };
}

function linkedExercisesForOption(exercises: any[], option: any): any[] {
  const ids = new Set((option?.exerciseIds ?? []).map((id: unknown) => String(id)));
  return exercises.filter((exercise: any) =>
    ids.has(String(exercise.id ?? '')) ||
    ids.has(String(exercise.exerciseId ?? '')) ||
    ids.has(String(exercise.exercise?.id ?? '')),
  );
}

function extractVisibleDurationMinutes(text: string, exercises: any[]): number | null {
  const durationText = String(text ?? '');
  const compact = durationText.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i);
  if (compact) return Number(compact[1]);

  for (const exercise of exercises) {
    const type = String(exercise?.prescriptionType ?? '').toLowerCase();
    const repsMin = Number(exercise?.prescribedRepsMin);
    const repsMax = Number(exercise?.prescribedRepsMax);
    if (
      type.includes('duration') &&
      Number.isFinite(repsMin) &&
      repsMin > 0 &&
      (!Number.isFinite(repsMax) || repsMax === repsMin)
    ) {
      return repsMin;
    }
  }

  return null;
}

function cleanVisibleTitle(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normaliseVisibleItemKey(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function programTabWorkoutShowsConditioning(workout: ResolvedDay['workout']): boolean {
  if (!workout) return false;
  return (
    (!!workout.hasCombinedConditioning && !!workout.conditioningFlavour) ||
    !!workout.conditioningBlock?.options?.length
  );
}

export function dayWorkoutShowsConditioningAfterStrength(workout: ResolvedDay['workout']): boolean {
  if (!workout) return false;
  const isRecovery =
    workout.workoutType === 'Recovery' ||
    (workout as any).sessionTier === 'recovery';
  const isConditioning = workout.workoutType === 'Conditioning' && !isRecovery;
  const isCombinedDay = !!workout.hasCombinedConditioning && !isConditioning && !isRecovery;
  if (!isCombinedDay && !isRecovery) return false;
  const ids = new Set<string>();
  for (const opt of workout.conditioningBlock?.options ?? []) {
    for (const id of opt.exerciseIds ?? []) ids.add(id);
  }
  if (ids.size === 0) return false;
  const firstConditioningIndex = (workout.exercises ?? []).findIndex((ex) => ids.has(ex.id));
  if (isRecovery) return firstConditioningIndex >= 0;
  return firstConditioningIndex > 0;
}

function normalizeVisibleText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function collectWorkoutVisibleText(workout: ResolvedDay['workout']): string {
  if (!workout) return '';
  const parts: string[] = [
    workout.name,
    workout.description,
    ...(workout.coachNotes ?? []),
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  for (const opt of workout.conditioningBlock?.options ?? []) {
    if (typeof opt.title === 'string') parts.push(opt.title);
    if (typeof opt.description === 'string') parts.push(opt.description);
  }

  for (const ex of workout.exercises ?? []) {
    const anyEx = ex as any;
    [
      anyEx.notes,
      anyEx.exercise?.name,
      anyEx.exercise?.description,
    ].forEach((value) => {
      if (typeof value === 'string' && value.trim()) parts.push(value);
    });
  }

  return normalizeVisibleText(parts.join(' '));
}

export function workoutShowsExpectedActivity(
  workout: ResolvedDay['workout'],
  activityTitle: string | null | undefined,
): boolean {
  const needle = normalizeVisibleText(activityTitle ?? '');
  if (!workout || !needle) return false;
  return collectWorkoutVisibleText(workout).includes(needle);
}

export interface RenderedMutationVerification {
  requestedDay: string;
  todayISO: string;
  targetDate: string;
  targetWorkoutBeforeName: string | null;
  targetWorkoutAfterName: string | null;
  beforeHasConditioning: boolean;
  afterHasConditioning: boolean;
  overrideKeyWritten: boolean;
  programTabProjectionHasConditioning: boolean;
  dayWorkoutProjectionHasConditioning: boolean;
  expectedActivityTitle?: string | null;
  programTabProjectionHasExpectedActivity?: boolean;
  dayWorkoutProjectionHasExpectedActivity?: boolean;
}

export function verifyRenderedProgramMutation(args: {
  requestedDay: string;
  todayISO: string;
  targetDate: string;
  beforeWorkout?: ResolvedDay['workout'] | null;
  expectedActivityTitle?: string | null;
}): RenderedMutationVerification {
  const programStore = useProgramStore.getState();
  const state = buildScheduleStateImperative();
  const overrideContexts = programStore.overrideContexts ?? {};
  const targetWeekStart = getMondayForDate(args.targetDate);
  const programTabWeek = buildProgramTabProjectedWeek({
    mondayISO: targetWeekStart,
    todayISO: args.todayISO,
    state,
    overrideContexts,
  });
  const programTabTarget = programTabWeek.find((d) => d.date === args.targetDate);
  const dayWorkoutTarget = buildDayWorkoutProjectedDay({
    date: args.targetDate,
    todayISO: args.todayISO,
    state,
    overrideContext: overrideContexts[args.targetDate],
  });
  const beforeHasConditioning =
    programTabWorkoutShowsConditioning(args.beforeWorkout) ||
    dayWorkoutShowsConditioningAfterStrength(args.beforeWorkout);
  const afterWorkout = dayWorkoutTarget.workout ?? programTabTarget?.workout ?? null;
  const expectedActivityTitle = args.expectedActivityTitle ?? null;
  const programTabProjectionHasExpectedActivity = workoutShowsExpectedActivity(
    programTabTarget?.workout ?? null,
    expectedActivityTitle,
  );
  const dayWorkoutProjectionHasExpectedActivity = workoutShowsExpectedActivity(
    dayWorkoutTarget.workout,
    expectedActivityTitle,
  );
  const out: RenderedMutationVerification = {
    requestedDay: args.requestedDay,
    todayISO: args.todayISO,
    targetDate: args.targetDate,
    targetWorkoutBeforeName: args.beforeWorkout?.name ?? null,
    targetWorkoutAfterName: afterWorkout?.name ?? null,
    beforeHasConditioning,
    afterHasConditioning:
      programTabWorkoutShowsConditioning(afterWorkout) ||
      dayWorkoutShowsConditioningAfterStrength(afterWorkout) ||
      programTabProjectionHasExpectedActivity ||
      dayWorkoutProjectionHasExpectedActivity,
    overrideKeyWritten: !!programStore.dateOverrides?.[args.targetDate],
    programTabProjectionHasConditioning: programTabWorkoutShowsConditioning(programTabTarget?.workout ?? null),
    dayWorkoutProjectionHasConditioning: dayWorkoutShowsConditioningAfterStrength(dayWorkoutTarget.workout),
    expectedActivityTitle,
    programTabProjectionHasExpectedActivity,
    dayWorkoutProjectionHasExpectedActivity,
  };
  logger.debug('[coach-mutation-target]', out);
  return out;
}

// ─── Exercise-swap verification (Phase B) ──────────────────────────
//
// Mirrors the conditioning verifier above but reports presence of the
// `from` (old) and `to` (new) exercise names in BOTH the Program-tab
// projection and the DayWorkout projection. The executor's success
// criterion is fromName absent on both surfaces AND toName present on
// both. Anything weaker leaves the user on a "Done" reply that isn't
// actually visible.
//
// Matching is case-insensitive. We deliberately do NOT do fuzzy/pool
// resolution here — the executor has already canonicalised the names
// before calling this, and the verifier's job is to read the visible
// truth, not to second-guess it.

export interface RenderedExerciseSwapVerification {
  requestedDay: string;
  todayISO: string;
  targetDate: string;
  fromName: string;
  toName: string;
  programTabHasFromExercise: boolean;
  programTabHasToExercise: boolean;
  dayWorkoutHasFromExercise: boolean;
  dayWorkoutHasToExercise: boolean;
  overrideKeyWritten: boolean;
}

function workoutContainsExerciseName(
  workout: ResolvedDay['workout'] | null | undefined,
  needle: string,
): boolean {
  if (!workout) return false;
  const target = needle.trim().toLowerCase();
  if (!target) return false;
  for (const ex of workout.exercises ?? []) {
    const name = (ex.exercise?.name ?? '').trim().toLowerCase();
    if (name === target) return true;
  }
  return false;
}

// ─── Session-move verification (Phase C) ──────────────────────────
//
// A move pulls one session from `sourceDate` to `destDate`. Verification
// must confirm BOTH dates flipped on BOTH render surfaces (Program tab
// projection + DayWorkout projection):
//   • sourceDate no longer shows the moved session name
//   • destDate now shows the moved session name
// `sourceWorkoutAfterName` exposes whatever the source date renders post-
// move (typically "Rest" — but the executor doesn't second-guess this,
// it just records it for observability).
//
// Match is a case-insensitive containment check on the workout's name —
// "Lower Body Strength" survives any prefix/suffix decoration the
// projection applies (e.g. "Lower Body Strength + Aerobic Base finisher").

export interface RenderedSessionMoveVerification {
  requestedDay: string;
  todayISO: string;
  sourceDate: string;
  destDate: string;
  movedSessionName: string;
  /** Name on source date after the move — usually "Rest". */
  sourceWorkoutAfterName: string | null;
  /** Name on dest date after the move — should contain `movedSessionName`. */
  destWorkoutAfterName: string | null;
  programTabSourceHasMoved: boolean;   // true iff source still shows the moved name (BAD)
  programTabDestHasMoved: boolean;     // true iff dest now shows the moved name (GOOD)
  dayWorkoutSourceHasMoved: boolean;
  dayWorkoutDestHasMoved: boolean;
  sourceOverrideKeyWritten: boolean;
  destOverrideKeyWritten: boolean;
}

function workoutNameMatches(
  workout: ResolvedDay['workout'] | null | undefined,
  needle: string,
): boolean {
  if (!workout) return false;
  const target = needle.trim().toLowerCase();
  if (!target) return false;
  const name = (workout.name ?? '').trim().toLowerCase();
  if (!name) return false;
  return name === target || name.includes(target) || target.includes(name);
}

export function verifyRenderedSessionMove(args: {
  requestedDay: string;
  todayISO: string;
  sourceDate: string;
  destDate: string;
  movedSessionName: string;
}): RenderedSessionMoveVerification {
  const programStore = useProgramStore.getState();
  const state = buildScheduleStateImperative();
  const overrideContexts = programStore.overrideContexts ?? {};

  // Both the source and dest weeks may matter — resolve both. Most of
  // the time they'll be the same week; a Sunday→next-Monday move spans.
  const weeks = Array.from(
    new Set([getMondayForDate(args.sourceDate), getMondayForDate(args.destDate)]),
  );
  const programTabDays: ResolvedDay[] = [];
  for (const monday of weeks) {
    const w = buildProgramTabProjectedWeek({
      mondayISO: monday,
      todayISO: args.todayISO,
      state,
      overrideContexts,
    });
    programTabDays.push(...w);
  }
  const programTabSource = programTabDays.find((d) => d.date === args.sourceDate);
  const programTabDest = programTabDays.find((d) => d.date === args.destDate);
  const dayWorkoutSource = buildDayWorkoutProjectedDay({
    date: args.sourceDate,
    todayISO: args.todayISO,
    state,
    overrideContext: overrideContexts[args.sourceDate],
  });
  const dayWorkoutDest = buildDayWorkoutProjectedDay({
    date: args.destDate,
    todayISO: args.todayISO,
    state,
    overrideContext: overrideContexts[args.destDate],
  });

  const out: RenderedSessionMoveVerification = {
    requestedDay: args.requestedDay,
    todayISO: args.todayISO,
    sourceDate: args.sourceDate,
    destDate: args.destDate,
    movedSessionName: args.movedSessionName,
    sourceWorkoutAfterName: dayWorkoutSource.workout?.name ?? programTabSource?.workout?.name ?? null,
    destWorkoutAfterName: dayWorkoutDest.workout?.name ?? programTabDest?.workout?.name ?? null,
    programTabSourceHasMoved: workoutNameMatches(programTabSource?.workout ?? null, args.movedSessionName),
    programTabDestHasMoved: workoutNameMatches(programTabDest?.workout ?? null, args.movedSessionName),
    dayWorkoutSourceHasMoved: workoutNameMatches(dayWorkoutSource.workout ?? null, args.movedSessionName),
    dayWorkoutDestHasMoved: workoutNameMatches(dayWorkoutDest.workout ?? null, args.movedSessionName),
    sourceOverrideKeyWritten: !!programStore.dateOverrides?.[args.sourceDate],
    destOverrideKeyWritten: !!programStore.dateOverrides?.[args.destDate],
  };
  logger.debug('[coach-mutation-session-move]', out);
  return out;
}

export function verifyRenderedExerciseSwap(args: {
  requestedDay: string;
  todayISO: string;
  targetDate: string;
  fromName: string;
  toName: string;
}): RenderedExerciseSwapVerification {
  const programStore = useProgramStore.getState();
  const state = buildScheduleStateImperative();
  const overrideContexts = programStore.overrideContexts ?? {};
  const targetWeekStart = getMondayForDate(args.targetDate);
  const programTabWeek = buildProgramTabProjectedWeek({
    mondayISO: targetWeekStart,
    todayISO: args.todayISO,
    state,
    overrideContexts,
  });
  const programTabTarget = programTabWeek.find((d) => d.date === args.targetDate);
  const dayWorkoutTarget = buildDayWorkoutProjectedDay({
    date: args.targetDate,
    todayISO: args.todayISO,
    state,
    overrideContext: overrideContexts[args.targetDate],
  });
  const out: RenderedExerciseSwapVerification = {
    requestedDay: args.requestedDay,
    todayISO: args.todayISO,
    targetDate: args.targetDate,
    fromName: args.fromName,
    toName: args.toName,
    programTabHasFromExercise: workoutContainsExerciseName(programTabTarget?.workout ?? null, args.fromName),
    programTabHasToExercise: workoutContainsExerciseName(programTabTarget?.workout ?? null, args.toName),
    dayWorkoutHasFromExercise: workoutContainsExerciseName(dayWorkoutTarget.workout ?? null, args.fromName),
    dayWorkoutHasToExercise: workoutContainsExerciseName(dayWorkoutTarget.workout ?? null, args.toName),
    overrideKeyWritten: !!programStore.dateOverrides?.[args.targetDate],
  };
  logger.debug('[coach-mutation-exercise-swap]', out);
  return out;
}
