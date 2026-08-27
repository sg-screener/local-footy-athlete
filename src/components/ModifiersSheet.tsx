/** Preserved legacy presentation; R-249 removed its runtime mount.
 * R-262 keeps its read-only list consistent with Program and My Status.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Button, Sheet, SheetDescription, SheetHeader } from './ui';
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
  session_time_limited: null,
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
      <SheetHeader
        title="Program"
        subtitle={signedCopy('modifiers.sheet.title')}
        subtitleTestID="modifiers-sheet-title"
      />
      <SheetDescription>{signedCopy('modifiers.sheet.body')}</SheetDescription>

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
