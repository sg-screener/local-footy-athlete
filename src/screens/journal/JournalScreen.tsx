import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
// THE KEYBOARD CONVENTION: no screen renders a raw TextInput
// (`keyboardConventionTests`). The shared owner handles avoidance and
// dismissal, so a screen that rolls its own is a screen the keyboard can
// cover. Caught by the full chain on this slice's first run.
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { useAthleteContext, useResolvedWeek } from '../../hooks/useSchedule';
import { useProgramStore } from '../../store/programStore';
import { countWeeklyExposures } from '../../rules/weeklyExposureCounts';
import { appDateNow } from '../../utils/appDate';
import {
  JOURNAL_NOTE_TAGS,
  recordJournalNote,
  useJournalNoteStore,
  type JournalNoteTag,
} from '../../store/journalNoteStore';
import {
  buildJournalWeek,
  type JournalDay,
  type JournalDayShape,
  type JournalSessionOutcome,
  type JournalWeek,
} from '../../rules/journalWeek';
import { buildJournalWeekJob, type JournalWeekJob } from '../../rules/journalWeekJob';
import { buildJournalWeekStatus, type JournalWeekStatus } from '../../rules/journalWeekStatus';
import { buildJournalChanges, type JournalChanges } from '../../rules/journalChanges';
import { useDecisionLedgerStore } from '../../store/decisionLedgerStore';
import { evaluateSection18EffectiveWeek } from '../../rules/section18EffectiveWeekEvaluator';
import { buildJournalMonth, type JournalMonth } from '../../rules/journalMonth';
import { TrendChart } from '../../components/journal/TrendChart';
import {
  buildJournalNiggleHistory,
  flaggedNiggleRegions,
  type JournalNiggleHistory,
} from '../../rules/journalNiggleHistory';
import type { InjuryEpisodeV1 } from '../../rules/injuryEpisode';
import {
  buildJournalStrengthSeries,
  buildJournalStrengthTrend,
  type StrengthLiftTrend,
} from '../../rules/journalStrengthTrend';
import {
  buildJournalLoadModel,
  journalWeekStartOf,
  signedValue,
  type BandVerdict,
  type JournalLoadCoverage,
  type JournalLoadModel,
  type JournalLoadSessionInput,
  type PatternBalance,
  type PatternShare,
  type PlannedLift,
} from '../../rules/journalLoad';

/**
 * THE JOURNAL — the athlete's week, and the UI ruling's exception-based front
 * page (docs/JOURNAL_UI_DIRECTION_RULING_2026-08-09.md, Sam 2026-08-09).
 *
 * EVERYTHING SHOWN IS DERIVED; THE ONE THING WRITTEN IS AN ANSWER. Every number
 * on this screen is derived on read from facts the app already stores. The
 * single write is the athlete's own note, through `recordJournalNote` — one
 * door, and it is an INPUT, which is the only kind of new stored state the north
 * star allows. The appearance pass added no writer and no stored field.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE ORGANISING RULE IS A STATEMENT ABOUT NULL, NOT ABOUT LAYOUT.
 *
 * Sam's ruling: "Nothing appears unless it has something to say. A surface
 * earning its place by having news IS the design — an athlete learns that seeing
 * a card means 'pay attention'."
 *
 * So every block below the hero returns `null` when it has no news, and the
 * screen composes them in the ruling's order. That is the whole mechanism. It is
 * testable as a property (a block with nothing to say renders nothing) rather
 * than as a list of cases, which is why three "honest empty state" lines from
 * earlier slices are RETIRED here rather than hidden behind a flag — see
 * THE THREE RETIRED EMPTY STATES below.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT WAS DARK, AND WHAT TURNED IT ON — 2026-08-09.
 *
 * The load band, the load stat tile, the "ran hot" card and the "balance
 * drifting" card were all downstream of PROPOSED constants, so `signedValue`
 * returned null for them and they did not render. **Sam signed the load model's
 * eight remaining constants on 2026-08-09 and all four now render — this file
 * was not edited to make that happen.** The mechanism did what it was built to
 * do; the commit that lit half this screen changed a provenance field in
 * `journalLoad.ts` and nothing here.
 *
 * WHAT STILL GATES THEM IS UNCHANGED, and that is the point of saying so. Every
 * one of these reads through `signedValue`, so the next constant that arrives
 * PROPOSED darkens whatever it feeds, with no line here to remember.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RETIRED EMPTY STATES — TWO, NOT THREE, SINCE 2026-08-09. Named because a
 * quietly deleted line is how a gate stops meaning anything.
 *
 * "You made no changes to this week." and "No niggles recorded." each rendered
 * on every ordinary week. The ruling retires both by name (what-changed is "one
 * credit line on weeks it happened, nothing otherwise"; niggle history is
 * "never standing furniture"). Their cells are RE-POINTED to assert the stronger
 * new law — the block renders NOTHING — rather than deleted. A cell removed
 * because its own unit made it red is the other half of that hazard.
 *
 * "No lifts recorded with a weight this week." WAS THE THIRD AND SAM PUT IT
 * BACK (decision C3). It is the only withdrawal of the nine that removed
 * INFORMATION rather than a heading or a duplicate, 26-e said so and asked him,
 * and the answer was restore. See `StrengthLines`.
 *
 * STYLE LAW (Sam's rider, verbatim "match the style of the rest of the app"):
 * one design language. Every colour here is a `theme/colors` token, every gap a
 * `theme/spacing` step, every card the shared `Card`. The mock's hexes and fonts
 * are explicitly NOT law; the app's are.
 *
 * COPY: every athlete-visible sentence is PROPOSED, NOT SIGNED — the words this
 * slice adds or changes are **batch 26** in docs/COPY_SHEET_RULINGS_2026-07-30.md.
 */

/**
 * A STABLE EMPTY ARRAY for the episodes selector.
 *
 * `?? []` inside a Zustand selector mints a NEW array every render, which
 * compares unequal every time and re-renders the screen forever. One frozen
 * constant is the fix, and it is the reason this exists rather than an inline
 * default.
 */
const EMPTY_EPISODES: readonly InjuryEpisodeV1[] = [];

// ─── The week label ──────────────────────────────────────────────────────

/**
 * THE CLOSED TWELVE — batch 26 (abbreviations, SIGNED 2026-08-09) and batch 27
 * (the full words, PROPOSED). A table rather than `Intl`, because a
 * locale-dependent month name is a string no copy gate can enumerate and no
 * ruling can sign.
 *
 * ONE TABLE, NOT TWO, AND THAT IS THE NORTH STAR'S MOVE HERE. Sam's decision C5
 * asks the progress line to read "since March" where it read "since
 * 2026-03-02", and his premise was that "the closed-twelve month table already
 * exists on the screen". It did — but it held `Mar`, not `March`, so honouring
 * the example needed the longer word. Writing a second literal twelve beside the
 * first is two representations of one fact that agree until somebody edits one;
 * the abbreviation is DERIVED from the word instead. A cell asserts the derived
 * twelve are exactly the abbreviations the week label shipped before this
 * change, so the week label provably did not move.
 */
const MONTH_WORDS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const MONTH_ABBREVIATION_LENGTH = 3;

const MONTH_ABBREVIATIONS = MONTH_WORDS
  .map((word) => word.slice(0, MONTH_ABBREVIATION_LENGTH));

/**
 * "March", or "March 2025" when the month is not in the current year.
 *
 * THE YEAR IS A RIDER ON C5 AND IT IS FLAGGED, NOT SLIPPED IN. Sam's example is
 * "since March" and that is what an athlete reads for almost every gain. But
 * `JournalLoadModel.history` is UNBOUNDED — it holds every week the athlete ever
 * recorded — so a first entry from March last year would render "since March"
 * and mean this March. That is not a wording choice, it is a wrong statement
 * about when, so the year appears exactly when leaving it out would be false.
 *
 * NULL RATHER THAN THE RAW DATE when either string will not parse. Falling back
 * to the ISO is what this decision exists to remove, and a line that cannot be
 * said honestly is a line the exception rule already knows how to drop.
 *
 * "THIS YEAR" IS THE VIEWED WEEK'S YEAR, NEVER THE DEVICE CLOCK. The screen has
 * no `new Date()` anywhere and this function does not introduce one: the gain is
 * spoken relative to the week being read, which is the same anchor every other
 * date on this screen uses.
 */
function monthWordSince(fromWeekStartISO: string, viewedWeekStartISO: string): string | null {
  const from = new Date(`${fromWeekStartISO}T00:00:00Z`);
  const viewed = new Date(`${viewedWeekStartISO}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(viewed.getTime())) return null;
  const word = MONTH_WORDS[from.getUTCMonth()];
  if (word === undefined) return null;
  return from.getUTCFullYear() === viewed.getUTCFullYear()
    ? word
    : `${word} ${from.getUTCFullYear()}`;
}

/**
 * The week the screen is about, as "3 – 9 Aug" or "30 Jul – 5 Aug".
 *
 * PARSED AS UTC, like every other date in this unit. `new Date('2026-08-03')`
 * is UTC midnight; reading it back with local getters can land on the 2nd in a
 * negative offset, which would name the week wrong by a day for half the world.
 *
 * THE MOCK'S ‹ › ARROWS ARE NOT BUILT. `useResolvedWeek` resolves THIS week and
 * nothing else, so browsing history is a feature rather than an appearance, and
 * a chevron that does nothing is worse than no chevron. Named in the boundary
 * report as not covered.
 */
function weekRangeLabel(weekStartISO: string): string | null {
  const start = new Date(`${weekStartISO}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 6);

  const startMonth = MONTH_ABBREVIATIONS[start.getUTCMonth()];
  const endMonth = MONTH_ABBREVIATIONS[end.getUTCMonth()];
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();

  // The month is stated once when the week does not cross one — "3 – 9 Aug"
  // rather than "3 Aug – 9 Aug", which is the shape the mock draws.
  return startMonth === endMonth
    ? `${startDay} – ${endDay} ${endMonth}`
    : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

// ─── The strip ───────────────────────────────────────────────────────────

/**
 * The week-shape strip.
 *
 * THE LETTERS DIE HERE, BY SAM'S RULING: "WEEK SHAPE AS BARS, not letters:
 * tall=Hard, mid=Moderate, short=Easy, flat dot=Rest, outlined=Game. SUPERSEDES
 * batch 15-b's H/M/E/G letter presentation (the letters die; spoken names stay
 * on accessibility)."
 *
 * SO THE `label` FIELD IS NOT LEFTOVER — it is the ruling's second half. The
 * shape is now carried by height, which a screen reader cannot read at all, so
 * the spoken name is the ONLY thing a non-sighted athlete gets. Deleting it
 * along with the letter would have made this screen worse for them in the commit
 * that made it better for everyone else.
 *
 * THE COLOURS ARE THE APP'S INTENSITY TOKENS, UNCHANGED. The mock ramps one
 * accent through four shades; the app already has a vocabulary for how hard a
 * thing is, and a second one born on this screen is the exact defect the style
 * law names.
 */
const SHAPE_PRESENTATION: Readonly<Record<JournalDayShape, {
  label: string; color: string; heightFraction: number; outlined: boolean;
}>> = {
  hard: { label: 'Hard', color: colors.intensity.high, heightFraction: 1, outlined: false },
  moderate: {
    label: 'Moderate', color: colors.intensity.moderate, heightFraction: 0.58, outlined: false,
  },
  easy: { label: 'Easy', color: colors.intensity.light, heightFraction: 0.26, outlined: false },
  game: { label: 'Game', color: colors.text.accent, heightFraction: 1, outlined: true },
  rest: { label: 'Rest', color: colors.text.tertiary, heightFraction: 0, outlined: false },
};

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The bar well's height in points. Every fraction above is read against it. */
const BAR_WELL_HEIGHT = 64;
/** A rest day's flat dot. Not a zero-height bar — a zero-height bar is invisible. */
const REST_DOT_HEIGHT = 6;
/**
 * The load band marker's diameter, in points.
 *
 * NAMED BECAUSE ITS CENTRING IS DERIVED FROM IT. The marker is positioned by its
 * LEFT edge, so it must be pulled back by half its own width to sit ON the
 * ratio rather than beside it — and a hand-written `-9` beside an `18` is two
 * numbers that must agree with nobody watching. The new UI gate caught the bare
 * literal; tying the two together is what it was actually asking for.
 */
const LOAD_MARKER_SIZE = 18;

function WeekShapeStrip({ days }: { days: readonly JournalDay[] }) {
  return (
    <View style={styles.strip} testID="journal-week-shape-strip">
      {days.map((day, index) => {
        const presentation = SHAPE_PRESENTATION[day.shape];
        const isRest = presentation.heightFraction === 0;
        return (
          <View
            key={day.date}
            style={styles.stripDay}
            testID={`journal-strip-day-${day.date}`}
            accessibilityLabel={`${presentation.label} day`}
          >
            <View style={styles.barWell}>
              <View
                style={[
                  styles.bar,
                  isRest
                    ? { height: REST_DOT_HEIGHT, backgroundColor: presentation.color }
                    : {
                      height: BAR_WELL_HEIGHT * presentation.heightFraction,
                      // AN OUTLINED BAR IS A GAME. Sam's ruling names the game as
                      // the one shape drawn rather than filled, so it reads as a
                      // different KIND of day and not a harder one.
                      backgroundColor: presentation.outlined
                        ? 'transparent'
                        : presentation.color,
                      borderColor: presentation.color,
                      borderWidth: presentation.outlined ? 2 : 0,
                    },
                ]}
              />
            </View>
            <Text variant="labelSmall" style={styles.stripWeekday}>
              {WEEKDAY_INITIALS[index] ?? ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────

/**
 * WHAT KIND OF WORK THE WEEK HELD — PROPOSED (batch 23).
 *
 * The addendum's "key exposures, NOT completion counts": a week of five
 * completed sessions that were all conditioning is a different week from five
 * that were balanced, and the completion count cannot tell them apart.
 *
 * THE WORD "EXPOSURE" NEVER APPEARS. It is in Sam's forbidden vocabulary; these
 * are training words, and a cell asserts it.
 *
 * IT SITS ABOVE THE SESSIONS COUNT, which is batch 23-c's ordering kept through
 * the restructure — the composition is the context for the count, so it reads
 * before it. In this layout the sessions count is the first stat tile, so this
 * line is the strip's caption rather than a section of its own.
 */
function WeekKinds({ week }: { week: JournalWeek }) {
  const parts: string[] = [];
  const add = (n: number, word: string) => { if (n > 0) parts.push(`${n} ${word}`); };
  add(week.kinds.strength, 'strength');
  add(week.kinds.conditioning, 'conditioning');
  add(week.kinds.sprint, 'sprint');
  add(week.kinds.teamTraining, 'team training');
  add(week.kinds.games, week.kinds.games === 1 ? 'game' : 'games');
  add(week.kinds.recovery, 'recovery');

  if (parts.length === 0) return null;
  return (
    <Text variant="bodySmall" style={styles.muted} testID="journal-week-kinds">
      {`${parts.join(', ')}.`}
    </Text>
  );
}

/**
 * THE EXCEPTIONS UNDER THE SESSIONS TILE.
 *
 * The tile carries "5 / 5". This carries what the tile cannot: what went wrong,
 * and where the app does not know why. EVERY LINE IS ALREADY CONDITIONAL ON A
 * NON-ZERO COUNT, which is the ruling's rule arriving at a block that was
 * written before it — nothing here had to be re-authored to be exception-based,
 * because "N missed" was never rendered for N of zero.
 *
 * THE WHOLE BLOCK RETURNS NULL when the week is clean, so an athlete who did
 * everything and logged it sees the tile and no prose at all.
 */
function DidTheWorkHappen({ week }: { week: JournalWeek }) {
  const { work } = week;

  if (work.sessionsPlanned === 0) {
    return (
      <Text variant="bodySmall" style={styles.muted}>
        No sessions planned this week.
      </Text>
    );
  }

  if (work.skipped === 0 && work.notAnswered === 0 && work.missingReasons === 0) {
    return null;
  }

  return (
    <View style={styles.exceptionLines}>
      {work.skipped > 0 ? (
        <Text variant="bodySmall" style={styles.muted}>
          {`${work.skipped} missed.`}
        </Text>
      ) : null}
      {work.notAnswered > 0 ? (
        <Text variant="bodySmall" style={styles.muted}>
          {`${work.notAnswered} still to log.`}
        </Text>
      ) : null}
      {/*
        RIDER 1, MADE VISIBLE. The app knows a session did not fully happen but
        often does not know why — the ledger has no vocabulary for several of
        the reasons. It says so rather than inventing one.
      */}
      {work.missingReasons > 0 ? (
        <Text variant="bodySmall" style={styles.muted} testID="journal-no-reason-recorded">
          {work.missingReasons === 1
            ? 'No reason recorded for one of them.'
            : `No reason recorded for ${work.missingReasons} of them.`}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * HOW THE WEEK FELT — reduced to its NEWS by the ruling.
 *
 * THE BOOKKEEPING COUNTS ARE GONE FROM THE FRONT PAGE, and the cut is where the
 * ruling's rule cuts. "Effort recorded on 5 sessions" and "Soreness recorded on
 * 3 sessions" are facts about how much the athlete logged, not about their week
 * — they say nothing an athlete would act on, and they appeared every single
 * week. Both survive in "Your month in flags" inside the drawer, which is where
 * a coverage count belongs.
 *
 * WHAT STAYS IS WHAT IS NEWS: a session that did not go to plan, and the honest
 * "you recorded nothing" state — the second one because an empty screen and an
 * unlogged week are indistinguishable to the athlete otherwise, which is the one
 * absence that would read as the app being broken.
 *
 * THE GAME-FEEL RATING IS NOT HERE ANY MORE — it is the third stat tile, where
 * the ruling puts it.
 */
function HowTheWeekFelt({ week }: { week: JournalWeek }) {
  const { felt } = week;

  if (felt.nothingRecorded) {
    // SINGLE UNBROKEN LITERAL, per batch 11's note: the binding gate
    // equality-matches the file, and both an `&apos;` entity and a line break
    // inside a sentence hide it from that match. Both cost a red on this
    // batch's first run.
    return (
      <Text variant="bodySmall" style={styles.muted} testID="journal-felt-nothing-recorded">
        {"You haven't recorded how anything felt this week."}
      </Text>
    );
  }

  if (felt.differedFromPlan === 0) return null;

  return (
    <Text variant="bodySmall" style={styles.muted} testID="journal-felt-differed">
      {felt.differedFromPlan === 1
        ? 'One session did not go as planned.'
        : `${felt.differedFromPlan} sessions did not go as planned.`}
    </Text>
  );
}

/**
 * The headline continuum's words. SIGNED — batch 17, Sam 2026-08-09.
 *
 * NO RAW AU EVER REACHES THE ATHLETE (the ruling's first law), so the band is
 * spoken, never printed as a score. These lines were written and wired while
 * nothing rendered them; they sat behind `signedValue`, and the day Sam signed
 * the band and the stream weighting they appeared with no code change. That day
 * was 2026-08-09 and this is the first sentence of the load model an athlete
 * has ever read.
 */
const HEADLINE_COPY: Readonly<Record<BandVerdict, string>> = {
  below: 'A lighter week than your normal.',
  in: 'About your normal week.',
  above: 'A heavier week than your normal.',
};

/**
 * How many region observations may earn a card. Sam's "no chart walls", and now
 * also his "an athlete learns that seeing a card means pay attention".
 *
 * IT MOVED FROM THE LOAD SECTION TO THE EARNED CARD, because the observation had
 * quietly acquired TWO renderers. The load band drew it as a faint line and the
 * new attention card drew it as a card — the same fact, twice, on one screen.
 * Both are dark today (the observation is downstream of proposed constants), so
 * nothing showed it and no cell could: **the duplication would have appeared for
 * the first time on the day Sam signed his constants**, in a commit that touched
 * nothing.
 *
 * That is the hazard of building behind a signature. The card is the ruling's
 * placement, so the card is the one owner and the faint line is gone.
 */
const MAX_REGION_CARDS = 1;

/**
 * The Load section's evidence sentence — PROPOSED, batch 17-a.
 *
 * THREE FORMS, AND THE THIRD IS NOT DEFENSIVE PADDING. `sessionsPlanned` counts
 * the days the PROJECTION asks work of; `sessionsMeasured` counts the dates the
 * athlete actually logged detail on. Those are different questions, so measured
 * CAN exceed planned — log a session, then have the week change under it, and
 * the sentence would read "6 of 5", which is the kind of visibly-broken number
 * that costs an athlete's trust in every other number on the screen.
 *
 * The fix is not to clamp the count, because clamping would state a falsehood
 * quietly instead of loudly. It is to drop the denominator in exactly the case
 * where the denominator is not the right frame, and say the true thing without
 * it.
 */
function loadEvidenceLine(coverage: JournalLoadCoverage | null): string {
  if (coverage === null || coverage.sessionsPlanned === 0) {
    return 'Load is measured from the sessions you log.';
  }
  if (coverage.sessionsMeasured > coverage.sessionsPlanned) {
    return `Load is measured from the sessions you log — ${coverage.sessionsMeasured} this week have detail recorded.`;
  }
  return `Load is measured from the sessions you log — ${coverage.sessionsMeasured} of ${coverage.sessionsPlanned} this week have detail recorded.`;
}

/**
 * Where the marker sits on the band, as a fraction of the track.
 *
 * THE TRACK IS NOT THE RATIO. The band's shaded zone is Sam's sweet spot in
 * ratio terms (0.8–1.3 proposed); the track has to hold ratios outside it too,
 * so the scale runs from a little below the low edge to a little above the high
 * one and CLAMPS at both ends.
 *
 * CLAMPING A DRAWING IS NOT CLAMPING A NUMBER. The rule this unit follows —
 * "drop the denominator rather than clamp the count" — is about what the athlete
 * is TOLD. Here nothing is told: a marker two-and-a-half times normal has to be
 * drawn somewhere on a finite track, and the alternative to pinning it at the
 * end is drawing it off the screen. The spoken band word carries the magnitude.
 */
function markerFraction(ratio: number, band: { low: number; high: number }): number {
  const span = band.high - band.low;
  const trackLow = band.low - span;
  const trackHigh = band.high + span;
  const raw = (ratio - trackLow) / (trackHigh - trackLow);
  return Math.min(1, Math.max(0, raw));
}

/**
 * THE LOAD SECTION — now the hero's band, which is where the ruling puts it.
 *
 * THE BAND SLOT HAS TWO STATES AND NEITHER IS BLANK. With the signature: the
 * track, the shaded sweet spot and the marker. Without it: the honest building
 * line — which is itself news to an athlete ("this is coming, here is what it
 * needs"), and is the ruling's rule satisfied rather than dodged.
 *
 * SAM SIGNED ON 2026-08-09, SO THE FIRST STATE IS THE LIVE ONE NOW — for an
 * athlete with four weeks of logged history and half a week measured. THE
 * SECOND STATE IS NOT DEAD CODE: an athlete without that history still gets the
 * building line, because the headline is null on the FACTS as well as on the
 * provenance. Signing did not remove the honest case, it removed one reason for
 * it, and confusing the two would have deleted the empty state a new athlete
 * sees on their first week.
 */
function LoadSection({ week, load }: { week: JournalWeek; load: JournalLoadModel }) {
  const coverage = signedValue(load.coverage);
  const headline = signedValue(load.headline);
  const band = signedValue(load.sweetSpotBand);

  return (
    <View style={styles.bandBlock}>
      {/*
        BARE JSX TEXT, EACH SENTENCE UNBROKEN ON ITS OWN LINE, and both halves of
        that are load-bearing. The extraction gate's line-spanning canary reads a
        sentence here that its tags do not share a line with — written as a
        ternary of string literals it would be caught by a different pattern and
        would stop proving the widening. And the sentence itself stays on ONE
        line because the binding gate equality-matches the file, where a line
        break inside a sentence hides it (batch 11's note, paid for twice).
      */}
      {headline === null ? (
        week.load.comparisonAvailable ? (
          <Text variant="bodySmall" style={styles.muted} testID="journal-load-building">
            Your normal is ready to compare against — that comparison is coming next.
          </Text>
        ) : (
          <Text variant="bodySmall" style={styles.muted} testID="journal-load-building">
            Once you have a few more weeks logged, this shows how the week compared with your normal.
          </Text>
        )
      ) : (
        <View>
          <View style={styles.bandHeader}>
            <Text variant="overline" style={styles.bandLabel}>Load vs your normal</Text>
            <Text variant="bodySmallEmphasis" style={styles.body} testID="journal-load-headline">
              {HEADLINE_COPY[headline.band]}
            </Text>
          </View>
          {/*
            THE TRACK RENDERS ONLY WITH THE BAND SIGNED. A shaded "sweet spot"
            drawn from an unsigned edge is an unsigned number reaching the
            athlete as a PICTURE rather than as a numeral, which is the same
            violation wearing a different medium.
          */}
          {band !== null ? (
            <View style={styles.track} testID="journal-load-track">
              <View
                style={[styles.trackZone, {
                  left: `${markerFraction(band.low, band) * 100}%`,
                  right: `${(1 - markerFraction(band.high, band)) * 100}%`,
                }]}
              />
              <View
                style={[styles.trackMarker, {
                  left: `${markerFraction(headline.ratio, band) * 100}%`,
                }]}
                testID="journal-load-marker"
              />
            </View>
          ) : null}
        </View>
      )}

      <Text variant="caption" style={styles.faint} testID="journal-load-evidence">
        {loadEvidenceLine(coverage)}
      </Text>

      {/*
        RIDER 1 AGAIN, ONE LAYER DOWN. A lift with no weight recorded cannot be
        counted, and the section says so rather than letting the athlete read a
        smaller number as a smaller week.
      */}
      {coverage !== null && coverage.liftsUnmeasured > 0 ? (
        <Text variant="caption" style={styles.faint} testID="journal-load-unmeasured">
          {'Some lifts had no weight recorded, so they sit outside that.'}
        </Text>
      ) : null}

    </View>
  );
}

/**
 * THIS WEEK'S JOB — Monday card / addendum Group 1 item 4, PROPOSED (batch 20).
 *
 * IT STATES WHAT THE WEEK ASKS AND NOTHING ABOUT WHETHER IT IS DONE. The first
 * version rendered a satisfied/short verdict from the contract's stored achieved
 * tallies, and `section18ShortfallCopyTests` refused it: a stored tally is
 * derived output and goes stale beside the facts it came from, so the athlete
 * would have read Monday's snapshot as Thursday's truth. The verdict needs a
 * freshly-built ledger and belongs to the owners that gate names.
 *
 * THE COMPLETION PICTURE LIVES IN THE SESSIONS TILE, from recorded outcomes.
 */
function WeekJob({ job }: { job: JournalWeekJob | null }) {
  if (job === null) {
    return (
      <Text variant="body" style={styles.heroJob} testID="journal-job-none">
        {'No plan recorded for this week.'}
      </Text>
    );
  }

  const asks = job.asks.map((ask) => `${ask.target} ${ask.athleteWord}`).join(', ');

  return (
    <Text variant="body" style={styles.heroJob} testID="journal-job-asks">
      {`This week asks for ${asks}.`}
    </Text>
  );
}

/**
 * WHAT YOU CHANGED THIS WEEK — PROPOSED (batch 25), now the hero's credit line.
 *
 * SAM'S RULING PUT IT IN THE HERO AND RETIRED ITS EMPTY STATE: "one credit line
 * inside the hero on weeks a change happened, nothing otherwise. Data stays
 * stored/derived regardless." So this returns NULL on a week with no changes,
 * where it used to render "You made no changes to this week."
 *
 * ONE LINE MEANS ONE LINE. A week with four changes shows the first and counts
 * the rest, rather than growing the hero into a list — the ruling's word is
 * "credit line", singular, and a hero that can be six lines tall on a busy week
 * is not a hero.
 *
 * THE BOUNDARY SENTENCE RIDES WITH IT, and that is deliberate rather than
 * inherited. The ledger records the athlete's decisions and has no vocabulary
 * for changes the APP made — illness, injury, readiness, phase. A credit line
 * without it implies the app changed nothing, which is a stronger claim than the
 * data supports. It appears only where the claim appears.
 */
function WhatChanged({ changes }: { changes: JournalChanges }) {
  const [first, ...rest] = changes.changes;
  if (!first) return null;

  return (
    <View style={styles.creditBlock}>
      <View style={styles.creditRow}>
        <View style={styles.creditDot} />
        <Text
          variant="bodySmall"
          style={styles.body}
          testID={`journal-change-${first.entryId}`}
        >
          {`You ${first.what}.`}
        </Text>
      </View>
      {rest.length > 0 ? (
        <Text variant="caption" style={styles.faint} testID="journal-changes-more">
          {rest.length === 1
            ? 'And one more change this week.'
            : `And ${rest.length} more changes this week.`}
        </Text>
      ) : null}
      <Text variant="caption" style={styles.faint} testID="journal-changes-boundary">
        {'Changes the app made for you are not listed here yet.'}
      </Text>
    </View>
  );
}

/**
 * WEEK STATUS — the hero's headline, PROPOSED (batch 24).
 *
 * EVERY NUMBER BEHIND THIS WAS DERIVED THIS TURN. The status comes from
 * `evaluateSection18EffectiveWeek`, which builds a fresh ledger from THIS week's
 * workouts — not from the contract's stored tallies, which a gate rightly
 * refused because a stored tally goes stale beside the facts it came from.
 *
 * THE WORDS DID NOT CHANGE WHEN IT BECAME A HEADLINE, and that was the point of
 * putting it here. Sam's ruling asks for "week status as the headline (big
 * type)"; batch 24's sentences already say it in one calm line, so this slice
 * changed the SIZE and not the copy. A headline written fresh would have been a
 * second answer to a question batch 24 already ruled on.
 */
function WeekStatus({ status }: { status: JournalWeekStatus | null }) {
  if (status === null) return null;
  if (status.onTrack) {
    return (
      <Text variant="h3" style={styles.heroHeadline} testID="journal-status-on-track">
        {'The week is on track.'}
      </Text>
    );
  }
  return (
    <Text variant="h3" style={styles.heroHeadline} testID="journal-status-gaps">
      {`Still outstanding: ${status.gaps.map((gap) => gap.athleteWord).join(', ')}.`}
    </Text>
  );
}

// ─── The stat strip ──────────────────────────────────────────────────────

/**
 * ONE GLANCEABLE. Value on top, name under it, and NOTHING renders when the
 * value cannot be spoken honestly — a tile is a claim like any other line.
 */
function Stat({ value, unit, name, testID, tone }: {
  value: string;
  unit?: string;
  name: string;
  testID: string;
  tone?: string;
}) {
  return (
    <View style={styles.stat} testID={testID}>
      <View style={styles.statValueRow}>
        <Text variant="h3" style={[styles.statValue, tone ? { color: tone } : null]}>
          {value}
        </Text>
        {unit ? <Text variant="caption" style={styles.faint}>{unit}</Text> : null}
      </View>
      <Text variant="labelSmall" style={styles.statName}>{name}</Text>
    </View>
  );
}

/**
 * THE THREE GLANCEABLES — sessions done, load vs normal, game feel.
 *
 * THE STRIP IS AS WIDE AS THE HONEST TILES, which is the ruling's rule applied
 * to itself. The load tile was downstream of PROPOSED constants and returned
 * null until Sam's signature on 2026-08-09; it now speaks for an athlete whose
 * history supports a comparison. The game-feel tile still needs a game that was
 * actually rated. A strip of three placeholders would be furniture pretending to
 * be news, and a "—" in a tile is a number the athlete has to learn to ignore.
 *
 * THE WHOLE STRIP DISAPPEARS when no tile can speak.
 */
function StatStrip({ week, load }: { week: JournalWeek; load: JournalLoadModel }) {
  const headline = signedValue(load.headline);
  const { work, felt } = week;

  const tiles: React.ReactNode[] = [];

  if (work.sessionsPlanned > 0) {
    tiles.push(
      <Stat
        key="sessions"
        testID="journal-stat-sessions"
        value={`${work.completedFull + work.completedPartial}`}
        unit={`/ ${work.sessionsPlanned}`}
        name="Sessions"
      />,
    );
  }

  if (headline !== null) {
    // THE PERCENTAGE IS THE RATIO SPOKEN, NEVER A RAW UNIT — the load ruling's
    // first law. "+31%" is a comparison with the athlete's own normal; the AU it
    // came from never leaves the model.
    const percent = Math.round((headline.ratio - 1) * 100);
    tiles.push(
      <Stat
        key="load"
        testID="journal-stat-load"
        value={`${percent > 0 ? '+' : ''}${percent}%`}
        name="Load"
        tone={headline.band === 'in' ? colors.text.primary : colors.status.warning}
      />,
    );
  }

  if (felt.gameFeelLatest !== null) {
    tiles.push(
      <Stat
        key="gamefeel"
        testID="journal-felt-game"
        value={`${felt.gameFeelLatest}`}
        unit="/ 5"
        name="Game feel"
      />,
    );
  }

  if (tiles.length === 0) return null;
  return <View style={styles.statStrip}>{tiles}</View>;
}

// ─── Earned cards ────────────────────────────────────────────────────────

/**
 * AN EARNED CARD — the ruling's attention surface.
 *
 * "EARNED CARDS (exist only on weeks that cross a line) … Placement: ABOVE the
 * lifts — attention beats routine. They vanish when back in range; reappearance
 * is the signal."
 *
 * ONE COMPONENT FOR ALL OF THEM, so a fourth earned card cannot be born with its
 * own shape, its own padding and its own idea of what an attention card looks
 * like. The three that exist differ in their WORDS and their PREDICATE, which is
 * the only thing that should differ.
 */
function EarnedCard({ title, detail, testID }: {
  title: string; detail: string; testID: string;
}) {
  return (
    <Card variant="outlined" style={styles.earned} testID={testID}>
      <Text variant="bodySmallEmphasis" style={styles.body}>{title}</Text>
      <Text variant="caption" style={styles.muted}>{detail}</Text>
    </Card>
  );
}

/**
 * REGION HOT + BALANCE DRIFTING — SIGNED (batch 26, Sam 2026-08-09), and both
 * LIVE since that signature.
 *
 * BOTH SIT BEHIND `signedValue` BECAUSE BOTH ARE THRESHOLD JUDGEMENTS, which is
 * exactly what Sam's ruling says they are: "What counts as 'out of whack'
 * (balance skew line, region-hot line, load-band edges) are athlete-affecting
 * constants: ship PROPOSED, join the load model's constants batch, ONE signing
 * sitting." The sitting happened; the cards appeared.
 *
 * SO THE MECHANISM AND THE RULING AGREE WITHOUT BEING MADE TO. Nothing here
 * checks whether a threshold is signed; the values simply arrive as null while
 * they are not, and a card with no value renders nothing. That is still true —
 * it is the reason these cards remain EXCEPTIONS rather than furniture, because
 * a week that ran nothing hot supplies no observation and the card stays away.
 */
function AttentionCards({
  observations,
  balance,
  niggles,
}: {
  observations: readonly { region: string; weeksCompared: number }[];
  balance: PatternBalance | null;
  niggles: JournalNiggleHistory;
}) {
  const cards: React.ReactNode[] = [];

  // ONE CARD, NOT ONE PER REGION. Two attention cards about muscles in one week
  // is a wall, and the ruling's whole point is that a card means something. This
  // is also the ONE renderer of a region observation on this screen — the load
  // band used to draw the same fact as a faint line, and both would have
  // appeared together the day Sam signed.
  for (const observation of observations.slice(0, MAX_REGION_CARDS)) {
    cards.push(
      <EarnedCard
        key={`region-${observation.region}`}
        testID="journal-load-region"
        title={`${observation.region} ran hot`}
        detail={
          `Biggest week for ${observation.region} in the last ${observation.weeksCompared} weeks.`
        }
      />,
    );
  }

  const [drift] = balance?.drifts ?? [];
  if (drift) {
    // THE SIGN IS SPOKEN, NOT ABSOLUTED. More than planned and less than planned
    // are different news, and one sentence for both would report a missed
    // pattern as an overdone one.
    const percent = Math.abs(Math.round(drift.delta * 100));
    cards.push(
      <EarnedCard
        key="balance"
        testID="journal-earned-balance"
        title="Balance drifting"
        detail={drift.delta > 0
          ? `Your ${drift.pattern} work ran ${percent}% above what the week planned.`
          : `Your ${drift.pattern} work ran ${percent}% below what the week planned.`}
      />,
    );
  }

  // NIGGLES ARE AN EARNED CARD NOW, NOT A SECTION. The ruling: "NIGGLE HISTORY
  // surfaces only with an active issue or repeat flag — never standing
  // furniture." An athlete with one healed episode from March had a "Niggles"
  // heading on their screen every week; they do not now.
  //
  // THE PREDICATE IS THE DERIVATION'S, NOT THIS SCREEN'S. Written here it would
  // be provable only by reading JSX; `flaggedNiggleRegions` is a pure function
  // its own suite calls, so "a healed single episode is not shown" is a cell
  // that runs rather than a regex that matches.
  const flagged = flaggedNiggleRegions(niggles);
  for (const region of flagged) {
    cards.push(
      <EarnedCard
        key={`niggle-${region.region}`}
        testID={`journal-niggle-${region.region}`}
        title={region.active ? `${region.region} — going now` : `${region.region} — came back`}
        detail={`${region.episodes.length} ${
          region.episodes.length === 1 ? 'episode' : 'episodes'} recorded.`}
      />,
    );
  }

  // THE RESURFACED NOTE RIDES ITS REGION'S CARD, never on its own. A note with
  // no niggle beside it is a diary entry the app decided to reprint.
  const flaggedRegions = new Set(flagged.map((region) => region.region));
  for (const entry of niggles.resurfaced) {
    if (!flaggedRegions.has(entry.region)) continue;
    cards.push(
      <Card
        key={`resurfaced-${entry.episodeId}-${entry.note.id}`}
        variant="outlined"
        style={styles.earned}
        testID="journal-niggle-resurfaced"
      >
        {/*
          OBSERVATION, NEVER DIAGNOSIS (the load ruling's second law, verbatim).
          The introducing line states only WHEN it was written; the note itself
          is the athlete's own words, returned unread.
        */}
        <Text variant="caption" style={styles.muted}>
          {`You wrote this the last time your ${entry.region} flared:`}
        </Text>
        <Text variant="bodySmall" style={styles.body}>{entry.note.text}</Text>
      </Card>,
    );
  }

  if (cards.length === 0) return null;
  return <View style={styles.earnedStack}>{cards}</View>;
}

/**
 * THE MONTHLY REVIEW — PROPOSED (batch 22).
 *
 * SAM'S "NO CHART WALLS" GUARD, OBEYED BY COUNTING. At most two charts render:
 * conditioning progression, and the single lift with the most history. Building
 * one chart per available series is the failure mode his guard names, and it is
 * the easy thing to do because the data is all there.
 *
 * NOTHING RENDERS UNTIL ITS HISTORY IS HONEST — and this component could not
 * break that rule if it tried: `rules/journalMonth.ts` returns null for a series
 * with too few points, so a one-dot chart is never handed here.
 */
function MonthlyReview({
  month,
  balance,
  viewedWeekStart,
}: {
  month: JournalMonth;
  /** Completed pattern shares, or null while their provenance is unsigned. */
  balance: readonly PatternShare[] | null;
  /** The week being read — the anchor for "is that month this year?". */
  viewedWeekStart: string;
}) {
  if (month.building) {
    return (
      <Text variant="bodySmall" style={styles.muted} testID="journal-month-building">
        {'This builds as you train. A few more weeks and your trends appear here.'}
      </Text>
    );
  }

  // ONE LIFT, NOT ALL OF THEM — the lift with the most history, because a screen
  // of five identical charts is the wall Sam ruled against.
  const [topLift] = Array.from(month.strengthSeries.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return (
    <View style={styles.drawerBody}>
      {/*
        CONSISTENCY WITH ITS DENOMINATOR ATTACHED. "80%" over five sessions and
        over fifty are different facts wearing one number, so the count travels
        with the percentage rather than behind a tap.
      */}
      {month.consistency ? (
        <Text variant="bodySmall" style={styles.body} testID="journal-month-consistency">
          {`${Math.round(month.consistency.rate * 100)}% of your planned sessions done — ${
            month.consistency.sessionsDone} of ${month.consistency.sessionsPlanned} over ${
            month.consistency.weeksCounted} weeks.`}
        </Text>
      ) : null}
      {month.conditioningSeries ? (
        <TrendChart
          testID="journal-month-conditioning"
          label="Conditioning over time"
          points={month.conditioningSeries}
        />
      ) : null}
      {topLift ? (
        <TrendChart
          testID="journal-month-strength"
          label={`${topLift[0]} top set over time`}
          points={topLift[1]}
        />
      ) : null}
      {/*
        YOUR MONTH IN FLAGS — counts of what the athlete SAID, never a trend
        word. The design calls it a trend; what the app can honestly produce is
        how many times they answered each thing, and turning three soreness
        answers into "your soreness is rising" would claim a direction from a
        count.
      */}
      {month.flags ? (
        <Text variant="bodySmall" style={styles.body} testID="journal-month-flags">
          {`Across ${month.flags.weeksCounted} weeks you logged soreness ${
            month.flags.sorenessRecorded} times, ${
            month.flags.sessionsThatDiffered} sessions that did not go to plan, and rated ${
            month.flags.gamesRated} games.`}
        </Text>
      ) : null}
      {/*
        THE BALANCE PICTURE — load-ruling layer 4, and it can ship where the
        continuum cannot: `patternSharesDone` is derived from NO constant, so it
        carries SIGNED provenance and passes `signedValue`. The plan-vs-done
        VERDICT is the part that waits on Sam's threshold; what the athlete did
        is a measurement.
      */}
      {balance !== null && balance.length > 0 ? (
        <Text variant="bodySmall" style={styles.body} testID="journal-month-balance">
          {`Your strength work: ${balance
            .map((share) => `${share.pattern} ${Math.round(share.doneShare * 100)}%`)
            .join(', ')}.`}
        </Text>
      ) : null}
      {/*
        THE SATISFACTION LINE (the design's "visible progress is the retention
        mechanism, not badges"). A LOSS IS REPORTED TOO — only the wording
        changes — because a review that only speaks when the news is good is a
        cheerleader, and the design excludes gamification by name.
      */}
      {month.gains.slice(0, 1).map((gain) => {
        // C5, SAM 2026-08-09: the month WORD, never the ISO date. A gain whose
        // month cannot be said is dropped rather than spoken as "2026-03-02" —
        // see `monthWordSince`.
        const since = monthWordSince(gain.fromWeekStart, viewedWeekStart);
        if (since === null) return null;
        return (
          <Text
            key={gain.exerciseName}
            variant="bodySmall"
            style={styles.body}
            testID="journal-month-gain"
          >
            {gain.deltaKg > 0
              ? `You have added ${gain.deltaKg}kg to your ${gain.exerciseName} since ${since}.`
              : `Your ${gain.exerciseName} is ${Math.abs(gain.deltaKg)}kg lighter than in ${since}.`}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * YOUR MONTH — the ruling's ONE permanent drawer.
 *
 * "the one permanent drawer (progress always has something to say once history
 * exists) — charts live behind it."
 *
 * PERMANENT IS SAM'S WORD AND IT IS HONOURED LITERALLY: this row renders on
 * every week, unlike every other block below the hero. It is the one place the
 * exception rule does not apply, because progress is the thing an athlete opens
 * the app to see even on a week where nothing happened.
 *
 * THE COLLAPSED ROW CARRIES THE HEADLINE FACT, not just a chevron. A drawer that
 * says only "Your month" gives the athlete no reason to open it; one that says
 * "Trap Bar Deadlift +12.5kg since April" is the progress, and opening it is for
 * the detail.
 */
function MonthDrawer({
  month,
  balance,
  viewedWeekStart,
}: {
  month: JournalMonth;
  balance: readonly PatternShare[] | null;
  /** The week being read — the anchor for "is that month this year?". */
  viewedWeekStart: string;
}) {
  const [open, setOpen] = useState(false);

  // C5, SAM 2026-08-09. The collapsed row was the worst of the four date sites:
  // "Trap Bar Deadlift +12.5kg since 2026-04-06" is the ONE line an athlete
  // reads without opening anything, and this comment used to claim it read
  // "since 6 Apr" while the code rendered the ISO — the claim and the code
  // disagreed for a whole slice.
  const [gain] = month.gains;
  const since = gain ? monthWordSince(gain.fromWeekStart, viewedWeekStart) : null;
  const teaser = gain && since !== null
    ? (gain.deltaKg > 0
      ? `${gain.exerciseName} +${gain.deltaKg}kg since ${since}`
      : `${gain.exerciseName} ${gain.deltaKg}kg since ${since}`)
    : 'Your trends, charts and totals.';

  return (
    <Card style={styles.card} testID="journal-month-drawer">
      <TouchableOpacity
        onPress={() => setOpen((current) => !current)}
        style={styles.drawerRow}
        testID="journal-month-drawer-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Your month"
      >
        <View style={styles.drawerText}>
          <Text variant="bodySmallEmphasis" style={styles.body}>Your month</Text>
          <Text variant="caption" style={styles.faint}>{teaser}</Text>
        </View>
        <Text variant="body" style={styles.chevron}>{open ? '−' : '+'}</Text>
      </TouchableOpacity>
      {open ? (
        <MonthlyReview month={month} balance={balance} viewedWeekStart={viewedWeekStart} />
      ) : null}
    </Card>
  );
}

/**
 * ARROWS AS WORDS, PROPOSED (batch 19). A glyph alone is not readable by a
 * screen reader and not legible at small sizes; the word carries the meaning and
 * the symbol carries the glance.
 *
 * THE GLYPH JOINS THE WORD RATHER THAN REPLACING IT (batch 26). The ruling's
 * lift row is "names, kg × reps, up/flat/down arrows" — so the arrow is drawn,
 * and the word rides the accessibility label, which is the same split the week
 * bars make one card up.
 */
const TREND_COPY: Readonly<Record<StrengthLiftTrend['direction'], string>> = {
  up: 'up on last week',
  flat: 'same as last week',
  down: 'down on last week',
  new: 'first time this week',
};

const TREND_GLYPH: Readonly<Record<StrengthLiftTrend['direction'], string>> = {
  up: '▲',
  flat: '—',
  down: '▼',
  new: '·',
};

const TREND_TONE: Readonly<Record<StrengthLiftTrend['direction'], string>> = {
  up: colors.status.success,
  flat: colors.text.tertiary,
  down: colors.status.warning,
  new: colors.text.tertiary,
};

/**
 * THE STRENGTH LINE — Monday card item 2, and the first Journal line that ships
 * a NUMBER to the athlete.
 *
 * It can, where the load model's cannot, because it waits on no constant: "10kg
 * heavier than last week" is a comparison of two recorded weights, not a
 * judgement against a threshold Sam has yet to sign.
 *
 * ITS EMPTY STATE IS BACK — SAM RULED C3 ON 2026-08-09, AND IT IS THE ONLY
 * WITHDRAWAL HE REVERSED.
 *
 * Batch 26 retired nine strings under the exception rule. Eight were headings
 * or duplicates; this one removed INFORMATION, because with the card absent
 * "you logged no weights" and "you did no lifting" look identical to the
 * athlete and neither says anything. 26-e flagged it as the one that cost
 * something and put it back to him; he sent it back.
 *
 * RESTORED IN ITS ORIGINAL FORM — one quiet line where the card would have
 * been, unconditional on there being no weighted lifts, exactly as 26-e
 * recommended and exactly as it read before the withdrawal.
 *
 * THE ONE THING THAT WANTS HIS EYE, AND IT IS NOT NARROWED HERE: this line also
 * appears on a week the athlete never lifted at all — a rest week, a holiday —
 * where it is true and says nothing, which is the one place it sits against his
 * own organising rule. Making it conditional on "lifted but recorded no weight"
 * would need the trend module to report a fact it currently only consumes, and
 * that is a narrowing of his ruling rather than an implementation of it. Built
 * as ruled, flagged in the boundary report.
 */
function StrengthLines({ lifts }: { lifts: readonly StrengthLiftTrend[] }) {
  if (lifts.length === 0) {
    return (
      <Text variant="bodySmall" style={styles.muted} testID="journal-strength-none">
        No lifts recorded with a weight this week.
      </Text>
    );
  }
  return (
    <Card style={styles.card} testID="journal-lifts">
      <Text variant="overline" style={styles.cardTitle}>Your lifts</Text>
      {lifts.map((lift) => (
        <View
          key={lift.exerciseName}
          style={styles.liftRow}
          testID={`journal-strength-${lift.exerciseName}`}
          accessibilityLabel={
            `${lift.exerciseName}, ${lift.thisWeek.weightKg}kg, ${TREND_COPY[lift.direction]}`
          }
        >
          <Text variant="bodySmall" style={styles.body}>{lift.exerciseName}</Text>
          <View style={styles.liftRight}>
            <Text variant="bodySmallEmphasis" style={styles.body}>
              {`${lift.thisWeek.weightKg}kg`}
              {lift.thisWeek.reps !== null ? ` × ${lift.thisWeek.reps}` : ''}
            </Text>
            <Text
              variant="captionEmphasis"
              style={[styles.liftArrow, { color: TREND_TONE[lift.direction] }]}
            >
              {TREND_GLYPH[lift.direction]}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

// ─── The note (slice 2) ──────────────────────────────────────────────────

/**
 * PROPOSED tag labels — batch 16. The tag KEYS are the design's vocabulary
 * (base five + the addendum's three); these are their athlete-facing spellings.
 */
const TAG_LABELS: Readonly<Record<JournalNoteTag, string>> = {
  recovery: 'Recovery',
  mobility: 'Mobility',
  injury: 'Injury',
  diet: 'Diet',
  work_stress: 'Work stress',
  sleep: 'Sleep',
  illness: 'Illness',
  travel: 'Travel',
};

/**
 * THE ONE PLACE THIS SCREEN WRITES ANYTHING.
 *
 * Slice 1's gate asserted the Journal reached NO writer. That was true and is
 * now deliberately false: a note is an ANSWER, so recording one is an input
 * write and the north star allows it. The cell was RE-POINTED rather than
 * deleted — it now requires exactly one door and still forbids every
 * transaction, ledger append and raw store write.
 *
 * The door refuses blank text itself, so this component never has to decide
 * what counts as a note.
 *
 * IT IS QUIET AND IT IS AT THE BOTTOM, which is the ruling's placement. The tag
 * chips appear only once the athlete has started writing — an empty box with
 * eight chips under it is a form; an empty box is an invitation.
 */
function WeekNote({ weekStart }: { weekStart: string }) {
  const notes = useJournalNoteStore((s) => s.notes);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<readonly JournalNoteTag[]>([]);

  const weekNotes = useMemo(
    () => notes.filter((note) => note.weekStart === weekStart)
      .slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes, weekStart],
  );

  const toggleTag = (tag: JournalNoteTag) => {
    setTags((current) => (current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag]));
  };

  const save = () => {
    const outcome = recordJournalNote({
      weekStart,
      text,
      tags,
      nowISO: appDateNow().toISOString(),
    });
    if (!outcome.ok) return;
    setText('');
    setTags([]);
  };

  const canSave = text.trim().length > 0;

  return (
    <View style={styles.noteBlock}>
      {weekNotes.map((note) => (
        <View key={note.id} style={styles.noteRow} testID={`journal-note-${note.id}`}>
          <Text variant="bodySmall" style={styles.body}>{note.text}</Text>
          {note.tags.length > 0 ? (
            <Text variant="caption" style={styles.faint}>
              {note.tags.map((tag) => TAG_LABELS[tag]).join(' · ')}
            </Text>
          ) : null}
        </View>
      ))}

      <View style={styles.noteComposer}>
        <AppTextInput
          style={styles.noteInput}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Anything worth remembering about this week?"
          placeholderTextColor={colors.text.tertiary}
          testID="journal-note-input"
          accessibilityLabel="Week note"
        />
        <TouchableOpacity
          onPress={save}
          disabled={!canSave}
          style={[styles.saveButton, canSave ? null : styles.saveButtonOff]}
          testID="journal-note-save"
          accessibilityRole="button"
        >
          <Text variant="buttonSmall" style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/*
        THE CHIPS APPEAR WITH THE WRITING. They are how a note is filed, and a
        note that does not exist yet cannot be filed — so eight chips under an
        empty box are eight controls with nothing to act on. This is the ruling's
        rule reaching the quietest block on the screen.
      */}
      {canSave ? (
        <View style={styles.tagRow}>
          {JOURNAL_NOTE_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[styles.tag, on ? styles.tagOn : null]}
                testID={`journal-note-tag-${tag}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={TAG_LABELS[tag]}
              >
                <Text variant="caption" style={on ? styles.tagTextOn : styles.tagText}>
                  {TAG_LABELS[tag]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────

export default function JournalScreen() {
  // `useResolvedWeek` is the ONE hook that resolves the week and projects it —
  // its own header says to call this rather than `project()`, "because two call
  // sites is two chances to pass different inputs".
  const { weekDays, visibleWeek } = useResolvedWeek();
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const currentMicrocycle = useProgramStore((s) => s.currentMicrocycle);
  const injuryEpisodes = useProgramStore(
    (s) => s.acceptedMaterialContext?.injuryEpisodes ?? EMPTY_EPISODES,
  );
  const journalNotes = useJournalNoteStore((s) => s.notes);
  const ledgerEntries = useDecisionLedgerStore((s) => s.entries);
  // THE PROFILE IS READ THROUGH ITS CONSOLIDATED OWNER, NOT OFF THE MIRROR.
  //
  // The first version of this screen selected `onboardingData` straight off
  // `useProfileStore`, and the legacy census caught it on the first full chain:
  // LR-4's `mirrorDecisionReads` detector went 71 -> 72, with its own failure
  // text saying "an undeclared hit means a NEW violation, not a miscount".
  // Raising the declared count would have ratcheted this era's debt UP for a
  // brand-new file — so the violation was fixed instead. `useAthleteContext` is
  // the one consolidated reader the census names as LR-4's destination.
  const athlete = useAthleteContext();

  const week = useMemo<JournalWeek>(() => {
    // HARDNESS COMES FROM ITS OWNER. `countWeeklyExposures` defines a hard day;
    // this screen asks it rather than deciding for itself, and passes the same
    // profile context the rest of the app classifies with so the Journal cannot
    // disagree with the program about which days were hard.
    const exposures = countWeeklyExposures(
      weekDays.map((day) => ({ date: day.date, workout: day.workout })),
      {
        experienceLevel: athlete.onboardingData?.experienceLevel,
        conditioningLevel: athlete.onboardingData?.conditioningLevel,
      },
    );

    const outcomesByDate: Record<string, JournalSessionOutcome> = {};
    for (const day of visibleWeek.days) {
      const feedback = sessionFeedback?.[day.date];
      if (!feedback) continue;
      outcomesByDate[day.date] = {
        completion: feedback.completion,
        // ABSENT IS NULL, NEVER A DEFAULT. `?? null` rather than `?? 'other'`
        // is the whole of rider 1 at the read boundary.
        reason: feedback.skipReason ?? feedback.partialReason ?? null,
        feeling: feedback.feeling ?? null,
        soreness: feedback.soreness ?? null,
        gameFeel: feedback.gameFeel ?? null,
        expectation: feedback.expectation ?? null,
      };
    }

    return buildJournalWeek({
      weekStart: visibleWeek.weekStart,
      days: visibleWeek.days,
      exposures,
      outcomesByDate,
      // Weeks of recorded history — a count of the dates the athlete has
      // actually logged, which is what the data-state schedule is about.
      weeksOfHistory: countWeeksOfHistory(sessionFeedback),
    });
  }, [weekDays, visibleWeek, sessionFeedback, athlete]);

  /**
   * THE LOAD MODEL — every recorded session the app holds, not just this week's.
   *
   * The four-week normal is a read over HISTORY, and history is exactly what
   * `sessionFeedback` already is: an input keyed by date, persisted and never
   * pruned. Nothing new is stored to make this work; the whole comparison is
   * derived here on read.
   *
   * THE FALLBACK RUNG IS NOT PASSED IN, because it is not this model's to hold:
   * `week.load.thisWeek` already carries Sam's 2/1/0 over the week's DAYS, which
   * is where a shape exists. Handing the load model a per-session copy made it a
   * second owner of that number, computed over recorded sessions instead — the
   * two disagreed for any week the athlete had not finished logging.
   */
  const loadModel = useMemo<JournalLoadModel>(() => {
    const sessions: JournalLoadSessionInput[] = Object.entries(sessionFeedback ?? {})
      .map(([date, feedback]) => ({
        date,
        strength: feedback?.strength ?? [],
        conditioning: feedback?.conditioning ?? null,
      }));

    // THE PLAN HALF OF LAYER 4, read off the same resolved week the rest of the
    // screen uses. Every prescribed row is offered; the model asks the pattern
    // owner which of them are main-strength and ignores the rest.
    const plannedStrength: PlannedLift[] = weekDays.flatMap((day) =>
      (day.workout?.exercises ?? []).map((exercise) => ({
        exerciseName: exercise.exercise?.name ?? '',
        sets: Number(exercise.prescribedSets) || 0,
        repsMin: Number(exercise.prescribedRepsMin) || 0,
        repsMax: Number(exercise.prescribedRepsMax) || 0,
        weightKg: typeof exercise.prescribedWeightKg === 'number'
          ? exercise.prescribedWeightKg
          : null,
      })));

    return buildJournalLoadModel({
      weekStart: week.weekStart,
      sessions,
      sessionsPlannedThisWeek: week.work.sessionsPlanned,
      plannedStrength,
    });
  }, [week, weekDays, sessionFeedback]);

  // THE SAME RECORDED HISTORY, READ FOR A DIFFERENT QUESTION. Two derivations
  // over one input set rather than one derivation answering two questions —
  // "what did this week cost" and "did the bar go up" are different enough that
  // one module answering both would need a mode flag, and a mode flag is how a
  // derivation becomes a second model.
  // THE CONTRACT IS READ, NEVER REBUILT. It is a typed fact the Section 18
  // resolver already authored onto the microcycle; deriving a second one here
  // would be a second answer to what the week asks of the athlete.
  const weekJob = useMemo<JournalWeekJob | null>(
    () => buildJournalWeekJob(currentMicrocycle?.exposureContractV2 ?? null),
    [currentMicrocycle],
  );

  // THE STATUS IS DERIVED THIS TURN, NOT READ OFF THE CONTRACT. The evaluator
  // builds a fresh ledger from THIS week's workouts; the contract's own stored
  // tallies are the stale read a gate refused, and are never touched here.
  const weekStatus = useMemo<JournalWeekStatus | null>(() => {
    const contract = currentMicrocycle?.exposureContractV2;
    if (!contract) return null;
    const workouts = weekDays
      .map((day) => day.workout)
      .filter((workout): workout is NonNullable<typeof workout> => !!workout);
    const evaluation = evaluateSection18EffectiveWeek({
      contract,
      workouts,
      weekStart: week.weekStart,
    });
    return buildJournalWeekStatus(evaluation.blockingViolations);
  }, [currentMicrocycle, weekDays, week.weekStart]);

  // BOTH INPUTS ALREADY EXIST AS INPUTS: the episodes live in the accepted
  // material context, the notes are the athlete's own words from slice 2. This
  // joins them and stores nothing.
  // A SECOND TIME SCALE OVER THE SAME DERIVATIONS — never a second reading of
  // the stores. The month composes from what the load model and the strength
  // owner already produced per week.
  const month = useMemo<JournalMonth>(() => buildJournalMonth({
    weeks: [loadModel.thisWeek, ...loadModel.history],
    // THIS WEEK'S COMPLETION ONLY, and that is a stated limit rather than a
    // silent one: `JournalWork` is derived from the PROJECTION, which exists for
    // this week and no past one. So consistency is honest about how many weeks
    // it counted (`weeksCounted`) instead of implying a month it cannot see.
    work: [{
      weekStart: week.weekStart,
      sessionsPlanned: week.work.sessionsPlanned,
      completedFull: week.work.completedFull,
      completedPartial: week.work.completedPartial,
    }],
    flags: [{
      weekStart: week.weekStart,
      sorenessRecorded: week.felt.sorenessRecorded,
      differedFromPlan: week.felt.differedFromPlan,
      gameFeelsRecorded: week.felt.gameFeelsRecorded,
    }],
    strengthSeries: buildJournalStrengthSeries({
      weekStart: week.weekStart,
      weeks: 12,
      sessions: Object.entries(sessionFeedback ?? {}).map(([date, feedback]) => ({
        date,
        strength: feedback?.strength ?? [],
      })),
    }),
  }), [loadModel, week.weekStart, sessionFeedback]);

  // THE LEDGER IS AN INPUT — the athlete's own decisions, appended and never
  // rewritten. Reading it is a read; nothing here writes or interprets.
  const changes = useMemo<JournalChanges>(() => buildJournalChanges({
    entries: ledgerEntries,
    weekDates: new Set(week.days.map((day) => day.date)),
  }), [ledgerEntries, week.days]);

  const niggles = useMemo<JournalNiggleHistory>(() => buildJournalNiggleHistory({
    episodes: injuryEpisodes,
    // MAPPED AT THE SURFACE, DELIBERATELY. `rules/` may not read the note store
    // at all — notes never derive program state — so the derivation takes a
    // narrow structural view and this is where the store's shape stops.
    notes: journalNotes.map((n) => ({
      id: n.id, weekStart: n.weekStart, text: n.text, tags: n.tags,
    })),
  }), [injuryEpisodes, journalNotes]);

  const strengthLifts = useMemo<readonly StrengthLiftTrend[]>(() => buildJournalStrengthTrend({
    weekStart: week.weekStart,
    sessions: Object.entries(sessionFeedback ?? {}).map(([date, feedback]) => ({
      date,
      strength: feedback?.strength ?? [],
    })),
  }), [week.weekStart, sessionFeedback]);

  const weekLabel = weekRangeLabel(week.weekStart);

  return (
    <SafeAreaView style={styles.root} testID="journal-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="h2" style={styles.heading}>Journal</Text>
          {weekLabel !== null ? (
            <Text variant="bodySmallEmphasis" style={styles.weekLabel} testID="journal-week-label">
              {weekLabel}
            </Text>
          ) : null}
        </View>

        {/*
          ────────────────────────────────────────────────────────────────
          THE HERO. Status headline, the week's job under it, the credit line
          on weeks a change happened, and the load band. Sam's ruling, in his
          order, and the only block on the screen that is not exception-based —
          a week always has a job, even if that job is "no plan recorded".
        */}
        <Card style={styles.hero} testID="journal-hero">
          <Text variant="overline" style={styles.kicker}>This week</Text>
          <WeekStatus status={weekStatus} />
          <WeekJob job={weekJob} />
          <WhatChanged changes={changes} />
          <LoadSection week={week} load={loadModel} />
        </Card>

        {/* WHAT THE WEEK HELD, above the count of it — batch 23-c's order. */}
        <WeekKinds week={week} />

        <StatStrip week={week} load={loadModel} />
        <DidTheWorkHappen week={week} />
        <HowTheWeekFelt week={week} />

        <Card style={styles.card} testID="journal-week-card">
          <WeekShapeStrip days={week.days} />
        </Card>

        {/*
          EARNED CARDS SIT ABOVE THE LIFTS — "attention beats routine", the
          ruling's own reason. Everything in here is absent on an ordinary week.
        */}
        <AttentionCards
          observations={signedValue(loadModel.regionObservations) ?? []}
          balance={signedValue(loadModel.patternBalance)}
          niggles={niggles}
        />

        <StrengthLines lifts={strengthLifts} />

        <MonthDrawer
          month={month}
          balance={signedValue(loadModel.patternSharesDone)}
          viewedWeekStart={week.weekStart}
        />

        <Card style={styles.card} testID="journal-note-card">
          <WeekNote weekStart={week.weekStart} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * How many distinct WEEKS the athlete has recorded anything in.
 *
 * Counted from the recorded dates rather than from a stored counter, because a
 * stored counter would be derived state — the exact thing the north star
 * presumes wrong. Weeks are keyed by their Monday so the count means "weeks
 * with any record", not "days".
 *
 * THE MONDAY ARITHMETIC IS NOT REPEATED HERE ANY MORE. It used to be inlined,
 * and the load model needs the same answer to group history into weeks — two
 * copies of a week boundary is `week-identity-two-owners` in miniature, so both
 * readers now ask `journalWeekStartOf`.
 */
function countWeeksOfHistory(
  sessionFeedback: Record<string, unknown> | undefined,
): number {
  if (!sessionFeedback) return 0;
  const mondays = new Set<string>();
  for (const dateStr of Object.keys(sessionFeedback)) {
    const weekStart = journalWeekStartOf(dateStr);
    if (weekStart !== null) mondays.add(weekStart);
  }
  return mondays.size;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  heading: { color: colors.text.primary },
  weekLabel: { color: colors.text.secondary },
  body: { color: colors.text.primary },
  muted: { color: colors.text.secondary },
  faint: { color: colors.text.tertiary },

  // ── The hero ──
  hero: { gap: spacing.xs },
  kicker: { color: colors.text.accent },
  heroHeadline: { color: colors.text.primary, marginTop: spacing.xs },
  heroJob: { color: colors.text.secondary },
  creditBlock: { gap: spacing.xs, marginTop: spacing.xs },
  creditRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  creditDot: {
    backgroundColor: colors.status.success,
    borderRadius: borderRadius.full,
    height: 6,
    width: 6,
  },

  // ── The load band ──
  bandBlock: { gap: spacing.xs, marginTop: spacing.sm },
  bandHeader: { gap: spacing.xs },
  bandLabel: { color: colors.text.tertiary },
  track: {
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.full,
    height: 12,
    marginTop: spacing.sm,
  },
  trackZone: {
    backgroundColor: colors.accent.limeDark,
    borderRadius: borderRadius.full,
    bottom: 0,
    opacity: 0.35,
    position: 'absolute',
    top: 0,
  },
  trackMarker: {
    backgroundColor: colors.text.accent,
    borderColor: colors.surface.primary,
    borderRadius: borderRadius.full,
    borderWidth: 3,
    height: LOAD_MARKER_SIZE,
    // Pulled back by half its own width so it sits ON the ratio, not beside it.
    marginLeft: -LOAD_MARKER_SIZE / 2,
    position: 'absolute',
    top: -3,
    width: LOAD_MARKER_SIZE,
  },

  // ── The stat strip ──
  statStrip: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    alignItems: 'center',
    backgroundColor: colors.card.background,
    borderColor: colors.card.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  statValueRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.xs },
  statValue: { color: colors.text.primary },
  statName: { color: colors.text.tertiary },

  exceptionLines: { gap: spacing.xs },

  // ── Cards ──
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text.tertiary },
  earned: { borderColor: colors.text.accent, gap: spacing.xs },
  earnedStack: { gap: spacing.sm },

  // ── The week bars ──
  strip: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  stripDay: { alignItems: 'center', flex: 1, gap: spacing.xs },
  stripWeekday: { color: colors.text.tertiary },
  barWell: { height: BAR_WELL_HEIGHT, justifyContent: 'flex-end', width: '100%' },
  bar: { borderRadius: borderRadius.sm, width: '100%' },

  // ── The lifts ──
  liftRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liftRight: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  liftArrow: { width: 14 },

  // ── The month drawer ──
  drawerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drawerText: { gap: spacing.xs },
  drawerBody: { gap: spacing.sm },
  chevron: { color: colors.text.tertiary },

  // ── The note ──
  noteBlock: { gap: spacing.sm },
  noteComposer: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  noteInput: {
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.md,
    color: colors.text.primary,
    flex: 1,
    minHeight: 44,
    padding: spacing.sm,
    textAlignVertical: 'top',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    borderColor: colors.surface.tertiary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagOn: { backgroundColor: colors.text.accent, borderColor: colors.text.accent },
  tagText: { color: colors.text.secondary },
  tagTextOn: { color: colors.text.inverse },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.text.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  saveButtonOff: { opacity: 0.4 },
  saveButtonText: { color: colors.text.inverse },
  noteRow: {
    borderTopColor: colors.surface.tertiary,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
});
