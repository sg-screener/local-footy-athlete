import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { KeyboardSafeArea } from '../../components/keyboard/KeyboardSafeArea';
import {
  COACH_TAB_COPY,
  coachFailureReply,
  coachGreeting,
} from '../../rules/coachTabCopy';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { useActiveModifiers } from '../../hooks/useActiveModifiers';
import { LfaWordmark } from '../../components/branding/LfaWordmark';
import { colors } from '../../theme/colors';
import { borderRadius, spacing, spacingValues } from '../../theme/spacing';
import { useCoachWeeklyCommitment } from './useCoachWeeklyCommitment';
import { CommitmentCard } from '../../components/CommitmentCard';
import {
  commitmentConfirmedSentence,
  commitmentDeclinedSentence,
  commitmentFailedSentence,
  commitmentPreviewDaySentence,
  commitmentPreviewUnavailableSentence,
} from '../../rules/projectionCopy';
import { useLiveAthleteSnapshot } from './useLiveAthleteSnapshot';
import { askCoachReadOnly, coachChatFailureCode } from '../../services/api/coachChat';
import {
  appendCoachConversation,
  readCoachConversation,
  useCoachConversation,
  type CoachConversationTurn,
} from '../../utils/coachConversationSession';
import {
  COACH_CHAT_MAX_MESSAGE_CHARACTERS,
  coachChatMessageWithinLimit,
} from '../../rules/coachChatLimits';

/**
 * THE COACH TAB — SLICE 1. IT TALKS, AND IT CHANGES NOTHING.
 *
 * docs/COACH_REBUILD_KICKOFF_2026-08-09.md, S1: *"Coach tab restored at the
 * navigation owner. Conversation shell to L-C3's bar. SHORT opener composed
 * from real data — read-only, zero mutation paths. All copy PROPOSED."*
 *
 * **THE COPY IS NO LONGER PROPOSED.** Sam ruled batch 30 on 2026-08-09 and gave
 * the greeting in his own words. On 2026-08-11 Sam simplified the empty
 * conversation to that greeting alone; schedule context belongs in answers to
 * athlete questions, not a second automatic message or a starter chip.
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
 * ## THE REBUILT CONVERSATION IS READ-ONLY TERRA
 *
 * The screen hands one live Snapshot plus bounded recent turns to the one
 * `askCoachReadOnly` door. The server owns the model, canonical retrieval,
 * instructions and empty-action schema. This screen cannot reach a program
 * mutation path, and a model answer cannot smuggle one back in.
 *
 * ## R-105 — THE WEEKLY-REDUCTION CONVERSATION LIVES HERE NOW
 *
 * **Sam, 2026-08-19, seeing it on the Program screen:** *"This should not be
 * popping up on the main page - it should show up in the coaches chat with a
 * notification"*.
 *
 * These system-raised controls still reach `confirmWeeklyCommitment` /
 * `declineWeeklyCommitment` through `useCoachWeeklyCommitment`. They are not an
 * AI action and the model cannot create or confirm one.
 *
 * Both of those functions live in `store/weeklyCommitmentAnswer.ts` and rebuild
 * through `commitProfileProgramTransaction` — the canonical accepted-program
 * transaction. **This screen does not know how to rebuild a program and has no
 * import that could.**
 *
 * The NOTIFICATION is derived with the question (R-099), so there is no unread
 * flag to clear and nothing that can resurrect an answered question.
 *
 * ## ONE CHIP, NOT THREE
 *
 * The mock's three chips were held at slice 1 with a reason: *"three
 * affordances that answer 'I don't have an answer for that yet' is a worse
 * first impression than an honest empty conversation."* One kind is built, so
 * one chip has somewhere to send. The reason has not changed for the other two;
 * they arrive with their kinds.
 */

/** One line of the conversation. Not persisted, not a decision, not a record. */
type CoachTurn = CoachConversationTurn;

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
  // BOTH HALVES COME FROM ONE PROJECTION. `weekDays` feeds the existing modifier
  // selector and `visibleWeek` is the athlete-facing projection carried by the
  // Snapshot; neither the dashboard nor Terra derives another week.
  const { weekDays, visibleWeek } = useResolvedWeek();
  // MY STATUS IS THE FACT SURFACE, NOT A PROGRAM-EFFECT PROOF SURFACE.
  // Program passes its visible week into this selector so a day/week notice is
  // shown only when that week visibly carries the adjustment. My Status must
  // deliberately remain unfiltered: if generation fails or the athlete is
  // viewing another week, a saved injury is still a saved injury and its only
  // status/control surface cannot disappear with the program output. This was
  // already the written ruling in `useHomeScreen`; the old argument below was
  // the implementation contradicting it.
  const { modifiers } = useActiveModifiers();
  // ONE LIVE PICTURE FOR THE CONVERSATION. Progress renders the same live
  // derivation on its own tab; Coach keeps readiness and consistency available
  // to Terra without turning them back into visible dashboard furniture.
  const snapshot = useLiveAthleteSnapshot({
    weekDays,
    visibleWeek,
    activeModifiers: modifiers,
  });
  // R-105. Derived every render from the stores; no unread flag, no expiry job.
  const weeklyCommitment = useCoachWeeklyCommitment();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  // R-399: the words as they arrive. Not a turn until the checked answer
  // lands (then `say` appends it); withdrawn if the check fails.
  const [streaming, setStreaming] = useState<string | null>(null);
  // R-398: the conversation is the app session — it lives in the in-memory
  // holder, survives leaving the tab, and dies with the process.
  const turns = useCoachConversation();
  const [isSending, setIsSending] = useState(false);

  // ── THE CONVERSATION FOLLOWS THE ATHLETE, NOT THE OTHER WAY ROUND ──────────
  //
  // SAM'S DEVICE, 2026-08-09: *"it doesn't scroll down - so when I'm typing a
  // new question after a few questions I can't see the answers."*
  //
  // A REF AND NOT STATE, because this is read inside a scroll handler that runs
  // on every frame and must not re-render the conversation to record where it
  // is. `true` initially: an empty conversation is at its bottom.
  // Sending a message explicitly hands ownership to the conversation bottom.
  const atBottomRef = useRef(false);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // A TOLERANCE, because an exact equality is never true on a real device:
    // rubber-banding, fractional layout and the inertial tail all land a few
    // points short, and "a few points short" must still count as at the bottom
    // or the list stops following after the athlete's first flick.
    atBottomRef.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 24;
  }, []);
  const pinToBottom = useCallback((animated: boolean) => {
    if (!atBottomRef.current) return;
    scrollRef.current?.scrollToEnd({ animated });
  }, []);

  // THE KEYPAD OPENING SHRINKS THE LIST, AND A SHRUNK LIST IS NO LONGER AT ITS
  // BOTTOM. `didShow` rather than `willShow`: the body's inset rides the same
  // native keyboard frame, so the frame is only final once the keyboard is, and
  // scrolling to a bottom that is about to move is scrolling to the wrong place.
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => pinToBottom(false));
    return () => subscription.remove();
  }, [pinToBottom]);

  const trimmed = draft.trim();
  const canSend = coachChatMessageWithinLimit(trimmed) && !isSending;

  /** One coach sentence appended to the conversation. No wording happens here. */
  const say = useCallback((text: string) => {
    appendCoachConversation({ id: `coach-${readCoachConversation().length}`, speaker: 'coach', text });
  }, []);

  const send = useCallback(async (message: string) => {
    if (!coachChatMessageWithinLimit(message) || isSending) return;
    const recentTurns = turns.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    }));
    atBottomRef.current = true;
    appendCoachConversation({ id: `athlete-${readCoachConversation().length}`, speaker: 'athlete', text: message });
    setDraft('');
    setIsSending(true);
    setStreaming('');
    try {
      const answer = await askCoachReadOnly({
        message,
        snapshot,
        conversationContext: {
          activeProgramTarget: null,
          recentTurns,
        },
        onDelta: (messageSoFar) => {
          setStreaming(messageSoFar);
          pinToBottom(false);
        },
      });
      say(answer);
    } catch (error) {
      const failure = coachChatFailureCode(error);
      if (failure === 'refused') {
        // Never log the athlete's question or the model's answer. The typed
        // event is enough to distinguish a safety refusal from an outage.
        console.warn('[coach-chat] response refused by the read-only truth contract');
      }
      say(coachFailureReply(failure));
    } finally {
      setStreaming(null);
      setIsSending(false);
    }
  }, [isSending, turns, snapshot, say, pinToBottom]);

  const handleSend = useCallback(() => { void send(draft.trim()); }, [draft, send]);

  /**
   * THE ATHLETE SAID YES TO A NEW WEEKLY COMMITMENT.
   *
   * ⚠ **THE CONFIRMATION IS GATED ON THE TRANSACTION'S OWN ANSWER, NOT ON THE
   * TAP.** `confirmWeeklyCommitment` returns the accepted-state transaction's
   * result and, when it wrote one, the commitment it actually committed. The
   * coach speaks the DOOR's count, and only when the door says both `ok` and
   * that the program changed. A "Done" spoken because a button was pressed is
   * the false-Done class L6 names as a release blocker.
   */
  const handleCommitmentAccept = useCallback(async (sessionsPerWeek: number) => {
    const result = await weeklyCommitment.accept(sessionsPerWeek);
    if (result?.ok && result.changedProgram && result.committed) {
      say(commitmentConfirmedSentence(result.committed.sessionsPerWeek));
      return;
    }
    say(commitmentFailedSentence());
  }, [weeklyCommitment, say]);

  /**
   * *"Keep it as is."* One ledger entry, no program write, and no way to make
   * one — `declineWeeklyCommitment` imports nothing that can write a program.
   * The entry is what stops the question being put again during this block.
   */
  const handleCommitmentDecline = useCallback(() => {
    weeklyCommitment.decline();
    say(commitmentDeclinedSentence());
  }, [weeklyCommitment, say]);

  // TWO OPENING BUBBLES, AND THE ORDER IS SAM'S RULING (2026-08-09): his own
  // greeting introduces the coach, then the week's shape. Two bubbles rather
  // than one sentence because they answer different questions — WHO is this,
  // and WHAT is this week — and because only the second changes when the week
  // does. The greeting is a constant; re-deriving it beside a live projection
  // would imply it depends on something.
  const composer = (
    <View style={styles.footer}>
      {/* The system-raised commitment card remains above the composer. Terra
          cannot create it, accept it, or return any other action card. */}
      {weeklyCommitment.conversation ? (
        <CommitmentCard
          conversation={weeklyCommitment.conversation}
          onAccept={handleCommitmentAccept}
          onDecline={handleCommitmentDecline}
        />
      ) : null}
      <View style={styles.composer}>
        <AppTextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={COACH_TAB_COPY.placeholder}
          placeholderTextColor={colors.text.tertiary}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          maxLength={COACH_CHAT_MAX_MESSAGE_CHARACTERS}
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
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <KeyboardSafeArea scrollable={false} footer={composer}>
        <View style={styles.header}>
          <LfaWordmark />
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
          // PINS ONLY WHEN THE ATHLETE IS ALREADY AT THE BOTTOM. Scrolling
          // unconditionally would yank them back to the newest turn while they
          // are reading an older one — the same disrespect as not scrolling at
          // all, pointing the other way.
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => pinToBottom(true)}
          testID="coach-tab-conversation"
          accessibilityLabel={COACH_TAB_COPY.conversationAccessibilityLabel}
        >
          <Bubble speaker="coach" text={coachGreeting()} testID="coach-tab-greeting" />
          {/* ── R-105 + R-178: THE COACH ASKS DIRECTLY ──
              The signed question, then — for the extra-session offer — exactly
              what the REGENERATED week becomes, read off the program acceptance
              publishes. The tab dot remains the notification; an extra bubble
              announcing that a question follows is redundant. These sit above
              the athlete's turns because the coach raised the subject; they are
              derived, so answering makes them go and a relaunch cannot bring an
              answered question back. */}
          {weeklyCommitment.conversation ? (
            <>
              <Bubble
                speaker="coach"
                text={String(weeklyCommitment.conversation.sentence)}
                testID="coach-tab-commitment-question"
              />
              {weeklyCommitment.conversation.preview?.changedDays.map((day) => (
                <Bubble
                  key={day.dateISO}
                  speaker="coach"
                  text={String(commitmentPreviewDaySentence(day))}
                  testID={`coach-tab-commitment-preview-${day.dateISO}`}
                />
              ))}
              {weeklyCommitment.conversation.previewRefusal ? (
                <Bubble
                  speaker="coach"
                  text={String(commitmentPreviewUnavailableSentence())}
                  testID="coach-tab-commitment-preview-unavailable"
                />
              ) : null}
            </>
          ) : null}
          {turns.map((turn) => (
            <Bubble
              key={turn.id}
              speaker={turn.speaker}
              text={turn.text}
              testID={`coach-tab-turn-${turn.id}`}
            />
          ))}
          {isSending && streaming ? (
            <Bubble speaker="coach" text={streaming} testID="coach-tab-streaming" />
          ) : null}
          {isSending && !streaming ? (
            <View
              style={[styles.bubble, styles.bubbleCoach, styles.thinking]}
              testID="coach-tab-thinking"
            >
              <ActivityIndicator color={colors.accent.lime} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardSafeArea>
    </SafeAreaView>
  );
}

/* `EMPTY_EQUIPMENT_FACT_IDS` RETIRED 2026-08-12 (SEAT_INBOX item 8).
 *
 * It was never a harmless placeholder. `ActiveModifiersSection` uses that set to
 * choose the equipment-specific testIDs for `clear_adjustment` and
 * `update_adjustment` — so an empty set did not disable those ids, it silently
 * swapped them for the fallback, and the one screen that owns those controls
 * advertised coordinates nothing could resolve. `useActiveModifiers` now derives
 * the real set from the same snapshot it derives the modifiers from, which is
 * the fix `modifiers` itself got when that hook was written. */


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
      <Text style={styles.bubbleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
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
    maxWidth: '82%',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacingValues.smmd,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  bubbleText: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
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
  thinking: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The composer stays inside the keyboard-riding footer.
  footer: {
    backgroundColor: colors.surface.primary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    // Sam's run-5 ruling — the control keeps a small breathing gap above the
    // keypad rather than sitting flush against it. `spacing.sm` IS that 8px, so
    // the gap is the app's token and not a second magic number beside it.
    marginBottom: spacing.sm,
    padding: spacing.xs,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    backgroundColor: colors.surface.secondary,
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderWidth: 0,
    color: colors.text.primary,
  },
  send: {
    // 44 square: the smallest control iOS considers reliably tappable, and the
    // answer to L-C3's "no dead tap zones" for a glyph button.
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
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
