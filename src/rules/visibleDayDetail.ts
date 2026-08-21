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

import { joinSignedCopy, type SignedCopy } from './signedCopy';
import type {
  VisibleDay,
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
  readonly sections: readonly VisibleDayDetailSection[];
}

/*
 * `attached` WAS HERE, AND ITS RETIREMENT IS THE COMPOUND RULING PAYING FOR
 * ITSELF RATHER THAN A SCOPE GRAB.
 *
 * It was defined as "the parts the lead headline did not already speak for" —
 * `parts.slice(1).map(headline)` — and the day screen rendered it as a subtitle
 * fragment. Under a compound title that set is EMPTY BY THE FIELD'S OWN
 * DEFINITION: the title now names every bucket on the day, so there is nothing
 * left for a second line to add.
 *
 * Keeping it would have shipped the defect Sam ruled against on the morning of
 * the same day, one screen over and worse than before: a day screen titled
 * "Strength + Team Training" with "· Team Training" underneath it. That is
 * parked question 4 of the slice-2 report ("the day SCREEN has the same
 * double-labelling"), and it closes here as a CONSEQUENCE — the compound title
 * is what made the second line redundant.
 *
 * It also takes a real composition site with it. `DayWorkoutScreenV2` joined
 * this list on a `' + '` string literal in a screen file: athlete-visible
 * punctuation, chosen at a surface, which is the class `SignedCopy` exists to
 * make impossible. The one separator now lives in the sheet.
 */

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
 *   - Any other day with parts leads with EVERY BUCKET ITS PARTS BELONG TO,
 *     joined by the signed separator, in timeline order, each word once.
 *   - Zero parts (rest) falls back to `day.headline`.
 *
 * IT WAS `parts[0].headline` UNTIL 2026-08-08 MORNING, and `parts[0].bucket`
 * until that afternoon. The first change moved the variant name off the title
 * ("Upper Push", "Lower Squat", and — the exhibit that made Sam rule — "Power"
 * on a day whose power component held one exercise); the name is not gone, it
 * moved to the timeline, which enumerates the day's parts one per line and is
 * the ONLY place the day's contents are listed.
 *
 * THE SECOND CHANGE IS THE LEADING PART GIVING UP ITS MONOPOLY, and it is Sam's
 * own sentence: *"on weekly view it should say whatever the bucket is that day
 * i.e. Strength or strength + conditioning."* A day holding strength work and a
 * conditioning piece was reading "Strength", which is not false — it is
 * incomplete, and at week zoom the row is all the athlete gets. So the day's
 * name is a LIST of what is on it.
 *
 * EACH WORD ONCE, WHICH IS WHERE THE DEDUPLICATION EARNS ITS KEEP: the exhibit
 * Tuesday carries a `power` part and a `strength` part, and both bucket to
 * "Strength". Without the dedupe that day reads "Strength + Strength" — and it
 * would be Sam's power ruling breaking out in a new place, which is exactly why
 * the buckets are collapsed by WORD rather than by kind.
 *
 * IT IS STILL NOT A COMPOSITION. Every word is a sheet entry and so is the
 * separator (`joinSignedCopy`); nothing here authors a character.
 */
export function visibleDayLeadHeadline(
  day: VisibleDay,
  options?: { readonly programmedOnly?: boolean },
): SignedCopy {
  const buckets = dayBuckets(day, options);
  if (buckets.length === 0) return day.headline;
  if (buckets.length === 1) return buckets[0];
  return joinSignedCopy(buckets, DAY_NAME_JOINER);
}

/** Sam's own separator, quoted from the ruling. See `projectionCopy.ts`. */
const DAY_NAME_JOINER = 'copy.joiner.plus';

/**
 * THE DAY'S LEADING BUCKET — ONE WORD, FOR THE THINGS THAT ARE NOT WORDS.
 *
 * A row's GLYPH and its ACCENT COLOUR are chosen by matching the day's name
 * against a table of labels (`displayLabelIconKind` in `HomeScreenV2`). That
 * table is a list of EQUALITIES — "strength", "upper push", "gunshow" — so a
 * compound name matches nothing in it and every joined row falls through to the
 * grey generic glyph.
 *
 * FOUND BY MEASURING RATHER THAN BY ARGUING, and it was a live regression: the
 * slice-2 report had already noted the icon comes from a title-STRING table and
 * reasoned that "Strength" resolved so nothing had broken. That reasoning stops
 * holding the moment the title stops being one word, which is this commit.
 *
 * So the icon and the colour get the day's LEADING bucket — which is exactly
 * what `visibleDayLeadHeadline` returned before the compound ruling, so their
 * input is byte-for-byte what it has always been and no glyph can move. The
 * TITLE says every bucket; the GLYPH says the first one. That is the honest
 * split: one word cannot depict two kinds of work, and a row that shows the
 * generic activity icon has told the athlete less than it did yesterday.
 *
 * A REAL FIX FOR THE TABLE — keying the glyph off the typed `VisiblePartKind`
 * instead of off a display string — is a bigger and better change, and it is NOT
 * made here: it would move glyphs on days this ruling never touched, which is a
 * device-pass change riding an unrelated commit. Named, not done.
 */
export function visibleDayLeadBucket(day: VisibleDay): SignedCopy {
  const buckets = dayBuckets(day);
  return buckets.length === 0 ? day.headline : buckets[0];
}

/**
 * THE DAY'S BUCKETS, IN TIMELINE ORDER, EACH ONE ONCE.
 *
 * Deduplicated by the WORD, not by the part kind. Two parts can share a bucket
 * without sharing a kind — `power` and `strength` both bucket to "Strength",
 * which is the whole of Sam's power ruling — and a day is not more of a strength
 * day for holding two of them.
 *
 * A FIXTURE HAS NO BUCKETS HERE, on purpose: its title is its fixture whatever
 * its workout resolved, and that gate is traced in this function's caller.
 */
function dayBuckets(
  day: VisibleDay,
  options?: { readonly programmedOnly?: boolean },
): readonly SignedCopy[] {
  if (day.kind === 'game') return [];
  const seen = new Set<string>();
  const buckets: SignedCopy[] = [];
  for (const part of day.parts) {
    /* CLUB TRAINING IS NOT PROGRAMMED WORK (Sam, 2026-08-22). The day card's
       box holds the programmed session only, so its title must not name a part
       that box no longer shows — *"no longer needs + team training as this box
       is only for programmed work now"*. Every other caller still gets the
       whole day, which is what a WEEK row is describing. */
    if (options?.programmedOnly && part.kind === 'team_training') continue;
    if (seen.has(part.bucket)) continue;
    seen.add(part.bucket);
    buckets.push(part.bucket);
  }
  return buckets;
}

/**
 * What the day-detail screen shows, derived from the one projection.
 *
 * `null` for a day the projection does not carry — the screen has its own
 * "workout not found" state for that and does not need words invented for it.
 */
/**
 * ⚠ **`programmedOnly` IS THE CALLER'S TO ASK FOR, AND THE DEFAULT IS THE WHOLE
 * DAY.** I filtered club training out of this function unconditionally first,
 * and `dayTimeline` reads it — so the day card's own club box, which finds its
 * entry in that timeline, would have disappeared with it. The SESSION screen is
 * the caller that wants the programmed session; nothing else does.
 */
export function projectDayDetail(
  day: VisibleDay | null | undefined,
  options?: { readonly programmedOnly?: boolean },
): VisibleDayDetail | null {
  if (!day) return null;
  return {
    date: day.date,
    headline: visibleDayLeadHeadline(day, options),
    sections: day.parts
      .filter((part) => !(options?.programmedOnly && part.kind === 'team_training'))
      .map((part): VisibleDayDetailSection => ({
      partId: part.id,
      kind: part.kind,
      headline: part.headline,
      rows: part.rows,
    })),
  };
}
