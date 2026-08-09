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
import { evaluateSection18EffectiveWeek } from '../../rules/section18EffectiveWeekEvaluator';
import { buildJournalMonth, type JournalMonth } from '../../rules/journalMonth';
import { TrendChart } from '../../components/journal/TrendChart';
import {
  buildJournalNiggleHistory,
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
  type PatternShare,
  type PlannedLift,
} from '../../rules/journalLoad';

/**
 * THE JOURNAL — slice 1 (this week, read-only) + slice 2 (the week note).
 *
 * EVERYTHING SHOWN IS DERIVED; THE ONE THING WRITTEN IS AN ANSWER. Every number
 * on this screen is derived on read by `rules/journalWeek.ts` from facts the app
 * already stores. The single write is the athlete's own note, through
 * `recordJournalNote` — one door, and it is an INPUT, which is the only kind of
 * new stored state the north star allows.
 *
 * SLICE 1 ASSERTED "NO WRITER AT ALL", AND THAT WAS TRUE THEN. Slice 2 makes it
 * deliberately false, so the cell was RE-POINTED, not deleted: exactly one door,
 * and still no transaction, no ledger append, no raw store write. A cell that
 * quietly loosens when its own unit lands is how a gate stops meaning anything.
 *
 * NOTES NEVER DERIVE PROGRAM STATE — the design's non-negotiable. Nothing here
 * feeds generation, repair or placement, and `journalNoteStore` exports nothing
 * a resolver reads.
 *
 * WHAT IT DELIBERATELY DOES NOT DO YET (slice boundary, not an oversight):
 * no post-game rating, no "felt different" tap, no load comparison, no monthly
 * review, no niggle history, and NO RESURFACING of old notes at relevant
 * moments — that last one is named as owed in the design and is its own slice.
 * Where the data does not exist yet, this screen says so in words rather than
 * showing a zero.
 *
 * COPY: every athlete-visible sentence below is PROPOSED, NOT SIGNED — recorded
 * as **batch 15** in docs/COPY_SHEET_RULINGS_2026-07-30.md, queued for Sam. They
 * are plain strings rather than `SignedCopy` because nothing here is signed yet;
 * the moment Sam signs the batch they move onto the sheet like every other
 * athlete-visible word.
 *
 * THIS COMMENT ORIGINALLY CITED "batch 13" AND THAT WAS WRONG TWICE: batch 13 is
 * the bucket vocabulary, and no journal batch existed at all — these words
 * shipped UNLISTED, which the sheet's transitional rule forbids ("a string may
 * ship PROPOSED, and it may never ship unlisted"). A citation is a claim; this
 * one pointed at someone else's work and nothing checked it.
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

// ─── The strip ───────────────────────────────────────────────────────────

/**
 * The week-shape strip's letters and colours.
 *
 * Sam ruled the TAXONOMY (hard / moderate / easy / rest / game, 2026-08-08);
 * the single-letter abbreviation and the colour are a presentation choice made
 * here, and both are PROPOSED. The colours reuse the existing intensity tokens
 * rather than inventing a palette — a new colour scale would be a second
 * vocabulary for something the theme already says.
 */
const SHAPE_PRESENTATION: Readonly<Record<JournalDayShape, {
  letter: string; label: string; color: string;
}>> = {
  hard: { letter: 'H', label: 'Hard', color: colors.intensity.high },
  moderate: { letter: 'M', label: 'Moderate', color: colors.intensity.moderate },
  easy: { letter: 'E', label: 'Easy', color: colors.intensity.light },
  game: { letter: 'G', label: 'Game', color: colors.text.accent },
  rest: { letter: '·', label: 'Rest', color: colors.text.tertiary },
};

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeekShapeStrip({ days }: { days: readonly JournalDay[] }) {
  return (
    <View style={styles.strip} testID="journal-week-shape-strip">
      {days.map((day, index) => {
        const presentation = SHAPE_PRESENTATION[day.shape];
        return (
          <View
            key={day.date}
            style={styles.stripDay}
            testID={`journal-strip-day-${day.date}`}
            accessibilityLabel={`${presentation.label} day`}
          >
            <Text variant="labelSmall" style={styles.stripWeekday}>
              {WEEKDAY_INITIALS[index] ?? ''}
            </Text>
            <View style={[styles.stripDot, { borderColor: presentation.color }]}>
              <Text variant="captionEmphasis" style={{ color: presentation.color }}>
                {presentation.letter}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * WHAT KIND OF WORK THE WEEK HELD — PROPOSED (batch 23).
 *
 * The addendum's "key exposures, NOT completion counts": a week of five
 * completed sessions that were all conditioning is a different week from five
 * that were balanced, and the completion line one row down cannot tell them
 * apart.
 *
 * THE WORD "EXPOSURE" NEVER APPEARS. It is in Sam's forbidden vocabulary; these
 * are training words, and a cell asserts it.
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
    <Text variant="body" style={styles.body} testID="journal-week-kinds">
      {`${parts.join(', ')}.`}
    </Text>
  );
}

function DidTheWorkHappen({ week }: { week: JournalWeek }) {
  const { work } = week;

  // PROPOSED copy. "Sessions" deliberately counts easy days — Sam's ruling:
  // easy days "don't effect fatigue but count as sessions".
  if (work.sessionsPlanned === 0) {
    return (
      <Text variant="body" style={styles.body}>
        No sessions planned this week.
      </Text>
    );
  }

  const done = work.completedFull + work.completedPartial;

  return (
    <View>
      <Text variant="body" style={styles.body}>
        {`${done} of ${work.sessionsPlanned} sessions done`}
        {work.completedPartial > 0 ? `, ${work.completedPartial} in part` : ''}
        {'.'}
      </Text>
      {work.skipped > 0 ? (
        <Text variant="body" style={styles.body}>
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

function HowTheWeekFelt({ week }: { week: JournalWeek }) {
  const { felt } = week;

  if (felt.nothingRecorded) {
    // SINGLE UNBROKEN LITERAL, per batch 11's note: the binding gate
    // equality-matches the file, and both an `&apos;` entity and a line break
    // inside a sentence hide it from that match. Both cost a red on this
    // batch's first run.
    return (
      <Text variant="body" style={styles.muted} testID="journal-felt-nothing-recorded">
        {"You haven't recorded how anything felt this week."}
      </Text>
    );
  }

  return (
    <View>
      {felt.feelingsRecorded > 0 ? (
        <Text variant="body" style={styles.body}>
          {`Effort recorded on ${felt.feelingsRecorded} ${
            felt.feelingsRecorded === 1 ? 'session' : 'sessions'}.`}
        </Text>
      ) : null}
      {felt.sorenessRecorded > 0 ? (
        <Text variant="body" style={styles.body}>
          {`Soreness recorded on ${felt.sorenessRecorded} ${
            felt.sorenessRecorded === 1 ? 'session' : 'sessions'}.`}
        </Text>
      ) : null}
      {/*
        THE TWO NEW ANSWERS, COUNTED AND NOT INTERPRETED. The design calls the
        post-game rating the linchpin that powers the observation lines — those
        lines are the monthly review's, and reading a field into a model in the
        same slice that mints it would ship the second half of a feature nobody
        has seen work yet. So the Journal shows that the answers exist and says
        nothing about what they mean.
      */}
      {felt.gameFeelsRecorded > 0 ? (
        <Text variant="body" style={styles.body} testID="journal-felt-game">
          {`Legs and energy rated after ${felt.gameFeelsRecorded} ${
            felt.gameFeelsRecorded === 1 ? 'game' : 'games'}.`}
        </Text>
      ) : null}
      {felt.differedFromPlan > 0 ? (
        <Text variant="body" style={styles.body} testID="journal-felt-differed">
          {felt.differedFromPlan === 1
            ? 'One session did not go as planned.'
            : `${felt.differedFromPlan} sessions did not go as planned.`}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The headline continuum's words. PROPOSED — batch 17.
 *
 * NO RAW AU EVER REACHES THE ATHLETE (the ruling's first law), so the band is
 * spoken, never printed as a score. These lines are written and wired NOW even
 * though nothing renders them yet: they sit behind `signedValue`, and the day
 * Sam signs the band and the stream weighting they appear with no code change.
 */
const HEADLINE_COPY: Readonly<Record<BandVerdict, string>> = {
  below: 'A lighter week than your normal.',
  in: 'About your normal week.',
  above: 'A heavier week than your normal.',
};

/** How many observation lines the section will show. Sam's "no chart walls". */
const MAX_REGION_LINES = 2;

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
 * THE LOAD SECTION — the load slice.
 *
 * WHAT CHANGED, AND WHY IT IS THE ONLY THING THAT COULD: the section used to say
 * nothing but "coming next". It now LEADS with a statement about its own
 * evidence — what load is measured from, and how much of this week it has. That
 * line ships because it is derived from no constant at all: a count of logged
 * sessions needs no signature to be true.
 *
 * EVERYTHING ELSE IS BUILT, TESTED, AND DARK. The headline continuum, the
 * sweet-spot band and the region observations are all downstream of PROPOSED
 * constants, so `signedValue` returns null for them and their lines do not
 * render. This is a mechanism, not a habit — the section cannot read an unsigned
 * number even by accident, because `.value` is not a door it opens.
 *
 * The addendum's data-state rule still holds underneath: "empty space explains
 * what will appear and what's being collected", never a chart with one floating
 * dot.
 */
function LoadSection({ week, load }: { week: JournalWeek; load: JournalLoadModel }) {
  const coverage = signedValue(load.coverage);
  const headline = signedValue(load.headline);
  const observations = (signedValue(load.regionObservations) ?? []).slice(0, MAX_REGION_LINES);

  return (
    <View>
      <Text variant="body" style={styles.body} testID="journal-load-evidence">
        {loadEvidenceLine(coverage)}
      </Text>

      {/*
        RIDER 1 AGAIN, ONE LAYER DOWN. A lift with no weight recorded cannot be
        counted, and the section says so rather than letting the athlete read a
        smaller number as a smaller week.
      */}
      {coverage !== null && coverage.liftsUnmeasured > 0 ? (
        <Text variant="bodySmall" style={styles.muted} testID="journal-load-unmeasured">
          {'Some lifts had no weight recorded, so they sit outside that.'}
        </Text>
      ) : null}

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
          <Text variant="body" style={styles.muted} testID="journal-load-building">
            Your normal is ready to compare against — that comparison is coming next.
          </Text>
        ) : (
          <Text variant="body" style={styles.muted} testID="journal-load-building">
            Once you have a few more weeks logged, this shows how the week compared with your normal.
          </Text>
        )
      ) : (
        <Text variant="body" style={styles.body} testID="journal-load-headline">
          {HEADLINE_COPY[headline.band]}
        </Text>
      )}

      {/*
        OBSERVATION, NEVER DIAGNOSIS (the ruling's second law). An ordering fact
        beside the weeks it was measured over — no injury-risk claim, no advice.
      */}
      {observations.map((observation) => (
        <Text
          key={observation.region}
          variant="bodySmall"
          style={styles.muted}
          testID="journal-load-region"
        >
          {`Biggest week for ${observation.region} in the last ${observation.weeksCompared} weeks.`}
        </Text>
      ))}
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
 * "Did the work happen" one section down already answers the completion question
 * from recorded outcomes, so the athlete is not left without one.
 */
/**
 * WEEK STATUS — one calm line, PROPOSED (batch 24).
 *
 * EVERY NUMBER BEHIND THIS WAS DERIVED THIS TURN. The status comes from
 * `evaluateSection18EffectiveWeek`, which builds a fresh ledger from THIS week's
 * workouts — not from the contract's stored tallies, which a gate rightly
 * refused because a stored tally goes stale beside the facts it came from.
 */
function WeekStatus({ status }: { status: JournalWeekStatus | null }) {
  if (status === null) return null;
  if (status.onTrack) {
    return (
      <Text variant="body" style={styles.body} testID="journal-status-on-track">
        {'The week is on track.'}
      </Text>
    );
  }
  return (
    <Text variant="body" style={styles.body} testID="journal-status-gaps">
      {`Still outstanding: ${status.gaps.map((gap) => gap.athleteWord).join(', ')}.`}
    </Text>
  );
}

function WeekJob({ job }: { job: JournalWeekJob | null }) {
  if (job === null) {
    return (
      <Text variant="body" style={styles.muted} testID="journal-job-none">
        {'No plan recorded for this week.'}
      </Text>
    );
  }

  const asks = job.asks.map((ask) => `${ask.target} ${ask.athleteWord}`).join(', ');

  return (
    <Text variant="body" style={styles.body} testID="journal-job-asks">
      {`This week asks for ${asks}.`}
    </Text>
  );
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
}: {
  month: JournalMonth;
  /** Completed pattern shares, or null while their provenance is unsigned. */
  balance: readonly PatternShare[] | null;
}) {
  if (month.building) {
    return (
      <Text variant="body" style={styles.muted} testID="journal-month-building">
        {'This builds as you train. A few more weeks and your trends appear here.'}
      </Text>
    );
  }

  // ONE LIFT, NOT ALL OF THEM — the lift with the most history, because a screen
  // of five identical charts is the wall Sam ruled against.
  const [topLift] = Array.from(month.strengthSeries.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return (
    <View>
      {/*
        CONSISTENCY WITH ITS DENOMINATOR ATTACHED. "80%" over five sessions and
        over fifty are different facts wearing one number, so the count travels
        with the percentage rather than behind a tap.
      */}
      {month.consistency ? (
        <Text variant="body" style={styles.body} testID="journal-month-consistency">
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
        <Text variant="body" style={styles.body} testID="journal-month-flags">
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
        <Text variant="body" style={styles.body} testID="journal-month-balance">
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
      {month.gains.slice(0, 1).map((gain) => (
        <Text
          key={gain.exerciseName}
          variant="body"
          style={styles.body}
          testID="journal-month-gain"
        >
          {gain.deltaKg > 0
            ? `You have added ${gain.deltaKg}kg to your ${gain.exerciseName} since ${gain.fromWeekStart}.`
            : `Your ${gain.exerciseName} is ${Math.abs(gain.deltaKg)}kg lighter than ${gain.fromWeekStart}.`}
        </Text>
      ))}
    </View>
  );
}

/**
 * NIGGLES, AND WHAT THE ATHLETE WROTE LAST TIME — PROPOSED (batch 21).
 *
 * OBSERVATION, NEVER DIAGNOSIS (the load ruling's second law, verbatim). A
 * resurfaced note sits BESIDE the niggle as something the athlete said before,
 * never as a cause of it — so the line that introduces it states only when it was
 * written, and the note itself is their own words, returned unread.
 */
function Niggles({ history }: { history: JournalNiggleHistory }) {
  if (history.regions.length === 0) {
    return (
      <Text variant="body" style={styles.muted} testID="journal-niggles-none">
        {'No niggles recorded.'}
      </Text>
    );
  }
  return (
    <View>
      {history.regions.map((region) => (
        <Text
          key={region.region}
          variant="body"
          style={styles.body}
          testID={`journal-niggle-${region.region}`}
        >
          {`${region.region} — ${region.episodes.length} ${
            region.episodes.length === 1 ? 'episode' : 'episodes'}${
            region.active ? ', going now' : ''}.`}
        </Text>
      ))}
      {history.resurfaced.map((entry) => (
        <View
          key={`${entry.episodeId}-${entry.note.id}`}
          style={styles.noteRow}
          testID="journal-niggle-resurfaced"
        >
          <Text variant="bodySmall" style={styles.muted}>
            {`You wrote this the last time your ${entry.region} flared:`}
          </Text>
          <Text variant="body" style={styles.body}>{entry.note.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * ARROWS AS WORDS, PROPOSED (batch 19). A glyph alone is not readable by a
 * screen reader and not legible at small sizes; the word carries the meaning and
 * the symbol carries the glance.
 */
const TREND_COPY: Readonly<Record<StrengthLiftTrend['direction'], string>> = {
  up: 'up on last week',
  flat: 'same as last week',
  down: 'down on last week',
  new: 'first time this week',
};

/**
 * THE STRENGTH LINE — Monday card item 2, and the first Journal line that ships
 * a NUMBER to the athlete.
 *
 * It can, where the load model's cannot, because it waits on no constant: "10kg
 * heavier than last week" is a comparison of two recorded weights, not a
 * judgement against a threshold Sam has yet to sign.
 */
function StrengthLines({ lifts }: { lifts: readonly StrengthLiftTrend[] }) {
  if (lifts.length === 0) {
    return (
      <Text variant="body" style={styles.muted} testID="journal-strength-none">
        {'No lifts recorded with a weight this week.'}
      </Text>
    );
  }
  return (
    <View>
      {lifts.map((lift) => (
        <Text
          key={lift.exerciseName}
          variant="body"
          style={styles.body}
          testID={`journal-strength-${lift.exerciseName}`}
        >
          {`${lift.exerciseName} — ${lift.thisWeek.weightKg}kg, ${TREND_COPY[lift.direction]}.`}
        </Text>
      ))}
    </View>
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
    <View>
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
      <TouchableOpacity
        onPress={save}
        disabled={!canSave}
        style={[styles.saveButton, canSave ? null : styles.saveButtonOff]}
        testID="journal-note-save"
        accessibilityRole="button"
      >
        <Text variant="buttonSmall" style={styles.saveButtonText}>Save note</Text>
      </TouchableOpacity>

      {weekNotes.length === 0 ? (
        <Text variant="bodySmall" style={styles.muted} testID="journal-no-notes-yet">
          {'No notes yet this week.'}
        </Text>
      ) : (
        weekNotes.map((note) => (
          <View key={note.id} style={styles.noteRow} testID={`journal-note-${note.id}`}>
            <Text variant="body" style={styles.body}>{note.text}</Text>
            {note.tags.length > 0 ? (
              <Text variant="caption" style={styles.muted}>
                {note.tags.map((tag) => TAG_LABELS[tag]).join(' · ')}
              </Text>
            ) : null}
          </View>
        ))
      )}
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

  return (
    <SafeAreaView style={styles.root} testID="journal-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="h2" style={styles.heading}>Journal</Text>
        {/* PROPOSED copy, batch 13. */}
        <Text variant="bodySmall" style={styles.muted}>This week</Text>

        <WeekShapeStrip days={week.days} />

        <Section title="This week's job">
          <WeekJob job={weekJob} />
          <WeekStatus status={weekStatus} />
        </Section>

        <Section title="Did the work happen">
          {/*
            WHAT it was, then WHETHER it happened. The addendum's distinction,
            in that order because the composition is the context for the count.
          */}
          <WeekKinds week={week} />
          <DidTheWorkHappen week={week} />
        </Section>

        <Section title="How the week felt">
          <HowTheWeekFelt week={week} />
        </Section>

        <Section title="Your lifts">
          <StrengthLines lifts={strengthLifts} />
        </Section>

        <Section title="Load">
          <LoadSection week={week} load={loadModel} />
        </Section>

        <Section title="Your month">
          <MonthlyReview
            month={month}
            balance={signedValue(loadModel.patternSharesDone)}
          />
        </Section>

        <Section title="Niggles">
          <Niggles history={niggles} />
        </Section>

        <Section title="Your note">
          <WeekNote weekStart={week.weekStart} />
        </Section>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  heading: { color: colors.text.primary },
  body: { color: colors.text.primary },
  muted: { color: colors.text.secondary },
  section: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.text.tertiary },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  stripDay: { alignItems: 'center', gap: spacing.xs },
  stripWeekday: { color: colors.text.tertiary },
  noteInput: {
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.md,
    color: colors.text.primary,
    minHeight: 72,
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
  stripDot: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
