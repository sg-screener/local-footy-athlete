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
import {
  pickEquivalentByTier,
  applyConditioningModalityToWorkout,
  verifyModalityRewrite,
  inferModalityFromName,
  type ParsedModalitySwap,
  type BikeLabel,
} from './coachModalitySwap';
import { CONDITIONING_META, type ConditioningModality } from '../data/exerciseTags';

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
  /**
   * Default false preserves the original injury path contract: events
   * must target the week containing todayISO. Program-adjustment MVP
   * turns this on so a future Monday can be edited when the current
   * Monday has already passed.
   */
  allowFutureWeeks?: boolean;
  /**
   * Program-adjustment requests may edit an earlier day that is still
   * visible/editable in the Program tab. Default false preserves the
   * injury/UAE contract.
   */
  allowPastDates?: boolean;
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

function buildCoachConditioningExercise(
  current: Workout,
  event: AdjustmentEvent,
): Workout['exercises'][number] {
  const p = (event.after && typeof event.after === 'object') ? event.after as any : {};
  const title = String(p.title ?? 'Light Aerobic Intervals');
  const description = String(
    p.description ??
      '8 x 2 min at 75-80% max HR, with 1 min easy recovery. Use bike or track.',
  );
  const exerciseId = String(p.exerciseId ?? 'coach-light-aerobic-intervals');
  const id = `${current.id || 'workout'}-coach-conditioning-${event.id}`;
  const now = new Date().toISOString();
  return {
    id,
    workoutId: current.id,
    exerciseId,
    exerciseOrder: (current.exercises ?? []).length,
    prescribedSets: Number(p.sets ?? 8),
    prescribedRepsMin: Number(p.repsMin ?? p.minutes ?? 2),
    prescribedRepsMax: Number(p.repsMax ?? p.minutes ?? 2),
    prescriptionType: p.prescriptionType ?? 'duration_minutes',
    prescribedWeightKg: 0,
    restSeconds: Number(p.restSeconds ?? 60),
    notes: String(
      p.notes ??
        '75-80% max HR. Keep it aerobic; 1 min easy recovery between reps.',
    ),
    exercise: {
      id: exerciseId,
      name: title,
      description,
      exerciseType: 'Cardio',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: now,
      updatedAt: now,
    } as any,
    createdAt: now,
    updatedAt: now,
  };
}

function applyReplaceConditioningPrescription(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  const p = (event.after && typeof event.after === 'object') ? event.after as any : {};
  const title = String(p.title ?? 'Conditioning').trim() || 'Conditioning';
  const description = String(p.description ?? title);
  const note = String(p.coachNote ?? `Replaced conditioning with ${title}`);
  const conditioningFlavour =
    p.conditioningFlavour === 'high-intensity' || p.conditioningFlavour === 'tempo'
      ? p.conditioningFlavour
      : 'aerobic';
  const conditioningCategory =
    p.conditioningCategory === 'sprint' ||
    p.conditioningCategory === 'vo2' ||
    p.conditioningCategory === 'glycolytic'
      ? p.conditioningCategory
      : 'aerobic_base';

  const blockOwnedIds = new Set<string>();
  for (const option of current.conditioningBlock?.options ?? []) {
    for (const id of option.exerciseIds ?? []) blockOwnedIds.add(String(id));
  }

  const standaloneConditioning = current.workoutType === 'Conditioning';
  const existingRow = blockOwnedIds.size > 0
    ? (current.exercises ?? []).find((ex) => blockOwnedIds.has(String(ex.id ?? '')))
    : standaloneConditioning
    ? current.exercises?.[0]
    : undefined;
  const baseExercises = blockOwnedIds.size > 0
    ? (current.exercises ?? []).filter((ex) => !blockOwnedIds.has(String(ex.id ?? '')))
    : standaloneConditioning
    ? []
    : (current.exercises ?? []);
  const row = buildCoachConditioningExercise(current, event);
  if (existingRow) {
    row.id = existingRow.id;
    row.exerciseOrder = standaloneConditioning ? 0 : baseExercises.length;
  } else {
    row.exerciseOrder = baseExercises.length;
  }
  const exercises = [...baseExercises, row];
  const durationMinutes = Number(p.minutes ?? p.durationMinutes ?? 0) > 0
    ? Number(p.minutes ?? p.durationMinutes)
    : current.durationMinutes;
  const intensity =
    p.intensity === 'hard' || conditioningFlavour === 'high-intensity'
      ? 'High'
      : p.intensity === 'moderate' || conditioningFlavour === 'tempo'
      ? 'Moderate'
      : 'Light';
  const block = {
    intent: conditioningFlavour,
    options: [{ title, description, exerciseIds: [row.id] }],
  };

  return {
    ok: true,
    workout: cloneWorkout(current, {
      name: standaloneConditioning ? title : current.name,
      description: standaloneConditioning ? description : current.description,
      durationMinutes,
      intensity: intensity as any,
      workoutType: standaloneConditioning ? 'Conditioning' : current.workoutType,
      hasCombinedConditioning: true,
      conditioningFlavour,
      conditioningCategory,
      conditioningBlock: block,
      coachAddedConditioningLabel: title,
      exercises,
      coachNotes: appendCoachNote(current, note),
    }),
  };
}

function normaliseActivityTitle(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:light|easy|gentle|hard|moderate|tempo|conditioning|cardio|aerobic|session|block)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function activityTitleMatches(title: unknown, wanted: string): boolean {
  const left = normaliseActivityTitle(title);
  const right = normaliseActivityTitle(wanted);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function applyDurationOnlyConditioningUpdate(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  const p = (event.after && typeof event.after === 'object') ? event.after as any : {};
  const targetItemId = String(p.targetItemId ?? '').trim();
  const minutes = Number(p.minutes ?? p.durationMinutes ?? 0);
  const repsMin = Number(p.repsMin ?? 0);
  const repsMax = Number(p.repsMax ?? p.repsMin ?? 0);
  const hasMinuteDuration = Number.isFinite(minutes) && minutes > 0;
  const hasRepDuration = Number.isFinite(repsMin) && repsMin > 0;
  if (!targetItemId || (!hasMinuteDuration && !hasRepDuration)) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
      reason: `duration edit missing target item or duration on ${event.date}`,
    };
  }

  const rowIndex = (current.exercises ?? []).findIndex((ex: any) =>
    String(ex.id ?? '') === targetItemId ||
    String(ex.exerciseId ?? '') === targetItemId ||
    String(ex.exercise?.id ?? '') === targetItemId,
  );
  if (rowIndex < 0) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
      reason: `duration edit target ${targetItemId} was not visible on ${event.date}`,
    };
  }

  const existingRow = current.exercises[rowIndex] as any;
  const linkedOptionIndex = (current.conditioningBlock?.options ?? []).findIndex((option: any) =>
    (option.exerciseIds ?? []).some((id: unknown) => String(id) === targetItemId),
  );
  const linkedOption =
    linkedOptionIndex >= 0 ? current.conditioningBlock?.options?.[linkedOptionIndex] : null;
  const sourceTitle =
    String(linkedOption?.title ?? existingRow.exercise?.name ?? current.name ?? 'Conditioning').trim() ||
    'Conditioning';
  const sourceDescription =
    String(linkedOption?.description ?? existingRow.notes ?? existingRow.exercise?.description ?? '').trim();
  const rawNextTitle = hasMinuteDuration
    ? replaceDurationText(sourceTitle, minutes, { prefixIfMissing: false })
    : replaceSecondsText(sourceTitle, repsMin, repsMax, { prefixIfMissing: false });
  const nextTitle =
    hasRepDuration &&
    rawNextTitle === sourceTitle &&
    !/\b\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*(?:s|sec|secs|second|seconds)\b/i.test(sourceTitle)
      ? `${sourceTitle} (${formatSecondsRange(repsMin, repsMax)})`
      : rawNextTitle;
  const nextDescription = hasMinuteDuration
    ? replaceDurationText(sourceDescription, minutes, { prefixIfMissing: false })
    : replaceSecondsText(sourceDescription, repsMin, repsMax, { prefixIfMissing: false });
  const nextNotes = hasMinuteDuration
    ? replaceDurationText(String(existingRow.notes ?? sourceDescription ?? nextTitle), minutes)
    : replaceSecondsText(String(existingRow.notes ?? sourceDescription ?? nextTitle), repsMin, repsMax);

  const exercises = (current.exercises ?? []).map((ex: any, index: number) => {
    if (index !== rowIndex) return ex;
    return {
      ...ex,
      prescribedSets: Number(ex.prescribedSets ?? 1) || 1,
      prescribedRepsMin: hasMinuteDuration ? minutes : repsMin,
      prescribedRepsMax: hasMinuteDuration ? minutes : (Number.isFinite(repsMax) && repsMax > 0 ? repsMax : repsMin),
      prescriptionType: hasMinuteDuration ? 'duration_minutes' : (p.prescriptionType ?? ex.prescriptionType ?? 'duration'),
      notes: nextNotes,
      exercise: ex.exercise
        ? {
            ...ex.exercise,
            name: nextTitle,
            description: nextDescription || ex.exercise.description,
          }
        : ex.exercise,
      updatedAt: new Date().toISOString(),
    };
  });

  const conditioningBlock = current.conditioningBlock && linkedOptionIndex >= 0
    ? {
        ...current.conditioningBlock,
        options: current.conditioningBlock.options.map((option: any, index: number) =>
          index === linkedOptionIndex
            ? {
                ...option,
                title: nextTitle,
                description: nextDescription || option.description,
              }
            : option,
        ),
      }
    : current.conditioningBlock;
  const standaloneConditioning = current.workoutType === 'Conditioning';

  return {
    ok: true,
    workout: cloneWorkout(current, {
      name: standaloneConditioning
        ? hasMinuteDuration
          ? replaceDurationText(current.name, minutes, { prefixIfMissing: false })
          : replaceSecondsText(current.name, repsMin, repsMax, { prefixIfMissing: false })
        : current.name,
      description: standaloneConditioning
        ? hasMinuteDuration
          ? replaceDurationText(current.description, minutes, { prefixIfMissing: false })
          : replaceSecondsText(current.description, repsMin, repsMax, { prefixIfMissing: false })
        : current.description,
      durationMinutes: standaloneConditioning && hasMinuteDuration ? minutes : current.durationMinutes,
      conditioningBlock,
      exercises,
      coachNotes: appendCoachNote(
        current,
        hasMinuteDuration
          ? `Set ${sourceTitle} to ${minutes} min`
          : `Set ${sourceTitle} to ${formatSecondsRange(repsMin, repsMax)}`,
      ),
    }),
  };
}

function replaceDurationText(
  value: unknown,
  minutes: number,
  options: { prefixIfMissing?: boolean } = {},
): string {
  const text = String(value ?? '').trim();
  const token = `${minutes}min`;
  if (!text) return options.prefixIfMissing === false ? '' : `${token} conditioning`;
  const withUnit = /\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/i;
  if (withUnit.test(text)) {
    return text.replace(/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/ig, token);
  }
  const bareSeconds = /\b\d{1,3}\s*(?:sec|secs|second|seconds|s)\b/i;
  if (options.prefixIfMissing !== false && !bareSeconds.test(text)) {
    return `${token} ${text}`;
  }
  return text;
}

function replaceSecondsText(
  value: unknown,
  repsMin: number,
  repsMax: number,
  options: { prefixIfMissing?: boolean } = {},
): string {
  const text = String(value ?? '').trim();
  const token = formatSecondsRange(repsMin, repsMax);
  if (!text) return options.prefixIfMissing === false ? '' : `${token} conditioning`;
  const secondsRange = /\b\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*(?:s|sec|secs|second|seconds)\b/i;
  if (secondsRange.test(text)) {
    return text.replace(/\b\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*(?:s|sec|secs|second|seconds)\b/ig, token);
  }
  if (options.prefixIfMissing !== false) {
    return `${token} ${text}`;
  }
  return text;
}

function formatSecondsRange(repsMin: number, repsMax: number): string {
  const min = Number.isFinite(repsMin) && repsMin > 0 ? repsMin : repsMax;
  const max = Number.isFinite(repsMax) && repsMax > 0 ? repsMax : min;
  return min === max ? `${min}s` : `${min}-${max}s`;
}

function applyAddConditioningBlock(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  const p = (event.after && typeof event.after === 'object') ? event.after as any : {};
  if (p.editScope === 'edit_duration_only' || p.editScope === 'duration_only') {
    return applyDurationOnlyConditioningUpdate(current, event);
  }
  if (p.editScope === 'replace_conditioning_prescription') {
    return applyReplaceConditioningPrescription(current, event);
  }
  const note = String(p.coachNote ?? 'Added light aerobic intervals after strength');
  const title = String(p.title ?? 'Light Aerobic Intervals');
  const replaceActivity = typeof p.replaceActivity === 'string' ? p.replaceActivity.trim() : '';
  const conditioningFlavour =
    p.conditioningFlavour === 'high-intensity' || p.conditioningFlavour === 'tempo'
      ? p.conditioningFlavour
      : 'aerobic';
  const conditioningCategory =
    p.conditioningCategory === 'sprint' ||
    p.conditioningCategory === 'vo2' ||
    p.conditioningCategory === 'glycolytic'
      ? p.conditioningCategory
      : 'aerobic_base';
  const description = String(
    p.description ??
      '8 x 2 min at 75-80% max HR, with 1 min easy recovery. Use bike or track.',
  );
  const existingBlock = current.conditioningBlock;
  const replacementIds = new Set<string>();
  const sourceOptions = existingBlock?.options ?? [];
  const retainedOptions = replaceActivity
    ? sourceOptions.filter((opt) => {
        if (!activityTitleMatches(opt.title, replaceActivity)) return true;
        for (const id of opt.exerciseIds ?? []) replacementIds.add(String(id));
        return false;
      })
    : sourceOptions;
  const blockBase = existingBlock
    ? {
        ...existingBlock,
        options: retainedOptions,
      }
    : undefined;
  const normalizedTitle = title.trim().toLowerCase();
  const existingOptionIndex = blockBase?.options?.findIndex((opt) =>
    String(opt.title ?? '').trim().toLowerCase() === normalizedTitle,
  ) ?? -1;
  const existingOption =
    existingOptionIndex >= 0 ? blockBase?.options?.[existingOptionIndex] : undefined;
  const existingRowId = existingOption?.exerciseIds?.[0] ?? null;
  const existingRow = existingRowId
    ? (current.exercises ?? []).find((ex) => ex.id === existingRowId)
    : undefined;
  const row = buildCoachConditioningExercise(current, event);
  const baseExercises = replacementIds.size > 0
    ? (current.exercises ?? []).filter((ex) => !replacementIds.has(String(ex.id ?? '')))
    : (current.exercises ?? []);
  if (existingRow) {
    row.id = existingRow.id;
    row.exerciseOrder = existingRow.exerciseOrder;
  } else {
    row.exerciseOrder = baseExercises.length;
  }
  const block =
    blockBase?.options?.length
      ? {
          ...blockBase,
          intent: conditioningFlavour,
          options: existingOptionIndex >= 0 && blockBase
            ? blockBase.options.map((opt, index) =>
                index === existingOptionIndex
                  ? { title, description, exerciseIds: [row.id] }
                  : opt,
              )
            : [
                ...blockBase.options,
                { title, description, exerciseIds: [row.id] },
              ],
        }
      : {
          intent: conditioningFlavour,
          options: [{ title, description, exerciseIds: [row.id] }],
        };
  const exercises = existingRow
    ? baseExercises.map((ex) => (ex.id === existingRow.id ? row : ex))
    : [...baseExercises, row];
  return {
    ok: true,
    workout: cloneWorkout(current, {
      hasCombinedConditioning: true,
      conditioningFlavour,
      conditioningCategory,
      conditioningBlock: block,
      coachAddedConditioningLabel: title,
      exercises,
      coachNotes: appendCoachNote(current, note),
    }),
  };
}

function applyRemoveConditioningBlock(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  const payload =
    event.before && typeof event.before === 'object'
      ? event.before as any
      : event.after && typeof event.after === 'object'
      ? event.after as any
      : {};
  const targetItemId = String(payload.targetItemId ?? '').trim();
  if (targetItemId) {
    return applyRemoveTargetedConditioningItem(current, event, targetItemId);
  }

  const block = current.conditioningBlock;
  const ownedIds = new Set<string>();
  for (const opt of block?.options ?? []) {
    for (const id of opt.exerciseIds ?? []) ownedIds.add(id);
  }
  const hadBlock = !!block?.options?.length || current.hasCombinedConditioning;
  if (!hadBlock) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
      reason: `no conditioning block to remove on ${event.date}`,
    };
  }
  const remaining = ownedIds.size > 0
    ? (current.exercises ?? []).filter((ex) => !ownedIds.has(ex.id))
    : (current.exercises ?? []);
  return {
    ok: true,
    workout: cloneWorkout(current, {
      hasCombinedConditioning: false,
      conditioningFlavour: undefined,
      conditioningCategory: undefined,
      conditioningBlock: undefined,
      coachAddedConditioningLabel: undefined,
      exercises: remaining,
      coachNotes: appendCoachNote(current, 'Removed conditioning from this session'),
    }),
  };
}

function applyRemoveTargetedConditioningItem(
  current: Workout,
  event: AdjustmentEvent,
  targetItemId: string,
): MutateResult {
  const block = current.conditioningBlock;
  const matchedExerciseIds = new Set<string>();
  for (const ex of current.exercises ?? []) {
    if (
      String(ex.id ?? '') === targetItemId ||
      String(ex.exerciseId ?? '') === targetItemId ||
      String(ex.exercise?.id ?? '') === targetItemId
    ) {
      matchedExerciseIds.add(String(ex.id ?? targetItemId));
    }
  }

  const matchedOptionIndexes = new Set<number>();
  for (const [index, opt] of (block?.options ?? []).entries()) {
    const ids = (opt.exerciseIds ?? []).map((id: unknown) => String(id));
    if (ids.some((id) => id === targetItemId || matchedExerciseIds.has(id))) {
      matchedOptionIndexes.add(index);
      ids.forEach((id) => matchedExerciseIds.add(id));
    }
  }

  if (matchedExerciseIds.size === 0 && matchedOptionIndexes.size === 0) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
      reason: `conditioning item ${targetItemId} was not visible on ${event.date}`,
    };
  }

  const remainingExercises = (current.exercises ?? []).filter((ex) => {
    const ids = [
      String(ex.id ?? ''),
      String(ex.exerciseId ?? ''),
      String(ex.exercise?.id ?? ''),
    ];
    return !ids.some((id) => id && (id === targetItemId || matchedExerciseIds.has(id)));
  });
  const remainingOptions = (block?.options ?? []).filter((_, index) =>
    !matchedOptionIndexes.has(index),
  );
  const hasRemainingConditioning = remainingOptions.length > 0 ||
    (
      current.workoutType === 'Conditioning' &&
      remainingExercises.length > 0
    );

  return {
    ok: true,
    workout: cloneWorkout(current, {
      hasCombinedConditioning: hasRemainingConditioning ? current.hasCombinedConditioning : false,
      conditioningFlavour: hasRemainingConditioning ? current.conditioningFlavour : undefined,
      conditioningCategory: hasRemainingConditioning ? current.conditioningCategory : undefined,
      conditioningBlock: remainingOptions.length > 0 && block
        ? { ...block, options: remainingOptions }
        : undefined,
      coachAddedConditioningLabel: hasRemainingConditioning
        ? current.coachAddedConditioningLabel
        : undefined,
      exercises: remainingExercises,
      coachNotes: appendCoachNote(current, 'Removed conditioning from this session'),
    }),
  };
}

function applySwapConditioningModality(
  current: Workout,
  event: AdjustmentEvent,
): MutateResult {
  // Two payload shapes are supported:
  //
  // (A) Legacy injury path — no payload, or a string payload — runs the
  //     RUN_TO_OFFFEET map and lands the athlete on a tier-matched bike.
  //     This preserves the existing UAE injury contract.
  //
  // (B) Phase H explicit modality swap — event.before = { modality: 'row' }
  //     (or null), event.after = { modality: 'bike', bikeLabel?: 'standard'|'assault' }.
  //     The canonical applyConditioningModalityToWorkout helper rewrites
  //     EVERY visible field (name, description, exercise name/description/
  //     notes, block titles/descriptions, coachNotes) atomically.
  const beforeModality = readModalityField(event.before);
  const afterModality = readModalityField(event.after);
  const afterBikeLabel = readBikeLabelField(event.after);
  const isExplicitModalitySwap = !!afterModality;

  // ─── Path B — Phase H canonical rewrite ────────────────────────────
  if (isExplicitModalitySwap) {
    const sourceModalities = beforeModality
      ? [beforeModality]
      : collectConditioningSourceModalities(current).filter((m) => m !== afterModality);
    const verifyFinalWorkout = (candidate: Workout): MutateErr | null => {
      const check = verifyModalityRewrite(
        candidate,
        afterModality!,
        afterBikeLabel ?? (afterModality === 'bike' ? 'standard' : null),
        sourceModalities,
      );
      if (check.ok) return null;
      return {
        ok: false,
        rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
        reason:
          `modality swap left visible ${beforeModality ?? 'source'} text on ${event.date}: ` +
          check.leaks.map((leak) => `${leak.field}="${leak.matched}"`).join(', '),
      };
    };

    const rewritten = applyConditioningModalityToWorkout(current, {
      fromModality: beforeModality,
      toModality: afterModality!,
      bikeLabel: afterBikeLabel ?? (afterModality === 'bike' ? 'standard' : null),
    });
    let touched = rewritten !== current;

    // Fallback: the workout is conditioning-flavoured but had nothing
    // tagged on `fromModality`. The engine intended a swap; rewrite the
    // first conditioning slot to a sensible default + run the canonical
    // helper a second time so all surfaces stay coherent.
    if (!touched) {
      const isConditioning = current.workoutType === 'Conditioning';
      if (isConditioning && current.exercises.length > 0) {
        const fallbackName = defaultNameForModality(
          afterModality!,
          afterBikeLabel ?? (afterModality === 'bike' ? 'standard' : null),
        );
        const seeded = cloneWorkout(current, {
          name: fallbackName,
          description: fallbackName,
          exercises: current.exercises.map((ex, i) =>
            i === 0
              ? {
                  ...ex,
                  exercise: ex.exercise
                    ? { ...ex.exercise, name: fallbackName, description: fallbackName }
                    : ex.exercise,
                }
              : ex,
          ),
          conditioningBlock: current.conditioningBlock?.options?.length
            ? {
                ...current.conditioningBlock,
                options: current.conditioningBlock.options.map((opt, i) =>
                  i === 0 ? { ...opt, title: fallbackName, description: fallbackName } : opt,
                ),
              }
            : current.conditioningBlock,
        });
        const seededRewritten = applyConditioningModalityToWorkout(seeded, {
          fromModality: beforeModality,
          toModality: afterModality!,
          bikeLabel: afterBikeLabel ?? (afterModality === 'bike' ? 'standard' : null),
        });
        const final = seededRewritten !== seeded ? seededRewritten : seeded;
        const verifyErr = verifyFinalWorkout(final as Workout);
        if (verifyErr) return verifyErr;
        return {
          ok: true,
          workout: cloneWorkout(final, { updatedAt: new Date().toISOString() }),
        };
      }
      return {
        ok: false,
        rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
        reason: `no ${beforeModality ?? 'conditioning'}-modality conditioning to swap on ${event.date}`,
      };
    }

    const verifyErr = verifyFinalWorkout(rewritten as Workout);
    if (verifyErr) return verifyErr;

    return {
      ok: true,
      workout: cloneWorkout(rewritten as Workout, {
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  // ─── Path A — Legacy injury swap (run → off-feet) ──────────────────
  let touched = false;
  const renameSummary: Array<{ from: string; to: string }> = [];

  const newExercises = current.exercises.map((ex) => {
    const name = ex.exercise?.name || '';
    const replacement = RUN_TO_OFFFEET[name];
    if (!replacement || replacement === name) return ex;
    touched = true;
    renameSummary.push({ from: name, to: replacement });
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
      if (!replacement || replacement === opt.title) return opt;
      touched = true;
      return { ...opt, title: replacement };
    });
    newBlock = { ...newBlock, options: newOptions };
  }

  if (!touched) {
    const isConditioning = current.workoutType === 'Conditioning';
    if (isConditioning && current.exercises.length > 0) {
      const first = current.exercises[0];
      const fallbackName = DEFAULT_OFFFEET;
      if (fallbackName && fallbackName !== (first.exercise?.name ?? '')) {
        newExercises[0] = {
          ...first,
          exercise: first.exercise
            ? { ...first.exercise, name: fallbackName, description: fallbackName }
            : first.exercise,
        };
        touched = true;
        renameSummary.push({ from: first.exercise?.name ?? '(unknown)', to: fallbackName });
      }
    }
  }

  if (!touched) {
    return {
      ok: false,
      rejectKind: APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
      reason: `no run-modality conditioning to swap on ${event.date}`,
    };
  }

  const coachNote = 'Swapped running for off-feet (bike / row)';
  return {
    ok: true,
    workout: cloneWorkout(current, {
      exercises: newExercises,
      conditioningBlock: newBlock,
      description:
        ((current.description || '').trim() + ` [Off-feet — injury swap]`).trim(),
      coachNotes: appendCoachNote(current, coachNote),
    }),
  };
}

function collectConditioningSourceModalities(current: Workout): ConditioningModality[] {
  const out = new Set<ConditioningModality>();
  for (const ex of current.exercises ?? []) {
    const name = ex.exercise?.name ?? '';
    const modality = inferModalityFromName(name);
    if (modality) out.add(modality);
  }
  for (const opt of current.conditioningBlock?.options ?? []) {
    const modality = inferModalityFromName(opt.title ?? '');
    if (modality) out.add(modality);
  }
  return [...out];
}

/**
 * Pull `{modality: 'row'}` out of an event payload. Tolerant of null,
 * undefined, strings, or non-object payloads.
 */
function readModalityField(payload: any): ConditioningModality | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = payload.modality;
  if (typeof v !== 'string') return null;
  // Validate against the union by spot-checking — TS can't narrow at runtime.
  const allowed = ['run', 'bike', 'row', 'ski', 'swim', 'mixed'];
  return allowed.includes(v) ? (v as ConditioningModality) : null;
}

/**
 * Pull `{bikeLabel: 'standard'|'assault'}` out of an event payload.
 * Phase H — when present, the canonical helper renders bike modality
 * with the requested subtype label. Tolerant of null / non-object /
 * unknown values.
 */
function readBikeLabelField(payload: any): BikeLabel | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = payload.bikeLabel;
  if (typeof v !== 'string') return null;
  if (v === 'standard' || v === 'assault' || v === 'generic') return v as BikeLabel;
  return null;
}

/**
 * Decide what to rename `currentName` to, given an explicit modality
 * swap. Returns null when the rename should not happen (e.g. exercise
 * isn't conditioning, or already on the destination modality, or
 * `from` is set and the exercise doesn't match it).
 */
function pickModalityReplacement(
  currentName: string,
  fromModality: ConditioningModality | null,
  toModality: ConditioningModality,
): string | null {
  const meta = CONDITIONING_META[currentName];
  if (!meta) return null;
  if (meta.modality === toModality) return null;
  if (fromModality && meta.modality !== fromModality) return null;
  return pickEquivalentByTier(currentName, toModality);
}

function defaultNameForModality(
  modality: ConditioningModality,
  bikeLabel?: BikeLabel | null,
): string {
  switch (modality) {
    case 'bike':
      // Phase H — bare bike default is the STANDARD label ("Bike Intervals"),
      // not "Assault Bike Intervals". Callers pass bikeLabel='assault'
      // when the athlete explicitly asked for an Assault/Air bike.
      return bikeLabel === 'assault' ? 'Assault Bike Intervals' : 'Bike Intervals';
    case 'row':
      return 'Row Intervals';
    case 'run':
      return 'Tempo Run';
    case 'ski':
      return 'SkiErg Intervals';
    case 'swim':
      return 'Easy Swim';
    case 'mixed':
      return 'MetCon';
    default:
      return DEFAULT_OFFFEET;
  }
}

// Quiet the unused-import warning in tooling that doesn't see the new
// reference inside applySwapConditioningModality's payload reader.
void ({} as ParsedModalitySwap);

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
  const weekStarts = opts.allowFutureWeeks
    ? Array.from(new Set(events.map((ev) => mondayOfISOLocal(ev.date || todayISO))))
    : [monday];
  const weeks = weekStarts.map((weekStart) => ({
    weekStart,
    days: resolveWeek(weekStart, state),
  }));
  const week = weeks.flatMap((w) => w.days);
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
    weekStarts,
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
    if (ev.date < todayISO && !opts.allowPastDates) {
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
        case 'add_conditioning_block':
          outcome = applyAddConditioningBlock(working, ev);
          break;
        case 'remove_conditioning_block':
          outcome = applyRemoveConditioningBlock(working, ev);
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

    const isProgramAdjustment = group.some(
      (ev) => ev.kind === 'add_conditioning_block' || ev.kind === 'remove_conditioning_block',
    );
    const ctx: OverrideContext = {
      intent: isProgramAdjustment ? 'program_adjustment' : 'injury',
      label: lastReason || (isProgramAdjustment ? 'Program adjustment' : 'Injury-driven adjustment'),
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
// MOVE SESSION (cross-date — bypasses the per-event single-date applier)
// ─────────────────────────────────────────────────────────────────────────
//
// A session move is fundamentally cross-date: source becomes empty, dest
// receives the source's workout. The single-date AdjustmentEvent shape
// can't express that without contortion, so move_session lives outside
// the per-event loop. The contract mirrors `applyAdjustmentEvents`'s
// return shape so the executor can DI-stub it the same way.
//
// Rules (analogue of R1–R6 above):
//   M1. Source and dest must both be inside the resolved week(s).
//   M2. Past dates are rejected unless allowPastDates.
//   M3. Source must have a workout to move; dest's existing workout (if
//       any) is OVERWRITTEN — moves are destructive.
//   M4. Source override gets a "Rest" shell; dest gets a deep copy of
//       the source workout with `coachNotes` updated to record the move.
//   M5. The helper NEVER constructs dates or reaches for `new Date()`.

export interface ApplyMoveSessionInput {
  sourceDate: string;
  destDate: string;
  /** "coach move_session" — written into both override contexts. */
  reason?: string;
  /** When true, also moves dest → source (atomic two-way swap). */
  swap?: boolean;
}

export interface ApplyMoveSessionResult {
  applied: AppliedAdjustment[];
  rejected: RejectedAdjustment[];
  /** Snapshot of the source workout BEFORE the move (for verification). */
  sourceWorkoutBefore: Workout | null;
  /** Snapshot of the dest workout BEFORE the move (for verification). */
  destWorkoutBefore: Workout | null;
}

/** Build a "Rest" shell for the source date once its workout has moved. */
function buildRestShellForMove(
  cloned: Workout,
  reason: string,
  movedToDate: string,
): Workout {
  return {
    ...cloned,
    name: 'Rest',
    description: `Coach moved this session to ${movedToDate}.`,
    sessionTier: 'recovery',
    workoutType: 'Recovery',
    exercises: [],
    conditioningBlock: undefined,
    hasCombinedConditioning: false,
    coachNotes: [reason],
    updatedAt: new Date().toISOString(),
  } as Workout;
}

/** Build the destination workout — clone source and tag the move. */
function buildMovedWorkoutForDest(
  source: Workout,
  reason: string,
  fromDate: string,
): Workout {
  return cloneWorkout(source, {
    coachNotes: appendCoachNote(source, `Moved from ${fromDate}: ${reason}`),
  });
}

export function applyMoveSession(
  input: ApplyMoveSessionInput,
  opts: ApplyOptions,
): ApplyMoveSessionResult {
  const { todayISO } = opts;
  const buildState = opts.buildState || defaultBuildState;
  const resolveWeek = opts.resolveWeek || resolveWeekWithConditioning;
  const setOverride = opts.setManualOverride || defaultSetManualOverride;

  const applied: AppliedAdjustment[] = [];
  const rejected: RejectedAdjustment[] = [];

  const reason = input.reason ?? 'coach move_session';

  if (!input.sourceDate || !input.destDate) {
    rejected.push({
      kind: 'invalid_event',
      reason: 'move_session requires both sourceDate and destDate',
    });
    return { applied, rejected, sourceWorkoutBefore: null, destWorkoutBefore: null };
  }
  if (input.sourceDate === input.destDate) {
    rejected.push({
      kind: 'invalid_event',
      date: input.sourceDate,
      reason: 'move_session source and destination are the same date',
    });
    return { applied, rejected, sourceWorkoutBefore: null, destWorkoutBefore: null };
  }
  if (!opts.allowPastDates) {
    if (input.sourceDate < todayISO) {
      rejected.push({
        kind: APPLY_REJECT_KIND.PAST_DATE,
        date: input.sourceDate,
        reason: `cannot move session from past date ${input.sourceDate}`,
      });
      return { applied, rejected, sourceWorkoutBefore: null, destWorkoutBefore: null };
    }
    if (input.destDate < todayISO) {
      rejected.push({
        kind: APPLY_REJECT_KIND.PAST_DATE,
        date: input.destDate,
        reason: `cannot move session to past date ${input.destDate}`,
      });
      return { applied, rejected, sourceWorkoutBefore: null, destWorkoutBefore: null };
    }
  }

  // Resolve all weeks the move touches (source and dest may straddle).
  const state = buildState();
  const sourceMonday = mondayOfISOLocal(input.sourceDate);
  const destMonday = mondayOfISOLocal(input.destDate);
  const weekStarts = Array.from(new Set([sourceMonday, destMonday]));
  const week = weekStarts.flatMap((m) => resolveWeek(m, state));
  const dayByDate: Record<string, ResolvedDay> = {};
  for (const d of week) dayByDate[d.date] = d;

  const sourceDay = dayByDate[input.sourceDate];
  const destDay = dayByDate[input.destDate];

  if (!sourceDay) {
    rejected.push({
      kind: APPLY_REJECT_KIND.INVALID_TARGET_DATE,
      date: input.sourceDate,
      reason: `source date ${input.sourceDate} not in resolved week`,
    });
    return { applied, rejected, sourceWorkoutBefore: null, destWorkoutBefore: null };
  }
  if (!destDay) {
    rejected.push({
      kind: APPLY_REJECT_KIND.INVALID_TARGET_DATE,
      date: input.destDate,
      reason: `dest date ${input.destDate} not in resolved week`,
    });
    return { applied, rejected, sourceWorkoutBefore: null, destWorkoutBefore: null };
  }

  const sourceWorkoutBefore = sourceDay.workout ?? null;
  const destWorkoutBefore = destDay.workout ?? null;

  if (!sourceWorkoutBefore) {
    rejected.push({
      kind: APPLY_REJECT_KIND.NO_WORKOUT_ON_DATE,
      date: input.sourceDate,
      reason: `${input.sourceDate} has no workout to move`,
    });
    return { applied, rejected, sourceWorkoutBefore: null, destWorkoutBefore };
  }

  // Refuse to move team-training or game days (anchored sessions). The
  // engine treats `isTeamDay` / sessionTier='game' as immutable anchors.
  const sourceAny: any = sourceWorkoutBefore;
  if (sourceAny.isTeamDay === true || sourceAny.workoutType === 'Team Training') {
    rejected.push({
      kind: 'cannot_move_team_training',
      date: input.sourceDate,
      reason: `${input.sourceDate} is a team training day — those are anchored to the calendar`,
    });
    return { applied, rejected, sourceWorkoutBefore, destWorkoutBefore };
  }
  if (sourceAny.workoutType === 'Game' || sourceAny.sessionTier === 'game') {
    rejected.push({
      kind: 'cannot_move_game',
      date: input.sourceDate,
      reason: `${input.sourceDate} is a game day — game-day sessions can't be moved`,
    });
    return { applied, rejected, sourceWorkoutBefore, destWorkoutBefore };
  }

  // ── Two-way swap or one-way move? ───────────────────────────────
  if (input.swap) {
    if (!destWorkoutBefore) {
      // Swap with empty dest is just a one-way move; fall through.
      // Keep the swap=true intent in the override context label.
    } else {
      const destAny: any = destWorkoutBefore;
      if (destAny.isTeamDay === true || destAny.workoutType === 'Team Training') {
        rejected.push({
          kind: 'cannot_move_team_training',
          date: input.destDate,
          reason: `${input.destDate} is a team training day — can't swap into it`,
        });
        return { applied, rejected, sourceWorkoutBefore, destWorkoutBefore };
      }
      if (destAny.workoutType === 'Game' || destAny.sessionTier === 'game') {
        rejected.push({
          kind: 'cannot_move_game',
          date: input.destDate,
          reason: `${input.destDate} is a game day — can't swap`,
        });
        return { applied, rejected, sourceWorkoutBefore, destWorkoutBefore };
      }
      // Two-way swap: source receives dest's workout, dest receives source's.
      const ctxA: OverrideContext = {
        intent: 'program_adjustment',
        label: `Coach swap from ${input.destDate}`,
      };
      const ctxB: OverrideContext = {
        intent: 'program_adjustment',
        label: `Coach swap from ${input.sourceDate}`,
      };
      const newSource = buildMovedWorkoutForDest(destWorkoutBefore, reason, input.destDate);
      const newDest = buildMovedWorkoutForDest(sourceWorkoutBefore, reason, input.sourceDate);
      setOverride(input.sourceDate, newSource, ctxA);
      setOverride(input.destDate, newDest, ctxB);
      applied.push({
        date: input.sourceDate,
        eventIds: [`move_session-${input.sourceDate}-from-${input.destDate}`],
        workoutName: newSource.name,
      });
      applied.push({
        date: input.destDate,
        eventIds: [`move_session-${input.destDate}-from-${input.sourceDate}`],
        workoutName: newDest.name,
      });
      logger.debug('[apply-events] move_session_swapped', {
        sourceDate: input.sourceDate,
        destDate: input.destDate,
        sourceNameBefore: sourceWorkoutBefore.name,
        destNameBefore: destWorkoutBefore.name,
      });
      return { applied, rejected, sourceWorkoutBefore, destWorkoutBefore };
    }
  }

  // ── One-way move ───────────────────────────────────────────────
  const newDest = buildMovedWorkoutForDest(sourceWorkoutBefore, reason, input.sourceDate);
  const newSource = buildRestShellForMove(sourceWorkoutBefore, reason, input.destDate);
  const ctxSource: OverrideContext = {
    intent: 'program_adjustment',
    label: `Coach moved session to ${input.destDate}`,
  };
  const ctxDest: OverrideContext = {
    intent: 'program_adjustment',
    label: `Coach moved session from ${input.sourceDate}`,
  };
  setOverride(input.sourceDate, newSource, ctxSource);
  setOverride(input.destDate, newDest, ctxDest);
  applied.push({
    date: input.sourceDate,
    eventIds: [`move_session-${input.sourceDate}-out`],
    workoutName: newSource.name,
  });
  applied.push({
    date: input.destDate,
    eventIds: [`move_session-${input.destDate}-in`],
    workoutName: newDest.name,
  });
  logger.debug('[apply-events] move_session_moved', {
    sourceDate: input.sourceDate,
    destDate: input.destDate,
    sourceNameBefore: sourceWorkoutBefore.name,
    destNameBefore: destWorkoutBefore?.name ?? null,
  });
  return { applied, rejected, sourceWorkoutBefore, destWorkoutBefore };
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
