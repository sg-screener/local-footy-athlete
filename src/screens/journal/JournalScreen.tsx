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
import {
  buildJournalLoadModel,
  journalWeekStartOf,
  signedValue,
  type BandVerdict,
  type JournalLoadCoverage,
  type JournalLoadModel,
  type JournalLoadSessionInput,
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
          <LoadSection week={week} load={loadModel} />
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
