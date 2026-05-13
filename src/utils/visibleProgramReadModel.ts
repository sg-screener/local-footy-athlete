import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
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
  const extraConstraints = buildExtraConstraintsForVisibleProgram(args.state.activeConstraints ?? []);
  const prefs =
    args.modalityPreferences ??
    useCoachPreferencesStore.getState().modalityPreferences;
  return rawWeek.map((day) =>
    projectVisibleDay({
      day,
      activeInjury: args.state.activeInjury
        ? { ...args.state.activeInjury, rules: args.state.activeInjury.rules ?? [] }
        : null,
      extraConstraints,
      overrideContext: args.overrideContexts?.[day.date],
      todayISO: args.todayISO,
      modalityPreferences: prefs,
    }).day,
  );
}

export function buildDayWorkoutProjectedDay(args: {
  date: string;
  todayISO: string;
  state: ScheduleState & { activeConstraints?: any[] };
  overrideContext?: any;
  modalityPreferences?: Record<string, any>;
}): ResolvedDay {
  const raw = resolveDateWithConditioning(args.date, args.state);
  const extraConstraints = buildExtraConstraintsForVisibleProgram(args.state.activeConstraints ?? []);
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

export function programTabWorkoutShowsConditioning(workout: ResolvedDay['workout']): boolean {
  if (!workout) return false;
  return !!workout.hasCombinedConditioning && !!workout.conditioningFlavour;
}

export function dayWorkoutShowsConditioningAfterStrength(workout: ResolvedDay['workout']): boolean {
  if (!workout) return false;
  const isRecovery =
    workout.workoutType === 'Recovery' ||
    (workout as any).sessionTier === 'recovery';
  const isConditioning = workout.workoutType === 'Conditioning' && !isRecovery;
  const isCombinedDay = !!workout.hasCombinedConditioning && !isConditioning && !isRecovery;
  if (!isCombinedDay) return false;
  const ids = new Set<string>();
  for (const opt of workout.conditioningBlock?.options ?? []) {
    for (const id of opt.exerciseIds ?? []) ids.add(id);
  }
  if (ids.size === 0) return false;
  const firstConditioningIndex = (workout.exercises ?? []).findIndex((ex) => ids.has(ex.id));
  return firstConditioningIndex > 0;
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
}

export function verifyRenderedProgramMutation(args: {
  requestedDay: string;
  todayISO: string;
  targetDate: string;
  beforeWorkout?: ResolvedDay['workout'] | null;
}): RenderedMutationVerification {
  const programStore = useProgramStore.getState();
  const coachStore = useCoachUpdatesStore.getState();
  const state = {
    ...buildScheduleStateImperative(),
    activeConstraints: coachStore.activeConstraints ?? [],
  };
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
  const out: RenderedMutationVerification = {
    requestedDay: args.requestedDay,
    todayISO: args.todayISO,
    targetDate: args.targetDate,
    targetWorkoutBeforeName: args.beforeWorkout?.name ?? null,
    targetWorkoutAfterName: afterWorkout?.name ?? null,
    beforeHasConditioning,
    afterHasConditioning:
      programTabWorkoutShowsConditioning(afterWorkout) ||
      dayWorkoutShowsConditioningAfterStrength(afterWorkout),
    overrideKeyWritten: !!programStore.dateOverrides?.[args.targetDate],
    programTabProjectionHasConditioning: programTabWorkoutShowsConditioning(programTabTarget?.workout ?? null),
    dayWorkoutProjectionHasConditioning: dayWorkoutShowsConditioningAfterStrength(dayWorkoutTarget.workout),
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
  const coachStore = useCoachUpdatesStore.getState();
  const state = {
    ...buildScheduleStateImperative(),
    activeConstraints: coachStore.activeConstraints ?? [],
  };
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
  const coachStore = useCoachUpdatesStore.getState();
  const state = {
    ...buildScheduleStateImperative(),
    activeConstraints: coachStore.activeConstraints ?? [],
  };
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
