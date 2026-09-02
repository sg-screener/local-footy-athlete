import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { borderRadius, spacing, spacingValues } from '../theme/spacing';
import type { CommitmentConversation } from '../rules/weeklyCommitmentConversation';

/**
 * THE WEEKLY-COMMITMENT CARD — R-105, IN THE COACH'S FOOTER.
 *
 * It renders the derived conversation and nothing else: the counts the athlete
 * may say yes to, and the one way to say no. **There is no `if` in here about
 * which direction the conversation is**, no sentence, and no formatting of a
 * number — `deriveWeeklyCommitmentConversation` returns one option for the
 * extra-session offer and up to five for the smaller-week question, already
 * labelled with signed copy, and this component draws whatever it was given.
 *
 * ⚠ **THE OPTIONS ARE THE DERIVATION'S, NOT THIS COMPONENT'S.** Every count
 * shown was proven buildable by GENERATION before this card existed. A component
 * that offered "how about 2?" on its own would be offering a week the app may
 * then refuse to build — and for the extra-session direction it would be
 * offering a week nobody has previewed.
 *
 * ⚠ **DECLINE IS ALWAYS PRESENT AND IS NEVER THE PRIMARY.** The approved
 * contract's *"Rebuild only after the athlete confirms"* and *"do not silently
 * reduce the plan"* are why a decline chip cannot be conditional here: there is
 * no state of this card in which the only way out is to change the program.
 *
 * It sits in the `KeyboardSafeArea` FOOTER for the same L-C3 reason the change
 * card does — a card that can be scrolled is a card the keypad can cover, and
 * these buttons change the athlete's program.
 */
export function CommitmentCard({
  conversation,
  onAccept,
  onDecline,
}: {
  conversation: CommitmentConversation;
  onAccept: (sessionsPerWeek: number) => void | Promise<void>;
  onDecline: () => void;
}) {
  return (
    <View style={styles.card} testID="coach-tab-commitment-card">
      {conversation.options.map((option) => (
        <Pressable
          key={option.sessionsPerWeek}
          style={[styles.cardButton, styles.cardConfirm]}
          onPress={() => { void onAccept(option.sessionsPerWeek); }}
          hitSlop={spacing.sm}
          testID={`coach-tab-commitment-option-${option.sessionsPerWeek}`}
          accessibilityRole="button"
          accessibilityLabel={String(option.label)}
        >
          <Text variant="body" style={styles.cardConfirmText}>{String(option.label)}</Text>
        </Pressable>
      ))}
      <Pressable
        style={[styles.cardButton, styles.cardCancel]}
        onPress={onDecline}
        hitSlop={spacing.sm}
        testID="coach-tab-commitment-decline"
        accessibilityRole="button"
        accessibilityLabel={String(conversation.declineLabel)}
      >
        <Text variant="body">{String(conversation.declineLabel)}</Text>
      </Pressable>
    </View>
  );
}


/**
 * ⚠ COPIED FROM `CoachTabScreen`'s change card, VALUE FOR VALUE, not
 * re-designed. This card sits in the same footer as that one and the governing
 * rule for the coach surface is HER STRUCTURE, HIS STYLE — a second visual
 * treatment for a second card in the same footer is a new design decision, and
 * this unit was not given one to make. Both controls are 44 high (L-C3, no dead
 * tap zones), which is also why they are not wrapped in a row: the options list
 * can be five long, and five 44pt buttons squeezed onto one row is a row of dead
 * tap zones.
 */
const styles = StyleSheet.create({
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
  cardButton: {
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
  /**
   * TEXT ON LIME IS NEAR-BLACK, AND IT IS THE APP'S OWN TOKEN.
   *
   * Sam, 2026-08-23, looking at this card on his phone: *"i don't know what this
   * says because i can't fucking read it - why are these buttons different style
   * to normal?"* — white on `#D8D800`.
   *
   * THE ANSWER TO HIS SECOND QUESTION IS THE CAUSE OF THE FIRST. These are
   * hand-rolled `Pressable`s, not the shared `Button`, so they never inherited
   * its `getTextColor()` — which returns `colors.button.primaryText` (`#0C0C0C`)
   * for exactly this background. A bare `<Text variant="body">` defaults to
   * `colors.text.primary` (`#FFFFFF`), and on lime that is unreadable.
   *
   * The SAME token is used here rather than a new near-black, so these buttons
   * now read identically to every primary button in the app — which is what
   * "normal" means in his question.
   */
  cardConfirmText: {
    color: colors.button.primaryText,
  },
});
