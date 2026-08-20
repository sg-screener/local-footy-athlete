/**
 * ── AN INJURY WITHHOLDS A ROW. IT DOES NOT REMOVE IT. ──────────────────────
 *
 * **Sam, 2026-08-20, ruling on the ownership defect this module exists to
 * close:** *"An 8-10 injury with serious symptoms must NEVER write into the
 * athlete's Remove list or permanently alter the accepted program. Preserve the
 * original exercises. On that date, show them as unavailable/skip with the
 * explicit injury safety explanation, or block the session if necessary.
 * Clearing or resolving the injury must immediately reveal the original
 * accepted session again, including after close/reopen. Remove remains
 * exclusively athlete-authored Remove."*
 *
 * ## WHAT WAS HAPPENING, MEASURED
 *
 * An injury OMISSION — a row the fallback ladder had nothing legal for — was
 * written through `remove_exercise`, which lands in
 * `athletePreferencesStore.exclusions`: the athlete's own decisions. Measured on
 * this branch before the fix, red-flag hamstring at 9/10:
 *
 * ```
 * rows BEFORE          Leg Press, RDLs, Bulgarian Split Squats,
 *                      Single-Leg RDL, Band Pallof Press
 * exclusions BEFORE    []
 * rows AFTER           []
 * exclusions AFTER     5 entries the athlete never made
 * clear_injury         ok
 * rows RESTORED        []          <- the day is empty forever
 * ```
 *
 * Restore works by RE-DERIVING (`settleDerivedWorldAfterDecision`), so it
 * replayed those exclusions as if the athlete had chosen them. Substitutions
 * came back correctly because nothing durable held them.
 *
 * ## THE SHAPE, AND WHY IT NEEDS NO NEW STATE
 *
 * `InjuryEpisodeV1` is already a `TemporarySourceFact`, and
 * `ScheduleState.temporarySourceFacts` is already fed by the two doors that mean
 * *"what does the athlete SEE"* — `deriveVisibleWeek.assembleScheduleState` and
 * `hooks/useSchedule`. So the withholding is a PURE DERIVATION over a fact the
 * view state already carries, and it is applied at the same seam
 * `applyExclusionsToAuthoredDay` is applied at, for the same reason spelled out
 * beside it: **a filter that reaches a canonicaliser gets written down, and a
 * filter that is written down is not a filter.** Nothing here is ever stored,
 * so clearing the injury reveals the accepted session by doing nothing at all.
 *
 * WRITER: `utils/sessionResolver.resolveDate` (the view door), through
 * `markInjuryWithheldRows`. READERS: `store/sessionOutcomeTransaction`
 * (`sessionOutcomeRecordableRefusal`, which refuses to record the day as normal
 * and which the session panel already asks before offering "Save & Finish"), and
 * the session screen, which reads `WorkoutExercise.unavailableForInjury`.
 * TEST: `src/__tests__/injuryFallbackJourneyTests.ts` section [10].
 */

import type { InjuryEpisodeV1 } from './injuryEpisode';
import { injuryEpisodeIsActive } from './injuryEpisode';
import { isInjurySourceFact, type TemporarySourceFact } from './temporarySourceFact';
import { injuryPermitsExerciseAtSeverity } from './injuryExerciseRisk';
import { injurySeverityPausesAffectedTraining } from './injurySeverityBands';
import type { InjuryKey } from '../data/exerciseTags';
import type { Workout, WorkoutExercise } from '../types/domain';
import { resolveExerciseName } from '../utils/loadEstimation';

/** The injuries in force on a date, from the facts the view state carries. */
export function activeInjuryFactsOn(
  facts: readonly TemporarySourceFact[] | null | undefined,
  dateISO: string,
): InjuryEpisodeV1[] {
  const date = dateISO.slice(0, 10);
  return (facts ?? [])
    .filter(isInjurySourceFact)
    .filter(injuryEpisodeIsActive)
    /* ⚠ **AN INJURY APPLIES FROM THE DAY IT WAS REPORTED, NOT BEFORE IT.**
     * Without this a fact declared on Friday would withhold work on Monday's
     * already-finished session. `resolvedAt` is not consulted: a resolved
     * episode is not `active`, so it never reaches here. */
    .filter((episode) => episode.onsetOrReportedDate.slice(0, 10) <= date);
}

/**
 * **THE ONE THING THAT MAKES A SESSION UNCOMPLETABLE**, per Sam's *"or block the
 * session if necessary"*: a red-flag injury — his 8-10 band together with
 * serious symptoms — is the case his Bible already says the app must stop
 * training for (*"the app should stop affected training and recommend
 * physio/medical advice"*), not one it should let the athlete tick off.
 *
 * An ordinary injury does NOT block: it substitutes, and the athlete trains.
 */
export function isRedFlagInjury(episode: InjuryEpisodeV1): boolean {
  return episode.seriousSymptoms === true
    && injurySeverityPausesAffectedTraining(episode.severity);
}

export interface InjuryWithholding {
  /** The row, in the name the session carries it under. */
  exercise: string;
  bodyPart: string;
  severity: number;
  redFlag: boolean;
  /** Plain words for the athlete. No jargon. */
  explanation: string;
}

function rowName(row: WorkoutExercise): string {
  return String(
    (row as { exercise?: { name?: string } }).exercise?.name
    ?? (row as unknown as { name?: string }).name
    ?? '',
  ).trim();
}

function explanationFor(episode: InjuryEpisodeV1, exercise: string): string {
  return isRedFlagInjury(episode)
    ? `${exercise} is not safe with your ${episode.bodyPart} right now — leave it out `
      + 'and get medical or physio advice before training it again.'
    : `${exercise} is not safe with your ${episode.bodyPart} right now — skip it this session.`;
}

/**
 * WHICH ROWS ON THIS DAY THE ACTIVE INJURIES WITHHOLD.
 *
 * The legality question is `injuryPermitsExerciseAtSeverity` — the same single
 * owner the fallback ladder and the tap surfaces use — so a row can never be
 * withheld here and offered there.
 */
export function injuryWithholdingsOn(args: {
  workout: Workout | null | undefined;
  dateISO: string;
  facts: readonly TemporarySourceFact[] | null | undefined;
}): InjuryWithholding[] {
  const episodes = activeInjuryFactsOn(args.facts, args.dateISO);
  if (episodes.length === 0) return [];
  const out: InjuryWithholding[] = [];
  for (const row of args.workout?.exercises ?? []) {
    const name = rowName(row);
    if (!name) continue;
    const canonical = resolveExerciseName(name);
    for (const episode of episodes) {
      if (!episode.bucket) continue;
      if (injuryPermitsExerciseAtSeverity(canonical, episode.bucket as InjuryKey, episode.severity)) {
        continue;
      }
      out.push({
        exercise: name,
        bodyPart: episode.bodyPart,
        severity: episode.severity,
        redFlag: isRedFlagInjury(episode),
        explanation: explanationFor(episode, name),
      });
      break; // ONE explanation per row — the worst injury that reaches it wins.
    }
  }
  return out;
}

/**
 * MARK, NEVER FILTER.
 *
 * ⚠ **A DAY NOTHING IS WITHHELD ON COMES OUT IDENTICAL**, object for object —
 * the same discipline `applyExclusionsToAuthoredDay` states beside its own
 * early return. Every identity comparison downstream would otherwise start
 * reporting a change this projection did not make.
 */
export function markInjuryWithheldRows<T extends Workout | null | undefined>(args: {
  workout: T;
  dateISO: string;
  facts: readonly TemporarySourceFact[] | null | undefined;
}): T {
  const workout = args.workout;
  if (!workout || (workout.exercises ?? []).length === 0) return workout;
  const withheld = new Map(
    injuryWithholdingsOn({ workout, dateISO: args.dateISO, facts: args.facts })
      .map((entry) => [entry.exercise.toLowerCase(), entry]),
  );
  if (withheld.size === 0) return workout;
  return {
    ...workout,
    exercises: (workout.exercises ?? []).map((row) => {
      const entry = withheld.get(rowName(row).toLowerCase());
      if (!entry) return row;
      return {
        ...row,
        unavailableForInjury: {
          bodyPart: entry.bodyPart,
          severity: entry.severity,
          redFlag: entry.redFlag,
          explanation: entry.explanation,
        },
      };
    }),
  } as T;
}

/**
 * WHY THIS DAY CANNOT BE RECORDED AS A NORMAL SESSION, or `null`.
 *
 * Sam: *"the injured date cannot be completed as normal."* Only a RED-FLAG
 * injury blocks — an ordinary one substitutes and the athlete trains — and it
 * blocks only while it is withholding something the athlete can actually see.
 * A red flag on a day it does not touch is not a reason to refuse that day.
 */
export function injurySessionOutcomeRefusal(args: {
  workout: Workout | null | undefined;
  dateISO: string;
  facts: readonly TemporarySourceFact[] | null | undefined;
}): { code: string; message: string } | null {
  const withheld = injuryWithholdingsOn(args).filter((entry) => entry.redFlag);
  if (withheld.length === 0) return null;
  const names = withheld.map((entry) => entry.exercise);
  const list = names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
  return {
    code: 'red_flag_injury_session',
    message: `${list} ${names.length === 1 ? 'is' : 'are'} not safe with your `
      + `${withheld[0]!.bodyPart} right now, so this session can't be marked done. `
      + 'Get medical or physio advice, and clear the injury when you are ready.',
  };
}
