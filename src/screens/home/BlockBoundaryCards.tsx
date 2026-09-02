/**
 * THE BLOCK-BOUNDARY NOTICE CARD.
 *
 * Extracted from `HomeScreenV2` so they can be DRIVEN — `HomeScreenV2` pulls in
 * navigation, gesture handling, SVG and three thousand lines of week logic, and
 * a suite that wants to tap a button on this card should not have to stand all
 * of that up. The screen imports them and mounts them exactly where the
 * missed-session follow-up sits; nothing else changed in the move.
 *
 * They reuse the Program surface's existing card + chip pattern rather than
 * introducing a second one: `Card tone="outline"` with `MissedChip`-shaped
 * pressables, which is what the missed-session follow-up above them already is.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui';
import { spacing } from '../../theme/spacing';
import type { BlockBoundaryNoticeModel } from './useBlockBoundaryPrompts';

/** The Program surface's existing choice chip, shared by both cards. */
function ChoiceChip({ testID, label, primary, onPress }: {
  testID: string;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        primary && styles.chipPrimary,
        pressed && { opacity: 0.72 },
      ]}
    >
      <Text style={[styles.chipText, primary && styles.chipPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

/**
 * THE REDUCED-BLOCK NOTICE.
 *
 * ⚠ **EVERY WORD IS SIGNED AND EVERY NUMBER IS STORED.** The headline is Sam's
 * approved sentence, rendered by `blockBoundaryReducedSentence` from the stored
 * `hard_block_reduced` row — this component receives it already rendered and
 * cannot reword it. The lines beneath are the row's own `setsReduced` entries,
 * so what the athlete reads and what the block stores are the same decision.
 */
export function BlockBoundaryNoticeCard({ notice, onAcknowledge }: {
  notice: BlockBoundaryNoticeModel;
  onAcknowledge: () => void;
}) {
  return (
    <Card
      tone="outline"
      padding="md"
      radius="lg"
      style={styles.card}
      testID="home-block-boundary-notice"
    >
      <Text style={styles.body} testID="home-block-boundary-notice-sentence">
        {String(notice.sentence)}
      </Text>
      {notice.row.setsReduced.map((change) => (
        <Text
          key={change.exerciseName}
          style={styles.body}
          testID={`home-block-boundary-change-${change.exerciseName}`}
        >
          {change.exerciseName}: {change.previousSets} sets → {change.nextSets} sets
        </Text>
      ))}
      <View style={styles.actions}>
        <ChoiceChip
          testID="home-block-boundary-notice-dismiss"
          label="Got it"
          primary
          onPress={onAcknowledge}
        />
      </View>
    </Card>
  );
}

/**
 * ⚠ **TWO CARDS LEFT THIS FILE ON 2026-08-20 — R-105.**
 *
 * `WeeklyCommitmentPromptCard` and `ExtraSessionOfferCard` rendered the
 * missed-session commitment question and the extra-session offer on the Program
 * surface. **Sam, 2026-08-19:** *"This should not be popping up on the main page
 * - it should show up in the coaches chat with a notification"*.
 *
 * Both are now drawn by `screens/coach/CoachTabScreen.tsx`, in the keyboard-safe
 * FOOTER beside the change card, from
 * `rules/weeklyCommitmentConversation.ts`. Their words are the same signed
 * entries; their answers go through the same door
 * (`store/weeklyCommitmentAnswer.ts`). Nothing about the decision changed —
 * only which surface holds the conversation.
 *
 * The notice above stays because it is a NOTICE about a decision already taken,
 * not a negotiation, and R-105's subject is *"a surface that asks the athlete to
 * renegotiate their week"*.
 */

/**
 * ⚠ COPIED VERBATIM from `HomeScreenV2`'s missed-session card, not re-designed.
 * The two cards sit directly beside that one on the Program surface and the
 * governing rule for this surface is HER STRUCTURE, HIS STYLE — a second visual
 * treatment for a third card in the same stack is a new design decision, and
 * this unit was not given one to make.
 */
const styles = StyleSheet.create({
  card: { marginTop: spacing.sm },
  body: {
    color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19,
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  chipPrimary: { backgroundColor: '#D8D800', borderColor: '#D8D800' },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  chipPrimaryText: { color: '#0B0B0B' },
});
