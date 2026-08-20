/**
 * visibleProgramProjection.ts — THE single visible-program gate.
 *
 * Every UI surface (HomeScreen, DayWorkoutScreen, calendar drilldowns)
 * MUST run resolved days through this helper before rendering. It is
 * the only place that guarantees an active constraint actually gates
 * the exercises the athlete sees, regardless of where the workout
 * came from (template, override, AI-generated, manual edit).
 *
 *   raw resolver output
 *   → projectVisibleDay(day, state)
 *   → Pass 1: UNIVERSAL EXPOSURE ENGINE — applyConstraintsToSession
 *   → Pass 2: validator sweep — validateWorkoutAgainstConstraints
 *   → returns the visible workout the UI should render
 *
 * IT HIDES. IT NEVER AUTHORS. Both surviving passes only REMOVE rows and
 * attach coachNotes; neither substitutes an exercise, and neither writes.
 * The legacy tag-based filter that sat in front of them DID substitute
 * ("Replaced X with Y", "Rebuilt for …") off the single-slot `activeInjury`
 * alias — that was authoring at read time and it is deleted (2026-08-19).
 *
 * THE EXPOSURE ENGINE IS THE PRIMARY DECISION LAYER
 *   We no longer have hamstring-specific or shoulder-specific bans
 *   inside this file. The engine reasons about TRAINING EXPOSURES
 *   (sprint, heavy_hinge, overhead_loading, …) for any constraint
 *   type — injury, fatigue, soreness, schedule, etc. To support a new
 *   constraint type, build a Constraint object (see exposureEngine)
 *   and pass it through `extraConstraints`.
 *
 * INVARIANTS
 *   I1. UI MUST render the projected workout, not the raw resolver
 *       output. Pass through this helper before rendering.
 *   I2. `injuryFilterApplied: true` ⇒ the exposure engine removed
 *       exercises / attached coachNotes.
 *   I3. Recovery sessions are NEVER modified by this layer.
 *   I4. Game-day stubs are NEVER modified.
 *   I5. When `overrideContext.intent === 'injury'` AND coachNotes
 *       already include the injury rule, skip re-application
 *       (avoid double-mutation).
 *   I6. Final validator is the last word: any exercise still
 *       classified as remove gets dropped before render.
 */

import type { Workout, OverrideContext } from '../types/domain';
import type { ResolvedDay } from './sessionResolver';
import {
  applyConstraintsToSession,
  applyConstraintsToTypedComponents,
  validateWorkoutAgainstConstraints,
  type Constraint,
  type ConstraintRegion,
} from './exposureEngine';
import { logger } from './logger';
import { normalizeVisibleWorkoutIdentity } from './visibleWorkoutIdentity';
import {
  getModalityPreferenceFor,
  type ModalityPreference,
} from '../store/coachPreferencesStore';
import { applyModalityPreferenceToWorkout } from './coachModalitySwap';
import { shouldCollapseWorkoutToRest } from './workoutContent';
import { alignPowerToFinalWorkoutContent } from '../rules/powerRowAlignment';

export interface ProjectInput {
  day: ResolvedDay;
  /** Override context for this date — may flag injury-authored edits. */
  overrideContext?: OverrideContext;
  /** Today's ISO date — used to skip past-date filtering. */
  todayISO: string;
  /** Additional constraints (fatigue, soreness, schedule, etc.) to layer on top. */
  extraConstraints?: Constraint[];
  /**
   * Recurring modality preferences (session-name → from/to). Optional.
   * When omitted the projection reads from the live store; tests inject
   * a deterministic map so they don't need to spin up Zustand.
   */
  modalityPreferences?: Record<string, ModalityPreference>;
}

export interface ProjectOutcome {
  day: ResolvedDay;
  injuryFilterApplied: boolean;
  /** Names removed by the projection (for logs / tests). */
  removedNames: string[];
  /** Replacement names — kept for backward compat; engine never substitutes. */
  replacementNames: string[];
}

/** Local helper — mirrors the resolver's recovery test. */
function isRecovery(workout: Workout): boolean {
  const wt = (workout as any).workoutType;
  if (wt === 'Recovery') return true;
  if ((workout as any).sessionTier === 'recovery') return true;
  return /\brecovery\b/i.test(workout.name || '');
}

function isGame(workout: Workout): boolean {
  return (workout as any).workoutType === 'Game';
}

function collapseEmptyVisibleWorkoutShell(day: ResolvedDay): ResolvedDay {
  if (!shouldCollapseWorkoutToRest(day.workout)) return day;
  return {
    ...day,
    workout: null,
    source: 'rest' as any,
  };
}

/**
 * HAS THE INJURY OWNER ALREADY ANSWERED FOR THIS DAY?
 *
 * ⚠ **BOTH OF THE LADDER'S OUTCOMES COUNT, AND LEAVING ONE OUT WAS A REAL
 * DEFECT THAT MEASUREMENT CAUGHT.** The ladder answers an injury in exactly two
 * ways: it SUBSTITUTES a safe exercise (`substitutedFrom.cause === 'injury'`),
 * or, when it has nothing safe to offer, it WITHHOLDS the row
 * (`unavailableForInjury`). A first cut of this predicate read only the second,
 * and the consequence was measured rather than reasoned about:
 *
 * ```
 *   ORDINARY 8/10, no serious symptoms
 *     resolver    5 rows  Chest-Supported DB Row, Single-Arm DB Floor Press, …
 *     projection  workout NULL, source 'rest'      <- the substitutions vanished
 * ```
 *
 * The athlete's day was replaced with safe work and then emptied on the way to
 * the screen. It only LOOKED correct while a stale marker was riding on those
 * substituted rows and tripping the withheld branch by accident — so fixing the
 * marker at its source is what exposed it.
 *
 * ⚠ **NO INJURY RULE IS RE-DERIVED. TWO TYPED FIELDS, NEITHER INTERPRETED.**
 * There is no severity band, no red-flag test and no body-part map in this file,
 * and deliberately no call to `injuryWithholdingsOn()` — that would re-run the
 * legality question at the view and make this a second opinion about it.
 */
function dayIsInjuryAdjudicated(workout: Workout | null | undefined): boolean {
  return (workout?.exercises ?? []).some((row) => !!row.unavailableForInjury
    || (row as { substitutedFrom?: { cause?: string } }).substitutedFrom?.cause === 'injury');
}

function alreadyHasInjuryNote(workout: Workout): boolean {
  const notes = workout.coachNotes ?? [];
  if (notes.length === 0) return false;
  return notes.some(
    (n) =>
      /no sprinting/i.test(n) ||
      /no heavy hinge/i.test(n) ||
      /no overhead/i.test(n) ||
      /no axial/i.test(n) ||
      /Replaced .* with /i.test(n) ||
      /Removed: /i.test(n) ||
      /Rebuilt for /i.test(n),
  );
}

/**
 * Build the active constraint set for a given day. Every injury constraint
 * arrives episode-derived through `extraConstraints` — there is no second,
 * single-slot injury input to disagree with it.
 */
function buildActiveConstraints(input: ProjectInput): Constraint[] {
  const constraints: Constraint[] = [];
  for (const c of input.extraConstraints ?? []) {
    if (c.status !== 'resolved') constraints.push(c);
  }
  return constraints;
}

/**
 * The single visible-program gate. Pure function — call it once per
 * ResolvedDay before rendering. Returns the day with an updated
 * `workout` and a structured outcome for logging.
 */
export function projectVisibleDay(input: ProjectInput): ProjectOutcome {
  const { day, overrideContext, todayISO } = input;

  // ── Pass 0: recurring modality preference ──
  // Apply BEFORE normalization + the past-date short-circuit so:
  //   (a) the lookup uses the ORIGINAL session name the orchestrator
  //       stored the preference under (e.g. "Easy Aerobic Flush",
  //       not the conditioning-only normalized title "Easy Row"),
  //   (b) future weeks pick up the preference automatically,
  //   (c) past dates are excluded — the preference is forward-looking
  //       and never edits completed sessions.
  let preprocessedWorkout: Workout | null = day.workout ?? null;
  if (
    preprocessedWorkout &&
    day.date >= todayISO &&
    !isRecovery(preprocessedWorkout) &&
    !isGame(preprocessedWorkout)
  ) {
    const originalSessionName = preprocessedWorkout.name ?? '';
    const prefMap = input.modalityPreferences;
    const pref = getModalityPreferenceFor(originalSessionName, prefMap);
    if (pref) {
      const rewritten = applyModalityPreferenceToWorkout(preprocessedWorkout, {
        from: pref.from,
        to: pref.to,
        bikeLabel: pref.bikeLabel ?? null,
      });
      if (rewritten !== preprocessedWorkout) {
        preprocessedWorkout = rewritten as Workout;
      }
    }
  }

  if (preprocessedWorkout && day.date >= todayISO) {
    preprocessedWorkout = alignPowerToFinalWorkoutContent(preprocessedWorkout).workout;
  }

  let visibleDay = preprocessedWorkout
    ? collapseEmptyVisibleWorkoutShell({
        ...day,
        workout: normalizeVisibleWorkoutIdentity(preprocessedWorkout),
      })
    : day;

  const constraints = buildActiveConstraints(input);

  // No active constraints → nothing to do.
  if (constraints.length === 0) {
    return { day: visibleDay, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  if (!visibleDay.workout) {
    return { day: visibleDay, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  // Past dates are immutable.
  if (visibleDay.date < todayISO) {
    return { day: visibleDay, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  // Recovery / game stubs untouched.
  if (isRecovery(visibleDay.workout) || isGame(visibleDay.workout)) {
    return { day: visibleDay, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  // Injury-authored override that ALREADY carries notes — skip to
  // avoid double-mutation. Non-injury manual overrides are STILL
  // re-checked so an athlete can't bypass constraints by editing.
  if (
    visibleDay.source === 'manual' &&
    overrideContext?.intent === 'injury' &&
    alreadyHasInjuryNote(visibleDay.workout)
  ) {
    return { day: visibleDay, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }

  /* ══ THE INJURY OWNER HAS ALREADY ADJUDICATED THIS DAY — R-115 ══════════════
   *
   * **Sam, 2026-08-20:** *"An 8-10 injury with serious symptoms must NEVER write
   * into the athlete's Remove list or permanently alter the accepted program.
   * Preserve the original exercises. On that date, show them as unavailable/skip
   * … Clearing or resolving the injury must immediately reveal the original
   * accepted session again."*
   *
   * ⚠ **WHAT THIS PROJECTION WAS DOING, MEASURED ON THE REAL DOOR.** Hamstring
   * 9/10 with serious symptoms on 2026-07-20. The resolver — the owner the
   * Injury lane fixed — hands this function five rows at their own loads with
   * four of them MARKED `unavailableForInjury`. Pass 1's exposure engine and
   * Pass 2's validator sweep then FILTERED those four out as constraint
   * violations, `collapseEmptyVisibleWorkoutShell` saw what was left and
   * returned `workout: null, source: 'rest'`, and the athlete's day became a
   * Rest day. The ruling's "preserve the original exercises" survived the
   * domain and died at the view.
   *
   * ⚠ **THE SHORT-CIRCUIT IS THE SIBLING OF THE ONE DIRECTLY ABOVE, FOR THE
   * SAME REASON.** That one skips a day whose injury edit has already been
   * applied, so it is not applied twice. This one skips a day whose injury has
   * already been applied AS A WITHHOLDING. Re-running the constraint engine over
   * it cannot add information — the rows are already adjudicated, by the single
   * legality owner (`injuryPermitsExerciseAtSeverity`) that the fallback ladder
   * and every tap surface answer to — and it can only delete them.
   *
   * ⚠ **NO INJURY RULE IS RE-DERIVED HERE, WHICH WAS THE INSTRUCTION.** This
   * reads one typed field the domain wrote. There is no severity band, no
   * red-flag test, no body-part map and no classifier in this file; the decision
   * arrived already made and this is the projection agreeing to it.
   *
   * ⚠ **AN ORDINARY INJURY IS UNAFFECTED, BY CONSTRUCTION.** A non-red-flag
   * injury SUBSTITUTES: the ladder replaces the unsafe row, so the day the
   * resolver hands over carries no `unavailableForInjury` mark at all and this
   * branch is not taken. Measured: of the five seeded injury worlds only the
   * red-flag one carries marks. */
  if (dayIsInjuryAdjudicated(visibleDay.workout)) {
    /* ⚠ THE VIEW WORKAROUND THAT STOOD HERE IS DELETED — SAM, 2026-08-20.
     * *"Fix the stale injury mark at its source ... Do not leave a view-level
     * plaster that hides incorrect domain data."* It stripped the marker off any
     * row swapped BECAUSE of the injury. The marker is no longer written onto a
     * replacement at all (`utils/coachActions`, where the outgoing row's fields
     * were being inherited through a spread), so there is nothing left to strip
     * and the view is back to passing the domain's answer through untouched. */
    return { day: visibleDay, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }

  // ── Pass 1: universal exposure engine ──
  let workoutNow: Workout = visibleDay.workout;
  const applyResult = applyConstraintsToSession(workoutNow, constraints);
  workoutNow = applyResult.workout;
  const componentResult = applyConstraintsToTypedComponents(workoutNow, constraints);
  workoutNow = componentResult.workout;
  const exposureRemoved = applyResult.classification.removedNames;
  const exposureApplied = applyResult.applied || componentResult.changed;

  const filterApplied = exposureApplied;
  if (!filterApplied) {
    return { day: visibleDay, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }

  // ── Pass 2: validator sweep ──
  const validation = validateWorkoutAgainstConstraints(workoutNow, constraints, {
    date: day.date,
  });
  let finalRemoved = [...exposureRemoved];
  if (!validation.passed) {
    const violationNames = new Set(validation.violations.map((v) => v.exercise));
    workoutNow = {
      ...workoutNow,
      exercises: (workoutNow.exercises ?? []).filter(
        (ex: any) => !violationNames.has(ex.exercise?.name ?? ''),
      ),
      coachNotes: [
        ...(workoutNow.coachNotes ?? []),
        ...Array.from(violationNames).map((n) => `Removed: ${n}`),
      ],
    };
    finalRemoved = [...finalRemoved, ...Array.from(violationNames)];
  }

  workoutNow = alignPowerToFinalWorkoutContent(workoutNow).workout;

  return {
    day: collapseEmptyVisibleWorkoutShell({
      ...visibleDay,
      workout: normalizeVisibleWorkoutIdentity(workoutNow),
    }),
    injuryFilterApplied: true,
    removedNames: finalRemoved,
    replacementNames: [],
  };
}

/**
 * Convenience wrapper that logs at the visible boundary and returns
 * the projected day. Use this from screen-level hooks/components.
 */
export function projectAndLog(
  input: ProjectInput & { surface?: 'home' | 'detail' | 'calendar' },
): ResolvedDay {
  const surface = input.surface ?? 'home';
  const traceEnabled =
    process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS === 'true' &&
    process.env.DEBUG_SCHEDULE_TRACE === 'true';
  if (!traceEnabled) {
    return projectVisibleDay(input).day;
  }
  const beforeExercises = (input.day.workout?.exercises ?? [])
    .map((e: any) => e.exercise?.name)
    .filter(Boolean);
  logger.debug('[visible-program] project_input', {
    surface,
    date: input.day.date,
    source: input.day.source,
    workoutName: input.day.workout?.name ?? null,
    beforeExercises,
    extraConstraintIds: (input.extraConstraints ?? []).map((c) => c.id),
    overrideContextIntent: input.overrideContext?.intent ?? null,
  });
  const out = projectVisibleDay(input);
  const afterExercises = (out.day.workout?.exercises ?? [])
    .map((e: any) => e.exercise?.name)
    .filter(Boolean);
  logger.debug('[visible-program] project_output', {
    surface,
    date: out.day.date,
    workoutName: out.day.workout?.name ?? null,
    beforeExercises,
    afterExercises,
    coachNotes: out.day.workout?.coachNotes ?? [],
    injuryFilterApplied: out.injuryFilterApplied,
    removedByName: out.removedNames,
    replacedByName: out.replacementNames,
  });
  return out.day;
}
