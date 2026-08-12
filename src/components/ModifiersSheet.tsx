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
 * WHY IT RENDERS `title` + `body` AND NOT A TWO-WORD EFFECT COLUMN. His
 * prototype's rows read "Time away / Training volume adjusted" and "Equipment
 * access / Exercises substituted" — a short effect phrase per row. No such
 * phrase exists in the domain: `ActiveCoachNote` carries `title` and `body`,
 * and there is no signed effect wording for the other modifier kinds. Inventing
 * one per kind would put unsigned athlete-facing words on the glass, which is
 * the one thing `SignedCopy` exists to stop. So each row shows the modifier's
 * OWN authored title and its OWN authored sentence — the same two strings My
 * Status shows, because they are the same modifier describing itself.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Button, Sheet } from './ui';
import { signedCopy } from '../rules/signedCopy';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import { spacing } from '../theme/spacing';

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
        {modifiers.map((note) => (
          // KEYED AND ADDRESSED BY THE MODIFIER'S OWN CONSTRAINT ID, the same
          // identity My Status uses. An array position would rename every row
          // the moment one modifier clears.
          <View
            key={note.id}
            style={styles.row}
            testID={`modifiers-sheet-row-${note.constraintId}`}
          >
            <Text style={styles.rowTitle} numberOfLines={2}>{note.title}</Text>
            <Text style={styles.rowBody}>{note.body}</Text>
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
