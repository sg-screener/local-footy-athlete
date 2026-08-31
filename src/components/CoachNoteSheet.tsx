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
import { Button, Sheet, SheetDescription, SheetHeader } from './ui';
import { explorerTestId } from '../utils/stableTestId';
import { signedCopy } from '../rules/signedCopy';
import { spacing } from '../theme/spacing';
import {
  statusUpdateOptionsForNote,
  type ActiveCoachNote,
} from '../utils/activeCoachNotes';
import type { ProgramControlStatusUpdate } from '../utils/programControlActions';
import type { CoachNoteSheetState } from '../screens/coach/useCoachNoteActions';
import {
  EXERCISE_EXCLUSION_QUESTION,
  EXERCISE_EXCLUSION_SCOPES,
  EXERCISE_EXCLUSION_SCOPE_LABEL,
  type ExerciseExclusionScope,
} from '../rules/exerciseExclusions';

/** Sam's three answers → the explorer's three ids. Same map the day screen uses. */
const EXCLUSION_SCOPE_TEST_ID: Record<ExerciseExclusionScope, 'today' | 'block' | 'future'> = {
  today_only: 'today',
  this_block: 'block',
  until_changed: 'future',
};

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

function statusUpdateLabel(status: ProgramControlStatusUpdate): string {
  switch (status) {
    case 'good_now': return signedCopy('status_update.good_now');
    case 'still_not_right': return signedCopy('status_update.still_not_right');
    case 'still_sick': return signedCopy('status_update.still_pretty_sick');
    case 'still_cooked': return signedCopy('status_update.still_cooked');
    case 'worse': return signedCopy('status_update.worse');
  }
}

export interface CoachNoteSheetProps {
  state: CoachNoteSheetState | null;
  equipmentFactIds: ReadonlySet<string>;
  onClose: () => void;
  onConfirmClear: () => void;
  onUpdateStatus: (status: ProgramControlStatusUpdate) => void;
  /**
   * SAM'S SCOPE QUESTION, ANSWERED FROM MY STATUS.
   *
   * Its answer goes to the SAME canonical transaction owner the day screen's
   * removal flow uses, which is what makes "Change scope" update the one
   * existing decision rather than mint a second exclusion beside it.
   */
  onChangeExclusionScope: (scope: ExerciseExclusionScope) => void;
}

export function CoachNoteSheet({
  state,
  equipmentFactIds,
  onClose,
  onConfirmClear,
  onUpdateStatus,
  onChangeExclusionScope,
}: CoachNoteSheetProps) {
  if (!state) return null;

  const copy = state.mode === 'clear'
    ? clearCopyForNote(state.note)
    : state.mode === 'exclusion_scope'
      ? {
          title: EXERCISE_EXCLUSION_QUESTION,
          // The row's own sentence already says which exercise and what the
          // current answer is; repeating it here would be a second, drifting copy.
          body: state.note.body,
        }
      : updateCopyForNote(state.note);
  const clearAction = state.note.actions.find((action) => action.kind.startsWith('clear'));
  const isStatusUpdate = state.mode === 'update' && state.note.type === 'temporary_status';
  const injuryEpisodeId = state.note.injuryEpisodeId;
  const reversibleAdjustmentId = state.note.reversibleAdjustmentId;
  const sourceFactId = state.note.temporarySourceFactIds?.[0] ?? state.note.constraintId;
  const isEquipmentFact = equipmentFactIds.has(sourceFactId);
  const headerTitle = injuryEpisodeId
    ? 'Injury'
    : isEquipmentFact
      ? 'Equipment'
      : isStatusUpdate
        ? 'Readiness'
        : 'Program change';

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
      <SheetHeader title={headerTitle} subtitle={copy.title} />
      <SheetDescription>{copy.body}</SheetDescription>
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
      ) : state.mode === 'exclusion_scope' ? (
        <>
          {/* THE THREE ANSWERS, FROM THE ONE VOCABULARY OWNER
              (`rules/exerciseExclusions`) — the same constants the day screen's
              removal sheet renders. Sam's contract asks one question in one
              wording; two surfaces asking it differently is two questions. */}
          {EXERCISE_EXCLUSION_SCOPES.map((scope, index) => (
            <Button
              key={scope}
              label={EXERCISE_EXCLUSION_SCOPE_LABEL[scope]}
              variant={index === 0 ? 'primary' : 'secondary'}
              size={index === 0 ? 'lg' : 'md'}
              onPress={() => onChangeExclusionScope(scope)}
              testID={explorerTestId.exclusionScopeOption(
                state.note.excludedExercise ?? state.note.constraintId,
                EXCLUSION_SCOPE_TEST_ID[scope],
              )}
              style={index === 0 ? undefined : { marginTop: spacing.sm }}
            />
          ))}
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
          {/* The five signed strings remain the complete vocabulary; the
              accepted readiness fact decides which subset belongs here. A
              cooked fact therefore cannot ask "Still pretty sick", and an
              illness fact cannot ask "Still cooked". Unknown legacy notes get
              the neutral three-answer fallback rather than a title guess. */}
          {statusUpdateOptionsForNote(state.note).map((status, index) => (
            <Button
              key={status}
              label={statusUpdateLabel(status)}
              variant={index === 0 ? 'primary' : 'secondary'}
              size={index === 0 ? 'lg' : 'md'}
              onPress={() => onUpdateStatus(status)}
              testID={status === 'good_now'
                ? explorerTestId.readinessClearAction(sourceFactId)
                : explorerTestId.readinessOption(status)}
              style={index === 0 ? undefined : { marginTop: spacing.sm }}
            />
          ))}
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
