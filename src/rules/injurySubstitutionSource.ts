/**
 * WHOSE PLACE A ROW IS TAKING — ONE OWNER, SO THE REVIEW AND THE SESSION CANNOT
 * NAME DIFFERENT EXERCISES FOR THE SAME CHANGE.
 *
 * **Sam, 2026-08-20, the ruling this module is:** *"The review and the applied
 * session must both name the exercise currently visible to the athlete. Keep
 * older substitution history internally, but do not show an older exercise as
 * the source of this new Injury change."*
 *
 * ## WHAT WENT WRONG, AND WHY IT WAS NOT A WORDING BUG
 *
 * MEASURED on glass and then headlessly, two injuries in sequence on one day:
 *
 * ```
 * knee 7/10      the athlete now sees   Chest-Supported DB Row  (was Leg Press)
 * shoulder 7/10  the review promises    Chest-Supported DB Row -> Easy Bike
 *                the session then says  "Swapped from Leg Press"
 * ```
 *
 * ⚠ **THE SESSION WAS NOT REMEMBERING AN OLD NAME — IT HAD GENUINELY NEVER SEEN
 * THE NEW ONE.** Every injury settle rebuilds the day from the AUTHORED week and
 * re-applies all active injuries in one pass, so the second pass planned against
 * `Leg Press`, not against the row the athlete had been looking at all week. The
 * intermediate view is not stored anywhere and is not meant to be — it is a
 * derivation, and the app's rule is to derive rather than store.
 *
 * So the fix cannot be to remember the name. **It is to DERIVE it**: the
 * exercise the athlete could see before this change is the day as it would be
 * with every active injury EXCEPT the most recently declared one. That is a pure
 * function of stored facts, which is why it survives a restart — boot re-derives
 * exactly the same answer instead of quietly reverting to the authored name.
 *
 * ## THE TWO NAMES, AND WHICH ONE IS SHOWN
 *
 *   `baseExerciseName`   what the athlete could SEE when the change was made.
 *                        **This is the only one that is ever displayed.**
 *   `originExerciseName` the authored exercise the block originally selected.
 *                        Internal history, kept per Sam's *"keep older
 *                        substitution history internally"*, shown nowhere.
 *
 * With ONE injury the two are identical, which is why this changes nothing for
 * the overwhelmingly common case and why `originExerciseName` is written only
 * when it actually differs — an always-present field that is almost always equal
 * to its neighbour is a field readers start trusting for the wrong reason.
 *
 * WRITER: `utils/programControlActions` (the injury settle).
 * READERS: `screens/home/DayWorkoutScreenV2` (the row badge) and
 * `utils/sessionInjuryReview` (the review card). TEST: `test:session-injury-review` [9].
 */

/** Every cause a row can be standing in for, and the words for each. */
const SUBSTITUTION_REASON: Readonly<Record<string, string>> = {
  kit_today: 'equipment today',
  injury: 'injury',
  excluded_today: 'you left it out',
};

export interface InjurySubstitutionSourceRef {
  /** What the athlete could see here when the change was made. Displayed. */
  readonly baseExerciseName: string;
  /** The authored exercise. Internal history — never rendered. */
  readonly originExerciseName?: string;
  readonly cause: 'excluded_today' | 'kit_today' | 'injury';
}

/**
 * THE NAME THE ATHLETE IS SHOWN. One line, one owner.
 *
 * ⚠ **`originExerciseName` IS DELIBERATELY NOT CONSULTED HERE.** It exists so
 * the history is not lost, and reading it in the one function whose job is to
 * produce athlete-facing text is exactly how it would leak back onto the glass.
 */
export function injurySubstitutionSourceName(
  substitution: InjurySubstitutionSourceRef | null | undefined,
): string | null {
  const name = substitution?.baseExerciseName?.trim();
  return name ? name : null;
}

/**
 * THE BADGE, ASSEMBLED ONCE — `"Swapped from X — injury"`.
 *
 * `displayName` is passed in rather than imported so this module stays free of
 * the display-name owner and can be read by both a screen and a pure rule.
 */
export function injurySubstitutionBadge(args: {
  substitution: InjurySubstitutionSourceRef | null | undefined;
  displayName: (name: string) => string;
}): string | null {
  const source = injurySubstitutionSourceName(args.substitution);
  const reason = args.substitution ? SUBSTITUTION_REASON[args.substitution.cause] : undefined;
  if (!source || !reason) return null;
  return `Swapped from ${args.displayName(source)} — ${reason}`;
}

/**
 * THE MOST RECENTLY DECLARED INJURY — the one whose change is being described.
 *
 * ⚠ **DERIVED FROM THE FACTS, NOT FROM WHICHEVER ACTION HAPPENS TO BE RUNNING.**
 * The live door knows which injury the athlete just declared; boot does not, and
 * if the two disagreed the row's name would change on the first restart. Both
 * ask this instead, so both get the same answer forever.
 *
 * `lastUpdatedAt` is the ordering, with `startDate` behind it and the id last so
 * two facts stamped in the same millisecond still order deterministically rather
 * than by store insertion.
 */
export function mostRecentlyDeclaredInjuryId(
  constraints: readonly {
    id?: string; type?: string; status?: string;
    startDate?: string; lastUpdatedAt?: string;
  }[] | null | undefined,
): string | null {
  const live = (constraints ?? []).filter(
    (constraint) => constraint.type === 'injury' && constraint.status === 'active',
  );
  if (live.length === 0) return null;
  const sorted = [...live].sort((left, right) => {
    const byUpdated = String(right.lastUpdatedAt ?? '').localeCompare(String(left.lastUpdatedAt ?? ''));
    if (byUpdated !== 0) return byUpdated;
    const byStart = String(right.startDate ?? '').localeCompare(String(left.startDate ?? ''));
    if (byStart !== 0) return byStart;
    return String(right.id ?? '').localeCompare(String(left.id ?? ''));
  });
  return sorted[0]?.id ?? null;
}
