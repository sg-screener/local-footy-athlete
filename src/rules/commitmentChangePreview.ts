/**
 * WHAT ACCEPTING WOULD ACTUALLY DO — READ OFF THE PROGRAM THAT ACCEPTANCE
 * PUBLISHES, NOT PREDICTED FROM THE ONE IT REPLACES.
 *
 * ## ⚠ THE FOUNDING CASE IS A REJECTED CANDIDATE, AND IT IS WHY THIS MODULE
 * ## TAKES THE CANDIDATE PROGRAM AS AN ARGUMENT INSTEAD OF BUILDING A GUESS
 *
 * `codex/finish-product` (`fe6ed715`, rejected 2026-08-20) shipped an
 * `extraSessionOfferPreview` that read the CURRENT program and told the athlete
 * what the changed day would become. The review seat swept it over 36 generated
 * worlds: of 20 previews shown, **9 matched the rebuilt week and 11 did not** —
 * in-season on two gym days it promised *"Saturday: Strength + Conditioning"*
 * and, after accepting, Saturday was strength alone with the conditioning moved
 * to Monday. **The athlete found out by accepting.**
 *
 * A predictor of a thing the app can simply BUILD is a second representation of
 * the week, free to disagree with the first, and this repo's whole convergence
 * rule is that two representations of one fact is the defect.
 *
 * So this module **cannot** guess. It has no generator import and no scheduler
 * import; it is a DIFF of two programs it is handed. The one that matters —
 * `candidate` — comes from `profileProgramCandidateBase`, which is the exact
 * function `commitProfileProgramTransaction` calls to build what it commits.
 * *"Acceptance matches the preview"* is therefore not a property a cell has to
 * re-check on every world; it is a consequence of there being one builder.
 *
 * ## L14 — DOMAIN PURITY
 *
 * Two programs and a date in, a typed preview out. No React, no store, no
 * navigation, no device clock. The caller reads the stores.
 *
 * ## ⚠ IT DESCRIBES; IT DOES NOT ADVISE
 *
 * Every field below is copied from the candidate program or compared against the
 * current one. **Nothing here infers a training consequence.** "This will make
 * your week harder" is a coaching claim, and a coaching claim assembled by a
 * preview module is unsigned copy with a rules file's name on it. What the
 * program AUTHORED — the week kind, the deload door, the session's own intensity
 * and duration, its typed components — is reported; anything else is not the
 * preview's to say.
 *
 * ## R-106 IS LOAD-BEARING HERE
 *
 * *"It is one training day containing two separate components: one strength
 * session and one conditioning session. Count and assess each component
 * separately, but do not call it two training days."* So `arrival` answers the
 * athlete's real question — is this a day I do not currently train on, or is
 * work being added to a day I already train on — and the COMPONENTS are listed
 * separately underneath it. A combined day is never reported as two days.
 */

import type {
  DayOfWeek,
  IntensityLevel,
  Microcycle,
  TrainingProgram,
  Workout,
} from '../types/domain';
import {
  getSessionComponents,
  type SessionComponentKind,
} from '../utils/sessionComponents';
import { isoDateForWeekday } from '../utils/appDate';
import { DAYS_OF_WEEK } from './gameAnchor';

/**
 * HOW THE WORK ARRIVES ON THE DAY.
 *
 * Two values, and the athlete's question is exactly which one it is. A third
 * ("the day changed shape") is deliberately absent: a day that already carried
 * work and now carries different work is `combined_with_existing`, because from
 * the athlete's diary it is still a day they were already training on.
 */
export type PreviewDayArrival = 'new_training_date' | 'combined_with_existing';

export interface CommitmentPreviewDay {
  /** The real calendar date, from the week's own start. Never a weekday name alone. */
  readonly dateISO: string;
  /** The named day, for a sentence that reads like a diary entry. */
  readonly dayOfWeek: DayOfWeek;
  readonly arrival: PreviewDayArrival;
  /** The typed components the REBUILT day carries, from the one component owner. */
  readonly components: readonly SessionComponentKind[];
  /** Their athlete-facing labels, from the same owner. Never assembled here. */
  readonly componentLabels: readonly string[];
  /**
   * The components the day ALREADY carried. Empty for a new training date, and
   * that emptiness is what makes the two arrivals distinguishable in a cell
   * without re-reading the current program.
   */
  readonly existingComponents: readonly SessionComponentKind[];
  /** The session's own authored name, type, intensity and length. Copied, not composed. */
  readonly sessionName: string;
  readonly workoutType: string;
  readonly intensity: IntensityLevel;
  readonly durationMinutes: number;
}

/**
 * WHAT THE PROGRAM ITSELF SAYS ABOUT LOAD AND RECOVERY IN THAT WEEK.
 *
 * ⚠ **AUTHORED, NEVER DERIVED.** Every field is a value the generator wrote onto
 * the microcycle. A "recovery implication" this module computed would be a
 * coaching opinion with no author, which is the class R-108 was ruled against in
 * its own domain.
 */
export interface CommitmentPreviewWeekLoad {
  readonly weekStartISO: string;
  /** The block plan's structural statement about the week, if it made one. */
  readonly weekKind: string | null;
  /** Which door deloaded the week, when it was not the scheduled one. */
  readonly deloadDoor: 'readiness' | 'illness' | null;
  readonly intensityMultiplier: number | null;
  /** Training days before and after. R-106: a combined day counts ONCE. */
  readonly trainingDaysBefore: number;
  readonly trainingDaysAfter: number;
}

export interface CommitmentChangePreview {
  readonly weekStartISO: string;
  /** Every day the rebuild changed, in week order. */
  readonly changedDays: readonly CommitmentPreviewDay[];
  readonly load: CommitmentPreviewWeekLoad;
}

/** Why no preview could be taken. Returned so a caller can say which gate closed. */
export type CommitmentPreviewRefusal =
  | 'no_candidate_week'
  | 'no_current_week'
  | 'nothing_changed';

/**
 * ⚠ **ONE SHAPE WITH TWO NULLABLE FIELDS, NOT A DISCRIMINATED UNION, AND THAT
 * IS AN ENVIRONMENT FACT RATHER THAN A STYLE CHOICE.**
 *
 * `tsconfig.compile.json` extends `expo/tsconfig.base`, which does **not** set
 * `strict`. Without `strictNullChecks`, TypeScript narrows the TRUE arm of a
 * boolean-discriminated union and **does not narrow the FALSE arm** — measured
 * on this repo's own compiler: `if (o.ask) return …; return o.refusal;` is
 * `TS2339: Property 'refusal' does not exist`. A union here would force every
 * caller into an `'refusal' in outcome` dance to read the thing the union
 * exists to expose.
 *
 * Exactly one of the two is non-null, always.
 */
export interface CommitmentChangePreviewOutcome {
  readonly value: CommitmentChangePreview | null;
  readonly refusal: CommitmentPreviewRefusal | null;
}

/**
 * Does this workout represent work the athlete would call a training day?
 *
 * A generated week carries an entry for days that hold nothing — the scheduler's
 * `rest_or_recovery` owner — and counting those as training days is how a
 * preview comes to claim a session on a rest day.
 */
function isTrainingWorkout(workout: Workout | undefined | null): boolean {
  if (!workout) return false;
  if (workout.workoutType === 'Rest') return false;
  return getSessionComponents(workout).length > 0;
}

/** The microcycle a date falls inside, or the first one when none does. */
function weekContaining(
  program: TrainingProgram | null | undefined,
  dateISO: string,
): Microcycle | null {
  const cycles = program?.microcycles ?? [];
  if (cycles.length === 0) return null;
  for (const cycle of cycles) {
    const start = cycle.startDate.slice(0, 10);
    const end = cycle.endDate.slice(0, 10);
    if (start <= dateISO && dateISO <= end) return cycle;
  }
  return cycles[0];
}

/** Workouts by weekday index, keeping only the ones that are real work. */
function trainingByDayIndex(cycle: Microcycle | null): Map<number, Workout> {
  const map = new Map<number, Workout>();
  for (const workout of cycle?.workouts ?? []) {
    if (!isTrainingWorkout(workout)) continue;
    // ⚠ A COMBINED DAY IS ONE ENTRY (R-106). Where the generator emits two
    // workouts on one index, the components of both belong to that one day, so
    // the later one is merged rather than allowed to replace the earlier.
    const existing = map.get(workout.dayOfWeek);
    if (!existing) { map.set(workout.dayOfWeek, workout); continue; }
    map.set(workout.dayOfWeek, {
      ...existing,
      exercises: [...(existing.exercises ?? []), ...(workout.exercises ?? [])],
      durationMinutes: (existing.durationMinutes ?? 0) + (workout.durationMinutes ?? 0),
    } as Workout);
  }
  return map;
}

function componentKindsOf(workout: Workout | undefined): SessionComponentKind[] {
  if (!workout) return [];
  return getSessionComponents(workout).map((component) => component.kind);
}

function componentLabelsOf(workout: Workout | undefined): string[] {
  if (!workout) return [];
  return getSessionComponents(workout).map((component) => component.label);
}

/** Two component lists are the same day's work when the same kinds are present. */
function sameComponents(
  left: readonly SessionComponentKind[],
  right: readonly SessionComponentKind[],
): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((kind, index) => kind === sortedRight[index]);
}

/**
 * THE PREVIEW.
 *
 * @param current   the accepted program the athlete is on now.
 * @param candidate the program `profileProgramCandidateBase` built for the
 *                  answer being offered — i.e. the one acceptance publishes.
 * @param todayISO  which week to describe: the one this date falls inside.
 */
export function commitmentChangePreview(args: {
  current: TrainingProgram | null | undefined;
  candidate: TrainingProgram | null | undefined;
  todayISO: string;
  weekOrder?: readonly DayOfWeek[];
}): CommitmentChangePreviewOutcome {
  const { current, candidate, todayISO } = args;
  const weekOrder = args.weekOrder ?? DAYS_OF_WEEK;

  const candidateWeek = weekContaining(candidate, todayISO);
  if (!candidateWeek) return { value: null, refusal: 'no_candidate_week' };
  const currentWeek = weekContaining(current, todayISO);
  if (!currentWeek) return { value: null, refusal: 'no_current_week' };

  const weekStartISO = candidateWeek.startDate.slice(0, 10);
  const before = trainingByDayIndex(currentWeek);
  const after = trainingByDayIndex(candidateWeek);

  const changedDays: CommitmentPreviewDay[] = [];
  // WALKED IN WEEK ORDER, from the SHARED weekday table. A twenty-first copy of
  // the days of the week in this repo would be one more place for the calendar
  // to disagree with itself.
  for (const dayName of weekOrder) {
    const index = weekdayIndexFor(dayName);
    if (index < 0) continue;
    const nextWorkout = after.get(index);
    const previousWorkout = before.get(index);
    const nextComponents = componentKindsOf(nextWorkout);
    const previousComponents = componentKindsOf(previousWorkout);
    if (nextComponents.length === 0) continue;
    if (sameComponents(nextComponents, previousComponents)) continue;

    changedDays.push({
      // The date comes from the CANDIDATE week's own start, so a preview can
      // never be dated off a week the athlete is not being shown.
      dateISO: isoDateForWeekday(weekStartISO, index),
      dayOfWeek: dayName,
      arrival: previousComponents.length === 0
        ? 'new_training_date'
        : 'combined_with_existing',
      components: nextComponents,
      componentLabels: componentLabelsOf(nextWorkout),
      existingComponents: previousComponents,
      sessionName: nextWorkout?.name ?? '',
      workoutType: String(nextWorkout?.workoutType ?? ''),
      intensity: (nextWorkout?.intensity ?? 'moderate') as IntensityLevel,
      durationMinutes: nextWorkout?.durationMinutes ?? 0,
    });
  }

  if (changedDays.length === 0) return { value: null, refusal: 'nothing_changed' };

  return {
    refusal: null,
    value: {
      weekStartISO,
      changedDays,
      load: {
        weekStartISO,
        weekKind: candidateWeek.weekKind ? String(candidateWeek.weekKind) : null,
        deloadDoor: candidateWeek.deloadDoor ?? null,
        intensityMultiplier: typeof candidateWeek.intensityMultiplier === 'number'
          ? candidateWeek.intensityMultiplier
          : null,
        // R-106: `trainingByDayIndex` is keyed by DAY, so a day carrying a
        // strength and a conditioning component counts once on both sides.
        trainingDaysBefore: before.size,
        trainingDaysAfter: after.size,
      },
    },
  };
}

/**
 * The weekday INDEX (0 = Sunday) for a named day.
 *
 * ⚠ **DERIVED FROM `DAYS_OF_WEEK`, NOT TRANSCRIBED.** `DAYS_OF_WEEK` is the
 * app's Monday-first ordering and JavaScript's `getUTCDay` is Sunday-first, so
 * this is the one conversion between them and it is computed rather than
 * written out. A hand-typed second table is exactly how `test:weekday-index`'s
 * founding off-by-one arrived.
 */
export function weekdayIndexFor(day: DayOfWeek): number {
  const mondayFirst = DAYS_OF_WEEK.indexOf(day);
  if (mondayFirst < 0) return -1;
  return (mondayFirst + 1) % 7;
}
