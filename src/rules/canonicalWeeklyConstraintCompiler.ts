/** Final ephemeral compiler stage. Applies accepted constraints once to resolved
 * dates. Screens consume its output unchanged; accepted source rows are not saved
 * with temporary filters baked in. Existing injury adjudication wins over legacy
 * exposure filtering. All clock, context and preference inputs are explicit. */
import type { Workout, OverrideContext } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  applyConstraintsToSession,
  applyConstraintsToTypedComponents,
  validateWorkoutAgainstConstraints,
  buildInjuryConstraint, buildFatigueConstraint, buildSorenessConstraint,
  buildScheduleConstraint, buildMissedSessionConstraint,
  type Constraint,
} from '../utils/exposureEngine';
import { normalizeVisibleWorkoutIdentity } from '../utils/visibleWorkoutIdentity';
import {
  lookupModalityPreference,
  type ModalityPreference,
} from './modalityPreferenceLookup';
import { applyModalityPreferenceToWorkout } from '../utils/coachModalitySwap';
import { shouldCollapseWorkoutToRest } from '../utils/workoutContent';
import { alignPowerToFinalWorkoutContent } from '../rules/powerRowAlignment';
import { awaySpansFromFacts, dateIsInsideAwaySpan } from './awaySpans';
import { getTeamTrainingWorkoutState } from '../utils/teamTraining';
import { resolveSessionDisplayName } from '../utils/sessionNaming';

export interface CanonicalDayConstraintInput {
  day: ResolvedDay;
  /** Override context for this date — may flag injury-authored edits. */
  overrideContext?: OverrideContext;
  /** Today's ISO date — used to skip past-date filtering. */
  todayISO: string;
  /** Additional constraints (fatigue, soreness, schedule, etc.) to layer on top. */
  extraConstraints?: Constraint[];
  /**
   * Recurring modality preferences (session-name → from/to). Optional.
   * Omitted means no preference. Ambient store reads are forbidden here.
   */
  modalityPreferences?: Record<string, ModalityPreference>;
}

export interface CanonicalDayConstraintOutcome {
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
function buildActiveConstraints(input: CanonicalDayConstraintInput): Constraint[] {
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
export function compileCanonicalDayConstraints(input: CanonicalDayConstraintInput): CanonicalDayConstraintOutcome {
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
    const pref = lookupModalityPreference(originalSessionName, prefMap ?? {});
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


import type { ScheduleState } from '../utils/sessionResolver';
import { bucketToRegion } from '../utils/injuryConstraintRegion';
import { filterConstraintsForDate } from '../utils/readinessConstraints';
import { selectMicrocycleForDate } from '../utils/programBlockState';
import { hasStoredWeekDeclaration } from './storedWeekDeclaration';
export function compileActiveExposureConstraints(activeConstraints: any[]): any[] {
  if (!Array.isArray(activeConstraints) || activeConstraints.length === 0) return [];
  const out: any[] = [];
  const strongestFatigue = activeConstraints
    .filter((constraint) => constraint?.type === 'fatigue' && constraint.status !== 'resolved')
    .sort((left, right) => (right.severity ?? 0) - (left.severity ?? 0) ||
      String(right.lastUpdatedAt ?? '').localeCompare(String(left.lastUpdatedAt ?? '')))[0];
  const strongestSorenessByBucket = new Map<string, any>();
  for (const constraint of activeConstraints) {
    if (constraint?.type !== 'soreness' || !constraint.bucket || constraint.status === 'resolved') continue;
    const prior = strongestSorenessByBucket.get(constraint.bucket);
    if (!prior || (constraint.severity ?? 0) > (prior.severity ?? 0) ||
      ((constraint.severity ?? 0) === (prior.severity ?? 0) &&
        String(constraint.lastUpdatedAt ?? '') > String(prior.lastUpdatedAt ?? ''))) {
      strongestSorenessByBucket.set(constraint.bucket, constraint);
    }
  }
  for (const [index, c] of activeConstraints.entries()) {
    if (!c || c.status === 'resolved') continue;
    // Legacy partial constraints must not trigger the builders' device-clock
    // defaults during a pure read. Current accepted facts already have both.
    const identity = { id: c.id ?? `legacy-exposure:${index}`, startDate: c.startDate ?? '' };
    if (c.type === 'injury') {
      const trainingPaused = c.seriousSymptoms === true || c.adjustmentLevel === 'training_paused';
      const region = trainingPaused
        ? 'global'
        : c.bucket ? bucketToRegion(c.bucket) : c.region ?? null;
      if (!region) continue;
      out.push(buildInjuryConstraint({
        ...identity,
        region,
        severity: c.severity,
        status: c.status,
        trainingPaused,
        safeFocus: c.safeFocus,
        advice: c.advice,
      }));
    } else if (c.type === 'fatigue') {
      if (c !== strongestFatigue) continue;
      out.push(buildFatigueConstraint({ ...identity, severity: c.severity }));
    } else if (c.type === 'soreness' && c.bucket) {
      if (strongestSorenessByBucket.get(c.bucket) !== c) continue;
      out.push(buildSorenessConstraint({
        ...identity,
        region: bucketToRegion(c.bucket),
        severity: c.severity,
      }));
    } else if (c.type === 'schedule') {
      out.push(buildScheduleConstraint({ ...identity, severity: c.severity }));
    } else if (c.type === 'missed_session') {
      out.push(buildMissedSessionConstraint({
        ...identity,
        missedDate: c.missedDate,
        sessionName: c.sessionName,
      }));
    }
  }
  return out;
}

function isTemporaryFactConstraint(constraint: any): boolean {
  return (constraint?.temporarySourceFactIds?.length ?? 0) > 0 ||
    (constraint?.type === 'injury' && !!constraint?.injuryEpisodeId);
}


export function compileCanonicalResolvedWeek(input: {
  days: readonly ResolvedDay[]; weekStartISO: string; todayISO: string; state: ScheduleState;
}): ResolvedDay[] {
  const { state } = input;
  const days = compileCanonicalTravelDates(input);
  // Bare accepted-base composition is not a request to bake temporary display
  // constraints into storage. Only explicit constraint inputs enter this stage.
  if (!state.activeConstraints) return days;
  const accepted = hasStoredWeekDeclaration({
    overlay: state.weekScopedOverlays?.[input.weekStartISO],
    coveringMicrocycle: selectMicrocycleForDate(state.currentProgram, state.currentMicrocycle, input.weekStartISO),
    weekStart: input.weekStartISO, reader: 'canonicalWeeklyConstraintCompiler.acceptedContract',
  });
  return days.map((day) => {
    const constraints = filterConstraintsForDate(state.activeConstraints ?? [], day.date);
    if (accepted && !constraints.some(isTemporaryFactConstraint)) return day;
    return compileCanonicalDayConstraints({
      day, todayISO: input.todayISO, overrideContext: state.overrideContexts?.[day.date],
      modalityPreferences: state.modalityPreferences ?? {},
      extraConstraints: compileActiveExposureConstraints(accepted ? constraints.filter(isTemporaryFactConstraint) : constraints),
    }).day;
  });
}

/** Travel changes the compiled date, never a screen's copy of that date. */
function compileCanonicalTravelDates(input: {
  days: readonly ResolvedDay[]; todayISO: string; state: ScheduleState;
}): ResolvedDay[] {
  const spans = awaySpansFromFacts(input.state.temporarySourceFacts);
  return input.days.map(day => {
    if (!dateIsInsideAwaySpan(day.date, spans)) return day;
    const rest = (): ResolvedDay => ({ ...day, isToday: day.date === input.todayISO,
      workout: null, source: 'rest', indicator: 'rest' });
    if (day.source === 'game' || day.indicator === 'game' || day.workout?.workoutType === 'Game') return rest();
    if (!day.workout) return day;
    const team = getTeamTrainingWorkoutState(day.workout);
    if (!team.hasTeamTraining) return day;
    if (team.isTeamTrainingOnly) return rest();
    const parts = day.workout.name.split(/\s+\+\s+/).map(part => part.trim());
    const kept = parts.filter(part => part.toLowerCase() !== 'team training');
    return { ...day, workout: { ...day.workout,
      name: kept.length ? kept.join(' + ') : resolveSessionDisplayName({
        strengthIntent: day.workout.strengthIntent, exercises: team.renderableExercises,
        isTeamDay: false, tier: day.workout.sessionTier ?? 'core',
      }),
      isTeamDay: false,
      ...(day.workout.authoredDay ? { authoredDay: { ...day.workout.authoredDay, anchor: null } } : {}),
      workoutType: day.workout.workoutType === 'Team Training' ? 'Strength' : day.workout.workoutType,
      exercises: team.renderableExercises,
    } };
  });
}
