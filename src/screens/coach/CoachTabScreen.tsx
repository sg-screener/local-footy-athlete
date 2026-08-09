import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { coachAnswer } from '../../rules/coachAnswer';
import { coachOpener } from '../../rules/coachOpener';
import { readCoachMessage } from '../../rules/coachRead';
import { coachProposal } from '../../rules/coachProposal';
import type { CoachChangeCard } from '../../rules/coachChangeCard';
import { coachChangeDeclined, coachChangeOutcome } from '../../rules/coachChangeOutcome';
import { COACH_CHANGE_COPY, COACH_TAB_COPY, coachGreeting } from '../../rules/coachTabCopy';
import { useResolvedWeek } from '../../hooks/useSchedule';
import { colors } from '../../theme/colors';
import { borderRadius, spacing, spacingValues } from '../../theme/spacing';
import { todayISOLocal } from '../../utils/appDate';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import type { ProgramControlAction } from '../../types/programControlAction';
import type { VisibleWeek } from '../../rules/visibleProjection';

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
 * ## SLICE 2 — IT ANSWERS, AND THE SCREEN STILL DECIDES NOTHING
 *
 * The turn is `lexicalQuestionReader.read(...)` then `coachAnswer(...)`, both
 * pure, both in `rules/`. The screen does not classify, does not resolve a day,
 * does not choose a sentence and has no branch for "the coach had no answer" —
 * the answering rule owns that case, because a screen with its own fallback
 * wording is a second voice one edit away from disagreeing with the first.
 *
 * Still zero mutation paths: the answering layer imports the truth gate and the
 * projection and nothing else, and every reply it produces is validated against
 * a communication with NO applied changes (see `rules/coachAnswer`).
 *
 * ## SLICE 3 — IT CHANGES THINGS, AND THE CARD IS WHY IT IS ALLOWED TO
 *
 * The screen now reaches ONE writer: `executeProgramControlActionDurably`, the
 * athlete's own tap door. That is the whole of slice 3's mutation surface and
 * the import ban is re-aimed rather than lifted — every other writer family is
 * still forbidden, and the one door is asserted by NAME, so a second door
 * arriving is a red cell rather than a diff nobody reads.
 *
 * The chain, and every step of it decides something the screen does not:
 *
 *   message → readCoachMessage()  → question | change request
 *           → coachProposal()     → ProgramControlAction | ask | refusal
 *           → changeCardFor()     → the card, rendered FROM the action
 *           → the athlete's YES
 *           → executeProgramControlActionDurably()   (the door; the ledger
 *             records inside it, and undo covers it because it already covers
 *             the door)
 *           → coachChangeOutcome() → what the coach may claim, gated against
 *             the visible week before and after
 *
 * The screen owns none of those words. It owns two pieces of mechanics: which
 * card is on screen, and the fact that a change is settling.
 *
 * ## THE CARD LIVES IN THE FOOTER, AND THAT IS L-C3 RATHER THAN LAYOUT TASTE
 *
 * Sam's ruling 3: *"I want all the buttons working properly, no hidden enter
 * button behind the keyboard pop ups."* The seat's S3 order made it blocking:
 * *"the card's confirm buttons with keyboard up is the exact Nike case Sam
 * named."*
 *
 * A card rendered as the last bubble in the conversation is a card that can be
 * scrolled — and a keyboard appearing under it is a keyboard covering the
 * athlete's yes. So the card is part of the `KeyboardSafeArea` FOOTER, directly
 * above the composer, riding the keypad on the UI thread exactly as the
 * composer does. **It cannot be occluded because it is positioned against the
 * keyboard rather than laid out above it**, and its buttons are outside the
 * ScrollView, so no tap of theirs is ever spent dismissing a keyboard first.
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

/**
 * A CHANGE THE ATHLETE HAS SAID YES TO, WAITING FOR THE WEEK TO COME BACK.
 *
 * `before` is the visible week AT THE MOMENT OF THE YES. It is captured rather
 * than re-read, because the whole claim the coach is about to make is a
 * comparison, and a comparison whose "before" is fetched after the change is
 * not a comparison at all.
 */
interface SettlingChange {
  readonly action: ProgramControlAction;
  readonly before: VisibleWeek;
  readonly door: { readonly ok: boolean; readonly outcome?: 'applied' | 'no_change' | 'refused'; readonly message?: string };
}

export default function CoachTabScreen() {
  const { visibleWeek } = useResolvedWeek();
  const todayISO = todayISOLocal();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<readonly CoachTurn[]>([]);
  const [pending, setPending] = useState<
    { readonly action: ProgramControlAction; readonly card: CoachChangeCard } | null
  >(null);
  const [settling, setSettling] = useState<SettlingChange | null>(null);

  // ── THE CONVERSATION FOLLOWS THE ATHLETE, NOT THE OTHER WAY ROUND ──────────
  //
  // SAM'S DEVICE, 2026-08-09: *"it doesn't scroll down - so when I'm typing a
  // new question after a few questions I can't see the answers."*
  //
  // A REF AND NOT STATE, because this is read inside a scroll handler that runs
  // on every frame and must not re-render the conversation to record where it
  // is. `true` initially: an empty conversation is at its bottom.
  const atBottomRef = useRef(true);
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

  // The opener is the conversation's first line and is re-derived whenever the
  // week does — a coach whose greeting went stale after an edit would be the
  // stored-output defect the north star exists to make unrepresentable.
  const opener = useMemo(
    () => coachOpener({ week: visibleWeek, todayISO }),
    [visibleWeek, todayISO],
  );

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0;

  /** One coach sentence appended to the conversation. No wording happens here. */
  const say = useCallback((text: string) => {
    setTurns((previous) => [
      ...previous,
      { id: `coach-${previous.length}`, speaker: 'coach', text },
    ]);
  }, []);

  const send = useCallback((message: string) => {
    if (message.length === 0) return;
    setTurns((previous) => [
      ...previous,
      { id: `athlete-${previous.length}`, speaker: 'athlete', text: message },
    ]);
    setDraft('');

    // THE WHOLE TURN, AND IT IS PURE CALLS ALL THE WAY DOWN. One read, then
    // either the answering rule or the proposal rule. The screen has no branch
    // that chooses words — every leaf below returns the sentence it owns.
    const read = readCoachMessage({ message, week: visibleWeek, todayISO });

    if (read.intent === 'question') {
      say(coachAnswer({ question: read.question, week: visibleWeek, todayISO }).text);
      return;
    }

    // NO CARD IS NO CHANGE, AND THE RULE OWNS THAT TOO. `coachProposal` returns
    // an action and its card together or neither, so there is no state here in
    // which the screen holds something executable that it cannot show.
    const proposal = coachProposal({ request: read.request, week: visibleWeek });
    if (proposal.verdict !== 'proposed' || !proposal.action || !proposal.card) {
      say(proposal.text);
      return;
    }
    setPending({ action: proposal.action, card: proposal.card });
  }, [visibleWeek, todayISO, say]);

  const handleSend = useCallback(() => send(draft.trim()), [draft, send]);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    const { action } = pending;
    const before = visibleWeek;
    setPending(null);
    const result = await executeProgramControlActionDurably(action, { todayISO });
    setSettling({
      action,
      before,
      door: { ok: result.ok, outcome: result.outcome, message: result.message },
    });
  }, [pending, visibleWeek, todayISO]);

  const handleCancel = useCallback(() => {
    setPending(null);
    say(coachChangeDeclined());
  }, [say]);

  // THE COACH SPEAKS AFTER THE WEEK COMES BACK, NEVER BEFORE.
  //
  // `setSettling` is what schedules the render that re-reads the store, so by
  // the time this effect runs `visibleWeek` IS the week the athlete is now
  // looking at. Claiming the change from inside `handleConfirm` would mean
  // claiming it against the week captured before the door ran — the door's
  // account of itself wearing a diff's clothes.
  useEffect(() => {
    if (!settling) return;
    say(coachChangeOutcome({
      action: settling.action,
      before: settling.before,
      after: visibleWeek,
      door: settling.door,
    }).text);
    setSettling(null);
  }, [settling, visibleWeek, say]);

  // TWO OPENING BUBBLES, AND THE ORDER IS SAM'S RULING (2026-08-09): his own
  // greeting introduces the coach, then the week's shape. Two bubbles rather
  // than one sentence because they answer different questions — WHO is this,
  // and WHAT is this week — and because only the second changes when the week
  // does. The greeting is a constant; re-deriving it beside a live projection
  // would imply it depends on something.
  const composer = (
    <View style={styles.footer}>
      {pending ? (
        <ChangeCard
          card={pending.card}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
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
          <Bubble speaker="coach" text={opener.text} testID="coach-tab-opener" />
          {turns.length === 0 ? (
            // THE ONE CHIP, AND IT GOES AWAY THE MOMENT THE CONVERSATION STARTS.
            // A starter is for an empty conversation; leaving it under a running
            // one turns it into a button that repeats what the athlete just said.
            <Pressable
              style={styles.chip}
              onPress={() => send(COACH_CHANGE_COPY.moveChipLabel)}
              testID="coach-tab-chip-move"
              accessibilityRole="button"
              accessibilityLabel={COACH_CHANGE_COPY.moveChipLabel}
            >
              <Text variant="body">{COACH_CHANGE_COPY.moveChipLabel}</Text>
            </Pressable>
          ) : null}
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

/**
 * THE CHANGE CARD — L-C2 ON THE GLASS.
 *
 * It renders the card object and nothing else: a title, its labelled fields in
 * the order the rule put them in, and two controls. There is no `if` in here
 * about what kind of change it is, no formatting of a date, and no sentence.
 * **Every string on this component came out of `changeCardFor`**, which built
 * them from the action the door is about to be handed — so what the athlete
 * reads and what executes are two renderings of one value.
 *
 * Both controls are 44 high (L-C3, no dead tap zones) and sit in the footer, so
 * neither can be behind the keypad at any keyboard state.
 */
function ChangeCard({
  card,
  onConfirm,
  onCancel,
}: {
  card: CoachChangeCard;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.card} testID="coach-tab-change-card">
      <Text variant="h3">{card.title}</Text>
      {card.fields.map((field) => (
        <View key={field.label} style={styles.cardRow}>
          <Text variant="caption" style={styles.cardLabel}>{field.label}</Text>
          <Text variant="body" style={styles.cardValue}>{field.value}</Text>
        </View>
      ))}
      <View style={styles.cardActions}>
        <Pressable
          style={[styles.cardButton, styles.cardCancel]}
          onPress={onCancel}
          hitSlop={spacing.sm}
          testID="coach-tab-change-cancel"
          accessibilityRole="button"
          accessibilityLabel={card.cancelLabel}
        >
          <Text variant="body">{card.cancelLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.cardButton, styles.cardConfirm]}
          onPress={onConfirm}
          hitSlop={spacing.sm}
          testID="coach-tab-change-confirm"
          accessibilityRole="button"
          accessibilityLabel={card.confirmLabel}
        >
          <Text variant="body">{card.confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
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
  chip: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    backgroundColor: colors.surface.secondary,
  },
  // THE FOOTER IS THE WHOLE KEYBOARD-RIDING STRIP: the card when there is one,
  // then the composer. Both are positioned against the keypad rather than laid
  // out above it, which is what makes L-C3's "no control behind the keyboard"
  // structural instead of a thing to check.
  footer: {
    backgroundColor: colors.surface.primary,
  },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    gap: spacingValues.smmd,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.accent.lime,
    backgroundColor: colors.surface.secondary,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardLabel: {
    width: 48,
    color: colors.text.tertiary,
  },
  cardValue: {
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
  },
  cardCancel: {
    backgroundColor: colors.surface.primary,
  },
  cardConfirm: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.accent.lime,
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
