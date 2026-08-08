/**
 * THE DAY-DETAIL SURFACE, AS A FUNCTION OF THE PROJECTION.
 *
 * Sam's ruling, one-projection reassessment §4: "the card renders `headline` +
 * `parts.map(p => p.headline)`; the detail renders the same `parts` with rows."
 * This is the detail half of that sentence, written down as a function so it has
 * a name a law can be stated about.
 *
 * WHY IT IS A FUNCTION AND NOT THREE LINES INSIDE THE SCREEN. Before Task 6 the
 * detail's account of a day was `composeDayDetail` — five booleans and three row
 * buckets, computed at render, which is how a day carrying strength + recovery
 * showed "Strength" and nothing else. The walker could only assert against that
 * account because it had been extracted; the moment the screen renders `parts`
 * directly there is nothing left to point a law AT, and "the surfaces agree"
 * becomes a claim nobody checks. So the screen's reading is a pure function of
 * `VisibleDay`, the screen renders exactly what it returns, and
 * `athleteActionWalkerTests` compares ITS sections against the projection's parts
 * after every action. The law stays stated; what changed is that it is now
 * satisfiable only one way.
 *
 * The value of that is not the comparison passing — it is that a filter, a
 * `kind` branch or a "recovery renders differently" special case cannot be added
 * here without the walker going red on the next run. That is the exact class of
 * defect this replaces: `composeDayDetail` had a row surface for strength,
 * support and conditioning and NONE for recovery, power or speed, so three kinds
 * of work simply had nowhere to appear.
 *
 * EVERY PART, IN ORDER, ALWAYS. There is no filter in this file and there must
 * never be one.
 */

import type { SignedCopy } from './signedCopy';
import type {
  VisibleDay,
  VisiblePart,
  VisiblePartKind,
  VisibleRow,
} from './visibleProjection';

export interface VisibleDayDetailSection {
  /** The projected part this section IS — same id, so nothing has to be matched up. */
  readonly partId: string;
  readonly kind: VisiblePartKind;
  readonly headline: SignedCopy;
  readonly rows: readonly VisibleRow[];
}

export interface VisibleDayDetail {
  readonly date: string;
  /** The screen's title. */
  readonly headline: SignedCopy;
  /**
   * The parts beyond the leading one, which the title already spoke for. The
   * screen joins these into its metadata line; the card does the same thing with
   * the same list (`HomeScreenV2`), which is the point.
   */
  readonly attached: readonly SignedCopy[];
  readonly sections: readonly VisibleDayDetailSection[];
}

/**
 * THE LEADING NAME OF A DAY — one rule, both surfaces.
 *
 * Ruled in Task 5 against reassessment §4 and re-used here rather than restated:
 * a card and a detail title that disagree about which name leads is the same
 * defect at two sizes, and the only way two surfaces cannot disagree is for both
 * to call one function.
 *
 *   - A FIXTURE always reads `day.headline` ("Game Day", or "Practice Match" on a
 *     practice/trial fixture — Sam's 2026-07-31 label ruling, which varies the WORD
 *     and nothing else), whatever its workout
 *     resolved. Task 6 also fixed the projection so a fixture's placeholder part
 *     is a `game` part rather than a `strength` one, so this now agrees with
 *     `parts[0]` instead of overruling it — but it is kept as the day-level
 *     statement because only the PLACEHOLDER converts: a `Practice Match` day
 *     (a fixture by `FIXTURE_WORKOUT_TYPES`, not one of the two hardcoded stubs)
 *     carrying a real squat projects `kind: 'game'` with `parts[0].kind:
 *     'strength'`, and would lead with "Strength" without this. Traced, not
 *     assumed. A fixture's title is its fixture either way.
 *   - Any other day with parts leads with `parts[0].bucket` — the leading part's
 *     CATEGORY. Sam's ruling, 2026-08-08: "week row = buckets, day title =
 *     buckets, timeline = the variant names stacked one per line."
 *   - Zero parts (rest) falls back to `day.headline`.
 *
 * IT WAS `parts[0].headline` UNTIL 2026-08-08, and that is the whole of this
 * change: a day led with its session's variant name ("Upper Push", "Lower
 * Squat", and — the exhibit that made Sam rule — "Power" on a day whose power
 * component held one exercise). The name is not gone; it moved to the timeline,
 * which now enumerates the day's parts one per line and is the ONLY place the
 * day's contents are listed. The title said what the timeline said, and a screen
 * that says a thing twice has not decided which one is the answer.
 */
export function visibleDayLeadHeadline(day: VisibleDay): SignedCopy {
  if (day.kind !== 'game' && day.parts.length > 0) return day.parts[0].bucket;
  return day.headline;
}

/** The parts the lead headline did not already speak for. */
function attachedHeadlines(day: VisibleDay): SignedCopy[] {
  if (day.kind === 'game' || day.parts.length === 0) return [];
  return day.parts.slice(1).map((part: VisiblePart) => part.headline);
}

/**
 * What the day-detail screen shows, derived from the one projection.
 *
 * `null` for a day the projection does not carry — the screen has its own
 * "workout not found" state for that and does not need words invented for it.
 */
export function projectDayDetail(day: VisibleDay | null | undefined): VisibleDayDetail | null {
  if (!day) return null;
  return {
    date: day.date,
    headline: visibleDayLeadHeadline(day),
    attached: attachedHeadlines(day),
    sections: day.parts.map((part): VisibleDayDetailSection => ({
      partId: part.id,
      kind: part.kind,
      headline: part.headline,
      rows: part.rows,
    })),
  };
}
