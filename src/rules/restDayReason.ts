/**
 * WHY A DAY IS EMPTY — the one per-day reason the athlete reads.
 *
 * **Sam, 2026-09-05, on where it goes:** *"put it on the day … it should replace
 * fresh up, adapt go again - when it's needed"*. The day card's rest subline is
 * the slot. A day that is empty for no particular reason keeps that line; a day
 * the app deliberately emptied says why, in its place.
 *
 * ## THIS IS NOT AN INJURY FEATURE
 *
 * The reason that prompted it was an injury closing a session (R-378), and
 * building only that would have been the edge case Sam refused. Every cause that
 * empties a day answers here: illness, travel, a lighter week, a day kept clear
 * before a fixture. **One vocabulary, one carrier, one reader.** A new cause adds
 * a member and its sentence and nothing else.
 *
 * ## THE VOCABULARY IS TYPED AND THE SENTENCE IS SIGNED
 *
 * The reason is a typed member, never a sentence. Copy is Sam's and lives in
 * `projectionCopy` like every other athlete-facing string, so the words can be
 * re-signed without touching a rule and a rule cannot invent wording.
 *
 * ⚠ **NO EM DASHES IN ANY OF THESE SENTENCES.** Sam, 2026-09-05, verbatim:
 * *"it should not include any fuckign M dashes"*. Held by
 * `test:rest-day-reason`, which reds on the character itself.
 */

/**
 * THE TOTAL LIST, and every map over the union is built from it.
 *
 * Same reason as `ALL_MAIN_STRENGTH_PATTERNS` and `ALL_SESSION_PURPOSES`:
 * `satisfies` makes a new cause a BUILD failure rather than a member that
 * silently renders nothing.
 */
export type RestDayReason =
  | 'injury'
  | 'game_proximity'
  | 'illness'
  | 'away'
  | 'deload';

export const ALL_REST_DAY_REASONS = [
  'injury', 'game_proximity', 'illness', 'away', 'deload',
] as const satisfies readonly RestDayReason[];

/**
 * The signed-copy id for each reason. The card resolves the sentence through
 * `signedCopy`, so this names a row in the copy table and never the words.
 */
export const REST_DAY_REASON_COPY_ID: Readonly<Record<RestDayReason, string>> = {
  injury: 'day.rest.reason.injury',
  game_proximity: 'day.rest.reason.game_proximity',
  illness: 'day.rest.reason.illness',
  away: 'day.rest.reason.away',
  deload: 'day.rest.reason.deload',
};

/**
 * THE WEEK'S REASONS, LOOKED UP BY ITS MONDAY.
 *
 * Pure, and deliberately dumb: it reads the map the compiler stored and matches
 * the week by its own start date. **It never decides that a day is empty and it
 * never infers a reason** — a day the compiler said nothing about has no reason,
 * which is the ordinary rest day and the common case.
 *
 * The microcycle's `startDate` is a full timestamp (`dateAtNoonISO`), so the
 * date half is compared rather than the string.
 */
export function restDayReasonsForWeek(
  program: { readonly microcycles?: readonly {
    readonly startDate?: string;
    readonly restDayReasonByDay?: Readonly<Partial<Record<number, RestDayReason>>>;
  }[] } | null | undefined,
  mondayISO: string | undefined,
): Readonly<Partial<Record<number, RestDayReason>>> {
  if (!program?.microcycles || !mondayISO) return {};
  const week = program.microcycles.find(
    (cycle) => String(cycle.startDate ?? '').slice(0, 10) === mondayISO);
  return week?.restDayReasonByDay ?? {};
}
