/**
 * "YOUR SESSION HAS BEEN MODIFIED" — THE STEP BETWEEN THE NOTICE AND MY STATUS.
 *
 * SAM'S OWN PROTOTYPE, RULED 2026-08-13. He sent the screen, asked whether
 * tapping the day/week notice opened *"something like this? which you can then
 * tap and be taken to the status area inside the coach tab"*, and on being told
 * it went straight through in one hop, answered *"add the popup"*.
 *
 * WHAT IT IS FOR, IN HIS DESIGN'S OWN TERMS. The notice says HOW MANY things
 * are changing the program. This says WHICH ones — without making the athlete
 * leave the Program screen to find out, and with a way to say "not now" and get
 * on with the session. My Status is one tap further on, for when they want to
 * change something.
 *
 * IT LISTS. IT DOES NOT ACT — AND THAT IS THE LINE THIS FILE MUST NOT CROSS.
 * SEAT_INBOX item 16 rule (c) says the notice "carries no controls of its own",
 * and that rule is why the strip originally went straight to My Status. Sam's
 * prototype overrules the ROUTE, not the reason: the modifier LIST's eight
 * ACTIONS — clear, update, restore, resolve — still live on My Status alone.
 * So `note.actions` is deliberately NOT read here. The two controls this sheet
 * has are a navigation and a dismiss, and neither changes a modifier.
 *
 * THE RIGHT-HAND COLUMN IS SAM'S, SIGNED 2026-08-13 (SEAT_INBOX 22a). Eight
 * short phrases, one per modifier kind, keyed off the modifier's own `effect`
 * — a field its BUILDER sets, because only the builder can tell a tired week
 * from a sick one or an injury worked around from an injury that stopped
 * training. `EFFECT_COPY_ID` is a `Record` over the closed union, so adding a
 * member without giving it a phrase does not compile.
 *
 * TWELVE PHRASES NOW, AFTER SEAT_INBOX 23 SIGNED THE LAST FOUR. Only TWO kinds
 * still fall back to their own authored sentence, and both by ruling rather
 * than omission: SORENESS, whose sentence names the body part, and the
 * generated PROGRAMME-EFFECT notes, which carry their own. They are still
 * SHOWN and still COUNTED — a missing phrase is a gap in the words, never a
 * reason to stop telling the athlete their program changed.
 *
 * TIME CAPS RENDER NO ROW AT ALL (22b). Sam: *"i've taken out time caps for
 * now"*. **And they are absent from the COUNT as well, by his 2026-08-13
 * ruling** — the notice above this sheet counts what this sheet lists, so
 * hiding only the row would have put "2 active modifiers" over a list of one.
 * `PROGRAM_HIDDEN_EFFECTS` is the one filter, exported so the count and the
 * list cannot apply different ones. My Status is unfiltered on purpose: it
 * holds the only control that clears a cap.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Button, Sheet } from './ui';
import { signedCopy } from '../rules/signedCopy';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import type { ActiveProgramModifierEffect } from '../utils/activeProgramModifiers';
import { spacing } from '../theme/spacing';
import { isShownOnProgram } from '../rules/programModifierVisibility';

/**
 * Sam's eight phrases, by effect. `null` means "no short phrase" and the row
 * shows the modifier's own sentence instead — never an invented phrase.
 *
 * A `Record` over the closed union, so a new effect member CANNOT be added
 * without a decision here. That is the same trick the family table used in item
 * 14, where the compiler found an eleventh family nobody had noticed.
 */
const EFFECT_COPY_ID: Record<ActiveProgramModifierEffect, string | null> = {
  volume_adjusted: 'modifiers.effect.volume_adjusted',
  training_eased: 'modifiers.effect.training_eased',
  exercises_swapped: 'modifiers.effect.exercises_swapped',
  training_paused: 'modifiers.effect.training_paused',
  exercises_substituted: 'modifiers.effect.exercises_substituted',
  sessions_moved: 'modifiers.effect.sessions_moved',
  club_sessions_off: 'modifiers.effect.club_sessions_off',
  planned_lighter: 'modifiers.effect.planned_lighter',
  week_rebuilt: 'modifiers.effect.week_rebuilt',
  exercise_preference_applied: 'modifiers.effect.exercise_preference_applied',
  exercise_removed: 'modifiers.effect.exercise_removed',
  exercise_prioritised: 'modifiers.effect.exercise_prioritised',
  conditioning_swapped: 'modifiers.effect.conditioning_swapped',
  not_shown: null,
  unsigned: null,
};

export interface ModifiersSheetProps {
  readonly visible: boolean;
  /** From `useActiveModifiers` — the same list My Status renders. */
  readonly modifiers: readonly ActiveCoachNote[];
  /** Dismiss without going anywhere. His prototype's "Not now". */
  readonly onClose: () => void;
  /** Opens My Status on the Coach tab. His prototype's "Go to my status". */
  readonly onGoToStatus: () => void;
}

export function ModifiersSheet({
  visible, modifiers, onClose, onGoToStatus,
}: ModifiersSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="modifiers-sheet">
      <Text style={styles.title} testID="modifiers-sheet-title">
        {signedCopy('modifiers.sheet.title')}
      </Text>
      <Text style={styles.body}>{signedCopy('modifiers.sheet.body')}</Text>

      <View style={styles.list}>
        {modifiers.filter(isShownOnProgram).map((note) => (
          // KEYED AND ADDRESSED BY THE MODIFIER'S OWN CONSTRAINT ID, the same
          // identity My Status uses. An array position would rename every row
          // the moment one modifier clears.
          <View
            key={note.id}
            style={styles.row}
            testID={`modifiers-sheet-row-${note.constraintId}`}
          >
            <Text style={styles.rowTitle} numberOfLines={2}>{note.title}</Text>
            {/* SAM'S PHRASE WHERE HE WROTE ONE; THE MODIFIER'S OWN SENTENCE
                OTHERWISE. Never a phrase this file made up. */}
            <Text style={styles.rowBody}>
              {EFFECT_COPY_ID[note.effect]
                ? signedCopy(EFFECT_COPY_ID[note.effect] as string)
                : note.body}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>{signedCopy('modifiers.sheet.footer')}</Text>

      <Button
        label={signedCopy('modifiers.sheet.go')}
        onPress={onGoToStatus}
        testID="modifiers-sheet-go-to-status"
      />
      <Button
        label={signedCopy('modifiers.sheet.dismiss')}
        onPress={onClose}
        variant="ghost"
        testID="modifiers-sheet-dismiss"
      />
    </Sheet>
  );
}

// NO NEW COLOUR TOKEN AND NO NEW FONT SIZE — the merge's governing rule, and
// the same one `ModifiersStrip` next door was built under. Every value here is
// already on these screens.
const styles = StyleSheet.create({
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  body: {
    color: '#B5B5B5',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A2A',
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
    paddingVertical: spacing.sm,
    gap: 2,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  rowBody: {
    color: '#B5B5B5',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    color: '#B5B5B5',
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
