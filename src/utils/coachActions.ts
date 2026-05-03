/**
 * coachActions — Scoped, classification-driven program edits.
 *
 * The Coach can ONLY mutate the program through the 8 actions defined here.
 * Each action is scoped (LOCAL = today/tomorrow, WEEKLY = current week,
 * PERMANENT = future programs) and never reaches outside its scope.
 *
 * SCOPE ENFORCEMENT:
 *   - LOCAL/WEEKLY actions write to `dateOverrides` ONLY. The underlying
 *     microcycle template is never mutated. This guarantees that future
 *     weeks (which read from the template, not from overrides) stay
 *     untouched.
 *   - PERMANENT actions write to `athletePreferencesStore` ONLY. They
 *     affect future program generation, never the current week's
 *     dateOverrides directly.
 *
 * WHY date overrides instead of microcycle edits:
 *   `setManualOverride(date, workout)` is the resolver's Priority-1 short
 *   circuit (sessionResolver.ts:734). The override fully replaces the day
 *   without touching the underlying template. When the coach lightens
 *   Wednesday or moves Friday's session to Saturday, only those specific
 *   dates flip — every other day, including the same day-of-week in
 *   future weeks, resolves untouched.
 *
 * RETURN SHAPE:
 *   Every action returns { success, reason? } so the caller can:
 *   (a) gate the system message on actual application,
 *   (b) surface the reason ("could not find Bench Press on Tuesday")
 *       in the AI's reply pipeline.
 */

import { useProgramStore } from '../store/programStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import {
  resolveDateWithConditioning,
} from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import { resolveExerciseName } from './loadEstimation';
import type { Workout, WorkoutExercise } from '../types/domain';

// ─── Types ───

export type CoachActionKind =
  | 'lighten_session'
  | 'move_session'
  | 'make_session_optional'
  | 'replace_exercise'
  | 'remove_exercise'
  | 'add_weekly_override'
  | 'ban_exercise_globally'
  | 'set_preferred_alternative'
  | 'save_note';

export type ScopeKind =
  | 'local_adjustment'      // today + next 1-2 days
  | 'weekly_adjustment'     // current week only
  | 'permanent_preference'  // future programs
  | 'injury'                // weekly OR permanent depending on severity
  | 'exercise_swap'         // current session only (escalates to permanent if user implies)
  | 'schedule_change'       // current week — adjust + reflow
  | 'question_only';        // no mutation

export interface ActionResult {
  success: boolean;
  reason?: string;
  /**
   * Populated when the user's exercise query matched more than one exercise
   * in the resolved session. The dispatcher surfaces these to the AI so it
   * can ASK which the user meant rather than silently picking one. Always
   * accompanies success: false.
   */
  ambiguous?: { candidates: string[] };
}

export interface LightenSessionInput {
  date: string;
  /** Optional intensity floor — 'recovery' = full conversion to recovery; 'optional' = mark optional + halve volume; default 'optional' */
  level?: 'optional' | 'recovery';
}

export interface MoveSessionInput {
  fromDate: string;
  toDate: string;
}

export interface MakeSessionOptionalInput {
  date: string;
}

export interface ReplaceExerciseInput {
  date: string;
  fromExercise: string;
  toExercise: {
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
    weight?: number;
    notes?: string;
  };
}

export interface RemoveExerciseInput {
  date: string;
  exercise: string;
}

export type WeeklyOverrideRule =
  | 'reduce_lower_volume'
  | 'reduce_intensity'
  | 'no_running'
  | 'remove_optional_sessions';

export interface AddWeeklyOverrideInput {
  rule: WeeklyOverrideRule;
}

export interface BanExerciseGloballyInput {
  exercise: string;
}

export interface SetPreferredAlternativeInput {
  exercise: string;
  alternative: string;
}

// ─── Helpers ───

/**
 * Decides whether the proposed workout differs from the current one in any
 * way the athlete would notice. The comparator is deliberately narrow — it
 * considers ONLY the fields the user listed as "real change":
 *
 *   • exercise list (by name + sets + reps + weight, in order)
 *   • workout name + type
 *   • session tier (core/optional/recovery)
 *   • workout-level intensity
 *   • combined conditioning presence + intent
 *
 * Description / timestamps / IDs are intentionally ignored — they're not
 * "real changes" for the athlete and would otherwise force every action
 * to write a noisy override.
 *
 * Used by every action handler to short-circuit BEFORE calling
 * setManualOverride. If the proposed workout is equivalent to the resolved
 * current one, the action returns success: false (or simply skips for
 * weekly batch ops) and the day stays template-driven.
 */
function workoutsAreEquivalent(a: Workout, b: Workout): boolean {
  if (a.name !== b.name) return false;
  if (a.workoutType !== b.workoutType) return false;
  if (a.sessionTier !== b.sessionTier) return false;
  if (a.intensity !== b.intensity) return false;
  if (!!a.hasCombinedConditioning !== !!b.hasCombinedConditioning) return false;
  if (!!a.conditioningBlock !== !!b.conditioningBlock) return false;
  if (a.conditioningBlock && b.conditioningBlock) {
    if (a.conditioningBlock.intent !== b.conditioningBlock.intent) return false;
    const ao = a.conditioningBlock.options?.length || 0;
    const bo = b.conditioningBlock.options?.length || 0;
    if (ao !== bo) return false;
  }
  if (a.exercises.length !== b.exercises.length) return false;
  for (let i = 0; i < a.exercises.length; i++) {
    const ea = a.exercises[i];
    const eb = b.exercises[i];
    if ((ea.exercise?.name || '') !== (eb.exercise?.name || '')) return false;
    if ((ea.prescribedSets || 0) !== (eb.prescribedSets || 0)) return false;
    if ((ea.prescribedRepsMin || 0) !== (eb.prescribedRepsMin || 0)) return false;
    if ((ea.prescribedRepsMax || 0) !== (eb.prescribedRepsMax || 0)) return false;
    if ((ea.prescribedWeightKg || 0) !== (eb.prescribedWeightKg || 0)) return false;
  }
  return true;
}

/** Resolve a date to its currently-effective Workout (or null if rest). */
function resolveDateWorkout(date: string): Workout | null {
  const state = buildScheduleStateImperative();
  const resolved = resolveDateWithConditioning(date, state);
  return resolved?.workout || null;
}

/**
 * Match result for `findExerciseMatch`. The handler is REQUIRED to inspect
 * `kind` before reading any other field — `match` is only present on
 * 'unique', `candidates` only on 'ambiguous'.
 */
export type ExerciseMatchResult =
  | { kind: 'unique'; match: WorkoutExercise }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'not_found' };

/**
 * Resolve an athlete's exercise phrase to a single exercise in the given
 * workout, using a strict priority ladder. The goal is to NEVER silently
 * pick the wrong variant when the phrase could mean two different things.
 *
 * Priority tiers (first non-empty result wins):
 *   1. Case-insensitive exact match against the candidate's own name.
 *      "Back Squat" / "back squat" → Back Squat. Disambiguates immediately
 *      when the user has already typed the canonical name.
 *   2. Alias resolution via `resolveExerciseName(query)` → canonical, then
 *      case-insensitive exact match. "rdl" → "RDLs"; "barbell squat" →
 *      "Back Squat". This is the most common single-mention case.
 *   3. Substring fuzzy match: candidate.name contains query (one direction
 *      only — we never check `query.includes(candidate)` because that
 *      collapses every short query into the first long candidate).
 *
 * If a tier returns:
 *   • exactly one candidate → unique
 *   • two or more         → ambiguous (caller should ask the user which)
 *   • zero                → fall through to the next tier
 *
 * If all tiers return zero → not_found.
 *
 * Examples (workout has Back Squat + Front Squat + Goblet Squat):
 *   "back squat"    → unique(Back Squat)             [tier 1]
 *   "barbell squat" → unique(Back Squat)             [tier 2 alias]
 *   "squat"         → ambiguous([Back, Front, Goblet]) [tier 3 — multiple subs]
 *
 * Examples (workout has RDLs + Single-Leg RDL):
 *   "rdl"           → unique(RDLs)                   [tier 2 alias]
 *   "single leg rdl"→ unique(Single-Leg RDL)         [tier 2 alias]
 *   "RDL"           → unique(RDLs)                   [tier 2 alias]
 */
export function findExerciseMatch(workout: Workout, query: string): ExerciseMatchResult {
  const trimmed = (query || '').trim();
  if (!trimmed) return { kind: 'not_found' };
  const queryLower = trimmed.toLowerCase();

  const exerciseNames = workout.exercises.map((ex) => (ex.exercise?.name || ''));

  // Tier 1: case-insensitive exact match against existing names
  const exactMatches = workout.exercises.filter(
    (ex) => (ex.exercise?.name || '').toLowerCase().trim() === queryLower,
  );
  if (exactMatches.length === 1) {
    return { kind: 'unique', match: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: exactMatches.map((ex) => ex.exercise?.name || ''),
    };
  }

  // Tier 2: alias resolution. Try the user's input through the canonical
  // alias map; if it normalises to a different name, look that up exactly.
  const canonical = resolveExerciseName(trimmed);
  const canonicalLower = canonical.toLowerCase().trim();
  if (canonicalLower !== queryLower) {
    const aliasMatches = workout.exercises.filter(
      (ex) => (ex.exercise?.name || '').toLowerCase().trim() === canonicalLower,
    );
    if (aliasMatches.length === 1) {
      return { kind: 'unique', match: aliasMatches[0] };
    }
    if (aliasMatches.length > 1) {
      return {
        kind: 'ambiguous',
        candidates: aliasMatches.map((ex) => ex.exercise?.name || ''),
      };
    }
  }

  // Tier 3: substring fuzzy. ONE direction only — candidate name contains
  // the user's query. Never `query.includes(name)`: a 2-char query would
  // pass "contains" against any longer candidate and quietly grab the
  // first one. We also check the canonical form just in case the workout
  // stores a non-canonical variant.
  const fuzzyMatches = workout.exercises.filter((ex) => {
    const name = (ex.exercise?.name || '').toLowerCase().trim();
    return name.includes(queryLower) || (canonicalLower !== queryLower && name.includes(canonicalLower));
  });
  if (fuzzyMatches.length === 1) {
    return { kind: 'unique', match: fuzzyMatches[0] };
  }
  if (fuzzyMatches.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: fuzzyMatches.map((ex) => ex.exercise?.name || ''),
    };
  }

  // Lint suppression — reference for debugging without changing behaviour.
  void exerciseNames;

  return { kind: 'not_found' };
}

/** Build a deep-enough Workout copy that the resolver can render. */
function cloneWorkout(w: Workout, overrides: Partial<Workout> = {}): Workout {
  return {
    ...w,
    exercises: w.exercises.map((ex) => ({ ...ex })),
    ...overrides,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Actions ───

/**
 * Drop intensity / volume on a single day.
 * - level='optional' (default): flip sessionTier to 'optional', halve sets
 * - level='recovery': replace with a recovery shell (no exercises, label only)
 */
export function lightenSession(input: LightenSessionInput): ActionResult {
  const { date, level = 'optional' } = input;
  const current = resolveDateWorkout(date);
  if (!current) {
    return { success: false, reason: `No session on ${date} to lighten.` };
  }

  const setManualOverride = useProgramStore.getState().setManualOverride;

  if (level === 'recovery') {
    const recoveryShell: Workout = cloneWorkout(current, {
      name: 'Recovery',
      description: 'Light mobility / walk. Coach-lightened — no loaded work today.',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      hasCombinedConditioning: false,
      conditioningBlock: undefined,
      exercises: [],
    });
    if (workoutsAreEquivalent(current, recoveryShell)) {
      return { success: false, reason: `${date} is already a recovery day.` };
    }
    setManualOverride(date, recoveryShell, { intent: 'dismissed', label: 'Coach-lightened' });
    return { success: true };
  }

  // Default: optional + halve sets
  const lightened = cloneWorkout(current, {
    sessionTier: 'optional',
    description: (current.description || '').trim() + ' [Coach-lightened — optional this week]',
    exercises: current.exercises.map((ex) => ({
      ...ex,
      prescribedSets: Math.max(1, Math.ceil(ex.prescribedSets / 2)),
    })),
  });
  if (workoutsAreEquivalent(current, lightened)) {
    return { success: false, reason: `${date} is already at minimum load.` };
  }
  setManualOverride(date, lightened, { intent: 'dismissed', label: 'Coach-lightened' });
  return { success: true };
}

/**
 * Swap two days' sessions. Common use: "moved my session from Wed to Thu."
 * Implementation: capture both resolved workouts, write each to the OTHER date.
 * If a side has no session, write a rest-day override on the source.
 */
export function moveSession(input: MoveSessionInput): ActionResult {
  const { fromDate, toDate } = input;
  if (fromDate === toDate) {
    return { success: false, reason: 'fromDate and toDate are the same.' };
  }
  const fromWorkout = resolveDateWorkout(fromDate);
  if (!fromWorkout) {
    return { success: false, reason: `No session on ${fromDate} to move.` };
  }
  const toWorkout = resolveDateWorkout(toDate);

  const setManualOverride = useProgramStore.getState().setManualOverride;
  const removeManualOverride = useProgramStore.getState().removeManualOverride;

  // Move the from-workout to its new date (with new dayOfWeek for resolver)
  const newDow = new Date(toDate + 'T12:00:00').getDay();
  const movedWorkout = cloneWorkout(fromWorkout, {
    dayOfWeek: newDow,
    description: (fromWorkout.description || '').trim() + ` [Moved from ${fromDate}]`,
  });
  setManualOverride(toDate, movedWorkout, { intent: 'dismissed', label: 'Moved session' });

  // Source date: if there was a workout there, write it to the original
  // toDate slot (full swap). If not, just clear the source so it resolves
  // as rest / template default.
  if (toWorkout) {
    const sourceDow = new Date(fromDate + 'T12:00:00').getDay();
    const swappedIn = cloneWorkout(toWorkout, {
      dayOfWeek: sourceDow,
      description: (toWorkout.description || '').trim() + ` [Swapped from ${toDate}]`,
    });
    setManualOverride(fromDate, swappedIn, { intent: 'dismissed', label: 'Swapped session' });
  } else {
    // Empty target → just clear the source so the resolver's default applies
    // (which will likely be the same template workout that's about to be
    // overwritten by the to-side override above).
    removeManualOverride(fromDate);
  }
  return { success: true };
}

/** Mark a session as optional without changing its content. */
export function makeSessionOptional(input: MakeSessionOptionalInput): ActionResult {
  const { date } = input;
  const current = resolveDateWorkout(date);
  if (!current) {
    return { success: false, reason: `No session on ${date} to mark optional.` };
  }
  if (current.sessionTier === 'optional') {
    return { success: false, reason: `${date} is already optional.` };
  }
  const setManualOverride = useProgramStore.getState().setManualOverride;
  const optional = cloneWorkout(current, {
    sessionTier: 'optional',
    description: (current.description || '').trim() + ' [Marked optional]',
  });
  setManualOverride(date, optional, { intent: 'dismissed', label: 'Marked optional' });
  return { success: true };
}

/** Swap one exercise on a single date for another. */
export function replaceExerciseAtDate(input: ReplaceExerciseInput): ActionResult {
  const { date, fromExercise, toExercise } = input;
  const current = resolveDateWorkout(date);
  if (!current) {
    return { success: false, reason: `No session on ${date} to swap exercise on.` };
  }
  const matchResult = findExerciseMatch(current, fromExercise);
  if (matchResult.kind === 'not_found') {
    return {
      success: false,
      reason: `Could not find "${fromExercise}" on ${date}.`,
    };
  }
  if (matchResult.kind === 'ambiguous') {
    // Surface the candidates so the AI can ask "which one?" rather than
    // silently swapping the first match. We deliberately do NOT pick a
    // default — every silent pick is a chance to swap the wrong variant.
    return {
      success: false,
      reason: `"${fromExercise}" matches multiple exercises on ${date}: ${matchResult.candidates.join(', ')}. Ask the athlete which one they mean.`,
      ambiguous: { candidates: matchResult.candidates },
    };
  }
  const found = matchResult.match;
  const replacementId = `ex-coach-${toExercise.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const replacement: WorkoutExercise = {
    ...found,
    exerciseId: replacementId,
    prescribedSets: toExercise.sets,
    prescribedRepsMin: toExercise.repsMin,
    prescribedRepsMax: toExercise.repsMax,
    prescribedWeightKg: toExercise.weight ?? 0,
    notes: toExercise.notes || found.notes,
    exercise: {
      id: replacementId,
      name: toExercise.name,
      description: toExercise.name,
      exerciseType: 'Compound' as any,
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any,
  };

  const setManualOverride = useProgramStore.getState().setManualOverride;
  const newWorkout = cloneWorkout(current, {
    exercises: current.exercises.map((ex) =>
      ex === found ? replacement : ex,
    ),
  });
  if (workoutsAreEquivalent(current, newWorkout)) {
    return { success: false, reason: `"${fromExercise}" already matches the requested swap on ${date}.` };
  }
  setManualOverride(date, newWorkout, { intent: 'dismissed', label: 'Exercise swap' });
  return { success: true };
}

/** Remove a single exercise from a single date. */
export function removeExerciseAtDate(input: RemoveExerciseInput): ActionResult {
  const { date, exercise } = input;
  const current = resolveDateWorkout(date);
  if (!current) {
    return { success: false, reason: `No session on ${date} to remove exercise from.` };
  }
  const matchResult = findExerciseMatch(current, exercise);
  if (matchResult.kind === 'not_found') {
    return { success: false, reason: `Could not find "${exercise}" on ${date}.` };
  }
  if (matchResult.kind === 'ambiguous') {
    return {
      success: false,
      reason: `"${exercise}" matches multiple exercises on ${date}: ${matchResult.candidates.join(', ')}. Ask the athlete which one they mean.`,
      ambiguous: { candidates: matchResult.candidates },
    };
  }
  const found = matchResult.match;

  const setManualOverride = useProgramStore.getState().setManualOverride;
  const newWorkout = cloneWorkout(current, {
    exercises: current.exercises.filter((ex) => ex !== found),
  });
  // Removing an exercise always changes exercise count → comparator catches
  // any pathological case (e.g. workout with 0 matching) but in practice
  // this branch always writes.
  if (workoutsAreEquivalent(current, newWorkout)) {
    return { success: false, reason: `Removing "${exercise}" on ${date} produced no change.` };
  }
  setManualOverride(date, newWorkout, { intent: 'dismissed', label: 'Exercise removed' });
  return { success: true };
}

/**
 * Apply a structural rule to every day in the current week.
 *
 * SCOPE: weekly only. Walks Mon→Sun of the current week, mutates each
 * affected day's resolved workout, writes back as a date override. The
 * microcycle template is untouched, so the next week resolves clean.
 *
 * Rules:
 *   - reduce_lower_volume: halve sets on lower-pattern exercises (squat/hinge keywords)
 *   - reduce_intensity: halve sets across the board, mark sessions optional
 *   - no_running: strip running/conditioning blocks; keep strength only
 *   - remove_optional_sessions: drop everything tagged sessionTier='optional'
 */
export function addWeeklyOverride(input: AddWeeklyOverrideInput): ActionResult {
  const { rule } = input;
  const today = new Date();
  const dow = today.getDay();
  const daysToMonday = dow === 0 ? -6 : -(dow - 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  monday.setHours(12, 0, 0, 0);

  const setManualOverride = useProgramStore.getState().setManualOverride;
  const removeManualOverride = useProgramStore.getState().removeManualOverride;

  const LOWER_PATTERN = /(squat|hinge|deadlift|rdl|lunge|split squat|hip thrust|leg press|jump|broad jump|box jump)/i;
  const RUN_PATTERN = /(run|sprint|interval|tempo|fartlek|repeat|mas|m run|km|tt)/i;

  // Walk Mon→Sun. For each day, build the proposed workout under this rule
  // and compare to current via workoutsAreEquivalent. ONLY write an override
  // when something the athlete would notice actually changed. This keeps the
  // override footprint minimal — e.g. "reduce_lower_volume" on a Mon-lower /
  // Wed-upper week writes one override (Mon), not two.
  let touched = 0;
  for (let i = 0; i < 7; i++) {
    const probe = new Date(monday);
    probe.setDate(monday.getDate() + i);
    const date = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
    const current = resolveDateWorkout(date);
    if (!current) continue;

    let next: Workout | null = null;
    switch (rule) {
      case 'reduce_lower_volume': {
        // Only build a proposal if the day actually has a lower-pattern
        // exercise. Otherwise leave the day untouched — no description
        // stamp, no override.
        const hasLower = current.exercises.some((ex) => LOWER_PATTERN.test(ex.exercise?.name || ''));
        if (!hasLower) break;
        next = cloneWorkout(current, {
          exercises: current.exercises.map((ex) => {
            const exName = ex.exercise?.name || '';
            if (LOWER_PATTERN.test(exName)) {
              return { ...ex, prescribedSets: Math.max(1, Math.ceil(ex.prescribedSets / 2)) };
            }
            return ex;
          }),
          description: (current.description || '').trim() + ' [Weekly override: reduced lower volume]',
        });
        break;
      }
      case 'reduce_intensity': {
        // Skip rest-shell days that have no exercises and aren't core —
        // halving zero is a no-op and we don't want to flip recovery → recovery.
        if (current.exercises.length === 0 && current.sessionTier !== 'core') break;
        next = cloneWorkout(current, {
          sessionTier: current.sessionTier === 'core' ? 'optional' : current.sessionTier,
          exercises: current.exercises.map((ex) => ({
            ...ex,
            prescribedSets: Math.max(1, Math.ceil(ex.prescribedSets / 2)),
          })),
          description: (current.description || '').trim() + ' [Weekly override: reduced intensity]',
        });
        break;
      }
      case 'no_running': {
        // Only build a proposal if there's running content to strip — either
        // a combined conditioning block, or an exercise whose name/notes
        // match the run pattern.
        const hasRunExercise = current.exercises.some(
          (ex) => RUN_PATTERN.test(ex.exercise?.name || '') || RUN_PATTERN.test(ex.notes || ''),
        );
        const hasConditioning = !!current.hasCombinedConditioning || !!current.conditioningBlock;
        if (!hasRunExercise && !hasConditioning) break;
        next = cloneWorkout(current, {
          hasCombinedConditioning: false,
          conditioningBlock: undefined,
          exercises: current.exercises.filter(
            (ex) => !RUN_PATTERN.test(ex.exercise?.name || '') && !RUN_PATTERN.test(ex.notes || ''),
          ),
          description: (current.description || '').trim() + ' [Weekly override: no running]',
        });
        break;
      }
      case 'remove_optional_sessions': {
        // Only act on optional days — non-optional days are left alone, no
        // override write at all.
        if (current.sessionTier !== 'optional') break;
        next = cloneWorkout(current, {
          name: 'Rest',
          description: 'Coach-removed optional session.',
          sessionTier: 'recovery',
          workoutType: 'Recovery',
          exercises: [],
          conditioningBlock: undefined,
          hasCombinedConditioning: false,
        });
        break;
      }
    }

    // No proposal built (rule didn't apply to this day) → leave it alone.
    if (next === null) continue;
    // Proposal is identical to current state → skip the write so the day
    // stays template-driven and no new override is recorded.
    if (workoutsAreEquivalent(current, next)) continue;
    setManualOverride(date, next, { intent: 'dismissed', label: `Weekly: ${rule}` });
    touched++;
  }

  // `removeManualOverride` is no longer called from within this loop — the
  // rules above never need to clear an existing override; they either write
  // a new one (when the rule applies and changes something) or skip.
  // Reference kept for symmetry with the imperative pattern in other actions.
  void removeManualOverride;

  if (touched === 0) {
    return { success: false, reason: `No sessions matched rule "${rule}" this week.` };
  }
  return { success: true };
}

/**
 * Ban an exercise from ALL future programs.
 * Writes to athletePreferencesStore.excluded — feeds the pool rotation
 * pipeline at program-build time.
 *
 * The user's input is alias-resolved to its canonical name BEFORE
 * persisting. This keeps the exclusion list consistent with the names the
 * pool rotation actually emits — saying "I never want romanian deadlifts"
 * stores "RDLs" (the canonical), not "romanian deadlift", which would
 * silently miss every future generation.
 */
export function banExerciseGlobally(input: BanExerciseGloballyInput): ActionResult {
  const { exercise } = input;
  if (!exercise || !exercise.trim()) {
    return { success: false, reason: 'No exercise name provided.' };
  }
  const canonical = resolveExerciseName(exercise.trim());
  useAthletePreferencesStore.getState().addExclusion(canonical);
  return { success: true };
}

/**
 * Set a preferred alternative: ban the original AND pin the substitute.
 * Composed of addExclusion + addPinned — both already feed the rotation
 * pipeline. For same-slot pairs (e.g. BB Bench → DB Bench) the rotation
 * will pick the pinned alternative when the slot comes up.
 *
 * Both inputs are alias-resolved to their canonical names so the stored
 * pair matches what the pool rotation will actually emit. We also
 * compare the canonical pair (not the raw input) for the same-exercise
 * guard — saying "swap RDL for romanian deadlift" should be rejected
 * because both resolve to "RDLs".
 */
export function setPreferredAlternative(
  input: SetPreferredAlternativeInput,
): ActionResult {
  const { exercise, alternative } = input;
  if (!exercise || !alternative) {
    return { success: false, reason: 'Both exercise and alternative are required.' };
  }
  const canonicalExercise = resolveExerciseName(exercise.trim());
  const canonicalAlternative = resolveExerciseName(alternative.trim());
  if (canonicalExercise.toLowerCase() === canonicalAlternative.toLowerCase()) {
    return { success: false, reason: 'Original and alternative resolve to the same exercise.' };
  }
  const prefs = useAthletePreferencesStore.getState();
  prefs.addExclusion(canonicalExercise);
  prefs.addPinned(canonicalAlternative);
  return { success: true };
}

// ─── Dispatcher ───

export interface CoachAction {
  kind: CoachActionKind;
  /** The classification the AI declared for this action. Used for logs / scope verification. */
  scope?: ScopeKind;
  payload: any;
}

/**
 * Apply a single CoachAction. Returns the structured result so the caller
 * can surface success/failure reasons in the AI's reply pipeline.
 */
export function applyCoachAction(action: CoachAction): ActionResult {
  switch (action.kind) {
    case 'lighten_session':
      return lightenSession(action.payload as LightenSessionInput);
    case 'move_session':
      return moveSession(action.payload as MoveSessionInput);
    case 'make_session_optional':
      return makeSessionOptional(action.payload as MakeSessionOptionalInput);
    case 'replace_exercise':
      return replaceExerciseAtDate(action.payload as ReplaceExerciseInput);
    case 'remove_exercise':
      return removeExerciseAtDate(action.payload as RemoveExerciseInput);
    case 'add_weekly_override':
      return addWeeklyOverride(action.payload as AddWeeklyOverrideInput);
    case 'ban_exercise_globally':
      return banExerciseGlobally(action.payload as BanExerciseGloballyInput);
    case 'set_preferred_alternative':
      return setPreferredAlternative(action.payload as SetPreferredAlternativeInput);
    case 'save_note':
      // Notes go to the coach memory store; the CoachScreen handles them
      // alongside actions. This dispatcher just acknowledges.
      return { success: true };
    default:
      return { success: false, reason: `Unknown action kind: ${(action as any).kind}` };
  }
}

/**
 * Apply a batch of actions in order. Returns per-action results in the same
 * order. Stops processing only on individual-action exceptions; failed
 * actions still record their reason so the AI can be told what didn't apply.
 */
export function applyCoachActions(actions: CoachAction[]): ActionResult[] {
  const results: ActionResult[] = [];
  for (const action of actions) {
    try {
      results.push(applyCoachAction(action));
    } catch (e: any) {
      results.push({
        success: false,
        reason: `Exception applying ${action.kind}: ${e?.message || String(e)}`,
      });
    }
  }
  return results;
}
