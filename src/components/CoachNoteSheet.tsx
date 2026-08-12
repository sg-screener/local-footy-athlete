/**
 * THE MODIFIER CONFIRMATION SHEET — ONE COMPONENT, THE SCREEN THAT OWNS THE
 * MODIFIERS MOUNTS IT.
 *
 * MOVED OUT OF `HomeScreenV2` 2026-08-12 (SEAT_INBOX item 8), and the move is
 * what makes the order's step (c) safe. (c) deletes the Program-side coach-note
 * leftovers — including this sheet's mount — while (a) makes seven controls on
 * My Status live, and five of those seven open THIS sheet. Deleting it and
 * re-writing it on the coach side would have been a second door for a decision
 * that already has one, which is the merge plan's binding rule:
 *
 *   > **"My status" MOUNTS THE EXISTING DOORS. It does not build new ones.**
 *
 * SO NOTHING HERE CHANGED. Every string, every `testID` and every branch is
 * byte-identical to the version that lived in `HomeScreenV2`, because these ids
 * are coordinates the explorer, the walker and Sam's own taps already resolve,
 * and a rename during a move is a rename nobody reviews.
 *
 * The two copy helpers travel with it: they have exactly one reader, and a
 * helper left behind in a file that no longer mounts its component is the
 * dead-weight this repo keeps paying for.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Button, Sheet } from './ui';
import { explorerTestId } from '../utils/stableTestId';
import { spacing } from '../theme/spacing';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import type { ProgramControlStatusUpdate } from '../utils/programControlActions';
import type { CoachNoteSheetState } from '../screens/coach/useCoachNoteActions';

function clearCopyForNote(note: ActiveCoachNote): { title: string; body: string } {
  if (note.reversibleAdjustmentId) {
    return {
      title: 'Restore the previous fixture?',
      body: 'This puts the moved sessions back and sorts the week around your game.',
    };
  }
  if (note.type === 'injury') {
    const clearLabel = note.actions.find((action) => action.kind === 'clear_injury')?.label ?? '';
    if (/cleared/i.test(clearLabel) || /training paused/i.test(note.title)) {
      return {
        title: 'Resume normal training?',
        body: "Only clear this if you've been checked or the issue has settled enough to train normally.",
      };
    }
    return {
      title: 'Clear this injury?',
      body: "We'll stop adjusting your program around this and update your week.",
    };
  }
  if (note.type === 'temporary_status') {
    return {
      title: 'Clear this adjustment?',
      body: "We'll stop adjusting your program around this and update your week.",
    };
  }
  return {
    title: 'Clear this adjustment?',
    body: "We'll stop factoring this in and get your week back to normal.",
  };
}

function updateCopyForNote(note: ActiveCoachNote): { title: string; body: string } {
  if (note.type === 'injury') {
    return {
      title: note.actions.find((a) => a.kind === 'update_injury')?.label ?? 'Update injury',
      body: 'Keep this note active if the issue still affects training. Clear it only when it has settled.',
    };
  }
  if (note.type === 'temporary_status') {
    return {
      title: 'How are you feeling now?',
      body: 'Choose the closest option and your program will update from there.',
    };
  }
  return {
    title: 'Update adjustment',
    body: 'Keep this adjustment active for future sessions, or clear it if it no longer applies.',
  };
}

export interface CoachNoteSheetProps {
  state: CoachNoteSheetState | null;
  equipmentFactIds: ReadonlySet<string>;
  onClose: () => void;
  onConfirmClear: () => void;
  onUpdateStatus: (status: ProgramControlStatusUpdate) => void;
}

export function CoachNoteSheet({
  state,
  equipmentFactIds,
  onClose,
  onConfirmClear,
  onUpdateStatus,
}: CoachNoteSheetProps) {
  if (!state) return null;

  const copy = state.mode === 'clear'
    ? clearCopyForNote(state.note)
    : updateCopyForNote(state.note);
  const clearAction = state.note.actions.find((action) => action.kind.startsWith('clear'));
  const isStatusUpdate = state.mode === 'update' && state.note.type === 'temporary_status';
  const injuryEpisodeId = state.note.injuryEpisodeId;
  const reversibleAdjustmentId = state.note.reversibleAdjustmentId;
  const sourceFactId = state.note.temporarySourceFactIds?.[0] ?? state.note.constraintId;
  const isEquipmentFact = equipmentFactIds.has(sourceFactId);

  return (
    <Sheet
      visible={Boolean(state)}
      onClose={onClose}
      testID={injuryEpisodeId
        ? explorerTestId.injuryDetail(injuryEpisodeId)
        : reversibleAdjustmentId
          ? explorerTestId.adjustmentRestore(reversibleAdjustmentId)
          : `coach-note-detail-${sourceFactId}`}
    >
      <Text style={styles.sheetTitle}>{copy.title}</Text>
      <Text style={styles.sheetBody}>{copy.body}</Text>
      {state.mode === 'clear' ? (
        <>
          <Button
            label={state.note.reversibleAdjustmentId
              ? 'Restore fixture'
              : 'Clear and update program'}
            size="lg"
            onPress={onConfirmClear}
            testID={reversibleAdjustmentId
              ? explorerTestId.adjustmentRestore(reversibleAdjustmentId)
              : injuryEpisodeId
                ? explorerTestId.injuryResolveAction(injuryEpisodeId)
                : isEquipmentFact
                  ? explorerTestId.equipmentClear(sourceFactId)
                  : explorerTestId.readinessClearAction(sourceFactId)}
          />
          <Button
            label="Cancel"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      ) : isStatusUpdate ? (
        <>
          <Button
            label="I'm good now"
            size="lg"
            onPress={() => onUpdateStatus('good_now')}
            testID={explorerTestId.readinessClearAction(sourceFactId)}
          />
          <Button
            label="Still not right"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_not_right')}
            testID={explorerTestId.readinessOption('still_not_right')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Still sick"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_sick')}
            testID={explorerTestId.readinessOption('still_sick')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Still cooked"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('still_cooked')}
            testID={explorerTestId.readinessOption('still_cooked')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Worse"
            variant="secondary"
            size="md"
            onPress={() => onUpdateStatus('worse')}
            testID={explorerTestId.readinessOption('worse')}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Cancel"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      ) : (
        <>
          <Button
            label="Keep active"
            size="lg"
            onPress={onClose}
          />
          <Button
            label={clearAction?.label ?? 'Clear adjustment'}
            variant="secondary"
            size="md"
            onPress={onConfirmClear}
            testID={injuryEpisodeId
              ? explorerTestId.injuryResolveAction(injuryEpisodeId)
              : isEquipmentFact
                ? explorerTestId.equipmentClear(sourceFactId)
                : explorerTestId.readinessClearAction(sourceFactId)}
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
    </Sheet>
  );
}

// MOVED WITH THE COMPONENT, BYTE-IDENTICAL. `HomeScreenV2`'s stylesheet still
// declares these for its own sheets; copying the two values here rather than
// exporting that stylesheet keeps the component self-contained without
// restyling anything — the merge's governing rule forbids this unit touching a
// colour token or a font size, and a move that restyled would break it while
// looking like a move.
const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 19, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 6,
  },
  sheetBody: {
    color: '#B0B0B0', fontSize: 14, lineHeight: 20, textAlign: 'center',
    marginBottom: spacing.md, paddingHorizontal: spacing.sm,
  },
});
