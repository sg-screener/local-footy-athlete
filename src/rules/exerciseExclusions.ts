/**
 * THE ONE OWNER OF "IS THIS EXERCISE LEFT OUT, AND FOR HOW LONG".
 *
 * Sam's approved Block Two contract
 * (`docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`, "Athlete
 * substitutions and exclusions") gives the athlete THREE answers to one
 * question — *"How long should we leave this exercise out?"* — and the app had
 * TWO, in two different stores, neither of which could say when it ended:
 *
 *   - `athletePreferencesStore.prefs.excluded: string[]` — a bare name, forever,
 *     written by the coach door (`coachActions.applyAvoidExercise`);
 *   - `coachUpdatesStore` `ActivePreferenceConstraint { preferenceKind:
 *     'avoid_exercise' }` — a bare name, forever, written by the day screen's
 *     "Future weeks too" branch.
 *
 * Two stores holding the same decision is two answers to "is this excluded", and
 * only one of them (`prefs.excluded`) reaches generation at all — the composer's
 * `excludedIdentities` input is fed from it and from nothing else
 * (`services/api/generateProgram.ts`). The day screen's own future-scope branch
 * therefore wrote a fact the generator never read.
 *
 * ⚠ **THIS MODULE IS PURE AND KNOWS NO STORE.** It owns the SHAPE of the
 * decision and every question asked of it. The store owns persistence
 * (`store/athletePreferencesStore.ts`) and `utils/exerciseExclusionOwner.ts`
 * owns the transaction. Three files, one meaning; a fourth meaning is the
 * defect, not a convenience.
 *
 * ── WHY THE END DATE IS STORED AND NOT DERIVED ─────────────────────────────
 *
 * The north star says derive everything that is not an input. `activeThroughISO`
 * looks derivable — "this block" ends when the block ends — and it is NOT, for
 * the reason the block anchor exists at all: the anchor MOVES. `boot`
 * regenerates and can re-anchor the grid (`programBlockState.resolveBlockGridPosition`
 * reads a stored anchor that rollover advances), so a "this block" exclusion
 * re-derived a fortnight later would silently answer for a DIFFERENT block than
 * the one the athlete was standing in when they answered.
 *
 * The athlete's decision is *"until the end of the block I am in"*, and the block
 * they were in is a FACT ABOUT THE MOMENT OF THE DECISION. That fact is an input.
 * It is stamped once, by the transaction owner, from the live block state, and
 * never recomputed.
 *
 * WRITER: `utils/exerciseExclusionOwner.applyExerciseExclusionDecision` (the only
 * one). READER: `store/athletePreferencesStore.getAthletePrefs` (generation),
 * `utils/activeProgramModifiers` (Status), `rules/composeWeek` (selection).
 * TEST: `src/__tests__/exerciseExclusionScopeTests.ts`.
 */

import type { Workout } from '../types/domain';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';

/**
 * THE THREE ANSWERS, AND ONLY THESE THREE. Sam's contract names them in the
 * athlete's own words; these ids are what travel.
 *
 *   'today_only'    → "Today only"
 *   'this_block'    → "This block"
 *   'until_changed' → "Until I change it"
 */
export type ExerciseExclusionScope = 'today_only' | 'this_block' | 'until_changed';

export const EXERCISE_EXCLUSION_SCOPES = [
  'today_only',
  'this_block',
  'until_changed',
] as const satisfies readonly ExerciseExclusionScope[];

/** The athlete-facing label for each scope. One owner, so the sheet and Status agree. */
export const EXERCISE_EXCLUSION_SCOPE_LABEL: Record<ExerciseExclusionScope, string> = {
  today_only: 'Today only',
  this_block: 'This block',
  until_changed: 'Until I change it',
};

/**
 * The question itself, VERBATIM from the approved contract.
 *
 * A constant and not a literal in a screen, because two surfaces ask it — the
 * day screen after a removal, and My Status when the athlete changes a scope —
 * and a question worded two ways is two questions to the person answering it.
 */
export const EXERCISE_EXCLUSION_QUESTION = 'How long should we leave this exercise out?';

/**
 * What each answer MEANS, in the athlete's words. One owner for the same reason
 * as the labels: the day screen and Status must promise the same thing.
 */
export const EXERCISE_EXCLUSION_SCOPE_DETAIL: Record<ExerciseExclusionScope, string> = {
  today_only: 'Just this session. It can come back next time.',
  this_block: 'Out for the rest of this block, then back to normal.',
  until_changed: 'Out of every session until you put it back.',
};

/**
 * ONE ATHLETE DECISION ABOUT ONE EXERCISE.
 *
 * `exercise` is the CANONICAL identity and it is also the record's IDENTITY:
 * there is at most one live exclusion per exercise, which is what makes
 * "Change scope" an update of the same fact rather than a second exclusion
 * beside the first (contract: *"Changing or restoring must use the same
 * canonical transaction owner"*; proof case 5).
 */
export interface ExerciseExclusion {
  /** Canonical exercise identity — the record's key. */
  readonly exercise: string;
  readonly scope: ExerciseExclusionScope;
  /** The day the athlete answered. First day the exclusion applies. */
  readonly decidedOnISO: string;
  /**
   * LAST day the exclusion applies, inclusive. `null` means no end — the
   * athlete restores it or it never lifts. See the docstring above for why this
   * is stored rather than recomputed.
   */
  readonly activeThroughISO: string | null;
  /** The block the athlete was standing in. Recorded so Status can say which. */
  readonly blockNumber: number | null;
  /** The athlete's own words, when they gave any. Never invented. */
  readonly reason?: string;
}

/**
 * WHEN DOES THIS DECISION STOP APPLYING?
 *
 * The ONE place the three scopes become a date, so a scope cannot mean one span
 * at the day screen and another at Status.
 *
 * `blockEndISO` is the end of the block the athlete is standing in RIGHT NOW.
 * A `this_block` answer with no block to end (no program yet) degrades to the
 * decision day rather than to forever: a scope the app cannot honour must
 * under-apply, never over-apply, because over-applying silently bans an
 * exercise the athlete only meant to skip.
 */
export function resolveExclusionActiveThrough(args: {
  scope: ExerciseExclusionScope;
  decidedOnISO: string;
  blockEndISO: string | null;
}): string | null {
  switch (args.scope) {
    case 'today_only':
      return args.decidedOnISO;
    case 'this_block':
      return args.blockEndISO && args.blockEndISO >= args.decidedOnISO
        ? args.blockEndISO
        : args.decidedOnISO;
    case 'until_changed':
      return null;
    default: {
      const exhaustive: never = args.scope;
      return exhaustive;
    }
  }
}

/**
 * THE ONE PREDICATE. Every projection below is this function applied to a
 * different set of dates — there is no second definition of "active".
 *
 * Closed at BOTH ends. The lower bound is what keeps a decision taken on
 * Wednesday from claiming Monday's already-completed session: *"Past completed
 * sessions remain immutable"*.
 */
export function exclusionIsActiveOn(
  exclusion: ExerciseExclusion,
  dateISO: string,
): boolean {
  const day = dateISO.slice(0, 10);
  if (day < exclusion.decidedOnISO) return false;
  return exclusion.activeThroughISO === null || day <= exclusion.activeThroughISO;
}

export function activeExclusionsOn(
  exclusions: readonly ExerciseExclusion[] | null | undefined,
  dateISO: string,
): ExerciseExclusion[] {
  return (exclusions ?? []).filter((e) => exclusionIsActiveOn(e, dateISO));
}

export function excludedExerciseNamesOn(
  exclusions: readonly ExerciseExclusion[] | null | undefined,
  dateISO: string,
): string[] {
  return activeExclusionsOn(exclusions, dateISO).map((e) => e.exercise);
}

/**
 * WHAT GENERATION IS TOLD, SPLIT THE ONLY WAY THAT DOES NOT LIE.
 *
 * The composer authors a WEEK in one call, and the three scopes do not all span
 * a week. A `today_only` answer folded into a week-wide exclusion set would take
 * the exercise out of Thursday's session too — the athlete said *today*, and
 * proof case 1 is precisely that it "returns later".
 *
 * So the resolution is TWO projections of the one predicate:
 *   - `wholeWeek` — active on EVERY day of the week. Safe to apply week-wide.
 *   - `byDate`    — active on SOME days. Applied to exactly those days.
 *
 * A name appears in one or the other, never both.
 */
export interface WeekExclusionResolution {
  readonly weekStartISO: string;
  readonly wholeWeek: readonly string[];
  readonly byDate: Readonly<Record<string, readonly string[]>>;
}

export function resolveWeekExclusions(
  exclusions: readonly ExerciseExclusion[] | null | undefined,
  weekStartISO: string,
): WeekExclusionResolution {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i));
  const wholeWeek: string[] = [];
  const byDate: Record<string, string[]> = {};
  for (const exclusion of exclusions ?? []) {
    const activeDays = days.filter((day) => exclusionIsActiveOn(exclusion, day));
    if (activeDays.length === 0) continue;
    if (activeDays.length === days.length) {
      wholeWeek.push(exclusion.exercise);
      continue;
    }
    for (const day of activeDays) {
      (byDate[day] ??= []).push(exclusion.exercise);
    }
  }
  return { weekStartISO, wholeWeek, byDate };
}

/**
 * CHANGING THE SCOPE UPDATES THE SAME FACT (proof case 5).
 *
 * Keyed on canonical identity, so `Back Squat` answered twice is one exclusion
 * with the athlete's latest answer — never two rows in Status disagreeing about
 * when the exercise comes back.
 *
 * The list ORDER is preserved on an update so Status does not reshuffle under
 * the athlete's finger when they change a scope.
 */
export function upsertExclusion(
  exclusions: readonly ExerciseExclusion[] | null | undefined,
  next: ExerciseExclusion,
): ExerciseExclusion[] {
  const list = [...(exclusions ?? [])];
  const index = list.findIndex((e) => e.exercise === next.exercise);
  if (index < 0) return [...list, next];
  list[index] = next;
  return list;
}

/**
 * RESTORE MAKES IT ELIGIBLE AGAIN — IT DOES NOT FORCE IT BACK IN (proof case 4).
 *
 * Removing the decision is the whole of restore. Nothing here pins, prioritises
 * or re-prescribes the exercise; the next generation simply sees it in the pool
 * again and may or may not choose it, exactly as it would for any other athlete.
 */
export function restoreExclusion(
  exclusions: readonly ExerciseExclusion[] | null | undefined,
  exercise: string,
): ExerciseExclusion[] {
  const identity = canonicalExerciseName(String(exercise ?? '').trim());
  return (exclusions ?? []).filter((e) => e.exercise !== identity);
}

export function findExclusion(
  exclusions: readonly ExerciseExclusion[] | null | undefined,
  exercise: string,
): ExerciseExclusion | null {
  const identity = canonicalExerciseName(String(exercise ?? '').trim());
  return (exclusions ?? []).find((e) => e.exercise === identity) ?? null;
}

/**
 * WHAT STATUS SAYS ABOUT WHEN THIS LIFTS.
 *
 * Derived from the record at render time, never stored as prose — a stored
 * sentence goes stale the day the scope changes and nothing reds.
 */
export function exclusionExpiryLabel(exclusion: ExerciseExclusion): string {
  if (exclusion.activeThroughISO === null) return 'No end date — until you restore it';
  if (exclusion.scope === 'today_only') return `Today only (${exclusion.activeThroughISO})`;
  return `Until ${exclusion.activeThroughISO}`;
}

/** Local, dependency-free date step. Mirrors `programBlockState.addDaysISO`. */
function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * ── THE ALREADY-AUTHORED HALF OF A REMOVAL ─────────────────────────────────
 *
 * Sam, 2026-08-19: *"This block removes the exercise from every remaining
 * already-authored session in this block. Until restored removes it from
 * current and future sessions/blocks."*
 *
 * Everything above this line answers a question asked at GENERATION time —
 * `getAthletePrefs` hands the exclusions to the composer, so a week the app has
 * not authored yet is authored without the exercise. That covers "future
 * sessions/blocks" completely and covers the athlete's own block NOT AT ALL:
 * the current block is already authored and accepted, and nothing regenerates
 * it. Measured 2026-08-19 — a `this_block` answer reached exactly one day.
 *
 * **THE DECISION IS ALREADY STORED. THIS IS THE OTHER PROJECTION OF IT.**
 * `exclusionIsActiveOn` is the one predicate; `resolveWeekExclusions` applies it
 * to a week the composer is about to author, and this applies it to a week the
 * composer already authored. There is no second stored shape, no per-session
 * record, and nothing to keep in step — which is why Undo restores the EXACT
 * item: the row was never destroyed, only filtered out of the read while the
 * decision stands.
 *
 * **AND NOTHING CAN REFILL THE SLOT**, because this is a filter and the composer
 * never runs. That is Sam's Remove contract stated as a mechanism rather than as
 * a hope: *"Nothing replaces it. The session may have fewer exercises and may
 * lose that movement pattern."*
 *
 * The lower bound of `exclusionIsActiveOn` is what makes "REMAINING" true — a
 * decision taken on Wednesday cannot reach into Monday's completed session.
 *
 * WRITER: none, this stores nothing. READER: `rules/acceptedEffectiveWeek`
 * (the one compose owner every visible-week read goes through).
 * TEST: `src/__tests__/exerciseRemovalOwnerTests.ts`.
 */
export function applyExclusionsToAuthoredDay<T extends Workout | null | undefined>(args: {
  workout: T;
  dateISO: string;
  exclusions?: readonly ExerciseExclusion[] | null;
}): T {
  const workout = args.workout;
  if (!workout) return workout;
  const rows = workout.exercises ?? [];
  if (rows.length === 0) return workout;
  const excluded = new Set(excludedExerciseNamesOn(args.exclusions, args.dateISO.slice(0, 10)));
  if (excluded.size === 0) return workout;
  const kept = rows.filter((row) => !excluded.has(canonicalExerciseName(rowExerciseName(row))));
  // Same rows, same object. A day nothing was removed from must come out of
  // here IDENTICAL, or every identity comparison downstream starts reporting a
  // change this filter did not make.
  if (kept.length === rows.length) return workout;
  return { ...workout, exercises: kept } as T;
}

/** The week-shaped projection of the day-shaped one above. One definition. */
export function applyExclusionsToAuthoredWeek(args: {
  workouts: readonly Workout[];
  weekStart: string;
  exclusions?: readonly ExerciseExclusion[] | null;
}): Workout[] {
  const exclusions = args.exclusions ?? [];
  if (exclusions.length === 0) return args.workouts as Workout[];
  const weekStart = args.weekStart.slice(0, 10);
  return args.workouts.map((workout) => applyExclusionsToAuthoredDay({
    workout,
    // The week's Monday plus the row's own day. A `Workout` carries
    // `dayOfWeek`, never a date — reading `workout.date` finds nothing and
    // reports a silent no-op that looks exactly like "nothing was excluded".
    dateISO: dateForDayOfWeekInWeek(weekStart, workout.dayOfWeek),
    exclusions,
  }));
}

/** A row names its exercise in one of two places. One reader, so no site guesses. */
function rowExerciseName(row: unknown): string {
  const candidate = row as { exercise?: { name?: string }; name?: string };
  return String(candidate?.exercise?.name ?? candidate?.name ?? '').trim();
}

/**
 * The date a workout sits on, from the week it is being read in.
 * `weekStart` is a Monday, and `dayOfWeek` is JS's Sunday-first 0-6 — so Sunday
 * is the week's LAST day, not its first.
 */
function dateForDayOfWeekInWeek(weekStartISO: string, dayOfWeek: number): string {
  const offset = ((dayOfWeek + 6) % 7);
  return addDaysISO(weekStartISO, offset);
}
