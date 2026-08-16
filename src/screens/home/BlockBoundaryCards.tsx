/**
 * THE TWO BLOCK-BOUNDARY CARDS.
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
import type {
  BlockBoundaryNoticeModel,
  WeeklyCommitmentPromptModel,
} from './useBlockBoundaryPrompts';

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
 * THE MISSED-SESSION COMMITMENT QUESTION.
 *
 * ⚠ **THE OPTIONS ARE THE DERIVATION'S, NOT THIS COMPONENT'S.** Every count
 * shown has been proven buildable for this athlete by the scheduler, and every
 * label is signed copy. A component that offered "how about 2?" on its own would
 * be offering a week the app may then refuse to build.
 */
export function WeeklyCommitmentPromptCard({ prompt, onConfirm, onDecline }: {
  prompt: WeeklyCommitmentPromptModel;
  onConfirm: (sessionsPerWeek: number) => void | Promise<void>;
  onDecline: () => void;
}) {
  return (
    <Card
      tone="outline"
      padding="md"
      radius="lg"
      style={styles.card}
      testID="home-weekly-commitment-prompt"
    >
      <Text style={styles.body} testID="home-weekly-commitment-question">
        {String(prompt.sentence)}
      </Text>
      <View style={styles.actions}>
        {prompt.options.map((option) => (
          <ChoiceChip
            key={option.sessionsPerWeek}
            testID={`home-weekly-commitment-option-${option.sessionsPerWeek}`}
            label={String(option.label)}
            primary
            onPress={() => { void onConfirm(option.sessionsPerWeek); }}
          />
        ))}
        <ChoiceChip
          testID="home-weekly-commitment-decline"
          label="Keep it as is"
          onPress={onDecline}
        />
      </View>
    </Card>
  );
}


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
  chipPrimary: { backgroundColor: '#C8FF00', borderColor: '#C8FF00' },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  chipPrimaryText: { color: '#0B0B0B' },
});
