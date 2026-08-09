import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { KeyboardSafeArea } from '../../components/keyboard/KeyboardSafeArea';
import { coachOpener } from '../../rules/coachOpener';
import { COACH_TAB_COPY, coachGreeting } from '../../rules/coachTabCopy';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { colors } from '../../theme/colors';
import { borderRadius, spacing, spacingValues } from '../../theme/spacing';
import { todayISOLocal } from '../../utils/appDate';

/**
 * THE COACH TAB — SLICE 1. IT TALKS, AND IT CHANGES NOTHING.
 *
 * docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S1: *"Coach tab restored at the
 * navigation owner. Conversation shell to L-C3's bar. SHORT opener composed
 * from real data — read-only, zero mutation paths. All copy PROPOSED."*
 *
 * **THE COPY IS NO LONGER PROPOSED.** Sam ruled batch 30 on 2026-08-09 and gave
 * the greeting in his own words; it opens the conversation and the week-shape
 * line follows it as the second bubble. See `rules/coachTabCopy`.
 *
 * ## THIS IS NOT `CoachScreen`, AND THAT IS THE POINT
 *
 * `screens/coach/CoachScreen.tsx` is the beta chat surface R5.7 cut. It stays
 * frozen in the tree under LR-6 and nothing routes to it. Pointing the restored
 * tab at it would have brought back a mutation-capable pipeline, unsigned copy
 * and ten representations of an athlete sentence on the first day of a rebuild
 * whose whole ruling was that those ten collapse to two. The kickoff says the
 * frozen root is *"retired when S1-S3 replace its every reachable duty — by
 * supersession rather than surgery"*, and supersession starts with a screen
 * that supersedes something.
 *
 * ## WHAT MAKES IT READ-ONLY, STRUCTURALLY RATHER THAN BY CARE
 *
 * This file imports no store, no transaction, no door and no executor. The
 * conversation is component state and dies with the screen — **zero new stored
 * state, north star NEUTRAL**. `coachTabSlice1Tests` asserts the import list
 * itself, because "I did not write a mutation" is a claim about today and an
 * import ban is a claim about every day after it.
 *
 * ## THE OPENER IS DERIVED, NOT COMPOSED HERE
 *
 * The screen asks `useResolvedWeek()` — the same door the Program tab asks —
 * and hands the projection to `coachOpener`. It formats nothing: a surface that
 * assembled the sentence would be a second account of the week, which is the
 * defect ruling 1 retired `summariseDay` to kill.
 *
 * ## L-C3, THE NIKE BAR
 *
 * Sam's ruling 3: *"no hidden enter button behind the keyboard pop ups — i want
 * nike level UI and interaction."* So the composer is the `KeyboardSafeArea`
 * FOOTER, which rides the keypad on the UI thread, and the input is
 * `AppTextInput`, which gives a single-line non-keypad field its `done` submit
 * key. Two independent ways off the keyboard and off the send, at every
 * keyboard state — the composer cannot be occluded because it is positioned
 * against the keyboard rather than laid out above it.
 *
 * The Done accessory bar deliberately does not mount: `KeyboardSafeArea` yields
 * it whenever a footer exists, because both want the strip directly above the
 * keypad and rendering both put the toolbar on top of the CTA (simulator pass,
 * 2026-07-24). Here the send control IS the exit.
 *
 * ## WHAT SLICE 1 DELIBERATELY DOES NOT HAVE
 *
 * The mock's three chips ("Move a session", "Something hurts", "Make this week
 * easier") are not here. They are requests to CHANGE things, and slice 1 has
 * nowhere to send a change; shipping them now would be three affordances that
 * answer "I don't have an answer for that yet", which is a worse first
 * impression than an honest empty conversation. They arrive with S3, behind the
 * change card that L-C2 makes their contract.
 */

/** One line of the conversation. Not persisted, not a decision, not a record. */
interface CoachTurn {
  readonly id: string;
  readonly speaker: 'coach' | 'athlete';
  readonly text: string;
}

function SendIcon({ color }: { color: string }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 19V5" />
      <Path d="M5 12l7-7 7 7" />
    </Svg>
  );
}

export default function CoachTabScreen() {
  const { visibleWeek } = useResolvedWeek();
  const todayISO = todayISOLocal();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<readonly CoachTurn[]>([]);

  // The opener is the conversation's first line and is re-derived whenever the
  // week does — a coach whose greeting went stale after an edit would be the
  // stored-output defect the north star exists to make unrepresentable.
  const opener = useMemo(
    () => coachOpener({ week: visibleWeek, todayISO }),
    [visibleWeek, todayISO],
  );

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0;

  const handleSend = useCallback(() => {
    const message = draft.trim();
    if (message.length === 0) return;
    // SLICE 1'S WHOLE TURN: the athlete is heard and the coach says what is
    // true — it has no answer yet (L-C1). No intent is parsed, nothing is
    // resolved, nothing is written.
    setTurns((previous) => [
      ...previous,
      { id: `athlete-${previous.length}`, speaker: 'athlete', text: message },
      {
        id: `coach-${previous.length}`,
        speaker: 'coach',
        text: COACH_TAB_COPY.noAnswerYet,
      },
    ]);
    setDraft('');
  }, [draft]);

  // TWO OPENING BUBBLES, AND THE ORDER IS SAM'S RULING (2026-08-09): his own
  // greeting introduces the coach, then the week's shape. Two bubbles rather
  // than one sentence because they answer different questions — WHO is this,
  // and WHAT is this week — and because only the second changes when the week
  // does. The greeting is a constant; re-deriving it beside a live projection
  // would imply it depends on something.
  const composer = (
    <View style={styles.composer}>
      <AppTextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder={COACH_TAB_COPY.placeholder}
        placeholderTextColor={colors.text.tertiary}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
        testID="coach-tab-input"
        accessibilityLabel={COACH_TAB_COPY.placeholder}
      />
      <Pressable
        style={[styles.send, canSend ? styles.sendReady : styles.sendIdle]}
        onPress={handleSend}
        disabled={!canSend}
        hitSlop={spacing.sm}
        testID="coach-tab-send"
        accessibilityRole="button"
        accessibilityLabel={COACH_TAB_COPY.sendAccessibilityLabel}
        accessibilityState={{ disabled: !canSend }}
      >
        <SendIcon color={canSend ? colors.text.inverse : colors.text.tertiary} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <KeyboardSafeArea scrollable={false} footer={composer}>
        <View style={styles.header}>
          <Text variant="h1">{COACH_TAB_COPY.title}</Text>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.conversation}
          contentContainerStyle={styles.conversationContent}
          showsVerticalScrollIndicator={false}
          // The chat answer to "get off the keyboard": drag the conversation
          // down and the keypad follows the finger. Taps stay live so the send
          // control never needs a blank-space tap first (dogfood finding E4).
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          testID="coach-tab-conversation"
          accessibilityLabel={COACH_TAB_COPY.conversationAccessibilityLabel}
        >
          <Bubble speaker="coach" text={coachGreeting()} testID="coach-tab-greeting" />
          <Bubble speaker="coach" text={opener.text} testID="coach-tab-opener" />
          {turns.map((turn) => (
            <Bubble
              key={turn.id}
              speaker={turn.speaker}
              text={turn.text}
              testID={`coach-tab-turn-${turn.id}`}
            />
          ))}
        </ScrollView>
      </KeyboardSafeArea>
    </SafeAreaView>
  );
}

function Bubble({
  speaker,
  text,
  testID,
}: {
  speaker: CoachTurn['speaker'];
  text: string;
  testID: string;
}) {
  const isCoach = speaker === 'coach';
  return (
    <View
      style={[styles.bubble, isCoach ? styles.bubbleCoach : styles.bubbleAthlete]}
      testID={testID}
    >
      <Text variant="body">{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  conversation: {
    flex: 1,
  },
  conversationContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacingValues.smmd,
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacingValues.smmd,
    borderWidth: 1,
  },
  bubbleCoach: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface.secondary,
    borderColor: colors.surface.tertiary,
  },
  bubbleAthlete: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary.light,
    borderColor: colors.surface.tertiary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    // Sam's run-5 ruling — the control keeps a small breathing gap above the
    // keypad rather than sitting flush against it. `spacing.sm` IS that 8px, so
    // the gap is the app's token and not a second magic number beside it.
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface.primary,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    color: colors.text.primary,
  },
  send: {
    // 44 square: the smallest control iOS considers reliably tappable, and the
    // answer to L-C3's "no dead tap zones" for a glyph button.
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendReady: {
    backgroundColor: colors.accent.lime,
  },
  sendIdle: {
    backgroundColor: colors.surface.secondary,
  },
});
