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
 *   → Pass 1: legacy tag-based filter (applyInjuryFilterToWorkout)
 *   → Pass 2: UNIVERSAL EXPOSURE ENGINE — applyConstraintsToSession
 *   → Pass 3: validator sweep — validateWorkoutAgainstConstraints
 *   → returns the visible workout the UI should render
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
 *   I2. `injuryFilterApplied: true` ⇒ at least one of:
 *         (a) tag-based filter rebuilt the workout, or
 *         (b) exposure engine removed exercises / attached coachNotes.
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
import { applyInjuryFilterToWorkout } from './injuryWorkoutFilter';
import type { InjuryBucket } from './programAdjustmentEngine';
import {
  buildInjuryConstraint,
  applyConstraintsToSession,
  validateWorkoutAgainstConstraints,
  type Constraint,
  type ConstraintRegion,
} from './exposureEngine';
import { logger } from './logger';

/** Map InjuryBucket → ConstraintRegion. Conservative defaults. */
const BUCKET_TO_REGION: Record<InjuryBucket, ConstraintRegion> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  knee: 'knee',
  ankle: 'ankle',
  calf: 'calf',
  hamstring: 'hamstring',
  adductor: 'groin',
  pubalgia: 'groin',
  lowerBack: 'back',
};

export interface ProjectInput {
  day: ResolvedDay;
  /** Active injury from the live store. Null/resolved = no-op. */
  activeInjury: {
    bodyPart: string;
    bucket: string | null;
    severity: number;
    status: 'active' | 'improving' | 'resolved';
    rules: string[];
  } | null;
  /** Override context for this date — may flag injury-authored edits. */
  overrideContext?: OverrideContext;
  /** Today's ISO date — used to skip past-date filtering. */
  todayISO: string;
  /** Additional constraints (fatigue, soreness, schedule, etc.) to layer on top. */
  extraConstraints?: Constraint[];
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
 * Build the active constraint set for a given day. The injury
 * constraint comes from `activeInjury`; additional constraints
 * (fatigue, soreness, schedule) are merged in via `extraConstraints`.
 */
function buildActiveConstraints(input: ProjectInput): Constraint[] {
  const constraints: Constraint[] = [];
  const injury = input.activeInjury;
  if (
    injury &&
    injury.status !== 'resolved' &&
    injury.bucket &&
    BUCKET_TO_REGION[injury.bucket as InjuryBucket]
  ) {
    constraints.push(
      buildInjuryConstraint({
        id: `injury-${injury.bucket}`,
        region: BUCKET_TO_REGION[injury.bucket as InjuryBucket],
        severity: injury.severity,
        status: injury.status,
        startDate: new Date().toISOString(),
      }),
    );
  }
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
  const { day, activeInjury, overrideContext, todayISO } = input;

  const constraints = buildActiveConstraints(input);

  // No active constraints → nothing to do.
  if (constraints.length === 0) {
    return { day, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  if (!day.workout) {
    return { day, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  // Past dates are immutable.
  if (day.date < todayISO) {
    return { day, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  // Recovery / game stubs untouched.
  if (isRecovery(day.workout) || isGame(day.workout)) {
    return { day, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }
  // Injury-authored override that ALREADY carries notes — skip to
  // avoid double-mutation. Non-injury manual overrides are STILL
  // re-checked so an athlete can't bypass constraints by editing.
  if (
    day.source === 'manual' &&
    overrideContext?.intent === 'injury' &&
    alreadyHasInjuryNote(day.workout)
  ) {
    return { day, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }

  // ── Pass 1: tag-based filter (legacy, only for injury constraint) ──
  let workoutNow: Workout = day.workout;
  let tagChanged = false;
  if (activeInjury && activeInjury.bucket && activeInjury.status !== 'resolved') {
    const tagFiltered = applyInjuryFilterToWorkout(day.workout, {
      bodyPart: activeInjury.bodyPart,
      bucket: activeInjury.bucket,
      severity: activeInjury.severity,
      status: activeInjury.status,
    });
    if (tagFiltered !== day.workout) {
      tagChanged = true;
      workoutNow = tagFiltered;
    }
  }

  // ── Pass 2: universal exposure engine ──
  const applyResult = applyConstraintsToSession(workoutNow, constraints);
  workoutNow = applyResult.workout;
  const exposureRemoved = applyResult.classification.removedNames;
  const exposureApplied = applyResult.applied;

  const filterApplied = tagChanged || exposureApplied;
  if (!filterApplied) {
    return { day, injuryFilterApplied: false, removedNames: [], replacementNames: [] };
  }

  // ── Pass 3: validator sweep ──
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

  return {
    day: { ...day, workout: workoutNow },
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
  const beforeExercises = (input.day.workout?.exercises ?? [])
    .map((e: any) => e.exercise?.name)
    .filter(Boolean);
  logger.debug('[visible-program] project_input', {
    surface,
    date: input.day.date,
    source: input.day.source,
    workoutName: input.day.workout?.name ?? null,
    beforeExercises,
    activeInjuryBucket: input.activeInjury?.bucket ?? null,
    activeInjurySeverity: input.activeInjury?.severity ?? null,
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
