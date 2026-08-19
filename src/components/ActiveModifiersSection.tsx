/**
 * THE ACTIVE MODIFIERS, AS A LIST WITH THEIR CONTROLS — ONE COMPONENT, TWO MOUNTS.
 *
 * EXTRACTED FROM `HomeScreenV2` 2026-08-10, UI merge slice 3, AND THE EXTRACTION
 * IS THE POINT. Ruling 4 moves this list to the coach page's status screen; the
 * merge plan's binding rule is *"'My status' MOUNTS THE EXISTING DOORS. It does
 * not build new ones"* — and a list re-implemented on a second screen is a second
 * door by another name, which would drift the first time an action was added.
 *
 * EVERY `testID` IN HERE IS A COORDINATE SOMETHING ALREADY RESOLVES — the
 * explorer, the walker and the dev-e2e finder all name these. **They are
 * unchanged by the move**, byte for byte, because a rename here is a silent
 * rename of doors Sam has tapped on a device.
 *
 * The section renders NOTHING when the list is empty, and that property is load
 * bearing on the day screen: a normal week must lose no space to it.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Card } from './ui';
import { explorerTestId } from '../utils/stableTestId';
import type {
  ActiveCoachNote,
  ActiveCoachNoteAction,
} from '../utils/activeCoachNotes';

/* THE NOT-YET MACHINERY RETIRED 2026-08-12 (SEAT_INBOX item 8 (b)).
 *
 * `actionsNotYet` and `liveActionKinds` existed because My Status mounted this
 * list before its writers could run: they dimmed the controls that were not
 * wired yet and captioned them "Change this on your program screen for now."
 *
 * ALL EIGHT KINDS ARE LIVE ON MY STATUS NOW, so there is nothing left to dim —
 * and keeping the machinery would mean the only thing it could still do is dim
 * a control that works, which is `LAW-never-disable-a-set-for-part-of-it`
 * pointing the other way. Its founding case is preserved in
 * `src/rules/lawRegistry.ts`; the law is not retired, its instrument moved to
 * `test:my-status-modifiers`, which asserts the ROUTER is total over the eight
 * kinds rather than that a dimming flag is resolved per action.
 *
 * The caption was ALSO ALREADY FALSE. `HomeScreenV2` stopped rendering this
 * list at the UI merge, so the Program screen it pointed at had nothing on it —
 * an athlete who followed the sentence found an empty room. */
export interface ActiveModifiersSectionProps {
  notes: ActiveCoachNote[];
  equipmentFactIds: ReadonlySet<string>;
  onAction: (note: ActiveCoachNote, action: ActiveCoachNoteAction) => void;
}

export function ActiveModifiersSection({
  notes, equipmentFactIds, onAction,
}: ActiveModifiersSectionProps) {
  if (notes.length === 0) return null;

  return (
    <View style={styles.coachNotesSection} testID="program-active-coach-notes">
      <Text style={styles.coachNotesTitle}>COACH NOTES</Text>
      <View style={styles.coachNotesStack}>
        {notes.map((note) => (
          <Card
            key={note.id}
            tone="outline"
            padding="none"
            radius="lg"
            style={styles.coachNoteCard}
            testID={note.injuryEpisodeId
              ? explorerTestId.injuryActive(note.injuryEpisodeId)
              : note.reversibleAdjustmentId
                ? explorerTestId.adjustmentActive(note.reversibleAdjustmentId)
                : `program-active-coach-note-${note.constraintId}`}
          >
            <View style={styles.coachNoteContent}>
              <View style={styles.coachNoteHeader}>
                <View style={styles.coachNoteDot} />
                <Text style={styles.coachNoteTitle} numberOfLines={2}>
                  {note.title}
                </Text>
              </View>
              <Text style={styles.coachNoteBody}>{note.body}</Text>
              <View style={styles.coachNoteActions}>
                {note.actions.map((action, index) => {
                  const primary = index === 0;
                  const sourceFactId = note.temporarySourceFactIds?.[0];
                  const isEquipmentFact = sourceFactId
                    ? equipmentFactIds.has(sourceFactId)
                    : false;
                  const actionTestID = action.kind === 'update_injury' && note.injuryEpisodeId
                    ? explorerTestId.injuryIngress('update', note.injuryEpisodeId)
                    : action.kind === 'clear_injury' && note.injuryEpisodeId
                      ? explorerTestId.injuryResolveAction(note.injuryEpisodeId)
                      : action.kind === 'restore_adjustment' && note.reversibleAdjustmentId
                        ? explorerTestId.adjustmentRestore(note.reversibleAdjustmentId)
                        : action.kind === 'update_status' && sourceFactId
                          ? explorerTestId.readinessUpdate(sourceFactId)
                          : action.kind === 'clear_adjustment' && sourceFactId && isEquipmentFact
                            ? explorerTestId.equipmentClear(sourceFactId)
                            : action.kind === 'update_adjustment' && sourceFactId && isEquipmentFact
                              ? explorerTestId.equipmentUpdate(sourceFactId)
                          : `program-active-coach-note-action-${note.constraintId}-${action.kind}`;
                  return (
                    <Pressable
                      key={action.kind}
                      onPress={() => onAction(note, action)}
                      style={({ pressed }) => [
                        styles.coachNoteAction,
                        primary && styles.coachNotePrimaryAction,
                        pressed && { opacity: 0.72 },
                      ]}
                      testID={actionTestID}
                      accessibilityRole="button"
                      // ── THE ATHLETE'S WORD, NOT THE COORDINATE ──────────────
                      // This was `accessibilityLabel={actionTestID}`, so the
                      // control that says "Restore exercise" on screen ANNOUNCED
                      // ITSELF as `program-active-coach-note-action-…-restore_
                      // exclusion`. A sighted athlete read the right word; a
                      // screen-reader athlete heard an internal id, and the
                      // accessibility tree had no copy of the label at all —
                      // which is also why a walk asserting the WORDS could not
                      // see it, measured 2026-08-19.
                      //
                      // `testID` is unchanged, so every `id:` coordinate the
                      // explorer and the flows already resolve still resolves.
                      accessibilityLabel={action.label}
                    >
                      <Text
                        style={[
                          styles.coachNoteActionText,
                          primary && styles.coachNotePrimaryActionText,
                        ]}
                        numberOfLines={1}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

// MOVED WITH THE COMPONENT, NOT COPIED. The values are byte-identical to the
// ones this block used inside `HomeScreenV2`; the merge's governing rule forbids
// this slice touching a colour token or a font size, and an extraction that
// restyled would break it while looking like a move.
const styles = StyleSheet.create({
  coachNotesSection: { paddingTop: 16, gap: 12 },
  coachNotesTitle: {
    color: '#C8FF00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  coachNotesStack: { gap: 8 },
  coachNoteCard: {
    backgroundColor: '#11140F',
    borderColor: 'rgba(200, 255, 0, 0.20)',
  },
  coachNoteContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  coachNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachNoteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8FF00' },
  coachNoteTitle: { flex: 1, color: '#F5F5F5', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  coachNoteBody: { color: '#A7A7A7', fontSize: 12, lineHeight: 17 },
  coachNoteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  coachNoteAction: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B1B1B',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  coachNotePrimaryAction: {
    backgroundColor: 'rgba(200, 255, 0, 0.13)',
    borderColor: 'rgba(200, 255, 0, 0.36)',
  },
  coachNoteActionText: { color: '#CFCFCF', fontSize: 12, fontWeight: '700' },
  coachNotePrimaryActionText: { color: '#C8FF00' },
});
