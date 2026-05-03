/**
 * applyAdjustmentEvents.ts — Stage 3 of the Universal Adjustment Engine.
 *
 * The engine (programAdjustmentEngine.ts) emits a list of AdjustmentEvents
 * describing structural changes to make. This helper translates those events
 * into REAL store writes via the existing `setManualOverride` pathway, so
 * the change is visible in the Program tab and persists on disk.
 *
 * CONTRACT
 *   Input:  events: AdjustmentEvent[]   (already validated by the engine)
 *           opts:   { todayISO, getNow? }
 *   Effect: writes / removes overrides on `useProgramStore`
 *           (one setManualOverride call per touched date — multiple events
 *           on the same date are folded into a single override).
 *   Output: { applied: AppliedAdjustment[], rejected: RejectedAdjustment[] }
 *
 * RULES
 *   R1. Future-only — events whose date is strictly before todayISO are
 *       rejected without writing anything.
 *   R2. Date matching uses the actual resolved week. Events whose date does
 *       not correspond to a resolved day in the live ScheduleState are
 *       rejected (fail-loud — engine should never emit dates outside the
 *       resolved week, but we surface that mismatch instead of silently
 *       constructing fake state).
 *   R3. Multiple events on the same date are applied in event order to the
 *       same working workout, and a SINGLE setManualOverride call writes
 *       the final state. Earlier events are not lost.
 *   R4. set_session_recovery is terminal for that date — any later events
 *       on the same date are rejected as redundant ("session is now
 *       recovery; nothing else to apply").
 *   R5. remove_exercise rejects the event when the named exercise isn't
 *       present in the working workout (e.g. it was already removed by an
 *       earlier event in the same batch).
 *   R6. The helper NEVER constructs dates or reaches for `new Date()`.
 *       todayISO must be supplied by the caller.
 */

import { useProgramStore } from '../store/programStore';
import {
  resolveWeekWithConditioning,
  getMondayStr,
  type ResolvedDay,
  type ScheduleState,
} from './sessionResolver';
import type { Workout, OverrideContext } from '../types/domain';
import type {
  AdjustmentEvent,
  RejectedAdjustment,
} from './programAdjustmentEngine';
import { logger } from './logger';

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export interface ApplyOptions {
  /** YYYY-MM-DD — the engine's clock. Past-date events are rejected. */
  todayISO: string;
  /**
   * Optional ScheduleState supplier. Defaults to the live store via
   * `buildScheduleStateImperative`. Tests inject a stub.
   */
  buildState?: () => ScheduleState;
  /**
   * Optional resolver. Defaults to `resolveWeekWithConditioning`. Tests
   * inject a stub so the helper sees a deterministic week.
   */
  resolveWeek?: (monday: string, state: ScheduleState) => ResolvedDay[];
  /**
   * Optional override writer. Defaults to the live store. Tests inject a
   * stub so the test harness can capture writes without touching zustand.
   */
  setManualOverride?: (
    date: string,
    workout: Workout,
    context?: OverrideContext,
  ) => void;
}

export interface AppliedAdjustment {
  /** ISO date the event was applied to. */
  date: string;
  /** Event ids merged into this date's single override write. */
  eventIds: string[];
  /** Final workout name written to the override. */
  workoutName: string;
}

export interface ApplyEventsResult {
  applied: AppliedAdjustment[];
  rejected: RejectedAdjustment[];
}

// ─────────────────────────────────────────────────────────────────────────
// REJECTION KINDS
// ─────────────────────────────────────────────────────────────────────────

export const APPLY_REJECT_KIND = {
  PAST_DATE: 'past_date_blocked',
  NO_RESOLVED_DAY: 'no_resolved_day',
  NO_WORKOUT_ON_DATE: 'no_workout_on_date',
  /**
   * Catch-all for events whose date didn't validate against the live
   * resolved week. Distinguishes "engine emitted an event for a date
   * that doesn't exist in the user's program" from the more specific
   * "session has no workout" / "past date" rejections.
   */
  INVALID_TARGET_DATE: 'invalid_target_date',
  EXERCISE_NOT_PRESENT: 'exercise_not_present',
  REDUNDANT_AFTER_RECOVERY: 'redundant_after_recovery',
  NO_CONDITIONING_TO_SWAP: 'no_conditioning_to_swap',
  UNHANDLED_EVENT: 'unhandled_event',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Run-modality conditioning → off-feet replacement. Stage 3 keeps this
 * intentionally conservative: any run-tagged conditioning swaps to a
 * tier-matched bike option. We deliberately don't try to preserve sprint
 * fidelity — for an injury, off-feet output is what matters.
 */
const RUN_TO_OFFFEET: Record<string, string> = {
  // Tier A
  'Sprint Intervals': 'Max Effort Sprint Accumulation',
  'Hill Sprints': 'Max Effort Sprint Accumulation',
  'Quality Sprints': 'Max Effort Sprint Accumulation',
  'MAS Training': 'Max Effort Sprint Accumulation',
  'Flying Sprints': 'Max Effort Sprint Accumulation',
  'MAS 15:15 Blocks': 'Max Effort Sprint Accumulation',
  'Free Sprint Session': 'Max Effort Sprint Accumulation',
  'Flog Friday': 'Hard Assault Bike Intervals',
  // Tier B-high
  'Long Run': 'Hard Assault Bike Intervals',
  '6x1km': 'Hard Assault Bike Intervals',
  '1km Repeat Intervals': 'Hard Assault Bike Intervals',
  '200m/400m Repeat Runs': 'Hard Assault Bike Intervals',
  'Footy Fartlek': 'Hard Assault Bike Intervals',
  // Tier B-low
  'Tempo Run': 'Assault Bike Intervals',
  'Long Nasal Run': 'Assault Bike Intervals',
  // Tier C
  'Flush Run': 'Easy Bike',
};

/** Default off-feet fallback when the run name isn't in the map above. */
const DEFAULT_OFFFEET = 'Assault Bike Intervals';

/** Deep-enough Workout copy. Mirrors `cloneWorkout` in coachActions.ts. */
function cloneWorkout(w: Workout, overrides: Partial<Workout> = {}): Workout {
  return {
    ...w,
    exercises: w.exercises.map((ex) => ({ ...ex })),
    coachNotes: w.coachNotes ? [...w.coachNotes] : undefined,
    ...overrides,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Append a coach note to a workout's `coachNotes` array, deduplicating
 * (a single user message can produce two events that synthesize the
 * same text). Returns a fresh array — the caller owns folding it back
 * into the workout via cloneWorkout.
 */
function appendCoachNote(
  current: Workout,
  note: string,
): string[] {
  const existing = current.coachNotes ?? [];
  if (existing.includes(note)) return existing;
  return [...existing, note];
}

/** Lazy import — avoid evaluating store-touching modules at test load. */
function defaultBuildState(): ScheduleState {
  // require() so the import isn't pulled in until apply runs.
  // Tests inject `buildState` instead.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildScheduleStateImperative } = require('./coachWeekDiff');
  return buildScheduleStateImperative();
}

/**
 * Wipe all injury-tagged manual overrides whose date falls inside the
 * given Mon-Sun week. Used by the progression flow before re-running
 * the engine at a new severity — keeps the resolver returning the
 * fresh template state until new overrides land.
 *
 * Returns the dates that were cleared (for logging / tests).
 */
export function removeInjuryOverridesForWeek(weekStartISO: string): string[] {
  const store = useProgramStore.getState();
  const cleared: string[] = [];
  // Build the seven dates Mon..Sun.
  const weekDates = new Set<string>();
  for (let i = 0; i < 7; i++) {
    weekDates.add(addDaysISO(weekStartISO, i));
  }
  for (const [date, ctx] of Object.entries(store.overrideContexts ?? {})) {
    if (!weekDates.has(date)) continue;
    if ((ctx as OverrideContext)?.intent !== 'injury') continue;
    store.removeManualOverride(date);
    cleared.push(date);
  }
  logger.debug('[pipeline] removeInjuryOverridesForWeek', {
    weekStartISO,
    cleared,
  });
  return cleared;
}

function addDaysISO(iso: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function defaultSetManualOverride(
  date: string,
  workout: Workout,
  context?: OverrideContext,
): void {
  // Runtime log: confirms the actual store write happened, with the
  // values we're committing. Pair this with [pipeline] traces in
  // CoachScreen + the [pipeline] resolver post-write check.
  logger.debug('[pipeline] setManualOverride', {
    date,
    name: workout.name,
    workoutType: workout.workoutType,
    sessionTier: workout.sessionTier,
    coachNotes: workout.coachNotes ?? [],
    descriptionHasNote: /\[/.test(workout.description ?? ''),
    contextIntent: context?.intent ?? null,
  });
  useProgramStore.getState().setManualOverride(date, workout, context);
  // Read-back: confirm the override actually landed in the store.
  const after = useProgramStore.getState().dateOverrides[date];
  logger.debug('[pipeline] dateOverrides after write', {
    date,
    landed: !!after,
    landedName: after?.name ?? null,
    landedNotes: after?.coachNotes ?? [],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PER-EVENT MUTATORS
//
// Each takes the current working workout and returns either the new
// workout or a rejection reason. None of these touch the store directly —
// the orchestrator below is the only place that writes overrides.
// ─────────────────────────────────────────────────────────────────────────

type MutateOk = { ok: true; workout: Workout };
type MutateErr = { ok: false; rejectKind: string; reason: string };
type MutateResult = MutateOk | MutateErr;

/**
 * Replace a risky exercise with a curated safe alternative. The new
 * exercise inherits the original's prescribedSets / reps / weights —
 * we only swap the name + description so the user sees a different
 * movement on the Program tab. (More sophisticated load adjustments
 * land via lighten_session / set_session_recovery.)
 */
function applyReplaceExercise(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  const target = String(event.before ?? '').trim();
  const replacement = String(event.after ?? '').trim();
  if (!target || !replacement) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.EXERCISE_NOT_PRESENT,
      reason: 'replace_exercise event missing before/after names',
    };
  }
  const lower = target.toLowerCase();
  let touched = false;
  const newExercises = current.exercises.map((ex) => {
    const name = (ex.exercise?.name || '');
    if (name.toLowerCase() !== lower) return ex;
    touched = true;
    return {
      ...ex,
      exercise: ex.exercise
        ? { ...ex.exercise, name: replacement, description: replacement }
        : ex.exercise,
    };
  });
  if (!touched) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.EXERCISE_NOT_PRESENT,
      reason: `"${target}" not present in workout on ${event.date}`,
    };
  }
  return {
    ok: true,
    workout: cloneWorkout(current, {
      exercises: newExercises,
      coachNotes: appendCoachNote(current, `Replaced ${target} with ${replacement}`),
    }),
  };
}

function applyRemoveExercise(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  const target = String(event.before ?? '').trim();
  if (!target) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.EXERCISE_NOT_PRESENT,
      reason: 'remove_exercise event missing before-name',
    };
  }
  const lower = target.toLowerCase();
  const before = current.exercises.length;
  const filtered = current.exercises.filter((ex) => {
    const n = (ex.exercise?.name || '').toLowerCase();
    return n !== lower;
  });
  if (filtered.length === before) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.EXERCISE_NOT_PRESENT,
      reason: `"${target}" not present in workout on ${event.date}`,
    };
  }
  return {
    ok: true,
    workout: cloneWorkout(current, {
      exercises: filtered,
      coachNotes: appendCoachNote(current, `Removed: ${target}`),
    }),
  };
}

function applySetSessionRecovery(
  current: Workout,
  _event: AdjustmentEvent,
): MutateResult {
  const recovery = cloneWorkout(current, {
    name: 'Recovery',
    description:
      'Light mobility / walk. Injury-protected — no loaded work today.',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    hasCombinedConditioning: false,
    conditioningBlock: undefined,
    exercises: [],
    coachNotes: appendCoachNote(current, 'Switched to recovery (injury)'),
  });
  return { ok: true, workout: recovery };
}

function applyLightenSession(
  current: Workout,
  _event: AdjustmentEvent,
): MutateResult {
  const lightened = cloneWorkout(current, {
    sessionTier: 'optional',
    description:
      ((current.description || '').trim() +
        ' [Injury-lightened — optional this week]').trim(),
    exercises: current.exercises.map((ex) => ({
      ...ex,
      prescribedSets: Math.max(1, Math.ceil((ex.prescribedSets || 1) / 2)),
    })),
    coachNotes: appendCoachNote(current, 'Lightened — optional this week'),
  });
  return { ok: true, workout: lightened };
}

function applyMarkSessionOptional(
  current: Workout,
  _event: AdjustmentEvent,
): MutateResult {
  const optional = cloneWorkout(current, {
    sessionTier: 'optional',
    description:
      ((current.description || '').trim() + ' [Marked optional]').trim(),
    coachNotes: appendCoachNote(current, 'Marked optional this week'),
  });
  return { ok: true, workout: optional };
}

/**
 * Append an exposure-avoidance note to the workout WITHOUT changing its
 * tier or sets. Used for team training and other sessions where the
 * modification we want is "athlete avoids specific drills" rather than
 * "skip the whole thing".
 *
 * The note text comes from `event.after`. We write it to BOTH the
 * structured `coachNotes` array (which the Program tab and day-detail
 * screen render as a visible badge list) AND the legacy `description`
 * suffix (so older surfaces still see it). If after is missing or empty
 * the event is rejected — the engine should never emit a noteless note.
 */
function applyAddSessionNote(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  const note = typeof event.after === 'string' ? event.after.trim() : '';
  if (!note) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.UNHANDLED_EVENT,
      reason: 'add_session_note requires event.after as note text',
    };
  }
  const noted = cloneWorkout(current, {
    description: ((current.description || '').trim() + ` [${note}]`).trim(),
    coachNotes: appendCoachNote(current, note),
  });
  return { ok: true, workout: noted };
}

function applySwapConditioningModality(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  // Strategy: rewrite any exercise whose name appears in RUN_TO_OFFFEET
  // (i.e. any run-modality conditioning movement). Also rewrite the
  // matching titles inside conditioningBlock.options. If nothing changed,
  // reject — there was no run-modality conditioning to swap.
  let touched = false;

  const newExercises = current.exercises.map((ex) => {
    const name = ex.exercise?.name || '';
    const replacement = RUN_TO_OFFFEET[name];
    if (!replacement) return ex;
    touched = true;
    return {
      ...ex,
      exercise: ex.exercise
        ? { ...ex.exercise, name: replacement, description: replacement }
        : ex.exercise,
    };
  });

  let newBlock = current.conditioningBlock;
  if (newBlock?.options?.length) {
    const newOptions = newBlock.options.map((opt) => {
      const replacement = RUN_TO_OFFFEET[opt.title];
      if (!replacement) return opt;
      touched = true;
      return { ...opt, title: replacement };
    });
    newBlock = { ...newBlock, options: newOptions };
  }

  // If we found NOTHING but the workout is conditioning-flavoured, fall
  // back to a generic off-feet exercise on the first slot. This mirrors
  // the engine's fallback rule: a swap event implies the engine intended
  // a real change, and we owe the athlete at least one visible swap.
  if (!touched) {
    const isConditioning = current.workoutType === 'Conditioning';
    if (isConditioning && current.exercises.length > 0) {
      const first = current.exercises[0];
      newExercises[0] = {
        ...first,
        exercise: first.exercise
          ? {
              ...first.exercise,
              name: DEFAULT_OFFFEET,
              description: DEFAULT_OFFFEET,
            }
          : first.exercise,
      };
      touched = true;
    }
  }

  if (!touched) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
      reason: `no run-modality conditioning to swap on ${event.date}`,
    };
  }

  return {
    ok: true,
    workout: cloneWorkout(current, {
      exercises: newExercises,
      conditioningBlock: newBlock,
      description:
        ((current.description || '').trim() +
          ' [Off-feet — injury swap]').trim(),
      coachNotes: appendCoachNote(current, 'Swapped running for off-feet (bike / row)'),
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN ENTRY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Apply a list of AdjustmentEvents to the live program state.
 *
 * Per-date orchestration:
 *   1. Resolve the day in the live week. If no resolved day or no workout
 *      on that day → reject.
 *   2. Walk events in order, mutating an in-memory working workout. Track
 *      whether the day has been turned into a recovery shell — once it has,
 *      reject any subsequent same-date events as redundant.
 *   3. Once all events for the date are processed, write the final working
 *      workout via setManualOverride (single write per date).
 */
export function applyAdjustmentEvents(
  events: AdjustmentEvent[],
  opts: ApplyOptions,
): ApplyEventsResult {
  const { todayISO } = opts;
  const buildState = opts.buildState || defaultBuildState;
  const resolveWeek = opts.resolveWeek || resolveWeekWithConditioning;
  const setOverride = opts.setManualOverride || defaultSetManualOverride;

  const applied: AppliedAdjustment[] = [];
  const rejected: RejectedAdjustment[] = [];

  if (!Array.isArray(events) || events.length === 0) {
    return { applied, rejected };
  }

  // Resolve the current week ONCE — all events should reference dates in
  // this window. The engine also operates on this same window, so any
  // mismatch is a real bug worth surfacing rather than silently fixing.
  const state = buildState();
  const monday = mondayOfISOLocal(todayISO);
  const week = resolveWeek(monday, state);
  const dayByDate: Record<string, ResolvedDay> = {};
  for (const d of week) dayByDate[d.date] = d;

  // ── Per-event validation pass ─────────────────────────────────────
  // For EACH event log target validity: did a resolved day exist for
  // its date, was the date >= todayISO, etc. Reject with a categorical
  // kind so the dispatcher can explain WHY events failed to land.
  logger.debug('[apply-events] received', {
    eventCount: Array.isArray(events) ? events.length : 0,
    todayISO,
    monday,
    weekDates: week.map((d) => d.date),
  });

  const groups: Record<string, AdjustmentEvent[]> = {};
  for (const ev of events) {
    if (typeof ev.date !== 'string' || !ev.date) {
      logger.debug('[apply-events] rejected', {
        kind: 'invalid_event',
        reason: 'event missing date',
        eventKind: ev?.kind,
      });
      rejected.push({
        kind: 'invalid_event',
        reason: 'event missing date',
      });
      continue;
    }
    if (ev.date < todayISO) {
      logger.debug('[apply-events] rejected', {
        kind: APPLY_REJECT_KIND.PAST_DATE,
        date: ev.date,
        eventKind: ev.kind,
        reason: `past date (${ev.date} < ${todayISO})`,
      });
      rejected.push({
        kind: APPLY_REJECT_KIND.PAST_DATE,
        date: ev.date,
        reason: `cannot apply event on past date ${ev.date}`,
      });
      continue;
    }
    // Stricter: the event MUST point to a date inside the resolved
    // week. Anything outside is INVALID_TARGET_DATE so the engine /
    // dispatcher can surface the misalignment instead of silently
    // dropping the event.
    if (!dayByDate[ev.date]) {
      logger.debug('[apply-events] rejected', {
        kind: APPLY_REJECT_KIND.INVALID_TARGET_DATE,
        date: ev.date,
        eventKind: ev.kind,
        reason: `date ${ev.date} is not in the resolved week (${week[0]?.date}..${week[week.length - 1]?.date})`,
      });
      rejected.push({
        kind: APPLY_REJECT_KIND.INVALID_TARGET_DATE,
        date: ev.date,
        reason: `date ${ev.date} not in resolved week`,
      });
      continue;
    }
    logger.debug('[apply-events] target_validated', {
      date: ev.date,
      kind: ev.kind,
      before: ev.before ?? null,
      resolvedSource: (dayByDate[ev.date] as any).source ?? null,
      resolvedWorkoutName: dayByDate[ev.date].workout?.name ?? null,
    });
    if (!groups[ev.date]) groups[ev.date] = [];
    groups[ev.date].push(ev);
  }

  // Apply each date's group in isolation.
  for (const date of Object.keys(groups).sort()) {
    const group = groups[date];
    const resolved = dayByDate[date];
    if (!resolved) {
      for (const ev of group) {
        logger.debug('[apply-events] rejected', {
          kind: APPLY_REJECT_KIND.NO_RESOLVED_DAY,
          date,
          eventKind: ev.kind,
        });
        rejected.push({
          kind: APPLY_REJECT_KIND.NO_RESOLVED_DAY,
          date,
          reason: `no resolved day for ${date} in current week`,
        });
      }
      continue;
    }
    if (!resolved.workout) {
      for (const ev of group) {
        logger.debug('[apply-events] rejected', {
          kind: APPLY_REJECT_KIND.NO_WORKOUT_ON_DATE,
          date,
          eventKind: ev.kind,
        });
        rejected.push({
          kind: APPLY_REJECT_KIND.NO_WORKOUT_ON_DATE,
          date,
          reason: `${date} has no workout to adjust`,
        });
      }
      continue;
    }

    // ── Per-date pre-mutation snapshot ─────────────────────────────
    // Capture name + exercise-name list BEFORE any event runs so the
    // before/after diff in the post-write log is concrete.
    const beforeName = resolved.workout.name;
    const beforeExercises = (resolved.workout.exercises ?? [])
      .map((e: any) => e.exercise?.name)
      .filter(Boolean);
    logger.debug('[apply-events] date_pre_mutation', {
      date,
      beforeName,
      beforeExercises,
      eventCount: group.length,
    });

    let working: Workout = resolved.workout;
    let recoveryActive = false;
    const mergedEventIds: string[] = [];
    let lastReason = '';

    for (const ev of group) {
      if (recoveryActive) {
        logger.debug('[apply-events] rejected', {
          kind: APPLY_REJECT_KIND.REDUNDANT_AFTER_RECOVERY,
          date,
          eventKind: ev.kind,
          reason: 'session already converted to recovery',
        });
        rejected.push({
          kind: APPLY_REJECT_KIND.REDUNDANT_AFTER_RECOVERY,
          date,
          reason: `${ev.kind} on ${date} skipped — session already converted to recovery`,
        });
        continue;
      }

      let outcome: MutateResult;
      switch (ev.kind) {
        case 'remove_exercise':
          outcome = applyRemoveExercise(working, ev);
          break;
        case 'replace_exercise':
          outcome = applyReplaceExercise(working, ev);
          break;
        case 'set_session_recovery':
          outcome = applySetSessionRecovery(working, ev);
          break;
        case 'lighten_session':
          outcome = applyLightenSession(working, ev);
          break;
        case 'mark_session_optional':
          outcome = applyMarkSessionOptional(working, ev);
          break;
        case 'swap_conditioning_modality':
          outcome = applySwapConditioningModality(working, ev);
          break;
        case 'add_session_note':
          outcome = applyAddSessionNote(working, ev);
          break;
        default:
          outcome = {
            ok: false,
            rejectKind: APPLY_REJECT_KIND.UNHANDLED_EVENT,
            reason: `event kind '${ev.kind}' has no applier`,
          };
      }

      if (outcome.ok === false) {
        logger.debug('[apply-events] rejected', {
          kind: outcome.rejectKind,
          date,
          eventKind: ev.kind,
          before: ev.before ?? null,
          reason: outcome.reason,
        });
        rejected.push({
          kind: outcome.rejectKind,
          date,
          reason: outcome.reason,
        });
        continue;
      }

      logger.debug('[apply-events] applied', {
        date,
        eventKind: ev.kind,
        before: ev.before ?? null,
        after: ev.after ?? null,
        workoutName: outcome.workout.name,
        exerciseCount: outcome.workout.exercises?.length ?? 0,
      });

      working = outcome.workout;
      mergedEventIds.push(ev.id);
      lastReason = ev.reason || lastReason;
      if (ev.kind === 'set_session_recovery') recoveryActive = true;
    }

    if (mergedEventIds.length === 0) {
      // Every event on this date was rejected — don't write an override.
      logger.debug('[apply-events] no_override_written', {
        date,
        reason: 'all events for date were rejected',
      });
      continue;
    }

    const ctx: OverrideContext = {
      intent: 'injury',
      label: lastReason || 'Injury-driven adjustment',
    };
    setOverride(date, working, ctx);

    // After-write per-date log: explicit before/after on the fields
    // the UI actually renders (name + exercise names + coachNotes).
    const afterExercises = (working.exercises ?? [])
      .map((e: any) => e.exercise?.name)
      .filter(Boolean);
    logger.debug('[apply-events] date_post_mutation', {
      date,
      beforeName,
      afterName: working.name,
      beforeExercises,
      afterExercises,
      coachNotes: working.coachNotes ?? [],
      eventsApplied: mergedEventIds.length,
    });

    applied.push({
      date,
      eventIds: mergedEventIds,
      workoutName: working.name,
    });
  }

  logger.debug('[apply-events] result', {
    appliedCount: applied.length,
    rejectedCount: rejected.length,
    appliedDates: applied.map((a) => a.date),
    rejectedKinds: rejected.map((r) => r.kind),
  });

  return { applied, rejected };
}

// ─────────────────────────────────────────────────────────────────────────
// LOCAL DATE UTILITY  (avoids re-importing engine helpers we don't need)
// ─────────────────────────────────────────────────────────────────────────

/** Local copy of mondayOfISO; intentionally duplicated to keep this helper
 *  decoupled from the engine's exact module surface. Same algorithm. */
function mondayOfISOLocal(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    // Fallback to the resolver's own helper, which uses the live clock.
    return getMondayStr(0);
  }
  const [y, m, d] = iso.split('-').map(Number);
  const anchor = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = anchor.getDay();
  const offset = dow === 0 ? -6 : -(dow - 1);
  anchor.setDate(anchor.getDate() + offset);
  const yy = anchor.getFullYear();
  const mm = String(anchor.getMonth() + 1).padStart(2, '0');
  const dd = String(anchor.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
