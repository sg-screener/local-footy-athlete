import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { useAthleteContext, useResolvedWeek } from '../../hooks/useSchedule';
import { useProgramStore } from '../../store/programStore';
import { countWeeklyExposures } from '../../rules/weeklyExposureCounts';
import {
  buildJournalWeek,
  type JournalDay,
  type JournalDayShape,
  type JournalSessionOutcome,
  type JournalWeek,
} from '../../rules/journalWeek';

/**
 * THE JOURNAL — slice 1: the tab, and this week, read-only.
 *
 * THIS SCREEN IS A READING SURFACE AND NOTHING ELSE. It opens no door, commits
 * no transaction and stores nothing. Every number on it is derived on read by
 * `rules/journalWeek.ts` from facts the app already stores as inputs — which is
 * the north star stated as a feature rather than as an architecture note.
 *
 * WHAT IT DELIBERATELY DOES NOT DO YET (slice 1 boundary, not an oversight):
 * no note input, no post-game rating, no "felt different" tap, no load
 * comparison, no monthly review, no niggle history. Each of those is either a
 * new input or a derivation over recorded history, and both belong to later
 * slices. Where the data does not exist yet, this screen says so in words
 * rather than showing a zero.
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
    </View>
  );
}

/**
 * THE BUILDING STATE — addendum item 11, and the reason it is a component
 * rather than a bare `null`: "empty space explains what will appear and what's
 * being collected", never a chart with one floating dot.
 */
function LoadSection({ week }: { week: JournalWeek }) {
  if (!week.load.comparisonAvailable) {
    return (
      <Text variant="body" style={styles.muted} testID="journal-load-building">
        {'Your Journal is building. Once you have a few weeks logged, this shows how the week compared with your normal.'}
      </Text>
    );
  }
  // The comparison itself is a later slice. Until it exists, the honest state
  // is the only state — a number with nothing to compare it to would be worse
  // than silence.
  return (
    <Text variant="body" style={styles.muted} testID="journal-load-building">
      Comparing this week with your normal is coming next.
    </Text>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────

export default function JournalScreen() {
  // `useResolvedWeek` is the ONE hook that resolves the week and projects it —
  // its own header says to call this rather than `project()`, "because two call
  // sites is two chances to pass different inputs".
  const { weekDays, visibleWeek } = useResolvedWeek();
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
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

  return (
    <SafeAreaView style={styles.root} testID="journal-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="h2" style={styles.heading}>Journal</Text>
        {/* PROPOSED copy, batch 13. */}
        <Text variant="bodySmall" style={styles.muted}>This week</Text>

        <WeekShapeStrip days={week.days} />

        <Section title="Did the work happen">
          <DidTheWorkHappen week={week} />
        </Section>

        <Section title="How the week felt">
          <HowTheWeekFelt week={week} />
        </Section>

        <Section title="Load">
          <LoadSection week={week} />
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
 */
function countWeeksOfHistory(
  sessionFeedback: Record<string, unknown> | undefined,
): number {
  if (!sessionFeedback) return 0;
  const mondays = new Set<string>();
  for (const dateStr of Object.keys(sessionFeedback)) {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const dayOfWeek = date.getDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    date.setDate(date.getDate() - offsetToMonday);
    mondays.add(date.toISOString().slice(0, 10));
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
  stripDot: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
